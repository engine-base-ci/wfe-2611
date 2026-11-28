// 統合テスト（staging）の段 8 の画面の 1 歩（K-596）：メールのリンクで入る（付けるまで進めないの 2 段階を画面で付ける）・PC をつなぐ・鈴を開く・探す・
//   絞って保存する・期限を変える・消す／元に戻す。操作と選び方は中間テスト（apps/web/tests/skeleton の k591〜k598 と _lib/f7-flow.ts）と同じ。写しを置いた訳は steps.ts と同じ
//   （あちらは DB・手元の受け箱・送り元の付け替えを前提にする。staging では DB を読まない・PM の決め 2）。
//   2 段階の付け方（totpOf・throughTwoFactor）は段 9 の K-418 の _lib/handover-steps.ts と同じ式（c/段9 の物で、本線にまだ無いので読まず写した。両方が本線に入ったら 1 つにまとめる）。
//   環境の値は読まない（住所と鍵は site.ts と resend.ts だけが読む）。ここは進むための 1 歩だけを持ち、行の期待結果の確かめは試験に書く。
//   画面の名前は K-319・K-467・K-471・K-478・K-479・K-484・K-590 の仕様の表とモックから（実装から書かない）。staging の最初の回で違えば、ここを直す
import { createHmac } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { latestTo, readMail, verifyLink } from "./resend";
import { h1, pathOf, submitSignup, type Person } from "./steps";

const apiPath = (url: string): string => new URL(url).pathname;

// ---------------------------------------------------------------- 付けるまで進めない（K-319・K-321）
/** 認証アプリの 6 けた（RFC 6238・SHA-1・30 秒）。鍵は画面に出た字（4 字ずつの空白を除く）。どこにも書き出さない */
export function totpOf(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secretBase32.replace(/[\s=]/g, "").toUpperCase();
  let bits = "";
  for (const c of clean) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => Number.parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const mac = createHmac("sha1", key).update(counter).digest();
  const off = mac[mac.length - 1]! & 0x0f;
  const num = (mac.readUInt32BE(off) & 0x7fffffff) % 1_000_000;
  return String(num).padStart(6, "0");
}
/** /mfa-setup に止まったら、認証アプリを画面で付けてから先へ進む（staging は DB で入り方を足せない）。止まらなければ何もしない */
export async function throughTwoFactor(page: Page, p: Person): Promise<void> {
  if (pathOf(page) !== "/mfa-setup") return;
  await page.locator(".k-auth-choice", { hasText: "認証アプリ" }).click();
  const check = page.getByRole("dialog", { name: "本人か確かめます" });
  await check.getByLabel("パスワード", { exact: true }).fill(p.password);
  await check.getByRole("button", { name: "確かめる" }).click();
  const totp = page.getByRole("dialog", { name: "2 段階認証を付ける" });
  const secret = (await totp.locator(".k-auth-secret").innerText()).trim();
  await page.getByLabel("確認のコード 1 けた目").click();
  await page.keyboard.type(totpOf(secret));
  await page
    .getByRole("dialog", { name: "バックアップコード" })
    .getByRole("button", { name: "保存したので閉じる" })
    .click();
  await expect
    .poll(() => pathOf(page), { message: "付けるまで進めないの画面を離れる", timeout: 30_000 })
    .not.toBe("/mfa-setup");
}
/** 登録の画面 → Resend の記録に出た確認のメール → リンクを開く →「続ける」→（2 段階を付ける）→ 使い始めの画面（/tickets）。登録の口の答えの番号を返す */
export async function signUpAndEnter(page: Page, me: Person): Promise<number> {
  const status = await submitSignup(page, me);
  await expect(h1(page, "確認メールを送りました")).toBeVisible();
  const found: { mail: Awaited<ReturnType<typeof latestTo>> } = { mail: null };
  await expect
    .poll(async () => (found.mail ??= await latestTo(me.email)) !== null, {
      message: "確認のメールが Resend の記録に出る",
      timeout: 90_000,
      intervals: [2_000],
    })
    .toBe(true);
  const link = verifyLink(await readMail(found.mail!.id));
  expect(link !== null, "メールの本文に確認のリンクがある").toBe(true);
  await page.goto(link!);
  await expect(h1(page, "登録できました")).toBeVisible();
  await page.getByRole("button", { name: "続ける", exact: true }).click();
  await expect.poll(() => pathOf(page), { message: "続けた先へ移る", timeout: 30_000 }).not.toBe("/verify-email");
  await throughTwoFactor(page, me);
  await expect.poll(() => pathOf(page), "使い始めの画面（チケットの画面）へ入る").toBe("/tickets");
  return status;
}

// ---------------------------------------------------------------- 押して、その口の答えの番号を返す
export async function pressAndAnswer(page: Page, button: Locator, method: string, re: RegExp): Promise<number> {
  const answered = page.waitForResponse((r) => r.request().method() === method && re.test(apiPath(r.url())));
  await button.click();
  return (await answered).status();
}
export const NOTICE_RE = /^\/api\/v1\/notifications\/[^/]+$/;
export const SEARCH_RE = /^\/api\/v1\/search$/;
export const TICKET_RE = /^\/api\/v1\/tickets\/[^/]+$/;
export const RESTORE_RE = /^\/api\/v1\/tickets\/[^/]+\/restore$/;
export const SAVED_RE = /^\/api\/v1\/saved_views$/;

// ---------------------------------------------------------------- 鈴・探す・絞って保存・期限・消す（K-467・K-471・K-478・K-479・K-484・K-590）
/** 外枠の鈴（名前は「お知らせ」か「お知らせ（N 件）」） */
export const bell = (page: Page): Locator => page.getByRole("button", { name: /^お知らせ/ }).first();
export const noticeBox = (page: Page): Locator => page.getByRole("region", { name: "お知らせ", exact: true });
export async function openBell(page: Page): Promise<Locator> {
  await bell(page).click();
  await expect(noticeBox(page)).toBeVisible();
  return noticeBox(page);
}
/** 探す欄を開いて打つ → 口の答えを待つ。箱を返す */
export async function searchFor(page: Page, q: string): Promise<Locator> {
  await page.getByPlaceholder("チケット・ナレッジ・決定を探す").click();
  const box = page.getByRole("region", { name: "探す", exact: true });
  await expect(box).toBeVisible();
  const answered = page.waitForResponse((r) => r.request().method() === "GET" && SEARCH_RE.test(apiPath(r.url())));
  await page.keyboard.type(q);
  expect((await answered).status(), "探す口が受ける").toBe(200);
  return box;
}
/** 一覧（グループ見え方）で「完了以外」に絞り、保存の小窓で名前を付けて保存する。保存の口の答えの番号を返す */
export async function saveNotDoneView(page: Page, name: string): Promise<number> {
  await page.getByRole("button", { name: "完了以外", exact: true }).click();
  await expect(page.getByRole("button", { name: "完了以外", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "検索条件を保存", exact: true }).click();
  const d = page.getByRole("dialog", { name: "検索条件を保存" });
  await d.getByRole("textbox", { name: "名前", exact: true }).fill(name);
  return pressAndAnswer(page, d.getByRole("button", { name: "保存する", exact: true }), "POST", SAVED_RE);
}
/** 詳細の期限の小窓で、すぐ選ぶ 1 つ（今日・明日…）を押し、理由を書いて変える。口の答えの番号を返す */
export async function changeDue(page: Page, pick: string, reason: string): Promise<number> {
  await page.getByRole("button", { name: "期限を変える", exact: true }).click();
  const d = page.getByRole("dialog", { name: "期限を変える" });
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: pick, exact: true }).click();
  await d.getByRole("textbox", { name: "理由" }).fill(reason);
  return pressAndAnswer(page, d.getByRole("button", { name: /^\d{2}\/\d{2} にする$/ }), "PATCH", TICKET_RE);
}
/** 詳細の「…」→「消す」→ 小窓の「消す」。消す口の答えの番号を返す（子・孫の扱いを選ばなくてよいチケット） */
export async function deleteHere(page: Page): Promise<number> {
  await page.getByRole("button", { name: "ほかの操作" }).click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "このチケットを消しますか" });
  await expect(d).toBeVisible();
  return pressAndAnswer(page, d.getByRole("button", { name: "消す", exact: true }), "DELETE", TICKET_RE);
}
