// K-264「中間テスト 3 の K64-M3-04 が、止まった帯に完了の確かめの文を探して落ちる。止まった帯の形（K-228）に合わせ、帯の中の『完了にする』で確かめる」の画面の試験（実 Chrome）。
//   止まった帯の形は K-228 が決めた（11_tickets/K-228.md の帯の表・K228-UI-009）：region「承認と実行」の赤い箱（role=alert）1 つに、
//   題「実行が止まりました」・止まった理由の全文・「完了にする」。完了の確かめの文（StConfirmDone の題）はこの箱に出さない。
//   この行は、中間テスト 3 の K64-M3-04 が本物の口で見る形（止まった帯の中の「完了にする」から完了にできる）を、網の手前で差し替えた口で先に見る。
//   口は前からの土台 approve-complete.harness.ts で差し替える。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test } from "@playwright/test";
import { MSG, bandOf, dialog, mockApi, openTicketSettled, type Band } from "../features/F5/approve-complete.harness";

/** 承認の後の実行が空の結果で止まった（E-SIG-004 の文・K64-M3-04 と同じ止まり方）。作業中に戻り、完了にできる */
const EMPTY_RESULT = "自分のAI が結果を返さずに終わりました。完了とは見なしていません";
const STOPPED: Band = {
  stage: "doing",
  run: { phase: "execute", status: "stopped", pc: "live", stopped_reason: EMPTY_RESULT },
  can_complete: true,
};

test("K264-UI-001 承認の後の実行が止まった：赤い箱（題「実行が止まりました」・理由）は出て、「完了にする」は題の行に 1 つだけ出る（赤い箱の中には無い・K-572）。完了の確かめの文は出ない。押すと完了の小窓が開き、「このまま完了にする」と完了の口が 1 回呼ばれる", async ({
  page,
}) => {
  const m = await mockApi(page, STOPPED);
  await openTicketSettled(page);
  const stopped = bandOf(page).getByRole("alert").filter({ hasText: "実行が止まりました" });
  await expect(stopped, "止まった帯は赤い箱 1 つ").toHaveCount(1);
  await expect(stopped).toContainText(EMPTY_RESULT);
  // 止まった帯は完了の確かめの文を出さない（K-228）
  await expect(bandOf(page).getByText(MSG.completeHint)).toHaveCount(0);
  const done = page.locator("header.k-page-head").getByRole("button", { name: "完了にする", exact: true });
  await expect(done, "完了にする道は題の行に出る（止まった帯の中には出さない）").toBeVisible();
  await expect(stopped.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "完了にする", exact: true }), "完了にするは画面に 1 つ").toHaveCount(1);
  await done.click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole("button", { name: "このまま完了にする", exact: true }).click();
  await expect.poll(() => m.completes.length, "完了の口は 1 回").toBe(1);
  expect(m.completes[0]).toEqual({ conditions_confirmed: true });
});
