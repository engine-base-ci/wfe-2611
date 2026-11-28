// K-219「キャンバスに絵が無い状態の絵を起こす」の試験（実 Chrome・画面の側は開かない）。
//   起こした 13 枚の絵を、突き合わせの組（04_design/fidelity.json・K-216）の種類の幅で開き、組の canvas のセレクタが
//   見えている要素に当たり（texts 以外の役はちょうど 1 つ）、比べる値が全部読める（「（無い）」が無い）かを見る。
//   設定の形が正しいだけでは通さない（持ち主の画面のチケットが組を入れた日に、絵の側が空で赤になるのを先に止める）。
//   キャンバスが外から読む書体は手元に差し替え（routeCanvasFonts・K-238）、外へは 1 本も出さない（G-11）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { MISSING, readVals, type FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { routeCanvasFonts } from "../_lib/fidelity-states";

interface Group {
  id: string;
  kind: string;
  canvas: string;
  widths: number[];
  pairs: FidelityPair[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const NEW_GROUPS = [
  "verify-confirming",
  "verify-expired",
  "verify-used",
  "consent-terms",
  "signup-checking",
  "signup-waiting-loading",
  "band-before",
  "band-confirm-done",
  "band-done",
  "band-delegated",
  "complete-modal",
  "approvals-empty",
  "bridge-installed",
];
const CFG = JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: Group[] };

test("K219-CV-009 起こした 13 組が設定に在る（無ければ下の行が流れないので、ここで止める）", () => {
  const ids = new Set(CFG.groups.map((g) => g.id));
  expect(NEW_GROUPS.filter((id) => !ids.has(id))).toEqual([]);
});

for (const id of NEW_GROUPS) {
  const g = CFG.groups.find((x) => x.id === id);
  for (const w of g?.widths ?? [1440]) {
    test(`K219-CV-009 ${id}（${g?.canvas ?? "?"}）幅 ${w}：組のセレクタが絵の要素に当たり、比べる値が全部読める・外へ出ない`, async ({
      browser,
    }) => {
      expect(g, `組 ${id} が無い`).toBeTruthy();
      const context = await browser.newContext({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      // いちばん外の網：頁の差し替え（routeCanvasFonts）が受けずに落ちてきた手元でない要求を数えて止める（K238-VF-002 と同じ形。
      // 差し替えて返した書体の要求も page の request には出るので、page.on("request") では数えない）
      const outside: string[] = [];
      await context.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        if (["127.0.0.1", "localhost"].includes(u.hostname)) return route.continue();
        outside.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      await routeCanvasFonts(page);
      await page.goto(pathToFileURL(join(ROOT, `04_design/canvas/${g!.canvas}.dc.html`)).href);
      for (const p of g!.pairs) await page.locator(p.canvas).first().waitFor({ state: "visible" });
      await page.evaluate(() => document.fonts.ready);
      const vals = await readVals(page, g!.pairs, "canvas");
      const bad: string[] = [];
      g!.pairs.forEach((p, i) => {
        const v = vals[i];
        if (!v) {
          bad.push(`${p.name}：要素が無い`);
          return;
        }
        const count = v.__count;
        if (!p.props.includes("texts") && count !== undefined && count !== 1)
          bad.push(`${p.name}：当たった数 ${count}`);
        for (const prop of p.props) {
          const got = v[prop];
          if (got === undefined || got === null || got === MISSING || (Array.isArray(got) && got.length === 0))
            bad.push(`${p.name}・${prop}：読めない`);
        }
      });
      expect(bad, bad.join("\n")).toEqual([]);
      expect(outside).toEqual([]);
      await context.close();
    });
  }
}

// K219-CV-017：代表が比べる 1 枚をブラウザで開き、下まで動かしたときに、どの枠にも絵が出るか（枠は 15 区画 × 2 つ＝30）
for (const w of [1440, 375]) {
  test(`K219-CV-017 比べる 1 枚 幅 ${w}：下まで動かすと 30 の枠がどれも見えていて絵が読み込まれている・外へ出ない`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
    const outside: string[] = [];
    await context.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (["127.0.0.1", "localhost"].includes(u.hostname)) return route.continue();
      outside.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    await routeCanvasFonts(page);
    await page.goto(pathToFileURL(join(ROOT, "04_design/canvas-review/K-219.html")).href);
    const frames = page.locator("iframe");
    expect(await frames.count()).toBe(30);
    const empty: string[] = [];
    for (let i = 0; i < 30; i++) {
      const f = frames.nth(i);
      await f.scrollIntoViewIfNeeded();
      await expect(f).toBeVisible();
      const src = (await f.getAttribute("src")) ?? "";
      const box = await f.boundingBox();
      if (!box || box.width < 100 || box.height < 100) empty.push(`${src}：枠が小さい`);
      const name = src.replace(/^.*\//, "").replace(/\.dc\.html$/, "");
      const frame = await (await f.elementHandle())?.contentFrame();
      if (!frame) {
        empty.push(`${src}：枠に頁が無い`);
        continue;
      }
      // 枠の頁が src の絵そのもの（無いファイルの失敗の頁でない）で、絵の中身（x-dc）と文が読み込まれている
      await expect
        .poll(
          async () =>
            frame.url().endsWith(`/canvas/${name}.dc.html`) &&
            (await frame
              .evaluate(() => !!document.querySelector("x-dc") && document.body.innerText.trim().length > 10)
              .catch(() => false)),
          { message: `${src}：絵が出ていない` },
        )
        .toBe(true);
    }
    expect(empty, empty.join("\n")).toEqual([]);
    expect(outside).toEqual([]);
    await context.close();
  });
}
