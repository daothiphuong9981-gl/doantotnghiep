import type { ReactNode } from "react";
import { CourtPlaceholder } from "./ui/controls";

/** Khung chung của trang đăng nhập và đăng ký. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-1">
      <section className="hidden flex-1 flex-col bg-gradient-to-br from-brand-700 to-brand-900 p-14 text-white lg:flex">
        <h2 className="text-4xl font-extrabold leading-tight">
          Tìm sân trống,
          <br />
          đặt trong một phút.
        </h2>
        <p className="mt-4 max-w-sm text-white/85">
          Xem sân cầu lông trên bản đồ Đà Nẵng, so sánh giá theo khung giờ và đặt sân trực tuyến.
        </p>
        <CourtPlaceholder className="mt-10 h-60 w-full max-w-md !bg-none bg-white/10" />
      </section>
      <section className="flex w-full items-center justify-center p-6 lg:w-[560px]">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7">
          <h1 className="mb-5 text-2xl font-extrabold">{title}</h1>
          {children}
        </div>
      </section>
    </div>
  );
}
