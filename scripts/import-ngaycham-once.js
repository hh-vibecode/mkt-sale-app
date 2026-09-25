// MIGRATION MỘT LẦN (17/9/2026): bê NGÀY CHĂM SÓC (và Nội dung trao đổi nếu có) Sale đã ghi trong
// tab CRM Lẻ của Google Sheet sang saleretail_manual -> hiện lên cột "Ngày chăm sóc" của tab CRM.
// Chạy thử: node scripts/import-ngaycham-once.js | Ghi thật: node scripts/import-ngaycham-once.js --go
//
// Khớp khách theo thứ tự: Lead ID (số đơn Pancake) -> Mã KH -> SĐT. Khách nào đã có ngày chăm sóc
// trong app thì KHÔNG ghi đè (coi như Sale đã cập nhật mới hơn).
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
const SH2BR={CT:'CT',SD:'Shidai',NB:'TTV',HT:'HT'};
function shKey(id){const s=(id||'').trim().toUpperCase();
 let m=/^ONL([A-Z]{2})[A-Z]\d+\.(\d+)$/.exec(s);if(!m)m=/^ONL([A-Z]{2})(\d+)$/.exec(s);
 return m&&SH2BR[m[1]]?SH2BR[m[1]]+'#'+Number(m[2]):null;}
const SHOP={1022031789:'CT',1943057093:'CT2',100965386:'CT3',1021966905:'CT4',
 1943096391:'HT',715061393:'HT2',408077426:'HT3',1943052948:'SD',408040224:'TTV',1329071685:'HD'};
const leadIdOf=o=>'L-'+(SHOP[o.shop_id]||((o.brand||'XX')+String(o.shop_id||'').slice(-4)))+'-'+String(o.system_id||'').padStart(4,'0');
const isQual=o=>{const t=(o.customer_tags||'').toUpperCase();return t.includes('CHỐT ĐƠN')||t.includes('BÀN GIAO')||t.includes('TIỀM NĂNG');};
const kh=n=>{const m=/KH\s*0*(\d{3,7})/i.exec(n||'');return m?'KH'+String(m[1]).padStart(6,'0'):null;};
(async()=>{
 const DRY=process.argv[2]!=='--go';
 const [dh,smn,dmn]=await Promise.all([
  all('datahub_orders','select=shop_id,brand,system_id,order_date,customer_name,phone,internal_note,customer_tags'),
  all('saleretail_manual','select=lead_id,kiot_code,care_date,content'),
  all('datahub_manual','select=id,customer_name,phone,kiot_code'),
 ]);
 const cur={};smn.forEach(r=>cur[r.lead_id]=r);

 // gom khách đúng như app + 3 chỉ mục tra cứu
 const byKey={};
 dh.filter(o=>!(o.customer_tags||'').toUpperCase().includes('KH SỈ')).forEach(o=>{
  const p=p9(o.phone);const k=p?('P'+p):('S'+o.shop_id+'|'+(o.customer_name||'').trim().toLowerCase());
  (byKey[k]=byKey[k]||[]).push(o);});
 Object.keys(byKey).forEach(k=>{if(!byKey[k].some(isQual))delete byKey[k];});
 const meta={},byOrd={},byPh={},byKH={};
 Object.values(byKey).forEach(list=>{
  list.sort((a,b)=>String(a.order_date).localeCompare(String(b.order_date)));
  const lid=leadIdOf(list[0]);
  meta[lid]={name:list.map(o=>o.customer_name).filter(Boolean).pop()||''};
  list.forEach(o=>{const k=o.brand+'#'+Number(o.system_id);if(!byOrd[k])byOrd[k]=lid;
    const c=kh(o.internal_note);if(c&&!byKH[c])byKH[c]=lid;});
  const p=p9(list.map(o=>o.phone).filter(Boolean).pop()||'');if(p&&!byPh[p])byPh[p]=lid;
 });
 smn.forEach(r=>{if(r.kiot_code&&!byKH[r.kiot_code])byKH[r.kiot_code]=r.lead_id;});
 // khách nhập tay
 dmn.forEach(r=>{const lid='M-'+String(r.id).padStart(4,'0');meta[lid]={name:r.customer_name};
  const p=p9(r.phone);if(p&&!byPh[p])byPh[p]=lid;
  if(r.kiot_code&&!byKH[r.kiot_code])byKH[r.kiot_code]=lid;});

 const t=await(await fetch(`https://docs.google.com/spreadsheets/d/e/${LE}/pub?gid=768026359&single=true&output=csv`)).text();
 const rows=csv(t).slice(1).filter(r=>r.some(x=>x&&x.trim()));
 const best={};let noMatch=0;
 rows.forEach(r=>{
  const date=D(r[0]);if(!date)return;
  const code=(r[17]||'').trim().toUpperCase();
  const k=shKey(r[1]);
  const lid=(k&&byOrd[k])||(code&&byKH[code])||byPh[p9(r[7])];
  if(!lid){noMatch++;return;}
  const note=(r[10]||'').trim();
  // 1 khách nhiều dòng chăm sóc -> giữ ngày MỚI NHẤT
  if(!best[lid]||date>best[lid].date)best[lid]={date,note,name:r[6]};
 });
 const plan=[],skip=[];
 Object.entries(best).forEach(([lid,b])=>{
  const c=cur[lid]||{};
  if(c.care_date){skip.push([lid,b.name,b.date,'đã có ngày '+c.care_date]);return;}
  const row={lead_id:lid,care_date:b.date};
  if(b.note&&!c.content)row.content=b.note;
  plan.push({...row,name:(meta[lid]||{}).name||b.name});
 });
 console.log('Sheet CRM Lẻ: '+rows.length+' dòng | khớp được khách: '+Object.keys(best).length+' | không khớp: '+noMatch);
 console.log('SẼ ĐIỀN ngày chăm sóc: '+plan.length+' khách | bỏ qua '+skip.length);
 console.log('   trong đó kèm Nội dung trao đổi: '+plan.filter(p=>p.content).length);
 plan.slice(0,15).forEach(p=>console.log('   '+p.lead_id.padEnd(12)+String(p.name).slice(0,22).padEnd(23)+p.care_date+(p.content?'  | '+p.content.replace(/\n/g,' ').slice(0,40):'')));
 if(plan.length>15)console.log('   ... và '+(plan.length-15)+' khách nữa');
 skip.slice(0,5).forEach(s=>console.log('   BỎ '+s[0]+' '+s[1]+' -> '+s[3]));
 if(DRY){console.log('\n(chạy thử — thêm --go để ghi thật)');return;}
 // PostgREST ghi hàng loạt đòi MỌI object cùng bộ khoá -> luôn gửi đủ cả content.
 // Dòng không có nội dung mới thì gửi lại nội dung đang có (null nếu chưa có) để không xoá mất.
 const body=plan.map(p=>({lead_id:p.lead_id,care_date:p.care_date,
   content:p.content||((cur[p.lead_id]||{}).content||null),
   updated_by:'import-sheet-ngaycham',updated_at:new Date().toISOString()}));
 const res=await fetch(U+'/saleretail_manual?on_conflict=lead_id',{method:'POST',
  headers:{...H,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)});
 console.log('\nGHI THẬT:',res.status,(await res.text()).slice(0,120));
})();
