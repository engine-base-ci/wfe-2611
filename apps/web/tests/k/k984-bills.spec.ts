// K-984「運営の請求の画面（/ops/billing）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops2 の oq-bills・oq-bills-issue・oq-pay・oq-pay-diff（この葉が持ち主）。
//   部品は features/F12/ops2/views-bills.tsx（K-942 が運ぶ）。口は網の手前で差し替える（ops-mock.ts の後ろに ops-bills-mock.ts）。
//   月と状態は URL に持つ（month・state。既定の値は書かない）。今は ops-bills-mock.ts の NOW に止める（page.clock）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-984.md の表と 1 対 1
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps } from "./ops-mock";
import { BILLS_A, count, DRAFT_A, mockBills, NOW, paidOf, type BillsMock } from "./ops-bills-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
// ▾ は部品 components/k の Select（Base UI）。素の <select> は無いので、▾ を押して開いた portal の role=option を押す・数える
async function choose(page: Page, sel: Locator, label: string): Promise<void> {
  await sel.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
/** 請求の本文の役（外枠は比べない＝K-946 の受け持ち） */
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("chips", ".k-op-chips", BOX),
  pair("chip", ".k-op-chip", ["width", "height", "color", "background-color", "texts"]),
  pair("stats", ".k-op-stats", BOX),
  pair("stat", ".k-op-stat", [...BOX, "texts"]),
  pair("table", ".k-f12-rt", BOX),
  pair("card", ".k-f12-rt-card", [...BOX, "texts"]),
  pair("end", ".k-oq-end", BOX),
  // 小窓は 2 つの役：入金の小窓は Dialog（role=dialog）・取り消せない確かめ（まとめて出す）は Confirm（role=alertdialog・K-229）
  pair("dialog", "[role='dialog'], [role='alertdialog']", [...BOX, "texts"]),
  pair("alert", ".k-op-alert", [...BOX, "texts"]),
];

async function open(page: Page, baseURL: string | undefined, q = "", width = 1440): Promise<BillsMock> {
  await page.clock.setFixedTime(NOW);
  const ops = await mockOps(page);
  ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: "op", caps: ["money"] } }) } });
  const m = await mockBills(page);
  await signInOps(page, local(baseURL), `/ops/billing${q}`, width);
  await expect(page.locator(".k-page-head h1")).toHaveText("請求");
  return m;
}
/** 題で小窓を 1 つ取る（dialog と alertdialog の両方を見る：まとめて出す確かめは Confirm＝alertdialog） */
const dialog = (page: Page, title: string) =>
  page
    .locator("[role='dialog'], [role='alertdialog']")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const chip = (page: Page, name: string) => page.locator(".k-op-chip").filter({ hasText: new RegExp(`^${name}\\d*$`) });
const lists = (m: BillsMock) => m.calls.filter((c) => c.startsWith("GET /api/v1/ops/invoices"));
const KITA = BILLS_A[0]!;

test.describe("K-984 請求の見た目", () => {
  const STATES: [string, string, (page: Page) => Promise<void>][] = [
    ["K984-UI-001", "oq-bills", async () => undefined],
    [
      "K984-UI-002",
      "oq-bills-issue",
      async (page) => {
        await btn(page, "10 月分をまとめて出す").click();
        await expect(page.getByRole("alertdialog").or(page.getByRole("dialog")).first()).toBeVisible();
        // 下絵は頁の頭で小窓を描く。押した所まで送られた頁を頭に戻してから比べる（小窓は画面に固定）
        await page.evaluate(() => window.scrollTo(0, 0));
      },
    ],
    [
      "K984-UI-003",
      "oq-pay",
      async (page) =>
        void (await page.getByRole("button", { name: `${KITA.workspace.name} の入金を記録`, exact: true }).click()),
    ],
    [
      "K984-UI-004",
      "oq-pay-diff",
      async (page) => {
        await page.getByRole("button", { name: `${KITA.workspace.name} の入金を記録`, exact: true }).click();
        await dialog(page, "入金を記録").getByLabel("金額", { exact: true }).fill("10000");
      },
    ],
  ];
  STATES.forEach(([row, id, act]) => {
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}・札・数・表か組・小窓）`, async ({ browser, baseURL }) => {
        const { bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            await page.clock.setFixedTime(NOW);
            const ops = await mockOps(page);
            ops.on.shell = () => ({
              status: 200,
              body: { data: shellOf({ operator: { member_id: "op", caps: ["money"] } }) },
            });
            await mockBills(page);
            await signInOps(page, local(baseURL), "/ops/billing", w);
            await expect(page.locator(".k-page-head h1")).toHaveText("請求");
            await act(page);
          },
          { base: "/dev/mock/f12-ops2", pairs: PAIRS },
        );
        expect(bad, bad.join("\n")).toEqual([]);
      });
  });
});

test.describe("K-984 一覧", () => {
  test("K984-UI-005 開く：一覧の口を問い合わせなしで 1 回（日本の先月）。札は すべて 5・お支払い待ち 1・払われた 2・期限を過ぎた（前の月の分）2。期限を過ぎた 2 行が上", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    expect(lists(m)).toEqual(["GET /api/v1/ops/invoices"]);
    for (const [n, c] of [
      ["すべて", 5],
      ["お支払い待ち", 1],
      ["払われた", 2],
      ["期限を過ぎた（前の月の分）", 2],
    ] as const)
      await expect(chip(page, n)).toHaveText(`${n}${c}`);
    await expect(chip(page, "すべて")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("row").nth(1)).toContainText("北村デザイン事務所");
  });

  test("K984-UI-006 月と状態は URL：月で 9 月分を選ぶと ?month=2026-09・口に month=2026-09。［期限を過ぎた］で &state=overdue。戻ると前の URL", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await choose(page, page.getByRole("combobox", { name: "月", exact: true }), "9 月分");
    await expect(page).toHaveURL(/\/ops\/billing\?month=2026-09$/);
    await chip(page, "期限を過ぎた（前の月の分）").click();
    await expect(page).toHaveURL(/\/ops\/billing\?month=2026-09&state=overdue$/);
    expect(m.listQueries.map((q) => q.toString())).toEqual(["", "month=2026-09", "month=2026-09&state=overdue"]);
    await page.goBack();
    await expect(page).toHaveURL(/\/ops\/billing\?month=2026-09$/);
  });

  test("K984-UI-007 期限から 7 日を過ぎた行は「止める案」を出し、押すと 1 社の画面（/ops/tenants/<id>）へ。7 日より前は出ない", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    const kita = page.getByRole("row").filter({ hasText: "北村デザイン事務所" });
    await expect(kita).toContainText("期限を過ぎた 9 日");
    await expect(kita.getByRole("link", { name: "止める案", exact: true })).toHaveAttribute(
      "href",
      `/ops/tenants/${KITA.workspace.id}`,
    );
    await expect(
      page.getByRole("row").filter({ hasText: "合同会社ミナト企画" }).getByText("止める案", { exact: true }),
    ).toHaveCount(0);
  });
});

test.describe("K-984 まとめて出す", () => {
  test("K984-UI-008 まとめて出す：下書きの口（dry_run）を 1 回 → 確かめに 46 件・¥ 1,207,800・期限 11/30 → ［本人確認をして出す］で出す口を 1 回 → 小窓が閉じ「46 件の請求書を出しました」・一覧を読み直す", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await btn(page, "10 月分をまとめて出す").click();
    const d = dialog(page, "10 月分の請求書をまとめて出す");
    await expect(d).toContainText("46 件");
    await expect(d).toContainText("¥ 1,207,800");
    await expect(d).toContainText("期限 11/30");
    expect(m.bodies.issue).toEqual([{ month: "2026-10", dry_run: true }]);
    await d.getByRole("button", { name: "本人確認をして出す", exact: true }).click();
    await expect(d).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("46 件の請求書を出しました");
    expect(m.bodies.issue).toEqual([{ month: "2026-10", dry_run: true }, { month: "2026-10" }]);
    expect(lists(m)).toHaveLength(2);
  });

  test("K984-UI-009 本人確認の取り直し：403 STEP_UP_REQUIRED なら getMySecurity を 1 回・「本人か確かめます」・［パスキーで確かめる］で stepUp を 1 回・出す口をもう 1 回（同じ体）", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    let n = 0;
    m.on.issue = (req) =>
      (req.postDataJSON() as { dry_run?: boolean }).dry_run
        ? { status: 201, body: { data: DRAFT_A } }
        : ++n === 1
          ? { status: 403, body: { error: "forbidden", code: "STEP_UP_REQUIRED" } }
          : { status: 201, body: { data: DRAFT_A } };
    await btn(page, "10 月分をまとめて出す").click();
    await dialog(page, "10 月分の請求書をまとめて出す")
      .getByRole("button", { name: "本人確認をして出す", exact: true })
      .click();
    await dialog(page, "本人か確かめます").getByRole("button", { name: "パスキーで確かめる", exact: true }).click();
    await expect(dialog(page, "10 月分の請求書をまとめて出す")).toHaveCount(0);
    // やり直しの口は取り直しの答えの後に出る（小窓が閉じた時点ではまだのことがある）
    await expect
      .poll(() => [count(m, "GET /api/v1/me/security"), count(m, "POST /api/v1/auth/step-up"), n])
      .toEqual([1, 1, 2]);
  });

  test("K984-UI-010 出せない：409 E-BILL-003 は小窓の中に「この月の請求書はもう全部出しています」・E-BILL-006 は「下書きの後に中身が変わりました。もう一度確かめて出してください」で下書きを読み直す・503 は「もう一度」の赤い箱。小窓は閉じない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    let code = "E-BILL-003";
    m.on.issue = (req) =>
      (req.postDataJSON() as { dry_run?: boolean }).dry_run
        ? { status: 201, body: { data: DRAFT_A } }
        : code === "503"
          ? { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } }
          : { status: 409, body: { error: "conflict", code } };
    await btn(page, "10 月分をまとめて出す").click();
    const d = dialog(page, "10 月分の請求書をまとめて出す");
    const go = d.getByRole("button", { name: "本人確認をして出す", exact: true });
    await go.click();
    await expect(d.getByRole("alert")).toHaveText("この月の請求書はもう全部出しています");
    code = "E-BILL-006";
    await go.click();
    await expect(d.getByRole("alert")).toHaveText("下書きの後に中身が変わりました。もう一度確かめて出してください");
    await expect.poll(() => (m.bodies.issue ?? []).filter((b) => (b as { dry_run?: boolean }).dry_run).length).toBe(2);
    code = "503";
    await go.click();
    await expect(d.getByRole("alert")).toContainText("もう一度");
    await expect(d).toHaveCount(1);
  });
});

test.describe("K-984 入金を記録", () => {
  test("K984-UI-011 入金を記録：行の［入金を記録］で小窓（北村デザイン事務所 ・ 9 月分 ¥16,500（期限 10/31））。同じ額なら「差 ¥0 ・ 請求額と同じ → 払われた にする」・［記録する］で口を 1 回（額・入金日・名義）・閉じて行が払われた", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.pay = () => ({ status: 201, body: { data: paidOf(KITA, 16_500) } });
    await page.getByRole("button", { name: `${KITA.workspace.name} の入金を記録`, exact: true }).click();
    const d = dialog(page, "入金を記録");
    await expect(d).toContainText("北村デザイン事務所 ・ 9 月分 ¥16,500（期限 10/31）");
    await d.getByLabel("入金日", { exact: true }).fill("2026-11-02");
    await d.getByLabel("金額", { exact: true }).fill("16500");
    await d.getByLabel("振込名義", { exact: true }).fill("キタムラデザイン");
    await expect(d).toContainText("差 ¥0 ・ 請求額と同じ → 払われた にする");
    await d.getByRole("button", { name: "記録する", exact: true }).click();
    await expect(d).toHaveCount(0);
    expect(m.bodies.pay).toEqual([{ amount: 16_500, paid_on: "2026-11-02", payer_name: "キタムラデザイン" }]);
    await expect(page.getByRole("row").filter({ hasText: "北村デザイン事務所" })).toContainText("払われた");
  });

  test("K984-UI-012 差がある：10000 なら「差 ¥6,500 ・ 請求額より足りません。差を残して「お支払い待ち」のままにします」。名義を空にすると体に名義を入れない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.pay = () => ({ status: 201, body: { data: paidOf(KITA, 10_000) } });
    await page.getByRole("button", { name: `${KITA.workspace.name} の入金を記録`, exact: true }).click();
    const d = dialog(page, "入金を記録");
    await d.getByLabel("入金日", { exact: true }).fill("2026-11-02");
    await d.getByLabel("金額", { exact: true }).fill("10000");
    await expect(d.locator(".k-op-alert")).toHaveText(
      "差 ¥6,500 ・ 請求額より足りません。差を残して「お支払い待ち」のままにします",
    );
    await d.getByRole("button", { name: "記録する", exact: true }).click();
    await expect(d).toHaveCount(0);
    expect(m.bodies.pay).toEqual([{ amount: 10_000, paid_on: "2026-11-02" }]);
  });

  test("K984-UI-013 記録の取り直しと失敗：403 STEP_UP_REQUIRED は取り直して 1 回だけやり直す・503 は小窓の中の赤い箱で、書いた額と名義が残る・2 回押しても口は 1 回", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    let n = 0;
    m.on.pay = () =>
      ++n === 1
        ? { status: 403, body: { error: "forbidden", code: "STEP_UP_REQUIRED" } }
        : { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
    await page.getByRole("button", { name: `${KITA.workspace.name} の入金を記録`, exact: true }).click();
    const d = dialog(page, "入金を記録");
    await d.getByLabel("入金日", { exact: true }).fill("2026-11-02");
    await d.getByLabel("金額", { exact: true }).fill("16500");
    await d.getByLabel("振込名義", { exact: true }).fill("キタムラデザイン");
    await d.getByRole("button", { name: "記録する", exact: true }).dblclick();
    await dialog(page, "本人か確かめます").getByRole("button", { name: "パスキーで確かめる", exact: true }).click();
    await expect(d.getByRole("alert")).toContainText("もう一度");
    await expect(d.getByLabel("金額", { exact: true })).toHaveValue("16500");
    await expect(d.getByLabel("振込名義", { exact: true })).toHaveValue("キタムラデザイン");
    expect(n).toBe(2);
  });
  test("K984-UI-017 入金の取り消し：これまでの入金の［取り消す］で口を 1 回（同じ額・今日の入金日・reverses_payment_id）・答えの 1 行で一覧の行と小窓の入金の並びが変わり、その入金は「取り消し済み」（押せない形）", async ({
    page,
    baseURL,
  }) => {
    const pay = { id: "00000000-0000-4000-8000-000000009862", paid_on: "2026-11-05", amount: 10_000, reversed: false };
    const mina = { ...BILLS_A[2]!, paid_total: 10_000, difference: 6_500, payments: [pay] };
    const m = await open(page, baseURL);
    m.on.list = () => ({ status: 200, body: { data: [...BILLS_A.slice(0, 2), mina, ...BILLS_A.slice(3)] } });
    m.on.pay = () => ({
      status: 201,
      body: { data: { ...mina, paid_total: 0, difference: 16_500, payments: [{ ...pay, reversed: true }] } },
    });
    await page.reload();
    await page.getByRole("button", { name: `${mina.workspace.name} の入金を記録`, exact: true }).click();
    const d = dialog(page, "入金を記録");
    await d.getByRole("button", { name: "11/05 の ¥10,000 の入金を取り消す", exact: true }).click();
    await expect(d.getByRole("button", { name: "取り消し済み", exact: true })).toHaveAttribute("aria-disabled", "true");
    expect(m.bodies.pay).toEqual([{ amount: 10_000, paid_on: "2026-11-09", reverses_payment_id: pay.id }]);
    // 小窓が開いている間は後ろが読み上げから外れる（role で探せない）。表の行は要素で探す
    await expect(page.locator("tbody tr").filter({ hasText: mina.workspace.name })).not.toContainText("¥10,000");
  });

  test("K984-UI-018 取り消せない：409 E-BILL-004 は小窓の中に「この入金はもう取り消しています」・409 E-BILL-005 は「取り消す額が入金の額と違います」。小窓は閉じない", async ({
    page,
    baseURL,
  }) => {
    const pay = { id: "00000000-0000-4000-8000-000000009863", paid_on: "2026-11-05", amount: 10_000, reversed: false };
    const mina = { ...BILLS_A[2]!, paid_total: 10_000, difference: 6_500, payments: [pay] };
    const m = await open(page, baseURL);
    m.on.list = () => ({ status: 200, body: { data: [mina] } });
    await page.reload();
    await page.getByRole("button", { name: `${mina.workspace.name} の入金を記録`, exact: true }).click();
    const d = dialog(page, "入金を記録");
    for (const [code, text] of [
      ["E-BILL-004", "この入金はもう取り消しています"],
      ["E-BILL-005", "取り消す額が入金の額と違います"],
    ] as const) {
      m.on.pay = () => ({ status: 409, body: { error: "conflict", code } });
      await d.getByRole("button", { name: "11/05 の ¥10,000 の入金を取り消す", exact: true }).click();
      await expect(d.getByRole("alert")).toContainText(text);
    }
    await expect(d).toHaveCount(1);
  });

  test("K984-UI-019 メールを送れなかった：出す口の答えの meta.mail.failed が 2 なら「46 件の請求書を出しました」と「2 通のメールを送れませんでした。請求書は出ています（鈴と請求書の画面で見られます）」。送り直しのボタンは無い", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.issue = (req) =>
      (req.postDataJSON() as { dry_run?: boolean }).dry_run
        ? { status: 201, body: { data: DRAFT_A } }
        : { status: 201, body: { data: DRAFT_A, meta: { mail: { sent: 44, failed: 2 } } } };
    await btn(page, "10 月分をまとめて出す").click();
    await dialog(page, "10 月分の請求書をまとめて出す")
      .getByRole("button", { name: "本人確認をして出す", exact: true })
      .click();
    await expect(page.getByText("46 件の請求書を出しました", { exact: true })).toBeVisible();
    await expect(
      page.getByText("2 通のメールを送れませんでした。請求書は出ています（鈴と請求書の画面で見られます）", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /送り直/ })).toHaveCount(0);
  });
});

test.describe("K-984 守り", () => {
  test("K984-UI-020 開発の道を出さない：頭の［請求書の型］は見えていて押せない形（aria-disabled・href なし）。/dev/ を指すリンクが頁に 0", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    const tpl = page.locator(".k-page-head").getByText("請求書の型", { exact: true });
    await expect(tpl).toBeVisible();
    // K-1108 が入口を付けた（11_tickets/K-1108.md：押せる形になる。行き先は /ops/billing/template）
    await expect(tpl).toHaveAttribute("href", "/ops/billing/template");
    await expect(page.locator('a[href^="/dev/"]')).toHaveCount(0);
  });

  test("K984-UI-014 お金を持たない運営の人：「見る権限がありません」で、請求の口を 1 回も呼ばない", async ({
    page,
    baseURL,
  }) => {
    await page.clock.setFixedTime(NOW);
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: "op", caps: ["inquiry"] } }) },
    });
    const m = await mockBills(page);
    await signInOps(page, local(baseURL), "/ops/billing", 1440);
    await expect(page.getByText("見る権限がありません", { exact: false })).toBeVisible(); // 字は NoAccess の「この画面を見る権限がありません。」（K-984・k971 と同じ見方）
    expect(m.calls.filter((c) => c.includes("/ops/invoices"))).toEqual([]);
  });

  test("K984-UI-015 読めない：一覧が 503・網の切れなら「もう一度」で、押すと一覧の口をもう 1 回・5 行が出る", async ({
    page,
    baseURL,
  }) => {
    await page.clock.setFixedTime(NOW);
    const ops = await mockOps(page);
    ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: "op", caps: ["money"] } }) } });
    const m = await mockBills(page);
    let n = 0;
    m.on.list = () => (++n === 1 ? "abort" : { status: 200, body: { data: BILLS_A } });
    await signInOps(page, local(baseURL), "/ops/billing", 1440);
    await btn(page, "もう一度").click();
    await expect(page.getByRole("row").filter({ hasText: "株式会社オオタ物流" })).toHaveCount(1);
    expect(n).toBe(2);
  });

  test("K984-UI-016 幅と字の守り：320・375・768・1024・1440 で横のはみ出しが 0 以下。HTML の入った名前は字のまま・スクリプトが動かない。取引先・業務の型・書き出し・CSV のボタンが無い", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.list = () => ({
      status: 200,
      body: { data: [{ ...KITA, workspace: { ...KITA.workspace, name: "<img src=x onerror=window.__k984=1>北村" } }] },
    });
    await page.reload();
    await expect(page.getByText("<img src=x onerror=window.__k984=1>北村", { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __k984?: number }).__k984)).toBeUndefined();
    for (const w of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(await overflowX(page), String(w)).toBeLessThanOrEqual(0);
    }
    expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
  });
});
