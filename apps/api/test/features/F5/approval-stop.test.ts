// K-732「承認待ちを止める（stopApproval：成果物を使わずに作業中に戻す）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K732-API-…）は 11_tickets/K-732.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts と、
//   K-732 が持ち込む F5/approval-more.kit.ts（口の登録 apps/api/src/hooks/approval-more.ts を最初の要求のときに 1 回だけ読む）。
// 口：POST /api/v1/approvals/:id/stop（体は空）→ 201 { data: { id, decision: "stop", decided_at, status_id: "stopped", ticket_id } }。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の列をずらして置く。
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ENDPOINTS } from "@kaname/contracts";
import {
  setupApproveComplete,
  CONF_DONE,
  GONE,
  ARTIFACT,
  f,
  T,
  O,
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
  stageKeyOf,
  ticket,
  delegated,
  approvalRow,
  messagesOf,
  snapshot,
  team,
  breakWritable,
  NO_SPEC,
} from "./approve-complete.harness.js";
import { loadHook, stopApproval } from "./approval-more.kit.js";

setupApproveComplete();

const LINE = "が承認待ちを止めました（成果物の版 1 は残っています）";
const stopLines = async (ticketId: string) =>
  (await messagesOf(ticketId)).filter((m) => m.body.includes("が承認待ちを止めました"));
const audits = (id: string) =>
  num("select count(*) as n from audit_events where action = 'approval.stop' and target_id = $1", [id]);
const flag = async (t: string) =>
  (await one<{ d: boolean }>("select delegated_to_clone as d from tickets where id = $1", [t])).d;
const artifact = async (t: string) =>
  one<{ version: number; text: string }>(
    "select version, body->>'text' as text from ticket_sections where ticket_id = $1 and section_key = 'artifacts'",
    [t],
  );
const noticesOf = (memberId: string) =>
  num("select count(*) as n from notifications where member_id = $1 and event_kind_id = 'approval.stopped'", [
    memberId,
  ]);

describe("K-732 承認待ちを止める：状態 × 入口 × 利用者の状態", () => {
  it("K732-API-001 承認待ち × 止める × 承認する人（今の担当者）：201。承認の行は stop で決まり、成果物は使わず残り（版・本文は同じ）、チケットは作業中・旗は下り、やり取りと証跡に 1 つずつ。一覧から消え、再取得でも止めた形", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const r = await stopApproval(boss, d.approvalId);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = (await json(r)).data as Record<string, unknown>;
    expect(v).toMatchObject({ id: d.approvalId, decision: "stop", status_id: "stopped", ticket_id: t.id });
    expect(Object.keys(v).sort()).toEqual(["decided_at", "decision", "id", "status_id", "ticket_id"]);
    expect(await approvalRow(d.approvalId)).toMatchObject({
      decision: "stop",
      status_id: "stopped",
      withdrawn_at: null,
    });
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(await flag(t.id)).toBe(false);
    expect(await artifact(t.id)).toMatchObject({ version: 1, text: ARTIFACT });
    const lines = await stopLines(t.id);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.body).toContain(`高本${LINE}`);
    expect(await audits(d.approvalId)).toBe(1);
    const q = (await json(await req("GET", "/approvals/queue", { headers: auth(boss) }))).data as { id: string }[];
    expect(q.map((x) => x.id)).not.toContain(d.approvalId);
    const got = (await json(await req("GET", `/approvals/${d.approvalId}`, { headers: auth(boss) }))).data as {
      approval: { decision: string };
      can_decide: boolean;
    };
    expect(got.approval.decision).toBe("stop");
    expect(got.can_decide).toBe(false);
  });

  it("K732-API-002 止めた後：「AI に任せる」をもう一度押せる（新しい実行・旗 true）。止めた承認の行は止めたまま、成果物の版は増えない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await stopApproval(boss, d.approvalId)).status).toBe(201);
    // 任せ直すのは PC をつないだ任せた人（d.by）。担当者 boss は土台で PC をつないでいないので E-CONN-001 になる（K-63 の試験と同じ形）
    const again = await req("POST", `/tickets/${t.id}/delegate`, {
      body: { no_spec_reason: NO_SPEC },
      headers: auth(d.by),
    });
    expect(again.status, await again.clone().text()).toBe(201);
    expect(await flag(t.id)).toBe(true);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: "stop" });
    expect((await artifact(t.id)).version).toBe(1);
  });

  it("K732-API-003 承認する人でない人（同じグループで書ける人・AI に任せた人・マネージャー・見るだけの人）：403。何も変わらない（止められるのは今の担当者だけ・D-153.26）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const before = await snapshot(t);
    for (const p of [writer, d.by, manager]) {
      const r = await stopApproval(p, d.approvalId);
      expect(r.status, await r.clone().text()).toBe(403);
    }
    expect(await snapshot(t)).toEqual(before);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null, status_id: "pending" });
    expect(await stopLines(t.id)).toHaveLength(0);
    expect(await audits(d.approvalId)).toBe(0);
  });

  it("K732-API-004 別の会社の人・無い id・成果物でない承認：404。何も変わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await stopApproval(outsider, d.approvalId)).status).toBe(404);
    expect((await stopApproval(boss, randomUUID())).status).toBe(404);
    const other = await one<{ id: string }>(
      `insert into approvals (tenant_id, scope_id, kind, ticket_id, approver_member_id, requested_by, status_id, created_by)
       values ($1, $2, 'policy_exception', $3, $4, $4, 'pending', $4) returning id`,
      [t.tenant, t.scope, t.id, boss.id],
    );
    const r = await stopApproval(boss, other.id);
    expect(r.status).toBe(404);
    expect((await json(r)).code).toBe(GONE);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
  });

  it("K732-API-005 もう決まった・取り下げた承認（承認済み・差し戻し済み・止め済み・取り下げ済み）：409・E-CONF-003。何も変わらない", async () => {
    for (const how of ["approve", "return", "stop", "withdrawn"] as const) {
      const t = await ticket();
      const d = await delegated(t);
      if (how === "approve") expect((await approve(boss, d.approvalId)).status).toBe(201);
      if (how === "return") expect((await giveBack(boss, d.approvalId, "直してください")).status).toBe(201);
      if (how === "stop") expect((await stopApproval(boss, d.approvalId)).status).toBe(201);
      if (how === "withdrawn")
        await f.admin.query("update approvals set withdrawn_at = now() where id = $1", [d.approvalId]);
      const before = await snapshot(t);
      const r = await stopApproval(boss, d.approvalId);
      expect(r.status, how).toBe(409);
      expect((await json(r)).code, how).toBe(CONF_DONE);
      expect(await snapshot(t), how).toEqual(before);
    }
  });

  it("K732-API-006 二度押し：2 回目は 409・E-CONF-003。やり取りと証跡は 1 つのまま", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await stopApproval(boss, d.approvalId)).status).toBe(201);
    expect((await stopApproval(boss, d.approvalId)).status).toBe(409);
    expect(await stopLines(t.id)).toHaveLength(1);
    expect(await audits(d.approvalId)).toBe(1);
  });

  it("K732-API-007 同時に 2 つ（別のタブ）：1 つだけ通る [201, 409]。やり取りと証跡は 1 つずつ", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const rs = await Promise.all([stopApproval(boss, d.approvalId), stopApproval(boss, d.approvalId)]);
    expect(rs.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await stopLines(t.id)).toHaveLength(1);
    expect(await audits(d.approvalId)).toBe(1);
  });

  it("K732-API-008 承認と止めるが同時：どちらか 1 つだけが決まる（両方は通らない）。決まった形とチケットの段・実行の仕事が食い違わない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const [a, s] = await Promise.all([approve(boss, d.approvalId), stopApproval(boss, d.approvalId)]);
    expect([a.status, s.status].sort()).toEqual([201, 409]);
    const row = await approvalRow(d.approvalId);
    if (a.status === 201) {
      expect(row).toMatchObject({ decision: "approve" });
      expect(await stageKeyOf(t.id)).toBe("running");
      expect(
        await num("select count(*) as n from action_runs where ticket_id = $1 and phase = 'execute'", [t.id]),
      ).toBe(1);
    } else {
      expect(row).toMatchObject({ decision: "stop" });
      expect(await stageKeyOf(t.id)).toBe("doing");
      expect(
        await num("select count(*) as n from action_runs where ticket_id = $1 and phase = 'execute'", [t.id]),
      ).toBe(0);
    }
  });

  it("K732-API-009 承認の後の（実行待ち）は止められない：409・E-CONF-003。実行を止めるのは K-731 の止める口", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await approve(boss, d.approvalId)).status).toBe(201);
    const r = await stopApproval(boss, d.approvalId);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe(CONF_DONE);
    expect(await stageKeyOf(t.id)).toBe("running");
  });

  it("K732-API-010 体に知らない項目：422（strict）・何も変わらない。空の体 {} は通る", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await stopApproval(boss, d.approvalId, { reason: "いらない" })).status).toBe(422);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
    expect((await stopApproval(boss, d.approvalId, {})).status).toBe(201);
  });

  it("K732-API-011 ログインしていない：401。上限（1 分に 61 回）：429 と待つ秒数", async () => {
    await loadHook("approval-stop", "stopApproval");
    const t = await ticket();
    const d = await delegated(t);
    const anon = await req("POST", `/approvals/${d.approvalId}/stop`, { body: {} });
    expect(anon.status).toBe(401);
    const { limits } = await import("./approve-complete.harness.js");
    const saved = limits["stopApproval"];
    delete limits["stopApproval"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await stopApproval(boss, d.approvalId);
      expect(last!.status).toBe(429);
      const sec = Number((await json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) limits["stopApproval"] = saved;
    }
  });

  it("K732-API-012 手順 S1「DB に書く」が失敗（関数が使えない）：503・E-PAGE-003。承認の行・段・旗・やり取り・証跡のどれも変わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const before = await snapshot(t);
    await f.admin.query("revoke execute on function app.approval_stop(uuid) from kaname_app");
    try {
      const r = await stopApproval(boss, d.approvalId);
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("grant execute on function app.approval_stop(uuid) to kaname_app");
    }
    expect(await snapshot(t)).toEqual(before);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
    expect(await flag(t.id)).toBe(true);
  });

  it("K732-API-013 手順 S2「証跡」が失敗（証跡の書き込みが例外）：503・E-PAGE-003。同じ取引なので承認の行も段も切り替わらない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    await f.admin.query(
      `create or replace function public.k732_fail_audit() returns trigger language plpgsql as $$
       begin if new.action = 'approval.stop' then raise exception 'K-732 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await f.admin.query(
      "create trigger k732_fail_audit before insert on audit_events for each row execute function public.k732_fail_audit()",
    );
    try {
      const r = await stopApproval(boss, d.approvalId);
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    } finally {
      await f.admin.query("drop trigger if exists k732_fail_audit on audit_events");
      await f.admin.query("drop function if exists public.k732_fail_audit()");
    }
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await stopLines(t.id)).toHaveLength(0);
  });

  it("K732-API-014 お知らせ：止められるのは承認する人（今の担当者）だけなので、止める口は受け箱（approval.stopped）に何も書かない。任せた人にも担当者本人にも増えない（二度押しでも増えない・担当者だけに出す決めで、止めた本人が担当者なら自分あては出さない・D-153.7）", async () => {
    const t = await ticket();
    const d = await delegated(t); // 任せたのは d.by（boss でない）・担当者は boss
    const beforeBy = await noticesOf(d.by.id);
    const beforeBoss = await noticesOf(boss.id);
    expect((await stopApproval(boss, d.approvalId)).status).toBe(201);
    expect((await stopApproval(boss, d.approvalId)).status).toBe(409);
    expect(await noticesOf(d.by.id)).toBe(beforeBy);
    expect(await noticesOf(boss.id)).toBe(beforeBoss);
    // 自分で任せた物を自分で止める
    const mine = await team("自分で任せる人");
    const t2 = await ticket({ assignee: mine.by });
    const d2 = await delegated(t2, { by: mine });
    const own = await noticesOf(mine.by.id);
    expect((await stopApproval(mine.by, d2.approvalId)).status).toBe(201);
    expect(await noticesOf(mine.by.id)).toBe(own);
  });

  it("K732-API-016 守りの判定で例外（書けるかの判定が壊れた）：503・E-PAGE-003。何も書かない。DB の関数の守り（2 層目）：security definer・search_path に pg_temp・public から外し kaname_app だけ。承認する人でない文脈で直に呼ぶと { error: not_approver }", async () => {
    const t = await ticket({ title: "K732 の守りを壊す" });
    const d = await delegated(t);
    await breakWritable("K732 の守りを壊す", async () => {
      const r = await stopApproval(boss, d.approvalId);
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    });
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
    const fn = await one<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
      `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'approval_stop'`,
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
      const v = (await c.query<{ v: Record<string, unknown> }>("select app.approval_stop($1) as v", [d.approvalId]))
        .rows[0]!.v;
      expect(v).toMatchObject({ error: "not_approver" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
  });

  it("K732-API-017 担当者が変わった直後（開いていた画面で押す）は 403、新しい担当者は 201（権限を外した直後・付けた直後）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, writer.id]);
    const old = await stopApproval(boss, d.approvalId);
    expect(old.status).toBe(403);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
    const now = await stopApproval(writer, d.approvalId);
    expect(now.status, await now.clone().text()).toBe(201);
    expect((await stopLines(t.id))[0]!.body).toContain("佐藤");
  });

  it("K732-API-018 口の登録：stopApproval は契約に在り 501 でない（葉の hooks のファイル approval-stop.ts の register が口を持つ）。止める口は成果物を決めた承認の行だけを書き、取り下げる・自分で直す・決めた履歴の口には触れない", async () => {
    expect(ENDPOINTS.some((e) => e.operationId === "stopApproval")).toBe(true);
    const t = await ticket();
    const d = await delegated(t);
    const r = await stopApproval(boss, d.approvalId);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(O.tenantId).not.toBe(T.tenantId);
  });
});
