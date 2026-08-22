-- Patch 5: Follow-up là first-class feature (spec UX redesign 22/8) -- next_followup_date phải ghi được
-- mỗi lần tạo Activity (lịch sử "lúc đó hẹn ngày nào"), và leads.next_followup_date tự cập nhật theo
-- Activity mới nhất -- giống hệt cách lead_status/current_potential_value đã tự tính từ trước.
alter table crm_activities add column if not exists next_followup_date date;

create or replace function refresh_lead_current_state() returns trigger as $$
declare
  lid text;
  latest record;
begin
  lid := coalesce(new.lead_id, old.lead_id);
  if lid is null then return null; end if;
  select status_after_activity, potential_value, next_followup_date into latest
    from crm_activities where lead_id = lid order by activity_date desc, activity_id desc limit 1;
  update leads set
    lead_status = latest.status_after_activity,
    current_potential_value = latest.potential_value,
    next_followup_date = latest.next_followup_date,
    updated_at = now()
  where lead_id = lid;
  return null;
end;
$$ language plpgsql;

-- Thêm status mới theo spec Activity form (mục 9): Chờ phản hồi/Có nhu cầu/Không có nhu cầu
insert into config_options(category,value,label,sort_order) values
  ('status','Chờ phản hồi','Chờ phản hồi',5),
  ('status','Có nhu cầu','Có nhu cầu',6),
  ('status','Không có nhu cầu','Không có nhu cầu',7)
on conflict (category,value) do nothing;
