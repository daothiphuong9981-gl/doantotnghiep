"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, inputClass } from "@/components/ui/controls";
import type { VenueStatus } from "@/lib/types";

type Action = "approve" | "reject" | "hide" | "unhide";

/** PB19, PB20 - Các nút duyệt, từ chối, ẩn, hiện lại sân. Từ chối và ẩn bắt buộc nhập lý do. */
export function VenueReviewActions({ id, status, hasOwner }: { id: number; status: VenueStatus; hasOwner: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState<"reject" | "hide" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: Action) {
    if ((action === "reject" || action === "hide") && !reason.trim()) {
      setError("Hãy nhập lý do để chủ sân biết.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/venues/${id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      if (!res.ok) setError((await res.json()).message ?? "Không cập nhật được.");
      else setAsking(null);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const canApprove = status === "pending" || status === "rejected";
  const canReject = status === "pending";
  const canHide = status === "approved" || status === "suspended";
  const canUnhide = status === "hidden" && hasOwner;
  if (!canApprove && !canReject && !canHide && !canUnhide) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
      {error ? <Alert>{error}</Alert> : null}
      {asking ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-60 flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">{asking === "reject" ? "Lý do từ chối" : "Lý do ẩn sân"} (chủ sân sẽ thấy)</span>
            <input className={inputClass} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} autoFocus />
          </label>
          <Button variant="danger" onClick={() => send(asking)} disabled={busy}>
            {busy ? "Đang lưu..." : asking === "reject" ? "Xác nhận từ chối" : "Xác nhận ẩn sân"}
          </Button>
          <Button variant="outline" onClick={() => setAsking(null)} disabled={busy}>
            Quay lại
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {canReject ? (
            <Button variant="danger" className="h-9" onClick={() => setAsking("reject")} disabled={busy}>
              Từ chối
            </Button>
          ) : null}
          {canHide ? (
            <Button variant="danger" className="h-9" onClick={() => setAsking("hide")} disabled={busy}>
              Ẩn sân
            </Button>
          ) : null}
          {canUnhide ? (
            <Button variant="outline" className="h-9" onClick={() => send("unhide")} disabled={busy}>
              Hiện lại
            </Button>
          ) : null}
          {canApprove ? (
            <Button className="h-9" onClick={() => send("approve")} disabled={busy}>
              {busy ? "Đang lưu..." : "Duyệt sân"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
