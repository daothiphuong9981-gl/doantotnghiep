import Link from "next/link";
import { contactInfo } from "@/lib/site";

export const metadata = { title: "Liên hệ - Cầu Lông Đà Nẵng", description: "Liên hệ ban quản trị website Cầu Lông Đà Nẵng." };
// Trang tĩnh: thông tin liên hệ đọc từ biến môi trường lúc build.
export const dynamic = "error";

export default function ContactPage() {
  const { email, phone } = contactInfo();
  return (
    <article className="mx-auto max-w-3xl space-y-5 px-6 py-10 text-sm leading-relaxed text-slate-700">
      <h1 className="text-2xl font-extrabold text-slate-900">Liên hệ</h1>
      <p>Bạn cần hỗ trợ về tài khoản, muốn báo lỗi hoặc góp ý cho website? Hãy liên hệ ban quản trị:</p>
      <dl className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-[140px_1fr]">
        {email ? (
          <>
            <dt className="font-semibold text-slate-900">Email</dt>
            <dd>
              <a href={`mailto:${email}`} className="font-semibold text-brand-700">
                {email}
              </a>
            </dd>
          </>
        ) : null}
        {phone ? (
          <>
            <dt className="font-semibold text-slate-900">Điện thoại</dt>
            <dd>
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-brand-700">
                {phone}
              </a>
            </dd>
          </>
        ) : null}
        <dt className="font-semibold text-slate-900">Khu vực</dt>
        <dd>Thành phố Đà Nẵng</dd>
      </dl>

      <h2 className="text-base font-bold text-slate-900">Câu hỏi thường gặp</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <b>Quên mật khẩu?</b> Vào{" "}
          <Link href="/forgot-password" className="font-semibold text-brand-700">
            Quên mật khẩu
          </Link>{" "}
          và nhập email đã đăng ký để nhận liên kết đặt lại.
        </li>
        <li>
          <b>Về lượt đặt, giờ chơi, hoàn tiền:</b> liên hệ trực tiếp chủ sân theo số điện thoại ở trang chi tiết lượt đặt (mục Lượt đặt của tôi).
        </li>
        <li>
          <b>Muốn đưa sân của bạn lên website?</b>{" "}
          <Link href="/register" className="font-semibold text-brand-700">
            Đăng ký
          </Link>{" "}
          tài khoản Chủ sân, thêm sân và chờ quản trị viên duyệt.
        </li>
      </ul>
    </article>
  );
}
