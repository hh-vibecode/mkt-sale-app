-- DAILY REPORT (anh Hải 19/10/2026: "quản trị thêm 1 cái daily report, chỉ t nhìn thấy, tóm tắt các thay đổi của ngày hôm qua,
-- tóm tắt tất cả báo cáo chính và chỉ số + cảnh báo, tự động xử lý vào 4-5h sáng hằng ngày").
-- Mỗi ngày 1 dòng. Job .github/workflows/bao-cao-ngay.yml (scripts/bao-cao-ngay.js) ghi bằng service_role;
-- trang Daily report trong app đọc. CHỈ tài khoản Supreme đọc / ghi (nút "Tính lại" trong app) — chặn ở CSDL, không chỉ ẩn nút.
create table if not exists public.mkt_bao_cao_ngay (
  ngay      date primary key,                 -- ngày ĐƯỢC báo cáo (hôm qua so với lúc chạy), giờ VN
  du_lieu   jsonb not null,                   -- toàn bộ số liệu (xem bcnTinh trong index.html)
  canh_bao  jsonb not null default '[]'::jsonb,
  tom_tat   jsonb not null default '[]'::jsonb,
  tao_luc   timestamptz not null default now(),
  tao_boi   text
);
alter table public.mkt_bao_cao_ngay enable row level security;
drop policy if exists bcn_supreme_doc on public.mkt_bao_cao_ngay;
drop policy if exists bcn_supreme_ghi on public.mkt_bao_cao_ngay;
drop policy if exists bcn_supreme_sua on public.mkt_bao_cao_ngay;
create policy bcn_supreme_doc on public.mkt_bao_cao_ngay for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'position', '') = 'supreme');
create policy bcn_supreme_ghi on public.mkt_bao_cao_ngay for insert to authenticated
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'position', '') = 'supreme');
create policy bcn_supreme_sua on public.mkt_bao_cao_ngay for update to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'position', '') = 'supreme')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'position', '') = 'supreme');
revoke all on public.mkt_bao_cao_ngay from anon;
grant select, insert, update on public.mkt_bao_cao_ngay to authenticated;
select count(*) from public.mkt_bao_cao_ngay;
