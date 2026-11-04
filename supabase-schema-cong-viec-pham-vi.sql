-- BÁO CÁO CÔNG VIỆC — MỞ PHẠM VI XEM Y NHƯ CÁC BÁO CÁO KHÁC (anh Hải 04/11/2026). Thay policy _xem của supabase-schema-cong-viec.sql.
-- Người xem X thấy báo cáo của Y khi:
--   · Y là chính X, hoặc X là Admin / Supreme / quyền '*' (cv_xem_het), hoặc
--   · phạm vi Sale của X (sales_users.data_sales, rỗng = tất cả) BAO TRỌN phạm vi Sale của Y  -> vd Kim Oanh & Khánh Nguyên cùng
--     [Kim Oanh, Minh Oanh, Khánh Nguyên] thấy nhau; Vân Ngọc [Thảo Ngọc, Vân Ngọc] và Sale Chánh Tâm [Diệp, Tuấn, Thảo Ngọc, Lệ] không thấy nhau.
--   · và LOẠI KHÁCH: từng việc chỉ hiện khi loai (Lẻ / Sỉ) nằm trong data_types của X (rỗng = cả 2); dòng ngày cần 2 bên chung ít nhất 1 loại.
-- Sửa / xoá vẫn chỉ người tạo (policy _them / _sua / _xoa giữ nguyên). Monsieur Claude.
create or replace function public.cv_xem_duoc(p_nguoi_id text, p_loai text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select p_nguoi_id = public.cv_toi() or public.cv_xem_het() or exists (
    select 1 from public.sales_users x join public.sales_users y on y.user_id = p_nguoi_id
    where x.user_id = public.cv_toi() and x.status = 'active'
      and (jsonb_array_length(coalesce(x.data_sales,'[]'::jsonb)) = 0
           or (jsonb_array_length(coalesce(y.data_sales,'[]'::jsonb)) > 0 and coalesce(y.data_sales,'[]'::jsonb) <@ x.data_sales))
      and (jsonb_array_length(coalesce(x.data_types,'[]'::jsonb)) = 0
           or (p_loai is not null and x.data_types ? p_loai)
           or (p_loai is null and (jsonb_array_length(coalesce(y.data_types,'[]'::jsonb)) = 0
                                   or x.data_types ?| array(select jsonb_array_elements_text(y.data_types))))));
$$;
revoke execute on function public.cv_xem_duoc(text,text) from anon, public;
grant execute on function public.cv_xem_duoc(text,text) to authenticated, service_role;

drop policy if exists cong_viec_ngay_xem on public.cong_viec_ngay;
create policy cong_viec_ngay_xem on public.cong_viec_ngay for select to authenticated using (public.cv_xem_duoc(nguoi_id, null));
drop policy if exists cong_viec_muc_xem on public.cong_viec_muc;
create policy cong_viec_muc_xem on public.cong_viec_muc for select to authenticated using (public.cv_xem_duoc(nguoi_id, loai));
