import Link from "next/link";
import { AdminReviewActions } from "@/components/reviews/admin-review-actions";
import { Stars } from "@/components/reviews/stars";
import { Alert, Chip } from "@/components/ui/controls";
import { PillTabs } from "@/components/ui/data";
import { formatDateTime } from "@/lib/format";
import { listAdminReviews } from "@/lib/services/reviews";
import type { ReviewStatus } from "@/lib/types";

export const metadata = { title: "Kiểm duyệt đánh giá - Cầu Lông Đà Nẵng" };

const TABS: { key: ReviewStatus; text: string }[] = [
  { key: "visible", text: "Đang hiện" },
  { key: "hidden", text: "Đã ẩn" },
];

// Quản trị viên ẩn đánh giá vi phạm (người viết ẩn danh vẫn hiện tên thật ở đây để xử lý vi phạm)
export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const query = await searchParams;
  const status: ReviewStatus = query.status === "hidden" ? "hidden" : "visible";
  const result = await listAdminReviews(status);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Kiểm duyệt đánh giá</h1>
      <PillTabs label="Trạng thái đánh giá" current={status} tabs={TABS.map((t) => ({ ...t, href: `/admin/reviews?status=${t.key}` }))} />
      {!result.ok ? <Alert>{result.message}</Alert> : null}
      {result.ok && result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Không có đánh giá nào ở mục này.</p>
      ) : null}
      {result.ok
        ? result.data.map((r) => (
            <article key={r.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4" data-testid="admin-review">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={r.rating} />
                <b className="text-sm">{r.author}</b>
                {r.is_anonymous ? <Chip>Ẩn tên khi hiển thị</Chip> : null}
                <span className="text-xs text-slate-500">· lượt {r.booking_code}</span>
                <span className="flex-1" />
                <Link href={`/venues/${r.venue_id}#danh-gia`} className="text-xs font-semibold text-brand-700 hover:underline">
                  {r.venue_name}
                </Link>
                <span className="text-xs text-slate-500">{formatDateTime(r.created_at)}</span>
              </div>
              {r.comment ? <p className="whitespace-pre-line text-sm text-slate-700">{r.comment}</p> : <p className="text-sm italic text-slate-400">Không có bình luận</p>}
              {r.owner_reply ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Chủ sân: {r.owner_reply}</p> : null}
              {r.status === "hidden" && r.hidden_reason ? <p className="text-xs text-red-700">Lý do ẩn: {r.hidden_reason}</p> : null}
              <AdminReviewActions id={r.id} status={r.status} />
            </article>
          ))
        : null}
    </div>
  );
}
