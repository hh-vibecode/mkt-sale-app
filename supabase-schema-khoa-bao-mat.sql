-- KHOÁ BẢO MẬT CSDL (24/9/2026, Monsieur Claude)
-- Trước: mọi bảng mở cho khoá công khai (anon) -> ai có khoá (nằm trong index.html, repo public) cũng đọc /
-- ghi / xoá được, gọi được cả hàm tạo tài khoản, đổi mật khẩu, khôi phục sao lưu.
-- Sau:   chỉ NGƯỜI ĐÃ ĐĂNG NHẬP APP (thẻ phiên JWT do Edge Function dang-nhap cấp, role 'authenticated')
--        mới đọc / ghi được. Job đồng bộ dùng khoá quản trị (service_role) -> không bị ảnh hưởng.
--        Hàm quản lý tài khoản chỉ Supreme hoặc người có quyền Phân quyền ('settings' / '*') gọi được.
-- MỞ LẠI KHẨN CẤP: xem supabase-schema-mo-khoa-khan-cap.sql

-- 1) Mọi policy trong schema public: chỉ áp cho người đã đăng nhập
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
  end loop;
end $$;

-- 2) Khoá công khai không còn quyền gì trên bảng / view / sequence (kể cả bảng tạo sau này)
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- 3) Hàm: không ai gọi được trừ khi được cấp riêng
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke execute on functions from anon, public;
grant execute on all functions in schema public to service_role;   -- job đồng bộ, Edge Function
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('app_create_account','app_update_account','app_set_password',
                               'app_deactivate_account','app_reactivate_account','db_dung_luong') loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
-- app_login chỉ còn gọi qua Edge Function dang-nhap (khoá quản trị) -> không cấp cho ai khác.
-- goi_sync / chup_backup / khoi_phuc_backup: chỉ lịch hẹn giờ trên CSDL (postgres) và khoá quản trị.

-- 4) Hàm quản lý tài khoản: kiểm quyền NGAY TRONG CSDL (không tin vào trình duyệt)
create or replace function public.la_quan_tri() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce(auth.role(), '') = 'service_role'
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'position', '') = 'supreme'
      or coalesce(auth.jwt() -> 'app_metadata' -> 'permissions', '[]'::jsonb) ?| array['*', 'settings'];
$$;
revoke execute on function public.la_quan_tri() from anon, public;
grant execute on function public.la_quan_tri() to authenticated, service_role;
do $$ declare f record; d text; begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('app_create_account','app_update_account','app_set_password',
                               'app_deactivate_account','app_reactivate_account') loop
    d := pg_get_functiondef(f.oid);
    if position('la_quan_tri()' in d) = 0 then
      d := regexp_replace(d, E'\nbegin\n',
        E'\nbegin\n  if not public.la_quan_tri() then raise exception ''Không có quyền quản lý tài khoản''; end if;\n', 'i');
      execute d;
    end if;
  end loop;
end $$;

-- 5) NGOẠI LỆ cho DASHBOARD CŨ (repo Dashboard-Meta, vẫn đang dùng) -- nó gọi bằng khoá công khai, không có
--    thẻ phiên. Chỉ mở lại 3 bảng KHÔNG chứa dữ liệu khách / doanh thu:
--      product_faq       (Edge faq-chat đọc nội dung FAQ)      -> chỉ đọc
--      dash_presence     (ai đang online trên dashboard)       -> đọc + ghi
--      social_page_stats (số liệu page mạng xã hội)            -> chỉ đọc
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('product_faq','dash_presence','social_page_stats') loop
    execute format('alter policy %I on public.%I to public', p.policyname, p.tablename);
  end loop;
end $$;
grant select on public.product_faq, public.social_page_stats to anon;
grant select, insert, update on public.dash_presence to anon;
