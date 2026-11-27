// K-698「AI がページを開く道具（knowledge_open）」の単体の試験（DB の関数 app.knowledge_open・道具の口の部品・本物の Postgres）。
//   行 ID は K698-API-NNN（チケット 11_tickets/K-698.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md の 6 章と K-698 の md。
//   AI の道具は人の要求の文脈を持たない（鍵と PC の印で動く）ので、DB の関数は管理の接続で直に呼ぶ。口を通した全体（取る → 道具 → やり取り）は K-714。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { createHash, randomUUID } from "node:crypto";
import { withTenant } from "@kaname/db/context";
import { describe, expect, it } from "vitest";
import { setupKnowledge, type Person } from "./knowledge.harness.js";
import {
  KNOWLEDGE_OPEN_TEXT_MAX,
  openAnswer,
  parseOpenInput,
  runKnowledgeOpen,
} from "../../../src/features/F9/knowledge/ai/open.js";
import { toolsFor } from "../../../src/features/F5/delegate/tools.js";

const h = setupKnowledge();
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface World {
  co: { tenantId: string; rootScope: string };
  g1: string;
  g2: string;
  boss: Person;
  mem1: Person;
  mem2: Person;
}
const world = async (label: string): Promise<World> => {
  const co = await h.company(label);
  const g1 = await h.group(co.tenantId, co.rootScope, "営業");
  const g2 = await h.group(co.tenantId, co.rootScope, "受託開発");
  return {
    co,
    g1,
    g2,
    boss: await h.person(co.tenantId, co.rootScope, { name: "管理者", role: "admin" }),
    mem1: await h.person(co.tenantId, g1, { name: "営業メンバー", role: "member" }),
    mem2: await h.person(co.tenantId, g2, { name: "開発メンバー", role: "member" }),
  };
};

interface Run {
  job: string;
  token: string;
  session: string;
  ticket: string | null;
}
const q = async <T>(sql: string, p: unknown[]): Promise<T[]> => (await h.admin.query(sql, p)).rows as T[];
/** チケットの仕事（kind=ticket・実行の記録つき）か会話の仕事（kind=chat・チケットなし）を、受け取った PC つきで置く */
const mkRun = async (w: World, who: Person, scope: string, kind: "ticket" | "chat"): Promise<Run> => {
  const token = randomUUID() + randomUUID();
  const session = (
    await q<{ id: string }>(
      "insert into sessions (tenant_id, member_id, kind_id, device_label) values ($1, $2, 'bridge', 'PC') returning id",
      [w.co.tenantId, who.id],
    )
  )[0]!.id;
  let ticket: string | null = null;
  if (kind === "ticket") {
    const k = (
      await q<{ id: string }>("select id from ticket_kinds where tenant_id = $1 and deleted_at is null limit 1", [
        w.co.tenantId,
      ])
    )[0]!.id;
    const s = (
      await q<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = 'doing'", [w.co.tenantId])
    )[0]!.id;
    ticket = (
      await q<{ id: string }>(
        "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by) values ($1, $2, '', $3, $4, '道具の試験', $5, $5) returning id",
        [w.co.tenantId, scope, k, s, who.id],
      )
    )[0]!.id;
  }
  const job = (
    await q<{ id: string }>(
      `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, started_at, taken_session_id, tool_token_hash)
     values ($1, $2, $3, $4, 'running', '試験', now(), $5, $6) returning id`,
      [w.co.tenantId, scope, who.id, kind, session, sha(token)],
    )
  )[0]!.id;
  if (ticket)
    await h.admin.query(
      "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, created_by) values ($1, $2, $3, 'make', 'running', $4, now(), $5)",
      [w.co.tenantId, scope, ticket, job, who.id],
    );
  return { job, token, session, ticket };
};
interface OpenedPage {
  id: string;
  title: string;
  desc: string;
  place: string;
  body_text: string;
  truncated: boolean;
  [key: string]: unknown;
}
interface OpenedRow {
  ok: boolean;
  opened_now: boolean;
  page: OpenedPage;
  [key: string]: unknown;
}
const open = async (r: Run, page: string, o: { token?: string; session?: string } = {}) =>
  (
    await q<{ v: OpenedRow | null }>("select app.knowledge_open($1, $2, $3, $4) as v", [
      r.job,
      sha(o.token ?? r.token),
      o.session ?? r.session,
      page,
    ])
  )[0]!.v;
const pub = (scope: string, owner: Person, title: string, text: string, o: Record<string, unknown> = {}) =>
  h.page({ scope, owner, state: "published", title, text, summary: `${title}の説明`, ...o });
const n = async (sql: string, p: unknown[]): Promise<number> => Number((await q<{ n: string }>(sql, p))[0]!.n);
const logsOf = (job: string) =>
  q<{
    ticket_id: string | null;
    bridge_job_id: string;
    member_id: string;
    ref_type: string;
    ref_id: string;
    title: string;
  }>(
    "select ticket_id, bridge_job_id, member_id, ref_type, ref_id, title from reference_logs where bridge_job_id = $1 and deleted_at is null",
    [job],
  );
const linesOf = (t: string) =>
  q<{ kind: string; author_member_id: string | null; body: string; changes: Record<string, unknown>[] }>(
    "select kind, author_member_id, body, changes from ticket_messages where ticket_id = $1 and changes->0->>'field' = 'knowledge_open' order by created_at",
    [t],
  );

/** 指定の会社のその表への書き込みだけを落とす引き金（試験の間だけ・ほかの試験に当たらない） */
const failAt = async (table: string, tenant: string, fn: () => Promise<void>): Promise<void> => {
  const name = `k698_fail_${table}`;
  await h.admin.query(
    `create or replace function ${name}() returns trigger language plpgsql as $$ begin if new.tenant_id = '${tenant}' then raise exception 'k698 わざと落とす'; end if; return new; end $$`,
  );
  await h.admin.query(`create trigger ${name} before insert on ${table} for each row execute function ${name}()`);
  try {
    await fn();
  } finally {
    await h.admin.query(`drop trigger if exists ${name} on ${table}`);
    await h.admin.query(`drop function if exists ${name}()`);
  }
};

describe("K-698 ページを開く（DB の関数 app.knowledge_open）", () => {
  it("K698-API-001 チケットの仕事：見えるページの全文が返り、開いた記録とやり取りの 1 行が 1 つずつ残る", async () => {
    await h.ready();
    const w = await world("k698-001");
    const folder = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "経理" });
    const page = await pub(w.co.rootScope, w.boss, "請求書の送り方", "月末に締めて 5 日までに送る", { folder });
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    const v = (await open(r, page))!;
    expect(v["ok"]).toBe(true);
    expect(v["opened_now"]).toBe(true);
    expect(v["page"]).toMatchObject({
      id: page,
      title: "請求書の送り方",
      desc: "請求書の送り方の説明",
      place: "会社 › 経理",
      body_text: "月末に締めて 5 日までに送る",
      truncated: false,
    });
    const logs = await logsOf(r.job);
    expect(logs).toEqual([
      {
        ticket_id: r.ticket,
        bridge_job_id: r.job,
        member_id: w.mem1.id,
        ref_type: "page",
        ref_id: page,
        title: "請求書の送り方",
      },
    ]);
    const lines = await linesOf(r.ticket!);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: "change",
      author_member_id: null,
      body: "AI が『請求書の送り方』（会社 › 経理）を開きました",
    });
    expect(lines[0]!.changes[0]).toEqual({
      field: "knowledge_open",
      from: null,
      to: "請求書の送り方",
      note: "会社 › 経理",
      page_id: page,
    });
  });

  it("K698-API-002 会話の仕事（チケットなし）：記録は ticket_id なしで 1 行。やり取りの行は作らない。AI が開いた数に数えられる", async () => {
    await h.ready();
    const w = await world("k698-002");
    const page = await pub(w.g1, w.mem1, "営業の型", "営業用");
    const r = await mkRun(w, w.mem1, w.g1, "chat");
    // K-677 の関数は「見える人」の文脈で数える（管理の接続では見えない＝0 なので、人の接続で前と後を比べる）
    const opened30d = () =>
      withTenant(h.pool, w.mem1.ctx, async (cl) =>
        Number((await cl.query<{ v: number }>("select app.kn_page_ai_opened_30d($1) as v", [page])).rows[0]!.v),
      );
    const before = await opened30d();
    expect((await open(r, page))!["ok"]).toBe(true);
    const logs = await logsOf(r.job);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.ticket_id).toBeNull();
    expect(
      await n(
        "select count(*) as n from ticket_messages where tenant_id = $1 and changes->0->>'field' = 'knowledge_open'",
        [w.co.tenantId],
      ),
    ).toBe(0);
    expect(before).toBe(0);
    expect(await opened30d()).toBe(1);
    // K-677 の app.kn_page_ai_opened_30d が数える条件（ref_type・ref_id・消していない・30 日以内）にそのまま当たる行が 1 つできる
    expect(
      await n(
        "select count(*) as n from reference_logs where ref_type = 'page' and ref_id = $1 and deleted_at is null and seen_at >= now() - interval '30 days'",
        [page],
      ),
    ).toBe(1);
  });

  it("K698-API-003 同じ仕事で同じページを 2 回開いても、記録もやり取りの行も 1 つ（2 回目は opened_now が false）。証跡は開くたびに残る", async () => {
    await h.ready();
    const w = await world("k698-003");
    const page = await pub(w.co.rootScope, w.boss, "会社の決まり", "会社用");
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    expect((await open(r, page))!["opened_now"]).toBe(true);
    const second = (await open(r, page))!;
    expect(second["ok"]).toBe(true);
    expect(second["opened_now"]).toBe(false);
    expect(await logsOf(r.job)).toHaveLength(1);
    expect(await linesOf(r.ticket!)).toHaveLength(1);
    expect(
      await n("select count(*) as n from audit_events where tenant_id = $1 and action = 'tool.knowledge_open'", [
        w.co.tenantId,
      ]),
    ).toBe(2);
  });

  it("K698-API-004 同じ仕事で同時に開いても 1 行ずつ。別の仕事（もう 1 度任せた・別の人）は別に残る", async () => {
    await h.ready();
    const w = await world("k698-004");
    const page = await pub(w.co.rootScope, w.boss, "会社の決まり", "会社用");
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    await Promise.all([open(r, page), open(r, page), open(r, page)]);
    expect(await logsOf(r.job)).toHaveLength(1);
    expect(await linesOf(r.ticket!)).toHaveLength(1);
    const again = await mkRun(w, w.mem1, w.g1, "ticket");
    await open(again, page);
    expect(await n("select count(*) as n from reference_logs where ref_id = $1", [page])).toBe(2);
  });

  it("K698-API-005 その仕事で見えない物（ほかのグループ・下書き・消した・他人の自分・別の会社・無い id）は、どれも同じ答え null。何も残らない", async () => {
    await h.ready();
    const w = await world("k698-005");
    const other = await world("k698-005b");
    const otherGroup = await pub(w.g2, w.mem2, "開発の決まり", "開発用");
    const draft = await h.page({
      scope: w.co.rootScope,
      owner: w.boss,
      state: "draft",
      title: "書きかけ",
      text: "書きかけ",
    });
    const gone = await pub(w.co.rootScope, w.boss, "消した", "消した");
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const theirs = await pub(w.mem2.scopeId, w.mem2, "他人の自分", "他人", { personal: true });
    const foreign = await pub(other.co.rootScope, other.boss, "他社の決まり", "他社");
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    const answers = [];
    for (const p of [otherGroup, draft, gone, theirs, foreign, randomUUID()]) answers.push(await open(r, p));
    expect(answers).toEqual([null, null, null, null, null, null]);
    expect(await logsOf(r.job)).toEqual([]);
    expect(await linesOf(r.ticket!)).toEqual([]);
    expect(
      await n("select count(*) as n from audit_events where tenant_id = $1 and action = 'tool.knowledge_open'", [
        w.co.tenantId,
      ]),
    ).toBe(0);
  });

  it("K698-API-006 共有された物と、上と同じため目次から外れた写しも、見える範囲なので開ける", async () => {
    await h.ready();
    const w = await world("k698-006");
    const shared = await pub(w.g2, w.mem2, "共有された型", "共有の本文");
    await h.admin.query(
      "insert into knowledge_shares (tenant_id, page_id, group_id, shared_by) values ($1, $2, $3, $4)",
      [w.co.tenantId, shared, w.g1, w.mem2.id],
    );
    const orig = await pub(w.co.rootScope, w.boss, "経費の精算", "上限 5 万円");
    const copy = await pub(w.mem1.scopeId, w.mem1, "経費の精算（写し）", "上限 5 万円", {
      personal: true,
      copiedFrom: orig,
    });
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    expect((await open(r, shared))!["ok"]).toBe(true);
    expect((await open(r, copy))!["ok"]).toBe(true);
  });

  it("K698-API-007 鍵が違う・別の PC・終わった仕事・止められた人は null（開けず、何も残らない）", async () => {
    await h.ready();
    const w = await world("k698-007");
    const page = await pub(w.co.rootScope, w.boss, "会社の決まり", "会社用");
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    const other = await mkRun(w, w.mem2, w.g2, "chat");
    expect(await open(r, page, { token: "x".repeat(40) })).toBeNull();
    expect(await open(r, page, { session: other.session })).toBeNull();
    await h.admin.query("update bridge_jobs set state_id = 'done' where id = $1", [r.job]);
    expect(await open(r, page)).toBeNull();
    await h.admin.query("update bridge_jobs set state_id = 'running' where id = $1", [r.job]);
    await h.admin.query("update members set suspended_at = now() where id = $1", [w.mem1.id]);
    expect(await open(r, page)).toBeNull();
    expect(await logsOf(r.job)).toEqual([]);
  });

  it("K698-API-008 本文が 50,000 字を超えるページは 50,000 字で切り、truncated を true にする", async () => {
    await h.ready();
    const w = await world("k698-008");
    const big = await pub(w.co.rootScope, w.boss, "長いページ", "あ".repeat(KNOWLEDGE_OPEN_TEXT_MAX + 5));
    const exact = await pub(w.co.rootScope, w.boss, "ちょうど", "い".repeat(KNOWLEDGE_OPEN_TEXT_MAX));
    const r = await mkRun(w, w.mem1, w.g1, "chat");
    const a = (await open(r, big))!["page"];
    const b = (await open(r, exact))!["page"];
    expect([...a.body_text].length).toBe(KNOWLEDGE_OPEN_TEXT_MAX);
    expect(a.truncated).toBe(true);
    expect(b.truncated).toBe(false);
  });

  it("K698-API-009 証跡は誰の仕事・どのページかだけ残し、題名も本文も入れない", async () => {
    await h.ready();
    const w = await world("k698-009");
    const page = await pub(w.co.rootScope, w.boss, "秘密めいた題名", "秘密めいた本文");
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    await open(r, page);
    const a = (
      await q<{ actor_member_id: string; target_id: string; choke_point_id: string; payload: unknown }>(
        "select actor_member_id, target_id, choke_point_id, payload from audit_events where tenant_id = $1 and action = 'tool.knowledge_open'",
        [w.co.tenantId],
      )
    )[0]!;
    expect([a.actor_member_id, a.target_id, a.choke_point_id]).toEqual([w.mem1.id, page, "C2"]);
    expect(JSON.stringify(a.payload)).not.toContain("秘密めいた");
    expect(JSON.stringify(a.payload)).toContain(r.job);
  });

  it("K698-API-010 手順 1：開いた記録を書く所で落ちたら、ページは返らず、やり取りも証跡も残らない", async () => {
    await h.ready();
    const w = await world("k698-010");
    const page = await pub(w.co.rootScope, w.boss, "会社の決まり", "会社用");
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    await failAt("reference_logs", w.co.tenantId, async () => {
      await expect(open(r, page)).rejects.toThrow();
    });
    expect(await logsOf(r.job)).toEqual([]);
    expect(await linesOf(r.ticket!)).toEqual([]);
    expect(
      await n("select count(*) as n from audit_events where tenant_id = $1 and action = 'tool.knowledge_open'", [
        w.co.tenantId,
      ]),
    ).toBe(0);
  });

  it("K698-API-011 手順 2：やり取りの行を書く所で落ちたら、開いた記録も証跡も戻る（次に開けば記録される）", async () => {
    await h.ready();
    const w = await world("k698-011");
    const page = await pub(w.co.rootScope, w.boss, "会社の決まり", "会社用");
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    await failAt("ticket_messages", w.co.tenantId, async () => {
      await expect(open(r, page)).rejects.toThrow();
    });
    expect(await logsOf(r.job)).toEqual([]);
    expect(
      await n("select count(*) as n from audit_events where tenant_id = $1 and action = 'tool.knowledge_open'", [
        w.co.tenantId,
      ]),
    ).toBe(0);
    expect((await open(r, page))!["opened_now"]).toBe(true);
  });

  it("K698-API-012 手順 3：証跡を書く所で落ちたら、開いた記録もやり取りの行も戻る", async () => {
    await h.ready();
    const w = await world("k698-012");
    const page = await pub(w.co.rootScope, w.boss, "会社の決まり", "会社用");
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    await failAt("audit_events", w.co.tenantId, async () => {
      await expect(open(r, page)).rejects.toThrow();
    });
    expect(await logsOf(r.job)).toEqual([]);
    expect(await linesOf(r.ticket!)).toEqual([]);
  });
});

describe("K-698 開いた記録の表（reference_logs の直し）", () => {
  it("K698-API-013 ticket_id も bridge_job_id も無い行は入らない。チケットだけの前からの行は入る。別の会社の人・仕事は入らない", async () => {
    await h.ready();
    const w = await world("k698-013");
    const other = await world("k698-013b");
    const r = await mkRun(w, w.mem1, w.g1, "ticket");
    const page = await pub(w.co.rootScope, w.boss, "会社の決まり", "会社用");
    const ins = (t: string | null, j: string | null, m: string | null) =>
      h.admin.query(
        "insert into reference_logs (tenant_id, ticket_id, bridge_job_id, member_id, ref_type, ref_id) values ($1, $2, $3, $4, 'page', $5)",
        [w.co.tenantId, t, j, m, page],
      );
    await expect(ins(null, null, w.mem1.id)).rejects.toThrow();
    await expect(ins(r.ticket, null, null)).resolves.toBeDefined();
    await expect(ins(null, r.job, other.mem1.id)).rejects.toThrow();
    const foreignJob = (await mkRun(other, other.mem1, other.g1, "chat")).job;
    await expect(ins(null, foreignJob, w.mem1.id)).rejects.toThrow();
  });

  it("K698-API-014 同じ仕事・同じページの記録は表の一意で 1 つに保たれる（消した行は数えない）", async () => {
    await h.ready();
    const w = await world("k698-014");
    const r = await mkRun(w, w.mem1, w.g1, "chat");
    const page = await pub(w.co.rootScope, w.boss, "会社の決まり", "会社用");
    const ins = () =>
      h.admin.query(
        "insert into reference_logs (tenant_id, bridge_job_id, member_id, ref_type, ref_id) values ($1, $2, $3, 'page', $4)",
        [w.co.tenantId, r.job, w.mem1.id, page],
      );
    await ins();
    await expect(ins()).rejects.toThrow();
    await h.admin.query("update reference_logs set deleted_at = now() where bridge_job_id = $1", [r.job]);
    await expect(ins()).resolves.toBeDefined();
  });
});

describe("K-698 道具の口の部品（TS）", () => {
  it("K698-API-015 道具 knowledge_open は、チケットの仕事にも会話の仕事にも出る。ログインの試しには出ない。前からの分け方（ticket_read は会話に出さない）は変わらない", () => {
    const t = toolsFor({ kind: "ticket", conversation_id: null });
    const c = toolsFor({ kind: "chat", conversation_id: "c1" });
    expect(t).toContain("knowledge_open");
    expect(t).toContain("ticket_read");
    expect(t).not.toContain("draft_read");
    expect(c).toContain("knowledge_open");
    expect(c).toContain("draft_read");
    expect(c).not.toContain("ticket_read");
    expect(toolsFor({ kind: "login_check", conversation_id: null })).toEqual([]);
  });

  it("K698-API-016 入力はページの id（uuid）だけを読む。無い・文字でない・uuid でないは 422（欄 page_id）", () => {
    const id = randomUUID();
    expect(parseOpenInput({ page_id: id })).toEqual({ ok: true, page_id: id });
    expect(parseOpenInput({ page_id: id.toUpperCase(), extra: 1 })).toEqual({ ok: true, page_id: id });
    for (const bad of [{}, { page_id: 1 }, { page_id: "abc" }, { page_id: null }, null]) {
      const r = parseOpenInput(bad as never);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reply).toMatchObject({ status: 422, body: { details: [{ field: "page_id" }] } });
    }
  });

  it("K698-API-017 答えの形：開けたら 201 の data.result（ok・opened_now・page の 7 鍵）、見えない・無いは 404（欄も details も付けない）", () => {
    const page = { id: "p", title: "t", desc: "d", place: "会社", body_text: "b", truncated: false, version: 3 };
    const ok = openAnswer({ ok: true, opened_now: true, page });
    expect(ok.status).toBe(201);
    const result = (ok.body as { data: { result: { page: Record<string, unknown> } } }).data.result;
    expect(Object.keys(result.page).sort()).toEqual([
      "body_text",
      "desc",
      "id",
      "place",
      "title",
      "truncated",
      "version",
    ]);
    const nf = openAnswer(null);
    expect(nf).toEqual({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
  });

  it("K698-API-018 DB が落ちたら 503（E-PAGE-003）。題名・本文・id をログに出さず、何も残さない", async () => {
    await h.ready();
    const pool = {
      query: async () => {
        throw new Error("接続できません 秘密めいた題名");
      },
    };
    const logs = await h.captureLogs(async () => {
      const r = await runKnowledgeOpen(pool as never, {
        job: randomUUID(),
        tokenHash: sha("t"),
        session: randomUUID(),
        page: randomUUID(),
      });
      expect(r.status).toBe(503);
      expect((r.body as { code: string }).code).toBe("E-PAGE-003");
    });
    expect(logs).not.toContain("秘密めいた");
  });
});
