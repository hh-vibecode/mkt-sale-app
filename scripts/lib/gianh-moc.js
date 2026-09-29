// GIÀNH LƯỢT CHẠY THEO KHOẢNG THỜI GIAN (29/9/2026) -- giảm lưu lượng tải ra (egress) Supabase.
// Supabase gói miễn phí ~5 GB tải ra / tháng; các job đọc cả bảng lớn chạy theo workflow 10–15 phút đã vượt quota.
// Job gọi gianhMoc(ten, phut) ở ĐẦU script: chỉ khi lần chạy trước cách đây >= phut phút mới được chạy, và chỉ 1 lượt
// giành được (PATCH có điều kiện trên bảng job_moc, CSDL tự khoá dòng) -> 2 lượt workflow chồng nhau không chạy đôi.
// CHAY_NGAY=1 để bỏ qua (chạy tay).
async function gianhMoc(url, khoa, ten, phut) {
  if (process.env.CHAY_NGAY === '1') return true;
  const H = { apikey: khoa, Authorization: 'Bearer ' + khoa, 'Content-Type': 'application/json' };
  const B = `${url}/rest/v1/job_moc`;
  const moc = new Date(Date.now() - phut * 60e3).toISOString();
  const nay = new Date().toISOString();
  // chưa có dòng -> tạo (trùng khoá thì lượt khác đã tạo: bỏ qua, đi tiếp bước giành)
  const r0 = await fetch(`${B}?ten=eq.${encodeURIComponent(ten)}&select=luc&limit=1`, { headers: H });
  if (!r0.ok) throw new Error('Không đọc được job_moc ' + r0.status);
  if (!(await r0.json()).length) {
    const c = await fetch(`${B}?on_conflict=ten`, { method: 'POST', headers: Object.assign({ Prefer: 'resolution=ignore-duplicates,return=representation' }, H),
      body: JSON.stringify([{ ten, luc: nay, ghi_chu: 'lượt đầu' }]) });
    if (c.ok && (await c.json()).length) return true;
  }
  const g = await fetch(`${B}?ten=eq.${encodeURIComponent(ten)}&luc=lt.${moc}`, { method: 'PATCH',
    headers: Object.assign({ Prefer: 'return=representation' }, H), body: JSON.stringify({ luc: nay, ghi_chu: 'đang chạy' }) });
  if (!g.ok) throw new Error('Không giành được mốc job_moc ' + g.status);
  return (await g.json()).length > 0;
}
module.exports = { gianhMoc };
