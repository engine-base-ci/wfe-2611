// 運営がお知らせを読む（listOpsNotices・GET /api/v1/ops/notices／getOpsNotice・GET /api/v1/ops/notices/:id）（K-977・関門 C2・
//   D-156.3・D-156.33・D-156.57・D-156.82）。読むだけ（DB に書かない・運営の記録も既読の行も書かない）。振る舞いの本体は DB の関数
//   app.ops_notices・app.ops_notice_detail（20261128011700_ops_notices_read.sql）。上限・認証・notice を持つ運営の人だけ（ops:notice）・
//   kind／state の値・:id の形は契約の入口（op.ts）が先に確かめる。ここでも値の形を確かめ（入口に頼らない 2 層目）、opsTx の 1 取引で関数を 1 回呼ぶ。
//   一覧は 101 件を引き、101 件目があれば捨てて 100 件を返す（cursor・limit は入口の形の確かめだけ）。
//   DB の断りは opsErrorReply（K-947・無い・見えない 1 件は 404 で欄なし）。関数を呼ぶ権限が外れている（落ちている）は 503（題を返さない・G-15）。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { opsErrorReply, opsTx } from "../db.js";
import { toOpsNoticeDetail, toOpsNoticeRow } from "./shape.js";

/** 返す件数の上限 */
export const LIST_MAX = 100;
export const KINDS = ["incident", "maintenance", "release"] as const;
export const STATES = ["draft", "scheduled", "published", "resolved"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Issue {
  field: string;
  message: string;
}

const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

const pick = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  field: string,
  issues: Issue[],
): T | null => {
  if (raw === undefined || raw === "") return null;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  issues.push({ field, message: allowed.join("・") });
  return null;
};

/** 関数を呼ぶ権限が外れている（DB の落ち）は 503。運営の確かめ（app.ops_require）の断りは opsErrorReply の 403 のまま */
function readErrorReply(e: unknown): HookReply {
  const err = e as { code?: unknown; routine?: unknown } | null;
  if (err?.code === "42501" && err.routine === "aclcheck_error") {
    console.error("[ops] notices の DB の関数を呼べない（42501）");
    return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
  }
  return opsErrorReply(e, "notices");
}

export function createListOpsNotices(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const q = a.c.req.query();
    const issues: Issue[] = [];
    const kind = pick(q["kind"], KINDS, "kind", issues);
    const state = pick(q["state"], STATES, "state", issues);
    if (issues.length) return invalid(issues);
    try {
      const rows = await opsTx(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ j: unknown }>("select app.ops_notices($1, $2, $3) as j", [
          kind,
          state,
          LIST_MAX + 1,
        ]);
        return r.rows[0]?.j;
      });
      if (!Array.isArray(rows)) throw new Error("お知らせの一覧の答えが配列でない");
      if (rows.length > LIST_MAX) console.warn("[notices] 運営の一覧を 100 件で切った");
      return { status: 200, body: { data: rows.slice(0, LIST_MAX).map(toOpsNoticeRow) } };
    } catch (e) {
      return readErrorReply(e);
    }
  };
}

export function createGetOpsNotice(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const id = a.id ?? "";
    if (!UUID.test(id)) return invalid([{ field: "id", message: "uuid の形" }]);
    try {
      const data = await opsTx(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ j: unknown }>("select app.ops_notice_detail($1::uuid) as j", [id]);
        return r.rows[0]?.j;
      });
      return { status: 200, body: { data: toOpsNoticeDetail(data) } };
    } catch (e) {
      return readErrorReply(e);
    }
  };
}
