// Kiểm thử đầu-cuối Sprint 3 bằng Playwright, bám theo Testcase_Sprint_3. Gemini được giả lập (xem fake-supabase.mjs).
import { chromium } from 'playwright';
const B = 'http://127.0.0.1:3000';
const G = 'http://127.0.0.1:54321/__gemini';
const results = [];
const check = (name, cond, extra = '') => { results.push([Boolean(cond), name]); console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : extra); };
const sql = async (q) => (await fetch('http://127.0.0.1:54321/__sql', { method: 'POST', body: q })).json();
const gemini = async (body) => (await fetch(G, { method: 'POST', body: JSON.stringify(body) })).json();
const geminiRequests = async () => (await (await fetch(G)).json()).requests;
const browser = await chromium.launch();
const newCtx = (opts = {}) => browser.newContext({ viewport: { width: 1400, height: 900 }, ...opts });
const stamp = Date.now();
const mail = (n) => `${n}${stamp}@example.com`;
const api = async (ctx, method, path, data) => { const r = await ctx.request.fetch(B + path, { method, data }); let json = null; try { json = await r.json(); } catch {} return { status: r.status(), json }; };
const signUp = async (name, email, role, phone) => {
  const ctx = await newCtx();
  const r = await api(ctx, 'POST', '/api/auth/register', { full_name: name, email, phone, password: 'matkhau123', role, consent: true });
  if (r.status !== 201) throw new Error('register ' + email + ' ' + JSON.stringify(r.json));
  return ctx;
};
const login = async (page, email, password = 'matkhau123') => { await page.goto(B + '/login'); await page.fill('input[name=email]', email); await page.fill('input[name=password]', password); await page.click('button[type=submit]'); };
const vnDate = (offset) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86400000));
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const days = Array.from({ length: 7 }, (_, i) => vnDate(i + 1));
const weekday = days.find((d) => dow(d) >= 1 && dow(d) <= 5);
const saturday = days.find((d) => dow(d) === 6);
const sunday = days.find((d) => dow(d) === 0);
const uid = async (email) => (await sql(`select id from auth.users where email='${email}'`))[0].id;

// ---------- Tài khoản
const admin = await signUp('Quản Trị Viên', mail('admin'), 'player', '0905000000');
await sql(`update profiles set role='admin' where id='${await uid(mail('admin'))}'`);
await signUp('Quản Trị Hai', mail('admin2'), 'player', '0905000009');
const admin2Id = await uid(mail('admin2')); await sql(`update profiles set role='admin' where id='${admin2Id}'`);
const ownerA = await signUp('Trần Văn Bình', mail('ownera'), 'owner', '0905000001');
const ownerB = await signUp('Lê Thị Cúc', mail('ownerb'), 'owner', '0905000002');
const playerA = await signUp('Nguyễn Văn An', mail('playera'), 'player', '0905111222');
const playerB = await signUp('Phạm Thị Dung', mail('playerb'), 'player', '0905000004');
const playerC = await signUp('Hoàng Văn Em', mail('playerc'), 'player', '0905000005');
const pBId = await uid(mail('playerb'));

// ---------- Chủ sân đăng ký sân qua API (chờ duyệt)
const venueBody = (o) => ({ name: o.name, ward_id: o.ward, address: o.address, latitude: o.lat, longitude: o.lng, court_count: o.courts ?? 2, open_time: '05:00', close_time: '22:00', hold_minutes: 10, bank_name: 'Ngân hàng mẫu ABC', bank_account_number: '0123456789', bank_account_name: 'TRAN VAN BINH', contact_phone: '0236123456', description: 'Sân thảm, có bãi giữ xe' });
const mk = async (ctx, o, prices) => {
  const r = await api(ctx, 'POST', '/api/owner/venues', venueBody(o));
  if (r.status !== 201) throw new Error('venue ' + JSON.stringify(r.json));
  const id = r.json.data.venue.id;
  const p = await api(ctx, 'PUT', `/api/owner/venues/${id}/prices`, { prices });
  if (p.status !== 200) throw new Error('prices ' + JSON.stringify(p.json));
  return id;
};
const v1 = await mk(ownerA, { name: 'Sân cầu lông Sông Hàn', ward: 1, address: '12 Bạch Đằng', lat: 16.0712, lng: 108.2245, courts: 3 }, [{ day_type: 'weekday', start_time: '05:00', end_time: '22:00', price: 60000 }, { day_type: 'weekend', start_time: '05:00', end_time: '22:00', price: 75000 }]);
const v2 = await mk(ownerA, { name: 'Sân cầu lông Hải Châu Xanh', ward: 1, address: '99 Lê Duẩn', lat: 16.0690, lng: 108.2150, courts: 2 }, [{ day_type: 'weekday', start_time: '05:00', end_time: '22:00', price: 110000 }]);
const v3 = await mk(ownerB, { name: 'Sân cầu lông Sơn Trà', ward: 6, address: '45 Ngô Quyền', lat: 16.0705, lng: 108.2412, courts: 1 }, [{ day_type: 'weekday', start_time: '05:00', end_time: '22:00', price: 50000 }]);
const v4 = await mk(ownerB, { name: 'Sân Thử Từ Chối', ward: 3, address: '1 Điện Biên Phủ', lat: 16.066, lng: 108.19 }, [{ day_type: 'weekday', start_time: '05:00', end_time: '22:00', price: 40000 }]);
check('Sân mới đăng ký ở trạng thái chờ duyệt, chưa hiện công khai', (await api(await newCtx(), 'GET', '/api/venues')).json.data.total === 0);

// =====================================================================  PB19: duyệt sân
const adp = await admin.newPage();
await adp.goto(B + '/admin'); await adp.waitForSelector('[data-testid=admin-venue]');
const pendingCard = adp.locator('[data-testid=admin-venue][data-name="Sân cầu lông Sông Hàn"]');
const pendingText = await pendingCard.textContent();
check('PB19 danh sách chờ duyệt kèm đầy đủ thông tin (địa chỉ, chủ sân, tọa độ, giờ, sân con, bảng giá, mô tả)', (await adp.locator('[data-testid=admin-venue]').count()) === 4 && pendingText.includes('12 Bạch Đằng') && pendingText.includes('Phường Hải Châu') && pendingText.includes('Trần Văn Bình') && pendingText.includes('0905000001') && pendingText.includes('16.07120') && pendingText.includes('3 sân con') && pendingText.includes('Cuối tuần 05:00–22:00: 75.000') && pendingText.includes('Sân thảm'), pendingText);
await pendingCard.locator('button:has-text("Duyệt sân")').click();
await adp.waitForFunction(() => !document.querySelector('[data-name="Sân cầu lông Sông Hàn"]'));
check('PB19 bấm "Duyệt sân" -> Đã duyệt', (await sql(`select status, approved_at is not null a from venues where id=${v1}`))[0].status === 'approved');
const guest = await newCtx(); const gp = await guest.newPage();
await gp.goto(B + '/'); await gp.waitForSelector('.price-pin');
check('PB19 sân đã duyệt hiện ở trang chủ', (await gp.locator('li h3').allTextContents()).join() === 'Sân cầu lông Sông Hàn');
const rejectCard = adp.locator('[data-testid=admin-venue][data-name="Sân Thử Từ Chối"]');
await rejectCard.locator('button:has-text("Từ chối")').click(); await rejectCard.locator('button:has-text("Xác nhận từ chối")').click();
await rejectCard.locator('[role=alert]').waitFor();
check('PB19 từ chối không nhập lý do -> không cho từ chối', (await sql(`select status from venues where id=${v4}`))[0].status === 'pending' && (await rejectCard.locator('[role=alert]').textContent()).includes('lý do'));
check('PB19 API từ chối không có lý do -> 400', (await api(admin, 'PUT', `/api/admin/venues/${v4}/review`, { action: 'reject' })).status === 400);
await rejectCard.locator('input').fill('Địa chỉ không đúng thực tế'); await rejectCard.locator('button:has-text("Xác nhận từ chối")').click();
await adp.waitForFunction(() => !document.querySelector('[data-name="Sân Thử Từ Chối"]'));
check('PB19 nhập lý do -> Bị từ chối', (await sql(`select status, reject_reason r from venues where id=${v4}`))[0].r === 'Địa chỉ không đúng thực tế');
const obp = await ownerB.newPage(); await obp.goto(B + '/owner/venues');
check('PB19 chủ sân thấy kết quả và lý do từ chối', (await obp.textContent('main')).includes('Bị từ chối') && (await obp.textContent('main')).includes('Địa chỉ không đúng thực tế'));
check('PB19 chủ sân gọi API duyệt -> 403', (await api(ownerA, 'PUT', `/api/admin/venues/${v2}/review`, { action: 'approve' })).status === 403 && (await sql(`select status from venues where id=${v2}`))[0].status === 'pending');
check('PB19 người chơi mở /admin bị chuyển hướng, API quản trị trả 403', (await (await playerA.newPage()).goto(B + '/admin')).url() === B + '/' && (await api(playerA, 'GET', '/api/admin/venues')).status === 403 && (await api(guest, 'GET', '/api/admin/users')).status === 401);
check('PB19 duyệt các sân còn lại qua API', (await api(admin, 'PUT', `/api/admin/venues/${v2}/review`, { action: 'approve' })).json.data.venue.status === 'approved' && (await api(admin, 'PUT', `/api/admin/venues/${v3}/review`, { action: 'approve' })).status === 200);
check('PB19 duyệt lại sân đã duyệt -> 409', (await api(admin, 'PUT', `/api/admin/venues/${v3}/review`, { action: 'approve' })).status === 409);
const listApi = await api(admin, 'GET', '/api/admin/venues?status=approved&q=son%20tra');
check('PB19 API danh sách sân lọc theo trạng thái và từ khóa không dấu', listApi.json.data.venues.length === 1 && listApi.json.data.venues[0].owner_name === 'Lê Thị Cúc' && listApi.json.data.counts.approved === 3 && listApi.json.data.counts.rejected === 1);

// =====================================================================  PB20: người dùng, ẩn sân
await adp.goto(B + '/admin/users'); await adp.waitForSelector('table');
check('PB20 danh sách người dùng đủ 7 tài khoản, có email', (await adp.textContent('[data-testid=user-total]')).startsWith('7 ') && (await adp.locator(`tr[data-email="${mail('playera')}"]`).count()) === 1);
await adp.fill('input[name=q]', 'pham thi dung'); await adp.click('form[role=search] button'); await adp.waitForURL('**q=pham**');
check('PB20 tìm người dùng theo tên không dấu', (await adp.locator('tbody tr').count()) === 1 && (await adp.textContent('tbody')).includes(mail('playerb')));
await adp.goto(B + '/admin/users?role=owner');
check('PB20 lọc theo vai trò chủ sân', (await adp.locator('tbody tr').count()) === 2);
check('PB20 API tìm theo email', (await api(admin, 'GET', `/api/admin/users?q=${mail('playerc')}`)).json.data.total === 1);
await adp.goto(B + `/admin/users?q=${mail('playerb')}`);
await adp.click('button[aria-label^="Khóa tài khoản"]'); await adp.waitForSelector('text=Đã khóa');
check('PB20 khóa tài khoản người chơi', (await sql(`select is_locked l from profiles where id='${pBId}'`))[0].l === true);
check('PB20 phiên đang đăng nhập của tài khoản bị khóa mất quyền ngay', (await api(playerB, 'GET', '/api/bookings')).status === 401);
const lp = await (await newCtx()).newPage(); await login(lp, mail('playerb')); await lp.waitForSelector('main [role=alert]');
check('PB20 tài khoản bị khóa không đăng nhập được, có thông báo riêng', (await lp.textContent('main [role=alert]')).includes('Tài khoản đã bị khóa'));
await adp.click('button[aria-label^="Mở khóa tài khoản"]'); await adp.waitForSelector('text=Hoạt động');
await login(lp, mail('playerb')); await lp.waitForURL(B + '/');
check('PB20 mở khóa -> đăng nhập lại được', (await sql(`select is_locked l from profiles where id='${pBId}'`))[0].l === false);
const lockAdmin = await api(admin, 'PUT', `/api/admin/users/${admin2Id}/lock`, { is_locked: true });
check('PB20 khóa tài khoản quản trị viên -> 403', lockAdmin.status === 403 && (await sql(`select is_locked l from profiles where id='${admin2Id}'`))[0].l === false, JSON.stringify(lockAdmin.json));
check('PB20 chủ sân gọi API khóa tài khoản -> 403', (await api(ownerA, 'PUT', `/api/admin/users/${pBId}/lock`, { is_locked: true })).status === 403);
check('PB20 thiếu is_locked -> 400; người dùng không tồn tại -> 404', (await api(admin, 'PUT', `/api/admin/users/${pBId}/lock`, {})).status === 400 && (await api(admin, 'PUT', '/api/admin/users/00000000-0000-4000-8000-000000000000/lock', { is_locked: true })).status === 404);
// Ẩn sân vi phạm
await adp.goto(B + '/admin?status=approved'); const hideCard = adp.locator('[data-testid=admin-venue][data-name="Sân cầu lông Hải Châu Xanh"]');
await hideCard.locator('button:has-text("Ẩn sân")').click(); await hideCard.locator('input').fill('Thông tin giá sai sự thật'); await hideCard.locator('button:has-text("Xác nhận ẩn sân")').click();
await adp.waitForFunction(() => !document.querySelector('[data-name="Sân cầu lông Hải Châu Xanh"]'));
await gp.goto(B + '/'); await gp.waitForSelector('.price-pin');
check('PB20 ẩn sân vi phạm: không còn trong tìm kiếm và bản đồ', (await sql(`select status from venues where id=${v2}`))[0].status === 'hidden' && !(await gp.locator('li h3').allTextContents()).includes('Sân cầu lông Hải Châu Xanh') && (await gp.locator('.price-pin').count()) === 2 && (await gp.goto(B + `/venues/${v2}`)).status() === 404);
check('PB20 chủ sân không tự mở lại được sân bị ẩn', (await api(ownerA, 'PUT', `/api/owner/venues/${v2}`, { status: 'approved' })).status !== 200 && (await sql(`select status from venues where id=${v2}`))[0].status === 'hidden');
check('PB20 quản trị viên hiện lại sân', (await api(admin, 'PUT', `/api/admin/venues/${v2}/review`, { action: 'unhide' })).json.data.venue.status === 'approved');

// =====================================================================  PB21: thống kê chủ sân
await sql(`update venues set max_active_holds = 10 where id in (${v1}, ${v2}, ${v3})`);
const courts = Object.fromEntries((await sql(`select id, name from courts where venue_id=${v1}`)).map((c) => [c.name, c.id]));
const item = (court, date, time) => ({ court_id: court, booking_date: date, start_time: time });
const hold = async (ctx, venue, items) => { const r = await api(ctx, 'POST', '/api/bookings', { venue_id: venue, items }); if (r.status !== 201) throw new Error('hold ' + JSON.stringify(r.json)); return r.json.data.booking.id; };
const confirm = async (ctx, owner, id) => { await api(ctx, 'PUT', `/api/bookings/${id}/payment-report`, {}); const r = await api(owner, 'PUT', `/api/owner/bookings/${id}/status`, { action: 'confirm_payment' }); if (r.status !== 200) throw new Error('confirm ' + JSON.stringify(r.json)); };
const c1 = await hold(playerA, v1, [item(courts['Sân 1'], weekday, '18:00'), item(courts['Sân 1'], weekday, '19:00')]); await confirm(playerA, ownerA, c1);   // 120.000
const c2 = await hold(playerA, v1, [item(courts['Sân 2'], weekday, '19:00')]); await confirm(playerA, ownerA, c2);                                        // 60.000
const c3 = await hold(playerC, v1, [item(courts['Sân 1'], saturday, '08:00')]); await confirm(playerC, ownerA, c3);                                       // 75.000
await hold(playerB, v1, [item(courts['Sân 3'], weekday, '06:00')]);                                                                                      // đang giữ chỗ
const ex = await hold(playerB, v1, [item(courts['Sân 3'], weekday, '07:00')]); await sql(`update bookings set hold_expires_at = now() - interval '1 second' where id=${ex}`); await api(playerB, 'GET', '/api/bookings');
const cancelled = await hold(playerB, v1, [item(courts['Sân 3'], weekday, '09:00')]); await api(playerB, 'PUT', `/api/bookings/${cancelled}/cancel`);
const oap = await ownerA.newPage();
const from = vnDate(0), to = vnDate(7);
await oap.goto(B + `/owner/stats?period=custom&from=${from}&to=${to}&venue_id=${v1}`); await oap.waitForSelector('[data-testid=stat-count]');
check('PB21 thống kê chỉ tính lượt đã xác nhận: 3 lượt, doanh thu 255.000 đ, 4 khung giờ', (await oap.textContent('[data-testid=stat-count]')) === '3' && (await oap.textContent('[data-testid=stat-revenue]')).includes('255.000') && (await oap.textContent('[data-testid=stat-slots]')) === '4', await oap.textContent('main'));
check('PB21 lượt hủy và hết hạn đếm riêng, không cộng vào doanh thu', (await oap.textContent('main')).includes('1 đã hủy, 1 hết hạn giữ chỗ'));
check('PB21 có biểu đồ, bảng số liệu theo ngày, khung giờ đặt nhiều nhất', (await oap.locator('[data-testid=bar-chart] [data-value]').count()) === 8 && (await oap.locator(`tr[data-date="${weekday}"]`).textContent()).includes('180.000') && (await oap.locator('[data-testid=top-slots] li').first().textContent()).includes('19:00 – 20:00'));
const direct = async (f, t, venue = v1) => (await sql(`select count(distinct b.id)::int n, coalesce(sum(bi.price),0)::int r from bookings b join booking_items bi on bi.booking_id=b.id where b.venue_id=${venue} and b.status='confirmed' and bi.booking_date between '${f}' and '${t}'`))[0];
for (const period of ['week', 'month']) {
  await oap.goto(B + `/owner/stats?period=${period}&venue_id=${v1}`); await oap.waitForSelector('[data-testid=stat-count]');
  const range = (await api(ownerA, 'GET', `/api/owner/stats?venue_id=${v1}&from=${from}&to=${to}`)).json.data;
  const shownRange = await oap.locator('tbody tr[data-date]').evaluateAll((rows) => [rows[0].dataset.date, rows.at(-1).dataset.date]);
  const d = await direct(shownRange[0], shownRange[1]);
  check(`PB21 "${period === 'week' ? 'Tuần này' : 'Tháng này'}" khớp truy vấn đối chiếu trực tiếp`, (await oap.textContent('[data-testid=stat-count]')) === String(d.n) && (await oap.textContent('[data-testid=stat-revenue]')).replace(/\D/g, '') === String(d.r) && range.confirmed_count === 3, `${shownRange} ${JSON.stringify(d)}`);
}
check('PB21 chủ sân khác xem thống kê sân A -> 403; người chơi -> 403', (await api(ownerB, 'GET', `/api/owner/stats?venue_id=${v1}&from=${from}&to=${to}`)).status === 403 && (await api(playerA, 'GET', `/api/owner/stats?from=${from}&to=${to}`)).status === 403);
check('PB21 thiếu khoảng ngày hoặc ngày ngược -> 400', (await api(ownerA, 'GET', '/api/owner/stats')).status === 400 && (await api(ownerA, 'GET', `/api/owner/stats?from=${to}&to=${from}`)).status === 400);

// =====================================================================  PB22: thống kê hệ thống
await adp.goto(B + '/admin/stats'); await adp.waitForSelector('[data-testid=users-player]');
const roleCounts = Object.fromEntries((await sql(`select role, count(*)::int n from profiles group by role`)).map((r) => [r.role, r.n]));
const venueCounts = Object.fromEntries((await sql(`select status, count(*)::int n from venues group by status`)).map((r) => [r.status, r.n]));
const bookingTotal = (await sql(`select count(*)::int n from bookings`))[0].n;
check('PB22 số người dùng theo vai trò khớp cơ sở dữ liệu', (await adp.textContent('[data-testid=users-player]')) === String(roleCounts.player) && (await adp.textContent('[data-testid=users-owner]')) === String(roleCounts.owner) && (await adp.textContent('[data-testid=users-admin]')) === String(roleCounts.admin));
check('PB22 số sân theo trạng thái khớp cơ sở dữ liệu', (await adp.textContent('[data-testid=venues-approved]')) === String(venueCounts.approved) && (await adp.textContent('[data-testid=venues-rejected]')) === String(venueCounts.rejected));
check('PB22 số lượt đặt theo tháng khớp cơ sở dữ liệu', (await adp.locator('[data-testid=month-count]').last().textContent()) === String(bookingTotal) && (await adp.locator('tr[data-month]').count()) === 6 && (await adp.textContent('[data-testid=bookings-confirmed]')) === '3');
check('PB22 chủ sân gọi API thống kê hệ thống -> 403', (await api(ownerA, 'GET', '/api/admin/stats')).status === 403);

// =====================================================================  PB23..PB26: trợ lý AI (Gemini giả lập)
await gemini({ reset: true });
const Q1 = 'Tìm sân gần Hải Châu tối thứ bảy này dưới 80 nghìn một giờ';
await gemini({ script: {
  [Q1]: { in_scope: true, ward_name: 'Phường Hải Châu', date: saturday, time_from: '18:00', time_to: '22:00', max_price: 80000, near_me: false, cheaper: false },
  'rẻ hơn nữa': { in_scope: true, ward_name: 'Phường Hải Châu', date: saturday, time_from: '18:00', time_to: '22:00', max_price: 80000, near_me: false, cheaper: true },
  'đổi sang chủ nhật': { in_scope: true, ward_name: 'Phường Hải Châu', date: sunday, time_from: '18:00', time_to: '22:00', max_price: 60000, near_me: false, cheaper: false },
  'Viết giúp tôi một bài văn': { in_scope: false, near_me: false, cheaper: false },
  'Tìm sân cho tôi': { in_scope: true, near_me: false, cheaper: false },
  'sân hôm qua ở phường không có': { in_scope: true, ward_name: 'Phường Không Có Thật', date: vnDate(-1), near_me: false, cheaper: false },
  'sân ở Sơn Trà lúc 6 giờ sáng': { in_scope: true, ward_name: 'Sơn Trà', date: weekday, time_from: '06:00', time_to: '07:00', near_me: false, cheaper: false },
  'sân gần tôi': { in_scope: true, near_me: true, radius_km: 2, cheaper: false },
} });
const sid = () => crypto.randomUUID();
const ask = (ctx, session, message, extra = {}) => api(ctx, 'POST', '/api/ai/chat', { session_id: session, message, ...extra });
const s1 = sid();
const a1 = await ask(playerA, s1, Q1);
const f1 = a1.json.data.filter;
check('PB23 câu hỏi đầy đủ -> bộ lọc: phường Hải Châu, thứ bảy gần nhất, 18:00-22:00, giá tối đa 80.000', a1.status === 200 && f1.ward_name === 'Phường Hải Châu' && f1.ward_id === 1 && f1.date === saturday && f1.time_from === '18:00' && f1.time_to === '22:00' && f1.max_price === 80000, JSON.stringify(a1.json));
check('PB24 chỉ giới thiệu sân có trong kết quả truy vấn (đúng phường, đúng giá), kèm giờ còn trống', a1.json.data.venues.length === 1 && a1.json.data.venues[0].id === v1 && a1.json.data.venues[0].free_hours.join() === '18:00,19:00,20:00,21:00' && a1.json.data.reply.includes('Sân cầu lông Sông Hàn') && !a1.json.data.reply.includes('Hải Châu Xanh'), JSON.stringify(a1.json.data));
check('PB26 phản hồi kèm số lượt hỏi còn lại', a1.json.data.remaining === 19 && a1.json.data.fallback === false);
const a2 = await ask(playerA, s1, 'rẻ hơn nữa');
const reqs = await geminiRequests();
const lastExtraction = reqs.filter((r) => r.generationConfig?.responseSchema).at(-1);
check('PB24 câu hỏi nối tiếp: máy chủ gửi kèm bộ lọc lượt trước cho mô hình', lastExtraction.systemInstruction.parts[0].text.includes('"max_price":80000') && lastExtraction.systemInstruction.parts[0].text.includes('"ward_name":"Phường Hải Châu"'));
check('PB24 "rẻ hơn nữa": chỉ hạ giá tối đa (80.000 -> 60.000), giữ phường, ngày, giờ', a2.json.data.filter.max_price === 60000 && a2.json.data.filter.ward_id === 1 && a2.json.data.filter.date === saturday && a2.json.data.filter.time_from === '18:00', JSON.stringify(a2.json.data.filter));
check('PB24 không có sân phù hợp: nói rõ, gợi ý nới điều kiện, không nêu tên sân nào', a2.json.data.venues.length === 0 && a2.json.data.reply.includes('không có sân nào phù hợp') && a2.json.data.reply.includes('nâng mức giá') && !a2.json.data.reply.includes('Sông Hàn'), a2.json.data.reply);
const a3 = await ask(playerA, s1, 'đổi sang chủ nhật');
check('PB24 "đổi sang chủ nhật": chỉ đổi ngày, các điều kiện khác giữ nguyên', a3.json.data.filter.date === sunday && a3.json.data.filter.ward_id === 1 && a3.json.data.filter.time_from === '18:00' && a3.json.data.filter.max_price === 60000, JSON.stringify(a3.json.data.filter));
const before = (await geminiRequests()).length;
const a4 = await ask(playerA, sid(), 'Viết giúp tôi một bài văn');
check('PB23 câu hỏi ngoài phạm vi: từ chối lịch sự, nhắc phạm vi, không tìm kiếm', a4.json.data.reply.includes('chỉ hỗ trợ được việc tìm và đặt sân') && a4.json.data.venues.length === 0 && a4.json.data.filter === null && (await geminiRequests()).length === before + 1);
const a5 = await ask(playerA, sid(), 'Tìm sân cho tôi');
check('PB24 thiếu thông tin: trợ lý hỏi lại ngày chơi và khu vực', a5.json.data.reply.includes('ngày nào') && a5.json.data.reply.includes('khu vực nào') && a5.json.data.venues.length === 0, a5.json.data.reply);
const a6 = await ask(playerA, sid(), 'sân hôm qua ở phường không có');
check('PB23 bộ lọc không hợp lệ từ AI (ngày đã qua, phường không tồn tại): bỏ giá trị sai, không lỗi, hỏi lại', a6.status === 200 && a6.json.data.filter.date === null && a6.json.data.filter.ward_id === null && a6.json.data.reply.includes('ngày bạn nêu đã qua') && a6.json.data.reply.includes('chưa nhận ra khu vực'), JSON.stringify(a6.json));
// Sân Sơn Trà có 1 sân con: giữ chỗ lúc 06:00 rồi hỏi đúng khung giờ đó
const v3court = (await sql(`select id from courts where venue_id=${v3}`))[0].id;
await hold(playerC, v3, [item(v3court, weekday, '06:00')]);
const a7 = await ask(playerA, sid(), 'sân ở Sơn Trà lúc 6 giờ sáng');
check('PB24 hỏi khung giờ không sân nào còn trống: nói rõ không có, không bịa tên sân', a7.json.data.filter.ward_id === 6 && a7.json.data.venues.length === 0 && a7.json.data.reply.includes('không có sân nào phù hợp') && !a7.json.data.reply.includes('Sân cầu lông Sơn Trà'), a7.json.data.reply);
const a8 = await ask(playerA, sid(), 'sân gần tôi');
check('PB23 "gần tôi" khi chưa có vị trí: nhắc bật vị trí', a8.json.data.reply.includes('Dùng vị trí của tôi') && a8.json.data.venues.length === 0);
const a9 = await ask(playerA, sid(), 'sân gần tôi', { lat: 16.0712, lng: 108.2245 });
check('PB23 "gần tôi" có vị trí: tìm trong bán kính 2 km, có khoảng cách', a9.json.data.filter.near_me === true && a9.json.data.venues.length === 3 && a9.json.data.venues[0].id === v1 && a9.json.data.venues[0].distance_km < 0.1 && a9.json.data.venues.every((v) => v.distance_km <= 2), JSON.stringify(a9.json.data.venues.map((v) => [v.name, v.distance_km])));
// Không gửi dữ liệu cá nhân
const sent = JSON.stringify(await geminiRequests());
check('PB26 nội dung gửi Gemini không chứa họ tên, email, số điện thoại của người dùng', !sent.includes('Nguyễn Văn An') && !sent.includes(mail('playera')) && !sent.includes('0905111222') && sent.includes('Phường Hải Châu'));
check('PB26 khóa API chỉ nằm ở máy chủ: mã phía trình duyệt không chứa khóa', !(await (await playerA.request.get(B + '/assistant')).text()).includes('test-key'));
const logs = await sql(`select status, count(*)::int n from ai_chat_logs group by status`);
check('PB26 nhật ký lượt hỏi: trạng thái ok và rejected được ghi', logs.find((l) => l.status === 'ok')?.n >= 7 && logs.find((l) => l.status === 'rejected')?.n === 1, JSON.stringify(logs));
check('API trợ lý: chưa đăng nhập -> 401; thiếu câu hỏi, quá 300 ký tự, thiếu mã phiên -> 400', (await ask(guest, sid(), Q1)).status === 401 && (await ask(playerA, sid(), '  ')).status === 400 && (await ask(playerA, sid(), 'a'.repeat(301))).status === 400 && (await ask(playerA, 'abc', Q1)).status === 400);

// Giao diện trợ lý
const aip = await playerB.newPage();
await aip.goto(B + '/assistant'); await aip.waitForSelector('[data-testid=ai-disclaimer]');
check('PB25 khung chat ghi rõ là trợ lý AI, câu trả lời có thể chưa chính xác', (await aip.textContent('[data-testid=ai-disclaimer]')).includes('trí tuệ nhân tạo') && (await aip.textContent('[data-testid=ai-disclaimer]')).includes('có thể chưa chính xác'));
await aip.fill('input[aria-label="Câu hỏi cho trợ lý AI"]', Q1); await aip.click('button:has-text("Gửi")');
await aip.waitForSelector('[data-testid=ai-venue]');
const cardText = await aip.locator('[data-testid=ai-venue]').first().textContent();
check('PB25 thẻ sân có nút "Xem chi tiết", "Đặt sân", giờ còn trống', cardText.includes('Sân cầu lông Sông Hàn') && cardText.includes('Xem chi tiết') && cardText.includes('Đặt sân') && cardText.includes('Còn trống: 18:00'));
check('PB25 sân gợi ý nổi bật trên bản đồ', (await aip.locator('.price-pin').count()) === 1 && (await aip.locator('.price-pin.active').count()) === 1);
check('PB25 hiển thị bộ lọc AI đã hiểu, số lượt còn lại', (await aip.locator('[data-testid=ai-filter] button').count()) === 4 && (await aip.textContent('[data-testid=ai-filter]')).includes('Phường Hải Châu') && (await aip.textContent('[data-testid=ai-filter]')).includes('18:00 – 22:00') && (await aip.textContent('[data-testid=ai-remaining]')).includes('Còn 19/20'));
await aip.click('[data-testid=ai-filter] button[data-chip=ward]');
await aip.waitForFunction(() => document.querySelectorAll('.price-pin').length === 2);
check('PB25 bỏ một điều kiện trong bộ lọc AI -> tìm lại bằng bộ lọc thường, bản đồ cập nhật', (await aip.locator('[data-testid=ai-filter] button').count()) === 3 && (await sql(`select count(*)::int n from ai_chat_logs where user_id='${pBId}'`))[0].n === 1);
await aip.locator('[data-testid=ai-venue] a:has-text("Đặt sân")').first().click();
await aip.waitForURL(`**/venues/${v1}?date=${saturday}&time=18%3A00`);
await aip.waitForSelector('th[data-focus=true]');
check('PB25 "Đặt sân" mở trang sân với ngày và khung giờ đã chọn sẵn', (await aip.textContent('th[data-focus=true]')) === '18:00' && (await aip.locator(`a[href$="date=${saturday}"]`).getAttribute('class')).includes('font-bold') && (await aip.textContent('main')).includes('Khung giờ 18:00 bạn tìm'));
const gpa = await guest.newPage(); await gpa.goto(B + '/assistant');
check('PB25 khách mở trang trợ lý: được mời đăng nhập hoặc dùng bộ lọc thường', (await gpa.textContent('main')).includes('Bạn cần đăng nhập') && (await gpa.locator('a:has-text("Dùng bộ lọc thường")').count()) === 1);

// Dự phòng khi Gemini lỗi
for (const [mode, label] of [['error', 'lỗi máy chủ'], ['quota', 'hết hạn mức'], ['badjson', 'trả về không đúng định dạng']]) {
  await gemini({ mode });
  const r = await ask(playerA, sid(), Q1);
  check(`PB26 Gemini ${label}: phản hồi 200 với fallback = true, hướng dẫn dùng bộ lọc thường`, r.status === 200 && r.json.data.fallback === true && r.json.data.reply.includes('bộ lọc tìm sân thông thường') && r.json.data.venues.length === 0, JSON.stringify(r.json));
}
await gemini({ mode: 'error' });
await aip.goto(B + '/assistant'); await aip.fill('input[aria-label="Câu hỏi cho trợ lý AI"]', Q1); await aip.click('button:has-text("Gửi")');
await aip.waitForSelector('a:has-text("Mở bộ lọc tìm sân thường")');
check('PB26 giao diện khi Gemini lỗi: có thông báo và nút sang bộ lọc thường, không có trang lỗi trắng', (await aip.textContent('[data-testid=ai-messages]')).includes('tạm thời không phản hồi được'));
await aip.click('a:has-text("Mở bộ lọc tìm sân thường")'); await aip.waitForURL(B + '/');
check('PB26 nút dự phòng đưa về trang có bộ lọc thường', (await aip.locator('form[role=search]').count()) === 1);
await gemini({ mode: 'timeout' });
const t0 = Date.now(); const slow = await ask(playerA, sid(), Q1); const waited = (Date.now() - t0) / 1000;
check('PB26 Gemini quá thời gian chờ (15 giây): tự chuyển sang dự phòng', slow.status === 200 && slow.json.data.fallback === true && waited > 13 && waited < 25, `${waited}s`);
await gemini({ mode: 'ok' });
check('PB26 lượt lỗi được ghi trạng thái fallback', (await sql(`select count(*)::int n from ai_chat_logs where status='fallback'`))[0].n === 5);
// Giới hạn lượt hỏi trong ngày
const pCId = await uid(mail('playerc'));
await sql(`insert into ai_chat_logs (user_id, session_id, question, status) select '${pCId}', gen_random_uuid(), 'câu ' || g, 'ok' from generate_series(1, 20) g`);
const limited = await ask(playerC, sid(), Q1);
check('PB26 câu hỏi thứ 21 trong ngày -> 429, hướng dẫn dùng bộ lọc thường', limited.status === 429 && limited.json.message.includes('hết 20 lượt') && limited.json.message.includes('bộ lọc thông thường'), JSON.stringify(limited.json));
check('PB26 giới hạn tính riêng từng người và theo ngày', (await ask(playerA, sid(), 'Tìm sân cho tôi')).status === 200 && (await sql(`update ai_chat_logs set created_at = now() - interval '2 days' where user_id='${pCId}'`), (await ask(playerC, sid(), 'Tìm sân cho tôi')).status === 200));
const cp = await playerC.newPage(); await sql(`insert into ai_chat_logs (user_id, session_id, question, status) select '${pCId}', gen_random_uuid(), 'câu ' || g, 'ok' from generate_series(1, 20) g`);
await cp.goto(B + '/assistant'); await cp.fill('input[aria-label="Câu hỏi cho trợ lý AI"]', Q1); await cp.click('button:has-text("Gửi")');
await cp.waitForSelector('a:has-text("Mở bộ lọc tìm sân thường")');
check('PB26 giao diện khi hết lượt: thông báo, khóa ô nhập, có nút sang bộ lọc thường', (await cp.textContent('[data-testid=ai-messages]')).includes('hết 20 lượt') && (await cp.isDisabled('input[aria-label="Câu hỏi cho trợ lý AI"]')) && (await cp.textContent('[data-testid=ai-remaining]')).includes('Còn 0/20'));

// =====================================================================  PB27: xóa tài khoản
const reg = (await sql(`select consent_at is not null c from profiles where id='${pCId}'`))[0];
const privacy = await gp.goto(B + '/privacy');
const rp = await (await newCtx()).newPage(); await rp.goto(B + '/register');
check('PB27 ghi nhận thời điểm đồng ý xử lý dữ liệu; liên kết thông báo mở được', reg.c === true && privacy.status() === 200 && (await gp.textContent('main')).includes('91/2025/QH15') && (await rp.locator('a[href="/privacy"]').count()) >= 1);
await cp.goto(B + '/account'); await cp.fill('input[name=password]', 'matkhau123'); await cp.check('input[name=confirm]'); await cp.click('button:has-text("Xóa tài khoản")');
await cp.waitForSelector('main [role=alert]');
check('PB27 còn lượt đặt sắp tới -> từ chối xóa, yêu cầu hủy trước', (await cp.textContent('main [role=alert]')).includes('còn lượt đặt chưa diễn ra') && (await sql(`select count(*)::int n from profiles where id='${pCId}'`))[0].n === 1);
check('PB27 API xóa tài khoản: sai mật khẩu -> 400; còn lượt đặt -> 409', (await api(playerC, 'DELETE', '/api/me', { password: 'sai' })).status === 400 && (await api(playerC, 'DELETE', '/api/me', { password: 'matkhau123' })).status === 409);
// Đưa các lượt đặt của C về quá khứ (đã chơi xong)
await sql(`update booking_items set booking_date = '${vnDate(-2)}' where booking_id in (select id from bookings where player_id='${pCId}')`);
await sql(`update bookings set status='confirmed' where player_id='${pCId}' and status='holding'`);
const cBookings = (await sql(`select count(*)::int n from bookings where player_id='${pCId}'`))[0].n;
const anonBefore = (await sql(`select count(*)::int n from bookings where player_id is null`))[0].n;
await cp.goto(B + '/account'); await cp.fill('input[name=password]', 'matkhau123'); await cp.click('button:has-text("Xóa tài khoản")');
await cp.waitForSelector('main [role=alert]');
check('PB27 chưa đánh dấu xác nhận -> chưa xóa', (await cp.textContent('main [role=alert]')).includes('đánh dấu xác nhận'));
await cp.fill('input[name=password]', 'matkhau123'); await cp.check('input[name=confirm]'); await cp.click('button:has-text("Xóa tài khoản")');
await cp.waitForURL('**/?deleted=1');
check('PB27 xóa tài khoản: về trang chủ, có thông báo, đã đăng xuất', (await cp.textContent('main')).includes('đã được xóa') && (await cp.locator('header a[href="/login"]').count()) === 1);
check('PB27 dữ liệu cá nhân bị xóa; lượt đặt cũ còn lại ở dạng ẩn danh', (await sql(`select count(*)::int n from profiles where id='${pCId}'`))[0].n === 0 && (await sql(`select count(*)::int n from auth.users where id='${pCId}'`))[0].n === 0 && cBookings >= 2 && (await sql(`select count(*)::int n from bookings where player_id is null`))[0].n === anonBefore + cBookings && (await sql(`select count(*)::int n from ai_chat_logs where user_id='${pCId}'`))[0].n === 0);
await login(cp, mail('playerc')); await cp.waitForSelector('main [role=alert]');
check('PB27 tài khoản đã xóa không đăng nhập được', (await cp.textContent('main [role=alert]')).includes('Email hoặc mật khẩu không đúng'));
await oap.goto(B + '/owner/bookings?status='); await oap.waitForSelector('[data-testid=owner-booking]');
check('PB27 chủ sân vẫn thấy lượt đặt cũ, người đặt hiển thị "Tài khoản đã xóa"', (await oap.textContent('main')).includes('Tài khoản đã xóa') && !(await oap.textContent('main')).includes('Hoàng Văn Em'));
check('PB27 quản trị viên không tự xóa được tài khoản', (await api(admin, 'DELETE', '/api/me', { password: 'matkhau123' })).status === 403 && !(await (await admin.newPage()).goto(B + '/account').then((r) => r.text())).includes('Xóa tài khoản'));
// Chủ sân xóa tài khoản
check('PB27 chủ sân còn lượt đặt chưa diễn ra ở sân mình -> 409', (await api(ownerA, 'DELETE', '/api/me', { password: 'matkhau123' })).status === 409);
const ownerBId = await uid(mail('ownerb'));
await sql(`update booking_items set booking_date = '${vnDate(-2)}' where booking_id in (select id from bookings where venue_id=${v3})`);
check('PB27 chủ sân xóa tài khoản: sân có lịch sử bị ẩn, xóa thông tin nhận tiền; sân chưa có lượt đặt bị xóa', (await api(ownerB, 'DELETE', '/api/me', { password: 'matkhau123' })).status === 200 && (await sql(`select id, status, owner_id, bank_account_number b, contact_phone p from venues where id in (${v3}, ${v4}) order by id`)).map((r) => [r.id, r.status, r.owner_id, r.b, r.p].join('|')).join() === `${v3}|hidden||-|` && (await sql(`select count(*)::int n from profiles where id='${ownerBId}'`))[0].n === 0);
check('PB27 sân của chủ sân đã xóa không còn công khai', !(await api(guest, 'GET', '/api/venues')).json.data.venues.some((v) => v.id === v3));
await adp.goto(B + '/admin?status=hidden');
check('PB27 quản trị viên thấy sân mất chủ, không có nút hiện lại', (await adp.textContent('[data-testid=admin-venue]')).includes('Tài khoản đã xóa') && (await adp.locator('button:has-text("Hiện lại")').count()) === 0);

// Điều hướng
check('Thanh điều hướng có "Trợ lý AI"; quản trị viên có Duyệt sân, Người dùng, Thống kê', (await gp.locator('header a[href="/assistant"]').count()) === 1 && (await adp.locator('header a[href="/admin/users"]').count()) === 1 && (await adp.locator('aside a[href="/admin/stats"]').count()) === 1 && (await oap.locator('aside a[href="/owner/stats"]').count()) === 1);

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} đạt`); failed.forEach(([, n]) => console.log('  CHƯA ĐẠT:', n));
await browser.close();
process.exit(failed.length ? 1 : 0);
