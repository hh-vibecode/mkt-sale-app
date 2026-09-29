# SỔ VIỆC — app MKT/SALE

> Sổ này thay cho việc đọc lại hội thoại cũ. **Claude phải mở file này đầu mỗi phiên làm việc.**
> Xong việc nào thì xoá khỏi mục ĐANG NỢ và ghi 1 dòng vào NHẬT KÝ (gộp lại khi quá dài).
> **Anh đã quyết rồi thì LÀM, đừng xếp lại vào mục "chờ anh quyết" để hỏi lại** (mắc lỗi này 23/9 với việc tự tạo data nhập tay).
> Cập nhật lần cuối: 28/09/2026 chiều. Luồng Sale/MKT anh đánh giá xong ~90%; anh chuyển sang xây luồng QC CSKH (chat mới). Việc #18 / 18-KS (khách để SĐT trong hội thoại) ĐÃ XONG 28/9 — xem nhật ký 28/9.

---

## 1. ĐANG CHỜ ANH HẢI QUYẾT

| # | Việc | Cần anh nói gì |
|---|---|---|
| 1 | **Kéo full hoá đơn Kiot về hub** — 23/09 anh bảo **TẠM ĐỂ ĐÓ**, khi nào cần thì làm. Xem mục 6 bên dưới trước khi bắt tay | khi nào cần thì anh gọi |
| 4 | **Soát đơn huỷ / phiếu tạm** — 925/3.029 đơn Kiot đang huỷ (30%), 640 phiếu tạm không cọc (22,6 tỷ). Nghi lỗi quy trình Sale | có dựng mục soát không |
| 19 | **Cột Mess ở báo cáo MKT** lệch Ads Manager: app lấy "Lượt bắt đầu cuộc trò chuyện" (Mass tệp T9 = 76), Ads Manager anh xem "Tổng số người liên hệ nhắn tin" (86) / "Người liên hệ nhắn tin mới" (67). "Lượt mua" Meta (3) = sự kiện tạo/gửi đơn trong Messenger, 10 đơn Pancake của 2 QC đó đều Mới 0đ → app tính 0 | giữ 76 hay đổi 86/67? có thêm cột "Lượt mua (Meta)" để đối chiếu không |
| 20 | **17 hẹn chăm sóc cũ** (nhập từ sheet) đang quá hạn → chuông Master Sỉ sáng ngay | giữ hay dọn |
| 12 | M-0197 (Sỉ "Ngoquoc Duy") và M-0021 (Lẻ "KL ANH DUY") chung SĐT …349764439 — KHÔNG gộp vì khác Lẻ/Sỉ | chỉ để anh biết |

## 2. CLAUDE ĐANG NỢ (tự làm, không cần hỏi)

| # | Việc | Ghi chú |
|---|---|---|
| 24 | **Chờ anh chọn**: mục trong Nhập Liệu liệt kê khách job vừa tạo đơn / job bỏ qua (7 ngày) kèm câu khách nhắn, để Sale soát (em đề xuất làm trước trong #22) | hỏi lại anh khi quay lại luồng Sale |
| 22 | **Điểm dễ vỡ còn lại (rà 28/9)**: (a) ĐÃ ĐO 28/9: bước phân loại SP chỉ 8–12 giây, lượt Kiot vẫn ~2,5 phút — ổn; (b) tên mặc định khi chuyển đội (Toàn / Thảo Ngọc) ghi cứng trong `RPT_SL_MAC_DINH_CHUYEN` — đổi tên Sale ở Phân quyền không tự đổi theo; (c) đổi thẻ KH SỈ/LẺ trên đơn cũ chỉ về app ở lượt quét toàn bộ (7h05 · 12h30 · 18h00); (d) bộ lọc rác dựa từ khoá, chưa có mục trong app để Sale soát ca job bỏ / job tạo; (e) PANCAKE_SESSION_TOKEN hết hạn là mọi job Pancake dừng (có mail đỏ) | làm dần / chờ anh chọn |

| 17 | **Nguyễn Thuỳ Trâm** (L-HT-0296) mã KH002561 không có đơn; đơn thật nghi là DH002098 dưới mã KH007352 "KL Anh Tân" (M-0019) | Sale xác nhận rồi sửa ghi chú Pancake |
| 3 | **Mật khẩu DB bị lộ trong hội thoại 25/9.** Lúc soát file `supabase-keys.local.txt`, lệnh che giá trị bị sót dòng `DB_PASSWORD` nên mật khẩu hiện nguyên văn trong kết quả lệnh của phiên Claude. Không ra khỏi máy, không nằm trong commit nào | Anh quyết: có đổi mật khẩu DB không (Supabase → Project Settings → Database → Reset password), đổi thì nhớ cập nhật lại `supabase-keys.local.txt` và mọi chỗ đang dùng mật khẩu này. Khoá quản trị (service role) và khoá công khai KHÔNG bị hiện |

### 2b. Ghi chú

**Đã soi xong 23/09:** không lệch đơn nào. API Kiot trả đủ 3.029 đơn, DB cũng 3.029, đối chiếu từng mã khớp tuyệt đối. Con số 3.076 là metadata `total` của Kiot (gồm cả đơn đã xoá), không phải số đơn thật — lần sau đừng lấy `total` làm chuẩn.

## 3. QUY TẮC ĐÃ CHỐT (đừng hỏi lại)

- **Doanh thu Sale = ĐƠN ĐẶT HÀNG Kiot**, không phải hoá đơn. Ngày chốt = ngày tạo đơn.
- **DẤU VẾT TIỀN THẬT** (luật chung): mọi data liên quan doanh thu, kể cả data kéo từ Kiot, trước khi vào app phải có ít nhất 1 trong 3: đã trả tiền trên đơn · khách có hoá đơn hoàn thành · khách có đặt cọc. Trạng thái "Hoàn thành" do Sale đặt tay KHÔNG tính là bằng chứng. Chỉ áp từ 1/6/2026 (trước đó app không có dữ liệu hoá đơn).
- **Phiếu tạm**: đã trả tiền trên phiếu → tính · khách có nợ âm (đã cọc) → tính · không dấu vết tiền → báo giá, không tính.
- **Đơn mua lại** (quá 1 tháng, khách không còn nhắn Pancake): KHÔNG tính cho MKT nhưng VẪN là doanh thu Sale — báo cáo Sale lọc kỳ + cộng cả đơn mua lại.
- **Cắt doanh thu**: Lẻ Online tính hết · Sỉ Offline tính hết · Sỉ Online chỉ tính trong 1 tháng từ đơn đầu, TRỪ KHI khách còn nhắn Pancake (last_chat + 30 ngày). Đơn trước 04/06/2026 không bao giờ cắt.
- **Sỉ / Lẻ trong Kiot**: theo CHI NHÁNH — "Tổng kho sỉ Shidai" = Sỉ, "Đồ Thờ Chánh Tâm" + "Đồ thờ Hiền Thủy" = Lẻ. Nhóm khách chỉ dùng khi ghi rõ. Có ca lẫn nhưng hiếm.
- **Brand khách Sỉ**: kênh ghi rõ brand khác thì theo kênh, còn lại (Sales trực tiếp / trống) = **Shidai**.
- **Hub = nguồn**, giữ hết và vẫn update bình thường; từ nguồn ra báo cáo phải qua bộ lọc. Bộ lọc hiện tại: **chỉ khách Lẻ nguồn Online**.
- **Sỉ lấy full lịch sử** (không giới hạn T6). Riêng TAB Data nhập tay chỉ HIỆN từ 1/6/2026 cho đỡ dài, dòng cũ vẫn vào báo cáo.
- **MKT chỉ lấy Sỉ Online**, Sỉ Offline chỉ vào báo cáo Sale Sỉ.
- **Báo cáo MKT chỉ từ 1/6/2026** (chi phí ads chỉ có từ T6) — doanh thu, đơn, mọi chỉ số MKT đều cắt từ mốc này.
- **Cột trạng thái của Sỉ**: Master = Phân loại KH. Tab CRM Sỉ ĐÃ GỠ (24/9) — lịch sử chăm sóc nằm trong popup hồ sơ khách (3 tab: Thông tin · Ghi chú riêng · Lịch sử chăm sóc), vẫn lưu ở bảng `salesi_crm`.
- **Data Pancake vào báo cáo Sale** (anh chốt 27/9, thay luật 24/9): đơn **CÓ SĐT** (chưa huỷ) là vào luôn, cả Sỉ lẫn Lẻ, **không cần thẻ**. Đơn chưa có SĐT thì vẫn phải có thẻ: Sỉ cần TIỀM NĂNG / CHỐT ĐƠN · Lẻ cần CHỐT ĐƠN / BÀN GIAO / TIỀM NĂNG.
- **Chia Sỉ / Lẻ cho đơn Pancake** (`dhSaleTypeOrder`): có thẻ KH SỈ / KH LẺ thì theo thẻ. Không thẻ thì theo thẻ ở đơn khác của cùng khách (trùng 9 số cuối SĐT). Vẫn không có thì đơn từ page **Shidai → Sỉ**, còn lại → Lẻ. Trước 27/9 đơn không thẻ luôn tính vào Lẻ.
- **Lượt chăm sóc "Chốt đơn"** bắt buộc điền mã đơn đặt hàng CÓ THẬT bên Kiot.
- **Nút Xoá** luôn nằm TRONG form Sửa, bấm phải hỏi xác nhận. **Khách chưa có Sale = để TRỐNG** (bỏ hẳn "botsale sỉ", 24/9). **Thu hồi data** (chỉ Admin) = về trống (lưu si_sale '', khác null = chưa từng gán) → rơi vào tab Gán data. Tab Gán data có ở CẢ Lẻ lẫn Sỉ.
- **Master Sỉ** mặc định lọc 3 ngày gần nhất, tính theo NGÀY TẠO khách (anh chốt 24/9, không đổi sang ngày chăm sóc). Thẻ dash: icon + tên (chữ thường, đậm) cùng hàng, không dòng phụ.
- **Lead ID**: dùng mã app sinh; khách đã có Mã KH Kiot thì cột đó hiện thẳng Mã KH.
- **Tên khách Ở ĐÂU cũng kèm mã** ngay dưới (hoặc cạnh, trong tiêu đề popup): có Mã KH Kiot thì hiện Mã KH, chưa có thì Lead ID. Dùng chung hàm `rptSlMaDuoiTen` — thêm bảng mới phải gọi hàm này.
- **1 khách nhắn nhiều nguồn** (nhiều page / nhiều SĐT) thì kê đủ: nhãn "N nguồn · M SĐT" dưới tên + bảng Nguồn liên hệ trong hồ sơ. Lead Pancake + dòng sheet cùng ngày cùng SĐT = 1 nguồn. Đinh Thị Hường (Shidai 0359752313 + Tự Tại Viên 0378682341) là 1 người — anh xác nhận 24/9.
- Mọi thứ Claude tạo ký tên **Monsieur Claude**.
- Repo `Dashboard-Meta` CHỈ ĐỌC tham khảo, tuyệt đối không sửa.
- **Admin / supreme xem HẾT dữ liệu**, chỉ bị chặn ở quyền vào trang / chức năng anh khoá riêng. Phạm vi Sale chỉ áp cho vị trí Sale / Manager.
- **Phạm vi xem theo Sale ĐÃ CHỐT** (gán tay > người tạo đơn Kiot > Pancake, sau luật chuyển đội), lọc SAU khi xác định Sale. Chỗ nào lọc theo tên thô (staff_name Pancake / tên gõ nhập tay) là SAI — dùng `rptSlSaleCuaDon` / `rptSlSaleCuaNhapTay`. Sửa phân quyền xong phải giả lập view từng tài khoản (khách phải thấy vs thực thấy).
- **Commit (từ 25/9):** sửa xong thì tự pull → commit → push, không hỏi. Nhưng TRƯỚC MỖI COMMIT phải chạy `git diff --cached --stat`, chỉ có đúng file mình sửa mới commit (bài học sự cố 25/9).
- **Đổi cấu trúc DB** (thêm cột/bảng, sửa luật): Claude **TỰ CHẠY** rồi báo lại, KHÔNG giao việc cho anh (anh chốt 25/9: "mắc gì tự làm được mà giao việc cho t"). Máy gốc chạy qua Management API (thẻ sbp_ trong supabase-keys.local.txt). Máy nào bị chặn thì mới nhờ anh, và phải nói rõ vì sao. Luôn lưu kèm file supabase-schema-*.sql để còn tra lại.

## 3b. BẢO MẬT (khoá 24/9/2026)

- CSDL CHỈ mở cho người đã đăng nhập app (thẻ phiên JWT, role authenticated). Khoá công khai trong index.html một mình không đọc/ghi được gì (trừ 3 bảng cho dashboard cũ: product_faq, dash_presence, social_page_stats).
- Đăng nhập qua Edge Function `dang-nhap` → tài khoản bóng `<user_id>@mkt-sale.app` trong Supabase Auth (mật khẩu bóng CỐ ĐỊNH = HMAC khoá máy chủ + email, từ 25/9 — trước đó đổi ngẫu nhiên mỗi lần làm đá văng phiên máy khác). Mật khẩu thật vẫn ở sales_user_credentials.
- Hàm quản lý tài khoản kiểm quyền TRONG CSDL (`la_quan_tri()`: Supreme hoặc có quyền settings / *). Tự đăng ký Supabase đã TẮT.
- Edge `pancake-note`, `sync-now` kiểm thẻ (secret BAT_BUOC_PHIEN=1); lịch hẹn giờ gọi sync-now bằng mã `x-cron-key` (secret CRON_KEY, trong hàm goi_sync).
- Job đồng bộ + kiem-so-lieu dùng khoá quản trị → không bị khoá ảnh hưởng.
- Sự cố: chạy `supabase-schema-mo-khoa-khan-cap.sql` + đặt SB_BAT_BUOC_PHIEN=false + BAT_BUOC_PHIEN=0.
- Kiểm thử sau khoá cần tài khoản thử CHỈ trong Supabase Auth (không tạo trong sales_users — sẽ lọt vào danh sách Sale, anh đã nhắc 24/9). Xoá ngay sau khi thử.
- Bài học: viết code qua chuỗi lồng nhau hay mất dấu `\` (đã dính 2 lần: `Bearer\s+`, `KEY:\s*`) → luôn kiểm lại file sau khi ghi.

## 4. CƠ CHẾ TỰ CHẠY (đang sống)

- `sync-datahub-pancake` · `sync-kiot-orders` (có lấy kênh bán) · `sync-kiot-invoices` · `sync-mkt-from-meta` — lịch do pg_cron trên Supabase bắn.
- `scripts/tu-tao-nhap-tay.js` — chạy kèm mỗi lượt sync đơn Kiot: khách LẺ + kênh ONLINE + từ 1/6/2026 + chưa có trong app -> tự tạo dòng Data nhập tay. Xem trước bằng `KHO=1`.
- `moc-so-lieu.yml` — chốt mốc số liệu 00:00 / 08:00 / 16:00 giờ VN. So trước, lệch > 5% thì GIỮ mốc cũ và fail để báo mail.
- `scripts/kiem-so-lieu.js` — chạy trước & sau mỗi lần sửa logic báo cáo.
- `scripts/check-pagination.js` — chạy trong CI của workflow Pancake; đọc bảng phải dùng limit/offset, dùng header Range là fail.

## 5. NHẬT KÝ (mới nhất trước)

- **29/09** — **Rà Sale Sỉ: bù 40 khách / ~2,03 tỷ** bị rơi khỏi báo cáo: job Tự tạo Data nhập tay cắt mốc 1/6/2026 cho cả Sỉ → khách Sỉ chỉ mua trước mốc mà Sale chưa từng nhập (NPP, khách buôn, đại lý: NPP Thảo Nam Nam Định 297,6tr, KB a Đức Anh 253,9tr…) không có hồ sơ. Sửa: Sỉ FULL LỊCH SỬ (dấu vết tiền chỉ đòi với đơn từ 1/6), đã tạo 40 dòng. Sau sửa: 2026 thiếu 0 đơn; 181 đơn Sỉ bị loại từ T6 đều là phiếu tạm chưa trả đồng nào (0 đơn có trả tiền bị loại oan). Còn lại (không bù): 6 đơn 2025 không có mã khách (~232tr, lớn nhất DH000720 157,9tr) + 8 đơn khách nhóm "Khách lẻ" mua tại kho Sỉ trước T6.

- **29/09** — **Báo cáo Sale tính cả ĐƠN MUA LẠI trong kỳ** (anh báo chị Mai Quy chốt DH002671 08/09/2026 21,1tr không có trong báo cáo Sale Sỉ T9 dù Master có): lọc kỳ + tính lại trong kỳ gồm repeatOrds; Tổng quan (doanh thu, Online/Offline, brand, Sale, kênh) = đơn tính + mua lại. MKT không đổi (chỉ r.revenue, mod mkt không xét mua lại). Sỉ T9 363,2 → 384,3tr; toàn thời gian không đổi. Chốt mốc. Anh đã mua **Supabase Pro** (29/9).

- **29/09 chiều** — Log Ingestion (0,94/1 GB): Postgres đã ở mức ghi log tiết kiệm nhất (log_min_duration_statement -1, log_min_messages warning, log_statement ddl) — KHÔNG đặt 200/500 ms (sẽ bật thêm log). App không gọi Supabase liên tục, không cần Realtime. Nguồn log lớn nhất: bước ngày nhắn cuối ghi tới 250 PATCH/lượt (mỗi lệnh 1 dòng log) → gộp thành 1 lệnh qua hàm `cap_nhat_last_chat(jsonb)`. Pro: log 20 GB, egress 250 GB, CSDL 8 GB / 25 USD tháng.

- **29/09 chiều** — **Job chạy khi dữ liệu đổi (dấu vân tay):** hàm CSDL `job_dau_van(ten)` = md5 đúng các cột job đọc; `lib/gianh-moc.js` → `gianhKhiDoi` (trùng dấu thì thoát, vẫn chạy chắc 6 giờ/lần, 2 lượt chồng chỉ 1 lượt chạy). Áp: Tự tạo Chốt đơn Sỉ + Tự tạo Data nhập tay → lại theo nhịp 15 phút; thẻ CHỐT ĐƠN + B3 trong đồng bộ Pancake → theo nhịp 10 phút; ngày nhắn cuối giữ 1 giờ/lần (phụ thuộc tin nhắn bên Pancake). Phân loại SP: **2 lần/ngày 7h–8h + 18h–19h** (anh chốt). Thử: chạy 2 lần liền → lần 2 "dữ liệu không đổi".

- **29/09** — **Supabase báo vượt quota TẢI RA (egress) gói free ~5 GB/tháng** (không phải dung lượng lưu trữ; ân hạn tới 29/10/2026, sau đó có thể bị giới hạn). Thủ phạm chính: job phân loại SP quan tâm (em thêm 28/9) nạp ~18 MB mỗi 15 phút ≈ 1,7 GB/ngày; phụ: tự tạo Chốt đơn Sỉ + tự tạo Data nhập tay mỗi lượt ~3 MB, 15 phút/lần. Sửa: `scripts/lib/gianh-moc.js` (giành lượt theo bảng job_moc) — phân loại SP **1 lần/ngày khung 18h–19h VN** (anh chốt), 2 job kia **1 giờ/lần**. Thêm: 3 bước phụ của đồng bộ Pancake (thẻ CHỐT ĐƠN, B3, ngày nhắn cuối) 1 giờ/lần; mọi upsert hàng loạt ghi rõ return=minimal. Usage 29/9: Egress 6,9/5 GB, Log Ingestion 0,94/1 GB (upcoming). Ước còn ~0,3–0,6 GB/ngày, vẫn trên mức free → chờ anh chọn: nâng Pro (25 USD/tháng, 250 GB) hay em tối ưu tiếp (đọc phần thay đổi thay vì cả bảng).

- **29/09 sáng** — Soát từ 16h 28/9: 0 workflow đỏ (Kiot 89, Pancake 135, chốt mốc 2, crawl chấm 3, Meta 2 lượt). Job tạo đơn chạy đúng 18h 28/9 và 6h 29/9: mỗi lượt 3–4 hội thoại có SĐT, đều đã có đơn Sale → 0 đơn mới. PHÁT HIỆN lượt 18h chạy ĐÔI (2 lượt workflow chồng nhau cùng đọc "chưa chạy") → sửa: giành mốc bằng PATCH có điều kiện `luc < mốc` trên `job_moc`, lượt thua thoát (thử 2 lượt đồng thời: đúng 1 lượt giành được). Việc #23 xong.

- **28/09 15:25** — Form tài khoản (thêm / sửa): chọn vị trí **admin / supreme** là tự bỏ tick + khoá ô Phạm vi dữ liệu, hiện nhãn "Admin xem tất cả" (anh chốt: admin xem hết, chỉ bị chặn ở chức năng anh khoá riêng). Dọn phạm vi cũ của tài khoản Chị Oanh (9 tên, vốn đã bị bỏ qua).

- **28/09 15:10** — **LỖI PHÂN QUYỀN NGHIÊM TRỌNG (đã sửa):** app lọc phạm vi xem theo Sale TRƯỚC khi áp Sale gán tay / người tạo đơn Kiot → khách Pancake không có người phụ trách nhưng đã gán tay (vd L-CT2-0085 "Cáo" → Chánh Tâm Ngọc Diệp) biến mất khỏi view của chính Sale đó. Giả lập view từng tài khoản: 2 tài khoản bị giới hạn (vị trí sale-le): bản cũ sót Vân Ngọc 193/447, Sale Chánh Tâm 190/375 khách; bản mới sót 0 (Master + Nhập Liệu). Tài khoản admin / supreme xem hết (dashScope bỏ qua data_sales) — không bị ảnh hưởng. Sửa: lọc phạm vi ở CUỐI `rptSlBuildMasterRaw`; bảng tra `rptSlSaleTheoMa` (Sale đã chốt theo mã) cho Data Hub, Data nhập tay, phễu Lẻ; đổi tên Sale giờ sửa luôn phạm vi tài khoản + tên trên dòng nhập tay (hàm CSDL `doi_ten_sale`). (Em từng báo nhầm Chị Oanh bị giới hạn: giả lập quên xét vị trí admin — anh chỉnh.)

- **28/09 14:40** — (1) Workflow Pancake đỏ 14h10–14h30: bước kiểm phân trang chặn vì đọc `job_moc` thiếu `limit=1` → sync bị bỏ qua 3 lượt; đã sửa + chạy bù, xanh. (2) Tổng Quan Sỉ: GIỮ thẻ "Doanh thu đã chốt", bấm vào ra popup 2 thẻ **Online / Offline** (anh sửa lại: không tách thẻ trên trang), bấm tiếp ra bảng khách đã chốt riêng + nút Xem tất cả (T9: 141,0tr / 7 khách + 214,5tr / 16 khách = 355,5tr). Lẻ giữ 1 thẻ.

- **28/09 14:30** — Luồng **QC CSKH** tách sang app riêng: thư mục `C:UsersHPDesktopqc-cskh` (sổ việc riêng `qc-cskh/VIEC.md` có đủ bối cảnh + kiến thức; 16 mục bộ nhớ chép sang bộ nhớ thư mục đó). Job chấm `sync-sale-review.yml` VẪN chạy ở repo này cho tới khi app QC chạy song song ổn và anh bảo tắt.

- **28/09 14:20** — **Báo cáo MKT chỉ tính từ 1/6/2026** (anh chốt: ngân sách chỉ có từ T6 nên doanh thu và mọi số khác cũng vậy). `modRange('mkt')` kẹp mốc sớm nhất `RPT_MKT_TU`. "Tất cả": doanh số 2,041 tỷ → 1,783 tỷ (bỏ 257,8tr của 7 đơn trước T6), chi phí không đổi 283,0tr; tháng 9 không đổi.

- **28/09 14:10** — Job tự tạo đơn từ hội thoại: **chỉ chạy 2 lần/ngày 6h và 18h giờ VN** (anh chốt, để Sale tự tạo đơn trước, tránh trùng). Workflow vẫn gọi mỗi 10 phút, script đọc bảng `job_moc` (mới) — lượt đầu tiên sau mỗi mốc mới chạy. Mốc khởi tạo 28/9 chiều → lượt thật đầu tiên 18h 28/9. `CHAY_NGAY=1` để chạy tay.

- **28/09 15:20** — Rà điểm dễ vỡ. SỬA: (1) hồ sơ app đọc theo mã của MỌI đơn Pancake của khách (`rptSlIdsCua`), trước chỉ theo mã đơn đầu -> 36 khách bị ẩn phân loại/Sale/trạng thái (vd L-SD-0117 có hồ sơ ở L-TTV-0362); (2) Lead cũ Sỉ đã chốt thì hiện lại ở Nhập Liệu; (3) job tạo đơn kiểm `recent_orders` trực tiếp trên Pancake, tránh tạo trùng khi Sale vừa tạo đơn trong 10 phút hub chưa đồng bộ. Số liệu không đổi.

- **28/09 15:00** — **Lịch sử chăm sóc Sỉ ghép sai theo TÊN**: lượt CS của khách cũ hiện luôn ở khách trùng tên mới kéo về (L-SD-0070 "Đồ Thờ Phú Quý" mượn 31 lượt + "Đã ra đơn" của M-0128; 3 khách "Thanh Nguyen" chung 3 lượt thật ra của Thành Nguyễn L-SD-1579 SĐT 0369646066). Sửa `rptSlCsRows`: ghép Lead ID → Mã KH → **SĐT** → tên (tên chỉ khi 3 khoá trên không khớp khách nào). Kết quả 2.087 lượt CS: 0 mồ côi, 0 lượt gắn 2 khách. 11 khách hết mượn lịch sử → Lead cũ (đã gán Toàn). 33 khách chùa/đền/miếu: anh chốt giữ theo thẻ gốc (Sỉ). 12 khách Sỉ chưa gán + 15 Lead mới T9: anh tự chia. Số liệu không đổi.

- **28/09 14:30** — **Lọc nhu cầu 1.039 khách Sỉ mới nạp** (Lead cũ + Lead mới, đọc hội thoại): 180 khách nói mua dùng CÁ NHÂN / GIA ĐÌNH ("Tôi muốn thỉnh về an vị tại gia", "mua lẻ", "sử dụng gia đình"…) → đổi thẻ Pancake **KH SỈ → KH LẺ**, trạng thái Lẻ **Lead cũ** (giá trị mới trong danh mục Trạng thái Lẻ), gán **Nguyễn Thảo Ngọc**; không khách nào thuộc T9. Giữ Sỉ: 43 vừa gia đình vừa sỉ (trừ 7 ca đọc ra là lẻ đã chuyển), 482 nói sỉ, 308 không rõ, **33 mua cho chùa/đền/miếu — chờ anh quyết**. Luật mới trong app: (a) **mọi khách Lead cũ (Lẻ + Sỉ) không vào Nhập Liệu** trừ khi đổi trạng thái; (b) **khách chuyển đội** mà đang gán Sale đội kia: tạo từ 1/9/2026 → trống (Gán data), trước 1/9 → Sỉ = Toàn, Lẻ = Thảo Ngọc (tính lúc hiển thị, không ghi DB). Chốt mốc: Lẻ 477 · Sỉ 1.273 khách, doanh thu không đổi.

- **28/09 13:30** — Anh bật job tự tạo đơn (`e0471bb`); lượt đầu 13:20 xanh: 2 hội thoại, 1 khách cũ, 0 khách mới. Gán data Sỉ 67 khách: 52 khách tạo trước 15/8 → **Nguyễn Hữu Toàn**, 41 khách trống phân loại → **Lead cũ** (11 khách Sale đã ghi phân loại giữ nguyên). Phần lớn là khách gốc của 35 đơn trùng (hồ sơ Lead cũ/Toàn trước ghi vào mã đơn em tạo, xoá đơn thì lộ ra). Workflow "Chốt mốc số liệu" đỏ 13:20 (so mốc cũ 12:45, khách Sỉ tháng này 92→86 do xoá đơn rác) → chạy lại trên mốc mới: xanh.

- **28/09 14:00** — (1) **XOÁ HẲN 50 đơn** app tạo lỗi/trùng trên Pancake (49 đơn đã huỷ của lô + đơn thử #1659): Pancake không có API xoá, "Xoá đơn" = PUT status **7 (Đã xoá)**. App (`dhHuy`) + sync (`autoChot`) coi 7 như huỷ. Lô tự tạo còn 223 đơn sống, 0 khách 2 đơn. (2) **Rà 1.014 khách Lead cũ** (đọc hội thoại từng khách): gỡ khỏi báo cáo 24 khách không phải hỏi hàng (bấm QC tuyển dụng "Ứng tuyển", xin CTV, Phong Nguyen rao bán nến, Phương Loan xin việc) — khôi phục được ở mục Đã gỡ; 56 khách chỉ nhắn SĐT vẫn giữ (là lead). 12 khách gửi 2 số: đặt số gửi SAU CÙNG làm SĐT hồ sơ (`si_sdt`), không sửa đơn Pancake của Sale. Bộ lọc rác của job bỏ "chạy quảng cáo" (bắt nhầm khách Lê Minh Quang), chỉ giữ "nhận chạy quảng cáo". Chốt mốc: Sỉ 1.464 khách, doanh thu không đổi.

- **28/09 13:20** — Huỷ thêm **35 đơn tự tạo trùng đơn gốc của Sale** (34 cùng hội thoại: Sale đã tạo đơn từ trước nhưng đơn gốc chưa ghi SĐT nên lượt rà theo số không bắt được; 1 cùng SĐT). Tổng lô 272 đơn: còn **223**, huỷ 49 (7 hội thoại nhiều số, 7 không phải hỏi hàng/trùng, 35 trùng đơn gốc). Khách gửi nhiều số: 3 đơn còn lại đều đã đúng số gửi SAU CÙNG; job tự động giờ lấy số cuối trong tin khách và chỉ ghi 1 số đó. Bài học: trước khi tạo đơn phải kiểm HỘI THOẠI đã có đơn chưa, không chỉ kiểm SĐT (job mới đã có).

- **28/09 13:00** — Rà NỘI DUNG tin nhắn 265 đơn tự tạo (anh: "nội dung k phải hỏi hàng clear hết"): huỷ thêm 7 đơn — 6 không phải khách (#1692 xin việc, #1704 xin làm CTV, #1736 rao làm video, #1742 người rao bán tượng, #1754 Kim Anh = tin rác rao vay 3 số, #1842 cơ sở rao bán nến) + #1748 trùng khách #1679. Khách có đơn thừa đã huỷ (vd Thiên Lâm L-SD-1882) bị app lấy mã theo đơn huỷ -> mất ngày nhắn / Lead cũ / Toàn: đã chép hồ sơ sang mã đơn huỷ (8 mã). Soát lại Master: 0 khách lô này ngày 28/9 sai, 0 trước T9 chưa gán. Lịch sử phát sinh ẩn đơn Pancake đã huỷ. Job `tu-tao-don-hoi-thoai.js` thêm lọc nội dung tin khách (thử trên 265 hội thoại: bắt đúng 6 rác, 0 khách thật). **Workflow chưa bật**: bước job đã thêm vào `sync-datahub.yml` trên máy nhưng Claude bị chặn commit — anh tự `git add .github/workflows/sync-datahub.yml; git commit; git push`.

- **28/09 chiều** — (1) **Tạo 264 đơn Pancake** (shop Shidai, page FB Thời Đại) cho khách chỉ có hội thoại để SĐT, gắn KH SỈ, không nhắn khách; huỷ 7 đơn thừa do 1 hội thoại có 2–3 SĐT (script tạo mỗi số 1 đơn — lượt sau đã chặn bằng nhật ký). 265 khách (kể cả #1660) → phân loại **Lead mới**, chưa gán Sale (tab Gán data). Việc #18 coi như xong phần tạo đơn; còn job tự tạo đơn cho hội thoại mới về sau. (2) **Gộp theo tên** trong Master chỉ khi nhóm có tối đa 1 khách có SĐT — 265 khách mới tên phổ biến bị gộp nhầm; tách luôn 30 ca cũ cùng tên khác số (vd "Thành Nguyễn" 6 lead 5 số). Đinh Thị Hường (anh xác nhận 24/9) giữ bằng `gop_vao`. (3) **Sản phẩm quan tâm** (Sỉ): cột DB + ô trong hồ sơ + bộ lọc Master; job `phan-loai-sp-quan-tam.js` chạy sau sync Kiot: phiếu mua (nến 10–90% tiền hàng = Hỗn hợp) → QC/page (QC có chữ "nến", page Tự Tại Viên = Nến) → hội thoại Pancake (QC/bài khách bấm + câu khách hỏi) → page = Đồ thờ. Kết quả 1.492 khách: Đồ thờ 1.096 · Nến 315 · Hỗn hợp 32 · chưa rõ 49. Chốt mốc số liệu: Sỉ 1.492 khách, doanh thu không đổi. (4) 265 khách trên: **ngày tạo = ngày khách nhắn đầu tiên** (cột `ngay_tao_sua`, anh chốt) — chỉ 5 khách thuộc T9, khách Sỉ tháng này 318 → 92. Job tự tạo đơn về sau cũng phải ghi `ngay_tao_sua`. (5) 260 khách nhắn trước T9 trong số đó → **Lead cũ + Nguyễn Hữu Toàn** (anh chốt cả 2, sau 1 lần đổi ý), 5 khách T9 giữ Lead mới, chưa gán.

- **28/09 12:10** — (1) Bộ lọc trạng thái Master Sỉ lọc theo Phân loại KH (có Lead cũ), bỏ "Chốt đơn" lặp. (2) **Trùng SĐT tự gộp hết** (anh chốt): Master gộp theo MỌI SĐT của khách, không chỉ số đầu; Nghi trùng hiện 0 nhóm, số liệu không đổi. (3) Khách hội thoại Sỉ trùng khách cũ: KHÔNG tạo mới, KHÔNG dán Mã KH (64 ca chỉ trùng Kiot để nguyên); rà 1.123 SĐT trùng khách có đơn Pancake → chỉ 1 thiếu thẻ, đã gắn KH LẺ (Namtrantran Namtran, shop Nến Bơ). (4) Lô tạo đơn: **271 đơn, toàn page FB Thời Đại** (bỏ 4 số chỉ có Zalo; 1 số dính 3 tài khoản FB gộp 1 đơn) — vẫn chờ anh chạy trong terminal.

- **28/09 11:45** — Nhập Liệu Sỉ: khách phân loại **"Lead cũ"** (795) không tính vào "Chưa cập nhật lịch sử chăm sóc" và "Khách tiềm năng chưa có giá trị dự kiến" (anh chốt). Đã chốt mốc số liệu mới sau đợt kéo đơn cũ Shidai (885/885 đơn cũ đã có ngày nhắn cuối): Sỉ 1.211 khách, MKT Sỉ T9 141,0tr, tổng doanh thu không đổi. Tra cùng người qua FB giữa các page: anh bảo thôi, không cần làm.

- **28/09** — 795 khách Sỉ vừa kéo từ đơn cũ Shidai (đều tạo trước 1/9/2026): phân loại **"Lead cũ"** (thêm giá trị mới vào danh mục Phân loại KH, xếp sau "Lead mới") + Sale phụ trách **Nguyễn Hữu Toàn** (anh chốt). Master Sỉ: Toàn 840 · Minh Oanh 313 · Huế 40 · Sale Kiot 1 · trống 17 (8 khách trống tạo trước T9 thuộc nhóm cũ, chưa gán).

- **28/09** — Gán Sale cho 26 khách Lẻ chưa có Sale theo brand (anh chốt): Tự Tại Viên + Hiền Thủy → Vân Ngọc (14) · Chánh Tâm → Chánh Tâm Ngọc Diệp (12). Lẻ hết khách chưa gán (xoá việc #15).

- **28/09 trưa** — (1) Kéo đơn cũ shop Shidai vào hub (chỉ khách thẻ KH SỈ, từ 4/2025): Master Sỉ 415 → 1.211 khách, tổng doanh thu không đổi; MKT Sỉ T9 162,2 → 141,0tr vì Mai Quy (nhắn FB cuối 15/09/2025, mua lại 08/09/2026 21,1tr) nay thấy đơn Pancake cũ → xếp mua lại, đúng luật. Job cập nhật ngày nhắn cuối cho cả đơn cũ Shidai. Mốc số liệu đã chốt lại 11:45. (2) Đã tạo thử đơn Pancake thật #1660 (Tạ Văn Chinh) nối hội thoại + gắn KH SỈ, không nhắn khách. Lô 270 khách chỉ có hội thoại FB chờ anh chạy script (auto mode chặn tạo đơn hàng loạt). (3) Gộp khách: Mã KH đi theo cả nhóm (ca Bao An). Nghi trùng: CHỈ theo SĐT. (4) 87 khách Lẻ chưa điền trạng thái, tạo trước 1/9/2026 → **Mất lead** (anh chốt); còn 16 khách từ T9 chưa trạng thái.

- **28/09 — GẮN THẺ KH SỈ CHO SHOP SHIDAI (anh chốt):** kéo toàn bộ đơn shop Shidai `1943052948` trên Pancake (1.654 đơn từ 18/04/2025, 1.636 khách). Trước: 241 KH SỈ · 532 KH LẺ · 863 chưa thẻ. Gắn **KH SỈ cho cả 863 khách chưa thẻ** (PUT `/shops/{id}/customers/{cid}`, logAct từng khách, không khách nào vướng KH LẺ ở shop khác cùng SĐT). Sau: 1.104 KH SỈ · 532 KH LẺ · 0 chưa thẻ. **532 khách Shidai đang KH LẺ: anh bảo GIỮ NGUYÊN.** Thử TẠO ĐƠN Pancake (cho khách chỉ có hội thoại) bị chế độ an toàn của Claude Code chặn — cần anh cho phép rồi mới thử.

- **28/09 — ĐỔI NGUỒN OFFLINE → ONLINE (anh chốt):** trước T6 chưa có đơn Pancake nên xét theo SĐT: khách Sale ghi Offline mà SĐT có trong hội thoại Pancake (Facebook/TikTok, nhắn TRƯỚC hoặc cùng lúc Sale ghi nhận) = MKT kéo về → Online. Tra 145 data Offline trên 14 kênh (API `pages/{id}/conversations/search?q=SĐT`): 17 khớp, đổi **14** (11 Thời Đại, 1 Hiền Thủy FB, 1 Nến Bơ, …), kênh = page khách nhắn, brand theo kênh, `si_sheet.nguon` đổi theo, ghi note "Nguồn Pancake" + logAct từng khách → nhãn "Online · Pancake". KHÔNG đổi: khách chỉ khớp Zalo cá nhân (công Sale, vd NPP CHÍN LÊ, KB Chị Hương Lào Cai) và ĐỨC TÂM AN (nhắn Pancake sau ~2 năm). kiem-so-lieu: tổng doanh thu, MKT tháng 9 không đổi. Bộ lọc "có SĐT" của Pancake web chưa dò ra tham số API.

- **28/09 (máy gốc, tiếp)** — Nhập Liệu: bấm ô Mã KH hiện sẵn mã gợi ý theo SĐT để chọn. MKT: popup "Khách từ quảng cáo" kèm phiếu mua + mặt hàng. Nhãn nguồn: khách có đơn Pancake luôn ra "Pancake" (dù dòng giữ là nhập tay). Khảo sát #18 lưu ở dòng 18-KS. Soát lệch MKT vs Ads Manager: xem việc #19.

- **28/09 (máy gốc)** — Sửa workflow đỏ: (1) Kiot đỏ 07:35 do bước "Tự tạo Chốt đơn Sỉ" gặp Supabase "Gateway Timeout" khi đọc `salesi_crm`; Pancake đỏ 27/9 do "fetch failed" shop HT. Thêm THỬ LẠI cho mọi lượt ĐỌC (GET) trong `sync-datahub-pancake.js`, `tu-tao-chot-don-si.js`, `tu-tao-nhap-tay.js` (dùng `lib/fetch-lai.js`); lượt ghi không thử lại để khỏi sinh dòng trùng. (2) "Chốt mốc số liệu" đỏ 3/3 lượt từ 27/9: mốc kẹt ở 25/9 20:16, lệch vì luật 27/9 (đơn Pancake có SĐT vào báo cáo) + đơn mới cuối tuần → chốt mốc mới. Số #18c: Lẻ tất cả khách 199 → 300 (+101, doanh thu Lẻ không đổi 1.123 tỷ, số khách chốt không đổi 158); Lẻ tháng này 48 → 63 khách; Sỉ tất cả 412 → 415 khách, doanh thu +51tr (đơn mới 26–27/9); MKT Sỉ 121 → 162tr.

- **27/09 (máy phụ)** — Đổi luật đơn Pancake vào báo cáo Sale (`d602e1c`): đơn có SĐT là vào luôn cả Sỉ lẫn Lẻ, không cần thẻ. Đơn không thẻ KH LẺ/KH SỈ: lấy thẻ ở đơn khác cùng SĐT; không có thì Shidai → Sỉ, còn lại → Lẻ. Máy phụ không đọc được DB nên chưa đo được số khách thay đổi (việc #18c). Trước đó: popup Sửa Sỉ ẩn ô không sửa được; Ngày chăm sóc / Nội dung trao đổi của Sỉ lấy từ lượt chăm sóc gần nhất; Nhóm KH thành ô chọn 3 giá trị.

- **25/09 chiều (máy gốc)** — (1) Job Kiot đỏ 11:21 (mail báo lỗi): "ON CONFLICT DO UPDATE ... row a second time" — kéo theo trang, đơn mới sinh ra làm 1 đơn nằm 2 trang → lô ghi có 2 dòng trùng. Sửa: `scripts/lib/khu-trung.js` gọi trước mọi upsert ở cả 4 script đồng bộ. (2) Kiểm hậu quả sự cố 64 file: khung 08:30–10:20 Pancake 9/9, Kiot 6/6 lượt xanh, 5 workflow active, số liệu không hụt; máy gốc git sạch. Commit sự cố `3e1e471` để lại ĐÚNG 1 file index.html → dấu hiệu bảng theo dõi file của git trên máy kia bị làm trống (`git rm -r --cached .` hoặc chép repo thiếu .git) rồi chỉ add index.html; máy kia chạy `git reflog` sẽ rõ. (3) Code xong "Nghi trùng khách" ở tab Nhập Liệu (Lẻ 2 nhóm, Sỉ 1 nhóm) + bước 4 gộp tay trong Master (giả lập hợp nhất: doanh thu không đổi). (4) Đổi thẻ Pancake KH LẺ→KH SỈ cho 2 khách buôn (KH007485, KH007517), gộp đúng vào hồ sơ Sỉ sẵn có.
- **25/09 ~10:00 — SỰ CỐ + KHÔI PHỤC**: commit `3e1e471` làm GitHub mất 64 file (xem mục 2 việc #2). Đã khôi phục ở `6d2838c`, nội dung giống hệt bản trước sự cố. Cũng phiên này: Claude thử kết nối thẳng vào DB để thêm cột thì bị hệ thống chặn; lệnh che giá trị khi soát file key bị sót, làm lộ mật khẩu DB trong hội thoại (việc #3). Việc Gộp khách trùng chưa code dòng nào, chờ anh chạy SQL (việc #1).

- **25/09 sáng** — Master Sỉ: nút **Sửa** mở popup hồ sơ, có bút chì ✏️ ở từng ô sửa được (khách Pancake không sửa tên/nguồn/kênh vì job đồng bộ ghi đè). Phân loại Sỉ thêm **"Lead mới"** (không gắn thẻ Pancake). Master Sỉ thêm cột **SĐT** và cột **Nguồn** (Online · Pancake / Online · Nhập tay / Offline), bỏ cột Nội dung CS cuối. Ô trống hiện **"—"**, không còn chữ "chưa gán / chưa có / chưa cập nhật"; chữ giữ chỗ trong sheet cũ ("Chưa khai thác"…) coi như trống. Sửa lỗi ô tìm kiếm mất con trỏ sau mỗi ký tự. Form Thêm khách Sỉ: 6 ô bắt buộc (sao đỏ). Nhân sự Sale: thêm xong vẽ lại đúng trang Phân quyền, chặn thêm trùng tên, dropdown tự tải lại sau 60 giây. **Tên Sale từ Pancake/Kiot tự quy về tên ở Phân quyền** (`rptSlKhopNhanSu`, vd "Nguyễn Vân Ngọc" → "Vân Ngọc"; khớp 2 người trở lên thì giữ tên gốc).

- **24/09 tối — KHOÁ BẢO MẬT**: trước khoá 23 chỗ hở (người lạ đọc mọi bảng, xoá dữ liệu, tạo tài khoản, đổi mật khẩu, khôi phục sao lưu) → sau khoá 0. App, job đồng bộ, số liệu y nguyên. Mọi người phải đăng nhập lại app 1 lần.
- **24/09 rà toàn bộ** — 15 trang/tab + 120 popup vẽ sạch (0 lỗi JS, 0 undefined/NaN); 6 job GitHub Actions xanh hết; 0 đơn đếm 2 lần, 0 trùng Lead ID, 2.005 lượt chăm sóc 0 mồ côi. SỬA: 3 đơn chi nhánh Sỉ (4.548.000đ) bị tính cả ở Lẻ → Lẻ gạt; bảng saleretail_manual thiếu quyền xoá → nút Xoá khách để lại hồ sơ rác (đã thêm quyền + dọn). Gán data Sỉ thành thanh thao tác hàng loạt kiểu Pancake. Data Hub bỏ tab Nhân sự Sale (chỉ còn ở Phân quyền).
- **24/09 khuya** — Rà lại toàn bộ sheet 1.MASTER DATA SỈ: 389/389 dòng đều có khách trong app (4 "chưa có" hôm trước là do script nạp ghi chú dò thiếu khách Pancake). Bù hồ sơ cho 160 khách (chủ yếu khách Pancake L-SD-…): người đại diện 158 · phân loại 149 · tỉnh 147 · mô hình 139 · nhóm KH 4 · diện tích 3 · ghi chú riêng 2; chỉ bù ô trống, không ghi đè; rà lại còn 0 ô thiếu (`scripts/bu-truong-master-si-once.js`). Tổng hợp: Top 10 khách theo doanh số. Master Lẻ bỏ nhãn Chi tiết. Nút Cho nghỉ hỏi xác nhận.
- **24/09 tối** — Gộp 4 cặp dòng Data nhập tay trùng người (xoá M-0053, M-0054, M-0015, M-0340 sau khi chuyển 4 lượt chăm sóc + 9 trường hồ sơ sang dòng giữ); nhập tay 381 → 377, doanh thu và số khách không đổi, 2.005 lượt chăm sóc 0 mồ côi. Ca Thuỳ Trâm: mã KH007352 ĐÚNG (SĐT M-0019 = SĐT KH007352 bên Kiot, đơn DH002098 có trả 7,59tr + hoá đơn HD057808) — Kiot chỉ đặt tên khách theo "Anh Tân".
- **24/09 chiều-tối** — Deploy pancake-note v6 (gắn thẻ TIỀM NĂNG). Master/CRM Sỉ bỏ hết dash cũ, gỡ hẳn tab CRM Sỉ (2.005 lượt đã nối hết vào khách, 0 mồ côi). Popup hồ sơ khách Sỉ 3 tab; tab Ghi chú riêng nạp 94 khách từ sheet 1.MASTER DATA SỈ (7 cột si_gc_*). salesi_crm thêm phan_hoi/trang_thai/ma_don. Master Sỉ 5 dash (Tổng khách bấm ra Online/Offline · Đã chốt · Đang chăm · Lâu chưa chăm >10 ngày · Chưa cập nhật trạng thái). Tab lên ngang tiêu đề ở mọi báo cáo. Nút Xoá chuyển vào form Sửa (Data nhập tay có form Sửa mới). Thu hồi data cho Admin. Top khách tiềm năng ở Tổng hợp rút về 10 dòng. Siết luật Online vào Master Sỉ (chưa rơi khách nào).
- **24/09** — Gộp khách trùng ở Master Sỉ/Lẻ: ngoài Mã KH giờ gộp thêm theo SĐT (9 số cuối) và tên bỏ dấu; Sỉ 571 → 410 khách, hết trùng SĐT/tên, doanh thu không đổi. Bộ kiểm số liệu nay cộng cả đơn mua lại cho khớp bảng trong app. Master Sỉ thêm nút Thêm khách mới; nhân sự Sỉ chỉ còn Toàn và Huế (19 khách của 7 người kia chuyển về botsale sỉ). Phân quyền rút gọn 2 cột Phạm vi/Quyền. Thêm tab Gán data bên Sỉ.
- **23/09** — Kiot raw data: đổi tên tab, bỏ đơn huỷ + 640 phiếu tạm không cọc. Data Hub thêm mục Kho dữ liệu (dung lượng DB). Tab nhập tay lọc từ T6. Sửa lỗi nick quản lý hụt 40 khách Sỉ / 477tr (khách chưa gán Sale bị giấu) + vòng lặp vô hạn `dashCan` ↔ `dashCanViewAs`. Phân loại Sỉ/Lẻ theo chi nhánh (347 khách trước đây không xếp được). Nạp nốt 159 dòng sheet Master Sỉ (giờ 386/386). Brand Sỉ mặc định Shidai. Dựng lại dash Master/CRM (4 dash/hàng). CRM Sỉ mặc định lọc 3 ngày. Suy Ad ID theo SĐT. Tăng tốc tải trang (2.803 ms → 1.075 ms). Sửa workflow Pancake fail hàng loạt do bộ chặn phân trang.
- **22/09** — Sửa tận gốc lỗi báo cáo Sỉ trắng tinh (trùng id `rptSlBody`). Dựng lại Master/CRM Sỉ theo khung sheet. Bộ kiểm số liệu. MKT tách 2 tab.

---

## 6. ĐỂ DÀNH — kéo full hoá đơn Kiot (khảo sát 23/09/2026)

Anh hỏi "sao mọi lượt tải lại nặng lên, tưởng chỉ nặng khi xem Kiot raw data" — anh đúng, và đây là số đo để sau này khỏi đo lại.

**Hiện trạng:** Kiot có **69.823 hoá đơn** từ 2021, app mới lưu **2.516** (từ 1/6/2026). Đơn đặt hàng thì đã đủ: 3.029 (API báo 3.076, còn lệch 47 chưa soi).

**Hai con số đừng lẫn:**
- Lưu trong database: thêm ~**110–120 MB** (đang dùng 44,7/500 MB) → không đáng lo.
- Tải về trình duyệt: `kiotLoadInvoices()` đang kéo **TOÀN BỘ** hoá đơn mỗi khi mở Báo cáo Lẻ / Sỉ / Tổng hợp / Data Hub, không riêng tab raw data. Vì doanh thu Sale có bù **hoá đơn bán thẳng** (hoá đơn không gắn đơn đặt hàng) — chiếm **78%** số hoá đơn nên lọc theo loại không nhẹ đi mấy.

**Ước payload khi có đủ 70k hoá đơn:**

| Cách tải | Mỗi lượt mở báo cáo |
|---|---|
| Giữ nguyên hiện tại (10 cột, mọi hoá đơn) | 18,0 MB |
| Chỉ hoá đơn bán thẳng, 4 cột | 6,0 MB |
| Thêm chặn theo kỳ đang lọc | dưới 1 MB |

**Thứ tự làm khi anh bật đèn xanh:** sửa cách tải (chặn theo kỳ + chỉ cột cần) → đo lại tốc độ → rồi mới bật job kéo full. Kéo về trước rồi mới tối ưu là tự làm chậm app của mình. Riêng Sỉ tính full lịch sử nên khi lọc "tất cả thời gian" vẫn phải kéo nhiều — chỗ đó để tải theo yêu cầu (bấm mới tải).
