// Đồng bộ đơn hàng từ Pancake POS API thẳng vào Supabase bảng datahub_orders -- thay cho luồng cũ
// (Sale tự export/copy vào Google Sheet "DataHub" rồi Dashboard đọc CSV từ Sheet đó).
//
// Cần 2 biến môi trường:
//   PANCAKE_SESSION_TOKEN     -- token đăng nhập Pancake (dạng JWT, hết hạn 1/11/2026), xem được TẤT CẢ
//     shop trong tài khoản Pancake THT Holding. Khi hết hạn phải đăng nhập lại Pancake lấy token mới.
//   SUPABASE_SERVICE_ROLE_KEY -- ghi vào Supabase (bỏ qua RLS)
//
// Chạy mặc định (KHÔNG set BACKFILL): chỉ quét 5 trang mới nhất/shop (~500 đơn) -- đủ bắt mọi đơn mới +
// đơn vừa sửa gần đây, vì Pancake luôn trả đơn mới nhất ở đầu danh sách (không sort lại theo update).
// Chạy 1 lần đầu với BACKFILL=1 để quét TOÀN BỘ lịch sử (paginate hết, dừng khi hết dữ liệu hoặc gặp
// đơn cũ hơn MIN_ORDER_DATE).

const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const SESSION_TOKEN = process.env.PANCAKE_SESSION_TOKEN;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKFILL = process.env.BACKFILL === '1';
const PAGE_SIZE = 100;
const INCREMENTAL_MAX_PAGES = 5;
// User yêu cầu 11/9/2026: tạm thời chỉ lấy dữ liệu từ tháng 6/2026 trở đi.
const MIN_ORDER_DATE = '2026-06-01';

// Map cứng shop -> brand (dò tay 11/9/2026 qua GET /shops). KHÔNG suy qua regex tên shop vì "Thời Đại"
// (tên shop Shidai) không chứa chữ "shidai" -- xem chi tiết trong supabase-schema-datahub.sql.
const SHOPS = [
  { id: 1022031789, brand: 'CT' },   // Chánh Tâm - Không Gian Tâm Linh Phật Giáo (chính)
  { id: 1943057093, brand: 'CT' },   // Đồ Thờ Nhập Khẩu Chánh Tâm
  { id: 100965386, brand: 'CT' },    // Đồ Thờ Chánh Tâm
  { id: 1021966905, brand: 'CT' },   // CHÁNH TÂM - Nội thất đồ thờ cao cấp
  { id: 1943096391, brand: 'HT' },   // Siêu thị Phật Giáo Hiền Thuỷ (chính)
  { id: 715061393, brand: 'HT' },    // Hiền Thuỷ - Siêu thị đồ thờ
  { id: 408077426, brand: 'HT' },    // Siêu thị Phật Giáo Hiền Thuỷ (trùng tên, hiện 0 đơn)
  { id: 1943052948, brand: 'Shidai' }, // Thời Đại - Tổng Kho Sỉ Đồ Thờ Miền Bắc (chính)
  { id: 408040224, brand: 'TTV' },   // Nến Bơ - Tự Tại Viên (chính)
  { id: 1329071685, brand: 'CT' },   // Hoàng Dương | Ming Ying -- kênh TikTok của Chánh Tâm, đơn tính cho CT
];

async function fetchShopOrders(shopId) {
  let page = 1, all = [], totalPages = 1;
  while (page <= totalPages) {
    const url = `https://pos.pages.fm/api/v1/shops/${shopId}/orders?access_token=${SESSION_TOKEN}&page_size=${PAGE_SIZE}&page_number=${page}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(`Pancake lỗi shop ${shopId} trang ${page}: ${json.message || JSON.stringify(json).slice(0, 200)}`);
    all = all.concat(json.data || []);
    totalPages = json.total_pages || 1;
    if (!BACKFILL && page >= INCREMENTAL_MAX_PAGES) break;
    // Pancake trả đơn mới nhất trước -- nếu trang này đã lùi quá MIN_ORDER_DATE thì dừng sớm, khỏi quét hết lịch sử.
    const oldestInPage = (json.data || []).length ? (json.data[json.data.length - 1].inserted_at || '').slice(0, 10) : null;
    if (oldestInPage && oldestInPage < MIN_ORDER_DATE) break;
    page++;
    await new Promise(r => setTimeout(r, 200)); // tránh dồn dập bị Pancake rate-limit
  }
  return all;
}

// LƯU Ý: endpoint list (page_size > 1, dùng cho sync hàng loạt) trả field KHÁC với endpoint xem 1 đơn lẻ --
// vd system_id -> display_id, account_name -> page.name, customer.tags -> customer.shop_customer.tags.
// Đã dò tay bằng cách so sánh response page_size=1 vs page_size=100 (11/9/2026), map theo đúng cấu trúc LIST.
function mapOrder(o, shopMeta) {
  const sc = (o.customer && o.customer.shop_customer) || {};
  const custStatus = (sc.order_count !== undefined ? sc.order_count : 1) <= 1 ? 'Mới' : 'Cũ';
  const tags = Array.isArray(sc.tags) ? sc.tags.join(', ') : null;
  const addr = o.shipping_address || {};
  const phone = (sc.phone_numbers && sc.phone_numbers[0]) || addr.phone_number || o.bill_phone_number || null;
  const pageName = o.page && o.page.name;
  const pageId = (o.page && o.page.id) || o.page_id;
  const sourceLabel = [o.ads_source, pageName ? `${pageName} (${pageId || ''})` : null].filter(Boolean).join(' / ') || null;
  return {
    shop_id: shopMeta.id,
    shop_name: pageName || null,
    brand: shopMeta.brand,
    order_id: o.id,
    system_id: o.display_id,
    order_date: (o.inserted_at || '').slice(0, 10),
    customer_status: custStatus,
    customer_tags: tags,
    // id hội thoại + page: để app dựng link mở thẳng khung chat Pancake với khách
    conversation_id: o.conversation_id || (o.customer && o.customer.psid) || null,
    page_id: o.page_id ? String(o.page_id) : ((o.customer && o.customer.page_id) ? String(o.customer.page_id) : null),
    customer_name: (o.customer && o.customer.name) || o.bill_full_name || null,
    phone,
    address: addr.address || addr.full_address || null,
    ward: addr.commune_name || null,
    district: addr.district_name || null,
    province: addr.province_name || null,
    source: sourceLabel,
    internal_note: o.note || null,
    // Shop Nến Bơ (TTV) tạo đơn theo cách khác nên creator = null ở 56/100 đơn, nhưng assigning_seller
    // vẫn có tên Sale. Các shop còn lại thì cả 3 trường đều đầy. Lấy theo thứ tự người TẠO -> người ĐƯỢC
    // GIAO -> người sửa cuối, nếu không sẽ mất Sales phụ trách của gần hết brand TTV.
    staff_name: (o.creator && o.creator.name) || (o.assigning_seller && o.assigning_seller.name)
      || (o.assigning_care && o.assigning_care.name) || (o.last_editor && o.last_editor.name) || null,
    ad_id: o.ad_id || null,
    order_status: (o.status !== undefined && o.status !== null) ? String(o.status) : null,
    pancake_updated_at: o.updated_at || null,
  };
}

async function upsertOrders(rows) {
  if (!rows.length) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/datahub_orders?on_conflict=shop_id,order_id`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase upsert lỗi ${res.status}: ${t.slice(0, 500)}`);
  }
}

// Dùng chung bảng sync_log với job MKT (xem scripts/sync-mkt-from-meta.js) để trang Data Hub trên app
// hiện đúng 1 "Sync History" gộp, không tạo bảng riêng cho Pancake.
async function logSyncStart() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_log`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ source: 'Data Hub - Pancake POS', status: 'running' }),
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

// ── TỰ GẮN THẺ "CHỐT ĐƠN" ────────────────────────────────────────────────────────────────────────
// Khách đã chốt THẬT (Sale đã dán Mã KH vào ghi chú Pancake, và mã đó có đơn đặt hàng Kiot chưa huỷ)
// nhưng thẻ trên Pancake vẫn còn là tiềm năng -> gắn CHỐT ĐƠN hộ, bỏ thẻ tiềm năng, GIỮ NGUYÊN KH LẺ/KH SỈ.
// Ghi bằng: PUT https://pos.pages.fm/api/v1/shops/{shop_id}/customers/{customer_id} body {customer:{tags:[...]}}
// Đổi thẻ xong, autoB3 chạy ngay sau sẽ đẩy trạng thái đơn lên "Đã gửi hàng", và app tự hiểu khách là
// "Chốt đơn" vì trạng thái trong app suy từ thẻ. Tắt bằng AUTO_CHOT=0.
// CHẶN: không đụng đơn đã huỷ; chỉ khi có bằng chứng đơn Kiot thật; không bao giờ GỠ thẻ CHỐT ĐƠN.
const { sbAll } = require('./lib/sb');   // đọc bảng Supabase CÓ PHÂN TRANG (PostgREST chặn 1000 dòng/lần)
const doc = (table, query) => sbAll(SUPABASE_URL, SERVICE_ROLE_KEY, table, query);
function maKH(note) {
  const m = /KH\s*0*(\d{3,7})/i.exec(note || '');
  return m ? 'KH' + m[1].padStart(6, '0') : null;
}
async function ghiNhatKy(rows) {
  if (!rows.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/activity_log`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  }).catch(() => {});
}
async function autoChot() {
  if (process.env.AUTO_CHOT === '0') return 'Bỏ qua gắn thẻ (AUTO_CHOT=0).';
  const [dh, ko] = await Promise.all([
    doc('datahub_orders', `select=shop_id,order_id,system_id,customer_name,customer_tags,order_status,internal_note&order_date=gte.${MIN_ORDER_DATE}`),
    doc('kiot_orders', 'select=customer_code,status'),
  ]);
  const coDon = new Set(ko.filter(o => o.customer_code && o.status !== 4).map(o => o.customer_code));
  const can = dh.filter(o => {
    const t = (o.customer_tags || '').toUpperCase();
    if (String(o.order_status) === '6' || t.includes('CHỐT ĐƠN')) return false;
    const m = maKH(o.internal_note);
    return m && coDon.has(m);
  });
  if (!can.length) return 'Thẻ: không khách nào cần gắn CHỐT ĐƠN.';
  let ok = 0; const loi = []; const nhatKy = [];
  for (const o of can) {
    try {
      const j = await fetch(`https://pos.pages.fm/api/v1/shops/${o.shop_id}/orders/${o.order_id}?access_token=${SESSION_TOKEN}`).then(r => r.json());
      const d = j.data || j;
      const cid = d.customer && d.customer.id;
      const cu = (d.customer && d.customer.shop_customer && d.customer.shop_customer.tags) || [];
      if (!cid) { loi.push('#' + o.system_id + ' không có customer_id'); continue; }
      const moi = [...cu.filter(t => !/TIỀM NĂNG/i.test(t)), 'CHỐT ĐƠN'];
      const put = await fetch(`https://pos.pages.fm/api/v1/shops/${o.shop_id}/customers/${cid}?access_token=${SESSION_TOKEN}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { tags: moi } }),
      });
      if (!put.ok) { loi.push('#' + o.system_id + ' ' + put.status); continue; }
      ok++;
      await fetch(`${SUPABASE_URL}/rest/v1/datahub_orders?shop_id=eq.${o.shop_id}&order_id=eq.${o.order_id}`, {
        method: 'PATCH',
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_tags: moi.join(', ') }),
      }).catch(() => {});
      nhatKy.push({ who: 'Job tự động', act: 'U', tbl: 'datahub_orders', ref: '#' + o.system_id,
        label: o.customer_name, fld: 'Thẻ khách', old_v: cu.join(', '), new_v: moi.join(', ') });
    } catch (e) { loi.push('#' + o.system_id + ' ' + e.message); }
    await new Promise(r => setTimeout(r, 150));
  }
  await ghiNhatKy(nhatKy);
  return `Thẻ: đã gắn CHỐT ĐƠN cho ${ok}/${can.length} khách` + (loi.length ? ` (lỗi: ${loi.slice(0, 5).join(', ')})` : '') + '.';
}

// ── BƯỚC B3 TỰ ĐỘNG ──────────────────────────────────────────────────────────────────────────────
// Quy trình Sale: khách TIỀM NĂNG -> đơn phải là "Đã xác nhận"; khách CHỐT ĐƠN -> "Đã gửi hàng".
// Trước đây app chỉ liệt kê đơn sai để Sale vào Pancake sửa tay. Nay đổi luôn hộ, vì API cho ghi:
//   PUT https://pos.pages.fm/api/v1/shops/{shop_id}/orders/{order_id}  body {status}
// LƯU Ý: Pancake CHỈ CHO TIẾN, không cho lùi (đo 21/9/2026: lùi -> 422). Nên chỉ đẩy tới, không bao giờ
// hạ trạng thái, và chỉ đụng đơn từ MIN_ORDER_DATE trở lại đây.
// Tắt bằng biến môi trường AUTO_B3=0.
const ST = { MOI: 0, XAC_NHAN: 1, GUI_HANG: 2 };
function b3Target(tags) {
  const t = (tags || '').toUpperCase();
  // CHỈ áp cho khách LẺ -- quy trình B3 là của Sale Lẻ. Đơn KH SỈ để nguyên, khi nào team Sỉ chốt
  // quy trình riêng thì mở rộng sau.
  if (t.includes('KH SỈ') || !t.includes('KH LẺ')) return null;
  if (t.includes('CHỐT ĐƠN')) return ST.GUI_HANG;
  if (t.includes('TIỀM NĂNG') || t.includes('BÀN GIAO')) return ST.XAC_NHAN;
  return null;
}
// NGÀY KHÁCH NHẮN CUỐI trên Pancake (last_customer_interactive_at của hội thoại).
// Dùng để biết khách online còn theo Facebook hay đã chuyển sang Zalo: còn nhắn thì đơn quá 1 tháng
// VẪN tính doanh số (quy tắc người dùng chốt 22/9/2026), hết nhắn thì mới coi là khách tự quay lại.
// Mỗi lượt chỉ lấy tối đa 250 hội thoại: ưu tiên đơn chưa có ngày, rồi tới đơn cũ nhất chưa cập nhật lại.
async function capNhatChat() {
  if (process.env.AUTO_CHAT === '0') return 'Bỏ qua ngày nhắn cuối (AUTO_CHAT=0).';
  const rows = await doc('datahub_orders',
    `select=id,page_id,conversation_id,last_chat_at&conversation_id=not.is.null&order_date=gte.${MIN_ORDER_DATE}`);
  const can = rows
    .filter((r) => r.page_id && r.conversation_id)
    .sort((a, b) => (a.last_chat_at ? 1 : 0) - (b.last_chat_at ? 1 : 0)
      || String(a.last_chat_at || '').localeCompare(String(b.last_chat_at || '')))
    .slice(0, 250);
  if (!can.length) return '';
  let ok = 0;
  for (const r of can) {
    try {
      const j = await fetch(`https://pancake.vn/api/v1/pages/${r.page_id}/conversations/${r.conversation_id}?access_token=${SESSION_TOKEN}`)
        .then((x) => x.json());
      const c = j.conversation || j;
      const t = c.last_customer_interactive_at || c.updated_at || null;
      if (!t || t === r.last_chat_at) continue;
      const put = await fetch(`${SUPABASE_URL}/rest/v1/datahub_orders?id=eq.${r.id}`, {
        method: 'PATCH',
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_chat_at: t }),
      });
      if (put.ok) ok++;
    } catch (e) { /* hội thoại lỗi thì bỏ qua, lượt sau lấy lại */ }
    await new Promise((x) => setTimeout(x, 120));
  }
  return `Ngày nhắn cuối: cập nhật ${ok}/${can.length} hội thoại.`;
}
async function autoB3() {
  if (process.env.AUTO_B3 === '0') return 'Bỏ qua bước B3 (AUTO_B3=0).';
  const rows = await doc('datahub_orders', `select=shop_id,order_id,system_id,customer_tags,order_status&order_date=gte.${MIN_ORDER_DATE}`);
  const can = rows.filter(r => {
    const dich = b3Target(r.customer_tags);
    const ht = Number(r.order_status);
    // chỉ đẩy TỚI, và chỉ từ "Mới"(0) / "Đã xác nhận"(1). Đơn ĐÃ HUỶ (6) hay đã hoàn thì không đụng.
    return dich !== null && ht < dich && (ht === 0 || ht === 1);
  });
  if (!can.length) return 'B3: không đơn nào cần đổi trạng thái.';
  let ok = 0; const loi = [];
  for (const r of can) {
    const dich = b3Target(r.customer_tags);
    try {
      const put = await fetch(`https://pos.pages.fm/api/v1/shops/${r.shop_id}/orders/${r.order_id}?access_token=${SESSION_TOKEN}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: dich }) });
      if (put.ok) {
        ok++;
        await fetch(`${SUPABASE_URL}/rest/v1/datahub_orders?shop_id=eq.${r.shop_id}&order_id=eq.${r.order_id}`,
          { method: 'PATCH', headers: { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_status: String(dich) }) }).catch(() => {});
      } else {
        loi.push('#' + r.system_id + ' ' + put.status);
      }
    } catch (e) { loi.push('#' + r.system_id + ' ' + e.message); }
    await new Promise(r2 => setTimeout(r2, 120));
  }
  return `B3: đã đổi trạng thái ${ok}/${can.length} đơn` + (loi.length ? ` (lỗi: ${loi.slice(0, 5).join(', ')})` : '') + '.';
}

(async () => {
  if (!SESSION_TOKEN || !SERVICE_ROLE_KEY) {
    console.error('Thiếu PANCAKE_SESSION_TOKEN hoặc SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  console.log(`Chế độ: ${BACKFILL ? 'BACKFILL TOÀN BỘ LỊCH SỬ' : 'incremental (' + INCREMENTAL_MAX_PAGES + ' trang mới nhất/shop)'}`);
  const logId = await logSyncStart().catch(e => { console.warn('logSyncStart lỗi (bỏ qua):', e.message); return null; });
  let grandTotal = 0;
  const errors = [];
  const CHUNK = 500; // upsert theo lô, tránh 1 request quá lớn
  for (const shop of SHOPS) {
    try {
      const orders = await fetchShopOrders(shop.id);
      const rows = orders.filter(o => o.display_id).map(o => mapOrder(o, shop))
        .filter(r => r.order_date && r.order_date >= MIN_ORDER_DATE);
      for (let i = 0; i < rows.length; i += CHUNK) {
        await upsertOrders(rows.slice(i, i + CHUNK));
      }
      console.log(`Shop ${shop.id} (${shop.brand}): ${rows.length} đơn đã upsert.`);
      grandTotal += rows.length;
    } catch (e) {
      console.error(`Shop ${shop.id} (${shop.brand}) LỖI: ${e.message}`);
      errors.push(`Shop ${shop.id} (${shop.brand}): ${e.message}`);
    }
  }
  // Không đơn nào về mà cũng không báo lỗi = bất thường (token hết hạn, Pancake trục trặc).
  // Dừng lại, KHÔNG chạy phần tự gắn thẻ / đổi trạng thái để máy không hành động trên dữ liệu thiếu.
  if (grandTotal === 0) {
    console.error('DỪNG: không lấy được đơn nào từ Pancake — bỏ qua bước gắn thẻ và đổi trạng thái.');
    await logSyncEnd(logId, { status: 'failed', recordsCreated: 0, errorMessage: 'Không lấy được đơn nào từ Pancake' });
    process.exit(1);
  }
  if (errors.length) {
    console.error('CÓ SHOP LỖI — bỏ qua bước gắn thẻ và đổi trạng thái lượt này cho chắc.');
    await logSyncEnd(logId, { status: 'failed', recordsCreated: grandTotal, errorMessage: errors.join(' | ').slice(0, 500) });
    process.exit(1);
  }
  const chot = await autoChot();            // gắn thẻ trước...
  const b3 = await autoB3();                // ...rồi mới đẩy trạng thái theo thẻ mới
  const chat = await capNhatChat();          // ngày khách nhắn cuối -> quyết định đơn lặp có tính không
  console.log(`XONG. Tổng ${grandTotal} đơn đã đồng bộ.` + (chot ? ' ' + chot : '') + (b3 ? ' ' + b3 : '') + (chat ? ' ' + chat : ''));
  await logSyncEnd(logId, {
    status: errors.length ? 'failed' : 'success',
    recordsCreated: grandTotal,
    errorMessage: errors.length ? errors.join(' | ').slice(0, 500) : null,
  });
})();
