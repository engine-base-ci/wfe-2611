// 分身の部屋「話す」の字（K-762）：口の答え（K-757 の「画面が使う答えの形」）を部品（talk.tsx）の値に直す。
//   時刻と日付は日本時間。会話の字は書かれたとおり（HTML を作らない）。「見たもの」（took）は読まない（D-153.34）。
//   K-764・K-767 も toEntries を使う（同じ形で読む）
import type { ConvItem, Entry } from "./talk";

export type Who = "me" | "ai" | "stopped" | "note";
export interface MessageView {
  id: string;
  who: Who;
  text: string;
  at: string;
  job_id: string | null;
  passed: string[];
  proposal: Record<string, unknown> | null;
  took: string | null;
}
export interface WorkView {
  job_id: string;
  state: string;
  status: string | null;
  partial: string | null;
  elapsed_ms: number;
  stopping: boolean;
  last_at: string | null;
}
export interface StoppedView {
  job_id: string;
  reason: string;
}
export interface ConversationView {
  conversation: {
    id: string;
    title: string;
    talk_kind: string;
    ticket_id: string | null;
    updated_at: string;
  };
  messages: MessageView[];
  has_more: boolean;
  running_job_id: string | null;
  work: WorkView | null;
  stopped: StoppedView | null;
}
export interface ConversationRow {
  id: string;
  title: string | null;
  updated_at: string;
  last_text: string | null;
}

const JST_MS = 9 * 3600_000;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"] as const;
const WORKING = "考えています…";
const NEW_TITLE = "新しい会話";

const jst = (at: string): Date => new Date(new Date(at).getTime() + JST_MS);
/** 日本時間の YYYY-MM-DD */
export const jstDay = (at: string): string => jst(at).toISOString().slice(0, 10);
const pad = (n: number): string => String(n).padStart(2, "0");

/** HH:mm（日本時間） */
export function timeOf(at: string): string {
  const d = jst(at);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 日の見出し：今日なら「今日 M/D（曜）」・それ以外「M/D（曜）」 */
export function dayLabel(at: string, today: string): string {
  const d = jst(at);
  const md = `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WEEK[d.getUTCDay()]}）`;
  return jstDay(at) === today ? `今日 ${md}` : md;
}

/** 一覧の下の字：今日なら「今日 HH:mm」・それ以外「MM/DD」 */
export function convSub(updatedAt: string, today: string): string {
  if (jstDay(updatedAt) === today) return `今日 ${timeOf(updatedAt)}`;
  const d = jst(updatedAt);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
}

/** 一覧の見出し：「今日」「それ以前」 */
export const convGroup = (updatedAt: string, today: string): string =>
  jstDay(updatedAt) === today ? "今日" : "それ以前";

export function toConvItems(rows: readonly ConversationRow[], today: string): ConvItem[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? NEW_TITLE,
    sub: convSub(r.updated_at, today),
    group: convGroup(r.updated_at, today),
  }));
}

/** 会話の行（古い順）と作業中の様子 → 部品の並び。日本時間の日付が変わるところに日の見出し */
export function toEntries(messages: readonly MessageView[], work: WorkView | null, today: string): Entry[] {
  const out: Entry[] = [];
  let day = "";
  for (const m of messages) {
    if (m.proposal !== null) continue; // 作る画面の会話だけの行（この画面には来ない）
    const d = jstDay(m.at);
    if (d !== day) {
      out.push({ kind: "day", label: dayLabel(m.at, today) });
      day = d;
    }
    if (m.who === "note" || m.who === "stopped") out.push({ kind: "sys", text: m.text });
    else out.push({ kind: "msg", msg: { id: m.id, who: m.who, time: timeOf(m.at), body: m.text } });
  }
  if (work) {
    if (work.partial) out.push({ kind: "stream", text: work.partial });
    else out.push({ kind: "work", text: work.status || WORKING });
  }
  return out;
}

/** 古い行の続きの鍵：base64url(<いちばん古い行の at>|<その行の id>)（K-757 の「行の続きの鍵」） */
export function olderCursor(oldest: Pick<MessageView, "at" | "id">): string {
  const raw = new TextEncoder().encode(`${oldest.at}|${oldest.id}`);
  let bin = "";
  for (const b of raw) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface StopNotice {
  tone: "danger" | "info";
  title: string;
  text: string;
  /** 書く欄は書けない（PC が閉じている） */
  off: boolean;
}

/** 止まった理由の帯。PC が閉じていれば赤（書けない）・そうでなければ知らせ */
export function stopNotice(
  stopped: StoppedView | null,
  pc: { state: string; label: string | null } | undefined,
): StopNotice | null {
  if (!stopped) return null;
  if (pc?.state === "asleep")
    return {
      tone: "danger",
      title: "AI が止まりました",
      text: `止まった理由：${stopped.reason}。${pc.label ?? "PC"} を開くと、続きから話せます。送った言葉は残っています`,
      off: true,
    };
  return {
    tone: "info",
    title: "止まりました",
    text: `止まった理由：${stopped.reason}。続けるには、言葉を書いて送ってください`,
    off: false,
  };
}
