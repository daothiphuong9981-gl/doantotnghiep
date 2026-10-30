/** Hiển thị số sao (làm tròn tới nửa sao bằng cách tô theo phần trăm). Dùng được ở cả Server và Client Component. */
export function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  const pct = Math.max(0, Math.min(5, value)) * 20;
  return (
    <span className={`relative inline-block leading-none ${size}`} role="img" aria-label={`${value.toLocaleString("vi-VN")} trên 5 sao`}>
      <span className="text-slate-300" aria-hidden>
        ★★★★★
      </span>
      <span className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-400" style={{ width: `${pct}%` }} aria-hidden>
        ★★★★★
      </span>
    </span>
  );
}

/** "★ 4,3 (12)" gọn cho thẻ sân; không hiện gì khi chưa có đánh giá. */
export function RatingBadge({ avg, count }: { avg: number | null | undefined; count: number | undefined }) {
  if (!count || avg === null || avg === undefined) return null;
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-50 px-2.5 text-xs font-semibold text-amber-700" title={`${count} đánh giá`}>
      ★ {avg.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      <span className="font-normal text-amber-600">({count})</span>
    </span>
  );
}
