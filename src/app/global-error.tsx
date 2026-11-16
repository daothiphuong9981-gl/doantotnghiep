"use client";

/**
 * Lỗi ngay ở root layout: thay cả trang nên phải tự có <html>/<body> và không có CSS chung (dùng style trực tiếp).
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
        <title>Đã có lỗi xảy ra - Cầu Lông Đà Nẵng</title>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Đã có lỗi xảy ra</h1>
          <p style={{ color: "#64748b", fontSize: 14, maxWidth: 420, margin: 0 }}>Hệ thống tạm thời không tải được trang. Bạn thử lại sau ít phút.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{ height: 40, padding: "0 16px", borderRadius: 8, border: "1px solid #15803d", background: "#15803d", color: "#fff", fontWeight: 600, cursor: "pointer" }}
            >
              Thử lại
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- root layout đang lỗi, tải lại hẳn trang chủ */}
            <a href="/" style={{ height: 40, lineHeight: "40px", padding: "0 16px", borderRadius: 8, border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 600, textDecoration: "none" }}>
              Về trang chủ
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
