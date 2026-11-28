// K-696「管理 › 見直すページ」の形（画面の外の純粋な関数・@/ を読まない）：
//   口 getKnowledgeReview（K-695）の答え → 部品 ReviewView の行・AI が最後に開いた日の字（日本時間）・開く道・50 件の注記・空の字・書き始める条件
import type { BrokenRow, ConflictRow, UnusedRow } from "./types";

/** 口が 1 つの並びに返す上限（K-695 の KNOWLEDGE_REVIEW_LIMIT と同じ） */
export const REVIEW_LIMIT = 50;

export interface ReviewPageRef {
  id: string;
  title: string;
  place: string;
}
export interface ReviewAnswer {
  unused: readonly { id: string; title: string; place: string; last_opened_at: string | null }[];
  conflicts: readonly { id: string; upper: ReviewPageRef; lower: ReviewPageRef; point: string }[];
  broken: readonly { id: string; title: string; place: string; count: number; how: string }[];
}
export type ReviewListKey = "unused" | "conflicts" | "broken";

export interface ReviewRows {
  unused: UnusedRow[];
  conflicts: ConflictRow[];
  broken: BrokenRow[];
  /** 食い違いの行の id → 上と下のページの id */
  pairs: Record<string, { upperId: string; lowerId: string }>;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 日本時間の「AI が最後に開いた：yyyy/mm/dd」。1 度も開かれていなければ「1 度も無い」 */
export function lastOpenedText(iso: string | null): string {
  const head = "AI が最後に開いた：";
  if (!iso) return `${head}1 度も無い`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return `${head}1 度も無い`;
  const d = new Date(t + JST_OFFSET_MS);
  return `${head}${d.getUTCFullYear()}/${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}`;
}

/** 口の鍵から部品の行へ組み替える（元の答えは書き換えない） */
export function reviewRows(answer: ReviewAnswer): ReviewRows {
  return {
    unused: answer.unused.map((r) => ({
      id: r.id,
      title: r.title,
      place: r.place,
      lastOpened: lastOpenedText(r.last_opened_at),
    })),
    conflicts: answer.conflicts.map((r) => ({
      id: r.id,
      upper: r.upper.title,
      upperPlace: r.upper.place,
      lower: r.lower.title,
      lowerPlace: r.lower.place,
      point: r.point,
    })),
    broken: answer.broken.map((r) => ({ id: r.id, title: r.title, place: r.place, count: r.count, how: r.how })),
    pairs: Object.fromEntries(answer.conflicts.map((r) => [r.id, { upperId: r.upper.id, lowerId: r.lower.id }])),
  };
}

/** そのページを開く道（書き方を直すは ?edit=1） */
export function reviewPageHref(id: string, edit = false): string {
  return `/knowledge/${encodeURIComponent(id)}${edit ? "?edit=1" : ""}`;
}

/** 上限ちょうどの並びにだけ出す注記 */
export function capNote(n: number): string | null {
  return n === REVIEW_LIMIT ? `多い順に ${REVIEW_LIMIT} 件まで出しています。` : null;
}

/** 道に edit=1 があり、そのページを書ける人だけ書き始める */
export function startsEditing(search: string, canEdit: boolean): boolean {
  return canEdit && new URLSearchParams(search).get("edit") === "1";
}

const EMPTY_TEXT: Record<ReviewListKey, string> = {
  unused: "使われていないページはありません",
  conflicts: "食い違っているページはありません",
  broken: "よく破られる決まりはありません",
};
/** 1 つの一覧が 0 件のときの字 */
export function reviewEmptyText(key: ReviewListKey): string {
  return EMPTY_TEXT[key];
}
