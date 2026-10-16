-- 16/10/2026 (anh Hải chọn "Chuyển sang Sỉ"): KH006468 "KB CÔ LÀ" -- Kiot đặt nhóm "Khách buôn" nên báo cáo Lẻ gạt đơn,
-- bên Sỉ không có dòng -> 5 HĐ 7.746.000đ rơi khỏi đối soát. Chuyển dòng tự tạo M-0696 sang Sỉ (cùng việc job tu-tao-nhap-tay
-- từ nay tự làm khi nhóm Kiot đổi).
update datahub_manual set sale_type='Sỉ', updated_at=now() where id=696 and kiot_code='KH006468' and sale_type='Lẻ';
update salesi_crm set loai='Sỉ' where lead_id='M-0696' and coalesce(loai,'')<>'Sỉ';
insert into activity_log(who,act,tbl,ref,label,fld,old_v,new_v)
values ('Monsieur Claude','U','datahub_manual','M-0696','KL CÔ LÀ','Loại khách (theo nhóm Kiot "Khách buôn", anh Hải duyệt 16/10)','Lẻ','Sỉ');
select id, kiot_code, sale_type from datahub_manual where id=696;
