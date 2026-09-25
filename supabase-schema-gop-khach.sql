-- 25/9/2026 -- HỢP NHẤT KHÁCH BẰNG TAY (tab Nhập Liệu > "Nghi trùng khách").
-- Sale tích 2 dòng trở lên cùng 1 người -> bấm Hợp nhất: mỗi dòng phụ ghi gop_vao = Lead ID dòng chính.
-- App gộp đơn / doanh thu / SĐT / lịch sử chăm sóc của các dòng này về 1 khách, giống gộp tự động theo Mã KH.
-- Bỏ gop_vao (đặt null) là tách ra lại, không mất dữ liệu gì.
alter table public.saleretail_manual add column if not exists gop_vao text;

-- Sale xác nhận "KHÔNG phải cùng 1 người" -> không nhắc lại nhóm đó nữa.
-- Lưu danh sách Lead ID đã xác nhận khác người, cách nhau dấu phẩy.
alter table public.saleretail_manual add column if not exists khac_nguoi text;
