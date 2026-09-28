# SỔ VIỆC — app MKT/SALE

> Sổ này thay cho việc đọc lại hội thoại cũ. **Claude phải mở file này đầu mỗi phiên làm việc.**
> Xong việc nào thì xoá khỏi mục ĐANG NỢ và ghi 1 dòng vào NHẬT KÝ (gộp lại khi quá dài).
> **Anh đã quyết rồi thì LÀM, đừng xếp lại vào mục "chờ anh quyết" để hỏi lại** (mắc lỗi này 23/9 với việc tự tạo data nhập tay).
> Cập nhật lần cuối: 28/09/2026.

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

| 18 | **[28/9 ĐÃ XONG: (a) 0935323289 = "Hà Ngân" đơn #1658 Shidai 27/9, đã hiện ở Master Sỉ L-SD-1658, nằm Gán data · (c) số trước-sau đã đo, xem nhật ký 28/9 · nhãn nguồn khách gộp nhập tay + đơn Pancake ra "Pancake". CÒN: (b) kéo hội thoại có SĐT — xem dòng 18-KS, chờ anh chọn phạm vi. Đổi nguồn Offline→Online: ĐÃ LÀM 28/9 (14 khách, xem nhật ký)]** KHÁCH ĐỂ SĐT TRONG HỘI THOẠI PANCAKE MÀ CHƯA CÓ ĐƠN → KHÔNG VÀO APP (anh chốt 27/9: "Pancake có SĐT thì tự động đẩy vào báo cáo"). Ca thật: Sale Sỉ báo khách **0935323289** hỏi hàng, tìm trên Pancake thấy SĐT nhưng tìm mọi báo cáo trong app không ra. Nguyên nhân khả năng cao: `sync-datahub-pancake.js` chỉ kéo **ĐƠN POS** (`/shops/{id}/orders`), còn khách mới nhắn tin để lại số mà Sale chưa tạo đơn thì không có trong `datahub_orders`. (Không phải do đồng bộ bỏ sót: mỗi lượt kéo 500 đơn mới nhất mỗi shop, 00:05 UTC quét lại toàn bộ.) Phần báo cáo đã sửa ở máy phụ 27/9 (`d602e1c`): đơn có SĐT là vào báo cáo, không cần thẻ | Máy gốc làm: **(a)** tra DB xem 0935323289 có trong `datahub_orders` không (cột `phone`, cả `internal_note`). Có thì mở app xem giờ đã hiện chưa. **(b)** Không có → viết job kéo **hội thoại Pancake có SĐT** (API pages.fm, cần page access token của từng page; SĐT khách để lại nằm ở `recent_phone_numbers` / customer của hội thoại). Lưu vào hub (khoá: page + psid, tên, SĐT, thẻ hội thoại, ngày nhắn đầu / cuối, ad_id nếu có, link mở hội thoại). **Anh chốt 27/9: KHÔNG đưa thẳng vào Master.** Đưa vào **tab Nhập Liệu, mục CẢNH BÁO ĐỎ** (`rptSlInputSec` màu `var(--red)`, luôn mở, giống mục "Đã chốt đơn nhưng CHƯA có Mã KH"), tiêu đề **"Có SĐT nhưng chưa gắn thẻ và tạo đơn hàng trên Pancake"**. Mỗi dòng: ngày nhắn · page/kênh · tên khách (bấm mở thẳng hội thoại Pancake) · SĐT · Sale phụ trách hội thoại (nếu có). Việc của Sale là vào Pancake gắn thẻ KH SỈ / KH LẺ và tạo đơn → lượt đồng bộ sau đơn POS về hub, khách tự vào Master theo luật mục 3, dòng tự biến khỏi mục cảnh báo. Để biết hội thoại nào "đã có đơn" thì so SĐT (9 số cuối) và psid/conversation_id với `datahub_orders`. Mục này **CÓ tính vào "Tổng việc cần làm"** và số đỏ trên nút Nhập Liệu. Chia theo Sỉ/Lẻ đúng luật mục 3: thẻ hội thoại có KH SỈ / KH LẺ thì theo thẻ, không có thì page Shidai → mục Nhập Liệu bên Sỉ, còn lại → bên Lẻ. Việc này thay cho mục "Tăng tỉ lệ có SĐT của Pancake" trước để chờ anh quyết, và cũng giúp nối Ad ID theo SĐT (hiện chỉ 19% đơn có SĐT).
**Bổ sung 27/9 — KÉO TỪ TRƯỚC TỚI GIỜ, KHÔNG CẮT 1/6:** khách 0935323289 nhắn page Shidai từ **tháng 3/2026**, mà Pancake mới bắt đầu gắn thẻ từ **tháng 6**. Nên với **page Shidai** phải kéo **TOÀN BỘ lịch sử** (bỏ mốc `MIN_ORDER_DATE = '2026-06-01'`, khớp luật "Sỉ lấy full lịch sử" ở mục 3), cả **hội thoại có SĐT** lẫn **đơn POS** của shop Shidai `1943052948`. Các page Lẻ giữ mốc 1/6 như cũ, trừ khi anh nói khác. **Luật: cứ có SĐT là đẩy vào mục cảnh báo đỏ ở Nhập Liệu**, không cần thẻ, để Sale gắn thẻ bù sau. Mục cảnh báo gồm 2 loại: (1) hội thoại có SĐT nhưng chưa có đơn POS; (2) đơn POS có SĐT nhưng chưa có thẻ KH SỈ / KH LẺ. Loại (2) vẫn vào Master theo luật 27/9, mục cảnh báo chỉ để nhắc gắn thẻ. Gắn thẻ xong thì dòng tự biến khỏi mục. Lần đầu kéo full lịch sử Shidai: đếm số hội thoại / đơn mới vào rồi báo anh, vì mục Nhập Liệu có thể tăng vọt.
**Bổ sung 27/9 — CLAUDE TỰ XỬ LÝ HẾT, KHÔNG ĐỂ SALE LÀM TAY:** mọi ca có SĐT mà chưa gắn thẻ / chưa có đơn thì **job tự làm trên Pancake**:
- (1) Hội thoại có SĐT mà chưa có đơn POS → **tự tạo đơn POS** trên đúng shop của page đó (`POST /shops/{id}/orders`): tên, SĐT, page/hội thoại khách nhắn, ad_id nếu có, ghi chú nội bộ "Tạo tự động từ hội thoại có SĐT — app MKT/Sale". Đơn để trạng thái Mới, không có sản phẩm / tiền.
- (2) Chưa có thẻ KH SỈ / KH LẺ → **tự gắn thẻ theo page**: page Shidai → **KH SỈ**, các page khác → **KH LẺ**. Khách đã có thẻ ở đơn khác (trùng SĐT) thì theo thẻ đó. Dùng lại cách gắn thẻ đang có trong Edge `pancake-note` / `sync-datahub-pancake.js`.
- Chạy kèm mỗi lượt đồng bộ Pancake, giống `scripts/tu-tao-nhap-tay.js`. Có chế độ **xem trước (`KHO=1`)**: chỉ liệt kê sẽ tạo bao nhiêu đơn, gắn bao nhiêu thẻ, không ghi gì. **Lần chạy thật đầu tiên phải chạy xem trước, báo số cho anh rồi mới bật**, nhất là đợt kéo full lịch sử Shidai (có thể vài trăm đến vài nghìn khách).
- **Không tạo trùng:** trước khi tạo đơn phải so SĐT (9 số cuối) + psid / conversation_id với `datahub_orders`. Ghi lại mọi đơn và thẻ đã tạo vào 1 bảng nhật ký (hội thoại → đơn đã tạo, lúc nào) để lượt sau không làm lại. SĐT phải là số VN hợp lệ (10 số, đầu 0), không lấy số rác trong tin nhắn.
- Mục cảnh báo đỏ ở Nhập Liệu **giờ chỉ còn các ca job tự xử lý HỎNG** (Pancake từ chối tạo đơn / gắn thẻ, SĐT không hợp lệ, 1 SĐT dính nhiều hội thoại khác người…), ghi rõ lý do và có nút Thử lại. Ca tự xử lý xong thì không hiện ở đây, chỉ ghi nhật ký.
- **RÀ TRÙNG 1 LƯỢT SAU KHI KÉO FULL LỊCH SỬ SHIDAI (anh dặn 27/9):** kéo cả khách trước T6 về thì sẽ có nhiều số là **khách cũ đã có trong app**. Phải rà hết 1 lượt trước khi tạo đơn / gắn thẻ, số nào trùng thì **nối vào khách cũ**, không đẻ khách mới:
  - So 9 số cuối SĐT với **mọi nguồn khách đang có**: đơn POS `datahub_orders` (mọi shop, cả đơn cũ), Data nhập tay `datahub_manual`, hồ sơ Sỉ `saleretail_manual` (`si_sdt`, SĐT trong `si_sheet`), lịch sử chăm sóc `salesi_crm`, SĐT gom thêm từ ghi chú Pancake.
  - Trùng khách cũ **đã có đơn POS** → không tạo đơn mới. Chỉ gắn thẻ bù nếu thiếu, và gắn hội thoại vào đúng khách đó (1 khách nhiều nguồn, hiện nhãn "N nguồn" như luật mục 3).
  - Trùng khách **Data nhập tay / hồ sơ Sỉ** (chưa có đơn POS) → vẫn tạo đơn Pancake để có thẻ, nhưng trong app phải **gộp về đúng hồ sơ cũ**: giữ Lead ID, Sale phụ trách, phân loại, lịch sử chăm sóc cũ; dùng bước gộp theo SĐT sẵn có, không đủ thì ghi `gop_vao`.
  - Trùng khách **bên Kiot** (chỉ khớp SĐT): theo luật 22/9, SĐT không đủ để nối doanh thu → đưa vào gợi ý Mã KH ở Nhập Liệu. **Đếm số ca rồi báo anh**, anh cho thì mới tự dán Mã KH hàng loạt.
  - 1 SĐT khớp **2 khách cũ trở lên** → không tự nối, đưa vào mục "Nghi trùng khách" ở Nhập Liệu để Sale chọn.
  - **ĐỔI NGUỒN OFFLINE → ONLINE · PANCAKE (anh chốt 27/9):** đội Sale điền nhiều khách vào Google Sheet với nguồn **Offline (tự kiếm)**, nhưng thật ra khách đến từ Pancake. Số nào từ Pancake nối ra trùng khách cũ đang ghi **Offline** thì **đổi hết thành Online, nguồn Pancake**. Cụ thể:
    - Sửa tận gốc dữ liệu, không chỉ đổi hiển thị: `datahub_manual.nguon` = 'Online' và `kenh` = page Pancake khách nhắn. Hồ sơ Sỉ (`saleretail_manual.si_sheet.nguon`) cũng đổi theo. Ghi `logAct` từng khách (cũ → mới) để tra lại được.
    - Trên app, cột Nguồn của khách đó phải ra **"Online · Pancake"**. Khách gộp từ dòng nhập tay + đơn Pancake mà dòng giữ là dòng nhập tay thì hiện đang ra "Online · Nhập tay" (`rptSiNguonChip` xét `r.isManual`). Sửa: khách có đơn Pancake (`r.orders.length>0` sau gộp) thì ra "Online · Pancake".
    - **Kéo theo số liệu MKT:** MKT chỉ tính Sỉ **Online**, nên đổi Offline → Online thì doanh thu của các khách này nhảy sang MKT (brand Shidai). Chốt mốc số liệu (`moc-so-lieu`) sẽ thấy lệch và có thể fail vì quá 5%. Trước khi đổi thì đếm số khách + tổng doanh thu bị chuyển rồi **báo anh con số**, đổi xong thì chốt lại mốc.
  - **CHỈ SỐ CHƯA CÓ TRONG APP mới đi tiếp** (anh chốt 27/9): số nào đã khớp khách cũ ở bất kỳ nguồn nào ở trên thì chỉ nối vào khách cũ, **không vào Nhập Liệu, không tạo đơn / gắn thẻ mới cho nó**. Chỉ số hoàn toàn mới mới được job tự tạo đơn + gắn thẻ, và nếu tự xử lý hỏng thì mới hiện ở mục cảnh báo đỏ Nhập Liệu.
  - Rà xong **báo anh con số**: bao nhiêu SĐT kéo về · bao nhiêu nối vào khách cũ (theo từng nguồn) · bao nhiêu khách mới thật · bao nhiêu ca phải chờ người chọn. Chạy `kiem-so-lieu.js` trước và sau: tổng doanh thu **không được đổi** vì nối khách cũ (đơn Kiot lọc trùng theo mã đơn).
- Tạo đơn thật trên Pancake là thao tác ra ngoài, khó gỡ (Sale nhìn thấy ngay). Nếu Pancake không có API tạo đơn cho hội thoại, hoặc tạo được mà lệch luồng Sale (vd tự bắn tin nhắn cho khách, tự đổi Sale phụ trách) thì **dừng lại báo anh**, không chạy đại. **(c)** Sau khi đổi luật 27/9, chạy `kiem-so-lieu.js` và đếm số khách Master Sỉ / Lẻ trước-sau để báo anh: bao nhiêu khách mới vào, và bao nhiêu khách Shidai chuyển từ Lẻ sang Sỉ |
| 18-KS | **KẾT QUẢ KHẢO SÁT #18 (28/9, máy gốc, CHƯA GHI GÌ — anh bảo lưu tạm để đó)**. Anh chốt 28/9: Sỉ cào về mọi khách có SĐT mà chưa có thẻ và SĐT không trùng khách cũ → gắn hết **"Lead mới"** (tạo trong app, chưa gán Sale). Pancake có 3 kênh Sỉ: FB **Thời Đại** `506247572578559` (22.392 hội thoại, xa nhất 13/01/2025, 1.405 có SĐT) · Zalo **Tổng Kho Sỉ Shidai** `pzl_421283811192749346` (2.801 · 8 có SĐT) · Zalo **Oanh Bùi Tổng Kho Sỉ** `pzl_636053762312360623` (384 · 28). API đọc: `pancake.vn/api/v1/pages/{id}/conversations` (token PANCAKE_SESSION_TOKEN, phân trang `current_count` + `last_conversation_id`, SĐT ở `recent_phone_numbers`). **1.430 SĐT khác nhau:** 301 trùng khách đã có trong app (đơn Pancake 256 · nhập tay 200 · lịch sử chăm sóc 215 · hồ sơ Sỉ 1) → nối vào khách cũ · 64 chỉ trùng khách Kiot → gợi ý Mã KH · **1.065 mới hoàn toàn** (1.061 FB Thời Đại, 4 Zalo; 1.048 số nhắn TRƯỚC 6/2026, chỉ 42 số từ 6/2026; 6 số đã có thẻ KH SỈ/KH LẺ; 8 số dính nhiều người → để người chọn). Tạo hết thì Master Sỉ 415 → ~1.500. **Chờ anh chọn: (a) tạo hết 1.065 · (b) chỉ khách nhắn từ 1/6/2026 (42) · hoặc mốc khác.** Script khảo sát ở scratchpad phiên 28/9 (`pcsi_keo.js`, `pcsi_dem.js`) — dữ liệu có SĐT khách nên KHÔNG đưa vào repo, lần sau kéo lại (~10 phút) | anh chọn phạm vi rồi mới tạo |
| 17 | **Nguyễn Thuỳ Trâm** (L-HT-0296) mã KH002561 không có đơn; đơn thật nghi là DH002098 dưới mã KH007352 "KL Anh Tân" (M-0019) | Sale xác nhận rồi sửa ghi chú Pancake |
| 3 | **Mật khẩu DB bị lộ trong hội thoại 25/9.** Lúc soát file `supabase-keys.local.txt`, lệnh che giá trị bị sót dòng `DB_PASSWORD` nên mật khẩu hiện nguyên văn trong kết quả lệnh của phiên Claude. Không ra khỏi máy, không nằm trong commit nào | Anh quyết: có đổi mật khẩu DB không (Supabase → Project Settings → Database → Reset password), đổi thì nhớ cập nhật lại `supabase-keys.local.txt` và mọi chỗ đang dùng mật khẩu này. Khoá quản trị (service role) và khoá công khai KHÔNG bị hiện |

### 2b. Ghi chú

**Đã soi xong 23/09:** không lệch đơn nào. API Kiot trả đủ 3.029 đơn, DB cũng 3.029, đối chiếu từng mã khớp tuyệt đối. Con số 3.076 là metadata `total` của Kiot (gồm cả đơn đã xoá), không phải số đơn thật — lần sau đừng lấy `total` làm chuẩn.

## 3. QUY TẮC ĐÃ CHỐT (đừng hỏi lại)

- **Doanh thu Sale = ĐƠN ĐẶT HÀNG Kiot**, không phải hoá đơn. Ngày chốt = ngày tạo đơn.
- **DẤU VẾT TIỀN THẬT** (luật chung): mọi data liên quan doanh thu, kể cả data kéo từ Kiot, trước khi vào app phải có ít nhất 1 trong 3: đã trả tiền trên đơn · khách có hoá đơn hoàn thành · khách có đặt cọc. Trạng thái "Hoàn thành" do Sale đặt tay KHÔNG tính là bằng chứng. Chỉ áp từ 1/6/2026 (trước đó app không có dữ liệu hoá đơn).
- **Phiếu tạm**: đã trả tiền trên phiếu → tính · khách có nợ âm (đã cọc) → tính · không dấu vết tiền → báo giá, không tính.
- **Cắt doanh thu**: Lẻ Online tính hết · Sỉ Offline tính hết · Sỉ Online chỉ tính trong 1 tháng từ đơn đầu, TRỪ KHI khách còn nhắn Pancake (last_chat + 30 ngày). Đơn trước 04/06/2026 không bao giờ cắt.
- **Sỉ / Lẻ trong Kiot**: theo CHI NHÁNH — "Tổng kho sỉ Shidai" = Sỉ, "Đồ Thờ Chánh Tâm" + "Đồ thờ Hiền Thủy" = Lẻ. Nhóm khách chỉ dùng khi ghi rõ. Có ca lẫn nhưng hiếm.
- **Brand khách Sỉ**: kênh ghi rõ brand khác thì theo kênh, còn lại (Sales trực tiếp / trống) = **Shidai**.
- **Hub = nguồn**, giữ hết và vẫn update bình thường; từ nguồn ra báo cáo phải qua bộ lọc. Bộ lọc hiện tại: **chỉ khách Lẻ nguồn Online**.
- **Sỉ lấy full lịch sử** (không giới hạn T6). Riêng TAB Data nhập tay chỉ HIỆN từ 1/6/2026 cho đỡ dài, dòng cũ vẫn vào báo cáo.
- **MKT chỉ lấy Sỉ Online**, Sỉ Offline chỉ vào báo cáo Sale Sỉ.
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

- **28/09 chiều** — (1) **Tạo 264 đơn Pancake** (shop Shidai, page FB Thời Đại) cho khách chỉ có hội thoại để SĐT, gắn KH SỈ, không nhắn khách; huỷ 7 đơn thừa do 1 hội thoại có 2–3 SĐT (script tạo mỗi số 1 đơn — lượt sau đã chặn bằng nhật ký). 265 khách (kể cả #1660) → phân loại **Lead mới**, chưa gán Sale (tab Gán data). Việc #18 coi như xong phần tạo đơn; còn job tự tạo đơn cho hội thoại mới về sau. (2) **Gộp theo tên** trong Master chỉ khi nhóm có tối đa 1 khách có SĐT — 265 khách mới tên phổ biến bị gộp nhầm; tách luôn 30 ca cũ cùng tên khác số (vd "Thành Nguyễn" 6 lead 5 số). Đinh Thị Hường (anh xác nhận 24/9) giữ bằng `gop_vao`. (3) **Sản phẩm quan tâm** (Sỉ): cột DB + ô trong hồ sơ + bộ lọc Master; job `phan-loai-sp-quan-tam.js` chạy sau sync Kiot: phiếu mua (nến 10–90% tiền hàng = Hỗn hợp) → QC/page (QC có chữ "nến", page Tự Tại Viên = Nến) → hội thoại Pancake (QC/bài khách bấm + câu khách hỏi) → page = Đồ thờ. Kết quả 1.492 khách: Đồ thờ 1.096 · Nến 315 · Hỗn hợp 32 · chưa rõ 49. Chốt mốc số liệu: Sỉ 1.492 khách, doanh thu không đổi. (4) 265 khách trên: **ngày tạo = ngày khách nhắn đầu tiên** (cột `ngay_tao_sua`, anh chốt) — chỉ 5 khách thuộc T9, khách Sỉ tháng này 318 → 92. Job tự tạo đơn về sau cũng phải ghi `ngay_tao_sua`. (5) 260 khách nhắn trước T9 trong số đó → **Lead cũ + Nguyễn Hữu Toàn** (anh chốt Lead cũ; gán Toàn theo luật trước T9 = Toàn), 5 khách T9 giữ Lead mới, chưa gán.

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
