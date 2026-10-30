// Kiểm thử bộ tạo mã VietQR (src/lib/vietqr.ts) và danh mục ngân hàng. Cần Node 22.18 trở lên (chạy trực tiếp tệp .ts).
import { canMakeVietQr, cleanTransferContent, crc16, vietQrPayload } from '../src/lib/vietqr.ts';
import { BANKS, bankByBin } from '../src/lib/banks.ts';

let passed = 0;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, cond ? '' : extra); if (cond) passed += 1; else process.exitCode = 1; };

ok('CRC-16/CCITT-FALSE của "123456789" = 29B1 (giá trị kiểm chuẩn)', crc16('123456789') === '29B1');

// Mẫu đối chiếu: giải mã ảnh do img.vietqr.io tạo cho BIDV 12345678901, 150.000 đ, nội dung DS1023 (30/10/2026)
const reference = '00020101021238550010A000000727012500069704180111123456789010208QRIBFTTA530370454061500005802VN62100806DS102363043EB5';
const mine = vietQrPayload({ bin: '970418', accountNumber: '12345678901', amount: 150000, content: 'DS1023' });
ok('trùng khớp từng ký tự với mã do VietQR tạo', mine === reference, mine);

const p = vietQrPayload({ bin: '970436', accountNumber: '0011004455667', amount: 240000, content: 'DS2001' });
ok('có số tiền (trường 54)', p.includes('5406240000'));
ok('có nội dung chuyển khoản (trường 62.08)', p.includes('62100806DS2001'));
ok('mã động 01=12, tiền tệ VND, quốc gia VN', p.startsWith('000201010212') && p.includes('5303704') && p.includes('5802VN'));
ok('CRC cuối chuỗi đúng', p.slice(-4) === crc16(p.slice(0, -4)));

ok('nội dung bỏ dấu, ký tự lạ, tối đa 25 ký tự', cleanTransferContent('Đặt sân #DS1023 – Nguyễn Văn Anh rất dài') === 'Dat san DS1023 Nguyen Van');
ok('không đủ điều kiện: thiếu BIN', !canMakeVietQr({ accountNumber: '0123456789', amount: 1000, content: 'x' }));
ok('không đủ điều kiện: số tài khoản có chữ hoặc là "-" (tài khoản đã xóa)', !canMakeVietQr({ bin: '970418', accountNumber: '-', amount: 1000, content: 'x' }));
ok('không đủ điều kiện: số tiền 0 hoặc lẻ', !canMakeVietQr({ bin: '970418', accountNumber: '0123456789', amount: 0, content: 'x' }) && !canMakeVietQr({ bin: '970418', accountNumber: '0123456789', amount: 10.5, content: 'x' }));
let threw = false;
try { vietQrPayload({ bin: 'abc', accountNumber: '1', amount: 1, content: '' }); } catch { threw = true; }
ok('dữ liệu sai thì báo lỗi, không tạo mã', threw);

ok('danh mục ngân hàng: BIN 6 số, không trùng', BANKS.every((b) => /^\d{6}$/.test(b.bin)) && new Set(BANKS.map((b) => b.bin)).size === BANKS.length);
ok('tra cứu BIN', bankByBin('970436')?.short === 'Vietcombank' && bankByBin('000000') === null && bankByBin(null) === null);

console.log(process.exitCode ? '\nCÓ KIỂM TRA LỖI' : `\nTẤT CẢ ĐẠT (${passed} kiểm tra)`);
