import { readJson, respond } from "@/lib/api";
import { replyReview } from "@/lib/services/reviews";

/** PUT /api/owner/reviews/{id}/reply - { reply } chủ sân trả lời đánh giá (gửi rỗng để xóa câu trả lời). */
export async function PUT(request: Request, ctx: RouteContext<"/api/owner/reviews/[id]/reply">) {
  const { id } = await ctx.params;
  return respond(await replyReview(Number(id), await readJson(request)));
}
