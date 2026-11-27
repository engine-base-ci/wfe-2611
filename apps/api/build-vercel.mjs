// 2026-11-14：配りを起こし直した（コミットの名義が個人の物だった間、Vercel が配りを止めていた・K-201）
// Vercel に置く API を組み立てる（D-097）。packages は TypeScript の src を export しているので、
// そのまま渡すと workspace の .ts が実行時に読めない。ここで全部を 1 本の JS にまとめ、
// Vercel の Build Output API の形（.vercel/output）で置く：関数 1 本（api.func）＋全部の道をそこへ回す。
// 使う人：Vercel の Build Command（apps/api/vercel.json）。手元でも `node apps/api/build-vercel.mjs` で同じものができる。
// 関数の処理の場所は .vc-config.json の regions が正（この形の関数には vercel.json の regions が効かなかった・K-246）。
// 場所の決まりは scripts/ci/staging_region.json の 1 か所（K-212）から読む。読めなければ何も消さずに止める。
// 呼び方：node apps/api/build-vercel.mjs [--region-config <ファイル>]
/* global console, process */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

/** 関数の上限（秒）。Bridge の待ち受け（最長 20 秒・D-097.4）より十分長く */
const MAX_DURATION_SEC = 60;

/** Vercel の地域の符号の形（英小文字 3 字＋数字 1 字） */
const REGION_CODE = /^[a-z]{3}[0-9]$/;

const here = dirname(fileURLToPath(import.meta.url));

/** 場所の決まりのファイル：--region-config <ファイル>、無ければリポジトリの scripts/ci/staging_region.json */
function regionConfigPath(argv) {
  const i = argv.indexOf("--region-config");
  if (i === -1) return join(here, "../../scripts/ci/staging_region.json");
  const v = argv[i + 1];
  if (!v) throw new Error("--region-config にファイルが無い");
  return v;
}

/** 決まりから処理の場所を 1 つ読む。読めない・形が違うときは投げる（黙って既定の場所にしない） */
function readFunctionRegion(path) {
  let text;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    throw new Error(`ファイルが無い・読めない: ${path}`);
  }
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch {
    throw new Error(`JSON でない: ${path}`);
  }
  const region = cfg && typeof cfg === "object" ? cfg.function_region : undefined;
  if (typeof region !== "string") throw new Error(`function_region が無い・文字列でない: ${path}`);
  if (!REGION_CODE.test(region)) throw new Error(`function_region が地域の符号の形でない: ${path}`);
  return region;
}

let region;
try {
  region = readFunctionRegion(regionConfigPath(process.argv.slice(2)));
} catch (e) {
  // 出力を消す前に止める（前の出力を残す）
  console.error(`[build-vercel] ★ 処理の場所の決まりを読めない（${e instanceof Error ? e.message : String(e)}）`);
  process.exit(1);
}
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
// 請求書の PDF の字の書体（K-1013・@kaname/billing）は実行時に読むので、1 本の横の assets に写す（許諾の文も一緒に）
mkdirSync(join(fn, "assets"), { recursive: true });
for (const f of ["NotoSansJP-Regular.ttf", "OFL.txt"]) {
  copyFileSync(join(here, "../../packages/billing/assets", f), join(fn, "assets", f));
}
writeFileSync(
  join(fn, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      maxDuration: MAX_DURATION_SEC,
      regions: [region],
    },
    null,
    2,
  ),
);
// 全部の道（/health・/api/…）を関数 1 本へ。関数の中の Hono が道を見分ける
writeFileSync(
  join(out, "config.json"),
  JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/api" }] }, null, 2),
);
const bytes = Object.values(r.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(
  `[build-vercel] .vercel/output/functions/api.func（${(bytes / 1024 / 1024).toFixed(1)} MB・警告 ${r.warnings.length}・処理の場所 ${region}）`,
);
