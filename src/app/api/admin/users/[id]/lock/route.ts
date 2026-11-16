import { readJson, respond } from "@/lib/api";
import { setUserLock } from "@/lib/services/admin";

/** PUT /api/admin/users/{id}/lock - { is_locked: boolean, reason?: string } (khóa bắt buộc có reason) */
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/users/[id]/lock">) {
  const { id } = await ctx.params;
  return respond(await setUserLock(id, await readJson(request)));
}
