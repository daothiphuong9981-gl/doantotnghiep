import Link from "next/link";
import { Alert, buttonClass } from "@/components/ui/controls";
import { PillTabs } from "@/components/ui/data";
import { formatDateTime } from "@/lib/format";
import { listAdminLogs } from "@/lib/services/admin";

export const metadata = { title: "Nhật ký quản trị - Cầu Lông Đà Nẵng" };

const TYPES = [
  { key: "", label: "Tất cả" },
  { key: "venue", label: "Sân" },
  { key: "user", label: "Tài khoản" },
  { key: "review", label: "Đánh giá" },
] as const;

/** Ai duyệt/ẩn sân, khóa tài khoản, ẩn đánh giá, lúc nào (ghi tự động bằng trigger, 0016). */
export default async function AdminLogsPage({ searchParams }: PageProps<"/admin/logs">) {
  const query = await searchParams;
  const type = TYPES.some((t) => t.key === query.type) ? (query.type as string) : "";
  const page = Number(query.page) > 0 ? Math.floor(Number(query.page)) : 1;
  const result = await listAdminLogs({ type: type || undefined, page });
  const href = (nextType: string, nextPage = 1) => `/admin/logs?${new URLSearchParams({ ...(nextType ? { type: nextType } : {}), ...(nextPage > 1 ? { page: String(nextPage) } : {}) })}`;
  const pages = result.ok ? Math.max(1, Math.ceil(result.data.total / result.data.page_size)) : 1;
  const targetHref = (t: string, id: string) => (t === "user" ? `/admin/users/${id}` : t === "venue" ? `/venues/${id}` : "/admin/reviews");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Nhật ký quản trị</h1>
      <PillTabs label="Loại thao tác" current={type} tabs={TYPES.map((t) => ({ key: t.key, href: href(t.key), text: t.label }))} />
      {!result.ok ? <Alert>{result.message}</Alert> : null}
      {result.ok ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5">Thời gian</th>
                <th className="px-4 py-2.5">Quản trị viên</th>
                <th className="px-4 py-2.5">Thao tác</th>
                <th className="px-4 py-2.5">Đối tượng</th>
                <th className="px-4 py-2.5">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {result.data.logs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-2.5">{log.admin_name ?? "Tài khoản đã xóa"}</td>
                  <td className="px-4 py-2.5 font-semibold">{log.action}</td>
                  <td className="px-4 py-2.5">
                    <Link href={targetHref(log.target_type, log.target_id)} className="text-brand-700 hover:underline">
                      {log.target_label ?? `#${log.target_id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{log.detail ?? ""}</td>
                </tr>
              ))}
              {result.data.logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Chưa có thao tác nào được ghi.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
      {pages > 1 ? (
        <nav className="flex items-center gap-3 text-sm" aria-label="Phân trang">
          {page > 1 ? (
            <Link href={href(type, page - 1)} className={buttonClass("outline", "h-9")}>
              ← Trang trước
            </Link>
          ) : null}
          <span className="text-slate-500">
            Trang {Math.min(page, pages)}/{pages}
          </span>
          {page < pages ? (
            <Link href={href(type, page + 1)} className={buttonClass("outline", "h-9")}>
              Trang sau →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
