-- MỐC CHẠY CỦA JOB theo khung giờ (28/9/2026): job tự tạo đơn từ hội thoại chỉ chạy 2 lần/ngày, 6h và 18h giờ VN
-- (anh Hải: để Sale có thời gian tự tạo đơn, tránh trùng). Workflow vẫn gọi mỗi 10 phút, script đọc bảng này để biết
-- khung giờ hiện tại đã chạy chưa.
create table if not exists job_moc (ten text primary key, luc timestamptz not null, ghi_chu text);
alter table job_moc enable row level security;
