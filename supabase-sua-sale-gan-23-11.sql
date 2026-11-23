-- 23/11/2026 — Monsieur Claude: sửa Sale job gan-the-qc gán sai theo sale_qc cũ của QC.
-- QC (commit a82705a) đã sửa: lượt chưa có Sale trả lời thì lấy người CÓ TÊN nhắn gần nhất, không theo thương hiệu (Thời Đại / Shidai = Nguyên).
-- 2 khách job tạo đơn sáng 23/11 đã gán Nguyên theo thương hiệu, người nhắn thật là Vân Ngọc. Chưa người nào sửa tay (chỉ job 7 ngày đổi Phân loại).
-- Chỉ đổi si_sale, giữ updated_by / updated_at (job 7 ngày dựa vào đó để biết dòng của nó).
-- Phi Hoàng L-SD-2024 KHÔNG đổi: Kim Oanh tự ghi lượt chăm sóc 11:51 dưới tên Sale Vân Ngọc.
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
select lead_id, si_sale, updated_by from saleretail_manual where lead_id in ('L-SD-2052','L-SD-2063');
