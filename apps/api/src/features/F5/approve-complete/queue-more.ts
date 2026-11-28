// 承認待ちを種類で絞る・並べ替える（K-748・D-153.10・D-153.30・D-153.32）の問い合わせの読みと「何件目から」の鍵。
//   kind（artifact・handover）・sort（due・waiting・title）は、付いていれば（空の値も）決まった値だけ。それ以外と知らない欄は 422（欄名つき）。
//   本線の入口は空の値を指定なしと扱うので、ここは a.c.req.query() を生で読んで空も断る。
//   kind か sort が付いた要求の続きの鍵は「何件目から」（o|<0 以上の整数> を base64url）。付かない要求の鍵は今のまま（queue.ts の decodeKey）。
import type { HookReply } from "../../../contract/deps.js";
import { invalid } from "./errors.js";

export const QUEUE_KINDS = ["artifact", "handover"] as const;
export const QUEUE_SORTS = ["due", "waiting", "title"] as const;
export type QueueKind = (typeof QUEUE_KINDS)[number];
export type QueueSort = (typeof QUEUE_SORTS)[number];

/** この口が受ける問い合わせの欄（ほかは 422） */
const KNOWN = new Set(["kind", "sort", "limit", "cursor"]);
const OFFSET_RE = /^o\|(0|[1-9][0-9]{0,8})$/;

export interface QueueQuery {
  /** kind か sort が付いた（絞る・並べる道） */
  shaped: boolean;
  kind: QueueKind | null;
  sort: QueueSort | null;
}

const isOne = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);

/** 問い合わせを読む。形が違えば 422 の答えを返す */
export function readQueueQuery(q: Record<string, string>): QueueQuery | { reply: HookReply } {
  const unknown = Object.keys(q).find((k) => !KNOWN.has(k));
  if (unknown !== undefined) return { reply: invalid(unknown, "この一覧では使えない問い合わせです") };
  const kind = q["kind"];
  const sort = q["sort"];
  if (kind !== undefined && !isOne(QUEUE_KINDS, kind))
    return { reply: invalid("kind", `${QUEUE_KINDS.join("・")} のどれか`) };
  if (sort !== undefined && !isOne(QUEUE_SORTS, sort))
    return { reply: invalid("sort", `${QUEUE_SORTS.join("・")} のどれか`) };
  return {
    shaped: kind !== undefined || sort !== undefined,
    kind: (kind as QueueKind | undefined) ?? null,
    sort: (sort as QueueSort | undefined) ?? null,
  };
}

/** 「何件目から」の鍵を作る */
export const encodeOffset = (n: number): string => Buffer.from(`o|${n}`, "utf8").toString("base64url");

/** 「何件目から」の鍵を読む。負・整数でない・形が違えば null */
export function decodeOffset(cursor: string): number | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) return null;
  const text = Buffer.from(cursor, "base64url").toString("utf8");
  if (Buffer.from(text, "utf8").toString("base64url") !== cursor) return null; // 復号して戻らない＝壊れている
  const m = OFFSET_RE.exec(text);
  return m ? Number(m[1]) : null;
}
