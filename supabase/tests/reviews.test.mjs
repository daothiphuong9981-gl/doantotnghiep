// Kiểm tra 0012_venue_reviews.sql: ai được đánh giá, cửa sổ 24 giờ sau giờ chơi, mỗi lượt một đánh giá (sửa được),
// ẩn tên, không đọc trực tiếp bảng, chủ sân trả lời, quản trị viên ẩn/hiện, điểm trung bình, thông báo.
// Chạy: node supabase/tests/reviews.test.mjs
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
const detailOf = async (fn) => { try { await fn(); return null; } catch (e) { return `${e.message}: ${e.detail ?? ''}`; } };

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
// Giống Supabase thật: bảng mới mặc định cấp quyền cho anon/authenticated; 0012 phải tự thu hồi
await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;`);
await db.exec(`grant select on all tables in schema public to anon, authenticated;`);
for (const f of ['0008_performance.sql', '0009_security.sql', '0010_payment_qr.sql', '0011_email_outbox.sql', '0012_venue_reviews.sql', '0013_review_reminders.sql', '0014_performance2.sql']) await db.exec(file('../migrations/' + f));

const mk = async (email, role, name) => (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
  [email, JSON.stringify({ full_name: name ?? email, phone: '0900000000', role })]))[0].id;
const player = await mk('an@x', 'player', 'Nguyễn Văn An');
const player2 = await mk('binh@x', 'player', 'Trần Thị Bình');
const owner = await mk('o@x', 'owner', 'Chủ Sân');
const owner2 = await mk('o2@x', 'owner', 'Chủ Sân Khác');
const admin = await mk('a@x', 'player', 'Quản Trị');
await db.exec(`update profiles set role = 'admin' where id = '${admin}'`);

const mkVenue = async (own, name) => {
  const [{ id }] = await q(`insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, bank_name, bank_account_number, bank_account_name, status)
    values ($1, 1, $2, 'dc', 16.06, 108.22, '00:00', '23:00', 'BIDV', '0123456789', 'A', 'approved') returning id`, [own, name]);
  await db.exec(`insert into courts (venue_id, name) values (${id}, 'Sân 1'), (${id}, 'Sân 2');
                 insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${id}, 'weekday', '00:00', '23:00', 100000), (${id}, 'weekend', '00:00', '23:00', 100000);`);
  return id;
};
const venue = await mkVenue(owner, 'Sân Một');
await mkVenue(owner2, 'Sân Hai'); // sân của chủ sân khác, để kiểm tra không thấy chéo
const courtOf = async (v) => (await q(`select id from courts where venue_id = $1 order by id limit 1`, [v]))[0].id;

let hour = 5;
const day = (await q(`select (current_date + 3)::text d`))[0].d;
/**
 * Tạo lượt đặt (khung giờ ở tương lai) rồi đưa tới trạng thái mong muốn.
 * confirmedAgo: chủ sân xác nhận cách đây bao lâu (0013: cửa sổ đánh giá tính từ lúc xác nhận, không phụ thuộc giờ chơi).
 */
const booking = async (uid, v, { status = 'confirmed', confirmedAgo = '2 hours' } = {}) => {
  const items = JSON.stringify([{ court_id: await courtOf(v), booking_date: day, start_time: `${String(hour++).padStart(2, '0')}:00` }]);
  const id = (await as(uid, () => q(`select create_booking($1, $2::jsonb) r`, [v, items])))[0].r.id;
  if (status !== 'holding') await as(uid, () => q(`select report_payment($1, null)`, [id]));
  if (status === 'confirmed') {
    await as(v === venue ? owner : owner2, () => q(`select confirm_payment($1)`, [id]));
    await db.exec(`update bookings set confirmed_at = now() - interval '${confirmedAgo}' where id = ${id}`);
  }
  if (status === 'cancelled') await as(v === venue ? owner : owner2, () => q(`select cancel_booking($1, 'x')`, [id]));
  return id;
};
const submit = (uid, id, rating, comment = null, anon = false) => as(uid, () => q(`select submit_review($1, $2, $3, $4) r`, [id, rating, comment, anon]));

// ---------------------------------------------------------------- Ai được đánh giá
const played = await booking(player, venue);
const justConfirmed = await booking(player, venue, { confirmedAgo: '1 minute' });
const awaiting = await booking(player, venue, { status: 'awaiting_confirmation' });
const cancelled = await booking(player, venue, { status: 'cancelled' });
const tooLate = await booking(player, venue, { confirmedAgo: '25 hours' });
const justInTime = await booking(player, venue, { confirmedAgo: '23 hours 50 minutes' });

ok('vừa xác nhận, chưa tới giờ chơi: đánh giá được ngay', (await submit(player, justConfirmed, 5))[0].r > 0);
// Dọn đánh giá phụ này để các phép đếm bên dưới (danh sách, điểm trung bình, thông báo) giữ nguyên
await db.exec(`delete from venue_reviews where booking_id = ${justConfirmed}; delete from notifications where booking_id = ${justConfirmed} and kind = 'review_new';`);
ok('lượt chờ xác nhận: không đánh giá được', /đã được chủ sân xác nhận/.test(await detailOf(() => submit(player, awaiting, 5))));
ok('lượt đã hủy: không đánh giá được', /INVALID_STATE/.test(await detailOf(() => submit(player, cancelled, 5))));
ok('quá 24 giờ sau khi xác nhận: không đánh giá được (bỏ qua thì hết hạn)', /quá 24 giờ/.test(await detailOf(() => submit(player, tooLate, 5))));
ok('lượt của người khác: không đánh giá được', /NOT_FOUND/.test(await detailOf(() => submit(player2, played, 5))));
ok('chủ sân không đánh giá được', /FORBIDDEN/.test(await detailOf(() => submit(owner, played, 5))));
ok('khách chưa đăng nhập không gọi được', (await detailOf(() => as(null, () => q(`select submit_review($1, 5)`, [played]), 'anon'))) !== null);
ok('số sao ngoài 1-5: báo lỗi', /1 đến 5 sao/.test(await detailOf(() => submit(player, played, 6))) && /1 đến 5 sao/.test(await detailOf(() => submit(player, played, 0))));
ok('bình luận quá 1000 ký tự: báo lỗi', /1000 ký tự/.test(await detailOf(() => submit(player, played, 4, 'a'.repeat(1001)))));

const st = async (uid, id) => (await as(uid, () => q(`select my_booking_review($1) s`, [id])))[0].s;
ok('trạng thái: đã xác nhận trong 24 giờ thì mở form', (await st(player, played)).can_edit === true && (await st(player, played)).review === null);
ok('trạng thái: quá 24 giờ thì khóa', (await st(player, tooLate)).can_edit === false);
ok('trạng thái: chờ xác nhận thì chưa mở', (await st(player, awaiting)).can_edit === false && (await st(player, awaiting)).deadline === null);
const dl = Date.parse((await st(player, played)).deadline);
ok('hạn đánh giá = lúc xác nhận + 24 giờ (xác nhận 2 giờ trước -> còn 22 giờ)', Math.abs(dl - Date.now() - 22 * 3600e3) < 120e3, (await st(player, played)).deadline);
ok('trạng thái: lượt người khác trả null', (await st(player2, played)) === null);

// ---------------------------------------------------------------- Tạo, sửa
const rid = (await submit(player, played, 4, '  Sân đẹp, đèn sáng  '))[0].r;
let s = await st(player, played);
ok('tạo đánh giá: lưu sao, bình luận đã cắt khoảng trắng', s.review.rating === 4 && s.review.comment === 'Sân đẹp, đèn sáng' && s.review.is_anonymous === false);
const rid2 = (await submit(player, played, 5, 'Sửa lại: rất tốt', true))[0].r;
s = await st(player, played);
ok('sửa đánh giá: vẫn một đánh giá, cập nhật nội dung và ẩn tên', rid2 === rid && s.review.rating === 5 && s.review.comment === 'Sửa lại: rất tốt' && s.review.is_anonymous === true);
ok('mỗi lượt đặt chỉ một đánh giá', (await q(`select count(*)::int n from venue_reviews where booking_id = $1`, [played]))[0].n === 1);
ok('sát hạn 24 giờ vẫn đánh giá được', (await submit(player, justInTime, 3, 'Tạm được'))[0].r > 0);
await db.exec(`update bookings set confirmed_at = confirmed_at - interval '2 days' where id = ${played}`);
ok('quá 24 giờ thì không sửa được nữa', /quá 24 giờ/.test(await detailOf(() => submit(player, played, 1))));

// Lượt thứ hai của người chơi khác tại cùng sân, hiện tên
const played2 = await booking(player2, venue);
await submit(player2, played2, 2, 'Sân hơi trơn');

// ---------------------------------------------------------------- Không đọc trực tiếp bảng
for (const [who, uid, role] of [['khách', null, 'anon'], ['người chơi', player, 'authenticated'], ['chủ sân', owner, 'authenticated']]) {
  const e = await detailOf(() => as(uid, () => q(`select player_id from venue_reviews`), role));
  ok(`${who} không đọc trực tiếp được bảng (không lộ người ẩn danh)`, e !== null && /permission denied/i.test(e));
}
ok('không chèn đánh giá trực tiếp được', (await detailOf(() => as(player, () => q(`insert into venue_reviews (venue_id, booking_id, rating) values ($1, $2, 5)`, [venue, future])))) !== null);

// ---------------------------------------------------------------- Danh sách công khai, ẩn tên
const list = await as(null, () => q(`select * from list_venue_reviews($1)`, [venue]), 'anon');
ok('khách xem được danh sách đánh giá của sân', list.length === 3, JSON.stringify(list.map((r) => r.author)));
ok('đánh giá ẩn tên hiện "Người chơi ẩn danh"', list.some((r) => r.author === 'Người chơi ẩn danh' && r.rating === 5));
ok('đánh giá hiện tên thì có họ tên', list.some((r) => r.author === 'Trần Thị Bình' && r.comment === 'Sân hơi trơn'));
ok('đánh giá ẩn tên không kèm họ tên ở bất kỳ cột nào', list.filter((r) => r.rating === 5).every((r) => !JSON.stringify(r).includes('Nguyễn Văn An')));
ok('đánh giá khác của cùng người (không ẩn tên) vẫn hiện tên', list.some((r) => r.rating === 3 && r.author === 'Nguyễn Văn An'));
let sum = (await as(null, () => q(`select * from venue_rating_summary(array[$1::bigint])`, [venue]), 'anon'))[0];
ok('điểm trung bình (5 + 3 + 2) / 3 = 3.3, 3 đánh giá', Number(sum.rating_avg) === 3.3 && sum.rating_count === 3, JSON.stringify(sum));
ok('tóm tắt mọi sân (không truyền id)', (await as(null, () => q(`select * from venue_rating_summary()`), 'anon')).length === 1);

// ---------------------------------------------------------------- Chủ sân
const mine = await as(owner, () => q(`select * from owner_list_reviews()`));
ok('chủ sân thấy đánh giá các sân của mình', mine.length === 3);
const anonRow = mine.find((r) => r.rating === 5);
ok('chủ sân cũng không thấy tên và mã lượt của người ẩn danh', anonRow.author === 'Người chơi ẩn danh' && anonRow.booking_code === null);
ok('chủ sân khác không thấy', (await as(owner2, () => q(`select * from owner_list_reviews()`))).length === 0);
ok('người chơi gọi owner_list_reviews không thấy gì', (await as(player, () => q(`select * from owner_list_reviews()`))).length === 0);
ok('chủ sân khác không trả lời được', /FORBIDDEN/.test(await detailOf(() => as(owner2, () => q(`select reply_review($1, 'x')`, [rid])))));
await as(owner, () => q(`select reply_review($1, $2)`, [rid, 'Cảm ơn bạn đã ủng hộ!']));
ok('chủ sân trả lời, trang sân hiện câu trả lời', (await as(null, () => q(`select owner_reply from list_venue_reviews($1) where id = $2`, [venue, rid]), 'anon'))[0].owner_reply === 'Cảm ơn bạn đã ủng hộ!');

// ---------------------------------------------------------------- Quản trị viên
ok('người không phải admin không xem được danh sách quản trị', /FORBIDDEN/.test(await detailOf(() => as(owner, () => q(`select * from admin_list_reviews()`)))));
const adm = await as(admin, () => q(`select * from admin_list_reviews()`));
ok('admin thấy mọi đánh giá, kể cả tên người ẩn danh', adm.length === 3 && adm.some((r) => r.is_anonymous && r.author === 'Nguyễn Văn An'));
ok('ẩn đánh giá bắt buộc có lý do', /lý do/.test(await detailOf(() => as(admin, () => q(`select admin_set_review_status($1, 'hidden', '')`, [rid])))));
const r2 = (await q(`select id from venue_reviews where booking_id = $1`, [played2]))[0].id;
await as(admin, () => q(`select admin_set_review_status($1, 'hidden', 'Ngôn từ không phù hợp')`, [r2]));
ok('đánh giá bị ẩn không còn trong danh sách công khai', !(await as(null, () => q(`select id from list_venue_reviews($1)`, [venue]), 'anon')).some((r) => r.id === r2));
sum = (await as(null, () => q(`select * from venue_rating_summary(array[$1::bigint])`, [venue]), 'anon'))[0];
ok('đánh giá bị ẩn không tính vào điểm trung bình (5 + 3) / 2 = 4.0', Number(sum.rating_avg) === 4 && sum.rating_count === 2, JSON.stringify(sum));
ok('người viết thấy lý do bị ẩn', (await st(player2, played2)).review.hidden_reason === 'Ngôn từ không phù hợp');
await as(admin, () => q(`select admin_set_review_status($1, 'visible')`, [r2]));
ok('hiện lại đánh giá', (await as(null, () => q(`select id from list_venue_reviews($1)`, [venue]), 'anon')).some((r) => r.id === r2));

// ---------------------------------------------------------------- Sân bị ẩn
await db.exec(`update venues set status = 'hidden' where id = ${venue}`);
ok('sân bị ẩn: không lộ đánh giá ra ngoài', (await as(null, () => q(`select * from list_venue_reviews($1)`, [venue]), 'anon')).length === 0
  && (await as(null, () => q(`select * from venue_rating_summary()`), 'anon')).length === 0);
await db.exec(`update venues set status = 'approved' where id = ${venue}`);

// ---------------------------------------------------------------- Thông báo
const inbox = (uid, kind) => q(`select title, body, link from notifications where user_id = $1 and kind = $2 order by id`, [uid, kind]);
const ownerNew = await inbox(owner, 'review_new');
ok('chủ sân nhận thông báo khi có đánh giá MỚI (không báo lại khi sửa)', ownerNew.length === 3 && ownerNew[0].link === '/owner/reviews', JSON.stringify(ownerNew.map((n) => n.body)));
ok('người chơi nhận thông báo khi chủ sân trả lời', (await inbox(player, 'review_replied')).length === 1);
ok('người chơi nhận thông báo khi đánh giá bị ẩn, có lý do', (await inbox(player2, 'review_hidden'))[0]?.body.includes('Ngôn từ không phù hợp'));

// ---------------------------------------------------------------- Xóa tài khoản: đánh giá giữ lại, tên thành "Người chơi"
await db.exec(`delete from auth.users where id = '${player2}'`).catch(() => {});
await db.exec(`update venue_reviews set player_id = null where id = ${r2}`);
ok('tài khoản đã xóa: đánh giá vẫn hiện với tên chung', (await as(null, () => q(`select author from list_venue_reviews($1) where id = $2`, [venue, r2]), 'anon'))[0]?.author === 'Người chơi');

// ---------------------------------------------------------------- 0013: nhắc đánh giá, danh sách lượt cần đánh giá
const p3 = await mk('cuong@x', 'player', 'Lê Văn Cường');
const fresh = await booking(p3, venue, { confirmedAgo: '30 minutes' });
const nearDeadline = await booking(p3, venue, { confirmedAgo: '22 hours' });
const expired = await booking(p3, venue, { confirmedAgo: '25 hours' });
const unconfirmed = await booking(p3, venue, { status: 'awaiting_confirmation' });
const doneReview = await booking(p3, venue, { confirmedAgo: '22 hours 30 minutes' });
await submit(p3, doneReview, 5);

const rv = await as(p3, () => q(`select * from my_reviewable_bookings() order by booking_id`));
ok('lượt cần đánh giá: vừa xác nhận, sắp hết hạn, đã đánh giá (còn sửa được); không có lượt quá hạn, chưa xác nhận', JSON.stringify(rv.map((r) => r.booking_id)) === JSON.stringify([fresh, nearDeadline, doneReview].sort((a, b) => a - b)), JSON.stringify(rv));
ok('đánh dấu lượt đã đánh giá', rv.find((r) => r.booking_id === doneReview)?.reviewed === true && rv.find((r) => r.booking_id === fresh)?.reviewed === false);
ok('hạn đánh giá có múi giờ (xác nhận 30 phút trước -> còn 23,5 giờ)', Math.abs(Date.parse(rv.find((r) => r.booking_id === fresh).deadline) - Date.now() - 23.5 * 3600e3) < 120e3);
ok('người khác không thấy lượt của p3', (await as(player, () => q(`select * from my_reviewable_bookings()`))).every((r) => ![fresh, nearDeadline, doneReview].includes(r.booking_id)));
ok('khách không gọi được', (await detailOf(() => as(null, () => q(`select * from my_reviewable_bookings()`), 'anon'))) !== null);
ok('người dùng không tự gọi send_review_reminders được', (await detailOf(() => as(p3, () => q(`select send_review_reminders()`)))) !== null);

await q(`select send_review_reminders()`);
const rem = await q(`select booking_id, title, body, link from notifications where user_id = $1 and kind = 'review_reminder' order by booking_id`, [p3]);
ok('nhắc lượt còn dưới 3 giờ là hết hạn mà chưa đánh giá', rem.some((n) => n.booking_id === nearDeadline), JSON.stringify(rem));
ok('link nhắc tới thẳng ô đánh giá', rem.find((n) => n.booking_id === nearDeadline)?.link === `/bookings/${nearDeadline}#danh-gia`);
ok('không nhắc lượt mới xác nhận (đã có thông báo xác nhận), quá hạn, chưa xác nhận, đã đánh giá', !rem.some((n) => [fresh, expired, unconfirmed, doneReview].includes(n.booking_id)), JSON.stringify(rem.map((n) => n.booking_id)));
const confirmedNote = await q(`select body, link from notifications where user_id = $1 and kind = 'booking_confirmed' and booking_id = $2`, [p3, fresh]);
ok('thông báo xác nhận mời đánh giá trong 24 giờ, link tới ô đánh giá', confirmedNote[0]?.body.includes('đánh giá sân trong 24 giờ') && confirmedNote[0]?.link === `/bookings/${fresh}#danh-gia`, JSON.stringify(confirmedNote[0]));
await q(`select send_review_reminders()`);
ok('chạy lại không nhắc trùng', (await q(`select count(*)::int n from notifications where user_id = $1 and kind = 'review_reminder'`, [p3]))[0].n === rem.length);

console.log(process.exitCode ? '\nCÓ KIỂM TRA LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
