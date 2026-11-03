import Link from "next/link";
import { NavLinks, UserMenu } from "./navbar-session";

const HEADER_CLASS = "sticky top-0 z-[1000] flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:gap-6 sm:px-6";

function Logo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 text-base font-extrabold text-brand-700 sm:text-lg">
      <span className="relative inline-block h-6 w-6 flex-none rounded-lg bg-brand-700" aria-hidden>
        <span className="absolute left-[11px] top-1 h-4 w-0.5 bg-white" />
        <span className="absolute left-1 top-[11px] h-0.5 w-4 bg-white" />
      </span>
      <span className="truncate">Cầu Lông Đà Nẵng</span>
    </Link>
  );
}

/**
 * Thanh điều hướng. Không đọc cookie ở máy chủ (để root layout không làm mọi trang thành động): khung, logo và các
 * liên kết chung render sẵn trong HTML; phần theo người dùng (liên kết theo vai trò, chuông, ảnh đại diện, Đăng xuất)
 * do navbar-session.tsx dựng ở trình duyệt, trong lúc chờ hiện khung giữ chỗ cùng kích thước.
 */
export function Navbar() {
  return (
    <header className={HEADER_CLASS}>
      <Logo />
      <NavLinks />
      <div className="flex-1" />
      <UserMenu />
    </header>
  );
}
