-- XOÁ LƯỢT CHĂM SÓC TRÙNG Y HỆT (anh Hải 13/10/2026: "lỗi này nghiêm trọng… xoá hết mấy cái bị duplicate đi")
-- Trùng = GIỐNG HỆT mọi cột nội dung (khách, SĐT, Mã KH, ngày, nội dung, người xử lý, phân loại, việc, hẹn, mã đơn, loại, người tạo…),
-- chỉ khác id / created_at. Giữ dòng SỚM NHẤT mỗi nhóm (ngày hoàn thành việc = lúc lưu lần đầu).
-- Nguồn trùng lúc xoá: 75 dòng lô nạp sheet Sỉ 23/9 (sheet có dòng lặp) + 11 dòng Sale bấm Lưu nhiều lần (6–9/10).
-- KHÔNG dùng khoá lỏng (lead_id + ngày + nội dung): dòng lead_id rỗng sẽ gom nhầm KHÁCH KHÁC nhau (đếm sai 134 lúc đầu).
--
-- 1) xem trước:  select count(*) from v_trung;   2) select public.chup_backup();   3) chạy khối xoá bên dưới.

create temp view v_trung as
select id, min(id) over w giu, count(*) over w c
from public.salesi_crm
window w as (partition by lead_id, kiot_code, customer_name, phone, ngay_cham, sp_quan_tam, nguoi_xu_ly, nguon, kenh, sales,
  hinh_thuc, noi_dung, phan_loai, gia_tri_du_kien, viec_tiep, ngay_hen, trang_thai, ma_don, phan_hoi, loai, created_by,
  ngay_chot, gia_tri_chot);

-- dấu kiểm / giao của dòng bị xoá -> chép sang dòng giữ (nếu dòng giữ chưa có)
update public.salesi_crm g set
  kiem_luc=coalesce(g.kiem_luc,x.kiem_luc), kiem_boi=coalesce(g.kiem_boi,x.kiem_boi), giao_luc=coalesce(g.giao_luc,x.giao_luc)
from (select v.giu, max(s.kiem_luc) kiem_luc, max(s.kiem_boi) kiem_boi, min(s.giao_luc) giao_luc
      from v_trung v join public.salesi_crm s on s.id=v.id where v.id<>v.giu group by v.giu) x
where g.id=x.giu and (g.kiem_luc is null and x.kiem_luc is not null or g.giao_luc is null and x.giao_luc is not null);

delete from public.salesi_crm where id in (select id from v_trung where id<>giu);
