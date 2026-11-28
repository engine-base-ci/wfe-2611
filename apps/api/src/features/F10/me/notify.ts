// 知らせの設定の口（K-837）：getNotificationSettings（GET /api/v1/me/notification-settings）・
//   updateNotificationSettings（PATCH 同）・copyNotificationSettings（POST 同 /copy）。知らせの受け方はワークスペースごと（D-154.24）。
//   保存だけ作る（受け箱の行・メールの送出・会社の記録は作らない・D-154.55）。読んで送るのは F7（K-67）で、出来事の一覧は notify-events.ts。
//   入口の zod は契約の INPUT_RULES・VALUE_RANGES（出来事の形・enum）を見ないので、同じ決まりを入口の前処理（inputUpdate・inputCopy）が確かめて 422 を返す。
//   止められない出来事（new_device）を切る体は 409・E-ME-040（同じ体のほかの変更も入れない）。写し先に写し元を含めれば 409・E-ME-041。
//   同じログインが入っていない会社は同じ 404（欄・details なし）。DB の失敗は 503・E-PAGE-003（ログには場所と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { KanameError, kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import {
  EMAIL_DIGEST_DEFAULT,
  NOTIFY_EVENT_KEYS,
  NOTIFY_EVENTS,
  QUIET_PRESET_DEFAULT,
  QUIET_PRESETS,
  URGENT_OVERRIDES,
  type NotifyEvent,
} from "./notify-events.js";

/** 変える項目（workspace_id は会社を指すだけ） */
const CHANGES = ["email_digest", "quiet_hours", "pause", "urgent_override", "events"] as const;
const PAUSES: readonly (string | null)[] = ["1h", "today", "tomorrow_morning", null];
/** 写し先の数の上限 */
const COPY_MAX = 20;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** 明日の朝の時刻（時） */
const MORNING_HOUR = 8;
/** 時間帯ごとの UTC からのずれ（members.timezone の決まった 2 つ。どちらも夏時間が無い） */
const TZ_OFFSET_MS: Readonly<Record<string, number>> = { "Asia/Tokyo": 9 * HOUR_MS, UTC: 0 };

type Body = Record<string, unknown>;

const isObject = (v: unknown): v is Body => v !== null && typeof v === "object" && !Array.isArray(v);

/** 形の誤り（入口 op.ts と同じ形） */
function invalid(field: string, message: string): HookReply {
  return { status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] } };
}

/** 正本のエラー（409 など・欄・details を付けない） */
function catalog(code: string): HookReply {
  const e = new KanameError(code);
  return { status: e.status, body: e.toJSON() };
}

const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

/** DB が落ちた：503・E-PAGE-003（場所と例外の種類だけをログに出す） */
function down(where: string, e: unknown): HookReply {
  console.error(`[me-notify] ${where}：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
  const x = kanameError("E-PAGE-003").toJSON() as { message?: string; action?: string };
  return {
    status: 503,
    body: { error: "unavailable", code: "E-PAGE-003", message: x.message ?? "", action: x.action ?? "" },
  };
}

/** 出来事の 1 行の誤り（知らない出来事・ベルもメールも無い・真偽でない・知らない欄） */
function eventIssue(item: unknown): string | null {
  if (!isObject(item)) return "出来事の行の形";
  if (Object.keys(item).some((k) => k !== "key" && k !== "bell" && k !== "mail")) return "知らない欄";
  if (typeof item["key"] !== "string" || !NOTIFY_EVENT_KEYS.includes(item["key"])) return "知らない出来事";
  if (!("bell" in item) && !("mail" in item)) return "ベルかメールのどちらか";
  for (const ch of ["bell", "mail"] as const) if (ch in item && typeof item[ch] !== "boolean") return "真偽";
  return null;
}

/** 契約の値域（出来事・急ぎ・静かにする時間・いま止める）に合わない欄 */
function rangeIssue(o: Body): HookReply | null {
  const events = o["events"];
  if (Array.isArray(events)) {
    if (events.length > NOTIFY_EVENTS.length) return invalid("events", `${NOTIFY_EVENTS.length} 行まで`);
    for (const [i, item] of events.entries()) {
      const why = eventIssue(item);
      if (why) return invalid(`events.${i}`, why);
    }
  }
  const urgent = o["urgent_override"];
  if (Array.isArray(urgent) && urgent.some((x) => typeof x !== "string" || !URGENT_OVERRIDES.includes(x)))
    return invalid("urgent_override", URGENT_OVERRIDES.join("・"));
  const quiet = o["quiet_hours"];
  if (
    isObject(quiet) &&
    (Object.keys(quiet).some((k) => k !== "preset") ||
      typeof quiet["preset"] !== "string" ||
      !QUIET_PRESETS.includes(quiet["preset"]))
  )
    return invalid("quiet_hours", QUIET_PRESETS.join("・"));
  if ("pause" in o && (typeof o["pause"] === "string" || o["pause"] === null) && !PAUSES.includes(o["pause"]))
    return invalid("pause", "1h・today・tomorrow_morning・null");
  return null;
}

/** 止められない出来事（fixed）を切る行がある */
function turnsOffFixed(o: Body): boolean {
  const fixed = new Set(NOTIFY_EVENTS.filter((e) => e.fixed).map((e) => e.key));
  const events = Array.isArray(o["events"]) ? o["events"] : [];
  return events.some((e) => isObject(e) && fixed.has(String(e["key"])) && (e["bell"] === false || e["mail"] === false));
}

/** 直すの前処理：変える項目が無い体・値域の外は 422、止められない出来事を切る体は 409。型の違いは入口の契約の形に回す */
export function inputUpdate(raw: unknown): { input: Body } | { reply: HookReply } {
  if (!isObject(raw)) return { input: raw as Body };
  if (!CHANGES.some((k) => k in raw)) return { reply: invalid("body", "変える項目を 1 つ以上送ってください") };
  const issue = rangeIssue(raw);
  if (issue) return { reply: issue };
  if (turnsOffFixed(raw)) return { reply: catalog("E-ME-040") };
  return { input: raw };
}

/** 写すの前処理：写し元・写し先が無い・写し先が 0 か 21 以上は 422。重なった写し先は 1 つにする */
export function inputCopy(raw: unknown): { input: Body } | { reply: HookReply } {
  if (!isObject(raw)) return { input: raw as Body };
  if (!("from_workspace_id" in raw)) return { reply: invalid("from_workspace_id", "写し元を選んでください") };
  const to = raw["to_workspace_ids"];
  if (to === undefined) return { reply: invalid("to_workspace_ids", "写し先を選んでください") };
  if (Array.isArray(to) && (to.length < 1 || to.length > COPY_MAX))
    return { reply: invalid("to_workspace_ids", `1〜${COPY_MAX} か所`) };
  return { input: Array.isArray(to) ? { ...raw, to_workspace_ids: [...new Set(to)] } : raw };
}

/** いま止めるの終わりの時刻（その人の時間帯で、今日の終わり＝次の 0 時・明日の朝＝明日の 8 時） */
export function pausedUntil(pause: string | null, timezone: string, now: number = Date.now()): string | null {
  if (pause === null) return null;
  if (pause === "1h") return new Date(now + HOUR_MS).toISOString();
  const off = TZ_OFFSET_MS[timezone] ?? 0;
  const startOfToday = Math.floor((now + off) / DAY_MS) * DAY_MS - off;
  const at = pause === "today" ? startOfToday + DAY_MS : startOfToday + DAY_MS + MORNING_HOUR * HOUR_MS;
  return new Date(at).toISOString();
}

interface Stored {
  error?: string;
  workspace_id?: string;
  email_digest?: boolean;
  quiet_hours?: { preset?: string } | null;
  paused_until?: string | null;
  urgent_override?: string[];
  rows?: { key: string; channel: string; enabled: boolean | null }[];
}

/** 保存した値に既定をかぶせて答えの形にする（出来事は 7 つ・決まった順） */
function shape(v: Stored): Body {
  const rows = v.rows ?? [];
  const pick = (e: NotifyEvent, ch: "bell" | "mail"): boolean => {
    const r = rows.find((x) => x.key === e.key && x.channel === ch && typeof x.enabled === "boolean");
    return e.fixed ? true : (r?.enabled ?? e[ch]);
  };
  const preset = v.quiet_hours?.preset;
  return {
    workspace_id: v.workspace_id,
    email_digest: v.email_digest ?? EMAIL_DIGEST_DEFAULT,
    quiet_hours: { preset: preset && QUIET_PRESETS.includes(preset) ? preset : QUIET_PRESET_DEFAULT },
    paused_until: v.paused_until ?? null,
    urgent_override: v.urgent_override ?? [...URGENT_OVERRIDES],
    events: NOTIFY_EVENTS.map((e) => ({ key: e.key, bell: pick(e, "bell"), mail: pick(e, "mail"), fixed: e.fixed })),
  };
}

/** 関数の答えを口の答えにする */
function answer(v: Stored | null, status: number): HookReply {
  if (v === null) return notFound();
  if (v.error === "forbidden") return forbidden();
  if (v.error) return down("知らせの設定（知らない答え）", new Error("unknown"));
  return { status, body: { data: shape(v) } };
}

export function createGetNotificationSettings(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const ws = a.c.req.query("workspace_id") || null;
    let v: Stored | null;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: Stored | null }>("select app.me_notify_read($1::uuid) as v", [ws]);
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      return down("知らせの設定を読む", e);
    }
    if (v !== null && !v.error) a.c.header("Cache-Control", "private, no-store");
    return answer(v, 200);
  };
}

/** 関数に渡す体（送った項目だけ・いま止めるは時刻にして paused_until で渡す） */
function patchOf(input: Body, timezone: string): Body {
  const out: Body = {};
  for (const k of ["email_digest", "quiet_hours", "urgent_override", "events"] as const)
    if (input[k] !== undefined && input[k] !== null) out[k] = input[k];
  if ("pause" in input) out["paused_until"] = pausedUntil((input["pause"] as string | null) ?? null, timezone);
  return out;
}

export function createUpdateNotificationSettings(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    // 入口の前処理を通った体をもう一度確かめる（口の 2 層目）
    const again = inputUpdate(a.input);
    if ("reply" in again) return again.reply;
    const ws = typeof a.input["workspace_id"] === "string" ? a.input["workspace_id"] : null;
    let v: Stored | null;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const tz = await cl.query<{ tz: string }>("select timezone as tz from members where id = $1", [a.ctx.userId]);
        const patch = patchOf(again.input, tz.rows[0]?.tz ?? "Asia/Tokyo");
        const r = await cl.query<{ v: Stored | null }>("select app.me_notify_update($1::uuid, $2::jsonb) as v", [
          ws,
          JSON.stringify(patch),
        ]);
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      return down("知らせの設定を直す", e);
    }
    return answer(v, 200);
  };
}

export function createCopyNotificationSettings(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const again = inputCopy(a.input);
    if ("reply" in again) return again.reply;
    const from = String(again.input["from_workspace_id"]);
    const to = (again.input["to_workspace_ids"] as string[]) ?? [];
    let v: { error?: string; copied_to?: string[] } | null;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: { error?: string; copied_to?: string[] } | null }>(
          "select app.me_notify_copy($1::uuid, $2::uuid[]) as v",
          [from, to],
        );
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      return down("知らせの設定を写す", e);
    }
    if (v?.error === "forbidden") return forbidden();
    if (v?.error === "same") return catalog("E-ME-041");
    if (v?.error === "not_found") return notFound();
    if (!v?.copied_to) return down("知らせの設定を写す（知らない答え）", new Error("unknown"));
    return { status: 201, body: { data: { copied_to: v.copied_to } } };
  };
}
