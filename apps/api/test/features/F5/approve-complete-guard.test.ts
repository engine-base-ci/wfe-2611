// K-166「完了の知らせと続きの絞り・5 本の口をまたぐ守り（ログイン・別の会社・id の形・知らない欄・回数・証跡・混ざらない）」の単体の試験（口・本物の DB・本物の PC の印）。親 K-63 の試験を孫ごとに分けたもの（行 ID と中身は分ける前のまま・11_tickets/K-166.md の表のマスと分岐に 1 対 1）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台・道具・決めた文は ./approve-complete.harness.ts。
import { describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { type Transport } from "@kaname/notify";
import { approveHooks } from "../../../src/features/F5/approve-complete/index.js";
import {
  setupApproveComplete,
  GONE,
  CONF_STAGE,
  ARTIFACT,
  f,
  hooks,
  limits,
  T,
  O,
  boss,
  writer,
  viewer,
  manager,
  outsider,
  json,
  one,
  num,
  auth,
  req,
  queue,
  detail,
  approve,
  giveBack,
  complete,
  take,
  lastSeen,
  stageOf,
  stageKeyOf,
  team,
  ticket,
  delegated,
  approvalRow,
  runsOf,
  jobOf,
  executed,
  todoVersion,
  completeBody,
  details,
  snapshot,
  breakWritable,
} from "./approve-complete.harness.js";

setupApproveComplete();

describe("K-63 承認して完了する：承認・差し戻し（口・本物の DB）", () => {
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
  it("K63-API-054 承認する × 実行の仕事を積む：行の prompt にチケットの中身と後ろに足し書き、agent_session_id は前の作る実行と同じ・resume_session_id はその PC。完了の後の作る実行だけを見る（D-128.176・D-125.155・D-131.3）", async () => {
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
    expect(row["resume_session_id"]).toBe(d.pc.sid); // 作る段の仕事を取った PC（作業セッションの記録を持つ PC）
    expect(row["member_id"]).toBe(d.by.id);
    // 同じ PC が取ったとき、行の中身がそのまま渡る（別の PC は K63-API-072）
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

  it("K63-API-055 完了した後に任せ直す：続きの id は空（完了の前の作る実行の続きを使わない・D-125.155。このチケットの migration が app.ticket_job_context に絞りを足す。任せ直しも同じ関数を通る）", async () => {
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

  it("K63-API-063 失敗 × 完了の守りの判定（書けるか）の所で例外になった：関数は guard_failed を返して何も書かない。口は 503・E-PAGE-003（入口の行の決まり write が先に例外になるので、503 は K-146 の共通の決まり・D-131.7）。段は変わらず、知らせも出ない（fail-closed）", async () => {
    const t = await ticket({ title: "K63 守りが壊れる 完了", creator: writer });
    await executed(t);
    const v = await todoVersion(t.id);
    await breakWritable("K63 守りが壊れる 完了", async () => {
      // (b) 関数を直に呼ぶと guard_failed を返す（例外を外に投げない・何も書かない）。K-146 に依らない
      const ctx: TenantContext = { tenantId: T.tenantId, userId: boss.id, role: "member", stepUpAt: null };
      const out = await withTenant(f.pool, ctx, (cl) =>
        cl.query<{ v: { error?: string } }>("select app.ticket_complete($1, $2, $3, true) as v", [t.id, [0, 1], v]),
      );
      expect(out.rows[0]!.v.error).toBe("guard_failed");
      // (a) 口：completeTicket の行の決まりは write＝app.ticket_writable なので、例外は関数より先に共通の入口（op.ts の rowAllowed）で起きる。
      //     そこで 503・E-PAGE-003 に倒すのは K-146 の共通の決まり（K-146 の取り込みが前提）。どちらで起きても 503 で、何も書かない
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    });
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(
      await num("select count(*) as n from notifications where dedupe_key like $1", [`%ticket.completed:${t.id}`]),
    ).toBe(0);
  });

  it("K63-API-069 完了の知らせの宛先：会社から抜けた・止められた担当者／作った人には出さない（D-131.12）", async () => {
    for (const col of ["deleted_at", "suspended_at"]) {
      const creator = await f.person(T.tenantId, T.rootScope, { name: `作った人（${col}）`, ticketAbility: "edit" });
      const t = await ticket({ creator });
      await executed(t);
      await f.admin.query(
        col === "suspended_at"
          ? "update members set suspended_at = now(), suspended_by = $2 where id = $1"
          : "update members set deleted_at = now() where id = $1",
        col === "suspended_at" ? [creator.id, boss.id] : [creator.id],
      );
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status, col).toBe(201); // 完了は止めない
      expect(
        await num("select count(*) as n from notifications where dedupe_key like $1", [`%ticket.completed:${t.id}`]),
      ).toBe(0); // 押した人（担当者）と、抜けた・止められた作った人のどちらにも出さない
    }
  });
  it("K63-API-081 失敗 × DB の関数が知らない言葉を返した（承認・差し戻し・完了）：口は 503・E-PAGE-003。言葉は答えに出さず、何も書かない（決める人の答え answer=75b89fd38579）", async () => {
    const swap = async (sig: string, decl: string, call: () => Promise<Response>) => {
      const orig = (await one<{ def: string }>(`select pg_get_functiondef('${sig}'::regprocedure) as def`)).def;
      await f.admin.query(
        `create or replace function ${decl} returns jsonb language sql security definer set search_path = public, app, pg_temp as $$ select jsonb_build_object('error', 'k63_unknown_word') $$`,
      );
      try {
        const r = await call();
        expect(r.status, sig).toBe(503);
        const j = await json(r);
        expect(j["code"], sig).toBe("E-PAGE-003");
        expect(JSON.stringify(j), sig).not.toContain("k63_unknown_word");
      } finally {
        await f.admin.query(orig);
      }
    };
    const DECIDE = "app.approval_decide(p_approval uuid, p_decision text, p_reason text)";
    const t = await ticket();
    const d = await delegated(t);
    await swap("app.approval_decide(uuid,text,text)", DECIDE, () => approve(boss, d.approvalId));
    await swap("app.approval_decide(uuid,text,text)", DECIDE, () =>
      giveBack(boss, d.approvalId, "宛名を直してください"),
    );
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
    const t2 = await ticket({ creator: writer });
    await executed(t2);
    const body = await completeBody(t2);
    await swap(
      "app.ticket_complete(uuid,integer[],integer,boolean)",
      "app.ticket_complete(p_ticket uuid, p_todo_checked integer[], p_todo_version integer, p_confirmed boolean)",
      () => complete(boss, t2.id, body),
    );
    expect(await stageKeyOf(t2.id)).toBe("doing");
  });
  it("K63-API-082 完了の知らせの宛先：会社から抜けた・止められた担当者には出さず、作った人には出す（押すのは担当者でない書ける人・D-131.12）", async () => {
    for (const col of ["deleted_at", "suspended_at"]) {
      const asg = await f.person(T.tenantId, T.rootScope, { name: `担当者（${col}）`, ticketAbility: "edit" });
      const t = await ticket({ assignee: asg, creator: manager });
      await executed(t);
      await f.admin.query(
        col === "suspended_at"
          ? "update members set suspended_at = now(), suspended_by = $2 where id = $1"
          : "update members set deleted_at = now() where id = $1",
        col === "suspended_at" ? [asg.id, boss.id] : [asg.id],
      );
      const r = await complete(writer, t.id, await completeBody(t));
      expect(r.status, col).toBe(201); // 完了は止めない
      const n = await f.admin.query<{ member_id: string }>(
        "select member_id from notifications where dedupe_key like $1",
        [`%ticket.completed:${t.id}`],
      );
      expect(
        n.rows.map((x) => x.member_id),
        col,
      ).toEqual([manager.id]); // 抜けた・止められた担当者と押した人には出さない
    }
  });
  it("K63-API-084 守り × 会社から抜けた人（members.deleted_at・セッションは残っている）× 一覧・1 件・承認・差し戻し・完了：5 本とも 403・FORBIDDEN（404 でない・D-131.7）。何も書かない", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "抜ける人", ticketAbility: "edit" });
    const t = await ticket({ assignee: who });
    const d = await delegated(t);
    const t2 = await ticket({ assignee: who });
    await executed(t2);
    const body2 = await completeBody(t2);
    const before = [await snapshot(t), await snapshot(t2)];
    await f.admin.query("update members set deleted_at = now() where id = $1", [who.id]);
    const calls: [string, () => Promise<Response>][] = [
      ["一覧", () => queue(who)],
      ["1 件", () => detail(who, d.approvalId)],
      ["承認", () => approve(who, d.approvalId)],
      ["差し戻し", () => giveBack(who, d.approvalId, "直して")],
      ["完了", () => complete(who, t2.id, body2)],
    ];
    for (const [name, call] of calls) {
      const r = await call();
      expect(r.status, `${name} ${await r.clone().text()}`).toBe(403);
      expect((await json(r))["code"], name).toBe("FORBIDDEN");
    }
    expect([await snapshot(t), await snapshot(t2)]).toEqual(before);
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
    expect(await stageKeyOf(t2.id)).not.toBe("done");
  });
  it("K63-API-083 守り × 受け箱を書く関数を直に呼ぶ：完了していないチケット・完了にした人でない人では何も書かない（2 層目。本人宛てだけの行の守りをすり抜けない）", async () => {
    const t = await ticket({ creator: writer });
    await executed(t);
    // 関数が無いのに「書かなかった」で緑にしない：まず関数があること
    expect(
      await num(
        "select count(*) as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'app' and p.proname = 'ticket_completed_notice'",
        [],
      ),
    ).toBeGreaterThan(0);
    // 呼び出しは通る（1 引数で呼べる）か、断るなら権限が無い（42501）だけ。関数が無い（42883）・ほかの例外は赤
    const call = async (p: Person) => {
      const ctx: TenantContext = { tenantId: T.tenantId, userId: p.id, role: "member", stepUpAt: null };
      let code: string | undefined;
      try {
        await withTenant(f.pool, ctx, (cl) => cl.query("select app.ticket_completed_notice($1)", [t.id]));
      } catch (e) {
        code = (e as { code?: string }).code ?? String(e);
      }
      expect([undefined, "42501"], `${p.id} の呼び出しの例外 ${code}`).toContain(code);
    };
    const count = () =>
      num("select count(*) as n from notifications where dedupe_key like $1", [`%ticket.completed:${t.id}`]);
    await call(boss); // まだ完了していない
    expect(await count()).toBe(0);
    expect((await complete(boss, t.id, await completeBody(t))).status).toBe(201);
    const after = await count();
    expect(after).toBeGreaterThan(0); // 完了にした人の呼び出しでは書く（関数が働いている）
    await call(writer); // 完了にした人でない
    await call(manager);
    expect(await count()).toBe(after);
  });

  it("K63-API-095 作業中・終わっていない子がある × 完了にする × 明細：422・E-VAL-024 の明細（欄 children）の各件に、子のチケットの id（uuid）と message「番号 題名」が入る（画面が /tickets/<id> のリンクを作れる）。完了の子・消した子は明細に出ない・親は作業中のまま", async () => {
    const parent = await ticket();
    const a = await ticket({ parent: parent.id, title: "宛名を確かめる", stage: "doing", todo: null });
    const b = await ticket({ parent: parent.id, title: "切手を買う", stage: "todo", todo: null });
    const doneChild = await ticket({ parent: parent.id, title: "もう終わった子", stage: "done", todo: null });
    const goneChild = await ticket({ parent: parent.id, title: "消した子", stage: "doing", todo: null });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [goneChild.id]);
    const r = await complete(boss, parent.id, await completeBody(parent));
    expect(r.status, await r.clone().text()).toBe(422);
    const j = await json(r);
    expect(JSON.stringify(j)).toContain("E-VAL-024");
    const kids = ((j["details"] as Record<string, unknown>[] | undefined) ?? []).filter(
      (x) => x["field"] === "children",
    );
    const byId = new Map(kids.map((x) => [String(x["id"]), x["message"]]));
    expect([...byId.keys()].sort()).toEqual([a.id, b.id].sort());
    expect(byId.get(a.id)).toBe(`${a.number} 宛名を確かめる`);
    expect(byId.get(b.id)).toBe(`${b.number} 切手を買う`);
    expect(byId.has(doneChild.id)).toBe(false);
    expect(await stageKeyOf(parent.id)).toBe("doing");
  });

  // 決める人の答え answer=db67f3cde899（2026-11-13）①：押した人に見えない子は id も番号も題名も出さず、「ほかに、あなたに見えない子が N 件あります」の 1 件だけ出す。完了は断るまま
  /** 兄弟の層を 2 つ作り、片方（営業）だけを直せる人と、もう片方（秘密）の人を置く。営業の人に秘密の層のチケットは見えない */
  const siblings = async (tag: string) => {
    const mk = async (name: string) =>
      (
        await one<{ id: string }>(
          "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id",
          [T.tenantId, T.rootScope, `${name}（${tag}）`, `${tag}${name === "営業" ? "S" : "H"}`],
        )
      ).id;
    const sales = await mk("営業");
    const secret = await mk("秘密");
    const salesWriter = await f.person(T.tenantId, sales, { name: `営業の書く人（${tag}）`, ticketAbility: "edit" });
    const insider = await f.person(T.tenantId, secret, { name: `秘密の人（${tag}）`, ticketAbility: "edit" });
    return { sales, secret, salesWriter, insider };
  };
  const childDetails = async (r: Response) =>
    (((await json(r))["details"] as Record<string, unknown>[] | undefined) ?? []).filter(
      (x) => x["field"] === "children",
    );

  it("K63-API-096 終わっていない子に、押した人に見える子と見えない子（別の層）が混ざる × 完了にする：422・E-VAL-024。明細は見える子（id と「番号 題名」）と、「ほかに、あなたに見えない子が 2 件あります」の 1 件だけ。見えない子の id・番号・題名は答えのどこにも出ない・親は作業中のまま", async () => {
    const g = await siblings("QA");
    const parent = await ticket({ scope: g.sales, assignee: g.salesWriter });
    const seen = await ticket({ scope: g.sales, assignee: g.salesWriter, parent: parent.id, title: "宛名を確かめる" });
    const hidden1 = await ticket({
      scope: g.secret,
      assignee: g.insider,
      creator: g.insider,
      parent: parent.id,
      title: "秘密の見積",
    });
    const hidden2 = await ticket({
      scope: g.secret,
      assignee: g.insider,
      creator: g.insider,
      parent: parent.id,
      title: "秘密の契約",
    });
    // 前提：営業の人に秘密の層の子は見えない
    expect((await req("GET", `/tickets/${hidden1.id}`, { headers: auth(g.salesWriter) })).status).toBe(404);
    const r = await complete(g.salesWriter, parent.id, await completeBody(parent));
    expect(r.status, await r.clone().text()).toBe(422);
    const raw = await r.clone().text();
    expect(raw).toContain("E-VAL-024");
    const kids = await childDetails(r);
    expect(kids).toHaveLength(2);
    expect(kids.filter((x) => x["id"] !== undefined)).toEqual([
      { field: "children", id: seen.id, message: `${seen.number} 宛名を確かめる` },
    ]);
    expect(kids.filter((x) => x["id"] === undefined)).toEqual([
      { field: "children", message: "ほかに、あなたに見えない子が 2 件あります" },
    ]);
    for (const h of [hidden1, hidden2]) {
      expect(raw).not.toContain(h.id);
      expect(raw).not.toContain(h.number);
    }
    expect(raw).not.toContain("秘密の見積");
    expect(raw).not.toContain("秘密の契約");
    expect(await stageKeyOf(parent.id)).toBe("doing");
  });

  it("K63-API-097 終わっていない子が、押した人に見えない子だけ × 完了にする：断るまま（422・E-VAL-024）。明細は「ほかに、あなたに見えない子が 1 件あります」の 1 件だけ（id なし）。その子が完了になれば親を完了にできる", async () => {
    const g = await siblings("QB");
    const parent = await ticket({ scope: g.sales, assignee: g.salesWriter });
    const hidden = await ticket({
      scope: g.secret,
      assignee: g.insider,
      creator: g.insider,
      parent: parent.id,
      title: "秘密の見積",
    });
    const r = await complete(g.salesWriter, parent.id, await completeBody(parent));
    expect(r.status, await r.clone().text()).toBe(422);
    const raw = await r.clone().text();
    expect(raw).toContain("E-VAL-024");
    expect(await childDetails(r)).toEqual([
      { field: "children", message: "ほかに、あなたに見えない子が 1 件あります" },
    ]);
    expect(raw).not.toContain(hidden.id);
    expect(raw).not.toContain("秘密の見積");
    expect(await stageKeyOf(parent.id)).toBe("doing");
    await f.admin.query("update tickets set stage_id = $2 where id = $1", [
      hidden.id,
      await stageOf(T.tenantId, "done"),
    ]);
    expect((await complete(g.salesWriter, parent.id, await completeBody(parent))).status).toBe(201);
  });

  // 決める人の答え answer=db67f3cde899 ②：完了にできるのは作業中だけ（画面も口も）。
  // 決める人の答え answer=83361b2157fd：未着手・保留で断る文は新しい文（状態コードは 409 のまま）。承認待ち・実行中・確認中は E-CONF-016 のまま。
  //   段 1 では AI に任せた道だけが作業中になり完了まで通る。人だけのチケット（未着手のまま）は、人が段を作業中にできる機能（K-67）が入るまで完了にできない
  const CONF_NOT_DOING = "E-CONF-019";
  const MSG_NOT_DOING = "完了にできるのは作業中のチケットだけです";
  it("K63-API-098 未着手・保留（人だけで進めて段が作業中になっていないチケット）× 完了にする × 担当者：409・E-CONF-019「完了にできるのは作業中のチケットだけです」。何も変えない（段・やり取り・証跡・知らせ）。承認待ちは今までどおり E-CONF-016", async () => {
    for (const stage of ["todo", "hold"]) {
      const t = await ticket({ stage });
      const before = await snapshot(t);
      const r = await complete(boss, t.id, await completeBody(t));
      expect(r.status, `${stage}：${await r.clone().text()}`).toBe(409);
      const j = await json(r);
      expect(j["code"], stage).toBe(CONF_NOT_DOING);
      expect(j["message"], stage).toBe(MSG_NOT_DOING);
      expect(await snapshot(t), stage).toEqual(before);
      expect(await stageKeyOf(t.id), stage).toBe(stage);
      expect(
        await num("select count(*) as n from notifications where dedupe_key like $1", [`%ticket.completed:${t.id}`]),
        stage,
      ).toBe(0);
    }
    // 承認待ちの段は今までどおり E-CONF-016（文を取り違えない）
    const w = await ticket();
    await delegated(w);
    const r = await complete(boss, w.id, await completeBody(w));
    expect(r.status).toBe(409);
    expect((await json(r))["code"]).toBe(CONF_STAGE);
  });

  it("K63-API-099 未着手・保留・作業中 × チケットの詳細を読む × 直せる人：can.complete は未着手・保留で false・作業中で true", async () => {
    const canComplete = async (stage: string) => {
      const t = await ticket({ stage });
      const r = await req("GET", `/tickets/${t.id}`, { headers: auth(boss) });
      expect(r.status, await r.clone().text()).toBe(200);
      return (((await json(r)).data as Record<string, unknown>)["can"] as Record<string, unknown>)["complete"];
    };
    expect(await canComplete("todo")).toBe(false);
    expect(await canComplete("hold")).toBe(false);
    expect(await canComplete("doing")).toBe(true);
  });
});
