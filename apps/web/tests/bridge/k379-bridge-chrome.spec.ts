// K-379「CI の画面の組に、Bridge の輪が Chrome を動かす通しの画面の試験の専用の段（G73）を足す」の見張りの試験。
//   専用の段（scripts/ci/web_run.py gate 73）だけが流す：画面の組が Bridge を組み立てた（pnpm --filter @kaname/bridge build）後に、
//   組み立てた Bridge（apps/bridge/dist）の、Chrome を起こすいちばん下の部品（browser.js の findPlaywrightMcp・dedicatedBrowser＝@playwright/mcp の置き場と
//   Bridge のログインの状態の置き場）で、台に入っている Chrome（channel chrome・頭なし）を起こし、立てた画面の的 /dev/fake-login を開いて読む・入れる・押す。
//   Kaname の口（預ける道・仕事の道）は通さない：通しの道（画面 → 口 → Bridge の輪 → Chrome → 的）の行は K-370 がこの段に足す。
//   起こし方（channel・頭なし・引数）は Bridge のログインの確かめ（Bridge の runLoginCheck）と同じ値をここに書く。
//   ログインの確かめのファイルそのものは読まない（段 4 の葉が変えるファイルなので、その変更でこの見張りが壊れない形にする。
//   同じ訳で、そのファイルの道もここに字で書かない：切る段の検査が「そのファイルを使う試験」としてこの試験を拾う）。
//   e2e:k の一覧（tests/k・tests/features）には置かない：Bridge を組み立てていない G48 でも流れて落ちる。
//   本人の Bridge（127.0.0.1:38617）と本人の Chrome のログインの状態には触らない（置き場は試験ごとの一時の置き場）。固定の待ちは使わない。
//   名前の頭は 11_tickets/K-379.md の行 ID。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type BrowserContext, type BrowserType, type Page } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DIST = join(ROOT, "apps", "bridge", "dist", "browser.js");
const WEB = process.env["BASE_URL"] ?? "http://127.0.0.1:3124";
/** Bridge のログインの確かめ（runLoginCheck）が Chrome を起こすときの値（試験なので頭なし） */
const LAUNCH = {
  channel: "chrome",
  headless: true,
  viewport: null,
  timeout: 30_000,
  args: ["--no-first-run", "--no-default-browser-check"],
};

interface Dedicated {
  cliPath: string;
  nodeBin: string;
  profileDir: string;
  outputDir: string;
}
interface BridgeBrowser {
  findPlaywrightMcp: () => string | null;
  dedicatedBrowser: (baseDir: string, nodeBin: string) => Dedicated | null;
}

/** 組み立てた Bridge の部品を読む。無ければ、何をすればよいかを言って落とす（飛ばさない） */
function bridgeBrowser(): BridgeBrowser {
  if (!existsSync(DIST))
    throw new Error(
      "組み立てた Bridge（apps/bridge/dist/browser.js）が無い。先に pnpm --filter @kaname/bridge build を流す（CI の画面の組は G73 の前に組み立てる）",
    );
  return createRequire(DIST)("./browser.js") as BridgeBrowser;
}

/** 試験ごとの一時の置き場に Bridge のログインの状態の置き場を作り、Bridge が持つ playwright-core で Chrome を起こす。終わったら閉じて置き場を消す */
async function withChrome<T>(use: (page: Page, d: Dedicated) => Promise<T>): Promise<T> {
  const base = mkdtempSync(join(tmpdir(), "k379-bridge-"));
  let ctx: BrowserContext | null = null;
  try {
    const d = bridgeBrowser().dedicatedBrowser(base, process.execPath);
    if (!d) throw new Error("Bridge 専用のブラウザの部品（@playwright/mcp）が見つからない");
    const pw = createRequire(d.cliPath)("playwright-core") as { chromium: BrowserType };
    ctx = await pw.chromium.launchPersistentContext(d.profileDir, LAUNCH);
    return await use(ctx.pages()[0] ?? (await ctx.newPage()), d);
  } finally {
    if (ctx) await ctx.close();
    rmSync(base, { recursive: true, force: true });
  }
}

const text = (page: Page, sel: string) => () => page.locator(sel).innerText();
const count = (page: Page, sel: string) => () => page.locator(sel).count();

// Chrome を起こして画面を 1〜2 回開く（台が混んでいても落ちないように余裕を持たせる）
test.setTimeout(120_000);

test("K379-BRG-001 組み立てた Bridge（apps/bridge/dist/browser.js）が在り、専用のブラウザの部品（@playwright/mcp の起動台本）の場所を返し、渡した置き場の中にログインの状態の置き場（browser-profile）と写しの置き場（browser-output）を作る", () => {
  const b = bridgeBrowser();
  const cli = b.findPlaywrightMcp();
  expect(cli, "専用のブラウザの部品が見つからない（apps/bridge の部品が入っていない）").not.toBeNull();
  expect(existsSync(cli!), `${cli} が無い`).toBe(true);
  const base = mkdtempSync(join(tmpdir(), "k379-bridge-"));
  try {
    const d = b.dedicatedBrowser(base, process.execPath);
    expect(d).toEqual({
      cliPath: cli,
      nodeBin: process.execPath,
      profileDir: join(base, "browser-profile"),
      outputDir: join(base, "browser-output"),
    });
    expect(existsSync(join(base, "browser-profile"))).toBe(true);
    expect(existsSync(join(base, "browser-output"))).toBe(true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("K379-BRG-002 Bridge が持つ playwright-core で、台に入っている Chrome（channel chrome・頭なし）を Bridge のログインの状態の置き場で起こし、的のログイン画面 /dev/fake-login?mode=ok を開くと 200 で、見出し「テスト用サービス — ログイン」とメールアドレス・パスワードの欄とボタン「ログイン」が読める", async () => {
  await withChrome(async (page, d) => {
    const res = await page.goto(`${WEB}/dev/fake-login?mode=ok`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    expect(res?.status()).toBe(200);
    await expect.poll(text(page, "h1"), { timeout: 30_000 }).toBe("テスト用サービス — ログイン");
    expect(await count(page, 'input[name="email"]')()).toBe(1);
    expect(await count(page, 'input[name="password"]')()).toBe(1);
    expect(await text(page, 'button[type="submit"]')()).toBe("ログイン");
    expect(await page.evaluate(() => navigator.userAgent)).toMatch(/Chrome\/\d+/);
    // ログインの状態は Bridge の置き場（この試験の一時の置き場）に書かれる。本人の Chrome の置き場は使わない
    expect(existsSync(join(d.profileDir, "Default"))).toBe(true);
  });
});

test("K379-BRG-003 Bridge の Chrome で入れる・押すが通る（?mode=twostep）：何も入れずに「次へ」→「メールアドレスを入れてください」。メールアドレスを入れて「次へ」→ パスワードの欄が出てボタンが「ログイン」に替わる。違うパスワードで「ログイン」→「メールアドレスかパスワードが違います」が出て欄は残る", async () => {
  await withChrome(async (page) => {
    await page.goto(`${WEB}/dev/fake-login?mode=twostep`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const submit = 'button[type="submit"]';
    // 画面の JS が動いて 2 段の形になる（ボタンが「次へ」・パスワードの欄はまだ無い）のを待ってから押す
    await expect.poll(text(page, submit), { timeout: 30_000 }).toBe("次へ");
    await expect.poll(count(page, 'input[name="password"]')).toBe(0);
    await page.locator(submit).click();
    await expect.poll(text(page, 'form [role="alert"]')).toBe("メールアドレスを入れてください");
    await page.locator('input[name="email"]').fill("me@example.com");
    await page.locator(submit).click();
    await expect.poll(count(page, 'input[name="password"]')).toBe(1);
    await expect.poll(text(page, submit)).toBe("ログイン");
    await expect.poll(count(page, 'form [role="alert"]')).toBe(0);
    await page.locator('input[name="password"]').fill("chigau");
    await page.locator(submit).click();
    await expect.poll(text(page, 'form [role="alert"]')).toBe("メールアドレスかパスワードが違います");
    expect(await count(page, 'input[name="password"]')()).toBe(1);
  });
});
