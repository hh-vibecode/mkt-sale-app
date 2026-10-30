-- LƯỢT MUA + ẢNH MẪU QUẢNG CÁO (anh Hải 30/10/2026: giao diện Chi tiết quảng cáo như Ads Manager -- ảnh mẫu, cột Lượt mua bấm ra
-- khách + link Pancake + phiếu Kiot, doanh thu theo chiến dịch). Bảng của app MKT/Sale, chỉ THÊM cột. Monsieur Claude.
alter table mkt_spend add column if not exists purchases integer not null default 0;   -- Meta omni_purchase (Pancake báo về khi chốt)
alter table mkt_ads_trang_thai add column if not exists anh text;                    -- creative.thumbnail_url (link CDN Meta, có hạn -> làm mới mỗi lượt sync)
