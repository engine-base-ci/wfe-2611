// K-181「差し戻す（理由をつけて作り直させる）」の画面の試験（実 Chrome・口は K-163）。親 K-63 の画面の試験を孫ごとに分けたもの（行 ID と中身は分ける前のまま）。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/approve-complete.md・タスクの列が K-181）＝試験 1 本。口は網の手前で差し替える。土台は ./approve-complete.harness.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { expect, row } from "../../_lib/row";
import {
  ROWS,
  R,
  TICKET,
  A_OPEN,
  MSG,
  QUEUE,
  ticketOf,
  pending,
  mockApi,
  missingInMain,
  openQueue,
  openTicketSettled,
  rowOf,
  dialog,
  bandOf,
  reasonBox,
  reasonOf,
  openReturn,
} from "./approve-complete.harness.js";
import { approveVia } from "../../k/approve-modal";

// ---- 承認待ち（/approvals）----
row(R["K63-UI-000"], async (page) => {
  await mockApi(page);
  await openQueue(page);
  await rowOf(page, "請求書").getByRole("button", { name: "差し戻す" }).click();
  await expect(dialog(page)).toBeVisible();
  expect(await missingInMain(page, ROWS)).toEqual([]);
});
row(R["K63-UI-003"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  const r = rowOf(page, "11 月分の請求書を送る");
  await expect(r.getByRole("button", { name: "承認する", exact: true })).toHaveCount(0);
  await r.getByRole("link", { name: "中身を見る" }).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET}$`));
  expect(m.approves).toHaveLength(0);
});
row(R["K63-UI-004"], async (page) => {
  await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await expect(reasonBox(page)).toBeEditable();
});
row(R["K63-UI-005"], async (page) => {
  await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await reasonBox(page).fill("宛名を直してください\n日付も今日に");
  await expect(reasonBox(page)).toHaveValue("宛名を直してください\n日付も今日に");
});
row(R["K63-UI-006"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  m.on.queue = () => ({
    status: 200,
    body: { data: QUEUE().filter((x) => x.id !== A_OPEN), meta: { limit: 20, counts: { total: 2 } } },
  });
  await openReturn(page);
  await reasonBox(page).fill("宛名を直してください");
  await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.returns).toEqual([{ id: A_OPEN, body: { note: "宛名を直してください" } }]);
  await expect(rowOf(page, "11 月分の請求書を送る")).toHaveCount(0);
});
row(R["K63-UI-007"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  for (const v of ["", "　　"]) {
    await reasonBox(page).fill(v);
    await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
    await expect.poll(() => reasonOf(page)).toContain(MSG.reasonEmpty);
  }
  expect(m.returns).toHaveLength(0);
  await expect(dialog(page)).toBeVisible();
});
row(R["K63-UI-009"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await reasonBox(page).fill("やっぱりやめる");
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.returns).toHaveLength(0);
  await expect(rowOf(page, "11 月分の請求書を送る")).toHaveCount(1);
});
row(R["K63-UI-074"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await reasonBox(page).fill("やっぱりやめる");
  await expect(dialog(page).getByRole("button", { name: "閉じる" })).toHaveCount(1);
  await dialog(page).locator(".k-dialog-head").getByRole("button", { name: "閉じる" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.returns).toHaveLength(0);
  await expect(rowOf(page, "11 月分の請求書を送る")).toHaveCount(1);
});
row(R["K63-UI-076"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await expect(reasonBox(page)).toBeFocused();
  await expect(dialog(page).getByRole("button", { name: "閉じる" })).not.toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  expect(m.returns).toHaveLength(0);
});
row(R["K63-UI-010"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await reasonBox(page).fill("書きかけの理由");
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  await openReturn(page);
  await expect(reasonBox(page)).toHaveValue("書きかけの理由");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: /承認待ち/ })).toBeVisible();
  await openReturn(page);
  await expect(reasonBox(page)).toHaveValue("書きかけの理由");
  await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect.poll(() => m.returns.length).toBe(1);
  await openReturn(page);
  await expect(reasonBox(page)).toHaveValue("");
});
row(R["K63-UI-021"], async (page) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  const band = bandOf(page);
  await expect(band).toContainText(MSG.waitingMe);
  await expect(band.getByRole("button", { name: "承認して送る" })).toBeVisible();
  await expect(band.getByRole("button", { name: "差し戻す" })).toBeVisible();
  await expect(band).toContainText("11 月分の請求書をお送りします。");
  await expect(band).toContainText(MSG.checkNone);
  await expect(band).toContainText("取り消せません");
  // 帯は題名のすぐ下
  const h = await page.getByRole("heading", { level: 1 }).boundingBox();
  const b = await band.boundingBox();
  expect(b!.y).toBeGreaterThan(h!.y);
  expect(b!.y - (h!.y + h!.height)).toBeLessThan(80);
  // 決められない人：ボタンなし
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "awaiting_approval", approval: pending({ can_decide: false }) }) },
  });
  await page.reload();
  await expect(page.getByText(MSG.k62Waiting)).toBeVisible();
  await expect(page.getByText(MSG.waitingOther)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "差し戻す" })).toHaveCount(0);
  // 承認待ちが無い：帯なし
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf({ stage: "doing", approval: null }) } });
  await page.reload();
  await expect(page.getByText(MSG.waitingMe)).toHaveCount(0);
  await expect(page.getByText(MSG.waitingOther)).toHaveCount(0);
});
row(R["K63-UI-024"], async (page) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "make", status: "queued", pc: "live" } }) },
  });
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  await reasonBox(page).fill("宛名を直してください");
  await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect.poll(() => m.returns.length).toBe(1);
  expect(m.returns[0]).toEqual({ id: A_OPEN, body: { note: "宛名を直してください" } });
  await expect(dialog(page)).toHaveCount(0);
  await expect(bandOf(page)).toHaveCount(0); // 作り直し（phase make）の間は K-63 の帯を出さない（K-62 の帯だけ・D-128.178）
});
row(R["K63-UI-073"], async (page) => {
  const m = await mockApi(page); // 承認待ち・決められる人
  await openTicketSettled(page);
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  await expect(dialog(page)).toBeVisible();
  await reasonBox(page).fill("宛名を直してください");
  // 小窓の中で名前「閉じる」は頭の × の 1 つだけ（足に「閉じる」を重ねない）
  await expect(dialog(page).getByRole("button", { name: "閉じる" })).toHaveCount(1);
  await dialog(page).locator(".k-dialog-head").getByRole("button", { name: "閉じる" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.returns).toHaveLength(0);
  await expect(bandOf(page)).toContainText("あなたの承認を待っています");
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toBeVisible();
  await expect(bandOf(page).getByRole("button", { name: "差し戻す" })).toBeVisible();
});
row(R["K63-UI-042"], async (page) => {
  const m = await mockApi(page); // 承認待ち・決められる人（承認する人）
  await openTicketSettled(page);
  await expect(bandOf(page)).toContainText(MSG.waitingMe);
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(1);
  await expect(page.getByText(MSG.k62Waiting)).toHaveCount(0); // 同じ人に帯を 2 つ並べない
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "awaiting_approval", approval: pending({ can_decide: false }) }) },
  });
  await page.reload();
  await expect(page.getByText(MSG.k62Waiting)).toHaveCount(1);
  await expect(page.getByText(MSG.waitingMe)).toHaveCount(0);
  await expect(page.getByText(MSG.waitingOther)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "差し戻す" })).toHaveCount(0);
});
row(R["K63-UI-043"], async (page) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  // 帯で押した時点で、もう決まっていた（別のタブ・別の人）：知らせを出し、帯を読み直す
  m.on.approve = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "queued", pc: "live" } }) },
  });
  await approveVia(page, bandOf(page).getByRole("button", { name: "承認して送る" })); // 確かめの小窓を通す（K-229・D-143.4）
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toBeVisible();
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  // 差し戻しでも同じ
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf({ stage: "awaiting_approval", approval: pending() }) } });
  const runsRead = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/v1/tickets/${TICKET}/runs`);
  await page.reload();
  await expect(bandOf(page)).toContainText(MSG.waitingMe); // 画面がチケットを読み終えてから、答えを替える
  await runsRead; // 実行の一覧も読み終えてから（後から届くと、替えた答えで帯が読み直されてボタンが消える）
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  await reasonBox(page).fill("宛名を直してください");
  // 小窓を開いて書いている間に、別のタブ・別の人が決めた（答えを替えるのは小窓が開いた後。替えた後の読み直しで帯のボタンが消えて押せなくなる揺れを避ける）
  m.on.ret = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "queued", pc: "live" } }) },
  });
  await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await expect(bandOf(page).getByRole("button", { name: "差し戻す" })).toHaveCount(0);
});
row(R["K63-UI-055"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await reasonBox(page).fill("宛名を直してください");
  const b = page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true });
  const release = m.hold();
  await b.click();
  await expect.poll(() => m.returns.length).toBe(1);
  await expect(b).toBeDisabled(); // 答えの前は押せない
  await b.dispatchEvent("click"); // 押せない間に押しても口は呼ばない
  release();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.returns).toHaveLength(1);
});

row(R["K63-UI-056"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  m.on.ret = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  const before = m.queueReads;
  m.on.queue = () => ({
    status: 200,
    body: { data: QUEUE().filter((x) => x.id !== A_OPEN), meta: { limit: 20, counts: { total: 2 } } },
  });
  await openReturn(page);
  await reasonBox(page).fill("宛名を直してください");
  await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => m.queueReads).toBeGreaterThan(before);
  await expect(rowOf(page, "11 月分の請求書を送る")).toHaveCount(0);
});

row(R["K63-UI-057"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  m.on.ret = () => ({ status: 404, body: { error: "not_found", code: "E-PAGE-001", message: MSG.gone } });
  m.on.queue = () => ({
    status: 200,
    body: { data: QUEUE().filter((x) => x.id !== A_OPEN), meta: { limit: 20, counts: { total: 2 } } },
  });
  await openReturn(page);
  await reasonBox(page).fill("宛名を直してください");
  await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: MSG.gone })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await expect(rowOf(page, "11 月分の請求書を送る")).toHaveCount(0);
});
