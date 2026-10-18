import { readJson, respond } from "@/lib/api";
import { deleteMe, getMe, updateMe } from "@/lib/services/profile";

/** GET /api/me - Hồ sơ của người đang đăng nhập. */
export async function GET() {
  return respond(await getMe());
}

/** PUT /api/me - Cập nhật họ tên, số điện thoại. */
export async function PUT(request: Request) {
  const result = await updateMe(await readJson(request));
  return respond(result.ok ? { ok: true, data: { user: result.data } } : result);
}

/** DELETE /api/me - Xóa tài khoản của chính mình. Thân yêu cầu: { password }. */
export async function DELETE(request: Request) {
  return respond(await deleteMe(await readJson(request)));
}
