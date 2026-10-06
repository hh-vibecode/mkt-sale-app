-- PHÂN LOẠI KH ĐỒNG NHẤT Lẻ + Sỉ (anh Hải 06/10/2026): Lead mới · Lead cũ · Đã ra đơn · Tiềm năng, chưa ra đơn ·
-- Chưa liên hệ được · Mất kết nối · Không tiềm năng. Bỏ "Chăm sóc dài hạn" khỏi danh mục (dropdown / bộ lọc).
-- Dữ liệu 51 khách "Chăm sóc dài hạn" -> "Tiềm năng, chưa ra đơn" (anh chốt 06/10, có nhật ký) -- xem cuối file.
delete from public.danh_muc where loai = 'si_phan_loai' and gia_tri = 'Chăm sóc dài hạn';
update public.danh_muc d set thu_tu = x.tt from (values
  ('Lead mới',1),('Lead cũ',2),('Đã ra đơn',3),('Tiềm năng, chưa ra đơn',4),('Chưa liên hệ được',5),('Mất kết nối',6),('Không tiềm năng',7)
) as x(gt,tt) where d.loai = 'si_phan_loai' and d.gia_tri = x.gt;
-- ghi nhật ký trước rồi đổi (anh Hải 06/10/2026: phân loại đồng nhất, bỏ hẳn "Chăm sóc dài hạn")
insert into public.activity_log (who,act,tbl,ref,label,fld,old_v,new_v)
select 'Monsieur Claude','U','saleretail_manual',lead_id,null,'Phân loại KH (đồng nhất 06/10)','Chăm sóc dài hạn','Tiềm năng, chưa ra đơn'
  from public.saleretail_manual where si_phan_loai = 'Chăm sóc dài hạn';
update public.saleretail_manual set si_phan_loai = 'Tiềm năng, chưa ra đơn', updated_at = now(), updated_by = 'Monsieur Claude'
 where si_phan_loai = 'Chăm sóc dài hạn';
