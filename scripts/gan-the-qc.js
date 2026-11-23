// TỰ TẠO ĐƠN + GẮN THẺ KHÁCH PANCAKE THEO ĐÁNH GIÁ QC — MỖI HỘI THOẠI 1 LẦN LÚC ĐẦU (anh Hải 23/11/2026).
//   "m chỉ cần gắn thẻ tiềm năng vs đạt trên pancake lúc đầu thôi", "chấm trên pancake á, còn nó chấm nội dung tin nhắn",
//   "để sale tự đổi trạng thái ... sale đổi trong app thì m ghi nhận là được", "cái gắn thẻ này cũng xử lý từ tháng 11 thôi",
//   "m nhầm thẻ rồi ... thẻ kh cơ mà" (thẻ KHÁCH POS, không phải thẻ hội thoại),
//   THÔNG BÁO NHÂN VIÊN 23/11 09:53: "từ hôm nay mọi người không cần gắn thẻ hay tạo đơn gì trên pancake nữa, phần đấy e sẽ tự xử lý"
//   -> anh: "từ hôm nay m tự tạo đơn, gắn sỉ lẻ, tiềm năng vs đạt trên pancake luôn", "m tự gắn sỉ lẻ cho data mới từ hôm nay, cái nào
//   sale gắn thì thôi, ưu tiên dữ liệu của sale".
// Nguồn: view qc_khach_tiem_nang_ngay (app QC, 2 lượt chấm / ngày 12h–14h & 20h–22h VN), dòng ngay >= 1/11/2026.
//   TIỀM NĂNG = chua_khai_thac hoặc nhom 'tiem_nang' (THEO ĐÚNG QC — 23/11 ~10h40 anh: "báo giá xong không nói gì ... là đạt thôi") -> "LEAD TIỀM NĂNG"
//   NÂNG THẺ: hội thoại đã gắn LEAD ĐẠT mà QC chuyển sang tiềm năng (khách nhắn lại) -> thêm LEAD TIỀM NĂNG nếu Sale chưa đụng (thẻ khách
//   chưa có CHỐT ĐƠN / LEAD KO ĐẠT / TIỀM NĂNG, Phân loại app không do người chọn). KHÔNG tự hạ tiềm năng -> đạt.
//   ĐẠT = phần còn lại -> thẻ khách "LEAD ĐẠT"
//   SỈ / LẺ = cột loai_khach của QC ('si' -> KH SỈ, còn lại KH LẺ) — CHỈ gắn khi khách chưa có KH SỈ / KH LẺ (Sale gắn rồi thì giữ).
// Mỗi hội thoại (chưa có trong nhật ký pancake_gan_the_qc):
//   1. Sale đã xử lý trên app (đã chốt / Phân loại khác Lead mới & Tiềm năng) -> bỏ qua hết. Sale chọn "Tiềm năng, chưa ra đơn" -> LEAD TIỀM NĂNG.
//   2. CHƯA CÓ ĐƠN Pancake -> TẠO 1 ĐƠN TRẮNG (trạng thái Mới) trên shop của page, nối conversation + khách FB, SĐT nếu QC có; ghi luôn
//      Sale gán tay = Sale QC ghi (saleretail_manual.si_sale) để khách về đúng người đang chat. KHÔNG nhắn gì cho khách.
//      Không tạo: "Khách từ chối hẳn" (nhóm bỏ qua), page không có shop POS (TikTok). Chống trùng: hội thoại đã có đơn trong hub, đã có
//      trong nhật ký job tạo đơn từ SĐT (pancake_tu_tao_don), hoặc Pancake báo hội thoại vừa có đơn (recent_orders) -> không tạo.
//   3. Thẻ khách POS: đọc shop_customer.tags NGAY TRƯỚC khi ghi (PUT ghi đè cả bộ — bài học 30/9), chỉ THÊM: KH SỈ / KH LẺ nếu thiếu;
//      LEAD TIỀM NĂNG / LEAD ĐẠT nếu khách chưa có CHỐT ĐƠN / LEAD KO ĐẠT / *TIỀM NĂNG* (hoặc LEAD ĐẠT khi gắn đạt). Cập nhật luôn
//      datahub_orders.customer_tags của đơn (như pancake-note) để app thấy ngay.
// Lịch (23/11 trưa): bước trong sync-datahub.yml (10 phút / lần, có concurrency), CHỈ làm việc khi view QC có lần chấm mới (dấu ở job_moc
//   'gan-the-qc') hoặc còn đơn chờ ghi bù; CHAY_NGAY=1 bỏ kiểm dấu. Không còn khung 14h / 22h.
// KHO=1: chạy thử, chỉ in số. GIOI_HAN=n: chỉ xử lý n hội thoại (thử từng ít một).
const fs = require('fs'), path = require('path');
const { sbAll } = require('./lib/sb');
const KEYS = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8'); } catch (e) { return ''; } })();
const TOKEN = process.env.PANCAKE_SESSION_TOKEN || (KEYS.match(/PANCAKE_SESSION_TOKEN[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (KEYS.match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const SB = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const XEM = process.env.KHO === '1';
const GIOI_HAN = Number(process.env.GIOI_HAN || 0) || Infinity;
const TU_NGAY = '2026-11-01';
const THE_NHOM = { tiem_nang: 'LEAD TIỀM NĂNG', dat: 'LEAD ĐẠT' };
// page Facebook -> shop POS (giống scripts/tu-tao-don-hoi-thoai.js)
const PAGE_SHOP = { '506247572578559': 1943052948, '107224335550589': 1022031789, '105133802417722': 1943096391, '107792638827892': 715061393, '100667699549693': 408040224 };
const SHOP_CODE = { 1022031789: 'CT', 1943057093: 'CT2', 100965386: 'CT3', 1021966905: 'CT4', 1943096391: 'HT', 715061393: 'HT2', 408077426: 'HT3', 1943052948: 'SD', 408040224: 'TTV', 1329071685: 'CTT' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const an = s => String(s || '').split(TOKEN || '\u0000').join('***');
const pos = p => `https://pos.pages.fm/api/v1/${p}${p.includes('?') ? '&' : '?'}access_token=${TOKEN}`;
const HSB = { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json' };
async function lay(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) return null; } catch (e) { /* thử lại */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
function nhomCua(q) {
  if (q.chua_khai_thac === true || q.nhom === 'tiem_nang') return 'tiem_nang';
  return 'dat';
}
function daXep(tags, nhom) {   // thẻ trạng thái khách đã có -> không gắn LEAD
  const t = tags.map(x => String(x).toUpperCase().trim());
  return t.find(x => /CHỐT ĐƠN/.test(x)) || t.find(x => /LEAD KO ĐẠT/.test(x)) || t.find(x => /TIỀM NĂNG/.test(x)) || (nhom === 'dat' ? t.find(x => x === 'LEAD ĐẠT') : null);
}
const coSiLe = tags => tags.some(x => /^KH (SỈ|LẺ)$/i.test(String(x).trim()));

(async () => {
  if (!TOKEN || !KHOA) { console.error('Thiếu PANCAKE_SESSION_TOKEN / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  // LỊCH (anh Hải 23/11/2026: "data chậm nhất 1-2h là phải có rồi", "xếp lại lịch sao cho ít phải xử lý nhất và đỡ tốn token nhất"):
  // BỎ khung 14h / 22h. Chạy theo mỗi lượt đồng bộ Pancake (10 phút) nhưng CHỈ LÀM VIỆC KHI VIEW QC ĐỔI (dấu = lần chấm mới nhất + số dòng,
  // lưu job_moc 'gan-the-qc') hoặc còn đơn job tạo chờ ghi bù Sale / ngày. Không đổi -> thoát sau 2 câu hỏi rất nhẹ.
  const HJ = { ...HSB };
  const dauR = await fetch(`${SB}/rest/v1/qc_khach_tiem_nang_ngay?select=danh_gia_luc&ngay=gte.${TU_NGAY}&order=danh_gia_luc.desc&limit=1`, { headers: { ...HJ, Prefer: 'count=exact' } });
  if (!dauR.ok) throw new Error('Đọc view QC lỗi ' + dauR.status);
  // + số dòng tiềm năng: QC đổi LUẬT nhóm (không chấm lại) thì danh_gia_luc / số dòng có thể giữ nguyên mà nhóm đổi (23/11)
  const tnR = await fetch(`${SB}/rest/v1/qc_khach_tiem_nang_ngay?select=pancake_conversation_id&ngay=gte.${TU_NGAY}&nhom=eq.tiem_nang&limit=1`, { headers: { ...HJ, Prefer: 'count=exact' } });
  const dau = String(((await dauR.json())[0] || {}).danh_gia_luc || '') + '|' + String(dauR.headers.get('content-range') || '').split('/')[1]
    + '|tn' + String((tnR.ok && tnR.headers.get('content-range')) || '').split('/')[1];
  const moc = (await sbAll(SB, KHOA, 'job_moc', 'select=dau_van&ten=eq.gan-the-qc'))[0];
  const choBu = (await sbAll(SB, KHOA, 'pancake_gan_the_qc', 'select=conversation_id&order_id=not.is.null&or=(sale_gan.is.null,ngay_nhan.is.null)&limit=1')).length;
  if (process.env.CHAY_NGAY !== '1' && moc && moc.dau_van === dau && !choBu) { console.log('Gắn thẻ QC: view QC chưa có lần chấm mới — bỏ qua'); return; }
  const luuDau = async () => { if (XEM) return;
    await fetch(`${SB}/rest/v1/job_moc?on_conflict=ten`, { method: 'POST', headers: { ...HJ, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ ten: 'gan-the-qc', dau_van: dau, luc: new Date().toISOString(), ghi_chu: 'xong' }]) }); };

  const view = await sbAll(SB, KHOA, 'qc_khach_tiem_nang_ngay', 'select=ngay,page_id,pancake_conversation_id,ten_khach,sdt,sale,nhom,ly_do_nhom,chua_khai_thac,loai_khach&ngay=gte.' + TU_NGAY + '&order=pancake_conversation_id');
  // GHI BÙ SALE cho đơn job đã tạo: lúc tạo Pancake chưa trả số đơn (system_id) -> chờ đơn về hub rồi ghi Sale gán tay = Sale QC
  // vào saleretail_manual (lead_id L-<shop>-<system_id>), chỉ khi dòng chưa có Sale gán tay (Sale / admin gán rồi thì giữ).
  // + NGÀY TẠO = NGÀY KHÁCH NHẮN (anh Hải 23/11/2026, ảnh Master toàn 23/11 kèm thẻ AI: "ngày tạo của AI cho chuẩn với ngày khách nhắn"):
  //   ghi saleretail_manual.ngay_tao_sua = ngày mở hội thoại (inserted_at Pancake, UTC -> giờ VN), chỉ khi ô còn trống.
  {
    const cho = await sbAll(SB, KHOA, 'pancake_gan_the_qc', 'select=conversation_id,page_id,shop_id,order_id,sale_gan,ngay_nhan&order_id=not.is.null&or=(sale_gan.is.null,ngay_nhan.is.null)&order=conversation_id');
    const saleCua = {}; view.forEach(q => { saleCua[q.pancake_conversation_id] = q.sale; });
    let bu = 0, buNgay = 0;
    for (const x of cho) {
      if (XEM) continue;
      const sale = saleCua[x.conversation_id];
      const o = (await sbAll(SB, KHOA, 'datahub_orders', 'select=system_id&shop_id=eq.' + x.shop_id + '&order_id=eq.' + x.order_id))[0];
      if (!o || !o.system_id || !SHOP_CODE[x.shop_id]) continue;   // đơn chưa về hub -> lượt sau
      const lead = 'L-' + SHOP_CODE[x.shop_id] + '-' + String(o.system_id).padStart(4, '0');
      const cu = (await sbAll(SB, KHOA, 'saleretail_manual', 'select=si_sale,ngay_tao_sua&lead_id=eq.' + encodeURIComponent(lead)))[0] || {};
      let ngay = x.ngay_nhan;
      if (!ngay) {
        const c = await lay(`https://pancake.vn/api/v1/pages/${x.page_id}/conversations/${x.conversation_id}?access_token=${TOKEN}`);
        const ins = c && (c.conversation || c).inserted_at;
        if (ins) ngay = new Date(Date.parse(/Z|[+-]\d\d:?\d\d$/.test(ins) ? ins : ins + 'Z') + 7 * 3600e3).toISOString().slice(0, 10);
      }
      const ghiM = {};
      if (sale && !cu.si_sale && !x.sale_gan) ghiM.si_sale = sale;
      if (ngay && !cu.ngay_tao_sua) ghiM.ngay_tao_sua = ngay;
      if (Object.keys(ghiM).length) {
        const r = await fetch(`${SB}/rest/v1/saleretail_manual?on_conflict=lead_id`, { method: 'POST', headers: { ...HSB, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ lead_id: lead, ...ghiM, updated_by: 'Monsieur Claude (QC)', updated_at: new Date().toISOString() }]) });
        if (!r.ok) { console.log('  ghi Sale / ngày lỗi', lead, r.status); continue; }
        if (ghiM.si_sale) bu++; if (ghiM.ngay_tao_sua) buNgay++;
      }
      const capNhat = {};
      if (!x.sale_gan) capNhat.sale_gan = cu.si_sale ? 'giữ ' + cu.si_sale : (sale || '(QC không ghi Sale)');
      if (!x.ngay_nhan && ngay) capNhat.ngay_nhan = ngay;
      if (Object.keys(capNhat).length) await fetch(`${SB}/rest/v1/pancake_gan_the_qc?conversation_id=eq.${encodeURIComponent(x.conversation_id)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify(capNhat) });
      await sleep(150);
    }
    if (cho.length) console.log(`Ghi bù cho đơn job tạo: Sale ${bu} · ngày khách nhắn ${buNgay} / ${cho.length} dòng chờ`);
  }
  const nkCu = await sbAll(SB, KHOA, 'pancake_gan_the_qc', 'select=conversation_id,nhom,ket,tag_ten,the_truoc,the_si_le,the_sau,shop_id&order=conversation_id');
  const da = new Set(nkCu.map(r => r.conversation_id));
  const moi = view.filter(q => q.page_id && q.pancake_conversation_id && !da.has(q.pancake_conversation_id)).slice(0, GIOI_HAN);
  // ĐỒNG BỘ NHÓM (anh Hải 23/11/2026 ~10h45: "xử lý lại đống data trên app và pancake cho chuẩn theo rule vừa làm luôn, clear bớt tiềm năng đi"):
  // hội thoại job ĐÃ gắn LEAD mà QC nay xếp nhóm khác -> sửa thẻ theo QC, CHỈ KHI SALE CHƯA ĐỤNG: thẻ khách hiện tại đúng y bộ job để lại
  // (the_sau; dòng cũ chưa có thì dựng = the_truoc + Sỉ/Lẻ + LEAD job gắn) và Phân loại app không do người chọn.
  //   tiềm năng -> đạt: gỡ LEAD TIỀM NĂNG (chỉ khi do job gắn), thêm LEAD ĐẠT nếu thiếu.   đạt -> tiềm năng: thêm LEAD TIỀM NĂNG.
  const viewCua = {}; view.forEach(q => { viewCua[q.pancake_conversation_id] = q; });
  const doiNhom = nkCu.filter(x => x.ket === 'gan' && x.tag_ten && viewCua[x.conversation_id] && nhomCua(viewCua[x.conversation_id]) !== x.nhom).slice(0, GIOI_HAN);
  console.log(`Gắn thẻ QC: view ${view.length} hội thoại · đã xử lý trước ${da.size} · mới ${moi.length} · đổi nhóm ${doiNhom.length}${XEM ? ' (KHO=1: chạy thử)' : ''}`);
  if (!moi.length && !doiNhom.length) { await luuDau(); return; }

  const donCua = {}, donTheoConv = {}, donTheoSo = {};
  const l9 = s => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };
  (await sbAll(SB, KHOA, 'datahub_orders', 'select=shop_id,order_id,system_id,phone,conversation_id,order_date&order=order_date.desc'))
    .forEach(o => {
      if (o.conversation_id) { if (!donCua[o.conversation_id]) donCua[o.conversation_id] = o; (donTheoConv[o.conversation_id] = donTheoConv[o.conversation_id] || []).push(o); }
      const k = l9(o.phone); if (k) (donTheoSo[k] = donTheoSo[k] || []).push(o);
    });
  const jobSdt = new Set((await sbAll(SB, KHOA, 'pancake_tu_tao_don', 'select=conversation_id&conversation_id=not.is.null&order=conversation_id')).map(r => r.conversation_id));

  // TRẠNG THÁI SALE TRÊN APP (ưu tiên) — ĐỌC NHẸ (23/11/2026, thay nạp cả app): Lead ID của mọi đơn cùng hội thoại + cùng SĐT
  // (L-<shop>-<system_id>) -> ô Phân loại KH (saleretail_manual.si_phan_loai) do NGƯỜI chọn (người sửa cuối không phải job).
  // Khách đã chốt: thẻ khách CHỐT ĐƠN (daXep) chặn ở bước gắn thẻ.
  const ttApp = {};
  {
    const leadCua = {};
    moi.concat(doiNhom.map(x => viewCua[x.conversation_id])).forEach(q => {
      const ds = [...(donTheoConv[q.pancake_conversation_id] || [])];
      ds.slice().forEach(o => { const k = l9(o.phone); if (k) ds.push(...(donTheoSo[k] || [])); });
      leadCua[q.pancake_conversation_id] = [...new Set(ds.filter(o => SHOP_CODE[o.shop_id] && o.system_id).map(o => 'L-' + SHOP_CODE[o.shop_id] + '-' + String(o.system_id).padStart(4, '0')))];
    });
    const tat = [...new Set(Object.values(leadCua).flat())], man = {};
    for (let i = 0; i < tat.length; i += 80) {
      (await sbAll(SB, KHOA, 'saleretail_manual', 'select=lead_id,si_phan_loai,updated_by&lead_id=in.(' + tat.slice(i, i + 80).map(encodeURIComponent).join(',') + ')'))
        .forEach(m => { man[m.lead_id] = m; });
    }
    Object.entries(leadCua).forEach(([c, ids]) => {
      for (const id of ids) { const m = man[id]; const v = String((m && m.si_phan_loai) || '').trim();
        // + "Không tiềm năng" do job 7 ngày đặt (tu-khong-tiem-nang.js) cũng là đã xử lý -> không gắn lại LEAD TIỀM NĂNG (23/11/2026)
        if (v && m.updated_by && (!/^(monsieur claude|auto-)/i.test(String(m.updated_by).trim()) || String(m.updated_by).trim() === 'Monsieur Claude (7 ngày)')) { ttApp[c] = v; break; } }
    });
  }
  // khách job 7 ngày đang để "Không tiềm năng" (chưa trả lại) -> coi như đã xử lý, theo mã HỘI THOẠI (khách gộp có thể khác Lead ID)
  (await sbAll(SB, KHOA, 'khach_khong_tiem_nang_tu_dong', 'select=conversation_id&tra_lai_luc=is.null&conversation_id=not.is.null&order=conversation_id'))
    .forEach(x => { ttApp[x.conversation_id] = 'Không tiềm năng'; });
  const nk = [];
  const ghi = async rows => {
    if (XEM || !rows.length) return;
    const r = await fetch(`${SB}/rest/v1/pancake_gan_the_qc?on_conflict=conversation_id`, { method: 'POST',
      headers: { ...HSB, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    if (!r.ok) throw new Error('Ghi nhật ký lỗi ' + r.status + ' ' + (await r.text()).slice(0, 200));
  };
  const dem = { tao_don: 0, gan_lead: 0, gan_sile: 0, bo_qua: 0, cho: 0, loi: 0, doi_nhom: 0, doi_bo: 0 }, theoThe = {};
  const cong = k => { theoThe[k] = (theoThe[k] || 0) + 1; };
  const tachThe = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  const cungBo = (a, b) => { const A = [...new Set(a.map(x => x.toUpperCase()))].sort().join('|'), B = [...new Set(b.map(x => x.toUpperCase()))].sort().join('|'); return A === B; };

  // ── ĐỒNG BỘ NHÓM cho hội thoại đã gắn ──
  for (const x of doiNhom) {
    const q = viewCua[x.conversation_id], nhomMoi = nhomCua(q), conv = x.conversation_id;
    const capNk = async body => { if (!XEM) await fetch(`${SB}/rest/v1/pancake_gan_the_qc?conversation_id=eq.${encodeURIComponent(conv)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' }, body: JSON.stringify(body) }); };
    const tt = ttApp[conv];
    if (tt && !['Lead mới', '(chưa cập nhật)'].includes(tt)) { dem.doi_bo++; await capNk({ ket: 'sale_xu_ly', ghi_chu: 'QC đổi nhóm -> ' + nhomMoi + ' nhưng Sale đã chọn "' + tt + '" trên app — giữ' }); continue; }
    const m = /(\d+)\/([0-9a-f-]{36})/i.exec(x.tag_ten || '');
    if (!m) { dem.doi_bo++; continue; }
    const shop = m[1], cid = m[2];
    const j = await lay(pos(`shops/${shop}/customers/${cid}`)); const kh = j && (j.data || j);
    const hienTai = kh && (Array.isArray(kh.tags) ? kh.tags : (kh.shop_customer && kh.shop_customer.tags));
    if (!Array.isArray(hienTai)) { dem.loi++; console.log('  không đọc được thẻ khách', shop, cid); continue; }
    const theJob = String(x.tag_ten).split(' (')[0];
    const ky = x.the_sau ? tachThe(x.the_sau) : [...tachThe(x.the_truoc), ...(x.the_si_le ? [x.the_si_le] : []), theJob];
    if (!cungBo(hienTai, ky)) { dem.doi_bo++; await capNk({ ket: 'sale_xu_ly', ghi_chu: 'QC đổi nhóm -> ' + nhomMoi + ' nhưng thẻ khách đã khác lúc job gắn (Sale đã đụng: ' + hienTai.join(', ') + ') — giữ' }); continue; }
    let moiThe = hienTai.slice();
    const daCoTruoc = t => tachThe(x.the_truoc).some(y => y.toUpperCase() === t);
    if (nhomMoi === 'dat') {
      if (!daCoTruoc('LEAD TIỀM NĂNG')) moiThe = moiThe.filter(t => t.toUpperCase() !== 'LEAD TIỀM NĂNG');
      if (!moiThe.some(t => /TIỀM NĂNG/i.test(t)) && !moiThe.some(t => t.toUpperCase() === 'LEAD ĐẠT')) moiThe.push('LEAD ĐẠT');
    } else if (!moiThe.some(t => /TIỀM NĂNG/i.test(t))) moiThe.push('LEAD TIỀM NĂNG');
    if (cungBo(moiThe, hienTai)) { await capNk({ nhom: nhomMoi }); continue; }
    cong('đổi nhóm -> ' + (nhomMoi === 'dat' ? 'ĐẠT' : 'TIỀM NĂNG')); dem.doi_nhom++;
    if (XEM) continue;
    const r = await fetch(pos(`shops/${shop}/customers/${cid}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { tags: moiThe } }) });
    if (!r.ok) { dem.loi++; dem.doi_nhom--; console.log('  đổi nhóm lỗi', conv, r.status); continue; }
    await capNk({ nhom: nhomMoi, the_sau: moiThe.join(', '), tag_ten: THE_NHOM[nhomMoi] + ' (khách POS ' + shop + '/' + cid + ')',
      ghi_chu: 'đổi nhóm theo QC ' + new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' (' + x.nhom + ' -> ' + nhomMoi + ')' });
    // bản sao trong hub: mọi đơn của khách này trên shop đó
    (donTheoConv[conv] || []).filter(o => String(o.shop_id) === shop).forEach(o => fetch(`${SB}/rest/v1/datahub_orders?shop_id=eq.${o.shop_id}&order_id=eq.${o.order_id}`,
      { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' }, body: JSON.stringify({ customer_tags: moiThe.join(', ') }) }).catch(() => null));
    await sleep(200);
  }

  for (const q of moi) {
    const pg = q.page_id, conv = q.pancake_conversation_id, tt = ttApp[conv] || '';
    const dong = { conversation_id: conv, page_id: pg, ly_do_nhom: q.ly_do_nhom || null, tag_id: null, shop_id: null, order_id: null, the_si_le: null };
    if (tt && !['Lead mới', 'Tiềm năng, chưa ra đơn', '(chưa cập nhật)'].includes(tt)) {
      dem.bo_qua++; nk.push({ ...dong, nhom: nhomCua(q), the_truoc: null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'Sale đã xử lý trên app: ' + tt }); continue;
    }
    const nhom = tt === 'Tiềm năng, chưa ra đơn' ? 'tiem_nang' : nhomCua(q), canThe = THE_NHOM[nhom];
    const theSiLe = q.loai_khach === 'si' ? 'KH SỈ' : 'KH LẺ';
    let d = donCua[conv], taoMoi = null;

    // ── 2. chưa có đơn -> tạo đơn trắng ──
    if (!d) {
      const shop = PAGE_SHOP[pg];
      if (q.ly_do_nhom === 'Khách từ chối hẳn') { dem.bo_qua++; nk.push({ ...dong, nhom, the_truoc: null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'từ chối hẳn — không tạo đơn' }); continue; }
      if (!shop) { dem.bo_qua++; nk.push({ ...dong, nhom, the_truoc: null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'page không có shop POS (TikTok / chưa nối)' }); continue; }
      if (jobSdt.has(conv)) { dem.cho++; continue; }   // job SĐT vừa tạo đơn, hub chưa kịp về -> lượt sau
      // KHOÁ TẠO ĐƠN tới khi anh Hải duyệt số lô đầu (luật "tạo đơn Pancake hàng loạt: chạy thử, báo số trước"; QC nhắc 23/11).
      // Bật: env TAO_DON=1 (workflow) sau khi anh đồng ý. Chưa bật -> hội thoại chưa có đơn để "chờ", không ghi nhật ký.
      if (process.env.TAO_DON !== '1' && !XEM) { dem.cho++; continue; }
      const c = await lay(`https://pancake.vn/api/v1/pages/${pg}/conversations/${conv}?access_token=${TOKEN}`);
      const cv = c && (c.conversation || c), kh = ((cv && cv.customers) || [])[0] || {};
      if (!cv || !kh.id) { dem.loi++; console.log('  không đọc được hội thoại', conv); continue; }
      const m = await lay(`https://pancake.vn/api/v1/pages/${pg}/conversations/${conv}/messages?customer_id=${kh.id}&access_token=${TOKEN}`);
      if (((m && m.recent_orders) || []).length) { dem.cho++; continue; }   // Sale vừa tạo đơn, hub chưa về -> lượt sau xét lại
      const psid = String(cv.from_psid || kh.fb_id || '').replace(/^\d+_/, '');
      const ten = kh.name || q.ten_khach || 'Khách FB';
      const so = (String(q.sdt || '').match(/(?:\+?84|0)[35789]\d{8}/) || [])[0] || '';
      cong('tạo đơn ' + (SHOP_CODE[shop] || shop));
      if (XEM) { dem.tao_don++; cong(theSiLe); cong(canThe); continue; }
      const than = { bill_full_name: ten, page_id: pg, conversation_id: conv, note: 'Tạo tự động theo đánh giá QC (AI) — app MKT/Sale', items: [] };
      if (so) than.bill_phone_number = so;
      if (/^\d+$/.test(psid)) than.customer = { name: ten, fb_id: pg + '_' + psid, ...(so ? { phone_numbers: [so] } : {}) };
      const r = await fetch(pos(`shops/${shop}/orders`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(than) });
      const j = await r.json().catch(() => ({})), od = j.data || {};
      if (!od.id) { dem.loi++; console.log('  tạo đơn lỗi', conv, r.status, an(JSON.stringify(j)).slice(0, 160)); continue; }
      dem.tao_don++;
      taoMoi = { shop, id: String(od.id), sys: od.system_id };
      d = { shop_id: shop, order_id: String(od.id) };
      // Sale gán tay = Sale QC: ghi ở bước GHI BÙ SALE đầu lượt sau (Pancake chưa trả system_id lúc tạo)
      await sleep(400);
    }

    // ── 3. thẻ khách POS ──
    if (XEM && !taoMoi) {   // chạy thử: đọc thẻ thật để đếm đúng
      const jj = await lay(pos(`shops/${d.shop_id}/orders/${d.order_id}`)); const dd = jj && (jj.data || jj);
      const cu = (dd && dd.customer && dd.customer.shop_customer && dd.customer.shop_customer.tags) || [];
      const x = daXep(cu, nhom);
      if (x && coSiLe(cu)) { dem.bo_qua++; continue; }
      if (!coSiLe(cu)) { dem.gan_sile++; cong(theSiLe); }
      if (!x) { dem.gan_lead++; cong(canThe); }
      continue;
    }
    const jj = await lay(pos(`shops/${d.shop_id}/orders/${d.order_id}`));
    const don = jj && (jj.data || jj), cid = don && don.customer && don.customer.id;
    const cu = (don && don.customer && don.customer.shop_customer && don.customer.shop_customer.tags) || (taoMoi ? [] : null);
    if (!cid || !Array.isArray(cu)) {
      dem.loi++; console.log('  không đọc được khách của đơn', d.shop_id, d.order_id);
      if (taoMoi) nk.push({ ...dong, nhom, shop_id: taoMoi.shop, order_id: taoMoi.id, the_truoc: null, tag_ten: null, ket: 'loi', ghi_chu: 'đã tạo đơn, chưa gắn được thẻ' });
      continue;
    }
    const x = daXep(cu, nhom), them = [];
    if (!coSiLe(cu)) them.push(theSiLe);
    if (!x) them.push(canThe);
    if (!them.length) { dem.bo_qua++; nk.push({ ...dong, nhom, shop_id: d.shop_id, the_truoc: cu.join(', ') || null, tag_ten: null, ket: 'bo_qua', ghi_chu: 'khách đã có thẻ ' + x }); continue; }
    const moiThe = [...cu, ...them];
    const r = await fetch(pos(`shops/${d.shop_id}/customers/${cid}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { tags: moiThe } }) });
    if (!r.ok) {
      dem.loi++; console.log('  gắn thẻ lỗi', conv, r.status, an((await r.text()).slice(0, 160)));
      if (taoMoi) nk.push({ ...dong, nhom, shop_id: taoMoi.shop, order_id: taoMoi.id, the_truoc: null, tag_ten: null, ket: 'loi', ghi_chu: 'đã tạo đơn, gắn thẻ lỗi ' + r.status });
      continue;
    }
    if (them.includes(theSiLe)) { dem.gan_sile++; cong(theSiLe); }
    if (!x) { dem.gan_lead++; cong(canThe); }
    nk.push({ ...dong, nhom, shop_id: d.shop_id, order_id: taoMoi ? taoMoi.id : null, the_si_le: them.includes(theSiLe) ? theSiLe : null,
      the_truoc: cu.join(', ') || null, the_sau: moiThe.join(', '), tag_ten: x ? null : canThe + ' (khách POS ' + d.shop_id + '/' + cid + ')', ket: 'gan', ghi_chu: x ? 'LEAD bỏ qua: khách đã có ' + x : null });
    await fetch(`${SB}/rest/v1/datahub_orders?shop_id=eq.${d.shop_id}&order_id=eq.${d.order_id}`, { method: 'PATCH',
      headers: { ...HSB, Prefer: 'return=minimal' }, body: JSON.stringify({ customer_tags: moiThe.join(', ') }) }).catch(() => null);
    if (nk.length >= 20) await ghi(nk.splice(0));
    await sleep(200);
  }
  await ghi(nk);
  if (!dem.loi) await luuDau();   // lỗi -> giữ dấu cũ, lượt 10 phút sau thử lại
  console.log(`Gắn thẻ QC xong: ${XEM ? 'SẼ' : 'đã'} tạo đơn ${dem.tao_don} · gắn LEAD ${dem.gan_lead} · gắn Sỉ/Lẻ ${dem.gan_sile} · bỏ qua ${dem.bo_qua} · chờ lượt sau ${dem.cho} · đổi nhóm ${dem.doi_nhom} (giữ vì Sale đã xử lý ${dem.doi_bo}) · lỗi ${dem.loi}`);
  Object.entries(theoThe).forEach(([k, v]) => console.log('   ', k + ':', v));
  if (dem.loi) process.exitCode = 1;
})().catch(e => { console.error(an(e && e.message || e)); process.exit(1); });
