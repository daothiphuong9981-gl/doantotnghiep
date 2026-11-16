import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

/** Footer chung (tĩnh, không đọc phiên): liên kết chính sách, điều khoản, liên hệ. */
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-5 text-xs text-slate-500 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {SITE_NAME} · Đồ án tốt nghiệp
        </p>
        <nav aria-label="Liên kết cuối trang" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className="hover:text-brand-700">
            Điều khoản sử dụng
          </Link>
          <Link href="/privacy" className="hover:text-brand-700">
            Xử lý dữ liệu cá nhân
          </Link>
          <Link href="/contact" className="hover:text-brand-700">
            Liên hệ
          </Link>
        </nav>
      </div>
    </footer>
  );
}
