// K-482「ガント：棒・節目の旗・動かす確かめの小窓（理由が必須・親の期限の確かめ・土日を飛ばす）・日が無いもの・保留の出し方・スマホは出さない」を口につなぐ画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f7 の f7-gantt・f7-gantt-move・f7-gantt-nodate・f7-hold-view（幅 1440 だけ・本番と同じ部品 features/F7/gantt・代表 OK 待ち）。
//   本体は svar-gantt（@svar-ui/react-gantt・MIT）。有料の機能（markers・groupBy・unscheduledTasks）は使わない。棒を動かす操作は api.intercept("update-task") で取り、
//   確かめの小窓（MoveImpactDialog）に渡す（やめれば棒は元の位置のまま・「動かす」で口に送り、読み直して描く）。
//   口：棒の行は listTickets（view=all・scope_id・due_from＝見える範囲の最初の日・fields=start_on・sort=due_on・limit=100・K-473）を next_cursor が無くなるまで。
//   開始・期限が無いものは due=none（仮の名前・K-473 に足してもらう物・K-482 の md「PM に確かめたいこと」1）。保留の理由と再開の条件は getTicket の hold（K-387）。
//   期限を動かすのは updateTicket（PATCH /api/v1/tickets/:id・体は due_on・start_on・due_reason・expected_due_on・expected_start_on・K-483。E-DUE-001・002・005〜008 と E-VAL-028・E-VAL-012〈E-DUE-003 は欠番・E-VAL-028 と E-VAL-012 は段 5 の K-437 が定義・どちらも 409・欄なし〉）。
//   外枠・一覧・口は前からの土台 list-mock.ts と K-478 の f7-list-mock.ts。固定の待ちは使わない。時計は page.clock で固定（2026-11-02 月曜 10:00 日本時間）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { countWrites, expectInert, overflowX, WIDTHS } from "./kit";
import { gate, item, ok, open } from "./list-mock";
import { SALES, idOf, mockMine, queryOf, type Reply } from "./f7-list-mock";
import { matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const NOW = "2026-11-02T10:00:00+09:00";
const PATH = `/tickets?view=gantt&scope=${SALES}`;
const TEXT = {
  noReason: "期限を変える理由を書いてください",
  overParent: "子のチケットの期限は、親のチケットの期限より後にできません",
  past: "期限は今日か、それより後の日にしてください",
  underChild: "この期限より後の期限を持つ子のチケットがあります。先に子の期限を変えてください",
  order: "開始日は期限より前の日にしてください",
  loadFailed: "読み込めませんでした。",
} as const;

type Row = ReturnType<typeof item>;
interface Opt {
  parent?: number;
  stage?: [string, string];
  late?: boolean;
}
const g = (i: number, title: string, start: string | null, due: string | null, o: Opt = {}): Row =>
  item(i, {
    number: `EG-${i}`,
    title,
    start_on: start,
    due_on: due,
    overdue: o.late === true,
    parent_ticket_id: o.parent ? idOf(o.parent) : null,
    depth: o.parent ? 2 : 1,
    ...(o.stage ? { stage: { id: `st-${o.stage[1]}`, name: o.stage[0], key: o.stage[1] } } : {}),
  });
const ROWS: Row[] = [
  g(100, "請求書の締め", "2026-10-27", "2026-10-31", { late: true }),
  g(118, "応募結果をまとめる", "2026-10-30", "2026-11-09", { stage: ["保留", "hold"] }),
  g(124, "セイコー様 保守契約の更新", "2026-10-28", "2026-11-15"),
  g(125, "更新の条件をすり合わせる", "2026-10-29", "2026-11-02", { parent: 124 }),
  g(126, "更新の見積を作る", "2026-11-03", "2026-11-05", { parent: 124 }),
  g(129, "契約書の更新版を送る", "2026-11-06", "2026-11-09", { parent: 124 }),
  g(130, "更新の最終確認", "2026-11-10", "2026-11-14", { parent: 124 }),
  // 以下はモックの見本（f7-gantt）と棒・状態の札の数（12）をそろえる足し：棒は節目を除く 12 行（親 2＋子・単独 10）。節目は口に無く 0 件
  g(128, "11月分の請求書を送る", "2026-10-30", "2026-11-01", { late: true }),
  g(127, "応募文を出す", "2026-11-02", "2026-11-02"),
  g(119, "一次返信する", "2026-11-01", "2026-11-05"),
  g(143, "12月分の請求準備", "2026-11-25", "2026-11-27"),
  g(145, "11月の締め", "2026-11-26", "2026-11-30"),
];
// 開始・期限が無いものはモックの見本と同じ 4 件
const NO_DATE: Row[] = [
  g(131, "セイコー様 来期の提案", null, null),
  g(132, "展示会の出展を決める", null, null),
  g(133, "京蟻 管理画面の改善案", null, null),
  g(134, "年末調整の準備", null, null),
];
const HOLD = { reason: "先方の確認待ち", resume: "山田様から回答が届いたら", at: "2026-10-21T00:00:00Z", by: null };

interface Gantt {
  list: URLSearchParams[];
  none: URLSearchParams[];
  tickets: string[];
  patches: { id: string; body: Record<string, unknown> }[];
  next: () => Reply | undefined | Promise<Reply | undefined>;
  rows: Row[];
  noDate: Row[];
  listFail: number | null;
}

async function setup(page: Page, o: { rows?: Row[]; none?: Row[] } = {}) {
  const c: Gantt = {
    list: [],
    none: [],
    tickets: [],
    patches: [],
    next: () => undefined,
    rows: [...(o.rows ?? ROWS)],
    noDate: [...(o.none ?? NO_DATE)],
    listFail: null,
  };
  const m = await mockMine(page, {
    reply: (q) => {
      if (q.get("due") === "none") {
        c.none.push(q);
        return ok(c.noDate, { next_cursor: null });
      }
      c.list.push(q);
      if (c.listFail !== null) return { status: c.listFail, body: { error: "error", code: "INTERNAL" } };
      const from = q.get("due_from") ?? "0000-00-00";
      return ok(
        c.rows.filter((r) => r.due_on !== null && r.due_on >= from),
        { next_cursor: null },
      );
    },
  });
  await page.route(/\/api\/v1\/tickets\/[^/]+$/, async (route: Route) => {
    const req = route.request();
    const id = new URL(req.url()).pathname.split("/").pop()!;
    if (req.method() === "GET") {
      c.tickets.push(id);
      const hit = c.rows.find((r) => r.id === id);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ticket: {
              id,
              number: hit?.number,
              title: hit?.title,
              due_on: hit?.due_on,
              start_on: null,
              priority: "mid",
            },
            sections: [],
            kind: { name: "タスク" },
            stage: { name: "保留", key: "hold" },
            assignee: { display_name: "高本" },
            hold: HOLD,
          },
        }),
      });
    }
    if (req.method() !== "PATCH") return route.fallback();
    const body = req.postDataJSON() as Record<string, unknown>;
    c.patches.push({ id, body });
    const own = await c.next();
    c.next = () => undefined;
    if (own)
      return route.fulfill({ status: own.status, contentType: "application/json", body: JSON.stringify(own.body) });
    c.rows = c.rows.map((r) =>
      r.id === id
        ? { ...r, due_on: body["due_on"] as string, start_on: (body["start_on"] as string) ?? r["start_on"] }
        : r,
    );
    c.noDate = c.noDate.filter((r) => r.id !== id);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { changed: true } }),
    });
  });
  await page.clock.setFixedTime(new Date(NOW));
  return { c, m };
}
const fail = (status: number, code: string): Reply => ({ status, body: { error: "error", code } });
async function openGantt(page: Page, width = 1440) {
  await open(page, PATH, width);
  await expect(bar(page, "EG-126")).toBeVisible();
}

const bar = (p: Page, number: string): Locator => p.locator(".wx-bar").filter({ hasText: number });
const tools = (p: Page) => p.getByRole("group", { name: "ガントの道具", exact: true });
const dlg = (p: Page) => p.getByRole("dialog", { name: "期限を動かしますか", exact: true });
const reasonBox = (p: Page) => dlg(p).getByRole("textbox", { name: "理由", exact: true });
const DAY = 32; // 日の目盛りの 1 日の幅（正本の gantt-cell-day）

/** 棒をつかんで dx（px）だけ横に動かして離す（日の目盛り） */
async function dragBar(page: Page, b: Locator, dx: number) {
  const box = (await b.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 5 });
  await page.mouse.move(x + dx, y, { steps: 5 });
  await page.mouse.up();
}
const left = async (b: Locator) => (await b.boundingBox())!.x;

test("K482-UI-001 開く：/tickets?view=gantt&scope=営業 で、タブ「ガント」が今いる・左の表の見出しは 件名・担当者・状態・棒が出る。棒の口は 1 回（view=all・scope_id・due_from＝見える範囲の最初の日 2026-10-26・fields=start_on・sort=due_on・limit=100）・期限なしの口は 1 回（due=none・done=false）・保留の口（getTicket）は 0 回・書く口は 0 回", async ({
  page,
}) => {
  const { c } = await setup(page);
  const writes = countWrites(page);
  await openGantt(page);
  await expect(page.getByRole("link", { name: "ガント", exact: true })).toHaveAttribute("aria-current", "page");
  for (const name of ["件名", "担当者", "状態"])
    await expect(page.locator(".wx-grid .wx-header").getByText(name, { exact: true }), name).toBeVisible();
  expect(c.list).toHaveLength(1);
  expect(queryOf(c.list[0]!)).toMatchObject({
    view: "all",
    scope_id: SALES,
    due_from: "2026-10-26",
    fields: "start_on",
    sort: "due_on",
    limit: "100",
  });
  expect(c.none).toHaveLength(1);
  expect(queryOf(c.none[0]!)).toMatchObject({ due: "none", done: "false", scope_id: SALES });
  expect(c.tickets).toEqual([]);
  expect(writes.n).toBe(0);
});

test("K482-UI-002 行と棒：親の下に子が並ぶ（親は「【親】」つき）・棒は番号の字を状態の色で・期限切れ（EG-100）は赤い線（data-late）・保留（EG-118）は保留の色。今日（11/02）の列と土日の列に色が付く", async ({
  page,
}) => {
  await setup(page);
  await openGantt(page);
  const parent = (await page.getByText("【親】セイコー様 保守契約の更新").boundingBox())!;
  const child = (await page.getByText("更新の見積を作る").first().boundingBox())!;
  expect(parent.y).toBeLessThan(child.y);
  await expect(bar(page, "EG-100").locator(".k-f7-gantt-bar")).toHaveAttribute("data-late", "true");
  await expect(bar(page, "EG-118").locator(".k-f7-gantt-bar")).toHaveAttribute("data-f7-tone", "hold");
  await expect(page.locator(".k-f7-gantt-today").first()).toBeVisible();
  await expect(page.locator(".wx-weekend").first()).toBeVisible();
});

test("K482-UI-003 道具：目盛り「日」「週」「月」を押すと棒の幅が替わり（週 72・月 96 のセル）、口は見える範囲で読み直す。「前へ」「次へ」「今日」で範囲が動き、口の due_from が替わる。今の目盛りは押した形", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openGantt(page);
  const seg = tools(page).getByRole("group", { name: "目盛り", exact: true });
  await expect(seg.getByRole("button", { name: "日", exact: true })).toHaveAttribute("aria-pressed", "true");
  const before = c.list.length;
  await seg.getByRole("button", { name: "週", exact: true }).click();
  await expect(seg.getByRole("button", { name: "週", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => c.list.length).toBeGreaterThan(before);
  await seg.getByRole("button", { name: "日", exact: true }).click();
  const first = queryOf(c.list[c.list.length - 1]!)["due_from"];
  await tools(page).getByRole("button", { name: "次へ", exact: true }).click();
  await expect.poll(() => queryOf(c.list[c.list.length - 1]!)["due_from"]).not.toBe(first);
  await tools(page).getByRole("button", { name: "今日", exact: true }).click();
  await expect.poll(() => queryOf(c.list[c.list.length - 1]!)["due_from"]).toBe("2026-10-26");
});

test("K482-UI-004 まとめ方・担当者：まとめ方は「親子」（選んだ形）で、「担当者」「節目」の option は disabled（押せない形）。担当者で人を選ぶと口に assignee_id が付いて読み直す", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openGantt(page);
  const group = tools(page).getByRole("combobox", { name: "まとめ方", exact: true });
  await expect(group).toHaveValue("親子");
  for (const name of ["担当者", "節目"]) await expect(group.getByRole("option", { name, exact: true })).toBeDisabled();
  await tools(page).getByRole("combobox", { name: "担当者", exact: true }).selectOption({ label: "鈴木" });
  await expect.poll(() => queryOf(c.list[c.list.length - 1]!)["assignee_id"]).toBeTruthy();
});

test("K482-UI-005 棒をつかんで動かす：EG-126 を 3 日後ろへ動かすと、「期限を動かしますか」の小窓（対象「EG-126 更新の見積を作る」・期限 11/05（木） → 11/08（日）・「3 日後ろへ」）が開く。この時点で口は 0 回・棒は元の位置のまま。「やめる（元に戻す）」で閉じ、口は 0 回・棒は元の位置", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openGantt(page);
  const x0 = await left(bar(page, "EG-126"));
  await dragBar(page, bar(page, "EG-126"), 3 * DAY);
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page)).toContainText("EG-126 更新の見積を作る");
  await expect(dlg(page)).toContainText("11/05（木）");
  await expect(dlg(page)).toContainText("11/08（日）");
  await expect(dlg(page)).toContainText("3 日後ろへ");
  expect(c.patches).toEqual([]);
  expect(Math.abs((await left(bar(page, "EG-126"))) - x0)).toBeLessThan(2);
  await dlg(page).getByRole("button", { name: "やめる（元に戻す）", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(Math.abs((await left(bar(page, "EG-126"))) - x0)).toBeLessThan(2);
  expect(c.patches).toEqual([]);
});

test("K482-UI-006 親の期限の確かめ：親 EG-124 の期限 11/15 に収まる動かし方なら「親 EG-124 の期限 11/15 には収まる」・「にする」が押せる。EG-130（期限 11/14）を 2 日後ろへ動かすと 11/16 で収まらず「親 EG-124 の期限 11/15 を過ぎるので、動かせません」・「にする」は押せない形（口に 0 回）", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openGantt(page);
  await dragBar(page, bar(page, "EG-126"), 3 * DAY);
  await expect(dlg(page)).toContainText("親 EG-124 の期限 11/15 には収まる");
  await expect(dlg(page).getByRole("button", { name: /にする$/ })).not.toHaveAttribute("disabled", "");
  await dlg(page).getByRole("button", { name: "やめる（元に戻す）", exact: true }).click();
  await dragBar(page, bar(page, "EG-130"), 2 * DAY);
  await expect(dlg(page)).toContainText("親 EG-124 の期限 11/15 を過ぎるので、動かせません");
  const go = dlg(page).getByRole("button", { name: /にする$/ });
  await expect(go).toBeDisabled();
  await go.click({ force: true });
  expect(c.patches).toEqual([]);
});

test("K482-UI-007 あとに続くもの：「あとに続くものにかかる」の枠と「あとに続くものも動かす」は押せない形（aria-disabled・チェックは付かず disabled・口に何も送らない）。つながりの「続く」がまだ無い旨の 1 行が出る", async ({
  page,
}) => {
  const { c } = await setup(page);
  const writes = countWrites(page);
  await openGantt(page);
  await dragBar(page, bar(page, "EG-126"), 3 * DAY);
  await expect(dlg(page)).toBeVisible();
  const box = dlg(page).locator('[aria-disabled="true"]', { hasText: "あとに続くものにかかる" });
  await expect(box).toContainText("つながりの「続く」はまだ使えません");
  const check = dlg(page).getByRole("checkbox", { name: /あとに続くものも動かす/ });
  await expect(check).toBeDisabled();
  await expectInert(
    page,
    dlg(page).locator("label[aria-disabled='true']", { hasText: "あとに続くものも動かす" }),
    "あとに続くものも動かす",
    writes,
    1,
  );
  expect(c.patches).toEqual([]);
});

test("K482-UI-008 土日を飛ばす：選んだ形（既定）で「11/08（日）→ 11/09（月）になる」・「11/09 にする」。外すと「11/08 にする」。土日以外に落とした棒（EG-129 を 1 日後ろ）は注が「そのまま」で字が替わらない。会社の休みは見ない（土日だけ・F9 の後）", async ({
  page,
}) => {
  await setup(page);
  await openGantt(page);
  await dragBar(page, bar(page, "EG-126"), 3 * DAY);
  const skip = dlg(page).getByRole("checkbox", { name: /土日を飛ばす/ });
  await expect(skip).toBeChecked();
  await expect(dlg(page)).toContainText("11/08（日）→ 11/09（月）になる");
  await expect(dlg(page).getByRole("button", { name: "11/09 にする", exact: true })).toBeVisible();
  await skip.uncheck();
  await expect(dlg(page).getByRole("button", { name: "11/08 にする", exact: true })).toBeVisible();
  await dlg(page).getByRole("button", { name: "やめる（元に戻す）", exact: true }).click();
  await dragBar(page, bar(page, "EG-129"), DAY);
  await expect(dlg(page).getByRole("button", { name: "11/10 にする", exact: true })).toBeVisible();
  await expect(dlg(page)).not.toContainText("になる");
});

test("K482-UI-009 理由が空・空白だけ：「にする」を押しても口に 0 回で、理由の欄の下に「期限を変える理由を書いてください」（aria-invalid）。小窓は開いたまま", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openGantt(page);
  await dragBar(page, bar(page, "EG-126"), 3 * DAY);
  await dlg(page).getByRole("button", { name: "11/09 にする", exact: true }).click();
  await expect(dlg(page).getByText(TEXT.noReason, { exact: true })).toBeVisible();
  await expect(reasonBox(page)).toHaveAttribute("aria-invalid", "true");
  await reasonBox(page).fill("　 ");
  await dlg(page).getByRole("button", { name: "11/09 にする", exact: true }).click();
  await expect(dlg(page).getByText(TEXT.noReason, { exact: true })).toBeVisible();
  expect(c.patches).toEqual([]);
});

test("K482-UI-010 動かす（成功）：理由を入れて「11/09 にする」で、口に PATCH が 1 回 { due_on: 2026-11-09, start_on: 2026-11-06, due_reason, expected_due_on: 2026-11-05, expected_start_on: 2026-11-03 }。小窓が閉じ、「期限を 11/09 に変えました」が出て、棒の口を読み直し、棒が右へ動く", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openGantt(page);
  const x0 = await left(bar(page, "EG-126"));
  await dragBar(page, bar(page, "EG-126"), 3 * DAY);
  await reasonBox(page).fill("先方の確認待ちで後ろへ");
  await dlg(page).getByRole("button", { name: "11/09 にする", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(page.getByText("期限を 11/09 に変えました", { exact: true })).toBeVisible();
  expect(c.patches).toHaveLength(1);
  expect(c.patches[0]!.body).toEqual({
    due_on: "2026-11-09",
    start_on: "2026-11-06",
    due_reason: "先方の確認待ちで後ろへ",
    expected_due_on: "2026-11-05",
    expected_start_on: "2026-11-03",
  });
  await expect.poll(async () => (await left(bar(page, "EG-126"))) - x0).toBeGreaterThan(2 * DAY);
  expect(c.list.length).toBeGreaterThanOrEqual(2);
});

test("K482-UI-011 口が断った・落ちた：409 E-DUE-005（親より後）・409 E-DUE-006（子より前）・409 E-VAL-028（開始日と期限の前後）・409 E-VAL-012（今日より前）・403・500 は小窓の上の role=alert に正本の文（E-DUE-005・E-VAL-012・E-PAGE-002・E-PAGE-007 の 1 文目）。理由は残り、小窓は開いたまま・棒は動かない。二度押しは口に 1 回だけ（押している間は押せない形）", async ({
  page,
}) => {
  const { c } = await setup(page);
  const hold = gate();
  await openGantt(page);
  const x0 = await left(bar(page, "EG-126"));
  await dragBar(page, bar(page, "EG-126"), 3 * DAY);
  await reasonBox(page).fill("理由");
  for (const [r, text] of [
    [fail(409, "E-DUE-005"), TEXT.overParent],
    [fail(409, "E-DUE-006"), TEXT.underChild],
    [fail(409, "E-VAL-028"), TEXT.order],
    [fail(409, "E-VAL-012"), TEXT.past],
    [fail(403, "FORBIDDEN"), "この画面を見る権限がありません。"],
    [fail(500, "INTERNAL"), TEXT.loadFailed],
  ] as const) {
    c.next = () => r;
    await dlg(page).getByRole("button", { name: "11/09 にする", exact: true }).click();
    await expect(dlg(page).getByRole("alert")).toContainText(text);
    await expect(reasonBox(page)).toHaveValue("理由");
  }
  expect(Math.abs((await left(bar(page, "EG-126"))) - x0)).toBeLessThan(2);
  const before = c.patches.length;
  c.next = async () => {
    await hold.wait;
    return undefined;
  };
  const go = dlg(page).getByRole("button", { name: "11/09 にする", exact: true });
  await go.click();
  await expect.poll(() => c.patches.length).toBe(before + 1);
  await expect(go).toBeDisabled();
  await go.click({ force: true });
  expect(c.patches).toHaveLength(before + 1);
  hold.open();
  await expect(dlg(page)).toHaveCount(0);
});

test("K482-UI-012 開始日だけを動かす（棒の左の端をつかんで動かす）：小窓は開かず口に 0 回で、棒は元の位置に戻り、小さなお知らせ「開始日だけは、ここでは変えられません。期限といっしょに動かしてください」が出る（開始日だけの変更は理由が要らない口の形があるが、この画面では持たない）", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openGantt(page);
  const b = bar(page, "EG-126");
  const box = (await b.boundingBox())!;
  const x0 = box.x;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 2 + DAY, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(
    page.getByText("開始日だけは、ここでは変えられません。期限といっしょに動かしてください", { exact: true }),
  ).toBeVisible();
  await expect(dlg(page)).toHaveCount(0);
  expect(c.patches).toEqual([]);
  expect(Math.abs((await left(b)) - x0)).toBeLessThan(2);
});

test("K482-UI-013 開始・期限が無いもの：ボタン「開始・期限が無い 4 件」を押すと、すぐ下に小窓（「開始・期限が無いもの」・行は 番号と題名・「日を入れる」）。押している間は aria-expanded。もう一度押すか Esc で閉じる。ここでは日をつかんで落とす操作は出さない（案内の字も出さない）", async ({
  page,
}) => {
  await setup(page);
  await openGantt(page);
  const btn = tools(page).getByRole("button", { name: "開始・期限が無い 4 件", exact: true });
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  const tray = page
    .getByRole("dialog", { name: "開始・期限が無い 4 件", exact: true })
    .or(page.getByRole("dialog", { name: "開始・期限が無いもの", exact: true }));
  await expect(tray).toContainText("EG-131");
  await expect(tray).toContainText("展示会の出展を決める");
  await expect(tray).not.toContainText("つかんでガントの日へ落とす");
  await page.keyboard.press("Escape");
  await expect(tray).toHaveCount(0);
  await expect(btn).toBeFocused();
});

test("K482-UI-014 日を入れる：「EG-131 に日を入れる」を押すと確かめの小窓に 期限を決める日の欄が開き、日と理由を入れて決めると PATCH は { due_on, due_reason, expected_due_on: null }（開始日は送らない）。成功したら右の小窓の行が消え、棒が出る。理由が空・過去の日は口に 0 回で欄の下に正本の文", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openGantt(page);
  await tools(page).getByRole("button", { name: "開始・期限が無い 4 件", exact: true }).click();
  await page.getByRole("button", { name: "EG-131 に日を入れる", exact: true }).click();
  const d = page.getByRole("dialog", { name: "期限を決めますか", exact: true });
  await d.getByLabel("期限", { exact: true }).fill("2026-11-12");
  await d.getByRole("button", { name: "11/12 にする", exact: true }).click();
  await expect(d.getByText(TEXT.noReason, { exact: true })).toBeVisible();
  await d.getByLabel("期限", { exact: true }).fill("2026-10-30");
  await d.getByRole("textbox", { name: "理由", exact: true }).fill("来期の提案日を決めた");
  await d.getByRole("button", { name: "10/30 にする", exact: true }).click();
  await expect(d.getByText(TEXT.past, { exact: true })).toBeVisible();
  expect(c.patches).toEqual([]);
  // 手元の確かめを抜けた日を、口が 409 E-VAL-012 で断った：同じ文が期限の欄の下に出て、小窓は開いたまま
  await d.getByLabel("期限", { exact: true }).fill("2026-11-12");
  c.next = () => fail(409, "E-VAL-012");
  await d.getByRole("button", { name: "11/12 にする", exact: true }).click();
  await expect.poll(() => c.patches.length).toBe(1);
  await expect(d.getByText(TEXT.past, { exact: true })).toBeVisible();
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: "11/12 にする", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(c.patches).toHaveLength(2);
  expect(c.patches[1]!.body).toEqual({
    due_on: "2026-11-12",
    due_reason: "来期の提案日を決めた",
    expected_due_on: null,
  });
  await expect(bar(page, "EG-131")).toBeVisible();
});

test("K482-UI-015 保留の出し方：保留（EG-118）の棒に指を置く（焦点でも）と、棒の下に「保留」の札・番号と題名・「保留から 12 日」・理由「先方の確認待ち」・再開の条件「山田様から回答が届いたら」。詳細の口（getTicket）はその 1 回だけで、同じ棒をもう一度指しても読み直さない。詰まりの印は押せない形", async ({
  page,
}) => {
  const { c } = await setup(page);
  const writes = countWrites(page);
  await openGantt(page);
  await bar(page, "EG-118").hover();
  const note = page.getByRole("note", { name: "EG-118 の保留", exact: true });
  await expect(note).toContainText("応募結果をまとめる");
  await expect(note).toContainText("保留から 12 日");
  await expect(note).toContainText("先方の確認待ち");
  await expect(note).toContainText("山田様から回答が届いたら");
  await expectInert(page, note.locator('[aria-disabled="true"]', { hasText: "詰まり" }), "詰まり", writes);
  await bar(page, "EG-126").hover();
  await bar(page, "EG-118").hover();
  expect(c.tickets).toEqual([idOf(118)]);
});

test("K482-UI-016 空と失敗：棒の行も期限なしも 0 件の最初の画面は「ガントに出すチケットがありません」と「開始日と期限が決まったチケットが、棒になって並びます」（チャートは出さない）。棒の口が 500 なら E-PAGE-007 の文と「もう一度」（押すと読み直して棒が出る）", async ({
  page,
}) => {
  await setup(page, { rows: [], none: [] });
  await open(page, PATH);
  await expect(page.getByText("ガントに出すチケットがありません", { exact: true })).toBeVisible();
  await expect(page.getByText("開始日と期限が決まったチケットが、棒になって並びます", { exact: true })).toBeVisible();
  await expect(page.locator(".wx-bar")).toHaveCount(0);
});

test("K482-UI-022 行の高さは 36px：隣り合う棒の行の間隔が 36・本体の高さは 18 行ほど（目盛り 28×2 段を引いて 36 で割ると 17 以上 19 以下）（幅 1440）", async ({ page }) => {
  await setup(page);
  await openGantt(page);
  const tops = (await page.locator(".wx-bar").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))).sort((x, y) => x - y);
  const gaps = tops.slice(1).map((y, i) => y - tops[i]!).filter((g) => g > 0);
  expect(Math.min(...gaps), "隣り合う棒の行の間隔").toBe(36);
  const body = (await page.locator(".k-f7-gantt-body").boundingBox())!;
  const rows = (body.height - 28 * 2) / 36;
  expect(rows, "本体に入る行の数").toBeGreaterThanOrEqual(17);
  expect(rows, "本体に入る行の数").toBeLessThanOrEqual(19);
});

test("K482-UI-021 棒の口が 500：E-PAGE-007 の文と「もう一度」が出て、押すと同じ口を読み直して棒が出る（口は計 2 回）", async ({
  page,
}) => {
  const { c } = await setup(page);
  c.listFail = 500;
  await open(page, PATH);
  await expect(page.getByText(TEXT.loadFailed)).toBeVisible();
  c.listFail = null;
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(bar(page, "EG-126")).toBeVisible();
  expect(c.list).toHaveLength(2);
});

test("K482-UI-017 スマホ（幅 375）：ガントのタブは出ない。URL を直に開くとチャートは出さず「スマホではガントを出しません。カレンダーか一覧で見てください」。一覧の口・期限なしの口は 0 回（読まない）で、横溢れ 0。幅 768 以上では出る", async ({
  page,
}) => {
  const { c } = await setup(page);
  await open(page, PATH, 375);
  await expect(
    page.getByText("スマホではガントを出しません。カレンダーか一覧で見てください", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "ガント", exact: true })).toBeHidden();
  expect(c.list).toEqual([]);
  expect(c.none).toEqual([]);
  expect(await overflowX(page)).toBe(0);
  await open(page, PATH, 768);
  await expect(bar(page, "EG-126")).toBeVisible();
});

test("K482-UI-018 幅 768・1024・1440：ページの横溢れ 0（チャートは中でスクロールする）。左の表は 件名が伸び、担当者・状態は決めた幅（72）", async ({
  page,
}) => {
  await setup(page);
  for (const w of WIDTHS.filter((x) => x >= 768)) {
    await openGantt(page, w);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    for (const name of ["担当者", "状態"]) {
      const head = page.locator(".wx-grid .wx-header .wx-cell", { hasText: name }).first();
      expect(Math.round((await head.boundingBox())!.width), `幅 ${w} ${name}`).toBe(72);
    }
  }
});

test("K482-UI-019 キーボード：道具のボタン（今日・前へ・次へ・目盛り）に Tab で届き Enter で押せる。確かめの小窓は Esc で閉じて（やめる・口に 0 回）、棒は元の位置のまま", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openGantt(page);
  await tools(page).getByRole("button", { name: "今日", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(tools(page).getByRole("button", { name: "前へ", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tools(page).getByRole("button", { name: "次へ", exact: true })).toBeFocused();
  const x0 = await left(bar(page, "EG-126"));
  await dragBar(page, bar(page, "EG-126"), 3 * DAY);
  await expect(dlg(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  expect(c.patches).toEqual([]);
  expect(Math.abs((await left(bar(page, "EG-126"))) - x0)).toBeLessThan(2);
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock・base は /dev/mock/f7・幅 1440 だけ）
const BOXP = ["width", "x", "background-color", "border-top-color", "border-top-left-radius"];
const pair = (role: string, sel: string, props: string[]) => ({ name: role, role, canvas: sel, app: sel, props });
const GANTT_PAIRS = [
  pair("card", ".k-f7-gantt-card", BOXP),
  pair("tools", ".k-f7-gantt-tools", ["height", "x"]),
  pair("legend", ".k-f7-gantt-legend", ["height", "x"]),
  pair("swatch", ".k-f7-gantt-swatch", ["width", "height", "background-color"]),
  pair("body", ".k-f7-gantt-body", ["height", "x", "width"]),
  pair("bar", ".k-f7-gantt-bar", ["height", "background-color", "border-top-left-radius"]),
  pair("stage", ".k-f7-gantt-stage", ["height", "font-size", "color", "background-color"]),
];
const MOVE_PAIRS = [
  pair("dialog", '[role="dialog"]', ["width", "background-color", "border-top-left-radius"]),
  pair("dates", ".k-f7-gantt-move-dates", ["height", "x"]),
  pair("parent", ".k-f7-gantt-move-parent", ["height", "x", "color"]),
  pair("follow", ".k-f7-gantt-move-follow", ["x", "opacity"]),
  pair("check", ".k-f7-gantt-move-check", ["height", "x"]),
];
const NODATE_PAIRS = [
  pair("tray", ".k-f7-calendar-tray-panel", ["width", "background-color", "border-top-left-radius"]),
  pair("tray-row", ".k-f7-calendar-tray-row", ["height", "x"]),
];
const HOLD_PAIRS = [
  pair("hold", ".k-f7-gantt-hold", [...BOXP, "height"]),
  pair("hold-stuck", ".k-f7-gantt-stuck", ["height", "opacity"]),
];

test("K482-UI-020 モック f7-gantt・f7-gantt-move・f7-gantt-nodate・f7-hold-view（幅 1440 だけ）：道具・凡例・本体・棒・状態の札、確かめの小窓（箱・日付の行・親の確かめ・あとに続くもの・チェック）、開始・期限が無いものの小窓、保留の出し方の値（位置・大きさ・色。字と見本の中身は比べない）が本番と同じ", async ({
  browser,
}) => {
  const bad: string[] = [];
  const run = async (id: string, pairs: ReturnType<typeof pair>[], drive: (p: Page) => Promise<void>) => {
    const r = await matchMock(browser, id, 1440, drive, { pairs, base: "/dev/mock/f7" });
    bad.push(...r.bad);
  };
  await run("f7-gantt", GANTT_PAIRS, async (p) => {
    await setup(p);
    await openGantt(p);
  });
  await run("f7-gantt-move", MOVE_PAIRS, async (p) => {
    await setup(p);
    await openGantt(p);
    await dragBar(p, bar(p, "EG-126"), 3 * DAY);
    await expect(dlg(p)).toBeVisible();
  });
  await run("f7-gantt-nodate", NODATE_PAIRS, async (p) => {
    await setup(p);
    await openGantt(p);
    await tools(p).getByRole("button", { name: "開始・期限が無い 4 件", exact: true }).click();
  });
  await run("f7-hold-view", HOLD_PAIRS, async (p) => {
    await setup(p);
    await openGantt(p);
    await bar(p, "EG-118").hover();
    await expect(p.getByRole("note", { name: "EG-118 の保留", exact: true })).toBeVisible();
  });
  expect(bad, bad.join("\n")).toEqual([]);
});
