"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createVenue, replacePrices, setVenueSuspended, updateVenue } from "@/lib/services/owner";
import { createClient } from "@/lib/supabase/server";
import type { PriceSlot } from "@/lib/types";
import { MAX_IMAGES } from "@/lib/validation";

export interface VenueFormState {
  error?: string;
  success?: string;
  errors?: Record<string, string>;
  /** Giá trị người dùng vừa nhập, để điền lại form khi có lỗi */
  values?: Record<string, string>;
}

/** PB06, PB07 - Lưu sân (tạo mới khi không có id). */
export async function saveVenueAction(_prev: VenueFormState, form: FormData): Promise<VenueFormState> {
  const input = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  const id = Number(form.get("id") ?? 0);
  const result = id ? await updateVenue(id, input) : await createVenue(input);
  if (!result.ok) return { error: result.message, errors: result.errors, values: input };
  revalidatePath("/owner/venues");
  revalidatePath("/");
  if (!id) redirect(`/owner/venues/${result.data.id}?created=1`);
  return { success: result.data.status === "pending" ? "Đã lưu. Sân đang chờ quản trị viên duyệt." : "Đã lưu thông tin sân." };
}

/** PB07 - Tạm ngừng hoặc mở lại sân. */
export async function toggleSuspendAction(form: FormData) {
  await setVenueSuspended(Number(form.get("id")), form.get("suspend") === "1");
  revalidatePath("/owner/venues");
  revalidatePath("/");
}

/** PB08 - Lưu bảng giá. */
export async function savePricesAction(venueId: number, prices: PriceSlot[]): Promise<{ error?: string; success?: string }> {
  const result = await replacePrices(venueId, prices);
  if (!result.ok) return { error: result.message };
  revalidatePath(`/owner/venues/${venueId}`);
  revalidatePath(`/venues/${venueId}`);
  return { success: "Đã lưu bảng giá." };
}

/** PB08 - Ghi nhận ảnh vừa tải lên Storage vào bảng venue_images. */
export async function addImageAction(venueId: number, storagePath: string): Promise<{ error?: string }> {
  if (!storagePath.startsWith(`${venueId}/`)) return { error: "Đường dẫn ảnh không hợp lệ" };
  const supabase = await createClient();
  const { count } = await supabase.from("venue_images").select("id", { count: "exact", head: true }).eq("venue_id", venueId);
  if ((count ?? 0) >= MAX_IMAGES) {
    await supabase.storage.from("venue-images").remove([storagePath]);
    return { error: `Mỗi sân tối đa ${MAX_IMAGES} ảnh` };
  }
  const { error } = await supabase.from("venue_images").insert({ venue_id: venueId, storage_path: storagePath, sort_order: count ?? 0 });
  if (error) {
    await supabase.storage.from("venue-images").remove([storagePath]);
    return { error: "Không lưu được ảnh" };
  }
  revalidatePath(`/owner/venues/${venueId}`);
  revalidatePath(`/venues/${venueId}`);
  return {};
}

export async function removeImageAction(venueId: number, imageId: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("venue_images").delete().eq("id", imageId).eq("venue_id", venueId).select("storage_path").maybeSingle();
  if (!data) return { error: "Không xóa được ảnh" };
  await supabase.storage.from("venue-images").remove([data.storage_path]);
  revalidatePath(`/owner/venues/${venueId}`);
  revalidatePath(`/venues/${venueId}`);
  return {};
}
