-- KÊNH BÁN CỦA ĐƠN ĐẶT HÀNG KHÔNG CẬP NHẬT KHI SỬA TRÊN KIOT (lỗi anh Hải phát hiện 05/10/2026, đơn DH002798 KL Cô Linh - HN:
-- sửa kênh sang Shidai trên Kiot lúc 10:14, app vẫn "Bán trực tiếp").
-- Nguyên nhân: API danh sách /orders không trả kênh, script phải gọi chi tiết từng đơn, nhưng CHỈ gọi cho đơn chưa có kênh
-- -> đơn đã có kênh giữ giá trị cũ mãi. Sửa: lưu kenh_lay_luc = modifiedDate của đơn lúc lấy kênh; đơn có modifiedDate mới
-- hơn thì gọi chi tiết lại. Dòng cũ để trống -> lấy lại dần (400 đơn / lượt, ưu tiên đơn sửa gần nhất).
alter table public.kiot_orders add column if not exists kenh_lay_luc timestamptz;
