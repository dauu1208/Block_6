# HỢP ĐỒNG API (frontend ⇄ backend)

Frontend đã chuyển sang **SPA** (thư mục `frontend/`), gọi backend qua **REST API** dưới đường dẫn `/api`.
File này là thứ hai bên phải thống nhất: backend làm đúng như dưới đây thì ghép vào là chạy.
Có sẵn **mock server** (`npm run mock`) làm đúng hợp đồng này để so sánh khi viết backend thật.

## 1. Quy ước chung

| Mục | Quy ước |
| --- | --- |
| Gốc API | `/api` |
| Định dạng | JSON (UTF-8). Riêng tạo/sửa **món ăn** dùng `multipart/form-data` vì có ảnh |
| Thành công | `{ "data": ... , "meta": ... }` (`meta` chỉ có ở danh sách) hoặc `204` không có nội dung |
| Lỗi | luôn có dạng `{ "error": { "code", "message", "details"? } }`, kèm mã HTTP đúng |
| Đăng nhập | cookie `role` (`httpOnly`), giữ nguyên cách chọn vai của bản cũ, không mật khẩu |
| Số tiền | `price` trả về **kiểu số** (Sequelize `DECIMAL` trả chuỗi, nhớ `Number(...)`) |

### Định dạng lỗi

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu chưa hợp lệ.",
    "details": { "name": "Tên món đã tồn tại", "price": "Giá là bắt buộc" }
  }
}
```

- `message`: câu tiếng Việt hiển thị thẳng cho người dùng.
- `details`: chỉ có ở lỗi nhập liệu, khóa là **tên trường của form** (`name`, `price`, `category`, `chefId`, `ingredientIds`, `unit`, `specialty`, `description`, `image`), giá trị là thông báo của riêng ô đó.

| HTTP | `code` | Khi nào |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | dữ liệu gửi lên sai (có `details`) |
| 401 | `UNAUTHORIZED` | chưa chọn vai mà gọi API cần quyền |
| 403 | `FORBIDDEN` | vai `user` gọi API chỉ dành cho `admin` |
| 404 | `NOT_FOUND` | id sai định dạng / không tồn tại; **cả `/api/...` không có thật** (trả JSON, không trả HTML) |
| 409 | `CONFLICT` | không thể xóa vì còn ràng buộc (vd. đầu bếp còn phụ trách món) |
| 500 | `INTERNAL_ERROR` | lỗi server (đừng lộ stack trace) |

Frontend xử lý: 401 → chuyển sang `/login`; 403/404/500/mất kết nối → màn hình lỗi; 400 → gắn `details` vào từng ô; 409 → hiện `message`.

## 2. Mô hình dữ liệu trả về

```jsonc
// Dish (món ăn): luôn kèm chef và ingredients
{
  "id": 1, "name": "Phở bò", "description": "…" /* hoặc null */,
  "price": 65000,                      // số nguyên, KIỂU SỐ
  "category": "Món chính", "available": true,
  "imageUrl": "https://…/abc.webp",    // hoặc null
  "chefId": 1,
  "chef": { "id": 1, "name": "Nguyễn Văn An", "specialty": "Món Huế" },   // chef.specialty có thể null
  "ingredients": [ { "id": 1, "name": "Thịt bò", "unit": "kg" } ]
}
// Chef:       { "id": 1, "name": "…", "specialty": "…" | null }
// Ingredient: { "id": 1, "name": "…", "unit": "kg" }
```

Không trả `imagePath` (chỉ backend dùng để xóa ảnh).
Frontend tự suy ra emoji thay ảnh và ảnh thu nhỏ (`abc.webp` → `abc_s.webp`, lỗi thì dùng ảnh gốc), nên backend vẫn tạo thumbnail khi upload như cũ.

## 3. Danh sách endpoint

### Xác thực (vai)

| Phương thức | Đường dẫn | Body | Kết quả |
| --- | --- | --- | --- |
| GET | `/api/auth/me` | | `200 { "data": { "role": null \| "user" \| "admin" } }` |
| POST | `/api/auth/login` | `{ "role": "user" \| "admin" }` | `200 { "data": { "role": "admin" } }` + `Set-Cookie: role`. Role sai → `400 VALIDATION_ERROR` |
| POST | `/api/auth/logout` | | `204` + xóa cookie |

### Dữ liệu dùng chung

| Phương thức | Đường dẫn | Quyền | Kết quả |
| --- | --- | --- | --- |
| GET | `/api/options` | công khai | `200 { "data": { "categories": [...], "units": [...], "limits": {...} } }`, lấy từ `src/constants.js` (`CATEGORIES`, `UNITS`, `LIMITS`). Frontend dùng để đổ ô chọn và viết gợi ý, không viết cứng |

### Món ăn, đầu bếp, nguyên liệu (`:resource` = `dishes` \| `chefs` \| `ingredients`)

| Phương thức | Đường dẫn | Quyền | Kết quả |
| --- | --- | --- | --- |
| GET | `/api/dishes` | công khai | danh sách (xem bên dưới) |
| GET | `/api/dishes/:id` | công khai | `200 { "data": Dish }` · `404` |
| GET | `/api/chefs`, `/api/ingredients` | **admin** | danh sách |
| GET | `/api/chefs/:id`, `/api/ingredients/:id` | **admin** | `200 { "data": ... }` · `404` |
| POST | `/api/:resource` | **admin** | `201 { "data": bản ghi mới }` + header `Location: /api/:resource/:id` · `400` |
| PUT | `/api/:resource/:id` | **admin** | `200 { "data": bản ghi sau khi sửa }` · `400` · `404` |
| DELETE | `/api/:resource/:id` | **admin** | `204` · `404` · `409` |

Không có vai → `401`; vai `user` → `403` (kiểm tra **trước** khi đọc dữ liệu).

#### Danh sách: `GET /api/:resource?q=&page=` hoặc `?all=true`

- `q`: tìm theo **tên**, không phân biệt hoa/thường và dấu tiếng Việt, nhiều từ thì phải chứa đủ (dùng lại `src/utils/tim-kiem.js`).
- `page`: bắt đầu từ 1, 9 mục/trang (`PER_PAGE`). Page vượt giới hạn thì **kẹp lại** về trang hợp lệ (như `utils/paginate.js`), không báo lỗi. Sắp xếp theo tên A→Z.
- `all=true`: trả toàn bộ (không phân trang). Dùng cho bàn tròn `/khach` và để đổ ô chọn đầu bếp/nguyên liệu ở form. `meta` chỉ có `total`.

```json
{
  "data": [ { "id": 1, "name": "Phở bò", "…": "…" } ],
  "meta": { "page": 1, "perPage": 9, "totalPages": 2, "total": 10 }
}
```

#### Tạo / sửa MÓN ĂN (`POST /api/dishes`, `PUT /api/dishes/:id`): `multipart/form-data`

| Trường | Giá trị | Ghi chú |
| --- | --- | --- |
| `name` | chuỗi | bắt buộc, 2–120 ký tự, không trùng (không phân biệt hoa/thường) |
| `description` | chuỗi | tối đa 1000, có thể rỗng |
| `price` | chuỗi số nguyên | bắt buộc, 1.000 – 100.000.000 |
| `category` | chuỗi | bắt buộc, thuộc `CATEGORIES` |
| `available` | `"true"` \| `"false"` | còn bán |
| `chefId` | chuỗi số | bắt buộc, đầu bếp phải tồn tại |
| `ingredientIds` | **lặp lại khóa** (`ingredientIds=1&ingredientIds=4`) hoặc không có | nguyên liệu phải tồn tại. `PUT` gửi danh sách **mới đầy đủ** (thay thế) |
| `image` | file JPG/PNG/WEBP ≤ 3MB | tùy chọn. `PUT` không gửi = **giữ ảnh cũ**. Lỗi ảnh → `400` với `details.image` |

Luật kiểm tra giữ nguyên `src/admin/resources.js` (các `parse`), chỉ đổi cách trả lỗi sang `details`.
`PUT` là thay thế toàn bộ các trường trên (frontend luôn gửi đủ).

#### Tạo / sửa ĐẦU BẾP và NGUYÊN LIỆU: JSON

```jsonc
// POST/PUT /api/chefs
{ "name": "Cô Lan", "specialty": "Phở, nước dùng" }     // name 2–120, specialty ≤ 120 (có thể rỗng)
// POST/PUT /api/ingredients
{ "name": "Thịt bò", "unit": "kg" }                       // name 2–60 không trùng, unit thuộc UNITS
```

#### Xóa

- Đầu bếp còn món: `409 CONFLICT`, `message` = `Không thể xóa: đầu bếp này đang phụ trách N món. Hãy đổi đầu bếp của các món đó trước.` (chính là `blockDelete` cũ).
- Xóa món: nhớ xóa ảnh trên Supabase Storage như cũ.
- Xóa nguyên liệu: bảng nối `dish_ingredients` tự xóa theo.

## 4. Đối chiếu code cũ → API mới

| Bản cũ (render EJS) | Bản mới (JSON) |
| --- | --- |
| `GET /` (xóa cookie role) | frontend gọi `POST /api/auth/logout` khi vào trang phố |
| `POST /login` → 303 | `POST /api/auth/login` → 200 JSON |
| `GET /khach` (nhúng `window.MON`) | `GET /api/dishes?all=true` |
| `GET /dishes?q=&page=` | `GET /api/dishes?q=&page=` |
| `GET /dishes/:id` | `GET /api/dishes/:id` |
| `GET /admin/:r` | `GET /api/:r?q=&page=` |
| `GET /admin/:r/new`, `/:id/edit` | không còn (form do frontend dựng); dữ liệu form lấy từ `/api/options`, `GET /api/:r/:id`, `GET /api/chefs?all=true`, `GET /api/ingredients?all=true` |
| `POST /admin/:r` → 303 | `POST /api/:r` → 201 |
| `PATCH /admin/:r/:id?_method` → 303 | `PUT /api/:r/:id` → 200 |
| `GET /admin/:r/:id/delete` (trang xác nhận) | frontend tự hỏi xác nhận; chặn xóa trả về từ `DELETE` (409) |
| `DELETE /admin/:r/:id` → 303 | `DELETE /api/:r/:id` → 204 |
| `res.render("error")` | JSON lỗi như mục 1 |
| `middleware/auth.js` redirect `/login`, render 403 | trả `401` / `403` JSON |

Các thứ **không cần nữa** ở backend: toàn bộ `src/views/*`, `routes/pages.js`, `utils/pho.js`, `utils/format.js` (icon/thumb), `method-override`, `ejs`, cờ `flash`/`?success=`.
Giữ nguyên: `models/`, `config/`, `utils/storage.js`, `utils/tim-kiem.js`, `utils/paginate.js`, `constants.js`, phần `parse` trong `admin/resources.js` (đổi giá trị trả về thành `details`).

## 5. Gợi ý khung Express

```js
// app.js (rút gọn)
app.use(express.json());
app.use(cookieParser());
app.use(attachRole);                         // đọc cookie role như cũ
app.use("/api", apiRouter);                  // /api/auth, /api/options, /api/dishes, /api/chefs, /api/ingredients

// /api/... không khớp route nào -> 404 JSON (đặt SAU apiRouter, TRƯỚC phần serve frontend)
app.use("/api", (req, res) =>
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Không tìm thấy API này." } }));

// middleware lỗi cuối cùng của /api
app.use("/api", (err, req, res, next) => {
  if (err.status && err.code) // lỗi tự ném: { status, code, message, details }
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Có lỗi xảy ra phía máy chủ." } });
});
```

Kiểm tra quyền (thay `requireAdmin` cũ): không có vai → ném 401, vai khác `admin` → ném 403.

## 6. CORS (chỉ cần khi frontend và backend khác origin)

Nếu backend serve luôn thư mục `frontend/` (khuyến nghị, mục 7) thì **cùng origin, không cần CORS**.
Nếu lúc dev chạy frontend ở cổng khác (vd. `http://localhost:5173`) và sửa `frontend/js/config.js` thành `API_BASE = "http://localhost:3000/api"`:

```js
app.use("/api", (req, res, next) => {
  res.set({
    "Access-Control-Allow-Origin": "http://localhost:5173",   // đúng origin của frontend, KHÔNG dùng *
    "Access-Control-Allow-Credentials": "true",                // để cookie role đi kèm (frontend dùng credentials: "include")
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  if (req.method === "OPTIONS") return res.sendStatus(204);    // preflight cho PUT/DELETE/JSON
  next();
});
```

Lưu ý: khác **site** (không chỉ khác cổng) thì cookie `role` phải đặt `sameSite: "none", secure: true` (cần HTTPS).

## 7. Serve frontend + routing phía client

Frontend dùng đường dẫn đẹp (`/admin/dishes/3/edit`...) do router phía trình duyệt xử lý. Vì thế server phải **trả `index.html` cho mọi đường dẫn không phải `/api` và không phải file tĩnh**, nếu không F5 hoặc gõ thẳng URL sẽ bị 404:

```js
const FRONT = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONT));                                   // /css /js /img
app.get("*", (req, res) => res.sendFile(path.join(FRONT, "index.html")));   // đặt CUỐI CÙNG, sau mọi /api
```

(Đổi `public/` cũ sang `frontend/`; trong `frontend/` đã có sẵn `img/`, `css/`, `js/`.)

## 8. Danh sách kiểm tra khi ghép

1. `/api/auth/me` đúng `role: null` khi chưa chọn vai, rồi `login` xong thì `me` trả đúng vai.
2. `GET /api/dishes?all=true` trả đủ món kèm `chef` và `ingredients`, `price` là **số**.
3. Tìm `q=pho` ra "Phở bò"; `page=999` kẹp về trang cuối; `/api/dishes/abc` → 404 JSON.
4. Chưa chọn vai gọi `GET /api/chefs` → 401; vai `user` → 403.
5. `POST /api/dishes` để trống → 400 với `details` đủ `name`, `price`, `category`, `chefId`.
6. Tạo trùng tên → 400 `details.name`; sửa không đổi tên của chính nó thì **không** báo trùng.
7. Upload ảnh > 3MB hoặc sai định dạng → 400 `details.image`; sửa món không gửi ảnh → ảnh cũ còn.
8. Xóa đầu bếp còn món → 409; xóa xong → 204 và danh sách không còn.
9. F5 ở `/admin/dishes/1/edit` vẫn mở được form (nhờ mục 7).
