// Bridge の配布物の目録（apps/bridge/release/kaname-bridge.json）が、置いてある配布物と合っているか（T-B-06・D-109）。
//   目録の各 files[].name が release/ に実在し、sha256 と size が一致する。合わなければ赤（自動更新が壊れた配布物を取る）。
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const DIR = "apps/bridge/release";
const M = JSON.parse(readFileSync(join(DIR, "kaname-bridge.json"), "utf8"));
const fails = [];
for (const f of M.files ?? []) {
  const p = join(DIR, f.name);
  if (!existsSync(p)) { fails.push(`${f.name} が無い`); continue; }
  const st = statSync(p);
  if (f.size && st.size !== f.size) fails.push(`${f.name} の大きさが違う（目録 ${f.size}・実物 ${st.size}）`);
  const sha = createHash("sha256").update(readFileSync(p)).digest("hex");
  if (f.sha256 && sha !== f.sha256) fails.push(`${f.name} の sha256 が目録と違う`);
}
if (!M.version || !(M.files ?? []).length) fails.push("目録に version か files が無い");
if (fails.length) { for (const x of fails) console.error("  ★", x); console.error(`FAIL — 配布物の目録 ${fails.length} 件`); process.exit(1); }
console.log(`[bridge-release] OK（${M.version}・${M.files.length} 件・sha256 一致）`);
