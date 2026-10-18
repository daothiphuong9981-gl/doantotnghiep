import { readJson, respond } from "@/lib/api";
import { register } from "@/lib/services/auth";

/** POST /api/auth/register - Đăng ký tài khoản. */
export async function POST(request: Request) {
  return respond(await register(await readJson(request)), 201);
}
