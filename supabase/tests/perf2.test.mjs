// Kiểm tra 0014_performance2.sql: kết quả TRƯỚC và SAU migration phải giống hệt (search_venues chỉ thêm 2 cột cuối),
// RLS và quyền giữ nguyên, bảng tóm tắt đánh giá (trigger) luôn khớp với tính lại, chạy lại migration không đổi gì.
// Dữ liệu: demo_data.sql (~2.000 lượt đặt) + ảnh, đánh giá tổng hợp.
// Chạy: node supabase/tests/perf2.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { postgis } from '@electric-sql/pglite-postgis';
import fs from 'fs';

const db = new PGlite({ extensions: { postgis, pgcrypto } });
const file = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const q = async (sql, p) => (await db.query(sql, p)).rows;
let passed = 0;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, cond ? '' : extra); if (cond) passed += 1; else process.exitCode = 1; };
const as = async (uid, fn, role = 'authenticated') => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const errorOf = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Chỉ ra vị trí khác nhau đầu tiên khi so sánh lỗi
const diff = (a, b) => { const x = JSON.stringify(a), y = JSON.stringify(b); let i = 0; while (i < x.length && x[i] === y[i]) i += 1; return `#${i}: ${x?.slice(Math.max(0, i - 80), i + 120)}\n   vs ${y?.slice(Math.max(0, i - 80), i + 120)}`; };

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
for (const f of ['0002_bookings.sql', '0004_venue_rules.sql', '0005_admin_stats_ai.sql', '0006_notifications.sql', '0007_overdue_awaiting.sql', '0008_performance.sql', '0009_security.sql', '0010_payment_qr.sql', '0011_email_outbox.sql', '0012_venue_reviews.sql', '0013_review_reminders.sql']) await db.exec(file('../migrations/' + f));
await db.exec(file('../import_san_khao_sat.sql'));
await db.exec(file('../demo_data.sql'));

// Dữ liệu demo không có ảnh và đánh giá: thêm 3 ảnh mỗi sân, ~40% lượt đã xác nhận có đánh giá (3% bị ẩn)
await db.exec(`select setseed(0.42);
insert into venue_images (venue_id, storage_path, sort_order) select v.id, v.id || '/' || g || '.jpg', g from venues v, generate_series(0, 2) g;
insert into venue_reviews (venue_id, booking_id, player_id, rating, comment, status, created_at, updated_at)
select b.venue_id, b.id, b.player_id, (1 + floor(random() * 5))::smallint, 'Lượt ' || b.code,
       case when random() < 0.03 then 'hidden' else 'visible' end, b.confirmed_at + interval '3 hours', b.confirmed_at + interval '3 hours'
from bookings b where b.status = 'confirmed' and b.confirmed_at is not null and random() < 0.4;`);

// ---------------------------------------------------------------- Người dùng, tình huống đặc biệt
const uid = async (email) => (await q(`select id from auth.users where email = $1`, [email]))[0].id;
await db.exec(`insert into auth.users (email, raw_user_meta_data) values ('admin@perf2', '{"full_name":"Admin","phone":"0900","role":"player"}');
               update profiles set role = 'admin' where id = (select id from auth.users where email = 'admin@perf2');`);
const admin = await uid('admin@perf2');
const p1 = await uid('member1@gmail.com');
const p2 = await uid('member2@gmail.com');
const p3 = await uid('member3@gmail.com');
const [{ venue, owner }] = await q(`select v.id venue, v.owner_id owner from venues v join bookings b on b.venue_id = v.id group by v.id order by count(*) desc limit 1`);
const [{ venue: v2, owner: owner2 }] = await q(`select v.id venue, v.owner_id owner from venues v where v.id <> $1
  and exists (select 1 from bookings b where b.venue_id = v.id and b.player_id = $2) order by v.id limit 1`, [venue, p1]);
const tomorrow = (await q(`select (vn_now()::date + 1)::text d`))[0].d;
const today = (await q(`select vn_now()::date::text d`))[0].d;
// Lượt giữ chỗ còn hạn của p2 (ngày mai) và một lượt giữ chỗ đã quá hạn nhưng chưa được giải phóng
const court = (await q(`select id from courts where venue_id = $1 and is_active order by id limit 1`, [venue]))[0].id;
const freeHours = (await q(`select h from generate_series(6, 9) h where not exists (select 1 from booking_items
  where court_id = $1 and booking_date = $2 and is_active and extract(hour from start_time) = h) limit 2`, [court, tomorrow])).map((r) => r.h);
for (const h of freeHours) {
  await as(p2, () => q(`select create_booking($1, $2::jsonb)`, [venue, JSON.stringify([{ court_id: court, booking_date: tomorrow, start_time: `${String(h).padStart(2, '0')}:00` }])]));
}
await db.exec(`update bookings set hold_expires_at = now() - interval '1 minute' where id = (select max(id) from bookings where status = 'holding')`);
// Sân v2 bị ẩn: p1 vẫn thấy lịch sử nhưng không đọc được sân con -> items rỗng; p3 bị khóa
await db.exec(`update venues set status = 'hidden' where id = ${v2}; update profiles set is_locked = true where id = '${p3}';`);
await db.exec('analyze');

// ---------------------------------------------------------------- Ảnh chụp kết quả
const sat = (await q(`select (vn_now()::date + (6 - extract(dow from vn_now())::int + 7) % 7)::text d`))[0].d;
const weekend = sat === today ? tomorrow : sat;
const ward = (await q(`select ward_id from venues where status = 'approved' group by ward_id order by count(*) desc limit 1`))[0].ward_id;
const searchArgs = [
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, tomorrow, '18:00', null, null, null],
  [null, null, null, null, tomorrow, '06:00', null, null, null],
  [null, null, null, null, weekend, '19:00', null, null, null],
  ['cau long', null, null, null, null, null, null, null, null],
  ['Bưu', null, null, null, null, null, null, null, null],
  [null, ward, null, null, null, null, null, null, null],
  [null, null, 50000, 120000, null, null, null, null, null],
  [null, null, null, 80000, tomorrow, '18:00', null, null, null],
  [null, null, 60000, null, weekend, null, null, null, null],
  [null, null, null, null, null, null, 16.0544, 108.2022, 30],
  [null, null, null, null, null, null, 16.0544, 108.2022, 3],
  [null, null, null, null, tomorrow, '20:00', 16.07, 108.15, 5],
];
const SEARCH = `select * from search_venues($1, $2::smallint, $3, $4, $5::date, $6::time, $7, $8, $9)`;
const OLD_COLS = ['id', 'name', 'address', 'ward_id', 'ward_name', 'latitude', 'longitude', 'min_price', 'court_count', 'thumbnail', 'distance_km', 'free_courts'];
const pick = (rows) => rows.map((r) => Object.fromEntries(OLD_COLS.map((k) => [k, r[k]])));
const USERS = [['p1', p1], ['p2', p2], ['p3', p3], ['owner', owner], ['owner2', owner2], ['admin', admin]];

async function snapshot() {
  const s = { search: [] };
  for (const a of searchArgs) s.search.push(pick(await as(null, () => q(SEARCH, a), 'anon')));
  for (const [name, who] of USERS) {
    s[`details_${name}`] = await as(who, () => q(`select * from booking_details order by id`));
    s[`items_${name}`] = await as(who, () => q(`select id, booking_id from booking_items order by id`));
  }
  s.anonItems = await errorOf(() => as(null, () => q(`select count(*) from booking_items`), 'anon'));
  s.stats30 = await as(owner, () => q(`select owner_stats(null, $1::date - 30, $1::date) s`, [today]));
  s.stats366 = await as(owner, () => q(`select owner_stats($2, $1::date - 360, $1::date + 6) s`, [today, venue]));
  s.statsEmpty = await as(owner, () => q(`select owner_stats(null, '2020-01-01', '2020-01-31') s`));
  s.admin = await as(admin, () => q(`select admin_stats() s`));
  s.ratings = await as(null, () => q(`select * from venue_rating_summary(null) order by venue_id`), 'anon');
  s.ratingOne = await as(p1, () => q(`select * from venue_rating_summary(array[$1::bigint, $2::bigint]) order by venue_id`, [venue, v2]));
  s.reviews = await as(null, () => q(`select * from list_venue_reviews($1, 21, 0)`, [venue]), 'anon');
  s.errors = {
    playerStats: await errorOf(() => as(p1, () => q(`select owner_stats(null, $1::date - 30, $1::date)`, [today]))),
    otherVenueStats: await errorOf(() => as(owner, () => q(`select owner_stats($2, $1::date - 30, $1::date)`, [today, v2]))),
    badRange: await errorOf(() => as(owner, () => q(`select owner_stats(null, $1::date - 400, $1::date)`, [today]))),
    anonStats: await errorOf(() => as(null, () => q(`select owner_stats(null, $1::date - 30, $1::date)`, [today]), 'anon')),
    ownerAdmin: await errorOf(() => as(owner, () => q(`select admin_stats()`))),
    anonAdmin: await errorOf(() => as(null, () => q(`select admin_stats()`), 'anon')),
  };
  return s;
}
const before = await snapshot();
await db.exec(file('../migrations/0014_performance2.sql'));
await db.exec('analyze');
const after = await snapshot();

// ---------------------------------------------------------------- So sánh trước / sau
for (let i = 0; i < searchArgs.length; i += 1) {
  ok(`search_venues giữ nguyên: ${JSON.stringify(searchArgs[i])} (${before.search[i].length} sân)`, same(before.search[i], after.search[i]), diff(before.search[i], after.search[i]));
}
ok('có tìm kiếm theo khung giờ giảm số sân trống (ca kiểm tra có ý nghĩa)', before.search.some((r, i) => searchArgs[i][4] && searchArgs[i][5] && r.some((x) => x.free_courts < x.court_count)));
ok('có tìm kiếm theo bán kính loại bớt sân', before.search[11].length < before.search[0].length && before.search[11].length > 0);
for (const k of Object.keys(before).filter((k) => k.startsWith('details_') || k.startsWith('items_'))) {
  ok(`${k}: giống hệt (${before[k].length} dòng)`, same(before[k], after[k]), diff(before[k], after[k]));
}
ok('anon vẫn không đọc được booking_items', before.anonItems !== null && same(before.anonItems, after.anonItems), JSON.stringify([before.anonItems, after.anonItems]));
ok('p1 thấy lượt ở sân đã ẩn, items rỗng như bản cũ', after.details_p1.some((d) => Number(d.venue_id) === v2 && d.items.length === 0));
ok('p3 (bị khóa) không thấy lượt nào', after.details_p3.length === 0 && after.items_p3.length === 0);
ok('p2 có lượt giữ chỗ còn hủy được', after.details_p2.some((d) => d.status === 'holding' && d.can_cancel));
ok('chủ sân chỉ thấy lượt của sân mình', after.details_owner.length > 0 && after.details_owner.every((d) => Number(d.venue_id) === Number(venue)));
for (const k of ['stats30', 'stats366', 'statsEmpty', 'admin', 'ratings', 'ratingOne', 'reviews']) {
  ok(`${k}: giống hệt`, same(before[k], after[k]), diff(before[k], after[k]));
}
ok('owner_stats 366 ngày có 367 phần tử by_day, có doanh thu', after.stats366[0].s.by_day.length === 367 && Number(after.stats366[0].s.revenue) > 0);
ok('admin_stats có 6 tháng', after.admin[0].s.bookings_by_month.length === 6);
ok('điểm đánh giá có dữ liệu (ca kiểm tra có ý nghĩa)', after.ratings.length > 10);
ok('lỗi phân quyền owner_stats/admin_stats giữ nguyên', same(before.errors, after.errors) && Object.values(after.errors).every(Boolean), JSON.stringify([before.errors, after.errors]));

// ---------------------------------------------------------------- Cột mới, quyền
const fn = 'public.search_venues(text, smallint, integer, integer, date, time, double precision, double precision, double precision)';
const full = await as(null, () => q(SEARCH, searchArgs[0]), 'anon');
const rmap = new Map(after.ratings.map((r) => [Number(r.venue_id), r]));
ok('search_venues thêm rating_avg, rating_count ở cuối', same(Object.keys(full[0]), [...OLD_COLS, 'rating_avg', 'rating_count']), JSON.stringify(Object.keys(full[0])));
ok('search_venues.rating_avg/rating_count khớp venue_rating_summary', full.every((r) => {
  const s = rmap.get(Number(r.id));
  return s ? Number(s.rating_avg) === Number(r.rating_avg) && s.rating_count === r.rating_count : r.rating_avg === null && r.rating_count === 0;
}));
const privs = (await q(`select has_function_privilege('anon', '${fn}', 'execute') a, has_function_privilege('authenticated', '${fn}', 'execute') b,
                               has_function_privilege('service_role', '${fn}', 'execute') c`))[0];
ok('quyền gọi search_venues còn cho anon, authenticated, service_role', privs.a && privs.b && privs.c, JSON.stringify(privs));
ok('anon/người chơi không đọc trực tiếp venue_rating_stats',
  (await errorOf(() => as(null, () => q(`select * from venue_rating_stats`), 'anon'))) !== null
  && (await errorOf(() => as(p1, () => q(`select * from venue_rating_stats`)))) !== null);
ok('anon/người chơi không gọi được hàm nội bộ của bảng tóm tắt',
  (await errorOf(() => as(p1, () => q(`select venue_rating_stats_apply(1, 5, 1)`)))) !== null
  && (await errorOf(() => as(p1, () => q(`select refresh_venue_rating_stats()`)))) !== null
  && (await errorOf(() => as(null, () => q(`select refresh_venue_rating_stats()`), 'anon'))) !== null);
const pol = (await q(`select qual from pg_policies where tablename = 'booking_items' and policyname = 'booking_items_select'`))[0]?.qual ?? '';
ok('chính sách booking_items_select dạng EXISTS', /EXISTS/i.test(pol), pol);

// ---------------------------------------------------------------- Bảng tóm tắt luôn khớp với tính lại
const recompute = `select r.venue_id, round(avg(r.rating)::numeric, 1) rating_avg, count(*)::int rating_count from venue_reviews r
  join venues v on v.id = r.venue_id and v.status = 'approved' where r.status = 'visible' group by r.venue_id order by 1`;
const viaFn = `select * from venue_rating_summary(null) order by venue_id`;
const statsOk = async (label) => { const a = await q(recompute), b = await q(viaFn); ok(`tóm tắt đánh giá khớp sau: ${label}`, same(a, b), diff(a, b)); };
await statsOk('nạp dữ liệu có sẵn');
const nb = (await q(`select b.id, b.venue_id, b.player_id from bookings b where b.status = 'confirmed' and b.venue_id <> $1
  and not exists (select 1 from venue_reviews r where r.booking_id = b.id) order by b.id limit 1`, [v2]))[0];
await db.exec(`insert into venue_reviews (venue_id, booking_id, player_id, rating) values (${nb.venue_id}, ${nb.id}, '${nb.player_id}', 1)`);
await statsOk('thêm đánh giá');
await db.exec(`update venue_reviews set rating = 5 where booking_id = ${nb.id}`);
await statsOk('sửa số sao');
const rid = (await q(`select id from venue_reviews where booking_id = $1`, [nb.id]))[0].id;
await as(admin, () => q(`select admin_set_review_status($1, 'hidden', 'Vi phạm')`, [rid]));
await statsOk('quản trị viên ẩn (admin_set_review_status)');
await as(admin, () => q(`select admin_set_review_status($1, 'visible', null)`, [rid]));
await statsOk('hiện lại');
await db.exec(`update venue_reviews set comment = 'chỉ sửa bình luận', owner_reply = 'Cảm ơn' where booking_id = ${nb.id}`);
await statsOk('sửa bình luận, chủ sân trả lời');
await db.exec(`update venue_reviews set rating = 2 where status = 'visible' and venue_id = ${nb.venue_id}`);
await statsOk('sửa nhiều dòng một lệnh');
await db.exec(`delete from venue_reviews where booking_id = ${nb.id}`);
await statsOk('xóa đánh giá');
await db.exec(`delete from bookings where id = (select booking_id from venue_reviews where status = 'visible' order by id limit 1)`);
await statsOk('xóa lượt đặt (cascade xóa đánh giá)');
await db.exec(`update venues set status = 'hidden' where id = ${venue}`);
await statsOk('ẩn sân');
ok('sân đã ẩn không có trong venue_rating_summary', !(await q(viaFn)).some((r) => Number(r.venue_id) === Number(venue)));
await db.exec(`update venues set status = 'approved' where id = ${venue}`);
await statsOk('duyệt lại sân');

// Xóa sân kéo theo xóa đánh giá (cascade): trigger trừ điểm của sân đang bị xóa không được làm hỏng lệnh xóa.
// Sân tạm không có lượt đặt (bookings chặn xóa sân); đánh giá gắn tạm vào một lượt đặt chưa có đánh giá ở sân khác.
const [{ id: tmpVenue }] = await q(`insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, bank_name, bank_account_number, bank_account_name, status)
  values ($1, 1, 'Sân tạm perf2', 'dc', 16.06, 108.22, '05:00', '22:00', 'BIDV', '0123456789', 'A', 'approved') returning id`, [owner2]);
const tb = (await q(`select b.id, b.player_id from bookings b where b.status = 'confirmed'
  and not exists (select 1 from venue_reviews r where r.booking_id = b.id) order by b.id limit 1`))[0];
await db.exec(`insert into venue_reviews (venue_id, booking_id, player_id, rating) values (${tmpVenue}, ${tb.id}, '${tb.player_id}', 4)`);
await statsOk('đánh giá ở sân mới');
const delErr = await errorOf(() => db.exec(`delete from venues where id = ${tmpVenue}`));
ok('xóa sân có đánh giá không lỗi', delErr === null, delErr);
await statsOk('xóa sân');
ok('không còn dòng tóm tắt của sân đã xóa', (await q(`select count(*)::int n from venue_rating_stats where venue_id = $1`, [tmpVenue]))[0].n === 0);

// Lệch dữ liệu (trigger từng bị tắt) -> refresh_venue_rating_stats sửa lại
await db.exec(`update venue_rating_stats set rating_sum = rating_sum + 100 where venue_id = ${nb.venue_id}; insert into venue_rating_stats values (${v2}, 999, 9) on conflict (venue_id) do update set rating_count = 9;`);
await db.exec(`select refresh_venue_rating_stats()`);
await statsOk('refresh_venue_rating_stats sau khi lệch');
ok('refresh xóa dòng của sân không còn đánh giá đang hiện',
  (await q(`select count(*)::int n from venue_rating_stats s where not exists (select 1 from venue_reviews r where r.venue_id = s.venue_id and r.status = 'visible')`))[0].n === 0);

// ---------------------------------------------------------------- Chạy lại migration
const snap2 = await snapshot();
const statsRows = await q(`select * from venue_rating_stats order by venue_id`);
const runAgain = await errorOf(() => db.exec(file('../migrations/0014_performance2.sql')));
ok('chạy lại 0014 không lỗi', runAgain === null, runAgain);
const snap3 = await snapshot();
ok('chạy lại 0014: kết quả không đổi', same(snap2, snap3), diff(snap2, snap3));
ok('chạy lại 0014: bảng tóm tắt không đổi (không cộng trùng)', same(statsRows, await q(`select * from venue_rating_stats order by venue_id`)));
ok('chạy lại 0014: chỉ một trigger tóm tắt', (await q(`select count(*)::int n from pg_trigger where tgname = 'venue_reviews_stats'`))[0].n === 1);
ok('chạy lại 0014: chỉ một chính sách booking_items_select',
  (await q(`select count(*)::int n from pg_policies where tablename = 'booking_items' and policyname = 'booking_items_select'`))[0].n === 1);
await statsOk('chạy lại 0014');

console.log(process.exitCode ? '\nCÓ KIỂM TRA LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
