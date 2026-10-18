import { ListSkeleton } from "@/components/ui/skeleton";

// Hiện ngay khi bấm chuyển trang; nội dung thật thay vào khi máy chủ trả về (streaming)
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl p-5 md:p-7">
      <ListSkeleton />
    </div>
  );
}
