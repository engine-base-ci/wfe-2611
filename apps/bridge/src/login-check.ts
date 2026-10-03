// 預けたらその場で 1 回ログインだけ試す（T-B-38・D-117.1・D-117.6・D-119.2）。
//   Kaname から「login_check」の仕事を受け取ったら、AI は起こさず、Bridge 自身が専用のブラウザ（本人の PC の Chrome・Bridge の置き場のログインの状態）で
//   そのサービスを開き、預けたログイン名とパスワードを入れて、入れたらそのまま出る（ほかの操作はしない）。
//   鍵は withCredential の中だけ（終わったら消える・ディスクに書かない・AI に渡さない）。結果は種類と理由だけ（値を含まない）。
//   入れなければ理由：パスワードが違う／2 段階が要る／CAPTCHA／開けない／ログインの欄が無い。何度も試さない（1 回で終わり）。
//   本人の画面で動くのが見える（headless にしない・D-119.6）。試験だけ headless
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CredentialError, redact, withCredential, type Credential, type VaultDeps } from "./vault";

export type LoginCheckState = "ok" | "bad_password" | "needs_2fa" | "captcha" | "unreachable" | "no_form" | "stopped";
export interface LoginCheckResult {
  state: LoginCheckState;
  /** 本人に見せる理由と一手（値は含まない） */
  detail: string;
}
export interface LoginCheckDeps extends VaultDeps {
  /** Bridge の置き場（ログインの状態＝browser-profile をここに残す・D-117.4） */
  dataDir: string;
  /** 試験だけ true（本人の画面では見えるように動かす） */
  headless?: boolean;
  /** 全体の上限（既定 90 秒） */
  timeoutMs?: number;
}

// playwright-core の、ここで使う分だけの型（直接の依存に足さず、@playwright/mcp が持つものを借りる）
interface Locator {
  first(): Locator;
  count(): Promise<number>;
  isVisible(): Promise<boolean>;
  fill(v: string): Promise<void>;
  press(k: string): Promise<void>;
  click(o?: { timeout?: number }): Promise<void>;
  getAttribute(n: string): Promise<string | null>;
  nth(i: number): Locator;
}
interface Page {
  goto(url: string, o?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  locator(sel: string): Locator;
  url(): string;
  waitForLoadState(s: string, o?: { timeout?: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  frames(): { url(): string }[];
  content(): Promise<string>;
}
interface Context {
  pages(): Page[];
  newPage(): Promise<Page>;
  close(): Promise<void>;
}
interface Chromium {
  launchPersistentContext(dir: string, o: Record<string, unknown>): Promise<Context>;
}
let pwCache: { chromium: Chromium } | null = null;
/** @playwright/mcp が持つ playwright-core を借りる（Bridge 専用のブラウザと同じ Chrome・同じログインの状態） */
export function playwright(): { chromium: Chromium } | null {
  if (pwCache) return pwCache;
  try {
    const mcp = require.resolve("@playwright/mcp/package.json");
    pwCache = createRequire(mcp)("playwright-core") as { chromium: Chromium };
    return pwCache;
  } catch {
    return null;
  }
}

const USER_SEL = [
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
  'input[type="email"]',
  'input[name*="user" i]',
  'input[name*="login" i]',
  'input[name*="mail" i]',
  'input[name*="account" i]',
  'input[id*="user" i]',
  'input[id*="login" i]',
  'input[id*="mail" i]',
  'input[type="text"]',
  'input[type="tel"]',
];
const PASS_SEL = 'input[type="password"]';
const OTP_SEL = [
  'input[autocomplete="one-time-code"]',
  'input[name*="otp" i]',
  'input[name*="code" i]',
  'input[name*="token" i]',
  'input[name*="mfa" i]',
  'input[name*="2fa" i]',
  'input[id*="otp" i]',
  'input[id*="code" i]',
  'input[id*="mfa" i]',
];
const CAPTCHA_SEL = [
  'iframe[src*="recaptcha" i]',
  'iframe[src*="hcaptcha" i]',
  'iframe[src*="turnstile" i]',
  ".g-recaptcha",
  ".h-captcha",
  ".cf-turnstile",
  '[id*="captcha" i]',
  '[class*="captcha" i]',
];
const CAPTCHA_FRAME = /recaptcha|hcaptcha|turnstile|captcha/i;

/** 開く先：URL をそのまま預けたならそれ。名前だけなら https://<domain>/ */
export function targetUrl(serviceName: string | null, serviceDomain: string | null): string | null {
  const n = (serviceName ?? "").trim();
  if (/^https?:\/\//i.test(n)) return n;
  const d = (serviceDomain ?? "").trim();
  if (!d) return null;
  return `https://${d}/`;
}

async function visible(page: Page, sels: string[]): Promise<Locator | null> {
  for (const s of sels) {
    const l = page.locator(s);
    const n = await l.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 5); i++) {
      const x = l.nth(i);
      if (await x.isVisible().catch(() => false)) return x;
    }
  }
  return null;
}
async function hasCaptcha(page: Page): Promise<boolean> {
  if (page.frames().some((f) => CAPTCHA_FRAME.test(f.url()))) return true;
  return (await visible(page, CAPTCHA_SEL)) !== null;
}
/** ログイン名の欄：パスワードの欄より前にある見える文字の欄（無ければ null＝パスワードだけの画面） */
async function userField(page: Page): Promise<Locator | null> {
  return visible(page, USER_SEL);
}
const settle = async (page: Page): Promise<void> => {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
};

/** 1 回だけ入ってみる。値は c の中にだけある。戻り値・例外の文に値を混ぜない */
async function attempt(page: Page, url: string, c: Credential): Promise<LoginCheckResult> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  } catch {
    return {
      state: "unreachable",
      detail: "サービスのページを開けませんでした。宛先（URL）を確かめて預け直してください",
    };
  }
  await settle(page);
  // ログインの欄が無ければ、ログインへのリンクを 1 回だけ押してみる
  if (!(await visible(page, [PASS_SEL])) && !(await userField(page))) {
    const link = page
      .locator(
        `a:has-text("ログイン"), a:has-text("Login"), a:has-text("Log in"), a:has-text("Sign in"), button:has-text("ログイン")`,
      )
      .first();
    if (await link.isVisible().catch(() => false)) {
      await link.click({ timeout: 5_000 }).catch(() => undefined);
      await settle(page);
    }
  }
  if (await hasCaptcha(page))
    return {
      state: "captcha",
      detail: "CAPTCHA（ロボットでない確認）が出るサービスです。一度ご自身でログインしてから預け直してください",
    };
  let pass = await visible(page, [PASS_SEL]);
  const user = await userField(page);
  if (!pass && !user)
    return {
      state: "no_form",
      detail: "ログインの欄が見つかりませんでした。ログイン画面の URL を入れて預け直してください",
    };
  if (user) {
    await user.fill(c.login);
    if (!pass) {
      // 2 段の画面（先にログイン名 → 次へ → パスワード）
      await user.press("Enter");
      await settle(page);
      if (await hasCaptcha(page))
        return {
          state: "captcha",
          detail: "CAPTCHA（ロボットでない確認）が出るサービスです。一度ご自身でログインしてから預け直してください",
        };
      pass = await visible(page, [PASS_SEL]);
      if (!pass)
        return {
          state: "no_form",
          detail: "パスワードの欄が見つかりませんでした。ログイン画面の URL を入れて預け直してください",
        };
    }
  }
  const before = page.url();
  await pass!.fill(c.password);
  await pass!.press("Enter");
  await settle(page);
  if (await hasCaptcha(page))
    return {
      state: "captcha",
      detail: "CAPTCHA（ロボットでない確認）が出るサービスです。一度ご自身でログインしてから預け直してください",
    };
  if (await visible(page, OTP_SEL))
    return {
      state: "needs_2fa",
      detail:
        "2 段階認証のコードを求められました。2 段階の種類を選んで預け直してください（認証アプリは鍵から自動で入れます）",
    };
  const stillPass = await visible(page, [PASS_SEL]);
  if (stillPass && (page.url() === before || !(await visible(page, OTP_SEL))))
    return {
      state: "bad_password",
      detail: "ログイン名かパスワードが違うようです（サービスが受け付けませんでした）。確かめて預け直してください",
    };
  return { state: "ok", detail: "ログインできました（入れたらそのまま出ました）" };
}

/** Chrome のパスワードの保存を切る（D-117.6：鍵をディスクに書かない）。置き場の Preferences に書いてから開く */
function noPasswordManager(profileDir: string): void {
  const dir = join(profileDir, "Default");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "Preferences");
  let prefs: Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      prefs = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    } catch {
      prefs = {};
    }
  }
  const profile = (prefs["profile"] ?? {}) as Record<string, unknown>;
  const next = {
    ...prefs,
    credentials_enable_service: false,
    credentials_enable_autosignin: false,
    profile: { ...profile, password_manager_enabled: false },
  };
  writeFileSync(file, JSON.stringify(next));
}

/** Kaname から受け取った login_check の仕事を 1 回だけこなす。鍵は use の中だけ。ブラウザは必ず閉じる */
export async function runLoginCheck(d: LoginCheckDeps, jobId: string, credentialId: string): Promise<LoginCheckResult> {
  const pw = playwright();
  if (!pw) return { state: "stopped", detail: "専用のブラウザの部品が見つかりません。Bridge を入れ直してください" };
  const profileDir = join(d.dataDir, "browser-profile"); // AI の専用ブラウザと同じ置き場（通したログインを残す・D-117.4）
  mkdirSync(profileDir, { recursive: true });
  noPasswordManager(profileDir);
  const limit = d.timeoutMs ?? 90_000;
  let ctx: Context | null = null;
  try {
    return await withCredential(d, jobId, credentialId, async (c) => {
      const url = targetUrl(c.serviceName, c.serviceDomain ?? null);
      if (!url)
        return {
          state: "unreachable" as const,
          detail: "開く先（URL かドメイン）が分かりません。サービスの URL を入れて預け直してください",
        };
      try {
        ctx = await pw.chromium.launchPersistentContext(profileDir, {
          channel: "chrome",
          headless: d.headless ?? false,
          viewport: null,
          timeout: 30_000,
          args: ["--no-first-run", "--no-default-browser-check"],
        });
      } catch {
        return {
          state: "stopped" as const,
          detail: "Chrome を開けませんでした。Chrome が入っているか、Bridge の自己診断で確かめてください",
        };
      }
      const page = ctx.pages()[0] ?? (await ctx.newPage());
      const timer = new Promise<LoginCheckResult>((r) =>
        setTimeout(
          () =>
            r({ state: "unreachable", detail: "ログインの画面が時間内に進みませんでした。もう一度預け直してください" }),
          limit,
        ),
      );
      const r = await Promise.race([attempt(page, url, c), timer]);
      // 入れた欄を画面に残さない（タブの復元・保存の確認に値を渡さない）。ログインの状態（Cookie）は残る
      await page.goto("about:blank", { timeout: 5_000 }).catch(() => undefined);
      // 文の中に値が紛れていないことを最後に確かめる（無いはずだが、最後の砦）
      return { state: r.state, detail: redact(r.detail, c) };
    });
  } catch (e) {
    if (e instanceof CredentialError)
      return {
        state: "stopped",
        detail: `ログイン情報を受け取れませんでした（${e.message}）${e.handoff ? `。${e.handoff}` : ""}`,
      };
    return { state: "stopped", detail: "ログインを試している途中で止まりました。預け直すともう一度試します" };
  } finally {
    if (ctx) await (ctx as Context).close().catch(() => undefined);
  }
}
