import { NextResponse, type NextRequest } from "next/server";
import { readJson, respond } from "@/lib/api";
import { createBooking, listMyBookings } from "@/lib/services/bookings";

/** GET /api/bookings?scope=upcoming|past|closed - Lịch sử đặt sân của người chơi đang đăng nhập. */
export async function GET(request: NextRequest) {
  return respond(await listMyBookings(request.nextUrl.searchParams.get("scope") ?? undefined));
}

/** POST /api/bookings - Giữ chỗ: một lượt đặt gồm nhiều sân con, nhiều khung giờ. */
export async function POST(request: Request) {
  const result = await createBooking(await readJson(request));
  if (!result.ok && result.conflicts) {
    // 409: trả kèm danh sách khung giờ xung đột để giao diện đánh dấu
    return NextResponse.json({ statusCode: 409, message: result.message, data: { conflicts: result.conflicts } }, { status: 409 });
  }
  return respond(result, 201);
}
