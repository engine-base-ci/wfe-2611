// K-746「試し打ちの口（dryRunTicket：承認待ちの成果物を、宛先を自分に差し替えて 1 回だけ実行する仕事を積む。承認待ちは変えない）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K746-API-…・K746-DB-…）は 11_tickets/K-746.md の行の表と 1 対 1。土台は K-63 の F5/approve-complete.harness.ts と K-732 が持ち込む F5/approval-more.kit.ts（loadHook）。
// 口：POST /api/v1/tickets/:id/dry-run（体は空）→ 201 { data: { run_id, job_id, status: "queued", pc } }。
//   試し打ちの実行は action_runs.phase = 'dry_run'。結末は引き金 app.dry_run_job_closed（仕事が閉じたとき）が実行の記録とやり取りの 1 行を書く。
//   承認の行・チケットの段・「AI に任せている」の旗・成果物の版は、どの結末でも変えない。
// 実行の仕事の prompt には、本人のメールアドレスを宛先に差し替える指示と、差し替えられない操作は「【試し打ちは実行せず止まりました】」で始まる返事で止まる約束を入れる。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。時刻は眠らずに DB の列をずらして置く。
import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  setupApproveComplete,
  f,
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
  messagesOf,
  snapshot,
  type Ticket,
  type Delegated,
} from "./approve-complete.harness.js";
import { loadHook } from "./approval-more.kit.js";
import type { Person } from "../fixture.js";

setupApproveComplete();

const BOSS_MAIL = "takamoto-k746@example.com";
const STOP_MARK = "【試し打ちは実行せず止まりました】";
const E_STATE = "E-RUN-003";
const E_UNUSABLE = "E-RUN-004";
const E_NO_MAIL = "E-RUN-005";
const E_RUNNING = "E-CONF-013";
const MSG_NO_REASON = "試し打ちが途中で止まりました（理由は届いていません）。もう一度試し打ちできます";
const MSG_CANCELLED = "PC でこの試し打ちをやめました。もう一度試し打ちできます";
const MSG_EMPTY = "自分のAI が結果を返さずに終わりました。完了とは見なしていません";
const MSG_MARK_DEFAULT = "宛先を差し替えられない操作があったので、実行せずに止まりました";

/** 試し打ちの口（葉の hooks のファイルは最初の要求のときに 1 回だけ読む・準備で読まない） */
const dry = async (p: Person, ticketId: string, body: unknown = {}) => {
  await loadHook("dry-run", "dryRunTicket");
  return req("POST", `/tickets/${ticketId}/dry-run`, { body, headers: auth(p) });
};
const code = async (r: Response) => (await json(r))["code"];
/** ログインのメールアドレスを持たせる（kaname_auth の利用者の行を直に置き、メンバーに結ぶ） */
const giveEmail = async (p: Person, email: string) => {
  const uid = randomUUID();
  await f.admin.query(
    'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
    [uid, "K746 の人", email],
  );
  await f.admin.query("update members set auth_user_id = $2 where id = $1", [p.id, uid]);
};
beforeAll(async () => {
  await giveEmail(boss, BOSS_MAIL); // setupApproveComplete の準備の後に流れる（登録の順）
}, 60_000);

const flag = async (t: string) =>
  (await one<{ d: boolean }>("select delegated_to_clone as d from tickets where id = $1", [t])).d;
const lines = async (t: string, word: string) => (await messagesOf(t)).filter((m) => m.body.includes(word));
const dryRuns = (t: string) => runsOf(t, "dry_run");
const auditCount = (runId: string) =>
  num("select count(*) as n from audit_events where action = 'action_runs.dry_run' and target_id = $1", [runId]);
const pendingOf = (t: string) =>
  num(
    "select count(*) as n from approvals where ticket_id = $1 and decision is null and withdrawn_at is null and deleted_at is null",
    [t],
  );
const artifactVersion = async (t: string) =>
  (
    await one<{ v: number }>(
      "select version as v from ticket_sections where ticket_id = $1 and section_key = 'artifacts'",
      [t],
    )
  ).v;
const jobRow = (id: string) =>
  one<Record<string, unknown>>(
    "select kind, state_id, member_id, prompt, permission_mode, agent_session_id, resume_session_id, result, stopped_reason from bridge_jobs where id = $1",
    [id],
  );
/** 承認待ちの成果物があるチケットを 1 つ作る（任せた人とその PC つき。担当者は既定で boss） */
async function pending(o: { assignee?: Person } = {}): Promise<{ t: Ticket; d: Delegated }> {
  const t = await ticket(o.assignee ? { assignee: o.assignee } : {});
  return { t, d: await delegated(t) };
}
const started = async (p: Person, t: Ticket) => {
  const r = await dry(p, t.id);
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as unknown as { run_id: string; job_id: string; status: string; pc: string };
};
/** 試し打ちを始め、PC が取って動いている（running）まで */
async function running(t: Ticket, d: Delegated) {
  const s = await started(boss, t);
  await lastSeen(d.pc.sid, 1);
  const job = await take(d.pc);
  expect(job?.id).toBe(s.job_id);
  return s;
}
const finishDry = (d: Delegated, jobId: string, b: Parameters<typeof finish>[2]) => finish(d.pc, jobId, b);
/** 何も書かれていないこと（承認の行・実行・仕事・やり取り・証跡・段） */
const unchanged = async (t: Ticket, before: Awaited<ReturnType<typeof snapshot>>) =>
  expect(await snapshot(t)).toEqual(before);

describe("K-746 試し打ちを始める：状態 × 入口 × 利用者の状態", () => {
  it("K746-API-001 承認待ちの成果物 × 試し打ち × 担当者：201（鍵は run_id・job_id・status・pc の 4 つ）。試し打ちの実行（dry_run）と仕事が待ちで積まれ、承認・段・旗・成果物の版は変わらず、やり取りと証跡に 1 つずつ", async () => {
    const { t, d } = await pending();
    const v0 = await artifactVersion(t.id);
    const r = await dry(boss, t.id);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = (await json(r)).data as unknown as { run_id: string; job_id: string; status: string; pc: string };
    expect(Object.keys(v).sort()).toEqual(["job_id", "pc", "run_id", "status"]);
    expect(v.status).toBe("queued");
    expect(["live", "asleep"]).toContain(v.pc);
    expect((await dryRuns(t.id)).map((x) => x.id)).toEqual([v.run_id]);
    expect((await dryRuns(t.id))[0]).toMatchObject({
      status_id: "queued",
      bridge_job_id: v.job_id,
      approval_id: d.approvalId, // 何の試し打ちか（承認待ちの行）
      created_by: boss.id, // 押した人
    });
    const j = await jobRow(v.job_id);
    expect(j).toMatchObject({
      kind: "ticket",
      state_id: "queued",
      member_id: d.by.id, // 動かすのは任せた人の AI・その人の PC（承認の後の実行と同じ・D-128.176）
      permission_mode: "auto",
      agent_session_id: null, // 作る段の会話に書き足さない
      resume_session_id: null,
    });
    // 承認待ちはそのまま
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null, status_id: "pending", withdrawn_at: null });
    expect(await pendingOf(t.id)).toBe(1);
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await flag(t.id)).toBe(true);
    expect(await artifactVersion(t.id)).toBe(v0);
    expect(await lines(t.id, "が試し打ちを始めました")).toHaveLength(1);
    expect((await lines(t.id, "が試し打ちを始めました"))[0]!.body).toBe(
      "高本が試し打ちを始めました（宛先を差し替えます）",
    );
    expect(await auditCount(v.run_id)).toBe(1);
    expect(
      (
        await one<{ p: Record<string, unknown> }>(
          "select payload as p from audit_events where action = 'action_runs.dry_run' and target_id = $1",
          [v.run_id],
        )
      ).p,
    ).toEqual({ ticket_id: t.id, approval_id: d.approvalId });
  });

  it("K746-API-002 仕事の prompt：本人のメールアドレスだけを宛先にする指示・本来の宛先に送らない約束・差し替えられない操作は決めた見出しで止まる約束・チケットの中身が続く。ほかの人のメールアドレスは入らない", async () => {
    const { t, d } = await pending({ assignee: boss });
    await giveEmail(d.by, "delegator-k746@example.com"); // 任せた人（動かす人）にもメールアドレスがある
    await f.admin.query(
      "insert into test_specs (tenant_id, ticket_id, title, check_kind, created_by, updated_by) values ($1, $2, '確認 1 件', 'human', $3, $3)",
      [t.tenant, t.id, boss.id],
    ); // 確認項目が 1 件ある（作る段の prompt なら「チェックを付けてから終わる」の指示が付く物）
    const s = await started(boss, t);
    const p = String((await jobRow(s.job_id))["prompt"]);
    expect(p).toContain("試し打ち");
    expect(p).toContain(BOSS_MAIL);
    expect(p).not.toContain("delegator-k746@example.com");
    expect(p).toContain("本来の宛先");
    expect(p).toContain(STOP_MARK);
    expect(p.indexOf("試し打ち")).toBeLessThan(p.indexOf(t.title)); // 試し打ちの指示がチケットの中身より前（頭）
    expect(p).toContain(t.title); // チケットの中身（app.ticket_job_context）は後ろに続く
    expect(p).toContain("成果物");
    expect(p).not.toContain("承認されました"); // 承認の後の実行の足し書きは付けない
    // 試し打ちは確認項目を変えない仕事：チェックを付ける指示も道具の名前も入らない（付けたチェックは外せない・D-153.19）
    expect(p).not.toContain("spec_check");
    expect(p).not.toContain("チェックを付けてから");
  });

  it("K746-API-003 状態の確かめ：承認待ちの成果物が無いチケット（作業中・承認済みで実行待ち・差し戻し済み・完了）は 409・E-RUN-003（何も書かれない）", async () => {
    // 作業中（承認待ちの行が無い）
    const a = await ticket({ stage: "doing" });
    const before = await snapshot(a);
    const r1 = await dry(boss, a.id);
    expect(r1.status).toBe(409);
    expect(await code(r1)).toBe(E_STATE);
    await unchanged(a, before);
    // 承認した後（実行待ち）
    const b = await ticket();
    const db = await delegated(b);
    expect((await approve(boss, db.approvalId)).status).toBe(201);
    const bb = await snapshot(b);
    const r2 = await dry(boss, b.id);
    expect([r2.status, await code(r2)]).toEqual([409, E_STATE]);
    await unchanged(b, bb);
    // 差し戻した後
    const c = await ticket();
    const dc = await delegated(c);
    expect((await giveBack(boss, dc.approvalId, "宛先が違います")).status).toBe(201);
    const bc = await snapshot(c);
    const r3 = await dry(boss, c.id);
    expect([r3.status, await code(r3)]).toEqual([409, E_STATE]);
    await unchanged(c, bc);
    // 承認待ちの行はあるが取り下げの印が付いている（取り下げた後の古い行だけ）／完了
    const e = await ticket({ stage: "done" });
    const re = await dry(boss, e.id);
    expect([re.status, await code(re)]).toEqual([409, E_STATE]);
  });

  it("K746-API-004 何回でも試せる：結末（届いた・止まった）の後にもう一度押すと新しい試し打ちが積まれ、承認待ちは 1 つのまま。2 つの実行の記録が残る", async () => {
    const { t, d } = await pending();
    const first = await running(t, d);
    await finishDry(d, first.job_id, { state: "done", result: "あなた宛てに送りました", agent_session_id: null });
    const second = await started(boss, t);
    expect(second.run_id).not.toBe(first.run_id);
    await lastSeen(d.pc.sid, 1);
    expect((await take(d.pc))?.id).toBe(second.job_id);
    await finishDry(d, second.job_id, { state: "stopped", reason: "途中で止まりました" });
    const third = await started(boss, t);
    expect(third.run_id).not.toBe(second.run_id);
    expect((await dryRuns(t.id)).map((x) => x.status_id)).toEqual(["done", "stopped", "queued"]);
    expect(await pendingOf(t.id)).toBe(1);
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
  });

  it("K746-API-005 走っている実行がある間は積めない：待っている・動いている試し打ちがあれば 409・E-CONF-013（今の実行の id つき・何も増えない）。同時に 5 つ押しても通るのは 1 つだけ", async () => {
    const { t, d } = await pending();
    const first = await started(boss, t);
    const before = await snapshot(t);
    const again = await dry(boss, t.id);
    expect(again.status).toBe(409);
    const body = await json(again);
    expect(body["code"]).toBe(E_RUNNING);
    expect(body["run_id"]).toBe(first.run_id);
    await unchanged(t, before);
    // 動いている間も同じ
    await lastSeen(d.pc.sid, 1);
    expect((await take(d.pc))?.id).toBe(first.job_id);
    expect((await dry(boss, t.id)).status).toBe(409);
    // 同時に 5 つ（別のチケット）
    const x = await pending();
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => dry(boss, x.t.id)));
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await dryRuns(x.t.id)).toHaveLength(1);
  });

  it("K746-API-006 利用者の状態：担当者でない人（同じグループの書ける人・マネージャー・見るだけの人）は 403 で何も書かれない。別の会社の人・無い id は 404（在るかを漏らさない）", async () => {
    const { t } = await pending();
    const before = await snapshot(t);
    for (const who of [writer, manager, viewer]) {
      const r = await dry(who, t.id);
      expect(r.status, who.id).toBe(403);
    }
    await unchanged(t, before);
    expect((await dry(outsider, t.id)).status).toBe(404);
    expect((await dry(boss, randomUUID())).status).toBe(404);
    expect(await dryRuns(t.id)).toEqual([]);
    expect(O.tenantId).not.toBe(T.tenantId);
  });

  it("K746-API-007 動かす AI が使えない：任せた人が止められた・PC を外した・チケットを直せなくなったときは 409・E-RUN-004（理由は detail.reason・何も積まない）", async () => {
    const reasons: string[] = [];
    // 止められた
    const a = await pending();
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [a.d.by.id]);
    // PC を外した
    const b = await pending();
    await f.admin.query("update sessions set revoked_at = now() where member_id = $1 and kind_id = 'bridge'", [
      b.d.by.id,
    ]);
    for (const x of [a, b]) {
      const before = await snapshot(x.t);
      const r = await dry(boss, x.t.id);
      expect(r.status, await r.clone().text()).toBe(409);
      const body = await json(r);
      expect(body["code"]).toBe(E_UNUSABLE);
      const reason = String((body["detail"] as { reason?: unknown } | undefined)?.reason ?? "");
      expect(reason).toMatch(/AI に任せた人/);
      reasons.push(reason);
      expect(body["field"]).toBeUndefined();
      expect(body["details"]).toBeUndefined();
      await unchanged(x.t, before);
      expect(await dryRuns(x.t.id)).toEqual([]);
    }
    expect(new Set(reasons).size).toBe(2); // 理由が分かれている
  });

  it("K746-API-008 宛先が決まらない：押した人のメールアドレスが分からないときは 409・E-RUN-005（何も積まない・メールアドレスは答えにもログにも出ない）", async () => {
    const { t } = await pending({ assignee: manager }); // manager にはメールアドレスが無い
    const before = await snapshot(t);
    const r = await dry(manager, t.id);
    expect(r.status, await r.clone().text()).toBe(409);
    const text = await r.clone().text();
    expect((await json(r))["code"]).toBe(E_NO_MAIL);
    expect(text).not.toContain("@");
    await unchanged(t, before);
  });

  it("K746-API-009 PC が取る：待っている試し打ちの仕事は、任せた人の PC に phase dry_run・ticket_id つきで渡り、実行の記録は動いている（running）になる。承認待ちは変わらない", async () => {
    const { t, d } = await pending();
    const s = await started(boss, t);
    await lastSeen(d.pc.sid, 1);
    const job = (await take(d.pc))!;
    expect(job.id).toBe(s.job_id);
    expect(job["phase"]).toBe("dry_run");
    expect(job["ticket_id"]).toBe(t.id);
    expect(job["kind"]).toBe("ticket");
    expect((await dryRuns(t.id))[0]).toMatchObject({ status_id: "running" });
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null });
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
  });

  it("K746-API-010 実行の読み口：getActionRun・listTicketRuns は試し打ちの実行を phase dry_run で返し（by は押した人）、承認の後の実行・作る段の実行と見分けられる。承認待ちの一覧は前のまま 1 件", async () => {
    const { t, d } = await pending();
    const s = await started(boss, t);
    const one1 = (await json(await req("GET", `/action_runs/${s.run_id}`, { headers: auth(boss) }))).data as Record<
      string,
      unknown
    >;
    expect(one1).toMatchObject({ id: s.run_id, ticket_id: t.id, phase: "dry_run", status: "queued" });
    expect((one1["by"] as { member_id: string }).member_id).toBe(boss.id);
    const list = (await json(await req("GET", `/tickets/${t.id}/runs`, { headers: auth(boss) }))).data as {
      phase: string;
    }[];
    expect(list.map((x) => x.phase).sort()).toEqual(["dry_run", "make"]);
    const q = (await json(await req("GET", "/approvals/queue", { headers: auth(boss) }))).data as { id: string }[];
    expect(q.filter((x) => x.id === d.approvalId)).toHaveLength(1);
  });
});

describe("K746-API-011〜 試し打ちの結末（app.dry_run_job_end と引き金 app.dry_run_job_closed）", () => {
  it("K746-API-011 届いた：中身のある結果で終わると、実行は done・やり取りに「あなた宛てに送りました」と結果の始め 200 字が 1 行。承認の行・段・旗・成果物の版は変わらない。答えの outcome は done", async () => {
    const { t, d } = await pending();
    const s = await running(t, d);
    const result = `${"あ".repeat(250)}`;
    const v0 = await artifactVersion(t.id);
    const r = await req("POST", `/bridge/jobs/${s.job_id}/finish`, {
      body: { state: "done", result, reason: null, agent_session_id: null },
      headers: { "x-bridge-session": d.pc.token },
    });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(((await json(r)).data as { outcome: string }).outcome).toBe("done");
    expect((await dryRuns(t.id))[0]).toMatchObject({ status_id: "done", error_summary: null });
    expect(await jobRow(s.job_id)).toMatchObject({ state_id: "done", result });
    const l = await lines(t.id, "あなた宛てに送りました");
    expect(l).toHaveLength(1);
    expect(l[0]!.body).toBe(
      `${await nameOf(d.by)}のAI が試し打ちをあなた宛てに送りました。届いた物を確かめてください：${"あ".repeat(200)}`,
    );
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null, status_id: "pending" });
    expect(await pendingOf(t.id)).toBe(1);
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await flag(t.id)).toBe(true);
    expect(await artifactVersion(t.id)).toBe(v0);
    expect(await num("select count(*) as n from action_runs where ticket_id = $1 and phase = 'execute'", [t.id])).toBe(
      0,
    );
  });

  it("K746-API-012 宛先を差し替えられず止まった：結果が決めた見出しで始まれば、実行は stopped・理由は見出しの後の字（全文）・やり取りに「止まりました」の 1 行・承認待ちは変わらない。理由が空なら決めた文", async () => {
    const { t, d } = await pending();
    const s = await running(t, d);
    await finishDry(d, s.job_id, {
      state: "done",
      result: `${STOP_MARK}\n応募フォームは宛先を差し替えられません`,
      agent_session_id: null,
    });
    expect((await dryRuns(t.id))[0]).toMatchObject({
      status_id: "stopped",
      error_summary: "応募フォームは宛先を差し替えられません",
    });
    expect(await jobRow(s.job_id)).toMatchObject({ state_id: "stopped", result: null });
    expect(await lines(t.id, "試し打ちが止まりました：応募フォームは宛先を差し替えられません")).toHaveLength(1);
    expect(await lines(t.id, "あなた宛てに送りました")).toHaveLength(0);
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await pendingOf(t.id)).toBe(1);
    // 理由が空
    const s2 = await started(boss, t);
    await lastSeen(d.pc.sid, 1);
    await take(d.pc);
    await finishDry(d, s2.job_id, { state: "done", result: `  ${STOP_MARK}  `, agent_session_id: null });
    expect((await dryRuns(t.id)).at(-1)).toMatchObject({ status_id: "stopped", error_summary: MSG_MARK_DEFAULT });
  });

  it("K746-API-013 PC が止まった・やめた：stopped は理由のとおり（空なら決めた文）・cancelled は実行も cancelled。どれも承認待ちは変わらず、もう一度試せる", async () => {
    const { t, d } = await pending();
    const a = await running(t, d);
    await finishDry(d, a.job_id, { state: "stopped", reason: "ブラウザが開けませんでした", agent_session_id: null });
    expect((await dryRuns(t.id)).at(-1)).toMatchObject({
      status_id: "stopped",
      error_summary: "ブラウザが開けませんでした",
    });
    const b = await running(t, d);
    await finishDry(d, b.job_id, { state: "stopped", reason: "  ", agent_session_id: null });
    expect((await dryRuns(t.id)).at(-1)).toMatchObject({ status_id: "stopped", error_summary: MSG_NO_REASON });
    const c = await running(t, d);
    await finishDry(d, c.job_id, { state: "cancelled", reason: null, agent_session_id: null });
    expect((await dryRuns(t.id)).at(-1)).toMatchObject({ status_id: "cancelled", error_summary: MSG_CANCELLED });
    expect(await jobRow(c.job_id)).toMatchObject({ state_id: "cancelled" });
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await flag(t.id)).toBe(true);
    expect(await pendingOf(t.id)).toBe(1);
    expect((await dry(boss, t.id)).status).toBe(201);
  });

  it("K746-API-014 結果が空・空白だけで終わった（G-15）：届いたとは見なさず、実行は stopped・理由は決めた文。やり取りに「届いた」の行は出ない", async () => {
    const { t, d } = await pending();
    for (const result of ["", " \n\t　"]) {
      const s = await running(t, d);
      await finishDry(d, s.job_id, { state: "done", result, agent_session_id: null });
      expect((await dryRuns(t.id)).at(-1)).toMatchObject({ status_id: "stopped", error_summary: MSG_EMPTY });
    }
    expect(await lines(t.id, "あなた宛てに送りました")).toHaveLength(0);
    expect(await lines(t.id, "試し打ちが止まりました")).toHaveLength(2);
  });

  it("K746-API-015 結果がとても長い（20 万字）：全文を仕事に残し、やり取りには始めの 200 字だけ。承認の後の実行と同じ", async () => {
    const { t, d } = await pending();
    const s = await running(t, d);
    const big = "宛".repeat(200_000);
    await finishDry(d, s.job_id, { state: "done", result: big, agent_session_id: null });
    expect(String((await jobRow(s.job_id))["result"])).toHaveLength(200_000);
    const l = (await lines(t.id, "あなた宛てに送りました"))[0]!;
    expect(l.body.length).toBeLessThan(400);
    expect(l.body.endsWith("宛".repeat(200))).toBe(true);
  });

  it("K746-API-016 試し打ちの間に承認した（操作の揺れ・G-13）：承認は通り、承認の後の実行が積まれる。試し打ちの結果が後から届いても、段・旗・承認の行は動かず、やり取りに 1 行だけ増える", async () => {
    const { t, d } = await pending();
    const s = await running(t, d);
    const ok = await approve(boss, d.approvalId);
    expect(ok.status, await ok.clone().text()).toBe(201);
    expect(await stageKeyOf(t.id)).toBe("running");
    const ap = await approvalRow(d.approvalId);
    const execRun = (await runsOf(t.id, "execute")).at(-1)!;
    await finishDry(d, s.job_id, { state: "done", result: "あなた宛てに送りました", agent_session_id: null });
    expect(await stageKeyOf(t.id)).toBe("running");
    expect(await flag(t.id)).toBe(true);
    expect(await approvalRow(d.approvalId)).toEqual(ap);
    expect((await runsOf(t.id, "execute")).at(-1)).toMatchObject({ id: execRun.id, status_id: execRun.status_id });
    expect((await dryRuns(t.id))[0]).toMatchObject({ status_id: "done" });
    expect(await lines(t.id, "あなた宛てに送りました")).toHaveLength(1);
  });

  it("K746-API-017 S3 の失敗・試し打ちの間にチケットが消された（処理の途中で対象が消えた）：結果は受け取れて落ちない。実行と仕事は閉じる", async () => {
    const { t, d } = await pending();
    const s = await running(t, d);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [t.id]);
    const r = await req("POST", `/bridge/jobs/${s.job_id}/finish`, {
      body: { state: "done", result: "送りました", reason: null, agent_session_id: null },
      headers: { "x-bridge-session": d.pc.token },
    });
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await dryRuns(t.id))[0]).toMatchObject({ status_id: "done" });
    expect(await jobRow(s.job_id)).toMatchObject({ state_id: "done" });
  });

  it("K746-API-018 S2 の失敗・PC が途中で止まった（G-15）：つながり直したときの片付け（idle）で、動いたまま残った試し打ちは実行も stopped になり、やり取りに 1 行。段・旗・承認待ちは変わらない", async () => {
    const { t, d } = await pending();
    const s = await running(t, d);
    await lastSeen(d.pc.sid, 1);
    await take(d.pc, { idle: true }); // 何も動かしていない＝その PC が受け取ったまま残った仕事を止める
    expect((await dryRuns(t.id))[0]).toMatchObject({ status_id: "stopped" });
    expect(await jobRow(s.job_id)).toMatchObject({ state_id: "stopped" });
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await flag(t.id)).toBe(true);
    expect(await pendingOf(t.id)).toBe(1);
    expect((await lines(t.id, "試し打ちが止まりました")).length).toBe(1);
  });

  it("K746-API-019 口座状態の波及（G-14）：試し打ちが動いている間に PC を外す・任せた人が止められると、実行は stopped・やり取りに 1 行・段と旗と承認待ちは変わらない（引き金が全部の閉じ方を受ける）", async () => {
    const a = await pending();
    const sa = await running(a.t, a.d);
    await f.admin.query("select app.device_revoke($1, $2)", [a.d.by.id, a.d.pc.sid]);
    expect((await dryRuns(a.t.id))[0]).toMatchObject({ status_id: "stopped" });
    expect(await jobRow(sa.job_id)).toMatchObject({ state_id: "stopped" });
    expect(await stageKeyOf(a.t.id)).toBe("awaiting_approval");
    expect(await flag(a.t.id)).toBe(true);
    expect(await lines(a.t.id, "試し打ちが止まりました")).toHaveLength(1);
    // 任せた人が止められた
    const b = await pending();
    const sb = await running(b.t, b.d);
    await f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [b.d.by.id]);
    expect((await dryRuns(b.t.id))[0]).toMatchObject({ status_id: "stopped" });
    expect(await jobRow(sb.job_id)).toMatchObject({ state_id: "stopped" });
    expect(await stageKeyOf(b.t.id)).toBe("awaiting_approval");
    expect(await flag(b.t.id)).toBe(true);
    expect(await pendingOf(b.t.id)).toBe(1);
  });

  it("K746-API-020 二重に届いた「終わった」（操作の揺れ）：同じ仕事に 2 回目の結果が届いても、やり取りは増えず実行は変わらない", async () => {
    const { t, d } = await pending();
    const s = await running(t, d);
    await finishDry(d, s.job_id, { state: "done", result: "送りました", agent_session_id: null });
    const before = await snapshot(t);
    const r = await req("POST", `/bridge/jobs/${s.job_id}/finish`, {
      body: { state: "done", result: "もう一度送りました", reason: null, agent_session_id: null },
      headers: { "x-bridge-session": d.pc.token },
    });
    expect(r.status).toBeLessThan(500);
    expect(await snapshot(t)).toEqual(before);
    expect(await lines(t.id, "あなた宛てに送りました")).toHaveLength(1);
  });

  it("K746-API-023 止める口（K-731 の stopActionRun）で試し打ちを止める：待っている試し打ちも動いている試し打ちも、実行と仕事だけが止まり、段（承認待ち）・旗（立ったまま）・承認の行・成果物の版は変わらない。やり取りの「AI を止めました」は 1 つ・答えの phase は dry_run", async () => {
    await loadHook("run-stop", "stopActionRun");
    const { t, d } = await pending();
    const v0 = await artifactVersion(t.id);
    // 待っている（PC がまだ取っていない）
    const waiting = await started(boss, t);
    const w = await req("POST", `/action_runs/${waiting.run_id}/stop`, { body: {}, headers: auth(boss) });
    expect(w.status, await w.clone().text()).toBe(201);
    expect(((await json(w)).data as Record<string, unknown>)["phase"]).toBe("dry_run");
    expect((await dryRuns(t.id))[0]).toMatchObject({ status_id: "stopped" });
    expect(await jobRow(waiting.job_id)).toMatchObject({ state_id: "stopped" });
    // 動いている（PC が取った）
    const s = await running(t, d);
    const r = await req("POST", `/action_runs/${s.run_id}/stop`, { body: {}, headers: auth(boss) });
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await dryRuns(t.id)).at(-1)).toMatchObject({ status_id: "stopped" });
    expect((await jobRow(s.job_id))["state_id"]).toBe("running"); // PC が合図を読んで返すまで動いたまま
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await flag(t.id)).toBe(true);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: null, status_id: "pending" });
    expect(await pendingOf(t.id)).toBe(1);
    expect(await artifactVersion(t.id)).toBe(v0);
    expect(await lines(t.id, "AI を止めました")).toHaveLength(2); // 止めた回数だけ 1 つずつ
    // 止めた後に届く「終わった」でも、段・旗・承認は動かない
    await finishDry(d, s.job_id, { state: "done", result: "届いた", agent_session_id: null });
    expect(await stageKeyOf(t.id)).toBe("awaiting_approval");
    expect(await flag(t.id)).toBe(true);
  });
});

describe("K746 失敗・契約・DB の形", () => {
  const failOn = async (table: string, fn: () => Promise<void>) => {
    const name = `k746_fail_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    await f.admin.query(
      `create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'k746 わざと落とす' using errcode = 'XX000'; end $$`,
    );
    await f.admin.query(
      `create trigger ${name} before insert on ${table} for each row when (new.tenant_id = '${T.tenantId}'::uuid) execute function ${name}()`,
    );
    try {
      await fn();
    } finally {
      await f.admin.query(`drop trigger if exists ${name} on ${table}`);
      await f.admin.query(`drop function if exists ${name}()`);
    }
  };

  it("K746-API-021 S1 の失敗・始めるときの失敗：仕事・やり取り・証跡のどこの書き込みで落ちても 503・E-PAGE-003 で、実行の記録も仕事もやり取りも何も残らない（[残る] の手順は無いので後片付けの行は要らない）", async () => {
    for (const table of ["bridge_jobs", "ticket_messages", "audit_events"]) {
      const { t } = await pending();
      const before = await snapshot(t);
      await failOn(table, async () => {
        const r = await dry(boss, t.id);
        expect([r.status, await code(r)], table).toEqual([503, "E-PAGE-003"]);
      });
      await unchanged(t, before);
      expect(await dryRuns(t.id)).toEqual([]);
    }
  });

  it("K746-API-022 体の形：体なし・空の体は通る。知らない項目を付けると 422（何も積まない）", async () => {
    const { t } = await pending();
    const before = await snapshot(t);
    const bad = await dry(boss, t.id, { to: "someone@example.com" });
    expect(bad.status).toBe(422);
    await unchanged(t, before);
    expect((await dry(boss, t.id, {})).status).toBe(201);
  });

  it("K746-DB-001 DB の形：app.ticket_dry_run は kaname_app だけが実行できる。app.dry_run_job_end・app.dry_run_job_closed・app.member_login_email は誰にも渡さない（中だけで使う）。引き金は仕事の終わりに 1 つ", async () => {
    const acl = await f.admin.query<{ name: string; app: boolean; pub: boolean }>(
      `select p.proname as name, has_function_privilege('kaname_app', p.oid, 'execute') as app, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('ticket_dry_run', 'dry_run_job_end', 'dry_run_job_closed', 'member_login_email') order by 1`,
    );
    expect(acl.rows).toEqual([
      { name: "dry_run_job_closed", app: false, pub: false },
      { name: "dry_run_job_end", app: false, pub: false },
      { name: "member_login_email", app: false, pub: false },
      { name: "ticket_dry_run", app: true, pub: false },
    ]);
    const trg = await f.admin.query<{ n: string }>(
      "select count(*) as n from pg_trigger where tgname = 'bridge_jobs_dry_run_end' and not tgisinternal",
    );
    expect(Number(trg.rows[0]!.n)).toBe(1);
  });

  it("K746-DB-002 実行の phase に dry_run を足した：dry_run は入り、知らない名前は入らない。前の make・execute・空は前のまま通る。作る段の仕事を渡した app.dry_run_job_end は null を返し何も書かない（K-731 の呼び口は前のまま通る）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    // check を壊す書き込みはしない（実装の前の準備の赤と見分けるため）：定義の字で見る
    const def = (
      await f.admin.query<{ d: string }>(
        "select pg_get_constraintdef(c.oid) as d from pg_constraint c where c.conname = 'action_runs_phase_check' and c.conrelid = 'action_runs'::regclass",
      )
    ).rows[0]!.d;
    for (const ph of ["dry_run", "make", "execute"]) expect(def).toContain(`'${ph}'`);
    expect(def).toMatch(/phase IS NULL/i);
    expect(def).not.toContain("bogus");
    expect(Number((def.match(/'[a-z_]+'/g) ?? []).length)).toBe(3);
    const before = await num("select count(*) as n from ticket_messages where ticket_id = $1", [t.id]);
    const v = (
      await f.admin.query<{ v: unknown }>("select app.dry_run_job_end($1, 'done', '結果', null, null) as v", [
        d.makeJobId,
      ])
    ).rows[0]!.v;
    expect(v).toBeNull();
    expect(await num("select count(*) as n from ticket_messages where ticket_id = $1", [t.id])).toBe(before);
  });
});

/** 人の表示名（やり取りの行に出る名前） */
async function nameOf(p: Person): Promise<string> {
  return (await one<{ n: string }>("select display_name as n from members where id = $1", [p.id])).n;
}
