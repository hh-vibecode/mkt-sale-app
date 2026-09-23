# SỔ VIỆC — app MKT/SALE

> Sổ này thay cho việc đọc lại hội thoại cũ. **Claude phải mở file này đầu mỗi phiên làm việc.**
> Xong việc nào thì xoá khỏi mục ĐANG NỢ và ghi 1 dòng vào NHẬT KÝ (gộp lại khi quá dài).
> Cập nhật lần cuối: 23/09/2026.

---

## 1. ĐANG CHỜ ANH HẢI QUYẾT

| # | Việc | Cần anh nói gì |
|---|---|---|
| 1 | **Kéo full hoá đơn Kiot về hub** — 23/09 anh bảo **TẠM ĐỂ ĐÓ**, khi nào cần thì làm. Xem mục 6 bên dưới trước khi bắt tay | khi nào cần thì anh gọi |
| 2 | **Đẩy data kênh bán sang Data nhập tay** — đã rà ra **18 khách đủ điều kiện** (Lẻ · Online · từ T6 · chưa có trong app), 44,79tr. File: `scratchpad/data-du-dieu-kien.csv` | có tạo 18 dòng nhập tay không |
| 3 | **Tăng tỉ lệ có SĐT của Pancake** để nối Ad ID theo SĐT ăn thua hơn (hiện chỉ 19% đơn có SĐT nên chỉ vá được 2 lead). Cách: kéo SĐT từ API hội thoại Pancake | cho thử vài trăm hội thoại đo tỉ lệ không |
| 4 | **Soát đơn huỷ / phiếu tạm** — 925/3.029 đơn Kiot đang huỷ (30%), 640 phiếu tạm không cọc (22,6 tỷ). Nghi lỗi quy trình Sale | có dựng mục soát không |
| 5 | **Chi phí MKT luôn trễ 1 ngày** — job Meta chỉ kéo ngày HÔM QUA (`TARGET_DATE = hôm nay - 1`), nên báo cáo MKT hôm nay không có chi phí hôm nay. Meta có trả số trong ngày (chưa chốt, có thể nhích) | có kéo thêm ngày hôm nay không |
| 6 | **Tình trạng hỗ trợ (CRM Sỉ)** — 996/1.000 lượt đều là "Đã xong", cột gần như vô nghĩa | có bổ sung lựa chọn khác không (Chờ kế toán, Chờ giao hàng, Cần giá sỉ…) |

## 2. CLAUDE ĐANG NỢ (tự làm, không cần hỏi)

| # | Việc | Ghi chú |
|---|---|---|
| — | (trống) | |

**Đã soi xong 23/09:** không lệch đơn nào. API Kiot trả đủ 3.029 đơn, DB cũng 3.029, đối chiếu từng mã khớp tuyệt đối. Con số 3.076 là metadata `total` của Kiot (gồm cả đơn đã xoá), không phải số đơn thật — lần sau đừng lấy `total` làm chuẩn.

## 3. QUY TẮC ĐÃ CHỐT (đừng hỏi lại)

- **Doanh thu Sale = ĐƠN ĐẶT HÀNG Kiot**, không phải hoá đơn. Ngày chốt = ngày tạo đơn.
- **Phiếu tạm**: đã trả tiền trên phiếu → tính · khách có nợ âm (đã cọc) → tính · không dấu vết tiền → báo giá, không tính.
- **Cắt doanh thu**: Lẻ Online tính hết · Sỉ Offline tính hết · Sỉ Online chỉ tính trong 1 tháng từ đơn đầu, TRỪ KHI khách còn nhắn Pancake (last_chat + 30 ngày). Đơn trước 04/06/2026 không bao giờ cắt.
- **Sỉ / Lẻ trong Kiot**: theo CHI NHÁNH — "Tổng kho sỉ Shidai" = Sỉ, "Đồ Thờ Chánh Tâm" + "Đồ thờ Hiền Thủy" = Lẻ. Nhóm khách chỉ dùng khi ghi rõ. Có ca lẫn nhưng hiếm.
- **Brand khách Sỉ**: kênh ghi rõ brand khác thì theo kênh, còn lại (Sales trực tiếp / trống) = **Shidai**.
- **Hub = nguồn**, giữ hết và vẫn update bình thường; từ nguồn ra báo cáo phải qua bộ lọc. Bộ lọc hiện tại: **chỉ khách Lẻ nguồn Online**.
- **Sỉ lấy full lịch sử** (không giới hạn T6). Riêng TAB Data nhập tay chỉ HIỆN từ 1/6/2026 cho đỡ dài, dòng cũ vẫn vào báo cáo.
- **MKT chỉ lấy Sỉ Online**, Sỉ Offline chỉ vào báo cáo Sale Sỉ.
- **Cột trạng thái của Sỉ**: Master = Phân loại KH · CRM = Tình trạng hỗ trợ.
- **Lead ID**: dùng mã app sinh; khách đã có Mã KH Kiot thì cột đó hiện thẳng Mã KH.
- Mọi thứ Claude tạo ký tên **Monsieur Claude**.
- Repo `Dashboard-Meta` CHỈ ĐỌC tham khảo, tuyệt đối không sửa.

## 4. CƠ CHẾ TỰ CHẠY (đang sống)

- `sync-datahub-pancake` · `sync-kiot-orders` (có lấy kênh bán) · `sync-kiot-invoices` · `sync-mkt-from-meta` — lịch do pg_cron trên Supabase bắn.
- `moc-so-lieu.yml` — chốt mốc số liệu 00:00 / 08:00 / 16:00 giờ VN. So trước, lệch > 5% thì GIỮ mốc cũ và fail để báo mail.
- `scripts/kiem-so-lieu.js` — chạy trước & sau mỗi lần sửa logic báo cáo.
- `scripts/check-pagination.js` — chạy trong CI của workflow Pancake; đọc bảng phải dùng limit/offset, dùng header Range là fail.

## 5. NHẬT KÝ (mới nhất trước)

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
