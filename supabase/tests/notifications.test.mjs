// Kiểm tra 0006_notifications.sql: thông báo sinh đúng người, đúng nội dung qua các hàm đặt sân thật; RLS; đánh dấu đã đọc.
// Chạy: node supabase/tests/notifications.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import fs from 'fs';

const db = new PGlite({ extensions: { postgis } });
const file = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const q = async (sql, p) => (await db.query(sql, p)).rows;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok' : 'FAIL', label, extra); if (!cond) process.exitCode = 1; };
const as = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};

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
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant usage, select on all sequences in schema public to authenticated;`);
// RLS của 0006 phải tự đứng vững: thu hồi lại quyền ghi thừa vừa cấp chung cho bảng notifications
await db.exec(`revoke insert, update, delete on public.notifications from authenticated;`);

const mk = async (email, role) => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
  [email, JSON.stringify({ full_name: email, phone: '0900', role })]))[0].id;
const player = await mk('p@x', 'player');
const player2 = await mk('p2@x', 'player');
const owner = await mk('o@x', 'owner');
const admin = await mk('a@x', 'player');
await db.exec(`update profiles set role = 'admin' where id = '${admin}'`);

const [{ id: venue }] = await q(`insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, bank_name, bank_account_number, bank_account_name, status)
  values ($1, 1, 'Sân Thử', '1 Đường A', 16.06, 108.22, '05:00', '22:00', 'NH', '1', 'A', 'pending') returning id`, [owner]);
await db.exec(`insert into courts (venue_id, name) values (${venue}, 'Sân 1'), (${venue}, 'Sân 2');
               insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${venue}, 'weekday', '05:00', '22:00', 120000), (${venue}, 'weekend', '05:00', '22:00', 120000);`);
const courts = (await q(`select id from courts where venue_id = $1 order by id`, [venue])).map((r) => r.id);
const inbox = async (uid) => q(`select kind, title, body, link, read_at from notifications where user_id = $1 order by id`, [uid]);

// Duyệt sân -> chủ sân nhận thông báo
await as(admin, () => q(`select admin_review_venue($1, 'approve')`, [venue]));
let o = await inbox(owner);
ok('duyệt sân: chủ sân nhận "Sân đã được duyệt"', o.length === 1 && o[0].kind === 'venue_reviewed' && o[0].title === 'Sân đã được duyệt' && o[0].link === `/owner/venues/${venue}`, JSON.stringify(o[0]));

const day = (await q(`select (current_date + 2)::text d`))[0].d;
const book = (uid, court, time) => as(uid, () => q(`select create_booking($1, $2::jsonb) r`, [venue, JSON.stringify([{ court_id: court, booking_date: day, start_time: time }])]));

// 1. Giữ chỗ -> chủ sân
const [{ r: b1 }] = await book(player, courts[0], '19:00');
o = await inbox(owner);
const dd = day.slice(8, 10) + '/' + day.slice(5, 7);
ok('giữ chỗ: chủ sân nhận "Có lượt giữ chỗ mới" kèm giờ và số tiền', o.length === 2 && o[1].kind === 'booking_new' && o[1].body.includes(`19:00 ngày ${dd}`) && o[1].body.includes('120.000 đ'), o[1]?.body);
ok('người chơi không nhận thông báo khi tự giữ chỗ', (await inbox(player)).length === 0);
const id1 = Number(b1.id);

// 2. Báo chuyển khoản -> chủ sân; 3. xác nhận -> người chơi
await as(player, () => q(`select report_payment($1, 'ck')`, [id1]));
o = await inbox(owner);
ok('báo chuyển khoản: chủ sân nhận, link tới tab chờ xác nhận', o.at(-1).kind === 'payment_reported' && o.at(-1).link === '/owner/bookings?status=awaiting_confirmation', o.at(-1).body);
await as(owner, () => q(`select confirm_payment($1)`, [id1]));
let p = await inbox(player);
ok('xác nhận: người chơi nhận "Chủ sân đã xác nhận", link tới lượt đặt', p.length === 1 && p[0].kind === 'booking_confirmed' && p[0].link === `/bookings/${id1}`, p[0]?.body);

// 4. Chủ sân hủy (kèm lý do) -> người chơi; 5. người chơi hủy -> chủ sân
const [{ r: b2 }] = await book(player, courts[1], '20:00');
const id2 = Number(b2.id);
await as(player, () => q(`select report_payment($1, 'ck')`, [id2]));
await as(owner, () => q(`select cancel_booking($1, 'Chưa nhận được tiền')`, [id2]));
p = await inbox(player);
ok('chủ sân hủy: người chơi nhận kèm lý do', p.at(-1).kind === 'booking_cancelled' && p.at(-1).body.includes('Lý do: Chưa nhận được tiền'), p.at(-1).body);
const [{ r: b3 }] = await book(player2, courts[1], '21:00');
const id3 = Number(b3.id);
await as(player2, () => q(`select cancel_booking($1)`, [id3]));
o = await inbox(owner);
ok('người chơi hủy: chủ sân nhận "Người chơi đã hủy lượt đặt"', o.at(-1).title === 'Người chơi đã hủy lượt đặt', o.at(-1).body);

// 6. Hết hạn giữ chỗ -> người chơi
const [{ r: b4 }] = await book(player2, courts[0], '06:00');
const id4 = Number(b4.id);
await db.exec(`update bookings set hold_expires_at = now() - interval '1 minute' where id = ${id4}; select expire_holds();`);
const p2 = await inbox(player2);
ok('hết hạn: người chơi nhận "Hết thời gian giữ chỗ"', p2.at(-1).kind === 'booking_expired' && p2.at(-1).link === `/bookings/${id4}`, p2.at(-1).body);

// RLS: chỉ thấy thông báo của mình, không tự tạo/sửa được
const seen = await as(player, () => q(`select count(*)::int n, count(distinct user_id)::int who from notifications`));
ok('người chơi chỉ đọc được thông báo của mình', seen[0].n === (await inbox(player)).length && seen[0].who === 1, JSON.stringify(seen[0]));
let blocked = 0;
for (const sql of [`insert into notifications (user_id, kind, title, body, link) values ('${player}', 'booking_new', 'x', 'x', '/')`,
                   `update notifications set read_at = now()`,
                   `select notify('${player}', 'booking_new', 'x', 'x', '/')`]) {
  try { await as(player, () => q(sql)); } catch { blocked += 1; }
}
ok('không tự chèn, sửa thông báo hay gọi notify được', blocked === 3, `${blocked}/3 bị chặn`);

// Đánh dấu đã đọc
const unread = async (uid) => (await q(`select count(*)::int n from notifications where user_id = $1 and read_at is null`, [uid]))[0].n;
const firstId = (await q(`select id from notifications where user_id = $1 order by id limit 1`, [owner]))[0].id;
const before = await unread(owner);
const [{ n: one }] = await as(owner, () => q(`select mark_notifications_read(array[$1]::bigint[]) n`, [firstId]));
ok('đánh dấu một thông báo', one === 1 && (await unread(owner)) === before - 1);
const [{ n: other }] = await as(player, () => q(`select mark_notifications_read(array[$1]::bigint[]) n`, [firstId + 1]));
ok('không đánh dấu được thông báo của người khác', other === 0 && (await unread(owner)) === before - 1);
await as(owner, () => q(`select mark_notifications_read() n`));
ok('đánh dấu tất cả', (await unread(owner)) === 0);

// Tắt khi nạp dữ liệu hàng loạt
await db.exec(`select set_config('app.skip_notifications', '1', false);`);
const total = (await q(`select count(*)::int n from notifications`))[0].n;
await book(player, courts[1], '08:00');
ok('app.skip_notifications = 1 thì không sinh thông báo', (await q(`select count(*)::int n from notifications`))[0].n === total);

// 0007: lượt chờ xác nhận đã qua giờ chơi vẫn được chủ sân xử lý; người chơi không tự hủy được
await db.exec(`select set_config('app.skip_notifications', '', false);`);
const overdue = async (time) => {
  const [{ r }] = await book(player, courts[0], time);
  const id = Number(r.id);
  await as(player, () => q(`select report_payment($1, 'ck')`, [id]));
  // Lùi khung giờ về hôm qua để giả lập đã qua giờ chơi
  await db.exec(`update booking_items set booking_date = current_date - 1 where booking_id = ${id}`);
  return id;
};
const late1 = await overdue('10:00');
let refused = false;
try { await as(player, () => q(`select cancel_booking($1)`, [late1])); } catch { refused = true; }
ok('0007: người chơi không hủy được lượt đã qua giờ chơi', refused);
await as(owner, () => q(`select cancel_booking($1, 'Không thấy tiền về tài khoản')`, [late1]));
const [s1] = await q(`select status from bookings where id = $1`, [late1]);
const [n1] = await q(`select body from notifications where booking_id = $1 and user_id = $2 order by id desc limit 1`, [late1, player]);
ok('0007: chủ sân "Chưa nhận được" lượt chờ xác nhận quá giờ, người chơi được báo', s1.status === 'cancelled' && n1?.body.includes('Không thấy tiền'), n1?.body);
const late2 = await overdue('11:00');
await as(owner, () => q(`select confirm_payment($1)`, [late2]));
ok('0007: chủ sân xác nhận được lượt chờ xác nhận quá giờ', (await q(`select status from bookings where id = $1`, [late2]))[0].status === 'confirmed');
const [{ id: late3 }] = await q(`select id from bookings where status = 'confirmed' and id = $1`, [late2]);
let stillLocked = false;
try { await as(owner, () => q(`select cancel_booking($1, 'x')`, [late3])); } catch { stillLocked = true; }
ok('0007: lượt đã xác nhận và đã qua giờ chơi vẫn không hủy được', stillLocked);
