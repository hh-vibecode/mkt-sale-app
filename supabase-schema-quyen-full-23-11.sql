-- MỞ QUYỀN XEM FULL (anh Hải 23/11/2026: "oanh nguyên mở quyền xem full hết sỉ lẻ với sale nhé, chị lệ cũng thế").
-- Kim Oanh, Khánh Nguyên, Sale Chánh Tâm (tài khoản chung chị Lệ đang dùng — Diệp / người khác dùng chung cũng được xem full):
-- thêm quyền báo cáo Sale Lẻ + Sale Sỉ; data_sales = [] (mọi Sale), data_types = [] (cả Lẻ lẫn Sỉ). Giữ nguyên các quyền khác. (cột jsonb)
update sales_users set
  permissions = (select jsonb_agg(distinct p) from jsonb_array_elements_text(coalesce(permissions,'[]'::jsonb) || '["report-saleretail","report-salesi"]'::jsonb) p),
  data_sales = '[]'::jsonb, data_types = '[]'::jsonb
where user_id in ('SR_chioanh_9eef','SR_khanhnguyen_c35d','SR_chanhtamsale_cb45');
insert into activity_log (who, act, tbl, ref, label, fld, old_v, new_v)
select 'Monsieur Claude', 'U', 'sales_users', user_id, name, 'Phân quyền', 'theo phạm vi cũ', 'xem full Sỉ + Lẻ, mọi Sale (anh Hải 23/11)'
from sales_users where user_id in ('SR_chioanh_9eef','SR_khanhnguyen_c35d','SR_chanhtamsale_cb45');
