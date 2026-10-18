import { Bar } from "@/components/ui/skeleton";

// Khung trang chi tiết sân: ảnh, thông tin, lưới khung giờ, bảng giá
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-5 lg:flex-row" role="status" aria-label="Đang tải">
      <div className="flex flex-1 flex-col gap-4">
        <Bar className="h-56 w-full rounded-xl" />
        <Bar className="h-8 w-2/3" />
        <Bar className="h-4 w-1/2" />
        <div className="grid grid-cols-6 gap-2 rounded-xl border border-slate-200 bg-white p-4">
          {Array.from({ length: 24 }, (_, i) => (
            <Bar key={i} className="h-9" />
          ))}
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 lg:w-80">
        <Bar className="h-40 w-full rounded-xl" />
        <Bar className="h-56 w-full rounded-xl" />
      </div>
      <span className="sr-only">Đang tải...</span>
    </div>
  );
}
