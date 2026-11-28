// K-987「配るもの › プランの読む口 3 本」の単体の試験（本物の DB・本物の入口・偽のログイン・土台 ops-plans.harness.ts）。
// テストの名前の頭の行 ID（K987-…）は 11_tickets/K-987.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { Person } from "../fixture.js";
import {
  HISTORY,
  OPS_TENANT,
  PLAN_ROW_KEYS,
  PLANS_PATH,
  PROPOSAL_KEYS,
  PROPOSALS,
  startOpsPlans,
  type OpsPlans,
} from "./ops-plans.harness.js";

let t: OpsPlans;
let proposer: Person;
let decider: Person;
beforeAll(async () => {
  t = await startOpsPlans("k987", ["ops-plans-read"]);
  proposer = await t.ops("案の佐野", ["plan_propose"]);
  decider = await t.ops("決める高本", ["plan_decide", "plan_propose"]);
});
afterAll(async () => t?.close());

const get = async (who: Person | null, path: string) => t.act(who, "GET", path);
const rows = async (who: Person, path: string) => {
  const r = await get(who, path);
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await t.json(r)).data ?? []) as Record<string, unknown>[];
};
const mine = (xs: Record<string, unknown>[]) => xs.filter((x) => String(x["reason"] ?? "").startsWith(t.run));
/** plan_decide を keep の人だけが持つ形にする（ほかの生きている運営の人から外す）。返す関数で戻す */
const alone = async (keep: Person[]) => {
  const others = await t.f.admin.query<{ id: string; caps: string[] }>(
    `select id, caps from ops_members where not (member_id = any($1::uuid[]))
        and revoked_at is null and deleted_at is null and 'plan_decide' = any(caps)`,
    [keep.map((p) => p.id)],
  );
  await t.f.admin.query("update ops_members set caps = array_remove(caps, 'plan_decide') where id = any($1::uuid[])", [
    others.rows.map((x) => x.id),
  ]);
  return async () => {
    for (const x of others.rows)
      await t.f.admin.query("update ops_members set caps = $2 where id = $1", [x.id, x.caps]);
  };
};

describe("K-987 プランの一覧", () => {
  it("K987-API-001 プランの一覧：200・no-store・無料・チーム・ビジネスの順・8 欄・チームの facts 2 行（人数と使えるもの）・version は 1 以上", async () => {
    const r = await get(proposer, PLANS_PATH);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const data = ((await t.json(r)).data ?? []) as Record<string, unknown>[];
    expect(data.map((x) => x["plan_key"])).toEqual(["free", "team", "business"]);
    for (const x of data) expect(Object.keys(x).sort()).toEqual([...PLAN_ROW_KEYS]);
    const team = data[1]!;
    expect(team["member_limit"]).toBe(10);
    expect(team["facts"]).toEqual([
      { label: "人数", value: "10 人まで" },
      { label: "使えるもの", value: "＋ ゲストを招く" },
    ]);
    expect(Number.isInteger(team["version"]) && Number(team["version"]) >= 1).toBe(true);
  });

  it("K987-API-002 使っている会社の数：チームの会社を 2 つ足すと places が 2 多い（止めた会社も数える）", async () => {
    const before = (await rows(proposer, PLANS_PATH)).find((x) => x["plan_key"] === "team")!["places"] as number;
    await t.ws("チームの会社 1", { plan: "team" });
    const w2 = await t.ws("チームの会社 2", { plan: "team" });
    await t.f.admin.query("update tenants set stopped_at = now() where id = $1", [w2.tenantId]);
    const after = (await rows(proposer, PLANS_PATH)).find((x) => x["plan_key"] === "team")!["places"];
    expect(after).toBe(before + 2);
  });

  it("K987-API-003 待っている案：proposal の 5 欄（waiting・版＋1・18000・作った人の名前）。決めた・差し戻した案だけなら null", async () => {
    const biz = await t.plan("business");
    await t.proposal({ plan: "business", by: proposer, state: "returned", decidedBy: decider });
    expect((await rows(proposer, PLANS_PATH)).find((x) => x["plan_key"] === "business")!["proposal"]).toBeNull();
    const id = await t.proposal({ plan: "business", by: proposer, state: "waiting", price: 18000 });
    const p = (await rows(proposer, PLANS_PATH)).find((x) => x["plan_key"] === "business")!["proposal"] as Record<
      string,
      unknown
    >;
    expect(p).toEqual({
      id,
      state: "waiting",
      to_version: biz.version + 1,
      price_monthly: 18000,
      proposer_name: "運営 案の佐野",
    });
  });
});

describe("K-987 案の一覧と記録", () => {
  it("K987-API-004 案の一覧：20 欄・新しい順・state で絞る・作った人は下書きを直せ・決める人は待っている案を決められる", async () => {
    const draft = await t.proposal({ by: proposer, state: "draft" });
    const waiting = await t.proposal({ plan: "free", by: proposer, state: "waiting" });
    const asProposer = mine(await rows(proposer, PROPOSALS));
    for (const x of asProposer) expect(Object.keys(x).sort()).toEqual([...PROPOSAL_KEYS]);
    const ids = asProposer.map((x) => x["id"]);
    expect(ids.indexOf(waiting)).toBeLessThan(ids.indexOf(draft));
    const d = asProposer.find((x) => x["id"] === draft)!;
    expect([d["can_edit"], d["can_decide"]]).toEqual([true, false]);
    const w = asProposer.find((x) => x["id"] === waiting)!;
    expect([w["can_edit"], w["can_decide"]]).toEqual([false, false]);
    expect(w["proposer"]).toEqual({ member_id: proposer.id, name: "運営 案の佐野" });
    expect(w["changes"]).toEqual({ price_monthly: 18000, member_limit: 12 });
    const asDecider = mine(await rows(decider, `${PROPOSALS}?state=waiting`));
    expect(asDecider.map((x) => x["state"]).every((s) => s === "waiting")).toBe(true);
    const w2 = asDecider.find((x) => x["id"] === waiting)!;
    expect([w2["can_edit"], w2["can_decide"]]).toEqual([false, true]);
  });

  it("K987-API-005 決める人が 1 人だけ：plan_decide を持つのが作った本人 1 人なら自分の案の can_decide が true。2 人目を置くと false", async () => {
    const solo = await t.ops("ひとりの高本", ["plan_decide", "plan_propose"]);
    const back = await alone([solo]);
    try {
      const id = await t.proposal({ plan: "free", by: solo, state: "waiting" });
      expect(mine(await rows(solo, PROPOSALS)).find((x) => x["id"] === id)!["can_decide"]).toBe(true);
      await t.ops("二人目", ["plan_decide"]);
      expect(mine(await rows(solo, PROPOSALS)).find((x) => x["id"] === id)!["can_decide"]).toBe(false);
    } finally {
      await back();
    }
  });

  it("K987-API-006 記録：9 欄・新しい順・price は { from, to }・plan_key=business でビジネスの行だけ", async () => {
    const team = await t.proposal({ by: proposer, state: "waiting" });
    const biz = await t.proposal({ plan: "business", by: proposer, state: "waiting" });
    const ins = async (target: string, action: string, ago: number) =>
      t.f.admin.query(
        `insert into ops_audit_events (tenant_id, ops_member_id, target_tenant_id, action, target_type, target_id, payload, occurred_at)
         values ($1, $2, $1, $3, 'ops_plan_proposals', $4, $5, now() - make_interval(secs => $6))`,
        [OPS_TENANT, proposer.id, action, target, { reason: `${t.run} 理由`, price: { from: 15000, to: 18000 } }, ago],
      );
    await ins(team, "plan.propose", 20);
    await ins(biz, "plan.submit", 10);
    const all = (await rows(proposer, HISTORY)).filter((x) => String(x["reason"] ?? "").startsWith(t.run));
    expect(all.map((x) => x["action"]).slice(0, 2)).toEqual(["plan.submit", "plan.propose"]);
    expect(Object.keys(all[0]!).sort()).toEqual(
      ["action", "actor_name", "at", "id", "members", "plan_name", "price", "reason", "to_version"].sort(),
    );
    expect(all[0]!["price"]).toEqual({ from: 15000, to: 18000 });
    const onlyBiz = (await rows(proposer, `${HISTORY}?plan_key=business`)).filter((x) =>
      String(x["reason"] ?? "").startsWith(t.run),
    );
    expect(onlyBiz.map((x) => x["plan_name"])).toEqual(["ビジネス"]);
  });
});

describe("K-987 入口と失敗", () => {
  it("K987-API-007 入口：ログインなし 401・会社の人 403・値段の印の無い運営の人は 3 本とも 403・値段を決めるだけの人は 200", async () => {
    const w = await t.ws("入口の会社");
    const none = await t.ops("値段なし", ["inquiry"]);
    const onlyDecide = await t.ops("決めるだけ", ["plan_decide"]);
    for (const p of [PLANS_PATH, PROPOSALS, HISTORY]) {
      expect((await get(null, p)).status, p).toBe(401);
      expect((await get(w.admin, p)).status, p).toBe(403);
      expect((await get(none, p)).status, p).toBe(403);
      expect((await get(onlyDecide, p)).status, p).toBe(200);
    }
  });

  it("K987-API-008 形の誤り：state=open・plan_key=gold・plan_id=<uuid> は 422", async () => {
    expect((await get(proposer, `${PROPOSALS}?state=open`)).status).toBe(422);
    expect((await get(proposer, `${HISTORY}?plan_key=gold`)).status).toBe(422);
    expect((await get(proposer, `${HISTORY}?plan_id=${(await t.plan("team")).id}`)).status).toBe(422);
  });

  it("K987-API-009 読めない：関数を呼べなくすると 503・E-PAGE-003", async () => {
    const fix = await t.breakFn("app.ops_plans()");
    try {
      const r = await get(proposer, PLANS_PATH);
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
  });

  it("K987-API-010 上限：一覧の上限の次が 429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await t.ops("上限", ["plan_propose"]);
    let last: Response | null = null;
    for (let i = 0; i < 70; i += 1) {
      last = await get(p, PLANS_PATH);
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    const sec = Number((await t.json(last!))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
  });

  it("K987-API-011 種は上書きしない：チームの facts を直してから app.plan_seed() をもう一度呼んでも直した値のまま・版 1 の行は 1 つのまま", async () => {
    const team = await t.plan("team");
    await t.f.admin.query(
      "update plans set limits = jsonb_set(coalesce(limits, '{}'::jsonb), '{facts}', $2::jsonb) where id = $1",
      [team.id, JSON.stringify([{ label: "使えるもの", value: "＋ ゲストを招く・試し" }])],
    );
    const versions = await t.n("select count(*)::int as n from plan_versions where plan_id = $1", [team.id]);
    await t.f.admin.query("select app.plan_seed()");
    const facts = (await t.row<{ f: unknown }>("select limits->'facts' as f from plans where id = $1", [team.id]))?.f;
    expect(facts).toEqual([{ label: "使えるもの", value: "＋ ゲストを招く・試し" }]);
    expect(await t.n("select count(*)::int as n from plan_versions where plan_id = $1", [team.id])).toBe(versions);
  });

  it("K987-DB-001 2 層目：会社の人の文脈で app.ops_plans を直に呼ぶと 42501・PUBLIC は app.ops_plan_proposals を呼べない", async () => {
    const app = new pg.Client({
      connectionString: process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
    });
    await app.connect();
    try {
      await app.query("begin");
      await app.query("select set_config('app.role', 'member', true)");
      await expect(app.query("select app.ops_plans()")).rejects.toMatchObject({ code: "42501" });
      await app.query("rollback");
    } finally {
      await app.end();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.ops_plan_proposals(text, integer)', 'execute') as ok",
    );
    expect(pub?.ok).toBe(false);
  });
});
