-- =====================================================================
-- Website cho thuê sân cầu lông Đà Nẵng - Khởi tạo cơ sở dữ liệu
-- Theo tài liệu 9.DatabaseDesign_v1.0. Chạy một lần trong SQL Editor của
-- Supabase (hoặc bằng `supabase db push`).
-- =====================================================================

create extension if not exists postgis;

-- ---------------------------------------------------------------------
-- 1. profiles: hồ sơ người dùng, gắn 1-1 với auth.users
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  role        text not null default 'player' check (role in ('player', 'owner', 'admin')),
  is_locked   boolean not null default false,
  consent_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. wards: phường, xã, đặc khu của Đà Nẵng (Nghị quyết 1659/NQ-UBTVQH15)
-- ---------------------------------------------------------------------
create table public.wards (
  id    smallint primary key,
  name  text not null unique,
  type  text not null check (type in ('phuong', 'xa', 'dac_khu'))
);

-- ---------------------------------------------------------------------
-- 3. venues: cơ sở sân
-- ---------------------------------------------------------------------
create table public.venues (
  id                   bigint generated always as identity primary key,
  owner_id             uuid not null references public.profiles (id),
  ward_id              smallint not null references public.wards (id),
  name                 text not null,
  address              text not null,
  description          text,
  contact_phone        text,
  latitude             numeric(9, 6) not null,
  longitude            numeric(9, 6) not null,
  location             geography (Point, 4326) generated always as (
                         st_setsrid(st_makepoint(longitude::double precision, latitude::double precision), 4326)::geography
                       ) stored,
  open_time            time not null,
  close_time           time not null,
  hold_minutes         smallint not null default 15 check (hold_minutes between 5 and 60),
  bank_name            text not null,
  bank_account_number  text not null,
  bank_account_name    text not null,
  status               text not null default 'pending'
                         check (status in ('pending', 'approved', 'rejected', 'suspended', 'hidden')),
  reject_reason        text,
  created_at           timestamptz not null default now(),
  approved_at          timestamptz,
  check (close_time > open_time)
);
create index venues_location_idx on public.venues using gist (location);
create index venues_owner_idx on public.venues (owner_id);
create index venues_status_idx on public.venues (status);

-- ---------------------------------------------------------------------
-- 4. courts: sân con
-- ---------------------------------------------------------------------
create table public.courts (
  id         bigint generated always as identity primary key,
  venue_id   bigint not null references public.venues (id) on delete cascade,
  name       text not null,
  is_active  boolean not null default true,
  unique (venue_id, name)
);

-- ---------------------------------------------------------------------
-- 5. price_slots: bảng giá theo khung giờ
-- ---------------------------------------------------------------------
create table public.price_slots (
  id          bigint generated always as identity primary key,
  venue_id    bigint not null references public.venues (id) on delete cascade,
  day_type    text not null check (day_type in ('weekday', 'weekend')),
  start_time  time not null,
  end_time    time not null,
  price       integer not null check (price >= 0),
  check (end_time > start_time),
  unique (venue_id, day_type, start_time)
);

-- ---------------------------------------------------------------------
-- 6. venue_images: ảnh sân (tệp nằm trên Supabase Storage)
-- ---------------------------------------------------------------------
create table public.venue_images (
  id            bigint generated always as identity primary key,
  venue_id      bigint not null references public.venues (id) on delete cascade,
  storage_path  text not null,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. bookings + 8. booking_items: lượt đặt và chi tiết (dùng từ Sprint 2)
-- ---------------------------------------------------------------------
create table public.bookings (
  id                bigint generated always as identity primary key,
  code              text not null unique,
  venue_id          bigint not null references public.venues (id),
  player_id         uuid references public.profiles (id) on delete set null,
  total_amount      integer not null check (total_amount >= 0),
  status            text not null default 'holding'
                      check (status in ('holding', 'awaiting_confirmation', 'confirmed', 'cancelled', 'expired')),
  hold_expires_at   timestamptz not null,
  paid_reported_at  timestamptz,
  transfer_note     text,
  confirmed_at      timestamptz,
  cancel_reason     text,
  cancelled_by      uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index bookings_player_idx on public.bookings (player_id);
create index bookings_venue_idx on public.bookings (venue_id, status);

create table public.booking_items (
  id            bigint generated always as identity primary key,
  booking_id    bigint not null references public.bookings (id) on delete cascade,
  court_id      bigint not null references public.courts (id),
  booking_date  date not null,
  start_time    time not null,
  price         integer not null,
  is_active     boolean not null default true
);
-- Chống trùng lịch: một khung giờ của một sân con chỉ thuộc một lượt đặt còn hiệu lực
create unique index booking_items_active_slot_uidx
  on public.booking_items (court_id, booking_date, start_time)
  where is_active;

-- ---------------------------------------------------------------------
-- 9. ai_chat_logs: nhật ký trợ lý AI (dùng từ Sprint 3)
-- ---------------------------------------------------------------------
create table public.ai_chat_logs (
  id             bigint generated always as identity primary key,
  user_id        uuid references public.profiles (id) on delete set null,
  session_id     uuid not null,
  question       text not null,
  parsed_filter  jsonb,
  result_count   integer,
  status         text not null check (status in ('ok', 'fallback', 'rejected', 'error')),
  created_at     timestamptz not null default now()
);

-- =====================================================================
-- Hàm tiện ích
-- =====================================================================

-- Vai trò của người đang đăng nhập (null nếu là khách hoặc tài khoản bị khóa)
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and not is_locked;
$$;

-- Tạo hồ sơ khi có tài khoản mới. Vai trò lấy từ thông tin đăng ký,
-- chỉ chấp nhận player hoặc owner (admin phải được gán thủ công).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'player');
begin
  if v_role not in ('player', 'owner') then
    v_role := 'player';
  end if;
  insert into public.profiles (id, full_name, phone, role, consent_at)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Người dùng'),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    v_role,
    now()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kiểm soát trạng thái sân: chủ sân không tự duyệt được sân của mình.
create or replace function public.venues_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.my_role();
begin
  -- Thao tác từ máy chủ bằng khóa service (không có auth.uid()) hoặc quản trị viên: cho qua
  if auth.uid() is null or v_role = 'admin' then
    if tg_op = 'UPDATE' and new.status = 'approved' and old.status <> 'approved' then
      new.approved_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.reject_reason := null;
    new.approved_at := null;
    return new;
  end if;

  if new.owner_id <> old.owner_id then
    raise exception 'Không được đổi chủ sân';
  end if;
  new.approved_at := old.approved_at;
  new.reject_reason := old.reject_reason;

  if new.status <> old.status then
    -- Chủ sân chỉ được: tạm ngừng / mở lại sân đã duyệt, gửi lại sân bị từ chối
    if not (
      (old.status = 'approved' and new.status = 'suspended') or
      (old.status = 'suspended' and new.status = 'approved') or
      (old.status = 'rejected' and new.status = 'pending')
    ) then
      raise exception 'Không được chuyển trạng thái sân từ % sang %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger venues_guard_trg
  before insert or update on public.venues
  for each row execute function public.venues_guard();

-- Sân đã duyệt trong bán kính cho trước, kèm khoảng cách (km), gần nhất trước
create or replace function public.venues_nearby(p_lat double precision, p_lng double precision, p_radius_km double precision default 20)
returns table (
  id bigint, name text, address text, ward_id smallint, ward_name text,
  latitude numeric, longitude numeric, min_price integer, court_count bigint,
  thumbnail text, distance_km double precision
)
language sql
stable
set search_path = public
as $$
  select v.id, v.name, v.address, v.ward_id, w.name,
         v.latitude, v.longitude,
         (select min(p.price) from price_slots p where p.venue_id = v.id),
         (select count(*) from courts c where c.venue_id = v.id and c.is_active),
         (select i.storage_path from venue_images i where i.venue_id = v.id order by i.sort_order, i.id limit 1),
         round((st_distance(v.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0)::numeric, 2)::double precision
  from venues v
  join wards w on w.id = v.ward_id
  where v.status = 'approved'
    and st_dwithin(v.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_km * 1000.0)
  order by v.location <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
$$;

-- Danh sách sân đã duyệt kèm giá thấp nhất, số sân con, ảnh đại diện
create or replace view public.venue_cards
with (security_invoker = true) as
  select v.id, v.name, v.address, v.ward_id, w.name as ward_name,
         v.latitude, v.longitude, v.open_time, v.close_time, v.hold_minutes, v.status,
         (select min(p.price) from public.price_slots p where p.venue_id = v.id) as min_price,
         (select count(*) from public.courts c where c.venue_id = v.id and c.is_active) as court_count,
         (select i.storage_path from public.venue_images i where i.venue_id = v.id order by i.sort_order, i.id limit 1) as thumbnail
  from public.venues v
  join public.wards w on w.id = v.ward_id;

-- =====================================================================
-- Phân quyền theo dòng dữ liệu (Row Level Security)
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.wards         enable row level security;
alter table public.venues        enable row level security;
alter table public.courts        enable row level security;
alter table public.price_slots   enable row level security;
alter table public.venue_images  enable row level security;
alter table public.bookings      enable row level security;
alter table public.booking_items enable row level security;
alter table public.ai_chat_logs  enable row level security;

-- Sân mà người đang đăng nhập là chủ (dùng trong các chính sách bên dưới)
create or replace function public.owns_venue(p_venue_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from venues where id = p_venue_id and owner_id = auth.uid());
$$;

create or replace function public.venue_is_public(p_venue_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from venues where id = p_venue_id and status = 'approved');
$$;

-- Quyền ở mức bảng cho các vai trò của Supabase (RLS quyết định từng dòng)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant select on public.wards, public.venues, public.courts, public.price_slots, public.venue_images to anon, authenticated;
grant insert, update, delete on public.venues, public.courts, public.price_slots, public.venue_images to authenticated;
grant select on public.profiles, public.bookings, public.booking_items, public.ai_chat_logs to authenticated;

-- profiles ------------------------------------------------------------
create policy profiles_select_own on public.profiles for select
  using (id = auth.uid() or public.my_role() = 'admin');
-- Chủ sân xem tên, số điện thoại của người đã đặt sân mình
create policy profiles_select_customers on public.profiles for select
  using (exists (
    select 1 from public.bookings b
    where b.player_id = profiles.id and public.owns_venue(b.venue_id)
  ));
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
-- Người dùng chỉ sửa được họ tên, số điện thoại; vai trò và trạng thái khóa do quản trị viên quản lý
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and public.my_role() is distinct from 'admin' then
    if new.role <> old.role or new.is_locked <> old.is_locked then
      raise exception 'Không được tự thay đổi vai trò hoặc trạng thái khóa';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- wards ---------------------------------------------------------------
create policy wards_select_all on public.wards for select using (true);
create policy wards_admin_write on public.wards for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- venues --------------------------------------------------------------
create policy venues_select on public.venues for select
  using (status = 'approved' or owner_id = auth.uid() or public.my_role() = 'admin');
create policy venues_insert_owner on public.venues for insert
  with check (owner_id = auth.uid() and public.my_role() = 'owner');
create policy venues_update_owner on public.venues for update
  using (owner_id = auth.uid() and public.my_role() = 'owner')
  with check (owner_id = auth.uid());
create policy venues_admin_update on public.venues for update
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- courts, price_slots, venue_images -----------------------------------
create policy courts_select on public.courts for select
  using (public.venue_is_public(venue_id) or public.owns_venue(venue_id) or public.my_role() = 'admin');
create policy courts_owner_write on public.courts for all
  using (public.owns_venue(venue_id) and public.my_role() = 'owner')
  with check (public.owns_venue(venue_id) and public.my_role() = 'owner');

create policy price_slots_select on public.price_slots for select
  using (public.venue_is_public(venue_id) or public.owns_venue(venue_id) or public.my_role() = 'admin');
create policy price_slots_owner_write on public.price_slots for all
  using (public.owns_venue(venue_id) and public.my_role() = 'owner')
  with check (public.owns_venue(venue_id) and public.my_role() = 'owner');

create policy venue_images_select on public.venue_images for select
  using (public.venue_is_public(venue_id) or public.owns_venue(venue_id) or public.my_role() = 'admin');
create policy venue_images_owner_write on public.venue_images for all
  using (public.owns_venue(venue_id) and public.my_role() = 'owner')
  with check (public.owns_venue(venue_id) and public.my_role() = 'owner');

-- bookings, booking_items (chỉ đọc; ghi qua hàm ở Sprint 2) ------------
create policy bookings_select on public.bookings for select
  using (player_id = auth.uid() or public.owns_venue(venue_id) or public.my_role() = 'admin');
create policy booking_items_select on public.booking_items for select
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_items.booking_id
      and (b.player_id = auth.uid() or public.owns_venue(b.venue_id) or public.my_role() = 'admin')
  ));

-- ai_chat_logs: chỉ quản trị viên đọc; máy chủ ghi bằng khóa service ---
create policy ai_chat_logs_admin_select on public.ai_chat_logs for select
  using (public.my_role() = 'admin');

-- Trạng thái các khung giờ đã có người giữ hoặc đặt trong một ngày của một sân.
-- Trả về dữ liệu không kèm thông tin người đặt nên ai cũng gọi được.
create or replace function public.venue_taken_slots(p_venue_id bigint, p_date date)
returns table (court_id bigint, start_time time, state text)
language sql
stable
security definer
set search_path = public
as $$
  select bi.court_id, bi.start_time,
         case when b.status = 'holding' then 'held' else 'booked' end
  from booking_items bi
  join bookings b on b.id = bi.booking_id
  join courts c on c.id = bi.court_id
  where c.venue_id = p_venue_id
    and bi.booking_date = p_date
    and bi.is_active
    and not (b.status = 'holding' and b.hold_expires_at < now());
$$;

-- Thay toàn bộ bảng giá của một sân trong một transaction.
-- Chạy với quyền của người gọi nên RLS vẫn bảo đảm chỉ chủ sân sửa được sân của mình.
create or replace function public.replace_price_slots(p_venue_id bigint, p_prices jsonb)
returns setof public.price_slots
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from price_slots where venue_id = p_venue_id;
  return query
    insert into price_slots (venue_id, day_type, start_time, end_time, price)
    select p_venue_id, x ->> 'day_type', (x ->> 'start_time')::time, (x ->> 'end_time')::time, (x ->> 'price')::integer
    from jsonb_array_elements(p_prices) as x
    returning *;
end;
$$;

grant execute on function public.venues_nearby(double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.venue_taken_slots(bigint, date) to anon, authenticated;
grant execute on function public.replace_price_slots(bigint, jsonb) to authenticated;
grant select on public.venue_cards to anon, authenticated;

-- =====================================================================
-- Lưu trữ ảnh sân (Supabase Storage)
-- Đường dẫn tệp: <venue_id>/<tên tệp>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-images', 'venue-images', true, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy venue_images_storage_read on storage.objects for select
  using (bucket_id = 'venue-images');
create policy venue_images_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'venue-images'
    and public.owns_venue(((storage.foldername(name))[1])::bigint)
  );
create policy venue_images_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'venue-images'
    and public.owns_venue(((storage.foldername(name))[1])::bigint)
  );
