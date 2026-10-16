/* Mail: hộp thư CLB, soạn thư, thư của tôi (UCV); duyệt thư, gửi thư tùy biến, lịch gửi, danh bạ (BOD). */
'use strict';

const ACT_NAME = { soan: 'Soạn thư mới', traLoi: 'Trả lời', traLoiTatCa: 'Trả lời tất cả', chuyenTiep: 'Chuyển tiếp', luuTru: 'Lưu trữ', veHopThu: 'Đưa về hộp thư đến', xoa: 'Xóa', thuRac: 'Chuyển vào thư rác', ganNhan: 'Gắn nhãn', boNhan: 'Bỏ nhãn' };
const MST = { nhap: ['Nháp', ''], cho: ['Chờ duyệt', ''], duyet: ['Đã duyệt', 'done'], sua: ['Cần sửa lại', 'attention'], tuChoi: ['Từ chối', 'attention'], loi: ['Lỗi', 'error'] };
const mstTag = s => tag((MST[s] || [s])[0], (MST[s] || [])[1]);
const M = App.ui.mail = App.ui.mail || {};
function loading(t) { return `<p class="muted">${t || 'Đang tải…'}</p>`; }
function frameHtml(html) { return `<iframe class="mailbody" style="width:100%;min-height:240px;border:1px solid var(--border)" sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="${attr('<base target="_blank"><style>body{font-family:Arial,sans-serif;font-size:14px;margin:8px;color:#222;background:#fff}img{max-width:100%;height:auto}</style>' + html)}" onload="this.style.height=(this.contentDocument.body.scrollHeight+24)+'px'"></iframe>`; }

/* ================= P-20 Hộp thư CLB (UCV) ================= */
route('hop-thu', {
  can: () => R().ucv, wide: true,
  render(threadId) {
    const s = M.box || {};
    const folder = M.folder || 'Hộp thư đến';
    let html = topbar('Hộp thư CLB', { right: `<a class="eco-btn eco-btn--sm" href="#/soan-thu">${ic('plus', 'sm')} Soạn thư</a>` });
    html += `<div class="chips">${(s.folders || ['Hộp thư đến', 'Đã gửi', 'Lưu trữ', 'Thư rác', 'Thùng rác']).concat(s.labels || []).map(f => `<button class="eco-chip ${folder === f ? 'is-active' : ''}" data-act="mbFolder" data-v="${attr(f)}">${esc(f)}</button>`).join('')}</div>`;
    html += `<div class="row nowrap"><input class="eco-input sm" id="mbQ" placeholder="Tìm trong thư (như ô tìm kiếm Gmail)" value="${attr(M.q || '')}"><button class="eco-btn" data-act="mbSearch">${ic('search', 'sm')}</button></div>`;
    const list = s.list ? (s.list.length ? `<div class="eco-list">${s.list.map(t => `<a href="#/hop-thu/${t.id}" style="${t.id === threadId ? 'background:var(--hover)' : ''}"><span style="width:8px;height:8px;border-radius:50%;flex:none;background:${t.chuaDoc ? 'var(--accent)' : 'transparent'}"></span><div class="li-main"><div class="row nowrap spread"><b class="ellipsis">${esc(t.tu.replace(/<.*>/, '').trim() || t.tu)}</b><span class="small muted" style="white-space:nowrap">${esc(t.luc.slice(0, 5))}</span></div><div class="ellipsis">${esc(t.tieuDe)}${t.soThu > 1 ? ' <span class="muted">(' + t.soThu + ')</span>' : ''}</div><div class="sub ellipsis">${esc(t.doan)}</div></div></a>`).join('')}</div>${s.more ? '<button class="eco-btn" data-act="mbMore">Tải thêm thư cũ</button>' : ''}` : empty('Không có thư.')) : loading();
    const read = threadId ? (M.thread && M.thread.id === threadId ? threadView(M.thread) : loading('Đang mở thư…')) : '<p class="muted">Chọn một thư để đọc.</p>';
    html += `<div class="split ${threadId ? 'reading' : 'listing'}"><section class="eco-card list-pane" style="padding:4px 16px">${list}</section><section class="eco-card read-pane">${threadId ? '<a class="small ph" href="#/hop-thu">‹ Danh sách thư</a>' : ''}${read}</section></div>`;
    return html;
  },
  after(threadId) {
    if (!M.box) loadBox();
    if (threadId && (!M.thread || M.thread.id !== threadId)) api('mailThread', { id: threadId }).then(t => { M.thread = t; render(); }).catch(e => toast(e.message, true));
  }
});
function loadBox(more) {
  const start = more ? (M.box.list || []).length : 0;
  return api('mailList', { folder: M.folder || 'Hộp thư đến', q: M.q || '', start }).then(r => {
    if (more) r.list = M.box.list.concat(r.list);
    M.box = r; render();
  }).catch(e => toast(e.message, true));
}
H.mbFolder = el => { M.folder = el.dataset.v; M.box = Object.assign({}, M.box, { list: null }); loadBox(); render(); };
H.mbSearch = () => { M.q = document.getElementById('mbQ').value; M.box = Object.assign({}, M.box, { list: null }); loadBox(); render(); };
H.mbMore = () => loadBox(true);
function threadView(t) {
  const acts = [['traLoi', 'Trả lời'], ['traLoiTatCa', 'Trả lời tất cả'], ['chuyenTiep', 'Chuyển tiếp']];
  const ops = [t.inInbox ? ['luuTru', 'Lưu trữ'] : ['veHopThu', 'Về hộp thư đến'], ['thuRac', 'Thư rác'], ['xoa', 'Xóa'], ['ganNhan', 'Gắn nhãn']].concat(t.nhan.length ? [['boNhan', 'Bỏ nhãn']] : []);
  return `<div class="stack tight"><h2>${esc(t.tieuDe)}</h2><div class="row">${t.nhan.map(n => tag(n)).join('')}</div>
    <div class="row">${acts.map(([k, l]) => `<a class="eco-btn eco-btn--sm" href="#/soan-thu/${k}/${t.id}">${l}</a>`).join('')}${ops.map(([k, l]) => `<button class="eco-btn eco-btn--sm" data-act="mbOp" data-op="${k}">${l}</button>`).join('')}</div>
    <p class="small muted">Mọi thao tác làm thay đổi hộp thư đều thành yêu cầu chờ BOD duyệt.</p></div>
    ${t.thu.map((m, i) => `<details ${i === t.thu.length - 1 ? 'open' : ''} class="stack tight" style="border-top:1px solid var(--border);padding-top:8px"><summary><b>${esc(m.tu)}</b> <span class="small muted">· ${esc(m.luc)}</span></summary><div class="small muted">Tới: ${esc(m.den)}${m.cc ? ' · Cc: ' + esc(m.cc) : ''}</div>${frameHtml(m.html)}${m.tep.length ? `<div class="row">${m.tep.map((f, j) => `<button class="eco-btn eco-btn--sm" data-act="mbFile" data-m="${m.id}" data-i="${j}">${ic('paperclip', 'sm')} ${esc(f.ten)} · ${f.kb} KB</button>`).join('')}</div>` : ''}</details>`).join('')}`;
}
H.mbFile = async el => {
  const r = await call('mailAttachment', { threadId: M.thread.id, msgId: el.dataset.m, idx: el.dataset.i });
  const a = document.createElement('a'); a.href = 'data:' + r.loai + ';base64,' + r.base64; a.download = r.ten; a.click();
};
H.mbOp = el => {
  const op = el.dataset.op, t = M.thread;
  const labelInput = op === 'ganNhan' || op === 'boNhan';
  modal(ACT_NAME[op], `<p>Gửi yêu cầu "<b>${ACT_NAME[op]}</b>" cho thư "${esc(t.tieuDe)}" để BOD duyệt.</p>${labelInput ? `<div class="eco-field"><label>Nhãn</label><input class="eco-input" id="opLabel" list="opLabels" value="${op === 'boNhan' ? attr(t.nhan[0] || '') : ''}"><datalist id="opLabels">${(op === 'boNhan' ? t.nhan : (M.box.labels || [])).map(l => `<option value="${attr(l)}">`).join('')}</datalist></div>` : ''}<div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="opGo">Gửi BOD duyệt</button></div>`);
  document.getElementById('opGo').onclick = async () => {
    const lb = document.getElementById('opLabel');
    try { await call('mailSave', { submit: true, req: { thaoTac: op, maThu: t.id, nhan: lb ? lb.value : '' } }); closeModal(); toast('Đã gửi yêu cầu, chờ BOD duyệt.'); M.mine = null; } catch (e) { }
  };
};

/* ================= P-21 Soạn thư (UCV) ================= */
route('soan-thu', {
  can: () => R().ucv, nav: 'soan-thu', keep: true, wide: true,
  render(mode, ref) {
    const key = (mode || 'soan') + '/' + (ref || '');
    if (!M.draft || M.draft.key !== key) M.draft = { key, req: null };
    const d = M.draft;
    let html = topbar(mode === 'sua' ? 'Sửa thư' : mode && ACT_NAME[mode] ? ACT_NAME[mode] : 'Soạn thư', { back: mode === 'sua' ? '#/thu-cua-toi' : ref ? '#/hop-thu/' + ref : '#/hop-thu', right: `<span class="small muted" id="cpSaved">${d.savedAt ? 'Đã lưu nháp ' + d.savedAt : ''}</span>` });
    if (!M.cfg || !d.req) return html + loading();
    const r = d.req;
    const isReply = r.thaoTac === 'traLoi' || r.thaoTac === 'traLoiTatCa';
    html += `<section class="eco-card form">
      ${r.maThu ? `<p class="small muted">${esc(ACT_NAME[r.thaoTac])} thư: <b>${esc(d.subjOrig || '')}</b></p>` : ''}
      ${['den', 'cc', 'bcc'].map(k => `<div class="eco-field"><div class="row spread"><label for="cp_${k}">${{ den: 'Đến', cc: 'Cc', bcc: 'Bcc' }[k]}${isReply && k === 'den' ? ' <span class="muted small">(để trống = trả lời đúng người gửi)</span>' : ''}</label><div class="row"><button class="linkbtn small" data-act="cpContacts" data-k="${k}">Danh bạ</button><button class="linkbtn small" data-act="cpSheet" data-k="${k}">Link sheet</button></div></div><input class="eco-input" id="cp_${k}" value="${attr(r[k] || '')}" placeholder="Gõ email, cách nhau dấu phẩy" data-input="cpDirty"></div>`).join('')}
      <div class="eco-field"><label for="cp_tieuDe">Tiêu đề</label><input class="eco-input" id="cp_tieuDe" value="${attr(r.tieuDe || '')}" data-input="cpDirty"></div>
      <div class="toolbar">${[['bold', '<b>B</b>'], ['italic', '<i>I</i>'], ['underline', '<u>U</u>'], ['insertUnorderedList', '• Danh sách'], ['insertOrderedList', '1. Danh sách']].map(([c, l]) => `<button type="button" class="eco-btn eco-btn--sm" data-act="cpCmd" data-c="${c}">${l}</button>`).join('')}<button type="button" class="eco-btn eco-btn--sm" data-act="cpLink">Liên kết</button><label class="eco-btn eco-btn--sm">Ảnh<input type="file" accept="image/*" class="hide" data-change="cpImg"></label></div>
      <div class="editor" id="cpBody" contenteditable="true" data-input="cpDirty">${r.noiDung || ''}</div>
      ${M.cfg.signature ? `<div class="small muted">Chữ ký CLB tự gắn cuối thư (không sửa ở đây).</div>` : ''}
      ${isReply ? `<label class="opt"><input type="checkbox" class="chk" id="cpQuote" ${r.trichDan !== false ? 'checked' : ''}> Kèm trích dẫn thư gốc</label>` : ''}
      <div class="eco-field"><span class="lbl">Tệp đính kèm <span class="muted small">(mỗi tệp ≤ ${M.cfg.maxFileMb} MB, tổng ≤ ${M.cfg.maxTotalMb} MB)</span></span>
        <div class="row">${(r.dinhKem || []).map(f => `<span class="eco-tag">${esc(f.ten)} <button class="linkbtn" data-act="cpRmOld" data-id="${f.id}">✕</button></span>`).join('')}${(d.newFiles || []).map((f, i) => `<span class="eco-tag">${esc(f.ten)} <button class="linkbtn" data-act="cpRmNew" data-i="${i}">✕</button></span>`).join('')}${(d.driveIds || []).map((f, i) => `<span class="eco-tag">Drive: ${esc(f.slice(0, 12))}… <button class="linkbtn" data-act="cpRmDrive" data-i="${i}">✕</button></span>`).join('')}</div>
        <div class="row"><label class="eco-btn eco-btn--sm">${ic('paperclip', 'sm')} Từ máy<input type="file" multiple class="hide" data-change="cpFiles"></label><button class="eco-btn eco-btn--sm" data-act="cpDrive">Từ Google Drive</button></div></div>
    </section>`;
    html += `<div class="stickybar"><span class="grow small muted">Thư gửi đi đứng tên CLB; tên bạn chỉ lưu nội bộ để BOD tra lại.</span><button class="eco-btn" data-act="cpSave">Lưu nháp</button><button class="eco-btn" data-act="cpPreview">Xem trước</button><button class="eco-btn eco-btn--filled" data-act="cpSubmit">Gửi BOD duyệt</button></div>`;
    return html;
  },
  after(mode, ref) {
    const d = M.draft;
    if (!M.cfg) api('mailComposeConfig').then(c => { M.cfg = c; render(); }).catch(e => toast(e.message, true));
    if (!d.req) {
      if (mode === 'sua') {
        (M.mine ? Promise.resolve(M.mine) : api('mailMine')).then(list => { M.mine = list; const v = list.find(x => x.id === ref); if (!v) return toast('Không tìm thấy thư.', true); d.req = Object.assign({}, v, { trichDan: v.tuyChon.trichDan }); d.subjOrig = v.tieuDeThu; render(); });
      } else if (ref) {
        (M.thread && M.thread.id === ref ? Promise.resolve(M.thread) : api('mailThread', { id: ref })).then(t => {
          const last = t.thu[t.thu.length - 1];
          d.subjOrig = t.tieuDe;
          d.req = { thaoTac: mode, maThu: ref, den: mode === 'chuyenTiep' ? '' : '', tieuDe: mode === 'chuyenTiep' ? 'Fwd: ' + t.tieuDe : '', noiDung: '', dinhKem: [], trichDan: true };
          render();
        }).catch(e => toast(e.message, true));
      } else { d.req = { thaoTac: 'soan', noiDung: '', dinhKem: [] }; }
    }
    if (d.req && !d.timer) d.timer = setInterval(() => { if (d.dirty && location.hash.startsWith('#/soan-thu')) cpSave(false, true); if (!location.hash.startsWith('#/soan-thu')) { clearInterval(d.timer); d.timer = null; } }, 30000);
  }
});
function cpCollect() {
  const d = M.draft, r = d.req;
  ['den', 'cc', 'bcc', 'tieuDe'].forEach(k => { const el = document.getElementById('cp_' + k); if (el) r[k] = el.value; });
  const b = document.getElementById('cpBody'); if (b) r.noiDung = b.innerHTML;
  const q = document.getElementById('cpQuote'); if (q) r.trichDan = q.checked;
  return r;
}
H.cpDirty = () => { M.draft.dirty = true; };
H.cpCmd = el => { document.execCommand(el.dataset.c, false, null); document.getElementById('cpBody').focus(); };
H.cpLink = () => { const u = prompt('Dán liên kết (https://…)'); if (u) document.execCommand('createLink', false, u); };
H.cpImg = async el => { const f = el.files[0]; if (!f) return; const url = await shrinkTo(f, 600); document.getElementById('cpBody').focus(); document.execCommand('insertImage', false, url); M.draft.dirty = true; };
function shrinkTo(file, max) {
  return new Promise(ok => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / img.width); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.75)); }; img.src = URL.createObjectURL(file); });
}
H.cpFiles = async el => {
  const d = M.draft; cpCollect();
  d.newFiles = d.newFiles || [];
  for (const f of el.files) {
    if (f.size > M.cfg.maxFileMb * 1048576) { toast('Tệp "' + f.name + '" lớn hơn ' + M.cfg.maxFileMb + ' MB.', true); continue; }
    const b64 = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.readAsDataURL(f); });
    d.newFiles.push({ ten: f.name, loai: f.type || 'application/octet-stream', base64: b64 });
  }
  d.dirty = true; render();
};
H.cpRmOld = el => { cpCollect(); M.draft.req.dinhKem = M.draft.req.dinhKem.filter(f => f.id !== el.dataset.id); M.draft.dirty = true; render(); };
H.cpRmNew = el => { cpCollect(); M.draft.newFiles.splice(+el.dataset.i, 1); render(); };
H.cpRmDrive = el => { cpCollect(); M.draft.driveIds.splice(+el.dataset.i, 1); render(); };
H.cpDrive = () => {
  const u = prompt('Dán link tệp Google Drive (tệp phải chia sẻ cho Gmail CLB)');
  if (!u) return;
  const m = u.match(/[-\w]{25,}/);
  if (!m) return toast('Link chưa đúng.', true);
  cpCollect(); M.draft.driveIds = (M.draft.driveIds || []).concat([m[0]]); M.draft.dirty = true; render();
};
H.cpContacts = el => {
  cpCollect();
  const k = el.dataset.k, cs = M.cfg.contacts;
  const groups = [...new Set(cs.map(c => c.nhom))];
  modal('Chọn từ danh bạ', `<input class="eco-input sm" placeholder="Tìm tên hoặc email" data-input="pkSearch" data-pk="cpPick"><div id="cpPick" class="stack tight" style="max-height:420px;overflow-y:auto">${groups.map(g => `<details><summary><b>${esc(g)}</b> <span class="muted">(${cs.filter(c => c.nhom === g).length})</span> <button class="linkbtn small" data-act="cpGroupAll" data-g="${attr(g)}">chọn cả nhóm</button></summary>${cs.filter(c => c.nhom === g).map(c => `<label class="opt" data-name="${attr(bodau(c.ten + ' ' + c.email))}" data-g="${attr(g)}"><input type="checkbox" class="chk" value="${attr(c.email)}"> ${esc(c.ten)} <span class="small muted">${esc(c.email)}</span></label>`).join('')}</details>`).join('')}</div>
    <div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="cpPickOk">Thêm</button></div>`, { wide: true });
  document.getElementById('cpPickOk').onclick = () => { const v = [...document.querySelectorAll('#cpPick input:checked')].map(i => i.value); addRecipients(k, v); closeModal(); };
};
H.cpGroupAll = el => { document.querySelectorAll(`#cpPick label[data-g="${CSS.escape(el.dataset.g)}"] input`).forEach(i => i.checked = true); };
function addRecipients(k, list) {
  const r = M.draft.req;
  const cur = String(r[k] || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
  list.forEach(e => { if (!cur.includes(e)) cur.push(e); });
  r[k] = cur.join(', '); M.draft.dirty = true; render();
}
H.cpSheet = el => {
  cpCollect();
  const k = el.dataset.k;
  modal('Thêm người nhận từ Google Sheet', `<p class="small muted">Sheet phải chia sẻ cho Gmail CLB. App lấy mọi địa chỉ email trong tab đã chọn.</p><div class="row nowrap"><input class="eco-input sm" id="shUrl" placeholder="Dán link Google Sheet"><button class="eco-btn" id="shRead">Đọc</button></div><div id="shOut"></div>`);
  const read = async tab => {
    const r = await call('mailSheetEmails', { url: document.getElementById('shUrl').value, tab });
    document.getElementById('shOut').innerHTML = `<div class="row">${r.tabs.map(t => `<button class="eco-chip ${t === r.tab ? 'is-active' : ''}" data-tab="${attr(t)}">${esc(t)}</button>`).join('')}</div><p>${r.emails.length} email trong "${esc(r.name)}" · ${esc(r.tab)}</p><div class="actions"><button class="eco-btn eco-btn--filled" id="shOk">Thêm ${r.emails.length} email</button></div>`;
    document.querySelectorAll('#shOut [data-tab]').forEach(b => b.onclick = () => read(b.dataset.tab));
    document.getElementById('shOk').onclick = () => { addRecipients(k, r.emails); closeModal(); };
  };
  document.getElementById('shRead').onclick = () => read('');
};
async function cpSave(submit, silent) {
  const d = M.draft, r = cpCollect();
  const res = await (silent ? api : call)('mailSave', { submit, req: Object.assign({}, r, { tepGiu: (r.dinhKem || []).map(f => f.id), tepMoi: d.newFiles || [], tepDrive: d.driveIds || [] }) });
  r.id = res.id; r.dinhKem = res.dinhKem; d.newFiles = []; d.driveIds = []; d.dirty = false;
  d.savedAt = new Date().toTimeString().slice(0, 5);
  const el = document.getElementById('cpSaved'); if (el) el.textContent = 'Đã lưu nháp ' + d.savedAt;
  M.mine = null;
  return res;
}
H.cpSave = async () => { try { await cpSave(false); toast('Đã lưu nháp.'); render(); } catch (e) { } };
H.cpSubmit = async () => { try { await cpSave(true); toast('Đã gửi BOD duyệt.'); M.draft = null; go('#/thu-cua-toi'); } catch (e) { } };
H.cpPreview = () => {
  const r = cpCollect();
  modal('Xem trước', `<div class="kv small"><span>Từ</span><span>CLB Môi trường ECO (Gmail CLB)</span><span>Đến</span><span>${esc(r.den || '(người gửi thư gốc)')}</span>${r.cc ? `<span>Cc</span><span>${esc(r.cc)}</span>` : ''}<span>Tiêu đề</span><b>${esc(r.tieuDe || (M.draft.subjOrig ? 'Re: ' + M.draft.subjOrig : ''))}</b></div>${frameHtml('<div>' + r.noiDung + '</div>' + (M.cfg.signature ? '<br><div>--</div>' + M.cfg.signature : ''))}`, { wide: true });
};

/* ================= P-22 Thư của tôi (UCV) ================= */
route('thu-cua-toi', {
  can: () => R().ucv,
  render() {
    let html = topbar('Thư của tôi', { right: `<a class="eco-btn eco-btn--sm" href="#/soan-thu">${ic('plus', 'sm')} Soạn thư</a>` });
    html += `<ol class="eco-stepper"><li>Nháp</li><li>Chờ duyệt</li><li>Đã duyệt</li></ol><p class="small muted">Hoặc Cần sửa lại / Từ chối / Lỗi kèm ghi chú của BOD.</p>`;
    if (!M.mine) return html + loading();
    html += M.mine.length ? M.mine.map(v => `<section class="eco-card"><div class="head"><b>${esc(v.tieuDe || v.tieuDeThu || '(không tiêu đề)')}</b>${mstTag(v.trangThai)}</div><span class="small muted">${esc(v.thaoTacTen)} · ${esc(fDT(v.luc))}${v.den ? ' · tới ' + esc(v.den) : ''}</span>
      ${v.ghiChu ? banner('<b>Ghi chú của BOD:</b> ' + esc(v.ghiChu), v.trangThai === 'loi' ? 'error' : '') : ''}
      ${v.nguoiDuyet ? `<span class="small muted">${v.trangThai === 'duyet' ? 'Duyệt' : 'Xử lý'} bởi ${esc(v.nguoiDuyet)} · ${esc(fDT(v.lucDuyet))}${v.bodSua ? ' · BOD đã sửa trực tiếp rồi duyệt' : ''}</span>` : ''}
      <div class="row">${['nhap', 'sua'].includes(v.trangThai) && ['soan', 'traLoi', 'traLoiTatCa', 'chuyenTiep'].includes(v.thaoTac) ? `<a class="eco-btn eco-btn--sm" href="#/soan-thu/sua/${v.id}">Sửa thư</a>` : ''}${['nhap', 'sua', 'tuChoi'].includes(v.trangThai) ? `<button class="eco-btn eco-btn--sm" data-act="myDel" data-id="${v.id}">Xóa</button>` : ''}</div></section>`).join('') : empty('Chưa có thư nào.');
    return html;
  },
  after() { if (!M.mine) api('mailMine').then(l => { M.mine = l; render(); }).catch(e => toast(e.message, true)); }
});
H.myDel = el => confirmBox('Xóa thư này?', 'Không khôi phục được.', 'Xóa', async () => { await call('mailDelete', { id: el.dataset.id }); M.mine = null; render(); });

/* ================= P-48 Duyệt thư UCV (BOD) ================= */
route('duyet-thu', {
  can: () => isBod(), wide: true,
  render() {
    let html = topbar('Duyệt thư UCV');
    html += `<p class="small muted">Một BOD duyệt là gửi. Thư đứng tên CLB.${M.quota != null ? ' Hạn mức gửi còn lại hôm nay: <b>' + M.quota + '</b>.' : ''}</p>`;
    if (!M.review) return html + loading();
    const pend = M.review.filter(v => v.trangThai === 'cho'), done = M.review.filter(v => v.trangThai !== 'cho');
    const card = v => `<section class="eco-card"><div class="head"><div><b>${esc(v.tieuDe || v.tieuDeThu || '(không tiêu đề)')}</b><div class="small muted">${esc(v.thaoTacTen)} · ${esc(v.nguoiTao)} · ${esc(fDT(v.luc))}</div></div>${mstTag(v.trangThai)}</div>
      ${v.den || v.cc || v.bcc ? `<div class="kv small"><span>Đến</span><span>${esc(v.den || '(người gửi thư gốc)')}</span>${v.cc ? `<span>Cc</span><span>${esc(v.cc)}</span>` : ''}${v.bcc ? `<span>Bcc</span><span>${esc(v.bcc)}</span>` : ''}</div>` : ''}
      ${v.nhan ? `<p class="small">Nhãn: <b>${esc(v.nhan)}</b></p>` : ''}
      ${v.noiDung ? (v.trangThai === 'cho' || M.open === v.id ? frameHtml(v.noiDung) : `<button class="linkbtn small" data-act="set" data-k="mrOpen" data-v="${v.id}">Xem nội dung</button>`) : ''}
      ${v.dinhKem.length ? `<div class="row">${v.dinhKem.map(f => `<a class="eco-tag" href="https://drive.google.com/file/d/${attr(f.id)}/view" target="_blank" rel="noopener">${ic('paperclip', 'sm')} ${esc(f.ten)}</a>`).join('')}</div>` : ''}
      ${v.gmail ? `<a class="small" href="${attr(v.gmail)}" target="_blank" rel="noopener">Mở luồng thư gốc trong Gmail ${ic('ext', 'sm')}</a>` : ''}
      ${v.ghiChu ? `<p class="small">Ghi chú: ${esc(v.ghiChu)}</p>` : ''}${v.nguoiDuyet ? `<p class="small muted">${esc(v.nguoiDuyet)} · ${esc(fDT(v.lucDuyet))}${v.bodSua ? ' · đã sửa trực tiếp' : ''}</p>` : ''}
      ${v.trangThai === 'cho' ? `<div class="row"><button class="eco-btn" data-act="mrNote" data-id="${v.id}" data-d="tuChoi">Từ chối</button><button class="eco-btn" data-act="mrNote" data-id="${v.id}" data-d="sua">Cần sửa lại</button>${['soan', 'traLoi', 'traLoiTatCa', 'chuyenTiep'].includes(v.thaoTac) ? `<button class="eco-btn" data-act="mrEdit" data-id="${v.id}">Sửa trực tiếp</button>` : ''}<button class="eco-btn eco-btn--filled" data-act="mrOk" data-id="${v.id}">Duyệt</button></div>` : ''}</section>`;
    M.open = App.ui.mrOpen;
    html += `<h2>Chờ duyệt (${pend.length})</h2>` + (pend.length ? pend.map(card).join('') : empty('Không có thư chờ duyệt.'));
    html += `<h2>Đã xử lý</h2>` + (done.length ? done.slice(0, 60).map(card).join('') : empty('Chưa có.'));
    return html;
  },
  after() {
    if (!M.review) Promise.all([api('mailReview'), api('mailQuota')]).then(([r, q]) => { M.review = r; M.quota = q.conLai; render(); }).catch(e => toast(e.message, true));
  }
});
async function decide(args) {
  try { M.review = await call('mailDecide', args); toast(args.decision === 'duyet' ? 'Đã duyệt và thực hiện trên Gmail.' : 'Đã gửi quyết định.'); }
  catch (e) { M.review = await api('mailReview').catch(() => M.review); }
  const s = await api('state').catch(() => null); if (s) setState(s);
  render();
}
H.mrOk = el => confirmBox('Duyệt yêu cầu?', 'App thực hiện ngay trên Gmail CLB.', 'Duyệt', () => decide({ id: el.dataset.id, decision: 'duyet' }));
H.mrNote = el => {
  const d = el.dataset.d;
  modal(d === 'sua' ? 'Cần sửa lại' : 'Từ chối', `<div class="eco-field"><label>Ghi chú cho UCV</label><textarea class="eco-input" id="mrN" autofocus></textarea></div><div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="mrGo">Gửi</button></div>`);
  document.getElementById('mrGo').onclick = () => { const n = document.getElementById('mrN').value; closeModal(); decide({ id: el.dataset.id, decision: d, note: n }); };
};
H.mrEdit = el => {
  const v = M.review.find(x => x.id === el.dataset.id);
  modal('Sửa trực tiếp rồi duyệt', `<div class="form">${['den', 'cc', 'bcc'].map(k => `<div class="eco-field"><label>${{ den: 'Đến', cc: 'Cc', bcc: 'Bcc' }[k]}</label><input class="eco-input" id="me_${k}" value="${attr(v[k] || '')}"></div>`).join('')}<div class="eco-field"><label>Tiêu đề</label><input class="eco-input" id="me_tieuDe" value="${attr(v.tieuDe || '')}"></div><div class="editor" id="me_body" contenteditable="true">${v.noiDung}</div><p class="small muted">Lần sửa được ghi nhật ký; UCV thấy thư đã được BOD sửa.</p></div><div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="meGo">Lưu và duyệt gửi</button></div>`, { wide: true });
  document.getElementById('meGo').onclick = () => {
    const edit = { den: document.getElementById('me_den').value, cc: document.getElementById('me_cc').value, bcc: document.getElementById('me_bcc').value, tieuDe: document.getElementById('me_tieuDe').value, noiDung: document.getElementById('me_body').innerHTML };
    closeModal(); decide({ id: v.id, decision: 'duyet', edit });
  };
};

/* ================= P-49 Gửi thư tùy biến (BOD) ================= */
route('gui-thu', {
  can: () => isBod(), wide: true, keep: true,
  render() {
    const g = M.send = M.send || { src: 'danhba', sel: new Set(), rows: [] };
    let html = topbar('Gửi thư tùy biến');
    if (!M.drafts || !M.sources) return html + loading();
    const d = g.draftId ? M.drafts.list.find(x => x.id === g.draftId) : null;
    const rec = sendRecipients();
    const step = !d ? 1 : !rec.length ? 2 : 3;
    html += `<ol class="eco-stepper"><li class="${step > 1 ? 'is-done' : 'is-current'}">Chọn thư nháp</li><li class="${step > 2 ? 'is-done' : step === 2 ? 'is-current' : ''}">Người nhận</li><li class="${step === 3 ? 'is-current' : ''}">Kiểm tra và xem trước</li><li>Gửi</li></ol>`;
    html += `<section class="eco-card"><div class="head"><h2>1. Thư nháp trong Gmail CLB</h2><div class="row"><a class="eco-btn eco-btn--sm" href="${attr(M.drafts.linkNew)}" target="_blank" rel="noopener">Soạn nháp mới ${ic('ext', 'sm')}</a><button class="eco-btn eco-btn--sm" data-act="gtReload">${ic('refresh', 'sm')}</button></div></div><p class="small muted">Soạn thư nháp ngay trong Gmail CLB, dùng chỗ điền như {Họ và tên}. Ảnh và tệp của thư nháp được gửi kèm. Chữ ký: tự thêm vào thư nháp trong Gmail nếu muốn.</p>
      ${d && !g.pickDraft ? `<div class="row spread"><div class="li-main"><b>${esc(d.tieuDe || '(không tiêu đề)')}</b><span class="sub">${esc(d.doan)}</span></div><button class="eco-btn eco-btn--sm" data-act="toggle2" data-k="pickDraft">Đổi thư</button></div><div class="small">Chỗ điền: ${d.choTrong.length ? d.choTrong.map(x => '<code>{' + esc(x) + '}</code>').join(' ') : 'không có (thư chung)'}${d.tep.length ? ' · Tệp: ' + d.tep.map(esc).join(', ') : ''}</div>`
        : M.drafts.list.length ? `<div class="eco-list" style="max-height:360px;overflow-y:auto">${M.drafts.list.map(x => `<button data-act="gtDraft" data-id="${x.id}"><div class="li-main"><b>${esc(x.tieuDe || '(không tiêu đề)')}</b><span class="sub">${esc(x.luc)} · ${esc(x.doan)}</span><span class="sub">${x.choTrong.length ? 'Chỗ điền: ' + x.choTrong.map(c => '{' + esc(c) + '}').join(' ') : ''}${x.tep.length ? ' · ' + x.tep.length + ' tệp' : ''}</span></div><a class="iconbtn" href="${attr(x.link)}" target="_blank" rel="noopener" aria-label="Mở trong Gmail">${ic('ext', 'sm')}</a></button>`).join('')}</div>` : empty('Gmail CLB chưa có thư nháp nào.')}</section>`;
    if (d) {
      html += `<section class="eco-card"><h2>2. Người nhận</h2><div class="seg">${[['danhba', 'Danh bạ'], ['sheet', 'Link Google Sheet'], ['tay', 'Nhập tay']].map(([v, l]) => `<button class="${g.src === v ? 'is-active' : ''}" data-act="gtSrc" data-v="${v}">${l}</button>`).join('')}</div>${srcHtml(g, d)}</section>`;
      if (rec.length) html += checkHtml(d, rec);
    }
    return html;
  },
  after() {
    if (!M.drafts) api('mailDrafts').then(r => { M.drafts = r; render(); }).catch(e => toast(e.message, true));
    if (!M.sources) api('mailSources').then(r => { M.sources = r; render(); }).catch(e => toast(e.message, true));
  }
});
H.toggle2 = el => { M.send[el.dataset.k] = !M.send[el.dataset.k]; render(); };
H.gtReload = () => { M.drafts = null; render(); };
H.gtDraft = (el, e) => { if (e.target.closest('a')) return; M.send.draftId = el.dataset.id; M.send.pickDraft = false; render(); };
H.gtSrc = el => { M.send.src = el.dataset.v; M.send.sel = new Set(); render(); };
function contactRows() {
  const S = M.sources;
  const mem = S.members.map(m => ({ key: 'm:' + m['Email'], group: 'Thành viên CLB', name: m['Họ và tên'], email: m['Email'], data: m, sub: m['Ban'] }));
  const cs = S.contacts.map(c => ({ key: 'c:' + c.id, group: c.nhom, name: c.ten, email: c.email, data: Object.assign({ 'Tên': c.ten, 'Email': c.email, 'Nhóm': c.nhom }, c.truong), sub: c.nhom }));
  return mem.concat(cs);
}
function sendRecipients() {
  const g = M.send;
  if (!g) return [];
  if (g.src === 'tay') return String(g.manual || '').split(/[\s,;]+/).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).map(e => ({ email: e, data: {} }));
  if (g.src === 'sheet') { const col = g.emailCol; return (g.rows || []).filter((r, i) => g.sel.has(String(i)) && r[col]).map(r => ({ email: String(r[col]).trim(), data: r })); }
  if (!M.sources) return [];
  return contactRows().filter(r => g.sel.has(r.key)).map(r => ({ email: r.email, data: r.data }));
}
function srcHtml(g, d) {
  if (g.src === 'tay') return `<textarea class="eco-input" placeholder="Mỗi dòng một email, hoặc cách nhau dấu phẩy" data-input="gtManual">${esc(g.manual || '')}</textarea><p class="small muted">Nhập tay chỉ gửi được thư chung: thư có chỗ điền như {Tên} sẽ bị chặn.</p>`;
  if (g.src === 'sheet') {
    return `<div class="row nowrap"><input class="eco-input sm" id="gtUrl" placeholder="Dán link Google Sheet (chia sẻ cho Gmail CLB)" value="${attr(g.url || '')}"><button class="eco-btn" data-act="gtSheet">Đọc</button></div>
      ${g.tabs ? `<div class="row">${g.tabs.map(t => `<button class="eco-chip ${t === g.tab ? 'is-active' : ''}" data-act="gtTab" data-v="${attr(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
      ${g.rows && g.rows.length ? `<div class="row"><span class="small">Cột email:</span><select class="eco-input sm" style="width:auto" data-change="gtEmailCol">${g.head.map(h => `<option ${h === g.emailCol ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select><button class="eco-btn eco-btn--sm" data-act="gtAll">Chọn hết</button><button class="eco-btn eco-btn--sm" data-act="gtNone">Bỏ chọn</button><span class="small muted">${g.rows.length} dòng (tối đa 2000)</span></div>
        <div class="tablewrap" style="max-height:360px;overflow-y:auto"><table class="eco-table"><thead><tr><th></th>${g.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${g.rows.map((r, i) => `<tr><td><input type="checkbox" class="chk" data-change="gtRow" data-i="${i}" ${g.sel.has(String(i)) ? 'checked' : ''}></td>${g.head.map(h => `<td class="small">${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}`;
  }
  const rows = contactRows();
  const groups = [...new Set(rows.map(r => r.group))];
  return `<p class="small muted">Chỗ điền theo đúng tên cột, ví dụ ${M.sources.memberCols.slice(0, 3).map(c => '{' + esc(c) + '}').join(', ')}. Danh bạ: {Tên}, {Email}, {Nhóm} và các trường tự thêm.</p>
    <input class="eco-input sm" placeholder="Tìm tên, email" data-input="pkSearch" data-pk="gtPick">
    <div id="gtPick" class="stack tight" style="max-height:420px;overflow-y:auto">${groups.map(gr => `<details ${groups.length < 3 ? 'open' : ''}><summary><b>${esc(gr)}</b> <span class="muted">(${rows.filter(r => r.group === gr).length})</span> <button class="linkbtn small" data-act="gtGroup" data-g="${attr(gr)}">chọn cả nhóm</button></summary>${rows.filter(r => r.group === gr).map(r => `<label class="opt" data-name="${attr(bodau(r.name + ' ' + r.email))}"><input type="checkbox" class="chk" data-change="gtPickOne" data-key="${attr(r.key)}" ${g.sel.has(r.key) ? 'checked' : ''}> ${esc(r.name)} <span class="small muted">${esc(r.email)} · ${esc(r.sub || '')}</span></label>`).join('')}</details>`).join('')}</div>`;
}
H.gtManual = el => { M.send.manual = el.value; clearTimeout(M.send.t); M.send.t = setTimeout(render, 600); };
H.gtPickOne = el => { const s = M.send.sel; el.checked ? s.add(el.dataset.key) : s.delete(el.dataset.key); render(); };
H.gtGroup = el => { contactRows().filter(r => r.group === el.dataset.g).forEach(r => M.send.sel.add(r.key)); render(); };
H.gtRow = el => { const s = M.send.sel; el.checked ? s.add(el.dataset.i) : s.delete(el.dataset.i); render(); };
H.gtAll = () => { M.send.rows.forEach((r, i) => M.send.sel.add(String(i))); render(); };
H.gtNone = () => { M.send.sel = new Set(); render(); };
H.gtEmailCol = el => { M.send.emailCol = el.value; render(); };
async function gtRead(tab) {
  const g = M.send;
  const r = await call('mailSheetRows', { url: g.url, tab });
  g.rows = r.rows.slice(0, 2000); g.head = r.head; g.tabs = r.tabs; g.tab = r.tab; g.sel = new Set();
  g.emailCol = r.head.find(h => /e-?mail/i.test(bodau(h))) || r.head[0];
  render();
}
H.gtSheet = () => { M.send.url = document.getElementById('gtUrl').value.trim(); gtRead(''); };
H.gtTab = el => gtRead(el.dataset.v);
function fillText(s, data) { return String(s || '').replace(/\{([^{}\n]{1,60})\}/g, (a, k) => (k.trim() in data) ? data[k.trim()] : a); }
function checkHtml(d, rec) {
  const g = M.send;
  const keys = d.choTrong;
  const missing = keys.filter(k => rec.some(r => !(k in r.data)));
  const emptyWarn = keys.filter(k => !missing.includes(k)).map(k => [k, rec.filter(r => !String(r.data[k] || '').trim())]).filter(x => x[1].length);
  const idx = Math.min(g.pv || 0, rec.length - 1);
  const cur = rec[idx];
  let h = `<section class="eco-card"><h2>3. Kiểm tra trường và xem trước</h2>`;
  if (missing.length) h += banner(`Thư dùng trường không có trong nguồn người nhận: ${missing.map(k => '<b>{' + esc(k) + '}</b>').join(', ')}. Sửa thư nháp trong Gmail hoặc đổi nguồn người nhận. <b>Chưa gửi được.</b>`, 'error');
  emptyWarn.forEach(([k, arr]) => { h += banner(`${arr.length} người bị trống ô <b>{${esc(k)}}</b>: ${arr.slice(0, 8).map(r => esc(r.email)).join(', ')}${arr.length > 8 ? '…' : ''}. Vẫn gửi được.`); });
  if (!missing.length) h += `<div class="row"><button class="eco-btn eco-btn--sm" data-act="gtPv" data-v="${idx - 1}" ${idx <= 0 ? 'disabled' : ''}>‹</button><span class="small">Thư ${idx + 1}/${rec.length} · tới <b>${esc(cur.email)}</b></span><button class="eco-btn eco-btn--sm" data-act="gtPv" data-v="${idx + 1}" ${idx >= rec.length - 1 ? 'disabled' : ''}>›</button><button class="eco-btn eco-btn--sm" data-act="gtShow" data-v="${idx}">Xem thư này</button></div><p class="small">Tiêu đề: <b>${esc(fillText(d.tieuDe, cur.data))}</b></p>`;
  h += `</section>`;
  const q = M.drafts.conLai;
  h += `<section class="eco-card"><h2>4. Gửi</h2><p>Gửi tới <b>${rec.length}</b> người. Hạn mức còn lại hôm nay: <b>${q}</b>.${rec.length > q ? ` <span class="danger">Vượt hạn mức: app gửi ${q} thư hôm nay, ${rec.length - q} thư còn lại tự dời sang 7:00 sáng mai.</span>` : ''}</p>
    <div class="row"><label class="opt"><input type="radio" name="gtWhen" value="now" ${g.when !== 'later' ? 'checked' : ''} data-change="gtWhen"> Gửi ngay</label><label class="opt"><input type="radio" name="gtWhen" value="later" ${g.when === 'later' ? 'checked' : ''} data-change="gtWhen"> Hẹn giờ</label>${g.when === 'later' ? `<input class="eco-input sm" type="datetime-local" id="gtAt" style="width:auto" value="${attr(g.at || '')}" data-change="gtAtSet">` : ''}</div>
    ${g.when === 'later' ? '<p class="small muted">Thư hẹn giờ đến giờ mới đọc thư nháp, nên bạn vẫn sửa thư nháp trong Gmail được trước giờ gửi.</p>' : ''}
    <button class="eco-btn eco-btn--filled" data-act="gtSend" ${missing.length ? 'disabled' : ''}>${g.when === 'later' ? 'Hẹn gửi' : 'Gửi ' + Math.min(rec.length, q) + ' thư ngay'}</button></section>`;
  return h;
}
H.gtPv = el => { M.send.pv = +el.dataset.v; render(); };
H.gtWhen = el => { M.send.when = el.value; render(); };
H.gtAtSet = el => { M.send.at = el.value; };
H.gtShow = async el => {
  const rec = sendRecipients()[+el.dataset.v];
  const d = await call('mailDraft', { id: M.send.draftId });
  const html = String(d.html).replace(/\{([^{}\n]{1,60})\}/g, (a, k) => (k.trim() in rec.data) ? '<u>' + esc(rec.data[k.trim()]) + '</u>' : a);
  modal('Xem trước · ' + rec.email, `<p><b>${esc(fillText(d.tieuDe, rec.data))}</b></p>${frameHtml(html)}`, { wide: true });
};
H.gtSend = () => {
  const g = M.send, rec = sendRecipients();
  const at = g.when === 'later' ? fromInput(g.at || (document.getElementById('gtAt') || {}).value) : '';
  if (g.when === 'later' && !at) return toast('Chọn giờ hẹn.', true);
  const desc = g.src === 'tay' ? 'Nhập tay' : g.src === 'sheet' ? 'Sheet: ' + (g.tab || '') : 'Danh bạ';
  confirmBox(at ? 'Hẹn gửi?' : 'Gửi ngay?', `${rec.length} người nhận${at ? ', gửi lúc ' + esc(fDT(at)) : ''}.`, at ? 'Hẹn gửi' : 'Gửi', async () => {
    const r = await call('mailSend', { draftId: g.draftId, recipients: rec, desc, at });
    toast(r.scheduled ? 'Đã hẹn gửi ' + r.count + ' thư.' : 'Đã gửi ' + r.sent + '/' + r.total + (r.deferred ? ', dời ' + r.deferred + ' sang mai' : '') + (r.errors.length ? '. Lỗi: ' + r.errors[0] : ''), r.errors && r.errors.length);
    M.send = null; M.drafts = null; M.sched = null;
    go('#/lich-gui');
  });
};

/* ================= P-50 Lịch gửi ================= */
route('lich-gui', {
  can: () => isBod(),
  render() {
    let html = topbar('Lịch gửi');
    if (!M.sched) return html + loading();
    const up = M.sched.filter(l => l.trangThai === 'hen'), done = M.sched.filter(l => l.trangThai !== 'hen');
    const ST = { daGui: ['Đã gửi', 'done'], loi: ['Lỗi', 'error'], huy: ['Đã hủy', ''], dangGui: ['Đang gửi', ''], doi: ['Đã dời', ''] };
    html += `<section class="eco-card"><h2>Đã lên lịch (${up.length})</h2>${up.length ? `<div class="eco-list">${up.map(l => `<div style="flex-wrap:wrap"><div class="li-main"><b>${esc(l.tieuDe)}</b><span class="sub">${esc(fDT(l.guiLuc))} · ${l.soNguoi} người · ${esc(l.moTaNguon)} · ${esc(l.nguoiTao)}</span></div><div class="row"><button class="eco-btn eco-btn--sm" data-act="lgEdit" data-id="${l.id}">Sửa giờ</button><button class="eco-btn eco-btn--sm" data-act="lgCancel" data-id="${l.id}">Hủy</button></div></div>`).join('')}</div>` : '<p class="muted">Không có.</p>'}</section>`;
    html += `<section class="eco-card"><h2>Đã gửi</h2>${done.length ? `<div class="eco-list">${done.map(l => `<div><div class="li-main"><b>${esc(l.tieuDe)}</b><span class="sub">${esc(fDT(l.guiLuc))} · ${esc(l.ketQua)} · ${esc(l.nguoiTao)}</span></div>${tag((ST[l.trangThai] || [l.trangThai])[0], (ST[l.trangThai] || [])[1])}</div>`).join('')}</div>` : '<p class="muted">Chưa có.</p>'}</section>`;
    return html;
  },
  after() { if (!M.sched) api('mailSchedule').then(r => { M.sched = r; render(); }).catch(e => toast(e.message, true)); }
});
H.lgEdit = el => {
  const l = M.sched.find(x => x.id === el.dataset.id);
  modal('Sửa giờ gửi', `<input class="eco-input" type="datetime-local" id="lgAt" value="${attr(toInput(l.guiLuc))}"><div class="actions"><button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="lgGo">Lưu</button></div>`);
  document.getElementById('lgGo').onclick = async () => { M.sched = await call('mailScheduleEdit', { id: l.id, at: fromInput(document.getElementById('lgAt').value) }); closeModal(); render(); };
};
H.lgCancel = el => confirmBox('Hủy thư hẹn giờ?', 'Thư sẽ không được gửi.', 'Hủy thư', async () => { M.sched = await call('mailScheduleEdit', { id: el.dataset.id, cancel: true }); render(); });

/* ================= P-51 Danh bạ ================= */
route('danh-ba', {
  can: () => isBod(), wide: true,
  render() {
    let html = topbar('Danh bạ', { right: `<button class="eco-btn eco-btn--sm" data-act="dbEdit">${ic('plus', 'sm')} Thêm liên hệ</button>` });
    if (!M.sources) return html + loading();
    const S = M.sources;
    const groups = [...new Set(S.contacts.map(c => c.nhom))];
    const g = App.ui.dbG || '';
    html += `<div class="chips"><button class="eco-chip ${!g ? 'is-active' : ''}" data-act="set" data-k="dbG" data-v="">Tất cả</button><button class="eco-chip ${g === '@tv' ? 'is-active' : ''}" data-act="set" data-k="dbG" data-v="@tv">Thành viên CLB (${S.members.length})</button>${groups.map(x => `<button class="eco-chip ${g === x ? 'is-active' : ''}" data-act="set" data-k="dbG" data-v="${attr(x)}">${esc(x)}</button>`).join('')}</div>`;
    if (g === '@tv') {
      html += `<p class="small muted">Nhóm Thành viên CLB lấy tự động từ danh sách thành viên, không sửa ở đây.</p><section class="eco-card" style="padding:4px 16px"><div class="tablewrap"><table class="eco-table"><thead><tr><th>Họ và tên</th><th>Email</th><th class="dk">Ban</th></tr></thead><tbody>${S.members.map(m => `<tr><td>${esc(m['Họ và tên'])}</td><td>${esc(m['Email'])}</td><td class="dk">${esc(m['Ban'])}</td></tr>`).join('')}</tbody></table></div></section>`;
      return html;
    }
    const list = S.contacts.filter(c => !g || c.nhom === g);
    const fields = S.contactFields;
    App.ui.dbSel = App.ui.dbSel || new Set();
    html += list.length ? `<section class="eco-card" style="padding:4px 16px"><div class="tablewrap"><table class="eco-table"><thead><tr><th></th><th>Tên</th><th>Email</th><th>Nhóm</th>${fields.map(f => `<th class="dk">${esc(f)}</th>`).join('')}<th></th></tr></thead><tbody>${list.map(c => `<tr><td><input type="checkbox" class="chk" data-change="dbSel" data-id="${c.id}" ${App.ui.dbSel.has(c.id) ? 'checked' : ''}></td><td>${esc(c.ten)}</td><td>${esc(c.email)}</td><td>${esc(c.nhom)}</td>${fields.map(f => `<td class="dk small">${esc(c.truong[f] || '')}</td>`).join('')}<td><button class="eco-btn eco-btn--sm" data-act="dbEdit" data-id="${c.id}">Sửa</button></td></tr>`).join('')}</tbody></table></div></section>` : empty('Chưa có liên hệ nào. Bấm "Thêm liên hệ".');
    if (App.ui.dbSel.size) html += `<div class="stickybar"><span class="grow">Đã chọn ${App.ui.dbSel.size} liên hệ</span><button class="eco-btn eco-btn--filled" data-act="dbSend">Gửi thư tùy biến</button></div>`;
    return html;
  },
  after() { if (!M.sources) api('mailSources').then(r => { M.sources = r; render(); }).catch(e => toast(e.message, true)); }
});
H.dbSel = el => { const s = App.ui.dbSel; el.checked ? s.add(el.dataset.id) : s.delete(el.dataset.id); render(); };
H.dbSend = () => { M.send = { src: 'danhba', sel: new Set([...App.ui.dbSel].map(id => 'c:' + id)), rows: [] }; App.ui.dbSel = new Set(); go('#/gui-thu'); };
H.dbEdit = el => {
  const c = el.dataset.id ? M.sources.contacts.find(x => x.id === el.dataset.id) : { truong: {} };
  const fields = [...new Set(M.sources.contactFields.concat(Object.keys(c.truong || {})))];
  modal(c.id ? 'Sửa liên hệ' : 'Thêm liên hệ', `<div class="form"><div class="eco-field"><label>Email</label><input class="eco-input" id="dbEmail" value="${attr(c.email || '')}"></div><div class="eco-field"><label>Tên</label><input class="eco-input" id="dbName" value="${attr(c.ten || '')}"></div><div class="eco-field"><label>Nhóm</label><input class="eco-input" id="dbGroup" list="dbGroups" value="${attr(c.nhom || '')}"><datalist id="dbGroups">${[...new Set(M.sources.contacts.map(x => x.nhom))].map(x => `<option value="${attr(x)}">`).join('')}</datalist></div>
    <div class="label">Trường thông tin (dùng làm chỗ điền {Tên trường})</div><div id="dbFields" class="stack tight">${fields.map(f => `<div class="row nowrap"><input class="eco-input sm" style="width:40%" data-f="k" value="${attr(f)}"><input class="eco-input sm grow" data-f="v" value="${attr((c.truong || {})[f] || '')}"></div>`).join('')}</div><button class="eco-btn eco-btn--sm" data-act="dbAddField">${ic('plus', 'sm')} Thêm trường</button></div>
    <div class="actions">${c.id ? '<button class="eco-btn eco-btn--danger" id="dbDel">Xóa</button>' : ''}<button class="eco-btn" data-act="closeModal">Thôi</button><button class="eco-btn eco-btn--filled" id="dbSave">Lưu</button></div>`);
  document.getElementById('dbSave').onclick = async () => {
    const truong = {};
    document.querySelectorAll('#dbFields > .row').forEach(r => { const k = r.querySelector('[data-f=k]').value.trim(); if (k) truong[k] = r.querySelector('[data-f=v]').value; });
    try { M.sources = await call('contactSave', { contact: { id: c.id, email: document.getElementById('dbEmail').value, ten: document.getElementById('dbName').value, nhom: document.getElementById('dbGroup').value, truong } }); closeModal(); render(); toast('Đã lưu.'); } catch (e) { }
  };
  const d = document.getElementById('dbDel');
  if (d) d.onclick = async () => { M.sources = await call('contactSave', { deleteId: c.id }); closeModal(); render(); };
};
H.dbAddField = () => { const d = document.createElement('div'); d.className = 'row nowrap'; d.innerHTML = '<input class="eco-input sm" style="width:40%" data-f="k" placeholder="Tên trường"><input class="eco-input sm grow" data-f="v">'; document.getElementById('dbFields').appendChild(d); };
