import "server-only";
import { renderBookingConfirmed, type BookingEmailPayload } from "@/lib/email/booking-confirmed";
import { isMailerConfigured, sendMail } from "@/lib/email/mailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type Result } from "@/lib/types";

interface OutboxRow {
  id: number;
  kind: "booking_confirmed";
  to_email: string;
  reply_to: string | null;
  payload: BookingEmailPayload;
}

/** Địa chỉ trang web dùng trong link của thư. Vercel tự cung cấp VERCEL_PROJECT_PRODUCTION_URL. */
function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export function isEmailConfigured(): boolean {
  return isMailerConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Gửi các thư đang chờ trong email_outbox (0011). Gọi ngay sau khi chủ sân xác nhận (qua after()) và định kỳ bởi
 * /api/cron/send-emails để gửi lại thư lỗi. Mỗi thư lỗi được thử lại tối đa 5 lần.
 */
export async function processEmailOutbox(limit = 10): Promise<Result<{ sent: number; failed: number }>> {
  if (!isEmailConfigured()) return fail(503, "Chưa cấu hình gửi email (SMTP_USER, SMTP_PASS, SUPABASE_SERVICE_ROLE_KEY)");
  const admin = createAdminClient();
  if (!admin) return fail(503, "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY");

  const { data, error } = await admin.rpc("claim_email_outbox", { p_limit: limit });
  if (error) return fail(500, "Không đọc được hàng đợi email");

  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as OutboxRow[]) {
    try {
      const mail = renderBookingConfirmed(row.payload, appUrl());
      await sendMail({ to: row.to_email, replyTo: row.reply_to, fromName: row.payload.venue_name, ...mail });
      await admin.rpc("finish_email_outbox", { p_id: row.id, p_ok: true });
      sent += 1;
    } catch (e) {
      await admin.rpc("finish_email_outbox", { p_id: row.id, p_ok: false, p_error: e instanceof Error ? e.message : String(e) });
      failed += 1;
    }
  }
  return ok({ sent, failed });
}
