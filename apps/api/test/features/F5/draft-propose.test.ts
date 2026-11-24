// K-775「AI の案の道具 draft_propose（作る画面の会話の仕事で、題・本文・確認項目の案を会話の行に付ける）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K775-API-…）は 11_tickets/K-775.md の表と 1 対 1。道具の口は契約の callKanameTool（K-62）。
//   土台は delegate-kit.ts の makeKit（本物の Postgres・本物の口・本物の PC の印）。会話・仕事・チケットは DB に直に置く（作る画面の会話を始める口 K-774 の形に頼らない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentToolRoutes } from "../../../src/auth/agent-tools.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Person } from "../fixture.js";
import { data, json, makeKit, sha, type Device, type Kit } from "./delegate-kit.js";

const LIMIT_CODE = "E-TALK-070"; // この仕事で出せる案は 3 回まで（409）
const HOOKS_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "src", "hooks");

let k: Kit;
beforeAll(async () => {
  k = await makeKit();
}, 90_000);
afterAll(async () => {
  await k?.close();
});

/** 作る画面の会話を持つ人と、その人の PC */
const fresh = async (name: string): Promise<{ p: Person; pc: Device }> => {
  const p = await k.f.person(k.T.tenantId, k.T.rootScope, { name, ticketAbility: "edit" });
  return { p, pc: await k.device(p) };
};
/** 会話を DB に直に置く（talk_kind は draft・ticket・clone） */
async function conv(p: Person, kind: "draft" | "ticket" | "clone" = "draft", ticketId: string | null = null) {
  const r = await k.q<{ id: string }>(
    "insert into conversations (tenant_id, scope_id, owner_member_id, title, talk_kind, ticket_id) values ($1, $2, $3, 'K775 の会話', $4, $5) returning id",
    [k.T.tenantId, k.T.rootScope, p.id, kind, ticketId],
  );
  return r[0]!.id;
}
/** 会話に仕事を 1 件積み、その人の PC で取る（取れた仕事は道具の鍵を持つ） */
async function taken(p: Person, pc: Device, c: string, prompt = "題を考えて") {
  await k.q(
    "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode) values ($1, $2, $3, $4, 'queued', $5, 'chat', 'manual')",
    [k.T.tenantId, k.T.rootScope, p.id, c, prompt],
  );
  const job = await k.takeJob(pc);
  expect(job.conversation_id).toBe(c);
  return job;
}
/** 会話 + 仕事までを 1 つで */
async function started(name: string, kind: "draft" | "ticket" | "clone" = "draft") {
  const { p, pc } = await fresh(name);
  const t = kind === "ticket" ? await rawTicket(p) : null;
  const c = await conv(p, kind, t);
  const job = await taken(p, pc, c);
  return { p, pc, c, job, t };
}
/** チケットを DB に直に置き、確認項目を 1 件付ける（チケットの仕事を作るため） */
async function rawTicket(p: Person): Promise<string> {
  const jst = new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10);
  const t = (
    await k.q<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, due_on)
       values ($1, $2, '', $3, (select id from ticket_stages where tenant_id = $1 and key = 'todo'), '見積を作る', $4, $4, $5) returning id`,
      [k.T.tenantId, k.T.rootScope, k.taskKind, p.id, jst],
    )
  )[0]!.id;
  await k.q(
    "insert into test_specs (tenant_id, ticket_id, title, source, created_by, updated_by) values ($1, $2, '金額が合っている', 'manual', $3, $3)",
    [k.T.tenantId, t, p.id],
  );
  return t;
}
const propose = (pc: Device, jobId: string, token: string | null, input: unknown) =>
  k.tool(pc, jobId, "draft_propose", token, input);
type Res = { ok?: boolean; id?: string; remaining?: number };
const result = async (r: Response): Promise<Res> => ((await data<{ result: Res }>(r)).result ?? {}) as Res;
const proposalsOf = (c: string) =>
  k.q<{
    id: string;
    body: string | null;
    kind: string;
    sender_member_id: string | null;
    job_id: string | null;
    options: { proposal?: Record<string, unknown> } | null;
  }>(
    "select id, body, kind, sender_member_id, job_id, options from messages where conversation_id = $1 and kind = 'proposal' and deleted_at is null order by created_at, id",
    [c],
  );
const messageCount = (c: string) =>
  k.n("select count(*) as n from messages where conversation_id = $1 and deleted_at is null", [c]);
const auditOf = (c: string) =>
  k.q<{ action: string; actor_member_id: string; choke_point_id: string; payload: unknown }>(
    "select action, actor_member_id, choke_point_id, payload from audit_events where target_id = $1 and action = 'tool.draft_propose' order by created_at, id",
    [c],
  );
const codeOf = async (r: Response) => (await json(r))["code"];
const fieldsOf = async (r: Response) =>
  ((await json(r))["details"] as { field: string }[] | undefined)?.map((d) => d.field) ?? [];

describe("K-775 AI の案の道具 draft_propose", () => {
  it("K775-API-001 案を出す：題・本文・確認項目の 3 つで 201（ok・id・remaining 2）。会話の行（案・本文は空・書いた人は空・仕事の id・options.proposal）が 1 つ・証跡 1 行（字は入れない）・会話の更新時刻が進む", async () => {
    const { p, pc, c, job } = await started("案を出す人");
    const before = await messageCount(c);
    const stamp = (await k.q<{ at: string }>("select updated_at::text as at from conversations where id = $1", [c]))[0]!
      .at;
    const input = {
      title: "見積の PDF を作る",
      body: "先方に出す見積を PDF にする。\n金額は EG-097 と同じ。",
      checks: ["金額が見積と同じ", "宛名が合っている"],
    };
    const r = await propose(pc, job.job_id, job.tool_token, input);
    expect(r.status, await r.clone().text()).toBe(201);
    const v = await result(r);
    expect(v).toMatchObject({ ok: true, remaining: 2 });
    const rows = await proposalsOf(c);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: v.id,
      body: "",
      kind: "proposal",
      sender_member_id: null,
      job_id: job.job_id,
      options: { proposal: input },
    });
    expect(await messageCount(c)).toBe(before + 1);
    const after = (await k.q<{ at: string }>("select updated_at::text as at from conversations where id = $1", [c]))[0]!
      .at;
    expect(after > stamp).toBe(true);
    const audit = await auditOf(c);
    expect(audit).toEqual([
      { action: "tool.draft_propose", actor_member_id: p.id, choke_point_id: "C2", payload: { job_id: job.job_id } },
    ]);
    expect(JSON.stringify(audit)).not.toContain("見積");
  });

  it("K775-API-002 1 つの欄だけの案：題だけ・本文だけ・確認項目だけ、どれも 201。案には出した欄だけが入り、出さなかった欄は鍵ごと無い", async () => {
    const { pc, c, job } = await started("1 欄の人");
    for (const input of [{ title: "題だけ" }, { body: "本文だけ" }, { checks: ["確認項目だけ"] }]) {
      const r = await propose(pc, job.job_id, job.tool_token, input);
      expect(r.status, JSON.stringify(input)).toBe(201);
    }
    const rows = await proposalsOf(c);
    expect(rows.map((x) => x.options?.proposal)).toEqual([
      { title: "題だけ" },
      { body: "本文だけ" },
      { checks: ["確認項目だけ"] },
    ]);
  });

  it("K775-API-003 整え方：題と確認項目は前後の空白（全角・タブ・改行も）を落とし、空だけの確認項目の行は捨てる。本文は書いたとおり（前後の空白・改行・25 万字もそのまま）。知らない欄は捨てる", async () => {
    const { pc, c, job } = await started("整える人");
    const big = `${" 前の空白"}${"あ".repeat(250_000)}\n`;
    const r = await propose(pc, job.job_id, job.tool_token, {
      title: " \t　見積を作る　\n",
      body: big,
      checks: ["  金額が合っている \n", "", " 　\t", "宛名が合っている"],
      note: "知らない欄",
    });
    expect(r.status, (await r.clone().text()).slice(0, 200)).toBe(201);
    const p = (await proposalsOf(c))[0]!.options!.proposal!;
    expect(p).toEqual({ title: "見積を作る", body: big, checks: ["金額が合っている", "宛名が合っている"] });
  });

  it("K775-API-004 数と長さの境：確認項目はちょうど 50 件・1 件ちょうど 200 字で通る。51 件・201 字は 422（欄 checks）。空の行は捨てた後で数える", async () => {
    const { pc, c, job } = await started("境の人");
    const fifty = Array.from({ length: 50 }, (_, i) => `項目 ${i + 1}`);
    const ok50 = await propose(pc, job.job_id, job.tool_token, { checks: [...fifty, "", " "] });
    expect(ok50.status, await ok50.clone().text()).toBe(201);
    const ok200 = await propose(pc, job.job_id, job.tool_token, { checks: ["あ".repeat(200)] });
    expect(ok200.status).toBe(201);
    for (const checks of [[...fifty, "五十一"], ["あ".repeat(201)]]) {
      const r = await propose(pc, job.job_id, job.tool_token, { checks });
      expect(r.status).toBe(422);
      expect(await fieldsOf(r)).toContain("checks");
    }
    expect(await proposalsOf(c)).toHaveLength(2);
  });

  it("K775-API-005 題の境：ちょうど 200 字は通る。201 字・空白だけ・文字でないは 422（欄 title）で案が残らない", async () => {
    const { pc, c, job } = await started("題の人");
    const ok = await propose(pc, job.job_id, job.tool_token, { title: "あ".repeat(200) });
    expect(ok.status).toBe(201);
    for (const title of ["あ".repeat(201), " \t　\n", "", 7, ["題"]]) {
      const r = await propose(pc, job.job_id, job.tool_token, { title, body: "本文" });
      expect(r.status, JSON.stringify(title)).toBe(422);
      expect(await fieldsOf(r)).toContain("title");
    }
    expect(await proposalsOf(c)).toHaveLength(1);
  });

  it("K775-API-006 形の誤り：本文が数・配列・空白だけ、確認項目が文字・中身が数、何も無い・知らない欄だけ・確認項目が空だけは 422。案も回数も残らない（4 つ目まで通る）", async () => {
    const { pc, c, job } = await started("形の人");
    const bad: [unknown, string][] = [
      [{ body: 5 }, "body"],
      [{ body: ["本文"] }, "body"],
      [{ body: " \t\n　" }, "body"],
      [{ checks: "確認項目" }, "checks"],
      [{ checks: [1, "二つ目"] }, "checks"],
      [{}, "input"],
      [{ note: "知らない欄だけ" }, "input"],
      [{ checks: [] }, "input"],
      [{ checks: ["", "  "] }, "input"],
    ];
    for (const [input, field] of bad) {
      const r = await propose(pc, job.job_id, job.tool_token, input);
      expect(r.status, JSON.stringify(input)).toBe(422);
      expect(await fieldsOf(r), JSON.stringify(input)).toContain(field);
    }
    expect(await proposalsOf(c)).toHaveLength(0);
    for (let i = 0; i < 3; i++)
      expect((await propose(pc, job.job_id, job.tool_token, { title: `案 ${i + 1}` })).status).toBe(201);
  });

  it("K775-API-007 1 つの仕事で 3 回まで：3 回は 201（remaining 2・1・0）、4 回目は 409・E-TALK-070 で案は 3 行のまま・証跡も 3 行", async () => {
    const { c, pc, job } = await started("3 回の人");
    const left: (number | undefined)[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await propose(pc, job.job_id, job.tool_token, { title: `案 ${i + 1}` });
      expect(r.status, await r.clone().text()).toBe(201);
      left.push((await result(r)).remaining);
    }
    expect(left).toEqual([2, 1, 0]);
    const r4 = await propose(pc, job.job_id, job.tool_token, { title: "4 つ目" });
    expect(r4.status).toBe(409);
    expect(await codeOf(r4)).toBe(LIMIT_CODE);
    expect(await proposalsOf(c)).toHaveLength(3);
    expect(await auditOf(c)).toHaveLength(3);
  });

  it("K775-API-008 回数は仕事ごと：同じ会話の次の仕事は、前の仕事が 3 回出した後でも新しく 3 回出せる", async () => {
    const { p, pc, c, job } = await started("次の仕事の人");
    for (let i = 0; i < 3; i++) await propose(pc, job.job_id, job.tool_token, { title: `前 ${i + 1}` });
    expect((await k.finish(pc, job.job_id, { state: "done", result: "案を 3 つ出しました" })).status).toBe(201);
    const next = await taken(p, pc, c, "もう少し短くして");
    for (let i = 0; i < 3; i++) {
      const r = await propose(pc, next.job_id, next.tool_token, { title: `後 ${i + 1}` });
      expect(r.status, await r.clone().text()).toBe(201);
    }
    expect((await propose(pc, next.job_id, next.tool_token, { title: "後 4" })).status).toBe(409);
    expect(await proposalsOf(c)).toHaveLength(6);
  });

  it("K775-API-009 同時に 4 つ出す：3 つだけ通り（201×3）1 つは 409・E-TALK-070。案の行は 3 つ", async () => {
    const { c, pc, job } = await started("同時の人");
    const rs = await Promise.all(
      [1, 2, 3, 4].map((i) => propose(pc, job.job_id, job.tool_token, { title: `同時 ${i}` })),
    );
    expect(rs.map((r) => r.status).sort()).toEqual([201, 201, 201, 409]);
    expect(await proposalsOf(c)).toHaveLength(3);
  });

  it("K775-API-010 作る画面の会話の仕事で呼べる道具は draft_propose だけ：同じ鍵で draft_read（仕事の初期設定の別の道具）・goal_set・remember・ticket_read・spec_check は 403・何も書かない", async () => {
    const { c, pc, job } = await started("仕分けの人");
    const goals = await k.n("select count(*) as n from goals");
    for (const name of ["draft_read", "goal_set", "remember", "ticket_read", "spec_check"]) {
      const r = await k.tool(pc, job.job_id, name, job.tool_token, { name: "目標", target_value: 1 });
      expect(r.status, name).toBe(403);
    }
    expect(await k.n("select count(*) as n from goals")).toBe(goals);
    expect(await messageCount(c)).toBe(0);
  });

  it("K775-API-011 作る画面の会話の仕事でない鍵では 403：自分の AI との会話（clone）・チケットの会話・チケットの仕事・会話の無い仕事。案は残らない", async () => {
    const clone = await started("clone の人", "clone");
    const talk = await started("チケットの会話の人", "ticket");
    for (const s of [clone, talk]) {
      const r = await propose(s.pc, s.job.job_id, s.job.tool_token, { title: "案" });
      expect(r.status).toBe(403);
      expect(await proposalsOf(s.c)).toHaveLength(0);
    }
    const { p, pc } = await fresh("チケットの仕事の人");
    const t = await rawTicket(p);
    const d = await k.delegate(p, t);
    expect(d.status, await d.clone().text()).toBe(201);
    const tj = await k.takeJob(pc);
    expect(tj.kind).toBe("ticket");
    const r = await propose(pc, tj.job_id, tj.tool_token, { title: "案" });
    expect(r.status).toBe(403);
    expect(
      await k.n("select count(*) as n from messages where kind = 'proposal' and tenant_id = $1 and job_id = $2", [
        k.T.tenantId,
        tj.job_id,
      ]),
    ).toBe(0);
  });

  it("K775-API-012 鍵と PC の守り：鍵が無い・ほかの仕事の鍵・ほかの PC・終わった仕事の鍵は 403・案は残らない", async () => {
    const a = await started("鍵の人 A");
    const b = await started("鍵の人 B");
    const mine = await propose(a.pc, a.job.job_id, null, { title: "案" });
    expect(mine.status).toBe(403);
    const cross = await propose(a.pc, a.job.job_id, b.job.tool_token, { title: "案" });
    expect(cross.status).toBe(403);
    const otherPc = await propose(b.pc, a.job.job_id, a.job.tool_token, { title: "案" });
    expect(otherPc.status).toBe(403);
    expect((await k.finish(a.pc, a.job.job_id, { state: "done", result: "終わり" })).status).toBe(201);
    const late = await propose(a.pc, a.job.job_id, a.job.tool_token, { title: "終わった後" });
    expect(late.status).toBe(403);
    expect(await proposalsOf(a.c)).toHaveLength(0);
    expect(await proposalsOf(b.c)).toHaveLength(0);
  });

  it("K775-API-013 会話をチケットへ移した後（talk_kind が ticket になった後）は、動いていた仕事の同じ鍵でも 403・案は残らない", async () => {
    const { p, pc, c, job } = await started("移した人");
    expect((await propose(pc, job.job_id, job.tool_token, { title: "移す前" })).status).toBe(201);
    const t = await rawTicket(p);
    await k.q("update conversations set talk_kind = 'ticket', ticket_id = $2 where id = $1", [c, t]);
    const r = await propose(pc, job.job_id, job.tool_token, { title: "移した後" });
    expect(r.status).toBe(403);
    expect(await proposalsOf(c)).toHaveLength(1);
  });

  it("K775-API-014 持ち主が止められた後は 403（鍵は仕事の持ち主が使える間だけ）。案は残らない", async () => {
    const { p, pc, c, job } = await started("止められる人");
    await k.q("update members set suspended_at = now(), suspended_by = $2 where id = $1", [p.id, p.id]);
    const r = await propose(pc, job.job_id, job.tool_token, { title: "止められた後" });
    expect(r.status).toBe(403);
    expect(await proposalsOf(c)).toHaveLength(0);
  });

  it("K775-API-015 DB の入口（2 層目）を直に呼ぶ：鍵のハッシュ違い・ほかの PC・終わった仕事・会話の持ち主と仕事の持ち主が違う・draft でない会話は null で何も書かない。正しい呼び方は案を書く。security definer・search_path に pg_temp・public から外し kaname_app に渡す", async () => {
    const { p, pc, c, job } = await started("直に呼ぶ人");
    const call = (hash: string, session: string, job_id = job.job_id) =>
      k.q<{ v: unknown }>("select app.draft_tool_propose($1, $2, $3, $4, $5, $6::jsonb) as v", [
        job_id,
        hash,
        session,
        "題",
        null,
        null,
      ]);
    expect((await call(sha("違う鍵"), pc.sessionId))[0]!.v).toBeNull();
    expect((await call(sha(job.tool_token!), randomUUID()))[0]!.v).toBeNull();
    expect((await call(sha(job.tool_token!), pc.sessionId, randomUUID()))[0]!.v).toBeNull();
    // 会話の持ち主と仕事の持ち主が違う
    const other = await k.f.person(k.T.tenantId, k.T.rootScope, { name: "会話の持ち主", ticketAbility: "edit" });
    await k.q("update conversations set owner_member_id = $2 where id = $1", [c, other.id]);
    expect((await call(sha(job.tool_token!), pc.sessionId))[0]!.v).toBeNull();
    await k.q("update conversations set owner_member_id = $2 where id = $1", [c, p.id]);
    await k.q("update conversations set talk_kind = 'clone' where id = $1", [c]);
    expect((await call(sha(job.tool_token!), pc.sessionId))[0]!.v).toBeNull();
    await k.q("update conversations set talk_kind = 'draft' where id = $1", [c]);
    expect(await proposalsOf(c)).toHaveLength(0);
    const good = (await call(sha(job.tool_token!), pc.sessionId))[0]!.v as { ok?: boolean };
    expect(good.ok).toBe(true);
    expect(await proposalsOf(c)).toHaveLength(1);
    expect((await k.finish(pc, job.job_id, { state: "done", result: "終わり" })).status).toBe(201);
    expect((await call(sha(job.tool_token!), pc.sessionId))[0]!.v).toBeNull();
    const fn = await k.q<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean; args: string }>(
      `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', p.oid, 'execute') as app, pg_get_function_identity_arguments(p.oid) as args
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'draft_tool_propose'`,
    );
    expect(fn).toHaveLength(1);
    expect(fn[0]!.definer).toBe(true);
    expect(fn[0]!.cfg?.join(",") ?? "").toMatch(/search_path=.*pg_temp/);
    expect(fn[0]).toMatchObject({ pub: false, app: true });
    expect(fn[0]!.args).toBe(
      "p_job uuid, p_token_hash text, p_session uuid, p_title text, p_body text, p_checks jsonb",
    );
  });

  it("K775-API-016 DB の入口の形の砦：中身が全部空（題も本文も確認項目も無い）なら { error: shape }・4 回目は { error: limit }。どちらも何も書かない", async () => {
    const { c, pc, job } = await started("砦の人");
    const call = (title: string | null, body: string | null, checks: unknown) =>
      k.q<{ v: { error?: string; ok?: boolean } }>(
        "select app.draft_tool_propose($1, $2, $3, $4, $5, $6::jsonb) as v",
        [job.job_id, sha(job.tool_token!), pc.sessionId, title, body, checks === null ? null : JSON.stringify(checks)],
      );
    expect((await call(null, null, null))[0]!.v).toEqual({ error: "shape" });
    expect((await call("  ", "", []))[0]!.v).toEqual({ error: "shape" });
    expect(await proposalsOf(c)).toHaveLength(0);
    for (let i = 0; i < 3; i++) expect((await call(`案 ${i + 1}`, null, null))[0]!.v.ok).toBe(true);
    expect((await call("4 つ目", null, null))[0]!.v).toEqual({ error: "limit" });
    expect(await proposalsOf(c)).toHaveLength(3);
  });

  it("K775-API-017 S1 の失敗：証跡を書くところで DB が落ちると 503（E-PAGE-003）で、案の行は残らず回数にも数えない（次の呼び出しは通る）", async () => {
    const { c, pc, job } = await started("失敗の人");
    await k.f.admin.query(
      "create or replace function public.k775_break() returns trigger language plpgsql as $$ begin raise exception 'k775 試験が起こした失敗'; end $$",
    );
    await k.f.admin.query(
      `create trigger k775_break_audit before insert on audit_events for each row when (new.action = 'tool.draft_propose' and new.tenant_id = '${k.T.tenantId}'::uuid) execute function public.k775_break()`,
    );
    try {
      const r = await propose(pc, job.job_id, job.tool_token, { title: "失敗する案" });
      expect(r.status).toBe(503);
      expect(await codeOf(r)).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("drop trigger if exists k775_break_audit on audit_events");
    }
    expect(await proposalsOf(c)).toHaveLength(0);
    const again = await propose(pc, job.job_id, job.tool_token, { title: "直った後の案" });
    expect(again.status, await again.clone().text()).toBe(201);
    expect((await result(again)).remaining).toBe(2);
  });

  it("K775-API-018 会話を読む口（getConversation・K-757）の答えに案が出る：who は ai・text は空・proposal は出した欄だけ・job_id・passed は空。人の言葉・AI の返事の行はそのまま", async () => {
    const { p, pc, c, job } = await started("読む人");
    const m = (await import(join(HOOKS_DIR, "talk-read.ts"))) as { register: HookModule };
    Object.assign(k.f.hooks, m.register.make({ appPool: k.f.pool } as unknown as HookDeps));
    k.f.limits["getConversation"] = 100_000;
    expect((await propose(pc, job.job_id, job.tool_token, { title: "読まれる案", checks: ["一つ目"] })).status).toBe(
      201,
    );
    const r = await k.f.req("GET", `/conversations/${c}`, { headers: p.auth });
    expect(r.status, await r.clone().text()).toBe(200);
    const view = (await data<{ messages: Record<string, unknown>[] }>(r)).messages;
    const card = view.find((x) => (x["proposal"] as unknown) !== null && x["proposal"] !== undefined);
    expect(card).toMatchObject({
      who: "ai",
      text: "",
      job_id: job.job_id,
      passed: [],
      proposal: { title: "読まれる案", checks: ["一つ目"] },
    });
    expect(Object.keys(card!["proposal"] as object).sort()).toEqual(["checks", "title"]);
    expect(view.filter((x) => x["who"] === "me")).toHaveLength(0);
  });

  it("K775-API-019 仕事が終わった後も案は残り、AI の返事の行と並ぶ（案は返事の前）。案の行は AI の返事の行を増やさず消さない", async () => {
    const { c, pc, job } = await started("終わりの人");
    expect((await propose(pc, job.job_id, job.tool_token, { title: "終わる前の案" })).status).toBe(201);
    const fin = await k.finish(pc, job.job_id, { state: "done", result: "案を出しました" });
    expect(fin.status, await fin.clone().text()).toBe(201);
    const rows = await k.q<{ kind: string; body: string | null }>(
      "select kind, body from messages where conversation_id = $1 and deleted_at is null and kind in ('proposal', 'ai') order by created_at, id",
      [c],
    );
    expect(rows.map((x) => x.kind)).toEqual(["proposal", "ai"]);
    expect(rows[1]!.body).toBe("案を出しました");
  });

  it("K775-API-020 前の道すじの成果物の口 /bridge/artifact：作る画面の会話の仕事の鍵では 403・成果物は何も置かれない", async () => {
    const { c, pc, job } = await started("成果物の人");
    const app = agentToolRoutes({ appPool: k.f.pool });
    const r = await app.request("http://localhost/bridge/artifact", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-kaname-tool-token": job.tool_token!,
        "x-artifact-name": encodeURIComponent("見積.txt"),
      },
      body: "成果物の中身",
    });
    expect(r.status).toBe(403);
    expect(await k.n("select count(*) as n from artifacts where source_job_id = $1", [job.job_id])).toBe(0);
    expect(await proposalsOf(c)).toHaveLength(0);
    expect(pc.token).toBeTruthy();
  });

  it("K775-API-021 仕事の種類ごとの道具の一覧（toolsFor）：draft は draft_propose だけ。clone・種類の無い会話の仕事は前の道具（draft_propose は無い）。チケットの仕事に draft_propose は無い", async () => {
    const { toolsFor } = await import("../../../src/features/F5/delegate/tools.js");
    expect(toolsFor({ kind: "chat", conversation_id: randomUUID(), talk_kind: "draft" })).toEqual(["draft_propose"]);
    for (const talk_kind of ["clone", "ticket", null, undefined]) {
      const list = toolsFor({ kind: "chat", conversation_id: randomUUID(), talk_kind });
      expect(list, String(talk_kind)).not.toContain("draft_propose");
    }
    expect(toolsFor({ kind: "chat", conversation_id: randomUUID(), talk_kind: "clone" })).toContain("draft_read");
    expect(toolsFor({ kind: "ticket", conversation_id: null, talk_kind: null })).not.toContain("draft_propose");
    expect(toolsFor({ kind: "chat", conversation_id: null, talk_kind: null })).toEqual([]);
  });
});
