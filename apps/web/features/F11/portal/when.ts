// ゲストの場所の時刻の字（共通の決まり「日付と時刻」：口は世界標準時の印つき、画面は日本時間で出す・生の ISO を出さない）。
//   2026-11-28 PM の決め：やり取りの時刻も同じ出し方にそろえる
const TZ = "Asia/Tokyo";
const day = (d: Date) => d.toLocaleDateString("ja-JP", { timeZone: TZ });
const hm = (d: Date) =>
  d.toLocaleTimeString("ja-JP", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const md = (d: Date) => d.toLocaleDateString("ja-JP", { timeZone: TZ, month: "numeric", day: "numeric" });
const ISO = /^\d{4}-\d{2}-\d{2}T/;

/** 出した時刻：今日なら「今日 10:20」、ほかは「10/12」 */
export function whenOf(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (day(d) === day(now)) return `今日 ${hm(d)}`;
  return md(d);
}

/** やり取りの 1 件の時刻：今日なら「今日 10:20」、ほかは「10/30 17:50」。日時の印でない字（「今」など）はそのまま */
export function momentOf(at: string, now = new Date()): string {
  if (!ISO.test(at)) return at;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  if (day(d) === day(now)) return `今日 ${hm(d)}`;
  return `${md(d)} ${hm(d)}`;
}
