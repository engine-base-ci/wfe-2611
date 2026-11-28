// 届け先のグループを変える口（K-893）：updateClientRequest（PATCH /api/v1/client_requests/:id・D-155.43）。
//   入口（op.ts）が先に確かめる：ログイン・社内の人か（ゲストの文脈は 403）・上限・冪等・体の形（route_id だけ・strict・uuid）。
//   取引の中で app.client_request_set_route を 1 回呼ぶ（見える・直せる・決まっていない・選べる届け先を関数が見る＝守りの 2 層目）。
//   DB の断りは番号と hint で答えに写す（refusal）。返事の口（reply.ts）も同じ写しを使う。
//   ログには場所と例外の種類だけ（本文・人の id・例外の文を出さない・D-136.1）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { isUuid } from "@kaname/contracts";

/** 正本のエラーを、欄も明細も付けない答えにする（在るかを漏らさない・K893-API-004〜006） */
export function bare(status: number, code: string): HookReply {
  const body: Record<string, unknown> = { ...kanameError(code).toJSON() };
  delete body["detail"];
  return { status, body };
}

/** 入力の形違い（422・欄つき）。入口（op.ts）と同じ形 */
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 取引が落ちた：503・E-PAGE-003（何も残らない・止める側に倒す） */
export function unavailable(where: string, e: unknown): HookReply {
  console.error(`[client-requests] ${where}：書けなかった（${kindOf(e)}）`);
  const b = bare(503, "E-PAGE-003").body as Record<string, unknown>;
  return { status: 503, body: { ...b, error: "unavailable" } };
}

/** DB の関数が断った例外 → 答え。知らない例外は 503 */
export function refusal(where: string, e: unknown): HookReply {
  const x = (e ?? {}) as { code?: unknown; hint?: unknown };
  const code = typeof x.code === "string" ? x.code : "";
  const hint = typeof x.hint === "string" ? x.hint : "";
  if (code === "42501" && hint === "E-GST-100") return bare(404, "E-GST-100");
  if (code === "42501" && hint === "E-GST-111") return bare(404, "E-GST-111");
  if (code === "22023" && hint === "E-GST-110") return bare(409, "E-GST-110");
  if (code === "42501" && hint === "") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  return unavailable(where, e);
}

export function createUpdateClientRequest(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const route = a.input["route_id"];
    if (typeof route !== "string" || !isUuid(route)) return invalid("route_id", "届け先のグループを選んでください");
    let v: { route_name?: unknown } | null;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: { route_name?: unknown } | null }>(
          "select app.client_request_set_route($1::uuid, $2::uuid) as v",
          [a.id, route],
        );
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      return refusal("届け先を変える", e);
    }
    return { status: 200, body: { data: { route_name: String(v?.route_name ?? "") } } };
  };
}
