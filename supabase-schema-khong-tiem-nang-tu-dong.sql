-- NHẬT KÝ TỰ CHUYỂN "KHÔNG TIỀM NĂNG" SAU 7 NGÀY (anh Hải 23/11/2026):
--   "tiềm năng sau 7 ngày không phản hồi thêm gì kể từ lần cuối sale nhắn hoặc không cho sđt thì chuyển về hết thành không tiềm năng",
--   "không tiềm năng thì khách trên pancake lại đổi thành đạt", "qc nó đưa tiềm năng là được rồi, còn m là người xử lý tiếp".
-- Job scripts/tu-khong-tiem-nang.js ghi 1 dòng / khách (Lead ID chính) mỗi lần chuyển; tra_lai_luc = lúc job tự trả lại khi khách nhắn lại.
-- Chỉ job (service_role) đọc / ghi.
create table if not exists khach_khong_tiem_nang_tu_dong (
  lead_id text primary key,
  ten text,
  conversation_id text,
  shop_id bigint,
  customer_id text,
  ly_do text,                    -- 'im 7 ngày' | 'chưa SĐT sau 7 ngày'
  sale_nhan_cuoi timestamptz,    -- tin cuối của Sale lúc xét
  phan_loai_truoc text,
  the_truoc text,                -- thẻ khách POS trước khi đổi
  the_sau text,                  -- thẻ khách POS sau khi đổi
  luc timestamptz not null default now(),
  tra_lai_luc timestamptz,
  ghi_chu text
);
alter table khach_khong_tiem_nang_tu_dong enable row level security;
revoke all on khach_khong_tiem_nang_tu_dong from anon, authenticated;
