// PB23 - Chạy bộ 20 câu hỏi mẫu với Gemini thật và so với đáp án đã soạn (yêu cầu đạt ít nhất 16/20).
// Cách chạy (Node 22.18 trở lên):  GEMINI_API_KEY=<khóa> npm run test:ai
// Mỗi câu gọi Gemini một lần; có khoảng nghỉ giữa các câu để không vượt giới hạn số yêu cầu mỗi phút.
import fs from 'fs';
import { buildExtractionPrompt, decide, EMPTY_FILTER, EXTRACTION_SCHEMA, matchWard, sanitizeFilter } from '../../src/lib/ai/filter.ts';
import { callGemini, DEFAULT_MODEL, parseJsonObject } from '../../src/lib/ai/gemini.ts';

if (!process.env.GEMINI_API_KEY) { console.error('Thiếu GEMINI_API_KEY. Ví dụ: GEMINI_API_KEY=... npm run test:ai'); process.exit(2); }
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const wards = [...read('../../supabase/seed.sql').matchAll(/\((\d+),\s*'([^']+)',\s*'(?:phuong|xa|dac_khu)'\)/g)].map((m) => ({ id: Number(m[1]), name: m[2] }));
const questions = JSON.parse(read('./questions.json'));
const vn = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offset * 86400000));
const today = vn();
const currentHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hour12: false }).format(new Date()));
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const next = (target) => { for (let i = 0; i < 7; i += 1) if (dow(vn(i)) === target) return vn(i); };
const resolveDate = (key) => ({ today, tomorrow: vn(1), sat: next(6), sun: next(0), fri: next(5) })[key] ?? key;
const toFilter = (e) => {
  if (!e) return null;
  const ward = e.ward ? matchWard(e.ward, wards) : null;
  return { ...EMPTY_FILTER, ward_id: ward?.id ?? null, ward_name: ward?.name ?? null, date: e.date ? resolveDate(e.date) : null, time_from: e.time_from ?? null, time_to: e.time_to ?? null, max_price: e.max_price ?? null, min_price: e.min_price ?? null };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
console.log(`Mô hình: ${process.env.GEMINI_MODEL || DEFAULT_MODEL}; hôm nay ${today}, ${currentHour} giờ\n`);
for (const [i, item] of questions.entries()) {
  const result = await callGemini({ system: buildExtractionPrompt({ today, currentHour, wards, previous: toFilter(item.previous), history: [] }), user: item.q, schema: EXTRACTION_SCHEMA });
  const raw = result.ok ? parseJsonObject(result.text) : null;
  let ok = false; let detail = result.ok ? '' : `Gemini lỗi: ${result.reason} ${result.status ?? ''}`;
  if (raw) {
    const { filter, dropped, cheaper, inScope } = sanitizeFilter(raw, { today, currentHour, wards, hasLocation: Boolean(item.location) });
    const decision = decide(filter, dropped, inScope).kind;
    const wrong = [];
    if (item.decision) { if (decision !== item.decision) wrong.push(`quyết định ${decision}, đáp án ${item.decision}`); }
    else {
      if (decision !== 'search') wrong.push(`quyết định ${decision}, đáp án search`);
      const e = item.expect;
      const check = (label, got, want) => { if (want !== undefined && got !== want) wrong.push(`${label}: ${got}, đáp án ${want}`); };
      check('phường', filter.ward_name, e.ward);
      check('ngày', filter.date, e.date ? resolveDate(e.date) : undefined);
      check('giờ từ', filter.time_from, e.time_from);
      check('giờ đến', filter.time_to, e.time_to);
      check('giá tối đa', filter.max_price, e.max_price);
      check('giá tối thiểu', filter.min_price, e.min_price);
      check('gần tôi', filter.near_me, e.near_me);
      check('bán kính', filter.radius_km, e.radius_km);
      check('rẻ hơn', cheaper, e.cheaper);
      if (e.keyword && !(filter.keyword ?? '').toLowerCase().includes(e.keyword.toLowerCase())) wrong.push(`từ khóa: ${filter.keyword}, đáp án chứa "${e.keyword}"`);
      // Điều kiện không có trong đáp án thì không được tự thêm
      for (const key of ['ward_name', 'date', 'max_price', 'min_price']) {
        const expected = { ward_name: e.ward, date: e.date, max_price: e.max_price, min_price: e.min_price }[key];
        if (expected === undefined && filter[key] !== null && !(key === 'max_price' && e.cheaper)) wrong.push(`tự thêm ${key} = ${filter[key]}`);
      }
    }
    ok = wrong.length === 0; detail = wrong.join('; ');
  }
  if (ok) pass += 1;
  console.log(`${String(i + 1).padStart(2)}. ${ok ? 'ĐẠT ' : 'SAI '} ${item.q}${detail ? `\n      -> ${detail}` : ''}`);
  await sleep(Number(process.env.AI_EVAL_DELAY_MS ?? 4500));
}
console.log(`\nKết quả: ${pass}/${questions.length} câu đúng (yêu cầu của PB23: ít nhất 16/20).`);
process.exit(pass >= 16 ? 0 : 1);
