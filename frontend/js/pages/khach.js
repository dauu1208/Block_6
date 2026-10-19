// Bàn tròn chọn món: dữ liệu lấy từ GET /api/dishes?all=true
import { api } from "../api.js";
import { $, bao, esc, hop, vnd, dishIcon } from "../utils.js";

// Hàng chờ chỉ lưu tạm trong bộ nhớ của trình duyệt (DB chưa có bảng đơn hàng).
// Để ngoài hàm nên đi sang trang khác rồi quay lại vẫn còn.
const hang = new Map(); // id món -> { m, sl, cho }

export async function load() {
  const { data } = await api.list("dishes", { all: true });
  // chỉ giữ những trường cần để vẽ vòng món
  const mon = data.map((d) => ({
    id: d.id,
    ten: d.name,
    gia: Number(d.price),
    icon: dishIcon(d),
    anh: d.imageUrl || "", // URL ảnh (rỗng = dùng emoji)
    moTa: d.description || "",
    loai: d.category,
    conBan: d.available,
    dauBep: d.chef ? d.chef.name : "",
    nguyenLieu: (d.ingredients || []).map((i) => ({ ten: i.name, donVi: i.unit })),
  }));

  const bui = Array.from({ length: 16 }, () =>
    `<i class="bui" style="--x:${Math.floor(Math.random() * 90)}%;--y:${Math.floor(Math.random() * 85)}%;--s:${2 + Math.floor(Math.random() * 4)}px;--t:${6 + Math.floor(Math.random() * 6)}s;--dl:-${Math.floor(Math.random() * 10)}s"></i>`).join("");
  const tia = [[4, 7], [20, 10], [38, 6], [56, 9]]
    .map((t, k) => `<i class="tia" style="--l:${t[0]}%;--w:${t[1]}vw;--dl:-${k * 2}s"></i>`).join("");

  return {
    title: "Quán Ba Cô Gái - Thực đơn",
    am: "khach",
    html: `<main class="man khach vao-tu-duoi">
  <div class="goc">
    <a class="nut nut-phu" href="/">Ra phố</a>
    <span class="goc-phai">
      <a class="nut nut-phu" href="/dishes">Danh sách &amp; tìm món</a>
      <button class="nut" id="nut-hang">Hàng chờ (0)</button>
    </span>
  </div>
  ${
    !mon.length
      ? `<div class="trong"><div class="hop"><h2>Quán chưa có món</h2><p>Đầu bếp chưa thêm món nào vào thực đơn.</p></div></div>`
      : `<div class="ban"><div class="ghe-vong">${[-50, -25, 0, 25, 50].map((a) => `<i class="ghe" style="transform:rotate(${a}deg) translateY(-99vh)"></i>`).join("")}</div><div class="mat"><div class="vong" id="vong">
    ${mon.map((x, i) => `<button class="mon" data-i="${i}"><span class="dia">${x.anh ? `<img class="anh-dia" src="${esc(x.anh)}" alt="${esc(x.ten)}" loading="${i < 3 ? "eager" : "lazy"}" decoding="async">` : `<em>${x.icon}</em>`}</span><b>${esc(x.ten)}</b></button>`).join("")}
  </div></div></div>`
  }
  <div class="nang" aria-hidden="true">${tia}${bui}</div>
  ${mon.length > 1 ? `<button class="nut mui-ten trai" id="trai" aria-label="Món trước">‹</button><button class="nut mui-ten phai" id="phai" aria-label="Món sau">›</button>` : ""}
</main>`,
    mount: (root, ctx) => mount(root, ctx, mon),
  };
}

function mount(root, ctx, MON) {
  const { signal } = ctx;
  const N = MON.length;
  const nutHang = $("#nut-hang", root);
  const capNhat = () =>
    (nutHang.textContent = `Hàng chờ (${[...hang.values()].reduce((s, c) => s + c.sl, 0)})`);
  capNhat();
  if (!N) return; // chưa có món nào trong DB

  const STEP = 360 / N,
    R = 64; // R: bán kính vòng món (vh)
  const vong = $("#vong", root),
    mons = [...vong.querySelectorAll(".mon")];
  let idx = 0;

  function cap() {
    const rg = -idx * STEP;
    vong.style.transform = `rotate(${rg}deg)`;
    mons.forEach((el, i) => {
      el.style.transform = `rotate(${i * STEP}deg) translateY(-${R}vh) rotate(${-(rg + i * STEP)}deg) translate(-50%,-50%)`;
      let d = Math.abs((((i - idx) % N) + N) % N);
      d = Math.min(d, N - d);
      el.className = "mon d" + Math.min(d, 2) + (MON[i].conBan ? "" : " het");
    });
  }
  const xoay = (k) => {
    if (N < 2) return;
    idx += k;
    cap();
    Am.phat("xoay");
  };
  const trai = $("#trai", root), phai = $("#phai", root);
  if (trai) trai.onclick = () => xoay(-1);
  if (phai) phai.onclick = () => xoay(1);
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") xoay(-1);
    if (e.key === "ArrowRight") xoay(1);
  }, { signal });

  vong.addEventListener("click", (e) => {
    const el = e.target.closest(".mon");
    if (!el) return;
    const i = +el.dataset.i,
      d = (((i - idx) % N) + N) % N;
    if (d === 0) moMon(MON[i]);
    else xoay(d <= N / 2 ? d : d - N); // bấm món bên cạnh -> xoay tới món đó
  }, { signal });

  function moMon(m) {
    const cho = Math.floor(Math.random() * 4) + 2; // 2-5 phút
    const nl = m.nguyenLieu.map((n) => esc(n.ten)).join(", ");
    const nut = m.conBan
      ? `<button class="nut nut-phu" data-a="hang">Thêm vào giỏ hàng</button><button class="nut" data-a="ngay">Đặt ngay</button>`
      : `<button class="nut" data-a="dong">Đóng</button>`;
    const h = hop(`<div class="anh-mon to">${m.anh ? `<img src="${esc(m.anh)}" alt="${esc(m.ten)}">` : esc(m.icon)}</div><h2>${esc(m.ten)}</h2>
      <p class="gia">${vnd(m.gia)}</p>
      ${m.moTa ? `<p>${esc(m.moTa)}</p>` : ""}
      <p class="phu-chu-nho">${esc(m.loai)}${m.dauBep ? " · Đầu bếp " + esc(m.dauBep) : ""}</p>
      ${nl ? `<p class="phu-chu-nho">Nguyên liệu: ${nl}</p>` : ""}
      ${m.conBan ? `<p>Dự kiến chờ khoảng <b>${cho} phút</b></p>` : `<p><b>Món này hiện đã hết.</b></p>`}
      <div class="nut-hang hang-mon"><a class="nut nut-phu" href="/dishes/${m.id}">Chi tiết</a>${nut}</div>`);
    h.el.addEventListener("click", (e) => {
      const a = e.target.dataset.a;
      if (a === "dong") h.dong();
      if (a === "ngay") {
        Am.phat("ding");
        bao(`Đã gửi món ${m.ten}, chờ khoảng ${cho} phút`);
        h.dong();
      }
      if (a === "hang") {
        const c = hang.get(m.id) || { m, sl: 0, cho };
        c.sl++;
        c.cho = Math.max(c.cho, cho);
        hang.set(m.id, c);
        capNhat();
        Am.phat("them");
        bao(`Đã thêm ${m.ten} vào hàng chờ`);
        h.dong();
      }
    });
  }

  nutHang.onclick = () => {
    const ds = [...hang.values()];
    if (!ds.length) return bao("Hàng chờ đang trống");
    const tong = ds.reduce((s, c) => s + c.sl * c.m.gia, 0);
    const h = hop(`<h2>Hàng chờ</h2>${ds.map((c) => `<div class="dong-hang"><span>${esc(c.m.ten)} × ${c.sl}</span><span>${vnd(c.sl * c.m.gia)}</span><button class="xoa-nl" data-x="${c.m.id}" aria-label="Bỏ món">×</button></div>`).join("")}
      <p class="gia" style="margin-top:12px">Tổng: ${vnd(tong)}</p>
      <div class="nut-hang"><button class="nut nut-phu" data-a="dong">Đóng</button><button class="nut" data-a="dat">Đặt tất cả</button></div>`);
    h.el.addEventListener("click", (e) => {
      if (e.target.dataset.x) {
        hang.delete(+e.target.dataset.x);
        capNhat();
        h.dong();
        nutHang.click();
      }
      if (e.target.dataset.a === "dong") h.dong();
      if (e.target.dataset.a === "dat") {
        Am.phat("ding");
        bao(`Đã gửi ${ds.length} món, món lâu nhất khoảng ${Math.max(...ds.map((c) => c.cho))} phút`);
        hang.clear();
        capNhat();
        h.dong();
      }
    });
  };
  cap();
}
