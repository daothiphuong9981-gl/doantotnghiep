// Kiểm tra 0011_email_outbox.sql: chủ sân xác nhận -> đúng một thư vào hàng đợi, nội dung chụp đúng, không ai ngoài
// service_role đọc được; nhận việc / ghi kết quả / gửi lại; bỏ qua dữ liệu demo.
// Chạy: node supabase/tests/email-outbox.test.mjs
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
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
await db.exec(file('../migrations/0001_init.sql'));
await db.exec(file('../seed.sql'));
for (const f of ['0002_bookings.sql', '0004_venue_rules.sql', '0005_admin_stats_ai.sql', '0006_notifications.sql', '0007_overdue_awaiting.sql']) await db.exec(file('../migrations/' + f));
// Giống Supabase thật: bảng mới mặc định cấp quyền cho anon/authenticated; 0011 phải tự thu hồi
await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;`);
await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
for (const f of ['0008_performance.sql', '0009_security.sql', '0010_payment_qr.sql', '0011_email_outbox.sql', '0012_venue_reviews.sql']) await db.exec(file('../migrations/' + f));

const mk = async (email, role, name) => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
  [email, JSON.stringify({ full_name: name ?? email, phone: '0900000000', role })]))[0].id;
const player = await mk('player@gmail.com', 'player', 'Nguyễn Văn An');
const owner = await mk('chusan@gmail.com', 'owner', 'Chủ Sân');
const [{ id: venue }] = await q(`insert into venues (owner_id, ward_id, name, address, contact_phone, latitude, longitude, open_time, close_time, bank_name, bank_bin, bank_account_number, bank_account_name, status)
  values ($1, 1, 'Sân Cầu Lông Hòa Xuân', '12 Trần Đăng Ninh', '0905123456', 16.06, 108.22, '05:00', '22:00', 'BIDV', '970418', '0123456789', 'NGUYEN VAN A', 'approved') returning id`, [owner]);
await db.exec(`insert into courts (venue_id, name) values (${venue}, 'Sân 1'), (${venue}, 'Sân 2');
               insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${venue}, 'weekday', '05:00', '22:00', 100000), (${venue}, 'weekend', '05:00', '22:00', 120000);`);
const courts = (await q(`select id from courts where venue_id = $1 order by id`, [venue])).map((r) => r.id);
const day = (await q(`select (current_date + 2)::text d`))[0].d;
const book = async (uid, items) => (await as(uid, () => q(`select create_booking($1, $2::jsonb) r`, [venue, JSON.stringify(items)])))[0].r.id;
const outbox = () => q(`select * from email_outbox order by id`);

const b1 = await book(player, [{ court_id: courts[0], booking_date: day, start_time: '19:00' }, { court_id: courts[1], booking_date: day, start_time: '18:00' }]);
ok('giữ chỗ: chưa có thư', (await outbox()).length === 0);
await as(player, () => q(`select report_payment($1, null)`, [b1]));
ok('báo chuyển khoản: chưa có thư', (await outbox()).length === 0);
await as(owner, () => q(`select confirm_payment($1)`, [b1]));
let rows = await outbox();
ok('chủ sân xác nhận: đúng 1 thư vào hàng đợi', rows.length === 1 && rows[0].status === 'pending' && rows[0].kind === 'booking_confirmed');
const m = rows[0];
ok('gửi tới email người chơi, trả lời tới email chủ sân', m.to_email === 'player@gmail.com' && m.reply_to === 'chusan@gmail.com', JSON.stringify({ to: m.to_email, reply: m.reply_to }));
const p = m.payload;
const code = (await q(`select code from bookings where id = $1`, [b1]))[0].code;
ok('nội dung thư: mã lượt, tên người chơi, sân, địa chỉ, SĐT, tổng tiền', p.code === code && p.player_name === 'Nguyễn Văn An' && p.venue_name === 'Sân Cầu Lông Hòa Xuân'
  && p.venue_address === '12 Trần Đăng Ninh' && p.venue_phone === '0905123456' && p.total_amount > 0 && p.booking_id === b1 && p.confirmed_at, JSON.stringify(p));
ok('nội dung thư: các khung giờ theo thứ tự giờ', p.items.length === 2 && p.items[0].start_time === '18:00' && p.items[0].court_name === 'Sân 2' && p.items[1].start_time === '19:00' && p.items[0].booking_date === day, JSON.stringify(p.items));

// Không ai ngoài service_role đọc/ghi được hàng đợi (chứa email người dùng)
for (const [who, uid, role] of [['khách', null, 'anon'], ['người chơi', player, 'authenticated'], ['chủ sân', owner, 'authenticated']]) {
  const read = await errorOf(() => as(uid, () => q(`select * from email_outbox`), role));
  ok(`${who} không đọc được email_outbox`, read !== null && /permission denied/i.test(read), read ?? '');
  const claim = await errorOf(() => as(uid, () => q(`select * from claim_email_outbox(10)`), role));
  ok(`${who} không gọi được claim_email_outbox`, claim !== null);
}
const inject = await errorOf(() => as(owner, () => q(`insert into email_outbox (booking_id, kind, to_email, payload) values ($1, 'booking_confirmed', 'x@x', '{}')`, [b1])));
ok('chủ sân không tự chèn thư được', inject !== null);

// Nhận việc, gửi lỗi, gửi lại, gửi thành công (chạy với vai trò service_role)
const svc = (fn) => as(null, fn, 'service_role');
let claimed = await svc(() => q(`select * from claim_email_outbox(10)`));
ok('service_role nhận thư cần gửi', claimed.length === 1 && claimed[0].status === 'sending' && claimed[0].attempts === 1);
ok('đang gửi thì lần nhận sau không nhận trùng', (await svc(() => q(`select * from claim_email_outbox(10)`))).length === 0);
await svc(() => q(`select finish_email_outbox($1, false, 'SMTP timeout')`, [m.id]));
rows = await outbox();
ok('gửi lỗi: ghi lỗi, chờ gửi lại', rows[0].status === 'failed' && rows[0].last_error === 'SMTP timeout');
claimed = await svc(() => q(`select * from claim_email_outbox(10)`));
ok('thư lỗi được nhận lại để gửi lại', claimed.length === 1 && claimed[0].attempts === 2);
await svc(() => q(`select finish_email_outbox($1, true)`, [m.id]));
rows = await outbox();
ok('gửi thành công: sent, có sent_at, xóa lỗi', rows[0].status === 'sent' && rows[0].sent_at && rows[0].last_error === null);
ok('đã gửi thì không nhận lại', (await svc(() => q(`select * from claim_email_outbox(10)`))).length === 0);

// Thư lỗi quá 5 lần thì dừng
const b2 = await book(player, [{ court_id: courts[0], booking_date: day, start_time: '07:00' }]);
await as(player, () => q(`select report_payment($1, null)`, [b2]));
await as(owner, () => q(`select confirm_payment($1)`, [b2]));
const id2 = (await q(`select id from email_outbox where booking_id = $1`, [b2]))[0].id;
for (let i = 0; i < 5; i += 1) {
  const c = await svc(() => q(`select id from claim_email_outbox(10)`));
  if (c.length) await svc(() => q(`select finish_email_outbox($1, false, 'loi')`, [id2]));
}
ok('lỗi 5 lần: không thử nữa', (await svc(() => q(`select * from claim_email_outbox(10)`))).length === 0 && (await q(`select attempts from email_outbox where id = $1`, [id2]))[0].attempts === 5);

// Gửi treo quá 10 phút thì được nhận lại
const b3 = await book(player, [{ court_id: courts[1], booking_date: day, start_time: '08:00' }]);
await as(player, () => q(`select report_payment($1, null)`, [b3]));
await as(owner, () => q(`select confirm_payment($1)`, [b3]));
await svc(() => q(`select * from claim_email_outbox(10)`));
await db.exec(`update email_outbox set locked_at = now() - interval '11 minutes' where booking_id = ${b3}`);
ok('đang gửi bị treo quá 10 phút: được nhận lại', (await svc(() => q(`select booking_id from claim_email_outbox(10)`))).some((r) => r.booking_id === b3));

// Thư quá 2 ngày chưa gửi (ví dụ bật cấu hình email muộn) thì không gửi dồn
await db.exec(`update email_outbox set status = 'pending', attempts = 0, locked_at = null, created_at = now() - interval '3 days' where booking_id = ${b3}`);
ok('thư chờ quá 2 ngày: không gửi', !(await svc(() => q(`select booking_id from claim_email_outbox(10)`))).some((r) => r.booking_id === b3));

// Không gửi trùng khi trạng thái đổi qua lại; hủy, hết hạn không sinh thư
await db.exec(`update bookings set status = 'awaiting_confirmation' where id = ${b1}; update bookings set status = 'confirmed' where id = ${b1};`);
ok('xác nhận lại cùng lượt: không thêm thư trùng', (await q(`select count(*)::int n from email_outbox where booking_id = $1`, [b1]))[0].n === 1);
const b4 = await book(player, [{ court_id: courts[0], booking_date: day, start_time: '09:00' }]);
await as(player, () => q(`select cancel_booking($1, null)`, [b4]));
ok('hủy lượt: không có thư', (await q(`select count(*)::int n from email_outbox where booking_id = $1`, [b4]))[0].n === 0);

// Dữ liệu demo đặt app.skip_notifications = '1': không sinh thư
const b5 = await book(player, [{ court_id: courts[0], booking_date: day, start_time: '10:00' }]);
await as(player, () => q(`select report_payment($1, null)`, [b5]));
await db.exec(`select set_config('app.skip_notifications', '1', false); update bookings set status = 'confirmed' where id = ${b5}; select set_config('app.skip_notifications', '', false);`);
ok('nạp dữ liệu demo (skip_notifications): không sinh thư', (await q(`select count(*)::int n from email_outbox where booking_id = $1`, [b5]))[0].n === 0);

// Người chơi không có email (tài khoản đã xóa): không sinh thư, không lỗi
const b6 = await book(player, [{ court_id: courts[1], booking_date: day, start_time: '11:00' }]);
await as(player, () => q(`select report_payment($1, null)`, [b6]));
await db.exec(`update auth.users set email = null where id = '${player}'`);
await as(owner, () => q(`select confirm_payment($1)`, [b6]));
ok('người chơi không có email: xác nhận vẫn thành công, không có thư', (await q(`select status from bookings where id = $1`, [b6]))[0].status === 'confirmed'
  && (await q(`select count(*)::int n from email_outbox where booking_id = $1`, [b6]))[0].n === 0);

// Thư đã gửi quá 30 ngày được dọn khi nhận việc
await db.exec(`update email_outbox set sent_at = now() - interval '31 days' where id = ${m.id}`);
await svc(() => q(`select * from claim_email_outbox(1)`));
ok('thư đã gửi quá 30 ngày được xóa', (await q(`select count(*)::int n from email_outbox where id = $1`, [m.id]))[0].n === 0);

// Thông báo trong ứng dụng vẫn hoạt động song song
ok('thông báo trong ứng dụng vẫn được tạo', (await q(`select count(*)::int n from notifications where user_id = $1 and kind = 'booking_confirmed'`, [player]))[0].n >= 2);

console.log(process.exitCode ? '\nCÓ KIỂM TRA LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
