// K-744「差し戻しの「次は誰が直すか」（returnApproval に next_actor：AI／自分。自分なら作り直しの仕事を積まず作業中に戻す）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K744-API-…）は 11_tickets/K-744.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts と K-732 が持ち込む F5/approval-more.kit.ts。
// 口：POST /api/v1/approvals/:id/return ← { note, next_actor?: "clone" | "self" }（既定は clone＝今までどおり AI が作り直す）。
//   → 201 { data: { id, decision: "return", decided_at, status_id: "returned", ticket_id, run_id: 作り直しの実行 | null（self のとき）, pc } }。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  setupApproveComplete,
  CONF_DONE,
  VAL_REASON_EMPTY,
  f,
  T,
  boss,
  writer,
  manager,
  outsider,
  json,
  one,
  num,
  req,
  auth,
  take,
  lastSeen,
  stageKeyOf,
  ticket,
  delegated,
  approvalRow,
  runsOf,
  messagesOf,
  snapshot,
  breakWritable,
} from "./approve-complete.harness.js";
import { returnTo } from "./approval-more.kit.js";

setupApproveComplete();

const REASON = "宛名を「株式会社サンプル 経理部」にしてください";
const SELF_LINE = "が差し戻しました（直すのは自分）：";
const flag = async (t: string) =>
  (await one<{ d: boolean }>("select delegated_to_clone as d from tickets where id = $1", [t])).d;
const lineOf = async (t: string) => (await messagesOf(t)).filter((m) => m.body.includes("が差し戻しました"));
const notices = () => num("select count(*) as n from notifications where tenant_id = $1", [T.tenantId]);
const code = async (r: Response) => (await json(r))["code"];
const back = (p: typeof boss, id: string, note: unknown, next?: unknown) =>
  returnTo(p, id, next === undefined ? { note } : { note, next_actor: next });

describe("K-744 差し戻し：次は誰が直すか（状態 × 入口 × 利用者の状態）", () => {
  it("K744-API-001 次を言わない（既定）× 差し戻す × 承認する人：今までどおり AI が直す。承認の行は return・next_actor clone・理由つき、作り直しの仕事と実行（make・queued）が積まれ、段は実行中・旗は立つ。やり取りの行に「（直すのは自分）」は付かない。答えの run_id は文字", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const r = await back(boss, d.approvalId, REASON);
    expect(r.status, await r.clone().text()).toBe(201);
    const v = (await json(r)).data as Record<string, unknown>;
    expect(Object.keys(v).sort()).toEqual(["decided_at", "decision", "id", "pc", "run_id", "status_id", "ticket_id"]);
    expect(v).toMatchObject({ id: d.approvalId, decision: "return", status_id: "returned", ticket_id: t.id });
    expect(typeof v["run_id"]).toBe("string");
    expect(await approvalRow(d.approvalId)).toMatchObject({
      decision: "return",
      next_actor: "clone",
      return_reason: REASON,
    });
    expect((await runsOf(t.id, "make")).at(-1)).toMatchObject({ status_id: "queued" });
    expect(await stageKeyOf(t.id)).toBe("running");
    expect(await flag(t.id)).toBe(true);
    const l = await lineOf(t.id);
    expect(l).toHaveLength(1);
    expect(l[0]!.body).toContain(`が差し戻しました：${REASON}`);
    expect(l[0]!.body).not.toContain("直すのは自分");
  });

  it("K744-API-002 next_actor を clone と明示した差し戻し：001 と同じ結果（AI が直す）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const r = await back(boss, d.approvalId, REASON, "clone");
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: "return", next_actor: "clone" });
    expect((await runsOf(t.id, "make")).at(-1)).toMatchObject({ status_id: "queued" });
    expect(await stageKeyOf(t.id)).toBe("running");
  });

  it("K744-API-003 next_actor が self（直すのは自分）：201。承認の行は return・next_actor self・理由つき。作り直しの仕事も実行も積まず、段は作業中・旗は下り、成果物の版は残る。やり取りに「（直すのは自分）：理由」が 1 行。答えの run_id は null。お知らせは出さない。一覧から消える", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const before = {
      runs: await num("select count(*) as n from action_runs where ticket_id = $1", [t.id]),
      jobs: await num(
        "select count(*) as n from bridge_jobs j join action_runs r on r.bridge_job_id = j.id where r.ticket_id = $1",
        [t.id],
      ),
      n: await notices(),
    };
    const r = await back(boss, d.approvalId, REASON, "self");
    expect(r.status, await r.clone().text()).toBe(201);
    const v = (await json(r)).data as Record<string, unknown>;
    expect(v).toMatchObject({
      id: d.approvalId,
      decision: "return",
      status_id: "returned",
      ticket_id: t.id,
      run_id: null,
    });
    expect(Object.keys(v).sort()).toEqual(["decided_at", "decision", "id", "pc", "run_id", "status_id", "ticket_id"]);
    expect(await approvalRow(d.approvalId)).toMatchObject({
      decision: "return",
      next_actor: "self",
      return_reason: REASON,
    });
    expect(await num("select count(*) as n from action_runs where ticket_id = $1", [t.id])).toBe(before.runs);
    expect(
      await num(
        "select count(*) as n from bridge_jobs j join action_runs r on r.bridge_job_id = j.id where r.ticket_id = $1",
        [t.id],
      ),
    ).toBe(before.jobs);
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(await flag(t.id)).toBe(false);
    const l = await lineOf(t.id);
    expect(l).toHaveLength(1);
    expect(l[0]!.body).toContain(`高本${SELF_LINE}${REASON}`);
    expect(await notices()).toBe(before.n);
    const q = (await json(await req("GET", "/approvals/queue", { headers: auth(boss) }))).data as { id: string }[];
    expect(q.map((x) => x.id)).not.toContain(d.approvalId);
    expect(
      await num(
        "select count(*) as n from audit_events where action = 'approval.return' and target_id = $1 and payload->>'next_actor' = 'self'",
        [d.approvalId],
      ),
    ).toBe(1);
  });

  it("K744-API-004 自分で直すと差し戻した後：PC が取りに来ても渡る仕事は無い（PC が閉じていても影響しない）。もう一度「AI に任せる」は押せて、新しい実行が積まれる", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await back(boss, d.approvalId, REASON, "self")).status).toBe(201);
    await lastSeen(d.pc.sid, 1);
    expect(await take(d.pc)).toBeNull();
    const again = await req("POST", `/tickets/${t.id}/delegate`, { body: {}, headers: auth(boss) });
    expect(again.status, await again.clone().text()).toBe(201);
    expect(await flag(t.id)).toBe(true);
    expect(await stageKeyOf(t.id)).toBe("running");
  });

  it("K744-API-005 入力の形：next_actor が clone・self 以外（ai・空・数・null）・知らない項目：422・何も変わらない。理由が空・空白だけは self でも 422・E-VAL-020（何も変わらない）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const before = await snapshot(t);
    for (const next of ["ai", "", 1, null, "SELF"]) {
      const r = await back(boss, d.approvalId, REASON, next);
      expect(r.status, JSON.stringify(next)).toBe(422);
    }
    expect((await returnTo(boss, d.approvalId, { note: REASON, next_actor: "self", extra: 1 })).status).toBe(422);
    for (const note of ["", "   ", "　\n"]) {
      const r = await back(boss, d.approvalId, note, "self");
      expect(r.status).toBe(422);
      expect(await code(r)).toBe(VAL_REASON_EMPTY);
    }
    expect(await snapshot(t)).toEqual(before);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
  });

  it("K744-API-006 承認する人でない人（書ける人・任せた人・マネージャー）：403・別の会社の人・無い id：404（next_actor が self でも同じ）。何も変わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const before = await snapshot(t);
    for (const p of [writer, d.by, manager]) expect((await back(p, d.approvalId, REASON, "self")).status).toBe(403);
    expect((await back(outsider, d.approvalId, REASON, "self")).status).toBe(404);
    expect((await back(boss, randomUUID(), REASON, "self")).status).toBe(404);
    expect(await snapshot(t)).toEqual(before);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
  });

  it("K744-API-007 もう決まった承認（承認済み・差し戻し済み）に self で差し戻す：409・E-CONF-003。何も変わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await back(boss, d.approvalId, REASON, "self")).status).toBe(201);
    const second = await back(boss, d.approvalId, REASON, "self");
    expect(second.status).toBe(409);
    expect(await code(second)).toBe(CONF_DONE);
    const approved = await delegated(await ticket());
    expect(
      (await req("POST", `/approvals/${approved.approvalId}/approve`, { body: {}, headers: auth(boss) })).status,
    ).toBe(201);
    expect((await back(boss, approved.approvalId, REASON, "self")).status).toBe(409);
    expect(await lineOf(t.id)).toHaveLength(1);
  });

  it("K744-API-008 二度押し・別のタブで AI と自分が同時：1 つだけが決まる（もう片方は 409）。決まった形（実行が積まれたか・段・旗）が next_actor と食い違わない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const [a, s] = await Promise.all([
      back(boss, d.approvalId, REASON, "clone"),
      back(boss, d.approvalId, REASON, "self"),
    ]);
    expect([a.status, s.status].sort()).toEqual([201, 409]);
    const row = await approvalRow(d.approvalId);
    const made = await num(
      "select count(*) as n from action_runs where ticket_id = $1 and phase = 'make' and status_id = 'queued'",
      [t.id],
    );
    if (a.status === 201) {
      expect(row).toMatchObject({ next_actor: "clone" });
      expect(made).toBe(1);
      expect(await stageKeyOf(t.id)).toBe("running");
    } else {
      expect(row).toMatchObject({ next_actor: "self" });
      expect(made).toBe(0);
      expect(await stageKeyOf(t.id)).toBe("doing");
    }
    expect(await lineOf(t.id)).toHaveLength(1);
  });

  it("K744-API-009 手順「DB に書く」が失敗（関数が使えない・next_actor が self でも clone でも）：503・E-PAGE-003。承認の行・実行・段・旗・やり取りは変わらない", async () => {
    for (const next of ["self", "clone"] as const) {
      const t = await ticket();
      const d = await delegated(t);
      const before = await snapshot(t);
      await f.admin.query("revoke execute on function app.approval_decide(uuid, text, text, text) from kaname_app");
      try {
        const r = await back(boss, d.approvalId, REASON, next);
        expect(r.status, next).toBe(503);
        expect(await code(r), next).toBe("E-PAGE-003");
      } finally {
        await f.admin.query("grant execute on function app.approval_decide(uuid, text, text, text) to kaname_app");
      }
      expect(await snapshot(t), next).toEqual(before);
      expect(await approvalRow(d.approvalId), next).toMatchObject({ decision: null });
    }
  });

  it("K744-API-010 手順「証跡」が失敗（証跡の書き込みが例外・self）：503・E-PAGE-003。同じ取引なので承認の行も段も切り替わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    await f.admin.query(
      `create or replace function public.k744_fail_audit() returns trigger language plpgsql as $$
       begin if new.action = 'approval.return' then raise exception 'K-744 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await f.admin.query(
      "create trigger k744_fail_audit before insert on audit_events for each row execute function public.k744_fail_audit()",
    );
    try {
      const r = await back(boss, d.approvalId, REASON, "self");
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("drop trigger if exists k744_fail_audit on audit_events");
      await f.admin.query("drop function if exists public.k744_fail_audit()");
    }
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await lineOf(t.id)).toHaveLength(0);
  });

  it("K744-API-011 守りの判定で例外（書けるかの判定が壊れた）：503・何も書かない。DB の関数の形：引数 4 つだけで kaname_app だけに渡り（3 つの古い形は無い）、知らない next を直に渡すと { error: bad_next }", async () => {
    const t = await ticket({ title: "K744 の守りを壊す" });
    const d = await delegated(t);
    await breakWritable("K744 の守りを壊す", async () => {
      const r = await back(boss, d.approvalId, REASON, "self");
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    });
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
    const fns = (
      await f.admin.query<{ args: string; definer: boolean; pub: boolean; app: boolean }>(
        `select pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as definer,
                has_function_privilege('public', p.oid, 'execute') as pub, has_function_privilege('kaname_app', p.oid, 'execute') as app
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'approval_decide'`,
      )
    ).rows;
    expect(fns).toHaveLength(1);
    expect(fns[0]!.args).toMatch(/^p_approval uuid, p_decision text, p_reason text, p_next text/);
    expect(fns[0]).toMatchObject({ definer: true, pub: false, app: true });
    const c = await f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [T.tenantId, boss.id],
      );
      const v = (
        await c.query<{ v: Record<string, unknown> }>("select app.approval_decide($1, 'return', $2, 'ai') as v", [
          d.approvalId,
          REASON,
        ])
      ).rows[0]!.v;
      expect(v).toMatchObject({ error: "bad_next" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
  });
});
