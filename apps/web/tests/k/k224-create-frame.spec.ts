// K-224「チケットを作る画面の器をキャンバス（Create）に合わせる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas/Create.dc.html。口は網の手前で差し替える（tests/k/create-mock.ts）。
//   画面の形（実装の役が作る）：
//     帯 header.k-page-head：h1「チケットを作る」・作り方（[aria-label="作り方"]：自分で書く＝aria-current、AI と話して作る・過去のチケットから複製＝押せない）・
//       下書きの保存の状態（[role="status"][aria-label="下書きの保存"]）
//     section[aria-label="チケットを作る"] の中に .k-create-cards（白い箱：グループ・種別・題名／本文（K-225）／振り分け）と aside.k-create-aside（作る前に）
//     足元の帯 .k-create-foot（説明・「下書きのまま閉じる」・主「作る」）
//   期待は決める人の答え（D-145.5〜.7・D-145.9）：作っていない作り方は押せない形・AI のひとことは空の箱・ファイルを置く枠は出すが使えない・
//   振り分けのまだ使えない欄はグレーで押せない。グレーは正本の使えない状態の部品（button-disabled・input-disabled・不透明度 0.55）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  compareFonts,
  compareRows,
  loadedFonts,
  mismatches,
  readVals,
  type FidelityPair,
} from "../../../../scripts/ci/fidelity_compare.mjs";
import { FIDELITY_STATES, routeCanvasFonts } from "../_lib/fidelity-states";
import { BOSS, ME, css, fillRequired, form, gate, loaded, mockCreate, openCreate, overflowX } from "./create-mock";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const LINE = "rgb(221, 226, 233)";
const WHITE = "rgb(255, 255, 255)";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
/** 親子が 3 段を超えたときの正本の理由（E-VAL-015） */
const TOO_DEEP = "チケットの親子は 3 段までです。ほかの親を選んでください";
const DISABLED_OPACITY = 0.55; // 数で比べる（本番の組み立ては CSS を縮めて ".55" と書くことがある）
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;

test("K224-UI-001 幅 1440：外枠の右のパネル（.k-panel）を使わず、白い箱（線 1px・角丸 8）が縦に並び、右に「作る前に」（幅 340 以下）", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  await expect(page.locator("#k-main .k-panel")).toHaveCount(0);
  const cards = page.locator(".k-create-cards > section");
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < 3; i += 1) {
    const c = cards.nth(i);
    expect(await c.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(WHITE);
    expect(await c.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(LINE);
    expect(await c.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
  }
  const f = await box(page, ".k-create-cards");
  const a = await box(page, "aside.k-create-aside");
  expect(a.x).toBeGreaterThanOrEqual(f.x + f.width);
  expect(a.width).toBeLessThanOrEqual(340);
  await expect(page.locator("aside.k-create-aside").getByRole("region", { name: "作る前に" })).toBeVisible();
});

for (const w of [768, 375]) {
  test(`K224-UI-002 幅 ${w}：作る面もその外側の器も画面に被さらない（fixed でない）・「作る前に」は本文の下・横溢れ 0`, async ({
    page,
  }) => {
    await mockCreate(page);
    await openCreate(page, w);
    await loaded(page);
    const fixed = await form(page).evaluate((e) => {
      const out: string[] = [];
      for (let el: Element | null = e; el; el = el.parentElement)
        if (getComputedStyle(el).position === "fixed") out.push(el.tagName + (el.className ? `.${el.className}` : ""));
      return out;
    });
    expect(fixed).toEqual([]);
    const f = await box(page, ".k-create-cards");
    const a = await box(page, "aside.k-create-aside");
    expect(a.y).toBeGreaterThanOrEqual(f.y + f.height - 1);
    expect(await overflowX(page)).toBe(0);
  });
}

test("K224-UI-003 帯：h1「チケットを作る」18px・700。一覧の h1「チケット」は出ず、h1 は 1 つ", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page);
  const h1 = page.locator("header.k-page-head h1");
  await expect(h1).toHaveText("チケットを作る");
  expect(await css(page, "header.k-page-head h1", "font-size")).toBe("18px");
  expect(await css(page, "header.k-page-head h1", "font-weight")).toBe("700");
  await expect(page.locator("h1")).toHaveCount(1);
});

test("K224-UI-004 作り方：自分で書く が今いる（aria-current）・AI と話して作る と 過去のチケットから複製 は押せない（グレー 0.55・押しても Enter でも動かない・title に準備中・目に見える「準備中」は無い）", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const how = page.locator('header.k-page-head [aria-label="作り方"]');
  await expect(how.locator('[aria-current="true"]')).toHaveText("自分で書く");
  for (const name of ["AI と話して作る", "過去のチケットから複製"]) {
    await expect(how.getByRole("link", { name }), name).toHaveCount(0);
    await expect(how.getByRole("button", { name }), name).toHaveCount(0);
    const it = how.locator('[aria-disabled="true"]', { hasText: name });
    await expect(it, name).toHaveCount(1);
    expect(await it.getAttribute("title"), name).toContain("準備中");
    expect(Number(await it.evaluate((e) => getComputedStyle(e).opacity)), name).toBeCloseTo(DISABLED_OPACITY, 3);
    const url = page.url();
    const calls = m.listCalls.length + m.creates.length;
    await it.click({ force: true });
    await it.focus();
    await page.keyboard.press("Enter");
    expect(page.url(), name).toBe(url);
    expect(m.listCalls.length + m.creates.length, name).toBe(calls);
  }
  expect(await page.locator("header.k-page-head").innerText()).not.toContain("準備中");
});

test("K224-UI-005 下書きの保存の状態：開いた直後は字なし・残すと「下書きを自動で保存しました（10:42）」（答えの saved_at を日本時間で）・残せないと帯は短く「下書きを残せませんでした」で、知らせの箱の「下書きをサーバーに残せませんでした」と同じ文は 2 回出ない", async ({
  page,
}) => {
  const m = await mockCreate(page);
  // 下書きの一覧の口を読んだ回数（保存の時刻は保存の口の答えから読み、保存のたびに一覧を読み直さない）
  let draftLists = 0;
  page.on("request", (r) => {
    if (r.method() === "GET" && /\/api\/v1\/me\/ticket-drafts$/.test(r.url())) draftLists += 1;
  });
  await openCreate(page);
  await loaded(page);
  const listsAtOpen = draftLists;
  const status = page.locator('header.k-page-head [role="status"][aria-label="下書きの保存"]');
  await expect(status).toHaveText("");
  await page.getByRole("textbox", { name: "題名", exact: true }).fill("請求書を送る");
  await expect.poll(() => m.draftSaves.length).toBeGreaterThan(0);
  await expect(status).toHaveText("下書きを自動で保存しました（10:42）");
  m.draftSaveStatus = 500;
  await page.getByRole("textbox", { name: "題名", exact: true }).fill("請求書を送る 2");
  await expect(status).toHaveText("下書きを残せませんでした");
  await expect(status).not.toContainText("保存しました");
  // 知らせの箱は今までどおり「下書きをサーバーに残せませんでした」＋「書いたものはこの画面に残っています」。同じ文は画面に 1 つだけ
  await expect(page.getByText("下書きをサーバーに残せませんでした", { exact: true })).toHaveCount(1);
  await expect(page.getByText(/書いたものはこの画面に残っています/).first()).toBeVisible();
  expect(draftLists, "保存のたびに下書きの一覧を読み直さない").toBe(listsAtOpen);
});

test("K224-UI-006 上の箱：グループと種別の選択は幅 160 で横に並び、題名の欄は高さ 40・15px・500", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const g = (await page.getByRole("combobox", { name: "グループ" }).boundingBox())!;
  const k = (await page.getByRole("combobox", { name: "種別" }).boundingBox())!;
  expect(Math.round(g.width)).toBe(160);
  expect(Math.round(k.width)).toBe(160);
  expect(Math.abs(g.y - k.y)).toBeLessThanOrEqual(1);
  expect(k.x).toBeGreaterThan(g.x + g.width);
  const title = page.getByRole("textbox", { name: "題名", exact: true });
  expect(Math.round((await title.boundingBox())!.height)).toBe(40);
  expect(await title.evaluate((e) => getComputedStyle(e).fontSize)).toBe("15px");
  expect(await title.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("500");
});

test("K224-UI-007 箱と箱の間は 12px・項目名と欄の間は 4px", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const cards = page.locator(".k-create-cards > section");
  const a = (await cards.nth(0).boundingBox())!;
  const b = (await cards.nth(1).boundingBox())!;
  expect(Math.abs(b.y - (a.y + a.height) - 12)).toBeLessThanOrEqual(1);
  const label = (await page.locator(".k-create-cards .k-label", { hasText: "題名" }).first().boundingBox())!;
  const input = (await page.getByRole("textbox", { name: "題名", exact: true }).boundingBox())!;
  expect(Math.abs(input.y - (label.y + label.height) - 4)).toBeLessThanOrEqual(1);
});

test("K224-UI-008 振り分け：見出し「振り分け」14px・幅 1440 は 2 列（担当者の右に AI に任せる）・各行の項目名の列は 96px", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const sec = page.getByRole("region", { name: "振り分け" });
  await expect(sec.getByRole("heading", { name: "振り分け" })).toBeVisible();
  expect(await sec.getByRole("heading", { name: "振り分け" }).evaluate((e) => getComputedStyle(e).fontSize)).toBe(
    "14px",
  );
  const a = (await sec.getByRole("combobox", { name: "担当者" }).boundingBox())!;
  const ai = (await sec.getByRole("combobox", { name: "AI に任せる" }).boundingBox())!;
  expect(Math.abs(a.y - ai.y)).toBeLessThanOrEqual(2); // キャンバスの順で 2 列：1 行目は 担当者｜AI に任せる
  expect(ai.x).toBeGreaterThan(a.x + a.width);
  const row = (await sec.locator(".k-create-assign-row").first().boundingBox())!;
  expect(Math.round(a.x - row.x)).toBeGreaterThanOrEqual(96 + 8 - 1); // 項目名の列 96 と間 8
});

test("K224-UI-009 幅 375：振り分けは 1 列（担当者の下に期限）", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page, 375);
  await loaded(page);
  const sec = page.getByRole("region", { name: "振り分け" });
  const a = (await sec.getByRole("combobox", { name: "担当者" }).boundingBox())!;
  const d = (await sec.getByRole("textbox", { name: "期限", exact: true }).boundingBox())!;
  expect(d.y).toBeGreaterThan(a.y + a.height - 1);
});

test("K224-UI-010 作る前に：見出し 13px。書いた欄は ✓ と緑（#166534）、まだの欄は緑でない", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const before = page.getByRole("region", { name: "作る前に" });
  expect(await before.getByRole("heading", { name: "作る前に" }).evaluate((e) => getComputedStyle(e).fontSize)).toBe(
    "13px",
  );
  await page.getByRole("textbox", { name: "題名", exact: true }).fill("請求書を送る");
  const done = before.locator('[data-ok="true"]', { hasText: "題名" });
  await expect(done).toContainText("✓");
  expect(await done.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(22, 101, 52)");
  const yet = before.locator('[data-ok="false"]', { hasText: "期限" });
  expect(await yet.evaluate((e) => getComputedStyle(e).color)).not.toBe("rgb(22, 101, 52)");
});

test("K224-UI-011 足元の帯：画面の下に貼り付き、説明・「下書きのまま閉じる」・主「作る」の順", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page, 1440);
  await loaded(page);
  const foot = page.locator(".k-create-foot");
  expect(await foot.evaluate((e) => getComputedStyle(e).position)).toBe("sticky");
  const f = (await foot.boundingBox())!;
  expect(Math.abs(f.y + f.height - 900)).toBeLessThanOrEqual(1); // 一番上にいるときも画面の下の端に見える
  await expect(foot).toContainText("作るとチケットになり、担当者に知らせが届きます");
  const names = await foot.getByRole("button").allInnerTexts();
  expect(names.map((x) => x.trim())).toEqual(["下書きのまま閉じる", "作る"]);
  await expect(foot.getByRole("button", { name: "作る", exact: true })).toHaveAttribute("data-variant", "primary");
  await expect(foot.getByRole("button", { name: "下書きのまま閉じる" })).toHaveAttribute("data-variant", "outlined");
});

test("K224-UI-012 本文の主ボタンは「作る」1 つだけ", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const primaries = page.locator('#k-main .k-btn[data-variant="primary"]');
  await expect(primaries).toHaveCount(1);
  await expect(primaries).toHaveText("作る");
});

test("K224-UI-013 「下書きのまま閉じる」：作る面が閉じて /tickets・下書きは消さず、開き直すと続きが出る。前の保存の答えを待つ間に続けて打った字も、閉じる前にサーバーへ残す", async ({
  page,
}) => {
  // 時計を止めて、書いてから少し待って送る保存（600ms）を試験が進めた分だけ進める（決めた時間は待たない）
  const t0 = new Date("2026-11-16T10:00:00+09:00");
  await page.clock.install({ time: t0 });
  await page.clock.pauseAt(t0);
  const m = await mockCreate(page);
  // 1 回目の保存の答えを止めておき、答える前に続けて打つ
  const first = gate();
  let posts = 0;
  await page.route(/\/api\/v1\/me\/ticket-drafts$/, async (route) => {
    if (route.request().method() === "POST" && posts++ === 0) await first.wait;
    await route.fallback();
  });
  await openCreate(page);
  await loaded(page);
  const title = page.getByRole("textbox", { name: "題名", exact: true });
  await title.fill("閉じる前");
  await page.clock.runFor(600);
  await expect.poll(() => posts).toBe(1);
  await title.fill("閉じる前の題名"); // 次の保存は、まだ時計を進めていないので待っている
  first.open();
  await expect(page.locator('header.k-page-head [role="status"][aria-label="下書きの保存"]')).toContainText(
    "保存しました",
  ); // 1 回目の答えが届いた
  await page.getByRole("button", { name: "下書きのまま閉じる" }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(form(page)).toHaveCount(0);
  // 閉じる前に続けて打った字までサーバーに残っている（閉じた時点で待っていた保存を捨てない）
  await expect.poll(() => m.drafts.some((d) => JSON.stringify(d.body).includes("閉じる前の題名"))).toBe(true);
  await page.evaluate(() => window.localStorage.clear()); // この PC の写しから戻らないようにして、サーバーに残っていることを見る
  await page.goto("/tickets?new=1");
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("閉じる前の題名");
  expect(m.draftDeletes).toBe(0);
});

test("K224-UI-014 書きかけの読み込み：帯はすぐ出る・文は 2 秒では出ず 3 秒を過ぎると出る（3 秒たっても終わらないときだけ・D-144.8）・読み終えるまで欄を出さない", async ({
  page,
}) => {
  const slow = gate();
  // 時刻を決めて入れ、開く前からその時刻で止める（画面の今の時刻を読んでから止めると、読んだ後に進んだ分で「過去へは止められない」になる）。
  //   止めたまま開くので、読み込みの文の 3 秒の時計は試験が進めた分だけ進む
  const t0 = new Date("2026-11-16T10:00:00+09:00");
  await page.clock.install({ time: t0 });
  await page.clock.pauseAt(t0);
  await mockCreate(page, { holdDrafts: slow.wait });
  await openCreate(page);
  await expect(page.locator("header.k-page-head h1")).toHaveText("チケットを作る");
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveCount(0);
  await page.clock.runFor(2000);
  await expect(page.getByText("書きかけを読み込んでいます")).toHaveCount(0);
  await page.clock.runFor(1100);
  await expect(page.getByText("書きかけを読み込んでいます…")).toBeVisible();
  slow.open();
  await loaded(page);
  await expect(page.getByText("書きかけを読み込んでいます")).toHaveCount(0);
});

test("K224-UI-015 作ったことを知らせる人：名前で絞り込む欄に「佐」と打つと佐藤だけが出て、選ぶと作る口に佐藤の id が届く。絞り込む欄の Enter では作らない", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  await fillRequired(page); // 必須が埋まっていても、絞り込む欄の Enter では作らない
  const filter = page.getByRole("textbox", { name: "作ったことを知らせる人" });
  await expect(filter).toHaveAttribute("placeholder", /名前で絞り込む/);
  await filter.fill("佐");
  await expect(page.getByRole("checkbox", { name: "山田" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "佐藤" }).check();
  await expect(page.getByRole("button", { name: "佐藤 を外す" })).toBeVisible();
  await filter.press("Enter");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/);
  expect(m.creates).toHaveLength(1); // Enter で 1 回作っていれば 2 回になる（または「作る」を押す前に画面が移る）
  expect(m.creates[0]!["notify_member_ids"]).toEqual([BOSS]);
  expect(m.creates[0]!["assignee_member_id"]).toBe(ME);
});

test("K224-UI-016 親のチケット：「月次」と打つと一覧の口を q=月次・view=all で 1 回引き、候補が出る。3 段目は選べず、選んだ親が作る口に届く", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const before = m.listCalls.length;
  const parent = page.getByRole("combobox", { name: "親のチケット" });
  await parent.pressSequentially("月次", { delay: 30 });
  await expect(page.getByRole("option", { name: /EG-101/ })).toBeVisible();
  const calls = m.listCalls.slice(before);
  expect(calls.map((q) => [q.get("q"), q.get("view")])).toEqual([["月次", "all"]]);
  await expect(page.getByRole("option", { name: /EG-103/ })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("option", { name: /EG-102/ }).click();
  await fillRequired(page, "子のチケット");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["parent_ticket_id"]).toBe("p2");
});

test("K224-UI-017 右の「高本のAI から」：箱と見出しは在り、AI の文は 1 字も出ない（D-145.6）", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const hint = page.locator("aside.k-create-aside").getByRole("region", { name: "高本のAI から" });
  await expect(hint).toBeVisible();
  await expect(hint.getByRole("heading", { name: "高本のAI から" })).toBeVisible();
  const text = (await hint.innerText()).replace("高本のAI から", "").trim();
  expect(text).toBe("");
});

test("K224-UI-024 ファイルを置く枠：在るが使えない。ファイルを落としても・「ファイルを選ぶ」を押しても付かず、何も送られない（D-145.7）", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const drop = page.locator('[aria-label="ファイルを置く"]');
  await expect(drop).toContainText("ファイルをここに置くか、貼り付ける");
  await expect(drop).toHaveAttribute("aria-disabled", "true");
  expect(Number(await drop.evaluate((e) => getComputedStyle(e).opacity))).toBeCloseTo(DISABLED_OPACITY, 3);
  const pick = drop.getByRole("button", { name: "ファイルを選ぶ" });
  await expect(pick).toBeDisabled();
  const before = m.draftSaves.length;
  const url = page.url();
  // 本物の手で落としたときと同じく dragover → drop を送り、受けない枠でもブラウザの既定の動き（ファイルを開いて画面を離れる）を止めているかを見る
  const prevented = await drop.evaluate((el) => {
    const d = new DataTransfer();
    d.items.add(new File(["x"], "見積.pdf", { type: "application/pdf" }));
    const over = new DragEvent("dragover", { dataTransfer: d, bubbles: true, cancelable: true });
    const put = new DragEvent("drop", { dataTransfer: d, bubbles: true, cancelable: true });
    el.dispatchEvent(over);
    el.dispatchEvent(put);
    return [over.defaultPrevented, put.defaultPrevented];
  });
  expect(prevented).toEqual([true, true]);
  expect(page.url()).toBe(url);
  await expect(page.locator("#k-main").getByText("見積.pdf")).toHaveCount(0);
  await expect(page.locator('#k-main input[type="file"]:not([disabled])')).toHaveCount(0);
  expect(m.draftSaves.length).toBe(before);
  expect(m.creates).toHaveLength(0);
});

test("K224-UI-025 振り分けのまだ使えない欄（AI に任せる・業務の型・予定・分類・節目・取引先）：在るが押せない・値は空・グレー（D-145.9）", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const sec = page.getByRole("region", { name: "振り分け" });
  for (const name of ["AI に任せる", "業務の型", "予定", "分類", "節目", "取引先"]) {
    const field = sec.getByRole("combobox", { name });
    await expect(field, name).toHaveCount(1);
    await expect(field, name).toHaveAttribute("aria-disabled", "true");
    expect((await field.innerText()).replace("▾", "").trim(), name).toBe(""); // 値も「選ぶ」の字も無い（▾ は飾り）
    expect(Number(await field.evaluate((e) => getComputedStyle(e).opacity)), name).toBeCloseTo(DISABLED_OPACITY, 3);
    await field.click({ force: true });
    await expect(page.getByRole("listbox"), name).toHaveCount(0);
  }
});

test("K224-UI-026 担当者の横の「自分」を押すと担当者が自分（高本）になる", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const sec = page.getByRole("region", { name: "振り分け" });
  await sec.getByRole("button", { name: "自分", exact: true }).click();
  await expect(sec.getByRole("combobox", { name: "担当者" })).toContainText("高本");
});

test("K224-UI-018 幅 375：箱は左右 24px 内側（題名の欄が画面の端に付かない）", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page, 375);
  await loaded(page);
  const c = await box(page, ".k-create-cards");
  expect(Math.round(c.x)).toBe(24);
  expect(Math.round(375 - (c.x + c.width))).toBe(24);
});

test("K224-UI-019 幅 320・375・768・1024・1440 で横溢れ 0", async ({ page }) => {
  await mockCreate(page);
  const bad: string[] = [];
  for (const w of WIDTHS) {
    await openCreate(page, w);
    await loaded(page);
    const o = await overflowX(page);
    if (o !== 0) bad.push(`幅 ${w}：${o}px`);
  }
  expect(bad).toEqual([]);
});

test("K224-UI-020 幅 375・1440：本文の押せるものは 24px 以上", async ({ page }) => {
  await mockCreate(page);
  for (const w of [375, 1440]) {
    await openCreate(page, w);
    await loaded(page);
    const small = await page.$$eval("#k-main a[href], #k-main button, #k-main input, #k-main [role=combobox]", (els) =>
      els
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            (r.width < 24 || r.height < 24) &&
            (e as HTMLInputElement).type !== "checkbox"
          );
        })
        .map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim()),
    );
    expect(small, `幅 ${w}`).toEqual([]);
  }
});

test("K224-UI-021 台帳：作る画面の .k-panel の流用と k-check の行が無い", () => {
  const ledger = JSON.parse(readFileSync(join(ROOT, "scripts/ci/class_ledger.json"), "utf8")) as {
    entries: { cls: string; file: string }[];
  };
  const left = ledger.entries.filter(
    (e) => e.file === "apps/web/features/F4/create-ticket/create-ticket.tsx" && ["k-panel", "k-check"].includes(e.cls),
  );
  expect(left).toEqual([]);
});

interface Group {
  id: string;
  canvas: string;
  app: string;
  state: string;
  widths: number[];
  pairs: FidelityPair[];
  owner: string;
  enrolled: boolean;
}
const CFG = JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: Group[] };
const G = CFG.groups.find((x) => x.id === "tickets-new");

test("K224-UI-022 突き合わせの設定：tickets-new が enrolled・持ち主 K-224・画面の側のセレクタに .k-panel が無い・画面を整える道具に鍵", () => {
  expect(G).toBeTruthy();
  expect(G!.enrolled).toBe(true);
  expect(G!.owner).toBe("K-224");
  for (const p of G!.pairs) expect(p.app, p.name).not.toContain(".k-panel");
  expect(FIDELITY_STATES[G!.state]).toBeTruthy();
});

for (const w of G?.widths ?? [1440]) {
  test(`K224-UI-023 tickets-new（Create）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
    expect(G).toBeTruthy();
    const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
    await routeCanvasFonts(canvasPage);
    await canvasPage.goto(pathToFileURL(join(ROOT, `04_design/canvas/${G!.canvas}.dc.html`)).href);
    for (const p of G!.pairs) await canvasPage.locator(p.canvas).first().waitFor({ state: "visible" });
    await canvasPage.evaluate(() => document.fonts.ready);
    const canvasVals = await readVals(canvasPage, G!.pairs, "canvas");
    const canvasFonts = await loadedFonts(canvasPage);
    await canvasPage.close();

    const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
    await appPage.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
    await FIDELITY_STATES[G!.state]!(appPage, G!.app);
    for (const p of G!.pairs) await appPage.locator(p.app).first().waitFor({ state: "visible" });
    await appPage.evaluate(() => document.fonts.ready);
    const appVals = await readVals(appPage, G!.pairs, "app");
    const appFonts = await loadedFonts(appPage);
    await appPage.close();

    const rows = [...compareRows(G!.pairs, canvasVals, appVals), compareFonts(canvasFonts, appFonts)];
    const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
    expect(mismatches(rows), bad.join("\n")).toBe(0);
  });
}

test("K224-UI-027 幅 375・320：帯の h1「チケットを作る」と題名の欄の左の端が画面の中（左へのはみ出しは scrollWidth − clientWidth に出ないので getBoundingClientRect で見る）", async ({
  page,
}) => {
  await mockCreate(page);
  for (const w of [375, 320]) {
    await openCreate(page, w);
    await loaded(page);
    const h1 = await page.locator("header.k-page-head h1").evaluate((e) => e.getBoundingClientRect().left);
    expect(h1, `幅 ${w} の h1`).toBeGreaterThanOrEqual(0);
    const title = await page
      .getByRole("textbox", { name: "題名", exact: true })
      .evaluate((e) => e.getBoundingClientRect().left);
    expect(title, `幅 ${w} の題名の欄`).toBeGreaterThanOrEqual(0);
    const firstChar = await page.locator("header.k-page-head h1").evaluate((e) => {
      const r = document.createRange();
      r.setStart(e.firstChild!, 0);
      r.setEnd(e.firstChild!, 1);
      return r.getBoundingClientRect().left;
    });
    expect(firstChar, `幅 ${w} の h1 の 1 文字目`).toBeGreaterThanOrEqual(0);
  }
});

test("K224-UI-028 親のチケット：口が落ちると欄の下に「候補を読み込めませんでした」で親なしで作れる・0 件は「見つかりません」・選んだ親は外せる・下書きから戻した親は番号と題名・101 字は打てない・作る口が親を断ると理由を欄の下に出す", async ({
  page,
}) => {
  const m = await mockCreate(page, { listStatus: 500 });
  await openCreate(page);
  await loaded(page);
  const parent = page.getByRole("combobox", { name: "親のチケット" });
  // (a) 口が落ちた
  await parent.pressSequentially("月次", { delay: 30 });
  await expect(page.getByText("候補を読み込めませんでした")).toBeVisible();
  await fillRequired(page, "親なしで作る");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["parent_ticket_id"] ?? null).toBeNull();
  // 作った後は詳細へ移る。移り終えてから次の開き直しへ進む（移る途中に開き直すと goto とぶつかって揺れる）
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/);
  // (b) 0 件・(c) 選んで外す
  const m2 = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const p2 = page.getByRole("combobox", { name: "親のチケット" });
  await p2.pressSequentially("該当なし", { delay: 30 });
  await expect(page.getByText("見つかりません")).toBeVisible();
  await p2.fill("");
  await p2.pressSequentially("月次", { delay: 30 });
  await page.getByRole("option", { name: /EG-102/ }).click();
  await page.getByRole("button", { name: "親を外す" }).click();
  await fillRequired(page, "外した");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect.poll(() => m2.creates.length).toBe(1);
  expect(m2.creates[0]!["parent_ticket_id"] ?? null).toBeNull();
  // 作った後は詳細へ移る。移り終えてから次の開き直しへ進む（移る途中に開き直すと goto とぶつかって揺れる）
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/);
  // (d) 下書きから戻した親
  await mockCreate(page, {
    drafts: [{ draft_id: "d1", body: { title: "戻した", parent_ticket_id: "p2" }, saved_at: "2026-11-16T01:42:00Z" }],
  });
  await page.evaluate(() => window.localStorage.clear());
  await openCreate(page);
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("戻した");
  await expect(page.getByRole("combobox", { name: "親のチケット" })).toHaveValue(/EG-102/);
  // (e) 101 字
  const m4 = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const p4 = page.getByRole("combobox", { name: "親のチケット" });
  await p4.fill("あ".repeat(101));
  expect([...(await p4.inputValue())].length).toBe(100);
  await expect.poll(() => m4.listCalls.length).toBeGreaterThan(0);
  expect(m4.listCalls.every((q) => [...(q.get("q") ?? "")].length <= 100)).toBe(true);
  // (f) 作る口が親を断った（E-VAL-015・親子は 3 段まで）：正本の理由を親の欄のすぐ下に出し、欄は aria-invalid。答えは本物と同じ形（fromCatalog）
  await mockCreate(page);
  await page.route(/\/api\/v1\/tickets$/, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: "validation",
            code: "E-VAL-015",
            field: "parent_ticket_id",
            message: TOO_DEEP,
            details: [{ field: "parent_ticket_id", message: TOO_DEEP }],
          }),
        })
      : route.fallback(),
  );
  await openCreate(page);
  await loaded(page);
  const p5 = page.getByRole("combobox", { name: "親のチケット" });
  await p5.pressSequentially("月次", { delay: 30 });
  await page.getByRole("option", { name: /EG-102/ }).click();
  await fillRequired(page, "断られる親");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(p5).toHaveAttribute("aria-invalid", "true");
  // 理由は aria-describedby の先の、目に見える・親の欄と同じ行の中・欄のすぐ下の要素に出る（下の知らせの箱だけに出るのでは足りない）
  const where = await p5.evaluate((el, text) => {
    const box = el.getBoundingClientRect();
    return (el.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => !!e && (e.textContent ?? "").includes(text))
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          visible: r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden",
          below: r.top >= box.bottom - 1,
          sameRow: e.closest(".k-create-assign-row") === el.closest(".k-create-assign-row"),
        };
      });
  }, TOO_DEEP);
  expect(where).toEqual([{ visible: true, below: true, sameRow: true }]);
});

test("K224-UI-029 幅 375：足元の帯は下のタブの上に乗り、「作る」が見えて押せる（押すと作る口が 1 回）", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page, 375);
  await loaded(page);
  const tabs = (await page.getByRole("navigation", { name: "下のタブ" }).boundingBox())!;
  const make = page.locator(".k-create-foot").getByRole("button", { name: "作る", exact: true });
  const b = (await make.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(tabs.y + 1);
  await fillRequired(page);
  await make.click();
  await expect.poll(() => m.creates.length).toBe(1);
});
