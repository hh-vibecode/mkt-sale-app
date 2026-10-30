// Đồng bộ DANH MỤC HÀNG KiotViet -> bảng kiot_hang (app MKT/Sale). Schema: supabase-schema-kiot-hang.sql.
// Dùng cho thẻ "Doanh thu theo nhóm hàng (nhóm cha)" ở Báo cáo tổng hợp (anh Hải 30/10/2026): mỗi dòng hàng của đơn đặt hàng
// (kiot_orders.items[].code) tra ra NHÓM CHA (anh: chỉ cần doanh số theo nhóm, không lợi nhuận). Chạy trong lượt quét lại hằng ngày (BACKFILL, 07:20 VN).
// Cần: KIOT_CLIENT_ID, KIOT_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY. Monsieur Claude.
const { fetchLai } = require('./lib/fetch-lai.js');
const fetch = (u, o) => fetchLai(u, o, { ten: require('path').basename(__filename) });
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const KIOT_RETAILER = 'sieuthidotho285';
const { KIOT_CLIENT_ID: ID, KIOT_CLIENT_SECRET: SEC, SUPABASE_SERVICE_ROLE_KEY: KHOA } = process.env;
const PAGE = 100;

async function token() {
  const r = await fetch('https://id.kiotviet.vn/connect/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ scopes: 'PublicApi.Access', grant_type: 'client_credentials', client_id: ID, client_secret: SEC }) });
  const j = await r.json(); if (!j.access_token) throw new Error('KiotViet token lỗi'); return j.access_token;
}
async function tatCa(tk, duong, them = {}) {
  const H = { Retailer: KIOT_RETAILER, Authorization: 'Bearer ' + tk };
  let off = 0, tong = Infinity, ds = [];
  while (off < tong) {
    const r = await fetch(`https://public.kiotapi.com/${duong}?${new URLSearchParams({ pageSize: PAGE, currentItem: off, orderBy: 'createdDate', orderDirection: 'Asc', ...them })}`, { headers: H });
    if (!r.ok) throw new Error(`KiotViet ${duong} lỗi ${r.status}: ${(await r.text()).slice(0, 150)}`);
    const j = await r.json(); tong = j.total || 0; const d = j.data || []; ds = ds.concat(d);
    if (!d.length) break; off += PAGE; await new Promise(x => setTimeout(x, 120));
  }
  return ds;
}
async function logSync(body, id) {
  const r = await fetch(id ? `${SUPABASE_URL}/rest/v1/sync_log?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/sync_log`, { method: id ? 'PATCH' : 'POST',
    headers: { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) }).catch(() => null);
  if (!r || id) return null; const d = await r.json().catch(() => null); return d && d[0] ? d[0].id : null;
}
(async () => {
  if (!ID || !SEC || !KHOA) { console.error('Thiếu KIOT_CLIENT_ID / KIOT_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const logId = await logSync({ source: 'KiotViet - Danh mục hàng', status: 'running' });
  try {
    const tk = await token();
    // nhóm hàng: danh sách PHẲNG có parentId -> lần ngược tới nhóm GỐC (không có cha) = "nhóm cha" (cách bên Kế toán làm;
    // đọc dạng cây hierarchicalData thì API không trả children đầy đủ -> 81 "nhóm cha" sai, đã đo 30/10/2026)
    const phang = await tatCa(tk, 'categories');
    const theoId = {}; phang.forEach(c => { theoId[c.categoryId] = c; });
    const nhom = {};
    phang.forEach(c => { let g = c, buoc = 0; while (g.parentId && theoId[g.parentId] && buoc++ < 20) g = theoId[g.parentId];
      nhom[c.categoryId] = { ten: c.categoryName, gocId: g.categoryId, goc: g.categoryName }; });
    const sp = await tatCa(tk, 'products');
    const rows = sp.filter(p => p.code).map(p => {
      const n = nhom[p.categoryId] || {};
      return { ma: p.code, ten: p.fullName || p.name || null, nhom_id: p.categoryId || null, nhom: n.ten || p.categoryName || null,
        nhom_cha_id: n.gocId || p.categoryId || null, nhom_cha: n.goc || n.ten || p.categoryName || null,
        cap_nhat: new Date().toISOString() };
    });
    const co = {}; const ghi = rows.filter(r => co[r.ma] ? false : (co[r.ma] = true));
    for (let i = 0; i < ghi.length; i += 500) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/kiot_hang?on_conflict=ma`, { method: 'POST',
        headers: { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(ghi.slice(i, i + 500)) });
      if (!r.ok) throw new Error('Ghi kiot_hang lỗi ' + r.status + ': ' + (await r.text()).slice(0, 200));
    }
    const nhomCha = new Set(ghi.map(r => r.nhom_cha).filter(Boolean));
    console.log(`XONG. ${Object.keys(nhom).length} nhóm hàng (${nhomCha.size} nhóm cha), ${ghi.length} mặt hàng.`);
    await logSync({ finished_at: new Date().toISOString(), status: 'success', records_created: ghi.length, records_updated: 0 }, logId);
  } catch (e) {
    console.error('LỖI:', e.message);
    await logSync({ finished_at: new Date().toISOString(), status: 'failed', error_message: e.message.slice(0, 500) }, logId);
    process.exit(1);
  }
})();
