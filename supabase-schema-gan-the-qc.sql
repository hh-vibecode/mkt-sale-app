-- NHẬT KÝ GẮN THẺ PANCAKE THEO ĐÁNH GIÁ QC (anh Hải 23/11/2026: "m chỉ cần gắn thẻ tiềm năng vs đạt trên pancake lúc đầu thôi",
-- QC chấm nội dung tin nhắn, app MKT gắn thẻ hội thoại; sau đó Sale tự đổi, app không gắn / gỡ lại).
-- 1 dòng = 1 hội thoại ĐÃ XỬ LÝ (gắn, hoặc bỏ qua vì Sale đã có thẻ) -> job scripts/gan-the-qc.js không đụng lại lần nữa.
-- Chỉ job (service_role) đọc / ghi; app không cần đọc. Gỡ: delete from pancake_gan_the_qc (rồi gỡ thẻ tay nếu cần, cột tag_id cho biết thẻ nào).
create table if not exists pancake_gan_the_qc (
  conversation_id text primary key,
  page_id text not null,
  nhom text not null,            -- tiem_nang | dat (theo view qc_khach_tiem_nang_ngay lúc gắn)
  ly_do_nhom text,
  tag_id int,                    -- thẻ hội thoại đã gắn (null = bỏ qua)
  tag_ten text,
  the_truoc text,                -- thẻ hội thoại trước khi gắn (để gỡ / tra)
  ket text not null,             -- 'gan' | 'bo_qua' | 'loi'
  ghi_chu text,
  luc timestamptz not null default now()
);
alter table pancake_gan_the_qc enable row level security;
revoke all on pancake_gan_the_qc from anon, authenticated;
