import Link from "next/link";
import { notFound } from "next/navigation";
import { UserLockButton } from "@/components/admin/user-lock-button";
import { StatusChip } from "@/components/booking/status";
import { Alert, Chip } from "@/components/ui/controls";
import { formatDateTime, formatVnd } from "@/lib/format";
import { getAdminUser } from "@/lib/services/admin";
import type { BookingStatus } from "@/lib/types";

export const metadata = { title: "Chi tiết người dùng - Cầu Lông Đà Nẵng" };

const ROLE = { player: "Người chơi", owner: "Chủ sân", admin: "Quản trị viên" } as const;
const BOOKING_LABEL: Record<string, string> = {
  holding: "Đang giữ chỗ",
  awaiting_confirmation: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  cancelled: "Đã hủy",
  expired: "Hết hạn",
};
const VENUE_LABEL: Record<string, string> = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Bị từ chối", suspended: "Tạm ngừng", hidden: "Bị ẩn" };

/** Quản trị viên xem một người dùng: hồ sơ, lượt đặt, sân sở hữu, lịch sử khóa; khóa/mở khóa ngay tại đây. */
export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const result = await getAdminUser(id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <Alert>{result.message}</Alert>;
  }
  const u = result.data;
  const counts = Object.entries(u.booking_counts);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/users" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Người dùng
      </Link>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{u.full_name}</h1>
          <Chip tone="blue">{ROLE[u.role]}</Chip>
          {u.is_locked ? <Chip tone="red">Đã khóa</Chip> : <Chip tone="green">Hoạt động</Chip>}
          <span className="flex-1" />
          {u.role !== "admin" ? <UserLockButton id={u.id} locked={u.is_locked} name={u.full_name} /> : null}
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="inline text-slate-500">Email: </dt>
            <dd className="inline">{u.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">Điện thoại: </dt>
            <dd className="inline">{u.phone}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">Ngày đăng ký: </dt>
            <dd className="inline">{formatDateTime(u.created_at)}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">Đăng nhập gần nhất: </dt>
            <dd className="inline">{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "—"}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">Đánh giá đã viết: </dt>
            <dd className="inline">{u.reviews}</dd>
          </div>
        </dl>
        {u.is_locked ? (
          <div className="mt-3">
            <Alert>
              Bị khóa {u.locked_at ? `lúc ${formatDateTime(u.locked_at)}` : ""}
              {u.lock_reason ? `. Lý do: ${u.lock_reason}` : ""}
            </Alert>
          </div>
        ) : null}
      </section>

      {u.role === "owner" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-lg font-bold">Sân sở hữu ({u.venues.length})</h2>
          {u.venues.length === 0 ? <p className="text-sm text-slate-500">Chưa có sân nào.</p> : null}
          <ul className="flex flex-col gap-1 text-sm">
            {u.venues.map((v) => (
              <li key={v.id}>
                <Link href={`/admin?status=${v.status}&q=${encodeURIComponent(v.name)}`} className="font-semibold text-brand-700 hover:underline">
                  {v.name}
                </Link>{" "}
                · {VENUE_LABEL[v.status] ?? v.status} · {v.bookings} lượt đặt
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {u.role === "player" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-lg font-bold">Lượt đặt</h2>
          <p className="mb-3 text-sm text-slate-600">
            {counts.length === 0 ? "Chưa có lượt đặt nào." : counts.map(([s, n]) => `${BOOKING_LABEL[s] ?? s}: ${n}`).join(" · ")}
          </p>
          {u.recent_bookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-3 py-2">Mã</th>
                    <th className="px-3 py-2">Sân</th>
                    <th className="px-3 py-2">Ngày chơi</th>
                    <th className="px-3 py-2">Tổng tiền</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Tạo lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {u.recent_bookings.map((b) => (
                    <tr key={b.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold">{b.code}</td>
                      <td className="px-3 py-2">{b.venue_name}</td>
                      <td className="px-3 py-2">{b.first_date ?? "—"}</td>
                      <td className="px-3 py-2">{formatVnd(b.total_amount)}</td>
                      <td className="px-3 py-2">
                        <StatusChip status={b.status as BookingStatus} />
                      </td>
                      <td className="px-3 py-2 text-slate-500">{formatDateTime(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-lg font-bold">Lịch sử khóa / mở khóa</h2>
        {u.logs.length === 0 ? <p className="text-sm text-slate-500">Chưa có.</p> : null}
        <ul className="flex flex-col gap-1 text-sm">
          {u.logs.map((l, i) => (
            <li key={i}>
              <span className="text-slate-500">{formatDateTime(l.created_at)}</span> · <b>{l.action}</b> bởi {l.admin_name ?? "tài khoản đã xóa"}
              {l.detail ? ` — ${l.detail}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
