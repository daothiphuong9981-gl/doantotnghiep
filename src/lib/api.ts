import { NextResponse } from "next/server";
import type { Result } from "./types";

/** Chuyển kết quả của tầng dịch vụ thành phản hồi JSON theo mẫu chung { statusCode, message, data }. */
export function respond<T>(result: Result<T>, successStatus = 200) {
  if (result.ok) {
    return NextResponse.json({ statusCode: successStatus, message: "Thành công", data: result.data }, { status: successStatus });
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
