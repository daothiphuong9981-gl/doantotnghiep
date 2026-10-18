"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/controls";

/** PB20 - Khóa hoặc mở khóa một tài khoản. */
export function UserLockButton({ id, locked, name }: { id: string; locked: boolean; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/lock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_locked: !locked }),
      });
      if (!res.ok) setError((await res.json()).message ?? "Không cập nhật được.");
      router.refresh();
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
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
