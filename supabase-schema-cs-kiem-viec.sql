-- QUẢN LÝ KIỂM VIỆC ĐÃ XONG (anh Hải 05/10/2026): việc giao ở lượt chăm sóc (nguoi_xu_ly) mà Sale đã ghi lượt mới = xong ->
-- hiện ở bảng vàng "Việc vừa xong — chờ kiểm" (Daily Task, chỉ admin trở lên). Quản lý bấm "Đạt" / "Giao lại" -> ghi vào
-- CHÍNH lượt giao việc: kiem_luc (lúc kiểm), kiem_boi (ai kiểm + kết luận). Chỉ THÊM cột.
alter table public.salesi_crm add column if not exists kiem_luc timestamptz;
alter table public.salesi_crm add column if not exists kiem_boi text;
