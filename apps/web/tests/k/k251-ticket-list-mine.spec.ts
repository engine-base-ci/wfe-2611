// K-251「チケットの一覧の画面（はじめて・自分に関わるもの）をキャンバスに合わせる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas の OnHome（はじめて・0 件）と Main（自分に関わるもの）。一覧の画面の親 K-223 の子（もう 1 本はグループの一覧と横の詳細 K-252）。
//   口は網の手前で差し替える（tests/k/list-mock.ts）。期待は決める人の答え（D-145.1〜.4・D-145.9〜.13）と PM の決め（ひな形の行は字を出し値は空）。
//   押せない物は：aria-disabled・リンクでない・グレー（不透明度 0.55）・押しても Enter でも移らず口を呼ばない。本当の値が無い数・字は空。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator } from "@playwright/test";
import {
  CFG,
  DISABLED_OPACITY,
  TASKS,
  WIDTHS,
  compareGroup,
  css,
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

/** 一覧の列（キャンバス Main・代表の答え answer=afc3b0f2fdb4。D-128.15 の 7 列を置き換えた） */
const COLUMNS = ["種別", "番号", "題名", "状態", "担当者", "グループ", "期限", "予定・実績", "更新"];

test("K251-UI-001 帯：白い帯の中に h1「チケット」18px・700 と「すべてのグループ」。帯に「＋ チケットを作る」は無い（主は 1 つ）", async ({
  page,
}) => {
  await mockList(page);
  await open(page);
  const h1 = head(page).locator("h1");
  await expect(h1).toHaveText("チケット");
  expect(await css(page, "header.k-page-head h1", "font-size")).toBe("18px");
  expect(await css(page, "header.k-page-head h1", "font-weight")).toBe("700");
  expect(await css(page, "header.k-page-head", "background-color")).toBe("rgb(255, 255, 255)");
  await expect(head(page)).toContainText("すべてのグループ");
  await expect(head(page).getByRole("button", { name: /チケットを作る/ })).toHaveCount(0);
});

test("K251-UI-002 見え方のタブ：自分に関わるもの（今いる）・概要・一覧・カレンダー・ガントの順。概要・カレンダー・ガントは押せない（title に準備中）", async ({
  page,
}) => {
  await mockList(page);
  await open(page);
  const names = await views(page)
    .locator(":scope > *")
    .evaluateAll((els) => els.map((e) => e.textContent?.trim()));
  expect(names).toEqual(["自分に関わるもの", "概要", "一覧", "カレンダー", "ガント"]);
  await expect(views(page).getByRole("link", { name: "自分に関わるもの" })).toHaveAttribute("aria-current", "page");
  for (const name of ["概要", "カレンダー", "ガント"]) {
    await expect(views(page).getByRole("link", { name }), name).toHaveCount(0);
    const it = views(page).locator('[aria-disabled="true"]', { hasText: name });
    await expect(it, name).toHaveCount(1);
    expect(await it.getAttribute("title"), name).toContain("準備中");
    expect(Number(await it.evaluate((e) => getComputedStyle(e).opacity)), name).toBeCloseTo(DISABLED_OPACITY, 3);
    const before = page.url();
    await it.click({ force: true });
    expect(page.url(), name).toBe(before);
  }
});

test("K251-UI-003 「一覧」を押すと口に view=all・URL が ?view=all・一覧が今いるタブ。再読み込みしても一覧のまま", async ({
  page,
}) => {
  const m = await mockList(page);
  await open(page);
  await views(page).getByRole("link", { name: "一覧" }).click();
  await expect(page).toHaveURL(/\/tickets\?view=all$/);
  await expect(views(page).getByRole("link", { name: "一覧" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => m.listCalls.at(-1)?.get("view")).toBe("all");
  await page.reload();
  await expect(views(page).getByRole("link", { name: "一覧" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => m.listCalls.at(-1)?.get("view")).toBe("all");
});

test("K251-UI-004 タブを素早く切り替える：遅れて届いた前のタブの答えで上書きしない", async ({ page }) => {
  const slow = gate();
  await mockList(page, {
    list: async (q) => {
      if ((q.get("view") ?? "mine") === "mine") {
        await slow.wait;
        return ok([item(1, { title: "自分の分" })], { next_cursor: null });
      }
      return ok([item(2, { title: "全部の分" })], { next_cursor: null });
    },
  });
  await open(page);
  await views(page).getByRole("link", { name: "一覧" }).click();
  await expect(rowsOf(page)).toHaveCount(1);
  await expect(table(page)).toContainText("全部の分");
  // 前の問い合わせを取り消す作り（届かない）でも、答える作り（届くが描かない）でも待てるよう、終わり方のどちらかを待つ
  const isMine = (r: { url(): string }) => r.url().includes("/api/v1/tickets") && !r.url().includes("view=all");
  const late = Promise.race([page.waitForEvent("requestfinished", isMine), page.waitForEvent("requestfailed", isMine)]);
  slow.open();
  await late;
  await expect(table(page)).toContainText("全部の分");
  await expect(table(page)).not.toContainText("自分の分");
});

test("K251-UI-005 表：列の見出しは キャンバス Main どおり 種別・番号・題名・状態・担当者・グループ・期限・予定・実績・更新 の 9 つ。行は口の答えの並び・番号はリンク・グループと予定・実績は空（answer=afc3b0f2fdb4）", async ({
  page,
}) => {
  await mockList(page, { list: () => ok([item(3), item(1), item(2)], { next_cursor: null }) });
  await open(page);
  await expect(rowsOf(page)).toHaveCount(3); // 表は口の答えが届いてから描く（読む前に待つ）
  const heads = await table(page).getByRole("columnheader").allInnerTexts();
  expect(heads.map((h) => h.trim())).toEqual(COLUMNS);
  const at = (name: string) => COLUMNS.indexOf(name) + 1;
  const numbers = await rowsOf(page)
    .locator(`td:nth-child(${at("番号")})`)
    .allInnerTexts();
  expect(numbers.map((x) => x.trim())).toEqual(["EG-103", "EG-101", "EG-102"]);
  // グループと予定・実績は一覧の口に値が無いので空（D-144.3）
  for (const name of ["グループ", "予定・実績"])
    for (const v of await rowsOf(page)
      .locator(`td:nth-child(${at(name)})`)
      .allInnerTexts())
      expect(v.trim(), name).toBe("");
  await expect(rowsOf(page).first().getByRole("link", { name: "EG-103" })).toHaveAttribute(
    "href",
    `/tickets/${idOf(3)}`,
  );
});

test("K251-UI-006 期限切れの行だけに炎の印（読み上げ「期限切れ」）", async ({ page }) => {
  await mockList(page, {
    list: () => ok([item(1, { overdue: true, due_on: "2026-11-01" }), item(2)], { next_cursor: null }),
  });
  await open(page);
  await expect(rowsOf(page).nth(0).getByLabel("期限切れ")).toHaveCount(1);
  await expect(rowsOf(page).nth(1).getByLabel("期限切れ")).toHaveCount(0);
});

test("K251-UI-007 AI に任せている行：担当者の列は名前「高本」とその横の「AI」の札（ロボットの絵・読み上げ「AI に任せている」）。「高本のAI」とは書かない（D-128.26）", async ({
  page,
}) => {
  await mockList(page, {
    list: () => ok([item(1, { delegated_to_clone: true }), item(2)], { next_cursor: null }),
  });
  await open(page);
  const cell = rowsOf(page).first().locator("td").nth(4);
  await expect(cell).toContainText("高本");
  await expect(cell).not.toContainText("高本のAI");
  const tag = cell.getByLabel("AI に任せている");
  await expect(tag).toHaveCount(1);
  await expect(tag).toContainText("AI");
  await expect(tag.locator("svg")).toHaveCount(1);
  await expect(rowsOf(page).nth(1).locator("td").nth(4).getByLabel("AI に任せている")).toHaveCount(0);
});

test("K251-UI-008 もっと見る：50 件 → 押すと 51 件・次が無ければ消える。2 回押しても口は 1 回", async ({ page }) => {
  const m = await mockList(page, {
    list: (q) => (q.get("cursor") ? ok([item(51)], { next_cursor: null }) : ok(items(50), { next_cursor: "c1" })),
  });
  await open(page);
  await expect(rowsOf(page)).toHaveCount(50);
  const more = page.getByRole("button", { name: "もっと見る" });
  await more.dblclick();
  await expect(rowsOf(page)).toHaveCount(51);
  await expect(more).toHaveCount(0);
  expect(m.listCalls.filter((q) => q.get("cursor") === "c1")).toHaveLength(1);
});

test("K251-UI-009 もっと見るが失敗：読んだ 50 件は残り「もう一度」。押すと次の分が足される", async ({ page }) => {
  let fail = true;
  await mockList(page, {
    list: (q) => {
      if (!q.get("cursor")) return ok(items(50), { next_cursor: "c1" });
      if (fail) return { status: 500, body: { error: "server_error", code: "INTERNAL" } };
      return ok([item(51)], { next_cursor: null });
    },
  });
  await open(page);
  await page.getByRole("button", { name: "もっと見る" }).click();
  const again = page.getByRole("button", { name: "もう一度" });
  await expect(again).toBeVisible();
  await expect(rowsOf(page)).toHaveCount(50);
  fail = false;
  await again.click();
  await expect(rowsOf(page)).toHaveCount(51);
});

test("K251-UI-010 0 件・書ける人（はじめて）：あいさつは名前だけ・点線の箱の真ん中に「まだチケットはありません」・主「＋ チケットを作る」1 つ（押すと作る面）・従「分身と話して作る」と 3 つの提案も在る", async ({
  page,
}) => {
  await mockList(page, { list: () => ok([], { next_cursor: null }) });
  await open(page);
  await expect(page.getByText("ようこそ、高本さん")).toBeVisible();
  await expect(page.getByText("ワークスペースができました")).toHaveCount(0); // 会社の名前を出さない（D-145.4）
  const empty = page.locator('[data-state="empty"]');
  await expect(empty.getByRole("heading", { name: "まだチケットはありません" })).toBeVisible();
  expect(await css(page, '[data-state="empty"]', "border-top-style")).toBe("dashed");
  const create = empty.getByRole("button", { name: "＋ チケットを作る" });
  await expect(create).toHaveCount(1);
  await expect(empty.getByText("分身と話して作る")).toHaveCount(1);
  for (const t of ["今月の請求書を送る", "問い合わせに返す", "見積を作る"])
    await expect(empty.getByText(t), t).toHaveCount(1);
  await expect(page.locator("main").getByRole("button", { name: "＋ チケットを作る" })).toHaveCount(1);
  await create.click();
  await expect(page).toHaveURL(/\/tickets\?new=1$/);
});

test("K251-UI-011 0 件・閲覧のみの人：空の箱に作るボタンが無い", async ({ page }) => {
  await mockList(page, { writable: [], list: () => ok([], { next_cursor: null }) });
  await open(page);
  const empty = page.locator('[data-state="empty"]');
  await expect(empty.getByRole("heading", { name: "まだチケットはありません" })).toBeVisible();
  await expect(empty.getByRole("button")).toHaveCount(0);
});

for (const [status, msg] of [
  [500, "読み込めませんでした"],
  [501, "読み込めませんでした"],
  [503, "メンテナンス"],
  [0, "読み込めませんでした"],
] as const) {
  test(`K251-UI-012 一覧の口が ${status === 0 ? "届かない" : status}：正本の文（${msg}）ともう一度。「まだチケットはありません」は出ない（D-142.2・共通の errorCodeOf）`, async ({
    page,
  }) => {
    let fail = true;
    const body =
      status === 501
        ? { error: "not_implemented", code: "NOT_IMPLEMENTED" }
        : status === 503
          ? { error: "unavailable", code: "UNAVAILABLE" }
          : { error: "server_error", code: "INTERNAL" };
    await mockList(page, {
      list: () => (fail ? { status, body } : ok(items(2), { next_cursor: null })),
    });
    if (status === 0)
      await page.route(/\/api\/v1\/tickets(\?|$)/, (route) => (fail ? route.abort() : route.fallback()));
    await open(page);
    await expect(page.getByText(msg).first()).toBeVisible();
    await expect(page.getByText("まだチケットはありません")).toHaveCount(0);
    if (status === 503) {
      // メンテナンス（E-PAGE-004）の一手は「いまの様子を見る」だけで、「もう一度」は出さない
      await expect(page.getByRole("button", { name: "もう一度" })).toHaveCount(0);
      return;
    }
    fail = false;
    await page.getByRole("button", { name: "もう一度" }).click();
    await expect(rowsOf(page)).toHaveCount(2);
  });
}

test("K251-UI-013 読み込み中：帯とタブはすぐ出て、文言は 3 秒たっても終わらないときだけ（D-144.8）", async ({
  page,
}) => {
  const slow = gate();
  // 時計を止めてから開く（実時間で流れると、遅い台では 3 秒の境目の前に時間が進んで揺れる）。時間は runFor だけで進める
  await page.clock.install({ time: new Date("2026-11-04T08:00:00+09:00") });
  await page.clock.pauseAt(new Date("2026-11-04T08:00:01+09:00"));
  await mockList(page, {
    list: async () => {
      await slow.wait;
      return ok(items(1), { next_cursor: null });
    },
  });
  await open(page);
  await expect(head(page).locator("h1")).toHaveText("チケット");
  await expect(views(page)).toBeVisible();
  await expect(page.locator('[data-state="loading"]')).toHaveCount(1); // 読み込み中の印が付いてから時間を進める
  await page.clock.runFor(2900);
  await expect(page.getByText("読み込んでいます")).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(page.getByText("読み込んでいます…")).toBeVisible();
  slow.open();
  await expect(rowsOf(page)).toHaveCount(1);
});

test("K251-UI-014 ログインしていない：/tickets を開くと /login?next=%2Ftickets に移る", async ({ page }) => {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHENTICATED" }) }),
  );
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login\?next=%2Ftickets$/);
});

test("K251-UI-015 もっと見るでログインが切れた（401）：共通の決まりどおり入り直しの画面 /login?next=%2Ftickets に移る（D-086.4）", async ({
  page,
}) => {
  await mockList(page, {
    list: (q) =>
      q.get("cursor")
        ? { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } }
        : ok(items(50), { next_cursor: "c1" }),
  });
  await open(page);
  await expect(rowsOf(page)).toHaveCount(50);
  await page.getByRole("button", { name: "もっと見る" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Ftickets$/);
});

test("K251-UI-016 題名に HTML とスクリプト：文字として出し、要素は増えない", async ({ page }) => {
  const evil = '<img src=x onerror="window.__k223=1"><b>太字</b>';
  await mockList(page, { list: () => ok([item(1, { title: evil })], { next_cursor: null }) });
  await open(page);
  await expect(table(page)).toContainText(evil);
  await expect(table(page).locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __k223?: number }).__k223)).toBeUndefined();
});

test("K251-UI-017 作った後に画面の中を移って一覧へ戻ると、読み直して作った 1 件が出る（読み込み直しをしない）", async ({
  page,
}) => {
  let made = false;
  await mockList(page, {
    list: () => ok(made ? [item(7, { title: "作った 1 件" })] : [], { next_cursor: null }),
  });
  await open(page);
  await expect(page.getByText("まだチケットはありません")).toBeVisible();
  made = true;
  // 画面の中で別の画面へ移り、左のメニューの「チケット」で戻る（問い合わせの置き場は消えない）
  await page.evaluate(() => window.history.pushState({}, "", "/tickets?new=1"));
  await page
    .getByRole("navigation", { name: "メニュー", exact: true })
    .getByRole("link", { name: "チケット", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(table(page)).toContainText("作った 1 件");
});

test("K251-UI-018 一覧（50 件）と 0 件の画面を 320・375・768・1024・1440 で開き、どれも横溢れ 0・見出しの左の端が画面の中", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const bad: string[] = [];
  for (const [label, list] of [
    ["50 件", () => ok(items(50), { next_cursor: "c1" })],
    ["0 件", () => ok([], { next_cursor: null })],
  ] as const) {
    const p = await page.context().newPage();
    await mockList(p, { list });
    for (const w of WIDTHS) {
      await open(p, "/tickets", w);
      await expect(head(p).locator("h1")).toHaveText("チケット");
      const o = await overflowX(p);
      if (o !== 0) bad.push(`${label} 幅 ${w}：${o}px`);
      const x = await head(p)
        .locator("h1")
        .evaluate((e) => e.getBoundingClientRect().left);
      if (x < 0) bad.push(`${label} 幅 ${w}：見出しの左の端 ${x}`);
    }
    await p.close();
  }
  expect(bad).toEqual([]);
});

test("K251-UI-019 幅 375・1440：本文の押せるもの（タブ・行のリンク・もっと見る・絞る欄）は 24px 以上", async ({
  page,
}) => {
  await mockList(page, { list: () => ok(items(50), { next_cursor: "c1" }) });
  for (const w of [375, 1440]) {
    await open(page, "/tickets", w);
    await expect(rowsOf(page)).toHaveCount(50);
    const small = await page.$$eval("#k-main a[href], #k-main button, #k-main input", (els) =>
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

test("K251-UI-020 はじめにやること（0 件の画面の右の列）：見出しと「0 ／ 2」（使える項目だけ数える）・3 つの名前・パスキーはグレーで押せず ✓ も「付けました」も無い・「つなぐ」で /setup/bridge・「預ける」で /settings/credentials", async ({
  page,
}) => {
  await mockList(page, { list: () => ok([], { next_cursor: null }) });
  await open(page);
  const box = page.getByRole("region", { name: "はじめにやること" });
  await expect(box.getByRole("heading", { name: "はじめにやること" })).toBeVisible();
  await expect(box).toContainText("0 ／ 2");
  for (const t of TASKS) await expect(box, t.label).toContainText(t.label);
  for (const t of TASKS) await expect(box, t.label).toContainText(t.desc); // パスキーは「まだ付けられません。数には入れていません」（K-250・OnHomeLater）
  const pk = box.locator('[data-task="passkey"]');
  await expectDisabled(page, pk, "パスキーを付ける");
  await expect(pk).not.toContainText("✓");
  await expect(box).not.toContainText("付けました");
  await expect(pk.getByRole("link")).toHaveCount(0);
  await box.getByRole("link", { name: "つなぐ" }).click();
  await expect(page).toHaveURL(/\/setup\/bridge$/);
  await page.goBack();
  await box.getByRole("link", { name: "預ける" }).click();
  await expect(page).toHaveURL(/\/settings\/credentials$/);
});

for (const id of ["tickets-first", "tickets-main"] as const) {
  const g = CFG.groups.find((x) => x.id === id);
  for (const w of g?.widths ?? [1440]) {
    test(`K251-UI-021 ${id}（${g?.canvas ?? "?"}）幅 ${w}：組が enrolled・持ち主 K-251・鍵が在り、組の値と読み込んだ書体がキャンバスと同じ`, async ({
      browser,
    }) => {
      await compareGroup(browser, g, "K-251", w);
    });
  }
}

test("K251-UI-022 0 件の画面の「分身と話して作る」と 3 つの提案は押せない：押しても・Enter でも移らず口も呼ばない・aria-disabled・グレー（D-145.2）", async ({
  page,
}) => {
  const m = await mockList(page, { list: () => ok([], { next_cursor: null }) });
  await open(page);
  const empty = page.locator('[data-state="empty"]');
  const before = page.url();
  for (const t of ["分身と話して作る", "今月の請求書を送る", "問い合わせに返す", "見積を作る"]) {
    const it = empty.locator('[aria-disabled="true"]', { hasText: t });
    await expect(it, t).toHaveCount(1);
    await expect(empty.getByRole("link", { name: t }), t).toHaveCount(0);
    expect(Number(await it.evaluate((e) => getComputedStyle(e).opacity)), t).toBeCloseTo(DISABLED_OPACITY, 3);
    await it.click({ force: true });
    await it.press("Enter");
    expect(page.url(), t).toBe(before);
  }
  expect(m.otherCalls.filter((c) => !c.startsWith("GET "))).toEqual([]);
});

test("K251-UI-023 はじめにやることを「いまは閉じる」：閉じる口を 1 回・箱が消え開き直しても出ない。PC が済んで預けるを飛ばした人・一覧にチケットが在る画面には出ない（D-145.10）", async ({
  page,
}) => {
  const m = await mockList(page, { list: () => ok([], { next_cursor: null }) });
  await open(page);
  const box = page.getByRole("region", { name: "はじめにやること" });
  await box.getByRole("button", { name: "いまは閉じる" }).click();
  await expect(box).toHaveCount(0);
  await expect.poll(() => m.dismissCalls).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "まだチケットはありません" })).toBeVisible();
  await expect(page.getByRole("region", { name: "はじめにやること" })).toHaveCount(0);

  const all = await page.context().newPage();
  await mockList(all, {
    list: () => ok([], { next_cursor: null }),
    tasks: TASKS.map((t) =>
      t.key === "pc" ? { ...t, done: true } : t.key === "credentials" ? { ...t, skipped: true } : t,
    ),
  });
  await open(all);
  await expect(all.getByRole("heading", { name: "まだチケットはありません" })).toBeVisible();
  await expect(all.getByRole("region", { name: "はじめにやること" })).toHaveCount(0);

  const some = await page.context().newPage();
  await mockList(some);
  await open(some);
  await expect(rowsOf(some)).toHaveCount(3);
  await expect(some.getByRole("region", { name: "はじめにやること" })).toHaveCount(0);
});

for (const w of [1440, 1900]) {
  test(`K251-UI-024 幅 ${w}：右の列は本文の右に在り幅 340 以下。「いつでもできること」の 3 つはグレーで押せない・ひな形の行は固定の字だけで値は空`, async ({
    page,
  }) => {
    await mockList(page, { list: () => ok([], { next_cursor: null }) });
    await open(page, "/tickets", w);
    const col = page.locator("aside.k-list-side");
    const body = (await page.locator('[data-state="empty"]').boundingBox())!;
    const c = (await col.boundingBox())!;
    expect(c.x).toBeGreaterThanOrEqual(body.x + body.width);
    expect(c.width).toBeLessThanOrEqual(340);
    const any = col.getByRole("region", { name: "いつでもできること" });
    for (const t of ["メンバーを招く", "ナレッジのページを書く", "チケットの形を自社に合わせる"]) {
      const it = any.locator('[aria-disabled="true"]', { hasText: t });
      await expect(it, t).toHaveCount(1);
      await expect(any.getByRole("link", { name: t }), t).toHaveCount(0);
      expect(Number(await it.evaluate((e) => getComputedStyle(e).opacity)), t).toBeCloseTo(DISABLED_OPACITY, 3);
    }
    const tpl = any.locator('[data-part="template"]');
    await expect(tpl).toContainText("のひな形");
    await expect(tpl.locator("[data-value]")).toHaveCount(4);
    for (const v of await tpl.locator("[data-value]").allInnerTexts()) expect(v.trim()).toBe("");
  });
}

test("K251-UI-025 ログイン情報を預けるの横の「あとで」（キャンバス OnHomeLater）：押すと閉じる口に key credentials を渡して 1 回呼び、その項目は飛ばした印になり、数は「1 ／ 2」（D-145.13・D-145.14）", async ({
  page,
}) => {
  const m = await mockList(page, { list: () => ok([], { next_cursor: null }) });
  await open(page);
  const box = page.getByRole("region", { name: "はじめにやること" });
  const cr = box.locator('[data-task="credentials"]');
  await cr.getByRole("button", { name: "あとで" }).click();
  await expect.poll(() => m.skipCalls).toEqual(["credentials"]);
  await expect(cr).toHaveAttribute("data-skipped", "true");
  await expect(cr.getByRole("button", { name: "あとで" })).toHaveCount(0);
  await expect(box).toContainText("1 ／ 2");
  await expect(box.locator('[data-task="pc"]').getByRole("button", { name: "あとで" })).toHaveCount(0); // 任意でない項目は飛ばせない
});

test("K251-UI-026 自分に関わるもの（キャンバス Main）の部品：数の札 4 つと「自分に関わるもの」の件数は在るが数は空・絞りの札 5 つ・並び・条件を保存はグレーで押せない（D-145.9。表示設定は 032 で押せる）", async ({
  page,
}) => {
  const m = await mockList(page);
  await open(page);
  await expect(rowsOf(page)).toHaveCount(3); // 札と表は口の答えが届いてから描く（読む前に待つ）
  const cards = page.locator('[aria-label="数の札"]');
  const names = await cards
    .locator(":scope > *")
    .evaluateAll((els) => els.map((e) => e.querySelector("[data-label]")?.textContent?.trim()));
  expect(names).toEqual(["期限切れ", "今日まで", "自分が承認", "AI が動いている"]);
  for (const v of await cards.locator("[data-value]").allInnerTexts()) expect(v.trim()).toBe("");
  for (const c of await cards.locator(":scope > *").all()) await expectDisabled(page, c, "数の札");
  const bar = page.locator('[aria-label="自分に関わるものの絞り込み"]');
  await expect(bar).toContainText("自分に関わるもの");
  expect((await bar.locator("[data-value]").first().innerText()).trim()).toBe("");
  for (const t of [
    "すべて",
    "自分が担当",
    "AI に任せている",
    "自分が承認",
    "渡されたもの",
    "並び：期限の近い順",
    "条件を保存",
  ])
    await expectDisabled(page, bar.locator('[aria-disabled="true"]', { hasText: t }).first(), t);
  for (const v of await bar.locator("[data-chip] [data-value]").allInnerTexts()) expect(v.trim()).toBe("");
  expect(m.otherCalls.filter((c) => !c.startsWith("GET "))).toEqual([]);
});

test("K251-UI-027 自分に関わるもの（キャンバス Main）の右の列：「自分の承認を待っているもの」は承認待ちの口の行（題名・番号）・「高本のAI のいま」と「最近の知らせ」は箱と見出しだけで中身は空・「すべて」「分身の部屋へ」はグレー", async ({
  page,
}) => {
  await mockList(page, {
    approvals: [
      {
        id: "a1",
        ticket_id: idOf(5),
        ticket_number: "EG-128",
        title: "セイコー様へ請求書を送る",
        kind: "artifact",
      },
    ],
  });
  await open(page);
  const side = page.locator("aside.k-list-side");
  const ap = side.getByRole("region", { name: "自分の承認を待っているもの" });
  await expect(ap).toContainText("EG-128");
  await expect(ap).toContainText("セイコー様へ請求書を送る");
  for (const name of ["高本のAI のいま", "最近の知らせ"]) {
    const box = side.getByRole("region", { name });
    await expect(box.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
    const rest = (await box.innerText()).replace(name, "").replace("分身の部屋へ", "").trim();
    expect(rest, name).toBe("");
  }
  await expectDisabled(page, side.locator('[aria-disabled="true"]', { hasText: "分身の部屋へ" }), "分身の部屋へ");
  await expectDisabled(page, ap.locator('[aria-disabled="true"]', { hasText: "すべて" }), "すべて");
});

test("K251-UI-028 「いまは閉じる」「あとで」：2 回押しても口は 1 回。口が 500 なら箱とその項目はそのまま残り、ボタンはまた押せる", async ({
  page,
}) => {
  const m = await mockList(page, { list: () => ok([], { next_cursor: null }), dismissStatus: 500 });
  await open(page);
  const box = page.getByRole("region", { name: "はじめにやること" });
  const later = box.locator('[data-task="credentials"]').getByRole("button", { name: "あとで" });
  await later.dblclick();
  await expect.poll(() => m.skipCalls.length).toBe(1);
  await expect(box.locator('[data-task="credentials"]')).not.toHaveAttribute("data-skipped", "true");
  await expect(later).toBeEnabled();
  const close = box.getByRole("button", { name: "いまは閉じる" });
  await close.dblclick();
  await expect.poll(() => m.dismissCalls).toBe(1);
  await expect(box).toBeVisible();
  await expect(close).toBeEnabled();
});

test("K251-UI-029 はじめにやることの一覧・承認待ちの口が 500：一覧の本文は出る。はじめにやることの箱は出さず、承認待ちの箱は「読み込めませんでした」", async ({
  page,
}) => {
  const z = await page.context().newPage();
  await mockList(z, { list: () => ok([], { next_cursor: null }), tasksStatus: 500 });
  await open(z);
  await expect(z.getByRole("heading", { name: "まだチケットはありません" })).toBeVisible();
  await expect(z.getByRole("region", { name: "はじめにやること" })).toHaveCount(0);
  await mockList(page, { approvalsStatus: 500 });
  await open(page);
  await expect(rowsOf(page)).toHaveCount(3);
  const ap = page.locator("aside.k-list-side").getByRole("region", { name: "自分の承認を待っているもの" });
  await expect(ap).toContainText("読み込めませんでした");
});

test("K251-UI-030 幅 375：一番下までスクロールしても「もっと見る」と右の列の最後（いまは閉じる）は下のタブに隠れない", async ({
  page,
}) => {
  const hit = (l: Locator) =>
    l.evaluate((e) => {
      e.scrollIntoView({ block: "end" });
      window.scrollTo(0, document.documentElement.scrollHeight);
      const r = e.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return at !== null && (at === e || e.contains(at));
    });
  await mockList(page, { list: () => ok(items(50), { next_cursor: "c1" }) });
  await open(page, "/tickets", 375);
  await expect(rowsOf(page)).toHaveCount(50);
  expect(await hit(page.getByRole("button", { name: "もっと見る" }))).toBe(true);
  const z = await page.context().newPage();
  await mockList(z, { list: () => ok([], { next_cursor: null }) });
  await open(z, "/tickets", 375);
  expect(
    await hit(z.getByRole("region", { name: "はじめにやること" }).getByRole("button", { name: "いまは閉じる" })),
  ).toBe(true);
});

test("K251-UI-031 自分に関わるものは期限で区切る：見出しの行は 期限切れ・今日まで・今週・来週以降 の順で件数は出さず、行の無い区切りは出さない。一覧（?view=all）は区切らない（answer=afc3b0f2fdb4）", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-04T08:00:00+09:00")); // 日本時間の水曜 8 時（UTC ではまだ 11-03・週は月曜から日曜）
  const rows = [
    item(1, { overdue: true, due_on: "2026-11-01" }),
    item(2, { due_on: "2026-11-04" }),
    item(3, { due_on: "2026-11-02", stage: { id: "st", name: "完了", key: "done" } }), // 済んだ過去の期限：今日まで
    item(4, { due_on: "2026-11-06" }),
    item(5, { due_on: "2026-11-08" }),
    item(6, { due_on: "2026-11-09" }),
    item(7, { due_on: null }),
  ];
  await mockList(page, { list: () => ok(rows, { next_cursor: null }) });
  await open(page);
  await expect(rowsOf(page)).toHaveCount(7);
  const heads = table(page).locator("tbody tr[data-section]");
  expect((await heads.allInnerTexts()).map((t) => t.trim())).toEqual(["期限切れ", "今日まで", "今週", "来週以降"]);
  await expect(table(page).locator("tbody")).not.toContainText("件");
  expect(await heads.first().locator("td").getAttribute("colspan")).toBe(String(COLUMNS.length));
  // 区切りの見出しの行の後ろに、その区切りの行が口の並びのまま続く
  const order = await table(page)
    .locator("tbody tr")
    .evaluateAll((trs) => trs.map((tr) => tr.getAttribute("data-section") ?? tr.textContent?.match(/EG-\d+/)?.[0]));
  expect(order).toEqual([
    "overdue",
    "EG-101",
    "today",
    "EG-102",
    "EG-103",
    "week",
    "EG-104",
    "EG-105",
    "later",
    "EG-106",
    "EG-107",
  ]);
  // 期限切れの行が無ければ、その区切りは出さない
  const p2 = await page.context().newPage();
  await p2.clock.setFixedTime(new Date("2026-11-04T08:00:00+09:00"));
  await mockList(p2, { list: () => ok(rows.slice(1), { next_cursor: null }) });
  await open(p2);
  await expect(rowsOf(p2)).toHaveCount(6);
  expect((await p2.locator("tbody tr[data-section]").allInnerTexts()).map((t) => t.trim())).toEqual([
    "今日まで",
    "今週",
    "来週以降",
  ]);
  // 「もっと見る」で届いた期限切れの行は、期限切れの見出しを増やさずその下に入る（読んだ行全部を区切り直す）
  const p3 = await page.context().newPage();
  await p3.clock.setFixedTime(new Date("2026-11-04T08:00:00+09:00"));
  await mockList(p3, {
    list: (q) =>
      q.get("cursor")
        ? ok([item(8, { overdue: true, due_on: "2026-10-30" })], { next_cursor: null })
        : ok(rows.slice(0, 4), { next_cursor: "c1" }),
  });
  await open(p3);
  await expect(rowsOf(p3)).toHaveCount(4);
  await p3.getByRole("button", { name: "もっと見る" }).click();
  await expect(rowsOf(p3)).toHaveCount(5);
  const order3 = await table(p3)
    .locator("tbody tr")
    .evaluateAll((trs) => trs.map((tr) => tr.getAttribute("data-section") ?? tr.textContent?.match(/EG-\d+/)?.[0]));
  expect(order3).toEqual(["overdue", "EG-101", "EG-108", "today", "EG-102", "EG-103", "week", "EG-104"]);
  // 一覧（全部）は区切らない
  await views(p2).getByRole("link", { name: "一覧" }).click();
  await expect(p2).toHaveURL(/\/tickets\?view=all$/);
  await expect(rowsOf(p2)).toHaveCount(6);
  await expect(p2.locator("tbody tr[data-section]")).toHaveCount(0);
});

test("K251-UI-032 表示設定で出す列を選ぶ：番号と題名は外せない。外した列は見出しと行から消え、開き直しても覚えている。はじめに戻すで 9 列。Esc で閉じてボタンに戻る。口は呼ばない（answer=afc3b0f2fdb4）", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-04T08:00:00+09:00")); // 区切りの見出しの行（来週以降）を決まった日で出す
  const m = await mockList(page);
  await open(page);
  await expect(rowsOf(page)).toHaveCount(3);
  const btn = page.getByRole("button", { name: "表示設定" });
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  const box = page.getByRole("dialog", { name: "自分に関わるものの見え方" });
  await expect(box).toBeVisible();
  const cols = box.getByRole("group", { name: "表に出す列" });
  await expect(cols.getByRole("checkbox")).toHaveCount(COLUMNS.length);
  for (const name of COLUMNS) await expect(cols.getByRole("checkbox", { name, exact: true }), name).toBeChecked();
  for (const name of ["番号", "題名"])
    await expect(cols.getByRole("checkbox", { name, exact: true }), name).toBeDisabled();
  await cols.getByRole("checkbox", { name: "種別", exact: true }).uncheck();
  await cols.getByRole("checkbox", { name: "グループ", exact: true }).uncheck();
  const left = COLUMNS.filter((c) => c !== "種別" && c !== "グループ");
  const heads = table(page).getByRole("columnheader");
  await expect(heads).toHaveText(left); // 待つ形で読む
  await expect(rowsOf(page).first().locator("td")).toHaveCount(left.length);
  // 区切りの見出しの行は残りの列にまたがる
  await expect(table(page).locator("tbody tr[data-section] td").first()).toHaveAttribute(
    "colspan",
    String(left.length),
  );
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(btn).toBeFocused();
  // 開き直しても覚えている（このブラウザ）
  await page.reload();
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(heads).toHaveText(left);
  // はじめに戻す
  await btn.click();
  await page
    .getByRole("dialog", { name: "自分に関わるものの見え方" })
    .getByRole("button", { name: "はじめに戻す" })
    .click();
  await expect(heads).toHaveText(COLUMNS);
  await btn.click();
  await expect(page.getByRole("dialog", { name: "自分に関わるものの見え方" })).toHaveCount(0);
  expect(m.otherCalls.filter((c) => !c.startsWith("GET "))).toEqual([]);
});

for (const [label, saved, want] of [
  ["JSON でない", "{壊れた", COLUMNS],
  ["配列でない", JSON.stringify({ a: 1 }), COLUMNS],
  [
    "知らない鍵と番号と題名を外した値を逆の順で",
    JSON.stringify(["due", "nope", "kind"]),
    ["種別", "番号", "題名", "期限"],
  ],
  ["空の配列", JSON.stringify([]), ["番号", "題名"]],
] as const) {
  test(`K251-UI-033 覚えた列の値が壊れている・ずれている（${label}）：表は出て、番号と題名は必ず在り、知っている鍵だけを決まった並びで使う`, async ({
    page,
  }) => {
    await page.addInitScript((v) => window.localStorage.setItem("kaname.ticket-list.columns", v), saved);
    await mockList(page);
    await open(page);
    await expect(rowsOf(page)).toHaveCount(3);
    await expect(table(page).getByRole("columnheader")).toHaveText([...want]); // 待つ形で読む
  });
}

for (const w of [320, 375]) {
  test(`K251-UI-034 幅 ${w}：表示設定の箱を開いても横溢れ 0・箱の左右の端が画面の中`, async ({ page }) => {
    await mockList(page);
    await open(page, "/tickets", w);
    await expect(rowsOf(page)).toHaveCount(3);
    await page.getByRole("button", { name: "表示設定" }).click();
    const box = page.getByRole("dialog", { name: "自分に関わるものの見え方" });
    await expect(box).toBeVisible();
    expect(await overflowX(page)).toBe(0);
    const b = (await box.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w);
  });
}

for (const check of ["empty", "fail"] as const) {
  test(`K251-UI-035 自分に関わるものが 0 件で会社にはチケットが在る（確かめの口が ${check === "empty" ? "1 件を返す" : "500"}）：確かめの間も はじめて を出さず、Main の形で表の見出しだけと空の文（PM の決め 2026-11-17）`, async ({
    page,
  }) => {
    const hold = gate();
    const m = await mockList(page, {
      list: async (q) => {
        if (q.get("view") !== "all") return ok([], { next_cursor: null });
        await hold.wait;
        if (check === "fail") return { status: 500, body: { error: "server_error", code: "INTERNAL" } };
        return ok([item(9)], { next_cursor: "c9" });
      },
    });
    let setupCalls = 0;
    page.on("request", (r) => {
      if (new URL(r.url()).pathname === "/api/v1/me/setup-tasks") setupCalls += 1;
    });
    await open(page);
    // 確かめの口が答えるまで、はじめて の物は出さない（一瞬でも出さない）
    await expect.poll(() => m.listCalls.filter((q) => q.get("view") === "all").length).toBe(1);
    await expect(page.getByText("ようこそ")).toHaveCount(0);
    await expect(page.locator('[data-state="empty"]')).toHaveCount(0);
    await expect(page.getByRole("region", { name: "はじめにやること" })).toHaveCount(0);
    hold.open();
    await expect(page.getByText("自分に関わるチケットはありません")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const probes = m.listCalls.filter((q) => q.get("view") === "all");
    expect(probes).toHaveLength(1);
    expect(probes[0]!.get("limit")).toBe("1");
    // はじめにやることの口は一覧の答えを待たずに最初に 1 回呼ぶ（K-235・段を 1 にする）。箱を出さないことは下で見る
    expect(setupCalls).toBe(1);
    await expect(table(page).getByRole("columnheader")).toHaveText(COLUMNS);
    await expect(rowsOf(page)).toHaveCount(0);
    await expect(page.locator('[aria-label="数の札"]')).toBeVisible();
    await expect(page.locator('[aria-label="自分に関わるものの絞り込み"]')).toBeVisible();
    await expect(page.getByRole("region", { name: "自分の承認を待っているもの" })).toBeVisible();
    await expect(page.getByText("ようこそ")).toHaveCount(0);
    await expect(page.locator('[data-state="empty"]')).toHaveCount(0);
    await expect(page.getByRole("region", { name: "はじめにやること" })).toHaveCount(0);
  });
}

test("K251-UI-035 確かめの口が 401：共通の決まりどおり入り直しの画面 /login?next=%2Ftickets に移る", async ({
  page,
}) => {
  await mockList(page, {
    list: (q) =>
      q.get("view") === "all"
        ? { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } }
        : ok([], { next_cursor: null }),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login\?next=%2Ftickets$/);
});

test("K251-UI-039 一覧（?view=all）を直に開いて 0 件：会社に 0 件なので、確かめの口を呼ばずに はじめて の画面", async ({
  page,
}) => {
  const m = await mockList(page, { list: () => ok([], { next_cursor: null }) });
  await open(page, "/tickets?view=all");
  await expect(page.getByText("ようこそ、高本さん")).toBeVisible();
  await expect(page.locator('[data-state="empty"]')).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(m.listCalls).toHaveLength(1);
  expect(m.listCalls[0]!.get("view")).toBe("all");
  expect(m.listCalls[0]!.get("limit")).toBe("50");
});

test("K251-UI-040 一覧（?view=all）の表示設定の箱：名前は「一覧の見え方」で、表に出す列の 9 つのチェックだけ。自分に関わるものの項目（上の数字など）は無い", async ({
  page,
}) => {
  await mockList(page);
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  await page.getByRole("button", { name: "表示設定" }).click();
  const box = page.getByRole("dialog", { name: "一覧の見え方" });
  await expect(box).toBeVisible();
  await expect(box.getByRole("group", { name: "表に出す列" }).getByRole("checkbox")).toHaveCount(COLUMNS.length);
  for (const title of ["上の数字", "右に出すもの", "表の分け方", "入れるもの"])
    await expect(box.getByRole("group", { name: title }), title).toHaveCount(0);
});

test("K251-UI-036 一覧（?view=all）は右の列を描かず、承認待ちの口を呼ぶのは 1 回だけ（自分に関わるものも 1 回：外枠の数と右の列が同じ問い合わせを分け合う・K-235）", async ({
  page,
}) => {
  const count = async (path: string) => {
    const p = await page.context().newPage();
    let n = 0;
    p.on("request", (r) => {
      if (new URL(r.url()).pathname === "/api/v1/approvals/queue") n += 1;
    });
    await mockList(p);
    await open(p, path);
    await expect(rowsOf(p)).toHaveCount(3);
    await expect(p.getByRole("region", { name: "自分の承認を待っているもの" })).toHaveCount(
      path === "/tickets" ? 1 : 0,
    );
    await expect(p.locator("aside.k-list-side")).toHaveCount(path === "/tickets" ? 1 : 0);
    await p.waitForLoadState("networkidle");
    await p.close();
    return n;
  };
  const mine = await count("/tickets");
  const all = await count("/tickets?view=all");
  expect(all).toBe(1);
  expect(mine).toBe(all);
});

test("K251-UI-037 自分に関わるものの表示設定の箱：キャンバス MnView の項目（上の数字・右に出すもの・表の分け方・入れるもの）を見出しと並べ、どれもグレーで押せない・口を呼ばない・箱に影がある（D-145.9）", async ({
  page,
}) => {
  const m = await mockList(page);
  await open(page);
  await expect(rowsOf(page)).toHaveCount(3);
  await page.getByRole("button", { name: "表示設定" }).click();
  const box = page.getByRole("dialog", { name: "自分に関わるものの見え方" });
  await expect(box).toBeVisible();
  expect(await box.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe("none");
  const side = page.locator("aside.k-list-side");
  const sideHeads = await side.getByRole("heading").allInnerTexts();
  const cardNames = await page.locator('[aria-label="数の札"] [data-label]').allInnerTexts();
  const groups: [string, string[]][] = [
    ["上の数字", ["期限切れ", "今日まで", "自分が承認", "AI が動いている", "今週まで"]],
    [
      "右に出すもの",
      ["自分の承認を待っているもの", "高本のAI のいま", "最近の知らせ", "自分が担当・承認するものの動き"],
    ],
    ["表の分け方", ["期限", "グループ", "状態"]],
    ["入れるもの", ["担当しているもの", "承認するもの・渡されたもの", "自分が担当・承認するもの"]],
  ];
  for (const [title, names] of groups) {
    const g = box.getByRole("group", { name: title });
    await expect(g, title).toBeVisible();
    await expect(g.locator('[aria-disabled="true"]'), title).toHaveCount(names.length);
    for (const name of names) {
      const it = g.locator('[aria-disabled="true"]', { hasText: name }).first();
      await expect(it, name).toHaveCount(1);
      await expect(it.getByRole("checkbox"), name).toHaveCount(0);
      await expect(it.getByRole("radio"), name).toHaveCount(0);
      await expectDisabled(page, it, name); // 押しても Enter でも URL が変わらない・グレー・リンクでない
    }
  }
  // 押しても表の列・数の札・右の列は変わらない
  await expect(table(page).getByRole("columnheader")).toHaveText(COLUMNS);
  expect(await page.locator('[aria-label="数の札"] [data-label]').allInnerTexts()).toEqual(cardNames);
  expect(await side.getByRole("heading").allInnerTexts()).toEqual(sideHeads);
  expect(m.otherCalls.filter((c) => !c.startsWith("GET "))).toEqual([]);
});

test("K251-UI-038 本人の名前を読む前（自分の情報の口が答えない間）：右の列の見出しは「AI のいま」で、「のAI」から始まる欠けた見出しが無い", async ({
  page,
}) => {
  const hold = gate();
  await mockList(page);
  await page.route(/\/api\/auth-ext\/me$/, async (route) => {
    await hold.wait;
    await route.fallback();
  });
  await open(page);
  await expect(rowsOf(page)).toHaveCount(3);
  const side = page.locator("aside.k-list-side");
  await expect(side.getByRole("heading", { name: /^AI のいま/ })).toBeVisible();
  for (const h of await side.getByRole("heading").allInnerTexts()) expect(h.startsWith("のAI"), h).toBe(false);
  hold.open();
  await expect(side.getByRole("heading", { name: /^高本のAI のいま/ })).toBeVisible();
});

test("K251-UI-038 本人の名前を読めない（自分の情報の口が 500）：右の列の見出しは「AI のいま」で、「のAI」から始まる欠けた見出しが無い", async ({
  page,
}) => {
  await mockList(page);
  await page.route(/\/api\/auth-ext\/me$/, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL" }) }),
  );
  await open(page);
  await expect(rowsOf(page)).toHaveCount(3);
  const side = page.locator("aside.k-list-side");
  await expect(side.getByRole("heading", { name: /^AI のいま/ })).toBeVisible();
  for (const h of await side.getByRole("heading").allInnerTexts()) expect(h.startsWith("のAI"), h).toBe(false);
  await expect(side.getByRole("region", { name: /^のAI/ })).toHaveCount(0);
});
