// K-988「値段を変える案を作る・直す・回す」の単体の試験（本物の DB・本物の入口・偽のログイン・土台 ops-plans.harness.ts＝K-987）。
// テストの名前の頭の行 ID（K988-…）は 11_tickets/K-988.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
// プランに開いた案は 1 つなので、試験ごとに前の回の開いた案を閉じてから始める（closeOpen）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import type { Person } from "../fixture.js";
import { PROPOSAL_KEYS, PROPOSALS, startOpsPlans, type OpsPlans, type PlanKey } from "./ops-plans.harness.js";

let t: OpsPlans;
let me: Person;
let other: Person;
beforeAll(async () => {
  t = await startOpsPlans("k988", ["ops-plans-read", "ops-plans-write"]);
  me = await t.ops("案の佐野", ["plan_propose"]);
  other = await t.ops("案の木村", ["plan_propose"]);
});
afterAll(async () => t?.close());

/** そのプランの開いた案（下書き・待っている）を消した印にする（共用の DB で前の回の案が残っていても始められる） */
const closeOpen = async (key: PlanKey) => {
  const p = await t.plan(key);
  await t.f.admin.query(
    "update ops_plan_proposals set deleted_at = now() where plan_id = $1 and state in ('draft','waiting') and deleted_at is null",
    [p.id],
  );
  return p;
};
const body = async (key: PlanKey, o: Record<string, unknown> = {}) => {
  const p = await t.plan(key);
  return {
    plan_key: key,
    price_monthly: p.price + 3000,
    member_limit: p.members + 2,
    existing_policy: "after_days",
    notice_days: 90,
    new_from: null,
    reason: `${t.run} 人数の上限に当たる会社が多いため`,
    ...o,
  };
};
const create = (who: Person, b: unknown) => t.act(who, "POST", PROPOSALS, b);
const patch = (who: Person, id: string, b: unknown) => t.act(who, "PATCH", `${PROPOSALS}/${id}`, b);
const submit = (who: Person, id: string) => t.act(who, "POST", `${PROPOSALS}/${id}/submit`, {});
const data = async (r: Response) => (await t.json(r)).data as Record<string, unknown>;
const openCount = async (key: PlanKey) =>
  t.n(
    "select count(*)::int as n from ops_plan_proposals where plan_id = $1 and state in ('draft','waiting') and deleted_at is null",
    [(await t.plan(key)).id],
  );
const audit = (action: string, id: string) =>
  t.row<{ payload: Record<string, unknown> }>(
    "select payload from ops_audit_events where action = $1 and target_type = 'ops_plan_proposals' and target_id = $2",
    [action, id],
  );

describe("K-988 作る", () => {
  it("K988-API-001 作る：201・20 欄・下書き・版は今→＋1・before は今・changes は送った値・記録 plan.propose", async () => {
    const p = await closeOpen("team");
    const b = await body("team");
    const r = await create(me, b);
    expect(r.status, await r.clone().text()).toBe(201);
    const d = await data(r);
    expect(Object.keys(d).sort()).toEqual([...PROPOSAL_KEYS]);
    expect(d["state"]).toBe("draft");
    expect([d["from_version"], d["to_version"]]).toEqual([p.version, p.version + 1]);
    expect(d["before"]).toEqual({ price_monthly: p.price, member_limit: p.members });
    expect(d["changes"]).toEqual({ price_monthly: b.price_monthly, member_limit: b.member_limit });
    expect(d["proposer"]).toEqual({ member_id: me.id, name: "運営 案の佐野" });
    expect(d["can_edit"]).toBe(true);
    const a = await audit("plan.propose", String(d["id"]));
    expect(a?.payload["price"]).toEqual({ from: p.price, to: b.price_monthly });
  });

  it("K988-API-002 ずっと今の値段：keep で notice_days なしは 201・notice_days null・new_from null", async () => {
    await closeOpen("free");
    const b = await body("free", { existing_policy: "keep" });
    delete (b as Record<string, unknown>)["notice_days"];
    const r = await create(me, b);
    expect(r.status, await r.clone().text()).toBe(201);
    const d = await data(r);
    expect([d["existing_policy"], d["notice_days"], d["new_from"]]).toEqual(["keep", null, null]);
  });

  it("K988-API-014 時間の流れ：new_from に昨日（日本）の日を送っても 201 で、送った日のまま残す（読むときに「決めた時から新しく入る人」と読む・K-989・K-1017）", async () => {
    await closeOpen("free");
    const y = new Date(Date.now() + 9 * 3_600_000 - 86_400_000).toISOString().slice(0, 10);
    const r = await create(me, await body("free", { new_from: y }));
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await data(r))["new_from"]).toBe(y);
  });

  it("K988-API-003 開いた案が在る：409・E-OPS-019・欄なし・案が増えない。差し戻された案だけなら作れる", async () => {
    await closeOpen("business");
    await t.proposal({ plan: "business", by: other, state: "draft" });
    const r = await create(me, await body("business"));
    expect(r.status).toBe(409);
    const j = await t.json(r);
    expect(j["code"]).toBe("E-OPS-019");
    expect(j["field"]).toBeUndefined();
    expect(await openCount("business")).toBe(1);
    await closeOpen("business");
    await t.proposal({ plan: "business", by: other, state: "returned", decidedBy: me });
    expect((await create(me, await body("business"))).status).toBe(201);
  });

  it("K988-API-004 同じ：今の版と同じ値段と人数は作るも直すも 409・E-OPS-020", async () => {
    const p = await closeOpen("team");
    const r = await create(me, await body("team", { price_monthly: p.price, member_limit: p.members }));
    expect(r.status).toBe(409);
    expect((await t.json(r))["code"]).toBe("E-OPS-020");
    const id = await t.proposal({ by: me, state: "draft", price: p.price + 1000 });
    const u = await patch(me, id, { price_monthly: p.price, member_limit: p.members });
    expect(u.status).toBe(409);
    expect((await t.json(u))["code"]).toBe("E-OPS-020");
    expect(((await t.proposalRow(id))!["changes"] as Record<string, unknown>)["price_monthly"]).toBe(p.price + 1000);
  });

  it("K988-API-012 同時に作る：同じプランに同時に 2 回は 201 と 409 E-OPS-019 が 1 つずつ・開いた案は 1 つ", async () => {
    await closeOpen("free");
    const b = await body("free");
    const rs = await Promise.all([create(me, b), create(other, b)]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await openCount("free")).toBe(1);
  });
});

describe("K-988 直す・回す", () => {
  it("K988-API-005 直す：下書きは 200・changes が新しい値・記録 plan.update。差し戻された案を直すと draft・decider null・return_reason null", async () => {
    const p = await closeOpen("team");
    const id = await t.proposal({ by: me, state: "draft", price: p.price + 1000 });
    const r = await patch(me, id, { price_monthly: p.price + 2000 });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(((await data(r))["changes"] as Record<string, unknown>)["price_monthly"]).toBe(p.price + 2000);
    expect(await audit("plan.update", id)).toBeDefined();
    await closeOpen("team");
    const back = await t.proposal({ by: me, state: "returned", decidedBy: other });
    const r2 = await patch(me, back, { reason: `${t.run} 人数を広げて値段を見直す` });
    expect(r2.status, await r2.clone().text()).toBe(200);
    const d = await data(r2);
    expect([d["state"], d["decider"], d["return_reason"]]).toEqual(["draft", null, null]);
  });

  it("K988-API-006 直せない：ほかの人の案は 403・待っている案は 409・E-OPS-021・欄なし・どちらも変わらない", async () => {
    await closeOpen("business");
    const id = await t.proposal({ plan: "business", by: other, state: "draft", price: 50000 });
    expect((await patch(me, id, { price_monthly: 51000 })).status).toBe(403);
    await closeOpen("business");
    const w = await t.proposal({ plan: "business", by: me, state: "waiting", price: 50000 });
    const r = await patch(me, w, { price_monthly: 51000 });
    expect(r.status).toBe(409);
    const j = await t.json(r);
    expect(j["code"]).toBe("E-OPS-021");
    expect(j["field"]).toBeUndefined();
    for (const x of [id, w])
      expect(((await t.proposalRow(x))!["changes"] as Record<string, unknown>)["price_monthly"]).toBe(50000);
  });

  it("K988-API-007 回す：作った人は 200・waiting・submitted_at・記録 plan.submit・鈴なし。2 回目は 409 E-OPS-021。ほかの人は 403", async () => {
    await closeOpen("free");
    const id = await t.proposal({ plan: "free", by: me, state: "draft", price: 500 });
    const bells = await t.n("select count(*)::int as n from notifications");
    expect((await submit(other, id)).status).toBe(403);
    const r = await submit(me, id);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = await data(r);
    expect(d["state"]).toBe("waiting");
    expect(typeof d["submitted_at"]).toBe("string");
    expect(await audit("plan.submit", id)).toBeDefined();
    expect(await t.n("select count(*)::int as n from notifications")).toBe(bells);
    const again = await submit(me, id);
    expect(again.status).toBe(409);
    expect((await t.json(again))["code"]).toBe("E-OPS-021");
  });

  it("K988-API-008 形と組み合わせ：範囲の外・空白だけの理由・方針と日数の組み合わせ・知らないプラン・日付・余計な欄・空の体・道の id は 422", async () => {
    await closeOpen("team");
    const base = await body("team");
    const bad: Record<string, unknown>[] = [
      { ...base, notice_days: 29 },
      { ...base, notice_days: 366 },
      { ...base, price_monthly: -1 },
      { ...base, price_monthly: 100.5 },
      { ...base, member_limit: 0 },
      { ...base, reason: "" },
      { ...base, reason: "　 \t" },
      { ...base, existing_policy: "after_days", notice_days: undefined },
      { ...base, existing_policy: "keep", notice_days: 90 },
      { ...base, plan_key: "gold" },
      { ...base, new_from: "2026-13-01" },
      { ...base, id: randomUUID() },
    ];
    for (const b of bad) expect((await create(me, JSON.parse(JSON.stringify(b)))).status, JSON.stringify(b)).toBe(422);
    expect(await openCount("team")).toBe(0);
    const id = await t.proposal({ by: me, state: "draft" });
    expect((await patch(me, id, {})).status).toBe(422);
    expect((await patch(me, "not-a-uuid", { price_monthly: 1 })).status).toBe(422);
  });

  it("K988-API-009 無い・消した：無い uuid と消した案は、直すも回すも 404・欄なし", async () => {
    await closeOpen("free");
    const gone = await t.proposal({ plan: "free", by: me, state: "draft" });
    await t.f.admin.query("update ops_plan_proposals set deleted_at = now() where id = $1", [gone]);
    for (const id of [randomUUID(), gone]) {
      const r = await patch(me, id, { price_monthly: 1 });
      expect(r.status, id).toBe(404);
      expect((await t.json(r))["field"]).toBeUndefined();
      expect((await submit(me, id)).status, id).toBe(404);
    }
  });
});

describe("K-988 入口と失敗", () => {
  it("K988-API-010 入口：ログインなし 401・会社の人 403・値段を決めるだけの人は 3 本とも 403", async () => {
    await closeOpen("team");
    const w = await t.ws("入口の会社");
    const decider = await t.ops("決めるだけ", ["plan_decide"]);
    const id = await t.proposal({ by: me, state: "draft" });
    expect((await t.act(null, "POST", PROPOSALS, await body("team"))).status).toBe(401);
    expect((await create(w.admin, await body("team"))).status).toBe(403);
    expect((await create(decider, await body("team"))).status).toBe(403);
    expect((await patch(decider, id, { price_monthly: 1 })).status).toBe(403);
    expect((await submit(decider, id)).status).toBe(403);
  });

  it("K988-API-011 書けない：案の表への書き込みを落とすと 503・E-PAGE-003・案と記録が増えない", async () => {
    await closeOpen("business");
    const audits = await t.n("select count(*)::int as n from ops_audit_events where action like 'plan.%'");
    const fix = await t.breakWrites(
      "ops_plan_proposals",
      `new.proposed_by in (select id from ops_members where member_id = '${me.id}')`,
    );
    try {
      const r = await create(me, await body("business"));
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await fix();
    }
    expect(await openCount("business")).toBe(0);
    expect(await t.n("select count(*)::int as n from ops_audit_events where action like 'plan.%'")).toBe(audits);
  });

  it("K988-API-013 上限：作るの上限の次が 429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await t.ops("上限", ["plan_propose"]);
    let last: Response | null = null;
    for (let i = 0; i < 70; i += 1) {
      last = await create(p, { plan_key: "gold" });
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    const sec = Number((await t.json(last!))["retry_after_sec"]);
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
  });

  it("K988-DB-001 2 層目：会社の人の文脈で app.ops_plan_proposal_create を直に呼ぶと 42501・PUBLIC は app.ops_plan_proposal_submit を呼べない", async () => {
    const app = new pg.Client({
      connectionString: process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"),
    });
    await app.connect();
    try {
      await app.query("begin");
      await app.query("select set_config('app.role', 'member', true)");
      await expect(app.query("select app.ops_plan_proposal_create('{}'::jsonb)")).rejects.toMatchObject({
        code: "42501",
      });
      await app.query("rollback");
    } finally {
      await app.end();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.ops_plan_proposal_submit(uuid)', 'execute') as ok",
    );
    expect(pub?.ok).toBe(false);
  });
});
