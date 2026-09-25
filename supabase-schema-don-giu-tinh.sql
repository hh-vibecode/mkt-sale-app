-- ĐƠN KIOT "GIỮ TÍNH" (anh Hải 25/9/2026): phiếu đặt hàng từng được tính doanh thu vì KHÁCH CÓ CỌC (công nợ âm)
-- thì ghi nhớ lại, sau này công nợ khách đổi (vd khách nợ thêm đơn mới) cũng KHÔNG bị loại nữa.
-- Trước đây app xét cọc theo công nợ HIỆN TẠI -> KH004099 đổi công nợ lúc 17:09 25/9 là 19 phiếu (742,6tr) bị loại.
-- Job scripts/tu-tao-chot-don-si.js ghi thêm sau mỗi lượt kéo đơn Kiot; app chỉ đọc.
-- Monsieur Claude
create table if not exists public.kiot_don_giu_tinh (
  code text primary key,
  customer_code text,
  ly_do text,
  ghi_luc timestamptz not null default now()
);
alter table public.kiot_don_giu_tinh enable row level security;
drop policy if exists kiot_don_giu_tinh_doc on public.kiot_don_giu_tinh;
create policy kiot_don_giu_tinh_doc on public.kiot_don_giu_tinh for select to authenticated using (true);
grant select on public.kiot_don_giu_tinh to authenticated;

-- khôi phục ca KH004099: 19 phiếu tạm được tính tới 17:09 25/9 (lúc còn cọc)
insert into public.kiot_don_giu_tinh (code, customer_code, ly_do)
select code, customer_code, 'khách có cọc (khôi phục 25/9/2026 - công nợ đổi lúc 17:09)'
from public.kiot_orders
where customer_code='KH004099' and status=1 and coalesce(total_payment,0)<=0 and coalesce(total,0)>0
on conflict (code) do nothing;

-- ghi nhận mọi đơn hiện đang được tính NHỜ CỌC (khách công nợ âm, đơn chưa trả đồng nào)
insert into public.kiot_don_giu_tinh (code, customer_code, ly_do)
select o.code, o.customer_code, 'khách có cọc'
from public.kiot_orders o join public.kiot_customers c on c.code=o.customer_code
where coalesce(c.debt,0)<0 and o.status<>4 and coalesce(o.total_payment,0)<=0 and coalesce(o.total,0)>0
on conflict (code) do nothing;
