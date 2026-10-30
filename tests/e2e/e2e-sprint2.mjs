// Kiểm thử đầu-cuối Sprint 2 bằng Playwright, bám theo Testcase_Sprint_2. Xem README mục "Kiểm thử".
import { chromium } from 'playwright';
const B = 'http://127.0.0.1:3000';
const results = [];
const check = (name, cond, extra = '') => { results.push([Boolean(cond), name]); console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : extra); };
const sql = async (q) => (await fetch('http://127.0.0.1:54321/__sql', { method: 'POST', body: q })).json();
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
const vnDate = (offset) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86400000));
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const days = Array.from({ length: 7 }, (_, i) => vnDate(i + 1)); // mặc định sân nhận đặt trước 7 ngày
const weekday = days.find((d) => dow(d) >= 1 && dow(d) <= 5);
const weekday2 = days.filter((d) => dow(d) >= 1 && dow(d) <= 5)[1];
const saturday = days.find((d) => dow(d) === 6);
const yesterday = vnDate(-1);

// ---------- Dữ liệu nền: 2 chủ sân, 2 người chơi, 2 sân đã duyệt
const ownerA = await signUp('Trần Văn B', mail('ownera'), 'owner', '0905000001');
const ownerB = await signUp('Lê Thị C', mail('ownerb'), 'owner', '0905000002');
const playerA = await signUp('Nguyễn Văn A', mail('playera'), 'player', '0905000003');
const playerB = await signUp('Phạm Thị D', mail('playerb'), 'player', '0905000004');
const uid = async (email) => (await sql(`select id from auth.users where email='${email}'`))[0].id;
const [oA, oB, , pB] = await Promise.all([uid(mail('ownera')), uid(mail('ownerb')), uid(mail('playera')), uid(mail('playerb'))]);
const mkVenue = async (owner, name, address, ward, lat, lng, hold) => {
  await sql(`insert into venues (owner_id, ward_id, name, address, latitude, longitude, open_time, close_time, hold_minutes, bank_name, bank_bin, bank_account_number, bank_account_name, status) values ('${owner}', ${ward}, '${name}', '${address}', ${lat}, ${lng}, '05:00', '22:00', ${hold}, 'Ngân hàng mẫu ABC', '970436', '0123456789', 'TRAN VAN B', 'pending')`);
  const id = (await sql(`select id from venues where name='${name}'`))[0].id;
  await sql(`update venues set status='approved' where id=${id}`);
  return id;
};
const v1 = await mkVenue(oA, 'Sân cầu lông Sông Hàn', '12 Bạch Đằng', 1, 16.0712, 108.2245, 5);
const v2 = await mkVenue(oB, 'Sân cầu lông Sơn Trà', '45 Ngô Quyền', 7, 16.0705, 108.2412, 15);
await sql(`insert into courts (venue_id, name) values (${v1}, 'Sân 1'), (${v1}, 'Sân 2'), (${v1}, 'Sân 3'), (${v1}, 'Sân 4'), (${v2}, 'Sân 1')`);
await sql(`insert into price_slots (venue_id, day_type, start_time, end_time, price) values (${v1}, 'weekday', '05:00', '17:00', 50000), (${v1}, 'weekday', '17:00', '22:00', 70000), (${v1}, 'weekend', '05:00', '22:00', 90000), (${v2}, 'weekday', '05:00', '22:00', 120000)`);
const courts = Object.fromEntries((await sql(`select id, name from courts where venue_id=${v1}`)).map((c) => [c.name, c.id]));
const v2court = (await sql(`select id from courts where venue_id=${v2}`))[0].id;
const item = (court, date, time) => ({ court_id: court, booking_date: date, start_time: time });
const hold = (ctx, venue, items) => api(ctx, 'POST', '/api/bookings', { venue_id: venue, items });
const statusOf = async (id) => (await sql(`select status from bookings where id=${id}`))[0]?.status;
const activeRows = async (court, date, time) => (await sql(`select count(*)::int n from booking_items where court_id=${court} and booking_date='${date}' and start_time='${time}' and is_active`))[0].n;
const cell = (page, court, time) => page.locator(`button[data-court="${court}"][data-time="${time}"]`);
const cellState = (page, court, time) => cell(page, court, time).getAttribute('data-state');

// =====================================================================  PB12, PB13
const g = await newCtx(); const gp = await g.newPage();
await gp.goto(B + '/'); await gp.waitForSelector('.price-pin');
check('Trang chủ hiện 2 sân và bộ lọc có danh mục phường, xã', (await gp.locator('li h3').count()) === 2 && (await gp.locator('select[name=ward_id] option').count()) > 20);
await gp.fill('input[name=q]', 'song han'); await gp.click('button[type=submit]');
await gp.waitForFunction(() => document.querySelectorAll('li h3').length === 1);
check('PB12 tìm theo tên không dấu "song han"', (await gp.locator('li h3').allTextContents())[0] === 'Sân cầu lông Sông Hàn' && (await gp.locator('.price-pin').count()) === 1);
await gp.click('text=Xóa lọc'); await gp.waitForFunction(() => document.querySelectorAll('li h3').length === 2);
check('PB12 xóa lọc trả lại đủ danh sách', (await gp.inputValue('input[name=q]')) === '');
await gp.selectOption('select[name=ward_id]', '1'); await gp.selectOption('select[name=price]', '0-60000'); await gp.click('button[type=submit]');
await gp.waitForFunction(() => document.querySelectorAll('li h3').length === 1);
check('PB12 lọc kết hợp phường Hải Châu + giá dưới 60.000 đ, bản đồ cập nhật', (await gp.locator('li h3').allTextContents())[0] === 'Sân cầu lông Sông Hàn' && (await gp.locator('.price-pin').count()) === 1);
await gp.selectOption('select[name=ward_id]', '7'); await gp.click('button[type=submit]');
await gp.waitForSelector('[data-testid=no-result]');
check('PB12 không có kết quả: có thông báo và gợi ý nới điều kiện', (await gp.textContent('[data-testid=no-result]')).includes('bỏ bớt điều kiện') && (await gp.locator('.price-pin').count()) === 0);
await gp.click('text=Xóa lọc'); await gp.waitForFunction(() => document.querySelectorAll('li h3').length === 2);

// Sân Sơn Trà chỉ có 1 sân con, đang được giữ chỗ lúc 19:00
const hB = await hold(playerB, v2, [item(v2court, weekday, '19:00')]);
check('Giữ chỗ qua API trả 201 kèm thông tin chuyển khoản', hB.status === 201 && hB.json.data.payment.content === hB.json.data.booking.code && hB.json.data.booking.status === 'holding', JSON.stringify(hB.json));
await gp.fill('input[name=date]', weekday); await gp.selectOption('select[name=start_time]', '19:00'); await gp.click('button[type=submit]');
await gp.waitForFunction(() => document.querySelectorAll('li h3').length === 1);
check('PB13 lọc khung giờ: sân đang bị giữ hết sân con không xuất hiện; sân còn trống hiện số sân trống', (await gp.locator('li h3').allTextContents())[0] === 'Sân cầu lông Sông Hàn' && (await gp.textContent('li')).includes('Còn 4/4 sân lúc 19:00'));
check('PB13 liên kết sang trang sân giữ ngày và giờ đang lọc', (await gp.locator('li a').first().getAttribute('href')) === `/venues/${v1}?date=${weekday}&time=19:00`);
check('PB13 ô chọn ngày không cho chọn ngày đã qua', (await gp.getAttribute('input[name=date]', 'min')) === vnDate(0));
const past = await api(g, 'GET', `/api/venues?date=${yesterday}&start_time=19:00`);
check('PB13 API lọc với ngày hôm qua -> 400', past.status === 400, JSON.stringify(past.json));
const half = await api(g, 'GET', `/api/venues?date=${weekday}`);
check('PB13 API chỉ có ngày, thiếu giờ -> 400', half.status === 400);
const apiSearch = await api(g, 'GET', `/api/venues?q=${encodeURIComponent('SƠN TRÀ')}&min_price=100000`);
check('PB12 API tìm có dấu + giá từ 100.000', apiSearch.json.data.total === 1 && apiSearch.json.data.venues[0].id === v2);
await api(playerB, 'PUT', `/api/bookings/${hB.json.data.booking.id}/cancel`);

// =====================================================================  PB14
// Khách chưa đăng nhập
await gp.goto(B + `/venues/${v1}?date=${weekday}`); await gp.waitForSelector('button[data-court]');
await cell(gp, 'Sân 1', '06:00').click();
check('PB14 khách chọn được ô, thấy tổng tiền tạm tính', (await cellState(gp, 'Sân 1', '06:00')) === 'selected' && (await gp.textContent('[data-testid=total]')).includes('50.000'));
await gp.click('text=Giữ chỗ và thanh toán'); await gp.waitForURL('**/login**');
check('PB14 chưa đăng nhập -> chuyển tới đăng nhập', gp.url().includes('/login?next='));
await gp.fill('input[name=email]', mail('playera')); await gp.fill('input[name=password]', 'matkhau123'); await gp.click('button[type=submit]');
await gp.waitForURL(`**/venues/${v1}?date=${weekday}`);
check('PB14 đăng nhập xong quay lại trang sân đúng ngày', true);
check('API giữ chỗ khi chưa đăng nhập -> 401', (await hold(await newCtx(), v1, [item(courts['Sân 1'], weekday, '06:00')])).status === 401);
check('API giữ chỗ bằng tài khoản chủ sân -> 403', (await hold(ownerA, v1, [item(courts['Sân 1'], weekday, '06:00')])).status === 403);

// Đặt nhiều sân con trong một lượt
const ap = await playerA.newPage();
await ap.goto(B + `/venues/${v1}?date=${weekday}`); await ap.waitForSelector('button[data-court]');
await cell(ap, 'Sân 2', '19:00').click(); await cell(ap, 'Sân 2', '20:00').click(); await cell(ap, 'Sân 4', '19:00').click();
check('PB14 chọn 3 ô thuộc 2 sân con: tổng tiền 210.000 đ', (await ap.locator('[data-testid=selection] li').count()) === 3 && (await ap.textContent('[data-testid=total]')).includes('210.000'));
await cell(ap, 'Sân 4', '19:00').click();
check('PB14 bấm lại để bỏ chọn', (await cellState(ap, 'Sân 4', '19:00')) === 'available' && (await ap.textContent('[data-testid=total]')).includes('140.000'));
await cell(ap, 'Sân 4', '19:00').click();
await ap.click('text=Giữ chỗ và thanh toán'); await ap.waitForURL('**/bookings/*');
const b1 = Number(ap.url().split('/').pop());
const b1row = (await sql(`select b.status, b.total_amount, b.code, (select count(*)::int from booking_items where booking_id=b.id) n, round(extract(epoch from (hold_expires_at - created_at))/60)::int m from bookings b where id=${b1}`))[0];
check('PB14 một lượt đặt 3 dòng chi tiết, tổng đúng, Đang giữ chỗ, chuyển tới trang thanh toán', b1row.status === 'holding' && b1row.n === 3 && b1row.total_amount === 210000, JSON.stringify(b1row));
check('PB15 thời gian giữ chỗ lấy theo thiết lập của chủ sân (5 phút)', b1row.m === 5);

// Trang thanh toán
await ap.waitForSelector('[data-testid=countdown]');
const payText = await ap.textContent('main');
check('PB18 trang thanh toán: mã, sân con, khung giờ, tổng tiền, ngân hàng, số TK, chủ TK, nội dung = mã đặt chỗ, đếm ngược',
  (await ap.textContent('[data-testid=booking-code]')) === b1row.code && payText.includes('Sân 2') && payText.includes('Sân 4') && payText.includes('19:00 – 20:00') && payText.includes('20:00 – 21:00') &&
  (await ap.textContent('[data-testid=booking-total]')).includes('210.000') && (await ap.textContent('[data-testid=bank-name]')) === 'Ngân hàng mẫu ABC' && (await ap.textContent('[data-testid=bank-number]')) === '0123456789' &&
  (await ap.textContent('[data-testid=bank-holder]')) === 'TRAN VAN B' && (await ap.textContent('[data-testid=transfer-content]')) === b1row.code && (await ap.locator('[data-testid=payment-qr] img').count()) === 1 && /^0[34]:\d\d$/.test(await ap.textContent('[data-testid=countdown]')), payText.slice(0, 400));
const c1 = await ap.textContent('[data-testid=countdown]'); await ap.waitForTimeout(2200); const c2 = await ap.textContent('[data-testid=countdown]');
check('PB15 đồng hồ đếm ngược đang chạy', c2 < c1, `${c1} -> ${c2}`);

// Đồng hồ máy người dùng bị chỉnh lùi 10 phút
const skew = await browser.newContext({ storageState: await playerA.storageState(), viewport: { width: 1400, height: 900 } }); const sp = await skew.newPage();
await sp.clock.setFixedTime(new Date(Date.now() - 600000));
await sp.goto(B + `/bookings/${b1}`); await sp.waitForSelector('[data-testid=countdown]');
const s1 = await sp.textContent('[data-testid=countdown]'); await sp.waitForTimeout(2200); const s2 = await sp.textContent('[data-testid=countdown]');
check('PB15 đếm ngược theo giờ máy chủ: chỉnh đồng hồ máy lùi 10 phút không làm tăng thời gian còn lại', /^0[34]:/.test(s1) && s2 < s1, `${s1} -> ${s2}`);
await skew.close();

// Người chơi khác thấy ô đang giữ
const bp = await playerB.newPage();
await bp.goto(B + `/venues/${v1}?date=${weekday}`); await bp.waitForSelector('button[data-court]');
check('PB15 người chơi B thấy ô "Đang giữ" và không bấm được', (await cellState(bp, 'Sân 2', '19:00')) === 'held' && (await cell(bp, 'Sân 2', '19:00').isDisabled()) && (await cell(bp, 'Sân 2', '19:00').textContent()) === 'Đang giữ');

// Xung đột một phần
await cell(bp, 'Sân 1', '18:00').click(); await cell(bp, 'Sân 3', '18:00').click();
const grab = await hold(playerA, v1, [item(courts['Sân 3'], weekday, '18:00')]);
const before = (await sql(`select count(*)::int n from bookings where player_id='${pB}'`))[0].n;
await bp.click('text=Giữ chỗ và thanh toán'); await bp.waitForSelector('main [role=alert]');
const conflictMsg = await bp.textContent('main [role=alert]');
await bp.waitForFunction(() => document.querySelector('button[data-court="Sân 3"][data-time="18:00"]')?.getAttribute('data-state') === 'held');
check('PB15 xung đột một phần: không tạo lượt đặt, thông báo nêu ô xung đột, lưới tải lại', (await sql(`select count(*)::int n from bookings where player_id='${pB}'`))[0].n === before && conflictMsg.includes('Sân 3 lúc 18:00') && (await cellState(bp, 'Sân 1', '18:00')) === 'selected' && (await bp.locator('[data-testid=selection] li').count()) === 1, conflictMsg);
await api(playerA, 'PUT', `/api/bookings/${grab.json.data.booking.id}/cancel`);

// Hai người đặt cùng lúc
const race = await Promise.all([hold(playerA, v1, [item(courts['Sân 1'], weekday2, '10:00')]), hold(playerB, v1, [item(courts['Sân 1'], weekday2, '10:00')])]);
const codes = race.map((r) => r.status).sort();
check('PB15 hai yêu cầu cùng lúc: một 201, một 409, CSDL chỉ có một dòng còn hiệu lực', codes[0] === 201 && codes[1] === 409 && (await activeRows(courts['Sân 1'], weekday2, '10:00')) === 1, JSON.stringify(codes));
const loser = race.find((r) => r.status === 409);
check('PB15 phản hồi 409 kèm danh sách khung giờ xung đột', loser.json.data.conflicts?.[0]?.start_time === '10:00' && loser.json.data.conflicts[0].court_name === 'Sân 1', JSON.stringify(loser.json));
const winner = race.find((r) => r.status === 201); const winnerCtx = race.indexOf(winner) === 0 ? playerA : playerB;
await api(winnerCtx, 'PUT', `/api/bookings/${winner.json.data.booking.id}/cancel`);

// Giá cuối tuần, khung giờ đã qua, dữ liệu sai
const sat = await hold(playerB, v1, [item(courts['Sân 1'], saturday, '08:00')]);
check('PB14 khung giờ thứ bảy áp giá cuối tuần 90.000 đ', sat.status === 201 && sat.json.data.booking.items[0].price === 90000 && sat.json.data.booking.total_amount === 90000, JSON.stringify(sat.json));
const bSat = sat.json.data.booking.id;
check('PB14 API giữ khung giờ đã qua -> 400', (await hold(playerB, v1, [item(courts['Sân 1'], yesterday, '19:00')])).status === 400);
check('PB14 API giờ lẻ 19:30 -> 400', (await hold(playerB, v1, [item(courts['Sân 1'], weekday, '19:30')])).status === 400);
check('PB14 API danh sách rỗng -> 400', (await hold(playerB, v1, [])).status === 400);
check('PB14 API sân con của cơ sở khác -> 400', (await hold(playerB, v1, [item(v2court, weekday, '10:00')])).status === 400);
await bp.goto(B + `/venues/${v1}?date=${vnDate(0)}`); await bp.waitForSelector('button[data-court]');
const pastCells = bp.locator('button[data-state=past]');
check('PB14 ô đã qua trong ngày không chọn được', (await pastCells.count()) === 0 || (await pastCells.first().isDisabled()), 'count=' + (await pastCells.count()));

// =====================================================================  PB15: hết hạn giữ chỗ
// Lượt của B (thứ bảy) sắp hết hạn: trang thanh toán tự chuyển trạng thái khi đồng hồ về 0
await sql(`update bookings set hold_expires_at = now() + interval '4 seconds' where id=${bSat}`);
await bp.goto(B + `/bookings/${bSat}`); await bp.waitForSelector('[data-testid=countdown]');
await bp.waitForFunction(() => document.body.innerText.includes('Hết hạn giữ chỗ'), null, { timeout: 15000 });
check('PB15 hết thời gian giữ chỗ: trang tự chuyển sang "Hết hạn giữ chỗ", không còn nút báo chuyển khoản', (await statusOf(bSat)) === 'expired' && (await bp.locator('text=Tôi đã chuyển khoản').count()) === 0 && (await bp.locator('text=Đặt lại').count()) === 1);
check('PB18 API báo chuyển khoản sau khi hết hạn -> 409', (await api(playerB, 'PUT', `/api/bookings/${bSat}/payment-report`, {})).status === 409);
await ap.goto(B + `/venues/${v1}?date=${saturday}`); await ap.waitForSelector('button[data-court]');
check('PB15 ô hết hạn giữ trở lại Trống với người khác', (await cellState(ap, 'Sân 1', '08:00')) === 'available');
const reHold = await hold(playerA, v1, [item(courts['Sân 1'], saturday, '08:00')]);
check('PB15 người khác đặt được khung giờ vừa hết hạn', reHold.status === 201);
const bRe = reHold.json.data.booking.id;
// Hết hạn đúng lúc bấm nút (chưa kịp tải lại trang)
await sql(`update bookings set hold_expires_at = now() - interval '1 second' where id=${bRe}`);
const lateReport = await api(playerA, 'PUT', `/api/bookings/${bRe}/payment-report`, {});
check('PB18 báo chuyển khoản khi vừa quá hạn -> 409, lượt đặt Hết hạn giữ chỗ, sân được trả lại', lateReport.status === 409 && (await statusOf(bRe)) === 'expired' && (await activeRows(courts['Sân 1'], saturday, '08:00')) === 0, JSON.stringify(lateReport.json));

// =====================================================================  PB18: báo chuyển khoản, hủy giữ chỗ
await ap.goto(B + `/bookings/${b1}`); await ap.waitForSelector('[data-testid=countdown]');
await ap.fill('input[placeholder^="Ví dụ"]', 'Đã chuyển từ TK Nguyen Van A'); await ap.click('button:has-text("Tôi đã chuyển khoản")');
await ap.waitForFunction(() => document.body.innerText.includes('Chờ chủ sân xác nhận'));
check('PB18 báo đã chuyển khoản trong hạn -> Chờ chủ sân xác nhận', (await statusOf(b1)) === 'awaiting_confirmation' && (await ap.textContent('main')).includes('Đã chuyển từ TK Nguyen Van A'));
await sql(`update bookings set hold_expires_at = now() - interval '1 hour' where id=${b1}`);
check('Tác vụ định kỳ thiếu khóa bí mật -> 401', (await api(g, 'POST', '/api/cron/expire-holds')).status === 401);
const cron = await g.request.post(B + '/api/cron/expire-holds', { headers: { authorization: 'Bearer test-secret' } });
check('Tác vụ định kỳ chạy được với khóa bí mật', cron.status() === 200 && typeof (await cron.json()).data.expired === 'number');
check('PB18 đã báo thanh toán thì quá thời gian giữ chỗ ban đầu vẫn giữ sân', (await statusOf(b1)) === 'awaiting_confirmation' && (await activeRows(courts['Sân 2'], weekday, '19:00')) === 1);
check('PB18 báo chuyển khoản lần hai -> 409', (await api(playerA, 'PUT', `/api/bookings/${b1}/payment-report`, {})).status === 409);
check('PB18 lượt đặt không tồn tại -> 404', (await api(playerB, 'GET', '/api/bookings/999999')).status === 404);
check('PB18 người chơi khác xem lượt đặt -> 403', (await api(playerB, 'GET', `/api/bookings/${b1}`)).status === 403);
check('PB18 người chơi khác báo thanh toán hộ -> 403', (await api(playerB, 'PUT', `/api/bookings/${b1}/payment-report`, {})).status === 403);

const h2 = await hold(playerA, v1, [item(courts['Sân 3'], weekday, '07:00')]); const b2 = h2.json.data.booking.id;
await ap.goto(B + `/bookings/${b2}`); await ap.click('text=Hủy giữ chỗ'); await ap.click('text=Xác nhận hủy');
await ap.waitForFunction(() => document.body.innerText.includes('Bạn đã hủy lượt đặt này'));
check('PB18 hủy giữ chỗ -> Đã hủy, ô trống trở lại ngay', (await statusOf(b2)) === 'cancelled' && (await activeRows(courts['Sân 3'], weekday, '07:00')) === 0);

// =====================================================================  PB16: chủ sân
const op = await ownerA.newPage();
await op.goto(B + '/owner/bookings'); await op.waitForSelector('[data-testid=owner-booking]');
const card = op.locator(`[data-testid=owner-booking][data-code="${b1row.code}"]`);
const cardText = await card.textContent();
check('PB16 chủ sân thấy lượt chờ xác nhận: người đặt, số điện thoại, ghi chú, nội dung chuyển khoản', cardText.includes('Nguyễn Văn A') && cardText.includes('0905000003') && cardText.includes('Đã chuyển từ TK Nguyen Van A') && cardText.includes('210.000') && (await op.textContent('nav[aria-label="Trạng thái lượt đặt"]')).includes('Chờ xác nhận thanh toán (1)'), cardText);
const foreign = await api(ownerB, 'PUT', `/api/owner/bookings/${b1}/status`, { action: 'confirm_payment' });
check('PB16 chủ sân khác xác nhận lượt đặt -> 403, trạng thái không đổi', foreign.status === 403 && (await statusOf(b1)) === 'awaiting_confirmation', String(foreign.status));
check('PB16 chủ sân khác không thấy lượt đặt của sân A', (await api(ownerB, 'GET', '/api/owner/bookings')).json.data.bookings.every((b) => b.venue_id === v2) && (await api(ownerB, 'GET', `/api/owner/bookings?venue_id=${v1}`)).status === 403);
check('PB16 người chơi gọi API của chủ sân -> 403', (await api(playerA, 'GET', '/api/owner/bookings')).status === 403 && (await api(playerA, 'PUT', `/api/owner/bookings/${b1}/status`, { action: 'confirm_payment' })).status === 403);
await card.locator('text=Đã nhận tiền').click();
await op.waitForFunction(() => document.body.innerText.includes('Chờ xác nhận thanh toán (0)'));
check('PB16 chủ sân bấm "Đã nhận tiền" -> Đã xác nhận', (await statusOf(b1)) === 'confirmed');
await ap.goto(B + '/bookings');
check('PB16 người chơi thấy trạng thái mới trong lịch sử', (await ap.locator(`[data-testid=booking-card]:has-text("${b1row.code}")`).textContent()).includes('Đã xác nhận'));

const h3 = await hold(playerA, v1, [item(courts['Sân 1'], weekday2, '18:00')]); const b3 = h3.json.data.booking.id; const code3 = h3.json.data.booking.code;
await api(playerA, 'PUT', `/api/bookings/${b3}/payment-report`, {});
await op.goto(B + '/owner/bookings'); const card3 = op.locator(`[data-testid=owner-booking][data-code="${code3}"]`);
await card3.locator('text=Chưa nhận được').click(); await card3.locator('button:has-text("Hủy lượt đặt")').click();
await card3.locator('[role=alert]').waitFor();
check('PB16 "Chưa nhận được" không nhập lý do -> không cho hủy', (await statusOf(b3)) === 'awaiting_confirmation' && (await card3.locator('[role=alert]').textContent()).includes('lý do'));
check('PB16 API hủy không có lý do -> 400', (await api(ownerA, 'PUT', `/api/owner/bookings/${b3}/status`, { action: 'cancel' })).status === 400);
await card3.locator('input').fill('Chưa nhận được tiền chuyển khoản'); await card3.locator('button:has-text("Hủy lượt đặt")').click();
await op.waitForFunction((c) => !document.querySelector(`[data-code="${c}"]`), code3);
check('PB16 nhập lý do -> Đã hủy, sân mở lại', (await statusOf(b3)) === 'cancelled' && (await activeRows(courts['Sân 1'], weekday2, '18:00')) === 0);
await ap.goto(B + `/bookings/${b3}`);
check('PB16 người chơi thấy lý do chủ sân hủy', (await ap.textContent('main')).includes('Chủ sân đã hủy lượt đặt này') && (await ap.textContent('main')).includes('Chưa nhận được tiền chuyển khoản'));
check('PB16 xác nhận lượt đã hủy -> 409', (await api(ownerA, 'PUT', `/api/owner/bookings/${b3}/status`, { action: 'confirm_payment' })).status === 409);

// =====================================================================  PB17: lịch sử
const h4 = await hold(playerA, v1, [item(courts['Sân 4'], weekday2, '06:00')]); const b4 = h4.json.data.booking.id;     // đang giữ chỗ
const h5 = await hold(playerA, v1, [item(courts['Sân 4'], weekday2, '07:00')]); const b5 = h5.json.data.booking.id;
await api(playerA, 'PUT', `/api/bookings/${b5}/payment-report`, {});                                                      // chờ xác nhận
await ap.goto(B + '/bookings'); await ap.waitForSelector('[data-testid=booking-card]');
const statuses = await ap.locator('[data-testid=booking-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')));
check('PB17 lịch sử có đủ 5 trạng thái', ['holding', 'awaiting_confirmation', 'confirmed', 'cancelled', 'expired'].every((s) => statuses.includes(s)), JSON.stringify(statuses));
const holdingCard = ap.locator('[data-testid=booking-card][data-status=holding]').first();
check('PB17 lượt Đang giữ chỗ có nút "Thanh toán" và thời gian còn lại', (await holdingCard.locator('a:has-text("Thanh toán")').count()) === 1 && /còn 0[34]:\d\d/.test(await holdingCard.textContent()), await holdingCard.textContent());
const confirmedCard = await ap.locator(`[data-testid=booking-card]:has-text("${b1row.code}")`).textContent();
check('PB17 mỗi lượt hiện sân con, khung giờ, tổng tiền', confirmedCard.includes('Sân 2') && confirmedCard.includes('19:00 – 20:00') && confirmedCard.includes('210.000'));
await ap.click('nav[aria-label="Lọc lượt đặt"] >> text=Đã hủy, hết hạn'); await ap.waitForURL('**scope=closed');
const closed = await ap.locator('[data-testid=booking-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')));
check('PB17 lọc "Đã hủy, hết hạn"', closed.length > 0 && closed.every((s) => s === 'cancelled' || s === 'expired'), JSON.stringify(closed));
check('PB17 API scope không hợp lệ -> 400', (await api(playerA, 'GET', '/api/bookings?scope=abc')).status === 400);
check('PB17 người chơi B không thấy lượt của A', (await api(playerB, 'GET', '/api/bookings')).json.data.bookings.every((b) => b.id !== b1));

// Hủy lượt đã xác nhận chưa đến giờ chơi
await ap.goto(B + `/bookings/${b1}`); await ap.click('text=Hủy lượt đặt'); await ap.click('text=Xác nhận hủy');
await ap.waitForFunction(() => document.body.innerText.includes('Bạn đã hủy lượt đặt này'));
check('PB17 hủy lượt đã xác nhận trước giờ chơi -> Đã hủy, khung giờ trống trở lại', (await statusOf(b1)) === 'cancelled' && (await activeRows(courts['Sân 2'], weekday, '19:00')) === 0);

// Lượt đã qua giờ chơi
await api(ownerA, 'PUT', `/api/owner/bookings/${b5}/status`, { action: 'confirm_payment' });
await sql(`update booking_items set booking_date = '${yesterday}' where booking_id=${b5}`);
await ap.goto(B + `/bookings/${b5}`);
check('PB17 lượt đã qua giờ chơi: không có nút hủy', (await ap.locator('button:has-text("Hủy")').count()) === 0 && (await ap.textContent('main')).includes('đã qua giờ chơi'));
check('PB17 API hủy lượt đã qua giờ chơi -> 409', (await api(playerA, 'PUT', `/api/bookings/${b5}/cancel`)).status === 409 && (await statusOf(b5)) === 'confirmed');
const pastList = (await api(playerA, 'GET', '/api/bookings?scope=past')).json.data.bookings;
const upcoming = (await api(playerA, 'GET', '/api/bookings?scope=upcoming')).json.data.bookings;
check('PB17 scope past / upcoming phân loại đúng', pastList.length === 1 && pastList[0].id === b5 && upcoming.some((b) => b.id === b4) && !upcoming.some((b) => b.id === b5));
check('PB16 chủ sân không hủy được lượt đã qua giờ chơi -> 409', (await api(ownerA, 'PUT', `/api/owner/bookings/${b5}/status`, { action: 'cancel', reason: 'x' })).status === 409);

// Giới hạn số lượt giữ chỗ cùng lúc
// =====================================================================  Quy định đặt sân riêng của từng sân
const rules = (await sql(`select max_slots_per_booking a, advance_days b, max_active_holds c from venues where id=${v1}`))[0];
check('Quy định mặc định của sân: 20 khung giờ, đặt trước 7 ngày, 2 lượt giữ chỗ', rules.a === 20 && rules.b === 7 && rules.c === 2, JSON.stringify(rules));
await hold(playerB, v1, [item(courts['Sân 1'], weekday, '05:00')]); await hold(playerB, v1, [item(courts['Sân 1'], weekday, '06:00')]);
const third = await hold(playerB, v1, [item(courts['Sân 1'], weekday, '08:00')]);
check('Mặc định tối đa 2 lượt giữ chỗ cùng lúc tại một sân -> lượt thứ 3 bị 409', third.status === 409 && third.json.message.includes('2 lượt giữ chỗ'), JSON.stringify(third.json));
check('Giới hạn giữ chỗ tính riêng từng sân', (await hold(playerB, v2, [item(v2court, weekday, '06:00')])).status === 201);
check('API giữ chỗ quá 7 ngày đặt trước -> 400', (await hold(playerA, v1, [item(courts['Sân 1'], vnDate(8), '10:00')])).status === 400);
// Chủ sân đổi quy định ở form sửa sân
await op.goto(B + `/owner/venues/${v1}`); await op.waitForSelector('input[name=advance_days]');
check('Form sửa sân có 3 ô quy định với giá trị hiện tại', (await op.inputValue('input[name=max_slots_per_booking]')) === '20' && (await op.inputValue('input[name=advance_days]')) === '7' && (await op.inputValue('input[name=max_active_holds]')) === '2');
await op.fill('input[name=advance_days]', '45'); await op.click('button[type=submit]');
await op.waitForFunction(() => document.body.innerText.includes('Số ngày đặt trước từ 1 đến 30'));
check('Quy định ngoài khoảng cho phép -> báo lỗi, không lưu', (await sql(`select advance_days b from venues where id=${v1}`))[0].b === 7);
await op.fill('input[name=max_slots_per_booking]', '2'); await op.fill('input[name=advance_days]', '3'); await op.fill('input[name=max_active_holds]', '1'); await op.click('button[type=submit]');
await op.waitForFunction(() => document.body.innerText.includes('Đã lưu thông tin sân'));
const saved = (await sql(`select max_slots_per_booking a, advance_days b, max_active_holds c from venues where id=${v1}`))[0];
check('Chủ sân lưu quy định riêng: 2 khung giờ, 3 ngày, 1 lượt giữ chỗ', saved.a === 2 && saved.b === 3 && saved.c === 1, JSON.stringify(saved));
await sql(`update bookings set status='cancelled' where status='holding'`); await sql(`update booking_items bi set is_active=false from bookings b where b.id=bi.booking_id and b.status='cancelled'`);
await ap.goto(B + `/venues/${v1}?date=${vnDate(1)}`); await ap.waitForSelector('button[data-court]');
check('Trang sân chỉ cho chọn ngày trong 3 ngày tới và ghi rõ quy định', (await ap.locator('a[href*="?date="]').count()) === 4 && (await ap.textContent('main')).includes('Đặt trước tối đa 3 ngày'));
await cell(ap, 'Sân 1', '12:00').click(); await cell(ap, 'Sân 1', '13:00').click(); await cell(ap, 'Sân 1', '14:00').click();
check('Chọn quá số khung giờ sân cho phép -> báo lỗi, không chọn thêm', (await ap.textContent('main [role=alert]')).includes('tối đa 2 khung giờ') && (await ap.locator('[data-testid=selection] li').count()) === 2);
check('API gửi 3 khung giờ khi sân cho tối đa 2 -> 400', (await hold(playerA, v1, [item(courts['Sân 2'], vnDate(1), '12:00'), item(courts['Sân 2'], vnDate(1), '13:00'), item(courts['Sân 2'], vnDate(1), '14:00')])).status === 400);
check('API giữ chỗ ngày thứ 4 khi sân chỉ nhận trước 3 ngày -> 400', (await hold(playerA, v1, [item(courts['Sân 1'], vnDate(4), '10:00')])).status === 400);
check('Lọc sân trống theo ngày vượt quy định của sân: sân đó không hiện', !(await api(g, 'GET', `/api/venues?date=${vnDate(4)}&start_time=10:00`)).json.data.venues.some((v) => v.id === v1));
const one = await hold(playerA, v1, [item(courts['Sân 3'], vnDate(1), '12:00')]);
const two = await hold(playerA, v1, [item(courts['Sân 3'], vnDate(1), '13:00')]);
check('Sân đặt 1 lượt giữ chỗ cùng lúc -> lượt thứ 2 bị 409', one.status === 201 && two.status === 409, `${one.status} ${two.status}`);

// Điều hướng
check('Thanh điều hướng người chơi có "Lịch đặt của tôi"', (await ap.locator('header a[href="/bookings"]').count()) === 1);
check('Khu vực chủ sân có "Lịch đặt sân"', (await op.locator('aside a[href="/owner/bookings"]').count()) === 1);
const anon = await newCtx(); const anp = await anon.newPage(); await anp.goto(B + '/bookings');
check('Khách mở /bookings -> chuyển tới đăng nhập', anp.url().includes('/login'));

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length}/${results.length} đạt`); failed.forEach(([, n]) => console.log('  CHƯA ĐẠT:', n));
await browser.close();
process.exit(failed.length ? 1 : 0);
