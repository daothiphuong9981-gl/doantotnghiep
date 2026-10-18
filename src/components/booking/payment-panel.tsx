"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, buttonClass, inputClass } from "@/components/ui/controls";
import { formatCountdown, formatDateTime, formatVnd } from "@/lib/format";
import type { Booking, PaymentInfo } from "@/lib/types";
import { useCountdown } from "./countdown";

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-bold" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function BankInfo({ payment }: { payment: PaymentInfo }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
      <Row label="Ngân hàng" value={payment.bank_name} testId="bank-name" />
      <Row label="Số tài khoản" value={payment.account_number} testId="bank-number" />
      <Row label="Chủ tài khoản" value={payment.account_name} testId="bank-holder" />
      <Row label="Số tiền" value={formatVnd(payment.amount)} />
      <Row label="Nội dung chuyển khoản" value={payment.content} testId="transfer-content" />
    </dl>
  );
}

/** PB17, PB18 - Khung thanh toán: đếm ngược, thông tin chuyển khoản, báo đã chuyển khoản, hủy. */
export function PaymentPanel({ booking, payment, serverTime }: { booking: Booking; payment: PaymentInfo | null; serverTime: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const holding = booking.status === "holding";
  // Hết giờ: tải lại để máy chủ chuyển lượt đặt sang "Hết hạn giữ chỗ"
  const left = useCountdown(booking.hold_expires_at, serverTime, () => holding && router.refresh());
  const timeUp = holding && left <= 0;

  async function call(kind: "pay" | "cancel") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/${kind === "pay" ? "payment-report" : "cancel"}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "pay" ? { transfer_note: note.trim() || undefined } : {}),
      });
      if (!res.ok) setError((await res.json()).message ?? "Không thực hiện được. Vui lòng thử lại.");
      setConfirmCancel(false);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(null);
    }
  }

  const cancelButton = booking.can_cancel ? (
    confirmCancel ? (
      <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="text-sm text-red-800">
          {booking.status === "holding" ? "Hủy giữ chỗ? Các khung giờ sẽ được trả lại ngay." : "Hủy lượt đặt này? Việc hoàn tiền (nếu đã chuyển khoản) do bạn và chủ sân tự thỏa thuận."}
        </p>
        <div className="flex gap-2">
          <Button variant="danger" className="h-9 flex-1" onClick={() => call("cancel")} disabled={busy !== null}>
            {busy === "cancel" ? "Đang hủy..." : "Xác nhận hủy"}
          </Button>
          <Button variant="outline" className="h-9 flex-1" onClick={() => setConfirmCancel(false)} disabled={busy !== null}>
            Không hủy
          </Button>
        </div>
      </div>
    ) : (
      <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={busy !== null}>
        {booking.status === "holding" ? "Hủy giữ chỗ" : "Hủy lượt đặt"}
      </Button>
    )
  ) : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
      {booking.status === "holding" ? (
        <>
          <div className={`rounded-lg p-3 text-center ${timeUp ? "bg-slate-100" : "bg-orange-50"}`}>
            <div className="text-xs font-semibold text-slate-600">Thời gian giữ chỗ còn lại</div>
            <div className={`text-4xl font-extrabold tabular-nums ${timeUp ? "text-slate-400" : "text-orange-600"}`} role="timer" data-testid="countdown">
              {formatCountdown(left)}
            </div>
            <div className="text-xs text-slate-500">Giữ đến {formatDateTime(booking.hold_expires_at)}</div>
          </div>
          <p className="text-sm text-slate-600">
            Chuyển khoản đúng số tiền và nội dung bên dưới, rồi bấm <b>Tôi đã chuyển khoản</b> trước khi hết giờ. Chủ sân sẽ kiểm tra và xác nhận.
          </p>
          {payment ? <BankInfo payment={payment} /> : null}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Ghi chú cho chủ sân (không bắt buộc)</span>
            <input
              className={inputClass}
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: đã chuyển từ tài khoản Nguyen Van A"
            />
          </label>
          {error ? <Alert>{error}</Alert> : null}
          {timeUp ? <Alert tone="info">Đã hết thời gian giữ chỗ. Sân đã được trả lại.</Alert> : null}
          <Button onClick={() => call("pay")} disabled={busy !== null || timeUp}>
            {busy === "pay" ? "Đang gửi..." : "Tôi đã chuyển khoản"}
          </Button>
          {timeUp ? null : cancelButton}
        </>
      ) : null}

      {booking.status === "awaiting_confirmation" ? (
        <>
          <Alert tone="info">
            Đã ghi nhận bạn báo chuyển khoản lúc {formatDateTime(booking.paid_reported_at)}. Sân vẫn được giữ cho bạn trong lúc chờ chủ sân kiểm tra và xác
            nhận.
          </Alert>
          {booking.can_cancel ? null : (
            <Alert tone="info">Đã đến giờ chơi nhưng chủ sân chưa xác nhận. Bạn sẽ nhận được thông báo khi chủ sân xử lý; cần gấp thì liên hệ trực tiếp sân.</Alert>
          )}
          {booking.transfer_note ? <p className="text-sm text-slate-600">Ghi chú của bạn: {booking.transfer_note}</p> : null}
          {payment ? <BankInfo payment={payment} /> : null}
          {error ? <Alert>{error}</Alert> : null}
          {cancelButton}
        </>
      ) : null}

      {booking.status === "confirmed" ? (
        <>
          <Alert tone="success">Chủ sân đã xác nhận nhận tiền lúc {formatDateTime(booking.confirmed_at)}. Hẹn gặp bạn tại sân.</Alert>
          {booking.is_past ? <p className="text-sm text-slate-500">Lượt đặt này đã qua giờ chơi.</p> : null}
          {error ? <Alert>{error}</Alert> : null}
          {cancelButton}
        </>
      ) : null}

      {booking.status === "expired" ? (
        <>
          <Alert tone="info">Đã hết thời gian giữ chỗ mà chưa báo thanh toán. Các khung giờ đã được trả lại để người khác đặt.</Alert>
          <Link href={`/venues/${booking.venue_id}`} className={buttonClass("primary")}>
            Đặt lại
          </Link>
        </>
      ) : null}

      {booking.status === "cancelled" ? (
        <>
          <Alert>
            {booking.cancelled_by_owner ? "Chủ sân đã hủy lượt đặt này." : "Bạn đã hủy lượt đặt này."}
            {booking.cancel_reason ? ` Lý do: ${booking.cancel_reason}` : ""}
          </Alert>
          <Link href={`/venues/${booking.venue_id}`} className={buttonClass("outline")}>
            Đặt lượt khác
          </Link>
        </>
      ) : null}
    </div>
  );
}
