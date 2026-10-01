// 自分のAI が Kaname の道具でたたき台に置く口（D-110）。/api/auth-ext/bridge/tool。
//   呼ぶのは本人の PC の Claude Code に渡した道具（MCP の kaname）。鍵は仕事を渡すたびに作った「その仕事の間だけ」のもの。
//   書くのは DB の関数（security definer）。会社をまたがない・動いていない仕事の鍵では書けない（判定は関数の中）
import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import type pg from "pg";

export interface AgentToolDeps {
  appPool: pg.Pool;
}
type Json = { json: (b: unknown, s: number) => Response };
const bad = (c: Json, status: number, code: string, message: string) => c.json({ error: code.toLowerCase(), code, message }, status);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const hashToolToken = (t: string): string => createHash("sha256").update(t).digest("hex");

/** 仕事を渡すときに道具の鍵を作り、ハッシュだけを DB に付ける。付けられなければ null（道具は渡さない） */
export async function issueToolToken(pool: pg.Pool, session: string, jobId: string): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const r = await pool.query<{ ok: boolean }>("select app.bridge_tool_token($1, $2, $3) as ok", [session, jobId, hashToolToken(token)]);
  return r.rows[0]?.ok ? token : null;
}

const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const id = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v : null);
const date = (v: unknown): string | null => (typeof v === "string" && DATE.test(v) ? v : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[,，]/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
};
const list = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim().slice(0, 80) : "")).filter(Boolean).slice(0, 40) : null;

/** 道具の名前 → DB の関数の呼び方。入力は形を確かめてから渡す（知らない欄は捨てる） */
type Call = (pool: pg.Pool, member: string, job: string, input: Record<string, unknown>) => Promise<unknown>;
const one = async (pool: pg.Pool, sql: string, args: unknown[]): Promise<unknown> => (await pool.query<{ v: unknown }>(sql, args)).rows[0]?.v;
export const TOOLS: Record<string, Call> = {
  draft_read: (p, m) => one(p, "select app.onboard_draft($1) as v", [m]),
  goal_set: (p, m, _j, i) =>
    one(p, "select app.agent_goal_set($1, $2, $3, $4, $5, $6, $7) as v", [m, id(i["id"]), str(i["name"], 80), num(i["target_value"]), str(i["unit"], 20), date(i["period_start"]), date(i["period_end"])]),
  goal_remove: (p, m, _j, i) => one(p, "select app.agent_draft_remove($1, 'goal', $2) as v", [m, id(i["id"])]),
  ledger_set: (p, m, _j, i) =>
    one(p, "select app.agent_ledger_set($1, $2, $3, $4::jsonb, $5::jsonb) as v", [
      m, id(i["id"]), str(i["name"], 80),
      list(i["stages"]) ? JSON.stringify(list(i["stages"])) : null,
      list(i["fields"]) ? JSON.stringify(list(i["fields"])) : null,
    ]),
  ledger_remove: (p, m, _j, i) => one(p, "select app.agent_draft_remove($1, 'ledger', $2) as v", [m, id(i["id"])]),
  duty_set: (p, m, _j, i) =>
    one(p, "select app.agent_duty_set($1, $2, $3, $4, $5) as v", [m, id(i["id"]), str(i["name"], 80), str(i["definition"], 8000), str(i["staff"], 40)]),
  duty_remove: (p, m, _j, i) => one(p, "select app.agent_draft_remove($1, 'duty', $2) as v", [m, id(i["id"])]),
  remember: async (p, _m, j, i) => {
    const items = list(i["items"]) ?? (str(i["text"], 2000) ? [str(i["text"], 2000)!] : []);
    const n = (await p.query<{ n: number }>("select app.agent_remember_tool($1, $2::text[]) as n", [j, items])).rows[0]?.n ?? 0;
    return { remembered: n };
  },
};

export function agentToolRoutes(d: AgentToolDeps): Hono {
  const app = new Hono();
  app.post("/bridge/tool", async (c) => {
    const token = c.req.header("x-kaname-tool-token") ?? "";
    if (token.length < 20) return bad(c, 401, "UNAUTHENTICATED", "この道具の鍵は分かりません");
    const job = (
      await d.appPool.query<{ job_id: string; member_id: string }>("select job_id, member_id from app.bridge_tool_job($1)", [hashToolToken(token)])
    ).rows[0];
    // 終わった仕事・別の人の鍵は通さない（D-110.3）
    if (!job) return bad(c, 401, "UNAUTHENTICATED", "この道具の鍵はもう使えません（仕事が終わっています）");
    const b = (await c.req.json().catch(() => ({}))) as { name?: unknown; input?: unknown };
    const name = typeof b.name === "string" ? b.name : "";
    const call = TOOLS[name];
    if (!call) return bad(c, 422, "VALIDATION_FAILED", `その道具はありません（${name || "名前なし"}）`);
    const input = b.input && typeof b.input === "object" ? (b.input as Record<string, unknown>) : {};
    const v = (await call(d.appPool, job.member_id, job.job_id, input)) as { error?: string } | null;
    if (v && typeof v === "object" && "error" in v && v.error) return bad(c, 422, "VALIDATION_FAILED", String(v.error));
    return c.json({ data: v ?? null });
  });
  return app;
}
