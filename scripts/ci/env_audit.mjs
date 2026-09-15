// G13 env 整合：packages/config が読む名前（env["X"]）と .env.example の名前が一致する。process.env の直接参照が packages/config 以外に無い（例外 X-002）。
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.cwd();
function* walk(dir) { if (!existsSync(dir)) return; for (const f of readdirSync(dir)) { if (f === "node_modules" || f === "dist") continue; const p = join(dir, f); if (statSync(p).isDirectory()) yield* walk(p); else if (/\.(ts|tsx|mts)$/.test(f)) yield p; } }
export function audit(root = ROOT) {
  const cfg = readFileSync(join(root, "packages/config/src/index.ts"), "utf8");
  const used = new Set([...cfg.matchAll(/env\["([A-Z0-9_]+)"\]/g)].map((m) => m[1]));
  const example = new Set(readFileSync(join(root, ".env.example"), "utf8").split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => l.split("=")[0]));
  const bad = [];
  for (const k of used) if (!example.has(k)) bad.push(`.env.example に無い: ${k}`);
  for (const k of example) if (!used.has(k)) bad.push(`packages/config が読まない: ${k}`);
  for (const d of ["apps", "packages"]) for (const p of walk(join(root, d))) {
    const rel = relative(root, p);
    if (/node_modules|\/dist\/|\.test\.ts$|\/test\//.test(rel) || rel.startsWith("packages/config/") || rel === "packages/runtime/src/index.ts") continue; // runtime は PATH/HOME を子に渡すために読む（遮断の実装）
    const s = readFileSync(p, "utf8");
    s.split("\n").forEach((l, i) => { if (/process\.env\b/.test(l) && !l.trimStart().startsWith("//")) bad.push(`${rel}:${i + 1} process.env を関門の外で読んでいる（packages/config を通す）`); });
  }
  return { used: used.size, example: example.size, bad };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = audit();
  console.log(r.bad.length ? `[G13 env] NG:\n  ${r.bad.join("\n  ")}` : `[G13 env] OK（config が読む ${r.used}・.env.example ${r.example}・関門の外の process.env なし）`);
  process.exit(r.bad.length ? 1 : 0);
}
