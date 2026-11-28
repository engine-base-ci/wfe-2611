// 段 7 のモックを全部の状態 × 幅 375・768・1440 で開き、横のはみ出し（scrollWidth − clientWidth）を測る。写しは 375 と 1440 だけ撮る（768 は測るだけ）。
//   apps/web の中で: node ../../07_functional/段7-F6/mock-shots.mjs <出す場所> [id の頭]（モックの置き場を 3447 で立ててから）
//   1440 は JPEG（品質 80）で撮る（下絵の頁に埋め込む大きさを抑える）。小窓が開いている状態は画面の高さのまま撮り、足のボタンが画面の中にあるかも測る
//   段 4 の 07_functional/段4-F3/mock-shots.mjs と同じ形（置き場と幅だけ違う）
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
// @playwright/test は apps/web の依存。台本の置き場（07_functional）からは辿れないので、立てた場所（apps/web）から読む
const { chromium } = createRequire(`${process.cwd()}/package.json`)("@playwright/test");
const out = process.argv[2];
const head = process.argv[3] ?? "";
const PORT = 3447;
const src = readFileSync("app/(dev)/dev/mock/f6/mocks.tsx", "utf8");
const ids = [...src.matchAll(/\{\s*id: "([^"]+)",\s*screen/g)].map((m) => m[1]).filter((id) => id.startsWith(head));
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const res = [];
for (const w of [375, 768, 1440]) {
  const base = w === 375 ? 812 : 900;
  const p = await b.newPage({ viewport: { width: w, height: base } });
  for (const id of ids) {
    await p.goto(`http://localhost:${PORT}/dev/mock/f6/${id}`, { waitUntil: "load", timeout: 180000 });
    // 開発の立ち上げの印（Next の左下の丸）は写しに入れない（画面の部品ではない）
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"], [role="alertdialog"]');
      const act = dlg?.querySelector(".k-dialog-actions");
      const r = act?.getBoundingClientRect();
      const wide = [...document.querySelectorAll(".k-detail-tabs, .k-talk-filters, .k-talk-tools, .k-detail-meta")].map(
        (t) => t.scrollWidth - t.clientWidth,
      );
      return {
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        partOver: Math.max(0, ...wide),
        dialog: !!dlg,
        menu: !!document.querySelector('[role="menu"]'),
        buttonsSeen: r ? r.top >= 0 && r.bottom <= innerHeight : null,
        ps: document.querySelector("[data-ps]")?.getAttribute("data-ps") ?? null,
      };
    });
    res.push({ id, w, ...m });
    if (w === 768) continue;
    // 固定の部品（左のメニュー・下のタブ）がページの途中に写らないように、画面の高さをページの高さに合わせてから撮る（小窓は画面の高さのまま。開いたメニューは頁に付いて動くので、頁の高さで撮る）
    const full = m.dialog ? base : await p.evaluate(() => document.documentElement.scrollHeight);
    await p.setViewportSize({ width: w, height: Math.max(base, full) });
    await p.waitForTimeout(200);
    if (w === 1440) await p.screenshot({ path: `${out}/${id}-${w}.jpg`, type: "jpeg", quality: 80 });
    else await p.screenshot({ path: `${out}/${id}-${w}.png` });
    await p.setViewportSize({ width: w, height: base });
  }
  await p.close();
}
await b.close();
writeFileSync(`${out}/measure.json`, JSON.stringify(res, null, 1));
console.log(ids.length, "states;", "overflow>0:", res.filter((r) => r.over > 0 || r.partOver > 0).map((r) => `${r.id}@${r.w}:${r.over}/${r.partOver}`).join(" ") || "none");
console.log("buttons hidden:", res.filter((r) => r.buttonsSeen === false).map((r) => `${r.id}@${r.w}`).join(" ") || "none");
console.log("no ps:", res.filter((r) => !r.ps).map((r) => `${r.id}@${r.w}`).join(" ") || "none");
