-- =====================================================================
-- 0016 - Chức năng mới cho chủ sân và quản trị viên (Giai đoạn D, kế hoạch rà soát 16/11/2026)
--  1. Chủ sân đặt hộ khách vãng lai (khách gọi điện, đến trực tiếp) và khóa khung giờ (bảo trì, việc riêng):
--     cột bookings.kind / guest_name / guest_phone, hàm owner_create_offline_booking. Lượt này không có người chơi,
--     không qua giữ chỗ/thanh toán, xác nhận ngay; khung giờ hiện "Đã đặt" với người chơi khác.
--  2. owner_bookings_page (0015) tìm thêm theo tên, SĐT khách vãng lai.
--  3. owner_delete_venue: chủ sân xóa hẳn sân chưa từng có lượt đặt.
--  4. Khóa tài khoản bắt buộc lý do; người bị khóa thấy lý do khi đăng nhập (profiles.lock_reason, locked_at).
--  5. Nhật ký quản trị (admin_logs): duyệt/từ chối/ẩn/hiện sân, khóa/mở khóa tài khoản, ẩn/hiện đánh giá.
--     Ghi bằng trigger nên mọi đường gọi (trang web, API) đều được ghi.
--  6. admin_user_detail: trang chi tiết người dùng cho quản trị viên.
-- Chạy SAU 0015. Chạy lại nhiều lần không lỗi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lượt đặt hộ / khóa khung giờ
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists kind text not null default 'online';
alter table public.bookings add column if not exists guest_name text;
alter table public.bookings add column if not exists guest_phone text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_kind_check') then
    alter table public.bookings add constraint bookings_kind_check check (kind in ('online', 'walk_in', 'block'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bookings_guest_check') then
    alter table public.bookings add constraint bookings_guest_check check (
      (guest_name is null or char_length(guest_name) <= 80) and (guest_phone is null or char_length(guest_phone) <= 20));
  end if;
end $$;

-- View booking_details: thêm 3 cột ở cuối (create or replace view chỉ cho thêm cột cuối), phần còn lại giữ nguyên 0002
create or replace view public.booking_details
with (security_invoker = true) as
  select b.id, b.code, b.venue_id, v.name as venue_name, v.address as venue_address, b.player_id,
         b.total_amount, b.status, b.hold_expires_at, b.paid_reported_at, b.transfer_note,
         b.confirmed_at, b.cancel_reason, b.cancelled_by, b.created_at,
         (select min(bi.booking_date) from public.booking_items bi where bi.booking_id = b.id) as first_date,
         coalesce((select max(bi.booking_date + bi.start_time) + interval '1 hour' <= public.vn_now()
                   from public.booking_items bi where bi.booking_id = b.id), false) as is_past,
         (b.status in ('holding', 'awaiting_confirmation', 'confirmed')
          and coalesce((select min(bi.booking_date + bi.start_time) > public.vn_now()
                        from public.booking_items bi where bi.booking_id = b.id), true)) as can_cancel,
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'court_id', bi.court_id, 'court_name', c.name, 'booking_date', bi.booking_date,
                   'start_time', to_char(bi.start_time, 'HH24:MI'), 'price', bi.price)
                 order by bi.booking_date, c.id, bi.start_time), '[]'::jsonb)
          from public.booking_items bi join public.courts c on c.id = bi.court_id
          where bi.booking_id = b.id) as items,
         b.kind, b.guest_name, b.guest_phone
  from public.bookings b
  join public.venues v on v.id = b.venue_id;
grant select on public.booking_details to authenticated;

-- p_kind: walk_in (đặt hộ: bắt buộc tên khách, tính tiền theo bảng giá, thu tại sân) | block (khóa giờ: 0 đồng)
-- p_items: [{court_id, booking_date, start_time}], tối đa 48 khung giờ. p_guest_name với block là ghi chú (tùy chọn).
create or replace function public.owner_create_offline_booking(
  p_venue_id bigint, p_kind text, p_items jsonb, p_guest_name text default null, p_guest_phone text default null)
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
  v_name text := nullif(left(regexp_replace(trim(coalesce(p_guest_name, '')), '\s+', ' ', 'g'), 80), '');
  v_phone text := nullif(regexp_replace(coalesce(p_guest_phone, ''), '\s', '', 'g'), '');
  v_conflicts jsonb;
  v_id bigint;
  v_code text;
begin
  if v_uid is null or my_role() is distinct from 'owner' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho chủ sân';
  end if;
  select * into v_venue from venues where id = p_venue_id and owner_id = v_uid;
  if not found then
    raise exception 'FORBIDDEN' using detail = 'Đây không phải sân của bạn';
  end if;
  if v_venue.status not in ('approved', 'suspended', 'pending') then
    raise exception 'INVALID_STATE' using detail = 'Sân đang bị ẩn hoặc bị từ chối, không đặt được';
  end if;
  if p_kind not in ('walk_in', 'block') then
    raise exception 'INVALID_INPUT' using detail = 'Loại lượt đặt không hợp lệ';
  end if;
  if p_kind = 'walk_in' and (v_name is null or char_length(v_name) < 2) then
    raise exception 'INVALID_INPUT' using detail = 'Hãy nhập tên khách';
  end if;
  if v_phone is not null and v_phone !~ '^0\d{9}$' then
    raise exception 'INVALID_INPUT' using detail = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_INPUT' using detail = 'Hãy chọn ít nhất một khung giờ';
  end if;
  if jsonb_array_length(p_items) > 48 then
    raise exception 'INVALID_INPUT' using detail = 'Mỗi lần tối đa 48 khung giờ';
  end if;

  perform expire_holds();

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
      raise exception 'INVALID_INPUT' using detail = 'Sân con không thuộc sân này hoặc đã ngừng';
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
    if v_date > v_now::date + 60 then
      raise exception 'INVALID_INPUT' using detail = 'Chỉ đặt trước tối đa 60 ngày';
    end if;

    v_price := 0;
    if p_kind = 'walk_in' then
      select p.price into v_price
      from price_slots p
      where p.venue_id = p_venue_id
        and p.start_time <= v_time and v_time < p.end_time
        and p.day_type in (case when extract(dow from v_date) in (0, 6) then 'weekend' else 'weekday' end, 'weekday')
      order by (p.day_type = 'weekend') desc
      limit 1;
      v_price := coalesce(v_price, 0);
    end if;
    v_rows := v_rows || jsonb_build_object('court_id', v_court, 'booking_date', v_date, 'start_time', v_time, 'price', v_price);
    v_total := v_total + v_price;
  end loop;

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

  insert into bookings (venue_id, player_id, total_amount, status, hold_expires_at, confirmed_at, kind, guest_name, guest_phone)
  values (p_venue_id, null, v_total, 'confirmed', now(), now(), p_kind, v_name, case when p_kind = 'walk_in' then v_phone end)
  returning id, code into v_id, v_code;

  begin
    insert into booking_items (booking_id, court_id, booking_date, start_time, price)
    select v_id, (r ->> 'court_id')::bigint, (r ->> 'booking_date')::date, (r ->> 'start_time')::time, (r ->> 'price')::integer
    from jsonb_array_elements(v_rows) r;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN' using detail = '[]';
  end;

  return jsonb_build_object('id', v_id, 'code', v_code, 'total_amount', v_total);
end;
$$;
revoke execute on function public.owner_create_offline_booking(bigint, text, jsonb, text, text) from public, anon;
grant execute on function public.owner_create_offline_booking(bigint, text, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Lịch đặt của chủ sân: tìm thêm theo tên/SĐT khách vãng lai (thay bản 0015)
-- ---------------------------------------------------------------------
create or replace function public.owner_bookings_page(
  p_venue_id bigint default null,
  p_date date default null,
  p_status text default null,
  p_q text default null,
  p_limit integer default 30,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_digits text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
  v_result jsonb;
begin
  if v_uid is null or my_role() is distinct from 'owner' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho chủ sân';
  end if;
  if p_status is not null and p_status not in ('holding', 'awaiting_confirmation', 'confirmed', 'closed') then
    raise exception 'INVALID_INPUT' using detail = 'Trạng thái không hợp lệ';
  end if;
  if p_venue_id is not null and not exists (select 1 from venues where id = p_venue_id and owner_id = v_uid) then
    raise exception 'FORBIDDEN' using detail = 'Đây không phải sân của bạn';
  end if;

  with scoped as (
    select b.id, b.status, b.created_at
    from bookings b
    join venues v on v.id = b.venue_id and v.owner_id = v_uid
    left join profiles p on p.id = b.player_id and b.status <> 'expired'
    where (p_venue_id is null or b.venue_id = p_venue_id)
      and (p_date is null or exists (select 1 from booking_items bi where bi.booking_id = b.id and bi.booking_date = p_date))
      and (v_q is null
           or strpos(upper(b.code), upper(v_q)) > 0
           or strpos(vn_unaccent(coalesce(p.full_name, b.guest_name, '')), vn_unaccent(v_q)) > 0
           or (length(v_digits) >= 3 and strpos(coalesce(p.phone, b.guest_phone, ''), v_digits) > 0))
  ),
  filtered as (
    select * from scoped
    where p_status is null
       or (p_status = 'closed' and status in ('cancelled', 'expired'))
       or status = p_status
  )
  select jsonb_build_object(
    'summary', (select jsonb_build_object(
        'holding', count(*) filter (where status = 'holding'),
        'awaiting_confirmation', count(*) filter (where status = 'awaiting_confirmation'),
        'confirmed', count(*) filter (where status = 'confirmed'),
        'closed', count(*) filter (where status in ('cancelled', 'expired'))) from scoped),
    'total', (select count(*) from filtered),
    'ids', coalesce((select jsonb_agg(id order by created_at desc, id desc) from (
        select id, created_at from filtered order by created_at desc, id desc
        limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) page), '[]'::jsonb))
  into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Chủ sân xóa sân chưa từng có lượt đặt (sân con, bảng giá, ảnh, đánh giá xóa theo khóa ngoại)
-- ---------------------------------------------------------------------
create or replace function public.owner_delete_venue(p_venue_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or my_role() is distinct from 'owner' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho chủ sân';
  end if;
  perform 1 from venues where id = p_venue_id and owner_id = auth.uid() for update;
  if not found then
    raise exception 'FORBIDDEN' using detail = 'Đây không phải sân của bạn';
  end if;
  if exists (select 1 from bookings where venue_id = p_venue_id) then
    raise exception 'INVALID_STATE' using detail = 'Sân đã có lượt đặt nên không xóa được (cần giữ lịch sử để đối chiếu). Bạn có thể Tạm ngừng sân.';
  end if;
  delete from notifications where venue_id = p_venue_id;
  delete from venues where id = p_venue_id;
end;
$$;
revoke execute on function public.owner_delete_venue(bigint) from public, anon;
grant execute on function public.owner_delete_venue(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Khóa tài khoản kèm lý do
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists lock_reason text;
alter table public.profiles add column if not exists locked_at timestamptz;

drop function if exists public.admin_set_user_lock(uuid, boolean);
create or replace function public.admin_set_user_lock(p_user_id uuid, p_locked boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target profiles%rowtype;
  v_locked boolean := coalesce(p_locked, false);
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  if my_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho quản trị viên';
  end if;
  select * into v_target from profiles where id = p_user_id for update;
  if not found then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy người dùng';
  end if;
  if v_target.role = 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Không khóa được tài khoản quản trị viên';
  end if;
  if v_locked and v_reason is null then
    raise exception 'INVALID_INPUT' using detail = 'Hãy nhập lý do khóa tài khoản';
  end if;
  update profiles
     set is_locked = v_locked,
         lock_reason = case when v_locked then v_reason end,
         locked_at = case when v_locked then now() end
   where id = p_user_id;
  return jsonb_build_object('id', p_user_id, 'full_name', v_target.full_name, 'role', v_target.role, 'is_locked', v_locked,
                            'lock_reason', case when v_locked then v_reason end);
end;
$$;
revoke execute on function public.admin_set_user_lock(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_user_lock(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Nhật ký quản trị
-- ---------------------------------------------------------------------
create table if not exists public.admin_logs (
  id            bigint generated always as identity primary key,
  admin_id      uuid references public.profiles (id) on delete set null,
  action        text not null,
  target_type   text not null check (target_type in ('venue', 'user', 'review')),
  target_id     text not null,
  target_label  text,
  detail        text,
  created_at    timestamptz not null default now()
);
create index if not exists admin_logs_created_idx on public.admin_logs (created_at desc, id desc);
alter table public.admin_logs enable row level security;
revoke all on public.admin_logs from anon, authenticated;
grant select on public.admin_logs to authenticated;
grant all on public.admin_logs to service_role;
drop policy if exists admin_logs_admin_select on public.admin_logs;
create policy admin_logs_admin_select on public.admin_logs for select using (public.my_role() = 'admin');

create or replace function public.log_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if auth.uid() is null or my_role() is distinct from 'admin' then
    return new;
  end if;
  if tg_table_name = 'venues' then
    if new.status is not distinct from old.status then return new; end if;
    v_action := case
      when new.status = 'approved' and old.status = 'hidden' then 'Hiện lại sân'
      when new.status = 'approved' then 'Duyệt sân'
      when new.status = 'rejected' then 'Từ chối sân'
      when new.status = 'hidden' then 'Ẩn sân'
      else 'Đổi trạng thái sân: ' || old.status || ' → ' || new.status end;
    insert into admin_logs (admin_id, action, target_type, target_id, target_label, detail)
    values (auth.uid(), v_action, 'venue', new.id::text, new.name, case when new.status in ('rejected', 'hidden') then new.reject_reason end);
  elsif tg_table_name = 'profiles' then
    if new.is_locked is not distinct from old.is_locked then return new; end if;
    insert into admin_logs (admin_id, action, target_type, target_id, target_label, detail)
    values (auth.uid(), case when new.is_locked then 'Khóa tài khoản' else 'Mở khóa tài khoản' end, 'user', new.id::text, new.full_name,
            case when new.is_locked then new.lock_reason end);
  elsif tg_table_name = 'venue_reviews' then
    if new.status is not distinct from old.status then return new; end if;
    insert into admin_logs (admin_id, action, target_type, target_id, target_label, detail)
    values (auth.uid(), case when new.status = 'hidden' then 'Ẩn đánh giá' else 'Hiện lại đánh giá' end, 'review', new.id::text,
            (select v.name from venues v where v.id = new.venue_id) || ' · ' || new.rating || '★',
            case when new.status = 'hidden' then new.hidden_reason end);
  end if;
  return new;
end;
$$;
revoke execute on function public.log_admin_action() from public, anon, authenticated;

drop trigger if exists venues_admin_log_trg on public.venues;
create trigger venues_admin_log_trg after update of status on public.venues
  for each row execute function public.log_admin_action();
drop trigger if exists profiles_admin_log_trg on public.profiles;
create trigger profiles_admin_log_trg after update of is_locked on public.profiles
  for each row execute function public.log_admin_action();
drop trigger if exists venue_reviews_admin_log_trg on public.venue_reviews;
create trigger venue_reviews_admin_log_trg after update of status on public.venue_reviews
  for each row execute function public.log_admin_action();

-- ---------------------------------------------------------------------
-- 6. Chi tiết một người dùng cho quản trị viên
-- ---------------------------------------------------------------------
create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if my_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho quản trị viên';
  end if;
  select jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'phone', p.phone, 'role', p.role, 'email', u.email::text,
    'is_locked', p.is_locked, 'lock_reason', p.lock_reason, 'locked_at', p.locked_at, 'created_at', p.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'booking_counts', (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
                       from (select b.status, count(*) as n from bookings b where b.player_id = p.id group by b.status) s),
    'recent_bookings', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
        select b.id, b.code, b.status, b.total_amount, b.created_at, v.name as venue_name,
               (select min(bi.booking_date) from booking_items bi where bi.booking_id = b.id) as first_date
        from bookings b join venues v on v.id = b.venue_id
        where b.player_id = p.id order by b.created_at desc limit 20) x),
    'venues', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'status', v.status,
                                 'bookings', (select count(*) from bookings b where b.venue_id = v.id)) order by v.created_at desc), '[]'::jsonb)
               from venues v where v.owner_id = p.id),
    'reviews', (select count(*) from venue_reviews r where r.player_id = p.id),
    'logs', (select coalesce(jsonb_agg(jsonb_build_object('action', l.action, 'detail', l.detail, 'created_at', l.created_at,
                                 'admin_name', a.full_name) order by l.created_at desc), '[]'::jsonb)
             from (select * from admin_logs where target_type = 'user' and target_id = p.id::text order by created_at desc limit 20) l
             left join profiles a on a.id = l.admin_id))
  into v_result
  from profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id;
  if v_result is null then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy người dùng';
  end if;
  return v_result;
end;
$$;
revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;
