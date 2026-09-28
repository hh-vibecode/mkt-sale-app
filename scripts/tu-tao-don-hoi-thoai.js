// TỰ TẠO ĐƠN PANCAKE + GẮN THẺ cho khách để lại SĐT trong hội thoại (anh Hải 28/9/2026:
// "bắt đầu từ hôm nay khách sỉ hay lẻ có số đt cứ tự gắn thẻ xong đẩy về app").
// Chạy TRƯỚC bước đồng bộ Pancake trong sync-datahub.yml -> đơn vừa tạo về app ngay lượt đó.
//
// Quét hội thoại FACEBOOK (inbox + bình luận) có cập nhật từ 28/9/2026 trên các page có shop POS.
// Zalo cá nhân KHÔNG làm (công Sale). Với mỗi hội thoại có SĐT hợp lệ:
//   - SĐT đã có ở bất kỳ đâu (app, Kiot, đơn Pancake cũ ở 1 trong 10 shop) = KHÁCH CŨ -> không tạo gì,
//     chỉ gắn thẻ KH SỈ / KH LẺ nếu khách POS cũ còn thiếu thẻ ("trùng có data rồi thì đừng sờ").
//   - Còn lại = KHÁCH MỚI -> tạo 1 đơn trắng (trạng thái Mới) trên shop của page, nối đúng hội thoại, gắn thẻ:
//     thẻ hội thoại có KH SỈ / KH LẺ thì theo đó, không thì page Shidai = KH SỈ, page khác = KH LẺ.
//     Khách Sỉ ghi luôn phân loại "Lead mới" (chưa gán Sale -> tab Gán data). KHÔNG nhắn gì cho khách.
//   - 1 hội thoại nhiều SĐT = 1 khách, 1 đơn. 1 SĐT ở nhiều hội thoại = 1 đơn (hội thoại mới nhất).
//   - SĐT xuất hiện ở từ 3 hội thoại khác người trở lên trong lượt quét = số hotline / nhân viên -> bỏ.
// Mọi SĐT đã xử lý ghi vào bảng pancake_tu_tao_don -> lượt sau không làm lại.
// Chạy: KHO=1 để chỉ liệt kê, không tạo / không ghi.
const fs = require('fs'), path = require('path');
const { sbAll } = require('./lib/sb');

const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const KEYS = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8'); } catch (e) { return ''; } })();
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (KEYS.match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const TOKEN = process.env.PANCAKE_SESSION_TOKEN || (KEYS.match(/PANCAKE_SESSION_TOKEN[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
if (!KHOA || !TOKEN) { console.error('Thiếu SUPABASE_SERVICE_ROLE_KEY / PANCAKE_SESSION_TOKEN'); process.exit(1); }
const XEM = process.env.KHO === '1';

const MOC_BAT_DAU = Date.parse('2026-09-27T17:00:00Z');       // 00:00 ngày 28/9/2026 giờ VN
const CUA_SO = 3 * 864e5;                                     // mỗi lượt xét hội thoại cập nhật trong 3 ngày gần nhất
const SHIDAI = 1943052948;
// page Facebook -> shop POS (lấy theo đơn thật trong datahub_orders)
const PAGE_SHOP = {
  '506247572578559': SHIDAI,        // Thời Đại - Tổng Kho Sỉ (Sỉ)
  '107224335550589': 1022031789,    // Chánh Tâm
  '105133802417722': 1943096391,    // Siêu Thị Phật Giáo Hiền Thuỷ
  '107792638827892': 715061393,     // Hiền Thủy - Siêu Thị Đồ Thờ
  '100667699549693': 408040224,     // Nến Bơ - Tự Tại Viên
};
const SHOPS = [1022031789, 1943057093, 100965386, 1021966905, 1943096391, 715061393, 408077426, SHIDAI, 408040224, 1329071685];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const l9 = s => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };
const chuanSo = s => { let d = String(s || '').replace(/\D/g, ''); if (/^84\d{9}$/.test(d)) d = '0' + d.slice(2); return /^0[35789]\d{8}$/.test(d) ? d : ''; };
const utc = s => Date.parse(/Z|[+-]\d\d:?\d\d$/.test(String(s)) ? s : s + 'Z');
const H = { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json' };
const pos = p => `https://pos.pages.fm/api/v1/${p}${p.includes('?') ? '&' : '?'}access_token=${TOKEN}`;
async function lay(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) return null; } catch (e) { /* thử lại */ }
    await sleep(2000 * (i + 1));
  }
  return null;
}
async function ghiNhatKy(dong) {
  if (XEM) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/pancake_tu_tao_don?on_conflict=so`, {
    method: 'POST', headers: Object.assign({ Prefer: 'resolution=ignore-duplicates,return=minimal' }, H), body: JSON.stringify(dong) });
  if (!r.ok) console.error('  ghi nhật ký lỗi', r.status, (await r.text()).slice(0, 150));
}
const tenThe = t => typeof t === 'string' ? t : (t && (t.name || t.text)) || '';
// KHÔNG PHẢI HỎI HÀNG -> bỏ, không tạo đơn (anh Hải 28/9: "nội dung k phải hỏi hàng clear hết"). Thử trên 265 hội thoại
// lô 28/9: bắt đúng 6 ca rác (xin việc, xin làm CTV, rao dịch vụ video, người rao bán tượng/nến, tin rác vay tiền), 0 khách thật.
const RAC = /(tuyển (nhân viên|dụng|người|ctv|cộng tác)|còn tuyển|ứng tuyển|xin việc|việc làm|(làm|tuyển) cộng tác viên|cho vay|vay (vốn|tiền|nhanh|tín chấp)|giải ngân|cần là có|đến là duyệt|bên (em|mình|tôi) (có )?(sản xuất|nhận làm|chuyên cung cấp|có nhiều)|em nhận làm|nhận làm (video|web|quảng cáo|thiết kế)|shop ib (với|cho) mình|gieo duyên|lãi suất|nhận chạy (ads|quảng cáo)|thiết kế web|dạy kèm|khóa học|mong hợp tác)/i;
const nhieuSo = t => (t.match(/(?:\+?84|0)[35789](?:[\s.]?\d){8}/g) || []).length >= 3;   // 1 tin chứa từ 3 số = tin rác rao
async function laRac(h) {
  let cid = null;
  const c = await lay(`https://pancake.vn/api/v1/pages/${h.page}/conversations/${h.conv}?access_token=${TOKEN}`);
  cid = c && (((c.conversation || c).customers || c.customers || [])[0] || {}).id;
  if (!cid) return '';
  const m = await lay(`https://pancake.vn/api/v1/pages/${h.page}/conversations/${h.conv}/messages?customer_id=${cid}&access_token=${TOKEN}`);
  const kh = ((m && m.messages) || []).filter(x => String(x.from && x.from.id) !== String(h.page))
    .map(x => String(x.original_message || x.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  // Sale VỪA tạo đơn cho hội thoại này (hub chưa kịp đồng bộ, trễ tới 10 phút) -> không tạo trùng
  if (((m && m.recent_orders) || []).length) h.coDonMoi = true;
  const t = kh.find(x => RAC.test(x) || nhieuSo(x));
  // khách gửi nhiều số -> CHỈ lấy số gửi SAU CÙNG (anh Hải 28/9: số trước thường là số nhầm / số cũ)
  const so = [];
  kh.forEach(x => (x.match(/(?:\+?84|0)[35789](?:[\s.]?\d){8}/g) || []).forEach(s => { const c = chuanSo(s); if (c) so.push(c); }));
  if (so.length) h.soCuoi = so[so.length - 1];
  return t ? t.slice(0, 80) : '';
}

(async () => {
  const tu = Math.max(MOC_BAT_DAU, Date.now() - CUA_SO);
  // 1) SĐT đã có ở mọi nguồn khách
  const coRoi = new Set();
  const them = (rows, cot) => rows.forEach(r => String(r[cot] || '').split(/[,;\/\s]+/).forEach(x => { const k = l9(x); if (k) coRoi.add(k); }));
  const docSo = (t, q, cot) => sbAll(SUPABASE_URL, KHOA, t, q).then(rows => them(rows, cot));
  await Promise.all([
    docSo('datahub_orders', 'select=phone', 'phone'),
    sbAll(SUPABASE_URL, KHOA, 'datahub_orders', 'select=internal_note&internal_note=not.is.null')
      .then(rows => rows.forEach(r => (String(r.internal_note).match(/(?:\+?84|0)[35789](?:[\s.]?\d){8}/g) || []).forEach(x => { const k = l9(x); if (k) coRoi.add(k); }))),
    docSo('datahub_manual', 'select=phone', 'phone'),
    docSo('saleretail_manual', 'select=si_sdt&si_sdt=not.is.null', 'si_sdt'),
    docSo('salesi_crm', 'select=phone', 'phone'),
    docSo('kiot_customers', 'select=phone', 'phone'),
  ]);
  const daXuLy = new Set(), convDaXuLy = new Set();
  (await sbAll(SUPABASE_URL, KHOA, 'pancake_tu_tao_don', 'select=so,conversation_id')).forEach(r => { daXuLy.add(r.so); if (r.conversation_id) convDaXuLy.add(r.conversation_id); });
  const convCoDon = new Set((await sbAll(SUPABASE_URL, KHOA, 'datahub_orders', 'select=conversation_id&conversation_id=not.is.null')).map(r => r.conversation_id));

  // 2) quét hội thoại có SĐT cập nhật từ mốc
  const hoiThoai = [];
  for (const pg of Object.keys(PAGE_SHOP)) {
    const st = await lay(`https://pancake.vn/api/v1/pages/${pg}/settings?access_token=${TOKEN}`);
    const theMap = {}; ((st && st.settings && st.settings.tags) || []).forEach(t => { theMap[t.id] = t.text; });
    let n = 0, lastId = null, cuLienTiep = 0;
    for (let trang = 0; trang < 40; trang++) {
      const d = await lay(`https://pancake.vn/api/v1/pages/${pg}/conversations?access_token=${TOKEN}${n ? `&current_count=${n}` : ''}${lastId ? `&last_conversation_id=${lastId}` : ''}`);
      const cv = (d && d.conversations) || [];
      if (!cv.length) break;
      let moi = 0;
      cv.forEach(c => {
        if (utc(c.updated_at) < tu) return;
        moi++;
        const so = [...new Set((c.recent_phone_numbers || []).map(p => chuanSo(p.phone_number || p.captured)).filter(Boolean))];
        if (!so.length || !['INBOX', 'COMMENT'].includes(c.type)) return;
        const kh = (c.customers || [])[0] || {};
        hoiThoai.push({ page: pg, shop: PAGE_SHOP[pg], conv: c.id, ten: kh.name || (c.from || {}).name || '', psid: c.from_psid || kh.fb_id || '',
          so, the: (c.tags || []).map(t => theMap[t] || t).map(String), dau: c.inserted_at, cuoi: c.updated_at });
      });
      cuLienTiep = moi ? 0 : cuLienTiep + 1;
      if (cuLienTiep >= 2) break;                             // 2 trang liền toàn hội thoại cũ -> hết phần mới
      n += cv.length; lastId = cv[cv.length - 1].id;
      await sleep(250);
    }
  }
  // số xuất hiện ở >= 3 hội thoại khác người -> hotline / nhân viên
  const demNguoi = {};
  hoiThoai.forEach(h => h.so.forEach(s => { (demNguoi[s] = demNguoi[s] || new Set()).add(h.psid || h.conv); }));
  const soRac = new Set(Object.keys(demNguoi).filter(s => demNguoi[s].size >= 3));

  // 3) chia khách cũ / khách mới
  hoiThoai.sort((a, b) => utc(b.cuoi) - utc(a.cuoi));
  const daChon = new Set(), moi = [], cu = [];
  for (const h of hoiThoai) {
    h.so = h.so.filter(s => !soRac.has(s));
    if (!h.so.length || convCoDon.has(h.conv) || convDaXuLy.has(h.conv)) continue;
    if (h.so.some(s => daXuLy.has(l9(s)) || daChon.has(s))) continue;
    h.so.forEach(s => daChon.add(s));
    (h.so.some(s => coRoi.has(l9(s))) ? cu : moi).push(h);
  }
  // khách "mới" với app nhưng đã có khách POS ở 1 trong 10 shop (đơn Pancake cũ app không lưu) -> khách cũ
  for (const h of moi.slice()) {
    for (const shop of SHOPS) {
      const j = await lay(pos(`shops/${shop}/customers?search=${h.so[0]}`));
      const c = ((j && j.data) || []).find(x => (x.phone_numbers || []).some(p => l9(p) === l9(h.so[0])));
      if (c) { h.posCu = { shop, id: c.id, the: (c.tags || []).map(tenThe) }; moi.splice(moi.indexOf(h), 1); cu.push(h); break; }
      await sleep(120);
    }
  }
  // khách "mới": đọc tin khách nhắn, tin rác / xin việc / người rao bán -> bỏ, ghi nhật ký để khỏi xét lại
  const rac = [];
  for (const h of moi.slice()) {
    const ly = await laRac(h);
    if (ly) { rac.push(h); moi.splice(moi.indexOf(h), 1); h.lyRac = ly; }
    else if (h.coDonMoi) { moi.splice(moi.indexOf(h), 1); cu.push(h); }
    await sleep(120);
  }
  const theCua = h => h.the.some(t => /KH SỈ/i.test(t)) ? 'KH SỈ' : h.the.some(t => /KH LẺ/i.test(t)) ? 'KH LẺ' : h.shop === SHIDAI ? 'KH SỈ' : 'KH LẺ';
  console.log(`Hội thoại FB có SĐT cập nhật từ ${new Date(tu).toISOString().slice(0, 16)}: ${hoiThoai.length} · số hotline bỏ: ${soRac.size}`
    + ` · khách cũ: ${cu.length} · bỏ vì không phải hỏi hàng: ${rac.length} · KHÁCH MỚI tạo đơn: ${moi.length}`);
  rac.forEach(h => console.log('  bỏ', h.page, h.ten, '"' + h.lyRac + '"'));
  moi.forEach(h => console.log('  mới', h.page, h.ten, '…' + h.so[0].slice(-4), theCua(h)));
  if (XEM) { console.log('(KHO=1: không tạo / không ghi)'); return; }
  for (const h of rac) await ghiNhatKy({ so: l9(h.so[0]), page_id: h.page, conversation_id: h.conv, ten: h.ten, nhan_dau: h.dau,
    loi: 'bỏ: không phải hỏi hàng - "' + h.lyRac + '"' });

  // 4) khách cũ: chỉ gắn thẻ bù nếu khách POS thiếu thẻ KH SỈ / KH LẺ, ghi nhật ký để khỏi xét lại
  let theBu = 0;
  for (const h of cu) {
    let ghiChu = 'khách cũ: đã có trong app/Kiot';
    if (h.posCu && !h.posCu.the.some(t => /KH SỈ|KH LẺ/i.test(t))) {
      const the = h.posCu.shop === SHIDAI ? 'KH SỈ' : theCua(h);
      const r = await fetch(pos(`shops/${h.posCu.shop}/customers/${h.posCu.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: { tags: [...h.posCu.the, the] } }) });
      ghiChu = r.ok ? 'khách cũ: gắn thẻ bù ' + the : 'khách cũ: gắn thẻ bù lỗi ' + r.status;
      if (r.ok) theBu++;
    } else if (h.posCu) ghiChu = 'khách cũ: có đơn Pancake cũ, đủ thẻ';
    await ghiNhatKy({ so: l9(h.so[0]), page_id: h.page, conversation_id: h.conv, shop_id: h.posCu ? h.posCu.shop : null,
      customer_id: h.posCu ? h.posCu.id : null, ten: h.ten, nhan_dau: h.dau, loi: ghiChu });
  }

  // 5) khách mới: tạo đơn + gắn thẻ (+ "Lead mới" nếu là Sỉ)
  let ok = 0; const loi = [];
  for (const h of moi) {
    const so = h.soCuoi || h.so[0], the = theCua(h);
    const than = { bill_full_name: h.ten || so, bill_phone_number: so, page_id: h.page, conversation_id: h.conv,
      note: 'Tạo tự động từ hội thoại có SĐT — app MKT/Sale', items: [] };
    if (h.psid && /^\d+$/.test(h.psid)) than.customer = { name: h.ten || so, phone_numbers: [so], fb_id: h.page + '_' + h.psid };
    try {
      const r = await fetch(pos(`shops/${h.shop}/orders`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(than) });
      const j = await r.json().catch(() => ({})); const d = j.data || {};
      if (!d.id) {
        loi.push(so + ' tạo đơn ' + r.status);
        await ghiNhatKy({ so: l9(so), page_id: h.page, conversation_id: h.conv, shop_id: h.shop, ten: h.ten, nhan_dau: h.dau, loi: 'tạo đơn: ' + r.status + ' ' + (j.message || '') });
        continue;
      }
      const cid = d.customer && d.customer.id; let tl = null;
      if (cid) {
        const p = await fetch(pos(`shops/${h.shop}/customers/${cid}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { tags: [the] } }) });
        if (!p.ok) tl = 'gắn thẻ ' + p.status;
      } else tl = 'không có customer_id';
      await ghiNhatKy({ so: l9(so), page_id: h.page, conversation_id: h.conv, shop_id: h.shop, order_id: String(d.id), system_id: Number(d.system_id) || null,
        customer_id: cid || null, ten: h.ten, the, nhan_dau: h.dau, loi: tl });
      if (h.shop === SHIDAI && d.system_id) {
        await fetch(`${SUPABASE_URL}/rest/v1/saleretail_manual?on_conflict=lead_id`, { method: 'POST',
          headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, H),
          body: JSON.stringify([{ lead_id: 'L-SD-' + String(d.system_id).padStart(4, '0'), si_phan_loai: 'Lead mới', updated_by: 'Monsieur Claude', updated_at: new Date().toISOString() }]) });
      }
      if (tl) loi.push(so + ' ' + tl); else ok++;
    } catch (e) { loi.push(so + ' ' + e.message); }
    await sleep(250);
  }
  console.log(`XONG: tạo đơn + gắn thẻ ${ok}/${moi.length} khách mới · gắn thẻ bù ${theBu} khách cũ` + (loi.length ? ' · LỖI ' + loi.length + ': ' + loi.slice(0, 5).join(' | ') : ''));
  if (loi.length) process.exitCode = 1;
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
