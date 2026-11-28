// K-976「運営の受信箱の画面（/ops/support）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops2 の oq-inbox・oq-inbox-thread・oq-inbox-empty・oq-inbox-taken（この葉が持ち主）。
//   部品は features/F12/ops2/views-inbox.tsx（K-942 が運ぶ）。口は網の手前で差し替える（ops-mock.ts の後ろに ops-inbox-mock.ts）。
//   箱・種類・開いた 1 件は URL に持つ（box・topic・id。既定の値は書かない）。箱の数は外枠の getOpsShell の inbox（K-963）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-976.md の表と 1 対 1
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps } from "./ops-mock";
import { detailOf, INBOX_A, ME, mockInbox, SANO, type InboxMock } from "./ops-inbox-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
// ▾ は部品 components/k の Select（Base UI）。素の <select> は無いので、▾ を押して開いた portal の role=option を押す・数える
async function choose(page: Page, sel: Locator, label: string): Promise<void> {
  await sel.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
// 必須の欄の見出しは「会社名*」の形（印 * は読み上げない）。getByLabel の exact は印を含む字で比べて当たらないので、印のある・無いの両方に当てる

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
/** 受信箱の本文の役（外枠は比べない＝K-946 の受け持ち） */
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("chips", ".k-op-chips", BOX),
  pair("chip", ".k-op-chip", ["width", "height", "color", "background-color", "texts"]),
  pair("list", ".k-oq-list", BOX),
  pair("li", ".k-oq-list li", [...BOX, "texts"]),
  pair("thread", ".k-oq-thread", BOX),
  pair("msg", ".k-oq-msg", BOX),
  pair("callout", ".k-oq-thread .k-callout", [...BOX, "texts"]),
  pair("side", ".k-oq-inbox .k-card", BOX),
  pair("empty", ".k-state[data-state='empty']", ["x", "width", ...TEXT]),
];
const INBOX = { unassigned: 2, mine: 3, waiting: 4, later: 1 };

async function open(
  page: Page,
  baseURL: string | undefined,
  q = "?box=mine",
  width = 1440,
  caps: string[] = ["inquiry"],
): Promise<InboxMock> {
  const ops = await mockOps(page);
  ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: ME, caps }, inbox: INBOX }) } });
  const m = await mockInbox(page);
  await signInOps(page, local(baseURL), `/ops/support${q}`, width);
  await expect(page.locator(".k-page-head h1")).toHaveText("問い合わせ");
  return m;
}
const chip = (page: Page, name: string) => page.locator(".k-op-chip").filter({ hasText: new RegExp(`^${name}\\d*$`) });
const lists = (m: InboxMock) =>
  m.calls.filter((c) => c.startsWith("GET /api/v1/ops/inquiries?") || c === "GET /api/v1/ops/inquiries");
const ID = INBOX_A[0]!.id;

test.describe("K-976 受信箱の見た目", () => {
  const STATES: [string, string, string, (m: InboxMock) => void][] = [
    ["K976-UI-001", "oq-inbox", "?box=mine", () => undefined],
    ["K976-UI-002", "oq-inbox-thread", `?box=mine&id=${ID}`, () => undefined],
    [
      "K976-UI-003",
      "oq-inbox-empty",
      "?box=later",
      (m) => void (m.on.list = () => ({ status: 200, body: { data: [] } })),
    ],
    [
      "K976-UI-004",
      "oq-inbox-taken",
      `?box=mine&id=${ID}`,
      (m) =>
        void (m.on.one = () => ({
          status: 200,
          body: { data: detailOf({ owner: { member_id: SANO, name: "佐野" } }) },
        })),
    ],
  ];
  STATES.forEach(([row, id, q, set]) => {
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}・箱・一覧・1 件・右の様子）`, async ({ browser, baseURL }) => {
        const { bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            const ops = await mockOps(page);
            ops.on.shell = () => ({
              status: 200,
              body: { data: shellOf({ operator: { member_id: ME, caps: ["inquiry"] }, inbox: INBOX }) },
            });
            set(await mockInbox(page));
            await signInOps(page, local(baseURL), `/ops/support${q}`, w);
            await expect(page.locator(".k-page-head h1")).toHaveText("問い合わせ");
          },
          { base: "/dev/mock/f12-ops2", pairs: PAIRS },
        );
        expect(bad, bad.join("\n")).toEqual([]);
      });
  });
});

test.describe("K-976 箱と一覧", () => {
  test("K976-UI-005 開く：既定の箱（まだ誰も持っていない）で一覧の口を問い合わせなしで 1 回。箱の数は外枠の数（2・3・4・1）で、済みは数を出さない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, "");
    await expect(chip(page, "まだ誰も持っていない")).toHaveAttribute("aria-pressed", "true");
    for (const [n, c] of [
      ["まだ誰も持っていない", 2],
      ["自分", 3],
      ["返事待ち", 4],
      ["後で", 1],
    ] as const)
      await expect(chip(page, n)).toHaveText(`${n}${c}`);
    expect(lists(m)).toEqual(["GET /api/v1/ops/inquiries"]);
  });

  test("K976-UI-006 箱と種類は URL：［自分］で ?box=mine・口に box=mine。種類の札は すべて・使い方・うまく動かない・お金・プラン・ほか で、［お金・プラン］で ?box=mine&topic=billing。戻ると前の箱", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, "");
    await chip(page, "自分").click();
    await page.waitForURL((u) => u.search === "?box=mine");
    await expect(page.getByRole("group", { name: "種類", exact: true }).locator(".k-op-chip")).toHaveText([
      "すべて",
      "使い方",
      "うまく動かない",
      "お金・プラン",
      "ほか",
    ]);
    await chip(page, "お金・プラン").click();
    await page.waitForURL((u) => u.search === "?box=mine&topic=billing");
    await expect.poll(() => m.listQueries.at(-1)?.toString()).toBe("box=mine&topic=billing");
    await page.goBack();
    await page.waitForURL((u) => u.search === "?box=mine");
  });

  test("K976-UI-007 1 件を開く：行を押すと ?box=mine&id=<id>・1 件の口を 1 回。顧客の内容と社内メモ（「社内メモ ・ 先方には見えない」の札）・付いてきた情報・右の様子（チーム・8 人・PC つながっている・止まった実行 3）", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await page.locator(".k-oq-list li").filter({ hasText: "承認したのに動かない" }).click();
    await page.waitForURL((u) => u.search === `?box=mine&id=${ID}`);
    const thread = page.getByRole("region", { name: "承認したのに動かない", exact: true });
    await expect(thread.locator(".k-oq-msg")).toHaveCount(2);
    await expect(thread.locator(".k-oq-msg[data-kind='memo']")).toContainText("社内メモ ・ 先方には見えない");
    await expect(thread).toContainText("Chrome 130");
    const side = page.locator(".k-oq-inbox .k-card");
    for (const s of ["チーム", "8 人", "つながっている", "3 件"]) await expect(side).toContainText(s);
    expect(m.calls.filter((c) => c === `GET /api/v1/ops/inquiries/${ID}`).length).toBe(1);
  });

  test("K976-UI-008 箱が空：「この箱に問い合わせはありません」（右の様子と 1 件は出ない）", async ({
    page,
    baseURL,
  }) => {
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: ME, caps: ["inquiry"] }, inbox: INBOX }) },
    });
    const m = await mockInbox(page);
    m.on.list = () => ({ status: 200, body: { data: [] } });
    await signInOps(page, local(baseURL), "/ops/support?box=later");
    await expect(page.getByText("この箱に問い合わせはありません", { exact: true })).toBeVisible();
    await expect(page.locator(".k-oq-inbox")).toHaveCount(0);
  });
});

test.describe("K-976 担当・返す・メモ", () => {
  test("K976-UI-009 自分が持つ：担当なしの 1 件で［自分が持つ］を押すと PATCH { take: true } を 1 回・担当に「高本」。取り合い（409 E-OPS-005）は「ほかの人が担当しています」と見るだけの形", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `?id=${ID}`);
    m.on.one = () => ({ status: 200, body: { data: detailOf({ owner: null }) } });
    await page.reload();
    m.on.update = () => ({ status: 200, body: { data: { ...INBOX_A[0]!, owner: { member_id: ME, name: "高本" } } } });
    await page.getByRole("button", { name: "自分が持つ", exact: true }).click();
    await expect(page.getByRole("region", { name: "承認したのに動かない", exact: true })).toContainText("高本");
    expect(m.bodies.update).toEqual([{ take: true }]);
    m.on.update = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-005" } });
    m.on.one = () => ({ status: 200, body: { data: detailOf({ owner: null }) } });
    await page.reload();
    await page.getByRole("button", { name: "自分が持つ", exact: true }).click();
    await expect(page.getByText("ほかの人が担当しています", { exact: false })).toBeVisible();
  });

  test("K976-UI-010 返す：返事を書いて［返す］で POST replies を 1 回（{ body }）・やり取りの最後に返事が足され、欄が空になり、状態が 返事待ち になる", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `?box=mine&id=${ID}`);
    m.on.reply = () => ({
      status: 201,
      body: {
        data: {
          id: "r1",
          kind: "reply",
          author_name: "高本",
          body: "預け直してください",
          attachments: [],
          created_at: new Date().toISOString(),
        },
      },
    });
    const box = page.getByLabel(/^返事\*?$/);
    await box.fill("預け直してください");
    await page.getByRole("button", { name: "返す", exact: true }).click();
    const thread = page.getByRole("region", { name: "承認したのに動かない", exact: true });
    await expect(thread.locator(".k-oq-msg").last()).toContainText("預け直してください");
    await expect(box).toHaveValue("");
    expect(m.bodies.reply).toEqual([{ body: "預け直してください" }]);
    await expect(page.locator(".k-oq-list li").first()).toContainText("返事待ち");
  });

  test("K976-UI-011 社内メモ：［社内メモにする］で POST notes を 1 回・社内メモの札つきで足される・状態は変わらない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `?box=mine&id=${ID}`);
    m.on.note = () => ({
      status: 201,
      body: {
        data: {
          id: "n1",
          kind: "note",
          author_name: "高本",
          body: "前に同じ件があった",
          attachments: [],
          created_at: new Date().toISOString(),
        },
      },
    });
    await page.getByLabel(/^返事\*?$/).fill("前に同じ件があった");
    await page.getByRole("button", { name: "社内メモにする", exact: true }).click();
    await expect(page.locator(".k-oq-msg[data-kind='memo']").last()).toContainText("前に同じ件があった");
    expect(m.bodies.note).toEqual([{ body: "前に同じ件があった" }]);
    expect(m.bodies.update ?? []).toEqual([]);
  });

  test("K976-UI-012 済みにする・後で：［済みにする］で PATCH { state: 'done' }・［後で › 明日の朝］で PATCH { later_until: <明日 9:00 日本時間> }", async ({
    page,
    baseURL,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-02T14:50:00Z")); // 日本の 11/02 23:50（0 時の手前でも明日は 11/03）
    const m = await open(page, baseURL, `?box=mine&id=${ID}`);
    m.on.update = () => ({ status: 200, body: { data: INBOX_A[0]! } });
    await page.getByRole("button", { name: "済みにする", exact: true }).click();
    await choose(page, page.getByRole("combobox", { name: "後で", exact: true }), "明日の朝");
    expect(m.bodies.update).toEqual([{ state: "done" }, { later_until: "2026-11-03T09:00:00+09:00" }]);
  });

  test("K976-UI-013 ほかの人が担当：「佐野 さんが担当になりました」・［返す］［済みにする］は押せない形で押しても口を呼ばない・［社内メモにする］は押せる", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `?box=mine&id=${ID}`);
    m.on.one = () => ({ status: 200, body: { data: detailOf({ owner: { member_id: SANO, name: "佐野" } }) } });
    m.on.note = () => ({
      status: 201,
      body: {
        data: {
          id: "n2",
          kind: "note",
          author_name: "高本",
          body: "x",
          attachments: [],
          created_at: new Date().toISOString(),
        },
      },
    });
    await page.reload();
    await expect(page.getByText("佐野 さんが担当になりました", { exact: true })).toBeVisible();
    for (const n of ["返す", "済みにする"]) {
      await expect(page.getByRole("button", { name: n, exact: true })).toHaveAttribute("aria-disabled", "true");
      await page.getByRole("button", { name: n, exact: true }).click({ force: true });
    }
    expect([m.bodies.reply ?? [], m.bodies.update ?? []]).toEqual([[], []]);
    await page.getByLabel(/返事/).fill("x");
    await page.getByRole("button", { name: "社内メモにする", exact: true }).click();
    expect(m.bodies.note).toEqual([{ body: "x" }]);
  });
  test("K976-UI-017 ［1 社を開く］：開いた 1 件の右の様子の［1 社を開く］は、その問い合わせのワークスペースの 1 社の画面（/ops/tenants/<workspace.id>）へのリンク", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL, `?box=mine&id=${ID}`);
    await expect(page.getByRole("link", { name: "1 社を開く", exact: true })).toHaveAttribute(
      "href",
      `/ops/tenants/${INBOX_A[0]!.workspace.id}`,
    );
  });
});

test.describe("K-976 失敗と守り", () => {
  test("K976-UI-014 読めない・送れない：一覧が 503 なら E-PAGE-007 の形と「もう一度」で読み直す。返すが 503 なら赤い箱で、書いた返事は残る", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `?box=mine&id=${ID}`);
    m.on.reply = () => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    await page.getByLabel(/^返事\*?$/).fill("残る返事");
    await page.getByRole("button", { name: "返す", exact: true }).click();
    await expect(page.locator("[role='alert']").first()).toBeVisible();
    await expect(page.getByLabel(/^返事\*?$/)).toHaveValue("残る返事");
    m.on.list = () => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    await page.goto(`${local(baseURL)}/ops/support?box=mine`);
    await expect(page.getByRole("button", { name: "もう一度", exact: true })).toBeVisible();
    m.on.list = () => ({ status: 200, body: { data: INBOX_A } });
    await page.getByRole("button", { name: "もう一度", exact: true }).click();
    await expect(page.locator(".k-oq-list li")).toHaveCount(3);
  });

  test("K976-UI-015 問い合わせ（inquiry）を持たない人：本文は「この画面を見る権限がありません」で受信箱の口を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const ops = await mockOps(page);
    ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: ME, caps: ["money"] } }) } });
    const m = await mockInbox(page);
    await signInOps(page, local(baseURL), "/ops/support");
    await expect(page.getByText("見る権限がありません", { exact: false })).toBeVisible();
    expect(m.calls.length).toBe(0);
  });

  test("K976-UI-016 幅と字：320・375・768・1024・1440 で一覧と 1 件の横のはみ出しが 0 以下。HTML の入った題・本文は字のまま・スクリプトが動かない・取引先・業務の型・書き出・CSV が無い", async ({
    page,
    baseURL,
  }) => {
    const evil = `<img src=x onerror="window.__k976=1">`;
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: ME, caps: ["inquiry"] }, inbox: INBOX }) },
    });
    const m = await mockInbox(page);
    m.on.one = () => ({
      status: 200,
      body: { data: { ...detailOf({ title: evil }), messages: [{ ...detailOf().messages[0]!, body: evil }] } },
    });
    await signInOps(page, local(baseURL), `/ops/support?box=mine&id=${ID}`);
    for (const w of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(await overflowX(page), String(w)).toBeLessThanOrEqual(0);
    }
    await expect(page.locator(".k-oq-msg").first()).toContainText(evil);
    expect(await page.evaluate(() => (window as unknown as { __k976?: number }).__k976)).toBeUndefined();
    expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
  });
});
