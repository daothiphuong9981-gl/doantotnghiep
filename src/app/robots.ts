import type { MetadataRoute } from "next";

/**
 * robots.txt tĩnh (tạo lúc build, CDN trả, không đánh thức hàm máy chủ). Không cho bot vào khu vực cần đăng nhập và API.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account", "/bookings", "/owner", "/admin"],
    },
  };
}
