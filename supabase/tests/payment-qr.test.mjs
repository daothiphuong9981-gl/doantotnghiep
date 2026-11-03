// Kiểm tra 0010_payment_qr.sql: cột bank_bin, điền sẵn BIN theo tên ngân hàng, chuẩn hóa số tài khoản, quyền đọc.
// Chạy: node supabase/tests/payment-qr.test.mjs
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
await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
for (const f of ['0008_performance.sql', '0009_security.sql']) await db.exec(file('../migrations/' + f));

const mk = async (email, role) => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
  [email, JSON.stringify({ full_name: email, phone: '0900', role })]))[0].id;
const player = await mk('p@x', 'player');
const owner = await mk('o@x', 'owner');

// Sân có sẵn trước khi chạy 0010, với nhiều cách ghi tên ngân hàng
const names = ['BIDV', 'Ngân hàng TMCP Vietcombank', 'NH MB Bank', 'Techcombank', 'Ngân hàng DEMO (dữ liệu ảo)', 'Ngân hàng mẫu ABC', 'tp bank'];
const ids = {};
for (const n of names) {
  ids[n] = (await q(`insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, bank_name, bank_account_number, bank_account_name, status)
    values ($1, 1, $2, 'dc', 16.06, 108.22, '05:00', '22:00', $3, '0123 456 789', 'NGUYEN VAN A', 'approved') returning id`, [owner, 'Sân ' + n, n]))[0].id;
}

await db.exec(file('../migrations/0010_payment_qr.sql'));
for (const f of ['0011_email_outbox.sql', '0012_venue_reviews.sql', '0013_review_reminders.sql', '0014_performance2.sql']) await db.exec(file('../migrations/' + f));

const bin = async (n) => (await q(`select bank_bin from venues where id = $1`, [ids[n]]))[0].bank_bin;
ok('BIDV -> 970418', (await bin('BIDV')) === '970418');
ok('"Ngân hàng TMCP Vietcombank" -> 970436', (await bin('Ngân hàng TMCP Vietcombank')) === '970436');
ok('"NH MB Bank" -> 970422', (await bin('NH MB Bank')) === '970422');
ok('Techcombank -> 970407', (await bin('Techcombank')) === '970407');
ok('"tp bank" -> 970423', (await bin('tp bank')) === '970423');
ok('ngân hàng dữ liệu ảo: không gán BIN (không tạo QR tới tài khoản thật)', (await bin('Ngân hàng DEMO (dữ liệu ảo)')) === null);
ok('tên ngân hàng lạ: không gán BIN', (await bin('Ngân hàng mẫu ABC')) === null);
ok('số tài khoản bỏ khoảng trắng', (await q(`select distinct bank_account_number n from venues`)).every((r) => r.n === '0123456789'));

const badBin = await errorOf(() => q(`update venues set bank_bin = '12AB' where id = $1`, [ids.BIDV]));
ok('BIN phải gồm 6 chữ số', badBin !== null && /venues_bank_bin_check/.test(badBin));

const anonBin = await errorOf(() => as(null, () => q(`select bank_bin from venues`), 'anon'));
ok('khách không đọc trực tiếp được bank_bin', anonBin !== null && /permission denied/i.test(anonBin));
const playerBin = await errorOf(() => as(player, () => q(`select bank_bin from venues`)));
ok('người chơi không đọc trực tiếp được bank_bin', playerBin !== null);

await db.exec(`insert into courts (venue_id, name) values (${ids.BIDV}, 'Sân 1');
               insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${ids.BIDV}, 'weekday', '05:00', '22:00', 90000), (${ids.BIDV}, 'weekend', '05:00', '22:00', 90000);`);
const court = (await q(`select id from courts where venue_id = $1`, [ids.BIDV]))[0].id;
const day = (await q(`select (current_date + 2)::text d`))[0].d;
const booking = (await as(player, () => q(`select create_booking($1, $2::jsonb) r`, [ids.BIDV, JSON.stringify([{ court_id: court, booking_date: day, start_time: '18:00' }])])))[0].r.id;

const pay = (await as(player, () => q(`select * from booking_payment_info($1)`, [booking])))[0];
ok('booking_payment_info trả BIN, số tài khoản, số tiền, mã lượt đặt', pay?.bank_bin === '970418' && pay.account_number === '0123456789' && pay.amount === 90000 && /^DS\d+$/.test(pay.content), JSON.stringify(pay));
ok('người lạ vẫn không lấy được', (await as(await mk('x@x', 'player'), () => q(`select * from booking_payment_info($1)`, [booking]))).length === 0);
const anonPay = await errorOf(() => as(null, () => q(`select * from booking_payment_info($1)`, [booking]), 'anon'));
ok('khách không gọi được booking_payment_info', anonPay !== null);
ok('venue_bank_info trả BIN cho chủ sân', (await as(owner, () => q(`select bank_bin from venue_bank_info($1)`, [ids.BIDV])))[0]?.bank_bin === '970418');

// Chủ sân đổi ngân hàng qua cập nhật thường (quyền UPDATE)
await as(owner, () => q(`update venues set bank_bin = '970436', bank_name = 'Vietcombank' where id = $1 returning id`, [ids.BIDV]));
ok('chủ sân đổi được ngân hàng, thông tin chuyển khoản cập nhật theo', (await as(player, () => q(`select bank_bin from booking_payment_info($1)`, [booking])))[0]?.bank_bin === '970436');

console.log(process.exitCode ? '\nCÓ KIỂM TRA LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
