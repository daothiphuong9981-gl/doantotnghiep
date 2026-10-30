// Kiểm thử cơ sở dữ liệu Sprint 3: duyệt sân, khóa tài khoản, thống kê, nhật ký AI, xóa tài khoản.
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
for (const f of ['0001_init.sql', '0002_bookings.sql', '0004_venue_rules.sql', '0005_admin_stats_ai.sql', '0006_notifications.sql', '0007_overdue_awaiting.sql', '0008_performance.sql', '0009_security.sql', '0010_payment_qr.sql']) await db.exec(read('../migrations/' + f));
await db.exec(read('../seed.sql'));

const q = async (sql, p) => (await db.query(sql, p)).rows;
const as = async (uid, role, fn) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
let passed = 0;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, cond ? '' : extra); if (cond) passed += 1; else process.exitCode = 1; };
const rejects = async (label, code, fn) => {
  try { await fn(); ok(label, false, '(không bị từ chối)'); }
  catch (e) { ok(label, e.message === code, `(nhận: ${e.message})`); }
};
const mk = async (email, meta) => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(meta)]))[0].id;
const admin = await mk('admin@x.vn', { full_name: 'Quản Trị', phone: '0900000000', role: 'player' });
await db.exec(`update profiles set role = 'admin' where id = '${admin}'`);
const admin2 = await mk('admin2@x.vn', { full_name: 'Quản Trị Hai', phone: '0900000009', role: 'player' });
await db.exec(`update profiles set role = 'admin' where id = '${admin2}'`);
const p1 = await mk('an@x.vn', { full_name: 'Nguyễn Văn An', phone: '0900000001', role: 'player' });
const p2 = await mk('binh@x.vn', { full_name: 'Trần Thị Bình', phone: '0900000002', role: 'player' });
const ownerA = await mk('chusana@x.vn', { full_name: 'Lê Văn Cường', phone: '0900000003', role: 'owner' });
const ownerB = await mk('chusanb@x.vn', { full_name: 'Phạm Thị Dung', phone: '0900000004', role: 'owner' });

const mkVenue = (owner, name) => as(owner, 'authenticated', async () => (await q(`insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, bank_name, bank_account_number, bank_account_name)
  values ($1, 1, $2, '1 Lê Lợi', 16.07, 108.22, '05:00', '22:00', 'NH', '123456', 'TEN') returning id`, [owner, name]))[0].id);
const vA = await mkVenue(ownerA, 'Sân A'); const vA2 = await mkVenue(ownerA, 'Sân A2'); const vB = await mkVenue(ownerB, 'Sân B');
await db.exec(`insert into courts (venue_id, name) values (${vA}, 'Sân 1'), (${vA}, 'Sân 2'), (${vB}, 'Sân 1');
insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${vA}, 'weekday', '05:00', '22:00', 60000), (${vA}, 'weekend', '05:00', '22:00', 80000), (${vB}, 'weekday', '05:00', '22:00', 100000);`);
const review = (uid, id, action, reason = null) => as(uid, 'authenticated', async () => (await q(`select admin_review_venue($1, $2, $3) r`, [id, action, reason]))[0].r);
const statusOf = async (id) => (await q(`select status, reject_reason, approved_at from venues where id = $1`, [id]))[0];

// --- PB19: duyệt, từ chối ---
await rejects('chủ sân tự duyệt sân qua hàm quản trị', 'FORBIDDEN', () => review(ownerA, vA, 'approve'));
await rejects('người chơi duyệt sân', 'FORBIDDEN', () => review(p1, vA, 'approve'));
await rejects('khách gọi hàm quản trị', 'permission denied for function admin_review_venue', () => as(null, 'anon', () => q(`select admin_review_venue(${vA}, 'approve', null)`)));
const r1 = await review(admin, vA, 'approve');
ok('quản trị viên duyệt sân -> approved, có approved_at', r1.status === 'approved' && (await statusOf(vA)).approved_at);
ok('sân đã duyệt hiện với khách', (await as(null, 'anon', () => q(`select id from venues`))).length === 1);
await rejects('từ chối không có lý do', 'INVALID_INPUT', () => review(admin, vA2, 'reject', '  '));
await review(admin, vA2, 'reject', 'Địa chỉ chưa rõ ràng');
const s2 = await statusOf(vA2);
ok('từ chối kèm lý do -> rejected', s2.status === 'rejected' && s2.reject_reason === 'Địa chỉ chưa rõ ràng');
ok('chủ sân thấy lý do từ chối', (await as(ownerA, 'authenticated', () => q(`select reject_reason from venues where id = ${vA2}`)))[0].reject_reason === 'Địa chỉ chưa rõ ràng');
await rejects('từ chối sân đã duyệt', 'INVALID_STATE', () => review(admin, vA, 'reject', 'x'));
await rejects('thao tác lạ', 'INVALID_INPUT', () => review(admin, vA, 'delete'));
await rejects('sân không tồn tại', 'NOT_FOUND', () => review(admin, 99999, 'approve'));
await as(ownerA, 'authenticated', () => db.exec(`update venues set address = '2 Lê Lợi', status = 'pending' where id = ${vA2}`));
ok('chủ sân sửa và gửi duyệt lại sân bị từ chối', (await statusOf(vA2)).status === 'pending');
await review(admin, vB, 'approve');

// --- PB20: ẩn sân vi phạm ---
await rejects('ẩn sân không có lý do', 'INVALID_INPUT', () => review(admin, vB, 'hide'));
await review(admin, vB, 'hide', 'Thông tin sai sự thật');
ok('ẩn sân -> không còn trong tìm kiếm và danh sách công khai', (await as(null, 'anon', () => q(`select id from search_venues()`))).every((r) => r.id !== vB) && (await as(null, 'anon', () => q(`select id from venues where id = ${vB}`))).length === 0);
await rejects('chủ sân tự mở lại sân bị ẩn', 'Không được chuyển trạng thái sân từ hidden sang approved', () => as(ownerB, 'authenticated', () => db.exec(`update venues set status = 'approved' where id = ${vB}`)));
await review(admin, vB, 'unhide');
ok('bỏ ẩn -> approved', (await statusOf(vB)).status === 'approved' && (await statusOf(vB)).reject_reason === null);

// --- PB20: người dùng ---
const list = (uid, args) => as(uid, 'authenticated', () => q(`select * from admin_list_users(${args})`));
const all = await list(admin, '');
ok('danh sách người dùng có email, tổng số', all.length === 6 && Number(all[0].total) === 6 && all.some((u) => u.email === 'an@x.vn'));
ok('tìm theo tên không dấu "van an"', (await list(admin, `p_q => 'van an'`)).map((u) => u.email).join() === 'an@x.vn');
ok('tìm theo email', (await list(admin, `p_q => 'CHUSANB'`)).map((u) => u.email).join() === 'chusanb@x.vn');
ok('lọc theo vai trò chủ sân', (await list(admin, `p_role => 'owner'`)).length === 2);
ok('phân trang', (await list(admin, `p_limit => 2, p_offset => 4`)).length === 2 && Number((await list(admin, `p_limit => 2`))[0].total) === 6);
await rejects('người chơi xem danh sách người dùng', 'FORBIDDEN', () => list(p1, ''));
const lock = (uid, target, locked) => as(uid, 'authenticated', async () => (await q(`select admin_set_user_lock($1, $2) r`, [target, locked]))[0].r);
await rejects('khóa tài khoản quản trị viên', 'FORBIDDEN', () => lock(admin, admin2, true));
await rejects('người chơi khóa người khác', 'FORBIDDEN', () => lock(p1, p2, true));
await rejects('người chơi tự mở khóa bằng cách sửa bảng', 'permission denied for table profiles', () => as(p1, 'authenticated', () => db.exec(`update profiles set is_locked = false where id = '${p1}'`)));
ok('khóa tài khoản người chơi', (await lock(admin, p2, true)).is_locked === true && (await q(`select is_locked from profiles where id = $1`, [p2]))[0].is_locked);
ok('tài khoản bị khóa mất mọi quyền (my_role = null)', (await as(p2, 'authenticated', () => q(`select my_role() r`)))[0].r === null);
const days = await q(`select d::date::text d, extract(dow from d)::int dow from generate_series(vn_now()::date + 1, vn_now()::date + 7, interval '1 day') d`);
const weekday = days.find((x) => x.dow >= 1 && x.dow <= 5).d;
const [cA1, cA2] = (await q(`select id from courts where venue_id = ${vA} order by id`)).map((r) => r.id);
const book = (uid, venue, items) => as(uid, 'authenticated', async () => (await q(`select create_booking($1, $2::jsonb) r`, [venue, JSON.stringify(items)]))[0].r);
const item = (court, date, time) => ({ court_id: court, booking_date: date, start_time: time });
await rejects('tài khoản bị khóa không đặt được sân', 'FORBIDDEN', () => book(p2, vA, [item(cA1, weekday, '10:00')]));
await lock(admin, p2, false);
ok('mở khóa -> đặt lại được', (await book(p2, vA, [item(cA1, weekday, '10:00')])).id > 0);
await db.exec(`update bookings set status = 'cancelled' where player_id = '${p2}'; update booking_items set is_active = false`);

// --- PB21: thống kê chủ sân chỉ tính lượt đã xác nhận ---
await db.exec(`update venues set max_active_holds = 10 where id = ${vA}`);
const mkBooking = async (uid, items, final) => {
  const { id } = await book(uid, vA, items);
  if (final === 'holding') return id;
  if (final === 'expired') { await db.exec(`update bookings set hold_expires_at = now() - interval '1 second' where id = ${id}; select expire_holds();`); return id; }
  if (final === 'cancelled') { await as(uid, 'authenticated', () => q(`select cancel_booking($1, null)`, [id])); return id; }
  await as(uid, 'authenticated', () => q(`select report_payment($1, null)`, [id]));
  if (final === 'confirmed') await as(ownerA, 'authenticated', () => q(`select confirm_payment($1)`, [id]));
  return id;
};
await mkBooking(p1, [item(cA1, weekday, '18:00'), item(cA1, weekday, '19:00')], 'confirmed');   // 120.000
await mkBooking(p1, [item(cA2, weekday, '19:00')], 'confirmed');                                // 60.000
await mkBooking(p2, [item(cA2, weekday, '20:00')], 'confirmed');                                // 60.000
await mkBooking(p2, [item(cA1, weekday, '06:00')], 'holding');
await mkBooking(p2, [item(cA1, weekday, '07:00')], 'expired');
await mkBooking(p1, [item(cA1, weekday, '08:00')], 'cancelled');
await mkBooking(p1, [item(cA1, weekday, '09:00')], 'awaiting');
const stats = (uid, venue, from, to) => as(uid, 'authenticated', async () => (await q(`select owner_stats($1, $2, $3) r`, [venue, from, to]))[0].r);
const today = (await q(`select vn_now()::date::text d`))[0].d;
const st = await stats(ownerA, vA, today, days[6].d);
ok('thống kê: 3 lượt đã xác nhận, 4 khung giờ, doanh thu 240.000', st.confirmed_count === 3 && st.slot_count === 4 && Number(st.revenue) === 240000, JSON.stringify(st));
ok('thống kê: lượt chờ xác nhận, đã hủy, hết hạn đếm riêng', st.awaiting_count === 1 && st.cancelled_count === 2 && st.expired_count === 1, JSON.stringify(st));
const day = st.by_day.find((d) => d.date === weekday);
ok('thống kê theo ngày đủ mọi ngày trong khoảng', st.by_day.length === 8 && day.count === 3 && Number(day.revenue) === 240000 && st.by_day.filter((d) => d.count === 0).length === 7);
ok('khung giờ được đặt nhiều nhất là 19:00', st.top_slots[0].start_time === '19:00' && st.top_slots[0].count === 2);
ok('đối chiếu doanh thu với truy vấn trực tiếp', Number(st.revenue) === Number((await q(`select sum(bi.price) s from booking_items bi join bookings b on b.id = bi.booking_id where b.venue_id = ${vA} and b.status = 'confirmed'`))[0].s));
ok('khoảng ngày không chứa lượt nào', (await stats(ownerA, vA, '2026-01-01', '2026-01-07')).confirmed_count === 0);
ok('gộp mọi sân của chủ sân khi không chọn sân', (await stats(ownerA, null, today, days[6].d)).confirmed_count === 3);
await rejects('chủ sân khác xem thống kê sân A', 'FORBIDDEN', () => stats(ownerB, vA, today, today));
await rejects('người chơi xem thống kê', 'FORBIDDEN', () => stats(p1, vA, today, today));
await rejects('khoảng ngày ngược', 'INVALID_INPUT', () => stats(ownerA, vA, days[6].d, today));
await rejects('khoảng ngày quá dài', 'INVALID_INPUT', () => stats(ownerA, vA, '2024-01-01', today));

// --- PB22: thống kê hệ thống ---
const sys = await as(admin, 'authenticated', async () => (await q(`select admin_stats() r`))[0].r);
ok('thống kê hệ thống: người dùng theo vai trò', sys.users.player === 2 && sys.users.owner === 2 && sys.users.admin === 2, JSON.stringify(sys.users));
ok('thống kê hệ thống: sân theo trạng thái', sys.venues.approved === 2 && sys.venues.pending === 1, JSON.stringify(sys.venues));
const total = (await q(`select count(*)::int n from bookings`))[0].n;
ok('thống kê hệ thống: lượt đặt theo tháng (6 tháng), khớp tổng', sys.bookings_by_month.length === 6 && sys.bookings_by_month.at(-1).count === total && sys.bookings_by_month.at(-1).confirmed === 3, JSON.stringify(sys.bookings_by_month));
await rejects('chủ sân xem thống kê hệ thống', 'FORBIDDEN', () => as(ownerA, 'authenticated', () => q(`select admin_stats()`)));

// --- PB26: giới hạn lượt hỏi AI và ngữ cảnh phiên ---
const sid = '11111111-1111-4111-8111-111111111111';
const begin = (uid, question, limit = 3, session = sid) => as(uid, 'authenticated', async () => (await q(`select ai_begin($1, $2, $3) r`, [session, question, limit]))[0].r);
const b1 = await begin(p1, 'sân ở Hải Châu tối nay');
ok('ai_begin: lượt đầu, chưa có ngữ cảnh', b1.used === 1 && b1.last_filter === null && b1.history.length === 0);
await as(p1, 'authenticated', () => q(`select ai_finish($1, $2::jsonb, 2, 'ok')`, [b1.id, JSON.stringify({ ward_id: 1, max_price: 80000 })]));
const b2 = await begin(p1, 'rẻ hơn nữa');
ok('ai_begin: lượt sau nhận bộ lọc và câu hỏi của lượt trước', b2.used === 2 && b2.last_filter.max_price === 80000 && b2.history[0] === 'sân ở Hải Châu tối nay');
ok('phiên khác không dùng chung ngữ cảnh', (await begin(p1, 'câu khác', 3, '22222222-2222-4222-8222-222222222222')).last_filter === null);
await rejects('vượt giới hạn lượt hỏi trong ngày', 'RATE_LIMITED', () => begin(p1, 'câu thứ tư'));
ok('giới hạn tính riêng từng người', (await begin(p2, 'tìm sân')).used === 1);
await rejects('câu hỏi rỗng', 'INVALID_INPUT', () => begin(p2, '   '));
await rejects('khách dùng trợ lý', 'UNAUTHENTICATED', () => as(null, 'authenticated', () => q(`select ai_begin('${sid}', 'x', 3)`)));
await as(p2, 'authenticated', () => q(`select ai_finish($1, '{"ward_id": 9}'::jsonb, 0, 'ok')`, [b1.id]));
ok('không sửa được nhật ký của người khác', (await q(`select parsed_filter from ai_chat_logs where id = $1`, [b1.id]))[0].parsed_filter.ward_id === 1);
ok('người chơi không đọc được nhật ký AI, quản trị viên đọc được', (await as(p1, 'authenticated', () => q(`select id from ai_chat_logs`))).length === 0 && (await as(admin, 'authenticated', () => q(`select id from ai_chat_logs`))).length > 0);
ok('câu hỏi dài bị cắt còn 300 ký tự', (await q(`select max(length(question)) m from ai_chat_logs where id = $1`, [(await begin(p2, 'a'.repeat(500))).id]))[0].m === 300);

// --- PB27: xóa tài khoản ---
const del = (uid) => as(uid, 'authenticated', () => q(`select delete_my_account()`));
await rejects('người chơi còn lượt đặt chưa diễn ra', 'INVALID_STATE', () => del(p1));
await rejects('chủ sân còn lượt đặt chưa diễn ra ở sân mình', 'INVALID_STATE', () => del(ownerA));
await rejects('quản trị viên tự xóa', 'FORBIDDEN', () => del(admin));
// Đưa mọi lượt đặt về quá khứ
await db.exec(`update booking_items set booking_date = vn_now()::date - 2; update bookings set status = 'expired' where status = 'holding'; update booking_items bi set is_active = false from bookings b where b.id = bi.booking_id and b.status = 'expired'`);
const before = (await q(`select count(*)::int n from bookings where player_id = $1`, [p1]))[0].n;
await del(p1);
ok('xóa tài khoản người chơi: mất tài khoản và hồ sơ', (await q(`select 1 from auth.users where id = $1`, [p1])).length === 0 && (await q(`select 1 from profiles where id = $1`, [p1])).length === 0);
ok('lượt đặt cũ còn lại ở dạng ẩn danh', before > 0 && (await q(`select count(*)::int n from bookings where player_id is null`))[0].n === before && (await q(`select count(*)::int n from bookings`))[0].n === total);
ok('nhật ký AI của người đã xóa không còn gắn danh tính', (await q(`select count(*)::int n from ai_chat_logs where user_id is null`))[0].n >= 3);
ok('chủ sân vẫn xem được lượt đặt ẩn danh của sân mình', (await as(ownerA, 'authenticated', () => q(`select id from booking_details where player_id is null`))).length === before);
await del(ownerA);
const leftA = await q(`select id, status, owner_id, bank_account_number, contact_phone, reject_reason from venues where id in (${vA}, ${vA2}) order by id`);
ok('xóa chủ sân: sân chưa có lượt đặt bị xóa, sân có lịch sử bị ẩn và xóa thông tin nhận tiền', leftA.length === 1 && leftA[0].id === vA && leftA[0].status === 'hidden' && leftA[0].owner_id === null && leftA[0].bank_account_number === '-' && leftA[0].contact_phone === null, JSON.stringify(leftA));
ok('sân của chủ sân đã xóa không còn công khai', (await as(null, 'anon', () => q(`select id from search_venues()`))).every((r) => r.id !== vA));
await rejects('không hiển thị lại được sân không còn chủ', 'INVALID_STATE', () => review(admin, vA, 'unhide'));
ok('thống kê hệ thống vẫn chạy sau khi xóa tài khoản', (await as(admin, 'authenticated', async () => (await q(`select admin_stats() r`))[0].r)).users.player === 1);
await rejects('gọi lại sau khi đã xóa', 'NOT_FOUND', () => del(p1));

console.log(process.exitCode ? '\nCÓ LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
