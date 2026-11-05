-- CẢNH BÁO DỮ LIỆU trong chuông admin (anh Hải 05/11/2026): app cần đọc giờ chạy các job (job_moc: tên job, lúc chạy, ghi chú —
-- không có dữ liệu khách). Chỉ ĐỌC cho người đã đăng nhập; ghi vẫn chỉ khoá quản trị (job). Monsieur Claude.
alter table public.job_moc enable row level security;
drop policy if exists job_moc_doc on public.job_moc;
create policy job_moc_doc on public.job_moc for select to authenticated using (true);
grant select on public.job_moc to authenticated;
