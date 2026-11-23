// TỰ CHUYỂN KHÁCH TIỀM NĂNG -> "KHÔNG TIỀM NĂNG" SAU 7 NGÀY (anh Hải 23/11/2026):
//   "tiềm năng sau 7 ngày không phản hồi thêm gì kể từ lần cuối sale nhắn hoặc không cho sđt thì chuyển về hết thành không tiềm năng"
//   (anh chọn: quá 7 ngày kể từ tin cuối của Sale mà khách IM, HOẶC vẫn CHƯA có SĐT), "không tiềm năng thì khách trên pancake lại đổi thành đạt",
//   "qc nó đưa tiềm năng là được rồi, còn m là người xử lý tiếp, không cần làm phiền nó bước này" -> APP TỰ LÀM, không qua QC.
// Đối tượng: khách app (Lẻ + Sỉ) Phân loại "Tiềm năng, chưa ra đơn", CHƯA chốt, có hội thoại Pancake (đơn Pancake có conversation + page).
// Xét hội thoại (Pancake API, tin gần nhất): tin cuối của Sale (from = page) cách nay >= 7 ngày VÀ (sau tin đó khách không nhắn gì "có nội dung"
//   HOẶC khách chưa có SĐT — app không có số, hội thoại không có số). Tin "ok / dạ / vâng / cảm ơn" ngắn (≤ 24 ký tự, không "?") KHÔNG tính
//   là nhắn (cùng chuẩn QC); ảnh / tệp có tính.
// Làm: (1) saleretail_manual.si_phan_loai = "Không tiềm năng" (Lead ID chính; updated_by "Monsieur Claude (7 ngày)") + activity_log;
//   (2) thẻ khách POS: bỏ thẻ *TIỀM NĂNG*, thêm LEAD ĐẠT (khách có CHỐT ĐƠN thì không đụng thẻ); cập nhật datahub_orders.customer_tags;
//   nhật ký gắn thẻ QC (pancake_gan_the_qc) nếu có -> nhom 'dat' + the_sau mới (để bước đồng bộ nhóm khỏi coi là Sale đụng).
// TỰ TRẢ LẠI: khách job đã chuyển mà sau đó nhắn lại (tin có nội dung sau lúc chuyển), Phân loại vẫn đúng do job đặt -> xoá Phân loại (app tự
//   tính lại theo thẻ) + trả thẻ (thêm lại LEAD TIỀM NĂNG, bỏ LEAD ĐẠT nếu do job thêm). Sale đã tự đổi Phân loại sau đó thì không đụng.
// Lịch: bước trong sync-datahub.yml, tối đa 1 lượt / 6 giờ (gianhMoc), chỉ 7h–22h VN. KHO=1 chạy thử. CHAY_NGAY=1 bỏ lịch.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { sbAll } = require('./lib/sb');
const KEYS = (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'supabase-keys.local.txt'), 'utf8'); } catch (e) { return ''; } })();
const TOKEN = process.env.PANCAKE_SESSION_TOKEN || (KEYS.match(/PANCAKE_SESSION_TOKEN[^\n]*\n\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (KEYS.match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1];
const SB = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const XEM = process.env.KHO === '1';
const NGAY = 7, AI = 'Monsieur Claude (7 ngày)';
const HSB = { apikey: KHOA, Authorization: 'Bearer ' + KHOA, 'Content-Type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pos = p => `https://pos.pages.fm/api/v1/${p}${p.includes('?') ? '&' : '?'}access_token=${TOKEN}`;
const an = s => String(s || '').split(TOKEN || '\u0000').join('***');
const utc = s => Date.parse(/Z|[+-]\d\d:?\d\d$/.test(String(s)) ? s : s + 'Z');
async function lay(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) return null; } catch (e) { /* thử lại */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const soTrong = t => (String(t || '').replace(/[.\s-]/g, '').match(/(?:\+?84|0)[35789]\d{8}/g) || []);
const coNoiDung = m => {   // tin khách "có nội dung"
  if ((m.attachments || []).length) return true;
  const t = String(m.original_message || m.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return t.length > 24 || /\?/.test(t);
};
// đọc hội thoại: { saleCuoi (ms), khachSau (bool), coSo (bool), tinKhachCuoi (ms) }
async function docHoiThoai(page, conv) {
  const c = await lay(`https://pancake.vn/api/v1/pages/${page}/conversations/${conv}?access_token=${TOKEN}`);
  const cv = c && (c.conversation || c), kh = ((cv && cv.customers) || [])[0];
  if (!cv || !kh || !kh.id) return null;
  const m = await lay(`https://pancake.vn/api/v1/pages/${page}/conversations/${conv}/messages?customer_id=${kh.id}&access_token=${TOKEN}`);
  const ds = ((m && m.messages) || []).map(x => ({ ...x, t: utc(x.inserted_at) })).filter(x => !isNaN(x.t)).sort((a, b) => a.t - b.t);
  if (!ds.length) return null;
  const laSale = x => String(x.from && x.from.id) === String(page);
  const sale = ds.filter(laSale), khach = ds.filter(x => !laSale(x) && coNoiDung(x));
  const saleCuoi = sale.length ? sale[sale.length - 1].t : null;
  const tinKhachCuoi = khach.length ? khach[khach.length - 1].t : null;
  const coSo = ((cv.recent_phone_numbers || []).length > 0) || ds.some(x => !laSale(x) && soTrong(x.original_message || x.message).length);
  return { saleCuoi, khachSau: saleCuoi != null && tinKhachCuoi != null && tinKhachCuoi > saleCuoi, coSo, tinKhachCuoi };
}

(async () => {
  if (!TOKEN || !KHOA) { console.error('Thiếu PANCAKE_SESSION_TOKEN / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  if (process.env.CHAY_NGAY !== '1') {
    const gio = new Date(Date.now() + 7 * 3600e3).getUTCHours();
    if (gio < 7 || gio > 22) { console.log('Không tiềm năng 7 ngày: ngoài 7h–22h VN — bỏ qua'); return; }
    const { gianhMoc } = require('./lib/gianh-moc');
    if (!(await gianhMoc(SB, KHOA, 'tu-khong-tiem-nang', 6 * 60))) { console.log('Không tiềm năng 7 ngày: chưa đủ 6 giờ từ lượt trước — bỏ qua'); return; }
  }
  const { napApp, masterCua } = require('./lib/nap-app');
  const ctx = await napApp();
  const ungVien = [];
  for (const L of ['Lẻ', 'Sỉ']) {
    masterCua(ctx, L);
    ctx.__L = L;
    const ds = vm.runInContext(`(()=>{window._rptSlType=__L;window._kiotOrdByCode=null;rptSlXoaCache();
      return rptSlBuildMaster().filter(r=>!r.isChot&&!r.vangLai&&rptSlLocTT(r)==='Tiềm năng, chưa ra đơn').map(r=>{const c=rptSlPcConv(r);
        const cs=rptSlCsRows(r).map(x=>String(x.ngay_cham||x.created_at||'').slice(0,10)).filter(Boolean).sort().pop()||'';
        return {lead:r.leadId,ids:rptSlIdsCua(r),ten:r.name,kh:r.kh||'',coSoApp:!!((r.phones||[]).length||r.phone),conv:c&&c.conv,page:c&&c.page,csCuoi:cs,
          don:(r.orders||[]).filter(o=>o&&o.conversation_id===(c&&c.conv)).map(o=>({shop:o.shop_id,id:o.order_id}))};});})()`, ctx);
    ds.filter(x => x.conv && x.page).forEach(x => ungVien.push({ ...x, loai: L }));
  }
  const nkCu = await sbAll(SB, KHOA, 'khach_khong_tiem_nang_tu_dong', 'select=*&order=lead_id');
  const manCua = id => (ctx.rptSlManual || {})[id] || vm.runInContext(`rptSlManual[${JSON.stringify(id)}]||null`, ctx) || {};
  console.log(`Không tiềm năng 7 ngày: ${ungVien.length} khách tiềm năng có hội thoại Pancake · nhật ký ${nkCu.length}${XEM ? ' (KHO=1: chạy thử)' : ''}`);

  const now = Date.now(), dem = { chuyen: 0, im: 0, chua_so: 0, giu: 0, tra: 0, loi: 0, khong_doc: 0 };
  const act = [];
  const doiThe = async (shop, orderId, conv, fn) => {   // đọc thẻ khách của đơn, fn(cu) -> thẻ mới | null; trả {cid, cu, moi}
    const j = await lay(pos(`shops/${shop}/orders/${orderId}`)); const d = j && (j.data || j);
    const cid = d && d.customer && d.customer.id, cu = d && d.customer && d.customer.shop_customer && d.customer.shop_customer.tags;
    if (!cid || !Array.isArray(cu)) return null;
    const moi = fn(cu); if (!moi) return { cid, cu, moi: null };
    if (!XEM) {
      const r = await fetch(pos(`shops/${shop}/customers/${cid}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { tags: moi } }) });
      if (!r.ok) throw new Error('PUT thẻ ' + r.status + ' ' + an((await r.text()).slice(0, 120)));
      await fetch(`${SB}/rest/v1/datahub_orders?conversation_id=eq.${encodeURIComponent(conv)}&shop_id=eq.${shop}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ customer_tags: moi.join(', ') }) }).catch(() => null);
      await fetch(`${SB}/rest/v1/pancake_gan_the_qc?conversation_id=eq.${encodeURIComponent(conv)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ the_sau: moi.join(', ') }) }).catch(() => null);
    }
    return { cid, cu, moi };
  };

  // ── 1. TỰ TRẢ LẠI: khách job đã chuyển mà nay nhắn lại ──
  for (const x of nkCu.filter(r => !r.tra_lai_luc && r.conversation_id)) {
    const m = manCua(x.lead_id);
    if (String(m.si_phan_loai || '').trim() !== 'Không tiềm năng' || String(m.updated_by || '') !== AI) continue;   // Sale đã đổi -> không đụng
    const page = String(x.conversation_id).split('_')[0];
    const h = await docHoiThoai(page, x.conversation_id); await sleep(250);
    if (!h || !h.tinKhachCuoi || h.tinKhachCuoi <= Date.parse(x.luc)) continue;
    dem.tra++;
    if (XEM) continue;
    try {
      await fetch(`${SB}/rest/v1/saleretail_manual?lead_id=eq.${encodeURIComponent(x.lead_id)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ si_phan_loai: x.phan_loai_truoc && x.phan_loai_truoc !== 'Tiềm năng, chưa ra đơn' ? x.phan_loai_truoc : null, updated_by: AI, updated_at: new Date().toISOString() }) });
      if (x.shop_id) {
        const don = (await sbAll(SB, KHOA, 'datahub_orders', 'select=order_id&shop_id=eq.' + x.shop_id + '&conversation_id=eq.' + encodeURIComponent(x.conversation_id)))[0];
        if (don) await doiThe(x.shop_id, don.order_id, x.conversation_id, cu => {
          const truoc = String(x.the_truoc || '').split(',').map(s => s.trim()).filter(Boolean);
          let moi = cu.filter(t => !(t.toUpperCase() === 'LEAD ĐẠT' && !truoc.some(y => y.toUpperCase() === 'LEAD ĐẠT')));
          truoc.filter(t => /TIỀM NĂNG/i.test(t)).forEach(t => { if (!moi.some(y => y.toUpperCase() === t.toUpperCase())) moi.push(t); });
          if (!moi.some(t => /TIỀM NĂNG/i.test(t))) moi.push('LEAD TIỀM NĂNG');
          return moi;
        });
      }
      await fetch(`${SB}/rest/v1/khach_khong_tiem_nang_tu_dong?lead_id=eq.${encodeURIComponent(x.lead_id)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ tra_lai_luc: new Date().toISOString(), ghi_chu: 'khách nhắn lại -> trả về tiềm năng' }) });
      act.push({ who: 'Monsieur Claude', act: 'U', tbl: 'saleretail_manual', ref: x.lead_id, label: x.ten, fld: 'Phân loại KH', old_v: 'Không tiềm năng', new_v: 'trả lại (khách nhắn lại sau 7 ngày im)' });
    } catch (e) { dem.loi++; console.log('  trả lại lỗi', x.lead_id, an(e.message)); }
  }

  // ── 2. CHUYỂN "KHÔNG TIỀM NĂNG" ──
  const daTra = new Set(nkCu.filter(r => r.tra_lai_luc).map(r => r.lead_id));
  for (const u of ungVien) {
    const h = await docHoiThoai(u.page, u.conv); await sleep(250);
    if (!h) { dem.khong_doc++; continue; }
    // LẦN LIÊN HỆ CUỐI CỦA SALE = mới nhất giữa tin Pancake và LƯỢT CHĂM SÓC ghi trong app (Sale chăm qua Zalo / gọi điện, nhất là khách Sỉ,
    // Pancake im chưa chắc khách im) -> còn trong 7 ngày thì giữ.
    const csMs = u.csCuoi ? Date.parse(u.csCuoi + 'T23:59:59+07:00') : 0;
    if (!h.saleCuoi || now - Math.max(h.saleCuoi, csMs) < NGAY * 864e5) { dem.giu++; continue; }
    const im = !h.khachSau, chuaSo = !u.coSoApp && !h.coSo;
    if (!im && !chuaSo) { dem.giu++; continue; }
    // khách job đã trả lại vì nhắn lại: chỉ chuyển lại khi lần im mới cũng đủ 7 ngày (đã xét ở trên theo tin Sale cuối)
    const lyDo = im ? 'im ' + NGAY + ' ngày sau tin Sale' : 'chưa SĐT sau ' + NGAY + ' ngày';
    dem.chuyen++; if (im) dem.im++; else dem.chua_so++;
    if (XEM) { console.log(`  ${u.loai} ${u.lead} ${u.ten} · ${lyDo} · tin Sale cuối ${new Date(h.saleCuoi + 7 * 3600e3).toISOString().slice(0, 10)} · khách nhắn cuối ${h.tinKhachCuoi ? new Date(h.tinKhachCuoi + 7 * 3600e3).toISOString().slice(0, 10) : '—'} · SĐT ${u.coSoApp || h.coSo ? 'có' : 'chưa'}`); continue; }
    try {
      const mCu = manCua(u.lead);
      await fetch(`${SB}/rest/v1/saleretail_manual?on_conflict=lead_id`, { method: 'POST', headers: { ...HSB, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ lead_id: u.lead, si_phan_loai: 'Không tiềm năng', updated_by: AI, updated_at: new Date().toISOString() }]) });
      let the = null;
      const d0 = u.don[0];
      if (d0) the = await doiThe(d0.shop, d0.id, u.conv, cu => {
        if (cu.some(t => /CHỐT ĐƠN/i.test(t))) return null;
        const moi = cu.filter(t => !/TIỀM NĂNG/i.test(t));
        if (!moi.some(t => t.toUpperCase() === 'LEAD ĐẠT')) moi.push('LEAD ĐẠT');
        return moi;
      });
      if (!XEM) await fetch(`${SB}/rest/v1/pancake_gan_the_qc?conversation_id=eq.${encodeURIComponent(u.conv)}`, { method: 'PATCH', headers: { ...HSB, Prefer: 'return=minimal' },
        body: JSON.stringify({ nhom: 'dat' }) }).catch(() => null);
      await fetch(`${SB}/rest/v1/khach_khong_tiem_nang_tu_dong?on_conflict=lead_id`, { method: 'POST', headers: { ...HSB, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ lead_id: u.lead, ten: u.ten, conversation_id: u.conv, shop_id: d0 ? d0.shop : null, customer_id: the && the.cid || null, ly_do: lyDo,
          sale_nhan_cuoi: new Date(h.saleCuoi).toISOString(), phan_loai_truoc: mCu.si_phan_loai || 'Tiềm năng, chưa ra đơn',
          the_truoc: the && the.cu ? the.cu.join(', ') : null, the_sau: the && the.moi ? the.moi.join(', ') : null, luc: new Date().toISOString(), tra_lai_luc: null,
          ghi_chu: daTra.has(u.lead) ? 'chuyển lại lần nữa' : null }]) });
      act.push({ who: 'Monsieur Claude', act: 'U', tbl: 'saleretail_manual', ref: u.lead, label: u.ten, fld: 'Phân loại KH', old_v: mCu.si_phan_loai || 'Tiềm năng, chưa ra đơn', new_v: 'Không tiềm năng (' + lyDo + ')' });
    } catch (e) { dem.loi++; console.log('  chuyển lỗi', u.lead, an(e.message)); }
  }
  if (!XEM && act.length) {
    const r = await fetch(`${SB}/rest/v1/activity_log`, { method: 'POST', headers: { ...HSB, Prefer: 'return=minimal' }, body: JSON.stringify(act) });
    if (!r.ok) console.log('  ghi activity_log lỗi', r.status);
  }
  console.log(`Không tiềm năng 7 ngày xong: ${XEM ? 'SẼ' : 'đã'} chuyển ${dem.chuyen} (im ${dem.im} · chưa SĐT ${dem.chua_so}) · giữ ${dem.giu} · trả lại ${dem.tra} · không đọc được hội thoại ${dem.khong_doc} · lỗi ${dem.loi}`);
  if (dem.loi) process.exitCode = 1;
})().catch(e => { console.error(an(e && e.message || e)); process.exit(1); });
