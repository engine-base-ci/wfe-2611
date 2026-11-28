// 統合テスト（staging）の段 13 の画面の 1 歩（K-999）：困ったとき・お知らせを開く・問い合わせる小窓で送る・1 件のやり取りで返事を書いて済みにする・
//   請求書と設定の「プランと支払い」を開く。操作と選び方は画面の葉（K-953・K-956・K-1007・K-960・K-962）の試験と同じ。
//   写しを置いた訳は steps.ts と同じ（あちらは網の手前の差し替えと手元の DB を前提にする。staging では DB を読まない・K-65 の PM の決め 2）。
//   環境の値は読まない（住所と鍵は site.ts と resend.ts だけが読む）。ここは進むための 1 歩だけを持ち、行の期待結果の確かめは試験に書く。
//   画面の名前はモック（features/F12/help・billing）と葉の md の字から（実装から書かない）。staging の最初の回で違えば、ここを直す
import { expect, type Locator, type Page } from "@playwright/test";
import { h1 } from "./steps";

export const HELP = "/notices";
export const ASK = "/inquiry";
export const BILLING = "/billing";
export const SETTINGS = "/settings/company";
export const INQUIRIES_RE = /^\/api\/v1\/inquiries$/;
export const MESSAGES_RE = /^\/api\/v1\/inquiries\/[^/]+\/messages$/;
export const RESOLVE_RE = /^\/api\/v1\/inquiries\/[^/]+\/resolve$/;

/** 問い合わせる小窓（K-953） */
export const askDialog = (page: Page): Locator => page.getByRole("dialog", { name: "問い合わせる", exact: true });

/** 困ったとき・お知らせのホームを開く（K-956）。開いた先の番号を返す */
export async function openHelp(page: Page): Promise<number | null> {
  const res = await page.goto(HELP);
  await expect(h1(page, "困ったとき・お知らせ")).toBeVisible();
  return res?.status() ?? null;
}

/** 問い合わせる小窓に書いて「送る」を押す。作る口（POST /api/v1/inquiries）の答えの番号を返す */
export async function askOnScreen(page: Page, title: string, body: string): Promise<number> {
  await page.getByRole("button", { name: "問い合わせる", exact: true }).first().click();
  await expect(askDialog(page)).toBeVisible();
  await askDialog(page).getByLabel("何について", { exact: true }).selectOption("うまく動かない");
  await askDialog(page).getByLabel("題", { exact: true }).fill(title);
  await askDialog(page).getByLabel("内容", { exact: true }).fill(body);
  return clickFor(page, askDialog(page).getByRole("button", { name: "送る", exact: true }), INQUIRIES_RE, "POST");
}

/** 1 件のやり取りの画面（K-1007）を開いて、題の見出しが出るまで待つ */
export async function openThread(page: Page, id: string, title: string): Promise<void> {
  await page.goto(`${ASK}/${id}`);
  await expect(page.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
}

/** 1 件のやり取りで返事を書いて送る。書く口の答えの番号を返す */
export async function replyOnScreen(page: Page, body: string): Promise<number> {
  await page.getByLabel("返事を書く", { exact: true }).fill(body);
  return clickFor(
    page,
    page.locator(".k-uh-compose").getByRole("button", { name: "送る", exact: true }),
    MESSAGES_RE,
    "POST",
  );
}

/** 「解決したので済みにする」を押す。済みにする口の答えの番号を返す */
export async function resolveOnScreen(page: Page): Promise<number> {
  return clickFor(page, page.getByRole("button", { name: "解決したので済みにする", exact: true }), RESOLVE_RE, "POST");
}

/** ボタンを押し、その口の答えを待って番号を返す（道は pathname だけで比べる・住所を出さない） */
async function clickFor(page: Page, button: Locator, re: RegExp, method: string): Promise<number> {
  const answered = page.waitForResponse((r) => re.test(new URL(r.url()).pathname) && r.request().method() === method);
  await button.click();
  return (await answered).status();
}
