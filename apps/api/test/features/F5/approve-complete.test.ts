// K-63「承認して完了する」の単体の試験（口・本物の DB・本物の PC の印）。名前の頭の行 ID（K63-API-…）は 11_tickets/K-63.md の表のマスと分岐に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//
// 土台は K-57・K-60 の apps/api/test/features/fixture.ts（本物の Postgres に migration を全部当てる・本物の PC の印の解決・会社と人を作る）。
//   画面のログインだけは偽：fixture と同じ「Bearer fake:<役>:<会社>:<人>」に、本人確認の取り直しの時刻「:su=<ミリ秒>」を足せる app をこの試験の中で立てる（fixture.ts は変えない）。
//   口の振る舞いは本番と同じもの：fixture の hooks（K-57・K-60）＋ K-62 の delegateHooks（PC が仕事を取る・返す）＋ このチケットの approveHooks。
// 承認待ちの行は、K-62 の作る段が終わったときと同じ形を DB に直に置く（作る段を通す通しは中間テスト K-64）。
//   K-62 の形：bridge_jobs（kind ticket・done・結果あり・続きの id）・action_runs（phase make・done・bridge_job_id・ticket_id）・成果物の区画（artifacts）・
//   approvals（kind artifact・approver_member_id＝担当者・action_run_id＝作る段の実行・requested_by＝動かした人・status_id pending）・チケットは承認待ち（awaiting_approval）・delegated_to_clone
// 時刻は眠らずに、DB の列を now() からずらして置く（D-128.130・時間で隠さない）。承認では本人確認を取り直さない（D-128.177）ことを、偽のログインの :su=（取り直しの時刻）を古く・無しにして確かめる。
//
// 試験が決める口の形（K-63.md の「入力の形」「答えの形」「エラーの対応」）:
//   listApprovalQueue  GET  /approvals/queue         → 200 { data: [{ kind, id, ticket_id, ticket_number, title, from_member_id, from_name, check_summary, due_on, decide_inline, irreversible, primary_action, secondary_action, note, created_at }], meta: { limit, counts: { total } } }
//   getApproval        GET  /approvals/:id           → 200 { data: { approval, ticket, artifact_version: { version, text }, checks, check_summary, cautions, irreversible, can_decide, chain } }
//   approveApproval    POST /approvals/:id/approve   ← {} → 201 { data: { id, decision, decided_at, status_id, ticket_id, run_id, pc: "live"|"asleep" } }
//   returnApproval     POST /approvals/:id/return    ← { note } → 201（同じ形）
//   completeTicket     POST /tickets/:id/complete    ← { todo_checked, todo_version, conditions_confirmed } → 201 { data: { ticket: { id, number, stage_key, completed_at, completed_by }, knowledge_candidates, skipped_reason } }
//   PC の口（K-62）：POST /bridge/jobs/take ← { protocol, idle, wait_sec }（頭 x-bridge-session）→ { data: { job: 仕事 | null, … } }・POST /bridge/jobs/:id/finish ← { state, result, reason, agent_session_id }
//     K-62 の契約の形がこの道具（take・finish）と違えば、この 2 つの道具だけを K-62 の形に合わせる（作る役に戻す）
// 試験が前提にする DB の形（このチケットの migration 0092）：app.approval_decide・app.ticket_execute_expire・app.ticket_complete・
//   引き金 app.ticket_execute_job_end・action_runs.approval_id・tickets.completed_at／completed_by
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "@kaname/db/repository";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import type { Transport } from "@kaname/notify";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import { delegateHooks } from "../../../src/features/F5/delegate/index.js";
import { approveHooks } from "../../../src/features/F5/approve-complete/index.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { pairMemberForTest } from "../../bridge_pair.js";

// ---- 決めた文と言葉（K-63.md・errors.json に足す）----
const CHECK_NONE = "検査なし（まだ流していません）"; // 骨格の間の印（D-128.138）
const NOTE_24H = "承認から 24 時間を過ぎたので、実行の前にもう一度確かめてください"; // 聞き直しの行の note（D-127.9・D-128.98）
const STOP_GONE = "チケットが消されたので止めました";
const SKIPPED = "候補はまだ出していません"; // 完了のときのナレッジの候補（D-128.138）
const CONF_DONE = "E-CONF-003"; // この承認はもう処理されています
const CONF_STAGE = "E-CONF-016"; // 承認待ち・実行中・確認中は完了にできない
const CONF_TODO_CHANGED = "E-CONF-017";
const CONF_ALREADY = "E-CONF-018";
const VAL_REASON_EMPTY = "E-VAL-020";
const VAL_REASON_LONG = "E-VAL-021";
const VAL_TODO_LEFT = "E-VAL-022";
const VAL_NOT_CONFIRMED = "E-VAL-023";
const VAL_CHILDREN = "E-VAL-024";
const GONE = "E-PAGE-001";
const ARTIFACT = "株式会社サンプル 御中\n11 月分の請求書をお送りします。"; // 成果物の本文（知らせ・証跡・ログに出してはいけない）
const MIN = 60_000;

let f: Fixture;
let app: ReturnType<typeof createApp>;
const hooks: Record<string, Hook> = {};
const limits: Record<string, number> = {};
let T: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let boss: Person; // 担当者（承認する人）
let writer: Person; // 同じグループの書ける人（承認する人でない）
let viewer: Person; // 見るだけの人
let manager: Person; // グループのマネージャー
let outsider: Person; // 別の会社の人

type J = Record<string, unknown> & { data?: Record<string, unknown> & unknown[]; meta?: Record<string, unknown> };
const json = async (r: Response) => (await r.clone().json()) as J;
const one = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
  (await f.admin.query(sql, p)).rows[0] as R;
const num = async (sql: string, p: unknown[] = []) => Number((await one<{ n: string }>(sql, p)).n);

/** 偽の画面のログイン。su は本人確認の取り直しの時刻（ミリ秒） */
const auth = (p: Person, o: { su?: number; role?: string } = {}) => ({
  authorization: `Bearer fake:${o.role ?? "member"}:${p.tenantId}:${p.id}${o.su === undefined ? "" : `:su=${o.su}`}`,
});
const req = (
  method: string,
  path: string,
  o: { body?: unknown; headers?: Record<string, string>; ip?: string } = {},
): Promise<Response> =>
  Promise.resolve(
    app.request(`http://localhost/api/v1${path}`, {
      method,
      headers: { "content-type": "application/json", "x-forwarded-for": o.ip ?? nextIp(), ...(o.headers ?? {}) },
      ...(o.body === undefined ? {} : { body: typeof o.body === "string" ? o.body : JSON.stringify(o.body) }),
    }),
  );
const queue = (p: Person, q = "") => req("GET", `/approvals/queue${q}`, { headers: auth(p) });
const detail = (p: Person, id: string) => req("GET", `/approvals/${id}`, { headers: auth(p) });
const approve = (p: Person, id: string, o: { su?: number; key?: string; body?: unknown } = {}) =>
  req("POST", `/approvals/${id}/approve`, {
    body: o.body ?? {},
    headers: { ...auth(p, { su: o.su }), ...(o.key ? { "idempotency-key": o.key } : {}) },
  });
const giveBack = (p: Person, id: string, note: unknown, o: { key?: string } = {}) =>
  req("POST", `/approvals/${id}/return`, {
    body: { note },
    headers: { ...auth(p), ...(o.key ? { "idempotency-key": o.key } : {}) },
  });
const complete = (p: Person, ticketId: string, body: unknown, o: { key?: string } = {}) =>
  req("POST", `/tickets/${ticketId}/complete`, {
    body,
    headers: { ...auth(p), ...(o.key ? { "idempotency-key": o.key } : {}) },
  });
/** PC が仕事を取りに来る。idle: true は「何も動かしていない」＝その PC が受け取って動いていた仕事を片付ける（K63-API-015 だけが使う） */
const take = async (pc: { token: string }, o: { idle?: boolean } = {}) => {
  const r = await req("POST", "/bridge/jobs/take", {
    body: { protocol: 99, idle: o.idle ?? false, wait_sec: 0 },
    headers: { "x-bridge-session": pc.token },
  });
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  // K-62 の答え：{ data: { job: 仕事 | null, forbidden_domains, next_ms, outdated } }
  const d = (await json(r)).data as unknown as { job?: Record<string, unknown> | null } | null;
  const job = d?.job ?? null;
  return job ? { ...job, id: String(job["job_id"] ?? job["id"]) } : null;
};
const finish = async (
  pc: { token: string },
  jobId: string,
  b: { state: string; result?: string | null; reason?: string | null; agent_session_id?: string | null },
) => {
  const r = await req("POST", `/bridge/jobs/${jobId}/finish`, { body: b, headers: { "x-bridge-session": pc.token } });
  expect(r.status, await r.clone().text()).toBeLessThan(300);
};
/** PC の最後の知らせを今から sec 秒前に置く（75 秒で「閉じている」） */
const lastSeen = (sid: string, sec: number) =>
  f.admin.query("update sessions set last_seen_at = now() - make_interval(secs => $2) where id = $1", [sid, sec]);

// ---- 種を置く ----
const stageOf = async (tenant: string, key: string) =>
  (await one<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = $2", [tenant, key])).id;
const stageKeyOf = async (ticketId: string) =>
  (
    await one<{ key: string }>(
      "select s.key from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
      [ticketId],
    )
  ).key;
interface Ticket {
  id: string;
  number: string;
  tenant: string;
  scope: string;
  assignee: Person;
}
interface Team {
  by: Person;
  pc: { token: string; sid: string };
}
/** 試験ごとに新しい「AI に任せた人」とその人の PC（人と PC を試験どうしで使い回さない・試験の順番に頼らない） */
async function team(name = "山田", co: { tenantId: string; rootScope: string } = T): Promise<Team> {
  const by = await f.person(co.tenantId, co.rootScope, { name, ticketAbility: "edit" });
  const pc = await pairMemberForTest(f.admin, by.id, `${name}の PC`);
  return { by, pc };
}
const TODO = "- 請求書を作る\n- 先方に送る";
async function ticket(
  o: {
    tenant?: string;
    scope?: string;
    assignee?: Person;
    creator?: Person;
    stage?: string;
    title?: string;
    todo?: string | null;
    parent?: string;
    due?: string | null;
  } = {},
): Promise<Ticket> {
  const tenant = o.tenant ?? T.tenantId;
  const scope = o.scope ?? T.rootScope;
  const kind = (
    await one<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [tenant],
    )
  ).id;
  const t = await one<{ id: string; number: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, parent_ticket_id, due_on)
     values ($1, $2, '', $3, $4, $5, $6, $7, $8, $9) returning id, number`,
    [
      tenant,
      scope,
      kind,
      await stageOf(tenant, o.stage ?? "doing"),
      o.title ?? "11 月分の請求書を送る",
      (o.assignee ?? boss).id,
      (o.creator ?? writer).id,
      o.parent ?? null,
      o.due === undefined ? jstDate(3) : o.due,
    ],
  );
  const secs: [string, number, string | null][] = [
    ["purpose", 10, "月末の請求を出す"],
    ["done", 20, "先方が請求書を受け取った"],
    ["todo", 50, o.todo === undefined ? TODO : o.todo],
  ];
  for (const [key, pos, text] of secs) {
    if (text === null) continue;
    const s = await one<{ id: string }>(
      "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version) values ($1, $2, $3, $4, $5, 1) returning id",
      [tenant, t.id, key, pos, JSON.stringify({ text })],
    );
    await f.admin.query(
      "insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body) values ($1, $2, $3, 1, $4)",
      [tenant, t.id, s.id, JSON.stringify({ text })],
    );
  }
  return { ...t, tenant, scope, assignee: o.assignee ?? boss };
}
interface Delegated extends Team {
  approvalId: string;
  makeRunId: string;
  makeJobId: string;
  agentSession: string;
}
/** K-62 の作る段が終わった形を置く：作る段の仕事と実行の記録・成果物の区画・承認待ちの行・チケットは承認待ち */
async function delegated(
  t: Ticket,
  o: { by?: Team; irreversible?: boolean; humanChecks?: unknown[] } = {},
): Promise<Delegated> {
  const tm = o.by ?? (await team());
  const by = tm.by;
  const agentSession = `k63-sess-${Math.random().toString(36).slice(2)}`;
  const job = await one<{ id: string }>(
    `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, agent_session_id, result, started_at, finished_at)
     values ($1, $2, $3, 'ticket', 'done', '（作る段）', $4, $5, now() - interval '2 minutes', now() - interval '1 minute') returning id`,
    [t.tenant, t.scope, by.id, agentSession, ARTIFACT],
  );
  const run = await one<{ id: string }>(
    `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, finished_at, created_by)
     values ($1, $2, $3, 'make', 'done', $4, now() - interval '2 minutes', now() - interval '1 minute', $5) returning id`,
    [t.tenant, t.scope, t.id, job.id, by.id],
  );
  await f.admin.query(
    `insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version) values ($1, $2, 'artifacts', 70, $3, 1)
     on conflict (ticket_id, section_key) do update set body = excluded.body, version = ticket_sections.version + 1`,
    [t.tenant, t.id, JSON.stringify({ text: ARTIFACT })],
  );
  const a = await one<{ id: string }>(
    `insert into approvals (tenant_id, scope_id, kind, ticket_id, action_run_id, approver_member_id, requested_by, status_id, irreversible, human_checks, created_by)
     values ($1, $2, 'artifact', $3, $4, $5, $6, 'pending', $7, $8, $6) returning id`,
    [
      t.tenant,
      t.scope,
      t.id,
      run.id,
      t.assignee.id, // K-62 は結果が届いた時点の担当者を入れる（承認の関数は今の担当者から引く）
      by.id,
      o.irreversible ?? true,
      JSON.stringify(o.humanChecks ?? []),
    ],
  );
  await f.admin.query("update tickets set stage_id = $2, delegated_to_clone = true where id = $1", [
    t.id,
    await stageOf(t.tenant, "awaiting_approval"),
  ]);
  return { ...tm, approvalId: a.id, makeRunId: run.id, makeJobId: job.id, agentSession };
}
const approvalRow = (id: string) =>
  one<Record<string, unknown>>(
    "select decision, decided_at, status_id, resolved_at, return_reason, next_actor, withdrawn_at from approvals where id = $1",
    [id],
  );
const runsOf = (ticketId: string, phase: string) =>
  f.admin
    .query<{
      id: string;
      status_id: string;
      bridge_job_id: string | null;
      approval_id: string | null;
      error_summary: string | null;
    }>(
      "select id, status_id, bridge_job_id, approval_id, error_summary from action_runs where ticket_id = $1 and phase = $2 order by created_at",
      [ticketId, phase],
    )
    .then((r) => r.rows);
const jobOf = (id: string) =>
  one<Record<string, unknown>>(
    "select member_id, state_id, prompt, agent_session_id, permission_mode, stopped_reason, kind from bridge_jobs where id = $1",
    [id],
  );
const messagesOf = (ticketId: string) =>
  f.admin
    .query<{ body: string; kind: string }>(
      "select body, kind from ticket_messages where ticket_id = $1 order by created_at",
      [ticketId],
    )
    .then((r) => r.rows);
const openApprovals = (ticketId: string) =>
  num(
    "select count(*) as n from approvals where ticket_id = $1 and decision is null and withdrawn_at is null and deleted_at is null",
    [ticketId],
  );
/** 承認を済ませて、実行の仕事を積んだ状態にする（口を通す） */
async function approved(t: Ticket, o: Parameters<typeof delegated>[1] = {}) {
  const d = await delegated(t, o);
  const r = await approve(t.assignee, d.approvalId);
  expect(r.status, await r.clone().text()).toBe(201);
  const run = (await runsOf(t.id, "execute")).at(-1)!;
  return { ...d, execRunId: run.id, execJobId: run.bridge_job_id! };
}
/** 実行が終わって作業中に戻った状態（口を通す） */
async function executed(t: Ticket) {
  const a = await approved(t);
  await lastSeen(a.pc.sid, 1);
  const job = await take(a.pc);
  expect(job?.id).toBe(a.execJobId);
  await finish(a.pc, a.execJobId, {
    state: "done",
    result: "送りました（宛先：先方の経理）",
    agent_session_id: a.agentSession,
  });
  expect(await stageKeyOf(t.id)).toBe("doing");
  return a;
}
const todoVersion = async (ticketId: string) =>
  Number(
    (
      await one<{ v: number | null }>(
        "select version as v from ticket_sections where ticket_id = $1 and section_key = 'todo'",
        [ticketId],
      )
    )?.v ?? 0,
  );
const completeBody = async (t: Ticket, extra: Record<string, unknown> = {}) => ({
  todo_checked: [0, 1],
  todo_version: await todoVersion(t.id),
  conditions_confirmed: true,
  ...extra,
});
const details = (j: J) => (j["details"] as { field: string; message: string }[] | undefined) ?? [];
/** その要求で、承認・実行・段・やり取り・証跡が何も変わっていないこと */
async function snapshot(t: Ticket) {
  return {
    stage: await stageKeyOf(t.id),
    runs: await num("select count(*) as n from action_runs where ticket_id = $1", [t.id]),
    jobs: await num(
      "select count(*) as n from bridge_jobs j join action_runs r on r.bridge_job_id = j.id where r.ticket_id = $1",
      [t.id],
    ),
    decided: await num("select count(*) as n from approvals where ticket_id = $1 and decision is not null", [t.id]),
    messages: await num("select count(*) as n from ticket_messages where ticket_id = $1", [t.id]),
    audits: await num("select count(*) as n from audit_events where target_id = any($1)", [
      [
        t.id,
        ...(await f.admin.query<{ id: string }>("select id from approvals where ticket_id = $1", [t.id])).rows.map(
          (x) => x.id,
        ),
      ],
    ]),
  };
}
const jstDate = (days: number) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  f = await makeFixture();
  // 偽の画面のログインに本人確認の時刻（:su=）を足す。PC の印は本物の解決
  const web = async (h: Headers) => {
    const m = /^Bearer fake:(member|ops|client):([0-9a-f-]{36}):([0-9a-f-]{36})(?::su=(\d+))?$/.exec(
      h.get("authorization") ?? "",
    );
    if (!m) return null;
    const ctx: TenantContext = {
      tenantId: m[2]!,
      userId: m[3]!,
      role: m[1] as TenantContext["role"],
      stepUpAt: m[4] ? new Date(Number(m[4])) : null,
    };
    return { ctx, sessionId: "", authUserId: "" };
  };
  Object.assign(hooks, f.hooks, delegateHooks(f.pool), approveHooks(f.pool));
  app = createApp({
    version: "test",
    repo: await createRepository(f.pool),
    resolve: withDevice(web, createDeviceResolver(f.pool)) as never,
    contract: { hooks, limits },
  });
  // この試験は 1 人で 60 回より多く承認・完了する。上限は K63-API-045・046 だけで確かめ、ほかでは上げておく
  for (const op of ["listApprovalQueue", "getApproval", "approveApproval", "returnApproval", "completeTicket"])
    limits[op] = 10_000;
  limits["takeBridgeJob"] = 10_000;
  limits["finishBridgeJob"] = 10_000;
  T = await f.company("K63 の会社", "EG");
  O = await f.company("K63 の別の会社", "OT");
  boss = await f.person(T.tenantId, T.rootScope, { name: "高本", ticketAbility: "edit" });
  writer = await f.person(T.tenantId, T.rootScope, { name: "佐藤", ticketAbility: "edit" });
  viewer = await f.person(T.tenantId, T.rootScope, { name: "見るだけの人", ticketAbility: "view" });
  manager = await f.person(T.tenantId, T.rootScope, { name: "マネージャー", ticketAbility: "edit" });
  await f.admin.query(
    "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
    [T.tenantId, T.rootScope, manager.id],
  );
  outsider = await f.person(O.tenantId, O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
}, 120_000);
afterAll(async () => {
  await f?.close();
});

describe("K-63 承認して完了する：承認・差し戻し（口・本物の DB）", () => {
  it("K63-API-001 承認待ち × 承認待ちの画面を開く × 承認する人：自分が決めるものだけ、期限の早い順（期限なしは最後）。数は行の数と同じ。検査なしの印", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "一覧を見る人", ticketAbility: "edit" });
    const late = await ticket({ assignee: who, due: jstDate(10) });
    const none = await ticket({ assignee: who, due: null });
    const soon = await ticket({ assignee: who, due: jstDate(0) });
    const a1 = await delegated(late, { irreversible: false });
    const a2 = await delegated(none);
    const a3 = await delegated(soon);
    const r = await queue(who);
    expect(r.status).toBe(200);
    const j = await json(r);
    const rows = j.data as unknown as Record<string, unknown>[];
    expect(rows.map((x) => x["id"])).toEqual([a3.approvalId, a1.approvalId, a2.approvalId]);
    expect((j.meta!["counts"] as { total: number }).total).toBe(3);
    const first = rows[0]!;
    expect(first).toMatchObject({
      kind: "artifact",
      ticket_id: soon.id,
      ticket_number: soon.number,
      title: "11 月分の請求書を送る",
      from_member_id: a3.by.id,
      from_name: "山田",
      check_summary: CHECK_NONE,
      due_on: jstDate(0),
      irreversible: true,
      decide_inline: false,
      primary_action: "open",
      secondary_action: "return",
    });
    const inline = rows.find((x) => x["id"] === a1.approvalId)!;
    expect(inline).toMatchObject({ decide_inline: true, primary_action: "approve", irreversible: false });
  });

  it("K63-API-002 承認待ち（取り消せる操作）× 行の「承認する」× 承認する人：承認を記録し、実行の仕事を積む。チケットは実行中・やり取りに 1 行・証跡", async () => {
    const t = await ticket();
    const d = await delegated(t, { irreversible: false });
    const r = await approve(boss, d.approvalId);
    expect(r.status, await r.clone().text()).toBe(201);
    const a = await approvalRow(d.approvalId);
    expect(a).toMatchObject({ decision: "approve", status_id: "approved" });
    expect(a["decided_at"]).not.toBeNull();
    expect(a["resolved_at"]).not.toBeNull();
    const runs = await runsOf(t.id, "execute");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status_id: "queued", approval_id: d.approvalId });
    const job = await jobOf(runs[0]!.bridge_job_id!);
    expect(job).toMatchObject({ kind: "ticket", state_id: "queued" });
    expect(await stageKeyOf(t.id)).toBe("running");
    const msgs = await messagesOf(t.id);
    expect(msgs.filter((m) => m.kind === "system").at(-1)!.body).toContain("高本が承認しました");
    expect(
      await num("select count(*) as n from audit_events where action = 'approval.approve' and target_id = $1", [
        d.approvalId,
      ]),
    ).toBe(1);
  });

  it("K63-API-003 承認待ち × 承認して送る × 承認する人・本人確認の取り直しをしていない（一度もしていない・16 分前）：取り直しを求めずに承認し、実行の仕事を積む（D-128.177）", async () => {
    for (const su of [undefined, Date.now() - 16 * MIN]) {
      const t = await ticket();
      const d = await delegated(t, { irreversible: true });
      const r = await req("POST", `/approvals/${d.approvalId}/approve`, { body: {}, headers: auth(boss, { su }) });
      expect(r.status, await r.clone().text()).toBe(201);
      expect((await json(r))["code"]).not.toBe("STEP_UP_REQUIRED");
      expect((await approvalRow(d.approvalId))["decision"]).toBe("approve");
      expect(await runsOf(t.id, "execute")).toHaveLength(1);
    }
  });

  it("K63-API-004 承認待ち（取り消せる操作として置かれた行）× 承認する：承認の行は irreversible true で残る（取り消せないの印・D-128.177）", async () => {
    const t = await ticket();
    const d = await delegated(t, { irreversible: false });
    expect((await approve(boss, d.approvalId)).status).toBe(201);
    const row = await one<{ irreversible: boolean; decision: string }>(
      "select irreversible, decision from approvals where id = $1",
      [d.approvalId],
    );
    expect(row).toEqual({ irreversible: true, decision: "approve" });
    const t2 = await ticket();
    const d2 = await delegated(t2, { irreversible: true });
    const g = await detail(boss, d2.approvalId);
    expect(JSON.stringify(((await json(g)).data as Record<string, unknown>)["cautions"])).toContain("取り消せません");
    expect((await approve(boss, d2.approvalId)).status).toBe(201);
    expect(
      (await one<{ irreversible: boolean }>("select irreversible from approvals where id = $1", [d2.approvalId]))
        .irreversible,
    ).toBe(true);
  });

  it("K63-API-005 承認待ち（任せた人と承認する人が別の人）× 承認する → PC が取りに来る：実行の仕事は任せた人の PC だけが受け取る。承認した人の PC・ほかの人の PC には渡らない（D-128.176・D-128.156）", async () => {
    const approver = await team("高本（承認する人）");
    const other = await team("佐藤（ほかの人）");
    const t = await ticket({ assignee: approver.by });
    const d = await delegated(t);
    await lastSeen(d.pc.sid, 120);
    expect((await approve(approver.by, d.approvalId)).status).toBe(201);
    const run = (await runsOf(t.id, "execute"))[0]!;
    expect((await jobOf(run.bridge_job_id!))["member_id"]).toBe(d.by.id);
    // 承認した人の PC はつながっていても受け取らない。ほかの人の PC も
    expect(await take(approver.pc)).toBeNull();
    expect(await take(other.pc)).toBeNull();
    expect((await jobOf(run.bridge_job_id!))["state_id"]).toBe("queued");
    // 任せた人の PC が取りに来たら渡る（同じ続きの id）
    await lastSeen(d.pc.sid, 1);
    const job = await take(d.pc);
    expect(job?.id).toBe(run.bridge_job_id);
    expect(job?.["agent_session_id"]).toBe(d.agentSession);
    const taken = await one<{ taken_session_id: string }>("select taken_session_id from bridge_jobs where id = $1", [
      run.bridge_job_id,
    ]);
    expect(taken.taken_session_id).toBe(d.pc.sid);
  });

  it("K63-API-006 承認待ち × 差し戻すと理由 × 承認する人：差し戻しを記録し（理由・next_actor clone）、理由つきの作り直しの仕事を同じ AI に積む。チケットは実行中", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const r = await giveBack(boss, d.approvalId, "  宛名を「株式会社サンプル 経理部」にしてください  ");
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await json(r)).data).toMatchObject({ id: d.approvalId, decision: "return", status_id: "returned" });
    const a = await approvalRow(d.approvalId);
    expect(a).toMatchObject({
      decision: "return",
      status_id: "returned",
      next_actor: "clone",
      return_reason: "宛名を「株式会社サンプル 経理部」にしてください",
    });
    const remake = (await runsOf(t.id, "make")).at(-1)!;
    expect(remake.id).not.toBe(d.makeRunId);
    expect(remake.status_id).toBe("queued");
    expect(remake.approval_id).toBe(d.approvalId); // 作り直しの実行に差し戻した承認を結ぶ（K-62 の getActionRun が理由を返せるように）
    const job = await jobOf(remake.bridge_job_id!);
    expect(job["member_id"]).toBe(d.by.id); // 任せた人の AI が作り直す（D-128.176）
    expect(job["agent_session_id"]).toBe(d.agentSession); // 前の作る実行と同じ続き（K-63 が行に入れる）
    expect(String(job["prompt"])).toContain("月末の請求を出す"); // チケットの中身（K-62 の app.ticket_job_context の組み方）
    expect(String(job["prompt"])).toContain("差し戻されました。理由：宛名を「株式会社サンプル 経理部」にしてください");
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
    expect(await stageKeyOf(t.id)).toBe("running");
    expect((await messagesOf(t.id)).at(-1)!.body).toContain("高本が差し戻しました");
  });

  it("K63-API-007 承認待ち × 差し戻すで理由が空・空白だけ・全角空白だけ：422・E-VAL-020（欄 note）・何も書かない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const before = await snapshot(t);
    for (const note of ["", "   ", "　　", "\n\t"]) {
      const r = await giveBack(boss, d.approvalId, note);
      expect(r.status, JSON.stringify(note)).toBe(422);
      const j = await json(r);
      expect(details(j).map((x) => x.field)).toContain("note");
      expect(JSON.stringify(j)).toContain(VAL_REASON_EMPTY);
    }
    expect(await snapshot(t)).toEqual(before);
  });

  it("K63-API-008 承認待ち × 差し戻しの理由が 2001 文字：422・E-VAL-021。ちょうど 2000 文字は通る", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const r = await giveBack(boss, d.approvalId, "あ".repeat(2001));
    expect(r.status).toBe(422);
    expect(JSON.stringify(await json(r))).toContain(VAL_REASON_LONG);
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
    const ok = await giveBack(boss, d.approvalId, "い".repeat(2000));
    expect(ok.status).toBe(201);
  });

  it("K63-API-009 承認済み × PC が閉じている：答えの pc が asleep で実行待ち。開いて取りに来たら、任せた人の PC に実行の仕事（同じ続きの id・許可のモード auto）が渡る", async () => {
    const t = await ticket();
    const d = await delegated(t);
    await lastSeen(d.pc.sid, 120);
    const r = await approve(boss, d.approvalId);
    expect(r.status).toBe(201);
    const data = (await json(r)).data as Record<string, unknown>;
    expect(data).toMatchObject({
      id: d.approvalId,
      decision: "approve",
      status_id: "approved",
      ticket_id: t.id,
      pc: "asleep",
    });
    const run = (await runsOf(t.id, "execute"))[0]!;
    expect(data["run_id"]).toBe(run.id);
    // 任せた人の PC が開いて取りに来たら渡る
    await lastSeen(d.pc.sid, 1);
    const job = await take(d.pc);
    expect(job?.id).toBe(run.bridge_job_id);
    expect(job?.["agent_session_id"]).toBe(d.agentSession);
    expect(job?.["permission_mode"]).toBe("auto");
    const row = await jobOf(run.bridge_job_id!);
    expect(row).toMatchObject({ member_id: d.by.id, state_id: "running", permission_mode: "auto" });
  });

  it("K63-API-010 承認済み・実行待ち × 承認から 23 時間 59 分・24 時間 1 分 × PC が取りに来る：前は渡す。後は渡さず、新しい承認待ち（note）で聞き直す。前の承認は approve のまま", async () => {
    const tm = await team();
    const early = await ticket();
    const late = await ticket();
    const e = await approved(early, { by: tm });
    const l = await approved(late, { by: tm });
    await f.admin.query("update approvals set decided_at = now() - interval '23 hours 59 minutes' where id = $1", [
      e.approvalId,
    ]);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      l.approvalId,
    ]);
    // 動いている仕事の片付け（idle）はしない取り方で、渡る仕事を全部取る
    const got: string[] = [];
    for (let job = await take(tm.pc); job; job = await take(tm.pc)) got.push(job.id);
    expect(got).toEqual([e.execJobId]);
    expect(await jobOf(e.execJobId)).toMatchObject({ state_id: "running" });
    expect(await jobOf(l.execJobId)).toMatchObject({ state_id: "cancelled" });
    expect((await runsOf(late.id, "execute"))[0]!.status_id).toBe("cancelled");
    expect(await approvalRow(l.approvalId)).toMatchObject({ decision: "approve", status_id: "approved" });
    const again = await one<Record<string, unknown>>(
      "select note, approver_member_id, irreversible, action_run_id, subject_id from approvals where ticket_id = $1 and decision is null",
      [late.id],
    );
    expect(again).toMatchObject({
      note: NOTE_24H,
      approver_member_id: boss.id,
      irreversible: true,
      action_run_id: l.makeRunId,
      subject_id: l.approvalId,
    });
    expect(await stageKeyOf(late.id)).toBe("awaiting_approval");
    expect(await stageKeyOf(early.id)).toBe("running");
  });

  it("K63-API-056 承認済み・実行待ち（24 時間を過ぎた）× PC が来ないまま、チケット・承認待ちを読む：読んだときの片付けで聞き直しの行が出る", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    const r = await queue(boss);
    expect(r.status).toBe(200);
    const again = ((await json(r)).data as unknown as { ticket_id: string; note: string | null }[]).find(
      (x) => x.ticket_id === t.id,
    );
    expect(again?.note).toBe(NOTE_24H);
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "cancelled" });
    const g = await req("GET", `/tickets/${t.id}`, { headers: auth(boss) });
    expect(g.status).toBe(200);
    expect(((await json(g)).data as Record<string, unknown>)["approval"]).toMatchObject({ note: NOTE_24H });
  });

  it("K63-API-011 承認済み・実行待ち（24 時間を過ぎた）× 後始末を通らずに仕事を取る関数を直に呼ぶ：渡さない（守りの 2 層目）", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    // 直に呼んだ分は後に残さない（1 つのトランザクションで呼んで戻す）
    const cl = await f.pool.connect();
    try {
      await cl.query("begin");
      const r = await cl.query<{ job_id: string | null }>("select job_id from app.bridge_take_job($1)", [a.pc.sid]);
      expect(r.rows.map((x) => x.job_id)).not.toContain(a.execJobId);
    } finally {
      await cl.query("rollback");
      cl.release();
    }
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
  });

  it("K63-API-012 承認済み・実行中 × PC が中身のある結果で終わった：実行の記録は done・チケットは作業中・やり取りに 1 行。新しい成果物の版も承認待ちも作らない", async () => {
    const t = await ticket();
    const a = await approved(t);
    const artifactVersion = Number(
      (
        await one<{ v: number }>(
          "select version as v from ticket_sections where ticket_id = $1 and section_key = 'artifacts'",
          [t.id],
        )
      ).v,
    );
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    await finish(a.pc, a.execJobId, {
      state: "done",
      result: "送りました（宛先：先方の経理）",
      agent_session_id: a.agentSession,
    });
    expect((await runsOf(t.id, "execute"))[0]!.status_id).toBe("done");
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(await openApprovals(t.id)).toBe(0);
    expect(
      Number(
        (
          await one<{ v: number }>(
            "select version as v from ticket_sections where ticket_id = $1 and section_key = 'artifacts'",
            [t.id],
          )
        ).v,
      ),
    ).toBe(artifactVersion);
    const last = (await messagesOf(t.id)).at(-1)!;
    expect(last.kind).toBe("system");
    expect(last.body).toContain("実行しました");
    expect(last.body).toContain("送りました");
  });

  it("K63-API-013 承認済み・実行中 × PC が空の結果で終わった：完了と見なさず止まった（E-SIG-004・K-62 が足す自分の AI 向けの文）。チケットは作業中・理由を出す", async () => {
    const t = await ticket();
    const a = await approved(t);
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    await finish(a.pc, a.execJobId, { state: "done", result: "   ", agent_session_id: a.agentSession });
    const run = (await runsOf(t.id, "execute"))[0]!;
    expect(run.status_id).toBe("stopped");
    expect(run.error_summary).toContain("結果を返さずに終わりました");
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect((await messagesOf(t.id)).at(-1)!.body).toContain("結果を返さずに終わりました");
  });

  it("K63-API-014 承認済み・実行中 × PC が止まったと返す（道具の途中・使う量の枠）：自動で戻さない。止まった理由・チケットは作業中", async () => {
    const reasons = [
      "ここで止まりました。あなたが止めました。「メールを送る」は途中だったので、その結末は分かりません。先方の画面で確かめてください",
      "Claude Code の使える量の上限に当たったので止まりました。18:00 に戻ります",
    ];
    for (const reason of reasons) {
      const t = await ticket();
      const a = await approved(t);
      expect((await take(a.pc))?.id).toBe(a.execJobId);
      await finish(a.pc, a.execJobId, { state: "stopped", reason, agent_session_id: a.agentSession });
      const runs = await runsOf(t.id, "execute");
      expect(runs).toHaveLength(1); // 自動で積み直さない（D-090）
      expect(runs[0]!.status_id).toBe("stopped");
      expect(runs[0]!.error_summary).toBe(reason);
      expect(await stageKeyOf(t.id)).toBe("doing");
      expect((await messagesOf(t.id)).at(-1)!.body).toContain(reason.slice(0, 20));
      expect(await take(a.pc)).toBeNull();
    }
  });

  it("K63-API-015 承認済み・実行中（PC が落ちた）× PC がつながり直して取りに来る：残った実行を止め、二度送らない。チケットは作業中", async () => {
    const t = await ticket();
    const a = await approved(t);
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    // PC が落ちて結末を送らないまま、つながり直して「何も動かしていない」と取りに来る
    expect(await take(a.pc, { idle: true })).toBeNull();
    expect((await jobOf(a.execJobId))["state_id"]).toBe("stopped");
    const runs = await runsOf(t.id, "execute");
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status_id).toBe("stopped");
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(await take(a.pc)).toBeNull();
  });

  it("K63-API-016 承認済み（決まった）× 承認するをもう一度：409・E-CONF-003。仕事は 1 つ", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await approve(boss, d.approvalId)).status).toBe(201);
    const r = await approve(boss, d.approvalId);
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(CONF_DONE);
    expect(await runsOf(t.id, "execute")).toHaveLength(1);
  });

  it("K63-API-017 承認待ち × 2 つのタブで同時に承認・承認と差し戻しを同時に：先の 1 つだけ通り、後は 409・E-CONF-003。実行の仕事は 1 つ", async () => {
    const t1 = await ticket();
    const d1 = await delegated(t1);
    const both = await Promise.all([
      approve(boss, d1.approvalId, { key: "tab-a" }),
      approve(boss, d1.approvalId, { key: "tab-b" }),
    ]);
    expect(both.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await runsOf(t1.id, "execute")).toHaveLength(1);
    const t2 = await ticket();
    const d2 = await delegated(t2);
    const mixed = await Promise.all([approve(boss, d2.approvalId), giveBack(boss, d2.approvalId, "直してください")]);
    expect(mixed.map((r) => r.status).sort()).toEqual([201, 409]);
    const loser = mixed.find((r) => r.status === 409)!;
    expect((await json(loser))["code"]).toBe(CONF_DONE);
    const decided = await approvalRow(d2.approvalId);
    const execs = await runsOf(t2.id, "execute");
    const remakes = (await runsOf(t2.id, "make")).filter((x) => x.id !== d2.makeRunId);
    expect(execs.length + remakes.length).toBe(1);
    expect(decided["decision"] === "approve" ? execs.length : remakes.length).toBe(1);
  });

  it("K63-API-018 差し戻し済み × 承認する：409・変えない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await giveBack(boss, d.approvalId, "直してください")).status).toBe(201);
    const r = await approve(boss, d.approvalId);
    expect(r.status).toBe(409);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: "return", status_id: "returned" });
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
  });

  it("K63-API-019 差し戻し済み・作り直しが届いた × 承認待ちの画面：新しい承認待ちの行として並ぶ（前の行は差し戻しのまま）", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "差し戻した人", ticketAbility: "edit" });
    const t = await ticket({ assignee: who });
    const d = await delegated(t);
    expect((await giveBack(who, d.approvalId, "直してください")).status).toBe(201);
    const second = await delegated(t);
    const rows = (await json(await queue(who))).data as unknown as { id: string }[];
    expect(rows.map((x) => x.id)).toEqual([second.approvalId]);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: "return" });
  });

  it("K63-API-020 取り下げ済み（withdrawn_at あり）× 承認する・差し戻す：409・変えない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    await f.admin.query("update approvals set withdrawn_at = now() where id = $1", [d.approvalId]);
    for (const r of [await approve(boss, d.approvalId), await giveBack(boss, d.approvalId, "直して")]) {
      expect(r.status).toBe(409);
      expect((await json(r))["code"]).toBe(CONF_DONE);
    }
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
  });

  it("K63-API-021 承認待ち × 一覧・承認・差し戻し・1 件 × 承認する人でない（書ける人・作った人・マネージャー）：一覧に出ない。1 件は読めるが can_decide false。口は 403・何も書かない", async () => {
    const t = await ticket({ creator: writer });
    const d = await delegated(t);
    const before = await snapshot(t);
    // 作った人（writer）・AI に任せた人（requested_by＝d.by）・マネージャーは 1 件を読める（M2・行の決まりと RLS をそろえる）
    for (const p of [writer, d.by, manager]) {
      const ids = ((await json(await queue(p))).data as unknown as { id: string }[]).map((x) => x.id);
      expect(ids).not.toContain(d.approvalId);
      const g = await detail(p, d.approvalId);
      expect(g.status, `${p.id} の 1 件`).toBe(200);
      expect(((await json(g)).data as Record<string, unknown>)["can_decide"]).toBe(false);
      const a = await approve(p, d.approvalId);
      expect(a.status).toBe(403);
      const b = await giveBack(p, d.approvalId, "直して");
      expect(b.status).toBe(403);
    }
    // 見るだけの人は、承認する人・担当者・作った人・任せた人・マネージャーのどれでもないので 1 件も読めない
    expect((await detail(viewer, d.approvalId)).status).toBe(403);
    expect(await snapshot(t)).toEqual(before);
  });

  it("K63-API-022 承認待ち × 押す直前に担当が替わった（承認する人は今の担当者から引く）・閲覧のみになった × 開いていた画面のまま：口で止まる（403）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    // 担当を替える口（updateTicket・F4）はまだ無いので、チケットの担当の列だけを替える（承認の行は替えない）
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, writer.id]);
    expect((await approve(boss, d.approvalId)).status).toBe(403);
    expect((await giveBack(boss, d.approvalId, "直して")).status).toBe(403);
    // 書けない承認する人は、関数が「書ける」（app.ticket_writable）を見て止める（M1）。担当者は 0072 の決まりで常に書けるので、
    //   書けなくなる形（本人のものでない取り込みの下書きに入ったチケット）を置き、関数を直に呼んで確かめる
    const t2 = await ticket();
    const d2 = await delegated(t2);
    const imp = await one<{ id: string }>(
      "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
      [T.tenantId, writer.id, T.rootScope],
    );
    await f.admin.query("update tickets set draft_import_id = $2 where id = $1", [t2.id, imp.id]);
    const ctx: TenantContext = { tenantId: T.tenantId, userId: boss.id, role: "member", stepUpAt: null };
    const out = await withTenant(f.pool, ctx, (cl) =>
      cl.query<{ v: { error?: string } }>("select app.approval_decide($1, 'approve', null) as v", [d2.approvalId]),
    );
    expect(out.rows[0]!.v.error).toBe("not_writable");
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
    expect(await runsOf(t2.id, "execute")).toHaveLength(0);
  });
  it("K63-API-023 承認待ち × 押す直前にメンバーから外された・止められた：関数が今のメンバーかを見て 403・何も書かない", async () => {
    for (const col of ["deleted_at", "suspended_at"]) {
      const who = await f.person(T.tenantId, T.rootScope, { name: `外される人 ${col}`, ticketAbility: "edit" });
      const t = await ticket({ assignee: who });
      const d = await delegated(t);
      // 止めるときは止めた人も入れる（members_suspended_ck：suspended_at と suspended_by は揃って入る）
      await f.admin.query(
        col === "suspended_at"
          ? "update members set suspended_at = now(), suspended_by = $2 where id = $1"
          : "update members set deleted_at = now() where id = $1",
        col === "suspended_at" ? [who.id, boss.id] : [who.id],
      );
      const r = await approve(who, d.approvalId);
      expect(r.status, col).toBe(403);
      expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
      expect(await runsOf(t.id, "execute")).toHaveLength(0);
    }
  });

  it("K63-API-024 承認待ち（チケットが消された）× 古いリンク・一覧から押す：404・E-PAGE-001。承認も仕事も作らない。一覧からも消える", async () => {
    const t = await ticket();
    const d = await delegated(t);
    await f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [t.id, boss.id]);
    for (const r of [
      await approve(boss, d.approvalId),
      await giveBack(boss, d.approvalId, "直して"),
      await detail(boss, d.approvalId),
    ]) {
      expect(r.status).toBe(404);
      const code = String((await json(r))["code"]);
      expect([GONE, "NOT_FOUND"]).toContain(code);
    }
    expect(((await json(await queue(boss))).data as unknown as { id: string }[]).map((x) => x.id)).not.toContain(
      d.approvalId,
    );
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
  });

  it("K63-API-025 どれでも × 直に API で別のワークスペースの承認・チケットの ID：404・中身を返さない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    for (const r of [
      await detail(outsider, d.approvalId),
      await approve(outsider, d.approvalId),
      await giveBack(outsider, d.approvalId, "直して"),
      await complete(outsider, t.id, await completeBody(t)),
    ]) {
      expect(r.status).toBe(404);
      expect(await r.text()).not.toContain(ARTIFACT.slice(0, 8));
    }
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
  });

  it("K63-API-026 どれでも × 直に API × ログインしていない・セッションが切れた：401（5 本とも）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const calls: [string, string, unknown][] = [
      ["GET", "/approvals/queue", undefined],
      ["GET", `/approvals/${d.approvalId}`, undefined],
      ["POST", `/approvals/${d.approvalId}/approve`, {}],
      ["POST", `/approvals/${d.approvalId}/return`, { note: "直して" }],
      ["POST", `/tickets/${t.id}/complete`, await completeBody(t)],
    ];
    for (const [m, p, b] of calls) {
      for (const headers of [{}, { authorization: "Bearer expired-token" }]) {
        const r = await req(m, p, { body: b, headers });
        expect(r.status, `${m} ${p}`).toBe(401);
      }
    }
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
  });

  it("K63-API-036 承認待ち × 担当が替わって承認する人になった直後（入り直さない）：承認待ちに出て、そのまま押せる。承認の行の approver は今の担当者になる", async () => {
    const t = await ticket();
    const d = await delegated(t);
    // 担当を替える口（updateTicket・F4）はまだ無いので、チケットの担当の列だけを替える（承認の行は替えない）
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, writer.id]);
    const ids = ((await json(await queue(writer))).data as unknown as { id: string }[]).map((x) => x.id);
    expect(ids).toContain(d.approvalId);
    expect(((await json(await queue(boss))).data as unknown as { id: string }[]).map((x) => x.id)).not.toContain(
      d.approvalId,
    );
    expect((await approve(writer, d.approvalId)).status).toBe(201);
    expect(
      (await one<{ a: string }>("select approver_member_id as a from approvals where id = $1", [d.approvalId])).a,
    ).toBe(writer.id);
  });
  it("K63-API-037 承認済み・実行待ち × チケットが消された後に PC が取りに来る：渡さない。仕事と実行の記録は止まった「チケットが消されたので止めました」", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [t.id, boss.id]);
    const got = await take(a.pc);
    expect(got?.id).not.toBe(a.execJobId);
    const job = await jobOf(a.execJobId);
    expect(["stopped", "cancelled"]).toContain(job["state_id"]);
    expect(String(job["stopped_reason"])).toContain(STOP_GONE);
    expect(["stopped", "cancelled"]).toContain((await runsOf(t.id, "execute"))[0]!.status_id);
  });
});

describe("K-63 承認して完了する：完了（口・本物の DB）", () => {
  it("K63-API-027 作業中（実行が終わった）× 完了にする × 担当者：完了の段・completed_at と completed_by・todo は全部 [x] の新しい版・やり取りに 1 行・受け箱に知らせ（作った人へ）・候補はまだ", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    const v = await todoVersion(t.id);
    const r = await complete(boss, t.id, await completeBody(t));
    expect(r.status, await r.clone().text()).toBe(201);
    const data = (await json(r)).data as Record<string, unknown>;
    expect(data["knowledge_candidates"]).toEqual([]);
    expect(data["skipped_reason"]).toBe(SKIPPED);
    expect(data["ticket"]).toMatchObject({ id: t.id, number: t.number, stage_key: "done", completed_by: boss.id });
    expect(await stageKeyOf(t.id)).toBe("done");
    const row = await one<{ completed_at: string | null; completed_by: string | null }>(
      "select completed_at, completed_by from tickets where id = $1",
      [t.id],
    );
    expect(row.completed_at).not.toBeNull();
    expect(row.completed_by).toBe(boss.id);
    const todo = await one<{ version: number; text: string }>(
      "select version, body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'todo'",
      [t.id],
    );
    expect(todo.version).toBe(v + 1);
    expect(todo.text).toBe("- [x] 請求書を作る\n- [x] 先方に送る");
    expect(
      await num(
        "select count(*) as n from ticket_section_versions v join ticket_sections s on s.id = v.section_id where s.ticket_id = $1 and s.section_key = 'todo'",
        [t.id],
      ),
    ).toBe(2);
    expect((await messagesOf(t.id)).at(-1)!.body).toContain("高本が完了にしました");
    const n = await f.admin.query<{ member_id: string; channel_id: string; sent_at: string | null }>(
      "select member_id, channel_id, sent_at from notifications where event_kind_id = 'ticket.completed' and dedupe_key like $1",
      [`%ticket.completed:${t.id}`],
    );
    expect(n.rows.map((x) => x.member_id)).toEqual([writer.id]); // 作った人へ。押した本人（担当者）には出さない
    expect(n.rows[0]!.channel_id).toBe("inapp");
    expect(n.rows[0]!.sent_at).not.toBeNull();
    expect(
      await num("select count(*) as n from audit_events where action = 'ticket.complete' and target_id = $1", [t.id]),
    ).toBe(1);
  });

  it("K63-API-028 作業中・チェックが残っている × 完了にする：422・E-VAL-022・残っている項目を出す。範囲の外の番号も残りとして扱う", async () => {
    const t = await ticket();
    await executed(t);
    for (const checked of [[0], [], [0, 5]]) {
      const r = await complete(boss, t.id, await completeBody(t, { todo_checked: checked }));
      expect(r.status, JSON.stringify(checked)).toBe(422);
      const j = await json(r);
      expect(JSON.stringify(j)).toContain(VAL_TODO_LEFT);
      expect(
        details(j)
          .filter((x) => x.field === "todo_checked")
          .map((x) => x.message),
      ).toContain("先方に送る");
    }
    expect(await stageKeyOf(t.id)).toBe("doing");
    // もう [x] になっている項目は送らなくても済み
    await f.admin.query(
      "update ticket_sections set body = jsonb_build_object('text', '- [x] 請求書を作る' || chr(10) || '- [x] 先方に送る'), version = version + 1 where ticket_id = $1 and section_key = 'todo'",
      [t.id],
    );
    const ok = await complete(boss, t.id, await completeBody(t, { todo_checked: [] }));
    expect(ok.status).toBe(201);
  });

  it("K63-API-029 作業中・完了の条件を確かめていない × 完了にする：422・E-VAL-023（欄 conditions_confirmed）", async () => {
    const t = await ticket();
    await executed(t);
    for (const c of [false, undefined]) {
      const b = await completeBody(t, { conditions_confirmed: c });
      if (c === undefined) delete (b as Record<string, unknown>)["conditions_confirmed"];
      const r = await complete(boss, t.id, b);
      expect(r.status).toBe(422);
      const j = await json(r);
      expect(details(j).map((x) => x.field)).toContain("conditions_confirmed");
    }
    const r = await complete(boss, t.id, await completeBody(t, { conditions_confirmed: false }));
    expect(JSON.stringify(await json(r))).toContain(VAL_NOT_CONFIRMED);
    expect(await stageKeyOf(t.id)).toBe("doing");
  });

  it("K63-API-030 作業中・終わっていない子がある × 完了にする：422・E-VAL-024・子の番号と題名。子が完了すれば親も完了にできる", async () => {
    const parent = await ticket();
    const child = await ticket({ parent: parent.id, title: "宛名を確かめる", stage: "doing", todo: null });
    const doneChild = await ticket({ parent: parent.id, title: "もう終わった子", stage: "done", todo: null });
    const goneChild = await ticket({ parent: parent.id, title: "消した子", stage: "doing", todo: null });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [goneChild.id]);
    const r = await complete(boss, parent.id, await completeBody(parent));
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(JSON.stringify(j)).toContain(VAL_CHILDREN);
    const kids = details(j)
      .filter((x) => x.field === "children")
      .map((x) => x.message);
    expect(kids).toEqual([`${child.number} 宛名を確かめる`]);
    expect(JSON.stringify(kids)).not.toContain(doneChild.number);
    expect(await stageKeyOf(parent.id)).toBe("doing");
    const c = await complete(boss, child.id, { todo_checked: [], todo_version: 0, conditions_confirmed: true });
    expect(c.status, await c.clone().text()).toBe(201);
    expect((await complete(boss, parent.id, await completeBody(parent))).status).toBe(201);
  });

  it("K63-API-031 承認待ち・実行中・確認中・走っている実行がある × 完了にする：409・E-CONF-016・何も変えない", async () => {
    for (const stage of ["awaiting_approval", "running", "checking"]) {
      const t = await ticket({ stage });
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status, stage).toBe(409);
      expect((await json(r))["code"]).toBe(CONF_STAGE);
      expect(await stageKeyOf(t.id)).toBe(stage);
    }
    // 段は作業中でも、実行の記録が待っている（queued）なら完了にできない
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update tickets set stage_id = $2 where id = $1", [t.id, await stageOf(T.tenantId, "doing")]);
    const r = await complete(boss, t.id, await completeBody(t));
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(CONF_STAGE);
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
  });

  it("K63-API-032 完了 × 完了にするをもう一度：同じ冪等キーなら最初の結果。別のキーなら 409・E-CONF-018。知らせは 1 つ", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    const b = await completeBody(t);
    const r1 = await complete(boss, t.id, b, { key: "complete-1" });
    expect(r1.status).toBe(201);
    const r2 = await complete(boss, t.id, b, { key: "complete-1" });
    expect(r2.status).toBe(201);
    expect(await r2.json()).toEqual(await r1.json());
    const r3 = await complete(boss, t.id, await completeBody(t), { key: "complete-2" });
    expect(r3.status).toBe(409);
    expect((await json(r3))["code"]).toBe(CONF_ALREADY);
    expect(
      await num(
        "select count(*) as n from notifications where event_kind_id = 'ticket.completed' and dedupe_key like $1",
        [`%ticket.completed:${t.id}`],
      ),
    ).toBe(1);
  });

  it("K63-API-033 作業中 × 完了にする × 担当者でないが直せる（書ける人・マネージャー）：完了できる。completed_by に押した人・知らせは担当者へ", async () => {
    for (const who of [writer, manager]) {
      const t = await ticket({ creator: (await team("作った人")).by });
      await executed(t);
      const r = await complete(who, t.id, await completeBody(t));
      expect(r.status, await r.clone().text()).toBe(201);
      expect((await one<{ by: string }>("select completed_by as by from tickets where id = $1", [t.id])).by).toBe(
        who.id,
      );
      const to = (
        await f.admin.query<{ member_id: string }>(
          "select member_id from notifications where event_kind_id = 'ticket.completed' and dedupe_key like $1 order by member_id",
          [`%ticket.completed:${t.id}`],
        )
      ).rows.map((x) => x.member_id);
      expect(to).toContain(boss.id);
      expect(to).not.toContain(who.id);
    }
  });

  it("K63-API-034 作業中 × 完了にする × 見るだけの権限：403・何も変えない", async () => {
    const t = await ticket();
    await executed(t);
    const before = await snapshot(t);
    const r = await complete(viewer, t.id, await completeBody(t));
    expect(r.status).toBe(403);
    expect(await snapshot(t)).toEqual(before);
  });

  it("K63-API-035 作業中・開いた後に実施事項が書き換わった × 完了にする：409・E-CONF-017。読み直せば通る", async () => {
    const t = await ticket();
    await executed(t);
    const old = await completeBody(t);
    await f.admin.query(
      "update ticket_sections set body = jsonb_build_object('text', '- 請求書を作る' || chr(10) || '- 先方に電話する' || chr(10) || '- 先方に送る'), version = version + 1 where ticket_id = $1 and section_key = 'todo'",
      [t.id],
    );
    const r = await complete(boss, t.id, old);
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(CONF_TODO_CHANGED);
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect((await complete(boss, t.id, await completeBody(t, { todo_checked: [0, 1, 2] }))).status).toBe(201);
  });
});

describe("K-63 承認して完了する：入力・失敗・守り（口・本物の DB）", () => {
  it("K63-API-038 入力 × id が uuid でない（1 件・承認・差し戻し・完了）：422・欄 id", async () => {
    for (const [m, p, b] of [
      ["GET", "/approvals/not-a-uuid", undefined],
      ["POST", "/approvals/not-a-uuid/approve", {}],
      ["POST", "/approvals/not-a-uuid/return", { note: "直して" }],
      ["POST", "/tickets/not-a-uuid/complete", { todo_checked: [], todo_version: 0, conditions_confirmed: true }],
    ] as const) {
      const r = await req(m, p, { body: b, headers: auth(boss, { su: Date.now() }) });
      expect(r.status, p).toBe(422);
      expect(details(await json(r)).map((x) => x.field)).toContain("id");
    }
  });

  it("K63-API-039 入力 × 体に知らない欄・形が違う：422（契約の strict な形）・何も書かない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const before = await snapshot(t);
    for (const body of [{ note: "x" }, { status_id: "approved" }, "{not json"]) {
      expect((await approve(boss, d.approvalId, { body })).status, JSON.stringify(body)).toBe(422);
    }
    for (const body of [{ note: "直して", reason: "x" }, { note: 12345 }]) {
      expect((await req("POST", `/approvals/${d.approvalId}/return`, { body, headers: auth(boss) })).status).toBe(422);
    }
    const u = await ticket();
    await executed(u);
    const good = await completeBody(u);
    for (const body of [
      { ...good, stage_id: "x" },
      { ...good, todo_checked: ["a"] },
      { ...good, todo_checked: "0,1" },
      { ...good, todo_version: "1" },
      { ...good, conditions_confirmed: "yes" },
    ]) {
      expect((await complete(boss, u.id, body)).status, JSON.stringify(body)).toBe(422);
    }
    expect(await snapshot(t)).toEqual(before);
    expect(await stageKeyOf(u.id)).toBe("doing");
  });

  it("K63-API-040 入力 × 一覧の limit・cursor・sort が形違い：422", async () => {
    for (const q of [
      "?limit=0",
      "?limit=201",
      "?limit=abc",
      "?cursor=-1",
      "?cursor=x",
      "?sort=drop%20table",
      "?sort=nope",
    ]) {
      expect((await queue(boss, q)).status, q).toBe(422);
    }
    expect((await queue(boss, "?limit=1")).status).toBe(200);
  });

  it("K63-API-041 入力 × 差し戻しの理由に HTML・制御文字：文としてそのまま残し、作り直しの仕事にも文として渡す", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const note = "<script>alert(1)</script> 宛名を直して";
    expect((await giveBack(boss, d.approvalId, note)).status).toBe(201);
    expect((await approvalRow(d.approvalId))["return_reason"]).toBe(note);
    const remake = (await runsOf(t.id, "make")).at(-1)!;
    expect(String((await jobOf(remake.bridge_job_id!))["prompt"])).toContain(note);
  });

  it("K63-API-042 失敗 × 承認の途中で DB が落ちた（実行の記録を書く所）：500。承認・仕事・段・証跡は 1 つも残らない。戻ればもう一度押せる", async () => {
    const t = await ticket({ title: "K63 壊れる 承認" });
    const d = await delegated(t, { irreversible: false });
    const before = await snapshot(t);
    await f.admin.query(`create or replace function app.k63_boom() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from tickets x where x.id = new.ticket_id and x.title like 'K63 壊れる%') then
          raise exception 'K63 の試験で壊した';
        end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k63_boom before insert on action_runs for each row execute function app.k63_boom()",
    );
    try {
      const r = await approve(boss, d.approvalId);
      expect(r.status).toBe(500);
      expect(await snapshot(t)).toEqual(before);
      expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
    } finally {
      await f.admin.query("drop trigger if exists k63_boom on action_runs");
      await f.admin.query("drop function if exists app.k63_boom()");
    }
    expect((await approve(boss, d.approvalId)).status).toBe(201);
  });

  it("K63-API-043 失敗 × 完了の途中で DB が落ちた（区画の版を書く所）：500。段は変わらず、知らせも出ない", async () => {
    const t = await ticket({ title: "K63 壊れる 完了", creator: writer });
    await executed(t);
    await f.admin.query(`create or replace function app.k63_boom2() returns trigger language plpgsql as $$
      begin
        if exists (select 1 from tickets x where x.id = new.ticket_id and x.title like 'K63 壊れる%') then
          raise exception 'K63 の試験で壊した';
        end if;
        return new;
      end $$`);
    await f.admin.query(
      "create trigger k63_boom2 before insert on ticket_section_versions for each row execute function app.k63_boom2()",
    );
    try {
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status).toBe(500);
      expect(await stageKeyOf(t.id)).toBe("doing");
      expect(
        (await one<{ c: string | null }>("select completed_at as c from tickets where id = $1", [t.id])).c,
      ).toBeNull();
      expect(
        await num("select count(*) as n from notifications where dedupe_key like $1", [`%ticket.completed:${t.id}`]),
      ).toBe(0);
    } finally {
      await f.admin.query("drop trigger if exists k63_boom2 on ticket_section_versions");
      await f.admin.query("drop function if exists app.k63_boom2()");
    }
  });

  it("K63-API-044 失敗 × 完了の知らせが送れない（受け箱に書けない）：完了は残す。notifications に failed_at・retry_count（sent_at は空）", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    const broken: Transport = {
      send: async () => {
        throw new Error("受け箱に書けない");
      },
    };
    const keep = hooks["completeTicket"];
    Object.assign(hooks, { completeTicket: approveHooks(f.pool, { inbox: broken })["completeTicket"] });
    try {
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status, await r.clone().text()).toBe(201);
    } finally {
      hooks["completeTicket"] = keep!;
    }
    expect(await stageKeyOf(t.id)).toBe("done");
    const n = await one<{ sent_at: string | null; failed_at: string | null; retry_count: number | null }>(
      "select sent_at, failed_at, retry_count from notifications where event_kind_id = 'ticket.completed' and dedupe_key like $1",
      [`%ticket.completed:${t.id}`],
    );
    expect(n.sent_at).toBeNull();
    expect(n.failed_at).not.toBeNull();
    expect(Number(n.retry_count)).toBeGreaterThanOrEqual(1);
  });

  it("K63-API-045 守り × 承認・差し戻し・完了を 1 分に 61 回：429・待つ秒数（retry_after_sec）・何も書かない", async () => {
    for (const op of ["approveApproval", "returnApproval", "completeTicket"] as const) {
      const who = await f.person(T.tenantId, T.rootScope, { name: `上限 ${op}`, ticketAbility: "edit" });
      const t = await ticket({ assignee: who });
      const d = await delegated(t, { irreversible: false });
      const call = () =>
        op === "approveApproval"
          ? approve(who, d.approvalId)
          : op === "returnApproval"
            ? giveBack(who, d.approvalId, "")
            : complete(who, t.id, { todo_checked: [], todo_version: 0, conditions_confirmed: true });
      limits[op] = 60;
      try {
        for (let i = 0; i < 60; i++) await call();
        const before = await snapshot(t);
        const r = await call();
        expect(r.status, op).toBe(429);
        const j = await json(r);
        expect(j["code"]).toBe("RATE_LIMITED");
        expect(Number(j["retry_after_sec"])).toBeGreaterThan(0);
        expect(await snapshot(t)).toEqual(before);
      } finally {
        limits[op] = 10_000;
      }
    }
  });

  it("K63-API-046 守り × 一覧・1 件を 1 分に 121 回：429・待つ秒数", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "上限 読む", ticketAbility: "edit" });
    const t = await ticket({ assignee: who });
    const d = await delegated(t);
    for (const [op, call] of [
      ["listApprovalQueue", () => queue(who)],
      ["getApproval", () => detail(who, d.approvalId)],
    ] as const) {
      limits[op] = 120;
      try {
        for (let i = 0; i < 120; i++) expect((await call()).status).toBe(200);
        const r = await call();
        expect(r.status, op).toBe(429);
        expect(Number((await json(r))["retry_after_sec"])).toBeGreaterThan(0);
      } finally {
        limits[op] = 10_000;
      }
    }
  });

  it("K63-API-047 守り × 知らせの本文：成果物の中身・メールを入れない。チケットの id・番号・リンクだけ", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    expect((await complete(boss, t.id, await completeBody(t))).status).toBe(201);
    const n = await one<{ payload: Record<string, unknown> }>(
      "select payload from notifications where event_kind_id = 'ticket.completed' and dedupe_key like $1",
      [`%ticket.completed:${t.id}`],
    );
    expect(Object.keys(n.payload).sort()).toEqual(["number", "ticket_id", "url"]);
    expect(n.payload).toEqual({ ticket_id: t.id, number: t.number, url: `/tickets/${t.id}` });
    expect(JSON.stringify(n.payload)).not.toContain("請求書をお送り");
    expect(JSON.stringify(n.payload)).not.toMatch(/@/);
  });

  it("K63-API-048 守り × 証跡：承認・差し戻し・完了の誰が・いつ・何を が audit_events に残る（関門 C2）。中身（成果物・理由の全文）は入れない", async () => {
    const t1 = await ticket();
    const d1 = await delegated(t1);
    expect((await approve(boss, d1.approvalId)).status).toBe(201);
    const t2 = await ticket();
    const d2 = await delegated(t2);
    const secret = "先方の担当者の電話番号 03-0000-0000 を入れてください";
    expect((await giveBack(boss, d2.approvalId, secret)).status).toBe(201);
    const t3 = await ticket();
    await executed(t3);
    expect((await complete(boss, t3.id, await completeBody(t3))).status).toBe(201);
    const rows = await f.admin.query<{
      action: string;
      actor_member_id: string;
      choke_point_id: string;
      payload: unknown;
    }>(
      "select action, actor_member_id, choke_point_id, payload from audit_events where target_id = any($1) and action in ('approval.approve', 'approval.return', 'ticket.complete')",
      [[d1.approvalId, d2.approvalId, t3.id]],
    );
    expect(rows.rows.map((x) => x.action).sort()).toEqual(["approval.approve", "approval.return", "ticket.complete"]);
    for (const x of rows.rows) {
      expect(x.actor_member_id).toBe(boss.id);
      expect(x.choke_point_id).toBe("C2");
      expect(JSON.stringify(x.payload)).not.toContain("03-0000-0000");
      expect(JSON.stringify(x.payload)).not.toContain("請求書をお送り");
    }
  });

  it("K63-API-049 守り × 承認・差し戻しの答えの形：id・decision・decided_at・status_id・ticket_id・run_id・pc（live／asleep）だけ", async () => {
    for (const kind of ["approve", "return"] as const) {
      const t = await ticket();
      const d = await delegated(t);
      const r = kind === "approve" ? await approve(boss, d.approvalId) : await giveBack(boss, d.approvalId, "直して");
      expect(r.status).toBe(201);
      const data = (await json(r)).data as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual([
        "decided_at",
        "decision",
        "id",
        "pc",
        "run_id",
        "status_id",
        "ticket_id",
      ]);
      expect(["live", "asleep"]).toContain(data["pc"]);
      expect(String(data["run_id"])).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("K63-API-050 守り × 1 件の中身：成果物の版・検査なしの印・取り消せないの注意・決められるか（承認する人は true）", async () => {
    const t = await ticket();
    const d = await delegated(t, { irreversible: true });
    const r = await detail(boss, d.approvalId);
    expect(r.status).toBe(200);
    const data = (await json(r)).data as Record<string, unknown>;
    expect(data["can_decide"]).toBe(true);
    expect(data["irreversible"]).toBe(true);
    expect(data["check_summary"]).toBe(CHECK_NONE);
    expect(data["checks"]).toEqual([]);
    expect(JSON.stringify(data["cautions"])).toContain("取り消せません");
    expect(data["artifact_version"]).toMatchObject({ text: ARTIFACT });
    expect(data["ticket"]).toMatchObject({ id: t.id, number: t.number, stage_key: "awaiting_approval" });
    expect(data["approval"]).toMatchObject({
      id: d.approvalId,
      decision: null,
      approver_member_id: boss.id,
      approver_name: "高本",
    });
  });

  it("K63-API-051 守り × 承認の関数を直に呼ぶ × 承認する人でない人の member：書かない（守りの 2 層目）", async () => {
    const t = await ticket();
    const d = await delegated(t, { irreversible: false });
    const ctx: TenantContext = { tenantId: T.tenantId, userId: writer.id, role: "member", stepUpAt: new Date() };
    for (const [dec, reason] of [
      ["approve", null],
      ["return", "直して"],
    ] as const) {
      // 関数は p_member を受けず、呼んだ人（app.user_id()）で判定する
      const out = await withTenant(f.pool, ctx, (cl) =>
        cl.query<{ v: { error?: string } }>("select app.approval_decide($1, $2, $3) as v", [d.approvalId, dec, reason]),
      );
      expect(out.rows[0]!.v.error).toBe("not_approver");
    }
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
  });

  it("K63-API-052 守り × 完了の関数を直に呼ぶ × 見るだけの人：書かない（守りの 2 層目）", async () => {
    const t = await ticket();
    await executed(t);
    const v = await todoVersion(t.id);
    const ctx: TenantContext = { tenantId: T.tenantId, userId: viewer.id, role: "member", stepUpAt: null };
    const out = await withTenant(f.pool, ctx, (cl) =>
      cl.query<{ v: { error?: string } }>("select app.ticket_complete($1, $2, $3, true) as v", [t.id, [0, 1], v]),
    );
    expect(out.rows[0]!.v.error).toBe("not_writable");
    expect(await stageKeyOf(t.id)).toBe("doing");
  });

  it("K63-API-053 守り × 承認待ちの一覧と数：他の人・他の会社・消されたチケットの承認待ちが、一覧にも数にも混ざらない", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "数を見る人", ticketAbility: "edit" });
    const mine = await ticket({ assignee: who });
    const a = await delegated(mine);
    const others = await ticket();
    await delegated(others); // 高本の分
    const gone = await ticket({ assignee: who });
    await delegated(gone);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    const decided = await ticket({ assignee: who });
    const dd = await delegated(decided, { irreversible: false });
    expect((await approve(who, dd.approvalId)).status).toBe(201);
    const otherCo = await f.person(O.tenantId, O.rootScope, { name: "別の会社の承認する人", ticketAbility: "edit" });
    const ot = await ticket({ tenant: O.tenantId, scope: O.rootScope, assignee: otherCo, creator: otherCo });
    // 任せた人は人ではなく「人と PC」の形（team）で渡す
    await delegated(ot, { by: await team("別の会社の任せた人", O) });
    const j = await json(await queue(who));
    expect((j.data as unknown as { id: string }[]).map((x) => x.id)).toEqual([a.approvalId]);
    expect((j.meta!["counts"] as { total: number }).total).toBe(1);
  });
});

describe("K-63 承認して完了する：積む仕事の中身（口・本物の DB）", () => {
  it("K63-API-054 承認する × 実行の仕事を積む：行の prompt にチケットの中身と後ろに足し書き、agent_session_id は前の作る実行と同じ。完了の後の作る実行だけを見る（D-128.176・D-125.155）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    await lastSeen(d.pc.sid, 120);
    expect((await approve(boss, d.approvalId)).status).toBe(201);
    const run = (await runsOf(t.id, "execute"))[0]!;
    const row = await jobOf(run.bridge_job_id!);
    const prompt = String(row["prompt"]);
    for (const part of ["月末の請求を出す", "先方が請求書を受け取った", "請求書を作る"]) expect(prompt).toContain(part);
    expect(prompt.indexOf("承認された成果物を実行してください")).toBeGreaterThan(prompt.indexOf("月末の請求を出す"));
    expect(row["agent_session_id"]).toBe(d.agentSession);
    // PC が取ったとき、行の中身がそのまま渡る（K-62 の take は変えない）
    await lastSeen(d.pc.sid, 1);
    const job = await take(d.pc);
    expect(job?.id).toBe(run.bridge_job_id);
    expect(job?.["prompt"]).toBe(prompt);
    expect(job?.["agent_session_id"]).toBe(d.agentSession);
    // 完了の前の作る実行の続きは使わない：完了の後にもう一度作った実行の続きを使う
    const u = await ticket();
    const before = await delegated(u, { by: d });
    await f.admin.query("update approvals set withdrawn_at = now() where id = $1", [before.approvalId]);
    await f.admin.query("update tickets set completed_at = now(), completed_by = $2 where id = $1", [u.id, boss.id]);
    const after = await delegated(u, { by: d });
    expect((await approve(boss, after.approvalId)).status).toBe(201);
    const run2 = (await runsOf(u.id, "execute")).at(-1)!;
    expect((await jobOf(run2.bridge_job_id!))["agent_session_id"]).toBe(after.agentSession);
    expect((await jobOf(run2.bridge_job_id!))["agent_session_id"]).not.toBe(before.agentSession);
  });

  it("K63-API-055 完了した後に任せ直す：続きの id は空（完了の前の作る実行の続きを使わない・D-125.155。0092 が app.ticket_job_context に絞りを足す。任せ直しも同じ関数を通る）", async () => {
    const t = await ticket({ creator: writer });
    const a = await executed(t);
    expect((await complete(boss, t.id, await completeBody(t))).status).toBe(201);
    // 開き直す口（後の F5／F7）はまだ無いので、段だけを作業中に戻す（completed_at は残す）
    await f.admin.query("update tickets set stage_id = $2 where id = $1", [t.id, await stageOf(T.tenantId, "doing")]);
    const r = await req("POST", `/tickets/${t.id}/delegate`, { body: {}, headers: auth(a.by) });
    expect(r.status, await r.clone().text()).toBe(201);
    const runId = String(((await json(r)).data as Record<string, unknown>)["run_id"]);
    const job = await one<{ agent_session_id: string | null }>(
      "select j.agent_session_id from action_runs r join bridge_jobs j on j.id = r.bridge_job_id where r.id = $1",
      [runId],
    );
    expect(job.agent_session_id).toBeNull();
  });

  it("K63-API-057 任せた人が外された・止められた・直せなくなった・PC を外した／つないでいない × 承認する・実行待ちのまま読む：実行の仕事は止め、チケットは作業中、帯に理由", async () => {
    const cases: [string, (tm: Team) => Promise<void>, RegExp][] = [
      [
        "外された",
        (tm) => f.admin.query("update members set deleted_at = now() where id = $1", [tm.by.id]).then(() => undefined),
        /いないので/,
      ],
      [
        "止められた",
        (tm) =>
          f.admin
            .query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [tm.by.id, boss.id])
            .then(() => undefined),
        /いないので/,
      ],
      [
        "直せなくなった",
        (tm) =>
          f.admin
            .query("update permissions set ability_id = 'view' where grantee_member_id = $1", [tm.by.id])
            .then(() => undefined),
        /直せなくなったので/,
      ],
      [
        "PC を外した",
        (tm) =>
          f.admin.query("update sessions set revoked_at = now() where id = $1", [tm.pc.sid]).then(() => undefined),
        /PC/,
      ],
    ];
    for (const [name, spoil, why] of cases) {
      // 承認の前に起きた：承認は記録し、実行の仕事はすぐ止める
      const before = await team(`任せた人（${name}・前）`);
      const t1 = await ticket();
      const d1 = await delegated(t1, { by: before });
      await spoil(before);
      expect((await approve(boss, d1.approvalId)).status, name).toBe(201);
      const r1 = (await runsOf(t1.id, "execute"))[0]!;
      expect(r1.status_id, name).toBe("stopped");
      expect(String(r1.error_summary)).toMatch(why);
      expect(await stageKeyOf(t1.id)).toBe("doing");
      // 承認の後・実行待ちの間に起きた：読んだときの片付けで止める（PC が来なくても）
      const after = await team(`任せた人（${name}・後）`);
      const t2 = await ticket();
      const a2 = await approved(t2, { by: after });
      await spoil(after);
      const g = await req("GET", `/tickets/${t2.id}`, { headers: auth(boss) });
      expect(g.status).toBe(200);
      const r2 = (await runsOf(t2.id, "execute"))[0]!;
      expect(r2.status_id, name).toBe("stopped");
      expect(String(r2.error_summary)).toMatch(why);
      expect(["stopped", "cancelled"]).toContain((await jobOf(a2.execJobId))["state_id"]);
      expect(await stageKeyOf(t2.id)).toBe("doing");
    }
    // PC を一度もつないでいない人：承認は記録し、実行は止める
    const noPc = await f.person(T.tenantId, T.rootScope, { name: "PC の無い人", ticketAbility: "edit" });
    const t3 = await ticket();
    const d3 = await delegated(t3, { by: { by: noPc, pc: { token: "", sid: "" } } });
    expect((await approve(boss, d3.approvalId)).status).toBe(201);
    const r3 = (await runsOf(t3.id, "execute"))[0]!;
    expect(r3.status_id).toBe("stopped");
    expect(String(r3.error_summary)).toMatch(/PC/);
  });

  it("K63-API-058 守り × 24 時間の片付けの関数を、別の PC のセッションで呼ぶ：何も変えない（要求の PC のセッションと同じかを確かめる）", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    const other = await team("別の PC の人");
    const ctx: TenantContext = { tenantId: T.tenantId, userId: other.by.id, role: "device", stepUpAt: null };
    const n = await withTenant(f.pool, ctx, (cl) =>
      cl.query<{ n: number }>("select app.ticket_execute_expire($1) as n", [a.pc.sid]),
    );
    expect(Number(n.rows[0]!.n)).toBe(0);
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
  });

  it("K63-API-059 失敗 × 守りの判定（書けるか）の所で例外になった：承認の関数は guard_failed を返し、口は通さず 503・E-PAGE-003。何も書かない（fail-closed）", async () => {
    const t = await ticket({ title: "K63 守りが壊れる" });
    const d = await delegated(t);
    const before = await snapshot(t);
    // 壊すのはこの試験の中だけ：ticket_writable を「この題名のチケットなら例外」に作り替え、finally で元の定義に戻す
    const orig = (
      await one<{ def: string }>("select pg_get_functiondef('app.ticket_writable(uuid)'::regprocedure) as def")
    ).def;
    await f.admin
      .query(`create or replace function app.ticket_writable(tid uuid) returns boolean language plpgsql stable security definer set search_path = public, app as $$
      begin
        if exists (select 1 from tickets x where x.id = tid and x.title = 'K63 守りが壊れる') then
          raise exception 'K63 の試験で守りを壊した';
        end if;
        return exists (
          select 1 from tickets x
          where x.id = tid and x.tenant_id = app.tenant_id()
            and app.ticket_draft_ok(x.draft_import_id, app.user_id())
            and (has_permission(app.user_id(), 'tickets', x.scope_id, 'edit') or x.assignee_member_id = app.user_id())
        );
      end $$`);
    try {
      // (b) 関数を直に呼ぶと guard_failed を返す（例外を外に投げない・何も書かない）
      const ctx: TenantContext = { tenantId: T.tenantId, userId: boss.id, role: "member", stepUpAt: null };
      const out = await withTenant(f.pool, ctx, (cl) =>
        cl.query<{ v: { error?: string } }>("select app.approval_decide($1, 'approve', null) as v", [d.approvalId]),
      );
      expect(out.rows[0]!.v.error).toBe("guard_failed");
      // (a) 口は decide.ts が guard_failed を 503・E-PAGE-003 に替える
      const r = await approve(boss, d.approvalId);
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await f.admin.query(orig);
    }
    expect(await snapshot(t)).toEqual(before);
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
  });
  it("K63-API-060 承認待ち × 担当者がいない：承認する人がいない。一覧に出ず、1 件は can_decide false。承認・差し戻しは 403", async () => {
    const t = await ticket();
    const d = await delegated(t);
    await f.admin.query("update tickets set assignee_member_id = null where id = $1", [t.id]);
    expect(((await json(await queue(boss))).data as unknown as { id: string }[]).map((x) => x.id)).not.toContain(
      d.approvalId,
    );
    const g = await detail(writer, d.approvalId);
    expect(g.status).toBe(200);
    expect(((await json(g)).data as Record<string, unknown>)["can_decide"]).toBe(false);
    expect((await approve(boss, d.approvalId)).status).toBe(403);
    expect((await giveBack(boss, d.approvalId, "直して")).status).toBe(403);
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
  });

  it("K63-API-061 操作の揺れ × 読むときの片付けと PC の取りが同時に動く（24 時間を過ぎた実行待ち）：仕事は渡されるか片付けられるかのどちらか 1 つ。片付けは queued の行だけを変え、聞き直しの行は 1 つ", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    const [taken] = await Promise.all([
      take(a.pc),
      queue(boss),
      req("GET", `/tickets/${t.id}`, { headers: auth(boss) }),
    ]);
    expect(taken?.id ?? null).not.toBe(a.execJobId); // 24 時間を過ぎたものは take も渡さない（守りの 2 層目）
    expect((await jobOf(a.execJobId))["state_id"]).toBe("cancelled");
    expect(
      await num("select count(*) as n from approvals where ticket_id = $1 and decision is null and note = $2", [
        t.id,
        NOTE_24H,
      ]),
    ).toBe(1);
    // 動き出した仕事（running）は片付けが変えない
    const u = await ticket();
    const b = await approved(u);
    expect((await take(b.pc))?.id).toBe(b.execJobId);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      b.approvalId,
    ]);
    await Promise.all([queue(boss), queue(boss), req("GET", `/tickets/${u.id}`, { headers: auth(boss) })]);
    expect((await jobOf(b.execJobId))["state_id"]).toBe("running");
  });

  /** この試験の中だけ ticket_writable を「この題名のチケットなら例外」に作り替え、終わったら元の定義に戻す */
  const breakWritable = async <T>(title: string, body: () => Promise<T>): Promise<T> => {
    const orig = (
      await one<{ def: string }>("select pg_get_functiondef('app.ticket_writable(uuid)'::regprocedure) as def")
    ).def;
    await f.admin
      .query(`create or replace function app.ticket_writable(tid uuid) returns boolean language plpgsql stable security definer set search_path = public, app as $$
      begin
        if exists (select 1 from tickets x where x.id = tid and x.title = '${title}') then
          raise exception 'K63 の試験で守りを壊した';
        end if;
        return exists (
          select 1 from tickets x
          where x.id = tid and x.tenant_id = app.tenant_id()
            and app.ticket_draft_ok(x.draft_import_id, app.user_id())
            and (has_permission(app.user_id(), 'tickets', x.scope_id, 'edit') or x.assignee_member_id = app.user_id())
        );
      end $$`);
    try {
      return await body();
    } finally {
      await f.admin.query(orig);
    }
  };

  it("K63-API-062 失敗 × 差し戻しの守りの判定の所で例外になった：503・E-PAGE-003。何も書かない（fail-closed）", async () => {
    const t = await ticket({ title: "K63 守りが壊れる 差し戻し" });
    const d = await delegated(t);
    const before = await snapshot(t);
    await breakWritable("K63 守りが壊れる 差し戻し", async () => {
      const r = await giveBack(boss, d.approvalId, "宛名を直してください");
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    });
    expect(await snapshot(t)).toEqual(before);
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
  });

  it("K63-API-063 失敗 × 完了の守りの判定の所で例外になった：503・E-PAGE-003。段は変わらず、知らせも出ない（fail-closed）", async () => {
    const t = await ticket({ title: "K63 守りが壊れる 完了", creator: writer });
    await executed(t);
    await breakWritable("K63 守りが壊れる 完了", async () => {
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    });
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(
      await num("select count(*) as n from notifications where dedupe_key like $1", [`%ticket.completed:${t.id}`]),
    ).toBe(0);
  });

  it("K63-API-064 守り × 一覧を PC の印・取引先の人で呼ぶ：403（社内の人だけ）。何も書かない", async () => {
    const tm = await team("一覧を PC で呼ぶ人");
    const t = await ticket({ assignee: tm.by });
    const d = await delegated(t);
    const viaPc = await req("GET", "/approvals/queue", { headers: { "x-bridge-session": tm.pc.token } });
    expect(viaPc.status).toBe(403);
    const viaClient = await req("GET", "/approvals/queue", { headers: auth(tm.by, { role: "client" }) });
    expect(viaClient.status).toBe(403);
    expect(JSON.stringify(await json(viaClient))).not.toContain(d.approvalId);
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
  });
});
