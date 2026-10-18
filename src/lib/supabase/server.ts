import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Tạo Supabase client dùng ở phía máy chủ (Server Component, Server Action, Route Handler).
 * Phiên đăng nhập được lưu trong cookie nên mọi truy vấn đều chạy với quyền của người dùng
 * hiện tại và chịu sự kiểm soát của Row Level Security.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Gọi từ Server Component thì không ghi được cookie; proxy.ts sẽ làm mới phiên.
        }
      },
    },
  });
}
