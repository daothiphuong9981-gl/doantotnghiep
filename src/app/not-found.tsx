import Link from "next/link";
import { buttonClass } from "@/components/ui/controls";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
      <h1 className="text-2xl font-extrabold">Không tìm thấy trang</h1>
      <p className="text-sm text-slate-500">Sân hoặc trang bạn tìm không tồn tại, hoặc chưa được duyệt.</p>
      <Link href="/" className={buttonClass("primary")}>
        Về trang tìm sân
      </Link>
    </div>
  );
}
