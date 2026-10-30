// Đồng bộ ĐƠN ĐẶT HÀNG KiotViet vào Supabase bảng kiot_orders. Schema: supabase-schema-kiot-orders.sql.
//
// VÌ SAO LÀ ĐƠN ĐẶT HÀNG CHỨ KHÔNG PHẢI HOÁ ĐƠN:
//   Doanh số Sale ghi nhận LÚC KHÁCH CHỐT = lúc Sale tạo đơn đặt hàng bên Kiot. Hoá đơn chỉ xuất khi giao
//   hàng / thu tiền, có thể trễ nhiều ngày -> dùng hoá đơn thì doanh số bị treo tới lúc giao. Hoá đơn chỉ
//   dùng cho ĐỐI SOÁT tiền về thực tế, không dùng cho báo cáo Sale.
//   Ví dụ thật: KH007620 có đơn DH002669 18.900.000đ ngày 08/09 nhưng chưa có hoá đơn nào.
//
// Cần biến môi trường: KIOT_CLIENT_ID, KIOT_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY
//
// LƯU Ý API: endpoint /orders BỎ QUA fromPurchaseDate/toPurchaseDate (trả cả lịch sử từ 2021, đã dò 17/9/2026).
// Nên lấy theo purchaseDate GIẢM DẦN và tự dừng khi trang cũ hơn MIN_PURCHASE_DATE. Từ 1/6 chỉ ~900 đơn
// (~9 request) nên mỗi lượt quét lại toàn bộ luôn -- bắt được cả đơn cũ bị đổi trạng thái / bị huỷ.

// Gọi API qua fetchLai: lỗi mạng thoáng qua sẽ tự thử lại thay vì fail cả lượt chạy.
const { fetchLai } = require('./lib/fetch-lai.js');
const fetch = (u, o) => fetchLai(u, o, { ten: require('path').basename(__filename) });

const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const KIOT_RETAILER = 'sieuthidotho285';
const CLIENT_ID = process.env.KIOT_CLIENT_ID;
const CLIENT_SECRET = process.env.KIOT_CLIENT_SECRET;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// LẤY FULL LỊCH SỬ: báo cáo Sale Sỉ cần đơn từ những năm trước (khách buôn mua từ 2021), mà cả kho
// đơn đặt hàng chỉ ~3.100 đơn nên lấy hết vẫn nhẹ. Báo cáo Sale Lẻ tự chặn mốc 1/6/2026 ở phía app.
const MIN_PURCHASE_DATE = '2021-01-01';
const PAGE_SIZE = 100;
// 30/10/2026 (anh Hải duyệt tối ưu): lượt 15 phút chỉ lấy đơn VỪA SỬA (lastModifiedFrom, lùi 3 giờ cho chồng lấn an toàn) -- trước
// mỗi lượt kéo + ghi đè lại toàn bộ ~3.400 đơn (338 nghìn lần ghi). BACKFILL=1 (pg_cron 07:20 VN hằng ngày) mới quét toàn bộ như cũ.
// API đã thử 30/10: /orders nhận lastModifiedFrom (24h: 11 đơn / 3.402); giờ truyền là GIỜ VN.
const DAY_DU = process.env.BACKFILL === '1';
const GIO_LUI = 3;
const gioVN = msLui => new Date(Date.now() + 7 * 3600e3 - msLui).toISOString().slice(0, 19);

const vnTime = s => (s ? (/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + '+07:00') : null);

async function getToken() {
  const res = await fetch('https://id.kiotviet.vn/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ scopes: 'PublicApi.Access', grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`KiotViet token lỗi: ${JSON.stringify(json).slice(0, 200)}`);
  return json.access_token;
}

async function fetchOrders(token, since) {
  const headers = { Retailer: KIOT_RETAILER, Authorization: 'Bearer ' + token };
  let offset = 0, all = [];
  while (true) {
    const qs = new URLSearchParams(since
      ? { pageSize: PAGE_SIZE, currentItem: offset, orderBy: 'modifiedDate', orderDirection: 'Desc', includeOrderDelivery: 'true', lastModifiedFrom: since }
      : { pageSize: PAGE_SIZE, currentItem: offset, orderBy: 'purchaseDate', orderDirection: 'Desc', includeOrderDelivery: 'true' });
    const res = await fetch(`https://public.kiotapi.com/orders?${qs}`, { headers });
    if (!res.ok) throw new Error(`KiotViet orders lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()).data || [];
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    const oldest = String(data[data.length - 1].purchaseDate || '').slice(0, 10);
    if (!since && oldest && oldest < MIN_PURCHASE_DATE) break;
    offset += PAGE_SIZE;
    if (offset > 20000) throw new Error('Quét quá 20.000 đơn mà chưa tới mốc ngày -- dừng để tránh vòng lặp');
    await new Promise(r => setTimeout(r, 150));
  }
  return all;
}

// KÊNH BÁN: /orders (danh sách) KHÔNG trả về kênh bán, chỉ /orders/code/{code} mới có
// SaleChannelId / SaleChannelName. Nên mỗi lần chạy chỉ gọi chi tiết cho những đơn CHƯA có kênh
// trong Supabase (thường chỉ là đơn mới), không gọi lại cho cả 3.000 đơn cũ.
const GIOI_HAN_CHI_TIET = 400;   // trần mỗi lượt chạy, tránh job kéo dài bất thường

async function kenhDaCo(codes) {
  const m = {};
  // lượt nhanh: chỉ đọc kênh của đúng các đơn vừa sửa (trước đọc lại ~3.400 dòng mỗi 15 phút)
  if (codes) {
    for (let i = 0; i < codes.length; i += 100) {
      const ds = codes.slice(i, i + 100).map(c => '"' + String(c).replace(/"/g, '') + '"').join(',');
      const res = await fetch(`${SUPABASE_URL}/rest/v1/kiot_orders?select=code,sale_channel,sale_channel_id&sale_channel=not.is.null&code=in.(${encodeURIComponent(ds)})&limit=1000&offset=0`, {
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY } });
      if (!res.ok) throw new Error('Đọc kênh bán đã có lỗi ' + res.status);
      (await res.json()).forEach(r => { m[r.code] = { ten: r.sale_channel, id: r.sale_channel_id }; });
    }
    return m;
  }
  let offset = 0;
  for (;;) {
    // Phân trang bằng limit/offset trên URL (bộ chặn scripts/check-pagination.js chỉ nhận dạng này).
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kiot_orders?select=code,sale_channel,sale_channel_id&sale_channel=not.is.null&limit=1000&offset=${offset}`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY } });
    if (!res.ok) throw new Error('Đọc kênh bán đã có lỗi ' + res.status);
    const rows = await res.json();
    rows.forEach(r => { m[r.code] = { ten: r.sale_channel, id: r.sale_channel_id }; });
    if (rows.length < 1000) return m;
    offset += 1000;
  }
}

// Danh mục kênh bán (id -> tên) để tra khi đơn chỉ trả về id.
async function danhMucKenh(token) {
  const res = await fetch('https://public.kiotapi.com/salechannel?pageSize=100', {
    headers: { Retailer: KIOT_RETAILER, Authorization: 'Bearer ' + token } });
  const m = { 0: 'Bán trực tiếp' };
  if (res.ok) ((await res.json()).data || []).forEach(c => { m[c.id] = c.name; });
  return m;
}

async function layKenh(token, code, dm) {
  const res = await fetch(`https://public.kiotapi.com/orders/code/${encodeURIComponent(code)}`, {
    headers: { Retailer: KIOT_RETAILER, Authorization: 'Bearer ' + token } });
  if (!res.ok) return null;
  const d = await res.json();
  // KHÔNG có khoá SaleChannelId = đơn bán tại quầy, kênh id 0 "Bán trực tiếp" (đúng cách đã backfill 3.027 đơn).
  const id = d.SaleChannelId ?? d.saleChannelId ?? 0;
  return { ten: d.SaleChannelName || d.saleChannelName || dm[id] || null, id };
}

// HỎI LẠI KÊNH (anh Hải 30/10/2026, "m kéo thiếu"): trước đây kênh chỉ hỏi 1 lần lúc đơn mới vào, Sale sửa kênh trên Kiot sau đó
// (vd DH003002 / DH002865 / DH002842 / DH002835.01 "Bán trực tiếp" -> Facebook) thì bảng giữ kênh cũ mãi. Nay:
//  - lượt 15 phút: hỏi lại kênh MỌI đơn vừa sửa (vài đơn / lượt);
//  - lượt quét lại hằng ngày: hỏi lại đơn tạo trong THÁNG HIỆN TẠI (ngày 1–5 gồm cả tháng trước); Chủ nhật: mọi đơn từ 1/6/2026.
function mocHoiLaiKenh() {
  if (!DAY_DU) return null;
  const vn = new Date(Date.now() + 7 * 3600e3);
  if (vn.getUTCDay() === 0) return '2026-06-01';
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - (vn.getUTCDate() <= 5 ? 1 : 0), 1)).toISOString().slice(0, 10);
}

async function ganKenh(token, rows) {
  const daCo = await kenhDaCo(DAY_DU ? null : rows.map(r => r.code));
  const moc = mocHoiLaiKenh();
  const hoiLai = r => !DAY_DU || String(r.purchase_date || '').slice(0, 10) >= moc;
  const cu = {};Object.keys(daCo).forEach(c => { cu[c] = daCo[c].ten; });
  const thieu = rows.filter(r => !daCo[r.code]).concat(rows.filter(r => daCo[r.code] && hoiLai(r)))
    .slice(0, moc === '2026-06-01' ? 2500 : GIOI_HAN_CHI_TIET);
  if (!thieu.length) { rows.forEach(r => { const k = daCo[r.code] || {}; r.sale_channel = k.ten || null; r.sale_channel_id = k.id ?? null; }); return; }
  const dm = await danhMucKenh(token);
  let lay = 0;
  for (let i = 0; i < thieu.length; i += 5) {
    const lo = thieu.slice(i, i + 5);
    const kq = await Promise.all(lo.map(r => layKenh(token, r.code, dm).catch(() => null)));
    lo.forEach((r, k) => { if (kq[k] && kq[k].ten) { daCo[r.code] = kq[k]; lay++; } });
    await new Promise(r => setTimeout(r, 120));
  }
  // Mọi dòng đều phải có ĐỦ 2 khoá này, nếu không PostgREST báo "All object keys must match".
  // Dòng cũ lấy lại đúng giá trị đang có trong DB -> upsert không xoá mất kênh đã biết.
  rows.forEach(r => { const k = daCo[r.code] || {}; r.sale_channel = k.ten || null; r.sale_channel_id = k.id ?? null; });
  const conThieu = rows.filter(r => !r.sale_channel).length;
  const doi = thieu.filter(r => cu[r.code] && r.sale_channel && cu[r.code] !== r.sale_channel);
  console.log(`Kênh bán: gọi chi tiết ${thieu.length} đơn, lấy được ${lay}. Còn ${conThieu} đơn chưa có kênh. Kênh đổi trên Kiot: ${doi.length}`
    + (doi.length ? ' (' + doi.slice(0, 20).map(r => r.code + ' ' + cu[r.code] + ' -> ' + r.sale_channel).join('; ') + ')' : ''));
}

function mapOrder(o) {
  return {
    id: o.id,
    code: o.code,
    purchase_date: vnTime(o.purchaseDate),
    branch_name: o.branchName || null,
    sold_by_name: o.soldByName || null,
    customer_code: o.customerCode || null,
    customer_name: o.customerName || null,
    total: o.total ?? null,
    total_payment: o.totalPayment ?? null,
    status: o.status ?? null,
    status_value: o.statusValue || null,
    // địa chỉ giao hàng (29/9/2026) -> suy Tỉnh/TP của khách đã chốt
    giao_dia_chi: (o.orderDelivery && o.orderDelivery.address) || null,
    giao_khu_vuc: (o.orderDelivery && o.orderDelivery.locationName) || null,
    items: (o.orderDetails || []).map(d => ({ code: d.productCode, name: d.productName, qty: d.quantity, price: d.price })),
    modified_date: vnTime(o.modifiedDate),
    created_date: vnTime(o.createdDate),
    synced_at: new Date().toISOString(),
  };
}

const { khuTrung } = require('./lib/khu-trung.js');   // bỏ dòng trùng khoá trước khi upsert
async function upsert(rows) {
  rows = khuTrung(rows, (r) => r.id);
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kiot_orders?on_conflict=id`, {
      method: 'POST',
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`Supabase upsert kiot_orders lỗi ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
}

async function logSync(body, id) {
  const url = id ? `${SUPABASE_URL}/rest/v1/sync_log?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/sync_log`;
  const res = await fetch(url, {
    method: id ? 'PATCH' : 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res || id) return null;
  const d = await res.json().catch(() => null);
  return d && d[0] ? d[0].id : null;
}

(async () => {
  if (!CLIENT_ID || !CLIENT_SECRET || !SERVICE_ROLE_KEY) {
    console.error('Thiếu KIOT_CLIENT_ID / KIOT_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const logId = await logSync({ source: 'KiotViet - Đơn đặt hàng', status: 'running' });
  try {
    const token = await getToken();
    const since = DAY_DU ? null : gioVN(GIO_LUI * 3600e3);
    console.log(`Chế độ: ${DAY_DU ? 'quét TOÀN BỘ đơn' : 'chỉ đơn sửa từ ' + since + ' (giờ VN)'}`);
    const orders = await fetchOrders(token, since);
    const rows = orders.map(mapOrder).filter(r => r.purchase_date && r.purchase_date.slice(0, 10) >= MIN_PURCHASE_DATE);
    if (rows.length) { await ganKenh(token, rows); await upsert(rows); }
    const st = {};
    rows.forEach(r => { st[r.status_value || r.status] = (st[r.status_value || r.status] || 0) + 1; });
    console.log(`XONG. API trả ${orders.length} đơn, upsert ${rows.length} đơn từ ${MIN_PURCHASE_DATE}.`, JSON.stringify(st));
    await logSync({ finished_at: new Date().toISOString(), status: 'success', records_created: rows.length, records_updated: 0 }, logId);
  } catch (e) {
    console.error('LỖI:', e.message);
    await logSync({ finished_at: new Date().toISOString(), status: 'failed', error_message: e.message.slice(0, 500) }, logId);
    process.exit(1);
  }
})();
