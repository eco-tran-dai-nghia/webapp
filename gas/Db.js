/**
 * Lớp dữ liệu: mỗi bảng là một tab trong file Google Sheets này.
 * Hàng 1 là tên cột (khóa dùng trong code). Mọi ô để dạng chữ thường (định dạng "@") để Sheets không tự đổi kiểu.
 * Thời gian lưu dạng "yyyy-MM-dd HH:mm:ss" theo giờ Việt Nam, người không biết code vẫn đọc được.
 */

var TZ = 'Asia/Ho_Chi_Minh';

var SCHEMA = {
  ThanhVien: ['id', 'hoTen', 'lop', 'khoi', 'ban', 'mang', 'chucVu', 'ngaySinh', 'email', 'sdt', 'tenFb', 'linkFb',
    'dot', 'nhiemKyVao', 'loai', 'trangThai', 'vaoLuc', 'core', 'coreCach', 'ucv', 'nsBan', 'nsSeeding', 'fbPhu',
    'avatar', 'pwHash', 'pwSalt', 'pwDefault', 'lanCuoi', 'calEventId'],
  PhienDN: ['token', 'memberId', 'taoLuc', 'lanCuoi'],
  SuKien: ['id', 'ten', 'batDau', 'ketThuc', 'moTa', 'diaDiem', 'nhiemKy', 'logTrangThai', 'sheetId', 'chiTieuBan',
    'chiTieuKhoi', 'chiTieuNguoi', 'chotLuc', 'chotBoi', 'ketQuaChot', 'tinh', 'taoLuc'],
  BuoiLog: ['id', 'eventId', 'ten', 'thoiDiem', 'thoiLuong', 'huyLyDo', 'keHoach', 'taoLuc'],
  DiemDanh: ['id', 'buoiId', 'memberId', 'loai', 'luc', 'boi'],
  Task: ['id', 'eventId', 'ten', 'moTa', 'hanChot', 'taoBoi', 'taoLuc', 'huy', 'huyBoi', 'tinh', 'nhatKyHan'],
  PhanCong: ['id', 'taskId', 'memberId', 'xacNhanLuc', 'xacNhanBoi', 'nopDungHan', 'chatLuong', 'chamBoi', 'chamLuc'],
  Diem: ['id', 'memberId', 'hoatDong', 'diem', 'eventId', 'chiTiet', 'giaiDoan', 'nhiemKy', 'nguon', 'refId', 'luc', 'boi',
    'huy', 'huyBoi', 'huyLuc'],
  DanhMucDiem: ['id', 'ten', 'diem', 'tuDong', 'an'],
  GopY: ['id', 'memberId', 'noiDung', 'luc', 'apDung', 'apDungBoi', 'apDungLuc', 'giaiDoan', 'nhiemKy'],
  ThongBao: ['id', 'memberId', 'tieuDe', 'noiDung', 'link', 'luc', 'daDoc'],
  DaNhac: ['khoa', 'luc'],
  NhatKy: ['luc', 'boi', 'loai', 'noiDung'],
  Seeding: ['id', 'link', 'taoBoi', 'taoLuc', 'nhacLuc', 'daNhac', 'trangThai', 'soReact', 'soComment', 'soNguoi',
    'ghiNhanLuc', 'ghiNhanBoi'],
  MailViec: ['id', 'nguoiTao', 'luc', 'thaoTac', 'maThu', 'tieuDeThu', 'den', 'cc', 'bcc', 'tieuDe', 'noiDung', 'nhan',
    'dinhKem', 'tuyChon', 'trangThai', 'ghiChu', 'nguoiDuyet', 'lucDuyet', 'bodSua'],
  DanhBa: ['id', 'email', 'ten', 'nhom', 'truong'],
  LichGui: ['id', 'taoLuc', 'guiLuc', 'tieuDe', 'maNhap', 'nguoiNhan', 'moTaNguon', 'nguoiTao', 'trangThai', 'ketQua'],
  TaiSheet: ['id', 'loai', 'dot', 'luc', 'boi', 'tomTat', 'snapshot', 'hoanTac'],
  NhiemKy: ['id', 'trangThai', 'batDau', 'gd2Luc', 'ketThuc']
};

var SETTINGS_DEFAULT = [
  ['nhiemKy', '2627', 'Nhiệm kỳ hiện tại (app tự đổi khi tải đợt Oday)'],
  ['giaiDoan', '1', '0 = giao thoa / chuẩn bị, 1 = Giai đoạn 1, 2 = Giai đoạn 2 (app tự đổi khi tải sheet)'],
  ['ghiNhan', 'bat', 'Ghi nhận KPI và điểm: bat / tat'],
  ['nhacTruocHan', '20:30', 'Giờ nhắc task hôm trước ngày hạn'],
  ['nhacNgayHan', '06:30', 'Giờ nhắc sáng ngày hạn'],
  ['nhacSauHan', '06:30', 'Giờ nhắc sáng hôm sau ngày hạn'],
  ['khongLamSauGio', '24', 'Số giờ sau hạn chót thì task chưa xác nhận thành Không làm'],
  ['kpiDat', '80', 'Ngưỡng KPI đạt (%)'],
  ['kpiBuTru', '60', 'Ngưỡng KPI được xét bù trừ (%)'],
  ['top', '15', 'Mức top khen thưởng (%)'],
  ['topBuTru', '40', 'Mức top bảng bù trừ (%)'],
  ['coCau', JSON.stringify([
    { ma: 'BOD', ten: 'Ban điều hành', mang: [] },
    { ma: 'PG', ten: 'Chương trình', mang: [] },
    { ma: 'PR', ten: 'Truyền thông', mang: ['CAP', 'DES', 'PHO'] },
    { ma: 'HR', ten: 'Nhân sự', mang: [] },
    { ma: 'AD', ten: 'Hậu cần', mang: [] }
  ]), 'Cơ cấu tổ chức: ban và mảng'],
  ['emailBao', JSON.stringify({ gopY: true, mail: true, seeding: true }), 'Email báo về tài khoản CLB'],
  ['lichSinhNhat', '', 'ID Google Calendar dùng cho sinh nhật'],
  ['giuThongBao', '30', 'Số ngày giữ thông báo'],
  ['dungChuKy', 'bat', 'Gắn chữ ký Gmail vào thư UCV: bat / tat'],
  ['nhacSeedingSauNgay', '2', 'Số ngày sau khi đặt nhắc hẹn seeding thì nhắc']
];

var POINT_DEFAULT = [
  ['react', 'React bài đăng trong vòng 48 giờ', 1, 'co'],
  ['comment', 'Comment bài đăng trong vòng 48 giờ', 2, 'co'],
  ['staff-ngan', 'Làm staff ca ngắn (giờ ra chơi)', 3, ''],
  ['bonding', 'Tham gia bonding', 5, ''],
  ['gop-y', 'Góp ý được đưa vào sử dụng', 10, 'co'],
  ['log-vuot', 'Làm log vượt số buổi được giao cuối (mỗi buổi 90 phút)', 20, 'co'],
  ['thi', 'Đại diện CLB tham gia cuộc thi', 40, ''],
  ['tham-du', 'Tham dự sự kiện của CLB hoặc của đối tác', 40, ''],
  ['staff-lon', 'Làm staff 1 buổi (sự kiện lớn)', 50, '']
];

/* ---------- Thời gian ---------- */

function fmt_(d) { return d ? Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss') : ''; }
function fmtDay_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function nowS_() { return fmt_(new Date()); }

/** "2026-10-16 20:30[:00]" (giờ VN) → Date. */
function parseT_(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], (+m[4] || 0) - 7, +m[5] || 0, +m[6] || 0));
}
function ms_(s) { var d = parseT_(s); return d ? d.getTime() : 0; }

/* ---------- Đọc / ghi bảng ---------- */

var DB_MEMO_ = {};

function ss_() { return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('DATA_ID')); }

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var cols = name === 'CaiDat' ? ['khoa', 'giaTri', 'moTa'] : SCHEMA[name];
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function cell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'co' : '';
  if (typeof v === 'object') return JSON.stringify(v);
  var s = String(v);
  return /^[=+]/.test(s) ? "'" + s : s;
}

/** Đọc cả bảng thành mảng object (có _r = số dòng trên sheet). Nhớ trong một lần gọi. */
function table_(name) {
  if (DB_MEMO_[name]) return DB_MEMO_[name];
  var sh = sheet_(name);
  var v = sh.getDataRange().getValues();
  var head = v[0].map(String);
  var out = [];
  for (var r = 1; r < v.length; r++) {
    var o = { _r: r + 1 };
    var empty = true;
    for (var c = 0; c < head.length; c++) {
      var x = v[r][c];
      if (x instanceof Date) x = fmt_(x);
      o[head[c]] = x === null || x === undefined ? '' : String(x);
      if (o[head[c]] !== '') empty = false;
    }
    if (!empty) out.push(o);
  }
  DB_MEMO_[name] = out;
  return out;
}

function headOf_(name) { return name === 'CaiDat' ? ['khoa', 'giaTri', 'moTa'] : SCHEMA[name]; }

function rowOf_(name, o) { return headOf_(name).map(function (k) { return cell_(o[k]); }); }

function insert_(name, objs) {
  if (!objs.length) return;
  delete DB_MEMO_._calc;
  var sh = sheet_(name);
  var cols = headOf_(name);
  var start = sh.getLastRow() + 1;
  var rows = objs.map(function (o) { return rowOf_(name, o); });
  sh.getRange(start, 1, rows.length, cols.length).setNumberFormat('@').setValues(rows);
  var t = DB_MEMO_[name];
  if (t) objs.forEach(function (o, i) { o._r = start + i; t.push(o); });
}

function update_(name, o) {
  delete DB_MEMO_._calc;
  if (!o._r) throw new Error('update_ thiếu dòng: ' + name);
  var cols = headOf_(name);
  sheet_(name).getRange(o._r, 1, 1, cols.length).setNumberFormat('@').setValues([rowOf_(name, o)]);
}

/** Ghi đè cả bảng (dùng khi tải sheet thành viên, hoàn tác). */
function replaceAll_(name, objs) {
  delete DB_MEMO_._calc;
  var sh = sheet_(name);
  var cols = headOf_(name);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
  if (objs.length) {
    if (sh.getMaxRows() < objs.length + 1) sh.insertRowsAfter(sh.getMaxRows(), objs.length + 1 - sh.getMaxRows());
    sh.getRange(2, 1, objs.length, cols.length).setNumberFormat('@').setValues(objs.map(function (o) { return rowOf_(name, o); }));
  }
  objs.forEach(function (o, i) { o._r = i + 2; });
  DB_MEMO_[name] = objs;
}

/** Xóa các dòng thỏa điều kiện (xóa từ dưới lên). */
function deleteWhere_(name, fn) {
  var t = table_(name);
  var rows = t.filter(fn).map(function (o) { return o._r; }).sort(function (a, b) { return b - a; });
  var sh = sheet_(name);
  rows.forEach(function (r) { sh.deleteRow(r); });
  delete DB_MEMO_[name];
  delete DB_MEMO_._calc;
  return rows.length;
}

function byId_(name, id) {
  var t = table_(name);
  for (var i = 0; i < t.length; i++) if (t[i].id === String(id)) return t[i];
  return null;
}

function uid_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- Cài đặt ---------- */

function settings_() {
  if (DB_MEMO_._settings) return DB_MEMO_._settings;
  var o = {};
  SETTINGS_DEFAULT.forEach(function (s) { o[s[0]] = s[1]; });
  table_('CaiDat').forEach(function (r) { if (r.khoa) o[r.khoa] = r.giaTri; });
  DB_MEMO_._settings = o;
  return o;
}

function setting_(k) { return settings_()[k]; }
function settingJson_(k, def) { try { return JSON.parse(setting_(k)); } catch (e) { return def; } }

function setSetting_(k, v) {
  var t = table_('CaiDat');
  var row = t.filter(function (r) { return r.khoa === k; })[0];
  v = typeof v === 'string' ? v : JSON.stringify(v);
  if (row) { row.giaTri = v; update_('CaiDat', row); }
  else {
    var d = SETTINGS_DEFAULT.filter(function (s) { return s[0] === k; })[0];
    insert_('CaiDat', [{ khoa: k, giaTri: v, moTa: d ? d[2] : '' }]);
  }
  delete DB_MEMO_._settings;
}

function log_(by, kind, text) {
  insert_('NhatKy', [{ luc: nowS_(), boi: by, loai: kind, noiDung: String(text).slice(0, 2000) }]);
}

/* ---------- Khởi tạo ---------- */

/** Tạo mọi tab còn thiếu và cài đặt mặc định. Chạy lại nhiều lần không sao. */
function ensureTables_() {
  sheet_('CaiDat');
  var have = {};
  table_('CaiDat').forEach(function (r) { have[r.khoa] = 1; });
  var add = SETTINGS_DEFAULT.filter(function (s) { return !have[s[0]]; }).map(function (s) { return { khoa: s[0], giaTri: s[1], moTa: s[2] }; });
  insert_('CaiDat', add);
  Object.keys(SCHEMA).forEach(sheet_);
  if (!table_('DanhMucDiem').length) {
    insert_('DanhMucDiem', POINT_DEFAULT.map(function (p) { return { id: p[0], ten: p[1], diem: p[2], tuDong: p[3], an: '' }; }));
  }
  var first = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('Trang tính1');
  if (first && first.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(first);
}
