// K-688「承認待ちを読む・承認する（上げる＝棚が移る）・断る（理由が要る）・頼んだ人へのお知らせ（listKnowledgeApprovals・approveKnowledgeRequest・declineKnowledgeRequest）」の単体の試験（口・DB の関数・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K688-API-NNN・K688-DB-NNN（チケット 11_tickets/K-688.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md と K-687 の md（表 knowledge_requests の列）。
//   土台は knowledge.harness.ts（K-675）と knowledge.requests-kit.ts（K-687）。口の振る舞いは試験の本体（it の中）の h.ready() で読む（answer=8f745003d023）。
//   頼みは行の守りの外で入れる（頼む口は K-687 の試験が受ける）。共有の頼みを承認して見えるようにする所は K-689 の試験が受ける（この試験は共有の頼みを「読む・断る」まで）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { bodyOf, setupKnowledge, type Person } from "./knowledge.harness.js";
import {
  allAudits,
  audits,
  breakWrites,
  findNode,
  makeWorld,
  notices,
  num,
  requestRow,
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
const list = (p: Person | null) => call(p, "GET", "/knowledge/approvals");
const approve = (p: Person | null, id: string) => call(p, "POST", `/knowledge/requests/${id}/approve`, {});
const decline = (p: Person | null, id: string, reason: unknown = "理由") =>
  call(p, "POST", `/knowledge/requests/${id}/decline`, { reason });
const items = async (p: Person): Promise<Json[]> => {
  const r = await list(p);
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Json[];
};
const readPage = async (p: Person, id: string): Promise<Json> => {
  const r = await call(p, "GET", `/knowledge_pages/${id}`);
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Json;
};
const readTree = async (p: Person): Promise<Json> => {
  const r = await call(p, "GET", "/knowledge/tree");
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Json;
};
const codeOf = async (r: Response): Promise<string> => ((await r.json()) as Json)["code"] as string;
const fieldsOf = async (r: Response): Promise<string[]> =>
  (((await r.json()) as Json)["details"] as { field: string }[] | undefined)?.map((x) => x.field) ?? [];

interface Seeded {
  page: string;
  id: string;
}
/** 自分の棚のページ → 本人の主のグループへの頼み（承認待ち） */
const personalReq = async (
  w: World,
  who: Person,
  o: {
    title?: string;
    summary?: string;
    text?: string;
    must?: boolean;
    position?: number;
    message?: string | null;
    toFolder?: string | null;
    state?: "pending" | "approved" | "declined" | "withdrawn";
    decidedBy?: Person;
    reason?: string;
  } = {},
): Promise<Seeded> => {
  const page = await h.page({
    scope: who.scopeId,
    owner: who,
    personal: true,
    title: o.title ?? "個人のページ",
    summary: o.summary ?? "",
    ...(o.text === undefined ? {} : { text: o.text }),
    ...(o.must === undefined ? {} : { must: o.must }),
    ...(o.position === undefined ? {} : { position: o.position }),
  });
  const id = await seedRequest(h, w, {
    page,
    fromScope: who.scopeId,
    fromPersonal: true,
    toScope: who.scopeId,
    toFolder: o.toFolder ?? null,
    by: who,
    message: o.message ?? null,
    ...(o.state ? { state: o.state } : {}),
    ...(o.decidedBy ? { decidedBy: o.decidedBy } : {}),
    ...(o.reason ? { reason: o.reason } : {}),
  });
  return { page, id };
};
/** グループの棚のページ → 会社への頼み（承認待ち） */
const companyReq = async (w: World, scope: string, who: Person, title = "グループのページ"): Promise<Seeded> => {
  const page = await h.page({ scope, owner: who, title });
  const id = await seedRequest(h, w, { page, fromScope: scope, toScope: w.co.rootScope, by: who });
  return { page, id };
};
const pageRow = (id: string) => h.row(id);
const kinds = (w: World, kind: string, member: Person) => notices(h, w, kind, { member });

describe("K-688 承認待ちを読む・承認する・断る", () => {
  it("K688-API-001 承認待ちを読む：承認するマネージャーに 200 { data: [...], meta: { count } }。1 件の鍵はちょうど 11（id・kind・from_name・from_shelf_name・to_shelf_name・title・desc・message・requested_at・similar・body）。自分のページは「<名前>さんの「自分」」・グループのページはグループの名前から来る", async () => {
    const w = await world("K688 読む");
    const a = await personalReq(w, w.mem1, {
      title: "値引きの返し方",
      summary: "返してよい範囲",
      text: "本文の全部",
      message: "お願いします",
    });
    const r = await list(w.mgr1);
    expect(r.status).toBe(200);
    const j = await h.json(r);
    expect((j["meta"] as Json)["count"]).toBe(1);
    const row = (j.data as Json[])[0]!;
    expect(Object.keys(row).sort()).toEqual([
      "body",
      "desc",
      "from_name",
      "from_shelf_name",
      "id",
      "kind",
      "message",
      "requested_at",
      "similar",
      "title",
      "to_shelf_name",
    ]);
    expect(row).toMatchObject({
      id: a.id,
      kind: "raise",
      from_name: "営業メンバー",
      from_shelf_name: "営業メンバーさんの「自分」",
      to_shelf_name: "営業",
      title: "値引きの返し方",
      desc: "返してよい範囲",
      message: "お願いします",
      similar: null,
    });
    expect(row["body"]).toEqual(bodyOf("本文の全部"));
    expect(new Date(row["requested_at"] as string).toISOString()).toBe(row["requested_at"]);
    const c = await companyReq(w, w.g2, w.mgr2, "納品の前の確かめ");
    const g = (await items(w.boss))[0]!;
    expect(g).toMatchObject({
      id: c.id,
      kind: "raise",
      from_name: "開発マネージャー",
      from_shelf_name: "受託開発",
      to_shelf_name: "会社",
      message: null,
    });
  });

  it("K688-API-002 誰に何が見えるか：グループあての頼みはそのグループのマネージャー全員・会社あての頼みは管理者全員。承認待ちだけ（断り・承認済み・取り下げ済みは出ない）。メンバー・閲覧のみ・どこにも入っていない人は 403。別の会社の管理者には何も出ない", async () => {
    const w = await world("K688 範囲");
    const a = await personalReq(w, w.mem1, { title: "営業あて" });
    const b = await personalReq(w, w.mem2, { title: "開発あて" });
    const c = await companyReq(w, w.g2, w.mgr2, "会社あて 1");
    const d = await companyReq(w, w.g1, w.mgr1, "会社あて 2");
    for (const state of ["declined", "approved", "withdrawn"] as const)
      await personalReq(w, w.mem1, { title: `決まった ${state}`, state, decidedBy: w.mgr1 });
    const ids = async (p: Person) => (await items(p)).map((x) => x["id"]);
    expect(await ids(w.mgr1)).toEqual([a.id]);
    expect(await ids(w.mgr1b)).toEqual([a.id]);
    expect(await ids(w.mgr2)).toEqual([b.id]);
    expect(await ids(w.boss)).toEqual([d.id, c.id]);
    expect(await ids(w.boss2)).toEqual([d.id, c.id]);
    for (const p of [w.mem1, w.view1, w.mem2, w.none]) expect((await list(p)).status, p.id).toBe(403);
    const co2 = await h.company("K688 別の会社");
    const foreign = await h.person(co2.tenantId, co2.rootScope, { name: "別の会社の管理者", role: "admin" });
    expect(await ids(foreign)).toEqual([]);
  });

  it("K688-API-003 並びと件数：新しい頼みが先・50 件で切る。共有の頼みはグループの名前つき（「受託開発（開発マネージャー）」・「営業にも見せる」）・フォルダの共有は題名がフォルダの名前で本文は null", async () => {
    const w = await world("K688 並び");
    const ids: string[] = [];
    for (let i = 1; i <= 51; i++) ids.push((await personalReq(w, w.mem1, { title: `頼み ${i}` })).id);
    const got = await items(w.mgr1);
    expect(got.length).toBe(50);
    expect(got.map((x) => x["id"])).toEqual(ids.slice(1).reverse());
    expect(((await h.json(await list(w.mgr1)))["meta"] as Json)["count"]).toBe(50);
    const w2 = await world("K688 共有の頼み");
    const sp = await h.page({ scope: w2.g2, owner: w2.mgr2, title: "納品の前の確かめ", summary: "確かめること" });
    const sid = await seedRequest(h, w2, {
      kind: "share",
      page: sp,
      fromScope: w2.g2,
      toScope: w2.g1,
      by: w2.mgr2,
      message: "見てほしい",
    });
    const folder = await h.folder({ scope: w2.g2, owner: w2.mgr2, name: "共有する手順" });
    const fid = await seedRequest(h, w2, { kind: "share", folder, fromScope: w2.g2, toScope: w2.g1, by: w2.mgr2 });
    const rows = await items(w2.mgr1);
    expect(rows.map((x) => x["id"])).toEqual([fid, sid]);
    expect(rows[1]).toMatchObject({
      kind: "share",
      from_name: "受託開発（開発マネージャー）",
      from_shelf_name: "受託開発",
      to_shelf_name: "営業にも見せる",
      title: "納品の前の確かめ",
      desc: "確かめること",
      message: "見てほしい",
    });
    expect(rows[1]!["body"]).toEqual(bodyOf("本文"));
    expect(rows[0]).toMatchObject({ kind: "share", title: "共有する手順", desc: "", body: null });
  });

  it("K688-API-004 似たページ：承認する人から見える棚に題名のよく似たページがあれば similar（page_id・title・place）。無ければ null。頼まれたページ自身・承認する人に見えない棚のページは出さない", async () => {
    const w = await world("K688 似たページ");
    const folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "経理" });
    const upper = await h.page({
      scope: w.g1,
      owner: w.mgr1,
      title: "経費の精算の決まり",
      summary: "経費の精算の流れと上限",
      folder,
    });
    const a = await personalReq(w, w.mem1, { title: "経費の精算の決まり", summary: "経費の精算の流れと上限" });
    await h.page({
      scope: w.mem2.scopeId,
      owner: w.mem2,
      personal: true,
      title: "経費の精算の決まり",
      summary: "経費の精算の流れと上限",
    });
    const b = await personalReq(w, w.mem1, { title: "全く別の話題 ZZZ", summary: "関係のない内容 QQQ" });
    const rows = await items(w.mgr1);
    const byId = (id: string) => rows.find((x) => x["id"] === id)!;
    expect(byId(a.id)["similar"]).toEqual({ page_id: upper, title: "経費の精算の決まり", place: "営業 › 経理" });
    expect(byId(b.id)["similar"]).toBeNull();
  });

  it("K688-API-005 承認する（自分 → グループ）：200 { id, kind, state approved, page_id, folder_id }。ページが営業の棚に移り（自分の棚の印が外れ・必ず守るは外れ・入れるフォルダの最後・持ち主と版はそのまま）、頼んだ人に承認のお知らせ。ほかの承認する人に出した頼まれたお知らせは消える。元の自分の棚には残らず、グループの人が読める", async () => {
    const w = await world("K688 承認 1");
    const folder = await h.folder({ scope: w.g1, owner: w.mgr1, name: "手順" });
    await h.page({ scope: w.g1, owner: w.mgr1, title: "先に居る", position: 30, folder });
    const a = await personalReq(w, w.mem1, { title: "移る", must: true, position: 3, toFolder: folder });
    await h.admin.query(
      "insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key) values ($1, $2, 'inapp', 'knowledge.raise_requested', '{}'::jsonb, $3)",
      [w.co.tenantId, w.mgr1b.id, `knowledge.raise_requested:${a.id}`],
    );
    const r = await approve(w.mgr1, a.id);
    expect(r.status).toBe(200);
    const d = (await h.json(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual(["folder_id", "id", "kind", "page_id", "state"]);
    expect(d).toEqual({ id: a.id, kind: "raise", state: "approved", page_id: a.page, folder_id: folder });
    expect(await pageRow(a.page)).toMatchObject({
      scope_id: w.g1,
      is_personal: false,
      is_must: false,
      folder_id: folder,
      position: 40,
      owner_member_id: w.mem1.id,
      current_version: 1,
      state: "published",
    });
    const req = await requestRow(h, a.id);
    expect(req).toMatchObject({ state: "approved", decided_by: w.mgr1.id });
    expect(req!["decided_at"]).not.toBeNull();
    const ns = await notices(h, w, "knowledge.raise_approved");
    expect(ns.map((n) => n.member_id)).toEqual([w.mem1.id]);
    expect(Object.keys(ns[0]!.payload).sort()).toEqual(["from_name", "page_id", "request_id", "title"]);
    expect(ns[0]!.payload).toMatchObject({
      title: "移る",
      page_id: a.page,
      request_id: a.id,
      from_name: "営業マネージャー",
    });
    expect(ns[0]!.dedupe_key).toBe(`knowledge.raise_approved:${a.id}`);
    expect((await notices(h, w, "knowledge.raise_requested")).length).toBe(0);
    expect(JSON.stringify((await readTree(w.mem1))["my_nodes"])).not.toContain(a.page);
    for (const p of [w.mem1, w.view1, w.mgr1b]) expect((await readPage(p, a.page))["id"], p.id).toBe(a.page);
  });

  it("K688-API-006 承認する（グループ → 会社）：管理者が承認するとページは会社の棚に移り、会社の人はだれでも読める（どのグループにも入っていない人も）。頼んだマネージャーに承認のお知らせ（from_name は管理者）", async () => {
    const w = await world("K688 承認 2");
    const c = await companyReq(w, w.g2, w.mgr2, "会社へ上げる");
    const r = await approve(w.boss, c.id);
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toMatchObject({ id: c.id, kind: "raise", state: "approved", page_id: c.page });
    expect(await pageRow(c.page)).toMatchObject({ scope_id: w.co.rootScope, is_personal: false, folder_id: null });
    for (const p of [w.mem2, w.none, w.mem1, w.mgr1]) expect((await readPage(p, c.page))["id"], p.id).toBe(c.page);
    const ns = await kinds(w, "knowledge.raise_approved", w.mgr2);
    expect(ns.length).toBe(1);
    expect(ns[0]!.payload).toMatchObject({ title: "会社へ上げる", from_name: "管理者" });
    expect(JSON.stringify((await readTree(w.mgr2))["groups"])).not.toContain(c.page);
  });

  it("K688-API-007 承認の時点の公開の版が移る：頼んだあとに書き終えた新しい版（版 2）が移り、書いている途中の下書きの版は捨てられる。公開の版は残る", async () => {
    const w = await world("K688 版");
    const a = await personalReq(w, w.mem1, { title: "版が進む", text: "最初の本文" });
    await h.admin.query(
      "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by) values ($1, $2, 2, 'published', $3::jsonb, $4, now(), $4)",
      [w.co.tenantId, a.page, JSON.stringify(bodyOf("二つ目の本文")), w.mem1.id],
    );
    await h.admin.query("update knowledge_pages set current_version = 2 where id = $1", [a.page]);
    await h.admin.query(
      "insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id) values ($1, $2, 3, 'draft', $3::jsonb, $4)",
      [w.co.tenantId, a.page, JSON.stringify(bodyOf("途中の下書き")), w.mem1.id],
    );
    expect((await approve(w.mgr1, a.id)).status).toBe(200);
    const read = await readPage(w.mgr1, a.page);
    expect((read["body"] as Json)["text"]).toBe("二つ目の本文");
    expect((read["foot"] as Json)["version"]).toBe(2);
    expect(read["draft"]).toBeNull();
    const vs = (
      await h.admin.query(
        "select kind, version, deleted_at from knowledge_page_versions where page_id = $1 order by version",
        [a.page],
      )
    ).rows as { kind: string; version: number; deleted_at: string | null }[];
    expect(vs.map((v) => [v.kind, v.version, v.deleted_at === null])).toEqual([
      ["published", 1, true],
      ["published", 2, true],
      ["draft", 3, false],
    ]);
  });

  it("K688-API-008 入れるフォルダ：頼んだときのフォルダが生きていればその最後に入り、消えていれば先の棚の直下（最後）に入る", async () => {
    const w = await world("K688 フォルダ");
    const alive = await h.folder({ scope: w.g1, owner: w.mgr1, name: "生きている" });
    const gone = await h.folder({ scope: w.g1, owner: w.mgr1, name: "消える" });
    await h.page({ scope: w.g1, owner: w.mgr1, title: "フォルダの中", position: 30, folder: alive });
    await h.page({ scope: w.g1, owner: w.mgr1, title: "直下", position: 50 });
    const a = await personalReq(w, w.mem1, { title: "生きた所へ", toFolder: alive });
    const b = await personalReq(w, w.mem1, { title: "消えた所から", toFolder: gone });
    await h.admin.query("update knowledge_folders set deleted_at = now() where id = $1", [gone]);
    expect((await approve(w.mgr1, a.id)).status).toBe(200);
    expect((await approve(w.mgr1, b.id)).status).toBe(200);
    expect(await pageRow(a.page)).toMatchObject({ folder_id: alive, position: 40 });
    expect(await pageRow(b.page)).toMatchObject({ folder_id: null, position: 60 });
  });

  it("K688-API-009 承認の守り：頼んだ人（承認する人でない）・頼みが見える人は 403、頼みが見えない人（ほかのグループ・管理者・どこにも入っていない人）・無い id は 404。ページも頼みも変わらない", async () => {
    const w = await world("K688 守り");
    const a = await personalReq(w, w.mem1, { title: "営業あて" });
    expect((await approve(w.mem1, a.id)).status).toBe(403);
    for (const p of [w.view1, w.mem2, w.mgr2, w.boss, w.none]) expect((await approve(p, a.id)).status, p.id).toBe(404);
    expect((await approve(w.mgr1, randomUUID())).status).toBe(404);
    const c = await companyReq(w, w.g2, w.mgr2, "会社あて");
    for (const p of [w.mem2, w.mgr2]) expect((await approve(p, c.id)).status, p.id).toBe(403);
    for (const p of [w.mgr1, w.view1]) expect((await approve(p, c.id)).status, p.id).toBe(404);
    expect(await requestRow(h, a.id)).toMatchObject({ state: "pending" });
    expect(await requestRow(h, c.id)).toMatchObject({ state: "pending" });
    expect(await pageRow(a.page)).toMatchObject({ is_personal: true });
    expect(await pageRow(c.page)).toMatchObject({ scope_id: w.g2 });
  });

  it("K688-API-010 もう決まっている頼み：承認・断り・取り下げ済みの頼みを承認する・断るは 409 E-KNW-110（2 度押しも 2 回目は 409）。ページは変わらない", async () => {
    const w = await world("K688 決まった");
    const a = await personalReq(w, w.mem1, { title: "2 度押し" });
    expect((await approve(w.mgr1, a.id)).status).toBe(200);
    const second = await approve(w.mgr1b, a.id);
    expect(second.status).toBe(409);
    expect(await codeOf(second)).toBe("E-KNW-110");
    for (const state of ["declined", "approved", "withdrawn"] as const) {
      const b = await personalReq(w, w.mem1, { title: `決まった ${state}`, state, decidedBy: w.mgr1, reason: "理由" });
      expect(await codeOf(await approve(w.mgr1, b.id)), `approve ${state}`).toBe("E-KNW-110");
      expect(await codeOf(await decline(w.mgr1, b.id)), `decline ${state}`).toBe("E-KNW-110");
      expect(await pageRow(b.page), state).toMatchObject({ is_personal: true });
    }
  });

  it("K688-API-011 頼んだ人がもうグループにいない：承認は 409 E-KNW-111（ページは動かず頼みは承認待ちのまま）。断るは通る", async () => {
    const w = await world("K688 抜けた");
    const a = await personalReq(w, w.mem1, { title: "抜ける前の頼み" });
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mem1.id, w.g1]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem1.id, w.co.rootScope]);
    const r = await approve(w.mgr1, a.id);
    expect(r.status).toBe(409);
    expect(await codeOf(r)).toBe("E-KNW-111");
    expect(await requestRow(h, a.id)).toMatchObject({ state: "pending" });
    expect(await pageRow(a.page)).toMatchObject({ is_personal: true });
    expect((await decline(w.mgr1, a.id, "抜けたので")).status).toBe(200);
  });

  it("K688-API-012 断る：200 { id, kind, state declined, page_id, folder_id }・理由（前後の空白は落とす）が残り・ページは動かない。頼んだ人に断りのお知らせ（理由つき）。ほかの承認する人の頼まれたお知らせは消え、頼んだ人のページに断られた帯と木の印が出て、もう 1 度頼める", async () => {
    const w = await world("K688 断る");
    const a = await personalReq(w, w.mem1, { title: "断られる" });
    await h.admin.query(
      "insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key) values ($1, $2, 'inapp', 'knowledge.raise_requested', '{}'::jsonb, $3)",
      [w.co.tenantId, w.mgr1b.id, `knowledge.raise_requested:${a.id}`],
    );
    const r = await decline(w.mgr1, a.id, "  既にあります  ");
    expect(r.status).toBe(200);
    const d = (await h.json(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual(["folder_id", "id", "kind", "page_id", "state"]);
    expect(d).toEqual({ id: a.id, kind: "raise", state: "declined", page_id: a.page, folder_id: null });
    expect(await requestRow(h, a.id)).toMatchObject({
      state: "declined",
      decline_reason: "既にあります",
      decided_by: w.mgr1.id,
    });
    expect(await pageRow(a.page)).toMatchObject({ scope_id: w.g1, is_personal: true });
    const ns = await kinds(w, "knowledge.raise_declined", w.mem1);
    expect(ns.length).toBe(1);
    expect(Object.keys(ns[0]!.payload).sort()).toEqual(["from_name", "page_id", "reason", "request_id", "title"]);
    expect(ns[0]!.payload).toMatchObject({ reason: "既にあります", from_name: "営業マネージャー", title: "断られる" });
    expect((await notices(h, w, "knowledge.raise_requested")).length).toBe(0);
    expect((await readPage(w.mem1, a.page))["request"]).toMatchObject({
      state: "declined",
      reason: "既にあります",
      can_withdraw: false,
    });
    expect(findNode(await readTree(w.mem1), a.page)).toMatchObject({ mark: "declined" });
    expect((await call(w.mem1, "POST", `/knowledge_pages/${a.page}/raise`, { group_id: w.g1 })).status).toBe(201);
  });

  it("K688-API-013 断る理由の形（承認は知らない欄つきも 422）：reason が無い・空・空白だけ・1,001 字・文字でない値・NUL を含む・知らない欄つきは 422 で、頼みは承認待ちのまま。1,000 字は通る", async () => {
    const w = await world("K688 理由");
    const a = await personalReq(w, w.mem1, { title: "理由の試験" });
    const bad: unknown[] = [
      {},
      { reason: "" },
      { reason: "   " },
      { reason: "あ".repeat(1001) },
      { reason: 5 },
      { reason: "a\u0000b" },
      { reason: "x", foo: 1 },
    ];
    for (const b of bad) {
      const r = await call(w.mgr1, "POST", `/knowledge/requests/${a.id}/decline`, b);
      expect(r.status, JSON.stringify(b).slice(0, 30)).toBe(422);
      expect(await codeOf(r)).toBe("VALIDATION_ERROR");
    }
    const r = await call(w.mgr1, "POST", `/knowledge/requests/${a.id}/decline`, {});
    expect(await fieldsOf(r)).toContain("reason");
    expect(await requestRow(h, a.id)).toMatchObject({ state: "pending" });
    const approveBad = await call(w.mgr1, "POST", `/knowledge/requests/${a.id}/approve`, { foo: 1 });
    expect(approveBad.status).toBe(422);
    expect(await codeOf(approveBad)).toBe("VALIDATION_ERROR");
    expect((await decline(w.mgr1, a.id, "あ".repeat(1000))).status).toBe(200);
    expect(((await requestRow(h, a.id))!["decline_reason"] as string).length).toBe(1000);
  });

  it("K688-API-014 断る守り：頼んだ人は 403・頼みが見えない人・無い id は 404（承認と同じ）。決まった頼みは 409 E-KNW-110。何も変わらない", async () => {
    const w = await world("K688 断る守り");
    const a = await personalReq(w, w.mem1, { title: "守り" });
    expect((await decline(w.mem1, a.id)).status).toBe(403);
    for (const p of [w.view1, w.mem2, w.mgr2, w.boss, w.none]) expect((await decline(p, a.id)).status, p.id).toBe(404);
    expect((await decline(w.mgr1, randomUUID())).status).toBe(404);
    const c = await companyReq(w, w.g2, w.mgr2, "会社あて");
    expect((await decline(w.mem2, c.id)).status).toBe(403);
    expect((await decline(w.view1, c.id)).status).toBe(404);
    expect(await requestRow(h, a.id)).toMatchObject({ state: "pending", decline_reason: null });
    expect((await decline(w.boss, c.id)).status).toBe(200);
    expect(await codeOf(await decline(w.boss2, c.id))).toBe("E-KNW-110");
  });

  it("K688-API-015 同時に決める：同じ頼みを 2 人のマネージャーが同時に承認すると 1 つが 200・もう 1 つが 409 E-KNW-110・ページは 1 度だけ移りお知らせも 1 つ。承認と断る・承認と取り下げが同時でも勝つのは 1 つだけ", async () => {
    const w = await world("K688 同時");
    const a = await personalReq(w, w.mem1, { title: "同時に承認" });
    await h.ready();
    const rs = await Promise.all([approve(w.mgr1, a.id), approve(w.mgr1b, a.id)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await codeOf(rs.find((r) => r.status === 409)!)).toBe("E-KNW-110");
    expect((await notices(h, w, "knowledge.raise_approved")).length).toBe(1);
    const b = await personalReq(w, w.mem1, { title: "承認と断る" });
    const bs = await Promise.all([approve(w.mgr1, b.id), decline(w.mgr1b, b.id)]);
    expect(bs.map((r) => r.status).sort()).toEqual([200, 409]);
    const row = await requestRow(h, b.id);
    expect(["approved", "declined"]).toContain(row!["state"]);
    expect((await pageRow(b.page))!["is_personal"]).toBe(row!["state"] === "declined");
    expect(
      (await notices(h, w, "knowledge.raise_approved", { member: w.mem1 })).length +
        (await notices(h, w, "knowledge.raise_declined", { member: w.mem1 })).length,
    ).toBe(2);
    const c = await personalReq(w, w.mem1, { title: "承認と取り下げ" });
    const cs = await Promise.all([approve(w.mgr1, c.id), call(w.mem1, "DELETE", `/knowledge/requests/${c.id}`)]);
    expect(cs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(["approved", "withdrawn"]).toContain((await requestRow(h, c.id))!["state"]);
  });

  it("K688-API-016 木の数：承認する人の admin_counts.approvals は自分が承認できる承認待ちの数（営業のマネージャー 2・開発のマネージャー 1・管理者 1）。決めると減る。メンバーは admin_counts が null。左の「承認待ち」（approvals の表）には何も増えない", async () => {
    const w = await world("K688 数");
    const a1 = await personalReq(w, w.mem1, { title: "営業 1" });
    await personalReq(w, w.mem1, { title: "営業 2" });
    await personalReq(w, w.mem2, { title: "開発 1" });
    await companyReq(w, w.g2, w.mgr2, "会社 1");
    const count = async (p: Person) => ((await readTree(p))["admin_counts"] as Json | null)?.["approvals"];
    expect(await count(w.mgr1)).toBe(2);
    expect(await count(w.mgr1b)).toBe(2);
    expect(await count(w.mgr2)).toBe(1);
    expect(await count(w.boss)).toBe(1);
    expect((await readTree(w.mem1))["admin_counts"]).toBeNull();
    expect((await readTree(w.none))["admin_counts"]).toBeNull();
    expect((await approve(w.mgr1, a1.id)).status).toBe(200);
    expect(await count(w.mgr1)).toBe(1);
    expect(await num(h, "select count(*) as n from approvals where tenant_id = $1", [w.co.tenantId])).toBe(0);
  });

  it("K688-API-017 権限の波及：マネージャーの役を外された人は次の読むが 403・承認が 404。マネージャーにされた閲覧のみの人は次の読むに出て承認できる。入り直しは要らない", async () => {
    const w = await world("K688 波及");
    const a = await personalReq(w, w.mem1, { title: "波及" });
    const b = await personalReq(w, w.mem1, { title: "波及 2" });
    expect((await items(w.mgr1)).length).toBe(2);
    await h.admin.query("update scope_memberships set role = 'member' where member_id = $1 and scope_id = $2", [
      w.mgr1.id,
      w.g1,
    ]);
    expect((await list(w.mgr1)).status).toBe(403);
    expect((await approve(w.mgr1, a.id)).status).toBe(404);
    expect((await list(w.view1)).status).toBe(403);
    await h.admin.query("update scope_memberships set role = 'manager' where member_id = $1 and scope_id = $2", [
      w.view1.id,
      w.g1,
    ]);
    expect((await items(w.view1)).length).toBe(2);
    expect((await approve(w.view1, b.id)).status).toBe(200);
  });

  it("K688-API-018 共有の頼みも断れる：承認する人（相手のグループのマネージャー）が断ると 200（kind share）・頼んだ人に knowledge.share_declined のお知らせ（理由・決めた人の名前つき）。頼んだ人にだけ届く", async () => {
    const w = await world("K688 共有を断る");
    const page = await h.page({ scope: w.g2, owner: w.mgr2, title: "共有したいページ" });
    const id = await seedRequest(h, w, { kind: "share", page, fromScope: w.g2, toScope: w.g1, by: w.mgr2 });
    const r = await decline(w.mgr1, id, "営業では使いません");
    expect(r.status).toBe(200);
    expect((await h.json(r)).data).toEqual({ id, kind: "share", state: "declined", page_id: page, folder_id: null });
    const ns = await notices(h, w, "knowledge.share_declined");
    expect(ns.map((n) => n.member_id)).toEqual([w.mgr2.id]);
    expect(ns[0]!.payload).toMatchObject({
      title: "共有したいページ",
      reason: "営業では使いません",
      from_name: "営業マネージャー",
      request_id: id,
    });
    expect(ns[0]!.dedupe_key).toBe(`knowledge.share_declined:${id}`);
    expect(await requestRow(h, id)).toMatchObject({ state: "declined" });
  });

  it("K688-API-019 証跡：承認＝knowledge.request.approve・断る＝knowledge.request.decline が 1 行ずつ（操作した人・対象は頼み・種類 knowledge_requests・関門 C2・payload は空）。403・404・409・422 には残らず、題名・理由を入れない", async () => {
    const w = await world("K688 証跡");
    const a = await personalReq(w, w.mem1, { title: "秘密の題名" });
    const b = await personalReq(w, w.mem1, { title: "別の頼み" });
    await approve(w.mem1, a.id);
    await approve(w.mgr2, a.id);
    await decline(w.mgr1, a.id, "");
    await approve(w.mgr1, randomUUID());
    expect(await allAudits(h, w)).toBe(0);
    expect((await approve(w.mgr1, a.id)).status).toBe(200);
    await approve(w.mgr1b, a.id);
    expect((await decline(w.mgr1, b.id, "秘密の理由")).status).toBe(200);
    for (const [action, rid, who] of [
      ["knowledge.request.approve", a.id, w.mgr1],
      ["knowledge.request.decline", b.id, w.mgr1],
    ] as const) {
      const rows = await audits(h, w, action);
      expect(rows.length, action).toBe(1);
      expect(rows[0], action).toMatchObject({
        actor_member_id: who.id,
        target_type: "knowledge_requests",
        target_id: rid,
        choke_point_id: "C2",
      });
      expect(JSON.stringify(rows[0]!.payload ?? {}), action).toBe("{}");
      expect(JSON.stringify(rows[0]), action).not.toContain("秘密");
    }
  });

  it("K688-API-020 失敗（手順 1）：ページを移す所で DB が落ちると 503 E-PAGE-003・ページは動かず頼みは承認待ちのまま・お知らせも出ず（頼まれたお知らせも残る）、ログに題名を出さない。そのあとの承認は通る", async () => {
    const w = await world("K688 失敗 1");
    const a = await personalReq(w, w.mem1, { title: "秘密の題名" });
    await h.admin.query(
      "insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key) values ($1, $2, 'inapp', 'knowledge.raise_requested', '{}'::jsonb, $3)",
      [w.co.tenantId, w.mgr1b.id, `knowledge.raise_requested:${a.id}`],
    );
    await h.ready();
    const fix = await breakWrites(h, "knowledge_pages", w.co.tenantId);
    let logs: string;
    try {
      logs = await h.captureLogs(async () => {
        const r = await approve(w.mgr1, a.id);
        expect(r.status).toBe(503);
        expect(await codeOf(r)).toBe("E-PAGE-003");
      });
    } finally {
      await fix();
    }
    expect(await pageRow(a.page)).toMatchObject({ is_personal: true });
    expect(await requestRow(h, a.id)).toMatchObject({ state: "pending" });
    expect((await notices(h, w, "knowledge.raise_approved")).length).toBe(0);
    expect((await notices(h, w, "knowledge.raise_requested")).length).toBe(1);
    expect(logs).not.toContain("秘密の");
    expect((await approve(w.mgr1, a.id)).status).toBe(200);
  });

  it("K688-API-021 失敗（手順 2）：頼みの行を直す所で DB が落ちると 503 E-PAGE-003・同じ取引なのでページも動かない", async () => {
    const w = await world("K688 失敗 2");
    const a = await personalReq(w, w.mem1, { title: "頼みで落ちる" });
    await h.ready();
    const fix = await breakWrites(h, "knowledge_requests", w.co.tenantId);
    try {
      expect((await approve(w.mgr1, a.id)).status).toBe(503);
    } finally {
      await fix();
    }
    expect(await pageRow(a.page)).toMatchObject({ is_personal: true });
    expect(await requestRow(h, a.id)).toMatchObject({ state: "pending" });
    expect((await approve(w.mgr1, a.id)).status).toBe(200);
  });

  it("K688-API-022 失敗（手順 3）：お知らせを書く所で DB が落ちると 503 E-PAGE-003・ページも頼みも戻る（承認も断るも）。そのあとの承認・断るは通る", async () => {
    const w = await world("K688 失敗 3");
    const a = await personalReq(w, w.mem1, { title: "承認で落ちる" });
    const b = await personalReq(w, w.mem1, { title: "断るで落ちる" });
    await h.ready();
    const fix = await breakWrites(h, "notifications", w.co.tenantId);
    try {
      expect((await approve(w.mgr1, a.id)).status).toBe(503);
      expect((await decline(w.mgr1, b.id)).status).toBe(503);
    } finally {
      await fix();
    }
    expect(await pageRow(a.page)).toMatchObject({ is_personal: true });
    expect(await requestRow(h, a.id)).toMatchObject({ state: "pending" });
    expect(await requestRow(h, b.id)).toMatchObject({ state: "pending", decline_reason: null });
    expect((await approve(w.mgr1, a.id)).status).toBe(200);
    expect((await decline(w.mgr1, b.id)).status).toBe(200);
  });

  it("K688-API-023 失敗（手順 4）：証跡を書く所で DB が落ちると 503 E-PAGE-003・ページも頼みもお知らせも戻る。そのあとの承認は通る", async () => {
    const w = await world("K688 失敗 4");
    const a = await personalReq(w, w.mem1, { title: "証跡で落ちる" });
    await h.ready();
    const fix = await breakWrites(h, "audit_events", w.co.tenantId);
    try {
      expect((await approve(w.mgr1, a.id)).status).toBe(503);
    } finally {
      await fix();
    }
    expect(await pageRow(a.page)).toMatchObject({ is_personal: true });
    expect(await requestRow(h, a.id)).toMatchObject({ state: "pending" });
    expect((await notices(h, w, "knowledge.raise_approved")).length).toBe(0);
    expect(await allAudits(h, w)).toBe(0);
    expect((await approve(w.mgr1, a.id)).status).toBe(200);
  });

  it("K688-API-024 ログインしていない：3 つの口とも 401", async () => {
    const id = randomUUID();
    expect((await list(null)).status).toBe(401);
    expect((await approve(null, id)).status).toBe(401);
    expect((await decline(null, id)).status).toBe(401);
  });

  it("K688-API-025 上限を超えると 429（1 分 60 回の上限を 2 に差し替えた approveKnowledgeRequest の 3 回目）", async () => {
    const w = await world("K688 呼べる回数");
    const [a, b, c] = [await personalReq(w, w.mem1), await personalReq(w, w.mem1), await personalReq(w, w.mem1)];
    h.limits["approveKnowledgeRequest"] = 2;
    try {
      expect((await approve(w.mgr1, a.id)).status).toBe(200);
      expect((await approve(w.mgr1, b.id)).status).toBe(200);
      const r = await approve(w.mgr1, c.id);
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["approveKnowledgeRequest"];
    }
  });

  it("K688-API-026 一覧の問い合わせの値の形：limit が 0・51・数でない字は 422（欄 limit・契約の limit_max 50）。50 までは通る", async () => {
    const w = await world("K688 一覧の問い合わせ");
    for (const bad of ["0", "51", "abc"]) {
      const r = await call(w.mgr1, "GET", `/knowledge/approvals?limit=${bad}`);
      expect(r.status, bad).toBe(422);
      expect(await fieldsOf(r), bad).toContain("limit");
    }
    expect((await call(w.mgr1, "GET", "/knowledge/approvals?limit=50")).status).toBe(200);
  });

  it("K688-DB-001 関数 kn_approval_rows・kn_can_approve：承認できる人（管理者・どれかのグループのマネージャー）だけ true。行は承認待ちだけで、自分が承認できる先の物。鍵は土台どおり（頼んだ人・棚の名前・題名・説明・ひとこと・本文・ページとフォルダの id）。ページが見えない人にも本文が渡る", async () => {
    const w = await world("K688 一覧の関数");
    const a = await personalReq(w, w.mem1, { title: "営業あて", summary: "説明", text: "本文", message: "ひとこと" });
    await companyReq(w, w.g2, w.mgr2, "会社あて");
    const as = <T>(p: Person, sql: string, params: unknown[] = []): Promise<T[]> =>
      withTenant(h.pool, p.ctx, async (cl) => (await cl.query(sql, params)).rows as T[]);
    for (const [p, ok] of [
      [w.boss, true],
      [w.mgr1, true],
      [w.mgr2, true],
      [w.mem1, false],
      [w.view1, false],
      [w.none, false],
    ] as [Person, boolean][])
      expect((await as<{ ok: boolean }>(p, "select app.kn_can_approve() as ok"))[0]!.ok, p.id).toBe(ok);
    const rows = await as<Json>(w.mgr1, "select * from app.kn_approval_rows()");
    expect(rows.length).toBe(1);
    expect(Object.keys(rows[0]!).sort()).toEqual(
      [
        "body",
        "folder_id",
        "from_name",
        "from_shelf_name",
        "id",
        "kind",
        "message",
        "page_id",
        "requested_at",
        "summary",
        "title",
        "to_shelf_name",
      ].sort(),
    );
    expect(rows[0]).toMatchObject({
      id: a.id,
      kind: "raise",
      title: "営業あて",
      summary: "説明",
      message: "ひとこと",
      page_id: a.page,
    });
    expect(rows[0]!["body"]).toEqual(bodyOf("本文"));
    expect((await as(w.mem1, "select * from app.kn_approval_rows()")).length).toBe(0);
    expect((await as(w.boss, "select * from app.kn_approval_rows()")).length).toBe(1);
  });

  it("K688-DB-002 関数 kn_request_decide：承認する人の承認・断るは ok（changed true）・頼みが見えない not_found・見えるが承認する人でない forbidden・決まっている decided・頼んだ人がグループにいない requester_gone・断る理由が空 reason_required。ok のとき頼みの状態・決めた人・時刻が付く", async () => {
    const w = await world("K688 決める関数");
    const run = (p: Person, id: string, action: string, reason: string | null) =>
      withTenant(
        h.pool,
        p.ctx,
        async (cl) =>
          (
            (await cl.query("select app.kn_request_decide($1, $2, $3) as r", [id, action, reason])).rows[0] as {
              r: Json;
            }
          ).r,
      );
    const a = await personalReq(w, w.mem1, { title: "関数 1" });
    expect(await run(w.view1, a.id, "approve", null)).toMatchObject({ ok: false, reason: "not_found" });
    expect(await run(w.mem1, a.id, "approve", null)).toMatchObject({ ok: false, reason: "forbidden" });
    expect(await run(w.mgr1, a.id, "decline", "")).toMatchObject({ ok: false, reason: "reason_required" });
    expect(await run(w.mgr1, a.id, "decline", "   ")).toMatchObject({ ok: false, reason: "reason_required" });
    expect(await requestRow(h, a.id)).toMatchObject({ state: "pending" });
    expect(await run(w.mgr1, a.id, "approve", null)).toMatchObject({ ok: true, state: "approved" });
    expect(await requestRow(h, a.id)).toMatchObject({ state: "approved", decided_by: w.mgr1.id });
    expect(await run(w.mgr1b, a.id, "approve", null)).toMatchObject({ ok: false, reason: "decided" });
    const b = await personalReq(w, w.mem1, { title: "関数 2" });
    expect(await run(w.mgr1, b.id, "decline", "理由")).toMatchObject({ ok: true, state: "declined" });
    expect(await requestRow(h, b.id)).toMatchObject({ state: "declined", decline_reason: "理由" });
    const c = await personalReq(w, w.mem2, { title: "関数 3" });
    await h.admin.query("delete from scope_memberships where member_id = $1 and scope_id = $2", [w.mem2.id, w.g2]);
    await h.admin.query("update members set scope_id = $2 where id = $1", [w.mem2.id, w.co.rootScope]);
    expect(await run(w.mgr2, c.id, "approve", null)).toMatchObject({ ok: false, reason: "requester_gone" });
  });
});
