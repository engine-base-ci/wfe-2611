// 段 12 のモック（取引先と回す）を全部の状態 × 幅 375・768・1440 で開き、横のはみ出し（scrollWidth − clientWidth）を測る。
//   apps/web の中で: node ../../07_functional/段12-F11/mock-shots.mjs <出す場所> [id の頭] [口]（モックの置き場を立ててから。口の既定は 3477）
//   写しは 375 と 1440 を PNG で撮り、下絵の頁に埋め込む JPEG（品質 82）も同じ名前で置く。768 は測るだけ（SHOT_768=1 を付けると 768 も撮る）。
//   小窓が開いている状態は画面の高さのまま撮り、足のボタンが画面の中にあるかも測る。
//   段 10 の 07_functional/段10-F9/mock-shots.mjs と同じ形（置き場と口だけ違う）
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
// @playwright/test は apps/web の依存。台本の置き場（07_functional）からは辿れないので、立てた場所（apps/web）から読む
const { chromium } = createRequire(`${process.cwd()}/package.json`)("@playwright/test");
const out = process.argv[2];
const head = process.argv[3] ?? "";
const PORT = process.argv[4] ?? "3477";
const src = ["mocks.tsx"].map((f) => readFileSync(`app/(dev)/dev/mock/f11/${f}`, "utf8")).join("\n");
const ids = [...src.matchAll(/\{\s*id: "([^"]+)",\s*no:/g)].map((m) => m[1]).filter((id) => id.startsWith(head));
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const res = [];
const errors = [];
for (const w of [375, 768, 1440]) {
  const base = w === 375 ? 812 : 900;
  const p = await b.newPage({ viewport: { width: w, height: base } });
  let now = "";
  p.on("pageerror", (e) => errors.push(`${now}@${w} pageerror: ${e.message.slice(0, 200)}`));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(`${now}@${w} console: ${m.text().slice(0, 200)}`);
  });
  for (const id of ids) {
    now = id;
    await p.goto(`http://localhost:${PORT}/dev/mock/f11/${id}`, { waitUntil: "load", timeout: 180000 });
    // 開発の立ち上げの印（Next の左下の丸）は写しに入れない（画面の部品ではない）
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"], [role="alertdialog"]');
      const act = dlg?.querySelector(".k-dialog-actions");
      const r = act?.getBoundingClientRect();
      const missing = document.body.innerText.includes("この状態はまだありません");
      return {
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        dialog: !!dlg,
        buttonsSeen: r ? r.top >= 0 && r.bottom <= innerHeight : null,
        missing,
      };
    });
    res.push({ id, w, ...m });
    if (w !== 768 || process.env.SHOT_768 === "1") {
      // 固定の部品（左のメニュー・下のタブ）がページの途中に写らないように、画面の高さをページの高さに合わせてから撮る
      const full = m.dialog ? base : await p.evaluate(() => document.documentElement.scrollHeight);
      await p.setViewportSize({ width: w, height: Math.max(base, full) });
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${out}/${id}-${w}.png` });
      await p.screenshot({ path: `${out}/${id}-${w}.jpg`, type: "jpeg", quality: 82 });
      await p.setViewportSize({ width: w, height: base });
    }
  }
  await p.close();
}
await b.close();
writeFileSync(`${out}/measure.json`, JSON.stringify({ states: res, errors }, null, 1));
const bad = (f) => res.filter(f).map((r) => `${r.id}@${r.w}${r.over ? `:${r.over}` : ""}`).join(" ") || "none";
console.log(ids.length, "states; overflow>0:", bad((r) => r.over > 0));
console.log("buttons hidden:", bad((r) => r.buttonsSeen === false));
console.log("missing:", bad((r) => r.missing));
console.log("errors:", errors.length ? `\n${[...new Set(errors)].join("\n")}` : "none");
