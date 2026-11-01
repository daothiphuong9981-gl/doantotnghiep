// Kiểm thử phần xử lý thuần của trợ lý AI (không gọi Gemini). Cần Node 22.18 trở lên (chạy trực tiếp tệp .ts).
import { askText, buildExtractionPrompt, buildReplyPrompt, cheaperMaxPrice, decide, describeFilter, EMPTY_FILTER, findRunWindows, hasConsecutive, hoursOf, matchWard, mergeFreeHours, noResultReply, sanitizeFilter, slotLimitNote, templateReply } from '../../src/lib/ai/filter.ts';
import { parseJsonObject } from '../../src/lib/ai/gemini.ts';

let passed = 0;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, cond ? '' : extra); if (cond) passed += 1; else process.exitCode = 1; };
const wards = [{ id: 1, name: 'Phường Hải Châu' }, { id: 7, name: 'Phường Sơn Trà' }, { id: 24, name: 'Xã Hòa Vang' }];
const ctx = { today: '2026-11-11', currentHour: 9, wards, hasLocation: false }; // thứ tư
const run = (raw, c = ctx) => sanitizeFilter(raw, c);

// Câu hỏi đầy đủ
let r = run({ in_scope: true, ward_name: 'Phường Hải Châu', date: '2026-11-14', time_from: '18:00', time_to: '22:00', max_price: 80000, near_me: false, cheaper: false });
ok('bộ lọc đầy đủ được giữ nguyên', r.filter.ward_id === 1 && r.filter.date === '2026-11-14' && r.filter.time_from === '18:00' && r.filter.time_to === '22:00' && r.filter.max_price === 80000 && r.dropped.length === 0);
ok('đủ thông tin -> tìm kiếm', decide(r.filter, r.dropped, r.inScope).kind === 'search');
ok('khung giờ 18-22 tách thành 4 giờ', hoursOf(r.filter).join() === '18:00,19:00,20:00,21:00');

// Tên phường
ok('nhận phường không dấu, thiếu chữ "Phường"', matchWard('hai chau', wards)?.id === 1 && matchWard('Sơn Trà', wards)?.id === 7 && matchWard('xã hòa vang', wards)?.id === 24);
ok('phường không tồn tại -> null', matchWard('Phường Không Có', wards) === null);

// Giá trị không hợp lệ từ mô hình
r = run({ in_scope: true, ward_name: 'Phường Không Có', date: '2026-11-01', near_me: false, cheaper: false });
ok('ngày đã qua và phường lạ bị bỏ, không lỗi', r.filter.ward_id === null && r.filter.date === null && r.dropped.includes('date') && r.dropped.includes('ward'));
let d = decide(r.filter, r.dropped, r.inScope);
ok('bộ lọc không hợp lệ -> hỏi lại', d.kind === 'ask' && d.missing.includes('date') && d.missing.includes('ward'));
ok('câu hỏi lại nêu rõ phần chưa dùng được', askText(d.missing, r.dropped).includes('ngày bạn nêu đã qua') && askText(d.missing, r.dropped).includes('chưa nhận ra khu vực'));
r = run({ in_scope: true, date: 'thứ bảy', time_from: 'tối', max_price: -5, min_price: 'abc', radius_km: 'x' });
ok('kiểu dữ liệu sai bị bỏ', r.filter.date === null && r.filter.time_from === null && r.filter.max_price === null && r.filter.min_price === null);
r = run({ in_scope: true, date: '2027-06-01' });
ok('ngày quá 30 ngày bị bỏ', r.filter.date === null && r.dropped.includes('date'));
r = run({ in_scope: true, ward_name: 'Hải Châu', min_price: 90000, max_price: 50000 });
ok('giá thấp nhất lớn hơn giá cao nhất -> bỏ cả hai', r.filter.min_price === null && r.filter.max_price === null && r.dropped.includes('price'));
ok('lỗi giá không chặn tìm kiếm', decide(r.filter, r.dropped, true).kind === 'search');

// Giờ
r = run({ in_scope: true, date: '2026-11-11', time_from: '06:00', time_to: '12:00' });
ok('hôm nay: bỏ các giờ đã qua (bây giờ 9 giờ -> từ 10:00)', r.filter.time_from === '10:00' && r.filter.time_to === '12:00');
r = run({ in_scope: true, date: '2026-11-11', time_from: '06:00', time_to: '09:00' });
ok('hôm nay: cả khung giờ đã qua -> bỏ và hỏi lại', r.filter.time_from === null && r.dropped.includes('time') && decide(r.filter, r.dropped, true).kind === 'ask');
r = run({ in_scope: true, date: '2026-11-12', time_from: '19', time_to: null });
ok('chỉ có giờ bắt đầu -> khung 1 giờ', r.filter.time_from === '19:00' && r.filter.time_to === '20:00');
r = run({ in_scope: true, date: '2026-11-12', time_from: '03:00', time_to: '25:00' });
ok('giờ ngoài khoảng bị bỏ hoặc kẹp về 05:00-23:00', r.filter.time_from === null || (r.filter.time_from === '05:00' && r.filter.time_to === '23:00'));
r = run({ in_scope: true, time_from: '18:00', time_to: '20:00', ward_name: 'Sơn Trà' });
d = decide(r.filter, r.dropped, true);
ok('có giờ mà chưa có ngày -> hỏi ngày', d.kind === 'ask' && d.missing.join() === 'date');

// Phạm vi, thiếu thông tin, vị trí
ok('ngoài phạm vi -> từ chối', decide(EMPTY_FILTER, [], false).kind === 'reject');
d = decide(run({ in_scope: true }).filter, [], true);
ok('"tìm sân cho tôi" -> hỏi ngày và khu vực', d.kind === 'ask' && d.missing.includes('date') && d.missing.includes('ward'));
r = run({ in_scope: true, near_me: true });
ok('"gần tôi" khi chưa bật vị trí -> nhắc bật vị trí', r.filter.near_me === false && decide(r.filter, r.dropped, true).kind === 'ask' && askText(['location'], r.dropped).includes('Dùng vị trí của tôi'));
r = run({ in_scope: true, near_me: true, radius_km: 500 }, { ...ctx, hasLocation: true });
ok('"gần tôi" khi có vị trí: bán kính kẹp về 50 km', r.filter.near_me && r.filter.radius_km === 50 && decide(r.filter, r.dropped, true).kind === 'search');
ok('chỉ có giá cũng tìm được', decide(run({ in_scope: true, max_price: 60000 }).filter, [], true).kind === 'search');

// Rẻ hơn
ok('rẻ hơn khi đã có giá tối đa: giảm 20%, làm tròn 5.000', cheaperMaxPrice(80000, []) === 60000 && cheaperMaxPrice(100000, []) === 80000);
ok('rẻ hơn khi chưa có giá: lấy nửa rẻ hơn của kết quả', cheaperMaxPrice(null, [120000, 50000, 70000, 90000]) === 70000);
ok('rẻ hơn khi chỉ có một kết quả: không giảm được', cheaperMaxPrice(null, [50000]) === null);

// Lời nhắc
const prompt = buildExtractionPrompt({ today: '2026-11-11', currentHour: 9, wards, previous: { ...EMPTY_FILTER, ward_id: 1, ward_name: 'Phường Hải Châu', max_price: 80000 }, history: ['sân ở Hải Châu dưới 80k'] });
ok('lời nhắc có ngày hôm nay, lịch 14 ngày, danh mục phường', prompt.includes('Thứ tư, 2026-11-11') && prompt.includes('2026-11-14 = Thứ bảy') && prompt.includes('Phường Sơn Trà'));
ok('lời nhắc có bộ lọc lượt trước, không lộ mã nội bộ', prompt.includes('"max_price":80000') && prompt.includes('"ward_name":"Phường Hải Châu"') && !prompt.includes('ward_id'));
const venues = [{ name: 'Sân A', address: '1 Lê Lợi', ward: 'Phường Hải Châu', min_price: 60000, court_count: 4, distance_km: null, free_hours: ['18:00', '19:00'], free_courts: null }];
const reply = buildReplyPrompt(r.filter, venues);
ok('lời nhắc bước 2 chỉ chứa dữ liệu sân và yêu cầu không thêm thông tin', reply.system.includes('CHỈ được dùng') && reply.user.includes('"Sân A"'));
ok('câu trả lời mẫu dựng từ dữ liệu', templateReply(venues).includes('Sân A') && templateReply(venues).includes('60.000') && templateReply(venues).includes('18:00, 19:00'));
const none = noResultReply({ ...EMPTY_FILTER, ward_id: 1, ward_name: 'Phường Hải Châu', date: '2026-11-14', time_from: '19:00', time_to: '20:00', max_price: 30000 });
ok('không có kết quả: nói rõ và gợi ý nới điều kiện', none.includes('không có sân nào phù hợp') && none.includes('đổi khung giờ') && none.includes('nâng mức giá'));

// Số sân cần cùng lúc ("sáng mai sân nào còn trống 8 sân để tổ chức giải không?")
r = run({ in_scope: true, date: '2026-11-12', time_from: '05:00', time_to: '11:00', min_courts: 8, near_me: false, cheaper: false });
ok('nhận số sân cần cùng lúc', r.filter.min_courts === 8 && r.dropped.length === 0 && decide(r.filter, r.dropped, true).kind === 'search');
ok('mô tả điều kiện có số sân', describeFilter(r.filter).includes('ít nhất 8 sân trống cùng lúc'));
ok('không có kết quả: gợi ý giảm số sân', noResultReply(r.filter).includes('giảm số sân'));
r = run({ in_scope: true, date: '2026-11-12', min_courts: 1 });
ok('1 sân là mặc định, không lưu', r.filter.min_courts === null && r.dropped.length === 0);
r = run({ in_scope: true, date: '2026-11-12', min_courts: 80 });
ok('số sân vô lý bị bỏ và hỏi lại', r.filter.min_courts === null && r.dropped.includes('courts') && decide(r.filter, r.dropped, true).kind === 'ask' && askText(['courts'], r.dropped).includes('bao nhiêu sân'));
const hrs = ['05:00', '06:00', '07:00'];
const ace = { id: 1, court_count: 6 }; const big = { id: 2, court_count: 10 }; const busy = { id: 3, court_count: 9 };
const perHour = [
  [{ ...ace, free_courts: 6 }, { ...big, free_courts: 10 }, { ...busy, free_courts: 9 }],
  [{ ...ace, free_courts: 6 }, { ...big, free_courts: 8 }, { ...busy, free_courts: 3 }],
  null, // giờ truy vấn lỗi thì bỏ qua
];
let m = mergeFreeHours(hrs, perHour, 8);
ok('cần 8 sân: bỏ cơ sở chỉ có 6 sân con', !m.some((v) => v.id === 1));
ok('cần 8 sân: chỉ giữ giờ còn đủ 8 sân trống', m.find((v) => v.id === 3)?.free_hours.join() === '05:00' && m.find((v) => v.id === 2)?.free_hours.join() === '05:00,06:00');
ok('số sân trống lấy mức thấp nhất trong các giờ giữ lại', m.find((v) => v.id === 2)?.free_courts === 8);
m = mergeFreeHours(hrs, perHour, null);
ok('không nêu số sân: còn 1 sân trống là đủ (như trước)', m.length === 3 && m.find((v) => v.id === 3)?.free_hours.length === 2);
ok('câu trả lời mẫu nêu số sân trống', templateReply([{ name: 'Sân B', address: 'x', ward: 'Phường Hải Châu', min_price: 70000, court_count: 10, distance_km: null, free_hours: ['05:00'], free_courts: 8 }]).includes('còn 8/10 sân trống'));

// Giờ liên tục trên cùng sân con ("cần 8 sân từ 7h đến 9h, đã có người đặt 1 sân lúc 8h")
r = run({ in_scope: true, date: '2026-11-12', time_from: '07:00', time_to: '09:00', min_courts: 8, consecutive_hours: 2 });
ok('nhận giờ liên tục = độ dài khung', r.filter.consecutive_hours === 2 && r.dropped.length === 0 && decide(r.filter, r.dropped, true).kind === 'search');
ok('mô tả điều kiện có giờ liên tục', describeFilter(r.filter).includes('liên tục 2 giờ trên cùng sân'));
r = run({ in_scope: true, date: '2026-11-12', time_from: '07:00', time_to: '09:00', consecutive_hours: 3 });
ok('thời lượng dài hơn khung -> bỏ và hỏi lại', r.filter.consecutive_hours === null && r.dropped.includes('duration') && decide(r.filter, r.dropped, true).kind === 'ask');
r = run({ in_scope: true, ward_name: 'Hải Châu', consecutive_hours: 2 });
ok('cần giờ liên tục mà chưa có ngày, giờ -> hỏi lại', (() => { const x = decide(r.filter, r.dropped, true); return x.kind === 'ask' && x.missing.includes('date') && x.missing.includes('time'); })());
const sl = (states) => states.map((st, i) => ({ start_time: ['07:00', '08:00', '09:00'][i], state: st }));
const courtsOf = (n, booked = {}) => Array.from({ length: n }, (_, i) => ({ name: `Sân ${i + 1}`, slots: sl(booked[i + 1] ?? ['available', 'available', 'available']) }));
const two = ['07:00', '08:00'];
ok('cơ sở 8 sân, 1 sân bị đặt lúc 8h -> không đủ 8 sân suốt 7–9h', findRunWindows(courtsOf(8, { 3: ['available', 'booked', 'available'] }), two, 8, 2).length === 0);
let wins = findRunWindows(courtsOf(10, { 3: ['available', 'booked', 'available'] }), two, 8, 2);
ok('cơ sở 10 sân, 1 sân bị đặt lúc 8h -> vẫn còn 9 sân trống suốt 7–9h', wins.length === 1 && wins[0].start === '07:00' && wins[0].end === '09:00' && wins[0].courts.length === 9 && !wins[0].courts.includes('Sân 3'));
// 9 sân: sân 1 bận lúc 7h, sân 2 bận lúc 8h -> mỗi giờ còn 8 sân nhưng chỉ 7 sân trống cả hai giờ
const nine = courtsOf(9, { 1: ['booked', 'available', 'available'], 2: ['available', 'held', 'available'] });
ok('mỗi giờ đủ 8 sân nhưng không phải cùng 8 sân -> loại', hasConsecutive(['07:00', '08:00'], two, 2) && findRunWindows(nine, two, 8, 2).length === 0);
wins = findRunWindows(courtsOf(4, { 1: ['booked', 'available', 'available'] }), ['07:00', '08:00', '09:00'], 4, 2);
ok('tìm khung 2 giờ trong khung 3 giờ: chỉ 08:00–10:00 đủ 4 sân', wins.length === 1 && wins[0].start === '08:00' && wins[0].end === '10:00');
ok('lọc nhanh theo số đếm: thiếu một giờ giữa thì không liên tục', !hasConsecutive(['07:00', '09:00'], ['07:00', '08:00', '09:00'], 2) && hasConsecutive(['08:00', '09:00'], ['07:00', '08:00', '09:00'], 2));
const limit = slotLimitNote([{ name: 'Sân A', max_slots: 20 }, { name: 'Sân B', max_slots: 30 }], 8, 3);
ok('8 sân × 3 giờ = 24 ô vượt giới hạn 20 ô -> nhắc chia 2 lượt', limit.includes('24 ô') && limit.includes('Sân A cho đặt tối đa 20 ô') && !limit.includes('Sân B') && limit.includes('2 lượt'));
ok('không vượt giới hạn -> không nhắc', slotLimitNote([{ name: 'Sân A', max_slots: 20 }], 8, 2) === '');

// Đọc JSON từ mô hình
ok('đọc JSON thường và JSON bọc trong ```', parseJsonObject('{"a":1}')?.a === 1 && parseJsonObject('```json\n{"a":2}\n```')?.a === 2);
ok('văn bản không phải JSON -> null', parseJsonObject('xin chào') === null && parseJsonObject('[1,2]') === null);

console.log(process.exitCode ? '\nCÓ LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
