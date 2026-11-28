// 届いた依頼を読む口（K-892・K-71 の葉）：listClientRequests（一覧）・getClientRequest（1 件）。
//   見える判定（届け先のグループが見える人・会社全体の edit を持つ人）・形は DB の関数が持つ（migration 20261127095200・security definer）。
//   口は問い合わせを確かめ、関数を 1 回呼び、答えを HTTP に直すだけ。読むだけで何も書かない（既読の印も付けない）。
//   見えない・無い・消した・別の会社・前の取引先の形は 404・E-GST-100（欄・details なし・在るかを漏らさない）。
//   DB が落ちたら 503・E-PAGE-003（ログには場所と例外の種類だけ・題名や本文を出さない）
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

/** 一覧の問い合わせ state が取れる値（無し＝両方） */
const STATES: readonly string[] = ["live", "done"];

/** 正本のエラーを、欄なし・detail なしの形で */
const bare = (status: number, code: string): HookReply => {
  const j = kanameError(code).toJSON();
  return {
    status,
    body: {
      error: j.error,
      code: j.code,
      message: j.message,
      action: j.action,
      undo: j.undo,
      support_code: j.support_code,
    },
  };
};

const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

const down = (where: string, e: unknown): HookReply => {
  console.error(
    `[client-requests] ${where}：${e instanceof Error ? `例外（${e.name}）` : "例外"}なので止める側に倒した`,
  );
  return bare(503, "E-PAGE-003");
};

/** 問い合わせは state だけ・1 つだけ・live か done。知らない名前・空・重ねた値は 422 */
function stateOf(a: HookArgs): { state: string | null } | { reply: HookReply } {
  const qs = a.c.req.queries();
  for (const k of Object.keys(qs)) if (k !== "state") return { reply: invalid(k, "知らない問い合わせです") };
  const vs = qs["state"];
  if (!vs) return { state: null };
  if (vs.length !== 1 || !STATES.includes(vs[0]!)) return { reply: invalid("state", "live か done") };
  return { state: vs[0]! };
}

export function createListClientRequests(appPool: pg.Pool) {
  return async (a: HookArgs): Promise<HookReply> => {
    const q = stateOf(a);
    if ("reply" in q) return q.reply;
    try {
      const v = await withTenant(
        appPool,
        a.ctx,
        async (cl) => (await cl.query<{ v: unknown }>("select app.client_request_list($1) as v", [q.state])).rows[0]?.v,
      );
      return { status: 200, body: { data: v ?? { items: [], counts: { live: 0 } } } };
    } catch (e) {
      return down("届いた依頼の一覧", e);
    }
  };
}

export function createGetClientRequest(appPool: pg.Pool) {
  return async (a: HookArgs): Promise<HookReply> => {
    if (!a.id) return bare(404, "E-GST-100");
    try {
      const v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (await cl.query<{ v: unknown }>("select app.client_request_get($1::uuid) as v", [a.id])).rows[0]?.v ?? null,
      );
      if (!v) return bare(404, "E-GST-100");
      return { status: 200, body: { data: v } };
    } catch (e) {
      return down("届いた依頼の 1 件", e);
    }
  };
}
