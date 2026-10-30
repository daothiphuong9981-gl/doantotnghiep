/**
 * Tạo nội dung mã VietQR (chuẩn EMVCo QR của NAPAS 247) để ứng dụng ngân hàng quét là điền sẵn người nhận,
 * số tiền và nội dung chuyển khoản. Tự tạo trên máy chủ, không gửi thông tin lượt đặt cho dịch vụ bên ngoài.
 *
 * Cấu trúc: mỗi trường là ID (2 số) + độ dài (2 số) + giá trị.
 *   00 phiên bản "01" · 01 "12" = mã động (có số tiền) · 38 thông tin người nhận NAPAS
 *   (00 GUID A000000727, 01 {00 BIN ngân hàng, 01 số tài khoản}, 02 dịch vụ QRIBFTTA = chuyển nhanh tới tài khoản)
 *   53 tiền tệ 704 (VND) · 54 số tiền · 58 quốc gia VN · 62 {08 nội dung chuyển khoản} · 63 mã kiểm tra CRC16
 */

export interface VietQrInput {
  bin: string;
  accountNumber: string;
  amount: number;
  content: string;
}

const NAPAS_GUID = "A000000727";
const TRANSFER_TO_ACCOUNT = "QRIBFTTA";

function field(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Trường ${id} quá dài`);
  return id + String(value.length).padStart(2, "0") + value;
}

/** CRC-16/CCITT-FALSE (đa thức 0x1021, giá trị đầu 0xFFFF) theo chuẩn EMVCo, trả về 4 ký tự hex in hoa. */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(data)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Nội dung chuyển khoản chỉ gồm chữ không dấu, số, khoảng trắng (nhiều ngân hàng từ chối ký tự khác), tối đa 25 ký tự. */
export function cleanTransferContent(content: string): string {
  return content
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25);
}

/** Đủ điều kiện tạo QR: BIN 6 số, số tài khoản 6-19 chữ số, số tiền nguyên dương. */
export function canMakeVietQr(input: Partial<VietQrInput>): input is VietQrInput {
  return (
    typeof input.bin === "string" &&
    /^\d{6}$/.test(input.bin) &&
    typeof input.accountNumber === "string" &&
    /^\d{6,19}$/.test(input.accountNumber) &&
    Number.isInteger(input.amount) &&
    (input.amount ?? 0) > 0 &&
    (input.amount ?? 0) <= 9_999_999_999
  );
}

export function vietQrPayload(input: VietQrInput): string {
  if (!canMakeVietQr(input)) throw new Error("Thông tin tài khoản không đủ để tạo mã VietQR");
  const content = cleanTransferContent(input.content);
  const beneficiary = field("00", input.bin) + field("01", input.accountNumber);
  const merchant = field("00", NAPAS_GUID) + field("01", beneficiary) + field("02", TRANSFER_TO_ACCOUNT);
  const body =
    field("00", "01") +
    field("01", "12") +
    field("38", merchant) +
    field("53", "704") +
    field("54", String(input.amount)) +
    field("58", "VN") +
    (content ? field("62", field("08", content)) : "") +
    "6304";
  return body + crc16(body);
}
