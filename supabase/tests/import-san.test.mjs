// Kiểm tra supabase/import_san_khao_sat.sql trên PGlite: chạy được sau các migration, đủ sân/sân con/khung giá,
// chạy lại không trùng, sân hiện trong search_venues và đặt thử được khi gán chủ sân.
// Chạy: node supabase/tests/import-san.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import fs from 'fs';

const db = new PGlite({ extensions: { postgis } });
const file = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const q = async (sql, p) => (await db.query(sql, p)).rows;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok' : 'FAIL', label, extra); if (!cond) process.exitCode = 1; };

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
await db.exec(file('../migrations/0001_init.sql'));
await db.exec(file('../seed.sql'));
for (const f of ['0002_bookings.sql', '0004_venue_rules.sql', '0005_admin_stats_ai.sql', '0006_notifications.sql', '0007_overdue_awaiting.sql', '0008_performance.sql', '0009_security.sql', '0010_payment_qr.sql', '0011_email_outbox.sql', '0012_venue_reviews.sql', '0013_review_reminders.sql']) await db.exec(file('../migrations/' + f));

const importSql = file('../import_san_khao_sat.sql');
const expected = (importSql.match(/^\s+\('KS-\d+'/gm) ?? []).length;
await db.exec(importSql);
const [count] = await q(`select count(*)::int n, count(*) filter (where owner_id is null)::int no_owner from venues where status = 'approved'`);
ok(`nhập đủ ${expected} sân, trạng thái đã duyệt, chưa có chủ`, count.n === expected && count.no_owner === expected, JSON.stringify(count));
const [courts] = await q(`select count(*)::int n from courts`);
const sumCourts = [...importSql.matchAll(/^\s+\('KS-\d+', '(?:[^']|'')*', '(?:[^']|'')*', '(?:[^']|'')*', [\d.]+, [\d.]+, (\d+),/gm)].reduce((s, m) => s + Number(m[1]), 0);
ok(`số sân con khớp file (${sumCourts})`, courts.n === sumCourts, String(courts.n));
const [slots] = await q(`select count(*)::int n from price_slots`);
ok('mỗi sân 3 khung giá', slots.n === expected * 3, String(slots.n));
const gaps = await q(`select v.name from venues v where not exists (select 1 from price_slots p where p.venue_id = v.id and p.day_type = 'weekday' and p.start_time = v.open_time)
                     or not exists (select 1 from price_slots p where p.venue_id = v.id and p.day_type = 'weekday' and p.end_time = v.close_time)`);
ok('giá ngày thường phủ kín giờ mở cửa', gaps.length === 0, JSON.stringify(gaps));

await db.exec(importSql);
const [again] = await q(`select count(*)::int n from venues`);
ok('chạy lại không sinh trùng', again.n === expected, String(again.n));

const near = await q(`select name, distance_km from search_venues(null, null, null, null, null, null, 16.0612, 108.2271, 5)`);
ok('search_venues tìm được sân quanh cầu Rồng (5 km)', near.length > 0, `${near.length} sân, gần nhất: ${near[0]?.name} ${near[0]?.distance_km} km`);
const cheap = await q(`select count(*)::int n from search_venues(null, null, null, 60000)`);
ok('lọc giá dưới 60.000 hoạt động', cheap[0].n > 0, String(cheap[0].n));

// Gán chủ sân demo: sửa v_owner_email rồi chạy lại trên CSDL mới chỉ để kiểm tra nhánh có chủ
const [owner] = await q(`insert into auth.users (email, raw_user_meta_data) values ('demo@x', '{"full_name":"Chủ sân demo","phone":"0900000009","role":"owner"}') returning id`);
await db.exec(`delete from price_slots; delete from courts; delete from venues;`);
await db.exec(importSql.replace("v_owner_email text := null;", "v_owner_email text := 'demo@x';"));
const [owned] = await q(`select count(*)::int n from venues where owner_id = $1`, [owner.id]);
ok('điền v_owner_email: mọi sân thuộc chủ sân demo', owned.n === expected, String(owned.n));
try {
  await db.exec(importSql.replace("v_owner_email text := null;", "v_owner_email text := 'khong-co@x';"));
  ok('email chủ sân sai thì báo lỗi', false);
} catch (e) {
  ok('email chủ sân sai thì báo lỗi', e.message.includes('Không có tài khoản Chủ sân'), e.message.slice(0, 60));
}
