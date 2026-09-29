-- CẬP NHẬT NGÀY NHẮN CUỐI THEO LÔ (29/9/2026): trước đây job ghi từng đơn 1 lệnh PATCH (tới 250 lệnh/lượt) ->
-- mỗi lệnh 1 dòng log Supabase, làm Log Ingestion gần chạm quota. Giờ gửi cả lô 1 lần = 1 dòng log.
create or replace function public.cap_nhat_last_chat(p jsonb)
returns int language sql security definer set search_path=public as $$
  with x as (select (e->>'id')::bigint id, (e->>'t')::timestamptz t from jsonb_array_elements(p) e),
       u as (update datahub_orders d set last_chat_at=x.t from x where d.id=x.id and d.last_chat_at is distinct from x.t returning 1)
  select count(*)::int from u;
$$;
revoke all on function public.cap_nhat_last_chat(jsonb) from public, anon, authenticated;
grant execute on function public.cap_nhat_last_chat(jsonb) to service_role;
