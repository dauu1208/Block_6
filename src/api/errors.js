// ===== QUY ĐỊNH MÃ LỖI (error.code) CHO REST API =====
// Mọi lỗi của /api đều có CÙNG MỘT hình dạng (xem response.js):
//   { success:false, error:{ type, code, message, details?, requestId } }
//
// error.type tách rõ 2 nhóm để KHÔNG gom lỗi hạ tầng vào lỗi nghiệp vụ:
//   "business"       lỗi do dữ liệu/yêu cầu/quyền của người dùng (4xx)  -> client hiện message cho người dùng
//   "infrastructure" lỗi do hệ thống (DB sập, bug server) (5xx)         -> client chỉ báo chung "thử lại sau"
const BUSINESS = "business";
const INFRA = "infrastructure";

// code -> { status, type, message mặc định }
const ERRORS = {
  // ---- nghiệp vụ ----
  VALIDATION_ERROR: { status: 400, type: BUSINESS, message: "Dữ liệu gửi lên không hợp lệ." },
  INVALID_JSON: { status: 400, type: BUSINESS, message: "Nội dung gửi lên không phải JSON hợp lệ." },
  INVALID_ID: { status: 404, type: BUSINESS, message: "ID phải là số nguyên dương." },
  INVALID_QUERY: { status: 400, type: BUSINESS, message: "Tham số truy vấn không hợp lệ." },
  BAD_REQUEST: { status: 400, type: BUSINESS, message: "Yêu cầu không hợp lệ." },
  UNAUTHORIZED: { status: 401, type: BUSINESS, message: "Bạn cần đăng nhập để thực hiện thao tác này." },
  FORBIDDEN: { status: 403, type: BUSINESS, message: "Bạn không có quyền thực hiện thao tác này (cần role admin)." },
  CORS_NOT_ALLOWED: { status: 403, type: BUSINESS, message: "Nguồn (origin) này không được phép gọi API." },
  ROUTE_NOT_FOUND: { status: 404, type: BUSINESS, message: "Không tìm thấy đường dẫn API này." },
  DISH_NOT_FOUND: { status: 404, type: BUSINESS, message: "Không tìm thấy món ăn." },
  CHEF_NOT_FOUND: { status: 404, type: BUSINESS, message: "Không tìm thấy đầu bếp." },
  INGREDIENT_NOT_FOUND: { status: 404, type: BUSINESS, message: "Không tìm thấy nguyên liệu." },
  DUPLICATE_NAME: { status: 409, type: BUSINESS, message: "Dữ liệu bị trùng với bản ghi đã có." },
  RESOURCE_IN_USE: { status: 409, type: BUSINESS, message: "Bản ghi đang được dùng ở nơi khác nên không thể xóa." },
  RELATION_CONFLICT: { status: 409, type: BUSINESS, message: "Thao tác vi phạm ràng buộc dữ liệu liên quan." },
  PAYLOAD_TOO_LARGE: { status: 413, type: BUSINESS, message: "Nội dung gửi lên quá lớn." },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, type: BUSINESS, message: "Content-Type phải là application/json." },
  // ---- hạ tầng ----
  DB_UNAVAILABLE: { status: 503, type: INFRA, message: "Hệ thống tạm thời không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau." },
  INTERNAL_ERROR: { status: 500, type: INFRA, message: "Có lỗi xảy ra phía máy chủ. Vui lòng thử lại sau." },
};

// Lỗi chủ động ném ra từ route: throw new ApiError("DISH_NOT_FOUND")
class ApiError extends Error {
  constructor(code, { message, details } = {}) {
    const def = ERRORS[code] || ERRORS.INTERNAL_ERROR;
    super(message || def.message);
    this.name = "ApiError";
    this.code = ERRORS[code] ? code : "INTERNAL_ERROR";
    this.status = def.status;
    this.type = def.type;
    this.details = details;
  }
}

module.exports = { ERRORS, ApiError, BUSINESS, INFRA };
