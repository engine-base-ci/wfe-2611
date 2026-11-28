// 概要の口の答え → 部品の値（K-480）。時計は引数で受ける純関数（試験は page.clock で今を固定する）。日付と時刻は日本時間
import { STAGE_TONE, type Tone } from "./head";
import type { StatusBarProps, UpdateDay, UpdateFilter, UpdateItem } from "./panels";

export interface OverviewStage {
  id: string;
  key: string | null;
  name: string;
  count: number;
}
export interface OverviewEvent {
  ticket: { id: string; number: string; title: string };
  at: string;
  by: { id: string; display_name: string } | null;
  kind: "post" | "change" | "system";
  text: string;
  count: number;
}
export interface Overview {
  stages: readonly OverviewStage[];
  recent: readonly OverviewEvent[];
  total: number;
}

const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const KINDS = ["post", "change", "system"] as const;

/** 答えの data を形のそろった値にする（無い・形が違う欄は空・0 にする。画面で落とさない） */
export function overviewOf(data: unknown): Overview {
  const d = rec(data);
  const stages = (Array.isArray(d["by_stage"]) ? d["by_stage"] : []).map((x): OverviewStage => {
    const s = rec(rec(x)["stage"]);
    return {
      id: str(s["id"]),
      key: typeof s["key"] === "string" ? s["key"] : null,
      name: str(s["name"]),
      count: num(rec(x)["count"]),
    };
  });
  const recent = (Array.isArray(d["recent"]) ? d["recent"] : []).map((x): OverviewEvent => {
    const e = rec(x);
    const t = rec(e["ticket"]);
    const by = e["by"] === null || e["by"] === undefined ? null : rec(e["by"]);
    const kind = KINDS.find((k) => k === e["kind"]) ?? "system";
    return {
      ticket: { id: str(t["id"]), number: str(t["number"]), title: str(t["title"]) },
      at: str(e["at"]),
      by: by ? { id: str(by["id"]), display_name: str(by["display_name"]) } : null,
      kind,
      text: str(e["text"]),
      count: num(e["count"]),
    };
  });
  return { stages, recent, total: num(d["total"]) };
}

/** 状態の内訳（位置の順のまま・完了の割合は切り捨て・0 件なら一言） */
export function statusOf(stages: readonly OverviewStage[], total: number): StatusBarProps {
  const done = stages.filter((s) => s.key === "done").reduce((sum, s) => sum + s.count, 0);
  const summary =
    total > 0 ? `${Math.floor((done / total) * 100)}% 完了（${total} 件中 ${done}）` : "チケットはまだありません";
  return {
    summary,
    counts: stages.map((s) => ({ label: s.name, count: s.count, tone: STAGE_TONE[s.name] ?? "neutral" })),
  };
}

const JST_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"] as const;
/** 日本時間の暦の日（1970-01-01 からの日数） */
const jstDay = (ms: number): number => Math.floor((ms + JST_MS) / DAY_MS);

/** 「11月2日（月）」（日本時間） */
export function dayLabel(at: string): string {
  const d = new Date(Date.parse(at) + JST_MS);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WEEK[d.getUTCDay()]}）`;
}

/** いつ：同じ日は「N分前」「N時間前」・前の日は「昨日」・それより前は「M/D」（日本時間） */
export function whenOf(at: string, now: number): string {
  const t = Date.parse(at);
  const days = jstDay(now) - jstDay(t);
  if (days <= 0) {
    const min = Math.max(0, Math.floor((now - t) / 60000));
    return min < 60 ? `${min}分前` : `${Math.floor(min / 60)}時間前`;
  }
  if (days === 1) return "昨日";
  const d = new Date(t + JST_MS);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** 更新の種類の札（手元で絞る）。「決定」は口に種類が無いので押せない形 */
export type FeedFilter = "all" | "human" | "system";
export const FEED_FILTERS: readonly { key: FeedFilter | "decision"; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "human", label: "人" },
  { key: "system", label: "AI の実行" },
  { key: "decision", label: "決定" },
];

const KIND_VIEW: Readonly<Record<OverviewEvent["kind"], { verb: string; tag: string; tone: Tone }>> = {
  post: { verb: "チケットに", tag: "書き込み", tone: "neutral" },
  change: { verb: "チケットを", tag: "変更", tone: "indigo" },
  system: { verb: "チケットで", tag: "仕組み", tone: "hold" },
};

/** 書いた人の丸い印の色（人の id から決まる・口に色が無いので id で散らす） */
const PEOPLE_TONES: readonly Tone[] = ["teal", "indigo", "lavender", "amber", "coral", "sage"];
const toneOfPerson = (id: string): Tone =>
  PEOPLE_TONES[Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % PEOPLE_TONES.length] ?? "indigo";

const pass = (e: OverviewEvent, f: FeedFilter): boolean =>
  f === "all" ? true : f === "human" ? e.by !== null : e.by === null;

function itemOf(e: OverviewEvent, now: number): UpdateItem {
  const k = KIND_VIEW[e.kind];
  const who = e.by?.display_name || "仕組み";
  return {
    initial: e.by ? (Array.from(who)[0] ?? "") : "仕",
    avatarTone: e.by ? toneOfPerson(e.by.id) : "hold",
    who,
    verb: k.verb,
    tag: k.tag,
    tagTone: k.tone,
    when: whenOf(e.at, now),
    number: e.ticket.number,
    title: e.ticket.title,
    change: e.count >= 2 ? `${e.text} ・ ほか ${e.count - 1} 件` : e.text,
    href: `/tickets/${encodeURIComponent(e.ticket.id)}`,
  };
}

/** 最近の更新：日本時間の日ごとにまとめる（新しい順のまま・絞って 0 件の日は出さない） */
export function feedDaysOf(recent: readonly OverviewEvent[], now: number, filter: FeedFilter): UpdateDay[] {
  return recent
    .filter((e) => pass(e, filter))
    .reduce<UpdateDay[]>((days, e) => {
      const label = dayLabel(e.at);
      const item = itemOf(e, now);
      const at = days.findIndex((d) => d.label === label);
      if (at < 0) return [...days, { label, items: [item] }];
      return days.map((d, i) => (i === at ? { ...d, items: [...d.items, item] } : d));
    }, []);
}

/** 札の並び（今の札・押す口・押せない札） */
export function filtersOf(current: FeedFilter, pick: (f: FeedFilter) => void): UpdateFilter[] {
  return FEED_FILTERS.map((f) =>
    f.key === "decision"
      ? { label: f.label, disabled: true }
      : { label: f.label, current: f.key === current, onPick: () => pick(f.key as FeedFilter) },
  );
}
