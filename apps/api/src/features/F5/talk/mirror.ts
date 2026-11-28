// PC の側の会話の写し（K-760・D-112・D-115）：mirrorConversationEntries（その仕事の会話に、記録と同じ id で文を写す）と
//   listMirrorTargets（写し漏れを取り戻す先を読む）。前の道すじ /api/auth-ext/bridge/entries・mirror-targets（auth/agent.ts）の中身を移した。
//   PC は印（x-bridge-session）で入り、入口（op.ts）が ctx.role = "device"・ctx.sessionId にする（K-57）。会話は仕事から決める（体に会話の id を持たない）。
//   書くのは関門 C2 の関数だけ（app.talk_mirror_entries・app.talk_mirror_targets・20261125024000）。吹き出しの書き方は前から在る app.bridge_entries。
//   1 件ごとの中身の形（id の形・空の文）は DB が読み飛ばす（PC は記録の全部を送り直すので、形の悪い 1 件で全体を断らない）。
//   「覚える」の印は吹き出しに出さない（覚えるのは仕事の結末で 1 回だけ・D-105.1）。ログに文・仕事の id を出さない
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { takeRemember } from "../../../auth/memory.js";
import { rawBody } from "../delegate/bridge.js";

type Row = Record<string, unknown>;
type Issue = { field: string; message: string };

export const ENTRIES_MAX = 500;
export const TARGETS_LIMIT = { default: 50, max: 50 } as const;
const BODY_KEYS = new Set(["entries"]);
const QUERY_KEYS = new Set(["limit", "cursor"]);

const gone = (): HookReply => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
// 状態コードを先に取る（契約の形の検査 K144-SHAPE-010 は、正本の ID を最初に受ける関数を「正本の種類の状態コードを返す」と読む）
const fromCatalog = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 写す体の形（entries が 1〜500 件の並び・知らない項目なし）。通れば、各件の文から「覚える」の印を落とした並び */
export function checkEntries(
  body: Record<string, unknown>,
): { ok: true; entries: Row[] } | { ok: false; details: Issue[] } {
  const details: Issue[] = Object.keys(body)
    .filter((k) => !BODY_KEYS.has(k))
    .map((field) => ({ field, message: "受け付けない項目" }));
  const list = body["entries"];
  if (!Array.isArray(list) || list.length < 1 || list.length > ENTRIES_MAX)
    details.push({ field: "entries", message: `写す文は 1〜${ENTRIES_MAX} 件の並び` });
  if (details.length || !Array.isArray(list)) return { ok: false, details };
  const entries = list.map((e): Row => {
    const x = e && typeof e === "object" && !Array.isArray(e) ? (e as Row) : {};
    return { uuid: x["uuid"], at: x["at"], text: typeof x["text"] === "string" ? takeRemember(x["text"]).text : "" };
  });
  return { ok: true, entries };
}

/** 取り戻す先の問い合わせ（limit だけを読む・cursor は読まない）。空は指定なし */
export function parseLimit(raw: Record<string, string>): { ok: true; limit: number } | { ok: false; details: Issue[] } {
  const details: Issue[] = Object.keys(raw)
    .filter((k) => !QUERY_KEYS.has(k))
    .map((field) => ({ field, message: "受け付けない問い合わせ" }));
  const s = raw["limit"] ?? "";
  const limit = s === "" ? TARGETS_LIMIT.default : /^[0-9]{1,4}$/.test(s) ? Number(s) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > TARGETS_LIMIT.max)
    details.push({ field: "limit", message: `1〜${TARGETS_LIMIT.max}` });
  return details.length ? { ok: false, details } : { ok: true, limit };
}

export function talkMirrorHooks(pool: pg.Pool): Record<string, Hook> {
  /** 関数を 1 回呼ぶ。落ちたら投げずに "down"（ログは口の名前と例外の種類だけ） */
  const call = async (op: string, sql: string, args: unknown[]): Promise<unknown> => {
    try {
      return (await pool.query<{ v: unknown }>(sql, args)).rows[0]?.v ?? null;
    } catch (e) {
      console.error(`[talk mirror] ${op} で例外：止めた（${kindOf(e)}）`);
      return "down";
    }
  };
  const sessionOf = (a: HookArgs): string | null => a.ctx.sessionId ?? null;

  return {
    mirrorConversationEntries: {
      // 入口の契約の形（strict）より前に欄の名前つきで断る
      input: (raw) => {
        const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Row) : {};
        const p = checkEntries(body);
        return p.ok ? { input: body } : { reply: invalid(p.details) };
      },
      before: async (a) => {
        const sid = sessionOf(a);
        if (!sid) return gone();
        // 文は入口が表記ゆらぎを揃える前の字（AI の返事を書いたとおりに写す）
        const p = checkEntries(await rawBody(a));
        if (!p.ok) return invalid(p.details);
        const v = await call("mirrorConversationEntries", "select app.talk_mirror_entries($1, $2, $3::jsonb) as v", [
          sid,
          a.id,
          JSON.stringify(p.entries),
        ]);
        if (v === "down") return fromCatalog(503, "E-PAGE-003");
        if (!v) return gone();
        const r = v as Row;
        if (r["error"] === "not_found") return notFound();
        if (r["error"] === "no_conversation") return fromCatalog(409, "E-TALK-030");
        if (r["error"] !== undefined) return fromCatalog(503, "E-PAGE-003");
        return { status: 201, body: { data: { inserted: Number(r["inserted"] ?? 0) } } };
      },
    },
    listMirrorTargets: {
      before: async (a) => {
        const sid = sessionOf(a);
        if (!sid) return gone();
        const p = parseLimit(a.c.req.query());
        if (!p.ok) return invalid(p.details);
        const v = await call("listMirrorTargets", "select app.talk_mirror_targets($1, $2) as v", [sid, p.limit]);
        if (v === "down") return fromCatalog(503, "E-PAGE-003");
        if (!v) return gone();
        return { status: 200, body: { data: Array.isArray(v) ? v : [], meta: { limit: p.limit } } };
      },
    },
  };
}
