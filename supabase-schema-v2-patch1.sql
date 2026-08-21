-- Patch 1 cho schema v2: thêm trạng thái "hiện tại" trên Lead (next_followup_date, current_potential_value)
-- và trigger tự cập nhật từ crm_activities mới nhất -- đúng spec mục 11/12: Sale chỉ tạo Activity,
-- KHÔNG được tự sửa "trạng thái hiện tại"/"ngày chăm sóc cuối" tay.
alter table leads add column if not exists next_followup_date date;
alter table leads add column if not exists current_potential_value numeric(14,2);

create or replace function refresh_lead_current_state() returns trigger as $$
declare
  lid text;
  latest record;
begin
  lid := coalesce(new.lead_id, old.lead_id);
  if lid is null then return null; end if;
  select status_after_activity, potential_value into latest
    from crm_activities where lead_id = lid order by activity_date desc, activity_id desc limit 1;
  update leads set
    lead_status = latest.status_after_activity,
    current_potential_value = latest.potential_value,
    updated_at = now()
  where lead_id = lid;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_activities_lead_state on crm_activities;
create trigger trg_activities_lead_state
after insert or update or delete on crm_activities
for each row execute function refresh_lead_current_state();
