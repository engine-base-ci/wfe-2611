// AI に任せる（K-62）の PC が呼ぶ口：取る（takeBridgeJob）・途中の様子（reportJobProgress）・止める合図（getJobControl）・終わる（finishBridgeJob）。
//   前の道すじ /api/auth-ext/bridge/take・progress・finish（ext.ts）と /bridge/control（agent.ts）の中身をここへ移した。
//   PC は印（x-bridge-session）で入り、入口（op.ts）が ctx.role = "device"・ctx.sessionId にする（K-57）。仕事の id は道すじで受ける。
//   書くのは関門 C2 の関数だけ（app.bridge_take_job・app.bridge_progress・app.bridge_control・app.bridge_finish_job・0091）。
//   progress・control・finish はその仕事を受け取った PC からだけ（ほかの PC は 404・D-128.163）。ログにプロンプト・結果・鍵・印を出さない
import type pg from "pg";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { issueToolToken } from "../../../auth/agent-tools.js";
import { AGENT_CONVENTIONS } from "../../../auth/conventions.js";
import { parseDigest, takeRemember } from "../../../auth/memory.js";
import { BRIDGE_PROTOCOL_MIN } from "../../F3/connect-pc/hooks.js";
import { PROGRESS_KINDS, REPLY_MAX, charLength, progressPayload, type ProgressKind } from "./records.js";

/** 待ち受けは最長 20 秒・中で 1 秒ごとに見る・動いていないときは 5 秒あける（前の道すじと同じ・D-097） */
const TAKE_WAIT_MAX_SEC = 20;
const TAKE_TICK_MS = 1_000;
const TAKE_IDLE_MS = 5_000;
const FINISH_STATES = new Set(["done", "stopped", "cancelled"]);

const gone = (): HookReply => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

/** 入口が表記ゆらぎを揃える前の体（返事・結果の文は本人の書いたまま残す）。形は入口が契約の strict な形で確かめ済み */
export async function rawBody(a: HookArgs): Promise<Record<string, unknown>> {
  const raw = (await a.c.req.json().catch(() => ({}))) as unknown;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}
const sessionOf = (a: HookArgs): string | null => a.ctx.sessionId ?? null;

type TakenJob = {
  job_id: string;
  prompt: string;
  agent_session_id: string | null;
  conversation_id: string | null;
  permission_mode: string;
  model: string | null;
  effort: string | null;
  tools: string[] | null;
  allowed_tools: string[] | null;
  attachments: { id: string; name: string; mime: string; size: number }[];
  kind: "chat" | "login_check" | "ticket";
  credential_id: string | null;
  ticket_id: string | null;
  phase: "make" | "execute" | null;
};

export function bridgeJobHooks(pool: pg.Pool): Record<string, Hook> {
  const one = async <T>(sql: string, args: unknown[]): Promise<T | undefined> =>
    (await pool.query<{ v: T }>(sql, args)).rows[0]?.v;
  const takeOne = async (sid: string): Promise<TakenJob | null> =>
    (await pool.query<TakenJob>("select * from app.bridge_take_job($1)", [sid])).rows[0] ?? null;

  /** 渡す仕事の中身：行の中身はそのまま。会話の仕事には記憶と会話の決まり、会話とチケットの仕事には道具の鍵（その仕事の間だけ・D-110.3） */
  const withExtras = async (sid: string, job: TakenJob) => {
    const memories = job.conversation_id
      ? ((await one<unknown>("select app.bridge_job_memories($1, $2) as v", [sid, job.job_id])) ?? [])
      : [];
    const tool_token =
      job.conversation_id || job.kind === "ticket" ? await issueToolToken(pool, sid, job.job_id) : null;
    const browser =
      (await one<string | null>("select app.bridge_job_browser($1, $2) as v", [sid, job.job_id])) ?? "off";
    return { ...job, memories, tool_token, conventions: job.conversation_id ? AGENT_CONVENTIONS : null, browser };
  };

  return {
    takeBridgeJob: {
      before: async (a: HookArgs) => {
        const sid = sessionOf(a);
        if (!sid) return gone();
        const wait = Math.max(0, Math.min(TAKE_WAIT_MAX_SEC, Number(a.input["wait_sec"]) || 0));
        // 仕事の問い合わせも「生きている」の知らせ（D-097）。PC の行が無くなっていれば 401（Bridge は印を捨てる・G-14）
        const hot = await one<boolean | null>("select app.bridge_poll($1) as v", [sid]);
        if (hot === null || hot === undefined) return gone();
        // 古い Bridge には仕事を渡さない。生きている知らせだけ受ける（E-CONN-012）
        if (!(Number(a.input["protocol"]) >= BRIDGE_PROTOCOL_MIN))
          return {
            status: 201,
            body: { data: { job: null, forbidden_domains: [], next_ms: TAKE_IDLE_MS, outdated: true } },
          };
        // 「いま何も動かしていない」：その PC が受け取ったまま残った仕事だけ理由つきで止める（D-128.163）
        if (a.input["idle"] === true) await pool.query("select app.bridge_sweep_orphans($1)", [sid]);
        // 台帳で禁止・銀行のドメイン（D-107.1）。どの仕事にも渡す。資格情報は渡さない（D-107.7）
        const forbidden = (await one<unknown[]>("select app.bridge_blocked_domains() as v", [])) ?? [];
        const until = Date.now() + (hot ? wait * 1000 : 0);
        for (;;) {
          const job = await takeOne(sid);
          if (job)
            return {
              status: 201,
              body: {
                data: { job: await withExtras(sid, job), forbidden_domains: forbidden, next_ms: 0, outdated: false },
              },
            };
          if (Date.now() >= until) break;
          await new Promise((r) => setTimeout(r, TAKE_TICK_MS));
        }
        return {
          status: 201,
          body: {
            data: {
              job: null,
              forbidden_domains: forbidden,
              next_ms: hot && wait > 0 ? 0 : TAKE_IDLE_MS,
              outdated: false,
            },
          },
        };
      },
    },
    reportJobProgress: {
      before: async (a: HookArgs) => {
        const sid = sessionOf(a);
        if (!sid) return gone();
        const b = await rawBody(a);
        const kind = String(a.input["kind"] ?? "");
        if (!(PROGRESS_KINDS as readonly string[]).includes(kind))
          return invalid("kind", `kind は ${PROGRESS_KINDS.join("／")} のどれかです`);
        const payload = progressPayload(kind as ProgressKind, b);
        const ok = await one<boolean>("select app.bridge_progress($1, $2, $3, $4, $5::jsonb) as v", [
          sid,
          a.id,
          Number(a.input["seq"] ?? 0),
          kind,
          JSON.stringify(payload),
        ]);
        if (!ok) return notFound();
        return { status: 201, body: { data: { ok: true } } };
      },
    },
    getJobControl: {
      before: async (a: HookArgs) => {
        const sid = sessionOf(a);
        if (!sid) return gone();
        const v = await one<{ stop: boolean; reason: string | null } | null>("select app.bridge_control($1, $2) as v", [
          sid,
          a.id,
        ]);
        if (!v) return notFound();
        return { status: 200, body: { data: { stop: v.stop === true, reason: v.reason ?? null, steers: [] } } };
      },
    },
    finishBridgeJob: {
      before: async (a: HookArgs) => {
        const sid = sessionOf(a);
        if (!sid) return gone();
        const b = await rawBody(a);
        const state = String(a.input["state"] ?? "");
        if (!FINISH_STATES.has(state)) return invalid("state", "結末は done／stopped／cancelled のどれかです");
        const result = b["result"];
        const reason = b["reason"];
        if (result !== undefined && result !== null && typeof result !== "string") return invalid("result", "文字");
        if (reason !== undefined && reason !== null && typeof reason !== "string") return invalid("reason", "文字");
        if (typeof result === "string" && charLength(result) > REPLY_MAX)
          return invalid("result", `結果は ${REPLY_MAX} 字までです`);
        const agentSession = typeof a.input["agent_session_id"] === "string" ? a.input["agent_session_id"] : null;
        // 記憶の毎朝のまとめの仕事なら、答え（JSON）を読んで記憶に入れる（D-105.4）
        const digestId = (await one<string | null>("select app.digest_of_job($1, $2) as v", [sid, a.id])) ?? null;
        // 「覚えて」の印は返事から消し、個人の記憶に入れる（D-105.1）。会話の仕事だけ。チケットの仕事の結果は本人の書いたまま成果物に残す（K62-API-071）
        const kind = (await one<string | null>("select app.bridge_job_kind($1, $2) as v", [sid, a.id])) ?? null;
        if (kind === null) return notFound();
        const rem =
          kind !== "ticket" && state === "done" && typeof result === "string" && result && !digestId
            ? takeRemember(result)
            : { text: typeof result === "string" ? result : null, items: [] as string[] };
        const v = await one<{ ok: boolean; outcome: string } | null>(
          "select app.bridge_finish_job($1, $2, $3, $4, $5, $6) as v",
          [sid, a.id, state, rem.text, typeof reason === "string" ? reason : null, agentSession], // 止まった理由は切らない（D-130.1・D-130.4・K62-API-077）
        );
        if (!v) return notFound();
        // この仕事で道具から渡した成果物を、書かれた返事に結ぶ（D-121.3）
        await pool.query("select app.artifact_attach_job($1)", [a.id]);
        if (rem.items.length) await pool.query("select app.agent_remember($1, $2, $3)", [sid, a.id, rem.items]);
        if (digestId) {
          const parsed = state === "done" && typeof result === "string" && result ? parseDigest(result) : null;
          await pool.query("select app.agent_digest_apply($1, $2, $3, $4::jsonb, $5)", [
            sid,
            digestId,
            !!parsed,
            parsed ? JSON.stringify(parsed) : null,
            parsed
              ? null
              : state === "done"
                ? "自分のAI の答えが決まった形（JSON）ではありませんでした。もう一度押してください"
                : typeof reason === "string" && reason
                  ? reason
                  : "止まりました",
          ]);
        }
        return { status: 201, body: { data: { ok: true, outcome: v.outcome } } };
      },
    },
  };
}
