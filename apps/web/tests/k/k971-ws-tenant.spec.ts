// K-971「運営の 1 社の画面（/ops/tenants/<id>）：タブ 5 つ」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops の op-ws・op-ws-members・op-ws-billing・op-ws-inquiries・op-ws-log・op-ws-nocap（この葉が持ち主）。
//   部品は features/F12/ops/tenant-frame.tsx・tenant-tabs.tsx（K-941 が運ぶ）。口は網の手前で差し替える（ops-mock.ts の後ろに ops-ws-mock.ts）。
//   タブは URL の tab に持つ（status は書かない）。できること（caps）が無いタブは口を呼ばず「この権限では見えない」。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-971.md の表と 1 対 1
import { expect, test, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps, type OpsMock } from "./ops-mock";
import { count, mockWs, type WsMock } from "./ops-ws-mock";
import { WS_ID, WS_INQUIRIES, WS_MEMBERS, wsOf } from "./ops-ws-answers";
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
/** 1 社の本文の役（外枠は比べない＝K-946 の受け持ち）。頭の下の行（plan・人数・始めた日）は口に始めた日が無いので箱だけ比べる */
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("sub", ".k-page-sub", ["x", "y", "font-size", "color"]),
  pair("acts", ".k-page-acts", BOX),
  pair("tabs", "[role='tablist']", [...BOX, "texts"]),
  pair("card", ".k-op-main .k-card", BOX),
  pair("stat", ".k-op-stat", [...BOX, "texts"]),
  pair("table", ".k-f12-rt-table", BOX),
  pair("rtcard", ".k-f12-rt-card", BOX),
  pair("side", ".k-op-side", BOX),
  pair("noaccess", ".k-noaccess, [data-k='no-access']", ["x", "width", ...TEXT]),
];
const PATH = `/ops/tenants/${WS_ID}`;
const STATES = [
  ["K971-UI-001", "op-ws", "", "いまの状態"],
  ["K971-UI-002", "op-ws-members", "?tab=members", "メンバー"],
  ["K971-UI-003", "op-ws-billing", "?tab=billing", "プランと請求"],
  ["K971-UI-004", "op-ws-inquiries", "?tab=inquiries", "問い合わせ"],
  ["K971-UI-005", "op-ws-log", "?tab=log", "記録"],
] as const;
const CAPS = ["inquiry", "money", "peek", "stop", "notice"];

async function open(
  page: Page,
  baseURL: string | undefined,
  q = "",
  width = 1440,
  caps: string[] = CAPS,
): Promise<{ ops: OpsMock; ws: WsMock }> {
  const ops = await mockOps(page);
  ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: "op", caps } }) } });
  const ws = await mockWs(page);
  await signInOps(page, local(baseURL), `${PATH}${q}`, width);
  await expect(page.locator(".k-page-head h1")).toHaveText("合同会社ミナト企画");
  return { ops, ws };
}
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });

test.describe("K-971 1 社の見た目", () => {
  STATES.forEach(([row, id, q]) => {
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}・頭・タブ・中身の箱と表・右の情報）`, async ({ browser, baseURL }) => {
        const { bad } = await matchMock(browser, id, w, async (page) => void (await open(page, baseURL, q, w)), {
          base: "/dev/mock/f12-ops",
          pairs: PAIRS,
        });
        expect(bad, bad.join("\n")).toEqual([]);
      });
  });

  for (const w of MATCH_WIDTHS)
    test(`K971-UI-006 お金を持たない人がプランと請求を開くと op-ws-nocap と同じ（幅 ${w}・この権限では見えない）`, async ({
      browser,
      baseURL,
    }) => {
      const { bad } = await matchMock(
        browser,
        "op-ws-nocap",
        w,
        async (page) => void (await open(page, baseURL, "?tab=billing", w, ["inquiry"])),
        { base: "/dev/mock/f12-ops", pairs: PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
});

test.describe("K-971 開く・タブ", () => {
  test("K971-UI-007 開く：1 社の口は 1 回・外枠の口は 1 回（StrictMode でも）。頭は名前・「使っている」・チーム と 8 人", async ({
    page,
    baseURL,
  }) => {
    const { ops, ws } = await open(page, baseURL);
    await expect(page.getByText("使っている", { exact: true }).first()).toBeVisible();
    await expect(page.locator(".k-page-sub")).toContainText("チーム");
    await expect(page.locator(".k-page-sub")).toContainText("8 人");
    expect(count(ws, `GET /api/v1/ops/workspaces/${WS_ID}`) - count(ws, `GET /api/v1/ops/workspaces/${WS_ID}/`)).toBe(
      1,
    );
    expect(ops.calls.filter((c) => c.startsWith("GET /api/v1/ops/shell")).length).toBe(1);
  });

  test("K971-UI-008 タブは URL：押すと ?tab=members・戻ると前のタブ。直に ?tab=log で記録が開く。知らない tab はいまの状態", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    await tab(page, "メンバー").click();
    await page.waitForURL((u) => u.search === "?tab=members");
    await expect(
      page.getByRole("table", { name: "メンバー" }).or(page.locator(".k-f12-rt-card").first()),
    ).toBeVisible();
    await page.goBack();
    await page.waitForURL((u) => u.search === "");
    await expect(tab(page, "いまの状態")).toHaveAttribute("aria-selected", "true");
    await page.goto(`${local(baseURL)}${PATH}?tab=log`);
    await expect(tab(page, "記録")).toHaveAttribute("aria-selected", "true");
    await page.goto(`${local(baseURL)}${PATH}?tab=gone`);
    await expect(tab(page, "いまの状態")).toHaveAttribute("aria-selected", "true");
  });

  test("K971-UI-009 タブの口：開いたタブの口だけ 1 回ずつ呼ぶ（いまの状態では members・billing・inquiries・audit を呼ばない）", async ({
    page,
    baseURL,
  }) => {
    const { ws } = await open(page, baseURL);
    for (const k of ["members", "billing", "inquiries", "audit"])
      expect(count(ws, `GET /api/v1/ops/workspaces/${WS_ID}/${k}`), k).toBe(0);
    await tab(page, "記録").click();
    await expect(page.getByText("中を見た", { exact: false }).first()).toBeVisible();
    expect(count(ws, `GET /api/v1/ops/workspaces/${WS_ID}/audit`)).toBe(1);
  });
});

test.describe("K-971 タブの中身", () => {
  test("K971-UI-010 メンバー：本人確認が済んでいない人（山本・木下）だけ［メールを送り直す］が押せる。押すと口を 1 回・「送りました」", async ({
    page,
    baseURL,
  }) => {
    const { ws } = await open(page, baseURL, "?tab=members");
    ws.on.resend = () => ({ status: 201, body: { data: { sent_at: "2026-11-23T01:00:00Z" } } });
    const btn = (n: string) => page.getByRole("button", { name: `${n} さんに本人確認のメールを送り直す`, exact: true });
    for (const n of ["湊 さくら", "吉田 健", "小池 真理"]) await expect(btn(n)).toBeDisabled();
    await btn("山本 由美").click();
    await expect(page.getByText("送りました", { exact: true })).toBeVisible();
    expect(
      count(ws, `POST /api/v1/ops/workspaces/${WS_ID}/members/${WS_MEMBERS[2]!.member_id}/resend-verification`),
    ).toBe(1);
  });

  test("K971-UI-011 メンバー：もう確かめた人（409 E-CONF-039）と送れない（503）は、行の下に赤い字で出し、ボタンは押し直せる", async ({
    page,
    baseURL,
  }) => {
    const { ws } = await open(page, baseURL, "?tab=members");
    ws.on.resend = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-039" } });
    const btn = page.getByRole("button", { name: "木下 翔 さんに本人確認のメールを送り直す", exact: true });
    await btn.click();
    await expect(page.getByText("この人はもう本人確認が済んでいます", { exact: true })).toBeVisible();
    ws.on.resend = () => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    await btn.click();
    await expect(page.locator("[role='alert']").filter({ hasText: "送れませんでした" })).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("K971-UI-012 プランと請求：¥15,000・人数 8 / 10・請求書 4 行（お支払い待ち 1・払われた 3 と入金の日）。［代わりにプランを変える］はお金の人に出る", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL, "?tab=billing");
    await expect(page.getByText("¥15,000", { exact: true })).toBeVisible();
    await expect(page.getByLabel("人数 8 / 10", { exact: true })).toBeVisible();
    await expect(page.getByText("お支払い待ち", { exact: true })).toHaveCount(1);
    await expect(page.getByText("払われた", { exact: true })).toHaveCount(3);
    await expect(page.getByRole("button", { name: "代わりにプランを変える", exact: true })).toBeVisible();
  });

  test("K971-UI-013 問い合わせ：3 行・題のリンクは受信箱の 1 件（/ops/support?id=<id>）・状態は 進行中 と 済み", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL, "?tab=inquiries");
    const link = page.getByRole("link", { name: "承認したのに動かない", exact: true });
    await expect(link).toHaveAttribute("href", `/ops/support?id=${WS_INQUIRIES[0]!.id}`);
    await expect(page.getByText("済み", { exact: true })).toHaveCount(2);
    await expect(page.getByText("進行中", { exact: true })).toHaveCount(1);
  });

  test("K971-UI-014 記録：4 行・「高本 が 中を見た」・理由の字・新しい順。直す・消すボタンは無い", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL, "?tab=log");
    const feed = page.getByRole("list", { name: "運営の記録", exact: true });
    await expect(feed.locator("li")).toHaveCount(4);
    await expect(feed.locator("li").first()).toContainText("中を見た");
    await expect(feed.locator("li").first()).toContainText("問い合わせ「承認したのに動かない」");
    await expect(feed.getByRole("button")).toHaveCount(0);
  });

  test("K971-UI-015 できることが無いタブ：問い合わせ（inquiry）を持たない人のメンバー・問い合わせのタブは「この権限では見えない」で口を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const { ws } = await open(page, baseURL, "?tab=members", 1440, ["money"]);
    await expect(page.getByText("見る権限がありません", { exact: false })).toBeVisible();
    await tab(page, "問い合わせ").click();
    await expect(page.getByText("見る権限がありません", { exact: false })).toBeVisible();
    expect(count(ws, `GET /api/v1/ops/workspaces/${WS_ID}/members`)).toBe(0);
    expect(count(ws, `GET /api/v1/ops/workspaces/${WS_ID}/inquiries`)).toBe(0);
  });
});

test.describe("K-971 失敗と守り", () => {
  test("K971-UI-016 無い会社（404）は「見つかりません」・読めない（503）は E-PAGE-007 の形と「もう一度」で読み直す", async ({
    page,
    baseURL,
  }) => {
    const ops = await mockOps(page);
    const ws = await mockWs(page);
    ws.on.ws = () => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
    await signInOps(page, local(baseURL), PATH);
    await expect(page.getByText("見つかりません", { exact: false })).toBeVisible();
    ws.on.ws = () => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    await page.reload();
    await expect(page.getByRole("button", { name: "もう一度", exact: true })).toBeVisible();
    ws.on.ws = () => ({ status: 200, body: { data: wsOf() } });
    await page.getByRole("button", { name: "もう一度", exact: true }).click();
    await expect(page.locator(".k-page-head h1")).toHaveText("合同会社ミナト企画");
    expect(ops.calls.length).toBeGreaterThan(0);
  });

  test("K971-UI-017 幅：320・375・768・1024・1440 の 5 つのタブで横のはみ出しが 0 以下", async ({ page, baseURL }) => {
    await open(page, baseURL);
    for (const w of [320, 375, 768, 1024, 1440])
      for (const [, , q] of STATES) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(`${local(baseURL)}${PATH}${q}`);
        await expect(page.locator(".k-page-head h1")).toBeVisible();
        expect(await overflowX(page), `${w} ${q}`).toBeLessThanOrEqual(0);
      }
  });

  test("K971-UI-018 字の守り：HTML の入った会社名・メンバー名は字のまま出てスクリプトが動かない。取引先・業務の型・書き出・CSV の字が無い", async ({
    page,
    baseURL,
  }) => {
    const ops = await mockOps(page);
    const ws = await mockWs(page);
    const evil = `<img src=x onerror="window.__k971=1">`;
    ws.on.ws = () => ({ status: 200, body: { data: wsOf({ name: evil }) } });
    ws.on.members = () => ({ status: 200, body: { data: [{ ...WS_MEMBERS[0]!, name: evil }] } });
    await signInOps(page, local(baseURL), `${PATH}?tab=members`);
    await expect(page.locator(".k-page-head h1")).toHaveText(evil);
    expect(await page.evaluate(() => (window as unknown as { __k971?: number }).__k971)).toBeUndefined();
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(FORBIDDEN);
    expect(ops.calls.length).toBeGreaterThan(0);
  });
});
