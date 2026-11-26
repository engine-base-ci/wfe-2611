// K-63「承認して完了する」の口の試験の共通の土台（K-161〜K-166 の試験が読む）。分ける前の approve-complete.test.ts の頭（道具・決めた文・土台の立て方）をそのまま移した。
//   行（it）の中身は孫ごとのファイル approve-complete-<束>.test.ts にある。土台は各ファイルの頭で setupApproveComplete() を 1 回呼んで立てる（ファイルごとに本物の DB を立てる）。
//   以下は分ける前の頭の説明（行 ID の並び・口の形・DB の形）のまま。
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
//   completeTicket     POST /tickets/:id/complete    ← { conditions_confirmed }（K-578 の後。todo_checked・todo_version は契約に無く、送ると 422）→ 201 { data: { ticket: { id, number, stage_key, completed_at, completed_by }, knowledge_candidates, skipped_reason } }
//   PC の口（K-62）：POST /bridge/jobs/take ← { protocol, idle, wait_sec }（頭 x-bridge-session）→ { data: { job: 仕事 | null, … } }・POST /bridge/jobs/:id/finish ← { state, result, reason, agent_session_id }
//     K-62 の契約の形がこの道具（take・finish）と違えば、この 2 つの道具だけを K-62 の形に合わせる（作る役に戻す）。K63-API-011 の app.bridge_take_job($1) の直呼びも同じ（K-62 が引数を足していれば合わせる）
// 試験が前提にする DB の形（このチケットの migration・番号は取り込む順の次の空き番号）：app.approval_decide・app.ticket_execute_expire・app.ticket_complete・
//   引き金 app.ticket_execute_job_end・action_runs.approval_id（K-62）・tickets.completed_at／completed_by・bridge_jobs.resume_session_id（作業セッションの記録を持つ PC・D-131.3）
// 一覧は 1 回 20 件・続きは鍵の文字列（due_on・created_at・id を | でつないで base64url・D-131.9）。片付けで止めた仕事は stopped（D-131.14）。差し戻す理由・止まった理由に上限は無く、切らない（D-131.1・2）
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect } from "vitest";
import { createRepository } from "@kaname/db/repository";
import { type TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import { delegateHooks } from "../../../src/features/F5/delegate/index.js";
import { approveHooks } from "../../../src/features/F5/approve-complete/index.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { pairMemberForTest } from "../../bridge_pair.js";

// ---- 決めた文と言葉（K-63.md・errors.json に足す）----
export const CHECK_NONE = "検査なし（まだ流していません）"; // 骨格の間の印（D-128.138）
export const NOTE_24H = "承認から 24 時間を過ぎたので、実行の前にもう一度確かめてください"; // 聞き直しの行の note（D-127.9・D-128.98）
export const STOP_GONE = "チケットが消されたので止めました";
export const STOP_24H = "承認から 24 時間を過ぎたので、実行の前にもう一度確かめます"; // 片付けで止めた仕事の理由（stopped・D-131.14）
export const STOP_NO_REASON = "AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます"; // D-129.47・D-131.4
export const LIMIT_DEFAULT = 20; // 一覧は 1 回 20 件（D-131.9）
export const b64url = (x: string) => Buffer.from(x, "utf8").toString("base64url");
export const SKIPPED = "候補はまだ出していません"; // 完了のときのナレッジの候補（D-128.138）
export const CONF_DONE = "E-CONF-003"; // この承認はもう処理されています
export const CONF_STAGE = "E-CONF-016"; // 承認待ち・実行中・確認中は完了にできない
export const CONF_TODO_CHANGED = "E-CONF-017";
export const CONF_ALREADY = "E-CONF-018";
export const VAL_REASON_EMPTY = "E-VAL-020";
export const VAL_TODO_LEFT = "E-VAL-022";
export const VAL_NOT_CONFIRMED = "E-VAL-023";
export const VAL_CHILDREN = "E-VAL-024";
export const GONE = "E-PAGE-001";
export const ARTIFACT = "株式会社サンプル 御中\n11 月分の請求書をお送りします。"; // 成果物の本文（知らせ・証跡・ログに出してはいけない）
export const MIN = 60_000;

export let f: Fixture;
export let app: ReturnType<typeof createApp>;
export const hooks: Record<string, Hook> = {};
export const limits: Record<string, number> = {};
export let T: { tenantId: string; rootScope: string };
export let O: { tenantId: string; rootScope: string };
export let boss: Person; // 担当者（承認する人）
export let writer: Person; // 同じグループの書ける人（承認する人でない）
export let viewer: Person; // 見るだけの人
export let manager: Person; // グループのマネージャー
export let outsider: Person; // 別の会社の人

export type J = Record<string, unknown> & {
  data?: Record<string, unknown> & unknown[];
  meta?: Record<string, unknown>;
};
export const json = async (r: Response) => (await r.clone().json()) as J;
export const one = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
  (await f.admin.query(sql, p)).rows[0] as R;
export const num = async (sql: string, p: unknown[] = []) => Number((await one<{ n: string }>(sql, p)).n);

/** 偽の画面のログイン。su は本人確認の取り直しの時刻（ミリ秒） */
export const auth = (p: Person, o: { su?: number | undefined; role?: string } = {}) => ({
  authorization: `Bearer fake:${o.role ?? "member"}:${p.tenantId}:${p.id}${o.su === undefined ? "" : `:su=${o.su}`}`,
});
export const req = (
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
export const queue = (p: Person, q = "") => req("GET", `/approvals/queue${q}`, { headers: auth(p) });
export const detail = (p: Person, id: string) => req("GET", `/approvals/${id}`, { headers: auth(p) });
export const approve = (p: Person, id: string, o: { su?: number | undefined; key?: string; body?: unknown } = {}) =>
  req("POST", `/approvals/${id}/approve`, {
    body: o.body ?? {},
    headers: { ...auth(p, { su: o.su }), ...(o.key ? { "idempotency-key": o.key } : {}) },
  });
export const giveBack = (p: Person, id: string, note: unknown, o: { key?: string } = {}) =>
  req("POST", `/approvals/${id}/return`, {
    body: { note },
    headers: { ...auth(p), ...(o.key ? { "idempotency-key": o.key } : {}) },
  });
export const complete = (p: Person, ticketId: string, body: unknown, o: { key?: string } = {}) =>
  req("POST", `/tickets/${ticketId}/complete`, {
    body,
    headers: { ...auth(p), ...(o.key ? { "idempotency-key": o.key } : {}) },
  });
/** PC が仕事を取りに来る。idle: true は「何も動かしていない」＝その PC が受け取って動いていた仕事を片付ける（K63-API-015 だけが使う） */
export const take = async (pc: { token: string }, o: { idle?: boolean } = {}) => {
  const r = await req("POST", "/bridge/jobs/take", {
    body: { protocol: 99, idle: o.idle ?? false, wait_sec: 0 },
    headers: { "x-bridge-session": pc.token },
  });
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  // K-62 の答え：{ data: { job: 仕事 | null, forbidden_domains, next_ms, outdated } }
  const d = (await json(r)).data as unknown as { job?: Record<string, unknown> | null } | null;
  const job = d?.job ?? null;
  return job ? ({ ...job, id: String(job["job_id"] ?? job["id"]) } as Record<string, unknown> & { id: string }) : null;
};
export const finish = async (
  pc: { token: string },
  jobId: string,
  b: { state: string; result?: string | null; reason?: string | null | undefined; agent_session_id?: string | null },
) => {
  const r = await req("POST", `/bridge/jobs/${jobId}/finish`, { body: b, headers: { "x-bridge-session": pc.token } });
  expect(r.status, await r.clone().text()).toBeLessThan(300);
};
/** PC の最後の知らせを今から sec 秒前に置く（75 秒で「閉じている」） */
export const lastSeen = (sid: string, sec: number) =>
  // 最後の知らせを sec 秒前に。PC は一度は生きている知らせを送った（alive_at・K-62 の 0092 の式は alive_at が無ければ live にしない）
  f.admin.query(
    "update sessions set last_seen_at = now() - make_interval(secs => $2), alive_at = coalesce(alive_at, now() - make_interval(secs => $2)) where id = $1",
    [sid, sec],
  );

// ---- 種を置く ----
export const stageOf = async (tenant: string, key: string) =>
  (await one<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = $2", [tenant, key])).id;
export const stageKeyOf = async (ticketId: string) =>
  (
    await one<{ key: string }>(
      "select s.key from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
      [ticketId],
    )
  ).key;
export interface Ticket {
  id: string;
  number: string;
  tenant: string;
  scope: string;
  assignee: Person;
}
export interface Team {
  by: Person;
  pc: { token: string; sid: string };
}
/** 試験ごとに新しい「AI に任せた人」とその人の PC（人と PC を試験どうしで使い回さない・試験の順番に頼らない） */
export async function team(name = "山田", co: { tenantId: string; rootScope: string } = T): Promise<Team> {
  const by = await f.person(co.tenantId, co.rootScope, { name, ticketAbility: "edit" });
  const pc = await pairMemberForTest(f.admin, by.id, `${name}の PC`);
  return { by, pc };
}
export const TODO = "- 請求書を作る\n- 先方に送る";
/** 任せる口に送る「確認項目を使わない理由」。ticket() は確認項目を置かないので、口で任せる試験はこれを送る（0 件で理由が無いと 409・E-CONF-020・K-578・D-150.45） */
export const NO_SPEC = "試験のチケットで確かめる物を置いていない";
export async function ticket(
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
    /** true なら、本文の行（鍵 body）も置く（目的・完了の条件・実施事項の字を段落にした物）。AI に渡す中身（prompt）に字が入ることを見る試験が使う（K-578：前の区画は読まれない）。
     *  完了の数え方の試験など、本文の行を自分で置く物は付けない（行は 1 つだけ） */
    body?: boolean;
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
  if (o.body === true) {
    const lines = [
      "月末の請求を出す",
      "先方が請求書を受け取った",
      ...(o.todo === undefined ? TODO : (o.todo ?? "")).split("\n").filter((x) => x !== ""),
    ];
    const body = {
      doc: { type: "doc", content: lines.map((x) => ({ type: "paragraph", content: [{ type: "text", text: x }] })) },
      text: lines.join("\n"),
    };
    const b = await one<{ id: string }>(
      "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version) values ($1, $2, 'body', 0, $3, 1) returning id",
      [tenant, t.id, JSON.stringify(body)],
    );
    await f.admin.query(
      "insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body) values ($1, $2, $3, 1, $4)",
      [tenant, t.id, b.id, JSON.stringify(body)],
    );
  }
  return { ...t, tenant, scope, assignee: o.assignee ?? boss };
}
export interface Delegated extends Team {
  approvalId: string;
  makeRunId: string;
  makeJobId: string;
  agentSession: string;
}
/** K-62 の作る段が終わった形を置く：作る段の仕事と実行の記録・成果物の区画・承認待ちの行・チケットは承認待ち */
export async function delegated(
  t: Ticket,
  o: { by?: Team; irreversible?: boolean; humanChecks?: unknown[] } = {},
): Promise<Delegated> {
  const tm = o.by ?? (await team());
  const by = tm.by;
  const agentSession = randomUUID(); // 続きの id は uuid（PC の口の契約は uuid だけを受ける・D-129.42。K-62 の試験と同じ形）
  const job = await one<{ id: string }>(
    `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, agent_session_id, result, started_at, finished_at, taken_session_id)
     values ($1, $2, $3, 'ticket', 'done', '（作る段）', $4, $5, now() - interval '2 minutes', now() - interval '1 minute', $6) returning id`,
    [t.tenant, t.scope, by.id, agentSession, ARTIFACT, tm.pc.sid || null], // 作る段の仕事を取った PC（作業セッションの記録を持つ PC・D-131.3）
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
export const approvalRow = (id: string) =>
  one<Record<string, unknown>>(
    "select decision, decided_at, status_id, resolved_at, return_reason, next_actor, withdrawn_at from approvals where id = $1",
    [id],
  );
export const runsOf = (ticketId: string, phase: string) =>
  f.admin
    .query<{
      id: string;
      status_id: string;
      bridge_job_id: string | null;
      approval_id: string | null;
      error_summary: string | null;
      created_by: string | null;
    }>(
      "select id, status_id, bridge_job_id, approval_id, error_summary, created_by from action_runs where ticket_id = $1 and phase = $2 order by created_at",
      [ticketId, phase],
    )
    .then((r) => r.rows);
export const jobOf = (id: string) =>
  one<Record<string, unknown>>(
    "select member_id, state_id, prompt, agent_session_id, permission_mode, stopped_reason, kind, resume_session_id, taken_session_id from bridge_jobs where id = $1",
    [id],
  );
export const messagesOf = (ticketId: string) =>
  f.admin
    .query<{ body: string; kind: string }>(
      "select body, kind from ticket_messages where ticket_id = $1 order by created_at",
      [ticketId],
    )
    .then((r) => r.rows);
export const openApprovals = (ticketId: string) =>
  num(
    "select count(*) as n from approvals where ticket_id = $1 and decision is null and withdrawn_at is null and deleted_at is null",
    [ticketId],
  );
/** 承認を済ませて、実行の仕事を積んだ状態にする（口を通す） */
export async function approved(t: Ticket, o: Parameters<typeof delegated>[1] = {}) {
  const d = await delegated(t, o);
  const r = await approve(t.assignee, d.approvalId);
  expect(r.status, await r.clone().text()).toBe(201);
  const run = (await runsOf(t.id, "execute")).at(-1)!;
  return { ...d, execRunId: run.id, execJobId: run.bridge_job_id! };
}
/** 実行が終わって作業中に戻った状態（口を通す） */
export async function executed(t: Ticket) {
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
export const todoVersion = async (ticketId: string) =>
  Number(
    (
      await one<{ v: number | null }>(
        "select version as v from ticket_sections where ticket_id = $1 and section_key = 'todo'",
        [ticketId],
      )
    )?.v ?? 0,
  );
/** 完了の体（K-578 の後は conditions_confirmed だけ。引数 t は呼び元の形を変えないために残す）。extra に todo_checked などを渡すと 422 になる */
export const completeBody = async (_t: Ticket, extra: Record<string, unknown> = {}) => ({
  conditions_confirmed: true,
  ...extra,
});
export const details = (j: J) => (j["details"] as { field: string; message: string }[] | undefined) ?? [];
/** その要求で、承認・実行・段・やり取り・証跡が何も変わっていないこと */
export async function snapshot(t: Ticket) {
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
export const jstDate = (days: number) =>
  new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

/** この試験の中だけ ticket_writable を「この題名のチケットなら例外」に作り替え、終わったら元の定義に戻す */
export const breakWritable = async <T>(title: string, body: () => Promise<T>): Promise<T> => {
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

/** 試験の土台を立てる（各ファイルの頭で 1 回呼ぶ）。中身は分ける前の approve-complete.test.ts の beforeAll・afterAll のまま */
export function setupApproveComplete(): void {
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
      return { ctx, termsPending: false, sessionId: "", authUserId: "" };
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
}
