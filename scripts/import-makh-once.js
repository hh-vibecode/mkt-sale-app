// MIGRATION MỘT LẦN (17/9/2026): bê MÃ KH mà Sale đã gõ trong tab CRM Lẻ của Google Sheet
// sang bảng saleretail_manual, để không bắt Sale gõ lại 40+ mã vào ghi chú Pancake.
// Sau lần này app KHÔNG đọc Google Sheet nữa -- Sale dán mã thẳng vào ghi chú Pancake như quy trình mới.
// Chạy thử: node scripts/import-makh-once.js | Ghi thật: node scripts/import-makh-once.js --go
//
// Chốt chặn đếm trùng: chỉ điền cho khách CHƯA có mã, và mã đó chưa bị khách nào khác dùng
// (kể cả trong chính lô này). Khớp khách bằng Lead ID (số đơn Pancake) rồi mới tới SĐT.
const LE='2PACX-1vQraTrk4Ha7Sy6G3FwCUlubRbGtKQ4lkqHHDLimn3rmC29DmxFzpV5Ny7Ed57KgSBl3_BTXUj4HahIb';
const U='https://bcrpxfvvjsjpvbksqzls.supabase.co/rest/v1';
const AK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnB4ZnZ2anNqcHZia3NxemxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzE0OTgsImV4cCI6MjEwMjg0NzQ5OH0.XGEUvHP1YBhxYKD9Xq1yH2gl95-V9VgaY5HfsAnFb2c';
const H={apikey:AK,Authorization:'Bearer '+AK};
const all=async(t,q)=>{let o=[],off=0;while(true){const d=await(await fetch(`${U}/${t}?${q}&limit=1000&offset=${off}`,{headers:H})).json();o=o.concat(d);if(d.length<1000)break;off+=1000;}return o;};
const csv=t=>{const r=[];let f='',row=[],q=false;for(let i=0;i<t.length;i++){const c=t[i];
 if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
 else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);r.push(row);row=[];f='';}else if(c!=='\r')f+=c;}
 if(f||row.length){row.push(f);r.push(row);}return r;};
const p9=s=>{const d=(s||'').replace(/\D/g,'');return d.length>=9?d.slice(-9):'';};
const f=n=>Math.round(n).toLocaleString('vi-VN')+'đ';
const SH2BR={CT:'CT',SD:'Shidai',NB:'TTV',HT:'HT'};
// Lead ID sheet: "ONLCT79" hoặc "ONLSDB714210415.864" -> brand + số đơn Pancake
function shKey(id){const s=(id||'').trim().toUpperCase();
 let m=/^ONL([A-Z]{2})[A-Z]\d+\.(\d+)$/.exec(s);if(!m)m=/^ONL([A-Z]{2})(\d+)$/.exec(s);
 return m&&SH2BR[m[1]]?SH2BR[m[1]]+'#'+Number(m[2]):null;}
const SHOP={1022031789:'CT',1943057093:'CT2',100965386:'CT3',1021966905:'CT4',
 1943096391:'HT',715061393:'HT2',408077426:'HT3',1943052948:'SD',408040224:'TTV',1329071685:'HD'};
const leadIdOf=o=>'L-'+(SHOP[o.shop_id]||((o.brand||'XX')+String(o.shop_id||'').slice(-4)))+'-'+String(o.system_id||'').padStart(4,'0');
const isQual=o=>{const t=(o.customer_tags||'').toUpperCase();return t.includes('CHỐT ĐƠN')||t.includes('BÀN GIAO')||t.includes('TIỀM NĂNG');};
(async()=>{
 const DRY=process.argv[2]!=='--go';
 const [dh,kc,ki,smn,dmn]=await Promise.all([
  all('datahub_orders','select=shop_id,brand,system_id,order_date,customer_name,phone,internal_note,customer_tags'),
  all('kiot_customers','select=code,name'),
  all('kiot_invoices','select=customer_code,total,status'),
  all('saleretail_manual','select=lead_id,kiot_code'),
  all('datahub_manual','select=kiot_code'),
 ]);
 const custByCode={};kc.forEach(c=>custByCode[c.code]=c);
 const rev={};ki.filter(i=>i.status===1&&i.customer_code).forEach(i=>{rev[i.customer_code]=(rev[i.customer_code]||0)+Number(i.total||0);});

 // Gom đơn theo KHÁCH đúng như app: khoá SĐT 9 số, không có SĐT thì shop+tên
 const byKey={};
 dh.filter(o=>!(o.customer_tags||'').toUpperCase().includes('KH SỈ')).forEach(o=>{
  const p=p9(o.phone);const k=p?('P'+p):('S'+o.shop_id+'|'+(o.customer_name||'').trim().toLowerCase());
  (byKey[k]=byKey[k]||[]).push(o);});
 Object.keys(byKey).forEach(k=>{if(!byKey[k].some(isQual))delete byKey[k];});

 const used=new Set();                       // mã đã được dùng ở bất kỳ đâu
 dh.forEach(o=>{const m=/KH\s*0*(\d{3,7})/i.exec(o.internal_note||'');if(m)used.add('KH'+String(m[1]).padStart(6,'0'));});
 smn.forEach(r=>{if(r.kiot_code)used.add(r.kiot_code.trim().toUpperCase());});
 dmn.forEach(r=>{if(r.kiot_code)used.add(r.kiot_code.trim().toUpperCase());});

 const meta={},byOrd={},byPh={};             // lead_id -> thông tin khách; và 2 chỉ mục tra cứu
 Object.values(byKey).forEach(list=>{
  list.sort((a,b)=>String(a.order_date).localeCompare(String(b.order_date)));
  const lid=leadIdOf(list[0]);
  const noteKH=list.map(o=>{const m=/KH\s*0*(\d{3,7})/i.exec(o.internal_note||'');return m?'KH'+String(m[1]).padStart(6,'0'):null;}).filter(Boolean).pop();
  meta[lid]={name:list.map(o=>o.customer_name).filter(Boolean).pop()||'',noteKH,
    hasCode:!!(noteKH||(smn.find(r=>r.lead_id===lid)||{}).kiot_code)};
  list.forEach(o=>{const k=o.brand+'#'+Number(o.system_id);if(!byOrd[k])byOrd[k]=lid;});
  const p=p9(list.map(o=>o.phone).filter(Boolean).pop()||'');if(p&&!byPh[p])byPh[p]=lid;
 });

 const t=await(await fetch(`https://docs.google.com/spreadsheets/d/e/${LE}/pub?gid=768026359&single=true&output=csv`)).text();
 const rows=csv(t).slice(1).filter(r=>r.some(x=>x&&x.trim()));
 const plan=[],skip=[];const batch=new Set(),doneLead=new Set();
 rows.forEach(r=>{
  const code=(r[17]||'').trim().toUpperCase();
  if(!/^KH\d+$/.test(code)||!custByCode[code])return;
  const k=shKey(r[1]);
  const lid=(k&&byOrd[k])||byPh[p9(r[7])];
  if(!lid)return;                                        // khách này không có trong luồng Pancake
  const m=meta[lid];
  if(m.hasCode)return;                                   // đã có mã rồi, không đụng vào
  if(used.has(code)){skip.push([lid,m.name,code,'mã đã dùng cho khách khác']);return;}
  if(batch.has(code)){skip.push([lid,m.name,code,'mã trùng trong chính lô này']);return;}
  // 1 khách chỉ nhận 1 mã: sheet có thể ghi cùng 1 khách ở 2 dòng chăm sóc với 2 mã khác nhau
  // (vd Rain Smile ra cả KH007369 lẫn KH007429) -> giữ dòng ĐẦU, đẩy dòng sau sang tab Lỗi cho Sale xử lý.
  if(doneLead.has(lid)){skip.push([lid,m.name,code,'khách này đã nhận mã khác ở dòng trước — cần Sale xác nhận']);return;}
  doneLead.add(lid);
  batch.add(code);
  plan.push({lead_id:lid,kiot_code:code,name:m.name,rev:rev[code]||0,kiotName:custByCode[code].name});
 });
 console.log('Sheet CRM Lẻ -> điền Mã KH cho khách CHƯA có mã: '+plan.length+' | bỏ qua '+skip.length);
 plan.sort((a,b)=>b.rev-a.rev).forEach(p=>console.log('  '+p.lead_id.padEnd(12)+p.name.slice(0,20).padEnd(21)+p.kiot_code+'  '+String(p.kiotName).slice(0,24).padEnd(25)+f(p.rev).padStart(14)));
 console.log('  => doanh thu cộng thêm: '+f(plan.reduce((s,p)=>s+p.rev,0)));
 skip.forEach(s=>console.log('  BỎ  '+s[0]+' '+s[1]+' '+s[2]+' -> '+s[3]));
 if(DRY){console.log('\n(chạy thử — thêm --go để ghi thật)');return;}
 const body=plan.map(p=>({lead_id:p.lead_id,kiot_code:p.kiot_code,updated_by:'import-sheet-crm-le',updated_at:new Date().toISOString()}));
 const res=await fetch(U+'/saleretail_manual?on_conflict=lead_id',{method:'POST',
  headers:{...H,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body)});
 console.log('\nGHI THẬT:',res.status,(await res.text()).slice(0,120));
})();
