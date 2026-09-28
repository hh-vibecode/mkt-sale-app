// NẠP APP (index.html) VÀO MÁY ẢO JS + BƠM DỮ LIỆU THẬT -- để job dùng ĐÚNG hàm dựng Master của app
// (gộp khách, Mã KH, đơn Kiot...) thay vì viết lại 1 bản riêng dễ lệch. Cùng cách với scripts/kiem-so-lieu.js.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const GOC = path.join(__dirname, '..', '..');
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co/rest/v1';
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (() => {
  try { return (fs.readFileSync(path.join(GOC, 'supabase-keys.local.txt'), 'utf8')
    .match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1]; } catch (e) { return ''; }
})();
if (!KHOA) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KHOA, Authorization: 'Bearer ' + KHOA };

const tai = async (bang, truyVan) => {
  let ra = [], tu = 0;
  for (;;) {
    let j = null;
    for (let i = 0; i < 4 && !Array.isArray(j); i++) {
      try { j = await (await fetch(`${SUPABASE_URL}/${bang}?${truyVan}&limit=1000&offset=${tu}`, { headers: H })).json(); }
      catch (e) { j = null; }
      if (!Array.isArray(j)) await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
    if (!Array.isArray(j)) throw new Error(bang + ': ' + JSON.stringify(j).slice(0, 150));
    ra = ra.concat(j);
    if (j.length < 1000) return ra;
    tu += 1000;
  }
};

function moiTruong() {
  const el = () => ({
    style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    innerHTML: '', value: '', dataset: {}, appendChild() {}, setAttribute() {}, getAttribute: () => null,
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], focus() {}, blur() {}, click() {}, remove() {},
  });
  const kho = {};
  const ctx = {
    document: { getElementById: i => kho[i] || (kho[i] = el()), querySelector: () => null, querySelectorAll: () => [],
      createElement: () => el(), addEventListener() {}, body: el(), documentElement: el() },
    console: { log() {}, warn() {}, error() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    alert() {}, confirm: () => true, prompt: () => null,
    Chart: function () { return { destroy() {} }; },
    location: { pathname: '/' }, navigator: {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    addEventListener() {}, removeEventListener() {},
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(GOC, 'index.html'), 'utf8');
  const code = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i.exec(src)[1];
  new vm.Script(code).runInContext(ctx);
  return ctx;
}

// Trả về máy ảo đã nạp đủ dữ liệu báo cáo Sale (không có số MKT).
async function napApp() {
  const ctx = moiTruong();
  const [dh, hd, dat, kh, dm, sm, crm, giu, dmuc] = await Promise.all([
    tai('datahub_orders', 'select=*'),
    tai('kiot_invoices', 'select=*'),
    tai('kiot_orders', 'select=*'),
    tai('kiot_customers', 'select=*'),
    tai('datahub_manual', 'select=*'),
    tai('saleretail_manual', 'select=*'),
    tai('salesi_crm', 'select=*'),
    tai('kiot_don_giu_tinh', 'select=code'),
    tai('danh_muc', 'select=*&order=loai,thu_tu,id'),
  ]);
  ctx.__d = { dh, hd, dat, kh, dm, sm, crm, giu, dmuc };
  vm.runInContext(`
    dhOrders=__d.dh;kiotInvoices=__d.hd;kiotOrders=__d.dat;kiotCustomers=__d.kh;dhManual=__d.dm;
    siCrmRows=__d.crm;
    kiotGiuTinh=new Set((__d.giu||[]).map(x=>String(x.code).toUpperCase()));
    dhLoaded=kiotLoaded=dhManualLoaded=rptSlManualLoaded=siCrmLoaded=true;
    rptSlManual={};__d.sm.forEach(r=>rptSlManual[r.lead_id]=r);
    _dm=__d.dmuc;_dmLuc=Date.now();
    Object.keys(DM_LOAI).forEach(l=>{if(!DM_LOAI[l].ds)return;const rows=_dm.filter(x=>x.loai===l);if(!rows.length)return;
      const a=DM_LOAI[l].ds();a.length=0;rows.forEach(x=>a.push(x.gia_tri));});
    window.allRowsRaw=[];allRows=[];
  `, ctx);
  return ctx;
}

// Master của 1 loại khách (Sỉ / Lẻ), toàn thời gian.
function masterCua(ctx, loai) {
  ctx.__loai = loai;
  return vm.runInContext(`(()=>{
    modRanges.saleretail={from:'',to:''};modRanges.salesi={from:'',to:''};
    window._rptSlType=__loai;window._rptSlMod=null;window._kiotOrdByCode=null;rptSlXoaCache();
    return rptSlBuildMaster();
  })()`, ctx);
}

module.exports = { napApp, masterCua, tai, SUPABASE_URL, H };
