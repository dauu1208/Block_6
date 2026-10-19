// Chi tiết một món: GET /api/dishes/:id  (id sai / không có -> API trả 404 -> router hiện màn hình 404)
import { api } from "../api.js";
import { getRole } from "../state.js";
import { giaDong } from "../resources.js";
import { esc, dishThumb, thanhTren, nhoAnhLoi } from "../utils.js";

export async function load(ctx) {
  const [d, role] = await Promise.all([api.get("dishes", ctx.params.id), getRole()]);
  return {
    title: d.name,
    am: "quan",
    html: `<div class="nen"></div><div class="mo"></div>
<main class="man bep cuon">
  ${thanhTren({ themHref: "/dishes", themLabel: "← Danh sách món", role })}
  <section class="hop hop-giua rong">
    <div class="ct-dau"><span class="bieu">${dishThumb(d, true, true)}</span><h2>${esc(d.name)}</h2></div>
    <dl class="ct-ds">
      <dt>Giá</dt><dd>${giaDong(d.price)}</dd>
      <dt>Mô tả</dt><dd>${esc(d.description || "—")}</dd>
      <dt>Danh mục</dt><dd>${esc(d.category || "—")}</dd>
      <dt>Tình trạng</dt><dd><span class="the ${d.available ? "ok" : "het"}">${d.available ? "Còn bán" : "Hết món"}</span></dd>
      <dt>Đầu bếp</dt><dd>${esc(d.chef ? d.chef.name + (d.chef.specialty ? " (" + d.chef.specialty + ")" : "") : "—")}</dd>
    </dl>
    <div class="nut-hang"><a class="nut nut-phu" href="/dishes">Danh sách món</a><a class="nut" href="/khach">Chọn món ở bàn</a></div>
  </section>
</main>`,
    mount: (root, c) => nhoAnhLoi(root, c.signal),
  };
}
