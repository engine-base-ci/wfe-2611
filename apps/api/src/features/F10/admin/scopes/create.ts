// グループを足す口（K-802）：createScope（POST /api/v1/scopes・D-125.60・D-125.115・D-125.116・D-154.8・D-154.15・D-154.21・関門 C2）。
//   入口（op.ts）が先に確かめる：ログイン・権限（scopes の edit・会社全体）・上限・冪等・体の形（契約の VALUE_RANGES・知らない欄は 422）。順：
//   ① 整えた後の値を確かめる（名前 E-GRP-001・短い名前 E-GRP-003・色 E-GRP-005・人の数 E-GRP-009 の 422。入口の後ろ盾）
//   ② 1 つの取引（app.scope_create）：会社ごとの錠 → 権限 → 上のグループ → 層 → 上限 → 短い名前・名前の重なり → 人 → グループ・所属・証跡を書く
//   ③ 断りの言葉は replyOf（K-800 の gate.ts）で状態と番号に、できたら 201 { data: ScopeCreated }（鍵はちょうど 10）
//   DB が落ちたら 503・E-PAGE-003（何も残らない。ログは場所と例外の種類だけで、名前は出さない）
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../../contract/deps.js";
import { replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";
import { cleanColor, cleanIds, cleanName, cleanPrefix, LIMITS, SCOPE_KEYS } from "./input.js";

export const ready = true as boolean;

type Answer = { ok: true; scope: unknown } | { error: string; [k: string]: unknown };

const invalid = (code: string, field: string): HookReply => {
  const e = kanameError(code).toJSON();
  return { status: 422, body: { ...e, field, details: [{ field, code, message: e.message }] } };
};
const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** ① 入力を整える。合わなければ 422 の答え */
function readInput(input: Record<string, unknown>): { value: Record<string, unknown> } | { reply: HookReply } {
  const name = cleanName(input["name"]);
  if (name === null) return { reply: invalid("E-GRP-001", "name") };
  const prefix = cleanPrefix(input["ticket_prefix"]);
  if (prefix === null) return { reply: invalid("E-GRP-003", "ticket_prefix") };
  const color = cleanColor(input["color"]);
  if (color === null) return { reply: invalid("E-GRP-005", "color") };
  const managers = cleanIds(input["manager_member_ids"], LIMITS.managers);
  if (managers === null) return { reply: invalid("E-GRP-009", "manager_member_ids") };
  const members = cleanIds(input["member_ids"], LIMITS.members);
  if (members === null) return { reply: invalid("E-GRP-009", "member_ids") };
  const idOrNull = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
  return {
    value: {
      name,
      ticket_prefix: prefix,
      parent_id: idOrNull(input["parent_id"]),
      layer_id: idOrNull(input["layer_id"]),
      color,
      manager_member_ids: managers,
      member_ids: members,
    },
  };
}

export const run: AdminOp = async ({ d, a }) => {
  const read = readInput(a.input as Record<string, unknown>);
  if ("reply" in read) return read.reply;
  try {
    const v = await withTenant(d.appPool, a.ctx, async (c) => {
      const r = await c.query<{ v: Answer }>("select app.scope_create($1::jsonb) as v", [JSON.stringify(read.value)]);
      return r.rows[0]!.v;
    });
    if ("error" in v) return replyOf(v);
    return dataReply(201, v.scope, SCOPE_KEYS);
  } catch (e) {
    console.error(`[scope-create] グループを足す取引が落ちた（${kindOf(e)}）`);
    return unavailable();
  }
};
