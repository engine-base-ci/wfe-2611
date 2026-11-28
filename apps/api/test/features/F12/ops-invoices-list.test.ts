// K-983 運営の請求の一覧（listOpsInvoices・GET /api/v1/ops/invoices・お金を持つ運営の人）と、期限を過ぎた知らせ（管理者の鈴）。
//   テストの名前の頭の行 ID（K983-…）は 11_tickets/K-983.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   1 行は OpsInvoiceRow（K-1005 の 11 欄・K-982 の app.billing_invoice_row）。その月の請求書と、前の月の分でも期限を過ぎた物を上に出す。
//   期限を過ぎた知らせは時間で動く仕組みを作らず、運営が一覧を開いたときに、まだ知らせていない請求書の管理者に 1 回だけ鈴を書く
//   （期限を過ぎた＝billing.overdue・期限から 7 日＝billing.overdue_week）。共用の DB なので行は名前の頭（run）で見る
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startBillingOps,
  jstDay,
  jstMonth,
  OPS_ROW_KEYS,
  type BillingOps,
  type Who,
  type World,
} from "./billing-ops.harness.js";

let t: BillingOps;
let money: Who;
let noMoney: Who;

beforeAll(async () => {
  t = await startBillingOps("k983", ["ops-invoices-list"]);
  money = await t.opsWho("佐野", ["money"]);
  noMoney = await t.opsWho("問い合わせだけ", ["inquiry"]);
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const list = async (q = "", who: Who | null = money, ip?: string) => {
  const r = await t.call(who, "GET", `/ops/invoices${q}`, undefined, ip ? { ip } : {});
  return { r, j: await t.json(r) };
};
const rowsOf = (j: { data?: unknown }) => t.mine(j.data);
/** 期限を過ぎた行は前の月の分も全社から上に出る。共用の DB に古い行が多いと、この回の行が上限（既定 100）の外に落ちて見えなくなる。
 *  期限を過ぎた行を見る試験は、答えが上限で切れていない（自分の行が全部入っている）ことを先に確かめる。ほかは state で絞って期限を過ぎた行を外す */
const whole = <J extends { data?: unknown }>(j: J): J => {
  expect(
    (j.data as unknown[]).length,
    "一覧が上限の 100 件で切れている（共用の DB に期限を過ぎた古い行が多い）",
  ).toBeLessThan(100);
  return j;
};
const idsOf = (j: { data?: unknown }) => rowsOf(j).map((x) => x["id"]);
const notices = (w: World) =>
  t.n(
    "select count(*) as n from notifications where tenant_id = $1 and event_kind_id in ('billing.overdue', 'billing.overdue_week')",
    [w.tenantId],
  );

describe("K-983 一覧", () => {
  it("K983-API-001 形：200・1 行は 11 欄（workspace は id と name・plan_name・month・額・状態・入金の合計・差・期限・記録できるか）。答えは貯めない", async () => {
    const w = await t.world("形", { plan: "team" });
    const id = await t.invoice(w.tenantId, { month: "2015-01", amount: 16_500, dueOn: jstDay(20) });
    await t.pay(id, 6_500, jstDay());
    const { r, j } = await list("?month=2015-01&state=unpaid");
    expect(r.status, JSON.stringify(j)).toBe(200);
    const row = rowsOf(j).find((x) => x["id"] === id)!;
    expect(Object.keys(row).sort()).toEqual(OPS_ROW_KEYS);
    expect(row).toMatchObject({
      workspace: { id: w.tenantId, name: w.name },
      month: "2015-01",
      amount_total: 16_500,
      state: "unpaid",
      paid_total: 6_500,
      difference: 10_000,
      due_on: jstDay(20),
      can_record_payment: true,
    });
    expect(r.headers.get("cache-control") ?? "").toMatch(/private.*no-store|no-store.*private/);
  });

  it("K983-API-002 状態：払われた（paid・記録できない）・お支払い待ち・期限を過ぎた（期限が日本の今日より前で払われていない）", async () => {
    const w = await t.world("状態", { plan: "team" });
    const a = await t.invoice(w.tenantId, { month: "2015-02", amount: 16_500, dueOn: jstDay(5) });
    await t.pay(a, 16_500, jstDay());
    const b = await t.world("状態 2", { plan: "team" });
    const c = await t.invoice(b.tenantId, { month: "2015-02", amount: 16_500, dueOn: jstDay(5) });
    const d = await t.world("状態 3", { plan: "team" });
    const e = await t.invoice(d.tenantId, { month: "2015-02", amount: 16_500, dueOn: jstDay(-1) });
    const rows = rowsOf(whole((await list("?month=2015-02")).j));
    const st = (id: string) => rows.find((x) => x["id"] === id);
    expect([st(a)?.["state"], st(a)?.["can_record_payment"], st(c)?.["state"], st(e)?.["state"]]).toEqual([
      "paid",
      false,
      "unpaid",
      "overdue",
    ]);
  });

  it("K983-API-003 前の月の期限を過ぎた物も出す（上に）。前の月の払われた・期限の前の物は出さない", async () => {
    const w = await t.world("前の月", { plan: "team" });
    const old = await t.invoice(w.tenantId, { month: "2014-11", amount: 16_500, dueOn: jstDay(-40) });
    const oldPaid = await t.invoice(w.tenantId, { month: "2014-10", amount: 16_500, dueOn: jstDay(-70) });
    await t.pay(oldPaid, 16_500, jstDay(-71));
    const oldOpen = await t.invoice(w.tenantId, { month: "2014-12", amount: 16_500, dueOn: jstDay(3) });
    const now = await t.invoice(w.tenantId, { month: "2015-03", amount: 16_500, dueOn: jstDay(20) });
    const ids = idsOf(whole((await list("?month=2015-03")).j));
    expect(ids).toContain(old);
    expect(ids).toContain(now);
    expect(ids).not.toContain(oldPaid);
    expect(ids).not.toContain(oldOpen);
    expect(ids.indexOf(old)).toBeLessThan(ids.indexOf(now));
  });

  it("K983-API-004 並び：期限を過ぎた物が上（期限の古い順）、その後はワークスペースの名前の順", async () => {
    const z = await t.world("並び ん", { plan: "team" });
    const a = await t.world("並び あ", { plan: "team" });
    const late2 = await t.invoice(z.tenantId, { month: "2015-04", amount: 16_500, dueOn: jstDay(-2) });
    const late9 = await t.invoice(a.tenantId, { month: "2015-04", amount: 16_500, dueOn: jstDay(-9) });
    const b = await t.world("並び い", { plan: "team" });
    const open1 = await t.invoice(b.tenantId, { month: "2015-04", amount: 16_500, dueOn: jstDay(10) });
    const c = await t.world("並び う", { plan: "team" });
    const open2 = await t.invoice(c.tenantId, { month: "2015-04", amount: 16_500, dueOn: jstDay(10) });
    const ids = idsOf(whole((await list("?month=2015-04")).j)).filter((x) =>
      [late2, late9, open1, open2].includes(String(x)),
    );
    expect(ids).toEqual([late9, late2, open1, open2]);
  });

  it("K983-API-005 状態の絞り込み：state=overdue は期限を過ぎた物だけ・paid は払われた物だけ・unpaid はお支払い待ちだけ", async () => {
    const w = await t.world("絞り込み", { plan: "team" });
    const p = await t.invoice(w.tenantId, { month: "2015-05", amount: 16_500, dueOn: jstDay(5) });
    await t.pay(p, 16_500, jstDay());
    const v = await t.world("絞り込み 2", { plan: "team" });
    const u = await t.invoice(v.tenantId, { month: "2015-05", amount: 16_500, dueOn: jstDay(5) });
    const x = await t.world("絞り込み 3", { plan: "team" });
    const o = await t.invoice(x.tenantId, { month: "2015-05", amount: 16_500, dueOn: jstDay(-1) });
    const states = async (s: string) =>
      new Set(rowsOf(whole((await list(`?month=2015-05&state=${s}`)).j)).map((r) => r["state"]));
    expect([...(await states("overdue"))]).toEqual(["overdue"]);
    expect([...(await states("paid"))]).toEqual(["paid"]);
    expect([...(await states("unpaid"))]).toEqual(["unpaid"]);
    expect(idsOf((await list("?month=2015-05&state=paid")).j)).toEqual([p]);
    expect(idsOf((await list("?month=2015-05&state=unpaid")).j)).toEqual([u]);
    expect(idsOf(whole((await list("?month=2015-05&state=overdue")).j))).toContain(o);
  });

  it("K983-API-006 月を省くと日本の先月。下書き（出していない）・消した請求書は出ない", async () => {
    const w = await t.world("先月", { plan: "team" });
    const last = await t.invoice(w.tenantId, { month: jstMonth(-1), amount: 16_500, dueOn: jstDay(20) });
    const v = await t.world("下書き", { plan: "team" });
    const draft = await t.invoice(v.tenantId, {
      month: jstMonth(-1),
      amount: 16_500,
      dueOn: jstDay(20),
      issued: false,
    });
    const x = await t.world("消した", { plan: "team" });
    const gone = await t.invoice(x.tenantId, { month: jstMonth(-1), amount: 16_500, dueOn: jstDay(20), deleted: true });
    const unpaid = idsOf((await list("?state=unpaid")).j);
    expect(unpaid).toContain(last);
    expect(unpaid).not.toContain(draft);
    expect(unpaid).not.toContain(gone);
    const rows = rowsOf(whole((await list()).j));
    expect(rows.map((r) => r["id"])).toContain(last);
    expect(rows.filter((r) => r["state"] !== "overdue").every((r) => r["month"] === jstMonth(-1))).toBe(true);
  });
});

describe("K-983 期限を過ぎた知らせ", () => {
  it("K983-API-007 一覧を開くと、まだ知らせていない期限を過ぎた請求書の管理者にだけ billing.overdue が 1 通（payload は invoice_id・month・amount_total・due_on）。2 回目の一覧では増えない", async () => {
    const w = await t.world("知らせ", { plan: "team" });
    const id = await t.invoice(w.tenantId, { month: "2015-06", amount: 16_500, dueOn: jstDay(-1) });
    await list("?month=2015-06");
    expect(await t.bells(w, "billing.overdue")).toEqual({ admin: 1, payer: 0, staff: 0 });
    const p = (await t.row<{ p: Row }>(
      "select payload as p from notifications where tenant_id = $1 and event_kind_id = 'billing.overdue'",
      [w.tenantId],
    ))!.p;
    expect(p).toEqual({ invoice_id: id, month: "2015-06", amount_total: 16_500, due_on: jstDay(-1) });
    await list("?month=2015-06");
    expect((await t.bells(w, "billing.overdue")).admin).toBe(1);
  });

  it("K983-API-008 期限から 7 日：もう知らせた請求書は billing.overdue_week が 1 通増える。初めて見たのが 9 日後なら billing.overdue_week の 1 通だけ（overdue は出さない）", async () => {
    const a = await t.world("7 日 1", { plan: "team" });
    const ia = await t.invoice(a.tenantId, { month: "2015-07", amount: 16_500, dueOn: jstDay(-1) });
    await list("?month=2015-07");
    await t.f.admin.query("update invoices set due_on = due_on - 7 where id = $1", [ia]);
    await list("?month=2015-07");
    expect([(await t.bells(a, "billing.overdue")).admin, (await t.bells(a, "billing.overdue_week")).admin]).toEqual([
      1, 1,
    ]);
    const b = await t.world("7 日 2", { plan: "team" });
    await t.invoice(b.tenantId, { month: "2015-07", amount: 16_500, dueOn: jstDay(-9) });
    await list("?month=2015-07");
    expect([(await t.bells(b, "billing.overdue")).admin, (await t.bells(b, "billing.overdue_week")).admin]).toEqual([
      0, 1,
    ]);
    await list("?month=2015-07");
    expect((await t.bells(b, "billing.overdue_week")).admin).toBe(1);
  });

  it("K983-API-009 知らせない：期限の前・期限の当日・払われた請求書。期限を過ぎた後に払われた物には 7 日の知らせを出さない", async () => {
    const a = await t.world("期限の前", { plan: "team" });
    await t.invoice(a.tenantId, { month: "2015-08", amount: 16_500, dueOn: jstDay(1) });
    const b = await t.world("当日", { plan: "team" });
    await t.invoice(b.tenantId, { month: "2015-08", amount: 16_500, dueOn: jstDay(0) });
    const c = await t.world("払われた", { plan: "team" });
    const ic = await t.invoice(c.tenantId, { month: "2015-08", amount: 16_500, dueOn: jstDay(-3) });
    await t.pay(ic, 16_500, jstDay(-4));
    const d = await t.world("後で払われた", { plan: "team" });
    const id = await t.invoice(d.tenantId, { month: "2015-08", amount: 16_500, dueOn: jstDay(-2) });
    await list("?month=2015-08");
    await t.pay(id, 16_500, jstDay());
    await t.f.admin.query("update invoices set due_on = due_on - 7 where id = $1", [id]);
    await list("?month=2015-08");
    expect([await notices(a), await notices(b), await notices(c), await notices(d)]).toEqual([0, 0, 0, 1]);
  });

  it("K983-API-010 同時に 2 回開いても、知らせは 1 通", async () => {
    const w = await t.world("同時に", { plan: "team" });
    await t.invoice(w.tenantId, { month: "2015-09", amount: 16_500, dueOn: jstDay(-1) });
    await Promise.all([list("?month=2015-09"), list("?month=2015-09")]);
    expect((await t.bells(w, "billing.overdue")).admin).toBe(1);
  });

  it("K983-API-011 記録：知らせを出した請求書ごとに運営の記録と会社の記録に invoice.overdue_notice が 1 行（target_label「9 月分」・reason「期限を過ぎた」／「期限から 7 日」）", async () => {
    const w = await t.world("知らせの記録", { plan: "team" });
    const id = await t.invoice(w.tenantId, { month: "2015-09", amount: 16_500, dueOn: jstDay(-1) });
    await list("?month=2015-09");
    await t.f.admin.query("update invoices set due_on = due_on - 7 where id = $1", [id]);
    await list("?month=2015-09");
    const e = (
      await t.f.admin.query<{ tid: string; p: Row }>(
        "select target_id as tid, payload as p from ops_audit_events where target_tenant_id = $1 and action = 'invoice.overdue_notice' order by occurred_at",
        [w.tenantId],
      )
    ).rows;
    expect(e.map((x) => [x.tid, x.p["target_label"], x.p["reason"]])).toEqual([
      [id, "9 月分", "期限を過ぎた"],
      [id, "9 月分", "期限から 7 日"],
    ]);
    expect(
      await t.n("select count(*) as n from audit_events where tenant_id = $1 and action = 'invoice.overdue_notice'", [
        w.tenantId,
      ]),
    ).toBe(2);
  });

  it("K983-API-012 種類の表：billing.overdue と billing.overdue_week が設定の札・チケットに結ばない・行き先 /billing で在る", async () => {
    const { KINDS } = await import("../../../src/features/F7/notifications/kinds.js");
    for (const k of ["billing.overdue", "billing.overdue_week"])
      expect(KINDS[k], k).toEqual({ tag: "setting", ticket: false, href: "/billing" });
  });
});

describe("K-983 入口と守り", () => {
  it("K983-API-013 入口：ログインなし 401・会社の管理者 403・お金を持たない運営の人 403。どれも知らせを書かない", async () => {
    const w = await t.world("入口", { plan: "team" });
    await t.invoice(w.tenantId, { month: "2015-10", amount: 16_500, dueOn: jstDay(-1) });
    expect((await list("?month=2015-10", null)).r.status).toBe(401);
    expect((await list("?month=2015-10", w.admin)).r.status).toBe(403);
    expect((await list("?month=2015-10", noMoney)).r.status).toBe(403);
    expect(await notices(w)).toBe(0);
  });

  it("K983-API-014 問い合わせの値の形：month 2015-13・2015-1、state late、limit 0・101 は 422", async () => {
    for (const q of ["?month=2015-13", "?month=2015-1", "?state=late", "?limit=0", "?limit=101"]) {
      const { r } = await list(q);
      expect(r.status, q).toBe(422);
    }
  });

  it("K983-API-015 DB が落ちる（鈴が書けない）と 503 E-PAGE-003 で中身を返さず、知らせた印も記録も残らない", async () => {
    const w = await t.world("落ちる", { plan: "team" });
    const id = await t.invoice(w.tenantId, { month: "2015-11", amount: 16_500, dueOn: jstDay(-1) });
    const restore = await t.breakWrites("notifications", { tenant_id: w.tenantId });
    try {
      const { r, j } = await list("?month=2015-11");
      expect([r.status, j["code"], j.data]).toEqual([503, "E-PAGE-003", undefined]);
      const v = (await t.row<{ a: string | null }>("select overdue_noticed_at as a from invoices where id = $1", [
        id,
      ]))!;
      expect(v.a).toBeNull();
      expect(await t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1", [w.tenantId])).toBe(0);
    } finally {
      await restore();
    }
  });

  it("K983-API-016 上限を超えると 429・retry_after_sec は 1〜60 の整数", async () => {
    t.limits["listOpsInvoices"] = 1;
    try {
      const ip = "203.0.113.183";
      expect((await list("?month=2015-12", money, ip)).r.status).toBe(200);
      const { r, j } = await list("?month=2015-12", money, ip);
      expect(r.status).toBe(429);
      const s = j["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.limits["listOpsInvoices"];
    }
  });

  it("K983-DB-001 関数の中の 2 層目：会社の人の文脈で app.ops_invoices を直に呼ぶと 42501。security definer で PUBLIC は呼べない。当たる行が無い月は空の 200", async () => {
    const w = await t.world("2 層目");
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await expect(c.query("select app.ops_invoices('2015-12', null, 100)")).rejects.toMatchObject({ code: "42501" });
    } finally {
      await c.query("rollback");
      c.release();
    }
    const f = (await t.row<{ sd: boolean; pub: boolean }>(
      `select p.prosecdef as sd, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ops_invoices'`,
    ))!;
    expect([f.sd, f.pub]).toEqual([true, false]);
    const empty = await list("?month=2000-01");
    expect([empty.r.status, rowsOf(empty.j)]).toEqual([200, []]);
  });
});
