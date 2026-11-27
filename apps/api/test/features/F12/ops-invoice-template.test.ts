// K-1107 請求書の型の口と DB（getOpsInvoiceTemplate・GET /api/v1/ops/invoice-template／updateOpsInvoiceTemplate・PUT 同じ道）。
//   テストの名前の頭の行 ID（K1107-…）は 11_tickets/K-1107.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   型は運営の会社に 1 行（D-156.60）。保存の前は設定の値（土台の config.billing）を初めの値に出す。PDF と顧客の振込先は 1 か所の関数で読む。
//   型の行は試験の前と後に消す（ほかの試験の PDF・振込先は設定の値のまま見るため・G-10）。土台は billing-ops.harness.ts（K-981）
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startBillingOps,
  INVOICE_NO,
  ISSUER,
  OPS_TENANT,
  STEP,
  type BillingOps,
  type Who,
  type World,
} from "./billing-ops.harness.js";
import { PAYEE, TERMS } from "./billing.harness.js";
import { loadInvoiceIssuer } from "../../../src/features/F12/billing/issuer.js";

let t: BillingOps;
let money: Who;
let noMoney: Who;
let w: World;
const PATH = "/ops/invoice-template";
const KEYS = ["address", "company", "contact", "note", "payee", "reg_no", "updated_at", "updated_by_name", "version"];
const BODY = {
  company: "合同会社カナメ運営",
  address: "〒530-0001 大阪府大阪市北区梅田 1-1-1 梅田ビル 10 階",
  reg_no: "T1234567890123",
  contact: "info@kaname.example",
  payee: "みらい銀行 梅田支店 普通 1234567 カナメウンエイ",
  note: "お振込手数料はご負担をお願いします。",
};
const CFG = { terms: TERMS, payeeLines: PAYEE, invoiceNo: INVOICE_NO, issuer: ISSUER };

type Row = Record<string, unknown>;
const clear = () => t.f.admin.query("delete from ops_invoice_templates where tenant_id = $1", [OPS_TENANT]);
const get = async (who: Who | null = money) => {
  const r = await t.call(who, "GET", PATH);
  return { r, j: await t.json(r) };
};
const put = async (body: unknown, o: { who?: Who; step?: number | null } = {}) => {
  const r = await t.call(o.who ?? money, "PUT", PATH, body, o.step === null ? {} : { stepUpAgoSec: o.step ?? STEP });
  return { r, j: await t.json(r) };
};
/** 運営の記録は追記専用（0003_audit.sql）で消せないので、各試験の頭の数（base）との差で数える */
let base = 0;
const rawAudits = () =>
  t.n("select count(*) as n from ops_audit_events where action = 'invoice_template.update' and target_tenant_id = $1", [
    OPS_TENANT,
  ]);
const audits = async () => (await rawAudits()) - base;
const saved = () => t.row<Row>("select * from ops_invoice_templates where tenant_id = $1", [OPS_TENANT]);

beforeAll(async () => {
  t = await startBillingOps("k1107", ["ops-invoice-template", "billing-read"]);
  money = await t.opsWho("佐野", ["money"]);
  noMoney = await t.opsWho("受付", ["inquiry"]);
  w = await t.world("型を読む会社");
});
beforeEach(async () => {
  await clear();
  base = await rawAudits();
});
afterAll(async () => {
  await clear();
  await t.close();
});

describe("K-1107 読む・直す", () => {
  it("K1107-API-001 まだ保存していない：200・no-store・鍵ちょうど 9・設定の出す人・登録番号・振込先（2 行を空白でつないだ 1 行）・version 0・直した人と時刻は null", async () => {
    const { r, j } = await get();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = j.data as Row;
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect([d["company"], d["reg_no"], d["payee"], d["version"]]).toEqual([ISSUER, INVOICE_NO, PAYEE.join(" "), 0]);
    expect([d["updated_at"], d["updated_by_name"]]).toEqual([null, null]);
  });

  it("K1107-API-002 直す：版 0 で 6 欄を送ると 200・送った値・version 1・直した人の名前。読み直すと同じ", async () => {
    const { r, j } = await put({ ...BODY, version: 0 });
    expect(r.status, JSON.stringify(j)).toBe(200);
    const d = j.data as Row;
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect({ ...d, updated_at: null }).toEqual({ ...BODY, version: 1, updated_at: null, updated_by_name: "運営 佐野" });
    expect(typeof d["updated_at"]).toBe("string");
    expect((await get()).j.data).toEqual(d);
  });

  it("K1107-API-003 表記ゆらぎ：全角の英数字・全角の空白・前後の空白は直って保存される（全角の登録番号も半角に直して受ける）", async () => {
    const { r, j } = await put({
      ...BODY,
      company: "　合同会社ＫＡＮＡＭＥ運営 ",
      reg_no: "Ｔ１２３４５６７８９０１２３", // 表記ゆらぎの決まり：全角は直して受ける（PM の決め 2026-11-28）
      address: " 大阪府大阪市北区梅田１－１－１　",
      contact: " ｉｎｆｏ＠ｋａｎａｍｅ.example ",
      payee: " みらい銀行　普通　１２３４５６７ ",
      note: " 手数料はご負担ください ",
      version: 0,
    });
    expect(r.status, JSON.stringify(j)).toBe(200);
    const d = j.data as Row;
    expect([d["company"], d["address"], d["contact"], d["payee"], d["note"]]).toEqual([
      "合同会社KANAME運営",
      "大阪府大阪市北区梅田1-1-1",
      "info@kaname.example",
      "みらい銀行 普通 1234567",
      "手数料はご負担ください",
    ]);
    expect(d["reg_no"]).toBe("T1234567890123");
  });

  it("K1107-API-004 形の誤り：欄が無い・登録番号が T123・101 字・空白だけ・501 字の備考・知らない欄・version が -1 と字・NUL はどれも 422 で、何も変わらない", async () => {
    const { company: _c, ...noCompany } = BODY;
    void _c;
    const bad: unknown[] = [
      { ...noCompany, version: 0 },
      { ...BODY, reg_no: "T123", version: 0 },
      { ...BODY, company: "あ".repeat(101), version: 0 },
      { ...BODY, address: "　 ", version: 0 },
      { ...BODY, note: "あ".repeat(501), version: 0 },
      { ...BODY, tenant_id: OPS_TENANT, version: 0 },
      { ...BODY, version: -1 },
      { ...BODY, version: "0" },
      { ...BODY, payee: "みらい銀行\u0000", version: 0 },
    ];
    for (const b of bad) {
      const { r } = await put(b);
      expect(r.status, JSON.stringify(b).slice(0, 80)).toBe(422);
    }
    expect(await saved()).toBeUndefined();
    expect(await audits()).toBe(0);
  });

  it("K1107-API-005 古い版：版 1 の後に版 0 で送ると 409・E-BILL-007・欄も details も無い・値は前のまま", async () => {
    expect((await put({ ...BODY, version: 0 })).r.status).toBe(200);
    const { r, j } = await put({ ...BODY, company: "別の会社", version: 0 });
    expect([r.status, j["code"]]).toEqual([409, "E-BILL-007"]);
    expect(j["field"]).toBeUndefined();
    expect(j["details"]).toBeUndefined();
    expect((await saved())!["company"]).toBe(BODY.company);
  });

  it("K1107-API-006 同じ値：前後の空白だけ違う同じ値を今の版で送ると 200・version は変わらず・記録の数も同じ", async () => {
    expect((await put({ ...BODY, version: 0 })).r.status).toBe(200);
    const before = await audits();
    const { r, j } = await put({ ...BODY, company: ` ${BODY.company} `, version: 1 });
    expect(r.status).toBe(200);
    expect((j.data as Row)["version"]).toBe(1);
    expect(await audits()).toBe(before);
  });

  it("K1107-API-007 記録：直すと invoice_template.update が 1 行・payload.fields は変えた欄の名前だけで、値の字が無い", async () => {
    expect((await put({ ...BODY, version: 0 })).r.status).toBe(200);
    expect((await put({ ...BODY, payee: "別の銀行 普通 7654321", version: 1 })).r.status).toBe(200);
    const last = (await t.row<{ payload: Row }>(
      "select payload from ops_audit_events where action = 'invoice_template.update' and target_tenant_id = $1 order by occurred_at desc limit 1",
      [OPS_TENANT],
    ))!;
    expect(last.payload["fields"]).toEqual(["payee"]);
    const text = JSON.stringify(last.payload);
    expect(text).not.toContain("別の銀行");
    expect(text).not.toContain(BODY.address);
    expect(await audits()).toBe(2);
  });

  it("K1107-API-008 本人確認：取り直していない・20 分前の取り直しは 403 STEP_UP_REQUIRED・値は前のまま", async () => {
    for (const step of [null, 20 * 60]) {
      const { r, j } = await put({ ...BODY, version: 0 }, { step });
      expect([r.status, j["code"]]).toEqual([403, "STEP_UP_REQUIRED"]);
    }
    expect(await saved()).toBeUndefined();
  });

  it("K1107-API-009 入口：お金を持たない運営の人は 2 本とも 403・会社の管理者は 403・ログインなしは 401", async () => {
    expect((await get(noMoney)).r.status).toBe(403);
    expect((await put({ ...BODY, version: 0 }, { who: noMoney })).r.status).toBe(403);
    expect((await get(w.admin)).r.status).toBe(403);
    expect((await put({ ...BODY, version: 0 }, { who: w.admin })).r.status).toBe(403);
    expect((await get(null)).r.status).toBe(401);
    expect(await saved()).toBeUndefined();
  });
});

describe("K-1107 1 か所の関数", () => {
  it("K1107-API-010 PDF に効く：保存の前の loadInvoiceIssuer は設定の値・保存の後は保存した会社名・住所・登録番号・連絡先・備考と振込先 1 行", async () => {
    const before = await loadInvoiceIssuer(t.f.pool, CFG as never);
    expect([before.name, before.invoiceNo, before.payeeLines]).toEqual([ISSUER, INVOICE_NO, PAYEE]);
    expect((await put({ ...BODY, version: 0 })).r.status).toBe(200);
    const after = await loadInvoiceIssuer(t.f.pool, CFG as never);
    expect(after).toEqual({
      name: BODY.company,
      address: BODY.address,
      invoiceNo: BODY.reg_no,
      contact: BODY.contact,
      note: BODY.note,
      payeeLines: [BODY.payee],
    });
  });

  it("K1107-API-011 顧客の振込先に効く：会社の管理者の getBilling の payee.lines は、保存の前は設定の 2 行・保存の後は保存した振込先 1 行", async () => {
    const read = async () => {
      const r = await t.call(w.admin, "GET", "/workspace/billing");
      expect(r.status).toBe(200);
      return ((await t.json(r)).data as Row)["payee"];
    };
    expect(await read()).toEqual({ lines: PAYEE });
    expect((await put({ ...BODY, version: 0 })).r.status).toBe(200);
    expect(await read()).toEqual({ lines: [BODY.payee] });
  });
});

describe("K-1107 失敗と揺れ", () => {
  it("K1107-API-012 書けない：型の表への書き込みを落とすと 503・E-PAGE-003・値も版も前のまま・記録が増えない・ログに振込先の字が無い", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restore = await t.breakWrites("ops_invoice_templates", { tenant_id: OPS_TENANT });
    try {
      const { r, j } = await put({ ...BODY, version: 0 });
      expect([r.status, j["code"]]).toEqual([503, "E-PAGE-003"]);
      expect(await saved()).toBeUndefined();
      expect(await audits()).toBe(0);
      const logs = [...warn.mock.calls, ...err.mock.calls].flat().map(String).join("\n");
      expect(logs).not.toContain(BODY.payee);
    } finally {
      await restore();
      warn.mockRestore();
      err.mockRestore();
    }
  });

  it("K1107-API-013 同時に 2 人：版 1 から 2 人が同時に保存すると 200 と 409 E-BILL-007 が 1 つずつ・version は 2", async () => {
    expect((await put({ ...BODY, version: 0 })).r.status).toBe(200);
    const other = await t.opsWho("高本", ["money"]);
    const [a, b] = await Promise.all([
      put({ ...BODY, company: "先の会社", version: 1 }),
      put({ ...BODY, company: "後の会社", version: 1 }, { who: other }),
    ]);
    expect([a.r.status, b.r.status].sort()).toEqual([200, 409]);
    expect([a.j["code"], b.j["code"]].filter(Boolean)).toEqual(["E-BILL-007"]);
    expect((await saved())!["version"]).toBe(2);
  });

  it("K1107-API-014 上限：読む口を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数", async () => {
    t.limits["getOpsInvoiceTemplate"] = 1;
    try {
      const ip = "203.0.113.207";
      expect((await t.call(money, "GET", PATH, undefined, { ip })).status).toBe(200);
      const r = await t.call(money, "GET", PATH, undefined, { ip });
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.limits["getOpsInvoiceTemplate"];
    }
  });
});

describe("K-1107 DB", () => {
  it("K1107-DB-001 2 層目：会社の人の文脈で app.ops_invoice_template_set を直に呼ぶと 42501・会社の人の文脈で型の表は 0 行・PUBLIC は app.ops_invoice_template を呼べない", async () => {
    expect((await put({ ...BODY, version: 0 })).r.status).toBe(200);
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await c.query("savepoint s");
      await expect(
        c.query("select app.ops_invoice_template_set($1::jsonb)", [{ ...BODY, version: 1 }]),
      ).rejects.toMatchObject({
        code: "42501",
      });
      await c.query("rollback to savepoint s");
      expect((await c.query("select count(*)::int as n from ops_invoice_templates")).rows[0].n).toBe(0);
    } finally {
      await c.query("rollback");
      c.release();
    }
    const pub = await t.row<{ ok: boolean }>(
      "select has_function_privilege('public', 'app.ops_invoice_template()', 'execute') as ok",
    );
    expect(pub!.ok).toBe(false);
  });

  it("K1107-DB-002 型は 1 つ：運営の会社に 2 行目を入れると 23505・登録番号が T12 なら check で 23514", async () => {
    expect((await put({ ...BODY, version: 0 })).r.status).toBe(200);
    const ins = (reg: string) =>
      t.f.admin.query(
        "insert into ops_invoice_templates (tenant_id, company, address, reg_no, contact, payee) values ($1, 'a', 'b', $2, 'c', 'd')",
        [OPS_TENANT, reg],
      );
    await expect(ins("T1234567890123")).rejects.toMatchObject({ code: "23505" });
    await clear();
    await expect(ins("T12")).rejects.toMatchObject({ code: "23514" });
  });
});
