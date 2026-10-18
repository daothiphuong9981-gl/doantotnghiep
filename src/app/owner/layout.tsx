import { SideNav } from "@/components/side-nav";
import { requireRole } from "@/lib/auth";

const LINKS = [
  { href: "/owner/venues", label: "Sân của tôi" },
  { href: "/owner/bookings", label: "Lịch đặt sân" },
  { href: "/owner/stats", label: "Thống kê" },
  { href: "/account", label: "Tài khoản" },
];

// PB05 - Khu vực chỉ dành cho chủ sân; sai vai trò thì bị chuyển hướng
export default async function OwnerLayout({ children }: LayoutProps<"/owner">) {
  await requireRole("owner");
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white px-3 py-2 md:w-56 md:border-b-0 md:border-r md:p-3">
        <p className="hidden px-3 py-2 text-[11px] font-bold tracking-wider text-slate-400 md:block">QUẢN LÝ SÂN</p>
        <SideNav links={LINKS} />
      </aside>
      <div className="min-w-0 flex-1 p-4 md:p-7">{children}</div>
    </div>
  );
}
