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

-- 23/11 ~11h15: lưu NGUYÊN TRẠNG hồ sơ trước khi chuyển để trả lại đúng (lần đầu ghi đè updated_by làm mất người sửa cũ -> phải khôi phục từ
-- backup_snapshots, xem supabase-khoi-phuc-19-khach-23-11.sql).
alter table khach_khong_tiem_nang_tu_dong add column if not exists pl_tay_truoc text;          -- saleretail_manual.si_phan_loai trước khi chuyển (null = không có)
alter table khach_khong_tiem_nang_tu_dong add column if not exists nguoi_sua_truoc text;       -- updated_by trước khi chuyển
alter table khach_khong_tiem_nang_tu_dong add column if not exists sua_luc_truoc timestamptz;  -- updated_at trước khi chuyển
alter table khach_khong_tiem_nang_tu_dong add column if not exists co_ho_so_truoc boolean;     -- đã có dòng saleretail_manual trước khi chuyển

-- 23/11 ~11h40 (anh: "đồng bộ với qc phần này luôn, tránh báo không có trên app"): app (người đăng nhập) + QC ĐỌC được bảng này để Daily Task
-- bỏ các khách job đã chuyển "Không tiềm năng". Chỉ đọc; ghi vẫn chỉ job (service_role).
grant select on khach_khong_tiem_nang_tu_dong to authenticated;
drop policy if exists khach_ktn_doc on khach_khong_tiem_nang_tu_dong;
create policy khach_ktn_doc on khach_khong_tiem_nang_tu_dong for select to authenticated using (true);
