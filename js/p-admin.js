/* Quản trị (BOD): thành viên, tải sheet, cài đặt, nhật ký và lưu trữ. */
'use strict';

/* ================= P-52 Thành viên (+ P-41 chi tiết) ================= */
route('thanh-vien', {
  can: () => isBod(), wide: true,
  render(id) {
    if (id) return memberDetail(id);
    const s = App.state, ui = App.ui;
    const q = bodau(ui.tvQ || '');
    const khois = [...new Set(s.members.map(m => m.khoi).filter(Boolean))].sort();
    const list = s.members.filter(m => (!q || bodau(m.hoTen + ' ' + m.tenFb + ' ' + m.email).includes(q))
      && (!ui.tvBan || m.ban === ui.tvBan) && (!ui.tvKhoi || m.khoi === ui.tvKhoi) && (!ui.tvLoai || m.loai === ui.tvLoai)
      && (!ui.tvNhan || (ui.tvNhan === 'ucv' ? m.ucv === 'co' : ui.tvNhan === 'core' ? m.core === 'co' : ui.tvNhan === 'ns' ? m.nsBan || m.nsSeeding === 'co' : !m.daVao)));
    const sel = (k, label, opts) => `<select class="eco-input sm" style="width:auto" data-change="tqSet" data-k="${k}"><option value="">${label}</option>${opts.map(([v, l]) => `<option value="${v}" ${ui[k] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    let html = topbar('Thành viên', { right: `<button class="eco-btn eco-btn--sm" data-act="tplSheet">Sheet mẫu</button>` });
    const byBan = s.settings.coCau.map(b => `${b.ma} ${s.members.filter(m => m.ban === b.ma).length}`).join(' · ');
    html += `<p class="small muted">${s.members.length} người · ${byBan} · ${s.members.filter(m => m.loai === 'bo-sung').length} bổ sung · ${s.members.filter(m => !m.daVao).length} chưa vào app</p>`;
    html += `<div class="row"><input class="eco-input sm" style="max-width:260px" placeholder="Tìm tên, email…" value="${attr(ui.tvQ || '')}" data-change="tqSet" data-k="tvQ">${sel('tvBan', 'Mọi ban', s.settings.coCau.map(b => [b.ma, b.ma]))}${sel('tvKhoi', 'Mọi khối', khois.map(k => [k, 'Khối ' + k]))}${sel('tvLoai', 'Mọi nhóm', [['chinh-thuc', 'Chính thức'], ['bo-sung', 'Bổ sung']])}${sel('tvNhan', 'Mọi nhãn', [['ucv', 'UCV'], ['core', 'Core team'], ['ns', 'Nhân sự phụ trách'], ['chua', 'Chưa vào app']])}</div>`;
    html += `<section class="eco-card" style="padding:4px 16px"><div class="tablewrap"><table class="eco-table"><thead><tr><th>Thành viên</th><th class="dk">Lớp</th><th class="dk">Nhóm · đợt</th><th>Nhãn</th><th class="dk">Vào app</th></tr></thead><tbody>${sortMembers(list).map(m => `<tr class="click" data-act="goMember" data-id="${m.id}"><td><div class="row nowrap">${avatar(m, 'sm')}<div class="grow"><div class="ellipsis">${esc(m.hoTen)}</div><div class="small muted">${esc(banLabel(m))}</div></div></div></td><td class="dk">${esc(m.lop || '')}</td><td class="dk">${m.ban === 'BOD' ? 'BOD' : m.loai === 'bo-sung' ? 'Bổ sung' : 'Chính thức'} · ${esc(m.dot || '')}</td><td>${[m.ucv === 'co' ? 'UCV' : '', m.core === 'co' ? 'Core' : '', m.nsBan ? 'NS ' + m.nsBan : '', m.nsSeeding === 'co' ? 'Seeding' : ''].filter(Boolean).map(x => tag(x)).join(' ')}</td><td class="dk">${m.daVao ? '✓' : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
    html += `<p class="small muted">Thông tin lấy từ sheet thành viên. Muốn sửa thì sửa sheet rồi tải lại bằng đợt Cập nhật.</p>`;
    return html;
  }
});
H.tplSheet = async () => { const r = await call('templateSheet'); window.open(r.url, '_blank'); };

/* ================= P-53 Tải sheet ================= */
const DOTS = [['KT', 'Khởi tạo lần đầu', 'Lần đầu dùng app giữa nhiệm kỳ: tạo tài khoản cho cả danh sách hiện tại. Chọn nhiệm kỳ và giai đoạn đang diễn ra.'],
  ['OD', 'Oday', 'Sau đợt tuyển Oday: tạo nhiệm kỳ mới ở trạng thái chuẩn bị, tạo tài khoản BOD mới và thành viên, bắt đầu giai đoạn giao thoa (tự tắt ghi nhận KPI và điểm).'],
  ['D1', 'Đợt 1', 'Sau đợt tuyển 1: nhiệm kỳ mới chính thức bắt đầu (GĐ1), nhiệm kỳ cũ vào lưu trữ, bật lại ghi nhận. Người không còn trong danh sách là rời CLB.'],
  ['D2', 'Đợt 2', 'Sau đợt tuyển 2: kết thúc GĐ1, bắt đầu GĐ2. Người mới là thành viên bổ sung.'],
  ['CN', 'Cập nhật', 'Bất kỳ lúc nào: chỉ cập nhật danh sách và thông tin, không đổi giai đoạn.']];
route('tai-sheet', {
  can: () => isBod(), wide: true,
  render() {
    const s = App.state, u = App.ui.up || (App.ui.up = { loai: 'member', dot: s.members.length ? 'CN' : 'KT' });
    const step = u.pre ? 3 : u.rows ? 2 : 1;
    let html = topbar('Tải sheet');
    html += `<ol class="eco-stepper"><li class="${step > 1 ? 'is-done' : 'is-current'}">Chọn loại</li><li class="${step > 2 ? 'is-done' : step === 2 ? 'is-current' : ''}">Tải file</li><li class="${step === 3 ? 'is-current' : ''}">Xem trước và xác nhận</li></ol>`;
    html += `<section class="eco-card"><h2>1. Loại sheet</h2><div class="seg">${[['member', 'Thành viên'], ['core', 'Core team'], ['ucv', 'UCV']].map(([v, l]) => `<button class="${u.loai === v ? 'is-active' : ''}" data-act="upSet" data-k="loai" data-v="${v}">${l}</button>`).join('')}</div>
      ${u.loai === 'member' ? `<div class="stack tight">${DOTS.map(([v, l, d]) => `<label class="opt" style="align-items:flex-start"><input type="radio" name="upDot" value="${v}" ${u.dot === v ? 'checked' : ''} data-change="upDot"> <span><b>${l}</b><br><span class="small muted">${d}</span></span></label>`).join('')}</div>
        ${u.dot === 'KT' ? `<div class="row"><div class="eco-field"><label>Nhiệm kỳ</label><input class="eco-input sm" id="upTerm" value="${attr(u.nhiemKy || s.term.id)}" style="width:120px" data-change="upField" data-k="nhiemKy"><span class="hint">Ví dụ 2627</span></div><div class="eco-field"><label>Giai đoạn hiện tại</label><select class="eco-input sm" data-change="upField" data-k="giaiDoan"><option value="1" ${u.giaiDoan !== '2' ? 'selected' : ''}>Giai đoạn 1</option><option value="2" ${u.giaiDoan === '2' ? 'selected' : ''}>Giai đoạn 2</option></select></div></div><p class="small muted">Lần khởi tạo, đợt gia nhập của mọi người được ghi tạm là "có từ trước khi dùng app". Thành viên bổ sung thì sửa cột loai = bo-sung trong sheet dữ liệu.</p>` : ''}` : `<p class="small muted">Mỗi lần tải là danh sách đầy đủ hiện tại. Người mới xuất hiện là mới vào, người không còn là đã rời ${u.loai === 'core' ? 'core team' : 'UCV'} (vẫn là thành viên bình thường). Nối với thành viên bằng Họ và tên + Email.</p>`}
      <button class="linkbtn small" data-act="tplSheet">Tải sheet mẫu</button></section>`;
    html += `<section class="eco-card"><h2>2. Tải file</h2><div class="row"><label class="eco-btn">Chọn file .xlsx<input type="file" accept=".xlsx,.xls,.csv" class="hide" data-change="upFile"></label><span class="muted">hoặc</span><input class="eco-input sm grow" id="upLink" placeholder="Dán link Google Sheet" value="${attr(u.link || '')}"><button class="eco-btn" data-act="upLink">Đọc link</button></div>
      ${u.tabs && u.tabs.length > 1 ? `<div class="row"><span class="small">Tab:</span>${u.tabs.map(t => `<button class="eco-chip ${u.tab === t ? 'is-active' : ''}" data-act="upTab" data-v="${attr(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
      ${u.rows ? `<p class="small">Đã đọc <b>${u.rows.length}</b> dòng từ ${esc(u.src || '')}${u.tab ? ' · tab ' + esc(u.tab) : ''}. Cột: ${esc((u.head || []).join(', '))}</p><button class="eco-btn eco-btn--filled" data-act="upPreview">Xem trước</button>` : '<p class="small muted">App đọc cột theo tên cột, bỏ qua cột không dùng; thứ tự cột tùy ý.</p>'}</section>`;
    if (u.pre) html += previewHtml(u);
    html += uploadHistory();
    return html;
  }
});
function previewHtml(u) {
  const p = u.pre;
  const isM = u.loai === 'member';
  const news = isM ? p.items.filter(i => i.kind === 'new') : p.items.filter(i => i.kind === 'new');
  const stay = p.items.filter(i => i.kind === 'stay'), back = p.items.filter(i => i.kind === 'back');
  const ans = u.answers || {};
  const unans = p.questions.filter(q => !ans[q.line]).length;
  let h = `<section class="eco-card"><h2>3. Xem trước</h2><div class="grid3"><div class="stat"><div class="label">Ở lại</div><div class="big">${stay.length}</div></div><div class="stat"><div class="label">Mới</div><div class="big">${news.length}</div></div>${back.length ? `<div class="stat"><div class="label">Quay lại</div><div class="big">${back.length}</div></div>` : ''}<div class="stat"><div class="label">Rời</div><div class="big">${p.leaving.length}</div></div><div class="stat"><div class="label">Dòng lỗi</div><div class="big ${p.errors.length ? 'danger' : ''}">${p.errors.length}</div></div><div class="stat"><div class="label">Cần hỏi</div><div class="big">${p.questions.length}</div></div></div></section>`;
  if (p.errors.length) h += `<section class="eco-card"><h2 class="danger">Dòng lỗi (${p.errors.length})</h2><p class="small">Sửa trong sheet rồi tải lại.</p><div class="eco-list">${p.errors.map(e => `<div><span class="bi danger">✕</span><div class="li-main"><b>Dòng ${e.line}${e.hoTen ? ' · ' + esc(e.hoTen) : ''}</b><span class="sub">${esc(e.errs.join('; '))}</span></div></div>`).join('')}</div></section>`;
  if (p.questions.length) h += `<section class="eco-card"><h2>Cùng một người?</h2><p class="small muted">Tên khác nhưng trùng ngày sinh và email với một người cũ (ví dụ do sửa lỗi chính tả trong tên). Trả lời để giữ dữ liệu.</p>${p.questions.map(q => `<div class="eco-field"><span class="lbl">Dòng ${q.line}: "${esc(q.hoTen)}" và "${esc(q.candName)}" (${esc(q.candBan)})</span><div class="seg"><button class="${ans[q.line] === q.candId ? 'is-active' : ''}" data-act="upAns" data-l="${q.line}" data-v="${q.candId}">Cùng một người</button><button class="${ans[q.line] === 'new' ? 'is-active' : ''}" data-act="upAns" data-l="${q.line}" data-v="new">Hai người khác nhau</button></div></div>`).join('')}</section>`;
  if (news.length) h += `<section class="eco-card"><h2>Người mới (${news.length})</h2>${isM && u.dot === 'CN' ? `<div class="row"><span class="small">Ghi đợt gia nhập:</span><select class="eco-input sm" style="width:auto" data-change="upField" data-k="dotMoi"><option value="">Theo đợt tuyển gần nhất</option><option value="OD" ${u.dotMoi === 'OD' ? 'selected' : ''}>Oday</option><option value="D1" ${u.dotMoi === 'D1' ? 'selected' : ''}>Đợt 1</option><option value="D2" ${u.dotMoi === 'D2' ? 'selected' : ''}>Đợt 2 (bổ sung)</option></select></div>` : ''}<p class="small">${news.map(i => esc(isM ? i.row.hoTen + ' (' + i.row.ban + ')' : i.hoTen)).join(', ')}</p></section>`;
  if (p.leaving.length) h += `<section class="eco-card"><h2>${isM ? 'Rời CLB' : 'Rời ' + (u.loai === 'core' ? 'core team' : 'UCV')} (${p.leaving.length})</h2><p class="small">${p.leaving.map(x => esc(x.hoTen + ' (' + x.ban + ')')).join(', ')}</p>${isM ? '<p class="small muted">Người rời CLB không đăng nhập được nữa; dữ liệu cũ vẫn giữ.</p>' : ''}</section>`;
  const block = p.errors.length || unans;
  h += `<div class="stickybar"><span class="grow">${block ? (p.errors.length ? 'Còn ' + p.errors.length + ' dòng lỗi. ' : '') + (unans ? 'Còn ' + unans + ' câu hỏi chưa trả lời.' : '') : 'Sẵn sàng áp dụng.'}</span><button class="eco-btn" data-act="upReset">Làm lại</button><button class="eco-btn eco-btn--filled" data-act="upApply" ${block ? 'disabled' : ''}>Xác nhận áp dụng</button></div>`;
  return h;
}
function uploadHistory() {
  const ups = App.state.uploads || [];
  if (!ups.length) return '';
  const last = ups.find(u => !u.hoanTac);
  const name = u => u.loai === 'core' ? 'Core team' : u.loai === 'ucv' ? 'UCV' : 'Thành viên · ' + ((DOTS.find(d => d[0] === u.dot) || [])[1] || u.dot);
  return `<section class="eco-card"><h2>Lịch sử tải</h2><div class="eco-list">${ups.map(u => `<div><div class="li-main"><b>${esc(name(u))}</b><span class="sub">${esc(fDT(u.luc))} · ${esc(u.boi)} · ${u.tomTat.new || 0} mới, ${u.tomTat.stay || 0} ở lại, ${u.tomTat.left || 0} rời${u.hoanTac ? ' · đã hoàn tác ' + esc(u.hoanTac) : ''}</span></div>${last && u.id === last.id && Date.now() - tms(u.luc) < 7 * 86400e3 ? `<button class="eco-btn eco-btn--sm" data-act="upUndo" data-id="${u.id}">Hoàn tác</button>` : ''}</div>`).join('')}</div><p class="small muted">Hoàn tác được lần tải gần nhất trong 7 ngày. Quá 7 ngày thì sửa bằng một lần tải Cập nhật.</p></section>`;
}
H.upSet = el => { App.ui.up = { loai: el.dataset.v, dot: App.ui.up.dot }; render(); };
H.upDot = el => { App.ui.up.dot = el.value; App.ui.up.pre = null; render(); };
H.upField = el => { App.ui.up[el.dataset.k] = el.value; };
H.upReset = () => { App.ui.up = { loai: App.ui.up.loai, dot: App.ui.up.dot }; render(); };
H.upAns = el => { const u = App.ui.up; u.answers = u.answers || {}; u.answers[el.dataset.l] = el.dataset.v; render(); };
H.upTab = el => { const u = App.ui.up; if (u.wb) { readWbTab(u.wb, el.dataset.v); render(); } else { u.tab = el.dataset.v; H.upLink(); } };
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = () => bad(new Error('Không tải được bộ đọc Excel.')); document.head.appendChild(s); });
}
function readWbTab(wb, name) {
  const u = App.ui.up;
  const ws = wb.Sheets[name];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  let hi = aoa.findIndex(r => r.filter(x => String(x).trim()).length >= 2);
  if (hi < 0) hi = 0;
  const head = (aoa[hi] || []).map(h => String(h).trim());
  const dateCol = head.map(h => bodau(h).includes('ngay sinh'));
  u.rows = aoa.slice(hi + 1).map(r => {
    const o = {};
    head.forEach((h, j) => {
      if (!h) return;
      let v = r[j];
      if (typeof v === 'number' && dateCol[j]) { const d = XLSX.SSF.parse_date_code(v); v = d ? p2(d.d) + '/' + p2(d.m) + '/' + d.y : v; }
      o[h] = v == null ? '' : String(v);
    });
    return o;
  }).filter(o => Object.values(o).some(v => String(v).trim()));
  u.head = head.filter(Boolean); u.tab = name; u.tabs = wb.SheetNames; u.pre = null;
}
H.upFile = async el => {
  const f = el.files[0]; if (!f) return;
  setBusy(true);
  try {
    await loadXlsx();
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const u = App.ui.up;
    u.wb = wb; u.src = f.name; u.link = '';
    const want = { member: 'thanh vien', core: 'core team', ucv: 'ucv' }[u.loai];
    const name = wb.SheetNames.find(n => bodau(n).trim() === want) || wb.SheetNames.find(n => bodau(n).includes(want)) || wb.SheetNames[0];
    readWbTab(wb, name);
    render();
  } catch (e) { toast(e.message, true); } finally { setBusy(false); }
};
H.upLink = async () => {
  const u = App.ui.up;
  u.link = document.getElementById('upLink').value.trim();
  if (!u.link) return toast('Dán link Google Sheet.', true);
  const r = await call('readSheetLink', { url: u.link, tab: u.tab && !u.wb ? u.tab : '' });
  u.wb = null; u.rows = r.rows; u.head = r.head; u.tabs = r.tabs; u.tab = r.tab; u.src = r.name; u.pre = null;
  render();
};
function upArgs() { const u = App.ui.up; return { loai: u.loai, dot: u.loai === 'member' ? u.dot : '', rows: u.rows, nhiemKy: u.nhiemKy, giaiDoan: u.giaiDoan, dotMoi: u.dotMoi, answers: u.answers || {} }; }
H.upPreview = async () => { const u = App.ui.up; u.pre = await call('uploadPreview', upArgs()); u.answers = {}; render(); };
H.upApply = () => {
  const u = App.ui.up;
  const d = u.loai === 'member' ? DOTS.find(x => x[0] === u.dot) : null;
  confirmBox('Áp dụng?', (d ? '<b>' + d[1] + '</b>: ' + d[2] + '<br><br>' : '') + 'Hoàn tác được trong 7 ngày.', 'Áp dụng', async () => {
    await act('uploadApply', upArgs(), 'Đã áp dụng.');
    App.ui.up = { loai: u.loai, dot: 'CN' };
    render();
  });
};
H.upUndo = el => confirmBox('Hoàn tác lần tải này?', 'Danh sách thành viên, nhãn và giai đoạn trở về như trước lần tải. Task, log, điểm phát sinh sau đó vẫn giữ.', 'Hoàn tác', () => act('uploadUndo', { id: el.dataset.id }, 'Đã hoàn tác.'));

/* ================= P-55 Cài đặt ================= */
route('cai-dat', {
  can: () => isBod(),
  render(sub) {
    if (sub === 'ke-hoach') return planPage();
    const s = App.state, st = s.settings;
    const card = (title, body) => `<section class="eco-card"><h2>${title}</h2>${body}</section>`;
    const sw = (k, on, label) => `<label class="opt"><button type="button" class="eco-switch ${on ? 'is-on' : ''}" data-act="swSetting" data-k="${k}" aria-pressed="${on}"></button> ${label}</label>`;
    const inp = (k, label, val, type, hint) => `<div class="eco-field"><label>${label}</label><input class="eco-input sm" data-s="${k}" type="${type || 'text'}" value="${attr(val)}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    let html = topbar('Cài đặt');
    html += `<div class="grid2">`;
    html += card('Kế hoạch năm', `<p class="small muted">Tạo, sửa sự kiện (làm vài lần mỗi nhiệm kỳ). Sự kiện đã có task hoặc log thì không xóa được.</p><a class="eco-btn" href="#/cai-dat/ke-hoach">Mở Kế hoạch năm (${s.events.length} sự kiện)</a>`);
    html += card('Ghi nhận KPI và điểm', `${sw('ghiNhan', s.term.ghiNhan !== 'tat', 'Đang ghi nhận')}<p class="small muted">Tắt trong giai đoạn giao thoa: task, log, điểm phát sinh lúc tắt không được tính. App tự tắt khi tải đợt Oday và tự bật khi tải Đợt 1.</p><p class="small">Hiện tại: ${esc(termLabel())}</p>`);
    html += card('Phân công Nhân sự', nsAssignHtml());
    html += card('Cơ cấu tổ chức', `<div class="stack tight" id="orgList">${st.coCau.map((b, i) => `<div class="row nowrap"><input class="eco-input sm" style="width:80px" data-o="ma" value="${attr(b.ma)}" ${b.ma === 'BOD' ? 'disabled' : ''}><input class="eco-input sm grow" data-o="ten" value="${attr(b.ten)}"><input class="eco-input sm" style="width:130px" data-o="mang" value="${attr((b.mang || []).join(', '))}" placeholder="Mảng"></div>`).join('')}</div>
      <div class="row"><button class="eco-btn eco-btn--sm" data-act="orgAdd">${ic('plus', 'sm')} Thêm ban</button><button class="eco-btn eco-btn--sm eco-btn--filled" data-act="orgSave">Lưu cơ cấu</button></div><p class="small muted">Mã ban dùng trong cột Ban của sheet. Mảng cách nhau dấu phẩy. Xóa một ban: để trống mã rồi lưu.</p>`);
    html += card('Mốc nhắc task', `<div class="grid3">${inp('nhacTruocHan', 'Hôm trước ngày hạn', st.nhacTruocHan, 'time')}${inp('nhacNgayHan', 'Sáng ngày hạn', st.nhacNgayHan, 'time')}${inp('nhacSauHan', 'Sáng hôm sau', st.nhacSauHan, 'time')}${inp('khongLamSauGio', 'Thành Không làm sau (giờ)', st.khongLamSauGio, 'number')}</div><button class="eco-btn eco-btn--sm eco-btn--filled" data-act="saveInputs">Lưu</button>`);
    html += card('Ngưỡng KPI và top', `<div class="grid3">${inp('kpiDat', 'KPI đạt (%)', st.kpiDat, 'number')}${inp('kpiBuTru', 'Xét bù trừ (%)', st.kpiBuTru, 'number')}${inp('top', 'Top khen thưởng (%)', st.top, 'number')}${inp('topBuTru', 'Top bảng bù trừ (%)', st.topBuTru, 'number')}</div><button class="eco-btn eco-btn--sm eco-btn--filled" data-act="saveInputs">Lưu</button>`);
    html += card('Danh mục điểm', `<div class="eco-list">${s.catalog.map(c => `<div><div class="li-main"><b>${esc(c.ten)}</b><span class="sub">+${c.diem}${c.tuDong ? ' · cộng tự động' : ''}</span></div>${!c.tuDong ? `<button class="eco-btn eco-btn--sm" data-act="catEdit" data-id="${c.id}">Sửa</button>` : ''}</div>`).join('')}</div><button class="eco-btn eco-btn--sm" data-act="catEdit">${ic('plus', 'sm')} Thêm hoạt động</button><p class="small muted">Hoạt động mới phải công bố mức điểm trước khi diễn ra.</p>`);
    html += card('Chữ ký thư', `<div id="sigBox"><p class="small muted">Đang đọc chữ ký từ Gmail CLB…</p></div>`);
    html += card('Email báo về Gmail CLB', `${sw('emailBao.gopY', st.emailBao.gopY, 'Có góp ý mới')}${sw('emailBao.mail', st.emailBao.mail, 'Có thư UCV chờ duyệt')}${sw('emailBao.seeding', st.emailBao.seeding, 'Nhân sự seeding vừa ghi nhận')}`);
    html += card('Seeding', `<p class="small muted">Chỉ dùng khi vị trí Nhân sự phụ trách seeding đang trống.</p><a class="eco-btn" href="#/seeding">Mở Seeding</a><div class="grid3">${inp('nhacSeedingSauNgay', 'Nhắc ghi nhận sau (ngày)', st.nhacSeedingSauNgay, 'number')}</div><button class="eco-btn eco-btn--sm eco-btn--filled" data-act="saveInputs">Lưu</button>`);
    html += card('Sinh nhật và thông báo', `${inp('lichSinhNhat', 'ID Google Calendar cho sinh nhật', st.lichSinhNhat, 'text', 'Lấy trong Google Calendar → Cài đặt của lịch → Mã lịch. Để trống thì không đồng bộ.')}${inp('giuThongBao', 'Giữ thông báo (ngày)', st.giuThongBao, 'number')}<button class="eco-btn eco-btn--sm eco-btn--filled" data-act="saveInputs">Lưu</button>`);
    html += card('Tài khoản', `<div class="eco-field"><span class="lbl">Mật khẩu mặc định của tài khoản thành viên</span><span>••••••</span><span class="hint">Chỉ đổi được, không xem được.</span></div><div class="row nowrap"><input class="eco-input sm" type="password" id="defPw" placeholder="Mật khẩu mặc định mới" autocomplete="new-password"><button class="eco-btn eco-btn--sm" data-act="defPwSave">Đổi</button></div><p class="small muted">Áp dụng cho mọi tài khoản chưa tự đổi mật khẩu.</p>`);
    html += `</div>`;
    return html;
  },
  after(sub) { if (!sub) loadSig(); }
});
function nsAssignHtml() {
  const s = App.state;
  const bans = s.settings.coCau.map(b => b.ma).filter(b => b !== 'BOD');
  const showAll = App.ui.nsAll;
  const people = sortMembers(activeMembers().filter(m => showAll || m.ban === 'HR' || m.nsBan || m.nsSeeding === 'co'));
  return `<p class="small muted">Nhân sự phụ trách ban (một người được nhiều ban) và Nhân sự phụ trách seeding.</p>
    <div class="eco-list">${people.map(m => {
      const cur = (m.nsBan || '').split(',').filter(Boolean);
      return `<div style="flex-wrap:wrap"><div class="li-main"><b>${esc(m.hoTen)}</b><span class="sub">${esc(banLabel(m))}</span></div><div class="row">${bans.map(b => `<button class="eco-chip ${cur.includes(b) ? 'is-active' : ''}" data-act="nsBan" data-id="${m.id}" data-b="${b}">${b}</button>`).join('')}<button class="eco-chip ${m.nsSeeding === 'co' ? 'is-active' : ''}" data-act="nsSeed" data-id="${m.id}">Seeding</button></div></div>`;
    }).join('') || '<p class="muted">Chưa có thành viên ban HR.</p>'}</div>
    <button class="linkbtn small" data-act="toggle" data-k="nsAll">${showAll ? 'Chỉ hiện ban HR' : 'Hiện mọi thành viên'}</button>`;
}
H.nsBan = el => {
  const m = App.idx.m[el.dataset.id];
  const cur = (m.nsBan || '').split(',').filter(Boolean);
  const b = el.dataset.b;
  act('assignNs', { memberId: m.id, nsBan: cur.includes(b) ? cur.filter(x => x !== b) : cur.concat([b]) }, 'Đã cập nhật phân công.');
};
H.nsSeed = el => { const m = App.idx.m[el.dataset.id]; act('assignNs', { memberId: m.id, nsSeeding: m.nsSeeding !== 'co' }, 'Đã cập nhật phân công.'); };
H.swSetting = el => {
  const k = el.dataset.k, on = !el.classList.contains('is-on');
  if (k === 'ghiNhan') return act('settingsSave', { values: { ghiNhan: on ? 'bat' : 'tat' } }, on ? 'Đã bật ghi nhận.' : 'Đã tắt ghi nhận.');
  if (k === 'dungChuKy') return act('settingsSave', { values: { dungChuKy: on ? 'bat' : 'tat' } }).then(loadSig);
  if (k.startsWith('emailBao.')) { const v = Object.assign({}, App.state.settings.emailBao, { [k.split('.')[1]]: on }); return act('settingsSave', { values: { emailBao: JSON.stringify(v) } }); }
};
H.saveInputs = el => {
  const values = {};
  el.closest('.eco-card').querySelectorAll('[data-s]').forEach(i => values[i.dataset.s] = i.value);
  act('settingsSave', { values }, 'Đã lưu.');
};
H.orgAdd = () => { const d = document.createElement('div'); d.className = 'row nowrap'; d.innerHTML = '<input class="eco-input sm" style="width:80px" data-o="ma" placeholder="Mã"><input class="eco-input sm grow" data-o="ten" placeholder="Tên ban"><input class="eco-input sm" style="width:130px" data-o="mang" placeholder="Mảng">'; document.getElementById('orgList').appendChild(d); };
H.orgSave = () => {
  const list = [...document.querySelectorAll('#orgList > .row')].map(r => ({ ma: r.querySelector('[data-o=ma]').value.trim().toUpperCase(), ten: r.querySelector('[data-o=ten]').value.trim(), mang: r.querySelector('[data-o=mang]').value.split(',').map(x => x.trim()).filter(Boolean) })).filter(b => b.ma);
  if (!list.some(b => b.ma === 'BOD')) list.unshift({ ma: 'BOD', ten: 'Ban điều hành', mang: [] });
  act('settingsSave', { values: { coCau: JSON.stringify(list) } }, 'Đã lưu cơ cấu.');
};
H.catEdit = el => {
  const c = el.dataset.id ? App.state.catalog.find(x => x.id === el.dataset.id) : {};
  modal(c.id ? 'Sửa hoạt động' : 'Thêm hoạt động', `<div class="form"><div class="eco-field"><label>Tên hoạt động</label><input class="eco-input" id="ctName" value="${attr(c.ten || '')}"></div><div class="eco-field"><label>Mức điểm</label><input class="eco-input" type="number" min="1" id="ctPts" value="${attr(c.diem || '')}"></div>${c.id ? '<label class="opt"><input type="checkbox" class="chk" id="ctHide"> Ẩn hoạt động này</label>' : ''}</div><div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="ctSave">Lưu</button></div>`);
  document.getElementById('ctSave').onclick = async () => { const h = document.getElementById('ctHide'); try { await act('catalogSave', { id: c.id, ten: document.getElementById('ctName').value, diem: document.getElementById('ctPts').value, an: h && h.checked }, 'Đã lưu.'); closeModal(); } catch (e) { } };
};
H.defPwSave = async () => { const v = document.getElementById('defPw').value; await call('setDefaultPassword', { password: v }); document.getElementById('defPw').value = ''; toast('Đã đổi mật khẩu mặc định.'); };
async function loadSig(fresh) {
  const box = document.getElementById('sigBox'); if (!box) return;
  try {
    const r = await api('signatureInfo', { fresh: !!fresh });
    if (!document.getElementById('sigBox')) return;
    box.innerHTML = `<label class="opt"><button type="button" class="eco-switch ${r.on ? 'is-on' : ''}" data-act="swSetting" data-k="dungChuKy"></button> Gắn chữ ký vào thư UCV</label>
      ${r.err ? banner(esc(r.err), 'error') : r.html ? `<div class="mailbody">${r.html}</div>` : '<p class="small muted">Gmail CLB chưa có chữ ký mặc định.</p>'}
      <div class="row"><button class="eco-btn eco-btn--sm" data-act="sigReload">${ic('refresh', 'sm')} Đọc lại chữ ký</button><a class="eco-btn eco-btn--sm" href="${attr(r.editLink)}" target="_blank" rel="noopener">Sửa trong Gmail ${ic('ext', 'sm')}</a></div>`;
  } catch (e) { box.innerHTML = banner(esc(e.message), 'error'); }
}
H.sigReload = () => loadSig(true);

function planPage() {
  const s = App.state;
  let html = topbar('Kế hoạch năm', { back: '#/cai-dat', right: `<button class="eco-btn eco-btn--sm" data-act="evEdit">${ic('plus', 'sm')} Thêm sự kiện</button>` });
  html += s.events.length ? `<section class="eco-card"><div class="eco-list">${s.events.map(e => `<div><div class="li-main"><b>${esc(e.ten)}</b><span class="sub">${esc(fD(e.batDau))}${e.ketThuc ? ' – ' + esc(fD(e.ketThuc)) : ''}${e.diaDiem ? ' · ' + esc(e.diaDiem) : ''}</span></div><button class="eco-btn eco-btn--sm" data-act="evEdit" data-id="${e.id}">Sửa</button></div>`).join('')}</div></section>` : empty('Chưa có sự kiện. Thêm theo kế hoạch năm của CLB.');
  return html;
}
H.evEdit = el => {
  const e = el.dataset.id ? App.idx.ev[el.dataset.id] : {};
  modal(e.id ? 'Sửa sự kiện' : 'Thêm sự kiện', `<div class="form"><div class="eco-field"><label>Tên sự kiện</label><input class="eco-input" id="evName" value="${attr(e.ten || '')}" autofocus></div>
    <div class="row nowrap"><div class="eco-field grow"><label>Bắt đầu</label><input class="eco-input" type="date" id="evB" value="${attr((e.batDau || '').slice(0, 10))}"></div><div class="eco-field grow"><label>Kết thúc</label><input class="eco-input" type="date" id="evE" value="${attr((e.ketThuc || '').slice(0, 10))}"></div></div>
    <div class="eco-field"><label>Địa điểm log <span class="muted">(không bắt buộc)</span></label><input class="eco-input" id="evPlace" value="${attr(e.diaDiem || '')}"></div>
    <div class="eco-field"><label>Mô tả ngắn</label><textarea class="eco-input" id="evDesc">${esc(e.moTa || '')}</textarea></div></div>
    <div class="actions">${e.id ? '<button class="eco-btn eco-btn--danger" id="evDel">Xóa</button>' : ''}<button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="evSave">Lưu</button></div>`);
  document.getElementById('evSave').onclick = async () => { try { await act('eventSave', { id: e.id, ten: document.getElementById('evName').value, batDau: document.getElementById('evB').value, ketThuc: document.getElementById('evE').value, diaDiem: document.getElementById('evPlace').value, moTa: document.getElementById('evDesc').value }, 'Đã lưu sự kiện.'); closeModal(); } catch (err) { } };
  const d = document.getElementById('evDel');
  if (d) d.onclick = () => confirmBox('Xóa sự kiện?', 'Chỉ xóa được sự kiện chưa có task hay buổi log.', 'Xóa', () => act('eventDelete', { id: e.id }, 'Đã xóa.'));
};

/* ================= P-56 Nhật ký và lưu trữ ================= */
route('nhat-ky', {
  can: () => isBod(), wide: true,
  render() {
    const tab = App.ui.nkTab || 'nk';
    let html = topbar('Nhật ký và lưu trữ');
    html += `<div class="tabs"><button class="${tab === 'nk' ? 'is-active' : ''}" data-act="set" data-k="nkTab" data-v="nk">Nhật ký</button><button class="${tab === 'old' ? 'is-active' : ''}" data-act="set" data-k="nkTab" data-v="old">Nhiệm kỳ cũ</button></div>`;
    if (tab === 'nk') {
      const j = App.ui.journal;
      if (!j) { html += '<p class="muted">Đang tải…</p>'; return html; }
      const who = [...new Set(j.map(r => r.boi))], kinds = [...new Set(j.map(r => r.loai))];
      const f = App.ui.nkF || {};
      const list = j.filter(r => (!f.boi || r.boi === f.boi) && (!f.loai || r.loai === f.loai) && (!f.tu || r.luc.slice(0, 10) >= f.tu) && (!f.den || r.luc.slice(0, 10) <= f.den));
      html += `<div class="row"><select class="eco-input sm" style="width:auto" data-change="nkF" data-k="boi"><option value="">Mọi người</option>${who.map(w => `<option ${f.boi === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select><select class="eco-input sm" style="width:auto" data-change="nkF" data-k="loai"><option value="">Mọi loại việc</option>${kinds.map(w => `<option ${f.loai === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select><input type="date" class="eco-input sm" style="width:auto" data-change="nkF" data-k="tu" value="${attr(f.tu || '')}"><input type="date" class="eco-input sm" style="width:auto" data-change="nkF" data-k="den" value="${attr(f.den || '')}"></div>`;
      html += `<section class="eco-card" style="padding:4px 16px"><div class="tablewrap"><table class="eco-table"><thead><tr><th>Lúc</th><th>Ai</th><th class="dk">Loại</th><th>Làm gì</th></tr></thead><tbody>${list.slice(0, 500).map(r => `<tr><td style="white-space:nowrap">${esc(fDT(r.luc))}</td><td>${esc(r.boi)}</td><td class="dk">${esc(r.loai)}</td><td>${esc(r.noiDung)}</td></tr>`).join('')}</tbody></table></div></section>`;
    } else {
      const terms = (App.state.terms || []).filter(t => t.trangThai === 'luu-tru');
      html += terms.length ? terms.map(t => `<section class="eco-card"><div class="head"><h2>Nhiệm kỳ ${esc(t.id.slice(0, 2) + '–' + t.id.slice(2))}</h2><button class="eco-btn eco-btn--sm" data-act="oldTerm" data-id="${t.id}">Xem</button></div><div id="old-${t.id}"></div></section>`).join('') : empty('Chưa có nhiệm kỳ nào được cất vào lưu trữ. Nhiệm kỳ cũ được lưu khi tải sheet Đợt 1.');
    }
    return html;
  },
  after() { if ((App.ui.nkTab || 'nk') === 'nk' && !App.ui.journal) api('journal').then(j => { App.ui.journal = j; render(); }).catch(e => toast(e.message, true)); }
});
H.nkF = el => { App.ui.nkF = Object.assign({}, App.ui.nkF, { [el.dataset.k]: el.value }); render(); };
H.oldTerm = async el => {
  const r = await call('oldTerm', { id: el.dataset.id });
  document.getElementById('old-' + el.dataset.id).innerHTML = `<p class="small">Sự kiện: ${r.events.map(e => esc(e.ten)).join(', ') || '–'}</p><table class="eco-table"><thead><tr><th>Thành viên</th><th class="num">Tổng điểm</th></tr></thead><tbody>${r.scores.map(x => `<tr><td>${esc(x.ten)}</td><td class="num">${x.diem}</td></tr>`).join('')}</tbody></table>`;
};
