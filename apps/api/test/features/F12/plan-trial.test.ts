// K-1104「無料期間：プランごとに日で持ち、値段の案と同じ流れで変え、会社は始めた日から N 日は請求しない」の単体の試験
// （本物の DB・本物の入口・偽のログイン・土台 ops-plans.harness.ts＝K-987）。
// テストの名前の頭の行 ID（K1104-…）は 11_tickets/K-1104.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
// 版の行・会社の作った日・日割りの行は DB に直に置く（決める口を通さない準備）。プランの今の版・版の行は土台が afterAll で元に戻す（G-10）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Person } from "../fixture.js";
import { PLANS_PATH, PROPOSALS, STEP, startOpsPlans, type OpsPlans, type PlanKey } from "./ops-plans.harness.js";

let t: OpsPlans;
let ops: Person;
let decider: Person;
beforeAll(async () => {
  t = await startOpsPlans("k1104", [
    "plans",
    "ops-plans-read",
    "ops-plans-write",
    "ops-plans-decide",
    "ops-invoices-issue",
  ]);
  ops = await t.ops("無料期間の佐野", ["money", "plan_propose"]);
  decider = await t.ops("無料期間の高本", ["plan_decide"]);
});
afterAll(async () => t?.close());

const day = async (sql: string) => (await t.row<{ d: string }>(`select to_char((${sql})::date, 'YYYY-MM-DD') as d`))!.d;
const TODAY = "(now() at time zone 'Asia/Tokyo')::date";
const THIS_MONTH = `date_trunc('month', ${TODAY})`;
const LAST_MONTH = `${THIS_MONTH} - interval '1 month'`;
const LAST_MONTH_END = `${THIS_MONTH} - interval '1 day'`;
/** そのプランの開いた案（下書き・待っている）を消した印にする（共用の DB で前の回の案が残っていても始められる） */
const closeOpen = async (key: PlanKey) => {
  const p = await t.plan(key);
  await t.f.admin.query(
    "update ops_plan_proposals set deleted_at = now() where plan_id = $1 and state in ('draft','waiting') and deleted_at is null",
    [p.id],
  );
  return p;
};
/** 版 1 より新しい版の行を外し、版 1 の無料期間を 0 に戻す */
const resetVersions = async (key: PlanKey) => {
  const p = await t.plan(key);
  await t.f.admin.query("delete from plan_versions where plan_id = $1 and proposal_id is not null", [p.id]);
  await t.f.admin.query("update plan_versions set trial_days = 0 where plan_id = $1", [p.id]);
  await t.f.admin.query("update plans set current_version = 1 where id = $1", [p.id]);
  return t.plan(key);
};
/** そのプランに版を 1 つ足す（今の版＋1・値段と人数は今のまま・無料期間だけ変える）。
 * 版を決めた日（released_at）は new_from の日本の 0 時（無ければ今日の日本の 0 時）に置く。
 * K-1017 の決め（新しく入る人は S >= greatest(new_from, 決めた日)）で、new_from より後に始めた会社にこの版が当たるように */
const addTrialVersion = async (
  key: PlanKey,
  trial: number,
  o: { newFrom?: string | null; existingFrom?: string | null } = {},
) => {
  const p = await t.plan(key);
  const proposal = await t.proposal({
    plan: key,
    by: ops,
    state: "decided",
    decidedBy: decider,
    price: p.price,
    members: p.members,
  });
  const version = p.version + 1;
  await t.f.admin.query(
    `insert into plan_versions (plan_id, version, snapshot, released_at, price_monthly, member_limit, new_from, existing_from, proposal_id, decided_by, trial_days)
     values ($1, $2, $3, (coalesce($6::date, (now() at time zone 'Asia/Tokyo')::date))::timestamp at time zone 'Asia/Tokyo', $4, $5, $6::date, $7::date, $8, $9, $10)`,
    [
      p.id,
      version,
      { price_monthly: p.price, member_limit: p.members },
      p.price,
      p.members,
      o.newFrom ?? null,
      o.existingFrom ?? null,
      proposal,
      decider.id,
      trial,
    ],
  );
  await t.f.admin.query("update plans set current_version = $2 where id = $1", [p.id, version]);
  return { planId: p.id, version };
};
const body = async (key: PlanKey, o: Record<string, unknown> = {}) => {
  const p = await t.plan(key);
  return {
    plan_key: key,
    price_monthly: p.price,
    member_limit: p.members,
    existing_policy: "keep",
    new_from: null,
    reason: `${t.run} 試しに使ってもらうため`,
    ...o,
  };
};
const data = async (r: Response) => (await t.json(r)).data as Record<string, unknown>;
const trialOf = async (planId: string, tenantId: string, d: string) =>
  (await t.row<{ n: number }>("select app.plan_trial_days($1, $2, $3::date) as n", [planId, tenantId, d]))!.n;
/** 会社の作った日を日本の日付で置き直し、契約の始めた日（そのプランにした日＝D-156.71 の始めた日）もそろえる */
const startedOn = async (tenantId: string, d: string) => {
  await t.f.admin.query(
    "update tenants set created_at = ($2::date)::timestamp at time zone 'Asia/Tokyo' where id = $1",
    [tenantId, d],
  );
  await t.f.admin.query(
    "update subscriptions set started_at = ($2::date)::timestamp at time zone 'Asia/Tokyo' where tenant_id = $1",
    [tenantId, d],
  );
};
/** 先月分の下書きの、その会社の行（無ければ undefined） */
const lastMonthLine = async (tenantId: string) => {
  const month = (await day(LAST_MONTH)).slice(0, 7);
  const r = await t.act(ops, "POST", "/ops/invoices/issue", { month, dry_run: true }, { stepUpAgoSec: STEP });
  expect(r.status, await r.clone().text()).toBe(201);
  const lines = (((await t.json(r)).data as Record<string, unknown>)["lines"] ?? []) as Record<string, unknown>[];
  return lines.find((x) => (x["workspace"] as Record<string, unknown>)["id"] === tenantId);
};

describe("K-1104 置き場と 1 か所", () => {
  it("K1104-DB-001 表：plan_versions.trial_days は既定 0・-1 と 366 は check で 23514・版 1 の種の行は 0", async () => {
    const p = await resetVersions("free");
    const v1 = await t.row<{ n: number }>(
      "select trial_days as n from plan_versions where plan_id = $1 and version = 1",
      [p.id],
    );
    expect(v1?.n).toBe(0);
    for (const bad of [-1, 366]) {
      const e = await t.f.admin
        .query("update plan_versions set trial_days = $2 where plan_id = $1 and version = 1", [p.id, bad])
        .then(
          () => null,
          (x: { code?: string }) => x.code,
        );
      expect(e).toBe("23514");
    }
  });

  it("K1104-DB-002 決め：版の行が無ければ 0・新しく入る会社は new_from の後の版の値・前からの会社は前の版の値（plan_terms と同じ版）", async () => {
    const p = await resetVersions("team");
    const old = await t.ws("前からのチーム");
    await startedOn(old.tenantId, await day(`${TODAY} - interval '40 days'`));
    expect(await trialOf(p.id, old.tenantId, await day(TODAY))).toBe(0);
    await addTrialVersion("team", 30, { newFrom: await day(`${TODAY} - interval '1 day'`), existingFrom: null });
    const fresh = await t.ws("今日始めたチーム");
    await startedOn(fresh.tenantId, await day(TODAY)); // 土台の会社は 40 日前に始めた契約で作られる（ops-ws.harness.ts）。今日始めた会社にする
    expect(await trialOf(p.id, fresh.tenantId, await day(TODAY))).toBe(30);
    expect(await trialOf(p.id, old.tenantId, await day(TODAY))).toBe(0);
  });

  it("K1104-DB-003 権限：kaname_app は app.plan_trial_days を呼べる・PUBLIC は呼べない", async () => {
    const r = await t.row<{ app: boolean; pub: boolean }>(
      `select has_function_privilege('kaname_app', 'app.plan_trial_days(uuid, uuid, date)', 'execute') as app,
              has_function_privilege('public', 'app.plan_trial_days(uuid, uuid, date)', 'execute') as pub`,
    );
    expect(r).toEqual({ app: true, pub: false });
  });
});

describe("K-1104 値段の案と同じ流れ", () => {
  it("K1104-API-001 作る：無料期間だけ 30 日にする案は 201・changes.trial_days 30・値段と人数は今の版のまま", async () => {
    const p = await closeOpen("team");
    await resetVersions("team");
    const r = await t.act(ops, "POST", PROPOSALS, await body("team", { trial_days: 30 }));
    expect(r.status, await r.clone().text()).toBe(201);
    const d = await data(r);
    expect(d["changes"]).toEqual({ price_monthly: p.price, member_limit: p.members, trial_days: 30 });
  });

  it('K1104-API-002 形：trial_days が -1・366・1.5・"30" は作る・直すとも 422 で、案は増えない', async () => {
    await closeOpen("team");
    const made = await data(await t.act(ops, "POST", PROPOSALS, await body("team", { trial_days: 7 })));
    for (const bad of [-1, 366, 1.5, "30"]) {
      const c = await t.act(ops, "POST", PROPOSALS, await body("team", { trial_days: bad }));
      expect(c.status, `作る ${String(bad)}`).toBe(422);
      const u = await t.act(ops, "PATCH", `${PROPOSALS}/${String(made["id"])}`, { trial_days: bad });
      expect(u.status, `直す ${String(bad)}`).toBe(422);
    }
    expect((await t.proposalRow(String(made["id"])))!["changes"]).toEqual(expect.objectContaining({ trial_days: 7 }));
  });

  it("K1104-API-003 変わらない：値段・人数・無料期間が今の版と同じなら 409 E-OPS-020・欄なし", async () => {
    await closeOpen("team");
    await resetVersions("team");
    const r = await t.act(ops, "POST", PROPOSALS, await body("team", { trial_days: 0 }));
    expect(r.status).toBe(409);
    const j = await t.json(r);
    expect(j["code"]).toBe("E-OPS-020");
    expect(j["field"]).toBeUndefined();
  });

  it("K1104-API-004 直す：下書きの案の無料期間だけを 14 に直すと 200・changes.trial_days 14", async () => {
    await closeOpen("team");
    const made = await data(await t.act(ops, "POST", PROPOSALS, await body("team", { trial_days: 30 })));
    const r = await t.act(ops, "PATCH", `${PROPOSALS}/${String(made["id"])}`, { trial_days: 14 });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(((await data(r))["changes"] as Record<string, unknown>)["trial_days"]).toBe(14);
  });

  it("K1104-API-005 決める：版の行の trial_days が案の値。無料期間を送っていない案（値段だけ）は前の版の値を引き継ぐ", async () => {
    await closeOpen("team");
    const base = await resetVersions("team");
    await addTrialVersion("team", 21, { newFrom: null, existingFrom: null });
    const decideOf = async (changes: Record<string, unknown>) => {
      const id = await t.proposal({
        plan: "team",
        by: ops,
        state: "waiting",
        price: base.price + 1000,
        members: base.members,
        policy: "keep",
        days: null,
      });
      await t.f.admin.query("update ops_plan_proposals set changes = $2 where id = $1", [id, changes]);
      const r = await t.act(
        decider,
        "POST",
        `${PROPOSALS}/${id}/decide`,
        { notice_body: "無料期間を改めます。" },
        { stepUpAgoSec: STEP },
      );
      expect(r.status, await r.clone().text()).toBe(200);
      const v = (await t.plan("team")).version;
      return (await t.row<{ n: number }>(
        "select trial_days as n from plan_versions where plan_id = $1 and version = $2",
        [base.id, v],
      ))!.n;
    };
    expect(await decideOf({ price_monthly: base.price + 1000, member_limit: base.members, trial_days: 45 })).toBe(45);
    expect(await decideOf({ price_monthly: base.price + 2000, member_limit: base.members })).toBe(45);
  });

  it("K1104-API-011 一覧：listOpsPlans の行は今の版の trial_days（整数）を持つ。版 1 だけなら 0・無料期間 30 日の版を足すと 30", async () => {
    await closeOpen("team");
    await resetVersions("team");
    const teamTrial = async () => {
      const r = await t.act(ops, "GET", PLANS_PATH);
      expect(r.status, await r.clone().text()).toBe(200);
      const rows = (await t.json(r)).data as Record<string, unknown>[];
      for (const x of rows) expect(Number.isInteger(x["trial_days"])).toBe(true);
      return rows.find((x) => x["plan_key"] === "team")!["trial_days"];
    };
    expect(await teamTrial()).toBe(0);
    await addTrialVersion("team", 30);
    expect(await teamTrial()).toBe(30);
  });
});

describe("K-1104 請求書に効かせる（始めた日から N 日は請求しない）", () => {
  it("K1104-API-006 無料の月：先月の 20 日にチームにした会社（会社を作ったのは 200 日前）は、チームの無料期間が 60 日なら先月分の下書きに出ない（始めた日はそのプランにした日＝D-156.71）", async () => {
    await resetVersions("team");
    await addTrialVersion("team", 60, { newFrom: await day(`${LAST_MONTH} - interval '1 month'`), existingFrom: null });
    const w = await t.ws("無料期間のチーム");
    await startedOn(w.tenantId, await day(`${LAST_MONTH} + interval '19 days'`));
    await t.f.admin.query("update tenants set created_at = now() - interval '200 days' where id = $1", [w.tenantId]);
    expect(await lastMonthLine(w.tenantId)).toBeUndefined();
  });

  it("K1104-API-007 過ぎた月：先々月の 20 日に始め、無料期間 30 日（先月の 19 日ごろまで）の会社は、先月分が 1 か月分の値段（日割りしない）", async () => {
    await resetVersions("team");
    await addTrialVersion("team", 30, {
      newFrom: await day(`${LAST_MONTH} - interval '2 months'`),
      existingFrom: null,
    });
    const w = await t.ws("過ぎたチーム");
    await startedOn(w.tenantId, await day(`${LAST_MONTH} - interval '1 month' + interval '19 days'`));
    const line = await lastMonthLine(w.tenantId);
    expect(line?.["amount"]).toBe((await t.plan("team")).price);
    expect(line?.["prorated"]).toBe(0);
  });

  it("K1104-API-008 境目：最初に請求する日（始めた日＋N）が先月の末日なら先月分を出す・今月の 1 日なら先月分を出さない", async () => {
    await resetVersions("team");
    await addTrialVersion("team", 10, {
      newFrom: await day(`${LAST_MONTH} - interval '2 months'`),
      existingFrom: null,
    });
    const edge = await t.ws("末日から請求のチーム");
    await startedOn(edge.tenantId, await day(`${LAST_MONTH_END} - interval '10 days'`));
    expect((await lastMonthLine(edge.tenantId))?.["amount"]).toBe((await t.plan("team")).price);
    const next = await t.ws("1 日から請求のチーム");
    await startedOn(next.tenantId, await day(`${THIS_MONTH} - interval '10 days'`));
    expect(await lastMonthLine(next.tenantId)).toBeUndefined();
  });

  it("K1104-API-009 日割り：無料期間の中で上げた日割りは足さない・過ぎてから上げた日割りは足す", async () => {
    await resetVersions("team");
    await addTrialVersion("team", 30, {
      newFrom: await day(`${LAST_MONTH} - interval '3 months'`),
      existingFrom: null,
    });
    const w = await t.ws("上げたチーム");
    const start = await day(`${LAST_MONTH} - interval '1 month' + interval '19 days'`);
    await startedOn(w.tenantId, start);
    const p = await t.plan("team");
    const put = (from: string, amount: number) =>
      t.f.admin.query(
        `insert into plan_change_requests (tenant_id, from_plan_id, to_plan_id, status_id, effective_from, prorated_amount)
         values ($1, $2, $2, 'applied', $3::date, $4)`,
        [w.tenantId, p.id, from, amount],
      );
    await put(await day(`${LAST_MONTH} + interval '5 days'`), 1100);
    await put(await day(`${LAST_MONTH} + interval '25 days'`), 2200);
    const line = await lastMonthLine(w.tenantId);
    expect(line?.["prorated"]).toBe(2200);
  });

  it("K1104-API-010 同じプランは 1 社 1 回（D-156.74）：4 か月前の月の 20 日にチーム（無料期間 30 日）を始めて 3 か月前の月の 25 日に下げ、先月の 3 日にチームへ上げ直した会社は、先月分が 1 か月分の値段（無料にならない）。同じ先月の 3 日に初めてチームにした会社は先月分の行が無い", async () => {
    await resetVersions("team");
    await addTrialVersion("team", 30, {
      newFrom: await day(`${THIS_MONTH} - interval '6 months'`),
      existingFrom: null,
    });
    const again = await day(`${LAST_MONTH} + interval '2 days'`);
    const back = await t.ws("上げ直したチーム");
    await startedOn(back.tenantId, again);
    const first = await day(`${THIS_MONTH} - interval '4 months' + interval '19 days'`);
    const down = await day(`${THIS_MONTH} - interval '3 months' + interval '24 days'`);
    await t.f.admin.query(
      `insert into subscriptions (tenant_id, plan_id, status_id, started_at, ended_at)
       select tenant_id, plan_id, status_id, ($2::date)::timestamp at time zone 'Asia/Tokyo', ($3::date)::timestamp at time zone 'Asia/Tokyo'
         from subscriptions where tenant_id = $1 and deleted_at is null limit 1`,
      [back.tenantId, first, down],
    );
    await t.f.admin.query(
      "update tenants set created_at = ($2::date)::timestamp at time zone 'Asia/Tokyo' where id = $1",
      [back.tenantId, first],
    );
    expect((await lastMonthLine(back.tenantId))?.["amount"]).toBe((await t.plan("team")).price);
    const fresh = await t.ws("先月初めてのチーム");
    await startedOn(fresh.tenantId, again);
    expect(await lastMonthLine(fresh.tenantId), "初めてなら無料期間の中").toBeUndefined();
  });
});
