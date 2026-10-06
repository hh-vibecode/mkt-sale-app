-- TRẠNG THÁI QUẢNG CÁO META (anh Hải 06/10/2026: "ads nào nhóm nào camp nào bật thì chấm xanh, trình bày giống Ads Manager").
-- Job sync-mkt-from-meta.js (7h · 12h · 15h) kéo /{act}/ads?fields=effective_status,adset{...},campaign{...} rồi ghi đè bảng này.
-- 1 dòng / quảng cáo. Bảng của MKT / Sale. Chỉ đọc cho tài khoản đăng nhập; ghi bằng service role (job).
create table if not exists public.mkt_ads_trang_thai (
  ad_id           text primary key,
  ad_name         text,
  ad_status       text,          -- effective_status của quảng cáo: ACTIVE / PAUSED / CAMPAIGN_PAUSED / ADSET_PAUSED / ...
  adset_id        text,
  adset_name      text,
  adset_status    text,
  campaign_id     text,
  campaign_name   text,
  campaign_status text,
  tai_khoan       text,          -- act_...
  cap_nhat        timestamptz not null default now()
);
alter table public.mkt_ads_trang_thai enable row level security;
drop policy if exists mkt_ads_trang_thai_read on public.mkt_ads_trang_thai;
create policy mkt_ads_trang_thai_read on public.mkt_ads_trang_thai for select to authenticated using (true);
