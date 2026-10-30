// Môi trường giả lập Supabase để kiểm thử cục bộ:
//   PGlite (PostgreSQL + PostGIS) -> PostgREST thật -> cổng 54321 có /rest/v1, /auth/v1 (giả lập), /storage/v1 (giả lập)
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import http from 'http';
import { spawn } from 'child_process';
import crypto from 'crypto';

const SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
import path from 'path';
import { fileURLToPath } from 'url';
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Đường dẫn tệp chạy PostgREST (tải từ https://github.com/PostgREST/postgrest/releases)
const POSTGREST = process.env.POSTGREST_BIN ?? './postgrest';
const db = new PGlite({ extensions: { postgis } });
await db.exec(`
create schema auth; create schema storage;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, password text, raw_user_meta_data jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select, insert, delete on storage.objects to anon, authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema auth, storage to anon, authenticated;
`);
await db.exec(fs.readFileSync(`${APP}/supabase/migrations/0001_init.sql`, 'utf8'));
await db.exec(fs.readFileSync(`${APP}/supabase/seed.sql`, 'utf8'));
for (const f of ['0002_bookings.sql', '0004_venue_rules.sql', '0005_admin_stats_ai.sql', '0006_notifications.sql', '0007_overdue_awaiting.sql', '0008_performance.sql', '0009_security.sql', '0010_payment_qr.sql']) await db.exec(fs.readFileSync(`${APP}/supabase/migrations/${f}`, 'utf8'));
await db.exec(`
-- Các hàm chỉ dùng cho môi trường kiểm thử; gọi qua PostgREST để mọi truy vấn đi chung một hàng đợi
create function public.__test_signup(p_email text, p_password text, p_meta jsonb) returns uuid language plpgsql security definer as $$
declare v uuid; begin insert into auth.users (email, password, raw_user_meta_data) values (p_email, p_password, p_meta) returning id into v; return v; end $$;
create function public.__test_query(q text) returns jsonb language plpgsql security definer as $$
declare r jsonb; begin execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', q) into r; return r; end $$;
create function public.__test_exec(q text) returns void language plpgsql security definer as $$ begin execute q; end $$;
create function public.__test_storage_insert(p_name text) returns void language sql security invoker as $$ insert into storage.objects (bucket_id, name) values ('venue-images', p_name) $$;
revoke execute on function public.__test_signup(text, text, jsonb), public.__test_query(text), public.__test_exec(text) from public, anon, authenticated;
grant execute on function public.__test_signup(text, text, jsonb), public.__test_query(text), public.__test_exec(text) to service_role;
`);
console.log('db ready');
// PGlite gửi ReadyForQuery ngay sau ErrorResponse của giao thức mở rộng, trước khi nhận Sync.
// PostgREST coi đó là lỗi giao thức và ngắt kết nối. Bỏ ReadyForQuery thừa đó (chỉ Sync và Query mới được trả ReadyForQuery).
{
  const orig = db.execProtocolRawStream.bind(db);
  const EXTENDED = new Set(['P', 'B', 'D', 'E', 'C', 'H', 'F']);
  db.execProtocolRawStream = async (message, opts) => {
    if (!EXTENDED.has(String.fromCharCode(message[0]))) return orig(message, opts);
    const chunks = [];
    const result = await orig(message, { ...opts, onRawData: (d) => chunks.push(Buffer.from(d)) });
    const all = Buffer.concat(chunks); const keep = [];
    for (let off = 0; off + 5 <= all.length;) { const end = off + 1 + all.readUInt32BE(off + 1); if (all[off] !== 0x5a) keep.push(all.subarray(off, end)); off = end; }
    if (keep.length) opts.onRawData(new Uint8Array(Buffer.concat(keep)));
    return result;
  };
}
const pg = new PGLiteSocketServer({ db, port: 5433, host: '127.0.0.1' });
await pg.start();

fs.writeFileSync('postgrest.conf', `db-uri = "postgres://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${SECRET}"
server-port = 3001
db-pool = 1
db-channel-enabled = false
db-prepared-statements = false
`);
const pr = spawn(POSTGREST, ['postgrest.conf'], { stdio: ['ignore', 'inherit', 'inherit'] });
process.on('exit', () => pr.kill());

const SERVICE = jwt.sign({ role: 'service_role' }, SECRET, { noTimestamp: true });
const rpc = async (fn, args, token = SERVICE) => {
  const r = await fetch('http://127.0.0.1:3001/rpc/' + fn, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(args) });
  const text = await r.text();
  if (!r.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
};
const users = new Map(); // email -> người dùng (giả lập dịch vụ Auth)
const byId = (id) => [...users.values()].find((u) => u.id === id);
const sign = (u) => jwt.sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, session_id: crypto.randomUUID() }, SECRET, { expiresIn: 3600 });
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.created_at, user_metadata: u.raw_user_meta_data, app_metadata: { provider: 'email' }, identities: [{ id: u.id, provider: 'email' }], created_at: u.created_at });
const session = (u) => ({ access_token: sign(u), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-' + u.id, user: userJson(u) });
const body = (req) => new Promise((res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const bearer = (req) => { try { return jwt.verify((req.headers.authorization || '').replace(/^Bearer /, ''), SECRET); } catch { return null; } };
const files = new Map();
const gemini = { mode: 'ok', script: {}, requests: [] };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', '*'); res.setHeader('access-control-allow-methods', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    if (url.pathname.startsWith('/rest/v1')) {
      const data = await body(req);
      const headers = { ...req.headers }; delete headers.host; delete headers['content-length'];
      const r = await fetch('http://127.0.0.1:3001' + req.url.replace('/rest/v1', ''), { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : data });
      const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) h[k] = v; });
      res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    if (url.pathname === '/auth/v1/signup') {
      const b = JSON.parse((await body(req)).toString() || '{}');
      if (users.has(b.email)) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      const id = await rpc('__test_signup', { p_email: b.email, p_password: b.password, p_meta: b.data || {} });
      const u = { id, email: b.email, password: b.password, raw_user_meta_data: b.data || {}, created_at: new Date().toISOString() };
      users.set(b.email, u);
      return send(res, 200, session(u));
    }
    if (url.pathname === '/auth/v1/token') {
      const b = JSON.parse((await body(req)).toString() || '{}');
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const u = byId(String(b.refresh_token).slice(2));
        return u ? send(res, 200, session(u)) : send(res, 400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      }
      const u = users.get(b.email);
      // Tài khoản đã bị xóa trong cơ sở dữ liệu (delete_my_account) thì không đăng nhập được nữa
      if (u && (await rpc('__test_query', { q: `select 1 from auth.users where id = '${u.id}'` })).length === 0) { users.delete(b.email); return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }); }
      return u && u.password === b.password ? send(res, 200, session(u)) : send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (url.pathname === '/auth/v1/user') {
      const c = bearer(req); const u = c?.sub ? byId(c.sub) : null;
      if (!u) return send(res, 401, { code: 401, error_code: 'no_authorization', msg: 'invalid JWT' });
      if (req.method === 'PUT') { const b = JSON.parse((await body(req)).toString() || '{}'); if (b.password) u.password = b.password; }
      return send(res, 200, userJson(u));
    }
    if (url.pathname === '/auth/v1/logout') { res.writeHead(204); return res.end(); }
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      const f = files.get(url.pathname.replace('/storage/v1/object/public/venue-images/', ''));
      if (!f) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': f.type }); return res.end(f.data);
    }
    if (url.pathname.startsWith('/storage/v1/object/venue-images')) {
      if (req.method === 'DELETE') { const b = JSON.parse((await body(req)).toString() || '{}'); for (const p of b.prefixes || []) files.delete(p); return send(res, 200, []); }
      const name = decodeURIComponent(url.pathname.replace('/storage/v1/object/venue-images/', ''));
      const data = await body(req);
      // áp dụng chính sách storage.objects bằng quyền của người gọi
      try { await rpc('__test_storage_insert', { p_name: name }, (req.headers.authorization || '').replace(/^Bearer /, '')); }
      catch (e) { return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: e.message }); }
      // multipart: lấy phần tệp thô (đủ cho kiểm thử)
      files.set(name, { type: 'image/jpeg', data });
      return send(res, 200, { Key: 'venue-images/' + name, Id: crypto.randomUUID() });
    }
    // ---- Gemini giả lập: trả lời theo kịch bản do bài kiểm thử nạp vào, ghi lại mọi yêu cầu nhận được
    if (url.pathname === '/__gemini') {
      if (req.method === 'GET') return send(res, 200, { requests: gemini.requests });
      const b = JSON.parse((await body(req)).toString() || '{}');
      if (b.reset) { gemini.requests = []; gemini.script = {}; gemini.mode = 'ok'; }
      if (b.mode) gemini.mode = b.mode;
      if (b.script) Object.assign(gemini.script, b.script);
      return send(res, 200, { mode: gemini.mode });
    }
    if (url.pathname.startsWith('/gemini/v1beta/models/') && url.pathname.endsWith(':generateContent')) {
      const b = JSON.parse((await body(req)).toString() || '{}');
      gemini.requests.push(b);
      if (req.headers['x-goog-api-key'] !== 'test-key') return send(res, 403, { error: { code: 403, message: 'API key not valid' } });
      if (gemini.mode === 'error') return send(res, 500, { error: { code: 500, message: 'internal' } });
      if (gemini.mode === 'quota') return send(res, 429, { error: { code: 429, message: 'RESOURCE_EXHAUSTED' } });
      if (gemini.mode === 'timeout') return; // không trả lời: ứng dụng tự hết thời gian chờ
      const question = b.contents?.[0]?.parts?.[0]?.text ?? '';
      let text;
      if (gemini.mode === 'badjson') text = 'Xin lỗi, tôi không hiểu';
      else if (b.generationConfig?.responseSchema) text = JSON.stringify(gemini.script[question] ?? { in_scope: true, near_me: false, cheaper: false });
      else {
        const m = /DỮ LIỆU SÂN \(JSON\): (.*)$/s.exec(question);
        const list = m ? JSON.parse(m[1]) : [];
        text = `Mình tìm được ${list.length} sân: ${list.map((v) => v.name).join(', ')}. (câu trả lời của Gemini giả lập)`;
      }
      return send(res, 200, { candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] });
    }
    if (url.pathname === '/__sql') { // chỉ dùng trong kiểm thử: chạy SQL với quyền quản trị
      const q = (await body(req)).toString();
      if (/^\s*select/i.test(q)) return send(res, 200, await rpc('__test_query', { q }));
      await rpc('__test_exec', { q }); return send(res, 200, []);
    }
    send(res, 404, { msg: 'not mocked: ' + url.pathname });
  } catch (e) { console.log('gateway error', req.method, req.url, e.message); send(res, 500, { msg: e.message }); }
}).listen(54321, () => console.log('fake supabase on :54321'));
console.log('ANON_KEY=' + jwt.sign({ role: 'anon' }, SECRET, { noTimestamp: true }));
