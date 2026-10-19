// Mọi lời gọi REST API đi qua file này. Các trang chỉ gọi api.xxx(), không tự fetch.
// Quy ước (xem API.md):
//   - thành công: JSON { data, meta? } hoặc 204 không có nội dung
//   - lỗi: JSON { error: { code, message, details? } } cùng mã HTTP phù hợp
import { API_BASE } from "./config.js";

export class ApiError extends Error {
  constructor(status, body) {
    const e = (body && body.error) || {};
    super(e.message || "Có lỗi xảy ra, vui lòng thử lại.");
    this.status = status; // 0 = không kết nối được máy chủ
    this.code = e.code || (status === 0 ? "NETWORK_ERROR" : "UNKNOWN");
    this.details = e.details || {}; // { tênTrường: "thông báo lỗi" }
  }
}

async function request(method, path, { query, json, form } = {}) {
  let url = API_BASE + path;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, v);
    });
    if ([...qs].length) url += "?" + qs;
  }
  const opts = {
    method,
    headers: { Accept: "application/json" },
    credentials: "include", // gửi cookie role kể cả khi API khác origin
  };
  if (json !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(json);
  } else if (form) {
    opts.body = form; // FormData: trình duyệt tự đặt Content-Type + boundary
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new ApiError(0, {
      error: { message: "Không kết nối được máy chủ. Kiểm tra mạng hoặc thử lại sau." },
    });
  }
  if (res.status === 204) return null;
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    /* phản hồi không phải JSON */
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

// Món ăn gửi bằng multipart/form-data (có thể kèm ảnh); đầu bếp / nguyên liệu gửi JSON
function dishForm(v) {
  const fd = new FormData();
  fd.set("name", v.name);
  fd.set("description", v.description);
  fd.set("price", v.price);
  fd.set("category", v.category);
  fd.set("available", v.available ? "true" : "false");
  fd.set("chefId", v.chefId);
  v.ingredientIds.forEach((id) => fd.append("ingredientIds", id));
  if (v.image) fd.set("image", v.image);
  return fd;
}

export const api = {
  // ----- xác thực (chọn vai, không mật khẩu) -----
  me: () => request("GET", "/auth/me").then((r) => r.data.role),
  login: (role) => request("POST", "/auth/login", { json: { role } }).then((r) => r.data.role),
  logout: () => request("POST", "/auth/logout"),

  // ----- dữ liệu dùng chung -----
  options: () => request("GET", "/options").then((r) => r.data), // { categories, units, limits }

  // ----- CRUD: resource = dishes | chefs | ingredients -----
  // params: { q, page } hoặc { all: true } (lấy hết, không phân trang). Trả { data, meta }
  list: (resource, params) => request("GET", `/${resource}`, { query: params }),
  get: (resource, id) => request("GET", `/${resource}/${id}`).then((r) => r.data),
  create: (resource, values) =>
    resource === "dishes"
      ? request("POST", "/dishes", { form: dishForm(values) }).then((r) => r.data)
      : request("POST", `/${resource}`, { json: values }).then((r) => r.data),
  update: (resource, id, values) =>
    resource === "dishes"
      ? request("PUT", `/dishes/${id}`, { form: dishForm(values) }).then((r) => r.data)
      : request("PUT", `/${resource}/${id}`, { json: values }).then((r) => r.data),
  remove: (resource, id) => request("DELETE", `/${resource}/${id}`),
};
