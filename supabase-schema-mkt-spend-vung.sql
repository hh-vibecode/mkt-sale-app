-- CHI TIÊU META THEO TỈNH / TUỔI - GIỚI TÍNH (28/11/2026, anh Hải: tab "Khách Online" -- "biết chính xác ngân sách chi tiêu theo tỉ lệ các tỉnh").
-- Job scripts/sync-mkt-vung.js (chạy sau sync-mkt) kéo Meta insights cấp chiến dịch, breakdowns=region và breakdowns=age,gender,
-- gộp theo ngày x brand (detectBrand tên chiến dịch, bỏ chiến dịch tuyển dụng). Chủ bảng: app MKT / Sale. Soạn bởi Monsieur Claude.
create table if not exists public.mkt_spend_vung (
  ngay date not null,
  brand text not null,                 -- CT / HT / Shidai / TTV (cùng luật detectBrand của mkt_spend)
  loai text not null,                  -- 'tinh' (khoa = tên vùng Meta, vd "Hanoi") | 'tuoi_gioi' (khoa = "25-34|female")
  khoa text not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  messages integer not null default 0, -- lượt bắt đầu trò chuyện (cùng định nghĩa cột messages của mkt_spend)
  cap_nhat timestamptz not null default now(),
  primary key (ngay, brand, loai, khoa)
);
alter table public.mkt_spend_vung enable row level security;
drop policy if exists "dang nhap doc mkt_spend_vung" on public.mkt_spend_vung;
create policy "dang nhap doc mkt_spend_vung" on public.mkt_spend_vung for select to authenticated using (true);
