// SO ĐƠN APP MKT ↔ APP KẾ TOÁN MỖI ĐÊM -- KÊNH ONLINE / OFFLINE + SALE ĐƯỢC GHI NHẬN, KHÔNG SO TIỀN. Monsieur Claude.
// Lịch sử: 17/11/2026 bắt đầu so doanh thu ("bọn m so qua lại vs trao đổi vs nhau trên cloud ... định kỳ đêm hàng ngày", gộp vào luồng So khớp).
// Cùng ngày anh Hải ĐỔI HƯỚNG: "k so khớp vs kế toán ở doanh thu nữa, cái m cần so khớp là số lượng đơn onl off line xem đã chuẩn dữ liệu ghi nhận
// giữa 2 bên hay chưa, vs sale đã được ghi nhận đủ đơn hay chưa, và bàn luận vs nó về vấn đề đấy, k cần quan tâm tới doanh thu đơn nữa";
// "bắt đầu so từ tháng 11", "mấy tháng trước kệ đi". Luật MKT GIỮ NGUYÊN (bản thử "tiền theo từng đơn" đã bỏ, không đẩy).
//
// Bảng trao đổi (supabase-schema-so-doanh-thu-2app.sql, chỉ service_role): so_dt_2app -- mỗi app ghi các đơn mình ghi nhận theo tháng
// (ben mkt / kt): mã, kênh Online/Offline + kenh_ly (vì sao), nhân sự + ns_ly (vì sao), nv_ban (người bán trên phiếu Kiot); so_dt_2app_ly_do --
// lý do 1 app KHÔNG có mã bên kia có; so_dt_2app_tin -- hộp thư. Cột tien còn ghi nhưng KHÔNG dùng để so nữa.
// Job (bên MKT, cuối lượt so khớp tối 22h -- sync-kiot.yml): (1) dựng đơn bằng ĐÚNG hàm báo cáo của app (nạp index.html) -> ghi ben mkt;
// (2) đọc ben kt -> mỗi tháng từ TU_THANG: số đơn Online / Offline 2 bên; đơn 2 bên cùng có mà KHÁC KÊNH / KHÁC SALE -> lý do 2 bên + nhận định
// 'khac_luat' (2 app ghi theo luật riêng đã chốt, bỏ qua được) / 'can_xem' (dữ liệu ghi nhận có thể sai -- bàn với Kế toán / anh xem);
// theo từng Sale: số đơn MKT / KT / khớp; đơn chỉ 1 bên có -> đếm + lý do. (3) Kết quả vào kiot_so_khop.doanh_thu (trang So khớp đọc) + 1 tin / ngày.
// Chạy tay: `SO_DT=1 node scripts/so-doanh-thu-2app.js` (KHO=1 chỉ in, không ghi).
const vm = require('vm');
const { napApp, tai, SUPABASE_URL, H } = require('./lib/nap-app.js');
const KHO = process.env.KHO === '1';
const TU_THANG = '2026-11';   // anh Hải 17/11/2026: "bắt đầu so từ tháng 11", "mấy tháng trước kệ đi"
// TÊN NHÂN SỰ THEO KẾ TOÁN (anh 17/11: "m follow theo tên của kế toán nhé") + người đã nghỉ anh xác nhận (không báo tên lạ)
const TEN_THEO_KT = { 'Nguyễn Khánh Nguyên': 'Nguyễn Trung Khánh Nguyên', 'Đinh Ngọc Diệp': 'Đinh Thị Ngọc Diệp' };
const DA_NGHI = { 'Nguyễn Hữu Toàn': 'Sale cũ', 'Nguyễn Thảo Ngọc': 'Sale cũ', 'Nguyễn Đức Anh Tuấn': 'Sale cũ', 'Hà Minh Ngọc': 'Sale cũ',
  'Nguyễn Thị Huế': 'nhân viên cũ', 'Nguyễn Thị Chuyện': 'nhân viên cũ', 'Vũ Thanh Bình': 'kế toán cũ' };
const TK_CHUNG = /^(sales admin|admin|sale chung|botsale)/i;   // tài khoản chung trên Kiot -- không phải 1 người

const vnNay = () => new Date(Date.now() + 7 * 3600e3).toISOString();
const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
const thg = (t) => t.slice(5) + '/' + t.slice(0, 4);

async function ghiDb(bang, body, loc, method) {
  if (KHO) return;
  const r = await fetch(`${SUPABASE_URL}/${bang}${loc || ''}`, { method: method || 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: body == null ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`${bang} ${method || 'POST'} lỗi ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// Đơn app MKT ghi nhận từng tháng = đúng các đơn của báo cáo Sale Lẻ / Sỉ (kords + mua lại, bỏ phiếu khongTinh). Kênh theo NGUỒN KHÁCH (09/11/2026),
// nhân sự = Sale đã chốt của khách (gán tay > người bán Kiot > Pancake, bàn giao khi Sale nghỉ).
function donMkt(ctx, cacThang) {
  ctx.__thang = cacThang;
  return JSON.parse(vm.runInContext(`(()=>{
    const nsLy=r=>{
      if(r.vangLai)return 'khách vãng lai (phiếu không mã khách) — app không gán Sale';
      if(!String(r.staff||'').trim())return 'chưa gán Sale';
      if(r.staffBanGiao)return 'nhận bàn giao từ '+r.staffBanGiao+' (Sale đã nghỉ)';
      if(rptSlSaleGanTayDong(r)!==null)return 'gán tay ở app (Sale phụ trách khách)';
      if(r.staffPageCu!=null&&r.staffPageCu!==r.staff)return 'tài khoản chung / trống -> Sale mặc định '+r.staff;
      if(r.staffKiot&&rptSlSaleName(r.staffKiot)===r.staff)return 'người bán trên phiếu Kiot gần nhất của khách';
      return 'người phụ trách bên Pancake (khách chưa có phiếu Kiot)';};
    const ra=[],trung=[];const da=new Map();
    __thang.forEach(t=>{
      const tu=t+'-01',cuoi=new Date(Date.UTC(+t.slice(0,4),+t.slice(5,7),0)).toISOString().slice(0,10);
      ['Lẻ','Sỉ'].forEach(loai=>{
        modRanges.saleretail={from:tu,to:cuoi};modRanges.salesi={from:tu,to:cuoi};
        window._rptSlType=loai;window._rptSlMod=null;window._kiotOrdByCode=null;rptSlXoaCache();
        rptSlPeriod().forEach(r=>{
          const onl=!/offline/i.test(r.nguon||''),ng=rptSlNguonNhan(r);
          (r.kords||[]).concat(r.repeatOrds||[]).forEach(o=>{
            if(o.khongTinh)return;
            const k=t+'|'+o.code;if(da.has(k)){trung.push({thang:t,ma:o.code,doi:[da.get(k),loai]});return;}da.set(k,loai);
            const kp=String(o.sale_channel||'').trim();
            ra.push({thang:t,ma:o.code,tien:Number(o.total||0),kenh:onl?'Online':'Offline',
              kenh_ly:'nguồn khách '+ng+(kp?' · kênh trên phiếu: '+kp:' · phiếu không ghi kênh')+(onl&&!RPT_KENH_ONLINE.test(kp)?' (MKT tính Online theo nguồn khách)':''),
              nhan_su:String(r.staff||'').trim()||'(chưa gán)',ns_ly:nsLy(r),nv_ban:String(o.sold_by_name||'').trim(),
              doi:loai,ma_kh:r.kh||o.customer_code||'',ngay:String(o.purchase_date||'').slice(0,10),phieu_onl:RPT_KENH_ONLINE.test(kp)});
          });
        });
      });
    });
    return JSON.stringify({ra,trung});
  })()`, ctx));
}

// Vì sao app MKT KHÔNG có 1 mã mà Kế toán có (mã đã quy về đơn đặt nếu được).
function lyDoMktKhongCo(ctx, ma, thang, mktMoiThang) {
  const o = mktMoiThang.get(ma);
  if (o && o.thang !== thang) return 'app MKT ghi tháng ' + thg(o.thang) + ' (ngày tạo đơn ' + o.ngay + ')';
  if (/^TH/i.test(ma)) return 'phiếu trả hàng — app MKT không ghi đơn trả hàng';
  ctx.__ma = ma;
  return vm.runInContext(`(()=>{
    const ma=__ma;
    const o=(kiotOrders||[]).find(x=>x.code===ma);
    if(!o){const h=(kiotInvoices||[]).find(x=>x.code===ma);
      if(!h)return 'app MKT không có mã này (đã xoá trên Kiot / chưa kéo về)';
      if(h.status!==1)return 'hoá đơn không hoàn thành ('+(h.status_value||h.status)+')';
      return 'hoá đơn của khách không nằm trong báo cáo Sale (khách '+(h.customer_code||'không mã')+')';}
    if(o.status===4)return 'đơn huỷ';
    if(!o.customer_code)return 'phiếu không gắn khách -> báo giá';
    if(rptSlPhieuTreo(o))return 'phiếu tạm không trả tiền, khách không cọc -> báo giá';
    if(rptSlDonKhongTinh(o))return 'không có dấu vết tiền (trả / hoá đơn / cọc)';
    return 'khách không nằm trong báo cáo Sale tháng này';
  })()`, ctx);
}

(async () => {
  const gioVN = +vnNay().slice(11, 13);
  if (!KHO && process.env.SO_DT !== '1' && gioVN < 20) { console.log('So đơn 2 app chỉ chạy lượt tối (giờ VN ' + gioVN + ') -> bỏ qua. SO_DT=1 để ép chạy.'); return; }
  const thangNay = vnNay().slice(0, 7), cacThang = [];
  for (let d = new Date(TU_THANG + '-01T00:00:00Z'); d.toISOString().slice(0, 7) <= thangNay; d.setUTCMonth(d.getUTCMonth() + 1)) cacThang.push(d.toISOString().slice(0, 7));

  const ctx = await napApp();
  const { ra: mkt, trung } = donMkt(ctx, cacThang);
  mkt.forEach((x) => { if (TEN_THEO_KT[x.nhan_su]) x.nhan_su = TEN_THEO_KT[x.nhan_su]; });
  console.log('App MKT: ' + mkt.length + ' đơn ' + cacThang.join(', ') + (trung.length ? ' · ' + trung.length + ' mã ở cả Lẻ lẫn Sỉ (bỏ lần 2)' : ''));

  // (1) ghi bên MKT (xoá cả các tháng cũ đã ghi trước khi đổi mốc -- không so nữa)
  const luc = new Date().toISOString();
  await ghiDb('so_dt_2app', null, '?ben=eq.mkt', 'DELETE');
  for (let i = 0; i < mkt.length; i += 500) await ghiDb('so_dt_2app', mkt.slice(i, i + 500).map((x) => ({ thang: x.thang, ben: 'mkt', ma: x.ma, tien: x.tien,
    kenh: x.kenh, kenh_ly: x.kenh_ly, nhan_su: x.nhan_su, ns_ly: x.ns_ly, nv_ban: x.nv_ban, doi: x.doi, ma_kh: x.ma_kh, ly_do: null, luc })));

  // (2) bên Kế toán
  let kt = [];
  try { kt = await tai('so_dt_2app', `select=thang,ma,tien,kenh,kenh_ly,nhan_su,ns_ly,nv_ban,ly_do,luc&ben=eq.kt&thang=gte.${TU_THANG}&order=thang,ma`); }
  catch (e) { console.log('Chưa đọc được số bên Kế toán: ' + e.message); }
  const ktLuc = kt.reduce((m, x) => (String(x.luc) > m ? String(x.luc) : m), '');
  const ktCu = !ktLuc || Date.now() - new Date(ktLuc).getTime() > 30 * 3600e3;
  let ktLy = new Map();
  try { (await tai('so_dt_2app_ly_do', `select=thang,ma,ly_do&ben=eq.kt&thang=gte.${TU_THANG}`)).forEach((x) => ktLy.set(x.thang + '|' + x.ma, x.ly_do)); } catch (e) { /* chưa có */ }

  const hdVeDon = new Map((vm.runInContext('kiotInvoices', ctx) || []).filter((h) => h.order_code).map((h) => [h.code, h.order_code]));
  const mktMoiThang = new Map(mkt.map((x) => [x.ma, x]));
  const quy = (x) => { const d = hdVeDon.get(x.ma); return d ? { ...x, ma_goc: x.ma, ma: d } : x; };
  // tên: Kế toán ghép về tên MKT (bỏ dấu trùng / trọn chữ & duy nhất); không ghép được -> tên lạ (trừ người đã nghỉ)
  const tenMkt = [...new Set(mkt.map((x) => x.nhan_su))];
  const tron = (n, d) => (' ' + d + ' ').includes(' ' + n + ' ');
  const tenLa = new Map();
  const veTen = (t) => { const b = boDau(t); if (!b) return '(chưa gán)';
    const dung = tenMkt.find((m) => boDau(m) === b); if (dung) return dung;
    const gan = tenMkt.filter((m) => { const c = boDau(m); return c && Math.min(b.length, c.length) >= 4 && (tron(b, c) || tron(c, b)); });
    if (gan.length === 1) return gan[0];
    if (!DA_NGHI[t] && !TK_CHUNG.test(t) && !tenLa.has(t)) tenLa.set(t, gan.length ? 'giống nhiều người bên MKT: ' + gan.join(', ') : 'bên MKT không có tên này');
    return t; };
  const cungNguoi = (a, b) => veTen(a) === veTen(b) || boDau(a) === boDau(b);

  // nhận định 1 đơn KHÁC KÊNH: khác luật đã chốt (bỏ qua được) hay cần xem
  const xetKenh = (m, k) => {
    if (m.kenh === 'Online' && !m.phieu_onl && k.kenh === 'Offline')
      return { dg: 'khac_luat', gt: 'MKT tính Online theo NGUỒN KHÁCH (khách từng có phiếu kênh online — luật 09/11), phiếu này không ghi kênh online; Kế toán ghi Offline theo phiếu.' };
    if (m.kenh === 'Online' && m.phieu_onl && k.kenh === 'Offline')
      return { dg: 'can_xem', gt: 'Phiếu Kiot ghi kênh online mà Kế toán ghi Offline — kiểm cách Kế toán đọc kênh.' };
    if (m.kenh === 'Offline' && k.kenh === 'Online')
      return { dg: 'can_xem', gt: 'Kế toán ghi Online, MKT ghi Offline (khách không có phiếu kênh online nào) — kiểm nguồn khách 2 bên.' };
    return { dg: 'can_xem', gt: 'Hai bên ghi kênh khác nhau.' };
  };
  // nhận định 1 đơn KHÁC SALE
  const xetSale = (m, k) => {
    const nvKt = String(k.nv_ban || k.nhan_su || ''), banPhieu = m.nv_ban;
    if (m.nhan_su === '(chưa gán)') return { dg: 'can_xem', gt: 'App MKT chưa gán Sale (' + m.ns_ly + ') — đơn của ' + (k.nhan_su || banPhieu || '—') + ' chưa được ghi nhận cho Sale nào bên MKT.' };
    if (TK_CHUNG.test(k.nhan_su || '')) return { dg: 'can_xem', gt: 'Kế toán ghi tài khoản chung "' + k.nhan_su + '" — chưa biết Sale thật; MKT ghi ' + m.nhan_su + ' (' + m.ns_ly + ').' };
    if (/gán tay|bàn giao|Sale mặc định/.test(m.ns_ly) && banPhieu && cungNguoi(k.nhan_su, banPhieu))
      return { dg: 'khac_luat', gt: 'MKT ghi Sale phụ trách khách (' + m.ns_ly + '); Kế toán ghi người bán trên phiếu (' + banPhieu + ').' };
    if (/người bán trên phiếu Kiot gần nhất/.test(m.ns_ly) && banPhieu && cungNguoi(k.nhan_su, banPhieu))
      return { dg: 'khac_luat', gt: 'Khách có nhiều người bán: MKT gán cả khách cho người bán phiếu gần nhất (' + m.nhan_su + '); Kế toán ghi người bán của chính phiếu này (' + banPhieu + ').' };
    if (banPhieu && !cungNguoi(k.nhan_su, banPhieu)) return { dg: 'can_xem', gt: 'Phiếu ghi người bán ' + banPhieu + ' nhưng Kế toán ghi ' + (k.nhan_su || '—') + ' — kiểm Kế toán lấy nhân sự từ đâu.' };
    return { dg: 'can_xem', gt: 'MKT: ' + m.nhan_su + ' (' + m.ns_ly + ') · Kế toán: ' + (k.nhan_su || '—') + '.' };
  };

  const ketQua = [];
  for (const t of cacThang) {
    const M = mkt.filter((x) => x.thang === t);
    const K0 = kt.filter((x) => x.thang === t).map(quy).filter((x) => Number(x.tien || 0) >= 0 && !/^TH/i.test(x.ma));   // bỏ dòng trả hàng (âm)
    const mK = new Map(); K0.forEach((x) => { if (!mK.has(x.ma)) mK.set(x.ma, { ...x }); else { const c = mK.get(x.ma); c.ma_goc = [c.ma_goc, x.ma_goc].filter(Boolean).join(', '); } });
    const K = [...mK.values()];
    const dem = (a) => ({ don: a.length, onl: a.filter((x) => x.kenh === 'Online').length, off: a.filter((x) => x.kenh !== 'Online').length });
    const v = { thang: t, mkt: dem(M), kt: K.length ? dem(K) : null };
    if (K.length) {
      const mM = new Map(M.map((x) => [x.ma, x]));
      const khacKenh = [], khacSale = [], chiMkt = [], chiKt = [];
      let chung = 0;
      M.forEach((m) => { const k = mK.get(m.ma);
        if (!k) { chiMkt.push({ ma: m.ma, nhan_su: m.nhan_su, kenh: m.kenh, ly_mkt: 'MKT ghi nhận (' + m.doi + ')', ly_kt: ktLy.get(t + '|' + m.ma) || '' }); return; }
        chung++;
        const maH = m.ma + (k.ma_goc ? ' (KT: ' + k.ma_goc + ')' : '');
        if (m.kenh !== k.kenh) { const d = xetKenh(m, k); khacKenh.push({ ma: maH, nhan_su: m.nhan_su, mkt: m.kenh, kt: k.kenh, ly_mkt: m.kenh_ly, ly_kt: k.kenh_ly || '', ...d }); }
        if (veTen(k.nhan_su) !== m.nhan_su) { const d = xetSale(m, k); khacSale.push({ ma: maH, mkt: m.nhan_su, kt: k.nhan_su || '—', nv_ban: m.nv_ban, ly_mkt: m.ns_ly, ly_kt: k.ns_ly || '', ...d }); }
      });
      K.forEach((k) => { if (mM.has(k.ma)) return;
        chiKt.push({ ma: k.ma + (k.ma_goc ? ' (KT: ' + k.ma_goc + ')' : ''), nhan_su: k.nhan_su || '', kenh: k.kenh || '', ly_mkt: lyDoMktKhongCo(ctx, k.ma, t, mktMoiThang), ly_kt: k.ly_do || 'Kế toán ghi nhận' }); });
      const xepCx = (a) => a.sort((x, y) => (x.dg === 'can_xem' ? 0 : 1) - (y.dg === 'can_xem' ? 0 : 1));
      v.chung = chung; v.khac_kenh = xepCx(khacKenh); v.khac_sale = xepCx(khacSale); v.chi_mkt = chiMkt; v.chi_kt = chiKt;
      v.kenh_cx = khacKenh.filter((x) => x.dg === 'can_xem').length; v.sale_cx = khacSale.filter((x) => x.dg === 'can_xem').length;
      // theo Sale: số đơn mỗi bên ghi cho người đó + số đơn cả 2 bên cùng ghi cho người đó
      const S = {};
      const o = (ten) => (S[ten] = S[ten] || { ten, mkt: 0, kt: 0, khop: 0, ghi: DA_NGHI[ten] || (TK_CHUNG.test(ten) ? 'tài khoản chung' : '') });
      M.forEach((m) => { o(m.nhan_su).mkt++; const k = mK.get(m.ma); if (k && veTen(k.nhan_su) === m.nhan_su) o(m.nhan_su).khop++; });
      K.forEach((k) => { o(veTen(k.nhan_su)).kt++; });
      v.sale = Object.values(S).sort((a, b) => Math.max(b.mkt, b.kt) - Math.max(a.mkt, a.kt));
    }
    ketQua.push(v);
  }

  // (3) tóm tắt + ghi
  const tomTat = kt.length ? ketQua.map((v) => thg(v.thang) + ': MKT ' + v.mkt.don + ' đơn (Onl ' + v.mkt.onl + ' / Off ' + v.mkt.off + ')'
    + (v.kt ? ' · KT ' + v.kt.don + ' đơn (Onl ' + v.kt.onl + ' / Off ' + v.kt.off + ') · cùng có ' + v.chung + ' · khác kênh ' + v.khac_kenh.length + ' (' + v.kenh_cx + ' cần xem) · khác Sale ' + v.khac_sale.length + ' (' + v.sale_cx + ' cần xem) · chỉ MKT ' + v.chi_mkt.length + ' · chỉ KT ' + v.chi_kt.length : ' · KT chưa có')).join(' | ')
    : 'Kế toán chưa gửi số vào so_dt_2app';
  const ghiChu = (ktCu ? (ktLuc ? 'Số Kế toán cũ · ' : 'Kế toán chưa gửi số · ') : '') + tomTat;
  console.log(ghiChu);
  tenLa.forEach((ly, ten) => console.log('TÊN LẠ bên Kế toán: ' + ten + ' — ' + ly));
  ketQua.forEach((v) => {
    (v.khac_kenh || []).filter((x) => x.dg === 'can_xem').slice(0, 8).forEach((x) => console.log('  KÊNH cần xem ' + x.ma + ' MKT ' + x.mkt + ' / KT ' + x.kt + ' · ' + x.gt));
    (v.khac_sale || []).filter((x) => x.dg === 'can_xem').slice(0, 8).forEach((x) => console.log('  SALE cần xem ' + x.ma + ' MKT ' + x.mkt + ' / KT ' + x.kt + ' · ' + x.gt));
    (v.sale || []).forEach((s) => console.log('  ' + s.ten.padEnd(26) + String(s.mkt).padStart(5) + String(s.kt).padStart(5) + String(s.khop).padStart(5)));
  });
  // đơn cần xem MỚI so với lượt trước -> chuông
  const khoa = []; ketQua.forEach((v) => { (v.khac_kenh || []).concat(v.khac_sale || []).forEach((x) => { if (x.dg === 'can_xem') khoa.push(v.thang + '|' + x.ma); }); });
  let truoc = null;
  try { const r = await tai('kiot_so_khop', 'select=k:doanh_thu->can_xem_keys,c:doanh_thu->che_do&doanh_thu=not.is.null&order=chay_luc.desc'); truoc = r[0] && r[0].c === 'don' && Array.isArray(r[0].k) ? new Set(r[0].k) : null; } catch (e) { truoc = null; }
  const moi = truoc ? khoa.filter((k) => !truoc.has(k)) : [];
  if (truoc) ketQua.forEach((v) => (v.khac_kenh || []).concat(v.khac_sale || []).forEach((x) => { if (x.dg === 'can_xem' && !truoc.has(v.thang + '|' + x.ma)) x.moi = true; }));
  console.log('Cần xem: ' + khoa.length + (truoc ? ' · mới ' + moi.length : ' (lượt đầu chế độ so đơn)'));

  if (KHO) { console.log('(KHO=1: chưa ghi gì)'); return; }
  const daCo = await tai('so_dt_2app_tin', `select=id&ben=eq.mkt&luc=gte.${new Date(Date.now() - 12 * 3600e3).toISOString()}`).catch(() => []);
  if (!daCo.length) await ghiDb('so_dt_2app_tin', { ben: 'mkt', thang: thangNay, noi_dung: 'Lượt so đơn đêm ' + vnNay().slice(0, 10) + ': ' + tomTat });
  let tin = [];
  try { tin = await tai('so_dt_2app_tin', 'select=id,luc,ben,thang,ma,noi_dung&order=luc.desc'); } catch (e) { /* không chặn */ }
  const ten_la = [...tenLa].map(([ten, ly]) => ({ ten, ly, so_don: kt.filter((x) => x.nhan_su === ten).length }));
  const ketQuaGhi = { che_do: 'don', luc, tu_thang: TU_THANG, kt_luc: ktLuc || null, kt_cu: ktCu, ghi_chu: ghiChu, thang: ketQua, trung, ten_la,
    tin: tin.slice(0, 40), can_xem_keys: khoa, can_xem_moi: moi.length };
  const gan = await tai('kiot_so_khop', 'select=id&trang_thai=neq.running&order=chay_luc.desc').catch(() => []);
  if (!gan[0]) throw new Error('chưa có lượt kiot_so_khop nào để gắn kết quả');
  await ghiDb('kiot_so_khop', { doanh_thu: ketQuaGhi }, '?id=eq.' + gan[0].id, 'PATCH');
  console.log('Đã ghi so_dt_2app (ben mkt) + kết quả vào kiot_so_khop #' + gan[0].id);
})().catch((e) => { console.error('LỖI', e.message); process.exit(1); });
