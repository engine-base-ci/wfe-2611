// K-236「速さ：読む口の片付け（ticket_execute_sweep）を 1 本の文にする」の単体の試験（口・本物の DB・偽の画面のログイン）。
//   行 ID（K236-API-…）は 11_tickets/K-236.md の表と 1 対 1。土台は承認して完了する（K-63 の孫）の試験の土台をそのまま使う（読むだけ）。
//   片付けの振る舞い（24 時間・消された・失敗したら飛ばす）は今と同じであることも、ここで一緒に見る。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { beforeAll, describe, expect, it, vi } from "vitest";
import type pg from "pg";
import {
  setupApproveComplete,
  STOP_GONE,
  STOP_24H,
  f,
  O,
  boss,
  outsider,
  auth,
  req,
  queue,
  detail,
  ticket,
  approved,
  jobOf,
  openApprovals,
  one,
} from "./features/F5/approve-complete.harness.js";

setupApproveComplete();

// ---------------------------------------------------------------- 数える（接続を取る所を包み、その接続の query を記録する）
const hits: string[] = [];
function tap(pool: pg.Pool): void {
  const orig = pool.connect.bind(pool) as unknown as (cb?: unknown) => unknown;
  const wrap = (cl: pg.PoolClient): pg.PoolClient => {
    const c = cl as pg.PoolClient & { __k236?: boolean };
    if (!c.__k236) {
      const q = c.query.bind(c) as (...a: unknown[]) => unknown;
      (c as unknown as { query: (...a: unknown[]) => unknown }).query = (...a: unknown[]) => {
        const t = a[0];
        hits.push(typeof t === "string" ? t : String((t as { text?: string } | null)?.text ?? ""));
        return q(...a);
      };
      c.__k236 = true;
    }
    return cl;
  };
  (
    pool as unknown as { connect: (cb?: (e: Error | undefined, c?: pg.PoolClient, d?: unknown) => void) => unknown }
  ).connect = (cb) =>
    cb
      ? orig((e: Error | undefined, c?: pg.PoolClient, d?: unknown) => cb(e, c ? wrap(c) : c, d))
      : (orig() as Promise<pg.PoolClient>).then(wrap);
}
async function counted(fn: () => Promise<Response>): Promise<{ res: Response; sql: string[] }> {
  hits.length = 0;
  const res = await fn();
  return { res, sql: [...hits] };
}
const sweepCalls = (sql: string[]) => sql.filter((s) => /ticket_execute_sweep/.test(s));
const savepoints = (sql: string[]) => sql.filter((s) => /\bsavepoint\b/i.test(s));
const ticketGet = (id: string) => req("GET", `/tickets/${id}`, { headers: auth(boss) });
const over24h = (approvalId: string) =>
  f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [approvalId]);

beforeAll(() => {
  tap(f.pool);
});

describe("K-236 片付けは 1 本の文（数）", () => {
  it("K236-API-001 GET /tickets/:id：200・片付けの文は app.ticket_execute_sweep_read の 1 本・savepoint の文 0 本", async () => {
    const t = await ticket();
    const { res, sql } = await counted(() => ticketGet(t.id));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(sweepCalls(sql), sql.join("\n")).toHaveLength(1);
    expect(sweepCalls(sql)[0]).toMatch(/app\.ticket_execute_sweep_read\(/);
    expect(savepoints(sql), sql.join("\n")).toHaveLength(0);
  });

  it("K236-API-002 GET /approvals/queue：200・片付けの文は 1 本・savepoint の文 0 本", async () => {
    const { res, sql } = await counted(() => queue(boss));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(sweepCalls(sql), sql.join("\n")).toHaveLength(1);
    expect(sweepCalls(sql)[0]).toMatch(/app\.ticket_execute_sweep_read\(/);
    expect(savepoints(sql), sql.join("\n")).toHaveLength(0);
  });

  it("K236-API-003 GET /approvals/:id：200・片付けの文は 1 本・savepoint の文 0 本", async () => {
    const t = await ticket();
    const a = await approved(t);
    const { res, sql } = await counted(() => detail(boss, a.approvalId));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(sweepCalls(sql), sql.join("\n")).toHaveLength(1);
    expect(sweepCalls(sql)[0]).toMatch(/app\.ticket_execute_sweep_read\(/);
    expect(savepoints(sql), sql.join("\n")).toHaveLength(0);
  });
});

describe("K-236 片付けの振る舞いは今のまま", () => {
  it("K236-API-004 承認から 24 時間を過ぎた仕事：GET /tickets/:id で止まり（理由は 24 時間の文）・聞き直しの承認待ちが 1 つできる", async () => {
    const t = await ticket();
    const a = await approved(t);
    await over24h(a.approvalId);
    const r = await ticketGet(t.id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_24H });
    expect(await openApprovals(t.id)).toBe(1);
  });

  it("K236-API-005 チケットが消された仕事：GET /approvals/queue で止まる（理由は消された文）", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t.id]);
    const r = await queue(boss);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_GONE });
  });

  it("K236-API-006 何度読んでも同じ：24 時間を過ぎた後に GET /tickets/:id を 2 回・聞き直しの承認待ちは 1 つのまま", async () => {
    const t = await ticket();
    const a = await approved(t);
    await over24h(a.approvalId);
    expect((await ticketGet(t.id)).status).toBe(200);
    expect((await ticketGet(t.id)).status).toBe(200);
    expect(await openApprovals(t.id)).toBe(1);
  });

  /** 中の片付けの関数（ticket_execute_sweep・_mine）を、この試験の中だけ raise に作り替えて 3 つの読む口を開く（K63-API-085 と同じやり方） */
  async function readWithBrokenSweep(raise: string) {
    const t = await ticket();
    const a = await approved(t);
    await over24h(a.approvalId);
    const sigs = ["app.ticket_execute_sweep(uuid)", "app.ticket_execute_sweep_mine()"];
    const origs: string[] = [];
    for (const sig of sigs) {
      const d = await one<{ def: string | null }>("select pg_get_functiondef(to_regprocedure($1)) as def", [sig]);
      expect(d.def, sig).toBeTruthy();
      origs.push(d.def!);
    }
    const broken = (def: string) =>
      def
        .replace(/\n LANGUAGE \w+/, "\n LANGUAGE plpgsql")
        .replace(/AS \$(\w*)\$[\s\S]*\$\1\$\s*$/, () => `AS $k236$ begin ${raise}; end $k236$`);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const def of origs) await f.admin.query(broken(def));
    try {
      expect((await ticketGet(t.id)).status).toBe(200);
      expect((await queue(boss)).status).toBe(200);
      expect((await detail(boss, a.approvalId)).status).toBe(200);
      expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "queued" });
      expect(await openApprovals(t.id)).toBe(0);
      const lines = log.mock.calls.map((c) => String(c[0]));
      expect(lines.filter((l) => /片付け/.test(l) && /飛ばした/.test(l)).length).toBeGreaterThanOrEqual(3);
    } finally {
      for (const def of origs) await f.admin.query(def);
      log.mockRestore();
    }
  }

  it("K236-API-007 片付けが例外：詳細・一覧・1 件は 200 で読めたものを返す・仕事は待ったまま・飛ばしたことを記録に出す", async () => {
    await readWithBrokenSweep("raise exception 'K236 の試験で片付けを壊した'");
  });

  it("K236-API-008 別の会社の人が GET /tickets/:id：404・こちらの会社の 24 時間を過ぎた仕事は待ったまま", async () => {
    const t = await ticket();
    const a = await approved(t);
    await over24h(a.approvalId);
    const r = await req("GET", `/tickets/${t.id}`, { headers: auth(outsider) });
    expect(r.status).toBe(404);
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "queued" });
    expect(O.tenantId).not.toBe(t.tenant);
  });

  it("K236-API-009 片付けの関数は kaname_app だけが呼べる（public は呼べない）・呼んだ人の権限で動く（security invoker）", async () => {
    const r = await one<{ app: boolean; pub: boolean }>(
      `select has_function_privilege('kaname_app', 'app.ticket_execute_sweep_read(text, uuid)', 'execute') as app,
              exists (select 1 from information_schema.routine_privileges
                       where routine_schema = 'app' and routine_name = 'ticket_execute_sweep_read' and grantee = 'PUBLIC') as pub`,
    );
    expect(r.app).toBe(true);
    expect(r.pub).toBe(false);
    // 包む関数は呼んだ人の権限で動く（security invoker）。承認の行の守り（approvals の RLS）が今と同じく効く
    const d = await one<{ definer: boolean }>(
      "select prosecdef as definer from pg_proc where oid = to_regprocedure('app.ticket_execute_sweep_read(text, uuid)')",
    );
    expect(d.definer).toBe(false);
  });

  it("K236-API-010 片付けが時間切れ・取り消し（query_canceled）で落ちる：詳細・一覧・1 件は 200・仕事は待ったまま・飛ばしたことを記録に出す", async () => {
    await readWithBrokenSweep(
      "raise exception using errcode = 'query_canceled', message = 'K236 の試験で時間切れにした'",
    );
  });
});
