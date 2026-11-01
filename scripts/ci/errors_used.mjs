// エラー一覧の実行時（T-F-17）。正本は 07_qa/test-specs/errors.json（第 13 軸）。
//   gen    → packages/errors/src/catalog.ts（文言と次の一手を正本から。手で直さない）
//   (既定) → apps／packages のコードが参照する E-… が正本にあるか（無いコード＝赤）。正本にあってどこからも参照されないエラー＝「出せないエラー」の候補として数を出す（画面のタスクが埋める）
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.cwd();
const SRC = "07_qa/test-specs/errors.json";
export function gen(root = ROOT) {
  const j = JSON.parse(readFileSync(join(root, SRC), "utf8"));
  const rows = j.errors.map((e) => ({ id: e.id, cls: e.class ?? "n/a", message: e.message ?? "", action: e.action ?? "", undo: !!e.undo, severity: e.severity ?? "medium", support_code: e.support_code ?? e.id, must_not: !!e.must_not, layers: e.layers ?? [], where: e.where ?? {} }));
  mkdirSync(join(root, "packages/errors/src"), { recursive: true });
  writeFileSync(join(root, "packages/errors/src/catalog.ts"), `// 生成物（scripts/ci/errors_used.mjs gen ← ${SRC}）。手で直さない。${rows.length} 件\nexport interface CatalogEntry {\n  id: string;\n  cls: string;\n  message: string;\n  action: string;\n  undo: boolean;\n  severity: string;\n  support_code: string;\n  must_not: boolean;\n  layers: string[];\n  where: Record<string, unknown>;\n}\nexport const CATALOG: Record<string, CatalogEntry> = ${JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, r])), null, 2)};\n`);
  return rows.length;
}
function* walk(dir) { if (!existsSync(dir)) return; for (const f of readdirSync(dir)) { if (f === "node_modules" || f === "dist") continue; const p = join(dir, f); if (statSync(p).isDirectory()) yield* walk(p); else if (/\.(ts|tsx|mts)$/.test(f)) yield p; } }
export function used(root = ROOT) {
  const ids = new Set(JSON.parse(readFileSync(join(root, SRC), "utf8")).errors.map((e) => e.id));
  const refs = new Map();
  for (const d of ["apps", "packages"]) for (const p of walk(join(root, d))) {
    const rel = relative(root, p); if (/node_modules|\/dist\/|catalog\.ts$|\.test\.ts$|\/test\//.test(rel)) continue; // テストは対象外（正本に無い ID を故意に使う）
    const s = readFileSync(p, "utf8");
    for (const m of s.matchAll(/\bE-[A-Z]+-\d{3}\b/g)) refs.set(m[0], [...(refs.get(m[0]) ?? []), rel]);
  }
  const unknown = [...refs.keys()].filter((k) => !ids.has(k));
  const unused = [...ids].filter((k) => !refs.has(k));
  return { total: ids.size, referenced: refs.size, unknown, unused };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "gen") { console.log(`[errors gen] ${gen()} 件 → packages/errors/src/catalog.ts`); process.exit(0); }
  const r = used();
  console.log(r.unknown.length ? `[errors] 正本に無いエラーを参照: ${r.unknown.join(", ")}` : `[errors] 参照 ${r.referenced}/${r.total}（正本に無い参照 0・まだどこからも出せないエラー ${r.unused.length}＝画面と API のタスクが埋める）`);
  process.exit(r.unknown.length ? 1 : 0);
}
