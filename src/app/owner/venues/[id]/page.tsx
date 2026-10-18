import { notFound } from "next/navigation";
import { ImageManager } from "@/components/owner/image-manager";
import { PriceEditor } from "@/components/owner/price-editor";
import { VenueForm } from "@/components/owner/venue-form";
import { Alert, Chip } from "@/components/ui/controls";
import { getMyVenue } from "@/lib/services/owner";
import { listWards } from "@/lib/services/venues";

export const metadata = { title: "Chỉnh sửa sân - Cầu Lông Đà Nẵng" };

const STATUS = {
  pending: ["Chờ duyệt", "yellow"],
  approved: ["Đã duyệt", "green"],
  rejected: ["Bị từ chối", "red"],
  suspended: ["Tạm ngừng", "gray"],
  hidden: ["Bị ẩn", "red"],
} as const;

// PB07, PB08 - Chỉnh sửa sân, bảng giá, hình ảnh
export default async function EditVenuePage({ params, searchParams }: PageProps<"/owner/venues/[id]">) {
  const { id } = await params;
  const { created } = await searchParams;
  const [detail, wards] = await Promise.all([getMyVenue(Number(id)), listWards()]);
  if (!detail.ok) notFound();
  const { venue, courts, prices, images } = detail.data;
  const [label, tone] = STATUS[venue.status];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">{venue.name}</h1>
        <Chip tone={tone}>{label}</Chip>
      </div>
      {created ? <Alert tone="success">Đã đăng ký sân. Hãy thiết lập bảng giá và tải ảnh bên dưới; sân sẽ hiển thị sau khi được duyệt.</Alert> : null}
      {venue.reject_reason && (venue.status === "rejected" || venue.status === "hidden") ? (
        <Alert>Lý do: {venue.reject_reason}. Sửa thông tin và lưu lại để gửi duyệt lần nữa.</Alert>
      ) : null}
      {wards.ok ? <VenueForm wards={wards.data} venue={venue} courtCount={courts.filter((c) => c.is_active).length} /> : <Alert>{wards.message}</Alert>}
      <div className="grid gap-5 2xl:grid-cols-2">
        <PriceEditor venueId={venue.id} initial={prices} />
        <ImageManager venueId={venue.id} images={images} />
      </div>
    </div>
  );
}
