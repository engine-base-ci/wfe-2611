// K-701「完了を止める：必ず守るから入った確認項目にチェックの無い行があれば、完了にできない」の単体の試験（DB の関数と引き金・本物の Postgres）。
//   行 ID は K701-API-NNN（チケット 11_tickets/K-701.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md の 6 章と K-701 の md。
//   完了は DB の関数 app.ticket_complete（段 5 の K-566 が引数を前のまま作り直した物・K-701 が 1 か所足して作り直す）を、押す人の接続（withTenant）で直に呼ぶ。
//   口（completeTicket）を通した全体は K-714（中間）。答えの言葉を口の答えにする部分（errors.ts の replyOf）は純粋な関数として確かめる。
//   行の準備は knowledge.guard-kit.ts（K-700 が運ぶ）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { kanameError } from "@kaname/errors";
import { withTenant } from "@kaname/db/context";
import { setupKnowledge, type Person } from "./knowledge.harness.js";
import { allAudits, audits, breakWrites, num } from "./knowledge.requests-kit.js";
import { aiCheck, guardSpec, mkTicket, pubPage, scene, type Scene } from "./knowledge.guard-kit.js";
import { replyOf } from "../../../src/features/F5/approve-complete/errors.js";

const h = setupKnowledge();

interface Left {
  id: string;
  title: string;
  page_id: string;
  page_title: string;
}
interface Result {
  error?: string;
  left?: Left[];
  ticket_id?: string;
  unchecked?: { body: number; specs: number };
}
// 完了の関数は段5 の K-578 で 2 引数（p_ticket・p_confirmed）になった。口（complete.ts）と同じ形で直に呼ぶ
const doComplete = (who: Person, ticket: string, confirmed = true): Promise<Result> =>
  withTenant(
    h.pool,
    who.ctx,
    async (cl) =>
      (
        await cl.query<{ v: Result }>("select app.ticket_complete($1, $2) as v", [
          ticket,
          confirmed,
        ])
      ).rows[0]!.v,
  );
const stageKey = async (t: string): Promise<string> =>
  (
    await h.admin.query<{ k: string }>(
      "select s.key as k from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
      [t],
    )
  ).rows[0]!.k;
const ticketRow = async (t: string): Promise<Record<string, unknown>> =>
  (await h.admin.query("select stage_id, completed_at, completed_by, updated_at from tickets where id = $1", [t]))
    .rows[0];
const specSnapshot = async (t: string): Promise<unknown[]> =>
  (
    await h.admin.query(
      "select id, title, checked_at, checked_by_ai, version, deleted_at from test_specs where ticket_id = $1 order by id",
      [t],
    )
  ).rows;
const msgCount = (t: string): Promise<number> =>
  num(h, "select count(*) as n from ticket_messages where ticket_id = $1", [t]);
const quiet = (): Promise<Scene> => scene(h, `k701-${Math.random().toString(36).slice(2, 8)}`, { job: false });
const checkAll = async (s: Scene): Promise<void> => {
  await aiCheck(h, s.specs.co);
  await h.admin.query(
    "update test_specs set checked_at = now(), checked_by_member_id = $2, checked_by_ai = false where id = $1",
    [s.specs.gp, s.w.mem1.id],
  );
  await aiCheck(h, s.specs.me);
};
const expectedLeft = (s: Scene): Left[] => [
  { id: s.specs.co, title: "『請求書の送り方』を守った", page_id: s.pages.co, page_title: "請求書の送り方" },
  { id: s.specs.gp, title: "『営業の型』を守った", page_id: s.pages.gp, page_title: "営業の型" },
  { id: s.specs.me, title: "『自分の工夫』を守った", page_id: s.pages.me, page_title: "自分の工夫" },
];

describe("K-701 完了を止める", () => {
  it("K701-API-001 必ず守るから入った確認項目にチェックの無い行があると完了にできず、残りの行の一覧（行の id・文・ページの id・題名）が答えに返る。チケットは動かない", async () => {
    await h.ready();
    const s = await quiet();
    const before = await ticketRow(s.ticket);
    const r = await doComplete(s.w.mem1, s.ticket);
    expect(r.error).toBe("knowledge_left");
    expect(r.left).toEqual(expectedLeft(s));
    expect(await stageKey(s.ticket)).toBe("doing");
    expect(await ticketRow(s.ticket)).toEqual(before);
  });

  it("K701-API-002 全部にチェックが付けば（AI が付けても人が付けても）完了にできる", async () => {
    await h.ready();
    const s = await quiet();
    await checkAll(s);
    const r = await doComplete(s.w.mem1, s.ticket);
    expect(r.error).toBeUndefined();
    expect(r.ticket_id).toBe(s.ticket);
    expect(await stageKey(s.ticket)).toBe("done");
  });

  it("K701-API-003 人が足した確認項目（manual）だけが未チェックなら止めない（K-566 のとおり数えて返すだけ）", async () => {
    await h.ready();
    const s = await quiet();
    await checkAll(s);
    await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, { source: "manual", title: "人が足した確認" });
    const r = await doComplete(s.w.mem1, s.ticket);
    expect(r.error).toBeUndefined();
    expect(r.unchecked?.specs).toBe(1);
    expect(await stageKey(s.ticket)).toBe("done");
  });

  it("K701-API-004 今は必ず守るで生きていないページの行（必ず守るが外れた・ページが消えた・まだ公開していない・効く範囲の外）は、チェックが無くても止めない", async () => {
    await h.ready();
    const s = await quiet();
    await aiCheck(h, s.specs.me);
    await aiCheck(h, s.specs.co);
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [s.pages.gp]);
    const gone = await pubPage(h, s.w.co.rootScope, s.w.boss, "消えた決まり", { must: true });
    await guardSpec(h, s.w, s.ticket, gone, s.w.mem1);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const draft = await h.page({ scope: s.w.g1, owner: s.w.mgr1, state: "draft", title: "書き直し中" });
    await guardSpec(h, s.w, s.ticket, draft, s.w.mem1);
    const other = await pubPage(h, s.w.g2, s.w.mem2, "開発の型", { must: true });
    await guardSpec(h, s.w, s.ticket, other, s.w.mem1);
    expect((await doComplete(s.w.mem1, s.ticket)).error).toBeUndefined();
    expect(await stageKey(s.ticket)).toBe("done");
  });

  it("K701-API-005 一覧には今も必ず守るで生きているページの未チェックの行だけが並ぶ（チェック済み・人が足した行・生きていないページの行は並ばない）", async () => {
    await h.ready();
    const s = await quiet();
    await aiCheck(h, s.specs.co);
    await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, { source: "manual", title: "人が足した確認" });
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [s.pages.me]);
    const r = await doComplete(s.w.mem1, s.ticket);
    expect(r.error).toBe("knowledge_left");
    expect(r.left).toEqual([expectedLeft(s)[1]]);
  });

  it("K701-API-006 止められたあと、チェックが付けば同じチケットが完了にできる（止めても行は動かず、付けたら通る）", async () => {
    await h.ready();
    const s = await quiet();
    await aiCheck(h, s.specs.co);
    await aiCheck(h, s.specs.gp);
    expect((await doComplete(s.w.mem1, s.ticket)).left).toEqual([expectedLeft(s)[2]]);
    await aiCheck(h, s.specs.me);
    expect((await doComplete(s.w.mem1, s.ticket)).error).toBeUndefined();
  });

  it("K701-API-007 止めた記録は破られた数に数えない。止めるときも通すときも、ナレッジの表・AI が開いた記録・確認項目・やり取り・証跡・お知らせに書かない", async () => {
    await h.ready();
    const s = await quiet();
    const snap = await specSnapshot(s.ticket);
    const msgs = await msgCount(s.ticket);
    const aud = await allAudits(h, s.w);
    expect((await doComplete(s.w.mem1, s.ticket)).error).toBe("knowledge_left");
    expect(await specSnapshot(s.ticket)).toEqual(snap);
    expect(await msgCount(s.ticket)).toBe(msgs);
    expect(await allAudits(h, s.w)).toBe(aud);
    expect(await audits(h, s.w, "ticket.complete")).toEqual([]);
    for (const t of ["knowledge_breaches", "reference_logs"])
      expect(await num(h, `select count(*) as n from ${t} where tenant_id = $1`, [s.w.co.tenantId])).toBe(0);
    await checkAll(s);
    expect((await doComplete(s.w.mem1, s.ticket)).error).toBeUndefined();
    expect(await num(h, "select count(*) as n from knowledge_breaches where tenant_id = $1", [s.w.co.tenantId])).toBe(
      0,
    );
  });

  it("K701-API-008 断りの順：作業中でない・確かめ印が無い・終わっていない子が在る、は先に断る（必ず守るの一覧より前）", async () => {
    await h.ready();
    const a = await quiet();
    await h.admin.query(
      "update tickets set stage_id = (select id from ticket_stages where tenant_id = $1 and key = 'todo') where id = $2",
      [a.w.co.tenantId, a.ticket],
    );
    expect((await doComplete(a.w.mem1, a.ticket)).error).toBe("not_doing");
    const b = await quiet();
    expect((await doComplete(b.w.mem1, b.ticket, false)).error).toBe("not_confirmed");
    const c = await quiet();
    const child = await mkTicket(h, c.w, c.w.g1, c.w.mem1, "doing");
    await h.admin.query("update tickets set parent_ticket_id = $1 where id = $2", [c.ticket, child]);
    expect((await doComplete(c.w.mem1, c.ticket)).error).toBe("children_left");
  });

  it("K701-API-009 ほかの人（管理者）が押しても同じ。そのチケットを書けない人は一覧を見せずに断られる（not_writable）", async () => {
    await h.ready();
    const s = await quiet();
    const asAdmin = await doComplete(s.w.boss, s.ticket);
    expect(asAdmin.error).toBe("knowledge_left");
    expect(asAdmin.left).toEqual(expectedLeft(s));
    const stranger = await doComplete(s.w.mem2, s.ticket);
    expect(stranger.error).toBe("not_writable");
    expect(stranger.left).toBeUndefined();
  });

  it("K701-API-010 別のチケットの確認項目は数えない（同じページでもチケットごと）", async () => {
    await h.ready();
    const a = await quiet();
    const t2 = await mkTicket(h, a.w, a.w.g1, a.w.mem1, "doing");
    const done2 = await guardSpec(h, a.w, t2, a.pages.co, a.w.mem1, { by: "ai" });
    expect(done2).toBeTruthy();
    expect((await doComplete(a.w.mem1, t2)).error).toBeUndefined();
    expect((await doComplete(a.w.mem1, a.ticket)).error).toBe("knowledge_left");
  });

  it("K701-API-011 人が足した未チェックの行と必ず守るの未チェックが混ざっても、一覧は必ず守るの行だけ（人が足した行は一覧に出ない）", async () => {
    await h.ready();
    const s = await quiet();
    const manual = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, {
      source: "manual",
      title: "人が足した確認",
    });
    const r = await doComplete(s.w.mem1, s.ticket);
    expect(r.left?.map((l) => l.id)).toEqual(expectedLeft(s).map((l) => l.id));
    expect(r.left?.map((l) => l.id)).not.toContain(manual);
  });

  it("K701-API-012 一覧の 1 行の鍵はちょうど id・title・page_id・page_title。ページの題名はそのときの題名で、行の文は元のまま", async () => {
    await h.ready();
    const s = await quiet();
    await h.admin.query("update knowledge_pages set title = '請求書の送り方（新）' where id = $1", [s.pages.co]);
    const r = await doComplete(s.w.mem1, s.ticket);
    for (const l of r.left!) expect(Object.keys(l).sort()).toEqual(["id", "page_id", "page_title", "title"]);
    expect(r.left![0]).toMatchObject({ title: "『請求書の送り方』を守った", page_title: "請求書の送り方（新）" });
  });

  it("K701-API-013 数える関数は 2 つとも土台どおり：app.knowledge_open_guard_count は未チェックの数、app.knowledge_guard_left は一覧（同じ数）。アプリの接続には渡さない", async () => {
    await h.ready();
    const s = await quiet();
    await aiCheck(h, s.specs.gp);
    const n = (await h.admin.query<{ n: number }>("select app.knowledge_open_guard_count($1) as n", [s.ticket]))
      .rows[0]!.n;
    const left = (await h.admin.query<{ v: Left[] }>("select app.knowledge_guard_left($1) as v", [s.ticket])).rows[0]!
      .v;
    expect(n).toBe(2);
    expect(left.map((l) => l.id)).toEqual([s.specs.co, s.specs.me]);
    for (const f of [
      "app.knowledge_open_guard_count(uuid)",
      "app.knowledge_guard_left(uuid)",
      "app.knowledge_complete_guard()",
    ])
      expect(
        (await h.admin.query<{ v: boolean }>(`select has_function_privilege('kaname_app', '${f}', 'execute') as v`))
          .rows[0]!.v,
      ).toBe(false);
  });

  it("K701-API-014 最後の砦：完了の関数を通らずに段を完了へ直に動かしても、未チェックがあれば止まる（KNW_GUARD_OPEN・何も変わらない）。付いていれば通る", async () => {
    await h.ready();
    const s = await quiet();
    const toDone = (): Promise<unknown> =>
      h.admin.query(
        "update tickets set stage_id = (select id from ticket_stages where tenant_id = $1 and key = 'done') where id = $2",
        [s.w.co.tenantId, s.ticket],
      );
    await expect(toDone()).rejects.toMatchObject({ code: "23514", message: expect.stringContaining("KNW_GUARD_OPEN") });
    expect(await stageKey(s.ticket)).toBe("doing");
    await checkAll(s);
    await toDone();
    expect(await stageKey(s.ticket)).toBe("done");
  });

  it("K701-API-015 最後の砦は完了への動きだけを見る：保留へ動かす・完了から作業中へ開き直す・最初から完了で作ることは、未チェックがあっても止まらない", async () => {
    await h.ready();
    const s = await quiet();
    const to = (key: string): Promise<unknown> =>
      h.admin.query(
        "update tickets set stage_id = (select id from ticket_stages where tenant_id = $1 and key = $3) where id = $2",
        [s.w.co.tenantId, s.ticket, key],
      );
    await to("hold");
    expect(await stageKey(s.ticket)).toBe("hold");
    await to("doing");
    await checkAll(s);
    await to("done");
    await h.admin.query(
      "update test_specs set checked_at = null, checked_by_ai = false, checked_by_member_id = null where id = $1",
      [s.specs.co],
    );
    await to("doing");
    expect(await stageKey(s.ticket)).toBe("doing");
    const k = (
      await h.admin.query<{ id: string }>("select id from ticket_kinds where tenant_id = $1 limit 1", [s.w.co.tenantId])
    ).rows[0]!.id;
    const d = (
      await h.admin.query<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = 'done'", [
        s.w.co.tenantId,
      ])
    ).rows[0]!.id;
    await h.admin.query(
      "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, created_by) values ($1, $2, '', $3, $4, '最初から完了', $5)",
      [s.w.co.tenantId, s.w.g1, k, d, s.w.mem1.id],
    );
  });

  it("K701-API-016 完了の段へ動かす DB の処理は app.ticket_complete だけ（migration を全部読み、完了の段へ動かす書き方がある所は、すべて app.ticket_complete を持つ物だけ）", () => {
    const dir = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "..",
      "..",
      "packages",
      "db",
      "migrations",
    );
    const toDone = /ticket_stage_to\([^)]*'done'[^)]*\)|update\s+tickets\s+set[^;]*stage_id\s*=[^;]*key\s*=\s*'done'/i;
    const hits = readdirSync(dir)
      .filter((n) => n.endsWith(".sql"))
      .filter((n) => toDone.test(readFileSync(join(dir, n), "utf8")));
    expect(hits.length).toBeGreaterThan(0);
    for (const n of hits)
      expect(readFileSync(join(dir, n), "utf8"), `${n} が app.ticket_complete の外で完了へ動かしている`).toContain(
        "function app.ticket_complete",
      );
  });

  it("K701-API-017 答えの言葉 knowledge_left は口の答えで 409・E-KNW-240・体は正本のエラー（error は conflict）に detail: { left } を足した物だけ（欄・details を付けない）", () => {
    const left: Left[] = [{ id: "a", title: "『営業の型』を守った", page_id: "b", page_title: "営業の型" }];
    const r = replyOf({ error: "knowledge_left", left }, "完了にする");
    expect(r.status).toBe(409);
    const body = r.body as Record<string, unknown>;
    expect(body["code"]).toBe("E-KNW-240");
    expect(body["detail"]).toEqual({ left });
    expect(body["details"]).toBeUndefined();
    expect(body["field"]).toBeUndefined();
    expect(body["error"]).toBe("conflict");
  });

  it("K701-API-018 台帳に E-KNW-240 がある（文は「チェック」を含み、画面の小窓の見出しと同じ意味）", () => {
    expect(kanameError("E-KNW-240").entry.message).toContain("チェック");
  });

  it("K701-API-019 開き直したあとの完了も同じ確かめ：完了 → 作業中に戻し、確認項目が足されて未チェックが在れば、また止まる", async () => {
    await h.ready();
    const s = await quiet();
    await checkAll(s);
    expect((await doComplete(s.w.mem1, s.ticket)).error).toBeUndefined();
    await h.admin.query(
      "update tickets set stage_id = (select id from ticket_stages where tenant_id = $1 and key = 'doing'), completed_at = null, completed_by = null where id = $2",
      [s.w.co.tenantId, s.ticket],
    );
    const p4 = await pubPage(h, s.w.co.rootScope, s.w.boss, "経費の精算", { must: true });
    const added = await guardSpec(h, s.w, s.ticket, p4, s.w.mem1, { title: "『経費の精算』を守った" });
    const r = await doComplete(s.w.mem1, s.ticket);
    expect(r.error).toBe("knowledge_left");
    expect(r.left?.map((l) => l.id)).toEqual([added]);
  });

  it("K701-API-020 任せた人が会社を抜けたあとは、その人の範囲で数えられないので止めない（任せた人を外すと仕事は閉じる＝K-62。完了を押す人が続きを持つ）", async () => {
    await h.ready();
    const s = await quiet();
    await h.admin.query("update members set deleted_at = now() where id = $1", [s.w.mem1.id]);
    const r = await doComplete(s.w.boss, s.ticket);
    expect(r.error).toBeUndefined();
    expect(await stageKey(s.ticket)).toBe("done");
  });

  it("K701-API-021 同時に 2 人が完了を押すと 1 人だけが通る（もう 1 人は完了済みで断られる）。止められている間は 2 人とも止められる", async () => {
    await h.ready();
    const ok = await quiet();
    await checkAll(ok);
    const rs = await Promise.all([doComplete(ok.w.mem1, ok.ticket), doComplete(ok.w.boss, ok.ticket)]);
    expect(rs.filter((r) => r.ticket_id === ok.ticket)).toHaveLength(1);
    expect(rs.filter((r) => r.error === "done")).toHaveLength(1);
    const no = await quiet();
    const both = await Promise.all([doComplete(no.w.mem1, no.ticket), doComplete(no.w.boss, no.ticket)]);
    expect(both.map((r) => r.error)).toEqual(["knowledge_left", "knowledge_left"]);
  });

  it("K701-API-022 失敗：完了の最後の書き込みで落ちたら、チェックの無い行を止める確かめは読むだけなので何も残さず、直せばまた押せる（K-566 の失敗の行と同じ・証跡を落とす）", async () => {
    await h.ready();
    const s = await quiet();
    await checkAll(s);
    const restore = await breakWrites(h, "audit_events", s.w.co.tenantId);
    try {
      await expect(doComplete(s.w.mem1, s.ticket)).rejects.toMatchObject({ code: "XX000" });
    } finally {
      await restore();
    }
    expect(await stageKey(s.ticket)).toBe("doing");
    expect((await doComplete(s.w.mem1, s.ticket)).error).toBeUndefined();
  });
});
