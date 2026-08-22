-- Patch 8: Order module thật hơn -- thêm Số lượng (quantity), trước đó chỉ có sản phẩm dạng text tự do
-- không có số lượng, không tách được đơn nhiều sản phẩm/nhiều số lượng.
alter table orders add column if not exists quantity int not null default 1;
