import Link from "next/link";
import { Alert, buttonClass, Chip } from "@/components/ui/controls";
import { listMyVenues } from "@/lib/services/owner";
import type { VenueStatus } from "@/lib/types";
import { toggleSuspendAction } from "../actions";

export const metadata = { title: "Sân của tôi - Cầu Lông Đà Nẵng" };

const STATUS: Record<VenueStatus, { label: string; tone: "yellow" | "green" | "red" | "gray" }> = {
  pending: { label: "Chờ duyệt", tone: "yellow" },
  approved: { label: "Đã duyệt", tone: "green" },
  rejected: { label: "Bị từ chối", tone: "red" },
  suspended: { label: "Tạm ngừng", tone: "gray" },
  hidden: { label: "Bị ẩn", tone: "red" },
};

export default async function OwnerVenuesPage() {
  const result = await listMyVenues();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-extrabold">Sân của tôi</h1>
        <span className="flex-1" />
        <Link href="/owner/venues/new" className={buttonClass("primary")}>
          + Thêm sân
        </Link>
      </div>
      {!result.ok ? <Alert>{result.message}</Alert> : null}
      {result.ok && result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Bạn chưa đăng ký sân nào. Bấm “Thêm sân” để bắt đầu.
        </p>
      ) : null}
      {result.ok && result.data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5">Sân</th>
                <th className="px-4 py-2.5">Sân con</th>
                <th className="px-4 py-2.5">Giữ chỗ</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {result.data.map((v) => (
                <tr key={v.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <b>{v.name}</b>
                    <div className="text-xs text-slate-500">
                      {v.address} · {v.ward_name}
                    </div>
                    {v.reject_reason && (v.status === "rejected" || v.status === "hidden") ? (
                      <div className="mt-1 text-xs text-red-600">Lý do: {v.reject_reason}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{v.court_count}</td>
                  <td className="px-4 py-3">{v.hold_minutes} phút</td>
                  <td className="px-4 py-3">
                    <Chip tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Chip>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {v.status === "approved" || v.status === "suspended" ? (
                        <form action={toggleSuspendAction}>
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="suspend" value={v.status === "approved" ? "1" : "0"} />
                          <button className={buttonClass(v.status === "approved" ? "danger" : "outline", "h-8 px-3 text-xs")}>
                            {v.status === "approved" ? "Tạm ngừng" : "Mở lại"}
                          </button>
                        </form>
                      ) : null}
                      <Link href={`/owner/venues/${v.id}`} className={buttonClass("outline", "h-8 px-3 text-xs")}>
                        Sửa
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
