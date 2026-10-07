# App MKT/SALE — luật làm việc cho Claude

Làm việc bằng tiếng Việt, gọi người dùng là **anh** (anh Hải). Mọi thứ Claude tạo ký tên **Monsieur Claude**.
**Đầu mỗi phiên đọc `VIEC.md`** (sổ việc: đang nợ gì, chờ anh quyết gì, quy tắc đã chốt, cơ chế tự chạy, nhật ký).
Xong việc thì cập nhật sổ ngay trong phiên (xoá khỏi mục nợ + 1 dòng nhật ký). Anh đã quyết rồi thì LÀM, đừng hỏi lại.
Phiên chạy trên cloud và phiên trên máy KHÔNG đọc được hội thoại của nhau — mọi thứ quan trọng phải ghi vào `VIEC.md` / file này.

## Phạm vi
- Chỉ sửa / commit repo này (hh-vibecode/mkt-sale-app, live https://hh-vibecode.github.io/mkt-sale-app/).
- `Dashboard-Meta` CHỈ ĐỌC. App QC CSKH là repo riêng (hh-vibecode/qc-cskh) — không sửa từ đây.
- Supabase `bcrpxfvvjsjpvbksqzls` dùng CHUNG với app QC: KHÔNG đổi / tắt khoá cũ (legacy anon, service_role), JWT secret,
  Edge Function `dang-nhap`, hàm `la_quan_tri()`; đổi cấu trúc bảng dùng chung thì nghĩ tới app QC.

- **Dùng chung Supabase với các app khác**: theo `QUY-UOC-DUNG-CHUNG-SUPABASE.md` (sổ đăng ký tiền tố, ai sở hữu bảng nào, chỉ THÊM trên bảng dùng chung).

## Cách làm việc
- **Mốc giờ luôn theo giờ Việt Nam (UTC+7)** (anh chốt 7/10/2026, áp cho mọi app): hiển thị, báo cáo, "hôm nay", lịch job.
  pg_cron / GitHub Actions chạy UTC → giờ VN − 7, ghi chú giờ VN cạnh lịch; báo giờ cho anh luôn đổi sang giờ VN.
- **Minh bạch, không giấu** (anh chốt 30/9/2026): anh không trách khi làm sai hay gặp sự cố, nên mỗi lần báo cáo phải kể đủ
  việc làm sai (kể cả đã tự sửa), phần CHƯA kiểm được và rủi ro tiềm tàng (dữ liệu, phân quyền, bảo mật, job, số liệu). Cùng nhau giải quyết.
- **Tự làm, không giao việc cho anh**: SQL, deploy, cấu hình làm được thì tự làm rồi báo. Lưu kèm `supabase-schema-*.sql`.
- **Commit**: tự pull → commit → push, không hỏi. TRƯỚC mỗi commit chạy `git diff --cached --stat`, chỉ commit đúng file mình sửa.
  Push bị từ chối (phiên khác vừa đẩy) → `git pull --rebase`; xung đột thì giải TỪNG CHỖ bằng tay (APP_VERSION lấy bản mới hơn, nhật ký VIEC giữ cả 2 dòng), kiểm `grep -n "^<<<<<<< |^>>>>>>> "` = 0 và cú pháp index.html OK rồi mới add / `rebase --continue` / push — mỗi bước 1 lệnh riêng, KHÔNG nối `&&` sau script kiểm (30/9/2026 lọt dấu xung đột lên web, app trắng 1–2 phút). Đẩy xong kiểm trang live và báo anh F5.
  Sửa `index.html` thì đóng dấu phiên bản (`APP_VERSION`) trước khi commit.
- **Đẩy bản mới lên `main` xong: đợi GitHub Pages deploy xong (trang live hiện đúng `APP_VERSION` mới) rồi BÁO ANH F5** (anh chốt 30/9).
- Đổi logic báo cáo: chạy `node scripts/kiem-so-lieu.js` trước & sau; lệch > 5% mà đúng thì `--luu` chốt mốc mới + ghi lý do vào sổ.
- Đọc bảng Supabase PHẢI phân trang (`limit/offset` hoặc `sbAll`) — `scripts/check-pagination.js` chạy trong CI sẽ chặn.
- Job nặng: chỉ chạy khi dữ liệu đổi (`scripts/lib/gianh-moc.js` → `gianhKhiDoi`, hàm CSDL `job_dau_van`) hoặc theo khung giờ;
  ghi hàng loạt dùng `return=minimal` / gộp 1 lệnh. (Egress đã từng vượt quota gói free, 29/9/2026 anh mua Pro.)
- Thao tác ra ngoài khó gỡ (tạo / sửa / xoá đơn Pancake hàng loạt, gửi tin khách): chạy thử `KHO=1`, báo số trước.
- Khoá / token: KHÔNG in giá trị ra màn hình, không dán vào chat, không commit. Máy: `supabase-keys.local.txt` (gitignore).
  Cloud: biến môi trường (xem mục "Chạy trên cloud").

## Giao diện
- Không icon emoji trang trí (chỉ icon SVG + ký hiệu nút ✏ ✓ ✕ ▶ ☰). Không dòng chú thích dài dưới tiêu đề thẻ — dùng badge gọn.
- Bảng: số căn phải thẳng cột, tiêu đề cùng phía dữ liệu (`tblAlign()`). Dash: 3 thẻ / hàng, hàng 1 tiền, hàng 2 số lượng.
- Tên khách luôn kèm mã (Mã KH Kiot, chưa có thì Lead ID) — `rptSlMaDuoiTen`.
- Thêm trạng thái / phân loại mới: bộ lọc, ô dash, màu phải nhận ngay (danh sách lấy từ bảng `danh_muc`).

## Nghiệp vụ đã chốt (tóm tắt — chi tiết ở VIEC.md mục 3)
- **Doanh thu Sale = ĐƠN ĐẶT HÀNG Kiot**, không phải hoá đơn. Ngày chốt = ngày tạo đơn. Nối Pancake ↔ Kiot CHỈ bằng Mã KH trong ghi chú Pancake.
- **Dấu vết tiền** (từ 1/6/2026): đơn phải có tiền trả / hoá đơn hoàn thành / khách có cọc mới tính; phiếu tạm không dấu vết = báo giá.
- **Sỉ / Lẻ** theo chi nhánh Kiot (Tổng kho sỉ Shidai = Sỉ); thẻ Pancake KH SỈ / KH LẺ; khách nói mua dùng gia đình = KH LẺ.
- **Sỉ lấy full lịch sử**; Lẻ từ 1/6/2026. **MKT chỉ từ 1/6/2026** (chi phí ads chỉ có từ T6), MKT chỉ lấy Online.
- **MKT**: Sỉ Online chỉ tính tháng đầu, trừ khi khách còn nhắn Pancake; đơn **mua lại** không tính MKT nhưng VẪN là doanh thu Sale.
- **Trùng SĐT = 1 người, tự gộp**; tên không dùng để nghi trùng; gộp theo tên chỉ khi nhóm có tối đa 1 khách có SĐT.
- **Gộp tên Sale**: chỉ khi tên ngắn nằm trọn trong tên dài (Kim Oanh ~ Nguyễn Kim Oanh).
- **Phạm vi xem**: lọc theo Sale ĐÃ CHỐT (gán tay > người bán trên phiếu đặt / hoá đơn Kiot đã nối > không có mới lấy Pancake — anh chốt 3/10), lọc SAU khi xác định Sale; admin / supreme xem hết.
  Sửa phân quyền phải giả lập view từng tài khoản Sale, sót 0 mới xong.
- **Lead cũ** (khách trước T9) không tính vào Nhập Liệu. ĐÃ GỘP 2 ĐỘI SALE (5/10/2026): mọi dropdown Sale hiện hết Sale đang làm, Lẻ/Sỉ do Phân quyền (Loại khách) quyết; BỎ luật chuyển đội, thay bằng: khách đứng tên Sale đã nghỉ có người nhận bàn giao -> thuộc người nhận.
- Tab Nhập Liệu (tên hiển thị "Daily Task" từ 5/10/2026) chỉ so Pancake (lỗi Sale); lỗi liên quan hoá đơn Kiot để dành cho Đối soát. Mục đỏ / vàng = việc cần làm, tính vào badge.
- Lọc đúng bộ lọc nghiệp vụ rồi mới trình số; thiếu dữ liệu KHÔNG phải là khớp; bảng cũ giữ có chủ đích — kiểm trước khi nói "mất dữ liệu".
- Tự tạo đơn Pancake từ hội thoại: kiểm hội thoại đã có đơn, đọc nội dung bỏ rác / xin việc / người rao bán, 1 khách 1 đơn, lấy SĐT gửi sau cùng.

## Chạy trên cloud (claude.ai/code, môi trường "MKT Dev")
- Máy cloud có `node` sẵn: chạy script bằng `node scripts/...` (trên máy anh thì dùng `ELECTRON_RUN_AS_NODE=1 "D:/Microsoft VS Code/Code.exe"`).
- Biến môi trường cần: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MGMT_TOKEN` (chạy SQL), `PANCAKE_SESSION_TOKEN`,
  `KIOT_CLIENT_ID`, `KIOT_CLIENT_SECRET`, `META_ACCESS_TOKEN`, `GITHUB_TOKEN` (đọc log workflow).
- Chạy SQL: `node scripts/sql.js "select 1"` hoặc `SQLFILE=file.sql node scripts/sql.js`.
- Kiểm workflow: GitHub API `repos/hh-vibecode/mkt-sale-app/actions/runs` với `GITHUB_TOKEN`.
