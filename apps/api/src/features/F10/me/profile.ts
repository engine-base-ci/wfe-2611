// 自分を読む・直す口（K-833）：getMe（GET /api/v1/me）・updateMe（PATCH /api/v1/me）。
//   読む：取引 1 つ・DB の関数 app.me_read() を 1 回。顔は期限つき URL（関門 C4）を作り、作れなければ文字に落とす。
//   直す：入口の前処理（inputMe）で前後の空白を削り、名前・呼ばれ方の長さ・見え方の値を確かめる（欄の名前つきの 422）→
//         DB の関数 app.me_update() を 1 回（同じログインの抜けていない全部のワークスペースの行に、送った欄だけを 1 つの取引で書く・D-154.56）。
//   DB の失敗は 503・E-PAGE-003（何も残らない）。ログには場所と例外の種類だけを出す（名前・メールを出さない）。
//   会社の記録（audit_events）には載せない（D-154.55）。読む口の答えは Cache-Control: private, no-store
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { KanameError, kanameError } from "@kaname/errors";
import type { ObjectStore } from "@kaname/storage";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { toMember, type MeMemberRow } from "./member-shape.js";

/** 直せる欄（契約の MeUpdateInput と同じ） */
const FIELDS = ["name", "call_name", "language", "theme", "week_start", "timezone"] as const;
/** 名前・呼ばれ方の長さの上限（文字の数で数える） */
const NAME_MAX = 100;
const CALL_NAME_MAX = 20;
/** 見え方の決まった値 */
const CHOICES: Readonly<Record<string, readonly unknown[]>> = {
  language: ["ja"],
  theme: ["system", "light", "dark"],
  week_start: [0, 1],
  timezone: ["Asia/Tokyo", "UTC"],
};
/** 前後の空白（全角を含む） */
const EDGE_SPACE = /^[\s\u3000]+|[\s\u3000]+$/g;

const chars = (s: string): number => Array.from(s).length;
const trimAll = (s: string): string => s.replace(EDGE_SPACE, "");

/** 正本のエラーを 422 の答えにする（欄の名前つき。文言は正本から引く） */
function refused(code: string, field: string): HookReply {
  const e = new KanameError(code);
  return { status: e.status, body: { ...e.toJSON(), field, details: [{ field, message: e.entry.message }] } };
}

/** 形の誤り（入口 op.ts と同じ形） */
function invalid(field: string, message: string): HookReply {
  return { status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] } };
}

/** DB が落ちた：503・E-PAGE-003（場所と例外の種類だけをログに出す） */
function down(where: string, e: unknown): HookReply {
  console.error(`[me-profile] ${where}：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
  const x = kanameError("E-PAGE-003").toJSON() as { message?: string; action?: string };
  return {
    status: 503,
    body: { error: "unavailable", code: "E-PAGE-003", message: x.message ?? "", action: x.action ?? "" },
  };
}

const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

/** 名前・呼ばれ方を削って長さを見る。形の違う値（文字でない）は入口の契約の形に回す */
function textIssue(o: Record<string, unknown>): HookReply | null {
  if ("name" in o) {
    const v = o["name"];
    if (v === null) return refused("E-ME-001", "name");
    if (typeof v === "string") {
      const n = chars(trimAll(v));
      if (n === 0) return refused("E-ME-001", "name");
      if (n > NAME_MAX) return refused("E-ME-002", "name");
    }
  }
  const call = o["call_name"];
  if (typeof call === "string" && chars(trimAll(call)) > CALL_NAME_MAX) return refused("E-ME-003", "call_name");
  return null;
}

/** 見え方の値（型の合う値だけ見る。型の違いは入口の契約の形が欄の名前つきで断る） */
function choiceIssue(o: Record<string, unknown>): HookReply | null {
  for (const [field, allowed] of Object.entries(CHOICES)) {
    if (!(field in o)) continue;
    const v = o[field];
    const typed = field === "week_start" ? typeof v === "number" : typeof v === "string";
    if ((typed || v === null) && !allowed.includes(v)) return invalid(field, `${allowed.join("・")} のどれか`);
  }
  return null;
}

/** 入口の前処理：欄が 1 つも無い体・名前・呼ばれ方の長さ・見え方の値を断り、名前と呼ばれ方の前後の空白を削る */
export function inputMe(raw: unknown): { input: Record<string, unknown> } | { reply: HookReply } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { input: raw as Record<string, unknown> };
  const o = raw as Record<string, unknown>;
  if (!FIELDS.some((f) => f in o)) return { reply: invalid("body", "直す欄を 1 つ以上送ってください") };
  const issue = textIssue(o) ?? choiceIssue(o);
  if (issue) return { reply: issue };
  const out: Record<string, unknown> = { ...o };
  if (typeof o["name"] === "string") out["name"] = trimAll(o["name"]);
  if (typeof o["call_name"] === "string") {
    const c = trimAll(o["call_name"]);
    out["call_name"] = c === "" ? null : c;
  }
  return { input: out };
}

interface ReadResult {
  error?: string;
  member?: MeMemberRow;
  workspaces?: unknown[];
  workspace_name?: string | null;
}

interface UpdateResult {
  error?: string;
  field?: string;
  member?: MeMemberRow;
  saved_at?: string;
}

/** 送った欄だけの体（関数に渡す jsonb） */
function patchOf(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(FIELDS.filter((f) => f in input).map((f) => [f, input[f] ?? null]));
}

export function createGetMe(appPool: pg.Pool, objects: ObjectStore): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    let v: ReadResult;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: ReadResult | null }>("select app.me_read() as v");
        return r.rows[0]?.v ?? {};
      });
    } catch (e) {
      return down("自分を読む", e);
    }
    if (v.error === "forbidden") return forbidden();
    if (!v.member) return down("自分を読む（知らない答え）", new Error("unknown"));
    a.c.header("Cache-Control", "private, no-store");
    const member = await toMember(objects, a.ctx, v.member);
    return {
      status: 200,
      body: { data: { member, workspaces: v.workspaces ?? [], workspace_name: v.workspace_name ?? null } },
    };
  };
}

export function createUpdateMe(appPool: pg.Pool, objects: ObjectStore): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    // 入口の前処理を通った体をもう一度確かめる（口の 2 層目）
    const again = inputMe(a.input);
    if ("reply" in again) return again.reply;
    let v: UpdateResult;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: UpdateResult | null }>("select app.me_update($1::jsonb) as v", [
          JSON.stringify(patchOf(again.input)),
        ]);
        return r.rows[0]?.v ?? {};
      });
    } catch (e) {
      return down("自分を直す", e);
    }
    if (v.error === "forbidden") return forbidden();
    if (v.error === "invalid") return invalid(v.field ?? "body", "入力内容を確認してください");
    if (!v.member || !v.saved_at) return down("自分を直す（知らない答え）", new Error("unknown"));
    const member = await toMember(objects, a.ctx, v.member);
    return { status: 200, body: { data: { member, saved_at: v.saved_at } } };
  };
}
