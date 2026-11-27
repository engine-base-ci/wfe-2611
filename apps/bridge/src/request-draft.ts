// 届いた依頼の分身の案を作る仕事（K-929・D-155.11・D-128.101）。
//   Kaname が積んだ仕事（kind client_request_draft・K-896）を、AI に 1 回だけ作らせ、結果を K-897 の口へ返す。
//   指示文（先方の字は仕事ごとの囲みの中のデータ）はそのまま渡す。道具は全部止める（読む・書く・実行する・ブラウザ・Kaname の道具を使わせない・
//   許可や問い合わせを求められたら全部断る）。会話が無い仕事なので、途中経過・書きかけ・会話の記録・結末の口（finish）は送らない。
//   AI の出力は信用しない：返事の本文から JSON を取り出し、決めた欄だけを残し、長さを切り、数を絞って、口が 422 にならない形にしてから送る。
//   失敗の理由に AI の返事の本文・先方の字は入れない。子プロセスの起こしは既存の runClaude だけ（関門 C5）
import type { Answer, Finish, Job, runClaude } from "./runner";

export interface DraftTicket {
  title: string;
  kind?: string;
  owner?: string;
  due?: string;
  cost?: string;
  route_name?: string;
}
export interface Draft {
  ticket: DraftTicket;
  reply: string;
  questions: string[];
  route?: { name: string; reason: string };
}
export interface RequestDraftDeps {
  run: typeof runClaude;
  /** 結果の口（POST /v1/bridge/jobs/:id/client-request-draft）へ送る。送り直しは渡す側（loop.ts）が持つ */
  report: (body: Record<string, unknown>) => Promise<void>;
}

/** 失敗の理由（口は 1〜400 字・本文や先方の字を含めない） */
export const DRAFT_FAILED = {
  notRun: "分身が動きませんでした",
  empty: "分身の返事がありませんでした",
  shape: "案の形になりませんでした",
} as const;
/** AI が道具・許可・問い合わせを求めたときの断り（会話の無い仕事の既存の文と同じ） */
export const DRAFT_ASK_DENY: Answer = { allow: false, note: "この仕事では道具を使わず、文だけで答えてください" };

const LIMIT = {
  title: 200,
  kind: 40,
  owner: 80,
  cost: 40,
  route_name: 80,
  reply: 10_000,
  question: 300,
  questions: 5,
  routeName: 80,
  routeReason: 200,
} as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 字数（コードポイント）で切る。サロゲートの片割れを作らない */
const cut = (s: string, n: number): string => [...s].slice(0, n).join("");
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** 空でない字だけを切って返す。字でない・空なら undefined */
const text = (v: unknown, n: number): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? cut(v, n) : undefined;

/** 返事の本文の最初の { から最後の } までを JSON として読む。読めない・オブジェクトでないなら null */
export function extractJson(body: string): Record<string, unknown> | null {
  const from = body.indexOf("{");
  const to = body.lastIndexOf("}");
  if (from < 0 || to <= from) return null;
  try {
    const v: unknown = JSON.parse(body.slice(from, to + 1));
    return isObject(v) ? v : null;
  } catch {
    return null;
  }
}

/** 決めた欄だけを残し、長さと数を絞る。ticket.title が無い・空なら null（案の形になっていない） */
export function shapeDraft(raw: Record<string, unknown>): Draft | null {
  if (!isObject(raw["ticket"])) return null;
  const t = raw["ticket"];
  const title = text(t["title"], LIMIT.title);
  if (!title) return null;
  const ticket: DraftTicket = { title };
  for (const k of ["kind", "owner", "cost", "route_name"] as const) {
    const v = text(t[k], LIMIT[k]);
    if (v) ticket[k] = v;
  }
  if (typeof t["due"] === "string" && DATE.test(t["due"])) ticket.due = t["due"];
  const reply = typeof raw["reply"] === "string" ? cut(raw["reply"], LIMIT.reply) : "";
  const questions = (Array.isArray(raw["questions"]) ? raw["questions"] : [])
    .map((q) => text(q, LIMIT.question))
    .filter((q): q is string => q !== undefined)
    .slice(0, LIMIT.questions);
  const draft: Draft = { ticket, reply, questions };
  if (isObject(raw["route"])) {
    const name = text(raw["route"]["name"], LIMIT.routeName);
    const reason = text(raw["route"]["reason"], LIMIT.routeReason);
    if (name && reason) draft.route = { name, reason };
  }
  return draft;
}

/** AI の結末 → 送る体（{ draft } か { failed }） */
export function draftBody(f: Finish | null): Record<string, unknown> {
  if (!f || f.state !== "done") return { failed: DRAFT_FAILED.notRun };
  if (!f.result.trim()) return { failed: DRAFT_FAILED.empty };
  const raw = extractJson(f.result);
  const draft = raw ? shapeDraft(raw) : null;
  return draft ? { draft } : { failed: DRAFT_FAILED.shape };
}

/** 案の仕事を 1 件こなす：道具を全部止めて AI を 1 回起こし、結果を 1 回返す（やり直さない） */
export async function runRequestDraft(deps: RequestDraftDeps, job: Job): Promise<void> {
  let f: Finish | null;
  try {
    f = await deps.run(
      { ...job, tools: [], allowed_tools: [], browser: "off", conversation_id: null, tool_token: null },
      { ask: async () => DRAFT_ASK_DENY },
    );
  } catch {
    f = null; // 起こせなかった＝動かなかった（輪は止めない）
  }
  await deps.report(draftBody(f));
}
