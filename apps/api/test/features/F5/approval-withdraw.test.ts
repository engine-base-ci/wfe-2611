// K-733「承認を取り下げる（withdrawApproval：承認した後・PC が仕事を受け取る前だけ・承認待ちに戻す）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K733-API-…）は 11_tickets/K-733.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts と K-732 が持ち込む F5/approval-more.kit.ts。
// 口：POST /api/v1/approvals/:id/withdraw（体は空）→ 201 { data: { id, withdrawn_at, ticket_id, approval_id } }（approval_id は新しく承認待ちに戻った行）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の列をずらして置く。
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  setupApproveComplete,
  CONF_DONE,
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
  approve,
  giveBack,
  take,
  finish,
  lastSeen,
  stageKeyOf,
  ticket,
  delegated,
  approved,
  approvalRow,
  runsOf,
  jobOf,
  messagesOf,
  snapshot,
  team,
  breakWritable,
  type Ticket,
} from "./approve-complete.harness.js";
import { loadHook, stopApproval, withdrawApproval } from "./approval-more.kit.js";

setupApproveComplete();

const LATE = "E-APR-010";
const ENDED = "E-APR-012";
const NOT_OK = "E-APR-011";
const LINE = "が承認を取り下げました（承認待ちに戻りました）";
const lines = async (t: string) => (await messagesOf(t)).filter((m) => m.body.includes("が承認を取り下げました"));
const audits = (id: string) =>
  num("select count(*) as n from audit_events where action = 'approval.withdraw' and target_id = $1", [id]);
const flag = async (t: string) =>
  (await one<{ d: boolean }>("select delegated_to_clone as d from tickets where id = $1", [t])).d;
const open = (t: string) =>
  num(
    "select count(*) as n from approvals where ticket_id = $1 and decision is null and withdrawn_at is null and deleted_at is null",
    [t],
  );
const noticesOf = (memberId: string) =>
  num("select count(*) as n from notifications where member_id = $1 and event_kind_id = 'approval.withdrawn'", [
    memberId,
  ]);
const code = async (r: Response) => (await json(r))["code"];

describe("K-733 承認を取り下げる：状態 × 入口 × 利用者の状態", () => {
  it("K733-API-001 承認した後・PC がまだ受け取っていない × 取り下げる × 承認した本人：201。承認の行は取り下げの印が付き（承認のまま）、同じ成果物の新しい承認待ちの行ができ、実行の仕事と記録は取り消し、チケットは承認待ち・旗は下り、やり取りと証跡に 1 つずつ", async () => {
    const t = await ticket();
    const a = await approved(t);
    const r = await withdrawApproval(boss, a.approvalId);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = (await json(r)).data as Record<string, unknown>;
    expect(Object.keys(v).sort()).toEqual(["approval_id", "id", "ticket_id", "withdrawn_at"]);
    expect(v).toMatchObject({ id: a.approvalId, ticket_id: t.id });
    const old = await approvalRow(a.approvalId);
    expect(old).toMatchObject({ decision: "approve", status_id: "approved" });
    expect(old["withdrawn_at"]).not.toBeNull();
    const fresh = await one<Record<string, unknown>>(
      "select decision, status_id, approver_member_id, irreversible, subject_id, action_run_id, withdrawn_at from approvals where id = $1",
      [v["approval_id"]],
    );
    expect(fresh).toMatchObject({
      decision: null,
      status_id: "pending",
      approver_member_id: boss.id,
      irreversible: true,
      withdrawn_at: null,
    });
    expect(fresh["action_run_id"]).toBe(a.makeRunId);
    expect(await open(t.id)).toBe(1);
    expect((await runsOf(t.id, "execute")).at(-1)).toMatchObject({ status_id: "cancelled" });
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "cancelled" });
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await flag(t.id)).toBe(false);
    const l = await lines(t.id);
    expect(l).toHaveLength(1);
    expect(l[0]!.body).toContain(`高本${LINE}`);
    expect(await audits(a.approvalId)).toBe(1);
    const q = (await json(await req("GET", "/approvals/queue", { headers: auth(boss) }))).data as { id: string }[];
    expect(q.map((x) => x.id)).toEqual(expect.arrayContaining([String(v["approval_id"])]));
    expect(q.map((x) => x.id)).not.toContain(a.approvalId);
  });

  it("K733-API-002 取り下げた後：PC が取りに来ても仕事は渡らない。新しい承認待ちをもう一度承認すると新しい実行ができ、もう一度取り下げることもできる", async () => {
    const t = await ticket();
    const a = await approved(t);
    const w = await withdrawApproval(boss, a.approvalId);
    const nid = String(((await json(w)).data as { approval_id: string }).approval_id);
    await lastSeen(a.pc.sid, 1);
    expect(await take(a.pc)).toBeNull();
    expect((await approve(boss, nid)).status).toBe(201);
    const runs = await runsOf(t.id, "execute");
    expect(runs).toHaveLength(2);
    expect(runs[1]).toMatchObject({ status_id: "queued" });
    expect((await withdrawApproval(boss, nid)).status).toBe(201);
    expect((await runsOf(t.id, "execute"))[1]).toMatchObject({ status_id: "cancelled" });
    expect(await open(t.id)).toBe(1);
  });

  it("K733-API-003 PC がもう受け取って動かしている：409・E-APR-010（もう実行が始まっています）。承認・実行・仕事・段のどれも変わらない", async () => {
    const t = await ticket();
    const a = await approved(t);
    await lastSeen(a.pc.sid, 1);
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    const before = await snapshot(t);
    const r = await withdrawApproval(boss, a.approvalId);
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(LATE);
    expect(await snapshot(t)).toEqual(before);
    expect((await approvalRow(a.approvalId))["withdrawn_at"]).toBeNull();
    expect((await runsOf(t.id, "execute")).at(-1)).toMatchObject({ status_id: "running" });
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "running" });
  });

  it("K733-API-004 実行がもう終わった（done）・PC が受け取った後に止まった（PC が返した stopped）：409・E-APR-012。何も変わらない", async () => {
    for (const state of ["done", "stopped"] as const) {
      const t = await ticket();
      const a = await approved(t);
      await lastSeen(a.pc.sid, 1);
      expect((await take(a.pc))?.id).toBe(a.execJobId);
      await finish(a.pc, a.execJobId, {
        state,
        result: state === "done" ? "送りました" : null,
        reason: state === "stopped" ? "止まりました" : null,
        agent_session_id: a.agentSession,
      });
      const before = await snapshot(t);
      const r = await withdrawApproval(boss, a.approvalId);
      expect(r.status, state).toBe(409);
      expect(await code(r), state).toBe(ENDED);
      expect(await snapshot(t), state).toEqual(before);
    }
  });

  it("K733-API-005 承認した本人だけ：承認した本人でない人（書ける人・任せた人・マネージャー）は 403・何も変わらない。担当者が替わった後でも、承認した本人は取り下げられ、新しい承認待ちの承認する人は今の担当者", async () => {
    const t = await ticket();
    const a = await approved(t);
    const before = await snapshot(t);
    for (const p of [writer, a.by, manager]) expect((await withdrawApproval(p, a.approvalId)).status).toBe(403);
    expect(await snapshot(t)).toEqual(before);
    expect(await audits(a.approvalId)).toBe(0);
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, writer.id]);
    const r = await withdrawApproval(boss, a.approvalId);
    expect(r.status, await r.clone().text()).toBe(201);
    const nid = ((await json(r)).data as { approval_id: string }).approval_id;
    expect(
      (await one<{ approver_member_id: string }>("select approver_member_id from approvals where id = $1", [nid]))
        .approver_member_id,
    ).toBe(writer.id);
  });

  it("K733-API-006 別の会社の人・無い id・成果物でない承認・消したチケットの承認：404。何も変わらない", async () => {
    const t = await ticket();
    const a = await approved(t);
    expect((await withdrawApproval(outsider, a.approvalId)).status).toBe(404);
    expect((await withdrawApproval(boss, randomUUID())).status).toBe(404);
    const other = await one<{ id: string }>(
      `insert into approvals (tenant_id, scope_id, kind, ticket_id, approver_member_id, requested_by, status_id, created_by)
       values ($1, $2, 'policy_exception', $3, $4, $4, 'pending', $4) returning id`,
      [t.tenant, t.scope, t.id, boss.id],
    );
    expect((await withdrawApproval(boss, other.id)).status).toBe(404);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t.id]);
    expect((await withdrawApproval(boss, a.approvalId)).status).toBe(404);
    expect((await approvalRow(a.approvalId))["withdrawn_at"]).toBeNull();
  });

  it("K733-API-007 取り下げられない承認（まだ承認していない・差し戻し済み・止め済み・もう取り下げた）：409・E-APR-011。何も変わらない", async () => {
    for (const how of ["pending", "return", "stop", "withdrawn"] as const) {
      const t = await ticket();
      let id: string;
      if (how === "withdrawn") {
        const a = await approved(t);
        expect((await withdrawApproval(boss, a.approvalId)).status).toBe(201);
        id = a.approvalId;
      } else {
        const d = await delegated(t);
        id = d.approvalId;
        if (how === "return") expect((await giveBack(boss, id, "直してください")).status).toBe(201);
        if (how === "stop") expect((await stopApproval(boss, id)).status).toBe(201);
      }
      const before = await snapshot(t);
      const r = await withdrawApproval(boss, id);
      expect(r.status, how).toBe(409);
      expect(await code(r), how).toBe(NOT_OK);
      expect(await snapshot(t), how).toEqual(before);
    }
  });

  it("K733-API-008 二度押し：2 回目は 409・E-APR-011。承認待ちに戻った行・やり取り・証跡は 1 つのまま", async () => {
    const t = await ticket();
    const a = await approved(t);
    expect((await withdrawApproval(boss, a.approvalId)).status).toBe(201);
    const second = await withdrawApproval(boss, a.approvalId);
    expect(second.status).toBe(409);
    expect(await code(second)).toBe(NOT_OK);
    expect(await open(t.id)).toBe(1);
    expect(await lines(t.id)).toHaveLength(1);
    expect(await audits(a.approvalId)).toBe(1);
  });

  it("K733-API-009 同時に 2 つ（別のタブ）：1 つだけ通る [201, 409]。承認待ちに戻った行は 1 つだけ", async () => {
    const t = await ticket();
    const a = await approved(t);
    const rs = await Promise.all([withdrawApproval(boss, a.approvalId), withdrawApproval(boss, a.approvalId)]);
    expect(rs.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await open(t.id)).toBe(1);
    expect(await audits(a.approvalId)).toBe(1);
  });

  it("K733-API-010 PC が取るのと取り下げが同時：どちらか一方だけが勝つ。PC が取れたら 409・E-APR-010（仕事は動いたまま）、取り下げが先なら 201（PC には何も渡らない）。食い違った形（取り消した実行を PC が動かす）にならない", async () => {
    const t = await ticket();
    const a = await approved(t);
    await lastSeen(a.pc.sid, 1);
    const [w, took] = await Promise.all([withdrawApproval(boss, a.approvalId), take(a.pc)]);
    const run = (await runsOf(t.id, "execute")).at(-1)!;
    if (w.status === 201) {
      expect(took).toBeNull();
      expect(run.status_id).toBe("cancelled");
      expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "cancelled" });
    } else {
      expect(w.status).toBe(409);
      expect(await code(w)).toBe(LATE);
      expect(took?.id).toBe(a.execJobId);
      expect(run.status_id).toBe("running");
      expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "running" });
    }
  });

  it("K733-API-011 承認から 24 時間を過ぎて片付けられた承認（実行は止まり、聞き直しの新しい承認待ちがある）：409・E-APR-011。聞き直しの承認待ちはそのまま", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '25 hours' where id = $1", [a.approvalId]);
    expect((await req("GET", `/tickets/${t.id}`, { headers: auth(boss) })).status).toBe(200); // 読むときの片付け（K-164・K-236）
    expect((await runsOf(t.id, "execute")).at(-1)).toMatchObject({ status_id: "stopped" });
    const r = await withdrawApproval(boss, a.approvalId);
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(NOT_OK);
    expect(await open(t.id)).toBe(1);
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
  });

  it("K733-API-012 体に知らない項目：422（strict）・何も変わらない。空の体 {} は通る", async () => {
    const t = await ticket();
    const a = await approved(t);
    expect((await withdrawApproval(boss, a.approvalId, { reason: "やっぱり" })).status).toBe(422);
    expect((await approvalRow(a.approvalId))["withdrawn_at"]).toBeNull();
    expect((await withdrawApproval(boss, a.approvalId, {})).status).toBe(201);
  });

  it("K733-API-013 ログインしていない：401。上限（1 分に 61 回）：429 と待つ秒数", async () => {
    await loadHook("approval-withdraw", "withdrawApproval");
    const t = await ticket();
    const a = await approved(t);
    expect((await req("POST", `/approvals/${a.approvalId}/withdraw`, { body: {} })).status).toBe(401);
    const { limits } = await import("./approve-complete.harness.js");
    const saved = limits["withdrawApproval"];
    delete limits["withdrawApproval"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await withdrawApproval(boss, a.approvalId);
      expect(last!.status).toBe(429);
      const sec = Number((await json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) limits["withdrawApproval"] = saved;
    }
  });

  it("K733-API-014 手順 S1「DB に書く」が失敗（関数が使えない）：503・E-PAGE-003。承認の行・実行・仕事・段・やり取り・証跡のどれも変わらない", async () => {
    const t = await ticket();
    const a = await approved(t);
    const before = await snapshot(t);
    await f.admin.query("revoke execute on function app.approval_withdraw(uuid) from kaname_app");
    try {
      const r = await withdrawApproval(boss, a.approvalId);
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("grant execute on function app.approval_withdraw(uuid) to kaname_app");
    }
    expect(await snapshot(t)).toEqual(before);
    expect((await runsOf(t.id, "execute")).at(-1)).toMatchObject({ status_id: "queued" });
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "queued" });
  });

  it("K733-API-015 手順 S2「証跡」が失敗（証跡の書き込みが例外）：503・E-PAGE-003。同じ取引なので取り消しも新しい承認待ちも残らない", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query(
      `create or replace function public.k733_fail_audit() returns trigger language plpgsql as $$
       begin if new.action = 'approval.withdraw' then raise exception 'K-733 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await f.admin.query(
      "create trigger k733_fail_audit before insert on audit_events for each row execute function public.k733_fail_audit()",
    );
    try {
      const r = await withdrawApproval(boss, a.approvalId);
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("drop trigger if exists k733_fail_audit on audit_events");
      await f.admin.query("drop function if exists public.k733_fail_audit()");
    }
    expect((await approvalRow(a.approvalId))["withdrawn_at"]).toBeNull();
    expect(await open(t.id)).toBe(0);
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "queued" });
    expect(await lines(t.id)).toHaveLength(0);
  });

  it("K733-API-016 手順 S3「お知らせ」：お知らせは今の担当者だけに 1 件。取り下げた人が担当者と違う（担当者が替わった後）ときだけ担当者の受け箱に 1 件（成果物の中身は入れない）。任せた人には出さない・取り下げた人が担当者なら自分あては出さない。受け箱に書けなければ 503・E-PAGE-003 で全部戻る", async () => {
    // 担当者が替わった後：boss が承認した物を、今の担当者 writer に知らせる
    const t = await ticket();
    const a = await approved(t); // 任せたのは a.by（boss でない）
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, writer.id]);
    const beforeAssignee = await noticesOf(writer.id);
    const beforeBy = await noticesOf(a.by.id);
    expect((await withdrawApproval(boss, a.approvalId)).status).toBe(201);
    expect(await noticesOf(writer.id)).toBe(beforeAssignee + 1);
    expect(await noticesOf(a.by.id)).toBe(beforeBy);
    const p = await one<{ payload: Record<string, unknown> }>(
      "select payload from notifications where member_id = $1 and event_kind_id = 'approval.withdrawn' order by created_at desc limit 1",
      [writer.id],
    );
    expect(p.payload).toMatchObject({ ticket_id: t.id });
    expect(JSON.stringify(p.payload)).not.toContain("株式会社サンプル");
    // 取り下げた人が今の担当者 → 自分あては出さない・任せた人にも出さない
    const t2 = await ticket();
    const a2 = await approved(t2);
    const own = await noticesOf(boss.id);
    const ownBy = await noticesOf(a2.by.id);
    expect((await withdrawApproval(boss, a2.approvalId)).status).toBe(201);
    expect(await noticesOf(boss.id)).toBe(own);
    expect(await noticesOf(a2.by.id)).toBe(ownBy);
    // 受け箱が書けない（担当者が替わった物）
    const t3 = await ticket();
    const a3 = await approved(t3);
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t3.id, writer.id]);
    await f.admin.query(
      `create or replace function public.k733_fail_notice() returns trigger language plpgsql as $$
       begin if new.event_kind_id = 'approval.withdrawn' then raise exception 'K-733 試験：受け箱に書けない'; end if; return new; end $$`,
    );
    await f.admin.query(
      "create trigger k733_fail_notice before insert on notifications for each row execute function public.k733_fail_notice()",
    );
    try {
      const r = await withdrawApproval(boss, a3.approvalId);
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("drop trigger if exists k733_fail_notice on notifications");
      await f.admin.query("drop function if exists public.k733_fail_notice()");
    }
    expect((await approvalRow(a3.approvalId))["withdrawn_at"]).toBeNull();
    expect(await open(t3.id)).toBe(0);
  });

  it("K733-API-017 守りの判定で例外（書けるかの判定が壊れた）：503・E-PAGE-003・何も書かない。DB の関数の守り（2 層目）：security definer・search_path に pg_temp・public から外し kaname_app だけ。承認した本人でない文脈で直に呼ぶと { error: not_approver }", async () => {
    const t: Ticket = await ticket({ title: "K733 の守りを壊す" });
    const a = await approved(t);
    await breakWritable("K733 の守りを壊す", async () => {
      const r = await withdrawApproval(boss, a.approvalId);
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    });
    expect((await approvalRow(a.approvalId))["withdrawn_at"]).toBeNull();
    const fn = await one<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
      `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'approval_withdraw'`,
    );
    expect(fn.definer).toBe(true);
    expect(fn.cfg?.join(",") ?? "").toMatch(/search_path=.*pg_temp/);
    expect(fn).toMatchObject({ pub: false, app: true });
    const c = await f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [T.tenantId, writer.id],
      );
      const v = (await c.query<{ v: Record<string, unknown> }>("select app.approval_withdraw($1) as v", [a.approvalId]))
        .rows[0]!.v;
      expect(v).toMatchObject({ error: "not_approver" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    expect((await approvalRow(a.approvalId))["withdrawn_at"]).toBeNull();
  });

  it("K733-API-018 取り下げた後の見え方：取り下げた古い承認は承認待ちの一覧に出ず、承認の 1 件は読めて decision approve のまま。新しい承認待ちの 1 件は can_decide true・成果物の版と本文は同じ", async () => {
    const t = await ticket();
    const a = await approved(t);
    const nid = String(
      ((await json(await withdrawApproval(boss, a.approvalId))).data as { approval_id: string }).approval_id,
    );
    const oldView = (await json(await req("GET", `/approvals/${a.approvalId}`, { headers: auth(boss) }))).data as {
      approval: { decision: string };
      can_decide: boolean;
    };
    expect(oldView.approval.decision).toBe("approve");
    expect(oldView.can_decide).toBe(false);
    const fresh = (await json(await req("GET", `/approvals/${nid}`, { headers: auth(boss) }))).data as {
      can_decide: boolean;
      artifact_version: { version: number; text: string };
    };
    expect(fresh.can_decide).toBe(true);
    expect(fresh.artifact_version.version).toBe(1);
    expect(CONF_DONE).toBe("E-CONF-003");
  });
});
