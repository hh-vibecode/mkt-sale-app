-- SẢN PHẨM QUAN TÂM của khách Sỉ (anh Hải 28/9/2026): Đồ thờ / Nến / Hỗn hợp.
-- Job scripts/phan-loai-sp-quan-tam.js tự điền, thứ tự xét:
--   1) đã mua (đơn đặt hàng Kiot): mặt hàng tên bắt đầu "Nến" = nến, còn lại = đồ thờ; có cả 2 = Hỗn hợp
--   2) chưa mua: quảng cáo / bài viết khách bấm vào có chữ "nến" hoặc page Tự Tại Viên = Nến
--   3) chưa rõ: đọc tin khách nhắn trên Pancake
--   4) còn lại khách đến từ page = Đồ thờ
-- Sale sửa tay trong hồ sơ -> si_sp_qt_nguon = 'Tay', job không ghi đè nữa.
alter table saleretail_manual add column if not exists si_sp_quan_tam text;
alter table saleretail_manual add column if not exists si_sp_qt_nguon text;   -- Mua hàng / Quảng cáo / Page / Hội thoại / Tay
alter table saleretail_manual add column if not exists si_sp_qt_ly text;      -- căn cứ, hiện khi rê chuột
alter table saleretail_manual add column if not exists si_sp_qt_luc timestamptz;

insert into danh_muc (loai,gia_tri,mau,thu_tu,he_thong)
select 'si_sp_quan_tam',v,m,t,true from (values ('Đồ thờ','#f59e0b',1),('Nến','#e11d48',2),('Hỗn hợp','#8b5cf6',3)) x(v,m,t)
where not exists (select 1 from danh_muc where loai='si_sp_quan_tam' and gia_tri=x.v);

-- NGÀY TẠO SỬA (28/9/2026): khách có đơn Pancake do app tạo từ hội thoại cũ -> ngày tạo = ngày khách nhắn đầu tiên.
alter table saleretail_manual add column if not exists ngay_tao_sua date;
update saleretail_manual m set ngay_tao_sua=x.ngay
from (
  select 'L-SD-'||lpad(d.system_id::text,4,'0') lead_id, min((p.nhan_dau at time zone 'Asia/Ho_Chi_Minh')::date) ngay
  from pancake_tu_tao_don p join datahub_orders d on d.order_id::text=p.order_id
  where p.nhan_dau is not null and (p.loi is null or p.loi not like 'huỷ%') group by 1
) x where m.lead_id=x.lead_id and m.ngay_tao_sua is null;
