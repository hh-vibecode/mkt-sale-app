-- Patch 7: cho anon đọc sync_log (Data Hub cần hiện Sync History) -- bảng này trước đó bật RLS nhưng
-- chưa có policy SELECT nào nên anon đọc rỗng/lỗi.
drop policy if exists "anon read sync_log" on sync_log;
create policy "anon read sync_log" on sync_log for select using (true);
