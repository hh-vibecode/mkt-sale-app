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
// CHẠY KHI DỮ LIỆU ĐỔI (29/9/2026): hỏi CSDL "dấu vân tay" (md5 đúng các cột job sẽ đọc, hàm job_dau_van) --
// trùng lần trước thì thoát, khỏi đọc vài MB. Vẫn chạy chắc 1 lần mỗi `toiDaPhut` phút phòng khi có gì lệch.
// Giành bằng PATCH có điều kiện (dấu khác / quá hạn) -> 2 lượt chồng nhau chỉ 1 lượt chạy.
// Trả { chay, xong(), loi() }: xong() lưu dấu SAU khi ghi (việc job ghi làm đổi dấu -> khỏi chạy thêm 1 lượt thừa),
// loi() xoá dấu để lượt sau chạy lại.
async function gianhKhiDoi(url, khoa, ten, toiDaPhut = 360) {
  const H = { apikey: khoa, Authorization: 'Bearer ' + khoa, 'Content-Type': 'application/json' };
  const B = `${url}/rest/v1/job_moc`, E = encodeURIComponent(ten);
  const dau = async () => {
    const r = await fetch(`${url}/rest/v1/rpc/job_dau_van`, { method: 'POST', headers: H, body: JSON.stringify({ p_ten: ten }) });
    if (!r.ok) throw new Error('job_dau_van lỗi ' + r.status + ' ' + (await r.text()).slice(0, 150));
    return String(await r.json());
  };
  const luu = body => fetch(`${B}?ten=eq.${E}`, { method: 'PATCH', headers: Object.assign({ Prefer: 'return=minimal' }, H), body: JSON.stringify(body) });
  const ket = { chay: true, xong: async () => { await luu({ dau_van: await dau(), luc: new Date().toISOString(), ghi_chu: 'xong' }); },
    loi: async () => { await luu({ dau_van: null, ghi_chu: 'lỗi' }); } };
  if (process.env.CHAY_NGAY === '1') return ket;
  const d = await dau(), nay = new Date().toISOString(), han = new Date(Date.now() - toiDaPhut * 60e3).toISOString();
  const r0 = await fetch(`${B}?ten=eq.${E}&select=luc,dau_van&limit=1`, { headers: H });
  if (!r0.ok) throw new Error('Không đọc được job_moc ' + r0.status);
  const cu = (await r0.json())[0];
  if (!cu) {
    const c = await fetch(`${B}?on_conflict=ten`, { method: 'POST', headers: Object.assign({ Prefer: 'resolution=ignore-duplicates,return=representation' }, H),
      body: JSON.stringify([{ ten, luc: nay, dau_van: d, ghi_chu: 'đang chạy' }]) });
    ket.chay = c.ok && (await c.json()).length > 0;
    return ket;
  }
  if (cu.dau_van === d && cu.luc >= han) { ket.chay = false; return ket; }
  const g = await fetch(`${B}?ten=eq.${E}&or=(dau_van.is.null,dau_van.neq.${d},luc.lt.${han})`, { method: 'PATCH',
    headers: Object.assign({ Prefer: 'return=representation' }, H), body: JSON.stringify({ dau_van: d, luc: nay, ghi_chu: 'đang chạy' }) });
  if (!g.ok) throw new Error('Không giành được job_moc ' + g.status);
  ket.chay = (await g.json()).length > 0;
  return ket;
}
module.exports = { gianhMoc, gianhKhiDoi };
