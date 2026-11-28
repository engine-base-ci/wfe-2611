// 保存の小窓の「条件」の札の字（K-479）。順は 担当者・期限・状態・種別・親子・AI に任せている・言葉・列。
//   名前は K-478 の useListNames（人・種別）と useStageNames（段・小窓を開いたとき 1 回）の答えから引く。引けなければ「指定あり」
import type { Density } from "./open-view";

export interface NamedItem {
  id: string;
  name: string;
}
export interface SummaryInput {
  extra: Readonly<Record<string, string>>;
  q: string;
  people: readonly NamedItem[];
  kinds: readonly NamedItem[];
  /** 段の名前（まだ読んでいない・読めないときは null） */
  stages: readonly NamedItem[] | null;
  columns: readonly string[];
  density: Density;
}

const DAY_MS = 86_400_000;
/** 日本時間の日付（YYYY-MM-DD） */
const ymd = (d: Date): string => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d);

/** 今日を含む週（月曜〜日曜）と次の週 */
function weeks(now: Date): { thisWeek: [string, string]; nextWeek: [string, string] } {
  const today = new Date(`${ymd(now)}T00:00:00Z`);
  const back = (today.getUTCDay() + 6) % 7;
  const mon = today.getTime() - back * DAY_MS;
  const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);
  return {
    thisWeek: [iso(mon), iso(mon + 6 * DAY_MS)],
    nextWeek: [iso(mon + 7 * DAY_MS), iso(mon + 13 * DAY_MS)],
  };
}

const nameOf = (list: readonly NamedItem[] | null, id: string): string =>
  list?.find((x) => x.id === id)?.name ?? "指定あり";

function dueText(from: string | undefined, to: string | undefined, now: Date): string | null {
  if (!from && !to) return null;
  const { thisWeek, nextWeek } = weeks(now);
  if (from && from === to && from === ymd(now)) return "今日";
  if (from === thisWeek[0] && to === thisWeek[1]) return "今週";
  if (from === nextWeek[0] && to === nextWeek[1]) return "来週";
  return `${from ?? ""}〜${to ?? ""}`;
}

export function summaryOf(input: SummaryInput, now: Date = new Date()): string[] {
  const { extra, q, people, kinds, stages, columns, density } = input;
  const out: string[] = [];
  if (extra["assignee_id"]) out.push(`担当者：${nameOf(people, extra["assignee_id"])}`);
  const due = dueText(extra["due_from"], extra["due_to"], now);
  if (due) out.push(`期限：${due}`);
  if (extra["stage_id"]) out.push(`状態：${nameOf(stages, extra["stage_id"])}`);
  else if (extra["done"] === "false") out.push("状態：完了でない");
  if (extra["kind_id"]) out.push(`種別：${nameOf(kinds, extra["kind_id"])}`);
  if (extra["parent"] === "none") out.push("親子：親だけ");
  else if (extra["parent"] === "any") out.push("親子：子だけ");
  if (extra["delegated"] === "true") out.push("AI に任せている");
  const text = q.trim();
  if (text) out.push(`言葉：「${text}」`);
  out.push(`列：${columns.length}${density === "compact" ? "（行を詰める）" : ""}`);
  return out;
}
