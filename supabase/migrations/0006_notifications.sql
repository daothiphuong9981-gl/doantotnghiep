-- =====================================================================
-- Thông báo trong ứng dụng khi có biến động đặt sân và duyệt sân.
-- Chạy sau 0005_admin_stats_ai.sql.
--
-- Thông báo do trigger sinh ra, nên mọi đường thay đổi trạng thái (website, hàm SQL, expire_holds
-- chạy định kỳ) đều được ghi nhận:
--   chủ sân  <- có lượt giữ chỗ mới, người chơi báo đã chuyển khoản, người chơi hủy, sân được duyệt/từ chối/ẩn
--   người chơi <- chủ sân xác nhận, chủ sân hủy (kèm lý do), hết hạn giữ chỗ
-- Đặt app.skip_notifications = '1' trong phiên để tắt (dùng khi nạp dữ liệu demo hàng loạt).
-- =====================================================================

create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  booking_id  bigint references public.bookings (id) on delete cascade,
  venue_id    bigint references public.venues (id) on delete cascade,
  kind        text not null check (kind in ('booking_new', 'payment_reported', 'booking_confirmed',
                                            'booking_cancelled', 'booking_expired', 'venue_reviewed')),
  title       text not null,
  body        text not null,
  link        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, id desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (user_id = auth.uid());
-- Không cấp insert/update/delete: thông báo chỉ do trigger tạo, đánh dấu đã đọc qua hàm bên dưới
grant select on public.notifications to authenticated;

-- 120000 -> "120.000 đ"
create or replace function public.vnd(p_amount integer)
returns text
language sql
immutable
as $$ select replace(to_char(coalesce(p_amount, 0), 'FM999,999,999,990'), ',', '.') || ' đ' $$;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text,
                                         p_booking bigint default null, p_venue bigint default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into notifications (user_id, kind, title, body, link, booking_id, venue_id)
  select p_user, p_kind, p_title, p_body, p_link, p_booking, p_venue
  where p_user is not null and coalesce(current_setting('app.skip_notifications', true), '') <> '1';
$$;
revoke execute on function public.notify(uuid, text, text, text, text, bigint, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Biến động lượt đặt
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
  -- Khung giờ đầu tiên, ví dụ "19:00 ngày 20/10"
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
      new.code || ' tại ' || v_venue.name || v_slot || ' đã được xác nhận. Hẹn gặp bạn ở sân!',
      '/bookings/' || new.id, new.id, v_venue.id);
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

drop trigger if exists bookings_notify_trg on public.bookings;
drop trigger if exists bookings_notify_new_trg on public.bookings;
-- Lượt mới: chạy lúc commit để các khung giờ (booking_items) đã được ghi, thông báo có giờ chơi
create constraint trigger bookings_notify_new_trg
  after insert on public.bookings
  deferrable initially deferred
  for each row execute function public.notify_booking_change();
create trigger bookings_notify_trg
  after update of status on public.bookings
  for each row execute function public.notify_booking_change();

-- ---------------------------------------------------------------------
-- Kết quả duyệt sân gửi chủ sân
-- ---------------------------------------------------------------------
create or replace function public.notify_venue_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'approved' and old.status = 'pending' then
    perform notify(new.owner_id, 'venue_reviewed', 'Sân đã được duyệt',
      new.name || ' đã hiển thị trên bản đồ, người chơi có thể đặt sân.', '/owner/venues/' || new.id, null, new.id);
  elsif new.status = 'rejected' then
    perform notify(new.owner_id, 'venue_reviewed', 'Sân chưa được duyệt',
      new.name || ' bị từ chối' || coalesce('. Lý do: ' || new.reject_reason, '') || '. Sửa thông tin rồi gửi lại.',
      '/owner/venues/' || new.id, null, new.id);
  elsif new.status = 'hidden' then
    perform notify(new.owner_id, 'venue_reviewed', 'Sân bị ẩn',
      new.name || ' đã bị quản trị viên ẩn' || coalesce('. Lý do: ' || new.reject_reason, '') || '.',
      '/owner/venues/' || new.id, null, new.id);
  elsif new.status = 'approved' and old.status = 'hidden' then
    perform notify(new.owner_id, 'venue_reviewed', 'Sân hiển thị trở lại',
      new.name || ' đã được quản trị viên cho hiển thị lại.', '/owner/venues/' || new.id, null, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists venues_notify_trg on public.venues;
create trigger venues_notify_trg
  after update of status on public.venues
  for each row execute function public.notify_venue_review();

-- ---------------------------------------------------------------------
-- Đánh dấu đã đọc: p_ids rỗng = tất cả. Trả về số thông báo vừa đánh dấu.
-- ---------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = 'Bạn cần đăng nhập';
  end if;
  update notifications set read_at = now()
  where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;
