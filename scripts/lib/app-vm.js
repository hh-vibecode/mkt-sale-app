// NẠP index.html VÀO MÁY ẢO JS (không trình duyệt) + BƠM DỮ LIỆU THẬT — để job chạy ĐÚNG hàm tính của app (số khớp app).
// Cùng cách với scripts/kiem-so-lieu.js (bản đó giữ nguyên để CI không đổi). Dùng: scripts/bao-cao-ngay.js.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { fetchLai } = require('./fetch-lai.js');

const GOC = path.join(__dirname, '..', '..');
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const KHOA = process.env.SUPABASE_SERVICE_ROLE_KEY || (() => {
  try { return (fs.readFileSync(path.join(GOC, 'supabase-keys.local.txt'), 'utf8')
    .match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/) || [])[1]; } catch (e) { return ''; }
})();
const H = { apikey: KHOA, Authorization: 'Bearer ' + KHOA };

// đọc 1 bảng CÓ PHÂN TRANG (1000 dòng / lần)
async function tai(bang, truyVan) {
  let ra = [], tu = 0;
  for (;;) {
    const r = await fetchLai(`${SUPABASE_URL}/rest/v1/${bang}?${truyVan}&limit=1000&offset=${tu}`, { headers: H }, { ten: 'app-vm' });
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error(bang + ': ' + JSON.stringify(j).slice(0, 150));
    ra = ra.concat(j);
    if (j.length < 1000) return ra;
    tu += 1000;
  }
}

// DOM giả đủ để index.html chạy phần tính toán (không vẽ gì)
function moiTruong(fileHtml) {
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
  const src = fs.readFileSync(fileHtml || path.join(GOC, 'index.html'), 'utf8');
  const code = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i.exec(src)[1];
  new vm.Script(code).runInContext(ctx);
  return ctx;
}

// Tải mọi bảng báo cáo cần + bơm vào máy ảo; sbFetchAll trong app đọc lại từ bộ nhớ (mkt_spend...) thay vì gọi mạng.
async function napApp(fileHtml) {
  const [dh, hd, dat, kh, dm, sm, crm, ads, giu, ns] = await Promise.all([
    tai('datahub_orders', 'select=*'), tai('kiot_invoices', 'select=*'), tai('kiot_orders', 'select=*'),
    tai('kiot_customers', 'select=*'), tai('datahub_manual', 'select=*'), tai('saleretail_manual', 'select=*'),
    tai('salesi_crm', 'select=*'), tai('mkt_spend', 'select=ad_id,ad_date,campaign_name,adset_name,ad_name,reach,impressions,spend,messages,ctr,cpc,comments'),
    tai('kiot_don_giu_tinh', 'select=code'), tai('sale_nhan_su', 'select=*'),
  ]);
  const ctx = moiTruong(fileHtml);
  ctx.__d = { dh, hd, dat, kh, dm, sm, crm, ads, giu, ns };
  await vm.runInContext(`(async()=>{
    dhOrders=__d.dh;kiotInvoices=__d.hd;kiotOrders=__d.dat;kiotCustomers=__d.kh;dhManual=__d.dm;siCrmRows=__d.crm;
    kiotGiuTinh=new Set((__d.giu||[]).map(x=>String(x.code).toUpperCase()));
    dhLoaded=kiotLoaded=dhManualLoaded=rptSlManualLoaded=siCrmLoaded=true;
    rptSlManual={};__d.sm.forEach(r=>rptSlManual[r.lead_id]=r);saleNhanSu=__d.ns;
    const bang={mkt_spend:__d.ads,mkt_ads_trang_thai:[]};
    sbFetchAll=async t=>bang[t]||[];
    mktLoaded=false;await mktLoadSpend(true);
  })()`, ctx);
  return ctx;
}

module.exports = { SUPABASE_URL, KHOA, H, tai, moiTruong, napApp, GOC };
