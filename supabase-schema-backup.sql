-- SAO LƯU DỮ LIỆU NGƯỜI NHẬP (21/9/2026)
-- Supabase bản miễn phí KHÔNG có bản sao lưu khôi phục được (đã kiểm tra: backups rỗng, PITR tắt).
-- Dữ liệu kéo từ Pancake/Kiot thì mất cũng kéo lại được, nhưng 3 nhóm dưới đây MẤT LÀ MẤT HẲN:
--   saleretail_manual : nội dung trao đổi, giá trị tiềm năng, trạng thái Sale chọn
--   datahub_manual    : khách ngoài Pancake Sale tự nhập
--   sales_users       : tài khoản + phân quyền
-- Nên chụp lại mỗi ngày dưới dạng JSON, giữ 14 bản. Rất nhẹ (vài trăm dòng/bảng).
create table if not exists public.backup_snapshots (
  id     bigserial primary key,
  at     timestamptz not null default now(),
  bang   text not null,
  so_dong int not null,
  du_lieu jsonb not null
);
create index if not exists backup_snapshots_at_idx on public.backup_snapshots(at desc);
alter table public.backup_snapshots enable row level security;  -- chỉ service key đọc được

-- 24/9/2026: thêm salesi_crm (lịch sử chăm sóc Sỉ, 2.005 lượt nhập tay) + sale_nhan_su vào bản chụp.
create or replace function public.chup_backup()
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare t text; n int; ket text := '';
begin
  foreach t in array array['saleretail_manual','datahub_manual','sales_users','salesi_crm','sale_nhan_su'] loop
    execute format('insert into public.backup_snapshots(bang, so_dong, du_lieu)
                    select %L, count(*), coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %I x', t, t);
    get diagnostics n = row_count;
    ket := ket || t || ' ✓ ';
  end loop;
  -- giữ 14 bản gần nhất mỗi bảng, xoá phần cũ hơn
  delete from public.backup_snapshots b
   where b.id not in (
     select id from (
       select id, row_number() over (partition by bang order by at desc) r
       from public.backup_snapshots
     ) s where r <= 14);
  return 'Đã chụp: ' || ket;
end;$$;

-- Chụp mỗi ngày 01:00 giờ VN (18:00 UTC hôm trước)
select cron.unschedule(jobname) from cron.job where jobname = 'backup-hang-ngay';
select cron.schedule('backup-hang-ngay', '0 18 * * *', $$select public.chup_backup()$$);

-- Khôi phục 1 bảng từ bản chụp (chạy tay khi cần):
--   select public.khoi_phuc_backup('saleretail_manual', <id bản chụp>);
create or replace function public.khoi_phuc_backup(p_bang text, p_id bigint)
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare d jsonb; n int;
begin
  select du_lieu into d from public.backup_snapshots where id = p_id and bang = p_bang;
  if d is null then raise exception 'Không tìm thấy bản chụp % của bảng %', p_id, p_bang; end if;
  execute format('insert into %I select * from jsonb_populate_recordset(null::%I, $1)
                  on conflict do nothing', p_bang, p_bang) using d;
  get diagnostics n = row_count;
  return format('Đã khôi phục %s dòng vào %s (chỉ thêm dòng thiếu, không ghi đè dòng đang có)', n, p_bang);
end;$$;
