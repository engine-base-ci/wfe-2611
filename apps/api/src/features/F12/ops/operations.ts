// 運営が操作を読む（K-1010・listOperations・GET /api/v1/ops/operations・D-156.21・D-156.15・D-126.19）。
//   読むだけ（上げる・直すは作らない）。配るものを持つ運営の人は入口（契約の ops:distribute）、関数の頭でもう一度（ops_require）。
//   opsTx の 1 取引で app.ops_operations を 1 回呼ぶ → 200 { data }。1 行は { id, key, name, version_label, description, check_state }
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

const WHERE = "operations";

export function createListOperations(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const rows = await opsTx(
        appPool,
        a.ctx,
        async (cl) => (await cl.query<{ v: unknown }>("select app.ops_operations() as v")).rows[0]?.v,
      );
      return { status: 200, body: { data: rows ?? [] } };
    } catch (e) {
      return opsErrorReply(e, WHERE);
    }
  };
}
