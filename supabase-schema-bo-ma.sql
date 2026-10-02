-- BỎ MÃ KH GÁN NHẦM (anh Hải 02/10/2026, ca L-CT2-0031 Đoàn Nguyễn Minh Tài ghi nhầm KH007517 của KB Chị Nga - Nghệ An).
-- bo_ma_kh: mã KH trên ghi chú Pancake mà app phải BỎ QUA cho lead này (không nối, không gộp vào nhóm chung mã).
-- bo_chot : bỏ qua thẻ CHỐT ĐƠN trên Pancake của lead này (thẻ gắn nhầm) -> không tính là đã chốt.
-- Lưu ở hồ sơ app nên lần đồng bộ Pancake sau KHÔNG gộp lại dù Sale chưa kịp xoá ghi chú / thẻ.
alter table public.saleretail_manual add column if not exists bo_ma_kh text;
alter table public.saleretail_manual add column if not exists bo_chot boolean;

update public.saleretail_manual set bo_ma_kh='KH007517', bo_chot=true, status=null,
  updated_at=now(), updated_by='Monsieur Claude'
where lead_id='L-CT2-0031';
insert into public.activity_log (who,act,tbl,ref,label,fld,old_v,new_v) values
 ('Monsieur Claude','U','saleretail_manual','L-CT2-0031','Đoàn Nguyễn Minh Tài','Bỏ mã KH gán nhầm + bỏ Chốt đơn (anh Hải)','KH007517 · Chốt đơn','không mã · chưa chốt');
