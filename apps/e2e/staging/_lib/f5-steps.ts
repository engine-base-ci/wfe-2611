// 統合テスト（staging）の段 6 の画面の 1 歩（K-773）：メールのリンクで入る（付けるまで進めないの 2 段階を画面で付ける）・確認項目を足す・
//   任せる・承認の確かめの小窓（チェックの無い確認項目の注意）・完了にする・分身の部屋で話す。
//   操作と選び方は中間テスト（apps/web/tests/skeleton の k770〜k772）と同じ。写しを置いた訳は steps.ts と同じ
//   （あちらは DB・手元の受け箱・送り元の付け替えを前提にする。staging では DB を読まない・K-65 の PM の決め 2）。
//   2 段階の付け方（totpOf・throughTwoFactor）は段 8 の K-596 の daily-steps.ts・段 9 の K-418 の handover-steps.ts・段 5 の K-456 の auth-steps.ts と同じ式
//   （どれも別の段の枝の物で、本線にまだ無いので読まず写した。いずれかが本線に入ったら 1 つにまとめる・まとめ役への申し送り）。
//   確認項目を足す・任せる・完了にするは段 5 の K-456 の f4-steps.ts・K-65 の試験（段 5 の直し）の写し（同じ理由）。
//   環境の値は読まない（住所と鍵は site.ts と resend.ts だけが読む）。ここは進むための 1 歩だけを持ち、行の期待結果の確かめは試験に書く。
//   画面の名前は下絵（/dev/mock/f5 の stop-*・checks-*・room-*・talk-*・done-*）と K-319・K-565・K-572・K-573 の仕様の表から（実装から書かない）。
//   画面の葉（K-734・K-740・K-755・K-762・K-756）が名前を下絵と変えたら、ここと K-770〜K-772 の試験を同時に直す。staging の最初の回で違えば、ここを直す
import { createHmac } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { latestTo, readMail, verifyLink } from "./resend";
import {
  APPROVE_RE,
  COMPLETE_RE,
  DELEGATE_RE,
  approveBtn,
  clickAndAnswer,
  completeBtn,
  delegateBtn,
  h1,
  pathOf,
  submitSignup,
  aiOf,
  type Person,
} from "./steps";

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
export const SPEC_ADD_RE = /^\/api\/v1\/tickets\/[^/]+\/test-specs$/;

/** 口（POST・道が re に合う）の答えの番号を、押す前から見張る。見張りを外すのは stop（固定の待ちを置かない） */
function watchPost(page: Page, re: RegExp): { status: () => number | null; stop: () => void } {
  let seen: number | null = null;
  const on = (r: { request(): { method(): string }; url(): string; status(): number }): void => {
    if (r.request().method() === "POST" && re.test(apiPath(r.url()))) seen = r.status();
  };
  page.on("response", on);
  return { status: () => seen, stop: () => page.off("response", on) };
}
/** 注意の小窓（役 dialog）が出る前に口が答えたか、小窓が先に出たかを待つ。小窓が先なら true */
async function noticeBeforeAnswer(page: Page, watch: { status: () => number | null }, what: string): Promise<boolean> {
  const dialog = page.getByRole("dialog");
  await expect.poll(async () => watch.status() !== null || (await dialog.isVisible()), { message: what }).toBe(true);
  return watch.status() === null;
}

// ---------------------------------------------------------------- 確認項目・任せる・承認・完了（K-565・K-573・K-572・K-229）
/** 詳細の確認項目の欄を開き、「＋ 確認項目を足す」→ 小窓に文 → 足す。口 createTestSpec の答えの番号を返す */
export async function addSpecOnScreen(page: Page, text: string): Promise<number> {
  const block = page.getByRole("group", { name: "確認項目の欄", exact: true });
  await expect(block).toBeVisible();
  const open = block.getByRole("button", { name: "開く", exact: true });
  if ((await open.count()) > 0) await open.click();
  await block.getByRole("button", { name: "＋ 確認項目を足す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "確認項目を足す", exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox").fill(text);
  const status = await pressAndAnswer(page, d.getByRole("button", { name: /足す$/ }), "POST", SPEC_ADD_RE);
  await expect(d).toHaveCount(0);
  return status;
}
/** 題の行の「AI に任せる」を押して、任せる口の答えの番号を返す。この葉は確認項目を足してから任せるので、確認項目 0 件の小窓（K-573）は出さない（出れば口の答えが返らず赤になる） */
export async function delegateOnScreen(page: Page): Promise<number> {
  const watch = watchPost(page, DELEGATE_RE);
  await delegateBtn(page).click();
  await expect.poll(() => watch.status(), { message: "任せる口の答えが返る" }).not.toBeNull();
  watch.stop();
  return watch.status()!;
}
/** 承認の帯の「承認して送る」→ 確かめの小窓：チェックの無い確認項目の注意（note）が出ているのを見てから、目で見たに印を付けて承認する。口の答えの番号を返す */
export async function approveWithNote(page: Page, note: RegExp): Promise<number> {
  await approveBtn(page).click();
  const sure = page.getByRole("alertdialog");
  await expect(sure.getByText(note), "チェックの無い確認項目の注意が確かめの小窓に出る（D-153.5）").toBeVisible();
  await sure.getByRole("checkbox", { name: "成果物を目で見た", exact: true }).check();
  return clickAndAnswer(page, sure.getByRole("button", { name: "承認して送る", exact: true }), APPROVE_RE);
}
/** 題の行の「完了にする」を押して、完了の口の答えの番号を返す（未チェックが残っていれば注意の小窓が出るので「このまま完了にする」） */
export async function completeOnScreen(page: Page): Promise<number> {
  const watch = watchPost(page, COMPLETE_RE);
  await completeBtn(page).click();
  if (await noticeBeforeAnswer(page, watch, "完了の口が答えるか、未チェックの注意の小窓が出る"))
    await page.getByRole("dialog").getByRole("button", { name: "このまま完了にする", exact: true }).click();
  await expect.poll(() => watch.status(), { message: "完了の口の答えが返る" }).not.toBeNull();
  watch.stop();
  return watch.status()!;
}

// ---------------------------------------------------------------- 分身の部屋（K-755・K-762・K-756）
/** 部屋の頭のタブ（ようす・話す・やったこと）。下絵は button、本番は link かもしれないので両方で探す */
export const roomTab = (page: Page, name: string): Locator => {
  const nav = page.getByRole("navigation", { name: "部屋のタブ", exact: true });
  return nav.getByRole("button", { name, exact: true }).or(nav.getByRole("link", { name, exact: true }));
};
/** 会話の吹き出しの並び */
export const thread = (page: Page): Locator => page.getByRole("list", { name: "会話", exact: true });
/** 書く欄に打って「送る」を押す（口の道は画面の葉が決めるので、口の答えは待たず、会話に出るのを試験が待つ） */
export async function sendTalk(page: Page, me: Person, text: string): Promise<void> {
  await page.getByRole("textbox", { name: `${aiOf(me)} に話す`, exact: true }).fill(text);
  await page.getByRole("button", { name: "送る", exact: true }).click();
}
