-- Cho nghỉ + bàn giao (anh Hải 1/10/2026): Sale nghỉ thì chọn người nhận; mọi khách đang đứng tên người nghỉ
-- chuyển sang người nhận (ghi saleretail_manual.si_sale). Cột này lưu người đã nhận bàn giao để tra lại.
alter table public.sale_nhan_su add column if not exists ban_giao_cho text;
alter table public.sale_nhan_su add column if not exists ban_giao_luc timestamptz;
