export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const IMAGE_BUCKET = "venue-images";

/** Đã cấu hình Supabase hay chưa (dùng để báo lỗi rõ ràng khi thiếu .env.local). */
export const isSupabaseConfigured = SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 0;

/** Đường dẫn công khai của một tệp ảnh trong Supabase Storage. */
export function imageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${storagePath}`;
}
