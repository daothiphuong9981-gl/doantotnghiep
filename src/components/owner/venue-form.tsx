"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveVenueAction, type VenueFormState } from "@/app/owner/actions";
import { Map } from "@/components/map/map";
import { Alert, Button, buttonClass, Field, Input, inputClass } from "@/components/ui/controls";
import { BOOKING_RULES } from "@/lib/constants";
import type { Venue, Ward } from "@/lib/types";

interface Props {
  wards: Ward[];
  venue?: Venue;
  courtCount?: number;
}

export function VenueForm({ wards, venue, courtCount }: Props) {
  const [state, action, pending] = useActionState<VenueFormState, FormData>(saveVenueAction, {});
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    venue ? { lat: venue.latitude, lng: venue.longitude } : null,
  );
  const e = state.errors ?? {};
  // React đặt lại form sau mỗi lần gửi; khi có lỗi thì điền lại giá trị người dùng vừa nhập
  const entered = state.values;
  const val = (key: keyof Venue, fallback: string | number = "") => entered?.[key] ?? venue?.[key] ?? fallback;

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-[1fr_400px]" noValidate>
      {venue ? <input type="hidden" name="id" value={venue.id} /> : null}
      <input type="hidden" name="latitude" value={position?.lat ?? ""} />
      <input type="hidden" name="longitude" value={position?.lng ?? ""} />

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên sân *" error={e.name}>
            <Input name="name" defaultValue={val("name")} required />
          </Field>
          <Field label="Phường/xã *" error={e.ward_id}>
            <select name="ward_id" key={String(val("ward_id"))} defaultValue={val("ward_id")} className={inputClass} required>
              <option value="" disabled>
                Chọn phường/xã
              </option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Địa chỉ *" error={e.address}>
          <Input name="address" defaultValue={val("address")} placeholder="Số nhà, tên đường" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số sân con *" error={e.court_count} hint="Hệ thống tạo Sân 1, Sân 2...">
            <Input name="court_count" type="number" min={1} max={30} defaultValue={entered?.court_count ?? courtCount ?? 1} required />
          </Field>
          <Field label="Điện thoại liên hệ" error={e.contact_phone}>
            <Input name="contact_phone" inputMode="numeric" defaultValue={val("contact_phone")} />
          </Field>
          <Field label="Giờ mở cửa *" error={e.open_time}>
            <Input name="open_time" type="time" step={3600} defaultValue={val("open_time", "05:00")} required />
          </Field>
          <Field label="Giờ đóng cửa *" error={e.close_time}>
            <Input name="close_time" type="time" step={3600} defaultValue={val("close_time", "22:00")} required />
          </Field>
          <Field label="Thời gian giữ chỗ chờ thanh toán (phút) *" error={e.hold_minutes} hint="Từ 5 đến 60 phút">
            <Input name="hold_minutes" type="number" min={5} max={60} defaultValue={val("hold_minutes", 15)} required />
          </Field>
        </div>
        <fieldset className="grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-3">
          <legend className="px-1 text-xs font-bold text-slate-600">Quy định đặt sân của sân này</legend>
          <Field
            label="Khung giờ tối đa mỗi lượt"
            error={e.max_slots_per_booking}
            hint={`Từ ${BOOKING_RULES.max_slots_per_booking.min} đến ${BOOKING_RULES.max_slots_per_booking.max}`}
          >
            <Input
              name="max_slots_per_booking"
              type="number"
              min={BOOKING_RULES.max_slots_per_booking.min}
              max={BOOKING_RULES.max_slots_per_booking.max}
              defaultValue={val("max_slots_per_booking", BOOKING_RULES.max_slots_per_booking.default)}
              required
            />
          </Field>
          <Field label="Số ngày được đặt trước" error={e.advance_days} hint={`Từ ${BOOKING_RULES.advance_days.min} đến ${BOOKING_RULES.advance_days.max} ngày`}>
            <Input
              name="advance_days"
              type="number"
              min={BOOKING_RULES.advance_days.min}
              max={BOOKING_RULES.advance_days.max}
              defaultValue={val("advance_days", BOOKING_RULES.advance_days.default)}
              required
            />
          </Field>
          <Field
            label="Lượt giữ chỗ cùng lúc mỗi người"
            error={e.max_active_holds}
            hint={`Từ ${BOOKING_RULES.max_active_holds.min} đến ${BOOKING_RULES.max_active_holds.max}; tránh một người giữ hết sân`}
          >
            <Input
              name="max_active_holds"
              type="number"
              min={BOOKING_RULES.max_active_holds.min}
              max={BOOKING_RULES.max_active_holds.max}
              defaultValue={val("max_active_holds", BOOKING_RULES.max_active_holds.default)}
              required
            />
          </Field>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngân hàng nhận tiền *" error={e.bank_name}>
            <Input name="bank_name" defaultValue={val("bank_name")} required />
          </Field>
          <Field label="Số tài khoản *" error={e.bank_account_number}>
            <Input name="bank_account_number" inputMode="numeric" defaultValue={val("bank_account_number")} required />
          </Field>
          <Field label="Chủ tài khoản *" error={e.bank_account_name}>
            <Input name="bank_account_name" defaultValue={val("bank_account_name")} required />
          </Field>
        </div>
        <Field label="Mô tả, tiện ích" error={e.description}>
          <textarea name="description" rows={3} defaultValue={val("description")} className={`${inputClass} h-auto py-2`} />
        </Field>
        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Link href="/owner/venues" className={buttonClass("outline")}>
            Quay lại
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu thông tin"}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="px-4 py-3">
          <b className="text-sm">Vị trí trên bản đồ *</b>
          <p className="text-xs text-slate-500">
            Bấm vào bản đồ để chọn vị trí.{" "}
            {position ? `Tọa độ: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}` : "Chưa chọn vị trí."}
          </p>
          {e.latitude || e.longitude ? <p className="text-xs font-medium text-red-600">Hãy chọn vị trí trên bản đồ</p> : null}
        </div>
        <div className="h-80">
          <Map
            pins={position ? [{ id: 0, latitude: position.lat, longitude: position.lng, label: "Sân" }] : []}
            activeId={0}
            onPick={(lat, lng) => setPosition({ lat, lng })}
          />
        </div>
      </div>
    </form>
  );
}
