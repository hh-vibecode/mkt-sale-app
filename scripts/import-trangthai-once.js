// MIGRATION MỘT LẦN (17/9/2026): bê TRẠNG THÁI (và Nhóm nguyên nhân mất lead) Sale đã chọn trong tab
// CRM Lẻ của Google Sheet sang saleretail_manual.
// Chạy thử: node scripts/import-trangthai-once.js | Ghi thật: node scripts/import-trangthai-once.js --go
//
// KHÔNG ghi trạng thái cho khách ĐÃ CHỐT: app tự khoá cứng "Chốt đơn" theo thẻ Pancake, ghi thêm vào
// cột status chỉ gây lệch khi thẻ đổi. Khách nào đã có trạng thái trong app thì không ghi đè.
const LE='2PACX-1vQraTrk4Ha7Sy6G3FwCUlubRbGtKQ4lkqHHDLimn3rmC29DmxFzpV5Ny7Ed57KgSBl3_BTXUj4HahIb';
const U='https://bcrpxfvvjsjpvbksqzls.supabase.co/rest/v1';
const AK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnB4ZnZ2anNqcHZia3NxemxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzE0OTgsImV4cCI6MjEwMjg0NzQ5OH0.XGEUvHP1YBhxYKD9Xq1yH2gl95-V9VgaY5HfsAnFb2c';
const H={apikey:AK,Authorization:'Bearer '+AK,'Content-Type':'application/json'};
const all=async(t,q)=>{let o=[],off=0;while(true){const d=await(await fetch(`${U}/${t}?${q}&limit=1000&offset=${off}`,{headers:H})).json();o=o.concat(d);if(d.length<1000)break;off+=1000;}return o;};
const csv=t=>{const r=[];let f='',row=[],q=false;for(let i=0;i<t.length;i++){const c=t[i];
 if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
 else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);r.push(row);row=[];f='';}else if(c!=='\r')f+=c;}
 if(f||row.length){row.push(f);r.push(row);}return r;};
const D=s=>{const m=/(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s||'');return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';};
const p9=s=>{const d=(s||'').replace(/\D/g,'');return d.length>=9?d.slice(-9):'';};
const SHOP={1022031789:'CT',1943057093:'CT2',100965386:'CT3',1021966905:'CT4',
 1943096391:'HT',715061393:'HT2',408077426:'HT3',1943052948:'SD',408040224:'TTV',1329071685:'CTT'};
const leadIdOf=o=>'L-'+(SHOP[o.shop_id]||((o.brand||'XX')+String(o.shop_id||'').slice(-4)))+'-'+String(o.system_id||'').padStart(4,'0');
const isChotTag=o=>(o.customer_tags||'').toUpperCase().includes('CHỐT ĐƠN');
const isQual=o=>{const t=(o.customer_tags||'').toUpperCase();return t.includes('CHỐT ĐƠN')||t.includes('BÀN GIAO')||t.includes('TIỀM NĂNG');};
const kh=n=>{const m=/KH\s*0*(\d{3,7})/i.exec(n||'');return m?'KH'+String(m[1]).padStart(6,'0'):null;};
// Sheet ghi lẫn hoa/thường ("Mất Lead") -> chuẩn về đúng bộ lựa chọn của app.
const NORM={'mất lead':'Mất lead','đang chăm sóc':'Đang chăm sóc','chăm sóc dài hạn':'Chăm sóc dài hạn'};
(async()=>{
 const DRY=process.argv[2]!=='--go';
 const [dh,smn,dmn]=await Promise.all([
  all('datahub_orders','select=shop_id,brand,system_id,order_date,customer_name,phone,internal_note,customer_tags'),
  all('saleretail_manual','select=lead_id,kiot_code,status,lost_group'),
  all('datahub_manual','select=id,customer_name,phone,kiot_code'),
 ]);
 const cur={};smn.forEach(r=>cur[r.lead_id]=r);

 const byKey={};
 dh.filter(o=>!(o.customer_tags||'').toUpperCase().includes('KH SỈ')).forEach(o=>{
  const p=p9(o.phone);const k=p?('P'+p):('S'+o.shop_id+'|'+(o.customer_name||'').trim().toLowerCase());
  (byKey[k]=byKey[k]||[]).push(o);});
 Object.keys(byKey).forEach(k=>{if(!byKey[k].some(isQual))delete byKey[k];});
 const meta={},byOrd={},byPh={},byKH={};
 Object.values(byKey).forEach(list=>{
  list.sort((a,b)=>String(a.order_date).localeCompare(String(b.order_date)));
  const lid=leadIdOf(list[0]);
  meta[lid]={name:list.map(o=>o.customer_name).filter(Boolean).pop()||'',chot:list.some(isChotTag)};
  list.forEach(o=>{const k=o.brand+'#'+Number(o.system_id);if(!byOrd[k])byOrd[k]=lid;
    const c=kh(o.internal_note);if(c&&!byKH[c])byKH[c]=lid;});
  const p=p9(list.map(o=>o.phone).filter(Boolean).pop()||'');if(p&&!byPh[p])byPh[p]=lid;
 });
 smn.forEach(r=>{if(r.kiot_code&&!byKH[r.kiot_code])byKH[r.kiot_code]=r.lead_id;});
 // khách nhập tay: có Mã KH nghĩa là đã ra hoá đơn -> app coi là đã chốt
 dmn.forEach(r=>{const lid='M-'+String(r.id).padStart(4,'0');
  meta[lid]={name:r.customer_name,chot:!!r.kiot_code};
  const p=p9(r.phone);if(p&&!byPh[p])byPh[p]=lid;
  if(r.kiot_code&&!byKH[r.kiot_code])byKH[r.kiot_code]=lid;});

 const t=await(await fetch(`https://docs.google.com/spreadsheets/d/e/${LE}/pub?gid=768026359&single=true&output=csv`)).text();
 const rows=csv(t).slice(1).filter(r=>r.some(x=>x&&x.trim()));
 const best={};const stats={};
 rows.forEach(r=>{
  const raw=(r[12]||'').trim();if(!raw)return;
  stats[raw]=(stats[raw]||0)+1;
  const st=NORM[raw.toLowerCase()];if(!st)return;            // "Chốt đơn" bỏ qua: app tự khoá
  const code=(r[17]||'').trim().toUpperCase();
  const k=(r[1]||'').trim().toUpperCase();
  const mm=/^ONL([A-Z]{2})(\d+)$/.exec(k);
  const SH2BR={CT:'CT',SD:'Shidai',NB:'TTV',HT:'HT'};
  const ordKey=mm&&SH2BR[mm[1]]?SH2BR[mm[1]]+'#'+Number(mm[2]):null;
  const lid=(ordKey&&byOrd[ordKey])||(code&&byKH[code])||byPh[p9(r[7])];
  if(!lid)return;
  const d=D(r[0]);
  if(!best[lid]||d>best[lid].d)best[lid]={d,st,lost:(r[13]||'').trim(),name:r[6]};
 });
 console.log('Trạng thái có trong sheet:',JSON.stringify(stats));
 const plan=[],skip=[];
 Object.entries(best).forEach(([lid,b])=>{
  const m=meta[lid]||{};
  if(m.chot){skip.push([lid,b.name,b.st,'app đã khoá cứng Chốt đơn']);return;}
  if((cur[lid]||{}).status){skip.push([lid,b.name,b.st,'đã có trạng thái '+cur[lid].status]);return;}
  plan.push({lead_id:lid,status:b.st,lost_group:b.lost||null,name:m.name||b.name});
 });
 console.log('\nSẼ ĐIỀN trạng thái: '+plan.length+' khách | bỏ qua '+skip.length);
 plan.forEach(p=>console.log('   '+p.lead_id.padEnd(12)+String(p.name).slice(0,22).padEnd(23)+p.status.padEnd(18)+(p.lost_group||'')));
 const bySt={};plan.forEach(p=>bySt[p.status]=(bySt[p.status]||0)+1);
 console.log('   => '+JSON.stringify(bySt));
 if(DRY){console.log('\n(chạy thử — thêm --go để ghi thật)');return;}
 const body=plan.map(p=>({lead_id:p.lead_id,status:p.status,lost_group:p.lost_group,
   updated_by:'import-sheet-trangthai',updated_at:new Date().toISOString()}));
 const res=await fetch(U+'/saleretail_manual?on_conflict=lead_id',{method:'POST',
  headers:{...H,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)});
 console.log('\nGHI THẬT:',res.status,(await res.text()).slice(0,120));
})();
