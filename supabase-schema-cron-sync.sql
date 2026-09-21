-- ĐỒNG BỘ THEO LỊCH DO SUPABASE ĐIỀU PHỐI (21/9/2026)
-- Vấn đề: GitHub Actions giãn lịch cron dưới 1 giờ thành 2-5 tiếng (đo thật: đặt 30 phút -> chỉ 8 lượt/ngày).
-- Cách xử lý: pg_cron trên Supabase (chạy đúng giờ) gọi Edge Function 'sync-now', function này kích
-- workflow GitHub bằng workflow_dispatch -- loại kích theo yêu cầu này chạy NGAY, không bị giãn.
-- Nhờ vậy giữ nguyên toàn bộ script sync đã chạy ổn, chỉ đổi người bấm nút.
-- Lịch ghi theo giờ UTC; VN = UTC + 7.
create extension if not exists pg_net;

-- Gọi Edge Function sync-now. p_backfill = true thì quét lại toàn bộ từ 1/6.
create or replace function public.goi_sync(p_job text, p_backfill boolean default false)
returns bigint
language plpgsql security definer set search_path to 'public','extensions','net'
as $$
declare id bigint;
begin
  select net.http_post(
    url := 'https://bcrpxfvvjsjpvbksqzls.functions.supabase.co/sync-now',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey', current_setting('app.anon_key', true),
      'Authorization','Bearer '||current_setting('app.anon_key', true)),
    body := jsonb_build_object('job', p_job, 'backfill', p_backfill)
  ) into id;
  return id;
end;$$;

-- Bỏ lịch cũ nếu chạy lại file này
select cron.unschedule(jobname) from cron.job
 where jobname in ('sync-datahub-30p','sync-kiot-30p','sync-backfill-datahub','sync-backfill-kiot','sync-mkt-3lan');

-- Pancake: mỗi 30 phút (kéo đơn + tự gắn thẻ CHỐT ĐƠN + tự đổi trạng thái đơn B3)
select cron.schedule('sync-datahub-30p','*/30 * * * *', $$select public.goi_sync('datahub')$$);
-- KiotViet: mỗi 30 phút, lệch 10 phút để 2 job không chen nhau
select cron.schedule('sync-kiot-30p','10,40 * * * *', $$select public.goi_sync('kiot')$$);
-- Quét lại toàn bộ từ 1/6: 7h05 và 7h20 giờ VN
select cron.schedule('sync-backfill-datahub','5 0 * * *',  $$select public.goi_sync('datahub', true)$$);
select cron.schedule('sync-backfill-kiot','20 0 * * *',    $$select public.goi_sync('kiot', true)$$);
-- Meta Ads: 7h05 · 12h05 · 15h05 giờ VN
select cron.schedule('sync-mkt-3lan','5 0,5,8 * * *',      $$select public.goi_sync('mkt')$$);
