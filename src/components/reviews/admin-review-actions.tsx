"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, inputClass } from "@/components/ui/controls";
import type { ReviewStatus } from "@/lib/types";

/** Quản trị viên ẩn đánh giá vi phạm (bắt buộc lý do, người viết được báo) hoặc hiện lại. */
export function AdminReviewActions({ id, status }: { id: number; status: ReviewStatus }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(next: ReviewStatus) {
    if (next === "hidden" && !reason.trim()) {
      setError("Hãy nhập lý do để người viết biết.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, reason: reason.trim() || undefined }),
      });
      if (!res.ok) setError((await res.json()).message ?? "Không cập nhật được.");
      else setAsking(false);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
      {error ? <Alert>{error}</Alert> : null}
      {asking ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-60 flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Lý do ẩn (người viết sẽ thấy)</span>
            <input className={inputClass} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} autoFocus />
          </label>
          <Button variant="danger" onClick={() => send("hidden")} disabled={busy}>
            {busy ? "Đang lưu..." : "Xác nhận ẩn"}
          </Button>
          <Button variant="outline" onClick={() => setAsking(false)} disabled={busy}>
            Quay lại
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          {status === "visible" ? (
            <Button variant="danger" className="h-9" onClick={() => setAsking(true)} disabled={busy}>
              Ẩn đánh giá
            </Button>
          ) : (
            <Button variant="outline" className="h-9" onClick={() => send("visible")} disabled={busy}>
              {busy ? "Đang lưu..." : "Hiện lại"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
