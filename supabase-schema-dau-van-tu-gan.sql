-- job_dau_van: thêm job 'tu-gan-ma-kh' (tự gắn Mã KH cho khách đã chốt, 12/10/2026). Thiếu nhánh này làm bước
-- "Tự gắn Mã KH" trong workflow sync-kiot báo lỗi ("không biết job tu-gan-ma-kh") từ 08:35 12/10/2026.
-- Dấu vân = những bảng làm đổi kết quả gắn mã: đơn Kiot, khách Kiot (SĐT), đơn Pancake (SĐT / thẻ / ghi chú),
-- hồ sơ app (mã tay, số Sale ghi, mã bỏ, gỡ, gộp), dòng nhập tay.
create or replace function public.job_dau_van(p_ten text)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
  elsif p_ten='tu-gan-ma-kh' then
    select md5(concat_ws('|',
      (select md5(string_agg(concat_ws(',',code,customer_code,purchase_date,total,status,branch_name),';' order by code)) from kiot_orders),
      (select md5(string_agg(concat_ws(',',code,phone,customer_group),';' order by code)) from kiot_customers),
      (select md5(string_agg(concat_ws(',',id,phone,customer_tags,internal_note,order_status),';' order by id)) from datahub_orders),
      (select md5(string_agg(concat_ws(',',lead_id,kiot_code,si_sdt,bo_ma_kh,excluded,gop_vao,si_sale),';' order by lead_id)) from saleretail_manual),
      (select md5(string_agg(concat_ws(',',id,kiot_code,phone,sale_type),';' order by id)) from datahub_manual))) into k;
  elsif p_ten='sync-pancake-the-b3' then
    select md5(concat_ws('|',
      (select md5(string_agg(concat_ws(',',shop_id,order_id,system_id,customer_tags,order_status,internal_note),';' order by id)) from datahub_orders),
      (select md5(string_agg(concat_ws(',',customer_code,status),';' order by code)) from kiot_orders))) into k;
  else
    raise exception 'job_dau_van: không biết job %', p_ten;
  end if;
  return k;
end $function$;
