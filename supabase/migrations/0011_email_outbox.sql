-- =====================================================================
-- Email xác nhận đặt sân (hàng đợi gửi thư). Chạy sau 0010_payment_qr.sql.
--
-- Khi chủ sân xác nhận đã nhận tiền (bookings.status chuyển sang confirmed), trigger ghi MỘT dòng vào
-- email_outbox trong cùng giao dịch: không bao giờ mất thư dù máy chủ gửi mail lỗi, không gửi trùng.
-- Ứng dụng (máy chủ Next.js, khóa service_role) nhận việc bằng claim_email_outbox(), gửi qua Gmail SMTP,
-- rồi ghi kết quả. Thư lỗi được gửi lại tối đa 5 lần.
-- Thư gửi từ một hộp Gmail hệ thống, tên hiển thị là tên sân; trả lời thư sẽ tới email của chủ sân (reply_to).
-- Nội dung thư được chụp lại lúc xác nhận (payload) để thư đúng với thông tin tại thời điểm đó.
-- =====================================================================

create table if not exists public.email_outbox (
  id          bigint generated always as identity primary key,
  booking_id  bigint not null references public.bookings (id) on delete cascade,
  kind        text not null check (kind in ('booking_confirmed')),
  to_email    text not null,
  reply_to    text,
  payload     jsonb not null,
  status      text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts    smallint not null default 0,
  last_error  text,
  locked_at   timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (booking_id, kind)
);
create index if not exists email_outbox_pending_idx on public.email_outbox (id) where status <> 'sent';

-- Chỉ máy chủ (service_role) đọc, ghi. Bật RLS, không tạo chính sách nào: anon/authenticated không thấy gì.
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant all on public.email_outbox to service_role;

-- Ghi thư vào hàng đợi khi lượt đặt được xác nhận
create or replace function public.queue_booking_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_to text;
  v_reply text;
  v_venue record;
  v_player_name text;
  v_items jsonb;
begin
  if new.status <> 'confirmed' or old.status is not distinct from 'confirmed' then
    return new;
  end if;
  -- Dữ liệu demo (0005/demo_data.sql) đặt cờ này để không sinh thông báo, thư cho tài khoản ảo
  if coalesce(current_setting('app.skip_notifications', true), '') = '1' then
    return new;
  end if;

  select u.email into v_to from auth.users u where u.id = new.player_id;
  if v_to is null or v_to = '' then
    return new; -- tài khoản đã xóa hoặc không có email
  end if;

  select v.id, v.name, v.address, v.contact_phone, v.owner_id into v_venue from venues v where v.id = new.venue_id;
  select u.email into v_reply from auth.users u where u.id = v_venue.owner_id;
  select p.full_name into v_player_name from profiles p where p.id = new.player_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'court_name', c.name,
           'booking_date', to_char(bi.booking_date, 'YYYY-MM-DD'),
           'start_time', to_char(bi.start_time, 'HH24:MI'),
           'price', bi.price)
         order by bi.booking_date, bi.start_time, c.id), '[]'::jsonb)
    into v_items
  from booking_items bi join courts c on c.id = bi.court_id
  where bi.booking_id = new.id;

  insert into email_outbox (booking_id, kind, to_email, reply_to, payload)
  values (new.id, 'booking_confirmed', v_to, v_reply, jsonb_build_object(
    'booking_id', new.id,
    'code', new.code,
    'player_name', coalesce(v_player_name, ''),
    'venue_name', v_venue.name,
    'venue_address', v_venue.address,
    'venue_phone', v_venue.contact_phone,
    'total_amount', new.total_amount,
    'confirmed_at', coalesce(new.confirmed_at, now()),
    'items', v_items))
  on conflict (booking_id, kind) do nothing;
  return new;
end;
$$;
revoke execute on function public.queue_booking_email() from public, anon, authenticated;

drop trigger if exists bookings_email_trg on public.bookings;
create trigger bookings_email_trg
  after update of status on public.bookings
  for each row execute function public.queue_booking_email();

-- Nhận tối đa p_limit thư cần gửi (chưa gửi, gửi lỗi dưới 5 lần, hoặc đang gửi nhưng bị treo quá 10 phút).
-- Chỉ gửi thư tạo trong 2 ngày gần nhất: bật cấu hình email muộn thì không dồn gửi thư xác nhận cũ.
-- for update skip locked: hai tiến trình chạy cùng lúc không nhận trùng một thư.
-- Dọn luôn thư đã gửi quá 30 ngày (không giữ email người dùng lâu hơn cần thiết).
create or replace function public.claim_email_outbox(p_limit integer default 10)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from email_outbox where status = 'sent' and sent_at < now() - interval '30 days';
  return query
  update email_outbox o
  set status = 'sending', attempts = o.attempts + 1, locked_at = now()
  where o.id in (
    select e.id from email_outbox e
    where e.created_at > now() - interval '2 days'
      and (e.status = 'pending'
           or (e.status = 'failed' and e.attempts < 5)
           or (e.status = 'sending' and e.locked_at < now() - interval '10 minutes' and e.attempts < 5))
    order by e.id
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update skip locked)
  returning o.*;
end;
$$;

-- Ghi kết quả gửi
create or replace function public.finish_email_outbox(p_id bigint, p_ok boolean, p_error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update email_outbox
  set status = case when p_ok then 'sent' else 'failed' end,
      sent_at = case when p_ok then now() else sent_at end,
      last_error = case when p_ok then null else left(p_error, 500) end,
      locked_at = null
  where id = p_id and status = 'sending';
$$;

revoke execute on function public.claim_email_outbox(integer), public.finish_email_outbox(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer), public.finish_email_outbox(bigint, boolean, text) to service_role;
