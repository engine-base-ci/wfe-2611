// 作った後に会話をチケットへ移す口（K-776・D-153.17）：adoptDraftConversation（POST /api/v1/ticket_draft_conversations/:id/adopt・体は { ticket_id }）。
//   withTenant の中で DB の関数 app.draft_adopt（20261125025600・関門 C2）を 1 回呼ぶ＝会話の種類の付け替え・1 行の知らせ・証跡が 1 つの取引。
//   作る口 createTicket（K-437）は変えない。自分の会話でない・無い・消した会話は入口（行の守り・持ち主だけ）が先に 404。DB の関数の判定は 2 層目。
//   断り：not_found 404（入口と同じ体）・forbidden 403 E-TALK-080・not_draft 409 E-TALK-081・moved 409 E-TALK-082・has_talk 409 E-TALK-083・
//   not_member 403・知らない言葉と例外は 503 E-PAGE-003（ログに中身を出さない）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { idOf } from "../../../auth/ids.js";

type Row = Record<string, unknown>;
type Issue = { field: string; message: string };

const KNOWN = new Set(["ticket_id"]);
const REFUSED: Record<string, { status: number; code: string }> = {
  forbidden: { status: 403, code: "E-TALK-080" },
  not_draft: { status: 409, code: "E-TALK-081" },
  moved: { status: 409, code: "E-TALK-082" },
  has_talk: { status: 409, code: "E-TALK-083" },
};

const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
const unavailable = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 移す体の形を確かめる（入口の zod は欄を .optional() のまま・口が自分で見る）。通れば揃えたチケットの id */
export function checkAdopt(body: Row): { ok: true; ticketId: string } | { ok: false; details: Issue[] } {
  const details: Issue[] = Object.keys(body)
    .filter((k) => !KNOWN.has(k))
    .map((field) => ({ field, message: "受け付けない項目" }));
  const ticketId = idOf(body["ticket_id"]);
  if (!ticketId) details.push({ field: "ticket_id", message: "uuid" });
  if (details.length || !ticketId) return { ok: false, details };
  return { ok: true, ticketId };
}

/** 関数の断り → 口の答え */
function refusal(word: string): HookReply {
  if (word === "not_found") return notFound();
  if (word === "not_member") return forbidden();
  const r = REFUSED[word];
  if (r) return { status: r.status, body: kanameError(r.code).toJSON() };
  console.error(`[talk] adoptDraftConversation：知らない答え（${word}）なので止める側に倒した`);
  return unavailable();
}

export function draftAdoptHooks(pool: pg.Pool): Record<string, Hook> {
  return {
    adoptDraftConversation: {
      // 入口の契約の形（strict）より前に欄の名前つきで断る
      input: (raw) => {
        const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Row) : {};
        const p = checkAdopt(body);
        return p.ok ? { input: { ticket_id: p.ticketId } } : { reply: invalid(p.details) };
      },
      before: async (a: HookArgs) => {
        const p = checkAdopt((a.input ?? {}) as Row);
        if (!p.ok) return invalid(p.details);
        let v: Row | null;
        try {
          v = await withTenant(
            pool,
            a.ctx,
            async (cl) =>
              (await cl.query<{ v: Row | null }>("select app.draft_adopt($1, $2) as v", [a.id, p.ticketId])).rows[0]
                ?.v ?? null,
          );
        } catch (e) {
          console.error(`[talk] adoptDraftConversation で例外：止めた（${kindOf(e)}）`);
          return unavailable();
        }
        if (!v) return unavailable();
        if (typeof v["error"] === "string") return refusal(v["error"]);
        return { status: 201, body: { data: { conversation_id: v["conversation_id"], ticket_id: v["ticket_id"] } } };
      },
    },
  };
}
