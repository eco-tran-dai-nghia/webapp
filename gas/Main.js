/**
 * Cổng vào của app: giao diện (GitHub Pages) gửi POST {fn, token, args} tới web app này.
 * Trả về {ok:true, data} hoặc {ok:false, error}.
 */

var PUBLIC_FNS = { login: 1, bootInfo: 1, bootstrap: 1 };

function doGet() {
  return ContentService.createTextOutput('ECO webapp API đang chạy.');
}

function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var fn = String(body.fn || '');
    var handler = API[fn];
    if (!handler) throw new Error('Không có chức năng "' + fn + '".');
    var ctx = null;
    if (!PUBLIC_FNS[fn]) ctx = session_(body.token);
    out = { ok: true, data: handler(ctx, body.args || {}) };
  } catch (err) {
    var msg = String(err && err.message || err);
    out = { ok: false, error: msg, auth: msg === 'PHIEN_HET_HAN' };
    if (msg !== 'PHIEN_HET_HAN' && !(err && err.user)) console.error(err && err.stack || err);
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Lỗi hiển thị cho người dùng (không phải lỗi hệ thống). */
function fail_(msg) { var e = new Error(msg); e.user = true; throw e; }

/* ---------- Mật khẩu và phiên ---------- */

function hash_(pw, salt) {
  var h = salt + '|' + pw;
  for (var i = 0; i < 64; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + '|' + salt, Utilities.Charset.UTF_8));
  }
  return h;
}

function props_() { return PropertiesService.getScriptProperties(); }
function ownerEmail_() { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); }
function normEmail_(s) { return String(s || '').trim().toLowerCase(); }

function checkDefault_(pw) {
  var p = props_();
  var h = p.getProperty('DEF_HASH');
  return !!h && hash_(pw, p.getProperty('DEF_SALT')) === h;
}

function rootMember_() {
  return { id: 'ROOT', hoTen: 'Quản trị gốc', ban: 'BOD', mang: '', chucVu: 'Tài khoản Gmail CLB', email: ownerEmail_(), trangThai: 'active', root: true };
}

function session_(token) {
  if (!token) throw new Error('PHIEN_HET_HAN');
  var cache = CacheService.getScriptCache();
  var mid = cache.get('tk_' + token);
  if (!mid) {
    var s = table_('PhienDN').filter(function (r) { return r.token === String(token); })[0];
    if (!s) throw new Error('PHIEN_HET_HAN');
    mid = s.memberId;
    if (Date.now() - ms_(s.lanCuoi) > 86400000) { s.lanCuoi = nowS_(); update_('PhienDN', s); }
    cache.put('tk_' + token, mid, 3600);
  }
  return ctxFor_(mid, token);
}

function ctxFor_(mid, token) {
  var me;
  if (mid === 'ROOT') me = rootMember_();
  else {
    me = byId_('ThanhVien', mid);
    if (!me || me.trangThai !== 'active') throw new Error('PHIEN_HET_HAN');
  }
  var isBod = me.ban === 'BOD';
  return {
    me: me, token: token, isRoot: !!me.root, isBod: isBod,
    isUcv: !isBod && me.ucv === 'co',
    nsBans: isBod ? [] : String(me.nsBan || '').split(',').map(function (x) { return x.trim(); }).filter(String),
    isSeeding: !isBod && me.nsSeeding === 'co'
  };
}

function needBod_(ctx) { if (!ctx.isBod) fail_('Chỉ BOD dùng được chức năng này.'); }

/* ---------- API công khai ---------- */

var API = API || {};

API.bootInfo = function () {
  return { ready: !!props_().getProperty('ROOT_HASH') };
};

/** Lần đầu: quản trị gốc (Gmail CLB) đặt mật khẩu của mình và mật khẩu mặc định cho tài khoản tạo hàng loạt. */
API.bootstrap = function (ctx, a) {
  return withLock_(function () {
    var p = props_();
    if (p.getProperty('ROOT_HASH')) fail_('App đã được khởi tạo rồi.');
    var code = p.getProperty('BOOT_CODE');
    if (!code || String(a.code || '').replace(/D/g, '') !== code) fail_('Mã khởi tạo chưa đúng. Mã hiện ở nhật ký thực thi khi chạy hàm setup trong trình sửa Apps Script.');
    if (String(a.rootPassword || '').length < 8) fail_('Mật khẩu quản trị gốc cần ít nhất 8 ký tự.');
    if (String(a.defaultPassword || '').length < 4) fail_('Mật khẩu mặc định cần ít nhất 4 ký tự.');
    ensureTables_();
    var s1 = uid_(), s2 = uid_();
    p.setProperties({ ROOT_SALT: s1, ROOT_HASH: hash_(String(a.rootPassword), s1), DEF_SALT: s2, DEF_HASH: hash_(String(a.defaultPassword), s2) });
    p.deleteProperty('BOOT_CODE');
    log_('Quản trị gốc', 'Khởi tạo', 'Khởi tạo app');
    return { email: ownerEmail_() };
  });
};

API.login = function (ctx, a) {
  var email = normEmail_(a.email), pw = String(a.password || '');
  if (!email || !pw) fail_('Nhập email và mật khẩu.');
  var mid = null;
  var p = props_();
  if (!p.getProperty('ROOT_HASH')) fail_('App chưa được khởi tạo.');
  if (email === ownerEmail_()) {
    if (hash_(pw, p.getProperty('ROOT_SALT')) !== p.getProperty('ROOT_HASH')) fail_('Sai mật khẩu.');
    mid = 'ROOT';
  } else {
    var m = table_('ThanhVien').filter(function (x) { return normEmail_(x.email) === email && x.trangThai === 'active'; })[0];
    if (!m) fail_('Email này không có trong danh sách thành viên. Kiểm tra lại email, hoặc nhắn BOD.');
    var ok = m.pwDefault === 'co' ? checkDefault_(pw) : hash_(pw, m.pwSalt) === m.pwHash;
    if (!ok) fail_('Sai mật khẩu. Quên mật khẩu thì nhắn BOD để đặt lại.');
    mid = m.id;
  }
  var token = Utilities.getUuid() + uid_();
  withLock_(function () {
    insert_('PhienDN', [{ token: token, memberId: mid, taoLuc: nowS_(), lanCuoi: nowS_() }]);
    if (mid !== 'ROOT') {
      var mm = byId_('ThanhVien', mid);
      var first = !mm.lanCuoi;
      mm.lanCuoi = nowS_();
      update_('ThanhVien', mm);
      a._first = first;
    }
  });
  return { token: token, first: !!a._first, state: buildState_(ctxFor_(mid, token)) };
};

/* ---------- Tài khoản ---------- */

API.logout = function (ctx) {
  withLock_(function () { deleteWhere_('PhienDN', function (r) { return r.token === ctx.token; }); });
  CacheService.getScriptCache().remove('tk_' + ctx.token);
  return true;
};

API.changePassword = function (ctx, a) {
  var oldPw = String(a.oldPassword || ''), pw = String(a.newPassword || '');
  if (pw.length < 6) fail_('Mật khẩu mới cần ít nhất 6 ký tự.');
  return withLock_(function () {
    var p = props_();
    if (ctx.isRoot) {
      if (hash_(oldPw, p.getProperty('ROOT_SALT')) !== p.getProperty('ROOT_HASH')) fail_('Mật khẩu hiện tại chưa đúng.');
      var s = uid_();
      p.setProperties({ ROOT_SALT: s, ROOT_HASH: hash_(pw, s) });
      return true;
    }
    var m = byId_('ThanhVien', ctx.me.id);
    var ok = m.pwDefault === 'co' ? checkDefault_(oldPw) : hash_(oldPw, m.pwSalt) === m.pwHash;
    if (!ok) fail_('Mật khẩu hiện tại chưa đúng.');
    m.pwSalt = uid_(); m.pwHash = hash_(pw, m.pwSalt); m.pwDefault = '';
    update_('ThanhVien', m);
    return true;
  });
};

API.resetPassword = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    var m = byId_('ThanhVien', a.memberId);
    if (!m) fail_('Không tìm thấy thành viên.');
    m.pwDefault = 'co'; m.pwHash = ''; m.pwSalt = '';
    update_('ThanhVien', m);
    deleteWhere_('PhienDN', function (r) { return r.memberId === m.id; });
    log_(ctx.me.hoTen, 'Tài khoản', 'Đặt lại mật khẩu cho ' + m.hoTen);
    return buildState_(ctx);
  });
};

API.setDefaultPassword = function (ctx, a) {
  needBod_(ctx);
  var pw = String(a.password || '');
  if (pw.length < 4) fail_('Mật khẩu mặc định cần ít nhất 4 ký tự.');
  var s = uid_();
  props_().setProperties({ DEF_SALT: s, DEF_HASH: hash_(pw, s) });
  log_(ctx.me.hoTen, 'Cài đặt', 'Đổi mật khẩu mặc định');
  return true;
};

API.state = function (ctx) { return buildState_(ctx); };

/* ---------- Menu trong file Sheets (cho người không biết code) ---------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('App ECO')
    .addItem('Đặt lại mật khẩu quản trị gốc', 'menuResetRoot')
    .addItem('Cài lại lịch chạy tự động', 'installTriggers')
    .addToUi();
}

function menuResetRoot() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Mật khẩu mới cho tài khoản quản trị gốc (' + ownerEmail_() + '), ít nhất 8 ký tự:');
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var pw = r.getResponseText();
  if (pw.length < 8) { ui.alert('Cần ít nhất 8 ký tự.'); return; }
  var s = uid_();
  props_().setProperties({ ROOT_SALT: s, ROOT_HASH: hash_(pw, s) });
  ui.alert('Đã đặt lại. Đăng nhập app bằng ' + ownerEmail_() + ' và mật khẩu vừa nhập.');
}

/** Chạy một lần trong trình sửa Apps Script để cấp quyền và tạo các tab dữ liệu. */
function setup() {
  ensureTables_();
  installTriggers();
  var p = props_();
  if (!p.getProperty('ROOT_HASH')) {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    p.setProperty('BOOT_CODE', code);
    Logger.log('MÃ KHỞI TẠO APP: ' + code + ' (nhập ở màn hình Khởi tạo app ECO, dùng một lần)');
  }
  Logger.log('Xong. Dữ liệu: ' + ss_().getUrl());
}
