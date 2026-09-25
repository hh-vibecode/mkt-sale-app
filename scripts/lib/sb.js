// HÀM DÙNG CHUNG cho mọi script đọc Supabase.
// VÌ SAO CÓ FILE NÀY: PostgREST chỉ trả TỐI ĐA 1000 dòng mỗi lần. Ngày 21/9/2026 job tự động đọc
// datahub_orders (2.511 dòng) mà không phân trang -> chỉ thấy 1000 dòng đầu, xử lý thiếu (3/8 đơn B3,
// bỏ sót ca cần gắn thẻ). Từ nay MỌI chỗ đọc bảng phải dùng sbAll(), đừng gọi fetch thẳng.
const PAGE = 1000;

// Đọc HẾT bảng, tự phân trang. Ném lỗi nếu không đọc được để job biết mà báo, không âm thầm chạy thiếu.
async function sbAll(url, key, table, query) {
  let out = [], off = 0;
  while (true) {
    const res = await fetch(`${url}/rest/v1/${table}?${query}&limit=${PAGE}&offset=${off}`,
      { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!res.ok) throw new Error(`Đọc ${table} lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    out = out.concat(rows);
    if (rows.length < PAGE) return out;
    off += PAGE;
    if (off > 500000) throw new Error(`Đọc ${table} quá 500.000 dòng — dừng để tránh vòng lặp`);
  }
}

module.exports = { sbAll };
