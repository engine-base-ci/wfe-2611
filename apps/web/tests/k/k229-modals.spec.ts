// K-229「承認の確かめの小窓（承認して送ります）と小窓の型（完了・差し戻し）をキャンバスに合わせる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas/StModal.dc.html（承認して送ります・差し戻す）と StCompleteModal.dc.html（K-219・完了にする）。
//   口は網の手前で差し替える（前からの土台 approve-complete.harness.ts）。承認の道具は tests/k/approve-modal.ts。
//   決める人の決め：承認は押してすぐ実行せず確かめの小窓を通す（D-143.4）。取り消せない確かめは × を持たず、足の「やめる」と Esc で閉じる。
//   承認では本人確認を取り直さない（D-128.177）。ふつうの小窓は開いたときのフォーカスを本文の最初の欄に置く。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  A_INLINE,
  A_OPEN,
  MSG,
  QUEUE,
  bandOf,
  dialog,
  executedBand,
  mockApi,
  openComplete,
  openQueue,
  openReturn,
  openTicketSettled,
  pending,
  reasonBox,
  rowOf,
  tickSettled,
  ticketOf,
  type Band,
} from "../features/F5/approve-complete.harness";
import { approveDialog, approveVia, confirmApprove, confirmButton, seenBox } from "./approve-modal";
import {
  LINE,
  ROOT,
  WHITE,
  WIDTHS,
  box,
  countWrites,
  cssOf,
  expectInert,
  fidelityCompareTests,
  fidelityConfigTest,
  opacityOf,
  DISABLED_OPACITY,
  overflowX,
} from "./kit";
import { controlsOf } from "../_lib/row";

const NAVY = "rgb(34, 52, 92)";
const INK = "rgb(19, 27, 39)";
const RED_BG = "rgb(253, 236, 236)";
const RED_LINE = "rgb(243, 199, 199)";
const RED_INK = "rgb(153, 27, 27)";
const sendBtn = (page: Page) => bandOf(page).getByRole("button", { name: "承認して送る" });
/** 読み直しが続く承認待ち（24 時間の聞き直し・承認の後の実行は PC が閉じていて待っている・K247 と同じ形） */
const reask: Band = {
  stage: "awaiting_approval",
  approval: pending({ note: MSG.note24h }),
  run: { phase: "execute", status: "queued", pc: "asleep" },
};
const runningAfter = () => ({
  status: 200,
  body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "running", pc: "live" } }) },
});

/** 小窓の形（頭の線・題・足の線・ボタン）を見る */
async function expectModalShape(d: Locator, title: string) {
  const t = d.locator(".k-dialog-title");
  await expect(t).toHaveText(title);
  expect(await cssOf(t, "font-size")).toBe("15px");
  expect(await cssOf(t, "font-weight")).toBe("700");
  expect(await cssOf(d.locator(".k-dialog-head"), "border-bottom-color")).toBe(LINE);
  expect(await cssOf(d.locator(".k-dialog-actions"), "border-top-color")).toBe(LINE);
  const cancel = d.locator(".k-dialog-actions").getByRole("button", { name: "やめる" });
  expect(await cssOf(cancel, "background-color")).toBe(WHITE);
  expect(await cssOf(cancel, "border-top-color")).toBe(LINE);
  expect(await cssOf(cancel, "color")).toBe(INK);
  await expect(cancel).toHaveAttribute("data-variant", "outlined");
  const primary = d.locator('.k-dialog-actions .k-btn[data-variant="primary"]');
  await expect(primary).toHaveCount(1);
  expect(await cssOf(primary, "background-color")).toBe(NAVY);
  expect(Math.round((await box(primary)).height)).toBe(34);
}

test("K229-UI-001 帯の「承認して送る」を押すと、口を呼ばずに確かめの小窓（role=alertdialog）「承認して送ります」が開く", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  await expect(approveDialog(page)).toBeVisible();
  await expect(approveDialog(page).locator(".k-dialog-title")).toHaveText("承認して送ります");
  expect(m.approves).toHaveLength(0);
});

test("K229-UI-002 確かめの小窓の形：題 15px・700・頭の下と足の上に 1px #DDE2E9・× が無い・やめる（outlined）と 承認して送る（紺・高さ 34）", async ({
  page,
}) => {
  await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  const d = approveDialog(page);
  await expectModalShape(d, "承認して送ります");
  await expect(d.getByRole("button", { name: "閉じる" })).toHaveCount(0);
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText(["やめる", "承認して送る"]);
});

test("K229-UI-003 取り消せない注意：小窓の中の赤い箱（#FDECEC・線 #F3C7C7・字 #991B1B）に「取り消せません」。本人確認（パスキー）の文も口も無い（D-128.177）", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  const red = approveDialog(page).locator(".k-dialog-caution");
  await expect(red).toContainText("取り消せません");
  expect(await cssOf(red, "background-color")).toBe(RED_BG);
  expect(await cssOf(red, "border-top-color")).toBe(RED_LINE);
  expect(await cssOf(red, "color")).toBe(RED_INK);
  await expect(approveDialog(page)).not.toContainText("本人確認");
  await confirmApprove(page);
  await expect.poll(() => m.approves.length).toBe(1);
  expect(m.stepUps).toHaveLength(0);
});

test("K229-UI-004 「成果物を目で見た」：印を付けるまで「承認して送る」は押せず（押しても口を呼ばない）、付けると押せる", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  await expect(seenBox(page)).not.toBeChecked();
  await expect(confirmButton(page)).toBeDisabled();
  await confirmButton(page).dispatchEvent("click");
  expect(m.approves).toHaveLength(0);
  await seenBox(page).check();
  await expect(confirmButton(page)).toBeEnabled();
});

test("K229-UI-005 開いたときのフォーカスは「やめる」（主ボタンにも × にも乗らない）", async ({ page }) => {
  await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  await expect(approveDialog(page).getByRole("button", { name: "やめる" })).toBeFocused();
});

test("K229-UI-006 「やめる」と Esc：どちらも口を呼ばずに閉じ、フォーカスは帯の「承認して送る」に戻る。帯は元のまま", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  await approveDialog(page).getByRole("button", { name: "やめる" }).click();
  await expect(approveDialog(page)).toHaveCount(0);
  await expect(sendBtn(page)).toBeFocused();
  await sendBtn(page).click();
  await page.keyboard.press("Escape");
  await expect(approveDialog(page)).toHaveCount(0);
  expect(m.approves).toHaveLength(0);
  await expect(bandOf(page)).toContainText(MSG.waitingMe);
});

test("K229-UI-007 小窓の「承認して送る」：承認の口に 1 回（体は空・冪等キーつき）。小窓が閉じ、帯が「実行中」に替わる", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  m.on.ticket = runningAfter;
  await approveVia(page, sendBtn(page));
  await expect.poll(() => m.approves.length).toBe(1);
  expect(m.approves[0]).toMatchObject({ id: A_OPEN, body: {} });
  expect(m.approves[0]!.key).toBeTruthy();
  await expect(approveDialog(page)).toHaveCount(0);
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
});

test("K229-UI-008 2 回押し：答えを待つ間は小窓の主ボタンと帯のボタンが押せず、押せない間に押しても口は 1 回", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  const release = m.hold();
  await sendBtn(page).click();
  await seenBox(page).check();
  await confirmButton(page).click();
  await expect.poll(() => m.approves.length).toBe(1);
  await expect(confirmButton(page)).toBeDisabled();
  await confirmButton(page).dispatchEvent("click");
  // 帯は小窓の外で読み上げの木から外れる（modal）ので、CSS で探して押せないことを見る
  await expect(page.locator('section[aria-label="承認と実行"] button', { hasText: "承認して送る" })).toBeDisabled();
  m.on.ticket = runningAfter;
  release();
  await expect(approveDialog(page)).toHaveCount(0);
  expect(m.approves).toHaveLength(1);
});

test("K229-UI-009 決まっていた（409）：小窓が閉じ、知らせ（role=alert・1 つ）に「この承認はもう処理されています」、チケットを読み直す", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  m.on.approve = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  m.on.ticket = runningAfter;
  await approveVia(page, sendBtn(page));
  await expect(approveDialog(page)).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toHaveCount(1);
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
});

test("K229-UI-010 取り消せる承認（帯の「承認する」）：小窓の題は「承認します」・赤い箱も目で見たも無く・主ボタン「承認する」で口に 1 回", async ({
  page,
}) => {
  const m = await mockApi(page, { stage: "awaiting_approval", approval: pending({ irreversible: false }) });
  m.on.detail = (req) => ({
    status: 200,
    body: {
      data: {
        approval: { id: new URL(req.url()).pathname.split("/").at(-1) },
        artifact_version: { version: 1, text: "戻せる記録" },
        cautions: [],
        check_summary: MSG.checkNone,
        irreversible: false,
        can_decide: true,
      },
    },
  });
  await openTicketSettled(page);
  await bandOf(page).getByRole("button", { name: "承認する", exact: true }).click();
  const d = approveDialog(page);
  await expect(d.locator(".k-dialog-title")).toHaveText("承認します");
  await expect(d.locator(".k-dialog-caution")).toHaveCount(0);
  await expect(seenBox(page)).toHaveCount(0);
  await d.getByRole("button", { name: "承認する", exact: true }).click();
  await expect.poll(() => m.approves.length).toBe(1);
});

test("K229-UI-011 承認待ちの行の「承認する」：小窓「承認します」を通してから口に 1 回。行が消え、見出しの横の数が 1 減る", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openQueue(page);
  await rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true }).click();
  await expect(approveDialog(page).locator(".k-dialog-title")).toHaveText("承認します");
  expect(m.approves).toHaveLength(0);
  const after = QUEUE().filter((x) => x.id !== A_INLINE);
  m.on.queue = () => ({ status: 200, body: { data: after, meta: { limit: 20, counts: { total: 2 } } } });
  await confirmApprove(page);
  await expect(rowOf(page, "見積を出す")).toHaveCount(0);
  expect(m.approves).toHaveLength(1);
  expect(m.approves[0]).toMatchObject({ id: A_INLINE, body: {} });
  await expect(page.getByRole("main").getByText("2 件", { exact: true })).toBeVisible();
});

test("K229-UI-012 揺れの守り：小窓を開いたまま 3 秒の読み直しが 10 回入っても、小窓は閉じず同じ節のまま・目で見たの印も残り、送ると口は 1 回", async ({
  page,
}) => {
  const m = await mockApi(page, reask);
  await page.clock.install();
  await openTicketSettled(page);
  await sendBtn(page).click();
  await seenBox(page).check();
  await approveDialog(page).evaluate((el) => {
    const w = window as unknown as { __k229: Element; __k229gone: number };
    w.__k229 = el;
    w.__k229gone = 0;
    new MutationObserver((ms) => {
      for (const x of ms) for (const n of Array.from(x.removedNodes)) if (n === el || n.contains(el)) w.__k229gone++;
    }).observe(document, { childList: true, subtree: true });
  });
  for (let i = 0; i < 10; i++) await tickSettled(page);
  expect(
    await page.evaluate(() => {
      const w = window as unknown as { __k229: Element; __k229gone: number };
      return { connected: w.__k229.isConnected, gone: w.__k229gone };
    }),
  ).toEqual({ connected: true, gone: 0 });
  await expect(seenBox(page)).toBeChecked();
  await confirmButton(page).click();
  await expect.poll(() => m.approves.length).toBe(1);
});

test("K229-UI-013 揺れの守り：開く → 小窓で送る を 20 回続けても毎回ちょうど 1 回だけ口に届き、時間切れが無い（流し直しなし）", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const m = await mockApi(page);
  for (let i = 1; i <= 20; i++) {
    m.on.ticket = () => ({
      status: 200,
      body: { data: ticketOf({ stage: "awaiting_approval", approval: pending() }) },
    });
    await openTicketSettled(page);
    m.on.ticket = runningAfter;
    await approveVia(page, sendBtn(page));
    await expect.poll(() => m.approves.length, `${i} 回目`).toBe(i);
    await expect(approveDialog(page), `${i} 回目`).toHaveCount(0);
  }
});

test("K229-UI-014 確かめの小窓の位置と幅：幅 1440 は幅 380・上から 60px・左右の真ん中。幅 375 は幅 327（左右 24px）・上から 60px", async ({
  page,
}) => {
  await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  let b = await box(approveDialog(page));
  expect(Math.round(b.width)).toBe(380);
  expect(Math.round(b.y)).toBe(60);
  expect(Math.abs(b.x - (1440 - 380) / 2)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 375, height: 1000 });
  await sendBtn(page).click();
  b = await box(approveDialog(page));
  expect(Math.round(b.width)).toBe(327);
  expect(Math.round(b.x)).toBe(24);
  expect(Math.round(b.y)).toBe(60);
});

test("K229-UI-015 完了の小窓の型：題「完了にする」15px・700・頭と足の線・やめる（outlined）と 確かめて完了にする（紺・高さ 34）・幅 420・上から 60px・真ん中", async ({
  page,
}) => {
  await mockApi(page, executedBand);
  await openTicketSettled(page);
  await openComplete(page);
  const d = dialog(page);
  await expectModalShape(d, "完了にする");
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText(["やめる", "確かめて完了にする"]);
  const b = await box(d);
  expect(Math.round(b.width)).toBe(420);
  expect(Math.round(b.y)).toBe(60);
  expect(Math.abs(b.x - (1440 - 420) / 2)).toBeLessThanOrEqual(1);
});

test("K229-UI-016 完了の小窓の中身の区切り：頭に「EG-133 11 月分の請求書を送る」（12px・灰）、完了の条件の見出し（12px・500）と文、実施事項は線の枠（1px #DDE2E9・角丸 8）の中、その下に確かめのチェック", async ({
  page,
}) => {
  await mockApi(page, executedBand);
  await openTicketSettled(page);
  await openComplete(page);
  const d = dialog(page);
  const target = d.locator(".k-dialog-target");
  await expect(target).toHaveText("EG-133 11 月分の請求書を送る");
  expect(await cssOf(target, "font-size")).toBe("12px");
  const cond = d.getByRole("region", { name: "完了の条件" });
  expect(await cssOf(cond.locator(".k-label"), "font-size")).toBe("12px");
  expect(await cssOf(cond.locator(".k-label"), "font-weight")).toBe("500");
  await expect(cond).toContainText("先方が請求書を受け取った");
  const fs = d.getByRole("group", { name: "実施事項" });
  expect(await cssOf(fs, "border-top-color")).toBe(LINE);
  expect(await cssOf(fs, "border-top-width")).toBe("1px");
  expect(await cssOf(fs, "border-top-left-radius")).toBe("8px");
  const conf = await box(d.getByRole("checkbox", { name: "完了の条件を満たしたことを確かめました" }));
  expect(conf.y).toBeGreaterThan((await box(fs)).y + (await box(fs)).height - 1);
});

test("K229-UI-017 差し戻しの小窓の型：題「差し戻す」15px・頭の右上に ×（閉じる）が 1 つ・幅 420・やめる は outlined（白地・灰の線・黒字）・主ボタンは「差し戻す」・開くとフォーカスは「差し戻す理由」", async ({
  page,
}) => {
  await mockApi(page);
  await openTicketSettled(page);
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  const d = dialog(page);
  await expectModalShape(d, "差し戻す");
  await expect(d.getByRole("button", { name: "閉じる" })).toHaveCount(1);
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText(["やめる", "差し戻す"]);
  expect(Math.round((await box(d)).width)).toBe(420);
  await expect(reasonBox(page)).toBeFocused(); // 最初のフォーカスは使える最初の欄（押せない「どこを直すか」には乗らない）
});

test("K229-UI-018 差し戻しの小窓の中身：対象の行・どこを直すか（押せない・空）・理由（必須の印・欄の名前は「差し戻す理由」）・次は誰が直すか（AI に直させて… に印・2 つとも押せない）・覚えさせる候補（押せない・印なし）", async ({
  page,
}) => {
  const writes = countWrites(page);
  await mockApi(page);
  await openTicketSettled(page);
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  const d = dialog(page);
  await expect(d.locator(".k-dialog-target")).toHaveText("EG-133 11 月分の請求書を送る");
  const where = d.getByRole("combobox", { name: "どこを直すか" });
  expect((await where.innerText()).trim()).toBe("");
  await expectInert(page, where, "どこを直すか", writes, 1);
  await expect(reasonBox(page)).toBeVisible();
  const must = d.locator(".k-field-required");
  await expect(must).toHaveText("必須");
  expect(await cssOf(must, "color")).toBe("rgb(185, 28, 28)");
  const who = d.getByRole("group", { name: "次は誰が直すか" });
  const ai = who.getByRole("radio", { name: "AI に直させて、確認からやり直す" });
  const self = who.getByRole("radio", { name: "自分で直す" });
  await expect(ai).toBeChecked();
  await expect(ai).toBeDisabled();
  await expect(self).toBeDisabled();
  const learn = d.getByRole("checkbox", { name: "この理由を AI に覚えさせる候補にする（ナレッジ更新の候補）" });
  await expect(learn).not.toBeChecked();
  await expect(learn).toBeDisabled();
  for (const x of [ai, self, learn]) expect(await opacityOf(x)).toBeCloseTo(DISABLED_OPACITY, 3); // 薄さは input そのもの（input-disabled）
});

test("K229-UI-019 差し戻しを送る：口に届く体は理由だけ（{ note }）。押せない欄の値は送らない", async ({ page }) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  await reasonBox(page).fill("宛名を直してください");
  await dialog(page).getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect.poll(() => m.returns.length).toBe(1);
  expect(m.returns[0]).toEqual({ id: A_OPEN, body: { note: "宛名を直してください" } });
});

test("K229-UI-020 承認待ちの画面から開いた差し戻しの小窓：対象の行はその行の番号と題名（「EG-140 応募文を出す」）", async ({
  page,
}) => {
  await mockApi(page);
  await openQueue(page);
  await openReturn(page, "応募文を出す");
  await expect(dialog(page).locator(".k-dialog-target")).toHaveText("EG-140 応募文を出す");
});

test("K229-UI-021 幅 320・375・768・1024・1440：確かめの小窓を開いても横溢れ 0、小窓は画面の中（左の端 0 以上・右の端が画面の幅以下）", async ({
  page,
}) => {
  await mockApi(page);
  const bad: string[] = [];
  for (const w of WIDTHS) {
    await openTicketSettled(page, w);
    await sendBtn(page).click();
    const b = await box(approveDialog(page));
    if (b.x < 0 || b.x + b.width > w + 0.5) bad.push(`幅 ${w}：小窓が画面の外`);
    const o = await overflowX(page);
    if (o !== 0) bad.push(`幅 ${w}：横溢れ ${o}px`);
    await page.keyboard.press("Escape");
  }
  expect(bad).toEqual([]);
});

test("K229-UI-022 操作要素の表：K-63 の表（07_qa/test-specs/k/approve-complete.md）に、確かめの小窓と差し戻しの小窓に足した操作要素の行が在る（前からの K63-UI-000 が替えずに緑）", () => {
  const md = readFileSync(join(ROOT, "07_qa/test-specs/k/approve-complete.md"), "utf8");
  const have = new Set([...md.matchAll(/（([a-z]+)）「(.+?)」/g)].map((x) => `${x[1]}|${x[2]}`));
  const want = [
    "checkbox|成果物を目で見た",
    "combobox|どこを直すか",
    "radio|AI に直させて、確認からやり直す",
    "radio|自分で直す",
    "checkbox|この理由を AI に覚えさせる候補にする（ナレッジ更新の候補）",
  ];
  expect(want.filter((k) => !have.has(k))).toEqual([]);
});

test("K229-UI-027 確かめの小窓の操作要素は 3 つだけ：（checkbox）成果物を目で見た・（button）やめる・（button）承認して送る（本人確認などの余分な操作が無い）", async ({
  page,
}) => {
  await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  const got = (await controlsOf(page, '[role="alertdialog"]')).map((c) => `${c.role}|${c.name}`).sort();
  expect(got).toEqual(["button|やめる", "button|承認して送る", "checkbox|成果物を目で見た"].sort());
});

test("K229-UI-028 答えを待つ間：小窓の「やめる」は押せず、Esc でも閉じない。答えが来ると閉じる", async ({ page }) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  const release = m.hold();
  await sendBtn(page).click();
  await seenBox(page).check();
  await confirmButton(page).click();
  await expect.poll(() => m.approves.length).toBe(1);
  await expect(approveDialog(page).getByRole("button", { name: "やめる" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(approveDialog(page)).toBeVisible();
  m.on.ticket = runningAfter;
  release();
  await expect(approveDialog(page)).toHaveCount(0);
  expect(m.approves).toHaveLength(1);
});

test("K229-UI-029 目で見たに印を付けて「やめる」で閉じ、開き直すと印は外れている（見たことを持ち越さない）", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  await seenBox(page).check();
  await approveDialog(page).getByRole("button", { name: "やめる" }).click();
  await sendBtn(page).click();
  await expect(seenBox(page)).not.toBeChecked();
  await expect(confirmButton(page)).toBeDisabled();
  expect(m.approves).toHaveLength(0);
});

test("K229-UI-030 取り消せない確かめの小窓は、開いたときの説明（aria-describedby・読み上げ）に赤い箱の「取り消せません」がつながる", async ({
  page,
}) => {
  await mockApi(page);
  await openTicketSettled(page);
  await sendBtn(page).click();
  const d = approveDialog(page);
  await expect(d.locator(".k-dialog-caution")).toContainText("取り消せません");
  await expect(d).toHaveAccessibleDescription(/取り消せません/);
});

fidelityConfigTest(
  "K229-UI-023 突き合わせの設定：approve-modal と complete-modal と return-modal が enrolled・持ち主 K-229・画面を整える道具に鍵・画面の側のセレクタに .k-panel が無い",
  ["approve-modal", "complete-modal", "return-modal"],
  "K-229",
);
fidelityCompareTests("K229-UI-024", "approve-modal", "StModal の承認して送ります");
fidelityCompareTests("K229-UI-025", "complete-modal", "StCompleteModal");
fidelityCompareTests("K229-UI-026", "return-modal", "差し戻すの小窓");
