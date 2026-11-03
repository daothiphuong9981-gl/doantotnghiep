"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { homeOf } from "@/lib/auth";
import { ACCOUNT_TAGS, CACHE_TAG, expireTagsInAction } from "@/lib/cache-tags";
import { changePassword, login, logout, register } from "@/lib/services/auth";
import { deleteMe, updateMe } from "@/lib/services/profile";

export interface FormState {
  error?: string;
  success?: string;
  values?: Record<string, string>;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Chỉ cho chuyển hướng tới đường dẫn nội bộ. */
function safeNext(next: string): string | null {
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { full_name: str(form, "full_name"), email: str(form, "email"), phone: str(form, "phone"), role: str(form, "role") };
  const result = await register({ ...values, password: str(form, "password"), consent: form.get("consent") === "on" });
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
  if (!result.ok) return { error: result.message, values: { email } };
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
  const result = await changePassword({ current_password: str(form, "current_password"), new_password: str(form, "new_password") });
  if (!result.ok) return { error: result.message };
  return { success: "Đã đổi mật khẩu." };
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
