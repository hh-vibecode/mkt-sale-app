// RÀ & BÙ MỘT LẦN (24/9/2026): đối chiếu từng khách trong sheet 1.MASTER DATA SỈ với hồ sơ khách
// trong app, ô nào APP ĐANG TRỐNG mà sheet có thì bù vào. KHÔNG ghi đè ô app đã có (Sale sửa trong app
// là mới hơn sheet).
//
// Khác bản nạp ghi chú trước (import-ghichu-si-once.js): bản đó chỉ dò khách trong Data nhập tay nên
// sót khách đến từ Pancake. Bản này dò thẳng trên danh sách khách Master mà app đang hiển thị
// (Mã KH -> SĐT), nên khách nào anh nhìn thấy trong app thì đều nối được.
//
// Chạy trong khung test (loader.js dựng app thật trên data thật):
//   Xem trước:  ELECTRON_RUN_AS_NODE=1 Code.exe bu-truong-master-si-once.js
//   Ghi thật:   GHI=1 ELECTRON_RUN_AS_NODE=1 Code.exe bu-truong-master-si-once.js
// Monsieur Claude
const fs=require('fs'),path=require('path');
const LOADER=process.env.LOADER||path.join(__dirname,'loader.js');
const SI='2PACX-1vQQ7Ai1kquRVQKXsfTobG0pm7y3JrYZi0q5UhhTtOv25Tku2ZUjBPJhP0CiOgO1_9FyN42SkViuqsI2';
const GID='2107421092';
const GHI=process.env.GHI==='1';
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
  const t=String(s||'').replace(/\r/g,'');const ra={};
  const vt=MUC.map(([k])=>({k,i:t.indexOf(k)})).filter(x=>x.i>=0).sort((a,b)=>a.i-b.i);
  if(!vt.length){ra.si_gc_khac=t.trim();return ra;}
  if(vt[0].i>0)ra.si_gc_khac=t.slice(0,vt[0].i).trim();
  vt.forEach((x,n)=>{const het=n+1<vt.length?vt[n+1].i:t.length;const m=MUC.find(y=>y[0]===x.k);
    ra[m[1]]=t.slice(x.i+1,het).trim().replace(new RegExp('^'+m[2]+'\\s*:?\\s*','i'),'').trim();});
  return ra;
}
// cột sheet -> cột hồ sơ trong app; 'hien' = giá trị app ĐANG HIỂN THỊ (gồm cả bản chụp sheet cũ si_sheet)
const TRUONG=[
  ['Người đại diện', /^người đại diện/i,  'si_nguoi_dai_dien', r=>r.mn.si_nguoi_dai_dien||r.sh.nguoi_dai_dien],
  ['SĐT',            /^sđt/i,             'si_sdt',            r=>r.sdt],
  ['Tỉnh/TP',        /^tỉnh/i,            'si_tinh',           r=>r.mn.si_tinh||r.sh.tinh],
  ['Địa chỉ',        /^địa chỉ/i,         'si_dia_chi',        r=>r.siDiaChi],
  ['GPKD',           /giấy phép/i,        'si_giay_phep',      r=>r.siGiayPhep],
  ['Fanpage',        /fanpage/i,          'si_fanpage',        r=>r.siFanpage||r.sh.fanpage],
  ['Mô hình',        /mô hình/i,          'si_mo_hinh',        r=>r.siMoHinh],
  ['Diện tích',      /diện tích/i,        'si_dien_tich',      r=>r.siDienTich],
  ['Tài chính',      /tài chính/i,        'si_tai_chinh',      r=>r.siTaiChinh],
  ['Phân loại KH',   /^phân loại/i,       'si_phan_loai',      r=>r.siPhanLoai],
  ['Nhóm KH',        /^nhóm kh/i,         'si_nhom_kh',        r=>r.siNhomKH],
];
const GC=['si_gc_tinh_cach','si_gc_giao_tiep','si_gc_ky_tinh','si_gc_quyet_dinh','si_gc_yeu_to','si_gc_luu_y','si_gc_khac'];

require(LOADER)().then(async({ctx,vm})=>{
  await vm.runInContext('siCrmLoad()',ctx);
  const t=await(await fetch(`https://docs.google.com/spreadsheets/d/e/${SI}/pub?gid=${GID}&single=true&output=csv`)).text();
  const rows=csv(t);const H=rows[0];
  const iMa=H.findIndex(c=>/^mã kh/i.test(c)),iSdt=H.findIndex(c=>/^sđt/i.test(c));
  const iTen=H.findIndex(c=>/tên cửa hàng/i.test(c)),iG=H.findIndex(c=>/ghi chú kh/i.test(c));
  const iQuan=H.findIndex(c=>/quận/i.test(c));
  const cot={};TRUONG.forEach(x=>{cot[x[2]]=H.findIndex(c=>x[1].test(String(c).trim()));});

  const M=JSON.parse(vm.runInContext(`(()=>{
    window._rptSlType=String.fromCharCode(83,7881);modRanges.salesi={from:'',to:''};window._kiotOrdByCode=null;rptSlXoaCache();
    return JSON.stringify(rptSlBuildMaster().map(r=>({leadId:r.leadId,name:r.name,kh:r.kh||'',
      khs:(r.kiotCusts||[]).map(c=>c.code),
      sdts:(r.phones||[]).map(p=>rptSlLast9(p.so)).concat([rptSlLast9(r.phone||'')]).filter(Boolean),
      sdt:((r.phones||[])[0]||{}).so||r.phone||'',
      mn:rptSlManual[r.leadId]||{},sh:r.sh||{},siDiaChi:r.siDiaChi,siGiayPhep:r.siGiayPhep,siFanpage:r.siFanpage,
      siMoHinh:r.siMoHinh,siDienTich:r.siDienTich,siTaiChinh:r.siTaiChinh,siPhanLoai:r.siPhanLoai,siNhomKH:r.siNhomKH})));
  })()`,ctx));

  const dem={};TRUONG.forEach(x=>dem[x[0]]=0);dem['Ghi chú riêng']=0;
  const theoLead={};let khongNoi=0;
  rows.slice(1).filter(r=>String(r[iTen]||r[iSdt]||'').trim()).forEach(s=>{
    const ma=String(s[iMa]||'').trim().toUpperCase(),sdt=p9(s[iSdt]);
    const r=M.find(x=>ma&&(x.kh===ma||x.khs.includes(ma)))||M.find(x=>sdt&&x.sdts.includes(sdt));
    if(!r){khongNoi++;return;}
    const bu=theoLead[r.leadId]=theoLead[r.leadId]||{r,patch:{}};
    TRUONG.forEach(([nhan,,col,hien])=>{
      if(cot[col]<0||bu.patch[col])return;
      let v=String(s[cot[col]]||'').trim();
      if(col==='si_dia_chi'&&v&&iQuan>=0&&String(s[iQuan]||'').trim())v=v+', '+String(s[iQuan]).trim();
      if(!v||String(hien(r)||'').trim())return;
      bu.patch[col]=v;dem[nhan]++;
    });
    if(iG>=0&&String(s[iG]||'').trim().length>5&&!GC.some(k=>String(r.mn[k]||'').trim())){
      const p=tach(s[iG]);let co=false;
      GC.forEach(k=>{if(p[k]&&p[k].trim()){bu.patch[k]=p[k];co=true;}});
      if(co)dem['Ghi chú riêng']++;
    }
  });
  const ghi=Object.values(theoLead).filter(x=>Object.keys(x.patch).length);
  console.log(`Sheet 1.MASTER DATA SỈ đối chiếu với ${M.length} khách Master Sỉ trong app`);
  console.log(`  dòng sheet không nối được khách nào: ${khongNoi}`);
  console.log(`  khách cần bù: ${ghi.length}`);
  Object.entries(dem).forEach(([k,v])=>console.log('    '+k.padEnd(18)+String(v).padStart(4)+' ô trống sẽ bù'));
  ghi.slice(0,8).forEach(x=>console.log('    vd',x.r.leadId,String(x.r.name).slice(0,30),'<-',Object.keys(x.patch).join(', ')));
  if(!GHI){console.log('\n(xem trước — GHI=1 để ghi thật)');return;}

  // PostgREST đòi mọi object trong 1 lô cùng bộ khoá -> ghi từng khách một (PATCH nếu đã có hồ sơ, POST nếu chưa)
  const U=vm.runInContext('SUPABASE_URL',ctx)+'/rest/v1/saleretail_manual';
  const K=fs.readFileSync('C:/Users/HP/Desktop/mkt-sale-app/supabase-keys.local.txt','utf8');
  const SRV=(K.match(/SERVICE_ROLE_KEY:\s*(eyJ[A-Za-z0-9._-]+)/)||[])[1];
  const HH={apikey:SRV,Authorization:'Bearer '+SRV,'Content-Type':'application/json'};
  let ok=0,loi=0;
  for(const x of ghi){
    const body=Object.assign({},x.patch,{updated_by:'Monsieur Claude',updated_at:new Date().toISOString()});
    const coHoSo=Object.keys(x.r.mn).length>0;
    const res=coHoSo
      ?await fetch(U+'?lead_id=eq.'+encodeURIComponent(x.r.leadId),{method:'PATCH',headers:HH,body:JSON.stringify(body)})
      :await fetch(U,{method:'POST',headers:Object.assign({},HH,{Prefer:'resolution=merge-duplicates,return=minimal'}),
          body:JSON.stringify(Object.assign({lead_id:x.r.leadId},body))});
    if(res.ok)ok++;else{loi++;console.log('  lỗi',x.r.leadId,res.status,(await res.text()).slice(0,120));}
  }
  console.log(`\nXONG. Đã bù cho ${ok} khách${loi?(' · lỗi '+loi):''}.`);
}).catch(e=>console.log('LỖI',e.message));
