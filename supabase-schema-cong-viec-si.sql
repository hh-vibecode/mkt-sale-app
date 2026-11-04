-- BÁO CÁO CÔNG VIỆC — CẤU TRÚC BẢNG SALE SỈ (đề xuất quản lý, anh Hải gửi 04/11/2026):
--   A. Khách hàng: 01 KH có kế hoạch chốt hôm nay · 02 KH đến lịch tái chăm sóc · 03 KH mới trong ngày · 04 KH chăm sóc sau bán (app tự lọc)
--   B. Công việc cố định (checklist hằng ngày, danh mục cv_co_dinh_si) · C. Công việc chiến dịch (đổi theo tháng, danh mục cv_chien_dich_si)
-- Việc B / C lưu chung bảng cong_viec_muc: lead_id = '#B:<tên>' / '#C:<tên>', xong = đã làm, ghi_chu = ghi chú / link bài. Monsieur Claude.
alter table public.cong_viec_muc add column if not exists xong boolean;

insert into public.danh_muc (loai, gia_tri, mau, thu_tu, he_thong) values
 ('cv_co_dinh_si','Đăng bài Zalo Sỉ / Zalo Lẻ','#0ea5e9',1,false),
 ('cv_co_dinh_si','Đăng bài nhóm CTV','#8b5cf6',2,false),
 ('cv_co_dinh_si','Đăng bài nhóm Sỉ Shidai','#16a34a',3,false),
 ('cv_chien_dich_si','Chiến dịch 1 – Hội nhóm CTV','#f59e0b',1,false),
 ('cv_chien_dich_si','Chiến dịch 2 – Hội chợ KXC','#e11d48',2,false)
on conflict (loai, gia_tri) do nothing;

-- Mẫu T10 bên Sỉ: đổi đầu mục cũ sang nhóm A (Chăm sau bán -> 04, còn lại -> 02 đến lịch tái chăm sóc)
update public.cong_viec_muc m set dau_muc = case when m.dau_muc = 'Chăm sau bán' then 'KH chăm sóc sau bán' else 'KH đến lịch tái chăm sóc' end
 where m.loai = 'Sỉ' and left(m.lead_id,1) <> '#' and m.dau_muc in ('Gọi / nhắn chăm sóc','Tư vấn, gửi báo giá','Chốt đơn','Chăm sau bán','Thu tiền, cọc')
   and exists (select 1 from public.cong_viec_ngay n where n.ngay = m.ngay and n.nguoi_id = m.nguoi_id and (n.tong_ket->>'mau')::boolean);

-- THU HỒI ĐỂ SỬA (anh Hải 04/11/2026): gửi kế hoạch / chốt báo cáo rồi thì KHOÁ, muốn sửa phải Thu hồi; đếm số lần cho quản lý thấy.
alter table public.cong_viec_ngay add column if not exists thu_hoi_kh int not null default 0;
alter table public.cong_viec_ngay add column if not exists thu_hoi_bc int not null default 0;
