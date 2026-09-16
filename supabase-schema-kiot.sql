-- =========================================================================
-- KiotViet: hoá đơn bán hàng (doanh thu THỰC NHẬN) crawl thẳng từ KiotViet Public API vào Supabase,
-- thay cho sheet export hoá đơn Kiot làm tay mỗi tháng (dashboard cũ). Job: scripts/sync-kiot-invoices.js.
--
-- Khoá nối với Pancake: Sale ghi Mã KH KiotViet (KH######) vào "Ghi chú nội bộ" của đơn Pancake đã CHỐT ĐƠN
-- -> datahub_orders.internal_note  <->  kiot_invoices.customer_code.
-- Chỉ lấy hoá đơn từ 1/6/2026 trở đi (cùng mốc với datahub_orders).
-- Thời gian KiotViet trả về là giờ VN không kèm múi giờ -- script gắn +07:00 trước khi ghi.
-- =========================================================================

create table if not exists kiot_invoices (
  id bigint primary key,                 -- id nội bộ KiotViet
  code text not null unique,             -- Mã hoá đơn (HD######)
  purchase_date timestamptz not null,    -- Thời gian bán
  branch_id bigint,
  branch_name text,                      -- Chi nhánh
  sold_by_id bigint,
  sold_by_name text,                     -- Người bán
  customer_id bigint,
  customer_code text,                    -- Mã KH (KH######) -- khoá nối với Pancake
  customer_name text,
  customer_phone text,                   -- lấy từ /customers/code/{code} (hoá đơn KHÔNG có sẵn) -- đối soát chéo với Pancake
  customer_address text,                 -- lấy từ /customers/code/{code} -- đối soát chéo với Pancake
  order_code text,                       -- Mã đặt hàng KiotViet (nếu hoá đơn tạo từ đơn đặt)
  total numeric(14,2),                   -- Tổng tiền hàng sau giảm giá
  total_payment numeric(14,2),           -- Khách đã trả
  discount numeric(14,2),
  status int,                            -- 1 Hoàn thành / 2 Đã huỷ / 3 Đang xử lý / 5 Không giao được
  status_value text,
  description text,
  items jsonb,                           -- [{code,name,category,qty,price,discount,subtotal}]
  kiot_modified_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_kiot_invoices_date on kiot_invoices(purchase_date);
create index if not exists idx_kiot_invoices_customer on kiot_invoices(customer_code);
create index if not exists idx_kiot_invoices_branch on kiot_invoices(branch_name);

drop trigger if exists trg_kiot_invoices_touch on kiot_invoices;
create trigger trg_kiot_invoices_touch before update on kiot_invoices
for each row execute function touch_datahub_updated_at();

alter table kiot_invoices enable row level security;
drop policy if exists "anon read kiot_invoices" on kiot_invoices;
create policy "anon read kiot_invoices" on kiot_invoices for select using (true);
-- Ghi chỉ qua service_role (job GitHub Actions), giống datahub_orders.
