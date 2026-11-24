// K-699「任せたとき：必ず守るのページを確認項目に入れる＋「このチケットで守る物」をやり取りに置く」の単体の試験（DB の関数・本物の Postgres）。
//   行 ID は K699-API-NNN（チケット 11_tickets/K-699.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md の 6 章と K-699 の md。
//   「任せる」は DB の関数 app.ticket_delegate(チケット, 使わない理由)（段 5 の K-565 が 2 引数に作り直した物・K-699 が 1 か所足して作り直す）を、
//   任せる人の接続（withTenant）で直に呼ぶ。口（delegateTicket）を通した全体は K-714（中間）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { setupKnowledge, type Person } from "./knowledge.harness.js";

const h = setupKnowledge();

interface World {
  co: { tenantId: string; rootScope: string };
  g1: string;
  g2: string;
  boss: Person;
  mgr1: Person;
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
    mgr1: await h.person(co.tenantId, g1, { name: "営業マネージャー", role: "manager" }),
    mem1: await h.person(co.tenantId, g1, { name: "営業メンバー", role: "member" }),
    mem2: await h.person(co.tenantId, g2, { name: "開発メンバー", role: "member" }),
  };
};
const q = async <T>(sql: string, p: unknown[] = []): Promise<T[]> => (await h.admin.query(sql, p)).rows as T[];
const n = async (sql: string, p: unknown[]): Promise<number> => Number((await q<{ n: string }>(sql, p))[0]!.n);
const pub = (scope: string, owner: Person, title: string, text: string, o: Record<string, unknown> = {}) =>
  h.page({ scope, owner, state: "published", title, text, summary: `${title}の説明`, ...o });

const withPc = async (w: World, p: Person): Promise<void> => {
  await q("insert into sessions (tenant_id, member_id, kind_id, device_label) values ($1, $2, 'bridge', 'PC')", [
    w.co.tenantId,
    p.id,
  ]);
};
const mkTicket = async (w: World, scope: string, who: Person): Promise<string> => {
  const k = (
    await q<{ id: string }>("select id from ticket_kinds where tenant_id = $1 and deleted_at is null limit 1", [
      w.co.tenantId,
    ])
  )[0]!.id;
  const s = (
    await q<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = 'todo'", [w.co.tenantId])
  )[0]!.id;
  return (
    await q<{ id: string }>(
      "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by) values ($1, $2, '', $3, $4, '守る物の試験', $5, $5) returning id",
      [w.co.tenantId, scope, k, s, who.id],
    )
  )[0]!.id;
};
type Del = { ok: boolean; code?: string; run_id?: string; job_id?: string; pc?: string };
const delegate = (p: Person, ticket: string, reason: string | null = null): Promise<Del> =>
  withTenant(
    h.pool,
    p.ctx,
    async (cl) => (await cl.query<{ v: Del }>("select app.ticket_delegate($1, $2) as v", [ticket, reason])).rows[0]!.v,
  );
/** 走っている実行を終わらせ、段を未着手に戻す（もう 1 度任せられる形） */
const reset = async (w: World, ticket: string): Promise<void> => {
  await q("update action_runs set status_id = 'done', finished_at = now() where ticket_id = $1", [ticket]);
  await q(
    "update bridge_jobs set state_id = 'done', finished_at = now() where id in (select bridge_job_id from action_runs where ticket_id = $1)",
    [ticket],
  );
  await q(
    "update tickets set stage_id = (select id from ticket_stages where tenant_id = $1 and key = 'todo') where id = $2",
    [w.co.tenantId, ticket],
  );
};
interface Spec {
  title: string;
  source: string;
  source_ref_id: string | null;
  check_kind: string | null;
  checked_at: Date | null;
  version: number;
  created_by: string | null;
  deleted_at: Date | null;
}
const specs = (t: string) =>
  q<Spec>(
    "select title, source, source_ref_id, check_kind, checked_at, version, created_by, deleted_at from test_specs where ticket_id = $1 order by created_at, id",
    [t],
  );
const live = async (t: string) => (await specs(t)).filter((s) => s.deleted_at === null);
const guardLines = (t: string) =>
  q<{
    kind: string;
    author_member_id: string | null;
    body: string;
    changes: {
      field: string;
      to: string;
      must: { id: string; title: string; place: string }[];
      opened: { id: string; title: string; place: string }[];
    }[];
  }>(
    "select kind, author_member_id, body, changes from ticket_messages where ticket_id = $1 and changes->0->>'field' = 'guard_list' order by created_at",
    [t],
  );
const failAt = async (table: string, tenant: string, fn: () => Promise<void>): Promise<void> => {
  const name = `k699_fail_${table}`;
  await h.admin.query(
    `create or replace function ${name}() returns trigger language plpgsql as $$ begin if new.tenant_id = '${tenant}' then raise exception 'k699 わざと落とす'; end if; return new; end $$`,
  );
  await h.admin.query(`create trigger ${name} before insert on ${table} for each row execute function ${name}()`);
  try {
    await fn();
  } finally {
    await h.admin.query(`drop trigger if exists ${name} on ${table}`);
    await h.admin.query(`drop function if exists ${name}()`);
  }
};
const untouched = async (t: string, tenant: string) => {
  expect(await specs(t)).toEqual([]);
  expect(await guardLines(t)).toEqual([]);
  expect(await n("select count(*) as n from action_runs where ticket_id = $1", [t])).toBe(0);
  expect(
    await n("select count(*) as n from audit_events where tenant_id = $1 and action = 'knowledge.guard.seed'", [
      tenant,
    ]),
  ).toBe(0);
};

describe("K-699 必ず守るのページを確認項目に入れる", () => {
  it("K699-API-001 任せると、必ず守るのページごとに確認項目が 1 行入る（文は『題名』を守った・出どころ knowledge・チェックなし・並びは 会社 > グループ > 自分）", async () => {
    await h.ready();
    const w = await world("k699-001");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    const me = await pub(w.mem1.scopeId, w.mem1, "自分の工夫", "自分", { personal: true, must: true });
    const gp = await pub(w.g1, w.mgr1, "営業の型", "営業", { must: true });
    const co = await pub(w.co.rootScope, w.boss, "請求書の送り方", "会社", { must: true });
    const r = await delegate(w.mem1, t);
    expect(r.ok).toBe(true);
    const rows = await live(t);
    expect(rows.map((s) => [s.title, s.source, s.source_ref_id, s.check_kind, s.checked_at, s.created_by])).toEqual([
      ["『請求書の送り方』を守った", "knowledge", co, null, null, w.mem1.id],
      ["『営業の型』を守った", "knowledge", gp, null, null, w.mem1.id],
      ["『自分の工夫』を守った", "knowledge", me, null, null, w.mem1.id],
    ]);
  });

  it("K699-API-002 入るのはそのチケットで効く範囲だけ（会社＋チケットのグループ＋共有された物＋任せた人の自分）。ほかのグループ・ほかの人の自分は入らない", async () => {
    await h.ready();
    const w = await world("k699-002");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    const co = await pub(w.co.rootScope, w.boss, "会社の決まり", "会社", { must: true });
    await pub(w.g2, w.mem2, "開発の決まり", "開発", { must: true });
    await pub(w.mem2.scopeId, w.mem2, "他人の自分", "他人", { personal: true, must: true });
    const shared = await pub(w.g2, w.mem2, "共有された決まり", "共有", { must: true });
    await q("insert into knowledge_shares (tenant_id, page_id, group_id, shared_by) values ($1, $2, $3, $4)", [
      w.co.tenantId,
      shared,
      w.g1,
      w.mem2.id,
    ]);
    expect((await delegate(w.mem1, t)).ok).toBe(true);
    expect((await live(t)).map((s) => s.source_ref_id).sort()).toEqual([co, shared].sort());
  });

  it("K699-API-003 必ず守るでないページ・まだ公開していないページ・消したページは入らない。人が足した確認項目はそのまま残る", async () => {
    await h.ready();
    const w = await world("k699-003");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await q(
      "insert into test_specs (tenant_id, ticket_id, title, source, created_by) values ($1, $2, '人が足した確認', 'manual', $3)",
      [w.co.tenantId, t, w.mem1.id],
    );
    await pub(w.co.rootScope, w.boss, "必ず守るでない", "目次だけ");
    await h.page({ scope: w.co.rootScope, owner: w.boss, state: "draft", title: "書きかけ", text: "x" });
    const gone = await pub(w.co.rootScope, w.boss, "消した決まり", "x", { must: true });
    await q("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const kept = await pub(w.co.rootScope, w.boss, "生きている決まり", "x", { must: true });
    expect((await delegate(w.mem1, t)).ok).toBe(true);
    expect((await live(t)).map((s) => [s.title, s.source])).toEqual([
      ["人が足した確認", "manual"],
      ["『生きている決まり』を守った", "knowledge"],
    ]);
    expect((await live(t))[1]!.source_ref_id).toBe(kept);
  });

  it("K699-API-004 同じチケットをもう 1 度任せても、同じページの行は増えない。チェックの付いた行はそのまま（版も変わらない）", async () => {
    await h.ready();
    const w = await world("k699-004");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "会社の決まり", "会社", { must: true });
    await pub(w.g1, w.mgr1, "営業の型", "営業", { must: true });
    await delegate(w.mem1, t);
    await q(
      "update test_specs set checked_at = now(), checked_by_ai = true where ticket_id = $1 and title like '%会社の決まり%'",
      [t],
    );
    const before = await specs(t);
    await reset(w, t);
    expect((await delegate(w.mem1, t)).ok).toBe(true);
    const after = await specs(t);
    expect(after).toHaveLength(2);
    expect(after.map((s) => [s.title, s.checked_at !== null, s.version])).toEqual(
      before.map((s) => [s.title, s.checked_at !== null, s.version]),
    );
  });

  it("K699-API-005 題名が変わっていたら、チェックの付いていない行の文だけ新しい題名に直る（版が 1 つ進む）。チェック済みの行は元の文のまま", async () => {
    await h.ready();
    const w = await world("k699-005");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    const a = await pub(w.co.rootScope, w.boss, "古い題名 A", "a", { must: true });
    const b = await pub(w.co.rootScope, w.boss, "古い題名 B", "b", { must: true });
    await delegate(w.mem1, t);
    await q(
      "update test_specs set checked_at = now(), checked_by_ai = true where ticket_id = $1 and source_ref_id = $2",
      [t, b],
    );
    await q("update knowledge_pages set title = '新しい題名 A' where id = $1", [a]);
    await q("update knowledge_pages set title = '新しい題名 B' where id = $1", [b]);
    await reset(w, t);
    await delegate(w.mem1, t);
    const rows = await live(t);
    const ra = rows.find((s) => s.source_ref_id === a)!;
    const rb = rows.find((s) => s.source_ref_id === b)!;
    expect([ra.title, ra.version]).toEqual(["『新しい題名 A』を守った", 2]);
    expect([rb.title, rb.version]).toEqual(["『古い題名 B』を守った", 1]);
  });

  it("K699-API-006 必ず守るが外れた・ページが消えた・別の人が任せ直して範囲から外れた行は、チェックが無ければ消える（論理削除）。チェック済みは残る", async () => {
    await h.ready();
    const w = await world("k699-006");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    const off = await pub(w.co.rootScope, w.boss, "外れる決まり", "x", { must: true });
    const gone = await pub(w.co.rootScope, w.boss, "消える決まり", "x", { must: true });
    const done = await pub(w.co.rootScope, w.boss, "チェック済みの決まり", "x", { must: true });
    const mine = await pub(w.mem1.scopeId, w.mem1, "任せた人だけの決まり", "x", { personal: true, must: true });
    await delegate(w.mem1, t);
    await q(
      "update test_specs set checked_at = now(), checked_by_ai = true where ticket_id = $1 and source_ref_id = $2",
      [t, done],
    );
    await q("update knowledge_pages set is_must = false where id = $1", [off]);
    await q("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    await q("update knowledge_pages set is_must = false where id = $1", [done]);
    await reset(w, t);
    await q("update tickets set assignee_member_id = $1 where id = $2", [w.mgr1.id, t]);
    await withPc(w, w.mgr1);
    expect((await delegate(w.mgr1, t)).ok).toBe(true);
    const rows = await specs(t);
    const state = (id: string) => rows.find((s) => s.source_ref_id === id)!;
    expect([off, gone, mine].map((id) => state(id).deleted_at !== null)).toEqual([true, true, true]);
    expect(state(done).deleted_at).toBeNull();
    expect(state(done).checked_at).not.toBeNull();
  });

  it("K699-API-007 消えた行のページがまた必ず守るになったら、新しい行が入る（消した行は消えたまま）", async () => {
    await h.ready();
    const w = await world("k699-007");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    const p = await pub(w.co.rootScope, w.boss, "戻る決まり", "x", { must: true });
    await delegate(w.mem1, t);
    await q("update knowledge_pages set is_must = false where id = $1", [p]);
    await reset(w, t);
    await delegate(w.mem1, t);
    await q("update knowledge_pages set is_must = true where id = $1", [p]);
    await reset(w, t);
    await delegate(w.mem1, t);
    const all = (await specs(t)).filter((s) => s.source_ref_id === p);
    expect(all.map((s) => s.deleted_at !== null)).toEqual([true, false]);
  });

  it("K699-API-008 題名が 200 字のページでも、行の文は 200 字以内に収まる（題名を 190 字で切る）", async () => {
    await h.ready();
    const w = await world("k699-008");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "あ".repeat(200), "x", { must: true });
    expect((await delegate(w.mem1, t)).ok).toBe(true);
    const title = (await live(t))[0]!.title;
    expect([...title].length).toBeLessThanOrEqual(200);
    expect(title).toBe(`『${"あ".repeat(190)}』を守った`);
  });

  it("K699-API-009 必ず守るのページが 1 つも無いチケットは、確認項目も「守る物」の行も作らない（任せる前の前からの断りはそのまま）", async () => {
    await h.ready();
    const w = await world("k699-009");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "目次だけのページ", "x");
    await delegate(w.mem1, t, "使わない理由");
    expect((await live(t)).filter((s) => s.source === "knowledge")).toEqual([]);
    expect(await guardLines(t)).toEqual([]);
  });

  it("K699-API-010 断られた「任せる」（走っている・任せられない段・PC なし・書けない人）は、確認項目も行も監査も何も書かない", async () => {
    await h.ready();
    const w = await world("k699-010");
    await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    const noPc = await mkTicket(w, w.g1, w.mem1);
    expect((await delegate(w.mem1, noPc)).ok).toBe(false);
    await untouched(noPc, w.co.tenantId);
    await withPc(w, w.mem1);
    const wrong = await mkTicket(w, w.g1, w.mem1);
    await q(
      "update tickets set stage_id = (select id from ticket_stages where tenant_id = $1 and key = 'done') where id = $2",
      [w.co.tenantId, wrong],
    );
    expect((await delegate(w.mem1, wrong)).ok).toBe(false);
    await untouched(wrong, w.co.tenantId);
    const other = await mkTicket(w, w.g2, w.mem2);
    expect((await delegate(w.mem1, other)).ok).toBe(false);
    await untouched(other, w.co.tenantId);
    // 確認項目が 1 件も無くて使わない理由も無い（NO_SPEC）ときも書かない：必ず守るから外れた無チェックの古い行だけが残るチケット
    const stale = await mkTicket(w, w.g1, w.mem1);
    const off = await pub(w.co.rootScope, w.boss, "外れた決まり", "x");
    await q(
      "insert into test_specs (tenant_id, ticket_id, title, source, source_ref_id) values ($1, $2, 'x', 'knowledge', $3)",
      [w.co.tenantId, stale, off],
    );
    await q("update knowledge_pages set is_must = false where is_must and tenant_id = $1", [w.co.tenantId]);
    const noSpec = await delegate(w.mem1, stale);
    expect(noSpec).toMatchObject({ ok: false, code: "NO_SPEC" });
    expect((await live(stale)).map((s) => s.source_ref_id)).toEqual([off]);
    expect(await guardLines(stale)).toEqual([]);
    expect(await n("select count(*) as n from action_runs where ticket_id = $1", [stale])).toBe(0);
    expect(
      await n("select count(*) as n from audit_events where tenant_id = $1 and action = 'knowledge.guard.seed'", [
        w.co.tenantId,
      ]),
    ).toBe(0);
  });
});

describe("K-699 「このチケットで守る物」をやり取りに置く", () => {
  it("K699-API-011 任せるたびに 1 行（AI の更新の行・guard_list）。必ず守るの id・題名・場所が並びの順に入り、本文は入らない", async () => {
    await h.ready();
    const w = await world("k699-011");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    const folder = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "経理" });
    const co = await pub(w.co.rootScope, w.boss, "請求書の送り方", "秘密めいた本文", { must: true, folder });
    const gp = await pub(w.g1, w.mgr1, "営業の型", "営業", { must: true });
    await delegate(w.mem1, t);
    const lines = await guardLines(t);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: "change", author_member_id: null });
    expect(lines[0]!.changes[0]!.must).toEqual([
      { id: co, title: "請求書の送り方", place: "会社 › 経理" },
      { id: gp, title: "営業の型", place: "営業" },
    ]);
    expect(JSON.stringify(lines[0])).not.toContain("秘密めいた本文");
    await reset(w, t);
    await delegate(w.mem1, t);
    expect(await guardLines(t)).toHaveLength(2);
  });

  it("K699-API-022 やり取りの並び：任せた直後に (作った時刻, id) 順で読むと「に任せました」の行のあとに「守る物」の行が来て、守る物がいちばん後ろ（4 回とも）", async () => {
    await h.ready();
    const w = await world("k699-022");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    for (let i = 0; i < 4; i++) {
      expect((await delegate(w.mem1, t)).ok).toBe(true);
      const rows = await q<{ body: string; field: string | null }>(
        "select body, changes->0->>'field' as field from ticket_messages where ticket_id = $1 order by created_at, id",
        [t],
      );
      expect(rows[rows.length - 1]!.field).toBe("guard_list");
      const task = rows.map((r) => r.body.includes("に任せました")).lastIndexOf(true);
      expect(task).toBeGreaterThanOrEqual(0);
      expect(task).toBeLessThan(rows.length - 1);
      await reset(w, t);
    }
  });

  it("K699-API-012 「このチケットのために開いたページ」は、前の仕事でこのチケットのために AI が開いた見えるページ（新しい順・20 件まで・消えたページは出ない）", async () => {
    await h.ready();
    const w = await world("k699-012");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    const pages: string[] = [];
    for (let i = 0; i < 22; i++) pages.push(await pub(w.co.rootScope, w.boss, `開いた ${i}`, "x"));
    const gone = await pub(w.co.rootScope, w.boss, "消えた", "x");
    await q("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const hidden = await pub(w.g2, w.mem2, "見えないページ", "x");
    const seen = async (p: string, ago: number) =>
      q(
        "insert into reference_logs (tenant_id, ticket_id, ref_type, ref_id, title, seen_at) values ($1, $2, 'page', $3, 'x', now() - ($4 || ' minutes')::interval)",
        [w.co.tenantId, t, p, String(ago)],
      );
    for (let i = 0; i < pages.length; i++) await seen(pages[i]!, i + 1);
    await seen(gone, 0);
    await seen(hidden, 0);
    await delegate(w.mem1, t);
    const opened = (await guardLines(t))[0]!.changes[0]!.opened;
    expect(opened).toHaveLength(20);
    expect(opened[0]!.id).toBe(pages[0]);
    expect(opened.map((o) => o.id)).not.toContain(gone);
    expect(opened.map((o) => o.id)).not.toContain(hidden);
  });

  it("K699-API-013 監査は 1 回の任せるにつき 1 行（knowledge.guard.seed・チケットが対象・足した数と外した数だけ・題名を入れない）", async () => {
    await h.ready();
    const w = await world("k699-013");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "秘密めいた題名", "x", { must: true });
    await delegate(w.mem1, t);
    const a = await q<{
      actor_member_id: string;
      target_id: string;
      choke_point_id: string;
      payload: Record<string, unknown>;
    }>(
      "select actor_member_id, target_id, choke_point_id, payload from audit_events where tenant_id = $1 and action = 'knowledge.guard.seed'",
      [w.co.tenantId],
    );
    expect(a).toHaveLength(1);
    expect([a[0]!.actor_member_id, a[0]!.target_id, a[0]!.choke_point_id]).toEqual([w.mem1.id, t, "C2"]);
    expect(a[0]!.payload).toMatchObject({ added: 1, removed: 0 });
    expect(JSON.stringify(a[0]!.payload)).not.toContain("秘密めいた");
  });
});

describe("K-699 同時・守り・失敗", () => {
  it("K699-API-014 同じチケットを同時に 2 回任せても、通るのは 1 回で、ページごとの行は 1 つだけ", async () => {
    await h.ready();
    const w = await world("k699-014");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    const rs = await Promise.all([delegate(w.mem1, t), delegate(w.mem1, t)]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(await live(t)).toHaveLength(1);
    expect(await guardLines(t)).toHaveLength(1);
  });

  it("K699-API-015 表の一意：同じチケット・同じページの生きている行は 2 つ入らない。消した行・人が足した行（ページなし）は数えない", async () => {
    await h.ready();
    const w = await world("k699-015");
    const t = await mkTicket(w, w.g1, w.mem1);
    const p = await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    const ins = (src: string, ref: string | null) =>
      q("insert into test_specs (tenant_id, ticket_id, title, source, source_ref_id) values ($1, $2, 'x', $3, $4)", [
        w.co.tenantId,
        t,
        src,
        ref,
      ]);
    await ins("knowledge", p);
    await expect(ins("knowledge", p)).rejects.toThrow();
    await expect(ins("manual", null)).resolves.toBeDefined();
    await expect(ins("manual", null)).resolves.toBeDefined();
    await q("update test_specs set deleted_at = now() where ticket_id = $1 and source = 'knowledge'", [t]);
    await expect(ins("knowledge", p)).resolves.toBeDefined();
    await expect(ins("knowledge", randomUUID())).resolves.toBeDefined();
  });

  it("K699-API-016 別のチケットの行は数えず、外しもしない（同じページでもチケットごとに 1 行）", async () => {
    await h.ready();
    const w = await world("k699-016");
    await withPc(w, w.mem1);
    const t1 = await mkTicket(w, w.g1, w.mem1);
    const t2 = await mkTicket(w, w.g1, w.mem1);
    const p = await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    await delegate(w.mem1, t1);
    await q("update knowledge_pages set is_must = false where id = $1", [p]);
    await delegate(w.mem1, t2);
    expect((await live(t1)).map((s) => s.source_ref_id)).toEqual([p]);
    expect(await live(t2)).toEqual([]);
  });

  it("K699-API-017 種を入れる関数は、任せる関数の中からだけ呼べる（ログイン中のアプリの接続には渡さない）。任せる関数の答えの鍵は前のまま", async () => {
    await h.ready();
    const w = await world("k699-017");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    const priv = await q<{ ok: boolean }>(
      "select has_function_privilege('kaname_app', 'app.knowledge_seed_specs(uuid, uuid)', 'execute') as ok",
    );
    expect(priv[0]!.ok).toBe(false);
    const r = await delegate(w.mem1, t);
    expect(Object.keys(r).sort()).toEqual(["job_id", "ok", "pc", "run_id"]);
  });

  it("K699-API-018 止められた・外れた人を指定して種を入れる関数を直に呼ぶと例外（黙って守る物なしで進まない）。何も書かない", async () => {
    await h.ready();
    const w = await world("k699-018");
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    await q("update members set suspended_at = now() where id = $1", [w.mem1.id]);
    await expect(q("select app.knowledge_seed_specs($1, $2)", [t, w.mem1.id])).rejects.toThrow();
    expect(await specs(t)).toEqual([]);
    expect(await guardLines(t)).toEqual([]);
  });

  it("K699-API-019 手順 1：確認項目を書く所で落ちたら、任せる全体が戻る（仕事・実行・行・監査が残らず、段も変わらない）", async () => {
    await h.ready();
    const w = await world("k699-019");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    await failAt("test_specs", w.co.tenantId, async () => {
      await expect(delegate(w.mem1, t)).rejects.toThrow();
    });
    await untouched(t, w.co.tenantId);
    expect((await delegate(w.mem1, t)).ok).toBe(true);
  });

  it("K699-API-020 手順 2：やり取りの行を書く所で落ちたら、確認項目も含めて全部戻る", async () => {
    await h.ready();
    const w = await world("k699-020");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    await failAt("ticket_messages", w.co.tenantId, async () => {
      await expect(delegate(w.mem1, t)).rejects.toThrow();
    });
    await untouched(t, w.co.tenantId);
  });

  it("K699-API-021 手順 3：監査を書く所で落ちたら、確認項目もやり取りの行も全部戻る", async () => {
    await h.ready();
    const w = await world("k699-021");
    await withPc(w, w.mem1);
    const t = await mkTicket(w, w.g1, w.mem1);
    await pub(w.co.rootScope, w.boss, "会社の決まり", "x", { must: true });
    await failAt("audit_events", w.co.tenantId, async () => {
      await expect(delegate(w.mem1, t)).rejects.toThrow();
    });
    await untouched(t, w.co.tenantId);
  });
});
