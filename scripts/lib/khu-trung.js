// KHỬ TRÙNG trước khi upsert (25/9/2026, Monsieur Claude).
// Vì sao: API Kiot / Pancake / Meta trả theo TRANG. Nếu trong lúc đang kéo có bản ghi mới sinh ra, danh sách
// trượt đi 1 bậc -> cùng 1 bản ghi xuất hiện ở 2 trang liền nhau. Gửi cả lô có 2 dòng trùng khoá lên
// Supabase thì CSDL từ chối CẢ LÔ ("ON CONFLICT DO UPDATE command cannot affect row a second time")
// -> job đỏ, mail báo lỗi (sync Kiot 11:21 ngày 25/9 và các lần trước). Giữ bản xuất hiện SAU CÙNG.
function khuTrung(rows, khoa) {
  const m = new Map();
  for (const r of rows || []) m.set(khoa(r), r);
  const bo = (rows || []).length - m.size;
  if (bo > 0) console.log(`  (khử ${bo} dòng trùng khoá trước khi ghi)`);
  return [...m.values()];
}
module.exports = { khuTrung };
