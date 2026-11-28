// グループの依頼 1 件を読む口（K-907）：getPortalRequest（GET /api/v1/portal/requests/:id・D-155.37・D-155.42）。
//   答えは DB の関数 app.portal_request_get(:id) が組む：request（id・title・from_name・group_name・created_at・state・断った依頼だけ declined_reason）・
//   messages（1 件目が依頼の本文・続いて種類 message の行だけを古い順・side は guest→they／company→we）・can_write（open のときだけ true）。
//   自分のゲストのグループの依頼でない（別のグループ・別の会社・消した・無い id）→ 関数が null → 404・NOT_FOUND（欄なし・題を出さない）。
//   ゲストでない（42501）→ 403・DB が落ちた → 503・E-PAGE-003。書いた字はそのまま返す（字として出すのは画面・K-912）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { FORBIDDEN, NOT_FOUND, kindOf, unavailable } from "./request-create.js";

export function createGetPortalRequest(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    if (!a.id) return NOT_FOUND;
    let v: unknown;
    try {
      v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (await cl.query<{ v: unknown }>("select app.portal_request_get($1::uuid) as v", [a.id])).rows[0]?.v ?? null,
      );
    } catch (e) {
      if (kindOf(e) === "42501") return FORBIDDEN;
      console.error(`[portal] 依頼を読む取引が落ちた（${kindOf(e)}）`);
      return unavailable();
    }
    if (v === null) return NOT_FOUND;
    return { status: 200, body: { data: v } };
  };
}
