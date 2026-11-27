// K-968 運営が 1 社のプランと請求を読む（getOpsWorkspaceBilling・GET /api/v1/ops/workspaces/:id/billing）と、
//   頼まれたときに代わりにプランを変える（changeOpsWorkspacePlan・POST …/plan・お金の人だけ・本人確認・頼まれた問い合わせを付ける）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1005（読む 4 欄・変えるは changePlan と同じ 4 欄）。プランを変える決め（上げるとすぐ・下げると来月 1 日・人数・日割り）は
//   K-961 と同じ 1 か所（この葉が中身を app.plan_change_for に分け、会社の人の口と運営の口の両方から呼ぶ）。
//   会社・請求書・契約の作り方と本人確認の時刻は土台 billing.harness.ts（K-958）。運営の人は運営の会社の members と ops_members の行
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  startBilling,
  isFlat,
  jstDay,
  nextFirst,
  prorate,
  INVOICE_KEYS,
  TERMS,
  type Billing,
  type Json,
  type Who,
  type World,
} from "./billing.harness.js";

const OPS_TENANT = "00000000-0000-4000-8000-000000000001";
const STEP = 60;
let b: Billing;
let money: Who;
let noMoney: Who;
const opsIds: string[] = [];
const tenants: string[] = [];

const opsWho = async (name: string, caps: string[]): Promise<Who> => {
  const scope = (await b.row<{ id: string }>(
    "insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, '') returning id",
    [OPS_TENANT, `${b.run} 運営 ${name}`],
  ))!.id;
  const p = await b.f.person(OPS_TENANT, scope, { name: `運営 ${name}`, role: "ops" });
  await b.f.admin.query("insert into ops_members (tenant_id, member_id, caps) values ($1, $2, $3)", [
    OPS_TENANT,
    p.id,
    caps,
  ]);
  opsIds.push(p.id);
  return { id: p.id, tenantId: OPS_TENANT, role: "ops" };
};

beforeAll(async () => {
  b = await startBilling("k968", ["ops-workspace-billing", "plans"]);
  money = await opsWho("佐野", ["money"]);
  noMoney = await opsWho("問い合わせだけ", ["inquiry"]);
});
afterAll(async () => {
  // 運営の記録・会社の記録・安全の記録（ops_audit_events・audit_events・security_events）は追記専用（0003_audit.sql の引き金）なので消さない。試験は前の数との差かその回の印で絞って数える
  if (tenants.length) await b.f.admin.query("delete from inquiries where tenant_id = any($1::uuid[])", [tenants]);
  if (opsIds.length) await b.f.admin.query("delete from ops_members where member_id = any($1::uuid[])", [opsIds]);
  await b.close();
});

const world = async (label: string, plan: "free" | "team" | "business" = "team"): Promise<World> => {
  const w = await b.world(label, { plan });
  tenants.push(w.tenantId);
  return w;
};
const inquiry = async (w: World, title = "プランを上げたい") =>
  (await b.row<{ id: string }>(
    "insert into inquiries (tenant_id, opened_by_member_id, title, topic_key, state, last_message_at) values ($1, $2, $3, 'billing', 'open', now()) returning id",
    [w.tenantId, w.admin.id, title],
  ))!.id;
const change = async (wsId: string, body: unknown, who: Who = money, step: number | undefined = STEP) => {
  const r = await b.call(
    who,
    "POST",
    `/ops/workspaces/${wsId}/plan`,
    body,
    step === undefined ? {} : { stepUpAgoSec: step },
  );
  return { r, j: await b.json(r) };
};
const read = async (wsId: string, who: Who = money) => {
  const r = await b.call(who, "GET", `/ops/workspaces/${wsId}/billing`);
  return { r, j: await b.json(r) };
};
const currentKey = async (w: World) =>
  (await b.row<{ k: string | null }>("select p.key as k from plans p where p.id = app.tenant_plan_id($1)", [
    w.tenantId,
  ]))!.k;
const requests = (w: World) => b.n("select count(*) as n from plan_change_requests where tenant_id = $1", [w.tenantId]);

describe("K-968 代わりにプランを変える", () => {
  it("K968-API-001 上げる：201・鍵は plan_key・effective_from・prorated_amount・next_invoice_on の 4 つ。今日から business・日割りは差 ¥25,000 の残り日数分（税込）・次の請求日は来月 1 日", async () => {
    const w = await world("上げる");
    const { r, j } = await change(w.tenantId, { plan_key: "business", inquiry_id: await inquiry(w) });
    expect(r.status, JSON.stringify(j)).toBe(201);
    const d = j.data as Json;
    expect(Object.keys(d).sort()).toEqual(["effective_from", "next_invoice_on", "plan_key", "prorated_amount"]);
    expect([d["plan_key"], d["effective_from"], d["prorated_amount"], d["next_invoice_on"]]).toEqual([
      "business",
      jstDay(),
      prorate(25000),
      nextFirst(),
    ]);
    expect(await currentKey(w)).toBe("business");
  });

  it("K968-API-002 下げる：201・効くのは来月 1 日・日割り 0。今のプランは来月までビジネスのまま。頼みの行は 1 つ（頼んだ人は運営の人・予定）", async () => {
    const w = await world("下げる", "business");
    const { r, j } = await change(w.tenantId, { plan_key: "team", inquiry_id: await inquiry(w) });
    expect(r.status, JSON.stringify(j)).toBe(201);
    const d = j.data as Json;
    expect([d["effective_from"], d["prorated_amount"]]).toEqual([nextFirst(), 0]);
    expect(await currentKey(w)).toBe("business");
    const q = (await b.row<{ by: string; st: string }>(
      "select requested_by as by, status_id as st from plan_change_requests where tenant_id = $1",
      [w.tenantId],
    ))!;
    expect([q.by, q.st]).toEqual([money.id, "scheduled"]);
  });

  it("K968-API-003 記録：運営の記録と会社の記録に plan.change が 1 行ずつ（会社の記録の行は運営の人の 1 行だけ）。target_label は「チーム → ビジネス」・reason は頼まれた問い合わせの題", async () => {
    const w = await world("記録");
    const q = await inquiry(w, "人が増えるのでビジネスにしたい");
    expect((await change(w.tenantId, { plan_key: "business", inquiry_id: q })).r.status).toBe(201);
    expect(
      await b.n("select count(*) as n from ops_audit_events where target_tenant_id = $1 and action = 'plan.change'", [
        w.tenantId,
      ]),
    ).toBe(1);
    expect(
      await b.n("select count(*) as n from audit_events where tenant_id = $1 and action = 'plan.change'", [w.tenantId]),
    ).toBe(1);
    const e = (await b.row<{ ty: string; id: string; p: Json }>(
      "select target_type as ty, target_id as id, payload as p from ops_audit_events where target_tenant_id = $1 and action = 'plan.change'",
      [w.tenantId],
    ))!;
    expect([e.ty, e.id, e.p["target_label"], e.p["reason"], e.p["inquiry_id"]]).toEqual([
      "tenants",
      w.tenantId,
      "チーム → ビジネス",
      "問い合わせ「人が増えるのでビジネスにしたい」",
      q,
    ]);
  });

  it("K968-API-004 会社の人の口と同じ断り：今のプランは 409 E-PLAN-001（欄なし）。人数が上限を超える下げは 409 E-PLAN-002（detail に members・member_limit）。どちらも何も変えない", async () => {
    const w = await world("同じ");
    const same = await change(w.tenantId, { plan_key: "team", inquiry_id: await inquiry(w) });
    expect([same.r.status, same.j["code"]]).toEqual([409, "E-PLAN-001"]);
    expect(isFlat(same.j)).toBe(true);
    const over = await change(w.tenantId, { plan_key: "free", inquiry_id: await inquiry(w) });
    expect([over.r.status, over.j["code"]]).toEqual([409, "E-PLAN-002"]);
    expect(over.j["detail"]).toEqual({ members: 4, member_limit: 3 });
    expect([await currentKey(w), await requests(w)]).toEqual(["team", 0]);
  });

  it("K968-API-005 指した物が無い・見えない：プランの鍵が無い、問い合わせが別の会社の・消した・無いは 404（欄なし）で何も変えない", async () => {
    const w = await world("無い");
    const o = await world("別の会社");
    const gone = await inquiry(w);
    await b.f.admin.query("update inquiries set deleted_at = now() where id = $1", [gone]);
    const cases: Json[] = [
      { plan_key: "gold", inquiry_id: await inquiry(w) },
      { plan_key: "business", inquiry_id: await inquiry(o) },
      { plan_key: "business", inquiry_id: gone },
      { plan_key: "business", inquiry_id: randomUUID() },
    ];
    for (const body of cases) {
      const x = await change(w.tenantId, body);
      expect(x.r.status, JSON.stringify(body)).toBe(404);
      expect(isFlat(x.j)).toBe(true);
    }
    expect([await currentKey(w), await requests(w)]).toEqual(["team", 0]);
  });

  it("K968-API-006 会社が無い・見えない：運営の会社・無い uuid は、読むのも変えるのも 404（欄なし）", async () => {
    for (const id of [OPS_TENANT, randomUUID()]) {
      const x = await change(id, { plan_key: "business", inquiry_id: randomUUID() });
      expect(x.r.status, id).toBe(404);
      expect(isFlat(x.j)).toBe(true);
      expect((await read(id)).r.status, id).toBe(404);
    }
  });

  it("K968-API-007 本人確認：取り直していない・16 分前は 403 STEP_UP_REQUIRED で変えない。14 分前なら変えられる", async () => {
    const w = await world("本人確認");
    const q = await inquiry(w);
    for (const step of [undefined, 16 * 60]) {
      const x = await change(w.tenantId, { plan_key: "business", inquiry_id: q }, money, step);
      expect([x.r.status, x.j["code"]], String(step)).toEqual([403, "STEP_UP_REQUIRED"]);
    }
    expect(await currentKey(w)).toBe("team");
    expect((await change(w.tenantId, { plan_key: "business", inquiry_id: q }, money, 14 * 60)).r.status).toBe(201);
  });

  it("K968-API-008 入口：ログインなし 401・会社の管理者 403・お金（money）を持たない運営の人 403（読む・変えるとも）。変えない", async () => {
    const w = await world("入口");
    const q = await inquiry(w);
    expect(
      (await b.call(null, "POST", `/ops/workspaces/${w.tenantId}/plan`, { plan_key: "business", inquiry_id: q }))
        .status,
    ).toBe(401);
    expect((await change(w.tenantId, { plan_key: "business", inquiry_id: q }, w.admin)).r.status).toBe(403);
    expect((await change(w.tenantId, { plan_key: "business", inquiry_id: q }, noMoney)).r.status).toBe(403);
    expect((await read(w.tenantId, noMoney)).r.status).toBe(403);
    expect((await read(w.tenantId, w.admin)).r.status).toBe(403);
    expect(await currentKey(w)).toBe("team");
  });

  it("K968-API-009 形の誤り：問い合わせが無い・plan_key が無い・inquiry_id が uuid でない・知らない欄（plan_id）・道の :id が uuid でないは 422 で変えない", async () => {
    const w = await world("形");
    const q = await inquiry(w);
    const bad: unknown[] = [
      { plan_key: "business" },
      { inquiry_id: q },
      { plan_key: "business", inquiry_id: "abc" },
      { plan_key: "business", inquiry_id: q, plan_id: randomUUID() },
    ];
    for (const body of bad) expect((await change(w.tenantId, body)).r.status, JSON.stringify(body)).toBe(422);
    expect((await change("abc", { plan_key: "business", inquiry_id: q })).r.status).toBe(422);
    expect(await requests(w)).toBe(0);
  });

  it("K968-API-010 会社の側から見て同じ：運営が代わりに上げた後、その会社の管理者の選べるプランの口で今のプランが business（同じ契約の行を読む）", async () => {
    const w = await world("同じ決め");
    expect((await change(w.tenantId, { plan_key: "business", inquiry_id: await inquiry(w) })).r.status).toBe(201);
    const r = await b.call(w.admin, "GET", "/workspace/plans");
    expect(r.status).toBe(200);
    const rows = (await b.json(r)).data as Json[];
    expect(rows.find((x) => x["current"] === true)?.["plan_key"]).toBe("business");
  });
});

describe("K-968 プランと請求を読む", () => {
  it("K968-API-011 読む：200・鍵は plan・members・payment_terms・invoices の 4 つ。plan は team・チーム・15000・始めた日、members は 4 / 10、支払い条件は設定の字、請求書は利用者の請求書と同じ形（払われた行だけ paid_on）", async () => {
    const w = await world("読む");
    await b.invoice(w.tenantId, { month: "2026-09", dueOn: "2026-10-31", amount: 16500 });
    const paidId = await b.invoice(w.tenantId, { month: "2026-08", dueOn: "2026-09-30", amount: 16500 });
    await b.pay(paidId, 16500, "2026-09-28");
    const { r, j } = await read(w.tenantId);
    expect(r.status, JSON.stringify(j)).toBe(200);
    const d = j.data as Json;
    expect(Object.keys(d).sort()).toEqual(["invoices", "members", "payment_terms", "plan"]);
    const plan = d["plan"] as Json;
    expect([plan["plan_key"], plan["name"], plan["price_monthly"], plan["since"]]).toEqual([
      "team",
      "チーム",
      15000,
      jstDay(-40),
    ]);
    expect([d["members"], d["payment_terms"]]).toEqual([{ count: 4, limit: 10 }, TERMS]);
    const inv = d["invoices"] as Json[];
    expect(inv.map((x) => x["month"])).toEqual(["2026-09", "2026-08"]);
    expect(Object.keys(inv[0]!).sort()).toEqual(INVOICE_KEYS);
    expect(Object.keys(inv[1]!).sort()).toEqual([...INVOICE_KEYS, "paid_on"].sort());
    expect([inv[0]!["state"], inv[1]!["state"], inv[1]!["paid_on"]]).toEqual(["overdue", "paid", "2026-09-28"]);
  });

  it("K968-API-012 契約が無い会社：plan は free・無料・0・始めた日は会社を作った日、請求書は []", async () => {
    const w = await world("無料", "free");
    const created = (await b.row<{ d: string }>(
      "select to_char((created_at at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD') as d from tenants where id = $1",
      [w.tenantId],
    ))!.d;
    const { r, j } = await read(w.tenantId);
    expect(r.status).toBe(200);
    const d = j.data as Json;
    expect(d["plan"]).toEqual({ plan_key: "free", name: "無料", price_monthly: 0, since: created });
    expect([(d["members"] as Json)["limit"], d["invoices"]]).toEqual([3, []]);
  });
});

describe("K-968 守りと失敗", () => {
  it("K968-API-013 書けない（DB が落ちる）：503・E-PAGE-003。契約・頼み・記録のどれも残らない（同じ取引で戻る）", async () => {
    const w = await world("落ちる");
    const q = await inquiry(w);
    const restore = await b.breakWrites("plan_change_requests", { tenant_id: w.tenantId });
    try {
      const x = await change(w.tenantId, { plan_key: "business", inquiry_id: q });
      expect([x.r.status, x.j["code"]]).toEqual([503, "E-PAGE-003"]);
    } finally {
      await restore();
    }
    expect(await currentKey(w)).toBe("team");
    expect(
      await b.n("select count(*) as n from ops_audit_events where target_tenant_id = $1 and action = 'plan.change'", [
        w.tenantId,
      ]),
    ).toBe(0);
  });

  it("K968-DB-001 2 層目：会社の人の文脈で app.ops_workspace_plan_change を直に呼ぶと 42501。中身の app.plan_change_for はアプリの接続から呼べない（PUBLIC・kaname_app とも）", async () => {
    const w = await world("2 層目");
    const c = await b.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await expect(
        c.query("select app.ops_workspace_plan_change($1, 'business', $2)", [w.tenantId, randomUUID()]),
      ).rejects.toMatchObject({ code: "42501" });
      await c.query("rollback");
    } finally {
      c.release();
    }
    const p = (await b.row<{ pub: boolean; app: boolean }>(
      `select has_function_privilege('public', 'app.plan_change_for(uuid, text, uuid)', 'execute') as pub,
              has_function_privilege('kaname_app', 'app.plan_change_for(uuid, text, uuid)', 'execute') as app`,
    ))!;
    expect([p.pub, p.app]).toEqual([false, false]);
  });

  it("K968-API-014 上限：changeOpsWorkspacePlan を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数。429 では変えない", async () => {
    const a = await world("上限 1");
    const w = await world("上限 2");
    b.limits["changeOpsWorkspacePlan"] = 1;
    try {
      expect((await change(a.tenantId, { plan_key: "business", inquiry_id: await inquiry(a) })).r.status).toBe(201);
      const x = await change(w.tenantId, { plan_key: "business", inquiry_id: await inquiry(w) });
      expect(x.r.status).toBe(429);
      const s = x.j["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
      expect(await currentKey(w)).toBe("team");
    } finally {
      delete b.limits["changeOpsWorkspacePlan"];
    }
  });
});
