/* Trang của BOD và Nhân sự: sự kiện, task, log, điểm danh, chốt, tổng quan, cộng điểm, góp ý, seeding, tổng kết. */
'use strict';

const activeMembers = () => App.state.members.filter(m => m.ban !== 'BOD');
const orgOrder = () => App.state.settings.coCau.map(b => b.ma);
function sortMembers(arr) { const o = orgOrder(); return arr.slice().sort((a, b) => (o.indexOf(a.ban) - o.indexOf(b.ban)) || a.hoTen.localeCompare(b.hoTen, 'vi')); }

/* ---------- Bộ chọn thành viên (dùng ở nhập task, cộng điểm, điểm danh) ---------- */
function picker(id, members, selected, opts = {}) {
  selected = new Set(selected || []);
  const groups = [];
  App.state.settings.coCau.forEach(b => {
    if (!members.some(m => m.ban === b.ma)) return;
    groups.push(`<button type="button" class="eco-chip" data-act="pkGroup" data-pk="${id}" data-ban="${b.ma}">Cả ${b.ma === 'BOD' ? 'BOD' : 'ban ' + b.ma}</button>`);
    (b.mang || []).forEach(mg => { if (members.some(m => m.ban === b.ma && (m.mang || '').split(',').map(x => x.trim()).includes(mg))) groups.push(`<button type="button" class="eco-chip" data-act="pkGroup" data-pk="${id}" data-ban="${b.ma}" data-mang="${mg}">${b.ma} · ${mg}</button>`); });
  });
  return `<div class="stack tight" id="${id}">
    <div class="row nowrap"><input class="eco-input sm" placeholder="Gõ tên để tìm" data-input="pkSearch" data-pk="${id}"><span class="small muted" style="white-space:nowrap"><b id="${id}-n">${selected.size}</b> đã chọn</span></div>
    ${opts.noGroups ? '' : `<div class="chips wrap">${groups.join('')}<button type="button" class="eco-chip" data-act="pkNone" data-pk="${id}">Bỏ chọn hết</button></div>`}
    <div class="eco-list" style="max-height:${opts.height || 320}px;overflow-y:auto">${sortMembers(members).map(m => `<label class="opt" data-name="${attr(bodau(m.hoTen + ' ' + (m.tenFb || '')))}" data-ban="${m.ban}" data-mang="${attr(m.mang || '')}"><input type="checkbox" class="chk" value="${m.id}" ${selected.has(m.id) ? 'checked' : ''} data-change="pkCount" data-pk="${id}">${avatar(m, 'sm')}<span class="grow">${esc(m.hoTen)}<span class="small muted"> · ${esc(banLabel(m))}${opts.extra ? opts.extra(m) : ''}</span></span></label>`).join('')}</div></div>`;
}
const pickerVal = id => [...document.querySelectorAll(`#${id} input[type=checkbox]:checked`)].map(i => i.value);
H.pkSearch = el => { const q = bodau(el.value.trim()); document.querySelectorAll(`#${el.dataset.pk} label.opt`).forEach(l => l.classList.toggle('hide', !!q && !l.dataset.name.includes(q))); };
H.pkCount = el => { const n = document.getElementById(el.dataset.pk + '-n'); if (n) n.textContent = pickerVal(el.dataset.pk).length; if (H['pkAfter_' + el.dataset.pk]) H['pkAfter_' + el.dataset.pk](); };
H.pkGroup = el => {
  const boxes = [...document.querySelectorAll(`#${el.dataset.pk} label.opt`)].filter(l => l.dataset.ban === el.dataset.ban && (!el.dataset.mang || l.dataset.mang.split(',').map(x => x.trim()).includes(el.dataset.mang))).map(l => l.querySelector('input'));
  const all = boxes.every(b => b.checked);
  boxes.forEach(b => b.checked = !all);
  H.pkCount(boxes[0] || el);
};
H.pkNone = el => { document.querySelectorAll(`#${el.dataset.pk} input[type=checkbox]`).forEach(b => b.checked = false); H.pkCount(el); };

/* ---------- Nhập task (P-30, P-42) ---------- */
function openTaskForm(eventId) {
  const s = App.state, bod = isBod();
  const ns = R().ns || [];
  const pool = bod ? s.members : s.members.filter(m => ns.includes(m.ban));
  const evs = s.events;
  if (!evs.length) return toast('Chưa có sự kiện nào. BOD tạo sự kiện trong Cài đặt → Kế hoạch năm.', true);
  const tmr = new Date(Date.now() + 86400e3 + 7 * 3600e3).toISOString().slice(0, 10);
  modal('Nhập task', `<div class="form">
    <div class="eco-field"><label>Sự kiện</label>${eventId ? `<b>${esc(App.idx.ev[eventId].ten)}</b>` : `<select class="eco-input" id="tfEv"><option value="">Chọn sự kiện</option>${evs.map(e => `<option value="${e.id}" ${App.ui.lastEv === e.id ? 'selected' : ''}>${esc(e.ten)}</option>`).join('')}</select>`}</div>
    <div class="eco-field"><label for="tfName">Tên task</label><input class="eco-input" id="tfName" autofocus></div>
    <div class="eco-field"><label for="tfDesc">Mô tả <span class="muted">(không bắt buộc)</span></label><textarea class="eco-input" id="tfDesc" style="min-height:64px"></textarea></div>
    <div class="row nowrap"><div class="eco-field grow"><label>Hạn chót</label><input class="eco-input" type="date" id="tfDate" value="${tmr}"></div><div class="eco-field" style="width:130px"><label>Giờ</label><input class="eco-input" type="time" id="tfTime" value="23:59"></div></div>
    <div class="eco-field"><span class="lbl">Người được giao</span>${picker('pkTask', pool, [])}${bod ? '<span class="hint">Giao cho BOD khác thì app nhắc thẳng người đó.</span>' : '<span class="hint">Chỉ thành viên các ban bạn phụ trách.</span>'}</div>
  </div><div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="tfSave">Lưu task</button></div>`, { wide: true });
  document.getElementById('tfSave').onclick = async () => {
    const ev = eventId || document.getElementById('tfEv').value;
    if (!ev) return toast('Chọn sự kiện.', true);
    App.ui.lastEv = ev;
    const args = { eventId: ev, ten: document.getElementById('tfName').value, moTa: document.getElementById('tfDesc').value, hanChot: document.getElementById('tfDate').value + ' ' + document.getElementById('tfTime').value, memberIds: pickerVal('pkTask') };
    try { await act('taskCreate', args, 'Đã lưu task.'); closeModal(); } catch (e) { }
  };
}
H.taskNew = el => openTaskForm(el.dataset.ev);
H.taskEditOpen = el => {
  const t = App.idx.task[el.dataset.id];
  modal('Sửa task', `<div class="form"><div class="eco-field"><label>Tên task</label><input class="eco-input" id="teName" value="${attr(t.ten)}"></div>
    <div class="eco-field"><label>Mô tả</label><textarea class="eco-input" id="teDesc">${esc(t.moTa)}</textarea></div>
    <div class="eco-field"><span class="lbl">Hạn chót</span><div class="small muted">Hạn cũ: ${esc(fDT(t.hanChot))}</div><div class="row nowrap"><input class="eco-input" type="date" id="teDate" value="${t.hanChot.slice(0, 10)}"><input class="eco-input" type="time" id="teTime" value="${t.hanChot.slice(11, 16)}" style="width:130px"></div></div>
    <div class="eco-field"><label>Lý do đổi hạn <span class="muted">(không bắt buộc)</span></label><input class="eco-input" id="teWhy" placeholder="Ví dụ: gia hạn theo xin phép trên Messenger"></div>
    <p class="small muted">Đổi hạn áp dụng cho mọi người được giao, có ghi nhật ký, app nhắc lại theo hạn mới.</p></div>
    <div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="teSave">Lưu</button></div>`);
  document.getElementById('teSave').onclick = async () => {
    try { await act('taskEdit', { taskId: t.id, ten: document.getElementById('teName').value, moTa: document.getElementById('teDesc').value, hanChot: document.getElementById('teDate').value + ' ' + document.getElementById('teTime').value, lyDo: document.getElementById('teWhy').value }, 'Đã lưu.'); closeModal(); } catch (e) { }
  };
};
H.taskAddPeople = el => {
  const t = App.idx.task[el.dataset.id];
  const ns = R().ns || [];
  const have = new Set(t.assignees.map(a => a.memberId));
  const pool = App.state.members.filter(m => !have.has(m.id) && (isBod() || ns.includes(m.ban)));
  modal('Thêm người vào task', picker('pkAdd', pool, []) + `<div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="taSave">Thêm</button></div>`, { wide: true });
  document.getElementById('taSave').onclick = async () => { try { await act('taskEdit', { taskId: t.id, addMemberIds: pickerVal('pkAdd') }, 'Đã thêm.'); closeModal(); } catch (e) { } };
};

function taskProgress(t) {
  const n = t.assignees.length, c = t.assignees.filter(a => a.xacNhanLuc).length, g = t.assignees.filter(a => a.chatLuong).length;
  return `${c}/${n} xác nhận${g ? ' · ' + g + ' đã chấm' : ''}`;
}
function taskListRows(ts) {
  return ts.map(t => {
    const late = t.assignees.some(a => a.st === 'qua-han' || a.st === 'khong-lam');
    const bans = [...new Set(t.assignees.map(a => (App.idx.m[a.memberId] || {}).ban).filter(Boolean))].join(', ');
    return `<a href="#/task/${t.id}"><div class="li-main"><b class="ellipsis">${esc(t.ten)}</b><span class="sub">${esc(bans)} · ${t.assignees.length} người · hạn ${esc(fDT(t.hanChot))} · ${taskProgress(t)}</span></div>${t.huy ? tag('Đã hủy') : late ? tag('Trễ hạn', 'attention') : ''}</a>`;
  }).join('');
}

/* ================= P-42 / P-43 Sự kiện (BOD) ================= */
function bodEventPage(id) {
  const s = App.state;
  if (!id) {
    let html = topbar('Sự kiện');
    html += `<p class="small muted">Tạo và sửa sự kiện trong <a href="#/cai-dat/ke-hoach">Cài đặt → Kế hoạch năm</a>.</p>`;
    html += s.events.length ? `<div class="grid2">${s.events.map(e => {
      const ts = s.tasks.filter(t => t.eventId === e.id && !t.huy);
      return `<a class="eco-card" href="#/su-kien/${e.id}" style="text-decoration:none"><div class="head"><b>${esc(e.ten)}</b>${eventStatusTag(e)}</div><span class="small muted">${esc(fD(e.batDau))}${e.ketThuc ? ' – ' + esc(fD(e.ketThuc)) : ''}</span>
        <span class="small">${ts.length} task · ${e.log.trangThai === 'chot' ? 'log đã chốt' : e.log.trangThai === 'mo' ? 'log đang mở · ' + e.sessions.length + ' buổi' : 'chưa có log'}</span></a>`;
    }).join('')}</div>` : empty('Chưa có sự kiện. Tạo trong Cài đặt → Kế hoạch năm.');
    return html;
  }
  const e = App.idx.ev[id];
  if (!e) return topbar('Sự kiện', { back: '#/su-kien' }) + empty('Không tìm thấy sự kiện.');
  const tab = App.ui['evTab'] || 'task';
  let html = topbar(e.ten, { back: '#/su-kien', right: tab === 'task' ? `<button class="eco-btn eco-btn--sm" data-act="taskNew" data-ev="${e.id}">${ic('plus', 'sm')} Nhập task</button>` : '' });
  html += `<div class="tabs"><button class="${tab === 'task' ? 'is-active' : ''}" data-act="set" data-k="evTab" data-v="task">Task</button><button class="${tab === 'log' ? 'is-active' : ''}" data-act="set" data-k="evTab" data-v="log">Log</button></div>`;
  if (tab === 'task') {
    const ts = s.tasks.filter(t => t.eventId === e.id);
    const f = App.ui.evTf || '';
    const cnt = k => ts.filter(t => taskFilter(t, k)).length;
    html += `<div class="chips">${[['', 'Tất cả'], ['mo', 'Đang làm'], ['cham', 'Chờ chấm'], ['tre', 'Trễ hạn'], ['xong', 'Đã chấm xong'], ['huy', 'Đã hủy']].map(([k, l]) => `<button class="eco-chip ${f === k ? 'is-active' : ''}" data-act="set" data-k="evTf" data-v="${k}">${l} <span class="${f === k ? '' : 'muted'}">${cnt(k)}</span></button>`).join('')}</div>`;
    const list = ts.filter(t => taskFilter(t, f)).sort((a, b) => tms(b.hanChot) - tms(a.hanChot));
    html += list.length ? `<section class="eco-card"><div class="eco-list">${taskListRows(list)}</div></section>` : empty('Chưa có task nào.');
  } else html += logSetupHtml(e);
  return html;
}
function taskFilter(t, k) {
  if (!k) return true;
  if (k === 'huy') return t.huy;
  if (t.huy) return false;
  if (k === 'mo') return t.assignees.some(a => a.st === 'sap-han' || a.st === 'qua-han');
  if (k === 'cham') return t.assignees.some(a => a.st === 'cho-cham' && !a.isBod);
  if (k === 'tre') return t.assignees.some(a => a.st === 'qua-han' || a.st === 'khong-lam' || a.han === 'tre');
  if (k === 'xong') return t.assignees.every(a => a.st === 'da-cham' || a.st === 'khong-lam' || (a.isBod && a.xacNhanLuc));
  return true;
}

function unitsOf(x) { return x.thoiLuong === 180 ? 2 : 1; }
function logSetupHtml(e) {
  const l = e.log;
  if (!l.trangThai) return `<section class="eco-card"><p>Sự kiện này chưa có đợt log.</p><button class="eco-btn eco-btn--filled" data-act="logSetup" data-id="${e.id}">Thiết lập log</button><p class="small muted">Không phải sự kiện nào cũng có log.</p></section>`;
  const closed = l.trangThai === 'chot';
  const past = e.sessions.filter(x => tms(x.thoiDiem) < Date.now()).length;
  let h = `<section class="eco-card"><div class="head"><h2>Đợt log</h2>${closed ? tag('Đã chốt', 'done') : tag('Đang mở')}</div>
    <p>${e.sessions.length} buổi đã tạo = <b>${l.planned}</b> buổi quy ra 90 phút · ${past} buổi đã qua · ${l.held} buổi (quy đổi) đã điểm danh</p>
    ${closed ? `<p class="small muted">Chốt bởi ${esc(l.chotBoi)} lúc ${esc(fDT(l.chotLuc))}.</p>` : ''}
    <div class="row"><a class="eco-btn eco-btn--filled" href="#/chot/${e.id}">${closed ? 'Xem kết quả chốt' : 'Xem trước và chốt'}</a>${l.sheetUrl ? `<a class="eco-btn" href="${attr(l.sheetUrl)}" target="_blank" rel="noopener">Mở sheet đăng ký ${ic('ext', 'sm')}</a>` : ''}<button class="eco-btn" data-act="regSync" data-id="${e.id}">${l.sheetUrl ? 'Cập nhật sheet đăng ký' : 'Tạo sheet đăng ký'}</button></div></section>`;
  h += `<section class="eco-card"><div class="head"><h2>Các buổi</h2>${!closed ? `<button class="eco-btn eco-btn--sm" data-act="sessNew" data-ev="${e.id}">${ic('plus', 'sm')} Thêm buổi</button>` : ''}</div>
    ${e.sessions.length ? `<div class="eco-list">${e.sessions.map(x => `<div><div class="li-main"><b>${esc(x.ten)}</b><span class="sub">${esc(fDT(x.thoiDiem))} · ${x.thoiLuong} phút${x.thoiLuong === 180 ? ' (tính 2 buổi)' : ''} · ${x.count ? x.count + ' người có mặt' : 'chưa điểm danh'}${x.huyLyDo ? ' · hủy: ' + esc(x.huyLyDo) : ''}${x.keHoach && x.keHoach.trangThai ? ' · ' + esc(x.keHoach.trangThai) : ''}</span></div>
      <div class="row nowrap"><button class="eco-btn eco-btn--sm" data-act="planOpen" data-id="${x.id}">Kế hoạch</button>${!closed ? `<button class="eco-btn eco-btn--sm" data-act="sessEdit" data-id="${x.id}">Sửa</button>` : ''}</div></div>`).join('')}</div>` : '<p class="muted">Chưa có buổi nào.</p>'}</section>`;
  h += quotaHtml(e, closed);
  return h;
}
function quotaHtml(e, closed) {
  const l = e.log, org = App.state.settings.coCau.filter(b => b.ma !== 'BOD');
  const khois = [...new Set(activeMembers().map(m => m.khoi).filter(Boolean))].sort();
  const people = Object.keys(l.chiTieuNguoi || {});
  return `<section class="eco-card"><div class="head"><h2>Chỉ tiêu ban đầu</h2>${!closed ? '<button class="eco-btn eco-btn--sm" data-act="quotaSave" data-id="' + e.id + '">Lưu chỉ tiêu</button>' : ''}</div>
    <p class="small muted">Số buổi (90 phút) mỗi người được giao. Ưu tiên: riêng từng người → khối → ban. Để trống là chưa đặt. BOD không có chỉ tiêu.</p>
    <div class="grid3" id="qBan">${org.map(b => `<div class="eco-field"><label>Ban ${b.ma}</label><input class="eco-input sm" type="number" min="0" step="0.5" data-b="${b.ma}" value="${l.chiTieuBan[b.ma] ?? ''}" ${closed ? 'disabled' : ''}></div>`).join('')}</div>
    ${khois.length ? `<div class="label">Theo khối (không bắt buộc)</div><div class="grid3" id="qKhoi">${khois.map(k => `<div class="eco-field"><label>Khối ${k}</label><input class="eco-input sm" type="number" min="0" step="0.5" data-k="${k}" value="${l.chiTieuKhoi[k] ?? ''}" ${closed ? 'disabled' : ''}></div>`).join('')}</div>` : ''}
    <div class="label">Riêng từng người</div><div id="qNguoi" class="stack tight">${people.map(id => `<div class="row nowrap"><span class="grow">${esc(mName(id))}</span><input class="eco-input sm" type="number" min="0" step="0.5" data-p="${id}" value="${l.chiTieuNguoi[id]}" style="width:100px" ${closed ? 'disabled' : ''}></div>`).join('')}</div>
    ${!closed ? `<div class="row nowrap"><select class="eco-input sm" id="qAddP"><option value="">+ Thêm người có chỉ tiêu riêng</option>${sortMembers(activeMembers()).filter(m => !people.includes(m.id)).map(m => `<option value="${m.id}">${esc(m.hoTen)} · ${esc(m.ban)}</option>`).join('')}</select><button class="eco-btn eco-btn--sm" data-act="quotaAddP">Thêm</button></div>` : ''}</section>`;
}
H.quotaAddP = () => {
  const sel = document.getElementById('qAddP'); if (!sel.value) return;
  const div = document.createElement('div'); div.className = 'row nowrap';
  div.innerHTML = `<span class="grow">${esc(mName(sel.value))}</span><input class="eco-input sm" type="number" min="0" step="0.5" data-p="${sel.value}" style="width:100px">`;
  document.getElementById('qNguoi').appendChild(div); sel.querySelector(`option[value="${sel.value}"]`).remove(); sel.value = '';
};
H.quotaSave = el => {
  const get = (sel, k) => Object.fromEntries([...document.querySelectorAll(sel)].map(i => [i.dataset[k], i.value]).filter(x => x[1] !== ''));
  act('quotaSave', { eventId: el.dataset.id, ban: get('#qBan input', 'b'), khoi: get('#qKhoi input', 'k'), nguoi: get('#qNguoi input', 'p') }, 'Đã lưu chỉ tiêu.');
};
H.logSetup = el => act('logSetup', { eventId: el.dataset.id }, 'Đã bật log cho sự kiện.');
H.regSync = el => act('regSheetSync', { eventId: el.dataset.id }, 'Đã cập nhật sheet đăng ký.');
function sessForm(e, x) {
  x = x || {};
  modal(x.id ? 'Sửa buổi' : 'Thêm buổi', `<div class="form">
    <div class="eco-field"><label>Tên buổi</label><input class="eco-input" id="sfName" value="${attr(x.ten || '')}" placeholder="Ví dụ: Log 1 · chuẩn bị đạo cụ" autofocus></div>
    <div class="row nowrap"><div class="eco-field grow"><label>Ngày</label><input class="eco-input" type="date" id="sfDate" value="${x.thoiDiem ? x.thoiDiem.slice(0, 10) : ''}"></div><div class="eco-field" style="width:130px"><label>Giờ</label><input class="eco-input" type="time" id="sfTime" value="${x.thoiDiem ? x.thoiDiem.slice(11, 16) : '16:45'}"></div></div>
    <div class="seg"><button type="button" class="${x.thoiLuong !== 180 ? 'is-active' : ''}" data-act="sfDur" data-v="90">90 phút · 1 buổi</button><button type="button" class="${x.thoiLuong === 180 ? 'is-active' : ''}" data-act="sfDur" data-v="180">180 phút · 2 buổi</button></div>
  </div><div class="actions">${x.id ? '<button class="eco-btn eco-btn--danger" id="sfDel">Xóa buổi</button>' : ''}<button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="sfSave">Lưu</button></div>`);
  App.ui.sfDur = x.thoiLuong === 180 ? 180 : 90;
  document.getElementById('sfSave').onclick = async () => {
    try { await act('sessionSave', { eventId: e.id, id: x.id, ten: document.getElementById('sfName').value, thoiDiem: document.getElementById('sfDate').value + ' ' + document.getElementById('sfTime').value, thoiLuong: App.ui.sfDur }, 'Đã lưu buổi.'); closeModal(); } catch (err) { }
  };
  const d = document.getElementById('sfDel');
  if (d) d.onclick = () => confirmBox('Xóa buổi?', 'Chỉ xóa được buổi chưa điểm danh.', 'Xóa', () => act('sessionDelete', { id: x.id }, 'Đã xóa buổi.'));
}
H.sfDur = el => { App.ui.sfDur = +el.dataset.v; el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === el)); };
H.sessNew = el => sessForm(App.idx.ev[el.dataset.ev]);
H.sessEdit = el => { const x = App.idx.sess[el.dataset.id]; sessForm(App.idx.ev[x.eventId], x); };
H.planOpen = el => {
  const x = App.idx.sess[el.dataset.id], k = x.keHoach || {};
  const sts = ['Chưa có kế hoạch', 'Chưa làm', 'Dang dở', 'Hoàn thành', 'Đã hủy'];
  modal('Kế hoạch · ' + x.ten, `<div class="form"><div class="eco-field"><label>Mục tiêu</label><textarea class="eco-input" id="plGoal">${esc(k.mucTieu || '')}</textarea></div>
    <div class="eco-field"><label>Trạng thái</label><select class="eco-input" id="plSt">${sts.map(s => `<option ${(k.trangThai || 'Chưa có kế hoạch') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="eco-field"><label>Ảnh sản phẩm (link Drive / album)</label><input class="eco-input" id="plImg" value="${attr(k.anh || '')}"></div></div>
    <div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="plSave">Lưu</button></div>`);
  document.getElementById('plSave').onclick = async () => { try { await act('planSave', { sessionId: x.id, keHoach: { mucTieu: document.getElementById('plGoal').value, trangThai: document.getElementById('plSt').value, anh: document.getElementById('plImg').value } }, 'Đã lưu kế hoạch.'); closeModal(); } catch (e) { } };
};

/* ================= P-44 Điểm danh ================= */
route('diem-danh', {
  can: () => isBod(),
  render(sid) {
    const s = App.state;
    if (sid) return attendPage(sid);
    const today = nowVN().slice(0, 10);
    const open = s.events.filter(e => e.log.trangThai === 'mo');
    const all = open.flatMap(e => e.sessions.map(x => Object.assign({ ev: e }, x)));
    const td = all.filter(x => x.thoiDiem.slice(0, 10) === today);
    const recent = all.filter(x => x.thoiDiem.slice(0, 10) < today).sort((a, b) => tms(b.thoiDiem) - tms(a.thoiDiem)).slice(0, 12);
    const upcoming = all.filter(x => x.thoiDiem.slice(0, 10) > today).slice(0, 6);
    const row = x => `<a href="#/diem-danh/${x.id}"><div class="li-main"><b>${esc(x.ten)}</b><span class="sub">${esc(x.ev.ten)} · ${esc(fDT(x.thoiDiem))} · ${x.thoiLuong}'</span></div>${x.count ? tag(x.count + ' người', 'done') : tag('Chưa điểm danh')}</a>`;
    let html = topbar('Điểm danh');
    html += `<section class="eco-card"><h2>Buổi hôm nay</h2>${td.length ? `<div class="eco-list">${td.map(row).join('')}</div>` : '<p class="muted">Hôm nay không có buổi log nào.</p>'}</section>`;
    html += `<section class="eco-card"><h2>Buổi gần đây</h2><p class="small muted">Điểm danh bổ sung khi có người bị sót.</p>${recent.length ? `<div class="eco-list">${recent.map(row).join('')}</div>` : '<p class="muted">Không có.</p>'}</section>`;
    if (upcoming.length) html += `<section class="eco-card"><h2>Sắp tới</h2><div class="eco-list">${upcoming.map(row).join('')}</div></section>`;
    if (!open.length) html += empty('Chưa có đợt log nào đang mở. Thiết lập log trong trang Sự kiện.');
    return html;
  }
});
function attendPage(sid) {
  const x = App.idx.sess[sid];
  if (!x) return topbar('Điểm danh', { back: '#/diem-danh' }) + empty('Không tìm thấy buổi.');
  const e = App.idx.ev[x.eventId];
  const have = App.state.attendance.filter(a => a.buoiId === sid);
  const sel = have.map(a => a.memberId);
  const isCancel = App.ui.adCancel === sid || have.some(a => a.loai === 'huy-khac');
  const saves = new Set(have.map(a => a.luc)).size;
  let html = topbar(x.ten, { back: '#/diem-danh' });
  html += `<p class="muted">${esc(e.ten)} · ${esc(fDT(x.thoiDiem))} · ${x.thoiLuong} phút${x.thoiLuong === 180 ? ' (tính 2 buổi)' : ''}</p>`;
  if (e.log.trangThai === 'chot') return html + banner('Đợt log đã chốt. Mở chốt lại ở trang chốt nếu cần sửa điểm danh.');
  html += `<div class="seg"><button class="${!isCancel ? 'is-active' : ''}" data-act="set" data-k="adCancel" data-v="">Điểm danh</button><button class="${isCancel ? 'is-active' : ''}" data-act="set" data-k="adCancel" data-v="${sid}">Hủy buổi vì lý do khác</button></div>`;
  if (isCancel) html += `<section class="eco-card"><p>Mở sheet đăng ký xem ai đã đăng ký buổi này, rồi tick những người đó. Họ được tính là đã tham gia, và buổi được tính là đã diễn ra. Sau đó báo hủy trên Messenger.</p>
    <div class="eco-field"><label>Lý do</label><input class="eco-input" id="adWhy" value="${attr(x.huyLyDo || '')}" placeholder="Ví dụ: trường đột xuất đóng cửa"></div>${e.log.sheetUrl ? `<a class="eco-btn" href="${attr(e.log.sheetUrl)}" target="_blank" rel="noopener">Mở sheet đăng ký ${ic('ext', 'sm')}</a>` : ''}</section>`;
  html += `<section class="eco-card">${picker('pkAtt', activeMembers(), sel, { height: 2000, noGroups: true })}</section>`;
  html += `<div class="stickybar"><span class="grow">Đã tick <b id="adN">${sel.length}</b>${saves ? ' · đã lưu ' + saves + ' lần' : ''}</span><button class="eco-btn eco-btn--filled" data-act="attendSave" data-id="${sid}">${isCancel ? 'Lưu (hủy buổi)' : 'Lưu điểm danh'}</button></div>`;
  return html;
}
H.pkAfter_pkAtt = () => { const n = document.getElementById('adN'); if (n) n.textContent = pickerVal('pkAtt').length; };
H.attendSave = el => {
  const cancel = !!document.getElementById('adWhy');
  act('attendSave', { sessionId: el.dataset.id, memberIds: pickerVal('pkAtt'), huyKhac: cancel, lyDo: cancel ? document.getElementById('adWhy').value : '' }, 'Đã lưu điểm danh.');
};

/* ================= P-45 Chốt đợt log ================= */
route('chot', {
  can: () => isBod(), nav: 'su-kien',
  render(eid) {
    const e = App.idx.ev[eid];
    if (!e) return topbar('Chốt log', { back: '#/su-kien' }) + empty('Không tìm thấy sự kiện.');
    const s = App.state, l = e.log, closed = l.trangThai === 'chot';
    const mem = activeMembers();
    const rows = mem.map(m => { const k = (s.kpi[m.id] || { logs: [] }).logs.find(x => x.eventId === eid); return k ? { m, k } : null; }).filter(Boolean);
    const extraOf = r => Math.max(0, r.k.attended - Math.floor(r.k.final + 1e-9));
    const f = App.ui.chotF || '';
    const vis = rows.filter(r => !f || (f === 'thieu' ? r.k.attended < r.k.final : extraOf(r) > 0));
    const sessUnits = e.sessions.reduce((a, x) => a + unitsOf(x), 0);
    const n90 = e.sessions.filter(x => x.thoiLuong !== 180).length, n180 = e.sessions.filter(x => x.thoiLuong === 180).length;
    const groups = {};
    rows.forEach(r => { const key = fmtN(r.k.initial); (groups[key] = groups[key] || []).push(r); });
    let html = topbar('Chốt log · ' + e.ten, { back: '#/su-kien/' + eid });
    html += `<section class="eco-card"><h2>Tóm tắt</h2><div class="kv"><span>Dự kiến</span><span>${n90} buổi 90' + ${n180} buổi 180' = <b>${sessUnits}</b> buổi (quy 90 phút)</span><span>Thực diễn ra</span><b>${l.held} buổi</b></div><p class="small muted">Buổi chưa điểm danh không tính là đã diễn ra.</p></section>`;
    html += `<section class="eco-card"><h2>Số buổi được giao cuối</h2><div class="eco-list">${Object.keys(groups).map(q => `<div><div class="li-main">Giao ban đầu ${q} buổi <span class="sub">${groups[q].length} người</span></div><span class="num">${l.held} × ${q} ÷ ${l.planned} = <b>${fmtN(l.planned ? Math.min(+q.replace(',', '.'), l.held * +q.replace(',', '.') / l.planned) : 0)}</b></span></div>`).join('')}</div><p class="small muted">Giữ số lẻ cho KPI Log. Điểm log vượt tính theo số buổi được giao cuối làm tròn xuống: ví dụ giao cuối 1,17 → 1; dự 3 buổi → vượt 2 buổi → +40 điểm.</p></section>`;
    html += `<div class="chips"><button class="eco-chip ${!f ? 'is-active' : ''}" data-act="set" data-k="chotF" data-v="">Tất cả</button><button class="eco-chip ${f === 'thieu' ? 'is-active' : ''}" data-act="set" data-k="chotF" data-v="thieu">Chưa đủ</button><button class="eco-chip ${f === 'vuot' ? 'is-active' : ''}" data-act="set" data-k="chotF" data-v="vuot">Có log vượt</button></div>`;
    html += `<section class="eco-card" style="padding:4px 16px"><div class="tablewrap"><table class="eco-table"><thead><tr><th>Thành viên</th><th class="num">Giao cuối</th><th class="num">Đã dự</th><th class="num">Vượt</th><th class="num">Điểm</th></tr></thead><tbody>${sortMembers(vis.map(r => r.m)).map(m => { const r = vis.find(v => v.m === m); const ex = extraOf(r); return `<tr><td>${esc(m.hoTen)}<div class="small muted">${esc(banLabel(m))}</div></td><td class="num">${fmtN(r.k.final)}</td><td class="num">${fmtN(r.k.attended)}</td><td class="num">${ex || ''}</td><td class="num">${ex ? '+' + ex * 20 : ''}</td></tr>`; }).join('')}</tbody></table></div></section>`;
    html += closed
      ? `<div class="stickybar"><span class="grow">Đã chốt bởi ${esc(l.chotBoi)} · ${esc(fDT(l.chotLuc))}</span><button class="eco-btn" data-act="logReopen" data-id="${eid}">Mở chốt lại</button></div>`
      : `<div class="stickybar"><span class="grow">${rows.filter(r => extraOf(r) > 0).length} người có log vượt</span><button class="eco-btn eco-btn--filled" data-act="logClose" data-id="${eid}">Chốt và cộng điểm</button></div>`;
    return html;
  }
});
H.logClose = el => confirmBox('Chốt đợt log?', 'App tính số buổi được giao cuối, đưa vào KPI và cộng điểm log vượt ngay. Mở chốt lại được nếu cần sửa.', 'Chốt và cộng điểm', () => act('logClose', { eventId: el.dataset.id }, 'Đã chốt đợt log.'));
H.logReopen = el => confirmBox('Mở chốt lại?', 'Điểm log vượt đã cộng sẽ được gỡ và tính lại khi chốt lần nữa. Việc mở chốt được ghi nhật ký.', 'Mở chốt lại', () => act('logReopen', { eventId: el.dataset.id }, 'Đã mở chốt.'));

/* ================= P-40 Tổng quan ================= */
route('tong-quan', {
  can: () => isBod(), wide: true,
  render() {
    const s = App.state, ui = App.ui;
    const fb = ui.tqBan || '', fk = ui.tqKhoi || '', fl = ui.tqLoai || '', fe = ui.tqEv || '';
    let mem = activeMembers().filter(m => (!fb || m.ban === fb) && (!fk || m.khoi === fk) && (!fl || m.loai === fl));
    const late = [];
    s.tasks.filter(t => !t.huy && (!fe || t.eventId === fe)).forEach(t => t.assignees.forEach(a => { if ((a.st === 'qua-han' || a.st === 'khong-lam') && mem.concat(s.members.filter(m => m.ban === 'BOD')).some(m => m.id === a.memberId)) late.push({ t, a }); }));
    const rk = rankNow();
    const rkMap = Object.fromEntries(rk.rows.map(r => [r.id, r]));
    const khois = [...new Set(activeMembers().map(m => m.khoi).filter(Boolean))].sort();
    const sortK = ui.tqSort || 'name';
    const rowsData = mem.map(m => ({ m, k: s.kpi[m.id] || {}, r: rkMap[m.id] || {} }));
    const sorters = { name: (a, b) => a.m.hoTen.localeCompare(b.m.hoTen, 'vi'), log: (a, b) => (a.k.logPct ?? 999) - (b.k.logPct ?? 999), task: (a, b) => (a.k.taskPct ?? 999) - (b.k.taskPct ?? 999), diem: (a, b) => (b.r.score || 0) - (a.r.score || 0) };
    rowsData.sort(sorters[sortK]);
    const sel = (k, label, opts) => `<select class="eco-input sm" data-change="tqSet" data-k="${k}" style="width:auto"><option value="">${label}</option>${opts.map(([v, l]) => `<option value="${v}" ${ui[k] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    let html = topbar('Tổng quan');
    if (s.term.ghiNhan === 'tat') html += banner('Đang <b>tắt ghi nhận KPI và điểm</b> (ví dụ giai đoạn giao thoa). Bật lại trong Cài đặt.');
    html += `<div class="row">${sel('tqBan', 'Mọi ban', s.settings.coCau.filter(b => b.ma !== 'BOD').map(b => [b.ma, 'Ban ' + b.ma]))}${sel('tqKhoi', 'Mọi khối', khois.map(k => [k, 'Khối ' + k]))}${sel('tqLoai', 'Mọi nhóm', [['chinh-thuc', 'Chính thức'], ['bo-sung', 'Bổ sung']])}${sel('tqEv', 'Mọi sự kiện', s.events.map(e => [e.id, e.ten]))}</div>`;
    html += `<div class="grid3"><button class="stat ${ui.tqView !== 'late' ? 'is-active' : ''}" data-act="set" data-k="tqView" data-v=""><div class="label">Thành viên</div><div class="big">${mem.length}</div></button><button class="stat ${ui.tqView === 'late' ? 'is-active' : ''}" data-act="set" data-k="tqView" data-v="late"><div class="label">Task trễ hạn</div><div class="big">${late.length}</div></button>${s.mailPending ? `<a class="stat" href="#/duyet-thu" style="text-decoration:none"><div class="label">Thư UCV chờ duyệt</div><div class="big">${s.mailPending}</div></a>` : ''}</div>`;
    if (late.length) html += `<section class="eco-card"><h2>Task trễ hạn</h2><div class="eco-list">${late.sort((x, y) => tms(x.t.hanChot) - tms(y.t.hanChot)).slice(0, ui.tqView === 'late' ? 500 : 6).map(({ t, a }) => { const m = App.idx.m[a.memberId] || {}; return `<a href="#/task/${t.id}"><div class="li-main"><b class="ellipsis">${esc(t.ten)}</b><span class="sub">${esc(m.hoTen)} · ${esc(banLabel(m))} · ${esc(evName(t.eventId))} · ${rel(t.hanChot)}</span></div>${stTag(a)}</a>`; }).join('')}</div>${late.length > 6 && ui.tqView !== 'late' ? `<button class="eco-btn" data-act="set" data-k="tqView" data-v="late">Xem tất cả ${late.length}</button>` : ''}</section>`;
    const th = (k, l, cls) => `<th class="sort ${cls || ''}" data-act="set" data-k="tqSort" data-v="${k}">${l}${sortK === k ? ' ▾' : ''}</th>`;
    html += `<section class="eco-card" style="padding:4px 16px"><div class="tablewrap"><table class="eco-table"><thead><tr>${th('name', 'Thành viên')}<th class="dk">Lớp</th><th class="dk">Nhóm</th>${th('log', 'KPI Log', 'num')}${th('task', 'KPI Task', 'num')}${th('diem', 'Điểm GĐ' + rk.phase, 'num')}<th class="num">Hạng</th></tr></thead><tbody>${rowsData.map(({ m, k, r }) => `<tr class="click" data-act="goMember" data-id="${m.id}"><td><div class="row nowrap">${avatar(m, 'sm')}<div class="grow"><div class="ellipsis">${esc(m.hoTen)}</div><div class="small muted">${esc(banLabel(m))}</div></div></div></td><td class="dk">${esc(m.lop || '')}</td><td class="dk">${m.loai === 'bo-sung' ? 'Bổ sung' : 'Chính thức'}</td><td class="num">${pct(k.logPct)}</td><td class="num">${pct(k.taskPct)}</td><td class="num">${r.score ?? '–'}</td><td class="num">${r.rank ?? '–'}${r.top ? ' ★' : ''}</td></tr>`).join('')}</tbody></table></div></section>`;
    return html;
  }
});
H.tqSet = el => { App.ui[el.dataset.k] = el.value; render(); };
H.goMember = el => go('#/thanh-vien/' + el.dataset.id);

/* ================= P-41 Chi tiết thành viên (trong route thanh-vien/:id) ================= */
function memberDetail(id) {
  const s = App.state, m = App.idx.m[id];
  if (!m) return topbar('Thành viên', { back: '#/thanh-vien' }) + empty('Không tìm thấy thành viên.');
  const k = s.kpi[id] || { logs: [], tasks: [] };
  const cert = (s.certificates || []).find(c => c.id === id);
  const rk = rankNow(), r = rk.rows.find(x => x.id === id);
  const tab = App.ui.mdTab || 'task';
  let html = topbar(m.hoTen, { back: '#/thanh-vien', right: `<button class="eco-btn eco-btn--sm" data-act="resetPw" data-id="${id}">Đặt lại mật khẩu</button>` });
  html += `<div class="grid2"><section class="eco-card"><div class="row nowrap">${avatar(m, 'lg')}<div class="grow"><h2>${esc(m.hoTen)}</h2><div class="muted">${esc(banLabel(m))} · Lớp ${esc(m.lop || '')}</div></div></div>
    <div class="kv small"><span>Nhóm</span><span>${m.ban === 'BOD' ? 'BOD' : m.loai === 'bo-sung' ? 'Bổ sung' : 'Chính thức'} · gia nhập ${esc({ OD: 'Oday', D1: 'Đợt 1', D2: 'Đợt 2', CU: 'trước khi dùng app' }[m.dot] || m.dot || '')} ${esc(m.nhiemKyVao || '')}</span><span>Tên Facebook</span><span>${m.linkFb ? `<a href="${attr(m.linkFb)}" target="_blank" rel="noopener">${esc(m.tenFb)}</a>` : esc(m.tenFb)}</span><span>Email</span><span>${esc(m.email)}</span><span>SĐT</span><span>${esc(m.sdt || '')}</span><span>Ngày sinh</span><span>${esc(m.ngaySinh)}</span><span>Nhãn</span><span>${[m.ucv === 'co' ? 'UCV' : '', m.core === 'co' ? 'Core team' : '', m.nsBan ? 'NS phụ trách ' + m.nsBan : '', m.nsSeeding === 'co' ? 'NS seeding' : ''].filter(Boolean).join(', ') || '–'}</span><span>Vào app</span><span>${m.daVao ? 'Đã vào' : 'Chưa vào'}</span></div></section>`;
  if (m.ban !== 'BOD') html += `<section class="eco-card">${kpiBars(k)}<div class="row"><span>Điểm GĐ${rk.phase}: <b>${r ? r.score : 0}</b></span><span>Hạng ${r ? r.rank + '/' + rk.total : '–'}</span></div>${kpiForecast(k)}${cert ? `<p class="small">Certificate nếu tổng kết hôm nay: <b>${{ thang: 'cấp thẳng', 'bu-tru': 'cấp nhờ bù trừ', chua: 'chưa cấp' }[cert.kq]}</b></p>` : ''}</section>`;
  html += '</div>';
  html += `<div class="tabs">${[['task', 'Task'], ['log', 'Log'], ['diem', 'Điểm']].map(([v, l]) => `<button class="${tab === v ? 'is-active' : ''}" data-act="set" data-k="mdTab" data-v="${v}">${l}</button>`).join('')}</div>`;
  if (tab === 'task') {
    const ts = s.tasks.filter(t => t.assignees.some(a => a.memberId === id));
    html += ts.length ? `<section class="eco-card"><div class="eco-list">${ts.map(t => taskRow(t, t.assignees.find(a => a.memberId === id))).join('')}</div></section>` : empty('Chưa có task.');
  } else if (tab === 'log') {
    html += k.logs.length ? `<section class="eco-card" style="padding:4px 16px"><table class="eco-table"><thead><tr><th>Sự kiện</th><th class="num">Giao</th><th class="num">Đã dự</th><th class="num">Vượt</th></tr></thead><tbody>${k.logs.map(l => `<tr><td>${esc(evName(l.eventId))}${l.closed ? '' : ' <span class="small muted">(đang mở)</span>'}</td><td class="num">${fmtN(l.closed ? l.final : l.initial)}</td><td class="num">${fmtN(l.attended)}</td><td class="num">${l.extra || ''}</td></tr>`).join('')}</tbody></table></section>` : empty('Chưa có log.');
  } else {
    const ps = s.points.filter(p => p.memberId === id);
    html += ps.length ? `<section class="eco-card"><div class="eco-list">${ps.map(p => `<div><div class="li-main"><b>${esc(p.chiTiet)}</b><span class="sub">${esc(fD(p.luc))} · GĐ${esc(p.giaiDoan)} · ${esc(p.boi)}</span></div><b class="num">+${p.diem}</b></div>`).join('')}</div></section>` : empty('Chưa có điểm.');
  }
  return html;
}
H.resetPw = el => confirmBox('Đặt lại mật khẩu?', 'Mật khẩu của ' + esc(mName(el.dataset.id)) + ' sẽ trở về mật khẩu mặc định của CLB. Các phiên đăng nhập hiện tại bị đăng xuất.', 'Đặt lại', () => act('resetPassword', { memberId: el.dataset.id }, 'Đã đặt lại mật khẩu về mặc định.'));

/* ================= P-46 Cộng điểm ================= */
route('cong-diem', {
  can: () => isBod(),
  render() {
    const s = App.state;
    const cat = s.catalog.filter(c => !c.tuDong);
    let html = topbar('Cộng điểm');
    if (s.term.ghiNhan === 'tat') html += banner('Đang tắt ghi nhận KPI và điểm: điểm cộng lúc này được lưu nhưng <b>không tính</b>.');
    html += `<section class="eco-card"><div class="eco-field"><label>Hoạt động</label><select class="eco-input" id="cdCat" data-change="cdUpd">${cat.map(c => `<option value="${c.id}" data-d="${c.diem}">${esc(c.ten)} · +${c.diem}</option>`).join('')}</select><span class="hint">Seeding, log vượt, góp ý được cộng tự động nên không có ở đây. Thêm hoạt động mới trong Cài đặt (phải công bố mức điểm trước).</span></div>
      <div class="eco-field"><label>Sự kiện <span class="muted">(không bắt buộc)</span></label><select class="eco-input" id="cdEv"><option value="">Không gắn sự kiện</option>${s.events.map(e => `<option value="${e.id}">${esc(e.ten)}</option>`).join('')}</select></div>
      <div class="eco-field"><label>Ghi chú <span class="muted">(không bắt buộc)</span></label><input class="eco-input" id="cdNote" placeholder="Ví dụ: Bonding tháng 10"></div>
      <div class="eco-field"><span class="lbl">Thành viên</span>${picker('pkPts', activeMembers(), [])}</div></section>`;
    html += `<div class="stickybar"><span class="grow" id="cdSum">Chọn thành viên</span><button class="eco-btn eco-btn--filled" data-act="cdGo">Cộng điểm</button></div>`;
    const hist = s.points.filter(p => p.nguon === 'bod' && (!App.ui.cdEvF || p.eventId === App.ui.cdEvF)).slice(0, App.ui.cdMore ? 1000 : 40);
    html += `<section class="eco-card"><div class="head"><h2>Lịch sử cộng</h2><select class="eco-input sm" style="width:auto" data-change="tqSet" data-k="cdEvF"><option value="">Mọi sự kiện</option>${s.events.map(e => `<option value="${e.id}" ${App.ui.cdEvF === e.id ? 'selected' : ''}>${esc(e.ten)}</option>`).join('')}</select></div>
      ${hist.length ? `<div class="eco-list">${hist.map(p => `<div><div class="li-main"><b>${esc(mName(p.memberId))} · +${p.diem}</b><span class="sub">${esc(p.chiTiet)} · ${esc(fDT(p.luc))} · ${esc(p.boi)}${p.eventId ? ' · ' + esc(evName(p.eventId)) : ''}</span></div><button class="eco-btn eco-btn--sm" data-act="ptCancel" data-id="${p.id}">Hủy dòng</button></div>`).join('')}</div>${!App.ui.cdMore ? '<button class="eco-btn" data-act="toggle" data-k="cdMore">Xem thêm</button>' : ''}` : '<p class="muted">Chưa có.</p>'}<p class="small muted">Chỉ cộng, không trừ. Cộng nhầm thì hủy dòng (có ghi nhật ký).</p></section>`;
    return html;
  },
  after() { H.cdUpd(); }
});
H.cdUpd = () => {
  const sel = document.getElementById('cdCat'); if (!sel || !sel.selectedOptions[0]) return;
  const d = +sel.selectedOptions[0].dataset.d, n = pickerVal('pkPts').length;
  document.getElementById('cdSum').innerHTML = n ? `${esc(sel.selectedOptions[0].text.split(' · ')[0])} · +${d} × ${n} người = <b>${d * n} điểm</b>` : 'Chọn thành viên';
};
H.pkAfter_pkPts = H.cdUpd;
H.cdGo = async () => {
  const ids = pickerVal('pkPts');
  if (!ids.length) return toast('Chọn ít nhất một thành viên.', true);
  await act('pointsAdd', { catalogId: document.getElementById('cdCat').value, memberIds: ids, eventId: document.getElementById('cdEv').value, chiTiet: document.getElementById('cdNote').value }, 'Đã cộng điểm.');
};
H.ptCancel = el => confirmBox('Hủy dòng cộng điểm?', 'Dòng này sẽ không còn được tính. Việc hủy được ghi nhật ký.', 'Hủy dòng', () => act('pointsCancel', { id: el.dataset.id }, 'Đã hủy.'));

/* ================= P-47 Hộp góp ý ================= */
route('hop-gop-y', {
  can: () => isBod(),
  render() {
    const s = App.state, f = App.ui.hgF || '';
    const list = s.feedback.filter(g => !f || (f === 'ten' ? g.memberId : f === 'an' ? !g.memberId : g.apDung));
    let html = topbar('Hộp góp ý');
    html += `<div class="chips">${[['', 'Tất cả'], ['ten', 'Có tên'], ['an', 'Ẩn danh'], ['ap', 'Đã áp dụng']].map(([k, l]) => `<button class="eco-chip ${f === k ? 'is-active' : ''}" data-act="set" data-k="hgF" data-v="${k}">${l}</button>`).join('')}</div>`;
    html += list.length ? list.map(g => {
      const used = g.memberId ? s.points.filter(p => p.memberId === g.memberId && p.nguon === 'gop-y' && p.giaiDoan === g.giaiDoan).length : 0;
      return `<section class="eco-card"><div class="head"><span class="small muted">${g.memberId ? esc(mName(g.memberId)) + ' · ' + esc(banLabel(App.idx.m[g.memberId])) : 'Ẩn danh'} · ${esc(fD(g.luc))}</span>${g.apDung ? tag('Đã áp dụng', 'done') : ''}</div><p style="white-space:pre-wrap">${esc(g.noiDung)}</p>
        ${g.memberId && !g.apDung ? `<div class="row"><button class="eco-btn" data-act="gyApply" data-id="${g.id}">Đánh dấu đã áp dụng · +10</button>${used >= 2 ? '<span class="small muted">Người gửi đã đủ 2 lần trong giai đoạn: đánh dấu nhưng không cộng điểm.</span>' : `<span class="small muted">Đã cộng ${used}/2 lần trong giai đoạn</span>`}</div>` : ''}
        ${g.apDung ? `<span class="small muted">Áp dụng bởi ${esc(g.apDungBoi)} · ${esc(fD(g.apDungLuc))}</span>` : ''}${!g.memberId ? '<span class="small muted">Góp ý ẩn danh chỉ để đọc.</span>' : ''}</section>`;
    }).join('') : empty('Chưa có góp ý.');
    return html;
  }
});
H.gyApply = el => act('feedbackApply', { id: el.dataset.id }, 'Đã đánh dấu áp dụng.');

/* ================= P-30 Task các ban ================= */
route('task-ban', {
  can: () => isBod() || isNs(),
  render() {
    const s = App.state, bod = isBod();
    const bans = bod ? s.settings.coCau.map(b => b.ma) : R().ns;
    const fb = App.ui.tbBan || '', fe = App.ui.tbEv || '', late = App.ui.tbLate === '1';
    let html = topbar('Task các ban', { right: `<button class="eco-btn eco-btn--sm" data-act="taskNew">${ic('plus', 'sm')} Nhập task</button>` });
    if (!bod) html += `<p class="muted">Bạn phụ trách: ${bans.map(b => 'Ban ' + esc(b)).join(', ')}</p>`;
    html += `<div class="row"><select class="eco-input sm" style="width:auto" data-change="tqSet" data-k="tbBan"><option value="">Mọi ban</option>${bans.map(b => `<option value="${b}" ${fb === b ? 'selected' : ''}>Ban ${b}</option>`).join('')}</select><select class="eco-input sm" style="width:auto" data-change="tqSet" data-k="tbEv"><option value="">Mọi sự kiện</option>${s.events.map(e => `<option value="${e.id}" ${fe === e.id ? 'selected' : ''}>${esc(e.ten)}</option>`).join('')}</select><button class="eco-chip ${late ? 'is-active' : ''}" data-act="set" data-k="tbLate" data-v="${late ? '' : '1'}">Trễ hạn</button></div>`;
    const cards = bans.filter(b => !fb || b === fb).map(b => {
      const ts = s.tasks.filter(t => !t.huy && (!fe || t.eventId === fe) && t.assignees.some(a => (App.idx.m[a.memberId] || {}).ban === b) && (!late || t.assignees.some(a => a.st === 'qua-han' || a.st === 'khong-lam'))).sort((x, y) => tms(y.hanChot) - tms(x.hanChot));
      return `<section class="eco-card"><h2>${b === 'BOD' ? 'BOD' : 'Ban ' + esc(b)} <span class="muted">(${ts.length})</span></h2>${ts.length ? `<div class="eco-list">${taskListRows(ts.slice(0, App.ui['tbAll' + b] ? 999 : 8))}</div>${ts.length > 8 && !App.ui['tbAll' + b] ? `<button class="eco-btn" data-act="toggle" data-k="tbAll${b}">Xem thêm ${ts.length - 8}</button>` : ''}` : '<p class="muted">Không có task.</p>'}</section>`;
    });
    html += `<div class="grid2">${cards.join('')}</div>`;
    return html;
  }
});

/* ================= P-31 Danh sách cần nhắc ================= */
route('can-nhac', {
  can: () => !isBod() && isNs(),
  render() {
    const s = App.state, tab = App.ui.cnTab || 'sap';
    const bans = R().ns;
    const soonLim = Date.now() + 2 * 86400e3;
    let html = topbar('Danh sách cần nhắc');
    html += `<div class="tabs"><button class="${tab === 'sap' ? 'is-active' : ''}" data-act="set" data-k="cnTab" data-v="sap">Sắp đến hạn</button><button class="${tab === 'qua' ? 'is-active' : ''}" data-act="set" data-k="cnTab" data-v="qua">Quá hạn</button></div>`;
    html += `<p class="small muted">Cập nhật lúc ${esc(fDT(s.now))}. Bạn tự nhắn nhắc trên Messenger cho chân thật, thân thiện nhé.</p>`;
    bans.forEach(b => {
      const rows = [];
      s.tasks.filter(t => !t.huy).forEach(t => t.assignees.forEach(a => {
        const m = App.idx.m[a.memberId];
        if (!m || m.ban !== b) return;
        if (tab === 'sap' ? (a.st === 'sap-han' && tms(t.hanChot) <= soonLim) : a.st === 'qua-han') rows.push({ t, a, m });
      }));
      rows.sort((x, y) => tms(x.t.hanChot) - tms(y.t.hanChot));
      html += `<section class="eco-card"><h2>Ban ${esc(b)} <span class="muted">(${rows.length})</span></h2>${rows.length ? `<div class="tablewrap"><table class="eco-table"><thead><tr><th>Task</th><th>Người được giao</th><th>Hạn</th><th>Tên Facebook</th><th>Lớp</th></tr></thead><tbody>${rows.map(({ t, m }) => `<tr><td><a href="#/task/${t.id}">${esc(t.ten)}</a></td><td>${esc(m.hoTen)}</td><td style="white-space:nowrap">${esc(fDT(t.hanChot))}<div class="small muted">${rel(t.hanChot)}</div></td><td>${esc(m.tenFb || '')}</td><td>${esc(m.lop || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Không có.</p>'}</section>`;
    });
    return html;
  }
});

/* ================= P-35 / P-36 Seeding ================= */
route('seeding', {
  can: () => R().seeding || isBod(), wide: true,
  render(id) {
    if (id) return seedingRecordPage(id);
    const s = App.state, list = s.seeding || [];
    const wait = list.filter(x => x.trangThai === 'cho').sort((a, b) => tms(a.nhacLuc) - tms(b.nhacLuc));
    const done = list.filter(x => x.trangThai === 'xong');
    const days = +s.settings.nhacSeedingSauNgay || 2;
    let html = topbar('Seeding', isBod() ? { back: '#/cai-dat' } : {});
    html += `<section class="eco-card"><h2>Đặt nhắc hẹn</h2><p class="small muted">Ngay trong ngày bài được đăng: dán link bài rồi bấm Đặt nhắc hẹn. App nhắc bạn sau ${days} ngày (${esc(fDT(new Date(Date.now() + days * 86400e3 + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')))}).</p>
      <div class="row nowrap"><input class="eco-input" id="sdLink" placeholder="https://www.facebook.com/…"><button class="eco-btn eco-btn--filled" data-act="sdAdd">Đặt nhắc hẹn</button></div></section>`;
    html += `<section class="eco-card"><h2>Chờ ghi nhận <span class="muted">(${wait.length})</span></h2>${wait.length ? `<div class="eco-list">${wait.map(x => `<div><div class="li-main"><a class="ellipsis" style="display:block" href="${attr(x.link)}" target="_blank" rel="noopener">${esc(x.link)}</a><span class="sub">Đặt ${esc(fDT(x.taoLuc))} · ${tms(x.nhacLuc) <= Date.now() ? '<b>đến hạn ghi nhận</b>' : 'nhắc ' + esc(fDT(x.nhacLuc))}</span></div><a class="eco-btn ${tms(x.nhacLuc) <= Date.now() ? 'eco-btn--filled' : ''}" href="#/seeding/${x.id}">Ghi nhận</a><button class="eco-btn eco-btn--sm" data-act="sdDel" data-id="${x.id}">Xóa</button></div>`).join('')}</div>` : '<p class="muted">Không có.</p>'}</section>`;
    html += `<section class="eco-card"><h2>Đã ghi nhận</h2>${done.length ? `<div class="eco-list">${done.slice(0, 50).map(x => `<div><div class="li-main"><a class="ellipsis" style="display:block" href="${attr(x.link)}" target="_blank" rel="noopener">${esc(x.link)}</a><span class="sub">${esc(fDT(x.ghiNhanLuc))} · ${x.soReact} react · ${x.soComment} comment · ${x.soNguoi} người được cộng</span></div></div>`).join('')}</div>` : '<p class="muted">Chưa có.</p>'}</section>`;
    return html;
  }
});
H.sdAdd = async () => { await act('seedingAdd', { link: document.getElementById('sdLink').value }, 'Đã đặt nhắc hẹn.'); };
H.sdDel = el => confirmBox('Xóa bài này?', 'Bài sẽ bị xóa khỏi danh sách chờ ghi nhận.', 'Xóa', () => act('seedingDelete', { id: el.dataset.id }));

function seedingRecordPage(id) {
  const post = (App.state.seeding || []).find(x => x.id === id);
  if (!post) return topbar('Ghi nhận seeding', { back: '#/seeding' }) + empty('Không tìm thấy bài.');
  const ui = App.ui.sd && App.ui.sd.id === id ? App.ui.sd : (App.ui.sd = { id, react: '', comment: '', result: null });
  let html = topbar('Ghi nhận seeding', { back: '#/seeding' });
  html += `<p class="small"><a href="${attr(post.link)}" target="_blank" rel="noopener">${esc(post.link)} ${ic('ext', 'sm')}</a></p>`;
  if (post.trangThai === 'xong') return html + banner('Bài này đã được ghi nhận.');
  html += `<div class="grid2"><section class="eco-card"><h2>Reaction</h2><p class="small muted">Mở danh sách người react, bôi đen toàn bộ (cả biểu tượng) rồi dán vào đây.</p><textarea class="eco-input" id="sdR" style="min-height:220px" data-input="sdCount">${esc(ui.react)}</textarea><span class="small muted" id="sdRn"></span></section>
    <section class="eco-card"><h2>Comment</h2><p class="small muted">Mở hết comment, bôi đen toàn bộ tên và nội dung rồi dán vào đây.</p><textarea class="eco-input" id="sdC" style="min-height:220px" data-input="sdCount">${esc(ui.comment)}</textarea><span class="small muted" id="sdCn"></span></section></div>
    <button class="eco-btn eco-btn--filled" data-act="sdScan">Dò tên</button>`;
  const r = ui.result;
  if (r) {
    html += `<section class="eco-card"><h2>Khớp chắc chắn (${r.sure.length})</h2>${r.sure.length ? `<div class="tablewrap"><table class="eco-table"><thead><tr><th>Tên Facebook</th><th>Thành viên</th><th class="num">React</th><th class="num">Comment</th><th class="num">Điểm</th></tr></thead><tbody>${r.sure.map(x => `<tr><td>${esc(x.fb)}</td><td>${esc(mName(x.id))}<div class="small muted">${esc(banLabel(App.idx.m[x.id]))}</div></td><td class="num">${x.react ? '✓' : ''}</td><td class="num">${x.comment ? '✓' : ''}</td><td class="num">+${(x.react ? 1 : 0) + (x.comment ? 2 : 0)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Không có.</p>'}</section>`;
    if (r.ask.length) html += `<section class="eco-card"><h2>Cần xác nhận (${r.ask.length})</h2><p class="small muted">Tên lọt trong tên khác hoặc trùng nhiều người. Chọn đúng người.</p>${r.ask.map((x, i) => `<div class="eco-field"><label>"${esc(x.fb)}" ${x.react ? '· react' : ''}${x.comment ? ' · comment' : ''}</label><select class="eco-input sm" data-change="sdAsk" data-i="${i}"><option value="">Không phải thành viên</option>${x.cands.map(c => `<option value="${c}" ${x.pick === c ? 'selected' : ''}>${esc(mName(c))} · ${esc(banLabel(App.idx.m[c]))}</option>`).join('')}</select></div>`).join('')}</section>`;
    html += `<details class="eco-card"><summary>Không phải thành viên (${r.none.length})</summary><p class="small">${r.none.map(esc).join(', ') || '–'}</p></details>`;
    const tot = sdTotal(r);
    html += `<div class="stickybar"><span class="grow">${tot.people} người · ${tot.points} điểm${r.ask.filter(x => x.pick === undefined).length ? ' · còn ' + r.ask.filter(x => x.pick === undefined).length + ' tên chưa chọn' : ''}</span><button class="eco-btn eco-btn--filled" data-act="sdSave">Cộng điểm</button></div>`;
  }
  return html;
}
H.sdCount = () => {
  const r = document.getElementById('sdR'), c = document.getElementById('sdC');
  App.ui.sd.react = r.value; App.ui.sd.comment = c.value;
  document.getElementById('sdRn').textContent = r.value.split('\n').filter(x => x.trim()).length + ' dòng';
  document.getElementById('sdCn').textContent = c.value.split('\n').filter(x => x.trim()).length + ' dòng';
};
H.sdAsk = el => { App.ui.sd.result.ask[+el.dataset.i].pick = el.value; render(); };
function sdTotal(r) {
  const per = {};
  r.sure.forEach(x => { per[x.id] = per[x.id] || { react: false, comment: false }; per[x.id].react = per[x.id].react || x.react; per[x.id].comment = per[x.id].comment || x.comment; });
  r.ask.forEach(x => { if (x.pick) { per[x.pick] = per[x.pick] || { react: false, comment: false }; per[x.pick].react = per[x.pick].react || x.react; per[x.pick].comment = per[x.pick].comment || x.comment; } });
  const ids = Object.keys(per);
  return { per, people: ids.length, points: ids.reduce((a, id) => a + (per[id].react ? 1 : 0) + (per[id].comment ? 2 : 0), 0) };
}
/** Dò tên: mỗi dòng đã dán được so với Tên Facebook và các tài khoản phụ. Khớp nguyên dòng = chắc chắn; tên nằm trong dòng dài hơn = cần xác nhận. */
H.sdScan = () => {
  H.sdCount();
  const names = (App.state.fbNames || []).flatMap(x => x.names.map(n => ({ id: x.id, n: n.trim(), k: bodau(n).replace(/\s+/g, ' ').trim() }))).filter(x => x.k.length >= 3);
  const found = {};
  const scan = (text, kind) => {
    text.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      const k = bodau(line).replace(/\s+/g, ' ').trim();
      const exact = names.filter(x => x.k === k);
      const key = line;
      if (exact.length) {
        const ids = [...new Set(exact.map(x => x.id))];
        const f = found[key] = found[key] || { fb: line, ids, partial: ids.length > 1, react: false, comment: false };
        f[kind] = true; return;
      }
      const part = names.filter(x => (' ' + k + ' ').includes(' ' + x.k + ' '));
      if (part.length && k.length <= 60) {
        const ids = [...new Set(part.map(x => x.id))];
        const nm = part.sort((a, b) => b.k.length - a.k.length)[0].n;
        const startsWith = part.some(x => k.startsWith(x.k + ' '));
        const f = found[key] = found[key] || { fb: line, ids, partial: true, react: false, comment: false, nm, startsWith };
        f[kind] = true;
      }
    });
  };
  scan(App.ui.sd.react, 'react'); scan(App.ui.sd.comment, 'comment');
  const sure = [], ask = [], none = [];
  // Comment thường có dạng "Tên\nnội dung": dòng nội dung không khớp ai thì bỏ qua.
  Object.values(found).forEach(f => {
    if (!f.partial && f.ids.length === 1) sure.push({ fb: f.fb, id: f.ids[0], react: f.react, comment: f.comment });
    else ask.push({ fb: f.fb, cands: f.ids, react: f.react, comment: f.comment });
  });
  const allLines = (App.ui.sd.react + '\n' + App.ui.sd.comment).split('\n').map(l => l.trim()).filter(l => l && l.length < 50 && !found[l]);
  App.ui.sd.result = { sure, ask, none: [...new Set(allLines)].slice(0, 300) };
  render();
};
H.sdSave = async () => {
  const r = App.ui.sd.result, tot = sdTotal(r);
  if (!tot.people) return toast('Chưa có ai để cộng điểm.', true);
  const matches = Object.keys(tot.per).map(id => ({ memberId: id, react: tot.per[id].react, comment: tot.per[id].comment }));
  await act('seedingRecord', { id: App.ui.sd.id, matches }, 'Đã cộng điểm seeding.');
  App.ui.sd = null;
  go('#/seeding');
};

/* ================= P-54 Tổng kết ================= */
route('tong-ket', {
  can: () => isBod(), wide: true,
  render() {
    const s = App.state, tab = App.ui.tkTab || 'top';
    let html = topbar('Tổng kết');
    html += `<div class="tabs"><button class="${tab === 'top' ? 'is-active' : ''}" data-act="set" data-k="tkTab" data-v="top">Top ${s.settings.top}%</button><button class="${tab === 'cert' ? 'is-active' : ''}" data-act="set" data-k="tkTab" data-v="cert">Certificate</button></div>`;
    if (tab === 'top') {
      const ph = App.ui.tkPh || '1';
      const r = s.ranking[ph === 'all' ? 'all' : 'g' + ph];
      html += `<div class="seg"><button class="${ph === '1' ? 'is-active' : ''}" data-act="set" data-k="tkPh" data-v="1">GĐ1</button><button class="${ph === '2' ? 'is-active' : ''}" data-act="set" data-k="tkPh" data-v="2">GĐ2</button><button class="${ph === 'all' ? 'is-active' : ''}" data-act="set" data-k="tkPh" data-v="all">Cả 2 giai đoạn</button></div>`;
      html += `<p class="small">${r.total} người × ${r.pct}% = ${fmtN(r.total * r.pct / 100, 1)} → <b>${r.n} người</b>, cộng người bằng điểm với người cuối trong top.${ph === 'all' ? ' Chỉ thành viên chính thức.' : ph === '1' ? ' GĐ1 chỉ thành viên chính thức.' : ''}</p>`;
      html += `<p class="small muted">${ph === '1' ? 'Quyền lợi: thư mời thẳng vào core team, ưu tiên chọn task ở GĐ2, đặc quyền cá nhân hóa, tuyên dương.' : ph === '2' ? 'Quyền lợi: quà bí mật, tuyên dương.' : 'Quyền lợi: certificate core team, quà, tuyên dương.'} App chỉ đánh dấu, không tự trao quyền lợi.</p>`;
      const top = r.rows.filter(x => x.top);
      html += `<section class="eco-card" style="padding:4px 16px"><table class="eco-table"><thead><tr><th class="num">#</th><th>Thành viên</th><th class="num">Điểm</th></tr></thead><tbody>${top.map(x => `<tr><td class="num">${x.rank}</td><td>${esc(mName(x.id))}<div class="small muted">${esc(banLabel(App.idx.m[x.id]))}</div></td><td class="num">${x.score}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Chưa có ai.</td></tr>'}</tbody></table></section>`;
    } else {
      const cs = s.certificates || [];
      const f = App.ui.tkF || '';
      const cnt = k => cs.filter(c => c.kq === k).length;
      html += `<div class="grid3"><div class="stat"><div class="label">Cấp thẳng</div><div class="big">${cnt('thang')}</div></div><div class="stat"><div class="label">Cấp nhờ bù trừ</div><div class="big">${cnt('bu-tru')}</div></div><div class="stat"><div class="label">Chưa cấp</div><div class="big">${cnt('chua')}</div></div></div>`;
      html += `<p class="small muted">Log ≥ ${s.settings.kpiDat}% và Task ≥ ${s.settings.kpiDat}% → cấp. Nếu cả hai ≥ ${s.settings.kpiBuTru}% → xét bảng bù trừ: lọt top ${s.settings.topBuTru}% thì cấp. Bảng bù trừ: thành viên chính thức xếp theo tổng điểm cả nhiệm kỳ (chỉ so với thành viên chính thức); thành viên bổ sung xếp theo điểm GĐ2 (so với tất cả). Phần trăm làm tròn thông thường.</p>`;
      const got = cs.filter(c => c.kq !== 'chua');
      const line = c => App.idx.m[c.id] || {};
      html += `<div class="row"><button class="eco-btn" data-act="copy" data-text="${attr(got.map(c => line(c).hoTen).join('\n'))}">${ic('copy', 'sm')} Chép cột Họ tên</button><button class="eco-btn" data-act="copy" data-text="${attr(got.map(c => (line(c).ngaySinh || '') + '\t' + (line(c).sdt || '')).join('\n'))}">${ic('copy', 'sm')} Chép Ngày sinh + SĐT</button><span class="small muted">Dán thẳng vào sheet certificate của Đoàn (${got.length} người, cùng thứ tự).</span></div>`;
      html += `<div class="chips">${[['', 'Tất cả'], ['thang', 'Cấp thẳng'], ['bu-tru', 'Bù trừ'], ['chua', 'Chưa cấp']].map(([k, l]) => `<button class="eco-chip ${f === k ? 'is-active' : ''}" data-act="set" data-k="tkF" data-v="${k}">${l}</button>`).join('')}</div>`;
      html += `<section class="eco-card" style="padding:4px 16px"><div class="tablewrap"><table class="eco-table"><thead><tr><th>Họ tên</th><th>Ngày sinh</th><th class="dk">SĐT</th><th class="num">Log</th><th class="num">Task</th><th>Kết quả</th></tr></thead><tbody>${cs.filter(c => !f || c.kq === f).map(c => { const m = line(c); return `<tr><td>${esc(m.hoTen)}<div class="small muted">${esc(banLabel(m))}</div></td><td>${esc(m.ngaySinh || '')}</td><td class="dk">${esc(m.sdt || '')}</td><td class="num">${c.logNA ? '–' : c.logPct + '%'}</td><td class="num">${c.taskNA ? '–' : c.taskPct + '%'}</td><td>${c.kq === 'thang' ? tag('Cấp thẳng', 'done') : c.kq === 'bu-tru' ? tag('Bù trừ', 'done') : tag('Chưa cấp', 'attention')}${c.note ? `<div class="small muted">${esc(c.note)}</div>` : ''}</td></tr>`; }).join('')}</tbody></table></div></section>`;
    }
    return html;
  }
});
