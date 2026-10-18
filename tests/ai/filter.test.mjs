// Kiểm thử phần xử lý thuần của trợ lý AI (không gọi Gemini). Cần Node 22.18 trở lên (chạy trực tiếp tệp .ts).
import { askText, buildExtractionPrompt, buildReplyPrompt, cheaperMaxPrice, decide, EMPTY_FILTER, hoursOf, matchWard, noResultReply, sanitizeFilter, templateReply } from '../../src/lib/ai/filter.ts';
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
const venues = [{ name: 'Sân A', address: '1 Lê Lợi', ward: 'Phường Hải Châu', min_price: 60000, court_count: 4, distance_km: null, free_hours: ['18:00', '19:00'] }];
const reply = buildReplyPrompt(r.filter, venues);
ok('lời nhắc bước 2 chỉ chứa dữ liệu sân và yêu cầu không thêm thông tin', reply.system.includes('CHỈ được dùng') && reply.user.includes('"Sân A"'));
ok('câu trả lời mẫu dựng từ dữ liệu', templateReply(venues).includes('Sân A') && templateReply(venues).includes('60.000') && templateReply(venues).includes('18:00, 19:00'));
const none = noResultReply({ ...EMPTY_FILTER, ward_id: 1, ward_name: 'Phường Hải Châu', date: '2026-11-14', time_from: '19:00', time_to: '20:00', max_price: 30000 });
ok('không có kết quả: nói rõ và gợi ý nới điều kiện', none.includes('không có sân nào phù hợp') && none.includes('đổi khung giờ') && none.includes('nâng mức giá'));

// Đọc JSON từ mô hình
ok('đọc JSON thường và JSON bọc trong ```', parseJsonObject('{"a":1}')?.a === 1 && parseJsonObject('```json\n{"a":2}\n```')?.a === 2);
ok('văn bản không phải JSON -> null', parseJsonObject('xin chào') === null && parseJsonObject('[1,2]') === null);

console.log(process.exitCode ? '\nCÓ LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
