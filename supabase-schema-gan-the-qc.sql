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

-- 23/11/2026 (anh: "từ hôm nay m tự tạo đơn, gắn sỉ lẻ, tiềm năng vs đạt trên pancake luôn"): job tạo đơn trắng cho hội thoại chưa có đơn
-- + gắn KH SỈ / KH LẺ (chỉ khi khách chưa có) -> ghi thêm đơn đã tạo và thẻ Sỉ/Lẻ đã gắn.
alter table pancake_gan_the_qc add column if not exists shop_id bigint;
alter table pancake_gan_the_qc add column if not exists order_id text;          -- đơn job TẠO MỚI (null = dùng đơn có sẵn)
alter table pancake_gan_the_qc add column if not exists the_si_le text;         -- KH SỈ / KH LẺ job gắn (null = khách đã có / không gắn)
alter table pancake_gan_the_qc add column if not exists sale_gan text;          -- Sale QC đã ghi vào saleretail_manual.si_sale cho đơn job tạo (null = chưa ghi, chờ đơn về hub)
