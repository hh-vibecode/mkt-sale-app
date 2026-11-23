// GẮN THẺ KHÁCH PANCAKE THEO ĐÁNH GIÁ QC — CHỈ 1 LẦN LÚC ĐẦU (anh Hải 23/11/2026).
//   "m chỉ cần gắn thẻ tiềm năng vs đạt trên pancake lúc đầu thôi, thống nhất vs qc", "chấm trên pancake á, còn nó chấm nội dung tin nhắn",
//   "để sale tự đổi trạng thái ... sale đổi trong app thì m ghi nhận là được", "chạy trước đi", "cái gắn thẻ này cũng xử lý từ tháng 11 thôi".
// SỬA 23/11 ~09:45 (anh: "m nhầm thẻ rồi", "thẻ m gắn lead bt ở đâu, thẻ kh cơ mà"): gắn THẺ KHÁCH (khách POS, shop_customer.tags —
//   cùng chỗ Sale gắn LEAD ĐẠT / LEAD TIỀM NĂNG), KHÔNG phải thẻ hội thoại. 20 thẻ hội thoại LEAD ĐẠT gắn nhầm sáng 23/11 đã gỡ hết.
// Nguồn: view qc_khach_tiem_nang_ngay (app QC, 2 lượt chấm / ngày 12h–14h & 20h–22h VN), chỉ dòng ngay >= 1/11/2026. Nhóm (anh chốt 23/11):
//   TIỀM NĂNG = chua_khai_thac, nhom 'tiem_nang', hoặc "Khách dừng" (im lâu vẫn để Sale chăm lại) -> thẻ khách "LEAD TIỀM NĂNG"
//   ĐẠT = phần còn lại (chê giá / không đúng hàng / từ chối, kể cả "Khách từ chối hẳn" — anh: "tính đạt") -> thẻ khách "LEAD ĐẠT"
// Luật gắn:
//   - Mỗi hội thoại xử lý ĐÚNG 1 LẦN (bảng pancake_gan_the_qc); sau đó Sale tự đổi, job không gắn / gỡ lại.
//   - TRẠNG THÁI SALE ƯU TIÊN: khách app nối được mà Sale đã chốt / chọn Phân loại khác Lead mới & Tiềm năng -> bỏ qua; Sale chọn
//     "Tiềm năng, chưa ra đơn" -> LEAD TIỀM NĂNG dù QC xếp đạt. Khách POS đã có thẻ CHỐT ĐƠN / LEAD KO ĐẠT / *TIỀM NĂNG* (hoặc LEAD ĐẠT khi
//     cần gắn đạt) -> bỏ qua.
//   - Thẻ nằm ở KHÁCH POS -> hội thoại phải có đơn Pancake (datahub_orders.conversation_id). Chưa có đơn -> để lần sau (không ghi nhật ký).
//   - PUT tags GHI ĐÈ cả bộ -> đọc shop_customer.tags của đơn ngay trước khi ghi, chỉ THÊM 1 thẻ (bài học 30/9: đọc customer.tags rỗng là mất thẻ).
//   - Ghi xong cập nhật luôn datahub_orders.customer_tags của đơn đó (như pancake-note) để app thấy ngay.
// Lịch: bước trong sync-datahub.yml (10 phút / lần) nhưng chỉ làm việc lúc 14h và 22h giờ VN (ngay sau lượt chấm của QC); CHAY_NGAY=1 bỏ khung giờ.
// KHO=1: chạy thử, chỉ in số, không gắn / không ghi.
const fs = require('fs'), path = require('path');
const { sbAll } = require('./lib/sb');
const KEYS = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8'); } catch (e) { return ''; } })();
const TOKEN = process.env.PANCAKE_SESSION_TOKEN || (KEYS.match(/PANCAKE_SESSION_TOKEN[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (KEYS.match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const SB = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const XEM = process.env.KHO === '1';
const TU_NGAY = '2026-11-01';
const THE_NHOM = { tiem_nang: 'LEAD TIỀM NĂNG', dat: 'LEAD ĐẠT' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const an = s => String(s || '').split(TOKEN || '\u0000').join('***');
const pos = p => `https://pos.pages.fm/api/v1/${p}${p.includes('?') ? '&' : '?'}access_token=${TOKEN}`;

function vmTT(ctx, r) { ctx.__r = r; return require('vm').runInContext('rptSlLocTT(__r)', ctx); }
function nhomCua(q) {
  if (q.chua_khai_thac === true || q.nhom === 'tiem_nang' || /^Khách dừng/i.test(q.ly_do_nhom || '')) return 'tiem_nang';
  return 'dat';
}
// thẻ khách POS đã có -> Sale / hệ thống đã xếp, không gắn đè
function daXep(tags, nhom) {
  const t = tags.map(x => String(x).toUpperCase());
  const co = re => t.find(x => re.test(x));
  return co(/CHỐT ĐƠN/) || co(/LEAD KO ĐẠT/) || co(/TIỀM NĂNG/) || (nhom === 'dat' ? co(/^LEAD ĐẠT$/) : null);
}

(async () => {
  if (!TOKEN || !KHOA) { console.error('Thiếu PANCAKE_SESSION_TOKEN / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const gioVN = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  if (process.env.CHAY_NGAY !== '1' && ![14, 22].includes(gioVN)) { console.log('Gắn thẻ QC: ngoài khung 14h / 22h VN (giờ VN ' + gioVN + 'h) — bỏ qua'); return; }

  const view = await sbAll(SB, KHOA, 'qc_khach_tiem_nang_ngay', 'select=ngay,page_id,pancake_conversation_id,ten_khach,nhom,ly_do_nhom,chua_khai_thac&ngay=gte.' + TU_NGAY + '&order=pancake_conversation_id');
  const da = new Set((await sbAll(SB, KHOA, 'pancake_gan_the_qc', 'select=conversation_id&order=conversation_id')).map(r => r.conversation_id));
  const moi = view.filter(q => q.page_id && q.pancake_conversation_id && !da.has(q.pancake_conversation_id));
  console.log(`Gắn thẻ QC: view ${view.length} hội thoại · đã xử lý trước ${da.size} · mới ${moi.length}${XEM ? ' (KHO=1: chạy thử)' : ''}`);
  if (!moi.length) return;

  // đơn Pancake của hội thoại (mới nhất) -> shop + order
  const donCua = {};
  (await sbAll(SB, KHOA, 'datahub_orders', 'select=shop_id,order_id,conversation_id,order_date&conversation_id=not.is.null&order=order_date.desc'))
    .forEach(o => { if (!donCua[o.conversation_id]) donCua[o.conversation_id] = o; });
  const coDon = moi.filter(q => donCua[q.pancake_conversation_id]);
  const dem = { gan: 0, bo_qua: 0, loi: 0, chua_don: moi.length - coDon.length }, theoThe = {}, nk = [];
  if (!coDon.length) { console.log(`Gắn thẻ QC xong: không hội thoại nào có đơn Pancake · chờ có đơn ${dem.chua_don}`); return; }

  // trạng thái Sale trên app (ưu tiên)
  const ttApp = {};
  {
    const { napApp, masterCua } = require('./lib/nap-app');
    const ctx = await napApp();
    for (const L of ['Lẻ', 'Sỉ']) masterCua(ctx, L).forEach(r => {
      const tt = r.isChot ? 'Đã ra đơn' : vmTT(ctx, r);
      [].concat((r.orders || []).map(o => o && o.conversation_id), r.convId, (r.mergedRows || []).map(m => m.convId)).filter(Boolean)
        .forEach(c => { if (!ttApp[c]) ttApp[c] = tt; });
    });
  }
  const ghi = async rows => {
    if (XEM || !rows.length) return;
    const r = await fetch(`${SB}/rest/v1/pancake_gan_the_qc?on_conflict=conversation_id`, { method: 'POST',
      headers: { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(rows) });
    if (!r.ok) throw new Error('Ghi nhật ký lỗi ' + r.status + ' ' + (await r.text()).slice(0, 200));
  };

  for (const q of coDon) {
    const pg = q.page_id, conv = q.pancake_conversation_id, d = donCua[conv], tt = ttApp[conv] || '';
    const dong = { conversation_id: conv, page_id: pg, ly_do_nhom: q.ly_do_nhom || null, tag_id: null };
    if (tt && !['Lead mới', 'Tiềm năng, chưa ra đơn', '(chưa cập nhật)'].includes(tt)) {
      dem.bo_qua++; nk.push({ ...dong, nhom: nhomCua(q), the_truoc: null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'Sale đã xử lý trên app: ' + tt }); continue;
    }
    const nhom = tt === 'Tiềm năng, chưa ra đơn' ? 'tiem_nang' : nhomCua(q), canThe = THE_NHOM[nhom];
    const j = await fetch(pos(`shops/${d.shop_id}/orders/${d.order_id}`)).then(r => r.json()).catch(() => null);
    const don = j && (j.data || j), cid = don && don.customer && don.customer.id;
    const cu = (don && don.customer && don.customer.shop_customer && don.customer.shop_customer.tags) || null;
    if (!cid || !Array.isArray(cu)) { dem.loi++; console.log('  không đọc được khách của đơn', d.shop_id, d.order_id); continue; }   // lần sau thử lại
    const ghiChu = daXep(cu, nhom);
    if (ghiChu) { dem.bo_qua++; nk.push({ ...dong, nhom, the_truoc: cu.join(', ') || null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'khách đã có thẻ ' + ghiChu }); continue; }
    theoThe[canThe] = (theoThe[canThe] || 0) + 1;
    if (XEM) { dem.gan++; continue; }
    const moiThe = [...cu, canThe];
    const r = await fetch(pos(`shops/${d.shop_id}/customers/${cid}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { tags: moiThe } }) });
    if (!r.ok) { dem.loi++; console.log('  gắn lỗi', conv, r.status, an((await r.text()).slice(0, 160))); continue; }
    dem.gan++; nk.push({ ...dong, nhom, the_truoc: cu.join(', ') || null, tag_ten: canThe + ' (thẻ khách POS ' + d.shop_id + '/' + cid + ')', ket: 'gan', ghi_chu: null });
    await fetch(`${SB}/rest/v1/datahub_orders?shop_id=eq.${d.shop_id}&order_id=eq.${d.order_id}`, { method: 'PATCH',
      headers: { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ customer_tags: moiThe.join(', ') }) }).catch(() => null);
    if (nk.length >= 20) await ghi(nk.splice(0));
    await sleep(200);
  }
  await ghi(nk);
  console.log(`Gắn thẻ QC xong: ${XEM ? 'SẼ gắn' : 'đã gắn'} ${dem.gan} · bỏ qua (Sale đã xử lý: thẻ khách / trạng thái app) ${dem.bo_qua} · chờ có đơn Pancake ${dem.chua_don} · lỗi ${dem.loi}`);
  Object.entries(theoThe).forEach(([k, v]) => console.log('   ', k + ':', v));
  if (dem.loi) process.exitCode = 1;
})().catch(e => { console.error(an(e && e.message || e)); process.exit(1); });
