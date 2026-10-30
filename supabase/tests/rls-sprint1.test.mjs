import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
let postgis;
try { ({ postgis } = await import('@electric-sql/pglite-postgis')); } catch (e) { console.log('no postgis import', e.message); }
const db = new PGlite({ extensions: { postgis } });
const run = async (label, sql) => { try { const r = await db.exec(sql); return r; } catch (e) { console.log('ERR', label, '=>', e.message); throw e; } };
// giả lập môi trường Supabase
await run('stub', `
create schema auth; create schema storage;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert, delete on storage.objects to anon, authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema public, auth, storage to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
await run('migration', fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url),'utf8'));
await run('seed', fs.readFileSync(new URL('../seed.sql', import.meta.url),'utf8'));
// Các migration sau định nghĩa lại một số hàm (venues_guard...): nạp đủ để kiểm tra hồi quy
for (const f of ['0002_bookings.sql', '0004_venue_rules.sql', '0005_admin_stats_ai.sql', '0006_notifications.sql', '0007_overdue_awaiting.sql', '0008_performance.sql', '0009_security.sql', '0010_payment_qr.sql', '0011_email_outbox.sql']) await run(f, fs.readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
const q = async (sql, p) => (await db.query(sql, p)).rows;
const as = async (uid, role, fn) => { await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`); try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); } };
const expectFail = async (label, fn) => { try { await fn(); console.log('FAIL (should be rejected):', label); process.exitCode = 1; } catch (e) { console.log('ok rejected:', label, '-', e.message.slice(0, 70)); } };
const ok = (label, cond, extra='') => { console.log(cond ? 'ok' : 'FAIL', label, extra); if (!cond) process.exitCode = 1; };
// người dùng
const mk = async (email, meta) => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(meta)]))[0].id;
const player = await mk('p@x', { full_name: 'Người chơi', phone: '0900000001', role: 'player' });
const ownerA = await mk('a@x', { full_name: 'Chủ sân A', phone: '0900000002', role: 'owner' });
const ownerB = await mk('b@x', { full_name: 'Chủ sân B', phone: '0900000003', role: 'owner' });
const hacker = await mk('h@x', { full_name: 'H', phone: '1', role: 'admin' });
const admin = await mk('ad@x', { full_name: 'Admin', phone: '2', role: 'player' });
await db.exec(`update public.profiles set role='admin' where id='${admin}'`);
const roles = await q(`select full_name, role from profiles order by created_at, full_name`);
ok('trigger tạo hồ sơ', roles.length === 5); ok('đăng ký với role=admin bị hạ về player', (await q(`select role from profiles where id=$1`, [hacker]))[0].role === 'player');
const venueSql = (owner, name, lat, lng, status) => `insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, bank_name, bank_account_number, bank_account_name, status) values ('${owner}', 1, '${name}', 'dc', ${lat}, ${lng}, '05:00', '22:00', 'NH', '123', 'TEN', '${status}') returning id, status`;
// PB06: chủ sân tạo sân -> luôn pending dù gửi approved
const vA = (await as(ownerA, 'authenticated', () => q(venueSql(ownerA, 'San A', 16.0680, 108.2240, 'approved'))))[0];
ok('sân mới của chủ sân luôn pending', vA.status === 'pending');
await expectFail('người chơi tạo sân', () => as(player, 'authenticated', () => q(venueSql(player, 'X', 16, 108, 'pending'))));
await expectFail('chủ sân A tạo sân đứng tên B', () => as(ownerA, 'authenticated', () => q(venueSql(ownerB, 'X', 16, 108, 'pending'))));
await as(ownerA, 'authenticated', () => db.exec(`insert into courts (venue_id, name) values (${vA.id}, 'Sân 1'), (${vA.id}, 'Sân 2'); insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${vA.id}, 'weekday', '05:00', '17:00', 50000), (${vA.id}, 'weekday', '17:00', '22:00', 60000);`));
await expectFail('chủ sân B thêm sân con vào sân A', () => as(ownerB, 'authenticated', () => db.exec(`insert into courts (venue_id, name) values (${vA.id}, 'Hack')`)));
await expectFail('chủ sân tự duyệt sân', () => as(ownerA, 'authenticated', () => db.exec(`update venues set status='approved' where id=${vA.id}`)));
// RLS đọc
ok('khách không thấy sân pending', (await as(null, 'anon', () => q(`select id from venues`))).length === 0);
ok('chủ sân thấy sân pending của mình', (await as(ownerA, 'authenticated', () => q(`select id from venues`))).length === 1);
ok('chủ sân B không thấy sân pending của A', (await as(ownerB, 'authenticated', () => q(`select id from venues`))).length === 0);
// admin duyệt
await as(admin, 'authenticated', () => db.exec(`update venues set status='approved' where id=${vA.id}`));
const st = (await q(`select status, approved_at from venues where id=${vA.id}`))[0];
ok('admin duyệt sân, có approved_at', st.status === 'approved' && st.approved_at);
ok('khách thấy sân đã duyệt', (await as(null, 'anon', () => q(`select id from venues`))).length === 1);
ok('khách thấy sân con + giá của sân đã duyệt', (await as(null, 'anon', () => q(`select id from courts`))).length === 2 && (await as(null, 'anon', () => q(`select id from price_slots`))).length === 2);
// PB02: người chơi / chủ sân khác sửa sân
const before = (await q(`select name from venues where id=${vA.id}`))[0].name;
await as(player, 'authenticated', () => db.exec(`update venues set name='hack' where id=${vA.id}`));
await as(ownerB, 'authenticated', () => db.exec(`update venues set name='hack' where id=${vA.id}`));
ok('người chơi và chủ sân B không sửa được sân A', (await q(`select name from venues where id=${vA.id}`))[0].name === before);
await as(ownerA, 'authenticated', () => db.exec(`update venues set name='San A moi', hold_minutes=20 where id=${vA.id}`));
ok('chủ sân A sửa được sân của mình', (await q(`select name from venues where id=${vA.id}`))[0].name === 'San A moi');
await expectFail('hold_minutes = 90', () => as(ownerA, 'authenticated', () => db.exec(`update venues set hold_minutes=90 where id=${vA.id}`)));
await as(ownerA, 'authenticated', () => db.exec(`update venues set status='suspended' where id=${vA.id}`));
ok('tạm ngừng: khách không thấy', (await as(null, 'anon', () => q(`select id from venues`))).length === 0);
await as(ownerA, 'authenticated', () => db.exec(`update venues set status='approved' where id=${vA.id}`));
await expectFail('giá trùng khung giờ bắt đầu', () => as(ownerA, 'authenticated', () => db.exec(`insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${vA.id}, 'weekday', '05:00', '08:00', 1)`)));
// replace_price_slots
const rp = await as(ownerA, 'authenticated', () => q(`select * from replace_price_slots(${vA.id}, '[{"day_type":"weekday","start_time":"05:00","end_time":"17:00","price":50000},{"day_type":"weekend","start_time":"05:00","end_time":"22:00","price":70000}]'::jsonb)`));
ok('replace_price_slots: chủ sân thay bảng giá', rp.length === 2);
await expectFail('replace_price_slots: chủ sân B thay giá sân A', () => as(ownerB, 'authenticated', () => q(`select * from replace_price_slots(${vA.id}, '[{"day_type":"weekday","start_time":"05:00","end_time":"17:00","price":1}]'::jsonb)`)));
ok('bảng giá sân A không đổi sau khi B thử sửa', (await q(`select count(*)::int n, min(price) m from price_slots where venue_id=${vA.id}`))[0].m === 50000);
// profiles
await expectFail('người chơi tự nâng vai trò', () => as(player, 'authenticated', () => db.exec(`update profiles set role='admin' where id='${player}'`)));
await as(player, 'authenticated', () => db.exec(`update profiles set full_name='Tên mới' where id='${player}'`));
ok('người chơi sửa họ tên', (await q(`select full_name from profiles where id=$1`, [player]))[0].full_name === 'Tên mới');
ok('người chơi chỉ thấy hồ sơ của mình', (await as(player, 'authenticated', () => q(`select id from profiles`))).length === 1);
ok('admin thấy mọi hồ sơ', (await as(admin, 'authenticated', () => q(`select id from profiles`))).length === 5);
// venues_nearby
const vB = (await as(ownerB, 'authenticated', () => q(venueSql(ownerB, 'San B', 16.0300, 108.2100, 'pending'))))[0];
await as(admin, 'authenticated', () => db.exec(`update venues set status='approved' where id=${vB.id}`));
const near = await as(null, 'anon', () => q(`select name, distance_km, min_price, court_count from venues_nearby(16.0678, 108.2208, 20)`));
console.log(near);
ok('venues_nearby sắp xếp gần trước, có giá thấp nhất', near.length === 2 && near[0].name === 'San A moi' && near[0].distance_km < near[1].distance_km && near[0].min_price === 50000 && Number(near[0].court_count) === 2);
ok('venues_nearby bán kính 1 km', (await as(null, 'anon', () => q(`select name from venues_nearby(16.0678, 108.2208, 1)`))).length === 1);
const cards = await as(null, 'anon', () => q(`select name, ward_name, min_price from venue_cards order by id`));
ok('venue_cards cho khách', cards.length === 2 && cards[0].ward_name === 'Phường Hải Châu');
// khung giờ đã giữ / đặt
await db.exec(`insert into bookings (code, venue_id, player_id, total_amount, status, hold_expires_at) values ('DS-1', ${vA.id}, '${player}', 60000, 'holding', now() + interval '10 min'), ('DS-2', ${vA.id}, '${player}', 60000, 'holding', now() - interval '1 min'), ('DS-3', ${vA.id}, '${player}', 60000, 'confirmed', now() - interval '1 day');
insert into booking_items (booking_id, court_id, booking_date, start_time, price) select b.id, (select min(id) from courts where venue_id=${vA.id}), '2026-10-17', t, 60000 from (values ('DS-1','19:00'::time), ('DS-2','20:00'::time), ('DS-3','21:00'::time)) x(code, t) join bookings b on b.code = x.code;`);
const taken = await as(null, 'anon', () => q(`select start_time::text, state from venue_taken_slots(${vA.id}, '2026-10-17') order by 1`));
console.log(taken);
ok('venue_taken_slots: giữ chỗ còn hạn = held, hết hạn bị bỏ qua, đã xác nhận = booked', taken.length === 2 && taken[0].state === 'held' && taken[1].state === 'booked');
await expectFail('trùng khung giờ còn hiệu lực', () => db.exec(`insert into booking_items (booking_id, court_id, booking_date, start_time, price) select id, (select min(id) from courts where venue_id=${vA.id}), '2026-10-17', '19:00', 1 from bookings where code='DS-3'`));
ok('chủ sân A xem được hồ sơ người đặt sân mình', (await as(ownerA, 'authenticated', () => q(`select id from profiles`))).length === 2);
ok('chủ sân B không xem được lượt đặt của sân A', (await as(ownerB, 'authenticated', () => q(`select id from bookings`))).length === 0);
await expectFail('khách đọc bookings', () => as(null, 'anon', () => q(`select id from bookings`)));
// storage policy
await as(ownerA, 'authenticated', () => db.exec(`insert into storage.objects (bucket_id, name) values ('venue-images', '${vA.id}/a.jpg')`));
await expectFail('chủ sân B tải ảnh vào thư mục sân A', () => as(ownerB, 'authenticated', () => db.exec(`insert into storage.objects (bucket_id, name) values ('venue-images', '${vA.id}/b.jpg')`)));
console.log(process.exitCode ? 'CÓ LỖI' : 'TẤT CẢ ĐẠT');
