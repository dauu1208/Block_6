// ===== MỘT CÁCH TRẢ VỀ DUY NHẤT CHO MỌI ENDPOINT /api =====
// Thành công: { success:true, data, meta? }
// Thất bại  : { success:false, error:{ type, code, message, details?, requestId } }

function ok(res, data, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function fail(res, { status, type, code, message, details }) {
  const error = { type, code, message };
  if (details && Object.keys(details).length) error.details = details;
  error.requestId = res.req.requestId;
  return res.status(status).json({ success: false, error });
}

module.exports = { ok, fail };
