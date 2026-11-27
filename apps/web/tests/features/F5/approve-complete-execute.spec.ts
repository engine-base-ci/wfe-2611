// K-182「実行の結末と時間の流れ（実行が終わる・止まる・24 時間・片付け）」の画面の試験（実 Chrome・口は K-164）。親 K-63 の画面の試験を孫ごとに分けたもの（行 ID と中身は分ける前のまま）。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/approve-complete.md・タスクの列が K-182）＝試験 1 本。口は網の手前で差し替える。土台は ./approve-complete.harness.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { expect, row } from "../../_lib/row";
import { R, MSG, pending, mockApi, openTicket, bandOf, k62Band } from "./approve-complete.harness.js";

row(R["K63-UI-025"], async (page) => {
  await mockApi(page, { stage: "running", run: { phase: "execute", status: "queued", pc: "asleep" } });
  await openTicket(page);
  await expect(bandOf(page).getByText(MSG.pcClosed)).toBeVisible();
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  await expect(k62Band(page)).toHaveCount(0); // 承認の後の実行の間、K-62 の帯は出さない（D-128.178）
  await expect(page.getByText(/のAI が作っています|PC が起きるのを待っています/)).toHaveCount(0);
});
row(R["K63-UI-034"], async (page) => {
  await mockApi(page, { stage: "awaiting_approval", approval: pending({ note: MSG.note24h }) });
  await openTicket(page);
  const band = bandOf(page);
  await expect(band).toContainText(MSG.note24h);
  await expect(band.getByRole("button", { name: "承認して送る" })).toBeVisible();
  await expect(band.getByRole("button", { name: "差し戻す" })).toBeVisible();
});
row(R["K63-UI-051"], async (page) => {
  await mockApi(page, { stage: "running", run: { phase: "execute", status: "running", pc: "asleep" } });
  await openTicket(page);
  await expect(bandOf(page).getByText(MSG.runningAsleep)).toBeVisible();
  await expect(bandOf(page).getByText("実行中", { exact: true })).toHaveCount(0);
  // 「止める」は段 6 の K-734 の差し込み口（K-730）。それ以外のボタンは無い
  await expect(
    bandOf(page)
      .getByRole("button")
      .filter({ hasNotText: /^止める$/ }),
  ).toHaveCount(0);
  await expect(k62Band(page)).toHaveCount(0);
});
row(R["K63-UI-052"], async (page) => {
  await mockApi(page, { stage: "running", run: { phase: "execute", status: "asking", pc: "live" } });
  await openTicket(page);
  await expect(bandOf(page).getByText(MSG.asking)).toBeVisible();
  // 「止める」は段 6 の K-734 の差し込み口（K-730）。それ以外のボタンは無い
  await expect(
    bandOf(page)
      .getByRole("button")
      .filter({ hasNotText: /^止める$/ }),
  ).toHaveCount(0);
  await expect(k62Band(page)).toHaveCount(0);
});
row(R["K63-UI-053"], async (page) => {
  // 理由が届かずに止まった：D-129.47 の文をそのまま。「理由は分かりません」は出ない
  await mockApi(page, {
    stage: "doing",
    run: { phase: "execute", status: "stopped", pc: "live", stopped_reason: MSG.stoppedNoReason },
    can_complete: true,
  });
  await openTicket(page);
  await expect(bandOf(page).getByText(MSG.stoppedNoReason)).toBeVisible();
  await expect(page.getByText("理由は分かりません")).toHaveCount(0);
  // 長い理由（5000 文字）も切らずに全文
  const long = "先方の画面で確かめてください。".repeat(400).slice(0, 5000);
  const page2 = await page.context().newPage();
  await mockApi(page2, {
    stage: "doing",
    run: { phase: "execute", status: "stopped", pc: "live", stopped_reason: long },
    can_complete: true,
  });
  await openTicket(page2);
  await expect(bandOf(page2)).toContainText(long.slice(-30));
  const shown = await bandOf(page2).innerText();
  expect(shown.replace(/\s/g, "")).toContain(long);
  expect(shown).not.toContain("…");
  await page2.close();
});
