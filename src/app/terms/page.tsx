import Link from "next/link";

export const metadata = { title: "Điều khoản sử dụng - Cầu Lông Đà Nẵng", description: "Quy định khi đặt sân, thanh toán, hủy lượt đặt và đánh giá sân trên Cầu Lông Đà Nẵng." };
// Trang tĩnh (CDN trả ngay).
export const dynamic = "error";

const H2 = "text-base font-bold text-slate-900";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-6 py-10 text-sm leading-relaxed text-slate-700">
      <h1 className="text-2xl font-extrabold text-slate-900">Điều khoản sử dụng</h1>
      <p>
        Website Cầu Lông Đà Nẵng là sản phẩm đồ án tốt nghiệp, kết nối người chơi với các sân cầu lông tại Đà Nẵng. Khi đăng ký và sử dụng website, bạn đồng ý
        với các điều khoản dưới đây.
      </p>

      <h2 className={H2}>1. Tài khoản</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Bạn chịu trách nhiệm về thông tin đăng ký (họ tên, email, số điện thoại) và giữ bí mật mật khẩu.</li>
        <li>Quên mật khẩu, bạn dùng chức năng &ldquo;Quên mật khẩu&rdquo; ở trang đăng nhập để nhận liên kết đặt lại qua email.</li>
        <li>Quản trị viên có thể khóa tài khoản vi phạm (đặt giữ chỗ ảo nhiều lần, đánh giá sai sự thật, giả mạo chủ sân).</li>
      </ul>

      <h2 className={H2}>2. Đặt sân và thanh toán</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Khi chọn khung giờ, hệ thống giữ chỗ cho bạn trong thời gian chủ sân quy định. Hết thời gian mà chưa báo đã chuyển khoản thì chỗ được trả lại.</li>
        <li>Bạn chuyển khoản trực tiếp vào tài khoản của chủ sân (mã QR có sẵn số tiền và nội dung). Website không giữ tiền của bạn.</li>
        <li>Lượt đặt chỉ chắc chắn khi chủ sân xác nhận đã nhận tiền; bạn sẽ nhận được thông báo và email xác nhận.</li>
        <li>Mọi tranh chấp về tiền, hoàn tiền, đổi giờ được giải quyết trực tiếp giữa người chơi và chủ sân.</li>
      </ul>

      <h2 className={H2}>3. Hủy lượt đặt</h2>
      <p>
        Bạn tự hủy được lượt đặt trước giờ chơi. Nếu đã chuyển khoản, việc hoàn tiền do bạn và chủ sân thỏa thuận; hãy liên hệ chủ sân theo số điện thoại ở
        trang chi tiết lượt đặt.
      </p>

      <h2 className={H2}>4. Đánh giá sân</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Mỗi lượt đặt đã được chủ sân xác nhận được đánh giá một lần, sửa được trong 24 giờ kể từ lúc xác nhận.</li>
        <li>Bạn có thể ẩn tên khi đánh giá. Nội dung xúc phạm, quảng cáo, sai sự thật có thể bị quản trị viên ẩn.</li>
      </ul>

      <h2 className={H2}>5. Chủ sân</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Sân chỉ hiện công khai sau khi quản trị viên duyệt. Chủ sân chịu trách nhiệm về thông tin sân, bảng giá và tài khoản nhận tiền.</li>
        <li>Chủ sân phải xác nhận hoặc từ chối các lượt đã báo chuyển khoản kịp thời và giữ đúng lịch đã xác nhận.</li>
      </ul>

      <h2 className={H2}>6. Dữ liệu cá nhân</h2>
      <p>
        Cách chúng tôi thu thập và xử lý dữ liệu được nêu trong{" "}
        <Link href="/privacy" className="font-semibold text-brand-700">
          Thông báo xử lý dữ liệu cá nhân
        </Link>
        . Câu hỏi khác, xem trang{" "}
        <Link href="/contact" className="font-semibold text-brand-700">
          Liên hệ
        </Link>
        .
      </p>
    </article>
  );
}
