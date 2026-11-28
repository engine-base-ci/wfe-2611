// グループを直す・並びを替える口（K-804）：updateScope（PATCH /api/v1/scopes/:id・D-125.115・D-125.116・D-154.8・D-154.15・D-154.21・関門 C2）。
//   入口（op.ts）が先に確かめる：ログイン・権限（scopes の edit・会社全体）・上限・冪等・体の形（契約の VALUE_RANGES と INPUT_RULES の anyOf・知らない欄は 422）。
//   短い名前・上のグループ・層は欄が無い（変えられない）。順：
//   ① 整えた後の値を確かめる（名前 E-GRP-001・色 E-GRP-005・位置 E-GRP-008・人の数 E-GRP-009・1 つも無い E-GRP-004 の 422。入口の後ろ盾）
//   ② 1 つの取引（app.scope_update）：会社ごとの錠 → 権限 → 直す先 → 名前の重なり → 人 → 名前・色・マネージャー・並びを書く → 証跡
//   ③ 断りの言葉は replyOf（K-800 の gate.ts）で状態と番号に、直したら 200 { data: ScopeUpdated }（鍵はちょうど 10）
//   DB が落ちたら 503・E-PAGE-003（何も残らない。ログは場所と例外の種類だけで、名前は出さない）
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../../contract/deps.js";
import { replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";
import { cleanIds, cleanName, COLORS, LIMITS, SCOPE_KEYS } from "./input.js";

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
const has = (o: Record<string, unknown>, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** ① 入力を整える（送った欄だけを渡す）。合わなければ 422 の答え */
export function parseUpdateScope(
  input: Record<string, unknown>,
): { value: Record<string, unknown> } | { reply: HookReply } {
  const out: Record<string, unknown> = {};
  if (has(input, "name")) {
    const name = cleanName(input["name"]);
    if (name === null) return { reply: invalid("E-GRP-001", "name") };
    out["name"] = name;
  }
  if (has(input, "color")) {
    const color = input["color"];
    if (typeof color !== "string" || !(COLORS as readonly string[]).includes(color))
      return { reply: invalid("E-GRP-005", "color") };
    out["color"] = color;
  }
  if (has(input, "position")) {
    const pos = input["position"];
    if (typeof pos !== "number" || !Number.isInteger(pos) || pos < 1)
      return { reply: invalid("E-GRP-008", "position") };
    out["position"] = pos;
  }
  if (has(input, "manager_member_ids")) {
    const ids = input["manager_member_ids"] === null ? null : cleanIds(input["manager_member_ids"], LIMITS.managers);
    if (ids === null) return { reply: invalid("E-GRP-009", "manager_member_ids") };
    out["manager_member_ids"] = ids;
  }
  if (Object.keys(out).length === 0) return { reply: invalid("E-GRP-004", "body") };
  return { value: out };
}

export const run: AdminOp = async ({ d, a }) => {
  const read = parseUpdateScope(a.input as Record<string, unknown>);
  if ("reply" in read) return read.reply;
  try {
    const v = await withTenant(d.appPool, a.ctx, async (c) => {
      const r = await c.query<{ v: Answer }>("select app.scope_update($1::uuid, $2::jsonb) as v", [
        a.id,
        JSON.stringify(read.value),
      ]);
      return r.rows[0]!.v;
    });
    if ("error" in v) return replyOf(v);
    return dataReply(200, v.scope, SCOPE_KEYS);
  } catch (e) {
    console.error(`[scope-update] グループを直す取引が落ちた（${kindOf(e)}）`);
    return unavailable();
  }
};
