import { fail, type Result } from "./types";

/** Lỗi trả về từ supabase-js khi một hàm trong cơ sở dữ liệu RAISE EXCEPTION. */
export interface DbError {
  message: string;
  details?: string | null;
}

// Mã lỗi do các hàm trong cơ sở dữ liệu phát ra (xem supabase/migrations) -> mã HTTP
export const DB_ERROR_STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  INVALID_STATE: 409,
  SLOT_TAKEN: 409,
  RATE_LIMITED: 429,
};

/** Đổi lỗi của hàm cơ sở dữ liệu thành kết quả kèm mã HTTP; thông báo lấy từ DETAIL. */
export function dbFail(error: DbError, fallback: string): Result<never> {
  const status = DB_ERROR_STATUS[error.message];
  if (!status) return fail(500, fallback);
  return fail(status, error.details || fallback);
}
