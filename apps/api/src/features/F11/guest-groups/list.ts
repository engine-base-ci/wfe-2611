// ゲストのグループの一覧の口（K-876）：listGuestGroups（GET /api/v1/guest-groups・D-155.39・D-155.40）。読むだけ（DB に書かない・外も呼ばない）。
//   中身は DB の関数 app.guest_groups_list() が呼んだ人の会社だけで作る（消していないグループを名前の順に、届け先・ゲスト・招待中つき）。
//   権限（members の view か invite）は関数が確かめ、足りなければ 42501 → 403。ゲスト（取引先の文脈）は入口が 403。
//   取引は 1 つ・文は 1 つ。Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける。DB が落ちたら 503・E-PAGE-003（ログは例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { forbidden, kindOf, pgCode } from "./create.js";

export function createListGuestGroups(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    try {
      const groups = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: unknown }>("select app.guest_groups_list() as v");
        return r.rows[0]?.v ?? [];
      });
      return { status: 200, body: { data: { groups } } };
    } catch (e) {
      if (pgCode(e) === "42501") return forbidden();
      console.error(`[guest-groups] 一覧を読めなかった（${kindOf(e)}）`);
      return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
    }
  };
}
