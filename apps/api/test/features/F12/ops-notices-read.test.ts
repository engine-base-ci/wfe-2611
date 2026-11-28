// K-977 運営がお知らせを読む（listOpsNotices・GET /api/v1/ops/notices／getOpsNotice・GET /api/v1/ops/notices/:id）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えは K-1004 の形（一覧の 1 行 11 欄＝9 欄と incident_state・admins_only・1 件 16 欄）。状態は 4 つ（draft・scheduled・published・resolved）で、DB の行から読み替える：
//     予定の時刻を過ぎた scheduled は published／障害で今の状態（status_incidents）が resolved は resolved。出す場所は DB の 'banner' を band に。
//   出すと届く数（reach）は K-954 の届け先の決めの「誰に」の所（app.notice_audience_ok）で数える（下書きでも、出したら届く数）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant } from "@kaname/db/context";
import { startOpsNotices, OPS_NOTICE_KEYS, OPS_NOTICE_ROW_KEYS, type OpsNotices } from "./ops-notice.harness.js";
import { isFlat, OPS_TENANT, type Json, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

let t: OpsNotices;
let me: Person;
let noNotice: Person;
let a: Ws;
let b: Ws;

beforeAll(async () => {
  t = await startOpsNotices("k977", ["ops-notices-read"]);
  me = await t.ops("高本");
  noNotice = await t.ops("お金だけ", ["money"]);
  a = await t.ws("ミナト企画", { members: 2 });
  b = await t.ws("北村デザイン", { members: 2 });
});
afterAll(async () => {
  await t.close();
});

const list = async (q = "", who: Person = me) => {
  const r = await t.call(who, "GET", `/ops/notices${q}`);
  return { r, b: await t.json(r) };
};
const one = async (id: string, who: Person = me) => {
  const r = await t.call(who, "GET", `/ops/notices/${id}`);
  return { r, b: await t.json(r) };
};
const rowOf = async (id: string, q = ""): Promise<Json | undefined> =>
  t.mine((await list(q)).b.data).find((x) => x["id"] === id) as Json | undefined;

describe("K-977 一覧", () => {
  it("K977-API-001 一覧の形と並び：200・1 行の鍵はちょうど 11（K-1004 の 9 欄と incident_state・admins_only）・作った時刻の新しい順", async () => {
    const old = await t.notice({ title: "前の" });
    await t.f.admin.query("update notices set created_at = now() - interval '1 hour' where id = $1", [old]);
    const now = await t.notice({ title: "後の" });
    const { r, b: body } = await list();
    expect(r.status, JSON.stringify(body)).toBe(200);
    const mine = t.mine(body.data).filter((x) => x["id"] === old || x["id"] === now);
    expect(mine.map((x) => x["id"])).toEqual([now, old]);
    for (const x of mine) expect(Object.keys(x).sort()).toEqual(OPS_NOTICE_ROW_KEYS);
  });

  it("K977-API-002 状態の読み替え：下書き draft・予定の前 scheduled・予定の時刻を過ぎた published・出した published・障害で直った resolved。行の incident_state は障害の今の状態（ほかは null）", async () => {
    const draft = await t.notice({ title: "下書き" });
    const soon = await t.notice({ title: "予定", state: "scheduled", publishIn: 3600 });
    const past = await t.notice({ title: "予定を過ぎた", state: "scheduled", publishIn: -5 });
    const pub = await t.notice({ title: "出した", state: "published", publishIn: -60 });
    const fixed = await t.notice({ title: "直った", kind: "incident", state: "published", publishIn: -600 });
    await t.incident(fixed, "resolved", { resolved: true });
    const got = await Promise.all([draft, soon, past, pub, fixed].map(async (id) => (await rowOf(id))?.["state"]));
    expect(got).toEqual(["draft", "scheduled", "published", "published", "resolved"]);
    expect([(await rowOf(fixed))!["incident_state"], (await rowOf(pub))!["incident_state"]]).toEqual([
      "resolved",
      null,
    ]);
  });

  it("K977-API-003 絞り込み：kind=incident は障害だけ・state=draft は下書きだけ・state=published は予定を過ぎた物も入り直った物は入らない", async () => {
    const inc = await t.notice({ title: "障害", kind: "incident", state: "published", publishIn: -60 });
    await t.incident(inc, "identified");
    const rel = await t.notice({ title: "リリース下書き" });
    const past = await t.notice({ title: "予定を過ぎた 2", state: "scheduled", publishIn: -5 });
    const fixed = await t.notice({ title: "直った 2", kind: "incident", state: "published", publishIn: -60 });
    await t.incident(fixed, "resolved", { resolved: true });
    const kinds = t.mine((await list("?kind=incident")).b.data).map((x) => x["kind"]);
    expect(new Set(kinds)).toEqual(new Set(["incident"]));
    const drafts = t.mine((await list("?state=draft")).b.data);
    expect(drafts.map((x) => x["state"]).every((s) => s === "draft")).toBe(true);
    expect(drafts.map((x) => x["id"])).toContain(rel);
    const pubs = t.mine((await list("?state=published")).b.data).map((x) => x["id"]);
    expect(pubs).toEqual(expect.arrayContaining([inc, past]));
    expect(pubs).not.toContain(fixed);
  });

  it("K977-API-004 誰に：全部は { mode all, plans [], workspaces [] }・プランは鍵の並び・ワークスペースは { id, name } の並び", async () => {
    const all = await t.notice({ title: "全部" });
    const plan = await t.notice({ title: "プラン", planKeys: ["team", "business"] });
    const pick = await t.notice({ title: "選ぶ", tenantIds: [a.tenantId, b.tenantId] });
    expect((await rowOf(all))!["audience"]).toEqual({ mode: "all", plans: [], workspaces: [] });
    const p = (await rowOf(plan))!["audience"] as Json;
    expect([p["mode"], [...(p["plans"] as string[])].sort(), p["workspaces"]]).toEqual([
      "plans",
      ["business", "team"],
      [],
    ]);
    const w = (await rowOf(pick))!["audience"] as Json;
    expect(w["mode"]).toBe("workspaces");
    expect([...(w["workspaces"] as Json[])].sort((x, y) => String(x["name"]).localeCompare(String(y["name"])))).toEqual(
      [
        { id: a.tenantId, name: a.name },
        { id: b.tenantId, name: b.name },
      ].sort((x, y) => x.name.localeCompare(y.name)),
    );
  });

  it("K977-API-005 出す場所と出した人：DB の banner は band・list は list。author_name は作った運営の人の名前（無ければ null）", async () => {
    const both = await t.notice({ title: "帯と一覧", placements: ["banner", "list"], by: me });
    const none = await t.notice({ title: "作った人なし" });
    const r = (await rowOf(both))!;
    expect([[...(r["placements"] as string[])].sort(), r["author_name"]]).toEqual([["band", "list"], "運営 高本"]);
    expect((await rowOf(none))!["author_name"]).toBeNull();
  });

  it("K977-API-006 混ざらない：消したお知らせと、運営の会社でない行（顧客の会社の tenant_id）は一覧に出ない", async () => {
    const del = await t.notice({ title: "消した", deleted: true });
    const foreign = randomUUID();
    await t.f.admin.query(
      "insert into notices (id, tenant_id, kind_id, title, body, state) values ($1, $2, 'release', $3, '本文', 'published')",
      [foreign, a.tenantId, `${t.run} 顧客の会社の行`],
    );
    const ids = t.mine((await list()).b.data).map((x) => x["id"]);
    expect(ids).not.toContain(del);
    expect(ids).not.toContain(foreign);
    await t.f.admin.query("delete from notices where id = $1", [foreign]);
  });

  it("K977-API-007 守り：ログインなし 401・お知らせ（notice）を持たない運営の人は一覧も 1 件も 403", async () => {
    const id = await t.notice({ title: "守り" });
    expect((await t.call(null, "GET", "/ops/notices")).status).toBe(401);
    expect((await list("", noNotice)).r.status).toBe(403);
    expect((await one(id, noNotice)).r.status).toBe(403);
  });

  it("K977-API-008 問い合わせの値の形：kind=urgent・state=done は 422", async () => {
    expect((await list("?kind=urgent")).r.status).toBe(422);
    expect((await list("?state=done")).r.status).toBe(422);
  });

  it("K977-API-009 DB が落ちた：一覧の関数を呼べないと 503 E-PAGE-003 で題を返さない。戻すと 200", async () => {
    await t.notice({ title: "落ちる前" });
    const back = await t.breakFn("app.ops_notices(text, text, integer)");
    try {
      const { r, b: body } = await list();
      expect([r.status, body["code"]]).toEqual([503, "E-PAGE-003"]);
      expect(JSON.stringify(body)).not.toContain(t.run);
    } finally {
      await back();
    }
    expect((await list()).r.status).toBe(200);
  });

  it("K977-API-010 貯めない：一覧と 1 件の Cache-Control に private と no-store", async () => {
    const id = await t.notice({ title: "貯めない" });
    for (const r of [(await list()).r, (await one(id)).r]) {
      expect(r.headers.get("cache-control") ?? "").toContain("private");
      expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    }
  });
});

describe("K-977 1 件", () => {
  it("K977-API-011 1 件の形：200・鍵はちょうど 16・本文・メンテの時間 { from, to }・影響・障害の今の状態・続報は古い順 { state, body, at }", async () => {
    const id = await t.notice({
      title: "メンテと障害",
      kind: "incident",
      state: "published",
      publishIn: -600,
      body: "遅れています",
      maintenance: { fromIn: 3600, toIn: 7200 },
      impact: "分身の実行",
    });
    await t.incident(id, "identified");
    await t.update(id, "investigating", "調べています", -500);
    await t.update(id, "identified", "原因が分かりました", -100);
    const { r, b: body } = await one(id);
    expect(r.status, JSON.stringify(body)).toBe(200);
    const d = body.data as Json;
    expect(Object.keys(d).sort()).toEqual(OPS_NOTICE_KEYS);
    expect([d["body"], d["impact"], d["incident_state"]]).toEqual(["遅れています", "分身の実行", "identified"]);
    expect(Object.keys(d["maintenance"] as Json).sort()).toEqual(["from", "to"]);
    const ups = d["updates"] as Json[];
    expect(ups.map((u) => [u["state"], u["body"]])).toEqual([
      ["investigating", "調べています"],
      ["identified", "原因が分かりました"],
    ]);
    expect(Object.keys(ups[0]!).sort()).toEqual(["at", "body", "state"]);
  });

  it("K977-API-012 リリース：incident_state・maintenance は null・updates は []", async () => {
    const d = (await one(await t.notice({ title: "リリース" }))).b.data as Json;
    expect([d["incident_state"], d["maintenance"], d["updates"]]).toEqual([null, null, []]);
  });

  it("K977-API-013 出すと届く数：ワークスペースを選ぶ下書きは { workspaces 2, members 4 }（2 社・各 2 人）。抜けた人（status left・active でない）は数えない", async () => {
    const id = await t.notice({ title: "届く数", tenantIds: [a.tenantId, b.tenantId] });
    expect(((await one(id)).b.data as Json)["reach"]).toEqual({ workspaces: 2, members: 4 });
    const extra = await t.member(a, "抜けた人");
    await t.f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [extra.id]);
    expect(((await one(id)).b.data as Json)["reach"]).toEqual({ workspaces: 2, members: 4 });
  });

  it("K977-API-014 全部向けの届く数：この回の 2 社を含む数（2 以上）・運営の会社は数えない（運営の会社と 1 社を選ぶと 1 社）", async () => {
    // 共用の DB でほかの試験が同じ間に会社を作る・消すので、全社の数とは比べない
    const id = await t.notice({ title: "全部の届く数" });
    const reach = ((await one(id)).b.data as Json)["reach"] as { workspaces: number; members: number };
    expect(reach.workspaces).toBeGreaterThanOrEqual(2);
    const withOps = await t.notice({ title: "運営の会社を含む", tenantIds: [OPS_TENANT, a.tenantId] });
    expect(((await one(withOps)).b.data as Json)["reach"]).toEqual({ workspaces: 1, members: 2 });
  });

  it("K977-API-015 見えない 1 件：消した・無い id・顧客の会社の行は 404 で field・details・detail が無い", async () => {
    const del = await t.notice({ title: "消した 1 件", deleted: true });
    const foreign = randomUUID();
    await t.f.admin.query(
      "insert into notices (id, tenant_id, kind_id, title, body) values ($1, $2, 'release', $3, '本文')",
      [foreign, a.tenantId, `${t.run} 顧客の 1 件`],
    );
    for (const id of [del, randomUUID(), foreign]) {
      const { r, b: body } = await one(id);
      expect(r.status).toBe(404);
      expect(isFlat(body)).toBe(true);
    }
    await t.f.admin.query("delete from notices where id = $1", [foreign]);
  });

  it("K977-API-016 読むだけ：一覧と 1 件を開いても運営の記録・会社の記録・既読の行は増えない", async () => {
    const id = await t.notice({ title: "読むだけ", tenantIds: [a.tenantId] });
    const count = () =>
      Promise.all([
        t.n("select count(*) as n from ops_audit_events where target_type = 'notices' and target_id = $1", [id]),
        t.n("select count(*) as n from notice_deliveries where notice_id = $1", [id]),
      ]);
    const before = await count();
    await list();
    await one(id);
    expect(await count()).toEqual(before);
  });
});

describe("K-977 DB", () => {
  it("K977-DB-001 関数 3 つ（ops_notice_detail・ops_notices・notice_audience_ok）は security definer・kaname_app は呼べ、PUBLIC は呼べない", async () => {
    const r = await t.f.admin.query<{ name: string; definer: boolean; app: boolean; pub: boolean }>(
      `select p.proname as name, p.prosecdef as definer,
              has_function_privilege('kaname_app', p.oid, 'execute') as app,
              exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where a.grantee = 0 and a.privilege_type = 'EXECUTE') as pub
         from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'app' and p.proname in ('ops_notice_detail', 'ops_notices', 'notice_audience_ok')
        order by p.proname`,
    );
    expect(r.rows.map((x) => x.name)).toEqual(["notice_audience_ok", "ops_notice_detail", "ops_notices"]);
    for (const x of r.rows) expect([x.definer, x.app, x.pub]).toEqual([true, true, false]);
  });

  it("K977-DB-002 2 層目：会社の人の文脈で一覧・1 件の関数を呼ぶと 42501", async () => {
    const ctx = { tenantId: a.tenantId, userId: a.admin.id, role: "member" as const, stepUpAt: null };
    for (const sql of ["select app.ops_notices(null, null, 10)", `select app.ops_notice_detail('${randomUUID()}')`]) {
      await expect(withTenant(t.f.pool, ctx as never, (cl) => cl.query(sql))).rejects.toMatchObject({ code: "42501" });
    }
  });

  it("K977-DB-003 届け先の決めは 1 か所のまま：notice_for_tenant は出したワークスペース向けを相手の会社にだけ true（誰にの所を notice_audience_ok に寄せた後も K-954 と同じ）", async () => {
    const id = await t.notice({ title: "決めは 1 か所", state: "published", publishIn: -60, tenantIds: [a.tenantId] });
    const q = (tenant: string) =>
      t.row<{ ok: boolean }>("select app.notice_for_tenant($1, $2) as ok", [id, tenant]).then((x) => x!.ok);
    expect([await q(a.tenantId), await q(b.tenantId)]).toEqual([true, false]);
    const draft = await t.notice({ title: "下書きは届かない", tenantIds: [a.tenantId] });
    expect(
      (await t.row<{ ok: boolean; aud: boolean }>(
        "select app.notice_for_tenant($1, $2) as ok, app.notice_audience_ok($1, $2) as aud",
        [draft, a.tenantId],
      ))!,
    ).toEqual({ ok: false, aud: true });
  });

  it("K977-DB-004 止めている会社は届け先から外す（D-156.82）：止めた会社と止める日が今日の会社は notice_audience_ok も notice_for_tenant も false・止める日が明日の会社は両方 true・3 社を選んだ下書きの届く数は { workspaces 1, members 2 }", async () => {
    const stopped = await t.ws("止めた会社", { members: 2 });
    const today = await t.ws("今日止まる会社", { members: 2 });
    const soon = await t.ws("明日止まる会社", { members: 2 });
    const jst = "(now() at time zone 'Asia/Tokyo')::date";
    await t.f.admin.query(
      `update tenants set stopped_at = now(), stop_on = ${jst}, stop_reason_key = 'unpaid' where id = $1`,
      [stopped.tenantId],
    );
    await t.f.admin.query(`update tenants set stop_on = ${jst}, stop_reason_key = 'unpaid' where id = $1`, [
      today.tenantId,
    ]);
    await t.f.admin.query(`update tenants set stop_on = ${jst} + 1, stop_reason_key = 'unpaid' where id = $1`, [
      soon.tenantId,
    ]);
    const tenants = [stopped.tenantId, today.tenantId, soon.tenantId];
    const pub = await t.notice({ title: "止めている会社に", state: "published", publishIn: -60, tenantIds: tenants });
    const q = async (tenant: string) =>
      (await t.row<{ ok: boolean; aud: boolean }>(
        "select app.notice_for_tenant($1, $2) as ok, app.notice_audience_ok($1, $2) as aud",
        [pub, tenant],
      ))!;
    expect([await q(stopped.tenantId), await q(today.tenantId), await q(soon.tenantId)]).toEqual([
      { ok: false, aud: false },
      { ok: false, aud: false },
      { ok: true, aud: true },
    ]);
    const draft = await t.notice({ title: "止めている会社の届く数", tenantIds: tenants });
    expect(((await one(draft)).b.data as Json)["reach"]).toEqual({ workspaces: 1, members: 2 });
  });
});
