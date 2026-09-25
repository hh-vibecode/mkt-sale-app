-- BẢO VỆ TÀI KHOẢN SUPREME LEADER (18/9/2026).
-- Yêu cầu: chỉ chính chủ thấy và sửa được tài khoản của mình trong trang Phân quyền; admin khác dù có
-- quyền "Phân quyền" cũng KHÔNG thấy, KHÔNG sửa, KHÔNG khoá được.
-- Lớp 1 (giao diện): renderSettings() lọc bỏ tài khoản position_title='supreme' nếu người đang đăng nhập
--                    không phải chính tài khoản đó.
-- Lớp 2 (ở đây): các hàm sửa tài khoản từ chối thao tác lên tài khoản supreme khi người gọi không phải
--                chính nó. App truyền p_actor = user_id đang đăng nhập.
-- Lưu ý thật thà: app chạy bằng anon key nên p_actor do client gửi lên, người biết kỹ thuật vẫn giả được.
-- Muốn chặn tuyệt đối thì phải chuyển sang Supabase Auth + RLS theo auth.uid(), là việc lớn hơn.

drop function if exists public.app_update_account(text,text,text,text,jsonb);
create or replace function public.app_update_account(
  p_user_id text, p_name text, p_position text, p_department text, p_permissions jsonb, p_actor text default null
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions'
as $$
declare r jsonb; tgt text;
begin
  if p_user_id is null then raise exception 'Thiếu user_id'; end if;
  if p_name is null or length(trim(p_name))<2 then raise exception 'Tên quá ngắn'; end if;
  select position_title into tgt from sales_users where user_id=p_user_id;
  if tgt='supreme' and coalesce(p_actor,'')<>p_user_id then
    raise exception 'Không có quyền sửa tài khoản này';
  end if;
  update sales_users set
    name=trim(p_name),
    position_title=nullif(trim(coalesce(p_position,'')),''),
    department=nullif(trim(coalesce(p_department,'')),''),
    permissions=coalesce(p_permissions,'[]'::jsonb)
  where user_id=p_user_id and has_login=true;
  if not found then raise exception 'Không tìm thấy tài khoản'; end if;
  select to_jsonb(u) into r from sales_users u where u.user_id=p_user_id;
  return r;
end;$$;

drop function if exists public.app_set_password(text,text);
drop function if exists public.app_deactivate_account(text);
create or replace function public.app_set_password(p_user_id text, p_password text, p_actor text default null)
returns boolean
language plpgsql security definer set search_path to 'public','extensions'
as $$
declare tgt text;
begin
  if p_password is null or length(p_password)<4 then raise exception 'Mật khẩu quá ngắn'; end if;
  select position_title into tgt from sales_users where user_id=p_user_id;
  if tgt='supreme' and coalesce(p_actor,'')<>p_user_id then
    raise exception 'Không có quyền đổi mật khẩu tài khoản này';
  end if;
  update sales_user_credentials set password_hash=crypt(p_password, gen_salt('bf')) where user_id=p_user_id;
  if not found then raise exception 'Tài khoản chưa có đăng nhập'; end if;
  return true;
end;$$;

-- Khoá tài khoản: chặn luôn trường hợp admin khác khoá tài khoản supreme.
create or replace function public.app_deactivate_account(p_user_id text, p_actor text default null)
returns boolean
language plpgsql security definer set search_path to 'public','extensions'
as $$
declare tgt text;
begin
  select position_title into tgt from sales_users where user_id=p_user_id;
  if tgt='supreme' and coalesce(p_actor,'')<>p_user_id then
    raise exception 'Không có quyền khoá tài khoản này';
  end if;
  update sales_users set has_login=false, status='inactive' where user_id=p_user_id;
  return found;
end;$$;

grant execute on function public.app_update_account(text,text,text,text,jsonb,text) to anon, authenticated;
grant execute on function public.app_set_password(text,text,text) to anon, authenticated;
grant execute on function public.app_deactivate_account(text,text) to anon, authenticated;
