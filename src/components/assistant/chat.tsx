"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Map } from "@/components/map/map";
import { Alert, Button, buttonClass, Chip, inputClass } from "@/components/ui/controls";
import type { AiFilter } from "@/lib/ai/filter";
import { describeDate, formatVnd } from "@/lib/format";
import type { AssistantVenue } from "@/lib/services/assistant";

interface Message {
  id: number;
  from: "user" | "ai";
  text: string;
  venues?: AssistantVenue[];
  filter?: AiFilter | null;
  fallback?: boolean;
}

const EXAMPLES = ["Tìm sân ở Hải Châu tối thứ bảy này dưới 80 nghìn một giờ", "Sân nào gần tôi còn trống sáng mai?", "Sân ở Sơn Trà giá rẻ"];
const shortPrice = (price: number | null) => (price === null ? "Sân" : `${Math.round(price / 1000)}k`);

/** Đường dẫn tới trang sân, kèm ngày và giờ trợ lý đã tìm để người chơi đặt ngay. */
function venueHref(venue: AssistantVenue, filter: AiFilter | null | undefined) {
  const params = new URLSearchParams();
  if (filter?.date) params.set("date", filter.date);
  if (filter?.date && venue.free_hours[0]) params.set("time", venue.free_hours[0]);
  const query = params.toString();
  return `/venues/${venue.id}${query ? `?${query}` : ""}`;
}

/** Các điều kiện của bộ lọc ở dạng nhãn; mỗi nhãn bỏ được. */
function filterChips(f: AiFilter): { key: string; label: string; clear: Partial<AiFilter> }[] {
  const chips: { key: string; label: string; clear: Partial<AiFilter> }[] = [];
  if (f.keyword) chips.push({ key: "keyword", label: `Từ khóa: ${f.keyword}`, clear: { keyword: null } });
  if (f.ward_name) chips.push({ key: "ward", label: f.ward_name, clear: { ward_id: null, ward_name: null } });
  if (f.near_me) chips.push({ key: "near", label: `Gần tôi${f.radius_km ? ` (${f.radius_km} km)` : ""}`, clear: { near_me: false, radius_km: null } });
  if (f.date) chips.push({ key: "date", label: describeDate(f.date).full, clear: { date: null, time_from: null, time_to: null } });
  if (f.time_from && f.time_to) chips.push({ key: "time", label: `${f.time_from} – ${f.time_to}`, clear: { time_from: null, time_to: null } });
  if (f.min_price) chips.push({ key: "min", label: `Từ ${formatVnd(f.min_price)}`, clear: { min_price: null } });
  if (f.max_price) chips.push({ key: "max", label: `Đến ${formatVnd(f.max_price)}`, clear: { max_price: null } });
  return chips;
}

/** PB25 - Khung trò chuyện với trợ lý AI; sân gợi ý hiện dạng thẻ và nổi bật trên bản đồ. */
export function AssistantChat({ dailyLimit }: { dailyLimit: number }) {
  const router = useRouter();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limited, setLimited] = useState(false);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  /** Kết quả đang hiện trên bản đồ và bộ lọc tương ứng (sửa được bằng cách bỏ từng điều kiện) */
  const [shown, setShown] = useState<{ filter: AiFilter | null; venues: AssistantVenue[] }>({ filter: null, venues: [] });
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const pins = useMemo(
    () => shown.venues.map((v) => ({ id: v.id, latitude: v.latitude, longitude: v.longitude, label: shortPrice(v.min_price), title: v.name })),
    [shown.venues],
  );
  const push = (message: Omit<Message, "id">) => setMessages((list) => [...list, { ...message, id: nextId.current++ }]);

  async function ask(question: string) {
    const message = question.trim();
    if (!message || busy) return;
    setText("");
    setNotice(null);
    push({ from: "user", text: message });
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message, ...(me ? { lat: me[0], lng: me[1] } : {}) }),
      });
      const body = await res.json();
      if (res.status === 401) {
        router.push("/login?next=/assistant");
        return;
      }
      if (res.status === 429) {
        setLimited(true);
        setRemaining(0);
        push({ from: "ai", text: body.message, fallback: true });
        return;
      }
      if (!res.ok) {
        push({ from: "ai", text: body.message ?? "Có lỗi xảy ra. Bạn thử lại hoặc dùng bộ lọc thường ở trang chủ nhé.", fallback: true });
        return;
      }
      const data = body.data;
      setRemaining(data.remaining);
      push({ from: "ai", text: data.reply, venues: data.venues, filter: data.filter, fallback: data.fallback });
      if (data.filter) setShown({ filter: data.filter, venues: data.venues });
      setActiveId(data.venues[0]?.id ?? null);
    } catch {
      push({ from: "ai", text: "Không kết nối được máy chủ. Bạn thử lại hoặc dùng bộ lọc thường ở trang chủ nhé.", fallback: true });
    } finally {
      setBusy(false);
    }
  }

  /** Bỏ một điều kiện AI đã hiểu rồi tìm lại bằng bộ lọc thường (không tốn lượt hỏi AI). */
  async function removeCondition(clear: Partial<AiFilter>) {
    if (!shown.filter) return;
    const filter = { ...shown.filter, ...clear };
    const params = new URLSearchParams();
    if (filter.keyword) params.set("q", filter.keyword);
    if (filter.ward_id) params.set("ward_id", String(filter.ward_id));
    if (filter.min_price) params.set("min_price", String(filter.min_price));
    if (filter.max_price) params.set("max_price", String(filter.max_price));
    if (filter.date && filter.time_from) {
      params.set("date", filter.date);
      params.set("start_time", filter.time_from);
    }
    if (filter.near_me && me) {
      params.set("lat", String(me[0]));
      params.set("lng", String(me[1]));
      params.set("radius_km", String(filter.radius_km ?? 10));
    }
    try {
      const res = await fetch(`/api/venues?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      const venues: AssistantVenue[] = body.data.venues
        .slice(0, 5)
        .map((v: AssistantVenue) => ({ ...v, free_hours: filter.date && filter.time_from && v.free_courts ? [filter.time_from] : [] }));
      setShown({ filter, venues });
      setActiveId(venues[0]?.id ?? null);
      setNotice(null);
    } catch {
      setNotice("Không tìm lại được với bộ lọc đã sửa. Vui lòng thử lại.");
    }
  }

  function toggleLocation() {
    if (me) {
      setMe(null);
      return;
    }
    if (!("geolocation" in navigator)) {
      setNotice("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMe([position.coords.latitude, position.coords.longitude]);
        setNotice(null);
      },
      () => setNotice("Bạn chưa cho phép truy cập vị trí nên trợ lý chưa tìm được sân “gần tôi”."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const chips = shown.filter ? filterChips(shown.filter) : [];

  return (
    <div className="flex flex-1 flex-col lg:h-[calc(100dvh-3.5rem)] lg:flex-none lg:flex-row lg:overflow-hidden">
      <section className="flex w-full flex-col lg:w-[520px] lg:border-r lg:border-slate-200" aria-label="Trò chuyện với trợ lý AI">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold">Trợ lý AI tìm sân</h1>
            <Chip tone="blue">AI</Chip>
            <span className="flex-1" />
            <span className="text-xs text-slate-500" data-testid="ai-remaining">
              {remaining === null ? `${dailyLimit} câu hỏi mỗi ngày` : `Còn ${remaining}/${dailyLimit} câu hỏi hôm nay`}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500" data-testid="ai-disclaimer">
            Câu trả lời do trí tuệ nhân tạo (Gemini) tạo ra và có thể chưa chính xác. Thông tin sân, giá, khung giờ trên thẻ sân lấy từ dữ liệu của hệ thống;
            hãy kiểm tra lại ở trang chi tiết sân trước khi đặt.
          </p>
        </div>

        <div className="flex min-h-64 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite" data-testid="ai-messages">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-600">Bạn muốn tìm sân thế nào? Thử một trong các câu sau:</p>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => ask(example)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-brand-700"
                >
                  {example}
                </button>
              ))}
            </div>
          ) : null}
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col gap-2 ${m.from === "user" ? "items-end" : "items-start"}`} data-from={m.from}>
              <div
                className={`max-w-[90%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${
                  m.from === "user" ? "bg-brand-700 text-white" : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                {m.text}
              </div>
              {m.fallback ? (
                <Link href="/" className={buttonClass("outline", "h-9")}>
                  Mở bộ lọc tìm sân thường
                </Link>
              ) : null}
              {m.venues?.map((v) => (
                <article
                  key={v.id}
                  onMouseEnter={() => setActiveId(v.id)}
                  className={`w-full rounded-xl border bg-white p-3 ${activeId === v.id ? "border-amber-400 ring-2 ring-amber-200" : "border-slate-200"}`}
                  data-testid="ai-venue"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold">{v.name}</h3>
                      <p className="truncate text-xs text-slate-500">
                        {v.address} · {v.ward_name}
                      </p>
                    </div>
                    <div className="text-right text-sm font-extrabold text-brand-700">
                      {formatVnd(v.min_price)}
                      <div className="text-[11px] font-normal text-slate-500">từ /giờ</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip>{v.court_count} sân</Chip>
                    {v.distance_km !== null && v.distance_km !== undefined ? <Chip>{v.distance_km.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km</Chip> : null}
                    {v.free_hours.length ? <Chip tone="green">Còn trống: {v.free_hours.join(", ")}</Chip> : null}
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <Link href={`/venues/${v.id}`} className={buttonClass("outline", "h-8 px-3 text-xs")}>
                      Xem chi tiết
                    </Link>
                    <Link href={venueHref(v, m.filter)} className={buttonClass("primary", "h-8 px-3 text-xs")}>
                      Đặt sân
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ))}
          {busy ? <div className="self-start rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-500">Trợ lý đang tìm...</div> : null}
          <div ref={endRef} />
        </div>

        {chips.length > 0 ? (
          <div className="border-t border-slate-200 bg-white px-4 py-2" data-testid="ai-filter">
            <div className="mb-1 text-xs font-semibold text-slate-600">Bộ lọc AI đã hiểu (bấm × để bỏ một điều kiện và tìm lại)</div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeCondition(chip.clear)}
                  aria-label={`Bỏ điều kiện ${chip.label}`}
                  data-chip={chip.key}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-100 px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-200"
                >
                  {chip.label} <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {notice ? (
          <div className="px-4 pb-2">
            <Alert tone="info">{notice}</Alert>
          </div>
        ) : null}

        <form
          className="flex flex-col gap-2 border-t border-slate-200 bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(text);
          }}
        >
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={text}
              maxLength={300}
              onChange={(e) => setText(e.target.value)}
              placeholder={limited ? "Đã hết lượt hỏi hôm nay" : "Ví dụ: sân ở Hải Châu tối nay dưới 80 nghìn"}
              aria-label="Câu hỏi cho trợ lý AI"
              disabled={busy || limited}
            />
            <Button type="submit" disabled={busy || limited || !text.trim()}>
              Gửi
            </Button>
          </div>
          <button type="button" onClick={toggleLocation} className="self-start text-xs font-semibold text-brand-700 hover:underline" aria-pressed={me !== null}>
            {me ? "📍 Đang dùng vị trí của bạn (bấm để tắt)" : "📍 Dùng vị trí của tôi để tìm sân gần"}
          </button>
        </form>
      </section>
      <section className="h-[55vh] flex-1 lg:h-auto" aria-label="Bản đồ các sân gợi ý">
        <Map pins={pins} activeId={activeId} me={me} onPinClick={(id) => setActiveId(id)} />
      </section>
    </div>
  );
}
