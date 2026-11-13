-- NỐI KHÁCH ZALO <-> KHÁCH APP (anh Hải 13/11/2026: "cái nào có SĐT tự nối khách hàng luôn, còn không nối được thì có nút nhỏ nối để Sale nối",
-- "ấn vào ra popup, ra bảng search SĐT hoặc tên KH để Sale họ search họ gắn, xong ấn lưu là được").
-- Báo cáo công việc > cột Phản hồi Zalo đọc view qc_zalo_phan_hoi_ngay (của app QC); khách Zalo không tự nối được (không SĐT / Mã KH)
-- thì Sale bấm "Nối" chọn khách trong app -> lưu 1 dòng ở đây, lần sau tự nhận. App QC có thể đọc bảng này để điền ma_kh (chỉ đọc).
-- Chủ: app MKT / Sale. Monsieur Claude.
create table if not exists public.zalo_noi_kh (
  khach_id   text primary key,           -- khach_id trong view qc_zalo_phan_hoi_ngay (trống thì conv_id)
  conv_id    text,
  ten_zalo   text,
  lead_id    text,                       -- khách trong app (Master); trống nếu chỉ có bên Kiot
  ma_kh      text,                       -- Mã KH Kiot
  noi_boi    text,
  noi_luc    timestamptz not null default now()
);
alter table public.zalo_noi_kh enable row level security;
drop policy if exists zalo_noi_kh_read on public.zalo_noi_kh;
drop policy if exists zalo_noi_kh_ins on public.zalo_noi_kh;
drop policy if exists zalo_noi_kh_upd on public.zalo_noi_kh;
create policy zalo_noi_kh_read on public.zalo_noi_kh for select to authenticated using (true);
create policy zalo_noi_kh_ins on public.zalo_noi_kh for insert to authenticated with check (true);
create policy zalo_noi_kh_upd on public.zalo_noi_kh for update to authenticated using (true) with check (true);
revoke all on public.zalo_noi_kh from anon;
grant select, insert, update on public.zalo_noi_kh to authenticated;
