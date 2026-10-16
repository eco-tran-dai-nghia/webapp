/**
 * Các thao tác thay đổi dữ liệu. Mỗi thao tác kiểm quyền, ghi nhật ký, rồi trả về gói dữ liệu mới.
 */

var API = API || {};

function notify_(memberIds, tieuDe, noiDung, link) {
  var luc = nowS_();
  var seen = {};
  insert_('ThongBao', memberIds.filter(function (id) { if (!id || seen[id]) return false; seen[id] = 1; return true; }).map(function (id) {
    return { id: uid_(), memberId: id, tieuDe: tieuDe, noiDung: noiDung || '', link: link || '', luc: luc, daDoc: '' };
  }));
}

/** Email báo về tài khoản CLB (TB-06), nếu BOD bật loại này. */
function mailClub_(kind, subject, body) {
  try {
    var on = settingJson_('emailBao', {});
    if (!on[kind]) return;
    MailApp.sendEmail(ownerEmail_(), '[App ECO] ' + subject, body);
  } catch (e) { console.error(e); }
}

function member_(id) { var m = byId_('ThanhVien', id); if (!m) fail_('Không tìm thấy thành viên.'); return m; }
function nsOf_(ban) {
  return table_('ThanhVien').filter(function (m) { return m.trangThai === 'active' && String(m.nsBan || '').split(',').map(function (x) { return x.trim(); }).indexOf(ban) >= 0; }).map(function (m) { return m.id; });
}
function phaseNow_() { return setting_('ghiNhan') === 'tat' ? '0' : String(setting_('giaiDoan')); }
function countsNow_() { return setting_('ghiNhan') === 'tat' ? 'khong' : ''; }
function str_(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 500); }
function needTime_(s, label) { if (!parseT_(s)) fail_(label + ' chưa đúng.'); return String(s).length === 16 ? s + ':00' : s; }

/* ======================= Task ======================= */

function canManageTask_(ctx, t) {
  if (ctx.isBod) return true;
  if (!ctx.nsBans.length) return false;
  var as = table_('PhanCong').filter(function (a) { return a.taskId === t.id; });
  return as.some(function (a) { var m = byId_('ThanhVien', a.memberId); return m && ctx.nsBans.indexOf(m.ban) >= 0; });
}

API.taskCreate = function (ctx, a) {
  if (!ctx.isBod && !ctx.nsBans.length) fail_('Bạn không có quyền nhập task.');
  return withLock_(function () {
    var ev = byId_('SuKien', a.eventId);
    if (!ev) fail_('Chọn sự kiện cho task.');
    var ten = str_(a.ten, 200);
    if (!ten) fail_('Nhập tên task.');
    var han = needTime_(a.hanChot, 'Hạn chót');
    var ids = (a.memberIds || []).filter(String);
    if (!ids.length) fail_('Chọn ít nhất một người được giao.');
    ids.forEach(function (id) {
      var m = member_(id);
      if (!ctx.isBod && (m.ban === 'BOD' || ctx.nsBans.indexOf(m.ban) < 0)) fail_(m.hoTen + ' không thuộc ban bạn phụ trách.');
    });
    var t = { id: uid_(), eventId: ev.id, ten: ten, moTa: str_(a.moTa, 3000), hanChot: han, taoBoi: ctx.me.hoTen, taoLuc: nowS_(), huy: '', huyBoi: '', tinh: countsNow_(), nhatKyHan: '[]' };
    insert_('Task', [t]);
    insert_('PhanCong', ids.map(function (id) { return { id: uid_(), taskId: t.id, memberId: id }; }));
    notify_(ids, 'Task mới: ' + ten, 'Hạn ' + han.slice(0, 16) + ' · ' + ev.ten, '#/task/' + t.id);
    log_(ctx.me.hoTen, 'Task', 'Nhập task "' + ten + '" cho ' + ids.length + ' người');
    return buildState_(ctx);
  });
};

API.taskEdit = function (ctx, a) {
  return withLock_(function () {
    var t = byId_('Task', a.taskId);
    if (!t || !canManageTask_(ctx, t)) fail_('Bạn không có quyền sửa task này.');
    if (a.ten !== undefined) t.ten = str_(a.ten, 200) || t.ten;
    if (a.moTa !== undefined) t.moTa = str_(a.moTa, 3000);
    if (a.hanChot && a.hanChot !== t.hanChot) {
      var han = needTime_(a.hanChot, 'Hạn chót');
      var nk = jsonOr_(t.nhatKyHan, []);
      nk.push({ cu: t.hanChot, moi: han, lyDo: str_(a.lyDo, 300), boi: ctx.me.hoTen, luc: nowS_() });
      log_(ctx.me.hoTen, 'Task', 'Sửa hạn "' + t.ten + '": ' + t.hanChot.slice(0, 16) + ' → ' + han.slice(0, 16));
      t.hanChot = han; t.nhatKyHan = JSON.stringify(nk);
      var ids = table_('PhanCong').filter(function (x) { return x.taskId === t.id && !x.xacNhanLuc; }).map(function (x) { return x.memberId; });
      notify_(ids, 'Đổi hạn task: ' + t.ten, 'Hạn mới ' + han.slice(0, 16), '#/task/' + t.id);
      deleteWhere_('DaNhac', function (r) { return r.khoa.indexOf(t.id + '|') === 0; });
    }
    if (a.addMemberIds && a.addMemberIds.length) {
      var have = {};
      table_('PhanCong').forEach(function (x) { if (x.taskId === t.id) have[x.memberId] = 1; });
      var add = a.addMemberIds.filter(function (id) { return !have[id]; });
      add.forEach(function (id) { var m = member_(id); if (!ctx.isBod && ctx.nsBans.indexOf(m.ban) < 0) fail_(m.hoTen + ' không thuộc ban bạn phụ trách.'); });
      insert_('PhanCong', add.map(function (id) { return { id: uid_(), taskId: t.id, memberId: id }; }));
      notify_(add, 'Task mới: ' + t.ten, 'Hạn ' + t.hanChot.slice(0, 16), '#/task/' + t.id);
    }
    if (a.removeAssignId) {
      var x = byId_('PhanCong', a.removeAssignId);
      if (x && x.taskId === t.id) { deleteWhere_('PhanCong', function (r) { return r.id === x.id; }); log_(ctx.me.hoTen, 'Task', 'Bỏ một người khỏi task "' + t.ten + '"'); }
    }
    update_('Task', t);
    return buildState_(ctx);
  });
};

API.taskCancel = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var t = byId_('Task', a.taskId);
    if (!t) fail_('Không tìm thấy task.');
    t.huy = a.undo ? '' : 'co'; t.huyBoi = a.undo ? '' : ctx.me.hoTen;
    update_('Task', t);
    log_(ctx.me.hoTen, 'Task', (a.undo ? 'Bỏ hủy' : 'Hủy') + ' task "' + t.ten + '"');
    return buildState_(ctx);
  });
};

function assignCtx_(ctx, id) {
  var x = byId_('PhanCong', id);
  if (!x) fail_('Không tìm thấy task.');
  var t = byId_('Task', x.taskId);
  if (t.huy === 'co') fail_('Task này đã bị hủy.');
  var self = x.memberId === ctx.me.id;
  var manage = canManageTask_(ctx, t);
  return { x: x, t: t, self: self, manage: manage };
}

API.taskConfirm = function (ctx, a) {
  return withLock_(function () {
    var c = assignCtx_(ctx, a.assignId);
    if (!c.self && !c.manage) fail_('Bạn không có quyền với task này.');
    if (c.x.chatLuong) fail_('Task đã được chấm.');
    if (!c.x.xacNhanLuc) {
      var B = calcBase_();
      if (c.self && Date.now() > ms_(c.t.hanChot) + B.khongLamH * 3600000) fail_('Task đã quá hạn hơn ' + B.khongLamH + ' giờ nên đã thành Không làm. Nhắn Nhân sự phụ trách ban nếu có nhầm lẫn.');
      c.x.xacNhanLuc = nowS_(); c.x.xacNhanBoi = c.self ? '' : ctx.me.hoTen;
    }
    if (a.nopDungHan !== undefined && c.manage) c.x.nopDungHan = a.nopDungHan ? 'co' : '';
    if (a.chatLuong) {
      if (!ctx.isBod) fail_('Chỉ BOD chấm chất lượng.');
      gradeSet_(ctx, c, a.chatLuong);
    }
    update_('PhanCong', c.x);
    if (!c.self) {
      var m = byId_('ThanhVien', c.x.memberId);
      log_(ctx.me.hoTen, 'Task', 'Xác nhận thay ' + (m ? m.hoTen : '') + ' · "' + c.t.ten + '"' + (c.x.nopDungHan === 'co' ? ' (nộp đúng hạn)' : ''));
    }
    return buildState_(ctx);
  });
};

API.taskUnconfirm = function (ctx, a) {
  return withLock_(function () {
    var c = assignCtx_(ctx, a.assignId);
    if (!c.self && !c.manage) fail_('Bạn không có quyền với task này.');
    if (c.x.chatLuong) fail_('Task đã được chấm, không hủy xác nhận được.');
    c.x.xacNhanLuc = ''; c.x.xacNhanBoi = ''; c.x.nopDungHan = '';
    update_('PhanCong', c.x);
    if (!c.self) log_(ctx.me.hoTen, 'Task', 'Hủy xác nhận · "' + c.t.ten + '"');
    return buildState_(ctx);
  });
};

API.taskOnTime = function (ctx, a) {
  return withLock_(function () {
    var c = assignCtx_(ctx, a.assignId);
    if (!c.manage) fail_('Chỉ Nhân sự phụ trách ban và BOD dùng nút này.');
    c.x.nopDungHan = a.value ? 'co' : '';
    update_('PhanCong', c.x);
    var m = byId_('ThanhVien', c.x.memberId);
    log_(ctx.me.hoTen, 'Task', (a.value ? 'Đánh dấu nộp đúng hạn' : 'Bỏ nộp đúng hạn') + ' · ' + (m ? m.hoTen : '') + ' · "' + c.t.ten + '"');
    return buildState_(ctx);
  });
};

function gradeSet_(ctx, c, q) {
  if (['HC', 'CS', 'SS'].indexOf(q) < 0) fail_('Mức chất lượng không hợp lệ.');
  var m = byId_('ThanhVien', c.x.memberId);
  if (m && m.ban === 'BOD') fail_('Task của BOD không chấm chất lượng.');
  var old = c.x.chatLuong;
  c.x.chatLuong = q; c.x.chamBoi = ctx.me.hoTen; c.x.chamLuc = nowS_();
  var name = { HC: 'Hoàn chỉnh', CS: 'Cần chỉnh sửa', SS: 'Làm quá sơ sài' };
  log_(ctx.me.hoTen, 'Chấm task', (old ? 'Sửa chấm ' + name[old] + ' → ' : 'Chấm ') + name[q] + ' · ' + (m ? m.hoTen : '') + ' · "' + c.t.ten + '"');
  notify_([c.x.memberId], 'Task đã được chấm: ' + c.t.ten, name[q], '#/task/' + c.t.id);
}

API.taskGrade = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var c = assignCtx_(ctx, a.assignId);
    if (!c.x.xacNhanLuc) fail_('Task chưa được xác nhận hoàn thành.');
    if (a.nopDungHan !== undefined) c.x.nopDungHan = a.nopDungHan ? 'co' : '';
    gradeSet_(ctx, c, a.chatLuong);
    update_('PhanCong', c.x);
    return buildState_(ctx);
  });
};

/* ======================= Log ======================= */

function eventOf_(id) { var e = byId_('SuKien', id); if (!e) fail_('Không tìm thấy sự kiện.'); return e; }
function notClosed_(e) { if (e.logTrangThai === 'chot') fail_('Đợt log đã chốt. Mở chốt lại trước khi sửa.'); }

API.logSetup = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var e = eventOf_(a.eventId);
    if (!e.logTrangThai) { e.logTrangThai = 'mo'; e.tinh = e.tinh || countsNow_(); }
    update_('SuKien', e);
    log_(ctx.me.hoTen, 'Log', 'Thiết lập log cho "' + e.ten + '"');
    return buildState_(ctx);
  });
};

API.sessionSave = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var e = eventOf_(a.eventId);
    notClosed_(e);
    if (!e.logTrangThai) e.logTrangThai = 'mo';
    var ten = str_(a.ten, 120);
    if (!ten) fail_('Nhập tên buổi.');
    var t = needTime_(a.thoiDiem, 'Thời điểm');
    var dur = Number(a.thoiLuong) === 180 ? 180 : 90;
    if (a.id) {
      var s = byId_('BuoiLog', a.id);
      if (!s) fail_('Không tìm thấy buổi.');
      s.ten = ten; s.thoiDiem = t; s.thoiLuong = dur;
      update_('BuoiLog', s);
    } else {
      insert_('BuoiLog', [{ id: uid_(), eventId: e.id, ten: ten, thoiDiem: t, thoiLuong: dur, huyLyDo: '', keHoach: '{}', taoLuc: nowS_() }]);
    }
    update_('SuKien', e);
    log_(ctx.me.hoTen, 'Log', (a.id ? 'Sửa' : 'Thêm') + ' buổi "' + ten + '" · ' + e.ten);
    syncRegSheetSafe_(e);
    return buildState_(ctx);
  });
};

API.sessionDelete = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var s = byId_('BuoiLog', a.id);
    if (!s) fail_('Không tìm thấy buổi.');
    var e = eventOf_(s.eventId);
    notClosed_(e);
    if (table_('DiemDanh').some(function (d) { return d.buoiId === s.id; })) fail_('Buổi đã có điểm danh, không xóa được.');
    deleteWhere_('BuoiLog', function (r) { return r.id === s.id; });
    log_(ctx.me.hoTen, 'Log', 'Xóa buổi "' + s.ten + '" · ' + e.ten);
    syncRegSheetSafe_(e);
    return buildState_(ctx);
  });
};

API.quotaSave = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var e = eventOf_(a.eventId);
    notClosed_(e);
    var clean = function (o) { var r = {}; Object.keys(o || {}).forEach(function (k) { if (o[k] !== '' && o[k] !== null && !isNaN(Number(o[k]))) r[k] = Number(o[k]); }); return JSON.stringify(r); };
    e.chiTieuBan = clean(a.ban); e.chiTieuKhoi = clean(a.khoi); e.chiTieuNguoi = clean(a.nguoi);
    update_('SuKien', e);
    log_(ctx.me.hoTen, 'Log', 'Đặt chỉ tiêu · ' + e.ten);
    syncRegSheetSafe_(e);
    return buildState_(ctx);
  });
};

API.planSave = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var s = byId_('BuoiLog', a.sessionId);
    if (!s) fail_('Không tìm thấy buổi.');
    var k = a.keHoach || {};
    s.keHoach = JSON.stringify({ mucTieu: str_(k.mucTieu, 2000), trangThai: str_(k.trangThai, 40), anh: str_(k.anh, 500) });
    update_('BuoiLog', s);
    return buildState_(ctx);
  });
};

/** Điểm danh: gửi danh sách đầy đủ người có mặt của buổi; app thêm người mới tick, bỏ người bị bỏ tick. */
API.attendSave = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var s = byId_('BuoiLog', a.sessionId);
    if (!s) fail_('Không tìm thấy buổi.');
    var e = eventOf_(s.eventId);
    notClosed_(e);
    var loai = a.huyKhac ? 'huy-khac' : 'co-mat';
    if (a.huyKhac) {
      s.huyLyDo = str_(a.lyDo, 300) || 'Hủy vì lý do khác';
      update_('BuoiLog', s);
    }
    var want = {};
    (a.memberIds || []).forEach(function (id) { want[id] = 1; });
    var have = {};
    table_('DiemDanh').forEach(function (d) { if (d.buoiId === s.id) have[d.memberId] = 1; });
    var add = Object.keys(want).filter(function (id) { return !have[id]; });
    var rem = Object.keys(have).filter(function (id) { return !want[id]; });
    var luc = nowS_();
    insert_('DiemDanh', add.map(function (id) { return { id: uid_(), buoiId: s.id, memberId: id, loai: loai, luc: luc, boi: ctx.me.hoTen }; }));
    if (rem.length) deleteWhere_('DiemDanh', function (d) { return d.buoiId === s.id && rem.indexOf(d.memberId) >= 0; });
    log_(ctx.me.hoTen, 'Điểm danh', (a.huyKhac ? 'Hủy buổi (lý do khác) ' : 'Điểm danh ') + '"' + s.ten + '" · ' + e.ten + ': +' + add.length + (rem.length ? ', bỏ ' + rem.length : '') + ', tổng ' + Object.keys(want).length);
    return buildState_(ctx);
  });
};

/** Chốt đợt log: tính số buổi được giao cuối và cộng điểm log vượt (mục 5.1). */
API.logClose = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var e = eventOf_(a.eventId);
    notClosed_(e);
    var B = calcBase_();
    var st = B.logStats[e.id];
    if (!st || !st.sessions.length) fail_('Sự kiện chưa có buổi log nào.');
    var per = num_(table_('DanhMucDiem').filter(function (c) { return c.id === 'log-vuot'; }).map(function (c) { return c.diem; })[0], 20);
    var rows = [], extraPeople = 0;
    var phase = phaseNow_();
    rankable_().forEach(function (m) {
      var r = memberEventLog_(e, st, m, B.attendKey);
      if (r.extra > 0 && e.tinh !== 'khong') {
        extraPeople++;
        rows.push({ id: uid_(), memberId: m.id, hoatDong: 'log-vuot', diem: r.extra * per, eventId: e.id, chiTiet: 'Vượt ' + r.extra + ' buổi (90 phút) · ' + e.ten, giaiDoan: phase, nhiemKy: B.term, nguon: 'log', refId: e.id, luc: nowS_(), boi: ctx.me.hoTen });
      }
    });
    insert_('Diem', rows);
    e.logTrangThai = 'chot'; e.chotLuc = nowS_(); e.chotBoi = ctx.me.hoTen;
    e.ketQuaChot = JSON.stringify({ planned: st.planned, held: st.held, extraPeople: extraPeople, points: rows.reduce(function (s, r) { return s + r.diem; }, 0) });
    update_('SuKien', e);
    notify_(rows.map(function (r) { return r.memberId; }), 'Cộng điểm log vượt', e.ten, '#/xep-hang');
    log_(ctx.me.hoTen, 'Chốt log', 'Chốt "' + e.ten + '": ' + st.held + '/' + st.planned + ' buổi diễn ra, cộng log vượt cho ' + extraPeople + ' người');
    return buildState_(ctx);
  });
};

API.logReopen = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var e = eventOf_(a.eventId);
    if (e.logTrangThai !== 'chot') fail_('Đợt log chưa chốt.');
    var n = 0;
    table_('Diem').forEach(function (p) {
      if (p.nguon === 'log' && p.refId === e.id && p.huy !== 'co') { p.huy = 'co'; p.huyBoi = ctx.me.hoTen + ' (mở chốt)'; p.huyLuc = nowS_(); update_('Diem', p); n++; }
    });
    e.logTrangThai = 'mo';
    update_('SuKien', e);
    log_(ctx.me.hoTen, 'Chốt log', 'Mở chốt lại "' + e.ten + '", gỡ ' + n + ' dòng điểm log vượt (sẽ tính lại khi chốt)');
    return buildState_(ctx);
  });
};

/* ---------- Sheet đăng ký log (LOG-03) ---------- */

function regFolder_() {
  var id = props_().getProperty('REG_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var f = DriveApp.createFolder('ECO - Đăng ký log');
  props_().setProperty('REG_FOLDER', f.getId());
  return f;
}

function syncRegSheetSafe_(e) { try { syncRegSheet_(e); } catch (err) { console.error(err && err.stack || err); } }

function syncRegSheet_(e) {
  var sessions = table_('BuoiLog').filter(function (s) { return s.eventId === e.id; }).sort(function (a, b) { return ms_(a.thoiDiem) - ms_(b.thoiDiem); });
  var ss;
  if (e.sheetId) { try { ss = SpreadsheetApp.openById(e.sheetId); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('[ECO] Đăng ký log - ' + e.ten);
    var file = DriveApp.getFileById(ss.getId());
    file.moveTo(regFolder_());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    e.sheetId = ss.getId();
    update_('SuKien', e);
  }
  var sh = ss.getSheets()[0];
  sh.setName('Đăng ký');
  var HEAD = 4, FIRST_COL = 5;
  // Giữ lại các ô đã tick: theo mã buổi (ghi chú ở tiêu đề cột) và họ tên + ban.
  var old = {};
  if (sh.getLastRow() > HEAD && sh.getLastColumn() >= FIRST_COL) {
    var nCol = sh.getLastColumn() - FIRST_COL + 1;
    var notes = sh.getRange(HEAD, FIRST_COL, 1, nCol).getNotes()[0];
    var vals = sh.getRange(HEAD + 1, 1, sh.getLastRow() - HEAD, sh.getLastColumn()).getValues();
    vals.forEach(function (row) {
      var key = row[1] + '|' + row[2];
      notes.forEach(function (sid, i) { if (sid && row[FIRST_COL - 1 + i] === true) old[sid + '|' + key] = true; });
    });
  }
  var org = orgList_();
  var banName = {};
  org.forEach(function (b) { banName[b.ma] = b.ten; });
  var ms = rankable_().sort(function (a, b) { return a.ban === b.ban ? a.hoTen.localeCompare(b.hoTen, 'vi') : org.map(function (o) { return o.ma; }).indexOf(a.ban) - org.map(function (o) { return o.ma; }).indexOf(b.ban); });
  sh.clear();
  try { sh.getDataRange().removeCheckboxes(); } catch (err) { }
  var qb = jsonOr_(e.chiTieuBan, {});
  var quotaText = Object.keys(qb).map(function (k) { return k + ' ' + qb[k] + ' buổi'; }).join(' · ');
  sh.getRange(1, 1).setValue('Đăng ký log · ' + e.ten).setFontWeight('bold').setFontSize(14);
  sh.getRange(2, 1).setValue((e.diaDiem ? 'Địa điểm: ' + e.diaDiem + '. ' : '') + (quotaText ? 'Chỉ tiêu: ' + quotaText + ' (buổi 180 phút tính 2 buổi). ' : '') + 'Tick vào buổi bạn sẽ đến. Sheet này chỉ để đăng ký; điểm danh do BOD làm trên app.');
  sh.getRange(3, 1).setValue('Cập nhật lúc ' + nowS_().slice(0, 16));
  var head = ['STT', 'Họ và tên', 'Ban', 'Lớp'].concat(sessions.map(function (s) {
    var d = parseT_(s.thoiDiem);
    return s.ten + '\n' + Utilities.formatDate(d, TZ, 'EEE dd/MM HH:mm').replace('Mon', 'T2').replace('Tue', 'T3').replace('Wed', 'T4').replace('Thu', 'T5').replace('Fri', 'T6').replace('Sat', 'T7').replace('Sun', 'CN') + ' · ' + s.thoiLuong + "'";
  }));
  sh.getRange(HEAD, 1, 1, head.length).setValues([head]).setFontWeight('bold').setWrap(true).setVerticalAlignment('middle');
  if (sessions.length) sh.getRange(HEAD, FIRST_COL, 1, sessions.length).setNotes([sessions.map(function (s) { return s.id; })]);
  if (ms.length) {
    var rows = ms.map(function (m, i) {
      var key = m.hoTen + '|' + (m.ban + (m.mang ? ' · ' + m.mang : ''));
      return [i + 1, m.hoTen, m.ban + (m.mang ? ' · ' + m.mang : ''), m.lop].concat(sessions.map(function (s) { return !!old[s.id + '|' + key]; }));
    });
    sh.getRange(HEAD + 1, 1, rows.length, head.length).setValues(rows);
    if (sessions.length) sh.getRange(HEAD + 1, FIRST_COL, rows.length, sessions.length).insertCheckboxes();
    var cnt = HEAD + 1 + rows.length;
    sh.getRange(cnt, 2).setValue('Số người đăng ký').setFontWeight('bold');
    sessions.forEach(function (s, i) {
      var col = columnLetter_(FIRST_COL + i);
      sh.getRange(cnt, FIRST_COL + i).setFormula('=COUNTIF(' + col + (HEAD + 1) + ':' + col + (cnt - 1) + ',TRUE)').setFontWeight('bold');
    });
  }
  sh.setFrozenRows(HEAD); sh.setFrozenColumns(2);
  sh.setColumnWidth(2, 200);
  if (sessions.length) sh.setColumnWidths(FIRST_COL, sessions.length, 130);
  sh.setRowHeight(HEAD, 48);
}

function columnLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

API.regSheetSync = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () { syncRegSheet_(eventOf_(a.eventId)); return buildState_(ctx); });
};

/* ======================= Điểm ======================= */

API.pointsAdd = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var c = byId_('DanhMucDiem', a.catalogId);
    if (!c || c.an === 'co') fail_('Chọn hoạt động.');
    var ids = (a.memberIds || []).filter(String);
    if (!ids.length) fail_('Chọn ít nhất một thành viên.');
    var ev = a.eventId ? eventOf_(a.eventId) : null;
    var B = calcBase_(), phase = phaseNow_();
    var rows = ids.map(function (id) {
      var m = member_(id);
      if (m.ban === 'BOD') fail_('BOD không có điểm.');
      return { id: uid_(), memberId: id, hoatDong: c.id, diem: num_(c.diem), eventId: ev ? ev.id : '', chiTiet: str_(a.chiTiet, 300) || c.ten, giaiDoan: phase, nhiemKy: B.term, nguon: 'bod', refId: '', luc: nowS_(), boi: ctx.me.hoTen };
    });
    insert_('Diem', rows);
    notify_(ids, 'Bạn được cộng ' + num_(c.diem) + ' điểm', c.ten, '#/xep-hang');
    log_(ctx.me.hoTen, 'Cộng điểm', c.ten + ' · +' + num_(c.diem) + ' × ' + ids.length + ' người' + (ev ? ' · ' + ev.ten : '') + (phase === '0' ? ' (đang tắt ghi nhận, không tính)' : ''));
    return buildState_(ctx);
  });
};

API.pointsCancel = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var p = byId_('Diem', a.id);
    if (!p || p.huy === 'co') fail_('Không tìm thấy dòng cộng điểm.');
    p.huy = 'co'; p.huyBoi = ctx.me.hoTen; p.huyLuc = nowS_();
    update_('Diem', p);
    var m = byId_('ThanhVien', p.memberId);
    log_(ctx.me.hoTen, 'Hủy điểm', 'Hủy +' + p.diem + ' của ' + (m ? m.hoTen : '') + ' · ' + p.chiTiet);
    return buildState_(ctx);
  });
};

API.catalogSave = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var ten = str_(a.ten, 200);
    var diem = Number(a.diem);
    if (!ten || !(diem > 0)) fail_('Nhập tên hoạt động và mức điểm lớn hơn 0.');
    if (a.id) {
      var c = byId_('DanhMucDiem', a.id);
      if (!c) fail_('Không tìm thấy hoạt động.');
      c.ten = ten; c.diem = diem; c.an = a.an ? 'co' : '';
      update_('DanhMucDiem', c);
    } else insert_('DanhMucDiem', [{ id: uid_(), ten: ten, diem: diem, tuDong: '', an: '' }]);
    log_(ctx.me.hoTen, 'Cài đặt', 'Danh mục điểm: ' + ten + ' +' + diem);
    return buildState_(ctx);
  });
};

/* ======================= Góp ý ======================= */

API.feedbackSend = function (ctx, a) {
  if (ctx.isBod) fail_('BOD không gửi góp ý trên app.');
  var nd = str_(a.noiDung, 5000);
  if (!nd) fail_('Nhập nội dung góp ý.');
  withLock_(function () {
    insert_('GopY', [{ id: uid_(), memberId: a.anDanh ? '' : ctx.me.id, noiDung: nd, luc: a.anDanh ? nowS_().slice(0, 10) + ' 00:00:00' : nowS_(), apDung: '', giaiDoan: phaseNow_(), nhiemKy: setting_('nhiemKy') }]);
  });
  mailClub_('gopY', 'Có góp ý mới', (a.anDanh ? 'Góp ý ẩn danh' : 'Góp ý có tên') + ':\n\n' + nd + '\n\nĐọc trong app: mục Hộp góp ý.');
  return buildState_(ctx);
};

API.feedbackApply = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var g = byId_('GopY', a.id);
    if (!g) fail_('Không tìm thấy góp ý.');
    if (!g.memberId) fail_('Góp ý ẩn danh không đánh dấu được.');
    if (g.apDung === 'co') fail_('Góp ý này đã được đánh dấu áp dụng.');
    var phase = phaseNow_();
    var used = table_('Diem').filter(function (p) { return p.memberId === g.memberId && p.nguon === 'gop-y' && p.huy !== 'co' && p.giaiDoan === phase && p.nhiemKy === setting_('nhiemKy'); }).length;
    g.apDung = 'co'; g.apDungBoi = ctx.me.hoTen; g.apDungLuc = nowS_();
    update_('GopY', g);
    var note = '';
    if (used >= 2) note = 'Người gửi đã đủ 2 lần cộng điểm góp ý trong giai đoạn này, nên lần này không cộng.';
    else {
      var c = byId_('DanhMucDiem', 'gop-y');
      insert_('Diem', [{ id: uid_(), memberId: g.memberId, hoatDong: 'gop-y', diem: c ? num_(c.diem) : 10, eventId: '', chiTiet: 'Góp ý được áp dụng (lần ' + (used + 1) + '/2 trong giai đoạn)', giaiDoan: phase, nhiemKy: setting_('nhiemKy'), nguon: 'gop-y', refId: g.id, luc: nowS_(), boi: ctx.me.hoTen }]);
      notify_([g.memberId], 'Góp ý của bạn được áp dụng', '+' + (c ? num_(c.diem) : 10) + ' điểm', '#/gop-y');
    }
    log_(ctx.me.hoTen, 'Góp ý', 'Đánh dấu áp dụng góp ý của ' + member_(g.memberId).hoTen + (note ? ' (không cộng điểm: đủ 2 lần)' : ''));
    var st = buildState_(ctx);
    st._note = note;
    return st;
  });
};

/* ======================= Thông báo, hồ sơ ======================= */

API.notifRead = function (ctx, a) {
  return withLock_(function () {
    table_('ThongBao').forEach(function (n) {
      if (n.memberId === ctx.me.id && n.daDoc !== 'co' && (a.all || (a.ids || []).indexOf(n.id) >= 0)) { n.daDoc = 'co'; update_('ThongBao', n); }
    });
    return buildState_(ctx);
  });
};

function cleanNotifications_() {
  var days = num_(setting_('giuThongBao'), 30);
  var lim = Date.now() - days * 86400000;
  withLock_(function () {
    deleteWhere_('ThongBao', function (n) { return ms_(n.luc) < lim; });
    deleteWhere_('PhienDN', function (s) { return ms_(s.lanCuoi) < Date.now() - 120 * 86400000; });
  });
}

API.profileSave = function (ctx, a) {
  if (ctx.isRoot) fail_('Tài khoản quản trị gốc không có hồ sơ.');
  return withLock_(function () {
    var m = member_(ctx.me.id);
    if (a.avatar !== undefined) {
      var av = String(a.avatar || '');
      if (av && (!/^data:image\/(jpeg|png|webp);base64,/.test(av) || av.length > 40000)) fail_('Ảnh không hợp lệ hoặc quá lớn.');
      m.avatar = av;
    }
    if (a.fbPhu !== undefined) {
      if (m.ban === 'BOD') fail_('BOD không đăng ký tài khoản seeding.');
      m.fbPhu = JSON.stringify((a.fbPhu || []).map(function (x) { return str_(x, 120); }).filter(String).slice(0, 10));
    }
    update_('ThanhVien', m);
    return buildState_(ctxFor_(m.id, ctx.token));
  });
};

/* ======================= Seeding ======================= */

function needSeeding_(ctx) { if (!ctx.isSeeding && !ctx.isBod) fail_('Chỉ Nhân sự phụ trách seeding dùng được chức năng này.'); }

API.seedingAdd = function (ctx, a) {
  needSeeding_(ctx);
  var link = str_(a.link, 500);
  if (!/^https?:\/\//.test(link)) fail_('Dán link bài đăng (bắt đầu bằng https://).');
  return withLock_(function () {
    if (table_('Seeding').some(function (s) { return s.link === link; })) fail_('Bài này đã được đặt nhắc hẹn rồi.');
    var days = num_(setting_('nhacSeedingSauNgay'), 2);
    insert_('Seeding', [{ id: uid_(), link: link, taoBoi: ctx.me.hoTen, taoLuc: nowS_(), nhacLuc: fmt_(new Date(Date.now() + days * 86400000)), daNhac: '', trangThai: 'cho' }]);
    return buildState_(ctx);
  });
};

API.seedingDelete = function (ctx, a) {
  needSeeding_(ctx);
  return withLock_(function () {
    var s = byId_('Seeding', a.id);
    if (!s || s.trangThai !== 'cho') fail_('Chỉ xóa được bài chưa ghi nhận.');
    deleteWhere_('Seeding', function (r) { return r.id === s.id; });
    return buildState_(ctx);
  });
};

/** Ghi nhận seeding: giao diện đã dò tên; ở đây cộng +react / +comment, mỗi người một lần mỗi bài. */
API.seedingRecord = function (ctx, a) {
  needSeeding_(ctx);
  return withLock_(function () {
    var s = byId_('Seeding', a.id);
    if (!s) fail_('Không tìm thấy bài.');
    if (s.trangThai === 'xong') fail_('Bài này đã ghi nhận rồi.');
    var cat = {};
    table_('DanhMucDiem').forEach(function (c) { cat[c.id] = num_(c.diem); });
    var phase = phaseNow_(), term = setting_('nhiemKy'), luc = nowS_();
    var rows = [], people = {}, nr = 0, nc = 0;
    (a.matches || []).forEach(function (x) {
      var m = byId_('ThanhVien', x.memberId);
      if (!m || m.ban === 'BOD' || people[m.id]) return;
      people[m.id] = 1;
      if (x.react) { nr++; rows.push({ id: uid_(), memberId: m.id, hoatDong: 'react', diem: cat.react || 1, eventId: '', chiTiet: 'React bài đăng', giaiDoan: phase, nhiemKy: term, nguon: 'seeding', refId: s.id, luc: luc, boi: ctx.me.hoTen }); }
      if (x.comment) { nc++; rows.push({ id: uid_(), memberId: m.id, hoatDong: 'comment', diem: cat.comment || 2, eventId: '', chiTiet: 'Comment bài đăng', giaiDoan: phase, nhiemKy: term, nguon: 'seeding', refId: s.id, luc: luc, boi: ctx.me.hoTen }); }
    });
    insert_('Diem', rows);
    s.trangThai = 'xong'; s.soReact = nr; s.soComment = nc; s.soNguoi = Object.keys(people).length; s.ghiNhanLuc = luc; s.ghiNhanBoi = ctx.me.hoTen;
    update_('Seeding', s);
    log_(ctx.me.hoTen, 'Seeding', 'Ghi nhận ' + s.link + ': ' + nr + ' react, ' + nc + ' comment, ' + s.soNguoi + ' người');
    mailClub_('seeding', 'Nhân sự seeding vừa ghi nhận một bài', s.link + '\n' + nr + ' react, ' + nc + ' comment, ' + s.soNguoi + ' người được cộng điểm. Người ghi nhận: ' + ctx.me.hoTen);
    return buildState_(ctx);
  });
};

function remindSeeding_() {
  withLock_(function () {
    var due = table_('Seeding').filter(function (s) { return s.trangThai === 'cho' && !s.daNhac && ms_(s.nhacLuc) <= Date.now(); });
    if (!due.length) return;
    var ns = table_('ThanhVien').filter(function (m) { return m.trangThai === 'active' && m.nsSeeding === 'co'; }).map(function (m) { return m.id; });
    due.forEach(function (s) {
      notify_(ns, 'Đến giờ ghi nhận seeding', s.link, '#/seeding/' + s.id);
      s.daNhac = nowS_(); update_('Seeding', s);
    });
  });
}

/* ======================= Nhắc task (TB-03, TB-04) ======================= */

function remindTasks_() {
  withLock_(function () {
    var S = settings_();
    var now = new Date();
    var sent = {};
    table_('DaNhac').forEach(function (r) { sent[r.khoa] = 1; });
    var B = calcBase_();
    var members = {};
    table_('ThanhVien').forEach(function (m) { members[m.id] = m; });
    var at = function (dayMs, hhmm) { var d = new Date(dayMs); var p = String(hhmm || '06:30').split(':'); return parseT_(fmtDay_(d) + ' ' + ('0' + p[0]).slice(-2) + ':' + ('0' + (p[1] || '0')).slice(-2)).getTime(); };
    var newSent = [];
    B.tasks.forEach(function (t) {
      if (t.huy === 'co') return;
      var due = ms_(t.hanChot);
      var dueDay = parseT_(t.hanChot.slice(0, 10)).getTime();
      var marks = [
        ['truoc', at(dueDay - 86400000, S.nhacTruocHan), 'Ngày mai hết hạn task'],
        ['ngay', at(dueDay, S.nhacNgayHan), 'Hôm nay hết hạn task'],
        ['sau', at(dueDay + 86400000, S.nhacSauHan), 'Task đã quá hạn']
      ];
      marks.forEach(function (mk) {
        if (now.getTime() < mk[1] || now.getTime() > mk[1] + 3 * 3600000) return;
        if (mk[0] === 'ngay' && mk[1] > due) { /* hạn trước giờ nhắc sáng: vẫn nhắc */ }
        var key = t.id + '|' + mk[0];
        if (sent[key]) return;
        var pend = B.assigns.filter(function (a) { return a.taskId === t.id && !a.xacNhanLuc; });
        if (!pend.length) return;
        var toNs = {};
        var direct = [];
        pend.forEach(function (a) {
          var m = members[a.memberId];
          if (!m) return;
          direct.push(m.id);
          if (m.ban !== 'BOD') nsOf_(m.ban).forEach(function (id) { toNs[id] = 1; });
        });
        notify_(direct, mk[2] + ': ' + t.ten, 'Hạn ' + t.hanChot.slice(0, 16) + '. Nộp qua Messenger rồi bấm Xác nhận hoàn thành.', '#/task/' + t.id);
        notify_(Object.keys(toNs), mk[2] + ': ' + t.ten, pend.length + ' người chưa xác nhận. Xem Danh sách cần nhắc.', '#/can-nhac');
        newSent.push({ khoa: key, luc: nowS_() });
      });
    });
    insert_('DaNhac', newSent);
  });
}

/* ======================= Cài đặt, sự kiện, phân công ======================= */

var SETTING_KEYS = ['ghiNhan', 'nhacTruocHan', 'nhacNgayHan', 'nhacSauHan', 'khongLamSauGio', 'kpiDat', 'kpiBuTru', 'top', 'topBuTru', 'coCau', 'emailBao', 'lichSinhNhat', 'giuThongBao', 'dungChuKy', 'nhacSeedingSauNgay'];

API.settingsSave = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    Object.keys(a.values || {}).forEach(function (k) {
      if (SETTING_KEYS.indexOf(k) < 0) return;
      setSetting_(k, a.values[k]);
      log_(ctx.me.hoTen, 'Cài đặt', 'Đổi ' + k);
    });
    return buildState_(ctx);
  });
};

API.eventSave = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var ten = str_(a.ten, 150);
    if (!ten) fail_('Nhập tên sự kiện.');
    var o = a.id ? eventOf_(a.id) : { id: uid_(), nhiemKy: setting_('nhiemKy'), logTrangThai: '', taoLuc: nowS_(), tinh: countsNow_(), chiTieuBan: '{}', chiTieuKhoi: '{}', chiTieuNguoi: '{}' };
    o.ten = ten; o.batDau = str_(a.batDau, 10); o.ketThuc = str_(a.ketThuc, 10); o.moTa = str_(a.moTa, 2000); o.diaDiem = str_(a.diaDiem, 200);
    if (a.id) update_('SuKien', o); else insert_('SuKien', [o]);
    log_(ctx.me.hoTen, 'Kế hoạch năm', (a.id ? 'Sửa' : 'Tạo') + ' sự kiện "' + ten + '"');
    return buildState_(ctx);
  });
};

API.eventDelete = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var e = eventOf_(a.id);
    if (table_('Task').some(function (t) { return t.eventId === e.id; }) || table_('BuoiLog').some(function (s) { return s.eventId === e.id; })) fail_('Sự kiện đã có task hoặc buổi log, không xóa được.');
    deleteWhere_('SuKien', function (r) { return r.id === e.id; });
    log_(ctx.me.hoTen, 'Kế hoạch năm', 'Xóa sự kiện "' + e.ten + '"');
    return buildState_(ctx);
  });
};

API.assignNs = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var m = member_(a.memberId);
    if (m.ban === 'BOD') fail_('BOD không cần phân công.');
    if (a.nsBan !== undefined) m.nsBan = (a.nsBan || []).join(',');
    if (a.nsSeeding !== undefined) m.nsSeeding = a.nsSeeding ? 'co' : '';
    update_('ThanhVien', m);
    log_(ctx.me.hoTen, 'Phân công', m.hoTen + ': phụ trách ban [' + (m.nsBan || '') + ']' + (m.nsSeeding === 'co' ? ', phụ trách seeding' : ''));
    return buildState_(ctx);
  });
};

API.journal = function (ctx, a) {
  needBod_(ctx);
  var t = table_('NhatKy').slice(-1500).reverse();
  return t.map(function (r) { return { luc: r.luc, boi: r.boi, loai: r.loai, noiDung: r.noiDung }; });
};

/** Nhiệm kỳ cũ: bảng điểm tổng (chỉ xem). */
API.oldTerm = function (ctx, a) {
  needBod_(ctx);
  var id = String(a.id);
  var names = {};
  table_('ThanhVien').forEach(function (m) { names[m.id] = m.hoTen + ' · ' + m.ban; });
  var score = {};
  table_('Diem').forEach(function (p) { if (p.nhiemKy === id && p.huy !== 'co' && (p.giaiDoan === '1' || p.giaiDoan === '2')) score[p.memberId] = (score[p.memberId] || 0) + num_(p.diem); });
  return {
    events: table_('SuKien').filter(function (e) { return e.nhiemKy === id; }).map(function (e) { return { ten: e.ten, batDau: e.batDau }; }),
    scores: Object.keys(score).map(function (k) { return { ten: names[k] || k, diem: score[k] }; }).sort(function (x, y) { return y.diem - x.diem; })
  };
};
