-- SO KHỚP KIOT ↔ APP MKT (anh Hải 10/11/2026: "nhét vào cài đặt nâng cao, tạo phần so khớp, định kỳ ngày 2 lần sáng tối check rồi report vô đó").
-- Monsieur Claude. Chỉ THÊM (bảng kiot_* là bảng lõi nhiều app đọc -- xem QUY-UOC-DUNG-CHUNG-SUPABASE.md).

-- 1) Đơn / hoá đơn ĐÃ XOÁ TRÊN KIOT: không xoá dòng, chỉ đánh dấu (job so khớp hỏi lại Kiot từng mã, Kiot trả "không còn tồn tại" mới đánh).
--    App MKT bỏ dòng có kiot_da_xoa; hoá đơn của đơn đã xoá tính như HĐ bán thẳng. App khác đọc kiot_orders / kiot_invoices nên lọc kiot_da_xoa is null.
alter table kiot_orders   add column if not exists kiot_da_xoa timestamptz;
alter table kiot_invoices add column if not exists kiot_da_xoa timestamptz;

-- 2) Nhật ký mỗi lượt so khớp (2 lần / ngày). thang = bảng theo tháng (Kiot vs app), lech = danh sách mã lệch, da_sua = job đã tự sửa gì.
create table if not exists kiot_so_khop (
  id          bigserial primary key,
  chay_luc    timestamptz not null default now(),
  buoi        text,                 -- 'sáng' / 'tối' / 'tay'
  trang_thai  text not null default 'running',   -- running / khop / lech / loi
  so_ma       int,                  -- số mã đã so (đơn + hoá đơn)
  so_lech     int,                  -- số mã còn lệch SAU khi tự sửa
  thang       jsonb,
  lech        jsonb,
  da_sua      jsonb,
  ghi_chu     text
);
create index if not exists kiot_so_khop_chay_luc on kiot_so_khop (chay_luc desc);
alter table kiot_so_khop enable row level security;
drop policy if exists kiot_so_khop_doc on kiot_so_khop;
create policy kiot_so_khop_doc on kiot_so_khop for select to anon, authenticated using (true);   -- app đọc; chỉ service_role ghi
