// 運営がひな形の新しい版を出す（K-1010・releaseOpsTemplate・POST /api/v1/ops/templates/:id/versions・D-156.20・D-156.56・D-125.68・D-128.108）。
//   配るものを持つ運営の人と本人確認の取り直し（15 分）は入口（契約の ops:distribute・step_up always）。知らない欄・型の違いも入口（422）。
//   ここで見る順：① 値の決まり（契約の VALUE_RANGES と同じ字・外れは 422）→ ② 本文のひな形の木（validateDoc・外れは 409 E-OPS-024 と detail.key）→
//   ③ opsTx の 1 取引で app.ops_template_release を 1 回呼ぶ → 断りの言葉（mismatch は 409 E-OPS-024・same は 409 E-OPS-023）→ 201（下書きも）。
//   下書き（dry_run）は何も書かず、届く会社の数だけを返す。ログは場所と SQLSTATE だけ（会社の名前・中身を出さない）
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import { validateDoc } from "@kaname/contracts";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { opsErrorReply, opsTx } from "../db.js";

const WHERE = "templates-release";

/** 契約の VALUE_RANGES と同じ字（05_flow/screen_api.d/K-1010.py） */
export const ITEMS_MAX = 100;
export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
export const NAME_MAX = 40;
export const DESCRIPTION_MAX = 200;
export const REASON_MAX = 500;
export const COLOR_KEYS: readonly string[] = [
  "indigo",
  "teal",
  "amber",
  "coral",
  "sage",
  "plum",
  "lavender",
  "teal-light",
];
export const FIELD_TYPES: readonly string[] = [
  "short_text",
  "long_text",
  "number",
  "date",
  "select",
  "multi_select",
  "check",
];
const ITEM_FIELDS: ReadonlySet<string> = new Set([
  "key",
  "name",
  "color_key",
  "body_template",
  "field_type",
  "required",
  "description",
  "options",
  "kind_keys",
]);

type Answer = { data?: unknown; meta?: unknown; error?: unknown; key?: unknown };
interface Detail {
  field: string;
  message: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** 字の数（サロゲートの対を 1 字と数える） */
const len = (s: string): number => [...s].length;

const invalid = (details: Detail[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
const conflict = (code: string, detail?: Record<string, unknown>): HookReply => ({
  status: 409,
  body: kanameError(code, detail).toJSON(),
});

/** 1 つの中身の値の決まり。外れた欄の名前を返す（無ければ null） */
function badItemField(x: Record<string, unknown>): string | null {
  for (const k of Object.keys(x)) if (!ITEM_FIELDS.has(k)) return k;
  const { key, name, color_key, body_template, field_type, required, description, options, kind_keys } = x;
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) return "key";
  if (typeof name !== "string" || len(name) < 1 || len(name) > NAME_MAX) return "name";
  if (color_key !== undefined && (typeof color_key !== "string" || !COLOR_KEYS.includes(color_key))) return "color_key";
  if (body_template !== undefined && body_template !== null && !isObj(body_template)) return "body_template";
  if (field_type !== undefined && (typeof field_type !== "string" || !FIELD_TYPES.includes(field_type)))
    return "field_type";
  if (required !== undefined && typeof required !== "boolean") return "required";
  if (description !== undefined && (typeof description !== "string" || len(description) > DESCRIPTION_MAX))
    return "description";
  if (options !== undefined && !Array.isArray(options)) return "options";
  if (kind_keys !== undefined && (!Array.isArray(kind_keys) || kind_keys.some((v) => typeof v !== "string")))
    return "kind_keys";
  return null;
}

/** ① 値の決まり（422）。通れば null */
export function checkReleaseInput(input: Record<string, unknown>): HookReply | null {
  const details: Detail[] = [];
  const items = input["items"];
  if (!Array.isArray(items) || items.length > ITEMS_MAX) details.push({ field: "items", message: "items" });
  else
    items.forEach((x, i) => {
      const bad = isObj(x) ? badItemField(x) : "";
      if (bad !== null) details.push({ field: bad ? `items.${i}.${bad}` : `items.${i}`, message: "items" });
    });
  const reason = input["change_reason"];
  if (typeof reason !== "string" || len(reason) < 1 || len(reason) > REASON_MAX || !/\S/.test(reason))
    details.push({ field: "change_reason", message: "change_reason" });
  const dry = input["dry_run"];
  if (dry !== undefined && typeof dry !== "boolean") details.push({ field: "dry_run", message: "dry_run" });
  return details.length ? invalid(details) : null;
}

/** ② 本文のひな形の木が壊れている最初の 1 つの key（無ければ null） */
export function brokenTemplateKey(items: readonly Record<string, unknown>[]): string | null {
  for (const x of items) {
    const b = x["body_template"];
    if (b !== undefined && b !== null && !validateDoc(b).ok) return String(x["key"]);
  }
  return null;
}

/** DB の関数の断りの言葉 → 答え。知らない言葉は止める側（503） */
function replyOf(r: Answer): HookReply {
  if (r.error === "same") return conflict("E-OPS-023");
  if (r.error === "mismatch") return conflict("E-OPS-024", { key: typeof r.key === "string" ? r.key : null });
  const word = String(r.error);
  console.error(`[ops] ${WHERE} の DB が断った（${/^[a-z_]+$/.test(word) ? word : "unknown"}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
}

export function createReleaseOpsTemplate(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const bad = checkReleaseInput(a.input);
    if (bad) return bad;
    const items = a.input["items"] as Record<string, unknown>[];
    const broken = brokenTemplateKey(items);
    if (broken !== null) return conflict("E-OPS-024", { key: broken });
    const body = { items, change_reason: a.input["change_reason"] };
    const dry = a.input["dry_run"] === true;
    let r: Answer | undefined;
    try {
      r = await opsTx(
        appPool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: Answer }>("select app.ops_template_release($1, $2::jsonb, $3) as v", [
              a.id,
              JSON.stringify(body),
              dry,
            ])
          ).rows[0]?.v,
      );
    } catch (e) {
      return opsErrorReply(e, WHERE);
    }
    if (!r) return replyOf({ error: "empty" });
    if (r.error !== undefined || r.data === undefined) return replyOf(r);
    return { status: 201, body: { data: r.data, meta: r.meta } };
  };
}
