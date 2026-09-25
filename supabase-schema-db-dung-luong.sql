-- Hàm đọc dung lượng kho dữ liệu cho mục "Kho dữ liệu" ở đầu trang Data Hub.
-- SECURITY DEFINER vì pg_stat_user_tables / pg_database_size không mở cho vai anon.
-- Chỉ trả về tên bảng, số dòng và kích thước -- không đụng tới nội dung dữ liệu.
create or replace function public.db_dung_luong()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'tong_bytes', pg_database_size(current_database()),
    'luc', now(),
    'bang', (
      select coalesce(json_agg(x order by x.bytes desc), '[]'::json) from (
        select c.relname as ten, s.n_live_tup as dong,
               pg_total_relation_size(c.oid) as bytes
        from pg_class c join pg_stat_user_tables s on s.relid = c.oid
        where c.relnamespace = 'public'::regnamespace
      ) x
    )
  );
$$;

grant execute on function public.db_dung_luong() to anon, authenticated;
notify pgrst, 'reload schema';
