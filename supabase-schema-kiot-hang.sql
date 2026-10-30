-- DANH MỤC HÀNG KIOT của app MKT/Sale (anh Hải 30/10/2026: thẻ "Doanh thu theo nhóm hàng (nhóm cha)" ở Báo cáo tổng hợp, bê giao diện
-- bên Kế toán nhưng doanh số tính theo luật app MKT). Bảng Kế toán (kt_kiot_hang) khoá RLS + thuộc app khác -> app MKT có bảng riêng,
-- job scripts/sync-kiot-hang.js kéo thẳng từ KiotViet (nhóm hàng + giá vốn) mỗi sáng. Monsieur Claude.
create table if not exists kiot_hang (
  ma text primary key,                 -- mã hàng Kiot (SP...), khớp items[].code trong kiot_orders
  ten text,
  nhom_id bigint,                      -- nhóm hàng trực tiếp
  nhom text,
  nhom_cha_id bigint,                  -- nhóm GỐC (không có cha) -- "nhóm cha" của báo cáo
  nhom_cha text,
  gia_von numeric,                     -- giá vốn bình quân Kiot (bình quân theo tồn các chi nhánh; gần đúng)
  cap_nhat timestamptz not null default now()
);
alter table kiot_hang enable row level security;
drop policy if exists kiot_hang_read on kiot_hang;
create policy kiot_hang_read on kiot_hang for select to authenticated using (true);
revoke all on kiot_hang from anon;
grant select on kiot_hang to authenticated;
