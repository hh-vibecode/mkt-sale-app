// KIỂM TRA PHÂN TRANG: quét toàn bộ mã nguồn tìm chỗ ĐỌC bảng Supabase mà quên phân trang.
// PostgREST trả tối đa 1000 dòng/lần -> đọc thẳng là âm thầm mất dữ liệu, không báo lỗi gì cả.
// Đã dính 21/9/2026: job tự động chỉ thấy 1000/2511 đơn, xử lý thiếu.
// Chạy: node scripts/check-pagination.js   (dùng trong CI hoặc trước khi commit)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = ['index.html', ...fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.js')).map(f => 'scripts/' + f)];
// Những cách đọc AN TOÀN: đã có limit/offset, dùng sbAll/sbFetchAll, hoặc lấy đúng 1 dòng (limit=1, eq. khoá chính).
const AN_TOAN = /limit=|sbAll\(|sbFetchAll\(|\.single\(|id=eq\.|user_id=eq\.|lead_id=eq\.|order_id=eq\./;

let loi = 0;
for (const rel of FILES) {
  const p = path.join(ROOT, rel);
  const src = fs.readFileSync(p, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (!/rest\/v1\/[a-z_]+\?/.test(line)) return;          // không phải chỗ đọc bảng
    // GHI dữ liệu thì không liên quan: upsert (on_conflict) hoặc method nằm ngay dòng sau.
    const quanh = lines.slice(i, i + 3).join(' ');
    if (/on_conflict=/.test(line) || /method:\s*'(POST|PATCH|DELETE|PUT)'/.test(quanh)) return;
    if (AN_TOAN.test(line)) return;
    loi++;
    console.log(`${rel}:${i + 1}  ${line.trim().slice(0, 130)}`);
  });
}
console.log(loi ? `\n=> CÓ ${loi} chỗ đọc bảng chưa phân trang — sửa bằng sbAll()/sbFetchAll() hoặc thêm limit.`
                : '=> Mọi chỗ đọc bảng đều đã phân trang hoặc giới hạn rõ ràng.');
process.exit(loi ? 1 : 0);
