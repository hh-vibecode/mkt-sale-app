// MIGRATION MỘT LẦN (17/9/2026): fill NỐT 5 cột Sale phải điền tay (các cột đỏ trong tab CRM) từ tab
// CRM Lẻ của Google Sheet, để Sale không phải gõ lại:
//   Ngày chăm sóc · Nội dung trao đổi · Giá trị tiềm năng · Trạng thái · Nhóm nguyên nhân mất lead
// Chạy thử: node scripts/import-crm-fields-once.js | Ghi thật: node scripts/import-crm-fields-once.js --go
//
// NGUYÊN TẮC:
//  - KHÔNG ghi đè giá trị đã có trong app (coi như Sale cập nhật mới hơn sheet).
//  - Khách ĐÃ CHỐT: không ghi status (app khoá cứng theo thẻ Pancake) và không ghi giá trị tiềm năng
//    (đã có doanh thu thật).
//  - Khớp khách theo thứ tự MÃ KH -> SĐT -> Lead ID dạng đơn giản (ONLCT79). KHÔNG dùng Lead ID dạng
//    "ONLHTC1021966906.133": đã kiểm chứng nó giải mã ra NHẦM NGƯỜI.
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
const N=s=>Number(String(s||'').replace(/[^\d]/g,''))||0;
const p9=s=>{const d=(s||'').replace(/\D/g,'');return d.length>=9?d.slice(-9):'';};
const SHOP={1022031789:'CT',1943057093:'CT2',100965386:'CT3',1021966905:'CT4',
 1943096391:'HT',715061393:'HT2',408077426:'HT3',1943052948:'SD',408040224:'TTV',1329071685:'CTT'};
const leadIdOf=o=>'L-'+(SHOP[o.shop_id]||((o.brand||'XX')+String(o.shop_id||'').slice(-4)))+'-'+String(o.system_id||'').padStart(4,'0');
const isChotTag=o=>(o.customer_tags||'').toUpperCase().includes('CHỐT ĐƠN');
const isQual=o=>{const t=(o.customer_tags||'').toUpperCase();return t.includes('CHỐT ĐƠN')||t.includes('BÀN GIAO')||t.includes('TIỀM NĂNG');};
const kh=n=>{const m=/KH\s*0*(\d{3,7})/i.exec(n||'');return m?'KH'+String(m[1]).padStart(6,'0'):null;};
const SH2BR={CT:'CT',SD:'Shidai',NB:'TTV',HT:'HT'};
const NORMST={'mất lead':'Mất lead','đang chăm sóc':'Đang chăm sóc','chăm sóc dài hạn':'Chăm sóc dài hạn'};
const f=n=>Math.round(n).toLocaleString('vi-VN')+'đ';
(async()=>{
 const DRY=process.argv[2]!=='--go';
 const [dh,smn,dmn,ki]=await Promise.all([
  all('datahub_orders','select=shop_id,brand,system_id,order_date,customer_name,phone,internal_note,customer_tags'),
  all('saleretail_manual','select=*'),
  all('datahub_manual','select=id,customer_name,phone,kiot_code'),
  all('kiot_invoices','select=customer_code,total,status'),
 ]);
 const cur={};smn.forEach(r=>cur[r.lead_id]=r);
 const rev={};ki.filter(i=>i.status===1&&i.customer_code).forEach(i=>{rev[i.customer_code]=(rev[i.customer_code]||0)+Number(i.total||0);});

 // gom khách đúng như app
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
 dmn.forEach(r=>{const lid='M-'+String(r.id).padStart(4,'0');
  meta[lid]={name:r.customer_name,chot:!!(r.kiot_code&&rev[r.kiot_code])};
  const p=p9(r.phone);if(p&&!byPh[p])byPh[p]=lid;
  if(r.kiot_code&&!byKH[r.kiot_code])byKH[r.kiot_code]=lid;});

 const t=await(await fetch(`https://docs.google.com/spreadsheets/d/e/${LE}/pub?gid=768026359&single=true&output=csv`)).text();
 const rows=csv(t).slice(1).filter(r=>r.some(x=>x&&x.trim()));
 // gom theo khách, giữ dòng chăm sóc MỚI NHẤT
 const best={};let noMatch=0;
 rows.forEach(r=>{
  const code=(r[17]||'').trim().toUpperCase();
  const idRaw=(r[1]||'').trim().toUpperCase();
  const mm=/^ONL([A-Z]{2})(\d+)$/.exec(idRaw);                   // CHỈ dạng đơn giản
  const ordKey=mm&&SH2BR[mm[1]]?SH2BR[mm[1]]+'#'+Number(mm[2]):null;
  const lid=(code&&byKH[code])||byPh[p9(r[7])]||(ordKey&&byOrd[ordKey]);
  if(!lid){noMatch++;return;}
  const d=D(r[0])||'';
  if(!best[lid]||d>=(best[lid].d||''))best[lid]={d,
    note:(r[10]||'').trim(),pv:N(r[11]),st:NORMST[(r[12]||'').trim().toLowerCase()]||'',
    lost:(r[13]||'').trim(),name:r[6]};
 });

 const plan=[];const add={care:0,note:0,pv:0,st:0,lost:0};
 Object.entries(best).forEach(([lid,b])=>{
  const c=cur[lid]||{},m=meta[lid]||{};
  const p={lead_id:lid};let any=false;
  if(b.d&&!c.care_date){p.care_date=b.d;add.care++;any=true;}
  if(b.note&&!c.content){p.content=b.note;add.note++;any=true;}
  if(b.pv&&!c.potential_value&&!m.chot){p.potential_value=b.pv;add.pv++;any=true;}
  if(b.st&&!c.status&&!m.chot){p.status=b.st;add.st++;any=true;}
  if(b.lost&&!c.lost_group&&!m.chot){p.lost_group=b.lost;add.lost++;any=true;}
  if(any)plan.push({...p,_name:m.name||b.name});
 });
 console.log('Sheet CRM Lẻ: '+rows.length+' dòng | khớp khách: '+Object.keys(best).length+' | không khớp: '+noMatch);
 console.log('SẼ BỔ SUNG cho '+plan.length+' khách:');
 console.log('   Ngày chăm sóc  +'+add.care);
 console.log('   Nội dung       +'+add.note);
 console.log('   Giá trị TN     +'+add.pv);
 console.log('   Trạng thái     +'+add.st);
 console.log('   Nhóm nguyên nhân +'+add.lost);
 plan.slice(0,12).forEach(p=>console.log('     '+p.lead_id.padEnd(12)+String(p._name).slice(0,20).padEnd(21)+
   Object.keys(p).filter(k=>k!=='lead_id'&&k!=='_name').join(', ')));
 if(plan.length>12)console.log('     ... và '+(plan.length-12)+' khách nữa');
 if(DRY){console.log('\n(chạy thử — thêm --go để ghi thật)');return;}
 // PostgREST ghi hàng loạt đòi mọi object CÙNG bộ khoá -> gửi đủ 5 cột, cột nào không đổi thì gửi lại giá trị cũ.
 const K=['care_date','content','potential_value','status','lost_group'];
 const body=plan.map(p=>{const c=cur[p.lead_id]||{};const o={lead_id:p.lead_id,
   updated_by:'import-sheet-crm-fields',updated_at:new Date().toISOString()};
   K.forEach(k=>{o[k]=(k in p)?p[k]:(c[k]??null);});return o;});
 const res=await fetch(U+'/saleretail_manual?on_conflict=lead_id',{method:'POST',
  headers:{...H,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)});
 console.log('\nGHI THẬT:',res.status,(await res.text()).slice(0,110));
})();
