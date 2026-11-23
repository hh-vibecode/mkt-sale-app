// TỰ TẠO ĐƠN + GẮN THẺ KHÁCH PANCAKE THEO ĐÁNH GIÁ QC — MỖI HỘI THOẠI 1 LẦN LÚC ĐẦU (anh Hải 23/11/2026).
//   "m chỉ cần gắn thẻ tiềm năng vs đạt trên pancake lúc đầu thôi", "chấm trên pancake á, còn nó chấm nội dung tin nhắn",
//   "để sale tự đổi trạng thái ... sale đổi trong app thì m ghi nhận là được", "cái gắn thẻ này cũng xử lý từ tháng 11 thôi",
//   "m nhầm thẻ rồi ... thẻ kh cơ mà" (thẻ KHÁCH POS, không phải thẻ hội thoại),
//   THÔNG BÁO NHÂN VIÊN 23/11 09:53: "từ hôm nay mọi người không cần gắn thẻ hay tạo đơn gì trên pancake nữa, phần đấy e sẽ tự xử lý"
//   -> anh: "từ hôm nay m tự tạo đơn, gắn sỉ lẻ, tiềm năng vs đạt trên pancake luôn", "m tự gắn sỉ lẻ cho data mới từ hôm nay, cái nào
//   sale gắn thì thôi, ưu tiên dữ liệu của sale".
// Nguồn: view qc_khach_tiem_nang_ngay (app QC, 2 lượt chấm / ngày 12h–14h & 20h–22h VN), dòng ngay >= 1/11/2026.
//   TIỀM NĂNG = chua_khai_thac, nhom 'tiem_nang', hoặc "Khách dừng" -> thẻ khách "LEAD TIỀM NĂNG"
//   ĐẠT = phần còn lại -> thẻ khách "LEAD ĐẠT"
//   SỈ / LẺ = cột loai_khach của QC ('si' -> KH SỈ, còn lại KH LẺ) — CHỈ gắn khi khách chưa có KH SỈ / KH LẺ (Sale gắn rồi thì giữ).
// Mỗi hội thoại (chưa có trong nhật ký pancake_gan_the_qc):
//   1. Sale đã xử lý trên app (đã chốt / Phân loại khác Lead mới & Tiềm năng) -> bỏ qua hết. Sale chọn "Tiềm năng, chưa ra đơn" -> LEAD TIỀM NĂNG.
//   2. CHƯA CÓ ĐƠN Pancake -> TẠO 1 ĐƠN TRẮNG (trạng thái Mới) trên shop của page, nối conversation + khách FB, SĐT nếu QC có; ghi luôn
//      Sale gán tay = Sale QC ghi (saleretail_manual.si_sale) để khách về đúng người đang chat. KHÔNG nhắn gì cho khách.
//      Không tạo: "Khách từ chối hẳn" (nhóm bỏ qua), page không có shop POS (TikTok). Chống trùng: hội thoại đã có đơn trong hub, đã có
//      trong nhật ký job tạo đơn từ SĐT (pancake_tu_tao_don), hoặc Pancake báo hội thoại vừa có đơn (recent_orders) -> không tạo.
//   3. Thẻ khách POS: đọc shop_customer.tags NGAY TRƯỚC khi ghi (PUT ghi đè cả bộ — bài học 30/9), chỉ THÊM: KH SỈ / KH LẺ nếu thiếu;
//      LEAD TIỀM NĂNG / LEAD ĐẠT nếu khách chưa có CHỐT ĐƠN / LEAD KO ĐẠT / *TIỀM NĂNG* (hoặc LEAD ĐẠT khi gắn đạt). Cập nhật luôn
//      datahub_orders.customer_tags của đơn (như pancake-note) để app thấy ngay.
// Lịch: bước trong sync-datahub.yml (10 phút / lần, có concurrency) nhưng chỉ làm việc lúc 14h và 22h giờ VN; CHAY_NGAY=1 bỏ khung giờ.
// KHO=1: chạy thử, chỉ in số. GIOI_HAN=n: chỉ xử lý n hội thoại (thử từng ít một).
const fs = require('fs'), path = require('path');
const { sbAll } = require('./lib/sb');
const KEYS = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8'); } catch (e) { return ''; } })();
const TOKEN = process.env.PANCAKE_SESSION_TOKEN || (KEYS.match(/PANCAKE_SESSION_TOKEN[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (KEYS.match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const SB = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const XEM = process.env.KHO === '1';
const GIOI_HAN = Number(process.env.GIOI_HAN || 0) || Infinity;
const TU_NGAY = '2026-11-01';
const THE_NHOM = { tiem_nang: 'LEAD TIỀM NĂNG', dat: 'LEAD ĐẠT' };
// page Facebook -> shop POS (giống scripts/tu-tao-don-hoi-thoai.js)
const PAGE_SHOP = { '506247572578559': 1943052948, '107224335550589': 1022031789, '105133802417722': 1943096391, '107792638827892': 715061393, '100667699549693': 408040224 };
const SHOP_CODE = { 1022031789: 'CT', 1943057093: 'CT2', 100965386: 'CT3', 1021966905: 'CT4', 1943096391: 'HT', 715061393: 'HT2', 408077426: 'HT3', 1943052948: 'SD', 408040224: 'TTV', 1329071685: 'CTT' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const an = s => String(s || '').split(TOKEN || '\u0000').join('***');
const pos = p => `https://pos.pages.fm/api/v1/${p}${p.includes('?') ? '&' : '?'}access_token=${TOKEN}`;
const HSB = { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json' };
async function lay(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) return null; } catch (e) { /* thử lại */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
function vmTT(ctx, r) { ctx.__r = r; return require('vm').runInContext('rptSlLocTT(__r)', ctx); }
function nhomCua(q) {
  if (q.chua_khai_thac === true || q.nhom === 'tiem_nang' || /^Khách dừng/i.test(q.ly_do_nhom || '')) return 'tiem_nang';
  return 'dat';
}
function daXep(tags, nhom) {   // thẻ trạng thái khách đã có -> không gắn LEAD
  const t = tags.map(x => String(x).toUpperCase().trim());
  return t.find(x => /CHỐT ĐƠN/.test(x)) || t.find(x => /LEAD KO ĐẠT/.test(x)) || t.find(x => /TIỀM NĂNG/.test(x)) || (nhom === 'dat' ? t.find(x => x === 'LEAD ĐẠT') : null);
}
const coSiLe = tags => tags.some(x => /^KH (SỈ|LẺ)$/i.test(String(x).trim()));

(async () => {
  if (!TOKEN || !KHOA) { console.error('Thiếu PANCAKE_SESSION_TOKEN / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const gioVN = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  if (process.env.CHAY_NGAY !== '1' && ![14, 22].includes(gioVN)) { console.log('Gắn thẻ QC: ngoài khung 14h / 22h VN (giờ VN ' + gioVN + 'h) — bỏ qua'); return; }

  const view = await sbAll(SB, KHOA, 'qc_khach_tiem_nang_ngay', 'select=ngay,page_id,pancake_conversation_id,ten_khach,sdt,sale,nhom,ly_do_nhom,chua_khai_thac,loai_khach&ngay=gte.' + TU_NGAY + '&order=pancake_conversation_id');
  // GHI BÙ SALE cho đơn job đã tạo: lúc tạo Pancake chưa trả số đơn (system_id) -> chờ đơn về hub rồi ghi Sale gán tay = Sale QC
  // vào saleretail_manual (lead_id L-<shop>-<system_id>), chỉ khi dòng chưa có Sale gán tay (Sale / admin gán rồi thì giữ).
  // + NGÀY TẠO = NGÀY KHÁCH NHẮN (anh Hải 23/11/2026, ảnh Master toàn 23/11 kèm thẻ AI: "ngày tạo của AI cho chuẩn với ngày khách nhắn"):
  //   ghi saleretail_manual.ngay_tao_sua = ngày mở hội thoại (inserted_at Pancake, UTC -> giờ VN), chỉ khi ô còn trống.
  {
    const cho = await sbAll(SB, KHOA, 'pancake_gan_the_qc', 'select=conversation_id,page_id,shop_id,order_id,sale_gan,ngay_nhan&order_id=not.is.null&or=(sale_gan.is.null,ngay_nhan.is.null)&order=conversation_id');
    const saleCua = {}; view.forEach(q => { saleCua[q.pancake_conversation_id] = q.sale; });
    let bu = 0, buNgay = 0;
    for (const x of cho) {
      if (XEM) continue;
      const sale = saleCua[x.conversation_id];
      const o = (await sbAll(SB, KHOA, 'datahub_orders', 'select=system_id&shop_id=eq.' + x.shop_id + '&order_id=eq.' + x.order_id))[0];
      if (!o || !o.system_id || !SHOP_CODE[x.shop_id]) continue;   // đơn chưa về hub -> lượt sau
      const lead = 'L-' + SHOP_CODE[x.shop_id] + '-' + String(o.system_id).padStart(4, '0');
      const cu = (await sbAll(SB, KHOA, 'saleretail_manual', 'select=si_sale,ngay_tao_sua&lead_id=eq.' + encodeURIComponent(lead)))[0] || {};
      let ngay = x.ngay_nhan;
      if (!ngay) {
        const c = await lay(`https://pancake.vn/api/v1/pages/${x.page_id}/conversations/${x.conversation_id}?access_token=${TOKEN}`);
        const ins = c && (c.conversation || c).inserted_at;
        if (ins) ngay = new Date(Date.parse(/Z|[+-]\d\d:?\d\d$/.test(ins) ? ins : ins + 'Z') + 7 * 3600e3).toISOString().slice(0, 10);
      }
      const ghiM = {};
      if (sale && !cu.si_sale && !x.sale_gan) ghiM.si_sale = sale;
      if (ngay && !cu.ngay_tao_sua) ghiM.ngay_tao_sua = ngay;
      if (Object.keys(ghiM).length) {
        const r = await fetch(`${SB}/rest/v1/saleretail_manual?on_conflict=lead_id`, { method: 'POST', headers: { ...HSB, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ lead_id: lead, ...ghiM, updated_by: 'Monsieur Claude (QC)', updated_at: new Date().toISOString() }]) });
        if (!r.ok) { console.log('  ghi Sale / ngày lỗi', lead, r.status); continue; }
        if (ghiM.si_sale) bu++; if (ghiM.ngay_tao_sua) buNgay++;
      }
      const capNhat = {};
      if (!x.sale_gan) capNhat.sale_gan = cu.si_sale ? 'giữ ' + cu.si_sale : (sale || '(QC không ghi Sale)');
      if (!x.ngay_nhan && ngay) capNhat.ngay_nhan = ngay;
      if (Object.keys(capNhat).length) await fetch(`${SB}/rest/v1/pancake_gan_the_qc?conversation_id=eq.${encodeURIComponent(x.conversation_id)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify(capNhat) });
      await sleep(150);
    }
    if (cho.length) console.log(`Ghi bù cho đơn job tạo: Sale ${bu} · ngày khách nhắn ${buNgay} / ${cho.length} dòng chờ`);
  }
  const da = new Set((await sbAll(SB, KHOA, 'pancake_gan_the_qc', 'select=conversation_id&order=conversation_id')).map(r => r.conversation_id));
  const moi = view.filter(q => q.page_id && q.pancake_conversation_id && !da.has(q.pancake_conversation_id)).slice(0, GIOI_HAN);
  console.log(`Gắn thẻ QC: view ${view.length} hội thoại · đã xử lý trước ${da.size} · lượt này ${moi.length}${XEM ? ' (KHO=1: chạy thử)' : ''}`);
  if (!moi.length) return;

  const donCua = {};
  (await sbAll(SB, KHOA, 'datahub_orders', 'select=shop_id,order_id,conversation_id,order_date&conversation_id=not.is.null&order=order_date.desc'))
    .forEach(o => { if (!donCua[o.conversation_id]) donCua[o.conversation_id] = o; });
  const jobSdt = new Set((await sbAll(SB, KHOA, 'pancake_tu_tao_don', 'select=conversation_id&conversation_id=not.is.null&order=conversation_id')).map(r => r.conversation_id));

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
  const nk = [];
  const ghi = async rows => {
    if (XEM || !rows.length) return;
    const r = await fetch(`${SB}/rest/v1/pancake_gan_the_qc?on_conflict=conversation_id`, { method: 'POST',
      headers: { ...HSB, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    if (!r.ok) throw new Error('Ghi nhật ký lỗi ' + r.status + ' ' + (await r.text()).slice(0, 200));
  };
  const dem = { tao_don: 0, gan_lead: 0, gan_sile: 0, bo_qua: 0, cho: 0, loi: 0 }, theoThe = {};
  const cong = k => { theoThe[k] = (theoThe[k] || 0) + 1; };

  for (const q of moi) {
    const pg = q.page_id, conv = q.pancake_conversation_id, tt = ttApp[conv] || '';
    const dong = { conversation_id: conv, page_id: pg, ly_do_nhom: q.ly_do_nhom || null, tag_id: null, shop_id: null, order_id: null, the_si_le: null };
    if (tt && !['Lead mới', 'Tiềm năng, chưa ra đơn', '(chưa cập nhật)'].includes(tt)) {
      dem.bo_qua++; nk.push({ ...dong, nhom: nhomCua(q), the_truoc: null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'Sale đã xử lý trên app: ' + tt }); continue;
    }
    const nhom = tt === 'Tiềm năng, chưa ra đơn' ? 'tiem_nang' : nhomCua(q), canThe = THE_NHOM[nhom];
    const theSiLe = q.loai_khach === 'si' ? 'KH SỈ' : 'KH LẺ';
    let d = donCua[conv], taoMoi = null;

    // ── 2. chưa có đơn -> tạo đơn trắng ──
    if (!d) {
      const shop = PAGE_SHOP[pg];
      if (q.ly_do_nhom === 'Khách từ chối hẳn') { dem.bo_qua++; nk.push({ ...dong, nhom, the_truoc: null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'từ chối hẳn — không tạo đơn' }); continue; }
      if (!shop) { dem.bo_qua++; nk.push({ ...dong, nhom, the_truoc: null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'page không có shop POS (TikTok / chưa nối)' }); continue; }
      if (jobSdt.has(conv)) { dem.cho++; continue; }   // job SĐT vừa tạo đơn, hub chưa kịp về -> lượt sau
      // KHOÁ TẠO ĐƠN tới khi anh Hải duyệt số lô đầu (luật "tạo đơn Pancake hàng loạt: chạy thử, báo số trước"; QC nhắc 23/11).
      // Bật: env TAO_DON=1 (workflow) sau khi anh đồng ý. Chưa bật -> hội thoại chưa có đơn để "chờ", không ghi nhật ký.
      if (process.env.TAO_DON !== '1' && !XEM) { dem.cho++; continue; }
      const c = await lay(`https://pancake.vn/api/v1/pages/${pg}/conversations/${conv}?access_token=${TOKEN}`);
      const cv = c && (c.conversation || c), kh = ((cv && cv.customers) || [])[0] || {};
      if (!cv || !kh.id) { dem.loi++; console.log('  không đọc được hội thoại', conv); continue; }
      const m = await lay(`https://pancake.vn/api/v1/pages/${pg}/conversations/${conv}/messages?customer_id=${kh.id}&access_token=${TOKEN}`);
      if (((m && m.recent_orders) || []).length) { dem.cho++; continue; }   // Sale vừa tạo đơn, hub chưa về -> lượt sau xét lại
      const psid = String(cv.from_psid || kh.fb_id || '').replace(/^\d+_/, '');
      const ten = kh.name || q.ten_khach || 'Khách FB';
      const so = (String(q.sdt || '').match(/(?:\+?84|0)[35789]\d{8}/) || [])[0] || '';
      cong('tạo đơn ' + (SHOP_CODE[shop] || shop));
      if (XEM) { dem.tao_don++; cong(theSiLe); cong(canThe); continue; }
      const than = { bill_full_name: ten, page_id: pg, conversation_id: conv, note: 'Tạo tự động theo đánh giá QC (AI) — app MKT/Sale', items: [] };
      if (so) than.bill_phone_number = so;
      if (/^\d+$/.test(psid)) than.customer = { name: ten, fb_id: pg + '_' + psid, ...(so ? { phone_numbers: [so] } : {}) };
      const r = await fetch(pos(`shops/${shop}/orders`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(than) });
      const j = await r.json().catch(() => ({})), od = j.data || {};
      if (!od.id) { dem.loi++; console.log('  tạo đơn lỗi', conv, r.status, an(JSON.stringify(j)).slice(0, 160)); continue; }
      dem.tao_don++;
      taoMoi = { shop, id: String(od.id), sys: od.system_id };
      d = { shop_id: shop, order_id: String(od.id) };
      // Sale gán tay = Sale QC: ghi ở bước GHI BÙ SALE đầu lượt sau (Pancake chưa trả system_id lúc tạo)
      await sleep(400);
    }

    // ── 3. thẻ khách POS ──
    if (XEM && !taoMoi) {   // chạy thử: đọc thẻ thật để đếm đúng
      const jj = await lay(pos(`shops/${d.shop_id}/orders/${d.order_id}`)); const dd = jj && (jj.data || jj);
      const cu = (dd && dd.customer && dd.customer.shop_customer && dd.customer.shop_customer.tags) || [];
      const x = daXep(cu, nhom);
      if (x && coSiLe(cu)) { dem.bo_qua++; continue; }
      if (!coSiLe(cu)) { dem.gan_sile++; cong(theSiLe); }
      if (!x) { dem.gan_lead++; cong(canThe); }
      continue;
    }
    const jj = await lay(pos(`shops/${d.shop_id}/orders/${d.order_id}`));
    const don = jj && (jj.data || jj), cid = don && don.customer && don.customer.id;
    const cu = (don && don.customer && don.customer.shop_customer && don.customer.shop_customer.tags) || (taoMoi ? [] : null);
    if (!cid || !Array.isArray(cu)) {
      dem.loi++; console.log('  không đọc được khách của đơn', d.shop_id, d.order_id);
      if (taoMoi) nk.push({ ...dong, nhom, shop_id: taoMoi.shop, order_id: taoMoi.id, the_truoc: null, tag_ten: null, ket: 'loi', ghi_chu: 'đã tạo đơn, chưa gắn được thẻ' });
      continue;
    }
    const x = daXep(cu, nhom), them = [];
    if (!coSiLe(cu)) them.push(theSiLe);
    if (!x) them.push(canThe);
    if (!them.length) { dem.bo_qua++; nk.push({ ...dong, nhom, shop_id: d.shop_id, the_truoc: cu.join(', ') || null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'khách đã có thẻ ' + x }); continue; }
    const moiThe = [...cu, ...them];
    const r = await fetch(pos(`shops/${d.shop_id}/customers/${cid}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { tags: moiThe } }) });
    if (!r.ok) {
      dem.loi++; console.log('  gắn thẻ lỗi', conv, r.status, an((await r.text()).slice(0, 160)));
      if (taoMoi) nk.push({ ...dong, nhom, shop_id: taoMoi.shop, order_id: taoMoi.id, the_truoc: null, tag_ten: null, ket: 'loi', ghi_chu: 'đã tạo đơn, gắn thẻ lỗi ' + r.status });
      continue;
    }
    if (them.includes(theSiLe)) { dem.gan_sile++; cong(theSiLe); }
    if (!x) { dem.gan_lead++; cong(canThe); }
    nk.push({ ...dong, nhom, shop_id: d.shop_id, order_id: taoMoi ? taoMoi.id : null, the_si_le: them.includes(theSiLe) ? theSiLe : null,
      the_truoc: cu.join(', ') || null, tag_ten: x ? null : canThe + ' (khách POS ' + d.shop_id + '/' + cid + ')', ket: 'gan', ghi_chu: x ? 'LEAD bỏ qua: khách đã có ' + x : null });
    await fetch(`${SB}/rest/v1/datahub_orders?shop_id=eq.${d.shop_id}&order_id=eq.${d.order_id}`, { method: 'PATCH',
      headers: { ...HSB, Prefer: 'return=minimal' }, body: JSON.stringify({ customer_tags: moiThe.join(', ') }) }).catch(() => null);
    if (nk.length >= 20) await ghi(nk.splice(0));
    await sleep(200);
  }
  await ghi(nk);
  console.log(`Gắn thẻ QC xong: ${XEM ? 'SẼ' : 'đã'} tạo đơn ${dem.tao_don} · gắn LEAD ${dem.gan_lead} · gắn Sỉ/Lẻ ${dem.gan_sile} · bỏ qua ${dem.bo_qua} · chờ lượt sau ${dem.cho} · lỗi ${dem.loi}`);
  Object.entries(theoThe).forEach(([k, v]) => console.log('   ', k + ':', v));
  if (dem.loi) process.exitCode = 1;
})().catch(e => { console.error(an(e && e.message || e)); process.exit(1); });
