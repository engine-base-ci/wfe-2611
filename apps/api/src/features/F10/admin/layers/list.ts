// 層の一覧の口（K-803）：listLayers（GET /api/v1/layers・A117・D-125.116）。読むだけ（DB に書かない・外も呼ばない）。
//   会社の人なら誰でも読める（契約の perm は read・入口が先に確かめる）。中身は DB の関数 app.layer_list() が
//   呼んだ人の会社の消していない層だけで作る（order_no の順・1 件は 6 つの鍵・group_count）。取引は 1 つ・文は 1 つ。ページを持たない（8 段まで）
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける。DB が落ちたら 503・E-PAGE-003
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { down, kindOf } from "../gate.js";
import { LAYER_KEYS } from "./input.js";

const pick = (v: unknown): Record<string, unknown> => {
  const src = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return Object.fromEntries(LAYER_KEYS.filter((k) => Object.hasOwn(src, k)).map((k) => [k, src[k]]));
};

export async function listLayers(d: { appPool: pg.Pool }, a: HookArgs): Promise<HookReply> {
  try {
    const v = await withTenant(d.appPool, a.ctx, async (c) => {
      const r = await c.query<{ v: unknown[] }>("select app.layer_list() as v");
      return r.rows[0]!.v;
    });
    const data = (Array.isArray(v) ? v : []).map(pick);
    return {
      status: 200,
      body: { data, meta: { limit: data.length } },
      headers: { "Cache-Control": "private, no-store" },
    } as HookReply;
  } catch (e) {
    return down("層の一覧", `読めなかった（${kindOf(e)}）`);
  }
}
