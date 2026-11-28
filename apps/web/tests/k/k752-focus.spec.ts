// K-752「画面：承認待ちの『続けて裁く』（1 件ずつ全画面・次／前／承認／差し戻す／自分で直す／飛ばすのキー・終わりの面）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5 の focus-card・focus-confirm・focus-done（代表 OK：2026-11-23・D-153.12）。
//   口は網の手前で差し替える（前からの土台 tests/features/F5/approve-complete.harness.ts の mockApi：承認待ちの一覧・詳細・承認・差し戻し）。
//   続けて裁くは AI の成果物だけを、一覧の並び（sort の今の値）で 1 件ずつ見る（K-748 の申し送り）。差し込み口は K-730 の QueueFocusSlot（先 fills/queue-focus.tsx）。
//   固定の待ちは使わない。name は { exact: true }。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  A_INLINE,
  A_NODUE,
  A_OPEN,
  MSG,
  QUEUE,
  TICKET_B,
  detailOf,
  mockApi,
  openQueue,
  qrow,
} from "../features/F5/approve-complete.harness";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { WIDTHS_ALL, err, msg, overflowX } from "./room-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const HANDOVER = qrow("0193c5a0-0000-7000-8000-0000000f0001", {
  kind: "handover",
  title: "問い合わせ（山田様）に一次返信する",
});
const focus = (p: Page) => p.getByRole("dialog", { name: "続けて裁く", exact: true });
const card = (p: Page) => focus(p).getByRole("region", { name: "いま決めるもの", exact: true });
const pos = (p: Page) => focus(p).locator(".k-more-focus-pos");
/** 前からの確かめの小窓（Confirm＝alertdialog）。取り消せない承認は「成果物を目で見た」に印を付けてから主ボタン */
const approveDlg = (p: Page) => p.getByRole("alertdialog", { name: /承認/ });
async function approveInDialog(p: Page) {
  const d = approveDlg(p);
  await expect(d).toBeVisible();
  const seen = d.getByRole("checkbox", { name: "成果物を目で見た", exact: true });
  if ((await seen.count()) > 0 && !(await seen.isChecked())) await seen.check();
  await d.getByRole("button", { name: /^承認/ }).click();
}
const headBtn = (p: Page) => p.locator("header.k-ap-head").getByRole("button", { name: /^続けて裁く（\d+ 件）$/ });

/** 承認待ち（AI の成果物 3・渡された 1）。kind=artifact の読みは AI の成果物だけを返す。読んだ問い合わせを控える */
async function setup(page: Page, o: { artifacts?: Record<string, unknown>[] } = {}) {
  const m = await mockApi(page);
  const stops: string[] = [];
  await page.route(/\/api\/v1\/approvals\/[^/]+\/stop$/, async (route, req) => {
    stops.push(new URL(req.url()).pathname.split("/").at(-2)!);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: stops.at(-1), status_id: "stopped" } }),
    });
  });
  const queries: Record<string, string>[] = [];
  const details: string[] = [];
  m.on.queue = (req) => {
    const q = Object.fromEntries(new URL(req.url()).searchParams.entries());
    queries.push(q);
    const rows = q["kind"] === "artifact" ? (o.artifacts ?? QUEUE()) : [...QUEUE(), HANDOVER];
    return {
      status: 200,
      body: { data: rows, meta: { limit: 20, counts: { total: rows.length, artifact: 3, handover: 1 } } },
    };
  };
  m.on.detail = (req) => {
    const id = new URL(req.url()).pathname.split("/").at(-1)!;
    details.push(id);
    return { status: 200, body: { data: detailOf(id) } };
  };
  return { m, queries, details, stops };
}
async function enter(page: Page, width = 1440) {
  await openQueue(page, width);
  await headBtn(page).click();
  await expect(focus(page)).toBeVisible();
  await expect(card(page)).toBeVisible();
}

test("K752-UI-001 入口：見出しの［続けて裁く（N 件）］が押せる形になり、押すと全画面の「続けて裁く」が開き、AI の成果物だけを一覧の並び（kind=artifact・今の sort＝既定 due・limit 200 の 1 回）で読む。道に ?focus=1", async ({
  page,
}) => {
  const { queries } = await setup(page);
  await openQueue(page);
  await expect(headBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await headBtn(page).click();
  await expect(focus(page).getByRole("heading", { level: 1, name: "続けて裁く", exact: true })).toBeVisible();
  await expect.poll(() => queries.filter((q) => q["kind"] === "artifact").length).toBe(1);
  expect(queries.find((q) => q["kind"] === "artifact")).toMatchObject({ kind: "artifact", sort: "due", limit: "200" });
  await expect(pos(page)).toHaveText("1 / 3 件");
  await expect(page).toHaveURL(/[?&]focus=1/);
});

test("K752-UI-002 1 件の面：見出しは「番号 題名」・中身（成果物のカード）・キーの説明「キー：次 J ・ 前 K ・ 承認 A ・ 差し戻す R ・ 自分で直す E ・ 飛ばす S」・下に［飛ばす］［止める］［差し戻す］［自分で直す］［承認して送る → 次へ］と次の 2 件", async ({
  page,
}) => {
  const { details } = await setup(page);
  await enter(page);
  await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("EG-133 見積を出す");
  await expect.poll(() => details[0]).toBe(A_INLINE);
  await expect(card(page)).toContainText("株式会社サンプル 御中");
  await expect(focus(page).locator(".k-more-focus-keys")).toHaveText(
    "キー：次 J ・ 前 K ・ 承認 A ・ 差し戻す R ・ 自分で直す E ・ 飛ばす S",
  );
  for (const n of ["飛ばす", "止める", "差し戻す", "自分で直す"])
    await expect(
      focus(page)
        .locator(".k-more-focus-foot")
        .getByRole("button", { name: new RegExp(`^${n}`) }),
    ).toBeVisible();
  await expect(
    focus(page)
      .locator(".k-more-focus-foot")
      .getByRole("button", { name: /^承認して送る → 次へ/ }),
  ).toBeVisible();
  await expect(focus(page).locator(".k-more-focus-next")).toHaveText(
    "次：EG-133 11 月分の請求書を送る ・ EG-140 応募文を出す",
  );
});

test("K752-UI-003 キー J・K と［飛ばす］（S）：J で次・K で前の 1 件に移り「2 / 3 件」「1 / 3 件」。S は飛ばして次へ（口は呼ばない）", async ({
  page,
}) => {
  const { m } = await setup(page);
  await enter(page);
  await page.keyboard.press("j");
  await expect(pos(page)).toHaveText("2 / 3 件");
  await page.keyboard.press("k");
  await expect(pos(page)).toHaveText("1 / 3 件");
  await page.keyboard.press("s");
  await expect(pos(page)).toHaveText("2 / 3 件");
  expect(m.approves.length + m.returns.length).toBe(0);
});

test("K752-UI-004 承認（A）：確かめの小窓を通り、主ボタンで承認の口に 1 回・承認したら次の 1 件へ。小窓の［やめる］では口を呼ばない", async ({
  page,
}) => {
  const { m } = await setup(page);
  await enter(page);
  await page.keyboard.press("a");
  const dlg = approveDlg(page);
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "やめる", exact: true }).click();
  expect(m.approves.length).toBe(0);
  await page.keyboard.press("a");
  await approveInDialog(page);
  await expect.poll(() => m.approves.map((a) => a.id)).toEqual([A_INLINE]);
  await expect(pos(page)).toHaveText("2 / 3 件");
});

test("K752-UI-005 差し戻す（R）：差し戻す小窓を通り、理由を書いて差し戻すと差し戻しの口に 1 回・次の 1 件へ", async ({
  page,
}) => {
  const { m } = await setup(page);
  await enter(page);
  await page.keyboard.press("r");
  const dlg = page.getByRole("dialog", { name: /差し戻/ });
  await dlg.getByRole("textbox", { name: "差し戻す理由", exact: true }).fill("宛名が違う");
  await dlg.getByRole("button", { name: /^差し戻す/ }).click();
  await expect.poll(() => m.returns.map((r) => r.id)).toEqual([A_INLINE]);
  await expect(pos(page)).toHaveText("2 / 3 件");
});

test("K752-UI-006 自分で直す（E）：そのチケットの詳細（承認の帯の［自分で直す］がある所）へ移り、続けて裁くを閉じる", async ({
  page,
}) => {
  await setup(page);
  await enter(page);
  await page.keyboard.press("e");
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET_B}`));
  await expect(focus(page)).toHaveCount(0);
});

test("K752-UI-007 終わりの面：最後の 1 件を決めると「決め終わりました」と 承認 N 件・差し戻し N 件・飛ばした N 件・「飛ばした N 件は、承認待ちに残っています」・［承認待ちに戻る］で閉じて一覧を読み直す", async ({
  page,
}) => {
  const { m } = await setup(page);
  await enter(page);
  await page.keyboard.press("a");
  await approveInDialog(page);
  await expect(pos(page)).toHaveText("2 / 3 件");
  await page.keyboard.press("s");
  await page.keyboard.press("s");
  await expect(focus(page).getByRole("heading", { level: 2, name: "決め終わりました", exact: true })).toBeVisible();
  await expect(focus(page).getByRole("list", { name: "結果", exact: true }).getByRole("listitem")).toHaveText([
    "承認 1 件",
    "差し戻し 0 件",
    "飛ばした 2 件",
  ]);
  await expect(focus(page)).toContainText("飛ばした 2 件は、承認待ちに残っています");
  await expect(focus(page)).toContainText("決めた物は、承認待ちの［決めた履歴］で見られます");
  const reads = m.queueReads;
  await focus(page).getByRole("button", { name: "承認待ちに戻る", exact: true }).click();
  await expect(focus(page)).toHaveCount(0);
  await expect.poll(() => m.queueReads).toBeGreaterThan(reads);
  await expect(page).not.toHaveURL(/focus=1/);
});

test("K752-UI-008 ‹ 一覧に戻る・Esc：途中でいつでも閉じられ、一覧を読み直す（決めた物は一覧から消える）", async ({
  page,
}) => {
  const { m } = await setup(page);
  await enter(page);
  const reads = m.queueReads;
  await focus(page).getByRole("button", { name: "‹ 一覧に戻る", exact: true }).click();
  await expect(focus(page)).toHaveCount(0);
  await expect.poll(() => m.queueReads).toBeGreaterThan(reads);
  await headBtn(page).click();
  await page.keyboard.press("Escape");
  await expect(focus(page)).toHaveCount(0);
});

test("K752-UI-009 承認の口の断り：409（先に決まっていた）・404（無くなった）なら正本の文を面の上に出して次の 1 件へ（承認の数に入れない）。503 は同じ 1 件のまま文を出し、押し直すと通って次へ", async ({
  page,
}) => {
  const { m } = await setup(page);
  m.on.approve = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  await enter(page);
  await page.keyboard.press("a");
  await approveInDialog(page);
  await expect(focus(page)).toContainText(MSG.decided);
  await expect(pos(page)).toHaveText("2 / 3 件");
  m.on.approve = () => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
  await page.keyboard.press("a");
  await approveInDialog(page);
  await expect(pos(page)).toHaveText("3 / 3 件");
  await page.keyboard.press("k");
  await page.keyboard.press("k");
  m.on.approve = () => err(503, "E-PAGE-003");
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await page.keyboard.press("a");
  await approveInDialog(page);
  await expect(focus(page)).toContainText(msg("E-PAGE-003").split("。")[0]!);
  await expect(pos(page)).toHaveText("3 / 3 件");
  m.on.approve = (req) => ({
    status: 201,
    body: { data: { id: new URL(req.url()).pathname.split("/").at(-2), status_id: "approved" } },
  });
  await page.keyboard.press("a");
  await approveInDialog(page);
  await expect(focus(page).getByRole("heading", { level: 2, name: "決め終わりました", exact: true })).toBeVisible();
});

test("K752-UI-010 中身が読めない：1 件の詳細が 503 ならその面に読めない箱と［もう一度］・J で次へは進める", async ({
  page,
}) => {
  const { m } = await setup(page);
  m.on.detail = () => err(503, "E-PAGE-003");
  await openQueue(page);
  await headBtn(page).click();
  await expect(focus(page)).toBeVisible();
  await expect(focus(page).locator(".k-state")).toBeVisible();
  m.on.detail = (req) => ({ status: 200, body: { data: detailOf(new URL(req.url()).pathname.split("/").at(-1)!) } });
  await focus(page).getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(card(page)).toContainText("株式会社サンプル 御中");
  await page.keyboard.press("j");
  await expect(pos(page)).toHaveText("2 / 3 件");
});

test("K752-UI-011 決めるものが無い：今の一覧の行に AI の成果物が 0 件（渡された行だけ・札で渡されたに絞ったときも）なら［続けて裁く］は押せない形（title「1 件ずつ決めるものがありません」）", async ({
  page,
}) => {
  const m = await mockApi(page);
  m.on.queue = () => ({
    status: 200,
    body: { data: [HANDOVER], meta: { limit: 20, counts: { total: 1, artifact: 0, handover: 1 } } },
  });
  await openQueue(page);
  await expect(headBtn(page)).toHaveAttribute("aria-disabled", "true");
  await expect(headBtn(page)).toHaveAttribute("title", "1 件ずつ決めるものがありません");
});

test("K752-UI-012 操作の揺れ：小窓・入力欄に焦点があるときはキーで動かない（差し戻す理由に「j」と書いても次へ行かない）・承認の二度押しでも口は 1 回", async ({
  page,
}) => {
  const { m } = await setup(page);
  await enter(page);
  await page.keyboard.press("r");
  const box = page.getByRole("dialog", { name: /差し戻/ }).getByRole("textbox", { name: "差し戻す理由", exact: true });
  await box.pressSequentially("jks");
  await expect(box).toHaveValue("jks");
  await page.keyboard.press("Escape");
  await expect(pos(page)).toHaveText("1 / 3 件");
  const open = m.hold();
  await page.keyboard.press("a");
  await approveDlg(page).getByRole("checkbox", { name: "成果物を目で見た", exact: true }).check();
  const ok = approveDlg(page).getByRole("button", { name: /^承認/ });
  await ok.click();
  await ok.click({ force: true });
  open();
  await expect.poll(() => m.approves.length).toBe(1);
});

test("K752-UI-013 道に残す：?focus=1 で開き直すと続けて裁くが開いた形で始まる（1 件目から）", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/approvals?focus=1");
  await expect(focus(page)).toBeVisible();
  await expect(pos(page)).toHaveText("1 / 3 件");
});

test("K752-UI-014 スマホ（375）：見出しの［続けて裁く］から開け、幅 320〜1440 で横溢れ 0・下のボタンが画面の中（下の入口は K-730 の置き場ができてから・申し送り）", async ({
  page,
}) => {
  await setup(page);
  await openQueue(page, 375);
  await headBtn(page).click();
  await expect(focus(page)).toBeVisible();
  for (const w of WIDTHS_ALL) {
    await page.setViewportSize({ width: w, height: 900 });
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    const b = (await focus(page).locator(".k-more-focus-main-act").boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(w);
  }
});

test("K752-UI-015 守り：開くだけでは書く口 0（承認・差し戻し・止める）・1 件の詳細は今の 1 件と次の 1 件まで（先読み）しか読まない・本人の Bridge に飛ばない", async ({
  page,
}) => {
  const { m, details, stops } = await setup(page);
  let bridge = 0;
  await page.route(/127\.0\.0\.1:38617/, (r) => {
    bridge++;
    return r.fulfill({ status: 404, body: "" });
  });
  await enter(page);
  await expect.poll(() => details.length).toBeGreaterThanOrEqual(1);
  expect(new Set(details).size).toBeLessThanOrEqual(2);
  expect(details.every((d) => [A_INLINE, A_OPEN].includes(d))).toBe(true);
  expect(details).not.toContain(A_NODUE);
  expect(m.approves.length + m.returns.length + stops.length).toBe(0);
  expect(bridge).toBe(0);
});

test("K752-UI-019 差し戻す口の失敗：503 なら差し戻す小窓の中に正本の文が出て同じ 1 件のまま・409 は文を出して次へ（数に入れない）", async ({
  page,
}) => {
  const { m } = await setup(page);
  m.on.ret = () => err(503, "E-PAGE-003");
  await enter(page);
  await page.keyboard.press("r");
  const dlg = page.getByRole("dialog", { name: /差し戻/ });
  await dlg.getByRole("textbox", { name: "差し戻す理由", exact: true }).fill("宛名が違う");
  await dlg.getByRole("button", { name: /^差し戻す/ }).click();
  await expect(page.locator("body")).toContainText(msg("E-PAGE-003").split("。")[0]!);
  // 差し戻す小窓が開いている間は層が aria-hidden になるので、位置の字は層の役割を通さずに見る
  await expect(page.locator(".k-more-focus-pos")).toHaveText("1 / 3 件");
  m.on.ret = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  await dlg.getByRole("button", { name: /^差し戻す/ }).click();
  await expect(focus(page)).toContainText(MSG.decided);
  await expect(pos(page)).toHaveText("2 / 3 件");
});

test("K752-UI-020 上限：AI の成果物が 200 件を超えても読むのは 1 回の 200 件まで（「1 / 200 件」・続きは読まない）", async ({
  page,
}) => {
  const many = Array.from({ length: 200 }, (_, i) =>
    qrow(`0193c5a0-0000-7000-8000-${String(1000000000000 + 50000 + i).slice(1)}`, { title: `件 ${i + 1}` }),
  );
  const { queries } = await setup(page, { artifacts: many });
  await enter(page);
  await expect(pos(page)).toHaveText("1 / 200 件");
  expect(queries.filter((q) => q["kind"] === "artifact").length).toBe(1);
  expect(queries.some((q) => q["cursor"])).toBe(false);
});

test("K752-UI-021 並べ替えに従う：一覧を「新しく承認待ちになった順」（?sort=waiting）で開いていれば、続けて裁くも sort=waiting で読む", async ({
  page,
}) => {
  const { queries } = await setup(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/approvals?sort=waiting");
  await headBtn(page).click();
  await expect.poll(() => queries.find((q) => q["kind"] === "artifact")?.["sort"]).toBe("waiting");
});

test("K752-UI-022 ?focus=1 で開いて決めるものが無い・読めない：AI の成果物が 0 件なら終わりの面（承認 0 件・差し戻し 0 件・飛ばした 0 件）・並びの口が 503 なら層の中に読めない箱と［もう一度］", async ({
  page,
}) => {
  const { m } = await setup(page, { artifacts: [] });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/approvals?focus=1");
  await expect(focus(page).getByRole("heading", { level: 2, name: "決め終わりました", exact: true })).toBeVisible();
  await expect(focus(page).getByRole("list", { name: "結果", exact: true }).getByRole("listitem")).toHaveText([
    "承認 0 件",
    "差し戻し 0 件",
    "飛ばした 0 件",
  ]);
  const base = m.on.queue;
  m.on.queue = (req) =>
    new URL(req.url()).searchParams.get("kind") === "artifact" ? err(503, "E-PAGE-003") : base(req);
  await page.reload();
  await expect(focus(page).locator(".k-state")).toBeVisible();
  await expect(focus(page).getByRole("button", { name: "もう一度", exact: true })).toBeVisible();
});

test("K752-UI-023 K で戻った先がもう決めた物：承認した 1 件へ戻ると「承認しました」の字で、承認・差し戻すのキーとボタンは効かない（口を呼ばない）", async ({
  page,
}) => {
  const { m } = await setup(page);
  await enter(page);
  await page.keyboard.press("a");
  await approveInDialog(page);
  await expect(pos(page)).toHaveText("2 / 3 件");
  await page.keyboard.press("k");
  await expect(pos(page)).toHaveText("1 / 3 件");
  await expect(card(page)).toContainText("承認しました");
  await page.keyboard.press("a");
  await page.keyboard.press("r");
  expect(m.approves.length).toBe(1);
  expect(m.returns.length).toBe(0);
  await expect(approveDlg(page)).toHaveCount(0);
});

test("K752-UI-024 止める：［止める］で承認待ちを止める確かめ（K-734）を通り、止める口が 201 なら次の 1 件へ（数には入れない）", async ({
  page,
}) => {
  const { stops } = await setup(page);
  await enter(page);
  await focus(page)
    .locator(".k-more-focus-foot")
    .getByRole("button", { name: /^止める/ })
    .click();
  const d = page.getByRole("alertdialog", { name: /止め/ });
  await d
    .getByRole("button", { name: /止める/ })
    .last()
    .click();
  await expect.poll(() => stops).toEqual([A_INLINE]);
  await expect(pos(page)).toHaveText("2 / 3 件");
});

test("K752-UI-025 キーを押し続ける：押しっぱなしの繰り返し（repeat の keydown）では動かず、1 回押した分だけ次へ", async ({
  page,
}) => {
  await setup(page);
  await enter(page);
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", repeat: i > 0, bubbles: true }));
  });
  await expect(pos(page)).toHaveText("2 / 3 件");
});

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
const p = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
const FOCUS_PAIRS: FidelityPair[] = [
  p("focus", ".k-more-focus", ["x", "y", "width", "height", "background-color"]),
  p("head", ".k-more-focus-head", ["x", "y", "width", "height"]),
  p("h1", ".k-more-focus-head h1", ["x", "y", ...TEXT]),
  p("pos", ".k-more-focus-pos", ["x", "y", "font-size", "color"]),
  p("exit", ".k-more-focus-exit", CTRL),
  p("card", ".k-more-focus-card", BOX),
  p("h2", ".k-more-focus-card h2, .k-more-focus-done h2", ["x", "y", "font-size", "font-weight", "color"]),
  p("meta", ".k-more-focus-meta", ["x", "y", "font-size", "color"]),
  p("keys", ".k-more-focus-keys", ["x", "y", ...TEXT]),
  p("foot", ".k-more-focus-foot", ["x", "y", "width", "height", "background-color"]),
  p("main-act", ".k-more-focus-main-act", CTRL),
  p("skip", ".k-more-f-skip", CTRL),
  p("return", ".k-more-f-return", CTRL),
  p("next", ".k-more-focus-next", ["x", "y", "font-size", "color"]),
  p("tally", ".k-more-tally", ["x", "y", "width", "texts"]),
  p("dialog", '[role="dialog"]:not(.k-more-focus) .k-dialog, [role="alertdialog"]', ["width", "x", "y"]),
];
// 注：下絵の 1 件の字（EG-128 セイコー様…・2 / 9 件・期限と承認の後の動き・次の 2 件）は下絵の固定の値で、試験の承認待ちの土台（EG-133 見積を出す・3 件）と違う。
//   字（h2・pos・meta・next・tally の texts）と、中身の長さで変わる 1 件の箱の高さ（card の height）・その下の keys の y は比べず、箱・字の大きさ・色・位置を比べる
//   （下絵は確認の表 4 行と長い成果物・土台は確認の表なしと短い成果物。確認の表は K-740 の物）
//   幅 375 では h2 の字の長さで h2 が 1 行か 2 行になり、その下の meta の y も変わるので meta の y も比べない（2026-11-28・ほかの幅と x・字の形は比べる）
//   幅 375 の確かめの小窓は下に貼り付く形（下絵と同じ）で、上端の y は中身（注意の行・確認の表）の長さで変わるので比べない（幅・x は比べる）
const SKIP = [
  "h2:texts",
  "pos:texts",
  "meta:texts",
  "next:texts",
  "tally:texts",
  "card:height",
  "keys:y",
  "meta:y",
  "dialog:y",
];
async function match(browser: Browser, id: string, drive: (pg: Page, w: number) => Promise<void>) {
  const bad: string[] = [];
  for (const w of MATCH_WIDTHS) {
    const r = await matchMock(browser, id, w, (pg) => drive(pg, w), {
      pairs: FOCUS_PAIRS,
      base: "/dev/mock/f5",
      skip: SKIP,
    });
    bad.push(...r.bad);
  }
  expect(bad, bad.join("\n")).toEqual([]);
}

test("K752-UI-016 下絵との突き合わせ：focus-card（幅 375・768・1440）", async ({ browser }) => {
  await match(browser, "focus-card", async (pg, w) => {
    await setup(pg);
    await enter(pg, w);
    // 画面の高さも下絵と同じに戻す（openQueue は 1000 で開く。下絵は 812／900・K764-UI-017 と同じ直し）
    await pg.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    await pg.keyboard.press("j");
  });
});
test("K752-UI-017 下絵との突き合わせ：focus-confirm（A で確かめの小窓）", async ({ browser }) => {
  await match(browser, "focus-confirm", async (pg, w) => {
    await setup(pg);
    await enter(pg, w);
    // 画面の高さも下絵と同じに戻す（openQueue は 1000 で開く。下絵は 812／900・K764-UI-017 と同じ直し）
    await pg.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    await pg.keyboard.press("a");
  });
});
test("K752-UI-018 下絵との突き合わせ：focus-done（終わりの面）", async ({ browser }) => {
  await match(browser, "focus-done", async (pg, w) => {
    await setup(pg);
    await enter(pg, w);
    // 画面の高さも下絵と同じに戻す（openQueue は 1000 で開く。下絵は 812／900・K764-UI-017 と同じ直し）
    await pg.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    for (let i = 0; i < 3; i++) await pg.keyboard.press("s");
  });
});
