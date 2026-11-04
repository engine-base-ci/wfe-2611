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
    if (/node_modules|\/dist\/|\.test\.ts$|\/test\/|\/tests\/|\.spec\.ts$/.test(rel) || rel.startsWith("packages/config/") || rel === "packages/runtime/src/index.ts" || rel === "apps/web/lib/env.ts" ||
      rel === "apps/web/next.config.ts" || rel === "apps/api/src/dev.ts" || /playwright\.config\.ts$/.test(rel)) continue; // apps/web/lib/env.ts は画面側の起動設定（NEXT_PUBLIC_* は build 時に埋まる）・playwright.config はテストの設定 // runtime は PATH/HOME を子に渡すために読む（遮断の実装）
    const s = readFileSync(p, "utf8");
    s.split("\n").forEach((l, i) => { if (/process\.env\b/.test(l) && !l.trimStart().startsWith("//")) bad.push(`${rel}:${i + 1} process.env を関門の外で読んでいる（packages/config を通す）`); });
  }
  return { used: used.size, example: example.size, bad };
}
// 関門の外の process.env は、記録（scripts/ci/env_baseline.json）のファイルと数までは赤にしない（KN-114 で検査が働くようにしたとき既にあった分・KN-117 で片付ける）。
//   記録に無いファイル・記録より増えたら赤。減ったら記録を下げるよう言う（D-128.117・D-128.123）
export function judge(r, base) {
  const per = {};
  const other = [];
  for (const b of r.bad) {
    const m = /^(.+?):\d+ process\.env を関門の外で読んでいる/.exec(b);
    if (m) per[m[1]] = (per[m[1]] ?? 0) + 1;
    else other.push(b);
  }
  const fails = [...other];
  const notes = [];
  const rec = base?.files ?? {};
  for (const [f, n] of Object.entries(per)) {
    if (!(f in rec)) fails.push(`${f}：関門の外の process.env ${n} か所（記録に無い）`);
    else if (n > rec[f]) fails.push(`${f}：関門の外の process.env が ${rec[f]} → ${n} に増えた`);
    else if (n < rec[f]) notes.push(`${f}：${rec[f]} → ${n} に減った（env_baseline.json を下げる）`);
  }
  for (const f of Object.keys(rec)) if (!(f in per)) notes.push(`${f}：0 になった（env_baseline.json から外す）`);
  return { fails, notes, recorded: Object.values(per).reduce((a, b) => a + b, 0) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = audit();
  const bp = join(ROOT, "scripts/ci/env_baseline.json");
  const base = existsSync(bp) ? JSON.parse(readFileSync(bp, "utf8")) : {};
  const j = judge(r, base);
  for (const n of j.notes) console.log(`  note ${n}`);
  if (j.fails.length) console.log(`[G13 env] NG:\n  ${j.fails.join("\n  ")}`);
  else console.log(`[G13 env] OK（config が読む ${r.used}・.env.example ${r.example}・関門の外の process.env は記録どおり ${j.recorded} か所（${base.ticket ?? "-"} で片付ける））`);
  process.exit(j.fails.length || j.notes.length ? 1 : 0);
}
