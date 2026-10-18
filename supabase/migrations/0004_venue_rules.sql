-- =====================================================================
-- Quy định đặt sân do từng chủ sân tự thiết lập (thay cho các giá trị cố định ở 0002).
-- Chạy sau 0002_bookings.sql.
-- =====================================================================
alter table public.venues
  add column if not exists max_slots_per_booking smallint not null default 20
    check (max_slots_per_booking between 1 and 50),
  add column if not exists advance_days smallint not null default 7
    check (advance_days between 1 and 30),
  add column if not exists max_active_holds smallint not null default 2
    check (max_active_holds between 1 and 10);

comment on column public.venues.max_slots_per_booking is 'Số khung giờ tối đa trong một lượt đặt (1-50, mặc định 20)';
comment on column public.venues.advance_days is 'Số ngày được đặt trước tính từ hôm nay (1-30, mặc định 7)';
comment on column public.venues.max_active_holds is 'Số lượt đang giữ chỗ cùng lúc của một người chơi tại sân này (1-10, mặc định 2)';

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
  v_holding integer;
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
  if v_count > v_venue.max_slots_per_booking then
    raise exception 'INVALID_INPUT' using detail = format('Sân này cho đặt tối đa %s khung giờ trong một lượt', v_venue.max_slots_per_booking);
  end if;

  -- Sân đang bị giữ quá hạn thì trả lại trước khi kiểm tra
  perform expire_holds();

  -- Chống giữ chỗ tràn lan: giới hạn số lượt đang giữ chỗ cùng lúc của một người chơi tại sân này
  select count(*) into v_holding from bookings where player_id = v_uid and venue_id = p_venue_id and status = 'holding';
  if v_holding >= v_venue.max_active_holds then
    raise exception 'INVALID_STATE' using detail = format('Bạn đang có %s lượt giữ chỗ chưa thanh toán tại sân này. Hãy thanh toán hoặc hủy bớt trước khi đặt tiếp', v_holding);
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
    if v_date > (v_now::date + v_venue.advance_days) then
      raise exception 'INVALID_INPUT' using detail = format('Sân này chỉ nhận đặt trước tối đa %s ngày', v_venue.advance_days);
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
      -- Lọc giá: có ngày + giờ thì xét đúng giá áp dụng cho khung giờ đó (ưu tiên giá cuối tuần, không có thì giá ngày thường);
      -- chỉ có ngày thì xét bảng giá của loại ngày đó; không có ngày thì xét mọi khung giá.
      and ((p_min_price is null and p_max_price is null) or (
        case when p_date is not null and p_start_time is not null then (
          select (p_min_price is null or x.price >= p_min_price) and (p_max_price is null or x.price <= p_max_price)
          from (
            select p.price from price_slots p
            where p.venue_id = v.id and p.start_time <= p_start_time and p_start_time < p.end_time
              and p.day_type in (case when extract(dow from p_date) in (0, 6) then 'weekend' else 'weekday' end, 'weekday')
            order by (p.day_type = 'weekend') desc limit 1
          ) x)
        else exists (
          select 1 from price_slots p
          where p.venue_id = v.id
            and (p_min_price is null or p.price >= p_min_price)
            and (p_max_price is null or p.price <= p_max_price)
            and (p_date is null or p.day_type = case
                  when extract(dow from p_date) in (0, 6) and exists (select 1 from price_slots w where w.venue_id = v.id and w.day_type = 'weekend')
                  then 'weekend' else 'weekday' end))
        end))
      and (p_start_time is null or (v.open_time <= p_start_time and p_start_time <= v.close_time - interval '1 hour'))
      -- Ngày cần tìm phải nằm trong số ngày sân cho đặt trước
      and (p_date is null or p_date <= vn_now()::date + v.advance_days)
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

