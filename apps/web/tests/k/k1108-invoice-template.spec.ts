// K-1108「請求書の型の設定の画面（/ops/billing/template）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops-invoice の op-invoice-template・op-invoice-template-edit・op-invoice-template-failed（この葉が持ち主）。
//   部品は features/F12/ops2/views-invoice-template.tsx（この葉が運ぶ）。口は網の手前で差し替える（ops-mock.ts の後ろに、この試験の中の差し替え）。
//   本人確認の取り直しの口（getMySecurity・stepUp）は ops-bills-mock.ts（K-984）の差し替えを使う。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-1108.md の表と 1 対 1
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps } from "./ops-mock";
import { mockBills } from "./ops-bills-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
/** 請求書の型の本文の役（外枠は比べない＝K-946 の受け持ち） */
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("body", ".k-op-body", BOX),
  pair("card", ".k-op-card", [...BOX, "texts"]),
  pair("form", ".k-op-form", BOX),
  pair("alert", "[role='alert']", [...BOX, "texts"]),
];

/** 下絵 INVOICE_TEMPLATE と同じ値の答え（K-1107 の 9 欄） */
const TPL = {
  company: "Kaname 運営",
  address: "〒530-0001 大阪府大阪市北区梅田 1-1-1 梅田ビル 10 階",
  reg_no: "T1234567890123",
  contact: "info@kaname.example",
  payee: "みらい銀行 梅田支店 普通 1234567 カナメウンエイ",
  note: "お振込手数料はご負担をお願いします。ご不明な点は「困ったとき・お知らせ」からお問い合わせください。",
  version: 3,
  updated_at: "2026-11-01T03:00:00Z",
  updated_by_name: "佐野",
};
type Reply = { status: number; body: unknown } | "abort";
interface TplMock {
  calls: string[];
  puts: unknown[];
  on: { get: () => Reply; put: (req: Request) => Reply };
}
async function mockTemplate(page: Page): Promise<TplMock> {
  const m: TplMock = {
    calls: [],
    puts: [],
    on: {
      get: () => ({ status: 200, body: { data: TPL } }),
      put: (req) => ({
        status: 200,
        body: { data: { ...TPL, ...(req.postDataJSON() as object), version: TPL.version + 1 } },
      }),
    },
  };
  await page.route(/\/api\/v1\/ops\/invoice-template$/, async (route: Route, req: Request) => {
    m.calls.push(`${req.method()} /api/v1/ops/invoice-template`);
    if (req.method() === "PUT") m.puts.push(req.postDataJSON() as unknown);
    const r = req.method() === "PUT" ? m.on.put(req) : m.on.get();
    if (r === "abort") return route.abort("failed");
    await route.fulfill({
      status: r.status,
      headers: { "access-control-allow-origin": "*" },
      contentType: "application/json",
      body: JSON.stringify(r.body),
    });
  });
  return m;
}
const count = (m: { calls: string[] }, prefix: string): number => m.calls.filter((c) => c.startsWith(prefix)).length;
const GETS = "GET /api/v1/ops/invoice-template";
const PUTS = "PUT /api/v1/ops/invoice-template";

async function open(
  page: Page,
  baseURL: string | undefined,
  o: { width?: number; caps?: string[]; path?: string } = {},
): Promise<{ m: TplMock; calls: string[] }> {
  const ops = await mockOps(page);
  ops.on.shell = () => ({
    status: 200,
    body: { data: shellOf({ operator: { member_id: "op", caps: o.caps ?? ["money"] } }) },
  });
  const bills = await mockBills(page);
  const m = await mockTemplate(page);
  await signInOps(page, local(baseURL), o.path ?? "/ops/billing/template", o.width ?? 1440);
  return { m, calls: bills.calls };
}
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
// 必須の欄の見出しは「会社名*」（印 * は読み上げない）。getByLabel の exact は印を含む字で比べて当たらないので、読み上げの名前で探す
const field = (page: Page, label: string) => page.getByRole("textbox", { name: label, exact: true });
// 本文の中の字（外枠の帯の「Kaname 運営」と会社名の値が同じ字なので、本文に絞る）
const inMain = (page: Page, text: string) => page.locator("#k-main").getByText(text, { exact: true });
const dialog = (page: Page, title: string) =>
  page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

test.describe("K-1108 請求書の型の見た目", () => {
  const STATES: [string, string, (page: Page, m: TplMock) => Promise<void>][] = [
    [
      "K1108-UI-001",
      "op-invoice-template",
      async (page) => void (await expect(page.locator(".k-page-head h1")).toHaveText("請求書の型")),
    ],
    ["K1108-UI-002", "op-invoice-template-edit", async (page) => void (await btn(page, "直す").click())],
    [
      "K1108-UI-003",
      "op-invoice-template-failed",
      async (page, m) => {
        m.on.put = () => ({ status: 409, body: { error: "conflict", code: "E-BILL-007" } });
        await btn(page, "直す").click();
        await btn(page, "保存する").click();
        await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)').first()).toContainText(
          "保存できませんでした",
        );
      },
    ],
  ];
  for (const [row, id, act] of STATES)
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}・見出し・出す側の会社の箱・欄・注）`, async ({ browser, baseURL }) => {
        const { bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            const { m } = await open(page, baseURL, { width: w });
            await act(page, m);
          },
          { base: "/dev/mock/f12-ops-invoice", pairs: PAIRS },
        );
        expect(bad, bad.join("\n")).toEqual([]);
      });
});

test.describe("K-1108 見る・直す", () => {
  test("K1108-UI-004 開く：見出し「請求書の型」・6 つの値が答えの字・「11/01 に 佐野 が直した」・読む口が 1 回・書く口は 0", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    await expect(page.locator(".k-page-head h1")).toHaveText("請求書の型");
    for (const v of [TPL.company, TPL.address, TPL.reg_no, TPL.contact, TPL.payee, TPL.note])
      await expect(inMain(page, v)).toBeVisible();
    await expect(page.getByText("11/01 に 佐野 が直した", { exact: true })).toBeVisible();
    expect([count(m, GETS), count(m, PUTS)]).toEqual([1, 0]);
  });

  test("K1108-UI-005 直す・やめる：［直す］で 6 つの欄に今の値・［やめる］で見るに戻り、書いた字は捨てて前の値・書く口は 0", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    await btn(page, "直す").click();
    await expect(field(page, "会社名")).toHaveValue(TPL.company);
    await expect(field(page, "振込先")).toHaveValue(TPL.payee);
    await field(page, "会社名").fill("書きかけの会社");
    await btn(page, "やめる").click();
    await expect(inMain(page, TPL.company)).toBeVisible();
    await expect(page.getByText("書きかけの会社", { exact: true })).toHaveCount(0);
    expect(count(m, PUTS)).toBe(0);
  });

  test("K1108-UI-006 保存する：会社名を直すと PUT を 1 回・体はちょうど 7 つの鍵で version は読んだ版・前後の空白を落とす・見るに戻って新しい値・読む口がもう 1 回", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    await expect(inMain(page, TPL.company)).toBeVisible(); // 1 回目の答え（版 3）を読み終えてから、2 回目の答えを差し替える
    m.on.get = () => ({ status: 200, body: { data: { ...TPL, company: "合同会社カナメ運営", version: 4 } } });
    await btn(page, "直す").click();
    await field(page, "会社名").fill("  合同会社カナメ運営 ");
    await btn(page, "保存する").click();
    await expect(page.getByText("合同会社カナメ運営", { exact: true })).toBeVisible();
    expect(m.puts).toEqual([
      {
        company: "合同会社カナメ運営",
        address: TPL.address,
        reg_no: TPL.reg_no,
        contact: TPL.contact,
        payee: TPL.payee,
        note: TPL.note,
        version: 3,
      },
    ]);
    expect(Object.keys(m.puts[0] as object)).toHaveLength(7);
    expect(count(m, GETS)).toBe(2);
  });

  test("K1108-UI-007 先に直された：409 E-BILL-007 で「保存できませんでした」の箱・欄のまま書いた値が残る・読む口が裏で 1 回・もう一度押すと新しい版で PUT", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    let n = 0;
    m.on.put = (req) =>
      ++n === 1
        ? { status: 409, body: { error: "conflict", code: "E-BILL-007" } }
        : { status: 200, body: { data: { ...TPL, ...(req.postDataJSON() as object), version: 5 } } };
    await expect(inMain(page, TPL.company)).toBeVisible(); // 1 回目の答え（版 3）を読み終えてから、2 回目の答えを差し替える
    m.on.get = () => ({ status: 200, body: { data: { ...TPL, version: 4 } } });
    await btn(page, "直す").click();
    await field(page, "住所").fill("大阪府大阪市北区梅田 2-2-2");
    await btn(page, "保存する").click();
    const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
    await expect(alert).toContainText("保存できませんでした");
    await expect(alert).toContainText("書いた値はそのまま残っています");
    await expect(field(page, "住所")).toHaveValue("大阪府大阪市北区梅田 2-2-2");
    await expect.poll(() => count(m, GETS)).toBe(2);
    await btn(page, "保存する").click();
    await expect(page.getByText("大阪府大阪市北区梅田 2-2-2", { exact: true })).toBeVisible();
    expect((m.puts as { version: number }[]).map((b) => b.version)).toEqual([3, 4]);
  });

  test("K1108-UI-008 落ちた：503 と網の切れで同じ赤い箱・書いた値が残る・欄のまま", async ({ page, baseURL }) => {
    const { m } = await open(page, baseURL);
    const replies: Reply[] = [{ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } }, "abort"];
    m.on.put = () => replies.shift() ?? "abort";
    await btn(page, "直す").click();
    await field(page, "振込先").fill("別の銀行 普通 7654321");
    for (let i = 0; i < 2; i++) {
      await btn(page, "保存する").click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)').first()).toContainText(
        "保存できませんでした",
      );
      await expect(field(page, "振込先")).toHaveValue("別の銀行 普通 7654321");
    }
    expect(count(m, PUTS)).toBe(2);
  });

  test("K1108-UI-009 本人確認の取り直し：403 STEP_UP_REQUIRED なら getMySecurity を 1 回・「本人か確かめます」・［パスキーで確かめる］で stepUp を 1 回・PUT をもう 1 回（同じ体）", async ({
    page,
    baseURL,
  }) => {
    const { m, calls } = await open(page, baseURL);
    let n = 0;
    m.on.put = (req) =>
      ++n === 1
        ? { status: 403, body: { error: "forbidden", code: "STEP_UP_REQUIRED" } }
        : { status: 200, body: { data: { ...TPL, ...(req.postDataJSON() as object), version: 4 } } };
    await btn(page, "直す").click();
    await field(page, "連絡先").fill("billing@kaname.example");
    await btn(page, "保存する").click();
    await dialog(page, "本人か確かめます").getByRole("button", { name: "パスキーで確かめる", exact: true }).click();
    await expect(page.getByText("billing@kaname.example", { exact: true })).toBeVisible();
    expect([count({ calls }, "GET /api/v1/me/security"), count({ calls }, "POST /api/v1/auth/step-up"), n]).toEqual([
      1, 1, 2,
    ]);
    expect(m.puts[1]).toEqual(m.puts[0]);
  });

  test("K1108-UI-010 欄の誤り：会社名が空白だけ・登録番号が T123 で［保存する］を押すと欄の字が出て PUT は 0", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    await btn(page, "直す").click();
    await field(page, "会社名").fill("　 ");
    await field(page, "登録番号").fill("T123");
    await btn(page, "保存する").click();
    await expect(page.getByText("会社名を書いてください", { exact: true })).toBeVisible();
    await expect(page.getByText("登録番号は T と 13 けたの数字で書いてください", { exact: true })).toBeVisible();
    expect(count(m, PUTS)).toBe(0);
  });

  test("K1108-UI-011 お金を持たない運営の人：「見る権限がありません」で、請求書の型の口を 1 回も呼ばない", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL, { caps: ["inquiry"] });
    await expect(page.getByText("見る権限がありません", { exact: false })).toBeVisible(); // 字は NoAccess の「この画面を見る権限がありません。」（K-984・k971 と同じ見方）
    expect(m.calls).toEqual([]);
  });

  test("K1108-UI-012 入口：請求の［請求書の型］で /ops/billing/template に移る・パンくずの「請求」で /ops/billing に戻る", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL, { path: "/ops/billing" });
    await page.getByRole("link", { name: "請求書の型", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/ops/billing/template");
    await expect(page.locator(".k-page-head h1")).toHaveText("請求書の型");
    await page
      .getByRole("navigation", { name: "いまの場所", exact: true })
      .getByRole("link", { name: "請求", exact: true })
      .click();
    await page.waitForURL((u) => u.pathname === "/ops/billing");
  });

  test("K1108-UI-013 読めない：読む口が 503 で「もう一度」・押すと読む口がもう 1 回で 6 つの値が出る", async ({
    page,
    baseURL,
  }) => {
    const ops = await mockOps(page);
    ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: "op", caps: ["money"] } }) } });
    await mockBills(page);
    const m = await mockTemplate(page);
    let n = 0;
    m.on.get = () =>
      ++n === 1
        ? { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } }
        : { status: 200, body: { data: TPL } };
    await signInOps(page, local(baseURL), "/ops/billing/template", 1440);
    await btn(page, "もう一度").click();
    await expect(inMain(page, TPL.payee)).toBeVisible();
    expect(n).toBe(2);
  });

  test("K1108-UI-014 2 回押し：［保存する］を 2 回続けて押しても PUT は 1 回", async ({ page, baseURL }) => {
    const { m } = await open(page, baseURL);
    await btn(page, "直す").click();
    await field(page, "備考").fill("手数料はご負担ください");
    await btn(page, "保存する").dblclick();
    await expect(page.getByText("手数料はご負担ください", { exact: true })).toBeVisible();
    expect(count(m, PUTS)).toBe(1);
  });

  test("K1108-UI-015 幅と字の守り：320・375・768・1024・1440 で横のはみ出しが 0 以下。HTML の入った会社名は字のまま・スクリプトが動かない。取引先・業務の型・書き出しの字が無い", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    m.on.get = () => ({ status: 200, body: { data: { ...TPL, company: "<img src=x onerror=window.__k1108=1>運営" } } });
    await page.reload();
    await expect(page.getByText("<img src=x onerror=window.__k1108=1>運営", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __k1108?: number }).__k1108)).toBeUndefined();
    for (const w of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(await overflowX(page), String(w)).toBeLessThanOrEqual(0);
    }
    expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
  });
});
