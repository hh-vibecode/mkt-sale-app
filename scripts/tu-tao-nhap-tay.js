// ════════ TỰ TẠO DATA NHẬP TAY TỪ ĐƠN KIOT ════════
// Chạy sau mỗi lượt kéo đơn Kiot. Bộ lọc do anh Hải chốt 23/9/2026:
//   khách LẺ · kênh bán ONLINE · đơn từ 1/6/2026 · chưa có mặt trong app
// -> mỗi khách 1 dòng datahub_manual, để doanh thu về đúng báo cáo Sale/MKT mà Sale không phải gõ tay.
//
// KHÔNG lấy: đơn huỷ · phiếu tạm không có dấu vết tiền (chưa trả đồng nào và khách cũng không cọc)
//            · kênh Shidai (khách sỉ) · khách đã có dòng nhập tay hoặc đã có Mã KH trong ghi chú Pancake.
// Chạy tay: node scripts/tu-tao-nhap-tay.js        (KHO=1 để chỉ xem trước, không ghi)
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MOC = '2026-06-01';
const CHI_XEM = process.env.KHO === '1';

const H = { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };
const ONLINE = /facebook|tiktok|website|instagram|shopee|google|haravan/i;
const CN_SI = /tổng kho|tong kho|shidai|sỉ/i;
const NHOM_SI = /buôn|buon|npp|ctv|phân phối|thị trường|đại lý/i;
const NHOM_LE = /khách lẻ|khach le/i;
const vn = n => Math.round(n || 0).toLocaleString('vi');
const maKH = s => { const m = /KH\s*0*(\d{3,7})/i.exec(s || ''); return m ? 'KH' + m[1].padStart(6, '0') : ''; };
const brand = k => /chánh tâm|chanh tam|ming ying|hoàng dương/i.test(k) ? 'CT'
  : /hiền thu|hien thu/i.test(k) ? 'HT' : /nến bơ|nen bo|tự tại|tu tai/i.test(k) ? 'TTV'
  : /shidai/i.test(k) ? 'Shidai' : null;

async function doc(bang, cot) {
  let ra = [], tu = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${bang}?select=${cot}&limit=1000&offset=${tu}`, { headers: H });
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error(bang + ': ' + JSON.stringify(j).slice(0, 150));
    ra = ra.concat(j);
    if (j.length < 1000) return ra;
    tu += 1000;
  }
}

async function ghiLog(body, id) {
  const url = id ? `${SUPABASE_URL}/rest/v1/sync_log?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/sync_log`;
  const r = await fetch(url, { method: id ? 'PATCH' : 'POST', headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(id ? body : { source: 'Tự tạo data nhập tay', started_at: new Date().toISOString(), ...body }) });
  const j = await r.json().catch(() => null);
  return Array.isArray(j) && j[0] ? j[0].id : null;
}

(async () => {
  if (!SERVICE_ROLE_KEY) { console.error('Thiếu SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const logId = CHI_XEM ? null : await ghiLog({ status: 'running' }).catch(() => null);
  try {
    const [don, kh, hd, dm, dh] = await Promise.all([
      doc('kiot_orders', 'code,customer_code,customer_name,purchase_date,total,total_payment,status,branch_name,sale_channel,sold_by_name'),
      doc('kiot_customers', 'code,name,phone,debt,customer_group'),
      doc('kiot_invoices', 'customer_code,total,status'),
      doc('datahub_manual', 'kiot_code'),
      doc('datahub_orders', 'internal_note'),
    ]);
    const byCode = {}; kh.forEach(c => { byCode[c.code] = c; });
    // Sỉ hay Lẻ: nhóm khách nếu ghi rõ, không thì theo CHI NHÁNH của các đơn (Tổng kho sỉ = Sỉ).
    const cn = {};
    don.forEach(o => { if (!o.customer_code) return;
      const b = cn[o.customer_code] = cn[o.customer_code] || { si: 0, le: 0 };
      if (CN_SI.test(o.branch_name || '')) b.si++; else b.le++; });
    const loai = c => { if (!c) return 'Lẻ';
      const g = c.customer_group || '';
      if (NHOM_SI.test(g)) return 'Sỉ';
      if (NHOM_LE.test(g)) return 'Lẻ';
      const b = cn[c.code];
      return b && (b.si || b.le) ? (b.si > b.le ? 'Sỉ' : 'Lẻ') : 'Lẻ'; };
    const coCoc = c => { const x = byCode[c]; return !!(x && Number(x.debt || 0) < 0); };
    const phieuBaoGia = o => o.status === 1 && Number(o.total_payment || 0) <= 0 && !coCoc(o.customer_code);
    const daCo = new Set([...dm.map(r => r.kiot_code), ...dh.map(o => maKH(o.internal_note))].filter(Boolean));

    const gom = {};
    don.forEach(o => {
      const ngay = String(o.purchase_date || '').slice(0, 10);
      if (o.status === 4 || phieuBaoGia(o)) return;
      if (ngay < MOC) return;
      if (!ONLINE.test(o.sale_channel || '') || /shidai/i.test(o.sale_channel || '')) return;
      if (!o.customer_code || daCo.has(o.customer_code)) return;
      const c = byCode[o.customer_code];
      if (loai(c) !== 'Lẻ') return;
      const g = gom[o.customer_code] = gom[o.customer_code] || { ma: o.customer_code,
        ten: (c && c.name) || o.customer_name || '', sdt: (c && c.phone) || null,
        ngay, kenh: o.sale_channel, sale: o.sold_by_name || null, don: 0, tien: 0 };
      if (ngay < g.ngay) { g.ngay = ngay; g.kenh = o.sale_channel; g.sale = o.sold_by_name || null; }
      g.don++; g.tien += Number(o.total || 0);
    });
    // ── CHỐT CHẶN CUỐI: KHÁCH PHẢI CÓ DẤU VẾT TIỀN THẬT ───────────────────────────────────────
    // Đơn "Hoàn thành" hay "Phiếu tạm" chỉ là trạng thái Sale đặt tay, chưa chắc là mua thật.
    // Chỉ nhận khách có ÍT NHẤT MỘT trong ba: đã trả tiền trên đơn · có hoá đơn hoàn thành ·
    // có nợ cần thu âm (đã đặt cọc). Không có gì cả thì để ngoài, chờ có tiền mới đưa vào báo cáo.
    const traTheoKhach = {}, hdTheoKhach = {};
    don.forEach(o => { if (o.customer_code && o.status !== 4)
      traTheoKhach[o.customer_code] = (traTheoKhach[o.customer_code] || 0) + Number(o.total_payment || 0); });
    hd.forEach(i => { if (i.customer_code && i.status === 1)
      hdTheoKhach[i.customer_code] = (hdTheoKhach[i.customer_code] || 0) + 1; });
    const bangChung = m => {
      const t = traTheoKhach[m] || 0, n = hdTheoKhach[m] || 0, c = Number((byCode[m] || {}).debt || 0);
      const l = [];
      if (t > 0) l.push('đã trả ' + vn(t));
      if (n > 0) l.push(n + ' hoá đơn');
      if (c < 0) l.push('cọc ' + vn(-c));
      return l.join(' · ');
    };
    const loaiRa = [];
    Object.keys(gom).forEach(m => { if (!bangChung(m)) { loaiRa.push(gom[m]); delete gom[m]; } });
    if (loaiRa.length) {
      console.log(`Loại ${loaiRa.length} khách chưa có dấu vết tiền (chưa trả, chưa có hoá đơn, chưa cọc):`);
      loaiRa.forEach(x => console.log(`   - ${x.ma} ${x.ten} · ${vn(x.tien)} đ`));
    }

    const ds = Object.values(gom).sort((a, b) => b.tien - a.tien);
    console.log(`Đủ điều kiện: ${ds.length} khách · ${vn(ds.reduce((s, x) => s + x.tien, 0))} đ`);
    ds.forEach(x => console.log(`   ${x.ngay} ${x.ma} ${String(x.ten).slice(0, 26)} · ${x.kenh} · ${x.don} đơn · ${vn(x.tien)} · ${bangChung(x.ma)}`));
    if (CHI_XEM) { console.log('(KHO=1 -> chỉ xem trước, không ghi)'); return; }
    if (!ds.length) { console.log('Không có gì mới.'); await ghiLog({ finished_at: new Date().toISOString(), status: 'success', records_created: 0 }, logId); return; }

    const rows = ds.map(x => ({ created_date: x.ngay, sale_type: 'Lẻ', nguon: 'Online', kenh: x.kenh,
      brand: brand(x.kenh), customer_name: x.ten, phone: x.sdt, staff_name: x.sale, kiot_code: x.ma,
      status: 'Chốt đơn', note: 'Tự tạo từ đơn Kiot · kênh ' + x.kenh, created_by: 'Monsieur Claude' }));
    let ok = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const lo = rows.slice(i, i + 100);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/datahub_manual`, { method: 'POST',
        headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(lo) });
      if (r.ok) ok += lo.length; else console.error('  lỗi lô', i, (await r.text()).slice(0, 200));
    }
    console.log(`XONG. Đã tạo ${ok} dòng nhập tay.`);
    await ghiLog({ finished_at: new Date().toISOString(), status: 'success', records_created: ok }, logId);
  } catch (e) {
    console.error('LỖI:', e.message);
    await ghiLog({ finished_at: new Date().toISOString(), status: 'failed', error_message: e.message.slice(0, 500) }, logId);
    process.exit(1);
  }
})();
