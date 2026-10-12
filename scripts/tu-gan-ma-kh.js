// TỰ GẮN MÃ KH KIOT cho khách ĐÃ CHỐT mà chưa có Mã KH (anh Hải 12/10/2026: "m tự gắn mã KH luôn đi, case nào thực sự
// không đoán được thì mới để vào mục Đã chốt đơn nhưng CHƯA có Mã KH Kiot").
// Dùng ĐÚNG hàm dựng Master của app (scripts/lib/nap-app.js) -> cùng danh sách Daily Task "thieuMa" Sale đang thấy.
// CHỈ gắn khi CHẮC CHẮN, đủ cả 4:
//   1) SĐT của khách (Pancake + số Sale ghi) khớp ĐÚNG 1 khách Kiot (gợi ý theo SĐT của app ra đúng 1 mã);
//   2) mã đó CHƯA thuộc khách nào khác trong app (cả Lẻ lẫn Sỉ) -- không để 2 người chung 1 mã;
//   3) khách Kiot đó có ĐƠN CHƯA HUỶ (kể cả phiếu tạm) từ 7 ngày trước ngày tạo khách trở đi = bằng chứng đúng người.
//      Gắn mã chỉ là NỐI ĐÚNG NGƯỜI; tính doanh thu hay không vẫn theo luật dấu vết tiền (phiếu tạm chưa tiền chưa tính);
//   4) đúng loại: khách Kiot là Sỉ thì chỉ gắn cho khách báo cáo Sỉ, Lẻ cho Lẻ.
// Ghi vào saleretail_manual.kiot_code (đường "Sale nhập" sẵn có của app) + activity_log. KHÔNG sửa đơn Pancake.
// Gỡ: xoá kiot_code của lead đó (updated_by = 'Tự gắn Mã KH'). KHO=1 = chỉ xem trước.
const vm = require('vm');
const { napApp, masterCua, SUPABASE_URL, H } = require('./lib/nap-app.js');
const KHO = process.env.KHO === '1';
const NGUOI = 'Tự gắn Mã KH';
(async () => {
  // chạy kèm mỗi lượt đồng bộ Kiot (15 phút) nhưng CHỈ khi dữ liệu đổi (nạp app ~vài MB -- giữ egress), chắc chắn 6 giờ/lần
  const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || H.apikey;
  const luot = KHO ? { chay: true, xong: async () => {}, loi: async () => {} }
    : await require('./lib/gianh-moc').gianhKhiDoi('https://bcrpxfvvjsjpvbksqzls.supabase.co', KHOA, 'tu-gan-ma-kh');
  if (!luot.chay) { console.log('Dữ liệu không đổi từ lần chạy trước — bỏ qua lượt này.'); return; }
  try { await chay(); await luot.xong().catch(() => {}); }
  catch (e) { await luot.loi().catch(() => {}); throw e; }
})().catch((e) => { console.error('LOI', e.message); process.exit(1); });
async function chay() {
  const ctx = await napApp();
  const run = (c) => vm.runInContext(c, ctx);
  // mã đang dùng ở BẤT KỲ khách nào (Lẻ + Sỉ)
  const dangDung = new Set();
  const ung = [];
  for (const t of ['Lẻ', 'Sỉ']) {
    masterCua(ctx, t);
    run('rptSlXoaCache()');
    JSON.parse(run(`JSON.stringify(rptSlBuildMaster().flatMap(r=>[r.kh].concat((r.kiotCusts||[]).map(c=>c.code))).filter(Boolean))`))
      .forEach((m) => dangDung.add(String(m).toUpperCase()));
    const ds = JSON.parse(run(`JSON.stringify(rptSlTodoBuckets().thieuMa.map(r=>{
      const ma=[...new Set((r.suggest||[]).map(c=>String(c.code).toUpperCase()))];
      const ord=kiotOrdByCode('');
      const moc=new Date(new Date(String(r.created||'').slice(0,10)).getTime()-7*86400000).toISOString().slice(0,10);
      const coDon=ma.length===1&&(ord[ma[0]]||[]).some(o=>o.status!==4&&Number(o.total||0)>0&&String(o.purchase_date).slice(0,10)>=moc);
      const kc=ma.length===1?kiotCustByCode()[ma[0]]:null;
      return {leadId:r.leadId,ten:r.name,tao:String(r.created||'').slice(0,10),sdt:r.phone||'',ma,coDon,
        loaiKiot:kc?kiotLoaiKhach(kc):'',tenKiot:kc?kc.name:''};}))`));
    ds.forEach((x) => ung.push({ ...x, loai: t }));
  }
  const gan = [], de = [];
  ung.forEach((x) => {
    const ly = x.ma.length === 0 ? 'SĐT không khớp khách Kiot nào'
      : x.ma.length > 1 ? 'SĐT khớp ' + x.ma.length + ' khách Kiot (' + x.ma.join(', ') + ')'
      : dangDung.has(x.ma[0]) ? x.ma[0] + ' đã thuộc khách khác trong app'
      : !x.coDon ? x.ma[0] + ' chưa có đơn nào (chưa huỷ) từ lúc khách nhắn'
      : (x.loaiKiot && x.loaiKiot !== x.loai) ? x.ma[0] + ' là khách ' + x.loaiKiot + ' bên Kiot' : '';
    if (ly) de.push({ ...x, ly }); else { gan.push(x); dangDung.add(x.ma[0]); }
  });
  console.log(`Khách đã chốt chưa có Mã KH: ${ung.length} · TỰ GẮN được ${gan.length} · để lại cho Sale ${de.length}`);
  gan.forEach((x) => console.log(`  GẮN  [${x.loai}] ${x.leadId} ${x.ten} (${x.sdt}) -> ${x.ma[0]} ${x.tenKiot}`));
  de.forEach((x) => console.log(`  ĐỂ   [${x.loai}] ${x.leadId} ${x.ten} (${x.sdt}): ${x.ly}`));
  if (KHO || !gan.length) { if (KHO) console.log('(KHO=1 -> chỉ xem trước, không ghi)'); return; }
  const luc = new Date().toISOString();
  const r = await fetch(`${SUPABASE_URL}/saleretail_manual?on_conflict=lead_id`, { method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(gan.map((x) => ({ lead_id: x.leadId, kiot_code: x.ma[0], updated_at: luc, updated_by: NGUOI }))) });
  if (!r.ok) { console.error('Ghi lỗi', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  await fetch(`${SUPABASE_URL}/activity_log`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(gan.map((x) => ({ who: NGUOI, act: 'U', tbl: 'saleretail_manual', ref: x.leadId, label: x.ten,
      fld: 'Mã KH (tự gắn theo SĐT)', old_v: null, new_v: x.ma[0] + ' · ' + x.tenKiot }))) }).catch(() => {});
  console.log(`Đã gắn ${gan.length} khách.`);
}
