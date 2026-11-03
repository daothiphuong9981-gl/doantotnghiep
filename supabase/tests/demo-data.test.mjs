// Kiểm tra supabase/demo_data.sql trên PGlite (auth.users dựng giống Supabase: cột token, auth.identities, pgcrypto).
// Chạy: node supabase/tests/demo-data.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { postgis } from '@electric-sql/pglite-postgis';
import fs from 'fs';

const db = new PGlite({ extensions: { postgis, pgcrypto } });
const file = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const q = async (sql, p) => (await db.query(sql, p)).rows;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok' : 'FAIL', label, extra); if (!cond) process.exitCode = 1; };

await db.exec(`
create schema auth; create schema storage; create schema extensions;
create extension pgcrypto schema extensions;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table auth.users (
  instance_id uuid, id uuid primary key default gen_random_uuid(), aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text,
  email_change_token_current text, phone_change text, phone_change_token text, reauthentication_token text);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users (id), provider_id text, identity_data jsonb, provider text,
  last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz, unique (provider_id, provider));
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema public, auth, storage to anon, authenticated;
`);
await db.exec(file('../migrations/0001_init.sql'));
await db.exec(file('../seed.sql'));
for (const f of ['0002_bookings.sql', '0004_venue_rules.sql', '0005_admin_stats_ai.sql', '0006_notifications.sql', '0007_overdue_awaiting.sql', '0008_performance.sql', '0009_security.sql', '0010_payment_qr.sql', '0011_email_outbox.sql', '0012_venue_reviews.sql', '0013_review_reminders.sql', '0014_performance2.sql']) await db.exec(file('../migrations/' + f));
await db.exec(file('../import_san_khao_sat.sql'));
const [{ n: venues }] = await q(`select count(*)::int n from venues`);

// Giống thực tế: sân Icon đã gán cho một chủ sân thật trước đó
await db.exec(`insert into auth.users (email, raw_user_meta_data) values ('hoatieuso2021@gmail.com', '{"full_name":"Chủ Icon","phone":"0901","role":"owner"}');
               update venues set owner_id = (select id from auth.users where email = 'hoatieuso2021@gmail.com') where name = 'Icon Badminton (Sân Icon)';`);

const demo = file('../demo_data.sql');
await db.exec(demo);

const players = await q(`select u.email, p.role, p.full_name from auth.users u join profiles p on p.id = u.id where u.email like 'member%@gmail.com' order by u.email`);
ok('30 người chơi member1..30, vai trò player', players.length === 30 && players.every((p) => p.role === 'player'), players[0]?.full_name);
const [pw] = await q(`select encrypted_password = extensions.crypt('12345678', encrypted_password) ok, email_confirmed_at is not null confirmed
                      from auth.users where email = 'member1@gmail.com'`);
ok('mật khẩu 12345678 khớp, email đã xác nhận', pw.ok && pw.confirmed);
const [ids] = await q(`select count(*)::int n from auth.identities i join auth.users u on u.id = i.user_id where u.email like 'member%'`);
ok('mỗi người chơi có identity email', ids.n === 30);

const owners = await q(`select v.name, u.email, v.bank_name from venues v join auth.users u on u.id = v.owner_id order by v.id`);
ok(`mọi ${venues} sân đều có chủ`, owners.length === venues, String(owners.length));
const icon = owners.find((o) => o.name.startsWith('Icon'));
ok('sân Icon giữ chủ cũ, không đổi ngân hàng', icon?.email === 'hoatieuso2021@gmail.com' && icon.bank_name === 'Chưa cập nhật', JSON.stringify(icon));
const buuDien = owners.find((o) => o.name === 'Sân cầu lông Bưu Điện');
ok('email chủ sân viết liền không dấu', buuDien?.email === 'sancaulongbuudien@gmail.com', buuDien?.email);
const [dupe] = await q(`select count(*)::int n from (select owner_id from venues group by owner_id having count(*) > 1) x`);
ok('mỗi chủ sân demo một sân (không trùng email)', dupe.n === 0);
const badEmail = owners.filter((o) => !/^[a-z0-9]+@gmail\.com$/.test(o.email));
ok('email hợp lệ', badEmail.length === 0, JSON.stringify(badEmail));
const [ownerRole] = await q(`select count(*)::int n from venues v join profiles p on p.id = v.owner_id where p.role <> 'owner'`);
ok('chủ sân có vai trò owner', ownerRole.n === 0);

const stat = (await q(`select status, count(*)::int n from bookings group by status order by status`));
const total = stat.reduce((s, r) => s + r.n, 0);
ok('sinh lượt đặt', total > 500, JSON.stringify(stat));
const [mismatch] = await q(`select count(*)::int n from bookings b where total_amount <> (select coalesce(sum(price), 0) from booking_items bi where bi.booking_id = b.id) or total_amount = 0`);
ok('tổng tiền = tổng giá các khung giờ, không có lượt 0 đ', mismatch.n === 0, String(mismatch.n));
const [future] = await q(`select count(*)::int n from bookings b where b.created_at > now() or (b.status = 'expired' and exists
                         (select 1 from booking_items bi where bi.booking_id = b.id and bi.booking_date + bi.start_time > (now() at time zone 'Asia/Ho_Chi_Minh')))`);
ok('không có lượt tạo trong tương lai hay hết hạn ở giờ chưa tới', future.n === 0);
const [active] = await q(`select count(*)::int n from booking_items bi join bookings b on b.id = bi.booking_id
                         where bi.is_active <> (b.status in ('confirmed', 'awaiting_confirmation'))`);
ok('khung giờ của lượt hủy/hết hạn được trả lại', active.n === 0);

// Chủ sân xem được thống kê, người chơi xem được lịch sử của mình (qua RLS)
const [ownerId] = await q(`select owner_id id from venues where name = 'Sân cầu lông Bưu Điện'`);
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ownerId.id}', false);`);
const [stats] = await q(`select owner_stats(null, (current_date - 30), current_date) s`);
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
ok('owner_stats của chủ sân có doanh thu', Number(stats.s.revenue) > 0, `doanh thu ${stats.s.revenue}, ${stats.s.confirmed_count} lượt`);
const [m1] = await q(`select id from auth.users where email = 'member1@gmail.com'`);
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${m1.id}', false);`);
const mine = await q(`select count(*)::int n, count(distinct player_id)::int who from booking_details`);
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
ok('member1 chỉ thấy lượt đặt của mình', mine[0].n > 0 && mine[0].who === 1, JSON.stringify(mine[0]));

await db.exec(demo);
const [{ n: again }] = await q(`select count(*)::int n from bookings`);
const [{ n: users }] = await q(`select count(*)::int n from auth.users`);
ok('chạy lại không sinh thêm tài khoản hay lượt đặt', again === total && users === 30 + venues, `${again} lượt, ${users} tài khoản`);
