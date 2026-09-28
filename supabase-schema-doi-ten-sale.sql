-- ĐỔI TÊN SALE (28/9/2026): trước đây đổi tên ở Nhân sự chỉ chuyển khách gán tay (saleretail_manual.si_sale) sang
-- tên mới, KHÔNG sửa phạm vi xem của tài khoản (sales_users.data_sales) -> Sale đổi tên xong không thấy khách nào.
-- Hàm này sửa cả phạm vi tài khoản + tên Sale trên dòng nhập tay. Chỉ quản trị (la_quan_tri()) chạy được.
create or replace function public.doi_ten_sale(p_cu text, p_moi text)
returns json language plpgsql security definer set search_path=public as $$
declare n_tk int; n_tay int;
begin
  if not la_quan_tri() then raise exception 'Không có quyền'; end if;
  if coalesce(trim(p_cu),'')='' or coalesce(trim(p_moi),'')='' then raise exception 'Thiếu tên'; end if;
  update sales_users set data_sales=(select jsonb_agg(case when v=to_jsonb(p_cu) then to_jsonb(p_moi) else v end) from jsonb_array_elements(data_sales) v)
    where jsonb_typeof(data_sales)='array' and data_sales ? p_cu;   -- data_sales là jsonb (mảng tên Sale)
  get diagnostics n_tk = row_count;
  update datahub_manual set staff_name=p_moi where staff_name=p_cu;
  get diagnostics n_tay = row_count;
  return json_build_object('tai_khoan',n_tk,'nhap_tay',n_tay);
end $$;
revoke all on function public.doi_ten_sale(text,text) from public, anon;
grant execute on function public.doi_ten_sale(text,text) to authenticated;
