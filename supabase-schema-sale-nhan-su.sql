-- Danh sách NHÂN SỰ SALE dùng cho mọi dropdown / bộ lọc trong app.
-- Trước đây nằm cứng trong index.html nên thêm người phải sửa code rồi deploy lại.
-- Từ 24/9/2026: quản lý ngay trong app tại Data Hub -> tab "Nhân sự Sale" (chỉ Admin trở lên sửa được).
create table if not exists public.sale_nhan_su (
  id          bigint generated always as identity primary key,
  ten         text not null unique,              -- ghi ĐÚNG tên hiển thị bên Pancake / Kiot
  doi         text not null default 'Lẻ',        -- 'Lẻ' | 'Sỉ'
  ghi_chu     text,
  dang_lam    boolean not null default true,     -- cho nghỉ thì bỏ khỏi dropdown, data cũ vẫn giữ
  created_at  timestamptz not null default now(),
  created_by  text
);

alter table public.sale_nhan_su enable row level security;
drop policy if exists sale_nhan_su_doc on public.sale_nhan_su;
create policy sale_nhan_su_doc on public.sale_nhan_su for select using (true);
drop policy if exists sale_nhan_su_ghi on public.sale_nhan_su;
create policy sale_nhan_su_ghi on public.sale_nhan_su for all using (true) with check (true);

notify pgrst, 'reload schema';
