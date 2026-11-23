-- 23/11/2026 — Monsieur Claude: sửa Sale job gan-the-qc gán sai theo sale_qc cũ của QC.
-- QC (commit a82705a) đã sửa: lượt chưa có Sale trả lời thì lấy người CÓ TÊN nhắn gần nhất, không theo thương hiệu (Thời Đại / Shidai = Nguyên).
-- 2 khách job tạo đơn sáng 23/11 đã gán Nguyên theo thương hiệu, người nhắn thật là Vân Ngọc. Chưa người nào sửa tay (chỉ job 7 ngày đổi Phân loại).
-- Chỉ đổi si_sale, giữ updated_by / updated_at (job 7 ngày dựa vào đó để biết dòng của nó).
-- (Đã chạy 14:2x.)
begin;
update saleretail_manual set si_sale = 'Trịnh Lê Vân Ngọc'
 where lead_id in ('L-SD-2052','L-SD-2063') and si_sale = 'Nguyễn Khánh Nguyên';
update pancake_gan_the_qc p set sale_gan = 'Trịnh Lê Vân Ngọc'
  from datahub_orders o
 where o.conversation_id = p.conversation_id and o.shop_id = 1943052948 and o.system_id in (2052, 2063)
   and p.sale_gan = 'Nguyễn Khánh Nguyên';
insert into activity_log (at, who, act, tbl, ref, label, fld, old_v, new_v)
select now(), 'Monsieur Claude', 'U', 'saleretail_manual', x, 'Sửa Sale job gán sai (QC sửa sale_qc, a82705a)', 'Sales', 'Nguyễn Khánh Nguyên', 'Trịnh Lê Vân Ngọc'
  from unnest(array['L-SD-2052','L-SD-2063']) x;
commit;

-- ANH CHỐT 23/11 (qua QC + xác nhận trong chat MKT): khách trong view QC đứng tên Sale theo cột sale của QC (người CÓ TÊN nhắn gần nhất),
-- TRỪ khách Sale đã tự gán / đã xử lý trên app. Lô đầu 3 khách (Sale gán tay trống hoặc do job gán, không người nào cập nhật hồ sơ):
--   Phi Hoàng L-SD-2024  Vân Ngọc (job gán) -> Bùi Thị Kim Oanh
--   Van Anh Luu L-CT-0967  (app tự suy Đinh Ngọc Diệp) -> Trịnh Lê Vân Ngọc
--   Hà Vi Doris L-SD-2011  (app tự suy Nguyễn Khánh Nguyên) -> Trịnh Lê Vân Ngọc
-- GIỮ: L-SD-2001 Nguyễn Bá Kiên, L-SD-2013 Thu Hiền (Khánh Nguyên đã tự cập nhật Phân loại), KH007586 Nguyễn Thuý Vân (đã chốt, anh gán Lệ).
begin;
update saleretail_manual set si_sale = 'Bùi Thị Kim Oanh' where lead_id = 'L-SD-2024' and si_sale = 'Trịnh Lê Vân Ngọc';
insert into saleretail_manual (lead_id, si_sale, updated_by, updated_at) values
  ('L-CT-0967', 'Trịnh Lê Vân Ngọc', 'Monsieur Claude (QC)', now()),
  ('L-SD-2011', 'Trịnh Lê Vân Ngọc', 'Monsieur Claude (QC)', now())
on conflict (lead_id) do update set si_sale = excluded.si_sale where saleretail_manual.si_sale is null;
insert into activity_log (at, who, act, tbl, ref, label, fld, old_v, new_v) values
  (now(), 'Monsieur Claude', 'U', 'saleretail_manual', 'L-SD-2024', 'Sale theo QC (người có tên nhắn gần nhất) — anh chốt 23/11', 'si_sale', 'Trịnh Lê Vân Ngọc', 'Bùi Thị Kim Oanh'),
  (now(), 'Monsieur Claude', 'U', 'saleretail_manual', 'L-CT-0967', 'Sale theo QC (người có tên nhắn gần nhất) — anh chốt 23/11', 'si_sale', null, 'Trịnh Lê Vân Ngọc'),
  (now(), 'Monsieur Claude', 'U', 'saleretail_manual', 'L-SD-2011', 'Sale theo QC (người có tên nhắn gần nhất) — anh chốt 23/11', 'si_sale', null, 'Trịnh Lê Vân Ngọc');
commit;
select lead_id, si_sale, updated_by from saleretail_manual where lead_id in ('L-SD-2052','L-SD-2063','L-SD-2024','L-CT-0967','L-SD-2011') order by 1;
