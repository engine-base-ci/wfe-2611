// 自分のAI が Kaname の道具でたたき台に置く道具の中身（D-110）。呼ぶ口は契約の callKanameTool（K-62）。/api/auth-ext/bridge/artifact はここ。
//   呼ぶのは本人の PC の Claude Code に渡した道具（MCP の kaname）。鍵は仕事を渡すたびに作った「その仕事の間だけ」のもの。
//   書くのは DB の関数（security definer）。会社をまたがない・動いていない仕事の鍵では書けない（判定は関数の中）
import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import type pg from "pg";
import type { ObjectStore } from "@kaname/storage";
import { idOf } from "./ids.js";

export interface AgentToolDeps {
  appPool: pg.Pool;
  /** 成果物の置き場（関門 C4）。無ければ artifact_put は 503 */
  objects?: ObjectStore;
}
/** 道具で渡せる成果物の上限（D-121.4） */
export const ARTIFACT_PUT_MAX = 20 * 1024 * 1024;
/** 受ける種類（拡張子 → content-type）。実行ファイル等は受けない（D-121.4） */
export const ARTIFACT_PUT_TYPES: Record<string, string> = {
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
type Json = { json: (b: unknown, s: number) => Response };
const bad = (c: Json, status: number, code: string, message: string) =>
  c.json({ error: code.toLowerCase(), code, message }, status);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const hashToolToken = (t: string): string => createHash("sha256").update(t).digest("hex");

/** 仕事を渡すときに道具の鍵を作り、ハッシュだけを DB に付ける。付けられなければ null（道具は渡さない） */
export async function issueToolToken(pool: pg.Pool, session: string, jobId: string): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const r = await pool.query<{ ok: boolean }>("select app.bridge_tool_token($1, $2, $3) as ok", [
    session,
    jobId,
    hashToolToken(token),
  ]);
  return r.rows[0]?.ok ? token : null;
}

const str = (v: unknown, max = 200): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
/** 道具の入力（AI の出力）の id：正式な uuid でなければ null（今までどおり。断る口は契約の callKanameTool・K-62） */
const id = (v: unknown): string | null => idOf(v);
const date = (v: unknown): string | null => (typeof v === "string" && DATE.test(v) ? v : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[,，]/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
};
const list = (v: unknown): string[] | null =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === "string" ? x.trim().slice(0, 80) : ""))
        .filter(Boolean)
        .slice(0, 40)
    : null;

/** 道具の名前 → DB の関数の呼び方。入力は形を確かめてから渡す（知らない欄は捨てる） */
type Call = (pool: pg.Pool, member: string, job: string, input: Record<string, unknown>) => Promise<unknown>;
const one = async (pool: pg.Pool, sql: string, args: unknown[]): Promise<unknown> =>
  (await pool.query<{ v: unknown }>(sql, args)).rows[0]?.v;
export const TOOLS: Record<string, Call> = {
  draft_read: (p, m) => one(p, "select app.onboard_draft($1) as v", [m]),
  goal_set: (p, m, _j, i) =>
    one(p, "select app.agent_goal_set($1, $2, $3, $4, $5, $6, $7) as v", [
      m,
      id(i["id"]),
      str(i["name"], 80),
      num(i["target_value"]),
      str(i["unit"], 20),
      date(i["period_start"]),
      date(i["period_end"]),
    ]),
  goal_remove: (p, m, _j, i) => one(p, "select app.agent_draft_remove($1, 'goal', $2) as v", [m, id(i["id"])]),
  ledger_set: (p, m, _j, i) =>
    one(p, "select app.agent_ledger_set($1, $2, $3, $4::jsonb, $5::jsonb) as v", [
      m,
      id(i["id"]),
      str(i["name"], 80),
      list(i["stages"]) ? JSON.stringify(list(i["stages"])) : null,
      list(i["fields"]) ? JSON.stringify(list(i["fields"])) : null,
    ]),
  ledger_remove: (p, m, _j, i) => one(p, "select app.agent_draft_remove($1, 'ledger', $2) as v", [m, id(i["id"])]),
  duty_set: (p, m, _j, i) =>
    one(p, "select app.agent_duty_set($1, $2, $3, $4, $5) as v", [
      m,
      id(i["id"]),
      str(i["name"], 80),
      str(i["definition"], 8000),
      str(i["staff"], 40),
    ]),
  duty_remove: (p, m, _j, i) => one(p, "select app.agent_draft_remove($1, 'duty', $2) as v", [m, id(i["id"])]),
  remember: async (p, _m, j, i) => {
    const items = list(i["items"]) ?? (str(i["text"], 2000) ? [str(i["text"], 2000)!] : []);
    const n =
      (await p.query<{ n: number }>("select app.agent_remember_tool($1, $2::text[]) as n", [j, items])).rows[0]?.n ?? 0;
    return { remembered: n };
  },
};

export function agentToolRoutes(d: AgentToolDeps): Hono {
  const app = new Hono();
  // 道具を呼ぶ口は契約の口 POST /api/v1/bridge/jobs/:id/tools/:name に移した（K-62・apps/api/src/features/F5/delegate/tools.ts）。TOOLS はそこから使う
  // 自分のAI が作ったファイル・調べた結果を成果物として渡す（D-121）。中身はそのまま本文で届く（道具のサーバーが PC のファイルを読んで送る）。
  // 置き場（C4）に置いてから台帳を書く。台帳を書けなければ（仕事が終わっていた等）置いた中身は消す
  app.post("/bridge/artifact", async (c) => {
    const token = c.req.header("x-kaname-tool-token") ?? "";
    if (token.length < 20) return bad(c, 401, "UNAUTHENTICATED", "この道具の鍵は分かりません");
    const job = (
      await d.appPool.query<{
        job_id: string;
        member_id: string;
        tenant_id: string;
        kind: string;
        talk_kind: string | null;
      }>("select job_id, member_id, tenant_id, kind, talk_kind from app.bridge_tool_job($1)", [hashToolToken(token)])
    ).rows[0];
    if (!job) return bad(c, 401, "UNAUTHENTICATED", "この道具の鍵はもう使えません（仕事が終わっています）");
    // チケットの仕事で使える道具は ticket_read だけ（契約の口と同じ決め）。成果物の口は会話の仕事の鍵だけ通す（K62-API-070・D-129.44）
    // 作る画面の会話（draft）の仕事で出せる道具は draft_propose だけ（K-775）。成果物も置き場も触らない
    if (job.kind === "ticket" || job.talk_kind === "draft")
      return bad(c, 403, "FORBIDDEN", "この仕事ではその道具を使えません");
    const name = decodeURIComponent(c.req.header("x-artifact-name") ?? "").trim();
    const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(name)?.[1] ?? "").toLowerCase();
    const contentType = ARTIFACT_PUT_TYPES[ext];
    if (!name || !contentType)
      return bad(
        c,
        422,
        "VALIDATION_FAILED",
        `この種類のファイルは成果物にできません（${ext || "拡張子なし"}）。文書・表・画像・PDF・動画・音声・Office の書類だけです`,
      );
    const len = Number(c.req.header("content-length") ?? "0");
    if (len > ARTIFACT_PUT_MAX) return bad(c, 413, "VALIDATION_FAILED", "20 MB を超えるファイルは成果物にできません");
    const body = new Uint8Array(await c.req.arrayBuffer());
    if (!body.byteLength) return bad(c, 422, "VALIDATION_FAILED", "中身が空です");
    if (body.byteLength > ARTIFACT_PUT_MAX)
      return bad(c, 413, "VALIDATION_FAILED", "20 MB を超えるファイルは成果物にできません");
    if (!d.objects) return bad(c, 503, "E-ART-002", "成果物を保存できませんでした（保存先が応答しません）");
    const ctx = { tenantId: job.tenant_id, userId: job.member_id, role: "member" as const };
    const put = await d.objects.put(ctx, body, { contentType });
    if (put.status !== "done")
      return bad(
        c,
        put.status === "denied" ? 413 : 502,
        "E-ART-002",
        "成果物を保存できませんでした（保存先が応答しません）",
      );
    const title =
      decodeURIComponent(c.req.header("x-artifact-title") ?? "").trim() || name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
    const r = await d.appPool.query<{ id: string | null }>(
      "select app.artifact_create_from_job($1, $2, $3, $4, $5, $6) as id",
      [job.member_id, job.job_id, title, ext === "jpeg" ? "jpg" : ext, put.value.ref, put.value.size],
    );
    const id = r.rows[0]?.id ?? null;
    if (!id) {
      await d.objects.delete(ctx, put.value.ref); // 行を作れなかった中身は置き場に残さない
      return bad(c, 401, "UNAUTHENTICATED", "この道具の鍵はもう使えません（仕事が終わっています）");
    }
    return c.json(
      {
        data: {
          id,
          title,
          format: ext === "jpeg" ? "jpg" : ext,
          version: 1,
          size: put.value.size,
          done: "成果物として渡しました。本人は会話の横で開けます",
        },
      },
      201,
    );
  });
  return app;
}
