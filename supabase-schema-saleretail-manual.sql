-- Dữ liệu Sale NHẬP TAY cho báo cáo Sale Lẻ (tab Nhập Liệu -> đổ thẳng sang Master Data).
-- Tách riêng khỏi datahub_orders / kiot_* (những bảng đó do job sync ghi đè mỗi lần chạy).
-- Khoá chính là lead_id do app tự sinh (L-<mã shop>-<số đơn đầu>), ổn định theo đơn đầu tiên của khách.
create table if not exists public.saleretail_manual (
  lead_id      text primary key,
  kiot_code    text,          -- Mã KH Kiot Sale điền bù (khi chưa dán vào ghi chú Pancake)
  status       text,          -- Trạng thái Sale tự chọn (khách CHỐT ĐƠN thì khoá cứng ở UI, không ghi vào đây)
  lost_group   text,          -- Nhóm nguyên nhân mất lead
  lost_reason  text,          -- Nguyên nhân chi tiết
  note         text,
  updated_by   text,
  updated_at   timestamptz not null default now()
);

create index if not exists saleretail_manual_status_idx on public.saleretail_manual(status);

alter table public.saleretail_manual enable row level security;

-- App chạy bằng anon key (xem sbInsert trong index.html) nên anon cần đọc/ghi.
drop policy if exists saleretail_manual_read on public.saleretail_manual;
create policy saleretail_manual_read on public.saleretail_manual for select using (true);

drop policy if exists saleretail_manual_write on public.saleretail_manual;
create policy saleretail_manual_write on public.saleretail_manual for insert with check (true);

drop policy if exists saleretail_manual_update on public.saleretail_manual;
create policy saleretail_manual_update on public.saleretail_manual for update using (true) with check (true);

-- GỠ KHỎI BÁO CÁO: data rác/lỗi (vd đơn Pancake không có SĐT, không có Mã KH, không tra được là ai).
-- Đánh dấu chứ KHÔNG xoá: dòng vẫn nằm trong datahub_orders, gỡ nhầm thì khôi phục lại được,
-- và tab Nhập Liệu luôn liệt kê các khách đang bị gỡ kèm lý do + người gỡ.
alter table public.saleretail_manual add column if not exists excluded boolean not null default false;
alter table public.saleretail_manual add column if not exists excluded_reason text;

-- 24/9/2026 -- Tab "Ghi chú riêng" trong hồ sơ khách Sỉ: chân dung khách do Sale ghi, nguồn gốc là
-- cột "Ghi chú KH (ngày sinh, sở thích, tính cách,...)" của sheet 1.MASTER DATA SỈ (6 mục ①..⑥).
alter table public.saleretail_manual add column if not exists si_gc_tinh_cach  text;
alter table public.saleretail_manual add column if not exists si_gc_giao_tiep  text;
alter table public.saleretail_manual add column if not exists si_gc_ky_tinh    text;
alter table public.saleretail_manual add column if not exists si_gc_quyet_dinh text;
alter table public.saleretail_manual add column if not exists si_gc_yeu_to     text;
alter table public.saleretail_manual add column if not exists si_gc_luu_y      text;
alter table public.saleretail_manual add column if not exists si_gc_khac       text;

-- 24/9/2026 -- thiếu quyền xoá nên nút "Xoá khách" để lại hồ sơ mồ côi (M-0383). Bổ sung cho giống 2 bảng kia.
drop policy if exists saleretail_manual_del on public.saleretail_manual;
create policy saleretail_manual_del on public.saleretail_manual for delete using (true);

-- 25/9/2026: tên khách Sale sửa trong app (ghi đè tên Pancake khi hiển thị, job đồng bộ không đụng tới)
alter table public.saleretail_manual add column if not exists ten_sua text;
