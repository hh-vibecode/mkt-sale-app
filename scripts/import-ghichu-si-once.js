// MIGRATION MỘT LẦN (24/9/2026): nạp cột "Ghi chú KH (ngày sinh, sở thích, tính cách,...)" của tab
// 1.MASTER DATA SỈ trên Google Sheet vào app, để tab "Ghi chú riêng" trong hồ sơ khách có sẵn dữ liệu.
// Ô ghi chú trong sheet là văn bản tự do nhưng luôn chia 6 mục ①..⑥ -> tách ra 6 cột cho Sale sửa
// từng phần; phần nằm ngoài 6 mục giữ nguyên vào si_gc_khac, không vứt đi chữ nào.
//
// Xem trước:  node scripts/import-ghichu-si-once.js
// Ghi thật:   node scripts/import-ghichu-si-once.js --go
//
// NGUYÊN TẮC: KHÔNG ghi đè ô đã có trong app (coi như Sale cập nhật mới hơn sheet).
// Khớp khách theo MÃ KH trước, chưa có mã thì theo 9 SỐ CUỐI SĐT.
const SI='2PACX-1vQQ7Ai1kquRVQKXsfTobG0pm7y3JrYZi0q5UhhTtOv25Tku2ZUjBPJhP0CiOgO1_9FyN42SkViuqsI2';
const GID='2107421092';                       // tab 1.MASTER DATA SỈ
const U='https://bcrpxfvvjsjpvbksqzls.supabase.co/rest/v1';
const AK=process.env.SUPABASE_ANON_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnB4ZnZ2anNqcHZia3NxemxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzE0OTgsImV4cCI6MjEwMjg0NzQ5OH0.XGEUvHP1YBhxYKD9Xq1yH2gl95-V9VgaY5HfsAnFb2c';
const H={apikey:AK,Authorization:'Bearer '+AK,'Content-Type':'application/json'};
const GO=process.argv.includes('--go');

const all=async(t,q)=>{let o=[],f=0;for(;;){const d=await(await fetch(`${U}/${t}?${q}&limit=1000&offset=${f}`,{headers:H})).json();
  if(!Array.isArray(d))throw new Error(t+': '+JSON.stringify(d).slice(0,140));o=o.concat(d);if(d.length<1000)return o;f+=1000;}};
const csv=t=>{const r=[];let f='',row=[],q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;else if(c===','){row.push(f);f='';}
    else if(c==='\n'){row.push(f);r.push(row);row=[];f='';}else if(c!=='\r')f+=c;}
  if(f||row.length){row.push(f);r.push(row);}return r;};
const p9=s=>{const d=String(s||'').replace(/\D/g,'');return d.length>=9?d.slice(-9):'';};

const MUC=[['①','si_gc_tinh_cach','Tính cách chung'],['②','si_gc_giao_tiep','Phong cách giao tiếp'],
  ['③','si_gc_ky_tinh','Mức độ kỹ tính'],['④','si_gc_quyet_dinh','Cách ra quyết định'],
  ['⑤','si_gc_yeu_to','Yếu tố ảnh hưởng quyết định mua'],['⑥','si_gc_luu_y','Lưu ý đặc biệt khi chăm sóc']];
function tach(s){
  const t=String(s||'').replace(/\r/g,'');
  const ra={};
  const vt=MUC.map(([k])=>({k,i:t.indexOf(k)})).filter(x=>x.i>=0).sort((a,b)=>a.i-b.i);
  if(!vt.length){ra.si_gc_khac=t.trim();return ra;}
  if(vt[0].i>0)ra.si_gc_khac=t.slice(0,vt[0].i).trim();
  vt.forEach((x,n)=>{
    const het=n+1<vt.length?vt[n+1].i:t.length;
    const m=MUC.find(y=>y[0]===x.k);
    ra[m[1]]=t.slice(x.i+1,het).trim().replace(new RegExp('^'+m[2]+'\\s*:?\\s*','i'),'').trim();
  });
  return ra;
}

(async()=>{
  const t=await(await fetch(`https://docs.google.com/spreadsheets/d/e/${SI}/pub?gid=${GID}&single=true&output=csv`)).text();
  const rows=csv(t);
  const iG=rows[0].findIndex(c=>/ghi chú kh/i.test(c));
  const iMa=rows[0].findIndex(c=>/^mã kh/i.test(c));
  const iSdt=rows[0].findIndex(c=>/^sđt/i.test(c));
  const iTen=rows[0].findIndex(c=>/tên cửa hàng/i.test(c));
  if(iG<0)throw new Error('Không thấy cột Ghi chú KH trong sheet');
  const sheet=rows.slice(1).filter(r=>String(r[iG]||'').trim().length>5);

  // Bản đồ khách trong app: Mã KH -> lead_id, SĐT -> lead_id (lấy từ Data nhập tay + hồ sơ Sỉ)
  const dm=await all('datahub_manual','select=id,customer_name,phone,kiot_code,sale_type');
  const sm=await all('saleretail_manual','select=*');
  const byLead={};sm.forEach(r=>byLead[r.lead_id]=r);
  const theoMa={},theoSdt={};
  dm.forEach(r=>{
    const lead='M-'+String(r.id).padStart(4,'0');
    if(r.kiot_code&&!theoMa[r.kiot_code])theoMa[r.kiot_code]=lead;
    const p=p9(r.phone);if(p&&!theoSdt[p])theoSdt[p]=lead;
  });
  sm.forEach(r=>{   // hồ sơ khách Pancake (lead L-...) cũng có SĐT riêng
    const p=p9(r.si_sdt);if(p&&!theoSdt[p])theoSdt[p]=r.lead_id;
    if(r.kiot_code&&!theoMa[r.kiot_code])theoMa[r.kiot_code]=r.lead_id;
  });

  let noiMa=0,noiSdt=0,khongNoi=0,boQua=0;
  const ghi=[];const chuaNoi=[];
  sheet.forEach(r=>{
    const ma=String(r[iMa]||'').trim().toUpperCase();
    const sdt=p9(r[iSdt]);
    const lead=(ma&&theoMa[ma])||(sdt&&theoSdt[sdt])||'';
    if(!lead){khongNoi++;chuaNoi.push([r[iTen]||'',ma||'—',r[iSdt]||'—']);return;}
    if(ma&&theoMa[ma])noiMa++;else noiSdt++;
    const cu=byLead[lead]||{};
    const p=tach(r[iG]);
    // PostgREST doi MOI object trong lo phai cung bo khoa -> luon gui du 7 cot:
    // o nao app da co thi gui lai chinh gia tri cu (khong ghi de), o trong moi lay tu sheet.
    const patch={};let coMoi=false;
    MUC.forEach(([,k])=>{const daCo=String(cu[k]||'').trim();
      if(daCo){patch[k]=cu[k];}
      else if(p[k]&&p[k].trim()){patch[k]=p[k];coMoi=true;}
      else patch[k]=cu[k]||null;});
    {const daCo=String(cu.si_gc_khac||'').trim();
      if(daCo)patch.si_gc_khac=cu.si_gc_khac;
      else if(p.si_gc_khac&&p.si_gc_khac.trim()){patch.si_gc_khac=p.si_gc_khac;coMoi=true;}
      else patch.si_gc_khac=cu.si_gc_khac||null;}
    if(!coMoi){boQua++;return;}
    ghi.push(Object.assign({lead_id:lead},patch,{updated_by:'Monsieur Claude',updated_at:new Date().toISOString()}));
  });

  console.log(`Sheet 1.MASTER DATA SỈ: ${sheet.length} khách có ghi chú`);
  console.log(`  nối bằng Mã KH: ${noiMa} · nối bằng SĐT: ${noiSdt} · chưa nối được: ${khongNoi}`);
  console.log(`  app đã có sẵn ghi chú (bỏ qua): ${boQua} · sẽ ghi: ${ghi.length}`);
  if(chuaNoi.length){console.log('\n  Chưa nối được (không có trong app):');
    chuaNoi.slice(0,15).forEach(x=>console.log('   ',String(x[0]).slice(0,40).padEnd(41),'mã',x[1],'· sđt',x[2]));}
  if(!GO){console.log('\n(xem trước — thêm --go để ghi thật)');return;}

  let ok=0;
  for(let i=0;i<ghi.length;i+=100){
    const lo=ghi.slice(i,i+100);
    const res=await fetch(`${U}/saleretail_manual?on_conflict=lead_id`,{method:'POST',
      headers:Object.assign({},H,{Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(lo)});
    if(!res.ok){console.log('  lỗi lô',i,(await res.text()).slice(0,160));continue;}
    ok+=lo.length;
  }
  console.log(`\nXONG. Đã nạp ghi chú cho ${ok} khách.`);
})().catch(e=>console.log('LỖI',e.message));
