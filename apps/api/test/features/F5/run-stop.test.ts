// K-731「動いている AI の実行を止める口（stopActionRun）と、止めた後に届いた「終わった」を承認待ちにしない」の単体の試験（口・本物の DB・作る段の実行）。
//   名前の頭の行 ID（K731-API-…・K731-DB-…）は 11_tickets/K-731.md の行の表と 1 対 1。承認の後の実行（phase execute）の 3 行は run-stop-execute.test.ts（承認の土台が要る）。
// 口：POST /api/v1/action_runs/:id/stop（体は空）→ 201 { data: { id, ticket_id, phase, status, stopped_reason, stopped_at } }。
// 土台は段 1 の K-62 の試験の道具 F5/delegate-kit.ts（本物の Postgres・本物の PC の印・任せる／取る／終わる）。
//   K-731 の口の振る舞い（apps/api/src/hooks/run-stop.ts の register・K-326）は F3/leaf-hooks.ts で最初の要求のときに 1 回だけ読む
//   （準備で読まないのは、実装の前の切る段の smoke で、まだ無いファイルを準備で読んで準備ごと落とさないため・answer=8f745003d023）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の行の時刻を動かす。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ENDPOINTS } from "@kaname/contracts";
import type { Person } from "../fixture.js";
import { data, delegateOk, json, makeKit, type Device, type Kit } from "./delegate-kit.js";
import { leafHooks } from "../F3/leaf-hooks.js";

let k: Kit;
let owner: Person; // 担当者（書ける）

beforeAll(async () => {
  k = await makeKit();
  leafHooks(k.f, ["run-stop"]); // 読むのは最初の要求のとき
  for (const op of ["stopActionRun", "getActionRun", "listTicketRuns", "getTicket"]) k.f.limits[op] = 100_000;
  owner = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "高本", ticketAbility: "edit" });
}, 90_000);
afterAll(async () => {
  await k?.close();
});

// ---------------------------------------------------------------- 手助け
const stopBy = (name: string) => `${name}が止めました`;
const IGNORED = "止めたので、届いた結果は使いませんでした";

const stop = (p: Person, runId: string, body: unknown = {}) =>
  k.f.req("POST", `/action_runs/${runId}/stop`, { body, headers: p.auth });
const systemLines = (ticketId: string) =>
  k.q<{ body: string }>(
    "select body from ticket_messages where ticket_id = $1 and kind = 'system' order by created_at",
    [ticketId],
  );
const lineCount = async (ticketId: string, word: string) =>
  (await systemLines(ticketId)).filter((x) => x.body.includes(word)).length;
const runRow = async (runId: string) => (await k.q("select * from action_runs where id = $1", [runId]))[0]!;
const jobRow = async (jobId: string) => (await k.q("select * from bridge_jobs where id = $1", [jobId]))[0]!;
const flagOf = async (t: string) =>
  (await k.q("select delegated_to_clone as d from tickets where id = $1", [t]))[0]!["d"] as boolean;
const auditCount = (runId: string) =>
  k.n("select count(*) as n from audit_events where action = 'action_runs.stop' and target_id = $1", [runId]);
const noticesTo = (memberId: string) =>
  k.n("select count(*) as n from notifications where member_id = $1 and event_kind_id = 'ticket.run_stopped'", [
    memberId,
  ]);
const approvalsOf = (t: string) => k.n("select count(*) as n from approvals where ticket_id = $1", [t]);
const artifactsOf = (t: string) =>
  k.n("select count(*) as n from ticket_sections where ticket_id = $1 and section_key = 'artifacts'", [t]);

async function fresh(name: string): Promise<{ p: Person; pc: Device }> {
  const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name, ticketAbility: "edit" });
  return { p, pc: await k.device(p, `${name} の PC`) };
}
/** 任せて、PC が取って、動いている（running）まで */
async function running(p: Person, pc: Device, o: { assignee?: Person } = {}) {
  const t = await k.ticket(p, o.assignee ? { assignee: o.assignee } : {});
  const d = await delegateOk(k, p, t);
  await k.takeJob(pc);
  return { t, runId: d.run_id, jobId: d.job_id };
}

// ---------------------------------------------------------------- 止める（stopActionRun）：状態 × 入口 × 利用者の状態
describe("K-731 止める：作る段の実行（状態 × 入口 × 利用者の状態）", () => {
  it("K731-API-001 動いている実行 × 止める × 任せた人かつ担当者：201（答えの鍵は ActionRunStopped の 6 つちょうど）。実行はすぐ止まり、仕事には止める合図が立ち、旗は下り、段は作業中。やり取りと証跡に 1 つずつ。PC は合図を読める", async () => {
    const { p, pc } = await fresh("止める人");
    const s = await running(p, pc);
    const r = await stop(p, s.runId);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = (await json(r))["data"] as Record<string, unknown>;
    expect(v).toMatchObject({
      id: s.runId,
      ticket_id: s.t,
      phase: "make",
      status: "stopped",
      stopped_reason: stopBy("止める人"),
    });
    expect(typeof v["stopped_at"]).toBe("string");
    expect(Object.keys(v).sort()).toEqual(["id", "phase", "status", "stopped_at", "stopped_reason", "ticket_id"]);
    expect(ENDPOINTS.some((e) => e.operationId === "stopActionRun")).toBe(true);
    expect(await runRow(s.runId)).toMatchObject({ status_id: "stopped", error_summary: stopBy("止める人") });
    const j = await jobRow(s.jobId);
    expect(j["state_id"]).toBe("running"); // PC が合図を読んで返すまで、仕事は動いたまま
    expect(j["stop_requested_at"]).not.toBeNull();
    expect(((await json(await k.control(pc, s.jobId)))["data"] as { stop: boolean }).stop).toBe(true);
    expect(await flagOf(s.t)).toBe(false);
    expect(await k.stageOf(s.t)).toBe("doing");
    expect(await lineCount(s.t, "止める人が AI を止めました")).toBe(1);
    expect(await auditCount(s.runId)).toBe(1);
    // 再取得（実行の 1 件）でも止まったまま
    const again = await data<{ status: string; stopped_reason: string | null }>(await k.run(p, s.runId));
    expect(again).toMatchObject({ status: "stopped", stopped_reason: stopBy("止める人") });
  });

  it("K731-API-002 待っている実行（queued・PC がまだ取っていない）× 止める：その場で止まる。PC が取りに来ても渡る仕事は無い", async () => {
    const { p, pc } = await fresh("待っているのを止める人");
    const t = await k.ticket(p);
    const d = await delegateOk(k, p, t);
    const r = await stop(p, d.run_id);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await runRow(d.run_id)).toMatchObject({
      status_id: "stopped",
      error_summary: stopBy("待っているのを止める人"),
    });
    expect(await jobRow(d.job_id)).toMatchObject({ state_id: "stopped" });
    const took = await k.take(pc);
    expect(took.status).toBe(201);
    expect(((await json(took))["data"] as { job: unknown }).job).toBeNull();
    expect(await k.stageOf(t)).toBe("doing");
    expect(await flagOf(t)).toBe(false);
  });

  it("K731-API-003 止められる人：担当者だけ（任せていなくても）201。任せた人（担当者でない）・マネージャーなどのどちらでもない書ける人・担当者のいないチケットの任せた人は 403・E-RUN-001（何も変わらない）", async () => {
    const { p: mate, pc: matePc } = await fresh("任せた人");
    // 担当は owner・任せたのは mate
    const a = await running(mate, matePc, { assignee: owner });
    const third = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "マネージャー", ticketAbility: "edit" });
    for (const who of [third, mate]) {
      const denied = await stop(who, a.runId);
      expect(denied.status).toBe(403);
      expect((await json(denied)).code).toBe("E-RUN-001");
    }
    expect(await runRow(a.runId)).toMatchObject({ status_id: "running" });
    expect(await auditCount(a.runId)).toBe(0);
    expect(await lineCount(a.t, "止めました")).toBe(0);
    // 担当者（任せていない）は止められる
    expect((await stop(owner, a.runId)).status).toBe(201);
    // 担当者のいないチケットは、任せた人も止められない
    const { p: c1, pc: cpc } = await fresh("担当の無い人");
    const c = await running(c1, cpc);
    await k.f.admin.query("update tickets set assignee_member_id = null where id = $1", [c.t]);
    expect((await stop(third, c.runId)).status).toBe(403);
    expect((await stop(c1, c.runId)).status).toBe(403);
    expect(await runRow(c.runId)).toMatchObject({ status_id: "running" });
  });

  it("K731-API-004 見えない人（別の会社・見えないグループ）・無い id・消したチケットの実行：404。何も変わらない", async () => {
    const { p, pc } = await fresh("見えない相手の人");
    const s = await running(p, pc);
    const outsider = await k.f.person(k.O.tenantId, k.O.rootScope, { name: "別の会社の人", ticketAbility: "edit" });
    expect((await stop(outsider, s.runId)).status).toBe(404);
    const g = (
      await k.f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '別のグループ', 'ZY') returning id",
        [k.T.tenantId],
      )
    ).rows[0]!.id;
    const stranger = await k.f.person(k.T.tenantId, g, { name: "別のグループの人", ticketAbility: "edit" });
    expect((await stop(stranger, s.runId)).status).toBe(404);
    expect((await stop(p, randomUUID())).status).toBe(404);
    await k.f.admin.query("update tickets set deleted_at = now() where id = $1", [s.t]);
    expect((await stop(p, s.runId)).status).toBe(404);
    expect(await runRow(s.runId)).toMatchObject({ status_id: "running" });
  });

  it("K731-API-005 もう止まっている・作り終えた実行・止めた後の二度押し：409・E-RUN-002。やり取りと証跡は 1 つのまま", async () => {
    const { p, pc } = await fresh("二度押しの人");
    const s = await running(p, pc);
    expect((await stop(p, s.runId)).status).toBe(201);
    const second = await stop(p, s.runId);
    expect(second.status).toBe(409);
    expect((await json(second)).code).toBe("E-RUN-002");
    expect(await lineCount(s.t, "AI を止めました")).toBe(1);
    expect(await auditCount(s.runId)).toBe(1);
    // 作り終えて承認待ちになった実行・止まって終わった実行
    const d = await delegateOk(k, p, await k.ticket(p));
    await k.takeJob(pc);
    expect((await k.finish(pc, d.job_id, { state: "done", result: "成果物の本文" })).status).toBe(201);
    const done = await stop(p, d.run_id);
    expect(done.status).toBe(409);
    expect((await json(done)).code).toBe("E-RUN-002");
    expect(await runRow(d.run_id)).toMatchObject({ status_id: "done" });
  });

  it("K731-API-006 同時に 2 つ（別のタブ）：1 つだけ通る [201, 409]。やり取りと証跡は 1 つずつ", async () => {
    const { p, pc } = await fresh("同時の人");
    const s = await running(p, pc);
    const rs = await Promise.all([stop(p, s.runId), stop(p, s.runId)]);
    expect(rs.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await auditCount(s.runId)).toBe(1);
    expect(await lineCount(s.t, "AI を止めました")).toBe(1);
  });
});

// ---------------------------------------------------------------- 止めた後に届く「終わった」（K-61 の完了の条件 4）
describe("K-731 止めた後に PC から届く終わりを使わない", () => {
  it("K731-API-009 止めた後に PC が「終わった」（結果つき）を返す：201 で受けるが、承認待ちにしない・成果物の版も作らない・段は作業中のまま。やり取りに「止めたので、届いた結果は使いませんでした」が 1 行", async () => {
    const { p, pc } = await fresh("遅れて届く人");
    const s = await running(p, pc);
    expect((await stop(p, s.runId)).status).toBe(201);
    const r = await k.finish(pc, s.jobId, { state: "done", result: "止めた後に出来た成果物の本文" });
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await json(r))["data"]).toMatchObject({ ok: true, outcome: "stopped" });
    expect(await approvalsOf(s.t)).toBe(0);
    expect(await artifactsOf(s.t)).toBe(0);
    expect(await runRow(s.runId)).toMatchObject({ status_id: "stopped", error_summary: stopBy("遅れて届く人") });
    expect(await jobRow(s.jobId)).toMatchObject({ state_id: "stopped", result: null });
    expect(await k.stageOf(s.t)).toBe("doing");
    expect(await flagOf(s.t)).toBe(false);
    expect(await lineCount(s.t, IGNORED)).toBe(1);
    expect(await lineCount(s.t, "作り終えました")).toBe(0);
  });

  it("K731-API-010 止めた後に PC が合図を読んで「止まった」「やめた」を返す：201。仕事は閉じ、やり取りに「使いませんでした」の行は出ない（結果が届いていない）", async () => {
    const { p, pc } = await fresh("合図を読む人");
    const a = await running(p, pc);
    expect((await stop(p, a.runId)).status).toBe(201);
    const ra = await k.finish(pc, a.jobId, { state: "stopped", reason: "止める合図を受け取りました" });
    expect(ra.status, await ra.clone().text()).toBe(201);
    expect(await jobRow(a.jobId)).toMatchObject({ state_id: "stopped" });
    expect(await lineCount(a.t, IGNORED)).toBe(0);
    const b = await running(p, pc);
    expect((await stop(p, b.runId)).status).toBe(201);
    const rb = await k.finish(pc, b.jobId, { state: "cancelled", reason: "PC でやめました" });
    expect(rb.status, await rb.clone().text()).toBe(201);
    expect(await jobRow(b.jobId)).toMatchObject({ state_id: "cancelled" });
    expect(await runRow(b.runId)).toMatchObject({ status_id: "stopped", error_summary: stopBy("合図を読む人") });
    expect(await lineCount(b.t, IGNORED)).toBe(0);
  });

  it("K731-API-011 止めた後に「終わった」が結果なし・空白だけで届く：201。承認待ちにならず、「使いませんでした」の行も出ない（使う結果が無い）", async () => {
    const { p, pc } = await fresh("空で届く人");
    const a = await running(p, pc);
    expect((await stop(p, a.runId)).status).toBe(201);
    expect((await k.finish(pc, a.jobId, { state: "done", result: "  \n　 " })).status).toBe(201);
    expect(await approvalsOf(a.t)).toBe(0);
    expect(await lineCount(a.t, IGNORED)).toBe(0);
    expect(await jobRow(a.jobId)).toMatchObject({ state_id: "stopped" });
    const b = await running(p, pc);
    expect((await stop(p, b.runId)).status).toBe(201);
    expect((await k.finish(pc, b.jobId, { state: "done" })).status).toBe(201);
    expect(await approvalsOf(b.t)).toBe(0);
    expect(await lineCount(b.t, IGNORED)).toBe(0);
  });

  it("K731-API-012 止めた後にもう一度「AI に任せる」→ 古い仕事の「終わった」が後から届く：新しい実行・旗・段・承認は何も変わらない（古い仕事の結果だけを使わない）", async () => {
    const { p, pc } = await fresh("任せ直す人");
    const s = await running(p, pc);
    expect((await stop(p, s.runId)).status).toBe(201);
    const again = await delegateOk(k, p, s.t);
    expect(await flagOf(s.t)).toBe(true);
    expect((await k.finish(pc, s.jobId, { state: "done", result: "古い仕事の成果物" })).status).toBe(201);
    expect(await runRow(again.run_id)).toMatchObject({ status_id: "queued" });
    expect(await flagOf(s.t)).toBe(true);
    expect(await k.stageOf(s.t)).toBe("running");
    expect(await approvalsOf(s.t)).toBe(0);
    expect(await artifactsOf(s.t)).toBe(0);
    expect(await lineCount(s.t, IGNORED)).toBe(1);
    expect(await runRow(s.runId)).toMatchObject({ status_id: "stopped" });
  });
});

// ---------------------------------------------------------------- 入力・守り・失敗
describe("K-731 入力・守り・手順の失敗", () => {
  it("K731-API-014 体に知らない項目：422（strict）・何も変わらない。空の体 {} は通る", async () => {
    const { p, pc } = await fresh("体を付ける人");
    const s = await running(p, pc);
    const bad = await stop(p, s.runId, { reason: "もういい" });
    expect(bad.status).toBe(422);
    expect(await runRow(s.runId)).toMatchObject({ status_id: "running" });
    expect((await stop(p, s.runId, {})).status).toBe(201);
  });

  it("K731-API-015 ログインしていない：401。上限（1 分に 61 回）：429 と待つ秒数", async () => {
    const { p, pc } = await fresh("押しすぎる人");
    const s = await running(p, pc);
    const anon = await k.f.req("POST", `/action_runs/${s.runId}/stop`, { body: {} });
    expect(anon.status).toBe(401);
    const saved = k.f.limits["stopActionRun"];
    delete k.f.limits["stopActionRun"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await stop(p, s.runId);
      expect(last!.status).toBe(429);
      const sec = Number((await json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) k.f.limits["stopActionRun"] = saved;
    }
  });

  it("K731-API-016 手順 S1「DB に書く」が失敗（関数が使えない・DB が落ちた）：503・E-PAGE-003。実行・仕事・チケット・やり取り・証跡のどれも変わらない", async () => {
    const { p, pc } = await fresh("落ちる人");
    const s = await running(p, pc);
    await k.f.admin.query("revoke execute on function app.run_stop(uuid) from kaname_app");
    try {
      const r = await stop(p, s.runId);
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("grant execute on function app.run_stop(uuid) to kaname_app");
    }
    expect(await runRow(s.runId)).toMatchObject({ status_id: "running" });
    expect((await jobRow(s.jobId))["stop_requested_at"]).toBeNull();
    expect(await flagOf(s.t)).toBe(true);
    expect(await k.stageOf(s.t)).toBe("running");
    expect(await auditCount(s.runId)).toBe(0);
  });

  it("K731-API-017 手順 S2「証跡」が失敗（証跡の書き込みが例外）：503・E-PAGE-003。同じ取引なので実行も仕事も切り替わらず、やり取りの行も無い", async () => {
    const { p, pc } = await fresh("証跡が落ちる人");
    const s = await running(p, pc);
    await k.f.admin.query(
      `create or replace function public.k731_fail_audit() returns trigger language plpgsql as $$
       begin if new.action = 'action_runs.stop' then raise exception 'K-731 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await k.f.admin.query(
      "create trigger k731_fail_audit before insert on audit_events for each row execute function public.k731_fail_audit()",
    );
    try {
      const r = await stop(p, s.runId);
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("drop trigger if exists k731_fail_audit on audit_events");
      await k.f.admin.query("drop function if exists public.k731_fail_audit()");
    }
    expect(await runRow(s.runId)).toMatchObject({ status_id: "running" });
    expect((await jobRow(s.jobId))["stop_requested_at"]).toBeNull();
    expect(await k.stageOf(s.t)).toBe("running");
    expect(await lineCount(s.t, "AI を止めました")).toBe(0);
  });

  it("K731-API-018 お知らせ：止められるのは担当者だけなので、止める口は受け箱（ticket.run_stopped）に何も書かない。任せた人にも担当者本人にも 1 件も増えない（二度押しでも増えない）", async () => {
    const { p: delegator, pc } = await fresh("任せた人（知らせない）");
    const a = await running(delegator, pc, { assignee: owner });
    const beforeDelegator = await noticesTo(delegator.id);
    const beforeOwner = await noticesTo(owner.id);
    expect((await stop(owner, a.runId)).status).toBe(201);
    expect((await stop(owner, a.runId)).status).toBe(409);
    expect(await noticesTo(delegator.id)).toBe(beforeDelegator);
    expect(await noticesTo(owner.id)).toBe(beforeOwner);
    // 任せた人でもある担当者本人が止める → 自分あてにも書かない
    const { p: self, pc: spc } = await fresh("自分で止める人");
    const b = await running(self, spc);
    const mine = await noticesTo(self.id);
    expect((await stop(self, b.runId)).status).toBe(201);
    expect(await noticesTo(self.id)).toBe(mine);
  });

  it("K731-API-019 手順 S3［残る］の後片付け：止める合図を PC が読まないまま PC が閉じて仕事が動いたまま残る → PC がつながり直して「何も動かしていない」と知らせると仕事は止まり、実行・段・旗・やり取りは変わらない", async () => {
    const { p, pc } = await fresh("閉じる PC の人");
    const s = await running(p, pc);
    expect((await stop(p, s.runId)).status).toBe(201);
    expect((await jobRow(s.jobId))["state_id"]).toBe("running");
    const lines = (await systemLines(s.t)).length;
    const took = await k.take(pc, { idle: true });
    expect(took.status).toBe(201);
    expect(await jobRow(s.jobId)).toMatchObject({ state_id: "stopped" });
    expect(await runRow(s.runId)).toMatchObject({ status_id: "stopped", error_summary: stopBy("閉じる PC の人") });
    expect(await k.stageOf(s.t)).toBe("doing");
    expect(await flagOf(s.t)).toBe(false);
    expect((await systemLines(s.t)).length).toBe(lines);
    expect(await approvalsOf(s.t)).toBe(0);
  });

  it("K731-API-020 止めていない仕事は前のまま：結果のある「終わった」は承認待ち（承認の行 1・成果物の版 1・段は承認待ち）、空の結果は止まった（段は作業中）", async () => {
    const { p, pc } = await fresh("止めない人");
    const a = await running(p, pc);
    expect((await k.finish(pc, a.jobId, { state: "done", result: "成果物の本文" })).status).toBe(201);
    expect(await approvalsOf(a.t)).toBe(1);
    expect(await artifactsOf(a.t)).toBe(1);
    expect(await k.stageOf(a.t)).toBe("awaiting_approval");
    expect(await lineCount(a.t, IGNORED)).toBe(0);
    const b = await running(p, pc);
    expect((await k.finish(pc, b.jobId, { state: "done", result: "" })).status).toBe(201);
    expect(await runRow(b.runId)).toMatchObject({ status_id: "stopped" });
    expect(await k.stageOf(b.t)).toBe("doing");
  });

  it("K731-API-021 DB の関数の守り（2 層目）：app.run_stop は security definer・search_path に pg_temp・public から外し kaname_app だけに渡す。担当者でない人の文脈で直に呼ぶと { ok: false, code: FORBIDDEN }", async () => {
    const fn = (
      await k.q<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
        `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
                has_function_privilege('kaname_app', p.oid, 'execute') as app
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'run_stop'`,
      )
    )[0]!;
    expect(fn.definer).toBe(true);
    expect(fn.cfg?.join(",") ?? "").toMatch(/search_path=.*pg_temp/);
    expect(fn.pub).toBe(false);
    expect(fn.app).toBe(true);
    const { p, pc } = await fresh("直に呼ぶ人");
    const s = await running(p, pc);
    const other = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "関係の無い人", ticketAbility: "edit" });
    const c = await k.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [k.T.tenantId, other.id],
      );
      const r = (await c.query<{ v: Record<string, unknown> }>("select app.run_stop($1) as v", [s.runId])).rows[0]!.v;
      expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    expect(await runRow(s.runId)).toMatchObject({ status_id: "running" });
  });

  it("K731-API-023 後片付け（PC が戻ってこない）も失敗した後：仕事は動いたまま残るが、実行は止まったまま・承認待ちにならず、止める合図は何度読んでも stop true。もう一度「AI に任せる」も押せる", async () => {
    const { p, pc } = await fresh("戻ってこない PC の人");
    const s = await running(p, pc);
    expect((await stop(p, s.runId)).status).toBe(201);
    for (let i = 0; i < 2; i++)
      expect(((await json(await k.control(pc, s.jobId)))["data"] as { stop: boolean }).stop).toBe(true);
    expect((await jobRow(s.jobId))["state_id"]).toBe("running");
    expect(await runRow(s.runId)).toMatchObject({ status_id: "stopped" });
    expect(await approvalsOf(s.t)).toBe(0);
    expect(await k.stageOf(s.t)).toBe("doing");
    const again = await k.delegate(p, s.t);
    expect(again.status, await again.clone().text()).toBe(201);
  });

  it("K731-API-024 止める口を通らずに止める合図だけ立った仕事（会話の止める口と同じ app.agent_stop を、任せた人がチケットの仕事の id で呼ぶ・実行は動いたまま）に PC が「止まった」を返す：前のとおり実行は止まり、段は作業中に戻り、旗は下り、やり取りに「AI が止まりました」が 1 行（仕事だけ閉じて実行・段・旗が動いたまま残らない）", async () => {
    const { p, pc } = await fresh("合図だけの人");
    const s = await running(p, pc);
    const sig = (await k.q<{ s: string | null }>("select app.agent_stop($1, $2) as s", [p.id, s.jobId]))[0]!.s;
    expect(sig).toBe("stopping");
    expect((await jobRow(s.jobId))["stop_requested_at"]).not.toBeNull();
    expect(await runRow(s.runId)).toMatchObject({ status_id: "running" });
    expect(await flagOf(s.t)).toBe(true);
    const why = "PC が止める合図を受け取って止めました";
    const r = await k.finish(pc, s.jobId, { state: "stopped", reason: why });
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await json(r))["data"]).toMatchObject({ ok: true, outcome: "stopped" });
    expect(await runRow(s.runId)).toMatchObject({ status_id: "stopped", error_summary: why });
    expect(await jobRow(s.jobId)).toMatchObject({ state_id: "stopped" });
    expect(await k.stageOf(s.t)).toBe("doing");
    expect(await flagOf(s.t)).toBe(false);
    expect(await lineCount(s.t, `合図だけの人のAI が止まりました（${why}）`)).toBe(1);
    expect(await lineCount(s.t, IGNORED)).toBe(0);
    expect(await approvalsOf(s.t)).toBe(0);
  });
});

// ---------------------------------------------------------------- DB の呼び口（試し打ちの結末）
describe("K-731 DB：試し打ちの結末の呼び口", () => {
  it("K731-DB-001 app.dry_run_job_end は空の形で置いてある：何を渡しても null を返し何も書かない。誰にも execute を渡さない（K-746 が中身を作る）", async () => {
    const acl = (
      await k.q<{ app: boolean; pub: boolean }>(
        `select has_function_privilege('kaname_app', p.oid, 'execute') as app, has_function_privilege('public', p.oid, 'execute') as pub
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'dry_run_job_end'`,
      )
    )[0]!;
    expect(acl).toMatchObject({ app: false, pub: false });
    const { p, pc } = await fresh("空の形を見る人");
    const s = await running(p, pc);
    const before = await k.n("select count(*) as n from ticket_messages where ticket_id = $1", [s.t]);
    const v = (
      await k.q<{ v: unknown }>("select app.dry_run_job_end($1, 'done', '結果', null, null) as v", [s.jobId])
    )[0]!.v;
    expect(v).toBeNull();
    expect(await k.n("select count(*) as n from ticket_messages where ticket_id = $1", [s.t])).toBe(before);
    expect(await jobRow(s.jobId)).toMatchObject({ state_id: "running" });
  });

  it("K731-DB-002 app.bridge_finish_job は引数 6 つ・答え jsonb のまま kaname_app だけに渡され、本体に「止める印（stop_requested_at）」と「試し打ちの結末（dry_run_job_end）」を見る分かれ道がある", async () => {
    const f = (
      await k.q<{ args: string; ret: string; app: boolean; pub: boolean; def: string }>(
        `select pg_get_function_identity_arguments(p.oid) as args, pg_get_function_result(p.oid) as ret,
                has_function_privilege('kaname_app', p.oid, 'execute') as app, has_function_privilege('public', p.oid, 'execute') as pub,
                pg_get_functiondef(p.oid) as def
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'bridge_finish_job'`,
      )
    )[0]!;
    expect(f.args).toBe("p_session uuid, p_job uuid, p_state text, p_result text, p_reason text, p_agent_session text");
    expect(f.ret).toBe("jsonb");
    expect(f).toMatchObject({ app: true, pub: false });
    expect(f.def).toContain("stop_requested_at");
    expect(f.def).toContain("dry_run_job_end");
  });
});
