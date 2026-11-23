// GẮN THẺ HỘI THOẠI PANCAKE THEO ĐÁNH GIÁ QC — CHỈ 1 LẦN LÚC ĐẦU (anh Hải 23/11/2026).
//   "m chỉ cần gắn thẻ tiềm năng vs đạt trên pancake lúc đầu thôi, thống nhất vs qc", "chấm trên pancake á, còn nó chấm nội dung tin nhắn",
//   "để sale tự đổi trạng thái ... sale đổi trong app thì m ghi nhận là được", "chạy trước đi".
// Nguồn: view qc_khach_tiem_nang_ngay (app QC, 2 lượt chấm / ngày 12h–14h & 20h–22h VN). Nhóm theo luật anh chốt 23/11:
//   TIỀM NĂNG = chua_khai_thac, nhom 'tiem_nang', hoặc "Khách dừng" (im lâu vẫn để Sale chăm lại) -> thẻ "LEAD TIỀM NĂNG" (khi page có thẻ này)
//   ĐẠT = phần còn lại (chê giá / không đúng hàng / từ chối, kể cả "Khách từ chối hẳn" — anh: "tính đạt") -> thẻ "LEAD ĐẠT"
// Luật gắn:
//   - Mỗi hội thoại xử lý ĐÚNG 1 LẦN (bảng pancake_gan_the_qc); sau đó Sale tự đổi, job không gắn / gỡ lại.
//   - Hội thoại đã có thẻ trạng thái Sale tự gắn (LEAD ĐẠT / LEAD TIỀM NĂNG / LEAD KO ĐẠT / CHỐT ĐƠN / RÁC / TUYỂN DỤNG...) -> bỏ qua, ghi nhật ký.
//   - Chỉ THÊM 1 thẻ (API thêm từng thẻ, không ghi đè bộ thẻ). Page chưa có thẻ cần gắn (vd TikTok, hoặc chưa tạo "LEAD TIỀM NĂNG") -> để
//     lần sau (không ghi nhật ký), có trang tạo thẻ là tự gắn.
// Lịch: chạy trong bước đồng bộ Pancake (10 phút / lần) nhưng chỉ làm việc lúc 14h và 22h giờ VN (ngay sau lượt chấm của QC); CHAY_NGAY=1 bỏ khung giờ.
// KHO=1: chạy thử, chỉ in số, không gắn / không ghi.
// API gắn thẻ hội thoại (thử 23/11/2026 trên 1 hội thoại, trả success): POST pages.fm/api/public_api/v1/pages/{page}/conversations/{conv}/tags
//   ?page_access_token=… body {action:'add', tag_id}; page token lấy qua POST pages.fm/api/v1/pages/{page}/generate_page_access_token.
const fs = require('fs'), path = require('path');
const { sbAll } = require('./lib/sb');
const KEYS = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8'); } catch (e) { return ''; } })();
const TOKEN = process.env.PANCAKE_SESSION_TOKEN || (KEYS.match(/PANCAKE_SESSION_TOKEN[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (KEYS.match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const SB = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const XEM = process.env.KHO === '1';
// CHỈ HỘI THOẠI TỪ THÁNG 11/2026 (anh Hải 23/11/2026: "cái gắn thẻ tiềm năng này cũng xử lý từ tháng 11 thôi")
const TU_NGAY = '2026-11-01';
const THE_NHOM = { tiem_nang: 'LEAD TIỀM NĂNG', dat: 'LEAD ĐẠT' };
// thẻ trạng thái Sale đã tự gắn -> tôn trọng, không gắn thêm
const THE_SALE = /LEAD ĐẠT|LEAD KO ĐẠT|TIỀM NĂNG|CHỐT ĐƠN|RÁC|TUYỂN DỤNG|CHƯA CÓ NC|GIÁ CAO|SAI SP|KO LH ĐC/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const an = s => String(s || '').split(TOKEN || '\u0000').join('***');

function vmTT(ctx, r) { ctx.__r = r; return require('vm').runInContext('rptSlLocTT(__r)', ctx); }
function nhomCua(q) {
  if (q.chua_khai_thac === true || q.nhom === 'tiem_nang' || /^Khách dừng/i.test(q.ly_do_nhom || '')) return 'tiem_nang';
  return 'dat';
}

(async () => {
  if (!TOKEN || !KHOA) { console.error('Thiếu PANCAKE_SESSION_TOKEN / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const gioVN = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  if (process.env.CHAY_NGAY !== '1' && ![14, 22].includes(gioVN)) { console.log('Gắn thẻ QC: ngoài khung 14h / 22h VN (giờ VN ' + gioVN + 'h) — bỏ qua'); return; }

  const view = await sbAll(SB, KHOA, 'qc_khach_tiem_nang_ngay', 'select=ngay,page_id,pancake_conversation_id,ten_khach,nhom,ly_do_nhom,chua_khai_thac&ngay=gte.'+TU_NGAY+'&order=pancake_conversation_id');
  const da = new Set((await sbAll(SB, KHOA, 'pancake_gan_the_qc', 'select=conversation_id&order=conversation_id')).map(r => r.conversation_id));
  const moi = view.filter(q => q.page_id && q.pancake_conversation_id && !da.has(q.pancake_conversation_id));
  console.log(`Gắn thẻ QC: view ${view.length} hội thoại · đã xử lý trước ${da.size} · mới ${moi.length}${XEM ? ' (KHO=1: chạy thử)' : ''}`);
  if (!moi.length) return;

  const trang = {};   // page -> {ten: id, token}
  const theTrang = async pg => {
    if (trang[pg]) return trang[pg];
    const st = await fetch(`https://pancake.vn/api/v1/pages/${pg}/settings?access_token=${TOKEN}`).then(r => r.json()).catch(() => null);
    const ma = {}, ten = {};
    ((st && st.settings && st.settings.tags) || []).forEach(t => { ma[String(t.text).trim().toUpperCase()] = t.id; ten[t.id] = String(t.text).trim(); });
    if (XEM && process.env.THU_TN === '1' && ma['LEAD TIỀM NĂNG'] == null && Object.keys(ma).length) ma['LEAD TIỀM NĂNG'] = -1;   // chỉ chạy thử: giả như page đã có thẻ
    return (trang[pg] = { ma, ten, pt: null });
  };
  const ghi = async rows => {
    if (XEM || !rows.length) return;
    const r = await fetch(`${SB}/rest/v1/pancake_gan_the_qc?on_conflict=conversation_id`, { method: 'POST',
      headers: { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(rows) });
    if (!r.ok) throw new Error('Ghi nhật ký lỗi ' + r.status + ' ' + (await r.text()).slice(0, 200));
  };

  // TRẠNG THÁI SALE CHỌN TRÊN APP ĐƯỢC ƯU TIÊN (anh Hải 23/11/2026: "data nào trùng với sale xử lý rồi thì ưu tiên trạng thái xử lý của sale",
  // "trạng thái sale chọn trên app vẫn ưu tiên"): hội thoại nối được khách app (conversation_id đơn Pancake / convId dòng khách) ->
  //   đã chốt / Phân loại khác Lead mới & Tiềm năng -> BỎ QUA (ghi nhật ký "Sale đã xử lý"); "Tiềm năng, chưa ra đơn" -> gắn LEAD TIỀM NĂNG dù QC xếp đạt.
  // Nạp app (nặng) CHỈ KHI có dòng gắn được (page đã có thẻ cần gắn) -> lúc page chưa có thẻ LEAD TIỀM NĂNG không nạp.
  for (const q of moi) { const T = await theTrang(q.page_id); q._the = T.ma[THE_NHOM[nhomCua(q)].toUpperCase()]; q._co = T.ma['LEAD TIỀM NĂNG'] != null; }
  const ttApp = {};
  if (moi.some(q => q._the != null || q._co)) {
    const { napApp, masterCua } = require('./lib/nap-app');
    const ctx = await napApp();
    for (const L of ['Lẻ', 'Sỉ']) masterCua(ctx, L).forEach(r => {
      const tt = r.isChot ? 'Đã ra đơn' : (vmTT(ctx, r));
      [].concat((r.orders || []).map(o => o && o.conversation_id), r.convId, (r.mergedRows || []).map(m => m.convId)).filter(Boolean)
        .forEach(c => { if (!ttApp[c]) ttApp[c] = tt; });
    });
  }
  const dem = { gan: 0, bo_qua: 0, loi: 0, cho_the: 0 }, theoThe = {}, nk = [];
  for (const q of moi) {
    const pg = q.page_id, conv = q.pancake_conversation_id, tt = ttApp[conv] || '';
    if (tt && !['Lead mới', 'Tiềm năng, chưa ra đơn', '(chưa cập nhật)'].includes(tt)) {
      dem.bo_qua++; nk.push({ conversation_id: conv, page_id: pg, nhom: nhomCua(q), ly_do_nhom: q.ly_do_nhom || null, the_truoc: null,
        tag_id: null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'Sale đã xử lý trên app: ' + tt }); continue;
    }
    const nhom = tt === 'Tiềm năng, chưa ra đơn' ? 'tiem_nang' : nhomCua(q), canThe = THE_NHOM[nhom];
    const T = await theTrang(pg);
    const tagId = T.ma[canThe.toUpperCase()];
    if (tagId == null) { dem.cho_the++; theoThe['chờ page có thẻ ' + canThe] = (theoThe['chờ page có thẻ ' + canThe] || 0) + 1; continue; }
    const c = await fetch(`https://pancake.vn/api/v1/pages/${pg}/conversations/${conv}?access_token=${TOKEN}`).then(r => r.json()).catch(() => null);
    const cv = c && (c.conversation || c);
    if (!cv || !Array.isArray(cv.tags)) { dem.loi++; console.log('  lỗi đọc hội thoại', conv); continue; }   // không ghi nhật ký -> lần sau thử lại
    const truoc = cv.tags.map(id => T.ten[id] || String(id));
    const dong = { conversation_id: conv, page_id: pg, nhom, ly_do_nhom: q.ly_do_nhom || null, the_truoc: truoc.join(', ') || null };
    const coSale = truoc.find(t => THE_SALE.test(t));
    if (coSale) { dem.bo_qua++; nk.push({ ...dong, tag_id: null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'đã có thẻ ' + coSale }); continue; }
    theoThe[canThe] = (theoThe[canThe] || 0) + 1;
    if (XEM) { dem.gan++; continue; }
    if (!T.pt) {
      const g = await fetch(`https://pages.fm/api/v1/pages/${pg}/generate_page_access_token?page_id=${pg}&access_token=${TOKEN}`, { method: 'POST' }).then(r => r.json()).catch(() => null);
      T.pt = g && g.page_access_token;
      if (!T.pt) { dem.loi++; console.log('  không lấy được token page', pg); continue; }
    }
    const r = await fetch(`https://pages.fm/api/public_api/v1/pages/${pg}/conversations/${conv}/tags?page_access_token=${T.pt}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', tag_id: tagId }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.success && Array.isArray(j.data) && j.data.map(String).includes(String(tagId))) {
      dem.gan++; nk.push({ ...dong, tag_id: tagId, tag_ten: canThe, ket: 'gan', ghi_chu: null });
    } else {
      dem.loi++; console.log('  gắn lỗi', conv, r.status, an(JSON.stringify(j)).split(T.pt).join('***').slice(0, 160));
    }
    if (nk.length >= 20) await ghi(nk.splice(0));
    await sleep(200);
  }
  await ghi(nk);
  console.log(`Gắn thẻ QC xong: ${XEM ? 'SẼ gắn' : 'đã gắn'} ${dem.gan} · bỏ qua (Sale đã xử lý: thẻ Pancake / trạng thái app) ${dem.bo_qua} · chờ page có thẻ ${dem.cho_the} · lỗi ${dem.loi}`);
  Object.entries(theoThe).forEach(([k, v]) => console.log('   ', k + ':', v));
  if (dem.loi) process.exitCode = 1;
})().catch(e => { console.error(an(e && e.message || e)); process.exit(1); });
