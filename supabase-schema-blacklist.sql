-- KHÁCH BLACKLIST (anh Hải 14/11/2026: "thêm tính năng blacklist, khung đen đỏ tương tự khách VIP, chọn blacklist sẽ hiện thêm 1 dòng
-- note lý do/lưu ý", "bộ lọc cho blacklist riêng như vip"). Bảng saleretail_manual thuộc app MKT/Sale (chỉ THÊM cột). Monsieur Claude.
alter table saleretail_manual add column if not exists blacklist boolean not null default false;
alter table saleretail_manual add column if not exists blacklist_ly_do text;
alter table saleretail_manual add column if not exists blacklist_luc timestamptz;
alter table saleretail_manual add column if not exists blacklist_boi text;
