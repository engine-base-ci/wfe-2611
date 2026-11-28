// 期限を変える小窓の日付の計算（K-484・D-151.11）。どれも時計を引数に取る純関数（部品も画面も時計を読まない）。
//   日付は日本時間の YYYY-MM-DD。曜日は UTC の 0 時で数える（日付だけを比べるので時差は入らない）。
//   K-481（カレンダー）・K-482（ガント）もここを呼ぶ（checkReason・skipWeekend・exceedsParent）。同じ確かめを 2 か所に持たない
import type { DueQuick } from "./due-popover";

const JST_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;
/** 期限を変える理由の上限（K-483 の口と同じ・字の数は文字の数） */
export const REASON_MAX = 200;

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const weekday = (ymd: string) => toDate(ymd).getUTCDay();

/** 日を足す（YYYY-MM-DD） */
export const addDays = (ymd: string, n: number): string => toYmd(new Date(toDate(ymd).getTime() + n * DAY_MS));

/** 今日（日本時間の YYYY-MM-DD） */
export const jstToday = (now: Date): string => new Date(now.getTime() + JST_MS).toISOString().slice(0, 10);

/** すぐ選ぶ：今日・明日・今週の金曜（明日より後に当たるときだけ＝月・火・水）・来週の月曜（今日より後で最初の月曜） */
export function quickChoices(today: string): DueQuick[] {
  const dow = weekday(today);
  const out: DueQuick[] = [
    { label: "今日", value: today },
    { label: "明日", value: addDays(today, 1) },
  ];
  if (dow >= 1 && dow <= 3) out.push({ label: "今週の金曜", value: addDays(today, 5 - dow) });
  out.push({ label: "来週の月曜", value: addDays(today, (8 - dow) % 7 || 7) });
  return out;
}

/** 初めの選び：期限が今日以後ならその日・過ぎている／無ければ今日 */
export const initialPick = (due: string | null, today: string): string => (due && due >= today ? due : today);

/** 今日より前の日か */
export const isPast = (day: string, today: string): boolean => day < today;

/** 見ている月（月の数は 1〜12） */
export interface MonthView {
  year: number;
  month: number;
}
export const monthOf = (ymd: string): MonthView => ({ year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)) });
/** 月を送る（delta は前の月 -1・次の月 +1） */
export function shiftMonth(m: MonthView, delta: number): MonthView {
  const i = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/** YYYY-MM-DD → MM/DD（ボタンとお知らせの字） */
export const label = (day: string): string => `${day.slice(5, 7)}/${day.slice(8, 10)}`;

/** 理由の確かめ：NFKC と前後の空白をそろえた字。空なら E-DUE-001・200 字を超えれば E-DUE-002・通れば null */
export function checkReason(raw: string): { value: string; code: "E-DUE-001" | "E-DUE-002" | null } {
  const value = raw.normalize("NFKC").trim();
  if (value === "") return { value, code: "E-DUE-001" };
  if ([...value].length > REASON_MAX) return { value, code: "E-DUE-002" };
  return { value, code: null };
}

/** 土日なら次の月曜（K-482 の「土日を飛ばす」）。moved は動かしたか */
export function skipWeekend(day: string): { day: string; moved: boolean } {
  const dow = weekday(day);
  if (dow === 6) return { day: addDays(day, 2), moved: true };
  if (dow === 0) return { day: addDays(day, 1), moved: true };
  return { day, moved: false };
}

/** 親の期限より後か（親の期限が無ければ偽・K-482） */
export const exceedsParent = (day: string, parentDue: string | null): boolean => parentDue !== null && day > parentDue;
