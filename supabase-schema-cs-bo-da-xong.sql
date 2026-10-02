-- BỎ TRẠNG THÁI "ĐÃ XONG" (anh Hải 02/10/2026 tối, nghĩ lại): lượt chăm sóc chỉ còn Chăm sóc định kỳ / Chốt đơn,
-- việc treo theo dõi bằng Ghi chú họp (salesi_crm_note). Hoàn tác supabase-schema-cs-da-xong.sql.
update public.salesi_crm set trang_thai = 'Chăm sóc định kỳ' where trang_thai = 'Đã xong';
delete from public.danh_muc where loai = 'cs_trang_thai' and gia_tri = 'Đã xong';
update public.danh_muc set mau = '#4361ee' where loai = 'cs_trang_thai' and gia_tri = 'Chăm sóc định kỳ';
update public.danh_muc set thu_tu = 2 where loai = 'cs_trang_thai' and gia_tri = 'Chốt đơn';
