import { Alert } from "@/components/ui/controls";
import { BarChart, StatCard } from "@/components/ui/data";
import { getAdminStats } from "@/lib/services/admin";

export const metadata = { title: "Thống kê hệ thống - Cầu Lông Đà Nẵng" };

const VENUE_LABEL = { approved: "Đã duyệt", pending: "Chờ duyệt", rejected: "Bị từ chối", suspended: "Tạm ngừng", hidden: "Bị ẩn" } as const;
const BOOKING_LABEL: Record<string, string> = {
  holding: "Đang giữ chỗ",
  awaiting_confirmation: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  cancelled: "Đã hủy",
  expired: "Hết hạn giữ chỗ",
};
const monthLabel = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`;

// PB22 - Thống kê toàn hệ thống cho quản trị viên
export default async function AdminStatsPage() {
  const result = await getAdminStats();
  if (!result.ok) return <Alert>{result.message}</Alert>;
  const s = result.data;
  const totalUsers = (s.users.player ?? 0) + (s.users.owner ?? 0) + (s.users.admin ?? 0);
  const totalVenues = Object.values(s.venues).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">Thống kê hệ thống</h1>
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Người dùng ({totalUsers})</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Người chơi" value={s.users.player ?? 0} testId="users-player" />
          <StatCard label="Chủ sân" value={s.users.owner ?? 0} testId="users-owner" />
          <StatCard label="Quản trị viên" value={s.users.admin ?? 0} testId="users-admin" />
          <StatCard label="Tài khoản đang bị khóa" value={s.locked_users} testId="users-locked" />
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Sân ({totalVenues})</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {Object.entries(VENUE_LABEL).map(([key, label]) => (
            <StatCard key={key} label={label} value={s.venues[key as keyof typeof VENUE_LABEL] ?? 0} testId={`venues-${key}`} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Lượt đặt theo tháng tạo (6 tháng gần nhất)</h2>
        <BarChart unit="lượt" data={s.bookings_by_month.map((m) => ({ label: monthLabel(m.month), value: m.count }))} />
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5">Tháng</th>
                <th className="px-4 py-2.5 text-right">Số lượt đặt</th>
                <th className="px-4 py-2.5 text-right">Trong đó đã xác nhận</th>
              </tr>
            </thead>
            <tbody>
              {s.bookings_by_month.map((m) => (
                <tr key={m.month} className="border-t border-slate-100" data-month={m.month}>
                  <td className="px-4 py-2">{monthLabel(m.month)}</td>
                  <td className="px-4 py-2 text-right font-semibold" data-testid="month-count">
                    {m.count}
                  </td>
                  <td className="px-4 py-2 text-right">{m.confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-bold text-slate-600">Lượt đặt theo trạng thái (toàn thời gian)</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {Object.entries(BOOKING_LABEL).map(([key, label]) => (
            <StatCard key={key} label={label} value={s.bookings[key] ?? 0} testId={`bookings-${key}`} />
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">Câu hỏi gửi tới trợ lý AI hôm nay: {s.ai_questions_today}</p>
      </section>
    </div>
  );
}
