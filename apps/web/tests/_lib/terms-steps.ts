// 同意し直しの画面で同意して中へ入る道具（K-342）。中間テスト 1（K-54 の m1-signup-verify-terms.spec.ts）と K-342 の試験が使う。
//   同意すると画面はすぐ next（チャット）へ移り、その画面の口を呼ぶ。ログインし直した人のセッションには付けるまで進めない（K-321）の印が
//   立っているので、移る前に印を下ろす（readyToEnter）。移った後に下ろすと、移った先の 403・MFA_REQUIRED が少し後に /mfa-setup へ移し、
//   次の goto と取り合う（K-342・CI の VM の重さで出た）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Page } from "@playwright/test";
import { addTestEntry, admin } from "./api";

export const TERMS_STEP = /\/login\?step=terms/;

/** 入り方を 1 つ持つ人にする（試験の鍵を置き、今のセッションの「付けるまで進めない」の印を下ろす・K-321）。
 *  登録と同意し直しを見る試験は、付けるまで進めない（K-319）は見ないので、「続ける」「同意して続ける」・中へ入る前に呼ぶ */
export async function readyToEnter(email: string): Promise<void> {
  const [u] = await admin<{ id: string }>('select id from kaname_auth."user" where email = $1', [email]);
  await addTestEntry(u!.id);
}

/** 同意し直しの画面で同意する → 同意し直しの画面を出る。押す前に印を下ろす（移った先の口が 403 を返さない） */
export async function agreeOnTerms(page: Page, email: string): Promise<void> {
  await readyToEnter(email);
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "同意して続ける" }).click();
  await expect(page).not.toHaveURL(TERMS_STEP, { timeout: 15_000 });
}
