// 基盤依存の境界（dependency-boundaries.json）の検査（G7 import 境界・G8 ライセンス・G9 台帳）。
//   それまで package.json の ci:boundary／ci:license-boundary／ci:ledger-sync は gate_pending（T-F-05 待ちの札）のままで、
//   T-F-05 が done になっても実物の検査が無かった（spec-sync Tier G「実装があるのに検査が用意されていない」・2026-10-20）。
//   --import  : allowed_paths の外から forbidden_import_patterns を import／呼び出していたら赤（portability-ledger.md の越境は許す・型だけの import は許す）
//   --license : Open Core の ee/ を含むパスからの import は赤（Infisical・langfuse・litellm 等）
//   --ledger  : portability-ledger.md の「現在の越境」の行が指すファイルが実在し、台帳に無い越境が無い
//   --all     : 3 つ全部。--id B1 で境界を絞る。テスト（*.test.ts／tests/）は対象外（正本 choke-points.md「テストコードは対象外にしてよいが明記する」）
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const B = JSON.parse(readFileSync(join(ROOT, "03_architecture/dependency-boundaries.json"), "utf8"));
const LEDGER = join(ROOT, "03_architecture/portability-ledger.md");
const args = process.argv.slice(2);
const want = (f) => args.includes(f) || args.includes("--all");
const only = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;
const SKIP = /(^|\/)(node_modules|dist|release|\.next[\w-]*|coverage|playwright-report|test-results|pw-reports|vt-reports)(\/|$)/;
const TEST = /(^|\/)(tests?|__tests__|test-results)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const EXT = /\.(c|m)?(j|t)sx?$/;

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const rel = relative(ROOT, p);
    if (SKIP.test(rel)) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.test(f) && !TEST.test(rel)) yield rel;
  }
}
const files = [...walk(join(ROOT, "apps")), ...walk(join(ROOT, "packages"))];

/** 台帳の「現在の越境」の表から、許した場所（backtick の path）を拾う */
function ledgerPaths() {
  if (!existsSync(LEDGER)) return [];
  const out = [];
  let inTable = false;
  for (const ln of readFileSync(LEDGER, "utf8").split("\n")) {
    if (ln.startsWith("## 現在の越境")) { inTable = true; continue; }
    if (ln.startsWith("## ") && inTable) inTable = false;
    if (!inTable || !ln.startsWith("|") || /^\|\s*ID\s*\|/.test(ln) || /^\|-/.test(ln)) continue;
    for (const m of ln.matchAll(/`([\w./-]+)`/g)) if (m[1].includes("/")) out.push(m[1]);
  }
  return out;
}
const excused = (rel, led) => led.some((x) => rel === x || rel.startsWith(x.replace(/\/?$/, "/")));
const isModule = (pat) => pat.includes("/") || pat.includes("@") || pat.includes("-") || /^[a-z][a-z0-9]*$/.test(pat);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const fails = [];
let importLines = 0;

if (want("--import") || want("--ledger")) {
  const led = ledgerPaths();
  for (const b of B.boundaries) {
    if (only && b.id !== only) continue;
    const pats = b.forbidden_import_patterns ?? [];
    if (!pats.length) continue;
    const allow = (b.allowed_paths ?? []).map((a) => a.replace(/\/?$/, "/"));
    const mods = pats.filter(isModule);
    const bare = pats.filter((p) => !isModule(p));
    const rxImport = mods.length ? new RegExp(`(?:^|\\n)\\s*(?:import|export)\\s[^;\\n]*?from\\s*['"](?:${mods.map(esc).join("|")})(?:['"/])|require\\(\\s*['"](?:${mods.map(esc).join("|")})(?:['"/])|import\\(\\s*['"](?:${mods.map(esc).join("|")})(?:['"/])`) : null;
    const rxBare = bare.length ? new RegExp(`(?<![\\w.])(?:new\\s+)?(?:${bare.map(esc).join("|")})\\s*\\(`) : null;
    for (const rel of files) {
      if (allow.some((a) => rel.startsWith(a) || rel === a.replace(/\/$/, ""))) continue;
      const body = readFileSync(join(ROOT, rel), "utf8");
      const m = (rxImport && rxImport.exec(body)) || (rxBare && rxBare.exec(body));
      if (!m) continue;
      const line = body.slice(body.lastIndexOf("\n", m.index) + 1, body.indexOf("\n", m.index + m[0].length));
      if (/^\s*(import|export)\s+type\s|,\s*type\s+\{/.test(line)) continue; // 型だけの依存（越境ではない）
      importLines += 1;
      if (excused(rel, led)) continue;
      fails.push(`[G7 ${b.id}] ${rel} が境界 ${b.allowed_paths?.join(",")} の外から ${b.vendor} を直接呼んでいる（台帳 portability-ledger.md に無い）: ${line.trim().slice(0, 80)}`);
    }
  }
  if (want("--ledger")) {
    for (const p of led) {
      const abs = join(ROOT, p);
      if (!existsSync(abs)) fails.push(`[G9] 台帳の越境 ${p} が実在しない（解消したなら「解消済」に書き換える）`);
    }
  }
}

if (want("--license")) {
  const rx = /(?:from|require\(|import\()\s*['"]([^'"]*(?:^|\/)ee\/[^'"]*)['"]/g;
  for (const rel of files) {
    const body = readFileSync(join(ROOT, rel), "utf8");
    for (const m of body.matchAll(rx)) fails.push(`[G8] ${rel} が Open Core の ee/ を import している: ${m[1]}`);
  }
}

const which = ["--import", "--license", "--ledger"].filter(want).join(" ");
if (fails.length) {
  for (const f of fails) console.error("  ★", f);
  console.error(`FAIL — 境界 ${which}：${fails.length} 件（検査 ${files.length} ファイル・テスト除く）`);
  process.exit(1);
}
console.log(`[boundary ${which}] OK（${files.length} ファイル・越境の行 ${importLines}・台帳で許した分を含む・テスト除く）`);
