-- SO DOANH THU APP MKT ↔ APP KẾ TOÁN MỖI ĐÊM (anh Hải 17/11/2026: "bọn m so qua lại vs trao đổi vs nhau trên cloud về doanh thu tổng,
-- doanh thu onl off, doanh thu nhân sự định kỳ đêm hàng ngày"; gộp vào luồng So khớp Kiot ↔ app MKT ↔ app Kế toán). Monsieur Claude.
-- Bảng DÙNG CHUNG 2 app (đăng ký ở QUY-UOC-DUNG-CHUNG-SUPABASE.md): app MKT sở hữu cấu trúc; mỗi app CHỈ ghi dòng ben của mình.
-- Không có policy -> chỉ service_role đọc / ghi (số theo đơn + tên nhân sự, không mở cho khoá công khai).

-- 1) Danh sách ĐƠN mỗi app tính doanh thu, theo tháng (giờ VN). Mỗi lượt 1 app xoá dòng ben của mình (các tháng đang so) rồi ghi lại.
--    Tổng / Online / Offline / theo nhân sự đều cộng từ đây -> lệch là chỉ ra được đơn nào.
create table if not exists so_dt_2app (
  thang    text not null,                                   -- 'YYYY-MM' theo ngày app đó tính doanh thu (giờ VN)
  ben      text not null check (ben in ('mkt','kt')),       -- app nào ghi
  ma       text not null,                                   -- mã phiếu Kiot: DH... (đơn đặt) hoặc HD... (hoá đơn)
  tien     numeric not null default 0,                      -- tiền app đó tính cho mã này trong tháng
  kenh     text,                                            -- 'Online' / 'Offline' theo cách của app đó
  nhan_su  text,                                            -- nhân sự được ghi doanh thu
  doi      text,                                            -- MKT: Lẻ / Sỉ · KT: tuỳ (chi nhánh / bộ phận)
  ma_kh    text,                                            -- mã khách Kiot
  ly_do    text,                                            -- vì sao tính (trả tiền trên đơn / khách có cọc / hoá đơn hoàn thành ...)
  luc      timestamptz not null default now(),
  primary key (thang, ben, ma)
);
alter table so_dt_2app enable row level security;

-- 2) Hộp thư giữa 2 app: giải thích đơn lệch, hỏi lại nhau. ma để trống = tin chung của tháng.
create table if not exists so_dt_2app_tin (
  id        bigserial primary key,
  luc       timestamptz not null default now(),
  ben       text not null check (ben in ('mkt','kt')),
  thang     text,
  ma        text,
  noi_dung  text not null
);
create index if not exists so_dt_2app_tin_luc on so_dt_2app_tin (luc desc);
alter table so_dt_2app_tin enable row level security;

-- 3) Kết quả so mỗi đêm gắn vào lượt so khớp (trang Cài đặt nâng cao > So khớp đọc cột này).
alter table kiot_so_khop add column if not exists doanh_thu jsonb;

-- 4) kiot_so_khop giờ chứa doanh thu theo nhân sự + mã đơn -> bỏ quyền đọc của khoá công khai (anon), chỉ người đăng nhập (app tự gắn thẻ phiên).
drop policy if exists kiot_so_khop_doc on kiot_so_khop;
create policy kiot_so_khop_doc on kiot_so_khop for select to authenticated using (true);
