"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui/controls";
import { formatDateTime } from "@/lib/format";
import type { BookingStatus, MyReviewState } from "@/lib/types";
import { Stars } from "./stars";

const LABELS = ["", "Rất tệ", "Chưa tốt", "Bình thường", "Tốt", "Tuyệt vời"];

/**
 * Khung đánh giá trên trang lượt đặt: người chơi chấm sao, bình luận, chọn ẩn tên. Mở ngay khi chủ sân xác nhận thanh
 * toán, trong 24 giờ (máy chủ kiểm tra lại, giao diện chỉ để hướng dẫn). Người chơi có thể bỏ qua; hết hạn thì chỉ xem
 * lại đánh giá đã gửi.
 */
export function ReviewForm({ bookingId, bookingStatus, state }: { bookingId: number; bookingStatus: BookingStatus; state: MyReviewState }) {
  const router = useRouter();
  const review = state.review;
  const [editing, setEditing] = useState(!review);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [anonymous, setAnonymous] = useState(review?.is_anonymous ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!review && !state.can_edit) {
    // Đang giữ chỗ hoặc chờ xác nhận: báo trước để người chơi biết sẽ có chỗ đánh giá. Đã hủy, hết hạn, quá 24 giờ: ẩn.
    if (bookingStatus !== "holding" && bookingStatus !== "awaiting_confirmation") return null;
    return (
      <section id="danh-gia" className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="review-upcoming">
        <h2 className="font-bold">★ Đánh giá sân</h2>
        <p>Khi chủ sân xác nhận đã nhận tiền, bạn có thể chấm sao và bình luận về sân ngay tại đây trong 24 giờ (không bắt buộc).</p>
      </section>
    );
  }

  async function save() {
    if (rating < 1) {
      setError("Hãy chọn số sao.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim(), is_anonymous: anonymous }),
      });
      if (!res.ok) {
        setError((await res.json()).message ?? "Không lưu được đánh giá.");
        return;
      }
      setSaved(true);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || rating;
  return (
    <section id="danh-gia" className="flex scroll-mt-20 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5" data-testid="review-box">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">{review ? "Đánh giá của bạn" : "Đánh giá sân"}</h2>
        {state.can_edit && state.deadline ? <span className="text-xs text-slate-500">Sửa được đến {formatDateTime(state.deadline)}</span> : null}
      </div>

      {review?.status === "hidden" ? (
        <Alert>Đánh giá đã bị quản trị viên ẩn{review.hidden_reason ? `. Lý do: ${review.hidden_reason}` : ""}.</Alert>
      ) : null}
      {saved ? <Alert tone="success">Đã lưu đánh giá. Cảm ơn bạn!</Alert> : null}

      {editing && state.can_edit ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex" role="radiogroup" aria-label="Số sao" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} sao - ${LABELS[n]}`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  className={`px-0.5 text-3xl leading-none ${n <= shown ? "text-amber-400" : "text-slate-300"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="text-sm font-semibold text-slate-600">{shown ? LABELS[shown] : "Chọn số sao"}</span>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Bình luận (không bắt buộc)</span>
            <textarea
              value={comment}
              maxLength={1000}
              rows={3}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Mặt sân, ánh sáng, chỗ để xe, thái độ phục vụ..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span>
              Ẩn tên của tôi
              <span className="block text-xs text-slate-500">Trang sân và chủ sân sẽ thấy &quot;Người chơi ẩn danh&quot;.</span>
            </span>
          </label>
          {error ? <Alert>{error}</Alert> : null}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy} className="flex-1">
              {busy ? "Đang lưu..." : review ? "Lưu thay đổi" : "Gửi đánh giá"}
            </Button>
            {review ? (
              <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                Hủy
              </Button>
            ) : null}
          </div>
        </>
      ) : review ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Stars value={review.rating} size="text-xl" />
            <span className="text-sm font-semibold text-slate-600">{LABELS[review.rating]}</span>
            <span className="text-xs text-slate-500">· {review.is_anonymous ? "Ẩn tên" : "Hiện tên"}</span>
          </div>
          {review.comment ? <p className="whitespace-pre-line text-sm text-slate-700">{review.comment}</p> : null}
          {review.owner_reply ? (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold text-slate-500">Chủ sân trả lời</p>
              <p className="mt-1 whitespace-pre-line text-slate-700">{review.owner_reply}</p>
            </div>
          ) : null}
          {state.can_edit ? (
            <Button variant="outline" className="h-9" onClick={() => setEditing(true)}>
              Sửa đánh giá
            </Button>
          ) : (
            <p className="text-xs text-slate-500">Đã hết thời gian sửa đánh giá (24 giờ kể từ khi chủ sân xác nhận).</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
