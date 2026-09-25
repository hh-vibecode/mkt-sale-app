-- ĐƠN ĐẶT HÀNG KiotViet (Đơn hàng) -- KHÁC hoá đơn.
-- Báo cáo Sale chạy trên bảng NÀY: Sale chốt xong là tạo đơn đặt hàng bên Kiot, còn hoá đơn có xuất
-- hay chưa là việc của kế toán/đối soát, không liên quan tới thành tích Sale.
-- Đo 17/9/2026: 851 đơn từ 1/6, trong đó 368 Hoàn thành · 230 Phiếu tạm · 253 Đã huỷ.
create table if not exists public.kiot_orders (
  id             bigint primary key,
  code           text not null,
  purchase_date  timestamptz,
  branch_name    text,
  sold_by_name   text,
  customer_code  text,
  customer_name  text,
  total          numeric,
  total_payment  numeric,
  status         smallint,        -- 1 Phiếu tạm · 2 Đang giao · 3 Hoàn thành · 4 Đã huỷ
  status_value   text,
  items          jsonb,
  modified_date  timestamptz,
  created_date   timestamptz,
  synced_at      timestamptz not null default now()
);
create index if not exists kiot_orders_cust_idx on public.kiot_orders(customer_code);
create index if not exists kiot_orders_date_idx on public.kiot_orders(purchase_date desc);
-- Đơn huỷ bị loại khỏi doanh số -> index riêng cho phần còn lại, rất nhẹ.
create index if not exists kiot_orders_live_idx on public.kiot_orders(customer_code) where status <> 4;

alter table public.kiot_orders enable row level security;
drop policy if exists kiot_orders_read on public.kiot_orders;
create policy kiot_orders_read on public.kiot_orders for select using (true);
