import { readJson, respond } from "@/lib/api";
import { login } from "@/lib/services/auth";

/** POST /api/auth/login - Đăng nhập; phiên được lưu trong cookie. */
export async function POST(request: Request) {
  return respond(await login(await readJson(request)));
}
