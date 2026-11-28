// K-719「共有の見え方と守り：木の「共有」・共有された側の帯・「共有」の操作・共有していると消せない・上げられない」の単体の試験（木の口・ページを読む口・フォルダとページを消す口・上げる口・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K719-API-NNN（チケット 11_tickets/K-719.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md と K-689 の md（表 knowledge_shares の列）。
//   土台は knowledge.harness.ts（K-675）と knowledge.requests-kit.ts（K-687）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
//   共有の行は行の守りの外で入れる（頼む・やめる口は K-689 の試験が受ける）。この葉の口は無く、小さいファイルの差し替えが効くことを、前の葉の口（木・ページ・フォルダ・上げる）を通して見る。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { withTenant } from "@kaname/db/context";
import { describe, expect, it } from "vitest";
import { setupKnowledge, type Person } from "./knowledge.harness.js";
import { findNode, makeWorld, seedRequest, type Json, type World } from "./knowledge.requests-kit.js";

const h = setupKnowledge();
const world = (label: string): Promise<World> => makeWorld(h, label);

const call = async (p: Person, method: string, path: string, body?: unknown): Promise<Response> => {
  await h.ready();
  return h.req(method, path, { headers: h.as(p), ...(body === undefined ? {} : { body }) });
};
const readTree = async (p: Person): Promise<Json> => {
  const r = await call(p, "GET", "/knowledge/tree");
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Json;
};
const readPage = async (p: Person, id: string): Promise<Response> => call(p, "GET", `/knowledge_pages/${id}`);
const pageData = async (p: Person, id: string): Promise<Json> => {
  const r = await readPage(p, id);
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Json;
};
const codeOf = async (r: Response): Promise<string> => ((await r.json()) as Json)["code"] as string;
const grp = (
  scope: string,
  owner: Person,
  o: { title?: string; folder?: string | null; state?: "draft" | "published"; must?: boolean; position?: number } = {},
) => h.page({ scope, owner, title: o.title ?? "ページ", ...o });
/** 共有された物だけのグループ（shared: true）。無ければ undefined */
const sharedGroup = (tree: Json, group: string): Json | undefined =>
  ((tree["groups"] as Json[]) ?? []).find((g) => g["id"] === group && g["shared"] === true);
const liveShare = async (
  w: World,
  o: { page?: string; folder?: string; group: string; by: Person; decider: Person; from?: string },
): Promise<string> => {
  const rid = await seedRequest(h, w, {
    kind: "share",
    page: o.page ?? null,
    folder: o.folder ?? null,
    fromScope: o.from ?? w.g1,
    toScope: o.group,
    by: o.by,
    state: "approved",
    decidedBy: o.decider,
  });
  const r = await h.admin.query<{ id: string }>(
    "insert into knowledge_shares (tenant_id, page_id, folder_id, group_id, request_id, shared_by) values ($1, $2, $3, $4, $5, $6) returning id",
    [w.co.tenantId, o.page ?? null, o.folder ?? null, o.group, rid, o.by.id],
  );
  return r.rows[0]!.id;
};
const names = (nodes: unknown): string[] =>
  ((nodes as Json[]) ?? []).map((n) => String(n["kind"] === "folder" ? n["name"] : n["title"]));

describe("K-719 共有の見え方と守り", () => {
  it("K719-API-001 木に共有された物だけのグループが出る：共有先のグループの人の木に、元のグループ（営業）が shared true・id は元のグループの uuid・色は元のグループの色（営業は teal）で出て、共有された物だけを持つ。自分のグループの棚は別に出る。共有先でない人・管理者・どこにも入っていない人には出ない", async () => {
    const w = await world("K719 木 1");
    const shared = await grp(w.g1, w.mgr1, { title: "共有したページ" });
    await grp(w.g1, w.mgr1, { title: "共有していないページ" });
    const mine = await grp(w.g2, w.mgr2, { title: "受託開発のページ" });
    await liveShare(w, { page: shared, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    for (const who of [w.mem2, w.mgr2]) {
      const tree = await readTree(who);
      const g = sharedGroup(tree, w.g1)!;
      expect(g, who.id).toBeTruthy();
      expect(g).toMatchObject({ id: w.g1, name: "営業", code: null, tone: "teal", shared: true });
      expect(names(g["nodes"]), who.id).toEqual(["共有したページ"]);
      const own = (tree["groups"] as Json[]).find((x) => x["id"] === w.g2)!;
      expect(own).toMatchObject({ shared: false });
      expect(names(own["nodes"])).toEqual(["受託開発のページ"]);
      expect(findNode(tree, mine)).toBeTruthy();
    }
    for (const who of [w.mem3, w.boss, w.none, w.mem1])
      expect(sharedGroup(await readTree(who), w.g1), who.id).toBeUndefined();
  });

  it("K719-API-002 フォルダの共有は中の物が全部木に出る：共有したフォルダが共有のグループの直下に出て、入れ子のフォルダ・中のページ・後から足したページが続く。フォルダの外で個別に共有したページはグループの直下に出る。共有していない物は出ない", async () => {
    const w = await world("K719 木 2");
    const f1 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有する" });
    const f2 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "中", parent: f1 });
    const other = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有しない" });
    const a = await grp(w.g1, w.mgr1, { title: "A", folder: f2 });
    const lone = await grp(w.g1, w.mgr1, { title: "単独で共有", folder: other });
    await grp(w.g1, w.mgr1, { title: "共有しない物", folder: other });
    await liveShare(w, { folder: f1, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await liveShare(w, { page: lone, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    const later = await grp(w.g1, w.mgr1, { title: "後から足す", folder: f2 });
    // 共有したフォルダの中の下書きのページ・消したページ・消したフォルダ（とその中のページ）は共有先の木に出ない
    const draft = await grp(w.g1, w.mgr1, { title: "書きかけ", folder: f2, state: "draft" });
    const gonePage = await grp(w.g1, w.mgr1, { title: "消したページ", folder: f2 });
    const goneFolder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "消したフォルダ", parent: f1 });
    await grp(w.g1, w.mgr1, { title: "消したフォルダの中", folder: goneFolder });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gonePage]);
    await h.admin.query("update knowledge_folders set deleted_at = now() where id = $1", [goneFolder]);
    const g = sharedGroup(await readTree(w.mem2), w.g1)!;
    expect(names(g["nodes"])).toEqual(["共有する", "単独で共有"]);
    const top = (g["nodes"] as Json[])[0]!;
    expect(top).toMatchObject({ kind: "folder", id: f1 });
    expect(names(top["children"])).toEqual(["中"]);
    const mid = (top["children"] as Json[])[0]!;
    expect(names(mid["children"])).toEqual(["A", "後から足す"]);
    expect(findNode({ groups: [g] }, a)).toBeTruthy();
    expect(findNode({ groups: [g] }, later)).toBeTruthy();
    for (const hidden of [draft, gonePage]) expect(findNode({ groups: [g] }, hidden), hidden).toBeFalsy();
    expect(names(top["children"])).not.toContain("消したフォルダ");
    // 下書きを公開した瞬間に共有先の木に出る
    await h.admin.query("update knowledge_pages set state = 'published', current_version = 1 where id = $1", [draft]);
    await h.admin.query(
      "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) select tenant_id, id, 1, 'published', $2::jsonb, owner_member_id, now(), owner_member_id from knowledge_pages where id = $1",
      [draft, JSON.stringify({ doc: { type: "doc", content: [] }, text: "" })],
    );
    expect(findNode({ groups: [sharedGroup(await readTree(w.mem2), w.g1)!] }, draft)).toBeTruthy();
  });

  it("K719-API-003 共有をやめる・承認待ち・断り・消した物は木に出ない：生きている共有だけが出る。やめるとすぐ木から消える（承認待ちの共有の頼み・断られた頼みは共有された物にならない）。共有されたページを消した後も出ない", async () => {
    const w = await world("K719 木 3");
    const a = await grp(w.g1, w.mgr1, { title: "共有中" });
    const b = await grp(w.g1, w.mgr1, { title: "承認待ち" });
    const c = await grp(w.g1, w.mgr1, { title: "断られた" });
    const d = await grp(w.g1, w.mgr1, { title: "消す" });
    const sa = await liveShare(w, { page: a, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await seedRequest(h, w, { kind: "share", page: b, fromScope: w.g1, toScope: w.g2, by: w.mgr1 });
    await seedRequest(h, w, {
      kind: "share",
      page: c,
      fromScope: w.g1,
      toScope: w.g2,
      by: w.mgr1,
      state: "declined",
      decidedBy: w.mgr2,
      reason: "使いません",
    });
    await liveShare(w, { page: d, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    expect(names(sharedGroup(await readTree(w.mem2), w.g1)!["nodes"])).toEqual(["共有中", "消す"]);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [d]);
    expect(names(sharedGroup(await readTree(w.mem2), w.g1)!["nodes"])).toEqual(["共有中"]);
    await h.admin.query("update knowledge_shares set ended_at = now() where id = $1", [sa]);
    expect(sharedGroup(await readTree(w.mem2), w.g1)).toBeUndefined();
    expect((await readPage(w.mem2, a)).status).toBe(404);
  });

  it("K719-API-004 両方のグループに入っている人：共有元のグループにも入っている人は、そのグループを自分の棚として全部見る（shared false）。共有された物だけのグループは別に出さない", async () => {
    const w = await world("K719 両方");
    const p = await grp(w.g1, w.mgr1, { title: "共有したページ" });
    await grp(w.g1, w.mgr1, { title: "共有していないページ" });
    await liveShare(w, { page: p, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await h.admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, false, 'member')",
      [w.co.tenantId, w.mem2.id, w.g1],
    );
    const tree = await readTree(w.mem2);
    expect(sharedGroup(tree, w.g1)).toBeUndefined();
    const own = (tree["groups"] as Json[]).find((x) => x["id"] === w.g1)!;
    expect(own).toMatchObject({ shared: false });
    expect(names(own["nodes"])).toEqual(["共有したページ", "共有していないページ"]);
    expect((tree["groups"] as Json[]).filter((x) => x["id"] === w.g1).length).toBe(1);
  });

  it("K719-API-005 共有された側のページの帯：共有先の人がページを読むと shared_from が { group_name 営業, manager_names（営業のマネージャーの名前順）, writable false }・acts に「必ず守る」「上げる」「共有」「直す」は入らない。フォルダの共有の中のページも同じ。共有元の人・会社のページには shared_from が無い。共有をやめた後は 404", async () => {
    const w = await world("K719 帯");
    const f1 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有する" });
    const direct = await grp(w.g1, w.mgr1, { title: "個別に共有" });
    const inFolder = await grp(w.g1, w.mgr1, { title: "フォルダの中", folder: f1 });
    const sid = await liveShare(w, { page: direct, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await liveShare(w, { folder: f1, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    for (const id of [direct, inFolder]) {
      for (const who of [w.mem2, w.mgr2]) {
        const d = await pageData(who, id);
        expect(d["shared_from"], `${who.id} ${id}`).toEqual({
          group_name: "営業",
          manager_names: ["営業のもう 1 人のマネージャー", "営業マネージャー"],
          writable: false,
        });
        for (const act of ["must-on", "must-off", "raise", "share", "edit"]) expect(d["acts"], act).not.toContain(act);
      }
      expect((await pageData(w.mgr1, id))["shared_from"]).toBeNull();
      expect((await pageData(w.mem1, id))["shared_from"]).toBeNull();
    }
    const company = await h.page({ scope: w.co.rootScope, owner: w.boss, title: "会社のページ" });
    expect((await pageData(w.mem2, company))["shared_from"]).toBeNull();
    await h.admin.query("update knowledge_shares set ended_at = now() where id = $1", [sid]);
    expect((await readPage(w.mem2, direct)).status).toBe(404);
  });

  it("K719-API-006 「共有」の操作：元のグループのマネージャーが公開済みのグループのページを読むと acts に share が入る。メンバー・閲覧のみ・共有先の人・会社のページ・自分のページ・書き終えていないページ・上げる頼みが承認待ちのページには入らない", async () => {
    const w = await world("K719 共有の操作");
    const p = await grp(w.g1, w.mgr1, { title: "共有できる" });
    expect((await pageData(w.mgr1, p))["acts"]).toContain("share");
    expect((await pageData(w.mgr1b, p))["acts"]).toContain("share");
    for (const who of [w.mem1, w.view1]) expect((await pageData(who, p))["acts"], who.id).not.toContain("share");
    await liveShare(w, { page: p, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    for (const who of [w.mem2, w.mgr2]) expect((await pageData(who, p))["acts"], who.id).not.toContain("share");
    const company = await h.page({ scope: w.co.rootScope, owner: w.boss });
    const mine = await h.page({ scope: w.mgr1.scopeId, owner: w.mgr1, personal: true });
    const draft = await grp(w.g1, w.mgr1, { state: "draft", title: "書きかけ" });
    expect((await pageData(w.boss, company))["acts"]).not.toContain("share");
    expect((await pageData(w.mgr1, mine))["acts"]).not.toContain("share");
    expect((await pageData(w.mgr1, draft))["acts"]).not.toContain("share");
    const pending = await grp(w.g1, w.mgr1, { title: "上げる頼み" });
    await seedRequest(h, w, { page: pending, fromScope: w.g1, toScope: w.co.rootScope, by: w.mgr1 });
    expect((await pageData(w.mgr1, pending))["acts"]).not.toContain("share");
    // 共有の頼み（kind share）が承認待ちのページには、ほかのグループを足せるので share が入る
    const sharing = await grp(w.g1, w.mgr1, { title: "共有の頼み" });
    await seedRequest(h, w, { kind: "share", page: sharing, fromScope: w.g1, toScope: w.g2, by: w.mgr1 });
    expect((await pageData(w.mgr1, sharing))["acts"]).toContain("share");
  });

  it("K719-API-007 共有しているフォルダは消せない：生きている共有があるフォルダを消すと 409 E-KNW-051・共有の頼みが承認待ちのフォルダも 409 E-KNW-051。共有をやめた・頼みを取り下げた後は消せる。共有している上のフォルダの中の空のフォルダは消せる（上の共有は見ない）", async () => {
    const w = await world("K719 フォルダを消す");
    const live = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有中" });
    const waiting = await h.folder({ scope: w.g1, owner: w.mgr1, name: "承認待ち" });
    const parent = await h.folder({ scope: w.g1, owner: w.mgr1, name: "親" });
    const child = await h.folder({ scope: w.g1, owner: w.mgr1, name: "子", parent });
    const sid = await liveShare(w, { folder: live, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    const rid = await seedRequest(h, w, { kind: "share", folder: waiting, fromScope: w.g1, toScope: w.g2, by: w.mgr1 });
    await liveShare(w, { folder: parent, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    for (const f of [live, waiting]) {
      const r = await call(w.mgr1, "DELETE", `/knowledge/folders/${f}`);
      expect(r.status, f).toBe(409);
      expect(await codeOf(r), f).toBe("E-KNW-051");
    }
    expect((await call(w.mgr1, "DELETE", `/knowledge/folders/${child}`)).status).toBe(200);
    await h.admin.query("update knowledge_shares set ended_at = now() where id = $1", [sid]);
    await h.admin.query("update knowledge_requests set state = 'withdrawn' where id = $1", [rid]);
    for (const f of [live, waiting])
      expect((await call(w.mgr1, "DELETE", `/knowledge/folders/${f}`)).status, f).toBe(200);
  });

  it("K719-API-008 共有しているページは消せない：ページ自身の共有・上のフォルダの共有があると 409 E-KNW-051。順は 承認待ちの頼み E-KNW-011 → 必ず守る E-KNW-050 → 共有 E-KNW-051。共有をやめた後は消せる", async () => {
    const w = await world("K719 ページを消す");
    const f1 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有する" });
    const direct = await grp(w.g1, w.mgr1, { title: "個別" });
    const inFolder = await grp(w.g1, w.mgr1, { title: "フォルダの中", folder: f1 });
    const sid = await liveShare(w, { page: direct, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await liveShare(w, { folder: f1, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    for (const id of [direct, inFolder]) {
      const r = await call(w.mgr1, "DELETE", `/knowledge_pages/${id}`);
      expect(r.status, id).toBe(409);
      expect(await codeOf(r), id).toBe("E-KNW-051");
    }
    const must = await grp(w.g1, w.mgr1, { title: "必ず守る・共有", must: true });
    await liveShare(w, { page: must, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    expect(await codeOf(await call(w.mgr1, "DELETE", `/knowledge_pages/${must}`))).toBe("E-KNW-050");
    const waiting = await grp(w.g1, w.mgr1, { title: "共有の頼みが待ち" });
    await liveShare(w, { page: waiting, group: w.g3, by: w.mgr1, decider: w.mgr1 });
    await seedRequest(h, w, { kind: "share", page: waiting, fromScope: w.g1, toScope: w.g2, by: w.mgr1 });
    expect(await codeOf(await call(w.mgr1, "DELETE", `/knowledge_pages/${waiting}`))).toBe("E-KNW-011");
    await h.admin.query("update knowledge_shares set ended_at = now() where id = $1", [sid]);
    expect((await call(w.mgr1, "DELETE", `/knowledge_pages/${direct}`)).status).toBe(200);
    expect((await readPage(w.mem2, inFolder)).status).toBe(200);
  });

  it("K719-API-009 共有しているページは上げられない：ページ自身の共有・上のフォルダの共有があるグループのページを会社へ上げる頼みは 409 E-KNW-106。共有をやめた後は頼める（201）", async () => {
    const w = await world("K719 上げる");
    const f1 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有する" });
    const direct = await grp(w.g1, w.mgr1, { title: "個別" });
    const inFolder = await grp(w.g1, w.mgr1, { title: "フォルダの中", folder: f1 });
    const sid = await liveShare(w, { page: direct, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await liveShare(w, { folder: f1, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    for (const id of [direct, inFolder]) {
      const r = await call(w.mgr1, "POST", `/knowledge_pages/${id}/raise`, {});
      expect(r.status, id).toBe(409);
      expect(await codeOf(r), id).toBe("E-KNW-106");
    }
    expect(
      (
        await h.admin.query(
          "select count(*)::int as n from knowledge_requests where kind = 'raise' and tenant_id = $1",
          [w.co.tenantId],
        )
      ).rows[0],
    ).toEqual({ n: 0 });
    await h.admin.query("update knowledge_shares set ended_at = now() where id = $1", [sid]);
    expect((await call(w.mgr1, "POST", `/knowledge_pages/${direct}/raise`, {})).status).toBe(201);
  });

  it("K719-API-010 動かしても共有は付いて回る：共有しているページを同じ棚の別のフォルダへ動かしても共有先は読める。共有しているフォルダを別のフォルダの下へ動かしても中は見える。共有しているフォルダの外へ動かしたページは見えなくなる", async () => {
    const w = await world("K719 動かす");
    const direct = await grp(w.g1, w.mgr1, { title: "個別に共有" });
    const dest = await h.folder({ scope: w.g1, owner: w.mgr1, name: "移す先" });
    await liveShare(w, { page: direct, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    expect((await call(w.mgr1, "PATCH", `/knowledge_pages/${direct}`, { folder_id: dest })).status).toBe(200);
    expect((await readPage(w.mem2, direct)).status).toBe(200);
    const shared = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有するフォルダ" });
    const inside = await grp(w.g1, w.mgr1, { title: "中のページ", folder: shared });
    await liveShare(w, { folder: shared, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    expect((await call(w.mgr1, "PATCH", `/knowledge/folders/${shared}`, { parent_folder_id: dest })).status).toBe(200);
    expect((await readPage(w.mem2, inside)).status).toBe(200);
    expect((await call(w.mgr1, "PATCH", `/knowledge_pages/${inside}`, { folder_id: null })).status).toBe(200);
    expect((await readPage(w.mem2, inside)).status).toBe(404);
  });

  it("K719-API-012 5,001 行で止める：共有したフォルダの下に 5,001 行を超える物があると、関数は 5,001 行で止まり、木の口は 5,000 ノードで切って truncated を立てる", async () => {
    const w = await world("K719 上限");
    const big = await h.folder({ scope: w.g1, owner: w.mgr1, name: "多い" });
    await h.admin.query(
      "insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, title, summary, folder_id, position, current_version) select $1, $2, false, $3, 'published', 'P' || g, '', $4, g, 1 from generate_series(1, 5002) g",
      [w.co.tenantId, w.g1, w.mgr1.id, big],
    );
    await h.admin.query(
      "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) select tenant_id, id, 1, 'published', $2::jsonb, owner_member_id, now(), owner_member_id from knowledge_pages where folder_id = $1",
      [big, JSON.stringify({ doc: { type: "doc", content: [] }, text: "" })],
    );
    await liveShare(w, { folder: big, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await h.ready();
    const rows = await withTenant(h.pool, w.mem2.ctx, async (cl) =>
      Number((await cl.query<{ n: number }>("select count(*) as n from app.kn_shared_tree()")).rows[0]!.n),
    );
    expect(rows).toBe(5001);
    const tree = await readTree(w.mem2);
    expect(tree["truncated"]).toBe(true);
  }, 60_000);

  it("K719-API-011 共有先のグループから抜けた直後：共有された物だけのグループは木から消え、ページは読めなくなる。別のグループへ移った人にも同じ。入り直しは要らない", async () => {
    const w = await world("K719 波及");
    const p = await grp(w.g1, w.mgr1, { title: "共有したページ" });
    await liveShare(w, { page: p, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    expect(sharedGroup(await readTree(w.mem2), w.g1)).toBeTruthy();
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mem2.id, w.g2]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem2.id, w.g3]);
    await h.admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, 'member')",
      [w.co.tenantId, w.mem2.id, w.g3],
    );
    expect(sharedGroup(await readTree(w.mem2), w.g1)).toBeUndefined();
    expect((await readPage(w.mem2, p)).status).toBe(404);
    expect(sharedGroup(await readTree(w.mgr2), w.g1)).toBeTruthy();
  });
});
