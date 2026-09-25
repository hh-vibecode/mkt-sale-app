-- Data NHẬP TAY cho Data Hub: khách chốt qua kênh KHÔNG đẩy đơn lên Pancake
-- (TikTok, Website, chat tay, khách quen gọi thẳng...). Thay cho tab "6.NGUONLE" của sheet cũ.
-- Đo trên sheet 17/9/2026: 19 khách kiểu này, 232tr doanh thu Kiot thật, đều là nguồn Online
-- -> thuộc đúng phạm vi báo cáo Sale Lẻ nhưng luồng Pancake không thể thấy.
create table if not exists public.datahub_manual (
  id           bigint generated always as identity primary key,
  created_date date not null,
  sale_type    text not null default 'Lẻ',     -- Lẻ / Sỉ
  nguon        text not null default 'Online', -- Online / Offline
  kenh         text,                            -- vd "Tiktok Chánh Tâm", "Website Hiền Thuỷ"
  brand        text,                            -- CT / HT / Shidai / TTV
  customer_name text not null,
  phone        text,
  staff_name   text,                            -- Sales phụ trách
  kiot_code    text,                            -- Mã KH Kiot -> dùng để lấy doanh thu thật
  status       text,                            -- Chốt đơn / Tiềm năng / Đang chăm sóc / Mất lead
  lost_group   text,
  note         text,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists datahub_manual_date_idx on public.datahub_manual(created_date);
create index if not exists datahub_manual_kiot_idx on public.datahub_manual(kiot_code);

alter table public.datahub_manual enable row level security;

-- App chạy bằng anon key (xem sbInsert trong index.html).
drop policy if exists datahub_manual_read on public.datahub_manual;
create policy datahub_manual_read on public.datahub_manual for select using (true);
drop policy if exists datahub_manual_ins on public.datahub_manual;
create policy datahub_manual_ins on public.datahub_manual for insert with check (true);
drop policy if exists datahub_manual_upd on public.datahub_manual;
create policy datahub_manual_upd on public.datahub_manual for update using (true) with check (true);
drop policy if exists datahub_manual_del on public.datahub_manual;
create policy datahub_manual_del on public.datahub_manual for delete using (true);
