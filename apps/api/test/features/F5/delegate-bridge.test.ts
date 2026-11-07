// K-62「AI に任せる」の単体の試験：PC が呼ぶ口（takeBridgeJob・reportJobProgress・getJobControl・callKanameTool・finishBridgeJob）（口・本物の DB）。
//   名前の頭の行 ID（K62-API-…）は 11_tickets/K-62.md の表のマスと分岐に 1 対 1 で結ぶ。人が呼ぶ口は delegate.test.ts。
//   PC の印は本物（引き取りで返った "kpc_…" を x-bridge-session に載せる）。時刻は眠らずに DB の行の時刻を動かす（D-128.130）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Person } from "../fixture.js";
import { data, delegateOk, E, makeKit, MSG, OLD_PROTOCOL, sha, type Device, type Kit } from "./delegate-kit.js";

let k: Kit;
let other: Person; // 同じ会社の別の人（担当を替える先）

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
    // 承認待ちの行の形は K-63 が前提にする（status_id pending・irreversible は骨格では true・D-128.176）
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

  it("K62-API-045 待っている × 別の会社の人の PC・押した人でない担当者の PC が取りに来る：どちらも job は null（自分の仕事を持たない人）。取るのは押した人のアカウントの PC だけ（D-128.138・D-128.175）", async () => {
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
      agent_session_id: "sess-k62",
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
    await k.finish(pc, d.job_id, { state: "stopped", reason: "あなたが止めました", agent_session_id: "sess-ticket-1" });
    await delegateOk(k, p, t);
    const job = await k.takeJob(pc);
    expect(job["agent_session_id"]).toBe("sess-ticket-1");
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

  it("K62-API-018 動いている × 押した人がメンバーから外れた・止められた：PC の口は 401。成果物にも承認待ちにもしない（E-AUTH-005・G-14）", async () => {
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

  it("K62-API-049 待っている（承認の後の実行・K-63 が積んだ行）× PC が取る：行の prompt と agent_session_id をそのまま渡す（組み直さない・D-128.175）", async () => {
    const { p, pc } = await fresh("実行を待つ人");
    const t = await k.ticket(p);
    // K-63 の承認の関数が積む形を、ここでは DB に直に置く（ticket_delegate と同じ引き方で prompt と続きの id を入れた行）
    const job = (
      await k.q<{ id: string }>(
        "insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, agent_session_id, kind, permission_mode) values ($1, $2, $3, 'queued', $4, 'sess-make-1', 'ticket', 'auto') returning id",
        [k.T.tenantId, k.T.rootScope, p.id, "承認された成果物を先方に送る（足し書き）"],
      )
    )[0]!.id;
    await k.f.admin.query(
      "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, created_by) values ($1, $2, $3, 'execute', 'queued', $4, $5)",
      [k.T.tenantId, k.T.rootScope, t, job, p.id],
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

  it("K62-API-053 守り：PC の口の上限：取る・様子は 1 分に 61 回目、合図は 121 回目で 429 と待つ秒数", async () => {
    const { p, pc } = await fresh("急ぐ PC");
    const { d } = await started(p, pc);
    const saved = { ...k.f.limits };
    for (const op of ["takeBridgeJob", "reportJobProgress", "getJobControl"]) delete k.f.limits[op];
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
    } finally {
      Object.assign(k.f.limits, saved);
    }
  }, 30_000); // 1 回の試験で口を 240 回呼ぶ（重い台でも既定の 5 秒で切らない）

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
  it("K62-API-032 入力：progress の kind が決まった値でない・知らない欄・finish の state が違う・結果が 200000 字を超える・道具の名前が無い／知らない：422。仕事は動いたまま", async () => {
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
