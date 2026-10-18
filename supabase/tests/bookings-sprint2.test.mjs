// Kiểm thử cơ sở dữ liệu Sprint 2: đặt nhiều sân con, giữ chỗ có thời hạn, thanh toán, xác nhận, hủy, tìm kiếm.
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import fs from 'fs';

const db = new PGlite({ extensions: { postgis } });
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
await db.exec(`
create schema auth; create schema storage;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema public, auth, storage to anon, authenticated;
`);
await db.exec(read('../migrations/0001_init.sql'));
await db.exec(read('../seed.sql'));
await db.exec(read('../migrations/0002_bookings.sql'));
await db.exec(read('../migrations/0004_venue_rules.sql'));

const q = async (sql, p) => (await db.query(sql, p)).rows;
const as = async (uid, role, fn) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
let passed = 0;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, extra); if (cond) passed += 1; else process.exitCode = 1; };
const rejects = async (label, code, fn) => {
  try { await fn(); ok(label, false, '(không bị từ chối)'); }
  catch (e) { ok(label, e.message === code, e.message === code ? '' : `(nhận: ${e.message})`); }
};

const mk = async (email, meta) => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(meta)]))[0].id;
const p1 = await mk('p1@x', { full_name: 'Người chơi 1', phone: '0900000001', role: 'player' });
const p2 = await mk('p2@x', { full_name: 'Người chơi 2', phone: '0900000002', role: 'player' });
const ownerA = await mk('a@x', { full_name: 'Chủ sân A', phone: '0900000003', role: 'owner' });
const ownerB = await mk('b@x', { full_name: 'Chủ sân B', phone: '0900000004', role: 'owner' });

const mkVenue = async (owner, name, address, ward, lat, lng, hold) => {
  const id = (await q(`insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, hold_minutes, bank_name, bank_account_number, bank_account_name, status)
    values ($1, $2, $3, $4, $5, $6, '05:00', '22:00', $7, 'NH', '123456', 'TEN', 'pending') returning id`, [owner, ward, name, address, lat, lng, hold]))[0].id;
  await db.exec(`update venues set status = 'approved' where id = ${id}`);
  return id;
};
const vA = await mkVenue(ownerA, 'Sân cầu lông Hải Châu', '12 Lê Duẩn', 1, 16.068, 108.224, 10);
const vB = await mkVenue(ownerB, 'Sân Sơn Trà', '5 Ngô Quyền', 7, 16.07, 108.24, 15);
await db.exec(`
insert into courts (venue_id, name) values (${vA}, 'Sân 1'), (${vA}, 'Sân 2'), (${vB}, 'Sân 1');
insert into price_slots (venue_id, day_type, start_time, end_time, price) values
  (${vA}, 'weekday', '05:00', '17:00', 50000), (${vA}, 'weekday', '17:00', '22:00', 80000), (${vA}, 'weekend', '05:00', '22:00', 90000),
  (${vB}, 'weekday', '05:00', '22:00', 120000);`);
const [cA1, cA2] = (await q(`select id from courts where venue_id = ${vA} order by id`)).map((r) => r.id);
const cB1 = (await q(`select id from courts where venue_id = ${vB}`))[0].id;

// Chọn một ngày thường và một ngày cuối tuần trong 14 ngày tới (theo giờ Việt Nam)
const days = await q(`select d::date::text d, extract(dow from d)::int dow from generate_series(vn_now()::date + 1, vn_now()::date + 7, interval '1 day') d`);
const weekday = days.find((x) => x.dow >= 1 && x.dow <= 5).d;
const weekend = days.find((x) => x.dow === 0 || x.dow === 6).d;
const in8days = (await q(`select (vn_now()::date + 8)::text d`))[0].d;
const book = (uid, venue, items) => as(uid, 'authenticated', async () => (await q(`select create_booking($1, $2::jsonb) r`, [venue, JSON.stringify(items)]))[0].r);
const item = (court, date, time) => ({ court_id: court, booking_date: date, start_time: time });
const booking = async (id) => (await q(`select * from bookings where id = $1`, [id]))[0];

// --- PB14, PB15: một lượt nhiều sân con, nhiều khung giờ ---
const b1 = await book(p1, vA, [item(cA1, weekday, '18:00'), item(cA1, weekday, '19:00'), item(cA2, weekday, '18:00'), item(cA2, weekend, '06:00')]);
const r1 = await booking(b1.id);
ok('một lượt đặt gồm 2 sân con, 4 khung giờ', (await q(`select count(*)::int n from booking_items where booking_id = $1 and is_active`, [b1.id]))[0].n === 4);
ok('tổng tiền theo bảng giá (ngày thường 80k x3 + cuối tuần 90k)', r1.total_amount === 330000, String(r1.total_amount));
ok('mã lượt đặt dạng DSxxxx', /^DS\d{4,}$/.test(r1.code), r1.code);
const holdMin = (await q(`select round(extract(epoch from (hold_expires_at - created_at)) / 60)::int m from bookings where id = $1`, [b1.id]))[0].m;
ok('hạn giữ chỗ = thời gian chủ sân thiết lập (10 phút)', r1.status === 'holding' && holdMin === 10, `${holdMin} phút`);

await rejects('người khác đặt trùng khung giờ đang giữ -> SLOT_TAKEN', 'SLOT_TAKEN', () => book(p2, vA, [item(cA1, weekday, '19:00'), item(cA1, weekday, '20:00')]));
ok('lượt bị từ chối không để lại dữ liệu', (await q(`select count(*)::int n from bookings where player_id = $1`, [p2]))[0].n === 0);
await rejects('khách chưa đăng nhập', 'UNAUTHENTICATED', () => as(null, 'authenticated', () => q(`select create_booking(${vA}, '[]'::jsonb)`)));
await rejects('chủ sân không đặt được sân', 'FORBIDDEN', () => book(ownerB, vA, [item(cA1, weekday, '10:00')]));
await rejects('danh sách rỗng', 'INVALID_INPUT', () => book(p2, vA, []));
await rejects('sân con của cơ sở khác', 'INVALID_INPUT', () => book(p2, vA, [item(cB1, weekday, '10:00')]));
await rejects('ngoài giờ mở cửa', 'INVALID_INPUT', () => book(p2, vA, [item(cA1, weekday, '22:00')]));
await rejects('giờ lẻ 18:30', 'INVALID_INPUT', () => book(p2, vA, [item(cA1, weekday, '18:30')]));
await rejects('ngày đã qua', 'INVALID_INPUT', () => book(p2, vA, [item(cA1, '2020-01-01', '10:00')]));
await rejects('quá số ngày đặt trước của sân (mặc định 7)', 'INVALID_INPUT', () => book(p2, vA, [item(cA1, in8days, '10:00')]));
await rejects('chọn trùng một khung giờ hai lần', 'INVALID_INPUT', () => book(p2, vA, [item(cA1, weekday, '10:00'), item(cA1, weekday, '10:00')]));
await rejects('dữ liệu sai định dạng', 'INVALID_INPUT', () => book(p2, vA, [{ court_id: 'x', booking_date: 'y', start_time: 'z' }]));
await rejects('sân không tồn tại', 'NOT_FOUND', () => book(p2, 99999, [item(cA1, weekday, '10:00')]));
await rejects('ghi thẳng vào bảng bookings bị chặn', 'permission denied for table bookings', () => as(p2, 'authenticated', () => db.exec(`insert into bookings (code, venue_id, player_id, total_amount, hold_expires_at) values ('X', ${vA}, '${p2}', 0, now())`)));

// --- Khung giờ đang giữ hiển thị là held ---
const taken = await as(null, 'anon', () => q(`select court_id, start_time::text t, state from venue_taken_slots($1, $2) order by 1, 2`, [vA, weekday]));
ok('3 khung giờ ngày thường hiển thị đang giữ', taken.length === 3 && taken.every((t) => t.state === 'held'));

// --- Hết giờ không thanh toán: coi như chưa ai đặt ---
await db.exec(`update bookings set hold_expires_at = now() - interval '1 second' where id = ${b1.id}`);
ok('hết hạn: khung giờ không còn bị giữ (chưa cần chạy dọn dẹp)', (await as(null, 'anon', () => q(`select 1 from venue_taken_slots($1, $2)`, [vA, weekday]))).length === 0);
const b2 = await book(p2, vA, [item(cA1, weekday, '19:00')]);
ok('người khác đặt được khung giờ vừa hết hạn giữ', (await booking(b2.id)).status === 'holding');
ok('lượt cũ chuyển sang expired, các dòng chi tiết hết hiệu lực', (await booking(b1.id)).status === 'expired' && (await q(`select count(*)::int n from booking_items where booking_id = $1 and is_active`, [b1.id]))[0].n === 0);
const late = await as(p1, 'authenticated', async () => (await q(`select report_payment($1, 'ck') r`, [b1.id]))[0].r).catch((e) => e.message);
ok('báo thanh toán sau khi hết hạn bị từ chối', late === 'INVALID_STATE', String(late));

// expire_holds chạy định kỳ
const b3 = await book(p1, vA, [item(cA2, weekday, '07:00')]);
await db.exec(`update bookings set hold_expires_at = now() - interval '1 second' where id = ${b3.id}`);
const n = (await q(`select expire_holds() n`))[0].n;
ok('expire_holds trả số lượt vừa giải phóng', n === 1 && (await booking(b3.id)).status === 'expired', `n=${n}`);
const b3b = await book(p1, vA, [item(cA2, weekday, '08:00')]);
await db.exec(`update bookings set hold_expires_at = now() - interval '1 second' where id = ${b3b.id}`);
const lateStatus = await as(p1, 'authenticated', async () => (await q(`select report_payment($1, null) r`, [b3b.id]))[0].r);
ok('báo thanh toán đúng lúc vừa quá hạn -> trả về expired và nhả sân', lateStatus === 'expired' && (await booking(b3b.id)).status === 'expired');

// --- PB18: báo đã chuyển khoản ---
await rejects('người khác báo thanh toán hộ', 'NOT_FOUND', () => as(p1, 'authenticated', () => q(`select report_payment($1, 'x')`, [b2.id])));
const st = await as(p2, 'authenticated', async () => (await q(`select report_payment($1, '  DS chuyen khoan  ') r`, [b2.id]))[0].r);
const r2 = await booking(b2.id);
ok('báo thanh toán trong hạn -> chờ xác nhận', st === 'awaiting_confirmation' && r2.paid_reported_at && r2.transfer_note === 'DS chuyen khoan');
await db.exec(`update bookings set hold_expires_at = now() - interval '1 hour' where id = ${b2.id}`);
await db.exec(`select expire_holds()`);
ok('đã báo thanh toán thì không bị hết hạn, sân vẫn được giữ', (await booking(b2.id)).status === 'awaiting_confirmation');
await rejects('khung giờ chờ xác nhận không đặt được', 'SLOT_TAKEN', () => book(p1, vA, [item(cA1, weekday, '19:00')]));
await rejects('báo thanh toán lần hai', 'INVALID_STATE', () => as(p2, 'authenticated', () => q(`select report_payment($1, 'x')`, [b2.id])));

// --- PB16: chủ sân xác nhận thủ công ---
await rejects('chủ sân khác xác nhận', 'FORBIDDEN', () => as(ownerB, 'authenticated', () => q(`select confirm_payment($1)`, [b2.id])));
await rejects('người chơi tự xác nhận', 'FORBIDDEN', () => as(p2, 'authenticated', () => q(`select confirm_payment($1)`, [b2.id])));
await as(ownerA, 'authenticated', () => q(`select confirm_payment($1)`, [b2.id]));
ok('chủ sân xác nhận -> confirmed', (await booking(b2.id)).status === 'confirmed' && (await booking(b2.id)).confirmed_at);
await rejects('xác nhận lần hai', 'INVALID_STATE', () => as(ownerA, 'authenticated', () => q(`select confirm_payment($1)`, [b2.id])));
const b4 = await book(p1, vA, [item(cA2, weekday, '09:00')]);
await rejects('xác nhận lượt chưa báo thanh toán', 'INVALID_STATE', () => as(ownerA, 'authenticated', () => q(`select confirm_payment($1)`, [b4.id])));
ok('sau khi xác nhận khung giờ hiển thị đã đặt', (await as(null, 'anon', () => q(`select state from venue_taken_slots($1, $2) where court_id = $3 and start_time = '19:00'`, [vA, weekday, cA1])))[0]?.state === 'booked');

// --- PB16, PB17: hủy ---
await rejects('người chơi khác hủy', 'FORBIDDEN', () => as(p2, 'authenticated', () => q(`select cancel_booking($1, null)`, [b4.id])));
await as(p1, 'authenticated', () => q(`select cancel_booking($1, null)`, [b4.id]));
ok('người chơi hủy giữ chỗ -> cancelled, khung giờ trống lại', (await booking(b4.id)).status === 'cancelled' && (await as(null, 'anon', () => q(`select 1 from venue_taken_slots($1, $2) where court_id = $3 and start_time = '09:00'`, [vA, weekday, cA2]))).length === 0);
await rejects('hủy lượt đã hủy', 'INVALID_STATE', () => as(p1, 'authenticated', () => q(`select cancel_booking($1, null)`, [b4.id])));
const b5 = await book(p1, vA, [item(cA2, weekday, '10:00')]);
await as(p1, 'authenticated', () => q(`select report_payment($1, null)`, [b5.id]));
await rejects('chủ sân từ chối mà không nêu lý do', 'INVALID_INPUT', () => as(ownerA, 'authenticated', () => q(`select cancel_booking($1, '  ')`, [b5.id])));
await as(ownerA, 'authenticated', () => q(`select cancel_booking($1, 'Chưa nhận được tiền')`, [b5.id]));
const r5 = await booking(b5.id);
ok('chủ sân từ chối kèm lý do', r5.status === 'cancelled' && r5.cancel_reason === 'Chưa nhận được tiền' && r5.cancelled_by === ownerA);
await as(p2, 'authenticated', () => q(`select cancel_booking($1, 'Bận việc')`, [b2.id]));
ok('người chơi hủy lượt đã xác nhận trước giờ chơi', (await booking(b2.id)).status === 'cancelled');

// --- Quy định riêng của từng sân ---
const defaults = (await q(`select max_slots_per_booking a, advance_days b, max_active_holds c from venues where id = ${vA}`))[0];
ok('mặc định: 20 khung giờ, đặt trước 7 ngày, 2 lượt giữ chỗ', defaults.a === 20 && defaults.b === 7 && defaults.c === 2);
await book(p2, vA, [item(cA1, weekday, '05:00')]); await book(p2, vA, [item(cA1, weekday, '06:00')]);
await rejects('lượt giữ chỗ thứ 3 cùng lúc tại một sân (mặc định 2)', 'INVALID_STATE', () => book(p2, vA, [item(cA1, weekday, '08:00')]));
const other = await book(p2, vB, [item(cB1, weekday, '06:00')]);
ok('giới hạn giữ chỗ tính riêng từng sân: vẫn giữ được ở sân khác', other.id > 0);
await as(ownerA, 'authenticated', () => db.exec(`update venues set max_active_holds = 3, max_slots_per_booking = 2, advance_days = 10 where id = ${vA}`));
ok('chủ sân nâng lên 3 lượt giữ chỗ -> đặt được lượt thứ 3', (await book(p2, vA, [item(cA1, weekday, '08:00')])).id > 0);
await db.exec(`update bookings set status = 'cancelled' where player_id = '${p2}' and status = 'holding'; update booking_items set is_active = false where booking_id in (select id from bookings where player_id = '${p2}' and status = 'cancelled')`);
await rejects('chủ sân đặt tối đa 2 khung giờ mỗi lượt -> 3 khung giờ bị từ chối', 'INVALID_INPUT', () => book(p2, vA, [item(cA2, weekday, '11:00'), item(cA2, weekday, '12:00'), item(cA2, weekday, '13:00')]));
ok('2 khung giờ thì được', (await book(p2, vA, [item(cA2, weekday, '11:00'), item(cA2, weekday, '12:00')])).id > 0);
ok('chủ sân cho đặt trước 10 ngày -> ngày thứ 8 đặt được', (await book(p2, vA, [item(cA1, in8days, '10:00')])).id > 0);
await rejects('ngoài khoảng 1-50 khung giờ', 'new row for relation "venues" violates check constraint "venues_max_slots_per_booking_check"', () => as(ownerA, 'authenticated', () => db.exec(`update venues set max_slots_per_booking = 0 where id = ${vA}`)));
await rejects('ngoài khoảng 1-30 ngày', 'new row for relation "venues" violates check constraint "venues_advance_days_check"', () => as(ownerA, 'authenticated', () => db.exec(`update venues set advance_days = 31 where id = ${vA}`)));
await rejects('ngoài khoảng 1-10 lượt giữ chỗ', 'new row for relation "venues" violates check constraint "venues_max_active_holds_check"', () => as(ownerA, 'authenticated', () => db.exec(`update venues set max_active_holds = 11 where id = ${vA}`)));
await rejects('chủ sân khác không sửa được quy định của sân A', 'x', async () => { await as(ownerB, 'authenticated', () => db.exec(`update venues set advance_days = 1 where id = ${vA}`)); if ((await q(`select advance_days d from venues where id = ${vA}`))[0].d === 10) throw new Error('x'); });
await db.exec(`update venues set max_active_holds = 10, max_slots_per_booking = 20 where id in (${vA}, ${vB})`);

// --- Quyền đọc ---
ok('người chơi chỉ thấy lượt của mình', (await as(p1, 'authenticated', () => q(`select player_id from booking_details`))).every((r) => r.player_id === p1));
ok('chủ sân A thấy mọi lượt của sân mình', (await as(ownerA, 'authenticated', () => q(`select id from booking_details`))).length === (await q(`select count(*)::int n from bookings where venue_id = ${vA}`))[0].n);
ok('chủ sân B không thấy lượt của sân A', (await as(ownerB, 'authenticated', () => q(`select venue_id from booking_details`))).every((r) => r.venue_id === vB));
const det = (await as(p1, 'authenticated', () => q(`select items, venue_name from booking_details where id = $1`, [b1.id])))[0];
ok('booking_details kèm dòng chi tiết và tên sân con', det.items.length === 4 && det.items.some((i) => i.court_name === 'Sân 1') && det.venue_name === 'Sân cầu lông Hải Châu');

ok('booking_exists: người đã đăng nhập biết lượt có tồn tại, khách thì không', (await as(p2, 'authenticated', () => q(`select booking_exists($1) e`, [b1.id])))[0].e === true && (await as(p2, 'authenticated', () => q(`select booking_exists(999999) e`)))[0].e === false);
await rejects('khách gọi booking_exists', 'permission denied for function booking_exists', () => as(null, 'anon', () => q(`select booking_exists($1)`, [b1.id])));

// --- PB12, PB13: tìm kiếm và lọc ---
const search = (args) => as(null, 'anon', () => q(`select id, name, min_price, free_courts from search_venues(${args})`));
ok('không tham số: mọi sân đã duyệt', (await search('')).length === 2);
ok('tìm không dấu "hai chau"', (await search(`p_q => 'hai chau'`)).map((r) => r.id).join() === String(vA));
ok('tìm có dấu, chữ hoa "SƠN TRÀ"', (await search(`p_q => 'SƠN TRÀ'`)).map((r) => r.id).join() === String(vB));
ok('tìm theo địa chỉ "ngo quyen"', (await search(`p_q => 'ngo quyen'`)).map((r) => r.id).join() === String(vB));
ok('từ khóa không khớp', (await search(`p_q => 'khongco'`)).length === 0);
ok('ký tự % không thành ký tự đại diện', (await search(`p_q => '%'`)).length === 0);
ok('lọc theo phường', (await search(`p_ward_id => 7::smallint`)).map((r) => r.id).join() === String(vB));
ok('lọc giá tối đa 60k', (await search(`p_max_price => 60000`)).map((r) => r.id).join() === String(vA));
ok('lọc giá từ 100k', (await search(`p_min_price => 100000`)).map((r) => r.id).join() === String(vB));
ok('lọc giá theo ngày cuối tuần dùng giá cuối tuần (sân A: 90k)', (await search(`p_max_price => 60000, p_date => '${weekend}'`)).length === 0 && (await search(`p_max_price => 95000, p_date => '${weekend}'`)).map((r) => r.id).join() === String(vA));
ok('lọc giá theo đúng khung giờ (sân A ngày thường 18:00 = 80k)', (await search(`p_max_price => 60000, p_date => '${weekday}', p_start_time => '18:00'`)).length === 0 && (await search(`p_max_price => 60000, p_date => '${weekday}', p_start_time => '10:00'`)).map((r) => r.id).join() === String(vA));
ok('sân không khai giá cuối tuần thì dùng giá ngày thường (sân B: 120k)', (await search(`p_min_price => 100000, p_date => '${weekend}', p_start_time => '10:00'`)).map((r) => r.id).join() === String(vB));
ok('kết hợp từ khóa + phường không khớp', (await search(`p_q => 'hai chau', p_ward_id => 7::smallint`)).length === 0);
// Khóa hết sân con của B ở 18:00 -> lọc theo khung giờ loại B
const bB = await book(p1, vB, [item(cB1, weekday, '18:00')]);
const free = await search(`p_date => '${weekday}', p_start_time => '18:00'`);
ok('lọc khung giờ: bỏ sân đã kín, đếm sân con còn trống', free.length === 1 && free[0].id === vA && Number(free[0].free_courts) === 2, JSON.stringify(free));
await db.exec(`update bookings set hold_expires_at = now() - interval '1 second' where id = ${bB.id}`);
ok('giữ chỗ hết hạn thì sân lại xuất hiện khi lọc khung giờ', (await search(`p_date => '${weekday}', p_start_time => '18:00'`)).length === 2);
ok('lọc ngày vượt số ngày đặt trước của sân: sân đó không xuất hiện', (await search(`p_date => '${in8days}', p_start_time => '18:00'`)).map((r) => r.id).join() === String(vA));
ok('khung giờ ngoài giờ mở cửa: không sân nào', (await search(`p_date => '${weekday}', p_start_time => '23:00'`)).length === 0);
const nearby = await as(null, 'anon', () => q(`select id, distance_km from search_venues(p_lat => 16.068, p_lng => 108.224, p_radius_km => 1)`));
ok('lọc theo bán kính 1 km', nearby.length === 1 && nearby[0].id === vA && nearby[0].distance_km < 0.1);
await db.exec(`update venues set status = 'suspended' where id = ${vB}`);
ok('sân tạm ngừng không xuất hiện khi tìm', (await search('')).length === 1);

console.log(process.exitCode ? '\nCÓ LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
