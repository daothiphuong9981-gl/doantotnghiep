import { NextResponse } from "next/server";
import type { Result } from "./types";

/**
 * Giá trị Cache-Control cho route GET công khai. Chỉ dùng ở route KHÔNG đọc cookie, KHÔNG gọi getSession/getAuthUser
 * và chỉ dùng Supabase client ẩn danh (không bao giờ trả Set-Cookie), vì CDN giữ phản hồi theo URL cho mọi người.
 */
export const PUBLIC_CACHE = {
  /** Danh mục phường, xã (gần như không đổi) */
  day: "public, s-maxage=86400, stale-while-revalidate=604800",
  /** Chi tiết sân */
  long: "public, s-maxage=300, stale-while-revalidate=600",
  /** Danh sách sân không lọc theo giờ trống, đánh giá */
  short: "public, s-maxage=60, stale-while-revalidate=300",
  /** Dữ liệu đổi theo phút (giờ trống) hoặc phụ thuộc vị trí người dùng: không lưu ở đâu cả */
  none: "no-store",
} as const;

/**
 * Chuyển kết quả của tầng dịch vụ thành phản hồi JSON theo mẫu chung { statusCode, message, data }.
 * cacheControl chỉ áp dụng cho phản hồi thành công (không để CDN giữ lỗi).
 */
export function respond<T>(result: Result<T>, successStatus = 200, cacheControl?: string) {
  if (result.ok) {
    const headers = cacheControl ? { "Cache-Control": cacheControl } : undefined;
    return NextResponse.json({ statusCode: successStatus, message: "Thành công", data: result.data }, { status: successStatus, headers });
  }
  return NextResponse.json({ statusCode: result.status, message: result.message, data: null }, { status: result.status });
}

/** Đọc thân yêu cầu dạng JSON; trả về {} nếu không hợp lệ. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
