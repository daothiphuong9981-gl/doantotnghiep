-- =====================================================================
-- Vá bảo mật phân quyền. Chạy sau 0008_performance.sql.
--
-- 1. Số tài khoản ngân hàng của sân không còn đọc công khai qua API (trước đây ai có anon key cũng đọc được
--    bank_* của mọi sân đã duyệt). Chỉ đọc qua hàm: người chơi khi đang cần chuyển khoản cho lượt đặt của mình,
--    chủ sân cho sân của mình, quản trị viên.
-- 2. Tài khoản bị khóa không còn xem lịch đặt, báo chuyển khoản hay hủy lượt đặt qua API.
-- 3. Người chơi vẫn xem được lượt đặt cũ của mình khi sân bị ẩn hoặc tạm ngừng (trước đây lượt đặt "biến mất"
--    vì view booking_details nối với venues chịu RLS chỉ cho thấy sân đã duyệt).
-- 4. Chủ sân chỉ thấy họ tên, số điện thoại của khách có lượt đặt còn ý nghĩa (không tính lượt giữ chỗ đã
--    hết hạn mà khách chưa từng chuyển khoản).
-- =====================================================================

-- 1. Ẩn cột tài khoản ngân hàng -------------------------------------------
revoke select on public.venues from anon, authenticated;
grant select (id, owner_id, ward_id, name, address, description, contact_phone, latitude, longitude, location,
              open_time, close_time, hold_minutes, status, reject_reason, created_at, approved_at,
              max_slots_per_booking, advance_days, max_active_holds)
  on public.venues to anon, authenticated;

-- Thông tin chuyển khoản cho một lượt đặt: chỉ người đặt, khi lượt còn giữ chỗ hoặc chờ xác nhận.
-- Số tiền và nội dung chuyển khoản lấy từ cơ sở dữ liệu, không nhận từ trình duyệt.
create or replace function public.booking_payment_info(p_booking_id bigint)
returns table (bank_name text, account_number text, account_name text, amount integer, content text)
language sql
stable
security definer
set search_path = public
as $$
  select v.bank_name, v.bank_account_number, v.bank_account_name, b.total_amount, b.code
  from bookings b
  join venues v on v.id = b.venue_id
  where b.id = p_booking_id
    and b.player_id = auth.uid()
    and public.my_role() is not null
    and b.status in ('holding', 'awaiting_confirmation');
$$;

-- Tài khoản nhận tiền của một sân: chủ sân (để sửa) hoặc quản trị viên
create or replace function public.venue_bank_info(p_venue_id bigint)
returns table (bank_name text, bank_account_number text, bank_account_name text)
language sql
stable
security definer
set search_path = public
as $$
  select v.bank_name, v.bank_account_number, v.bank_account_name
  from venues v
  where v.id = p_venue_id
    and ((v.owner_id = auth.uid() and public.my_role() = 'owner') or public.my_role() = 'admin');
$$;

revoke execute on function public.booking_payment_info(bigint), public.venue_bank_info(bigint) from public, anon;
grant execute on function public.booking_payment_info(bigint), public.venue_bank_info(bigint) to authenticated;

-- 2 + 3. Lượt đặt: tài khoản bị khóa không xem được; sân đã từng đặt vẫn thấy tên, địa chỉ ----------------
-- Danh sách sân của chủ sân: chỉ khi tài khoản chưa bị khóa
create or replace function public.my_venue_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from venues where owner_id = auth.uid() and public.my_role() is not null;
$$;

-- Các sân người đang đăng nhập từng đặt (để xem lại lịch sử khi sân đã bị ẩn hoặc tạm ngừng)
create or replace function public.my_booked_venue_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select distinct venue_id from bookings where player_id = auth.uid() and public.my_role() is not null;
$$;
revoke execute on function public.my_booked_venue_ids() from public;
grant execute on function public.my_booked_venue_ids() to anon, authenticated;

drop policy if exists venues_select on public.venues;
create policy venues_select on public.venues for select
  using (status = 'approved' or owner_id = (select auth.uid()) or (select public.my_role()) = 'admin'
         or id in (select public.my_booked_venue_ids()));

drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings for select
  using ((player_id = (select auth.uid()) and (select public.my_role()) is not null)
         or venue_id in (select public.my_venue_ids())
         or (select public.my_role()) = 'admin');

-- Thẻ sân chỉ gồm sân đã duyệt (không phụ thuộc việc RLS của venues nay cho người chơi thấy sân cũ đã đặt)
create or replace view public.venue_cards
with (security_invoker = true) as
  select v.id, v.name, v.address, v.ward_id, w.name as ward_name,
         v.latitude, v.longitude, v.open_time, v.close_time, v.hold_minutes, v.status,
         (select min(p.price) from public.price_slots p where p.venue_id = v.id) as min_price,
         (select count(*) from public.courts c where c.venue_id = v.id and c.is_active) as court_count,
         (select i.storage_path from public.venue_images i where i.venue_id = v.id order by i.sort_order, i.id limit 1) as thumbnail
  from public.venues v
  join public.wards w on w.id = v.ward_id
  where v.status = 'approved';

-- 4. Chủ sân xem thông tin khách -------------------------------------------
-- Truy vấn con trên bookings chịu RLS của bookings (chủ sân chỉ thấy lượt đặt của sân mình)
drop policy if exists profiles_select_customers on public.profiles;
create policy profiles_select_customers on public.profiles for select
  using (id in (select b.player_id from public.bookings b
                where b.venue_id in (select public.my_venue_ids()) and b.status <> 'expired'));

-- 2. Hàm ghi: chặn tài khoản bị khóa ---------------------------------------
create or replace function public.report_payment(p_booking_id bigint, p_transfer_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
begin
  if my_role() is null then
    raise exception 'FORBIDDEN' using detail = 'Tài khoản không có quyền thực hiện thao tác này';
  end if;
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

-- Giống 0007, thêm điều kiện tài khoản chưa bị khóa (my_role() trả null khi bị khóa)
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
  if my_role() is null then
    raise exception 'FORBIDDEN' using detail = 'Tài khoản không có quyền thực hiện thao tác này';
  end if;
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
  if v_first is not null and v_first <= vn_now()
     and not (v_is_owner and v_booking.status = 'awaiting_confirmation') then
    raise exception 'INVALID_STATE' using detail = 'Lượt đặt đã đến hoặc đã qua giờ chơi';
  end if;

  update bookings set status = 'cancelled', cancel_reason = v_reason, cancelled_by = v_uid where id = p_booking_id;
  update booking_items set is_active = false where booking_id = p_booking_id;
  return 'cancelled';
end;
$$;
