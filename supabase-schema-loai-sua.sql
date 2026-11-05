-- CHỌN TAY LẺ / SỈ CHO KHÁCH (anh Hải 05/11/2026): đơn page Shidai (tổng kho sỉ) bị gắn thẻ KH LẺ -> chuông admin báo, bấm
-- "Chuyển sang Sỉ" / "Đúng là Lẻ" -> lưu ở đây, app ưu tiên giá trị này hơn thẻ Pancake (không sửa thẻ trên Pancake). Chỉ THÊM cột.
alter table public.saleretail_manual add column if not exists loai_sua text;   -- 'Sỉ' / 'Lẻ' / null = theo thẻ Pancake
