// K-779「試し打ちの片付け：待っている試し打ちを、承認・差し戻し・止める・取り下げが起きたとき／24 時間を過ぎたときに止める」の単体の試験（口・DB の引き金と関数・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K779-API-…・K779-DB-…）は 11_tickets/K-779.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts と K-732 が持ち込む F5/approval-more.kit.ts。
//   試し打ちを始める口・結末の書き方は K-746（dry-run.test.ts）。この葉は「待っている（queued）試し打ち」が、承認が決まった後や古くなった後に PC に取られないようにする。
//   動いている（running）試し打ちは止めない（すでに PC が動かしている・K746-API-016）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の列をずらして置く。
import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant, type TenantContext } from "@kaname/db/context";
import {
  setupApproveComplete,
  f,
  T,
  boss,
  json,
  req,
  auth,
  approve,
  giveBack,
  take,
  finish,
  lastSeen,
  stageKeyOf,
  ticket,
  delegated,
  approvalRow,
  runsOf,
  jobOf,
  messagesOf,
  type Ticket,
  type Delegated,
} from "./approve-complete.harness.js";
import { loadHook, stopApproval } from "./approval-more.kit.js";
import type { Person } from "../fixture.js";

setupApproveComplete();

const WHY_DECIDED = "承認が決まったので、待っていた試し打ちを止めました";
const WHY_OLD = "待っている間に 24 時間を過ぎたので、試し打ちを止めました";
const giveEmail = async (p: Person, email: string) => {
  const uid = randomUUID();
  await f.admin.query(
    'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
    [uid, "K779 の人", email],
  );
  await f.admin.query("update members set auth_user_id = $2 where id = $1", [p.id, uid]);
};
beforeAll(async () => {
  await giveEmail(boss, "takamoto-k779@example.com");
}, 60_000);

/** 承認待ちの成果物があるチケットで、試し打ちを 1 つ積む（待ち） */
async function waiting(): Promise<{ t: Ticket; d: Delegated; run: string; job: string }> {
  const t = await ticket();
  const d = await delegated(t);
  await loadHook("dry-run", "dryRunTicket");
  const r = await req("POST", `/tickets/${t.id}/dry-run`, { body: {}, headers: auth(boss) });
  expect(r.status, await r.clone().text()).toBe(201);
  const v = (await json(r)).data as unknown as { run_id: string; job_id: string };
  return { t, d, run: v.run_id, job: v.job_id };
}
const dryRuns = (t: Ticket) => runsOf(t.id, "dry_run");
const lines = async (t: Ticket, w: string) => (await messagesOf(t.id)).filter((m) => m.body.includes(w));
const stoppedWaiting = async (w: Awaited<ReturnType<typeof waiting>>) => {
  expect((await dryRuns(w.t))[0]).toMatchObject({ status_id: "stopped", error_summary: WHY_DECIDED });
  expect(await jobOf(w.job)).toMatchObject({ state_id: "stopped", stopped_reason: WHY_DECIDED });
  expect(await lines(w.t, `試し打ちが止まりました：${WHY_DECIDED}`)).toHaveLength(1);
};

describe("K-779 待っている試し打ちの片付け", () => {
  it("K779-API-001 承認が決まったら止める：承認する・差し戻す・止める（承認待ちを止める K-732）のどれでも、待っている（PC がまだ取っていない）試し打ちは止まり（実行・仕事・理由の文・やり取り 1 行）、PC が取りに来ても渡らない（取れるのは承認の後の実行・作り直しだけ）", async () => {
    const a = await waiting();
    expect((await approve(boss, a.d.approvalId)).status).toBe(201);
    await stoppedWaiting(a);
    await lastSeen(a.d.pc.sid, 1);
    const job = await take(a.d.pc);
    expect(job?.["phase"]).toBe("execute");
    expect(job?.id).not.toBe(a.job);
    const b = await waiting();
    expect((await giveBack(boss, b.d.approvalId, "宛先が違います")).status).toBe(201);
    await stoppedWaiting(b);
    const c = await waiting();
    expect((await stopApproval(boss, c.d.approvalId)).status).toBe(201);
    await stoppedWaiting(c);
  });

  it("K779-API-002 動いている試し打ちは止めない：PC が取って動かしている間に承認しても、試し打ちは動いたまま（実行・仕事とも）で、結果が届けば前のとおり done になる。承認の後の実行は別に積まれる", async () => {
    const a = await waiting();
    await lastSeen(a.d.pc.sid, 1);
    expect((await take(a.d.pc))?.id).toBe(a.job);
    expect((await approve(boss, a.d.approvalId)).status).toBe(201);
    expect((await dryRuns(a.t))[0]).toMatchObject({ status_id: "running" });
    expect(await jobOf(a.job)).toMatchObject({ state_id: "running" });
    expect((await runsOf(a.t.id, "execute")).length).toBe(1);
    await finish(a.d.pc, a.job, { state: "done", result: "届いた", agent_session_id: null });
    expect((await dryRuns(a.t))[0]).toMatchObject({ status_id: "done" });
  });

  it("K779-API-003 24 時間を過ぎた待ちの試し打ち：PC が取りに来る前の片付けで、待ってから 24 時間を過ぎた試し打ちは実行・仕事とも stopped（理由は決めた文・やり取りに 1 行）になり、取っても null で渡らない。23 時間の物は取れる。動いている試し打ちは古くても running のまま。承認の行・段は変わらない", async () => {
    const old = await waiting();
    const fresh = await waiting();
    await f.admin.query("update bridge_jobs set created_at = now() - interval '25 hours' where id = $1", [old.job]);
    await f.admin.query("update action_runs set created_at = now() - interval '25 hours' where id = $1", [old.run]);
    await f.admin.query("update bridge_jobs set created_at = now() - interval '23 hours' where id = $1", [fresh.job]);
    // 動いている古い試し打ち
    const run = await waiting();
    await lastSeen(run.d.pc.sid, 1);
    await f.admin.query("update bridge_jobs set created_at = now() - interval '25 hours' where id = $1", [run.job]);
    // PC を別々に取る（試験ごとに別の任せた人の PC）
    await lastSeen(old.d.pc.sid, 1);
    expect(await take(old.d.pc)).toBeNull(); // 止められて何も渡らない
    expect((await dryRuns(old.t))[0]).toMatchObject({ status_id: "stopped", error_summary: WHY_OLD });
    expect(await jobOf(old.job)).toMatchObject({ state_id: "stopped", stopped_reason: WHY_OLD });
    expect(await lines(old.t, `試し打ちが止まりました：${WHY_OLD}`)).toHaveLength(1);
    expect(await approvalRow(old.d.approvalId)).toMatchObject({ decision: null });
    expect(await stageKeyOf(old.t.id)).toBe("awaiting_approval");
    await lastSeen(fresh.d.pc.sid, 1);
    expect((await take(fresh.d.pc))?.id).toBe(fresh.job);
    await lastSeen(run.d.pc.sid, 1);
    expect((await take(run.d.pc))?.id).toBe(run.job); // 古い物も取れて動く（まだ止まっていない）
    await f.admin.query("update bridge_jobs set created_at = now() - interval '30 hours' where id = $1", [run.job]);
    await lastSeen(run.d.pc.sid, 1);
    await take(run.d.pc);
    expect((await dryRuns(run.t))[0]).toMatchObject({ status_id: "running" });
  });

  it("K779-API-004 別の人の PC では片付けない：app.dry_run_expire は呼んだ人の PC の印でなければ 0 を返し何も変えない（古い試し打ちも止まったまま残らず・渡るまま）", async () => {
    const a = await waiting();
    await f.admin.query("update bridge_jobs set created_at = now() - interval '25 hours' where id = $1", [a.job]);
    const ctx: TenantContext = { tenantId: T.tenantId, userId: boss.id, role: "member", stepUpAt: null };
    const n = await withTenant(f.pool, ctx, async (cl) =>
      Number((await cl.query<{ n: number }>("select app.dry_run_expire($1) as n", [a.d.pc.sid])).rows[0]!.n),
    );
    expect(n).toBe(0); // その PC は任せた人の物で、呼んだ人（boss）の物ではない
    expect(await jobOf(a.job)).toMatchObject({ state_id: "queued" });
    expect((await dryRuns(a.t))[0]).toMatchObject({ status_id: "queued" });
  });

  it("K779-API-005 S1 の失敗・止める所が落ちても承認は通る：待っている試し打ちを止める書き込みが落ちると、警告だけを出して承認は決まり（201）、試し打ちは待ちのまま残る（次の片付けで止まる）。承認の取引を巻き込まない", async () => {
    const a = await waiting();
    const fn = `k779_fail_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    await f.admin.query(
      `create function ${fn}() returns trigger language plpgsql as $$ begin raise exception 'k779 わざと落とす' using errcode = 'XX000'; end $$`,
    );
    await f.admin.query(
      `create trigger ${fn} before update on bridge_jobs for each row when (old.state_id = 'queued' and new.state_id = 'stopped' and old.id = '${a.job}'::uuid) execute function ${fn}()`,
    );
    try {
      const r = await approve(boss, a.d.approvalId);
      expect(r.status, await r.clone().text()).toBe(201);
    } finally {
      await f.admin.query(`drop trigger if exists ${fn} on bridge_jobs`);
      await f.admin.query(`drop function if exists ${fn}()`);
    }
    expect(await approvalRow(a.d.approvalId)).toMatchObject({ decision: "approve" });
    expect(await jobOf(a.job)).toMatchObject({ state_id: "queued" });
    // 次の片付け（PC が取りに来る前）では、古くなっていれば止まる（24 時間）
    await f.admin.query("update bridge_jobs set created_at = now() - interval '25 hours' where id = $1", [a.job]);
    await lastSeen(a.d.pc.sid, 1);
    await take(a.d.pc);
    expect(await jobOf(a.job)).toMatchObject({ state_id: "stopped" });
  });

  it("K779-DB-001 DB の形：app.dry_run_expire は kaname_app が実行できる。app.dry_run_stop_waiting は誰にも渡さない（中だけで使う）。引き金 approvals_dry_run_stop は承認の行の決めと取り下げの印に 1 つ", async () => {
    const acl = await f.admin.query<{ name: string; app: boolean; pub: boolean }>(
      `select p.proname as name, has_function_privilege('kaname_app', p.oid, 'execute') as app, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('dry_run_expire', 'dry_run_stop_waiting') order by 1`,
    );
    expect(acl.rows).toEqual([
      { name: "dry_run_expire", app: true, pub: false },
      { name: "dry_run_stop_waiting", app: false, pub: false },
    ]);
    expect(
      Number(
        (
          await f.admin.query<{ n: string }>(
            "select count(*) as n from pg_trigger where tgname = 'approvals_dry_run_stop' and not tgisinternal",
          )
        ).rows[0]!.n,
      ),
    ).toBe(1);
  });
});
