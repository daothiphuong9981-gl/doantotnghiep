/**
 * Chỉ cho chuyển hướng tới đường dẫn nội bộ (sau đăng nhập, sau khi mở link trong email).
 * Chặn: "//evil.com" và "/\evil.com" (trình duyệt coi "\" như "/" nên thành địa chỉ trang khác), ký tự điều khiển
 * (tab, xuống dòng bị trình duyệt bỏ đi), đường dẫn quá dài. Không dùng thư viện nào để test được bằng node thuần.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return null;
  if (!next.startsWith("/")) return null;
  if (next[1] === "/" || next[1] === "\\") return null;
  if (next.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;
  try {
    // Kiểm tra lần cuối: phân giải trên một gốc giả, phải ra cùng gốc
    const url = new URL(next, "http://x.invalid");
    if (url.origin !== "http://x.invalid") return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
