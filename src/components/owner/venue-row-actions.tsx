"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteVenueAction, toggleSuspendAction } from "@/app/owner/actions";
import { buttonClass } from "@/components/ui/controls";
import type { VenueStatus } from "@/lib/types";

/** Nút Tạm ngừng / Mở lại / Xóa sân trong danh sách sân: hỏi xác nhận trước, hiện kết quả hoặc lỗi ngay dưới nút. */
export function VenueRowActions({ id, name, status, canDelete }: { id: number; name: string; status: VenueStatus; canDelete: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const canToggle = status === "approved" || status === "suspended";
  const suspend = status === "approved";

  function toggle() {
    const question = suspend
      ? `Tạm ngừng sân “${name}”?\n\nNgười chơi sẽ không thấy và không đặt được sân. Các lượt đã đặt vẫn giữ nguyên.`
      : `Mở lại sân “${name}” để người chơi đặt được?`;
    if (!window.confirm(question)) return;
    startTransition(async () => {
      const result = await toggleSuspendAction(id, suspend);
      setMessage(result.error ? { tone: "error", text: result.error } : { tone: "success", text: result.success ?? "Đã cập nhật." });
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Xóa hẳn sân “${name}”?\n\nThông tin, bảng giá, ảnh của sân bị xóa và không khôi phục được.`)) return;
    startTransition(async () => {
      const result = await deleteVenueAction(id);
      if (result.error) setMessage({ tone: "error", text: result.error });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        {canToggle ? (
          <button type="button" onClick={toggle} disabled={pending} className={buttonClass(suspend ? "danger" : "outline", "h-8 px-3 text-xs")}>
            {pending ? "Đang lưu..." : suspend ? "Tạm ngừng" : "Mở lại"}
          </button>
        ) : null}
        {canDelete ? (
          <button type="button" onClick={remove} disabled={pending} className={buttonClass("danger", "h-8 px-3 text-xs")} title="Chỉ xóa được sân chưa có lượt đặt nào">
            Xóa
          </button>
        ) : null}
      </div>
      {message ? (
        <span role={message.tone === "error" ? "alert" : "status"} className={`max-w-64 text-right text-xs ${message.tone === "error" ? "text-red-600" : "text-brand-700"}`}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
