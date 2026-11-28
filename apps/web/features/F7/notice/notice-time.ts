// お知らせの時刻の見せ方（K-467・手元の時計が基準・日付の区切りは日本の時刻）。純な関数。
//   1 分未満「たった今」・1 時間未満「N 分前」・6 時間未満「N 時間前」・同じ日「HH:MM」・前の日「昨日」・同じ年「MM/DD」・それ以外「YYYY/MM/DD」
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const RECENT_HOURS = 6;

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

interface Day {
  y: string;
  m: string;
  d: string;
  hh: string;
  mm: string;
}
function dayOf(t: Date): Day {
  const p = Object.fromEntries(PARTS.formatToParts(t).map((x) => [x.type, x.value]));
  return { y: p["year"] ?? "", m: p["month"] ?? "", d: p["day"] ?? "", hh: p["hour"] ?? "", mm: p["minute"] ?? "" };
}
const sameDay = (a: Day, b: Day) => a.y === b.y && a.m === b.m && a.d === b.d;

/** 日本の時刻の「MM/DD」（日付だけの文字「2026-11-03」も日時の文字も受ける）。読めなければ null */
export function mmddOf(iso: string): string | null {
  const t = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00+09:00` : iso);
  if (Number.isNaN(t.getTime())) return null;
  const d = dayOf(t);
  return `${d.m}/${d.d}`;
}

/** 行の時刻の字。読めない時刻は空の字 */
export function whenOf(iso: string, now: Date): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const diff = now.getTime() - t.getTime();
  if (diff < MINUTE_MS) return "たった今";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} 分前`;
  if (diff < RECENT_HOURS * HOUR_MS) return `${Math.floor(diff / HOUR_MS)} 時間前`;
  const at = dayOf(t);
  const today = dayOf(now);
  if (sameDay(at, today)) return `${at.hh}:${at.mm}`;
  if (sameDay(at, dayOf(new Date(now.getTime() - 24 * HOUR_MS)))) return "昨日";
  if (at.y === today.y) return `${at.m}/${at.d}`;
  return `${at.y}/${at.m}/${at.d}`;
}
