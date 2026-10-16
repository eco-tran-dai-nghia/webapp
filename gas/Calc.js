/**
 * Tính toán theo quy chế (yêu cầu mục 5): kết quả task, log, KPI, điểm, xếp hạng, certificate.
 */

function num_(v, d) { var n = Number(v); return isNaN(n) || v === '' ? (d === undefined ? 0 : d) : n; }
function roundHalf_(x) { return Math.floor(x + 0.5 + 1e-9); }
function units_(s) { return Number(s.thoiLuong) === 180 ? 2 : 1; }
function jsonOr_(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function isBodM_(m) { return m.ban === 'BOD'; }

/** Thành viên còn hoạt động, không tính BOD. */
function rankable_() {
  return table_('ThanhVien').filter(function (m) { return m.trangThai === 'active' && !isBodM_(m); });
}

/** Trạng thái một lượt giao task. */
function assignStatus_(t, a, nowMs, khongLamH) {
  if (t.huy === 'co') return { st: 'huy' };
  var due = ms_(t.hanChot);
  if (a.xacNhanLuc) {
    var onTime = a.nopDungHan === 'co' || ms_(a.xacNhanLuc) <= due;
    var han = onTime ? 'dung' : 'tre';
    if (!a.chatLuong) return { st: 'cho-cham', han: han };
    var dat = a.chatLuong === 'HC' || (a.chatLuong === 'CS' && onTime);
    return { st: 'da-cham', han: han, kq: dat ? 'dat' : 'chua-dat' };
  }
  if (nowMs > due + khongLamH * 3600000) return { st: 'khong-lam', han: 'khong', kq: 'chua-dat' };
  if (nowMs > due) return { st: 'qua-han' };
  return { st: 'sap-han' };
}

/** Chỉ tiêu ban đầu của một người trong một sự kiện: riêng từng người → khối → ban. */
function quotaOf_(ev, m) {
  var ng = jsonOr_(ev.chiTieuNguoi, {}), kh = jsonOr_(ev.chiTieuKhoi, {}), ban = jsonOr_(ev.chiTieuBan, {});
  if (ng[m.id] !== undefined && ng[m.id] !== '') return num_(ng[m.id]);
  if (m.khoi && kh[m.khoi] !== undefined && kh[m.khoi] !== '') return num_(kh[m.khoi]);
  if (ban[m.ban] !== undefined && ban[m.ban] !== '') return num_(ban[m.ban]);
  return 0;
}

/** Số liệu log của một sự kiện: buổi dự kiến, buổi thực diễn ra (quy ra 90 phút), ai dự buổi nào. */
function eventLogStats_(ev, sessions, attendBySession) {
  var ss = sessions.filter(function (s) { return s.eventId === ev.id; });
  var planned = 0, held = 0;
  ss.forEach(function (s) {
    planned += units_(s);
    if ((attendBySession[s.id] || []).length) held += units_(s);
  });
  return { sessions: ss, planned: planned, held: held };
}

function memberEventLog_(ev, st, m, attendKey) {
  var initial = quotaOf_(ev, m);
  var fin = st.planned ? Math.min(initial, st.held * initial / st.planned) : 0;
  var att = 0, list = [];
  st.sessions.forEach(function (s) {
    if (attendKey[s.id + '|' + m.id]) { att += units_(s); list.push(s.id); }
  });
  var extra = Math.max(0, att - Math.floor(fin + 1e-9));
  return { initial: initial, final: fin, attended: att, extra: extra, sessions: list };
}

/** Bộ dữ liệu dùng chung cho mọi phép tính trong một lần gọi. */
function calcBase_() {
  if (DB_MEMO_._calc) return DB_MEMO_._calc;
  var term = setting_('nhiemKy');
  var events = table_('SuKien').filter(function (e) { return e.nhiemKy === term; });
  var evIds = {};
  events.forEach(function (e) { evIds[e.id] = e; });
  var sessions = table_('BuoiLog').filter(function (s) { return evIds[s.eventId]; });
  var attendBySession = {}, attendKey = {};
  table_('DiemDanh').forEach(function (d) {
    (attendBySession[d.buoiId] = attendBySession[d.buoiId] || []).push(d.memberId);
    attendKey[d.buoiId + '|' + d.memberId] = d.loai || 'co-mat';
  });
  var tasks = table_('Task').filter(function (t) { return evIds[t.eventId]; });
  var taskIds = {};
  tasks.forEach(function (t) { taskIds[t.id] = t; });
  var assigns = table_('PhanCong').filter(function (a) { return taskIds[a.taskId]; });
  var points = table_('Diem').filter(function (p) { return p.nhiemKy === term && p.huy !== 'co'; });
  var logStats = {};
  events.forEach(function (e) { logStats[e.id] = eventLogStats_(e, sessions, attendBySession); });
  DB_MEMO_._calc = {
    term: term, events: events, evIds: evIds, sessions: sessions, attendBySession: attendBySession, attendKey: attendKey,
    tasks: tasks, taskIds: taskIds, assigns: assigns, points: points, logStats: logStats,
    nowMs: Date.now(), khongLamH: num_(setting_('khongLamSauGio'), 24)
  };
  return DB_MEMO_._calc;
}

/** KPI của một thành viên. */
function kpiOf_(m) {
  var B = calcBase_();
  var bosung = m.loai === 'bo-sung';
  var joinMs = ms_(m.vaoLuc);
  var tDat = 0, tCount = 0, tPending = 0, tasks = [];
  B.assigns.forEach(function (a) {
    if (a.memberId !== m.id) return;
    var t = B.taskIds[a.taskId];
    var s = assignStatus_(t, a, B.nowMs, B.khongLamH);
    var counts = t.tinh !== 'khong' && !(bosung && ms_(t.taoLuc) < joinMs);
    tasks.push({ taskId: t.id, st: s.st, kq: s.kq || '', tinh: counts && s.st !== 'huy' });
    if (!counts || s.st === 'huy') return;
    if (s.kq) { tCount++; if (s.kq === 'dat') tDat++; }
    else if (s.st === 'cho-cham') tPending++;
  });
  var lAtt = 0, lFin = 0, projAtt = 0, projFin = 0, logs = [];
  B.events.forEach(function (ev) {
    var st = B.logStats[ev.id];
    if (!st.sessions.length) return;
    if (bosung && st.sessions.every(function (s) { return ms_(s.thoiDiem) < joinMs; })) return;
    var r = memberEventLog_(ev, st, m, B.attendKey);
    if (!r.initial && !r.attended) return;
    var closed = ev.logTrangThai === 'chot';
    var counts = ev.tinh !== 'khong';
    logs.push({ eventId: ev.id, initial: r.initial, final: r.final, attended: r.attended, extra: closed ? r.extra : 0, closed: closed, planned: st.planned, held: st.held, sessions: r.sessions });
    if (!counts) return;
    if (closed) { lAtt += r.attended; lFin += r.final; }
    projAtt += r.attended; projFin += closed ? r.final : r.initial;
  });
  var dat = num_(setting_('kpiDat'), 80);
  var logPct = lFin > 0 ? lAtt / lFin * 100 : null;
  var taskPct = tCount > 0 ? tDat / tCount * 100 : null;
  var needLog = projFin > 0 ? Math.max(0, Math.ceil(projFin * dat / 100 - projAtt - 1e-9)) : 0;
  return {
    logPct: logPct, taskPct: taskPct, logAtt: lAtt, logFin: lFin, taskDat: tDat, taskCount: tCount, taskPending: tPending,
    needLog: needLog, tasks: tasks, logs: logs
  };
}

/** Bảng xếp hạng theo điểm. phase: '1', '2' hoặc 'all' (cả nhiệm kỳ, chỉ thành viên chính thức). */
function ranking_(phase, pctTop) {
  var B = calcBase_();
  var ms = rankable_().filter(function (m) { return phase === '2' ? true : m.loai !== 'bo-sung'; });
  var score = {};
  ms.forEach(function (m) { score[m.id] = 0; });
  B.points.forEach(function (p) {
    if (score[p.memberId] === undefined) return;
    if (phase !== 'all' && p.giaiDoan !== phase) return;
    if (phase === 'all' && p.giaiDoan !== '1' && p.giaiDoan !== '2') return;
    score[p.memberId] += num_(p.diem);
  });
  var rows = ms.map(function (m) { return { id: m.id, score: score[m.id] }; });
  rows.sort(function (a, b) { return b.score - a.score; });
  rows.forEach(function (r) { r.rank = 1 + rows.filter(function (x) { return x.score > r.score; }).length; });
  var n = roundHalf_(rows.length * pctTop / 100);
  var cut = n > 0 && rows.length ? rows[Math.min(n, rows.length) - 1].score : Infinity;
  rows.forEach(function (r) { r.top = n > 0 && r.score >= cut && r.score > 0; });
  return { rows: rows, n: n, total: rows.length, cut: cut === Infinity ? null : cut, pct: pctTop };
}

/** Xét certificate cho mọi thành viên (mục 5.4). */
function certificates_() {
  var dat = num_(setting_('kpiDat'), 80), bt = num_(setting_('kpiBuTru'), 60), topBt = num_(setting_('topBuTru'), 40);
  var rAll = ranking_('all', topBt), r2 = ranking_('2', topBt);
  var inTop = function (r, id) { var x = r.rows.filter(function (y) { return y.id === id; })[0]; return x ? x : null; };
  return rankable_().map(function (m) {
    var k = kpiOf_(m);
    var lp = k.logPct === null ? 100 : roundHalf_(k.logPct), tp = k.taskPct === null ? 100 : roundHalf_(k.taskPct);
    var kq = 'chua', note = '';
    if (lp >= dat && tp >= dat) kq = 'thang';
    else if (lp >= bt && tp >= bt) {
      var tb = m.loai === 'bo-sung' ? r2 : rAll;
      var x = inTop(tb, m.id);
      if (x && x.top) kq = 'bu-tru';
      note = x ? 'Hạng ' + x.rank + '/' + tb.total + ' bảng bù trừ (top ' + topBt + '% = ' + tb.n + ' người)' : '';
    } else note = 'KPI dưới ' + bt + '%';
    return { id: m.id, logPct: lp, taskPct: tp, kq: kq, note: note, logNA: k.logPct === null, taskNA: k.taskPct === null };
  });
}
