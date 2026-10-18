"use client";

import dynamic from "next/dynamic";

// Leaflet cần đối tượng window nên chỉ tải ở trình duyệt.
export const Map = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">Đang tải bản đồ...</div>,
});
