import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * GET /api/session - Họ tên và vai trò của người đang đăng nhập cho thanh điều hướng (navbar-session.tsx).
 * null nếu là khách hoặc tài khoản bị khóa (giống getSession). Dữ liệu riêng của từng người: KHÔNG lưu đệm ở đâu cả.
 * Route Handler ghi được cookie nên token hết hạn được làm mới ngay tại đây (proxy không chạy cho /api).
 */
export async function GET() {
  const session = await getSession();
  const data = { session: session ? { full_name: session.profile.full_name, role: session.profile.role } : null };
  return NextResponse.json(
    { statusCode: 200, message: "Thành công", data },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
