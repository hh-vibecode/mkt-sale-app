-- KHÔI PHỤC 19 KHÁCH job 7 ngày chuyển sai (23/11/2026 ~11h, anh: "sale đã update data rồi thì m không được sờ vào nữa",
-- "m chấm tin pancake của qc tháng 11, lôi cả tin 2025 vào làm gì"): trả si_phan_loai / updated_by / updated_at đúng như bản chụp 01:00 hôm nay
-- (backup_snapshots, trước khi job chạy). Chỉ 3 cột job đã ghi đè; cột khác không đụng.
with s as (select du_lieu from backup_snapshots where bang='saleretail_manual' and at < '2026-11-23 03:00+00' order by at desc limit 1),
b as (select x->>'lead_id' lead_id, x->>'si_phan_loai' pl, x->>'updated_by' ub, (x->>'updated_at')::timestamptz ua from s, jsonb_array_elements(s.du_lieu) x)
update saleretail_manual m set si_phan_loai = b.pl, updated_by = b.ub, updated_at = b.ua
from b, khach_khong_tiem_nang_tu_dong k
where m.lead_id = b.lead_id and k.lead_id = m.lead_id and k.tra_lai_luc is not null;
