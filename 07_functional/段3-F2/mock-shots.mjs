// 段 3 のモックを全部の状態 × 幅 375・768・1440 で撮り、横のはみ出し（scrollWidth − clientWidth）を測る。
//   apps/web の中で: node ../../07_functional/段3-F2/mock-shots.mjs <出す場所>（モックの置き場を 3341 で立ててから）
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const out = process.argv[2];
const src = readFileSync("app/(dev)/dev/mock/f2/mocks.tsx", "utf8");
const ids = [...src.matchAll(/\{\s*id: "([^"]+)",\s*screen/g)].map((m) => m[1]);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const res = [];
for (const w of [375, 768, 1440]) {
  const p = await b.newPage({ viewport: { width: w, height: w === 375 ? 812 : 900 } });
  for (const id of ids) {
    await p.goto(`http://localhost:3341/dev/mock/f2/${id}`, { waitUntil: "load", timeout: 180000 });
    await p.waitForTimeout(400);
    const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, h1: [...document.querySelectorAll("h1")].map((h) => h.textContent).join("|") }));
    res.push({ id, w, ...m });
    // 固定の部品（左のメニュー・下のタブ）がページの途中に写らないように、画面の高さをページの高さに合わせてから撮る
    const base = w === 375 ? 812 : 900;
    const full = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.setViewportSize({ width: w, height: Math.max(base, full) });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${out}/${id}-${w}.png` });
    await p.setViewportSize({ width: w, height: base });
  }
  await p.close();
}
await b.close();
writeFileSync(`${out}/measure.json`, JSON.stringify(res, null, 1));
console.log(ids.length, "states;", "overflow>0:", res.filter((r) => r.over > 0).map((r) => `${r.id}@${r.w}:${r.over}`).join(" ") || "none");
