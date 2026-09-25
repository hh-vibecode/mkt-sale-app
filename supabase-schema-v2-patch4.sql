-- Patch 4: cho phép client ghi vào audit_log (trước đó chỉ có SELECT, thiếu INSERT nên crmAudit() sẽ bị RLS chặn).
drop policy if exists "anon insert audit_log" on audit_log;
create policy "anon insert audit_log" on audit_log for insert to anon with check (true);
