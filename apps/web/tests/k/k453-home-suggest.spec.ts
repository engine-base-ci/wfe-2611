// K-453「空の一覧のおすすめ 3 つ（押すと題名に入れて作る面を開く）とスマホの「＋」」の画面の試験（実 Chrome・実装より先に積む）。
//   行 ID は 11_tickets/K-453.md の行の表（K453-UI-001〜010。011 は人が確かめる）。正のモック：/dev/mock/f4/f4-home-empty（本番と同じ部品 features/F4/home/views.tsx）。
//   口は網の手前で差し替える：前からの道具 list-mock.ts の mockList（一覧が 0 件）の上に、作る口の POST と書きかけの口だけを足す。
//   決め（D-150.18・切る段の決め）：おすすめを押すと `/tickets?new=1&title=<字>` を開き、作る面の題名にその字を入れる。
//   書きかけの題名が在れば書きかけを守る（おすすめの字は入れない）。題名の受け取りは K-431 の seed。
//   スマホの「＋」は今のまま同じ作る面を開く（話して作る面 MbCreate の AI の分は段 6・押せない形のまま）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { fillDue, loaded } from "./create-mock";
import { ME, SALES, TASK, mockList, ok, open, overflowX } from "./list-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const SUGGEST = ["今月の請求書を送る", "問い合わせに返す", "見積を作る"] as const;
const NEW_ID = "0193c5a0-0000-7000-8000-00000000c453";
const empty = (page: Page): Locator => page.locator('[data-state="empty"]');
const title = (page: Page): Locator => page.getByRole("textbox", { name: "題名", exact: true });
const suggest = (page: Page, t: string): Locator => empty(page).getByRole("button", { name: t, exact: true });
const jstNow = (days: number): string =>
  new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const EMPTY_LIST = { list: () => ok([], { next_cursor: null }) };

/** 0 件の一覧を開く（作る口の POST と書きかけの口を足す。書きかけは drafts で渡す） */
async function openHome(
  page: Page,
  o: { writable?: string[]; drafts?: Record<string, unknown>[]; width?: number } = {},
): Promise<{ posts: Record<string, unknown>[] }> {
  await mockList(page, { ...EMPTY_LIST, ...(o.writable ? { writable: o.writable } : {}) });
  const posts: Record<string, unknown>[] = [];
  await page.route(/\/api\/v1\/me\/ticket-drafts$/, (route: Route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: o.drafts ?? [], meta: {} }),
        })
      : route.fallback(),
  );
  await page.route(/\/api\/v1\/tickets$/, async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback();
    posts.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: NEW_ID, number: "EG-133", title: "作った" } }),
    });
  });
  await open(page, "/tickets", o.width ?? 1440);
  await expect(empty(page).getByRole("heading", { name: "まだチケットはありません" })).toBeVisible();
  return { posts };
}
const draftOf = (body: Record<string, unknown>) => [
  {
    draft_id: "0193c5a0-0000-7000-8000-00000000d453",
    body: {
      scope_id: SALES,
      kind_id: TASK,
      assignee_member_id: ME,
      due_on: jstNow(3),
      priority: "mid",
      notify_member_ids: [],
      ...body,
    },
    saved_at: "2026-11-16T01:42:00Z",
  },
];
test("K453-UI-001 書ける人の 0 件：おすすめの 3 つは押せるボタン（「今月の請求書を送る」「問い合わせに返す」「見積を作る」）・「分身と話して作る」は押せない形のまま（aria-disabled）・主「＋ チケットを作る」も在る", async ({
  page,
}) => {
  await openHome(page);
  for (const t of SUGGEST) {
    await expect(suggest(page, t), t).toBeVisible();
    await expect(suggest(page, t), t).not.toHaveAttribute("aria-disabled", "true");
  }
  await expect(empty(page).locator('[aria-disabled="true"]', { hasText: "分身と話して作る" })).toHaveCount(1);
  await expect(empty(page).getByRole("button", { name: "＋ チケットを作る", exact: true })).toHaveCount(1);
});

for (const t of SUGGEST) {
  test(`K453-UI-002 「${t}」を押すと、作る面（/tickets?new=1）が開いて題名の欄にその字が入る。道は /tickets の new=1 つき`, async ({
    page,
  }) => {
    await openHome(page);
    await suggest(page, t).click();
    await expect(page.getByRole("region", { name: "チケットを作る" })).toBeVisible();
    await loaded(page);
    await expect(title(page)).toHaveValue(t);
    expect(new URL(page.url()).searchParams.get("new")).toBe("1");
  });
}

test("K453-UI-003 書きかけに題名が在る：おすすめを押しても、作る面の題名は書きかけのまま（書いたものを守る）", async ({
  page,
}) => {
  await openHome(page, { drafts: draftOf({ title: "セイコー様へ 12月分の請求書を送る" }) });
  await suggest(page, SUGGEST[1]).click();
  await loaded(page);
  await expect(title(page)).toHaveValue("セイコー様へ 12月分の請求書を送る");
});

test("K453-UI-004 書きかけに題名が無い（本文だけ）：題名はおすすめの字・本文などの書きかけは戻る", async ({ page }) => {
  await openHome(page, { drafts: draftOf({ title: "", sections: { purpose: "書きかけの目的" } }) });
  await suggest(page, SUGGEST[2]).click();
  await loaded(page);
  await expect(title(page)).toHaveValue(SUGGEST[2]);
  await expect(page.getByRole("combobox", { name: "担当者" })).toContainText("高本");
});

test("K453-UI-005 押した結果まで：おすすめの題名で担当者・期限を入れて作ると、作る口の体の title がおすすめの字で届き、詳細へ移る", async ({
  page,
}) => {
  const { posts } = await openHome(page);
  await suggest(page, SUGGEST[0]).click();
  await loaded(page);
  await page.getByRole("combobox", { name: "担当者" }).click();
  await page.getByRole("option", { name: "高本", exact: true }).click();
  await fillDue(page, jstNow(3));
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]!["title"]).toBe(SUGGEST[0]);
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/);
});

test("K453-UI-006 書けない人（閲覧のみ）の 0 件：おすすめは押せない形（aria-disabled・ボタンでない）・押しても Enter でも移らず口も呼ばない・空の箱にボタンは 0", async ({
  page,
}) => {
  const m = await mockList(page, { ...EMPTY_LIST, writable: [] });
  await open(page);
  const box = empty(page);
  await expect(box.getByRole("heading", { name: "まだチケットはありません" })).toBeVisible();
  await expect(box.getByRole("button")).toHaveCount(0);
  const before = page.url();
  for (const t of SUGGEST) {
    const it = box.locator('[aria-disabled="true"]', { hasText: t });
    await expect(it, t).toHaveCount(1);
    await it.click({ force: true });
    await it.press("Enter");
    expect(page.url(), t).toBe(before);
  }
  expect(m.otherCalls.filter((c) => !c.startsWith("GET "))).toEqual([]);
});

test("K453-UI-007 キーボード：おすすめに Tab で届き Enter で作る面が開いて題名に入る", async ({ page }) => {
  await openHome(page);
  const b = suggest(page, SUGGEST[1]);
  await b.focus();
  await expect(b).toBeFocused();
  await page.keyboard.press("Enter");
  await loaded(page);
  await expect(title(page)).toHaveValue(SUGGEST[1]);
});

test("K453-UI-008 スマホの「＋」（幅 375）：下のタブの「＋」は今のまま同じ作る面（/tickets?new=1）を開き、題名は空・横溢れ 0。話して作る分（AI）は押せるボタン（K-767・D-153.17）", async ({
  page,
}) => {
  await openHome(page, { width: 375 });
  const plus = page.locator(".k-tab-create");
  await expect(plus).toBeVisible();
  await plus.click();
  await expect(page.getByRole("region", { name: "チケットを作る" })).toBeVisible();
  await loaded(page);
  await expect(title(page)).toHaveValue("");
  expect(new URL(page.url()).searchParams.get("new")).toBe("1");
  expect(await overflowX(page)).toBe(0);
  const ai = page.getByLabel("作り方", { exact: true }).getByRole("button", { name: "AI と話して作る", exact: true });
  await expect(ai).toBeEnabled();
});

test("K453-UI-009 幅 375・768・1440：おすすめの 3 つが出ている 0 件の一覧と、おすすめを押した後の作る面で横溢れ 0", async ({
  page,
}) => {
  for (const w of [375, 768, 1440]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await openHome(page, { width: w });
    expect(await overflowX(page), `幅 ${w}・一覧`).toBe(0);
    await suggest(page, SUGGEST[0]).click();
    await loaded(page);
    await expect(title(page)).toHaveValue(SUGGEST[0]);
    expect(await overflowX(page), `幅 ${w}・作る面`).toBe(0);
  }
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock）
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const PAIRS: FidelityPair[] = [
  ["greet", ".k-list-greet", ["x", ...TEXT]],
  ["box", ".k-list-empty", ["width", "background-color", "border-top-color", "border-top-style"]],
  ["head", ".k-list-empty h2", TEXT],
  ["line", ".k-list-suggest", ["width", ...TEXT]],
  ["suggest", ".k-f4-home-suggest", ["height", "font-size", "color", "texts"]],
  ["main", ".k-list-empty .k-list-act", ["height", "font-size", "color", "background-color", "texts"]],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));
for (const w of MATCH_WIDTHS) {
  test(`K453-UI-010 f4-home-empty 幅 ${w}：あいさつ・空の箱・見出し・おすすめの行と 3 つの押せる字・主ボタンの値がモックと同じ`, async ({
    browser,
  }) => {
    const { rows, bad } = await matchMock(
      browser,
      "f4-home-empty",
      w,
      async (page) => {
        await openHome(page, { width: w });
      },
      { pairs: PAIRS, base: "/dev/mock/f4", blur: true },
    );
    expect(
      rows.some((r) => r.part === "suggest"),
      "押せる字を比べた",
    ).toBe(true);
    expect(bad, bad.join("\n")).toEqual([]);
  });
}
