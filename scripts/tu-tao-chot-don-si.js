// ════════ TỰ TẠO DÒNG "CHỐT ĐƠN" TRONG LỊCH SỬ CHĂM SÓC SỈ TỪ ĐƠN ĐẶT HÀNG KIOT ════════
// Anh Hải 25/9/2026: đơn đặt hàng gần nhất của khách Sỉ, nếu ĐỦ ĐIỀU KIỆN (có dấu vết tiền: đã trả trên
// phiếu / có hoá đơn / khách đang cọc) thì tạo luôn 1 dòng Chốt đơn bên Lịch sử chăm sóc, NGÀY = ngày tạo phiếu.
// Chạy sau mỗi lượt kéo đơn Kiot (sync-kiot.yml), nên đơn mới nào đủ điều kiện cũng tự có dòng.
//
// Mỗi lượt làm 2 việc:
//  1. RÀ LẠI dòng chốt cũ (nhập từ sheet, chưa có mã đơn): khớp đúng 1 đơn Kiot cùng khách, cùng ngày
//     (lệch tối đa 1 ngày), cùng tiền (hoặc dòng chưa ghi tiền) -> điền mã đơn, trạng thái, tiền còn thiếu.
//  2. TẠO MỚI: mỗi khách Sỉ đã có trong app
//     - đã có dòng chốt: tạo cho các đơn đủ điều kiện MỚI HƠN dòng chốt gần nhất (từ 1/6/2026)
//     - chưa có dòng chốt nào: chỉ tạo cho ĐƠN GẦN NHẤT đủ điều kiện (không đổ cả lịch sử cũ vào)
//
// KHÔNG lấy: đơn huỷ · phiếu tạm chưa có dấu vết tiền (phiếu báo giá) · từ 1/6/2026 đơn không có dấu vết tiền.
// Chạy tay: node scripts/tu-tao-chot-don-si.js      (KHO=1 để chỉ xem trước, không ghi)
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MOC = '2026-06-01';
const CHI_XEM = process.env.KHO === '1';

const H = { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };
const CN_SI = /tổng kho|tong kho|shidai|sỉ/i;
const NHOM_SI = /buôn|buon|npp|ctv|phân phối|thị trường|đại lý/i;
const NHOM_LE = /khách lẻ|khach le/i;
const vn = n => Math.round(n || 0).toLocaleString('vi');
const maKH = s => { const m = /KH\s*0*(\d{3,7})/i.exec(s || ''); return m ? 'KH' + m[1].padStart(6, '0') : ''; };
const ngay = s => String(s || '').slice(0, 10);
const lech = (a, b) => Math.abs(new Date(a) - new Date(b)) / 86400000;

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
    body: JSON.stringify(id ? body : { source: 'Tự tạo Chốt đơn Sỉ', started_at: new Date().toISOString(), ...body }) });
  const j = await r.json().catch(() => null);
  return Array.isArray(j) && j[0] ? j[0].id : null;
}

(async () => {
  if (!SERVICE_ROLE_KEY) { console.error('Thiếu SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const logId = CHI_XEM ? null : await ghiLog({ status: 'running' }).catch(() => null);
  try {
    const [don, kh, hd, dm, dh, cs, giu] = await Promise.all([
      doc('kiot_orders', 'code,customer_code,customer_name,purchase_date,total,total_payment,status,branch_name,sold_by_name'),
      doc('kiot_customers', 'code,name,phone,debt,customer_group'),
      doc('kiot_invoices', 'customer_code,status'),
      doc('datahub_manual', 'kiot_code,sale_type'),
      doc('datahub_orders', 'internal_note'),
      doc('salesi_crm', 'id,kiot_code,ma_don,ngay_chot,gia_tri_chot,trang_thai'),
      doc('kiot_don_giu_tinh', 'code'),
    ]);
    const byCode = {}; kh.forEach(c => { byCode[c.code] = c; });
    // Sỉ hay Lẻ: giống tu-tao-nhap-tay.js -- nhóm khách nếu ghi rõ, không thì theo chi nhánh đa số
    const cn = {};
    don.forEach(o => { if (!o.customer_code) return;
      const b = cn[o.customer_code] = cn[o.customer_code] || { si: 0, le: 0 };
      if (CN_SI.test(o.branch_name || '')) b.si++; else b.le++; });
    const laSi = m => { const c = byCode[m]; const g = (c && c.customer_group) || '';
      if (NHOM_SI.test(g)) return true; if (NHOM_LE.test(g)) return false;
      const b = cn[m]; return !!(b && b.si > b.le); };
    // khách ĐÃ CÓ trong app (dòng nhập tay / Mã KH trong ghi chú Pancake / đã có lịch sử chăm sóc)
    const trongApp = new Set();
    dm.forEach(x => { if (x.kiot_code) trongApp.add(String(x.kiot_code).toUpperCase()); });
    dh.forEach(x => { const m = maKH(x.internal_note); if (m) trongApp.add(m); });
    cs.forEach(x => { if (x.kiot_code) trongApp.add(String(x.kiot_code).toUpperCase()); });
    // dấu vết tiền -- cùng luật với app (rptSlDonKhongTinh)
    const coHD = {}; hd.forEach(i => { if (i.customer_code && i.status === 1) coHD[i.customer_code] = true; });
    const coCoc = m => Number((byCode[m] || {}).debt || 0) < 0;
    // ĐƠN GIỮ TÍNH (anh Hải 25/9/2026): đơn đang được tính NHỜ CỌC thì ghi nhớ, sau này công nợ đổi vẫn tính
    const giuTinh = new Set(giu.map(x => String(x.code).toUpperCase()));
    const nhoCoc = don.filter(o => o.status !== 4 && Number(o.total || 0) > 0 && Number(o.total_payment || 0) <= 0
      && coCoc(o.customer_code) && !giuTinh.has(String(o.code).toUpperCase()));
    if (nhoCoc.length && !CHI_XEM) {
      const r = await fetch(SUPABASE_URL + '/rest/v1/kiot_don_giu_tinh', { method: 'POST', headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(nhoCoc.map(o => ({ code: o.code, customer_code: o.customer_code, ly_do: 'khách có cọc' }))) });
      console.log('Ghi nhớ ' + nhoCoc.length + ' đơn tính nhờ cọc: ' + (r.ok ? 'ok' : r.status));
    }
    nhoCoc.forEach(o => giuTinh.add(String(o.code).toUpperCase()));
    const duDK = o => {
      if (o.status === 4 || !(Number(o.total || 0) > 0)) return false;   // huỷ / đơn 0 đồng (tách, điều chỉnh)
      if (giuTinh.has(String(o.code).toUpperCase())) return true;          // từng tính nhờ cọc -> giữ
      if (o.status === 1 && Number(o.total_payment || 0) <= 0 && !coCoc(o.customer_code)) return false;   // phiếu báo giá
      if (ngay(o.purchase_date) >= MOC && !(Number(o.total_payment || 0) > 0 || coHD[o.customer_code] || coCoc(o.customer_code))) return false;
      return true;
    };
    const donTheoKhach = {};
    don.forEach(o => { const m = String(o.customer_code || '').toUpperCase();
      if (!m || !trongApp.has(m) || !laSi(m) || !duDK(o)) return;
      (donTheoKhach[m] = donTheoKhach[m] || []).push(o); });
    Object.values(donTheoKhach).forEach(a => a.sort((x, y) => String(x.purchase_date).localeCompare(String(y.purchase_date))));

    const laChot = x => /chốt/i.test(x.trang_thai || '') || !!x.ma_don || !!x.ngay_chot;
    const chotTheoKhach = {};
    cs.filter(laChot).forEach(x => { const m = String(x.kiot_code || '').toUpperCase(); if (m) (chotTheoKhach[m] = chotTheoKhach[m] || []).push(x); });

    // 1) RÀ LẠI dòng chốt cũ chưa có mã đơn
    const sua = [];
    const daDung = new Set(cs.filter(x => x.ma_don).map(x => String(x.ma_don).toUpperCase()));
    Object.entries(chotTheoKhach).forEach(([m, ds]) => {
      // dòng GHI ĐÚNG TIỀN khớp trước, dòng chưa ghi tiền khớp sau -- tránh dòng thiếu tiền giành mất đơn
      ds.filter(x => !x.ma_don && x.ngay_chot).sort((a, b) => (a.gia_tri_chot == null) - (b.gia_tri_chot == null)).forEach(x => {
        const khop = (donTheoKhach[m] || []).filter(o => !daDung.has(String(o.code).toUpperCase())
          && lech(ngay(o.purchase_date), x.ngay_chot) <= 1
          && (x.gia_tri_chot == null || Number(x.gia_tri_chot) === Number(o.total)));
        if (khop.length !== 1) return;                       // không khớp / khớp nhiều đơn -> để nguyên, không đoán
        const o = khop[0]; daDung.add(String(o.code).toUpperCase());
        const p = { ma_don: o.code, trang_thai: 'Chốt đơn' };
        if (x.gia_tri_chot == null) p.gia_tri_chot = Number(o.total || 0);
        sua.push({ id: x.id, m, p, o });
      });
    });

    // 2) TẠO MỚI
    const moi = [];
    Object.entries(donTheoKhach).forEach(([m, ds]) => {
      const cu = chotTheoKhach[m] || [];
      const chuaCo = ds.filter(o => !daDung.has(String(o.code).toUpperCase()));
      let lay;
      if (cu.length) {
        const moc = cu.map(x => ngay(x.ngay_chot)).filter(Boolean).sort().pop() || '';
        lay = chuaCo.filter(o => ngay(o.purchase_date) >= MOC && ngay(o.purchase_date) > moc);
      } else {
        const g = ds[ds.length - 1];
        lay = g && !daDung.has(String(g.code).toUpperCase()) ? [g] : [];
      }
      lay.forEach(o => { daDung.add(String(o.code).toUpperCase()); moi.push({ m, o }); });
    });

    console.log(`Rà lại: ${sua.length} dòng chốt cũ gắn được mã đơn`);
    sua.forEach(x => console.log(`   #${x.id} ${x.m} -> ${x.o.code} ${ngay(x.o.purchase_date)} ${vn(x.o.total)}`));
    console.log(`Tạo mới: ${moi.length} dòng Chốt đơn`);
    moi.forEach(x => console.log(`   ${x.m} ${String((byCode[x.m] || {}).name || x.o.customer_name).slice(0, 30)} · ${x.o.code} ${ngay(x.o.purchase_date)} ${vn(x.o.total)} · ${x.o.sold_by_name || ''}`));
    if (CHI_XEM) { console.log('(KHO=1 -> chỉ xem trước, không ghi)'); return; }

    let okSua = 0, okMoi = 0;
    for (const x of sua) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/salesi_crm?id=eq.${x.id}`, { method: 'PATCH', headers: H, body: JSON.stringify(x.p) });
      if (r.ok) okSua++; else console.log('   lỗi sửa #' + x.id + ': ' + (await r.text()).slice(0, 150));
    }
    const rows = moi.map(({ m, o }) => {
      const c = byCode[m] || {};
      return { kiot_code: m, customer_name: c.name || o.customer_name || null, phone: c.phone || null,
        ngay_cham: ngay(o.purchase_date), sales: o.sold_by_name || null,
        trang_thai: 'Chốt đơn', ma_don: o.code, ngay_chot: ngay(o.purchase_date), gia_tri_chot: Number(o.total || 0),
        phan_loai: 'Đã ra đơn', created_by: 'Monsieur Claude' };
    });
    for (let i = 0; i < rows.length; i += 200) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/salesi_crm`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 200)) });
      if (r.ok) okMoi += rows.slice(i, i + 200).length; else console.log('   lỗi tạo: ' + (await r.text()).slice(0, 200));
    }
    console.log(`Đã ghi: sửa ${okSua} · tạo ${okMoi}`);
    await ghiLog({ finished_at: new Date().toISOString(), status: 'success', records_created: okMoi, records_updated: okSua }, logId);
  } catch (e) {
    console.error(e);
    await ghiLog({ finished_at: new Date().toISOString(), status: 'failed', error_message: String(e.message).slice(0, 500) }, logId);
    process.exit(1);
  }
})();
