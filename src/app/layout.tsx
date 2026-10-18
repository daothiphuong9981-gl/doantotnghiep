import type { Metadata } from "next";
import { preconnect } from "react-dom";
import { Navbar } from "@/components/navbar";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cầu Lông Đà Nẵng - Tìm và đặt sân cầu lông",
  description: "Tìm sân cầu lông trên bản đồ Đà Nẵng, xem giá theo khung giờ và đặt sân trực tuyến.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Mở sẵn kết nối tới máy chủ bản đồ nền để ô bản đồ đầu tiên về nhanh hơn
  preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Navbar />
        {isSupabaseConfigured ? null : (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Chưa cấu hình Supabase. Hãy tạo file <code>.env.local</code> theo mẫu <code>.env.example</code> rồi khởi động lại.
          </div>
        )}
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
