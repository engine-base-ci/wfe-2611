// 自分の AI に言う・止める口（K-758・束 G「自分の AI と話す」）：sendConversationMessage・stopConversation。
//   言う：体は { text } だけ。入口が表記ゆらぎを揃える前の字（rawBody）を読み、書いたとおりに残す（切らない・正規化しない・D-130.3）。
//     DB の関数 app.clone_talk_say（20261125023800・関門 C2）を 1 回呼ぶ＝人の言葉の行・待っている仕事・証跡が 1 つの取引。
//     言うのは自分の AI との会話（clone）だけ。チケットの会話・作る画面の会話は種類ごとの口（K-763・K-774）が同じ app.talk_enqueue を通る。
//   止める：app.talk_stop を 1 回呼ぶ。種類を問わない。動いている仕事には止める合図・待っている仕事は取りやめ・止める物が無ければ none。
//   持ち主でない・無い・消した・別の会社の会話は、入口（行の守り）が先に 404。口に来るのは見えるのに関数が not_found／null を返す物で、入口と同じ体の 404。
//   関数が落ちたら（DB・証跡の失敗）503・E-PAGE-003。ログに言った字を出さない（口の名前と例外の種類だけ）
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { rawBody } from "../delegate/bridge.js";

type Row = Record<string, unknown>;
type Issue = { field: string; message: string };

const KNOWN = new Set(["text"]);
/** 前後の空白（全角の空白 U+3000 を含む \s）を除いて何か在るか */
const HAS_CHAR = /\S/;
/** 関数の断り → 口の答え（not_found は入口と同じ体の 404・ほかは 409 と番号） */
const REFUSED: Record<string, string> = { no_pc: "E-TALK-010", kind_mismatch: "E-TALK-011", too_many: "E-TALK-012" };

const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
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

/** 言う体の形を確かめる（入口の zod は欄を .optional() のまま・口が自分で見る）。通れば書いたとおりの字 */
export function checkSay(body: Record<string, unknown>): { ok: true; text: string } | { ok: false; details: Issue[] } {
  const details: Issue[] = Object.keys(body)
    .filter((k) => !KNOWN.has(k))
    .map((field) => ({ field, message: "受け付けない項目" }));
  const text = body["text"];
  if (typeof text !== "string" || !HAS_CHAR.test(text))
    details.push({ field: "text", message: "言うことを書いてください" });
  if (details.length || typeof text !== "string") return { ok: false, details };
  return { ok: true, text };
}

export function talkSayHooks(pool: pg.Pool): Record<string, Hook> {
  /** 関数を 1 回呼ぶ。落ちたら投げずに "down"（ログは口の名前と例外の種類だけ・字は出さない） */
  const call = async (op: string, sql: string, args: unknown[]): Promise<Row | null | "down"> => {
    try {
      return (await pool.query<{ v: Row | null }>(sql, args)).rows[0]?.v ?? null;
    } catch (e) {
      console.error(`[talk] ${op} で例外：止めた（${kindOf(e)}）`);
      return "down";
    }
  };
  const userOf = (a: HookArgs) => a.ctx.userId!;

  return {
    sendConversationMessage: {
      // 入口の契約の形（strict）より前に欄の名前つきで断る（知らない項目は契約の形だと欄が body になる）
      input: (raw) => {
        const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        const p = checkSay(body);
        return p.ok ? { input: body } : { reply: invalid(p.details) };
      },
      before: async (a) => {
        const p = checkSay(await rawBody(a));
        if (!p.ok) return invalid(p.details);
        const v = await call("sendConversationMessage", "select app.clone_talk_say($1, $2, $3) as v", [
          userOf(a),
          a.id,
          p.text,
        ]);
        if (v === "down" || !v) return unavailable();
        const refused = typeof v["error"] === "string" ? v["error"] : null;
        if (refused === "not_found") return notFound();
        if (refused) return REFUSED[refused] ? conflict(REFUSED[refused]) : unavailable();
        return {
          status: 201,
          body: { data: { id: v["message_id"], conversation_id: v["conversation_id"], job_id: v["job_id"] } },
        };
      },
    },
    stopConversation: {
      before: async (a) => {
        const v = await call("stopConversation", "select app.talk_stop($1, $2) as v", [userOf(a), a.id]);
        if (v === "down") return unavailable();
        if (!v) return notFound();
        return { status: 201, body: { data: { state: v["state"] } } };
      },
    },
  };
}
