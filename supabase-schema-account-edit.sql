-- SỬA TÀI KHOẢN + ĐẶT LẠI MẬT KHẨU (trang Phân quyền).
-- Trước đây chỉ có tạo mới và khoá -> tài khoản tạo xong là không đổi được quyền, phải xoá tạo lại.
-- Cả 2 hàm đều SECURITY DEFINER giống app_create_account: app gọi bằng anon key, RLS không cho ghi thẳng
-- vào sales_users/sales_user_credentials.

create or replace function public.app_update_account(
  p_user_id text, p_name text, p_position text, p_department text, p_permissions jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions'
as $$
declare r jsonb;
begin
  if p_user_id is null then raise exception 'Thiếu user_id'; end if;
  if p_name is null or length(trim(p_name))<2 then raise exception 'Tên quá ngắn'; end if;
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

-- Đặt lại mật khẩu. Hash y như app_create_account (crypt/bf) để app_login() kiểm tra được.
create or replace function public.app_set_password(p_user_id text, p_password text)
returns boolean
language plpgsql security definer set search_path to 'public','extensions'
as $$
begin
  if p_password is null or length(p_password)<4 then raise exception 'Mật khẩu quá ngắn'; end if;
  update sales_user_credentials set password_hash=crypt(p_password, gen_salt('bf'))
  where user_id=p_user_id;
  if not found then raise exception 'Tài khoản chưa có đăng nhập'; end if;
  return true;
end;$$;

-- Mở lại tài khoản đã khoá (đối xứng với app_deactivate_account).
create or replace function public.app_reactivate_account(p_user_id text)
returns boolean
language plpgsql security definer set search_path to 'public','extensions'
as $$
begin
  update sales_users set has_login=true, status='active' where user_id=p_user_id;
  return found;
end;$$;

grant execute on function public.app_update_account(text,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.app_set_password(text,text) to anon, authenticated;
grant execute on function public.app_reactivate_account(text) to anon, authenticated;
