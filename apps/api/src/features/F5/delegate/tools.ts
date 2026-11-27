// AI に任せる（K-62）の道具の口 callKanameTool（POST /api/v1/bridge/jobs/:id/tools/:name）。前の道すじ /api/auth-ext/bridge/tool（agent-tools.ts）を移した。
//   道具の鍵（take で渡す・DB にはハッシュだけ）と PC の印の両方が要る。その仕事を受け取った PC から・その仕事の間だけ・押した人の会社と権限の中だけ（D-110）。
//   道具は仕事の種類で分ける：チケットの仕事は ticket_read だけ・会話の仕事は会話の道具（agent-tools.ts の TOOLS）だけ（K62-API-051）。
//   会話の仕事はさらに会話の種類で分ける：作る画面の会話（talk_kind draft）の仕事は draft_propose（K-775）だけ。
//   書く・読むのは関門 C2 の関数（app.bridge_tool_job・app.ticket_tool_read・TOOLS の関数）。証跡は関数の中で残す
import type pg from "pg";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { TOOLS, hashToolToken } from "../../../auth/agent-tools.js";
import { rawBody } from "./bridge.js";
import { parseDraftProposeInput, runDraftPropose } from "../talk/draft-propose.js";

export const TICKET_TOOLS = ["ticket_read"] as const;
export const DRAFT_TOOLS = ["draft_propose"] as const;
const ALL_TOOLS = new Set<string>([...TICKET_TOOLS, ...DRAFT_TOOLS, ...Object.keys(TOOLS)]);
const TOKEN_HEADER = "x-kaname-tool-token";

const forbidden = (message: string): HookReply => ({
  status: 403,
  body: { error: "forbidden", code: "FORBIDDEN", message },
});

interface ToolJob {
  job_id: string;
  member_id: string;
  tenant_id: string;
  conversation_id: string | null;
  ticket_id: string | null;
  kind: string;
  taken_session_id: string | null;
  /** 会話の種類（clone・ticket・draft）。会話の無い仕事は null */
  talk_kind?: string | null;
}

/** その仕事の種類で呼べる道具 */
export function toolsFor(job: Pick<ToolJob, "kind" | "conversation_id" | "talk_kind">): readonly string[] {
  if (job.kind === "ticket") return TICKET_TOOLS;
  if (!job.conversation_id) return [];
  return job.talk_kind === "draft" ? DRAFT_TOOLS : Object.keys(TOOLS);
}

export function toolHooks(pool: pg.Pool): Record<string, Hook> {
  return {
    callKanameTool: {
      before: async (a: HookArgs) => {
        const name = a.c.req.param("name") ?? "";
        if (!ALL_TOOLS.has(name))
          return {
            status: 422,
            body: {
              error: "validation_failed",
              code: "VALIDATION_ERROR",
              details: [{ field: "name", message: "その道具はありません" }],
            },
          };
        const sid = a.ctx.sessionId ?? null;
        if (!sid) return { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
        const token = a.c.req.header(TOKEN_HEADER) ?? "";
        if (token.length < 20) return forbidden("この道具の鍵は使えません");
        const job = (
          await pool.query<ToolJob>(
            "select job_id, member_id, tenant_id, conversation_id, ticket_id, kind, taken_session_id, talk_kind from app.bridge_tool_job($1)",
            [hashToolToken(token)],
          )
        ).rows[0];
        // 終わった仕事の鍵・別の仕事の鍵・受け取っていない PC からは通さない（D-110.3・D-128.163）
        if (!job || job.job_id !== a.id || job.taken_session_id !== sid) return forbidden("この道具の鍵は使えません");
        if (!toolsFor(job).includes(name)) return forbidden("この仕事ではその道具を使えません");
        if (name === "ticket_read") {
          // DB でも鍵のハッシュと受け取った PC を見る（2 層目・K62-API-073）
          const v = (
            await pool.query<{ v: unknown }>("select app.ticket_tool_read($1, $2, $3) as v", [
              job.job_id,
              hashToolToken(token),
              sid,
            ])
          ).rows[0]?.v;
          if (!v) return forbidden("このチケットはもう読めません");
          return { status: 201, body: { data: { result: v } } };
        }
        const b = await rawBody(a);
        const input = b["input"] && typeof b["input"] === "object" ? (b["input"] as Record<string, unknown>) : {};
        if (name === "draft_propose") {
          // AI が作る画面の会話に案を付ける（2 層目は DB の入口が鍵・PC・会話の種類をもう一度見る・K-775）
          const parsed = parseDraftProposeInput(input);
          if ("status" in parsed) return parsed;
          return runDraftPropose(pool, job.job_id, hashToolToken(token), sid, parsed);
        }
        const v = (await TOOLS[name]!(pool, job.member_id, job.job_id, input)) as { error?: string } | null;
        if (v && typeof v === "object" && "error" in v && v.error)
          return {
            status: 422,
            body: {
              error: "validation_failed",
              code: "VALIDATION_ERROR",
              details: [{ field: "input", message: String(v.error) }],
            },
          };
        return { status: 201, body: { data: { result: v ?? null } } };
      },
    },
  };
}
