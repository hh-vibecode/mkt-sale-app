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

-- 5) (17/11/2026, anh Hải: "tất cả phần lệch t cần có note của m vs kế toán về phần lệch đó tại sao lệch hàng ngày") LÝ DO KHÔNG TÍNH:
--    mỗi app ghi lý do mình KHÔNG tính 1 mã mà bên kia tính (ben = app ghi lý do). Mỗi lượt xoá dòng ben của mình rồi ghi lại.
create table if not exists so_dt_2app_ly_do (
  thang   text not null,
  ben     text not null check (ben in ('mkt','kt')),
  ma      text not null,          -- mã như bên kia ghi (DH / HD / TH)
  ly_do   text not null,
  luc     timestamptz not null default now(),
  primary key (thang, ben, ma)
);
alter table so_dt_2app_ly_do enable row level security;

-- 6) (17/11/2026, anh Hải: "k so khớp vs kế toán ở doanh thu nữa, cái m cần so khớp là số lượng đơn onl off ... vs sale đã được ghi nhận đủ đơn
--    hay chưa, và bàn luận vs nó"; "bắt đầu so từ tháng 11") -- so KÊNH + SALE từng đơn, không so tiền:
alter table so_dt_2app add column if not exists kenh_ly text;   -- vì sao app đó ghi Online / Offline cho đơn này
alter table so_dt_2app add column if not exists ns_ly   text;   -- vì sao ghi nhân sự này (gán tay / người bán Kiot / bàn giao ...)
alter table so_dt_2app add column if not exists nv_ban  text;   -- người bán ghi trên phiếu Kiot

-- 7) (17/11/2026, anh Hải: "bảo kế toán share cho m phần hoa hồng, m hỗ trợ nó check cuối mỗi ngày, xem các đơn đã được ghi nhận đúng đủ cho các
--    sale chưa, bảo nó share cả phần quy tắc hoa hồng sang m xem hoa hồng của sale đã đúng chưa luôn") -- Kế toán ghi, MKT đọc + kiểm:
alter table so_dt_2app add column if not exists hh    numeric;   -- hoa hồng Kế toán tính cho đơn này (ben kt)
alter table so_dt_2app add column if not exists hh_ly text;      -- quy tắc / mức áp (vd "Lẻ online đơn đầu 3%")
create table if not exists so_dt_2app_quy_tac (                  -- quy tắc hoa hồng Kế toán đang áp (ben kt ghi, MKT đọc)
  khoa      text primary key,                                     -- mã quy tắc
  ben       text not null default 'kt' check (ben in ('mkt','kt')),
  noi_dung  text not null,                                        -- diễn giải đầy đủ
  ap_tu     date, ap_den date,
  luc       timestamptz not null default now()
);
alter table so_dt_2app_quy_tac enable row level security;
