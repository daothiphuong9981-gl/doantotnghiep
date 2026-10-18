import { Alert, buttonClass, inputClass } from "@/components/ui/controls";
import { BarChart, PillTabs, StatCard } from "@/components/ui/data";
import { describeDate, formatVnd, isValidDate, monthRange, slotRange, todayInVietnam, weekRange } from "@/lib/format";
import { listMyVenues } from "@/lib/services/owner";
import { getOwnerStats } from "@/lib/services/stats";

export const metadata = { title: "Thống kê - Cầu Lông Đà Nẵng" };

// PB21 - Thống kê lượt đặt và doanh thu của chủ sân (chỉ tính lượt đã xác nhận thanh toán)
export default async function OwnerStatsPage({ searchParams }: PageProps<"/owner/stats">) {
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const today = todayInVietnam();
  const period = ["week", "month", "custom"].includes(one("period")) ? one("period") : "week";
  const venueId = Number(one("venue_id")) || undefined;
  const range =
    period === "month"
      ? monthRange(today)
      : period === "custom" && isValidDate(one("from")) && isValidDate(one("to"))
        ? { from: one("from"), to: one("to") }
        : weekRange(today);
  const [venues, result] = await Promise.all([listMyVenues(), getOwnerStats({ venueId, ...range })]);
  const venueParam = venueId ? `&venue_id=${venueId}` : "";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Thống kê</h1>
      <PillTabs
        label="Khoảng thời gian"
        current={period}
        tabs={[
          { key: "week", href: `/owner/stats?period=week${venueParam}`, text: "Tuần này" },
          { key: "month", href: `/owner/stats?period=month${venueParam}`, text: "Tháng này" },
          { key: "custom", href: `/owner/stats?period=custom&from=${range.from}&to=${range.to}${venueParam}`, text: "Tùy chọn" },
        ]}
      />
      <form className="flex flex-wrap items-end gap-3" action="/owner/stats">
        <input type="hidden" name="period" value={period === "custom" ? "custom" : period} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Sân</span>
          <select name="venue_id" defaultValue={venueId ?? ""} className={`${inputClass} w-56`}>
            <option value="">Tất cả sân của tôi</option>
            {venues.ok
              ? venues.data.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))
              : null}
          </select>
        </label>
        {period === "custom" ? (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Từ ngày</span>
              <input type="date" name="from" defaultValue={range.from} className={`${inputClass} w-44`} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Đến ngày</span>
              <input type="date" name="to" defaultValue={range.to} className={`${inputClass} w-44`} required />
            </label>
          </>
        ) : null}
        <button className={buttonClass("outline")}>Xem</button>
      </form>

      {!result.ok ? <Alert>{result.message}</Alert> : null}
      {result.ok ? (
        <>
          <p className="text-sm text-slate-500">
            Ngày chơi từ <b>{describeDate(result.data.from).full}</b> đến <b>{describeDate(result.data.to).full}</b>. Chỉ tính các lượt đặt bạn đã xác nhận nhận tiền.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Lượt đặt đã xác nhận" value={result.data.confirmed_count} testId="stat-count" />
            <StatCard label="Doanh thu" value={formatVnd(result.data.revenue)} testId="stat-revenue" />
            <StatCard label="Số khung giờ đã bán" value={result.data.slot_count} testId="stat-slots" />
            <StatCard
              label="Không thành công"
              value={result.data.cancelled_count + result.data.expired_count}
              note={`${result.data.cancelled_count} đã hủy, ${result.data.expired_count} hết hạn giữ chỗ; ${result.data.awaiting_count} đang chờ xác nhận`}
              testId="stat-failed"
            />
          </div>
          <section>
            <h2 className="mb-2 text-sm font-bold text-slate-600">Lượt đặt đã xác nhận theo ngày chơi</h2>
            <BarChart
              unit="lượt"
              data={result.data.by_day.map((d) => ({
                label: describeDate(d.date).short,
                value: d.count,
                title: `${describeDate(d.date).full}: ${d.count} lượt, ${formatVnd(d.revenue)}`,
              }))}
            />
          </section>
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="max-h-96 overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2.5">Ngày chơi</th>
                    <th className="px-4 py-2.5 text-right">Lượt đặt</th>
                    <th className="px-4 py-2.5 text-right">Khung giờ</th>
                    <th className="px-4 py-2.5 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.by_day.map((d) => (
                    <tr key={d.date} className="border-t border-slate-100" data-date={d.date}>
                      <td className="px-4 py-2">{describeDate(d.date).full}</td>
                      <td className="px-4 py-2 text-right">{d.count}</td>
                      <td className="px-4 py-2 text-right">{d.slots}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatVnd(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-bold">Khung giờ được đặt nhiều nhất</h2>
              {result.data.top_slots.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có lượt đặt đã xác nhận trong khoảng này.</p>
              ) : (
                <ol className="flex flex-col gap-1.5 text-sm" data-testid="top-slots">
                  {result.data.top_slots.map((s, i) => (
                    <li key={s.start_time} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                      <span className="flex-1">{slotRange(s.start_time)}</span>
                      <b>{s.count} lượt</b>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
