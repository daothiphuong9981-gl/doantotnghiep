-- =====================================================================
-- DỮ LIỆU ẢO để demo và kiểm thử: tài khoản người chơi, chủ sân và lịch sử đặt sân.
-- KHÔNG dùng trên bản chính thức có người dùng thật.
--
-- Chạy: Supabase > SQL Editor > dán toàn bộ file > Run. Chạy SAU import_san_khao_sat.sql.
-- Chạy lại nhiều lần được: tài khoản đã có thì bỏ qua; lượt đặt chỉ sinh một lần.
--
-- Tạo ra:
--   * 30 người chơi: member1@gmail.com ... member30@gmail.com
--   * 1 chủ sân cho mỗi sân CHƯA có chủ: <tên sân viết liền không dấu>@gmail.com
--     (bỏ phần trong ngoặc, ví dụ "Sân cầu lông Bưu Điện" -> sancaulongbuudien@gmail.com).
--     Sân đã có chủ (ví dụ Icon Badminton) giữ nguyên.
--   * Mật khẩu mọi tài khoản: 12345678. Email đánh dấu đã xác nhận, đăng nhập được ngay.
--   * Tài khoản ngân hàng của các sân được gán chủ: "Ngân hàng DEMO (dữ liệu ảo)", số tài khoản giả.
--   * Lượt đặt từ 30 ngày trước đến 6 ngày tới: phần lớn đã xác nhận, một số đã hủy, hết hạn
--     giữ chỗ hoặc đang chờ chủ sân xác nhận. Trang thống kê sẽ có số liệu.
--
-- Lưu ý: các địa chỉ @gmail.com có thể là hộp thư thật của người khác. Chèn bằng SQL không gửi
-- email, nhưng đừng bấm "Quên mật khẩu" hay gửi lời mời cho các tài khoản này.
-- =====================================================================

-- Không sinh thông báo cho hàng nghìn lượt đặt ảo (xem 0006_notifications.sql)
select set_config('app.skip_notifications', '1', false);

-- ---------------------------------------------------------------------
-- 1. Hàm tạm: tạo một tài khoản đăng nhập bằng email + mật khẩu (giống khi đăng ký qua website)
-- ---------------------------------------------------------------------
create or replace function pg_temp.demo_user(p_email text, p_full_name text, p_phone text, p_role text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is not null then
    return v_id;  -- đã có: giữ nguyên, không đổi mật khẩu
  end if;
  v_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', lower(p_email),
          extensions.crypt('12345678', extensions.gen_salt('bf')), now(),
          '{"provider": "email", "providers": ["email"]}',
          jsonb_build_object('full_name', p_full_name, 'phone', p_phone, 'role', p_role),
          now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', lower(p_email), 'email_verified', true),
          'email', now(), now(), now());
  -- Hồ sơ (profiles) do trigger on_auth_user_created tự tạo từ raw_user_meta_data
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Người chơi
-- ---------------------------------------------------------------------
do $$
declare
  v_names text[] := array[
    'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Phạm Thị Dung', 'Hoàng Minh Đức',
    'Võ Thị Hà', 'Đặng Quốc Huy', 'Bùi Thị Hương', 'Đỗ Văn Khánh', 'Ngô Thị Lan',
    'Dương Văn Long', 'Lý Thị Mai', 'Huỳnh Văn Nam', 'Phan Thị Ngọc', 'Trương Văn Phúc',
    'Mai Thị Quỳnh', 'Đinh Văn Sơn', 'Tô Thị Thảo', 'Lâm Văn Thắng', 'Châu Thị Trang',
    'Hồ Văn Trung', 'Tạ Thị Uyên', 'Lương Văn Vinh', 'Kiều Thị Xuân', 'Văn Đình Yên',
    'Nguyễn Thị Ánh', 'Trần Văn Bảo', 'Lê Thị Chi', 'Phạm Văn Duy', 'Hoàng Thị Giang'];
begin
  for i in 1..30 loop
    perform pg_temp.demo_user('member' || i || '@gmail.com', v_names[i], '0900' || lpad(i::text, 6, '0'), 'player');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Chủ sân: mỗi sân chưa có chủ một tài khoản, gán làm chủ và điền tài khoản ngân hàng giả
-- ---------------------------------------------------------------------
do $$
declare
  v_venue record;
  v_short text;
  v_local text;
  v_owner uuid;
begin
  for v_venue in select id, name from public.venues where owner_id is null and status = 'approved' order by id loop
    v_short := trim(regexp_replace(v_venue.name, '\s*\(.*\)\s*', ' ', 'g'));
    v_local := left(regexp_replace(public.vn_unaccent(v_short), '[^a-z0-9]', '', 'g'), 60);
    -- Hai sân trùng tên viết liền: thêm mã sân cho khỏi trùng email
    if exists (select 1 from auth.users u where lower(u.email) = v_local || '@gmail.com'
               and exists (select 1 from public.venues x where x.owner_id = u.id and x.id <> v_venue.id)) then
      v_local := v_local || v_venue.id;
    end if;
    v_owner := pg_temp.demo_user(v_local || '@gmail.com', 'Chủ ' || v_short, '0911' || lpad(v_venue.id::text, 6, '0'), 'owner');
    if (select role from public.profiles where id = v_owner) <> 'owner' then
      raise notice 'Bỏ qua %: email % đã thuộc một tài khoản không phải chủ sân', v_venue.name, v_local || '@gmail.com';
      continue;
    end if;
    update public.venues
       set owner_id = v_owner,
           bank_name = case when bank_name = 'Chưa cập nhật' then 'Ngân hàng DEMO (dữ liệu ảo)' else bank_name end,
           bank_account_number = case when bank_account_number = 'Chưa cập nhật' then '9999' || lpad(id::text, 6, '0') else bank_account_number end,
           bank_account_name = case when bank_account_name = 'Chưa cập nhật' then upper(public.vn_unaccent('Chủ ' || v_short)) else bank_account_name end
     where id = v_venue.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Lịch sử đặt sân (chỉ sinh khi người chơi demo chưa có lượt đặt nào)
-- ---------------------------------------------------------------------
do $$
declare
  v_players uuid[];
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_now_vn timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  v_venue record;
  v_day date;
  v_court bigint;
  v_hour int;
  v_len int;
  v_player uuid;
  v_status text;
  v_start timestamp;
  v_created timestamp;
  v_price int;
  v_total int;
  v_booking bigint;
  v_code text;
  v_r float;
  v_made int := 0;
begin
  select array_agg(p.id order by u.email) into v_players
  from auth.users u join public.profiles p on p.id = u.id
  where u.email like 'member%@gmail.com';
  if v_players is null then
    raise exception 'Chưa có tài khoản member*@gmail.com';
  end if;
  if exists (select 1 from public.bookings where player_id = any (v_players)) then
    raise notice 'Người chơi demo đã có lượt đặt: bỏ qua bước sinh lịch sử đặt sân.';
    return;
  end if;

  perform setseed(0.2026);
  for v_venue in
    select v.id, v.open_time, v.close_time, v.hold_minutes from public.venues v
    where v.status = 'approved' and v.owner_id is not null order by v.id
  loop
    for v_day in select generate_series(v_today - 30, v_today + 6, interval '1 day')::date loop
      -- 0 đến 3 lượt mỗi ngày, cuối tuần đông hơn
      for n in 1..(floor(random() * (case when extract(isodow from v_day) >= 6 then 4 else 3 end)))::int loop
        select c.id into v_court from public.courts c where c.venue_id = v_venue.id and c.is_active order by random() limit 1;
        -- Giờ cao điểm 17h–20h hay được đặt hơn
        v_hour := case when random() < 0.55 then 17 + floor(random() * 4)::int
                       else extract(hour from v_venue.open_time)::int + floor(random() * 11)::int end;
        v_len := case when random() < 0.6 then 1 else 2 end;
        if v_hour + v_len > extract(hour from v_venue.close_time) then
          continue;
        end if;
        v_start := v_day + make_time(v_hour, 0, 0);
        -- Khung giờ đã có người giữ thì bỏ qua (giống chỉ mục chống trùng lịch)
        if exists (select 1 from public.booking_items bi
                   where bi.court_id = v_court and bi.booking_date = v_day and bi.is_active
                     and extract(hour from bi.start_time) between v_hour and v_hour + v_len - 1) then
          continue;
        end if;

        v_r := random();
        if v_start < v_now_vn then
          v_status := case when v_r < 0.85 then 'confirmed' when v_r < 0.95 then 'cancelled' else 'expired' end;
        else
          v_status := case when v_r < 0.65 then 'confirmed' when v_r < 0.85 then 'awaiting_confirmation' else 'cancelled' end;
        end if;
        v_created := least(v_start - make_interval(hours => 2 + floor(random() * 70)::int), v_now_vn - interval '30 minutes');
        v_player := v_players[1 + floor(random() * array_length(v_players, 1))::int];

        insert into public.bookings (venue_id, player_id, total_amount, status, hold_expires_at, paid_reported_at,
                                     transfer_note, confirmed_at, cancel_reason, cancelled_by, created_at)
        values (v_venue.id, v_player, 0, v_status,
                (v_created + make_interval(mins => v_venue.hold_minutes)) at time zone 'Asia/Ho_Chi_Minh',
                case when v_status in ('confirmed', 'awaiting_confirmation') then (v_created + interval '8 minutes') at time zone 'Asia/Ho_Chi_Minh' end,
                null,
                case when v_status = 'confirmed' then (v_created + interval '50 minutes') at time zone 'Asia/Ho_Chi_Minh' end,
                case when v_status = 'cancelled' then 'Bận việc đột xuất, xin hủy' end,
                case when v_status = 'cancelled' then v_player end,
                v_created at time zone 'Asia/Ho_Chi_Minh')
        returning id, code into v_booking, v_code;

        v_total := 0;
        for h in v_hour..(v_hour + v_len - 1) loop
          -- Giá theo bảng giá của sân; cuối tuần không khai giá thì lấy giá ngày thường
          select p.price into v_price from public.price_slots p
          where p.venue_id = v_venue.id
            and p.day_type = case when extract(isodow from v_day) >= 6 then 'weekend' else 'weekday' end
            and p.start_time <= make_time(h, 0, 0) and make_time(h, 0, 0) < p.end_time;
          if v_price is null then
            select p.price into v_price from public.price_slots p
            where p.venue_id = v_venue.id and p.day_type = 'weekday'
              and p.start_time <= make_time(h, 0, 0) and make_time(h, 0, 0) < p.end_time;
          end if;
          insert into public.booking_items (booking_id, court_id, booking_date, start_time, price, is_active)
          values (v_booking, v_court, v_day, make_time(h, 0, 0), coalesce(v_price, 0),
                  v_status in ('confirmed', 'awaiting_confirmation'));
          v_total := v_total + coalesce(v_price, 0);
          v_price := null;
        end loop;
        update public.bookings
           set total_amount = v_total,
               transfer_note = case when paid_reported_at is not null then v_code end
         where id = v_booking;
        v_made := v_made + 1;
      end loop;
    end loop;
  end loop;
  raise notice 'Đã sinh % lượt đặt sân.', v_made;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Kiểm tra nhanh
-- ---------------------------------------------------------------------
select set_config('app.skip_notifications', '', false);

select
  (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.email like 'member%@gmail.com') as nguoi_choi_demo,
  (select count(distinct owner_id) from public.venues where owner_id is not null) as chu_san,
  (select count(*) from public.venues where status = 'approved' and owner_id is null) as san_chua_co_chu,
  (select count(*) from public.bookings) as luot_dat,
  (select count(*) from public.bookings where status = 'confirmed') as da_xac_nhan,
  (select count(*) from public.bookings where status = 'awaiting_confirmation') as cho_xac_nhan;

-- Danh sách email chủ sân để đăng nhập thử
select v.id, v.name as san, u.email as email_chu_san
from public.venues v join auth.users u on u.id = v.owner_id
order by v.id;
