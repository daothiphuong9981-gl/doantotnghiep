// Kiểm tra 0008_performance.sql (index, RLS viết lại) và 0009_security.sql (ẩn tài khoản ngân hàng, chặn tài khoản
// bị khóa, lượt đặt ở sân đã ẩn, chủ sân xem thông tin khách).
// Chạy: node supabase/tests/security-perf.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import fs from 'fs';

const db = new PGlite({ extensions: { postgis } });
const file = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const q = async (sql, p) => (await db.query(sql, p)).rows;
let passed = 0;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, extra); if (cond) passed += 1; else process.exitCode = 1; };
const as = async (uid, fn, role = 'authenticated') => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const errorOf = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

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
alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
await db.exec(file('../migrations/0001_init.sql'));
await db.exec(file('../seed.sql'));
for (const f of ['0002_bookings.sql', '0004_venue_rules.sql', '0005_admin_stats_ai.sql', '0006_notifications.sql', '0007_overdue_awaiting.sql']) await db.exec(file('../migrations/' + f));
// Giống Supabase thật: bảng mới mặc định cấp mọi quyền cho anon/authenticated. 0009 phải tự thu hồi được cột ngân hàng.
await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
await db.exec(file('../migrations/0008_performance.sql'));
await db.exec(file('../migrations/0009_security.sql'));

// ---------------------------------------------------------------- 0008: index
const idx = (await q(`select indexname from pg_indexes where schemaname = 'public'`)).map((r) => r.indexname);
for (const name of ['booking_items_booking_idx', 'bookings_player_created_idx', 'bookings_holding_expiry_idx', 'venue_images_venue_idx']) {
  ok(`0008: có index ${name}`, idx.includes(name));
}

// ---------------------------------------------------------------- Dữ liệu
const mk = async (email, role) => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
  [email, JSON.stringify({ full_name: email, phone: '0900' + email.length, role })]))[0].id;
const player = await mk('p@x', 'player');
const player2 = await mk('p2@x', 'player');
const expiredOnly = await mk('exp@x', 'player');
const owner = await mk('o@x', 'owner');
const owner2 = await mk('o2@x', 'owner');
const admin = await mk('a@x', 'player');
await db.exec(`update profiles set role = 'admin' where id = '${admin}'`);

const mkVenue = async (own, name) => (await q(`insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, bank_name, bank_account_number, bank_account_name, status)
  values ($1, 1, $2, '1 Đường A', 16.06, 108.22, '05:00', '22:00', 'Vietcombank', '0123456789', 'NGUYEN VAN A', 'approved') returning id`, [own, name]))[0].id;
const venue = await mkVenue(owner, 'Sân Một');
const venue2 = await mkVenue(owner2, 'Sân Hai');
for (const v of [venue, venue2]) {
  await db.exec(`insert into courts (venue_id, name) values (${v}, 'Sân 1'), (${v}, 'Sân 2');
                 insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${v}, 'weekday', '05:00', '22:00', 100000), (${v}, 'weekend', '05:00', '22:00', 100000);
                 insert into venue_images (venue_id, storage_path) values (${v}, '${v}/a.jpg');`);
}
const court = async (v) => (await q(`select id from courts where venue_id = $1 order by id limit 1`, [v]))[0].id;
const day = (await q(`select (current_date + 2)::text d`))[0].d;
const book = async (uid, v, time) => {
  const items = JSON.stringify([{ court_id: await court(v), booking_date: day, start_time: time }]);
  return (await as(uid, () => q(`select create_booking($1, $2::jsonb) r`, [v, items])))[0].r.id;
};

const b1 = await book(player, venue, '18:00');
const b2 = await book(player2, venue, '19:00');
const bx = await book(expiredOnly, venue, '20:00');
await db.exec(`update bookings set status = 'expired' where id = ${bx}; update booking_items set is_active = false where booking_id = ${bx};`);

// ---------------------------------------------------------------- 0009.1: cột ngân hàng
const anonBank = await errorOf(() => as(null, () => q(`select bank_account_number from venues`), 'anon'));
ok('khách (anon) không đọc được số tài khoản ngân hàng', anonBank !== null && /permission denied/i.test(anonBank), anonBank ?? '');
const anonName = await as(null, () => q(`select id, name, latitude from venues order by id`), 'anon');
ok('khách vẫn đọc được tên, tọa độ sân đã duyệt', anonName.length === 2 && anonName[0].name === 'Sân Một');
const playerBank = await errorOf(() => as(player2, () => q(`select bank_name from venues where id = $1`, [venue])));
ok('người chơi đăng nhập cũng không đọc trực tiếp được cột ngân hàng', playerBank !== null && /permission denied/i.test(playerBank));
const star = await errorOf(() => as(owner, () => q(`select * from venues where id = $1`, [venue])));
ok('select * trên venues bị chặn (ứng dụng phải liệt kê cột)', star !== null);

const pay = await as(player, () => q(`select * from booking_payment_info($1)`, [b1]));
ok('người đặt nhận thông tin chuyển khoản đúng số tiền, nội dung là mã lượt đặt',
  pay.length === 1 && pay[0].account_number === '0123456789' && pay[0].amount === 100000 && /^DS\d+$/.test(pay[0].content), JSON.stringify(pay[0]));
ok('người chơi khác không lấy được thông tin chuyển khoản lượt của người khác', (await as(player2, () => q(`select * from booking_payment_info($1)`, [b1]))).length === 0);
ok('chủ sân không lấy qua hàm của người chơi', (await as(owner, () => q(`select * from booking_payment_info($1)`, [b1]))).length === 0);
const anonPay = await errorOf(() => as(null, () => q(`select * from booking_payment_info($1)`, [b1]), 'anon'));
ok('khách không gọi được booking_payment_info', anonPay !== null);

ok('chủ sân đọc tài khoản nhận tiền sân mình', (await as(owner, () => q(`select * from venue_bank_info($1)`, [venue])))[0]?.bank_account_name === 'NGUYEN VAN A');
ok('chủ sân khác không đọc được', (await as(owner2, () => q(`select * from venue_bank_info($1)`, [venue]))).length === 0);
ok('người chơi không đọc được', (await as(player, () => q(`select * from venue_bank_info($1)`, [venue]))).length === 0);
ok('quản trị viên đọc được', (await as(admin, () => q(`select * from venue_bank_info($1)`, [venue]))).length === 1);

// Chủ sân vẫn cập nhật được tài khoản nhận tiền (quyền UPDATE không bị ảnh hưởng)
await as(owner, () => q(`update venues set bank_account_number = '999888777' where id = $1 returning id, status`, [venue]));
ok('chủ sân vẫn sửa được số tài khoản', (await q(`select bank_account_number from venues where id = $1`, [venue]))[0].bank_account_number === '999888777');
ok('thông tin chuyển khoản cập nhật theo', (await as(player, () => q(`select account_number from booking_payment_info($1)`, [b1])))[0]?.account_number === '999888777');

// ---------------------------------------------------------------- 0008: RLS viết lại giữ nguyên ý nghĩa
const seeBookings = (uid) => as(uid, () => q(`select id from booking_details order by id`));
ok('người chơi chỉ thấy lượt của mình', JSON.stringify((await seeBookings(player)).map((r) => r.id)) === JSON.stringify([b1]));
ok('chủ sân thấy mọi lượt của sân mình', (await seeBookings(owner)).length === 3);
ok('chủ sân khác không thấy', (await seeBookings(owner2)).length === 0);
ok('quản trị viên thấy hết', (await seeBookings(admin)).length === 3);
ok('dòng chi tiết chỉ thấy theo lượt cha', (await as(player2, () => q(`select booking_id from booking_items`))).every((r) => r.booking_id === b2));
ok('ảnh, giá, sân con của sân đã duyệt: khách xem được', (await as(null, () => q(`select id from venue_images`), 'anon')).length === 2);
await db.exec(`update venues set status = 'pending' where id = ${venue2}`);
ok('ảnh của sân chưa duyệt: khách không thấy', (await as(null, () => q(`select venue_id from venue_images`), 'anon')).every((r) => r.venue_id === venue));
ok('ảnh của sân chưa duyệt: chủ sân đó vẫn thấy', (await as(owner2, () => q(`select venue_id from venue_images where venue_id = $1`, [venue2]))).length === 1);
const ownerWrite = await errorOf(() => as(owner, () => q(`insert into courts (venue_id, name) values ($1, 'Lấn sân')`, [venue2])));
ok('chủ sân không thêm sân con vào sân người khác', ownerWrite !== null);
await db.exec(`update venues set status = 'approved' where id = ${venue2}`);

// ---------------------------------------------------------------- 0009.4: chủ sân xem thông tin khách
const custs = (await as(owner, () => q(`select id from profiles where id <> $1`, [owner]))).map((r) => r.id);
ok('chủ sân thấy khách đang giữ chỗ', custs.includes(player) && custs.includes(player2));
ok('chủ sân không thấy khách chỉ có lượt giữ chỗ đã hết hạn', !custs.includes(expiredOnly));
ok('chủ sân khác không thấy khách của sân này', (await as(owner2, () => q(`select id from profiles where id = $1`, [player]))).length === 0);

// ---------------------------------------------------------------- 0009.3: sân bị ẩn
await db.exec(`update venues set status = 'hidden' where id = ${venue}`);
const hiddenView = await as(player, () => q(`select id, venue_name from booking_details`));
ok('sân bị ẩn: người chơi vẫn thấy lượt đặt cũ kèm tên sân', hiddenView.length === 1 && hiddenView[0].venue_name === 'Sân Một', JSON.stringify(hiddenView));
ok('sân bị ẩn: không hiện trong venue_cards', (await as(player, () => q(`select id from venue_cards`))).every((r) => r.id !== venue));
ok('sân bị ẩn: khách vãng lai không thấy', (await as(null, () => q(`select id from venues where id = $1`, [venue]), 'anon')).length === 0);
const stranger = await mk('new@x', 'player');
ok('sân bị ẩn: người chưa từng đặt không thấy', (await as(stranger, () => q(`select id from venues where id = $1`, [venue]))).length === 0);
await db.exec(`update venues set status = 'approved' where id = ${venue}`);

// ---------------------------------------------------------------- 0009.2: tài khoản bị khóa
await db.exec(`update profiles set is_locked = true where id = '${player}'`);
ok('bị khóa: không xem được lịch đặt', (await seeBookings(player)).length === 0);
const lockedPay = await errorOf(() => as(player, () => q(`select report_payment($1, null)`, [b1])));
ok('bị khóa: không báo chuyển khoản được', lockedPay === 'FORBIDDEN', lockedPay ?? '');
const lockedCancel = await errorOf(() => as(player, () => q(`select cancel_booking($1, null)`, [b1])));
ok('bị khóa: không hủy được', lockedCancel === 'FORBIDDEN', lockedCancel ?? '');
ok('bị khóa: không lấy được thông tin chuyển khoản', (await as(player, () => q(`select * from booking_payment_info($1)`, [b1]))).length === 0);
await db.exec(`update profiles set is_locked = false where id = '${player}'`);
ok('mở khóa: báo chuyển khoản lại được', (await as(player, () => q(`select report_payment($1, null) r`, [b1])))[0].r === 'awaiting_confirmation');
ok('sau khi báo chuyển khoản vẫn lấy được thông tin chuyển khoản', (await as(player, () => q(`select * from booking_payment_info($1)`, [b1]))).length === 1);
await as(owner, () => q(`select confirm_payment($1)`, [b1]));
ok('đã xác nhận: không còn trả thông tin chuyển khoản', (await as(player, () => q(`select * from booking_payment_info($1)`, [b1]))).length === 0);
ok('người chơi hủy lượt của mình bình thường', (await as(player2, () => q(`select cancel_booking($1, null) r`, [b2])))[0].r === 'cancelled');

// Chủ sân bị khóa không xem được lượt đặt sân mình
await db.exec(`update profiles set is_locked = true where id = '${owner}'`);
ok('chủ sân bị khóa: không xem được lượt đặt', (await seeBookings(owner)).length === 0);

console.log(process.exitCode ? '\nCÓ KIỂM TRA LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
