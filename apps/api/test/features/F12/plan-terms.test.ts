// K-1017「決めた値段の版を請求とプランの選びに効かせる」の単体の試験（本物の DB・本物の入口・偽のログイン・土台 ops-plans.harness.ts＝K-987）。
// テストの名前の頭の行 ID（K1017-…）は 11_tickets/K-1017.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
// 版の行は DB に直に置く（決める口を通さない準備）。プランの今の版・版の行は土台が afterAll で元に戻す（G-10）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import { STEP, startOpsPlans, type OpsPlans, type PlanKey } from "./ops-plans.harness.js";

let t: OpsPlans;
let ops: Person;
beforeAll(async () => {
  t = await startOpsPlans("k1017", ["plans", "ops-invoices-issue", "ops-workspace-billing"]);
  ops = await t.ops("お金の木村", ["money", "plan_propose", "plan_decide"]);
});
afterAll(async () => t?.close());

const day = async (sql: string) => (await t.row<{ d: string }>(`select to_char((${sql})::date, 'YYYY-MM-DD') as d`))!.d;
const TODAY = "(now() at time zone 'Asia/Tokyo')::date";
const NEXT_MONTH = `date_trunc('month', ${TODAY}) + interval '1 month'`;
const LAST_MONTH = `date_trunc('month', ${TODAY}) - interval '1 month'`;
/** そのプランに版を 1 つ足す（今の版＋1）。決めた案を 1 つ作って結ぶ */
const addVersion = async (
  key: PlanKey,
  o: { price: number; members: number; existingFrom: string | null; newFrom?: string | null; releasedAgoDays?: number },
) => {
  const p = await t.plan(key);
  const proposal = await t.proposal({
    plan: key,
    by: ops,
    state: "decided",
    decidedBy: ops,
    price: o.price,
    members: o.members,
  });
  const version = p.version + 1;
  await t.f.admin.query(
    `insert into plan_versions (plan_id, version, snapshot, released_at, price_monthly, member_limit, new_from, existing_from, proposal_id, decided_by)
     values ($1, $2, $3, now() - make_interval(days => $10::int), $4, $5, $6::date, $7::date, $8, $9)`,
    [
      p.id,
      version,
      { price_monthly: o.price, member_limit: o.members },
      o.price,
      o.members,
      o.newFrom ?? null,
      o.existingFrom,
      proposal,
      ops.id,
      o.releasedAgoDays ?? 0,
    ],
  );
  await t.f.admin.query("update plans set current_version = $2 where id = $1", [p.id, version]);
  return { planId: p.id, version, base: p };
};
const terms = async (planId: string, tenantId: string, d: string) =>
  (await t.row<{ x: { version: number; price_monthly: number; member_limit: number } }>(
    "select app.plan_terms($1, $2, $3::date) as x",
    [planId, tenantId, d],
  ))!.x;
/** この回の案に結んだ版の行だけを外す（ほかの試験が残した版の行は消さない・共用の DB）。今の版は残った行の最新に戻す */
const dropVersions = async (key: PlanKey) => {
  const p = await t.plan(key);
  await t.f.admin.query(
    "delete from plan_versions where plan_id = $1 and proposal_id in (select id from ops_plan_proposals where reason like $2)",
    [p.id, `${t.run}%`],
  );
  await t.f.admin.query(
    "update plans set current_version = coalesce((select max(version) from plan_versions where plan_id = $1), 1) where id = $1",
    [p.id],
  );
};

describe("K-1017 効いている版の決め", () => {
  it("K1017-DB-001 版の行が無い：プランの price_monthly と limits の members・version は今の版", async () => {
    await dropVersions("free");
    const p = await t.plan("free");
    const w = await t.ws("無料の会社", { plan: "free" });
    expect(await terms(p.id, w.tenantId, await day(TODAY))).toEqual({
      version: p.version,
      price_monthly: p.price,
      member_limit: p.members,
    });
  });

  it("K1017-DB-002 値上げの版：前からの会社は今日と前の日は版 1・変わる月の 1 日からは版 2", async () => {
    await dropVersions("team");
    const w = await t.ws("前からのチーム");
    const next = await day(NEXT_MONTH);
    const v = await addVersion("team", { price: 18000, members: 12, existingFrom: next });
    expect((await terms(v.planId, w.tenantId, await day(TODAY))).price_monthly).toBe(v.base.price);
    expect((await terms(v.planId, w.tenantId, await day(`${NEXT_MONTH} - interval '1 day'`))).price_monthly).toBe(
      v.base.price,
    );
    expect(await terms(v.planId, w.tenantId, next)).toEqual({
      version: v.version,
      price_monthly: 18000,
      member_limit: 12,
    });
  });

  it("K1017-DB-003 ずっと今の値段：20 日前に決めた版 2（new_from は 10 日前）は、前からの会社にはいつまでも版 1・new_from より後に始めた会社には版 2", async () => {
    await dropVersions("business");
    const old = await t.ws("前からのビジネス", { plan: "business" });
    const fresh = await t.ws("後からのビジネス", { plan: "business" });
    const v = await addVersion("business", {
      price: 45000,
      members: 30,
      existingFrom: null,
      newFrom: await day(`${TODAY} - interval '10 days'`),
      releasedAgoDays: 20,
    });
    await t.f.admin.query("update subscriptions set started_at = now() - interval '1 day' where tenant_id = $1", [
      fresh.tenantId,
    ]);
    const far = await day(`${TODAY} + interval '400 days'`);
    expect((await terms(v.planId, old.tenantId, far)).price_monthly).toBe(v.base.price);
    expect((await terms(v.planId, fresh.tenantId, await day(TODAY))).price_monthly).toBe(45000);
  });

  it("K1017-DB-004 新しく入る人の日が先：今日始めた会社は版 1・new_from の日に始めた会社は版 2", async () => {
    await dropVersions("team");
    const today = await t.ws("今日始めたチーム");
    const later = await t.ws("10 日後に始めるチーム");
    await t.f.admin.query("update subscriptions set started_at = now() where tenant_id = $1", [today.tenantId]);
    await t.f.admin.query("update subscriptions set started_at = now() + interval '10 days' where tenant_id = $1", [
      later.tenantId,
    ]);
    const v = await addVersion("team", {
      price: 18000,
      members: 12,
      existingFrom: await day(`${TODAY} + interval '200 days'`),
      newFrom: await day(`${TODAY} + interval '10 days'`),
    });
    const d = await day(`${TODAY} + interval '20 days'`);
    expect((await terms(v.planId, today.tenantId, d)).price_monthly).toBe(v.base.price);
    expect((await terms(v.planId, later.tenantId, d)).price_monthly).toBe(18000);
  });

  it("K1017-DB-008 new_from が決めた日より前：今日決めた版 2（new_from は 30 日前）は、10 日前に始めた会社には版 1・今日始めた会社には版 2", async () => {
    await dropVersions("team");
    const before = await t.ws("10 日前に始めたチーム");
    const fresh = await t.ws("今日始めたチーム");
    await t.f.admin.query("update subscriptions set started_at = now() - interval '10 days' where tenant_id = $1", [
      before.tenantId,
    ]);
    await t.f.admin.query("update subscriptions set started_at = now() where tenant_id = $1", [fresh.tenantId]);
    const v = await addVersion("team", {
      price: 18000,
      members: 12,
      existingFrom: null,
      newFrom: await day(`${TODAY} - interval '30 days'`),
    });
    const today = await day(TODAY);
    expect((await terms(v.planId, before.tenantId, today)).price_monthly).toBe(v.base.price);
    expect((await terms(v.planId, fresh.tenantId, today)).price_monthly).toBe(18000);
  });

  it("K1017-DB-005 2 つの版：版 2・版 3 がどちらも効く日は版 3", async () => {
    await dropVersions("team");
    const w = await t.ws("2 つの版のチーム");
    const last = await day(LAST_MONTH);
    await addVersion("team", { price: 18000, members: 12, existingFrom: last });
    const v3 = await addVersion("team", { price: 17000, members: 12, existingFrom: last });
    expect(await terms(v3.planId, w.tenantId, await day(TODAY))).toEqual({
      version: v3.version,
      price_monthly: 17000,
      member_limit: 12,
    });
  });

  it("K1017-DB-006 関数の権限：kaname_app は app.plan_terms を呼べる・PUBLIC は呼べない", async () => {
    const r = await t.row<{ app: boolean; pub: boolean }>(
      `select has_function_privilege('kaname_app', 'app.plan_terms(uuid, uuid, date)', 'execute') as app,
              has_function_privilege('public', 'app.plan_terms(uuid, uuid, date)', 'execute') as pub`,
    );
    expect([r?.app, r?.pub]).toEqual([true, false]);
  });
});

describe("K-1017 口に効く", () => {
  it("K1017-API-001 選べるプランと変わる：いまのプランの行は今日の版の値段・upcoming に版 2・ほかの行は null。版が無い会社は null", async () => {
    await dropVersions("team");
    const w = await t.ws("変わるチーム");
    const before = await t.act(w.admin, "GET", "/workspace/plans");
    expect(before.status, await before.clone().text()).toBe(200);
    const rows0 = ((await t.json(before)).data ?? []) as Record<string, unknown>[];
    expect(rows0.find((x) => x["current"] === true)!["upcoming"]).toBeNull();
    const next = await day(NEXT_MONTH);
    const v = await addVersion("team", { price: 18000, members: 12, existingFrom: next });
    const rows = ((await t.json(await t.act(w.admin, "GET", "/workspace/plans"))).data ?? []) as Record<
      string,
      unknown
    >[];
    const cur = rows.find((x) => x["current"] === true)!;
    expect(cur["plan_key"]).toBe("team");
    expect(cur["price_monthly"]).toBe(v.base.price);
    expect(cur["upcoming"]).toEqual({
      price_monthly: 18000,
      member_limit: 12,
      from_month: next.slice(0, 7),
      noticed_on: await day(TODAY),
    });
    for (const x of rows.filter((y) => y["current"] !== true)) expect(x["upcoming"]).toBeNull();
  });

  it("K1017-API-002 請求書の下書き：先月の 1 日から効く版 2 の会社は先月分の amount が版 2・版の無いプランの会社は前と同じ", async () => {
    await dropVersions("team");
    await dropVersions("business");
    const team = await t.ws("請求のチーム");
    const biz = await t.ws("請求のビジネス", { plan: "business" });
    await t.f.admin.query(
      "update subscriptions set started_at = now() - interval '90 days' where tenant_id = any($1::uuid[])",
      [[team.tenantId, biz.tenantId]],
    );
    const bizPrice = (await t.plan("business")).price;
    await addVersion("team", { price: 18000, members: 12, existingFrom: await day(LAST_MONTH) });
    const month = (await day(LAST_MONTH)).slice(0, 7);
    const r = await t.act(ops, "POST", "/ops/invoices/issue", { month, dry_run: true }, { stepUpAgoSec: STEP });
    expect(r.status, await r.clone().text()).toBe(201);
    const lines = (((await t.json(r)).data as Record<string, unknown>)["lines"] ?? []) as Record<string, unknown>[];
    const of = (id: string) => lines.find((x) => (x["workspace"] as Record<string, unknown>)["id"] === id)!;
    expect(of(team.tenantId)["amount"]).toBe(18000);
    expect(of(biz.tenantId)["amount"]).toBe(bizPrice);
  });

  it("K1017-API-003 人数の上限：今日始めるならのチームが 12 人まで（版 2）なら、11 人のビジネスの会社はチームへ変えられる（plans は 10 人のまま）", async () => {
    await dropVersions("team");
    const w = await t.ws("11 人のビジネス", { plan: "business", members: 11 });
    await addVersion("team", {
      price: 18000,
      members: 12,
      existingFrom: null,
      newFrom: await day(`${TODAY} - interval '1 day'`),
    });
    expect((await t.plan("team")).members).toBe(10);
    const r = await t.act(w.admin, "POST", "/workspace/plan", { plan_key: "team" }, { stepUpAgoSec: STEP });
    expect(r.status, await r.clone().text()).toBe(200);
  });

  it("K1017-API-004 上げる日割りを版の値段で：今のチーム（版 2＝18,000）からビジネス（今日始めるなら版 2＝22,000）へ。一覧の upgrade.amount＝plan_prorate(4000)＝答えと頼みの行の prorated_amount", async () => {
    await dropVersions("team");
    await dropVersions("business");
    const w = await t.ws("版で上げるチーム");
    await t.f.admin.query("update subscriptions set started_at = now() - interval '90 days' where tenant_id = $1", [
      w.tenantId,
    ]);
    await addVersion("team", { price: 18000, members: 12, existingFrom: await day(LAST_MONTH) });
    const yesterday = await day(`${TODAY} - interval '1 day'`);
    await addVersion("business", { price: 22000, members: 30, existingFrom: null, newFrom: yesterday });
    const want = (await t.row<{ a: number }>("select app.plan_prorate(4000) as a"))!.a;
    const list = ((await t.json(await t.act(w.admin, "GET", "/workspace/plans"))).data ?? []) as Record<
      string,
      unknown
    >[];
    const biz = list.find((x) => x["plan_key"] === "business")!;
    expect([
      biz["price_monthly"],
      biz["effective_from"],
      (biz["upgrade"] as Record<string, unknown>)["amount"],
    ]).toEqual([22000, await day(TODAY), want]);
    const r = await t.act(w.admin, "POST", "/workspace/plan", { plan_key: "business" }, { stepUpAgoSec: STEP });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(((await t.json(r)).data as Record<string, unknown>)["prorated_amount"]).toBe(want);
    const req = await t.row<{ status_id: string; prorated_amount: number }>(
      "select status_id, prorated_amount from plan_change_requests where tenant_id = $1 and deleted_at is null order by created_at desc limit 1",
      [w.tenantId],
    );
    expect([req?.status_id, req?.prorated_amount]).toEqual(["applied", want]);
  });

  it("K1017-API-005 上げる・下げるの判定を版の値段で：今のチーム（15,000・版なし）からビジネス（今日始めるなら版 2＝12,000）は下げる＝来月 1 日・日割り 0・今日はチームのまま", async () => {
    await dropVersions("team");
    await dropVersions("business");
    const w = await t.ws("版で下げるチーム");
    await t.f.admin.query("update subscriptions set started_at = now() - interval '90 days' where tenant_id = $1", [
      w.tenantId,
    ]);
    const yesterday = await day(`${TODAY} - interval '1 day'`);
    await addVersion("business", { price: 12000, members: 30, existingFrom: null, newFrom: yesterday });
    const next = await day(NEXT_MONTH);
    const list = ((await t.json(await t.act(w.admin, "GET", "/workspace/plans"))).data ?? []) as Record<
      string,
      unknown
    >[];
    const biz = list.find((x) => x["plan_key"] === "business")!;
    expect([biz["price_monthly"], biz["effective_from"], biz["upgrade"]]).toEqual([12000, next, null]);
    const r = await t.act(w.admin, "POST", "/workspace/plan", { plan_key: "business" }, { stepUpAgoSec: STEP });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect([d["effective_from"], d["prorated_amount"]]).toEqual([next, 0]);
    const now = await t.row<{ status_id: string; key: string }>(
      `select (select status_id from plan_change_requests where tenant_id = $1 and deleted_at is null order by created_at desc limit 1) as status_id,
              (select key from plans where id = app.tenant_plan_id($1)) as key`,
      [w.tenantId],
    );
    expect([now?.status_id, now?.key]).toEqual(["scheduled", "team"]);
  });

  it("K1017-API-006 運営が見る 1 社：先月 1 日から効くチームの版 2（18,000・12 人）の会社は plan.price_monthly 18000・members.limit 12。版の無いプランの会社は前と同じ", async () => {
    await dropVersions("team");
    await dropVersions("business");
    const team = await t.ws("運営が見るチーム");
    const biz = await t.ws("運営が見るビジネス", { plan: "business" });
    await t.f.admin.query(
      "update subscriptions set started_at = now() - interval '90 days' where tenant_id = any($1::uuid[])",
      [[team.tenantId, biz.tenantId]],
    );
    await addVersion("team", { price: 18000, members: 12, existingFrom: await day(LAST_MONTH) });
    expect((await t.plan("team")).members).toBe(10);
    const read = async (id: string) => {
      const r = await t.act(ops, "GET", `/ops/workspaces/${id}/billing`);
      expect(r.status, await r.clone().text()).toBe(200);
      const d = (await t.json(r)).data as Record<string, Record<string, unknown>>;
      return [d["plan"]!["price_monthly"], d["members"]!["limit"]];
    };
    expect(await read(team.tenantId)).toEqual([18000, 12]);
    const b = await t.plan("business");
    expect(await read(biz.tenantId)).toEqual([b.price, b.members]);
  });

  it("K1017-DB-007 招くときの席：前からのチーム（社内 10 人）に昨日から効く版 2（12 人）を置くと、その会社の文脈で app.seat_check(1) が通る", async () => {
    await dropVersions("team");
    const w = await t.ws("10 人のチーム", { plan: "team", members: 10 });
    const yesterday = await day(`${TODAY} - interval '1 day'`);
    await addVersion("team", { price: 18000, members: 12, existingFrom: yesterday, newFrom: yesterday });
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'admin', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await expect(c.query("select app.seat_check(1)")).resolves.toBeDefined();
    } finally {
      await c.query("rollback");
      c.release();
    }
  });
});
