import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { publicClient } from "@/lib/supabase/public";

// Tạo lại tối đa mỗi giờ (sân mới duyệt sẽ có trong sitemap sau ≤ 1 giờ).
export const revalidate = 3600;

/** sitemap.xml: trang công khai và mọi sân đã duyệt. Lỗi đọc sân thì vẫn trả các trang tĩnh. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/assistant`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];
  if (!isSupabaseConfigured) return pages;
  const { data } = await publicClient().from("venues").select("id").eq("status", "approved").order("id").limit(5000);
  return [...pages, ...((data ?? []) as { id: number }[]).map((v) => ({ url: `${base}/venues/${v.id}`, changeFrequency: "weekly" as const, priority: 0.8 }))];
}
