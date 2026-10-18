-- =====================================================================
-- Sprint 3: quản trị, thống kê, trợ lý AI, xóa tài khoản
-- Chạy sau 0004_venue_rules.sql.
-- Quy ước lỗi giống 0002: thông điệp là mã (FORBIDDEN, NOT_FOUND, INVALID_INPUT, INVALID_STATE,
-- UNAUTHENTICATED, RATE_LIMITED), phần giải thích nằm ở DETAIL.
-- =====================================================================

-- Sân còn lịch sử đặt vẫn được giữ lại (ẩn danh) khi chủ sân xóa tài khoản
alter table public.venues alter column owner_id drop not null;
alter table public.venues drop constraint if exists venues_owner_id_fkey;
alter table public.venues add constraint venues_owner_id_fkey
  foreign key (owner_id) references public.profiles (id) on delete set null;

-- venues_guard: thêm ngoại lệ cho thao tác hệ thống (xóa tài khoản) đánh dấu bằng app.system_update
create or replace function public.venues_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.my_role();
begin
  if auth.uid() is null or v_role = 'admin' or coalesce(current_setting('app.system_update', true), '') = '1' then
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

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Không được đổi chủ sân';
  end if;
  new.approved_at := old.approved_at;
  new.reject_reason := old.reject_reason;

  if new.status <> old.status then
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

-- ---------------------------------------------------------------------
-- PB19, PB20 - Quản trị viên duyệt, từ chối, ẩn, bỏ ẩn sân
-- ---------------------------------------------------------------------
create or replace function public.admin_review_venue(p_venue_id bigint, p_action text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue venues%rowtype;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using detail = 'Bạn cần đăng nhập';
  end if;
  if my_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho quản trị viên';
  end if;
  select * into v_venue from venues where id = p_venue_id for update;
  if not found then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy sân';
  end if;

  if p_action = 'approve' then
    if v_venue.status not in ('pending', 'rejected') then
      raise exception 'INVALID_STATE' using detail = 'Chỉ duyệt được sân đang chờ duyệt hoặc đã bị từ chối';
    end if;
    update venues set status = 'approved', reject_reason = null where id = p_venue_id;
  elsif p_action = 'reject' then
    if v_venue.status <> 'pending' then
      raise exception 'INVALID_STATE' using detail = 'Chỉ từ chối được sân đang chờ duyệt';
    end if;
    if v_reason is null then
      raise exception 'INVALID_INPUT' using detail = 'Hãy nhập lý do từ chối';
    end if;
    update venues set status = 'rejected', reject_reason = v_reason where id = p_venue_id;
  elsif p_action = 'hide' then
    if v_venue.status not in ('approved', 'suspended') then
      raise exception 'INVALID_STATE' using detail = 'Chỉ ẩn được sân đang hiển thị hoặc tạm ngừng';
    end if;
    if v_reason is null then
      raise exception 'INVALID_INPUT' using detail = 'Hãy nhập lý do ẩn sân';
    end if;
    update venues set status = 'hidden', reject_reason = v_reason where id = p_venue_id;
  elsif p_action = 'unhide' then
    if v_venue.status <> 'hidden' then
      raise exception 'INVALID_STATE' using detail = 'Sân không ở trạng thái bị ẩn';
    end if;
    if v_venue.owner_id is null then
      raise exception 'INVALID_STATE' using detail = 'Sân không còn chủ sân nên không hiển thị lại được';
    end if;
    update venues set status = 'approved', reject_reason = null where id = p_venue_id;
  else
    raise exception 'INVALID_INPUT' using detail = 'Thao tác không hợp lệ';
  end if;

  return (select jsonb_build_object('id', v.id, 'name', v.name, 'status', v.status, 'reject_reason', v.reject_reason, 'approved_at', v.approved_at)
          from venues v where v.id = p_venue_id);
end;
$$;

-- ---------------------------------------------------------------------
-- PB20 - Danh sách người dùng (kèm email lấy từ auth.users), khóa và mở khóa
-- ---------------------------------------------------------------------
create or replace function public.admin_list_users(p_q text default null, p_role text default null, p_limit integer default 20, p_offset integer default 0)
returns table (id uuid, full_name text, email text, phone text, role text, is_locked boolean, created_at timestamptz, total bigint)
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
    select p.id, p.full_name, u.email::text, p.phone, p.role, p.is_locked, p.created_at, count(*) over ()
    from profiles p
    join auth.users u on u.id = p.id
    where (p_role is null or p.role = p_role)
      and (nullif(trim(coalesce(p_q, '')), '') is null
           or strpos(vn_unaccent(p.full_name), vn_unaccent(trim(p_q))) > 0
           or strpos(lower(u.email::text), lower(trim(p_q))) > 0
           or strpos(p.phone, trim(p_q)) > 0)
    order by p.created_at desc, p.id
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_set_user_lock(p_user_id uuid, p_locked boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target profiles%rowtype;
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
  update profiles set is_locked = coalesce(p_locked, false) where id = p_user_id;
  return jsonb_build_object('id', p_user_id, 'full_name', v_target.full_name, 'role', v_target.role, 'is_locked', coalesce(p_locked, false));
end;
$$;

-- ---------------------------------------------------------------------
-- PB21 - Thống kê của chủ sân theo ngày chơi, chỉ tính lượt đã xác nhận thanh toán.
-- p_venue_id null: gộp mọi sân của chủ sân.
-- ---------------------------------------------------------------------
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
                  'count', (select count(distinct booking_id) from ok_items o where o.booking_date = d.day),
                  'slots', (select count(*) from ok_items o where o.booking_date = d.day),
                  'revenue', (select coalesce(sum(price), 0) from ok_items o where o.booking_date = d.day)
                ) order by d.day), '[]'::jsonb) from days d),
    'top_slots', (select coalesce(jsonb_agg(t order by t.count desc, t.start_time), '[]'::jsonb)
                  from (select to_char(start_time, 'HH24:MI') as start_time, count(*)::int as count
                        from ok_items group by start_time order by count(*) desc, start_time limit 5) t)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- PB22 - Thống kê toàn hệ thống cho quản trị viên
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if my_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Chức năng chỉ dành cho quản trị viên';
  end if;
  return jsonb_build_object(
    'users', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select role, count(*)::int n from profiles group by role) t),
    'locked_users', (select count(*)::int from profiles where is_locked),
    'venues', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*)::int n from venues group by status) t),
    'bookings', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*)::int n from bookings group by status) t),
    'bookings_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'count', m.total, 'confirmed', m.confirmed) order by m.month), '[]'::jsonb)
      from (
        select to_char(g.month, 'YYYY-MM') as month,
               (select count(*)::int from bookings b where date_trunc('month', b.created_at at time zone 'Asia/Ho_Chi_Minh') = g.month) as total,
               (select count(*)::int from bookings b where b.status = 'confirmed' and date_trunc('month', b.created_at at time zone 'Asia/Ho_Chi_Minh') = g.month) as confirmed
        from generate_series(date_trunc('month', vn_now()) - interval '5 months', date_trunc('month', vn_now()), interval '1 month') as g(month)
      ) m),
    'ai_questions_today', (select count(*)::int from ai_chat_logs where (created_at at time zone 'Asia/Ho_Chi_Minh')::date = vn_now()::date)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- PB23..PB26 - Nhật ký và giới hạn lượt hỏi của trợ lý AI.
-- ai_begin ghi nhận câu hỏi trước khi máy chủ gọi Gemini (để tính lượt), trả về ngữ cảnh của phiên.
-- ---------------------------------------------------------------------
create index if not exists ai_chat_logs_user_day_idx on public.ai_chat_logs (user_id, created_at);
create index if not exists ai_chat_logs_session_idx on public.ai_chat_logs (session_id, id);

create or replace function public.ai_begin(p_session_id uuid, p_question text, p_daily_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_used integer;
  v_id bigint;
  v_question text := left(trim(coalesce(p_question, '')), 300);
begin
  if v_uid is null or my_role() is null then
    raise exception 'UNAUTHENTICATED' using detail = 'Bạn cần đăng nhập để dùng trợ lý AI';
  end if;
  if p_session_id is null or v_question = '' then
    raise exception 'INVALID_INPUT' using detail = 'Hãy nhập câu hỏi';
  end if;
  -- Khóa theo người dùng để hai yêu cầu cùng lúc không vượt giới hạn
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  select count(*) into v_used from ai_chat_logs
  where user_id = v_uid and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = vn_now()::date;
  if v_used >= greatest(coalesce(p_daily_limit, 20), 1) then
    raise exception 'RATE_LIMITED' using detail = 'Bạn đã dùng hết lượt hỏi trợ lý AI trong hôm nay';
  end if;
  insert into ai_chat_logs (user_id, session_id, question, status) values (v_uid, p_session_id, v_question, 'error')
  returning id into v_id;
  return jsonb_build_object(
    'id', v_id,
    'used', v_used + 1,
    -- Bộ lọc của lượt gần nhất trong cùng phiên: cơ sở để hiểu câu hỏi nối tiếp
    'last_filter', (select l.parsed_filter from ai_chat_logs l
                    where l.user_id = v_uid and l.session_id = p_session_id and l.id < v_id and l.status = 'ok' and l.parsed_filter is not null
                    order by l.id desc limit 1),
    'history', (select coalesce(jsonb_agg(h.question order by h.id), '[]'::jsonb)
                from (select l.id, l.question from ai_chat_logs l
                      where l.user_id = v_uid and l.session_id = p_session_id and l.id < v_id
                      order by l.id desc limit 4) h)
  );
end;
$$;

create or replace function public.ai_finish(p_id bigint, p_filter jsonb, p_result_count integer, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ai_chat_logs set parsed_filter = p_filter, result_count = p_result_count, status = p_status
  where id = p_id and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- PB27 - Người dùng tự xóa tài khoản. Dữ liệu cá nhân bị xóa; lượt đặt cũ còn lại ở dạng ẩn danh.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = 'Bạn cần đăng nhập';
  end if;
  select role into v_role from profiles where id = v_uid;
  if v_role is null then
    raise exception 'NOT_FOUND' using detail = 'Không tìm thấy tài khoản';
  end if;
  if v_role = 'admin' then
    raise exception 'FORBIDDEN' using detail = 'Tài khoản quản trị viên không tự xóa được';
  end if;

  perform expire_holds();
  -- Còn lượt đặt chưa diễn ra thì phải hủy trước
  if exists (
    select 1 from bookings b
    where b.status in ('holding', 'awaiting_confirmation', 'confirmed')
      and (b.player_id = v_uid or b.venue_id in (select id from venues where owner_id = v_uid))
      and exists (select 1 from booking_items bi where bi.booking_id = b.id and bi.booking_date + bi.start_time + interval '1 hour' > vn_now())
  ) then
    raise exception 'INVALID_STATE' using detail = case when v_role = 'owner'
      then 'Sân của bạn còn lượt đặt chưa diễn ra. Hãy hủy hoặc chờ các lượt đó kết thúc trước khi xóa tài khoản'
      else 'Bạn còn lượt đặt chưa diễn ra. Hãy hủy các lượt đó trước khi xóa tài khoản' end;
  end if;

  if v_role = 'owner' then
    perform set_config('app.system_update', '1', true);
    -- Sân chưa từng có lượt đặt: xóa hẳn. Sân đã có lịch sử: ẩn và xóa thông tin liên hệ, tài khoản nhận tiền.
    delete from venues v where v.owner_id = v_uid and not exists (select 1 from bookings b where b.venue_id = v.id);
    update venues set status = 'hidden', reject_reason = 'Chủ sân đã xóa tài khoản', contact_phone = null,
                      bank_name = '-', bank_account_number = '-', bank_account_name = '-'
    where owner_id = v_uid;
  end if;

  -- Xóa tài khoản đăng nhập; hồ sơ bị xóa theo (on delete cascade),
  -- bookings.player_id, venues.owner_id, ai_chat_logs.user_id tự thành null (on delete set null)
  delete from auth.users where id = v_uid;
  perform set_config('app.system_update', '', true);
end;
$$;

-- Quyền gọi hàm
revoke execute on function public.admin_review_venue(bigint, text, text), public.admin_list_users(text, text, integer, integer),
  public.admin_set_user_lock(uuid, boolean), public.owner_stats(bigint, date, date), public.admin_stats(),
  public.ai_begin(uuid, text, integer), public.ai_finish(bigint, jsonb, integer, text), public.delete_my_account() from public, anon;
grant execute on function public.admin_review_venue(bigint, text, text), public.admin_list_users(text, text, integer, integer),
  public.admin_set_user_lock(uuid, boolean), public.owner_stats(bigint, date, date), public.admin_stats(),
  public.ai_begin(uuid, text, integer), public.ai_finish(bigint, jsonb, integer, text), public.delete_my_account() to authenticated;
