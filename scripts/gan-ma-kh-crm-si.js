// ════════ GẮN MÃ KH VÀO NHẬT KÝ CRM SỈ ════════
// Vấn đề (phát hiện 23/9/2026): bảng salesi_crm gần như luôn để trống cột kiot_code -- Sale chỉ điền
// Mã KH ở sheet Master chứ không điền lại trong từng lượt chăm sóc. Hệ quả: nhật ký CRM không tra
// ngược được sang Kiot, và dưới tên khách chỉ hiện Lead ID.
//
// Script này điền kiot_code theo 2 đường, ĐƯỜNG CHẮC TRƯỚC:
//   1. lead_id -> hồ sơ khách trong app (saleretail_manual.si_sheet.ma_kh hoặc Mã KH đã nối)
//   2. SĐT -> khách Kiot, CHỈ nhận khi khớp DUY NHẤT 1 khách (khớp nhiều -> bỏ, không đoán)
// Không đụng tới dòng đã có kiot_code.
//
// Chạy: node scripts/gan-ma-kh-crm-si.js        (KHO=1 để xem trước, không ghi)
const SUPABASE_URL = 'https://bcrpxfvvjsjpvbksqzls.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHI_XEM = process.env.KHO === '1';
const H = { apikey: SERVICE_ROLE_KEY, Authorization: 'Bearer ' + SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };
const p9 = s => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };
const maKH = s => { const m = /KH\s*0*(\d{3,7})/i.exec(String(s || '')); return m ? 'KH' + m[1].padStart(6, '0') : ''; };

async function doc(bang, cot) {
  let ra = [], tu = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${bang}?select=${cot}&limit=1000&offset=${tu}`, { headers: H });
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error(bang + ': ' + JSON.stringify(j).slice(0, 150));
    ra = ra.concat(j);
    if (j.length < 1000) return ra;
    tu += 1000;
  }
}

(async () => {
  if (!SERVICE_ROLE_KEY) { console.error('Thiếu SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const [crm, hs, kh, nt] = await Promise.all([
    doc('salesi_crm', 'id,lead_id,kiot_code,customer_name,phone'),
    doc('saleretail_manual', 'lead_id,si_sheet'),
    doc('kiot_customers', 'code,name,phone,phone_key,customer_group'),
    doc('datahub_manual', 'id,kiot_code,phone,sale_type'),
  ]);
  // lead_id -> Mã KH (từ hồ sơ sheet Sỉ, và từ dòng nhập tay M-xxxx)
  const theoLead = {};
  hs.forEach(r => { const m = maKH((r.si_sheet || {}).ma_kh); if (r.lead_id && m) theoLead[r.lead_id] = m; });
  nt.forEach(r => { if (r.kiot_code) theoLead['M-' + String(r.id).padStart(4, '0')] = r.kiot_code; });
  // SĐT -> khách Kiot (chỉ nhận khi duy nhất)
  const theoSdt = {};
  kh.forEach(c => { const k = c.phone_key || p9(c.phone); if (!k) return; (theoSdt[k] = theoSdt[k] || []).push(c); });

  const sua = [];
  const bo = { daCo: 0, khongRa: 0, nhieuKhach: 0 };
  crm.forEach(r => {
    if (r.kiot_code) { bo.daCo++; return; }
    let ma = r.lead_id ? theoLead[r.lead_id] : '';
    let nguon = 'lead';
    if (!ma) {
      const hit = theoSdt[p9(r.phone)] || [];
      if (hit.length === 1) { ma = hit[0].code; nguon = 'sđt'; }
      else if (hit.length > 1) { bo.nhieuKhach++; return; }
    }
    if (!ma) { bo.khongRa++; return; }
    sua.push({ id: r.id, ma, nguon, ten: r.customer_name });
  });
  const theoNguon = { lead: sua.filter(x => x.nguon === 'lead').length, sđt: sua.filter(x => x.nguon === 'sđt').length };
  console.log(`Nhật ký CRM Sỉ: ${crm.length} lượt`);
  console.log(`  đã có Mã KH sẵn        : ${bo.daCo}`);
  console.log(`  SẼ ĐIỀN                : ${sua.length}  (qua Lead ID ${theoNguon.lead} · qua SĐT ${theoNguon['sđt']})`);
  console.log(`  bỏ vì SĐT trùng nhiều khách: ${bo.nhieuKhach}`);
  console.log(`  bỏ vì không tra ra gì  : ${bo.khongRa}`);
  const mau = {};
  sua.forEach(x => { mau[x.ma] = mau[x.ma] || { ten: x.ten, n: 0 }; mau[x.ma].n++; });
  console.log(`  => ${Object.keys(mau).length} khách khác nhau`);
  if (CHI_XEM) { console.log('(KHO=1 -> chỉ xem trước, không ghi)'); return; }

  // id là cột identity GENERATED ALWAYS -> không upsert được, phải PATCH.
  // Gom các lượt cùng một Mã KH rồi cập nhật theo lô id cho đỡ số lần gọi.
  const theoMa = {};
  sua.forEach(x => { (theoMa[x.ma] = theoMa[x.ma] || []).push(x.id); });
  let ok = 0;
  for (const [ma, ids] of Object.entries(theoMa)) {
    for (let i = 0; i < ids.length; i += 150) {
      const lo = ids.slice(i, i + 150);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/salesi_crm?id=in.(${lo.join(',')})`, { method: 'PATCH',
        headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ kiot_code: ma }) });
      if (r.ok) ok += lo.length; else console.error('  lỗi', ma, (await r.text()).slice(0, 160));
    }
  }
  console.log(`XONG. Đã điền Mã KH cho ${ok} lượt chăm sóc.`);
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
