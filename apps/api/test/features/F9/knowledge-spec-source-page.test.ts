// K-726「確認項目の行に出どころのページ（source_page）を足す」の単体の試験（DB の関数 app.test_spec_item・本物の Postgres・答えの形と契約の読み）。
//   行 ID は K726-API-NNN（チケット 11_tickets/K-726.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md の 6 章と K-726 の md。
//   行の答えは段 5 の K-434 の DB の関数 app.test_spec_item（K-435 が入った後の本体を K-726 が 1 鍵だけ足して作り直す）を、見る人の接続（withTenant）で直に呼ぶ。
//   「今も必ず守るで生きている行」の判定は K-700 の app.knowledge_guard_specs の 1 か所（この葉は判定を持たない）。
//   口（listTestSpecs）を画面まで通した全体は K-703・K-716。行の準備は knowledge.guard-kit.ts（K-700 が運ぶ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { setupKnowledge, type Person } from "./knowledge.harness.js";
import { allAudits, num } from "./knowledge.requests-kit.js";
import { aiCheck, guardSpec, pubPage, scene, type Scene } from "./knowledge.guard-kit.js";

const h = setupKnowledge();

type Item = Record<string, unknown>;
const KEYS_7 = ["checked", "id", "position", "source", "source_page", "title", "version"];
const quiet = (): Promise<Scene> => scene(h, `k726-${Math.random().toString(36).slice(2, 8)}`, { job: false });
/** 見る人の接続で 1 行の答えを読む（口が行ごとに呼ぶ関数） */
const itemAs = (who: Person, spec: string): Promise<Item> =>
  withTenant(
    h.pool,
    who.ctx,
    async (cl) => (await cl.query<{ v: Item }>("select app.test_spec_item($1) as v", [spec])).rows[0]!.v,
  );
/** 口 listTestSpecs（list.ts）が打つ文と同じ：チケットの生きている行を作った順に */
const listAs = (who: Person, ticket: string): Promise<Item[]> =>
  withTenant(h.pool, who.ctx, async (cl) =>
    (
      await cl.query<{ v: Item }>(
        "select app.test_spec_item(id) as v from test_specs where ticket_id = $1 and deleted_at is null order by created_at, id",
        [ticket],
      )
    ).rows.map((r) => r.v),
  );
const guardIds = async (ticket: string): Promise<string[]> =>
  (await h.admin.query<{ id: string }>("select g as id from app.knowledge_guard_specs($1) g", [ticket])).rows
    .map((r) => r.id)
    .sort();
const specSnapshot = async (t: string): Promise<unknown[]> =>
  (
    await h.admin.query(
      "select id, title, checked_at, checked_by_ai, version, deleted_at, source, source_ref_id from test_specs where ticket_id = $1 order by id",
      [t],
    )
  ).rows;
const msgCount = (t: string): Promise<number> =>
  num(h, "select count(*) as n from ticket_messages where ticket_id = $1", [t]);

describe("K-726 確認項目の行の出どころのページ（source_page）", () => {
  it("K726-API-001 確認項目の行の source_page（app.test_spec_item）：出どころ knowledge で今も必ず守るで生きているページの行だけ { id, title（ページの今の題名） }（チェック済みでも出る）。人が足した行・必ず守るが外れた・消えた・下書き・範囲の外の行は null。鍵は元の 6 つと source_page の 7 つ", async () => {
    await h.ready();
    const s = await quiet();
    await aiCheck(h, s.specs.co);
    const manual = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, {
      source: "manual",
      title: "人が足した確認",
    });
    await h.admin.query("update knowledge_pages set title = '請求書の出し方' where id = $1", [s.pages.co]);
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [s.pages.me]);
    const gone = await pubPage(h, s.w.co.rootScope, s.w.boss, "消えた決まり", { must: true });
    const goneSpec = await guardSpec(h, s.w, s.ticket, gone, s.w.mem1);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const draft = await h.page({ scope: s.w.g1, owner: s.w.mgr1, state: "draft", title: "書き直し中" });
    const draftSpec = await guardSpec(h, s.w, s.ticket, draft, s.w.mem1);
    const other = await pubPage(h, s.w.g2, s.w.mem2, "開発の型", { must: true });
    const otherSpec = await guardSpec(h, s.w, s.ticket, other, s.w.mem1);
    const co = await itemAs(s.w.mem1, s.specs.co);
    expect(co["source_page"]).toEqual({ id: s.pages.co, title: "請求書の出し方" });
    expect(Object.keys(co).sort()).toEqual(KEYS_7);
    expect((await itemAs(s.w.mem1, s.specs.gp))["source_page"]).toEqual({ id: s.pages.gp, title: "営業の型" });
    for (const spec of [manual, s.specs.me, goneSpec, draftSpec, otherSpec])
      expect((await itemAs(s.w.mem1, spec))["source_page"], spec).toBeNull();
  });

  it("K726-API-002 口の答えの形（toSpecItem）：source_page を通す（{ id, title } も null も）・鍵はちょうど 7・ほかの 6 鍵は前のまま", async () => {
    const { toSpecItem } = await import("../../../src/features/F4/test-spec/shape.js");
    const base = {
      id: "a",
      title: "『営業の型』を守った",
      checked: false,
      position: 1,
      source: "knowledge",
      version: 1,
    };
    const withPage = { ...base, source_page: { id: "b", title: "営業の型" } };
    const a = toSpecItem(withPage as never) as unknown as Record<string, unknown>;
    expect(a).toEqual(withPage);
    expect(Object.keys(a).sort()).toEqual(KEYS_7);
    const b = toSpecItem({ ...base, source: "manual", source_page: null } as never) as unknown as Record<
      string,
      unknown
    >;
    expect(b["source_page"]).toBeNull();
    expect(b["source"]).toBe("manual");
    expect(Object.keys(b).sort()).toEqual(KEYS_7);
  });

  it("K726-API-003 一覧の問い合わせ（口 listTestSpecs と同じ文）：全部の行が 7 鍵・作った順のまま・チェック済みの行にも source_page が付き、人が足した行は null", async () => {
    await h.ready();
    const s = await quiet();
    await aiCheck(h, s.specs.co);
    const manual = await guardSpec(h, s.w, s.ticket, s.pages.co, s.w.mem1, {
      source: "manual",
      title: "人が足した確認",
    });
    const rows = await listAs(s.w.mem1, s.ticket);
    expect(rows.map((r) => r["id"])).toEqual([s.specs.co, s.specs.gp, s.specs.me, manual]);
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(KEYS_7);
    expect(rows[0]).toMatchObject({ checked: true, source: "knowledge" });
    expect(rows[0]!["source_page"]).toEqual({ id: s.pages.co, title: "請求書の送り方" });
    expect(rows[1]!["source_page"]).toEqual({ id: s.pages.gp, title: "営業の型" });
    expect(rows[2]!["source_page"]).toEqual({ id: s.pages.me, title: "自分の工夫" });
    expect(rows[3]).toMatchObject({ source: "manual", source_page: null, checked: false });
  });

  it("K726-API-004 判定は K-700 の app.knowledge_guard_specs と同じ 1 か所：source_page が付く行の集まりは、その関数が返す行の集まりと同じ（外れたページ・消えた行・範囲の外の行・任せた人が会社を抜けたあとは両方とも空）", async () => {
    await h.ready();
    const s = await quiet();
    await aiCheck(h, s.specs.co);
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [s.pages.me]);
    const other = await pubPage(h, s.w.g2, s.w.mem2, "開発の型", { must: true });
    const otherSpec = await guardSpec(h, s.w, s.ticket, other, s.w.mem1);
    const all = [s.specs.co, s.specs.gp, s.specs.me, otherSpec];
    const withPage = async (): Promise<string[]> =>
      (await Promise.all(all.map(async (id) => ((await itemAs(s.w.boss, id))["source_page"] ? id : null))))
        .filter((x): x is string => x !== null)
        .sort();
    expect(await guardIds(s.ticket)).toEqual([s.specs.co, s.specs.gp].sort());
    expect(await withPage()).toEqual(await guardIds(s.ticket));
    await h.admin.query("update members set deleted_at = now() where id = $1", [s.w.mem1.id]);
    expect(await guardIds(s.ticket)).toEqual([]);
    expect(await withPage()).toEqual([]);
  });

  it("K726-API-005 読むだけ：1 行を読んでも一覧を読んでも、確認項目の行・やり取り・証跡・破られた数・AI が開いた記録のどれも増えも変わりもしない", async () => {
    await h.ready();
    const s = await quiet();
    const snap = await specSnapshot(s.ticket);
    const msgs = await msgCount(s.ticket);
    const aud = await allAudits(h, s.w);
    await listAs(s.w.mem1, s.ticket);
    await itemAs(s.w.mem1, s.specs.gp);
    expect(await specSnapshot(s.ticket)).toEqual(snap);
    expect(await msgCount(s.ticket)).toBe(msgs);
    expect(await allAudits(h, s.w)).toBe(aud);
    for (const t of ["knowledge_breaches", "reference_logs"])
      expect(await num(h, `select count(*) as n from ${t} where tenant_id = $1`, [s.w.co.tenantId])).toBe(0);
  });

  it('K726-API-006 契約：確認項目の行の答え TestSpecItem を持つ段 5 の契約の断片（K-434・K-435）の、どの TestSpecItem にも source_page が省略できる 1 欄（"object?"）として足されている', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "05_flow", "screen_api.d");
    let total = 0;
    for (const n of ["K-434.py", "K-435.py"]) {
      const text = readFileSync(join(dir, n), "utf8");
      const items = (text.match(/"TestSpecItem"/g) ?? []).length;
      const pages = (text.match(/"source_page": "object\?"/g) ?? []).length;
      expect(pages, `${n} の TestSpecItem ${items} か所すべてに source_page が要る`).toBe(items);
      total += items;
    }
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it("K726-API-007 失敗：出どころが knowledge なのに出どころのページの id が空の行・指す先のページが無い行は、落ちずに source_page が null で返る（ほかの鍵は前のまま）", async () => {
    await h.ready();
    const s = await quiet();
    const ids: string[] = [];
    for (const ref of [null, randomUUID()])
      ids.push(
        (
          await h.admin.query<{ id: string }>(
            "insert into test_specs (tenant_id, ticket_id, title, source, source_ref_id, created_by) values ($1, $2, '出どころが無い行', 'knowledge', $3, $4) returning id",
            [s.w.co.tenantId, s.ticket, ref, s.w.mem1.id],
          )
        ).rows[0]!.id,
      );
    for (const id of ids) {
      const r = await itemAs(s.w.mem1, id);
      expect(r["source_page"], id).toBeNull();
      expect(r).toMatchObject({ id, title: "出どころが無い行", source: "knowledge", checked: false });
      expect(Object.keys(r).sort()).toEqual(KEYS_7);
    }
  });
});
