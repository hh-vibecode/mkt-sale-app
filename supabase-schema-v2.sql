-- =========================================================
-- Supabase schema v2: Customer/Lead/Activity/Order data model
-- Thay thế mô hình "1 sheet phẳng" (saonl_customers/saonl_care_log) bằng CRM thực sự,
-- theo spec DATAHUB + CRM + SALES APP (21/8/2026). Bảng cũ GIỮ NGUYÊN, không xoá/đổi tên
-- -- app hiện tại vẫn đọc bảng cũ bình thường cho tới khi cutover xong màn hình CRM mới.
-- =========================================================

-- ---------- Danh mục cấu hình được (Admin có thể thêm/sửa/ẩn, không hard-code) ----------
create table if not exists config_options (
  id bigint generated always as identity primary key,
  category text not null,      -- 'customer_group' | 'customer_type' | 'contact_method' | 'status' | 'lost_group' | 'department'
  value text not null,
  label text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(category, value)
);

-- ---------- Sales Users ----------
create table if not exists sales_users (
  user_id text primary key,
  name text not null,
  email text,
  department text,
  role text not null default 'sales' check (role in ('admin','manager','sales')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

-- ---------- Customer: 1 khách = 1 dòng, dedupe theo SĐT khi migrate ----------
create table if not exists customers (
  customer_id text primary key,      -- 'CUS' + số thứ tự, sinh khi migrate/tạo mới
  name text not null,
  phone text,
  address text,
  province text,
  district text,
  customer_group text,               -- tham chiếu config_options(category='customer_group')
  customer_type text,                -- tham chiếu config_options(category='customer_type')
  last_contact_date date,            -- DERIVED = MAX(crm_activities.activity_date), trigger tự tính, không cho Sale sửa tay
  total_revenue numeric(14,2) not null default 0, -- DERIVED = SUM(orders.revenue), trigger tự tính
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_phone on customers(phone);

-- ---------- Lead: 1 khách có thể có nhiều Lead (nhiều nguồn/nhiều lần liên hệ) ----------
create table if not exists leads (
  lead_id text primary key,          -- giữ nguyên Lead ID gốc khi migrate từ saonl_customers, để không mất định danh lịch sử
  customer_id text not null references customers(customer_id) on delete cascade,
  source text,                       -- Online/Offline
  channel text,                      -- Facebook Chánh Tâm/Nến Bơ/Shidai/Thị trường MT/...
  source_external_id text,           -- Conversation ID/External ID từ DataHub/Pancake, dùng để sync idempotent
  ad_id text,
  department text,
  assigned_sales text references sales_users(user_id),
  lead_status text,                  -- tham chiếu config_options(category='status')
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_customer on leads(customer_id);
create index if not exists idx_leads_sales on leads(assigned_sales);
create index if not exists idx_leads_external on leads(source_external_id);

-- ---------- Assignment: lịch sử phân bổ Lead cho Sale ----------
create table if not exists assignments (
  id bigint generated always as identity primary key,
  lead_id text not null references leads(lead_id) on delete cascade,
  sales_id text references sales_users(user_id),
  assigned_at timestamptz not null default now(),
  assigned_by text,
  assignment_type text not null default 'manual' check (assignment_type in ('manual','round_robin','rule_based','imported'))
);
create index if not exists idx_assignments_lead on assignments(lead_id);

-- ---------- CRM Activity: 1 lần chăm sóc = 1 dòng, KHÔNG bao giờ overwrite ----------
create table if not exists crm_activities (
  activity_id bigint generated always as identity primary key,
  customer_id text not null references customers(customer_id) on delete cascade,
  lead_id text references leads(lead_id) on delete set null,
  sales_id text references sales_users(user_id),
  activity_date date not null,
  contact_method text,                -- tham chiếu config_options(category='contact_method'): Gọi điện/Facebook/Zalo/...
  conversation_content text,
  status_after_activity text,         -- tham chiếu config_options(category='status')
  potential_value numeric(14,2),      -- Giá trị tiềm năng, KHÁC với doanh thu thật (orders.revenue)
  lost_group text,                    -- chỉ có ý nghĩa khi status_after_activity = 'Mất lead'
  lost_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activities_customer on crm_activities(customer_id);
create index if not exists idx_activities_lead on crm_activities(lead_id);
create index if not exists idx_activities_date on crm_activities(activity_date);

-- ---------- Order: 1 khách có thể có nhiều đơn, KHÔNG nhập tay "doanh thu cộng dồn" ----------
create table if not exists orders (
  order_id bigint generated always as identity primary key,
  customer_id text not null references customers(customer_id) on delete cascade,
  lead_id text references leads(lead_id) on delete set null,
  order_date date not null,
  revenue numeric(14,2) not null default 0,
  product text,
  sales_id text references sales_users(user_id),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists idx_orders_customer on orders(customer_id);
create index if not exists idx_orders_date on orders(order_date);

-- ---------- Audit Log: ai đổi gì, khi nào ----------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  user_name text,
  action text not null,
  object_type text not null,          -- 'customer' | 'lead' | 'activity' | 'order' | 'assignment'
  object_id text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_object on audit_log(object_type, object_id);

-- ---------- Sync Log: theo dõi các lần đồng bộ từ DataHub/Pancake ----------
create table if not exists sync_log (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_created int not null default 0,
  records_updated int not null default 0,
  status text not null default 'running' check (status in ('running','success','failed')),
  error_message text
);

-- ---------- Triggers: total_revenue + last_contact_date luôn tự tính, không cho nhập tay ----------
create or replace function refresh_customer_stats() returns trigger as $$
declare
  cid text;
begin
  cid := coalesce(new.customer_id, old.customer_id);
  update customers c set
    total_revenue = coalesce((select sum(revenue) from orders where customer_id=cid and status='confirmed'),0),
    last_contact_date = (select max(activity_date) from crm_activities where customer_id=cid),
    updated_at = now()
  where c.customer_id = cid;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_stats on orders;
create trigger trg_orders_stats
after insert or update or delete on orders
for each row execute function refresh_customer_stats();

drop trigger if exists trg_activities_stats on crm_activities;
create trigger trg_activities_stats
after insert or update or delete on crm_activities
for each row execute function refresh_customer_stats();

create or replace function touch_updated_at_v2() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customers_touch on customers;
create trigger trg_customers_touch before update on customers
for each row execute function touch_updated_at_v2();

drop trigger if exists trg_leads_touch on leads;
create trigger trg_leads_touch before update on leads
for each row execute function touch_updated_at_v2();

-- ---------- RLS: đọc mở cho anon (dashboard không đăng nhập), ghi hạn chế ----------
alter table config_options enable row level security;
alter table sales_users enable row level security;
alter table customers enable row level security;
alter table leads enable row level security;
alter table assignments enable row level security;
alter table crm_activities enable row level security;
alter table orders enable row level security;
alter table audit_log enable row level security;
alter table sync_log enable row level security;

drop policy if exists "anon read config_options" on config_options;
create policy "anon read config_options" on config_options for select using (true);
drop policy if exists "anon read sales_users" on sales_users;
create policy "anon read sales_users" on sales_users for select using (true);
drop policy if exists "anon read customers" on customers;
create policy "anon read customers" on customers for select using (true);
drop policy if exists "anon read leads" on leads;
create policy "anon read leads" on leads for select using (true);
drop policy if exists "anon read assignments" on assignments;
create policy "anon read assignments" on assignments for select using (true);
drop policy if exists "anon read crm_activities" on crm_activities;
create policy "anon read crm_activities" on crm_activities for select using (true);
drop policy if exists "anon read orders" on orders;
create policy "anon read orders" on orders for select using (true);
drop policy if exists "anon read audit_log" on audit_log;
create policy "anon read audit_log" on audit_log for select using (true);

-- Ghi (insert) từ client: chỉ những bảng Sale thao tác trực tiếp qua App (giống mức rủi ro đã chấp nhận
-- cho saonl_customers/saonl_care_log trước đây -- app dùng nội bộ). Update/delete và các bảng còn lại
-- (assignments, sync_log, sales_users, config_options) chỉ qua service_role (sync engine/admin backend).
drop policy if exists "anon insert customers" on customers;
create policy "anon insert customers" on customers for insert to anon with check (true);
drop policy if exists "anon insert leads" on leads;
create policy "anon insert leads" on leads for insert to anon with check (true);
drop policy if exists "anon insert crm_activities" on crm_activities;
create policy "anon insert crm_activities" on crm_activities for insert to anon with check (true);
drop policy if exists "anon insert orders" on orders;
create policy "anon insert orders" on orders for insert to anon with check (true);
