/* Webapp ECO · lõi: gọi API, trạng thái, định tuyến, khung menu, tiện ích giao diện. */
'use strict';

const App = {
  state: null,
  token: null,
  ui: {},           // trạng thái tạm của từng trang (tab đang chọn, bộ lọc…)
  busy: 0,
  routes: {},
  handlers: {},
  navOpen: false,
  groups: {}
};
const H = App.handlers;

/* ---------- Lưu trữ cục bộ (an toàn khi bị chặn) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('eco-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('eco-' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem('eco-' + k); } catch (e) { } }
};

/* ---------- API ---------- */
async function api(fn, args) {
  const res = await fetch(ECO_CONFIG.API_URL, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn, token: App.token, args: args || {} })
  });
  let j;
  try { j = await res.json(); } catch (e) { throw new Error('Máy chủ không phản hồi đúng. Thử lại sau ít phút.'); }
  if (!j.ok) {
    if (j.auth) { logoutLocal(); throw new Error('Phiên đăng nhập đã hết. Đăng nhập lại nhé.'); }
    throw new Error(j.error || 'Có lỗi xảy ra.');
  }
  return j.data;
}

function setBusy(on) {
  App.busy += on ? 1 : -1;
  document.getElementById('busy').classList.toggle('hide', App.busy <= 0);
}

/** Gọi một thao tác; nếu kết quả là gói dữ liệu mới thì cập nhật và vẽ lại. */
async function act(fn, args, okMsg) {
  setBusy(true);
  try {
    const r = await api(fn, args);
    if (r && r.me) { setState(r); render(); }
    if (r && r._note) toast(r._note);
    else if (okMsg) toast(okMsg);
    return r;
  } catch (e) {
    toast(e.message, true);
    throw e;
  } finally { setBusy(false); }
}
async function call(fn, args) {
  setBusy(true);
  try { return await api(fn, args); } catch (e) { toast(e.message, true); throw e; } finally { setBusy(false); }
}

function setState(s) {
  App.state = s;
  App.idx = {
    m: Object.fromEntries(s.members.map(m => [m.id, m])),
    ev: Object.fromEntries(s.events.map(e => [e.id, e])),
    task: Object.fromEntries(s.tasks.map(t => [t.id, t])),
    sess: Object.fromEntries(s.events.flatMap(e => e.sessions.map(x => [x.id, Object.assign({ eventId: e.id }, x)])))
  };
  store.set('state', s);
}

function logoutLocal() {
  App.token = null; App.state = null;
  store.del('token'); store.del('state');
  location.hash = '#/';
  render();
}

/* ---------- Tiện ích ---------- */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const attr = esc;
function pT(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], (+m[4] || 0) - 7, +m[5] || 0, +m[6] || 0));
}
const tms = s => { const d = pT(s); return d ? d.getTime() : 0; };
const vn = d => new Date(d.getTime() + 7 * 3600e3);   // đọc các trường UTC như giờ VN
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const p2 = n => String(n).padStart(2, '0');
function fDT(s) { const d = pT(s); if (!d) return ''; const v = vn(d); return `${DOW[v.getUTCDay()]} ${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)} ${p2(v.getUTCHours())}:${p2(v.getUTCMinutes())}`; }
function fD(s) { const d = pT(s); if (!d) return s || ''; const v = vn(d); return `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`; }
function fDshort(s) { const d = pT(s); if (!d) return ''; const v = vn(d); return `${p2(v.getUTCDate())}/${p2(v.getUTCMonth() + 1)}`; }
function nowVN() { const v = vn(new Date()); return `${v.getUTCFullYear()}-${p2(v.getUTCMonth() + 1)}-${p2(v.getUTCDate())} ${p2(v.getUTCHours())}:${p2(v.getUTCMinutes())}`; }
function toInput(s) { return s ? String(s).slice(0, 16).replace(' ', 'T') : ''; }
function fromInput(v) { return v ? String(v).replace('T', ' ').slice(0, 16) : ''; }
function rel(s) {
  const diff = tms(s) - Date.now();
  const a = Math.abs(diff), h = Math.round(a / 3600e3), d = Math.round(a / 86400e3);
  const t = a < 3600e3 ? Math.max(1, Math.round(a / 60e3)) + ' phút' : a < 48 * 3600e3 ? h + ' giờ' : d + ' ngày';
  return diff >= 0 ? 'còn ' + t : 'quá ' + t;
}
const fmtN = (x, d = 2) => x == null ? '–' : (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('vi-VN');
const pct = x => x == null ? '–' : Math.round(x) + '%';
const roundHalf = x => Math.floor(x + 0.5 + 1e-9);
function bodau(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }

const ICONS = {
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'
};
const ic = (n, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

function initials(name) { const p = String(name || '?').trim().split(/\s+/); return esc((p.length > 1 ? p[p.length - 2][0] : '') + (p[p.length - 1] || '?')[0]).toUpperCase(); }
function avatar(m, cls) { m = m || {}; return `<span class="avatar ${cls || ''}">${m.avatar ? `<img src="${attr(m.avatar)}" alt="">` : initials(m.hoTen)}</span>`; }
function banLabel(m) {
  if (!m) return '';
  if (m.ban === 'BOD') return 'BOD' + (m.chucVu ? ' · ' + m.chucVu : '') + (m.mang ? ' · ' + m.mang : '');
  return 'Ban ' + m.ban + (m.mang ? ' · ' + m.mang : '');
}
const mName = id => (App.idx.m[id] || {}).hoTen || (id === 'ROOT' ? 'Quản trị gốc' : 'Người đã rời CLB');
const tag = (text, kind) => `<span class="eco-tag ${kind ? 'eco-tag--' + kind : ''}">${esc(text)}</span>`;
function progress(p) {
  const v = Math.max(0, Math.min(100, p || 0));
  return `<div class="eco-progress"><i style="width:${v}%"></i><b style="left:60%"><span>60%</span></b><b style="left:80%"><span>80%</span></b></div>`;
}
function banner(html, kind) { return `<div class="eco-banner ${kind === 'error' ? 'eco-banner--error' : ''}"><span class="bi">${kind === 'error' ? '✕' : 'i'}</span><div class="grow">${html}</div></div>`; }
const empty = t => `<div class="empty">${t}</div>`;

let toastTimer;
function toast(msg, err) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = 'toast hide', err ? 6000 : 3000);
}

/* ---------- Hộp thoại ---------- */
function modal(title, body, opts = {}) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'modal'; el.id = 'modal';
  el.innerHTML = `<div class="sheet ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="sheet-head"><h2>${esc(title)}</h2><button class="iconbtn" data-act="closeModal" aria-label="Đóng">${ic('x')}</button></div>${body}</div>`;
  el.addEventListener('click', e => { if (e.target === el) closeModal(); });
  document.body.appendChild(el);
  const f = el.querySelector('[autofocus]'); if (f) f.focus();
  return el;
}
function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }
H.closeModal = closeModal;
function confirmBox(title, text, okLabel, fn, danger) {
  modal(title, `<p>${text}</p><div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="cfOk">${esc(okLabel)}</button></div>`);
  document.getElementById('cfOk').onclick = async () => { closeModal(); await fn(); };
}

/* ---------- Vai trò ---------- */
const R = () => App.state.me.roles;
const isBod = () => R().bod;
const isNs = () => (R().ns || []).length > 0;

/* ---------- Định tuyến ---------- */
function route(path, def) { App.routes[path] = def; }
function parseHash() {
  const h = (location.hash || '#/').slice(2);
  const parts = h.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || '', params: parts.slice(1) };
}
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function homeRoute() { return isBod() ? 'tong-quan' : 'trang-chu'; }

/* ---------- Menu ---------- */
function menuDef() {
  const r = R(), s = App.state;
  const unread = s.notifications.filter(n => !n.daDoc).length;
  if (r.bod) {
    return [
      { href: 'tong-quan', t: 'Tổng quan' },
      { g: 'Sự kiện', items: [{ href: 'su-kien', t: 'Sự kiện' }, { href: 'diem-danh', t: 'Điểm danh' }] },
      { g: 'Task', items: [r.root ? null : { href: 'viec', t: 'Task của tôi' }, { href: 'task-ban', t: 'Task các ban' }].filter(Boolean) },
      { g: 'Điểm', items: [{ href: 'cong-diem', t: 'Cộng điểm' }, { href: 'xep-hang', t: 'Xếp hạng' }, { href: 'tong-ket', t: 'Tổng kết' }] },
      { g: 'Thành viên', items: [{ href: 'thanh-vien', t: 'Thành viên' }, { href: 'tai-sheet', t: 'Tải sheet' }, { href: 'hop-gop-y', t: 'Hộp góp ý' }] },
      { g: 'Mail', items: [{ href: 'duyet-thu', t: 'Duyệt thư UCV', badge: s.mailPending }, { href: 'gui-thu', t: 'Gửi thư tùy biến' }, { href: 'lich-gui', t: 'Lịch gửi' }, { href: 'danh-ba', t: 'Danh bạ' }, { ext: gmailUrl(), t: 'Mở Gmail CLB' }] },
      { g: 'Hệ thống', items: [{ href: 'cai-dat', t: 'Cài đặt' }, { href: 'nhat-ky', t: 'Nhật ký' }] }
    ];
  }
  const ql = [];
  if (r.ucv) ql.push({ href: 'hop-thu', t: 'Hộp thư CLB' }, { href: 'soan-thu', t: 'Soạn thư' }, { href: 'thu-cua-toi', t: 'Thư của tôi' });
  if ((r.ns || []).length) ql.push({ href: 'task-ban', t: 'Task các ban' }, { href: 'can-nhac', t: 'Danh sách cần nhắc' });
  if (r.seeding) ql.push({ href: 'seeding', t: 'Seeding' });
  const m = [
    { href: 'trang-chu', t: 'Trang chủ' }, { href: 'viec', t: 'Việc của tôi' }, { href: 'kpi', t: 'KPI của tôi' }, { href: 'xep-hang', t: 'Xếp hạng' },
    { g: 'CLB', items: [{ href: 'su-kien', t: 'Sự kiện' }, { href: 'gop-y', t: 'Góp ý' }, { href: 'anh-story', t: 'Ảnh story' }, { href: 'thong-bao', t: 'Thông báo', badge: unread }] }
  ];
  if (ql.length) m.push({ g: 'Quản lý', items: ql });
  return m;
}
function gmailUrl() { return 'https://mail.google.com/mail/u/?authuser=' + encodeURIComponent(App.state.ownerEmail || ''); }

function navHtml(cur) {
  const s = App.state, me = s.me;
  const unread = s.notifications.filter(n => !n.daDoc).length;
  const item = it => it.ext
    ? `<a class="nav-item" href="${attr(it.ext)}" target="_blank" rel="noopener">${esc(it.t)} ${ic('ext', 'sm')}</a>`
    : `<a class="nav-item ${it.href === cur ? 'is-active' : ''}" href="#/${it.href}">${esc(it.t)}${it.badge ? `<span class="eco-badge">${it.badge}</span>` : ''}</a>`;
  const body = menuDef().map(x => {
    if (!x.g) return item(x);
    const has = x.items.some(i => i.href === cur);
    const open = has || App.groups[x.g];
    return `<details class="nav-group" ${open ? 'open' : ''} data-group="${attr(x.g)}"><summary>${esc(x.g)}</summary>${x.items.map(item).join('')}</details>`;
  }).join('');
  return `<div class="nav-head"><a class="who" href="#/toi">${avatar(me)}<span class="grow"><b>${esc(me.hoTen)}</b><span class="small muted">${esc(me.roles.root ? 'Quản trị gốc' : banLabel(me))}</span></span></a>
    <a class="iconbtn" href="#/thong-bao" aria-label="Thông báo">${ic('bell')}${unread ? '<span class="dot"></span>' : ''}</a></div>
    ${body}
    <div class="nav-foot"><img src="assets/logo.png" alt=""><span class="small muted">CLB Môi trường ECO · ${esc(termLabel())}</span></div>`;
}
function termLabel() { const t = App.state.term; return 'NK ' + t.id.slice(0, 2) + '–' + t.id.slice(2) + ' · ' + (t.giaiDoan === '0' ? 'Giao thoa' : 'GĐ' + t.giaiDoan); }

/** Thanh tiêu đề: ☰ (trang chính) hoặc ‹ (trang con). */
function topbar(title, opts = {}) {
  const left = opts.back
    ? `<a class="iconbtn" href="${attr(opts.back)}" aria-label="Quay lại">${ic('back')}</a>`
    : `<button class="iconbtn menu-btn" data-act="openNav" aria-label="Mở menu">${ic('menu')}</button>`;
  const unread = App.state.notifications.filter(n => !n.daDoc).length;
  return `<div class="topbar">${left}<h1>${esc(title)}</h1>${opts.right || ''}${opts.noBell ? '' : `<a class="iconbtn" href="#/thong-bao" aria-label="Thông báo">${ic('bell')}${unread ? '<span class="dot"></span>' : ''}</a>`}</div>`;
}
H.openNav = () => { App.navOpen = true; document.querySelector('.nav').classList.add('open'); document.querySelector('.scrim').classList.remove('hide'); };
H.closeNav = () => { App.navOpen = false; const n = document.querySelector('.nav'); if (n) n.classList.remove('open'); const s = document.querySelector('.scrim'); if (s) s.classList.add('hide'); };

/* ---------- Vẽ ---------- */
function render() {
  const root = document.getElementById('app');
  applyTheme();
  if (!App.token || !App.state) { root.innerHTML = loginPage(); bindLogin(); return; }
  const { name, params } = parseHash();
  const rname = name || homeRoute();
  const def = App.routes[rname];
  let html;
  if (!def || (def.can && !def.can())) {
    html = topbar('Không tìm thấy') + empty('Trang này không có hoặc bạn không có quyền xem. <a href="#/">Về trang đầu</a>');
  } else {
    try { html = def.render(...params); } catch (e) { console.error(e); html = topbar('Lỗi') + banner('Trang gặp lỗi khi hiển thị: ' + esc(e.message), 'error'); }
  }
  document.body.classList.toggle('wide', !!(def && def.wide));
  const navCur = def && def.nav ? def.nav : rname;
  root.innerHTML = `<div class="shell"><nav class="nav ${App.navOpen ? 'open' : ''}" aria-label="Menu">${navHtml(navCur)}</nav><div class="scrim ${App.navOpen ? '' : 'hide'}" data-act="closeNav"></div><main class="main"><div class="page stack">${html}</div></main></div>`;
  root.querySelectorAll('details.nav-group').forEach(d => d.addEventListener('toggle', () => { App.groups[d.dataset.group] = d.open; }));
  if (def && def.after) def.after(...params);
}

function applyTheme() {
  const t = store.get('theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* Bấm vào phần tử có data-act → gọi H[tên](phần tử, sự kiện). */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) {
    const a = e.target.closest('a.nav-item, .nav-head a');
    if (a && App.navOpen) H.closeNav();
    return;
  }
  const f = H[el.dataset.act];
  if (f) { e.preventDefault(); f(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && H[el.dataset.change]) H[el.dataset.change](el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && H[el.dataset.input]) H[el.dataset.input](el, e);
});
window.addEventListener('hashchange', () => { App.navOpen = false; closeModal(); render(); window.scrollTo(0, 0); });

/** Đặt một khóa trạng thái của trang rồi vẽ lại. data-k="khóa" data-v="giá trị" */
H.set = el => { App.ui[el.dataset.k] = el.dataset.v; render(); };
H.toggle = el => { App.ui[el.dataset.k] = !App.ui[el.dataset.k]; render(); };
H.copy = el => {
  const text = el.dataset.text || document.getElementById(el.dataset.from).value;
  navigator.clipboard.writeText(text).then(() => toast('Đã chép.'), () => toast('Không chép được, hãy chọn và chép tay.', true));
};

/* ---------- Đăng nhập ---------- */
function loginPage() {
  if (App.needBoot) return bootPage();
  return `<div class="login-wrap"><div class="form form-narrow">
    <div class="stack tight" style="align-items:center;text-align:center"><img class="logo-big" src="assets/logo.png" alt="Logo ECO"><h1 style="font-size:20px">CLB Môi trường ECO</h1><p class="muted">Trần Đại Nghĩa · App nội bộ</p></div>
    <form class="eco-card form" id="loginForm">
      <div class="eco-field"><label for="lgEmail">Email</label><input class="eco-input" id="lgEmail" type="email" autocomplete="username" required placeholder="Email trong danh sách thành viên"></div>
      <div class="eco-field" id="lgPwF"><label for="lgPw">Mật khẩu</label><input class="eco-input" id="lgPw" type="password" autocomplete="current-password" required><span class="hint" id="lgErr"></span></div>
      <button class="eco-btn eco-btn--filled eco-btn--block" type="submit">Đăng nhập</button>
      <p class="small muted">Quên mật khẩu? Nhắn BOD để đặt lại.</p>
    </form></div></div>`;
}
function bindLogin() {
  const f = document.getElementById('loginForm');
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector('button'); btn.disabled = true;
    document.getElementById('lgErr').textContent = '';
    document.getElementById('lgPwF').classList.remove('is-error');
    setBusy(true);
    try {
      const r = await api('login', { email: document.getElementById('lgEmail').value, password: document.getElementById('lgPw').value });
      App.token = r.token; store.set('token', r.token);
      setState(r.state);
      location.hash = '#/';
      render();
      if (r.first || !store.get('a2hs')) setTimeout(showA2HS, 400);
    } catch (err) {
      document.getElementById('lgErr').textContent = err.message;
      document.getElementById('lgPwF').classList.add('is-error');
    } finally { btn.disabled = false; setBusy(false); }
  };
  const b = document.getElementById('bootForm');
  if (b) b.onsubmit = async e => {
    e.preventDefault();
    const p1 = document.getElementById('bRoot').value, p2v = document.getElementById('bRoot2').value;
    if (p1 !== p2v) { toast('Hai lần nhập mật khẩu quản trị chưa khớp.', true); return; }
    try {
      const r = await call('bootstrap', { code: document.getElementById('bCode').value, rootPassword: p1, defaultPassword: document.getElementById('bDef').value });
      App.needBoot = false;
      toast('Đã khởi tạo. Đăng nhập bằng ' + r.email);
      render();
      document.getElementById('lgEmail').value = r.email;
    } catch (err) { }
  };
}
function bootPage() {
  return `<div class="login-wrap"><form class="eco-card form form-narrow" id="bootForm">
    <div class="row"><img src="assets/logo.png" alt="" style="width:40px"><h1 style="font-size:20px">Khởi tạo app ECO</h1></div>
    <p class="muted">Làm một lần duy nhất. Tài khoản quản trị gốc là Gmail của CLB (chủ file dữ liệu).</p>
    <div class="eco-field"><label for="bCode">Mã khởi tạo</label><input class="eco-input" id="bCode" inputmode="numeric" required autocomplete="off"><span class="hint">6 chữ số, hiện trong nhật ký thực thi khi chạy hàm setup bằng Gmail CLB.</span></div>
    <div class="eco-field"><label for="bRoot">Mật khẩu quản trị gốc</label><input class="eco-input" id="bRoot" type="password" minlength="8" required autocomplete="new-password"><span class="hint">Ít nhất 8 ký tự. Chỉ người giữ Gmail CLB biết.</span></div>
    <div class="eco-field"><label for="bRoot2">Nhập lại</label><input class="eco-input" id="bRoot2" type="password" minlength="8" required autocomplete="new-password"></div>
    <div class="eco-field"><label for="bDef">Mật khẩu mặc định cho tài khoản thành viên</label><input class="eco-input" id="bDef" type="password" minlength="4" required autocomplete="off"><span class="hint">Mọi tài khoản tạo khi tải sheet dùng mật khẩu này. Đổi được trong Cài đặt.</span></div>
    <button class="eco-btn eco-btn--filled eco-btn--block" type="submit">Khởi tạo</button></form></div>`;
}

/* Hướng dẫn "Thêm vào màn hình chính" (AUTH-05) */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
function showA2HS(tab) {
  tab = tab || (/iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'android');
  const steps = tab === 'ios'
    ? ['Mở app bằng <b>Safari</b>.', 'Bấm nút <b>Chia sẻ</b> (hình vuông có mũi tên lên) ở thanh dưới.', 'Chọn <b>Thêm vào MH chính</b> rồi bấm <b>Thêm</b>.']
    : ['Mở app bằng <b>Chrome</b>.', 'Bấm <b>⋮</b> ở góc trên bên phải.', 'Chọn <b>Thêm vào màn hình chính</b> hoặc <b>Cài đặt ứng dụng</b>.'];
  modal('Thêm ECO vào màn hình chính', `
    <div class="seg"><button class="${tab === 'android' ? 'is-active' : ''}" data-act="a2hsTab" data-v="android">Android</button><button class="${tab === 'ios' ? 'is-active' : ''}" data-act="a2hsTab" data-v="ios">iPhone</button></div>
    <ol class="stack tight" style="margin:0;padding-left:20px">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
    ${tab === 'ios' ? banner('Trên iPhone, phải thêm vào màn hình chính thì sau này mới nhận được thông báo.') : (deferredPrompt ? '<button class="eco-btn eco-btn--filled" data-act="a2hsInstall">Cài ứng dụng</button>' : '')}
    <div class="actions"><button class="eco-btn" data-act="a2hsDone">Để sau</button><button class="eco-btn eco-btn--filled" data-act="a2hsDone" data-v="1">Đã thêm xong</button></div>`);
}
H.a2hsTab = el => showA2HS(el.dataset.v);
H.a2hsInstall = async () => { if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; closeModal(); } };
H.a2hsDone = el => { store.set('a2hs', 1); closeModal(); };

/* ---------- Khởi động ---------- */
async function boot() {
  App.token = store.get('token', null);
  const cached = store.get('state', null);
  if (App.token && cached) { setState(cached); render(); }
  else render();
  if (App.token) {
    try { const s = await api('state'); setState(s); render(); }
    catch (e) { if (!App.token) render(); else toast(e.message, true); }
  } else {
    try { const b = await api('bootInfo'); if (!b.ready) { App.needBoot = true; render(); } } catch (e) { }
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
}
/* Làm mới dữ liệu khi quay lại app. */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && App.token && !document.getElementById('modal')) {
    try {
      const s = await api('state'); setState(s);
      const def = App.routes[parseHash().name];
      if (!(def && def.keep) && !document.activeElement.matches('input, textarea, select, [contenteditable]')) render();
    } catch (e) { }
  }
});
