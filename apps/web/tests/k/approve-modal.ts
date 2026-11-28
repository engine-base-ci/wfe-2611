// 承認の確かめの小窓（K-229・D-143.4）を通して承認する道具。前からの承認の試験（K-63・K-247・m3）と K-229 の試験が読む。
//   「承認して送る」「承認する」（帯・承認待ちの行）を押すと、すぐ口を呼ばずに確かめの小窓（role=alertdialog）が開く。
//   取り消せない承認は「成果物を目で見た」に印を付けるまで送れない（決める人の答え answer=5cf21973b39f）。小窓の主ボタンで口を 1 回呼ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Locator, type Page } from "@playwright/test";

/** 確かめの小窓（取り消せない確かめと同じ形・× を持たない） */
export const approveDialog = (page: Page): Locator => page.getByRole("alertdialog");
/** 小窓の主ボタン（取り消せない承認は「承認して送る」・取り消せる承認は「承認する」） */
export const confirmButton = (page: Page): Locator =>
  approveDialog(page).getByRole("button", { name: /^承認(して送る|する)$/ });
export const seenBox = (page: Page): Locator => approveDialog(page).getByRole("checkbox", { name: "成果物を目で見た" });

/** 開いている確かめの小窓で、取り消せない承認（題「承認して送ります」）なら必ず目で見たに印を付け、主ボタンを押す。
 *  題が出るのを待ってから決める（数えるだけだと描画の前に 0 と数えて揺れる・出し忘れも見逃す） */
export async function confirmApprove(page: Page): Promise<void> {
  const title = approveDialog(page).locator(".k-dialog-title");
  await expect(title).toHaveText(/^承認(して送ります|します)$/);
  if ((await title.innerText()).trim() === "承認して送ります") await seenBox(page).check();
  else await expect(seenBox(page)).toHaveCount(0);
  await confirmButton(page).click();
}

/** 帯や行の承認のボタンを押し、確かめの小窓で承認する */
export async function approveVia(page: Page, button: Locator): Promise<void> {
  await button.click();
  await confirmApprove(page);
}
