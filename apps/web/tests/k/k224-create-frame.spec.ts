// K-224「チケットを作る画面の器」の画面の試験（実 Chrome）。K-442（2026-11-21 の作り直し）で、キャンバス Create（白い箱 3 つ・右の「作る前に」・足元の帯・振り分け）に合わせた行を外し、
//   新しい並び（下絵 v2 の作る面：頭に「作る」・本文 1 枚・項目の表）でも変わらない行だけを残した。並び・字・見た目の突き合わせは k442-create-body.spec.ts（K442-UI-001・024・025）が下絵 v2 と持つ。
//   外した行：UI-001・002（箱の並びと「作る前に」の置き場）・006〜010（箱の寸法・振り分け・作る前に）・017（右の「〈名前〉のAI から」）・018（箱の余白）・021〜023（キャンバスとの突き合わせ。
//   組 tickets-new は 04_design/fidelity.json から外す）・025（振り分けの押せない欄は項目の表 K-569 が持つ）。UI-011 は足元の帯から頭の右（下書きのまま閉じる・作る）に替えた。
//   口は網の手前で差し替える（tests/k/create-mock.ts）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test } from "@playwright/test";
import { BOSS, ME, css, fillRequired, form, gate, loaded, mockCreate, openCreate, overflowX } from "./create-mock";

const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const DISABLED_OPACITY = 0.55; // 数で比べる（本番の組み立ては CSS を縮めて ".55" と書くことがある）

test("K224-UI-003 帯：h1「チケットを作る」18px・700。一覧の h1「チケット」は出ず、h1 は 1 つ", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page);
  const h1 = page.locator("header.k-page-head h1");
  await expect(h1).toHaveText("チケットを作る");
  expect(await css(page, "header.k-page-head h1", "font-size")).toBe("18px");
  expect(await css(page, "header.k-page-head h1", "font-weight")).toBe("700");
  await expect(page.locator("h1")).toHaveCount(1);
});

test("K224-UI-004 作り方：自分で書く が今いる（aria-current）・AI と話して作る は押せるボタン（K-767・D-153.17 で押せる形にした・押した後は K767 の試験が受ける）（過去のチケットから複製 は K-446 が押せる形にした・K446-UI-015 が受ける）・目に見える「準備中」は無い", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const how = page.locator('header.k-page-head [aria-label="作り方"]');
  await expect(how.locator('[aria-current="true"]')).toHaveText("自分で書く");
  const ai = how.getByRole("button", { name: "AI と話して作る", exact: true });
  await expect(ai).toBeEnabled();
  await expect(ai).not.toHaveAttribute("aria-disabled", "true");
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

test("K224-UI-026 担当者の横の「私が担当」を押すと担当者が自分（高本）になる（下絵 v2 の字。前の「自分」から替えた）", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  await page.getByRole("combobox", { name: "担当者" }).click();
  await page.getByRole("option", { name: "山田", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "担当者" })).toContainText("山田");
  await page.getByRole("button", { name: "私が担当", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "担当者" })).toContainText("高本");
});

test("K224-UI-011 頭の右：「下書きのまま閉じる」（outlined）と主「作る」（primary）がこの順で並び、作る面に主ボタンは 1 つ。足元の帯は無い", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page, 1440);
  await loaded(page);
  const head = page.locator("header.k-page-head");
  const names = await head.getByRole("button").allInnerTexts();
  expect(names.map((x) => x.trim()).filter((x) => x === "下書きのまま閉じる" || x === "作る")).toEqual([
    "下書きのまま閉じる",
    "作る",
  ]);
  await expect(head.getByRole("button", { name: "作る", exact: true })).toHaveAttribute("data-variant", "primary");
  await expect(head.getByRole("button", { name: "下書きのまま閉じる" })).toHaveAttribute("data-variant", "outlined");
  await expect(page.locator(".k-create-foot")).toHaveCount(0);
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

test("K224-UI-029 幅 375：頭の「作る」が見えて押せる（押すと作る口が 1 回）。足元の帯は無いので下のタブに隠れない", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page, 375);
  await loaded(page);
  const make = page.locator("header.k-page-head").getByRole("button", { name: "作る", exact: true });
  await expect(make).toBeVisible();
  const b = (await make.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(375);
  await fillRequired(page);
  await make.click();
  await expect.poll(() => m.creates.length).toBe(1);
});
