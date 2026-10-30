/**
 * Ngân hàng nhận chuyển khoản qua VietQR (NAPAS 247). Mã BIN lấy từ danh mục công khai https://api.vietqr.io/v2/banks
 * (chỉ các ngân hàng có transferSupported = 1), cập nhật ngày 30/10/2026.
 */
export interface Bank {
  /** Mã BIN 6 số dùng trong mã QR */
  bin: string;
  code: string;
  short: string;
  name: string;
}

export const BANKS: readonly Bank[] = [
  { bin: "970415", code: "ICB", short: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam" },
  { bin: "970436", code: "VCB", short: "Vietcombank", name: "Ngân hàng TMCP Ngoại Thương Việt Nam" },
  { bin: "970418", code: "BIDV", short: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { bin: "970405", code: "VBA", short: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam" },
  { bin: "970448", code: "OCB", short: "OCB", name: "Ngân hàng TMCP Phương Đông" },
  { bin: "970422", code: "MB", short: "MBBank", name: "Ngân hàng TMCP Quân đội" },
  { bin: "970407", code: "TCB", short: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam" },
  { bin: "970416", code: "ACB", short: "ACB", name: "Ngân hàng TMCP Á Châu" },
  { bin: "970432", code: "VPB", short: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { bin: "970423", code: "TPB", short: "TPBank", name: "Ngân hàng TMCP Tiên Phong" },
  { bin: "970403", code: "STB", short: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Tài Lộc" },
  { bin: "970437", code: "HDB", short: "HDBank", name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh" },
  { bin: "970454", code: "VCCB", short: "VietCapitalBank", name: "Ngân hàng TMCP Bản Việt" },
  { bin: "970429", code: "SCB", short: "SCB", name: "Ngân hàng TMCP Sài Gòn" },
  { bin: "970441", code: "VIB", short: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { bin: "970443", code: "SHB", short: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội" },
  { bin: "970431", code: "EIB", short: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { bin: "970426", code: "MSB", short: "MSB", name: "Ngân hàng TMCP Hàng Hải" },
  { bin: "546034", code: "CAKE", short: "CAKE", name: "TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank" },
  { bin: "546035", code: "Ubank", short: "Ubank", name: "TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank" },
  { bin: "963388", code: "TIMO", short: "Timo", name: "Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)" },
  { bin: "970400", code: "SGICB", short: "SaigonBank", name: "Ngân hàng TMCP Sài Gòn Công Thương" },
  { bin: "970409", code: "BAB", short: "BacABank", name: "Ngân hàng TMCP Bắc Á" },
  { bin: "971133", code: "PVDB", short: "PVcomBank Pay", name: "Ngân hàng số PVcomBank" },
  { bin: "971025", code: "momo", short: "MoMo", name: "CTCP Dịch Vụ Di Động Trực Tuyến" },
  { bin: "970412", code: "PVCB", short: "PVcomBank", name: "Ngân hàng TMCP Đại Chúng Việt Nam" },
  { bin: "970414", code: "MBV", short: "MBV", name: "Ngân hàng TNHH MTV Việt Nam Hiện Đại" },
  { bin: "970419", code: "NCB", short: "NCB", name: "Ngân hàng TMCP Quốc Dân" },
  { bin: "970424", code: "SHBVN", short: "ShinhanBank", name: "Ngân hàng TNHH MTV Shinhan Việt Nam" },
  { bin: "970425", code: "ABB", short: "ABBANK", name: "Ngân hàng TMCP An Bình" },
  { bin: "970427", code: "VAB", short: "VietABank", name: "Ngân hàng TMCP Việt Á" },
  { bin: "970428", code: "NAB", short: "NamABank", name: "Ngân hàng TMCP Nam Á" },
  { bin: "970430", code: "PGB", short: "PGBank", name: "Ngân hàng TMCP Thịnh vượng và Phát triển" },
  { bin: "970433", code: "VIETBANK", short: "VietBank", name: "Ngân hàng TMCP Việt Nam Thương Tín" },
  { bin: "970438", code: "BVB", short: "BaoVietBank", name: "Ngân hàng TMCP Bảo Việt" },
  { bin: "970440", code: "SEAB", short: "SeABank", name: "Ngân hàng TMCP Đông Nam Á" },
  { bin: "970446", code: "COOPBANK", short: "COOPBANK", name: "Ngân hàng Hợp tác xã Việt Nam" },
  { bin: "970449", code: "LPB", short: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam" },
  { bin: "970452", code: "KLB", short: "KienLongBank", name: "Ngân hàng TMCP Kiên Long" },
  { bin: "668888", code: "KBank", short: "KBank", name: "Ngân hàng Đại chúng TNHH Kasikornbank" },
  { bin: "971101", code: "ZALOPAY", short: "ZaloPay", name: "Ví điện tử ZaloPay" },
  { bin: "971032", code: "MVAS", short: "MVAS", name: "Trung tâm Dịch vụ số Mobifone – Chi nhánh Tổng Công ty viễn thông Mobifone" },
  { bin: "970434", code: "IVB", short: "IndovinaBank", name: "Ngân hàng TNHH Indovina" },
  { bin: "422589", code: "CIMB", short: "CIMB", name: "Ngân hàng TNHH MTV CIMB Việt Nam" },
  { bin: "970444", code: "CBB", short: "CBBank", name: "Ngân hàng Thương mại trách nhiệm hữu hạn một thành viên Ngoại thương Công nghệ số (Vietcombank Neo Limited)" },
  { bin: "970457", code: "WVN", short: "Woori", name: "Ngân hàng TNHH MTV Woori Việt Nam" },
  { bin: "970462", code: "KBHN", short: "KookminHN", name: "Ngân hàng Kookmin - Chi nhánh Hà Nội" },
  { bin: "970463", code: "KBHCM", short: "KookminHCM", name: "Ngân hàng Kookmin - Chi nhánh Thành phố Hồ Chí Minh" },
];

const BY_BIN = new Map(BANKS.map((b) => [b.bin, b]));

export function bankByBin(bin: string | null | undefined): Bank | null {
  return bin ? (BY_BIN.get(bin) ?? null) : null;
}
