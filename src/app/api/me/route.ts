import { readJson, respond } from "@/lib/api";
import { ACCOUNT_TAGS, CACHE_TAG, expireTagsInRoute } from "@/lib/cache-tags";
import { deleteMe, getMe, updateMe } from "@/lib/services/profile";

/** GET /api/me - Hồ sơ của người đang đăng nhập. */
export async function GET() {
  return respond(await getMe());
}

/** PUT /api/me - Cập nhật họ tên, số điện thoại. */
export async function PUT(request: Request) {
  const result = await updateMe(await readJson(request));
  // Họ tên hiện trong đánh giá công khai (khi không ẩn tên): xóa trang đánh giá đang lưu đệm
  if (result.ok) expireTagsInRoute([CACHE_TAG.reviews]);
  return respond(result.ok ? { ok: true, data: { user: result.data } } : result);
}

/** DELETE /api/me - Xóa tài khoản của chính mình. Thân yêu cầu: { password }. */
export async function DELETE(request: Request) {
  const result = await deleteMe(await readJson(request));
  // Tên trong đánh giá, sân và số điện thoại của chủ sân không được còn trong dữ liệu công khai đang lưu đệm
  if (result.ok) expireTagsInRoute(ACCOUNT_TAGS);
  return respond(result);
}
