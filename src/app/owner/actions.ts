"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { expireTagsInAction, venueTags } from "@/lib/cache-tags";
import { createOfflineBooking } from "@/lib/services/bookings";
import { createVenue, deleteVenue, renameCourt, replacePrices, setCourtActive, setVenueSuspended, updateVenue } from "@/lib/services/owner";
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
  // Lỗi ở bước sân con (409) xảy ra sau khi thông tin sân đã lưu: vẫn xóa lưu đệm
  if (!result.ok && id && result.status === 409) expireTagsInAction(venueTags(id));
  if (!result.ok) return { error: result.message, errors: result.errors, values: input };
  // Sân đã có: xóa ngay dữ liệu công khai đang lưu đệm (chi tiết, danh sách) để chủ sân và khách thấy thay đổi
  if (id) expireTagsInAction(venueTags(id));
  revalidatePath("/owner/venues");
  revalidatePath("/");
  if (!id) redirect(`/owner/venues/${result.data.id}?created=1`);
  return { success: result.data.status === "pending" ? "Đã lưu. Sân đang chờ quản trị viên duyệt." : "Đã lưu thông tin sân." };
}

/** PB07 - Tạm ngừng hoặc mở lại sân (nút có hỏi xác nhận ở trình duyệt). */
export async function toggleSuspendAction(id: number, suspend: boolean): Promise<{ error?: string; success?: string }> {
  const result = await setVenueSuspended(id, suspend);
  if (!result.ok) return { error: result.message };
  expireTagsInAction(venueTags(id));
  revalidatePath("/owner/venues");
  revalidatePath("/");
  return { success: suspend ? "Đã tạm ngừng sân. Người chơi không thấy và không đặt được sân này." : "Đã mở lại sân." };
}

/** Xóa hẳn sân chưa từng có lượt đặt. */
export async function deleteVenueAction(id: number): Promise<{ error?: string }> {
  const result = await deleteVenue(id);
  if (!result.ok) return { error: result.message };
  expireTagsInAction(venueTags(id));
  revalidatePath("/owner/venues");
  revalidatePath("/");
  return {};
}

/** Sân con: đổi tên. */
export async function renameCourtAction(venueId: number, courtId: number, name: string): Promise<{ error?: string; success?: string }> {
  const result = await renameCourt(venueId, courtId, name);
  if (!result.ok) return { error: result.message };
  expireTagsInAction(venueTags(venueId));
  revalidatePath(`/owner/venues/${venueId}`);
  return { success: "Đã đổi tên sân con." };
}

/** Sân con: ngừng hoặc mở lại một sân cụ thể. */
export async function setCourtActiveAction(venueId: number, courtId: number, active: boolean): Promise<{ error?: string; success?: string }> {
  const result = await setCourtActive(venueId, courtId, active);
  if (!result.ok) return { error: result.message };
  expireTagsInAction(venueTags(venueId));
  revalidatePath(`/owner/venues/${venueId}`);
  revalidatePath("/owner/venues");
  return { success: active ? "Đã mở lại sân con." : "Đã ngừng sân con. Người chơi không đặt được sân con này nữa." };
}

/** Chủ sân đặt hộ khách vãng lai hoặc khóa khung giờ (không qua thanh toán trên web). */
export async function createOfflineBookingAction(input: {
  venue_id: number;
  kind: "walk_in" | "block";
  items: { court_id: number; booking_date: string; start_time: string }[];
  guest_name?: string;
  guest_phone?: string;
}): Promise<{ error?: string; code?: string }> {
  const result = await createOfflineBooking(input);
  if (!result.ok) return { error: result.message };
  expireTagsInAction(venueTags(input.venue_id));
  revalidatePath("/owner/bookings");
  return { code: result.data.code };
}

/** PB08 - Lưu bảng giá. */
export async function savePricesAction(venueId: number, prices: PriceSlot[]): Promise<{ error?: string; success?: string }> {
  const result = await replacePrices(venueId, prices);
  if (!result.ok) return { error: result.message };
  expireTagsInAction(venueTags(venueId));
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
  expireTagsInAction(venueTags(venueId));
  revalidatePath(`/owner/venues/${venueId}`);
  revalidatePath(`/venues/${venueId}`);
  return {};
}

export async function removeImageAction(venueId: number, imageId: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("venue_images").delete().eq("id", imageId).eq("venue_id", venueId).select("storage_path").maybeSingle();
  if (!data) return { error: "Không xóa được ảnh" };
  await supabase.storage.from("venue-images").remove([data.storage_path]);
  expireTagsInAction(venueTags(venueId));
  revalidatePath(`/owner/venues/${venueId}`);
  revalidatePath(`/venues/${venueId}`);
  return {};
}
