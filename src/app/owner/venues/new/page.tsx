import { VenueForm } from "@/components/owner/venue-form";
import { Alert } from "@/components/ui/controls";
import { listWards } from "@/lib/services/venues";

export const metadata = { title: "Đăng ký sân - Cầu Lông Đà Nẵng" };

// PB06 - Đăng ký sân mới
export default async function NewVenuePage() {
  const wards = await listWards();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Đăng ký sân mới</h1>
      <p className="text-sm text-slate-500">
        Sau khi lưu, sân ở trạng thái “Chờ duyệt”. Bạn thiết lập bảng giá và tải ảnh ở bước tiếp theo.
      </p>
      {wards.ok ? <VenueForm wards={wards.data} /> : <Alert>{wards.message}</Alert>}
    </div>
  );
}
