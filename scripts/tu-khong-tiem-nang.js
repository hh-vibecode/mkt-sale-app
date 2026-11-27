// TỰ CHUYỂN KHÁCH TIỀM NĂNG -> "KHÔNG TIỀM NĂNG" SAU 7 NGÀY (anh Hải 23/11/2026):
//   "tiềm năng sau 7 ngày không phản hồi thêm gì kể từ lần cuối sale nhắn hoặc không cho sđt thì chuyển về hết thành không tiềm năng"
//   (anh chọn: quá 7 ngày kể từ tin cuối của Sale mà khách IM, HOẶC vẫn CHƯA có SĐT), "không tiềm năng thì khách trên pancake lại đổi thành đạt",
//   "qc nó đưa tiềm năng là được rồi, còn m là người xử lý tiếp, không cần làm phiền nó bước này" -> APP TỰ LÀM, không qua QC.
// SỬA 23/11 ~11h (anh: "t cần m chấm tin pancake của qc tháng 11, m lôi cả tin từ 2025 vào làm gì", "sale đã update data rồi thì m không được
//   sờ vào nữa"; đồng ý tính cả lượt chăm sóc là liên hệ của Sale):
//   - CHỈ xét hội thoại có trong dữ liệu QC THÁNG 11 (sale_response_review, conv_date >= 1/11, verdict <> khong_lien_quan) và chấm trên
//     full_thread QC lưu ("[YYYY-MM-DD HH:MM] Khách / Sale (Tên) / Bot: …", giờ VN) — KHÔNG gọi Pancake đọc tin.
//   - KHÔNG ĐỤNG khách SALE ĐÃ CẬP NHẬT: có lượt chăm sóc (mọi Lead ID / Mã KH của khách), hoặc hồ sơ (saleretail_manual) do người sửa,
//     hoặc nhật ký thao tác (activity_log) có người sửa khách này.
// Đối tượng: khách app (Lẻ + Sỉ) "Tiềm năng, chưa ra đơn", chưa chốt, Sale chưa cập nhật, có hội thoại QC tháng 11.
// Chuyển khi: tin cuối của Sale trong hội thoại cách nay >= 7 ngày VÀ (sau tin đó khách không nhắn gì "có nội dung" HOẶC chưa có SĐT —
//   app không có số, khách không gửi số trong hội thoại). Tin ngắn "ok / dạ / vâng / cảm ơn" (≤ 24 ký tự, không "?") không tính; ảnh có tính.
// Làm: si_phan_loai "Không tiềm năng" (updated_by "Monsieur Claude (7 ngày)") + activity_log; thẻ khách POS bỏ *TIỀM NĂNG*, thêm LEAD ĐẠT
//   (CHỐT ĐƠN thì không đụng thẻ); cập nhật datahub_orders.customer_tags + pancake_gan_the_qc (nhom 'dat', the_sau).
// SOÁT LẠI mỗi lượt các khách job đã chuyển (chưa trả): không còn đúng luật (hội thoại không thuộc QC T11 / Sale đã cập nhật / khách đã nhắn
//   lại sau lúc chuyển) -> TRẢ LẠI: Phân loại cũ (người sửa cũ lấy từ activity_log nếu có), thẻ khách cũ (chỉ khi thẻ còn y như job để lại).
//   Sale đã tự đổi Phân loại sau lúc chuyển -> không đụng.
// + LUẬT XÁC NHẬN 2 NGÀY (anh Hải chốt 27/11/2026, QC + MKT đồng bộ): "các khách tiềm năng mà sale nhắn xác nhận lại xem họ có mua hay không ...
//   sau 2 ngày mà họ k phản hồi lại tin xác nhận ấy hoặc phản hồi từ chối, thì [QC] chuyển tiềm năng thành đạt và cũng báo để mkt đổi lại thẻ và
//   trạng thái cho tương ứng từ app tới pancake"; anh chọn trạng thái app = "Không tiềm năng". QC (v1.80) ghi trong view qc_khach_tiem_nang_ngay:
//   xac_nhan_luc (giờ VN, tin xác nhận mới nhất) + nhom 'dat' với ly_do_nhom "Sale xác nhận lại, khách không phản hồi sau 2 ngày", hoặc ket
//   'tu_choi' đánh giá SAU tin xác nhận. Ca này ĐỔI CẢ KHI SALE ĐÃ CẬP NHẬT (tin xác nhận chính là lượt chăm của Sale) -- chỉ trừ khách đã chốt
//   (isChot / thẻ CHỐT ĐƠN) hoặc Sale đã chọn Phân loại khác Tiềm năng / Lead mới (Đã ra đơn, Lead cũ, Chưa liên hệ được, Không tiềm năng).
//   App: Phân loại "Không tiềm năng" (updated_by "Monsieur Claude (xác nhận 2 ngày)"); thẻ khách bỏ *TIỀM NĂNG*, thêm LEAD ĐẠT. Trả lại khi QC
//   không còn xếp đạt theo luật này (khách nhắn lại / đánh giá lại) hoặc khách nhắn lại sau lúc chuyển.
// Lịch: bước trong sync-datahub.yml, tối đa 1 lượt / 6 giờ (gianhMoc), 7h–22h VN; CÓ ca xác nhận 2 ngày chưa xử lý thì chạy ngay (không chờ 6 giờ).
//   KHO=1 chạy thử (in từng ca). CHAY_NGAY=1 bỏ lịch.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { sbAll } = require('./lib/sb');
const KEYS = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8'); } catch (e) { return ''; } })();
const TOKEN = process.env.PANCAKE_SESSION_TOKEN || (KEYS.match(/PANCAKE_SESSION_TOKEN[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (KEYS.match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const SB = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const XEM = process.env.KHO === '1';
const NGAY = 7, AI = 'Monsieur Claude (7 ngày)', AI_XN = 'Monsieur Claude (xác nhận 2 ngày)', TU_NGAY = '2026-11-01';
const XN_LY = 'Sale xác nhận lại, khách không phản hồi sau 2 ngày', XN_TIEN_TO = 'Sale xác nhận lại';
const HSB = { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pos = p => `https://pos.pages.fm/api/v1/${p}${p.includes('?') ? '&' : '?'}access_token=${TOKEN}`;
const an = s => String(s || '').split(TOKEN || '\u0000').join('***');
const laJob = w => /^(monsieur claude|auto-)/i.test(String(w || '').trim());
const soTrong = t => (String(t || '').replace(/[.\s-]/g, '').match(/(?:\+?84|0)[35789]\d{8}/g) || []);
async function lay(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) return null; } catch (e) { /* thử lại */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
// chấm 1 full_thread QC: { saleCuoi ms, khachCuoi ms (tin có nội dung), coSo }
function cham(thread) {
  const dong = [];
  for (const l0 of String(thread || '').split(/\r?\n/)) {
    const m = /^\[(\d{4}-\d\d-\d\d) (\d\d:\d\d)\]\s*(Khách|Bot|Sale(?: \([^)]*\))?)\s*:\s*([\s\S]*)$/.exec(l0.trim());
    if (m) dong.push({ t: Date.parse(m[1] + 'T' + m[2] + ':00+07:00'), ai: m[3].startsWith('Sale') ? 'sale' : m[3] === 'Bot' ? 'bot' : 'khach', nd: m[4] });
    else if (dong.length && l0.trim()) dong[dong.length - 1].nd += '\n' + l0.trim();
  }
  // tin KHÔNG có nội dung = CHỈ lời đáp lễ ngắn "ok / dạ / vâng / cảm ơn / sticker" (23/11 ~11h40: trước tính mọi tin ≤ 24 ký tự không "?"
  // là im -> "giá bao nhiêu ạ" bị coi là im, chuyển nhầm khách QC ghi "khách hỏi, chờ Sale")
  const leTiet = t => { const v = String(t || '').toLowerCase().replace(/[!.,~\s]+/g, ' ').trim();
    return !v || (v.length <= 24 && !/\?/.test(v) && /^((dạ|da|vâng|vang|ok|oke|okie|okay|ừ|uk|uh|ạ|à|vg|dc|được|đc|em|e|anh|a|chị|c|mình|cảm ơn|cám ơn|cam on|thank|thanks|tks|ty|nhé|nha|nhá|ạh|👍|❤️|🙏|\(sticker\))\s*)+$/i.test(v)); };
  const coND = x => /gửi ảnh|gửi tệp|\(ảnh|\(tệp/i.test(x.nd) || !leTiet(x.nd);
  const sale = dong.filter(x => x.ai === 'sale'), khach = dong.filter(x => x.ai === 'khach' && coND(x));
  return { saleCuoi: sale.length ? sale[sale.length - 1].t : null, khachCuoi: khach.length ? khach[khach.length - 1].t : null,
    coSo: dong.some(x => x.ai === 'khach' && soTrong(x.nd).length) };
}

(async () => {
  if (!TOKEN || !KHOA) { console.error('Thiếu PANCAKE_SESSION_TOKEN / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  // hội thoại QC tháng 11 -> full_thread mới nhất
  const qcTh = {}, qcView = {};
  // view tiềm năng QC: khách "chưa khai thác hết" (lỗi Sale) / "khách hỏi, chờ Sale" -> KHÔNG BAO GIỜ chuyển (việc của Sale, Daily Task đỏ)
  (await sbAll(SB, KHOA, 'qc_khach_tiem_nang_ngay', `select=pancake_conversation_id,chua_khai_thac,ly_do_nhom,nhom,ket,danh_gia_luc,xac_nhan_luc&ngay=gte.${TU_NGAY}&order=pancake_conversation_id`))
    .forEach(q => { qcView[q.pancake_conversation_id] = q; });
  const viecSale = c => { const q = qcView[c]; return !!q && (q.chua_khai_thac === true || /chờ Sale/i.test(q.ly_do_nhom || '')); };
  // ca XÁC NHẬN 2 NGÀY của 1 hội thoại -> lý do (null = không thuộc luật). xac_nhan_luc là giờ VN không múi giờ.
  const xnLuc = q => { const v = String(q.xac_nhan_luc || ''); return v ? Date.parse(/Z|[+-]\d\d:?\d\d$/.test(v) ? v : v.replace(' ', 'T') + '+07:00') : null; };
  const xnDat = c => { const q = qcView[c]; if (!q || q.nhom !== 'dat' || !q.xac_nhan_luc || q.chua_khai_thac === true) return null;
    if (q.ly_do_nhom === XN_LY) return XN_LY;
    if (q.ket === 'tu_choi' && Date.parse(q.danh_gia_luc) > xnLuc(q)) return XN_TIEN_TO + ', khách từ chối';
    return null; };
  const nkCu = await sbAll(SB, KHOA, 'khach_khong_tiem_nang_tu_dong', 'select=*&order=lead_id');
  if (process.env.CHAY_NGAY !== '1') {
    const gio = new Date(Date.now() + 7 * 3600e3).getUTCHours();
    if (gio < 7 || gio > 22) { console.log('Không tiềm năng 7 ngày: ngoài 7h–22h VN — bỏ qua'); return; }
    // có hội thoại QC vừa xếp đạt theo luật xác nhận 2 ngày mà job chưa chuyển -> chạy ngay; không thì 6 giờ / lượt như cũ
    const daXn = new Set(nkCu.filter(x => !x.tra_lai_luc && String(x.ly_do || '').startsWith(XN_TIEN_TO)).map(x => x.conversation_id));
    const xnMoi = Object.keys(qcView).filter(c => xnDat(c) && !daXn.has(c)).length;
    const { gianhMoc } = require('./lib/gianh-moc');
    if (!xnMoi && !(await gianhMoc(SB, KHOA, 'tu-khong-tiem-nang', 6 * 60))) { console.log('Không tiềm năng 7 ngày: chưa đủ 6 giờ từ lượt trước — bỏ qua'); return; }
    if (xnMoi) console.log(`Có ${xnMoi} hội thoại QC xếp đạt theo luật xác nhận 2 ngày — chạy ngay`);
  }
  (await sbAll(SB, KHOA, 'sale_response_review', `select=id,conv_id,full_thread&conv_date=gte.${TU_NGAY}&verdict=neq.khong_lien_quan&order=id`))
    .forEach(x => { if (x.conv_id && String(x.full_thread || '').trim()) qcTh[x.conv_id] = x.full_thread; });

  const { napApp, masterCua } = require('./lib/nap-app');
  const ctx = await napApp();
  ctx.__qc = qcTh;
  const theoId = {}, ungVien = [], ungVienXn = [];
  for (const L of ['Lẻ', 'Sỉ']) {
    masterCua(ctx, L);
    ctx.__L = L;
    vm.runInContext(`(()=>{window._rptSlType=__L;window._kiotOrdByCode=null;rptSlXoaCache();window.__ds=rptSlBuildMaster().filter(r=>!r.vangLai).map(r=>{
        const ids=rptSlIdsCua(r);
        const convs=[...new Set([].concat((r.orders||[]).map(o=>o&&o.conversation_id),r.convId,(r.mergedRows||[]).map(m=>m.convId)).filter(Boolean))];
        const qcConv=convs.filter(c=>__qc[c]);
        return {lead:r.leadId,ids,ten:r.name,isChot:!!r.isChot,tt:rptSlLocTT(r),coSoApp:!!((r.phones||[]).length||r.phone),
          nCs:rptSlCsRows(r).length,nguoiSua:ids.map(id=>(rptSlManual[id]||{}).updated_by).filter(Boolean),
          conv:qcConv[0]||null,convs,don:(r.orders||[]).filter(o=>o&&o.conversation_id).map(o=>({shop:o.shop_id,id:o.order_id,conv:o.conversation_id}))};});})()`, ctx);
    const ds = vm.runInContext('window.__ds', ctx);
    ds.forEach(x => { x.loai = L; x.ids.forEach(id => { if (!theoId[id]) theoId[id] = x; }); });
    ds.filter(x => !x.isChot && x.tt === 'Tiềm năng, chưa ra đơn').forEach(x => ungVien.push(x));
    ds.filter(x => !x.isChot && ['Tiềm năng, chưa ra đơn', 'Lead mới', '(chưa cập nhật)'].includes(x.tt)).forEach(x => {
      const c = (x.convs || []).find(cv => xnDat(cv)); if (c) ungVienXn.push(Object.assign({}, x, { conv: c, xn: xnDat(c) })); });
  }
  // người sửa trong nhật ký thao tác (activity_log) theo Lead ID
  const nguoiLog = {};
  const tatId = [...new Set(ungVien.flatMap(x => x.ids).concat(ungVienXn.flatMap(x => x.ids), nkCu.map(x => x.lead_id)))];
  for (let i = 0; i < tatId.length; i += 80) {
    (await sbAll(SB, KHOA, 'activity_log', 'select=ref,who,fld,new_v,at&ref=in.(' + tatId.slice(i, i + 80).map(encodeURIComponent).join(',') + ')&order=at'))
      .forEach(a => { if (!laJob(a.who)) (nguoiLog[a.ref] = nguoiLog[a.ref] || []).push(a); });
  }
  const saleDaCapNhat = x => x.nCs > 0 || x.nguoiSua.some(w => !laJob(w)) || x.ids.some(id => (nguoiLog[id] || []).length);
  console.log(`Không tiềm năng 7 ngày: hội thoại QC T11 ${Object.keys(qcTh).length} · khách tiềm năng ${ungVien.length} · đã chuyển trước ${nkCu.filter(x => !x.tra_lai_luc).length} · ca xác nhận 2 ngày ${ungVienXn.length}${XEM ? ' (KHO=1: chạy thử)' : ''}`);

  const now = Date.now(), dem = { xn: 0, chuyen: 0, im: 0, chua_so: 0, giu_sale: 0, giu_ngoai_qc: 0, giu_moi: 0, tra: 0, loi: 0 }, lyTra = {};
  const act = [];
  const doiThe = async (shop, orderId, conv, fn) => {
    const j = await lay(pos(`shops/${shop}/orders/${orderId}`)); const d = j && (j.data || j);
    const cid = d && d.customer && d.customer.id, cu = d && d.customer && d.customer.shop_customer && d.customer.shop_customer.tags;
    if (!cid || !Array.isArray(cu)) return null;
    const moi = fn(cu); if (!moi) return { cid, cu, moi: null };
    if (!XEM) {
      const r = await fetch(pos(`shops/${shop}/customers/${cid}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { tags: moi } }) });
      if (!r.ok) throw new Error('PUT thẻ ' + r.status + ' ' + an((await r.text()).slice(0, 120)));
      await fetch(`${SB}/rest/v1/datahub_orders?conversation_id=eq.${encodeURIComponent(conv)}&shop_id=eq.${shop}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ customer_tags: moi.join(', ') }) }).catch(() => null);
      await fetch(`${SB}/rest/v1/pancake_gan_the_qc?conversation_id=eq.${encodeURIComponent(conv)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ the_sau: moi.join(', ') }) }).catch(() => null);
    }
    return { cid, cu, moi };
  };
  const tachThe = s => String(s || '').split(',').map(t => t.trim()).filter(Boolean);
  const cungBo = (a, b) => [...new Set(a.map(t => t.toUpperCase()))].sort().join('|') === [...new Set(b.map(t => t.toUpperCase()))].sort().join('|');

  // ── 1. SOÁT LẠI khách đã chuyển ──
  const daChuyen = new Set();
  for (const x of nkCu.filter(r => !r.tra_lai_luc)) {
    const kh = theoId[x.lead_id];
    const man = vm.runInContext(`rptSlManual[${JSON.stringify(x.lead_id)}]||{}`, ctx);
    const laXn = String(x.ly_do || '').startsWith(XN_TIEN_TO);
    if (String(man.si_phan_loai || '').trim() !== 'Không tiềm năng' || String(man.updated_by || '') !== (laXn ? AI_XN : AI)) continue;   // Sale đã đổi sau đó -> không đụng
    let ly = null;
    if (laXn) {
      if (!xnDat(x.conversation_id)) ly = 'QC không còn xếp đạt theo luật xác nhận 2 ngày (khách nhắn lại / đánh giá lại)';
      else if (qcTh[x.conversation_id]) { const h = cham(qcTh[x.conversation_id]); if (h.khachCuoi && h.khachCuoi > Date.parse(x.luc)) ly = 'khách nhắn lại'; }
    }
    else if (!qcTh[x.conversation_id]) ly = 'hội thoại không thuộc dữ liệu QC tháng 11';
    else if (viecSale(x.conversation_id)) ly = 'QC: chưa khai thác hết / khách hỏi chờ Sale (việc của Sale)';
    else if (kh && saleDaCapNhat(kh)) ly = 'Sale đã cập nhật khách (lượt chăm sóc / hồ sơ)';
    else { const h = cham(qcTh[x.conversation_id]);
      if (h.khachCuoi && h.khachCuoi > Date.parse(x.luc)) ly = 'khách nhắn lại';
      // tính lại đủ điều kiện theo luật hiện hành (vd cách nhận tin đáp lễ đổi 23/11) -> không còn đúng thì trả
      else { const im = !(h.khachCuoi && h.saleCuoi && h.khachCuoi > h.saleCuoi), chuaSo = !(kh && kh.coSoApp) && !h.coSo;
        if (!h.saleCuoi || Date.now() - h.saleCuoi < NGAY * 864e5 || (!im && !chuaSo)) ly = 'không còn đúng luật 7 ngày (tính lại)'; } }
    if (!ly) { daChuyen.add(x.lead_id); continue; }
    dem.tra++; lyTra[ly] = (lyTra[ly] || 0) + 1;
    if (XEM) { console.log(`  TRẢ ${x.lead_id} ${x.ten} · ${ly}`); continue; }
    try {
      // TRẢ NGUYÊN TRẠNG hồ sơ đã lưu lúc chuyển (pl_tay_truoc / nguoi_sua_truoc / sua_luc_truoc) — không đoán
      const body = { si_phan_loai: x.pl_tay_truoc || null, updated_by: x.nguoi_sua_truoc || 'Monsieur Claude (trả lại)', updated_at: x.sua_luc_truoc || new Date().toISOString() };
      await fetch(`${SB}/rest/v1/saleretail_manual?lead_id=eq.${encodeURIComponent(x.lead_id)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify(body) });
      let ghiThe = 'không có đơn';
      if (x.shop_id && x.the_sau) {
        const don = (await sbAll(SB, KHOA, 'datahub_orders', 'select=order_id&shop_id=eq.' + x.shop_id + '&conversation_id=eq.' + encodeURIComponent(x.conversation_id)))[0];
        if (don) { const t = await doiThe(x.shop_id, don.order_id, x.conversation_id, cu => cungBo(cu, tachThe(x.the_sau)) ? tachThe(x.the_truoc) : null);
          ghiThe = t && t.moi ? 'trả thẻ ' + t.moi.join(', ') : 'thẻ đã khác lúc job đổi — giữ'; }
      }
      await fetch(`${SB}/rest/v1/khach_khong_tiem_nang_tu_dong?lead_id=eq.${encodeURIComponent(x.lead_id)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ tra_lai_luc: new Date().toISOString(), ghi_chu: 'trả lại: ' + ly + ' · ' + ghiThe }) });
      await fetch(`${SB}/rest/v1/pancake_gan_the_qc?conversation_id=eq.${encodeURIComponent(x.conversation_id)}&ket=eq.sale_xu_ly`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ ket: 'gan', ghi_chu: 'mở lại sau khi job 7 ngày trả lại' }) }).catch(() => null);
      act.push({ who: 'Monsieur Claude', act: 'U', tbl: 'saleretail_manual', ref: x.lead_id, label: x.ten, fld: 'Phân loại KH', old_v: 'Không tiềm năng', new_v: 'trả lại ' + (body.si_phan_loai || '(theo thẻ)') + ' — ' + ly });
    } catch (e) { dem.loi++; console.log('  trả lại lỗi', x.lead_id, an(e.message)); }
    await sleep(150);
  }

  // ── 2a. LUẬT XÁC NHẬN 2 NGÀY (đổi cả khi Sale đã cập nhật) ──
  const xnXong = new Set();
  for (const u of ungVienXn) {
    if (daChuyen.has(u.lead) || xnXong.has(u.lead)) continue;
    xnXong.add(u.lead); dem.xn++;
    if (XEM) { console.log(`  CHUYỂN (xác nhận) ${u.loai} ${u.lead} ${u.ten} · ${u.tt} · ${u.xn}`); continue; }
    try { await chuyenKtn(u, u.xn, null, AI_XN); } catch (e) { dem.loi++; console.log('  chuyển (xác nhận) lỗi', u.lead, an(e.message)); }
    await sleep(150);
  }
  // ── 2b. CHUYỂN "KHÔNG TIỀM NĂNG" 7 NGÀY ──
  for (const u of ungVien) {
    if (xnXong.has(u.lead)) continue;
    if (daChuyen.has(u.lead)) continue;
    if (!u.conv) { dem.giu_ngoai_qc++; continue; }
    if (viecSale(u.conv)) { dem.giu_sale++; continue; }
    if (saleDaCapNhat(u)) { dem.giu_sale++; continue; }
    const h = cham(qcTh[u.conv]);
    if (!h.saleCuoi || now - h.saleCuoi < NGAY * 864e5) { dem.giu_moi++; continue; }
    const im = !(h.khachCuoi && h.khachCuoi > h.saleCuoi), chuaSo = !u.coSoApp && !h.coSo;
    if (!im && !chuaSo) { dem.giu_moi++; continue; }
    const lyDo = im ? 'im ' + NGAY + ' ngày sau tin Sale' : 'chưa SĐT sau ' + NGAY + ' ngày';
    dem.chuyen++; if (im) dem.im++; else dem.chua_so++;
    if (XEM) { console.log(`  CHUYỂN ${u.loai} ${u.lead} ${u.ten} · ${lyDo} · tin Sale cuối ${new Date(h.saleCuoi + 7 * 3600e3).toISOString().slice(0, 10)}`); continue; }
    try { await chuyenKtn(u, lyDo, h.saleCuoi, AI); } catch (e) { dem.loi++; console.log('  chuyển lỗi', u.lead, an(e.message)); }
    await sleep(150);
  }
  async function chuyenKtn(u, lyDo, saleCuoi, ai) {
      const mCu = vm.runInContext(`rptSlManual[${JSON.stringify(u.lead)}]||{}`, ctx);
      await fetch(`${SB}/rest/v1/saleretail_manual?on_conflict=lead_id`, { method: 'POST', headers: { ...HSB, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ lead_id: u.lead, si_phan_loai: 'Không tiềm năng', updated_by: ai, updated_at: new Date().toISOString() }]) });
      const d0 = u.don.find(o => o.conv === u.conv) || null;
      let the = null;
      if (d0) the = await doiThe(d0.shop, d0.id, u.conv, cu => {
        if (cu.some(t => /CHỐT ĐƠN/i.test(t))) return null;
        const moi = cu.filter(t => !/TIỀM NĂNG/i.test(t));
        if (!moi.some(t => t.toUpperCase() === 'LEAD ĐẠT')) moi.push('LEAD ĐẠT');
        return moi;
      });
      await fetch(`${SB}/rest/v1/pancake_gan_the_qc?conversation_id=eq.${encodeURIComponent(u.conv)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ nhom: 'dat' }) }).catch(() => null);
      await fetch(`${SB}/rest/v1/khach_khong_tiem_nang_tu_dong?on_conflict=lead_id`, { method: 'POST', headers: { ...HSB, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ lead_id: u.lead, ten: u.ten, conversation_id: u.conv, shop_id: d0 ? d0.shop : null, customer_id: the && the.cid || null, ly_do: lyDo,
          sale_nhan_cuoi: saleCuoi ? new Date(saleCuoi).toISOString() : null, phan_loai_truoc: mCu.si_phan_loai || 'Tiềm năng, chưa ra đơn',
          pl_tay_truoc: mCu.si_phan_loai || null, nguoi_sua_truoc: mCu.updated_by || null, sua_luc_truoc: mCu.updated_at || null, co_ho_so_truoc: !!mCu.lead_id,
          the_truoc: the && the.cu ? the.cu.join(', ') : null, the_sau: the && the.moi ? the.moi.join(', ') : null, luc: new Date().toISOString(), tra_lai_luc: null, ghi_chu: null }]) });
      act.push({ who: 'Monsieur Claude', act: 'U', tbl: 'saleretail_manual', ref: u.lead, label: u.ten, fld: 'Phân loại KH', old_v: mCu.si_phan_loai || 'Tiềm năng, chưa ra đơn', new_v: 'Không tiềm năng (' + lyDo + ')' });
  }
  if (!XEM && act.length) {
    const r = await fetch(`${SB}/rest/v1/activity_log`, { method: 'POST', headers: { ...HSB, Prefer: 'return=minimal' }, body: JSON.stringify(act) });
    if (!r.ok) console.log('  ghi activity_log lỗi', r.status);
  }
  console.log(`Không tiềm năng 7 ngày xong: ${XEM ? 'SẼ' : 'đã'} trả lại ${dem.tra} ${JSON.stringify(lyTra)} · xác nhận 2 ngày ${dem.xn} · chuyển 7 ngày ${dem.chuyen} (im ${dem.im} · chưa SĐT ${dem.chua_so})`
    + ` · giữ: Sale đã cập nhật ${dem.giu_sale}, ngoài dữ liệu QC T11 ${dem.giu_ngoai_qc}, chưa đủ 7 ngày / khách còn nhắn ${dem.giu_moi} · lỗi ${dem.loi}`);
  if (dem.loi) process.exitCode = 1;
})().catch(e => { console.error(an(e && e.message || e)); process.exit(1); });
