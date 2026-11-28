// 道具 guard_report（K-738）：AI が「必ず守る決まりを破っていたので直した」と自分で知らせる（K-700 の ai_self_reported）。
//   口の前段（tools.ts の app.bridge_tool_job）と DB の 2 層目（app.ticket_tool_guard_report）の両方で鍵と PC を見る。
//   チェックには触らない（付けるのは spec_check・外す道は無い）。答え：成功 201／DB が null → 403／not_found → 404／note → 422／例外 → 503・E-PAGE-003。
//   書くのは関門 C2 の関数 1 つ（1 取引）。ログに理由・題名・id を出さない（例外の種類だけ）
import type pg from "pg";
import type { HookReply } from "../../../contract/deps.js";
import { idOf } from "../../../auth/ids.js";
import { forbidden, invalid, kindOf, notFound, unavailable } from "../../F4/test-spec/reply.js";

const NOTE_TOO_LONG = "200 字までです";

export type GuardReportParsed = { ok: true; spec_id: string; note: string | null } | { ok: false; reply: HookReply };

export interface GuardReportCall {
  job: string;
  tokenHash: string;
  session: string;
  spec: string;
  note: string | null;
}

interface GuardReportResult {
  ok?: boolean;
  id?: string;
  counted?: boolean;
  error?: string;
}

/** AI の出力なので緩く読む：spec_id（uuid・大文字は小文字に）と note（文字・任意）だけ。知らない欄は捨てる。字数の上限は DB が見る */
export function parseGuardReportInput(input: Record<string, unknown> | null | undefined): GuardReportParsed {
  const src = input && typeof input === "object" ? input : {};
  const specId = idOf(src["spec_id"]);
  if (!specId) return { ok: false, reply: invalid("spec_id", "確認項目の id（uuid）を渡してください") };
  const raw = src["note"];
  if (raw !== undefined && raw !== null && typeof raw !== "string")
    return { ok: false, reply: invalid("note", "理由は文字で渡してください") };
  return { ok: true, spec_id: specId.toLowerCase(), note: typeof raw === "string" ? raw : null };
}

/** DB の入口の答えを口の答えに直す */
export function guardReportAnswer(v: GuardReportResult | null | undefined): HookReply {
  if (!v) return forbidden();
  if (v.error === "note") return invalid("note", NOTE_TOO_LONG);
  if (v.error) return notFound();
  return { status: 201, body: { data: { result: { ok: true, id: v.id, counted: Boolean(v.counted) } } } };
}

/** DB の入口を 1 回呼ぶ（2 層目）。例外は 503（取引ごと戻り何も残らない） */
export async function runGuardReport(pool: pg.Pool, c: GuardReportCall): Promise<HookReply> {
  let v: GuardReportResult | null;
  try {
    v =
      (
        await pool.query<{ v: GuardReportResult | null }>(
          "select app.ticket_tool_guard_report($1, $2, $3, $4, $5) as v",
          [c.job, c.tokenHash, c.session, c.spec, c.note],
        )
      ).rows[0]?.v ?? null;
  } catch (e) {
    console.error(`[guard_report] 書けなかった（${kindOf(e)}）`);
    return unavailable();
  }
  return guardReportAnswer(v);
}
