// 段 6「分身の部屋：ようす・やったこと」（K-753 ようす・K-754 やったこと）の試験の共通の土台。
//   行（it）は葉ごとのファイル clone-room-now.test.ts（K-753）・clone-room-activity.test.ts（K-754）にある。K-754 は K-753 のこの土台を使う（carry）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては K-60・K-92 の土台（apps/api/test/features/fixture.ts の makeFixture）と同じ：本物の Postgres（migration を全部当てる）・本物の口の入口。
//   画面のログインだけは偽（Bearer に会社・人・役を書く）。チケット・実行・仕事・承認・PC は DB に直に入れる（行の守りの外・admin）。
//   分身の部屋の口の振る舞いは hooks のファイル apps/api/src/hooks/clone-room.ts の register（K-326）。最初の要求のときに 1 回だけ読む
//   （準備で読まない：実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py と 05_flow/screen_api.d/K-753.py・K-754.py で作る）:
//   getMyClone        GET /api/v1/clones/me           200 { data: { name, full_name, since, pc: { state: "none"|"live"|"asleep", label: string|null } } }
//   getCloneNow       GET /api/v1/clones/me/now       200 { data: { pc, current, next[], waiting_approvals, stopped } }
//   listCloneActivity GET /api/v1/clones/me/activity  200 { data: 行[], meta: { limit, cursor?, summary } }（K-754）
//   getCloneGrowth    GET /api/v1/clones/me/growth    200 { data: { assigned, pass_rate, pass_rate_last_week, work_seconds } }（K-754）
//   「自分の分身」の実行＝そのチケットの今の実行（いちばん新しい実行）を作った人（action_runs.created_by）が自分である物
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, vi } from "vitest";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { pairMemberForTest } from "../../bridge_pair.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

/** 口の振る舞いの在りか（hooks のファイル） */
const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
const FILE = "clone-room";

export type { Person };
export type Json = Record<string, unknown> & { data?: unknown; meta?: Record<string, unknown> };
export const OPS = ["getMyClone", "getCloneNow", "listCloneActivity", "getCloneGrowth"] as const;

/** 試験の会社 1 つ分。自分（me）はグループ A の席・A に tickets の edit。グループ B は自分から見えない */
export interface World {
  tenantId: string;
  rootScope: string;
  scopeA: string;
  scopeB: string;
  kindId: string;
  /** 自分（呼ぶ人）。表示の名前は「高本 聖斗」・呼ばれたい名前は「高本」 */
  me: Person;
  /** 同じグループ A の別の人 */
  other: Person;
  /** グループ B だけの人（チケットを B に置くときの担当者） */
  outsider: Person;
}

export interface RunOpts {
  phase?: "make" | "execute";
  status?: "queued" | "running" | "asking" | "done" | "stopped" | "cancelled";
  /** 実行を作った人（既定は自分） */
  by?: Person;
  /** 実行を作った時刻（「いまから n 分前」）。並びを決める */
  createdMinAgo?: number;
  /** 終わった時刻（「いまから n 分前」）。無ければ終わっていない */
  finishedMinAgo?: number | null;
  /** 終わった時刻の ISO を直に（日付の境目の試験用）。finishedMinAgo より優先 */
  finishedAt?: string;
  /** 始めた時刻（「いまから n 分前」）。既定は作った時刻 */
  startedMinAgo?: number | null;
  errorSummary?: string | null;
  stoppedReason?: string | null;
  approvalId?: string | null;
  /** 自分で直すで引き取った（K-485 の列 taken_over_at） */
  takenOver?: boolean;
  /** 途中の様子（bridge_job_events の progress）の字。古い順 */
  progress?: string[];
}
export interface RunRow {
  id: string;
  jobId: string;
}

export interface CloneHarness {
  readonly f: Fixture;
  /** 契約の口を叩く（path は /api/v1 から）。体は JSON にする */
  call: (
    who: Person | null,
    method: string,
    path: string,
    o?: { headers?: Record<string, string> },
  ) => Promise<Response>;
  json: (r: Response) => Promise<Json>;
  world: (label: string) => Promise<World>;
  /** チケットを DB に直に 1 件入れる。既定は A・担当者は自分・段は作業中 */
  ticket: (
    w: World,
    o?: { scope?: string; assignee?: Person; title?: string; stage?: string; completed?: boolean; deleted?: boolean },
  ) => Promise<{ id: string; number: string; title: string }>;
  /** 実行（と仕事）を DB に直に入れる */
  run: (w: World, ticketId: string, o?: RunOpts) => Promise<RunRow>;
  /** その人の PC を 1 台つなぐ。ageSec は最後の知らせが何秒前か・alive は最初の知らせが届いたか・revoked は外したか */
  pc: (p: Person, o?: { label?: string; ageSec?: number; alive?: boolean; revoked?: boolean }) => Promise<string>;
  /** 承認待ち（kind artifact・決まっていない）を 1 件入れる。承認する人は担当者（既定は自分） */
  approval: (w: World, ticketId: string, o?: { approver?: Person; runId?: string | null }) => Promise<string>;
  /** 確認項目（test_specs）を直に入れる。checked は付けた人（member＝自分・ai）。K-434 の列を使う */
  spec: (
    ticketId: string,
    o?: { title?: string; checked?: "member" | "ai"; by?: Person; deleted?: boolean },
  ) => Promise<string>;
  /** 数を 1 つ返す SQL（列の名前は n）を、行の守りの外で流す */
  count: (sql: string, p?: unknown[]) => Promise<number>;
  /** fn の間の console の出力を貯めて返す */
  captureLogs: (fn: () => Promise<void>) => Promise<string>;
}

/** 各試験のファイルの頭で 1 回呼ぶ */
export function setupCloneRoom(): CloneHarness {
  let f: Fixture;
  let loading: Promise<void> | null = null;
  /** 分身の部屋の口の振る舞いを読み込む（h.call の頭で 1 回だけ。会社・人・チケットの準備には使わない） */
  const ready = (): Promise<void> =>
    (loading ??= (async () => {
      const m = (await import(join(HOOKS_DIR, `${FILE}.ts`))) as { register: HookModule };
      // 分身の部屋の口が使う材料は appPool だけ
      Object.assign(f.hooks, m.register.make({ appPool: f.pool } as unknown as HookDeps));
    })());

  beforeAll(async () => {
    f = await makeFixture([]);
    for (const op of OPS) f.limits[op] = 100_000;
  }, 60_000);
  afterAll(async () => {
    await f?.close();
  });

  const one = async (sql: string, p: unknown[]) => (await f.admin.query<{ id: string }>(sql, p)).rows[0]!.id;
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  let seq = 0;

  const h: CloneHarness = {
    get f() {
      return f;
    },
    call: async (who, method, path, o = {}) => {
      await ready();
      return f.req(method, path, { headers: { ...(who ? who.auth : {}), ...(o.headers ?? {}) } });
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
    run: async (w, ticketId, o = {}) => {
      const by = o.by ?? w.me;
      const created = ago(o.createdMinAgo ?? 1);
      const status = o.status ?? "done";
      const finished =
        o.finishedAt ??
        (o.finishedMinAgo === null || ["queued", "running", "asking"].includes(status)
          ? null
          : ago(o.finishedMinAgo ?? 0));
      const started = ["queued"].includes(status) ? null : ago(o.startedMinAgo ?? o.createdMinAgo ?? 1);
      const jobId = await one(
        `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, started_at, finished_at, stopped_reason, created_at)
         values ($1, $2, $3, 'ticket', $4, '（試験）', $5, $6, $7, $8) returning id`,
        [w.tenantId, w.scopeA, by.id, status, started, finished, o.stoppedReason ?? null, created],
      );
      const id = await one(
        `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, finished_at, created_by, error_summary,
                                  approval_id, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
        [
          w.tenantId,
          w.scopeA,
          ticketId,
          o.phase ?? "make",
          status,
          jobId,
          started,
          finished,
          by.id,
          o.errorSummary ?? null,
          o.approvalId ?? null,
          created,
        ],
      );
      if (o.takenOver) await f.admin.query("update action_runs set taken_over_at = now() where id = $1", [id]);
      let n = 0;
      for (const text of o.progress ?? []) {
        n += 1;
        await f.admin.query(
          `insert into bridge_job_events (tenant_id, member_id, job_id, kind, seq, payload, created_at)
           values ($1, $2, $3, 'progress', $4, $5, now() + make_interval(secs => $4))`,
          [w.tenantId, by.id, jobId, n, JSON.stringify({ text })],
        );
      }
      return { id, jobId };
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
    approval: async (w, ticketId, o = {}) =>
      one(
        `insert into approvals (tenant_id, scope_id, kind, ticket_id, action_run_id, approver_member_id, requested_by, status_id, irreversible, human_checks, created_by)
         values ($1, $2, 'artifact', $3, $4, $5, $6, 'pending', true, '[]'::jsonb, $6) returning id`,
        [w.tenantId, w.scopeA, ticketId, o.runId ?? null, (o.approver ?? w.me).id, w.me.id],
      ),
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
