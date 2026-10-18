/** Khung xương hiện ngay khi chuyển trang, trong lúc máy chủ đang lấy dữ liệu (dùng trong các loading.tsx). */
export function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} />;
}

/** Trang dạng tiêu đề + các thẻ danh sách (lịch đặt, quản trị, tài khoản...). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Đang tải">
      <Bar className="h-8 w-64" />
      <div className="flex gap-2">
        <Bar className="h-8 w-28 rounded-full" />
        <Bar className="h-8 w-28 rounded-full" />
        <Bar className="h-8 w-28 rounded-full" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4">
          <Bar className="h-4 w-1/3" />
          <Bar className="h-3 w-2/3" />
          <Bar className="h-3 w-1/2" />
        </div>
      ))}
      <span className="sr-only">Đang tải...</span>
    </div>
  );
}
