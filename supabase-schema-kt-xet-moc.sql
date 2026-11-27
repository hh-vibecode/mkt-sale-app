-- DOANH THU XÉT MỐC (app Kế toán) CHO THẺ BÁO CÁO CÔNG VIỆC — app MKT / Sale, Monsieur Claude, 27/11/2026
-- Ô "Doanh thu chốt sau hoàn" (anh Hải 27/11/2026) lấy doanh thu xét mốc Kế toán đẩy vào so_dt_2app (ben = 'kt').
-- so_dt_2app / so_dt_2app_quy_tac bật RLS, KHÔNG policy (chỉ service_role — bảng có cả hoa hồng hh / chi tiết đơn), nên app
-- (vai authenticated) đọc thẳng ra 0 dòng. 2 hàm dưới chỉ trả phần cần: TỔNG tiền theo tháng × người bán, và quy tắc
-- "tài khoản Kiot tính cho người này" (kt:nguoi:*). KHÔNG trả hoa hồng, không trả từng đơn. Chỉ người đăng nhập (authenticated) gọi được.
create or replace function public.so_dt_2app_xet_moc(p_tu text, p_den text)
returns table(thang text, nhan_su text, tien numeric, so_dong int)
language sql stable security definer set search_path = public as $$
  select s.thang, s.nhan_su, sum(s.tien), count(*)::int
  from so_dt_2app s
  where s.ben = 'kt' and s.thang between p_tu and p_den and auth.role() = 'authenticated'
  group by s.thang, s.nhan_su
$$;

create or replace function public.so_dt_2app_nguoi_kt()
returns table(khoa text, noi_dung text)
language sql stable security definer set search_path = public as $$
  select q.khoa, q.noi_dung from so_dt_2app_quy_tac q
  where q.ben = 'kt' and q.khoa like 'kt:nguoi:%' and auth.role() = 'authenticated'
$$;

revoke all on function public.so_dt_2app_xet_moc(text, text) from public, anon;
grant execute on function public.so_dt_2app_xet_moc(text, text) to authenticated;
revoke all on function public.so_dt_2app_nguoi_kt() from public, anon;
grant execute on function public.so_dt_2app_nguoi_kt() to authenticated;
