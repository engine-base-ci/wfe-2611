// 分身の部屋「やったこと」（K-756）の字を 1 か所で作る：期間・日の見出し・時刻・結果の札・様子の文・日ごとの並び。
//   口 listCloneActivity（K-754）の答えの 1 行から、部品 done.tsx の値（DoneDay・DoneRow）を新しく作って返す（受けた値は変えない）。
//   日付と時刻は日本時間。字は書かれたとおり（HTML を作らない）
import type { BadgeTone } from "@/components/k";
import type { DoneDay, DoneFilter, DoneKind, DoneRow } from "./done";

export type DonePeriod = "week" | "month" | "quarter";
/** 期間の名と、今日から何日前を from にするか（to はどれも今日・口の 366 日の内側） */
export const PERIODS: Readonly<Record<DonePeriod, { label: string; back: number }>> = {
  week: { label: "この 1 週間", back: 6 },
  month: { label: "この 1 か月", back: 29 },
  quarter: { label: "この 3 か月", back: 89 },
};
export const PERIOD_KEYS: readonly DonePeriod[] = ["week", "month", "quarter"];
export const DEFAULT_PERIOD: DonePeriod = "week";
const KINDS: readonly DoneKind[] = ["ran", "made", "stopped"];

/** 口の答えの 1 行（K-754 の「答えの形」） */
export interface ActivityRow {
  id: string;
  at: string;
  kind: string;
  ticket_id: string;
  ticket_number: string;
  title: string;
  result: string;
  detail?: ActivityDetail | null;
}
export interface ActivityDetail {
  approved?: { by?: string | null; at?: string | null } | null;
  edited?: { by?: string | null; version?: number | null } | null;
  checks?: { ai?: number | null; total?: number | null } | null;
  stopped_reason?: string | null;
  returned?: { by?: string | null; reason?: string | null } | null;
}

const JST_MS = 9 * 3600_000;
const DAY_MS = 86400_000;
const WD = ["日", "月", "火", "水", "木", "金", "土"] as const;
const jst = (t: number): Date => new Date(t + JST_MS);
const pad = (n: number): string => String(n).padStart(2, "0");

/** 日本時間の日付「YYYY-MM-DD」 */
export function ymdJst(t: number): string {
  return jst(t).toISOString().slice(0, 10);
}

/** 期間の問い合わせ（from・to は日本時間の日付） */
export function rangeOf(period: DonePeriod, now: number = Date.now()): { from: string; to: string } {
  return { from: ymdJst(now - PERIODS[period].back * DAY_MS), to: ymdJst(now) };
}

/** 道の値を読む（知らない値は既定に戻す・口に送らない） */
export function kindOf(v: string | null): DoneFilter {
  return KINDS.includes(v as DoneKind) ? (v as DoneKind) : "all";
}
export function periodOf(v: string | null): DonePeriod {
  return PERIOD_KEYS.includes(v as DonePeriod) ? (v as DonePeriod) : DEFAULT_PERIOD;
}

/** 日の見出し：今日は「今日 M/D（曜）」、ほかは「M/D（曜）」 */
export function dayLabel(at: string, now: number = Date.now()): string {
  const d = jst(Date.parse(at));
  const s = `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）`;
  return ymdJst(Date.parse(at)) === ymdJst(now) ? `今日 ${s}` : s;
}

/** 時刻「HH:mm」 */
export function timeOf(at: string): string {
  return jst(Date.parse(at)).toISOString().slice(11, 16);
}

/** 「MM/DD HH:mm」 */
function stampOf(at: string): string {
  const d = jst(Date.parse(at));
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${d.toISOString().slice(11, 16)}`;
}

const RESULTS: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  done: { label: "完了", tone: "success" },
  awaiting: { label: "承認待ち", tone: "warning" },
  passed: { label: "そのまま通った", tone: "success" },
  fixed: { label: "直された", tone: "warning" },
  returned: { label: "差し戻し", tone: "warning" },
  stopped: { label: "止まった", tone: "danger" },
};
/** 結果の札（知らない値は字のまま・色は無し） */
export function resultOf(result: string): { label: string; tone: BadgeTone } {
  return RESULTS[result] ?? { label: result, tone: "neutral" };
}

/** 様子の文（鍵の順に最初の 1 つ・どれも無ければ null） */
export function detailText(detail: ActivityDetail | null | undefined): string | null {
  if (!detail) return null;
  const { approved, edited, checks, stopped_reason: reason, returned } = detail;
  if (approved?.at && !Number.isNaN(Date.parse(approved.at)))
    return `承認（${stampOf(approved.at)}・${approved.by ?? ""}）の後に実行`;
  if (edited?.by) return `${edited.by}が直した（版 ${edited.version ?? ""}）`;
  if (returned?.reason) return `${returned.by ?? ""}：「${returned.reason}」`;
  if (checks && (checks.total ?? 0) >= 1)
    return `確認項目 ${checks.total} 件のうち ${checks.ai ?? 0} 件に AI がチェックを付けた`;
  if (reason) return `止まった理由：${reason}`;
  return null;
}

/** 口の 1 行 → 部品の 1 行 */
export function toRow(r: ActivityRow): DoneRow {
  const kind: DoneKind = KINDS.includes(r.kind as DoneKind) ? (r.kind as DoneKind) : "ran";
  const res = resultOf(r.result);
  const detail = detailText(r.detail);
  return {
    id: r.id,
    time: timeOf(r.at),
    kind,
    title: r.title,
    ticket: r.ticket_number,
    ticketId: r.ticket_id,
    ...(detail ? { detail } : {}),
    result: res.label,
    tone: res.tone,
  };
}

/** 日本時間の日付ごとにまとめる（口の並び＝新しい順のまま） */
export function toDays(rows: readonly ActivityRow[], now: number = Date.now()): DoneDay[] {
  return rows.reduce<DoneDay[]>((days, r) => {
    const label = dayLabel(r.at, now);
    const last = days.at(-1);
    if (last && last.label === label) return [...days.slice(0, -1), { label, rows: [...last.rows, toRow(r)] }];
    return [...days, { label, rows: [toRow(r)] }];
  }, []);
}
