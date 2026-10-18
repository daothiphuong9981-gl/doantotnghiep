-- =====================================================================
-- Lượt chờ xác nhận thanh toán bị kẹt sau giờ chơi. Chạy sau 0006_notifications.sql.
--
-- Trước đây: người chơi báo đã chuyển khoản, chủ sân chưa xác nhận kịp trước giờ chơi thì lượt đặt
-- không hủy được nữa (cancel_booking chặn sau giờ chơi) và giao diện ẩn luôn nút xử lý.
-- Nay: chủ sân vẫn "Đã nhận tiền" (confirm_payment vốn không giới hạn thời gian) hoặc
-- "Chưa nhận được" (hủy, bắt buộc lý do) với lượt đang chờ xác nhận, kể cả khi đã qua giờ chơi.
-- Không tự động hủy: người chơi có thể đã chuyển tiền thật, chỉ chủ sân đối chiếu được tài khoản.
-- =====================================================================

create or replace function public.cancel_booking(p_booking_id bigint, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_booking bookings%rowtype;
  v_is_player boolean;
  v_is_owner boolean;
  v_first timestamp;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy lượt đặt';
  end if;
  v_is_player := v_booking.player_id is not distinct from v_uid and v_uid is not null;
  v_is_owner := owns_venue(v_booking.venue_id) and my_role() = 'owner';
  if not (v_is_player or v_is_owner) then
    raise exception 'FORBIDDEN' using detail = 'Bạn không có quyền với lượt đặt này';
  end if;
  if v_booking.status not in ('holding', 'awaiting_confirmation', 'confirmed') then
    raise exception 'INVALID_STATE' using detail = 'Lượt đặt đã hủy hoặc đã hết hạn';
  end if;
  if v_is_owner and not v_is_player and v_reason is null then
    raise exception 'INVALID_INPUT' using detail = 'Hãy nhập lý do hủy';
  end if;
  select min(booking_date + start_time) into v_first from booking_items where booking_id = p_booking_id;
  -- Ngoại lệ: lượt người chơi đã báo chuyển khoản mà chủ sân chưa xử lý thì chủ sân vẫn được từ chối
  -- ("Chưa nhận được tiền") sau giờ chơi, để lượt đặt không bị kẹt ở trạng thái chờ xác nhận.
  if v_first is not null and v_first <= vn_now()
     and not (v_is_owner and v_booking.status = 'awaiting_confirmation') then
    raise exception 'INVALID_STATE' using detail = 'Lượt đặt đã đến hoặc đã qua giờ chơi';
  end if;

  update bookings set status = 'cancelled', cancel_reason = v_reason, cancelled_by = v_uid where id = p_booking_id;
  update booking_items set is_active = false where booking_id = p_booking_id;
  return 'cancelled';
end;
$$;
