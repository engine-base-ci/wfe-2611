// 分身の部屋の字（K-755）：口の答えから、頭のひとこと・いまの経過・このあとの状態・動いた時間の字を作る（字はここ 1 か所）。
//   どれも新しい値を作って返す（受け取った値は入れ替えない）。日付は日本時間（D-128.36 と同じ）
import type { CloneMe } from "./use-clone";

const JST_MS = 9 * 3600_000;
const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;
const HOUR_SEC = 3600;

/** 日本時間の YYYY-MM-DD */
export const jstDate = (at: Date): string => new Date(at.getTime() + JST_MS).toISOString().slice(0, 10);

/** YYYY-MM-DD → YYYY/MM/DD */
const slashed = (ymd: string): string => ymd.replaceAll("-", "/");

/** 頭のひとこと（広い幅）。PC の状態で 3 つの形 */
export function roomSub(me: CloneMe, today: string): string {
  const who = `${me.full_name} の分身`;
  const since = `${slashed(me.since)} から一緒に働いている`;
  if (me.pc.state === "none") {
    const start = me.since === today ? "今日から" : `${slashed(me.since)} から`;
    return `${who} ・ ${start} ・ PC がまだ`;
  }
  if (me.pc.state === "asleep") return `${who} ・ ${me.pc.label ?? ""} は閉じています ・ ${since}`;
  return `${who} ・ ${me.pc.label ?? ""} で働く ・ ${since}`;
}

/** 頭のひとこと（スマホの短い 1 行） */
export function roomSubShort(me: CloneMe): string {
  if (me.pc.state === "none") return "PC がまだつながっていません";
  if (me.pc.state === "asleep") return `${me.pc.label ?? ""} は閉じています`;
  return `${me.pc.label ?? ""} で動いている`;
}

/** いまの仕事を始めてからの経過（1 時間未満は分・24 時間未満は時間・それより前は日付） */
export function sinceText(startedAt: string, now: Date): string {
  const start = new Date(startedAt);
  const diff = Math.max(0, now.getTime() - start.getTime());
  if (diff < HOUR_MS) return `${Math.floor(diff / MIN_MS)} 分前から`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} 時間前から`;
  const [, m, d] = jstDate(start).split("-");
  return `${Number(m)}/${Number(d)} から`;
}

export type NextState = "queued" | "approved" | "stopped";
const STATE_TEXT: Record<NextState, string> = { queued: "順番待ち", approved: "承認済み", stopped: "止まった" };

/** このあとの状態の字と、橙で出すか（承認済み・止まったは人の手を離れた物） */
export function stateText(state: NextState): { text: string; warn: boolean } {
  return { text: STATE_TEXT[state] ?? state, warn: state !== "queued" };
}

/** AI が動いた時間（秒 → 小数 1 桁の時間。0 は「0h」） */
export function workTime(sec: number): string {
  if (sec <= 0) return "0h";
  return `${(sec / HOUR_SEC).toFixed(1)}h`;
}

/** 画面の名前（「高本のAI」）。名前が読めないあいだは「あなたのAI」（D-145.17） */
export const roomName = (me: CloneMe | undefined): string => (me?.name ? `${me.name}のAI` : "あなたのAI");
