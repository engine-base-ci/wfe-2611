// 統合テスト（staging）の段 11 の画面の 1 歩（K-846）：鍵を手元に持ったまま 2 段階を付けて入る・本人確認の取り直し（K-363 と同じ形）・
//   招待中の行の送り直す／取り消す（K-809）・メンバーの「⋯」から 1 人の画面の小窓へ（D-154.63）・役割の ▾（K-818）・止める／戻す（K-821）・
//   外す（K-822）・顔の写真（K-839）・ロゴ（K-831）・メールを変える（K-840）・置き場の期限つきの住所を読む。
//   写しを置いた訳は steps.ts と同じ（中間テストの道具は DB・手元の受け箱・送り元の付け替えを前提にする。staging では DB を読まない・PM の決め 2）。
//   環境の値は読まない（住所と鍵は site.ts と resend.ts だけが読む）。ここは進むための 1 歩だけを持ち、行の期待結果の確かめは試験に書く。
//   画面の名前は K-809・K-818・K-821・K-822・K-831・K-839・K-840 の仕様の表とモック（/dev/mock/f10）から（実装から書かない）。
//   staging の最初の回で違えば、ここを直す（試験は直さない）
import { expect, type Locator, type Page } from "@playwright/test";
import { totpOf } from "./handover-steps";
import { h1, pathOf, type Person } from "./steps";

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const apiPath = (url: string): string => new URL(url).pathname;

// ---------------------------------------------------------------- 2 段階を付けて入る（鍵を手元に持つ）
/** /mfa-setup に止まったら認証アプリを画面で付け、画面に出た鍵の字を返す（本人確認の取り直しで 6 けたを作るため・どこにも書き出さない）。
 *  handover-steps.ts の throughTwoFactor と同じ 1 歩で、鍵を返すところだけが違う */
export async function twoFactorKeepingKey(page: Page, p: Person): Promise<string> {
  await expect.poll(() => pathOf(page), "付けるまで進めないの画面に止まる").toBe("/mfa-setup");
  await page.locator(".k-auth-choice", { hasText: "認証アプリ" }).click();
  const check = page.getByRole("dialog", { name: "本人か確かめます" });
  await check.getByLabel("パスワード", { exact: true }).fill(p.password);
  await check.getByRole("button", { name: "確かめる", exact: true }).click();
  const totp = page.getByRole("dialog", { name: "2 段階認証を付ける" });
  const secret = (await totp.locator(".k-auth-secret").innerText()).trim();
  await page.getByLabel("確認のコード 1 けた目", { exact: true }).click();
  await page.keyboard.type(totpOf(secret));
  await page
    .getByRole("dialog", { name: "バックアップコード" })
    .getByRole("button", { name: "保存したので閉じる", exact: true })
    .click();
  await expect
    .poll(() => pathOf(page), { message: "付けるまで進めないの画面を離れる", timeout: 30_000 })
    .not.toBe("/mfa-setup");
  return secret;
}
/** 登録の確認のメールのリンクを開く →「登録できました」→「続ける」→ 2 段階を付ける → /tickets。鍵を返す */
export async function enterKeepingKey(page: Page, link: string, p: Person): Promise<string> {
  expect((await page.goto(link))?.status(), "リンクの先が開ける").toBe(200);
  await expect(h1(page, "登録できました")).toBeVisible();
  await page.getByRole("button", { name: "続ける", exact: true }).click();
  await expect.poll(() => pathOf(page), { message: "続けた先へ移る", timeout: 30_000 }).not.toBe("/verify-email");
  const secret = await twoFactorKeepingKey(page, p);
  await expect.poll(() => pathOf(page), "使い始めの画面（チケットの画面）へ入る").toBe("/tickets");
  return secret;
}

// ---------------------------------------------------------------- 押して口の答えを見る・本人確認の取り直し（D-154.18）
export interface Pressed {
  /** 本人確認の取り直しを挟んだか（15 分以内なら口が求めない・D-125.139） */
  steppedUp: boolean;
  /** その口の最後の答えの番号 */
  status: number;
}
/** 押して、その口（method・道が re に合う）の答えを待つ。403（本人確認の取り直し）なら小窓でパスワードと 6 けたを入れ、
 *  画面が 1 回だけやり直した答えを返す（K-363 と同じ形）。時間では待たない（答えと小窓で待つ） */
export async function pressWithStepUp(
  page: Page,
  button: Locator,
  method: string,
  re: RegExp,
  me: Person,
  secret: string,
): Promise<Pressed> {
  const hit = (r: { request(): { method(): string }; url(): string }): boolean =>
    r.request().method() === method && re.test(apiPath(r.url()));
  const first = page.waitForResponse(hit);
  await button.click();
  const r1 = await first;
  if (r1.status() !== 403) return { steppedUp: false, status: r1.status() };
  const step = page.getByRole("dialog", { name: "本人か確かめます" });
  await expect(step, "本人確認の取り直しの小窓が開く").toBeVisible();
  await step.getByLabel("パスワード", { exact: true }).fill(me.password);
  await step.getByLabel("確認のコード 1 けた目", { exact: true }).click();
  await page.keyboard.type(totpOf(secret));
  const again = page.waitForResponse(hit);
  await step.getByRole("button", { name: "確かめる", exact: true }).click();
  return { steppedUp: true, status: (await again).status() };
}
/** 知らせ（role=status）のうち、字を含む物 */
export const notice = (page: Page, text: string | RegExp): Locator =>
  page.getByRole("status").filter({ hasText: text });

// ---------------------------------------------------------------- メンバーの画面（K-809・K-818・D-154.63）
export const openMembers = async (page: Page): Promise<void> => {
  expect((await page.goto("/members"))?.status(), "メンバーの画面が開ける").toBe(200);
  await expect(h1(page, "メンバー")).toBeVisible();
};
/** 人か招待の 1 行（招待中の行はメール・人の行は名前とメールを持つ） */
export const memberRow = (page: Page, text: string): Locator => page.locator("li.k-f10m-row").filter({ hasText: text });
export const RESEND_RE = /^\/api\/v1\/invitations\/[^/]+\/resend$/;
export const REVOKE_RE = /^\/api\/v1\/invitations\/[^/]+$/;
export const ROLE_RE = /^\/api\/v1\/members\/[^/]+\/role$/;
export const SUSPEND_RE = /^\/api\/v1\/members\/[^/]+\/suspend$/;
export const RESUME_RE = /^\/api\/v1\/members\/[^/]+\/resume$/;
export const REMOVE_RE = /^\/api\/v1\/members\/[^/]+\/remove$/;
export const PREVIEW_RE = /^\/api\/v1\/members\/[^/]+\/remove-preview$/;
/** 招待中の行の「送り直す」。送り直す口の答えの番号を返す */
export async function resendInvite(page: Page, email: string): Promise<number> {
  await openMembers(page);
  const res = page.waitForResponse((r) => r.request().method() === "POST" && RESEND_RE.test(apiPath(r.url())));
  await memberRow(page, email).getByRole("button", { name: "送り直す", exact: true }).click();
  return (await res).status();
}
/** 招待中の行の「取り消す」→ 確かめの「招待を取り消す」。取り消す口の答えの番号を返す */
export async function revokeInvite(page: Page, email: string): Promise<number> {
  await openMembers(page);
  await memberRow(page, email).getByRole("button", { name: "取り消す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "招待を取り消しますか" });
  const res = page.waitForResponse((r) => r.request().method() === "DELETE" && REVOKE_RE.test(apiPath(r.url())));
  await d.getByRole("button", { name: "招待を取り消す", exact: true }).click();
  return (await res).status();
}
/** 人の行の役割の ▾ から役割を選ぶ（本人確認の取り直しを挟む） */
export async function changeRole(page: Page, who: Person, role: string, me: Person, secret: string): Promise<Pressed> {
  await openMembers(page);
  await page.getByRole("button", { name: new RegExp(`^${esc(who.name)}の役割を変える`) }).click();
  return pressWithStepUp(page, page.getByRole("menuitem", { name: role, exact: true }), "PATCH", ROLE_RE, me, secret);
}
/** 人の行の「⋯」から項目を押し、メンバーの 1 人の画面（/members/<id>?do=…）へ移る。その人の id を返す */
export async function openFromMore(
  page: Page,
  who: Person,
  item: "一時的に止める" | "ワークスペースから外す",
): Promise<string> {
  await openMembers(page);
  await page.getByRole("button", { name: `${who.name}のほかの操作`, exact: true }).click();
  await page.getByRole("menuitem", { name: new RegExp(`^${esc(item)}`) }).click();
  await expect.poll(() => pathOf(page), "メンバーの 1 人の画面へ移る").toMatch(/^\/members\/[0-9a-f-]{36}$/);
  return pathOf(page).split("/").pop()!;
}
/** 止める確かめの小窓の「本人確認して止める」 */
export const suspendButton = (page: Page): Locator =>
  page
    .getByRole("dialog", { name: /を一時的に止めますか$/ })
    .getByRole("button", { name: "本人確認して止める", exact: true });
/** 止まっている帯の「戻す」→ 戻す確かめの小窓を開き、その「本人確認して戻す」を返す */
export async function resumeButton(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "戻す", exact: true }).click();
  return page
    .getByRole("dialog", { name: /を戻しますか$/ })
    .getByRole("button", { name: "本人確認して戻す", exact: true });
}
/** 外す小窓で、全部の引き継ぎ先に人を選び、「本人確認して外す」を返す */
export async function removeButton(page: Page, who: Person, heir: Person): Promise<Locator> {
  const d = page.getByRole("dialog", { name: `${who.name} さんをワークスペースから外す` });
  await expect(d, "外す小窓が開く").toBeVisible();
  await d.getByRole("combobox", { name: "全部の引き継ぎ先", exact: true }).selectOption({ label: heir.name });
  return d.getByRole("button", { name: "本人確認して外す", exact: true });
}

// ---------------------------------------------------------------- 置き場（顔の写真・ロゴ・関門 C4）
/** 1 ピクセルの PNG（中身の先頭の印で PNG と見分けられる・D-154.45・D-154.57） */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
export const PNG_SIGNATURE = "89504e470d0a1a0a";
export const AVATAR_RE = /^\/api\/v1\/me\/avatar$/;
export const LOGO_RE = /^\/api\/v1\/workspace\/logo$/;
export const EMAIL_CHANGE_RE = /^\/api\/v1\/me\/email-change$/;
const settingRow = (page: Page, name: string): Locator =>
  page.locator("li.k-set-row").filter({ has: page.locator(".k-set-name", { hasText: new RegExp(`^${esc(name)}$`) }) });
/** ボタンを押してファイルを選ぶ窓を開き、PNG を 1 つ渡す。その口（POST・re）の答えの番号を返す */
async function choosePng(page: Page, button: Locator, re: RegExp): Promise<number> {
  const chooser = page.waitForEvent("filechooser");
  await button.click();
  const res = page.waitForResponse((r) => r.request().method() === "POST" && re.test(apiPath(r.url())));
  await (await chooser).setFiles({ name: "k846.png", mimeType: "image/png", buffer: PNG_1PX });
  return (await res).status();
}
export const openAccount = async (page: Page): Promise<void> => {
  expect((await page.goto("/account"))?.status(), "自分の設定が開ける").toBe(200);
  await expect(page.getByRole("heading", { name: "プロフィール", exact: true })).toBeVisible();
};
/** プロフィールの「写真を選ぶ」で PNG を置く */
export const uploadAvatarOnScreen = (page: Page): Promise<number> =>
  choosePng(page, page.getByRole("button", { name: "写真を選ぶ", exact: true }), AVATAR_RE);
/** プロフィールの「文字に戻す」 */
export async function resetAvatarOnScreen(page: Page): Promise<number> {
  const res = page.waitForResponse((r) => r.request().method() === "POST" && AVATAR_RE.test(apiPath(r.url())));
  await page.getByRole("button", { name: "文字に戻す", exact: true }).click();
  return (await res).status();
}
/** 設定の画面の「ロゴ」の行の「変える」で PNG を置く */
export async function uploadLogoOnScreen(page: Page): Promise<number> {
  expect((await page.goto("/settings/company"))?.status(), "設定の画面が開ける").toBe(200);
  return choosePng(page, settingRow(page, "ロゴ").getByRole("button", { name: "変える", exact: true }), LOGO_RE);
}
/** 置き場の期限つきの住所を、ブラウザの外の頼み（page.request・ログインの印を付けない）で読む。番号・種類・先頭 8 バイトを返す
 *  （住所は返さない：落ちた文に置き場の住所を出さない。印 ?token= は伏せる台本が形で伏せる） */
export async function fetchStored(page: Page, url: string): Promise<{ status: number; type: string; head: string }> {
  const r = await page.request.get(url);
  return {
    status: r.status(),
    type: r.headers()["content-type"] ?? "",
    head: Buffer.from(await r.body())
      .subarray(0, 8)
      .toString("hex"),
  };
}

// ---------------------------------------------------------------- メールを変える（K-840・関門 C6）
/** プロフィールの「メール」の行の「変える」→ 新しいメール →「本人確認して送る」（本人確認の取り直しを挟む） */
export async function requestEmailOnScreen(page: Page, next: string, me: Person, secret: string): Promise<Pressed> {
  await openAccount(page);
  await settingRow(page, "メール").getByRole("button", { name: "変える", exact: true }).click();
  const d = page.getByRole("dialog", { name: "メールを変える" });
  await d.getByRole("textbox", { name: "新しいメール", exact: true }).fill(next);
  return pressWithStepUp(
    page,
    d.getByRole("button", { name: "本人確認して送る", exact: true }),
    "POST",
    EMAIL_CHANGE_RE,
    me,
    secret,
  );
}
/** 本文の中の確かめのリンク（/account/email-confirm?token=…）。無ければ null（印は伏せる台本が ?token= の形で伏せる） */
export function emailConfirmLink(m: { text: string; html: string }): string | null {
  const hit = /https?:\/\/[^\s"'<>]+\/account\/email-confirm\?token=[^\s"'<>&]+/.exec(`${m.text}\n${m.html}`);
  return hit ? hit[0] : null;
}
