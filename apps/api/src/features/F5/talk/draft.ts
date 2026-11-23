// チケットを作る画面の右の会話の口（K-774・D-153.17）：startDraftConversation・sendDraftMessage。
//   始める：withTenant の中で app.draft_talk_start（20261125025400）を 1 回呼ぶ。会話（種類 draft・チケットに結ばない）を 1 つ作るだけ。
//     人ごとに 50 まで：50 以上なら一番古い作る画面の会話に消した印を付けてから始める（断らない）。PC は言うときに見る。
//   言う：体は { text, draft: { title, body, checks[] }, edited? }。入口が表記ゆらぎを揃える前の字（rawBody）を読み、口が形を確かめる（422 は欄名つき・入れ子は draft.title の形）。
//     app.draft_talk_say を 1 回呼ぶ＝人の言葉の行（options.passed＝人が直した欄）・待っている仕事・証跡が 1 つの取引（関門 C2）。
//     仕事の頭の文脈（欄の今の中身・人が直した欄は上書きしない・案は draft_propose で出す）は DB の関数が組む。
//   自分の会話でない・無い・消した会話は入口（行の守り・持ち主だけ）が先に 404。DB の関数の判定は 2 層目で、口も同じ体の 404。
//   関数が落ちたら 503・E-PAGE-003。ログに言った字・欄の中身を出さない（口の名前と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { rawBody } from "../delegate/bridge.js";

type Row = Record<string, unknown>;
type Issue = { field: string; message: string };

/** 欄の制限（題は K-437 の TITLE_MAX・確認項目は K-434・D-150.28。生の字をコードポイントで数える）。本文と言った字は上限なし（D-130.3） */
export const DRAFT_LIMITS = Object.freeze({ title: 200, checks: 50, check: 200 });
const EDITABLE = ["title", "body", "checks"] as const;
type Editable = (typeof EDITABLE)[number];
export interface DraftFields {
  title: string;
  body: string;
  checks: string[];
}
export interface DraftSay {
  text: string;
  draft: DraftFields;
  edited: Editable[];
}

const KNOWN = new Set(["text", "draft", "edited"]);
const DRAFT_KEYS = new Set(["title", "body", "checks"]);
/** 前後の空白（全角の空白 U+3000 を含む \s）を除いて何か在るか */
const HAS_CHAR = /\S/;
/** 関数の断り → 409 の番号（too_many は K-758 が定義した番号を使う） */
const REFUSED: Record<string, string> = { no_pc: "E-TALK-060", kind_mismatch: "E-TALK-061", too_many: "E-TALK-012" };

const len = (s: string): number => [...s].length;
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
const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);

/** 欄の今の中身の形（3 つの鍵だけ・題 200 字・本文は文字・確認項目は文字の並びで 50 件・1 件 200 字） */
function checkDraft(v: unknown): Issue[] {
  if (!isObj(v)) return [{ field: "draft", message: "欄の今の中身（title・body・checks）を送ってください" }];
  const out: Issue[] = Object.keys(v)
    .filter((k) => !DRAFT_KEYS.has(k))
    .map((k) => ({ field: `draft.${k}`, message: "受け付けない項目" }));
  const { title, body, checks } = v;
  if (typeof title !== "string") out.push({ field: "draft.title", message: "題名は文字" });
  else if (len(title) > DRAFT_LIMITS.title) out.push({ field: "draft.title", message: `${DRAFT_LIMITS.title} 字まで` });
  if (typeof body !== "string") out.push({ field: "draft.body", message: "本文は文字" });
  if (!Array.isArray(checks) || checks.some((c) => typeof c !== "string"))
    out.push({ field: "draft.checks", message: "確認項目は文字の並び" });
  else if (checks.length > DRAFT_LIMITS.checks)
    out.push({ field: "draft.checks", message: `${DRAFT_LIMITS.checks} 件まで` });
  else if ((checks as string[]).some((c) => len(c) > DRAFT_LIMITS.check))
    out.push({ field: "draft.checks", message: `1 件 ${DRAFT_LIMITS.check} 字まで` });
  return out;
}

/** 人が直した欄（任意・title／body／checks だけ・重ならない） */
function checkEdited(v: unknown): Issue[] {
  if (v === undefined) return [];
  const ok =
    Array.isArray(v) &&
    v.every((x) => typeof x === "string" && (EDITABLE as readonly string[]).includes(x)) &&
    new Set(v).size === v.length;
  return ok ? [] : [{ field: "edited", message: "title・body・checks を重ならずに" }];
}

/** 言う体の形を確かめる（入口の zod は欄を .optional() のまま・口が自分で見る）。通れば書いたとおりの字と欄 */
export function checkDraftSay(body: Row): { ok: true; value: DraftSay } | { ok: false; details: Issue[] } {
  const details: Issue[] = Object.keys(body)
    .filter((k) => !KNOWN.has(k))
    .map((field) => ({ field, message: "受け付けない項目" }));
  const text = body["text"];
  if (typeof text !== "string" || !HAS_CHAR.test(text))
    details.push({ field: "text", message: "言うことを書いてください" });
  details.push(...checkDraft(body["draft"]), ...checkEdited(body["edited"]));
  if (details.length || typeof text !== "string") return { ok: false, details };
  const d = body["draft"] as unknown as DraftFields;
  const edited = (body["edited"] ?? []) as Editable[];
  return {
    ok: true,
    value: { text, draft: { title: d.title, body: d.body, checks: [...d.checks] }, edited: [...edited] },
  };
}

/** 言う関数の断り → 口の答え */
function refusal(error: string): HookReply {
  if (error === "not_found") return notFound();
  if (error === "not_member") return forbidden();
  if (error === "text_empty") return invalid([{ field: "text", message: "言うことを書いてください" }]);
  if (error === "draft_invalid") return invalid([{ field: "draft", message: "欄の今の中身の形が違います" }]);
  const code = REFUSED[error];
  return code ? conflict(code) : unavailable();
}

export function draftTalkHooks(pool: pg.Pool): Record<string, Hook> {
  /** 要求の取引の中で関数を 1 回呼ぶ。落ちたら投げずに "down"（ログは口の名前と例外の種類だけ・字も欄も出さない） */
  const call = async (a: HookArgs, op: string, sql: string, args: unknown[]): Promise<Row | null | "down"> => {
    try {
      return await withTenant(
        pool,
        a.ctx,
        async (cl) => (await cl.query<{ v: Row | null }>(sql, args)).rows[0]?.v ?? null,
      );
    } catch (e) {
      console.error(`[talk] ${op} で例外：止めた（${kindOf(e)}）`);
      return "down";
    }
  };

  return {
    startDraftConversation: {
      before: async (a) => {
        const v = await call(a, "startDraftConversation", "select app.draft_talk_start() as v", []);
        if (v === "down" || !v) return unavailable();
        if (typeof v["error"] === "string") return v["error"] === "not_member" ? forbidden() : unavailable();
        return { status: 201, body: { data: { id: v["conversation_id"] } } };
      },
    },
    sendDraftMessage: {
      // 入口の契約の形（strict）より前に欄の名前つきで断る（知らない項目・入れ子の誤りは契約の形だと欄名が粗い）
      input: (raw) => {
        const body = isObj(raw) ? raw : {};
        const p = checkDraftSay(body);
        return p.ok ? { input: body } : { reply: invalid(p.details) };
      },
      before: async (a) => {
        const p = checkDraftSay(await rawBody(a));
        if (!p.ok) return invalid(p.details);
        const { text, draft, edited } = p.value;
        const v = await call(a, "sendDraftMessage", "select app.draft_talk_say($1, $2, $3::jsonb, $4::jsonb) as v", [
          a.id,
          text,
          JSON.stringify(draft),
          JSON.stringify(edited),
        ]);
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
