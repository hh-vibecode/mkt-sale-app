// Đồng bộ hoá đơn KiotViet (doanh thu THỰC NHẬN) vào Supabase bảng kiot_invoices -- thay cho sheet export
// hoá đơn Kiot làm tay mỗi tháng. Schema: supabase-schema-kiot.sql.
//
// Cần biến môi trường:
//   KIOT_CLIENT_ID, KIOT_CLIENT_SECRET -- KiotViet > Thiết lập > Kết nối API (kết nối "sieuthidotho285")
//   SUPABASE_SERVICE_ROLE_KEY          -- ghi vào Supabase (bỏ qua RLS)
//
// Chạy mặc định (KHÔNG set BACKFILL): lấy hoá đơn có modifiedDate trong 3 ngày gần nhất -- bắt đủ hoá đơn mới,
// hoá đơn bị sửa, bị huỷ. BACKFILL=1: quét lại TOÀN BỘ hoá đơn từ MIN_PURCHASE_DATE.
// LƯU Ý API: lọc theo ngày bán phải truyền CẢ fromPurchaseDate LẪN toPurchaseDate, thiếu 1 trong 2 là API
// lặng lẽ bỏ qua bộ lọc và trả toàn bộ lịch sử từ 2021 (đã dò tay 15/9/2026).

const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const KIOT_RETAILER = 'sieuthidotho285';
const CLIENT_ID = process.env.KIOT_CLIENT_ID;
const CLIENT_SECRET = process.env.KIOT_CLIENT_SECRET;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKFILL = process.env.BACKFILL === '1';
const MIN_PURCHASE_DATE = '2026-06-01';
const INCREMENTAL_DAYS = 3;
const PAGE_SIZE = 100;

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

async function fetchInvoices(token, filter) {
  const headers = { Retailer: KIOT_RETAILER, Authorization: 'Bearer ' + token };
  let offset = 0, total = Infinity, all = [];
  while (offset < total) {
    const qs = new URLSearchParams({ pageSize: PAGE_SIZE, currentItem: offset, orderBy: 'purchaseDate', orderDirection: 'Asc', ...filter });
    const res = await fetch(`https://public.kiotapi.com/invoices?${qs}`, { headers });
    if (!res.ok) throw new Error(`KiotViet invoices lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    total = json.total || 0;
    const data = json.data || [];
    all = all.concat(data);
    if (!data.length) break;
    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 150));
  }
  return all;
}

// Hoá đơn KHÔNG kèm SĐT khách -- phải lấy từ danh sách khách hàng rồi gắn vào theo Mã KH. SĐT là tín hiệu
// duy nhất đối chiếu chéo được với Pancake (Pancake không có địa chỉ, tên thì 2 bên ghi khác kiểu).
async function fetchCustomerPhones(token) {
  const headers = { Retailer: KIOT_RETAILER, Authorization: 'Bearer ' + token };
  const phoneByCode = {};
  let offset = 0, total = Infinity;
  while (offset < total) {
    const qs = new URLSearchParams({ pageSize: PAGE_SIZE, currentItem: offset });
    const res = await fetch(`https://public.kiotapi.com/customers?${qs}`, { headers });
    if (!res.ok) throw new Error(`KiotViet customers lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    total = json.total || 0;
    const data = json.data || [];
    data.forEach(c => { if (c.code && c.contactNumber) phoneByCode[c.code] = c.contactNumber; });
    if (!data.length) break;
    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 120));
  }
  return phoneByCode;
}

// KiotViet trả giờ VN không kèm múi giờ ("2026-09-15T15:11:24.97") -- gắn +07:00 để Postgres không hiểu nhầm là UTC.
const vnTime = s => (s ? (/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + '+07:00') : null);

function mapInvoice(i) {
  return {
    id: i.id,
    code: i.code,
    purchase_date: vnTime(i.purchaseDate),
    branch_id: i.branchId || null,
    branch_name: i.branchName || null,
    sold_by_id: i.soldById || null,
    sold_by_name: i.soldByName || null,
    customer_id: i.customerId || null,
    customer_code: i.customerCode || null,
    customer_name: i.customerName || null,
    order_code: i.orderCode || null,
    total: i.total ?? null,
    total_payment: i.totalPayment ?? null,
    discount: i.discount ?? null,
    status: i.status ?? null,
    status_value: i.statusValue || null,
    description: i.description || null,
    items: (i.invoiceDetails || []).map(d => ({
      code: d.productCode, name: d.productName, category: d.categoryName,
      qty: d.quantity, price: d.price, discount: d.discount, subtotal: d.subTotal,
    })),
    kiot_modified_date: vnTime(i.modifiedDate),
  };
}

async function upsertInvoices(rows) {
  if (!rows.length) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/kiot_invoices?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert lỗi ${res.status}: ${(await res.text()).slice(0, 500)}`);
}

async function logSyncStart() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_log`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ source: 'KiotViet - Hoá đơn', status: 'running' }),
  });
  const data = await res.json().catch(() => null);
  return data && data[0] ? data[0].id : null;
}
async function logSyncEnd(id, { status, recordsCreated, errorMessage }) {
  if (!id) return;
  await fetch(`${SUPABASE_URL}/rest/v1/sync_log?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ finished_at: new Date().toISOString(), status, records_created: recordsCreated || 0, records_updated: 0, error_message: errorMessage || null }),
  }).catch(e => console.warn('Ghi sync_log lỗi (bỏ qua, không chặn job chính):', e.message));
}

(async () => {
  if (!CLIENT_ID || !CLIENT_SECRET || !SERVICE_ROLE_KEY) {
    console.error('Thiếu KIOT_CLIENT_ID / KIOT_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  console.log(`Chế độ: ${BACKFILL ? 'BACKFILL từ ' + MIN_PURCHASE_DATE : 'incremental (sửa trong ' + INCREMENTAL_DAYS + ' ngày gần nhất)'}`);
  const logId = await logSyncStart().catch(e => { console.warn('logSyncStart lỗi (bỏ qua):', e.message); return null; });
  try {
    const token = await getToken();
    let filter;
    if (BACKFILL) {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      filter = { fromPurchaseDate: MIN_PURCHASE_DATE, toPurchaseDate: tomorrow };
    } else {
      const since = new Date(Date.now() - INCREMENTAL_DAYS * 86400000).toISOString().slice(0, 19);
      filter = { lastModifiedFrom: since };
    }
    const [invoices, phoneByCode] = await Promise.all([fetchInvoices(token, filter), fetchCustomerPhones(token)]);
    const rows = invoices.map(mapInvoice).filter(r => r.purchase_date && r.purchase_date.slice(0, 10) >= MIN_PURCHASE_DATE);
    rows.forEach(r => { r.customer_phone = r.customer_code ? (phoneByCode[r.customer_code] || null) : null; });
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) await upsertInvoices(rows.slice(i, i + CHUNK));
    console.log(`XONG. API trả ${invoices.length} hoá đơn, đã upsert ${rows.length} (từ ${MIN_PURCHASE_DATE}), ${rows.filter(r => r.customer_phone).length} dòng có SĐT khách.`);
    await logSyncEnd(logId, { status: 'success', recordsCreated: rows.length });
  } catch (e) {
    console.error('LỖI:', e.message);
    await logSyncEnd(logId, { status: 'failed', errorMessage: e.message.slice(0, 500) });
    process.exit(1);
  }
})();
