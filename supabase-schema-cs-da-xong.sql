-- TRẠNG THÁI LƯỢT CHĂM SÓC "ĐÃ XONG" (anh Hải 02/10/2026)
-- Chăm sóc định kỳ = việc còn treo (đỏ) · Đã xong = đã clear (xanh) · Chốt đơn bỏ qua.
-- Mỗi khách chỉ lượt gần nhất để Chăm sóc định kỳ; các lượt cũ chuyển Đã xong (script chuyển dữ liệu chạy 1 lần,
-- sau đó app tự chuyển khi Sale ghi lượt mới).
insert into public.danh_muc (loai, gia_tri, mau, thu_tu, he_thong)
select 'cs_trang_thai', 'Đã xong', '#16a34a', 2, true
where not exists (select 1 from public.danh_muc where loai = 'cs_trang_thai' and gia_tri = 'Đã xong');
update public.danh_muc set mau = '#ef4444' where loai = 'cs_trang_thai' and gia_tri = 'Chăm sóc định kỳ';
update public.danh_muc set thu_tu = 3 where loai = 'cs_trang_thai' and gia_tri = 'Chốt đơn';
