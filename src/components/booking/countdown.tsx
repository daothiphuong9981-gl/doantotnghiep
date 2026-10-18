"use client";

import { useEffect, useRef, useState } from "react";
import { formatCountdown } from "@/lib/format";

/**
 * Số giây còn lại đến hạn giữ chỗ. Mốc ban đầu tính bằng giờ máy chủ, sau đó đếm bằng đồng hồ
 * đơn điệu của trình duyệt (performance.now) nên không phụ thuộc đồng hồ máy người dùng.
 */
export function useCountdown(expiresAt: string, serverTime: string, onExpire?: () => void): number {
  const initial = Math.max(0, (new Date(expiresAt).getTime() - new Date(serverTime).getTime()) / 1000);
  const [left, setLeft] = useState(initial);
  const fired = useRef(false);
  const callback = useRef(onExpire);
  useEffect(() => {
    callback.current = onExpire;
  });
  useEffect(() => {
    const startedAt = performance.now();
    fired.current = false;
    const tick = () => {
      const remaining = Math.max(0, initial - (performance.now() - startedAt) / 1000);
      setLeft(remaining);
      if (remaining <= 0 && !fired.current) {
        fired.current = true;
        callback.current?.();
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [initial]);
  return left;
}

/** Nhãn đếm ngược gọn, dùng trong danh sách. */
export function Countdown({ expiresAt, serverTime }: { expiresAt: string; serverTime: string }) {
  const left = useCountdown(expiresAt, serverTime);
  return <span className="tabular-nums">{left > 0 ? `còn ${formatCountdown(left)}` : "đã hết giờ"}</span>;
}
