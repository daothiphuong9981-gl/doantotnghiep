import { readJson, respond } from "@/lib/api";
import { setReviewStatus } from "@/lib/services/reviews";

/** PUT /api/admin/reviews/{id}/status - { status: "hidden" | "visible", reason? } ẩn (bắt buộc lý do) hoặc hiện lại. */
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/reviews/[id]/status">) {
  const { id } = await ctx.params;
  return respond(await setReviewStatus(Number(id), await readJson(request)));
}
