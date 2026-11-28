// K-989「値段を変える案の影響を見る」の単体の試験（本物の DB・本物の入口・偽のログイン・土台 ops-plans.harness.ts＝K-987）。
// テストの名前の頭の行 ID（K989-…）は 11_tickets/K-989.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import type { Person } from "../fixture.js";
import { PROPOSALS, startOpsPlans, type OpsPlans } from "./ops-plans.harness.js";

let t: OpsPlans;
let decider: Person;
let proposer: Person;
beforeAll(async () => {
  t = await startOpsPlans("k989", ["ops-plans-read", "ops-plans-impact"]);
  decider = await t.ops("決める高本", ["plan_decide"]);
  proposer = await t.ops("案の佐野", ["plan_propose"]);
});
afterAll(async () => t?.close());

const impact = async (who: Person | null, id: string) => t.act(who, "GET", `${PROPOSALS}/${id}/impact`);
const dataOf = async (id: string) => {
  const r = await impact(decider, id);
  expect(r.status, await r.clone().text()).toBe(200);
  return (await t.json(r)).data as Record<string, unknown>;
};
const rowsOf = (d: Record<string, unknown>) =>
  ((d["by_workspace"] ?? []) as Record<string, unknown>[]).filter((x) =>
    String((x["workspace"] as Record<string, unknown>)["name"]).startsWith(t.run),
  );
const fromOf = async (policy: string, days: number | null, immediate: boolean, from: string) =>
  (
    await t.row<{ d: string | null }>(
      "select to_char(app.plan_existing_from($1, $2, $3, $4::date), 'YYYY-MM-DD') as d",
      [policy, days, immediate, from],
    )
  )?.d ?? null;

describe("K-989 影響", () => {
  it("K989-API-001 値上げの影響：7 欄・この回のチームの会社 2 つが名前の順・1 行は 6 欄・前と後の値段・変わる月", async () => {
    const team = await t.plan("team");
    await t.ws("A チーム");
    await t.ws("B チーム");
    const id = await t.proposal({
      by: proposer,
      state: "waiting",
      price: team.price + 3000,
      members: team.members + 2,
    });
    const r = await impact(decider, id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await t.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(
      ["by_workspace", "customers", "existing_from", "immediate", "monthly_revenue_diff", "new_from", "stopped"].sort(),
    );
    const mine = rowsOf(d);
    expect(mine.map((x) => (x["workspace"] as Record<string, unknown>)["name"])).toEqual([
      `${t.run} A チーム`,
      `${t.run} B チーム`,
    ]);
    expect(Object.keys(mine[0]!).sort()).toEqual([
      "after_price",
      "from_month",
      "members",
      "now_price",
      "stopped",
      "workspace",
    ]);
    expect([mine[0]!["now_price"], mine[0]!["after_price"], mine[0]!["stopped"]]).toEqual([
      team.price,
      team.price + 3000,
      false,
    ]);
    expect(mine[0]!["from_month"]).toBe(d["existing_from"]);
    expect(String(d["existing_from"])).toMatch(/^\d{4}-\d{2}$/);
  });

  it("K989-API-002 数と差：チームの会社を 2 つ足すと customers が 2 多く、差が 2 ×（案 − 今）多い・immediate false", async () => {
    const team = await t.plan("team");
    const id = await t.proposal({ by: proposer, state: "waiting", price: team.price + 3000, members: team.members });
    const before = await dataOf(id);
    await t.ws("C チーム");
    await t.ws("D チーム");
    const after = await dataOf(id);
    expect(after["customers"]).toBe(Number(before["customers"]) + 2);
    expect(after["monthly_revenue_diff"]).toBe(Number(before["monthly_revenue_diff"]) + 2 * 3000);
    expect(after["immediate"]).toBe(false);
  });

  it("K989-API-003 ずっと今の値段：existing_from null・差 0・行の from_month null", async () => {
    const team = await t.plan("team");
    await t.ws("E チーム");
    const id = await t.proposal({
      by: proposer,
      state: "waiting",
      price: team.price + 3000,
      policy: "keep",
      days: null,
    });
    const d = await dataOf(id);
    expect([d["existing_from"], d["monthly_revenue_diff"]]).toEqual([null, 0]);
    expect(rowsOf(d).every((x) => x["from_month"] === null)).toBe(true);
  });

  it("K989-API-004 すぐ効く：値下げの案は immediate true・existing_from は今日の次の月", async () => {
    const team = await t.plan("team");
    const id = await t.proposal({ by: proposer, state: "waiting", price: team.price - 1000, members: team.members });
    const d = await dataOf(id);
    expect(d["immediate"]).toBe(true);
    const next = (await t.row<{ m: string }>(
      "select to_char(date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '1 month', 'YYYY-MM') as m",
    ))!.m;
    expect(d["existing_from"]).toBe(next);
  });

  it("K989-API-005 月の式の境目：90 日・30 日ちょうど 1 日・2 月をまたぐ・すぐ・ずっと今の値段", async () => {
    expect(await fromOf("after_days", 90, false, "2026-11-04")).toBe("2027-03-01");
    expect(await fromOf("after_days", 30, false, "2026-11-01")).toBe("2026-12-01");
    expect(await fromOf("after_days", 30, false, "2026-01-31")).toBe("2026-04-01");
    expect(await fromOf("after_days", 90, true, "2026-12-15")).toBe("2027-01-01");
    expect(await fromOf("keep", null, false, "2026-12-15")).toBeNull();
  });

  it("K989-API-006 止めている会社：stopped true・after_price と from_month が null・stopped の数に入り、差には入らない。止める日が今日の会社も止めている", async () => {
    const team = await t.plan("team");
    const id = await t.proposal({ by: proposer, state: "waiting", price: team.price + 3000 });
    const before = await dataOf(id);
    const w = await t.ws("F 止めた");
    await t.f.admin.query("update tenants set stopped_at = now() where id = $1", [w.tenantId]);
    const after = await dataOf(id);
    const row = rowsOf(after).find((x) => (x["workspace"] as Record<string, unknown>)["id"] === w.tenantId)!;
    expect([row["stopped"], row["after_price"], row["from_month"]]).toEqual([true, null, null]);
    expect(after["stopped"]).toBe(Number(before["stopped"]) + 1);
    expect(after["monthly_revenue_diff"]).toBe(before["monthly_revenue_diff"]);
    const today = await t.ws("F 今日止まる");
    await t.f.admin.query("update tenants set stop_on = (now() at time zone 'Asia/Tokyo')::date where id = $1", [
      today.tenantId,
    ]);
    const due = rowsOf(await dataOf(id)).find(
      (x) => (x["workspace"] as Record<string, unknown>)["id"] === today.tenantId,
    )!;
    expect([due["stopped"], due["after_price"], due["from_month"]]).toEqual([true, null, null]);
  });

  it("K989-API-007 無い・形：無い uuid と消した案は 404・欄なし・:id が uuid でないは 422", async () => {
    const gone = await t.proposal({ by: proposer, state: "draft" });
    await t.f.admin.query("update ops_plan_proposals set deleted_at = now() where id = $1", [gone]);
    for (const id of [randomUUID(), gone]) {
      const r = await impact(decider, id);
      expect(r.status, id).toBe(404);
      expect((await t.json(r))["field"]).toBeUndefined();
    }
    expect((await impact(decider, "not-a-uuid")).status).toBe(422);
  });

  it("K989-API-008 入口：ログインなし 401・会社の人 403・値段の印の無い運営の人 403・値段を決めるだけの人 200", async () => {
    const id = await t.proposal({ by: proposer, state: "waiting" });
    const w = await t.ws("入口の会社");
    const none = await t.ops("値段なし", ["inquiry"]);
    expect((await impact(null, id)).status).toBe(401);
    expect((await impact(w.admin, id)).status).toBe(403);
    expect((await impact(none, id)).status).toBe(403);
    expect((await impact(decider, id)).status).toBe(200);
  });

  it("K989-API-009 読めない：関数を呼べなくすると 503・E-PAGE-003", async () => {
    const id = await t.proposal({ by: proposer, state: "waiting" });
    const fix = await t.breakFn("app.ops_plan_impact(uuid)");
    try {
      const r = await impact(decider, id);
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
  });

  it("K989-API-010 上限：上限の次が 429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await t.ops("上限", ["plan_decide"]);
    const id = randomUUID();
    let last: Response | null = null;
    for (let i = 0; i < 70; i += 1) {
      last = await impact(p, id);
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    const sec = Number((await t.json(last!))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
  });

  it("K989-DB-001 2 層目：会社の人の文脈で app.ops_plan_impact を直に呼ぶと 42501・PUBLIC は呼べない", async () => {
    const app = new pg.Client({
      connectionString: process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
    });
    await app.connect();
    try {
      await app.query("begin");
      await app.query("select set_config('app.role', 'member', true)");
      await expect(app.query("select app.ops_plan_impact($1)", [randomUUID()])).rejects.toMatchObject({
        code: "42501",
      });
      await app.query("rollback");
    } finally {
      await app.end();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.ops_plan_impact(uuid)', 'execute') as ok",
    );
    expect(pub?.ok).toBe(false);
  });
});
