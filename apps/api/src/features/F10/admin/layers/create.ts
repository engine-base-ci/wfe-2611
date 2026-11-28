// 層を足す口（K-803）：createLayer（POST /api/v1/layers・A117・D-125.116・D-154.7・D-154.8・D-154.21・関門 C2）。
//   入口（op.ts）が先に確かめる：ログイン・権限（layers の edit・会社全体）・上限・冪等・体の形（契約の VALUE_RANGES・知らない欄は 422）。順：
//   ① 整えた後の値を確かめる（名前 E-GRP-006・並び E-GRP-008 の 422。入口の後ろ盾）
//   ② 1 つの取引（app.layer_create）：会社ごとの錠 → 権限 → 上限 8 段 → 名前の重なり → 位置を空ける → 書く → 振り直し → 証跡
//   ③ 断りの言葉は replyOf（K-800 の gate.ts）で状態と番号に、できたら 201 { data: LayerCreated }（鍵はちょうど 6）
//   DB が落ちたら 503・E-PAGE-003（何も残らない。ログは場所と例外の種類だけで、名前は出さない）
import { withTenant } from "@kaname/db/context";
import type { HookReply } from "../../../../contract/deps.js";
import { down, fromCatalog, kindOf, replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";
import { cleanLabel, cleanOrder, LAYER_KEYS } from "./input.js";

export const ready = true as boolean;

type Answer = { ok: true; layer: unknown } | { error: string; [k: string]: unknown };

/** 欄の 422（入口の後ろ盾） */
export const invalid = (code: string, field: string): HookReply => {
  const r = fromCatalog(code, 422);
  const body = r.body as Record<string, unknown>;
  return { status: 422, body: { ...body, field, details: [{ field, code, message: body["message"] }] } };
};

/** ① 入力を整える。合わなければ 422 の答え */
function readInput(input: Record<string, unknown>): { value: Record<string, unknown> } | { reply: HookReply } {
  const label = cleanLabel(input["label"]);
  if (label === null) return { reply: invalid("E-GRP-006", "label") };
  const raw = input["order_no"];
  if (raw === undefined || raw === null) return { value: { label } };
  const order = cleanOrder(raw);
  if (order === null) return { reply: invalid("E-GRP-008", "order_no") };
  return { value: { label, order_no: order } };
}

export const run: AdminOp = async ({ d, a }) => {
  const read = readInput(a.input as Record<string, unknown>);
  if ("reply" in read) return read.reply;
  try {
    const v = await withTenant(d.appPool, a.ctx, async (c) => {
      const r = await c.query<{ v: Answer }>("select app.layer_create($1::jsonb) as v", [JSON.stringify(read.value)]);
      return r.rows[0]!.v;
    });
    if ("error" in v) return replyOf(v, "層を足す");
    return dataReply(201, v.layer, LAYER_KEYS);
  } catch (e) {
    return down("層を足す取引", `落ちた（${kindOf(e)}）`);
  }
};
