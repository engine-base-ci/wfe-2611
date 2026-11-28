// 承認待ちの期限の区切り（K-161・D-128.36）。区切りは日本時間の日付で、口の due_on（YYYY-MM-DD・期限なしは null）から画面で決める
export const DUE_GROUPS = ["期限切れ", "今日", "7 日以内", "それより後", "期限なし"] as const;
export type DueGroup = (typeof DUE_GROUPS)[number];

const JST_MS = 9 * 3600_000;
const DAY_MS = 86_400_000;

/** 日本時間の今日（YYYY-MM-DD）から days 日後 */
export const jstDay = (days = 0, now = Date.now()): string =>
  new Date(now + JST_MS + days * DAY_MS).toISOString().slice(0, 10);

/** 期限の区切り（日本時間の日付） */
export function dueGroupOf(due: string | null, now = Date.now()): DueGroup {
  if (!due) return "期限なし";
  const today = jstDay(0, now);
  if (due < today) return "期限切れ";
  if (due === today) return "今日";
  if (due <= jstDay(7, now)) return "7 日以内";
  return "それより後";
}
