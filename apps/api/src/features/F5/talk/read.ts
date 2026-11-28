// 会話を読む 3 つの口（K-757・束 G「自分の AI と話す」の土台）：listConversations・getConversation・listConversationMessages。読むだけ（書かない・外を呼ばない・証跡も残さない）。
//   DB の関数 app.conversation_list・app.conversation_view・app.conversation_messages（0237・security definer・持ち主を見る 2 層目）を 1 回ずつ呼ぶ。
//   持ち主でない・無い・消した・別の会社の会話は、入口（行の守り）が先に 404。口に来るのは見えるのに関数が null を返す物で、入口と同じ体の 404。
//   問い合わせは limit と cursor だけ（探す・星は作らない・D-153.16）。形の誤りは 422・欄つき。関数が落ちたら 503・E-PAGE-003（ログに会話の字を出さない）
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";

export const LIST_LIMIT = { default: 30, max: 100 } as const;
export const MESSAGES_LIMIT = { default: 50, max: 200 } as const;
const KNOWN = new Set(["limit", "cursor"]);
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

type Issue = { field: string; message: string };
/** 続きの鍵の中身（時刻と id）。一覧は (updated_at, id)・行は (created_at, id) */
export interface TalkKey {
  at: string;
  id: string;
}

const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
const unavailable = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

export const encodeKey = (k: TalkKey): string => Buffer.from(`${k.at}|${k.id}`, "utf8").toString("base64url");
/** 鍵の文字列を読む。読めない（base64url でない・戻らない・2 つに分かれない・時刻や uuid でない）なら null */
export function decodeKey(cursor: string): TalkKey | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) return null;
  const text = Buffer.from(cursor, "base64url").toString("utf8");
  if (Buffer.from(text, "utf8").toString("base64url") !== cursor) return null;
  const parts = text.split("|");
  if (parts.length !== 2) return null;
  const [at, id] = parts as [string, string];
  if (!TIME_RE.test(at) || Number.isNaN(Date.parse(at)) || !isUuid(id)) return null;
  return { at, id };
}

/** 問い合わせ（limit・cursor だけ）を確かめる。空の値は指定なし（入口 op.ts と同じ） */
export function parsePage(
  raw: Record<string, string>,
  lim: { default: number; max: number },
): { ok: true; limit: number; key: TalkKey | null } | { ok: false; details: Issue[] } {
  const details: Issue[] = Object.keys(raw)
    .filter((k) => !KNOWN.has(k))
    .map((field) => ({ field, message: "受け付けない問い合わせ" }));
  const limitRaw = raw["limit"] ?? "";
  const limit = limitRaw === "" ? lim.default : /^[0-9]{1,4}$/.test(limitRaw) ? Number(limitRaw) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > lim.max)
    details.push({ field: "limit", message: `1〜${lim.max}` });
  const cursorRaw = raw["cursor"] ?? "";
  const key = cursorRaw === "" ? null : decodeKey(cursorRaw);
  if (cursorRaw !== "" && !key) details.push({ field: "cursor", message: "続きの印が不正です" });
  if (details.length) return { ok: false, details };
  return { ok: true, limit, key };
}

type Row = Record<string, unknown>;

export function talkReadHooks(pool: pg.Pool): Record<string, Hook> {
  /** 関数を 1 回呼ぶ。落ちたら投げずに "down"（ログは口の名前と例外の種類だけ） */
  const call = async (op: string, sql: string, args: unknown[]): Promise<Row | null | "down"> => {
    try {
      return (await pool.query<{ v: Row | null }>(sql, args)).rows[0]?.v ?? null;
    } catch (e) {
      console.error(`[talk] ${op} の読みで例外：止めた（${kindOf(e)}）`);
      return "down";
    }
  };
  const userOf = (a: HookArgs) => a.ctx.userId!;

  return {
    listConversations: {
      before: async (a) => {
        const p = parsePage(a.c.req.query(), LIST_LIMIT);
        if (!p.ok) return invalid(p.details);
        const v = await call("listConversations", "select app.conversation_list($1, $2, $3, $4) as v", [
          userOf(a),
          p.limit,
          p.key?.at ?? null,
          p.key?.id ?? null,
        ]);
        if (v === "down" || !v) return unavailable();
        const data = (v["items"] as Row[]) ?? [];
        const last = data.at(-1);
        const cursor =
          v["has_more"] === true && last ? encodeKey({ at: String(last["updated_at"]), id: String(last["id"]) }) : null;
        return { status: 200, body: { data, meta: { limit: p.limit, cursor } } };
      },
    },
    getConversation: {
      before: async (a) => {
        const v = await call("getConversation", "select app.conversation_view($1, $2) as v", [userOf(a), a.id]);
        if (v === "down") return unavailable();
        if (!v) return notFound();
        return { status: 200, body: { data: v } };
      },
    },
    listConversationMessages: {
      before: async (a) => {
        const p = parsePage(a.c.req.query(), MESSAGES_LIMIT);
        if (!p.ok) return invalid(p.details);
        const v = await call("listConversationMessages", "select app.conversation_messages($1, $2, $3, $4, $5) as v", [
          userOf(a),
          a.id,
          p.key?.at ?? null,
          p.key?.id ?? null,
          p.limit,
        ]);
        if (v === "down") return unavailable();
        if (!v) return notFound();
        const data = (v["messages"] as Row[]) ?? [];
        const oldest = data[0];
        const cursor =
          v["has_more"] === true && oldest ? encodeKey({ at: String(oldest["at"]), id: String(oldest["id"]) }) : null;
        return { status: 200, body: { data, meta: { limit: p.limit, cursor } } };
      },
    },
  };
}
