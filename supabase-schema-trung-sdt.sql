-- TRÙNG SĐT (13/10/2026, anh Hải): mục "Trùng SĐT" ở tab Nhập Liệu ghi các ca Sale đã soát
-- (giữ riêng 2 khách Sỉ / Lẻ, xác nhận đúng 1 người) để app không nhắc lại.
-- saleretail_manual là bảng riêng của app MKT/SALE -> chỉ THÊM cột, không đổi gì cũ.
alter table public.saleretail_manual add column if not exists trung_ok text;
comment on column public.saleretail_manual.trung_ok is 'Lead ID (phân cách dấu phẩy) đã được Sale xác nhận ổn khi trùng SĐT với dòng này — mục Trùng SĐT tab Nhập Liệu';
