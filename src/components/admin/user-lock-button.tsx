"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass, inputClass } from "@/components/ui/controls";

/**
 * PB20 - Khóa hoặc mở khóa một tài khoản. Khóa: bắt buộc nhập lý do (người bị khóa thấy lý do khi đăng nhập) và bấm
 * xác nhận lần nữa. Mở khóa: hỏi xác nhận.
 */
export function UserLockButton({ id, locked, name }: { id: string; locked: boolean; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(nextLocked: boolean) {
    if (nextLocked && !reason.trim()) {
      setError("Hãy nhập lý do khóa.");
      return;
    }
    if (!nextLocked && !window.confirm(`Mở khóa tài khoản ${name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/lock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_locked: nextLocked, reason: nextLocked ? reason.trim() : undefined }),
      });
      if (!res.ok) setError((await res.json()).message ?? "Không cập nhật được.");
      else {
        setAsking(false);
        setReason("");
      }
      router.refresh();
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setBusy(false);
    }
  }

  if (asking) {
    return (
      <span className="inline-flex flex-col items-end gap-1.5">
        <label className="block text-left">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Lý do khóa {name} (người dùng sẽ thấy)</span>
          <input
            className={`${inputClass} h-8 w-64 text-xs`}
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: giữ chỗ ảo nhiều lần"
            autoFocus
          />
        </label>
        <span className="flex gap-1.5">
          <button type="button" onClick={() => setAsking(false)} disabled={busy} className={buttonClass("outline", "h-8 px-3 text-xs")}>
            Thôi
          </button>
          <button type="button" onClick={() => send(true)} disabled={busy} className={buttonClass("danger", "h-8 px-3 text-xs")}>
            {busy ? "Đang khóa..." : "Xác nhận khóa"}
          </button>
        </span>
        {error ? (
          <span role="alert" className="text-xs text-red-600">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => (locked ? send(false) : (setError(null), setAsking(true)))}
        disabled={busy}
        aria-label={`${locked ? "Mở khóa" : "Khóa"} tài khoản ${name}`}
        className={buttonClass(locked ? "outline" : "danger", "h-8 px-3 text-xs")}
      >
        {busy ? "Đang lưu..." : locked ? "Mở khóa" : "Khóa"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
