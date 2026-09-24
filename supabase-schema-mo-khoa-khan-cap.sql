-- MỞ KHOÁ KHẨN CẤP (Monsieur Claude, 24/9/2026) -- đưa CSDL về như TRƯỚC khi chạy supabase-schema-khoa-bao-mat.sql
-- Chỉ dùng khi khoá xong mà app bị gãy và cần chạy lại ngay. Chạy xong nhớ:
--   * đặt SB_BAT_BUOC_PHIEN=false trong index.html (nếu không app vẫn bắt đăng nhập lại);
--   * đặt secret BAT_BUOC_PHIEN=0 cho Edge Function (pancake-note, sync-now).
-- Kiểm quyền trong hàm quản lý tài khoản (la_quan_tri) vẫn GIỮ: người đăng nhập có thẻ phiên vẫn dùng bình thường.

do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('alter policy %I on public.%I to public', p.policyname, p.tablename);
  end loop;
end $$;
grant select, insert, update, delete on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;
grant execute on all functions in schema public to anon, public;
