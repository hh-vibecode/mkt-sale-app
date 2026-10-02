-- LẺ DÙNG GIAO DIỆN + DỮ LIỆU CHĂM SÓC NHƯ SỈ (anh Hải 02/10/2026)
-- 1) Lịch sử chăm sóc Lẻ ghi chung bảng salesi_crm, phân biệt bằng cột loai ('Lẻ' / 'Sỉ'; dòng cũ để trống = Sỉ).
alter table public.salesi_crm add column if not exists loai text;
create index if not exists salesi_crm_loai_idx on public.salesi_crm (loai);
-- 2) Trạng thái Lẻ chuyển sang bộ Phân loại của Sỉ (si_phan_loai) -- chạy bằng script chuyển dữ liệu (máy anh),
--    map: Đang chăm sóc -> Tiềm năng, chưa ra đơn · Mất lead -> Mất kết nối · Chốt đơn -> Đã ra đơn ·
--    Chưa liên hệ được / Lead cũ giữ nguyên. Cột status cũ GIỮ NGUYÊN để tra lại.
-- 3) Nội dung trao đổi cũ của Lẻ (saleretail_manual.content + care_date) chép thành 1 lượt chăm sóc loai='Lẻ'.
