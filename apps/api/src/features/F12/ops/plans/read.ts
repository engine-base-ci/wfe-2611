// 配るもの › プランを読む口 3 本（K-987・関門 C2・D-156.3・D-156.21・D-156.63・D-128.72）。
//   listOpsPlans（GET /api/v1/ops/plans）・listPlanProposals（GET /api/v1/ops/plan_proposals）・listPlanHistory（GET /api/v1/ops/plan_history）。
//   読むだけ（DB に書かない・運営の記録も書かない）。振る舞いの本体は DB の関数 app.ops_plans・app.ops_plan_proposals・app.ops_plan_history
//   （20261128012700_ops_plans_read.sql）。上限・認証・運営の人か（ops:any）・state／plan_key の値の形は契約の入口（op.ts）が先に確かめ、
//   値段の案か値段を決めるを持つかは関数（app.ops_plan_caps_ok）が見る。ここでも問い合わせの値を確かめ（入口に頼らない 2 層目）、
//   opsTx の 1 取引で関数を 1 回呼ぶ。一覧は 101 件を引き、101 件目があれば捨てて 100 件を返す（cursor は入口の形の確かめだけ）。
//   DB の断りは opsErrorReply（K-947）。関数を呼ぶ権限が外れている（落ちている）は 503（空の一覧を返さない・G-15）。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { opsErrorReply, opsTx } from "../db.js";

/** 返す件数の上限 */
export const LIST_MAX = 100;
export const PROPOSAL_STATES = ["draft", "waiting", "decided", "returned"] as const;
export const PLAN_KEYS = ["free", "team", "business"] as const;
/** 一覧の口が受ける問い合わせの名前（絞り込みのほか、入口が形を確かめる cursor・limit・sort） */
const PAGING = ["cursor", "limit", "sort"] as const;

interface Issue {
  field: string;
  message: string;
}

const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 問い合わせの値を 1 つ確かめる。空の値は指定なし。知らない名前（plan_id など）は 422 */
function parseFilter<T extends string>(
  raw: Record<string, string>,
  field: string,
  allowed: readonly T[],
): { ok: true; value: T | null } | { ok: false; details: Issue[] } {
  const issues: Issue[] = Object.keys(raw)
    .filter((k) => k !== field && !(PAGING as readonly string[]).includes(k))
    .map((k) => ({ field: k, message: "この一覧では受けない" }));
  const v = raw[field];
  if (v !== undefined && v !== "" && !(allowed as readonly string[]).includes(v))
    issues.push({ field, message: allowed.join("・") });
  if (issues.length) return { ok: false, details: issues };
  return { ok: true, value: v === undefined || v === "" ? null : (v as T) };
}

/** 関数を呼ぶ権限が外れている（DB の落ち）は 503。運営の確かめ・値段の印の断りは opsErrorReply の 403 のまま */
function readErrorReply(e: unknown): HookReply {
  const err = e as { code?: unknown; routine?: unknown } | null;
  if (err?.code === "42501" && err.routine === "aclcheck_error") {
    console.error("[ops] plans の DB の関数を呼べない（42501）");
    return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
  }
  return opsErrorReply(e, "plans");
}

/** 運営の文脈の 1 取引で関数を 1 回呼び、答えの配列を返す。配列でなければ投げる（503） */
async function callList(appPool: pg.Pool, a: HookArgs, sql: string, params: unknown[]): Promise<unknown[]> {
  const v = await opsTx(appPool, a.ctx, async (cl) => {
    const r = await cl.query<{ j: unknown }>(sql, params);
    return r.rows[0]?.j;
  });
  if (!Array.isArray(v)) throw new Error("プランの答えが配列でない");
  return v;
}

/** 101 件目があれば捨てて 100 件にする */
const cut = (rows: unknown[]): unknown[] => {
  if (rows.length > LIST_MAX) console.warn("[ops] plans の一覧を 100 件で切った");
  return rows.slice(0, LIST_MAX);
};

export function createListOpsPlans(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const rows = await callList(appPool, a, "select app.ops_plans() as j", []);
      return { status: 200, body: { data: rows } };
    } catch (e) {
      return readErrorReply(e);
    }
  };
}

export function createListPlanProposals(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const parsed = parseFilter(a.c.req.query(), "state", PROPOSAL_STATES);
    if (!parsed.ok) return invalid(parsed.details);
    try {
      const rows = await callList(appPool, a, "select app.ops_plan_proposals($1, $2) as j", [
        parsed.value,
        LIST_MAX + 1,
      ]);
      return { status: 200, body: { data: cut(rows) } };
    } catch (e) {
      return readErrorReply(e);
    }
  };
}

export function createListPlanHistory(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const parsed = parseFilter(a.c.req.query(), "plan_key", PLAN_KEYS);
    if (!parsed.ok) return invalid(parsed.details);
    try {
      const rows = await callList(appPool, a, "select app.ops_plan_history($1, $2) as j", [parsed.value, LIST_MAX + 1]);
      return { status: 200, body: { data: cut(rows) } };
    } catch (e) {
      return readErrorReply(e);
    }
  };
}
