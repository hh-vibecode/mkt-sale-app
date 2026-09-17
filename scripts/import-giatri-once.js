// MIGRATION MỘT LẦN (17/9/2026): bê GIÁ TRỊ TIỀM NĂNG Sale đã ước lượng trong tab CRM Lẻ của
// Google Sheet (cột 11 "Giá trị tiềm năng") sang saleretail_manual.potential_value.
// Chạy thử: node scripts/import-giatri-once.js | Ghi thật: node scripts/import-giatri-once.js --go
//
// Chỉ điền cho khách CHƯA CHỐT (đã chốt thì có doanh thu thật, giá trị tiềm năng vô nghĩa)
// và CHƯA có giá trị. Sheet ghi nhiều dòng chăm sóc cho cùng 1 khách -> lấy dòng MỚI NHẤT.
const LE='2PACX-1vQraTrk4Ha7Sy6G3FwCUlubRbGtKQ4lkqHHDLimn3rmC29DmxFzpV5Ny7Ed57KgSBl3_BTXUj4HahIb';
const U='https://bcrpxfvvjsjpvbksqzls.supabase.co/rest/v1';
const AK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnB4ZnZ2anNqcHZia3NxemxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzE0OTgsImV4cCI6MjEwMjg0NzQ5OH0.XGEUvHP1YBhxYKD9Xq1yH2gl95-V9VgaY5HfsAnFb2c';
const H={apikey:AK,Authorization:'Bearer '+AK};
const all=async(t,q)=>{let o=[],off=0;while(true){const d=await(await fetch(`${U}/${t}?${q}&limit=1000&offset=${off}`,{headers:H})).json();o=o.concat(d);if(d.length<1000)break;off+=1000;}return o;};
const csv=t=>{const r=[];let f='',row=[],q=false;for(let i=0;i<t.length;i++){const c=t[i];
 if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
 else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);r.push(row);row=[];f='';}else if(c!=='\r')f+=c;}
 if(f||row.length){row.push(f);r.push(row);}return r;};
const N=s=>Number(String(s||'').replace(/[^\d]/g,''))||0;
const D=s=>{const m=/(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s||'');return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';};
const p9=s=>{const d=(s||'').replace(/\D/g,'');return d.length>=9?d.slice(-9):'';};
const f=n=>Math.round(n).toLocaleString('vi-VN')+'đ';
const SH2BR={CT:'CT',SD:'Shidai',NB:'TTV',HT:'HT'};
function shKey(id){const s=(id||'').trim().toUpperCase();
 let m=/^ONL([A-Z]{2})[A-Z]\d+\.(\d+)$/.exec(s);if(!m)m=/^ONL([A-Z]{2})(\d+)$/.exec(s);
 return m&&SH2BR[m[1]]?SH2BR[m[1]]+'#'+Number(m[2]):null;}
const SHOP={1022031789:'CT',1943057093:'CT2',100965386:'CT3',1021966905:'CT4',
 1943096391:'HT',715061393:'HT2',408077426:'HT3',1943052948:'SD',408040224:'TTV',1329071685:'HD'};
const leadIdOf=o=>'L-'+(SHOP[o.shop_id]||((o.brand||'XX')+String(o.shop_id||'').slice(-4)))+'-'+String(o.system_id||'').padStart(4,'0');
const isChot=o=>(o.customer_tags||'').toUpperCase().includes('CHỐT ĐƠN');
const isQual=o=>{const t=(o.customer_tags||'').toUpperCase();return t.includes('CHỐT ĐƠN')||t.includes('BÀN GIAO')||t.includes('TIỀM NĂNG');};
(async()=>{
 const DRY=process.argv[2]!=='--go';
 const [dh,smn,dmn]=await Promise.all([
  all('datahub_orders','select=shop_id,brand,system_id,order_date,customer_name,phone,customer_tags'),
  all('saleretail_manual','select=lead_id,potential_value'),
  all('datahub_manual','select=id,customer_name,phone,kiot_code'),
 ]);
 const pvByLead={};smn.forEach(r=>{if(r.potential_value)pvByLead[r.lead_id]=Number(r.potential_value);});

 // Gom khách đúng như app
 const byKey={};
 dh.filter(o=>!(o.customer_tags||'').toUpperCase().includes('KH SỈ')).forEach(o=>{
  const p=p9(o.phone);const k=p?('P'+p):('S'+o.shop_id+'|'+(o.customer_name||'').trim().toLowerCase());
  (byKey[k]=byKey[k]||[]).push(o);});
 Object.keys(byKey).forEach(k=>{if(!byKey[k].some(isQual))delete byKey[k];});
 const meta={},byOrd={},byPh={};
 Object.values(byKey).forEach(list=>{
  list.sort((a,b)=>String(a.order_date).localeCompare(String(b.order_date)));
  const lid=leadIdOf(list[0]);
  meta[lid]={name:list.map(o=>o.customer_name).filter(Boolean).pop()||'',chot:list.some(isChot)};
  list.forEach(o=>{const k=o.brand+'#'+Number(o.system_id);if(!byOrd[k])byOrd[k]=lid;});
  const p=p9(list.map(o=>o.phone).filter(Boolean).pop()||'');if(p&&!byPh[p])byPh[p]=lid;
 });
 // Khách nhập tay cũng có Lead ID riêng (M-xxxx)
 const mByPh={},mByName={};
 dmn.forEach(r=>{const lid='M-'+String(r.id).padStart(4,'0');
  const p=p9(r.phone);if(p)mByPh[p]=lid;
  mByName[(r.customer_name||'').trim().toLowerCase()]=lid;
  meta[lid]={name:r.customer_name,chot:!!r.kiot_code};});  // có Mã KH = đã ra hoá đơn -> không còn là tiềm năng

 const t=await(await fetch(`https://docs.google.com/spreadsheets/d/e/${LE}/pub?gid=768026359&single=true&output=csv`)).text();
 const rows=csv(t).slice(1).filter(r=>r.some(x=>x&&x.trim()));
 // cùng 1 khách có nhiều dòng chăm sóc -> giữ dòng MỚI NHẤT có giá trị
 const best={};
 rows.forEach(r=>{
  const v=N(r[11]);if(!v)return;
  const k=shKey(r[1]);const ph=p9(r[7]);
  const lid=(k&&byOrd[k])||byPh[ph]||mByPh[ph]||mByName[(r[6]||'').trim().toLowerCase()];
  if(!lid)return;
  const d=D(r[0]);
  if(!best[lid]||d>best[lid].d)best[lid]={d,v,name:r[6]};
 });
 const plan=[],skip=[];
 Object.entries(best).forEach(([lid,b])=>{
  if(meta[lid]&&meta[lid].chot){skip.push([lid,b.name,b.v,'đã chốt -> có doanh thu thật']);return;}
  if(pvByLead[lid]){skip.push([lid,b.name,b.v,'đã có giá trị '+f(pvByLead[lid])]);return;}
  plan.push({lead_id:lid,potential_value:b.v,name:(meta[lid]||{}).name||b.name,date:b.d});
 });
 console.log('Sheet CRM Lẻ -> điền Giá trị tiềm năng: '+plan.length+' khách | bỏ qua '+skip.length);
 plan.sort((a,b)=>b.potential_value-a.potential_value).forEach(p=>
  console.log('  '+p.lead_id.padEnd(12)+String(p.name).slice(0,24).padEnd(25)+f(p.potential_value).padStart(15)+'   ('+p.date+')'));
 console.log('  => tổng giá trị tiềm năng: '+f(plan.reduce((s,p)=>s+p.potential_value,0)));
 if(skip.length){console.log('\nBỎ QUA:');skip.slice(0,12).forEach(s=>console.log('  '+s[0]+' '+String(s[1]).slice(0,22)+' '+f(s[2])+' -> '+s[3]));}
 if(DRY){console.log('\n(chạy thử — thêm --go để ghi thật)');return;}
 const body=plan.map(p=>({lead_id:p.lead_id,potential_value:p.potential_value,updated_by:'import-sheet-gttn',updated_at:new Date().toISOString()}));
 const res=await fetch(U+'/saleretail_manual?on_conflict=lead_id',{method:'POST',
  headers:{...H,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)});
 console.log('\nGHI THẬT:',res.status,(await res.text()).slice(0,120));
})();
