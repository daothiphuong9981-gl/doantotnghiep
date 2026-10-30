import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Gửi thư qua một hộp Gmail hệ thống (SMTP). Cấu hình:
 *   SMTP_USER  địa chỉ Gmail gửi thư
 *   SMTP_PASS  Mật khẩu ứng dụng 16 ký tự (Google Account > Bảo mật > Xác minh 2 bước > Mật khẩu ứng dụng),
 *              KHÔNG phải mật khẩu đăng nhập Gmail
 *   SMTP_HOST, SMTP_PORT  tùy chọn, mặc định smtp.gmail.com:465
 * Gmail luôn gửi từ đúng địa chỉ SMTP_USER; tên hiển thị là tên sân, trả lời thư sẽ tới email chủ sân (Reply-To).
 */
let transporter: Transporter | null = null;

export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Không đọc tệp hay URL khi dựng thư (thư chỉ có nội dung tự tạo)
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  return transporter;
}

export interface OutgoingMail {
  to: string;
  fromName: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(mail: OutgoingMail): Promise<void> {
  const fromName = mail.fromName.replace(/[\r\n"<>]+/g, " ").trim().slice(0, 80) || "Cầu Lông Đà Nẵng";
  await getTransporter().sendMail({
    from: { name: fromName, address: process.env.SMTP_USER! },
    to: mail.to,
    replyTo: mail.replyTo || undefined,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}
