import { VenueReviewActions } from "@/components/admin/venue-review-actions";
import { Alert, buttonClass, Chip, inputClass } from "@/components/ui/controls";
import { PillTabs } from "@/components/ui/data";
import { formatDateTime, formatVnd } from "@/lib/format";
import { listAdminVenues } from "@/lib/services/admin";
import { imageUrl } from "@/lib/supabase/env";
import type { VenueStatus } from "@/lib/types";

export const metadata = { title: "Duyệt sân - Cầu Lông Đà Nẵng" };

const STATUS: Record<VenueStatus, { label: string; tone: "yellow" | "green" | "red" | "gray" }> = {
  pending: { label: "Chờ duyệt", tone: "yellow" },
  approved: { label: "Đã duyệt", tone: "green" },
  rejected: { label: "Bị từ chối", tone: "red" },
  suspended: { label: "Chủ sân tạm ngừng", tone: "gray" },
  hidden: { label: "Bị ẩn", tone: "red" },
};
const ORDER: VenueStatus[] = ["pending", "approved", "rejected", "suspended", "hidden"];
const DAY_LABEL = { weekday: "Ngày thường", weekend: "Cuối tuần" } as const;

// PB19, PB20 - Quản trị viên duyệt sân chờ duyệt, ẩn sân vi phạm
export default async function AdminVenuesPage({ searchParams }: PageProps<"/admin">) {
  const query = await searchParams;
  const status = ORDER.includes(query.status as VenueStatus) ? (query.status as VenueStatus) : "pending";
  const q = typeof query.q === "string" ? query.q : "";
  const result = await listAdminVenues({ status, q });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Duyệt và quản lý sân</h1>
      {!result.ok ? <Alert>{result.message}</Alert> : null}
      {result.ok ? (
        <>
          <PillTabs
            label="Trạng thái sân"
            current={status}
            tabs={ORDER.map((s) => ({
              key: s,
              href: `/admin?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
              text: `${STATUS[s].label} (${result.data.counts[s]})`,
            }))}
          />
          <form className="flex gap-2" action="/admin" role="search">
            <input type="hidden" name="status" value={status} />
            <input name="q" defaultValue={q} placeholder="Tìm theo tên sân hoặc địa chỉ" aria-label="Từ khóa" className={`${inputClass} max-w-sm`} />
            <button className={buttonClass("outline")}>Tìm</button>
          </form>
          {result.data.venues.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Không có sân nào ở mục này.</p>
          ) : null}
          {result.data.venues.map((v) => (
            <article key={v.id} className="rounded-xl border border-slate-200 bg-white p-4" data-testid="admin-venue" data-name={v.name}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold">{v.name}</h2>
                <Chip tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Chip>
                <span className="flex-1" />
                <span className="text-xs text-slate-500">Đăng ký lúc {formatDateTime(v.created_at)}</span>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="inline text-slate-500">Địa chỉ: </dt>
                  <dd className="inline">
                    {v.address} · {v.ward_name}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Chủ sân: </dt>
                  <dd className="inline">{v.owner_name ? `${v.owner_name} · ${v.owner_phone}` : "Tài khoản đã xóa"}</dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Tọa độ: </dt>
                  <dd className="inline">
                    <a
                      className="text-brand-700 hover:underline"
                      href={`https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=17/${v.latitude}/${v.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {v.latitude.toFixed(5)}, {v.longitude.toFixed(5)} (mở bản đồ)
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Hoạt động: </dt>
                  <dd className="inline">
                    {v.open_time} – {v.close_time} · {v.court_count} sân con · giữ chỗ {v.hold_minutes} phút
                    {v.contact_phone ? ` · ${v.contact_phone}` : ""}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline text-slate-500">Bảng giá: </dt>
                  <dd className="inline">
                    {v.prices.length === 0
                      ? "chưa khai báo"
                      : v.prices.map((p) => `${DAY_LABEL[p.day_type]} ${p.start_time}–${p.end_time}: ${formatVnd(p.price)}`).join("; ")}
                  </dd>
                </div>
                {v.description ? (
                  <div className="sm:col-span-2">
                    <dt className="inline text-slate-500">Mô tả: </dt>
                    <dd className="inline">{v.description}</dd>
                  </div>
                ) : null}
              </dl>
              {v.images.length > 0 ? (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {v.images.map((path, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={path} src={imageUrl(path) ?? ""} alt={`Ảnh ${i + 1} của ${v.name}`} className="h-20 w-28 flex-none rounded-lg object-cover" />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Chưa có ảnh.</p>
              )}
              {v.reject_reason && (v.status === "rejected" || v.status === "hidden") ? (
                <p className="mt-2 text-sm text-red-700">Lý do: {v.reject_reason}</p>
              ) : null}
              <VenueReviewActions id={v.id} status={v.status} hasOwner={v.owner_name !== null} />
            </article>
          ))}
        </>
      ) : null}
    </div>
  );
}
