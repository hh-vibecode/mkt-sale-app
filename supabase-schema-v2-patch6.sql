-- Patch 6: Quản trị tài khoản (Admin > Cài đặt) -- tạo tài khoản có Vị trí + Quyền truy cập, thay cho
-- AUTH_USERS hardcode trong code và thay cho "Sales phụ trách" đang lấy tràn từ 40 tên lịch sử trong data.
--
-- LƯU Ý BẢO MẬT: mật khẩu KHÔNG lưu ở bảng sales_users (bảng đó anon đọc được thoải mái để hiện dropdown
-- Sales phụ trách) -- mật khẩu tách riêng bảng sales_user_credentials, bảng này KHÔNG có policy nào cho anon
-- (không SELECT/INSERT/UPDATE trực tiếp được), chỉ đọc/ghi được qua 2 hàm SECURITY DEFINER bên dưới, và
-- được băm bằng bcrypt (pgcrypto) chứ không lưu chữ thường. Đây là mức bảo mật hợp lý cho app nội bộ chạy
-- 100% client-side (không có server riêng) -- vẫn còn hạn chế: ai có anon key cũng gọi được RPC tạo tài khoản
-- (không có cách nào ngăn tuyệt đối ở kiến trúc thuần tĩnh này), nhưng KHÔNG BAO GIỜ lộ mật khẩu người khác.

create extension if not exists pgcrypto;

alter table sales_users add column if not exists username text;
alter table sales_users add column if not exists position_title text; -- Vị trí: admin/manager/sales/mkt
alter table sales_users add column if not exists has_login boolean not null default false;
alter table sales_users add column if not exists permissions jsonb; -- mảng trang được xem, vd '["workspace","crm","orders"]'

create table if not exists sales_user_credentials (
  user_id text primary key references sales_users(user_id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
alter table sales_user_credentials enable row level security;
-- Cố tình KHÔNG tạo policy nào cho anon trên bảng này -- mặc định RLS bật + không có policy = chặn tất cả.

-- Kiểm tra đăng nhập: nhận username/password thô, trả về thông tin tài khoản (KHÔNG bao giờ trả password).
create or replace function app_login(p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  select to_jsonb(su) - 'created_at' - 'updated_at' into r
  from sales_user_credentials c
  join sales_users su on su.user_id = c.user_id
  where lower(c.username) = lower(p_username)
    and c.password_hash = crypt(p_password, c.password_hash)
    and su.status = 'active';
  return r;
end;
$$;
revoke all on function app_login(text,text) from public;
grant execute on function app_login(text,text) to anon;

-- Tạo/cập nhật tài khoản (dùng trong màn Admin > Cài đặt).
create or replace function app_create_account(
  p_name text, p_username text, p_password text, p_position text,
  p_department text, p_permissions jsonb
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare uid text; r jsonb;
begin
  if p_username is null or length(trim(p_username))<3 then raise exception 'Username quá ngắn'; end if;
  if p_password is null or length(p_password)<4 then raise exception 'Mật khẩu quá ngắn'; end if;
  select user_id into uid from sales_user_credentials where lower(username)=lower(p_username);
  if uid is null then uid := 'SR_'||lower(regexp_replace(p_username,'[^a-zA-Z0-9]','','g'))||'_'||substr(md5(random()::text),1,4); end if;
  insert into sales_users(user_id,name,department,role,status,position_title,has_login,permissions,username)
  values(uid,p_name,p_department,'sales','active',p_position,true,p_permissions,p_username)
  on conflict (user_id) do update set
    name=excluded.name,department=excluded.department,position_title=excluded.position_title,
    permissions=excluded.permissions,has_login=true,username=excluded.username,status='active';
  insert into sales_user_credentials(user_id,username,password_hash)
  values(uid,p_username,crypt(p_password,gen_salt('bf')))
  on conflict (user_id) do update set username=excluded.username,password_hash=crypt(p_password,gen_salt('bf'));
  select to_jsonb(su)-'created_at'-'updated_at' into r from sales_users su where su.user_id=uid;
  return r;
end;
$$;
revoke all on function app_create_account(text,text,text,text,text,jsonb) from public;
grant execute on function app_create_account(text,text,text,text,text,jsonb) to anon;

-- Vô hiệu hoá tài khoản (không xoá, để không mất lịch sử gán Lead/Activity của user_id đó).
create or replace function app_deactivate_account(p_user_id text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update sales_users set status='inactive' where user_id=p_user_id;
end;
$$;
revoke all on function app_deactivate_account(text) from public;
grant execute on function app_deactivate_account(text) to anon;
