-- LƯU TRỮ SỐ TỔNG TRƯỚC 2026 (anh Hải 02/10/2026): hoá đơn Kiot 2021–2025 (~63.000) chỉ kéo 1 LẦN để có số chuẩn,
-- KHÔNG lưu chi tiết (app nặng ~25 lần). Lưu số tổng theo tháng × cửa hàng × kênh, KHOÁ LẠI (không job nào ghi thêm).
-- App chỉ xem từ 2026 ("Tất cả" = Tất cả 2026) — bảng này để tra số khi anh cần, chưa hiện trên app.
create table if not exists public.kiot_luu_tru_thang (
  thang       text not null,          -- 'YYYY-MM'
  chi_nhanh   text not null,
  loai        text not null,          -- 'Lẻ' / 'Sỉ' (theo cửa hàng: Tổng kho sỉ Shidai = Sỉ)
  kenh        text not null,          -- tên kênh bán Kiot ('Bán trực tiếp', 'Facebook Hiền Thuỷ'…)
  nguon       text not null,          -- 'Online' / 'Offline'
  so_hoa_don  int not null default 0,
  so_khach    int not null default 0, -- khách có mã KH (vãng lai không mã đếm riêng ở so_hd_vang_lai)
  so_hd_vang_lai int not null default 0,
  doanh_thu   numeric not null default 0,   -- tổng tiền hoá đơn HOÀN THÀNH
  da_thu      numeric not null default 0,   -- tổng khách đã trả trên các hoá đơn đó
  chot_luc    timestamptz not null default now(),
  primary key (thang, chi_nhanh, kenh)
);
alter table public.kiot_luu_tru_thang enable row level security;
-- chỉ người đăng nhập app được đọc; không ai được ghi qua API (bảng khoá, chỉ nạp 1 lần bằng quyền quản trị)
drop policy if exists kiot_luu_tru_doc on public.kiot_luu_tru_thang;
create policy kiot_luu_tru_doc on public.kiot_luu_tru_thang for select to authenticated using (true);
revoke insert, update, delete on public.kiot_luu_tru_thang from anon, authenticated;
comment on table public.kiot_luu_tru_thang is 'KHOÁ: số tổng hoá đơn Kiot trước 2026, nạp 1 lần 02/10/2026. Không ghi thêm.';
