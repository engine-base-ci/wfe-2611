// 値段を変える案を作る・直す・決める人に回す（K-988・createPlanProposal・updatePlanProposal・submitPlanProposal・D-156.21・D-128.72）。
//   値段の案を持つ運営の人は入口（契約の ops:plan_propose）。知らない欄・型の違い（小数・字の日付の形）も入口（422）。
//   ここで見る順：① 値の決まりと組み合わせ（契約の VALUE_RANGES・INPUT_RULES と同じ字・外れは 422）→
//   ② opsTx の 1 取引で DB の関数を 1 回呼ぶ → 断りの言葉（open_exists と一意の違反 23505 は 409 E-OPS-019・no_change は 409 E-OPS-020・
//   state は 409 E-OPS-021・not_owner は 403 FORBIDDEN・invalid は 422）→ 作るは 201・直す・回すは 200。
//   DB の断りは opsErrorReply（K-947）。ログは場所と SQLSTATE だけ（値段・理由を出さない）
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { opsErrorReply, opsTx } from "../db.js";

const WHERE = "plans";

/** 契約の VALUE_RANGES と同じ字（05_flow/screen_api.d/K-988.py） */
export const PLAN_KEYS: readonly string[] = ["free", "team", "business"];
export const POLICIES: readonly string[] = ["after_days", "keep"];
export const PRICE_MAX = 10_000_000;
export const MEMBERS_MIN = 1;
export const MEMBERS_MAX = 10_000;
export const NOTICE_MIN = 30;
export const NOTICE_MAX = 365;
export const REASON_MAX = 1000;
/** 直すで受ける欄（plan_key は直せない） */
const EDITABLE = ["price_monthly", "member_limit", "existing_policy", "notice_days", "new_from", "reason"] as const;

type Answer = { data?: unknown; error?: unknown };
interface Detail {
  field: string;
  message: string;
}

const invalid = (details: Detail[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
const conflict = (code: string): HookReply => ({ status: 409, body: kanameError(code).toJSON() });
const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

const isInt = (v: unknown, min: number, max: number): boolean =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
/** 暦に在る YYYY-MM-DD か */
const isDate = (v: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** 1 つの欄の値の決まり。合えば null・外れれば欄の名前 */
function badValue(k: string, v: unknown): string | null {
  if (k === "plan_key") return typeof v === "string" && PLAN_KEYS.includes(v) ? null : k;
  if (k === "price_monthly") return isInt(v, 0, PRICE_MAX) ? null : k;
  if (k === "member_limit") return isInt(v, MEMBERS_MIN, MEMBERS_MAX) ? null : k;
  if (k === "existing_policy") return typeof v === "string" && POLICIES.includes(v) ? null : k;
  if (k === "notice_days") return isInt(v, NOTICE_MIN, NOTICE_MAX) ? null : k;
  if (k === "new_from") return v === null || (typeof v === "string" && isDate(v)) ? null : k;
  if (k === "reason") {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length >= 1 && [...s].length <= REASON_MAX ? null : k;
  }
  return k;
}

/** 方針と日数の組み合わせ：after_days なら notice_days が要る・keep なら notice_days を送らない */
function badPair(input: Record<string, unknown>): Detail[] {
  const policy = input["existing_policy"];
  if (policy === "after_days" && input["notice_days"] === undefined)
    return [{ field: "notice_days", message: "N 日たってからなら日数が要る" }];
  if (policy === "keep" && input["notice_days"] !== undefined)
    return [{ field: "notice_days", message: "ずっと今の値段なら日数を送らない" }];
  return [];
}

/** ① 作るの入力。通れば DB に渡す体（理由は前後の空白を落とす） */
export function checkCreate(input: Record<string, unknown>): { body: Record<string, unknown> } | { reply: HookReply } {
  const required = ["plan_key", "price_monthly", "member_limit", "existing_policy", "reason"];
  const details: Detail[] = required.filter((k) => input[k] === undefined).map((k) => ({ field: k, message: "必須" }));
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    const bad = badValue(k, v);
    if (bad) details.push({ field: bad, message: "値の決まりの外" });
  }
  details.push(...badPair(input));
  if (details.length) return { reply: invalid(details) };
  return { body: { ...input, reason: String(input["reason"]).trim(), new_from: input["new_from"] ?? null } };
}

/** ① 直すの入力。6 つのうち 1 つ以上 */
export function checkUpdate(input: Record<string, unknown>): { body: Record<string, unknown> } | { reply: HookReply } {
  const given = Object.entries(input).filter(([, v]) => v !== undefined);
  const details: Detail[] = [];
  if (!given.some(([k]) => (EDITABLE as readonly string[]).includes(k)))
    details.push({ field: "body", message: "直す欄が 1 つは要る" });
  for (const [k, v] of given) {
    const bad = (EDITABLE as readonly string[]).includes(k) ? badValue(k, v) : k;
    if (bad) details.push({ field: bad, message: "値の決まりの外" });
  }
  details.push(...badPair(input));
  if (details.length) return { reply: invalid(details) };
  const body = Object.fromEntries(given);
  return { body: typeof body["reason"] === "string" ? { ...body, reason: body["reason"].trim() } : body };
}

/** DB の関数の断りの言葉 → 答え。知らない言葉は止める側（503） */
function replyOf(word: unknown): HookReply {
  if (word === "open_exists") return conflict("E-OPS-019");
  if (word === "no_change") return conflict("E-OPS-020");
  if (word === "state") return conflict("E-OPS-021");
  if (word === "not_owner") return forbidden();
  if (word === "invalid") return invalid([{ field: "notice_days", message: "方針と日数の組み合わせ" }]);
  const w = String(word);
  console.error(`[ops] ${WHERE} の DB が断った（${/^[a-z_]+$/.test(w) ? w : "unknown"}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
}

/** 運営の文脈の 1 取引で関数を 1 回呼ぶ。同時に作った後の方（一意の違反）は 409 E-OPS-019 */
async function call(appPool: pg.Pool, a: HookArgs, sql: string, params: unknown[], ok: number): Promise<HookReply> {
  let r: Answer | undefined;
  try {
    r = await opsTx(appPool, a.ctx, async (cl) => (await cl.query<{ v: Answer }>(sql, params)).rows[0]?.v);
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "23505") return conflict("E-OPS-019");
    return opsErrorReply(e, WHERE);
  }
  if (!r) return replyOf("empty");
  if (r.error !== undefined || r.data === undefined) return replyOf(r.error);
  return { status: ok, body: { data: r.data } };
}

export function createCreatePlanProposal(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const c = checkCreate(a.input);
    if ("reply" in c) return c.reply;
    return call(appPool, a, "select app.ops_plan_proposal_create($1::jsonb) as v", [JSON.stringify(c.body)], 201);
  };
}

export function createUpdatePlanProposal(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const c = checkUpdate(a.input);
    if ("reply" in c) return c.reply;
    return call(
      appPool,
      a,
      "select app.ops_plan_proposal_update($1, $2::jsonb) as v",
      [a.id, JSON.stringify(c.body)],
      200,
    );
  };
}

export function createSubmitPlanProposal(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => call(appPool, a, "select app.ops_plan_proposal_submit($1) as v", [a.id], 200);
}
