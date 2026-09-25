-- DANH MỤC DROPDOWN dùng chung toàn app (anh Hải 25/9/2026): tài khoản quản trị bấm bút cạnh dropdown để
-- thêm / đổi tên / đổi màu / xoá giá trị; mọi báo cáo và tài khoản dùng theo bảng này.
-- he_thong = true: giá trị app dùng trong logic (gắn thẻ Pancake, đếm chốt / mất lead) -> chỉ đổi màu được.
-- Monsieur Claude
create table if not exists public.danh_muc (
  id bigserial primary key,
  loai text not null,
  gia_tri text not null,
  mau text,
  thu_tu int not null default 0,
  he_thong boolean not null default false,
  created_at timestamptz not null default now(),
  unique (loai, gia_tri)
);
alter table public.danh_muc enable row level security;
drop policy if exists danh_muc_doc on public.danh_muc;
create policy danh_muc_doc on public.danh_muc for select to authenticated using (true);
drop policy if exists danh_muc_sua on public.danh_muc;
create policy danh_muc_sua on public.danh_muc for all to authenticated using (public.la_quan_tri()) with check (public.la_quan_tri());
grant select, insert, update, delete on public.danh_muc to authenticated;
grant usage, select on sequence public.danh_muc_id_seq to authenticated;

insert into public.danh_muc (loai, gia_tri, mau, thu_tu, he_thong) values
 ('si_phan_loai','Lead mới','#8b5cf6',1,false),
 ('si_phan_loai','Đã ra đơn','#16a34a',2,true),
 ('si_phan_loai','Tiềm năng, chưa ra đơn','#0ea5e9',3,true),
 ('si_phan_loai','Chăm sóc dài hạn','#4361ee',4,true),
 ('si_phan_loai','Chưa liên hệ được','#f59e0b',5,false),
 ('si_phan_loai','Mất kết nối','#e11d48',6,true),
 ('si_phan_loai','Không tiềm năng','#8d99ae',7,false),
 ('le_trang_thai','Đang chăm sóc','#4361ee',1,true),
 ('le_trang_thai','Chưa liên hệ được','#f59e0b',2,true),
 ('le_trang_thai','Chốt đơn','#16a34a',3,true),
 ('le_trang_thai','Mất lead','#e11d48',4,true),
 ('cs_trang_thai','Chăm sóc định kỳ','#4361ee',1,true),
 ('cs_trang_thai','Chốt đơn','#16a34a',2,true),
 ('si_mo_hinh','Hộ Kinh Doanh','#0ea5e9',1,false),
 ('si_mo_hinh','Công Ty','#7209b7',2,false),
 ('si_tai_chinh','Thanh toán đúng hạn','#16a34a',1,false),
 ('si_tai_chinh','Công nợ xấu','#e11d48',2,false),
 ('si_nhom_kh','Khách buôn','#0ea5e9',1,false),
 ('si_nhom_kh','Đại Lí','#4361ee',2,false),
 ('si_nhom_kh','Đại Lí Chiến Lược','#7209b7',3,false),
 ('kenh_nhap_tay','Tiktok Chánh Tâm','#111827',1,false),
 ('kenh_nhap_tay','Tiktok Hiền Thuỷ','#111827',2,false),
 ('kenh_nhap_tay','Tiktok Shidai','#111827',3,false),
 ('kenh_nhap_tay','Tiktok Nến Bơ','#111827',4,false),
 ('kenh_nhap_tay','Website Chánh Tâm','#0ea5e9',5,false),
 ('kenh_nhap_tay','Website Hiền Thuỷ','#0ea5e9',6,false),
 ('kenh_nhap_tay','Facebook Chánh Tâm','#4361ee',7,false),
 ('kenh_nhap_tay','Facebook Hiền Thuỷ','#4361ee',8,false),
 ('kenh_nhap_tay','Facebook Shidai','#4361ee',9,false),
 ('kenh_nhap_tay','Facebook Nến Bơ','#4361ee',10,false),
 ('kenh_nhap_tay','Zalo','#0ea5e9',11,false),
 ('kenh_nhap_tay','Khách cũ giới thiệu','#16a34a',12,false),
 ('kenh_nhap_tay','Gọi trực tiếp','#f59e0b',13,false),
 ('kenh_nhap_tay','Khác','#8d99ae',14,false)
on conflict (loai, gia_tri) do nothing;
