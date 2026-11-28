// AI がページを開く道具 knowledge_open（K-698・D-125.28・D-125.35・D-128.50・D-128.51）。契約の口 callKanameTool（tools.ts）の 1 つの分岐。
//   中身は DB の関数 app.knowledge_open（鍵のハッシュと受け取った PC を DB でも見る 2 層目・その仕事で見える物だけ・開いた記録・やり取りの 1 行・証跡を 1 つの取引で）。
//   ここは入力を読む（parseOpenInput）・DB を呼ぶ（runKnowledgeOpen）・答えを組む（openAnswer）の 3 つだけ。
//   見えない・無い・消えた・下書き・別の会社・範囲の外はどれも同じ 404（在るかを漏らさない）。DB の例外は 503・E-PAGE-003（何も残らない）。
//   ログに題名・本文・ページの id・道具の鍵・PC の印を出さない（場所と例外の種類だけ）
import type pg from "pg";
import type { HookReply } from "../../../../contract/deps.js";
import { idOf } from "../../../../auth/ids.js";
import { invalid, unavailable } from "../reply.js";

/** 開く本文の上限（字・コードポイント）。DB の app.knowledge_open と同じ数 */
export const KNOWLEDGE_OPEN_TEXT_MAX = 50000;

export interface OpenedPage {
  id: string;
  title: string;
  desc: string;
  place: string;
  body_text: string;
  truncated: boolean;
  version: number | null;
}
export interface OpenResult {
  ok: true;
  opened_now: boolean;
  page: OpenedPage;
}

/** 道具の入力（AI の出力なので緩く読む）：page_id の uuid だけ。大文字も通して小文字に。知らない欄は捨てる */
export function parseOpenInput(
  input: Record<string, unknown> | null | undefined,
): { ok: true; page_id: string } | { ok: false; reply: HookReply } {
  const raw = input && typeof input === "object" ? input["page_id"] : undefined;
  const id = idOf(raw);
  if (!id) return { ok: false, reply: invalid("page_id", "ページの id（uuid）") };
  return { ok: true, page_id: id.toLowerCase() };
}

const pageOf = (v: Record<string, unknown>): OpenedPage => ({
  id: String(v["id"] ?? ""),
  title: String(v["title"] ?? ""),
  desc: String(v["desc"] ?? ""),
  place: String(v["place"] ?? ""),
  body_text: String(v["body_text"] ?? ""),
  truncated: v["truncated"] === true,
  version: typeof v["version"] === "number" ? v["version"] : null,
});

/** DB の答え → 口の答え。null（見えない・無い）は 404 の 2 欄だけ。開けたら 201 の data.result（page は 7 鍵） */
export function openAnswer(v: unknown): HookReply {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o || o["ok"] !== true) return { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
  const page = o["page"] && typeof o["page"] === "object" ? (o["page"] as Record<string, unknown>) : {};
  const result: OpenResult = { ok: true, opened_now: o["opened_now"] === true, page: pageOf(page) };
  return { status: 201, body: { data: { result } } };
}

const errName = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  if (typeof x?.code === "string" && x.code) return x.code;
  return typeof x?.name === "string" && x.name ? x.name : "Error";
};

/** app.knowledge_open を 1 回呼ぶ（1 つの取引）。例外は 503・E-PAGE-003（ログは例外の種類だけ） */
export async function runKnowledgeOpen(
  pool: Pick<pg.Pool, "query">,
  a: { job: string; tokenHash: string; session: string; page: string },
): Promise<HookReply> {
  try {
    const r = await pool.query<{ v: unknown }>("select app.knowledge_open($1, $2, $3, $4) as v", [
      a.job,
      a.tokenHash,
      a.session,
      a.page,
    ]);
    return openAnswer(r.rows[0]?.v ?? null);
  } catch (e) {
    console.error(`[knowledge] ページを開く道具の DB が失敗した（${errName(e)}）`);
    return unavailable();
  }
}
