import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { getSession } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { MobileMenu } from "./mobile-menu";
import { NotificationBell } from "./notifications/bell";
import { buttonClass, Chip } from "./ui/controls";

const ROLE_LABEL = { player: "Người chơi", owner: "Chủ sân", admin: "Quản trị viên" } as const;

/** Các mục điều hướng theo vai trò; dùng chung cho thanh menu ngang và menu điện thoại. */
function linksFor(role: Role | undefined) {
  const links = [
    { href: "/", label: "Tìm sân" },
    { href: "/assistant", label: "Trợ lý AI" },
  ];
  if (role === "player") links.push({ href: "/bookings", label: "Lịch đặt của tôi" });
  if (role === "owner")
    links.push({ href: "/owner/venues", label: "Sân của tôi" }, { href: "/owner/bookings", label: "Lịch đặt sân" }, { href: "/owner/reviews", label: "Đánh giá" }, { href: "/owner/stats", label: "Thống kê" });
  if (role === "admin")
    links.push({ href: "/admin", label: "Duyệt sân" }, { href: "/admin/reviews", label: "Đánh giá" }, { href: "/admin/users", label: "Người dùng" }, { href: "/admin/stats", label: "Thống kê" });
  return links;
}

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
 * Khung thanh điều hướng hiện ngay khi chưa biết ai đang đăng nhập. Root layout bọc Navbar trong Suspense với
 * khung này, nên trang không phải chờ đọc hồ sơ người dùng xong mới bắt đầu hiển thị.
 */
export function NavbarFallback() {
  return (
    <header className={HEADER_CLASS}>
      <Logo />
      <div className="flex-1" />
      <span className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" aria-hidden />
    </header>
  );
}

export async function Navbar() {
  const session = await getSession();
  const role = session?.profile.role;
  const links = linksFor(role);
  const initials = session
    ? session.profile.full_name
        .split(/\s+/)
        .slice(-2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("")
    : "";

  const logout = (
    <form action={logoutAction}>
      <button className="text-sm font-medium text-slate-500 hover:text-red-600">Đăng xuất</button>
    </form>
  );

  return (
    <header className={HEADER_CLASS}>
      <Logo />
      <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 sm:flex">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-brand-700">
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1" />
      {session ? (
        <div className="flex flex-none items-center gap-1.5 sm:gap-3">
          <NotificationBell />
          <span className="hidden sm:inline-flex">
            <Chip tone={role === "owner" ? "green" : role === "admin" ? "blue" : "gray"}>{ROLE_LABEL[role!]}</Chip>
          </span>
          <Link
            href="/account"
            title="Tài khoản"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700"
          >
            {initials || "?"}
          </Link>
          <div className="hidden sm:block">{logout}</div>
          <MobileMenu
            links={[...links, { href: "/account", label: "Tài khoản" }]}
            footer={
              <div className="flex items-center justify-between px-3">
                <span className="min-w-0 truncate text-sm text-slate-500">
                  {session.profile.full_name} · {ROLE_LABEL[role!]}
                </span>
                <form action={logoutAction}>
                  <button className="h-11 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700">Đăng xuất</button>
                </form>
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex flex-none items-center gap-2">
          <Link href="/login" className={buttonClass("outline", "h-9 px-3")}>
            Đăng nhập
          </Link>
          <span className="hidden sm:inline-flex">
            <Link href="/register" className={buttonClass("primary", "h-9")}>
              Đăng ký
            </Link>
          </span>
          <MobileMenu
            links={links}
            footer={
              <Link href="/register" className={buttonClass("primary", "h-11 w-full")}>
                Đăng ký tài khoản
              </Link>
            }
          />
        </div>
      )}
    </header>
  );
}
