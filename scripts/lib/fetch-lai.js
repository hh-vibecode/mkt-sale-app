// fetch có THỬ LẠI -- dùng chung cho mọi job đồng bộ.
//
// Vì sao cần: 23/9/2026 job "KiotViet - Đơn đặt hàng" fail 1 lượt với lỗi "fetch failed" (mạng chập
// vài giây), kéo theo mail báo lỗi dù lượt sau chạy lại bình thường. Lỗi mạng thoáng qua không phải
// lỗi dữ liệu -- thử lại vài lần là xong, đừng để nó thành báo động giả làm người ta nhờn cảnh báo.
//
// Thử lại khi: lỗi mạng (fetch throw) hoặc HTTP 429 / 5xx.
// KHÔNG thử lại khi: 4xx khác (sai token, sai tham số) -- thử lại cũng vô ích, phải sửa.
const NGU = ms => new Promise(r => setTimeout(r, ms));

async function fetchLai(url, opts, cauHinh) {
  const { lan = 3, cho = 1500, ten = 'fetch' } = cauHinh || {};
  let loiCuoi;
  for (let i = 1; i <= lan; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 || res.status >= 500) {
        loiCuoi = new Error(`HTTP ${res.status}`);
        if (i < lan) { console.warn(`  [${ten}] ${loiCuoi.message}, thử lại lần ${i + 1}/${lan}…`); await NGU(cho * i); continue; }
        return res;   // hết lượt thì trả về để chỗ gọi tự xử lý như cũ
      }
      return res;
    } catch (e) {
      loiCuoi = e;
      if (i < lan) { console.warn(`  [${ten}] ${e.message}, thử lại lần ${i + 1}/${lan}…`); await NGU(cho * i); continue; }
    }
  }
  throw loiCuoi;
}

module.exports = { fetchLai };
