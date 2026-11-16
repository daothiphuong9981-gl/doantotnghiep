import { notFound } from "next/navigation";
import Link from "next/link";
import { CourtManager } from "@/components/owner/court-manager";
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
      {venue.status === "rejected" ? (
        <Alert>Sân bị từ chối{venue.reject_reason ? `. Lý do: ${venue.reject_reason}` : ""}. Sửa thông tin và lưu lại để gửi duyệt lần nữa.</Alert>
      ) : null}
      {venue.status === "hidden" ? (
        <Alert>
          Sân đang bị quản trị viên ẩn{venue.reject_reason ? `. Lý do: ${venue.reject_reason}` : ""}. Sau khi khắc phục, hãy{" "}
          <Link href="/contact" className="font-semibold underline">
            liên hệ quản trị viên
          </Link>{" "}
          để được hiển thị lại.
        </Alert>
      ) : null}
      {wards.ok ? <VenueForm wards={wards.data} venue={venue} courtCount={courts.filter((c) => c.is_active).length} /> : <Alert>{wards.message}</Alert>}
      <CourtManager venueId={venue.id} courts={courts} />
      <div className="grid gap-5 2xl:grid-cols-2">
        <PriceEditor venueId={venue.id} initial={prices} openTime={venue.open_time} closeTime={venue.close_time} />
        <ImageManager venueId={venue.id} images={images} />
      </div>
    </div>
  );
}
