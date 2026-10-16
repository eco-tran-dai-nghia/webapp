/**
 * Mail (mục MAIL), làm theo code mail của dự án cũ.
 *  - UCV: đọc hộp thư CLB; mọi thao tác làm thay đổi hộp thư tạo một yêu cầu chờ BOD duyệt.
 *  - BOD: duyệt yêu cầu; gửi thư tùy biến từ thư nháp Gmail (gửi ngay / hẹn giờ); danh bạ; lịch gửi.
 */

var API = API || {};

var GMAIL_FOLDERS = {
  'Hộp thư đến': 'in:inbox', 'Đã gửi': 'in:sent', 'Lưu trữ': '-in:inbox -in:sent -in:trash -in:spam -in:drafts',
  'Thư rác': 'in:spam', 'Thùng rác': 'in:trash'
};
var MAIL_PAGE = 30, MAX_FILE_MB = 10, MAX_TOTAL_MB = 20, MAX_DRAFTS = 60;
var MAIL_ACTIONS = {
  soan: 'Soạn thư mới', traLoi: 'Trả lời', traLoiTatCa: 'Trả lời tất cả', chuyenTiep: 'Chuyển tiếp', luuTru: 'Lưu trữ',
  veHopThu: 'Đưa về hộp thư đến', xoa: 'Xóa', thuRac: 'Chuyển vào thư rác', ganNhan: 'Gắn nhãn', boNhan: 'Bỏ nhãn'
};

function needUcv_(ctx) { if (!ctx.isUcv) fail_('Chỉ UCV dùng được hộp thư CLB.'); }
function gmailLink_(tail) { return 'https://mail.google.com/mail/u/?authuser=' + encodeURIComponent(ownerEmail_()) + (tail || ''); }
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function dt_(d) { return Utilities.formatDate(d, TZ, 'dd/MM/yyyy HH:mm'); }
function htmlToText_(h) { return String(h || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim(); }
function cleanHtml_(h) { return String(h || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/javascript:/gi, ''); }
function splitEmails_(s) { return String(s || '').split(/[,;\n]+/).map(function (x) { return x.trim(); }).filter(String); }

/* ---------- Chữ ký (MAIL-12) ---------- */

function gmailSignature_(fresh) {
  var c = CacheService.getScriptCache();
  if (!fresh) { var v = c.get('sig'); if (v !== null) return { html: v, err: '' }; }
  try {
    var ds = Gmail.Users.Settings.SendAs.list('me').sendAs || [];
    var s = ds.filter(function (x) { return x.isDefault; })[0] || ds.filter(function (x) { return x.isPrimary; })[0];
    var html = s && s.signature ? String(s.signature) : '';
    try { c.put('sig', html, 21600); } catch (e) { }
    return { html: html, err: '' };
  } catch (e) { return { html: '', err: 'Không đọc được chữ ký từ Gmail: ' + String(e.message || e).slice(0, 200) }; }
}
function signature_() { var g = gmailSignature_(); return { on: setting_('dungChuKy') !== 'tat', html: g.html, err: g.err }; }

API.signatureInfo = function (ctx, a) {
  needBod_(ctx);
  var g = gmailSignature_(!!a.fresh);
  return { on: setting_('dungChuKy') !== 'tat', html: g.html, err: g.err, editLink: gmailLink_('#settings/general') };
};

/* ---------- UCV đọc hộp thư ---------- */

function threadSummary_(t) {
  var msgs = t.getMessages(), last = msgs[msgs.length - 1];
  return {
    id: t.getId(), tieuDe: t.getFirstMessageSubject() || '(không có tiêu đề)', tu: String(last.getFrom()), luc: dt_(t.getLastMessageDate()),
    ms: t.getLastMessageDate().getTime(), soThu: msgs.length, chuaDoc: t.isUnread(), nhan: t.getLabels().map(function (l) { return l.getName(); }),
    doan: String(last.getPlainBody() || '').replace(/\s+/g, ' ').slice(0, 140)
  };
}

function threadDetail_(id) {
  var t = GmailApp.getThreadById(String(id));
  if (!t) fail_('Không tìm thấy thư, có thể đã bị xóa hẳn.');
  return {
    id: t.getId(), tieuDe: t.getFirstMessageSubject() || '(không có tiêu đề)', nhan: t.getLabels().map(function (l) { return l.getName(); }),
    inInbox: t.isInInbox(), inTrash: t.isInTrash(), inSpam: t.isInSpam(), gmail: gmailLink_('#all/' + t.getId()),
    thu: t.getMessages().map(function (m) {
      return {
        id: m.getId(), tu: String(m.getFrom()), den: String(m.getTo()), cc: String(m.getCc() || ''), luc: dt_(m.getDate()),
        html: cleanHtml_(m.getBody()),
        tep: m.getAttachments({ includeInlineImages: false }).map(function (f) { return { ten: f.getName(), kb: Math.ceil(f.getSize() / 1024) }; })
      };
    })
  };
}

API.mailList = function (ctx, a) {
  needUcv_(ctx);
  var labels = GmailApp.getUserLabels().map(function (l) { return l.getName(); }).sort();
  var f = String(a.folder || 'Hộp thư đến');
  var q = GMAIL_FOLDERS[f] || (labels.indexOf(f) >= 0 ? 'label:"' + f.replace(/"/g, '') + '"' : GMAIL_FOLDERS['Hộp thư đến']);
  if (a.q) q += ' ' + String(a.q).slice(0, 200);
  var start = Math.max(0, Number(a.start) || 0);
  var th = GmailApp.search(q, start, MAIL_PAGE + 1);
  return { labels: labels, folders: Object.keys(GMAIL_FOLDERS), list: th.slice(0, MAIL_PAGE).map(threadSummary_), more: th.length > MAIL_PAGE };
};

API.mailThread = function (ctx, a) {
  if (!ctx.isUcv && !ctx.isBod) fail_('Bạn không có quyền xem thư.');
  return threadDetail_(a.id);
};

API.mailAttachment = function (ctx, a) {
  if (!ctx.isUcv && !ctx.isBod) fail_('Bạn không có quyền xem thư.');
  var m = GmailApp.getMessageById(String(a.msgId));
  if (!m || m.getThread().getId() !== String(a.threadId)) fail_('Không tìm thấy tệp.');
  var f = m.getAttachments({ includeInlineImages: false })[Number(a.idx)];
  if (!f) fail_('Không tìm thấy tệp.');
  if (f.getSize() > 8 * 1048576) fail_('Tệp lớn hơn 8 MB, mở thư trong Gmail để tải.');
  return { ten: f.getName(), loai: f.getContentType(), base64: Utilities.base64Encode(f.getBytes()) };
};

/** Danh bạ cho khung soạn thư và chữ ký sẽ gắn. */
API.mailComposeConfig = function (ctx) {
  if (!ctx.isUcv && !ctx.isBod) fail_('Bạn không có quyền.');
  var list = [];
  var org = {};
  orgList_().forEach(function (b) { org[b.ma] = b.ten; });
  table_('ThanhVien').forEach(function (m) {
    if (m.trangThai === 'active' && emailOk_(m.email)) list.push({ nhom: 'Thành viên · ' + (m.ban === 'BOD' ? 'BOD' : 'Ban ' + m.ban), ten: m.hoTen, email: m.email });
  });
  table_('DanhBa').forEach(function (d) { if (emailOk_(d.email)) list.push({ nhom: d.nhom || 'Danh bạ', ten: d.ten || d.email, email: d.email }); });
  var sg = signature_();
  return { contacts: list, signature: sg.on ? sg.html : '', maxFileMb: MAX_FILE_MB, maxTotalMb: MAX_TOTAL_MB };
};

/** Đọc email từ một Google Sheet (cách thứ 3 thêm người nhận). */
API.mailSheetEmails = function (ctx, a) {
  if (!ctx.isUcv && !ctx.isBod) fail_('Bạn không có quyền.');
  var ss;
  try { ss = SpreadsheetApp.openByUrl(String(a.url || '').trim()); } catch (e) { fail_('Không mở được sheet. Chia sẻ sheet cho ' + ownerEmail_() + ' rồi thử lại.'); }
  var sh = a.tab ? ss.getSheetByName(String(a.tab)) : ss.getSheets()[0];
  if (!sh) fail_('Không có tab này.');
  var v = sh.getDataRange().getValues().slice(0, 2001);
  var out = [];
  v.forEach(function (r) { r.forEach(function (c) { var s = String(c).trim(); if (emailOk_(s) && out.indexOf(s) < 0) out.push(s); }); });
  return { name: ss.getName(), tab: sh.getName(), tabs: ss.getSheets().map(function (s) { return s.getName(); }), emails: out };
};

/* ---------- Yêu cầu của UCV ---------- */

function mailReq_(v, forBod) {
  var o = {
    id: v.id, luc: v.luc, thaoTac: v.thaoTac, thaoTacTen: MAIL_ACTIONS[v.thaoTac] || v.thaoTac, maThu: v.maThu, tieuDeThu: v.tieuDeThu,
    den: v.den, cc: v.cc, bcc: v.bcc, tieuDe: v.tieuDe, noiDung: v.noiDung, nhan: v.nhan, dinhKem: jsonOr_(v.dinhKem, []),
    tuyChon: jsonOr_(v.tuyChon, {}), trangThai: v.trangThai, ghiChu: v.ghiChu, nguoiDuyet: v.nguoiDuyet, lucDuyet: v.lucDuyet, bodSua: v.bodSua === 'co'
  };
  if (forBod) {
    var m = byId_('ThanhVien', v.nguoiTao);
    o.nguoiTao = m ? m.hoTen : v.nguoiTao;
    o.gmail = v.maThu ? gmailLink_('#all/' + v.maThu) : '';
  }
  return o;
}

API.mailMine = function (ctx) {
  needUcv_(ctx);
  return table_('MailViec').filter(function (v) { return v.nguoiTao === ctx.me.id; }).map(function (v) { return mailReq_(v, false); })
    .sort(function (a, b) { return ms_(b.luc) - ms_(a.luc); }).slice(0, 300);
};

function checkReq_(r) {
  if (r.thaoTac === 'ganNhan' || r.thaoTac === 'boNhan') { if (!r.nhan) return 'Chọn nhãn.'; return ''; }
  if (['luuTru', 'veHopThu', 'xoa', 'thuRac'].indexOf(r.thaoTac) >= 0) return r.maThu ? '' : 'Thiếu thư.';
  if (r.thaoTac === 'soan' || r.thaoTac === 'chuyenTiep') {
    if (!splitEmails_(r.den).length) return 'Nhập người nhận.';
  }
  var bad = splitEmails_(r.den).concat(splitEmails_(r.cc), splitEmails_(r.bcc)).filter(function (e) { return !emailOk_(e.replace(/^.*<|>$/g, '')); });
  if (bad.length) return 'Email chưa đúng: ' + bad.slice(0, 3).join(', ');
  if (r.thaoTac === 'soan' && !String(r.tieuDe || '').trim()) return 'Nhập tiêu đề.';
  if ((r.thaoTac === 'soan' || r.thaoTac === 'traLoi' || r.thaoTac === 'traLoiTatCa') && !htmlToText_(r.noiDung) && !/<img/i.test(r.noiDung || '')) return 'Nhập nội dung thư.';
  return '';
}

function attachFolder_() {
  var id = props_().getProperty('ATTACH_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var f = DriveApp.createFolder('ECO - Đính kèm mail');
  props_().setProperty('ATTACH_FOLDER', f.getId());
  return f;
}

/** UCV lưu nháp hoặc gửi BOD duyệt. r: {id?, thaoTac, maThu, den, cc, bcc, tieuDe, noiDung(html), nhan, trichDan, tepGiu[ids], tepMoi[{ten,loai,base64}], tepDrive[ids]} */
API.mailSave = function (ctx, a) {
  needUcv_(ctx);
  var r = a.req || {};
  if (!MAIL_ACTIONS[r.thaoTac]) fail_('Thao tác không hợp lệ.');
  r.noiDung = cleanHtml_(r.noiDung);
  if (r.noiDung.length > 45000) fail_('Nội dung quá dài. Nếu dán từ nơi khác, thử dán không kèm định dạng (Ctrl+Shift+V).');
  var err = checkReq_(r);
  if (err && a.submit) fail_(err);
  var res = withLock_(function () {
    var v = r.id ? byId_('MailViec', r.id) : null;
    if (r.id && (!v || v.nguoiTao !== ctx.me.id)) fail_('Không tìm thấy thư cần sửa.');
    if (v && ['nhap', 'sua'].indexOf(v.trangThai) < 0) fail_('Thư này đang chờ duyệt hoặc đã xử lý, không sửa được nữa.');
    var keep = r.tepGiu || [];
    var files = (v ? jsonOr_(v.dinhKem, []) : []).filter(function (f) { return keep.indexOf(f.id) >= 0; });
    var total = 0;
    files.forEach(function (f) { total += f.kb || 0; });
    var folder = null;
    (r.tepMoi || []).forEach(function (f) {
      var n = Math.floor(String(f.base64 || '').length * 3 / 4);
      if (n > MAX_FILE_MB * 1048576) fail_('Tệp "' + f.ten + '" lớn hơn ' + MAX_FILE_MB + ' MB.');
      total += Math.ceil(n / 1024);
      if (total > MAX_TOTAL_MB * 1024) fail_('Tổng tệp đính kèm lớn hơn ' + MAX_TOTAL_MB + ' MB.');
      folder = folder || attachFolder_();
      var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(String(f.base64)), String(f.loai || 'application/octet-stream'), String(f.ten || 'tep')));
      files.push({ id: file.getId(), ten: String(f.ten || 'tep'), kb: Math.ceil(n / 1024) });
    });
    (r.tepDrive || []).forEach(function (id) {
      var file;
      try { file = DriveApp.getFileById(String(id).trim()); } catch (e) { fail_('Không mở được tệp Drive. Chia sẻ tệp cho ' + ownerEmail_() + '.'); }
      var kb = Math.ceil(file.getSize() / 1024);
      if (kb > MAX_FILE_MB * 1024) fail_('Tệp "' + file.getName() + '" lớn hơn ' + MAX_FILE_MB + ' MB.');
      total += kb;
      if (total > MAX_TOTAL_MB * 1024) fail_('Tổng tệp đính kèm lớn hơn ' + MAX_TOTAL_MB + ' MB.');
      files.push({ id: file.getId(), ten: file.getName(), kb: kb });
    });
    var subjOrig = '';
    if (r.maThu) { try { subjOrig = GmailApp.getThreadById(String(r.maThu)).getFirstMessageSubject(); } catch (e) { } }
    var o = v || { id: uid_(), nguoiTao: ctx.me.id, luc: nowS_() };
    o.thaoTac = r.thaoTac; o.maThu = str_(r.maThu, 100); o.tieuDeThu = subjOrig;
    o.den = splitEmails_(r.den).join(', '); o.cc = splitEmails_(r.cc).join(', '); o.bcc = splitEmails_(r.bcc).join(', ');
    o.tieuDe = str_(r.tieuDe, 250); o.noiDung = r.noiDung; o.nhan = str_(r.nhan, 100);
    o.dinhKem = JSON.stringify(files); o.tuyChon = JSON.stringify({ trichDan: r.trichDan !== false });
    o.trangThai = a.submit ? 'cho' : 'nhap';
    if (v) update_('MailViec', o); else insert_('MailViec', [o]);
    return o;
  });
  if (a.submit) {
    var bods = table_('ThanhVien').filter(function (m) { return m.trangThai === 'active' && m.ban === 'BOD'; }).map(function (m) { return m.id; });
    notify_(bods, 'Thư UCV chờ duyệt', (MAIL_ACTIONS[res.thaoTac]) + ': ' + (res.tieuDe || res.tieuDeThu || ''), '#/duyet-thu');
    mailClub_('mail', 'Có thư UCV chờ duyệt', ctx.me.hoTen + ' gửi yêu cầu "' + MAIL_ACTIONS[res.thaoTac] + '": ' + (res.tieuDe || res.tieuDeThu || '') + '\nDuyệt trong app: mục Duyệt thư UCV.');
  }
  return { id: res.id, dinhKem: jsonOr_(res.dinhKem, []) };
};

API.mailDelete = function (ctx, a) {
  needUcv_(ctx);
  return withLock_(function () {
    var v = byId_('MailViec', a.id);
    if (!v || v.nguoiTao !== ctx.me.id) fail_('Không tìm thấy thư.');
    if (['nhap', 'sua', 'tuChoi'].indexOf(v.trangThai) < 0) fail_('Chỉ xóa được thư nháp, cần sửa lại hoặc bị từ chối.');
    deleteWhere_('MailViec', function (x) { return x.id === v.id; });
    return true;
  });
};

/* ---------- BOD duyệt ---------- */

API.mailReview = function (ctx) {
  needBod_(ctx);
  return table_('MailViec').filter(function (v) { return v.trangThai !== 'nhap'; }).map(function (v) { return mailReq_(v, true); })
    .sort(function (a, b) { return (a.trangThai === 'cho' ? 0 : 1) - (b.trangThai === 'cho' ? 0 : 1) || ms_(b.luc) - ms_(a.luc); }).slice(0, 300)
    .concat([]).map(function (x) { return x; });
};

API.mailQuota = function (ctx) { needBod_(ctx); return { conLai: MailApp.getRemainingDailyQuota() }; };

/** decision: duyet | sua | tuChoi. edit (tùy chọn): {den, cc, bcc, tieuDe, noiDung} khi BOD sửa trực tiếp rồi duyệt. */
API.mailDecide = function (ctx, a) {
  needBod_(ctx);
  if (['duyet', 'sua', 'tuChoi'].indexOf(a.decision) < 0) fail_('Quyết định không hợp lệ.');
  var out = withLock_(function () {
    var v = byId_('MailViec', a.id);
    if (!v) fail_('Không tìm thấy yêu cầu.');
    if (v.trangThai !== 'cho') fail_('Yêu cầu này đã được xử lý.');
    var note = str_(a.note, 2000);
    if (a.edit && a.decision === 'duyet') {
      ['den', 'cc', 'bcc'].forEach(function (k) { if (a.edit[k] !== undefined) v[k] = splitEmails_(a.edit[k]).join(', '); });
      if (a.edit.tieuDe !== undefined) v.tieuDe = str_(a.edit.tieuDe, 250);
      if (a.edit.noiDung !== undefined) v.noiDung = cleanHtml_(a.edit.noiDung);
      v.bodSua = 'co';
      log_(ctx.me.hoTen, 'Duyệt thư', 'Sửa trực tiếp thư UCV "' + (v.tieuDe || v.tieuDeThu) + '"');
    }
    var st = a.decision, threadId = v.maThu;
    if (st === 'duyet') {
      var err = checkReq_({ thaoTac: v.thaoTac, maThu: v.maThu, den: v.den, cc: v.cc, bcc: v.bcc, tieuDe: v.tieuDe, noiDung: v.noiDung, nhan: v.nhan });
      if (err) fail_(err);
      try { threadId = runMailReq_(v) || threadId; }
      catch (e) { st = 'loi'; note = (note ? note + '\n' : '') + 'Lỗi: ' + e.message; }
    }
    v.trangThai = st; v.ghiChu = note; v.nguoiDuyet = ctx.me.hoTen; v.lucDuyet = nowS_(); v.maThu = threadId || '';
    update_('MailViec', v);
    var label = { duyet: 'đã được duyệt', sua: 'cần sửa lại', tuChoi: 'bị từ chối', loi: 'gặp lỗi khi gửi' }[st];
    notify_([v.nguoiTao], 'Thư của bạn ' + label, (v.tieuDe || v.tieuDeThu || '') + (note ? ' · ' + note.slice(0, 120) : ''), '#/thu-cua-toi');
    log_(ctx.me.hoTen, 'Duyệt thư', MAIL_ACTIONS[v.thaoTac] + ' "' + (v.tieuDe || v.tieuDeThu) + '": ' + label);
    return { st: st, note: note };
  });
  if (out.st === 'loi') fail_('Gmail báo lỗi, yêu cầu chuyển sang Lỗi: ' + out.note.split('Lỗi: ').pop());
  return API.mailReview(ctx);
};

function replyTarget_(t) {
  var msgs = t.getMessages(), me = ownerEmail_();
  for (var i = msgs.length - 1; i >= 0; i--) if (String(msgs[i].getFrom()).toLowerCase().indexOf(me) < 0) return msgs[i];
  return msgs[msgs.length - 1];
}
function quote_(m) {
  return '<div class="gmail_quote"><div class="gmail_attr">Vào ' + dt_(m.getDate()) + ', ' + esc_(m.getFrom()) + ' đã viết:<br></div>' +
    '<blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">' + m.getBody() + '</blockquote></div>';
}
function bodyHtml_(v) {
  var sg = signature_();
  return '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' + v.noiDung + '</div>' + (sg.on && sg.html ? '<br><div>--</div>' + sg.html : '');
}

/** Thực hiện một yêu cầu đã duyệt trên Gmail CLB. Trả về mã luồng thư. */
function runMailReq_(v) {
  var html = bodyHtml_(v), text = htmlToText_(html);
  var opt = { htmlBody: html };
  if (v.cc) opt.cc = v.cc;
  if (v.bcc) opt.bcc = v.bcc;
  var files = jsonOr_(v.dinhKem, []);
  if (files.length) opt.attachments = files.map(function (f) { return DriveApp.getFileById(f.id).getBlob().setName(f.ten); });
  var tc = jsonOr_(v.tuyChon, {});
  if (v.thaoTac === 'soan') return GmailApp.createDraft(v.den, v.tieuDe, text, opt).send().getThread().getId();
  var t = GmailApp.getThreadById(v.maThu);
  if (!t) throw new Error('Thư gốc không còn nữa.');
  if (v.thaoTac === 'traLoi' || v.thaoTac === 'traLoiTatCa') {
    var g = replyTarget_(t);
    if (tc.trichDan !== false) opt.htmlBody = html + '<br>' + quote_(g);
    (v.thaoTac === 'traLoi' ? g.createDraftReply(text, opt) : g.createDraftReplyAll(text, opt)).send();
    return t.getId();
  }
  if (v.thaoTac === 'chuyenTiep') {
    var last = t.getMessages()[t.getMessages().length - 1];
    var head = '<br><br>---------- Thư được chuyển tiếp ----------<br>Từ: ' + esc_(last.getFrom()) + '<br>Ngày: ' + dt_(last.getDate()) + '<br>Tiêu đề: ' + esc_(last.getSubject()) + '<br>Tới: ' + esc_(last.getTo()) + '<br><br>';
    var fo = { htmlBody: (htmlToText_(v.noiDung) || /<img/i.test(v.noiDung) ? html : '') + head + last.getBody(), attachments: last.getAttachments().concat(opt.attachments || []) };
    if (v.cc) fo.cc = v.cc;
    if (v.bcc) fo.bcc = v.bcc;
    fo.subject = v.tieuDe || ('Fwd: ' + last.getSubject());
    last.forward(v.den, fo);
    return t.getId();
  }
  if (v.thaoTac === 'luuTru') { t.moveToArchive(); return t.getId(); }
  if (v.thaoTac === 'veHopThu') { t.moveToInbox(); return t.getId(); }
  if (v.thaoTac === 'xoa') { t.moveToTrash(); return t.getId(); }
  if (v.thaoTac === 'thuRac') { t.moveToSpam(); return t.getId(); }
  if (v.thaoTac === 'ganNhan') { (GmailApp.getUserLabelByName(v.nhan) || GmailApp.createLabel(v.nhan)).addToThread(t); return t.getId(); }
  if (v.thaoTac === 'boNhan') { var l = GmailApp.getUserLabelByName(v.nhan); if (l) l.removeFromThread(t); return t.getId(); }
  throw new Error('Thao tác không hợp lệ.');
}

/* ---------- Gửi thư tùy biến từ thư nháp Gmail ---------- */

function placeholders_(s) {
  var out = [], re = /\{([^{}\n]{1,60})\}/g, m;
  while ((m = re.exec(String(s || '')))) if (out.indexOf(m[1].trim()) < 0) out.push(m[1].trim());
  return out;
}

function draftSummary_(d) {
  var m = d.getMessage(), html = String(m.getBody() || '');
  return {
    id: d.getId(), tieuDe: String(m.getSubject() || ''), luc: dt_(m.getDate()), ms: m.getDate().getTime(),
    doan: htmlToText_(html).replace(/\s+/g, ' ').slice(0, 160), choTrong: placeholders_(String(m.getSubject() || '') + ' ' + htmlToText_(html)),
    tep: m.getAttachments({ includeInlineImages: false }).map(function (f) { return f.getName(); }),
    link: gmailLink_('#drafts?compose=' + m.getId())
  };
}

API.mailDrafts = function (ctx) {
  needBod_(ctx);
  var ds = GmailApp.getDrafts().slice(0, MAX_DRAFTS).map(draftSummary_).sort(function (a, b) { return b.ms - a.ms; });
  return { list: ds, linkDrafts: gmailLink_('#drafts'), linkNew: gmailLink_('#drafts?compose=new'), linkInbox: gmailLink_('#inbox'), conLai: MailApp.getRemainingDailyQuota() };
};

API.mailDraft = function (ctx, a) {
  needBod_(ctx);
  var d = draftById_(a.id);
  var s = draftSummary_(d);
  s.html = cleanHtml_(d.getMessage().getBody());
  return s;
};

function draftById_(id) {
  var d = null;
  try { d = GmailApp.getDraft(String(id)); } catch (e) { d = null; }
  if (!d) throw new Error('Không tìm thấy thư nháp này trong Gmail CLB, có thể đã bị xóa hoặc đã gửi.');
  return d;
}

function templateOf_(id) {
  var m = draftById_(id).getMessage();
  var html = String(m.getBody() || '');
  var imgs = m.getAttachments({ includeInlineImages: true, includeAttachments: false });
  var byName = {};
  imgs.forEach(function (f) { byName[f.getName()] = f; });
  var inline = {}, re = /<img[^>]*?src="cid:([^"]+)"[^>]*?alt="([^"]*)"[^>]*>/gi, x;
  while ((x = re.exec(html))) if (byName[x[2]]) inline[x[1]] = byName[x[2]];
  return { tieuDe: String(m.getSubject() || ''), html: html, tep: m.getAttachments({ includeInlineImages: false }), anh: inline };
}

function fill_(s, data, html) {
  return String(s || '').replace(/\{([^{}\n]{1,60})\}/g, function (all, k) {
    k = k.trim();
    if (!(k in data)) return all;
    return html ? esc_(data[k]) : String(data[k]);
  });
}

/** Nguồn người nhận: thành viên (cột như sheet thành viên) và danh bạ. */
API.mailSources = function (ctx) {
  needBod_(ctx);
  var cols = [['hoTen', 'Họ và tên'], ['lop', 'Lớp'], ['ban', 'Ban'], ['mang', 'Mảng'], ['chucVu', 'Chức vụ'], ['ngaySinh', 'Ngày sinh'], ['email', 'Email'], ['sdt', 'Số điện thoại'], ['tenFb', 'Tên Facebook'], ['linkFb', 'Link Facebook']];
  var members = table_('ThanhVien').filter(function (m) { return m.trangThai === 'active' && emailOk_(m.email); }).map(function (m) {
    var o = {};
    cols.forEach(function (c) { o[c[1]] = m[c[0]] || ''; });
    return o;
  });
  var fields = [];
  var contacts = table_('DanhBa').map(function (d) {
    var f = jsonOr_(d.truong, {});
    Object.keys(f).forEach(function (k) { if (fields.indexOf(k) < 0) fields.push(k); });
    return { id: d.id, email: d.email, ten: d.ten, nhom: d.nhom, truong: f };
  });
  return { memberCols: cols.map(function (c) { return c[1]; }), members: members, contacts: contacts, contactFields: fields, conLai: MailApp.getRemainingDailyQuota() };
};

API.mailSheetRows = function (ctx, a) { needBod_(ctx); return API.readSheetLink(ctx, a); };

/** Gửi hàng loạt. a: {draftId, recipients:[{email, data}], desc, at ('yyyy-MM-dd HH:mm', trống = gửi ngay)} */
API.mailSend = function (ctx, a) {
  needBod_(ctx);
  var tpl = templateOf_(a.draftId);
  var rec = (a.recipients || []).filter(function (r) { return emailOk_(r.email); });
  if (!rec.length) fail_('Chưa có người nhận hợp lệ.');
  var miss = placeholders_(tpl.tieuDe + ' ' + htmlToText_(tpl.html)).filter(function (k) { return rec.some(function (r) { return !(k in (r.data || {})); }); });
  if (miss.length) fail_('Thư dùng trường không có trong nguồn người nhận: {' + miss.join('}, {') + '}. Sửa thư nháp rồi thử lại.');
  if (a.at) {
    var at = needTime_(a.at, 'Giờ hẹn');
    if (ms_(at) < Date.now() + 60000) fail_('Giờ hẹn phải sau bây giờ ít nhất 1 phút.');
    var payload = JSON.stringify(rec.map(function (r) { return { email: r.email, data: r.data || {} }; }));
    if (payload.length > 45000) fail_('Danh sách người nhận quá lớn để hẹn giờ. Chia thành nhiều đợt nhỏ hơn.');
    withLock_(function () {
      insert_('LichGui', [{ id: uid_(), taoLuc: nowS_(), guiLuc: at, tieuDe: tpl.tieuDe, maNhap: a.draftId, nguoiNhan: payload, moTaNguon: str_(a.desc, 200), nguoiTao: ctx.me.hoTen, trangThai: 'hen', ketQua: '' }]);
      log_(ctx.me.hoTen, 'Mail', 'Hẹn gửi "' + tpl.tieuDe + '" cho ' + rec.length + ' người lúc ' + at.slice(0, 16));
    });
    return { scheduled: true, count: rec.length };
  }
  var r = sendBatch_(tpl, rec, a.draftId, str_(a.desc, 200), ctx.me.hoTen);
  log_(ctx.me.hoTen, 'Mail', 'Gửi "' + tpl.tieuDe + '": ' + r.sent + '/' + rec.length + (r.deferred ? ', dời ' + r.deferred + ' sang hôm sau' : ''));
  return r;
};

/** Gửi trong hạn mức hôm nay; phần còn lại tự dời sang 7:00 hôm sau (MAIL-10). */
function sendBatch_(tpl, rec, draftId, desc, by) {
  var quota = MailApp.getRemainingDailyQuota();
  var now = rec.slice(0, Math.max(0, quota)), later = rec.slice(Math.max(0, quota));
  var sent = 0, errs = [];
  now.forEach(function (r) {
    try {
      var d = r.data || {};
      var o = { htmlBody: fill_(tpl.html, d, true) };
      if (tpl.tep.length) o.attachments = tpl.tep;
      if (Object.keys(tpl.anh).length) o.inlineImages = tpl.anh;
      GmailApp.sendEmail(r.email, fill_(tpl.tieuDe, d, false), htmlToText_(o.htmlBody), o);
      sent++;
    } catch (e) { errs.push(r.email + ': ' + e.message); }
  });
  withLock_(function () {
    var rows = [];
    if (now.length) rows.push({ id: uid_(), taoLuc: nowS_(), guiLuc: nowS_(), tieuDe: tpl.tieuDe, maNhap: '', nguoiNhan: JSON.stringify(now.map(function (r) { return { email: r.email }; })).slice(0, 45000), moTaNguon: desc, nguoiTao: by, trangThai: sent ? 'daGui' : 'loi', ketQua: 'Đã gửi ' + sent + '/' + now.length + (errs.length ? '. Lỗi: ' + errs.slice(0, 3).join('; ') : '') });
    if (later.length) {
      var tmr = fmtDay_(new Date(Date.now() + 86400000)) + ' 07:00:00';
      rows.push({ id: uid_(), taoLuc: nowS_(), guiLuc: tmr, tieuDe: tpl.tieuDe, maNhap: draftId, nguoiNhan: JSON.stringify(later).slice(0, 45000), moTaNguon: desc + ' (phần dời do hết hạn mức)', nguoiTao: by, trangThai: 'hen', ketQua: '' });
    }
    insert_('LichGui', rows);
  });
  return { scheduled: false, sent: sent, total: now.length, errors: errs, deferred: later.length };
}

function sendScheduledMail_() {
  var due = [];
  withLock_(function () {
    table_('LichGui').forEach(function (l) {
      if (l.trangThai === 'hen' && ms_(l.guiLuc) <= Date.now()) { l.trangThai = 'dangGui'; update_('LichGui', l); due.push(l); }
    });
  });
  due.forEach(function (l) {
    var st = 'daGui', kq = '';
    try {
      var tpl = templateOf_(l.maNhap);
      var rec = jsonOr_(l.nguoiNhan, []);
      var r = sendBatch_(tpl, rec, l.maNhap, l.moTaNguon, l.nguoiTao);
      kq = 'Đã gửi ' + r.sent + '/' + r.total + (r.deferred ? ', dời ' + r.deferred + ' sang hôm sau' : '') + (r.errors.length ? '. Lỗi: ' + r.errors.slice(0, 3).join('; ') : '');
      if (!r.sent && r.total) st = 'loi';
      if (!r.total && r.deferred) st = 'doi';
    } catch (e) { st = 'loi'; kq = e.message; }
    withLock_(function () { delete DB_MEMO_.LichGui; var x = byId_('LichGui', l.id); if (x) { x.trangThai = st; x.ketQua = kq; update_('LichGui', x); } });
  });
}

API.mailSchedule = function (ctx) {
  needBod_(ctx);
  var term = table_('NhiemKy').filter(function (t) { return t.id === setting_('nhiemKy'); })[0];
  var from = term && term.batDau ? ms_(term.batDau) : 0;
  return table_('LichGui').filter(function (l) { return l.trangThai === 'hen' || ms_(l.taoLuc) >= from; }).map(function (l) {
    return { id: l.id, taoLuc: l.taoLuc, guiLuc: l.guiLuc, tieuDe: l.tieuDe, soNguoi: jsonOr_(l.nguoiNhan, []).length, moTaNguon: l.moTaNguon, nguoiTao: l.nguoiTao, trangThai: l.trangThai, ketQua: l.ketQua, linkNhap: l.maNhap ? gmailLink_('#drafts') : '' };
  }).sort(function (a, b) { return ms_(b.guiLuc) - ms_(a.guiLuc); }).slice(0, 300);
};

API.mailScheduleEdit = function (ctx, a) {
  needBod_(ctx);
  withLock_(function () {
    var l = byId_('LichGui', a.id);
    if (!l || l.trangThai !== 'hen') fail_('Thư này đã gửi hoặc đã hủy.');
    if (a.cancel) { l.trangThai = 'huy'; l.ketQua = 'Hủy bởi ' + ctx.me.hoTen; }
    else { var at = needTime_(a.at, 'Giờ hẹn'); if (ms_(at) < Date.now() + 60000) fail_('Giờ hẹn phải sau bây giờ ít nhất 1 phút.'); l.guiLuc = at; }
    update_('LichGui', l);
    log_(ctx.me.hoTen, 'Mail', (a.cancel ? 'Hủy' : 'Đổi giờ') + ' thư hẹn "' + l.tieuDe + '"');
  });
  return API.mailSchedule(ctx);
};

/* ---------- Danh bạ ---------- */

API.contactSave = function (ctx, a) {
  needBod_(ctx);
  return withLock_(function () {
    if (a.deleteId) { deleteWhere_('DanhBa', function (d) { return d.id === a.deleteId; }); return API.mailSources(ctx); }
    var c = a.contact || {};
    if (!emailOk_(c.email)) fail_('Email chưa đúng.');
    var o = c.id ? byId_('DanhBa', c.id) : { id: uid_() };
    if (!o) fail_('Không tìm thấy liên hệ.');
    o.email = str_(c.email, 200); o.ten = str_(c.ten, 200) || o.email; o.nhom = str_(c.nhom, 100) || 'Khác';
    var f = {};
    Object.keys(c.truong || {}).forEach(function (k) { var kk = str_(k, 60); if (kk) f[kk] = str_(c.truong[k], 500); });
    o.truong = JSON.stringify(f);
    if (c.id) update_('DanhBa', o); else insert_('DanhBa', [o]);
    return API.mailSources(ctx);
  });
};
