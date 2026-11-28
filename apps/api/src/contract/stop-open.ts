// 運営が止めた会社（K-970）の会社の人が、止めた後も使える口（K-1012・D-156.23）。
//   止められた画面（稼働状況・外枠）と、困ったとき・お知らせ・問い合わせの画面が使う口だけ。K-1008 が開けておく道 /notices・/inquiry と同じ範囲。
//   ログイン・ログアウト・同意・2 段階認証は契約の口の外（認証の部品）なので入れない。ほかの口は契約の入口 op.ts が 403 E-OPS-007 で止める
export const STOP_OPEN_OPS: ReadonlySet<string> = new Set([
  "getServiceStatusForMember",
  "getShell",
  "listNotices",
  "markNoticeRead",
  "listMyInquiries",
  "createInquiry",
  "getMyInquiry",
  "postInquiryMessage",
  "resolveMyInquiry",
  "uploadInquiryAttachment",
]);
