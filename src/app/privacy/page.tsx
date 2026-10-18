export const metadata = { title: "Thông báo xử lý dữ liệu cá nhân - Cầu Lông Đà Nẵng" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-6 py-10 text-sm leading-relaxed text-slate-700">
      <h1 className="text-2xl font-extrabold text-slate-900">Thông báo xử lý dữ liệu cá nhân</h1>
      <p>
        Website Cầu Lông Đà Nẵng là sản phẩm đồ án tốt nghiệp. Thông báo này cho bạn biết chúng tôi thu thập dữ liệu gì, để làm gì,
        theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP.
      </p>
      <h2 className="text-base font-bold text-slate-900">Dữ liệu được thu thập</h2>
      <p>Họ tên, email, số điện thoại do bạn cung cấp khi đăng ký; lịch sử đặt sân của bạn trên hệ thống.</p>
      <h2 className="text-base font-bold text-slate-900">Mục đích xử lý</h2>
      <p>
        Tạo và quản lý tài khoản; ghi nhận lượt đặt sân; cho phép chủ sân mà bạn đặt xem tên và số điện thoại của bạn để liên hệ và
        đối chiếu thanh toán.
      </p>
      <h2 className="text-base font-bold text-slate-900">Chia sẻ dữ liệu</h2>
      <p>
        Dữ liệu được lưu trên dịch vụ Supabase. Khi bạn dùng trợ lý AI, nội dung câu hỏi được gửi tới dịch vụ Gemini của Google để xử
        lý; họ tên, email, số điện thoại của bạn không được gửi kèm.
      </p>
      <h2 className="text-base font-bold text-slate-900">Quyền của bạn</h2>
      <p>
        Bạn có thể xem và sửa thông tin cá nhân tại trang Tài khoản, rút lại sự đồng ý và yêu cầu xóa tài khoản. Khi tài khoản bị xóa,
        các lượt đặt cũ được giữ ở dạng ẩn danh.
      </p>
    </article>
  );
}
