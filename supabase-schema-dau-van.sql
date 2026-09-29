-- DẤU VÂN TAY DỮ LIỆU CHO JOB (29/9/2026) -- giảm tải ra (egress) Supabase mà job vẫn chạy 10–15 phút/lần.
-- Trước khi đọc cả bảng, job hỏi 1 câu nhỏ: md5 của ĐÚNG các cột nó sẽ đọc. Trùng lần trước = không có gì đổi -> thoát.
-- Tính trong CSDL nên chỉ gửi ra 1 chuỗi 32 ký tự thay vì vài MB dữ liệu.
alter table job_moc add column if not exists dau_van text;

create or replace function public.job_dau_van(p_ten text)
returns text language plpgsql stable security definer set search_path=public as $$
declare k text;
begin
  if p_ten in ('tu-tao-chot-don-si','tu-tao-nhap-tay') then
    select md5(concat_ws('|',
      (select md5(string_agg(concat_ws(',',code,customer_code,customer_name,purchase_date,total,total_payment,status,branch_name,sale_channel,sold_by_name),';' order by code)) from kiot_orders),
      (select md5(string_agg(concat_ws(',',code,name,phone,debt,customer_group),';' order by code)) from kiot_customers),
      (select md5(string_agg(concat_ws(',',customer_code,total,status),';' order by customer_code,total,status)) from kiot_invoices),
      (select md5(string_agg(concat_ws(',',id,kiot_code,sale_type),';' order by id)) from datahub_manual),
      (select md5(string_agg(concat_ws(',',id,internal_note),';' order by id)) from datahub_orders),
      case when p_ten='tu-tao-chot-don-si' then
        (select md5(string_agg(concat_ws(',',id,kiot_code,ma_don,ngay_chot,gia_tri_chot,trang_thai),';' order by id)) from salesi_crm)
        ||(select md5(string_agg(code,';' order by code)) from kiot_don_giu_tinh) end)) into k;
  elsif p_ten='sync-pancake-the-b3' then
    select md5(concat_ws('|',
      (select md5(string_agg(concat_ws(',',shop_id,order_id,system_id,customer_tags,order_status,internal_note),';' order by id)) from datahub_orders),
      (select md5(string_agg(concat_ws(',',customer_code,status),';' order by code)) from kiot_orders))) into k;
  else
    raise exception 'job_dau_van: không biết job %', p_ten;
  end if;
  return k;
end $$;
revoke all on function public.job_dau_van(text) from public, anon, authenticated;
grant execute on function public.job_dau_van(text) to service_role;
