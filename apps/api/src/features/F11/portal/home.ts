// 先方の場所のホームを読む口（K-906）：getPortalHome（GET /api/v1/portal・D-155.37・D-155.41・D-155.44）。
//   答えは DB の関数 app.portal_home() が組む（グループの名前・会社の名前・届け先の社内のグループの名前・本人・初めてか・グループの依頼・見せてもらったチケット）。
//   期限・担当・確認してほしいもの（検収）は返さない。初めての読みのときだけ、同じ取引で証跡 portal.first_visit を 1 行書く。
//   K-913：問い合わせ visit=elsewhere（ホーム以外の画面の外枠の読み）は印を付けない。ほかの値は DB を呼ぶ前に 422（visitMark）。
//   ゲストでない人（関数の 42501）→ 403・FORBIDDEN。DB が落ちた → 503・E-PAGE-003（ログには例外の種類だけ・何も残らない）。
//   Cache-Control: private, no-store は入口の app.ts が全部の答えに付ける。
//   3 つの読む口（ホーム・1 件・お知らせ）が共に使う「関数を 1 回呼んで答えに倒す」形もここに置く（readPortal）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
export const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };

const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 関数を 1 回呼んで v を返す。42501 は 403・ほかの例外は 503。null の答え（見えない）は onNull */
export async function readPortal(
  appPool: pg.Pool,
  a: HookArgs,
  sql: string,
  params: unknown[],
  onNull: HookReply = NOT_FOUND,
): Promise<HookReply> {
  let v: unknown;
  try {
    v = await withTenant(
      appPool,
      a.ctx,
      async (cl) => (await cl.query<{ v: unknown }>(sql, params)).rows[0]?.v ?? null,
    );
  } catch (e) {
    if (kindOf(e) === "42501") return FORBIDDEN;
    console.error(`[portal] 先方の場所を読む取引が落ちた（${kindOf(e)}）`);
    return unavailable();
  }
  if (v === null) return onNull;
  return { status: 200, body: { data: v } };
}

/**
 * 問い合わせ visit の読み分け（K-913・代表の決め answer=b187f0c59dec：「初めて」の印はホームを開いたときだけ）。
 *   無い・空 → ホームの読み（印を付ける）／"elsewhere" → ホーム以外の画面の外枠の読み（印を付けない）／ほか → null（422）。
 *   入口（contract/op.ts の list の枝）は visit を見ないので、口が DB を呼ぶ前に自分で確かめる
 */
export function visitMark(visit: string | undefined): boolean | null {
  if (visit === undefined || visit === "") return true;
  if (visit === "elsewhere") return false;
  return null;
}

const BAD_VISIT: HookReply = {
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field: "visit", message: "elsewhere か、指定なし" }],
  },
};

export function createGetPortalHome(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const mark = visitMark(a.c.req.query("visit"));
    if (mark === null) return BAD_VISIT;
    return readPortal(appPool, a, "select app.portal_home($1) as v", [mark], unavailable());
  };
}
