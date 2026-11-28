// K-892「届いた依頼の置き場と読む口（listClientRequests・getClientRequest）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K892-API-…）は 11_tickets/K-892.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/client-requests-read.ts の register（K-326）。道具は requests-world.ts（K-892 が持ち込む）。
// 試験が決める口の形（契約は 05_flow/screen_api.py の前からの行を直し 05_flow/screen_api.d/K-892.py で作る）:
//   listClientRequests GET /api/v1/client_requests[?state=live|done]  200 { data: { items: [{ id, title, from_name, group_name, route_name?, created_at, state: new|asking|done, tag? }], counts: { live } } }
//   getClientRequest   GET /api/v1/client_requests/:id               200 { data: { request: {…}, messages: [{ id, side: they|we, name, at, text }], routes: [{ id, name }], can_act, pc_connected,
//                                                                         ticket_draft, reply_draft, questions, route_suggestion } }
//     見えない・無い・消した・別の会社・前の取引先の形は 404・E-GST-100（欄・details なし）／ゲストの文脈は 403／ログインなしは 401
// DB（migration 20261127095200_client_request_inbox.sql）: client_request_messages・client_requests の案の列・app.client_request_route/visible/actable/routes/list/get/notify_author・方針 4 つ
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { makeFixture, type Fixture, type Person } from "../fixture.js";
import {
  asJson,
  bridge,
  guest,
  hasNoDetail,
  inbox,
  NO_SUCH,
  perm,
  request,
  requestMsg,
  useHooks,
  world,
  type Json,
  type RW,
} from "./requests-world.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (code: string): string => ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${code} が無い）`;

let f: Fixture;
beforeAll(async () => {
  f = await makeFixture([]);
  await useHooks(f, "client-requests-read");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

interface Item {
  id: string;
  title: string;
  from_name: string;
  group_name: string;
  route_name?: string;
  created_at: string;
  state: string;
  tag?: string;
}
const list = (p: Person | null, q = "", role: "member" | "client" = "member") =>
  f.req("GET", `/client_requests${q}`, p ? { headers: f.as(p, role) } : {});
const get = (id: string, p: Person | null, role: "member" | "client" = "member") =>
  f.req("GET", `/client_requests/${id}`, p ? { headers: f.as(p, role) } : {});
const items = async (r: Response): Promise<Item[]> => ((await asJson(r)).data as { items: Item[] }).items;
const ctx = (w: RW, p: Person, role: "member" | "client" = "member"): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role,
  stepUpAt: null,
});
const rowsAs = async (w: RW, p: Person, sql: string, args: unknown[] = []): Promise<number> =>
  withTenant(f.pool, ctx(w, p), async (cl) => (await cl.query(sql, args)).rowCount ?? 0);

describe("K-892 届いた依頼を読む（listClientRequests）", () => {
  it("K892-API-001 一覧：新しい 2・聞いている 1・断った 1・チケットにした 1。鍵はちょうど items・counts・新しい物が新しい順・続けて done が新しい順・counts.live は 3・さばいた物だけ tag", async () => {
    const w = await world(f, "001");
    const a = await guest(f, w, "山田", w.gA);
    const [n1, n2, as1, dc, tk] = [
      await request(f, w, w.gA, a, { title: "新しい 1", ago: "5 hours" }),
      await request(f, w, w.gA, a, { title: "新しい 2", ago: "1 hour" }),
      await request(f, w, w.gA, a, { title: "聞いている", state: "asking", ago: "3 hours" }),
      await request(f, w, w.gA, a, { title: "断った", state: "declined", ago: "2 hours" }),
      await request(f, w, w.gA, a, { title: "チケットにした", state: "ticketed", ago: "4 hours" }),
    ];
    const r = await list(w.staff);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await asJson(r)).data as { items: Item[]; counts: { live: number } };
    expect(Object.keys(d).sort()).toEqual(["counts", "items"]);
    expect(d.counts).toEqual({ live: 3 });
    expect(d.items.map((x) => x.id)).toEqual([n2, as1, n1, dc, tk]);
    expect(d.items.map((x) => x.state)).toEqual(["new", "asking", "new", "done", "done"]);
    expect(d.items.map((x) => x.tag)).toEqual([undefined, undefined, undefined, "断った", "チケットにした"]);
    for (const it of d.items)
      expect(
        Object.keys(it)
          .filter((k) => k !== "tag")
          .sort(),
      ).toEqual(["created_at", "from_name", "group_name", "id", "route_name", "state", "title"]);
  });

  it("K892-API-002 問い合わせ state：live・done で絞れる。ほかの値・知らない問い合わせは 422。done は 50 件まで", async () => {
    const w = await world(f, "002");
    const a = await guest(f, w, "山田", w.gA);
    await request(f, w, w.gA, a, { title: "新しい" });
    for (let i = 0; i < 52; i++)
      await request(f, w, w.gA, a, { title: `断った ${i}`, state: "declined", ago: `${i + 1} minutes` });
    expect((await items(await list(w.staff, "?state=live"))).map((x) => x.state)).toEqual(["new"]);
    const done = await items(await list(w.staff, "?state=done"));
    expect(done.length).toBe(50);
    expect(done.every((x) => x.state === "done")).toBe(true);
    for (const q of ["?state=all", "?state=", "?foo=1", "?state=live&state=done"])
      expect((await list(w.staff, q)).status, q).toBe(422);
    expect((await items(await list(w.staff))).length).toBe(51);
  });

  it("K892-API-003 名前の値：from_name は出した人の表示名・group_name はゲストのグループの名前・route_name は届け先の社内のグループの名前。ゲストのグループを消しても名前は出る。届け先の社内のグループを消すと route_name の鍵は無い", async () => {
    const w = await world(f, "003");
    const a = await guest(f, w, "山田 花子", w.gA);
    const gname = (await f.admin.query<{ name: string }>("select name from guest_groups where id = $1", [w.gA]))
      .rows[0]!.name;
    await request(f, w, w.gA, a, { title: "名前の依頼" });
    const [it1] = await items(await list(w.staff));
    expect(it1).toMatchObject({ from_name: "山田 花子", group_name: gname, route_name: "営業" });
    await f.admin.query("update guest_groups set deleted_at = now() where id = $1", [w.gA]);
    expect((await items(await list(w.staff)))[0]!.group_name).toBe(gname);
    await f.admin.query("update scopes set deleted_at = now() where id = $1", [w.reqScope]);
    const after = (await items(await list(w.boss)))[0]!;
    expect(Object.keys(after)).not.toContain("route_name");
  });

  it("K892-API-004 守り（届け先）：届け先のグループの人は見える・別のグループだけの人は 0 件・管理者は全部。routed_scope_id を直すと見える人が入れ替わる（元の届け先の人は 404）", async () => {
    const w = await world(f, "004");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    expect((await items(await list(w.staff))).length).toBe(1);
    expect((await items(await list(w.outsider))).length).toBe(0);
    expect((await items(await list(w.boss))).length).toBe(1);
    expect((await get(rid, w.outsider)).status).toBe(404);
    await f.admin.query("update client_requests set routed_scope_id = $2 where id = $1", [rid, w.otherScope]);
    expect((await items(await list(w.staff))).length).toBe(0);
    expect((await get(rid, w.staff)).status).toBe(404);
    expect((await items(await list(w.outsider))).length).toBe(1);
    expect((await get(rid, w.outsider)).status).toBe(200);
    expect((await items(await list(w.boss))).length).toBe(1);
  });

  it("K892-API-005 出さない依頼：前の取引先の形（guest_group_id が空）・消した依頼・別の会社の依頼は管理者にも出ない", async () => {
    const w = await world(f, "005");
    const o = await world(f, "005 別の会社");
    const a = await guest(f, w, "山田", w.gA);
    const oa = await guest(f, o, "別の会社の山田", o.gA);
    const [ok, dead, foreign] = [
      await request(f, w, w.gA, a, { title: "見える" }),
      await request(f, w, w.gA, a, { title: "消した", deleted: true }),
      await request(f, o, o.gA, oa, { title: "別の会社" }),
    ];
    const client = (
      await f.admin.query<{ id: string }>(
        "insert into clients (tenant_id, name, visibility) values ($1, '前の取引先', 'all') returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const legacy = (
      await f.admin.query<{ id: string }>(
        "insert into client_requests (tenant_id, client_id, title, state) values ($1, $2, '前の形', 'new') returning id",
        [w.tenantId, client],
      )
    ).rows[0]!.id;
    expect((await items(await list(w.boss))).map((x) => x.id)).toEqual([ok]);
    for (const id of [dead, foreign, legacy]) expect((await get(id, w.boss)).status, id).toBe(404);
  });

  it("K892-API-006 守り（役）：ゲストの文脈は一覧も 1 件も 403・ログインしていない人は 401・何も返さない", async () => {
    const w = await world(f, "006");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    expect((await list(a, "", "client")).status).toBe(403);
    expect((await get(rid, a, "client")).status).toBe(403);
    expect((await list(null)).status).toBe(401);
    expect((await get(rid, null)).status).toBe(401);
  });

  it("K892-API-007 0 件：依頼が無い会社は items が空・counts.live が 0。ゲストのグループが無い会社も同じ", async () => {
    const w = await world(f, "007");
    expect((await asJson(await list(w.staff))).data).toEqual({ items: [], counts: { live: 0 } });
    await f.admin.query("delete from guest_groups where tenant_id = $1", [w.tenantId]);
    expect((await asJson(await list(w.boss))).data).toEqual({ items: [], counts: { live: 0 } });
  });
});

describe("K-892 1 件を読む（getClientRequest）", () => {
  it("K892-API-008 1 件の形：鍵はちょうど request・messages・routes・can_act・pc_connected・ticket_draft・reply_draft・questions・route_suggestion。messages は古い順・ゲストは they・社内は we・消したやり取りは出ない", async () => {
    const w = await world(f, "008");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, { title: "見積もりのお願い", body: "見積もりをください", ago: "3 hours" });
    await requestMsg(f, w, rid, "company", w.staff, "いつまでですか", { ago: "2 hours" });
    await requestMsg(f, w, rid, "guest", a, "来週までに", { ago: "1 hour" });
    await requestMsg(f, w, rid, "guest", a, "消した物", { ago: "30 minutes", deleted: true });
    const r = await get(rid, w.staff);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await asJson(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual([
      "can_act",
      "messages",
      "pc_connected",
      "questions",
      "reply_draft",
      "request",
      "route_suggestion",
      "routes",
      "ticket_draft",
    ]);
    const q = d["request"] as Json;
    expect(Object.keys(q).sort()).toEqual([
      "body",
      "created_at",
      "from_name",
      "group_name",
      "id",
      "route_name",
      "state",
      "title",
    ]);
    expect(q).toMatchObject({
      id: rid,
      title: "見積もりのお願い",
      body: "見積もりをください",
      state: "new",
      from_name: "山田",
      route_name: "営業",
    });
    const m = d["messages"] as { id: string; side: string; name: string; at: string; text: string }[];
    expect(m.map((x) => [x.side, x.name, x.text])).toEqual([
      ["we", "営業の人", "いつまでですか"],
      ["they", "山田", "来週までに"],
    ]);
    expect(Object.keys(m[0]!).sort()).toEqual(["at", "id", "name", "side", "text"]);
  });

  it("K892-API-009 can_act・pc_connected：届け先で edit できる人は can_act true・見えるだけの人は false。見ている人に生きている PC（75 秒の知らせ）があれば pc_connected true・失効した PC・失効していないが静かな PC・別の人の PC は false", async () => {
    const w = await world(f, "009");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    const flags = async (p: Person) => {
      const d = (await asJson(await get(rid, p))).data as { can_act: boolean; pc_connected: boolean };
      return [d.can_act, d.pc_connected];
    };
    expect(await flags(w.staff)).toEqual([true, false]);
    expect(await flags(w.viewer)).toEqual([false, false]);
    await bridge(f, w, w.staff, { revoked: true });
    expect(await flags(w.staff)).toEqual([true, false]);
    await bridge(f, w, w.staff, { quiet: true });
    expect(await flags(w.staff), "失効していなくても 75 秒より前から静かな PC は false").toEqual([true, false]);
    await bridge(f, w, w.boss);
    expect(await flags(w.staff), "別の人の Bridge").toEqual([true, false]);
    await bridge(f, w, w.staff);
    expect(await flags(w.staff)).toEqual([true, true]);
    await perm(f, w, w.viewer, w.reqScope);
    expect((await flags(w.viewer))[0]).toBe(true);
  });

  it("K892-API-010 案：draft_state が ready のときだけ ticket_draft・reply_draft・route_suggestion に中身。pending・failed・無しは 3 つとも null。questions は入っている並び・無ければ空", async () => {
    const w = await world(f, "010");
    const a = await guest(f, w, "山田", w.gA);
    const draft = {
      ticket: {
        title: "見積もりを作る",
        kind: "タスク",
        owner: "高本のAI",
        due: "2026-12-10",
        cost: "2 時間",
        route_name: "営業",
      },
      reply: "ご予算を教えてください",
      route: { name: "営業", reason: "営業の依頼です" },
    };
    const read = async (rid: string) => (await asJson(await get(rid, w.staff))).data as Json;
    const ready = await read(await request(f, w, w.gA, a, { draft: { state: "ready", draft } }));
    expect([ready["ticket_draft"], ready["reply_draft"], ready["route_suggestion"]]).toEqual([
      draft.ticket,
      draft.reply,
      draft.route,
    ]);
    for (const dr of [{ state: "pending" as const, draft }, { state: "failed" as const, draft }, null]) {
      const d = await read(await request(f, w, w.gA, a, { draft: dr }));
      expect([d["ticket_draft"], d["reply_draft"], d["route_suggestion"]], JSON.stringify(dr?.state)).toEqual([
        null,
        null,
        null,
      ]);
    }
    const q = await request(f, w, w.gA, a, {});
    expect((await read(q))["questions"]).toEqual([]);
    await f.admin.query("update client_requests set questions = $2::jsonb where id = $1", [
      q,
      JSON.stringify(["いつまでですか", "予算は"]),
    ]);
    expect((await read(q))["questions"]).toEqual(["いつまでですか", "予算は"]);
  });

  it("K892-API-011 routes：見ている人が client_requests を edit できる消していないグループを名前の順で返す。消したグループ・別の会社のグループは出ない・edit できない人には空", async () => {
    const w = await world(f, "011");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    await f.admin.query(
      "insert into scopes (tenant_id, name, ticket_prefix, parent_id, deleted_at) values ($1, '消した部', 'RD', $2, now())",
      [w.tenantId, w.root],
    );
    const routes = async (p: Person) =>
      ((await asJson(await get(rid, p))).data as { routes: { id: string; name: string }[] }).routes;
    const all = await routes(w.boss);
    expect(all.map((x) => x.name)).toEqual([...all.map((x) => x.name)].sort((x, y) => x.localeCompare(y, "ja")));
    expect(all.map((x) => x.id)).toEqual(expect.arrayContaining([w.reqScope, w.otherScope]));
    expect(all.map((x) => x.name)).not.toContain("消した部");
    expect((await routes(w.staff)).map((x) => x.id)).toEqual([w.reqScope]);
    expect(await routes(w.viewer)).toEqual([]);
  });

  it("K892-API-012 失敗：見えない・無い・消した・別の会社・前の形・知らない id は 404・E-GST-100・正本の文・欄・details なし。同じ依頼は届け先が見える人には 200", async () => {
    const w = await world(f, "012");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    const dead = await request(f, w, w.gA, a, { deleted: true });
    for (const [id, p] of [
      [rid, w.outsider],
      [dead, w.boss],
      [NO_SUCH, w.boss],
    ] as const) {
      const r = await get(id, p);
      expect(r.status, id).toBe(404);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-GST-100");
      expect(j["message"]).toBe(msg("E-GST-100"));
      expect(hasNoDetail(j)).toBe(true);
    }
    expect((await get(rid, w.staff)).status).toBe(200);
  });

  it("K892-API-013 入力：uuid でない :id は 422（入口）・NUL を含む問い合わせの値は 422", async () => {
    const w = await world(f, "013");
    expect((await get("not-a-uuid", w.boss)).status).toBe(422);
    expect((await list(w.boss, "?state=li%00ve")).status).toBe(422);
  });

  it("K892-API-014 操作の揺れ：読んでも依頼・やり取りの行も updated_at も変わらない。続けて 2 回読むと同じ答え", async () => {
    const w = await world(f, "014");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, { ago: "2 hours" });
    await requestMsg(f, w, rid, "guest", a, "やり取り", { ago: "1 hour" });
    const snap = async () =>
      JSON.stringify(
        (
          await f.admin.query(
            "select updated_at, state, questions from client_requests where id = $1 union all select updated_at, null, null from client_request_messages where client_request_id = $1",
            [rid],
          )
        ).rows,
      );
    const before = await snap();
    const [r1, r2] = [await asJson(await get(rid, w.staff)), await asJson(await get(rid, w.staff))];
    await list(w.staff);
    expect(r1).toEqual(r2);
    expect(await snap()).toBe(before);
  });
});

describe("K-892 表と守り（DB）", () => {
  it("K892-API-015 表と列：client_request_messages の列は決めた物だけ・client_requests に draft・draft_state・draft_job_id・draft_at が増え draft_state は 3 つの値だけ入る", async () => {
    const cols = async (t: string) =>
      (
        await f.admin.query<{ c: string }>(
          "select column_name as c from information_schema.columns where table_schema = 'public' and table_name = $1",
          [t],
        )
      ).rows.map((r) => r.c);
    expect((await cols("client_request_messages")).sort()).toEqual(
      [
        "attachment_ids",
        "author_member_id",
        "body",
        "client_request_id",
        "created_at",
        "created_by",
        "deleted_at",
        "id",
        "kind",
        "side",
        "tenant_id",
        "updated_at",
        "updated_by",
      ]
        .filter((c) => c !== "attachment_ids")
        .sort(),
    );
    for (const c of ["draft", "draft_state", "draft_job_id", "draft_at"])
      expect(await cols("client_requests")).toContain(c);
    const w = await world(f, "015");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    const setState = (s: string) =>
      f.admin.query("update client_requests set draft_state = $2 where id = $1", [rid, s]).then(
        () => "ok",
        (e: { code?: string }) => e.code ?? "error",
      );
    expect(await setState("ready")).toBe("ok");
    expect(await setState("bogus")).toBe("23514");
  });

  it("K892-API-016 やり取りの形：side が guest・company 以外・kind が message・attachment 以外・message の本文が空は 23514。別の会社の依頼・別の会社の人を結ぶ行は 22023", async () => {
    const w = await world(f, "016");
    const o = await world(f, "016 別の会社");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    const ins = (side: string, kind: string, body: string, rq: string, author: string, tenant = w.tenantId) =>
      f.admin
        .query(
          "insert into client_request_messages (tenant_id, client_request_id, side, kind, body, author_member_id) values ($1, $2, $3, $4, $5, $6)",
          [tenant, rq, side, kind, body, author],
        )
        .then(
          () => "ok",
          (e: { code?: string }) => e.code ?? "error",
        );
    expect(await ins("guest", "message", "ふつう", rid, a.id)).toBe("ok");
    expect(await ins("other", "message", "x", rid, a.id)).toBe("23514");
    expect(await ins("guest", "memo", "x", rid, a.id)).toBe("23514");
    expect(await ins("guest", "message", "   ", rid, a.id)).toBe("23514");
    const oRid = await request(f, o, o.gA, await guest(f, o, "別", o.gA), {});
    expect(await ins("guest", "message", "x", oRid, a.id)).toBe("22023");
    expect(await ins("guest", "message", "x", rid, o.boss.id)).toBe("22023");
  });

  it("K892-API-017 守り（読む方針）：届け先が見える社内の人は依頼もやり取りも読める・見えない人・別の会社の人は 0 行・ゲストの文脈は client_request_messages を読めない", async () => {
    const w = await world(f, "017");
    const o = await world(f, "017 別の会社");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    await requestMsg(f, w, rid, "guest", a, "やり取り");
    const q = (t: string) => `select id from ${t} where ${t === "client_requests" ? "id" : "client_request_id"} = $1`;
    for (const t of ["client_requests", "client_request_messages"]) {
      expect(await rowsAs(w, w.staff, q(t), [rid]), `${t} 届け先の人`).toBe(1);
      expect(await rowsAs(w, w.outsider, q(t), [rid]), `${t} 見えない人`).toBe(0);
      expect(await rowsAs(w, o.boss, q(t), [rid]), `${t} 別の会社`).toBe(0);
    }
    expect(await rowsAs(w, a, q("client_request_messages"), [rid]), "ゲスト").toBe(0);
  });

  it("K892-API-018 守り（直す方針）：届け先で edit できる人だけが依頼を update できる（見えるだけの人・別のグループの人は 0 行）。前からの取引先の形の方針は残る", async () => {
    const w = await world(f, "018");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    const upd = (p: Person) =>
      rowsAs(w, p, "update client_requests set updated_at = now() where id = $1 returning id", [rid]);
    expect(await upd(w.viewer)).toBe(0);
    expect(await upd(w.outsider)).toBe(0);
    expect(await upd(w.staff)).toBe(1);
    expect(await upd(w.boss)).toBe(1);
    const pol = (
      await f.admin.query<{ p: string }>("select policyname as p from pg_policies where tablename = 'client_requests'")
    ).rows.map((r) => r.p);
    expect(pol).toEqual(
      expect.arrayContaining([
        "client_requests_read",
        "client_requests_same_client_read",
        "client_requests_guest_read",
        "client_requests_staff_guest_read",
        "client_requests_staff_guest_update",
      ]),
    );
  });

  it("K892-API-019 守り（やり取りを書く方針）：届け先で edit できる人は side company・自分を書いた人にして insert できる。side guest・他人を書いた人にした行・edit できない人の行は断られる", async () => {
    const w = await world(f, "019");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    const ins = async (p: Person, side: string, author: string) =>
      withTenant(f.pool, ctx(w, p), async (cl) => {
        try {
          await cl.query("savepoint s");
          await cl.query(
            "insert into client_request_messages (tenant_id, client_request_id, side, kind, body, author_member_id) values ($1, $2, $3, 'message', 'x', $4)",
            [w.tenantId, rid, side, author],
          );
          return "ok";
        } catch (e) {
          await cl.query("rollback to savepoint s");
          return (e as { code?: string }).code ?? "error";
        }
      });
    expect(await ins(w.staff, "company", w.staff.id)).toBe("ok");
    expect(await ins(w.staff, "guest", w.staff.id)).not.toBe("ok");
    expect(await ins(w.staff, "company", w.boss.id)).not.toBe("ok");
    expect(await ins(w.viewer, "company", w.viewer.id)).not.toBe("ok");
    expect(await ins(w.outsider, "company", w.outsider.id)).not.toBe("ok");
  });

  it("K892-API-020 届け先が消えた：届け先の社内のグループを消すと見えるのは会社全体の edit を持つ人だけ・route_name の鍵は無い", async () => {
    const w = await world(f, "020");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    await f.admin.query("update scopes set deleted_at = now() where id = $1", [w.reqScope]);
    expect((await get(rid, w.staff)).status).toBe(404);
    const r = await get(rid, w.boss);
    expect(r.status).toBe(200);
    expect(Object.keys(((await asJson(r)).data as { request: Json }).request)).not.toContain("route_name");
  });

  it("K892-API-021 出し手へのお知らせ（関数）：出し手が居ればその人の受け箱に 1 件（inapp・種類は渡した物・payload は request_id と渡した物・dedupe_key は種類と ref と出し手）。返り値は member_id・email・notification_id。出し手が抜けた・止めた・グループから外れた・ゲストでないときは何も入れず null", async () => {
    const w = await world(f, "021");
    const [a, left, susp, out, notGuest] = [
      await guest(f, w, "山田", w.gA),
      await guest(f, w, "抜けた", w.gA),
      await guest(f, w, "止めた", w.gA, { status: "suspended" }),
      await guest(f, w, "外れた", null),
      w.staff,
    ];
    const call = async (by: Person, ref: string) => {
      const rid = await request(f, w, w.gA, by, {});
      const v = (
        await f.admin.query<{ v: Json | null }>(
          "select app.client_request_notify_author($1, 'client_request.replied', $2::jsonb) as v",
          [rid, JSON.stringify({ ref, extra: 1 })],
        )
      ).rows[0]!.v;
      return { rid, v };
    };
    const ok = await call(a, "m1");
    expect(Object.keys(ok.v!).sort()).toEqual(["email", "member_id", "notification_id"]);
    expect(ok.v!["member_id"]).toBe(a.id);
    expect(await inbox(f, a.id, "client_request.replied")).toBe(1);
    const row = (
      await f.admin.query<{ payload: Json; dedupe_key: string; sent_at: Date | null }>(
        "select payload, dedupe_key, sent_at from notifications where id = $1",
        [ok.v!["notification_id"]],
      )
    ).rows[0]!;
    expect(row.payload).toMatchObject({ request_id: ok.rid, extra: 1 });
    expect(row.dedupe_key).toBe(`client_request.replied:m1:${a.id}`);
    expect(row.sent_at).not.toBeNull();
    // 中だけで使う関数なので、アプリの役には execute を渡さない（本線の決まり 0092・D-128.171）
    await expect(
      f.pool.query("select app.client_request_notify_author($1, 'client_request.replied', '{}'::jsonb)", [ok.rid]),
    ).rejects.toMatchObject({ code: "42501" });
    await f.admin.query("update members set deleted_at = now() where id = $1", [left.id]);
    for (const [by, label] of [
      [left, "抜けた"],
      [susp, "止めた"],
      [out, "グループから外れた"],
      [notGuest, "ゲストでない"],
    ] as const) {
      expect((await call(by, label)).v, label).toBeNull();
      expect(await inbox(f, by.id, "client_request.replied"), label).toBe(0);
    }
  });

  it("K892-API-022 守り（上限・no-store）：同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数。200・404 の答えに Cache-Control の private か no-store が付く", async () => {
    const w = await world(f, "022");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, {});
    expect((await get(rid, w.staff)).headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    expect((await get(NO_SUCH, w.staff)).headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    f.limits["getClientRequest"] = 2;
    try {
      const rs = [];
      for (let i = 0; i < 3; i++) rs.push(await get(rid, w.staff));
      expect(rs.map((r) => r.status)).toEqual([200, 200, 429]);
      const j = await asJson(rs[2]!);
      expect(Number.isInteger(j["retry_after_sec"])).toBe(true);
      expect(j["retry_after_sec"] as number).toBeGreaterThanOrEqual(1);
      expect(j["retry_after_sec"] as number).toBeLessThanOrEqual(60);
    } finally {
      delete f.limits["getClientRequest"];
    }
  });
});
