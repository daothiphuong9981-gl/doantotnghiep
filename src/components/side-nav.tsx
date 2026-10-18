"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Thanh điều hướng bên trái của khu vực chủ sân và quản trị. Mục khớp đường dẫn dài nhất được tô đậm. */
export function SideNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const current = links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto whitespace-nowrap px-1 text-sm font-medium md:mx-0 md:flex-col md:overflow-visible md:px-0">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.href === current ? "page" : undefined}
          className={`rounded-lg px-3 py-2 ${link.href === current ? "bg-brand-50 font-bold text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
