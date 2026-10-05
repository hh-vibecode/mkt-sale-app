-- GIAO VIỆC TRONG LƯỢT CHĂM SÓC (anh Hải 05/10/2026): mục 4 "Phương án tiếp theo" có ô "Nhân sự phụ trách" (chỉ admin trở
-- lên thấy) -> admin giao việc cho 1 Sale. Việc hiện ở bảng đỏ "Việc được giao" đầu tab Daily Task của người được giao, hạn =
-- ngay_hen (Lịch hẹn / Deadline). Ghi 1 lượt chăm sóc MỚI cho khách đó là xong việc (lượt giao không còn là lượt mới nhất).
-- Chỉ THÊM cột.
alter table public.salesi_crm add column if not exists nguoi_xu_ly text;
