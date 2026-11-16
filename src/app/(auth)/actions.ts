"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { homeOf } from "@/lib/auth";
import { ACCOUNT_TAGS, CACHE_TAG, expireTagsInAction } from "@/lib/cache-tags";
import { safeNext } from "@/lib/safe-next";
import { changePassword, login, logout, register, requestPasswordReset, resendSignupConfirmation, resetPassword } from "@/lib/services/auth";
import { deleteMe, updateMe } from "@/lib/services/profile";

export interface FormState {
  error?: string;
  /** Đăng nhập: email chưa xác nhận, hiện nút gửi lại thư */
  needsConfirm?: boolean;
  success?: string;
  values?: Record<string, string>;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "");

/**
 * Gốc địa chỉ của trang (https://caulongdanang.vercel.app) để ghép liên kết trong thư. Ưu tiên APP_URL;
 * không có thì lấy từ request. Supabase chỉ chấp nhận địa chỉ nằm trong Redirect URLs nên Host giả không dùng được.
 */
async function siteOrigin(): Promise<string> {
  const fixed = process.env.APP_URL?.replace(/\/+$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { full_name: str(form, "full_name"), email: str(form, "email"), phone: str(form, "phone"), role: str(form, "role") };
  const result = await register({
    ...values,
    password: str(form, "password"),
    password_confirm: str(form, "password_confirm"),
    consent: form.get("consent") === "on",
  });
  if (!result.ok) return { error: result.message, values };
  if (result.data.needsEmailConfirm) {
    return { success: "Đăng ký thành công. Hãy mở email để xác nhận tài khoản rồi đăng nhập." };
  }
  revalidatePath("/", "layout");
  redirect(homeOf(result.data.user.role));
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email");
  const result = await login({ email, password: str(form, "password") });
  if (!result.ok) return { error: result.message, values: { email }, needsConfirm: result.status === 412 };
  revalidatePath("/", "layout");
  redirect(safeNext(str(form, "next")) ?? homeOf(result.data.user.role));
}

export async function logoutAction() {
  await logout();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { full_name: str(form, "full_name"), phone: str(form, "phone") };
  const result = await updateMe(values);
  if (!result.ok) return { error: result.message, values };
  // Họ tên hiện trong đánh giá công khai (khi không ẩn tên): xóa trang đánh giá đang lưu đệm
  expireTagsInAction([CACHE_TAG.reviews]);
  revalidatePath("/", "layout");
  return { success: "Đã lưu thông tin cá nhân.", values };
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await changePassword({
    current_password: str(form, "current_password"),
    new_password: str(form, "new_password"),
    new_password_confirm: str(form, "new_password_confirm"),
  });
  if (!result.ok) return { error: result.message };
  return { success: "Đã đổi mật khẩu." };
}

/** Gửi lại thư xác nhận đăng ký. */
export async function resendConfirmationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email");
  const result = await resendSignupConfirmation({ email }, await siteOrigin());
  if (!result.ok) return { error: result.message };
  return { success: "Đã gửi lại thư xác nhận (nếu email này đang chờ xác nhận). Hãy kiểm tra hộp thư, cả mục Thư rác." };
}

/** Quên mật khẩu: gửi thư có liên kết đặt lại (câu trả lời giống nhau dù email có tài khoản hay không). */
export async function forgotPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email");
  const result = await requestPasswordReset({ email }, await siteOrigin());
  if (!result.ok) return { error: result.message, values: { email } };
  return {
    success: "Nếu email này đã đăng ký, chúng tôi vừa gửi liên kết đặt lại mật khẩu. Hãy mở hộp thư (cả mục Thư rác) và bấm liên kết trong vòng 1 giờ.",
    values: { email },
  };
}

/** Đặt mật khẩu mới từ liên kết trong thư; xong thì về trang Tài khoản kèm thông báo thành công. */
export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await resetPassword({ password: str(form, "password"), password_confirm: str(form, "password_confirm") });
  if (!result.ok) return { error: result.message };
  revalidatePath("/", "layout");
  redirect("/account?password_reset=1");
}

/** PB27 - Xóa tài khoản của chính mình. */
export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (form.get("confirm") !== "on") return { error: "Hãy đánh dấu xác nhận trước khi xóa tài khoản." };
  const result = await deleteMe({ password: str(form, "password") });
  if (!result.ok) return { error: result.message };
  // Tên trong đánh giá, sân và số điện thoại của chủ sân không được còn trong dữ liệu công khai đang lưu đệm
  expireTagsInAction(ACCOUNT_TAGS);
  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}
