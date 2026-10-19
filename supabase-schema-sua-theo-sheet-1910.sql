-- 19/10/2026 — Sửa dữ liệu app theo sheet DATA HUB cũ (dòng KHAC00xx Sale cửa hàng vẫn điền), anh Hải chọn từng ca:
-- (1) 4 khách Hiền Thuỷ: Sale = Đỗ Xuân Hoàng (người tư vấn online, theo sheet) thay người lên phiếu Kiot Vũ Hoàng Xuân -> gán tay si_sale
-- (2) KL ANH DUY 0349764439 (L-SD-1178): kênh = Website Hiền Thuỷ (thương hiệu HT), Sale = Đỗ Xuân Hoàng
-- (3) KL Anh Huy - HCM 0929707368 (M-0357): kênh = Facebook Hiền Thuỷ (thương hiệu HT) thay Facebook Nến Bơ theo phiếu Kiot
insert into saleretail_manual (lead_id, si_sale, updated_by, updated_at) values
  ('M-2195','Đỗ Xuân Hoàng','Monsieur Claude',now()),
  ('M-2143','Đỗ Xuân Hoàng','Monsieur Claude',now()),
  ('M-0472','Đỗ Xuân Hoàng','Monsieur Claude',now()),
  ('M-0512','Đỗ Xuân Hoàng','Monsieur Claude',now())
on conflict (lead_id) do update set si_sale=excluded.si_sale, updated_by=excluded.updated_by, updated_at=excluded.updated_at;
insert into saleretail_manual (lead_id, si_sale, kenh_sua, updated_by, updated_at) values
  ('L-SD-1178','Đỗ Xuân Hoàng','Website Hiền Thuỷ','Monsieur Claude',now()),
  ('M-0357',null,'Facebook Hiền Thuỷ','Monsieur Claude',now())
on conflict (lead_id) do update set si_sale=coalesce(excluded.si_sale,saleretail_manual.si_sale), kenh_sua=excluded.kenh_sua,
  updated_by=excluded.updated_by, updated_at=excluded.updated_at;
update datahub_manual set kenh='Facebook Hiền Thuỷ', brand='HT', updated_at=now() where id=357 and kiot_code='KH007554';
insert into activity_log(who,act,tbl,ref,label,fld,old_v,new_v) values
  ('Monsieur Claude','U','saleretail_manual','M-2195','KL Em Linh','Sale phụ trách (theo sheet Data Hub, anh duyệt 19/10)','Vũ Hoàng Xuân','Đỗ Xuân Hoàng'),
  ('Monsieur Claude','U','saleretail_manual','M-2143','KL CHỊ LINH','Sale phụ trách (theo sheet Data Hub, anh duyệt 19/10)','Vũ Hoàng Xuân','Đỗ Xuân Hoàng'),
  ('Monsieur Claude','U','saleretail_manual','M-0472','KL CHỊ DUYÊN','Sale phụ trách (theo sheet Data Hub, anh duyệt 19/10)','Vũ Hoàng Xuân','Đỗ Xuân Hoàng'),
  ('Monsieur Claude','U','saleretail_manual','M-0512','KL CHỊ YẾN','Sale phụ trách (theo sheet Data Hub, anh duyệt 19/10)','Vũ Hoàng Xuân','Đỗ Xuân Hoàng'),
  ('Monsieur Claude','U','saleretail_manual','L-SD-1178','Ngoquoc Duy','Sale + Kênh (theo sheet Data Hub, anh duyệt 19/10)','Đặng Thị Minh Oanh · Facebook Shidai','Đỗ Xuân Hoàng · Website Hiền Thuỷ'),
  ('Monsieur Claude','U','datahub_manual','M-0357','KL Anh Huy - HCM','Kênh (theo sheet Data Hub, anh duyệt 19/10)','Facebook Nến Bơ','Facebook Hiền Thuỷ');
select lead_id, si_sale, kenh_sua from saleretail_manual where lead_id in ('M-2195','M-2143','M-0472','M-0512','L-SD-1178','M-0357') order by 1;
