// 統合テスト（staging）の入る 1 歩（持ち主は K-1151。段 7 の K-1152 は K-1151 が本線に運んだこのファイルを読む）：登録 → メールのリンクで入る → 付けるまで進めないの 2 段階を画面で付ける →
//   使い始めの画面。本人確認の取り直しの小窓を通す・押してその口の答えを返す・その人のログインの印で PATCH・POST を送る。
//   2 段階の付け方（totpOf・throughTwoFactor）は段 8 の K-596 の _lib/daily-steps.ts・段 9 の K-418 の _lib/handover-steps.ts と同じ式
//   （どちらも本線にまだ無いので読まずに写した。本線に揃ったら、この 1 つに寄せる・申し送り）。
//   道具の直しは持ち主の葉（K-1151）か、直しのチケットで（K-1152 は運ばない・直さない）。
//   環境の値は読まない（住所と鍵は site.ts と resend.ts だけが読む）。鍵の字とコードはどこにも書き出さない。行の期待結果の確かめは試験に書く
import { createHmac } from "node:crypto";
import { expect, type Locator, type Page, type Response } from "@playwright/test";
import { latestTo, readMail, verifyLink } from "./resend";
import { API } from "./site";
import { h1, pathOf, submitSignup, type Person } from "./steps";

const apiPath = (url: string): string => new URL(url).pathname;

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

/** 入った人（その回の中だけで持つ。鍵の字は書き出さない） */
export interface Entered {
  status: number;
  /** 付けた認証アプリの鍵の字（登録の直後の人は、付けるまで進めない〔K-321〕ので必ず付ける） */
  totpSecret: string;
}

const stepUpDialog = (page: Page): Locator => page.getByRole("dialog", { name: "本人か確かめます", exact: true });

/** 「続ける」の後、付けるまで進めないの画面（/mfa-setup）に止められるのを上限つきで待ち、認証アプリを画面で付けてから先へ進む
 *  （staging は DB で入り方を足せない）。画面はいったん /tickets に移ってから口の 403 で /mfa-setup に移されるので、道を 1 回見て決めない。
 *  止められなければ赤（付けずに先へ進まない）。付けた鍵の字を返す */
export async function throughTwoFactor(page: Page, p: Person): Promise<string> {
  await expect
    .poll(() => pathOf(page), { message: "付けるまで進めないの画面に止められる", timeout: 30_000 })
    .toBe("/mfa-setup");
  await page.locator(".k-auth-choice", { hasText: "認証アプリ" }).click();
  const check = stepUpDialog(page);
  await check.getByLabel("パスワード", { exact: true }).fill(p.password);
  await check.getByRole("button", { name: "確かめる", exact: true }).click();
  const totp = page.getByRole("dialog", { name: "2 段階認証を付ける", exact: true });
  const secret = (await totp.locator(".k-auth-secret").innerText()).trim();
  await page.getByLabel("確認のコード 1 けた目", { exact: true }).click();
  await page.keyboard.type(totpOf(secret));
  await page
    .getByRole("dialog", { name: "バックアップコード", exact: true })
    .getByRole("button", { name: "保存したので閉じる", exact: true })
    .click();
  await expect
    .poll(() => pathOf(page), { message: "付けるまで進めないの画面を離れる", timeout: 30_000 })
    .not.toBe("/mfa-setup");
  return secret;
}

/** 登録の画面 → Resend の記録に出た確認のメール → リンクを開く →「続ける」→ 2 段階を付ける → 使い始めの画面（/tickets） */
export async function signUpAndEnter(page: Page, me: Person): Promise<Entered> {
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
  const totpSecret = await throughTwoFactor(page, me);
  await expect.poll(() => pathOf(page), "使い始めの画面（チケットの画面）へ入る").toBe("/tickets");
  return { status, totpSecret };
}

/** 出ている本人確認の取り直しの小窓を、パスワードと認証アプリの 6 けたで通す（小窓が出なければ赤） */
async function passStepUp(page: Page, p: Person, secret: string): Promise<void> {
  const check = stepUpDialog(page);
  await check.getByLabel("パスワード", { exact: true }).fill(p.password);
  await check.getByLabel("確認のコード 1 けた目", { exact: true }).click();
  await page.keyboard.type(totpOf(secret));
  await check.getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(check).toHaveCount(0);
}

/** 本人確認の取り直しの小窓が出たら通す。出なければ何もしない（取り直しが 15 分の内）。
 *  done は「押した後にだけ出る物」（取り直しが要らなかったときに出る・押す前から見えている物を渡さない） */
export async function stepUpIfAsked(page: Page, p: Person, secret: string, done: Locator): Promise<void> {
  const check = stepUpDialog(page);
  await expect(check.or(done).first(), "取り直しの小窓か、終わった印のどちらかが出る").toBeVisible();
  if (await check.isVisible()) await passStepUp(page, p, secret);
}

/** 押して、その口（method・道が re に合う）の答えを返す。1 回目の答えが 403（本人確認の取り直し・STEP_UP_REQUIRED）なら、
 *  出た小窓を通し、やり直しの答え（403 でない物）を返す。画面の印でなく口の答えで分けるので、押す前から見えている物に左右されない。
 *  403 が取り直しでない断り（権限が無い）なら小窓が出ず、時間切れで赤になる（緑にはならない） */
export async function pressThroughStepUp(
  page: Page,
  button: Locator,
  method: string,
  re: RegExp,
  p: Person,
  secret: string,
): Promise<Response> {
  const hit = (r: Response): boolean => r.request().method() === method && re.test(apiPath(r.url()));
  const first = page.waitForResponse(hit);
  await button.click();
  const one = await first;
  if (one.status() !== 403) return one;
  const again = page.waitForResponse((r) => hit(r) && r.status() !== 403);
  await passStepUp(page, p, secret);
  return again;
}

/** 押して、その口（method・道が re に合う）の答えの番号を返す */
export async function pressAndAnswer(page: Page, button: Locator, method: string, re: RegExp): Promise<number> {
  const answered = page.waitForResponse((r) => r.request().method() === method && re.test(apiPath(r.url())));
  await button.click();
  return (await answered).status();
}

/** その人の画面と同じブラウザから、本人のログインの印で契約の口に PATCH・POST を送る（画面が押させない操作を口で直に試す・steps.ts の readAs と同じ呼び方）。
 *  冪等キーを付ける（契約の入口が求める）。答えの番号と code を返す（本文は返さない） */
export async function sendAs(
  page: Page,
  method: "PATCH" | "POST",
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; code: string | null }> {
  return page.evaluate(
    async ([url, m, b]) => {
      const token = window.localStorage.getItem("kaname.token") ?? "";
      const res = await fetch(url, {
        method: m,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "idempotency-key": crypto.randomUUID(),
        },
        body: b,
      });
      // 答えが JSON でないとき（届かない・束ね役の誤りの頁）は code を null にする（読めない体を握りつぶさず、番号で赤にする）
      const isJson = (res.headers.get("content-type") ?? "").includes("json");
      const json = (isJson ? await res.json() : {}) as { code?: string };
      return { status: res.status, code: json.code ?? null };
    },
    [`${API}/api/v1${path}`, method, JSON.stringify(body)] as const,
  );
}
/** sendAs の PATCH */
export const patchAs = (page: Page, path: string, body: Record<string, unknown>) => sendAs(page, "PATCH", path, body);
