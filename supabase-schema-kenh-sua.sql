-- Kênh sửa tay trong hồ sơ khách (Sale Lẻ + Sale Sỉ), dropdown theo đúng danh sách kênh bán Kiot (30/9/2026).
-- saleretail_manual.kenh_sua: trống = dùng kênh Pancake / sheet cũ; có giá trị = ghi đè khi hiển thị & tính báo cáo.
alter table public.saleretail_manual add column if not exists kenh_sua text;
-- Nguồn khách sửa tay (Online / Offline), cùng cơ chế: trống = theo Pancake / sheet cũ.
alter table public.saleretail_manual add column if not exists nguon_sua text;

-- Danh mục "Kênh" (loai kenh_nhap_tay) = danh sách kênh bán ĐANG DÙNG trên Kiot (GET /salechannel), đúng thứ tự Kiot.
-- Giá trị cũ không có trên Kiot (Zalo, Gọi trực tiếp, Khách cũ giới thiệu, Tiktok Shidai, Tiktok Nến Bơ) bỏ khỏi dropdown;
-- dữ liệu đã nhập với các giá trị đó giữ nguyên (ô chọn vẫn hiện giá trị cũ của khách đó).
delete from public.danh_muc where loai='kenh_nhap_tay' and gia_tri not in (
  'Bán trực tiếp','Facebook','Instagram','Siêu thị Phật Giáo Hiền Thuỷ','Haravan','Chùa Cao Linh','Facebook Chánh Tâm',
  'Facebook Hiền Thuỷ','Facebook Nến Bơ','Facebook Shidai','Kênh Thị Trường','Shopee Tự Tại Viên','Tiktok Chánh Tâm',
  'Tiktok Hiền Thuỷ','Tiktok Ming Ying','Website Chánh Tâm','Website Hiền Thuỷ','Khác');
insert into public.danh_muc (loai,gia_tri,thu_tu,he_thong)
select 'kenh_nhap_tay',v,n,false from unnest(array[
  'Bán trực tiếp','Facebook','Instagram','Siêu thị Phật Giáo Hiền Thuỷ','Haravan','Chùa Cao Linh','Facebook Chánh Tâm',
  'Facebook Hiền Thuỷ','Facebook Nến Bơ','Facebook Shidai','Kênh Thị Trường','Shopee Tự Tại Viên','Tiktok Chánh Tâm',
  'Tiktok Hiền Thuỷ','Tiktok Ming Ying','Website Chánh Tâm','Website Hiền Thuỷ','Khác']) with ordinality as t(v,n)
on conflict (loai,gia_tri) do update set thu_tu=excluded.thu_tu;
