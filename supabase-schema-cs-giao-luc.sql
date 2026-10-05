-- THỜI ĐIỂM GIAO VIỆC (anh Hải 05/10/2026: "ngày được giao nhầm"; "cần cột riêng để hiện, không cần điền tay lúc giao"):
-- trước lấy ngày của lượt chăm sóc (ngay_cham) làm ngày giao -> admin mở lượt cũ ra giao (vd #6011 Loan Nguyễn ghi 24/09,
-- giao 05/10) thì hiện sai 24/09. Cột giao_luc do APP TỰ GHI lúc chọn / đổi Nhân sự phụ trách (không có ô điền tay).
-- Chỉ THÊM cột.
alter table public.salesi_crm add column if not exists giao_luc timestamptz;
-- điền cho các việc đã giao trước khi có cột: tính năng giao việc có từ 05/10/2026 -> lượt tạo trước đó thì giao lúc sửa
-- (updated_at), lượt tạo từ 05/10 thì giao lúc tạo (created_at)
update public.salesi_crm
   set giao_luc = case when created_at < '2026-10-05 00:00+07' then updated_at else created_at end
 where nguoi_xu_ly is not null and giao_luc is null;
