// K-982 運営が入金を 1 件ずつ記録する（recordPayment・POST /api/v1/ops/invoices/:id/payments・お金を持つ運営の人・本人確認の取り直し）。
//   テストの名前の頭の行 ID（K982-…）は 11_tickets/K-982.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えは OpsInvoiceRow（K-1005 の 10 欄）。入金の合計が請求の額と同じときだけ払われた（足りない・多いはお支払い待ちのまま差を残す・D-156.32）。
//   打ち間違いは「取り消す」で打ち消しの行（負の額）を足す（消さない・D-156.32）。請求書の行は土台 billing.harness.ts の invoice で DB に直に置く
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  startBillingOps,
  isFlat,
  jstDay,
  OPS_ROW_KEYS,
  STEP,
  type BillingOps,
  type Who,
  type World,
} from "./billing-ops.harness.js";

let t: BillingOps;
let money: Who;
let noMoney: Who;
let w: World;

beforeAll(async () => {
  t = await startBillingOps("k982", ["ops-invoice-payments"]);
  money = await t.opsWho("佐野", ["money"]);
  noMoney = await t.opsWho("中を見るだけ", ["peek"]);
  w = await t.world("入金", { plan: "team" });
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const pay = async (
  id: string,
  body: unknown,
  who: Who | null = money,
  step: number | undefined = STEP,
  ip?: string,
) => {
  const r = await t.call(who, "POST", `/ops/invoices/${id}/payments`, body, {
    ...(step === undefined ? {} : { stepUpAgoSec: step }),
    ...(ip ? { ip } : {}),
  });
  return { r, j: await t.json(r) };
};
let seq = 0;
/** 期限が先（20 日後）の 16,500 円の請求書。同じ会社の同じ月は 1 枚（K-981 の一意の索引）なので、月を 2001 年から 1 つずつずらす */
const bill = (o: { dueIn?: number; amount?: number } = {}) => {
  seq += 1;
  const month = `${2000 + Math.ceil(seq / 12)}-${String(((seq - 1) % 12) + 1).padStart(2, "0")}`;
  return t.invoice(w.tenantId, { month, amount: o.amount ?? 16_500, dueOn: jstDay(o.dueIn ?? 20) });
};
const payments = (id: string) => t.n("select count(*) as n from payments where invoice_id = $1", [id]);
const status = async (id: string) =>
  (await t.row<{ s: string }>("select status_id as s from invoices where id = $1", [id]))!.s;
const firstPaymentId = async (id: string) =>
  (await t.row<{ id: string }>(
    "select id from payments where invoice_id = $1 and amount > 0 order by created_at limit 1",
    [id],
  ))!.id;

describe("K-982 入金を記録する", () => {
  it("K982-API-001 同じ額：201・答えは 10 欄（workspace は id と name）・払われた・入金の合計 16500・差 0・もう記録できない。請求書の status_id も paid", async () => {
    const id = await bill();
    const { r, j } = await pay(id, { amount: 16_500, paid_on: jstDay(-1), payer_name: "キタムラデザイン" });
    expect(r.status, JSON.stringify(j)).toBe(201);
    const d = j.data as Row;
    expect(Object.keys(d).sort()).toEqual(OPS_ROW_KEYS);
    expect(d["workspace"]).toEqual({ id: w.tenantId, name: w.name });
    expect([d["id"], d["state"], d["amount_total"], d["paid_total"], d["difference"], d["can_record_payment"]]).toEqual(
      [id, "paid", 16_500, 16_500, 0, false],
    );
    expect(await status(id)).toBe("paid");
  });

  it("K982-API-002 足りない：お支払い待ちのまま差 6500 を残す（期限を過ぎていれば期限を過ぎた）。2 回目の入金で足りれば払われた", async () => {
    const id = await bill();
    const a = await pay(id, { amount: 10_000, paid_on: jstDay(-1) });
    expect([
      a.r.status,
      (a.j.data as Row)["state"],
      (a.j.data as Row)["difference"],
      (a.j.data as Row)["can_record_payment"],
    ]).toEqual([201, "unpaid", 6_500, true]);
    expect(await status(id)).toBe("issued");
    const late = await bill({ dueIn: -3 });
    expect(((await pay(late, { amount: 1_000, paid_on: jstDay() })).j.data as Row)["state"]).toBe("overdue");
    const b = await pay(id, { amount: 6_500, paid_on: jstDay() });
    expect([(b.j.data as Row)["state"], (b.j.data as Row)["paid_total"]]).toEqual(["paid", 16_500]);
  });

  it("K982-API-003 多い：払われたにせず、お支払い待ちのまま差は負の数（-3500）で残す", async () => {
    const id = await bill();
    const d = (await pay(id, { amount: 20_000, paid_on: jstDay() })).j.data as Row;
    expect([d["state"], d["paid_total"], d["difference"]]).toEqual(["unpaid", 20_000, -3_500]);
    expect(await status(id)).toBe("issued");
  });

  it("K982-API-004 入金の行：その会社・その請求書・入金日・額・振込名義・振込（transfer）・記録した運営の人。名義を省くと空", async () => {
    const id = await bill();
    await pay(id, { amount: 5_000, paid_on: "2026-11-02", payer_name: "ミナトキカク" });
    await pay(id, { amount: 1_000, paid_on: "2026-11-03" });
    const rows = (
      await t.f.admin.query<{ t: string; d: string; a: string; n: string | null; m: string; by: string }>(
        "select tenant_id as t, paid_on::text as d, amount::text as a, payer_name as n, method_id as m, recorded_by_ops_member_id as by from payments where invoice_id = $1 order by paid_on",
        [id],
      )
    ).rows;
    expect(rows.map((x) => [x.t, x.d, Number(x.a), x.n, x.m, x.by])).toEqual([
      [w.tenantId, "2026-11-02", 5_000, "ミナトキカク", "transfer", money.id],
      [w.tenantId, "2026-11-03", 1_000, null, "transfer", money.id],
    ]);
  });
});

describe("K-982 取り消す", () => {
  it("K982-API-005 取り消す：打ち消しの行（負の同じ額・取り消した入金の id）を足し、元の行は消さない。払われたからお支払い待ちに戻り、status_id も issued。答えの payments は元の入金 1 件で reversed true（D-156.44）", async () => {
    const id = await bill();
    await pay(id, { amount: 16_500, paid_on: jstDay() });
    const p = await firstPaymentId(id);
    const { r, j } = await pay(id, { amount: 16_500, paid_on: jstDay(), reverses_payment_id: p });
    expect(r.status, JSON.stringify(j)).toBe(201);
    expect([(j.data as Row)["state"], (j.data as Row)["paid_total"], (j.data as Row)["difference"]]).toEqual([
      "unpaid",
      0,
      16_500,
    ]);
    const rev = (await t.row<{ a: string; rv: string; del: string | null }>(
      "select amount::text as a, reverses_payment_id as rv, deleted_at as del from payments where invoice_id = $1 and amount < 0",
      [id],
    ))!;
    expect([Number(rev.a), rev.rv, rev.del]).toEqual([-16_500, p, null]);
    expect(await payments(id)).toBe(2);
    expect(await status(id)).toBe("issued");
    const list = (j.data as Row)["payments"] as Row[];
    expect(list.map((x) => [x["id"], x["amount"], x["reversed"]])).toEqual([[p, 16_500, true]]);
  });

  it("K982-API-006 2 回目の取り消し・打ち消しの行の取り消しは 409 E-BILL-004 で欄も details も無く、行は増えない", async () => {
    const id = await bill();
    await pay(id, { amount: 16_500, paid_on: jstDay() });
    const p = await firstPaymentId(id);
    expect((await pay(id, { amount: 16_500, paid_on: jstDay(), reverses_payment_id: p })).r.status).toBe(201);
    const again = await pay(id, { amount: 16_500, paid_on: jstDay(), reverses_payment_id: p });
    expect([again.r.status, again.j["code"], isFlat(again.j)]).toEqual([409, "E-BILL-004", true]);
    const neg = (await t.row<{ id: string }>("select id from payments where invoice_id = $1 and amount < 0", [id]))!.id;
    const ofNeg = await pay(id, { amount: 16_500, paid_on: jstDay(), reverses_payment_id: neg });
    expect([ofNeg.r.status, ofNeg.j["code"]]).toEqual([409, "E-BILL-004"]);
    expect(await payments(id)).toBe(2);
  });

  it("K982-API-007 取り消す額が入金の額と違うと 409 E-BILL-005 で欄も details も無く、行は増えない", async () => {
    const id = await bill();
    await pay(id, { amount: 16_500, paid_on: jstDay() });
    const { r, j } = await pay(id, {
      amount: 16_000,
      paid_on: jstDay(),
      reverses_payment_id: await firstPaymentId(id),
    });
    expect([r.status, j["code"], isFlat(j)]).toEqual([409, "E-BILL-005", true]);
    expect(await payments(id)).toBe(1);
  });

  it("K982-API-008 取り消す入金が無い・別の請求書の入金なら 404 で欄も details も無く、行は増えない", async () => {
    const a = await bill();
    const b = await bill();
    await pay(b, { amount: 16_500, paid_on: jstDay() });
    for (const rv of [await firstPaymentId(b), "0f000000-0000-4000-8000-000000000982"]) {
      const { r, j } = await pay(a, { amount: 16_500, paid_on: jstDay(), reverses_payment_id: rv });
      expect([r.status, isFlat(j)], rv).toEqual([404, true]);
    }
    expect([await payments(a), await payments(b)]).toEqual([0, 1]);
  });
});

describe("K-982 入口と守り", () => {
  it("K982-API-009 請求書が無い・出していない下書き・消した・運営の会社の行なら 404 で欄も details も無く、入金の行を作らない", async () => {
    const draft = await t.invoice(w.tenantId, { month: "2026-09", dueOn: jstDay(20), issued: false });
    const gone = await t.invoice(w.tenantId, { month: "2026-08", dueOn: jstDay(20), deleted: true });
    for (const id of [draft, gone, "0f000000-0000-4000-8000-000000009820"]) {
      const { r, j } = await pay(id, { amount: 16_500, paid_on: jstDay() });
      expect([r.status, isFlat(j)], id).toEqual([404, true]);
    }
    expect(await t.n("select count(*) as n from payments where invoice_id = any($1::uuid[])", [[draft, gone]])).toBe(0);
  });

  it("K982-API-010 記録：運営の記録と会社の記録に payment.record が 1 行ずつ（対象 payments とその id・target_label「10 月分 ¥16,500」）。取り消しは reason「入金の取り消し」", async () => {
    const me = await t.world("記録の会社", { plan: "team" });
    const id = await t.invoice(me.tenantId, { month: "2026-10", amount: 16_500, dueOn: jstDay(20) });
    await pay(id, { amount: 16_500, paid_on: jstDay() });
    const p = await firstPaymentId(id);
    await pay(id, { amount: 16_500, paid_on: jstDay(), reverses_payment_id: p });
    const e = (
      await t.f.admin.query<{ ty: string; tid: string; pl: Row }>(
        "select target_type as ty, target_id as tid, payload as pl from ops_audit_events where target_tenant_id = $1 and action = 'payment.record' order by occurred_at",
        [me.tenantId],
      )
    ).rows;
    expect(e.map((x) => [x.ty, x.pl["target_label"], x.pl["reason"] ?? null])).toEqual([
      ["payments", "10 月分 ¥16,500", null],
      ["payments", "10 月分 ¥16,500", "入金の取り消し"],
    ]);
    expect(e[0]!.tid).toBe(p);
    expect(
      await t.n("select count(*) as n from audit_events where tenant_id = $1 and action = 'payment.record'", [
        me.tenantId,
      ]),
    ).toBe(2);
  });

  it("K982-API-011 本人確認：取り直していない・16 分前は 403 STEP_UP_REQUIRED で行を作らない。14 分前なら記録できる", async () => {
    const id = await bill();
    for (const step of [undefined, 16 * 60]) {
      const { r, j } = await pay(id, { amount: 16_500, paid_on: jstDay() }, money, step);
      expect([r.status, j["code"]], String(step)).toEqual([403, "STEP_UP_REQUIRED"]);
    }
    expect(await payments(id)).toBe(0);
    expect((await pay(id, { amount: 16_500, paid_on: jstDay() }, money, 14 * 60)).r.status).toBe(201);
  });

  it("K982-API-012 入口：ログインなし 401・会社の管理者 403・お金を持たない運営の人 403。どれも行を作らない", async () => {
    const id = await bill();
    expect((await pay(id, { amount: 16_500, paid_on: jstDay() }, null)).r.status).toBe(401);
    expect((await pay(id, { amount: 16_500, paid_on: jstDay() }, w.admin)).r.status).toBe(403);
    expect((await pay(id, { amount: 16_500, paid_on: jstDay() }, noMoney)).r.status).toBe(403);
    expect(await payments(id)).toBe(0);
  });

  it('K982-API-013 形の誤り：額 0・-1・1.5・"1000"・無い、入金日 2026/11/02・無い、名義 101 字、取り消す id が uuid でない、知らない欄、道の id が uuid でないは 422', async () => {
    const id = await bill();
    const ok = { amount: 1_000, paid_on: "2026-11-02" };
    for (const body of [
      { ...ok, amount: 0 },
      { ...ok, amount: -1 },
      { ...ok, amount: 1.5 },
      { ...ok, amount: "1000" },
      { paid_on: "2026-11-02" },
      { ...ok, paid_on: "2026/11/02" },
      { amount: 1_000 },
      { ...ok, payer_name: "あ".repeat(101) },
      { ...ok, reverses_payment_id: "abc" },
      { ...ok, invoice_id: id },
    ]) {
      expect((await pay(id, body)).r.status, JSON.stringify(body)).toBe(422);
    }
    expect((await pay("not-a-uuid", ok)).r.status).toBe(422);
    expect(await payments(id)).toBe(0);
  });

  it("K982-API-014 同時：別々の入金 2 件は両方 201 で合計が正しく払われた。同じ入金の取り消しを同時に 2 回は 201 と 409 で打ち消しの行は 1 つ", async () => {
    const id = await bill();
    const [a, b] = await Promise.all([
      pay(id, { amount: 10_000, paid_on: jstDay() }),
      pay(id, { amount: 6_500, paid_on: jstDay() }),
    ]);
    expect([a.r.status, b.r.status]).toEqual([201, 201]);
    expect(await status(id)).toBe("paid");
    const p = (await t.row<{ id: string }>("select id from payments where invoice_id = $1 and amount = 10000", [id]))!
      .id;
    const [x, y] = await Promise.all([
      pay(id, { amount: 10_000, paid_on: jstDay(), reverses_payment_id: p }),
      pay(id, { amount: 10_000, paid_on: jstDay(), reverses_payment_id: p }),
    ]);
    expect([x.r.status, y.r.status].sort()).toEqual([201, 409]);
    expect(await t.n("select count(*) as n from payments where invoice_id = $1 and amount < 0", [id])).toBe(1);
  });

  it("K982-API-015 DB が落ちる（記録が書けない）と 503 E-PAGE-003 で入金の行は残らず、状態も変わらない。ログに額と名義が出ない", async () => {
    const id = await bill();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restore = await t.breakWrites("ops_audit_events", { target_tenant_id: w.tenantId });
    try {
      const { r, j } = await pay(id, { amount: 16_500, paid_on: jstDay(), payer_name: "メイギノジ" });
      expect([r.status, j["code"]]).toEqual([503, "E-PAGE-003"]);
      expect([await payments(id), await status(id)]).toEqual([0, "issued"]);
      const logs = [...warn.mock.calls, ...err.mock.calls].flat().map(String).join("\n");
      expect(logs).not.toContain("メイギノジ");
      expect(logs).not.toContain("16500");
    } finally {
      await restore();
      warn.mockRestore();
      err.mockRestore();
    }
  });

  it("K982-API-016 上限を超えると 429・retry_after_sec は 1〜60 の整数・429 では行を作らない", async () => {
    const id = await bill();
    t.limits["recordPayment"] = 1;
    try {
      const ip = "203.0.113.182";
      expect((await pay(id, { amount: 1_000, paid_on: jstDay() }, money, STEP, ip)).r.status).toBe(201);
      const { r, j } = await pay(id, { amount: 1_000, paid_on: jstDay() }, money, STEP, ip);
      expect(r.status).toBe(429);
      const s = j["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
      expect(await payments(id)).toBe(1);
    } finally {
      delete t.limits["recordPayment"];
    }
  });

  it("K982-DB-001 関数の中の 2 層目：会社の人の文脈で app.ops_payment_record を直に呼ぶと 42501。security definer で PUBLIC は呼べない。行を作る関数 app.billing_invoice_row はアプリから呼べない", async () => {
    const id = await bill();
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await expect(
        c.query("select app.ops_payment_record($1, 1000, current_date, null, null)", [id]),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await c.query("rollback");
      c.release();
    }
    const f = (await t.row<{ sd: boolean; pub: boolean; app: boolean }>(
      `select p.prosecdef as sd, has_function_privilege('public', p.oid, 'execute') as pub,
              has_function_privilege('kaname_app', (select oid from pg_proc where proname = 'billing_invoice_row' limit 1), 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'ops_payment_record'`,
    ))!;
    expect([f.sd, f.pub, f.app]).toEqual([true, false, false]);
  });
});
