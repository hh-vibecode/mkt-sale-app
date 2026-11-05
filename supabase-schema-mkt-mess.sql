-- MESS = "LƯỢT BẮT ĐẦU CUỘC TRÒ CHUYỆN" (= cột Kết quả / Chi phí trên mỗi kết quả của Ads Manager) — anh Hải 05/11/2026
-- ("chi phí mess đang sai so với Ads Manager, CT tháng 11 đang 92k/mess"). Thay chốt 08/10 (Tổng số người liên hệ nhắn tin).
-- Số "người liên hệ" cũ giữ ở cột riêng để không mất. Chỉ THÊM cột.
alter table public.mkt_spend add column if not exists nguoi_lien_he integer;
