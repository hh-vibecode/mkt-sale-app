-- CHẶN GHI TRÙNG Ở CSDL (anh Hải 13/10/2026: "lỗi này nghiêm trọng… rà các lỗi dễ dup tương tự để bịt lại")
-- Lớp 2, sau lớp khoá nút trong app (motLan() ở index.html). Bắt các ca app không khoá được: mạng chậm bấm lại,
-- mở 2 tab, 2 job chạy chồng. Dòng MỚI giống HỆT 1 dòng vừa ghi trong 2 phút -> BỎ QUA (không báo lỗi, không ghi).
-- Cùng 1 lệnh INSERT nhiều dòng: dòng sau thấy dòng trước (trigger BEFORE ROW) -> lô có dòng lặp cũng chỉ ghi 1.
-- Ngoài 2 phút thì không chặn: Sale ghi lại đúng nội dung đó vào lúc khác vẫn là 1 lượt thật.

create or replace function public.chan_trung_salesi_crm() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from public.salesi_crm s
    where s.created_at > now() - interval '2 minutes'
      and s.lead_id is not distinct from new.lead_id and s.kiot_code is not distinct from new.kiot_code
      and s.customer_name is not distinct from new.customer_name and s.phone is not distinct from new.phone
      and s.ngay_cham is not distinct from new.ngay_cham and s.hinh_thuc is not distinct from new.hinh_thuc
      and s.noi_dung is not distinct from new.noi_dung and s.phan_hoi is not distinct from new.phan_hoi
      and s.sp_quan_tam is not distinct from new.sp_quan_tam and s.trang_thai is not distinct from new.trang_thai
      and s.ma_don is not distinct from new.ma_don and s.phan_loai is not distinct from new.phan_loai
      and s.nguoi_xu_ly is not distinct from new.nguoi_xu_ly and s.viec_tiep is not distinct from new.viec_tiep
      and s.ngay_hen is not distinct from new.ngay_hen and s.loai is not distinct from new.loai
      and s.created_by is not distinct from new.created_by) then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists chan_trung on public.salesi_crm;
create trigger chan_trung before insert on public.salesi_crm for each row execute function public.chan_trung_salesi_crm();

create or replace function public.chan_trung_datahub_manual() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from public.datahub_manual d
    where d.created_at > now() - interval '2 minutes'
      and d.customer_name is not distinct from new.customer_name and d.phone is not distinct from new.phone
      and d.sale_type is not distinct from new.sale_type and d.kiot_code is not distinct from new.kiot_code
      and d.created_date is not distinct from new.created_date and d.created_by is not distinct from new.created_by) then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists chan_trung on public.datahub_manual;
create trigger chan_trung before insert on public.datahub_manual for each row execute function public.chan_trung_datahub_manual();

-- hàm trigger không cho gọi trực tiếp qua API
revoke all on function public.chan_trung_salesi_crm() from public, anon, authenticated;
revoke all on function public.chan_trung_datahub_manual() from public, anon, authenticated;
