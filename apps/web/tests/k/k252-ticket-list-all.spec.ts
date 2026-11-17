// K-252「チケットの一覧の画面（一覧・グループの一覧・横に詳細）をキャンバスに合わせる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas の List（グループで絞った一覧・検索条件の箱）。一覧の画面の親 K-223 の子（もう 1 本は K-251）。
//   口は網の手前で差し替える（tests/k/list-mock.ts）。列は決めた 7 つ（D-128.15・D-128.25・D-128.26）と「もっと見る」（PM の決め）。
//   キャンバスに在ってまだ使えない物はグレーで押せない（D-145.9）。本当の値が無い数は空（総数は返さない・K-92）。
//   横の詳細（D-128.165・D-128.14）：幅 1024 以上で行を押すと移らずに右に開き、URL は今の問い合わせに open=<番号> を足す。
//     ?open=<番号> を直に開いたときは、一覧の口を q=<番号>・view=all で引いて id を得てから詳細の口で読む。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import {
  CFG,
  SALES,
  WIDTHS,
  compareGroup,
  expectDisabled,
  gate,
  head,
  idOf,
  item,
  items,
  mockList,
  ok,
  open,
  overflowX,
  rowsOf,
  table,
  views,
} from "./list-mock";

const PATHS = ["/tickets?view=all", `/tickets?scope=${SALES}`] as const;
const side = (page: Page) => page.getByRole("complementary", { name: "チケットの詳細" });
const nav = (page: Page) => page.getByRole("navigation", { name: "メニュー", exact: true });
const navWidth = (page: Page) => nav(page).evaluate((e) => Math.round(e.getBoundingClientRect().width));
const withOpen = (path: string, n: string) => `${path}${path.includes("?") ? "&" : "?"}open=${n}`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const path of PATHS) {
  test(`K252-UI-001 ${path} 幅 1440 で行（題名）を押す：一覧の右に詳細が開き URL は元の問い合わせに open=EG-101・列は 7 つ・詳細に帯と h1 は無く h1 は一覧の 1 つ。番号のリンクを押しても移らずに横に開く`, async ({
    page,
  }) => {
    await mockList(page);
    await open(page, path);
    await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
    await expect(page).toHaveURL(new RegExp(`${esc(withOpen(path, "EG-101"))}$`));
    await expect(side(page)).toContainText("チケット 1");
    const t = (await table(page).boundingBox())!;
    const s = (await side(page).boundingBox())!;
    expect(s.x).toBeGreaterThanOrEqual(t.x + t.width - 1);
    await expect(table(page).getByRole("columnheader")).toHaveCount(7);
    await expect(side(page).locator("header.k-page-head")).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
    const num = rowsOf(page).nth(1).getByRole("link", { name: "EG-102" });
    await expect(num).toHaveAttribute("href", `/tickets/${idOf(2)}`);
    await num.click();
    await expect(page).toHaveURL(new RegExp(`${esc(withOpen(path, "EG-102"))}$`));
    await expect(side(page)).toContainText("チケット 2");
  });
}

test("K252-UI-002 幅 1200 で行を押す：詳細は右に幅 400・列は 番号・題名・種別・状態・担当者 の 5 つ・左のメニューは 56px（本人の好み k-shell-nav は書き換えない）。自分に関わるものの画面では右の列を隠す", async ({
  page,
}) => {
  await mockList(page);
  await open(page, "/tickets?view=all", 1200);
  const pref = await page.evaluate(() => window.localStorage.getItem("k-shell-nav"));
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  await expect(side(page)).toBeVisible();
  expect(Math.round((await side(page).boundingBox())!.width)).toBe(400);
  const heads = (await table(page).getByRole("columnheader").allInnerTexts()).map((h) => h.trim());
  expect(heads).toEqual(["番号", "題名", "種別", "状態", "担当者"]);
  await expect.poll(() => navWidth(page)).toBe(56);
  expect(await page.evaluate(() => window.localStorage.getItem("k-shell-nav"))).toBe(pref);
  await open(page, "/tickets", 1200);
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  await expect(side(page)).toBeVisible();
  await expect(page.locator("aside.k-list-side")).toBeHidden();
});

test("K252-UI-003 幅 768 で行を押す：/tickets/<id> に移る", async ({ page }) => {
  await mockList(page);
  await open(page, "/tickets?view=all", 768);
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${idOf(1)}$`));
});

for (const path of PATHS) {
  test(`K252-UI-004 ${path} 題名か番号で絞る欄：続けて打っても口は打ち終わってから 1 回（最後の字で・view=all${path.includes("scope") ? "・scope_id" : ""} つき）・答えの 1 件だけが出る。全角はそのまま口に渡す`, async ({
    page,
  }) => {
    const m = await mockList(page, {
      list: (q) => {
        const word = q.get("q") ?? "";
        return word === ""
          ? ok(items(3), { next_cursor: null })
          : ok(word === "EG-102" || word === "ＥＧ－１０２" ? [item(2)] : [item(9)], { next_cursor: null });
      },
    });
    await open(page, path);
    await expect(rowsOf(page)).toHaveCount(3);
    const box = page.getByRole("textbox", { name: "題名か番号で絞る" });
    let before = m.listCalls.length;
    await box.pressSequentially("EG-102", { delay: 30 });
    await expect(rowsOf(page)).toHaveCount(1);
    await expect(table(page)).toContainText("EG-102");
    const typed = m.listCalls.slice(before);
    expect(typed.map((q) => q.get("q"))).toEqual(["EG-102"]);
    expect(typed.at(-1)?.get("view")).toBe("all");
    if (path.includes("scope")) expect(typed.at(-1)?.get("scope_id")).toBe(SALES);
    await box.fill("");
    await expect(rowsOf(page)).toHaveCount(3);
    expect(m.listCalls.at(-1)?.get("q") ?? null).toBeNull();
    before = m.listCalls.length;
    await box.fill("ＥＧ－１０２");
    await expect(rowsOf(page)).toHaveCount(1);
    expect(m.listCalls.slice(before).map((q) => q.get("q"))).toEqual(["ＥＧ－１０２"]);
  });
}

test("K252-UI-005 グループで絞った一覧（/tickets?scope=<id>）：h1 はグループの名前・補足「（EG）」・口に scope_id と view=all", async ({
  page,
}) => {
  const m = await mockList(page);
  await open(page, `/tickets?scope=${SALES}`);
  await expect(head(page).locator("h1")).toHaveText("営業");
  await expect(head(page)).toContainText("（EG）");
  await expect.poll(() => m.listCalls.at(-1)?.get("scope_id")).toBe(SALES);
  expect(m.listCalls.at(-1)?.get("view")).toBe("all");
});

test("K252-UI-006 一覧・グループの一覧・横の詳細を 320・375・768・1024・1440 で開き、どれも横溢れ 0・見出しの左の端が画面の中", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await mockList(page, { list: (q) => (q.get("cursor") ? ok([item(51)]) : ok(items(50), { next_cursor: "c1" })) });
  const bad: string[] = [];
  for (const w of WIDTHS)
    for (const path of [...PATHS, ...(w >= 1024 ? ["/tickets?view=all&open=EG-101", "/tickets?open=EG-101"] : [])]) {
      await open(page, path, w);
      await expect(rowsOf(page)).toHaveCount(50);
      const o = await overflowX(page);
      if (o !== 0) bad.push(`${path} 幅 ${w}：${o}px`);
      const x = await head(page)
        .first()
        .locator("h1")
        .evaluate((e) => e.getBoundingClientRect().left);
      if (x < 0) bad.push(`${path} 幅 ${w}：見出しの左の端 ${x}`);
    }
  expect(bad).toEqual([]);
});

for (const path of PATHS) {
  test(`K252-UI-007 ${path} 検索条件の箱（キャンバス List）：言葉の欄は使える（題名か番号で絞る）・かんたん・詳しく・検索条件を保存・畳む・状態の札・親子・種別・分類・節目・担当者・AI に任せている はグレーで押せない（D-145.9）`, async ({
    page,
  }) => {
    const m = await mockList(page);
    await open(page, path);
    const box = page.getByRole("region", { name: "検索条件" });
    await expect(box.getByRole("textbox", { name: "題名か番号で絞る" })).toBeEnabled();
    for (const t of ["かんたん", "詳しく", "検索条件を保存", "畳む"])
      await expectDisabled(page, box.locator('[aria-disabled="true"]', { hasText: t }).first(), t);
    for (const t of ["状態", "親子", "種別", "分類", "節目", "担当者", "AI に任せている"]) {
      const it = box.locator('[aria-disabled="true"]', { hasText: t }).first();
      await expectDisabled(page, it, t);
    }
    expect(m.otherCalls.filter((c) => !c.startsWith("GET "))).toEqual([]);
  });

  test(`K252-UI-008 ${path} 表の上の道具：まとめて操作・CSV で取り込む・表示設定（列）と行を選ぶ印はグレーで押せない・件数の札は 1 つで空（総数を返さない）・選ぶ印の列の頭は見出しに数えない`, async ({
    page,
  }) => {
    await mockList(page);
    await open(page, path);
    const tools = page.locator('[aria-label="一覧の道具"]');
    for (const t of ["まとめて操作", "CSV で取り込む", "表示設定（列）"])
      await expectDisabled(page, tools.locator('[aria-disabled="true"]', { hasText: t }).first(), t);
    await expect(tools.locator("[data-value]")).toHaveCount(1);
    expect((await tools.locator("[data-value]").innerText()).trim()).toBe("");
    await expect(table(page).getByRole("columnheader")).toHaveCount(7);
    const picks = table(page).getByRole("checkbox");
    expect(await picks.count()).toBeGreaterThan(0);
    for (const c of await picks.all()) {
      await expect(c).toBeDisabled();
      await expect(c).not.toBeChecked();
    }
  });
}

test("K252-UI-009 幅 375・1440：本文の押せるもの（行のリンク・もっと見る・言葉の欄）は 24px 以上", async ({ page }) => {
  await mockList(page, { list: () => ok(items(50), { next_cursor: "c1" }) });
  for (const w of [375, 1440]) {
    await open(page, "/tickets?view=all", w);
    await expect(rowsOf(page)).toHaveCount(50);
    const small = await page.$$eval(
      "#k-main a[href], #k-main button:not([disabled]), #k-main input:not([type=checkbox])",
      (els) =>
        els
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
          })
          .map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim()),
    );
    expect(small, `幅 ${w}`).toEqual([]);
  }
});

{
  const g = CFG.groups.find((x) => x.id === "tickets-list");
  for (const w of g?.widths ?? [1440]) {
    test(`K252-UI-010 tickets-list（${g?.canvas ?? "?"}）幅 ${w}：組が enrolled・持ち主 K-252・道は開ける形（{…} を含まない）・鍵が在り、組の値と読み込んだ書体がキャンバスと同じ`, async ({
      browser,
    }) => {
      expect(g?.app ?? "").not.toMatch(/[{}]/);
      await compareGroup(browser, g, "K-252", w);
    });
  }
}

test("K252-UI-011 ?open=<番号> を直に開く：1440 は一覧の口を q=<番号>・view=all で引き、詳細が右に出る。一覧に無い番号は右に「見つかりませんでした」。幅 768 は /tickets/<id> に移る", async ({
  page,
}) => {
  const m = await mockList(page, {
    list: (q) => {
      const word = q.get("q") ?? "";
      if (word === "EG-101") return ok([item(1)], { next_cursor: null });
      if (word === "EG-999") return ok([], { next_cursor: null });
      return ok(items(3), { next_cursor: null });
    },
  });
  await open(page, "/tickets?view=all&open=EG-101");
  await expect(side(page)).toContainText("チケット 1");
  expect(m.listCalls.some((q) => q.get("q") === "EG-101" && q.get("view") === "all")).toBe(true);
  await open(page, "/tickets?view=all&open=EG-999");
  await expect(side(page)).toContainText("見つかりませんでした");
  await expect(rowsOf(page)).toHaveCount(3);
  await open(page, "/tickets?view=all&open=EG-101", 768);
  await expect(page).toHaveURL(new RegExp(`/tickets/${idOf(1)}$`));
});

for (const [w, mode] of [
  [1023, "move"],
  [1024, "side5"],
  [1279, "side5"],
  [1280, "side7"],
] as const) {
  test(`K252-UI-012 幅の境 ${w}：${mode === "move" ? "行を押すと移る" : mode === "side5" ? "横に開き列 5・左のメニュー 56" : "横に開き列 7・左のメニューは畳まない"}`, async ({
    page,
  }) => {
    await mockList(page);
    await open(page, "/tickets?view=all", w);
    const wide = await navWidth(page);
    await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
    if (mode === "move") {
      await expect(page).toHaveURL(new RegExp(`/tickets/${idOf(1)}$`));
      return;
    }
    await expect(side(page)).toBeVisible();
    await expect(table(page).getByRole("columnheader")).toHaveCount(mode === "side5" ? 5 : 7);
    if (mode === "side5") await expect.poll(() => navWidth(page)).toBe(56);
    else expect(await navWidth(page)).toBe(wide);
  });
}

test("K252-UI-013 詳細を開いた後にブラウザの戻る・見え方のタブで移る：open が外れて詳細が閉じ、左のメニューの幅が元に戻る", async ({
  page,
}) => {
  await mockList(page);
  await open(page, "/tickets?view=all", 1200);
  const wide = await navWidth(page);
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  await expect.poll(() => navWidth(page)).toBe(56);
  await page.goBack();
  await expect(page).toHaveURL(/\/tickets\?view=all$/);
  await expect(side(page)).toHaveCount(0);
  await expect.poll(() => navWidth(page)).toBe(wide);
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  await expect(side(page)).toBeVisible();
  await views(page).getByRole("link", { name: "自分に関わるもの" }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(side(page)).toHaveCount(0);
  await expect.poll(() => navWidth(page)).toBe(wide);
});

test("K252-UI-014 言葉の欄：当たり 0 件は「条件に合うチケットはありません」（はじめにやることは出さない）・101 字目は入らない・先に打った分の遅い答えは描かない", async ({
  page,
}) => {
  const slow = gate();
  const m = await mockList(page, {
    list: async (q) => {
      const word = q.get("q") ?? "";
      if (word === "請求") {
        await slow.wait;
        return ok([item(5, { title: "請求の古い答え" })], { next_cursor: null });
      }
      if (word === "請求書") return ok([item(6, { title: "請求書を送る" })], { next_cursor: null });
      if (word === "無い言葉") return ok([], { next_cursor: null });
      return ok(items(3), { next_cursor: null });
    },
  });
  await open(page, "/tickets?view=all");
  const box = page.getByRole("textbox", { name: "題名か番号で絞る" });
  await box.fill("無い言葉");
  await expect(page.getByText("条件に合うチケットはありません")).toBeVisible();
  await expect(page.getByText("まだチケットはありません")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "はじめにやること" })).toHaveCount(0);
  await box.fill("あ".repeat(101));
  expect([...(await box.inputValue())].length).toBe(100);
  await box.fill("請求");
  await expect.poll(() => m.listCalls.some((q) => q.get("q") === "請求")).toBe(true);
  await box.fill("請求書");
  await expect(table(page)).toContainText("請求書を送る");
  slow.open();
  await expect(table(page)).not.toContainText("請求の古い答え");
  await expect(table(page)).toContainText("請求書を送る");
});

test("K252-UI-015 開けないグループ（見えない・無い・uuid でない）を /tickets?scope= で開く：h1 は「チケット」・本文に「見つかりませんでした」・一覧の表は出さない", async ({
  page,
}) => {
  await mockList(page, { list: () => ({ status: 422, body: { error: "validation", code: "VALIDATION_ERROR" } }) });
  for (const scope of ["00000000-0000-4000-8000-000000000999", "abc"]) {
    await open(page, `/tickets?scope=${scope}`);
    await expect(head(page).first().locator("h1")).toHaveText("チケット");
    await expect(page.locator("#k-main")).toContainText("見つかりませんでした");
    await expect(table(page)).toHaveCount(0);
  }
});

test('K252-UI-016 横の詳細（詳細の部品 layout="side"）には、詳細の頁の右のパネル（チケットのパネル・パネルのタブ・パネルを開く／閉じるボタン）を出さない。題名は h2 で、h1 は一覧の 1 つ（詳細の本文 K-226 の形の上に足す・2026-11-16 の PM の決め）', async ({
  page,
}) => {
  await mockList(page);
  await open(page, PATHS[0]);
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  await expect(side(page)).toContainText("チケット 1");
  await expect(side(page).getByRole("complementary", { name: "チケットのパネル" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "チケットのパネル" })).toHaveCount(0);
  await expect(side(page).getByRole("navigation", { name: "パネルのタブ" })).toHaveCount(0);
  // パネルを閉じた形（「パネルを開く」で 400px の中にパネルが開ける）でも作らない
  await expect(side(page).getByRole("button", { name: "パネルを開く" })).toHaveCount(0);
  await expect(side(page).getByRole("button", { name: "パネルを閉じる" })).toHaveCount(0);
  await expect(side(page).getByRole("heading", { level: 2, name: "チケット 1" })).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
});
