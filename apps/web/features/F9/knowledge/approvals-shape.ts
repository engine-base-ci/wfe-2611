// K-694「管理 › 承認待ち」の形：口の答え（listKnowledgeApprovals・K-688）を部品の行（ApprovalItem）に直す・
//   管理の道と面の読み方・断る理由の確かめ・お知らせの字・行を消す。
//   画面の外の純粋な関数だけ（@/ を読まない・元の値を変えない）。答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章と K-688 の md
import type { ApprovalItem } from "./types";

// ---------------------------------------------------------------- 口の答えの形
export interface SimilarAnswer {
  page_id: string;
  title: string;
  /** 似たページの場所（「営業 › 見積もり」） */
  place: string;
}
/** 承認待ちの 1 行（11 鍵） */
export interface ApprovalAnswer {
  id: string;
  kind: "raise" | "share";
  from_name: string;
  from_shelf_name: string;
  to_shelf_name: string;
  title: string;
  desc: string;
  message: string | null;
  requested_at: string;
  similar: SimilarAnswer | null;
  /** 本文（フォルダの共有は null） */
  body: { doc: unknown; text: string } | null;
}

// ---------------------------------------------------------------- 一覧の行
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 頼んだ時刻を日本時間の「月/日 時:分」にする（「11/21 16:20」）。読めない時刻は空 */
export function approvalAt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + JST_OFFSET_MS);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** 似たページの注意の字 */
export function similarText(s: SimilarAnswer): string {
  return `${s.place} の「${s.title}」と似ています。先に並べて確かめてください。`;
}

/** 口の答えの並びを部品の行の並びにする（ひとこと・似たページが無い行はその鍵を持たない） */
export function approvalItems(answer: readonly ApprovalAnswer[]): ApprovalItem[] {
  return answer.map((r) => ({
    id: r.id,
    kind: r.kind,
    from: r.from_name,
    fromShelf: r.from_shelf_name,
    toShelf: r.to_shelf_name,
    title: r.title,
    desc: r.desc,
    at: approvalAt(r.requested_at),
    ...(r.message !== null ? { message: r.message } : {}),
    ...(r.similar ? { similar: similarText(r.similar) } : {}),
  }));
}

// ---------------------------------------------------------------- 管理の道と面
export type AdminListKey = "approvals" | "review";
export type KnowledgeView = "pages" | "admin";
export interface AdminState {
  view: KnowledgeView;
  list: AdminListKey;
}

/** 管理の一覧の道（新しい住所は作らず /knowledge の問い合わせで持つ） */
export function adminHref(list: AdminListKey): string {
  return `/knowledge?view=admin&list=${list}`;
}

/** 道の問い合わせを面と一覧にする：view が admin のときだけ管理の面・list が review のときだけ見直すページ */
export function adminState(q: { view: string | null; list: string | null }): AdminState {
  return {
    view: q.view === "admin" ? "admin" : "pages",
    list: q.list === "review" ? "review" : "approvals",
  };
}

/** 一覧の登録があるか（無い一覧の入口は押せない形にする） */
export function isListReady(key: AdminListKey, registered: readonly AdminListKey[]): boolean {
  return registered.includes(key);
}

// ---------------------------------------------------------------- 承認・断る
export const DECLINE_MAX = 1000;
export const DECLINE_EMPTY = "理由を入れてください";
export const DECLINE_TOO_LONG = "理由は 1,000 字までです";
export const DECLINE_DONE = "断りました。理由は頼んだ人のページに出ます。";

/** 断る理由の確かめ（空白だけ＝全角の空白も・前後の空白を落として 1,000 字を超える）。よければ null */
export function declineProblem(reason: string): string | null {
  const t = reason.trim();
  if (!t) return DECLINE_EMPTY;
  if ([...t].length > DECLINE_MAX) return DECLINE_TOO_LONG;
  return null;
}

/** 承認したお知らせの字 */
export function approveDoneText(title: string): string {
  return `「${title}」を承認しました。`;
}

/** 行を消した新しい並び（元は変えない） */
export function removeApproval<T extends { id: string }>(list: readonly T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}
