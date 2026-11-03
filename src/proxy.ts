import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Các đường dẫn bắt buộc đăng nhập. Kiểm tra vai trò chi tiết nằm ở layout của từng khu vực
// và ở Row Level Security; ở đây chỉ chuyển hướng sớm khi chưa đăng nhập.
const PROTECTED_PREFIXES = ["/account", "/owner", "/admin", "/bookings"];

function toLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  // Khách (không có cookie phiên sb-...): không cần tạo client hay xác minh gì, chỉ chuyển hướng nếu là trang cần đăng nhập
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    return isProtected ? toLogin(request) : response;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Làm mới phiên đăng nhập nếu sắp hết hạn. getClaims xác minh JWT ngay tại đây (khóa ES256 đã lưu đệm),
  // không gọi Supabase Auth qua mạng ở mỗi request như getUser.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  if (!user && isProtected) return toLogin(request);
  return response;
}

export const config = {
  // Không chạy proxy cho:
  // - /api/*: Route Handler tự tạo Supabase client ghi được cookie nên tự làm mới phiên; quyền kiểm tra ở service + RLS.
  // - tệp tĩnh (_next/static, _next/image, /vendor, ảnh, .js/.mjs/.css/.map/.txt/.xml/.ico/.woff2), robots.txt, sitemap.
  // Vẫn chạy cho trang và yêu cầu prefetch (?_rsc=) của trang: Server Component không ghi được cookie, nếu bỏ proxy ở
  // prefetch thì token hết hạn được làm mới mà không lưu lại -> refresh token bị dùng lại, Supabase có thể thu hồi phiên.
  // Server Action là POST vào đường dẫn trang nên vẫn khớp.
  matcher: [
    "/((?!api/|_next/static|_next/image|vendor/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|js|css|map|txt|xml|woff2?)$).*)",
  ],
};
