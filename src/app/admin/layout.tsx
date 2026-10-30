import { SideNav } from "@/components/side-nav";
import { requireRole } from "@/lib/auth";

const LINKS = [
  { href: "/admin", label: "Duyệt và quản lý sân" },
  { href: "/admin/reviews", label: "Kiểm duyệt đánh giá" },
  { href: "/admin/users", label: "Người dùng" },
  { href: "/admin/stats", label: "Thống kê hệ thống" },
  { href: "/account", label: "Tài khoản" },
];

// Khu vực chỉ dành cho quản trị viên
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("admin");
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white px-3 py-2 md:w-56 md:border-b-0 md:border-r md:p-3">
        <p className="hidden px-3 py-2 text-[11px] font-bold tracking-wider text-slate-400 md:block">QUẢN TRỊ</p>
        <SideNav links={LINKS} />
      </aside>
      <div className="min-w-0 flex-1 p-4 md:p-7">{children}</div>
    </div>
  );
}
