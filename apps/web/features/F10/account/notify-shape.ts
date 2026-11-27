// 自分の設定 › 知らせ（K-843）：口 getNotificationSettings の答え（K-837 の「画面が使う答えの形」）→ 部品 NotifyBody の値。
//   出来事の字と並び・静かにする時間・いま止める・止めていても知らせるの字、止めている「いつまで」の字。
//   純粋な関数だけ（@/ を読まない・部品 notify.tsx も字をここから読む）

/** 出来事の 1 つ（口の答え） */
export interface NotifyEvent {
  key: string;
  bell: boolean;
  mail: boolean;
  /** 止められない（安全のため） */
  fixed: boolean;
}
/** getNotificationSettings・updateNotificationSettings の答え（data） */
export interface NotifyAnswer {
  workspace_id: string;
  email_digest: boolean;
  quiet_hours: { preset: string };
  paused_until: string | null;
  urgent_override: string[];
  events: NotifyEvent[];
}
/** updateNotificationSettings へ送る体（押した項目だけ） */
export type NotifyPatch =
  | { events: { key: string; bell: boolean; mail: boolean }[] }
  | { quiet_hours: { preset: string } }
  | { pause: string | null }
  | { urgent_override: string[] };

export type Channel = "bell" | "mail";

/** 出来事の字と補足（下絵の字・この順に並べる。答えの順に依らない） */
export const EVENT_ROWS: readonly { key: string; name: string; detail: string }[] = [
  { key: "approval_waiting", name: "承認を待っている", detail: "自分が承認する人のとき" },
  { key: "mentioned", name: "@ で呼ばれた・やり取りで知らせる人にされた", detail: "" },
  { key: "handed_over", name: "渡された・配られた", detail: "返事の期限つき" },
  { key: "clone_stopped", name: "分身が止まった・落ちて直せない", detail: "PC が切れた・ログイン情報が切れた など" },
  { key: "clone_finished", name: "分身が実行を終えた", detail: "やったことは分身の部屋でも見られる" },
  { key: "ticket_changed", name: "自分が担当・承認するチケットが動いた", detail: "状態・期限の変化" },
  { key: "new_device", name: "新しい端末で入った", detail: "安全のため止められない" },
];

/** 静かにする時間の選び（▾ の 4 つ） */
export const QUIET_ITEMS: readonly { value: string; label: string }[] = [
  { value: "weekdays_night_weekend", label: "平日 20:00〜8:00 ・ 土日" },
  { value: "every_night", label: "毎日 20:00〜8:00" },
  { value: "weekend_only", label: "土日だけ" },
  { value: "off", label: "使わない" },
];

/** いま止める（3 つのボタン） */
export const PAUSE_ITEMS: readonly { value: string; label: string }[] = [
  { value: "1h", label: "1 時間" },
  { value: "today", label: "今日いっぱい" },
  { value: "tomorrow_morning", label: "明日の朝まで" },
];

/** 止めていても知らせる（急ぎの 2 つ） */
export const URGENT_ITEMS: readonly { value: string; label: string }[] = [
  { value: "approval_due_today", label: "承認を待っている（期限が今日）" },
  { value: "clone_stopped", label: "分身が止まった" },
];

export const ROW_FAIL = "保存できませんでした。もう一度、押してください";
export const TOP_FAIL = "保存できませんでした。通信を確かめて、もう一度押してください";
/** 仮（K-843 の申し送り） */
export const COPY_NONE = "写す先のワークスペースがありません";
/** 仮（K-843 の申し送り） */
export const copiedText = (n: number): string => `${n} つのワークスペースに写しました`;

/** 部品の 1 行の値 */
export interface EventRowValue {
  key: string;
  name: string;
  detail: string;
  bell: boolean;
  mail: boolean;
  fixed: boolean;
}

/** 答えの出来事 → 決まった順の行（答えに無い出来事は出さない） */
export function toRows(events: readonly NotifyEvent[]): EventRowValue[] {
  return EVENT_ROWS.flatMap((r) => {
    const e = events.find((x) => x.key === r.key);
    return e ? [{ ...r, bell: e.bell, mail: e.mail, fixed: e.fixed }] : [];
  });
}

/** 静かにする時間のボタンの字（知らない preset は 1 つめ） */
export function quietLabel(preset: string): string {
  return (QUIET_ITEMS.find((q) => q.value === preset) ?? QUIET_ITEMS[0]!).label;
}

/** 時間帯ごとの時差（時間）。知らない時間帯は日本時間 */
const OFFSET_HOURS: Record<string, number> = { "Asia/Tokyo": 9, UTC: 0 };
const HOUR_MS = 60 * 60 * 1000;
/** 「次の 0:00」「明日の 8:00」と同じとみなす幅 */
const SAME_MS = 60 * 1000;
const MORNING_HOUR = 8;

/** 止めている「いつまで」の字（過ぎていれば null）。
 *  その人の時間帯で次の 0:00 なら「今日いっぱい」・明日の 8:00 なら「明日の朝まで」・ほかは「HH:mm まで」（仮・D-154.80） */
export function pausedText(until: string | null, timezone: string, now: number): string | null {
  if (!until) return null;
  const at = Date.parse(until);
  if (Number.isNaN(at) || at <= now) return null;
  const off = (OFFSET_HOURS[timezone] ?? OFFSET_HOURS["Asia/Tokyo"]!) * HOUR_MS;
  const local = new Date(now + off);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - off;
  if (Math.abs(at - midnight) < SAME_MS) return "今日いっぱい";
  if (Math.abs(at - (midnight + MORNING_HOUR * HOUR_MS)) < SAME_MS) return "明日の朝まで";
  const t = new Date(at + off);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCHours())}:${p(t.getUTCMinutes())} まで`;
}

/** 部品のパネルの値 */
export interface PanelValue {
  rows: EventRowValue[];
  quiet: string;
  paused: { title: string } | null;
  urgent: string[];
}

/** 答え → パネルの値 */
export function toPanel(a: NotifyAnswer, timezone: string, now: number): PanelValue {
  const until = pausedText(a.paused_until, timezone, now);
  return {
    rows: toRows(a.events),
    quiet: quietLabel(a.quiet_hours.preset),
    paused: until ? { title: `いま止めています ・ ${until}` } : null,
    urgent: [...a.urgent_override],
  };
}

/** 押した 1 行の送る値（押した後の 2 つの値） */
export function eventPatch(
  row: Pick<EventRowValue, "key" | "bell" | "mail">,
  channel: Channel,
  value: boolean,
): { key: string; bell: boolean; mail: boolean } {
  return { key: row.key, bell: channel === "bell" ? value : row.bell, mail: channel === "mail" ? value : row.mail };
}
