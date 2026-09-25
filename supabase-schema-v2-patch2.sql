-- Patch 2: cho phép UPDATE thông tin khách (name/phone/address/...) từ client -- CRM không tạo khách mới
-- tay nữa (khách phải đến từ nguồn data đồng bộ), nhưng vẫn cần sửa được thông tin khách đã có.
drop policy if exists "anon update customers" on customers;
create policy "anon update customers" on customers for update to anon using (true) with check (true);
