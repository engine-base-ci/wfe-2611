/* global process, console */
// Bridge の配布物を作り、置き場に目録（kaname-bridge.json）を書く（D-109・T-B-06）。
//   版の番号は日時から機械で付ける（人が手で上げない）。目録には OS と CPU ごとのファイル・指紋（sha256）・大きさを書く
//   使い方: pnpm --filter @kaname/bridge release [--arch arm64|x64|both] [--win] [--out <置き場>]
//   置き場の既定は apps/bridge/release（開発の API は BRIDGE_RELEASE_DIR でここから配る）
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, readdirSync, statSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const archOpt = opt("--arch", "both");
const withWin = args.includes("--win");
const out = resolve(opt("--out", join(ROOT, "release")));
const BUILD = join(ROOT, "release"); // electron-builder の出力先（electron-builder.yml の directories.output）

/** 日時の版（0.YYMMDD.HHMM）。数として比べるので 09:05 は 905 */
export function stampVersion(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `0.${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}.${d.getHours() * 100 + d.getMinutes()}`;
}
const version = opt("--version", stampVersion());
const sha256 = (f) =>
  new Promise((res, rej) => {
    const h = createHash("sha256");
    createReadStream(f).on("data", (c) => h.update(c)).on("end", () => res(h.digest("hex"))).on("error", rej);
  });
const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`失敗しました: ${cmd} ${a.join(" ")}`);
    process.exit(r.status ?? 1);
  }
};

const archs = archOpt === "both" ? ["--arm64", "--x64"] : [`--${archOpt}`];
run("pnpm", ["-s", "build"]);
const meta = [`-c.extraMetadata.version=${version}`, "--publish", "never"];
run("pnpm", ["exec", "electron-builder", "--mac", "zip", "dmg", ...archs, ...meta]);
if (withWin) run("pnpm", ["exec", "electron-builder", "--win", "nsis", "--x64", ...meta]);

// できたものを目録にする（この版のものだけ）
const files = [];
for (const name of readdirSync(BUILD)) {
  if (!name.includes(`-${version}-`) && !name.includes(`-${version}.`)) continue;
  let m;
  if ((m = /^Kaname-Bridge-[\d.]+-(arm64|x64)\.zip$/.exec(name))) files.push({ platform: "mac", arch: m[1], kind: "app", name });
  else if ((m = /^Kaname-Bridge-[\d.]+-(arm64|x64)\.dmg$/.exec(name))) files.push({ platform: "mac", arch: m[1], kind: "installer", name });
  else if (/^Kaname-Bridge-Setup-[\d.]+\.exe$/.test(name)) {
    files.push({ platform: "win", arch: "x64", kind: "app", name }, { platform: "win", arch: "x64", kind: "installer", name });
  }
}
if (!files.some((f) => f.kind === "app")) {
  console.error("入れ替え用の中身（zip / exe）ができていません。目録は書きません");
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const manifest = { version, released_at: new Date().toISOString(), files: [] };
for (const f of files) {
  const src = join(BUILD, f.name);
  if (out !== BUILD && !existsSync(join(out, f.name))) copyFileSync(src, join(out, f.name));
  manifest.files.push({ ...f, sha256: await sha256(src), size: statSync(src).size });
}
// 目録は最後に書く（中身が揃う前に Bridge が見に来ても古い目録のまま）
writeFileSync(join(out, "kaname-bridge.json.tmp"), JSON.stringify(manifest, null, 2) + "\n");
const { renameSync } = await import("node:fs");
renameSync(join(out, "kaname-bridge.json.tmp"), join(out, "kaname-bridge.json"));
console.log(`版 ${version} を置きました（${out}）`);
for (const f of manifest.files) console.log(`  ${f.platform}/${f.arch} ${f.kind}: ${f.name}  ${f.size} bytes  sha256 ${f.sha256.slice(0, 12)}…`);
