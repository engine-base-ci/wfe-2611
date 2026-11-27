// K-689「グループを選んで共有：共有の置き場（DB）・頼む（ページ・フォルダ）・共有をやめる・見える関数に共有を足す（getKnowledgeShares・setKnowledgeShares）」の単体の試験（口・DB の関数・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K689-API-NNN・K689-DB-NNN（チケット 11_tickets/K-689.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md と K-687 の md（表 knowledge_requests の列）・K-689 の md（表 knowledge_shares の列）。
//   土台は knowledge.harness.ts（K-675）と knowledge.requests-kit.ts（K-687）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
//   共有の頼みを承認する口は K-688 の物（K689-API-013 だけ、承認の口を呼んで「承認すると見える」までのつなぎ目を見る）。木の「共有」・帯・消せない守りは K-719 の試験が受ける。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { setupKnowledge, type Person } from "./knowledge.harness.js";
import {
  allAudits,
  allNotices,
  audits,
  breakWrites,
  makeWorld,
  notices,
  num,
  requestRows,
  seedRequest,
  type Json,
  type World,
} from "./knowledge.requests-kit.js";

const h = setupKnowledge();
const world = (label: string): Promise<World> => makeWorld(h, label);

const call = async (p: Person | null, method: string, path: string, body?: unknown): Promise<Response> => {
  await h.ready();
  return h.req(method, path, { ...(p ? { headers: h.as(p) } : {}), ...(body === undefined ? {} : { body }) });
};
const getShares = (p: Person | null, q: string) => call(p, "GET", `/knowledge/shares${q}`);
const setShares = (p: Person | null, body: unknown) => call(p, "PUT", "/knowledge/shares", body);
const codeOf = async (r: Response): Promise<string> => ((await r.json()) as Json)["code"] as string;
interface GroupRow {
  group_id: string;
  name: string;
  manager_name: string;
  checked: boolean;
  state: string | null;
}
const groupsOf = async (r: Response): Promise<GroupRow[]> => ((await h.json(r)).data as Json)["groups"] as GroupRow[];
const stateOf = (rows: GroupRow[], g: string): GroupRow | undefined => rows.find((x) => x.group_id === g);
const readPage = (p: Person, id: string): Promise<Response> => call(p, "GET", `/knowledge_pages/${id}`);

const grp = (
  scope: string,
  owner: Person,
  o: { title?: string; folder?: string | null; state?: "draft" | "published" } = {},
) => h.page({ scope, owner, title: o.title ?? "共有するページ", ...o });
const shareRows = async (w: World): Promise<Record<string, unknown>[]> =>
  (await h.admin.query("select * from knowledge_shares where tenant_id = $1 order by created_at, id", [w.co.tenantId]))
    .rows;
/** 生きている共有（承認済みの頼みつき）を行の守りの外で入れる */
const liveShare = async (
  w: World,
  o: { page?: string; folder?: string; from?: string; group: string; by: Person; decider: Person },
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
/** 経理グループとそのマネージャーを足す */
const addAccounting = async (w: World): Promise<{ g4: string; mgr4: Person }> => {
  const g4 = await h.group(w.co.tenantId, w.co.rootScope, "経理");
  const mgr4 = await h.person(w.co.tenantId, g4, { name: "経理マネージャー", role: "manager" });
  return { g4, mgr4 };
};

describe("K-689 グループを選んで共有", () => {
  it("K689-API-001 共有の選びを読む：元のグループのマネージャーに 200 { data: { target, from_group_name, groups } }（鍵はちょうど 3・target はちょうど 3 欄・groups の 1 行はちょうど 5 欄）", async () => {
    const w = await world("K689 読む");
    const p = await grp(w.g1, w.mgr1, { title: "見積もり" });
    const r = await getShares(w.mgr1, `?page_id=${p}`);
    expect(r.status).toBe(200);
    const d = (await h.json(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual(["from_group_name", "groups", "target"]);
    expect(d["target"]).toEqual({ page_id: p, folder_id: null, title: "見積もり" });
    expect(d["from_group_name"]).toBe("営業");
    for (const g of d["groups"] as Json[])
      expect(Object.keys(g).sort()).toEqual(["checked", "group_id", "manager_name", "name", "state"]);
    const folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const fr = await getShares(w.mgr1, `?folder_id=${folder}`);
    expect(fr.status).toBe(200);
    expect(((await h.json(fr)).data as Json)["target"]).toEqual({ page_id: null, folder_id: folder, title: "手順" });
  });

  it("K689-API-002 選べるグループと状態：自分のグループと会社のいちばん上を除く全グループが名前の順（コードポイント順）に並び、承認する人の名前（マネージャーがいなければ空の文字）が付く。共有中は shared・承認待ちは waiting（どちらも checked true）・断られて帯を消していない頼みは declined（checked false）・消した後は null", async () => {
    const w = await world("K689 状態");
    const { g4, mgr4 } = await addAccounting(w);
    const p = await grp(w.g1, w.mgr1);
    await liveShare(w, { page: p, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await seedRequest(h, w, { kind: "share", page: p, fromScope: w.g1, toScope: w.g3, by: w.mgr1 });
    const declined = await seedRequest(h, w, {
      kind: "share",
      page: p,
      fromScope: w.g1,
      toScope: g4,
      by: w.mgr1,
      state: "declined",
      decidedBy: mgr4,
      reason: "使いません",
    });
    const rows = await groupsOf(await getShares(w.mgr1, `?page_id=${p}`));
    expect(rows.map((x) => x.name)).toEqual(["企画", "受託開発", "経理"]);
    expect(rows.map((x) => x.manager_name)).toEqual(["", "開発マネージャー", "経理マネージャー"]);
    expect(rows.map((x) => [x.checked, x.state])).toEqual([
      [true, "waiting"],
      [true, "shared"],
      [false, "declined"],
    ]);
    expect(rows.map((x) => x.group_id)).not.toContain(w.g1);
    expect(rows.map((x) => x.group_id)).not.toContain(w.co.rootScope);
    await h.admin.query("update knowledge_requests set dismissed_at = now() where id = $1", [declined]);
    expect(stateOf(await groupsOf(await getShares(w.mgr1, `?page_id=${p}`)), g4)).toMatchObject({
      checked: false,
      state: null,
    });
  });

  it("K689-API-003 読む守り：ページかフォルダのどちらか 1 つを指さない（無い・両方）・見えない・無い・消した・別の会社は 404。見えるが共有を決められない人（メンバー・閲覧のみ・共有先のメンバー）は 403。共有を受けているグループのマネージャーは読める", async () => {
    const w = await world("K689 読む守り");
    const p = await grp(w.g1, w.mgr1);
    const folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    expect((await getShares(w.mgr1, "")).status).toBe(404);
    expect((await getShares(w.mgr1, `?page_id=${p}&folder_id=${folder}`)).status).toBe(404);
    expect((await getShares(w.mgr1, `?page_id=${randomUUID()}`)).status).toBe(404);
    for (const who of [w.mem1, w.view1]) expect((await getShares(who, `?page_id=${p}`)).status, who.id).toBe(403);
    for (const who of [w.mgr2, w.mem2, w.boss, w.none])
      expect((await getShares(who, `?page_id=${p}`)).status, who.id).toBe(404);
    const co2 = await h.company("K689 別の会社");
    const foreign = await h.person(co2.tenantId, co2.rootScope, { name: "別の会社の管理者", role: "admin" });
    expect((await getShares(foreign, `?page_id=${p}`)).status).toBe(404);
    const gone = await grp(w.g1, w.mgr1, { title: "消した" });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    expect((await getShares(w.mgr1, `?page_id=${gone}`)).status).toBe(404);
    await liveShare(w, { page: p, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    expect((await getShares(w.mgr2, `?page_id=${p}`)).status).toBe(200);
    expect((await getShares(w.mem2, `?page_id=${p}`)).status).toBe(403);
  });

  it("K689-API-004 共有を頼む（ページ）：200・選んだグループが waiting・頼みの行ができる（元は営業の棚・先は受託開発・頼んだ人・ひとこと）。相手のグループのマネージャーにだけ受け箱の行（payload はちょうど 4 欄・from_name は「営業（営業マネージャー）」）。共有の行はまだ無く、ページは変わらない", async () => {
    const w = await world("K689 頼む");
    const p = await grp(w.g1, w.mgr1, { title: "見積もり" });
    const before = await h.row(p);
    const r = await setShares(w.mgr1, { page_id: p, group_ids: [w.g2], message: "見てください" });
    expect(r.status).toBe(200);
    const rows = await groupsOf(r);
    expect(stateOf(rows, w.g2)).toMatchObject({
      name: "受託開発",
      manager_name: "開発マネージャー",
      checked: true,
      state: "waiting",
    });
    expect(stateOf(rows, w.g3)).toMatchObject({ checked: false, state: null });
    const reqs = await requestRows(h, w);
    expect(reqs.length).toBe(1);
    expect(reqs[0]).toMatchObject({
      kind: "share",
      page_id: p,
      folder_id: null,
      from_scope_id: w.g1,
      from_is_personal: false,
      to_scope_id: w.g2,
      requested_by: w.mgr1.id,
      state: "pending",
      message: "見てください",
    });
    expect((await shareRows(w)).length).toBe(0);
    const ns = await notices(h, w, "knowledge.share_requested");
    expect(ns.map((n) => n.member_id)).toEqual([w.mgr2.id]);
    expect(Object.keys(ns[0]!.payload).sort()).toEqual(["from_name", "page_id", "request_id", "title"]);
    expect(ns[0]!.payload).toMatchObject({
      title: "見積もり",
      page_id: p,
      request_id: reqs[0]!["id"],
      from_name: "営業（営業マネージャー）",
    });
    expect(ns[0]!.dedupe_key).toBe(`knowledge.share_requested:${reqs[0]!["id"]}`);
    expect(ns[0]!.channel_id).toBe("inapp");
    expect(await h.row(p)).toEqual(before);
  });

  it("K689-API-005 共有を頼む（フォルダ）：フォルダの共有の頼みは folder_id を持ち page_id は空。お知らせの題名はフォルダの名前で page_id は null", async () => {
    const w = await world("K689 フォルダを頼む");
    const folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const r = await setShares(w.mgr1, { folder_id: folder, group_ids: [w.g2] });
    expect(r.status).toBe(200);
    expect(((await h.json(r)).data as Json)["target"]).toEqual({ page_id: null, folder_id: folder, title: "手順" });
    const reqs = await requestRows(h, w);
    expect(reqs[0]).toMatchObject({
      kind: "share",
      page_id: null,
      folder_id: folder,
      to_scope_id: w.g2,
      state: "pending",
    });
    const ns = await notices(h, w, "knowledge.share_requested");
    expect(ns[0]!.payload).toMatchObject({ title: "手順", page_id: null });
  });

  it("K689-API-006 相手のグループのマネージャーでもあるとき：頼みを作らずその場で共有される（state shared・頼みは承認済みで決めた人が本人・共有の行ができる）。お知らせは出ず、共有先の人が読める。証跡は knowledge.share.apply", async () => {
    const w = await world("K689 すぐ共有");
    await h.admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, false, 'manager')",
      [w.co.tenantId, w.mgr1.id, w.g2],
    );
    const p = await grp(w.g1, w.mgr1);
    const r = await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] });
    expect(r.status).toBe(200);
    expect(stateOf(await groupsOf(r), w.g2)).toMatchObject({ checked: true, state: "shared" });
    const reqs = await requestRows(h, w);
    expect(reqs[0]).toMatchObject({ kind: "share", state: "approved", decided_by: w.mgr1.id });
    const shares = await shareRows(w);
    expect(shares.length).toBe(1);
    expect(shares[0]).toMatchObject({
      page_id: p,
      folder_id: null,
      group_id: w.g2,
      request_id: reqs[0]!["id"],
      shared_by: w.mgr1.id,
      ended_at: null,
    });
    expect(await allNotices(h, w)).toBe(0);
    expect((await readPage(w.mem2, p)).status).toBe(200);
    expect((await audits(h, w, "knowledge.share.apply")).length).toBe(1);
    expect((await audits(h, w, "knowledge.share.request")).length).toBe(0);
  });

  it("K689-API-007 共有をやめる（元のグループ側）：チェックを外して送ると共有が終わり（ended_at・ended_by）、承認なしですぐ共有先の人から見えなくなる。ほかのグループの共有は残る。相手のグループのマネージャーにだけお知らせ（from_name は元のグループの名前）。もう 1 度同じ送りは何も変えない", async () => {
    const w = await world("K689 やめる");
    const { g4, mgr4 } = await addAccounting(w);
    const p = await grp(w.g1, w.mgr1, { title: "やめるページ" });
    const s2 = await liveShare(w, { page: p, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await liveShare(w, { page: p, group: g4, by: w.mgr1, decider: mgr4 });
    expect((await readPage(w.mem2, p)).status).toBe(200);
    const r = await setShares(w.mgr1, { page_id: p, group_ids: [g4] });
    expect(r.status).toBe(200);
    const rows = await groupsOf(r);
    expect(stateOf(rows, w.g2)).toMatchObject({ checked: false, state: null });
    expect(stateOf(rows, g4)).toMatchObject({ checked: true, state: "shared" });
    const ended = (await shareRows(w)).find((x) => x["id"] === s2)!;
    expect(ended["ended_at"]).not.toBeNull();
    expect(ended["ended_by"]).toBe(w.mgr1.id);
    expect((await shareRows(w)).filter((x) => x["ended_at"] === null).length).toBe(1);
    expect((await readPage(w.mem2, p)).status).toBe(404);
    const ns = await notices(h, w, "knowledge.share_ended");
    expect(ns.map((n) => n.member_id)).toEqual([w.mgr2.id]);
    expect(ns[0]!.payload).toMatchObject({ title: "やめるページ", from_name: "営業" });
    expect(ns[0]!.dedupe_key).toBe(`knowledge.share_ended:${s2}`);
    const again = await setShares(w.mgr1, { page_id: p, group_ids: [g4] });
    expect(again.status).toBe(200);
    expect((await notices(h, w, "knowledge.share_ended")).length).toBe(1);
    expect((await audits(h, w, "knowledge.share.end")).length).toBe(1);
  });

  it("K689-API-008 承認待ちの共有を取り下げる：チェックを外して送ると頼みは取り下げ済みになり、相手のグループのマネージャーに出した「頼まれた」お知らせは消える（読んだ後でも）。共有の行は作られない", async () => {
    const w = await world("K689 取り下げ");
    const p = await grp(w.g1, w.mgr1);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
    await h.admin.query(
      "update notifications set read_at = now() where member_id = $1 and event_kind_id = 'knowledge.share_requested'",
      [w.mgr2.id],
    );
    const r = await setShares(w.mgr1, { page_id: p, group_ids: [] });
    expect(r.status).toBe(200);
    expect(stateOf(await groupsOf(r), w.g2)).toMatchObject({ checked: false, state: null });
    expect((await requestRows(h, w))[0]).toMatchObject({ state: "withdrawn" });
    expect((await notices(h, w, "knowledge.share_requested")).length).toBe(0);
    expect((await shareRows(w)).length).toBe(0);
    expect((await audits(h, w, "knowledge.share.withdraw")).length).toBe(1);
  });

  it("K689-API-009 共有を受けているグループ側からやめる：そのグループのマネージャーは自分のグループの分だけ外せて（元のグループのマネージャーにお知らせ・from_name は受けているグループの名前）、足す・ほかのグループの共有や頼みを外すは 403 で何も変わらない", async () => {
    const w = await world("K689 受け側");
    const { g4 } = await addAccounting(w);
    const p = await grp(w.g1, w.mgr1, { title: "受け側がやめる" });
    await liveShare(w, { page: p, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await seedRequest(h, w, { kind: "share", page: p, fromScope: w.g1, toScope: g4, by: w.mgr1 });
    for (const ids of [[w.g2, w.g3, g4], [w.g2], []]) {
      const r = await setShares(w.mgr2, { page_id: p, group_ids: ids });
      expect(r.status, JSON.stringify(ids.length)).toBe(403);
    }
    expect((await shareRows(w))[0]).toMatchObject({ ended_at: null });
    expect((await requestRows(h, w)).filter((x) => x["state"] === "pending").length).toBe(1);
    const r = await setShares(w.mgr2, { page_id: p, group_ids: [g4] });
    expect(r.status).toBe(200);
    expect((await shareRows(w))[0]!["ended_by"]).toBe(w.mgr2.id);
    expect((await readPage(w.mem2, p)).status).toBe(404);
    const ns = await notices(h, w, "knowledge.share_ended");
    expect(ns.map((n) => n.member_id).sort()).toEqual([w.mgr1.id, w.mgr1b.id].sort());
    expect(ns[0]!.payload).toMatchObject({ from_name: "受託開発" });
  });

  it("K689-API-010 頼む守り：メンバー・閲覧のみは 403・見えない人・無い id・消したページ・別の会社は 404。書き終えていないページは 409 E-KNW-010・会社の棚と自分の棚のページは 409 E-KNW-121・自分のグループは 409 E-KNW-120・上げる頼みが承認待ちなら 409 E-KNW-011・マネージャーのいないグループは 409 E-KNW-122・会社のいちばん上・無い・別の会社のグループは 404。どれも何も増えない", async () => {
    const w = await world("K689 頼む守り");
    const p = await grp(w.g1, w.mgr1);
    for (const who of [w.mem1, w.view1])
      expect((await setShares(who, { page_id: p, group_ids: [w.g2] })).status, who.id).toBe(403);
    for (const who of [w.mem2, w.mgr2, w.boss, w.none])
      expect((await setShares(who, { page_id: p, group_ids: [w.g2] })).status, who.id).toBe(404);
    expect((await setShares(w.mgr1, { page_id: randomUUID(), group_ids: [w.g2] })).status).toBe(404);
    const draft = await grp(w.g1, w.mgr1, { state: "draft", title: "書きかけ" });
    const r1 = await setShares(w.mgr1, { page_id: draft, group_ids: [w.g2] });
    expect(r1.status).toBe(409);
    expect(await codeOf(r1)).toBe("E-KNW-010");
    const company = await h.page({ scope: w.co.rootScope, owner: w.boss });
    const mine = await h.page({ scope: w.mem1.scopeId, owner: w.mem1, personal: true });
    expect(await codeOf(await setShares(w.boss, { page_id: company, group_ids: [w.g1] }))).toBe("E-KNW-121");
    expect(await codeOf(await setShares(w.mem1, { page_id: mine, group_ids: [w.g2] }))).toBe("E-KNW-121");
    expect(await codeOf(await setShares(w.mgr1, { page_id: p, group_ids: [w.g1] }))).toBe("E-KNW-120");
    expect(await codeOf(await setShares(w.mgr1, { page_id: p, group_ids: [w.g3] }))).toBe("E-KNW-122");
    const co2 = await h.company("K689 別の会社 2");
    const g9 = await h.group(co2.tenantId, co2.rootScope, "別の会社のグループ");
    for (const g of [w.co.rootScope, randomUUID(), g9])
      expect((await setShares(w.mgr1, { page_id: p, group_ids: [g] })).status, g).toBe(404);
    await seedRequest(h, w, { page: p, fromScope: w.g1, toScope: w.co.rootScope, by: w.mgr1 });
    expect(await codeOf(await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] }))).toBe("E-KNW-011");
    expect((await requestRows(h, w)).length).toBe(1);
    expect((await shareRows(w)).length).toBe(0);
    expect(await allNotices(h, w)).toBe(0);
  });

  it("K689-API-011 入力の形：page_id と folder_id のどちらも無い・両方・group_ids が無い・配列でない・uuid でない要素・51 個・ひとこと 1,001 字・NUL を含む文字・知らない欄は 422。同じグループの重なりは 1 つとして扱う", async () => {
    const w = await world("K689 入力");
    const p = await grp(w.g1, w.mgr1);
    const folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const bad: unknown[] = [
      { group_ids: [w.g2] },
      { page_id: p, folder_id: folder, group_ids: [w.g2] },
      { page_id: p },
      { page_id: p, group_ids: w.g2 },
      { page_id: p, group_ids: ["x"] },
      { page_id: p, group_ids: Array.from({ length: 51 }, () => randomUUID()) },
      { page_id: p, group_ids: [w.g2], message: "あ".repeat(1001) },
      { page_id: p, group_ids: [w.g2], message: "a\u0000b" },
      { page_id: p, group_ids: [w.g2], foo: 1 },
      { page_id: "x", group_ids: [w.g2] },
    ];
    for (const b of bad) {
      const r = await setShares(w.mgr1, b);
      expect(r.status, JSON.stringify(b).slice(0, 50)).toBe(422);
      expect(await codeOf(r)).toBe("VALIDATION_ERROR");
    }
    // 読む口の問い合わせの値の形も契約（QUERY_RANGES）：uuid でない page_id・folder_id は 422
    for (const q of ["?page_id=x", "?folder_id=x", `?page_id=${p}&folder_id=x`]) {
      const r = await getShares(w.mgr1, q);
      expect(r.status, q).toBe(422);
      expect(await codeOf(r)).toBe("VALIDATION_ERROR");
    }
    expect((await requestRows(h, w)).length).toBe(0);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2, w.g2] })).status).toBe(200);
    expect((await requestRows(h, w)).length).toBe(1);
  });

  it("K689-API-012 同じ送りは何も変えず、断られた後は新しく頼める：同じ選びをもう 1 度送っても頼み・お知らせ・証跡は増えない。断られた頼みがあっても同じグループへもう 1 度頼めて新しい承認待ちが 1 つできる", async () => {
    const w = await world("K689 同じ送り");
    const p = await grp(w.g1, w.mgr1);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
    const n1 = await allNotices(h, w);
    const a1 = await allAudits(h, w);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
    expect((await requestRows(h, w)).length).toBe(1);
    expect(await allNotices(h, w)).toBe(n1);
    expect(await allAudits(h, w)).toBe(a1);
    const q = await grp(w.g1, w.mgr1, { title: "断られた後" });
    await seedRequest(h, w, {
      kind: "share",
      page: q,
      fromScope: w.g1,
      toScope: w.g2,
      by: w.mgr1,
      state: "declined",
      decidedBy: w.mgr2,
      reason: "使いません",
    });
    const r = await setShares(w.mgr1, { page_id: q, group_ids: [w.g2] });
    expect(r.status).toBe(200);
    expect(stateOf(await groupsOf(r), w.g2)).toMatchObject({ checked: true, state: "waiting" });
    expect((await requestRows(h, w)).filter((x) => x["page_id"] === q).length).toBe(2);
  });

  it("K689-API-013 承認すると見える（読むだけ）：頼みを相手のマネージャーが承認する口（K-688）を押すと共有の行ができ、相手のグループの人はページを読める・直せない（403）。相手のグループでない人・管理者・どこにも入っていない人は読めない（404）", async () => {
    const w = await world("K689 承認で見える");
    const p = await grp(w.g1, w.mgr1, { title: "共有される" });
    expect((await readPage(w.mem2, p)).status).toBe(404);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
    expect((await readPage(w.mem2, p)).status).toBe(404);
    const rid = (await requestRows(h, w))[0]!["id"] as string;
    const ok = await call(w.mgr2, "POST", `/knowledge/requests/${rid}/approve`, {});
    expect(ok.status).toBe(200);
    expect(((await h.json(ok)).data as Json)["kind"]).toBe("share");
    const shares = await shareRows(w);
    expect(shares.length).toBe(1);
    expect(shares[0]).toMatchObject({
      page_id: p,
      group_id: w.g2,
      request_id: rid,
      shared_by: w.mgr1.id,
      ended_at: null,
    });
    for (const who of [w.mem2, w.mgr2]) expect((await readPage(who, p)).status, who.id).toBe(200);
    expect((await call(w.mem2, "PATCH", `/knowledge_pages/${p}/draft`, { title: "直す" })).status).toBe(403);
    for (const who of [w.mem3, w.boss, w.none]) expect((await readPage(who, p)).status, who.id).toBe(404);
    expect((await notices(h, w, "knowledge.share_approved", { member: w.mgr1 })).length).toBe(1);
  });

  it("K689-API-014 フォルダの共有は中の物が全部見える：入れ子のフォルダ・後から足したページ・動かして入れたページも見え、動かして出したページ・消したページ・共有をやめた後は見えない。共有していない物は見えない", async () => {
    const w = await world("K689 フォルダの見え方");
    const f1 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有する" });
    const f2 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "中", parent: f1 });
    const a = await grp(w.g1, w.mgr1, { title: "A", folder: f2 });
    const outside = await grp(w.g1, w.mgr1, { title: "外の物" });
    const sid = await liveShare(w, { folder: f1, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    expect((await readPage(w.mem2, a)).status).toBe(200);
    const later = await grp(w.g1, w.mgr1, { title: "後から足す", folder: f2 });
    expect((await readPage(w.mem2, later)).status).toBe(200);
    expect((await readPage(w.mem2, outside)).status).toBe(404);
    expect((await call(w.mgr1, "PATCH", `/knowledge_pages/${a}`, { folder_id: null })).status).toBe(200);
    expect((await readPage(w.mem2, a)).status).toBe(404);
    expect((await call(w.mgr1, "PATCH", `/knowledge_pages/${a}`, { folder_id: f2 })).status).toBe(200);
    expect((await readPage(w.mem2, a)).status).toBe(200);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [later]);
    expect((await readPage(w.mem2, later)).status).toBe(404);
    await h.admin.query("update knowledge_shares set ended_at = now() where id = $1", [sid]);
    expect((await readPage(w.mem2, a)).status).toBe(404);
  });

  it("K689-API-015 同時に頼む：2 人のマネージャーが同じグループへ同時に頼んでも頼みの行は 1 つ・お知らせは相手のマネージャー 1 人に 1 つ（どちらも 200）", async () => {
    const w = await world("K689 同時");
    const p = await grp(w.g1, w.mgr1);
    await h.ready();
    const rs = await Promise.all([
      setShares(w.mgr1, { page_id: p, group_ids: [w.g2] }),
      setShares(w.mgr1b, { page_id: p, group_ids: [w.g2] }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    expect((await requestRows(h, w)).length).toBe(1);
    expect((await notices(h, w, "knowledge.share_requested", { member: w.mgr2 })).length).toBe(1);
  });

  it("K689-API-016 証跡：頼む＝knowledge.share.request・取り下げ＝knowledge.share.withdraw（対象は頼み）・すぐ共有＝knowledge.share.apply・やめる＝knowledge.share.end（対象は共有）が 1 グループ 1 行ずつ（操作した人・関門 C2・payload は空）。断った操作・何も変えない送りには残らず、題名を入れない", async () => {
    const w = await world("K689 証跡");
    const { g4 } = await addAccounting(w);
    const p = await grp(w.g1, w.mgr1, { title: "秘密の題名" });
    await setShares(w.mem1, { page_id: p, group_ids: [w.g2] });
    await setShares(w.mgr1, { page_id: p, group_ids: [w.g1] });
    expect(await allAudits(h, w)).toBe(0);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2, g4] })).status).toBe(200);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
    const req = await audits(h, w, "knowledge.share.request");
    expect(req.length).toBe(2);
    expect(req[0]).toMatchObject({
      actor_member_id: w.mgr1.id,
      target_type: "knowledge_requests",
      choke_point_id: "C2",
    });
    const wd = await audits(h, w, "knowledge.share.withdraw");
    expect(wd.length).toBe(1);
    expect(wd[0]).toMatchObject({ target_type: "knowledge_requests" });
    const sid = await liveShare(w, { page: p, group: w.g3, by: w.mgr1, decider: w.mgr1 });
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
    const end = await audits(h, w, "knowledge.share.end");
    expect(end.length).toBe(1);
    expect(end[0]).toMatchObject({ target_type: "knowledge_shares", target_id: sid });
    for (const row of [...req, ...wd, ...end]) {
      expect(JSON.stringify(row.payload ?? {})).toBe("{}");
      expect(JSON.stringify(row)).not.toContain("秘密");
    }
  });

  it("K689-API-017 失敗（手順 1）：頼み・共有の行を書く所で DB が落ちると 503 E-PAGE-003・頼みも共有もお知らせも残らず（やめる途中なら共有は生きたまま）、ログに題名を出さない", async () => {
    const w = await world("K689 失敗 1");
    const p = await grp(w.g1, w.mgr1, { title: "秘密の題名" });
    await h.ready();
    const fix = await breakWrites(h, "knowledge_requests", w.co.tenantId);
    let logs: string;
    try {
      logs = await h.captureLogs(async () => {
        const r = await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] });
        expect(r.status).toBe(503);
        expect(await codeOf(r)).toBe("E-PAGE-003");
      });
    } finally {
      await fix();
    }
    expect((await requestRows(h, w)).length).toBe(0);
    expect(await allNotices(h, w)).toBe(0);
    expect(logs).not.toContain("秘密の");
    const q = await grp(w.g1, w.mgr1, { title: "やめる途中" });
    await liveShare(w, { page: q, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    const fix2 = await breakWrites(h, "knowledge_shares", w.co.tenantId);
    try {
      expect((await setShares(w.mgr1, { page_id: q, group_ids: [] })).status).toBe(503);
    } finally {
      await fix2();
    }
    expect((await shareRows(w))[0]).toMatchObject({ ended_at: null });
    expect((await readPage(w.mem2, q)).status).toBe(200);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
  });

  it("K689-API-018 失敗（手順 2）：お知らせを書く所で DB が落ちると 503 E-PAGE-003・同じ取引なので頼みも戻る。そのあとの頼みは通る", async () => {
    const w = await world("K689 失敗 2");
    const p = await grp(w.g1, w.mgr1, { title: "お知らせで落ちる" });
    await h.ready();
    const fix = await breakWrites(h, "notifications", w.co.tenantId);
    try {
      expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(503);
    } finally {
      await fix();
    }
    expect((await requestRows(h, w)).length).toBe(0);
    expect(await allNotices(h, w)).toBe(0);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
  });

  it("K689-API-019 失敗（手順 3）：証跡を書く所で DB が落ちると 503 E-PAGE-003・頼みもお知らせも戻る。そのあとの頼みは通る", async () => {
    const w = await world("K689 失敗 3");
    const p = await grp(w.g1, w.mgr1, { title: "証跡で落ちる" });
    await h.ready();
    const fix = await breakWrites(h, "audit_events", w.co.tenantId);
    try {
      expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(503);
    } finally {
      await fix();
    }
    expect((await requestRows(h, w)).length).toBe(0);
    expect(await allNotices(h, w)).toBe(0);
    expect(await allAudits(h, w)).toBe(0);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
  });

  it("K689-API-020 ログインしていない：2 つの口とも 401", async () => {
    expect((await getShares(null, `?page_id=${randomUUID()}`)).status).toBe(401);
    expect((await setShares(null, { page_id: randomUUID(), group_ids: [] })).status).toBe(401);
  });

  it("K689-API-021 上限を超えると 429（1 分 60 回の上限を 2 に差し替えた setKnowledgeShares の 3 回目）", async () => {
    const w = await world("K689 呼べる回数");
    const p = await grp(w.g1, w.mgr1);
    h.limits["setKnowledgeShares"] = 2;
    try {
      expect((await setShares(w.mgr1, { page_id: p, group_ids: [] })).status).toBe(200);
      expect((await setShares(w.mgr1, { page_id: p, group_ids: [] })).status).toBe(200);
      const r = await setShares(w.mgr1, { page_id: p, group_ids: [] });
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["setKnowledgeShares"];
    }
  });

  it("K689-API-022 権限の波及：マネージャーの役を外された人は次の送りから 403・共有先のマネージャーの役を外された人は読むも送るも 403・マネージャーにされた共有先のメンバーはすぐ共有をやめられる。入り直しは要らない", async () => {
    const w = await world("K689 波及");
    const p = await grp(w.g1, w.mgr1);
    await liveShare(w, { page: p, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2] })).status).toBe(200);
    await h.admin.query("update scope_memberships set role = 'member' where member_id = $1 and scope_id = $2", [
      w.mgr1.id,
      w.g1,
    ]);
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [] })).status).toBe(403);
    await h.admin.query("update scope_memberships set role = 'member' where member_id = $1 and scope_id = $2", [
      w.mgr2.id,
      w.g2,
    ]);
    expect((await getShares(w.mgr2, `?page_id=${p}`)).status).toBe(403);
    expect((await setShares(w.mgr2, { page_id: p, group_ids: [] })).status).toBe(403);
    await h.admin.query("update scope_memberships set role = 'manager' where member_id = $1 and scope_id = $2", [
      w.mem2.id,
      w.g2,
    ]);
    expect((await setShares(w.mem2, { page_id: p, group_ids: [] })).status).toBe(200);
    expect((await shareRows(w))[0]!["ended_by"]).toBe(w.mem2.id);
  });

  it("K689-API-023 お知らせの宛先：頼んだとき＝相手のグループのマネージャーだけ（元のグループの人・ほかのグループ・管理者・頼んだ人には出ない）・やめたとき＝やめた人の反対側のグループのマネージャーだけ（やめた本人を除く）。受け箱の行（inapp）だけで、チケットの承認の行は増えない", async () => {
    const w = await world("K689 宛先");
    const { g4, mgr4 } = await addAccounting(w);
    const p = await grp(w.g1, w.mgr1, { title: "宛先" });
    expect((await setShares(w.mgr1, { page_id: p, group_ids: [w.g2, g4] })).status).toBe(200);
    const req = await notices(h, w, "knowledge.share_requested");
    expect(req.map((n) => n.member_id).sort()).toEqual([w.mgr2.id, mgr4.id].sort());
    const all = (
      await h.admin.query(
        "select member_id, channel_id from notifications where tenant_id = $1 and event_kind_id like 'knowledge.%'",
        [w.co.tenantId],
      )
    ).rows as { member_id: string; channel_id: string }[];
    expect(all.every((x) => x.channel_id === "inapp")).toBe(true);
    for (const who of [w.mgr1, w.mgr1b, w.mem1, w.mem2, w.boss, w.none])
      expect(
        all.map((x) => x.member_id),
        who.id,
      ).not.toContain(who.id);
    expect(await num(h, "select count(*) as n from approvals where tenant_id = $1", [w.co.tenantId])).toBe(0);
  });

  it("K689-DB-001 共有の表：ページかフォルダのどちらか 1 つだけ（両方・無しは check で断る）・同じ（物・グループ）の生きている共有は 1 つだけ（やめた後は入れ直せる）。アプリの役は insert・update・delete が権限で断られる。読めるのは元を書ける人と共有先のマネージャー（共有先のメンバーには行は見えない）", async () => {
    const w = await world("K689 表");
    const p = await grp(w.g1, w.mgr1);
    const folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    const ins = (page: string | null, fol: string | null, g: string) =>
      h.admin.query(
        "insert into knowledge_shares (tenant_id, page_id, folder_id, group_id, shared_by) values ($1, $2, $3, $4, $5)",
        [w.co.tenantId, page, fol, g, w.mgr1.id],
      );
    await expect(ins(null, null, w.g2)).rejects.toMatchObject({ code: "23514" });
    await expect(ins(p, folder, w.g2)).rejects.toMatchObject({ code: "23514" });
    await ins(p, null, w.g2);
    await expect(ins(p, null, w.g2)).rejects.toMatchObject({ code: "23505" });
    await ins(p, null, w.g3);
    await h.admin.query("update knowledge_shares set ended_at = now() where page_id = $1 and group_id = $2", [p, w.g2]);
    await ins(p, null, w.g2);
    const as = (who: Person, sql: string, params: unknown[] = []) =>
      withTenant(h.pool, who.ctx, async (cl) => (await cl.query(sql, params)).rows);
    const q = "select id from knowledge_shares where page_id = $1";
    expect((await as(w.mgr1, q, [p])).length).toBe(3);
    expect((await as(w.mgr2, q, [p])).length).toBe(2);
    for (const who of [w.mem2, w.mem1, w.mem3, w.boss, w.none]) expect((await as(who, q, [p])).length, who.id).toBe(0);
    await expect(as(w.mgr1, "delete from knowledge_shares")).rejects.toMatchObject({ code: "42501" });
    await expect(as(w.mgr1, "update knowledge_shares set ended_at = now()")).rejects.toMatchObject({ code: "42501" });
    await expect(
      as(w.mgr1, "insert into knowledge_shares (tenant_id, page_id, group_id, shared_by) values ($1, $2, $3, $4)", [
        w.co.tenantId,
        p,
        w.g3,
        w.mgr1.id,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("K689-DB-002 見える関数 kn_shared_visible・kn_shared_folder_visible：共有先のグループの人にだけ true（ページ自身・上のフォルダの共有）。共有をやめた後・書き終えていないページ・消した物・共有先でない人は false。ページの行の守り（kpage_visible）もそれに従う", async () => {
    const w = await world("K689 見える関数");
    const f1 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "共有する" });
    const f2 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "中", parent: f1 });
    const f3 = await h.folder({ scope: w.g1, owner: w.mgr1, name: "さらに中", parent: f2 });
    const inFolder = await grp(w.g1, w.mgr1, { title: "深い所", folder: f3 });
    const alone = await grp(w.g1, w.mgr1, { title: "単独の共有" });
    const plain = await grp(w.g1, w.mgr1, { title: "共有していない" });
    const draft = await grp(w.g1, w.mgr1, { title: "書きかけ", folder: f2, state: "draft" });
    const s1 = await liveShare(w, { folder: f1, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    await liveShare(w, { page: alone, group: w.g2, by: w.mgr1, decider: w.mgr2 });
    const as = async (who: Person, sql: string, params: unknown[]) =>
      withTenant(h.pool, who.ctx, async (cl) => ((await cl.query(sql, params)).rows[0] as { v: boolean }).v);
    const page = (who: Person, id: string) => as(who, "select app.kn_shared_visible($1) as v", [id]);
    const folder = (who: Person, id: string) => as(who, "select app.kn_shared_folder_visible($1) as v", [id]);
    for (const id of [inFolder, alone]) expect(await page(w.mem2, id), id).toBe(true);
    for (const id of [plain, draft]) expect(await page(w.mem2, id), id).toBe(false);
    for (const id of [f1, f2, f3]) expect(await folder(w.mem2, id), id).toBe(true);
    expect(await page(w.mem3, inFolder)).toBe(false);
    expect(await folder(w.mem3, f1)).toBe(false);
    expect(await as(w.mem2, "select app.kpage_visible($1) as v", [inFolder])).toBe(true);
    expect(await as(w.mem2, "select app.kpage_visible($1) as v", [draft])).toBe(false);
    await h.admin.query("update knowledge_shares set ended_at = now() where id = $1", [s1]);
    expect(await page(w.mem2, inFolder)).toBe(false);
    expect(await folder(w.mem2, f3)).toBe(false);
    expect(await page(w.mem2, alone)).toBe(true);
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [alone]);
    expect(await page(w.mem2, alone)).toBe(false);
  });

  it("K689-DB-003 関数 kn_share_set：元を書ける人は ok（requested・shared・ended・withdrawn の数が付く）・見えない not_found・書けず共有先のマネージャーでもない denied・書き終えていない draft・承認待ちの上げる頼みがある pending・グループの棚でない not_group_shelf・元のグループを選んだ own_group・見えないグループ no_group・マネージャーのいないグループ no_approver。断ったとき何も書かない", async () => {
    const w = await world("K689 共有関数");
    const run = (who: Person, page: string, groups: string[]) =>
      withTenant(
        h.pool,
        who.ctx,
        async (cl) =>
          (
            (await cl.query("select app.kn_share_set($1, null, $2::uuid[], null) as r", [page, groups])).rows[0] as {
              r: Json;
            }
          ).r,
      );
    const p = await grp(w.g1, w.mgr1);
    expect(await run(w.mgr1, p, [w.g2])).toMatchObject({ ok: true, requested: 1, shared: 0, ended: 0, withdrawn: 0 });
    expect(await run(w.mgr1, p, [w.g2])).toMatchObject({ ok: true, requested: 0, shared: 0, ended: 0, withdrawn: 0 });
    expect(await run(w.mgr1, p, [])).toMatchObject({ ok: true, withdrawn: 1 });
    expect(await run(w.mem1, p, [w.g2])).toMatchObject({ ok: false, reason: "denied" });
    expect(await run(w.mgr2, p, [w.g2])).toMatchObject({ ok: false, reason: "not_found" });
    expect(await run(w.mgr1, await grp(w.g1, w.mgr1, { state: "draft" }), [w.g2])).toMatchObject({
      ok: false,
      reason: "draft",
    });
    expect(await run(w.boss, await h.page({ scope: w.co.rootScope, owner: w.boss }), [w.g1])).toMatchObject({
      ok: false,
      reason: "not_group_shelf",
    });
    expect(await run(w.mgr1, p, [w.g1])).toMatchObject({ ok: false, reason: "own_group" });
    expect(await run(w.mgr1, p, [randomUUID()])).toMatchObject({ ok: false, reason: "no_group" });
    expect(await run(w.mgr1, p, [w.g3])).toMatchObject({ ok: false, reason: "no_approver" });
    const q = await grp(w.g1, w.mgr1);
    await seedRequest(h, w, { page: q, fromScope: w.g1, toScope: w.co.rootScope, by: w.mgr1 });
    expect(await run(w.mgr1, q, [w.g2])).toMatchObject({ ok: false, reason: "pending" });
    expect((await requestRows(h, w)).filter((x) => x["state"] === "pending").length).toBe(1);
  });
});
