-- =====================================================================
-- Đánh giá, bình luận sân của người đã thuê. Chạy sau 0011_email_outbox.sql.
--
-- Quy tắc (chủ dự án duyệt 30/10/2026):
--   - Mỗi LƯỢT ĐẶT được một đánh giá (1-5 sao, bình luận tùy chọn), sửa được.
--   - Chỉ lượt đã được chủ sân xác nhận (confirmed) và ĐÃ CHƠI XONG mới đánh giá được, trong vòng 24 GIỜ sau khi
--     kết thúc khung giờ cuối cùng. Hết 24 giờ thì không tạo mới và không sửa được nữa.
--   - Người đánh giá chọn hiện hoặc ẩn tên. Ẩn tên: trang sân hiện "Người chơi ẩn danh"; chủ sân cũng không thấy tên.
--   - Chủ sân trả lời đánh giá; quản trị viên ẩn hoặc hiện lại đánh giá vi phạm (bắt buộc lý do khi ẩn).
--   - Điểm trung bình chỉ tính các đánh giá đang hiện.
-- Bảng không cấp quyền đọc, ghi trực tiếp cho ai: mọi thao tác qua hàm security definer bên dưới, nhờ vậy không lộ
-- người đánh giá ẩn danh qua API.
-- =====================================================================

create table if not exists public.venue_reviews (
  id                bigint generated always as identity primary key,
  venue_id          bigint not null references public.venues (id) on delete cascade,
  booking_id        bigint not null unique references public.bookings (id) on delete cascade,
  player_id         uuid references public.profiles (id) on delete set null,
  rating            smallint not null check (rating between 1 and 5),
  comment           text check (comment is null or char_length(comment) <= 1000),
  is_anonymous      boolean not null default false,
  owner_reply       text check (owner_reply is null or char_length(owner_reply) <= 1000),
  owner_replied_at  timestamptz,
  status            text not null default 'visible' check (status in ('visible', 'hidden')),
  hidden_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists venue_reviews_venue_idx on public.venue_reviews (venue_id, created_at desc) where status = 'visible';

alter table public.venue_reviews enable row level security;
revoke all on public.venue_reviews from anon, authenticated;
grant all on public.venue_reviews to service_role;

-- Thông báo mới cho đánh giá
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'booking_new', 'payment_reported', 'booking_confirmed', 'booking_cancelled', 'booking_expired', 'venue_reviewed',
  'review_new', 'review_replied', 'review_hidden'));

-- Thời điểm kết thúc khung giờ cuối cùng của một lượt đặt (giờ Việt Nam, như vn_now())
create or replace function public.booking_end_at(p_booking_id bigint)
returns timestamp
language sql
stable
security definer
set search_path = public
as $$
  select max(booking_date + start_time) + interval '1 hour' from booking_items where booking_id = p_booking_id;
$$;
revoke execute on function public.booking_end_at(bigint) from public, anon, authenticated;

-- Tên hiển thị của người đánh giá cho người ngoài
create or replace function public.review_author(p_anonymous boolean, p_full_name text)
returns text
language sql
immutable
as $$
  select case when p_anonymous then 'Người chơi ẩn danh' else coalesce(nullif(trim(p_full_name), ''), 'Người chơi') end;
$$;

-- ---------------------------------------------------------------------
-- Người chơi: trạng thái đánh giá của một lượt đặt (để giao diện biết có hiện form không)
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
  v_end timestamp;
  v_review venue_reviews%rowtype;
  v_open boolean;
begin
  select * into v_booking from bookings where id = p_booking_id;
  if not found or v_booking.player_id is distinct from auth.uid() or my_role() is distinct from 'player' then
    return null;
  end if;
  v_end := booking_end_at(p_booking_id);
  v_open := v_booking.status = 'confirmed' and v_end is not null and vn_now() >= v_end and vn_now() < v_end + interval '24 hours';
  select * into v_review from venue_reviews where booking_id = p_booking_id;
  return jsonb_build_object(
    'can_edit', v_open,
    -- vn_now()/booking_end_at là giờ Việt Nam không kèm múi giờ: đổi sang timestamptz để trình duyệt hiểu đúng
    'window_starts_at', v_end at time zone 'Asia/Ho_Chi_Minh',
    'deadline', (v_end + interval '24 hours') at time zone 'Asia/Ho_Chi_Minh',
    'review', case when v_review.id is null then null else jsonb_build_object(
      'id', v_review.id, 'rating', v_review.rating, 'comment', v_review.comment, 'is_anonymous', v_review.is_anonymous,
      'status', v_review.status, 'hidden_reason', v_review.hidden_reason, 'owner_reply', v_review.owner_reply,
      'owner_replied_at', v_review.owner_replied_at, 'created_at', v_review.created_at, 'updated_at', v_review.updated_at) end);
end;
$$;

-- Người chơi: tạo hoặc sửa đánh giá cho một lượt đặt của mình
create or replace function public.submit_review(p_booking_id bigint, p_rating integer, p_comment text default null,
                                                p_anonymous boolean default false)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_end timestamp;
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
  v_end := booking_end_at(p_booking_id);
  if v_end is null or vn_now() < v_end then
    raise exception 'INVALID_STATE' using detail = 'Bạn đánh giá được sau khi chơi xong';
  end if;
  if vn_now() >= v_end + interval '24 hours' then
    raise exception 'INVALID_STATE' using detail = 'Đã quá 24 giờ sau giờ chơi, không thể đánh giá hoặc sửa đánh giá';
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
-- Công khai: danh sách đánh giá đang hiện của một sân đã duyệt, và điểm trung bình
-- ---------------------------------------------------------------------
create or replace function public.list_venue_reviews(p_venue_id bigint, p_limit integer default 20, p_offset integer default 0)
returns table (id bigint, rating smallint, comment text, author text, created_at timestamptz, updated_at timestamptz,
               owner_reply text, owner_replied_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.rating, r.comment, review_author(r.is_anonymous, p.full_name), r.created_at, r.updated_at,
         r.owner_reply, r.owner_replied_at
  from venue_reviews r
  join venues v on v.id = r.venue_id and v.status = 'approved'
  left join profiles p on p.id = r.player_id
  where r.venue_id = p_venue_id and r.status = 'visible'
  order by r.created_at desc, r.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 50)) offset greatest(0, coalesce(p_offset, 0));
$$;

-- Điểm trung bình và số đánh giá đang hiện. p_venue_ids null = mọi sân đã duyệt (danh sách trang chủ, khoảng 50 sân)
create or replace function public.venue_rating_summary(p_venue_ids bigint[] default null)
returns table (venue_id bigint, rating_avg numeric, rating_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.venue_id, round(avg(r.rating)::numeric, 1), count(*)::integer
  from venue_reviews r
  join venues v on v.id = r.venue_id and v.status = 'approved'
  where r.status = 'visible' and (p_venue_ids is null or r.venue_id = any (p_venue_ids))
  group by r.venue_id;
$$;

-- ---------------------------------------------------------------------
-- Chủ sân: xem đánh giá các sân của mình (ẩn danh vẫn ẩn tên) và trả lời
-- ---------------------------------------------------------------------
create or replace function public.owner_list_reviews(p_venue_id bigint default null)
returns table (id bigint, venue_id bigint, venue_name text, booking_code text, rating smallint, comment text, author text,
               status text, hidden_reason text, owner_reply text, owner_replied_at timestamptz,
               created_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.venue_id, v.name, case when r.is_anonymous then null else b.code end,
         r.rating, r.comment, review_author(r.is_anonymous, p.full_name),
         r.status, r.hidden_reason, r.owner_reply, r.owner_replied_at, r.created_at, r.updated_at
  from venue_reviews r
  join venues v on v.id = r.venue_id
  join bookings b on b.id = r.booking_id
  left join profiles p on p.id = r.player_id
  where v.owner_id = auth.uid() and my_role() = 'owner' and (p_venue_id is null or r.venue_id = p_venue_id)
  order by r.created_at desc, r.id desc
  limit 300;
$$;

create or replace function public.reply_review(p_review_id bigint, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review venue_reviews%rowtype;
  v_reply text := nullif(trim(coalesce(p_reply, '')), '');
  v_venue_name text;
begin
  select * into v_review from venue_reviews where id = p_review_id;
  if not found or not owns_venue(v_review.venue_id) or my_role() is distinct from 'owner' then
    raise exception 'FORBIDDEN' using detail = 'Bạn không có quyền với đánh giá này';
  end if;
  if v_reply is not null and char_length(v_reply) > 1000 then
    raise exception 'INVALID_INPUT' using detail = 'Câu trả lời tối đa 1000 ký tự';
  end if;
  update venue_reviews set owner_reply = v_reply, owner_replied_at = case when v_reply is null then null else now() end
  where id = p_review_id;
  if v_reply is not null and v_review.owner_reply is null then
    select name into v_venue_name from venues where id = v_review.venue_id;
    perform notify(v_review.player_id, 'review_replied', 'Chủ sân đã trả lời đánh giá của bạn',
      v_venue_name || ': "' || left(v_reply, 100) || case when char_length(v_reply) > 100 then '..."' else '"' end,
      '/venues/' || v_review.venue_id, v_review.booking_id, v_review.venue_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Quản trị viên: xem mọi đánh giá (kể cả tên người viết ẩn danh) và ẩn, hiện lại
-- ---------------------------------------------------------------------
create or replace function public.admin_list_reviews(p_status text default null)
returns table (id bigint, venue_id bigint, venue_name text, booking_code text, rating smallint, comment text,
               author text, is_anonymous boolean, status text, hidden_reason text, owner_reply text,
               created_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if my_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho quản trị viên';
  end if;
  return query
  select r.id, r.venue_id, v.name, b.code, r.rating, r.comment, coalesce(p.full_name, 'Tài khoản đã xóa'), r.is_anonymous,
         r.status, r.hidden_reason, r.owner_reply, r.created_at, r.updated_at
  from venue_reviews r
  join venues v on v.id = r.venue_id
  join bookings b on b.id = r.booking_id
  left join profiles p on p.id = r.player_id
  where p_status is null or r.status = p_status
  order by r.created_at desc, r.id desc
  limit 500;
end;
$$;

create or replace function public.admin_set_review_status(p_review_id bigint, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review venue_reviews%rowtype;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
  v_venue_name text;
begin
  if my_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho quản trị viên';
  end if;
  if p_status not in ('visible', 'hidden') then
    raise exception 'INVALID_INPUT' using detail = 'Trạng thái không hợp lệ';
  end if;
  if p_status = 'hidden' and v_reason is null then
    raise exception 'INVALID_INPUT' using detail = 'Hãy nhập lý do ẩn đánh giá';
  end if;
  select * into v_review from venue_reviews where id = p_review_id for update;
  if not found then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy đánh giá';
  end if;
  update venue_reviews set status = p_status, hidden_reason = case when p_status = 'hidden' then v_reason else null end
  where id = p_review_id;
  if p_status = 'hidden' and v_review.status <> 'hidden' then
    select name into v_venue_name from venues where id = v_review.venue_id;
    perform notify(v_review.player_id, 'review_hidden', 'Đánh giá của bạn đã bị ẩn',
      'Đánh giá tại ' || v_venue_name || ' đã bị quản trị viên ẩn. Lý do: ' || v_reason || '.',
      '/bookings/' || v_review.booking_id, v_review.booking_id, v_review.venue_id);
  end if;
end;
$$;

-- Quyền gọi hàm
revoke execute on function public.my_booking_review(bigint), public.submit_review(bigint, integer, text, boolean),
  public.owner_list_reviews(bigint), public.reply_review(bigint, text), public.admin_list_reviews(text),
  public.admin_set_review_status(bigint, text, text) from public, anon;
grant execute on function public.my_booking_review(bigint), public.submit_review(bigint, integer, text, boolean),
  public.owner_list_reviews(bigint), public.reply_review(bigint, text), public.admin_list_reviews(text),
  public.admin_set_review_status(bigint, text, text) to authenticated;
revoke execute on function public.list_venue_reviews(bigint, integer, integer), public.venue_rating_summary(bigint[]) from public;
grant execute on function public.list_venue_reviews(bigint, integer, integer), public.venue_rating_summary(bigint[]) to anon, authenticated;
