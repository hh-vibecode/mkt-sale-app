-- SẢN PHẨM QUAN TÂM trong từng lượt chăm sóc (anh Hải 02/10/2026): form Lượt chăm sóc thêm mục 2 ngay sau
-- "Nội dung trao đổi". Dùng chung Lẻ + Sỉ (bảng salesi_crm). Chỉ THÊM cột, không đổi gì cũ.
alter table public.salesi_crm add column if not exists sp_quan_tam text;
