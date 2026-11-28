// K-713「中間（段 10・J1）：書く → 必ず守る → 上げる → 承認 → 棚が移る → 共有 → 写す」の試験（口の組・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K713-J-NNN・K713-H-001（チケット 11_tickets/K-713.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md。
//   単体の葉（K-679・K-680・K-681・K-685・K-686・K-687・K-688・K-689・K-690・K-719・K-676・K-677）が受けた分岐は重ねない。ここは葉をまたいで初めて分かること
//   （前の葉の結果を次の葉が読む・お知らせの宛て・別の会社に効かない・順番・取り消し）だけを見る。
//   行 001〜016 は 1 本の筋で、前の行が作った物を次の行が読む（上から順に流れる。1 行が赤なら、その後ろは赤い原因が前の行にある）。
//   行 017〜021 は筋ごとに自分の会社を作る（前の行に頼らない）。
//   土台は knowledge.harness.ts（K-675）と knowledge.requests-kit.ts（K-687）を読むだけで、変えない。口の振る舞いは各行の頭の h.ready() で読む。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { describe, expect, it } from "vitest";
import { bodyOf, setupKnowledge, type Person } from "./knowledge.harness.js";
import {
  allNotices,
  findNode,
  makeWorld,
  notices,
  num,
  requestRows,
  type Json,
  type World,
} from "./knowledge.requests-kit.js";

const h = setupKnowledge();

const call = async (p: Person, method: string, path: string, body?: unknown): Promise<Response> => {
  await h.ready();
  return h.req(method, path, { headers: h.as(p), ...(body === undefined ? {} : { body }) });
};
/** 状態コードを確かめて data を返す（外れたときは体の字を出す） */
const ok = async (r: Response, status = 200): Promise<Json> => {
  expect(r.status, await r.clone().text()).toBe(status);
  return ((await h.json(r)).data ?? {}) as Json;
};
const codeOf = async (r: Response): Promise<unknown> => ((await r.json()) as Json)["code"];
const readPage = async (p: Person, id: string): Promise<Json> => ok(await call(p, "GET", `/knowledge_pages/${id}`));
const readTree = async (p: Person): Promise<Json> => ok(await call(p, "GET", "/knowledge/tree"));
const actsOf = (page: Json): string[] => page["acts"] as string[];
const textOf = (page: Json): string => String((page["body"] as Json)["text"]);
const walk = (nodes: unknown, id: string): Json | null => {
  for (const n of (nodes as Json[] | undefined) ?? []) {
    if (n["id"] === id) return n;
    const hit = walk(n["children"], id);
    if (hit) return hit;
  }
  return null;
};
/** 木の中の 1 つのグループの棚（共有された物だけのグループも含む）から、ページを探す */
const inGroup = (tree: Json, group: string, id: string): Json | null =>
  walk(((tree["groups"] as Json[]).find((g) => g["id"] === group) ?? {})["nodes"], id);
const approvalsCount = async (p: Person): Promise<unknown> =>
  ((await readTree(p))["admin_counts"] as Json | null)?.["approvals"] ?? null; // 管理しない人は admin_counts そのものが null（K-676）
const live = async (w: World, kind: string, p?: Person): Promise<string[]> =>
  (await notices(h, w, kind, p ? { member: p } : {})).map((n) => n.member_id).sort();
const ids = (...ps: Person[]): string[] => ps.map((p) => p.id).sort();
const raise = async (p: Person, page: string, body: unknown = {}): Promise<Json> =>
  ok(await call(p, "POST", `/knowledge_pages/${page}/raise`, body), 201);
const setShares = (p: Person, page: string, groups: string[], message?: string): Promise<Response> =>
  call(p, "PUT", "/knowledge/shares", { page_id: page, group_ids: groups, ...(message ? { message } : {}) });
const approve = (p: Person, id: string): Promise<Response> => call(p, "POST", `/knowledge/requests/${id}/approve`, {});
const pendingShare = async (w: World): Promise<string> =>
  String((await requestRows(h, w)).filter((r) => r["kind"] === "share" && r["state"] === "pending").at(-1)!["id"]);
/** 自分の棚の公開済みページを行の守りの外で入れる（枝の筋の準備。書く口は 001 が通す） */
const mine = (p: Person, title: string, text = "本文"): Promise<string> =>
  h.page({ scope: p.scopeId, owner: p, personal: true, title, text });
const grp = (scope: string, owner: Person, title: string): Promise<string> => h.page({ scope, owner, title });

interface Story {
  w: World;
  page: string;
  raiseReq: string;
  shareReq: string;
  copy: string;
}
let S: Story;

describe("K-713 中間：書く → 必ず守る → 上げる → 承認 → 棚が移る → 共有 → 写す", () => {
  it("K713-J-001 書く：鈴木さんが自分の棚にページを作り（201 下書き）・本文を自動で保存し（200）・書き終える（200 版 1）と、鈴木さんの木にそのページが印なしで出て、読むと公開済み・版 1・自分の棚。佐藤さん（マネージャー）・管理者・ほかのグループの人には 404（自分の棚は本人だけ）", async () => {
    const w = await makeWorld(h, "K713 筋");
    const made = await ok(
      await call(w.mem1, "POST", "/knowledge_pages", { shelf: "me", title: "値引きの返し方", desc: "返してよい範囲" }),
      201,
    );
    const page = String(made["id"]);
    expect(made).toMatchObject({ state: "draft", must: false, place: { shelf: "me" } });
    const saved = await call(w.mem1, "PATCH", `/knowledge_pages/${page}/draft`, {
      doc: bodyOf("10 万円までは営業の判断で返してよい").doc,
    });
    expect(saved.status, await saved.clone().text()).toBe(200);
    expect(await ok(await call(w.mem1, "POST", `/knowledge_pages/${page}/publish`, {}))).toMatchObject({
      id: page,
      version: 1,
    });
    const read = await readPage(w.mem1, page);
    expect(read).toMatchObject({
      title: "値引きの返し方",
      state: "published",
      must: false,
      place: { shelf: "me", shelf_name: "自分" },
      foot: { version: 1 },
    });
    expect(textOf(read)).toContain("10 万円");
    expect(findNode(await readTree(w.mem1), page)).toMatchObject({ kind: "page", title: "値引きの返し方", mark: null });
    for (const p of [w.mgr1, w.boss, w.mem2]) {
      expect((await call(p, "GET", `/knowledge_pages/${page}`)).status, p.id).toBe(404);
    }
    S = { w, page, raiseReq: "", shareReq: "", copy: "" };
  });

  it("K713-J-002 似たページ：鈴木さんが同じ題名で似たページを探すと、会社の棚の「値引きの返し方（会社の基準）」が出る。入っていない受託開発の棚のページと、探している自分のページ自身は出ない", async () => {
    const { w, page } = S;
    const company = await h.page({
      scope: w.co.rootScope,
      owner: w.boss,
      title: "値引きの返し方（会社の基準）",
      summary: "値引きの上限",
    });
    const dev = await grp(w.g2, w.mgr2, "値引きの返し方（開発向け）");
    const r = await ok(
      await call(w.mem1, "POST", "/knowledge/similar", { title: "値引きの返し方", exclude_page_id: page }),
    );
    const got = (r["pages"] as { id: string }[]).map((x) => x.id);
    expect(got).toContain(company);
    expect(got).not.toContain(dev);
    expect(got).not.toContain(page);
  });

  it("K713-J-003 上げるのを頼む：鈴木さんが営業へ上げるのを頼むと 201（承認待ち）。ページはまだ自分の棚のまま。営業のマネージャー 2 人だけにお知らせが 1 つずつ出て（鈴木さん自身には出ない）、木の印は「承認待ち」・読むと帯は承認待ちで取り下げられ・「上げる」の操作は消え、佐藤さんの木の承認待ちの数は 1", async () => {
    const { w, page } = S;
    const r = await raise(w.mem1, page, { group_id: w.g1, message: "営業で使いたいです" });
    expect(r).toMatchObject({ kind: "raise", state: "pending", page_id: page, to_name: "営業" });
    S.raiseReq = String(r["id"]);
    expect(await h.row(page)).toMatchObject({ scope_id: w.g1, is_personal: true, owner_member_id: w.mem1.id });
    expect(await live(w, "knowledge.raise_requested")).toEqual(ids(w.mgr1, w.mgr1b));
    expect(await live(w, "knowledge.raise_requested", w.mem1)).toEqual([]);
    expect(findNode(await readTree(w.mem1), page)).toMatchObject({ mark: "waiting" });
    const read = await readPage(w.mem1, page);
    expect(read["request"]).toMatchObject({ state: "waiting", can_withdraw: true });
    expect(actsOf(read)).not.toContain("raise");
    expect(await approvalsCount(w.mgr1)).toBe(1);
    expect(await approvalsCount(w.mem1)).toBeNull();
  });

  it("K713-J-004 承認待ちの間は動かせない：同じページを動かす・消す・必ず守るを付けるは、どれも 409 E-KNW-011 で、ページは変わらない", async () => {
    const { w, page } = S;
    const before = await h.row(page);
    for (const [method, path, body] of [
      ["PATCH", `/knowledge_pages/${page}`, { folder_id: null }],
      ["DELETE", `/knowledge_pages/${page}`, undefined],
      ["PUT", `/knowledge_pages/${page}/must`, { must: true }],
    ] as const) {
      const r = await call(w.mem1, method, path, body);
      expect(r.status, `${method} ${path}`).toBe(409);
      expect(await codeOf(r), `${method} ${path}`).toBe("E-KNW-011");
    }
    expect(await h.row(page)).toEqual(before);
  });

  it("K713-J-005 承認すると棚が移る：承認待ちを読めるのはマネージャーだけ（鈴木さんは 403）。佐藤さんが承認すると 200・ページは営業の棚へ移り（持ち主と版はそのまま）、鈴木さんの自分の木から消えて営業の木に出る。鈴木さんに承認のお知らせ・もう 1 人のマネージャーの「頼まれた」お知らせは消え、承認待ちの数は 0", async () => {
    const { w, page, raiseReq } = S;
    const list = await call(w.mgr1, "GET", "/knowledge/approvals");
    const items = ((await h.json(list)).data ?? []) as Json[];
    expect(items.find((x) => x["id"] === raiseReq)).toMatchObject({ kind: "raise", title: "値引きの返し方" });
    expect((await call(w.mem1, "GET", "/knowledge/approvals")).status).toBe(403);
    expect(await ok(await approve(w.mgr1, raiseReq))).toMatchObject({
      id: raiseReq,
      kind: "raise",
      state: "approved",
      page_id: page,
    });
    expect(await h.row(page)).toMatchObject({
      scope_id: w.g1,
      is_personal: false,
      owner_member_id: w.mem1.id,
      state: "published",
      current_version: 1,
    });
    expect(await live(w, "knowledge.raise_approved")).toEqual(ids(w.mem1));
    expect(await live(w, "knowledge.raise_requested")).toEqual([]);
    const tree = await readTree(w.mem1);
    expect(walk(tree["my_nodes"], page)).toBeNull();
    expect(inGroup(tree, w.g1, page)).toMatchObject({ title: "値引きの返し方", mark: null });
    expect(await approvalsCount(w.mgr1)).toBe(0);
    expect(await num(h, "select count(*) as n from approvals where tenant_id = $1", [w.co.tenantId])).toBe(0);
    expect(((await readPage(w.mem1, page))["place"] as Json)["shelf"]).toBe("group");
  });

  it("K713-J-006 移った後は書ける人が変わる：鈴木さん（営業のメンバー）はもう直せず（403）、佐藤さん（マネージャー）は直せる（200）。営業の閲覧のみの人は読め、受託開発の田中さん・どこにも入っていない人は読めない（404）", async () => {
    const { w, page } = S;
    expect((await call(w.mem1, "PATCH", `/knowledge_pages/${page}/draft`, { desc: "鈴木が直す" })).status).toBe(403);
    expect(
      (await call(w.mgr1, "PATCH", `/knowledge_pages/${page}/draft`, { desc: "返してよい範囲（営業）" })).status,
    ).toBe(200);
    expect((await readPage(w.view1, page))["title"]).toBe("値引きの返し方");
    for (const p of [w.mem2, w.none]) expect((await call(p, "GET", `/knowledge_pages/${page}`)).status, p.id).toBe(404);
  });

  it("K713-J-007 必ず守るを付ける：佐藤さんが付けると 200（営業の 1 つ目・上限 20）。木の印・読んだときの「必ず守る」が揃い、「外す」の操作が出る。鈴木さんには付け外しの操作が出ない", async () => {
    const { w, page } = S;
    expect(await ok(await call(w.mgr1, "PUT", `/knowledge_pages/${page}/must`, { must: true }))).toMatchObject({
      id: page,
      must: true,
      used: 1,
      limit: 20,
    });
    expect(findNode(await readTree(w.mgr1), page)).toMatchObject({ must: true });
    const mgr = await readPage(w.mgr1, page);
    expect(mgr["must"]).toBe(true);
    expect(actsOf(mgr)).toContain("must-off");
    const mem = await readPage(w.mem1, page);
    expect(actsOf(mem)).not.toContain("must-on");
    expect(actsOf(mem)).not.toContain("must-off");
    expect((await call(w.mem1, "PUT", `/knowledge_pages/${page}/must`, { must: false })).status).toBe(403);
  });

  it("K713-J-008 必ず守るが付いていると消せない：佐藤さんが消そうとすると 409 E-KNW-050 で、ページは残って読める", async () => {
    const { w, page } = S;
    const r = await call(w.mgr1, "DELETE", `/knowledge_pages/${page}`);
    expect(r.status).toBe(409);
    expect(await codeOf(r)).toBe("E-KNW-050");
    expect((await readPage(w.mgr1, page))["must"]).toBe(true);
  });

  it("K713-J-009 必ず守るは 2,000 字まで：必ず守るのページを 2,001 字に書き直して書き終えようとすると 409 E-KNW-041（下書きのまま残る）。下書きをやめると公開の本文はそのまま・必ず守るも付いたまま", async () => {
    const { w, page } = S;
    const saved = await call(w.mgr1, "PATCH", `/knowledge_pages/${page}/draft`, {
      doc: bodyOf("あ".repeat(2001)).doc,
    });
    expect(saved.status, await saved.clone().text()).toBe(200);
    const r = await call(w.mgr1, "POST", `/knowledge_pages/${page}/publish`, {});
    expect(r.status).toBe(409);
    expect(await codeOf(r)).toBe("E-KNW-041");
    expect(((await readPage(w.mgr1, page))["draft"] as Json | null) !== null).toBe(true);
    expect(await ok(await call(w.mgr1, "DELETE", `/knowledge_pages/${page}/draft`))).toMatchObject({
      id: page,
      page_deleted: false,
    });
    const after = await readPage(w.mgr1, page);
    expect(after["must"]).toBe(true);
    expect(textOf(after)).toContain("10 万円");
    expect(after["draft"]).toBeNull();
  });

  it("K713-J-010 グループを選んで共有を頼む：佐藤さんが受託開発へ共有を頼むと 200（受託開発は承認待ち）。受託開発のマネージャーだけにお知らせが出て（田中さんには出ない）、田中さんはまだ読めない（404）。受託開発のマネージャーの承認待ちに「共有」の頼みが 1 件出る", async () => {
    const { w, page } = S;
    const r = await ok(await setShares(w.mgr1, page, [w.g2], "見てください"));
    const groups = r["groups"] as { group_id: string; checked: boolean; state: string | null }[];
    expect(groups.find((g) => g.group_id === w.g2)).toMatchObject({ checked: true, state: "waiting" });
    S.shareReq = await pendingShare(w);
    expect(await live(w, "knowledge.share_requested")).toEqual(ids(w.mgr2));
    expect((await call(w.mem2, "GET", `/knowledge_pages/${page}`)).status).toBe(404);
    const items = ((await h.json(await call(w.mgr2, "GET", "/knowledge/approvals"))).data ?? []) as Json[];
    expect(items.find((x) => x["id"] === S.shareReq)).toMatchObject({ kind: "share", title: "値引きの返し方" });
    expect(await approvalsCount(w.mgr2)).toBe(1);
  });

  it("K713-J-011 相手のマネージャーが承認すると、田中さんから見える・直せない：承認すると共有が始まり（200・種類 share）、田中さんは読める。帯は共有された側（元のグループ「営業」・直せない）で、操作に「写して直す」だけが出て「直す」「必ず守る」「上げる」「共有」は出ない。田中さんの木に共有された物だけの「営業」が出る。直そうとすると 403。管理者・企画の人は入っていないので読めない（404）。佐藤さんに承認のお知らせ", async () => {
    const { w, page, shareReq } = S;
    expect(await ok(await approve(w.mgr2, shareReq))).toMatchObject({ id: shareReq, kind: "share", state: "approved" });
    const read = await readPage(w.mem2, page);
    expect(read["shared_from"]).toMatchObject({ group_name: "営業", writable: false });
    const acts = actsOf(read);
    expect(acts).toContain("copy");
    for (const a of ["edit", "must-on", "must-off", "raise", "share"]) expect(acts, a).not.toContain(a);
    const shared = ((await readTree(w.mem2))["groups"] as Json[]).find((g) => g["id"] === w.g1);
    expect(shared).toMatchObject({ shared: true });
    expect(walk(shared!["nodes"], page)).toMatchObject({ title: "値引きの返し方", must: true });
    expect((await call(w.mem2, "PATCH", `/knowledge_pages/${page}/draft`, { desc: "田中が直す" })).status).toBe(403);
    for (const p of [w.boss, w.mem3, w.none])
      expect((await call(p, "GET", `/knowledge_pages/${page}`)).status, p.id).toBe(404);
    expect(await live(w, "knowledge.share_approved")).toEqual(ids(w.mgr1));
    expect(await approvalsCount(w.mgr2)).toBe(0);
  });

  it("K713-J-012 写して直す：田中さんが写すと 201 で、田中さんの自分の棚に公開済みの写し（題名は元のまま・必ず守るなし）ができる。写しの帯は元（営業・必ず守る・消えていない）を指し、田中さんの木には写しの印で出る。元は営業の棚で必ず守るのまま", async () => {
    const { w, page } = S;
    const stub = await ok(await call(w.mem2, "POST", `/knowledge_pages/${page}/copy`, {}), 201);
    expect(stub).toMatchObject({ title: "値引きの返し方", state: "published", must: false, place: { shelf: "me" } });
    S.copy = String(stub["id"]);
    const read = await readPage(w.mem2, S.copy);
    expect(read["copied_from"]).toMatchObject({
      page_id: page,
      title: "値引きの返し方",
      shelf_name: "営業",
      must: true,
      gone: false,
    });
    expect(actsOf(read)).toContain("edit");
    expect(findNode(await readTree(w.mem2), S.copy)).toMatchObject({ mark: "copy", must: false });
    expect(await h.row(page)).toMatchObject({ scope_id: w.g1, is_personal: false, is_must: true });
  });

  it("K713-J-013 写しを直しても元は変わらない：田中さんが写しの本文を直して書き終えると写しは版 2。営業の元は版 1・本文のまま（佐藤さんが読んで確かめる）", async () => {
    const { w, page, copy } = S;
    const saved = await call(w.mem2, "PATCH", `/knowledge_pages/${copy}/draft`, {
      doc: bodyOf("上限は 5 万円に下げて使う").doc,
    });
    expect(saved.status, await saved.clone().text()).toBe(200);
    expect(await ok(await call(w.mem2, "POST", `/knowledge_pages/${copy}/publish`, {}))).toMatchObject({
      id: copy,
      version: 2,
    });
    expect(textOf(await readPage(w.mem2, copy))).toContain("5 万円");
    const orig = await readPage(w.mgr1, page);
    expect(textOf(orig)).toContain("10 万円");
    expect(textOf(orig)).not.toContain("5 万円");
    expect(orig["foot"]).toMatchObject({ version: 1 });
  });

  it("K713-J-014 別の会社からは何も見えない：別の会社の管理者・マネージャーは、この筋のページを読めず（404）・木に出ず・上げる頼みと共有の頼みを承認しようとしても 404・写せず（404）。別の会社の人にお知らせは 1 つも出ていない", async () => {
    const { page, copy, raiseReq, shareReq } = S;
    const o = await makeWorld(h, "K713 別の会社");
    for (const p of [o.boss, o.mgr1, o.mem1]) {
      for (const id of [page, copy])
        expect((await call(p, "GET", `/knowledge_pages/${id}`)).status, `${p.id} ${id}`).toBe(404);
      const tree = JSON.stringify(await readTree(p));
      expect(tree).not.toContain(page);
      expect(tree).not.toContain("値引きの返し方");
    }
    for (const id of [raiseReq, shareReq]) expect((await approve(o.mgr1, id)).status, id).toBe(404);
    expect((await call(o.mem1, "POST", `/knowledge_pages/${page}/copy`, {})).status).toBe(404);
    expect(await allNotices(h, o)).toBe(0);
  });

  it("K713-J-015 共有をやめる：佐藤さんがチェックを外して送ると 200・承認なしですぐ田中さんから元が見えなくなる（404）。受託開発のマネージャーだけにお知らせ。田中さんの写しは残って読め、写しの帯は「元が見えなくなった」（gone）になる", async () => {
    const { w, page, copy } = S;
    const r = await ok(await setShares(w.mgr1, page, []));
    const g2 = (r["groups"] as { group_id: string; checked: boolean; state: string | null }[]).find(
      (g) => g.group_id === w.g2,
    );
    expect(g2).toMatchObject({ checked: false, state: null });
    expect((await call(w.mem2, "GET", `/knowledge_pages/${page}`)).status).toBe(404);
    expect(await live(w, "knowledge.share_ended")).toEqual(ids(w.mgr2));
    const mine2 = await readPage(w.mem2, copy);
    expect(textOf(mine2)).toContain("5 万円");
    expect(mine2["copied_from"]).toMatchObject({ page_id: null, title: "", must: false, gone: true });
    expect(((await readTree(w.mem2))["groups"] as Json[]).some((g) => g["id"] === w.g1 && g["shared"] === true)).toBe(
      false,
    );
  });

  it("K713-J-016 消そうとして止まる順：もう一度共有して承認されたあと、消そうとすると 必ず守る（E-KNW-050）→ 共有（E-KNW-051）の順に 409 で止まる。必ず守るを外し・共有をやめると消せ（200）、営業の木から消え、田中さんの写しは残る", async () => {
    const { w, page, copy } = S;
    expect((await setShares(w.mgr1, page, [w.g2])).status).toBe(200);
    expect((await approve(w.mgr2, await pendingShare(w))).status).toBe(200);
    const del = async (): Promise<[number, unknown]> => {
      const r = await call(w.mgr1, "DELETE", `/knowledge_pages/${page}`);
      return [r.status, r.status === 409 ? await codeOf(r) : null];
    };
    expect(await del()).toEqual([409, "E-KNW-050"]);
    expect(await ok(await call(w.mgr1, "PUT", `/knowledge_pages/${page}/must`, { must: false }))).toMatchObject({
      must: false,
      used: 0,
    });
    expect(await del()).toEqual([409, "E-KNW-051"]);
    expect((await setShares(w.mgr1, page, [])).status).toBe(200);
    expect((await del())[0]).toBe(200);
    expect((await call(w.mgr1, "GET", `/knowledge_pages/${page}`)).status).toBe(404);
    expect(inGroup(await readTree(w.mgr1), w.g1, page)).toBeNull();
    expect((await readPage(w.mem2, copy))["copied_from"]).toMatchObject({ gone: true });
  });

  it("K713-J-017 断られる（上げる）：佐藤さんが理由つきで断ると 200（断り）。ページは自分の棚のまま・鈴木さんに断りのお知らせ（理由つき）・もう 1 人のマネージャーの「頼まれた」お知らせは消える。読んだ帯は断られた（理由つき・取り下げは出ない）・木の印は「断られた」で、もう一度頼める", async () => {
    const w = await makeWorld(h, "K713 断る");
    const page = await mine(w.mem1, "断られるページ");
    const req = String((await raise(w.mem1, page, { group_id: w.g1 }))["id"]);
    expect(await live(w, "knowledge.raise_requested")).toEqual(ids(w.mgr1, w.mgr1b));
    const r = await call(w.mgr1, "POST", `/knowledge/requests/${req}/decline`, { reason: "既にあります" });
    expect(await ok(r)).toMatchObject({ id: req, kind: "raise", state: "declined", page_id: page });
    expect(await h.row(page)).toMatchObject({ scope_id: w.g1, is_personal: true });
    const ns = await notices(h, w, "knowledge.raise_declined", { member: w.mem1 });
    expect(ns.length).toBe(1);
    expect(ns[0]!.payload).toMatchObject({ title: "断られるページ", reason: "既にあります" });
    expect(await live(w, "knowledge.raise_requested")).toEqual([]);
    expect((await readPage(w.mem1, page))["request"]).toMatchObject({
      state: "declined",
      reason: "既にあります",
      can_withdraw: false,
    });
    expect(findNode(await readTree(w.mem1), page)).toMatchObject({ mark: "declined" });
    await raise(w.mem1, page, { group_id: w.g1 });
  });

  it("K713-J-018 取り下げる（上げる）：鈴木さんが承認待ちを取り下げると 200。マネージャー 2 人の「頼まれた」お知らせは消え、木の印は外れ、ページはまた動かせる（200）。取り下げた頼みを承認しようとすると 409 E-KNW-110", async () => {
    const w = await makeWorld(h, "K713 取り下げ");
    const page = await mine(w.mem1, "取り下げるページ");
    const req = String((await raise(w.mem1, page, { group_id: w.g1 }))["id"]);
    expect(await ok(await call(w.mem1, "DELETE", `/knowledge/requests/${req}`))).toMatchObject({
      id: req,
      state: "withdrawn",
    });
    expect(await live(w, "knowledge.raise_requested")).toEqual([]);
    expect(findNode(await readTree(w.mem1), page)).toMatchObject({ mark: null });
    expect(await approvalsCount(w.mgr1)).toBe(0);
    const r = await approve(w.mgr1, req);
    expect(r.status).toBe(409);
    expect(await codeOf(r)).toBe("E-KNW-110");
    expect((await call(w.mem1, "PATCH", `/knowledge_pages/${page}`, { folder_id: null })).status).toBe(200);
  });

  it("K713-J-019 共有の頼みを取り下げる：佐藤さんが送り直して受託開発のチェックを外すと、頼みは取り下げ済みになり、受託開発のマネージャーの「頼まれた」お知らせは消える。田中さんは読めず、取り下げた頼みを承認しようとすると 409 E-KNW-110", async () => {
    const w = await makeWorld(h, "K713 共有の取り下げ");
    const page = await grp(w.g1, w.mgr1, "共有を取り下げる");
    expect((await setShares(w.mgr1, page, [w.g2])).status).toBe(200);
    const req = await pendingShare(w);
    expect(await live(w, "knowledge.share_requested")).toEqual(ids(w.mgr2));
    expect((await setShares(w.mgr1, page, [])).status).toBe(200);
    expect((await requestRows(h, w)).find((x) => x["id"] === req)).toMatchObject({ state: "withdrawn" });
    expect(await live(w, "knowledge.share_requested")).toEqual([]);
    expect((await call(w.mem2, "GET", `/knowledge_pages/${page}`)).status).toBe(404);
    const r = await approve(w.mgr2, req);
    expect(r.status).toBe(409);
    expect(await codeOf(r)).toBe("E-KNW-110");
  });

  it("K713-J-020 共有を断られる：受託開発のマネージャーが理由つきで断ると 200（共有の断り）。佐藤さんに断りのお知らせ（理由つき）・田中さんは読めない（404）。佐藤さんはもう一度頼める（200・承認待ち）", async () => {
    const w = await makeWorld(h, "K713 共有を断る");
    const page = await grp(w.g1, w.mgr1, "共有を断られる");
    expect((await setShares(w.mgr1, page, [w.g2])).status).toBe(200);
    const req = await pendingShare(w);
    const r = await call(w.mgr2, "POST", `/knowledge/requests/${req}/decline`, { reason: "うちでは使わない" });
    expect(await ok(r)).toMatchObject({ id: req, kind: "share", state: "declined" });
    const ns = await notices(h, w, "knowledge.share_declined", { member: w.mgr1 });
    expect(ns.length).toBe(1);
    expect(ns[0]!.payload).toMatchObject({ reason: "うちでは使わない" });
    expect((await call(w.mem2, "GET", `/knowledge_pages/${page}`)).status).toBe(404);
    const again = await ok(await setShares(w.mgr1, page, [w.g2]));
    const g2 = (again["groups"] as { group_id: string; state: string | null }[]).find((g) => g.group_id === w.g2);
    expect(g2).toMatchObject({ state: "waiting" });
  });

  it("K713-J-021 会社の棚へ上げる：必ず守るの付いた受託開発のページを、開発マネージャーが会社へ上げるのを頼み、管理者が承認すると、ページは会社の棚へ移り・必ず守るは外れ・どのグループにも入っていない人と営業の鈴木さんも読める。開発マネージャーに承認のお知らせ", async () => {
    const w = await makeWorld(h, "K713 会社へ");
    const page = await h.page({ scope: w.g2, owner: w.mgr2, title: "納品の前の確かめ", must: true });
    const r = await raise(w.mgr2, page, {});
    expect(r).toMatchObject({ kind: "raise", state: "pending", page_id: page, to_name: "会社" });
    expect(await live(w, "knowledge.raise_requested")).toEqual(ids(w.boss, w.boss2));
    expect((await approve(w.boss, String(r["id"]))).status).toBe(200);
    expect(await h.row(page)).toMatchObject({ scope_id: w.co.rootScope, is_personal: false, is_must: false });
    for (const p of [w.none, w.mem1, w.mem3]) expect((await readPage(p, page))["title"], p.id).toBe("納品の前の確かめ");
    expect(walk((await readTree(w.none))["company_nodes"], page)).toMatchObject({ title: "納品の前の確かめ" });
    expect(await live(w, "knowledge.raise_approved")).toEqual(ids(w.mgr2));
  });

  it("K713-J-022 下書きは持ち主だけ：鈴木さんが作って書き終えていないページは、佐藤さん・管理者・ほかの人から読めず（404）木にも出ず、上げるのも頼めない（409 E-KNW-010）。やめるとページごと消える", async () => {
    const w = await makeWorld(h, "K713 下書き");
    const made = await ok(
      await call(w.mem1, "POST", "/knowledge_pages", { shelf: "me", title: "書きかけ", desc: "" }),
      201,
    );
    const page = String(made["id"]);
    for (const p of [w.mgr1, w.boss, w.mem2])
      expect((await call(p, "GET", `/knowledge_pages/${page}`)).status, p.id).toBe(404);
    expect(JSON.stringify(await readTree(w.mgr1))).not.toContain(page);
    const r = await call(w.mem1, "POST", `/knowledge_pages/${page}/raise`, { group_id: w.g1 });
    expect(r.status).toBe(409);
    expect(await codeOf(r)).toBe("E-KNW-010");
    expect(await ok(await call(w.mem1, "DELETE", `/knowledge_pages/${page}/draft`))).toMatchObject({
      id: page,
      page_deleted: true,
    });
    expect((await call(w.mem1, "GET", `/knowledge_pages/${page}`)).status).toBe(404);
  });

  // K713-H-001 は人が確かめる行（画面を通す確認）。試験のコードは書かない（チケットの judge-skip）。
});
