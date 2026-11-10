// K-62「AI に任せる」の単体の試験：PC が呼ぶ口（takeBridgeJob・reportJobProgress・getJobControl・callKanameTool・finishBridgeJob）（口・本物の DB）。
//   名前の頭の行 ID（K62-API-…）は 11_tickets/K-62.md の表のマスと分岐に 1 対 1 で結ぶ。人が呼ぶ口は delegate.test.ts。
//   PC の印は本物（引き取りで返った "kpc_…" を x-bridge-session に載せる）。時刻は眠らずに DB の行の時刻を動かす（D-128.130）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Person } from "../fixture.js";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ActionRunView, JobControl } from "@kaname/contracts/schemas";
import { createRepository } from "@kaname/db/repository";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { agentToolRoutes } from "../../../src/auth/agent-tools.js";
import {
  data,
  delegateOk,
  E,
  makeKit,
  MSG,
  OLD_PROTOCOL,
  PROTOCOL,
  sha,
  type Device,
  type Kit,
} from "./delegate-kit.js";

let k: Kit;
let other: Person; // 同じ会社の別の人（担当を替える先）
/** Claude Code のセッションの id（本物は uuid。契約も uuid・D-129.42） */
const SESS = {
  k62: "62626262-0000-4000-8000-00000000a001",
  ticket1: "62626262-0000-4000-8000-00000000a002",
  k6263: "62626262-0000-4000-8000-00000000a003",
  k6263b: "62626262-0000-4000-8000-00000000a004",
  a1: "62626262-0000-4000-8000-00000000a005",
  a2: "62626262-0000-4000-8000-00000000a006",
} as const;

beforeAll(async () => {
  k = await makeKit();
  other = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "山田", ticketAbility: "edit" });
}, 90_000);
afterAll(async () => {
  await k?.close();
});

/** 1 人ぶんの新しい人と PC（ほかの試験の仕事を取り合わない） */
const fresh = async (name: string): Promise<{ p: Person; pc: Device }> => {
  const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name, ticketAbility: "edit" });
  return { p, pc: await k.device(p) };
};
/** 任せて、その PC で取るところまで */
const started = async (p: Person, pc: Device, purpose?: string) => {
  const t = await k.ticket(p, purpose ? { purpose } : {});
  const d = await delegateOk(k, p, t);
  const job = await k.takeJob(pc);
  expect(job.job_id).toBe(d.job_id);
  return { t, d, job };
};
const runRow = async (runId: string) => (await k.q("select * from action_runs where id = $1", [runId]))[0]!;
const artifactVersions = (t: string) =>
  k.q<{ version: number; body: { text?: string }; edited_by: string; edited_by_clone: boolean }>(
    `select v.version, v.body, v.edited_by, v.edited_by_clone from ticket_section_versions v
       join ticket_sections s on s.id = v.section_id where s.ticket_id = $1 and s.section_key = 'artifacts' order by v.version`,
    [t],
  );
const approvalsOf = (t: string) =>
  k.q<{
    kind: string;
    status_id: string;
    approver_member_id: string;
    action_run_id: string;
    decision: string | null;
    irreversible: boolean;
  }>(
    // 承認待ちの行の形は K-63 が前提にする（status_id pending・irreversible は骨格では true・D-128.177）
    "select kind, status_id, approver_member_id, action_run_id, decision, irreversible from approvals where ticket_id = $1",
    [t],
  );

/** その人の待っている仕事の数（ほかの PC が取っても変わらないことを見る） */
const queuedFor = (memberId: string) =>
  k.n("select count(*) as n from bridge_jobs where member_id = $1 and state_id = 'queued'", [memberId]);
const systemLines = async (t: string) =>
  (
    await k.q<{ body: string }>(
      "select body from ticket_messages where ticket_id = $1 and kind = 'system' order by created_at",
      [t],
    )
  ).map((x) => x.body);

describe("K-62 AI に任せる：PC が取る・様子を返す・終わる（PC の口・本物の DB）", () => {
  it("K62-API-005 待っている × その人の PC が 2 台で同時に取りに来る：1 件だけ渡す。2 台目・2 回目には渡さない", async () => {
    const { p, pc } = await fresh("2 台の人");
    const pc2 = await k.device(p, "2 台目");
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    const [a, b] = await Promise.all([k.take(pc), k.take(pc2)]);
    const jobs = [await data<{ job: { job_id: string } | null }>(a), await data<{ job: { job_id: string } | null }>(b)];
    expect(jobs.filter((x) => x.job?.job_id === d.job_id)).toHaveLength(1);
    const again = await data<{ job: unknown }>(await k.take(pc));
    expect(again.job).toBeNull();
    expect((await runRow(d.run_id))["status_id"]).toBe("running");
  });

  it("K62-API-006 待っている × 古い Bridge（約束の版 4）が取りに来る：渡さず outdated。仕事は待ったまま（E-CONN-012）", async () => {
    const { p, pc } = await fresh("古い Bridge の人");
    const d = await delegateOk(k, p, await k.ticket(p));
    const r = await data<{ job: unknown; outdated: boolean }>(await k.take(pc, { protocol: OLD_PROTOCOL }));
    expect(r).toMatchObject({ job: null, outdated: true });
    expect((await k.q("select state_id from bridge_jobs where id = $1", [d.job_id]))[0]!["state_id"]).toBe("queued");
  });

  it("K62-API-007 待っている × 別の人の PC（その人の仕事は 1 つも無い）が取りに来る：何も渡さない（job は null）。押した人の待ちの数は変わらない", async () => {
    const { p } = await fresh("取られない人");
    const d = await delegateOk(k, p, await k.ticket(p));
    const bystander = await fresh("通りがかりの人"); // 自分の仕事を持たない新しい人の PC
    const before = await queuedFor(p.id);
    const r = await data<{ job: unknown }>(await k.take(bystander.pc));
    expect(r.job).toBeNull();
    expect(await queuedFor(p.id)).toBe(before);
    expect((await k.q("select state_id from bridge_jobs where id = $1", [d.job_id]))[0]!["state_id"]).toBe("queued");
  });

  it("K62-API-045 待っている × 別の会社の人の PC・押した人でない担当者の PC が取りに来る：どちらも job は null（自分の仕事を持たない人）。取るのは押した人のアカウントの PC だけ（D-128.138・D-128.176）", async () => {
    const { p, pc } = await fresh("任せた人");
    const assignee = await fresh("担当だけの人"); // 担当者。自分では任せていない
    const stranger = await k.f.person(k.O.tenantId, k.O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    const strangerPc = await k.device(stranger, "別の会社の PC");
    const t = await k.ticket(assignee.p, { assignee: assignee.p });
    const d = await delegateOk(k, p, t);
    const before = await queuedFor(p.id);
    for (const someone of [strangerPc, assignee.pc]) {
      expect((await data<{ job: unknown }>(await k.take(someone))).job).toBeNull();
    }
    expect(await queuedFor(p.id)).toBe(before);
    const mine = await k.takeJob(pc);
    expect(mine.job_id).toBe(d.job_id);
    expect(
      (await k.q("select taken_session_id from bridge_jobs where id = $1", [d.job_id]))[0]!["taken_session_id"],
    ).toBe(pc.sessionId);
  });

  it("K62-API-029 待っている × PC が取る：受け取った PC（bridge_jobs.taken_session_id）をその PC のセッションにする（D-128.163）。渡す中身はチケットから組み、許可は「聞く」", async () => {
    const { p, pc } = await fresh("受け取る人");
    const { d, job } = await started(p, pc, "取引先 A への見積を作る");
    expect(
      (await k.q("select taken_session_id from bridge_jobs where id = $1", [d.job_id]))[0]!["taken_session_id"],
    ).toBe(pc.sessionId);
    expect(job).toMatchObject({ kind: "ticket", permission_mode: "manual", conversation_id: null });
    expect(String(job["prompt"])).toContain("取引先 A への見積を作る"); // 目的
    expect(String(job["prompt"])).toContain("金額と内訳がそろっている"); // 完了の条件
    expect(String(job["prompt"])).toContain("前回の見積を読む"); // 実施事項
    expect(job["ticket_id"]).toBeTruthy();
    expect(typeof job.tool_token).toBe("string");
  });

  it("K62-API-008 動いている × PC が途中の様子を送る：記録し、実行の 1 件の途中の 1 行が切り替わる", async () => {
    const { p, pc } = await fresh("様子の人");
    const { d } = await started(p, pc);
    expect((await k.progress(pc, d.job_id, { seq: 1, kind: "status", text: "前回の見積を読んでいます" })).status).toBe(
      201,
    );
    expect((await data<{ progress: string }>(await k.run(p, d.run_id))).progress).toBe("前回の見積を読んでいます");
    await k.progress(pc, d.job_id, { seq: 2, kind: "status", text: "内訳を書いています" });
    expect((await data<{ progress: string }>(await k.run(p, d.run_id))).progress).toBe("内訳を書いています");
    expect(
      await k.n("select count(*) as n from bridge_job_events where job_id = $1 and kind = 'status'", [d.job_id]),
    ).toBe(2);
  });

  it("K62-API-009 動いている × 道具 ticket_read（鍵が合う）：任された 1 枚の区画だけを返し、証跡に残す（関門 C2）", async () => {
    const { p, pc } = await fresh("読む人");
    const elsewhere = await k.ticket(p, { purpose: "別のチケットの秘密の目的" });
    const { t, d, job } = await started(p, pc, "任された目的");
    const r = await k.tool(pc, d.job_id, "ticket_read", job.tool_token);
    expect(r.status, await r.clone().text()).toBe(201);
    const text = JSON.stringify(await data(r));
    expect(text).toContain("任された目的");
    expect(text).not.toContain("別のチケットの秘密の目的");
    expect(text).not.toContain(elsewhere);
    const audit = await k.q<{ action: string; target_id: string; actor_member_id: string; choke_point_id: string }>(
      "select action, target_id, actor_member_id, choke_point_id from audit_events where target_id = $1 and action like 'tool.%'",
      [t],
    );
    expect(audit).toEqual([{ action: "tool.ticket_read", target_id: t, actor_member_id: p.id, choke_point_id: "C2" }]);
  });

  it("K62-API-010 動いている × 中身のある結果で「終わった」：成果物の区画に新しい版・承認待ちの行（承認するのは担当者）・チケットは承認待ち。やり取りに 1 行", async () => {
    const { p, pc } = await fresh("作り終える人");
    const { t, d } = await started(p, pc);
    const r = await k.finish(pc, d.job_id, {
      state: "done",
      result: "見積：合計 120,000 円（内訳 3 行）",
      agent_session_id: SESS.k62, // Claude Code のセッションの id は uuid（契約・D-129.42）
    });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await data(r)).toMatchObject({ ok: true, outcome: "awaiting_approval" });
    const v = await artifactVersions(t);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ edited_by: p.id, edited_by_clone: true });
    expect(v[0]!.body.text).toBe("見積：合計 120,000 円（内訳 3 行）");
    expect(await approvalsOf(t)).toEqual([
      {
        kind: "artifact",
        status_id: "pending",
        approver_member_id: p.id,
        action_run_id: d.run_id,
        decision: null,
        irreversible: true,
      },
    ]);
    expect(await k.stageOf(t)).toBe("awaiting_approval");
    expect(await runRow(d.run_id)).toMatchObject({ status_id: "done" });
    expect((await runRow(d.run_id))["finished_at"]).not.toBeNull();
    const view = await data<{ checks: { state: string } }>(await k.run(p, d.run_id));
    expect(view.checks.state).toBe("none"); // 検査なし（まだ流していません・D-128.138）
    expect(await k.n("select count(*) as n from ticket_messages where ticket_id = $1 and kind = 'system'", [t])).toBe(
      2,
    );
    // 2 回目の成果物は版 2（前の版は残る）
    await k.f.admin.query(
      "update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = 'doing') where id = $1",
      [t],
    );
    await k.f.admin.query("update approvals set withdrawn_at = now() where ticket_id = $1", [t]);
    const d2 = await delegateOk(k, p, t);
    await k.takeJob(pc);
    await k.finish(pc, d2.job_id, { state: "done", result: "見積（直した）" });
    expect((await artifactVersions(t)).map((x) => x.version)).toEqual([1, 2]);
  });

  it("K62-API-044 成果物の版と承認待ちを作るのは作る段（phase make）の実行だけ：phase execute の仕事の終わりでは作らない（execute は K-63 が受ける）", async () => {
    const { p, pc } = await fresh("段を見る人");
    const { t, d } = await started(p, pc);
    await k.f.admin.query("update action_runs set phase = 'execute' where id = $1", [d.run_id]);
    await k.finish(pc, d.job_id, { state: "done", result: "送りました" });
    expect(await artifactVersions(t)).toHaveLength(0);
    expect(await approvalsOf(t)).toHaveLength(0);
  });

  it("K62-API-048 同じチケットの 2 回目の実行は、前の実行の会話の id を続きとして渡す（D-125.157）", async () => {
    const { p, pc } = await fresh("続きの人");
    const { t, d } = await started(p, pc);
    await k.finish(pc, d.job_id, { state: "stopped", reason: "あなたが止めました", agent_session_id: SESS.ticket1 });
    await delegateOk(k, p, t);
    const job = await k.takeJob(pc);
    expect(job["agent_session_id"]).toBe(SESS.ticket1);
  });

  it("K62-API-011 動いている × 空の結果で「終わった」：完了とみなさず止まった（E-SIG-004）。成果物にも承認待ちにもしない。チケットは作業中", async () => {
    for (const result of ["", "   \n ", null]) {
      const { p, pc } = await fresh("空を返す人");
      const { t, d } = await started(p, pc);
      const r = await k.finish(pc, d.job_id, { state: "done", ...(result === null ? {} : { result }) });
      expect(r.status).toBe(201);
      expect(await data(r)).toMatchObject({ outcome: "stopped" });
      expect(await runRow(d.run_id)).toMatchObject({ status_id: "stopped", error_summary: MSG.emptyResult });
      expect(await artifactVersions(t)).toHaveLength(0);
      expect(await approvalsOf(t)).toHaveLength(0);
      expect(await k.stageOf(t)).toBe("doing");
      expect((await systemLines(t)).at(-1)).toContain("止まりました");
    }
    expect(E.emptyResult).toBe("E-SIG-004");
  });

  it("K62-API-012 動いている × 使う量の枠に当たった・ログインしていない：PC が理由つきで止まったと送る。理由と戻る時刻が残る（E-LIM-010・E-CONN-010）", async () => {
    const { p, pc } = await fresh("枠の人");
    const { t, d } = await started(p, pc);
    const resets = Math.floor(Date.now() / 1000) + 3600;
    expect(
      (
        await k.progress(pc, d.job_id, {
          seq: 1,
          kind: "limit",
          windows: [{ window: "five_hour", utilization: 1, resets_at: resets }],
        })
      ).status,
    ).toBe(201);
    await k.finish(pc, d.job_id, { state: "stopped", reason: "サブスクの 5 時間の枠に達しました" });
    expect(await runRow(d.run_id)).toMatchObject({
      status_id: "stopped",
      error_summary: "サブスクの 5 時間の枠に達しました",
    });
    expect(
      await k.n("select count(*) as n from agent_usage_snapshots where member_id = $1 and window_id = 'five_hour'", [
        p.id,
      ]),
    ).toBe(1);
    const snap = await k.q<{ r: string }>(
      "select extract(epoch from resets_at)::bigint::text as r from agent_usage_snapshots where member_id = $1 and window_id = 'five_hour'",
      [p.id],
    );
    expect(Number(snap[0]!.r)).toBe(resets); // 戻る時刻がそのまま残る
    expect(await k.stageOf(t)).toBe("doing");
    const v = await data<{ stopped_reason: string; status: string }>(await k.run(p, d.run_id));
    expect(v).toMatchObject({ status: "stopped", stopped_reason: "サブスクの 5 時間の枠に達しました" });
  });

  it("K62-API-013 動いている × 最後の出来事から 9 分 59 秒・10 分 1 秒（確認待ちは 29 分 59 秒・30 分 1 秒）：10 分を過ぎたら silent。行は書き換えない（E-TO-005）", async () => {
    const { p, pc } = await fresh("黙る人");
    const { d } = await started(p, pc);
    await k.progress(pc, d.job_id, { seq: 1, kind: "status", text: "書いています" });
    const at = async (sec: number) => {
      await k.f.admin.query("update bridge_jobs set started_at = now() - make_interval(secs => $2) where id = $1", [
        d.job_id,
        sec,
      ]);
      await k.f.admin.query(
        "update bridge_job_events set created_at = now() - make_interval(secs => $2) where job_id = $1",
        [d.job_id, sec],
      );
      return data<{ silent: boolean; status: string }>(await k.run(p, d.run_id));
    };
    expect((await at(599)).silent).toBe(false);
    expect(await at(601)).toMatchObject({ silent: true, status: "running" });
    await k.f.admin.query("update bridge_jobs set state_id = 'asking' where id = $1", [d.job_id]);
    await k.f.admin.query("update action_runs set status_id = 'asking' where id = $1", [d.run_id]);
    expect((await at(1799)).silent).toBe(false);
    expect((await at(1801)).silent).toBe(true);
    // 読む口は書き換えない
    expect((await k.q("select state_id from bridge_jobs where id = $1", [d.job_id]))[0]!["state_id"]).toBe("asking");
    expect((await runRow(d.run_id))["status_id"]).toBe("asking");
  });

  it("K62-API-014 動いている（PC が落ちた後）× つながり直して「何も動かしていない」と取りに来る：その PC が受け取った仕事だけ止め、やり取りに「ここで止まりました」。もう 1 台の仕事は止めない。二度動かさない", async () => {
    const { p, pc } = await fresh("落ちた人");
    const pc2 = await k.device(p, "もう 1 台");
    const a = await started(p, pc); // 1 台目が受け取った
    const b = await k.ticket(p);
    const bd = await delegateOk(k, p, b);
    expect((await k.takeJob(pc2)).job_id).toBe(bd.job_id); // 2 台目が受け取った
    // 1 台目が「何も動かしていない」：1 台目の仕事だけ止まる
    expect((await k.take(pc, { idle: true })).status).toBe(201);
    expect((await runRow(a.d.run_id))["status_id"]).toBe("stopped");
    expect((await runRow(bd.run_id))["status_id"]).toBe("running");
    const lines = await k.q<{ body: string }>(
      "select body from ticket_messages where ticket_id = $1 and kind = 'system' order by created_at",
      [a.t],
    );
    expect(lines.at(-1)!.body).toContain("ここで止まりました");
    // 止めた仕事は二度渡さない
    expect((await data<{ job: { job_id: string } | null }>(await k.take(pc))).job?.job_id).not.toBe(a.d.job_id);
    expect(await k.stageOf(a.t)).toBe("doing");
  });

  it("K62-API-015 動いている × PC が止める合図を見に来る：止める理由が無ければ stop: false", async () => {
    const { p, pc } = await fresh("合図の人");
    const { d } = await started(p, pc);
    const r = await k.control(pc, d.job_id);
    expect(r.status).toBe(200);
    expect(await data(r)).toMatchObject({ stop: false });
  });

  it("K62-API-016 動いている × 担当が別の人に替わった：止めない（押した人の AI のまま・D-128.138）。結果は承認待ちになり、承認するのは結果が届いた時点の担当者", async () => {
    const { p, pc } = await fresh("押した人");
    const { t, d } = await started(p, pc);
    await k.f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t, other.id]);
    expect(await data(await k.control(pc, d.job_id))).toMatchObject({ stop: false });
    await k.finish(pc, d.job_id, { state: "done", result: "下書きができました" });
    expect(await approvalsOf(t)).toEqual([
      {
        kind: "artifact",
        status_id: "pending",
        approver_member_id: other.id,
        action_run_id: d.run_id,
        decision: null,
        irreversible: true,
      },
    ]);
  });

  it("K62-API-017 動いている × チケットが消された：control が止めるを返す。届いた結果は入れず、止まった「チケットが消されたので止めました」", async () => {
    const { p, pc } = await fresh("消される人");
    const { t, d } = await started(p, pc);
    await k.f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [t, p.id]);
    expect(await data(await k.control(pc, d.job_id))).toMatchObject({ stop: true, reason: MSG.ticketDeleted });
    const r = await k.finish(pc, d.job_id, { state: "done", result: "作りました" });
    expect(await data(r)).toMatchObject({ outcome: "stopped" });
    expect(await runRow(d.run_id)).toMatchObject({ status_id: "stopped", error_summary: MSG.ticketDeleted });
    expect(await artifactVersions(t)).toHaveLength(0);
    expect(await approvalsOf(t)).toHaveLength(0);
    expect((await systemLines(t)).at(-1)).toContain("止まりました");
  });

  it("K62-API-018 動いている × 押した人がメンバーから外れた・止められた：PC の口は 401。成果物にも承認待ちにもしない。その実行はその時点で止まり、チケットは作業中に戻り、ほかの直せる人が任せ直せる（E-AUTH-005・G-14・D-129.7）", async () => {
    for (const how of ["deleted_at", "suspended_at"]) {
      const { p, pc } = await fresh("外される人");
      const { t, d, job } = await started(p, pc);
      // 止めるときは止めた人も要る（members_suspended_ck）。外すとき（deleted_at）はそれだけ
      if (how === "suspended_at")
        await k.f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
          p.id,
          other.id,
        ]);
      else await k.f.admin.query("update members set deleted_at = now() where id = $1", [p.id]);
      expect((await k.take(pc)).status).toBe(401);
      expect((await k.progress(pc, d.job_id, { seq: 1, kind: "status", text: "x" })).status).toBe(401);
      expect((await k.control(pc, d.job_id)).status).toBe(401);
      expect((await k.tool(pc, d.job_id, "ticket_read", job.tool_token)).status).toBe(401);
      expect((await k.finish(pc, d.job_id, { state: "done", result: "作りました" })).status).toBe(401);
      expect(await artifactVersions(t)).toHaveLength(0);
      expect(await approvalsOf(t)).toHaveLength(0);
      // D-129.7：PC の口が 401 になるだけでなく、その実行は止まり、チケットは作業中に戻る（「実行中」のまま残さない）
      expect(await runRow(d.run_id), how).toMatchObject({ status_id: "stopped" });
      expect(
        (await k.q<{ state_id: string }>("select state_id from bridge_jobs where id = $1", [d.job_id]))[0]!.state_id,
        how,
      ).toBe("stopped");
      expect(await k.stageOf(t), how).toBe("doing");
      expect((await systemLines(t)).at(-1), how).toContain("止まりました");
      // 走っている実行が残らないので、ほかの直せる人が任せ直せる（409・E-CONF-013 にならない）
      const next = await fresh(`${how} の後に任せ直す人`);
      expect((await k.delegate(next.p, t)).status, how).toBe(201);
    }
  });

  it("K62-API-019 動いている × 押した人（担当者でない書ける人）の書く権限が無くなった（見るだけに）：道具は 403・control が止める・結果は入れない・段は作業中", async () => {
    // 担当者は ticket_writable が権限に関わらず true なので、押すのは担当者でも作った人でもない書ける人にする
    const assignee = await fresh("担当の人");
    const { p, pc } = await fresh("権限を外される人");
    const t = await k.ticket(assignee.p, { assignee: assignee.p });
    const d = await delegateOk(k, p, t);
    const job = await k.takeJob(pc);
    expect(job.job_id).toBe(d.job_id);
    await k.f.admin.query("update permissions set ability_id = 'view' where grantee_member_id = $1", [p.id]);
    expect((await k.tool(pc, d.job_id, "ticket_read", job.tool_token)).status).toBe(403);
    expect(await data(await k.control(pc, d.job_id))).toMatchObject({ stop: true, reason: MSG.noWrite });
    expect(await data(await k.finish(pc, d.job_id, { state: "done", result: "作りました" }))).toMatchObject({
      outcome: "stopped",
    });
    expect(await runRow(d.run_id)).toMatchObject({ status_id: "stopped", error_summary: MSG.noWrite });
    expect(await artifactVersions(t)).toHaveLength(0);
    expect(await approvalsOf(t)).toHaveLength(0);
    expect(await k.stageOf(t)).toBe("doing");
    expect((await systemLines(t)).at(-1)).toContain("止まりました");
  });

  it("K62-API-047 止まった（その PC を外した・K-91）× 実行の 1 件を読む：止まった理由「PC を外したので止まりました」をそのまま返す", async () => {
    const { p, pc } = await fresh("外した PC の人");
    const { d } = await started(p, pc);
    // 止めるのは端末を外す（K-91）。ここでは K-91 が書く形を DB に置いて、出し方だけを見る
    await k.f.admin.query(
      "update bridge_jobs set state_id = 'stopped', stopped_reason = $2, finished_at = now() where id = $1",
      [d.job_id, MSG.pcGone],
    );
    await k.f.admin.query(
      "update action_runs set status_id = 'stopped', error_summary = $2, finished_at = now() where id = $1",
      [d.run_id, MSG.pcGone],
    );
    expect(await data(await k.run(p, d.run_id))).toMatchObject({ status: "stopped", stopped_reason: MSG.pcGone });
  });

  it("K62-API-049 待っている（承認の後の実行・K-63 が積んだ行）× PC が取る：行の prompt と agent_session_id をそのまま渡す（組み直さない・D-128.176）", async () => {
    const { p, pc } = await fresh("実行を待つ人");
    const t = await k.ticket(p);
    // K-63 の承認の関数が積む形を、ここでは DB に直に置く（ticket_delegate と同じ引き方で prompt と続きの id を入れた行）
    const job = (
      await k.q<{ id: string }>(
        "insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, agent_session_id, kind, permission_mode) values ($1, $2, $3, 'queued', $4, 'sess-make-1', 'ticket', 'auto') returning id",
        [k.T.tenantId, k.T.rootScope, p.id, "承認された成果物を先方に送る（足し書き）"],
      )
    )[0]!.id;
    // その実行を許した承認（K-63 の守り：承認の無い承認の後の実行は PC に渡さない・2 層目）。作る段の実行 → 承認（approved）→ 実行の approval_id
    const make = (
      await k.q<{ id: string }>(
        "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, finished_at, created_by) values ($1, $2, $3, 'make', 'done', now(), $4) returning id",
        [k.T.tenantId, k.T.rootScope, t, p.id],
      )
    )[0]!.id;
    const approval = (
      await k.q<{ id: string }>(
        `insert into approvals (tenant_id, scope_id, ticket_id, kind, action_run_id, approver_member_id, status_id, decision, decided_at, irreversible, step_up_at)
         values ($1, $2, $3, 'artifact', $4, $5, 'approved', 'approve', now(), true, now()) returning id`,
        [k.T.tenantId, k.T.rootScope, t, make, p.id],
      )
    )[0]!.id;
    await k.f.admin.query(
      "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, approval_id, created_by) values ($1, $2, $3, 'execute', 'queued', $4, $5, $6)",
      [k.T.tenantId, k.T.rootScope, t, job, approval, p.id],
    );
    const got = await k.takeJob(pc);
    expect(got).toMatchObject({
      job_id: job,
      kind: "ticket",
      ticket_id: t,
      phase: "execute",
      prompt: "承認された成果物を先方に送る（足し書き）",
      agent_session_id: "sess-make-1",
      permission_mode: "auto",
    });
  });

  it("K62-API-050 動いている × 受け取っていない PC（同じ会社の別の人・別の会社の人・同じ人の 2 台目）が、その仕事に様子・合図・終わりを送る：404。何も書かない", async () => {
    const { p, pc } = await fresh("受け取った人");
    const second = await k.device(p, "同じ人の 2 台目");
    const sameCo = await fresh("同じ会社の人");
    const otherCo = await k.f.person(k.O.tenantId, k.O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    const otherCoPc = await k.device(otherCo, "別の会社の PC");
    const { t, d } = await started(p, pc);
    for (const intruder of [sameCo.pc, otherCoPc, second]) {
      expect((await k.progress(intruder, d.job_id, { seq: 9, kind: "status", text: "のっとり" })).status).toBe(404);
      expect((await k.control(intruder, d.job_id)).status).toBe(404);
      expect((await k.finish(intruder, d.job_id, { state: "done", result: "のっとり" })).status).toBe(404);
    }
    expect(await k.n("select count(*) as n from bridge_job_events where job_id = $1", [d.job_id])).toBe(0);
    expect(await runRow(d.run_id)).toMatchObject({ status_id: "running" });
    expect(await artifactVersions(t)).toHaveLength(0);
    expect(await approvalsOf(t)).toHaveLength(0);
  });

  it("K62-API-051 守り：道具は仕事の種類で分ける。チケットの仕事の鍵で会話の道具（draft_read・goal_set・remember）は 403、会話の仕事の鍵で ticket_read は 403", async () => {
    const { p, pc } = await fresh("道具の人");
    const { t, d, job } = await started(p, pc);
    for (const name of ["draft_read", "goal_set", "remember"])
      expect((await k.tool(pc, d.job_id, name, job.tool_token, {})).status, name).toBe(403);
    await k.finish(pc, d.job_id, { state: "done", result: "見積" });
    const conv = (
      await k.q<{ id: string }>(
        "insert into conversations (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'K62 道具') returning id",
        [k.T.tenantId, k.T.rootScope, p.id],
      )
    )[0]!.id;
    await k.f.admin.query(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode) values ($1, $2, $3, $4, 'queued', '目標を置いて', 'chat', 'manual')",
      [k.T.tenantId, k.T.rootScope, p.id, conv],
    );
    const chat = await k.takeJob(pc);
    expect(chat.kind).toBe("chat");
    const r = await k.tool(pc, chat.job_id, "ticket_read", chat.tool_token);
    expect(r.status).toBe(403);
    expect(await r.text()).not.toContain(t);
  });

  it("K62-API-053 守り：PC の口の上限：取る・様子・道具・終わりは 1 分に 61 回目、合図は 121 回目で 429 と待つ秒数", async () => {
    const { p, pc } = await fresh("急ぐ PC");
    const { d, job } = await started(p, pc);
    const saved = { ...k.f.limits };
    for (const op of ["takeBridgeJob", "reportJobProgress", "getJobControl", "callKanameTool", "finishBridgeJob"])
      delete k.f.limits[op];
    try {
      const over = async (n: number, call: () => Promise<Response>) => {
        for (let i = 0; i < n; i++) await call();
        const r = await call();
        expect(r.status).toBe(429);
        expect(Number(((await r.json()) as Record<string, unknown>)["retry_after_sec"])).toBeGreaterThan(0);
      };
      await over(60, () => k.take(pc));
      await over(60, () => k.progress(pc, d.job_id, { seq: 1, kind: "status", text: "x" }));
      await over(120, () => k.control(pc, d.job_id));
      await over(60, () => k.tool(pc, d.job_id, "ticket_read", job.tool_token));
      // 終わりは 1 回目で仕事が終わるので、無い仕事の id で数える（上限は 404 より先に見る・口の順は 上限 → 認証 → …）
      const none = randomUUID();
      await over(60, () => k.finish(pc, none, { state: "done", result: "x" }));
      expect((await runRow(d.run_id))["status_id"], "上限で止めた終わりは仕事に触らない").toBe("running");
    } finally {
      Object.assign(k.f.limits, saved);
    }
  }, 60_000); // 1 回の試験で口を 360 回呼ぶ（重い台でも既定の 5 秒で切らない）

  it("K62-API-054 動いている × PC が止まった・やめたで「終わった」：実行は stopped・cancelled、段は作業中に戻り、やり取りに止まった 1 行", async () => {
    for (const [state, status] of [
      ["stopped", "stopped"],
      ["cancelled", "cancelled"],
    ] as const) {
      const { p, pc } = await fresh(`${state} の人`);
      const { t, d } = await started(p, pc);
      const r = await k.finish(pc, d.job_id, { state, reason: "あなたが止めました" });
      expect(await data(r)).toMatchObject({ outcome: "stopped" });
      expect(await runRow(d.run_id)).toMatchObject({ status_id: status });
      expect(await k.stageOf(t)).toBe("doing");
      expect((await systemLines(t)).at(-1)).toContain("止まりました");
    }
  });

  it("K62-API-055 動いている（受け取った PC の列が空の古い行）× その人の PC が「何も動かしていない」と取りに来る：古い行は止める（どの PC が受け取ったか分からないので、その人の PC で片づける）", async () => {
    const { p, pc } = await fresh("古い行の人");
    const { d } = await started(p, pc);
    await k.f.admin.query("update bridge_jobs set taken_session_id = null where id = $1", [d.job_id]);
    const another = await k.device(p, "別の 1 台");
    await k.take(another, { idle: true });
    expect((await runRow(d.run_id))["status_id"]).toBe("stopped");
  });

  it("K62-API-043 会話（chat）の仕事が待っている間に任せる：同じ PC が古い順に片づける。会話の仕事も契約の口で取れて、結末が会話に入る", async () => {
    const { p, pc } = await fresh("会話もする人");
    const conv = (
      await k.q<{ id: string }>(
        "insert into conversations (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'K62 の会話') returning id",
        [k.T.tenantId, k.T.rootScope, p.id],
      )
    )[0]!.id;
    await k.f.admin.query(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode) values ($1, $2, $3, $4, 'queued', '今月の売上は？', 'chat', 'manual')",
      [k.T.tenantId, k.T.rootScope, p.id, conv],
    );
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    const chat = await k.takeJob(pc);
    expect(chat).toMatchObject({ kind: "chat", conversation_id: conv });
    expect(await data(await k.finish(pc, chat.job_id, { state: "done", result: "120 万円です" }))).toMatchObject({
      outcome: "done",
    });
    expect(
      await k.n(
        "select count(*) as n from messages where conversation_id = $1 and kind = 'ai' and body = '120 万円です'",
        [conv],
      ),
    ).toBe(1);
    expect((await k.takeJob(pc)).job_id).toBe(d.job_id);
  });
});

describe("K-62 AI に任せる：PC の口の入力・失敗・操作の揺れ・守り", () => {
  it("K62-API-032 入力：progress の kind が決まった値でない・知らない欄・finish の state が違う・結果が 200000 字を超える・道具の名前が無い／知らない・取るの体の型が違う／知らない欄・仕事の id が uuid でない（終わり・合図）：422。仕事は動いたまま", async () => {
    const { p, pc } = await fresh("形の違う人");
    const { d, job } = await started(p, pc);
    expect((await k.progress(pc, d.job_id, { seq: 1, kind: "secret" })).status).toBe(422);
    expect((await k.progress(pc, d.job_id, { seq: 1, kind: "status", text: "x", job_id: d.job_id })).status).toBe(422);
    expect((await k.finish(pc, d.job_id, { state: "approved", result: "x" })).status).toBe(422);
    expect((await k.finish(pc, d.job_id, { state: "done", result: "あ".repeat(200_001) })).status).toBe(422);
    expect((await k.tool(pc, d.job_id, "send_mail", job.tool_token)).status).toBe(422);
    expect(
      (
        await k.f.req("POST", "/bridge/jobs/abc/finish", {
          body: { state: "done" },
          headers: { "x-bridge-session": pc.token },
        })
      ).status,
    ).toBe(422);
    expect(
      (await k.f.req("GET", "/bridge/jobs/abc/control", { headers: { "x-bridge-session": pc.token } })).status,
    ).toBe(422);
    expect((await k.take(pc, { wait_sec: "すぐ" })).status).toBe(422);
    expect((await k.take(pc, { job_id: d.job_id })).status).toBe(422);
    expect((await runRow(d.run_id))["status_id"]).toBe("running");
  });

  it("K62-API-033 入力：progress の文が長すぎる（400 字・返事は 200000 字を超える）：切って入れる", async () => {
    const { p, pc } = await fresh("長い人");
    const { d } = await started(p, pc);
    await k.progress(pc, d.job_id, { seq: 1, kind: "status", text: "あ".repeat(1000) });
    await k.progress(pc, d.job_id, { seq: 2, kind: "reply", text: "い".repeat(200_100) });
    const ev = await k.q<{ kind: string; len: number }>(
      "select kind, length(payload->>'text') as len from bridge_job_events where job_id = $1 order by seq",
      [d.job_id],
    );
    expect(ev).toEqual([
      { kind: "status", len: 400 },
      { kind: "reply", len: 200_000 },
    ]);
  });

  it("K62-API-081 入力：finish の結果の字数は文字（コードポイント）で数える（契約の maxLength と同じ）。4 バイトの字（😀）で 200001 字は 422・200000 字ちょうどは受けて承認待ちになり、成果物に全部入る", async () => {
    const { p, pc } = await fresh("絵文字の結果の人");
    const { t, d } = await started(p, pc);
    const over = await k.finish(pc, d.job_id, { state: "done", result: "😀".repeat(200_001) });
    expect(over.status).toBe(422);
    expect((await runRow(d.run_id))["status_id"]).toBe("running");
    const ok = await k.finish(pc, d.job_id, { state: "done", result: "😀".repeat(200_000) });
    expect(ok.status).toBe(201);
    expect(await data(ok)).toMatchObject({ ok: true, outcome: "awaiting_approval" });
    expect(await artifactVersions(t)).toHaveLength(1);
    expect(await k.stageOf(t)).toBe("awaiting_approval");
  });

  it("K62-API-082 入力：progress の文を切る所が 4 バイトの字の途中・文に片割れの字（孤立したサロゲート）がある：500 にせず、文字の単位で切って入れる（片割れは U+FFFD に置き換える）", async () => {
    const { p, pc } = await fresh("絵文字の様子の人");
    const { d } = await started(p, pc);
    expect((await k.progress(pc, d.job_id, { seq: 1, kind: "status", text: "a" + "😀".repeat(500) })).status).toBe(201);
    expect((await k.progress(pc, d.job_id, { seq: 2, kind: "reply", text: "a" + "😀".repeat(100_000) })).status).toBe(
      201,
    );
    expect((await k.progress(pc, d.job_id, { seq: 3, kind: "status", text: "前\ud83d後" })).status).toBe(201);
    const ev = await k.q<{ kind: string; text: string }>(
      "select kind, payload->>'text' as text from bridge_job_events where job_id = $1 order by seq",
      [d.job_id],
    );
    expect(ev.map((e) => [e.kind, [...e.text].length])).toEqual([
      ["status", 400],
      ["reply", 100_001],
      ["status", 3],
    ]);
    expect(ev[0]!.text).toBe("a" + "😀".repeat(399));
    expect(ev[2]!.text).toBe("前�後");
    expect((await runRow(d.run_id))["status_id"]).toBe("running");
  });

  it("K62-API-035 守り：同じ finish が 2 回届く（同じ冪等キー・回線で送り直し）：1 回分だけ。2 回目は 1 回目と同じ中身。鍵なしの 3 回目は終わった仕事として 404", async () => {
    const { p, pc } = await fresh("2 回送る人");
    const { t, d } = await started(p, pc);
    const key = { "idempotency-key": `k62-${d.job_id}` };
    const body = { state: "done", result: "見積です" };
    const [a, b] = await Promise.all([k.finish(pc, d.job_id, body, key), k.finish(pc, d.job_id, body, key)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const [ja, jb] = [await a.json(), await b.json()];
    expect(jb).toEqual(ja);
    expect(ja).toMatchObject({ data: { ok: true, outcome: "awaiting_approval" } });
    expect(await artifactVersions(t)).toHaveLength(1);
    expect(await approvalsOf(t)).toHaveLength(1);
    expect((await k.finish(pc, d.job_id, body)).status).toBe(404);
    expect(await artifactVersions(t)).toHaveLength(1);
  });

  it("K62-API-062 どれでも × PC の口（取る・様子・合図・終わり・道具）を画面のセッションで呼ぶ：403（役が合わない）。仕事を渡さず、仕事も実行の記録も変わらない", async () => {
    const { p, pc } = await fresh("画面で PC の口を呼ぶ人");
    const { d, job } = await started(p, pc);
    const events = await k.n("select count(*) as n from bridge_job_events where job_id = $1", [d.job_id]);
    for (const [m, path] of [
      ["POST", "/bridge/jobs/take"],
      ["POST", `/bridge/jobs/${d.job_id}/progress`],
      ["GET", `/bridge/jobs/${d.job_id}/control`],
      ["POST", `/bridge/jobs/${d.job_id}/finish`],
      ["POST", `/bridge/jobs/${d.job_id}/tools/ticket_read`],
    ] as const) {
      const r = await k.f.req(m, path, {
        headers: { ...p.auth, "x-kaname-tool-token": job.tool_token! },
        ...(m === "POST" ? { body: {} } : {}),
      });
      expect(r.status, `${m} ${path}`).toBe(403);
      expect(((await r.json()) as Record<string, unknown>)["data"], `${m} ${path} は中身を返さない`).toBeUndefined();
    }
    expect((await runRow(d.run_id))["status_id"]).toBe("running");
    expect(await k.n("select count(*) as n from bridge_job_events where job_id = $1", [d.job_id])).toBe(events);
  });

  it("K62-API-061 守り：同じ冪等キーで送り直された取る・様子・道具：2 回目は 1 回目と同じ中身を返し、副作用を繰り返さない（出来事・証跡は 1 つ・別の仕事を渡さない）", async () => {
    const { p, pc } = await fresh("送り直す PC");
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    const second = await delegateOk(k, p, await k.ticket(p));
    const dev = (key: string) => ({ "x-bridge-session": pc.token, "idempotency-key": `k62-${key}-${d.job_id}` });
    const takeBody = { wait_sec: 0, protocol: PROTOCOL, idle: false };
    const t1 = await k.f.req("POST", "/bridge/jobs/take", { body: takeBody, headers: dev("take") });
    const t2 = await k.f.req("POST", "/bridge/jobs/take", { body: takeBody, headers: dev("take") });
    expect([t1.status, t2.status]).toEqual([201, 201]);
    const [j1, j2] = [await t1.json(), await t2.json()];
    expect(j2).toEqual(j1);
    const job = (j1 as { data: { job: { job_id: string; tool_token: string } } }).data.job;
    expect(job.job_id).toBe(d.job_id);
    expect(await queuedFor(p.id), "2 回目で次の仕事を渡さない").toBe(1);
    expect((await runRow(second.run_id))["status_id"]).toBe("queued");

    const ev = { seq: 1, kind: "status", text: "見積を読んでいます" };
    for (let i = 0; i < 2; i++)
      expect(
        (await k.f.req("POST", `/bridge/jobs/${d.job_id}/progress`, { body: ev, headers: dev("progress") })).status,
      ).toBe(201);
    expect(
      await k.n("select count(*) as n from bridge_job_events where job_id = $1 and kind = 'status'", [d.job_id]),
    ).toBe(1);

    const tool = () =>
      k.f.req("POST", `/bridge/jobs/${d.job_id}/tools/ticket_read`, {
        body: { input: {} },
        headers: { ...dev("tool"), "x-kaname-tool-token": job.tool_token },
      });
    const [a, b] = [await tool(), await tool()];
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await b.json()).toEqual(await a.json());
    expect(
      await k.n("select count(*) as n from audit_events where target_id = $1 and action = 'tool.ticket_read'", [t]),
    ).toBe(1);
  });

  it("K62-API-036 守り：終わった仕事の道具の鍵・別の人の仕事の鍵・鍵なし：403 で書けない。道具の鍵は DB にハッシュだけ", async () => {
    const { p, pc } = await fresh("鍵の人");
    const { d, job } = await started(p, pc);
    const token = job.tool_token!;
    const row = (
      await k.q<{ tool_token_hash: string }>("select tool_token_hash from bridge_jobs where id = $1", [d.job_id])
    )[0]!;
    expect(row.tool_token_hash).toBe(sha(token));
    expect(
      await k.n(
        "select count(*) as n from bridge_jobs j where j.id = $1 and (j.prompt like '%' || $2 || '%' or coalesce(j.result, '') like '%' || $2 || '%')",
        [d.job_id, token],
      ),
    ).toBe(0);
    expect((await k.tool(pc, d.job_id, "ticket_read", null)).status).toBe(403);
    // 別の人の仕事の鍵で、自分の仕事の道具を呼ぶ
    const q = await fresh("別の鍵の人");
    const theirs = await started(q.p, q.pc);
    expect((await k.tool(pc, d.job_id, "ticket_read", theirs.job.tool_token)).status).toBe(403);
    expect((await k.tool(q.pc, d.job_id, "ticket_read", token)).status).toBe(403);
    await k.finish(pc, d.job_id, { state: "done", result: "できました" });
    expect((await k.tool(pc, d.job_id, "ticket_read", token)).status).toBe(403);
  });

  it("K62-API-037 守り：ログにプロンプト・結果の全文・道具の鍵・PC の印が出ない", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m));
    try {
      const { p, pc } = await fresh("ログの人");
      const { d, job } = await started(p, pc, "ログに出してはいけない目的");
      await k.tool(pc, d.job_id, "ticket_read", job.tool_token);
      await k.finish(pc, d.job_id, { state: "done", result: "ログに出してはいけない結果" });
      const out = spies.flatMap((s) => s.mock.calls.map((c) => c.map(String).join(" "))).join("\n");
      for (const secret of ["ログに出してはいけない目的", "ログに出してはいけない結果", job.tool_token!, pc.token])
        expect(out).not.toContain(secret);
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });

  it("K62-API-038 守り：PC に資格情報を渡さない。take の答えに資格情報の値が無く、禁止のドメインを一緒に渡す", async () => {
    const { p, pc } = await fresh("資格情報の人");
    const t = await k.ticket(p);
    await delegateOk(k, p, t);
    const r = await k.take(pc);
    const body = await r.text();
    for (const word of ["ciphertext", "password", "vault_ref", "secret"]) expect(body).not.toContain(word);
    const d = JSON.parse(body).data as { forbidden_domains: unknown[]; job: Record<string, unknown> };
    expect(Array.isArray(d.forbidden_domains)).toBe(true);
    expect(d.job["permission_mode"]).toBe("manual");
  });

  it("K62-API-039 守り：PC の口を PC の印なし・形の違う印で呼ぶ：401。印が無いのに画面のログインへ落とさない", async () => {
    const { p, pc } = await fresh("印の無い人");
    const { d } = await started(p, pc);
    expect((await k.f.req("POST", "/bridge/jobs/take", { body: { protocol: 5 } })).status).toBe(401);
    const bad = { "x-bridge-session": `kpc_${"A".repeat(43)}` };
    expect((await k.f.req("GET", `/bridge/jobs/${d.job_id}/control`, { headers: bad })).status).toBe(401);
    expect(
      (
        await k.f.req("POST", `/bridge/jobs/${d.job_id}/finish`, {
          body: { state: "done" },
          headers: { ...bad, ...p.auth },
        })
      ).status,
    ).toBe(401);
    expect((await runRow(d.run_id))["status_id"]).toBe("running");
  });
});

/** 会話の仕事を 1 件積み、その人の PC で取る（会話の仕事は契約の口の上で前と同じに動く・K62-API-043） */
const chatTaken = async (p: Person, pc: Device, prompt = "今月の売上は？") => {
  const conv = (
    await k.q<{ id: string }>(
      "insert into conversations (tenant_id, scope_id, owner_member_id, title) values ($1, $2, $3, 'K62 の会話') returning id",
      [k.T.tenantId, k.T.rootScope, p.id],
    )
  )[0]!.id;
  await k.f.admin.query(
    "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode) values ($1, $2, $3, $4, 'queued', $5, 'chat', 'manual')",
    [k.T.tenantId, k.T.rootScope, p.id, conv, prompt],
  );
  const job = await k.takeJob(pc);
  expect(job.kind).toBe("chat");
  return { conv, job };
};
/** 記憶のまとめ（D-105.2）を始め、その人の PC で取る。会話の無い仕事 */
const digestTaken = async (p: Person, pc: Device) => {
  const digest = (
    await k.q<{ v: string }>("select app.agent_digest_start($1, current_date - 1, current_date, 1, $2) as v", [
      p.id,
      "きのうの会話を記憶にまとめて、JSON 1 つで答えてください",
    ])
  )[0]!.v;
  expect(digest, "PC がつながっていればまとめが始まる").toBeTruthy();
  const job = await k.takeJob(pc);
  expect(job.conversation_id).toBeNull();
  return { digest, job };
};
const digestRow = async (id: string) =>
  (
    await k.q<{ state_id: string; reason: string | null }>(
      "select state_id, result->>'reason' as reason from memory_digests where id = $1",
      [id],
    )
  )[0]!;

describe("K-62 AI に任せる：前の道すじから契約の口へ移した中身（途中の様子の形・待ち受け・会話の結末・道具の失敗）", () => {
  it("K62-API-063 途中の様子の種類ごとの形：決めた欄だけを残し、知らない欄と全文は持たない（init・tool・usage・plan・limit・blocked・reply・notice・D-100・D-104）", async () => {
    const { p, pc } = await fresh("様子の形の人");
    const { d } = await started(p, pc);
    const send = async (seq: number, body: Record<string, unknown>) =>
      expect((await k.progress(pc, d.job_id, { seq, ...body })).status, JSON.stringify(body).slice(0, 80)).toBe(201);
    await send(1, { kind: "init", agent_session_id: SESS.k6263, model: "claude-opus-5-5" });
    await send(2, { kind: "init", agent_session_id: SESS.k6263b, model: "悪い 名前; drop" });
    await send(3, {
      kind: "tool",
      tool: { name: "Read", target: "見積.xlsx", ok: true, ms: 12.6, input: "全文は持たない" },
    });
    await send(4, { kind: "tool", tool: { name: "Bash", ok: "yes", ms: -5 } });
    await send(5, {
      kind: "usage",
      usage: { turns: 3, input_tokens: "120", output_tokens: null, cost_usd: "", secret: 9 },
    });
    await send(6, {
      kind: "plan",
      todos: [
        { content: "前回の見積を読む", status: "completed" },
        { activeForm: "内訳を書いています", status: "謎" },
        null,
      ],
    });
    await send(7, {
      kind: "limit",
      windows: [
        { window: "five_hour", utilization: 1.7, resets_at: 1_900_000_000 },
        { window: "month", utilization: 0.1, resets_at: 1 },
        { window: "week", utilization: "x", resets_at: 1 },
      ],
    });
    await send(8, {
      kind: "blocked",
      blocked: { tool: "Navigate", domain: "bank.example.jp", service: "銀行", target: "/login", extra: "捨てる" },
    });
    await send(9, { kind: "notice", text: "お".repeat(500) });
    const ev = Object.fromEntries(
      (
        await k.q<{ seq: number; payload: Record<string, unknown> }>(
          "select seq, payload from bridge_job_events where job_id = $1 order by seq",
          [d.job_id],
        )
      ).map((x) => [x.seq, x.payload]),
    );
    expect(ev[1]).toEqual({ agent_session_id: SESS.k6263, model: "claude-opus-5-5" });
    expect(ev[2]).toEqual({ agent_session_id: SESS.k6263b, model: null }); // 名前の形でないモデルは持たない
    expect(ev[3]).toEqual({ name: "Read", target: "見積.xlsx", ok: true, ms: 13 });
    expect(ev[4]).toEqual({ name: "Bash", target: "", ok: false, ms: null }); // ok は true だけ・負の時間は持たない
    expect(ev[5]).toEqual({
      turns: 3,
      duration_ms: null,
      api_ms: null,
      input_tokens: 120,
      output_tokens: null,
      cache_read_tokens: null,
      cache_write_tokens: null,
      cost_usd: null,
    });
    expect(ev[6]).toEqual({
      todos: [
        { content: "前回の見積を読む", status: "completed" },
        { content: "内訳を書いています", status: "pending" },
        { content: "", status: "pending" },
      ],
    });
    expect(ev[7]).toEqual({ windows: [{ window: "five_hour", utilization: 1, resets_at: 1_900_000_000 }] });
    expect(ev[8]).toEqual({ tool: "Navigate", domain: "bank.example.jp", service: "銀行", target: "/login" });
    expect((ev[9] as { text: string }).text).toHaveLength(400);
    expect(JSON.stringify(ev)).not.toContain("全文は持たない");
    expect(JSON.stringify(ev)).not.toContain("捨てる");
  });

  it("K62-API-064 待ち受け（取る）：渡す仕事が無ければ、動きのある人の PC は wait_sec だけ待って返し、間をあけずに聞き直してもらう（next_ms 0）。動きの無い人の PC は待たずに返し 5 秒あけてもらう（D-097・G-16）", async () => {
    const quiet = await fresh("動きの無い人");
    let t0 = Date.now();
    const a = await data<{ job: unknown; next_ms: number; outdated: boolean }>(await k.take(quiet.pc, { wait_sec: 1 }));
    expect(Date.now() - t0, "待たない").toBeLessThan(900);
    expect(a).toMatchObject({ job: null, next_ms: 5000, outdated: false });

    const busy = await fresh("さっきまで動いていた人");
    const { d } = await started(busy.p, busy.pc);
    await k.finish(busy.pc, d.job_id, { state: "done", result: "見積です" }); // 5 分以内に終わった仕事がある＝動きがある
    t0 = Date.now();
    const b = await data<{ job: unknown; next_ms: number }>(await k.take(busy.pc, { wait_sec: 1 }));
    expect(Date.now() - t0, "wait_sec だけ待つ").toBeGreaterThanOrEqual(900);
    expect(b).toMatchObject({ job: null, next_ms: 0 });
  });

  it("K62-API-065 会話の仕事の結末：返事の「[[覚える: …]]」は返事から消して個人の記憶に入れる（D-105.1）。結末は会話に入る", async () => {
    const { p, pc } = await fresh("覚えさせる人");
    const { conv, job } = await chatTaken(p, pc);
    const r = await k.finish(pc, job.job_id, { state: "done", result: "120 万円です。[[覚える: 締めは毎月 25 日]]" });
    expect(await data(r)).toMatchObject({ ok: true, outcome: "done" });
    const msg = await k.q<{ body: string }>(
      "select body from messages where conversation_id = $1 and kind = 'ai' order by created_at",
      [conv],
    );
    expect(msg.map((x) => x.body)).toEqual(["120 万円です。"]);
    expect(
      await k.n("select count(*) as n from memories where owner_member_id = $1 and body = '締めは毎月 25 日'", [p.id]),
    ).toBe(1);
  });

  it("K62-API-066 記憶のまとめの仕事の結末：決まった形（JSON）なら記憶に入れて済み。形が違う・止まった（理由あり／なし）なら入れずに失敗と理由を残す（D-105.4）", async () => {
    const { p, pc } = await fresh("まとめる人");
    // 決まった形
    const ok = await digestTaken(p, pc);
    const json =
      '```json\n{"remembered":[{"title":"定休","body":"金曜は定休","kind":"rule"}],"merged":[],"propose":[],"discarded":[]}\n```';
    expect((await k.finish(pc, ok.job.job_id, { state: "done", result: json })).status).toBe(201);
    expect(await digestRow(ok.digest)).toMatchObject({ state_id: "done", reason: null });
    expect(
      await k.n(
        "select count(*) as n from memories where owner_member_id = $1 and body = '金曜は定休' and digest_id = $2",
        [p.id, ok.digest],
      ),
    ).toBe(1);
    // 形が違う・止まった（理由あり・理由なし）
    for (const [body, reason] of [
      [
        { state: "done", result: "まとめました。特にありません" },
        "自分のAI の答えが決まった形（JSON）ではありませんでした。もう一度押してください",
      ],
      [{ state: "stopped", reason: "あなたが止めました" }, "あなたが止めました"],
      [{ state: "stopped" }, "止まりました"],
    ] as const) {
      const g = await digestTaken(p, pc);
      expect((await k.finish(pc, g.job.job_id, body)).status, JSON.stringify(body)).toBe(201);
      expect(await digestRow(g.digest), JSON.stringify(body)).toEqual({ state_id: "failed", reason });
    }
    expect(await k.n("select count(*) as n from memories where owner_member_id = $1", [p.id])).toBe(1);
  });

  it("K62-API-067 会話の仕事の道具（契約の口へ移した 8 つ）：道具の答えが失敗（error）なら 422 と理由を返し、何も書かない。通れば 201 と答え", async () => {
    const { p, pc } = await fresh("会話の道具の人");
    const { job } = await chatTaken(p, pc, "目標を置いて");
    const goals = () => k.n("select count(*) as n from goals where created_by = $1", [p.id]);
    const before = await goals();
    const bad = await k.tool(pc, job.job_id, "goal_set", job.tool_token, { target_value: 100 });
    expect(bad.status).toBe(422);
    const b = (await bad.json()) as { code: string; details: { field: string; message: string }[] };
    expect(b.code).toBe("VALIDATION_ERROR");
    expect(b.details).toEqual([{ field: "input", message: "目標の名前が要ります" }]);
    expect(await goals()).toBe(before);
    const good = await k.tool(pc, job.job_id, "goal_set", job.tool_token, { name: "売上 1000 万", target_value: 1000 });
    expect(good.status, await good.clone().text()).toBe(201);
    expect((await data<{ result: { done: string; name: string } }>(good)).result).toMatchObject({
      done: "created",
      name: "売上 1000 万",
    });
    expect(await goals()).toBe(before + 1);
  });
});

/** 前の道すじ /api/auth-ext/bridge/artifact（道具の鍵だけで受ける口）を、本物の置き場の代わりの一時のフォルダで立てる */
const artifactRoute = async () => {
  const objects = new ObjectStore(
    await createRepository(k.f.pool),
    localDriver(mkdtempSync(join(tmpdir(), "k62-art-"))),
    {
      signingSecret: "k62-test",
    },
  );
  const app = agentToolRoutes({ appPool: k.f.pool, objects });
  return (token: string | null, name = "見積.txt") =>
    app.request("http://localhost/bridge/artifact", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        ...(token ? { "x-kaname-tool-token": token } : {}),
        "x-artifact-name": encodeURIComponent(name),
      },
      body: "成果物の中身",
    });
};
const artifactsOf = (jobId: string) => k.n("select count(*) as n from artifacts where source_job_id = $1", [jobId]);

describe("K-62 AI に任せる：回 2 の確かめで出た守りと形（契約の形・前の道すじ・結果の扱い・DB の 2 層目・会話の続き）", () => {
  it("K62-API-069 答えが契約の形どおり：実行の 1 件・実行の一覧の 1 件（ActionRunView）と止める合図（JobControl）は、まだ無い時刻・途中の 1 行・止まった理由・差し戻しの理由・止める理由を null で返し、契約の形で読める", async () => {
    const { p, pc } = await fresh("契約の形の人");
    // 待っている（始めた時刻・途中の 1 行・止まった理由が無い）
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    const queued = await data(await k.run(p, d.run_id));
    expect(queued).toMatchObject({
      started_at: null,
      finished_at: null,
      progress: null,
      stopped_reason: null,
      return_reason: null,
    });
    const parse = (v: unknown, what: string) => {
      const r = ActionRunView.safeParse(v);
      expect(r.success, `${what}：${JSON.stringify(r.error?.issues ?? [])}`).toBe(true);
    };
    parse(queued, "待っている実行");
    // 動いている → 止まった（理由あり・終わった時刻あり）
    await k.takeJob(pc);
    const ctl = await data(await k.control(pc, d.job_id));
    expect(ctl).toMatchObject({ stop: false, reason: null });
    const c = JobControl.safeParse(ctl);
    expect(c.success, JSON.stringify(c.error?.issues ?? [])).toBe(true);
    await k.finish(pc, d.job_id, { state: "stopped", reason: "枠に達しました" });
    const stopped = await data(await k.run(p, d.run_id));
    expect(stopped).toMatchObject({ status: "stopped", stopped_reason: "枠に達しました" });
    parse(stopped, "止まった実行");
    const list = await data<unknown[]>(await k.runs(p, t));
    expect(list.length).toBeGreaterThan(0);
    list.forEach((x, i) => parse(x, `一覧の ${i} 件目`));
  });

  it("K62-API-070 守り：前の道すじ /api/auth-ext/bridge/artifact は、チケットの仕事の道具の鍵では成果物を置けない（403・置き場にも成果物にも何も残らない）。会話の仕事の鍵でも、押した人が止められた後は 401（D-110・D-129.44・G-14）", async () => {
    const put = await artifactRoute();
    // チケットの仕事の鍵：その仕事で使える道具は ticket_read だけ（契約の口と同じ決め）
    const { p, pc } = await fresh("鍵だけで置こうとする人");
    const { d, job } = await started(p, pc);
    const r = await put(job.tool_token, "id_rsa.txt");
    expect(r.status).toBe(403);
    expect(await artifactsOf(d.job_id)).toBe(0);
    // 会話の仕事の鍵：止められる前は置ける（前の道すじの振る舞いのまま）、止められた後は 401
    const q = await fresh("会話で成果物を置く人");
    const { job: chat } = await chatTaken(q.p, q.pc);
    expect((await put(chat.tool_token)).status).toBe(201);
    expect(await artifactsOf(chat.job_id)).toBe(1);
    await k.f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      q.p.id,
      other.id,
    ]);
    expect((await put(chat.tool_token)).status).toBe(401);
    expect(await artifactsOf(chat.job_id)).toBe(1);
  });

  it("K62-API-071 チケットの仕事の結果は本人の書いたまま成果物に残す（空白・空行・「[[覚える: …]]」も消さない）。個人の記憶には書かない（会話の仕事だけの後処理・D-105.1 はチケットの仕事に効かない）", async () => {
    const { p, pc } = await fresh("書いたまま残す人");
    const raw = "  見積\n\n\n\n  1 行目 [[覚える: 取引先Aは値引き不可]] \n";
    const { t, d } = await started(p, pc);
    expect(await data(await k.finish(pc, d.job_id, { state: "done", result: raw }))).toMatchObject({
      outcome: "awaiting_approval",
    });
    expect((await artifactVersions(t)).map((v) => v.body.text)).toEqual([raw]);
    // 印だけの結果も、返した結果なので承認待ちにする（止まった扱いにしない）
    const second = await k.ticket(p);
    const d2 = await delegateOk(k, p, second);
    await k.takeJob(pc);
    expect(await data(await k.finish(pc, d2.job_id, { state: "done", result: "[[覚える: x]]" }))).toMatchObject({
      outcome: "awaiting_approval",
    });
    expect((await artifactVersions(second)).map((v) => v.body.text)).toEqual(["[[覚える: x]]"]);
    expect(await k.n("select count(*) as n from memories where owner_member_id = $1", [p.id])).toBe(0);
  });

  it("K62-API-072 守り（2 層目）：前の道すじ /bridge/ask の関数 app.bridge_ask は、チケットの仕事の問い合わせを積まない（false・確認待ちにしない・出来事も残らない）。会話の仕事は前のとおり積む（D-129.44）", async () => {
    const { p, pc } = await fresh("ticket で聞かせる人");
    const { d } = await started(p, pc);
    const ask = async (jobId: string, req: string) =>
      (
        await k.f.pool.query<{ v: boolean }>("select app.bridge_ask($1, $2, $3, $4::jsonb) as v", [
          pc.sessionId,
          jobId,
          req,
          JSON.stringify({ tool: "Bash", input: { command: "送る" }, summary: "送ります" }),
        ])
      ).rows[0]!.v;
    expect(await ask(d.job_id, "req-ticket-1")).toBe(false);
    expect(
      await k.n("select count(*) as n from bridge_job_events where job_id = $1 and kind = 'ask'", [d.job_id]),
    ).toBe(0);
    expect(
      (await k.q<{ state_id: string }>("select state_id from bridge_jobs where id = $1", [d.job_id]))[0]!.state_id,
    ).toBe("running");
    expect(await runRow(d.run_id)).toMatchObject({ status_id: "running" });
    await k.finish(pc, d.job_id, { state: "done", result: "見積です" });
    const { job: chat } = await chatTaken(p, pc);
    expect(await ask(chat.job_id, "req-chat-1")).toBe(true);
  });

  it("K62-API-073 守り（2 層目）：DB の app.ticket_tool_read(仕事, 鍵のハッシュ, PC) は、鍵が今の仕事の鍵で、その仕事を受け取った PC のときだけ区画を返す。鍵違い・別の PC は null。仕事の id だけでは呼べない", async () => {
    const { p, pc } = await fresh("DB で読む人");
    const pc2 = await k.device(p, "同じ人の 2 台目");
    const { d, job } = await started(p, pc, "DB の 2 層目の目的");
    const read = async (hash: string, session: string) =>
      (await k.f.pool.query<{ v: unknown }>("select app.ticket_tool_read($1, $2, $3) as v", [d.job_id, hash, session]))
        .rows[0]!.v;
    expect(JSON.stringify(await read(sha(job.tool_token!), pc.sessionId))).toContain("DB の 2 層目の目的");
    expect(await read(sha("x".repeat(43)), pc.sessionId)).toBeNull();
    expect(await read(sha(job.tool_token!), pc2.sessionId)).toBeNull();
    await expect(k.f.pool.query("select app.ticket_tool_read($1) as v", [d.job_id])).rejects.toThrow(
      /does not exist|permission denied/,
    );
  });

  it("K62-API-074 会話の続きは、前と同じ人が同じ PC で任せたときだけ。同じ人の別の PC・別の人が任せたときは前の会話の番号を渡さず、チケットの記録（やり取り・決定・実行の記録）の要約から新しい会話で始める（D-129.46・D-125.155）", async () => {
    const { p, pc } = await fresh("前に任せた人");
    const pc2 = await k.device(p, "前に任せた人の 2 台目");
    const t = await k.ticket(p);
    const first = await delegateOk(k, p, t);
    expect((await k.takeJob(pc)).job_id).toBe(first.job_id);
    await k.finish(pc, first.job_id, { state: "stopped", reason: "あなたが止めました", agent_session_id: SESS.a1 });
    // 同じ人の 2 台目の PC が取る：続きにしない
    const again = await delegateOk(k, p, t);
    const onPc2 = await k.takeJob(pc2);
    expect(onPc2.job_id).toBe(again.job_id);
    expect(onPc2["agent_session_id"]).toBeNull();
    await k.finish(pc2, again.job_id, { state: "stopped", reason: "あなたが止めました", agent_session_id: SESS.a2 });
    // 別の人が任せる：その人の PC にも、仕事の行にも、前の人の会話の番号を渡さない
    // チケットの記録（やり取りの書き込み・決定・実行の記録）を置く
    const post = (
      await k.q<{ id: string }>(
        "insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body) values ($1, $2, $3, 'post', '先方は 11 月末までに欲しいと言っています') returning id",
        [k.T.tenantId, t, p.id],
      )
    )[0]!.id;
    await k.f.admin.query(
      "insert into ticket_decisions (tenant_id, ticket_id, text, decided_by, source_message_id) values ($1, $2, '値引きはしない', $3, $4)",
      [k.T.tenantId, t, p.id, post],
    );
    const b = await fresh("あとから任せる別の人");
    const byOther = await delegateOk(k, b.p, t);
    const row = (
      await k.q<{ agent_session_id: string | null }>("select agent_session_id from bridge_jobs where id = $1", [
        byOther.job_id,
      ])
    )[0]!;
    expect(row.agent_session_id).toBeNull();
    const got = await k.takeJob(b.pc);
    expect(got.job_id).toBe(byOther.job_id);
    expect(got["agent_session_id"]).toBeNull();
    // 新しい会話は、チケットの記録の要約から始める（D-129.46・D-125.155 と同じ形）：やり取り・決定・前の実行の記録が prompt に入る
    const prompt = String(got["prompt"]);
    expect(prompt, "やり取りの書き込み").toContain("先方は 11 月末までに欲しいと言っています");
    expect(prompt, "決定").toContain("値引きはしない");
    expect(prompt, "前の実行の記録（止まった理由）").toContain("あなたが止めました");
    expect(prompt, "前の人の会話の番号は prompt にも入れない").not.toContain(SESS.a1);
    expect(prompt, "前の人の会話の番号は prompt にも入れない").not.toContain(SESS.a2);
  });
});

describe("K-62 AI に任せる：記録の要約の大きさ（G-16・D-129.46）", () => {
  it("K62-API-076 区画・やり取り・決定・実行の記録が長いチケット：区画は切らずに全文が入る。要約だけを上限で切る（書き込みは新しい 10 件・1 件 400 字、決定は新しい 20 件、前の実行の記録は新しい 10 件・1 件 200 字。古いものから落ちる）。区画の後ろに足した要約は 8000 字まで", async () => {
    const { p, pc } = await fresh("長いやり取りの人");
    const t = await k.ticket(p);
    const nn = (i: number) => String(i).padStart(2, "0");
    // 区画 5 つを 19000 字近くにする（頭と末尾に印）
    const keys = ["purpose", "done", "constraints", "counterpart", "todo"];
    const bodies = Object.fromEntries(keys.map((key) => [key, `区画頭-${key} ${"え".repeat(18_950)} 区画末-${key}`]));
    for (const key of keys)
      await k.f.admin.query(
        `insert into ticket_sections (tenant_id, ticket_id, section_key, body) values ($1, $2, $3, jsonb_build_object('text', $4::text))
         on conflict (ticket_id, section_key) do update set body = excluded.body`,
        [k.T.tenantId, t, key, bodies[key]],
      );
    // 記録の無いときの中身（区画だけ）。要約はこの後ろに足す
    const base = (await k.q<{ v: { prompt: string } }>("select app.ticket_job_context($1) as v", [t]))[0]!.v.prompt;
    // 前の作る実行 12 件（止まった理由は 262 字：200 字を越えた所に末尾の印）
    for (let i = 1; i <= 12; i++) {
      const d = await delegateOk(k, p, t);
      expect((await k.takeJob(pc)).job_id).toBe(d.job_id);
      await k.finish(pc, d.job_id, { state: "stopped", reason: `実行-${nn(i)} ${"う".repeat(250)}末尾実行-${nn(i)}` });
    }
    // 書き込み 25 件（古い順に 1 秒ずつ）。どれも 600 字：頭に印、400 字を越えた所に末尾の印
    for (let i = 1; i <= 25; i++)
      await k.f.admin.query(
        "insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, created_at) values ($1, $2, $3, 'post', $4, now() - make_interval(secs => $5))",
        [k.T.tenantId, t, p.id, `書き込み-${nn(i)} ${"あ".repeat(450)}末尾-${nn(i)}${"い".repeat(140)}`, 100 - i],
      );
    for (let i = 1; i <= 25; i++)
      await k.f.admin.query(
        "insert into ticket_decisions (tenant_id, ticket_id, text, decided_by, decided_at, created_at) values ($1, $2, $3, $4, now() - make_interval(secs => $5), now() - make_interval(secs => $5))",
        [k.T.tenantId, t, `決定-${nn(i)}`, p.id, 100 - i],
      );
    const d = await delegateOk(k, p, t);
    const job = await k.takeJob(pc);
    expect(job.job_id).toBe(d.job_id);
    const prompt = String(job["prompt"]);
    // 区画は切らずに全文
    for (const key of keys) expect(prompt, `区画 ${key} は全文`).toContain(bodies[key]);
    // 書き込み
    for (let i = 16; i <= 25; i++) expect(prompt, `新しい書き込み ${nn(i)} は入る`).toContain(`書き込み-${nn(i)}`);
    for (let i = 1; i <= 15; i++) expect(prompt, `古い書き込み ${nn(i)} は落ちる`).not.toContain(`書き込み-${nn(i)}`);
    for (let i = 1; i <= 25; i++) expect(prompt, `書き込み ${nn(i)} は 400 字で切る`).not.toContain(`末尾-${nn(i)}`);
    // 決定
    for (let i = 6; i <= 25; i++) expect(prompt, `新しい決定 ${nn(i)} は入る`).toContain(`決定-${nn(i)}`);
    for (let i = 1; i <= 5; i++) expect(prompt, `古い決定 ${nn(i)} は落ちる`).not.toContain(`決定-${nn(i)}`);
    // 前の実行の記録
    for (let i = 3; i <= 12; i++) expect(prompt, `新しい実行 ${nn(i)} は入る`).toContain(`実行-${nn(i)}`);
    for (let i = 1; i <= 2; i++) expect(prompt, `古い実行 ${nn(i)} は落ちる`).not.toContain(`実行-${nn(i)} `);
    for (let i = 1; i <= 12; i++) expect(prompt, `実行 ${nn(i)} は 200 字で切る`).not.toContain(`末尾実行-${nn(i)}`);
    // 古い順に並べる
    expect(prompt.indexOf("書き込み-16")).toBeLessThan(prompt.indexOf("書き込み-25"));
    expect(prompt.indexOf("実行-03")).toBeLessThan(prompt.indexOf("実行-12"));
    // 区画の後ろに足した要約は 8000 字まで（区画だけのときより伸びた分）
    const added = prompt.length - base.length;
    expect(added, "要約が入る").toBeGreaterThan(0);
    expect(added, "要約は 8000 字まで").toBeLessThanOrEqual(8_000);
    // 仕事の行にも同じ中身で入る
    const row = (await k.q<{ prompt: string }>("select prompt from bridge_jobs where id = $1", [d.job_id]))[0]!;
    expect(row.prompt).toBe(prompt);
  }, 60_000);
});

describe("K-62 AI に任せる：止まったときに帯に出す文（決める人の決定 D-129.47）", () => {
  it("K62-API-075 止まった理由が届かない・PC でやめた・PC の Bridge が途中で止まった：実行の 1 件の止まった理由（帯に出る文）は決めた 3 つの文。段は作業中で、また任せられる", async () => {
    const reasonOf = async (p: Person, runId: string) =>
      (await data<{ stopped_reason: string }>(await k.run(p, runId))).stopped_reason;
    // ① 理由の無い「止まった」
    const a = await fresh("理由の届かない人");
    const ra = await started(a.p, a.pc);
    await k.finish(a.pc, ra.d.job_id, { state: "stopped" });
    expect(await reasonOf(a.p, ra.d.run_id)).toBe(MSG.noReason);
    expect(await k.stageOf(ra.t)).toBe("doing");
    // ② PC で「やめた」
    const b = await fresh("PC でやめる人");
    const rb = await started(b.p, b.pc);
    await k.finish(b.pc, rb.d.job_id, { state: "cancelled" });
    expect(await runRow(rb.d.run_id)).toMatchObject({ status_id: "cancelled" });
    expect(await reasonOf(b.p, rb.d.run_id)).toBe(MSG.cancelledOnPc);
    expect(await k.stageOf(rb.t)).toBe("doing");
    // ③ 動いている間に PC の Bridge が止まり、つながり直して「何も動かしていない」と取りに来た
    const c = await fresh("Bridge が落ちた人");
    const rc = await started(c.p, c.pc);
    await k.take(c.pc, { idle: true });
    expect(await reasonOf(c.p, rc.d.run_id)).toBe(MSG.bridgeDown);
    expect(await k.stageOf(rc.t)).toBe("doing");
    for (const t of [ra.t, rb.t, rc.t]) expect((await systemLines(t)).at(-1)).toContain("止まりました");
    // どれも走っている実行が残らないので、また任せられる
    expect((await k.delegate(a.p, ra.t)).status).toBe(201);
  });

  it("K62-API-077 入力：finish の止まった理由（reason）が長い（401 字・2001 字・5000 字）：422 にせず、切らずに全文を記録する（実行の 1 件・action_runs・bridge_jobs・やり取りの 1 行）。段は作業中（D-130.1・D-130.4）", async () => {
    for (const n of [401, 2001, 5000]) {
      const { p, pc } = await fresh(`長い理由 ${n} の人`);
      const { t, d } = await started(p, pc);
      const tail = `【おわり${n}】`;
      const reason = "理".repeat(n) + tail;
      const r = await k.finish(pc, d.job_id, { state: "stopped", reason });
      expect(r.status, `${n} 字：${await r.clone().text()}`).toBe(201);
      expect(await data(r)).toMatchObject({ outcome: "stopped" });
      const view = await data<{ status: string; stopped_reason: string }>(await k.run(p, d.run_id));
      expect(view.status, `${n} 字`).toBe("stopped");
      expect(view.stopped_reason, `${n} 字：実行の 1 件の止まった理由は全文`).toBe(reason);
      expect((await runRow(d.run_id))["error_summary"], `${n} 字：action_runs.error_summary は全文`).toBe(reason);
      const job = (
        await k.q<{ stopped_reason: string }>("select stopped_reason from bridge_jobs where id = $1", [d.job_id])
      )[0]!;
      expect(job.stopped_reason, `${n} 字：bridge_jobs.stopped_reason は全文`).toBe(reason);
      expect((await systemLines(t)).at(-1), `${n} 字：やり取りの 1 行も切らない`).toContain(tail);
      expect(await k.stageOf(t)).toBe("doing");
    }
  });

  it("K62-API-080 止まった・やめた後は tickets.delegated_to_clone が false に戻る（PC が止まった／やめたで終わった・PC の Bridge が途中で止まった・押した人が止められた）。任せている間は true", async () => {
    const flag = async (t: string) =>
      (await k.q<{ delegated_to_clone: boolean }>("select delegated_to_clone from tickets where id = $1", [t]))[0]!
        .delegated_to_clone;
    // ① PC が「止まった」「やめた」で終わる
    for (const state of ["stopped", "cancelled"] as const) {
      const { p, pc } = await fresh(`${state} で旗を下ろす人`);
      const { t, d } = await started(p, pc);
      expect(await flag(t), `${state}：任せている間は true`).toBe(true);
      await k.finish(pc, d.job_id, { state });
      expect(await flag(t), `${state}：止まったら false`).toBe(false);
      expect(await k.stageOf(t)).toBe("doing");
    }
    // ② PC の Bridge が途中で止まり、つながり直して「何も動かしていない」と取りに来た
    const b = await fresh("Bridge が落ちて旗を下ろす人");
    const rb = await started(b.p, b.pc);
    await k.take(b.pc, { idle: true });
    expect(await flag(rb.t)).toBe(false);
    // ③ 押した人が止められた
    const c = await fresh("止められて旗を下ろす人");
    const rc = await started(c.p, c.pc);
    await k.f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [
      c.p.id,
      other.id,
    ]);
    expect(await flag(rc.t)).toBe(false);
  });

  it("K62-API-078 終わった・止まった・やめた仕事 × 受け取った PC が止める合図を見に来る：200・stop: true・reason null（終わった仕事は続けない）。重ねた finish は 404。実行・仕事・段は変わらない", async () => {
    for (const [state, body] of [
      ["done", { state: "done", result: "見積の案：合計 120,000 円" }],
      ["stopped", { state: "stopped", reason: "あなたが止めました" }],
      ["cancelled", { state: "cancelled" }],
    ] as const) {
      const { p, pc } = await fresh(`${state} の後の合図の人`);
      const { t, d } = await started(p, pc);
      expect((await k.finish(pc, d.job_id, body)).status, state).toBe(201);
      const before = {
        run: (await runRow(d.run_id))["status_id"],
        job: (await k.q<{ state_id: string }>("select state_id from bridge_jobs where id = $1", [d.job_id]))[0]!
          .state_id,
        stage: await k.stageOf(t),
        lines: (await systemLines(t)).length,
      };
      const r = await k.control(pc, d.job_id);
      expect(r.status, state).toBe(200);
      expect(await data(r), state).toMatchObject({ stop: true, reason: null });
      // 終わった仕事に finish を重ねても動いている仕事でないので 404（Bridge は捨てる・K62-BRG-018）
      expect((await k.finish(pc, d.job_id, { state: "stopped", reason: "あなたが止めました" })).status, state).toBe(
        404,
      );
      expect((await runRow(d.run_id))["status_id"], state).toBe(before.run);
      expect(
        (await k.q<{ state_id: string }>("select state_id from bridge_jobs where id = $1", [d.job_id]))[0]!.state_id,
        state,
      ).toBe(before.job);
      expect(await k.stageOf(t), state).toBe(before.stage);
      expect((await systemLines(t)).length, state).toBe(before.lines);
    }
  });

  it("K62-API-079 動いている × 受け取った PC が眠っていて同じ人の別の PC が起きている：実行の 1 件・一覧の pc は受け取った PC で見て asleep。待っている実行は、その人の PC のどれかが起きていれば live（D-128.163）", async () => {
    const { p, pc } = await fresh("2 台持ちの人");
    const second = await k.device(p, "起きている 2 台目");
    const { t, d } = await started(p, pc); // pc が受け取った
    await k.lastSeen(pc, 600); // 受け取った PC は眠った
    await k.lastSeen(second, 0); // 別の PC は起きている
    expect(await data(await k.run(p, d.run_id))).toMatchObject({ status: "running", pc: "asleep" });
    const list = await data<{ id: string; pc: string }[]>(await k.runs(p, t));
    expect(list.find((x) => x.id === d.run_id)).toMatchObject({ pc: "asleep" });
    // 待っている実行（別のチケット）は、起きている 2 台目があるので live
    const q = await delegateOk(k, p, await k.ticket(p));
    expect(q).toMatchObject({ status: "queued", pc: "live" });
    expect(await data(await k.run(p, q.run_id))).toMatchObject({ status: "queued", pc: "live" });
    // 受け取った PC が起きたら、動いている実行も live に戻る
    await k.lastSeen(pc, 0);
    expect(await data(await k.run(p, d.run_id))).toMatchObject({ status: "running", pc: "live" });
  });
});
