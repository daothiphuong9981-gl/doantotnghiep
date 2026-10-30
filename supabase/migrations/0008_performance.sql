-- =====================================================================
-- Hiệu năng truy vấn. Chạy sau 0007_overdue_awaiting.sql.
--
-- 1. Index cho các khóa ngoại và bộ lọc dùng thường xuyên nhưng chưa có index:
--    booking_items.booking_id (view booking_details có 4 truy vấn con theo cột này cho MỖI lượt đặt),
--    venue_images.venue_id (trang chủ, chi tiết sân, search_venues), lượt giữ chỗ chờ hết hạn (expire_holds),
--    lịch sử đặt sân của người chơi (lọc player_id, sắp xếp created_at).
-- 2. Viết lại chính sách RLS để Postgres tính auth.uid() / my_role() / danh sách sân của chủ sân MỘT LẦN cho cả
--    truy vấn (initPlan) thay vì gọi lại hàm cho TỪNG dòng (khuyến nghị của Supabase). Ý nghĩa phân quyền giữ nguyên.
-- =====================================================================

-- 1. Index ---------------------------------------------------------------
create index if not exists booking_items_booking_idx on public.booking_items (booking_id);
create index if not exists booking_items_court_date_idx on public.booking_items (court_id, booking_date) where is_active;
create index if not exists bookings_player_created_idx on public.bookings (player_id, created_at desc);
create index if not exists bookings_holding_expiry_idx on public.bookings (hold_expires_at) where status = 'holding';
create index if not exists venue_images_venue_idx on public.venue_images (venue_id, sort_order, id);

-- 2. Hàm trợ giúp trả về TẬP id (dùng dạng "x in (select ...)" để chỉ chạy một lần mỗi truy vấn).
-- security definer: đọc venues/bookings không qua RLS, tránh vòng lặp chính sách giữa hai bảng.
create or replace function public.my_venue_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from venues where owner_id = auth.uid();
$$;

create or replace function public.public_venue_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from venues where status = 'approved';
$$;

revoke execute on function public.my_venue_ids(), public.public_venue_ids() from public;
grant execute on function public.my_venue_ids(), public.public_venue_ids() to anon, authenticated;

-- profiles ------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using (id = (select auth.uid()) or (select public.my_role()) = 'admin');
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update
  using ((select public.my_role()) = 'admin') with check ((select public.my_role()) = 'admin');

-- wards ---------------------------------------------------------------
drop policy if exists wards_admin_write on public.wards;
create policy wards_admin_write on public.wards for all
  using ((select public.my_role()) = 'admin') with check ((select public.my_role()) = 'admin');

-- venues --------------------------------------------------------------
drop policy if exists venues_select on public.venues;
create policy venues_select on public.venues for select
  using (status = 'approved' or owner_id = (select auth.uid()) or (select public.my_role()) = 'admin');
drop policy if exists venues_insert_owner on public.venues;
create policy venues_insert_owner on public.venues for insert
  with check (owner_id = (select auth.uid()) and (select public.my_role()) = 'owner');
drop policy if exists venues_update_owner on public.venues;
create policy venues_update_owner on public.venues for update
  using (owner_id = (select auth.uid()) and (select public.my_role()) = 'owner')
  with check (owner_id = (select auth.uid()));
drop policy if exists venues_admin_update on public.venues;
create policy venues_admin_update on public.venues for update
  using ((select public.my_role()) = 'admin') with check ((select public.my_role()) = 'admin');

-- courts, price_slots, venue_images -----------------------------------
drop policy if exists courts_select on public.courts;
create policy courts_select on public.courts for select
  using (venue_id in (select public.public_venue_ids()) or venue_id in (select public.my_venue_ids())
         or (select public.my_role()) = 'admin');
drop policy if exists courts_owner_write on public.courts;
create policy courts_owner_write on public.courts for all
  using (venue_id in (select public.my_venue_ids()) and (select public.my_role()) = 'owner')
  with check (venue_id in (select public.my_venue_ids()) and (select public.my_role()) = 'owner');

drop policy if exists price_slots_select on public.price_slots;
create policy price_slots_select on public.price_slots for select
  using (venue_id in (select public.public_venue_ids()) or venue_id in (select public.my_venue_ids())
         or (select public.my_role()) = 'admin');
drop policy if exists price_slots_owner_write on public.price_slots;
create policy price_slots_owner_write on public.price_slots for all
  using (venue_id in (select public.my_venue_ids()) and (select public.my_role()) = 'owner')
  with check (venue_id in (select public.my_venue_ids()) and (select public.my_role()) = 'owner');

drop policy if exists venue_images_select on public.venue_images;
create policy venue_images_select on public.venue_images for select
  using (venue_id in (select public.public_venue_ids()) or venue_id in (select public.my_venue_ids())
         or (select public.my_role()) = 'admin');
drop policy if exists venue_images_owner_write on public.venue_images;
create policy venue_images_owner_write on public.venue_images for all
  using (venue_id in (select public.my_venue_ids()) and (select public.my_role()) = 'owner')
  with check (venue_id in (select public.my_venue_ids()) and (select public.my_role()) = 'owner');

-- bookings, booking_items ---------------------------------------------
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings for select
  using (player_id = (select auth.uid()) or venue_id in (select public.my_venue_ids())
         or (select public.my_role()) = 'admin');
-- Dòng chi tiết thấy được khi thấy lượt đặt cha: truy vấn con trên bookings đã chịu RLS của bookings
drop policy if exists booking_items_select on public.booking_items;
create policy booking_items_select on public.booking_items for select
  using (booking_id in (select b.id from public.bookings b));

-- ai_chat_logs, notifications -----------------------------------------
drop policy if exists ai_chat_logs_admin_select on public.ai_chat_logs;
create policy ai_chat_logs_admin_select on public.ai_chat_logs for select
  using ((select public.my_role()) = 'admin');
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (user_id = (select auth.uid()));
