import Link from "next/link";
import { UserLockButton } from "@/components/admin/user-lock-button";
import { Alert, buttonClass, Chip, inputClass } from "@/components/ui/controls";
import { formatDateTime } from "@/lib/format";
import { listUsers } from "@/lib/services/admin";

export const metadata = { title: "Người dùng - Cầu Lông Đà Nẵng" };

const ROLE = { player: "Người chơi", owner: "Chủ sân", admin: "Quản trị viên" } as const;

// PB20 - Tìm kiếm, khóa và mở khóa tài khoản
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : "";
  const role = typeof query.role === "string" && query.role in ROLE ? query.role : "";
  const page = Number(query.page) > 0 ? Math.floor(Number(query.page)) : 1;
  const result = await listUsers({ q, role: role || undefined, page });
  const pageHref = (n: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(n) })}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Người dùng</h1>
      <form className="flex flex-wrap items-end gap-3" action="/admin/users" role="search">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Tên, email hoặc số điện thoại</span>
          <input name="q" defaultValue={q} className={`${inputClass} w-72`} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Vai trò</span>
          <select name="role" defaultValue={role} className={`${inputClass} w-44`}>
            <option value="">Mọi vai trò</option>
            {Object.entries(ROLE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className={buttonClass("outline")}>Tìm</button>
      </form>
      {!result.ok ? <Alert>{result.message}</Alert> : null}
      {result.ok ? (
        <>
          <p className="text-sm text-slate-500" data-testid="user-total">
            {result.data.total} người dùng
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2.5">Họ tên</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Điện thoại</th>
                  <th className="px-4 py-2.5">Vai trò</th>
                  <th className="px-4 py-2.5">Ngày đăng ký</th>
                  <th className="px-4 py-2.5">Trạng thái</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {result.data.users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100" data-email={u.email}>
                    <td className="px-4 py-2.5 font-semibold">{u.full_name}</td>
                    <td className="px-4 py-2.5">{u.email}</td>
                    <td className="px-4 py-2.5">{u.phone}</td>
                    <td className="px-4 py-2.5">{ROLE[u.role]}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDateTime(u.created_at)}</td>
                    <td className="px-4 py-2.5">{u.is_locked ? <Chip tone="red">Đã khóa</Chip> : <Chip tone="green">Hoạt động</Chip>}</td>
                    <td className="px-4 py-2.5 text-right">{u.role === "admin" ? null : <UserLockButton id={u.id} locked={u.is_locked} name={u.full_name} />}</td>
                  </tr>
                ))}
                {result.data.users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Không tìm thấy người dùng phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {result.data.total > result.data.page_size ? (
            <nav className="flex items-center gap-3 text-sm" aria-label="Phân trang">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className={buttonClass("outline", "h-9")}>
                  ← Trang trước
                </Link>
              ) : null}
              <span className="text-slate-500">
                Trang {page}/{Math.ceil(result.data.total / result.data.page_size)}
              </span>
              {page * result.data.page_size < result.data.total ? (
                <Link href={pageHref(page + 1)} className={buttonClass("outline", "h-9")}>
                  Trang sau →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
