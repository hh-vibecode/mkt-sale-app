-- Patch 3: bổ sung field bị thiếu so với báo cáo Sale gốc (v1 saonl_customers) khi migrate lần đầu.
alter table customers add column if not exists legacy_ma_kh text;   -- Mã KH gốc (khác customer_id sinh mới)
alter table leads add column if not exists product_need text;       -- Nhu cầu ban đầu lúc lead vào
alter table customers add column if not exists status_legacy text;  -- field "Phân loại KH" cũ trên saonl_customers (khác lead_status)

-- Cho phép UPDATE leads từ client (đổi Sales phụ trách/nhu cầu) -- CRM data, Sale được sửa.
drop policy if exists "anon update leads" on leads;
create policy "anon update leads" on leads for update to anon using (true) with check (true);
