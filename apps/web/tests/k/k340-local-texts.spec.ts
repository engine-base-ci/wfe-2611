// K-340「段 2 の人の確認の表で見つかった食い違いを直す（手元の画面を localhost で開いてパスキーを試せる・送りすぎ／無効リンクの文を正本にそろえる）」の試験（実 Chrome）。
//   1 手元の立ち上げ scripts/dev/up.sh は、画面の住所の 1 つ目（WEB_BASE_URL の頭＝パスキーの rpID と origin の元）を localhost にする。
//     ブラウザは IP の住所ではパスキーを作らない。案内の文も localhost の住所で出す。
//   2 送りすぎの文は正本 E-LIM-005、再設定の無効リンクの文は正本 E-PAGE-006 で出す（画面で文を作らない）。
//   本番の画面の文は前からの試験（K316-UI-006・K320-UI-016・K57-UI-017）が見る。ここではモックの頁と、古い文が画面のコードに残っていないことを見る。
//   本人の Bridge（127.0.0.1:38617）にも届かせない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const UP = join(ROOT, "scripts/dev/up.sh");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (id: string): string => {
  const e = ERRORS.find((x) => x.id === id);
  if (!e) throw new Error(`errors.json に ${id} が無い`);
  return e.message;
};
/** 前の画面の文（どちらも正本に無い文。画面のコードに残っていたら食い違い） */
const OLD_TEXTS = ["続けて押されました", "リンクが正しくありません"] as const;
/** 画面のコードの置き場（試験と生成物は見ない） */
const SRC_DIRS = ["app", "features", "components", "lib"] as const;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test("K340-UI-001 手元の立ち上げ（scripts/dev/up.sh）：WEB_BASE_URL の 1 つ目は http://localhost:$WEB_PORT（rpID は localhost）・127.0.0.1 の画面の住所は許す元にだけ残る・案内の文は localhost の住所で出し、パスキーは localhost で開くと書く", () => {
  const rows = readFileSync(UP, "utf8").split("\n");
  const web = rows.filter((r) => /^WEB_BASE_URL=/.test(r));
  expect(web, "WEB_BASE_URL を決める行は 1 つ").toHaveLength(1);
  const value = /^WEB_BASE_URL="([^"]*)"/.exec(web[0]!)?.[1] ?? "";
  const origins = value.split(",").map((x) => x.trim());
  expect(origins[0]).toBe("http://localhost:$WEB_PORT");
  expect(new URL(origins[0]!.replace("$WEB_PORT", "3124")).hostname).toBe("localhost");
  // 前からの住所で開いても口は答える（CORS の許す元には残す）
  expect(origins).toContain("http://127.0.0.1:$WEB_PORT");
  // 画面の住所を 127.0.0.1 で書いてよいのは、生きているかを curl で見る所と WEB_BASE_URL の行だけ（人に見せる文には出さない）
  const shown = rows
    .filter((r) => !/^WEB_BASE_URL=/.test(r))
    .map((r) => r.replaceAll("alive http://127.0.0.1:$WEB_PORT/login)", "alive …)"))
    .filter((r) => r.includes("127.0.0.1:$WEB_PORT"));
  expect(shown).toEqual([]);
  const start = rows.findIndex((r) => r.startsWith('say "触れます"'));
  expect(start, "案内の目印（触れます）が在る").toBeGreaterThan(0);
  const guide = rows.slice(start).join("\n");
  expect(guide).toContain("http://localhost:$WEB_PORT/signup");
  expect(guide).toContain("http://localhost:$WEB_PORT/dev/mail");
  expect(guide).toMatch(/パスキー[^\n]*localhost/);
  expect(rows.find((r) => r.includes("メールが届かなくても"))).toContain("http://localhost:$WEB_PORT/dev/mail");
});

test("K340-UI-002 画面のコード（apps/web の app・features・components・lib）に、正本に無い前の文「続けて押されました」「リンクが正しくありません」が 1 か所も無い", () => {
  const hits: string[] = [];
  for (const d of SRC_DIRS)
    for (const f of sources(join(WEB, d))) {
      const text = readFileSync(f, "utf8");
      for (const old of OLD_TEXTS) if (text.includes(old)) hits.push(`${f.slice(WEB.length + 1)}: ${old}`);
    }
  expect(hits).toEqual([]);
});

test("K340-UI-003 正の絵（モック）の文：/dev/mock/f1/login-wait は E-LIM-005 の文（42 秒）・/dev/mock/f1/reset-invalid は E-PAGE-006 の文", async ({
  page,
}) => {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  expect((await page.goto("/dev/mock/f1/login-wait"))?.status()).toBe(200);
  await expect(page.locator("main")).toContainText(msg("E-LIM-005").replace("{秒}", "42"));
  expect((await page.goto("/dev/mock/f1/reset-invalid"))?.status()).toBe(200);
  await expect(page.locator('[data-auth="reset"][data-state="invalid"]')).toContainText(msg("E-PAGE-006"));
});
