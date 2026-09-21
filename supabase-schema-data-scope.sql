-- PHÂN QUYỀN DỮ LIỆU THEO NGƯỜI PHỤ TRÁCH + LOẠI SỈ/LẺ (21/9/2026).
-- Yêu cầu: mỗi tài khoản chọn được xem data của những Sale nào; Sale thường chỉ thấy khách của mình.
-- Sỉ và Lẻ tách riêng: tài khoản chỉ làm Lẻ thì không thấy data Sỉ và ngược lại.
--   data_sales : mảng TÊN Sale được xem (rỗng = xem tất cả)
--   data_types : mảng loại đơn được xem, 'Lẻ' / 'Sỉ' (rỗng = xem tất cả)
-- Quy ước "rỗng = tất cả" để mọi tài khoản cũ giữ nguyên hành vi, khỏi phải cấu hình lại.
alter table public.sales_users add column if not exists data_sales jsonb not null default '[]'::jsonb;
alter table public.sales_users add column if not exists data_types jsonb not null default '[]'::jsonb;

-- app_login trả to_jsonb(cả dòng) nên 2 cột này tự có trong kết quả đăng nhập, không phải sửa.

drop function if exists public.app_create_account(text,text,text,text,text,jsonb);
create or replace function public.app_create_account(
  p_name text, p_username text, p_password text, p_position text, p_department text,
  p_permissions jsonb, p_data_sales jsonb default '[]'::jsonb, p_data_types jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions'
as $$
declare uid text; r jsonb;
begin
  if p_username is null or length(trim(p_username))<3 then raise exception 'Username quá ngắn'; end if;
  if p_password is null or length(p_password)<4 then raise exception 'Mật khẩu quá ngắn'; end if;
  select user_id into uid from sales_user_credentials where lower(username)=lower(p_username);
  if uid is null then uid := 'SR_'||lower(regexp_replace(p_username,'[^a-zA-Z0-9]','','g'))||'_'||substr(md5(random()::text),1,4); end if;
  insert into sales_users(user_id,name,department,role,status,username,position_title,has_login,permissions,data_sales,data_types)
  values(uid,trim(p_name),nullif(trim(coalesce(p_department,'')),''),'sales','active',trim(p_username),
         nullif(trim(coalesce(p_position,'')),''),true,coalesce(p_permissions,'[]'::jsonb),
         coalesce(p_data_sales,'[]'::jsonb),coalesce(p_data_types,'[]'::jsonb))
  on conflict (user_id) do update set
    name=excluded.name, department=excluded.department, status='active', username=excluded.username,
    position_title=excluded.position_title, has_login=true, permissions=excluded.permissions,
    data_sales=excluded.data_sales, data_types=excluded.data_types;
  insert into sales_user_credentials(user_id,username,password_hash)
  values(uid,trim(p_username),crypt(p_password,gen_salt('bf')))
  on conflict (user_id) do update set username=excluded.username, password_hash=excluded.password_hash;
  select to_jsonb(su) into r from sales_users su where su.user_id=uid;
  return r;
end;$$;

drop function if exists public.app_update_account(text,text,text,text,jsonb,text);
create or replace function public.app_update_account(
  p_user_id text, p_name text, p_position text, p_department text, p_permissions jsonb,
  p_actor text default null, p_data_sales jsonb default null, p_data_types jsonb default null
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
    permissions=coalesce(p_permissions,'[]'::jsonb),
    data_sales=coalesce(p_data_sales,data_sales),
    data_types=coalesce(p_data_types,data_types)
  where user_id=p_user_id and has_login=true;
  if not found then raise exception 'Không tìm thấy tài khoản'; end if;
  select to_jsonb(su) into r from sales_users su where su.user_id=p_user_id;
  return r;
end;$$;

grant execute on function public.app_create_account(text,text,text,text,text,jsonb,jsonb,jsonb) to anon, authenticated;
grant execute on function public.app_update_account(text,text,text,text,jsonb,text,jsonb,jsonb) to anon, authenticated;
