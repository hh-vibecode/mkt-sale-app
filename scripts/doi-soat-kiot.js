// ĐỐI SOÁT KIOT ↔ CSDL APP HẰNG TUẦN (anh Hải 08/10/2026: "đối soát cứ đêm cuối tuần cà lại 1 lần").
// Chạy SAU 2 bước kéo lại toàn bộ (workflow doi-soat.yml: hoá đơn BACKFILL từ 1/1/2026 + đơn đặt hàng quét full), rồi so TỪNG MÃ:
//   - đơn đặt hàng: mọi đơn Kiot API trả về  vs  bảng kiot_orders
//   - hoá đơn từ 1/1/2026                    vs  bảng kiot_invoices
// Lệch = app thiếu mã / app thừa mã (Kiot đã xoá) / khác tiền / khác trạng thái / khác mã khách. KHÔNG tự xoá gì: chỉ ghi kết quả
// vào sync_log (source 'Đối soát Kiot (tuần)': records_created = số mã đã so, records_updated = số lệch, error_message = mô tả lệch).
// Tab Data Hub > Đối soát đọc dòng này để hiện "Soát với Kiot gần nhất".
// Lịch: GitHub cron Chủ nhật 16:00 UTC = 23:00 giờ VN. Chạy tay: Actions > Đối soát Kiot (tuần) > Run workflow.
const { fetchLai } = require('./lib/fetch-lai.js');
const fetch = (u, o) => fetchLai(u, o, { ten: require('path').basename(__filename) });
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const KIOT_RETAILER = 'sieuthidotho285';
const MOC = '2026-01-01';
const { KIOT_CLIENT_ID, KIOT_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY: SRK } = process.env;
const NGUON = 'Đối soát Kiot (tuần)';
const H = { apikey: SRK, Authorization: 'Bearer ' + SRK };

async function token() {
  const r = await fetch('https://id.kiotviet.vn/connect/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ scopes: 'PublicApi.Access', grant_type: 'client_credentials', client_id: KIOT_CLIENT_ID, client_secret: KIOT_CLIENT_SECRET }) });
  const j = await r.json(); if (!j.access_token) throw new Error('Kiot không cấp token'); return j.access_token;
}
async function kiotAll(KH, duong, them) {
  let ra = [], tu = 0;
  for (;;) {
    const qs = new URLSearchParams({ pageSize: 100, currentItem: tu, ...them });
    const j = await (await fetch(`https://public.kiotapi.com/${duong}?${qs}`, { headers: KH })).json();
    const d = j.data || []; ra = ra.concat(d); if (d.length < 100) return ra; tu += 100;
  }
}
async function dbAll(bang, chon, loc) {
  let ra = [], tu = 0;
  for (;;) {
    const j = await (await fetch(`${SUPABASE_URL}/rest/v1/${bang}?select=${chon}${loc || ''}&order=code&limit=1000&offset=${tu}`, { headers: H })).json();
    if (!Array.isArray(j)) throw new Error(bang + ': ' + JSON.stringify(j).slice(0, 120));
    ra = ra.concat(j); if (j.length < 1000) return ra; tu += 1000;
  }
}
const ngay = (s) => String(s || '').slice(0, 10);
function so(api, db, ten, truong) {
  const A = new Map(api.map((x) => [x.code, x])), D = new Map(db.map((x) => [x.code, x]));
  const thieu = api.filter((x) => !D.has(x.code)).map((x) => x.code);
  const thua = db.filter((x) => !A.has(x.code)).map((x) => x.code);
  const khac = [];
  api.forEach((x) => { const d = D.get(x.code); if (!d) return;
    const lech = truong.filter(([k, kd]) => String(x[k] ?? '') !== String(d[kd] ?? '')).map(([k]) => k);
    if (lech.length) khac.push(x.code + ' (' + lech.join(',') + ')'); });
  return { ten, api: api.length, db: db.length, thieu, thua, khac };
}
async function ghiLog(body, id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sync_log${id ? '?id=eq.' + id : ''}`, { method: id ? 'PATCH' : 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null); return Array.isArray(j) && j[0] ? j[0].id : null;
}
(async () => {
  if (!KIOT_CLIENT_ID || !KIOT_CLIENT_SECRET || !SRK) { console.error('Thiếu KIOT_CLIENT_ID / KIOT_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const id = await ghiLog({ source: NGUON, status: 'running' }).catch(() => null);
  try {
    const KH = { Retailer: KIOT_RETAILER, Authorization: 'Bearer ' + (await token()) };
    // đơn đặt hàng: API không lọc theo ngày được -> lấy hết, so hết
    const donApi = (await kiotAll(KH, 'orders', { orderBy: 'createdDate', orderDirection: 'Asc' }))
      .map((x) => ({ code: x.code, total: Number(x.total || 0), status: x.status, customer_code: x.customerCode || '' }));
    const donDb = (await dbAll('kiot_orders', 'code,total,status,customer_code')).map((x) => ({ ...x, total: Number(x.total || 0), customer_code: x.customer_code || '' }));
    // hoá đơn từ 1/1/2026: lấy theo từng tháng (API bắt buộc có cả từ ngày lẫn đến ngày)
    let hdApi = [];
    const homNay = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    for (let d = new Date(MOC + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= homNay; d.setUTCMonth(d.getUTCMonth() + 1)) {
      const tu = d.toISOString().slice(0, 10), cuoi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      hdApi = hdApi.concat(await kiotAll(KH, 'invoices', { fromPurchaseDate: tu, toPurchaseDate: cuoi + 'T23:59:59', orderBy: 'purchaseDate', orderDirection: 'Asc' }));
    }
    hdApi = hdApi.filter((x) => ngay(x.purchaseDate) >= MOC)
      .map((x) => ({ code: x.code, total: Number(x.total || 0), status: x.status, customer_code: x.customerCode || '', order_code: x.orderCode || '' }));
    const hdDb = (await dbAll('kiot_invoices', 'code,total,status,customer_code,order_code', '&purchase_date=gte.' + MOC))
      .map((x) => ({ ...x, total: Number(x.total || 0), customer_code: x.customer_code || '', order_code: x.order_code || '' }));
    const kq = [so(donApi, donDb, 'Đơn đặt hàng', [['total', 'total'], ['status', 'status'], ['customer_code', 'customer_code']]),
      so(hdApi, hdDb, 'Hoá đơn 2026', [['total', 'total'], ['status', 'status'], ['customer_code', 'customer_code'], ['order_code', 'order_code']])];
    let lech = 0; const moTa = [];
    kq.forEach((k) => {
      const n = k.thieu.length + k.thua.length + k.khac.length; lech += n;
      console.log(`${k.ten}: Kiot ${k.api} · app ${k.db} · app thiếu ${k.thieu.length} · app thừa ${k.thua.length} · khác ${k.khac.length}`);
      if (n) moTa.push(k.ten + ': ' + [k.thieu.length ? 'app thiếu ' + k.thieu.slice(0, 8).join(' ') : '', k.thua.length ? 'app thừa ' + k.thua.slice(0, 8).join(' ') : '',
        k.khac.length ? 'khác ' + k.khac.slice(0, 8).join(' ') : ''].filter(Boolean).join(' · '));
    });
    await ghiLog({ finished_at: new Date().toISOString(), status: 'success', records_created: donApi.length + hdApi.length, records_updated: lech,
      error_message: moTa.length ? moTa.join(' | ').slice(0, 1500) : null }, id);
    console.log(lech ? 'CÓ ' + lech + ' MÃ LỆCH' : 'Khớp từng mã.');
  } catch (e) {
    await ghiLog({ finished_at: new Date().toISOString(), status: 'failed', error_message: String(e.message).slice(0, 500) }, id);
    console.error('LOI', e.message); process.exit(1);
  }
})();
