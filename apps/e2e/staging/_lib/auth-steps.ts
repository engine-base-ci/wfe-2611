// 統合テスト（staging）の入り方の 1 歩（K-456）：メールの n 通目を Resend の記録から読む・付けるまで進めない（K-321）の 2 段階を画面で付ける・
//   メールのリンクで入る。段 5 の統合テスト（k456-f4.spec.ts）が使う。段 9 の統合テスト（K-418）の `handover-steps.ts` にも同じ 4 つ（nthMailTo・totpOf・throughTwoFactor・
//   enterWithTwoFactor）の写しがある：K-418 は段 9 の枝（c/段9）で切られていて、まだ本線に無い。どちらか後に入る方が、この 1 か所に寄せる直しを切る（まとめ役への申し送り）。
//   操作と選び方は K-65 の steps.ts と同じ（あちらの enterByLink は /mfa-setup を通らない）。環境の値は読まない（住所と鍵は site.ts と resend.ts だけが読む）。
//   確かめは試験に書く。ここは進むための 1 歩だけを持つ。画面の名前は K-319 の仕様の表とモックから（実装から書かない）。staging の最初の回で違えば、ここを直す
import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { countTo, latestTo, readMail, type MailRecord } from "./resend";
import { h1, pathOf, type Person } from "./steps";

/** その宛先に n 通目が記録に出るまで待ち（一覧は 2 秒おき・K-65 の決め）、新しいほうの 1 通を読む */
export async function nthMailTo(to: string, n: number): Promise<MailRecord> {
  await expect
    .poll(() => countTo(to), {
      message: `その宛先への ${n} 通目が Resend の記録に出る`,
      timeout: 90_000,
      intervals: [2_000],
    })
    .toBeGreaterThanOrEqual(n);
  const hit = await latestTo(to);
  if (!hit) throw new Error("Resend の記録にその宛先の 1 通が無い");
  return readMail(hit.id);
}

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

/** メールのリンクを開く →「登録できました」→「続ける」→（2 段階を付ける）→ 使い始めの画面（/tickets） */
export async function enterWithTwoFactor(page: Page, link: string, p: Person): Promise<void> {
  expect((await page.goto(link))?.status(), "リンクの先が開ける").toBe(200);
  await expect(h1(page, "登録できました")).toBeVisible();
  await page.getByRole("button", { name: "続ける", exact: true }).click();
  await expect.poll(() => pathOf(page), { message: "続けた先へ移る", timeout: 30_000 }).not.toBe("/verify-email");
  await throughTwoFactor(page, p);
  await expect.poll(() => pathOf(page), "使い始めの画面（チケットの画面）へ入る").toBe("/tickets");
}
