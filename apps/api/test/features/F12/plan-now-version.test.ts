// K-1157「すぐ効くの判定と影響の今の値段を会社ごとの版の値で決め、案に無い値は元の版から引き継ぎ、運営の一覧も今の版の値で読む」の単体の試験（本物の DB・本物の入口・偽のログイン・土台 ops-plans.harness.ts＝K-987）。
// テストの名前の頭の行 ID（K1157-…）は 11_tickets/K-1157.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
// 前の版の行は DB に直に置く（決める口を通さない準備）。プランの今の版・版の行は土台が afterAll で元に戻す（G-10）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import {
  OPS_TENANT,
  PLANS_PATH,
  PROPOSALS,
  STEP,
  startOpsPlans,
  type OpsPlans,
  type PlanKey,
} from "./ops-plans.harness.js";

let t: OpsPlans;
let proposer: Person;
let decider: Person;
beforeAll(async () => {
  t = await startOpsPlans("k1157", ["ops-plans-read", "ops-plans-impact", "ops-plans-decide"]);
  proposer = await t.ops("案の佐野", ["plan_propose"]);
  decider = await t.ops("決める高本", ["plan_decide"]);
});
afterAll(async () => t?.close());

const NOTICE = "チームプランの料金を改めます。それまでは今の料金のままです。";
const TODAY = "(now() at time zone 'Asia/Tokyo')::date";
const nextMonthDay = async () =>
  (await t.row<{ d: string }>(`select to_char(date_trunc('month', ${TODAY}) + interval '1 month', 'YYYY-MM-DD') as d`))!
    .d;
const after90 = async () =>
  (await t.row<{ d: string }>(
    `select to_char(app.plan_existing_from('after_days', 90, false, ${TODAY}), 'YYYY-MM-DD') as d`,
  ))!.d;

/** この回の案に結んだ版の行だけを外し、今の版を残った行の最新に戻す（共用の DB） */
const dropVersions = async (key: PlanKey) => {
  const p = await t.plan(key);
  await t.f.admin.query(
    "update ops_plan_proposals set deleted_at = now() where plan_id = $1 and state in ('draft','waiting') and deleted_at is null",
    [p.id],
  );
  await t.f.admin.query(
    "delete from plan_versions where plan_id = $1 and proposal_id in (select id from ops_plan_proposals where reason like $2)",
    [p.id, `${t.run}%`],
  );
  await t.f.admin.query(
    "update plans set current_version = coalesce((select max(version) from plan_versions where plan_id = $1), 1) where id = $1",
    [p.id],
  );
};
/** そのプランに決めた版を 1 つ足して今の版にする（プランの列は変えない）。keep は existing_from null（前からの会社は前の版のまま）・既定は先月 1 日から前からの会社にも */
const addVersion = async (key: PlanKey, price: number, members: number, o: { keep?: boolean } = {}) => {
  const p = await t.plan(key);
  const proposal = await t.proposal({ plan: key, by: proposer, state: "decided", decidedBy: decider, price, members });
  const version = p.version + 1;
  await t.f.admin.query(
    `insert into plan_versions (plan_id, version, snapshot, released_at, price_monthly, member_limit, new_from, existing_from, proposal_id, decided_by)
     values ($1, $2, $3, now() - interval '40 days', $4, $5, null,
             case when $8::boolean then null else (date_trunc('month', ${TODAY}) - interval '1 month')::date end, $6, $7)`,
    [
      p.id,
      version,
      { price_monthly: price, member_limit: members },
      price,
      members,
      proposal,
      decider.id,
      o.keep ?? false,
    ],
  );
  await t.f.admin.query("update plans set current_version = $2 where id = $1", [p.id, version]);
  return { planId: p.id, version, base: p };
};
/** 案の changes から 1 つの鍵を外す（人数だけ・値段だけの案） */
const dropChange = (id: string, key: "price_monthly" | "member_limit") =>
  t.f.admin.query("update ops_plan_proposals set changes = changes - $2::text where id = $1", [id, key]);
const impactOf = async (id: string) => {
  const r = await t.act(decider, "GET", `${PROPOSALS}/${id}/impact`);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await t.json(r)).data as Record<string, unknown>;
};
const rowOf = (d: Record<string, unknown>, tenantId: string) =>
  ((d["by_workspace"] ?? []) as Record<string, unknown>[]).find(
    (x) => (x["workspace"] as Record<string, unknown>)["id"] === tenantId,
  )!;
const decide = async (id: string) => {
  const r = await t.act(decider, "POST", `${PROPOSALS}/${id}/decide`, { notice_body: NOTICE }, { stepUpAgoSec: STEP });
  expect(r.status, await r.clone().text()).toBe(200);
};
const versionRow = (planId: string, version: number) =>
  t.row<{ ef: string | null; price_monthly: number; member_limit: number }>(
    "select to_char(existing_from, 'YYYY-MM-DD') as ef, price_monthly, member_limit from plan_versions where plan_id = $1 and version = $2",
    [planId, version],
  );

describe("K-1157 元の版の値", () => {
  it("K1157-DB-001 元の版の値：版 2 の行の値。無い版はプランの price_monthly と limits の members", async () => {
    await dropVersions("team");
    const v = await addVersion("team", 18000, 12);
    const of = async (version: number) =>
      (await t.row<{ x: { price_monthly: number; member_limit: number } }>(
        "select app.plan_version_terms($1, $2) as x",
        [v.planId, version],
      ))!.x;
    expect(await of(v.version)).toEqual({ price_monthly: 18000, member_limit: 12 });
    expect(await of(v.version + 5)).toEqual({ price_monthly: v.base.price, member_limit: v.base.members });
  });

  it("K1157-DB-002 関数の権限：kaname_app も PUBLIC も app.plan_version_terms・app.plan_immediate を呼べない", async () => {
    const r = await t.row<{ a1: boolean; p1: boolean; a2: boolean; p2: boolean }>(
      `select has_function_privilege('kaname_app', 'app.plan_version_terms(uuid, integer)', 'execute') as a1,
              has_function_privilege('public', 'app.plan_version_terms(uuid, integer)', 'execute') as p1,
              has_function_privilege('kaname_app', 'app.plan_immediate(uuid, integer, integer, integer, date)', 'execute') as a2,
              has_function_privilege('public', 'app.plan_immediate(uuid, integer, integer, integer, date)', 'execute') as p2`,
    );
    expect([r?.a1, r?.p1, r?.a2, r?.p2]).toEqual([false, false, false, false]);
  });

  it("K1157-DB-003 いまの顧客が居ないプラン：元の版（15,000 円・10 人）と比べる。14,000・10 人は true・16,000 は false・9 人は false", async () => {
    const id = (await t.row<{ id: string }>(
      // 消した印つきで置く（共用の DB で同時に流れるほかの試験のプランの一覧に出さない）
      "insert into plans (tenant_id, key, name, price_monthly, limits, deleted_at) values ($1, $2, $3, 15000, $4, now()) returning id",
      [OPS_TENANT, `${t.run}-empty`.slice(0, 60), "顧客の居ないプラン", { members: 10 }],
    ))!.id;
    try {
      const imm = async (price: number, members: number) =>
        (await t.row<{ x: boolean }>(`select app.plan_immediate($1, 1, $2, $3, ${TODAY}) as x`, [id, price, members]))!
          .x;
      expect([await imm(14000, 10), await imm(16000, 10), await imm(14000, 9)]).toEqual([true, false, false]);
    } finally {
      await t.f.admin.query("delete from plan_versions where plan_id = $1", [id]);
      await t.f.admin.query("delete from plans where id = $1", [id]);
    }
  });

  it("K1157-DB-004 人数の上限の無いプラン：plan_version_terms の member_limit は null（0 でない）・price_monthly は 15000", async () => {
    const id = (await t.row<{ id: string }>(
      // 消した印つきで置く（共用の DB で同時に流れるほかの試験のプランの一覧に出さない）
      "insert into plans (tenant_id, key, name, price_monthly, limits, deleted_at) values ($1, $2, $3, 15000, $4, now()) returning id",
      [OPS_TENANT, `${t.run}-nolimit`.slice(0, 60), "上限の無いプラン", {}],
    ))!.id;
    try {
      expect((await t.row<{ x: unknown }>("select app.plan_version_terms($1, 99) as x", [id]))!.x).toEqual({
        price_monthly: 15000,
        member_limit: null,
      });
    } finally {
      await t.f.admin.query("delete from plan_versions where plan_id = $1", [id]);
      await t.f.admin.query("delete from plans where id = $1", [id]);
    }
  });
});

describe("K-1157 影響の口", () => {
  it("K1157-API-001 版 2（18,000 円・12 人）の後の 16,000 円の案：immediate true・existing_from は来月・会社の行の now_price 18000・after_price 16000", async () => {
    await dropVersions("team");
    const w = await t.ws("版 2 の後に下げるチーム");
    await addVersion("team", 18000, 12);
    const id = await t.proposal({ plan: "team", by: proposer, state: "waiting", price: 16000, members: 12 });
    const d = await impactOf(id);
    expect([d["immediate"], d["existing_from"]]).toEqual([true, (await nextMonthDay()).slice(0, 7)]);
    const row = rowOf(d, w.tenantId);
    expect([row["now_price"], row["after_price"]]).toEqual([18000, 16000]);
  });

  it("K1157-API-002 版 2 で 12,000 円に下げた後の 13,000 円の案（90 日）：immediate false・existing_from は 90 日の決めの月", async () => {
    await dropVersions("team");
    await addVersion("team", 12000, 10);
    const id = await t.proposal({ plan: "team", by: proposer, state: "waiting", price: 13000, members: 10, days: 90 });
    const d = await impactOf(id);
    expect([d["immediate"], d["existing_from"]]).toEqual([false, (await after90()).slice(0, 7)]);
  });

  it("K1157-API-003 版 2 で 12 人に増やした後の 11 人・14,000 円の案：immediate false", async () => {
    await dropVersions("team");
    await addVersion("team", 15000, 12);
    const id = await t.proposal({ plan: "team", by: proposer, state: "waiting", price: 14000, members: 11, days: 90 });
    expect((await impactOf(id))["immediate"]).toBe(false);
  });

  it("K1157-API-006 版の行が種だけ：今の値段−1,000 円の案は immediate true・existing_from は来月・会社の行の now_price はプランの値段", async () => {
    await dropVersions("business");
    const w = await t.ws("種だけのビジネス", { plan: "business" });
    const biz = await t.plan("business");
    const id = await t.proposal({
      plan: "business",
      by: proposer,
      state: "waiting",
      price: biz.price - 1000,
      members: biz.members,
    });
    const d = await impactOf(id);
    expect([d["immediate"], d["existing_from"], rowOf(d, w.tenantId)["now_price"]]).toEqual([
      true,
      (await nextMonthDay()).slice(0, 7),
      biz.price,
    ]);
  });

  it("K1157-API-011 値上げを決めて効いた後に影響を見ても、決めた日の値で：immediate false・existing_from は版の行の月・その会社の now_price 15000・売上の差は行の和で 3,000 以上", async () => {
    await dropVersions("team");
    const old = await t.ws("決めて効いた後のチーム");
    await t.f.admin.query("update subscriptions set started_at = now() - interval '200 days' where tenant_id = $1", [
      old.tenantId,
    ]);
    const base = await t.plan("team");
    const id = await t.proposal({
      plan: "team",
      by: proposer,
      state: "waiting",
      price: 18000,
      members: base.members,
      days: 90,
    });
    await decide(id);
    // 決めた日を 150 日前に置き直し、版の行をその日に決めた形（変わる月は今日より前＝いまの顧客に効いた後）にする
    await t.f.admin.query("update ops_plan_proposals set decided_at = now() - interval '150 days' where id = $1", [id]);
    await t.f.admin.query(
      `update plan_versions set released_at = now() - interval '150 days',
              existing_from = app.plan_existing_from('after_days', 90, false, (${TODAY} - interval '150 days')::date)
        where plan_id = $1 and version = $2`,
      [base.id, base.version + 1],
    );
    const ef = (await versionRow(base.id, base.version + 1))!.ef!;
    expect(ef <= (await t.row<{ d: string }>(`select to_char(${TODAY}, 'YYYY-MM-DD') as d`))!.d).toBe(true);
    const d = await impactOf(id);
    expect([d["immediate"], d["existing_from"]]).toEqual([false, ef.slice(0, 7)]);
    const row = rowOf(d, old.tenantId);
    expect([row["now_price"], row["after_price"]]).toEqual([15000, 18000]);
    const live = ((d["by_workspace"] ?? []) as Record<string, unknown>[]).filter((x) => x["stopped"] !== true);
    const sum = live.reduce((a, x) => a + Number(x["after_price"]) - Number(x["now_price"]), 0);
    expect(d["monthly_revenue_diff"]).toBe(sum);
    expect(sum).toBeGreaterThanOrEqual(3000);
  });
});

describe("K-1157 決める口", () => {
  it("K1157-API-004 版 2（18,000 円）の後の 16,000 円の案を決めると、できた版の existing_from は来月 1 日・16000・12 人", async () => {
    await dropVersions("team");
    const v = await addVersion("team", 18000, 12);
    const id = await t.proposal({ plan: "team", by: proposer, state: "waiting", price: 16000, members: 12 });
    await decide(id);
    expect(await versionRow(v.planId, v.version + 1)).toEqual({
      ef: await nextMonthDay(),
      price_monthly: 16000,
      member_limit: 12,
    });
  });

  it("K1157-API-005 版 2 で 12,000 円に下げた後の 13,000 円の案（90 日）を決めると、できた版の existing_from は 90 日の決めの日（来月 1 日ではない）・13000", async () => {
    await dropVersions("team");
    const v = await addVersion("team", 12000, 10);
    const id = await t.proposal({ plan: "team", by: proposer, state: "waiting", price: 13000, members: 10, days: 90 });
    await decide(id);
    const row = await versionRow(v.planId, v.version + 1);
    expect([row?.ef, row?.price_monthly]).toEqual([await after90(), 13000]);
    expect(row?.ef).not.toBe(await nextMonthDay());
  });
});

describe("K-1157 前からの会社・案に無い値・一覧", () => {
  it("K1157-API-007 keep の版 2（18,000 円）の後の 16,000 円の案：15,000 円を払う前からの会社があると immediate false・その行の now_price 15000。決めると existing_from は 90 日の決めの日", async () => {
    await dropVersions("team");
    const old = await t.ws("前から 15,000 円のチーム");
    await t.f.admin.query("update subscriptions set started_at = now() - interval '90 days' where tenant_id = $1", [
      old.tenantId,
    ]);
    const v = await addVersion("team", 18000, 12, { keep: true });
    const id = await t.proposal({ plan: "team", by: proposer, state: "waiting", price: 16000, members: 12, days: 90 });
    const d = await impactOf(id);
    expect([d["immediate"], rowOf(d, old.tenantId)["now_price"]]).toEqual([false, 15000]);
    await decide(id);
    expect((await versionRow(v.planId, v.version + 1))?.ef).toBe(await after90());
  });

  it("K1157-API-008 人数だけの案（14 人）：影響の after_price は版 2 の 18000・決めると版の行は 18000・14 人", async () => {
    await dropVersions("team");
    const w = await t.ws("人数だけのチーム");
    const v = await addVersion("team", 18000, 12);
    const id = await t.proposal({ plan: "team", by: proposer, state: "waiting", price: 18000, members: 14 });
    await dropChange(id, "price_monthly");
    expect(rowOf(await impactOf(id), w.tenantId)["after_price"]).toBe(18000);
    await decide(id);
    const row = await versionRow(v.planId, v.version + 1);
    expect([row?.price_monthly, row?.member_limit]).toEqual([18000, 14]);
  });

  it("K1157-API-009 値段だけの案（17,000 円）：決めると版の行は 17000・版 2 の 12 人", async () => {
    await dropVersions("team");
    const v = await addVersion("team", 18000, 12);
    const id = await t.proposal({ plan: "team", by: proposer, state: "waiting", price: 17000, members: 12 });
    await dropChange(id, "member_limit");
    await decide(id);
    const row = await versionRow(v.planId, v.version + 1);
    expect([row?.price_monthly, row?.member_limit]).toEqual([17000, 12]);
  });

  it("K1157-API-010 版 2（18,000 円・12 人）を今の版にすると、listOpsPlans のチームの行は版 2・18000・12・facts の先頭は 12 人まで", async () => {
    await dropVersions("team");
    const v = await addVersion("team", 18000, 12);
    const r = await t.act(decider, "GET", PLANS_PATH);
    expect(r.status, await r.clone().text()).toBe(200);
    const team = (((await t.json(r)).data ?? []) as Record<string, unknown>[]).find((x) => x["plan_key"] === "team")!;
    expect([team["version"], team["price_monthly"], team["member_limit"], (team["facts"] as unknown[])[0]]).toEqual([
      v.version,
      18000,
      12,
      { label: "人数", value: "12 人まで" },
    ]);
    expect([(await t.plan("team")).price, (await t.plan("team")).members]).toEqual([v.base.price, v.base.members]);
  });
});
