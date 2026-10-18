-- TÙY CHỌN: tự giải phóng lượt giữ chỗ hết hạn mỗi phút bằng pg_cron.
-- Trước khi chạy, bật extension pg_cron trong Supabase: Database > Extensions > pg_cron.
-- Không chạy file này thì hệ thống vẫn đúng: lượt hết hạn được giải phóng ngay khi có người
-- xem khung giờ, tạo lượt đặt hoặc mở danh sách lượt đặt; pg_cron chỉ giúp trạng thái
-- "Hết hạn giữ chỗ" được cập nhật kể cả khi không ai truy cập.
select cron.schedule('expire-holds', '* * * * *', $$ select public.expire_holds(); $$);
