/**
 * Tải sheet thành viên / Core team / UCV (mục CK). App đọc cột theo tên, xem trước rồi mới áp dụng, hoàn tác trong 7 ngày.
 */

var API = API || {};

var UNDO_DAYS = 7;

function bodau_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
function normName_(s) { return bodau_(s).toLowerCase().replace(/\s+/g, ' ').trim(); }
function normHead_(s) { return normName_(s).replace(/[^a-z0-9 ]/g, '').trim(); }

var COLS_MEMBER = {
  'ho va ten': 'hoTen', 'ho ten': 'hoTen', 'lop': 'lop', 'ban': 'ban', 'mang': 'mang', 'chuc vu': 'chucVu',
  'ngay sinh': 'ngaySinh', 'email': 'email', 'so dien thoai': 'sdt', 'sdt': 'sdt', 'ten facebook': 'tenFb', 'link facebook': 'linkFb'
};
var REQ_MEMBER = { hoTen: 'Họ và tên', lop: 'Lớp', ban: 'Ban', ngaySinh: 'Ngày sinh', email: 'Email', tenFb: 'Tên Facebook', linkFb: 'Link Facebook' };
var COLS_CORE = { 'ho va ten': 'hoTen', 'ho ten': 'hoTen', 'email': 'email', 'cach vao core team': 'coreCach' };

/** "5/3/2009", "05/03/2009", "2009-03-05" → "05/03/2009". */
function normDate_(v) {
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) { var d = +m[1], mo = +m[2], y = +m[3]; if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return ('0' + d).slice(-2) + '/' + ('0' + mo).slice(-2) + '/' + y; return ''; }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ('0' + m[3]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[1];
  return '';
}
function emailOk_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()); }
function khoiOf_(lop) { var m = String(lop || '').match(/^\s*(\d{1,2})/); return m ? m[1] : ''; }

function mapRows_(rows, cols) {
  return (rows || []).map(function (r) {
    var o = {};
    Object.keys(r).forEach(function (h) { var k = cols[normHead_(h)]; if (k && o[k] === undefined) o[k] = String(r[h] == null ? '' : r[h]).trim(); });
    return o;
  }).filter(function (o) { return Object.keys(o).some(function (k) { return o[k]; }); });
}

function nextTerm_(t) { var a = +String(t).slice(0, 2), b = +String(t).slice(2, 4); return ('0' + ((a + 1) % 100)).slice(-2) + ('0' + ((b + 1) % 100)).slice(-2); }
function recruitDot_(phase) { return phase === '2' ? 'D2' : phase === '0' ? 'OD' : 'D1'; }

/** Phân tích sheet thành viên: trả về xem trước. */
function analyzeMembers_(a) {
  var rows = mapRows_(a.rows, COLS_MEMBER);
  var bans = {};
  orgList_().forEach(function (b) { bans[b.ma] = 1; });
  var all = table_('ThanhVien');
  var byKey = {};
  all.forEach(function (m) { byKey[normName_(m.hoTen) + '|' + m.ngaySinh] = m; });
  var seen = {}, errors = [], items = [], questions = [];
  rows.forEach(function (r, i) {
    var line = i + 2;
    var errs = [];
    Object.keys(REQ_MEMBER).forEach(function (k) { if (!r[k]) errs.push('thiếu ' + REQ_MEMBER[k]); });
    r.ban = String(r.ban || '').toUpperCase();
    if (r.ban && !bans[r.ban]) errs.push('Ban "' + r.ban + '" không có trong cơ cấu tổ chức');
    var dob = normDate_(r.ngaySinh);
    if (r.ngaySinh && !dob) errs.push('Ngày sinh "' + r.ngaySinh + '" chưa đúng dạng ngày/tháng/năm');
    r.ngaySinh = dob;
    if (r.email && !emailOk_(r.email)) errs.push('Email chưa đúng');
    r.email = String(r.email || '').trim();
    var key = normName_(r.hoTen) + '|' + dob;
    if (r.hoTen && dob && seen[key]) errs.push('trùng người ở dòng ' + seen[key]);
    seen[key] = line;
    if (errs.length) { errors.push({ line: line, hoTen: r.hoTen || '', errs: errs }); return; }
    var old = byKey[key];
    var it = { line: line, row: r, matchId: old ? old.id : '', kind: old ? (old.trangThai === 'active' ? 'stay' : 'back') : 'new' };
    if (!old) {
      var cand = all.filter(function (m) { return m.ngaySinh === dob && normEmail_(m.email) === normEmail_(r.email); })[0];
      if (cand) questions.push({ line: line, hoTen: r.hoTen, candId: cand.id, candName: cand.hoTen, candBan: cand.ban });
    }
    items.push(it);
  });
  var inSheet = {};
  items.forEach(function (it) { if (it.matchId) inSheet[it.matchId] = 1; });
  questions.forEach(function (q) { inSheet[q.candId] = inSheet[q.candId] || 'q'; });
  var leaving = a.dot === 'OD' ? [] : all.filter(function (m) { return m.trangThai === 'active' && !inSheet[m.id]; }).map(function (m) { return { id: m.id, hoTen: m.hoTen, ban: m.ban, mang: m.mang }; });
  return { items: items, errors: errors, questions: questions, leaving: leaving, total: rows.length };
}

function analyzeFlag_(a, flag) {
  var rows = mapRows_(a.rows, COLS_CORE);
  var act = table_('ThanhVien').filter(function (m) { return m.trangThai === 'active'; });
  var errors = [], hit = {}, items = [];
  rows.forEach(function (r, i) {
    var line = i + 2;
    if (!r.hoTen || !r.email) { errors.push({ line: line, hoTen: r.hoTen || '', errs: ['thiếu Họ và tên hoặc Email'] }); return; }
    if (flag === 'core' && !r.coreCach) { errors.push({ line: line, hoTen: r.hoTen, errs: ['thiếu Cách vào core team'] }); return; }
    var m = act.filter(function (x) { return normName_(x.hoTen) === normName_(r.hoTen) && normEmail_(x.email) === normEmail_(r.email); })[0];
    if (!m) { errors.push({ line: line, hoTen: r.hoTen, errs: ['không khớp thành viên nào (so Họ và tên + Email)'] }); return; }
    hit[m.id] = 1;
    items.push({ line: line, id: m.id, hoTen: m.hoTen, ban: m.ban, mang: m.mang, kind: m[flag] === 'co' ? 'stay' : 'new', coreCach: r.coreCach || '' });
  });
  var leaving = act.filter(function (m) { return m[flag] === 'co' && !hit[m.id]; }).map(function (m) { return { id: m.id, hoTen: m.hoTen, ban: m.ban, mang: m.mang }; });
  return { items: items, errors: errors, questions: [], leaving: leaving, total: rows.length };
}

API.uploadPreview = function (ctx, a) {
  needBod_(ctx);
  if (a.loai === 'core') return analyzeFlag_(a, 'core');
  if (a.loai === 'ucv') return analyzeFlag_(a, 'ucv');
  return analyzeMembers_(a);
};

/** Đọc một Google Sheet qua link (tài khoản CLB phải mở được). */
API.readSheetLink = function (ctx, a) {
  needBod_(ctx);
  var ss;
  try { ss = SpreadsheetApp.openByUrl(String(a.url || '').trim()); } catch (e) { fail_('Không mở được sheet. Kiểm tra link và chia sẻ sheet cho ' + ownerEmail_() + '.'); }
  var tabs = ss.getSheets().map(function (s) { return s.getName(); });
  var sh = a.tab ? ss.getSheetByName(String(a.tab)) : ss.getSheets()[0];
  if (!sh) fail_('Không có tab "' + a.tab + '".');
  var v = sh.getDataRange().getValues().slice(0, 2001);
  var tz = ss.getSpreadsheetTimeZone();
  var hi = 0;
  for (var i = 0; i < Math.min(v.length, 10); i++) { if (v[i].filter(String).length >= 2) { hi = i; break; } }
  var head = v[hi].map(function (h) { return String(h).trim(); });
  var rows = v.slice(hi + 1).map(function (r) {
    var o = {};
    head.forEach(function (h, j) { if (!h) return; var x = r[j]; o[h] = x instanceof Date ? Utilities.formatDate(x, tz, 'dd/MM/yyyy') : String(x == null ? '' : x); });
    return o;
  });
  return { tabs: tabs, tab: sh.getName(), name: ss.getName(), head: head.filter(String), rows: rows };
};

API.uploadApply = function (ctx, a) {
  needBod_(ctx);
  var res = withLock_(function () {
    var pre = API.uploadPreview(ctx, a);
    if (pre.errors.length) fail_('Còn ' + pre.errors.length + ' dòng lỗi. Sửa sheet rồi tải lại.');
    var ans = a.answers || {};
    var unanswered = pre.questions.filter(function (q) { return !ans[q.line]; });
    if (unanswered.length) fail_('Còn ' + unanswered.length + ' câu hỏi "cùng một người?" chưa trả lời.');

    var S = settings_();
    var prev = { nhiemKy: S.nhiemKy, giaiDoan: S.giaiDoan, ghiNhan: S.ghiNhan, terms: table_('NhiemKy').map(function (t) { var o = {}; SCHEMA.NhiemKy.forEach(function (k) { o[k] = t[k]; }); return o; }) };
    var upId = uid_();
    var snapName = 'Snap_' + upId;
    var src = sheet_('ThanhVien');
    var snap = src.copyTo(ss_()).setName(snapName);
    snap.hideSheet();
    var summary = { stay: 0, back: 0, new: 0, left: 0, prev: prev, snap: snapName };
    var now = nowS_();

    if (a.loai === 'core' || a.loai === 'ucv') {
      var flag = a.loai;
      pre.items.forEach(function (it) {
        var m = byId_('ThanhVien', it.id);
        if (m[flag] !== 'co') summary.new++; else summary.stay++;
        m[flag] = 'co';
        if (flag === 'core') m.coreCach = it.coreCach;
        update_('ThanhVien', m);
      });
      pre.leaving.forEach(function (x) { var m = byId_('ThanhVien', x.id); m[flag] = ''; update_('ThanhVien', m); summary.left++; });
    } else {
      var dot = a.dot;
      var term = S.nhiemKy, phase = S.giaiDoan;
      if (dot === 'KT') { term = String(a.nhiemKy || S.nhiemKy); phase = String(a.giaiDoan || '1'); }
      if (dot === 'OD') { term = nextTerm_(S.nhiemKy); phase = '0'; }
      if (dot === 'D1') phase = '1';
      if (dot === 'D2') phase = '2';
      var joinDot = dot === 'KT' ? 'CU' : dot === 'CN' ? (a.dotMoi || recruitDot_(S.giaiDoan)) : dot;
      var all = table_('ThanhVien');
      var seq = 0;
      all.forEach(function (m) { var mm = String(m.id).match(new RegExp('^' + term + '-' + joinDot + '-(\\d+)$')); if (mm) seq = Math.max(seq, +mm[1]); });
      var adds = [];
      pre.items.forEach(function (it) {
        var r = it.row;
        var targetId = it.matchId || (ans[it.line] && ans[it.line] !== 'new' ? ans[it.line] : '');
        var m = targetId ? byId_('ThanhVien', targetId) : null;
        if (m) {
          summary[m.trangThai === 'active' ? 'stay' : 'back']++;
          ['hoTen', 'lop', 'ban', 'mang', 'chucVu', 'ngaySinh', 'email', 'sdt', 'tenFb', 'linkFb'].forEach(function (k) { m[k] = r[k] || ''; });
          m.khoi = khoiOf_(r.lop); m.trangThai = 'active';
          if (m.ban === 'BOD') { m.nsBan = ''; m.nsSeeding = ''; m.ucv = ''; }
          update_('ThanhVien', m);
        } else {
          seq++;
          summary.new++;
          adds.push({
            id: term + '-' + joinDot + '-' + ('00' + seq).slice(-3), hoTen: r.hoTen, lop: r.lop, khoi: khoiOf_(r.lop), ban: r.ban, mang: r.mang || '', chucVu: r.chucVu || '',
            ngaySinh: r.ngaySinh, email: r.email, sdt: r.sdt || '', tenFb: r.tenFb, linkFb: r.linkFb, dot: joinDot, nhiemKyVao: term,
            loai: joinDot === 'D2' ? 'bo-sung' : 'chinh-thuc', trangThai: 'active', vaoLuc: now, fbPhu: '[]', pwDefault: 'co'
          });
        }
      });
      insert_('ThanhVien', adds);
      pre.leaving.forEach(function (x) {
        if (ans['leave_' + x.id] === 'keep') return;
        var m = byId_('ThanhVien', x.id);
        m.trangThai = 'roi'; m.nsBan = ''; m.nsSeeding = ''; m.ucv = '';
        update_('ThanhVien', m);
        summary.left++;
      });
      // Giai đoạn và nhiệm kỳ đi theo loại đợt tải (CD-04).
      if (dot !== 'CN') {
        setSetting_('nhiemKy', term);
        setSetting_('giaiDoan', phase);
        if (dot === 'OD') setSetting_('ghiNhan', 'tat');
        if (dot === 'D1' || dot === 'KT') setSetting_('ghiNhan', 'bat');
        var terms = table_('NhiemKy');
        var cur = terms.filter(function (t) { return t.id === term; })[0];
        if (!cur) { cur = { id: term, trangThai: dot === 'OD' ? 'chuan-bi' : 'dang-chay', batDau: dot === 'OD' ? '' : now }; insert_('NhiemKy', [cur]); }
        if (dot === 'D1' || dot === 'KT') {
          cur.trangThai = 'dang-chay'; cur.batDau = cur.batDau || now; update_('NhiemKy', cur);
          terms.forEach(function (t) { if (t.id !== term && t.trangThai !== 'luu-tru') { t.trangThai = 'luu-tru'; t.ketThuc = now; update_('NhiemKy', t); } });
        }
        if (dot === 'D2') { cur.gd2Luc = now; update_('NhiemKy', cur); }
      }
    }
    insert_('TaiSheet', [{ id: upId, loai: a.loai, dot: a.dot || '', luc: now, boi: ctx.me.hoTen, tomTat: JSON.stringify(summary), snapshot: snapName, hoanTac: '' }]);
    log_(ctx.me.hoTen, 'Tải sheet', labelUpload_(a) + ': ' + summary.new + ' mới, ' + summary.stay + ' ở lại, ' + summary.back + ' quay lại, ' + summary.left + ' rời');
    return a.loai === 'member';
  });
  if (res) { try { syncBirthdays_(); } catch (e) { console.error(e); } }
  return buildState_(ctx);
};

function labelUpload_(a) {
  if (a.loai === 'core') return 'Sheet Core team';
  if (a.loai === 'ucv') return 'Sheet UCV';
  return 'Sheet thành viên · ' + ({ KT: 'Khởi tạo', OD: 'Oday', D1: 'Đợt 1', D2: 'Đợt 2', CN: 'Cập nhật' }[a.dot] || a.dot);
}

API.uploadUndo = function (ctx, a) {
  needBod_(ctx);
  withLock_(function () {
    var ups = table_('TaiSheet').filter(function (u) { return !u.hoanTac; }).sort(function (x, y) { return ms_(y.luc) - ms_(x.luc) || y._r - x._r; });
    var u = ups[0];
    if (!u || u.id !== a.id) fail_('Chỉ hoàn tác được lần tải gần nhất chưa hoàn tác.');
    if (Date.now() - ms_(u.luc) > UNDO_DAYS * 86400000) fail_('Đã quá ' + UNDO_DAYS + ' ngày. Sửa bằng một lần tải Cập nhật.');
    var snap = ss_().getSheetByName(u.snapshot);
    if (!snap) fail_('Không còn bản lưu để hoàn tác.');
    var v = snap.getDataRange().getValues();
    var head = v[0].map(String);
    var objs = v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) { var o = {}; head.forEach(function (h, i) { o[h] = r[i] instanceof Date ? fmt_(r[i]) : String(r[i]); }); return o; });
    replaceAll_('ThanhVien', objs);
    var t = jsonOr_(u.tomTat, {});
    if (t.prev) {
      setSetting_('nhiemKy', t.prev.nhiemKy); setSetting_('giaiDoan', t.prev.giaiDoan); setSetting_('ghiNhan', t.prev.ghiNhan);
      replaceAll_('NhiemKy', t.prev.terms || []);
    }
    u.hoanTac = nowS_() + ' · ' + ctx.me.hoTen;
    update_('TaiSheet', u);
    ss_().deleteSheet(snap);
    log_(ctx.me.hoTen, 'Tải sheet', 'Hoàn tác lần tải lúc ' + u.luc.slice(0, 16));
  });
  try { syncBirthdays_(); } catch (e) { console.error(e); }
  return buildState_(ctx);
};

function cleanSnapshots_() {
  withLock_(function () {
    table_('TaiSheet').forEach(function (u) {
      if (Date.now() - ms_(u.luc) > UNDO_DAYS * 86400000) {
        var s = ss_().getSheetByName(u.snapshot);
        if (s) ss_().deleteSheet(s);
      }
    });
  });
}

/** Sheet mẫu (CK-11): tạo một lần trên Drive, danh sách chọn Ban theo cơ cấu hiện tại. */
API.templateSheet = function (ctx) {
  needBod_(ctx);
  var id = props_().getProperty('TEMPLATE_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('[ECO] Sheet mẫu thành viên');
    DriveApp.getFileById(ss.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    props_().setProperty('TEMPLATE_ID', ss.getId());
  }
  var tabs = [
    ['Thành viên', ['Họ và tên', 'Lớp', 'Ban', 'Mảng', 'Chức vụ', 'Ngày sinh', 'Email', 'Số điện thoại', 'Tên Facebook', 'Link Facebook']],
    ['Core team', ['Họ và tên', 'Email', 'Cách vào core team']],
    ['UCV', ['Họ và tên', 'Email', 'Vị trí ứng cử']]
  ];
  tabs.forEach(function (t, i) {
    var sh = ss.getSheetByName(t[0]) || (i === 0 && ss.getSheets()[0].getLastRow() === 0 ? ss.getSheets()[0].setName(t[0]) : ss.insertSheet(t[0]));
    sh.getRange(1, 1, 1, t[1].length).setValues([t[1]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  var mv = ss.getSheetByName('Thành viên');
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(orgList_().map(function (b) { return b.ma; }), true).build();
  mv.getRange(2, 3, 300, 1).setDataValidation(rule);
  mv.getRange(2, 6, 300, 1).setNumberFormat('dd/mm/yyyy');
  mv.getRange(1, 1).setNote('Cột có dấu * là bắt buộc: Họ và tên, Lớp, Ban, Ngày sinh, Email, Tên Facebook, Link Facebook. Mọi người trong BOD ghi Ban = BOD. Mảng ghi nhiều giá trị cách nhau dấu phẩy.');
  return { url: 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/copy' };
};

/* ---------- Sinh nhật lên Google Calendar (TB-07, CK-06) ---------- */

function syncBirthdays_() {
  var calId = setting_('lichSinhNhat');
  if (!calId) return;
  var cal = CalendarApp.getCalendarById(calId);
  if (!cal) return;
  var org = {};
  orgList_().forEach(function (b) { org[b.ma] = b.ten; });
  table_('ThanhVien').forEach(function (m) {
    var want = m.trangThai === 'active' && m.ngaySinh;
    if (!want && m.calEventId) {
      try { cal.getEventSeriesById(m.calEventId).deleteEventSeries(); } catch (e) { }
      m.calEventId = ''; update_('ThanhVien', m);
      return;
    }
    if (!want || m.calEventId) return;
    var p = m.ngaySinh.split('/');
    var y = new Date().getFullYear();
    var start = new Date(y, +p[1] - 1, +p[0]);
    var desc = 'Tên thật: ' + m.hoTen + '\nTên Facebook: ' + m.tenFb + '\nBan: ' + m.ban + (m.mang ? ' · ' + m.mang : '') + '\nFacebook: ' + m.linkFb + '\nNgày sinh: ' + m.ngaySinh;
    var ser = cal.createAllDayEventSeries('🎂 Sinh nhật ' + m.hoTen, start, CalendarApp.newRecurrence().addYearlyRule(), { description: desc });
    try { ser.removeAllReminders(); ser.addPopupReminder(240); } catch (e) { }
    m.calEventId = ser.getId(); update_('ThanhVien', m);
  });
}
