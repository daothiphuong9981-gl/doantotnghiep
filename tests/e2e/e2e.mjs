// Kiểm thử đầu-cuối Sprint 1 bằng Playwright. Xem README mục "Kiểm thử".
import { chromium } from 'playwright';
const B = 'http://127.0.0.1:3000';
const results = [];
const check = (name, cond, extra = '') => { results.push([cond, name]); console.log(cond ? 'PASS' : 'FAIL', name, extra); };
const sql = async (q) => { return (await fetch('http://127.0.0.1:54321/__sql', { method: 'POST', body: q })).json(); };
const browser = await chromium.launch();
const newCtx = (opts = {}) => browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
const stamp = Date.now();
const ownerEmail = `owner${stamp}@example.com`, owner2Email = `owner2${stamp}@example.com`, playerEmail = `player${stamp}@example.com`;

async function register(page, { name, email, phone = '0905123456', password = 'matkhau123', role = 'player', consent = true }) {
  await page.goto(B + '/register');
  await page.fill('input[name=full_name]', name); await page.fill('input[name=email]', email); await page.fill('input[name=phone]', phone); await page.fill('input[name=password]', password);
  await page.check(`input[name=role][value=${role}]`);
  if (consent) await page.check('input[name=consent]');
  await page.click('button[type=submit]');
}
// ---------- PB03 đăng ký
const ownerCtx = await newCtx(); const op = await ownerCtx.newPage();
await register(op, { name: 'Trần Văn B', email: ownerEmail, role: 'owner' });
await op.waitForURL('**/owner/venues');
check('PB03 đăng ký chủ sân -> trang quản lý sân', op.url().endsWith('/owner/venues'));
const prof = await sql(`select role, consent_at is not null c from profiles p join auth.users u on u.id=p.id where u.email='${ownerEmail}'`);
check('PB03 hồ sơ role=owner, có consent_at', prof[0]?.role === 'owner' && prof[0]?.c === true);
const g = await newCtx(); const gp = await g.newPage();
await register(gp, { name: 'X', email: ownerEmail }); await gp.waitForSelector('main [role=alert]');
check('PB03 email đã tồn tại', (await gp.textContent('main [role=alert]')).includes('Email đã được sử dụng'));
await register(gp, { name: 'X', email: `w${stamp}@example.com`, password: '12345' }); await gp.waitForSelector('main [role=alert]');
check('PB03 mật khẩu yếu', (await gp.textContent('main [role=alert]')).includes('ít nhất 8'));
await register(gp, { name: 'X', email: `w${stamp}@example.com`, phone: '' }); await gp.waitForSelector('main [role=alert]');
check('PB03 thiếu số điện thoại', (await gp.textContent('main [role=alert]')).includes('Số điện thoại'));
await register(gp, { name: 'X', email: `w${stamp}@example.com`, consent: false }); await gp.waitForSelector('main [role=alert]');
check('PB03 chưa đồng ý xử lý dữ liệu', (await gp.textContent('main [role=alert]')).includes('đồng ý'));
check('PB03 không tạo tài khoản khi lỗi', (await sql(`select count(*)::int n from auth.users where email='w${stamp}@example.com'`))[0].n === 0);

// ---------- PB06 đăng ký sân
async function fillVenue(page, o = {}) {
  await page.fill('input[name=name]', o.name ?? 'Sân cầu lông Sông Hàn');
  await page.selectOption('select[name=ward_id]', String(o.ward ?? 1));
  await page.fill('input[name=address]', o.address ?? '12 Bạch Đằng');
  await page.fill('input[name=court_count]', String(o.courts ?? 4));
  await page.fill('input[name=hold_minutes]', String(o.hold ?? 15));
  await page.selectOption('select[name=bank_bin]', '970436');
  await page.fill('input[name=bank_account_number]', o.account ?? '0123456789');
  await page.fill('input[name=bank_account_name]', 'TRAN VAN B');
  await page.fill('textarea[name=description]', 'Sân thảm, có bãi giữ xe');
}
await op.goto(B + '/owner/venues/new'); await op.waitForSelector('.leaflet-container');
await fillVenue(op); await op.click('button[type=submit]'); await op.waitForSelector('main [role=alert]');
check('PB06 chưa chọn vị trí -> báo lỗi', (await op.textContent('body')).includes('Hãy chọn vị trí trên bản đồ'));
await op.click('.leaflet-container', { position: { x: 200, y: 160 } });
await op.waitForFunction(() => document.body.innerText.includes('Tọa độ:'));
await op.fill('input[name=hold_minutes]', '90'); await op.click('button[type=submit]');
await op.waitForFunction(() => document.body.innerText.includes('từ 5 đến 60'));
check('PB07 thời gian giữ chỗ 90 -> báo lỗi', true);
await op.fill('input[name=hold_minutes]', '20'); await op.fill('input[name=bank_account_number]', ''); await op.click('button[type=submit]');
await op.waitForFunction(() => document.body.innerText.includes('Số tài khoản chỉ gồm chữ số'));
check('PB07 thiếu số tài khoản -> báo lỗi, không lưu', (await sql(`select count(*)::int n from venues`))[0].n === 0);
await op.fill('input[name=bank_account_number]', '0123456789'); await op.click('button[type=submit]');
await op.waitForURL('**/owner/venues/*?created=1');
const venueId = Number(op.url().match(/venues\/(\d+)/)[1]);
const v = (await sql(`select status, hold_minutes, latitude, (select count(*)::int from courts where venue_id=venues.id) c from venues where id=${venueId}`))[0];
check('PB06 sân mới Chờ duyệt, 4 sân con, giữ chỗ 20', v.status === 'pending' && v.c === 4 && v.hold_minutes === 20 && Number(v.latitude) > 15, JSON.stringify(v));
// ---------- PB08 bảng giá
await op.click('text=+ Thêm');
const rows = op.locator('section:has-text("Bảng giá theo khung giờ") tbody tr');
await rows.nth(0).locator('input[type=time]').nth(0).fill('16:00'); await rows.nth(0).locator('input[type=time]').nth(1).fill('18:00');
await rows.nth(1).locator('input[type=time]').nth(0).fill('17:00'); await rows.nth(1).locator('input[type=time]').nth(1).fill('22:00');
await op.click('text=Lưu bảng giá'); await op.waitForFunction(() => document.body.innerText.includes('bị trùng giờ'));
check('PB08 khung giá trùng giờ -> báo lỗi, không lưu', (await sql(`select count(*)::int n from price_slots where venue_id=${venueId}`))[0].n === 0);
await rows.nth(0).locator('input[type=time]').nth(0).fill('05:00'); await rows.nth(0).locator('input[type=time]').nth(1).fill('17:00'); await rows.nth(0).locator('input[type=number]').fill('50000');
await rows.nth(1).locator('input[type=number]').fill('60000');
await op.click('text=+ Thêm'); await rows.nth(2).locator('select').selectOption('weekend'); await rows.nth(2).locator('input[type=time]').nth(0).fill('05:00'); await rows.nth(2).locator('input[type=time]').nth(1).fill('22:00'); await rows.nth(2).locator('input[type=number]').fill('70000');
await op.click('text=Lưu bảng giá'); await op.waitForFunction(() => document.body.innerText.includes('Đã lưu bảng giá'));
check('PB08 lưu bảng giá 3 dòng', (await sql(`select count(*)::int n from price_slots where venue_id=${venueId}`))[0].n === 3);
// ---------- PB08 ảnh
const fileInput = op.locator('input[type=file]');
await fileInput.setInputFiles('doc.pdf'); await op.waitForFunction(() => document.body.innerText.includes('Chỉ nhận ảnh JPG hoặc PNG'));
check('PB08 tệp PDF bị từ chối', true);
await fileInput.setInputFiles('big.jpg'); await op.waitForFunction(() => document.body.innerText.includes('vượt quá 2 MB'));
check('PB08 ảnh > 2 MB bị từ chối', true);
await fileInput.setInputFiles('court.jpg'); await op.waitForSelector('img[alt="Ảnh sân"]', { timeout: 15000 });
check('PB08 tải ảnh JPG thành công', (await sql(`select count(*)::int n from venue_images where venue_id=${venueId}`))[0].n === 1);
// ---------- PB09 khách: sân pending chưa hiện
await gp.goto(B + '/'); await gp.waitForSelector('.leaflet-container');
check('PB06/PB09 sân chờ duyệt chưa hiện ở trang chủ', (await gp.textContent('body')).includes('Chưa có sân nào được duyệt'));
check('PB11 sân chưa duyệt -> trang chi tiết 404', (await gp.goto(B + `/venues/${venueId}`)).status() === 404);
// duyệt bằng SQL (thay cho chức năng quản trị ở Sprint 3)
await sql(`update venues set status='approved' where id=${venueId}`);
// sân thứ hai của chủ sân khác, ở xa hơn
const o2 = await newCtx(); const o2p = await o2.newPage();
await register(o2p, { name: 'Võ Thị F', email: owner2Email, role: 'owner' }); await o2p.waitForURL('**/owner/venues');
await o2p.goto(B + '/owner/venues/new'); await o2p.waitForSelector('.leaflet-container');
await fillVenue(o2p, { name: 'Sân cầu lông Cẩm Lệ Xanh', ward: 11, address: '20 Cách Mạng Tháng 8', courts: 2 });
await o2p.click('.leaflet-container', { position: { x: 60, y: 300 } }); await o2p.waitForFunction(() => document.body.innerText.includes('Tọa độ:'));
await o2p.click('button[type=submit]'); await o2p.waitForURL('**/owner/venues/*?created=1');
const venue2 = Number(o2p.url().match(/venues\/(\d+)/)[1]);
await sql(`update venues set status='approved' where id=${venue2}`);
// PB02/PB05: chủ sân 2 mở sân của chủ sân 1
check('PB02 chủ sân khác mở trang sửa sân -> 404', (await o2p.goto(B + `/owner/venues/${venueId}`)).status() === 404);
const put = await o2p.request.put(B + `/api/owner/venues/${venueId}`, { data: { status: 'suspended' } });
check('PB02 chủ sân khác gọi API tạm ngừng -> bị từ chối', put.status() === 409 && (await sql(`select status from venues where id=${venueId}`))[0].status === 'approved', String(put.status()));
const putPrices = await o2p.request.put(B + `/api/owner/venues/${venueId}/prices`, { data: { prices: [{ day_type: 'weekday', start_time: '05:00', end_time: '06:00', price: 1 }] } });
check('PB02 chủ sân khác gọi API sửa giá -> 403', putPrices.status() === 403, String(putPrices.status()));
// ---------- PB09 trang chủ
await gp.goto(B + '/'); await gp.waitForSelector('.price-pin');
const body = await gp.textContent('body');
check('PB09 trang chủ hiện 2 sân đã duyệt + giá từ', body.includes('Sân cầu lông Sông Hàn') && body.includes('Sân cầu lông Cẩm Lệ Xanh') && body.includes('50.000 đ') && body.includes('2 sân'));
check('PB09 bản đồ có 2 nhãn giá và ghi nguồn OpenStreetMap', (await gp.locator('.price-pin').count()) === 2 && (await gp.textContent('.leaflet-control-attribution')).includes('OpenStreetMap'));
// ---------- PB11 chi tiết
await gp.click('text=Sân cầu lông Sông Hàn'); await gp.waitForURL(`**/venues/${venueId}`);
const d = await gp.textContent('body');
check('PB11 chi tiết: tên, địa chỉ, bảng giá, giữ chỗ, lưới khung giờ', d.includes('12 Bạch Đằng') && d.includes('Phường Hải Châu') && d.includes('60.000 đ') && d.includes('Giữ chỗ 20 phút') && d.includes('Sân 4') && (await gp.locator('table caption').count()) === 1 && (await gp.locator('img[alt^="Ảnh 1"]').count()) === 1);
const av = await (await gp.request.get(B + `/api/venues/${venueId}/availability?date=2020-01-01`)).json();
check('PB11 API khung giờ ngày đã qua -> 400', av.statusCode === 400);
// ---------- PB10 gần tôi
const geo = await newCtx({ geolocation: { latitude: Number(v.latitude), longitude: 108.2208 }, permissions: ['geolocation'] }); const gg = await geo.newPage();
await gg.goto(B + '/'); await gg.waitForSelector('.price-pin'); await gg.click('text=Gần tôi nhất'); await gg.waitForSelector('text=Sắp xếp theo khoảng cách');
const names = await gg.locator('li h3').allTextContents(); const kms = await gg.locator('li').allTextContents();
const near = await (await gg.request.get(B + `/api/venues?lat=${v.latitude}&lng=108.2208`)).json();
check('PB10 sắp xếp theo khoảng cách tăng dần, có km', near.data.venues.length === 2 && near.data.venues[0].distance_km <= near.data.venues[1].distance_km && names[0] === near.data.venues[0].name && kms[0].includes('km'), JSON.stringify(near.data.venues.map((x) => [x.name, x.distance_km])));
const noGeo = await newCtx({ permissions: [] }); const ng = await noGeo.newPage();
await ng.goto(B + '/'); await ng.waitForSelector('.price-pin'); await ng.click('text=Gần tôi nhất'); await ng.waitForSelector('main [role=status]');
check('PB10 từ chối quyền vị trí: có hướng dẫn, danh sách vẫn dùng được', (await ng.textContent('main [role=status]')).includes('quyền vị trí') && (await ng.locator('li h3').count()) === 2);
// ---------- PB04, PB05 người chơi
const pc = await newCtx(); const pp = await pc.newPage();
await register(pp, { name: 'Nguyễn Văn A', email: playerEmail }); await pp.waitForURL(B + '/');
check('PB03 đăng ký người chơi -> trang tìm sân', true);
await pp.goto(B + '/owner/venues'); check('PB05 người chơi mở trang chủ sân -> bị chuyển hướng', new URL(pp.url()).pathname === '/');
await pp.goto(B + '/admin'); check('PB05 người chơi mở trang quản trị -> bị chuyển hướng', new URL(pp.url()).pathname === '/');
await pp.goto(B + '/account');
check('PB05 ô email không sửa được', await pp.locator('input[disabled]').first().inputValue() === playerEmail);
await pp.fill('input[name=full_name]', 'Nguyễn Văn An'); await pp.fill('input[name=phone]', '0935111222'); await pp.click('text=Lưu thông tin'); await pp.waitForSelector('text=Đã lưu thông tin cá nhân');
check('PB05 cập nhật hồ sơ', (await sql(`select full_name, phone from profiles p join auth.users u on u.id=p.id where u.email='${playerEmail}'`))[0].phone === '0935111222');
await pp.fill('input[name=current_password]', 'saimatkhau'); await pp.fill('input[name=new_password]', 'matkhaumoi456'); await pp.click('button:has-text("Đổi mật khẩu")'); await pp.waitForSelector('text=Mật khẩu hiện tại không đúng');
check('PB04 đổi mật khẩu: sai mật khẩu hiện tại', true);
await pp.fill('input[name=current_password]', 'matkhau123'); await pp.fill('input[name=new_password]', 'matkhaumoi456'); await pp.click('button:has-text("Đổi mật khẩu")'); await pp.waitForSelector('text=Đã đổi mật khẩu');
check('PB04 đổi mật khẩu thành công', true);
await pp.click('text=Đăng xuất'); await pp.waitForURL(B + '/');
await pp.goto(B + '/account'); check('PB04 đăng xuất: trang cần đăng nhập chuyển tới /login', new URL(pp.url()).pathname === '/login');
await pp.fill('input[name=email]', playerEmail); await pp.fill('input[name=password]', 'matkhau123'); await pp.click('button[type=submit]'); await pp.waitForSelector('main [role=alert]');
check('PB04 đăng nhập sai (mật khẩu cũ)', (await pp.textContent('main [role=alert]')).includes('Email hoặc mật khẩu không đúng'));
await pp.fill('input[name=email]', playerEmail); await pp.fill('input[name=password]', 'matkhaumoi456'); await pp.click('button[type=submit]'); await pp.waitForURL('**/account');
check('PB04 đăng nhập bằng mật khẩu mới, quay lại trang đang mở', true);
// tài khoản bị khóa
await sql(`update profiles set is_locked=true where id=(select id from auth.users where email='${playerEmail}')`);
await pp.click('text=Đăng xuất').catch(() => {}); await pp.goto(B + '/login');
await pp.fill('input[name=email]', playerEmail); await pp.fill('input[name=password]', 'matkhaumoi456'); await pp.click('button[type=submit]'); await pp.waitForSelector('main [role=alert]');
check('PB04 tài khoản bị khóa không đăng nhập được', (await pp.textContent('main [role=alert]')).includes('bị khóa'));
// ---------- PB07 tạm ngừng
await op.goto(B + '/owner/venues'); await op.click('button:has-text("Tạm ngừng")'); await op.waitForSelector('button:has-text("Mở lại")');
await gp.goto(B + '/'); await gp.waitForSelector('.price-pin');
check('PB07 tạm ngừng: sân không còn ở trang chủ', !(await gp.textContent('body')).includes('Sân cầu lông Sông Hàn'));
await op.click('button:has-text("Mở lại")'); await op.waitForSelector('button:has-text("Tạm ngừng")');
// sửa sân: giảm số sân con
await op.goto(B + `/owner/venues/${venueId}`); await op.waitForSelector('.leaflet-container'); await op.fill('input[name=court_count]', '3'); await op.click('text=Lưu thông tin'); await op.waitForSelector('text=Đã lưu thông tin sân');
check('PB07 sửa sân: còn 3 sân con hoạt động, trạng thái giữ nguyên Đã duyệt', (await sql(`select (select count(*)::int from courts where venue_id=${venueId} and is_active) c, status from venues where id=${venueId}`))[0].c === 3 && (await sql(`select status from venues where id=${venueId}`))[0].status === 'approved');
await browser.close();
const failed = results.filter((r) => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} đạt`);
process.exit(failed.length ? 1 : 0);
