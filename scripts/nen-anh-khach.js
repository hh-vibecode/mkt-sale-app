// NÉN ẢNH HỒ SƠ KHÁCH CUỐI NGÀY (anh Hải 17/10/2026: "ảnh tải lên xong cuối ngày rà lại và giảm size, vừa đủ nhìn thôi, không sau nặng lắm").
// Chỉ đọc dòng kh_anh CHƯA RÀ (da_nen is null) -> không có ảnh mới thì thoát ngay, không tốn egress.
// Ảnh: thu còn cạnh dài 1024px, JPEG chất lượng 65 (mozjpeg), xoay đúng chiều theo EXIF, bỏ metadata.
//   - bản mới nhỏ hơn bản cũ mới thay (đè cùng đường dẫn nếu đã là .jpg, không thì tải lên đường dẫn .jpg mới rồi xoá file cũ)
//   - ảnh đã nhỏ / không đọc được (HEIC...) / PDF: chỉ đánh dấu đã rà + ghi lý do vào nen_ghi_chu, không đụng file
// Ghi kết quả vào sync_log (source 'Nén ảnh khách'). Chạy tay: Actions > Nén ảnh khách > Run workflow. Monsieur Claude.
const sharp = require('sharp');
const { sbAll } = require('./lib/sb.js');
const URL_ = 'https://bcrpxfvvjsjpvbksqzls.supabase.co', B = 'kh-anh', SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SRK, Authorization: 'Bearer ' + SRK };
const CANH = 1024, CL = 65;
const KHO = process.env.KHO === '1';   // chạy thử: chỉ in, không ghi
async function vaDong(id, body) {
  if (KHO) return;
  const r = await fetch(`${URL_}/rest/v1/kh_anh?id=eq.${id}`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('cập nhật kh_anh lỗi ' + r.status);
}
async function ghiLog(body, id) {
  const r = await fetch(`${URL_}/rest/v1/sync_log${id ? '?id=eq.' + id : ''}`, { method: id ? 'PATCH' : 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null); return Array.isArray(j) && j[0] ? j[0].id : null;
}
(async () => {
  if (!SRK) { console.error('Thiếu SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const ds = await sbAll(URL_, SRK, 'kh_anh', 'select=id,duong_dan,mime,kich_thuoc&da_nen=is.null&order=id');
  console.log('Ảnh chưa rà:', ds.length);
  if (!ds.length) return;
  const logId = KHO ? null : await ghiLog({ source: 'Nén ảnh khách', status: 'running' }).catch(() => null);
  let nen = 0, giu = 0, truoc = 0, sau = 0; const loi = [];
  for (const x of ds) {
    const nay = new Date().toISOString();
    try {
      if (!/^image\//.test(x.mime || '')) { await vaDong(x.id, { da_nen: nay, nen_ghi_chu: 'không phải ảnh, giữ nguyên' }); giu++; continue; }
      const t = await fetch(`${URL_}/storage/v1/object/${B}/${x.duong_dan}`, { headers: H });
      if (!t.ok) throw new Error('tải file lỗi ' + t.status);
      const goc = Buffer.from(await t.arrayBuffer());
      let moi;
      try { moi = await sharp(goc).rotate().resize({ width: CANH, height: CANH, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: CL, mozjpeg: true }).toBuffer(); }
      catch (e) { await vaDong(x.id, { da_nen: nay, kich_thuoc_goc: goc.length, nen_ghi_chu: 'không đọc được ảnh (' + e.message.slice(0, 60) + '), giữ nguyên' }); giu++; continue; }
      if (moi.length >= goc.length * 0.9) { await vaDong(x.id, { da_nen: nay, kich_thuoc_goc: goc.length, nen_ghi_chu: 'đã đủ nhẹ, giữ nguyên' }); giu++; continue; }
      const dich = /\.jpe?g$/i.test(x.duong_dan) ? x.duong_dan : x.duong_dan.replace(/\.[^./]*$/, '') + '.jpg';
      console.log(`#${x.id} ${x.duong_dan}: ${Math.round(goc.length / 1024)} KB -> ${Math.round(moi.length / 1024)} KB`);
      truoc += goc.length; sau += moi.length; nen++;
      if (KHO) continue;
      const up = await fetch(`${URL_}/storage/v1/object/${B}/${dich}`, { method: 'POST', headers: { ...H, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: moi });
      if (!up.ok) throw new Error('tải lên lỗi ' + up.status + ' ' + (await up.text()).slice(0, 100));
      await vaDong(x.id, { duong_dan: dich, mime: 'image/jpeg', kich_thuoc: moi.length, kich_thuoc_goc: goc.length, da_nen: nay, nen_ghi_chu: 'đã nén' });
      if (dich !== x.duong_dan) {   // đường dẫn mới đã ghi vào bảng rồi mới xoá file cũ -> hỏng giữa chừng cũng không mất ảnh
        const d = await fetch(`${URL_}/storage/v1/object/${B}`, { method: 'DELETE', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [x.duong_dan] }) });
        if (!d.ok) console.warn('Chưa xoá được file cũ', x.duong_dan, d.status);
      }
    } catch (e) { loi.push('#' + x.id + ' ' + e.message); console.error('#' + x.id, e.message); }
  }
  const tom = `Rà ${ds.length} file: nén ${nen} (${Math.round(truoc / 1024)} KB -> ${Math.round(sau / 1024)} KB), giữ nguyên ${giu}, lỗi ${loi.length}`;
  console.log(tom + (KHO ? ' [CHẠY THỬ, chưa ghi]' : ''));
  if (logId) await ghiLog({ status: loi.length ? 'error' : 'success', finished_at: new Date().toISOString(), records_created: ds.length, records_updated: nen,
    error_message: (tom + (loi.length ? ' · ' + loi.join(' · ') : '')).slice(0, 1000) }, logId);
  if (loi.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
