-- =========================================================================
-- LUỒNG SALE LẺ MỚI (Pancake + KiotViet) -- TÁCH RIÊNG, không dùng chung bảng nào với luồng cũ
-- migrate từ Google Sheet (saonl_customers / saonl_care_log / customers / leads / crm_activities / orders).
--
-- Chỉ đọc đúng 2 bảng của luồng mới:
--   datahub_orders  (Pancake POS, sync 30 phút -- scripts/sync-datahub-pancake.js)
--   kiot_invoices   (KiotViet,    sync 30 phút -- scripts/sync-kiot-invoices.js)
--
-- Khoá nối: Sale ghi Mã KH KiotViet (KH######) vào "Ghi chú nội bộ" của đơn Pancake đã CHỐT ĐƠN
--   datahub_orders.internal_note  ->  kiot_invoices.customer_code
--
-- View KHÔNG tự quyết định quy tắc tính doanh thu khi 1 Mã KH có nhiều hoá đơn -- nó trả về CẢ HAI cách
-- (revenue_first = hoá đơn đầu tiên sau ngày chốt, revenue_all = cộng mọi hoá đơn sau ngày chốt) kèm
-- invoice_count, để tầng báo cáo chọn và để lộ ca cần xem tay.
-- =========================================================================

create or replace view v_saleretail_orders
with (security_invoker = on) as
with pc as (
  select
    d.shop_id, d.shop_name, d.brand, d.order_id, d.system_id, d.order_date,
    d.customer_name, d.phone, d.customer_status, d.customer_tags,
    d.source, d.staff_name, d.ad_id, d.internal_note, d.pancake_updated_at,
    (upper(coalesce(d.customer_tags,'')) like '%CHỐT ĐƠN%') as is_chot,
    case
      when substring(upper(coalesce(d.internal_note,'')) from 'KH[ ]*0*([0-9]{3,7})') is not null
      then 'KH' || lpad(substring(upper(coalesce(d.internal_note,'')) from 'KH[ ]*0*([0-9]{3,7})'), 6, '0')
    end as kiot_customer_code
  from datahub_orders d
)
select
  pc.*,
  coalesce(agg.invoice_count, 0) as invoice_count,
  coalesce(agg.revenue_all, 0)   as revenue_all,
  f.code                          as first_invoice_code,
  f.purchase_date                 as first_invoice_date,
  coalesce(f.total, 0)            as revenue_first,
  f.branch_name                   as first_invoice_branch,
  f.sold_by_name                  as first_invoice_seller,
  f.customer_name                 as kiot_customer_name,
  f.customer_phone                as kiot_customer_phone,
  -- Đối chiếu chéo SĐT (9 số cuối). null = một trong hai bên không có SĐT nên không kết luận được.
  case
    when pc.phone is null or f.customer_phone is null then null
    else right(regexp_replace(pc.phone, '\D', '', 'g'), 9) = right(regexp_replace(f.customer_phone, '\D', '', 'g'), 9)
  end as phone_match
from pc
left join lateral (
  select count(*)::int as invoice_count, sum(k.total) as revenue_all
  from kiot_invoices k
  where pc.kiot_customer_code is not null
    and k.customer_code = pc.kiot_customer_code
    and k.status = 1                          -- chỉ hoá đơn Hoàn thành
    and k.purchase_date::date >= pc.order_date -- hoá đơn luôn sau ngày chốt
) agg on true
left join lateral (
  select k.code, k.purchase_date, k.total, k.branch_name, k.sold_by_name, k.customer_name, k.customer_phone
  from kiot_invoices k
  where pc.kiot_customer_code is not null
    and k.customer_code = pc.kiot_customer_code
    and k.status = 1
    and k.purchase_date::date >= pc.order_date
  order by k.purchase_date asc
  limit 1
) f on true;

-- Hoá đơn Kiot chưa gắn được với đơn Pancake nào -- để biết phần doanh thu còn đứng ngoài báo cáo.
create or replace view v_saleretail_unmatched_invoices
with (security_invoker = on) as
select k.code, k.purchase_date, k.branch_name, k.sold_by_name,
       k.customer_code, k.customer_name, k.total, k.description
from kiot_invoices k
where k.status = 1
  and k.customer_code is not null
  and not exists (
    select 1 from datahub_orders d
    where substring(upper(coalesce(d.internal_note,'')) from 'KH[ ]*0*([0-9]{3,7})') is not null
      and 'KH' || lpad(substring(upper(coalesce(d.internal_note,'')) from 'KH[ ]*0*([0-9]{3,7})'), 6, '0') = k.customer_code
  );
