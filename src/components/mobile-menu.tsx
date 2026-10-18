"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Menu điều hướng trên điện thoại (màn hình hẹp hơn 640px, nơi thanh menu ngang bị ẩn).
 * Chỉ render danh sách khi mở để không nhân đôi liên kết trong header.
 */
export function MobileMenu({ links, footer }: { links: { href: string; label: string }[]; footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);

  // Chuyển trang thì tự đóng menu
  if (open && pathname !== openedAt) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={open ? "Đóng menu" : "Mở menu"}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 top-14 z-[1090] bg-slate-900/30" onClick={() => setOpen(false)} aria-hidden />
          <nav className="fixed inset-x-0 top-14 z-[1100] max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-slate-200 bg-white p-3 shadow-xl" aria-label="Menu">
            {links.map((link) => {
              const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-12 items-center rounded-lg px-3 text-base font-medium ${active ? "bg-brand-50 font-bold text-brand-700" : "text-slate-700"}`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-slate-100 pt-3">{footer}</div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
