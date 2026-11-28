// 見直すページを読む口（K-695・契約の口 getKnowledgeReview・GET /api/v1/knowledge/review）。読むだけ（DB に書かない・お知らせ・AI・証跡なし）。
//   1 つの取引の中で：今の人が見られる人（app.kn_can_approve＝管理者かどれかのグループのマネージャー）でなければ 403 →
//   使われていない（app.kn_review_unused）・食い違っている（app.kn_review_conflicts）・よく破られる（app.kn_review_broken）を各 50 件まで（文は 4 つ）。
//   行は自分が書ける棚の公開済みページだけ（DB の関数が決める）。DB の失敗は 503。ログに題名・本文を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { forbidden, unavailable } from "./reply.js";
import { placeText } from "./shape.js";

/** 3 つの一覧それぞれの上限（管理の数 app.kn_review_count も同じ上限で数える） */
export const KNOWLEDGE_REVIEW_LIMIT = 50;

/** 点の文で 1 行を見せる長さ（コードポイント）。超えたら切って … を付ける */
const LINE_MAX = 60;

/** 破られ方の種類ごとの決まった文（K-700 の 3 つの出来事） */
export const BREACH_HOW: Readonly<Record<string, string>> = {
  ai_unchecked: "AI が終わりを知らせたのに、チェックが付いていなかった",
  human_unchecked: "AI が付けたチェックを人が外した",
  ai_self_reported: "AI が守れていなかったと知らせて直した",
};

const lineText = (line: string | null | undefined): string => {
  const t = (line ?? "").trim();
  if (t === "") return "（この行はありません）";
  const cps = Array.from(t);
  return cps.length > LINE_MAX ? `${cps.slice(0, LINE_MAX).join("")}…` : t;
};

/** 食い違いの点：「<上の棚>は「<上の行>」、<下の棚>は「<下の行>」と書いてあります」 */
export function pointText(
  upperShelf: string,
  lowerShelf: string,
  upperLine: string | null | undefined,
  lowerLine: string | null | undefined,
): string {
  return `${upperShelf}は「${lineText(upperLine)}」、${lowerShelf}は「${lineText(lowerLine)}」と書いてあります`;
}

/** 破られ方：「いちばん多い：<種類の文>（<n> 回）」 */
export function howText(kind: string, n: number): string {
  return `いちばん多い：${BREACH_HOW[kind] ?? kind}（${n} 回）`;
}

const CAN_SQL = "select app.kn_can_approve() as ok";
const UNUSED_SQL = "select id, title, shelf_name, folders, last_opened_at from app.kn_review_unused($1)";
const CONFLICTS_SQL = `select upper_id, upper_title, upper_shelf, upper_folders, lower_id, lower_title, lower_shelf, lower_folders,
       upper_line, lower_line from app.kn_review_conflicts($1)`;
const BROKEN_SQL = "select id, title, shelf_name, folders, cnt, top_kind, top_kind_count from app.kn_review_broken($1)";

interface UnusedRow {
  id: string;
  title: string;
  shelf_name: string;
  folders: string[] | null;
  last_opened_at: Date | string | null;
}
interface ConflictRow {
  upper_id: string;
  upper_title: string;
  upper_shelf: string;
  upper_folders: string[] | null;
  lower_id: string;
  lower_title: string;
  lower_shelf: string;
  lower_folders: string[] | null;
  upper_line: string | null;
  lower_line: string | null;
}
interface BrokenRow {
  id: string;
  title: string;
  shelf_name: string;
  folders: string[] | null;
  cnt: number;
  top_kind: string;
  top_kind_count: number;
}

const iso = (v: Date | string | null): string | null =>
  v === null ? null : (v instanceof Date ? v : new Date(v)).toISOString();

const unusedOf = (r: UnusedRow) => ({
  id: r.id,
  title: r.title,
  place: placeText(r.shelf_name, r.folders ?? []),
  last_opened_at: iso(r.last_opened_at),
});

const conflictOf = (r: ConflictRow) => ({
  id: `${r.upper_id}:${r.lower_id}`,
  upper: { id: r.upper_id, title: r.upper_title, place: placeText(r.upper_shelf, r.upper_folders ?? []) },
  lower: { id: r.lower_id, title: r.lower_title, place: placeText(r.lower_shelf, r.lower_folders ?? []) },
  point: pointText(r.upper_shelf, r.lower_shelf, r.upper_line, r.lower_line),
});

const brokenOf = (r: BrokenRow) => ({
  id: r.id,
  title: r.title,
  place: placeText(r.shelf_name, r.folders ?? []),
  count: r.cnt,
  how: howText(r.top_kind, r.top_kind_count),
});

async function run(cl: pg.PoolClient): Promise<HookReply> {
  const can = (await cl.query<{ ok: boolean }>(CAN_SQL)).rows[0];
  if (can?.ok !== true) return forbidden();
  const unused = (await cl.query<UnusedRow>(UNUSED_SQL, [KNOWLEDGE_REVIEW_LIMIT])).rows.map(unusedOf);
  const conflicts = (await cl.query<ConflictRow>(CONFLICTS_SQL, [KNOWLEDGE_REVIEW_LIMIT])).rows.map(conflictOf);
  const broken = (await cl.query<BrokenRow>(BROKEN_SQL, [KNOWLEDGE_REVIEW_LIMIT])).rows.map(brokenOf);
  // Cache-Control: private, no-store は認証の要る答えに入口（app.ts）が付ける
  return { status: 200, body: { data: { unused, conflicts, broken } } };
}

export function createGetKnowledgeReview(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl));
    } catch (e) {
      console.error(`[knowledge] 見直すページを読めなかった（${e instanceof Error ? e.name : typeof e}）`);
      return unavailable();
    }
  };
}
