-- NHẬT KÝ ĐƠN PANCAKE APP TỰ TẠO từ hội thoại có SĐT (việc #18, anh Hải chốt 28/9/2026).
-- Mỗi SĐT chỉ tạo 1 lần: lượt sau thấy SĐT đã có ở đây thì bỏ qua, không tạo trùng.
-- Monsieur Claude
create table if not exists public.pancake_tu_tao_don (
  so text primary key,            -- 9 số cuối SĐT
  page_id text, conversation_id text, shop_id bigint, order_id text, system_id int,
  customer_id text, ten text, the text, nhan_dau timestamptz, tao_luc timestamptz not null default now(), loi text
);
alter table public.pancake_tu_tao_don enable row level security;
drop policy if exists pancake_tu_tao_don_doc on public.pancake_tu_tao_don;
create policy pancake_tu_tao_don_doc on public.pancake_tu_tao_don for select to authenticated using (true);
grant select on public.pancake_tu_tao_don to authenticated;
-- đơn thử đầu tiên (Tạ Văn Chinh, #1660) đã tạo tay 28/9
insert into public.pancake_tu_tao_don (so,page_id,conversation_id,shop_id,order_id,system_id,customer_id,ten,the,nhan_dau)
values ('398237980','506247572578559','122173234016719991_2589055411543942',1943052948,'10932302664',1660,'b0dc11f7-6575-4087-a48f-b787afdea5a7','Tạ Văn Chinh','KH SỈ','2026-09-17 15:27:29+00')
on conflict (so) do nothing;
