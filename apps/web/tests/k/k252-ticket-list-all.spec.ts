// K-252「チケットの一覧の画面（一覧・グループの一覧・横に詳細）をキャンバスに合わせる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas の List（グループで絞った一覧・検索条件の箱）。一覧の画面の親 K-223 の子（もう 1 本は K-251）。
//   口は網の手前で差し替える（tests/k/list-mock.ts）。列はキャンバスどおり 9 列で表示設定で選べる（一覧の共通の部品・代表の答え answer=afc3b0f2fdb4・D-128.15 を置き換えた）と「もっと見る」（PM の決め）。
//   一覧（全部）は期限の区切りの見出しを出さない。
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
const COLUMNS = ["種別", "番号", "題名", "状態", "担当者", "グループ", "期限", "予定・実績", "更新"];
const headsOf = async (page: Page) =>
  (await table(page).getByRole("columnheader").allInnerTexts()).map((h) => h.trim());
/** 見出しの列（待つ形で比べる：toHaveText） */
const heads = (page: Page) => table(page).getByRole("columnheader");
const COLUMNS_KEY = "kaname.ticket-list.columns";

for (const path of PATHS) {
  test(`K252-UI-001 ${path} 幅 1440 で行（題名）を押す：一覧の右に詳細が開き URL は元の問い合わせに open=EG-101・列は 9 つのまま・詳細に帯と h1 は無く h1 は一覧の 1 つ。番号のリンクを押しても移らずに横に開く`, async ({
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
    expect(await headsOf(page)).toEqual(COLUMNS);
    await expect(side(page).locator("header.k-page-head")).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
    const num = rowsOf(page).nth(1).getByRole("link", { name: "EG-102" });
    await expect(num).toHaveAttribute("href", `/tickets/${idOf(2)}`);
    await num.click();
    await expect(page).toHaveURL(new RegExp(`${esc(withOpen(path, "EG-102"))}$`));
    await expect(side(page)).toContainText("チケット 2");
  });
}

test("K252-UI-002 幅 1200 で行を押す：詳細は右に幅 400・列は 種別・番号・題名・状態・担当者 の 5 つ（9 列と同じ並び）・左のメニューは 56px（本人の好み k-shell-nav は書き換えない）。自分に関わるものの画面では右の列を隠す", async ({
  page,
}) => {
  await mockList(page);
  await open(page, "/tickets?view=all", 1200);
  const pref = await page.evaluate(() => window.localStorage.getItem("k-shell-nav"));
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  await expect(side(page)).toBeVisible();
  expect(Math.round((await side(page).boundingBox())!.width)).toBe(400);
  expect(await headsOf(page)).toEqual(["種別", "番号", "題名", "状態", "担当者"]);
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
  test(`K252-UI-007 ${path} 検索条件の箱（キャンバス List）：言葉の欄・かんたん・詳しく・状態の札・親子・種別・担当者・AI に任せている は使える（K-478）・畳む・分類・節目はグレーで押せない（D-145.9）。検索条件を保存は K-479 の試験が見る`, async ({
    page,
  }) => {
    const m = await mockList(page);
    await open(page, path);
    const box = page.getByRole("region", { name: "検索条件" });
    await expect(box.getByRole("textbox", { name: "題名か番号で絞る" })).toBeEnabled();
    for (const t of ["かんたん", "詳しく"])
      await expect(box.getByRole("button", { name: t, exact: true }), t).not.toHaveAttribute("aria-disabled", "true");
    await expect(box.getByRole("group", { name: "状態", exact: true })).toBeVisible();
    await expect(box.getByRole("group", { name: "親子", exact: true })).toBeVisible();
    for (const t of ["種別", "担当者", "AI に任せている"])
      await expect(box.getByRole("combobox", { name: t, exact: true }), t).toBeEnabled();
    for (const t of ["畳む", "分類", "節目"]) {
      const it = box.locator('[aria-disabled="true"]', { hasText: t }).first();
      await expectDisabled(page, it, t);
    }
    expect(m.otherCalls.filter((c) => !c.startsWith("GET "))).toEqual([]);
  });

  test(`K252-UI-008 ${path} 表の上の道具：まとめて操作・CSV で取り込むと行を選ぶ印はグレーで押せない・表示設定は押せる・件数の札は 1 つで空（総数を返さない）・見出しは 9 列で選ぶ印の列の頭は数えない・期限の区切りの見出しは無い`, async ({
    page,
  }) => {
    await mockList(page);
    await open(page, path);
    const tools = page.locator('[aria-label="一覧の道具"]');
    for (const t of ["まとめて操作", "CSV で取り込む"])
      await expectDisabled(page, tools.locator('[aria-disabled="true"]', { hasText: t }).first(), t);
    await expect(tools.getByRole("button", { name: "表示設定" })).toBeEnabled();
    await expect(tools.locator('[aria-disabled="true"]', { hasText: "表示設定" })).toHaveCount(0);
    await expect(rowsOf(page)).toHaveCount(3);
    await expect(tools.locator("[data-value]")).toHaveCount(1);
    expect((await tools.locator("[data-value]").innerText()).trim()).toBe("");
    await expect(heads(page)).toHaveText(COLUMNS);
    await expect(table(page).locator("tr.k-list-section")).toHaveCount(0);
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
  [1280, "side9"],
] as const) {
  test(`K252-UI-012 幅の境 ${w}：${mode === "move" ? "行を押すと移る" : mode === "side5" ? "横に開き列 5・左のメニュー 56" : "横に開き列 9・左のメニューは畳まない"}`, async ({
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
    await expect(table(page).getByRole("columnheader")).toHaveCount(mode === "side5" ? 5 : 9);
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

for (const path of PATHS) {
  test(`K252-UI-017 ${path} 表示設定（一覧の道具の中）：番号と題名は外せない。期限と更新を外すと表から消え（見出し 7）、このブラウザに覚え（自分に関わるものと同じ鍵）開き直しても外したまま。はじめに戻すで 9 列。口は呼ばない（answer=afc3b0f2fdb4）`, async ({
    page,
  }) => {
    const m = await mockList(page);
    await open(page, path);
    await expect(rowsOf(page)).toHaveCount(3);
    const tools = page.locator('[aria-label="一覧の道具"]');
    await tools.getByRole("button", { name: "表示設定" }).click();
    const cols = page.getByRole("dialog", { name: "一覧の見え方" }).getByRole("group", { name: "表に出す列" });
    for (const name of ["番号", "題名"])
      await expect(cols.getByRole("checkbox", { name, exact: true }), name).toBeDisabled();
    await cols.getByRole("checkbox", { name: "期限", exact: true }).uncheck();
    await cols.getByRole("checkbox", { name: "更新", exact: true }).uncheck();
    const left = COLUMNS.filter((c) => c !== "期限" && c !== "更新");
    await expect(heads(page)).toHaveText(left);
    await expect(rowsOf(page).first().locator("td")).toHaveCount(left.length + 1); // 頭の選ぶ印の td を足す
    const stored = await page.evaluate((k) => window.localStorage.getItem(k), COLUMNS_KEY);
    expect(JSON.parse(stored ?? "null")).toEqual(["kind", "number", "title", "stage", "assignee", "scope", "estimate"]);
    await open(page, path);
    await expect(rowsOf(page)).toHaveCount(3);
    await expect(heads(page)).toHaveText(left);
    await open(page, "/tickets");
    await expect(rowsOf(page)).toHaveCount(3);
    await expect(heads(page)).toHaveText(left);
    await open(page, path);
    await expect(rowsOf(page)).toHaveCount(3);
    await tools.getByRole("button", { name: "表示設定" }).click();
    await page.getByRole("dialog", { name: "一覧の見え方" }).getByRole("button", { name: "はじめに戻す" }).click();
    await expect(heads(page)).toHaveText(COLUMNS);
    expect(m.otherCalls.filter((c) => !c.startsWith("GET "))).toEqual([]);
  });

  for (const w of [320, 375] as const)
    test(`K252-UI-017 ${path} 幅 ${w}：一覧の道具の表示設定の箱を開いても横溢れ 0・箱の左右の端が画面の中`, async ({
      page,
    }) => {
      await mockList(page);
      await open(page, path, w);
      await expect(rowsOf(page)).toHaveCount(3);
      await page.locator('[aria-label="一覧の道具"]').getByRole("button", { name: "表示設定" }).click();
      const box = page.getByRole("dialog", { name: "一覧の見え方" });
      await expect(box).toBeVisible();
      expect(await overflowX(page)).toBe(0);
      const b = (await box.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(w);
    });
}

test("K252-UI-018 表示設定 × 横に開いた間（幅 1200）：種別を外してあれば列は 番号・題名・状態・担当者 の 4 つ。詳細を閉じる（戻る）と選んだ 8 列に戻る", async ({
  page,
}) => {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [
    COLUMNS_KEY,
    JSON.stringify(["number", "title", "stage", "assignee", "scope", "due", "estimate", "updated"]),
  ] as const);
  await mockList(page);
  await open(page, "/tickets?view=all", 1200);
  const chosen = COLUMNS.filter((c) => c !== "種別");
  await expect(heads(page)).toHaveText(chosen);
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  await expect(side(page)).toBeVisible();
  await expect(heads(page)).toHaveText(["番号", "題名", "状態", "担当者"]);
  await page.goBack();
  await expect(side(page)).toHaveCount(0);
  await expect(heads(page)).toHaveText(chosen);
});

test("K252-UI-019 横の詳細でも口を呼ぶ前に id を確かめる：一覧の口が uuid でない id を返した行を幅 1440 で押すと、右に「見つかりませんでした」（見出しは h2・h1 は一覧の 1 つ）で、詳細の口は呼ばない（D-129.42）", async ({
  page,
}) => {
  const m = await mockList(page, { list: () => ok([item(1, { id: "not-a-uuid" })], { next_cursor: null }) });
  await open(page, "/tickets?view=all");
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  await expect(side(page).getByRole("heading", { level: 2, name: /見つかりませんでした/ })).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  expect(m.otherCalls.filter((c) => c.includes("/api/v1/tickets/"))).toEqual([]);
});

test("K252-UI-020 言葉を替えた直後の「もっと見る」：読み直している間は押せず口も呼ばない。先に押した「もっと見る」の答えが言葉を替えた後に届いても、新しい一覧に混ぜない", async ({
  page,
}) => {
  const more = gate();
  const word = gate();
  const m = await mockList(page, {
    list: async (q) => {
      if (q.get("cursor")) {
        await more.wait;
        return ok([item(51, { title: "古い言葉の続き" })], { next_cursor: null });
      }
      if (q.get("q") === "請求") {
        await word.wait;
        return ok([item(6, { title: "請求書を送る" })], { next_cursor: "c2" });
      }
      if (q.get("q") === "見積") return ok([item(7, { title: "見積を出す" })], { next_cursor: null });
      return ok(items(50), { next_cursor: "c1" });
    },
  });
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(50);
  const box = page.getByRole("textbox", { name: "題名か番号で絞る" });
  // 1) 読み直している間は「もっと見る」を受けない
  await box.fill("請求");
  await expect.poll(() => m.listCalls.some((q) => q.get("q") === "請求")).toBe(true);
  const moreBtn = page.getByRole("button", { name: "もっと見る" });
  await expect(moreBtn).toHaveCount(0);
  expect(m.listCalls.filter((q) => q.get("cursor"))).toEqual([]);
  word.open();
  await expect(rowsOf(page)).toHaveCount(1);
  await expect(table(page)).toContainText("請求書を送る");
  // 2) 先に押した「もっと見る」の遅い答えは、言葉を替えた後の一覧に混ぜない
  await moreBtn.click();
  await expect.poll(() => m.listCalls.filter((q) => q.get("cursor")).length).toBe(1);
  await box.fill("見積");
  await expect(table(page)).toContainText("見積を出す");
  const late = page.waitForResponse((r) => r.url().includes("cursor="));
  more.open();
  await late;
  // 遅い答えを受けた後の描画を 2 コマ待ってから見る
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await expect(rowsOf(page)).toHaveCount(1);
  await expect(table(page)).not.toContainText("古い言葉の続き");
});

test("K252-UI-021 言葉で絞った読み直しの口が失敗：正本のエラーの 1 件を出し、言葉の欄は打った字のまま残る。「もう一度」で同じ言葉（q）で読み直して行が出る", async ({
  page,
}) => {
  let fail = true;
  const m = await mockList(page, {
    list: (q) => {
      if (q.get("q") === "請求" && fail) return { status: 500, body: { error: "server_error", code: "INTERNAL" } };
      if (q.get("q") === "請求") return ok([item(6, { title: "請求書を送る" })], { next_cursor: null });
      return ok(items(3), { next_cursor: null });
    },
  });
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  const box = page.getByRole("textbox", { name: "題名か番号で絞る" });
  await box.fill("請求");
  await expect(page.getByText("読み込めませんでした")).toBeVisible();
  await expect(box).toHaveValue("請求");
  fail = false;
  await page.getByRole("button", { name: "もう一度" }).click();
  await expect(table(page)).toContainText("請求書を送る");
  await expect(box).toHaveValue("請求");
  expect(m.listCalls.at(-1)?.get("q")).toBe("請求");
});

test("K252-UI-022 グループの一覧でグループの口が失敗：「見つかりませんでした」ではなく読み込みの失敗（読み込めませんでした・もう一度）。「もう一度」でグループを読み直し、読めたら h1 はグループの名前で一覧が出る", async ({
  page,
}) => {
  const m = await mockList(page, { scopesStatus: 500 });
  await open(page, `/tickets?scope=${SALES}`);
  const main = page.locator("#k-main");
  await expect(main).toContainText("読み込めませんでした");
  await expect(main).not.toContainText("見つかりませんでした");
  await expect(table(page)).toHaveCount(0);
  m.scopesStatus = 200;
  await main.getByRole("button", { name: "もう一度" }).click();
  await expect(head(page).locator("h1")).toHaveText("営業");
  await expect(rowsOf(page)).toHaveCount(3);
});
