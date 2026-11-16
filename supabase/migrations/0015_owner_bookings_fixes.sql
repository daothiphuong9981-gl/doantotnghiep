-- =====================================================================
-- 0015 - Sửa lỗi chức năng đã có (Giai đoạn C, kế hoạch rà soát 16/11/2026)
--  1. owner_bookings_page: lịch đặt của chủ sân lọc theo sân/ngày/trạng thái/từ khóa và phân trang ngay trong SQL
--     (trước đây lấy 300 lượt mới nhất rồi mới lọc: sân đông bị sai số đếm, sót lượt chờ xác nhận).
--  2. courts_guard_deactivate: không cho ngừng một sân con còn khung giờ đã đặt sắp tới (giảm số sân con trong form
--     trước đây ngừng luôn sân đang có lượt đã thanh toán mà không cảnh báo).
--  3. admin_venue_page: danh sách sân của quản trị viên đếm, lọc, phân trang trong SQL (trước đây tối đa 500 dòng).
-- Chạy lại nhiều lần không lỗi (create or replace, drop trigger if exists).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lịch đặt của chủ sân
-- p_status: holding | awaiting_confirmation | confirmed | closed (= cancelled + expired) | null (tất cả)
-- p_q: mã lượt (DS1234), tên hoặc số điện thoại người đặt. Người giữ chỗ đã hết hạn không tìm theo tên/SĐT được
--      (0009: chủ sân không xem được thông tin của họ).
-- Trả về: { summary: {holding, awaiting_confirmation, confirmed, closed}, total, ids: [...] }; summary tính theo sân,
-- ngày, từ khóa (không theo trạng thái) để các tab luôn hiện đúng số.
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
           or upper(b.code) = upper(v_q)
           or strpos(upper(b.code), upper(v_q)) > 0
           or strpos(vn_unaccent(coalesce(p.full_name, '')), vn_unaccent(v_q)) > 0
           or (length(regexp_replace(v_q, '\D', '', 'g')) >= 3
               and strpos(coalesce(p.phone, ''), regexp_replace(v_q, '\D', '', 'g')) > 0))
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
revoke execute on function public.owner_bookings_page(bigint, date, text, text, integer, integer) from public, anon;
grant execute on function public.owner_bookings_page(bigint, date, text, text, integer, integer) to authenticated;

-- Lọc theo ngày chơi nhanh hơn
create index if not exists booking_items_booking_date_idx on public.booking_items (booking_date, booking_id);

-- ---------------------------------------------------------------------
-- 2. Không ngừng sân con đang còn khung giờ đã đặt sắp tới
-- ---------------------------------------------------------------------
create or replace function public.courts_guard_deactivate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_first timestamp;
begin
  if old.is_active and not new.is_active then
    select count(*), min(bi.booking_date + bi.start_time) into v_count, v_first
    from booking_items bi
    where bi.court_id = old.id and bi.is_active and bi.booking_date + bi.start_time > vn_now();
    if v_count > 0 then
      raise exception 'INVALID_STATE' using detail = format(
        '%s còn %s khung giờ đã có người đặt (gần nhất %s). Hãy xử lý các lượt đặt đó trước khi ngừng sân con.',
        old.name, v_count, to_char(v_first, 'HH24:MI DD/MM/YYYY'));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists courts_guard_deactivate_trg on public.courts;
create trigger courts_guard_deactivate_trg
  before update of is_active on public.courts
  for each row execute function public.courts_guard_deactivate();

-- ---------------------------------------------------------------------
-- 3. Danh sách sân của quản trị viên
-- Trả về: { counts: {pending, approved, rejected, suspended, hidden}, total, ids: [...] } (counts theo từ khóa)
-- ---------------------------------------------------------------------
create or replace function public.admin_venue_page(
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
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_result jsonb;
begin
  if my_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho quản trị viên';
  end if;
  with scoped as (
    select v.id, v.status, v.created_at
    from venues v
    where v_q is null
       or strpos(vn_unaccent(v.name), vn_unaccent(v_q)) > 0
       or strpos(vn_unaccent(v.address), vn_unaccent(v_q)) > 0
  ),
  filtered as (select * from scoped where p_status is null or status = p_status)
  select jsonb_build_object(
    'counts', (select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'approved', count(*) filter (where status = 'approved'),
        'rejected', count(*) filter (where status = 'rejected'),
        'suspended', count(*) filter (where status = 'suspended'),
        'hidden', count(*) filter (where status = 'hidden')) from scoped),
    'total', (select count(*) from filtered),
    'ids', coalesce((select jsonb_agg(id order by created_at desc, id desc) from (
        select id, created_at from filtered order by created_at desc, id desc
        limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) page), '[]'::jsonb))
  into v_result;
  return v_result;
end;
$$;
revoke execute on function public.admin_venue_page(text, text, integer, integer) from public, anon;
grant execute on function public.admin_venue_page(text, text, integer, integer) to authenticated;
