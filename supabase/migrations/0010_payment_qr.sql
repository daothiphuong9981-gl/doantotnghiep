-- =====================================================================
-- Mã QR thanh toán VietQR. Chạy sau 0009_security.sql.
--
-- 1. venues.bank_bin: mã BIN 6 số của ngân hàng nhận tiền (NAPAS), cần để tạo mã VietQR. Để trống được: sân
--    chưa có BIN vẫn hiện thông tin chuyển khoản dạng chữ như trước, chỉ không có ảnh QR.
--    Cột này cũng KHÔNG cấp quyền đọc trực tiếp (giống các cột bank_* ở 0009).
-- 2. Số tài khoản bỏ khoảng trắng (mã QR chỉ nhận chữ số).
-- 3. Điền sẵn BIN cho sân đã ghi tên ngân hàng thật thường gặp. Không điền cho sân dữ liệu ảo (tên ngân hàng
--    không khớp): tránh tạo QR chuyển tiền tới một tài khoản thật không liên quan.
-- 4. Hai hàm đọc thông tin chuyển khoản trả thêm bank_bin.
-- =====================================================================

alter table public.venues add column if not exists bank_bin text;
alter table public.venues drop constraint if exists venues_bank_bin_check;
alter table public.venues add constraint venues_bank_bin_check check (bank_bin is null or bank_bin ~ '^\d{6}$');

update public.venues
set bank_account_number = regexp_replace(bank_account_number, '\s', '', 'g')
where bank_account_number ~ '\s';

-- Tên ngân hàng chuẩn hóa: bỏ dấu, chữ thường, bỏ tiền tố "ngân hàng", "TMCP", ký tự không phải chữ số
update public.venues v
set bank_bin = m.bin
from (values
  ('970436', 'vietcombank'), ('970436', 'vcb'),
  ('970415', 'vietinbank'), ('970415', 'icb'),
  ('970418', 'bidv'),
  ('970405', 'agribank'),
  ('970407', 'techcombank'), ('970407', 'tcb'),
  ('970422', 'mbbank'), ('970422', 'mb'), ('970422', 'quandoi'),
  ('970416', 'acb'),
  ('970432', 'vpbank'),
  ('970423', 'tpbank'),
  ('970403', 'sacombank'),
  ('970437', 'hdbank'),
  ('970441', 'vib'),
  ('970443', 'shb'),
  ('970431', 'eximbank'),
  ('970426', 'msb'),
  ('970440', 'seabank'),
  ('970448', 'ocb'),
  ('970449', 'lpbank'), ('970449', 'lienvietpostbank')
) as m(bin, alias)
where v.bank_bin is null
  and regexp_replace(regexp_replace(lower(public.vn_unaccent(v.bank_name)), '^(ngan hang|nh)\s*(tmcp)?\s*', ''), '[^a-z0-9]', '', 'g') = m.alias;

-- Hàm trả về kiểu mới nên phải xóa rồi tạo lại (giữ nguyên điều kiện quyền của 0009)
drop function if exists public.booking_payment_info(bigint);
create function public.booking_payment_info(p_booking_id bigint)
returns table (bank_name text, bank_bin text, account_number text, account_name text, amount integer, content text)
language sql
stable
security definer
set search_path = public
as $$
  select v.bank_name, v.bank_bin, v.bank_account_number, v.bank_account_name, b.total_amount, b.code
  from bookings b
  join venues v on v.id = b.venue_id
  where b.id = p_booking_id
    and b.player_id = auth.uid()
    and public.my_role() is not null
    and b.status in ('holding', 'awaiting_confirmation');
$$;

drop function if exists public.venue_bank_info(bigint);
create function public.venue_bank_info(p_venue_id bigint)
returns table (bank_name text, bank_bin text, bank_account_number text, bank_account_name text)
language sql
stable
security definer
set search_path = public
as $$
  select v.bank_name, v.bank_bin, v.bank_account_number, v.bank_account_name
  from venues v
  where v.id = p_venue_id
    and ((v.owner_id = auth.uid() and public.my_role() = 'owner') or public.my_role() = 'admin');
$$;

revoke execute on function public.booking_payment_info(bigint), public.venue_bank_info(bigint) from public, anon;
grant execute on function public.booking_payment_info(bigint), public.venue_bank_info(bigint) to authenticated;
