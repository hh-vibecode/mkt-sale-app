-- AI ĐANG XEM APP (anh Hải 08/10/2026: "cho t xem những ai đang xem báo cáo ở trên này, động vật random giống gg").
-- Mỗi tab trình duyệt = 1 dòng (session_id), cứ 30 giây báo danh (last_seen). Quá 90 giây không báo = đã thoát.
-- Bảng RIÊNG của app MKT / Sale (dash_presence là của Dashboard-Meta cũ, không ghi vào). Chỉ người đã đăng nhập đọc / ghi.
create table if not exists public.dang_xem (
  session_id text primary key,
  ten        text not null,           -- tên tài khoản hiển thị
  trang      text,                    -- trang đang mở (vd Báo cáo · Sale Sỉ)
  avatar_idx int,
  color_idx  int,
  last_seen  timestamptz not null default now()
);
create index if not exists dang_xem_last_seen on public.dang_xem (last_seen desc);
alter table public.dang_xem enable row level security;
drop policy if exists dang_xem_read on public.dang_xem;
drop policy if exists dang_xem_ins on public.dang_xem;
drop policy if exists dang_xem_upd on public.dang_xem;
drop policy if exists dang_xem_del on public.dang_xem;
create policy dang_xem_read on public.dang_xem for select to authenticated using (true);
create policy dang_xem_ins  on public.dang_xem for insert to authenticated with check (true);
create policy dang_xem_upd  on public.dang_xem for update to authenticated using (true) with check (true);
create policy dang_xem_del  on public.dang_xem for delete to authenticated using (true);
revoke all on public.dang_xem from anon;
grant select, insert, update, delete on public.dang_xem to authenticated;
-- dọn dòng cũ hơn 1 ngày (tab đóng đột ngột không kịp xoá) -- gắn vào lịch dọn sẵn có: chạy tay / pg_cron
create or replace function public.dang_xem_don() returns void language sql security definer set search_path = public as $$
  delete from public.dang_xem where last_seen < now() - interval '1 day';
$$;
revoke all on function public.dang_xem_don() from public, anon;
-- lịch dọn: 02:25 giờ VN mỗi ngày (cron chạy UTC: 19:25)
select cron.schedule('dang-xem-don', '25 19 * * *', 'select public.dang_xem_don()');
