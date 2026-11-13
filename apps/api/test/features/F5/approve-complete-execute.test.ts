// K-164「実行の結末と時間の流れ（実行が終わる・止まる・24 時間・片付け）」の単体の試験（口・本物の DB・本物の PC の印）。親 K-63 の試験を孫ごとに分けたもの（行 ID と中身は分ける前のまま・11_tickets/K-164.md の表のマスと分岐に 1 対 1）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台・道具・決めた文は ./approve-complete.harness.ts。
import { describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import {
  setupApproveComplete,
  NOTE_24H,
  STOP_GONE,
  STOP_24H,
  STOP_NO_REASON,
  CONF_DONE,
  f,
  T,
  boss,
  json,
  one,
  num,
  auth,
  req,
  queue,
  approve,
  giveBack,
  take,
  finish,
  stageKeyOf,
  team,
  ticket,
  delegated,
  approvalRow,
  runsOf,
  jobOf,
  messagesOf,
  openApprovals,
  approved,
  type Team,
  detail,
} from "./approve-complete.harness.js";

setupApproveComplete();

describe("K-63 承認して完了する：承認・差し戻し（口・本物の DB）", () => {
  it("K63-API-010 承認済み・実行待ち × 承認から 23 時間 59 分・24 時間 1 分 × PC が取りに来る：前は渡す。後は渡さず、新しい承認待ち（note）で聞き直す。前の承認は approve のまま", async () => {
    const tm = await team();
    const early = await ticket();
    const late = await ticket();
    const e = await approved(early, { by: tm });
    const l = await approved(late, { by: tm });
    await f.admin.query("update approvals set decided_at = now() - interval '23 hours 59 minutes' where id = $1", [
      e.approvalId,
    ]);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      l.approvalId,
    ]);
    // 動いている仕事の片付け（idle）はしない取り方で、渡る仕事を全部取る
    const got: string[] = [];
    for (let job = await take(tm.pc); job; job = await take(tm.pc)) got.push(job.id);
    expect(got).toEqual([e.execJobId]);
    expect(await jobOf(e.execJobId)).toMatchObject({ state_id: "running" });
    expect(await jobOf(l.execJobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_24H }); // 片付けは stopped（D-131.14）
    expect((await runsOf(late.id, "execute"))[0]!.status_id).toBe("stopped");
    expect(await approvalRow(l.approvalId)).toMatchObject({ decision: "approve", status_id: "approved" });
    const again = await one<Record<string, unknown>>(
      "select note, approver_member_id, irreversible, action_run_id, subject_id from approvals where ticket_id = $1 and decision is null",
      [late.id],
    );
    expect(again).toMatchObject({
      note: NOTE_24H,
      approver_member_id: boss.id,
      irreversible: true,
      action_run_id: l.makeRunId,
      subject_id: l.approvalId,
    });
    expect(await stageKeyOf(late.id)).toBe("awaiting_approval");
    expect(await stageKeyOf(early.id)).toBe("running");
  });

  it("K63-API-056 承認済み・実行待ち（24 時間を過ぎた）× PC が来ないまま、チケット・承認待ちを読む：読んだときの片付けで聞き直しの行が出る", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    const r = await queue(boss);
    expect(r.status).toBe(200);
    const again = ((await json(r)).data as unknown as { ticket_id: string; note: string | null }[]).find(
      (x) => x.ticket_id === t.id,
    );
    expect(again?.note).toBe(NOTE_24H);
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_24H });
    const g = await req("GET", `/tickets/${t.id}`, { headers: auth(boss) });
    expect(g.status).toBe(200);
    expect(((await json(g)).data as Record<string, unknown>)["approval"]).toMatchObject({ note: NOTE_24H });
  });

  it("K63-API-012 承認済み・実行中 × PC が中身のある結果で終わった：実行の記録は done・チケットは作業中・やり取りに 1 行。新しい成果物の版も承認待ちも作らない", async () => {
    const t = await ticket();
    const a = await approved(t);
    const artifactVersion = Number(
      (
        await one<{ v: number }>(
          "select version as v from ticket_sections where ticket_id = $1 and section_key = 'artifacts'",
          [t.id],
        )
      ).v,
    );
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    await finish(a.pc, a.execJobId, {
      state: "done",
      result: "送りました（宛先：先方の経理）",
      agent_session_id: a.agentSession,
    });
    expect((await runsOf(t.id, "execute"))[0]!.status_id).toBe("done");
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(await openApprovals(t.id)).toBe(0);
    expect(
      Number(
        (
          await one<{ v: number }>(
            "select version as v from ticket_sections where ticket_id = $1 and section_key = 'artifacts'",
            [t.id],
          )
        ).v,
      ),
    ).toBe(artifactVersion);
    const last = (await messagesOf(t.id)).at(-1)!;
    expect(last.kind).toBe("system");
    expect(last.body).toContain("実行しました");
    expect(last.body).toContain("送りました");
  });

  it("K63-API-013 承認済み・実行中 × PC が空の結果で終わった：完了と見なさず止まった（E-SIG-004・K-62 が足す自分の AI 向けの文）。チケットは作業中・理由を出す", async () => {
    const t = await ticket();
    const a = await approved(t);
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    await finish(a.pc, a.execJobId, { state: "done", result: "   ", agent_session_id: a.agentSession });
    const run = (await runsOf(t.id, "execute"))[0]!;
    expect(run.status_id).toBe("stopped");
    expect(run.error_summary).toContain("結果を返さずに終わりました");
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect((await messagesOf(t.id)).at(-1)!.body).toContain("結果を返さずに終わりました");
  });

  it("K63-API-014 承認済み・実行中 × PC が止まったと返す（道具の途中・使う量の枠）：自動で戻さない。止まった理由・チケットは作業中", async () => {
    const reasons = [
      "ここで止まりました。あなたが止めました。「メールを送る」は途中だったので、その結末は分かりません。先方の画面で確かめてください",
      "Claude Code の使える量の上限に当たったので止まりました。18:00 に戻ります",
    ];
    for (const reason of reasons) {
      const t = await ticket();
      const a = await approved(t);
      expect((await take(a.pc))?.id).toBe(a.execJobId);
      await finish(a.pc, a.execJobId, { state: "stopped", reason, agent_session_id: a.agentSession });
      const runs = await runsOf(t.id, "execute");
      expect(runs).toHaveLength(1); // 自動で積み直さない（D-090）
      expect(runs[0]!.status_id).toBe("stopped");
      expect(runs[0]!.error_summary).toBe(reason);
      expect(await stageKeyOf(t.id)).toBe("doing");
      expect((await messagesOf(t.id)).at(-1)!.body).toContain(reason.slice(0, 20));
      expect(await take(a.pc)).toBeNull();
    }
  });

  it("K63-API-015 承認済み・実行中（PC が落ちた）× PC がつながり直して取りに来る：残った実行を止め、二度送らない。チケットは作業中", async () => {
    const t = await ticket();
    const a = await approved(t);
    expect((await take(a.pc))?.id).toBe(a.execJobId);
    // PC が落ちて結末を送らないまま、つながり直して「何も動かしていない」と取りに来る
    expect(await take(a.pc, { idle: true })).toBeNull();
    expect((await jobOf(a.execJobId))["state_id"]).toBe("stopped");
    const runs = await runsOf(t.id, "execute");
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status_id).toBe("stopped");
    expect(await stageKeyOf(t.id)).toBe("doing");
    expect(await take(a.pc)).toBeNull();
  });

  it("K63-API-017 承認待ち × 2 つのタブで同時に承認・承認と差し戻しを同時に：先の 1 つだけ通り、後は 409・E-CONF-003。実行の仕事は 1 つ", async () => {
    const t1 = await ticket();
    const d1 = await delegated(t1);
    const both = await Promise.all([
      approve(boss, d1.approvalId, { key: "tab-a" }),
      approve(boss, d1.approvalId, { key: "tab-b" }),
    ]);
    expect(both.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await runsOf(t1.id, "execute")).toHaveLength(1);
    const t2 = await ticket();
    const d2 = await delegated(t2);
    const mixed = await Promise.all([approve(boss, d2.approvalId), giveBack(boss, d2.approvalId, "直してください")]);
    expect(mixed.map((r) => r.status).sort()).toEqual([201, 409]);
    const loser = mixed.find((r) => r.status === 409)!;
    expect((await json(loser))["code"]).toBe(CONF_DONE);
    const decided = await approvalRow(d2.approvalId);
    const execs = await runsOf(t2.id, "execute");
    const remakes = (await runsOf(t2.id, "make")).filter((x) => x.id !== d2.makeRunId);
    expect(execs.length + remakes.length).toBe(1);
    expect(decided["decision"] === "approve" ? execs.length : remakes.length).toBe(1);
  });
  it("K63-API-037 承認済み・実行待ち × チケットが消された後に PC が取りに来る：渡さない。仕事と実行の記録は止まった「チケットが消されたので止めました」", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [t.id, boss.id]);
    const got = await take(a.pc);
    expect(got?.id).not.toBe(a.execJobId);
    const job = await jobOf(a.execJobId);
    expect(job["state_id"]).toBe("stopped"); // 片付けは stopped・cancelled は取り下げだけ（D-131.14）
    expect(String(job["stopped_reason"])).toContain(STOP_GONE);
    expect((await runsOf(t.id, "execute"))[0]!.status_id).toBe("stopped");
  });
});

describe("K-63 承認して完了する：積む仕事の中身（口・本物の DB）", () => {
  it("K63-API-057 任せた人が外された・止められた・直せなくなった・PC を外した／つないでいない × 承認する・実行待ちのまま読む：実行の仕事は止め、チケットは作業中、帯に理由", async () => {
    const cases: [string, (tm: Team) => Promise<void>, RegExp][] = [
      [
        "外された",
        (tm) => f.admin.query("update members set deleted_at = now() where id = $1", [tm.by.id]).then(() => undefined),
        /いないので/,
      ],
      [
        "止められた",
        (tm) =>
          f.admin
            .query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [tm.by.id, boss.id])
            .then(() => undefined),
        /いないので/,
      ],
      [
        "直せなくなった",
        (tm) =>
          f.admin
            .query("update permissions set ability_id = 'view' where grantee_member_id = $1", [tm.by.id])
            .then(() => undefined),
        /直せなくなったので/,
      ],
      [
        "PC を外した",
        (tm) =>
          f.admin.query("update sessions set revoked_at = now() where id = $1", [tm.pc.sid]).then(() => undefined),
        /PC/,
      ],
    ];
    for (const [name, spoil, why] of cases) {
      // 承認の前に起きた：承認は記録し、実行の仕事はすぐ止める
      const before = await team(`任せた人（${name}・前）`);
      const t1 = await ticket();
      const d1 = await delegated(t1, { by: before });
      await spoil(before);
      expect((await approve(boss, d1.approvalId)).status, name).toBe(201);
      const r1 = (await runsOf(t1.id, "execute"))[0]!;
      expect(r1.status_id, name).toBe("stopped");
      expect(String(r1.error_summary)).toMatch(why);
      expect(await stageKeyOf(t1.id)).toBe("doing");
      // 承認の後・実行待ちの間に起きた：読んだときの片付けで止める（PC が来なくても）
      const after = await team(`任せた人（${name}・後）`);
      const t2 = await ticket();
      const a2 = await approved(t2, { by: after });
      await spoil(after);
      const g = await req("GET", `/tickets/${t2.id}`, { headers: auth(boss) });
      expect(g.status).toBe(200);
      const r2 = (await runsOf(t2.id, "execute"))[0]!;
      expect(r2.status_id, name).toBe("stopped");
      expect(String(r2.error_summary)).toMatch(why);
      expect((await jobOf(a2.execJobId))["state_id"]).toBe("stopped"); // 片付けは stopped（D-131.14）
      expect(await stageKeyOf(t2.id)).toBe("doing");
    }
    // PC を一度もつないでいない人：承認は記録し、実行は止める
    const noPc = await f.person(T.tenantId, T.rootScope, { name: "PC の無い人", ticketAbility: "edit" });
    const t3 = await ticket();
    const d3 = await delegated(t3, { by: { by: noPc, pc: { token: "", sid: "" } } });
    expect((await approve(boss, d3.approvalId)).status).toBe(201);
    const r3 = (await runsOf(t3.id, "execute"))[0]!;
    expect(r3.status_id).toBe("stopped");
    expect(String(r3.error_summary)).toMatch(/PC/);
  });

  it("K63-API-058 守り × 24 時間の片付けの関数を、別の PC のセッションで呼ぶ：何も変えない（要求の PC のセッションと同じかを確かめる）", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    const other = await team("別の PC の人");
    const ctx: TenantContext = { tenantId: T.tenantId, userId: other.by.id, role: "device", stepUpAt: null };
    const n = await withTenant(f.pool, ctx, (cl) =>
      cl.query<{ n: number }>("select app.ticket_execute_expire($1) as n", [a.pc.sid]),
    );
    expect(Number(n.rows[0]!.n)).toBe(0);
    expect((await jobOf(a.execJobId))["state_id"]).toBe("queued");
  });

  it("K63-API-061 操作の揺れ × 読むときの片付けと PC の取りが同時に動く（24 時間を過ぎた実行待ち）：仕事は渡されるか片付けられるかのどちらか 1 つ。片付けは queued の行だけを変え、聞き直しの行は 1 つ", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    const [taken] = await Promise.all([
      take(a.pc),
      queue(boss),
      req("GET", `/tickets/${t.id}`, { headers: auth(boss) }),
    ]);
    expect(taken?.id ?? null).not.toBe(a.execJobId); // 24 時間を過ぎたものは take も渡さない（守りの 2 層目）
    expect((await jobOf(a.execJobId))["state_id"]).toBe("stopped");
    expect(
      await num("select count(*) as n from approvals where ticket_id = $1 and decision is null and note = $2", [
        t.id,
        NOTE_24H,
      ]),
    ).toBe(1);
    // 動き出した仕事（running）は片付けが変えない
    const u = await ticket();
    const b = await approved(u);
    expect((await take(b.pc))?.id).toBe(b.execJobId);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      b.approvalId,
    ]);
    await Promise.all([queue(boss), queue(boss), req("GET", `/tickets/${u.id}`, { headers: auth(boss) })]);
    expect((await jobOf(b.execJobId))["state_id"]).toBe("running");
  });

  it("K63-API-071 実行が止まった理由：長い理由（5000 文字）は全文そのまま残る（切らない・D-131.2）。理由が空なら D-129.47 の文（D-131.4）", async () => {
    const long = "先方の画面で確かめてください。".repeat(400).slice(0, 5000);
    expect(long).toHaveLength(5000);
    const t1 = await ticket();
    const a1 = await approved(t1);
    expect((await take(a1.pc))?.id).toBe(a1.execJobId);
    await finish(a1.pc, a1.execJobId, { state: "stopped", reason: long, agent_session_id: a1.agentSession });
    const r1 = (await runsOf(t1.id, "execute"))[0]!;
    expect(r1.status_id).toBe("stopped");
    expect(r1.error_summary).toBe(long); // 400 字で切らない
    expect((await jobOf(a1.execJobId))["stopped_reason"]).toBe(long);
    expect((await messagesOf(t1.id)).at(-1)!.body).toContain(long); // やり取りの 1 行も全文
    // 理由が空・理由の欄を送らない（契約の reason は文字。null は入口が 422 で断るので送らない）
    for (const reason of ["", undefined]) {
      const t2 = await ticket();
      const a2 = await approved(t2);
      expect((await take(a2.pc))?.id).toBe(a2.execJobId);
      await finish(a2.pc, a2.execJobId, { state: "stopped", reason, agent_session_id: a2.agentSession });
      const r2 = (await runsOf(t2.id, "execute"))[0]!;
      expect(r2.status_id, JSON.stringify(reason)).toBe("stopped");
      expect(r2.error_summary).toBe(STOP_NO_REASON);
      expect(r2.error_summary).not.toContain("理由は分かりません");
      expect(await stageKeyOf(t2.id)).toBe("doing");
    }
  });

  it("K63-API-073 片付け（24 時間超・チケットが消された・任せた人が使えない）で止めた仕事と実行の記録は stopped・理由つき。cancelled にしない（D-131.14）。理由が重なったら「消された」＞「任せた人が使えない」＞「24 時間」の順で 1 つにし、24 時間を過ぎていても使えないなら聞き直さずに止める（決める人の答え answer=bf373f5b265a）", async () => {
    const tm = await team("片付けられる人");
    // 24 時間を過ぎた・任せた人は使える（聞き直し）
    const over = await ticket();
    const o = await approved(over, { by: tm });
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      o.approvalId,
    ]);
    // 読んで片付ける（任せた人がまだ使える間）：聞き直しの行が 1 つ
    expect((await detail(boss, o.approvalId)).status).toBe(200);
    expect(await jobOf(o.execJobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_24H });
    expect(await openApprovals(over.id)).toBe(1);
    // 24 時間を過ぎた・同時に任せた人が使えない（重なり）
    const both = await ticket();
    const b = await approved(both, { by: tm });
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      b.approvalId,
    ]);
    // チケットが消された（任せた人も使えない・24 時間も過ぎた）
    const gone = await ticket();
    const g = await approved(gone, { by: tm });
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      g.approvalId,
    ]);
    await f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [gone.id, boss.id]);
    const lost = await ticket();
    const l = await approved(lost, { by: tm });
    await f.admin.query("update permissions set ability_id = 'view' where grantee_member_id = $1", [tm.by.id]);
    // 読んだときの片付け（一覧）で 3 つとも止まる
    expect((await queue(boss)).status).toBe(200);
    for (const [name, jobId, ticketId, why] of [
      ["24 時間と使えないが重なった", b.execJobId, both.id, "直せなくなったので"],
      ["消された", g.execJobId, gone.id, STOP_GONE],
      ["直せなくなった", l.execJobId, lost.id, "直せなくなったので"],
    ] as const) {
      const job = await jobOf(jobId);
      expect(job["state_id"], name).toBe("stopped");
      expect(String(job["stopped_reason"]), name).toContain(why);
      const run = (await runsOf(ticketId, "execute"))[0]!;
      expect(run.status_id, name).toBe("stopped");
      expect(String(run.error_summary), name).toContain(why);
    }
    // 重なりは「使えない」で止め、聞き直さない（聞き直しの行を作らない・承認は approve のまま・チケットは作業中）
    expect(String((await jobOf(b.execJobId))["stopped_reason"])).not.toContain(STOP_24H);
    expect(await openApprovals(both.id)).toBe(0);
    expect((await approvalRow(b.approvalId))["decision"]).toBe("approve");
    expect(await stageKeyOf(both.id)).toBe("doing");
    // 消されたものは「消された」の 1 つだけ（24 時間の文も使えないの文も足さない）
    expect(String((await jobOf(g.execJobId))["stopped_reason"])).not.toContain(STOP_24H);
    expect(String((await jobOf(g.execJobId))["stopped_reason"])).not.toContain("直せなくなったので");
    expect(
      await num("select count(*) as n from bridge_jobs where id = any($1) and state_id = 'cancelled'", [
        [o.execJobId, b.execJobId, g.execJobId, l.execJobId],
      ]),
    ).toBe(0);
    expect(await stageKeyOf(over.id)).toBe("awaiting_approval"); // 24 時間だけなら聞き直し
    expect(await stageKeyOf(lost.id)).toBe("doing");
  });
  it("K63-API-079 承認済み・実行待ち（24 時間を過ぎた）× PC が来ないまま、承認の 1 件を読む：getApproval も読む前に片付けを回し、仕事は止まって聞き直しの行が 1 つできる", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    const r = await detail(boss, a.approvalId);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_24H });
    expect(await openApprovals(t.id)).toBe(1);
    expect((await approvalRow(a.approvalId))["decision"]).toBe("approve"); // 前の承認は approve のまま
  });
  it("K63-API-085 失敗 × 読む口の中の片付けが例外になった（一覧・1 件・チケットの詳細）：片付けを飛ばして、読めたものを 200 で返す（何も止めず・聞き直しの行も作らない）。次に開いたときにまた片付ける（決める人の答え answer=bf373f5b265a）", async () => {
    const t = await ticket();
    const a = await approved(t);
    await f.admin.query("update approvals set decided_at = now() - interval '24 hours 1 minute' where id = $1", [
      a.approvalId,
    ]);
    // 読むときの片付けの関数（K-164 の migration の ② b）を、この試験の中だけ例外に作り替える（形は元のまま・中身だけ）
    const sigs = ["app.ticket_execute_sweep(uuid)", "app.ticket_execute_sweep_mine()"];
    const origs: string[] = [];
    for (const sig of sigs) {
      const d = await one<{ def: string | null }>("select pg_get_functiondef(to_regprocedure($1)) as def", [sig]);
      expect(d.def, `${sig} が無い（K-164 の migration で作る）`).toBeTruthy();
      origs.push(d.def!);
    }
    const broken = (def: string) =>
      def
        .replace(/\n LANGUAGE \w+/, "\n LANGUAGE plpgsql")
        .replace(
          /AS \$(\w*)\$[\s\S]*\$\1\$\s*$/,
          () => "AS $k63$ begin raise exception 'K63 の試験で片付けを壊した'; end $k63$",
        );
    for (const def of origs) await f.admin.query(broken(def));
    try {
      const q = await queue(boss);
      expect(q.status, await q.clone().text()).toBe(200);
      const d = await detail(boss, a.approvalId);
      expect(d.status, await d.clone().text()).toBe(200);
      expect((((await json(d)).data as Record<string, unknown>)["approval"] as Record<string, unknown>)["id"]).toBe(
        a.approvalId,
      );
      const g = await req("GET", `/tickets/${t.id}`, { headers: auth(boss) });
      expect(g.status, await g.clone().text()).toBe(200);
      const got = (await json(g)).data as { ticket?: { id?: string } }; // チケットの詳細の答えは data.ticket（契約 TicketDetail・K-60）
      expect(got.ticket?.id).toBe(t.id);
      // 片付けは飛ばした：仕事は待ったまま・聞き直しの行は無い・前の承認は approve のまま
      expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "queued" });
      expect(await openApprovals(t.id)).toBe(0);
      expect((await approvalRow(a.approvalId))["decision"]).toBe("approve");
    } finally {
      for (const def of origs) await f.admin.query(def);
    }
    // 次に開いたときにまた片付ける
    expect((await queue(boss)).status).toBe(200);
    expect(await jobOf(a.execJobId)).toMatchObject({ state_id: "stopped", stopped_reason: STOP_24H });
    expect(await openApprovals(t.id)).toBe(1);
  });
});
