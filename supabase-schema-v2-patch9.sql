-- Patch 9: sắp lại sort_order của status thành đúng thứ tự PHỄU bán hàng.
-- Trước đó thứ tự là thứ tự thêm vào DB (Đang chăm sóc → Chốt đơn → Mất lead → ... → Chờ phản hồi → Có nhu cầu),
-- khiến cột Pipeline đọc từ trái sang phải bị sai logic: trạng thái KẾT THÚC (Chốt đơn/Mất lead) lại đứng
-- TRƯỚC các bước giữa phễu (Chờ phản hồi/Có nhu cầu). Ảnh hưởng cả thứ tự dropdown chọn trạng thái ở mọi nơi.
update config_options set sort_order = 1 where category='status' and value='Đang chăm sóc';
update config_options set sort_order = 2 where category='status' and value='Chờ phản hồi';
update config_options set sort_order = 3 where category='status' and value='Có nhu cầu';
update config_options set sort_order = 4 where category='status' and value='Chốt đơn';
update config_options set sort_order = 5 where category='status' and value='Mất lead';
update config_options set sort_order = 6 where category='status' and value='Không có nhu cầu';
update config_options set sort_order = 7 where category='status' and value='Chăm sóc dài hạn';
