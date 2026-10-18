"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { BOOKING_RULES } from "@/lib/constants";
import { addDays, formatVnd } from "@/lib/format";
import { imageUrl } from "@/lib/supabase/env";
import type { VenueCard, Ward } from "@/lib/types";
import {
  type Bounds,
  directionsUrl,
  EMPTY_FILTER,
  filterToApiParams,
  filterToSearch,
  inBounds,
  motorbikeMinutes,
  nextHourSlot,
  PRICE_RANGES,
  sameFilter,
  type SearchFilter,
  SORT_OPTIONS,
  type SortKey,
  sortVenues,
  tonightSlot,
} from "@/lib/venue-filter";
import { Map } from "./map/map";
import { Alert, Button, buttonClass, Chip, CourtPlaceholder, inputClass } from "./ui/controls";

/** "50000" -> "50k" cho nhãn trên bản đồ. */
const shortPrice = (price: number | null) => (price === null ? "Sân" : `${Math.round(price / 1000)}k`);
const formatKm = (km: number) => `${km.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;

const HOURS = Array.from({ length: 19 }, (_, i) => `${String(i + 5).padStart(2, "0")}:00`);
/** Chờ người dùng gõ xong từ khóa rồi mới tìm (ms). */
const TYPING_DELAY = 350;
const CHEAP_PRICE = "0-100000";

/** Nút lọc nhanh dạng chip, bấm lần nữa để bỏ. */
function QuickChip({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 flex-none items-center gap-1 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-60 ${
        active ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-brand-700 hover:text-brand-700"
      }`}
    >
      {children}
      {active ? <span aria-hidden>✕</span> : null}
    </button>
  );
}

export function HomeExplorer({
  initialVenues,
  initialFilter = EMPTY_FILTER,
  wards,
  today,
  currentHour,
}: {
  initialVenues: VenueCard[];
  initialFilter?: SearchFilter;
  wards: Ward[];
  today: string;
  currentHour: number;
}) {
  const [venues, setVenues] = useState(initialVenues);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState(initialFilter);
  /** Bộ lọc đang áp dụng cho danh sách (khác với bộ lọc đang nhập dở). */
  const [applied, setApplied] = useState(initialFilter);
  const [sort, setSort] = useState<SortKey>("relevance");
  /** Vùng bản đồ đang dùng để lọc danh sách ("Tìm trong khu vực này"). */
  const [area, setArea] = useState<Bounds | null>(null);
  /** Vùng người dùng vừa kéo bản đồ tới, chờ bấm "Tìm trong khu vực này". */
  const [viewport, setViewport] = useState<Bounds | null>(null);
  /** Tăng lên khi có kết quả mới để bản đồ canh lại theo các sân. */
  const [fitKey, setFitKey] = useState(0);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  /** Chỉ nhận kết quả của lần tìm mới nhất (gõ nhanh có thể sinh nhiều yêu cầu chồng nhau). */
  const requestId = useRef(0);
  const pending = useRef<SearchFilter | null>(null);

  const tonight = tonightSlot(today, currentHour);
  const nextHour = nextHourSlot(today, currentHour);

  const shown = useMemo(() => sortVenues(area ? venues.filter((v) => inBounds(v, area)) : venues, sort), [venues, area, sort]);
  const pins = useMemo(
    () =>
      shown.map((v) => ({
        id: v.id,
        latitude: v.latitude,
        longitude: v.longitude,
        label: shortPrice(v.min_price),
        title: v.name,
        badge: v.free_courts !== null && v.free_courts !== undefined ? `${v.free_courts}/${v.court_count}` : undefined,
      })),
    [shown],
  );
  const filtering = Object.values(applied).some(Boolean);
  const set = (key: keyof SearchFilter) => (e: { target: { value: string } }) => setFilter({ ...filter, [key]: e.target.value });

  // PB12, PB13 - Gọi API tìm kiếm với bộ lọc và (nếu có) vị trí người dùng
  async function load(next: SearchFilter, position: [number, number] | null) {
    if (Boolean(next.date) !== Boolean(next.startTime)) {
      setNotice("Hãy chọn cả ngày và giờ để lọc sân còn trống.");
      return false;
    }
    const id = ++requestId.current;
    pending.current = next;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/venues?${filterToApiParams(next, position)}`);
      const body = await res.json();
      if (id !== requestId.current) return false;
      if (!res.ok) {
        setNotice(body.message ?? "Không tải được danh sách sân.");
        return false;
      }
      setVenues(body.data.venues);
      setApplied(next);
      setActiveId(null);
      setArea(null);
      setViewport(null);
      setFitKey((k) => k + 1);
      // Giữ bộ lọc trên URL để chia sẻ hoặc quay lại trang vẫn thấy đúng kết quả
      window.history.replaceState(null, "", `${window.location.pathname}${filterToSearch(next)}`);
      return true;
    } catch {
      if (id === requestId.current) setNotice("Không tải được danh sách sân. Vui lòng thử lại.");
      return false;
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        pending.current = null;
      }
    }
  }

  /** Đổi bộ lọc và tìm ngay (chip lọc nhanh, gợi ý nới điều kiện). */
  function apply(next: SearchFilter) {
    setFilter(next);
    void load(next, me);
  }

  // Tìm ngay khi đổi bộ lọc, không cần bấm "Tìm sân"; với ô từ khóa thì chờ gõ xong
  useEffect(() => {
    if (sameFilter(filter, pending.current ?? applied)) return;
    if (Boolean(filter.date) !== Boolean(filter.startTime)) return;
    const timer = setTimeout(() => void load(filter, me), filter.q.trim() !== applied.q.trim() ? TYPING_DELAY : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, applied]);

  function clearFilter() {
    setSort("relevance");
    apply(EMPTY_FILTER);
  }

  // PB10 - Tìm sân gần vị trí hiện tại
  function findNearMe() {
    if (!("geolocation" in navigator)) {
      setNotice("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const point: [number, number] = [position.coords.latitude, position.coords.longitude];
        if (await load(applied, point)) {
          setMe(point);
          setSort("distance");
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        setNotice("Bạn chưa cho phép truy cập vị trí. Hãy bật quyền vị trí cho trang này trong trình duyệt để sắp xếp sân theo khoảng cách.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function stopNearMe() {
    if (await load(applied, null)) {
      setMe(null);
      if (sort === "distance") setSort("relevance");
    }
  }

  /** Bật/tắt một khung giờ lọc nhanh. */
  const toggleSlot = (slot: { date: string; startTime: string }) =>
    apply(applied.date === slot.date && applied.startTime === slot.startTime ? { ...filter, date: "", startTime: "" } : { ...filter, ...slot });
  const isSlot = (slot: { date: string; startTime: string }) => applied.date === slot.date && applied.startTime === slot.startTime;

  /** Bấm vào sân trên bản đồ: đánh dấu và cuộn danh sách tới sân đó. */
  function selectFromMap(id: number) {
    setActiveId(id);
    document.getElementById(`venue-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const venueHref = (id: number) => (applied.date ? `/venues/${id}?date=${applied.date}${applied.startTime ? `&time=${applied.startTime}` : ""}` : `/venues/${id}`);

  /** Thẻ xem nhanh trên bản đồ: đủ thông tin để quyết định mà không phải rời trang. */
  function renderPopup(id: number) {
    const v = venues.find((x) => x.id === id);
    if (!v) return null;
    const thumb = imageUrl(v.thumbnail);
    return (
      <div className="flex flex-col gap-2 text-slate-900">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-24 w-full rounded-lg object-cover" />
        ) : null}
        <div>
          <p className="m-0! text-sm font-bold leading-snug">{v.name}</p>
          <p className="m-0! mt-0.5! text-xs text-slate-500">{v.address}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="green">{v.min_price === null ? "Chưa có giá" : `Từ ${formatVnd(v.min_price)}/giờ`}</Chip>
          {v.free_courts !== null && v.free_courts !== undefined ? (
            <Chip tone="blue">
              Còn {v.free_courts}/{v.court_count} sân lúc {applied.startTime}
            </Chip>
          ) : (
            <Chip>{v.court_count} sân</Chip>
          )}
          {v.distance_km !== null && v.distance_km !== undefined ? (
            <Chip>
              {formatKm(v.distance_km)} · ≈ {motorbikeMinutes(v.distance_km)} phút xe máy
            </Chip>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href={venueHref(v.id)} className={buttonClass("primary", "h-9 px-2 text-xs text-white!")}>
            Xem & đặt sân
          </Link>
          <a href={directionsUrl(v.latitude, v.longitude)} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "h-9 px-2 text-xs text-slate-900!")}>
            Chỉ đường ↗
          </a>
        </div>
      </div>
    );
  }

  /** Gợi ý nới từng điều kiện khi không có kết quả. */
  const relaxOptions = [
    applied.startTime ? { label: "Bỏ lọc giờ", next: { ...applied, date: "", startTime: "" } } : null,
    applied.price ? { label: "Mọi mức giá", next: { ...applied, price: "" } } : null,
    applied.wardId ? { label: "Mọi phường, xã", next: { ...applied, wardId: "" } } : null,
    applied.q ? { label: `Bỏ từ khóa "${applied.q}"`, next: { ...applied, q: "" } } : null,
  ].filter((x) => x !== null);

  const mapOverlay = (
    <>
      {viewport ? (
        <button
          type="button"
          onClick={() => {
            setArea(viewport);
            setViewport(null);
            setActiveId(null);
          }}
          className="absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-md hover:bg-brand-50"
        >
          🔍 Tìm trong khu vực này
        </button>
      ) : null}
      {loading ? (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white">
          Đang cập nhật...
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-none lg:flex-row lg:overflow-hidden">
      {/* Điện thoại: chuyển giữa danh sách và bản đồ thay vì cuộn qua danh sách dài mới tới bản đồ */}
      <div className="sticky top-0 z-[1100] flex gap-1 border-b border-slate-200 bg-white p-2 lg:hidden" role="tablist" aria-label="Kiểu xem">
        {(["list", "map"] as const).map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={mobileView === view}
            onClick={() => {
              setMobileView(view);
              if (view === "map") setFitKey((k) => k + 1);
            }}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold ${mobileView === view ? "bg-brand-700 text-white" : "text-slate-600"}`}
          >
            {view === "list" ? `☰ Danh sách (${shown.length})` : "🗺 Bản đồ"}
          </button>
        ))}
      </div>

      <section className={`w-full flex-col gap-3 p-4 lg:flex lg:w-[480px] lg:overflow-y-auto ${mobileView === "list" ? "flex" : "hidden"}`}>
        <form
          role="search"
          aria-label="Tìm và lọc sân"
          className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void load(filter, me);
          }}
        >
          <input
            type="search"
            name="q"
            aria-label="Từ khóa"
            placeholder="Tên sân hoặc địa chỉ (gõ không dấu cũng được)"
            className={`${inputClass} col-span-2`}
            value={filter.q}
            maxLength={100}
            onChange={set("q")}
            autoComplete="off"
          />
          <select name="ward_id" aria-label="Phường, xã" className={inputClass} value={filter.wardId} onChange={set("wardId")}>
            <option value="">Mọi phường, xã</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select name="price" aria-label="Khoảng giá" className={inputClass} value={filter.price} onChange={set("price")}>
            {PRICE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="date"
            aria-label="Ngày chơi"
            className={inputClass}
            value={filter.date}
            min={today}
            max={addDays(today, BOOKING_RULES.advance_days.max)}
            onChange={set("date")}
          />
          <select name="start_time" aria-label="Giờ bắt đầu" className={inputClass} value={filter.startTime} onChange={set("startTime")}>
            <option value="">Giờ bất kỳ</option>
            {HOURS.map((h) => (
              <option key={h} value={h} disabled={filter.date === today && Number(h.slice(0, 2)) <= currentHour}>
                Còn trống lúc {h}
              </option>
            ))}
          </select>
          {Boolean(filter.date) !== Boolean(filter.startTime) ? (
            <p className="col-span-2 text-xs text-orange-700">Chọn thêm {filter.date ? "giờ" : "ngày"} để lọc sân còn trống.</p>
          ) : null}
          <Button type="submit" className="col-span-2" disabled={loading}>
            {loading ? "Đang tìm..." : "Tìm sân"}
          </Button>
        </form>

        {/* Lọc nhanh bằng một chạm, theo các câu hỏi hay gặp nhất của người chơi */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Lọc nhanh">
          <QuickChip active={me !== null} onClick={me ? () => void stopNearMe() : findNearMe} disabled={locating}>
            📍 {locating ? "Đang định vị..." : "Gần tôi"}
          </QuickChip>
          <QuickChip active={isSlot(tonight)} onClick={() => toggleSlot(tonight)}>
            🌙 {tonight.label}
          </QuickChip>
          <QuickChip active={isSlot(nextHour)} onClick={() => toggleSlot(nextHour)}>
            ⏱ {nextHour.label}
          </QuickChip>
          <QuickChip active={applied.price === CHEAP_PRICE} onClick={() => apply({ ...filter, price: applied.price === CHEAP_PRICE ? "" : CHEAP_PRICE })}>
            💸 Dưới 100k/giờ
          </QuickChip>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <b data-testid="venue-count" aria-live="polite">
            {shown.length} sân
          </b>
          {me ? <Chip tone="blue">Gần bạn trong 50 km</Chip> : null}
          {area ? (
            <button type="button" onClick={() => setArea(null)} className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-100 px-2.5 text-xs font-semibold text-amber-800">
              Trong khu vực bản đồ <span aria-hidden>✕</span>
            </button>
          ) : null}
          {filtering ? (
            <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={clearFilter}>
              Xóa lọc
            </button>
          ) : null}
          <span className="flex-1" />
          <select
            name="sort"
            aria-label="Sắp xếp"
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
            value={sort}
            onChange={(e) => {
              const next = e.target.value as SortKey;
              if (next === "distance" && !me) findNearMe();
              else setSort(next);
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} disabled={o.value === "free" && !applied.startTime}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {notice ? <Alert tone="info">{notice}</Alert> : null}
        {venues.length === 0 && !notice ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500" data-testid="no-result">
            <p>
              {filtering || me
                ? "Không có sân phù hợp. Hãy thử bỏ bớt điều kiện lọc, đổi khung giờ hoặc chọn phường, xã khác."
                : "Chưa có sân nào được duyệt."}
            </p>
            {relaxOptions.length > 0 ? (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {relaxOptions.map((o) => (
                  <button key={o.label} type="button" onClick={() => apply(o.next)} className="rounded-full border border-brand-700 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                    {o.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {venues.length > 0 && shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            <p>Không có sân nào trong khu vực bản đồ đang xem.</p>
            <button type="button" onClick={() => setArea(null)} className="mt-3 rounded-full border border-brand-700 px-3 py-1 text-xs font-semibold text-brand-700">
              Xem tất cả {venues.length} sân
            </button>
          </div>
        ) : null}
        <ul className={`flex flex-col gap-2.5 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          {shown.map((v) => {
            const thumb = imageUrl(v.thumbnail);
            return (
              <li key={v.id} id={`venue-${v.id}`} className="scroll-mt-16">
                <Link
                  href={venueHref(v.id)}
                  onMouseEnter={() => setActiveId(v.id)}
                  onFocus={() => setActiveId(v.id)}
                  className={`flex gap-3 rounded-xl border bg-white p-3 transition hover:border-amber-400 ${
                    activeId === v.id ? "border-amber-400 ring-2 ring-amber-200" : "border-slate-200"
                  }`}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" loading="lazy" className="h-[72px] w-[92px] flex-none rounded-lg object-cover" />
                  ) : (
                    <CourtPlaceholder className="h-[72px] w-[92px] flex-none" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold">{v.name}</h3>
                    <p className="mb-2 mt-0.5 truncate text-xs text-slate-500">{v.address}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {v.distance_km !== null && v.distance_km !== undefined ? (
                        <Chip tone="blue">
                          {formatKm(v.distance_km)} · ≈ {motorbikeMinutes(v.distance_km)} phút
                        </Chip>
                      ) : null}
                      {v.free_courts !== null && v.free_courts !== undefined ? (
                        <Chip tone="green">
                          Còn {v.free_courts}/{v.court_count} sân lúc {applied.startTime}
                        </Chip>
                      ) : (
                        <Chip>{v.court_count} sân</Chip>
                      )}
                      <Chip>{v.ward_name}</Chip>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-brand-700">{formatVnd(v.min_price)}</div>
                    <div className="text-xs text-slate-500">từ /giờ</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <section className={`relative h-[calc(100dvh-7rem)] flex-1 lg:block lg:h-auto ${mobileView === "map" ? "block" : "hidden"}`} aria-label="Bản đồ sân">
        {/* Phủ kín khung: chiều cao % trong flex item không ổn định trên điện thoại */}
        <Map
          className="absolute inset-0"
          pins={pins}
          activeId={activeId}
          me={me}
          onPinClick={selectFromMap}
          renderPopup={renderPopup}
          fitKey={fitKey}
          onUserMove={setViewport}
          onLocate={findNearMe}
          locating={locating}
          followActive
          cluster
          overlay={mapOverlay}
        />
      </section>
    </div>
  );
}
