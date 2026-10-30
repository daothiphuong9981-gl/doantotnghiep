"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui/controls";

/** Chủ sân trả lời (hoặc sửa, xóa câu trả lời) một đánh giá. Câu trả lời hiện công khai dưới đánh giá. */
export function OwnerReply({ reviewId, reply }: { reviewId: number; reply: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(reply ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/reviews/${reviewId}/reply`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: value.trim() }),
      });
      if (!res.ok) {
        setError((await res.json()).message ?? "Không lưu được câu trả lời.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="h-9 self-start" onClick={() => setOpen(true)}>
        {reply ? "Sửa câu trả lời" : "Trả lời"}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        maxLength={1000}
        rows={3}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        placeholder="Cảm ơn góp ý của bạn..."
        aria-label="Câu trả lời của chủ sân"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
      />
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button className="h-9" onClick={() => save(text)} disabled={busy || !text.trim()}>
          {busy ? "Đang lưu..." : "Đăng trả lời"}
        </Button>
        {reply ? (
          <Button variant="danger" className="h-9" onClick={() => save("")} disabled={busy}>
            Xóa câu trả lời
          </Button>
        ) : null}
        <Button variant="outline" className="h-9" onClick={() => setOpen(false)} disabled={busy}>
          Hủy
        </Button>
      </div>
    </div>
  );
}
