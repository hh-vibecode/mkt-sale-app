-- NGÂN SÁCH ĐANG ĐẶT của chiến dịch / nhóm quảng cáo (anh Hải 05/11/2026: "thêm mức ngân sách đang dùng vào bên camp, để theo dõi cùng",
-- "ngân sách đang set theo ngày chứ không phải ngân sách tiêu"). Job Meta ghi mỗi lượt (7h · 12h · 15h). Đơn vị: đồng (VND). Chỉ THÊM cột.
alter table public.mkt_ads_trang_thai add column if not exists cd_ns_ngay numeric;      -- campaign.daily_budget (ngân sách cấp chiến dịch)
alter table public.mkt_ads_trang_thai add column if not exists cd_ns_tron_doi numeric;  -- campaign.lifetime_budget
alter table public.mkt_ads_trang_thai add column if not exists nhom_ns_ngay numeric;    -- adset.daily_budget (ngân sách cấp nhóm)
alter table public.mkt_ads_trang_thai add column if not exists nhom_ns_tron_doi numeric;-- adset.lifetime_budget
