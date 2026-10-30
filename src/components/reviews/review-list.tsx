"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import type { PublicReview } from "@/lib/types";
import { Stars } from "./stars";

/** Danh sách đánh giá trên trang sân: trang đầu do máy chủ render sẵn, "Xem thêm" tải tiếp qua API. */
export function ReviewList({ venueId, initial, hasMore }: { venueId: number; initial: PublicReview[]; hasMore: boolean }) {
  const [reviews, setReviews] = useState(initial);
  const [more, setMore] = useState(hasMore);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function loadMore() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/venues/${venueId}/reviews?page=${page + 1}`);
      if (!res.ok) throw new Error();
      const { data } = (await res.json()) as { data: { reviews: PublicReview[]; has_more: boolean } };
      setReviews((list) => [...list, ...data.reviews.filter((r) => !list.some((x) => x.id === r.id))]);
      setMore(data.has_more);
      setPage((p) => p + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (reviews.length === 0) return <p className="text-sm text-slate-500">Chưa có đánh giá. Người chơi đã thuê sân sẽ đánh giá được sau khi chơi xong.</p>;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {reviews.map((r) => (
          <li key={r.id} className="flex flex-col gap-1.5 p-4" data-testid="venue-review">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">{r.author}</span>
              <Stars value={r.rating} size="text-sm" />
              <span className="text-xs text-slate-500">
                {formatDateTime(r.created_at)}
                {r.updated_at && Date.parse(r.updated_at) - Date.parse(r.created_at) > 60_000 ? " · đã sửa" : ""}
              </span>
            </div>
            {r.comment ? <p className="whitespace-pre-line text-sm text-slate-700">{r.comment}</p> : null}
            {r.owner_reply ? (
              <div className="mt-1 rounded-lg bg-slate-50 p-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Chủ sân trả lời</p>
                <p className="mt-1 whitespace-pre-line text-slate-700">{r.owner_reply}</p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-red-600">Không tải được thêm đánh giá. Vui lòng thử lại.</p> : null}
      {more ? (
        <button type="button" onClick={loadMore} disabled={busy} className="self-center text-sm font-semibold text-brand-700 hover:underline disabled:opacity-60">
          {busy ? "Đang tải..." : "Xem thêm đánh giá"}
        </button>
      ) : null}
    </div>
  );
}
