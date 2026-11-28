// 本文の書きかけの写し（この PC のブラウザの中だけ・K-447）。口には書き終えたときだけ送る（K-432 の決め）。
//   鍵はチケットごとに 1 つ kaname.ticket-draft.body.<id>（頭 kaname.ticket-draft はログアウトとほかの 401 の clearDraftCopies が消す頭）。
//   中身は { savedAt: ISO の時刻（秒まで）, doc: 文書の木, base: 書き始めた版 }。読めない写しは null（捨てる）。
//   @/ を読まない純粋な関数と localStorage の出し入れだけ（置けない・読めないときは例外を外に出さない）
import type { Doc } from "@kaname/contracts";

/** 直してから写しを置くまでの間（打つたびに置かず、まとめて置く） */
export const COPY_DELAY_MS = 600;

const PREFIX = "kaname.ticket-draft.body.";

export interface BodyCopy {
  savedAt: string;
  doc: Doc;
  base: number;
}

export const copyKey = (ticketId: string): string => `${PREFIX}${ticketId}`;

/** 空の文書の木 */
export const EMPTY_DOC: Doc = { type: "doc", content: [] } as Doc;

/** 文書の木に見えるか（type が doc で content が並び） */
export function isDocTree(v: unknown): v is Doc {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as { type?: unknown; content?: unknown };
  return o.type === "doc" && Array.isArray(o.content);
}

/** 写しの字を読む。JSON でない・doc が木でない・base が整数でない・savedAt が字でないときは null */
export function readCopy(raw: string | null): BodyCopy | null {
  if (raw === null) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as { savedAt?: unknown; doc?: unknown; base?: unknown };
  if (typeof o.savedAt !== "string" || !Number.isInteger(o.base) || !isDocTree(o.doc)) return null;
  return { savedAt: o.savedAt, doc: o.doc, base: o.base as number };
}

/** 今の時刻を ISO の字で（ミリ秒を落とす：2026-11-21T01:42:00Z） */
export const nowIso = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** この PC の写しを読む（読めない写しは消して null） */
export function loadCopy(ticketId: string): BodyCopy | null {
  try {
    const raw = window.localStorage.getItem(copyKey(ticketId));
    const c = readCopy(raw);
    if (raw !== null && !c) window.localStorage.removeItem(copyKey(ticketId));
    return c;
  } catch {
    return null;
  }
}

/** 写しを置く。置けたら true（置けない・例外なら false） */
export function writeCopy(ticketId: string, copy: BodyCopy): boolean {
  try {
    window.localStorage.setItem(copyKey(ticketId), JSON.stringify(copy));
    return true;
  } catch {
    return false;
  }
}

export function removeCopy(ticketId: string): void {
  try {
    window.localStorage.removeItem(copyKey(ticketId));
  } catch {
    // 置き場が使えない：消す物も無い
  }
}

const CLOCK = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 日本時間の HH:MM（読めない時刻は空） */
export function clockLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : CLOCK.format(d);
}

/** 2 つの木が同じか（JSON で比べる） */
export const sameDoc = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
