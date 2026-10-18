import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dự án dùng mô hình render động thông thường (đọc cookie đăng nhập ở mỗi yêu cầu),
  // nên không bật Cache Components.
  cacheComponents: false,
  // Cho phép mở bản dev từ điện thoại cùng mạng Wi-Fi (http://192.168.x.x:3000). Thiếu dòng này Next.js chặn
  // các tệp JavaScript của chế độ dev, trang hiện ra nhưng không bấm được gì. Chỉ áp dụng khi chạy `npm run dev`.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
