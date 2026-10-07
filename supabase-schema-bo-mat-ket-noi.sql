-- BỎ PHÂN LOẠI "Mất kết nối" (anh Hải 07/10/2026: "đổi hết mất kết nối thành không tiềm năng", "đổi xong xoá cái mất kết nối đi").
-- Lẻ + Sỉ còn 6 phân loại: Lead mới · Lead cũ · Đã ra đơn · Tiềm năng, chưa ra đơn · Chưa liên hệ được · Không tiềm năng.
-- Ghi nhật ký trước rồi mới đổi. Giá trị cũ trong si_sheet (bản chụp sheet Master Sỉ cũ) KHÔNG sửa -- app quy đổi lúc dựng.
begin;
insert into public.activity_log (who,act,tbl,ref,label,fld,old_v,new_v)
select 'Monsieur Claude','U','saleretail_manual',lead_id,null,'Phân loại KH (bỏ Mất kết nối 07/10)','Mất kết nối','Không tiềm năng'
  from public.saleretail_manual where si_phan_loai = 'Mất kết nối';
update public.saleretail_manual set si_phan_loai = 'Không tiềm năng', updated_at = now(), updated_by = 'Monsieur Claude'
 where si_phan_loai = 'Mất kết nối';

insert into public.activity_log (who,act,tbl,ref,label,fld,old_v,new_v)
select 'Monsieur Claude','U','datahub_manual','M-'||lpad(id::text,4,'0'),customer_name,'Phân loại KH (bỏ Mất kết nối 07/10)','Mất kết nối','Không tiềm năng'
  from public.datahub_manual where status = 'Mất kết nối';
update public.datahub_manual set status = 'Không tiềm năng', updated_at = now() where status = 'Mất kết nối';

-- phân loại ghi kèm từng lượt chăm sóc (lịch sử): đổi theo cho đồng nhất, 1 dòng nhật ký gộp
insert into public.activity_log (who,act,tbl,ref,label,fld,old_v,new_v)
select 'Monsieur Claude','U','salesi_crm',null,null,'Phân loại lượt chăm sóc (bỏ Mất kết nối 07/10)','Mất kết nối · '||count(*)||' lượt','Không tiềm năng'
  from public.salesi_crm where phan_loai = 'Mất kết nối' having count(*) > 0;
update public.salesi_crm set phan_loai = 'Không tiềm năng' where phan_loai = 'Mất kết nối';

delete from public.danh_muc where loai = 'si_phan_loai' and gia_tri = 'Mất kết nối';
update public.danh_muc d set thu_tu = x.tt from (values
  ('Lead mới',1),('Lead cũ',2),('Đã ra đơn',3),('Tiềm năng, chưa ra đơn',4),('Chưa liên hệ được',5),('Không tiềm năng',6)
) as x(gt,tt) where d.loai = 'si_phan_loai' and d.gia_tri = x.gt;
commit;
