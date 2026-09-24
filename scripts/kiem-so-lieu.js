// ════════ BỘ KIỂM SỐ LIỆU ════════
// Mục đích: mỗi lần sửa logic báo cáo, chạy script này để biết NGAY con số nào nhảy, thay vì phát hiện
// sau khi người dùng mở app và thấy số lạ (đã xảy ra nhiều lần trong tháng 9/2026).
//
// Cách dùng (Windows, dùng node của VS Code):
//   ELECTRON_RUN_AS_NODE=1 "D:/Microsoft VS Code/Code.exe" scripts/kiem-so-lieu.js          -> so với mốc đã lưu
//   ELECTRON_RUN_AS_NODE=1 "D:/Microsoft VS Code/Code.exe" scripts/kiem-so-lieu.js --luu    -> ghi mốc mới
//
// Cách chạy: nạp index.html vào một máy ảo JS (không cần trình duyệt), bơm dữ liệu thật từ Supabase,
// rồi gọi đúng các hàm báo cáo mà app dùng -> số ra giống hệt màn hình.
// Lệch quá NGUONG_PHAN_TRAM hoặc chỉ số tụt về 0 thì in cảnh báo và thoát mã 1 (để chặn commit/CI).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const GOC = path.join(__dirname, '..');
const FILE_MOC = path.join(__dirname, 'moc-so-lieu.json');
const NGUONG_PHAN_TRAM = 5;          // lệch quá 5% coi là bất thường
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co/rest/v1';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnB4ZnZ2anNqcHZia3NxemxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzE0OTgsImV4cCI6MjEwMjg0NzQ5OH0.XGEUvHP1YBhxYKD9Xq1yH2gl95-V9VgaY5HfsAnFb2c';

const H = { apikey: ANON, Authorization: 'Bearer ' + ANON };
const tai = async (bang, truyVan) => {
  let ra = [], tu = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/${bang}?${truyVan}&limit=1000&offset=${tu}`, { headers: H });
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error(bang + ': ' + JSON.stringify(j).slice(0, 150));
    ra = ra.concat(j);
    if (j.length < 1000) return ra;
    tu += 1000;
  }
};

// DOM giả đủ để index.html chạy được phần tính toán (không vẽ gì).
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

async function dongSo() {
  const ctx = moiTruong();
  const [dh, hd, dat, kh, dm, sm, crm, ads] = await Promise.all([
    tai('datahub_orders', 'select=*'),
    tai('kiot_invoices', 'select=*'),
    tai('kiot_orders', 'select=*'),
    tai('kiot_customers', 'select=*'),
    tai('datahub_manual', 'select=*'),
    tai('saleretail_manual', 'select=*'),
    tai('salesi_crm', 'select=*'),
    tai('mkt_spend', 'select=*'),
  ]);
  ctx.__d = { dh, hd, dat, kh, dm, sm, crm, ads };
  vm.runInContext(`
    dhOrders=__d.dh;kiotInvoices=__d.hd;kiotOrders=__d.dat;kiotCustomers=__d.kh;dhManual=__d.dm;
    siCrmRows=__d.crm;
    dhLoaded=kiotLoaded=dhManualLoaded=rptSlManualLoaded=siCrmLoaded=true;
    rptSlManual={};__d.sm.forEach(r=>rptSlManual[r.lead_id]=r);
    window.allRowsRaw=[];allRows=[];
  `, ctx);
  // dựng lại mkt_spend đúng shape COL.* mà app dùng
  vm.runInContext(`(()=>{
    COL.AD_NAME=20;COL.ADSET_NAME2=21;
    const dong=r=>{const a=[];a[COL.CAMPAIGN]=r.campaign_name||'';a[COL.AD_ID]=r.ad_id||'';
      a[COL.DATE]=String(r.ad_date||'').slice(0,10);a[COL.AD_NAME]=r.ad_name||'';
      a[COL.REACH]=r.reach||0;a[COL.IMPRESSIONS]=r.impressions||0;a[COL.SPEND]=r.spend||0;
      a[COL.MESSAGES]=r.messages||0;a[COL.CTR]=r.ctr||0;a[COL.CPC]=r.cpc||0;a[COL.COMMENTS]=r.comments||0;return a;};
    window.allRowsRaw=__d.ads.map(dong);
    const g={};__d.ads.forEach(r=>{const k=(r.campaign_name||'')+'|'+String(r.ad_date||'').slice(0,10);
      g[k]=g[k]||{campaign_name:r.campaign_name,ad_date:r.ad_date,spend:0,messages:0,reach:0,impressions:0,comments:0,ctr:0,cpc:0,n:0};
      const x=g[k];x.spend+=Number(r.spend||0);x.messages+=Number(r.messages||0);x.n++;});
    allRows=Object.values(g).map(x=>dong(x));
    mktLoaded=true;
  })()`, ctx);

  const t = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const dauThang = t.slice(0, 8) + '01';
  const js = `(()=>{
    const ra={};
    const dat=(k,v)=>{ra[k]=Math.round(v)};
    [['thangNay','${dauThang}','${t}'],['tatCa','','']].forEach(ky=>{
      ['Lẻ','Sỉ'].forEach(loai=>{
        modRanges.saleretail={from:ky[1],to:ky[2]};modRanges.salesi={from:ky[1],to:ky[2]};
        window._rptSlType=loai;window._rptSlMod=null;window._kiotOrdByCode=null;rptSlXoaCache();
        const p=rptSlPeriod();
        const ten=(loai==='Lẻ'?'le':'si')+'_'+ky[0];
        // Doanh thu phải cộng cả đơn mua lại (>1 tháng) — bảng trong app hiện revenue+repeatRevenue
        dat(ten+'_doanhThu',p.reduce((a,r)=>a+r.revenue+(r.repeatRevenue||0),0));
        dat(ten+'_khach',p.length);
        dat(ten+'_chot',p.filter(r=>r.isChot).length);
        dat(ten+'_boPhieuTam',p.reduce((a,r)=>a+(r.staleOrds||[]).reduce((x,o)=>x+Number(o.total||0),0),0));
      });
    });
    modRanges.mkt={from:'${dauThang}',to:'${t}'};rptBrands.mkt='';
    const d=rptMktData();
    dat('mkt_chiPhi',d.kpi.totalSpend);dat('mkt_mess',d.kpi.totalMess);
    dat('mkt_doanhSo',d.rev);dat('mkt_don',d.don);
    dat('mkt_le',d.sale.filter(x=>x.loai==='Lẻ').reduce((a,x)=>a+x.rev,0));
    dat('mkt_si',d.sale.filter(x=>x.loai==='Sỉ').reduce((a,x)=>a+x.rev,0));
    dat('nguon_donPancake',dhOrders.length);dat('nguon_donKiot',kiotOrders.length);
    dat('nguon_khachKiot',kiotCustomers.length);dat('nguon_nhapTay',dhManual.length);
    return JSON.stringify(ra);
  })()`;
  return JSON.parse(vm.runInContext(js, ctx));
}

const vnd = n => Number(n || 0).toLocaleString('vi');

(async () => {
  const so = await dongSo();
  const luu = process.argv.includes('--luu');
  if (luu || !fs.existsSync(FILE_MOC)) {
    fs.writeFileSync(FILE_MOC, JSON.stringify({ luc: new Date().toISOString(), so }, null, 1));
    console.log('Đã lưu mốc số liệu mới:');
    Object.entries(so).forEach(([k, v]) => console.log('  ', k.padEnd(22), vnd(v)));
    return;
  }
  const moc = JSON.parse(fs.readFileSync(FILE_MOC, 'utf8'));
  console.log('So với mốc lưu lúc', String(moc.luc).slice(0, 16).replace('T', ' '), '\n');
  const canhBao = [];
  Object.keys(so).forEach(k => {
    const cu = Number(moc.so[k] || 0), moi = Number(so[k] || 0);
    const lech = cu ? (moi - cu) / cu * 100 : (moi ? 100 : 0);
    const nang = (cu > 0 && moi === 0) || Math.abs(lech) > NGUONG_PHAN_TRAM;
    const dau = nang ? '  !!' : '  ok';
    console.log(dau, k.padEnd(22), vnd(cu).padStart(16), '->', vnd(moi).padStart(16),
      (cu ? (lech >= 0 ? '+' : '') + lech.toFixed(1) + '%' : ''));
    if (nang) canhBao.push(`${k}: ${vnd(cu)} -> ${vnd(moi)} (${lech.toFixed(1)}%)`);
  });
  if (canhBao.length) {
    console.log('\nCÓ ' + canhBao.length + ' CHỈ SỐ NHẢY BẤT THƯỜNG:');
    canhBao.forEach(x => console.log('   -', x));
    console.log('\nKiểm lại thay đổi vừa rồi. Nếu số mới là ĐÚNG thì chạy lại với --luu để chốt mốc mới.');
    process.exit(1);
  }
  console.log('\nTất cả chỉ số nằm trong ngưỡng ' + NGUONG_PHAN_TRAM + '%. An toàn.');
})().catch(e => { console.error('LỖI:', e.message); process.exit(2); });
