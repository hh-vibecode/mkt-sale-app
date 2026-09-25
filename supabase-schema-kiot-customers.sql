-- =========================================================================
-- KiotViet: DANH SÁCH KHÁCH HÀNG -- tương đương sheet "7.DATA KIOT" trong luồng cũ.
-- Đây là mảnh còn thiếu để tự nối dữ liệu mà KHÔNG cần Sale gõ tay Mã KH:
-- script cũ (syncLeadSalesOnline) nhận diện khách bằng 9 SỐ CUỐI SĐT, rồi tự điền
-- Mã KH / Giá trị đơn cộng dồn / Ngày giao dịch cuối vào MASTER DATA.
--
-- Nguồn: GET /customers?includeCustomerGroup=true&includeTotal=true
--   groups        -> "Nhóm khách hàng" (chỉ lấy đúng "Khách lẻ" khi dựng Master Lẻ)
--   totalRevenue  -> "Tổng bán trừ trả lại" (giá trị mua cộng dồn ở mức KHÁCH, không phải từng hoá đơn)
--   contactNumber -> "Điện thoại"
-- "Ngày giao dịch cuối" API không trả ở mức khách -> tính từ kiot_invoices (max purchase_date theo mã KH).
-- =========================================================================

create table if not exists kiot_customers (
  id bigint primary key,                 -- id nội bộ KiotViet
  code text not null unique,             -- Mã khách hàng (KH######)
  name text,
  phone text,
  phone_key text,                        -- 9 số cuối SĐT -- KHOÁ NỐI với Pancake (datahub_orders.phone)
  customer_group text,                   -- "Khách lẻ" / "Khách buôn" / ...
  branch_id bigint,
  location_name text,                    -- Tỉnh/TP theo Kiot
  ward_name text,                        -- Phường/Xã theo Kiot
  total_revenue numeric(14,2),           -- Tổng bán trừ trả lại
  total_invoiced numeric(14,2),          -- Tổng bán
  debt numeric(14,2),
  kiot_created_date timestamptz,
  kiot_modified_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_kiot_customers_phone on kiot_customers(phone_key);
create index if not exists idx_kiot_customers_group on kiot_customers(customer_group);

drop trigger if exists trg_kiot_customers_touch on kiot_customers;
create trigger trg_kiot_customers_touch before update on kiot_customers
for each row execute function touch_datahub_updated_at();

alter table kiot_customers enable row level security;
drop policy if exists "anon read kiot_customers" on kiot_customers;
create policy "anon read kiot_customers" on kiot_customers for select using (true);
