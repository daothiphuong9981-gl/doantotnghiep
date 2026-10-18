"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, inputClass } from "@/components/ui/controls";
import type { BookingStatus } from "@/lib/types";

/** PB16 - Nút "Đã nhận tiền" và "Chưa nhận được" (bắt buộc nhập lý do) của chủ sân. */
export function OwnerBookingActions({ id, status }: { id: number; status: BookingStatus }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const awaiting = status === "awaiting_confirmation";

  async function send(action: "confirm_payment" | "cancel") {
    if (action === "cancel" && !reason.trim()) {
      setError("Hãy nhập lý do để người chơi biết.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/bookings/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      if (!res.ok) setError((await res.json()).message ?? "Không cập nhật được.");
      else setRejecting(false);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
      {error ? <Alert>{error}</Alert> : null}
      {rejecting ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-60 flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Lý do hủy (người chơi sẽ thấy)</span>
            <input
              className={inputClass}
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: chưa nhận được tiền chuyển khoản"
              autoFocus
            />
          </label>
          <Button variant="danger" onClick={() => send("cancel")} disabled={busy}>
            {busy ? "Đang hủy..." : "Hủy lượt đặt"}
          </Button>
          <Button variant="outline" onClick={() => setRejecting(false)} disabled={busy}>
            Quay lại
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="danger" className="h-9" onClick={() => setRejecting(true)} disabled={busy}>
            {awaiting ? "Chưa nhận được" : "Hủy lượt đặt"}
          </Button>
          {awaiting ? (
            <Button className="h-9" onClick={() => send("confirm_payment")} disabled={busy}>
              {busy ? "Đang lưu..." : "Đã nhận tiền"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
