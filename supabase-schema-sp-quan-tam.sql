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
