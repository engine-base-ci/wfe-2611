// K-184「完了の知らせと続きの絞り・5 本の口をまたぐ守り（ログイン・別の会社・id の形・知らない欄・回数・証跡・混ざらない）」の画面の試験（実 Chrome・口は K-166）。親 K-63 の画面の試験を孫ごとに分けたもの（行 ID と中身は分ける前のまま）。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/approve-complete.md・タスクの列が K-184）＝試験 1 本。口は網の手前で差し替える。土台は ./approve-complete.harness.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { expect, row } from "../../_lib/row";
import {
  R,
  A_OPEN,
  CHILD,
  MSG,
  qrow,
  ticketOf,
  pending,
  mockApi,
  executedBand,
  openQueue,
  openTicket,
  openTicketSettled,
  openComplete,
  dialog,
  bandOf,
  k62Band,
  reasonBox,
  openReturn,
  type Band,
} from "./approve-complete.harness.js";

const completeButton = (page: Parameters<typeof openTicket>[0]) =>
  page.getByRole("button", { name: "完了にする", exact: true });

row(R["K63-UI-015"], async (page) => {
  const m = await mockApi(page);
  m.on.queue = () => ({
    status: 200,
    body: {
      data: [qrow(A_OPEN, { title: '<img src=x onerror="window.__k63=1">請求書' })],
      meta: { limit: 20, counts: { total: 1 } },
    },
  });
  await openQueue(page);
  await expect(page.getByText('<img src=x onerror="window.__k63=1">請求書')).toBeVisible();
  await openReturn(page, "請求書");
  const note = "<script>window.__k63=2</script>宛名を直して";
  await reasonBox(page).fill(note);
  await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect.poll(() => m.returns.length).toBe(1);
  expect(m.returns[0]!.body).toEqual({ note });
  expect(await page.evaluate(() => (window as unknown as { __k63?: number }).__k63)).toBeUndefined();
});

// 決める人の答え answer=15450e49d044（2026-11-13）：「完了にする」は、AI に任せていない（承認の後の実行の記録が無い）チケットでも出す。
//   条件：段が作業中・承認待ちが無い・走っている実行が無い・口の can.complete が true（K-183 の条件を広げる）
row(R["K63-UI-059"], async (page) => {
  const m = await mockApi(page, { stage: "doing", can_complete: true, can_delegate: true }); // 実行の記録なし
  await openTicketSettled(page);
  await expect(bandOf(page).getByText(MSG.completeHint)).toBeVisible();
  await expect(page.getByRole("button", { name: "AI に任せる", exact: true })).toBeVisible(); // 題の行（K-573）
  await openComplete(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "done", completed: { at: new Date().toISOString(), by: "高本" } }) },
  });
  await dialog(page).getByRole("button", { name: "このまま完了にする", exact: true }).click();
  await expect.poll(() => m.completes.length).toBe(1);
  expect(m.completes[0]).toEqual({ conditions_confirmed: true });
  await expect(bandOf(page).getByText(/完了しました/)).toBeVisible();
  await expect(completeButton(page)).toHaveCount(0);
});
row(R["K63-UI-060"], async (page) => {
  const cases: [string, Band][] = [
    ["作る段が動いている", { stage: "doing", run: { phase: "make", status: "running" }, can_complete: true }],
    ["作る段が待っている", { stage: "doing", run: { phase: "make", status: "queued" }, can_complete: true }],
    ["作る段で AI が聞いている", { stage: "doing", run: { phase: "make", status: "asking" }, can_complete: true }],
    ["承認待ちがある", { stage: "doing", approval: pending(), can_complete: true }],
    ["見るだけの人", { stage: "doing", can_complete: false }],
  ];
  for (const [name, b] of cases) {
    const p = await page.context().newPage();
    await mockApi(p, b);
    await openTicket(p);
    await expect(completeButton(p), name).toHaveCount(0);
    await expect(p.getByText(MSG.completeHint), name).toHaveCount(0);
    await p.close();
  }
});
row(R["K63-UI-061"], async (page) => {
  for (const stage of ["todo", "hold"]) {
    const p = await page.context().newPage();
    await mockApi(p, { stage, can_complete: true, can_delegate: true });
    await openTicket(p);
    await expect(p.getByRole("button", { name: "AI に任せる", exact: true }), stage).toBeVisible(); // 題の行（K-573）
    await expect(completeButton(p), stage).toHaveCount(0);
    await expect(p.getByText(MSG.completeHint), stage).toHaveCount(0);
    await p.close();
  }
});
row(R["K63-UI-062"], async (page) => {
  for (const status of ["stopped", "cancelled"]) {
    const p = await page.context().newPage();
    await mockApi(p, {
      stage: "doing",
      run: { phase: "make", status, stopped_reason: "PC でこの実行をやめました" },
      can_complete: true,
      can_delegate: true,
    });
    await openTicket(p);
    await expect(bandOf(p).getByText(MSG.completeHint), status).toBeVisible();
    await completeButton(p).click();
    await expect(dialog(p), status).toBeVisible();
    await p.close();
  }
});

// 決める人の答え answer=db67f3cde899 ①：押した人に見えない子は件数の 1 件だけ（id の無い明細）。小窓は文として出し、リンクにしない
row(R["K63-UI-063"], async (page) => {
  const HIDDEN = "ほかに、あなたに見えない子が 2 件あります";
  const m = await mockApi(page, executedBand);
  m.on.complete = () => ({
    status: 422,
    body: {
      error: "validation_failed",
      code: "E-VAL-024",
      message: `${MSG.children}。先に子を完了にしてください`,
      details: [
        { field: "children", message: "EG-134 宛名を確かめる", id: CHILD },
        { field: "children", message: HIDDEN },
      ],
    },
  });
  await openTicket(page);
  await openComplete(page);
  await dialog(page).getByRole("button", { name: "このまま完了にする", exact: true }).click();
  await expect(dialog(page).getByText(HIDDEN)).toBeVisible();
  await expect(dialog(page).getByRole("link", { name: /EG-134 宛名を確かめる/ })).toHaveAttribute(
    "href",
    new RegExp(`/tickets/${CHILD}$`),
  );
  await expect(dialog(page).getByRole("link", { name: /見えない子/ })).toHaveCount(0);
  await expect(dialog(page).getByRole("link")).toHaveCount(1); // リンクは id つきの 1 件だけ
});
