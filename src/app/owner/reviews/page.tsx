import Link from "next/link";
import { OwnerReply } from "@/components/reviews/owner-reply";
import { Stars } from "@/components/reviews/stars";
import { Alert, Chip } from "@/components/ui/controls";
import { formatDateTime } from "@/lib/format";
import { listOwnerReviews } from "@/lib/services/reviews";

export const metadata = { title: "Đánh giá sân - Cầu Lông Đà Nẵng" };

// Chủ sân xem đánh giá của người chơi và trả lời công khai
export default async function OwnerReviewsPage() {
  const result = await listOwnerReviews();
  const reviews = result.ok ? result.data : [];
  const visible = reviews.filter((r) => r.status === "visible");
  const avg = visible.length ? visible.reduce((s, r) => s + r.rating, 0) / visible.length : null;
  const unanswered = visible.filter((r) => !r.owner_reply).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Đánh giá sân</h1>
        <p className="mt-1 text-sm text-slate-500">
          Người chơi đánh giá được trong 24 giờ kể từ khi bạn xác nhận đã nhận tiền. Câu trả lời của bạn hiện công khai ở trang sân.
        </p>
      </div>
      {!result.ok ? <Alert>{result.message}</Alert> : null}
      {avg !== null ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <Stars value={avg} size="text-lg" />
          <b>{avg.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}/5</b>
          <span className="text-slate-500">· {visible.length} đánh giá đang hiện</span>
          {unanswered ? <Chip tone="yellow">{unanswered} chưa trả lời</Chip> : null}
        </div>
      ) : null}
      {result.ok && reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Sân của bạn chưa có đánh giá nào.</p>
      ) : null}
      {reviews.map((r) => (
        <article key={r.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4" data-testid="owner-review">
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={r.rating} />
            <b className="text-sm">{r.author}</b>
            {r.booking_code ? <span className="text-xs text-slate-500">· lượt {r.booking_code}</span> : null}
            {r.status === "hidden" ? <Chip tone="red">Bị quản trị viên ẩn</Chip> : null}
            <span className="flex-1" />
            <Link href={`/venues/${r.venue_id}#danh-gia`} className="text-xs font-semibold text-brand-700 hover:underline">
              {r.venue_name}
            </Link>
            <span className="text-xs text-slate-500">{formatDateTime(r.created_at)}</span>
          </div>
          {r.comment ? <p className="whitespace-pre-line text-sm text-slate-700">{r.comment}</p> : <p className="text-sm italic text-slate-400">Không có bình luận</p>}
          {r.status === "hidden" && r.hidden_reason ? <p className="text-xs text-red-700">Lý do ẩn: {r.hidden_reason}</p> : null}
          {r.owner_reply ? (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold text-slate-500">Bạn đã trả lời lúc {formatDateTime(r.owner_replied_at)}</p>
              <p className="mt-1 whitespace-pre-line text-slate-700">{r.owner_reply}</p>
            </div>
          ) : null}
          <OwnerReply reviewId={r.id} reply={r.owner_reply} />
        </article>
      ))}
    </div>
  );
}
