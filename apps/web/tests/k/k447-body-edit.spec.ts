// K-447「画面：詳細の本文を直す（本文を直す → 編集の形・自動で保存・やめる・書き終える・先に直された）」の画面の試験（実 Chrome・実装より先に積む）。
//   行 ID は 11_tickets/K-447.md の行の表（K447-UI-001〜030）。正の絵：下絵 v2 /dev/mock/f4v2/f4v2-detail-editing（部品 features/F4/doc/）。
//   詳細は K-571 の道具 detail-body-mock.ts、本文を書き終える口は body-edit-mock.ts の BodyServer（版と木の本物の持ち主）で差し替える。
//   本文の部品は K-567（role=textbox・名前「本文」）。固定の待ちは使わない（印・要素・口の答えを待つ）。getByRole／getByText の name は exact。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  BAND_SUB,
  BAND_TITLE,
  BASE_DOC,
  COPY_KEY,
  LOST_SUB,
  LOST_TITLE,
  OTHER_DOC,
  SAVED_AT,
  SAVED_TEXT,
  TID,
  WIDTHS,
  answer,
  bodyServer,
  breakCopyStorage,
  cancelBtn,
  conflict409,
  conflictBand,
  copyOf,
  doc,
  editor,
  enterBtn,
  fail,
  failBox,
  finishBtn,
  frame,
  lostBand,
  mockBodyEdit,
  msg,
  openDetail,
  overflowX,
  P,
  H2,
  readBody,
  seedCopy,
  startEdit,
  statusOf,
  titleActs,
  typeAtEnd,
} from "./body-edit-mock";
import { matchMock } from "./stage2-match";

// 画面の赤い箱。Next の読み上げの部品（next-route-announcer）も role=alert なので外す（k217・k417・k1003 と同じ）
const alertOf = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
/** 写しの自動の保存が済む（帯の印が「自動で保存しました」か「保存できません」になる）まで待つ。下絵の帯は印が出た形 */
const copyMarked = (page: Page) =>
  expect(page.locator('.k-f4d-editband [role="status"]')).not.toHaveAttribute("data-kind", "none");

test.use({ timezoneId: "Asia/Tokyo" });

const ADDED = "（急ぎ）";
const API = (page: Page) => {
  const seen: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (/\/api\/(v1|auth-ext)\//.test(u.pathname)) seen.push(`${r.method()} ${u.pathname}`);
  });
  return seen;
};
const fixClock = (page: Page) => page.clock.setFixedTime(new Date(SAVED_AT));

test("K447-UI-001 入口：読む形の本文の右に「本文を直す」が出る（押せる）。押すまで編集の部品を読み込まず、口は詳細の 6 本のまま・PATCH 0 回。区画ごとの「書く」・枠は無い", async ({
  page,
}) => {
  const seen = API(page);
  const s = bodyServer();
  const m = await mockBodyEdit(page, s);
  const chunks: string[] = [];
  page.on("request", (r) => /tiptap|prosemirror|doc-editor-live/i.test(r.url()) && chunks.push(r.url()));
  await openDetail(page);
  await expect(enterBtn(page)).toBeVisible();
  await expect(readBody(page)).toContainText("届ける");
  await expect(page.getByRole("button", { name: /を書く$/ })).toHaveCount(0);
  await expect(frame(page)).toHaveCount(0);
  expect(chunks, "編集の部品を先に読まない").toEqual([]);
  expect(
    seen.filter((x) => x === `GET /api/v1/tickets/${TID}`),
    "詳細の口は 1 回",
  ).toHaveLength(1);
  expect(m.seen.filter((x) => x.startsWith("PATCH"))).toEqual([]);
  expect(s.calls).toHaveLength(0);
});

test("K447-UI-002 押す：本文が太線の枠・道具の帯つきの編集の形になり、上の帯に空の印・「やめる」「書き終える」。題の行のボタン（複製・版と差分）が引っ込み、本文に焦点。口 0 回", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await openDetail(page);
  await expect(page.getByRole("button", { name: "複製", exact: true })).toBeVisible();
  await enterBtn(page).click();
  await expect(editor(page)).toBeFocused();
  await expect(frame(page)).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "本文の道具", exact: true })).toBeVisible();
  await expect(statusOf(page)).toHaveText("");
  await expect(cancelBtn(page)).toBeVisible();
  await expect(finishBtn(page)).toBeVisible();
  await expect(enterBtn(page)).toHaveCount(0);
  await expect(titleActs(page).getByRole("button")).toHaveCount(0);
  expect(s.calls).toHaveLength(0);
});

test("K447-UI-003 直して書き終える：PATCH 1 回（/body・{ version: 3, doc }・text を送らない・Idempotency-Key つき）。編集の形が閉じ、読み直して読む形が新しい本文・版 4・写しは消える", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  await finishBtn(page).click();
  await expect(frame(page)).toHaveCount(0);
  await expect(readBody(page)).toContainText(`届ける。${ADDED}`);
  expect(s.calls).toHaveLength(1);
  expect(s.calls[0]!.version).toBe(3);
  expect(s.calls[0]!.keys).toEqual(["doc", "version"]);
  expect(JSON.stringify(s.calls[0]!.doc)).toContain(`届ける。${ADDED}`);
  expect(s.calls[0]!.idempotencyKey).toBeTruthy();
  expect(s.version).toBe(4);
  expect(await copyOf(page)).toBeNull();
  await expect(titleActs(page).getByRole("button", { name: "複製", exact: true })).toBeVisible();
});

test("K447-UI-004 何も直さず書き終える：口 0 回・編集の形が閉じる・詳細を読み直さない・写し無し", async ({ page }) => {
  const s = bodyServer();
  const m = await mockBodyEdit(page, s);
  await startEdit(page);
  const reads = m.seen.filter((x) => x === `GET /api/v1/tickets/${TID}`).length;
  await finishBtn(page).click();
  await expect(frame(page)).toHaveCount(0);
  await expect(enterBtn(page)).toBeVisible();
  expect(s.calls).toHaveLength(0);
  expect(m.seen.filter((x) => x === `GET /api/v1/tickets/${TID}`)).toHaveLength(reads);
  expect(await copyOf(page)).toBeNull();
});

test("K447-UI-005 道具で書いた木：太字とチェックの箱を足して書き終えると、doc に bold の印と taskList が木のまま入り、読む形で太字・チェックの箱（押せない）に出る", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.type("太い字");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.press("Enter");
  await page
    .getByRole("toolbar", { name: "本文の道具", exact: true })
    .getByRole("button", { name: "並び", exact: true })
    .click();
  await page.getByRole("menuitemcheckbox", { name: "チェック", exact: true }).click();
  await page.keyboard.type("控えを残す");
  await finishBtn(page).click();
  await expect(frame(page)).toHaveCount(0);
  const sent = JSON.stringify(s.calls[0]!.doc);
  expect(sent).toContain('"type":"bold"');
  expect(sent).toContain('"type":"taskList"');
  await expect(readBody(page).locator("b", { hasText: "太い字" })).toBeVisible(); // 読む形の太字は b（K-577）
  await expect(readBody(page).getByRole("checkbox", { name: "控えを残す" })).toBeDisabled();
});

test("K447-UI-006 本文の行がまだ無いチケット（空の本文）：入口が出て、書き終えると version 0 で最初の版を送り、読む形に出る", async ({
  page,
}) => {
  const s = bodyServer(0, doc());
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, "はじめの一文");
  await finishBtn(page).click();
  await expect(readBody(page)).toContainText("はじめの一文");
  expect(s.calls[0]!.version).toBe(0);
  expect(s.version).toBe(1);
});

test("K447-UI-007 自動で保存：打つと印「自動で保存しました（10:42）」が出て、この PC の写し（鍵 kaname.ticket-draft.body.<id>・{ savedAt, doc, base: 3 }）が残る。口 0 回・版は増えない。印の title に「この PC の中だけ」の注", async ({
  page,
}) => {
  await fixClock(page);
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  await expect(statusOf(page)).toHaveText(SAVED_TEXT);
  const c = await copyOf(page);
  expect(c!.base).toBe(3);
  expect(c!.savedAt).toBe(SAVED_AT);
  expect(JSON.stringify(c!.doc)).toContain(ADDED);
  expect(COPY_KEY.startsWith("kaname.ticket-draft")).toBe(true);
  await expect(statusOf(page)).toHaveAttribute("title", /この PC/);
  expect(s.calls).toHaveLength(0);
  expect(s.version).toBe(3);
});

test("K447-UI-008 写しを置けない（保存で例外）：印が「自動で保存できませんでした。書き終えるまで、この画面を閉じないでください」（data-kind=failed）。書き続けられ、書き終えるで口に 1 回送れる", async ({
  page,
}) => {
  await breakCopyStorage(page);
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  const st = statusOf(page);
  await expect(st).toHaveText("自動で保存できませんでした。書き終えるまで、この画面を閉じないでください");
  await expect(st).toHaveAttribute("data-kind", "failed");
  await finishBtn(page).click();
  await expect(frame(page)).toHaveCount(0);
  expect(s.calls).toHaveLength(1);
});

test("K447-UI-009 再読み込み：写しがあると編集の形で開き直し、書きかけの字と印（写しの時刻）が戻る。PATCH 0 回", async ({
  page,
}) => {
  await fixClock(page);
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  await expect(statusOf(page)).toHaveText(SAVED_TEXT);
  await page.reload();
  await expect(editor(page)).toBeVisible();
  await expect(editor(page)).toContainText(`届ける。${ADDED}`);
  await expect(statusOf(page)).toHaveText(SAVED_TEXT);
  await expect(conflictBand(page)).toHaveCount(0);
  expect(s.calls).toHaveLength(0);
});

test("K447-UI-010 写しの版が古い（写しの元の版 2・今は 3）：開き直すと編集の形で、本文の上に帯「ほかの人が先に直しました」。書きかけは残る・PATCH 0 回", async ({
  page,
}) => {
  await seedCopy(page, { savedAt: SAVED_AT, base: 2, doc: doc(H2("目的"), P(`書きかけ${ADDED}`)) });
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await openDetail(page);
  await expect(editor(page)).toContainText(`書きかけ${ADDED}`);
  await expect(conflictBand(page)).toContainText(BAND_SUB);
  expect(s.calls).toHaveLength(0);
});

test("K447-UI-011 写しが壊れている（JSON でない・木でない）：捨てて読む形のまま開く（編集の形にならず、エラーも出ない）", async ({
  page,
}) => {
  await seedCopy(page, "{これはJSONではない");
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await openDetail(page);
  await expect(enterBtn(page)).toBeVisible();
  await expect(frame(page)).toHaveCount(0);
  await expect(alertOf(page)).toHaveCount(0);
  await expect.poll(() => copyOf(page).catch(() => "broken")).toBeNull();
});

test("K447-UI-012 やめる（直していない）：確かめの小窓なしで読む形に戻り、写しが消える。口 0 回", async ({ page }) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await cancelBtn(page).click();
  await expect(frame(page)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(enterBtn(page)).toBeVisible();
  expect(await copyOf(page)).toBeNull();
  expect(s.calls).toHaveLength(0);
});

test("K447-UI-013 やめる（直した後）：小窓「書いた内容を捨てますか」。「書き続ける」で戻り書いた字が残る。「捨てる」で読む形に戻り本文は元のまま・写しが消える。口 0 回", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  await cancelBtn(page).click();
  const dlg = page.getByRole("dialog", { name: "書いた内容を捨てますか", exact: true });
  await expect(dlg).toContainText("やめると、いま書いている内容は消えます。");
  await dlg.getByRole("button", { name: "書き続ける", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  await expect(editor(page)).toContainText(ADDED);
  await cancelBtn(page).click();
  await page
    .getByRole("dialog", { name: "書いた内容を捨てますか", exact: true })
    .getByRole("button", { name: "捨てる", exact: true })
    .click();
  await expect(frame(page)).toHaveCount(0);
  await expect(readBody(page)).not.toContainText(ADDED);
  expect(await copyOf(page)).toBeNull();
  expect(s.calls).toHaveLength(0);
});

test("K447-UI-014 先に直された（口の 409・E-SEC-004）：本文の上に固定の字の帯（題「ほかの人が先に直しました」・要約・「比べる」「読み直す」）。書いた字は残り編集の形は開いたまま。詳細を読み直す。赤い箱は出ない", async ({
  page,
}) => {
  const s = bodyServer();
  const m = await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  s.elsewhere();
  const reads = m.seen.filter((x) => x === `GET /api/v1/tickets/${TID}`).length;
  await finishBtn(page).click();
  const band = conflictBand(page);
  await expect(band).toContainText(BAND_SUB);
  await expect(band.getByRole("button", { name: "比べる", exact: true })).toBeVisible();
  await expect(
    band
      .getByRole("button", { name: "読み直す", exact: true })
      .or(band.getByRole("link", { name: "読み直す", exact: true })),
  ).toBeVisible();
  await expect(editor(page)).toContainText(ADDED);
  await expect(alertOf(page)).toHaveCount(1);
  expect(m.seen.filter((x) => x === `GET /api/v1/tickets/${TID}`)).toHaveLength(reads + 1);
  expect(s.version).toBe(4);
});

test("K447-UI-015 帯が出た後、もう一度書き終える：読み直した新しい版（4）で送って 200。編集の形と帯が閉じ、読む形が自分の文。PATCH は合計 2 回", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  s.elsewhere();
  await finishBtn(page).click();
  await expect(conflictBand(page)).toBeVisible();
  await finishBtn(page).click();
  await expect(frame(page)).toHaveCount(0);
  await expect(conflictBand(page)).toHaveCount(0);
  await expect(readBody(page)).toContainText(ADDED);
  expect(s.calls.map((c) => c.version)).toEqual([3, 4]);
  expect(s.version).toBe(5);
});

test("K447-UI-016 帯の「比べる」：新しいタブで版と差分の頁（/tickets/<id>/versions）が開き、書いている画面・書いた字・帯は残る（口は呼ばない）", async ({
  page,
  context,
}) => {
  await context.route(/\/tickets\/[^/]+\/versions/, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>versions</body></html>" }),
  );
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  s.elsewhere();
  await finishBtn(page).click();
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    conflictBand(page)
      .getByRole("button", { name: "比べる", exact: true })
      .or(conflictBand(page).getByRole("link", { name: "比べる", exact: true }))
      .click(),
  ]);
  await expect(popup).toHaveURL(new RegExp(`/tickets/${TID}/versions$`));
  await expect(conflictBand(page)).toBeVisible();
  await expect(editor(page)).toContainText(ADDED);
  expect(s.calls).toHaveLength(1);
});

test("K447-UI-017 帯の「読み直す」：書いた字を捨てて先に直された本文を編集欄に読み込み、帯が消える（編集の形は開いたまま・口は呼ばない・写しは今の版の物に替わる）", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  s.elsewhere();
  await finishBtn(page).click();
  const band = conflictBand(page);
  await expect(band).toBeVisible();
  await band
    .getByRole("button", { name: "読み直す", exact: true })
    .or(band.getByRole("link", { name: "読み直す", exact: true }))
    .click();
  await expect(conflictBand(page)).toHaveCount(0);
  await expect(editor(page)).toContainText("期日までに届ける");
  await expect(editor(page)).not.toContainText(ADDED);
  await expect(frame(page)).toBeVisible();
  expect(s.calls).toHaveLength(1);
  await expect.poll(async () => (await copyOf(page))?.base ?? 4).toBe(4);
});

test("K447-UI-018 別のタブで同じ本文を直す：タブ A が先に書き終えると、タブ B の書き終えるは 409 で帯が出て、B の書いた字は残る。B がもう一度で上書きできる（版は A 4・B 5）", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ timezoneId: "Asia/Tokyo" });
  const s = bodyServer();
  const a = await ctx.newPage();
  const b = await ctx.newPage();
  await mockBodyEdit(a, s);
  await mockBodyEdit(b, s);
  await startEdit(a);
  await startEdit(b);
  await typeAtEnd(a, "（A）");
  await typeAtEnd(b, "（B）");
  await finishBtn(a).click();
  await expect(frame(a)).toHaveCount(0);
  await finishBtn(b).click();
  await expect(conflictBand(b)).toContainText(BAND_SUB);
  await expect(editor(b)).toContainText("（B）");
  await finishBtn(b).click();
  await expect(frame(b)).toHaveCount(0);
  expect(s.calls.map((c) => c.version)).toEqual([3, 3, 4]);
  expect(s.version).toBe(5);
  await ctx.close();
});

test("K447-UI-019 口が 403（書けない人）：本文の上の赤い箱（role=alert）に E-PAGE-002 の文。編集の形は開いたまま・書いた字は残る・口 1 回・読み直さない", async ({
  page,
}) => {
  const s = bodyServer();
  const m = await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  s.replies.push(fail(403, "FORBIDDEN", "forbidden"));
  const reads = m.seen.filter((x) => x === `GET /api/v1/tickets/${TID}`).length;
  await finishBtn(page).click();
  await expect(failBox(page, msg("E-PAGE-002"))).toBeVisible();
  await expect(editor(page)).toContainText(ADDED);
  expect(s.calls).toHaveLength(1);
  expect(m.seen.filter((x) => x === `GET /api/v1/tickets/${TID}`)).toHaveLength(reads);
});

test("K447-UI-020 口が 503（E-PAGE-003）：赤い箱に文・書いた字は残る。もう一度書き終えると同じ中身で 2 回目を送り、通ると編集の形も赤い箱も閉じる", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  s.replies.push(fail(503, "E-PAGE-003", "unavailable"));
  await finishBtn(page).click();
  await expect(failBox(page, msg("E-PAGE-003"))).toBeVisible();
  await expect(editor(page)).toContainText(ADDED);
  await finishBtn(page).click();
  await expect(frame(page)).toHaveCount(0);
  await expect(alertOf(page)).toHaveCount(0);
  expect(s.calls).toHaveLength(2);
  expect(JSON.stringify(s.calls[1]!.doc)).toBe(JSON.stringify(s.calls[0]!.doc));
});

test("K447-UI-021 口が 404（code E-PAGE-001＝消えた・NOT_FOUND＝無い id の 2 通り）：どちらも赤い箱に E-PAGE-001 の文・書いた字は残る・編集の形は開いたまま", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  for (const r of [fail(404, "E-PAGE-001", "not_found"), fail(404, "NOT_FOUND", "not_found")]) {
    s.replies.push(r);
    await finishBtn(page).click();
    await expect(failBox(page, msg("E-PAGE-001"))).toBeVisible();
    await expect(editor(page)).toContainText(ADDED);
  }
  expect(s.calls).toHaveLength(2);
});

test("K447-UI-022 網が切れた（口に届かない）：赤い箱に E-PAGE-008 の文・書いた字は残る。もう一度押すと送れて編集の形が閉じる（PATCH は合計 2 回）", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  s.replies.push("network");
  await finishBtn(page).click();
  await expect(failBox(page, msg("E-PAGE-008"))).toBeVisible();
  await expect(editor(page)).toContainText(ADDED);
  await finishBtn(page).click();
  await expect(frame(page)).toHaveCount(0);
  expect(s.calls).toHaveLength(2);
});

test("K447-UI-023 口が 401（ログインが切れた）：入り直しへは勝手に移さず、本文の上に赤い帯（題・要約・「ログインし直す」）。書いた字は残り口 1 回。押すと /login?next=… へ移り、この PC の写しが消える", async ({
  page,
}) => {
  await fixClock(page);
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  await expect(statusOf(page)).toHaveText(SAVED_TEXT);
  s.replies.push(fail(401, "UNAUTHENTICATED", "unauthenticated"));
  await finishBtn(page).click();
  const band = lostBand(page);
  await expect(band).toContainText(LOST_SUB);
  await expect(page).toHaveURL(new RegExp(`/tickets/${TID}$`));
  await expect(editor(page)).toContainText(ADDED);
  expect(s.calls).toHaveLength(1);
  await band.getByRole("button", { name: "ログインし直す", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(await page.evaluate((k) => window.localStorage.getItem(k), COPY_KEY)).toBeNull();
});

test("K447-UI-024 1MB を超える（口が 413）：赤い箱に口の文「送る内容が大きすぎます」・書いた字は残る・編集の形は開いたまま", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  s.replies.push({
    status: 413,
    body: { error: "payload_too_large", code: "PAYLOAD_TOO_LARGE", message: "送る内容が大きすぎます" },
  });
  await finishBtn(page).click();
  await expect(failBox(page, "送る内容が大きすぎます")).toBeVisible();
  await expect(editor(page)).toContainText(ADDED);
  expect(s.calls).toHaveLength(1);
});

test("K447-UI-025 入口が出ない：完了したチケット・前の形（本文の行が無く区画の字だけがある）のチケットでは「本文を直す」が出ず、本文（前の形は区画の字）は読める", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s, { completed: { at: "2026-11-21T00:30:00Z", by: "高本" } });
  await openDetail(page);
  await expect(readBody(page)).toContainText("届ける");
  await expect(enterBtn(page)).toHaveCount(0);
  const p2 = await page.context().newPage();
  const s2 = bodyServer(0, doc());
  await mockBodyEdit(p2, s2, {
    sections: [{ key: "purpose", label: "目的", body: { text: "前の形の目的の字" }, version: 1 }],
  });
  await openDetail(p2);
  await expect(p2.getByText("前の形の目的の字")).toBeVisible();
  await expect(enterBtn(p2)).toHaveCount(0);
});

test("K447-UI-026 完了にされた後で書き終える（口の 409・E-SEC-005）：赤い箱に E-SEC-005 の文・書いた字は残る・帯（先に直された）は出ない。もう一度送っても同じ", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  s.replies.push(conflict409("E-SEC-005"), conflict409("E-SEC-005"));
  for (let i = 0; i < 2; i++) {
    await finishBtn(page).click();
    await expect(failBox(page, msg("E-SEC-005"))).toBeVisible();
  }
  await expect(conflictBand(page)).toHaveCount(0);
  await expect(editor(page)).toContainText(ADDED);
  expect(s.calls).toHaveLength(2);
});

test("K447-UI-027 二度押し：答えを止めた間に書き終えるを 2 回押しても口は 1 回。押している間ボタンは押せない（busy）。答えると編集の形が閉じる", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await startEdit(page);
  await typeAtEnd(page, ADDED);
  const release = s.hold();
  await finishBtn(page).click();
  await expect.poll(() => s.calls.length).toBe(1);
  await expect(finishBtn(page)).toBeDisabled();
  await finishBtn(page)
    .click({ force: true })
    .catch(() => undefined);
  expect(s.calls).toHaveLength(1);
  release();
  await expect(frame(page)).toHaveCount(0);
  expect(s.calls).toHaveLength(1);
});

test("K447-UI-028 キーボードだけ：「本文を直す」に焦点 → Enter で本文に焦点。字を打ち、「書き終える」に焦点を移して Enter で保存（PATCH は { version: 3, doc } 1 回）", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  await openDetail(page);
  await enterBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(ADDED);
  await finishBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(frame(page)).toHaveCount(0);
  expect(s.calls).toHaveLength(1);
  expect(JSON.stringify(s.calls[0]!.doc)).toContain(ADDED);
});

test("K447-UI-029 幅 375・768・1440：読む形・編集の形・帯（先に直された）のどれも横溢れ 0。「本文を直す」の高さ 24px 以上。「やめる」「書き終える」と編集の欄が画面の幅の中", async ({
  page,
}) => {
  const s = bodyServer();
  await mockBodyEdit(page, s);
  for (const w of WIDTHS) {
    await openDetail(page, w);
    expect(await overflowX(page), `読む形 ${w}`).toBe(0);
    expect((await enterBtn(page).boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await enterBtn(page).click();
    await expect(editor(page)).toBeVisible();
    expect(await overflowX(page), `編集の形 ${w}`).toBe(0);
    for (const loc of [cancelBtn(page), finishBtn(page), frame(page)]) {
      const bx = (await loc.boundingBox())!;
      expect(bx.x).toBeGreaterThanOrEqual(0);
      expect(bx.x + bx.width).toBeLessThanOrEqual(w);
    }
    await typeAtEnd(page, "。");
    s.elsewhere();
    await finishBtn(page).click();
    await expect(conflictBand(page)).toBeVisible();
    expect(await overflowX(page), `帯 ${w}`).toBe(0);
    await page.evaluate((k) => window.localStorage.removeItem(k), COPY_KEY);
  }
  void answer;
});

const PAIRS: FidelityPair[] = [
  {
    name: "band",
    role: "band",
    canvas: ".k-f4d-editband",
    app: ".k-f4d-editband",
    props: ["height", "background-color", "border-top-color", "font-size", "color", "texts"],
  },
  {
    name: "acts",
    role: "acts",
    canvas: ".k-f4d-editband-acts button",
    app: ".k-f4d-editband-acts button",
    props: ["width", "height", "x", "font-size", "color", "background-color", "texts"],
  },
  {
    name: "frame",
    role: "frame",
    canvas: ".k-f4d-editor",
    app: ".k-f4d-editor",
    props: ["border-top-color", "border-top-left-radius", "background-color"],
  },
  { name: "bar", role: "bar", canvas: ".k-f4d-bar", app: ".k-f4d-bar", props: ["height", "background-color"] },
];
void [OTHER_DOC, BASE_DOC, BAND_TITLE, LOST_TITLE];
const NOTICE_PAIRS: FidelityPair[] = [
  {
    name: "notice",
    role: "notice",
    canvas: ".k-f4d-notice",
    app: ".k-f4d-notice",
    props: ["font-size", "color", "texts"],
  },
  {
    name: "notice-btn",
    role: "notice-btn",
    canvas: ".k-f4d-notice button",
    app: ".k-f4d-notice button",
    props: ["height", "font-size", "color", "texts"],
  },
];
const ENTER_PAIRS: FidelityPair[] = [
  {
    name: "enter",
    role: "enter",
    canvas: ".k-f4d-enter button",
    app: ".k-f4d-enter button",
    props: ["height", "font-size", "color", "texts"],
  },
];
const DIALOG_PAIRS: FidelityPair[] = [
  {
    name: "dialog",
    role: "dialog",
    canvas: ".k-dialog",
    app: ".k-dialog",
    props: ["width", "background-color", "border-top-left-radius"],
  },
  {
    name: "dialog-btn",
    role: "dialog-btn",
    canvas: ".k-dialog-actions button",
    app: ".k-dialog-actions button",
    props: ["height", "font-size", "color", "texts"],
  },
];
const STATES: { id: string; pairs: FidelityPair[]; setup: (page: Page, w: number) => Promise<void> }[] = [
  {
    id: "f4v2-detail-editing",
    pairs: PAIRS,
    setup: async (page, w) => {
      await fixClock(page);
      await mockBodyEdit(page, bodyServer());
      await startEdit(page, w);
      await typeAtEnd(page, "。");
      await expect(statusOf(page)).toHaveText(SAVED_TEXT);
    },
  },
  {
    id: "f4v2-detail-edit-enter",
    pairs: ENTER_PAIRS,
    setup: async (page, w) => {
      await mockBodyEdit(page, bodyServer());
      await openDetail(page, w);
      await expect(enterBtn(page)).toBeVisible();
    },
  },
  {
    id: "f4v2-detail-edit-discard",
    pairs: [...PAIRS.filter((p) => p.name === "band"), ...DIALOG_PAIRS],
    setup: async (page, w) => {
      await fixClock(page);
      await mockBodyEdit(page, bodyServer());
      await startEdit(page, w);
      await typeAtEnd(page, "。");
      await copyMarked(page);
      await cancelBtn(page).click();
      await expect(page.getByRole("dialog", { name: "書いた内容を捨てますか", exact: true })).toBeVisible();
    },
  },
  {
    id: "f4v2-detail-edit-conflict",
    pairs: [...PAIRS.filter((p) => p.name === "band"), ...NOTICE_PAIRS],
    setup: async (page, w) => {
      await fixClock(page); // 下絵の帯の時刻（10:42）にそろえる（discard・session と同じ）
      const s = bodyServer();
      await mockBodyEdit(page, s);
      await startEdit(page, w);
      await typeAtEnd(page, ADDED);
      await copyMarked(page);
      s.elsewhere();
      await finishBtn(page).click();
      await expect(conflictBand(page)).toBeVisible();
    },
  },
  {
    id: "f4v2-detail-edit-session",
    pairs: [...PAIRS.filter((p) => p.name === "band"), ...NOTICE_PAIRS],
    setup: async (page, w) => {
      await fixClock(page);
      const s = bodyServer();
      await mockBodyEdit(page, s);
      await startEdit(page, w);
      await typeAtEnd(page, ADDED);
      await copyMarked(page);
      s.replies.push(fail(401, "UNAUTHENTICATED", "unauthenticated"));
      await finishBtn(page).click();
      await expect(lostBand(page)).toBeVisible();
    },
  },
  {
    id: "f4v2-detail-edit-failed",
    pairs: [...PAIRS.filter((p) => p.name === "band"), ...NOTICE_PAIRS],
    setup: async (page, w) => {
      await breakCopyStorage(page);
      const s = bodyServer();
      await mockBodyEdit(page, s);
      await startEdit(page, w);
      await typeAtEnd(page, ADDED);
      await copyMarked(page);
      s.replies.push(fail(403, "FORBIDDEN", "forbidden"));
      await finishBtn(page).click();
      await expect(failBox(page, msg("E-PAGE-002"))).toBeVisible();
    },
  },
];
for (const s of STATES) {
  test(`K447-UI-030 下絵との突き合わせ（${s.id} × 幅 375・768・1440）：入口・上の帯（印・やめる・書き終える）・太線の枠・道具の帯・確かめの小窓・先に直された／ログイン切れ／断りの帯が下絵と同じ値（px は ±2）`, async ({
    browser,
  }) => {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(browser, s.id, w, (page) => s.setup(page, w), {
        base: "/dev/mock/f4v2",
        pairs: s.pairs,
        blur: true,
      });
      expect(rows.length, `${s.id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  });
}
