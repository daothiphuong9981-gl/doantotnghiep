// Chép web worker của MapLibre vào public/ để trình duyệt tải được (Turbopack không đóng gói được worker này).
// Chạy tự động sau `npm install` (postinstall). Đường dẫn dùng trong src/components/map/leaflet-map.tsx.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const to = path.join(root, "public", "vendor", "maplibre-gl-worker.mjs");
if (fs.existsSync(from)) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log("Đã chép maplibre-gl-worker.mjs vào public/vendor");
}
