import { readJson, respond } from "@/lib/api";
import { changePassword } from "@/lib/services/auth";

/** PUT /api/auth/password - Đổi mật khẩu. */
export async function PUT(request: Request) {
  return respond(await changePassword(await readJson(request)));
}
