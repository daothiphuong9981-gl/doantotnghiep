"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui/controls";

/**
 * Trang báo lỗi chung (Next.js 16: prop `retry` thay cho `reset`). Không hiện chi tiết lỗi máy chủ cho người dùng;
 * chỉ hiện mã tra cứu (digest) để đối chiếu với nhật ký trên Vercel.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
      <h1 className="text-2xl font-extrabold">Đã có lỗi xảy ra</h1>
      <p className="max-w-md text-sm text-slate-500">
        Hệ thống tạm thời không tải được trang này. Bạn thử lại sau ít phút; nếu vẫn lỗi, hãy liên hệ chúng tôi kèm mã tra cứu bên dưới.
      </p>
      {digest ? <p className="font-mono text-xs text-slate-400">Mã tra cứu: {digest}</p> : null}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className={buttonClass("primary")}>
          Thử lại
        </button>
        <Link href="/" className={buttonClass("outline")}>
          Về trang chủ
        </Link>
        <Link href="/contact" className={buttonClass("outline")}>
          Liên hệ
        </Link>
      </div>
    </div>
  );
}
