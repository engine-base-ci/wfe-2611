// 問い合わせ 1 件のやり取り（K-1007）の、口の答え → 部品の値（画面の外の純粋な関数・@/ を読まない）。
//   答えの形は K-951 の getMyInquiry（本人だけ・社内メモは出ない）と、K-948 が足した context（D-156.39：{ path, at, browser, pc? }）。
//   時刻はどれも日本時間「MM/DD HH:MM」（K-956 の jstWhen を使う・同じ読み替えを 2 つ作らない）。何について の字も K-956 の表から引く
import { inquiryView, jstWhen, type InquiryIn } from "./help-shape";
import type { MessageView } from "./views";

export type ThreadState = InquiryIn["state"];

export interface AttachmentIn {
  id: string;
  name: string;
  size: number;
}
export interface MessageIn {
  id: string;
  from: "me" | "ops";
  author_name: string;
  body: string;
  attachments: AttachmentIn[];
  created_at: string;
}
/** いま見ている画面の情報（契約は path・at・browser・pc。screen は在れば使うだけ） */
export interface ContextIn {
  path?: string;
  screen?: string;
  browser?: string;
  pc?: boolean | null;
  at?: string;
}
export interface InquiryDetailIn extends InquiryIn {
  messages: MessageIn[];
  context: ContextIn | null;
}

export interface ThreadView {
  title: string;
  kind: string;
  sentAt: string;
  state: ThreadState;
  done?: true;
  messages: MessageView[];
}

/** 返事の長さの上限（字） */
export const REPLY_MAX = 4000;
const OPS_INITIAL = "運";
const SEP = " ・ ";

/** 日本時間の「HH:MM」 */
const jstClock = (iso: string): string => jstWhen(iso, true).split(" ")[1] ?? "";

function screenPart(c: ContextIn): string[] {
  const parts: string[] = [];
  const where = c.screen ?? c.path;
  if (where) parts.push(`画面 ${where}`);
  if (c.browser) parts.push(c.browser);
  if (typeof c.pc === "boolean") {
    const pc = c.pc ? "PC つながっている" : "PC つながっていない";
    parts.push(c.at ? `${pc}（${jstClock(c.at)}）` : pc);
  }
  return parts;
}

/** 付けた情報の 1 行：画面の情報と付けたファイルの名前を「 ・ 」でつなぐ。どちらも無ければ無し */
export function attachLine(context: ContextIn | null, attachments: readonly AttachmentIn[]): string | undefined {
  const parts = context ? screenPart(context) : [];
  if (attachments.length) parts.push(`ファイル ${attachments.map((a) => a.name).join("、")}`);
  return parts.length ? parts.join(SEP) : undefined;
}

const initialOf = (m: MessageIn): string =>
  m.from === "ops" ? OPS_INITIAL : (Array.from(m.author_name.trim())[0] ?? "");

/** 答え → やり取りの部品の値。付けた情報は最初の自分の書き込みにだけ画面の情報を付ける（ほかは付けたファイルだけ） */
export function threadView(a: InquiryDetailIn): ThreadView {
  const firstMine = a.messages.find((m) => m.from === "me")?.id;
  const messages = a.messages.map((m): MessageView => {
    const attach = attachLine(m.id === firstMine ? a.context : null, m.attachments);
    return {
      id: m.id,
      from: m.from,
      initial: initialOf(m),
      name: m.author_name,
      when: jstWhen(m.created_at, true),
      text: m.body,
      ...(attach ? { attach } : {}),
    };
  });
  return {
    title: a.title,
    // 何について の字は一覧の 1 行（K-956）と同じ表から（時刻は使わない）
    kind: inquiryView(a, 0).kind,
    sentAt: jstWhen(a.created_at, true),
    state: a.state,
    ...(a.state === "done" ? { done: true as const } : {}),
    messages,
  };
}

/** 返事の確かめ（口を呼ぶ前）。前後の空白（全角も）を落として空・上限を超える字は理由、通れば null */
export function replyProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return "返事を書いてください";
  if (Array.from(t).length > REPLY_MAX) return `返事は ${REPLY_MAX} 字までです`;
  return null;
}
