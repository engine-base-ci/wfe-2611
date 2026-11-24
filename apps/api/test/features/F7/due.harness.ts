// 段 8「期限・開始日を変える」の口（K-483・updateTicket の期限の組）の試験の土台。K-483 が carry: で運ぶ。行（it）は due-change.test.ts にある。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては apps/api/test/features/fixture.ts（本物の Postgres に migration を全部当てる・偽の画面のログイン）。
//   チケットを作る（K-60）の口 ticketHooks（getTicket）は前から在るので makeFixture に渡す。
//   updateTicket の口（段 7 の K-387 が作る apps/api/src/hooks/ticket-update.ts）は、準備（beforeAll）では読まず、最初の要求の前に 1 回だけ読んで f.hooks に足す
//   （切る段の smoke で、まだ無いファイルを準備で読んで準備ごと落とさないため・answer=8f745003d023。読み方は K-387 の progress.harness.ts と同じ）。
// チケット・承認・やり取りは DB に直に置く（まだ無い口を準備に使わない）。時刻は眠らずに now() からずらして置く。
import { afterAll, beforeAll, vi } from "vitest";
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { Hook } from "../../../src/contract/deps.js";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

// ---- 決めた番号と文（11_tickets/K-483.md の表・errors.d/K-483.json）----
export const DUE_NO_REASON = "E-DUE-001"; // 期限を変える理由を書いてください（422）
export const DUE_REASON_LONG = "E-DUE-002"; // 理由は 200 文字までにしてください（422）
// E-DUE-003 は使わない（欠番）。開始日と期限の前後は、両方を送っても片方だけ送っても 409 E-VAL-028（欄なし・欄どうしの比べ合いは契約に書けない・PM の決め 2026-11-21 05:50）。E-VAL-028 と E-VAL-012 の定義の持ち主は段 5 の K-437（チケットを作る口の直し）で、K-483 は定義せず番号と文を使うだけ（文は K-437 の errors.d/K-437.json・E-VAL-012 は _base.json の物）。
export const DUE_ORDER_STATE = "E-VAL-028"; // 開始日は期限より前の日にしてください（409・欄なし・両方を送ったときも片方だけ送ったときも）
export const DUE_OVER_PARENT = "E-DUE-005"; // 子のチケットの期限は、親のチケットの期限より後にできません（409）
export const DUE_UNDER_CHILD = "E-DUE-006"; // この期限より後の期限を持つ子のチケットがあります（409）
export const DUE_DONE = "E-DUE-007"; // 完了したチケットの期限は変えられません（409）
export const DUE_STALE = "E-DUE-008"; // ほかの人が先に期限を変えました（409）
export const DUE_PAST = "E-VAL-012"; // 期限は今日か、それより後の日にしてください（409・class conflict・欄なし。今日の日付で決まる断り。K-437 が E-VAL-012 を 409 にし、作る口もこの口も同じ番号を使う。新しい E-DUE- の番号は作らない）
export const VAL_NOT_YET = "E-VAL-018"; // まだ変えられない欄（担当者は F8 の渡す口・題名・見込みは今は変えられない。優先度・親は K-440 の組）
export const TEXT: Readonly<Record<string, string>> = {
  [DUE_NO_REASON]: "期限を変える理由を書いてください",
  [DUE_REASON_LONG]: "理由は 200 文字までにしてください",
  [DUE_ORDER_STATE]: "開始日は期限より前の日にしてください",
  [DUE_OVER_PARENT]: "子のチケットの期限は、親のチケットの期限より後にできません",
  [DUE_UNDER_CHILD]: "この期限より後の期限を持つ子のチケットがあります。先に子の期限を変えてください",
  [DUE_DONE]: "完了したチケットの期限は変えられません",
  [DUE_STALE]: "ほかの人が先に期限を変えました。開き直してから、もう一度変えてください",
  [DUE_PAST]: "期限は今日か、それより後の日にしてください",
};
export const DUE_KIND = "ticket.due_changed"; // 受け箱のお知らせの種類（K-461 の kinds.ts が札と行き先を持つ）
export const REASON_MAX = 200;

export let f: Fixture;
export let T: { tenantId: string; rootScope: string };
export let O: { tenantId: string; rootScope: string };
export let boss: Person; // 担当者（書ける）
export let writer: Person; // 同じグループの書ける人（担当者でない）
export let approver: Person; // 承認する人（書ける）
export let viewer: Person; // 見るだけの人
export let stopped: Person; // 止められた人（suspended_at）
export let outsider: Person; // 別の会社の人

export type J = Record<string, unknown> & {
  data?: Record<string, unknown>;
  details?: { field: string; message: string }[];
};
export const json = async (r: Response) => (await r.clone().json()) as J;
export const one = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
  (await f.admin.query(sql, p)).rows[0] as R;
export const num = async (sql: string, p: unknown[] = []) => Number((await one<{ n: string }>(sql, p)).n);
export const fields = (j: J) => (j.details ?? []).map((d) => d.field);
export const ctxOf = (p: Person): TenantContext => ({
  tenantId: p.tenantId,
  userId: p.id,
  role: "member",
  stepUpAt: null,
});
/** 行の守りの中（アプリの接続・その人の文脈）で SQL を流す（口を通さない DB の 2 層目の確かめ） */
export const asMember = async <R = Record<string, unknown>>(p: Person, sql: string, args: unknown[] = []) =>
  withTenant(f.pool as pg.Pool, ctxOf(p), async (cl) => (await cl.query(sql, args)).rows as R[]);
export const failsAs = async (p: Person, sql: string, args: unknown[] = []): Promise<string | null> => {
  try {
    await asMember(p, sql, args);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
};
export async function captureLogs(run: () => Promise<void>): Promise<string> {
  const out: string[] = [];
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
    vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
  );
  try {
    await run();
  } finally {
    for (const s of spies) s.mockRestore();
  }
  return out.join("\n");
}

/** 日本時間の今日から days 日ずれた日（YYYY-MM-DD）。口は日本時間の今日で過去かを決める */
export const jst = (days = 0, base = Date.now()) =>
  new Date(base + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
/** やり取りの 1 行に出る日の形（MM/DD） */
export const mmdd = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;

/** updateTicket の口（K-387 が作る hooks のファイル）を最初の要求の前に 1 回だけ読む */
function useHooks() {
  let loading: Promise<void> | null = null;
  const load = async () => {
    const m = (await import("../../../src/hooks/ticket-update.js")) as {
      ticketUpdateHooks: (p: pg.Pool) => Record<string, Hook>;
    };
    Object.assign(f.hooks, m.ticketUpdateHooks(f.pool));
  };
  const base = f.req;
  f.req = async (method, path, o) => {
    await (loading ??= load());
    return base(method, path, o);
  };
}

/** 土台を立てる（試験のファイルの頭で 1 回） */
export function setupDue() {
  beforeAll(async () => {
    f = await makeFixture([ticketHooks]);
    T = await f.company("K483 の会社", "DU");
    O = await f.company("K483 の別の会社", "DO");
    boss = await f.person(T.tenantId, T.rootScope, { name: "高本", ticketAbility: "edit" });
    writer = await f.person(T.tenantId, T.rootScope, { name: "佐藤", ticketAbility: "edit" });
    approver = await f.person(T.tenantId, T.rootScope, { name: "承認する人", ticketAbility: "edit" });
    viewer = await f.person(T.tenantId, T.rootScope, { name: "見るだけの人", ticketAbility: "view" });
    stopped = await f.person(T.tenantId, T.rootScope, { name: "止められた人", ticketAbility: "edit" });
    // members_suspended_ck：止めた時刻と止めた人は一緒に入れる（F5 の止めた人の作り方と同じ）
    await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      stopped.id,
      boss.id,
    ]);
    outsider = await f.person(O.tenantId, O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    f.limits["updateTicket"] = 10_000;
    f.limits["getTicket"] = 10_000;
    useHooks();
  });
  afterAll(async () => {
    await f?.close();
  });
}

// ---- 種を置く ----
const stageOf = async (tenant: string, key: string) =>
  (await one<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = $2", [tenant, key])).id;
export interface Ticket {
  id: string;
  number: string;
  tenant: string;
}
export interface TicketOpts {
  tenant?: string;
  assignee?: Person | null;
  stage?: string;
  title?: string;
  due?: string | null;
  start?: string | null;
  parent?: string | null;
  deleted?: boolean;
}
export async function ticket(o: TicketOpts = {}): Promise<Ticket> {
  const tenant = o.tenant ?? T.tenantId;
  const kind = (
    await one<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [tenant],
    )
  ).id;
  const t = await one<{ id: string; number: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, due_on, start_on, parent_ticket_id, created_by, deleted_at)
     values ($1, $2, '', $3, $4, $5, $6, $7, $8, $9, $10, case when $11::boolean then now() else null end) returning id, number`,
    [
      tenant,
      tenant === T.tenantId ? T.rootScope : O.rootScope,
      kind,
      await stageOf(tenant, o.stage ?? "doing"),
      o.title ?? "見積書を作って送る",
      o.assignee === undefined ? boss.id : (o.assignee?.id ?? null),
      o.due === undefined ? jst(5) : o.due,
      o.start ?? null,
      o.parent ?? null,
      boss.id,
      o.deleted === true,
    ],
  );
  return { ...t, tenant };
}
/** 完了の形を DB に直に置く（段 done・completed_at・completed_by） */
export async function doneTicket(o: TicketOpts = {}): Promise<Ticket> {
  const t = await ticket({ ...o, stage: "done" });
  await f.admin.query("update tickets set completed_at = now() - interval '1 hour', completed_by = $2 where id = $1", [
    t.id,
    boss.id,
  ]);
  return t;
}
/** 決まっていない承認（成果物の承認）を 1 つ置く。承認する人を選べる（既定は担当者と別の人） */
export async function pendingApproval(
  t: Ticket,
  who: Person = approver,
  o: { decided?: boolean; withdrawn?: boolean } = {},
) {
  await f.admin.query(
    `insert into approvals (tenant_id, scope_id, kind, ticket_id, approver_member_id, requested_by, status_id, created_by, decision, decided_at, withdrawn_at)
     select tenant_id, scope_id, 'artifact', id, $2, $3, 'pending', $3, case when $4::boolean then 'approve' else null end,
            case when $4::boolean then now() else null end, case when $5::boolean then now() else null end
       from tickets where id = $1`,
    [t.id, who.id, boss.id, o.decided === true, o.withdrawn === true],
  );
}

// ---- 口を叩く ----
export const patch = (p: Person, ticketId: string, body: unknown) =>
  f.req("PATCH", `/tickets/${ticketId}`, { body, headers: p.auth });
export const detail = (p: Person, ticketId: string) => f.req("GET", `/tickets/${ticketId}`, { headers: p.auth });
/** 期限の口の体：期限を変えるときは理由を添える */
export const due = (dueOn: string | null, reason = "先方の都合") => ({ due_on: dueOn, due_reason: reason });

// ---- 読み直す ----
export const row = (ticketId: string) =>
  one<{
    due_on: string | null;
    start_on: string | null;
    updated_at: Date;
    updated_by: string | null;
    completed_at: Date | null;
  }>(
    "select due_on::text as due_on, start_on::text as start_on, updated_at, updated_by, completed_at from tickets where id = $1",
    [ticketId],
  );
export interface Line {
  id: string;
  body: string | null;
  changes: { field: string; from: string | null; to: string | null; raw_from: string | null; raw_to: string | null; note?: string }[];
  author_member_id: string | null;
  created_by: string | null;
}
export const lines = (ticketId: string) =>
  f.admin
    .query<Line>(
      "select id, body, changes, author_member_id, created_by from ticket_messages where ticket_id = $1 and kind = 'change' and (body like '%期限%' or body like '%開始日%') order by created_at, id",
      [ticketId],
    )
    .then((r) => r.rows);
export const notices = (ticketId: string) =>
  f.admin
    .query<{ member_id: string; payload: Record<string, unknown>; dedupe_key: string | null; channel_id: string }>(
      "select member_id, payload, dedupe_key, channel_id from notifications where event_kind_id = $2 and payload->>'ticket_id' = $1::text order by created_at, member_id",
      [ticketId, DUE_KIND],
    )
    .then((r) => r.rows);
export const audits = (ticketId: string) =>
  f.admin
    .query<{ payload: { fields?: string[] }; choke_point_id: string | null; actor_member_id: string | null }>(
      "select payload, choke_point_id, actor_member_id from audit_events where action = 'ticket.due' and target_id = $1 order by created_at",
      [ticketId],
    )
    .then((r) => r.rows);
