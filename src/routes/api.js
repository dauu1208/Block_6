// ===== REST API (JSON) =====  gắn tại /api, khớp hợp đồng trong API.md
//   GET    /api/health
//   GET    /api/auth/me | POST /api/auth/login {role} | POST /api/auth/logout (204)
//   GET    /api/options                      công khai: categories, units, limits
//   GET    /api/dishes[/:id]                 công khai   ?q=&page= | ?all=true
//   GET    /api/chefs[/:id], /api/ingredients[/:id]   chỉ admin
//   POST   /api/:resource                    admin -> 201 (+ Location). Món ăn: multipart (có ảnh); còn lại: JSON
//   PUT    /api/:resource/:id                admin -> 200 (thay toàn bộ; món ăn không gửi ảnh = giữ ảnh cũ)
//   DELETE /api/:resource/:id                admin -> 204 (bị chặn -> 409)
// Hình dạng phản hồi + mã lỗi: src/api/response.js, src/api/errors.js
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const resources = require("../admin/resources");
const { ROLES } = require("../middleware/auth");
const { sequelize } = require("../models");
const { CATEGORIES, UNITS, LIMITS } = require("../constants");
const { parseId, asyncHandler } = require("../utils/format");
const { khop } = require("../utils/tim-kiem");
const { PER_PAGE } = require("../utils/paginate");
const { uploadImage, removeImage, EXT } = require("../utils/storage");
const { ApiError } = require("../api/errors");
const { ok } = require("../api/response");
const { requestId, cors, requireAdminApi, apiNotFound, apiErrorHandler } = require("../api/middleware");
const serialize = require("../api/serializers");

const router = express.Router();

router.use(requestId);
router.use(cors);
router.use(express.json({ limit: "100kb" }));

const NOT_FOUND = { dishes: "DISH_NOT_FOUND", chefs: "CHEF_NOT_FOUND", ingredients: "INGREDIENT_NOT_FOUND" };
const SERIALIZER = { dishes: serialize.dish, chefs: serialize.chef, ingredients: serialize.ingredient };
const byName = (a, b) => a.name.localeCompare(b.name, "vi");

// ---------------------------------------------------------------- health
router.get(
  "/health",
  asyncHandler(async (req, res) => {
    try {
      await sequelize.authenticate();
    } catch (e) {
      console.error(`[api ${req.requestId}] health: DB không phản hồi`, e);
      throw new ApiError("DB_UNAVAILABLE");
    }
    ok(res, { status: "ok", database: "up" });
  }),
);

// ---------------------------------------------------------------- auth (chọn vai, cookie role)
router.get("/auth/me", (req, res) => ok(res, { role: req.role }));
router.post("/auth/login", (req, res, next) => {
  const role = req.body && req.body.role;
  if (!ROLES.includes(role)) {
    return next(
      new ApiError("VALIDATION_ERROR", {
        message: "Vui lòng chọn role hợp lệ (user hoặc admin).",
        details: { role: "Role không hợp lệ" },
      }),
    );
  }
  res.cookie("role", role, { httpOnly: true, sameSite: "lax" });
  ok(res, { role });
});
router.post("/auth/logout", (req, res) => {
  res.clearCookie("role");
  res.status(204).end();
});

// ---------------------------------------------------------------- dữ liệu dùng chung cho form
router.get("/options", (req, res) => ok(res, { categories: CATEGORIES, units: UNITS, limits: LIMITS }));

// ---------------------------------------------------------------- upload ảnh (chỉ món ăn)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXT[file.mimetype]) req.loiAnh = "Chỉ nhận ảnh JPG, PNG hoặc WEBP";
    cb(null, !!EXT[file.mimetype]);
  },
});
// lỗi ảnh không làm sập request mà đưa vào details.image
const nhanAnh = (req, res, next) => {
  if (!req.is("multipart/form-data")) return next();
  upload.single("image")(req, res, (err) => {
    if (err)
      req.loiAnh = err.code === "LIMIT_FILE_SIZE" ? "Ảnh tối đa 3MB" : "Không đọc được ảnh, vui lòng thử lại";
    next();
  });
};

// ---------------------------------------------------------------- helpers
function getId(req) {
  const id = parseId(req.params.id);
  if (!id) throw new ApiError("INVALID_ID");
  return id;
}

// Ép body (JSON hoặc multipart) về dạng "form" mà r.parse() dùng chung với bản cũ đang hiểu,
// đồng thời báo lỗi kiểu dữ liệu sai theo từng trường.
function toForm(r, body) {
  const form = {};
  const typeErrors = {};
  for (const f of r.fields) {
    if (f.type === "image" || !(f.name in body)) continue;
    const v = body[f.name];
    if (f.type === "checkbox") {
      if (v === true || v === "true" || v === "on") form[f.name] = "on";
      else if (!(v === false || v === "false")) typeErrors[f.name] = "Phải là true hoặc false";
    } else if (f.type === "multiselect") {
      const arr = Array.isArray(v) ? v : v === undefined || v === "" ? [] : [v]; // multipart: 1 giá trị = chuỗi
      if (arr.some((x) => typeof x !== "number" && typeof x !== "string")) typeErrors[f.name] = "Phải là một mảng id";
      else form[f.name] = arr.map(String);
    } else if (v === null) {
      form[f.name] = "";
    } else if (typeof v === "string" || typeof v === "number") {
      form[f.name] = String(v);
    } else {
      typeErrors[f.name] = "Giá trị không hợp lệ (cần chuỗi hoặc số)";
    }
  }
  return { form, typeErrors };
}

// kiểm tra file ảnh đọc được thật sự (đúng mimetype nhưng file hỏng -> 400 details.image thay vì 500)
async function checkImage(file) {
  try {
    await sharp(file.buffer).metadata();
    return null;
  } catch (e) {
    return "Không đọc được ảnh, vui lòng chọn file ảnh khác";
  }
}

function loadOne(r, id, options = {}) {
  return r.model.findByPk(id, { include: r.include, ...options });
}

// ---------------------------------------------------------------- CRUD cho từng resource
Object.values(resources).forEach((r) => {
  const base = `/${r.key}`;
  const toJson = SERIALIZER[r.key];
  const isDishes = r.key === "dishes";
  // món ăn: ai cũng đọc được; đầu bếp, nguyên liệu và mọi thao tác ghi: chỉ admin (kiểm tra TRƯỚC khi đọc dữ liệu)
  const readGuard = isDishes ? [] : [requireAdminApi];

  // ----- danh sách: ?q=&page= | ?all=true. Không có dữ liệu -> 200 + mảng rỗng (KHÔNG trả 404)
  router.get(
    base,
    ...readGuard,
    asyncHandler(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const details = {};
      let category = null;
      let available = null;
      if (isDishes) {
        if (req.query.category !== undefined) {
          category = String(req.query.category);
          if (!CATEGORIES.includes(category))
            details.category = `category phải là một trong: ${CATEGORIES.join(", ")}`;
        }
        if (req.query.available !== undefined) {
          if (!["true", "false"].includes(req.query.available)) details.available = "available phải là true hoặc false";
          else available = req.query.available === "true";
        }
      }
      if (Object.keys(details).length) throw new ApiError("INVALID_QUERY", { details });

      // Query 1 (nhẹ): lọc theo tên (không phân biệt hoa/thường và dấu) rồi sắp xếp A→Z
      const attrs = isDishes ? ["id", "name", "category", "available"] : ["id", "name"];
      const slim = (await r.model.findAll({ attributes: attrs }))
        .filter((x) => khop(x.name, q))
        .filter((x) => category === null || x.category === category)
        .filter((x) => available === null || x.available === available)
        .sort(byName);
      const total = slim.length;

      let pageIds = slim.map((x) => x.id);
      let meta = { total };
      if (req.query.all !== "true") {
        const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
        const asked = parseInt(req.query.page, 10);
        // page vượt giới hạn thì kẹp lại về trang hợp lệ, không báo lỗi
        const page = Math.min(Math.max(Number.isInteger(asked) ? asked : 1, 1), totalPages);
        pageIds = pageIds.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        meta = { page, perPage: PER_PAGE, totalPages, total };
      }

      // Query 2: nạp đầy đủ (kèm quan hệ) chỉ cho các bản ghi cần trả, giữ đúng thứ tự đã sắp xếp
      const rows = pageIds.length ? await r.model.findAll({ where: { id: pageIds }, include: r.include }) : [];
      const pos = new Map(pageIds.map((id, i) => [id, i]));
      rows.sort((a, b) => pos.get(a.id) - pos.get(b.id));
      ok(res, rows.map(toJson), { meta });
    }),
  );

  // ----- chi tiết: id sai định dạng hoặc không có -> 404
  router.get(
    `${base}/:id`,
    ...readGuard,
    asyncHandler(async (req, res) => {
      const record = await loadOne(r, getId(req));
      if (!record) throw new ApiError(NOT_FOUND[r.key]);
      ok(res, toJson(record));
    }),
  );

  // ----- đọc + kiểm tra dữ liệu gửi lên (dùng chung cho POST và PUT)
  async function readInput(req, record) {
    const { form, typeErrors } = toForm(r, req.body || {});
    const { errors, data } = await r.parse(form, record);
    const all = { ...errors, ...typeErrors };
    if (isDishes) {
      if (req.loiAnh) all.image = req.loiAnh;
      else if (req.file) {
        const bad = await checkImage(req.file);
        if (bad) all.image = bad;
      }
    }
    if (Object.keys(all).length) throw new ApiError("VALIDATION_ERROR", { message: "Dữ liệu chưa hợp lệ.", details: all });
    return data;
  }

  // ----- thêm mới
  router.post(
    base,
    requireAdminApi,
    isDishes ? nhanAnh : (req, res, next) => next(),
    asyncHandler(async (req, res) => {
      if (!isDishes && !req.is("application/json")) throw new ApiError("UNSUPPORTED_MEDIA_TYPE");
      const data = await readInput(req, null);
      let img = null;
      if (isDishes && req.file) {
        img = await uploadImage(req.file);
        data.imageUrl = img.url;
        data.imagePath = img.path;
      }
      try {
        // transaction: tạo món + gán nguyên liệu là MỘT khối, lỗi giữa chừng thì hoàn tác cả hai
        const created = await sequelize.transaction(async (t) => {
          const rec = await r.model.create(data, { transaction: t });
          if (isDishes) await rec.setIngredients(data.ingredientIds, { transaction: t });
          return loadOne(r, rec.id, { transaction: t });
        });
        res.location(`/api${base}/${created.id}`);
        ok(res, toJson(created), { status: 201 });
      } catch (e) {
        if (img) removeImage(img.path).catch(() => {}); // lưu DB lỗi thì dọn ảnh vừa tải lên
        throw e;
      }
    }),
  );

  // ----- sửa (thay toàn bộ)
  router.put(
    `${base}/:id`,
    requireAdminApi,
    isDishes ? nhanAnh : (req, res, next) => next(),
    asyncHandler(async (req, res) => {
      if (!isDishes && !req.is("application/json")) throw new ApiError("UNSUPPORTED_MEDIA_TYPE");
      const id = getId(req);
      const record = await loadOne(r, id);
      if (!record) throw new ApiError(NOT_FOUND[r.key]);
      const data = await readInput(req, record);

      const oldPath = record.imagePath;
      let img = null;
      if (isDishes && req.file) {
        img = await uploadImage(req.file); // không gửi ảnh = data không có imageUrl -> giữ ảnh cũ
        data.imageUrl = img.url;
        data.imagePath = img.path;
      }
      let updated;
      try {
        updated = await sequelize.transaction(async (t) => {
          await record.update(data, { transaction: t });
          if (isDishes) await record.setIngredients(data.ingredientIds, { transaction: t });
          return loadOne(r, id, { transaction: t });
        });
      } catch (e) {
        if (img) removeImage(img.path).catch(() => {});
        throw e;
      }
      if (img && oldPath) removeImage(oldPath).catch(() => {}); // lưu DB xong mới xóa ảnh cũ
      ok(res, toJson(updated));
    }),
  );

  // ----- xóa -> 204
  router.delete(
    `${base}/:id`,
    requireAdminApi,
    asyncHandler(async (req, res) => {
      const id = getId(req);
      const record = await loadOne(r, id);
      if (!record) throw new ApiError(NOT_FOUND[r.key]);
      const reason = r.blockDelete ? await r.blockDelete(record) : null;
      if (reason) throw new ApiError("RESOURCE_IN_USE", { message: reason });

      const imagePath = record.imagePath;
      await sequelize.transaction((t) => record.destroy({ transaction: t }));
      // dữ liệu đã xóa xong; dọn ảnh chỉ là việc phụ, lỗi ở đây không được làm hỏng phản hồi
      if (r.hasImage && imagePath) {
        try {
          await removeImage(imagePath);
        } catch (e) {
          console.error(`[api ${req.requestId}] không xóa được ảnh ${imagePath}:`, e.message);
        }
      }
      res.status(204).end();
    }),
  );
});

router.use(apiNotFound);
router.use(apiErrorHandler);

module.exports = router;
