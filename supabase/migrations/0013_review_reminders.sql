-- =====================================================================
-- Đổi thời điểm được đánh giá và giúp người chơi tìm tới chỗ đánh giá. Chạy sau 0012_venue_reviews.sql.
--
-- Quy tắc mới (chủ dự án duyệt 31/10/2026), thay cho "24 giờ sau giờ chơi" ở 0012:
--   - Chủ sân xác nhận thanh toán xong (bookings.confirmed_at) là người chơi đánh giá được NGAY, không cần chờ chơi xong.
--   - Hạn đánh giá và sửa đánh giá: 24 giờ kể từ lúc xác nhận. Người chơi có thể bỏ qua; quá hạn thì không đánh giá
--     được nữa.
-- Thêm:
--   - Thông báo "Chủ sân đã xác nhận" mời đánh giá trong 24 giờ, bấm vào tới thẳng ô đánh giá.
--   - my_reviewable_bookings(): lượt đang mở đánh giá, để trang "Lịch đặt của tôi" hiện nút "Đánh giá sân".
--   - send_review_reminders(): còn dưới 3 giờ là hết hạn mà chưa đánh giá thì nhắc MỘT lần. pg_cron chạy mỗi 15 phút
--     (nếu dự án đã bật pg_cron).
-- =====================================================================

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'booking_new', 'payment_reported', 'booking_confirmed', 'booking_cancelled', 'booking_expired', 'venue_reviewed',
  'review_new', 'review_replied', 'review_hidden', 'review_reminder'));

-- Thời điểm hết hạn đánh giá của một lượt (null nếu chưa được xác nhận)
create or replace function public.review_deadline(p_booking_id bigint)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select confirmed_at + interval '24 hours' from bookings where id = p_booking_id and status = 'confirmed';
$$;
revoke execute on function public.review_deadline(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Trạng thái đánh giá của một lượt (thay bản 0012)
-- ---------------------------------------------------------------------
create or replace function public.my_booking_review(p_booking_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_deadline timestamptz;
  v_review venue_reviews%rowtype;
begin
  select * into v_booking from bookings where id = p_booking_id;
  if not found or v_booking.player_id is distinct from auth.uid() or my_role() is distinct from 'player' then
    return null;
  end if;
  v_deadline := review_deadline(p_booking_id);
  select * into v_review from venue_reviews where booking_id = p_booking_id;
  return jsonb_build_object(
    'can_edit', v_deadline is not null and now() < v_deadline,
    'window_starts_at', case when v_deadline is null then null else v_booking.confirmed_at end,
    'deadline', v_deadline,
    'review', case when v_review.id is null then null else jsonb_build_object(
      'id', v_review.id, 'rating', v_review.rating, 'comment', v_review.comment, 'is_anonymous', v_review.is_anonymous,
      'status', v_review.status, 'hidden_reason', v_review.hidden_reason, 'owner_reply', v_review.owner_reply,
      'owner_replied_at', v_review.owner_replied_at, 'created_at', v_review.created_at, 'updated_at', v_review.updated_at) end);
end;
$$;

-- ---------------------------------------------------------------------
-- Tạo hoặc sửa đánh giá (thay bản 0012): mở từ lúc chủ sân xác nhận, trong 24 giờ
-- ---------------------------------------------------------------------
create or replace function public.submit_review(p_booking_id bigint, p_rating integer, p_comment text default null,
                                                p_anonymous boolean default false)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_deadline timestamptz;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_id bigint;
  v_existing bigint;
  v_venue record;
begin
  if my_role() is distinct from 'player' then
    raise exception 'FORBIDDEN' using detail = 'Chỉ tài khoản người chơi mới đánh giá được sân';
  end if;
  select * into v_booking from bookings where id = p_booking_id;
  if not found or v_booking.player_id is distinct from auth.uid() then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy lượt đặt';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'INVALID_STATE' using detail = 'Chỉ đánh giá được lượt đặt đã được chủ sân xác nhận';
  end if;
  v_deadline := review_deadline(p_booking_id);
  if v_deadline is null or now() >= v_deadline then
    raise exception 'INVALID_STATE' using detail = 'Đã quá 24 giờ kể từ khi chủ sân xác nhận, không thể đánh giá hoặc sửa đánh giá';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_INPUT' using detail = 'Hãy chọn từ 1 đến 5 sao';
  end if;
  if v_comment is not null and char_length(v_comment) > 1000 then
    raise exception 'INVALID_INPUT' using detail = 'Bình luận tối đa 1000 ký tự';
  end if;

  select id into v_existing from venue_reviews where booking_id = p_booking_id;
  insert into venue_reviews (venue_id, booking_id, player_id, rating, comment, is_anonymous)
  values (v_booking.venue_id, p_booking_id, auth.uid(), p_rating, v_comment, coalesce(p_anonymous, false))
  on conflict (booking_id) do update
    set rating = excluded.rating, comment = excluded.comment, is_anonymous = excluded.is_anonymous, updated_at = now()
  returning id into v_id;

  if v_existing is null then
    select v.name, v.owner_id into v_venue from venues v where v.id = v_booking.venue_id;
    perform notify(v_venue.owner_id, 'review_new', 'Sân có đánh giá mới',
      v_venue.name || ': ' || p_rating || ' sao' || coalesce(' - "' || left(v_comment, 80) || case when char_length(v_comment) > 80 then '..."' else '"' end, '') || '.',
      '/owner/reviews', p_booking_id, v_booking.venue_id);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Lượt đang mở đánh giá của người chơi đang đăng nhập
-- ---------------------------------------------------------------------
create or replace function public.my_reviewable_bookings()
returns table (booking_id bigint, deadline timestamptz, reviewed boolean)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.confirmed_at + interval '24 hours', exists (select 1 from venue_reviews r where r.booking_id = b.id)
  from bookings b
  where b.player_id = auth.uid()
    and my_role() = 'player'
    and b.status = 'confirmed'
    and b.confirmed_at is not null
    and now() < b.confirmed_at + interval '24 hours';
$$;
revoke execute on function public.my_reviewable_bookings() from public, anon;
grant execute on function public.my_reviewable_bookings() to authenticated;

-- ---------------------------------------------------------------------
-- Nhắc đánh giá: còn dưới 3 giờ là hết hạn mà chưa đánh giá; mỗi lượt nhắc một lần
-- ---------------------------------------------------------------------
create or replace function public.send_review_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select b.id, b.code, b.player_id, b.venue_id, v.name as venue_name, b.confirmed_at + interval '24 hours' as deadline
    from bookings b
    join venues v on v.id = b.venue_id
    where b.status = 'confirmed'
      and b.player_id is not null
      and b.confirmed_at is not null
      and now() >= b.confirmed_at + interval '21 hours'
      and now() < b.confirmed_at + interval '24 hours'
      and not exists (select 1 from venue_reviews r where r.booking_id = b.id)
      and not exists (select 1 from notifications n where n.booking_id = b.id and n.kind = 'review_reminder')
  loop
    perform notify(v_row.player_id, 'review_reminder', 'Sắp hết hạn đánh giá sân',
      'Bạn thấy ' || v_row.venue_name || ' thế nào? Đánh giá lượt ' || v_row.code || ' trước '
        || to_char(v_row.deadline at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') || ', hoặc bỏ qua nếu không muốn.',
      '/bookings/' || v_row.id || '#danh-gia', v_row.id, v_row.venue_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.send_review_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Thông báo biến động lượt đặt (thay bản 0006): khi xác nhận thì mời đánh giá, link tới ô đánh giá.
-- Các trường hợp khác giữ nguyên.
-- ---------------------------------------------------------------------
create or replace function public.notify_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue record;
  v_slot text;
  v_owner_link text;
begin
  select v.id, v.name, v.owner_id into v_venue from venues v where v.id = new.venue_id;
  select to_char(bi.start_time, 'HH24:MI') || ' ngày ' || to_char(bi.booking_date, 'DD/MM') into v_slot
  from booking_items bi where bi.booking_id = new.id order by bi.booking_date, bi.start_time limit 1;
  v_slot := coalesce(', ' || v_slot, '');

  if tg_op = 'INSERT' then
    if new.status = 'holding' then
      perform notify(v_venue.owner_id, 'booking_new', 'Có lượt giữ chỗ mới',
        new.code || ' tại ' || v_venue.name || v_slot || ': người chơi đang giữ chỗ, chờ chuyển khoản ' || vnd(new.total_amount) || '.',
        '/owner/bookings?status=holding', new.id, v_venue.id);
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;
  v_owner_link := '/owner/bookings?status=' || new.status;

  if new.status = 'awaiting_confirmation' then
    perform notify(v_venue.owner_id, 'payment_reported', 'Người chơi báo đã chuyển khoản',
      new.code || ' tại ' || v_venue.name || v_slot || ': ' || vnd(new.total_amount)
        || '. Kiểm tra tài khoản rồi xác nhận.',
      v_owner_link, new.id, v_venue.id);
  elsif new.status = 'confirmed' then
    perform notify(new.player_id, 'booking_confirmed', 'Chủ sân đã xác nhận lượt đặt',
      new.code || ' tại ' || v_venue.name || v_slot || ' đã được xác nhận. Hẹn gặp bạn ở sân! '
        || 'Bạn có thể đánh giá sân trong 24 giờ.',
      '/bookings/' || new.id || '#danh-gia', new.id, v_venue.id);
  elsif new.status = 'cancelled' then
    if new.cancelled_by is not distinct from new.player_id then
      perform notify(v_venue.owner_id, 'booking_cancelled', 'Người chơi đã hủy lượt đặt',
        new.code || ' tại ' || v_venue.name || v_slot || ' đã bị người chơi hủy. Khung giờ được trả lại.',
        v_owner_link, new.id, v_venue.id);
    else
      perform notify(new.player_id, 'booking_cancelled', 'Lượt đặt bị hủy',
        new.code || ' tại ' || v_venue.name || v_slot || ' đã bị chủ sân hủy'
          || coalesce('. Lý do: ' || new.cancel_reason, '') || '.',
        '/bookings/' || new.id, new.id, v_venue.id);
    end if;
  elsif new.status = 'expired' then
    perform notify(new.player_id, 'booking_expired', 'Hết thời gian giữ chỗ',
      new.code || ' tại ' || v_venue.name || v_slot || ' đã hết hạn vì chưa báo chuyển khoản. Bạn có thể đặt lại.',
      '/bookings/' || new.id, new.id, v_venue.id);
  end if;
  return new;
end;
$$;

-- Lịch nhắc mỗi 15 phút (chỉ khi đã bật pg_cron; môi trường kiểm thử không có pg_cron thì bỏ qua)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('review-reminders', '*/15 * * * *', 'select public.send_review_reminders();');
  end if;
end;
$$;
