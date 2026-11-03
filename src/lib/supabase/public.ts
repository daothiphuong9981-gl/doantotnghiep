import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

/**
 * Supabase client ẩn danh (vai trò anon) cho dữ liệu CÔNG KHAI: không đọc cookie, không giữ phiên, không bao giờ
 * ghi Set-Cookie. Dùng được trong unstable_cache và trong route GET có header CDN. Kết quả giống hệt client có cookie
 * với sân đã duyệt vì RLS cho anon đọc sân approved và các hàm search_venues, venue_rating_summary,
 * list_venue_reviews, venue_taken_slots là security definer không dùng auth.uid().
 */
export function publicClient(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
