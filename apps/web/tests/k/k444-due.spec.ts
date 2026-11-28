// K-444「画面：作る面の期限を決める小窓」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f4 の f4-due-dialog・f4-due-past（下絵・2026-11-20）。
//   詳細で期限を変える小窓（理由が必須・期限をなくす・失敗の出し方）は段 8 の K-483（口）・K-484（画面）の持ち物で、この葉は作る面だけ。
//   口は網の手前で差し替える（前からの土台 create-mock.ts の mockCreate。作る口の createTicket の `due_on` は今ある口）。
//   作る面は下書きから戻した値（期限以外の必須）で開く。置き場所（2026-11-21・新しい形）：期限の欄は項目の表の「期限」の行（K-442 の DueSlot）。
//   下書きの形は K-442 の新しい形（sections は無い）。時計は 2026-11-23（月）10:00（日本時間）に止める。
//   今日は日本時間の日付で、小窓を開くたびに数える。期限は日付だけ（時刻の行は押せない形）・過去は選べない。
//   固定の待ちは使わない（要素と答えを待つ）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
import { ME, SCOPE, TASK, loaded, mockCreate, openCreate, overflowX, settledDetail } from "./create-mock";
import { DUE_PAIRS, errReply, msgOf } from "./due-create-mock";
import { countWrites } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const NOW = "2026-11-23T10:00:00+09:00";
const BODY = {
  title: "請求書を送る",
  scope_id: SCOPE,
  kind_id: TASK,
  assignee_member_id: ME,
  priority: "mid",
  notify_member_ids: [],
};

/** 期限の欄は日付の入力（textbox「期限」・キーボードで打てる）と、欄の右の早見のボタン「期限の早見」（押すと小窓）。どちらで入れても同じ値（D-150.53） */
const dueBox = (p: Page) => p.getByRole("textbox", { name: "期限", exact: true });
const dueBtn = (p: Page) => p.getByRole("button", { name: "期限の早見", exact: true });
/** 項目の表の「期限」の行（左の名前に必須の印・右が欄） */
const duePair = (p: Page) => p.locator(".k-f4d-pair").filter({ has: dueBox(p) });
const dlgC = (p: Page) => p.getByRole("dialog", { name: "期限を決める", exact: true });
const day = (d: Locator, name: string) => d.getByRole("button", { name, exact: true });
const quick = (d: Locator, label: string) => d.getByRole("button", { name: new RegExp(`^${label}`) });
const ok0 = (d: Locator, text: string) => d.getByRole("button", { name: text, exact: true });
const cancel = (d: Locator) => d.getByRole("button", { name: "やめる", exact: true });
const makeBtn = (p: Page) => p.getByRole("button", { name: "作る", exact: true });

async function createWith(page: Page, over: Record<string, unknown> = {}, o: { now?: string; width?: number } = {}) {
  await page.clock.setFixedTime(o.now ?? NOW);
  const m = await mockCreate(page, {
    drafts: [
      {
        draft_id: "0193c5a0-0000-7000-8000-00000000c4d1",
        body: { ...BODY, ...over },
        saved_at: "2026-11-16T01:42:00Z",
      },
    ],
  });
  await openCreate(page, o.width ?? 1440);
  await loaded(page);
  return m;
}
// ================================================================ 作る面
test("K444-UI-001 入口：作る面の期限の欄は日付の入力（必須の印つき）と右の「期限の早見」ボタン。ボタンを押すと小窓「期限を決める」（すぐ決める 4 つ・カレンダー・時刻の行は押せない・「決める」は押せない）が開く。口は呼ばない", async ({
  page,
}) => {
  const m = await createWith(page, { due_on: undefined });
  const writes = countWrites(page);
  await expect(dueBox(page)).toHaveValue("");
  await expect(dueBtn(page)).toBeVisible();
  await expect(duePair(page).locator(".k-f4d-req-mark")).toHaveCount(1);
  await expect(duePair(page).locator(".k-req")).toHaveCount(0);
  await dueBtn(page).click();
  const d = dlgC(page);
  await expect(d).toBeVisible();
  for (const l of ["今日", "明日", "今週の金曜", "来週の月曜"]) await expect(quick(d, l)).toBeVisible();
  await expect(d.getByRole("group", { name: "カレンダー" })).toBeVisible();
  const time = d.locator(".k-f4-due-time");
  await expect(time).toHaveAttribute("aria-disabled", "true");
  await expect(time).toHaveAttribute("title", "まだ使えません");
  await expect(ok0(d, "決める")).toBeDisabled();
  await expect(cancel(d)).toBeEnabled();
  expect(writes.n).toBe(0);
  expect(m.creates).toEqual([]);
});

test("K444-UI-002 入力：すぐ決める 4 つは今日 11/23（月）・明日 11/24（火）・今週の金曜 11/27（金）・来週の月曜 11/30（月）。押すと選ばれ、「11/27 にする」が押せる", async ({
  page,
}) => {
  await createWith(page, { due_on: undefined });
  await dueBtn(page).click();
  const d = dlgC(page);
  const want: [string, string][] = [
    ["今日", "11/23（月）"],
    ["明日", "11/24（火）"],
    ["今週の金曜", "11/27（金）"],
    ["来週の月曜", "11/30（月）"],
  ];
  for (const [l, date] of want) await expect(quick(d, l)).toContainText(date);
  await quick(d, "今週の金曜").click();
  await expect(quick(d, "今週の金曜")).toHaveAttribute("aria-pressed", "true");
  await expect(ok0(d, "11/27 にする")).toBeEnabled();
});

test("K444-UI-003 時間の流れ：今日が金曜（11/27）のとき、今週の金曜は今日と同じ 11/27（金）・明日は 11/28（土）・来週の月曜は 11/30（月）", async ({
  page,
}) => {
  await createWith(page, { due_on: undefined }, { now: "2026-11-27T10:00:00+09:00" });
  await dueBtn(page).click();
  const d = dlgC(page);
  await expect(quick(d, "今日")).toContainText("11/27（金）");
  await expect(quick(d, "今週の金曜")).toContainText("11/27（金）");
  await expect(quick(d, "明日")).toContainText("11/28（土）");
  await expect(quick(d, "来週の月曜")).toContainText("11/30（月）");
});

test("K444-UI-004 入力：カレンダーは今月から。今日の日に印があり、前の月は押せない。次の月で 12 月になり、12/01 を押すと「12/01 にする」が押せる", async ({
  page,
}) => {
  await createWith(page, { due_on: undefined });
  await dueBtn(page).click();
  const d = dlgC(page);
  await expect(d.getByText("2026年 11月", { exact: true })).toBeVisible();
  await expect(day(d, "11月23日（月）")).toHaveAttribute("aria-current", "date");
  await expect(day(d, "前の月")).toHaveAttribute("aria-disabled", "true");
  await day(d, "次の月").click();
  await expect(d.getByText("2026年 12月", { exact: true })).toBeVisible();
  await day(d, "12月1日（火）").click();
  await expect(day(d, "12月1日（火）")).toHaveAttribute("aria-pressed", "true");
  await expect(ok0(d, "12/01 にする")).toBeEnabled();
});

test("K444-UI-005 守り：今日より前の日（11/20）は押せない形（理由が title）。押すと選ばれず、赤い理由「期限は今日か、それより後の日にしてください」が出て「決める」は押せない。今日以降の日を選ぶと理由が消える", async ({
  page,
}) => {
  await createWith(page, { due_on: undefined });
  await dueBtn(page).click();
  const d = dlgC(page);
  const past = day(d, "11月20日（金）");
  await expect(past).toHaveAttribute("aria-disabled", "true");
  await expect(past).toHaveAttribute("title", "今日より前の日は選べません");
  await past.click({ force: true });
  await expect(d.getByRole("alert")).toHaveText(msgOf("E-VAL-012"));
  await expect(past).toHaveAttribute("aria-pressed", "false");
  await expect(ok0(d, "決める")).toBeDisabled();
  await day(d, "11月24日（火）").click();
  await expect(d.getByRole("alert")).toHaveCount(0);
  await expect(ok0(d, "11/24 にする")).toBeEnabled();
});

test("K444-UI-006 入力：12/01 を選んで「12/01 にする」を押すと小窓が閉じ、欄が「12/01（火）」になり、作ると作る口に due_on が 2026-12-01 で届く（口は作る 1 回）", async ({
  page,
}) => {
  const m = await createWith(page, { due_on: undefined });
  await dueBtn(page).click();
  const d = dlgC(page);
  await day(d, "次の月").click();
  await day(d, "12月1日（火）").click();
  await ok0(d, "12/01 にする").click();
  await expect(dlgC(page)).toHaveCount(0);
  await expect(dueBox(page)).toHaveValue("2026-12-01");
  // 決めた期限は下書きに残る（書きかけで戻っても続きから）
  await expect
    .poll(() => m.draftSaves.some((b) => (b["body"] as Record<string, unknown>)["due_on"] === "2026-12-01"))
    .toBe(true);
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["due_on"]).toBe("2026-12-01");
  await settledDetail(page);
});

test("K444-UI-007 入力：値がある欄を開くと、その月が出て選ばれた日に印があり「12/01 にする」が押せる。別の日を選んでも「やめる」なら欄は変わらず、作る口へも元の日が届く", async ({
  page,
}) => {
  const m = await createWith(page, { due_on: "2026-12-01" });
  await expect(dueBox(page)).toHaveValue("2026-12-01");
  await dueBtn(page).click();
  const d = dlgC(page);
  await expect(d.getByText("2026年 12月", { exact: true })).toBeVisible();
  await expect(day(d, "12月1日（火）")).toHaveAttribute("aria-pressed", "true");
  await expect(ok0(d, "12/01 にする")).toBeEnabled();
  await day(d, "12月3日（木）").click();
  await expect(ok0(d, "12/03 にする")).toBeEnabled();
  await cancel(d).click();
  await expect(dlgC(page)).toHaveCount(0);
  await expect(dueBox(page)).toHaveValue("2026-12-01");
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["due_on"]).toBe("2026-12-01");
  await settledDetail(page);
});

test("K444-UI-008 時間の流れ（切り替わりの瞬間）：今日は日本時間の日付。日本時間 11/22 23:59 に開くと今日は 11/22（日）、0:00 を過ぎて開き直すと 11/23（月）", async ({
  page,
}) => {
  await createWith(page, { due_on: undefined }, { now: "2026-11-22T14:59:00Z" });
  await dueBtn(page).click();
  await expect(quick(dlgC(page), "今日")).toContainText("11/22（日）");
  await cancel(dlgC(page)).click();
  await expect(dlgC(page)).toHaveCount(0);
  await page.clock.setFixedTime("2026-11-22T15:00:00Z");
  await dueBtn(page).click();
  await expect(quick(dlgC(page), "今日")).toContainText("11/23（月）");
});

test("K444-UI-009 失敗：作る口が期限を断ると（409・E-VAL-012・欄なし・開いたまま日が替わった）、画面が code で決めて正本の理由を期限の欄のすぐ下に出し、欄は aria-invalid、書いた中身は残る", async ({
  page,
}) => {
  const m = await createWith(page, { due_on: "2026-12-01" });
  await page.route(/\/api\/v1\/tickets$/, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify(errReply(409, "E-VAL-012").body),
        })
      : route.fallback(),
  );
  await makeBtn(page).click();
  const row = duePair(page);
  await expect(row.getByText(msgOf("E-VAL-012"), { exact: true })).toBeVisible();
  await expect(dueBox(page)).toHaveAttribute("aria-invalid", "true");
  await expect(dueBox(page)).toHaveValue("2026-12-01");
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("請求書を送る");
  expect(m.creates).toEqual([]);
});

test("K444-UI-010 入口：下書きから戻した過去の期限（11/20）は欄に出て、作ると口へ送らず欄の下に正本の理由が出る。小窓は選び直す形で開き（赤い理由・選ばれた日なし）、11/24 を選ぶと作れる", async ({
  page,
}) => {
  const m = await createWith(page, { due_on: "2026-11-20" });
  await expect(dueBox(page)).toHaveValue("2026-11-20");
  await makeBtn(page).click();
  const row = duePair(page);
  await expect(row.getByText(msgOf("E-VAL-012"), { exact: true })).toBeVisible();
  expect(m.creates).toEqual([]);
  await dueBtn(page).click();
  const d = dlgC(page);
  await expect(d.getByText("2026年 11月", { exact: true })).toBeVisible();
  await expect(d.getByRole("alert")).toHaveText(msgOf("E-VAL-012"));
  await expect(ok0(d, "決める")).toBeDisabled();
  await day(d, "11月24日（火）").click();
  await ok0(d, "11/24 にする").click();
  await expect(dlgC(page)).toHaveCount(0);
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["due_on"]).toBe("2026-11-24");
  await settledDetail(page);
});

test("K444-UI-011 入口：キーボードで開き（Enter）、Esc で閉じて焦点が期限の欄に戻る", async ({ page }) => {
  await createWith(page, { due_on: undefined });
  await dueBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(dlgC(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlgC(page)).toHaveCount(0);
  await expect(dueBtn(page)).toBeFocused();
});

test("K444-UI-012 入力：幅 1440・768・375 のどれでも、作る面の小窓を開いて 12/01 を選んだ状態で横溢れ 0・小窓は画面の中（左右の端と足のボタンが画面の内側）", async ({
  page,
}) => {
  await createWith(page, { due_on: "2026-12-01" });
  await dueBtn(page).click();
  await expect(dlgC(page)).toBeVisible();
  for (const w of [1440, 768, 375]) {
    await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    const vh = page.viewportSize()!.height;
    const b = (await dlgC(page).boundingBox())!;
    expect(b.x, `幅 ${w} の小窓の左`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `幅 ${w} の小窓の右`).toBeLessThanOrEqual(w);
    const f = (await ok0(dlgC(page), "12/01 にする").boundingBox())!;
    expect(f.y + f.height, `幅 ${w} の足のボタン`).toBeLessThanOrEqual(vh);
    expect(await overflowX(page), `幅 ${w} の横溢れ`).toBe(0);
  }
});

// ================================================================ モックとの突き合わせ（共通の道具 matchMock・base は /dev/mock/f4）
const STATES: Record<string, (page: Page, w: number) => Promise<void>> = {
  "f4-due-dialog": async (page, w) => {
    await createWith(page, { due_on: "2026-12-01", start_on: "2026-11-30" }, { width: w });
    await dueBtn(page).click();
    await expect(dlgC(page)).toBeVisible();
  },
  "f4-due-past": async (page, w) => {
    await createWith(page, { due_on: undefined }, { width: w });
    await dueBtn(page).click();
    await day(dlgC(page), "11月20日（金）").click({ force: true });
    await expect(dlgC(page).getByRole("alert")).toBeVisible();
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K444-UI-013 ${id} 幅 ${w}：小窓（箱・頭・すぐ決める・月・日・時刻・理由・欄・ボタン）の値がモックと同じ`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await drive(page, w);
          await page.evaluate(() => {
            window.scrollTo(0, 0);
            document.querySelectorAll(".k-dialog-body").forEach((e) => {
              e.scrollTop = 0;
            });
          });
        },
        { pairs: DUE_PAIRS, base: "/dev/mock/f4", blur: true },
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("dialog");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K444-UI-014 入力：期限の欄に 2026-12-01 と直に打つと口へ届く値になり、小窓は開かない。小窓で 12/01 を選んでも欄は同じ値（どちらで入れても同じ）", async ({
  page,
}) => {
  const m = await createWith(page, { due_on: undefined });
  await dueBox(page).fill("2026-12-01");
  await expect(dueBox(page)).toHaveValue("2026-12-01");
  await expect(dlgC(page)).toHaveCount(0);
  await expect.poll(() => JSON.stringify(m.draftSaves.at(-1) ?? {})).toContain("2026-12-01");
  await dueBox(page).fill("");
  await dueBtn(page).click();
  await day(dlgC(page), "11月24日（火）").click();
  await ok0(dlgC(page), "11/24 にする").click();
  await expect(dueBox(page)).toHaveValue("2026-11-24");
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["due_on"]).toBe("2026-11-24");
});

test("K444-UI-015 守り：欄に今日より前（2026-11-20）を打つと欄の下に正本の理由が出て（暦に無い日は入力が空になり「作る」が止まる）、直すと消える。口へは行かない", async ({
  page,
}) => {
  const m = await createWith(page, { due_on: undefined });
  await dueBox(page).fill("2026-11-20");
  await dueBox(page).blur();
  await expect(duePair(page).getByText(msgOf("E-VAL-012"), { exact: true })).toBeVisible();
  await makeBtn(page).click();
  expect(m.creates).toEqual([]);
  await dueBox(page).fill("2026-11-25");
  await expect(duePair(page).getByText(msgOf("E-VAL-012"), { exact: true })).toHaveCount(0);
});
