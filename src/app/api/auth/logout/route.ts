import { respond } from "@/lib/api";
import { logout } from "@/lib/services/auth";

/** POST /api/auth/logout - Đăng xuất. */
export async function POST() {
  return respond(await logout());
}
