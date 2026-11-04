-- BÁO CÁO CÔNG VIỆC HẰNG NGÀY (anh Hải 04/11/2026): Sale kéo khách vào các đầu mục chăm sóc -> kế hoạch gửi quản lý đầu ngày;
-- cuối ngày app tự tổng kết từ lịch sử chăm sóc đã ghi (salesi_crm) + đơn Kiot phát sinh, Sale ghi chú từng việc rồi CHỐT.
-- LƯU LỊCH SỬ THEO NGÀY: mỗi người mỗi ngày 1 dòng cong_viec_ngay + n dòng cong_viec_muc; lúc chốt, kết quả được chụp vào ket_qua
-- (jsonb) để xem lại ngày cũ đúng như lúc chốt dù lịch sử chăm sóc sau này có sửa.
-- QUYỀN NGAY TRONG CSDL: người tạo chỉ thấy / sửa của mình (app_user_id trong thẻ phiên dang-nhap), Admin / Supreme / quyền '*' xem hết
-- (chỉ xem, không sửa hộ). Monsieur Claude.
create table if not exists public.cong_viec_ngay (
  id          bigint generated always as identity primary key,
  ngay        date not null,
  nguoi_id    text not null,                -- sales_users.user_id (= app_metadata.app_user_id của thẻ phiên)
  nguoi       text,                         -- tên hiển thị lúc tạo
  gui_luc     timestamptz,                  -- lúc gửi kế hoạch cho quản lý
  chot_luc    timestamptz,                  -- lúc chốt báo cáo cuối ngày
  ghi_chu_sang text,                        -- ghi chú chung của kế hoạch
  ghi_chu_toi  text,                        -- tổng kết chung cuối ngày
  tong_ket    jsonb,                        -- số liệu chụp lúc chốt (kế hoạch / đã xử lý / chốt đơn / ngoài kế hoạch...)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (ngay, nguoi_id)
);
create table if not exists public.cong_viec_muc (
  id          bigint generated always as identity primary key,
  ngay        date not null,
  nguoi_id    text not null,
  nguoi       text,
  dau_muc     text not null,                -- đầu mục (danh_muc loai 'cv_dau_muc')
  lead_id     text not null,                -- khoá khách trong app (key của Master)
  loai        text,                         -- Lẻ / Sỉ
  kiot_code   text,
  ten_khach   text,
  phan_loai   text,                         -- phân loại lúc lên kế hoạch
  muc_tieu    text,                         -- Sale ghi mục tiêu buổi sáng
  ghi_chu     text,                         -- Sale ghi chú cuối ngày
  ket_qua     jsonb,                        -- chụp lúc chốt: lượt chăm sóc + đơn trong ngày
  thu_tu      int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (ngay, nguoi_id, lead_id)          -- 1 khách 1 việc / người / ngày -> kéo trùng không tạo dòng thứ 2
);
create index if not exists cong_viec_ngay_ngay on public.cong_viec_ngay (ngay desc);
create index if not exists cong_viec_muc_ngay  on public.cong_viec_muc (ngay desc, nguoi_id);

create or replace function public.cv_toi() returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'app_user_id', '');
$$;
create or replace function public.cv_xem_het() returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce(auth.role(), '') = 'service_role'
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'position', '') in ('admin', 'supreme')
      or coalesce(auth.jwt() -> 'app_metadata' -> 'permissions', '[]'::jsonb) ? '*';
$$;
revoke execute on function public.cv_toi(), public.cv_xem_het() from anon, public;
grant execute on function public.cv_toi(), public.cv_xem_het() to authenticated, service_role;

alter table public.cong_viec_ngay enable row level security;
alter table public.cong_viec_muc  enable row level security;
do $$ declare t text; begin
  foreach t in array array['cong_viec_ngay','cong_viec_muc'] loop
    execute format('drop policy if exists %1$s_xem on public.%1$s', t);
    execute format('drop policy if exists %1$s_them on public.%1$s', t);
    execute format('drop policy if exists %1$s_sua on public.%1$s', t);
    execute format('drop policy if exists %1$s_xoa on public.%1$s', t);
    execute format('create policy %1$s_xem on public.%1$s for select to authenticated using (nguoi_id = public.cv_toi() or public.cv_xem_het())', t);
    execute format('create policy %1$s_them on public.%1$s for insert to authenticated with check (nguoi_id = public.cv_toi())', t);
    execute format('create policy %1$s_sua on public.%1$s for update to authenticated using (nguoi_id = public.cv_toi()) with check (nguoi_id = public.cv_toi())', t);
    execute format('create policy %1$s_xoa on public.%1$s for delete to authenticated using (nguoi_id = public.cv_toi())', t);
    execute format('revoke all on public.%1$s from anon', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
  end loop;
end $$;

-- Đầu mục mặc định (admin sửa bằng bút ✏ trên trang)
insert into public.danh_muc (loai, gia_tri, mau, thu_tu, he_thong) values
 ('cv_dau_muc','Gọi / nhắn chăm sóc','#0ea5e9',1,false),
 ('cv_dau_muc','Tư vấn, gửi báo giá','#8b5cf6',2,false),
 ('cv_dau_muc','Chốt đơn','#16a34a',3,false),
 ('cv_dau_muc','Chăm sau bán','#f59e0b',4,false),
 ('cv_dau_muc','Thu tiền, cọc','#e11d48',5,false)
on conflict (loai, gia_tri) do nothing;
