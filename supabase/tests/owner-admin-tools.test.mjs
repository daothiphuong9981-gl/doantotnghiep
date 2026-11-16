// Kiểm tra 0015_owner_bookings_fixes.sql và 0016_owner_admin_tools.sql:
//  - lịch đặt chủ sân lọc/đếm/tìm/phân trang trong SQL, không thấy chéo sân người khác;
//  - không ngừng được sân con còn lượt đặt sắp tới;
//  - danh sách sân của quản trị viên đếm/lọc trong SQL;
//  - chủ sân đặt hộ khách vãng lai / khóa khung giờ (chặn trùng, không thông báo, hủy được);
//  - xóa sân chưa có lượt đặt; khóa tài khoản bắt buộc lý do; nhật ký quản trị; chi tiết người dùng;
//  - chạy lại hai migration không lỗi.
// Chạy: node supabase/tests/owner-admin-tools.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import fs from 'fs';

const db = new PGlite({ extensions: { postgis } });
const file = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const q = async (sql, p) => (await db.query(sql, p)).rows;
let passed = 0;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, cond ? '' : extra); if (cond) passed += 1; else process.exitCode = 1; };
const as = async (uid, fn, role = 'authenticated') => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const detailOf = async (fn) => { try { await fn(); return null; } catch (e) { return `${e.message}: ${e.detail ?? ''}`; } };

await db.exec(`
create schema auth; create schema storage;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb, last_sign_in_at timestamptz);
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
// Giống Supabase thật: bảng mới mặc định cấp quyền cho anon/authenticated; migration phải tự thu hồi
await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;`);
await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
for (const f of ['0008_performance.sql', '0009_security.sql', '0010_payment_qr.sql', '0011_email_outbox.sql', '0012_venue_reviews.sql', '0013_review_reminders.sql', '0014_performance2.sql', '0015_owner_bookings_fixes.sql', '0016_owner_admin_tools.sql']) {
  await db.exec(file('../migrations/' + f));
}

const mk = async (email, role, name, phone = '0900000000') => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
  [email, JSON.stringify({ full_name: name ?? email, phone, role })]))[0].id;
const player = await mk('an@x', 'player', 'Nguyễn Văn An', '0905111222');
const player2 = await mk('binh@x', 'player', 'Trần Thị Bình', '0905333444');
const owner = await mk('o@x', 'owner', 'Chủ Sân');
const owner2 = await mk('o2@x', 'owner', 'Chủ Sân Khác');
const admin = await mk('a@x', 'player', 'Quản Trị');
await db.exec(`update profiles set role = 'admin' where id = '${admin}'`);
const mkVenue = async (own, name, status = 'approved') => {
  const [{ id }] = await q(`insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, bank_name, bank_account_number, bank_account_name, status)
    values ($1, 1, $2, 'Đường Nguyễn Văn Linh', 16.06, 108.22, '05:00', '23:00', 'BIDV', '0123456789', 'A', $3) returning id`, [own, name, status]);
  await db.exec(`insert into courts (venue_id, name) values (${id}, 'Sân 1'), (${id}, 'Sân 2'), (${id}, 'Sân 3');
                 insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${id}, 'weekday', '05:00', '23:00', 80000), (${id}, 'weekend', '05:00', '23:00', 100000);`);
  return id;
};
const venue = await mkVenue(owner, 'Sân Một');
const venue2 = await mkVenue(owner2, 'Sân Hai');
const courts = async (v) => (await q(`select id from courts where venue_id = $1 order by id`, [v])).map((r) => Number(r.id));
const [c1, c2, c3] = await courts(venue);
const day = (await q(`select (current_date + 3)::text d`))[0].d;
const day2 = (await q(`select (current_date + 4)::text d`))[0].d;
const item = (court, time, date = day) => ({ court_id: court, booking_date: date, start_time: time });
const book = async (uid, v, items, status = 'holding') => {
  const id = (await as(uid, () => q(`select create_booking($1, $2::jsonb) r`, [v, JSON.stringify(items)])))[0].r.id;
  if (status !== 'holding') await as(uid, () => q(`select report_payment($1, null)`, [id]));
  if (status === 'confirmed') await as(v === venue ? owner : owner2, () => q(`select confirm_payment($1)`, [id]));
  if (status === 'cancelled') await as(v === venue ? owner : owner2, () => q(`select cancel_booking($1, 'x')`, [id]));
  return Number(id);
};
const page = (uid, args = {}) => as(uid, async () => (await q(`select owner_bookings_page($1, $2, $3, $4, $5, $6) r`,
  [args.venue ?? null, args.date ?? null, args.status ?? null, args.q ?? null, args.limit ?? 30, args.offset ?? 0]))[0].r);

// ---------------------------------------------------------------- 0015: lịch đặt chủ sân
const bHold = await book(player, venue, [item(c1, '06:00')]);
const bAwait = await book(player, venue, [item(c1, '07:00')], 'awaiting');
const bConf = await book(player2, venue, [item(c2, '08:00', day2)], 'confirmed');
const bCanc = await book(player2, venue, [item(c2, '09:00')], 'cancelled');
await book(player, venue2, [item((await courts(venue2))[0], '06:00')]); // sân của người khác

let r = await page(owner);
ok('tổng hợp theo trạng thái đúng (1 giữ chỗ, 1 chờ xác nhận, 1 đã xác nhận, 1 đã hủy)',
  r.summary.holding === 1 && r.summary.awaiting_confirmation === 1 && r.summary.confirmed === 1 && r.summary.closed === 1 && r.total === 4, JSON.stringify(r));
ok('không thấy lượt đặt của sân người khác', !r.ids.some((id) => ![bHold, bAwait, bConf, bCanc].includes(Number(id))));
ok('mới nhất trước', Number(r.ids[0]) === bCanc);
r = await page(owner, { status: 'closed' });
ok('tab "Đã hủy, hết hạn" trả lượt đã hủy', r.total === 1 && Number(r.ids[0]) === bCanc);
r = await page(owner, { date: day2 });
ok('lọc theo ngày chơi: chỉ lượt có khung giờ ngày đó; số đếm theo ngày', r.total === 1 && Number(r.ids[0]) === bConf && r.summary.holding === 0);
const code = (await q(`select code from bookings where id = $1`, [bAwait]))[0].code;
r = await page(owner, { q: code.toLowerCase() });
ok('tìm theo mã lượt (không phân biệt hoa thường)', r.total === 1 && Number(r.ids[0]) === bAwait);
r = await page(owner, { q: 'tran thi binh' });
ok('tìm theo tên không dấu', r.total === 2 && r.summary.confirmed === 1 && r.summary.closed === 1, JSON.stringify(r));
r = await page(owner, { q: '0905 111' });
ok('tìm theo số điện thoại (bỏ khoảng trắng)', r.total === 2);
r = await page(owner, { limit: 2, offset: 2 });
ok('phân trang: trang 2 có 2 lượt, tổng vẫn 4', r.ids.length === 2 && r.total === 4);
ok('chủ sân khác truyền venue_id không phải của mình: FORBIDDEN', /FORBIDDEN/.test(await detailOf(() => page(owner2, { venue }))));
ok('người chơi gọi: FORBIDDEN', /FORBIDDEN/.test(await detailOf(() => page(player))));
ok('trạng thái lạ: INVALID_INPUT', /INVALID_INPUT/.test(await detailOf(() => page(owner, { status: 'cancelled' }))));
// Lượt giữ chỗ hết hạn: không tìm được theo tên người giữ (0009 không cho chủ sân xem thông tin họ)
await db.exec(`update bookings set hold_expires_at = now() - interval '1 minute' where id = ${bHold}; select expire_holds();`);
r = await page(owner, { q: 'nguyen van an' });
ok('giữ chỗ hết hạn không tìm được theo tên người giữ', !r.ids.map(Number).includes(bHold) && r.ids.map(Number).includes(bAwait));

// ---------------------------------------------------------------- 0015: ngừng sân con
const deactivate = (uid, court) => as(uid, () => q(`update courts set is_active = false where id = $1 returning id`, [court]));
const msg = await detailOf(() => deactivate(owner, c1));
ok('không ngừng được sân con còn khung giờ đã đặt sắp tới, báo rõ sân và giờ', /INVALID_STATE/.test(msg) && /Sân 1 còn 1 khung giờ/.test(msg) && /07:00/.test(msg), msg);
ok('sân con không có lượt sắp tới thì ngừng được', (await deactivate(owner, c3)).length === 1);
await as(owner, () => q(`update courts set is_active = true where id = $1`, [c3]));
ok('mở lại sân con được', (await q(`select is_active from courts where id = $1`, [c3]))[0].is_active === true);

// ---------------------------------------------------------------- 0015: danh sách sân của quản trị viên
await mkVenue(owner, 'Sân Chờ Duyệt Hòa Xuân', 'pending');
const vpage = (uid, args = {}) => as(uid, async () => (await q(`select admin_venue_page($1, $2, $3, $4) r`, [args.status ?? null, args.q ?? null, args.limit ?? 30, args.offset ?? 0]))[0].r);
r = await vpage(admin);
ok('admin: đếm theo trạng thái', r.counts.approved === 2 && r.counts.pending === 1 && r.total === 3, JSON.stringify(r.counts));
r = await vpage(admin, { status: 'pending' });
ok('admin: lọc chờ duyệt', r.total === 1);
r = await vpage(admin, { q: 'hoa xuan' });
ok('admin: tìm không dấu theo tên', r.total === 1 && r.counts.pending === 1 && r.counts.approved === 0);
ok('không phải admin: FORBIDDEN', /FORBIDDEN/.test(await detailOf(() => vpage(owner))));

// ---------------------------------------------------------------- 0016: đặt hộ / khóa giờ
const offline = (uid, v, kind, items, name = null, phone = null) => as(uid, async () =>
  (await q(`select owner_create_offline_booking($1, $2, $3::jsonb, $4, $5) r`, [v, kind, JSON.stringify(items), name, phone]))[0].r);
const notifBefore = (await q(`select count(*)::int n from notifications`))[0].n;
const walk = await offline(owner, venue, 'walk_in', [item(c3, '18:00'), item(c3, '19:00')], '  Anh   Minh ', '0905 999 888');
let row = (await q(`select * from bookings where id = $1`, [walk.id]))[0];
ok('đặt hộ: xác nhận ngay, không có người chơi, tính tiền theo bảng giá', row.status === 'confirmed' && row.player_id === null && row.kind === 'walk_in' && Number(row.total_amount) === 160000 && walk.code.startsWith('DS'),
  JSON.stringify(row));
ok('đặt hộ: chuẩn hóa tên và SĐT khách', row.guest_name === 'Anh Minh' && row.guest_phone === '0905999888');
const block = await offline(owner, venue, 'block', [item(c3, '20:00')], 'Bảo trì');
row = (await q(`select * from bookings where id = $1`, [block.id]))[0];
ok('khóa giờ: 0 đồng, ghi chú lưu ở guest_name, không lưu SĐT', row.kind === 'block' && Number(row.total_amount) === 0 && row.guest_name === 'Bảo trì' && row.guest_phone === null);
ok('không tạo thông báo hay thư cho lượt đặt hộ', (await q(`select count(*)::int n from notifications`))[0].n === notifBefore
  && (await q(`select count(*)::int n from email_outbox where booking_id in (${walk.id}, ${block.id})`))[0].n === 0);
ok('người chơi đặt trùng giờ đã đặt hộ: SLOT_TAKEN', /SLOT_TAKEN/.test(await detailOf(() => book(player, venue, [item(c3, '19:00')]))));
const taken = await as(null, () => q(`select * from venue_taken_slots($1, $2)`, [venue, day]), 'anon');
ok('khung giờ khóa hiện "Đã đặt" với người khác', taken.some((t) => Number(t.court_id) === c3 && t.start_time === '20:00:00' && t.state === 'booked'));
ok('đặt hộ trùng khung đang có người giữ: SLOT_TAKEN', /SLOT_TAKEN/.test(await detailOf(() => offline(owner, venue, 'block', [item(c1, '07:00')]))));
ok('đặt hộ thiếu tên khách: INVALID_INPUT', /Hãy nhập tên khách/.test(await detailOf(() => offline(owner, venue, 'walk_in', [item(c2, '15:00')]))));
ok('SĐT sai định dạng: INVALID_INPUT', /10 chữ số/.test(await detailOf(() => offline(owner, venue, 'walk_in', [item(c2, '15:00')], 'Khách', '123'))));
ok('khung giờ đã qua: INVALID_INPUT', /đã qua/.test(await detailOf(() => offline(owner, venue, 'block', [item(c2, '10:00', '2020-01-01')]))));
ok('ngoài giờ mở cửa: INVALID_INPUT', /ngoài giờ mở cửa/.test(await detailOf(() => offline(owner, venue, 'block', [item(c2, '23:00')]))));
ok('sân của chủ khác: FORBIDDEN', /FORBIDDEN/.test(await detailOf(() => offline(owner2, venue, 'block', [item(c2, '15:00')]))));
ok('người chơi không gọi được', /FORBIDDEN/.test(await detailOf(() => offline(player, venue, 'block', [item(c2, '15:00')]))));
const det = await as(owner, () => q(`select kind, guest_name, guest_phone from booking_details where id = $1`, [walk.id]));
ok('booking_details có kind, guest_name, guest_phone cho chủ sân', det[0]?.kind === 'walk_in' && det[0]?.guest_name === 'Anh Minh');
ok('người chơi không đọc được lượt đặt hộ', (await as(player, () => q(`select id from booking_details where id = $1`, [walk.id]))).length === 0);
r = await page(owner, { q: 'anh minh' });
ok('lịch đặt tìm được theo tên khách vãng lai', r.ids.map(Number).includes(walk.id));
r = await page(owner, { q: '999888' });
ok('lịch đặt tìm được theo SĐT khách vãng lai', r.ids.map(Number).includes(walk.id));
await as(owner, () => q(`select cancel_booking($1, 'Mở lại khung giờ')`, [block.id]));
ok('chủ sân mở lại khung giờ đã khóa (hủy), người chơi đặt lại được', (await book(player2, venue, [item(c3, '20:00')])) > 0);
ok('lượt đặt cũ vẫn có kind = online', (await q(`select kind from bookings where id = $1`, [bConf]))[0].kind === 'online');

// ---------------------------------------------------------------- 0016: xóa sân
const empty = await mkVenue(owner, 'Sân Đăng Nhầm');
await db.exec(`insert into venue_images (venue_id, storage_path, sort_order) values (${empty}, '${empty}/a.jpg', 0)`);
ok('chủ sân khác không xóa được', /FORBIDDEN/.test(await detailOf(() => as(owner2, () => q(`select owner_delete_venue($1)`, [empty])))));
ok('sân đã có lượt đặt: không xóa được', /đã có lượt đặt/.test(await detailOf(() => as(owner, () => q(`select owner_delete_venue($1)`, [venue])))));
await as(owner, () => q(`select owner_delete_venue($1)`, [empty]));
ok('sân chưa có lượt đặt: xóa hẳn cùng sân con, bảng giá, ảnh',
  (await q(`select count(*)::int n from venues where id = $1`, [empty]))[0].n === 0 && (await q(`select count(*)::int n from courts where venue_id = $1`, [empty]))[0].n === 0
  && (await q(`select count(*)::int n from venue_images where venue_id = $1`, [empty]))[0].n === 0);

// ---------------------------------------------------------------- 0016: khóa tài khoản, nhật ký
const lock = (uid, target, locked, reason = null) => as(uid, async () => (await q(`select admin_set_user_lock($1, $2, $3) r`, [target, locked, reason]))[0].r);
ok('khóa không có lý do: INVALID_INPUT', /lý do/.test(await detailOf(() => lock(admin, player2, true))));
await lock(admin, player2, true, 'Giữ chỗ ảo nhiều lần');
let prof = (await q(`select is_locked, lock_reason, locked_at from profiles where id = $1`, [player2]))[0];
ok('khóa kèm lý do và thời điểm', prof.is_locked === true && prof.lock_reason === 'Giữ chỗ ảo nhiều lần' && prof.locked_at !== null);
ok('người bị khóa đọc được lý do của chính mình', (await as(player2, () => q(`select lock_reason from profiles where id = $1`, [player2])))[0]?.lock_reason === 'Giữ chỗ ảo nhiều lần');
ok('người dùng không tự sửa được lock_reason', (await detailOf(() => as(player, () => q(`update profiles set lock_reason = 'x' where id = $1`, [player])))) !== null);
await lock(admin, player2, false);
prof = (await q(`select is_locked, lock_reason, locked_at from profiles where id = $1`, [player2]))[0];
ok('mở khóa xóa lý do', prof.is_locked === false && prof.lock_reason === null && prof.locked_at === null);
ok('không phải admin không khóa được', /FORBIDDEN/.test(await detailOf(() => lock(owner, player2, true, 'x'))));
ok('gọi theo chữ ký cũ (2 tham số) vẫn được khi mở khóa', (await as(admin, () => q(`select admin_set_user_lock($1, false) r`, [player2])))[0].r.is_locked === false);

const pendingId = (await q(`select id from venues where name = 'Sân Chờ Duyệt Hòa Xuân'`))[0].id;
await as(admin, () => q(`select admin_review_venue($1, 'reject', 'Thiếu ảnh')`, [pendingId]));
await as(admin, () => q(`select admin_review_venue($1, 'approve')`, [pendingId]));
await as(admin, () => q(`select admin_review_venue($1, 'hide', 'Sai địa chỉ')`, [venue2]));
// Đánh giá rồi admin ẩn
await db.exec(`update bookings set confirmed_at = now() - interval '1 hour' where id = ${bConf}`);
const reviewId = (await as(player2, () => q(`select submit_review($1, 2, 'Tệ') r`, [bConf])))[0].r;
await as(admin, () => q(`select admin_set_review_status($1, 'hidden', 'Ngôn từ không phù hợp')`, [reviewId]));
// Chủ sân tự tạm ngừng: không phải thao tác quản trị, không ghi
await as(owner, () => q(`update venues set status = 'suspended' where id = $1`, [venue]));

const logs = await as(admin, () => q(`select action, target_type, target_label, detail, admin_id from admin_logs order by id`));
const actions = logs.map((l) => l.action);
ok('nhật ký ghi khóa / mở khóa tài khoản (mở khóa tài khoản đang mở thì không ghi)', actions.filter((a) => a === 'Khóa tài khoản').length === 1 && actions.filter((a) => a === 'Mở khóa tài khoản').length === 1, actions.join(', '));
ok('nhật ký ghi từ chối, duyệt, ẩn sân kèm lý do', actions.includes('Từ chối sân') && actions.includes('Duyệt sân') && logs.some((l) => l.action === 'Ẩn sân' && l.detail === 'Sai địa chỉ' && l.target_label === 'Sân Hai'));
ok('nhật ký ghi ẩn đánh giá kèm lý do', logs.some((l) => l.action === 'Ẩn đánh giá' && l.target_type === 'review' && l.detail === 'Ngôn từ không phù hợp'));
ok('nhật ký ghi người thực hiện', logs.every((l) => l.admin_id === admin));
ok('thao tác của chủ sân không ghi vào nhật ký quản trị', !actions.some((a) => /Đổi trạng thái/.test(a)));
ok('chủ sân, người chơi không đọc được nhật ký', (await as(owner, () => q(`select * from admin_logs`))).length === 0 && (await as(player, () => q(`select * from admin_logs`))).length === 0);
ok('không ai ghi trực tiếp vào nhật ký', (await detailOf(() => as(admin, () => q(`insert into admin_logs (action, target_type, target_id) values ('x', 'user', '1')`)))) !== null);

// ---------------------------------------------------------------- 0016: chi tiết người dùng
const ud = (await as(admin, () => q(`select admin_user_detail($1) r`, [player2])))[0].r;
ok('chi tiết người dùng: hồ sơ, email, số lượt theo trạng thái, lượt gần đây, lịch sử khóa',
  ud.email === 'binh@x' && ud.booking_counts.confirmed === 1 && ud.booking_counts.cancelled === 1 && ud.recent_bookings.length >= 3 && ud.logs.length === 2 && ud.reviews === 1,
  JSON.stringify({ c: ud.booking_counts, l: ud.logs.length, r: ud.reviews }));
const od = (await as(admin, () => q(`select admin_user_detail($1) r`, [owner])))[0].r;
ok('chi tiết chủ sân: danh sách sân kèm số lượt đặt', od.venues.length === 2 && od.venues.some((v) => v.name === 'Sân Một' && Number(v.bookings) >= 5));
ok('chi tiết người dùng: không phải admin thì FORBIDDEN', /FORBIDDEN/.test(await detailOf(() => as(owner, () => q(`select admin_user_detail($1)`, [player])))));
ok('chi tiết người dùng không tồn tại: NOT_FOUND', /NOT_FOUND/.test(await detailOf(() => as(admin, () => q(`select admin_user_detail('00000000-0000-0000-0000-000000000000')`)))));

// ---------------------------------------------------------------- Chạy lại migration
const before = (await q(`select count(*)::int n from admin_logs`))[0].n;
await db.exec(file('../migrations/0015_owner_bookings_fixes.sql'));
await db.exec(file('../migrations/0016_owner_admin_tools.sql'));
ok('chạy lại 0015 và 0016 không lỗi, không mất dữ liệu', (await q(`select count(*)::int n from admin_logs`))[0].n === before && (await q(`select kind from bookings where id = $1`, [walk.id]))[0].kind === 'walk_in');
ok('sau khi chạy lại vẫn chỉ một trigger ghi nhật ký mỗi bảng', (await q(`select count(*)::int n from pg_trigger where tgname like '%admin_log_trg'`))[0].n === 3);

console.log(`\n${passed} kiểm thử đạt`);
