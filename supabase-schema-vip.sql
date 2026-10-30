-- KHÁCH VIP (anh Hải 30/10/2026: Sale cần highlight khách VIP cần để ý -> nút ngôi sao cạnh tên trong hồ sơ khách, Sale tự chọn).
-- Bảng saleretail_manual thuộc app MKT/Sale (chỉ THÊM cột). Monsieur Claude.
alter table saleretail_manual add column if not exists vip boolean not null default false;
alter table saleretail_manual add column if not exists vip_luc timestamptz;
alter table saleretail_manual add column if not exists vip_boi text;
