// 中間テスト 3（K-64）の道具：試験の PC に仕事を運ばせる・承認の時刻を進める・F5 の記録（承認・実行・成果物・やり取り・段）を DB から読む。
//   PC は K-58 の _lib/test-pc.ts（本物の Bridge の引き取り・生きている知らせ）をそのまま使い、その PC の印で契約の口
//   （takeBridgeJob・reportJobProgress・getJobControl・finishBridgeJob・K-62）を、Bridge の輪（apps/bridge/src/loop.ts）と同じ形で 1 回ずつ呼ぶ。
//   AI は決まった答えを返す差し替え（finish に決まった文を入れる）。本物の AI・Claude Code は呼ばない（本物の Bridge の輪の通しは K-97 の後の K-65・D-129.14）。
//   輪そのものを回さない理由は K-58 と同じ（60 秒ごとの知らせ・20 秒の待ち受けで、時刻と順番を試験が決められない）。輪が契約の口を呼ぶことは K-62 の
//   apps/bridge/test/delegate.test.ts（K62-BRG-…）が持つ。
//   探したもの：apps/web/tests/_lib/api.ts の bridgeTake・bridgeFinish・bridgeProgress（前の道すじ /api/auth-ext/bridge/… を叩く。K-62 で消える）・
//   apps/api/test/features/F5/delegate-kit.ts（口の単体の試験の道具。土台 fixture.ts の上で動き、画面の試験からは使えない）。どれも使えないので作った。
//   人を作る・PC をつなぐ・チケットを作る・時刻を進めるは _lib の道具（newcomer.ts・prep.ts・test-pc.ts・clock.ts）を使い、写しは置かない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { API, admin } from "./api";
import type { TestPc } from "./test-pc";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/** 本物の Bridge の名乗りと約束の版（K-62 で 5 に上がる）。test-pc.ts と同じ読み方（apps/bridge は CommonJS） */
function bridgeWords(): { ua: string; protocol: number } {
  const from = createRequire(join(ROOT, "apps/bridge/src/main.ts"));
  return {
    ua: (from("./pairing.ts") as { BRIDGE_UA: string }).BRIDGE_UA,
    protocol: (from("./loop.ts") as { BRIDGE_PROTOCOL: number }).BRIDGE_PROTOCOL,
  };
}

/** 決まった答え（AI の差し替え）。どの筋でも同じ文を返す */
export const AI = {
  made: "見積のたたき台：合計 120,000 円（内訳 3 行・中間テスト 3）",
  remade: "見積のたたき台（直した）：宛名を株式会社サンプルにしました",
  sent: "先方に見積を送りました（宛先 1 件・中間テスト 3）",
  empty: "   ",
} as const;

/** 契約の口の答え（{ data } の中身・takeBridgeJob の job） */
type Body = Record<string, unknown>;
export interface Job {
  job_id: string;
  kind: string;
  ticket_id: string | null;
  phase: string | null;
  prompt: string;
  agent_session_id: string | null;
  permission_mode: string;
  tool_token: string | null;
}

/** PC の印で口を呼ぶ道具（Bridge の輪の 1 回分ずつ） */
export interface PcWork {
  /** 仕事を取る（待ち受けなし）。無ければ null。idle は「何も動かしていない」（取り残しを片付けてもらう） */
  take: (o?: { idle?: boolean }) => Promise<Job | null>;
  progress: (jobId: string, seq: number, text: string) => Promise<number>;
  control: (jobId: string) => Promise<{ stop: boolean; reason: string | null }>;
  /** 終わりを返す。返すのは口の番号と outcome（作る段：awaiting_approval・stopped。実行の段の言葉は K-62・K-63 のどちらも決めていないので、筋は DB で見る） */
  finish: (
    jobId: string,
    b: { state: "done" | "stopped" | "cancelled"; result?: string; reason?: string; agent_session_id?: string },
  ) => Promise<{ status: number; outcome: string | null }>;
}

let seq = 0;
/** つながった試験の PC（K-58 の testPc）に、仕事をさせる口を足す */
export function workOf(pc: TestPc): PcWork {
  const w = bridgeWords();
  const ip = `10.64.${(++seq % 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  const call = async (method: "GET" | "POST", path: string, body?: Body, extra: Record<string, string> = {}) => {
    const token = pc.token();
    if (!token) throw new Error("まだつながっていない PC は仕事を取らない");
    const r = await fetch(`${API}/api/v1/bridge/jobs${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-bridge-session": token,
        "user-agent": w.ua,
        "x-forwarded-for": ip,
        ...extra,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = (await r.json().catch(() => ({}))) as { data?: Body };
    return { status: r.status, data: j.data ?? null };
  };
  return {
    take: async (o = {}) => {
      const r = await call("POST", "/take", { wait_sec: 0, protocol: w.protocol, idle: o.idle ?? false });
      if (r.status !== 201) throw new Error(`仕事を取る口が ${r.status}`);
      return (r.data?.["job"] as Job | null | undefined) ?? null;
    },
    progress: async (jobId, n, text) =>
      (await call("POST", `/${jobId}/progress`, { seq: n, kind: "status", text })).status,
    control: async (jobId) => {
      const r = await call("GET", `/${jobId}/control`);
      return { stop: Boolean(r.data?.["stop"]), reason: (r.data?.["reason"] as string | null | undefined) ?? null };
    },
    finish: async (jobId, b) => {
      const r = await call("POST", `/${jobId}/finish`, b, { "idempotency-key": `k64-${jobId}-${b.state}` });
      return { status: r.status, outcome: (r.data?.["outcome"] as string | undefined) ?? null };
    },
  };
}

/** 承認（approvals.decided_at）を「いまから ago 前」に置く（＝承認してから ago たった・D-128.98 の 24 時間）。動かした行の数。
 *  K-63 は 24 時間を decided_at から数える。resolved_at は触らない（決まった承認の resolved_at は DB の引き金 app.approval_once（0063）が変えさせない） */
export async function approvedAgo(approvalId: string, ago: string): Promise<number> {
  const r = await admin<{ id: string }>(
    "update approvals set decided_at = now() - $2::interval where id = $1 returning id",
    [approvalId, ago],
  );
  return r.length;
}

/** DB：そのチケットの承認待ち・承認の行（古い順） */
export const approvalsOf = (ticketId: string) =>
  admin<{
    id: string;
    status_id: string;
    decision: string | null;
    decided_at: Date | null;
    irreversible: boolean;
    approver_member_id: string | null;
    action_run_id: string | null;
    return_reason: string | null;
    note: string | null;
  }>(
    `select id, status_id, decision, decided_at, irreversible, approver_member_id, action_run_id, return_reason, note
       from approvals where ticket_id = $1 and deleted_at is null order by created_at, id`,
    [ticketId],
  );
/** DB：そのチケットの実行の記録と仕事（古い順） */
export const runsOf = (ticketId: string) =>
  admin<{
    id: string;
    phase: string;
    status_id: string;
    created_by: string;
    approval_id: string | null;
    job_id: string;
    job_state: string;
    job_member: string;
    taken_session_id: string | null;
    job_reason: string | null;
  }>(
    `select r.id, r.phase, r.status_id, r.created_by, r.approval_id, j.id as job_id, j.state_id as job_state,
            j.member_id as job_member, j.taken_session_id,
            j.stopped_reason as job_reason
       from action_runs r join bridge_jobs j on j.id = r.bridge_job_id
      where r.ticket_id = $1 order by r.created_at, r.id`,
    [ticketId],
  );
/** DB：成果物の区画の版（古い順） */
export const artifactsOf = (ticketId: string) =>
  admin<{ version: number; text: string | null }>(
    `select v.version, v.body->>'text' as text from ticket_section_versions v
       join ticket_sections s on s.id = v.section_id
      where s.ticket_id = $1 and s.section_key = 'artifacts' order by v.version`,
    [ticketId],
  );
/** DB：実施事項（todo）の区画の最新の版の本文 */
export const todoNow = async (ticketId: string): Promise<string> =>
  (
    await admin<{ t: string }>(
      `select v.body->>'text' as t from ticket_section_versions v join ticket_sections s on s.id = v.section_id
        where s.ticket_id = $1 and s.section_key = 'todo' order by v.version desc limit 1`,
      [ticketId],
    )
  )[0]!.t;
/** DB：やり取りの 1 行（kind system・古い順） */
export const systemLines = async (ticketId: string): Promise<string[]> =>
  (
    await admin<{ body: string }>(
      "select body::text as body from ticket_messages where ticket_id = $1 and kind = 'system' order by created_at, id",
      [ticketId],
    )
  ).map((r) => r.body);
/** DB：チケットの段の言葉・完了の時刻と押した人 */
export const ticketState = async (ticketId: string) =>
  (
    await admin<{ stage: string; completed_at: Date | null; completed_by: string | null }>(
      `select s.key as stage, t.completed_at, t.completed_by from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1`,
      [ticketId],
    )
  )[0]!;
/** DB：段だけを置き直す（開き直す口は後の F5／F7・K63-API-055 と同じ置き方） */
export async function setStage(ticketId: string, key: string): Promise<void> {
  await admin(
    `update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = $2) where id = $1`,
    [ticketId, key],
  );
}
/** DB：チケットを消す（消す口は後の F4。行の消した時刻と人だけを置く・K-62・K-63 の単体の試験と同じ置き方） */
export async function deleteTicketRow(ticketId: string, by: string): Promise<void> {
  await admin("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [ticketId, by]);
}
