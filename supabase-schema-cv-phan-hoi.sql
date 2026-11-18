-- BẢN CHỤP PHẢN HỒI KHÁCH CHO BÁO CÁO CÔNG VIỆC (18/11/2026, anh Hải: "chuyển filter mất rất nhiều thời gian"). Monsieur Claude.
-- View qc_phan_hoi_ngay (app QC sở hữu, KHÔNG sửa) mỗi lần hỏi phải tách + regex lại toàn bộ full_thread từ 1/10: 1 ngày ~3 giây, 3 ngày ~4,3 giây,
-- cả tháng QUÁ statement timeout (bị huỷ) -> app chờ rồi rơi về view cũ -> chọn "Tháng này" rất lâu và cột Phản hồi KH trống.
-- Cách làm (chỉ THÊM, đồ của app MKT, tiền tố cv_): bảng chụp cv_phan_hoi_ngay = y hệt cột của view, hàm cv_lam_moi_phan_hoi() xoá + ghi lại trong
-- 1 giao dịch (người đang đọc vẫn thấy bản cũ tới khi xong), pg_cron 10 phút / lần trong 6h–23h giờ VN. QC kéo Zalo mỗi giờ nên trễ ≤ 10 phút không đáng kể.
create table if not exists cv_phan_hoi_ngay as select * from qc_phan_hoi_ngay where false;
alter table cv_phan_hoi_ngay add column if not exists chup_luc timestamptz default now();
create index if not exists cv_phan_hoi_ngay_ngay on cv_phan_hoi_ngay (ngay);
alter table cv_phan_hoi_ngay enable row level security;
drop policy if exists cv_phan_hoi_ngay_doc on cv_phan_hoi_ngay;
create policy cv_phan_hoi_ngay_doc on cv_phan_hoi_ngay for select to authenticated using (true);   -- như view QC: người đăng nhập đọc
revoke all on cv_phan_hoi_ngay from anon;

create or replace function cv_lam_moi_phan_hoi() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  set local statement_timeout = '180s';
  delete from cv_phan_hoi_ngay;
  insert into cv_phan_hoi_ngay (ngay, nen_tang, kenh, sale, sale_pancake, conv_id, khach_id, ten_khach, sdt, khach_nhan, phut_cho, tra_loi_muon, la_binh_luan, la_miss, chup_luc)
    select ngay, nen_tang, kenh, sale, sale_pancake, conv_id, khach_id, ten_khach, sdt, khach_nhan, phut_cho, tra_loi_muon, la_binh_luan, la_miss, now() from qc_phan_hoi_ngay;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function cv_lam_moi_phan_hoi() from public, anon, authenticated;

-- 6h–23h VN = 23h–16h UTC
select cron.unschedule('cv-phan-hoi-10p') where exists (select 1 from cron.job where jobname = 'cv-phan-hoi-10p');
select cron.schedule('cv-phan-hoi-10p', '*/10 0-16,23 * * *', 'select cv_lam_moi_phan_hoi()');
select cv_lam_moi_phan_hoi();
