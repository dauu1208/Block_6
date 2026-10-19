// Trang xác nhận xóa. Bấm "Xóa luôn" mới gọi DELETE /api/<resource>/:id
//   204 = đã xóa | 409 = không được xóa (vd. đầu bếp còn phụ trách món), message do backend viết sẵn
import { api, ApiError } from "../api.js";
import { setRole } from "../state.js";
import { navigate } from "../router.js";
import { RES, adminTabs } from "../resources.js";
import { $, esc, thanhTren } from "../utils.js";

export async function load(ctx, resKey) {
  const r = RES[resKey];
  const id = ctx.params.id;
  const record = await api.get(resKey, id); // 404 nếu không có -> màn hình 404
  const quayLai = `/admin/${resKey}?sel=${record.id}`;
  return {
    title: "Xóa " + r.singular,
    am: "bep",
    html: `<div class="nen"></div><div class="mo"></div>
<main class="man bep cuon">
  ${thanhTren({ tabs: adminTabs(resKey), role: "admin" })}
  <div class="hop hop-giua rong" id="khung">
    <h2>Xác nhận xóa ${esc(r.singular)}</h2>
    <div class="bao-loi" id="loi" hidden></div>
    <div id="hoi">
      <p>Bạn có chắc chắn muốn xóa ${esc(r.singular)} <b>${esc(r.label(record))}</b> không?</p>
      <p class="phu-chu-nho">Hành động này không thể hoàn tác.</p>
      <div class="nut-hang">
        <a class="nut nut-phu" href="${quayLai}">Không xóa</a>
        <button class="nut" id="xoa">Xóa luôn</button>
      </div>
    </div>
    <div class="nut-hang" id="quay" hidden><a class="nut" href="${quayLai}">Quay lại</a></div>
  </div>
</main>`,
    mount(root, c) {
      const nut = $("#xoa", root), loi = $("#loi", root);
      nut.addEventListener("click", async () => {
        nut.disabled = true;
        loi.hidden = true;
        try {
          await api.remove(resKey, id);
          navigate("/admin/" + resKey, { flash: "Xóa thành công." });
        } catch (err) {
          if (!(err instanceof ApiError)) throw err;
          if (err.status === 401) {
            setRole(null);
            return navigate("/login");
          }
          if (err.status === 404) return navigate("/admin/" + resKey, { flash: "Mục này đã bị xóa trước đó." });
          loi.textContent = err.message;
          loi.hidden = false;
          if (err.status === 409) {
            // bị chặn xóa: bỏ câu hỏi và nút xóa, chỉ còn nút quay lại
            $("#hoi", root).hidden = true;
            $("#quay", root).hidden = false;
          } else nut.disabled = false;
        }
      }, { signal: c.signal });
    },
  };
}
