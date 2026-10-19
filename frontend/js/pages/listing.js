// Danh sách dạng lưới + khung chi tiết bên phải. Dùng cho:
//   /dishes            khách xem và tìm món (chỉ đọc)
//   /admin/:resource   quản trị: thêm / sửa / xóa
// Dữ liệu: GET /api/<resource>?q=...&page=...  ->  { data: [...], meta: { page, totalPages, total } }
// Tìm kiếm và phân trang do BACKEND làm, frontend chỉ gửi q và page rồi vẽ kết quả.
import { api } from "../api.js";
import { getRole } from "../state.js";
import { navigate } from "../router.js";
import { RES, adminTabs, giaDong } from "../resources.js";
import { $, $$, esc, dishThumb, thanhTren, timKiem, phanTrang, nhoAnhLoi } from "../utils.js";

const the = (d) => `<span class="the ${d.available ? "ok" : "het"}">${d.available ? "Còn bán" : "Hết món"}</span>`;
const dauBepStr = (c) => (c ? c.name + (c.specialty ? " (" + c.specialty + ")" : "") : "—");

// ---------- ô trên lưới ----------
function oCongKhai(d, i, href, chon) {
  return `<a class="o${chon ? " chon" : ""}" data-id="${d.id}" href="${esc(href)}" title="Bấm để xem chi tiết">
    <span class="bieu">${dishThumb(d, i < 6, i < 3)}</span>
    <b>${esc(d.name)}</b>
    <small>${giaDong(d.price)} · ${esc(d.category)}</small>
    <small>${d.chef ? "Đầu bếp " + esc(d.chef.name) : ""}</small>
    ${the(d)}
  </a>`;
}
function oQuanTri(r, row, i, href, chon) {
  const t = r.tile(row, i);
  return `<a class="o${chon ? " chon" : ""}" data-id="${row.id}" href="${esc(href)}" title="Bấm để xem chi tiết">
    <span class="bieu">${t.icon}</span><b>${esc(t.title)}</b><small>${esc(t.sub)}</small>
  </a>`;
}

// ---------- khung chi tiết ----------
function panelCongKhai(d, chon) {
  return `<section class="ct hop" data-id="${d.id}"${chon ? "" : " hidden"}>
    <button type="button" class="dong-ct" data-a="dong" aria-label="Đóng">×</button>
    <div class="ct-xem">
      <div class="ct-dau"><span class="bieu">${dishThumb(d)}</span><h2>${esc(d.name)}</h2></div>
      <dl class="ct-ds">
        <dt>Giá</dt><dd>${giaDong(d.price)}</dd>
        <dt>Mô tả</dt><dd>${esc(d.description || "—")}</dd>
        <dt>Danh mục</dt><dd>${esc(d.category || "—")}</dd>
        <dt>Tình trạng</dt><dd>${the(d)}</dd>
        <dt>Đầu bếp</dt><dd>${esc(dauBepStr(d.chef))}</dd>
      </dl>
    </div>
  </section>`;
}
function panelQuanTri(r, row, chon) {
  const t = r.tile(row);
  return `<section class="ct hop" data-id="${row.id}"${chon ? "" : " hidden"}>
    <button type="button" class="dong-ct" data-a="dong" aria-label="Đóng">×</button>
    <div class="ct-xem">
      <div class="ct-dau"><span class="bieu">${t.icon}</span><h2>${esc(r.label(row))}</h2></div>
      <dl class="ct-ds">
        ${r.columns.slice(1).map((c) => `<dt>${esc(c.label)}</dt><dd>${esc(c.value(row))}</dd>`).join("")}
      </dl>
      <div class="nut-hang ct-thao-tac">
        <a class="nut nut-phu" href="/admin/${r.key}/${row.id}/delete">Xóa</a>
        <a class="nut" href="/admin/${r.key}/${row.id}/edit">Sửa</a>
      </div>
    </div>
  </section>`;
}

// admin = true: /admin/:resource ; false: /dishes
export async function load(ctx, resKey, admin) {
  const r = RES[resKey];
  const q = (ctx.query.get("q") || "").trim();
  const [res, role] = await Promise.all([
    api.list(resKey, { q, page: ctx.query.get("page") || 1 }),
    getRole(),
  ]);
  const rows = res.data;
  const { page, totalPages } = res.meta;
  const selId = Number(ctx.query.get("sel"));
  const sel = rows.some((x) => x.id === selId) ? selId : null;
  // link giữ từ khóa tìm kiếm khi sang trang / chọn mục
  const lk = (extra) => "?" + new URLSearchParams(Object.assign(q ? { q } : {}, extra)).toString();
  const action = admin ? "/admin/" + resKey : "/dishes";

  const thanh = admin
    ? thanhTren({ tabs: adminTabs(resKey), themHref: `/admin/${resKey}/new`, themLabel: "+ Thêm " + r.singular, role })
    : thanhTren({ themHref: "/khach", themLabel: "Bàn chọn món", role });
  const placeholder = admin ? `Tìm theo tên ${r.singular}...` : "Tìm theo tên món...";
  const trong = admin
    ? q ? `Không có ${r.singular} nào khớp với "${esc(q)}".` : `Chưa có ${r.singular} nào. Bấm “Thêm” để tạo mới.`
    : `Không có món nào${q ? ` khớp với "${esc(q)}"` : ""}.`;

  const grid = rows.length
    ? `<div class="luoi">${rows
        .map((row, i) => {
          const href = lk({ page, sel: row.id });
          return admin ? oQuanTri(r, row, i, href, row.id === sel) : oCongKhai(row, i, href, row.id === sel);
        })
        .join("")}</div>`
    : `<p class="trong-lop">${trong}</p>`;

  return {
    title: admin ? "Quản trị " + r.title : "Danh sách món ăn",
    am: admin ? "bep" : "quan",
    html: `<div class="nen"></div><div class="mo"></div>
<main class="man bep cuon">
  ${thanh}
  <div class="chia${sel ? " co-chon" : ""}" id="chia">
    <div class="cot-luoi">
      <div class="dau-khach">
        ${admin ? "" : "<h2>Danh sách món ăn</h2>"}
        ${timKiem({ action, q, placeholder })}
      </div>
      ${grid}
      ${phanTrang({ page, totalPages, lk })}
    </div>
    <aside class="chi-tiet" aria-label="Chi tiết">
      ${rows.map((row) => (admin ? panelQuanTri(r, row, row.id === sel) : panelCongKhai(row, row.id === sel))).join("")}
    </aside>
  </div>
</main>`,
    mount: (root, c) => mount(root, c, { q, page, action }),
  };
}

function mount(root, ctx, { q, page, action }) {
  const { signal } = ctx;
  const chia = $("#chia", root);
  nhoAnhLoi(root, signal);

  // ghi ?sel= lên thanh địa chỉ mà không tải lại / không thêm lịch sử
  const ghiSel = (id) => {
    const u = new URL(location.href);
    if (id) u.searchParams.set("sel", id);
    else u.searchParams.delete("sel");
    history.replaceState(null, "", u);
  };

  // bấm một ô -> mở khung chi tiết của ô đó (không đổi màn hình)
  chia.addEventListener("click", (e) => {
    const o = e.target.closest(".o");
    if (o && chia.contains(o)) {
      e.preventDefault();
      const id = o.dataset.id;
      $$(".o", chia).forEach((x) => x.classList.toggle("chon", x === o));
      $$(".ct", chia).forEach((s) => (s.hidden = s.dataset.id !== id));
      chia.classList.add("co-chon");
      ghiSel(id);
      return;
    }
    // nút đóng (×) của khung chi tiết
    if (e.target.closest('[data-a="dong"]')) {
      chia.classList.remove("co-chon");
      $$(".o.chon", chia).forEach((x) => x.classList.remove("chon"));
      // chờ khung thu lại xong mới ẩn nội dung cho mượt
      setTimeout(() => {
        if (chia.classList.contains("co-chon")) return;
        $$(".ct", chia).forEach((s) => (s.hidden = true));
      }, 600);
      ghiSel(null);
    }
  }, { signal });

  // tìm kiếm: gửi q lên API qua router (về trang 1)
  $("[data-tim]", root).addEventListener("submit", (e) => {
    e.preventDefault();
    const v = new FormData(e.target).get("q").trim();
    navigate(action + (v ? "?" + new URLSearchParams({ q: v }) : ""));
  }, { signal });
}
