-- ĐỊA CHỈ TỪ KIOT (29/9/2026): để suy Tỉnh/TP cho khách (anh Hải: thêm trường thành phố, chủ yếu khách đã chốt đơn).
-- Đơn đặt hàng Kiot có địa chỉ giao hàng (orderDelivery) ~86% đơn; khách Kiot có địa chỉ ~20%. Trước đây sync bỏ qua.
alter table kiot_orders add column if not exists giao_dia_chi text;     -- orderDelivery.address
alter table kiot_orders add column if not exists giao_khu_vuc text;     -- orderDelivery.locationName, vd "Hồ Chí Minh - Quận Phú Nhuận"
alter table kiot_customers add column if not exists address text;       -- customer.address
