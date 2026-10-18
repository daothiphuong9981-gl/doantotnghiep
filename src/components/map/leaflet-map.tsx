"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import type { Bounds } from "@/lib/venue-filter";

export interface MapPin {
  id: number;
  latitude: number;
  longitude: number;
  label: string;
  title?: string;
  /** Số nhỏ cạnh nhãn giá, ví dụ số sân còn trống ở khung giờ đang lọc. */
  badge?: string;
}

// Trung tâm Đà Nẵng (khu vực cầu Rồng)
export const DA_NANG_CENTER: [number, number] = [16.0612, 108.2271];

/** Từ số điểm này trở lên mới gom cụm; ít điểm thì hiện từng sân cho dễ so giá. */
const CLUSTER_MIN_PINS = 15;
/** Hai nhãn cách nhau dưới số điểm ảnh này thì gom chung một cụm. */
const CLUSTER_RADIUS_PX = 48;
/** Từ mức zoom này không gom cụm nữa (đã nhìn rõ từng con phố). */
const CLUSTER_MAX_ZOOM = 16;

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Nền bản đồ vector của OpenFreeMap (dữ liệu OpenStreetMap, miễn phí, không cần khóa, có CDN):
 * mỗi ô vector phủ vùng bằng 4 ô ảnh, tải ~0,2 giây từ Việt Nam. Vẽ bằng WebGL qua MapLibre.
 */
const VECTOR_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const VECTOR_ATTRIBUTION = `<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> ${OSM_ATTRIBUTION}`;
/** Không tải được nền vector trong khoảng này thì chuyển sang ô ảnh. */
const VECTOR_TIMEOUT_MS = 6000;
/**
 * Nền ô ảnh dự phòng (máy không có WebGL hoặc nền vector lỗi). Một số nhà mạng trong nước chặn tên miền
 * tile.openstreetmap.org ở DNS, nên ô lỗi liên tiếp thì chuyển sang máy chủ OSM Pháp.
 */
const RASTER_SOURCES = [
  { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", subdomains: "", attribution: OSM_ATTRIBUTION },
  { url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", subdomains: "abc", attribution: `${OSM_ATTRIBUTION}, OSM France` },
];

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Lớp nền: thử vector trước, lỗi thì lần lượt dùng các nguồn ô ảnh. */
function BaseLayer() {
  const map = useMap();
  useEffect(() => {
    let cancelled = false;
    let layer: L.Layer | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const replace = (next: L.Layer) => {
      if (layer) map.removeLayer(layer);
      layer = next.addTo(map);
    };
    const showRaster = (index = 0) => {
      if (cancelled) return;
      clearTimeout(timer);
      const source = RASTER_SOURCES[index];
      let errors = 0;
      const tiles = L.tileLayer(source.url, { attribution: source.attribution, subdomains: source.subdomains || "abc", maxZoom: 19 });
      tiles.on("tileerror", () => {
        errors += 1;
        if (errors === 3 && index + 1 < RASTER_SOURCES.length) showRaster(index + 1);
      });
      replace(tiles);
    };

    if (!supportsWebGL()) {
      showRaster();
    } else {
      Promise.all([import("@maplibre/maplibre-gl-leaflet"), import("maplibre-gl")])
        .then(([{ maplibreGL }, maplibre]) => {
          if (cancelled) return;
          // Worker được chép vào public/vendor bởi scripts/copy-maplibre-worker.mjs (postinstall)
          maplibre.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${maplibre.getVersion()}`);
          // attribution là tùy chọn chung của L.Layer (hiện ở góc bản đồ), plugin không khai báo trong kiểu dữ liệu
          const vector = maplibreGL({ style: VECTOR_STYLE, attribution: VECTOR_ATTRIBUTION } as Parameters<typeof maplibreGL>[0]);
          replace(vector);
          const glMap = vector.getMaplibreMap();
          let loaded = false;
          glMap.once("load", () => {
            loaded = true;
            clearTimeout(timer);
          });
          glMap.on("error", () => {
            if (!loaded) showRaster();
          });
          timer = setTimeout(() => {
            if (!loaded) showRaster();
          }, VECTOR_TIMEOUT_MS);
        })
        .catch(() => showRaster());
    }
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (layer) map.removeLayer(layer);
    };
  }, [map]);
  return null;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const priceIcon = (pin: MapPin, active: boolean) =>
  L.divIcon({
    className: "",
    html: `<span class="price-pin${active ? " active" : ""}">${escapeHtml(pin.label)}${pin.badge ? `<em>${escapeHtml(pin.badge)}</em>` : ""}</span>`,
    iconSize: [0, 0],
    // Popup mở ngay phía trên nhãn giá
    popupAnchor: [0, -30],
  });
const clusterIcon = (count: number, label: string) =>
  L.divIcon({
    className: "",
    html: `<span class="cluster-pin"><b>${count}</b><small>${escapeHtml(label)}</small></span>`,
    iconSize: [0, 0],
  });
const meIcon = L.divIcon({ className: "", html: '<span class="me-pin" style="display:block;transform:translate(-50%,-50%)"></span>', iconSize: [0, 0] });

const toBounds = (b: L.LatLngBounds): Bounds => ({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });

/**
 * Đưa bản đồ về vùng chứa tất cả các điểm (và vị trí người dùng nếu có).
 * Có fitKey thì chỉ chạy lại khi fitKey đổi (kết quả tìm kiếm mới), không nhảy bản đồ khi chỉ sắp xếp hay lọc theo vùng.
 */
function FitBounds({ pins, me, fitKey }: { pins: MapPin[]; me?: [number, number] | null; fitKey?: unknown }) {
  const map = useMap();
  const latest = useRef({ pins, me });
  useEffect(() => {
    latest.current = { pins, me };
  });
  const deps = fitKey === undefined ? [pins, me] : [fitKey];
  useEffect(() => {
    const { pins: current, me: point } = latest.current;
    const points: [number, number][] = current.map((p) => [p.latitude, p.longitude]);
    if (point) points.push(point);
    if (points.length === 0) return;
    // Khung bản đồ có thể vừa được hiện ra (tab Bản đồ trên điện thoại): đo lại kích thước trước khi canh
    map.invalidateSize();
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ...deps]);
  return null;
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) });
  return null;
}

/** Leaflet cần biết khi khung bản đồ đổi kích thước (ví dụ chuyển tab Danh sách/Bản đồ trên điện thoại). */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** Báo vùng đang xem khi chính người dùng kéo/zoom bản đồ (không tính lúc ứng dụng tự di chuyển bản đồ). */
function UserMoveWatcher({ onUserMove }: { onUserMove: (bounds: Bounds) => void }) {
  const map = useMap();
  const state = useRef({ dragged: false, lastInput: 0, ignoreUntil: 0 });
  useEffect(() => {
    const container = map.getContainer();
    const mark = () => {
      state.current.lastInput = Date.now();
    };
    const events = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    for (const name of events) container.addEventListener(name, mark, { passive: true });
    return () => {
      for (const name of events) container.removeEventListener(name, mark);
    };
  }, [map]);
  useMapEvents({
    dragstart: () => {
      state.current.dragged = true;
    },
    // Popup tự lia bản đồ cho vừa khung: không tính là người dùng đổi vùng tìm
    popupopen: () => {
      state.current.ignoreUntil = Date.now() + 800;
    },
    moveend: () => {
      const s = state.current;
      const now = Date.now();
      const byUser = s.dragged || now - s.lastInput < 1000;
      s.dragged = false;
      s.lastInput = 0;
      if (byUser && now > s.ignoreUntil) onUserMove(toBounds(map.getBounds()));
    },
  });
  return null;
}

/** Sân đang chọn ở danh sách mà nằm ngoài khung nhìn thì lia bản đồ tới (giữ nguyên mức zoom). */
function FollowActive({ pin }: { pin: MapPin | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!pin) return;
    const point = L.latLng(pin.latitude, pin.longitude);
    if (!map.getBounds().pad(-0.1).contains(point)) map.panTo(point);
  }, [map, pin]);
  return null;
}

interface Cluster {
  key: string;
  pins: MapPin[];
  lat: number;
  lng: number;
}

/** Gom các nhãn chồng lên nhau ở mức zoom hiện tại (thuật toán tham lam theo khoảng cách điểm ảnh). */
function useClusters(pins: MapPin[], activeId: number | null | undefined, enabled: boolean) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return useMemo(() => {
    if (!enabled || pins.length < CLUSTER_MIN_PINS || zoom >= CLUSTER_MAX_ZOOM) return { singles: pins, clusters: [] as Cluster[] };
    const groups: { x: number; y: number; pins: MapPin[] }[] = [];
    const singles: MapPin[] = [];
    for (const pin of pins) {
      // Sân đang chọn luôn hiện riêng
      if (pin.id === activeId) {
        singles.push(pin);
        continue;
      }
      const { x, y } = map.project([pin.latitude, pin.longitude], zoom);
      const group = groups.find((g) => Math.hypot(g.x - x, g.y - y) < CLUSTER_RADIUS_PX);
      if (group) group.pins.push(pin);
      else groups.push({ x, y, pins: [pin] });
    }
    const clusters: Cluster[] = [];
    for (const group of groups) {
      if (group.pins.length === 1) {
        singles.push(group.pins[0]);
        continue;
      }
      clusters.push({
        key: group.pins.map((p) => p.id).join("-"),
        pins: group.pins,
        lat: group.pins.reduce((s, p) => s + p.latitude, 0) / group.pins.length,
        lng: group.pins.reduce((s, p) => s + p.longitude, 0) / group.pins.length,
      });
    }
    return { singles, clusters };
  }, [map, pins, activeId, enabled, zoom]);
}

function Pins({
  pins,
  activeId,
  onPinClick,
  renderPopup,
  cluster,
}: {
  pins: MapPin[];
  activeId?: number | null;
  onPinClick?: (id: number) => void;
  renderPopup?: (id: number) => ReactNode;
  cluster: boolean;
}) {
  const map = useMap();
  const { singles, clusters } = useClusters(pins, activeId, cluster);
  return (
    <>
      {clusters.map((c) => {
        const prices = c.pins.map((p) => p.label).filter((label) => /^\d+k$/.test(label));
        const cheapest = prices.length ? `từ ${prices.sort((a, b) => parseInt(a) - parseInt(b))[0]}` : "sân";
        return (
          <Marker
            key={c.key}
            position={[c.lat, c.lng]}
            icon={clusterIcon(c.pins.length, cheapest)}
            title={`${c.pins.length} sân - bấm để phóng to`}
            eventHandlers={{
              click: () => map.fitBounds(L.latLngBounds(c.pins.map((p) => [p.latitude, p.longitude])), { padding: [64, 64], maxZoom: CLUSTER_MAX_ZOOM }),
            }}
          />
        );
      })}
      {singles.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.latitude, pin.longitude]}
          icon={priceIcon(pin, pin.id === activeId)}
          title={pin.title}
          zIndexOffset={pin.id === activeId ? 1000 : 0}
          eventHandlers={onPinClick ? { click: () => onPinClick(pin.id) } : undefined}
        >
          {renderPopup ? (
            <Popup minWidth={240} maxWidth={280} autoPanPadding={[24, 24]}>
              {renderPopup(pin.id)}
            </Popup>
          ) : null}
        </Marker>
      ))}
    </>
  );
}

interface Props {
  pins: MapPin[];
  activeId?: number | null;
  me?: [number, number] | null;
  onPinClick?: (id: number) => void;
  /** Có hàm này thì bản đồ ở chế độ chọn vị trí. */
  onPick?: (lat: number, lng: number) => void;
  /** Lớp CSS của khung bản đồ; cần có position (relative/absolute) để đặt các nút phủ lên. */
  className?: string;
  /** Nội dung thẻ xem nhanh khi bấm vào một sân. */
  renderPopup?: (id: number) => ReactNode;
  /** Đổi giá trị này để bản đồ tự canh lại theo các điểm (mặc định: mỗi khi danh sách điểm đổi). */
  fitKey?: unknown;
  /** Người dùng tự kéo/zoom bản đồ: trả về vùng đang xem. */
  onUserMove?: (bounds: Bounds) => void;
  /** Hiện nút định vị trên bản đồ. */
  onLocate?: () => void;
  locating?: boolean;
  /** Lia bản đồ tới sân đang chọn nếu nó nằm ngoài khung nhìn. */
  followActive?: boolean;
  /** Gom cụm khi có nhiều sân. */
  cluster?: boolean;
  /** Nội dung phủ lên bản đồ (ví dụ nút "Tìm trong khu vực này"). */
  overlay?: ReactNode;
}

export default function LeafletMap({
  pins,
  activeId,
  me,
  onPinClick,
  onPick,
  className = "relative h-full w-full",
  renderPopup,
  fitKey,
  onUserMove,
  onLocate,
  locating,
  followActive,
  cluster = false,
  overlay,
}: Props) {
  const activePin = followActive ? pins.find((p) => p.id === activeId) : undefined;
  return (
    <div className={className}>
      <MapContainer center={DA_NANG_CENTER} zoom={13} className="h-full w-full" scrollWheelZoom>
        {/* Nền bản đồ, ghi nguồn OpenStreetMap theo giấy phép ODbL */}
        <BaseLayer />
        <InvalidateOnResize />
        <FitBounds pins={pins} me={me} fitKey={fitKey} />
        {onPick ? <ClickToPick onPick={onPick} /> : null}
        {onUserMove ? <UserMoveWatcher onUserMove={onUserMove} /> : null}
        {followActive ? <FollowActive pin={activePin} /> : null}
        {me ? <Marker position={me} icon={meIcon} interactive={false} /> : null}
        <Pins pins={pins} activeId={activeId} onPinClick={onPinClick} renderPopup={renderPopup} cluster={cluster} />
      </MapContainer>
      {onLocate ? (
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          aria-label="Định vị tôi trên bản đồ"
          title="Vị trí của tôi"
          className="absolute right-3 top-3 z-[1000] flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg shadow-md hover:bg-slate-50 disabled:opacity-60"
        >
          {locating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-700 border-t-transparent" /> : "◎"}
        </button>
      ) : null}
      {overlay}
    </div>
  );
}
