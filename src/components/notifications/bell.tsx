"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppNotification, NotificationKind } from "@/lib/types";

/** Chu kỳ hỏi thông báo mới khi tab đang mở (ms). Quay lại tab thì hỏi ngay nên không cần hỏi dày. */
const POLL_MS = 45_000;
/** Thời gian hiện popup thông báo mới (ms). */
const TOAST_MS = 7_000;

const DOT: Record<NotificationKind, string> = {
  booking_new: "bg-amber-500",
  payment_reported: "bg-blue-500",
  booking_confirmed: "bg-brand-600",
  booking_cancelled: "bg-red-500",
  booking_expired: "bg-slate-400",
  venue_reviewed: "bg-violet-500",
  review_new: "bg-yellow-500",
  review_replied: "bg-brand-600",
  review_hidden: "bg-red-500",
  review_reminder: "bg-amber-400",
};

/** "3 phút trước", "2 giờ trước", quá 1 ngày thì ghi ngày. */
function ago(iso: string): string {
  const seconds = (Date.now() - Date.parse(iso)) / 1000;
  if (seconds < 60) return "Vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Các trang hiển thị lượt đặt: có thông báo mới thì tải lại dữ liệu trang để thấy ngay thay đổi. */
const LIVE_PAGES = /^\/(owner\/bookings|bookings|owner\/stats)(\/|$)/;

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);
  /** id thông báo mới nhất đã biết; null = chưa tải lần nào (lần đầu không bật popup). */
  const lastId = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const path = useRef(pathname);
  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const { data } = (await res.json()) as { data: { items: AppNotification[]; unread: number } };
      const newest = data.items[0]?.id ?? 0;
      const known = lastId.current;
      if (known !== null && newest > known) {
        const fresh = data.items.filter((n) => n.id > known && !n.read_at);
        if (fresh.length > 0) {
          setToast(fresh[0]);
          if (LIVE_PAGES.test(path.current)) router.refresh();
        }
      }
      lastId.current = Math.max(known ?? 0, newest);
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Mất mạng tạm thời: thử lại ở lần hỏi sau
    }
  }, [router]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // Đóng danh sách khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(ids?: number[]) {
    const targets = ids ?? items.filter((n) => !n.read_at).map((n) => n.id);
    if (targets.length === 0) return;
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (targets.includes(n.id) && !n.read_at ? { ...n, read_at: now } : n)));
    setUnread((count) => (ids ? Math.max(0, count - targets.length) : 0));
    await fetch("/api/notifications/read", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    }).catch(() => undefined);
  }

  function openItem(n: AppNotification) {
    setOpen(false);
    setToast(null);
    if (!n.read_at) void markRead([n.id]);
  }

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
        data-testid="notification-bell"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white" data-testid="notification-unread">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-[1200] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl" role="dialog" aria-label="Thông báo">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <b className="text-sm">Thông báo</b>
            {unread > 0 ? (
              <button type="button" onClick={() => void markRead()} className="text-xs font-semibold text-brand-700 hover:underline">
                Đánh dấu tất cả đã đọc
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Chưa có thông báo nào.</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto" data-testid="notification-list">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link}
                    onClick={() => openItem(n)}
                    className={`flex gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${n.read_at ? "" : "bg-brand-50/60"}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.read_at ? "bg-transparent" : DOT[n.kind]}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.read_at ? "font-medium text-slate-700" : "font-bold"}`}>{n.title}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-600">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-slate-400">{ago(n.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* Popup khi có thông báo mới */}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[2000]">
        {toast ? (
          <Link
            href={toast.link}
            onClick={() => openItem(toast)}
            className="pointer-events-auto flex w-[min(340px,calc(100vw-2rem))] gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
            data-testid="notification-toast"
          >
            <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${DOT[toast.kind]}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{toast.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-600">{toast.body}</span>
              <span className="mt-1.5 block text-xs font-semibold text-brand-700">Xem chi tiết →</span>
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
