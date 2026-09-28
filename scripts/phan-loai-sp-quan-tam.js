// TỰ PHÂN LOẠI "SẢN PHẨM QUAN TÂM" CHO KHÁCH SỈ: Đồ thờ / Nến / Hỗn hợp (anh Hải 28/9/2026).
// Thứ tự xét (dừng ở bước đầu tiên ra kết quả):
//   1. ĐÃ MUA -> xem phiếu đặt hàng Kiot: mặt hàng tên bắt đầu "Nến" (Nến Bơ, Nến Sen, Nến cốc…) = nến,
//      còn lại = đồ thờ ("Đế nến", "Chân nến", "Đèn nến" là đồ thờ). Nến chiếm 10–90% tiền hàng = Hỗn hợp.
//   2. CHƯA MUA -> quảng cáo khách bấm vào (tên QC / chiến dịch có chữ "nến" = Nến, có tên đồ thờ = Đồ thờ),
//      hoặc khách nhắn page Tự Tại Viên (page nến bơ) = Nến.
//   3. Chưa rõ -> đọc hội thoại Pancake: bài viết / quảng cáo khách nhắn từ đó, rồi tới tin khách hỏi gì.
//   4. Vẫn chưa rõ mà khách đến từ page (Thời Đại…) = Đồ thờ. Không có gì để xét thì để trống.
// Sale chọn tay trong hồ sơ (si_sp_qt_nguon = 'Tay') thì KHÔNG ghi đè.
// Bước 3 tốn API Pancake -> kết quả hội thoại giữ 7 ngày mới đọc lại. Bước 1-2 tính lại mỗi lượt (đơn mới là đổi ngay).
// Chạy: KHO=1 để chỉ đếm, không ghi. MAU=40 để thử 40 khách rải đều và in từng khách (kèm KHO=1).
const { napApp, masterCua, tai, SUPABASE_URL, H } = require('./lib/nap-app');
const fs = require('fs'), path = require('path');

const TOKEN = process.env.PANCAKE_SESSION_TOKEN || (() => {
  try { return (fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8')
    .match(/PANCAKE_SESSION_TOKEN[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1]; } catch (e) { return ''; }
})();
const XEM = process.env.KHO === '1';
const PAGE_TTV = '100667699549693';                         // Nến Bơ - Tự Tại Viên
const PAGE_TIM = ['506247572578559', PAGE_TTV];             // tìm hội thoại theo SĐT cho khách không có sẵn hội thoại
const GIU_HOI_THOAI_NGAY = 7;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const boDau = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
// Đếm dấu hiệu nến / đồ thờ trong 1 đoạn chữ (tên QC, tin nhắn). "nên" bỏ dấu cũng thành "nen" nên chữ
// KHÔNG dấu chỉ nhận khi đi kèm loại nến (nen bo, nen coc…).
function dauHieu(chu) {
  const t = String(chu || '').toLowerCase(), k = boDau(chu);
  let nen = (t.match(/(?<!(đế|chân|đèn|kệ|cắm|giá|đặt)\s)nến/g) || []).length
    + (k.match(/\bnen (bo|coc|tru|sen|hu|cuc|tealight|ly)\b/g) || []).length + (k.match(/tealight/g) || []).length;
  const tho = (t.match(/(bàn thờ|ban thờ|đồ thờ|bộ thờ|tủ thờ|tượng|đèn thờ|đèn lưu ly|bát hương|lư hương|đỉnh đồng|mâm bồng|lọ hoa|lục bình|thần tài|ông địa|án gian|sập thờ|kỷ thờ|chóe|choé|đài thờ|chuông|hoành phi|câu đối|cuốn thư|tranh thờ|bài vị|đế nến|chân nến|đèn nến|phủ thờ|khăn phủ|đồ đồng|đồ sứ|đồ gỗ)/g) || []).length
    + (k.match(/\b(ban tho|do tho|bo tho|tu tho|tuong phat|tuong quan am|den tho|bat huong|lu huong|than tai|mam bong|lo hoa)\b/g) || []).length;
  return { nen, tho };
}
const ketLuan = d => d.nen && d.tho ? 'Hỗn hợp' : d.nen ? 'Nến' : d.tho ? 'Đồ thờ' : '';
// Tính theo TIỀN: phần ít hơn chiếm từ 10% trở lên = Hỗn hợp, còn lại theo phần áp đảo
// (vd mua 477 món đồ thờ + 9 hộp nến vẫn là Đồ thờ). Dòng phí (vận chuyển, lắp đặt…) không tính là hàng.
const NGUONG_HON_HOP = 0.1;
const laPhi = ten => /(phí|vận chuyển|ship|cước|lắp đặt|phụ thu|đóng gói|chiết khấu)/i.test(String(ten || ''));
const laNen = ten => /^\s*nến\b/i.test(String(ten || '')) || /^\s*nen\b/i.test(boDau(ten));

const pc = async (url, lan = 3) => {
  for (let i = 0; i < lan; i++) {
    try { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'access_token=' + TOKEN); if (r.ok) return await r.json(); }
    catch (e) { /* thử lại */ }
    await sleep(1500 * (i + 1));
  }
  return null;
};

// Đọc 1 hội thoại: tên QC / bài viết khách bấm vào + các tin KHÁCH nhắn (bỏ tin page trả lời, tin chào tự động).
async function docHoiThoai(page, conv, cid) {
  if (!cid) {
    const c = await pc(`https://pancake.vn/api/v1/pages/${page}/conversations/${conv}`);
    cid = c && ((c.customers || (c.conversation || {}).customers || [])[0] || {}).id;
    if (!cid) return null;
  }
  const m = await pc(`https://pancake.vn/api/v1/pages/${page}/conversations/${conv}/messages?customer_id=${cid}`);
  if (!m) return null;
  const qc = [...new Set((m.activities || []).map(a => ((a.ads_context_data || {}).ad_title || a.ad_title || '')).filter(Boolean))];
  const bai = m.post ? [m.post.message || m.post.title || ''].filter(Boolean) : [];
  const khach = (m.messages || []).filter(x => !(x.from && String(x.from.id) === String(page)))
    .map(x => String(x.original_message || x.message || '').replace(/<[^>]+>/g, ' ').trim()).filter(Boolean);
  return { qc: qc.concat(bai), khach };
}

(async () => {
  const ctx = await napApp();
  let rows = masterCua(ctx, 'Sỉ');
  const MAU = Number(process.env.MAU || 0);
  if (MAU) { const b = Math.max(1, Math.floor(rows.length / MAU)); rows = rows.filter((x, i) => i % b === 0).slice(0, MAU); }
  const qcTen = {};   // ad_id -> "tên QC · chiến dịch" (chỉ có QC từ 6/2026 trong bảng chi phí)
  (await tai('mkt_spend', 'select=ad_id,ad_name,campaign_name')).forEach(a => {
    if (a.ad_id) qcTen[a.ad_id] = [a.ad_name, a.campaign_name].filter(Boolean).join(' · ');
  });
  const manual = require('vm').runInContext('rptSlManual', ctx), nay = Date.now();
  const dem = { tay: 0, mua: 0, qc: 0, page: 0, hoiThoai: 0, macDinh: 0, trong: 0, giuCu: 0, doi: 0 };
  const ghi = [];
  let goiApi = 0;
  for (const r of rows) {
    const mn = manual[r.leadId] || {};
    if (r.siSpQTNguon === 'Tay') { dem.tay++; continue; }
    let gt = '', nguon = '', ly = '';
    // 1) ĐÃ MUA
    const don = (r.kords || []).concat(r.repeatOrds || []);
    const mon = don.flatMap(o => o.items || []).filter(i => !laPhi(i.name));
    if (mon.length) {
      const tien = a => a.reduce((x, i) => x + Number(i.qty || 0) * Number(i.price || 0), 0);
      const nen = mon.filter(i => laNen(i.name)), tho = mon.filter(i => !laNen(i.name));
      const tn = tien(nen), tt = tien(tho), tl = tn + tt ? tn / (tn + tt) : nen.length / mon.length;
      gt = tl >= NGUONG_HON_HOP && tl <= 1 - NGUONG_HON_HOP ? 'Hỗn hợp' : tl > 0.5 ? 'Nến' : 'Đồ thờ'; nguon = 'Mua hàng';
      const vd = a => a.slice(0, 2).map(i => String(i.name).replace(/\s*\([^)]*\)\s*$/, '')).join('; ');
      ly = `${don.length} đơn Kiot · nến ${Math.round(tl * 100)}% tiền hàng: ${nen.length} món nến${nen.length ? ' (' + vd(nen) + ')' : ''}, ${tho.length} món đồ thờ${tho.length ? ' (' + vd(tho) + ')' : ''}`;
      dem.mua++;
    }
    // 2) QUẢNG CÁO (bảng chi phí) / PAGE TỰ TẠI VIÊN
    const conv = [[r.pageId, r.convId]].concat((r.mergedRows || []).map(m => [m.pageId, m.convId])).filter(x => x[0] && x[1]);
    const pages = new Set(conv.map(x => String(x[0])).concat(r.pageId ? [String(r.pageId)] : []));
    if (!gt) {
      const ten = [r.adId, (r.sh || {}).ad_id].filter(Boolean).map(id => qcTen[id]).filter(Boolean);
      const kq = ketLuan(dauHieu(ten.join(' | ')));
      if (kq) { gt = kq; nguon = 'Quảng cáo'; ly = 'QC: ' + ten.join(' | '); dem.qc++; }
    }
    if (!gt && (pages.has(PAGE_TTV) || r.brand === 'TTV')) { gt = 'Nến'; nguon = 'Page'; ly = 'Nhắn page Nến Bơ - Tự Tại Viên'; dem.page++; }
    // 3) HỘI THOẠI (kết quả cũ còn hạn thì giữ, khỏi gọi API)
    if (!gt) {
      const cu = mn.si_sp_qt_luc && (nay - new Date(mn.si_sp_qt_luc).getTime()) < GIU_HOI_THOAI_NGAY * 864e5
        && ['Hội thoại', 'Page', 'Chưa rõ', 'Quảng cáo'].includes(mn.si_sp_qt_nguon);
      if (cu) { dem.giuCu++; continue; }
      let ds = conv.slice(0, 3);
      if (!ds.length && TOKEN) {                       // khách không có đơn Pancake -> tìm hội thoại theo SĐT
        for (const so of (r.phones || []).map(p => p.so).filter(Boolean).slice(0, 2)) {
          for (const pg of PAGE_TIM) {
            const s = await pc(`https://pancake.vn/api/v1/pages/${pg}/conversations/search?q=${encodeURIComponent(String(so).replace(/\D/g, ''))}`);
            goiApi++;
            (s && (s.conversations || s.data) || []).slice(0, 2).forEach(c => ds.push([pg, c.id, ((c.customers || [])[0] || {}).id]));
            if (pg === PAGE_TTV && ds.some(x => x[0] === PAGE_TTV)) pages.add(PAGE_TTV);
            await sleep(150);
          }
        }
        if (ds.some(x => x[0] === PAGE_TTV)) { gt = 'Nến'; nguon = 'Page'; ly = 'Có nhắn page Nến Bơ - Tự Tại Viên'; dem.page++; }
        ds.forEach(x => pages.add(String(x[0])));
      }
      if (!gt && TOKEN) {
        const qc = [], khach = [];
        for (const [pg, cv, cid] of ds) {
          const h = await docHoiThoai(pg, cv, cid); goiApi += 2;
          if (h) { qc.push(...h.qc); khach.push(...h.khach); }
          await sleep(150);
        }
        const kqQc = ketLuan(dauHieu(qc.join(' | ')));
        const kqKh = ketLuan(dauHieu(khach.join(' | ')));
        if (kqQc) { gt = kqQc; nguon = 'Quảng cáo'; ly = 'Nhắn từ QC/bài: ' + [...new Set(qc)].slice(0, 2).join(' | '); dem.qc++; }
        else if (kqKh) {
          gt = kqKh; nguon = 'Hội thoại';
          const cau = [khach.find(x => dauHieu(x).nen), khach.find(x => dauHieu(x).tho)].filter(Boolean);
          ly = 'Khách hỏi: ' + [...new Set(cau)].map(x => '"' + x.slice(0, 90) + '"').join(' · '); dem.hoiThoai++;
        }
      }
      // 4) MẶC ĐỊNH theo page
      if (!gt && pages.size) { gt = 'Đồ thờ'; nguon = 'Page'; ly = 'Nhắn page Thời Đại, không thấy hỏi nến'; dem.macDinh++; }
      if (!gt) { nguon = 'Chưa rõ'; ly = 'Không có đơn, quảng cáo hay hội thoại để xét'; dem.trong++; }
    }
    if ((mn.si_sp_quan_tam || '') === gt && (mn.si_sp_qt_nguon || '') === nguon && (mn.si_sp_qt_ly || '') === ly) continue;
    dem.doi++;
    if (MAU) console.log(' ', (gt || '—').padEnd(8), '|', nguon.padEnd(10), '|', String(r.name).slice(0, 28).padEnd(28), '|', ly.slice(0, 110));
    ghi.push({ lead_id: r.leadId, si_sp_quan_tam: gt || null, si_sp_qt_nguon: nguon || null, si_sp_qt_ly: ly || null,
      si_sp_qt_luc: new Date().toISOString() });
  }
  const tong = {};
  rows.forEach(r => { const g = (ghi.find(x => x.lead_id === r.leadId) || {}).si_sp_quan_tam
    ?? (manual[r.leadId] || {}).si_sp_quan_tam ?? r.siSpQT; tong[g || '(chưa rõ)'] = (tong[g || '(chưa rõ)'] || 0) + 1; });
  console.log('Khách Sỉ:', rows.length, '·', JSON.stringify(dem), '· gọi API Pancake ~', goiApi);
  console.log('Kết quả:', JSON.stringify(tong));
  if (XEM) { console.log('(KHO=1: không ghi)'); return; }
  for (let i = 0; i < ghi.length; i += 200) {
    const lo = ghi.slice(i, i + 200);
    const res = await fetch(`${SUPABASE_URL}/saleretail_manual?on_conflict=lead_id`, {
      method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, H),
      body: JSON.stringify(lo) });
    if (!res.ok) throw new Error('Ghi saleretail_manual lỗi ' + res.status + ': ' + (await res.text()).slice(0, 200));
  }
  console.log('Đã ghi', ghi.length, 'khách.');
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
