// SO DOANH THU APP MKT ↔ APP KẾ TOÁN, MỖI ĐÊM (anh Hải 17/11/2026: "làm cái so định kỳ hàng ngày đi, k cần đổi làm gì mất công,
// bọn m so qua lại vs trao đổi vs nhau trên cloud về doanh thu tổng, doanh thu onl off, doanh thu nhân sự định kỳ đêm hàng ngày";
// "gộp luôn vs cái luồng so gì trước đấy" = luồng So khớp Kiot ↔ app MKT ↔ app Kế toán). Monsieur Claude.
//
// KHÔNG đổi luật bên nào: mỗi app giữ cách tính của mình, chỉ so + ghi rõ đơn nào lệch và vì sao.
// Cách trao đổi giữa 2 app (bảng chung, chỉ service_role đọc / ghi -- xem supabase-schema-so-doanh-thu-2app.sql):
//   so_dt_2app      : mỗi app ghi DANH SÁCH ĐƠN mình tính doanh thu theo tháng (ben 'mkt' / 'kt'): mã phiếu, tiền, Online / Offline,
//                     nhân sự, mã KH, lý do tính. Tổng / Online / Offline / theo nhân sự đều cộng từ danh sách này -> lệch là chỉ ra được đơn.
//   so_dt_2app_tin  : hộp thư 2 bên (giải thích đơn lệch, hỏi lại nhau).
// Job này (bên MKT): (1) dựng danh sách đơn bằng ĐÚNG hàm báo cáo của app (nạp index.html, scripts/lib/nap-app.js) -> ghi ben 'mkt';
//   (2) đọc ben 'kt' -> so từng tháng: tổng, Online, Offline, từng nhân sự + từng đơn (mã HĐ bên kia quy về mã đơn đặt nếu HĐ đó của đơn đặt);
//   (3) đơn chỉ 1 bên tính -> ghi lý do phía MKT (báo giá chưa cọc, huỷ, tính ở tháng khác, khác Sale...);
//   (4) ghi kết quả vào cột doanh_thu của lượt kiot_so_khop vừa chạy (trang Cài đặt nâng cao > So khớp đọc) + 1 tin tóm tắt vào hộp thư.
// Lịch: bước cuối lượt so khớp TỐI (22h VN) trong sync-kiot.yml. Chạy tay: `node scripts/so-doanh-thu-2app.js` (KHO=1 chỉ in, không ghi).
const vm = require('vm');
const { napApp, tai, SUPABASE_URL, H } = require('./lib/nap-app.js');
const KHO = process.env.KHO === '1';
const TU_THANG = '2026-06';   // Lẻ chỉ có từ 1/6/2026 (luật app) -> so từ T6

// TÊN NHÂN SỰ THEO KẾ TOÁN (anh Hải 17/11/2026: "còn lại đúng hết tên rồi, m follow theo tên của kế toán nhé"):
// so doanh thu dùng tên bên Kế toán làm chuẩn -> tên app MKT đổi sang tên Kế toán trước khi ghi / so.
const TEN_THEO_KT = { 'Nguyễn Khánh Nguyên': 'Nguyễn Trung Khánh Nguyên', 'Đinh Ngọc Diệp': 'Đinh Thị Ngọc Diệp' };
// Người đã nghỉ, anh Hải xác nhận 17/11/2026 -> không báo "tên lạ", chỉ ghi chú cạnh tên.
const DA_NGHI = { 'Nguyễn Hữu Toàn': 'Sale cũ', 'Nguyễn Thảo Ngọc': 'Sale cũ', 'Nguyễn Đức Anh Tuấn': 'Sale cũ', 'Hà Minh Ngọc': 'Sale cũ',
  'Nguyễn Thị Huế': 'nhân viên cũ', 'Nguyễn Thị Chuyện': 'nhân viên cũ', 'Vũ Thanh Bình': 'kế toán cũ' };
const vnNay = () => new Date(Date.now() + 7 * 3600e3).toISOString();
const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
const vndS = (n) => Math.round(Number(n || 0)).toLocaleString('vi') + 'đ';
const tr = (n) => (Math.round(Number(n || 0) / 1e5) / 10).toLocaleString('vi') + 'tr';

async function ghiDb(bang, body, loc, method) {
  if (KHO) return;
  const r = await fetch(`${SUPABASE_URL}/${bang}${loc || ''}`, { method: method || 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: body == null ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`${bang} ${method || 'POST'} lỗi ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// Danh sách đơn app MKT tính doanh thu, từng tháng -- đúng các ô Doanh thu Sale Lẻ / Sỉ + Online / Offline theo nguồn khách (09/11/2026).
function donMkt(ctx, cacThang) {
  ctx.__thang = cacThang;
  return JSON.parse(vm.runInContext(`(()=>{
    const lyDo=o=>{
      if(o.direct)return 'HĐ bán thẳng';
      if(typeof rptSlTTVConTinh==='function'&&rptSlTTVConTinh(o)&&o.status===1)return 'Tự Tại Viên: phiếu tạm tính trong 14 ngày';
      if(String(o.purchase_date||'').slice(0,10)<RPT_MOC_HOADON)return 'trước 1/6/2026 (không xét dấu vết tiền)';
      if(Number(o.total_payment||0)>0)return 'trả tiền trên đơn';
      if(rptSlGiuTinh(o))return 'khách từng có cọc (giữ tính)';
      if(o.status!==1&&(rptSlHoaDonTheoKhach()[o.customer_code]||0)>0)return 'khách có hoá đơn hoàn thành';
      if(rptSlKhachCoCoc(o.customer_code))return 'khách có cọc (nợ âm trên Kiot)';
      return 'khác';};
    const ra=[],trung=[];const da=new Map();
    __thang.forEach(t=>{
      const tu=t+'-01',cuoi=new Date(Date.UTC(+t.slice(0,4),+t.slice(5,7),0)).toISOString().slice(0,10);
      ['Lẻ','Sỉ'].forEach(loai=>{
        modRanges.saleretail={from:tu,to:cuoi};modRanges.salesi={from:tu,to:cuoi};
        window._rptSlType=loai;window._rptSlMod=null;window._kiotOrdByCode=null;rptSlXoaCache();
        rptSlPeriod().forEach(r=>{
          (r.kords||[]).concat(r.repeatOrds||[]).forEach(o=>{
            if(o.khongTinh)return;
            const k=t+'|'+o.code;if(da.has(k)){trung.push({thang:t,ma:o.code,doi:[da.get(k),loai]});return;}da.set(k,loai);
            ra.push({thang:t,ma:o.code,tien:Number(o.total||0),kenh:/offline/i.test(r.nguon||'')?'Offline':'Online',
              nhan_su:String(r.staff||'').trim()||'(chưa gán)',doi:loai,ma_kh:r.kh||o.customer_code||'',ngay:String(o.purchase_date||'').slice(0,10),
              trang_thai:o.status_value||'',ly_do:lyDo(o)});
          });
        });
      });
    });
    return JSON.stringify({ra,trung});
  })()`, ctx));
}

// Vì sao app MKT KHÔNG tính 1 mã mà Kế toán tính (mã đã quy về đơn đặt nếu được).
function lyDoMktKhongTinh(ctx, ma, thang, mktMoiThang) {
  const o = mktMoiThang.get(ma);
  if (o && o.thang !== thang) return 'app MKT tính ở tháng ' + o.thang.slice(5) + '/' + o.thang.slice(0, 4) + ' (ngày tạo đơn ' + o.ngay + ')';
  if (/^TH/i.test(ma)) return 'app MKT không trừ phiếu trả hàng (doanh thu = giá trị đơn đặt)';
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
    return 'khách không nằm trong báo cáo Sale tháng này (Lẻ trước 1/6, khách đã gỡ...)';
  })()`, ctx);
}

(async () => {
  const gioVN = +vnNay().slice(11, 13);
  if (!KHO && process.env.SO_DT !== '1' && gioVN < 20) { console.log('So doanh thu 2 app chỉ chạy lượt tối (giờ VN ' + gioVN + ') -> bỏ qua. SO_DT=1 để ép chạy.'); return; }
  const thangNay = vnNay().slice(0, 7), cacThang = [];
  for (let d = new Date(TU_THANG + '-01T00:00:00Z'); d.toISOString().slice(0, 7) <= thangNay; d.setUTCMonth(d.getUTCMonth() + 1)) cacThang.push(d.toISOString().slice(0, 7));

  const ctx = await napApp();
  const { ra: mkt, trung } = donMkt(ctx, cacThang);
  mkt.forEach((x) => { if (TEN_THEO_KT[x.nhan_su]) x.nhan_su = TEN_THEO_KT[x.nhan_su]; });
  console.log('App MKT: ' + mkt.length + ' đơn tính doanh thu ' + cacThang[0] + ' → ' + thangNay + (trung.length ? ' · ' + trung.length + ' mã nằm ở cả Lẻ lẫn Sỉ (đã bỏ lần 2)' : ''));

  // (1) ghi danh sách bên MKT (thay toàn bộ các tháng đang so)
  const luc = new Date().toISOString();
  await ghiDb('so_dt_2app', null, `?ben=eq.mkt&thang=gte.${TU_THANG}`, 'DELETE');
  for (let i = 0; i < mkt.length; i += 500) await ghiDb('so_dt_2app', mkt.slice(i, i + 500).map((x) => ({ thang: x.thang, ben: 'mkt', ma: x.ma, tien: x.tien,
    kenh: x.kenh, nhan_su: x.nhan_su, doi: x.doi, ma_kh: x.ma_kh, ly_do: x.ly_do, luc })));

  // (2) đọc bên Kế toán
  let kt = [];
  try { kt = (await tai('so_dt_2app', `select=thang,ma,tien,kenh,nhan_su,doi,ma_kh,ly_do,luc&ben=eq.kt&thang=gte.${TU_THANG}&order=thang,ma`)); }
  catch (e) { console.log('Chưa đọc được số bên Kế toán: ' + e.message); }
  const ktLuc = kt.reduce((m, x) => (String(x.luc) > m ? String(x.luc) : m), '');
  const ktCu = !ktLuc || Date.now() - new Date(ktLuc).getTime() > 30 * 3600e3;

  // mã HĐ bên Kế toán -> quy về mã đơn đặt nếu HĐ đó thuộc 1 đơn đặt (app MKT tính theo đơn đặt, ngày tạo đơn)
  const hdVeDon = new Map((vm.runInContext('kiotInvoices', ctx) || []).filter((h) => h.order_code).map((h) => [h.code, h.order_code]));
  const mktMoiThang = new Map(mkt.map((x) => [x.ma, x]));
  const quy = (x) => { const d = hdVeDon.get(x.ma); return d ? { ...x, ma_goc: x.ma, ma: d } : x; };

  // nhân sự: so theo tên bỏ dấu; tên ngắn nằm trọn trong tên dài coi là 1 người (luật gộp tên Sale)
  const tenMkt = [...new Set(mkt.map((x) => x.nhan_su))];
  const tron = (ngan, dai) => (' ' + dai + ' ').includes(' ' + ngan + ' ');   // trọn chữ, không cắt giữa chữ
  // TÊN LẠ (anh Hải 17/11/2026: "tên dễ mà, họ hiếc các thứ đầy đủ, cái nào thấy lạ bảo t"): tên bên Kế toán không ghép được về
  // đúng 1 tên bên MKT -> gom vào ten_la, trang So khớp + chuông admin hiện cho anh xem. Không tự đoán.
  const tenLa = new Map();
  const veTenMkt = (t) => { const b = boDau(t); if (!b) return '(chưa gán)';
    const dung = tenMkt.find((m) => boDau(m) === b); if (dung) return dung;
    const gan = tenMkt.filter((m) => { const c = boDau(m); return c && Math.min(b.length, c.length) >= 4 && (tron(b, c) || tron(c, b)); });
    if (gan.length === 1) return gan[0];
    if (DA_NGHI[t]) return t;   // người đã nghỉ anh đã xác nhận -> không phải tên lạ
    if (!tenLa.has(t)) tenLa.set(t, gan.length ? 'giống nhiều người bên MKT: ' + gan.join(', ') : 'bên MKT không có tên này');
    return t; };   // nhiều tên cùng khớp / không khớp -> không đoán, giữ tên Kế toán

  // GHI CHÚ 2 BÊN + ĐÁNH GIÁ TỪNG ĐƠN LỆCH (anh Hải 17/11/2026: "tất cả phần lệch t cần có note của m vs kế toán về phần lệch đó tại sao lệch
  // hàng ngày, xem lý do có đủ hợp lý để bỏ qua không, đấy mới là việc chính"). Mỗi đơn lệch TIỀN: loại lệch + giải thích + đánh giá
  // 'bo_qua' (lý do hợp lý, cộng dồn / tiền thật không đổi) hoặc 'can_xem' (có thể sai số thật -- anh xem). Ghi chú Kế toán = ly_do trên dòng của họ,
  // hoặc bảng so_dt_2app_ly_do (lý do họ KHÔNG tính 1 mã MKT tính). Bên MKT cũng ghi lý do MKT không tính các mã Kế toán tính vào bảng đó.
  const ktTheoMa = new Map(), mktTheoMa = new Map();
  kt.map(quy).forEach((x) => { if (!ktTheoMa.has(x.ma)) ktTheoMa.set(x.ma, []); ktTheoMa.get(x.ma).push(x); });
  mkt.forEach((x) => { if (!mktTheoMa.has(x.ma)) mktTheoMa.set(x.ma, []); mktTheoMa.get(x.ma).push(x); });
  let ktLy = new Map();
  try { (await tai('so_dt_2app_ly_do', `select=thang,ma,ly_do&ben=eq.kt&thang=gte.${TU_THANG}`)).forEach((x) => ktLy.set(x.thang + '|' + x.ma, x.ly_do)); }
  catch (e) { console.log('Chưa đọc được so_dt_2app_ly_do: ' + e.message); }
  const thg = (t) => t.slice(5) + '/' + t.slice(0, 4);
  // 1 câu chung cho mỗi loại lệch (bảng tóm tắt theo loại trên trang So khớp)
  const GT_CHUNG = {
    'Lệch tháng': 'Cùng 1 đơn, 2 bên ghi khác tháng: MKT theo ngày tạo đơn, Kế toán theo ngày hoá đơn',
    'Phiếu tạm tính nhờ cọc của khách': 'MKT xét cọc theo KHÁCH, Kế toán theo TỪNG ĐƠN — phiếu chưa có tiền riêng',
    'Tính nhờ hoá đơn khác của khách': 'MKT tính vì khách có hoá đơn khác; đơn này chưa có tiền / hoá đơn riêng',
    'Trả hàng': 'Kế toán trừ hàng trả lại, MKT không trừ',
    'Khác giá trị': 'MKT lấy giá trị đơn đặt, Kế toán lấy giá trị hoá đơn',
    'Kế toán thấy tiền, MKT không thấy': 'Kế toán có phiếu thu sổ quỹ cho đơn, app MKT không đọc sổ quỹ',
    'Chênh không đáng kể': 'Đơn 0đ / chênh dưới 1.000đ',
    'Đơn huỷ': 'MKT không tính đơn huỷ',
    'Chỉ MKT tính': 'Kế toán không tính ở tháng nào', 'Chỉ Kế toán tính': 'MKT không tính ở tháng nào',
  };
  // nhận định từng đơn = thông tin RIÊNG của đơn đó (câu giải thích chung nằm ở bảng Lý do lệch, không lặp lại từng dòng)
  const congNo = new Map((vm.runInContext('kiotCustomers', ctx) || []).map((c) => [c.code, Number(c.debt || 0)]));
  const noKhach = (ma) => { if (!ma || !congNo.has(ma)) return ''; const d = congNo.get(ma); return d < 0 ? 'khách đang còn cọc ' + vndS(-d) : d > 0 ? 'khách đang nợ ' + vndS(d) + ', không còn cọc' : 'công nợ khách = 0, không còn cọc'; };
  const danhGia = (l, t) => {
    const dTien = l.kt - l.mkt;
    if (Math.abs(dTien) < 1000) return { loai: 'Chênh không đáng kể', dg: 'bo_qua', gt: 'Đơn 0đ hoặc chênh dưới 1.000đ — không ảnh hưởng số.' };
    if (l.chi === 'mkt') {
      const khac = (ktTheoMa.get(l.ma_raw) || []).filter((k) => k.thang !== t);
      if (khac.length) return { loai: 'Lệch tháng', dg: 'bo_qua', gt: 'MKT ' + thg(t) + ' · Kế toán ' + khac.map((k) => thg(k.thang) + (k.ma_goc ? ' (' + k.ma_goc + ')' : '')).join(', ') + ' — cùng đơn, cộng dồn không lệch.' };
      if (/cọc/.test(l.ly_mkt)) { const n = noKhach(l.ma_kh); return { loai: 'Phiếu tạm tính nhờ cọc của khách', dg: 'can_xem', gt: 'Phiếu chưa có tiền riêng' + (n ? '; ' + n : '') + '. Kế toán chưa thấy cọc / phiếu thu của đơn này.' }; }
      if (/hoá đơn hoàn thành/.test(l.ly_mkt)) return { loai: 'Tính nhờ hoá đơn khác của khách', dg: 'can_xem', gt: 'Đơn 0đ trên phiếu, chưa có hoá đơn riêng' + (noKhach(l.ma_kh) ? '; ' + noKhach(l.ma_kh) : '') + '.' };
      return { loai: 'Chỉ MKT tính', dg: 'can_xem', gt: 'Kế toán không tính ở tháng nào.' };
    }
    if (l.chi === 'kt') {
      if (l.kt < 0 || /trả hàng/i.test(l.ly_kt)) {
        const hd = (String(l.ly_kt).match(/HD\d[\w.]*/) || [])[0], don = hd && hdVeDon.get(hd);
        const mktGoc = mktTheoMa.get(don || hd || '');
        return mktGoc ? { loai: 'Trả hàng', dg: 'can_xem', gt: 'MKT vẫn tính đủ đơn gốc ' + (don || hd) + ' (' + mktGoc.map((m) => thg(m.thang)).join(', ') + ') → cao hơn thực thu ' + vndS(-l.kt) + '.' }
          : { loai: 'Trả hàng', dg: 'bo_qua', gt: 'Đơn gốc ' + (don || hd || '') + ' MKT không tính doanh thu → không ảnh hưởng số MKT.' };
      }
      const khac = (mktTheoMa.get(l.ma_raw) || []).filter((m) => m.thang !== t);
      if (khac.length) return { loai: 'Lệch tháng', dg: 'bo_qua', gt: 'Kế toán ' + thg(t) + (l.ma_goc ? ' (' + l.ma_goc + ')' : '') + ' · MKT ' + khac.map((m) => thg(m.thang)).join(', ') + ' (tạo đơn ' + khac[0].ngay + ') — cùng đơn, cộng dồn không lệch.' };
      // đơn huỷ = ngoại lệ hợp lệ (anh Hải 17/11/2026: "của m là doanh thu, k tính đơn hủy ... sau khi trừ ngoại lệ (đơn hủy, phiếu cọc tháng trước tháng này mới trả...) vẫn phải trùng")
      if (/^(đơn huỷ|hoá đơn không hoàn thành)/.test(l.ly_mkt)) return { loai: 'Đơn huỷ', dg: 'bo_qua', gt: 'MKT không tính (' + l.ly_mkt + ').' };
      if (/báo giá/.test(l.ly_mkt)) return { loai: 'Kế toán thấy tiền, MKT không thấy', dg: 'can_xem', gt: 'Nếu phiếu thu đúng của đơn này thì MKT đang THIẾU ' + vndS(l.kt) + '.' };
      return { loai: 'Chỉ Kế toán tính', dg: 'can_xem', gt: 'MKT không tính ở tháng nào.' };
    }
    const p = Math.abs(dTien) / Math.max(Math.abs(l.mkt), 1);
    return { loai: 'Khác giá trị', dg: p <= 0.02 ? 'bo_qua' : 'can_xem', gt: (l.ma_goc ? 'Hoá đơn ' + l.ma_goc + ' ' : 'Hoá đơn ') + (dTien > 0 ? 'cao hơn' : 'thấp hơn') + ' đơn đặt ' + vndS(Math.abs(dTien)) + ' (' + (p * 100).toFixed(1) + '%)'
      + (p <= 0.02 ? ' — chênh nhỏ lúc ra hoá đơn, bỏ qua được.' : ' — xem đơn có sửa hàng / thêm hàng lúc ra hoá đơn không.') };
  };
  const lyMktCuaKt = [];   // lý do MKT KHÔNG tính các mã Kế toán tính -> so_dt_2app_ly_do (ben mkt) cho bên Kế toán đọc

  const ketQua = [];
  for (const t of cacThang) {
    const M = mkt.filter((x) => x.thang === t), K = kt.filter((x) => x.thang === t).map(quy);
    const tong = (a, f) => a.filter(f || (() => true)).reduce((s, x) => s + Number(x.tien || 0), 0);
    const ben = (a) => ({ tong: tong(a), online: tong(a, (x) => x.kenh === 'Online'), offline: tong(a, (x) => x.kenh !== 'Online'), don: a.length });
    const v = { thang: t, mkt: ben(M), kt: K.length ? ben(K) : null };
    // theo nhân sự
    const ns = {};
    M.forEach((x) => { const n = ns[x.nhan_su] = ns[x.nhan_su] || { ten: x.nhan_su, mkt: 0, kt: 0, ten_kt: new Set() }; n.mkt += x.tien; });
    K.forEach((x) => { const k = veTenMkt(x.nhan_su); const n = ns[k] = ns[k] || { ten: k, mkt: 0, kt: 0, ten_kt: new Set() }; n.kt += Number(x.tien || 0); if (x.nhan_su && x.nhan_su !== k) n.ten_kt.add(x.nhan_su); });
    v.nhan_su = Object.values(ns).map((n) => ({ ten: n.ten, mkt: n.mkt, kt: K.length ? n.kt : null, ten_kt: [...n.ten_kt].join(', '), ghi: DA_NGHI[n.ten] || '' }))
      .sort((a, b) => Math.max(b.mkt, b.kt || 0) - Math.max(a.mkt, a.kt || 0));
    // từng đơn
    if (K.length) {
      const mM = new Map(M.map((x) => [x.ma, x])), mK = new Map();
      K.forEach((x) => { const c = mK.get(x.ma); if (c) { c.tien += Number(x.tien || 0); c.ma_goc = [c.ma_goc, x.ma_goc].filter(Boolean).join(', '); } else mK.set(x.ma, { ...x, tien: Number(x.tien || 0) }); });
      // chỉ đơn lệch TIỀN mới vào danh sách; khác kênh / nhân sự (tiền khớp) chỉ đếm -- 2 app gán theo luật riêng anh đã chốt giữ
      const lech = []; let khacKenh = 0, khacNs = 0;
      M.forEach((x) => { const y = mK.get(x.ma);
        if (!y) { lech.push({ ma: x.ma, ma_raw: x.ma, chi: 'mkt', mkt: x.tien, kt: 0, ly_mkt: x.ly_do, ly_kt: ktLy.get(t + '|' + x.ma) || '', nhan_su: x.nhan_su, kenh: x.kenh, ma_kh: x.ma_kh }); return; }
        if (x.kenh !== y.kenh) khacKenh++;
        if (veTenMkt(y.nhan_su) !== x.nhan_su) khacNs++;
        if (Math.round(x.tien) !== Math.round(y.tien)) lech.push({ ma: x.ma + (y.ma_goc ? ' (KT: ' + y.ma_goc + ')' : ''), ma_raw: x.ma, ma_goc: y.ma_goc || '', chi: '', mkt: x.tien, kt: y.tien, ly_mkt: x.ly_do, ly_kt: y.ly_do || '', nhan_su: x.nhan_su, kenh: x.kenh }); });
      mK.forEach((y, ma) => { if (mM.has(ma)) return;
        const lyM = lyDoMktKhongTinh(ctx, ma, t, mktMoiThang);
        lyMktCuaKt.push({ thang: t, ben: 'mkt', ma: y.ma_goc || ma, ly_do: 'MKT không tính tháng này: ' + lyM, luc });
        lech.push({ ma: ma + (y.ma_goc ? ' (KT: ' + y.ma_goc + ')' : ''), ma_raw: ma, ma_goc: y.ma_goc || '', chi: 'kt', mkt: 0, kt: y.tien, ly_mkt: lyM, ly_kt: y.ly_do || '', nhan_su: y.nhan_su || '', kenh: y.kenh || '' }); });
      lech.forEach((l) => { const d = danhGia(l, t); l.loai = d.loai; l.dg = d.dg; l.gt = d.gt; l.kieu = l.chi === 'mkt' ? 'chỉ MKT tính' : l.chi === 'kt' ? 'chỉ Kế toán tính' : 'khác tiền'; });
      lech.sort((a, b) => (a.dg === 'can_xem' ? 0 : 1) - (b.dg === 'can_xem' ? 0 : 1) || Math.abs(b.mkt - b.kt) - Math.abs(a.mkt - a.kt));
      // tổng hợp theo loại lệch: số đơn + tiền chênh (KT − MKT) + đánh giá
      const nhom = {};
      lech.forEach((l) => { const g = nhom[l.loai + '|' + l.dg] = nhom[l.loai + '|' + l.dg] || { loai: l.loai, dg: l.dg, don: 0, chenh: 0, gt: GT_CHUNG[l.loai] || '', moi: 0 }; g.don++; g.chenh += l.kt - l.mkt; });
      v.nhom = Object.values(nhom).sort((a, b) => (a.dg === 'can_xem' ? 0 : 1) - (b.dg === 'can_xem' ? 0 : 1) || Math.abs(b.chenh) - Math.abs(a.chenh));
      v.so_lech_tien = lech.length; v.so_lech = lech.length + khacKenh + khacNs; v.khac_kenh = khacKenh; v.khac_ns = khacNs;
      v.can_xem = lech.filter((l) => l.dg === 'can_xem').length; v.can_xem_tien = lech.filter((l) => l.dg === 'can_xem').reduce((s, l) => s + l.kt - l.mkt, 0);
      v.lech = lech.slice(0, 250);
      // ĐỐI CHIẾU (anh Hải 17/11/2026): MKT ± ngoại lệ hợp lệ (bỏ qua được) PHẢI = Kế toán. con_lech = phần còn lại sau ngoại lệ = tổng chênh các đơn
      // CẦN XEM (mục tiêu 0). chua_giai_thich = (KT − MKT) − tổng chênh mọi đơn lệch: phép cộng phải khép kín, khác 0 là job so sót đơn.
      const sum = (f) => lech.filter(f).reduce((s, l) => s + l.kt - l.mkt, 0);
      v.doi_chieu = { chenh: v.kt.tong - v.mkt.tong, ngoai_le: sum((l) => l.dg === 'bo_qua'), ngoai_le_don: lech.filter((l) => l.dg === 'bo_qua').length, con_lech: sum((l) => l.dg === 'can_xem') };
      v.doi_chieu.chua_giai_thich = Math.round(v.doi_chieu.chenh - v.doi_chieu.ngoai_le - v.doi_chieu.con_lech);
      v.khop = Math.round(v.mkt.tong) === Math.round(v.kt.tong) && Math.round(v.mkt.online) === Math.round(v.kt.online);
    }
    ketQua.push(v);
  }

  // (3) tóm tắt + hộp thư
  const nay = ketQua[ketQua.length - 1];
  const tomTat = kt.length
    ? ketQua.map((v) => v.thang.slice(5) + '/' + v.thang.slice(2, 4) + ': MKT ' + tr(v.mkt.tong) + (v.kt ? ' / KT ' + tr(v.kt.tong) + (v.so_lech_tien ? ' (' + v.so_lech_tien + ' đơn lệch tiền: ' + v.can_xem + ' cần xem, ' + (v.so_lech_tien - v.can_xem) + ' bỏ qua được)' : ' khớp tiền') : ' / KT chưa có')).join(' · ')
    : 'Kế toán chưa gửi số vào so_dt_2app';
  const ghiChu = (ktCu ? (ktLuc ? 'Số Kế toán cũ (gửi lúc ' + ktLuc.slice(0, 16) + ' UTC) · ' : 'Kế toán chưa gửi số · ') : '')
    + 'Tháng ' + nay.thang.slice(5) + ': MKT ' + tr(nay.mkt.tong) + ' (Onl ' + tr(nay.mkt.online) + ' / Off ' + tr(nay.mkt.offline) + ')'
    + (nay.kt ? ' · KT ' + tr(nay.kt.tong) + ' (Onl ' + tr(nay.kt.online) + ' / Off ' + tr(nay.kt.offline) + ') · ' + (nay.can_xem || 0) + ' đơn lệch cần xem' : '');
  console.log(ghiChu); console.log(tomTat);
  tenLa.forEach((ly, ten) => console.log('TÊN LẠ bên Kế toán: ' + ten + ' — ' + ly));
  ketQua.forEach((v) => { console.log('\n== ' + v.thang + ' · MKT ' + tr(v.mkt.tong) + ' Onl ' + tr(v.mkt.online) + ' Off ' + tr(v.mkt.offline) + ' (' + v.mkt.don + ' đơn)'
    + (v.kt ? ' | KT ' + tr(v.kt.tong) + ' Onl ' + tr(v.kt.online) + ' Off ' + tr(v.kt.offline) + ' (' + v.kt.don + ' đơn)' : ''));
    v.nhan_su.slice(0, 12).forEach((n) => console.log('   ' + n.ten.padEnd(24) + tr(n.mkt).padStart(10) + (n.kt != null ? tr(n.kt).padStart(10) : '')));
    if (v.doi_chieu) console.log('   ĐỐI CHIẾU: MKT ' + tr(v.mkt.tong) + ' ± ngoại lệ ' + tr(v.doi_chieu.ngoai_le) + ' = ' + tr(v.mkt.tong + v.doi_chieu.ngoai_le) + ' · KT ' + tr(v.kt.tong) + ' · CÒN LỆCH ' + tr(v.doi_chieu.con_lech) + (v.doi_chieu.chua_giai_thich ? ' · CHƯA GIẢI THÍCH ' + vndS(v.doi_chieu.chua_giai_thich) : ' · khép kín'));
    (v.nhom || []).forEach((g) => console.log('   [' + (g.dg === 'can_xem' ? 'CẦN XEM' : 'bỏ qua') + '] ' + g.loai + ': ' + g.don + ' đơn, KT − MKT ' + tr(g.chenh)));
    (v.lech || []).filter((l) => l.dg === 'can_xem').slice(0, 6).forEach((l) => console.log('     ' + l.ma + ' · ' + l.loai + ' · MKT ' + tr(l.mkt) + ' / KT ' + tr(l.kt))); });

  // đơn CẦN XEM mới so với lượt trước -> chuông (đơn cũ đã báo thì thôi, tránh chuông lặp mỗi đêm)
  const khoaCx = []; ketQua.forEach((v) => (v.lech || []).forEach((l) => { if (l.dg === 'can_xem') khoaCx.push(v.thang + '|' + l.ma_raw); }));
  let truoc = null;
  try { const r = await tai('kiot_so_khop', 'select=k:doanh_thu->can_xem_keys&doanh_thu=not.is.null&order=chay_luc.desc'); truoc = r[0] && Array.isArray(r[0].k) ? new Set(r[0].k) : null; } catch (e) { truoc = null; }
  const moiCx = truoc ? khoaCx.filter((k) => !truoc.has(k)) : [];
  ketQua.forEach((v) => (v.lech || []).forEach((l) => { if (l.dg === 'can_xem' && truoc && !truoc.has(v.thang + '|' + l.ma_raw)) {
    l.moi = true; const g = (v.nhom || []).find((x) => x.loai === l.loai && x.dg === l.dg); if (g) g.moi++; } }));
  console.log('\nĐơn cần xem: ' + khoaCx.length + (truoc ? ' · mới so với lượt trước: ' + moiCx.length : ' (lượt đầu, chưa có lượt trước để so)'));

  if (!KHO) {
    // lý do MKT không tính các mã Kế toán tính -> bảng lý do cho bên Kế toán đọc
    await ghiDb('so_dt_2app_ly_do', null, `?ben=eq.mkt&thang=gte.${TU_THANG}`, 'DELETE');
    const lyGop = new Map(lyMktCuaKt.map((x) => [x.thang + '|' + x.ma, x]));
    const lyDs = [...lyGop.values()];
    for (let i = 0; i < lyDs.length; i += 500) await ghiDb('so_dt_2app_ly_do', lyDs.slice(i, i + 500));
    // hộp thư: 1 tin tóm tắt / ngày (chạy tay nhiều lần trong ngày không thêm tin)
    const daCo = await tai('so_dt_2app_tin', `select=id&ben=eq.mkt&luc=gte.${new Date(Date.now() - 12 * 3600e3).toISOString()}`).catch(() => []);
    if (!daCo.length) await ghiDb('so_dt_2app_tin', { ben: 'mkt', thang: nay.thang, noi_dung: 'Lượt so đêm ' + vnNay().slice(0, 10) + ': ' + tomTat });
    let tin = [];
    try { tin = await tai('so_dt_2app_tin', 'select=id,luc,ben,thang,ma,noi_dung&order=luc.desc'); } catch (e) { /* hộp thư lỗi không chặn kết quả */ }
    const ten_la = [...tenLa].map(([ten, ly]) => ({ ten, ly, tien: kt.filter((x) => x.nhan_su === ten).reduce((s, x) => s + Number(x.tien || 0), 0),
      thang: [...new Set(kt.filter((x) => x.nhan_su === ten).map((x) => x.thang))].sort().join(', ') }));
    const doanhThu = { luc, tu_thang: TU_THANG, kt_luc: ktLuc || null, kt_cu: ktCu, ghi_chu: ghiChu, thang: ketQua, trung, ten_la, tin: tin.slice(0, 40),
      can_xem_keys: khoaCx, can_xem_moi: moiCx.length, lan_dau: !truoc };
    // gắn vào lượt so khớp mã MỚI NHẤT (bước ngay trước trong sync-kiot.yml); kết quả mang giờ riêng (doanh_thu.luc) nên chạy tay gắn lượt cũ hơn vẫn rõ.
    // KHÔNG thêm lượt riêng: chuông + trang So khớp lấy lượt mới nhất làm kết quả so mã -> 1 dòng không so mã sẽ báo "khớp" sai.
    const gan = await tai('kiot_so_khop', 'select=id&trang_thai=neq.running&order=chay_luc.desc').catch(() => []);
    if (!gan[0]) throw new Error('chưa có lượt kiot_so_khop nào để gắn kết quả');
    await ghiDb('kiot_so_khop', { doanh_thu: doanhThu }, '?id=eq.' + gan[0].id, 'PATCH');
    console.log('\nĐã ghi so_dt_2app (ben mkt) + kết quả vào kiot_so_khop #' + gan[0].id);
  } else console.log('\n(KHO=1: chưa ghi gì)');
})().catch((e) => { console.error('LỖI', e.message); process.exit(1); });
