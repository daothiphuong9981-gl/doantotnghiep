"use client";

import dynamic from "next/dynamic";
import { type ComponentProps, useEffect, useRef, useState } from "react";

function MapPlaceholder() {
  return <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">Đang tải bản đồ...</div>;
}

// Leaflet cần đối tượng window nên chỉ tải ở trình duyệt.
const LeafletMap = dynamic(() => import("./leaflet-map"), { ssr: false, loading: MapPlaceholder });

/**
 * Tải MapLibre (nền vector, ~1 MB) song song với Leaflet thay vì đợi Leaflet mount xong mới bắt đầu:
 * BaseLayer import lại "maplibre-gl" sẽ dùng ngay module đã tải. Máy không có WebGL thì không tải (BaseLayer dùng ô ảnh).
 */
function preloadVectorLayer() {
  if (!("WebGLRenderingContext" in window)) return;
  // Lỗi ở đây bỏ qua: BaseLayer tự import lại và chuyển sang ô ảnh nếu vẫn lỗi
  Promise.all([import("maplibre-gl"), import("@maplibre/maplibre-gl-leaflet")]).catch(() => undefined);
}

/** Bắt đầu tải bản đồ khi khung còn cách màn hình khoảng này (px). */
const LOAD_MARGIN = "300px";

/**
 * Bản đồ chỉ tải khi khung bản đồ sắp hiện trên màn hình. Khung đang ẩn (display:none, ví dụ tab Bản đồ trên điện thoại
 * chưa mở) không bao giờ giao cắt nên không tải Leaflet/MapLibre; mở tab thì tải. Trước đó hiện khung giữ chỗ cùng kích thước.
 */
export function Map(props: ComponentProps<typeof LeafletMap>) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          preloadVectorLayer();
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: LOAD_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  if (visible) return <LeafletMap {...props} />;
  // Khung giữ chỗ dùng cùng lớp CSS với bản đồ thật để không xô lệch bố cục
  return (
    <div ref={box} className={props.className ?? "relative h-full w-full"}>
      <MapPlaceholder />
    </div>
  );
}
