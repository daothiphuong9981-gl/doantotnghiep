import { z } from "zod";
import { bankByBin } from "./banks";
import { BOOKING_RULES } from "./constants";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Số lấy từ form: chuỗi rỗng coi như chưa nhập (không tự đổi thành 0). */
const num = (message: string) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.coerce.number({ error: message }));
const text = (label: string, max = 200) =>
  z.string({ error: `${label} là bắt buộc` }).trim().min(1, `${label} là bắt buộc`).max(max, `${label} quá dài`);

/** Một quy định đặt sân: bỏ trống thì lấy giá trị mặc định, có nhập thì phải nằm trong khoảng cho phép. */
const rule = (key: keyof typeof BOOKING_RULES, label: string) => {
  const { min, max, default: fallback } = BOOKING_RULES[key];
  const message = `${label} từ ${min} đến ${max}`;
  return z.preprocess(
    (value) => (value === undefined || value === null || (typeof value === "string" && value.trim() === "") ? fallback : value),
    z.coerce.number({ error: message }).int(message).min(min, message).max(max, message),
  );
};

export const registerSchema = z.object({
  full_name: text("Họ và tên", 100),
  email: z.string().trim().toLowerCase().pipe(z.email("Email không hợp lệ")),
  phone: z.string().trim().regex(/^0\d{9}$/, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0"),
  password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự"),
  role: z.enum(["player", "owner"], { error: "Hãy chọn vai trò" }),
  consent: z.literal(true, { error: "Bạn cần đồng ý với thông báo xử lý dữ liệu cá nhân" }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email không hợp lệ")),
  password: z.string().min(1, "Hãy nhập mật khẩu"),
});

export const profileSchema = z.object({
  full_name: text("Họ và tên", 100),
  phone: z.string().trim().regex(/^0\d{9}$/, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0"),
});

export const passwordSchema = z.object({
  current_password: z.string().min(1, "Hãy nhập mật khẩu hiện tại"),
  new_password: z.string().min(8, "Mật khẩu mới cần ít nhất 8 ký tự"),
});

export const venueSchema = z
  .object({
    name: text("Tên sân", 120),
    ward_id: num("Hãy chọn phường/xã").pipe(z.number().int().positive("Hãy chọn phường/xã")),
    address: text("Địa chỉ", 250),
    latitude: num("Hãy chọn vị trí trên bản đồ").pipe(z.number().min(-90).max(90)),
    longitude: num("Hãy chọn vị trí trên bản đồ").pipe(z.number().min(-180).max(180)),
    court_count: num("Hãy nhập số sân con").pipe(z.number().int("Số sân con phải là số nguyên").min(1, "Cần ít nhất 1 sân con").max(30, "Tối đa 30 sân con")),
    open_time: z.string().regex(TIME, "Giờ mở cửa không hợp lệ"),
    close_time: z.string().regex(TIME, "Giờ đóng cửa không hợp lệ"),
    hold_minutes: num("Hãy nhập thời gian giữ chỗ").pipe(
      z.number().int("Thời gian giữ chỗ từ 5 đến 60 phút").min(5, "Thời gian giữ chỗ từ 5 đến 60 phút").max(60, "Thời gian giữ chỗ từ 5 đến 60 phút"),
    ),
    max_slots_per_booking: rule("max_slots_per_booking", "Số khung giờ tối đa mỗi lượt"),
    advance_days: rule("advance_days", "Số ngày đặt trước"),
    max_active_holds: rule("max_active_holds", "Số lượt giữ chỗ cùng lúc"),
    // Chọn ngân hàng từ danh mục VietQR: lưu mã BIN để tạo mã QR, tên ngân hàng lấy theo danh mục
    bank_bin: z.string({ error: "Hãy chọn ngân hàng nhận tiền" }).refine((bin) => bankByBin(bin) !== null, "Hãy chọn ngân hàng nhận tiền"),
    bank_account_number: z
      .string()
      .transform((value) => value.replace(/\s/g, ""))
      .pipe(z.string().regex(/^\d{6,19}$/, "Số tài khoản gồm 6 đến 19 chữ số")),
    bank_account_name: text("Chủ tài khoản", 100),
    contact_phone: z.string().trim().max(20).optional().or(z.literal("")),
    description: z.string().trim().max(1000, "Mô tả quá dài").optional().or(z.literal("")),
  })
  .refine((v) => v.close_time > v.open_time, { path: ["close_time"], message: "Giờ đóng cửa phải sau giờ mở cửa" })
  .transform((v) => ({ ...v, bank_name: bankByBin(v.bank_bin)?.short ?? "" }));

export const reviewSchema = z.object({
  rating: z.coerce.number({ error: "Hãy chọn số sao" }).int("Hãy chọn từ 1 đến 5 sao").min(1, "Hãy chọn từ 1 đến 5 sao").max(5, "Hãy chọn từ 1 đến 5 sao"),
  comment: z.string().trim().max(1000, "Bình luận tối đa 1000 ký tự").optional().or(z.literal("")).or(z.null()),
  is_anonymous: z.boolean().optional().default(false),
});

export const replySchema = z.object({
  reply: z.string().trim().max(1000, "Câu trả lời tối đa 1000 ký tự").optional().or(z.literal("")).or(z.null()),
});

export type VenueInput = z.infer<typeof venueSchema>;

export const priceSlotSchema = z
  .object({
    day_type: z.enum(["weekday", "weekend"]),
    start_time: z.string().regex(TIME, "Giờ bắt đầu không hợp lệ"),
    end_time: z.string().regex(TIME, "Giờ kết thúc không hợp lệ"),
    price: num("Giá không hợp lệ").pipe(z.number().int("Giá phải là số nguyên").min(0, "Giá không được âm").max(10_000_000)),
  })
  .refine((v) => v.end_time > v.start_time, { message: "Giờ kết thúc phải sau giờ bắt đầu" });

export const priceListSchema = z.array(priceSlotSchema).min(1, "Cần ít nhất một khung giá").max(40);

export const bookingSchema = z.object({
  venue_id: z.number({ error: "Thiếu mã sân" }).int().positive(),
  items: z
    .array(
      z.object({
        court_id: z.number().int().positive(),
        booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
        start_time: z.string().regex(/^([01]\d|2[0-3]):00$/, "Khung giờ phải bắt đầu đúng giờ"),
      }),
      { error: "Hãy chọn ít nhất một khung giờ" },
    )
    .min(1, "Hãy chọn ít nhất một khung giờ")
    .max(BOOKING_RULES.max_slots_per_booking.max, `Mỗi lượt đặt tối đa ${BOOKING_RULES.max_slots_per_booking.max} khung giờ`),
});

/** Lấy thông báo lỗi đầu tiên của zod cho từng trường. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// Giữ đường import cũ cho mã phía máy chủ; component phía client nên import thẳng từ "@/lib/limits" (không kéo zod).
export { findPriceOverlap, IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from "./limits";
