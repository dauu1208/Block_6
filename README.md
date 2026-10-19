# CÁI QUÁN ĂN

**Website quản lý và giới thiệu món ăn** được xây dựng bằng Node.js, Express, EJS, Sequelize và PostgreSQL trên Supabase. Dự án kết hợp giao diện khám phá quán ăn mang phong cách con phố Việt Nam với hệ thống quản trị dữ liệu món ăn, đầu bếp và nguyên liệu.

Các trang được render ở phía máy chủ (Server-Side Rendering – SSR) bằng EJS. Dữ liệu chính được lưu trong cơ sở dữ liệu PostgreSQL, thay vì chỉ khai báo trực tiếp trên giao diện.

## 0. Đã chuyển giao diện sang SPA + REST API

Giao diện được viết lại thành **Single-Page Application** trong thư mục `frontend/` (HTML/CSS/JavaScript thuần, ES modules, không cần build). Trình duyệt chỉ tải `index.html` một lần, router phía client (`frontend/js/router.js`) đổi màn hình bằng History API và lấy dữ liệu qua **REST API** (`/api/...`) bằng `fetch`.

- Hợp đồng giữa frontend và backend (endpoint, định dạng JSON, mã lỗi, CORS, routing): xem **[API.md](API.md)**.
- **Backend và frontend đã được ghép**: Express + Sequelize trả JSON ở `/api` (xem mục 9) và phục vụ luôn thư mục `frontend/`, nên cùng một origin, không cần CORS. Các thư mục `src/views`, `public/` và các route SSR cũ đã được bỏ.
- Chạy: `npm install`, tạo `.env` từ `.env.example`, (tùy chọn) `npm run db:seed`, rồi `npm start` và mở <http://localhost:3000>.
- (Chỉ để tham khảo) chạy thử frontend không cần DB: `npm install` rồi `npm run mock`, mở <http://localhost:3000>. Mock server giả lập đúng `API.md` với dữ liệu trong bộ nhớ (vào quán chọn vai **Đầu bếp** để thử khu quản trị).

```text
frontend/
├── index.html            # trang HTML duy nhất
├── css/  img/            # giao diện và hình ảnh (chuyển từ public/)
└── js/
    ├── main.js           # khai báo route
    ├── router.js         # router phía client (History API, chặn vai, màn hình lỗi)
    ├── api.js            # mọi lời gọi REST API + lỗi ApiError
    ├── config.js         # API_BASE
    ├── state.js          # vai hiện tại
    ├── effects.js        # hiệu ứng chuyển cảnh (cành cây, đĩa trắng)
    ├── resources.js      # cấu hình cột / ô nhập của món, đầu bếp, nguyên liệu
    ├── pho.js            # sinh con phố ngẫu nhiên (trước đây ở server)
    ├── utils.js  am-thanh.js
    └── pages/            # home, login, khach, listing (danh sách), dish-detail, admin-form, admin-delete, error
mock-server/server.js     # backend giả để chạy thử
```

## 1. Công nghệ sử dụng

- **Node.js, Express.js:** xây dựng máy chủ và định tuyến.
- **EJS:** tạo giao diện HTML được render từ phía máy chủ.
- **Sequelize:** ánh xạ và thao tác với cơ sở dữ liệu thông qua mô hình (ORM).
- **PostgreSQL / Supabase:** lưu trữ dữ liệu món ăn, đầu bếp và nguyên liệu.
- **HTML, CSS, JavaScript:** xây dựng giao diện và các tương tác phía trình duyệt.
- **Web Audio API:** tạo hiệu ứng âm thanh trực tiếp trên trình duyệt.
- **Sharp:** hỗ trợ xử lý, tối ưu hình ảnh qua script của dự án.

## 2. Chức năng chính

### Giao diện khách hàng

- Khám phá con phố lấy ý tưởng từ Phố cổ Hội An (Việt Nam) và truy cập khu vực quán ăn.
- Xem danh sách món ăn lấy từ cơ sở dữ liệu.
- Tìm kiếm món theo tên.
- Mở trang chi tiết để xem thông tin món ăn.
- Xem các món trên giao diện bàn tròn và thao tác với món còn phục vụ.
- Thêm món vào hàng chờ đặt món tạm thời trên trình duyệt.

### Đăng nhập và phân quyền

- Chọn vai trò **Khách hàng** hoặc **Quản trị / Đầu bếp** tại trang đăng nhập.
- Khách hàng truy cập giao diện dành cho khách.
- Quản trị viên được phép truy cập khu vực quản lý dữ liệu.
- Các đường dẫn quản trị được kiểm tra quyền truy cập ở phía máy chủ.

> Lưu ý: phiên bản hiện tại dùng cơ chế chọn vai trò, chưa triển khai xác thực bằng mật khẩu hoặc tài khoản cá nhân.

### Quản trị dữ liệu

Quản trị viên có thể thực hiện các thao tác CRUD (thêm, xem danh sách, chỉnh sửa và xóa) đối với:

- **Món ăn:** tên, mô tả, giá, danh mục, trạng thái phục vụ, đầu bếp và nguyên liệu liên quan.
- **Đầu bếp:** tên và chuyên môn.
- **Nguyên liệu:** tên và đơn vị tính.

Khu vực quản trị sử dụng biểu mẫu được render từ máy chủ, có kiểm tra dữ liệu đầu vào, thông báo lỗi và phân trang danh sách.

## 3. Cài đặt và chạy dự án

### Yêu cầu

- Node.js và npm.
- Một cơ sở dữ liệu PostgreSQL; dự án được cấu hình để kết nối với Supabase.
- Chuỗi kết nối cơ sở dữ liệu hợp lệ.

### Bước 1: Cài đặt thư viện

Mở terminal tại thư mục dự án và chạy:

```bash
npm install
```

### Bước 2: Cấu hình biến môi trường

Sao chép `.env.example` thành `.env`, sau đó cập nhật thông tin kết nối:

```env
DATABASE_URL=postgresql://YOUR_CONNECTION_STRING
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Thay `DATABASE_URL` bằng chuỗi kết nối PostgreSQL thực tế trong phần **Project Settings → Database** của Supabase. Dự án khuyến nghị sử dụng **Session pooler, cổng 5432**.

Không đưa file `.env` hoặc khóa bí mật lên kho mã nguồn công khai.

### Bước 3: Khởi tạo dữ liệu mẫu (tùy chọn)

```bash
npm run db:seed
```

Lệnh này tạo lại cấu trúc bảng theo script seed và nạp dữ liệu mẫu. **Script seed có thể xóa dữ liệu hiện có**, vì vậy chỉ chạy khi phù hợp với môi trường dữ liệu của bạn.

### Bước 4: Khởi động máy chủ

Chạy chế độ thông thường:

```bash
npm start
```

Hoặc chạy chế độ phát triển tự khởi động lại khi mã nguồn thay đổi:

```bash
npm run dev
```

Mở trình duyệt tại: <http://localhost:3000>

Nếu đã đổi giá trị `PORT` trong `.env`, hãy truy cập cổng tương ứng.

## 4. Các trang và đường dẫn

| Chức năng           | Phương thức và đường dẫn    | Mô tả                                                     |
| ------------------- | --------------------------- | --------------------------------------------------------- |
| Trang chủ           | `GET /`                     | Giao diện con phố Ba Cô Gái.                              |
| Giao diện khách     | `GET /khach`                | Bàn tròn hiển thị các món ăn từ cơ sở dữ liệu.            |
| Danh sách món       | `GET /dishes?q=`            | Hiển thị và tìm kiếm món ăn theo từ khóa.                 |
| Chi tiết món        | `GET /dishes/:id`           | Xem thông tin của một món; trả về 404 nếu không tìm thấy. |
| Đăng nhập           | `GET /login`, `POST /login` | Chọn vai trò sử dụng hệ thống.                            |
| Đăng xuất           | `POST /logout`              | Kết thúc phiên hiện tại.                                  |
| Quản lý món ăn      | `/admin/dishes`             | Danh sách và các thao tác quản trị món ăn.                |
| Quản lý đầu bếp     | `/admin/chefs`              | Danh sách và các thao tác quản trị đầu bếp.               |
| Quản lý nguyên liệu | `/admin/ingredients`        | Danh sách và các thao tác quản trị nguyên liệu.           |

Trong mỗi khu vực quản trị, các thao tác gồm xem danh sách, mở biểu mẫu thêm mới, tạo bản ghi, mở biểu mẫu chỉnh sửa, cập nhật và xác nhận xóa. Danh sách hỗ trợ phân trang bằng tham số `?page=`.

## 5. Cấu trúc thư mục

```text
Block-5-main/
├── public/
│   ├── css/style.css          # Giao diện và hiệu ứng CSS
│   ├── img/                   # Hình ảnh giao diện
│   └── js/                    # JavaScript phía trình duyệt
├── scripts/
│   └── seed.js                # Tạo bảng và dữ liệu mẫu
├── src/
│   ├── admin/resources.js     # Cấu hình trường dữ liệu quản trị
│   ├── config/database.js     # Kết nối PostgreSQL
│   ├── middleware/auth.js     # Kiểm tra quyền truy cập
│   ├── models/                # Các mô hình và quan hệ dữ liệu
│   ├── api/                   # Mã lỗi, định dạng phản hồi, CORS, xử lý lỗi cho REST API
│   ├── routes/                # api.js = REST API
│   ├── utils/                 # Hàm hỗ trợ dùng chung
│   ├── views/                 # Giao diện EJS
│   ├── app.js                 # Cấu hình Express
│   └── server.js              # Khởi tạo kết nối và máy chủ
├── .env.example               # Mẫu biến môi trường
├── package.json
└── README.md
```

## 6. Âm thanh và tương tác

Âm thanh được tạo bằng Web Audio API trong `public/js/am-thanh.js`, không cần tải sẵn các tệp MP3. Tùy trang, hiệu ứng có thể bao gồm tiếng chim, xe cộ, chén đĩa, dao thớt và âm thanh khi thao tác với giao diện.

- Nút loa ở góc dưới bên trái dùng để bật hoặc tắt âm thanh.
- Trạng thái bật/tắt được lưu trong `localStorage` của trình duyệt.
- Trình duyệt chỉ cho phép phát âm thanh sau khi người dùng tương tác lần đầu.

## 7. Một số giới hạn của phiên bản hiện tại

- Đăng nhập chỉ là chọn vai trò, chưa có xác thực bằng mật khẩu hoặc tài khoản cá nhân.
- Hàng chờ / thao tác đặt món ở giao diện khách chỉ lưu tạm trên trình duyệt; chưa có bảng đơn hàng trong cơ sở dữ liệu.
- Dữ liệu đầu bếp hiện chỉ gồm tên và chuyên môn.
- Dữ liệu nguyên liệu không có số lượng định mức theo từng món; giao diện hiển thị tên và đơn vị tính.
- Biểu tượng món ăn được chọn theo tên hoặc danh mục bằng logic trong mã nguồn, không phải ảnh riêng cho từng món.
- Các thao tác quản trị được xử lý bằng biểu mẫu và điều hướng phía máy chủ, không dùng fetch/AJAX cho CRUD.

## 8. Lệnh npm

| Lệnh              | Công dụng                                                |
| ----------------- | -------------------------------------------------------- |
| `npm install`     | Cài đặt các thư viện cần thiết.                          |
| `npm start`       | Khởi động máy chủ.                                       |
| `npm run dev`     | Chạy máy chủ với nodemon trong quá trình phát triển.     |
| `npm run db:seed` | Khởi tạo bảng và nạp dữ liệu mẫu; có thể xóa dữ liệu cũ. |

## 9. Backend REST API (`/api`)

Endpoint, mô hình dữ liệu và danh sách kiểm tra đầy đủ: xem **[API.md](API.md)** (backend làm đúng hợp đồng này). Mục này tóm tắt các quy ước chính và phần riêng của backend.

### Định dạng phản hồi

| Tình huống            | HTTP        | Body                                                                         |
| --------------------- | ----------- | ---------------------------------------------------------------------------- |
| Thành công            | `200`       | `{ "ok": true, "data": ..., "meta"?: ... }` (`meta` chỉ có ở danh sách)      |
| Xóa thành công        | `200`       | `{ "ok": true, "data": null }`                                               |
| Lỗi nghiệp vụ đã biết | `200`       | `{ "ok": false, "error": { "code", "message", "fields"? } }`                 |
| Lỗi kỹ thuật          | `4xx / 5xx` | `{ "error": { "code", "message", "requestId" } }` — **không có** trường `ok` |

Frontend kiểm tra ba tầng (có response không → HTTP status → `ok` true/false) rồi xử lý theo `error.code`, không so sánh nội dung `message`.

### Mã lỗi (`src/api/errors.js`)

- **Lỗi nghiệp vụ (HTTP 200, `ok: false`):** `NOT_FOUND`, `VALIDATION_FAILED` (kèm `fields` theo từng ô nhập), `ALREADY_EXISTS`, `RESOURCE_IN_USE`, `RELATION_CONFLICT`.
- **Lỗi kỹ thuật (đúng mã HTTP):**

| HTTP      | `code`                                        |
| --------- | --------------------------------------------- |
| 400       | `INVALID_JSON`, `BAD_REQUEST`                 |
| 401       | `UNAUTHORIZED` (chưa chọn vai)                |
| 403       | `FORBIDDEN` (vai `user`), `CORS_NOT_ALLOWED`  |
| 404       | `ROUTE_NOT_FOUND` (sai URL `/api/...`)        |
| 413 / 415 | `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` |
| 500       | `DB_UNAVAILABLE`, `INTERNAL_ERROR`            |

### Endpoint chính

| Phương thức | Đường dẫn                                       | Quyền     |
| ----------- | ----------------------------------------------- | --------- |
| GET         | `/api/auth/me`, `/api/options`                  | công khai |
| POST        | `/api/auth/login`, `/api/auth/logout`           | công khai |
| GET         | `/api/dishes`, `/api/dishes/:id`                | công khai |
| GET         | `/api/chefs`, `/api/ingredients` (+ `/:id`)     | admin     |
| POST        | `/api/dishes`, `/api/chefs`, `/api/ingredients` | admin     |
| PATCH       | `/api/:resource/:id`                            | admin     |
| DELETE      | `/api/:resource/:id`                            | admin     |

- Sửa dùng **PATCH** (không có PUT): trường không gửi thì giữ nguyên, nhưng mọi trường vẫn được validate lại.
- Thêm/sửa **món ăn** dùng `multipart/form-data` (có ảnh JPG/PNG/WEBP ≤ 3MB); đầu bếp và nguyên liệu dùng JSON.
- Danh sách: `?q=` (tìm theo tên, không phân biệt hoa/thường và dấu tiếng Việt), `?page=` (9 mục/trang, sắp xếp A→Z) hoặc `?all=true` (không phân trang, `meta` chỉ có `total`).
- Danh sách rỗng hoặc tìm không thấy → `200` với `data: []`; id không có (kể cả sai kiểu như `abc`) → `200` `ok: false` `NOT_FOUND`.
- Phân quyền kiểm tra **trước** khi đọc dữ liệu: không có vai → `401`, vai `user` → `403`. `GET` không bao giờ ghi dữ liệu.

### Phần bổ sung của backend

- Lỗi 5xx chỉ trả câu chung; chuỗi kết nối DB, SQL và stack trace chỉ nằm trong log kèm `requestId` (cũng gửi qua header `X-Request-Id`). Không kết nối được DB → `500 DB_UNAVAILABLE`.
- Thêm/sửa món (kèm nguyên liệu) chạy trong transaction; phản hồi chỉ gửi sau khi mọi thao tác bất đồng bộ hoàn tất. Chỉ các trường đã khai báo mới được ghi vào DB.
- `price` luôn trả về kiểu số.
- Vai (`role`) được lưu trong cookie, đọc ở `src/middleware/auth.js`.
- `GET /healthz` (ngoài `/api`, không đụng DB) dùng cho dịch vụ ping giữ máy chủ không "ngủ"; `GET /api/health` kiểm tra kết nối DB.
- **CORS** (chỉ cần khi SPA ở origin khác API): đặt `CORS_ORIGIN` trong `.env` (nhiều origin cách nhau bằng dấu phẩy); origin lạ bị `403 CORS_NOT_ALLOWED`; preflight `OPTIONS` trả `204`. Bỏ trống thì chỉ cho các origin dev thông dụng (`localhost:3000/5173/4200/5500`). Nên dùng origin cụ thể thay vì `*`.
- **Routing phía client:** server trả `index.html` cho mọi đường dẫn GET không phải `/api` và không có đuôi file, nên Reload ở `/dishes/2` hay `/admin/dishes/3/edit` vẫn đúng trang.

Các file backend: `src/app.js`, `src/routes/api.js`, `src/api/` (`errors.js`, `response.js`, `middleware.js`, `serializers.js`).
