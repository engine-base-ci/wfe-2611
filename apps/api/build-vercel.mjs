// Vercel に置く API を組み立てる（D-097）。packages は TypeScript の src を export しているので、
// そのまま渡すと workspace の .ts が実行時に読めない。ここで全部を 1 本の JS にまとめ、
// Vercel の Build Output API の形（.vercel/output）で置く：関数 1 本（api.func）＋全部の道をそこへ回す。
// 使う人：Vercel の Build Command（apps/api/vercel.json）。手元でも `node apps/api/build-vercel.mjs` で同じものができる。
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

/** 関数の上限（秒）。Bridge の待ち受け（最長 20 秒・D-097.4）より十分長く */
const MAX_DURATION_SEC = 60;

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, ".vercel/output");
const fn = join(out, "functions/api.func");
rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });
const r = await build({
  entryPoints: [join(here, "src/vercel.ts")],
  outfile: join(fn, "index.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  // pg-native は入れていない（pg が任意で探すだけ）。ESM で require を使う依存のために require を用意する
  external: ["pg-native"],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
  metafile: true,
});
writeFileSync(
  join(fn, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: MAX_DURATION_SEC }, null, 2),
);
// 全部の道（/health・/api/…）を関数 1 本へ。関数の中の Hono が道を見分ける
writeFileSync(join(out, "config.json"), JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/api" }] }, null, 2));
const bytes = Object.values(r.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`[build-vercel] .vercel/output/functions/api.func（${(bytes / 1024 / 1024).toFixed(1)} MB・警告 ${r.warnings.length}）`);
