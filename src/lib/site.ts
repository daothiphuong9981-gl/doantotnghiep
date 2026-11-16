/**
 * Thông tin chung của website (footer, trang Liên hệ, sitemap). Đọc lúc build/render ở máy chủ.
 * CONTACT_EMAIL / CONTACT_PHONE đặt trên Vercel nếu muốn khác; không có thì dùng Gmail hệ thống gửi thư (SMTP_USER).
 */
export const SITE_NAME = "Cầu Lông Đà Nẵng";

export function siteUrl(): string {
  const fixed = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return (fixed || "http://localhost:3000").replace(/\/+$/, "");
}

export function contactInfo(): { email: string | null; phone: string | null } {
  return {
    email: process.env.CONTACT_EMAIL || process.env.SMTP_USER || null,
    phone: process.env.CONTACT_PHONE || null,
  };
}
