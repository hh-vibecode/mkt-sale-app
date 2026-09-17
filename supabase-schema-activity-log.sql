-- Nhật ký thao tác (audit log). Thiết kế để KHÔNG PHÌNH:
--   1) 1 dòng = 1 TRƯỜNG bị đổi, không phải 1 lần bấm lưu -> không nhét cả bản ghi vào.
--   2) Hành động lưu 1 KÝ TỰ (C/U/D) chứ không phải chữ "create"/"update"/"delete".
--   3) Giá trị cũ/mới cắt còn 120 ký tự (đủ để đối chiếu, không lưu cả đoạn văn).
--   4) Chỉ giữ 7 NGÀY gần nhất, tự xoá hằng ngày (xem hàm purge_activity_log bên dưới).
-- Ước lượng: ~200 byte/dòng. Kể cả 1.000 thao tác/ngày thì tối đa ~1,4 MB -- không đáng kể.
create table if not exists public.activity_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  who     text,                       -- tài khoản thao tác
  act     char(1) not null,           -- C = thêm, U = sửa, D = XOÁ
  tbl     text not null,              -- bảng bị tác động
  ref     text,                       -- khoá của bản ghi (lead_id / mã KH / id)
  label   text,                       -- tên khách... để đọc log không phải tra ngược
  fld     text,                       -- trường bị đổi (rỗng khi thêm/xoá cả dòng)
  old_v   text,
  new_v   text
);

-- Tra theo thời gian là truy vấn chính (xem log gần nhất), nên index giảm dần.
create index if not exists activity_log_at_idx on public.activity_log(at desc);
-- Lọc riêng thao tác XOÁ -- thứ cần soi nhất; index một phần nên rất nhẹ.
create index if not exists activity_log_del_idx on public.activity_log(at desc) where act='D';

alter table public.activity_log enable row level security;
-- App chạy bằng anon key. Cho đọc + ghi, KHÔNG cho sửa/xoá: log mà sửa được thì mất ý nghĩa.
drop policy if exists activity_log_read on public.activity_log;
create policy activity_log_read on public.activity_log for select using (true);
drop policy if exists activity_log_ins on public.activity_log;
create policy activity_log_ins on public.activity_log for insert with check (true);

-- Cắt giá trị dài + chặn ghi mốc thời gian giả từ client.
create or replace function public.trim_activity_log() returns trigger language plpgsql as $$
begin
  new.at    := now();
  new.old_v := left(new.old_v, 120);
  new.new_v := left(new.new_v, 120);
  new.label := left(new.label, 80);
  return new;
end $$;
drop trigger if exists trim_activity_log_t on public.activity_log;
create trigger trim_activity_log_t before insert on public.activity_log
  for each row execute function public.trim_activity_log();

-- Dọn log quá 7 ngày.
create or replace function public.purge_activity_log() returns integer language plpgsql as $$
declare n integer;
begin
  delete from public.activity_log where at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end $$;
