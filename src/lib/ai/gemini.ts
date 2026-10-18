/**
 * Gọi Gemini API (REST, generateContent). Khóa API chỉ nằm ở máy chủ.
 * Biến môi trường: GEMINI_API_KEY (bắt buộc), GEMINI_MODEL, GEMINI_API_BASE (chỉ dùng khi kiểm thử).
 */
export type GeminiResult = { ok: true; text: string } | { ok: false; reason: "not_configured" | "timeout" | "http" | "empty"; status?: number };

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_BASE = "https://generativelanguage.googleapis.com";

export async function callGemini(params: {
  system: string;
  user: string;
  /** Có lược đồ thì yêu cầu đầu ra JSON có cấu trúc */
  schema?: unknown;
  timeoutMs?: number;
  maxOutputTokens?: number;
}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: "not_configured" };
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const base = (process.env.GEMINI_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
  const body = {
    systemInstruction: { parts: [{ text: params.system }] },
    contents: [{ role: "user", parts: [{ text: params.user }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: params.maxOutputTokens ?? 600,
      ...(params.schema ? { responseMimeType: "application/json", responseSchema: params.schema } : {}),
    },
  };
  if (process.env.AI_DEBUG === "1") console.info("[ai] yêu cầu gửi Gemini:", JSON.stringify(body));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: "http", status: res.status };
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    return text ? { ok: true, text } : { ok: false, reason: "empty" };
  } catch (error) {
    return { ok: false, reason: (error as Error)?.name === "AbortError" ? "timeout" : "http" };
  } finally {
    clearTimeout(timer);
  }
}

/** Đọc JSON từ văn bản mô hình trả về (chấp nhận trường hợp bị bọc trong ```json). */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(cleaned);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
