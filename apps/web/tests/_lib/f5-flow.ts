// 中間テスト 3（K-64）の道具：試験の PC に仕事を運ばせる・チケットと人を用意する・承認の時刻を進める。
//   PC は K-58 の _lib/test-pc.ts（本物の Bridge の引き取り・生きている知らせ）をそのまま使い、その PC の印で契約の口
//   （takeBridgeJob・reportJobProgress・getJobControl・finishBridgeJob・K-62）を、Bridge の輪（apps/bridge/src/loop.ts）と同じ形で 1 回ずつ呼ぶ。
//   AI は決まった答えを返す差し替え（finish に決まった文を入れる）。本物の AI・Claude Code は呼ばない。
//   輪そのものを回さない理由は K-58 と同じ（60 秒ごとの知らせ・20 秒の待ち受けで、時刻と順番を試験が決められない）。輪が契約の口を呼ぶことは K-62 の
//   apps/bridge/test/delegate.test.ts（K62-BRG-…）が持つ。
//   探したもの：apps/web/tests/_lib/api.ts の bridgeTake・bridgeFinish・bridgeProgress（前の道すじ /api/auth-ext/bridge/… を叩く。K-62 で消える）・
//   apps/api/test/features/F5/delegate-kit.ts（口の単体の試験の道具。土台 fixture.ts の上で動き、画面の試験からは使えない）。どれも使えないので作った。
//   人を作る・PC をつなぐ・時刻を進めるは K-58 の道具（newcomer.ts・test-pc.ts・clock.ts）を使い、写しは置かない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { API, PW, admin, agreeCurrentTerms, sha256, uniqEmail } from "./api";
import type { Newcomer } from "./newcomer";
import { testPc, type TestPc } from "./test-pc";

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

/** 契約の口の答え（{ data } の中身） */
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
  /** 終わりを返す。返すのは口の番号と outcome（awaiting_approval・stopped・done） */
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

/** 人のログインの印で契約の口を呼ぶ（準備と、画面の外から口を叩く筋だけ） */
export async function asPerson(token: string, method: "GET" | "POST", path: string, body?: Body) {
  const r = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "idempotency-key": `k64-${randomBytes(8).toString("hex")}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = (await r.json().catch(() => ({}))) as { data?: Body; code?: string };
  return { status: r.status, data: j.data ?? null, code: j.code ?? null };
}

/** PC をつなぐ（接続コードは口で出し、引き取りは本物の Bridge の claimCode・最初の知らせ 1 回）。画面でつなぐ道は K-58 が持つ */
export async function pairedPc(token: string, label: string): Promise<TestPc> {
  const c = await asPerson(token, "POST", "/bridge/pairing-codes", {});
  if (c.status !== 201) throw new Error(`接続コードの口が ${c.status}`);
  const pc = testPc(label);
  const got = await pc.enterCode(String(c.data?.["code"]));
  if (!got.ok) throw new Error(`引き取れない：${got.message}`);
  const b = await pc.beat();
  if (b >= 300) throw new Error(`最初の知らせが ${b}`);
  return pc;
}

/** チケットを口で 1 枚作る（作る画面は K-60・K-58 が持つ）。実施事項は 2 項目（完了の小窓のチェックになる） */
export async function ticketOf(me: Newcomer, title: string): Promise<string> {
  const scope = await admin<{ s: string }>("select scope_id as s from members where id = $1", [me.memberId]);
  const kinds = await asPerson(me.token, "GET", "/ticket_kinds");
  const list = (kinds.data as unknown as { id: string; name: string }[] | null) ?? [];
  const kind = list.find((k) => k.name === "タスク");
  if (!kind) throw new Error("チケットの種類「タスク」が無い");
  const jst = new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10);
  const r = await asPerson(me.token, "POST", "/tickets", {
    scope_id: scope[0]!.s,
    kind_id: kind.id,
    title,
    assignee_member_id: me.memberId,
    due_on: jst,
    sections: {
      purpose: "先方に出す見積のたたき台を作って送る（中間テスト 3）",
      done: "先方が見積を受け取った",
      todo: "- 見積を作る\n- 先方に送る",
    },
  });
  if (r.status !== 201) throw new Error(`チケットを作る口が ${r.status}`);
  return String(r.data?.["id"]);
}

/** 同じ会社のもう 1 人（招待を受けた人）。画面は使わず、ログインの印だけ返す（その人の PC をつなぐため）。
 *  作り方は api.ts の viewerViaApi と同じ（招待の行を置き、受ける口を通す）。役は member */
export async function teammate(me: Newcomer): Promise<{ memberId: string; token: string }> {
  const tenant = await admin<{ t: string }>("select tenant_id as t from members where id = $1", [me.memberId]);
  const token = randomBytes(24).toString("base64url");
  const email = uniqEmail();
  await admin(
    "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, 'member', $3, now() + interval '7 days', $4)",
    [tenant[0]!.t, email, sha256(token), me.memberId],
  );
  const r = await fetch(`${API}/api/auth-ext/invitations/${token}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "中間3 同僚", password: PW }),
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(`招待を受ける口が ${r.status}`);
  const j = (await r.json()) as { data: { token: string } };
  const u = await admin<{ id: string; m: string }>(
    `select u.id, m.id as m from kaname_auth."user" u join members m on m.auth_user_id = u.id where u.email = $1`,
    [email],
  );
  await agreeCurrentTerms(u[0]!.id);
  return { memberId: u[0]!.m, token: j.data.token };
}

/** 承認（approvals.decided_at）を「いまから ago 前」に置く（＝承認してから ago たった・D-128.98 の 24 時間）。動かした行の数 */
export async function approvedAgo(approvalId: string, ago: string): Promise<number> {
  const r = await admin<{ id: string }>(
    "update approvals set decided_at = now() - $2::interval, resolved_at = now() - $2::interval where id = $1 returning id",
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
