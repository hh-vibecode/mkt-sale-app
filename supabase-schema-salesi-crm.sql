-- LỊCH SỬ CHĂM SÓC KHÁCH SỈ (tab CRM của Báo cáo Sale Sỉ).
-- Khác hẳn Sale Lẻ: bên Lẻ mỗi khách 1 dòng hồ sơ, còn Sỉ là NHẬT KÝ -- mỗi lần chăm sóc là 1 dòng,
-- một khách xuất hiện nhiều lần (đo trên sheet 22/9/2026: 2.021 lượt / ~380 khách).
-- Master Sỉ giữ HỒ SƠ khách (mô hình hợp tác, showroom, tài chính, phân loại KH -- nằm ở saleretail_manual,
-- các cột si_*), còn bảng này giữ DIỄN BIẾN theo ngày.
create table if not exists public.salesi_crm (
  id            bigint generated always as identity primary key,
  lead_id       text,                 -- khoá nối sang khách trong app (Master Sỉ)
  kiot_code     text,                 -- Mã KH Kiot nếu có
  customer_name text not null,
  phone         text,
  ngay_cham     date not null,
  nguon         text,                 -- Online / Offline
  kenh          text,                 -- Sales trực tiếp, Facebook Shidai...
  sales         text,                 -- Sales phụ trách
  hinh_thuc     text,                 -- Zalo / Gọi điện / Gặp trực tiếp
  noi_dung      text,
  phan_loai     text,                 -- phân loại KH tại thời điểm chăm sóc
  gia_tri_du_kien numeric,
  viec_tiep     text,                 -- việc cần làm tiếp theo
  can_ho_tro    text,                 -- Sales cần hỗ trợ gì
  tinh_trang    text,                 -- Tình trạng hỗ trợ: Đã xong / Còn tồn đọng
  ngay_hen      date,
  ngay_chot     date,
  gia_tri_chot  numeric,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists salesi_crm_lead_idx on public.salesi_crm(lead_id);
create index if not exists salesi_crm_ngay_idx on public.salesi_crm(ngay_cham desc);
create index if not exists salesi_crm_ma_idx   on public.salesi_crm(kiot_code);

alter table public.salesi_crm enable row level security;

-- App chạy bằng anon key.
drop policy if exists salesi_crm_read on public.salesi_crm;
create policy salesi_crm_read on public.salesi_crm for select using (true);
drop policy if exists salesi_crm_ins on public.salesi_crm;
create policy salesi_crm_ins on public.salesi_crm for insert with check (true);
drop policy if exists salesi_crm_upd on public.salesi_crm;
create policy salesi_crm_upd on public.salesi_crm for update using (true) with check (true);
drop policy if exists salesi_crm_del on public.salesi_crm;
create policy salesi_crm_del on public.salesi_crm for delete using (true);
