-- Kênh bán của HOÁ ĐƠN Kiot (2/10/2026). Trước chỉ đơn đặt hàng có kênh -> khách mua thẳng bằng hoá đơn (không qua đơn
-- đặt hàng) như KH007691 KL Chị Duyên (Facebook Hiền Thuỷ, 20,6tr) không được tự tạo vào app.
-- API danh sách /invoices trả saleChannelId (0 / không có = Bán trực tiếp); tên tra theo /salechannel.
alter table public.kiot_invoices add column if not exists sale_channel_id bigint;
alter table public.kiot_invoices add column if not exists sale_channel text;
