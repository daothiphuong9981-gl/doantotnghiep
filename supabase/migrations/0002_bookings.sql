-- =====================================================================
-- Sprint 2: tìm kiếm, đặt sân, giữ chỗ có thời hạn, thanh toán, xác nhận
-- Chạy sau 0001_init.sql.
-- Quy ước lỗi: hàm báo lỗi bằng RAISE EXCEPTION với thông điệp là một mã
-- (SLOT_TAKEN, INVALID_INPUT, FORBIDDEN, NOT_FOUND, INVALID_STATE, UNAUTHENTICATED);
-- phần giải thích cho người dùng nằm ở DETAIL. Ứng dụng đổi mã thành mã HTTP.
-- =====================================================================

-- Mã đặt chỗ hiển thị cho người chơi, dùng làm nội dung chuyển khoản: DS1001, DS1002...
create sequence if not exists public.booking_code_seq start 1001;
alter table public.bookings alter column code set default ('DS' || nextval('public.booking_code_seq'));

-- Bỏ dấu tiếng Việt và đổi về chữ thường để tìm kiếm không phân biệt dấu
create or replace function public.vn_unaccent(p text)
returns text
language sql
immutable
as $$
  select translate(lower(coalesce(p, '')),
    'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd');
$$;

-- Giờ Việt Nam hiện tại (không kèm múi giờ)
create or replace function public.vn_now()
returns timestamp
language sql
stable
as $$ select now() at time zone 'Asia/Ho_Chi_Minh' $$;

-- ---------------------------------------------------------------------
-- Giải phóng các lượt giữ chỗ đã quá hạn: sân coi như chưa ai đặt.
-- Chạy định kỳ (pg_cron) và được gọi ngay trước khi tạo lượt đặt, khi xem danh sách.
-- ---------------------------------------------------------------------
create or replace function public.expire_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update bookings set status = 'expired'
    where status = 'holding' and hold_expires_at < now()
    returning id
  ), released as (
    update booking_items set is_active = false
    where booking_id in (select id from expired)
    returning 1
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- PB14, PB15 - Tạo một lượt đặt gồm nhiều sân con, nhiều khung giờ và giữ chỗ.
-- p_items: [{"court_id": 12, "booking_date": "2026-10-17", "start_time": "19:00"}, ...]
-- ---------------------------------------------------------------------
create or replace function public.create_booking(p_venue_id bigint, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_venue venues%rowtype;
  v_now timestamp := vn_now();
  v_raw jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_court bigint;
  v_date date;
  v_time time;
  v_price integer;
  v_total integer := 0;
  v_booking_id bigint;
  v_conflicts jsonb;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = 'Bạn cần đăng nhập để đặt sân';
  end if;
  if my_role() is distinct from 'player' then
    raise exception 'FORBIDDEN' using detail = 'Chỉ tài khoản người chơi mới đặt được sân';
  end if;

  select * into v_venue from venues where id = p_venue_id and status = 'approved';
  if not found then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy sân';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_INPUT' using detail = 'Hãy chọn ít nhất một khung giờ';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count = 0 then
    raise exception 'INVALID_INPUT' using detail = 'Hãy chọn ít nhất một khung giờ';
  end if;
  if v_count > 20 then
    raise exception 'INVALID_INPUT' using detail = 'Mỗi lượt đặt tối đa 20 khung giờ';
  end if;

  -- Sân đang bị giữ quá hạn thì trả lại trước khi kiểm tra
  perform expire_holds();

  -- Chống giữ chỗ tràn lan: mỗi người chơi tối đa 3 lượt đang giữ chỗ cùng lúc
  if (select count(*) from bookings where player_id = v_uid and status = 'holding') >= 3 then
    raise exception 'INVALID_STATE' using detail = 'Bạn đang có 3 lượt giữ chỗ chưa thanh toán. Hãy thanh toán hoặc hủy bớt trước khi đặt tiếp';
  end if;

  for v_raw in select * from jsonb_array_elements(p_items) loop
    begin
      v_court := (v_raw ->> 'court_id')::bigint;
      v_date := (v_raw ->> 'booking_date')::date;
      v_time := (v_raw ->> 'start_time')::time;
    exception when others then
      raise exception 'INVALID_INPUT' using detail = 'Dữ liệu khung giờ không hợp lệ';
    end;
    if v_court is null or v_date is null or v_time is null then
      raise exception 'INVALID_INPUT' using detail = 'Dữ liệu khung giờ không hợp lệ';
    end if;
    if exists (select 1 from jsonb_array_elements(v_rows) r
               where (r ->> 'court_id')::bigint = v_court and (r ->> 'booking_date')::date = v_date and (r ->> 'start_time')::time = v_time) then
      raise exception 'INVALID_INPUT' using detail = 'Có khung giờ bị chọn hai lần';
    end if;
    if not exists (select 1 from courts c where c.id = v_court and c.venue_id = p_venue_id and c.is_active) then
      raise exception 'INVALID_INPUT' using detail = 'Sân con không thuộc cơ sở sân này';
    end if;
    if extract(minute from v_time) <> 0 or extract(second from v_time) <> 0 then
      raise exception 'INVALID_INPUT' using detail = 'Khung giờ phải bắt đầu đúng giờ';
    end if;
    if v_time < v_venue.open_time or v_time > v_venue.close_time - interval '1 hour' then
      raise exception 'INVALID_INPUT' using detail = 'Khung giờ nằm ngoài giờ mở cửa';
    end if;
    if (v_date + v_time) <= v_now then
      raise exception 'INVALID_INPUT' using detail = 'Khung giờ đã qua';
    end if;
    if v_date > (v_now::date + 14) then
      raise exception 'INVALID_INPUT' using detail = 'Chỉ đặt được trong 14 ngày tới';
    end if;

    -- Giá theo loại ngày; không khai giá cuối tuần thì dùng giá ngày thường
    v_price := null;
    select p.price into v_price
    from price_slots p
    where p.venue_id = p_venue_id
      and p.start_time <= v_time and v_time < p.end_time
      and p.day_type in (case when extract(dow from v_date) in (0, 6) then 'weekend' else 'weekday' end, 'weekday')
    order by (p.day_type = 'weekend') desc
    limit 1;
    if v_price is null then
      raise exception 'INVALID_INPUT' using detail = 'Sân chưa khai báo giá cho khung giờ ' || to_char(v_time, 'HH24:MI');
    end if;
    v_rows := v_rows || jsonb_build_object('court_id', v_court, 'booking_date', v_date, 'start_time', v_time, 'price', v_price);
    v_total := v_total + v_price;
  end loop;

  -- Khung giờ đã có lượt đặt còn hiệu lực
  select jsonb_agg(jsonb_build_object('court_id', bi.court_id, 'court_name', c.name, 'booking_date', bi.booking_date,
                                      'start_time', to_char(bi.start_time, 'HH24:MI')) order by bi.booking_date, c.id, bi.start_time)
  into v_conflicts
  from booking_items bi
  join courts c on c.id = bi.court_id
  join jsonb_array_elements(v_rows) r
    on (r ->> 'court_id')::bigint = bi.court_id and (r ->> 'booking_date')::date = bi.booking_date and (r ->> 'start_time')::time = bi.start_time
  where bi.is_active;
  if v_conflicts is not null then
    raise exception 'SLOT_TAKEN' using detail = v_conflicts::text;
  end if;

  insert into bookings (venue_id, player_id, total_amount, status, hold_expires_at)
  values (p_venue_id, v_uid, v_total, 'holding', now() + make_interval(mins => v_venue.hold_minutes))
  returning id into v_booking_id;

  begin
    insert into booking_items (booking_id, court_id, booking_date, start_time, price)
    select v_booking_id, (r ->> 'court_id')::bigint, (r ->> 'booking_date')::date, (r ->> 'start_time')::time, (r ->> 'price')::integer
    from jsonb_array_elements(v_rows) r;
  exception when unique_violation then
    -- Hai người đặt cùng lúc: chỉ mục duy nhất chặn người đến sau
    raise exception 'SLOT_TAKEN' using detail = '[]';
  end;

  return jsonb_build_object('id', v_booking_id);
end;
$$;

-- ---------------------------------------------------------------------
-- PB18 - Người chơi báo đã chuyển khoản (chỉ khi còn hạn giữ chỗ).
-- Trả về trạng thái sau khi xử lý: awaiting_confirmation hoặc expired.
-- ---------------------------------------------------------------------
create or replace function public.report_payment(p_booking_id bigint, p_transfer_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found or v_booking.player_id is distinct from auth.uid() then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy lượt đặt';
  end if;
  if v_booking.status = 'holding' and v_booking.hold_expires_at < now() then
    update bookings set status = 'expired' where id = p_booking_id;
    update booking_items set is_active = false where booking_id = p_booking_id;
    return 'expired';
  end if;
  if v_booking.status <> 'holding' then
    raise exception 'INVALID_STATE' using detail = 'Lượt đặt không còn ở trạng thái giữ chỗ';
  end if;
  update bookings
  set status = 'awaiting_confirmation', paid_reported_at = now(), transfer_note = nullif(left(trim(coalesce(p_transfer_note, '')), 200), '')
  where id = p_booking_id;
  return 'awaiting_confirmation';
end;
$$;

-- ---------------------------------------------------------------------
-- PB16 - Chủ sân xác nhận thủ công đã nhận tiền.
-- ---------------------------------------------------------------------
create or replace function public.confirm_payment(p_booking_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy lượt đặt';
  end if;
  if not owns_venue(v_booking.venue_id) or my_role() is distinct from 'owner' then
    raise exception 'FORBIDDEN' using detail = 'Bạn không có quyền với lượt đặt này';
  end if;
  if v_booking.status <> 'awaiting_confirmation' then
    raise exception 'INVALID_STATE' using detail = 'Chỉ xác nhận được lượt đặt đang chờ xác nhận thanh toán';
  end if;
  update bookings set status = 'confirmed', confirmed_at = now() where id = p_booking_id;
  return 'confirmed';
end;
$$;

-- ---------------------------------------------------------------------
-- PB16, PB17 - Hủy lượt đặt: người chơi hủy lượt của mình khi chưa đến giờ chơi;
-- chủ sân hủy lượt của sân mình và bắt buộc nêu lý do. Khung giờ trống trở lại.
-- ---------------------------------------------------------------------
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
  if v_first is not null and v_first <= vn_now() then
    raise exception 'INVALID_STATE' using detail = 'Lượt đặt đã đến hoặc đã qua giờ chơi';
  end if;

  update bookings set status = 'cancelled', cancel_reason = v_reason, cancelled_by = v_uid where id = p_booking_id;
  update booking_items set is_active = false where booking_id = p_booking_id;
  return 'cancelled';
end;
$$;

-- ---------------------------------------------------------------------
-- PB12, PB13 - Tìm kiếm và lọc sân. Mọi tham số đều tùy chọn.
-- Có p_date + p_start_time thì chỉ trả sân còn ít nhất một sân con trống khung giờ đó
-- (khung giờ đang được giữ chỗ còn hạn không tính là trống).
-- ---------------------------------------------------------------------
create or replace function public.search_venues(
  p_q text default null,
  p_ward_id smallint default null,
  p_min_price integer default null,
  p_max_price integer default null,
  p_date date default null,
  p_start_time time default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default null
)
returns table (
  id bigint, name text, address text, ward_id smallint, ward_name text,
  latitude numeric, longitude numeric, min_price integer, court_count bigint,
  thumbnail text, distance_km double precision, free_courts bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select v.*, w.name as w_name,
           case when p_lat is not null and p_lng is not null
                then st_distance(v.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0 end as dist_km,
           case when p_date is not null and p_start_time is not null then (
             select count(*) from courts c
             where c.venue_id = v.id and c.is_active
               and not exists (
                 select 1 from booking_items bi join bookings b on b.id = bi.booking_id
                 where bi.court_id = c.id and bi.booking_date = p_date and bi.start_time = p_start_time and bi.is_active
                   and not (b.status = 'holding' and b.hold_expires_at < now())
               )
           ) end as free_cnt
    from venues v
    join wards w on w.id = v.ward_id
    where v.status = 'approved'
      and (p_ward_id is null or v.ward_id = p_ward_id)
      and (nullif(trim(coalesce(p_q, '')), '') is null
           or strpos(vn_unaccent(v.name), vn_unaccent(trim(p_q))) > 0
           or strpos(vn_unaccent(v.address), vn_unaccent(trim(p_q))) > 0)
      and ((p_min_price is null and p_max_price is null) or exists (
            select 1 from price_slots p
            where p.venue_id = v.id
              and (p_min_price is null or p.price >= p_min_price)
              and (p_max_price is null or p.price <= p_max_price)))
      and (p_start_time is null or (v.open_time <= p_start_time and p_start_time <= v.close_time - interval '1 hour'))
  )
  select b.id, b.name, b.address, b.ward_id, b.w_name, b.latitude, b.longitude,
         (select min(p.price) from price_slots p where p.venue_id = b.id),
         (select count(*) from courts c where c.venue_id = b.id and c.is_active),
         (select i.storage_path from venue_images i where i.venue_id = b.id order by i.sort_order, i.id limit 1),
         round(b.dist_km::numeric, 2)::double precision,
         b.free_cnt
  from base b
  where (b.free_cnt is null or b.free_cnt > 0)
    and (p_radius_km is null or b.dist_km is null or b.dist_km <= p_radius_km)
  order by b.dist_km nulls last, b.name;
$$;

-- Lượt đặt (kèm dòng chi tiết) mà người gọi được xem: dùng chung cho người chơi và chủ sân
create or replace view public.booking_details
with (security_invoker = true) as
  select b.id, b.code, b.venue_id, v.name as venue_name, v.address as venue_address, b.player_id,
         b.total_amount, b.status, b.hold_expires_at, b.paid_reported_at, b.transfer_note,
         b.confirmed_at, b.cancel_reason, b.cancelled_by, b.created_at,
         (select min(bi.booking_date) from public.booking_items bi where bi.booking_id = b.id) as first_date,
         -- Đã qua giờ chơi của khung giờ cuối cùng
         coalesce((select max(bi.booking_date + bi.start_time) + interval '1 hour' <= public.vn_now()
                   from public.booking_items bi where bi.booking_id = b.id), false) as is_past,
         -- Còn hủy được: chưa kết thúc và chưa đến giờ chơi đầu tiên
         (b.status in ('holding', 'awaiting_confirmation', 'confirmed')
          and coalesce((select min(bi.booking_date + bi.start_time) > public.vn_now()
                        from public.booking_items bi where bi.booking_id = b.id), true)) as can_cancel,
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'court_id', bi.court_id, 'court_name', c.name, 'booking_date', bi.booking_date,
                   'start_time', to_char(bi.start_time, 'HH24:MI'), 'price', bi.price)
                 order by bi.booking_date, c.id, bi.start_time), '[]'::jsonb)
          from public.booking_items bi join public.courts c on c.id = bi.court_id
          where bi.booking_id = b.id) as items
  from public.bookings b
  join public.venues v on v.id = b.venue_id;

-- Lượt đặt có tồn tại không (không trả nội dung). Ứng dụng dùng để phân biệt lỗi 403 (của người khác) với 404.
create or replace function public.booking_exists(p_booking_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select auth.uid() is not null and exists (select 1 from bookings where id = p_booking_id) $$;

-- Quyền gọi hàm: mọi kiểm tra vai trò nằm trong thân hàm
revoke execute on function public.create_booking(bigint, jsonb), public.report_payment(bigint, text),
  public.confirm_payment(bigint), public.cancel_booking(bigint, text) from public, anon;
grant execute on function public.create_booking(bigint, jsonb), public.report_payment(bigint, text),
  public.confirm_payment(bigint), public.cancel_booking(bigint, text) to authenticated;
revoke execute on function public.booking_exists(bigint) from public, anon;
grant execute on function public.booking_exists(bigint) to authenticated;
grant execute on function public.expire_holds(), public.vn_now(), public.vn_unaccent(text) to anon, authenticated, service_role;
grant execute on function public.search_venues(text, smallint, integer, integer, date, time, double precision, double precision, double precision) to anon, authenticated;
grant select on public.booking_details to authenticated;
