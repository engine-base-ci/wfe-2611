// 依頼を書く間に分身が聞く口（K-910）：askPortalRequestQuestions（POST /api/v1/portal/requests/questions・D-155.11・D-127.8・D-128.101・関門 C2・C3）。
//   入口が契約の形（body・知らない欄は 422）を確かめた後、口が値を確かめる：本文は 1〜10000 字（前後の空白を取って空なら 422）・NUL を含まない。
//   担当の PC（app.portal_ask_target）が無ければ仕事を積まず available false。積めなければ（前の仕事が待っている）available true・質問なし。
//   積んだら結果を pollMs おきに waitMs まで見て、done の結果の JSON の字の列を整える（空白を取る・空と重なりを除く・200 字・3 つまで）。
//   done 以外・形違い・時間切れは質問なし。時間切れ・失敗の仕事は cancelled にする（PC が後から取らない）。
//   ゲストでない（42501）→ 403・FORBIDDEN／DB が落ちた → 503・E-PAGE-003（ログには例外の種類だけ・本文は書かない）。
//   Cache-Control: private, no-store は入口の app.ts が全部の答えに付ける
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { buildPrompt, QUESTION_CHARS, QUESTIONS_MAX } from "./questions-prompt.js";

export const BODY_MAX = 10_000;
export const WAIT_MS = 10_000;
export const POLL_MS = 250;

type Question = { id: string; text: string };
type Answer = { available: boolean; questions: Question[] };

const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};
const invalid = (message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field: "body", message }] },
});
const ok = (a: Answer): HookReply => ({ status: 200, body: { data: a } });
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 値の確かめ（形は入口が確かめた後） */
export function checkBody(
  input: Record<string, unknown>,
): { ok: true; body: string } | { ok: false; reply: HookReply } {
  const body = input["body"];
  if (typeof body !== "string" || body.trim() === "")
    return { ok: false, reply: invalid("依頼の内容を書いてください") };
  if ([...body].length > BODY_MAX) return { ok: false, reply: invalid(`依頼の内容は ${BODY_MAX} 字までです`) };
  if (body.includes("\u0000")) return { ok: false, reply: invalid("使えない文字が入っています") };
  return { ok: true, body };
}

/** PC の結果の字を質問にする。JSON の字の列でなければ空 */
export function toQuestions(result: unknown): Question[] {
  if (typeof result !== "string") return [];
  let v: unknown;
  try {
    v = JSON.parse(result);
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const t = [...x.trim()].slice(0, QUESTION_CHARS).join("");
    if (t === "" || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= QUESTIONS_MAX) break;
  }
  return out.map((text, i) => ({ id: `q${i + 1}`, text }));
}

export function createAskPortalRequestQuestions(
  appPool: pg.Pool,
  o: { waitMs?: number; pollMs?: number } = {},
): (a: HookArgs) => Promise<HookReply> {
  const waitMs = o.waitMs ?? WAIT_MS;
  const pollMs = o.pollMs ?? POLL_MS;
  return async (a: HookArgs) => {
    const c = checkBody(a.input);
    if (!c.ok) return c.reply;
    const one = <T>(sql: string, params: unknown[]) =>
      withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ v: T | null }>(sql, params)).rows[0]?.v ?? null);
    let job: string | null;
    try {
      if ((await one<string>("select app.portal_ask_target() as v", [])) === null)
        return ok({ available: false, questions: [] });
      job = await one<string>("select app.portal_ask_enqueue($1) as v", [buildPrompt(c.body)]);
    } catch (e) {
      const k = kindOf(e);
      if (k === "42501") return FORBIDDEN;
      console.error(`[portal] 聞く仕事を積む取引が落ちた（${k}）`);
      return unavailable();
    }
    if (job === null) return ok({ available: true, questions: [] });
    const until = Date.now() + waitMs;
    try {
      for (;;) {
        const r = await one<{ state: string; result: unknown }>("select app.portal_ask_result($1::uuid) as v", [job]);
        if (r && r.state === "done") return ok({ available: true, questions: toQuestions(r.result) });
        if (r === null || ["stopped", "cancelled"].includes(r.state)) return ok({ available: true, questions: [] });
        if (Date.now() >= until) break;
        await sleep(Math.min(pollMs, Math.max(0, until - Date.now())));
      }
    } catch (e) {
      console.error(`[portal] 聞く仕事の結果を読む取引が落ちた（${kindOf(e)}）`);
    }
    // 時間切れ・読めない：仕事をやめる（失敗してもログに仕事の id だけ。5 分たつと前の仕事と数えない）
    try {
      await one<null>("select app.portal_ask_cancel($1::uuid) as v", [job]);
    } catch (e) {
      console.error(`[portal] 聞く仕事をやめられなかった（${kindOf(e)}・仕事 ${job}）`);
    }
    return ok({ available: true, questions: [] });
  };
}
