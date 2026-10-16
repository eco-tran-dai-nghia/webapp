/**
 * Gói dữ liệu gửi về giao diện, lọc theo vai trò người đang đăng nhập.
 */

function orgList_() { return settingJson_('coCau', []); }

function publicMember_(m) {
  return { id: m.id, hoTen: m.hoTen, ban: m.ban, mang: m.mang, chucVu: m.chucVu, khoi: m.khoi, loai: m.loai, avatar: m.avatar };
}

function memberForBod_(m) {
  var o = publicMember_(m);
  ['lop', 'ngaySinh', 'email', 'sdt', 'tenFb', 'linkFb', 'dot', 'nhiemKyVao', 'trangThai', 'vaoLuc', 'core', 'coreCach', 'ucv', 'nsBan', 'nsSeeding'].forEach(function (k) { o[k] = m[k]; });
  o.daVao = !!m.lanCuoi;
  o.fbPhu = jsonOr_(m.fbPhu, []);
  return o;
}

function roleOf_(ctx) {
  return { bod: ctx.isBod, root: ctx.isRoot, ucv: ctx.isUcv, ns: ctx.nsBans, seeding: ctx.isSeeding, core: ctx.me.core === 'co' };
}

function buildState_(ctx) {
  var me = ctx.me, B = calcBase_();
  var S = settings_();
  var all = table_('ThanhVien');
  var active = all.filter(function (m) { return m.trangThai === 'active'; });
  var nsSet = {};
  ctx.nsBans.forEach(function (b) { nsSet[b] = 1; });

  var out = {
    now: nowS_(),
    me: {
      id: me.id, hoTen: me.hoTen, ban: me.ban, mang: me.mang, chucVu: me.chucVu, lop: me.lop || '', khoi: me.khoi || '',
      loai: me.loai || '', dot: me.dot || '', vaoLuc: me.vaoLuc || '', tenFb: me.tenFb || '', fbPhu: jsonOr_(me.fbPhu, []),
      avatar: me.avatar || '', email: me.email || '', pwDefault: me.pwDefault === 'co', roles: roleOf_(ctx)
    },
    term: { id: S.nhiemKy, giaiDoan: S.giaiDoan, ghiNhan: S.ghiNhan },
    settings: {
      kpiDat: S.kpiDat, kpiBuTru: S.kpiBuTru, top: S.top, topBuTru: S.topBuTru, khongLamSauGio: S.khongLamSauGio,
      coCau: orgList_(), giuThongBao: S.giuThongBao, nhacSeedingSauNgay: S.nhacSeedingSauNgay
    },
    members: active.map(function (m) {
      if (ctx.isBod) return memberForBod_(m);
      var o = publicMember_(m);
      if (nsSet[m.ban]) { o.lop = m.lop; o.tenFb = m.tenFb; }
      return o;
    }),
    catalog: table_('DanhMucDiem').filter(function (c) { return c.an !== 'co'; }).map(function (c) { return { id: c.id, ten: c.ten, diem: num_(c.diem), tuDong: c.tuDong === 'co' }; })
  };
  if (ctx.isBod) {
    ['nhacTruocHan', 'nhacNgayHan', 'nhacSauHan', 'emailBao', 'lichSinhNhat', 'dungChuKy'].forEach(function (k) { out.settings[k] = S[k]; });
    out.settings.emailBao = settingJson_('emailBao', {});
    out.ownerEmail = ownerEmail_();
  }

  /* Sự kiện và buổi log (ai cũng xem được lịch buổi). */
  out.events = B.events.map(function (e) {
    var st = B.logStats[e.id];
    var o = {
      id: e.id, ten: e.ten, batDau: e.batDau, ketThuc: e.ketThuc, moTa: e.moTa, diaDiem: e.diaDiem,
      log: { trangThai: e.logTrangThai || '', sheetUrl: e.sheetId ? 'https://docs.google.com/spreadsheets/d/' + e.sheetId + '/edit' : '', planned: st.planned, held: st.held, chotLuc: e.chotLuc, chotBoi: e.chotBoi },
      sessions: st.sessions.map(function (s) {
        var x = { id: s.id, ten: s.ten, thoiDiem: s.thoiDiem, thoiLuong: num_(s.thoiLuong, 90), huyLyDo: s.huyLyDo, count: (B.attendBySession[s.id] || []).length };
        if (ctx.isBod) x.keHoach = jsonOr_(s.keHoach, {});
        return x;
      }).sort(function (a, b) { return ms_(a.thoiDiem) - ms_(b.thoiDiem); }),
      tinh: e.tinh !== 'khong'
    };
    if (ctx.isBod) { o.log.chiTieuBan = jsonOr_(e.chiTieuBan, {}); o.log.chiTieuKhoi = jsonOr_(e.chiTieuKhoi, {}); o.log.chiTieuNguoi = jsonOr_(e.chiTieuNguoi, {}); }
    return o;
  }).sort(function (a, b) { return ms_(a.batDau) - ms_(b.batDau); });

  /* Task: thành viên thấy task của mình; NS thấy task các ban phụ trách; BOD thấy tất cả. */
  var memberById = {};
  all.forEach(function (m) { memberById[m.id] = m; });
  var byTask = {};
  B.assigns.forEach(function (a) { (byTask[a.taskId] = byTask[a.taskId] || []).push(a); });
  out.tasks = [];
  B.tasks.forEach(function (t) {
    var as = byTask[t.id] || [];
    var mine = as.some(function (a) { return a.memberId === me.id; });
    var nsSee = as.some(function (a) { var m = memberById[a.memberId]; return m && nsSet[m.ban]; });
    if (!ctx.isBod && !mine && !nsSee) return;
    out.tasks.push({
      id: t.id, eventId: t.eventId, ten: t.ten, moTa: t.moTa, hanChot: t.hanChot, huy: t.huy === 'co', taoBoi: t.taoBoi, taoLuc: t.taoLuc,
      tinh: t.tinh !== 'khong', nhatKyHan: ctx.isBod || nsSee ? jsonOr_(t.nhatKyHan, []) : [],
      assignees: as.map(function (a) {
        var s = assignStatus_(t, a, B.nowMs, B.khongLamH);
        var m = memberById[a.memberId] || {};
        return {
          id: a.id, memberId: a.memberId, isBod: m.ban === 'BOD', xacNhanLuc: a.xacNhanLuc, xacNhanBoi: a.xacNhanBoi, nopDungHan: a.nopDungHan === 'co',
          chatLuong: a.chatLuong, chamBoi: ctx.isBod ? a.chamBoi : '', chamLuc: a.chamLuc, st: s.st, han: s.han || '', kq: s.kq || ''
        };
      })
    });
  });

  /* Điểm danh: BOD thấy hết, người khác chỉ thấy của mình. */
  out.attendance = table_('DiemDanh').filter(function (d) { return ctx.isBod || d.memberId === me.id; })
    .map(function (d) { return { buoiId: d.buoiId, memberId: d.memberId, loai: d.loai, luc: d.luc, boi: ctx.isBod ? d.boi : '' }; });

  /* KPI. */
  if (ctx.isBod) {
    out.kpi = {};
    rankable_().forEach(function (m) { out.kpi[m.id] = kpiOf_(m); });
  } else if (!ctx.isRoot) {
    out.kpi = {}; out.kpi[me.id] = kpiOf_(me);
    out.myCert = certificates_().filter(function (c) { return c.id === me.id; })[0] || null;
  }

  /* Xếp hạng (mọi người thấy điểm của nhau). */
  var top = num_(S.top, 15);
  out.ranking = { g1: ranking_('1', top), g2: ranking_('2', top), all: ranking_('all', top) };

  /* Lịch sử điểm. */
  out.points = B.points.filter(function (p) { return ctx.isBod || p.memberId === me.id; }).map(function (p) {
    return { id: p.id, memberId: p.memberId, hoatDong: p.hoatDong, diem: num_(p.diem), eventId: p.eventId, chiTiet: p.chiTiet, giaiDoan: p.giaiDoan, nguon: p.nguon, luc: p.luc, boi: ctx.isBod ? p.boi : '' };
  }).sort(function (a, b) { return ms_(b.luc) - ms_(a.luc); });

  /* Góp ý. */
  out.feedback = table_('GopY').filter(function (g) { return g.nhiemKy === B.term && (ctx.isBod || (g.memberId && g.memberId === me.id)); }).map(function (g) {
    return { id: g.id, memberId: g.memberId, noiDung: g.noiDung, luc: g.luc, apDung: g.apDung === 'co', apDungBoi: ctx.isBod ? g.apDungBoi : '', apDungLuc: g.apDungLuc, giaiDoan: g.giaiDoan };
  }).sort(function (a, b) { return ms_(b.luc) - ms_(a.luc); });

  /* Thông báo của tôi. */
  out.notifications = table_('ThongBao').filter(function (n) { return n.memberId === me.id; })
    .map(function (n) { return { id: n.id, tieuDe: n.tieuDe, noiDung: n.noiDung, link: n.link, luc: n.luc, daDoc: n.daDoc === 'co' }; })
    .sort(function (a, b) { return ms_(b.luc) - ms_(a.luc); }).slice(0, 200);

  /* Seeding. */
  if (ctx.isSeeding || ctx.isBod) {
    out.seeding = table_('Seeding').map(function (s) {
      return { id: s.id, link: s.link, taoLuc: s.taoLuc, nhacLuc: s.nhacLuc, trangThai: s.trangThai, soReact: num_(s.soReact), soComment: num_(s.soComment), soNguoi: num_(s.soNguoi), ghiNhanLuc: s.ghiNhanLuc };
    }).sort(function (a, b) { return ms_(b.taoLuc) - ms_(a.taoLuc); }).slice(0, 300);
    out.fbNames = active.filter(function (m) { return !isBodM_(m); }).map(function (m) { return { id: m.id, names: [m.tenFb].concat(jsonOr_(m.fbPhu, [])).filter(String) }; });
  }

  if (ctx.isBod) {
    out.mailPending = table_('MailViec').filter(function (v) { return v.trangThai === 'cho'; }).length;
    out.uploads = table_('TaiSheet').slice().sort(function (a, b) { return ms_(b.luc) - ms_(a.luc) || b._r - a._r; }).map(function (u) { return { id: u.id, loai: u.loai, dot: u.dot, luc: u.luc, boi: u.boi, tomTat: jsonOr_(u.tomTat, {}), hoanTac: u.hoanTac }; });
    out.certificates = certificates_();
    out.terms = table_('NhiemKy').map(function (t) { return { id: t.id, trangThai: t.trangThai, batDau: t.batDau, gd2Luc: t.gd2Luc, ketThuc: t.ketThuc }; });
  }
  if (ctx.isUcv) {
    out.myMail = table_('MailViec').filter(function (v) { return v.nguoiTao === me.id; }).length;
  }
  return out;
}
