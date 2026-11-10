// SO KHỚP KIOT ↔ APP MKT, 2 LẦN / NGÀY (anh Hải 10/11/2026: "nhét vào cài đặt nâng cao, tạo phần so khớp, định kỳ ngày 2 lần sáng tối
// check cho t xong report vô đó"). Monsieur Claude. Thay scripts/doi-soat-kiot.js (chỉ báo, không sửa -- lệch nằm đó từ 03/11 không ai biết).
//
// Lịch: chạy CUỐI lượt quét lại toàn bộ Kiot (workflow sync-kiot.yml, backfill): sáng 07:20 VN (pg_cron sync-backfill-kiot) + tối 22:20 VN
// (pg_cron so-khop-toi). Chạy tay: Actions > Sync KiotViet > Run workflow (tick backfill), hoặc `node scripts/so-khop-kiot.js`.
//
// Từng bước:
//  1) Lấy TOÀN BỘ đơn đặt hàng Kiot + hoá đơn từ 1/1/2026 (theo tháng), và bảng kiot_orders / kiot_invoices của app.
//  2) So TỪNG MÃ: app thiếu / app thừa / khác (tiền, trạng thái, mã khách, mã đơn của hoá đơn).
//  3) TỰ SỬA (tối đa TRAN mã / lượt):
//     - app thiếu hoặc khác -> hỏi chi tiết mã đó trên Kiot rồi ghi lại (upsert, như luồng kéo thường).
//     - app thừa -> hỏi lại Kiot đúng mã đó: Kiot trả "không còn tồn tại" mới ĐÁNH DẤU kiot_da_xoa (không xoá dòng). App bỏ dòng đánh dấu;
//       hoá đơn của đơn đã xoá app tính như HĐ bán thẳng (tiền thật vẫn còn). Kiot vẫn còn mã đó -> ghi lại.
//     - dòng đã đánh dấu mà Kiot có lại -> bỏ dấu.
//  4) So lại lần 2 sau khi sửa -> phần còn lệch + bảng theo tháng (số đơn đặt, tiền đơn đặt, số hoá đơn hoàn thành, doanh thu hoá đơn;
//     Kiot vs app) ghi vào bảng kiot_so_khop -> Cài đặt nâng cao > So khớp. Còn lệch -> chuông Cảnh báo dữ liệu của admin.
//  Ghi kèm 1 dòng sync_log 'Đối soát Kiot (tuần)' như job cũ (Data Hub > Đối soát vẫn đọc).
//  5) CHECK CHÉO APP KẾ TOÁN (anh Hải 10/11/2026: "so khớp của m so vs cả của kế toán nữa, nhiều lúc nó sai t cũng cần m check chéo"):
//     CHỈ ĐỌC bảng thô kt_kiot_dat_hang / kt_kiot_hoa_don (từ 1/1/2026) -> so từng mã với Kiot như app MKT (bỏ mã Kiot vừa sửa < 60 phút:
//     2 bên kéo lệch giờ), + đọc kết luận tự soát của Kế toán (kt_kiot_doi_chieu, loai 'thang') để biết họ tự báo đúng không.
//     Kết quả vào cột ke_toan. KHÔNG sửa gì bên Kế toán -- lệch thì báo anh chuyển lời.
const { fetchLai } = require('./lib/fetch-lai.js');
const fetch = (u, o) => fetchLai(u, o, { ten: require('path').basename(__filename) });
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const KIOT_RETAILER = 'sieuthidotho285';
const MOC_HD = '2026-01-01';          // hoá đơn so từ mốc này (app chỉ giữ hoá đơn từ 2026)
const MOC_DON = '2021-01-01';         // đơn đặt hàng: app giữ từ 2021 (khách Sỉ lâu năm)
const TRAN = 300;                     // tối đa số mã tự sửa / lượt
const KHO = process.env.KHO === '1';  // chạy thử: chỉ so + in, KHÔNG ghi gì
const { KIOT_CLIENT_ID, KIOT_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY: SRK } = process.env;
const H = { apikey: SRK, Authorization: 'Bearer ' + SRK };
const Don = require('./sync-kiot-orders.js'), Hd = require('./sync-kiot-invoices.js');

const vnNgay = (s) => {   // Kiot: giờ VN không múi giờ; CSDL: timestamptz -> đổi về giờ VN
  if (!s) return '';
  if (!/[zZ]|[+-]\d\d:\d\d$/.test(s)) return String(s).slice(0, 10);
  return new Date(new Date(s).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
};
async function kiotAll(KH, duong, them) {
  let ra = [], tu = 0;
  for (;;) {
    const r = await fetch(`https://public.kiotapi.com/${duong}?${new URLSearchParams({ pageSize: 100, currentItem: tu, ...them })}`, { headers: KH });
    if (!r.ok) throw new Error(`Kiot ${duong} lỗi ${r.status}: ${(await r.text()).slice(0, 150)}`);
    const d = (await r.json()).data || []; ra = ra.concat(d);
    if (d.length < 100) return ra;
    tu += 100; if (tu > 30000) throw new Error('Kiot ' + duong + ': quá 30.000 dòng, dừng');
    await new Promise((x) => setTimeout(x, 120));
  }
}
async function dbAll(bang, chon, loc) {
  let ra = [], tu = 0;
  for (;;) {
    const j = await (await fetch(`${SUPABASE_URL}/rest/v1/${bang}?select=${chon}${loc || ''}&order=id&limit=1000&offset=${tu}`, { headers: H })).json();
    if (!Array.isArray(j)) throw new Error(bang + ': ' + JSON.stringify(j).slice(0, 150));
    ra = ra.concat(j); if (j.length < 1000) return ra; tu += 1000;
  }
}
async function kiotMa(KH, loai, code) {   // chi tiết 1 mã: {co:true, j} | {co:false} (Kiot báo không còn tồn tại) | throw
  const r = await fetch(`https://public.kiotapi.com/${loai}/code/${encodeURIComponent(code)}`, { headers: KH });
  const t = await r.text();
  if (r.ok) return { co: true, j: JSON.parse(t) };
  if (/không còn tồn tại|not exist|NotFound/i.test(t)) return { co: false };
  throw new Error(`Kiot ${loai}/${code} ${r.status}: ${t.slice(0, 120)}`);
}
async function danhDau(bang, code, xoa) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${bang}?code=eq.${encodeURIComponent(code)}`, { method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ kiot_da_xoa: xoa ? new Date().toISOString() : null }) });
  if (!r.ok) throw new Error(`Đánh dấu ${bang} ${code} lỗi ${r.status}`);
}

const chuanDon = (x, api) => api
  ? { code: x.code, total: Number(x.total || 0), status: x.status, customer_code: x.customerCode || '', ngay: vnNgay(x.purchaseDate), sua: x.modifiedDate || x.createdDate || '' }
  : { code: x.code, total: Number(x.total || 0), status: x.status, customer_code: x.customer_code || '', ngay: vnNgay(x.purchase_date), xoa: !!x.kiot_da_xoa };
const chuanHd = (x, api) => api
  ? { code: x.code, total: Number(x.total || 0), status: x.status, customer_code: x.customerCode || '', order_code: x.orderCode || '', ngay: vnNgay(x.purchaseDate), sua: x.modifiedDate || x.createdDate || '' }
  : { code: x.code, total: Number(x.total || 0), status: x.status, customer_code: x.customer_code || '', order_code: x.order_code || '', ngay: vnNgay(x.purchase_date), xoa: !!x.kiot_da_xoa };
function so(api, db, truong) {   // db: dòng chưa đánh dấu xoá
  const A = new Map(api.map((x) => [x.code, x])), D = new Map(db.filter((x) => !x.xoa).map((x) => [x.code, x]));
  const thieu = api.filter((x) => !D.has(x.code)).map((x) => x.code);
  const thua = [...D.keys()].filter((c) => !A.has(c));
  const khac = [];
  api.forEach((x) => { const d = D.get(x.code); if (!d) return;
    const l = truong.filter((k) => String(x[k] ?? '') !== String(d[k] ?? ''));
    if (l.length) khac.push({ code: x.code, truong: l.map((k) => k + ': app ' + d[k] + ' / Kiot ' + x[k]).join('; ') }); });
  const coLai = db.filter((x) => x.xoa && A.has(x.code)).map((x) => x.code);   // đã đánh dấu xoá mà Kiot có lại
  return { thieu, thua, khac, coLai };
}
function theoThang(donA, donD, hdA, hdD, kt) {
  const homNay = vnNgay(new Date().toISOString()), m = {};
  for (let d = new Date(MOC_HD + 'T00:00:00Z'); d.toISOString().slice(0, 7) <= homNay.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) {
    m[d.toISOString().slice(0, 7)] = { kiot: { don: 0, tienDon: 0, hd: 0, tienHd: 0 }, app: { don: 0, tienDon: 0, hd: 0, tienHd: 0 }, kt: kt ? { don: 0, tienDon: 0, hd: 0, tienHd: 0 } : null };
  }
  const cong = (ds, ben, loai) => ds.forEach((x) => { const t = m[x.ngay.slice(0, 7)]; if (!t || x.xoa) return;
    if (loai === 'don' && x.status !== 4) { t[ben].don++; t[ben].tienDon += x.total; }
    if (loai === 'hd' && x.status === 1) { t[ben].hd++; t[ben].tienHd += x.total; } });
  cong(donA, 'kiot', 'don'); cong(donD, 'app', 'don'); cong(hdA, 'kiot', 'hd'); cong(hdD, 'app', 'hd');
  if (kt) { cong(kt.don, 'kt', 'don'); cong(kt.hd, 'kt', 'hd'); }
  const bang = (v, b) => ['don', 'tienDon', 'hd', 'tienHd'].every((k) => Math.round(v.kiot[k]) === Math.round(v[b][k]));
  return Object.entries(m).map(([thang, v]) => ({ thang, ...v, khop: bang(v, 'app'), khopKt: kt ? bang(v, 'kt') : null }));
}
async function ghi(bang, body, id) {
  if (KHO) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${bang}${id ? '?id=eq.' + id : ''}`, { method: id ? 'PATCH' : 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null); return Array.isArray(j) && j[0] ? j[0].id : null;
}

(async () => {
  if (!KIOT_CLIENT_ID || !KIOT_CLIENT_SECRET || !SRK) { console.error('Thiếu KIOT_CLIENT_ID / KIOT_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const gioVN = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  const buoi = process.env.BUOI || (gioVN < 12 ? 'sáng' : 'tối');
  const id = await ghi('kiot_so_khop', { buoi, trang_thai: 'running' }).catch(() => null);
  const idLog = await ghi('sync_log', { source: 'Đối soát Kiot (tuần)', status: 'running' }).catch(() => null);
  try {
    const token = await Don.getToken();
    const KH = { Retailer: KIOT_RETAILER, Authorization: 'Bearer ' + token };
    const layKiot = async () => {
      const don = (await kiotAll(KH, 'orders', { orderBy: 'createdDate', orderDirection: 'Asc' })).map((x) => chuanDon(x, true)).filter((x) => x.ngay >= MOC_DON);
      let hd = [];
      const homNay = vnNgay(new Date().toISOString());
      for (let d = new Date(MOC_HD + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= homNay; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const tu = d.toISOString().slice(0, 10), cuoi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
        hd = hd.concat(await kiotAll(KH, 'invoices', { fromPurchaseDate: tu, toPurchaseDate: cuoi + 'T23:59:59', orderBy: 'purchaseDate', orderDirection: 'Asc' }));
      }
      return { don, hd: hd.map((x) => chuanHd(x, true)).filter((x) => x.ngay >= MOC_HD) };
    };
    const layApp = async () => ({
      don: (await dbAll('kiot_orders', 'code,total,status,customer_code,purchase_date,kiot_da_xoa')).map((x) => chuanDon(x, false)),
      hd: (await dbAll('kiot_invoices', 'code,total,status,customer_code,order_code,purchase_date,kiot_da_xoa', '&purchase_date=gte.' + MOC_HD)).map((x) => chuanHd(x, false)),
    });
    const K = await layKiot(); let A = await layApp();
    const s1 = { don: so(K.don, A.don, ['total', 'status', 'customer_code']), hd: so(K.hd, A.hd, ['total', 'status', 'customer_code', 'order_code']) };
    console.log('Lượt 1 · đơn:', JSON.stringify({ thieu: s1.don.thieu.length, thua: s1.don.thua.length, khac: s1.don.khac.length, coLai: s1.don.coLai.length }),
      '· hoá đơn:', JSON.stringify({ thieu: s1.hd.thieu.length, thua: s1.hd.thua.length, khac: s1.hd.khac.length, coLai: s1.hd.coLai.length }));

    // ── TỰ SỬA ──
    const daSua = [], loi = []; let dem = 0;
    const dm = await Hd.danhMucKenh(token);
    const keoLai = async (loai, code, ly) => {
      if (KHO) { daSua.push({ loai, code, ly, xu_ly: '(chạy thử, chưa sửa)' }); return; }
      if (dem++ >= TRAN) { loi.push({ loai, code, ly: 'quá trần ' + TRAN + ' mã / lượt' }); return; }
      try {
        const k = await kiotMa(KH, loai === 'don' ? 'orders' : 'invoices', code);
        if (!k.co) {
          if (ly === 'app thừa') { await danhDau(loai === 'don' ? 'kiot_orders' : 'kiot_invoices', code, true); daSua.push({ loai, code, ly, xu_ly: 'Kiot đã xoá -> đánh dấu, app bỏ' }); }
          else loi.push({ loai, code, ly: ly + ' nhưng Kiot báo không còn tồn tại' });
          return;
        }
        if (loai === 'don') { const rows = [Don.mapOrder(k.j)].map((r) => ({ ...r, kiot_da_xoa: null })); await Don.ganKenh(token, rows); await Don.upsert(rows); }
        else await Hd.upsertRows('kiot_invoices', [{ ...Hd.mapInvoice(k.j, dm), kiot_da_xoa: null }], 'id');
        daSua.push({ loai, code, ly, xu_ly: 'kéo lại từ Kiot' });
      } catch (e) { loi.push({ loai, code, ly: ly + ' · ' + e.message.slice(0, 120) }); }
      await new Promise((x) => setTimeout(x, 150));
    };
    for (const loai of ['don', 'hd']) {
      const s = s1[loai];
      for (const c of s.thieu) await keoLai(loai, c, 'app thiếu');
      for (const x of s.khac) await keoLai(loai, x.code, 'khác: ' + x.truong);
      for (const c of s.thua) await keoLai(loai, c, 'app thừa');
      for (const c of s.coLai) { if (KHO) { daSua.push({ loai, code: c, ly: 'Kiot có lại', xu_ly: '(chạy thử)' }); continue; } try { await danhDau(loai === 'don' ? 'kiot_orders' : 'kiot_invoices', c, false); daSua.push({ loai, code: c, ly: 'Kiot có lại', xu_ly: 'bỏ dấu đã xoá' }); } catch (e) { loi.push({ loai, code: c, ly: e.message }); } }
    }

    // ── SO LẠI LẦN 2 ──
    if (daSua.length && !KHO) A = await layApp();
    const s2 = { don: so(K.don, A.don, ['total', 'status', 'customer_code']), hd: so(K.hd, A.hd, ['total', 'status', 'customer_code', 'order_code']) };
    const lech = [];
    [['don', 'Đơn đặt hàng'], ['hd', 'Hoá đơn']].forEach(([k, ten]) => {
      s2[k].thieu.forEach((c) => lech.push({ loai: ten, code: c, kieu: 'app thiếu' }));
      s2[k].thua.forEach((c) => lech.push({ loai: ten, code: c, kieu: 'app thừa (Kiot không trả trong danh sách)' }));
      s2[k].khac.forEach((x) => lech.push({ loai: ten, code: x.code, kieu: 'khác · ' + x.truong }));
    });
    // ── CHECK CHÉO KẾ TOÁN (chỉ đọc) ──
    let KT = null, keToan = null;
    try {
      KT = {
        don: (await dbAll('kt_kiot_dat_hang', 'ma,tong,trang_thai,khach_ma,ngay', '&ngay=gte.' + MOC_HD)).map((x) => ({ code: x.ma, total: Number(x.tong || 0), status: x.trang_thai, customer_code: x.khach_ma || '', ngay: vnNgay(x.ngay) })),
        hd: (await dbAll('kt_kiot_hoa_don', 'ma,tong,trang_thai,khach_ma,ma_dat_hang,ngay', '&ngay=gte.' + MOC_HD)).map((x) => ({ code: x.ma, total: Number(x.tong || 0), status: x.trang_thai, customer_code: x.khach_ma || '', order_code: x.ma_dat_hang || '', ngay: vnNgay(x.ngay) })),
      };
      const moi = (x) => x.sua && Date.now() - new Date(/[zZ]|[+-]\d\d:\d\d$/.test(x.sua) ? x.sua : x.sua + '+07:00').getTime() < 60 * 60000;
      const vuaSua = new Set(K.don.concat(K.hd).filter(moi).map((x) => x.code));
      const daXoa = new Set(A.don.concat(A.hd).filter((x) => x.xoa).map((x) => x.code));
      const kDon = K.don.filter((x) => x.ngay >= MOC_HD);
      const sk = { don: so(kDon, KT.don, ['total', 'status', 'customer_code']), hd: so(K.hd, KT.hd, ['total', 'status', 'customer_code', 'order_code']) };
      const lk = [];
      [['don', 'Đơn đặt hàng'], ['hd', 'Hoá đơn']].forEach(([k, ten]) => {
        sk[k].thieu.filter((c) => !vuaSua.has(c)).forEach((c) => lk.push({ loai: ten, code: c, kieu: 'Kế toán thiếu' }));
        sk[k].thua.forEach((c) => lk.push({ loai: ten, code: c, kieu: daXoa.has(c) ? 'Kế toán còn giữ mã Kiot đã xoá' : 'Kế toán thừa (Kiot không có)' }));
        sk[k].khac.filter((x) => !vuaSua.has(x.code)).forEach((x) => lk.push({ loai: ten, code: x.code, kieu: 'khác · ' + x.truong.replace(/: app /g, ': Kế toán ') }));
      });
      let tuSoat = {};
      try {
        (await dbAll('kt_kiot_doi_chieu', 'luc,loai,thang,khop,so_lech', '&loai=eq.thang')).forEach((x) => {
          const c = tuSoat[x.thang]; if (!c || String(x.luc) > String(c.luc)) tuSoat[x.thang] = { luc: x.luc, khop: x.khop, so_lech: x.so_lech }; });
      } catch (e) { tuSoat = { loi: e.message.slice(0, 120) }; }
      keToan = { so_ma: KT.don.length + KT.hd.length, so_lech: lk.length, lech: lk.slice(0, 300), tu_soat: tuSoat, bo_qua_vua_sua: vuaSua.size };
      console.log('Kế toán: ' + lk.length + ' mã lệch Kiot (bỏ ' + vuaSua.size + ' mã vừa sửa < 60 phút)');
      lk.slice(0, 30).forEach((x) => console.log('  KT', x.loai, x.code, x.kieu));
    } catch (e) { keToan = { loi: 'Không đọc được bảng Kế toán: ' + e.message.slice(0, 150) }; KT = null; console.log(keToan.loi); }
    const thang = theoThang(K.don, A.don, K.hd, A.hd, KT);
    const thangLech = thang.filter((t) => !t.khop).map((t) => t.thang);
    const soMa = K.don.length + K.hd.length;
    const tt = lech.length || thangLech.length ? 'lech' : 'khop';
    const ghiChu = (tt === 'khop' ? 'Khớp từng mã' : 'Còn ' + lech.length + ' mã lệch' + (thangLech.length ? ' · tháng lệch ' + thangLech.join(', ') : ''))
      + (daSua.length ? ' · đã tự sửa ' + daSua.length + ' mã' : '') + (loi.length ? ' · ' + loi.length + ' mã chưa sửa được' : '')
      + (keToan ? (keToan.loi ? ' · Kế toán: chưa đọc được' : keToan.so_lech ? ' · Kế toán lệch Kiot ' + keToan.so_lech + ' mã' : ' · Kế toán khớp Kiot') : '');
    await ghi('kiot_so_khop', { trang_thai: tt, so_ma: soMa, so_lech: lech.length, thang, lech: lech.slice(0, 300).concat(loi.slice(0, 50).map((x) => ({ loai: x.loai === 'don' ? 'Đơn đặt hàng' : 'Hoá đơn', code: x.code, kieu: 'chưa sửa được · ' + x.ly }))),
      da_sua: daSua.slice(0, 300).map((x) => ({ ...x, loai: x.loai === 'don' ? 'Đơn đặt hàng' : 'Hoá đơn' })), ghi_chu: ghiChu, ke_toan: keToan }, id);
    await ghi('sync_log', { finished_at: new Date().toISOString(), status: 'success', records_created: soMa, records_updated: lech.length,
      error_message: lech.length ? lech.slice(0, 20).map((x) => x.loai + ' ' + x.kieu.split(' ·')[0] + ' ' + x.code).join(' | ').slice(0, 1500) : null }, idLog);
    console.log(ghiChu);
    daSua.forEach((x) => console.log('  sửa', x.loai, x.code, x.ly, '->', x.xu_ly));
    loi.forEach((x) => console.log('  CHƯA SỬA', x.loai, x.code, x.ly));
  } catch (e) {
    await ghi('kiot_so_khop', { trang_thai: 'loi', ghi_chu: String(e.message).slice(0, 500) }, id).catch(() => null);
    await ghi('sync_log', { finished_at: new Date().toISOString(), status: 'failed', error_message: String(e.message).slice(0, 500) }, idLog).catch(() => null);
    console.error('LỖI', e.message); process.exit(1);
  }
})();
