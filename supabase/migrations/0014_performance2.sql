-- =====================================================================
-- Hiệu năng truy vấn (đợt 2). Chạy sau 0013_review_reminders.sql. Chạy lại được nhiều lần.
-- Căn cứ đo đạc: _work/hieunang/03_CSDL.md (PGlite, dữ liệu demo ×1 và ×10 ~ 22.000 lượt đặt).
-- Mọi thay đổi MINH BẠCH với ứng dụng: cùng chữ ký, cùng kết quả; search_venues chỉ THÊM 2 cột cuối.
--
-- 1. booking_items_select: chính sách "booking_id in (select id from bookings)" bắt Postgres quét TOÀN BỘ bảng
--    bookings (kèm RLS của bookings) cho MỖI truy vấn con trên booking_items. View booking_details có 4 truy vấn con
--    như vậy -> 4 lần quét toàn bảng mỗi lần đọc lịch sử đặt sân, kể cả khi chỉ đọc 1 lượt. Đổi sang EXISTS theo
--    khóa chính (mỗi dòng chi tiết tra 1 lần trên bookings_pkey). Ý nghĩa giữ nguyên: thấy dòng chi tiết khi thấy
--    lượt đặt cha, RLS của bookings vẫn áp dụng. (View booking_details giữ nguyên: viết lại bằng LATERAL chậm hơn khi
--    sắp xếp + LIMIT trên nhiều dòng.)
-- 2. Bảng venue_rating_stats (tổng sao, số đánh giá đang hiện theo sân) cập nhật bằng trigger, thay cho việc quét mọi
--    đánh giá mỗi lần mở trang chủ. venue_rating_summary đọc bảng này (cùng chữ ký, cùng kết quả).
-- 3. search_venues: giá thấp nhất, số sân con, ảnh đại diện, số sân trống tính MỘT LẦN cho mọi sân (gom nhóm) thay vì
--    truy vấn con cho từng sân (số sân trống trước đây bị tính 3 lần mỗi sân); lọc bán kính dùng st_dwithin (index
--    GiST). Trả thêm rating_avg, rating_count ở CUỐI (ứng dụng cũ bỏ qua cột thừa). Đổi kiểu trả về nên DROP rồi CREATE.
-- 4. owner_stats: by_day gom nhóm một lần thay vì 3 truy vấn con cho mỗi ngày (366 ngày -> 1.098 lần quét).
-- 5. admin_stats: bookings_by_month gom nhóm một lần (1 lần quét bookings thay vì 12).
-- Chưa đưa vào đợt này (cần sửa ứng dụng): RPC venue_page, owner_booking_list.
-- Không thêm index: (bookings.created_at) làm planner chọn sai cho lịch sử người chơi; (venue_id, created_at) không
-- được dùng.
-- =====================================================================

-- 1. RLS booking_items ---------------------------------------------------
drop policy if exists booking_items_select on public.booking_items;
create policy booking_items_select on public.booking_items for select
  using (exists (select 1 from public.bookings b where b.id = booking_items.booking_id));

-- 2. Tóm tắt đánh giá theo sân -------------------------------------------
-- Chỉ tính đánh giá đang hiện (status = 'visible'). anon/authenticated không đọc trực tiếp: đọc qua hàm security definer.
create table if not exists public.venue_rating_stats (
  venue_id      bigint primary key references public.venues (id) on delete cascade,
  rating_sum    bigint  not null default 0,
  rating_count  integer not null default 0
);
alter table public.venue_rating_stats enable row level security;
revoke all on public.venue_rating_stats from public, anon, authenticated;
grant all on public.venue_rating_stats to service_role;

-- Cộng/trừ một đánh giá (upsert cộng dồn, khóa theo dòng sân nên an toàn khi ghi đồng thời).
-- Bỏ qua sân không còn tồn tại (xóa sân kéo theo xóa đánh giá; dòng tóm tắt đã bị xóa theo).
create or replace function public.venue_rating_stats_apply(p_venue_id bigint, p_rating integer, p_sign integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into venue_rating_stats as s (venue_id, rating_sum, rating_count)
  select p_venue_id, p_sign * p_rating, p_sign
  where exists (select 1 from venues v where v.id = p_venue_id)
  on conflict (venue_id) do update
    set rating_sum = s.rating_sum + excluded.rating_sum, rating_count = s.rating_count + excluded.rating_count;
$$;
revoke execute on function public.venue_rating_stats_apply(bigint, integer, integer) from public, anon, authenticated;

create or replace function public.venue_reviews_stats_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'visible' then
    perform venue_rating_stats_apply(old.venue_id, old.rating, -1);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'visible' then
    perform venue_rating_stats_apply(new.venue_id, new.rating, 1);
  end if;
  return null;
end;
$$;
revoke execute on function public.venue_reviews_stats_trg() from public, anon, authenticated;

-- Chỉ chạy khi đổi số sao, trạng thái hoặc sân (sửa bình luận, trả lời của chủ sân không chạy)
drop trigger if exists venue_reviews_stats on public.venue_reviews;
create trigger venue_reviews_stats
  after insert or delete or update of rating, status, venue_id on public.venue_reviews
  for each row execute function public.venue_reviews_stats_trg();

-- Tính lại toàn bộ từ venue_reviews (nạp lần đầu; sửa lệch nếu trigger từng bị tắt, ví dụ khi nạp dữ liệu với
-- session_replication_role = replica). Chỉ service_role / SQL Editor gọi được.
create or replace function public.refresh_venue_rating_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Chặn ghi đánh giá trong lúc tính lại để không lệch (khóa nhả khi transaction kết thúc)
  lock table venue_reviews in share row exclusive mode;
  delete from venue_rating_stats;
  insert into venue_rating_stats (venue_id, rating_sum, rating_count)
  select venue_id, sum(rating), count(*) from venue_reviews where status = 'visible' group by venue_id;
end;
$$;
revoke execute on function public.refresh_venue_rating_stats() from public, anon, authenticated;
grant execute on function public.refresh_venue_rating_stats() to service_role;

-- Dữ liệu hiện có (trigger đã tạo ở trên, nên đánh giá ghi sau thời điểm này được cộng đúng)
select public.refresh_venue_rating_stats();

-- Cùng chữ ký, cùng kết quả: chỉ sân đã duyệt có ít nhất 1 đánh giá đang hiện. Giữ quyền đã cấp ở 0012.
create or replace function public.venue_rating_summary(p_venue_ids bigint[] default null)
returns table (venue_id bigint, rating_avg numeric, rating_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.venue_id, round(s.rating_sum::numeric / s.rating_count, 1), s.rating_count
  from venue_rating_stats s
  join venues v on v.id = s.venue_id and v.status = 'approved'
  where s.rating_count > 0 and (p_venue_ids is null or s.venue_id = any (p_venue_ids));
$$;

-- 3. search_venues -------------------------------------------------------
-- Quy tắc lọc giữ nguyên 0004 (giá theo khung giờ/loại ngày, giờ mở cửa, số ngày đặt trước, sân trống).
drop function if exists public.search_venues(text, smallint, integer, integer, date, time, double precision, double precision, double precision);
create function public.search_venues(
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
  thumbnail text, distance_km double precision, free_courts bigint,
  rating_avg numeric, rating_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with base as materialized (
    select v.id, v.name, v.address, v.ward_id, w.name as w_name, v.latitude, v.longitude,
           case when p_lat is not null and p_lng is not null
                then st_distance(v.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0 end as dist_km
    from venues v
    join wards w on w.id = v.ward_id
    where v.status = 'approved'
      and (p_ward_id is null or v.ward_id = p_ward_id)
      and (nullif(trim(coalesce(p_q, '')), '') is null
           or strpos(vn_unaccent(v.name), vn_unaccent(trim(p_q))) > 0
           or strpos(vn_unaccent(v.address), vn_unaccent(trim(p_q))) > 0)
      -- Lọc giá: có ngày + giờ thì xét đúng giá áp dụng cho khung giờ đó (ưu tiên giá cuối tuần, không có thì giá ngày
      -- thường); chỉ có ngày thì xét bảng giá của loại ngày đó; không có ngày thì xét mọi khung giá.
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
      -- Lọc sớm theo bán kính bằng index GiST (cùng ngưỡng với điều kiện dist_km ở cuối)
      and (p_radius_km is null or p_lat is null or p_lng is null
           or st_dwithin(v.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000.0))
  ),
  -- Số sân con còn trống đúng khung giờ (chỉ tính khi có ngày + giờ; giữ chỗ còn hạn không tính là trống)
  free as (
    select c.venue_id, count(*) as free_cnt
    from courts c
    where p_date is not null and p_start_time is not null
      and c.is_active and c.venue_id in (select id from base)
      and not exists (
        select 1 from booking_items bi join bookings b on b.id = bi.booking_id
        where bi.court_id = c.id and bi.booking_date = p_date and bi.start_time = p_start_time and bi.is_active
          and not (b.status = 'holding' and b.hold_expires_at < now()))
    group by c.venue_id
  ),
  prices as (select p.venue_id, min(p.price) as min_price from price_slots p where p.venue_id in (select id from base) group by p.venue_id),
  court_counts as (select c.venue_id, count(*) as court_count from courts c where c.is_active and c.venue_id in (select id from base) group by c.venue_id),
  thumbs as (
    select distinct on (i.venue_id) i.venue_id, i.storage_path
    from venue_images i where i.venue_id in (select id from base)
    order by i.venue_id, i.sort_order, i.id
  ),
  ratings as (
    select s.venue_id, round(s.rating_sum::numeric / s.rating_count, 1) as rating_avg, s.rating_count
    from venue_rating_stats s
    where s.rating_count > 0
  )
  select b.id, b.name, b.address, b.ward_id, b.w_name, b.latitude, b.longitude,
         pr.min_price, coalesce(cc.court_count, 0), t.storage_path,
         round(b.dist_km::numeric, 2)::double precision,
         case when p_date is not null and p_start_time is not null then coalesce(f.free_cnt, 0) end,
         r.rating_avg, coalesce(r.rating_count, 0)
  from base b
  left join free f on f.venue_id = b.id
  left join prices pr on pr.venue_id = b.id
  left join court_counts cc on cc.venue_id = b.id
  left join thumbs t on t.venue_id = b.id
  left join ratings r on r.venue_id = b.id
  where (p_date is null or p_start_time is null or coalesce(f.free_cnt, 0) > 0)
    and (p_radius_km is null or b.dist_km is null or b.dist_km <= p_radius_km)
  order by b.dist_km nulls last, b.name;
$$;
-- DROP làm mất quyền cũ: cấp lại như 0002 (khách chưa đăng nhập vẫn tìm được sân)
revoke execute on function public.search_venues(text, smallint, integer, integer, date, time, double precision, double precision, double precision) from public;
grant execute on function public.search_venues(text, smallint, integer, integer, date, time, double precision, double precision, double precision) to anon, authenticated, service_role;

-- 4. owner_stats ---------------------------------------------------------
-- Cùng chữ ký, cùng JSON, cùng lỗi phân quyền như 0005. Giữ quyền đã cấp ở 0005.
create or replace function public.owner_stats(p_venue_id bigint, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = 'Bạn cần đăng nhập';
  end if;
  if my_role() is distinct from 'owner' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho chủ sân';
  end if;
  if p_venue_id is not null and not owns_venue(p_venue_id) then
    raise exception 'FORBIDDEN' using detail = 'Đây không phải sân của bạn';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'INVALID_INPUT' using detail = 'Khoảng thời gian không hợp lệ (tối đa 366 ngày)';
  end if;

  with scope as (
    select v.id from venues v where v.owner_id = v_uid and (p_venue_id is null or v.id = p_venue_id)
  ), items as (
    select b.id as booking_id, b.status, bi.booking_date, bi.start_time, bi.price
    from bookings b
    join booking_items bi on bi.booking_id = b.id
    where b.venue_id in (select id from scope) and bi.booking_date between p_from and p_to
  ), ok_items as (
    select * from items where status = 'confirmed'
  ), per_day as (
    -- Gom nhóm một lần cho mọi ngày (trước đây 3 truy vấn con cho mỗi ngày)
    select booking_date, count(distinct booking_id) as cnt, count(*) as slots, sum(price) as revenue
    from ok_items group by booking_date
  ), days as (
    select d::date as day from generate_series(p_from, p_to, interval '1 day') d
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'confirmed_count', (select count(distinct booking_id) from ok_items),
    'slot_count', (select count(*) from ok_items),
    'revenue', (select coalesce(sum(price), 0) from ok_items),
    'awaiting_count', (select count(distinct booking_id) from items where status = 'awaiting_confirmation'),
    'cancelled_count', (select count(distinct booking_id) from items where status = 'cancelled'),
    'expired_count', (select count(distinct booking_id) from items where status = 'expired'),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object(
                  'date', d.day,
                  'count', coalesce(a.cnt, 0),
                  'slots', coalesce(a.slots, 0),
                  'revenue', coalesce(a.revenue, 0)
                ) order by d.day), '[]'::jsonb)
               from days d left join per_day a on a.booking_date = d.day),
    'top_slots', (select coalesce(jsonb_agg(t order by t.count desc, t.start_time), '[]'::jsonb)
                  from (select to_char(start_time, 'HH24:MI') as start_time, count(*)::int as count
                        from ok_items group by start_time order by count(*) desc, start_time limit 5) t)
  ) into v_result;
  return v_result;
end;
$$;

-- 5. admin_stats ---------------------------------------------------------
-- Cùng chữ ký, cùng JSON như 0005. Giữ quyền đã cấp ở 0005.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_first timestamp := date_trunc('month', vn_now()) - interval '5 months';
begin
  if my_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho quản trị viên';
  end if;
  return jsonb_build_object(
    'users', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select role, count(*)::int n from profiles group by role) t),
    'locked_users', (select count(*)::int from profiles where is_locked),
    'venues', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*)::int n from venues group by status) t),
    'bookings', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*)::int n from bookings group by status) t),
    -- 6 tháng gần nhất (cả tháng không có lượt nào), gom nhóm một lần các lượt tạo từ đầu tháng thứ 6 trở lại
    'bookings_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(g.month, 'YYYY-MM'), 'count', coalesce(m.total, 0),
                                                   'confirmed', coalesce(m.confirmed, 0)) order by g.month), '[]'::jsonb)
      from generate_series(v_first, date_trunc('month', vn_now()), interval '1 month') as g(month)
      left join (
        select date_trunc('month', b.created_at at time zone 'Asia/Ho_Chi_Minh') as month,
               count(*)::int as total, (count(*) filter (where b.status = 'confirmed'))::int as confirmed
        from bookings b
        where b.created_at >= v_first at time zone 'Asia/Ho_Chi_Minh'
        group by 1
      ) m on m.month = g.month),
    'ai_questions_today', (select count(*)::int from ai_chat_logs where (created_at at time zone 'Asia/Ho_Chi_Minh')::date = vn_now()::date)
  );
end;
$$;
