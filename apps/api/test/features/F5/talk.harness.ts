// 段 6「話す」の口（K-757 読む・K-758 言う止める・K-763 チケットの中で話す・K-774 作る画面の会話）の試験の共通の土台（K-757 が持ち込む）。
//   組み立ては F5/clone-room.harness.ts と同じ：本物の Postgres（migration を全部当てる）・本物の口の入口。画面のログインだけは偽（Bearer に会社・人・役を書く）。
//   会社・人・チケット・会話・仕事・PC は DB に直に入れる（行の守りの外・admin）。
//   口の振る舞いは葉ごとの hooks のファイル（apps/api/src/hooks/talk-read.ts ほか・register・K-326）。最初に口を叩くときに 1 回だけ読む
//   （準備で読まない：実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, vi } from "vitest";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { pairMemberForTest } from "../../bridge_pair.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");

export type { Person };
export type Json = Record<string, unknown> & { data?: unknown; meta?: Record<string, unknown>; code?: string };
export type TalkKind = "clone" | "ticket" | "draft";

/** 試験の会社 1 つ分。自分（me）はグループ A の席・A に tickets の edit。同じグループの別の人（other）・グループ B の人（outsider） */
export interface World {
  tenantId: string;
  rootScope: string;
  scopeA: string;
  scopeB: string;
  kindId: string;
  me: Person;
  other: Person;
  outsider: Person;
}

export interface ConversationOpts {
  kind?: TalkKind;
  /** kind が ticket のときのチケット */
  ticket?: string;
  title?: string | null;
  deleted?: boolean;
  /** 「新しい会話」で閉じた印 */
  closed?: boolean;
  /** 何分前に更新したか（並びの試験用）。既定は今 */
  updatedMinAgo?: number;
  /** この会話で AI の返事を最後に読んだのが何分前か（無ければ読んでいない） */
  readMinAgo?: number | null;
}
export interface MessageOpts {
  who?: "me" | "ai" | "stopped" | "note" | "proposal" | "memo";
  text?: string;
  /** 何分前か（並びを決める）。既定は今 */
  minAgo?: number;
  options?: Record<string, unknown> | null;
  jobId?: string | null;
  deleted?: boolean;
}
export interface JobOpts {
  state?: "queued" | "running" | "asking" | "done" | "stopped" | "cancelled";
  partial?: string | null;
  stoppedReason?: string | null;
  /** 途中の様子（bridge_job_events の progress）の字 */
  status?: string | null;
  stopRequested?: boolean;
  ageMin?: number;
}

export interface TalkHarness {
  readonly f: Fixture;
  call: (
    who: Person | null,
    method: string,
    path: string,
    o?: { body?: unknown; headers?: Record<string, string> },
  ) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  world: (label: string) => Promise<World>;
  /** チケットを DB に直に 1 件入れる。既定は A・担当者は自分・段は作業中 */
  ticket: (
    w: World,
    o?: { scope?: string; assignee?: Person; title?: string; stage?: string; completed?: boolean; deleted?: boolean },
  ) => Promise<{ id: string; number: string; title: string }>;
  /** その人の PC を 1 台つなぐ。戻り値は PC の行（sessions.id） */
  pc: (p: Person, o?: { label?: string; ageSec?: number; alive?: boolean; revoked?: boolean }) => Promise<string>;
  /** 会話を DB に直に 1 つ入れる。戻り値は会話の id */
  conversation: (w: World, owner: Person, o?: ConversationOpts) => Promise<string>;
  /** 会話の中の行を DB に直に 1 つ入れる。戻り値は行の id */
  message: (conv: string, o?: MessageOpts) => Promise<string>;
  /** 会話の仕事を DB に直に 1 つ入れる（kind は chat）。戻り値は仕事の id */
  job: (w: World, owner: Person, conv: string, o?: JobOpts) => Promise<string>;
  /** 確認項目（test_specs）を直に入れる。checked は付けた人（member＝担当者・ai） */
  spec: (
    ticketId: string,
    o?: { title?: string; checked?: "member" | "ai"; by?: Person; deleted?: boolean },
  ) => Promise<string>;
  /** 承認待ち（kind artifact・決まっていない）を 1 件入れる */
  approval: (w: World, ticketId: string, o?: { approver?: Person; runId?: string | null }) => Promise<string>;
  /** 実行（と仕事）を DB に直に入れる（チケットの仕事） */
  run: (
    w: World,
    ticketId: string,
    o?: { by?: Person; status?: "queued" | "running" | "done" | "stopped" },
  ) => Promise<{ id: string; jobId: string }>;
  /** 数を 1 つ返す SQL（列の名前は n）を、行の守りの外で流す */
  count: (sql: string, p?: unknown[]) => Promise<number>;
  /** fn の間の console の出力を貯めて返す */
  captureLogs: (fn: () => Promise<void>) => Promise<string>;
}

/** 各試験のファイルの頭で 1 回呼ぶ。files は読む hooks のファイル（拡張子なし）・ops はこの試験が 1 人で何度も叩く口（上限を上げる） */
export function setupTalk(files: string[], ops: string[] = []): TalkHarness {
  let f: Fixture;
  let loading: Promise<void> | null = null;
  const ready = (): Promise<void> =>
    (loading ??= (async () => {
      for (const file of files) {
        const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
        Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
      }
    })());

  beforeAll(async () => {
    f = await makeFixture([]);
    for (const op of ops) f.limits[op] = 100_000;
  }, 60_000);
  afterAll(async () => {
    await f?.close();
  });

  const one = async (sql: string, p: unknown[]) => (await f.admin.query<{ id: string }>(sql, p)).rows[0]!.id;
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  let seq = 0;

  const h: TalkHarness = {
    get f() {
      return f;
    },
    call: async (who, method, path, o = {}) => {
      await ready();
      return f.req(method, path, {
        ...(o.body === undefined ? {} : { body: o.body }),
        headers: { ...(who ? who.auth : {}), ...(o.headers ?? {}) },
      });
    },
    json: async (r) => (await r.json()) as Json,
    world: async (label) => {
      const c = await f.company(`${label} ${Math.random().toString(36).slice(2, 7)}`, "EG");
      const scopeA = await one(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, 'グループ A', 'GA', $2) returning id",
        [c.tenantId, c.rootScope],
      );
      const scopeB = await one(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, 'グループ B', 'GB', $2) returning id",
        [c.tenantId, c.rootScope],
      );
      const me = await f.person(c.tenantId, scopeA, { name: "高本 聖斗", ticketAbility: "edit" });
      await f.admin.query("update members set call_name = '高本' where id = $1", [me.id]);
      const other = await f.person(c.tenantId, scopeA, { name: "佐藤 花子", ticketAbility: "edit" });
      const outsider = await f.person(c.tenantId, scopeB, { name: "鈴木 一郎", ticketAbility: "edit" });
      const kindId = await one(
        "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
        [c.tenantId],
      );
      return { tenantId: c.tenantId, rootScope: c.rootScope, scopeA, scopeB, kindId, me, other, outsider };
    },
    ticket: async (w, o = {}) => {
      seq += 1;
      const title = o.title ?? `請求書を送る ${seq}`;
      const jst = new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10);
      const stage = await one("select id from ticket_stages where tenant_id = $1 and key = $2 and deleted_at is null", [
        w.tenantId,
        o.stage ?? "doing",
      ]);
      const who = (o.assignee ?? w.me).id;
      const r = await f.admin.query<{ id: string; number: string }>(
        `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, due_on, created_by, updated_by,
                              completed_at, completed_by, deleted_at)
         values ($1, $2, '', $3, $4, $5, $6, $7, $6, $6, case when $8 then now() end, case when $8 then $6 end, case when $9 then now() end)
         returning id, number`,
        [w.tenantId, o.scope ?? w.scopeA, w.kindId, stage, title, who, jst, o.completed === true, o.deleted === true],
      );
      return { id: r.rows[0]!.id, number: r.rows[0]!.number, title };
    },
    pc: async (p, o = {}) => {
      const paired = await pairMemberForTest(f.admin, p.id, o.label ?? "高本の MacBook");
      const age = o.ageSec ?? 5;
      await f.admin.query(
        `update sessions set last_seen_at = now() - make_interval(secs => $2),
                alive_at = case when $3 then now() - make_interval(secs => $2) else null end,
                revoked_at = case when $4 then now() end
          where id = $1`,
        [paired.sid, age, o.alive !== false, o.revoked === true],
      );
      return paired.sid;
    },
    conversation: async (w, owner, o = {}) => {
      const kind = o.kind ?? "clone";
      return one(
        `insert into conversations (tenant_id, scope_id, owner_member_id, title, title_auto, talk_kind, ticket_id, created_by,
                                   updated_at, closed_at, deleted_at, last_read_at)
         values ($1, $2, $3, $4, $4 is null, $5, $6, $3, $7, case when $8 then now() end, case when $9 then now() end,
                 case when $10::int is null then null else $11::timestamptz end)
         returning id`,
        [
          w.tenantId,
          w.scopeA,
          owner.id,
          o.title ?? null,
          kind,
          kind === "ticket" ? (o.ticket ?? null) : null,
          ago(o.updatedMinAgo ?? 0),
          o.closed === true,
          o.deleted === true,
          o.readMinAgo ?? null,
          o.readMinAgo == null ? null : ago(o.readMinAgo),
        ],
      );
    },
    message: async (conv, o = {}) => {
      const c = (
        await f.admin.query<{ tenant_id: string; owner_member_id: string }>(
          "select tenant_id, owner_member_id from conversations where id = $1",
          [conv],
        )
      ).rows[0]!;
      const kind = { me: "human", ai: "ai", stopped: "stopped", note: "note", proposal: "proposal", memo: "memo" }[
        o.who ?? "me"
      ];
      return one(
        `insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, options, job_id, created_at, deleted_at)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, case when $9 then now() end) returning id`,
        [
          c.tenant_id,
          conv,
          kind === "human" ? c.owner_member_id : null,
          o.text ?? (kind === "proposal" ? "" : `文 ${randomUUID().slice(0, 8)}`),
          kind,
          o.options == null ? null : JSON.stringify(o.options),
          o.jobId ?? null,
          ago(o.minAgo ?? 0),
          o.deleted === true,
        ],
      );
    },
    job: async (w, owner, conv, o = {}) => {
      const state = o.state ?? "running";
      const id = await one(
        `insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, kind, state_id, prompt, partial, stopped_reason,
                                  started_at, stop_requested_at, created_at)
         values ($1, $2, $3, $4, 'chat', $5, '（試験）', $6, $7, case when $5 = 'queued' then null else now() end,
                 case when $8 then now() end, $9) returning id`,
        [
          w.tenantId,
          w.scopeA,
          owner.id,
          conv,
          state,
          o.partial ?? null,
          o.stoppedReason ?? null,
          o.stopRequested === true,
          ago(o.ageMin ?? 1),
        ],
      );
      if (o.status) {
        await f.admin.query(
          `insert into bridge_job_events (tenant_id, member_id, job_id, kind, seq, payload) values ($1, $2, $3, 'status', 1, $4)`,
          [w.tenantId, owner.id, id, JSON.stringify({ text: o.status })],
        );
      }
      return id;
    },
    spec: async (ticketId, o = {}) => {
      const t = (
        await f.admin.query<{ tenant_id: string; assignee_member_id: string }>(
          "select tenant_id, assignee_member_id from tickets where id = $1",
          [ticketId],
        )
      ).rows[0]!;
      const who = o.by?.id ?? t.assignee_member_id;
      seq += 1;
      return one(
        `insert into test_specs (tenant_id, ticket_id, title, checked_at, checked_by_member_id, checked_by_ai, created_by, updated_by, deleted_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $7, $8, now() + make_interval(secs => $9)) returning id`,
        [
          t.tenant_id,
          ticketId,
          o.title ?? `確認 ${randomUUID().slice(0, 8)}`,
          o.checked ? new Date().toISOString() : null,
          o.checked === "member" ? who : null,
          o.checked === "ai",
          who,
          o.deleted ? new Date().toISOString() : null,
          seq,
        ],
      );
    },
    approval: async (w, ticketId, o = {}) =>
      one(
        `insert into approvals (tenant_id, scope_id, kind, ticket_id, action_run_id, approver_member_id, requested_by, status_id, irreversible, human_checks, created_by)
         values ($1, $2, 'artifact', $3, $4, $5, $6, 'pending', true, '[]'::jsonb, $6) returning id`,
        [w.tenantId, w.scopeA, ticketId, o.runId ?? null, (o.approver ?? w.me).id, w.me.id],
      ),
    run: async (w, ticketId, o = {}) => {
      const by = o.by ?? w.me;
      const status = o.status ?? "done";
      const jobId = await one(
        `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, started_at, created_at)
         values ($1, $2, $3, 'ticket', $4, '（試験）', now(), now()) returning id`,
        [w.tenantId, w.scopeA, by.id, status],
      );
      const id = await one(
        `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, created_by, created_at)
         values ($1, $2, $3, 'make', $4, $5, now(), $6, now()) returning id`,
        [w.tenantId, w.scopeA, ticketId, status, jobId, by.id],
      );
      return { id, jobId };
    },
    count: async (sql, p = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n),
    captureLogs: async (fn) => {
      const out: string[] = [];
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
        vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
      );
      try {
        await fn();
      } finally {
        for (const s of spies) s.mockRestore();
      }
      return out.join("\n");
    },
  };
  return h;
}
