import { readJson, respond } from "@/lib/api";
import { expireTagsInRoute, venueTags } from "@/lib/cache-tags";
import { reviewVenue } from "@/lib/services/admin";

/** PUT /api/admin/venues/{id}/review - { action: "approve" | "reject" | "hide" | "unhide", reason? } */
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/venues/[id]/review">) {
  const { id } = await ctx.params;
  const result = await reviewVenue(Number(id), await readJson(request));
  // Duyệt/ẩn/hiện sân đổi danh sách công khai và trang chi tiết: xóa ngay dữ liệu đang lưu đệm
  if (result.ok) expireTagsInRoute(venueTags(Number(id)));
  return respond(result);
}
