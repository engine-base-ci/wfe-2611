// 層を直す口（K-803）：updateLayer（PATCH /api/v1/layers/:id・A117・D-125.116・D-154.7・D-154.8・D-154.21・関門 C2）。
//   名前を直す・並びを替える（位置を指す。範囲を超えれば最後）。層は消せない（D-154.8）。順：
//   ① 整えた後の値を確かめる（体が空 E-GRP-004・名前 E-GRP-006・並び E-GRP-008 の 422。入口の後ろ盾）
//   ② 1 つの取引（app.layer_update）：会社ごとの錠 → 権限 → 層 → 名前の重なり（自分を除く）→ 位置を動かす → 振り直し → 証跡
//   ③ 断りの言葉は replyOf（無い・別の会社・消した層は 404・E-GRP-007）、できたら 200 { data: LayerUpdated }（鍵はちょうど 6）
//   DB が落ちたら 503・E-PAGE-003（何も残らない）
import { withTenant } from "@kaname/db/context";
import type { HookReply } from "../../../../contract/deps.js";
import { down, kindOf, replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";
import { invalid } from "./create.js";
import { cleanLabel, cleanOrder, LAYER_KEYS } from "./input.js";

export const ready = true as boolean;

type Answer = { ok: true; layer: unknown } | { error: string; [k: string]: unknown };

/** ① 入力を整える。合わなければ 422 の答え */
function readInput(input: Record<string, unknown>): { value: Record<string, unknown> } | { reply: HookReply } {
  const has = (k: string) => input[k] !== undefined && input[k] !== null;
  if (!has("label") && !has("order_no")) return { reply: invalid("E-GRP-004", "label") };
  const value: Record<string, unknown> = {};
  if (has("label")) {
    const label = cleanLabel(input["label"]);
    if (label === null) return { reply: invalid("E-GRP-006", "label") };
    value["label"] = label;
  }
  if (has("order_no")) {
    const order = cleanOrder(input["order_no"]);
    if (order === null) return { reply: invalid("E-GRP-008", "order_no") };
    value["order_no"] = order;
  }
  return { value };
}

export const run: AdminOp = async ({ d, a }) => {
  const read = readInput(a.input as Record<string, unknown>);
  if ("reply" in read) return read.reply;
  try {
    const v = await withTenant(d.appPool, a.ctx, async (c) => {
      const r = await c.query<{ v: Answer }>("select app.layer_update($1::uuid, $2::jsonb) as v", [
        a.id,
        JSON.stringify(read.value),
      ]);
      return r.rows[0]!.v;
    });
    if ("error" in v) return replyOf(v, "層を直す");
    return dataReply(200, v.layer, LAYER_KEYS);
  } catch (e) {
    return down("層を直す取引", `落ちた（${kindOf(e)}）`);
  }
};
