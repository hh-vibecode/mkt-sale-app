-- 19/10/2026: GỠ Daily report (anh Hải: "gỡ khỏi app", "trông không cần thiết lắm"). Bảng chỉ có 2 bản tự tạo 17/10 + 18/10.
drop table if exists public.mkt_bao_cao_ngay;
select to_regclass('public.mkt_bao_cao_ngay') con_bang;
