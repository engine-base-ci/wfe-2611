// K-396「書く欄の「状態 ▾」で、書き込みと一緒に段を変える」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f6/talk-compose-stage（本番と同じ部品 features/F6/thread/views.tsx の Composer・StageSelect。選ぶ物は頭の段の札と同じ色つきの札 StageTag）。
//   保留を選んだときの欄（保留の理由・再開の条件）は書く欄の中に出す（正の絵のとおり）。必須の確かめと文は K-395 の保留の小窓と同じ物を使う。
//   書く口の入力（段の欄）と答えの形は口の葉 K-389（createTicketMessage に段の欄）の md に合わせた。段を変えられない時の文は K-387 が正本に足した文。
//   詳細は前からの土台で開き、やり取りの口は共通の道具 thread-mock.ts（K-392 が持つ）で差し替える。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { CATALOG as ENTRIES } from "../../../../packages/errors/src/catalog";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import {
  COMPOSE_PAIRS,
  CREATED,
  MOCK_BASE,
  TAKA_W,
  box,
  err,
  mockThread,
  openThread,
  overflowX,
  panel,
  post,
  postOf,
} from "./thread-mock";

test.use({ timezoneId: "Asia/Tokyo" });

/** 正本の文（生成物 packages/errors/src/catalog.ts・07_qa/test-specs/errors.json から作る）。試験はファイルを読まずに import する */
const CATALOG: Record<string, string> = Object.fromEntries(Object.values(ENTRIES).map((e) => [e.id, e.message]));
const LOCKED_TEXT = "AI が動いている間と承認待ちの間は、状態を変えられません";
const FAILED = "送れませんでした。もう一度お試しください（書いた字は残っています）";
/** 保留の欄ごとの文（K-387 が正本に足す E-VAL-041・E-VAL-047。モック prog-hold-dialog の欄の下と同じ字・確かめは K-395 の progress/hold-fields.ts） */
const HOLD_REASON_REQ = "保留の理由を書いてください";
const HOLD_RESUME_REQ = "再開の条件を書いてください";
const stageBtn = (page: Page) => panel(page).getByRole("button", { name: /^状態 / });
const send = (page: Page) => panel(page).getByRole("button", { name: /^(書き込む|送っています…)$/ });
const reason = (page: Page) => panel(page).getByRole("textbox", { name: /^保留の理由/ });
const resume = (page: Page) => panel(page).getByRole("textbox", { name: /^再開の条件/ });
const choose = async (page: Page, name: RegExp) => {
  await stageBtn(page).click();
  await page.getByRole("menuitem", { name }).click();
};
/** 書いた後の答え：一緒に残った変更つきの書き込み（K-389） */
const posted = (from: string, to: string) => (b: Record<string, unknown>) => ({
  status: 201,
  body: { data: post(TAKA_W, "2025-11-01 11:02", String(b["body"]), { changes: [{ field: "stage", from, to }] }) },
});

// ---------------------------------------------------------------- モックと本番の突き合わせ
for (const w of MATCH_WIDTHS) {
  test(`K396-UI-001 talk-compose-stage 幅 ${w}：状態 ▾ で保留を選んだ書く欄（札・保留の理由と再開の条件の欄・知らせる人・書き込む）の値がモックと同じ`, async ({
    browser,
  }) => {
    const { rows, bad } = await matchMock(
      browser,
      "talk-compose-stage",
      w,
      async (page) => {
        await mockThread(page, {
          items: [CREATED()],
          extra: { can: { delegate: false, complete: false, progress: true } },
        });
        await openThread(page, w);
        await box(page).fill("検収が終わるまで止めます");
        await choose(page, /保留/);
        await reason(page).fill("検収の完了を待つ");
        await resume(page).fill("検収の完了の連絡が来たら");
      },
      { pairs: COMPOSE_PAIRS, base: MOCK_BASE, blur: true },
    );
    expect(new Set(rows.map((r) => r.part)), "保留の欄で比べた").toContain("talk-hold");
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

// ---------------------------------------------------------------- 選ぶ物

test("K396-UI-002 状態 ▾ を押す：変えない（✓）・未着手・作業中・保留…（理由を書く）を頭の段の札と同じ色つきの札で並べる。今の段（作業中）は押せない形", async ({
  page,
}) => {
  await mockThread(page, { extra: { can: { delegate: false, complete: false, progress: true } } });
  await openThread(page);
  await expect(stageBtn(page)).toHaveText(/状態\s*変えない\s*▾/);
  await stageBtn(page).click();
  const items = page.getByRole("menuitem");
  await expect(items).toHaveText([/^変えない\s*✓$/, /^未着手$/, /^作業中$/, /^保留\s*理由を書く$/]);
  for (const [i, key] of [
    [1, "todo"],
    [2, "doing"],
    [3, "hold"],
  ] as const)
    await expect(items.nth(i).locator(`[data-stage="${key}"]`)).toHaveCount(1);
  await expect(items.nth(2)).toHaveAttribute("aria-disabled", "true");
  await items.nth(2).click({ force: true });
  await expect(stageBtn(page)).toHaveText(/状態\s*変えない/);
});

test("K396-UI-012 保留中のチケットで状態 ▾ を押す：今の段（保留）の「保留」は押せない形で「理由を書く」の小さな字は出さない（K-395 の頭の札と同じ）。未着手・作業中は選べる", async ({
  page,
}) => {
  await mockThread(page, {
    band: { stage: "hold" },
    extra: { stage: { key: "hold", name: "保留" }, can: { delegate: false, complete: false, progress: true } },
  });
  await openThread(page);
  await stageBtn(page).click();
  const items = page.getByRole("menuitem");
  await expect(items).toHaveText([/^変えない\s*✓$/, /^未着手$/, /^作業中$/, /^保留$/]);
  await expect(items.nth(3)).toHaveAttribute("aria-disabled", "true");
  await expect(items.nth(1)).not.toHaveAttribute("aria-disabled", "true");
  await expect(items.nth(2)).not.toHaveAttribute("aria-disabled", "true");
});

test("K396-UI-003 手順 S1：未着手のチケットで「作業中」を選んで書く → 送る値に段（stage_key: doing）。答えの書き込みに「状態：未着手 → 作業中」・詳細を読み直して頭の段の札が作業中・状態 ▾ は「変えない」に戻る", async ({
  page,
}) => {
  const t = await mockThread(page, {
    band: { stage: "todo" },
    extra: { can: { delegate: false, complete: false, progress: true } },
  });
  await openThread(page);
  await choose(page, /^作業中$/);
  await expect(stageBtn(page).locator('[data-stage="doing"]')).toHaveCount(1);
  await box(page).fill("始めます");
  t.on.post = posted("未着手", "作業中");
  const reread = page.waitForRequest(
    (r) => r.method() === "GET" && /\/api\/v1\/tickets\/[^/]+$/.test(new URL(r.url()).pathname),
  );
  t.base.on.ticket = () => ({ status: 200, body: { data: { ...ticketDoing() } } });
  await send(page).click();
  await reread;
  await expect(postOf(page, "高本 聖斗", "11:02").locator(".k-talk-changes li")).toHaveText(["状態：未着手 → 作業中"]);
  expect(t.posts[0]!.body).toEqual({
    body: "始めます",
    mention_member_ids: [],
    notify_member_ids: expect.any(Array),
    quote_of_id: null,
    stage_key: "doing",
  });
  await expect(page.locator('.k-detail-meta [data-part="stage"]')).toContainText("作業中");
  await expect(stageBtn(page)).toHaveText(/状態\s*変えない/);
});
/** 読み直しの答え（段が作業中になった詳細） */
function ticketDoing() {
  return {
    ticket: {
      id: "0193c5a0-0000-7000-8000-00000000c063",
      number: "EG-133",
      title: "11 月分の請求書を送る",
      due_on: null,
      start_on: null,
      priority: "mid",
    },
    sections: [{ key: "purpose", label: "目的", body: { text: "月末の請求を出す" }, version: 1 }],
    kind: { name: "タスク" },
    stage: { name: "作業中", key: "doing" },
    assignee: { display_name: "高本" },
    approval: null,
    can: { delegate: false, complete: true, progress: true },
    completed: null,
  };
}

test("K396-UI-004 保留…を選ぶと書く欄の中に「保留の理由」「再開の条件」（どちらも必須）。空のまま書き込むと口を呼ばず、欄の下に K-395 と同じ文を出す", async ({
  page,
}) => {
  const t = await mockThread(page, { extra: { can: { delegate: false, complete: false, progress: true } } });
  await openThread(page);
  await choose(page, /保留/);
  await expect(reason(page)).toBeVisible();
  await expect(resume(page)).toBeVisible();
  await box(page).fill("止めます");
  await send(page).click();
  await expect(reason(page)).toHaveAttribute("aria-invalid", "true");
  await expect(resume(page)).toHaveAttribute("aria-invalid", "true");
  const hold = panel(page).locator(".k-talk-hold");
  await expect(hold).toContainText(HOLD_REASON_REQ);
  await expect(hold).toContainText(HOLD_RESUME_REQ);
  expect(CATALOG["E-VAL-041"]).toBe(HOLD_REASON_REQ);
  expect(CATALOG["E-VAL-047"]).toBe(HOLD_RESUME_REQ);
  expect(t.posts).toHaveLength(0);
});

test("K396-UI-005 手順 S1：保留の理由と再開の条件を入れて書く → 送る値に stage_key: hold・hold_reason・resume_condition。答えの書き込みに「状態：作業中 → 保留」・詳細を読み直す・欄は閉じて状態 ▾ は変えないに戻る", async ({
  page,
}) => {
  const t = await mockThread(page, { extra: { can: { delegate: false, complete: false, progress: true } } });
  await openThread(page);
  await box(page).fill("検収が終わるまで止めます");
  await choose(page, /保留/);
  await reason(page).fill("検収の完了を待つ");
  await resume(page).fill("検収の完了の連絡が来たら");
  t.on.post = posted("作業中", "保留");
  const before = t.base.on.ticket;
  let rereads = 0;
  t.base.on.ticket = (req) => {
    rereads++;
    return before(req);
  };
  await send(page).click();
  await expect(postOf(page, "高本 聖斗", "11:02").locator(".k-talk-changes li")).toHaveText(["状態：作業中 → 保留"]);
  expect(t.posts[0]!.body).toMatchObject({
    stage_key: "hold",
    hold_reason: "検収の完了を待つ",
    resume_condition: "検収の完了の連絡が来たら",
  });
  await expect.poll(() => rereads).toBe(1);
  await expect(reason(page)).toHaveCount(0);
  await expect(stageBtn(page)).toHaveText(/状態\s*変えない/);
});

test("K396-UI-006 保留…から「変えない」に戻すと欄は閉じ、送る値に段も保留の欄も入れない", async ({ page }) => {
  const t = await mockThread(page, { extra: { can: { delegate: false, complete: false, progress: true } } });
  await openThread(page);
  await choose(page, /保留/);
  await reason(page).fill("途中まで書いた理由");
  await choose(page, /^変えない/);
  await expect(reason(page)).toHaveCount(0);
  await box(page).fill("ただの書き込み");
  await send(page).click();
  await expect.poll(() => t.posts.length).toBe(1);
  expect(Object.keys(t.posts[0]!.body).sort()).toEqual([
    "body",
    "mention_member_ids",
    "notify_member_ids",
    "quote_of_id",
  ]);
});

for (const [label, band, extra] of [
  ["確認中", { stage: "checking" }, { can: { delegate: false, complete: false, progress: false } }],
  ["承認待ち", { stage: "awaiting_approval" }, { can: { delegate: false, complete: false, progress: false } }],
  ["実行中", { stage: "running" }, { can: { delegate: false, complete: false, progress: false } }],
  // 完了は本物の形どおり can.progress が true（開き直すため・K387-API-026）。段が完了なので押せない形になる分かれ道を見る
  [
    "完了",
    { stage: "done", completed: { at: "2026-11-02T06:30:00Z", by: "高本 聖斗" } },
    { can: { delegate: false, complete: false, progress: true } },
  ],
  ["閲覧のみ（作業中）", { stage: "doing" }, { can: { delegate: false, complete: false, progress: false } }],
] as const) {
  test(`K396-UI-007 ${label}：状態 ▾ は押せない形（「状態 変えない（変えられません）」）。書き込むことはできる`, async ({
    page,
  }) => {
    const t = await mockThread(page, { band, extra });
    await openThread(page);
    const locked = panel(page).getByRole("button", { name: "状態 変えない（変えられません）" });
    await expect(locked).toHaveAttribute("aria-disabled", "true");
    await locked.click({ force: true });
    await expect(page.getByRole("menuitem")).toHaveCount(0);
    await box(page).fill("書けます");
    await send(page).click();
    await expect.poll(() => t.posts.length).toBe(1);
    expect(t.posts[0]!.body["stage_key"]).toBeUndefined();
  });
}

test("K396-UI-008 手順 S1 の失敗（409・その間に AI が動き出した）：K-387 の正本の文（AI が動いている間と承認待ちの間は、状態を変えられません）を出し、書いた字は残り、読み直して状態 ▾ は押せない形（変えないに戻る）", async ({
  page,
}) => {
  const code = Object.entries(CATALOG).find(([, m]) => m === LOCKED_TEXT)?.[0];
  expect(code, "K-387 が正本に足した文").toBeTruthy();
  const t = await mockThread(page, { extra: { can: { delegate: false, complete: false, progress: true } } });
  await openThread(page);
  await choose(page, /^未着手$/);
  await box(page).fill("戻します");
  t.on.post = () => err(409, code!);
  t.base.on.ticket = () => ({
    status: 200,
    body: {
      data: {
        ...ticketDoing(),
        stage: { name: "確認中", key: "checking" },
        can: { delegate: false, complete: false, progress: false },
      },
    },
  });
  await send(page).click();
  await expect(panel(page).locator(".k-talk-composer").getByRole("alert")).toContainText(LOCKED_TEXT);
  await expect(box(page)).toHaveValue("戻します");
  await expect(panel(page).getByRole("button", { name: "状態 変えない（変えられません）" })).toBeVisible();
});

test("K396-UI-009 手順 S1 の失敗（503・422）：503 は「送れませんでした…」で字・段・保留の欄は残る。422 の保留の理由の項目は欄の下に出す", async ({
  page,
}) => {
  const t = await mockThread(page, { extra: { can: { delegate: false, complete: false, progress: true } } });
  await openThread(page);
  await box(page).fill("止めます");
  await choose(page, /保留/);
  await reason(page).fill("待つ");
  await resume(page).fill("連絡が来たら");
  t.on.post = () => err(503, "SERVICE_UNAVAILABLE");
  await send(page).click();
  await expect(panel(page).locator(".k-talk-composer").getByRole("alert")).toContainText(FAILED);
  await expect(reason(page)).toHaveValue("待つ");
  await expect(stageBtn(page).locator('[data-stage="hold"]')).toHaveCount(1);
  t.on.post = () => ({
    status: 422,
    body: {
      error: "invalid",
      code: "E-VAL-001",
      details: [{ field: "hold_reason", message: "保留の理由が長すぎます" }],
    },
  });
  await send(page).click();
  await expect(panel(page).locator(".k-talk-hold")).toContainText("保留の理由が長すぎます");
});

test("K396-UI-010 キーボード：状態 ▾ に Tab で移り Enter で開き、↓ と Enter で「作業中」を選べる（未着手のとき）", async ({
  page,
}) => {
  await mockThread(page, {
    band: { stage: "todo" },
    extra: { can: { delegate: false, complete: false, progress: true } },
  });
  await openThread(page);
  await stageBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem").first()).toBeVisible();
  // ↓ で「作業中」まで移る（今の段 未着手 は押せない形なので、飛ばすかどうかに関わらず届くまで押す・最大 4 回）
  const at = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  for (let i = 0; i < 4 && !(await at()).startsWith("作業中"); i++) await page.keyboard.press("ArrowDown");
  expect(await at()).toMatch(/^作業中/);
  await page.keyboard.press("Enter");
  await expect(stageBtn(page).locator('[data-stage="doing"]')).toHaveCount(1);
});

for (const w of [320, 375, 768, 1024, 1440]) {
  test(`K396-UI-011 幅 ${w}：保留の欄が開いた書く欄でも横溢れ 0`, async ({ page }) => {
    await mockThread(page, { extra: { can: { delegate: false, complete: false, progress: true } } });
    await openThread(page, w);
    await choose(page, /保留/);
    await reason(page).fill("長い理由".repeat(40));
    expect(await overflowX(page)).toBe(0);
  });
}
