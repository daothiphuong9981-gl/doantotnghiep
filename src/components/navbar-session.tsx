"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import type { Role } from "@/lib/types";
import { MobileMenu } from "./mobile-menu";
import { NotificationBell } from "./notifications/bell";
import { buttonClass, Chip } from "./ui/controls";

/**
 * Phần cá nhân hóa của thanh điều hướng, chạy ở trình duyệt. Root layout nhờ vậy không đọc cookie, các trang công khai
 * không phụ thuộc người dùng (/privacy, /login, /register) được tĩnh hóa và CDN trả ngay; HTML tĩnh chỉ có khung
 * chung, không bao giờ chứa tên/vai trò của ai.
 *
 * Cách biết ai đang đăng nhập: cookie phiên Supabase (sb-...-auth-token, không httpOnly) cho biết CÓ phiên hay không
 * mà không cần gọi mạng; có phiên thì hỏi /api/session (no-store) lấy họ tên và vai trò (null nếu tài khoản bị khóa,
 * giống getSession ở máy chủ). Cookie phiên đổi (đăng nhập, đăng xuất, làm mới token, tab khác đăng xuất) thì hỏi lại.
 */

export interface NavSession {
  full_name: string;
  role: Role;
}

const ROLE_LABEL = { player: "Người chơi", owner: "Chủ sân", admin: "Quản trị viên" } as const;

/** Trang mặc định của từng vai trò (giống homeOf trong lib/auth.ts, chép lại để không kéo mã máy chủ vào trình duyệt). */
function homeOf(role: Role): string {
  if (role === "owner") return "/owner/venues";
  if (role === "admin") return "/admin";
  return "/";
}

/** Các mục điều hướng theo vai trò; dùng chung cho thanh menu ngang và menu điện thoại. */
export function linksFor(role: Role | undefined) {
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

/** Chuỗi đại diện cho cookie phiên hiện tại ("" = không có phiên). Chỉ dùng để so sánh, không gửi đi đâu. */
function authCookieSignature(): string {
  return document.cookie
    .split(/;\s*/)
    .filter((c) => c.startsWith("sb-") && c.includes("-auth-token") && !c.includes("code-verifier"))
    .sort()
    .join(";");
}

function subscribeCookie(onChange: () => void) {
  // Không có sự kiện "cookie đổi": kiểm tra lại khi quay lại tab (tab khác có thể đã đăng xuất). Đổi trang thì
  // usePathname làm component render lại và useSyncExternalStore tự đọc lại cookie.
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

interface SessionState {
  /** false: chưa biết (HTML tĩnh/đang hỏi máy chủ) – hiện khung chờ, không hiện nút đăng nhập hay tên ai */
  ready: boolean;
  session: NavSession | null;
  /** Gọi khi bấm Đăng xuất: ẩn ngay phần người dùng, không chờ máy chủ */
  signOut: () => void;
}

const SessionContext = createContext<SessionState>({ ready: false, session: null, signOut: () => {} });

export function useNavSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Render lại khi đổi trang để đọc lại cookie (đăng nhập/đăng xuất bằng Server Action rồi chuyển trang)
  usePathname();
  // null khi render ở máy chủ/hydrate: HTML tĩnh giống nhau cho mọi người
  const signature = useSyncExternalStore(subscribeCookie, authCookieSignature, () => null);
  const [fetched, setFetched] = useState<{ signature: string; session: NavSession | null } | null>(null);
  const [signedOutAt, setSignedOutAt] = useState<string | null>(null);

  useEffect(() => {
    if (!signature) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const body = (await res.json()) as { data?: { session: NavSession | null } };
        if (!cancelled) setFetched({ signature, session: res.ok ? (body.data?.session ?? null) : null });
      } catch {
        // Mất mạng: coi như khách cho tới lần đổi trang sau
        if (!cancelled) setFetched({ signature, session: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signature]);

  const signOut = useCallback(() => setSignedOutAt(signature), [signature]);

  let state: Omit<SessionState, "signOut">;
  if (signature === null) state = { ready: false, session: null };
  else if (signature === "" || signature === signedOutAt) state = { ready: true, session: null };
  else if (fetched?.signature === signature) state = { ready: true, session: fetched.session };
  // Cookie vừa đổi và chưa hỏi xong: hiện khung chờ, KHÔNG giữ tên của phiên cũ (có thể là người khác vừa đăng nhập)
  else state = { ready: false, session: null };

  return <SessionContext.Provider value={{ ...state, signOut }}>{children}</SessionContext.Provider>;
}

/** Trang đăng nhập/đăng ký (tĩnh): người đã đăng nhập được chuyển về trang của vai trò, như trước đây làm ở máy chủ. */
export function RedirectIfSignedIn() {
  const { ready, session } = useNavSession();
  const router = useRouter();
  // Chỉ xét trạng thái ĐẦU TIÊN biết được khi mở trang: vừa đăng nhập xong ở chính trang này thì Server Action tự
  // chuyển tới `next`, không chuyển hướng chồng lên.
  const [first, setFirst] = useState<"unknown" | "guest" | "user">("unknown");
  if (ready && first === "unknown") setFirst(session ? "user" : "guest");
  useEffect(() => {
    if (first === "user" && session) router.replace(homeOf(session.role));
  }, [first, session, router]);
  return null;
}

/** Liên kết theo vai trò ở thanh menu ngang (màn hình rộng). */
export function NavLinks() {
  const { session } = useNavSession();
  return (
    <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 sm:flex">
      {linksFor(session?.role).map((link) => (
        <Link key={link.href} href={link.href} className="hover:text-brand-700">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** Góc phải thanh điều hướng: khung chờ -> nút Đăng nhập/Đăng ký (khách) hoặc chuông, vai trò, ảnh đại diện, Đăng xuất. */
export function UserMenu() {
  const { ready, session, signOut } = useNavSession();
  if (!ready) return <span className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" aria-hidden />;

  const links = linksFor(session?.role);
  if (!session) {
    return (
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
    );
  }

  const role = session.role;
  const initials = session.full_name
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex flex-none items-center gap-1.5 sm:gap-3">
      <NotificationBell />
      <span className="hidden sm:inline-flex">
        <Chip tone={role === "owner" ? "green" : role === "admin" ? "blue" : "gray"}>{ROLE_LABEL[role]}</Chip>
      </span>
      <Link href="/account" title="Tài khoản" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
        {initials || "?"}
      </Link>
      <form action={logoutAction} onSubmit={signOut} className="hidden sm:block">
        <button className="text-sm font-medium text-slate-500 hover:text-red-600">Đăng xuất</button>
      </form>
      <MobileMenu
        links={[...links, { href: "/account", label: "Tài khoản" }]}
        footer={
          <div className="flex items-center justify-between px-3">
            <span className="min-w-0 truncate text-sm text-slate-500">
              {session.full_name} · {ROLE_LABEL[role]}
            </span>
            <form action={logoutAction} onSubmit={signOut}>
              <button className="h-11 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700">Đăng xuất</button>
            </form>
          </div>
        }
      />
    </div>
  );
}
