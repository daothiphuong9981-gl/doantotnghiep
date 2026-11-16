// Kiểm thử safeNext (src/lib/safe-next.ts): chỉ cho chuyển hướng tới đường dẫn nội bộ sau đăng nhập / mở liên kết thư.
import { safeNext } from '../src/lib/safe-next.ts';

let passed = 0;
const ok = (label, cond, extra = '') => { console.log(cond ? 'ok  ' : 'FAIL', label, cond ? '' : extra); if (cond) passed += 1; else process.exitCode = 1; };

for (const good of ['/', '/bookings', '/bookings/12?tab=1', '/venues/3#reviews', '/reset-password', '/owner/bookings?status=cancelled']) {
  ok(`cho phép ${good}`, safeNext(good) === good, String(safeNext(good)));
}
for (const bad of ['//evil.com', '/\\evil.com', '/\\/evil.com', '\\\\evil.com', '/a\\b', 'https://evil.com', 'evil.com', '/\tevil', '/\n/evil.com', '/%0d', '', null, undefined, '/' + 'a'.repeat(600), 'javascript:alert(1)']) {
  const r = safeNext(bad);
  // '/%0d' là chuỗi đã mã hóa, vẫn là đường dẫn nội bộ hợp lệ
  if (bad === '/%0d') ok('chuỗi mã hóa %0d vẫn nội bộ', r === '/%0d', String(r));
  else ok(`chặn ${JSON.stringify(bad)?.slice(0, 30)}`, r === null, String(r));
}

console.log(`\n${passed} kiểm thử đạt`);
