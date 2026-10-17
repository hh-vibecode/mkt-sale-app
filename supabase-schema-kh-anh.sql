-- ẢNH / TÀI LIỆU TRONG HỒ SƠ KHÁCH (anh Hải 17/10/2026: "thêm ảnh vào profile khách hàng" -- nhận diện cửa hàng, tình trạng).
-- File nằm ở Storage bucket RIÊNG TƯ 'kh-anh' (không công khai), bảng kh_anh giữ danh sách file của từng khách.
-- Chỉ người đã đăng nhập app (thẻ phiên 'authenticated', giống salesi_crm) đọc / thêm / xoá. Monsieur Claude.
create table if not exists public.kh_anh(
  id bigserial primary key,
  lead_id text,                 -- khoá khách trong app (leadId của dòng Master)
  kiot_code text,               -- Mã KH Kiot lúc tải lên (khách đổi khoá vẫn tìm ra)
  loai text,                    -- Lẻ / Sỉ
  ten text,                     -- tên file gốc
  duong_dan text not null,      -- đường dẫn trong bucket kh-anh
  mime text,
  kich_thuoc integer,
  ghi_chu text,
  created_by text,
  created_at timestamptz not null default now());
create index if not exists kh_anh_lead_idx on public.kh_anh(lead_id);
create index if not exists kh_anh_ma_idx on public.kh_anh(kiot_code);
alter table public.kh_anh enable row level security;
drop policy if exists kh_anh_read on public.kh_anh;
drop policy if exists kh_anh_ins on public.kh_anh;
drop policy if exists kh_anh_upd on public.kh_anh;
drop policy if exists kh_anh_del on public.kh_anh;
create policy kh_anh_read on public.kh_anh for select to authenticated using (true);
create policy kh_anh_ins on public.kh_anh for insert to authenticated with check (true);
create policy kh_anh_upd on public.kh_anh for update to authenticated using (true) with check (true);
create policy kh_anh_del on public.kh_anh for delete to authenticated using (true);
revoke all on public.kh_anh from anon;
grant select,insert,update,delete on public.kh_anh to authenticated;
grant usage,select on sequence public.kh_anh_id_seq to authenticated;

-- bucket riêng tư, tối đa 10 MB / file, chỉ ảnh + PDF
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kh-anh','kh-anh',false,10485760,array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists kh_anh_obj_read on storage.objects;
drop policy if exists kh_anh_obj_ins on storage.objects;
drop policy if exists kh_anh_obj_del on storage.objects;
create policy kh_anh_obj_read on storage.objects for select to authenticated using (bucket_id='kh-anh');
create policy kh_anh_obj_ins on storage.objects for insert to authenticated with check (bucket_id='kh-anh');
create policy kh_anh_obj_del on storage.objects for delete to authenticated using (bucket_id='kh-anh');

-- LEADER SALE (anh Hải 17/10/2026): Khánh Nguyên lên Leader Sale, giao việc cho Sale trong phạm vi xem (Bùi Thị Kim Oanh...)
update public.sales_users set position_title='leader' where user_id='SR_khanhnguyen_c35d';
