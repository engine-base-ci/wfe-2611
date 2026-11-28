// K-1013 請求書の PDF を作って置く（issueOpsInvoices の中・出す前に会社ごとに PDF を作り、関門 C4 の置き場に置いてから請求書の行を書く）。
//   テストの名前の頭の行 ID（K1013-…）は 11_tickets/K-1013.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   全部か無しか：PDF が 1 つでも置けない・DB が落ちたら、置いた PDF を消して請求書を 1 枚も残さない（後片付け）。
//   置き場は土台 billing-ops.harness.ts の覗ける置き場（store）。出した PDF は K-958 の downloadInvoicePdf で開ける。
//   月は 2017 年の昔の月を試験ごとに分けて使い、行は名前の頭（run）で見る
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startBillingOps, STEP, type BillingOps, type Who, type World } from "./billing-ops.harness.js";

let t: BillingOps;
let money: Who;

beforeAll(async () => {
  t = await startBillingOps("k1013", ["ops-invoices-issue", "billing-read"]);
  money = await t.opsWho("佐野", ["money"]);
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const issue = async (body: unknown) => {
  const r = await t.call(money, "POST", "/ops/invoices/issue", body, { stepUpAgoSec: STEP });
  return { r, j: await t.json(r) };
};
const paying = async (label: string): Promise<World> => {
  const w = await t.world(label);
  await t.contract(w, "team", "2016-01-01");
  return w;
};
const issuedCount = (w: World) =>
  t.n("select count(*) as n from invoices where tenant_id = $1 and issued_at is not null and deleted_at is null", [
    w.tenantId,
  ]);
const reset = () => {
  t.store.failPutAt = 0;
  t.store.failDelete = false;
};
const keysBefore = () => new Set(t.store.objects.keys());

describe("K-1013 出すと PDF が置かれる", () => {
  it("K1013-API-001 出す：出した請求書ごとに pdf_ref が入り、置き場のその鍵に application/pdf の中身（%PDF- で始まる）が在る。鍵はその会社の名前空間の中", async () => {
    const w = await paying("PDF");
    const { r, j } = await issue({ month: "2017-01" });
    expect(r.status, JSON.stringify(j)).toBe(201);
    const v = (await t.invoiceOf(w, "2017-01"))!;
    const ref = String(v["pdf_ref"]);
    expect(ref.startsWith(`tenants/${w.tenantId}/`)).toBe(true);
    const body = t.store.objects.get(ref);
    expect(body).toBeDefined();
    expect(Buffer.from(body!.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(t.store.puts.find((p) => p.key === ref)?.contentType).toBe("application/pdf");
  });

  it("K1013-API-002 下書き（dry_run）と、出す物が無い 409 E-BILL-003 では PDF を 1 つも置かない", async () => {
    await paying("下書きは置かない");
    const before = t.store.puts.length;
    expect((await issue({ month: "2017-02", dry_run: true })).r.status).toBe(201);
    expect((await issue({ month: "2017-02" })).r.status).toBe(201);
    const afterIssue = t.store.puts.length;
    const again = await issue({ month: "2017-02" });
    expect([again.r.status, again.j["code"]]).toEqual([409, "E-BILL-003"]);
    expect(afterIssue).toBeGreaterThan(before);
    expect(t.store.puts.length).toBe(afterIssue);
  });

  it("K1013-API-003 置き場が 2 つ目で落ちる：503 E-PAGE-003・請求書は 1 枚も無く、先に置いた PDF は消える（置き場に新しい物が残らない）", async () => {
    const a = await paying("置けない 1");
    const b = await paying("置けない 2");
    const keep = keysBefore();
    t.store.failPutAt = t.store.puts.length + 2;
    try {
      const { r, j } = await issue({ month: "2017-03" });
      expect([r.status, j["code"]]).toEqual([503, "E-PAGE-003"]);
      expect([await issuedCount(a), await issuedCount(b)]).toEqual([0, 0]);
      expect([...t.store.objects.keys()].filter((k) => !keep.has(k))).toEqual([]);
      expect(t.store.deletes.length).toBeGreaterThan(0);
    } finally {
      reset();
    }
  });

  it("K1013-API-004 PDF を置いた後に DB が落ちる（記録が書けない）：503 E-PAGE-003・請求書は 0・置いた PDF は全部消える", async () => {
    const w = await paying("DB が落ちる");
    const keep = keysBefore();
    const restore = await t.breakWrites("ops_audit_events", { target_tenant_id: w.tenantId });
    try {
      const { r, j } = await issue({ month: "2017-04" });
      expect([r.status, j["code"]]).toEqual([503, "E-PAGE-003"]);
      expect(await issuedCount(w)).toBe(0);
      expect([...t.store.objects.keys()].filter((k) => !keep.has(k))).toEqual([]);
    } finally {
      await restore();
    }
  });

  it("K1013-API-005 後片付けも落ちる：503 のまま。ログに「[ops] invoices-pdf の後片付けに失敗した（N 件）」が 1 行で、会社の名前・鍵は出ない", async () => {
    const w = await paying("片付けも落ちる");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restore = await t.breakWrites("ops_audit_events", { target_tenant_id: w.tenantId });
    t.store.failDelete = true;
    try {
      const { r } = await issue({ month: "2017-05" });
      expect(r.status).toBe(503);
      const logs = [...warn.mock.calls, ...err.mock.calls].flat().map(String);
      expect(logs.filter((l) => /^\[ops\] invoices-pdf の後片付けに失敗した（\d+ 件）$/.test(l))).toHaveLength(1);
      expect(logs.join("\n")).not.toContain(w.name);
      expect(logs.join("\n")).not.toContain(`tenants/${w.tenantId}`);
    } finally {
      await restore();
      reset();
      warn.mockRestore();
      err.mockRestore();
    }
  });

  it("K1013-API-006 出した PDF は会社の管理者が downloadInvoicePdf で開ける（200 { url, expires_at }）", async () => {
    const w = await paying("開ける");
    expect((await issue({ month: "2017-06" })).r.status).toBe(201);
    const id = String((await t.invoiceOf(w, "2017-06"))!["id"]);
    const r = await t.call(w.admin, "GET", `/invoices/${id}/pdf`);
    const j = await t.json(r);
    expect(r.status, JSON.stringify(j)).toBe(200);
    expect(Object.keys(j.data as Row).sort()).toEqual(["expires_at", "url"]);
  });

  it("K1013-DB-001 中身が変わった：作った PDF の合計と今の行が違うと app.ops_invoices_issue は changed を返し、請求書を書かない", async () => {
    const w = await paying("変わった");
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'ops', true), set_config('app.tenant_id', '', true), set_config('app.user_id', $1, true)",
        [money.id],
      );
      const pdf = {
        [w.tenantId]: {
          invoice_id: "0f000000-0000-4000-8000-000000001013",
          pdf_ref: `tenants/${w.tenantId}/x`,
          total: 1,
        },
      };
      const got = (await c.query<{ r: Row }>("select app.ops_invoices_issue('2017-07', false, $1::jsonb) as r", [pdf]))
        .rows[0]!.r;
      expect(got["error"]).toBe("changed");
      expect(
        Number(
          (await c.query<{ n: string }>("select count(*) as n from invoices where tenant_id = $1", [w.tenantId]))
            .rows[0]!.n,
        ),
      ).toBe(0);
    } finally {
      await c.query("rollback");
      c.release();
    }
  });

  it("K1013-DB-002 出す会社が増えた：今の行に在る会社のうち 1 社だけの p_pdf（額は合っている）を渡すと app.ops_invoices_issue は changed を返し、どの会社にも請求書を書かない", async () => {
    const a = await paying("増えた 1");
    const b = await paying("増えた 2");
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'ops', true), set_config('app.tenant_id', '', true), set_config('app.user_id', $1, true)",
        [money.id],
      );
      const lines = (await c.query<{ v: Row[] }>("select app.ops_invoice_lines('2017-08') as v")).rows[0]!.v;
      const lineA = lines.find((l) => (l["workspace"] as Row)["id"] === a.tenantId)!;
      expect(lines.some((l) => (l["workspace"] as Row)["id"] === b.tenantId)).toBe(true);
      const pdf = {
        [a.tenantId]: {
          invoice_id: "0f000000-0000-4000-8000-000000002013",
          pdf_ref: `tenants/${a.tenantId}/x`,
          total: Number(lineA["total"]),
        },
      };
      const got = (await c.query<{ r: Row }>("select app.ops_invoices_issue('2017-08', false, $1::jsonb) as r", [pdf]))
        .rows[0]!.r;
      expect(got["error"]).toBe("changed");
      const n = async (tid: string) =>
        Number(
          (await c.query<{ n: string }>("select count(*) as n from invoices where tenant_id = $1", [tid])).rows[0]!.n,
        );
      expect([await n(a.tenantId), await n(b.tenantId)]).toEqual([0, 0]);
    } finally {
      await c.query("rollback");
      c.release();
    }
  });
});
