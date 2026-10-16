/* Trang của thành viên (P-02 … P-11) và chi tiết task dùng chung. */
'use strict';

const ST_LABEL = { 'sap-han': 'Sắp đến hạn', 'qua-han': 'Quá hạn', 'cho-cham': 'Chờ chấm', 'da-cham': 'Đã chấm', 'khong-lam': 'Không làm', 'huy': 'Đã hủy' };
const Q_LABEL = { HC: 'Hoàn chỉnh', CS: 'Cần chỉnh sửa', SS: 'Làm quá sơ sài' };
function stTag(a) {
  if (!a) return '';
  if (a.st === 'da-cham') return a.kq === 'dat' ? tag('Đạt', 'done') : tag('Chưa đạt', 'attention');
  if (a.st === 'khong-lam') return tag('Không làm', 'attention');
  if (a.st === 'qua-han') return tag('Quá hạn', 'attention');
  if (a.st === 'cho-cham') return a.isBod ? tag('Đã xác nhận', 'done') : tag(a.han === 'tre' ? 'Chờ chấm · trễ hạn' : 'Chờ chấm');
  if (a.st === 'huy') return tag('Đã hủy');
  return tag(ST_LABEL[a.st] || a.st);
}
function myAssign(t) { return t.assignees.find(a => a.memberId === App.state.me.id); }
function myTasks() { return App.state.tasks.filter(t => myAssign(t)); }
const evName = id => (App.idx.ev[id] || {}).ten || '';
function canManage(t) {
  if (isBod()) return true;
  const ns = R().ns || [];
  return ns.length && t.assignees.some(a => { const m = App.idx.m[a.memberId]; return m && ns.includes(m.ban); });
}
function taskRow(t, a, extra) {
  return `<a href="#/task/${t.id}"><div class="li-main"><b class="ellipsis">${esc(t.ten)}</b><span class="sub">${esc(evName(t.eventId))} · hạn ${esc(fDT(t.hanChot))}${extra ? ' · ' + extra : ''}</span></div>${a ? stTag(a) : ''}</a>`;
}

/* Bộ lọc sự kiện dạng chip, dùng chung. */
function eventChips(key, events) {
  const cur = App.ui[key] || '';
  return `<div class="chips"><button class="eco-chip ${!cur ? 'is-active' : ''}" data-act="set" data-k="${key}" data-v="">Tất cả</button>${events.map(e => `<button class="eco-chip ${cur === e.id ? 'is-active' : ''}" data-act="set" data-k="${key}" data-v="${e.id}">${esc(e.ten)}</button>`).join('')}</div>`;
}

/* ================= P-02 Trang chủ ================= */
route('trang-chu', {
  can: () => !isBod(),
  render() {
    const s = App.state, me = s.me, k = (s.kpi || {})[me.id] || {};
    const up = myTasks().map(t => [t, myAssign(t)]).filter(([t, a]) => a.st === 'sap-han' || a.st === 'qua-han').sort((x, y) => tms(x[0].hanChot) - tms(y[0].hanChot));
    const openLogs = s.events.filter(e => e.log.trangThai === 'mo' && e.sessions.length);
    const rk = rankNow(), myR = rk.rows.find(r => r.id === me.id);
    const hello = (new Date().getHours() < 11 ? 'Chào buổi sáng' : new Date().getHours() < 18 ? 'Chào buổi chiều' : 'Chào buổi tối') + ', ' + esc(me.hoTen.split(' ').pop());
    let html = topbar('Trang chủ');
    html += `<div class="row nowrap">${avatar(me)}<div class="grow"><b>${hello}</b><div class="small muted">${esc(termLabel())}</div></div></div>`;
    if (me.pwDefault) html += banner('Bạn đang dùng mật khẩu mặc định của CLB. Nên đổi mật khẩu riêng ở <a href="#/toi">trang Tôi</a>.');
    html += '<div class="grid2">';
    html += `<section class="eco-card"><div class="head"><h2>Task sắp đến hạn</h2><a class="small" href="#/viec">Xem tất cả</a></div>${up.length ? `<div class="eco-list">${up.slice(0, 3).map(([t, a]) => taskRow(t, a, rel(t.hanChot))).join('')}</div>` : '<p class="muted">Không có task nào sắp đến hạn.</p>'}</section>`;
    html += `<section class="eco-card"><h2>Đợt log đang mở</h2>${openLogs.length ? openLogs.map(e => {
      const l = (k.logs || []).find(x => x.eventId === e.id) || { attended: 0, initial: 0 };
      const next = e.sessions.filter(x => tms(x.thoiDiem) > Date.now()).slice(0, 3);
      return `<div class="stack tight"><div class="row spread"><b>${esc(e.ten)}</b><span class="num">${fmtN(l.attended)} / ${fmtN(l.initial)} buổi</span></div>
        ${next.length ? `<div class="small muted">Sắp tới: ${next.map(x => esc(fDT(x.thoiDiem)) + ' · ' + x.thoiLuong + "'").join(' · ')}</div>` : '<div class="small muted">Không còn buổi sắp tới.</div>'}
        ${e.log.sheetUrl ? `<a class="eco-btn" href="${attr(e.log.sheetUrl)}" target="_blank" rel="noopener">Mở sheet đăng ký ${ic('ext', 'sm')}</a>` : ''}</div>`;
    }).join('<hr>') : '<p class="muted">Chưa có đợt log nào đang mở.</p>'}</section>`;
    html += `<section class="eco-card"><div class="head"><h2>KPI</h2><a class="small" href="#/kpi">Chi tiết</a></div>${kpiBars(k)}${kpiForecast(k)}</section>`;
    html += `<section class="eco-card"><div class="head"><h2>Điểm và hạng</h2><a class="small" href="#/xep-hang">Bảng xếp hạng</a></div>${myR ? `<div class="row"><span class="big">${myR.score}</span><span class="muted">điểm GĐ${rk.phase}</span></div><div>Hạng <b>${myR.rank}</b> / ${rk.total}${myR.top ? ' · ' + tag('Top ' + s.settings.top + '%', 'done') : rk.cut != null ? ' · cần thêm ' + Math.max(0, rk.cut - myR.score) + ' điểm để vào top ' + s.settings.top + '%' : ''}</div>` : '<p class="muted">Giai đoạn này bạn chưa có trên bảng xếp hạng.</p>'}</section>`;
    html += '</div>';
    return html;
  }
});

function rankNow() {
  const s = App.state;
  const ph = s.term.giaiDoan === '2' ? '2' : '1';
  return Object.assign({ phase: ph }, s.ranking['g' + ph]);
}
function kpiBars(k) {
  if (!k) return '';
  return `<div class="stack tight"><div class="row spread"><span>KPI Log</span><b class="num">${pct(k.logPct)}</b></div>${progress(k.logPct)}
    <div class="row spread"><span>KPI Task</span><b class="num">${pct(k.taskPct)}</b></div>${progress(k.taskPct)}</div>`;
}
function kpiForecast(k) {
  if (!k) return '';
  const dat = +App.state.settings.kpiDat;
  const out = [];
  if (k.needLog > 0) out.push(`Cần thêm <b>${k.needLog}</b> buổi log (90 phút) để đạt ${dat}%.`);
  if (k.taskPct != null && k.taskPct < dat) out.push(`KPI Task đang dưới ${dat}%: hoàn thành đúng hạn và đầy đủ các task tiếp theo.`);
  if (k.taskPending) out.push(`${k.taskPending} task đang chờ chấm, chưa tính vào KPI.`);
  return out.length ? `<p class="small">${out.join(' ')}</p>` : `<p class="small muted">Bạn đang đạt KPI. Giữ vững nhé!</p>`;
}

/* ================= P-03 Việc của tôi ================= */
route('viec', {
  can: () => !R().root,
  render() {
    const bod = isBod();
    const tab = bod ? 'task' : (App.ui.viecTab || 'task');
    let html = topbar(bod ? 'Task của tôi' : 'Việc của tôi');
    if (!bod) html += `<div class="tabs"><button class="${tab === 'task' ? 'is-active' : ''}" data-act="set" data-k="viecTab" data-v="task">Task</button><button class="${tab === 'log' ? 'is-active' : ''}" data-act="set" data-k="viecTab" data-v="log">Log</button></div>`;
    const evs = App.state.events;
    html += eventChips('viecEv', evs);
    const ev = App.ui.viecEv || '';
    if (tab === 'task') {
      const list = myTasks().filter(t => !ev || t.eventId === ev).map(t => [t, myAssign(t)]).filter(([t, a]) => a.st !== 'huy');
      const up = list.filter(([t, a]) => a.st === 'sap-han' || a.st === 'qua-han').sort((x, y) => (y[1].st === 'qua-han') - (x[1].st === 'qua-han') || tms(x[0].hanChot) - tms(y[0].hanChot));
      const wait = list.filter(([t, a]) => a.st === 'cho-cham');
      const done = list.filter(([t, a]) => a.st === 'da-cham' || a.st === 'khong-lam').sort((x, y) => tms(y[0].hanChot) - tms(x[0].hanChot));
      const sec = (title, arr, more) => `<section class="eco-card"><h2>${title} <span class="muted">(${arr.length})</span></h2>${arr.length ? `<div class="eco-list">${arr.map(([t, a]) => taskRow(t, a, a.st === 'sap-han' || a.st === 'qua-han' ? rel(t.hanChot) : '')).join('')}</div>` : '<p class="muted">Không có.</p>'}${more || ''}</section>`;
      html += sec('Sắp đến hạn', up);
      html += sec(bod ? 'Đã hoàn thành' : 'Đã hoàn thành, chờ chấm', wait);
      if (!bod) {
        const show = App.ui.viecAll ? done : done.slice(0, 3);
        html += sec('Đã chấm', show, done.length > 3 ? `<button class="eco-btn" data-act="toggle" data-k="viecAll">${App.ui.viecAll ? 'Thu gọn' : 'Xem thêm ' + (done.length - 3) + ' task'}</button>` : '');
      }
    } else {
      const k = (App.state.kpi || {})[App.state.me.id] || { logs: [] };
      const logs = k.logs.filter(l => !ev || l.eventId === ev);
      html += `<section class="eco-card"><h2>Tổng</h2><div class="row"><span class="big">${fmtN(k.logAtt)}</span><span class="muted">/ ${fmtN(k.logFin)} buổi (các đợt đã chốt)</span></div><p class="small muted">Buổi 180 phút tính là 2 buổi. Số buổi được giao cuối giữ số lẻ.</p></section>`;
      html += logs.length ? logs.map(l => logCard(l)).join('') : empty('Bạn chưa có log nào' + (ev ? ' trong sự kiện này.' : '.'));
    }
    return html;
  }
});

function logCard(l) {
  const e = App.idx.ev[l.eventId]; if (!e) return '';
  const mine = new Set(l.sessions);
  const past = e.sessions.filter(x => mine.has(x.id));
  const next = e.sessions.filter(x => tms(x.thoiDiem) > Date.now());
  let h = `<section class="eco-card"><div class="head"><h2>${esc(e.ten)}</h2>${l.closed ? tag('Đã chốt', 'done') : tag('Đang mở')}</div>`;
  if (l.closed) {
    h += `<div class="kv"><span>Đã tham gia</span><b class="num">${fmtN(l.attended)} buổi</b><span>Được giao cuối</span><b class="num">${fmtN(l.final)} buổi</b><span>Cách tính</span><span class="small">${l.held} buổi diễn ra × ${fmtN(l.initial)} giao ban đầu ÷ ${l.planned} dự kiến</span>${l.extra ? `<span>Log vượt</span><b>${l.extra} buổi · +${l.extra * 20} điểm</b>` : ''}</div>`;
  } else {
    h += `<div class="kv"><span>Đã tham gia</span><b class="num">${fmtN(l.attended)} / ${fmtN(l.initial)} buổi được giao</b></div>`;
  }
  if (past.length) h += `<div class="small"><span class="muted">Buổi đã có mặt:</span> ${past.map(x => esc(x.ten) + ' (' + fDshort(x.thoiDiem) + (x.thoiLuong === 180 ? ', 2 buổi' : '') + ')').join(', ')}</div>`;
  if (!l.closed && next.length) h += `<div class="small"><span class="muted">Buổi sắp tới:</span> ${next.map(x => esc(fDT(x.thoiDiem)) + ' · ' + x.thoiLuong + "'").join(' · ')}</div>${e.log.sheetUrl ? `<a class="eco-btn" href="${attr(e.log.sheetUrl)}" target="_blank" rel="noopener">Mở sheet đăng ký ${ic('ext', 'sm')}</a>` : ''}`;
  return h + '</section>';
}

/* ================= P-04 Chi tiết task (thành viên + quản lý) ================= */
route('task', {
  render(id) {
    const t = App.idx.task[id];
    if (!t) return topbar('Task', { back: '#/viec' }) + empty('Không tìm thấy task này (có thể đã bị xóa hoặc không thuộc phạm vi của bạn).');
    const mine = myAssign(t), manage = canManage(t);
    const back = isBod() ? '#/su-kien/' + t.eventId : manage && !mine ? '#/task-ban' : '#/viec';
    const ev = App.idx.ev[t.eventId] || {};
    const banSet = [...new Set(t.assignees.map(a => banLabel(App.idx.m[a.memberId])).filter(Boolean))];
    let right = '';
    if (manage && !t.huy) right = `<button class="eco-btn eco-btn--sm" data-act="taskEditOpen" data-id="${t.id}">Sửa</button>`;
    let html = topbar('Chi tiết task', { back, right });
    html += `<section class="eco-card"><div class="row">${tag(ev.ten || 'Sự kiện')}${banSet.slice(0, 3).map(b => tag(b)).join('')}${t.huy ? tag('Đã hủy', 'attention') : ''}</div>
      <h2 style="font-size:20px">${esc(t.ten)}</h2>
      <div class="kv"><span>Hạn chót</span><b>${esc(fDT(t.hanChot))} <span class="muted small">(${rel(t.hanChot)})</span></b><span>Người nhập</span><span>${esc(t.taoBoi)}</span></div>
      ${t.moTa ? `<p style="white-space:pre-wrap">${esc(t.moTa)}</p>` : ''}
      ${!manage ? `<div class="small"><span class="muted">Cùng làm:</span> ${t.assignees.map(a => esc(mName(a.memberId))).join(', ')}</div>` : ''}
      ${t.nhatKyHan && t.nhatKyHan.length ? `<details><summary class="small muted">Lịch sử sửa hạn (${t.nhatKyHan.length})</summary><div class="small">${t.nhatKyHan.map(n => `${esc(fDT(n.luc))}: ${esc(fDT(n.cu))} → ${esc(fDT(n.moi))} · ${esc(n.boi)}${n.lyDo ? ' · ' + esc(n.lyDo) : ''}`).join('<br>')}</div></details>` : ''}
    </section>`;
    if (mine && !t.huy) html += myTaskCard(t, mine);
    if (manage) html += manageAssignees(t);
    return html;
  }
});

function myTaskCard(t, a) {
  const kl = +App.state.settings.khongLamSauGio;
  let h = `<section class="eco-card"><div class="head"><h2>Việc của bạn</h2>${stTag(a)}</div>`;
  if (a.st === 'sap-han') {
    h += `<p>Nộp sản phẩm qua Messenger như cũ, rồi bấm xác nhận ở đây.</p><button class="eco-btn eco-btn--filled eco-btn--block" data-act="taskConfirm" data-id="${a.id}">Xác nhận hoàn thành</button><p class="small muted">Xác nhận sau ${esc(fDT(t.hanChot))} sẽ được ghi là Trễ hạn.</p>`;
  } else if (a.st === 'qua-han') {
    const lim = tms(t.hanChot) + kl * 3600e3;
    h += banner(`Đã quá hạn ${rel(t.hanChot).replace('quá ', '')}. Xác nhận bây giờ sẽ ghi <b>Trễ hạn</b>. Sau ${esc(fDT(new Date(lim + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')))} task tự thành <b>Không làm</b>.`);
    h += `<button class="eco-btn eco-btn--filled eco-btn--block" data-act="taskConfirm" data-id="${a.id}">Xác nhận hoàn thành (trễ hạn)</button>`;
  } else if (a.st === 'cho-cham') {
    h += `<div class="kv"><span>Xác nhận lúc</span><span>${esc(fDT(a.xacNhanLuc))}${a.xacNhanBoi ? ' · ' + esc(a.xacNhanBoi) + ' xác nhận thay' : ''}</span><span>Thời hạn</span><span>${a.han === 'tre' ? tag('Trễ hạn', 'attention') : tag('Đúng hạn')}</span></div>`;
    if (a.han === 'tre') h += `<p class="small muted">Nếu bạn đã nộp đúng hạn trên Messenger, nhắn Nhân sự phụ trách ban sửa thành "Nộp đúng hạn".</p>`;
    h += `<button class="linkbtn small" data-act="taskUnconfirm" data-id="${a.id}">Hủy xác nhận (bấm nhầm)</button>`;
  } else if (a.st === 'da-cham') {
    const dat = a.kq === 'dat';
    h += `<div class="row"><span class="big">${dat ? 'ĐẠT' : 'CHƯA ĐẠT'}</span></div><div class="kv"><span>Thời hạn</span><span>${a.han === 'tre' ? 'Trễ hạn' : 'Đúng hạn'}</span><span>Chất lượng</span><span>${esc(Q_LABEL[a.chatLuong] || '')}</span></div>
      <p class="small muted">Theo quy chế: đúng hạn + hoàn chỉnh hoặc cần chỉnh sửa = Đạt; trễ hạn chỉ Đạt khi hoàn chỉnh; làm quá sơ sài luôn Chưa đạt. Nhận xét chi tiết được gửi qua Messenger.</p>`;
  } else if (a.st === 'khong-lam') {
    h += `<p>Task quá hạn hơn ${kl} giờ mà chưa xác nhận nên được ghi là <b>Không làm</b> (Chưa đạt). Có nhầm lẫn thì nhắn Nhân sự phụ trách ban.</p>`;
  }
  return h + '</section>';
}

function manageAssignees(t) {
  const bod = isBod();
  const rows = t.assignees.map(a => {
    const m = App.idx.m[a.memberId] || { hoTen: mName(a.memberId) };
    let btns = '';
    if (!t.huy) {
      if (a.st === 'sap-han' || a.st === 'qua-han' || (a.st === 'khong-lam')) btns += `<button class="eco-btn eco-btn--sm" data-act="confirmFor" data-id="${a.id}" data-t="${t.id}">Xác nhận thay</button>`;
      if (a.st === 'cho-cham' || a.st === 'da-cham') {
        if (a.han === 'tre' || a.nopDungHan) btns += `<button class="eco-btn eco-btn--sm" data-act="onTime" data-id="${a.id}" data-v="${a.nopDungHan ? '' : '1'}">${a.nopDungHan ? 'Bỏ "Nộp đúng hạn"' : 'Nộp đúng hạn'}</button>`;
        if (bod && !a.isBod) btns += `<button class="eco-btn eco-btn--sm" data-act="gradeOpen" data-id="${a.id}" data-t="${t.id}">${a.chatLuong ? 'Sửa chấm' : 'Chấm'}</button>`;
        if (a.st === 'cho-cham') btns += `<button class="eco-btn eco-btn--sm" data-act="taskUnconfirm" data-id="${a.id}">Hủy xác nhận</button>`;
      }
    }
    const info = a.xacNhanLuc ? `xác nhận ${esc(fDT(a.xacNhanLuc))}${a.xacNhanBoi ? ' (thay: ' + esc(a.xacNhanBoi) + ')' : ''}${a.nopDungHan ? ' · nộp đúng hạn' : ''}${a.chatLuong ? ' · ' + esc(Q_LABEL[a.chatLuong]) + (a.chamBoi ? ' (' + esc(a.chamBoi) + ')' : '') : ''}` : 'chưa xác nhận';
    return `<div style="flex-wrap:wrap">${avatar(m, 'sm')}<div class="li-main"><b>${esc(m.hoTen)}</b><span class="sub">${esc(banLabel(m))} · ${info}</span></div>${stTag(a)}<div class="row" style="width:100%;justify-content:flex-end">${btns}</div></div>`;
  }).join('');
  return `<section class="eco-card"><div class="head"><h2>Người được giao (${t.assignees.length})</h2>${!t.huy ? `<button class="eco-btn eco-btn--sm" data-act="taskAddPeople" data-id="${t.id}">${ic('plus', 'sm')} Thêm người</button>` : ''}</div><div class="eco-list">${rows}</div>
    ${bod ? `<div class="row">${t.huy ? `<button class="eco-btn" data-act="taskCancel" data-id="${t.id}" data-undo="1">Bỏ hủy task</button>` : `<button class="eco-btn eco-btn--danger" data-act="taskCancel" data-id="${t.id}">Hủy task</button>`}<span class="small muted">Task đã hủy không tính vào KPI.</span></div>` : ''}</section>`;
}

H.taskConfirm = el => act('taskConfirm', { assignId: el.dataset.id }, 'Đã xác nhận hoàn thành.');
H.taskUnconfirm = el => confirmBox('Hủy xác nhận?', 'Task sẽ trở lại trạng thái chưa hoàn thành.', 'Hủy xác nhận', () => act('taskUnconfirm', { assignId: el.dataset.id }, 'Đã hủy xác nhận.'));
H.onTime = el => act('taskOnTime', { assignId: el.dataset.id, value: !!el.dataset.v }, 'Đã cập nhật.');
H.taskCancel = el => el.dataset.undo ? act('taskCancel', { taskId: el.dataset.id, undo: true }) : confirmBox('Hủy task?', 'Task đã hủy không tính vào KPI của ai. Bỏ hủy được về sau.', 'Hủy task', () => act('taskCancel', { taskId: el.dataset.id }, 'Đã hủy task.'));
H.confirmFor = el => {
  const t = App.idx.task[el.dataset.t], a = t.assignees.find(x => x.id === el.dataset.id);
  const late = Date.now() > tms(t.hanChot);
  if (isBod() && !a.isBod) return gradeModal(t, a, true);
  modal('Xác nhận thay ' + mName(a.memberId), `<p>Ghi nhận ${esc(mName(a.memberId))} đã hoàn thành "${esc(t.ten)}".</p>
    ${late ? `<label class="opt"><input type="checkbox" class="chk" id="cfOnTime"> Thực tế đã nộp đúng hạn trên Messenger (Nộp đúng hạn)</label>` : ''}
    <div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="cfGo">Xác nhận</button></div>`);
  document.getElementById('cfGo').onclick = async () => { const o = document.getElementById('cfOnTime'); closeModal(); await act('taskConfirm', { assignId: a.id, nopDungHan: o ? o.checked : undefined }, 'Đã xác nhận thay.'); };
};
H.gradeOpen = el => { const t = App.idx.task[el.dataset.t]; gradeModal(t, t.assignees.find(x => x.id === el.dataset.id), false); };

/** Bảng chấm chất lượng (mở ngay khi BOD xác nhận thay). */
function gradeModal(t, a, confirming) {
  const late = confirming ? Date.now() > tms(t.hanChot) : a.han === 'tre' || a.nopDungHan;
  modal((confirming ? 'Xác nhận và chấm · ' : 'Chấm · ') + mName(a.memberId), `
    <p class="muted">${esc(t.ten)}</p>
    <div class="kv"><span>Thời hạn</span><span id="grHan">${late && !a.nopDungHan ? 'Trễ hạn' : 'Đúng hạn'}</span></div>
    ${late ? `<label class="opt"><input type="checkbox" class="chk" id="grOnTime" ${a.nopDungHan ? 'checked' : ''}> Nộp đúng hạn (đã nộp đúng hạn trên Messenger)</label>` : ''}
    <div class="stack tight">${Object.keys(Q_LABEL).map(q => `<label class="opt"><input type="radio" name="grQ" value="${q}" ${a.chatLuong === q ? 'checked' : ''}> ${Q_LABEL[q]}</label>`).join('')}</div>
    <div id="grRes" class="row"></div>
    ${banner('Nhớ gửi nhận xét riêng cho thành viên qua Messenger.')}
    <div class="actions"><button class="eco-btn" id="grLater">${confirming ? 'Chỉ xác nhận, chấm sau' : 'Để sau'}</button><button class="eco-btn eco-btn--filled" id="grSave">Lưu</button></div>`);
  const upd = () => {
    const q = (document.querySelector('input[name=grQ]:checked') || {}).value;
    const ot = document.getElementById('grOnTime');
    const onTime = !late || (ot && ot.checked);
    document.getElementById('grHan').textContent = onTime ? 'Đúng hạn' : 'Trễ hạn';
    document.getElementById('grRes').innerHTML = q ? 'Kết quả: ' + ((q === 'HC' || (q === 'CS' && onTime)) ? tag('Đạt', 'done') : tag('Chưa đạt', 'attention')) : '';
  };
  document.querySelectorAll('#modal input').forEach(i => i.onchange = upd); upd();
  document.getElementById('grLater').onclick = async () => { const ot = document.getElementById('grOnTime'); closeModal(); if (confirming) await act('taskConfirm', { assignId: a.id, nopDungHan: ot ? ot.checked : undefined }, 'Đã xác nhận.'); };
  document.getElementById('grSave').onclick = async () => {
    const q = (document.querySelector('input[name=grQ]:checked') || {}).value;
    if (!q) return toast('Chọn mức chất lượng.', true);
    const ot = document.getElementById('grOnTime');
    closeModal();
    if (confirming) await act('taskConfirm', { assignId: a.id, chatLuong: q, nopDungHan: ot ? ot.checked : undefined }, 'Đã xác nhận và chấm.');
    else await act('taskGrade', { assignId: a.id, chatLuong: q, nopDungHan: ot ? ot.checked : undefined }, 'Đã chấm.');
  };
}

/* ================= P-05 KPI của tôi ================= */
route('kpi', {
  can: () => !isBod(),
  render() {
    const s = App.state, me = s.me, k = (s.kpi || {})[me.id] || { logs: [], tasks: [] };
    const c = s.myCert;
    let html = topbar('KPI của tôi');
    html += `<p class="muted">Phạm vi tính: ${me.loai === 'bo-sung' ? 'Giai đoạn 2 (thành viên bổ sung, chỉ việc được giao sau khi gia nhập)' : 'toàn nhiệm kỳ (thành viên chính thức)'}.</p>`;
    html += `<div class="grid2"><section class="eco-card"><h2>KPI Log</h2><div class="row"><span class="big">${pct(k.logPct)}</span>${k.logPct == null ? '' : k.logPct >= +s.settings.kpiDat ? tag('Đạt', 'done') : tag('Chưa đạt', 'attention')}</div>${progress(k.logPct)}<p class="small muted">${fmtN(k.logAtt)} / ${fmtN(k.logFin)} buổi (các đợt đã chốt)</p></section>
      <section class="eco-card"><h2>KPI Task</h2><div class="row"><span class="big">${pct(k.taskPct)}</span>${k.taskPct == null ? '' : k.taskPct >= +s.settings.kpiDat ? tag('Đạt', 'done') : tag('Chưa đạt', 'attention')}</div>${progress(k.taskPct)}<p class="small muted">${k.taskDat} / ${k.taskCount} task đạt${k.taskPending ? ' · ' + k.taskPending + ' chờ chấm (chưa tính)' : ''}</p></section>`;
    html += `<section class="eco-card full"><h2>Dự báo</h2>${kpiForecast(k)}${c ? `<p>Nếu tổng kết hôm nay: <b>${c.kq === 'thang' ? 'được cấp certificate' : c.kq === 'bu-tru' ? 'được cấp nhờ bảng bù trừ' : 'chưa được cấp certificate'}</b>${c.note ? ' · ' + esc(c.note) : ''}.</p>` : ''}</section></div>`;
    html += `<section class="eco-card"><h2>Chi tiết log</h2>${k.logs.length ? `<div class="tablewrap"><table class="eco-table"><thead><tr><th>Sự kiện</th><th class="num">Giao cuối</th><th class="num">Đã dự</th><th class="num">Vượt</th></tr></thead><tbody>${k.logs.map(l => `<tr><td>${esc(evName(l.eventId))}${l.closed ? '' : ' <span class="small muted">(đang mở)</span>'}</td><td class="num">${l.closed ? fmtN(l.final) : '–'}</td><td class="num">${fmtN(l.attended)}</td><td class="num">${l.extra || ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Chưa có.</p>'}</section>`;
    const ts = k.tasks.map(x => [App.idx.task[x.taskId], x]).filter(x => x[0]);
    html += `<section class="eco-card"><h2>Chi tiết task</h2>${ts.length ? `<div class="eco-list">${ts.map(([t, x]) => `<a href="#/task/${t.id}"><div class="li-main"><b class="ellipsis">${esc(t.ten)}</b><span class="sub">${esc(evName(t.eventId))}${!x.tinh ? ' · không tính' : ''}</span></div>${stTag(myAssign(t))}</a>`).join('')}</div>` : '<p class="muted">Chưa có.</p>'}</section>`;
    return html;
  }
});

/* ================= P-06 Xếp hạng ================= */
route('xep-hang', {
  render() {
    const s = App.state, bod = isBod();
    const tab = bod ? 'bang' : (App.ui.xhTab || 'bang');
    const cur = s.term.giaiDoan === '2' ? '2' : '1';
    const ph = App.ui.xhPh || cur;
    let html = topbar('Xếp hạng');
    if (!bod) html += `<div class="tabs"><button class="${tab === 'bang' ? 'is-active' : ''}" data-act="set" data-k="xhTab" data-v="bang">Bảng xếp hạng</button><button class="${tab === 'ls' ? 'is-active' : ''}" data-act="set" data-k="xhTab" data-v="ls">Lịch sử điểm</button></div>`;
    if (tab === 'bang') {
      html += `<div class="seg"><button class="${ph === '1' ? 'is-active' : ''}" data-act="set" data-k="xhPh" data-v="1">Giai đoạn 1</button><button class="${ph === '2' ? 'is-active' : ''}" data-act="set" data-k="xhPh" data-v="2" ${cur === '1' ? 'disabled' : ''}>Giai đoạn 2</button></div>`;
      if (cur === '1') html += '<p class="small muted">Giai đoạn 2 chưa bắt đầu.</p>';
      if (bod) html += '<p class="small muted">BOD xem được, không có tên trên bảng.</p>';
      const r = s.ranking['g' + ph];
      html += `<p class="small">Top ${r.pct}%: ${r.total} × ${r.pct}% = ${fmtN(r.total * r.pct / 100, 1)} → <b>${r.n} người</b>, cộng người bằng điểm.${ph === '1' ? ' GĐ1 chỉ xếp hạng thành viên chính thức.' : ''}</p>`;
      let lastTop = -1;
      r.rows.forEach((x, i) => { if (x.top) lastTop = i; });
      html += `<section class="eco-card" style="padding:4px 16px"><div class="tablewrap"><table class="eco-table"><thead><tr><th class="num">#</th><th>Thành viên</th><th class="dk">Ban</th><th class="num">Điểm</th></tr></thead><tbody>${r.rows.map((x, i) => {
        const m = App.idx.m[x.id] || {};
        return `<tr class="${x.id === s.me.id ? 'me' : ''} ${i === lastTop ? 'cutline' : ''}"><td class="num">${x.rank}</td><td><div class="row nowrap">${avatar(m, 'sm')}<div class="grow"><div class="ellipsis">${esc(m.hoTen)} ${x.top ? tag('Top', 'done') : ''}</div><div class="small muted ph">${esc(banLabel(m))}</div></div></div></td><td class="dk">${esc(banLabel(m))}</td><td class="num">${x.score}</td></tr>`;
      }).join('')}</tbody></table></div></section>`;
      const mine = r.rows.find(x => x.id === s.me.id);
      if (mine) html += `<div class="stickybar"><b>Bạn: hạng ${mine.rank}/${r.total} · ${mine.score} điểm</b><span class="muted">${mine.top ? 'Đang trong top ' + r.pct + '%' : r.cut != null ? 'Cần thêm ' + Math.max(0, r.cut - mine.score) + ' điểm để vào top' : ''}</span></div>`;
    } else {
      const pts = s.points.filter(p => p.memberId === s.me.id);
      const tot = pts.filter(p => p.giaiDoan === '1' || p.giaiDoan === '2').reduce((a, p) => a + p.diem, 0);
      html += `<section class="eco-card"><div class="row"><span class="big">${tot}</span><span class="muted">điểm cả nhiệm kỳ</span></div></section>`;
      html += pts.length ? `<section class="eco-card"><div class="eco-list">${pts.map(p => `<div><div class="li-main"><b>${esc(p.chiTiet || p.hoatDong)}</b><span class="sub">${esc(fD(p.luc))} · ${p.giaiDoan === '0' ? 'không tính (đang tắt ghi nhận)' : 'GĐ' + p.giaiDoan}${p.eventId ? ' · ' + esc(evName(p.eventId)) : ''}</span></div><b class="num">+${p.diem}</b></div>`).join('')}</div></section>` : empty('Chưa có lần cộng điểm nào.');
    }
    return html;
  }
});

/* ================= P-07 Sự kiện (thành viên) ================= */
route('su-kien', {
  render(id) {
    if (isBod()) return bodEventPage(id);
    const s = App.state;
    if (!id) {
      let html = topbar('Sự kiện');
      html += s.events.length ? `<div class="grid2">${s.events.map(e => {
        const nT = myTasks().filter(t => t.eventId === e.id).length;
        const l = ((s.kpi || {})[s.me.id] || { logs: [] }).logs.find(x => x.eventId === e.id);
        return `<a class="eco-card" href="#/su-kien/${e.id}" style="text-decoration:none"><div class="head"><b>${esc(e.ten)}</b>${eventStatusTag(e)}</div><span class="small muted">${esc(fD(e.batDau))}${e.ketThuc ? ' – ' + esc(fD(e.ketThuc)) : ''}</span><span class="small">${nT} task của bạn${l ? ' · log ' + fmtN(l.attended) + '/' + fmtN(l.closed ? l.final : l.initial) : ''}</span></a>`;
      }).join('')}</div>` : empty('Chưa có sự kiện nào.');
      return html;
    }
    const e = App.idx.ev[id];
    if (!e) return topbar('Sự kiện', { back: '#/su-kien' }) + empty('Không tìm thấy sự kiện.');
    const ts = myTasks().filter(t => t.eventId === id);
    const l = ((s.kpi || {})[s.me.id] || { logs: [] }).logs.find(x => x.eventId === id);
    let html = topbar(e.ten, { back: '#/su-kien' });
    html += `<section class="eco-card"><div class="row">${eventStatusTag(e)}<span class="muted small">${esc(fD(e.batDau))}${e.ketThuc ? ' – ' + esc(fD(e.ketThuc)) : ''}${e.diaDiem ? ' · ' + esc(e.diaDiem) : ''}</span></div>${e.moTa ? `<p style="white-space:pre-wrap">${esc(e.moTa)}</p>` : ''}</section>`;
    html += `<section class="eco-card"><h2>Task của bạn</h2>${ts.length ? `<div class="eco-list">${ts.map(t => taskRow(t, myAssign(t))).join('')}</div>` : '<p class="muted">Không có.</p>'}</section>`;
    html += l ? logCard(l) : (e.sessions.length ? `<section class="eco-card"><h2>Log</h2><p class="muted">Bạn chưa có chỉ tiêu hay buổi log nào ở sự kiện này.</p>${e.log.sheetUrl ? `<a class="eco-btn" href="${attr(e.log.sheetUrl)}" target="_blank" rel="noopener">Mở sheet đăng ký ${ic('ext', 'sm')}</a>` : ''}</section>` : '');
    return html;
  }
});
function eventStatusTag(e) {
  const now = Date.now(), b = tms(e.batDau), en = tms(e.ketThuc) + 86400e3;
  if (e.ketThuc && now > en) return tag('Đã xong', 'done');
  if (e.batDau && now >= b) return tag('Đang diễn ra');
  return tag('Sắp tới');
}

/* ================= P-08 Góp ý ================= */
route('gop-y', {
  can: () => !isBod(),
  render() {
    const s = App.state;
    const anon = App.ui.gyAnon === '1';
    const mine = s.feedback;
    const ph = s.term.giaiDoan;
    const used = s.points.filter(p => p.nguon === 'gop-y' && p.giaiDoan === ph).length;
    let html = topbar('Góp ý');
    html += `<section class="eco-card"><div class="seg"><button class="${!anon ? 'is-active' : ''}" data-act="set" data-k="gyAnon" data-v="">Có tên</button><button class="${anon ? 'is-active' : ''}" data-act="set" data-k="gyAnon" data-v="1">Ẩn danh</button></div>
      <p class="small ${anon ? '' : 'muted'}">${anon ? '<b>Góp ý ẩn danh không được cộng điểm.</b> App không lưu bất kỳ thông tin nào về người gửi.' : '+10 điểm khi BOD áp dụng góp ý, tối đa 2 lần mỗi giai đoạn.'}</p>
      <textarea class="eco-input" id="gyText" placeholder="Bạn muốn CLB thay đổi hoặc cải thiện điều gì?"></textarea>
      <button class="eco-btn eco-btn--filled" data-act="gySend">Gửi góp ý</button></section>`;
    html += `<section class="eco-card"><div class="head"><h2>Góp ý có tên của bạn</h2><span class="small muted">Đã áp dụng ${used}/2 lần trong giai đoạn</span></div>${mine.length ? `<div class="eco-list">${mine.map(g => `<div><div class="li-main"><span style="white-space:pre-wrap">${esc(g.noiDung)}</span><span class="sub">${esc(fD(g.luc))}</span></div>${g.apDung ? tag('Đã áp dụng', 'done') : tag('Chưa áp dụng')}</div>`).join('')}</div>` : '<p class="muted">Chưa có.</p>'}</section>`;
    return html;
  }
});
H.gySend = async () => {
  const t = document.getElementById('gyText').value.trim();
  if (!t) return toast('Nhập nội dung góp ý.', true);
  await act('feedbackSend', { noiDung: t, anDanh: App.ui.gyAnon === '1' }, 'Đã gửi góp ý. Cảm ơn bạn!');
};

/* ================= P-09 Tôi ================= */
route('toi', {
  render() {
    const s = App.state, me = s.me, r = me.roles;
    const theme = store.get('theme', 'auto');
    let html = topbar('Tôi');
    html += `<section class="eco-card"><div class="row nowrap">${avatar(me, 'lg')}<div class="grow"><h2>${esc(me.hoTen)}</h2><div class="muted">${esc(r.root ? 'Quản trị gốc · tài khoản Gmail CLB' : banLabel(me))}${me.lop ? ' · Lớp ' + esc(me.lop) : ''}</div>
      ${!r.root && !r.bod ? `<div class="small muted">${me.loai === 'bo-sung' ? 'Thành viên bổ sung' : 'Thành viên chính thức'}${me.dot ? ' · gia nhập ' + ({ OD: 'đợt Oday', D1: 'Đợt 1', D2: 'Đợt 2', CU: 'trước khi dùng app' }[me.dot] || me.dot) : ''}</div>` : ''}
      <div class="row" style="margin-top:6px">${r.ucv ? tag('UCV') : ''}${r.core ? tag('Core team') : ''}${(r.ns || []).length ? tag('NS phụ trách ' + r.ns.join(', ')) : ''}${r.seeding ? tag('NS seeding') : ''}</div></div></div>
      ${!r.root ? `<div class="row"><label class="eco-btn">Đổi avatar<input type="file" accept="image/*" class="hide" data-change="avatarPick"></label>${me.avatar ? '<button class="eco-btn" data-act="avatarDel">Bỏ avatar</button>' : ''}</div>` : ''}</section>`;
    html += `<section class="eco-card"><h2>Giao diện</h2><div class="seg">${[['light', 'Sáng'], ['dark', 'Tối'], ['auto', 'Theo máy']].map(([v, l]) => `<button class="${theme === v ? 'is-active' : ''}" data-act="setTheme" data-v="${v}">${l}</button>`).join('')}</div></section>`;
    html += `<section class="eco-card"><h2>Thông báo</h2><p class="small">Thông báo của app hiện ở chuông ${ic('bell', 'sm')} và trang <a href="#/thong-bao">Thông báo</a>. Kết nối bot Zalo và thông báo đẩy về điện thoại sẽ được bổ sung trong bản cập nhật sau.</p>
      <button class="eco-btn" data-act="a2hsShow">Hướng dẫn thêm app vào màn hình chính</button></section>`;
    if (!r.bod && !r.root) {
      html += `<section class="eco-card"><h2>Facebook để seeding</h2><p class="small muted">App dò tên theo các tài khoản này khi ghi nhận react, comment.</p>
        <div class="eco-list"><div><div class="li-main"><b>${esc(me.tenFb || '(chưa có)')}</b><span class="sub">Tên Facebook trong danh sách thành viên</span></div></div>
        ${me.fbPhu.map((n, i) => `<div><div class="li-main"><b>${esc(n)}</b><span class="sub">Tài khoản / page tự thêm</span></div><button class="eco-btn eco-btn--sm" data-act="fbDel" data-i="${i}">Xóa</button></div>`).join('')}</div>
        <div class="row nowrap"><input class="eco-input" id="fbNew" placeholder="Tên tài khoản hoặc page, đúng như hiện trên Facebook"><button class="eco-btn" data-act="fbAdd">${ic('plus', 'sm')} Thêm</button></div></section>`;
    }
    html += `<section class="eco-card"><h2>Tài khoản</h2><div class="small muted">${esc(me.email)}</div>
      <form class="form" id="pwForm" onsubmit="return false"><div class="eco-field"><label>Mật khẩu hiện tại</label><input class="eco-input" type="password" id="pw0" autocomplete="current-password"></div>
      <div class="eco-field"><label>Mật khẩu mới</label><input class="eco-input" type="password" id="pw1" autocomplete="new-password" minlength="6"><span class="hint">Ít nhất 6 ký tự.</span></div>
      <div class="eco-field"><label>Nhập lại mật khẩu mới</label><input class="eco-input" type="password" id="pw2" autocomplete="new-password"></div>
      <div class="row"><button class="eco-btn eco-btn--filled" data-act="pwChange">Đổi mật khẩu</button><button class="eco-btn" data-act="logout">Đăng xuất</button></div></form></section>`;
    return html;
  }
});
H.setTheme = el => { store.set('theme', el.dataset.v); render(); };
H.a2hsShow = () => showA2HS();
H.logout = async () => { try { await api('logout'); } catch (e) { } logoutLocal(); };
H.pwChange = async () => {
  const a = document.getElementById('pw1').value, b = document.getElementById('pw2').value;
  if (a !== b) return toast('Hai lần nhập mật khẩu mới chưa khớp.', true);
  await call('changePassword', { oldPassword: document.getElementById('pw0').value, newPassword: a });
  toast('Đã đổi mật khẩu.');
  const s = await api('state'); setState(s); render();
};
H.fbAdd = () => { const v = document.getElementById('fbNew').value.trim(); if (!v) return; act('profileSave', { fbPhu: App.state.me.fbPhu.concat([v]) }, 'Đã thêm.'); };
H.fbDel = el => { const l = App.state.me.fbPhu.slice(); l.splice(+el.dataset.i, 1); act('profileSave', { fbPhu: l }, 'Đã xóa.'); };
H.avatarDel = () => act('profileSave', { avatar: '' });
H.avatarPick = async el => {
  const f = el.files[0]; if (!f) return;
  const url = await shrinkImage(f, 96);
  act('profileSave', { avatar: url }, 'Đã đổi avatar.');
};
function shrinkImage(file, size) {
  return new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      ok(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => bad(new Error('Không đọc được ảnh.'));
    img.src = URL.createObjectURL(file);
  });
}

/* ================= P-10 Ảnh story ================= */
route('anh-story', {
  can: () => !isBod(),
  render() {
    const o = storyOpts();
    const items = [['avatar', 'Avatar'], ['ten', 'Họ tên, ban và mảng'], ['diem', 'Điểm và hạng'], ['top', 'Top ' + App.state.settings.top + '%'], ['log', 'Số buổi log'], ['sukien', 'Sự kiện đã tham gia'], ['task', 'Task đã đạt'], ['cert', 'Certificate (dự kiến)']];
    let html = topbar('Ảnh story');
    html += `<div class="grid2"><section class="eco-card"><h2>Thông tin hiện trên ảnh</h2>${items.map(([k, l]) => `<label class="opt"><input type="checkbox" class="chk" data-change="storyOpt" data-k="${k}" ${o[k] ? 'checked' : ''}> ${l}</label>`).join('')}
      <button class="eco-btn eco-btn--filled" data-act="storyDl">${ic('download', 'sm')} Tải ảnh về</button></section>
      <section class="eco-card" style="align-items:center"><canvas id="story" width="1080" height="1920" style="width:100%;max-width:270px;border-radius:12px;border:1px solid var(--border)"></canvas></section></div>`;
    return html;
  },
  after() { drawStory(); }
});
function storyOpts() { return Object.assign({ avatar: 1, ten: 1, diem: 1, top: 1, log: 1, sukien: 1, task: 1, cert: 0 }, App.ui.story || {}); }
H.storyOpt = el => { App.ui.story = Object.assign(storyOpts(), { [el.dataset.k]: el.checked ? 1 : 0 }); drawStory(); };
H.storyDl = () => { const a = document.createElement('a'); a.download = 'eco-story.png'; a.href = document.getElementById('story').toDataURL('image/png'); a.click(); };
async function drawStory() {
  const c = document.getElementById('story'); if (!c) return;
  const g = c.getContext('2d'), s = App.state, me = s.me, o = storyOpts(), k = (s.kpi || {})[me.id] || { logs: [], tasks: [] };
  await document.fonts.ready;
  const F = w => `${w} ${'"Be Vietnam Pro", system-ui, sans-serif'}`;
  g.fillStyle = '#faf8f5'; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#274e13'; g.fillRect(0, 0, 1080, 300);
  const logo = await loadImg('assets/logo.png');
  g.fillStyle = '#faf8f5'; g.beginPath(); g.arc(150, 150, 90, 0, Math.PI * 2); g.fill();
  if (logo) g.drawImage(logo, 80, 80, 140, 140);
  g.fillStyle = '#faf8f5'; g.font = F('500 52px'); g.fillText('CLB Môi trường ECO', 280, 140); g.font = F('400 38px'); g.fillText('Trần Đại Nghĩa · ' + termLabel(), 280, 200);
  let y = 420;
  if (o.avatar) {
    g.save(); g.beginPath(); g.arc(540, y + 110, 110, 0, Math.PI * 2); g.clip();
    const av = me.avatar ? await loadImg(me.avatar) : null;
    if (av) g.drawImage(av, 430, y, 220, 220); else { g.fillStyle = '#e8e5de'; g.fillRect(430, y, 220, 220); g.fillStyle = '#72706b'; g.font = F('500 90px'); g.textAlign = 'center'; g.fillText(initials(me.hoTen).replace(/&[^;]+;/g, ''), 540, y + 142); g.textAlign = 'left'; }
    g.restore(); y += 280;
  }
  g.textAlign = 'center';
  if (o.ten) { g.fillStyle = '#27251e'; g.font = F('500 64px'); g.fillText(me.hoTen, 540, y + 40); g.font = F('400 40px'); g.fillStyle = '#72706b'; g.fillText(banLabel(me), 540, y + 100); y += 170; }
  const rk = rankNow(), myR = rk.rows.find(r => r.id === me.id);
  const lines = [];
  if (o.diem && myR) lines.push([String(myR.score), 'điểm GĐ' + rk.phase + ' · hạng ' + myR.rank + '/' + rk.total]);
  if (o.top && myR && myR.top) lines.push(['TOP ' + s.settings.top + '%', 'bảng xếp hạng giai đoạn ' + rk.phase]);
  if (o.log) lines.push([fmtN(k.logs.reduce((a, l) => a + l.attended, 0)), 'buổi log đã tham gia']);
  if (o.task) lines.push([String(k.tasks.filter(t => t.kq === 'dat').length), 'task đạt']);
  if (o.sukien) lines.push([String(new Set(k.logs.map(l => l.eventId).concat(k.tasks.map(t => (App.idx.task[t.taskId] || {}).eventId)).filter(Boolean)).size), 'sự kiện đã góp sức']);
  if (o.cert && s.myCert && s.myCert.kq !== 'chua') lines.push(['✓', 'đủ điều kiện certificate']);
  lines.slice(0, 6).forEach(([big, small]) => {
    g.fillStyle = '#fdfbfa'; roundRect(g, 140, y, 800, 170, 32); g.fill();
    g.fillStyle = '#27251e'; g.font = F('500 72px'); g.fillText(big, 540, y + 90);
    g.fillStyle = '#72706b'; g.font = F('400 36px'); g.fillText(small, 540, y + 140);
    y += 200;
  });
  g.fillStyle = '#274e13'; g.font = F('500 36px'); g.fillText('#ECOTranDaiNghia', 540, 1840);
  g.textAlign = 'left';
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function loadImg(src) { return new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }); }

/* ================= P-11 Thông báo ================= */
route('thong-bao', {
  render() {
    const ns = App.state.notifications;
    const today = nowVN().slice(0, 10);
    const a = ns.filter(n => n.luc.slice(0, 10) === today), b = ns.filter(n => n.luc.slice(0, 10) !== today);
    const list = arr => `<div class="eco-list">${arr.map(n => `<button data-act="notifOpen" data-id="${n.id}" data-link="${attr(n.link)}"><span style="width:8px;height:8px;border-radius:50%;flex:none;background:${n.daDoc ? 'transparent' : 'var(--accent)'}"></span><div class="li-main"><b>${esc(n.tieuDe)}</b><span class="sub">${esc(n.noiDung)}${n.noiDung ? ' · ' : ''}${esc(fDT(n.luc))}</span></div></button>`).join('')}</div>`;
    let html = topbar('Thông báo', { noBell: true, right: ns.some(n => !n.daDoc) ? '<button class="eco-btn eco-btn--sm" data-act="notifAll">Đánh dấu đã đọc hết</button>' : '' });
    if (!ns.length) return html + empty('Chưa có thông báo nào.');
    if (a.length) html += `<section class="eco-card"><h2>Hôm nay</h2>${list(a)}</section>`;
    if (b.length) html += `<section class="eco-card"><h2>Trước đó</h2>${list(b)}</section>`;
    html += `<p class="small muted">Thông báo cũ hơn ${esc(App.state.settings.giuThongBao)} ngày tự xóa.</p>`;
    return html;
  }
});
H.notifAll = () => act('notifRead', { all: true });
H.notifOpen = async el => {
  const link = el.dataset.link;
  api('notifRead', { ids: [el.dataset.id] }).then(s => { if (s && s.me) { setState(s); if (!link) render(); } }).catch(() => { });
  if (link) go(link);
};
