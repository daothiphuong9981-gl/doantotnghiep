import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dự án dùng mô hình cũ (không bật Cache Components): trang công khai không đọc cookie thì được tĩnh hóa,
  // trang cần phiên đăng nhập render động; dữ liệu công khai lưu đệm bằng unstable_cache + tag.
  cacheComponents: false,
  experimental: {
    // Trang động mặc định không được giữ ở trình duyệt: bấm quay lại trang vừa xem cũng phải gọi máy chủ.
    // Giữ 30 giây để chuyển qua lại giữa các trang gần như tức thì. Dữ liệu vẫn mới vì mọi thao tác thay đổi
    // (đặt, hủy, xác nhận, đánh giá) đều gọi router.refresh()/revalidatePath, và chuông thông báo làm mới trang lịch đặt.
    staleTimes: { dynamic: 30 },
  },
  // Cho phép mở bản dev từ điện thoại cùng mạng Wi-Fi (http://192.168.x.x:3000). Thiếu dòng này Next.js chặn
  // các tệp JavaScript của chế độ dev, trang hiện ra nhưng không bấm được gì. Chỉ áp dụng khi chạy `npm run dev`.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Ảnh sân lưu ở Supabase Storage thường là ảnh gốc chụp từ điện thoại (vài MB). next/image thu nhỏ, đổi sang
  // WebP/AVIF và lưu đệm trên CDN; chỉ cho phép ảnh trong bucket công khai của dự án.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2_678_400,
  },
  // Tệp worker MapLibre trong public/vendor luôn được gọi kèm ?v=<phiên bản> nên lưu đệm vĩnh viễn ở trình duyệt và CDN.
  async headers() {
    return [{ source: "/vendor/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
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
