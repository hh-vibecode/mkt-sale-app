// MIGRATION MỘT LẦN (đã chạy 17/9/2026): bê tab "6.NGUONLE" của Google Sheet sang bảng datahub_manual,
// coi như Sale đã nhập tay -- để không phải gõ lại. Sau lần này app KHÔNG đọc Google Sheet nữa.
// Chạy thử: node scripts/import-nguonle-once.js | Ghi thật: node scripts/import-nguonle-once.js --go
// Có 4 chốt chặn đếm trùng: mã đã dùng bên Pancake, mã trùng trong cùng lô, SĐT đã có đơn Pancake,
// và dòng đã tồn tại trong datahub_manual. Mốc thời gian: chỉ nhận từ 1/6/2026.

const HUB='2PACX-1vTxkcdPdRW39OJhxER9HUomDHayVMfICFrIFYB3INtVJfC_HXRHC5a1xjVW2BYEDnDaMLbs_VQuvXwe';
const LE='2PACX-1vQraTrk4Ha7Sy6G3FwCUlubRbGtKQ4lkqHHDLimn3rmC29DmxFzpV5Ny7Ed57KgSBl3_BTXUj4HahIb';
const U='https://bcrpxfvvjsjpvbksqzls.supabase.co/rest/v1';
const AK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnB4ZnZ2anNqcHZia3NxemxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzE0OTgsImV4cCI6MjEwMjg0NzQ5OH0.XGEUvHP1YBhxYKD9Xq1yH2gl95-V9VgaY5HfsAnFb2c';
const H={apikey:AK,Authorization:'Bearer '+AK};
const all=async(t,q)=>{let o=[],off=0;while(true){const d=await(await fetch(`${U}/${t}?${q}&limit=1000&offset=${off}`,{headers:H})).json();o=o.concat(d);if(d.length<1000)break;off+=1000;}return o;};
const csv=t=>{const r=[];let f='',row=[],q=false;for(let i=0;i<t.length;i++){const c=t[i];
 if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
 else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);r.push(row);row=[];f='';}else if(c!=='\r')f+=c;}
 if(f||row.length){row.push(f);r.push(row);}return r;};
const get=async(id,gid)=>csv(await(await fetch(`https://docs.google.com/spreadsheets/d/e/${id}/pub?gid=${gid}&single=true&output=csv`)).text());
const D=s=>{const m=/(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s||'');return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';};
const p9=s=>{const d=(s||'').replace(/\D/g,'');return d.length>=9?d.slice(-9):'';};
const nk=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[-–].*$/,'').replace(/^\s*(kl|ks|kh)\s+/,'').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
const f=n=>Math.round(n).toLocaleString('vi-VN')+'đ';
function brandOf(kenh){const k=(kenh||'').toLowerCase();
 if(/chánh tâm|chanh tam/.test(k))return'CT';
 if(/hiền thu|hien thu/.test(k))return'HT';
 if(/shidai|thời đại|thoi dai/.test(k))return'Shidai';
 if(/nến bơ|nen bo|tự tại|tu tai/.test(k))return'TTV';
 return null;}
(async()=>{
 const DRY=process.argv[2]!=='--go';
 const [le6,th,crm,dhO,kc,ki,existing]=await Promise.all([
  get(HUB,'75304040'),get(HUB,'0'),get(LE,'768026359'),
  all('datahub_orders','select=phone,customer_name,brand,system_id,internal_note'),
  all('kiot_customers','select=code,name,phone_key,customer_group'),
  all('kiot_invoices','select=customer_code,purchase_date,total,status'),
  all('datahub_manual','select=id,customer_name,phone,kiot_code'),
 ]);
 // Mã KH: từ tab CRM Lẻ, khoá theo SĐT và theo TÊN (các dòng KHAC không có SĐT bên 6.NGUONLE)
 const khByPhone={},khByName={};
 crm.slice(1).forEach(r=>{const code=(r[17]||'').trim().toUpperCase();if(!/^KH\d+$/.test(code))return;
  const ph=p9(r[7]);if(ph&&!khByPhone[ph])khByPhone[ph]=code;
  const n=nk(r[6]);if(n&&!khByName[n])khByName[n]=code;});
 const custByCode={};kc.forEach(c=>custByCode[c.code]=c);
 const invByCode={};ki.filter(i=>i.status===1&&i.customer_code).forEach(i=>{(invByCode[i.customer_code]=invByCode[i.customer_code]||[]).push(i);});
 // Mã KH ĐÃ được dùng bởi khách bên luồng Pancake (ghi chú nội bộ + Sale nhập ở tab Nhập Liệu)
 // -> nhập nữa là ĐẾM TRÙNG doanh thu. Chặn theo MÃ chắc chắn hơn chặn theo SĐT: "Kiều Trang"
 // không có SĐT bên Pancake nhưng đã nối KH007452 (222tr), lọc theo SĐT sẽ lọt.
 const smn=await all('saleretail_manual','select=lead_id,kiot_code');
 const usedCode=new Set();
 dhO.forEach(o=>{const mm=/KH\s*0*(\d{3,7})/i.exec(o.internal_note||'');if(mm)usedCode.add('KH'+String(mm[1]).padStart(6,'0'));});
 smn.forEach(r=>{if(r.kiot_code)usedCode.add(r.kiot_code.trim().toUpperCase());});
 existing.forEach(r=>{if(r.kiot_code)usedCode.add(r.kiot_code.trim().toUpperCase());});
 const pancakePhones=new Set(dhO.map(o=>p9(o.phone)).filter(Boolean));
 const havePhone=new Set(existing.map(r=>p9(r.phone)).filter(Boolean));
 const haveName=new Set(existing.map(r=>nk(r.customer_name)));

 const rows=le6.slice(1).filter(r=>r.some(x=>x&&x.trim()));
 const plan=[],skip=[],batchCode=new Set();
 rows.forEach(r=>{
  const name=(r[2]||'').trim();if(!name)return;
  const ph=p9(r[3]);
  let code=(ph&&khByPhone[ph])||null,by=code?'SĐT':'';
  if(!code){const c2=khByName[nk(name)];
   // khớp bằng TÊN mà dòng lại CÓ SĐT -> chỉ nhận khi SĐT bên Kiot trùng, tránh gán nhầm người trùng tên
   if(c2&&(!ph||((custByCode[c2]||{}).phone_key===ph))){code=c2;by='tên';}
   else if(c2)by='tên (SĐT lệch -> bỏ mã)';}
  const invs=code?(invByCode[code]||[]):[];
  let date=D(r[0]);
  if(!date&&invs.length)date=invs.map(i=>String(i.purchase_date).slice(0,10)).sort()[0];
  const rev=invs.reduce((s,i)=>s+Number(i.total||0),0);
  const why=!date?'không có ngày tạo và không suy được từ hoá đơn'
   :date<'2026-06-01'?'trước mốc 1/6/2026'
   :(code&&usedCode.has(code))?'mã '+code+' đã dùng bên luồng Pancake -> đếm trùng'
   :(code&&batchCode.has(code))?'mã '+code+' trùng với dòng khác trong chính lô này'
   :(ph&&pancakePhones.has(ph))?'SĐT đã có đơn Pancake -> sẽ trùng'
   :(ph&&havePhone.has(ph))||haveName.has(nk(name))?'đã có trong datahub_manual'
   :null;
  if(!why&&code)batchCode.add(code);
  const rec={created_date:date,customer_name:name,phone:(r[3]||'').trim()||null,
    nguon:(r[4]||'Online').trim(),kenh:(r[5]||'').trim()||null,brand:brandOf(r[5]),
    staff_name:(r[6]||'').trim()||null,kiot_code:code,created_by:'import-6.NGUONLE',_rev:rev,_by:by};
  if(why)skip.push([rec,why]);else plan.push(rec);
 });
 console.log('6.NGUONLE: '+rows.length+' dòng -> NHẬP '+plan.length+' | bỏ qua '+skip.length);
 console.log('\nSẼ NHẬP:');
 plan.forEach(p=>console.log('  '+p.created_date+'  '+p.customer_name.slice(0,22).padEnd(23)+(p.phone||'—').padEnd(12)+String(p.kenh||'').slice(0,24).padEnd(25)+(p.kiot_code||'chưa có mã').padEnd(11)+String(p._by||'').padEnd(6)+f(p._rev).padStart(14)));
 console.log('  => doanh thu Kiot thật cộng thêm: '+f(plan.reduce((s,p)=>s+p._rev,0)));
 console.log('\nBỎ QUA:');
 skip.forEach(([p,w])=>console.log('  '+(p.created_date||'??????????')+'  '+p.customer_name.slice(0,22).padEnd(23)+'-> '+w));
 if(DRY){console.log('\n(chạy thử — thêm --go để ghi thật)');return;}
 const body=plan.map(p=>{const q={...p};delete q._rev;delete q._by;return q;});
 const res=await fetch(U+'/datahub_manual',{method:'POST',headers:{...H,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});
 console.log('\nGHI THẬT:',res.status,(await res.text()).slice(0,120));
})();
