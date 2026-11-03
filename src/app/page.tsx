import { HomeExplorer } from "@/components/home-explorer";
import { Alert } from "@/components/ui/controls";
import { currentHourInVietnam, todayInVietnam } from "@/lib/format";
import { listVenues, listWards } from "@/lib/services/venues";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { EMPTY_FILTER, filterFromParams, filterToQuery } from "@/lib/venue-filter";

/** Tìm theo bộ lọc trên URL; bộ lọc hết hiệu lực (ví dụ giờ đã qua) thì về danh sách đầy đủ. */
async function initialSearch(filter: typeof EMPTY_FILTER) {
  const result = await listVenues(filterToQuery(filter, null));
  if (result.ok || result.status !== 400) return { result, filter };
  return { result: await listVenues({}), filter: EMPTY_FILTER };
}

// PB09, PB12, PB13 - Trang chủ: tìm kiếm, lọc và bản đồ các sân đã duyệt.
// Vẫn render động (bộ lọc trên URL, ngày/giờ hiện tại, thông báo ?deleted=1) nhưng không đọc cookie: danh sách mặc định,
// điểm đánh giá và phường, xã lấy từ Data Cache (client ẩn danh, tag "venues"/"ratings"/"wards").
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const query = await searchParams;
  const [search, wards] = isSupabaseConfigured ? await Promise.all([initialSearch(filterFromParams(query)), listWards()]) : [null, null];
  const result = search?.result;
  return (
    <>
      {query.deleted === "1" ? (
        <div className="p-4 pb-0">
          <Alert tone="success">Tài khoản của bạn đã được xóa. Cảm ơn bạn đã sử dụng Cầu Lông Đà Nẵng.</Alert>
        </div>
      ) : null}
      {result && !result.ok ? (
        <div className="p-4">
          <Alert>{result.message}</Alert>
        </div>
      ) : null}
      <HomeExplorer
        initialVenues={result?.ok ? result.data : []}
        initialFilter={search?.filter ?? EMPTY_FILTER}
        wards={wards?.ok ? wards.data : []}
        today={todayInVietnam()}
        currentHour={currentHourInVietnam()}
      />
    </>
  );
}
