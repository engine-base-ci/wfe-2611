// チケットの中で話す口（K-763・束 G「自分の AI と話す」）：getTicketAgentSession・sendTicketAgentMessage。
//   読む：withTenant の中で app.ticket_talk_conversation（20261125024300）を呼び、そのチケットの自分の会話（種類 ticket）の id を引く。
//     会話が無ければ会話なしの空の形（何も作らない）。在れば K-757 の app.conversation_view の答えをそのまま返す。
//   言う：体は { text } だけ。入口が表記ゆらぎを揃える前の字（rawBody）を読み、書いたとおりに残す（切らない・正規化しない・D-130.3）。
//     app.ticket_talk_say を 1 回呼ぶ＝会話（初めてなら）・人の言葉の行・待っている仕事・証跡が 1 つの取引（関門 C2）。
//     AI に渡す文脈は DB の関数が呼んだ人の権限の中で組む（この口では組まない）。
//   見えない・無い・消した・別の会社のチケットは入口（行の守り）が先に 404、見えても書けなければ 403。DB の関数の判定は 2 層目。
//   関数が落ちたら 503・E-PAGE-003。ログに言った字を出さない（口の名前と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { checkSay } from "./say.js";
import { rawBody } from "../delegate/bridge.js";

type Row = Record<string, unknown>;
type Issue = { field: string; message: string };

/** 会話がまだ無いときの答え（ConversationView と同じ 6 つの鍵） */
export const EMPTY_SESSION = Object.freeze({
  conversation: null,
  messages: [],
  has_more: false,
  running_job_id: null,
  work: null,
  stopped: null,
});
/** 関数の断り → 409 の番号（too_many は K-758 が定義した番号を使う） */
const REFUSED: Record<string, string> = { no_pc: "E-TALK-050", too_many: "E-TALK-012" };

const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
const conflict = (code: string): HookReply => ({ status: 409, body: kanameError(code).toJSON() });
const unavailable = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 言う関数の断り → 口の答え */
function refusal(error: string): HookReply {
  if (error === "not_found") return notFound();
  if (error === "not_writable" || error === "not_member") return forbidden();
  if (error === "text_empty") return invalid([{ field: "text", message: "言うことを書いてください" }]);
  const code = REFUSED[error];
  return code ? conflict(code) : unavailable();
}

export function ticketTalkHooks(pool: pg.Pool): Record<string, Hook> {
  /** 要求の取引の中で 1 文を流す。落ちたら投げずに "down"（ログは口の名前と例外の種類だけ・字は出さない） */
  const run = async (a: HookArgs, op: string, fn: (cl: pg.PoolClient) => Promise<Row | null>) => {
    try {
      return await withTenant(pool, a.ctx, fn);
    } catch (e) {
      console.error(`[talk] ${op} で例外：止めた（${kindOf(e)}）`);
      return "down" as const;
    }
  };
  const one = async (cl: pg.PoolClient, sql: string, args: unknown[]): Promise<Row | null> =>
    (await cl.query<{ v: Row | null }>(sql, args)).rows[0]?.v ?? null;

  return {
    getTicketAgentSession: {
      before: async (a) => {
        const v = await run(a, "getTicketAgentSession", async (cl) => {
          const found = await one(cl, "select app.ticket_talk_conversation($1) as v", [a.id]);
          if (!found || typeof found["error"] === "string") return found;
          const conv = found["conversation_id"];
          if (typeof conv !== "string") return { view: EMPTY_SESSION };
          const view = await one(cl, "select app.conversation_view($1, $2) as v", [a.ctx.userId, conv]);
          return { view: view ?? EMPTY_SESSION };
        });
        if (v === "down" || !v) return unavailable();
        if (typeof v["error"] === "string") return v["error"] === "not_found" ? notFound() : unavailable();
        return { status: 200, body: { data: v["view"] } };
      },
    },
    sendTicketAgentMessage: {
      // 入口の契約の形（strict）より前に欄の名前つきで断る（知らない項目は契約の形だと欄が body になる）
      input: (raw) => {
        const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        const p = checkSay(body);
        return p.ok ? { input: body } : { reply: invalid(p.details) };
      },
      before: async (a) => {
        const p = checkSay(await rawBody(a));
        if (!p.ok) return invalid(p.details);
        const v = await run(a, "sendTicketAgentMessage", (cl) =>
          one(cl, "select app.ticket_talk_say($1, $2) as v", [a.id, p.text]),
        );
        if (v === "down" || !v) return unavailable();
        if (typeof v["error"] === "string") return refusal(v["error"]);
        return {
          status: 201,
          body: { data: { id: v["message_id"], conversation_id: v["conversation_id"], job_id: v["job_id"] } },
        };
      },
    },
  };
}
