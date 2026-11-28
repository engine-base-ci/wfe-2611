// K-684「木の操作と「…」メニュー（＋ でページ／フォルダを足す・前の版を見る・リンクをコピー・別のフォルダへ動かす・消す）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/kn-more・kn-add・kn-move・kn-delete・kn-versions（下絵 v2 に無かった物をこの葉が足した・本番と同じ部品 features/F9/knowledge/tree-ops.tsx・
//   代表がまだ見ていない絵＝字は仮）。モックとの比べ方は f9-match.ts の matchF9。ログイン・外枠・役は本物。ナレッジの口だけ網の手前で差し替える（knowledge-mock.ts）。
//   口の答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章。本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { F9_WIDTHS, KN_PAIRS, matchF9 } from "./f9-match";
import {
  F_CS,
  F_KEIRI,
  G_SALES,
  INVOICE_DOC,
  P_EXPENSE,
  P_INVOICE,
  P_NEW,
  doc,
  err,
  H2,
  P,
  mockKnowledge,
  msg,
  pageInvoice,
  textOf,
  treeEmpty,
  uid,
  type KMock,
} from "./knowledge-mock";

const TREE = 'aside[aria-label="ナレッジの木"]';
const CARD = "article.k-f9-card";
const DLG = ".k-dialog";
const TOAST = ".k-toast";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

const VERSIONS = [
  { version: 4, published_at: "2026-11-18T03:00:00Z", by_name: "高本 聖斗" },
  { version: 3, published_at: "2026-11-02T03:00:00Z", by_name: "佐藤 花子" },
  { version: 2, published_at: "2026-10-20T03:00:00Z", by_name: "高本 聖斗" },
  { version: 1, published_at: "2026-10-05T03:00:00Z", by_name: "高本 聖斗" },
];
const verBody = (n: number) => doc(H2(`版 ${n} の見出し`), P(`版 ${n} の本文。`));
async function mock(page: Page, over: Parameters<typeof mockKnowledge>[1] = {}): Promise<KMock> {
  const mk = await mockKnowledge(page, over);
  mk.versions.set(
    P_INVOICE,
    VERSIONS.map((v) => ({ ...v, body: { doc: verBody(v.version), text: textOf(verBody(v.version)) } })),
  );
  return mk;
}
// 幅 1023 以下の木は引き出し（K-682）。引き出しは本文の上に重なるので、木を使う状態（kn-add の「＋」）だけ開く。
//   下絵は「見積もり」のフォルダを開いた木（K-682 の木は開いているページの親だけを初めから開く・K682-UI-001 と同じく開いてから比べる）
async function openAt(page: Page, id: string, width = 1440, useTree = false): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`/knowledge/${id}`);
  await expect(page.locator(CARD).getByRole("heading", { level: 1 })).toBeVisible();
  if (width <= 1023 && useTree) await page.getByRole("button", { name: "木を開く", exact: true }).click();
}
async function likeMock(page: Page, width: number): Promise<void> {
  if (width >= 1024) await page.locator(TREE).getByRole("button", { name: "見積もり", exact: true }).click();
}
const more = (p: Page) => p.getByRole("button", { name: "このページのほかの操作", exact: true });
async function pickMore(page: Page, name: string): Promise<void> {
  await more(page).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
const plus = (p: Page, shelf: string) =>
  p.locator(TREE).getByRole("button", { name: `${shelf}の棚にページかフォルダを足す`, exact: true });
async function choose(page: Page, dlg: Locator, label: string, option: string): Promise<void> {
  await dlg.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function openAdd(page: Page, shelf = "会社"): Promise<Locator> {
  await plus(page, shelf).click();
  const dlg = page
    .locator(DLG)
    .filter({ has: page.getByRole("heading", { name: "ページかフォルダを足す", exact: true }) });
  await expect(dlg).toBeVisible();
  return dlg;
}
const dlgOf = (p: Page, title: string) =>
  p.locator(DLG).filter({ has: p.getByRole("heading", { name: title, exact: true }) });

// ---------------------------------------------------------------- モックと本番の突き合わせ
const STATES: Record<string, (page: Page, w: number) => Promise<void>> = {
  "kn-more": async (page, w) => {
    await mock(page);
    await openAt(page, P_INVOICE, w);
    await likeMock(page, w);
    await more(page).click();
    await expect(page.getByRole("menuitem", { name: "前の版を見る", exact: true })).toBeVisible();
  },
  "kn-add": async (page, w) => {
    await mock(page);
    await openAt(page, P_INVOICE, w, true);
    await likeMock(page, w);
    await openAdd(page);
  },
  "kn-move": async (page, w) => {
    await mock(page);
    await openAt(page, P_INVOICE, w);
    await likeMock(page, w);
    await pickMore(page, "別のフォルダへ動かす");
    const dlg = dlgOf(page, "別のフォルダへ動かす");
    await choose(page, dlg, "動かす先", "お客さま対応");
  },
  "kn-delete": async (page, w) => {
    await mock(page);
    await openAt(page, P_EXPENSE, w);
    await likeMock(page, w);
    await pickMore(page, "消す…");
    await expect(page.getByRole("alertdialog", { name: "このページを消しますか", exact: true })).toBeVisible();
  },
  "kn-versions": async (page, w) => {
    await mock(page);
    await openAt(page, P_INVOICE, w);
    await likeMock(page, w);
    await pickMore(page, "前の版を見る");
    const dlg = dlgOf(page, "前の版を見る");
    await choose(page, dlg, "版", "版 3 ・ 11/02 ・ 佐藤 花子");
    await expect(dlg.getByLabel("この版の本文", { exact: true })).toContainText("版 3 の本文。");
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of F9_WIDTHS) {
    test(`K684-UI-001 ${id} 幅 ${w}：メニュー・小窓の位置と大きさと字がモックと同じ（本文はモックの見本と違う字なので小窓の本文の高さは比べない）`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchF9(
        browser,
        id,
        w,
        async (page) => {
          await drive(page, w);
        },
        {
          skip: ["dialog:height", "card:height", "tree:height"],
          // 前の版の小窓は本文の見出し（h2）も持つので、小窓の題（.k-dialog-title）だけを題として比べる（PM の決め 2026-11-28）
          ...(id === "kn-versions"
            ? {
                pairs: KN_PAIRS.map((p) =>
                  p.name === "dialog-title"
                    ? { ...p, canvas: ".k-dialog .k-dialog-title", app: ".k-dialog .k-dialog-title" }
                    : p,
                ),
              }
            : {}),
        },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- ＋（ページかフォルダを足す）
test("K684-UI-002 「＋」を押すと小窓「ページかフォルダを足す」：口 0 回・足す物は「ページ」が既定・入れる場所の既定は開いているページのフォルダ（無ければ棚の直下）・題名の欄に焦点・書ける棚にだけ「＋」", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  const before = mk.calls.length;
  const dlg = await openAdd(page);
  await expect(dlg.getByRole("combobox", { name: "足す物", exact: true })).toContainText("ページ");
  await expect(dlg.getByRole("combobox", { name: "入れる場所", exact: true })).toContainText("経理");
  await expect(dlg.getByRole("textbox", { name: "題名", exact: true })).toBeFocused();
  expect(mk.calls.length).toBe(before);
  await expect(plus(page, "営業")).toHaveCount(0);
});

test("K684-UI-003 ページを足す：題名を入れて「書き始める」→ 口 1 回（体は shelf・folder_id・title・冪等の鍵あり）→ /knowledge/<新しい id> に移り（書いている画面は K-683）、木に新しいページが「下書き」の印で出る", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  const dlg = await openAdd(page);
  await dlg.getByRole("textbox", { name: "題名", exact: true }).fill("お詫びのメールの決まり");
  await dlg.getByRole("button", { name: "書き始める", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_NEW}$`));
  const c = mk.calls.find((x) => x.op === "createPage")!;
  expect(c.body).toMatchObject({ shelf: "company", folder_id: F_KEIRI, title: "お詫びのメールの決まり" });
  expect(c.key).toBeTruthy();
  expect(mk.count("createPage")).toBe(1);
  await expect(page.locator(TREE).getByText("お詫びのメールの決まり", { exact: true })).toBeVisible();
  await expect(page.locator(DLG)).toHaveCount(0);
});

test("K684-UI-004 棚ごとの体：グループの棚（マネージャー）は shelf=group と group_id・自分の棚は shelf=me・棚の直下を選べば folder_id は無い（null）", async ({
  page,
}) => {
  const mk = await mock(page);
  mk.tree.can_write.group_ids = [G_SALES];
  await openAt(page, P_INVOICE);
  let dlg = await openAdd(page, "営業");
  await dlg.getByRole("textbox", { name: "題名", exact: true }).fill("営業のメモ");
  await dlg.getByRole("button", { name: "書き始める", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_NEW}$`));
  expect(mk.calls.find((x) => x.op === "createPage")!.body).toMatchObject({
    shelf: "group",
    group_id: G_SALES,
    title: "営業のメモ",
  });
  await page.goto(`/knowledge/${P_INVOICE}`);
  dlg = await openAdd(page, "自分");
  await dlg.getByRole("textbox", { name: "題名", exact: true }).fill("自分のメモ");
  await dlg.getByRole("button", { name: "書き始める", exact: true }).click();
  const second = mk.calls.filter((x) => x.op === "createPage")[1]!;
  expect(second.body).toMatchObject({ shelf: "me", title: "自分のメモ" });
  expect(second.body["folder_id"] ?? null).toBeNull();
});

test("K684-UI-005 名前が空白だけで足す：口を呼ばず欄の下に文（ページは「題名を入れてください」・フォルダは「フォルダの名前を入れてください」・仮）・aria-invalid・小窓は閉じない・字を入れると消える", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  const dlg = await openAdd(page);
  const before = mk.calls.length;
  await dlg.getByRole("textbox", { name: "題名", exact: true }).fill("   ");
  await dlg.getByRole("button", { name: "書き始める", exact: true }).click();
  await expect(dlg.locator(".k-err")).toHaveText("題名を入れてください");
  await expect(dlg.getByRole("textbox", { name: "題名", exact: true })).toHaveAttribute("aria-invalid", "true");
  await choose(page, dlg, "足す物", "フォルダ");
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg.locator(".k-err")).toHaveText("フォルダの名前を入れてください");
  expect(mk.calls.length).toBe(before);
  await dlg.getByRole("textbox", { name: "フォルダの名前", exact: true }).fill("法務");
  await expect(dlg.locator(".k-err")).toHaveCount(0);
});

test("K684-UI-006 フォルダを足す：種類を「フォルダ」にして名前を入れ「足す」→ 口 1 回（体は shelf・parent_folder_id・name）・小窓が閉じ・木に新しいフォルダが出る・ページは動かない・お知らせ「フォルダを足しました」（仮）", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  const dlg = await openAdd(page);
  await choose(page, dlg, "足す物", "フォルダ");
  await dlg.getByRole("textbox", { name: "フォルダの名前", exact: true }).fill("法務");
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  const c = mk.calls.find((x) => x.op === "createFolder")!;
  expect(c.body).toMatchObject({ shelf: "company", parent_folder_id: F_KEIRI, name: "法務" });
  await expect(page.locator(TREE).getByRole("button", { name: "法務", exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_INVOICE}$`));
  await expect(page.locator(TOAST)).toContainText("フォルダを足しました");
  expect(mk.count("createPage")).toBe(0);
});

for (const [code, status] of [
  ["E-KNW-020", 409],
  ["E-KNW-021", 409],
] as const)
  test(`K684-UI-007 フォルダを足す口が断る（${code}）：欄の下の赤字に正本の文・小窓は閉じず名前は残り・直して押し直せる`, async ({
    page,
  }) => {
    const mk = await mock(page);
    mk.script("createFolder", err(status, code));
    await openAt(page, P_INVOICE);
    const dlg = await openAdd(page);
    await choose(page, dlg, "足す物", "フォルダ");
    await dlg.getByRole("textbox", { name: "フォルダの名前", exact: true }).fill("経理");
    await dlg.getByRole("button", { name: "足す", exact: true }).click();
    await expect(dlg.locator(".k-err")).toHaveText(msg(code));
    await expect(dlg.getByRole("textbox", { name: "フォルダの名前", exact: true })).toHaveValue("経理");
    await dlg.getByRole("textbox", { name: "フォルダの名前", exact: true }).fill("経理 2");
    await dlg.getByRole("button", { name: "足す", exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    expect(mk.count("createFolder")).toBe(2);
  });

for (const [name, reply, text] of [
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002"],
  ["404", err(404, "E-PAGE-001"), "E-PAGE-001"],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003"],
  ["網の切れ", "network", "E-PAGE-008"],
] as const)
  test(`K684-UI-008 ページを足す口が失敗（${name}）：小窓の上の赤い箱に ${text} の文・題名は残り押し直せる・通れば書いている画面へ`, async ({
    page,
  }) => {
    const mk = await mock(page);
    mk.script("createPage", reply);
    await openAt(page, P_INVOICE);
    const dlg = await openAdd(page);
    await dlg.getByRole("textbox", { name: "題名", exact: true }).fill("失敗のあとで足す");
    await dlg.getByRole("button", { name: "書き始める", exact: true }).click();
    await expect(dlg.getByRole("alert")).toContainText(msg(text));
    await expect(dlg.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("失敗のあとで足す");
    await dlg.getByRole("button", { name: "書き始める", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/knowledge/${P_NEW}$`));
    expect(mk.count("createPage")).toBe(2);
  });

test("K684-UI-009 二度押し：足す口の答えを止めた間に「書き始める」を 2 回押しても口は 1 回・ボタンは押せない（ページは 1 つしかできない）", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  const dlg = await openAdd(page);
  await dlg.getByRole("textbox", { name: "題名", exact: true }).fill("二度押し");
  const release = mk.hold("createPage");
  const go = dlg.getByRole("button", { name: "書き始める", exact: true });
  await go.click();
  await expect(go).toBeDisabled();
  await go.dispatchEvent("click"); // 押せない形のボタンへの 2 度目のクリック（何も起きない）
  expect(mk.count("createPage")).toBe(1);
  release();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_NEW}$`));
  expect(mk.count("createPage")).toBe(1);
});

// ---------------------------------------------------------------- 「…」メニュー
test("K684-UI-010 「…」の中の項目は口の答えの acts どおり：書ける人は 前の版を見る・リンクをコピー・別のフォルダへ動かす・消す…の 4 つ／共有された側は前の版とリンクだけ（動かす・消すが無い）", async ({
  page,
}) => {
  await mock(page, {
    pages: [
      pageInvoice(),
      pageInvoice({
        id: uid(0xa111),
        title: "共有されたページ",
        acts: ["copy"],
        shared_from: { group_name: "営業", writable: false },
      }),
    ],
  });
  await openAt(page, P_INVOICE);
  await more(page).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "前の版を見る",
    "リンクをコピー",
    "別のフォルダへ動かす",
    "消す…",
  ]);
  await page.keyboard.press("Escape");
  await page.goto(`/knowledge/${uid(0xa111)}`);
  await more(page).click();
  await expect(page.getByRole("menuitem")).toHaveText(["前の版を見る", "リンクをコピー"]);
});

test("K684-UI-011 前の版を見る：開いたとき版の一覧の口 1 回・新しい順（版 4・3・2・1）・既定は最新・本文は読むだけ（DocView）・別の版を選ぶとその版の口 1 回で本文が替わる・「戻す」は無い", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  await pickMore(page, "前の版を見る");
  const dlg = dlgOf(page, "前の版を見る");
  await expect(dlg.getByRole("combobox", { name: "版", exact: true })).toContainText("版 4 ・ 11/18 ・ 高本 聖斗");
  await expect(dlg.getByLabel("この版の本文", { exact: true })).toContainText("版 4 の本文。");
  expect(mk.count("versions", P_INVOICE)).toBe(1);
  await choose(page, dlg, "版", "版 2 ・ 10/20 ・ 高本 聖斗");
  await expect(dlg.getByLabel("この版の本文", { exact: true })).toContainText("版 2 の本文。");
  expect(mk.count("version", P_INVOICE)).toBe(2);
  await expect(dlg.getByRole("button", { name: /戻す|復元/ })).toHaveCount(0);
  await expect(dlg.getByRole("textbox", { name: "本文" })).toHaveCount(0);
});

test("K684-UI-012 前の版が 1 つも無い（まだ書き終えていないページ）：小窓に「前の版はまだありません」（仮）・版の欄は出ない", async ({
  page,
}) => {
  const mk = await mock(page);
  mk.versions.set(P_INVOICE, []);
  await openAt(page, P_INVOICE);
  await pickMore(page, "前の版を見る");
  const dlg = dlgOf(page, "前の版を見る");
  await expect(dlg.getByText("前の版はまだありません", { exact: true })).toBeVisible();
  await expect(dlg.getByRole("combobox")).toHaveCount(0);
});

test("K684-UI-013 前の版の口が失敗：一覧が 503 なら小窓の赤い箱（E-PAGE-003）・版の本文が 404 なら赤い箱（E-PAGE-001）・閉じて開き直すと読み直す", async ({
  page,
}) => {
  const mk = await mock(page);
  mk.script("versions", err(503, "E-PAGE-003"));
  await openAt(page, P_INVOICE);
  await pickMore(page, "前の版を見る");
  await expect(dlgOf(page, "前の版を見る").getByRole("alert")).toContainText(msg("E-PAGE-003"));
  await page.keyboard.press("Escape");
  mk.script("version", err(404, "E-PAGE-001"));
  await pickMore(page, "前の版を見る");
  const dlg = dlgOf(page, "前の版を見る");
  await expect(dlg.getByRole("alert")).toContainText(msg("E-PAGE-001"));
  expect(mk.count("versions", P_INVOICE)).toBe(2);
});

test("K684-UI-014 リンクをコピー：クリップボードに今の origin の /knowledge/<id>・口 0 回・お知らせ「リンクをコピーしました」（仮）。コピーできないときは「コピーできませんでした。アドレスの欄から写してください」（仮）", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  const before = mk.calls.length;
  await pickMore(page, "リンクをコピー");
  await expect(page.locator(TOAST)).toContainText("リンクをコピーしました");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toBe(`${new URL(page.url()).origin}/knowledge/${P_INVOICE}`);
  expect(mk.calls.length).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: () => Promise.reject(new Error("denied")),
      configurable: true,
    });
  });
  await pickMore(page, "リンクをコピー");
  await expect(page.locator(TOAST).filter({ hasText: "コピーできませんでした" })).toBeVisible();
});

// ---------------------------------------------------------------- 動かす
test("K684-UI-015 別のフォルダへ動かす：動かす先は同じ棚の棚の直下とフォルダ（今の場所が既定）・選んで「動かす」→ 口 1 回（体は folder_id だけ・棚の直下は null）→ 小窓が閉じ・木の新しい場所に出る・場所の字が替わる・お知らせ「ページを動かしました」（仮）", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  await pickMore(page, "別のフォルダへ動かす");
  const dlg = dlgOf(page, "別のフォルダへ動かす");
  await expect(dlg.getByRole("combobox", { name: "動かす先", exact: true })).toContainText("経理");
  await choose(page, dlg, "動かす先", "お客さま対応");
  await dlg.getByRole("button", { name: "動かす", exact: true }).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  const c = mk.calls.find((x) => x.op === "move")!;
  expect(c.body).toEqual({ folder_id: F_CS });
  await expect(page.locator(`${CARD} .k-f9-place`)).toContainText("お客さま対応");
  await expect(page.locator(TOAST)).toContainText("ページを動かしました");
  await pickMore(page, "別のフォルダへ動かす");
  await choose(page, dlgOf(page, "別のフォルダへ動かす"), "動かす先", "（会社の棚の直下）");
  await dlgOf(page, "別のフォルダへ動かす").getByRole("button", { name: "動かす", exact: true }).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.calls.filter((x) => x.op === "move")[1]!.body).toEqual({ folder_id: null });
});

test("K684-UI-016 動かす：今の場所と同じ先は「動かす」が押せない（口 0 回）・動かす先に別の棚のフォルダは出ない・口が 409（E-KNW-011：承認待ち）なら小窓の赤い箱に正本の文で字と選びは残る", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  await pickMore(page, "別のフォルダへ動かす");
  const dlg = dlgOf(page, "別のフォルダへ動かす");
  await expect(dlg.getByRole("button", { name: "動かす", exact: true })).toBeDisabled();
  await dlg.getByRole("combobox", { name: "動かす先", exact: true }).click();
  // 今の場所の選択肢には印 ✓ が中に出る（Base UI の ItemIndicator）ので、字は終わりで見る
  await expect(page.getByRole("option")).toHaveText([/（会社の棚の直下）$/, /経理$/, /お客さま対応$/]);
  await page.getByRole("option", { name: "お客さま対応", exact: true }).click();
  mk.script("move", err(409, "E-KNW-011"));
  await dlg.getByRole("button", { name: "動かす", exact: true }).click();
  await expect(dlg.getByRole("alert")).toContainText(msg("E-KNW-011"));
  await expect(dlg.getByRole("combobox", { name: "動かす先", exact: true })).toContainText("お客さま対応");
  expect(mk.count("move")).toBe(1);
});

// ---------------------------------------------------------------- 消す
test("K684-UI-017 消す…：確かめの小窓「このページを消しますか」（開いたときの焦点は「やめる」）・「やめる」で口 0 回・「消す」で口 1 回 → /knowledge に移り木から無くなる・お知らせ「ページを消しました」（仮）・開き直すと「見られない」", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_EXPENSE);
  await pickMore(page, "消す…");
  const dlg = page.getByRole("alertdialog", { name: "このページを消しますか", exact: true });
  await expect(dlg.getByRole("button", { name: "やめる", exact: true })).toBeFocused();
  await expect(dlg).toContainText("元に戻す画面はありません");
  await dlg.getByRole("button", { name: "やめる", exact: true }).click();
  expect(mk.count("delete")).toBe(0);
  await pickMore(page, "消す…");
  await page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  expect(mk.count("delete", P_EXPENSE)).toBe(1);
  await expect(page.locator(TREE).getByText("経費の精算", { exact: true })).toHaveCount(0);
  await expect(page.locator(TOAST)).toContainText("ページを消しました");
  await page.goto(`/knowledge/${P_EXPENSE}`);
  await expect(page.locator('[data-code="E-PAGE-002"]')).toBeVisible();
});

for (const code of ["E-KNW-050", "E-KNW-051", "E-KNW-011"])
  test(`K684-UI-018 消す口が断る（${code}：必ず守る・共有・承認待ち）：小窓の中に正本の文（先に外してから）・ページは木に残る・読む形のまま・押し直せる`, async ({
    page,
  }) => {
    const mk = await mock(page);
    mk.script("delete", err(409, code));
    await openAt(page, P_EXPENSE);
    await pickMore(page, "消す…");
    const dlg = page.getByRole("alertdialog");
    await dlg.getByRole("button", { name: "消す", exact: true }).click();
    await expect(dlg.getByRole("alert")).toContainText(msg(code));
    await dlg.getByRole("button", { name: "やめる", exact: true }).click();
    await expect(page.locator(TREE).getByText("経費の精算", { exact: true })).toBeVisible();
    await expect(page.locator(CARD).getByRole("heading", { name: "経費の精算", level: 1, exact: true })).toBeVisible();
    expect(mk.count("delete")).toBe(1);
  });

test("K684-UI-019 消すが失敗（503）は小窓の赤い箱で押し直せて通れば消える・二度押しは答えを止めた間に 2 回押しても口 1 回", async ({
  page,
}) => {
  const mk = await mock(page);
  mk.script("delete", err(503, "E-PAGE-003"));
  await openAt(page, P_EXPENSE);
  await pickMore(page, "消す…");
  const dlg = page.getByRole("alertdialog");
  await dlg.getByRole("button", { name: "消す", exact: true }).click();
  await expect(dlg.getByRole("alert")).toContainText(msg("E-PAGE-003"));
  const release = mk.hold("delete");
  const go = dlg.getByRole("button", { name: "消す", exact: true });
  await go.click();
  await go.dispatchEvent("click"); // 押せない形のボタンへの 2 度目のクリック（何も起きない）
  expect(mk.count("delete")).toBe(2);
  release();
  await expect(page).toHaveURL(/\/knowledge$/);
  expect(mk.count("delete")).toBe(2);
});

test("K684-UI-020 権限が外れた直後（開いていた画面で押す）：動かす・消すとも口が 403 で止め、小窓の赤い箱に E-PAGE-002 の文・ページは木に残る（画面の表示に頼らない）", async ({
  page,
}) => {
  const mk = await mock(page);
  mk.script("move", err(403, "FORBIDDEN"));
  mk.script("delete", err(403, "FORBIDDEN"));
  await openAt(page, P_EXPENSE);
  await pickMore(page, "別のフォルダへ動かす");
  const d1 = dlgOf(page, "別のフォルダへ動かす");
  await choose(page, d1, "動かす先", "お客さま対応");
  await d1.getByRole("button", { name: "動かす", exact: true }).click();
  await expect(d1.getByRole("alert")).toContainText(msg("E-PAGE-002"));
  await page.keyboard.press("Escape");
  await pickMore(page, "消す…");
  const d2 = page.getByRole("alertdialog");
  await d2.getByRole("button", { name: "消す", exact: true }).click();
  await expect(d2.getByRole("alert")).toContainText(msg("E-PAGE-002"));
  await d2.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(page.locator(TREE).getByText("経費の精算", { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- 空の木・やめる・キーボード・幅・XSS
test("K684-UI-021 まだ 1 枚も無い木の「最初のページを書く」が押せて、「＋」と同じ小窓が自分の棚で開く（仮）・押すと題名を入れて書き始められる", async ({
  page,
}) => {
  const mk = await mockKnowledge(page, { tree: treeEmpty(), pages: [] });
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto("/knowledge");
  await page.getByRole("button", { name: "最初のページを書く", exact: true }).click();
  const dlg = page
    .locator(DLG)
    .filter({ has: page.getByRole("heading", { name: "ページかフォルダを足す", exact: true }) });
  await expect(dlg).toContainText("自分の棚");
  await dlg.getByRole("textbox", { name: "題名", exact: true }).fill("最初のページ");
  await dlg.getByRole("button", { name: "書き始める", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_NEW}$`));
  expect(mk.calls.find((x) => x.op === "createPage")!.body).toMatchObject({ shelf: "me", title: "最初のページ" });
});

test("K684-UI-022 やめる・Esc：どの小窓も口を呼ばずに閉じ、焦点は押した所（「＋」・「…」）に戻り、開き直すと空（足す小窓）・今の場所（動かす小窓）", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  const before = mk.calls.length;
  const dlg = await openAdd(page);
  await dlg.getByRole("textbox", { name: "題名", exact: true }).fill("途中の字");
  await page.keyboard.press("Escape");
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(plus(page, "会社")).toBeFocused();
  const again = await openAdd(page);
  await expect(again.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("");
  await again.getByRole("button", { name: "やめる", exact: true }).click();
  await pickMore(page, "別のフォルダへ動かす");
  await dlgOf(page, "別のフォルダへ動かす").getByRole("button", { name: "やめる", exact: true }).click();
  await expect(more(page)).toBeFocused();
  expect(mk.calls.length).toBe(before);
});

test("K684-UI-023 キーボードだけ：「＋」に焦点して Enter で小窓・題名に焦点・20 回 Tab しても小窓の外へ出ない・「…」に焦点して Enter → ↓ → Enter で選ぶ", async ({
  page,
}) => {
  const mk = await mock(page);
  await openAt(page, P_INVOICE);
  await plus(page, "会社").focus();
  await page.keyboard.press("Enter");
  const dlg = page.locator(DLG);
  await expect(dlg.getByRole("textbox", { name: "題名", exact: true })).toBeFocused();
  for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".k-dialog")))).toBe(true);
  await page.keyboard.press("Escape");
  // 小窓を閉じると焦点を開いた「＋」へ戻し、2 こま続けて乗るまで戻し続ける（use-tree-ops.ts の focusLoop）。
  //   戻り終わる前に「…」へ焦点を置くと「＋」へ引き戻され、Enter が「＋」に当たって足す小窓が開き直す。乗ったのを見てから 3 こま待つ
  await expect(dlg).toHaveCount(0);
  await expect(plus(page, "会社")).toBeFocused();
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      ),
  );
  await more(page).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(dlgOf(page, "前の版を見る")).toBeVisible();
  expect(mk.count("versions")).toBe(1);
});

test("K684-UI-024 幅 320・375・768・1024・1440：「…」を開いた形・5 つの小窓（足す・動かす・消す・前の版）でも横のはみ出し 0（数値）", async ({
  page,
}) => {
  await mock(page);
  await loginAs(page, owner.token);
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
    await page.goto(`/knowledge/${P_INVOICE}`);
    await expect(page.locator(CARD).getByRole("heading", { level: 1 })).toBeVisible();
    await more(page).click();
    expect(await overflowX(page), `幅 ${w}・メニュー`).toBeLessThanOrEqual(0);
    await page.getByRole("menuitem", { name: "別のフォルダへ動かす", exact: true }).click();
    expect(await overflowX(page), `幅 ${w}・動かす`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await pickMore(page, "前の版を見る");
    expect(await overflowX(page), `幅 ${w}・前の版`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await pickMore(page, "消す…");
    expect(await overflowX(page), `幅 ${w}・消す`).toBeLessThanOrEqual(0);
    await page.getByRole("alertdialog").getByRole("button", { name: "やめる", exact: true }).click();
  }
});

test("K684-UI-025 題名・フォルダ名・版の作者名に HTML が入っていても、木・小窓・版の一覧に文字として出て動かない・送る体は打ったとおりの字（削らない）", async ({
  page,
}) => {
  const evil = '<img src=x onerror="window.__xss=1">';
  const mk = await mock(page);
  mk.versions.set(P_INVOICE, [
    {
      version: 1,
      published_at: "2026-10-05T03:00:00Z",
      by_name: evil,
      body: { doc: INVOICE_DOC, text: textOf(INVOICE_DOC) },
    },
  ]);
  await openAt(page, P_INVOICE);
  const dlg = await openAdd(page);
  await choose(page, dlg, "足す物", "フォルダ");
  await dlg.getByRole("textbox", { name: "フォルダの名前", exact: true }).fill(evil);
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(page.locator(TREE).getByText(evil, { exact: true })).toBeVisible();
  expect(mk.calls.find((x) => x.op === "createFolder")!.body["name"]).toBe(evil);
  await pickMore(page, "前の版を見る");
  await expect(dlgOf(page, "前の版を見る").getByRole("combobox", { name: "版", exact: true })).toContainText(evil);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});
