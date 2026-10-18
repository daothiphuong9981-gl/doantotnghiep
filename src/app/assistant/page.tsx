import Link from "next/link";
import { AssistantChat } from "@/components/assistant/chat";
import { buttonClass } from "@/components/ui/controls";
import { getSession } from "@/lib/auth";
import { AI_DAILY_LIMIT } from "@/lib/services/assistant";

export const metadata = { title: "Trợ lý AI tìm sân - Cầu Lông Đà Nẵng" };

// PB25 - Trang trò chuyện với trợ lý AI và bản đồ kết quả
export default async function AssistantPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Trợ lý AI tìm sân</h1>
        <p className="text-sm text-slate-600">
          Mô tả nhu cầu bằng tiếng Việt thông thường, ví dụ “Tìm sân ở Hải Châu tối thứ bảy dưới 80 nghìn một giờ”. Bạn cần đăng nhập để dùng trợ lý
          (mỗi tài khoản {AI_DAILY_LIMIT} câu hỏi mỗi ngày).
        </p>
        <div className="flex gap-2">
          <Link href="/login?next=/assistant" className={buttonClass("primary")}>
            Đăng nhập
          </Link>
          <Link href="/" className={buttonClass("outline")}>
            Dùng bộ lọc thường
          </Link>
        </div>
      </div>
    );
  }
  return <AssistantChat dailyLimit={AI_DAILY_LIMIT} />;
}
