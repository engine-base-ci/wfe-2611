// 統合テスト（staging）の段 12 の画面の 1 歩（K-922）：ゲストのグループを作る（K-874）・ゲストを招く（K-874）・招待のリンクで参加して先方の場所へ入る（K-877）・
//   依頼を出す（K-912）・届いた依頼でチケットを作る（K-898）・見せる相手を選ぶ・やめる（K-905）・ゲストのグループを消す（K-928）。
//   操作と選び方は中間テスト（apps/web/tests/skeleton の k918・k920 と _lib/f11-flow.ts）と同じ。写しを置いた訳は steps.ts・handover-steps.ts と同じ
//   （あちらは DB・手元の受け箱・送り元の付け替えを前提にする。staging では DB を読まない・PM の決め 2）。
//   環境の値は読まない（住所と鍵は site.ts と resend.ts だけが読む）。ここは進むための 1 歩だけを持ち、行の期待結果の確かめは試験に書く。
//   画面の名前は K-874・K-877・K-898・K-905・K-911〜K-913・K-928 の仕様の表とモックから（実装から書かない）。staging の最初の回で違えば、ここを直す
import { expect, type Browser, type Page, type Response } from "@playwright/test";
import { pathOf, type Person } from "./steps";
import { throughTwoFactor } from "./handover-steps";

const SEC = 'section[aria-labelledby="members-title"]';
const apiPath = (url: string): string => new URL(url).pathname;

/** 押して、その口（method・道が re に合う）の答えの番号を返す */
export const answered = (page: Page, method: string, re: RegExp): Promise<Response> =>
  page.waitForResponse((r) => r.request().method() === method && re.test(apiPath(r.url())));

/** メンバーの画面 → 「ゲスト」のタブ */
export async function openGuests(page: Page): Promise<void> {
  expect((await page.goto("/members"))?.status(), "メンバーの画面が開ける").toBe(200);
  await page
    .getByRole("navigation", { name: "メンバーとゲスト", exact: true })
    .getByRole("link", { name: /^ゲスト \d+$/ })
    .click();
  await expect(page.locator(SEC).getByRole("heading", { name: "ゲスト", level: 1, exact: true })).toBeVisible();
}
/** 「＋ ゲストのグループを作る」→ 名前と届け先（先頭の社内のグループ）→「作る」。作る口の答えの番号を返す */
export async function createGroupOnScreen(page: Page, name: string): Promise<number> {
  await page.locator(SEC).getByRole("button", { name: "＋ ゲストのグループを作る", exact: true }).first().click();
  const d = page.locator(".k-dialog");
  await d.getByLabel("名前 必須", { exact: true }).fill(name);
  await d.getByLabel("依頼が届く社内のグループ 必須", { exact: true }).selectOption({ index: 0 });
  const res = answered(page, "POST", /\/api\/v1\/guest-groups$/);
  await d.getByRole("button", { name: "作る", exact: true }).click();
  return (await res).status();
}
/** グループの行の「このゲストのグループに招く」→ メールを足す →「招く」。招待の口の答えの番号を返す */
export async function inviteGuestOnScreen(page: Page, groupName: string, email: string): Promise<number> {
  await page
    .locator(".k-inv-group")
    .filter({ hasText: groupName })
    .getByRole("button", { name: "＋ このゲストのグループに招く", exact: true })
    .click();
  const d = page.locator(".k-dialog");
  await d.getByLabel("メール 必須", { exact: true }).fill(email);
  await d.getByRole("button", { name: "足す", exact: true }).click();
  const res = answered(page, "POST", /\/api\/v1\/invitations$/);
  await d.getByRole("button", { name: /^(\d+ 人を)?招く$/ }).click();
  return (await res).status();
}
/** メールの本文の中の招待のリンク（/invite/<印>）。無ければ落とす（印は記録に出さない：伏せる台本 scrub.mjs が /invite/ の形で伏せる） */
export function guestInviteLink(m: { text: string }): string {
  const hit = m.text.match(/https?:\/\/[^\s<>"）)]+\/invite\/[A-Za-z0-9_-]+/);
  if (!hit) throw new Error("招待のメールに招待のリンクが無い");
  return hit[0];
}
/** 招待のリンクを開き、名前とパスワードで「参加する」→（2 段階を付ける）→ 先方の場所（/portal）へ入る。ゲストのブラウザを返す */
export async function joinAsGuest(browser: Browser, link: string, p: Person): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  expect((await page.goto(link))?.status(), "招待のリンクの先が開ける").toBe(200);
  await page.getByLabel("名前", { exact: true }).fill(p.name);
  await page.getByLabel("パスワード", { exact: true }).fill(p.password);
  await page.getByRole("button", { name: "参加する", exact: true }).click();
  await expect.poll(() => pathOf(page), { message: "招待の画面を離れる", timeout: 30_000 }).not.toMatch(/^\/invite\//);
  await throughTwoFactor(page, p);
  await expect.poll(() => pathOf(page), { message: "先方の場所へ入る", timeout: 30_000 }).toBe("/portal");
  return page;
}
/** ゲストの画面の「＋ 依頼を出す」→ 何をしてほしいかを書く →「依頼を出す」。依頼を出す口の答えの番号を返す */
export async function requestOnScreen(page: Page, text: string): Promise<number> {
  await page
    .getByRole("link", { name: /^＋ 依頼を出す$/ })
    .or(page.getByRole("button", { name: /^＋ 依頼を出す$/ }))
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "依頼を出す", exact: true })).toBeVisible();
  await page.getByLabel("何をしてほしいか*", { exact: true }).fill(text);
  const res = answered(page, "POST", /\/api\/v1\/portal\/requests$/);
  await page.getByRole("button", { name: "依頼を出す", exact: true }).click();
  return (await res).status();
}
/** 社内の届いた依頼（/requests）の 1 件を、題の字で開く */
export async function openRequestByTitle(page: Page, title: string): Promise<void> {
  expect((await page.goto("/requests"))?.status(), "届いた依頼の画面が開ける").toBe(200);
  await page.getByText(title, { exact: true }).first().click();
  await expect(page.getByRole("button", { name: "チケットを作る", exact: true })).toBeVisible();
}
/** 期限の欄に入れる形（「12/26」＝月/日・頭の 0 は付けない）。due は YYYY-MM-DD（DB の due_on と比べる形） */
export const dueField = (due: string): string => {
  const [, m, d] = due.split("-").map(Number);
  return `${m}/${d}`;
};
/** 「チケットを作る」→ 小窓：担当（先頭の人）・期限を入れて「作る」。口の答えの番号を返す（見せる相手は最初から入っている）。
 *  担当は Base UI の Select（combobox を押して option を選ぶ・<select> ではない）。期限の欄は「M/D」の形だけを受ける（K-930）ので、
 *  due（YYYY-MM-DD・今日より後の日）を「M/D」に直して入れる。画面は次のその日付の YYYY-MM-DD にして送るので、DB の due_on は due と同じ日 */
export async function acceptOnScreen(page: Page, due: string): Promise<number> {
  await page.getByRole("button", { name: "チケットを作る", exact: true }).click();
  const d = page.getByRole("dialog", { name: "チケットを作る", exact: true });
  await d.getByRole("combobox", { name: "担当", exact: true }).click();
  await page.getByRole("option").first().click();
  await d.getByRole("textbox", { name: "期限", exact: true }).fill(dueField(due));
  const res = answered(page, "POST", /\/api\/v1\/client_requests\/[^/]+\/accept$/);
  await d.getByRole("button", { name: "作る", exact: true }).click();
  return (await res).status();
}
const panel = (page: Page) => page.getByRole("region", { name: "ゲストに見せる", exact: true });
/** 詳細の右のパネルの「ゲストに見せる」→ 小窓でグループの箱を付けて「決める」。見せる口の答えの番号を返す */
export async function shareOnScreen(page: Page, groupName: string): Promise<number> {
  await panel(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
  const d = page.getByRole("dialog", { name: "ゲストに見せる", exact: true });
  await d.getByRole("checkbox", { name: new RegExp(groupName) }).check();
  const res = answered(page, "PATCH", /\/api\/v1\/tickets\/[^/]+\/guest-shares$/);
  await d.getByRole("button", { name: "決める", exact: true }).click();
  return (await res).status();
}
/** 「見せるのをやめる」→ 確かめの「見せるのをやめる」。外す口の答えの番号を返す */
export async function unshareOnScreen(page: Page): Promise<number> {
  await panel(page).getByRole("button", { name: "見せるのをやめる", exact: true }).click();
  const res = answered(page, "PATCH", /\/api\/v1\/tickets\/[^/]+\/guest-shares$/);
  await page.getByRole("alertdialog").getByRole("button", { name: "見せるのをやめる", exact: true }).click();
  return (await res).status();
}
/** ゲストのタブのグループの行の「⋯」→「消す」→ 確かめの「消す」。消す口の答えの番号を返す */
export async function deleteGroupOnScreen(page: Page, groupName: string): Promise<number> {
  await openGuests(page);
  await page
    .locator(".k-inv-group")
    .filter({ hasText: groupName })
    .getByRole("button", { name: `${groupName}のほかの操作`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  const res = answered(page, "DELETE", /\/api\/v1\/guest-groups\/[^/]+$/);
  await page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true }).click();
  return (await res).status();
}
/** ゲストの先方の場所で、開いた画面に出ている字全部（期限・担当などが出ていないことを見る） */
export const textOf = (page: Page): Promise<string> => page.locator("body").innerText();
