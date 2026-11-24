// 道具 draft_propose（K-775）：作る画面の会話の仕事の中で、AI が題・本文・確認項目の案を会話の行に付ける（D-153.17）。
//   欄にも作る口にも触らない（欄に入れるのは人・K-777）。口の前段（tools.ts の app.bridge_tool_job）と DB の 2 層目（app.draft_tool_propose）の両方で鍵と PC を見る。
//   答え：成功 201／DB が null → 403／limit → 409・E-TALK-070／shape → 422（欄 input）／例外 → 503・E-PAGE-003（何も残らない）。
//   書くのは関門 C2 の関数 1 つ（1 取引）。ログに案の字・題を出さない（例外の種類だけ）
import { kanameError } from "@kaname/errors";
import type pg from "pg";
import type { HookReply } from "../../../contract/deps.js";
import { invalid, kindOf, unavailable } from "../../F4/test-spec/reply.js";

const TITLE_MAX = 200;
const CHECK_MAX = 200;
const CHECKS_MAX = 50;
const SPACE = /^[\s　]+|[\s　]+$/g;

export interface DraftProposal {
  title: string | null;
  body: string | null;
  checks: string[] | null;
}

const charLen = (s: string): number => Array.from(s).length;
const isBlank = (s: string): boolean => s.replace(SPACE, "") === "";

function readTitle(raw: unknown): string | null | HookReply {
  if (raw === undefined || raw === null) return null;
  const msg = `題は 1〜${TITLE_MAX} 字の文字で渡してください`;
  if (typeof raw !== "string") return invalid("title", msg);
  const t = raw.replace(SPACE, "");
  if (t === "" || charLen(t) > TITLE_MAX) return invalid("title", msg);
  return t;
}

function readBody(raw: unknown): string | null | HookReply {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string" || isBlank(raw)) return invalid("body", "本文は空白だけでない文字で渡してください");
  return raw;
}

function readChecks(raw: unknown): string[] | null | HookReply {
  if (raw === undefined || raw === null) return null;
  const msg = `確認項目は文字の並び（${CHECKS_MAX} 件まで・1 件 ${CHECK_MAX} 字まで）で渡してください`;
  if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string")) return invalid("checks", msg);
  const list = (raw as string[]).map((x) => x.replace(SPACE, "")).filter((x) => x !== "");
  if (list.length > CHECKS_MAX || list.some((x) => charLen(x) > CHECK_MAX)) return invalid("checks", msg);
  return list.length > 0 ? list : null;
}

const isReply = (v: unknown): v is HookReply =>
  typeof v === "object" && v !== null && !Array.isArray(v) && "status" in v;

/** AI の出力なので緩く読む：知らない欄は捨てる。形が違えば 422 の答え（欄の名前つき） */
export function parseDraftProposeInput(input: Record<string, unknown>): DraftProposal | HookReply {
  const title = readTitle(input["title"]);
  if (isReply(title)) return title;
  const body = readBody(input["body"]);
  if (isReply(body)) return body;
  const checks = readChecks(input["checks"]);
  if (isReply(checks)) return checks;
  if (title === null && body === null && checks === null)
    return invalid("input", "題・本文・確認項目のどれか 1 つを渡してください");
  return { title, body, checks };
}

interface ProposeResult {
  ok?: boolean;
  id?: string;
  remaining?: number;
  error?: string;
}

const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

/** この仕事で出せる案は 3 回まで（409・E-TALK-070） */
const tooMany = (): HookReply => {
  const e = kanameError("E-TALK-070");
  return { status: e.status, body: e.toJSON() };
};

/** DB の入口を 1 回呼ぶ（2 層目）。答えを口の答えに直す */
export async function runDraftPropose(
  pool: pg.Pool,
  jobId: string,
  tokenHash: string,
  sessionId: string,
  proposal: DraftProposal,
): Promise<HookReply> {
  let v: ProposeResult | null;
  try {
    v =
      (
        await pool.query<{ v: ProposeResult | null }>(
          "select app.draft_tool_propose($1, $2, $3, $4, $5, $6::jsonb) as v",
          [
            jobId,
            tokenHash,
            sessionId,
            proposal.title,
            proposal.body,
            proposal.checks === null ? null : JSON.stringify(proposal.checks),
          ],
        )
      ).rows[0]?.v ?? null;
  } catch (e) {
    console.error(`[draft_propose] 書けなかった（${kindOf(e)}）`);
    return unavailable();
  }
  if (!v) return forbidden();
  if (v.error === "limit") return tooMany();
  if (v.error) return invalid("input", "案の形が違います");
  return { status: 201, body: { data: { result: { ok: true, id: v.id, remaining: v.remaining } } } };
}
