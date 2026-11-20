// K-381「メニュー・選ぶ欄の箱の置き場に重なりの順を持たせる（箱が詳細の上に貼り付く帯の下に潜らない）」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。
//   形（実装の役が作る）：Base UI の置き場（Menu・Select の Positioner。transform で重なりの層を作る）に、どれもクラス k-popup-layer を付ける。
//     k.css の .k-popup-layer が z-index を正本のトークン --k-c-popup-layer-z（DESIGN-kaname.md の components の popup-layer の zIndex・作り手 gen_tokens.py）で決める。
//     層の高さは 70：外枠と画面の上に貼り付く物（本文の道具の帯 1・上の帯 20・スマホの右のパネル 30・下のタブ 40・メニューの引き出し 45・前の外枠 components/shell の 50〜60・
//     AI の成果物の板 components/ai の 61）より上、小窓の後ろの幕（80）より下。
//   使う側の CSS で置き場（[role="presentation"]）に z-index を当てる避け方はしない（段 7 の下絵が避けていた形）。
//   見本：メニューの型（components/k/menu.tsx）は /dev/mock/f3-pc/pc-menu（PC の行の「…」・最初から開く）、外枠の自分のメニュー（shell.tsx）、
//     自分の設定の第 2 ナビ（me-sub.tsx・幅 375）、選ぶ欄（select.tsx）は小窓の中の /dev/mock/f3/cred-add-login（種類）。
//   口は呼ばない（網の手前で 599）。本人の Bridge（127.0.0.1:38617）にも届かせない（404）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
/** 小窓の後ろの幕（k.css の .k-backdrop）より上の層は、小窓・小窓の中身・飛ばす輪だけ */
const BACKDROP_Z = 80;

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(n)) out.push(p);
  }
  return out;
}
const rel = (p: string) => p.slice(ROOT.length + 1);
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const runPy = (args: string[]) =>
  execFileSync("python3", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000 });

/** 正本の popup-layer の zIndex（DESIGN-kaname.md の components） */
function designZ(): number {
  const md = readFileSync(join(ROOT, "04_design/DESIGN-kaname.md"), "utf8");
  const m = md.match(/\n {2}popup-layer:[^\n]*\n(?: {4}[^\n]*\n)*? {4}zIndex: "?(\d+)"?/);
  expect(m, "DESIGN-kaname.md の components に popup-layer の zIndex が無い").not.toBeNull();
  return Number(m![1]);
}

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "モックは口を呼ばない" }));
}
async function openMock(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(path);
  expect(res?.status(), `${path} を開けない`).toBe(200);
  await expect(page.locator(".k-shell")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
/** 画面いっぱいの覆い（貼り付く帯の代わり）を z-index z で足す。押す・読む物を受ける（pointer-events を切らない） */
const cover = (page: Page, z: number) =>
  page.evaluate((zz) => {
    const d = document.createElement("div");
    d.dataset["k381Cover"] = String(zz);
    d.style.cssText = `position:fixed;inset:0;z-index:${zz};background:transparent`;
    document.body.appendChild(d);
  }, z);
/** 箱の項目の真ん中の点で、いちばん上に描かれている物が項目の中か */
const topmostInside = (item: Locator) =>
  item.first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && e.contains(hit);
  });
/** 箱を入れる置き場（Positioner）の z-index と、正本のトークンの値 */
const layerOf = (item: Locator) =>
  item.first().evaluate((e) => {
    const pos = e.closest('[role="presentation"]') as HTMLElement | null;
    return {
      cls: pos?.className ?? "",
      z: pos ? getComputedStyle(pos).zIndex : "",
      token: getComputedStyle(document.documentElement).getPropertyValue("--k-c-popup-layer-z").trim(),
    };
  });

// ---- ファイルを読む（ブラウザ不要） ----

test('K381-SRC-001 apps/web の Base UI の置き場（Menu・Select の Positioner）はどれも className="k-popup-layer" を持つ（menu.tsx・select.tsx・shell.tsx・me-sub.tsx の 4 か所）。使う側の CSS は置き場（[role="presentation"]）を狙わない', () => {
  const files = ["components", "features", "app"].flatMap((d) => walk(join(WEB, d), /\.tsx$/));
  const seen: string[] = [];
  const bad: string[] = [];
  for (const f of files) {
    const s = noComments(readFileSync(f, "utf8"));
    for (const m of s.matchAll(/<(\w+)\.Positioner\b([^>]*)>/g)) {
      seen.push(rel(f));
      if (!/className="k-popup-layer"/.test(m[2]!)) bad.push(`${rel(f)}：${m[0]}`);
    }
  }
  expect([...new Set(seen)].sort()).toEqual(
    [
      "apps/web/components/k/me-sub.tsx",
      "apps/web/components/k/menu.tsx",
      "apps/web/components/k/select.tsx",
      "apps/web/components/k/shell.tsx",
    ].sort(),
  );
  expect(bad, bad.join("\n")).toEqual([]);
  const css = ["components", "features", "app", "styles"].flatMap((d) => walk(join(WEB, d), /\.css$/));
  const aim = css.filter((f) => /\[role="presentation"\]/.test(noComments(readFileSync(f, "utf8")))).map(rel);
  expect(aim, aim.join("\n")).toEqual([]);
});

test("K381-SRC-002 メニューの型の開くボタン MenuTrigger は disabled?（送っている間などに押せない形）を受け、aria-disabled を付ける。Base UI の Trigger に native の disabled は渡さない（焦点を落とさない）。押しても開かないことは K395-UI-024 が画面で見る", () => {
  const s = noComments(readFileSync(join(WEB, "components/k/menu.tsx"), "utf8"));
  const props = s.match(/export interface MenuTriggerProps\s*\{([^}]*)\}/);
  expect(props, "MenuTriggerProps が無い").not.toBeNull();
  expect(props![1]).toMatch(/\bdisabled\?\s*:\s*boolean/);
  const start = s.indexOf("export function MenuTrigger");
  expect(start, "MenuTrigger が無い").toBeGreaterThan(-1);
  const body = s.slice(start, s.indexOf("\nexport ", start + 1));
  expect(body).toMatch(/\bdisabled\b/);
  expect(body).toMatch(/aria-disabled/);
  const trigger = body.match(/<M\.Trigger\b[^>]*>/);
  expect(trigger, "MenuTrigger が M.Trigger を描かない").not.toBeNull();
  expect(trigger![0], "M.Trigger に native の disabled を渡している（焦点が落ちる）").not.toMatch(/\sdisabled=/);
});

test("K381-TK-001 正本 DESIGN-kaname.md の components に popup-layer（zIndex）が在り、作り手 gen_tokens.py が --k-c-popup-layer-z を出す（k-tokens.css が正本どおり・--check が緑）。k.css の .k-popup-layer は z-index: var(--k-c-popup-layer-z) だけを読む", () => {
  const z = designZ();
  const tokens = readFileSync(join(WEB, "styles/k-tokens.css"), "utf8");
  expect(tokens).toMatch(new RegExp(`--k-c-popup-layer-z:\\s*${z};`));
  expect(runPy(["04_design/gen_tokens.py", "--web", "--check"])).toMatch(/正本どおり/);
  const k = noComments(readFileSync(join(WEB, "components/k/k.css"), "utf8"));
  const rule = k.match(/\.k-popup-layer\s*\{([^}]*)\}/);
  expect(rule, "k.css に .k-popup-layer の規則が無い").not.toBeNull();
  expect(rule![1]!.trim()).toMatch(/^z-index:\s*var\(--k-c-popup-layer-z\);?$/);
});

test("K381-TK-002 層の高さ：popup-layer の値は、画面の CSS（components/k・features・app）のほかの z-index のうち小窓の後ろの幕（80）より下の物のどれよりも大きく、80 より小さい", () => {
  const z = designZ();
  const css = ["components", "features", "app"].flatMap((d) => walk(join(WEB, d), /\.css$/));
  const others = css.flatMap((f) =>
    [...noComments(readFileSync(f, "utf8")).matchAll(/z-index:\s*(\d+)/g)].map((m) => ({ f: rel(f), v: Number(m[1]) })),
  );
  const below = others.filter((o) => o.v < BACKDROP_Z);
  expect(below.length, "比べる z-index が 1 つも無い").toBeGreaterThan(0);
  const over = below.filter((o) => o.v >= z).map((o) => `${o.f}：${o.v}`);
  expect(over, over.join("\n")).toEqual([]);
  expect(z).toBeLessThan(BACKDROP_Z);
});

test("K381-DS-001 design_gate の D1〜D8（--part --scales --usage）が緑：足した部品 popup-layer の対応（design-gate.json）が在り、FAIL が無い", () => {
  const out = runPy([
    "scripts/ci/design_gate.py",
    "--design",
    "04_design/DESIGN-kaname.md",
    "--mocks",
    "apps/web/components/k",
    "apps/web/features",
    "--css",
    "apps/web/styles/k-tokens.css",
    "--part",
    "--scales",
    "--usage",
    "apps/web",
    "apps/bridge/src",
  ]);
  expect(out).not.toMatch(/\bFAIL\b/);
  expect(out).not.toMatch(/D5 popup-layer/);
});

// ---- 実ブラウザ：箱は貼り付く帯の上に出る ----

test("K381-UI-001 メニューの型（/dev/mock/f3-pc/pc-menu・幅 1440）：置き場はクラス k-popup-layer で z-index が正本のトークンの値。画面いっぱいの覆い（z-index 1・20・45・61）を足しても、項目の真ん中の点でいちばん上は項目", async ({
  page,
}) => {
  await guard(page);
  await openMock(page, "/dev/mock/f3-pc/pc-menu", 1440);
  const item = page.getByRole("menuitem");
  await expect(item.first()).toBeVisible();
  const l = await layerOf(item);
  expect(l.cls).toContain("k-popup-layer");
  expect(l.token).toBe(String(designZ()));
  expect(l.z).toBe(l.token);
  for (const z of [1, 20, 45, 61]) {
    await cover(page, z);
    expect(await topmostInside(item), `覆い z-index ${z} の下に潜る`).toBe(true);
  }
});

test("K381-UI-002 箱は小窓の後ろの幕の層より下：z-index 80 の覆いを足すと、項目の真ん中の点でいちばん上は覆い（pc-menu・幅 1440）", async ({
  page,
}) => {
  await guard(page);
  await openMock(page, "/dev/mock/f3-pc/pc-menu", 1440);
  const item = page.getByRole("menuitem");
  await expect(item.first()).toBeVisible();
  await cover(page, BACKDROP_Z);
  expect(await topmostInside(item)).toBe(false);
});

test("K381-UI-003 外枠の自分のメニュー（shell.tsx・幅 1440・/dev/mock/f3-pc/pc-menu の外枠）：開いた箱の「預けたログイン情報」は、z-index 20・45 の覆いを足してもいちばん上", async ({
  page,
}) => {
  await guard(page);
  await openMock(page, "/dev/mock/f3-pc/pc-menu", 1440);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem")).toHaveCount(0);
  await page.getByRole("button", { name: "自分のメニュー", exact: true }).click();
  const item = page.getByRole("menuitem", { name: "預けたログイン情報" });
  await expect(item).toBeVisible();
  expect((await layerOf(item)).cls).toContain("k-popup-layer");
  for (const z of [20, 45]) {
    await cover(page, z);
    expect(await topmostInside(item), `覆い z-index ${z} の下に潜る`).toBe(true);
  }
});

test("K381-UI-004 自分の設定の第 2 ナビ（me-sub.tsx・幅 375・/dev/mock/f3/cred-list）：ボタンで開いた一覧の項目は、z-index 40・45 の覆い（下のタブ・引き出しの層）を足してもいちばん上", async ({
  page,
}) => {
  await guard(page);
  await openMock(page, "/dev/mock/f3/cred-list", 375);
  await page.getByRole("button", { name: /自分の設定の中を選ぶ/ }).click();
  const item = page.getByRole("menuitem").first();
  await expect(item).toBeVisible();
  expect((await layerOf(item)).cls).toContain("k-popup-layer");
  for (const z of [40, 45]) {
    await cover(page, z);
    expect(await topmostInside(item), `覆い z-index ${z} の下に潜る`).toBe(true);
  }
});

test("K381-UI-005 選ぶ欄（select.tsx）が小窓の中で開く（/dev/mock/f3/cred-add-login の「種類」・幅 1440）：選ぶ物の箱は小窓の上に出て、選ぶ物の真ん中の点でいちばん上は選ぶ物。小窓は開いたまま", async ({
  page,
}) => {
  await guard(page);
  await openMock(page, "/dev/mock/f3/cred-add-login", 1440);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: "種類", exact: true }).click();
  const option = page.getByRole("option").first();
  await expect(option).toBeVisible();
  expect((await layerOf(option)).cls).toContain("k-popup-layer");
  expect(await topmostInside(option)).toBe(true);
  await expect(dialog).toBeVisible();
});
