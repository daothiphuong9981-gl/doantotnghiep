import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";
import type { Profile, Role } from "./types";

export interface Session {
  userId: string;
  email: string;
  profile: Profile;
}

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Người đang đăng nhập theo cookie phiên. Dùng getClaims(): dự án Supabase ký JWT bằng khóa bất đối xứng (ES256)
 * nên chữ ký được xác minh ngay trên máy chủ bằng khóa công khai đã lưu đệm, không phải hỏi Supabase Auth qua mạng
 * mỗi lần như getUser(). Tài khoản bị khóa vẫn bị chặn nhờ cột profiles.is_locked và Row Level Security.
 * React cache: navbar, layout, trang và service trong cùng một request dùng chung một kết quả.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

/** Người đang đăng nhập kèm hồ sơ; null nếu là khách hoặc tài khoản bị khóa. Chỉ truy vấn một lần mỗi request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, is_locked")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.is_locked) return null;
  return { userId: user.id, email: user.email, profile: profile as Profile };
});

/** Trang mặc định của từng vai trò sau khi đăng nhập. */
export function homeOf(role: Role): string {
  if (role === "owner") return "/owner/venues";
  if (role === "admin") return "/admin";
  return "/";
}

/** Dùng ở layout/trang cần vai trò cụ thể: sai vai trò thì chuyển hướng. */
export async function requireRole(role: Role): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.role !== role) redirect(homeOf(session.profile.role));
  return session;
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
