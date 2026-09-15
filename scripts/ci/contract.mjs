// 契約（OpenAPI）と実装の整合。API ↦ UI の依存方向を固定する（T-F-15）。
//   gen        08_api/openapi.yaml → packages/contracts/src/{types.ts,registry.ts}（openapi の hash を刻む）
//   check      G11：生成物が最新か（hash）／main の openapi.yaml と比べて破壊的変更（path・method の削除、必須の追加、レスポンス項目の削除）が無いか
//   endpoints  endpoint 実在性：apps/api/src/routes/*.ts の登録（router.<method>("<path>")）が契約に無い → 赤。契約の endpoint のうち担当タスクが done なのに未登録 → 赤
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OPENAPI = "08_api/openapi.yaml";
const OUT = "packages/contracts/src";

/** 最小の YAML 読み（openapi.yaml は build_api.py が固定の形で出す：2 スペース・引用文字列） */
function parsePaths(yaml) {
  const out = {}; // path → { method: { required: [...], responseFields: [...] } }
  const lines = yaml.split("\n");
  let i = lines.findIndex((l) => l === "paths:");
  let path = null, method = null, section = null;
  for (i = i + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\S/.test(l)) break;
    let m;
    if ((m = /^  (\/[^:]+):$/.exec(l))) { path = m[1]; out[path] = {}; continue; }
    if ((m = /^    (get|post|put|patch|delete):$/.exec(l))) { method = m[1].toUpperCase(); out[path][method] = { required: [], responseFields: [], operationId: "" }; section = null; continue; }
    if (!path || !method) continue;
    if ((m = /^      operationId: (\S+)/.exec(l))) out[path][method].operationId = m[1];
    if (/^      requestBody:/.test(l)) section = "req";
    if (/^      responses:/.test(l)) section = "res";
    if ((m = /^\s+required: \[(.*)\]/.exec(l)) && section === "req") out[path][method].required.push(...m[1].split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean));
    if ((m = /^\s+- (\w+)$/.exec(l)) && section === "req" && lines[i - 1] && /required:$/.test(lines[i - 1].trim())) out[path][method].required.push(m[1]);
    if (section === "res" && (m = /^\s{16,}(\w+):$/.exec(l))) out[path][method].responseFields.push(m[1]);
  }
  return out;
}
const hashOf = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

export function gen(root = ROOT) {
  const yaml = readFileSync(join(root, OPENAPI), "utf8");
  const h = hashOf(yaml);
  const types = readFileSync(join(root, "08_api/types.ts"), "utf8");
  mkdirSync(join(root, OUT), { recursive: true });
  writeFileSync(join(root, OUT, "types.ts"), `// 生成物（scripts/ci/contract.mjs gen ← 08_api/types.ts ← openapi.yaml）。手で直さない。openapi:${h}\n` + types.replace(/^\/\/.*\n/, ""));
  const paths = parsePaths(yaml);
  const eps = [];
  for (const [p, ms] of Object.entries(paths)) for (const [m, d] of Object.entries(ms)) eps.push({ method: m, path: p, operationId: d.operationId });
  const body = `// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。openapi:${h}\nexport interface EndpointDef {\n  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";\n  path: string;\n  operationId: string;\n}\nexport const ENDPOINTS: readonly EndpointDef[] = ${JSON.stringify(eps, null, 2)} as const;\nexport const OPENAPI_HASH = "${h}";\n`;
  writeFileSync(join(root, OUT, "registry.ts"), body);
  return { hash: h, endpoints: eps.length };
}
export function check(root = ROOT, base = "main") {
  const yaml = readFileSync(join(root, OPENAPI), "utf8");
  const h = hashOf(yaml);
  const bad = [];
  for (const f of ["types.ts", "registry.ts"]) {
    const p = join(root, OUT, f);
    if (!existsSync(p) || !readFileSync(p, "utf8").includes(`openapi:${h}`)) bad.push(`${OUT}/${f} が openapi.yaml と合っていない（pnpm ci:contract:gen）`);
  }
  let prev = "";
  try { prev = execSync(`git show ${base}:${OPENAPI}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { prev = ""; }
  if (prev) {
    const a = parsePaths(prev), b = parsePaths(yaml);
    for (const [p, ms] of Object.entries(a)) {
      if (!b[p]) { bad.push(`破壊的変更: ${p} が消えた`); continue; }
      for (const [m, d] of Object.entries(ms)) {
        const n = b[p][m];
        if (!n) { bad.push(`破壊的変更: ${m} ${p} が消えた`); continue; }
        for (const r of n.required) if (!d.required.includes(r)) bad.push(`破壊的変更: ${m} ${p} に必須の入力 ${r} が増えた`);
        for (const f of d.responseFields) if (!n.responseFields.includes(f)) bad.push(`破壊的変更: ${m} ${p} の応答から ${f} が消えた`);
      }
    }
  }
  return { hash: h, base: prev ? base : "(比較元なし)", bad };
}
export function endpoints(root = ROOT) {
  const contract = parsePaths(readFileSync(join(root, OPENAPI), "utf8"));
  const inContract = new Set(); for (const [p, ms] of Object.entries(contract)) for (const m of Object.keys(ms)) inContract.add(`${m} ${p}`);
  const routesDir = join(root, "apps/api/src/routes");
  const registered = new Set();
  if (existsSync(routesDir)) for (const f of readdirSync(routesDir).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
    const s = readFileSync(join(routesDir, f), "utf8");
    for (const m of s.matchAll(/\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)) registered.add(`${m[1].toUpperCase()} ${m[2]}`);
  }
  const extra = [...registered].filter((r) => !inContract.has(r));
  // 契約の endpoint → 機能 → タスク。done なのに未登録は赤
  const feats = JSON.parse(readFileSync(join(root, "09_features/features.json"), "utf8")).items;
  const eps = JSON.parse(readFileSync(join(root, "08_api/endpoints.json"), "utf8")); const epList = eps.endpoints ?? eps.items;
  const tasks = JSON.parse(readFileSync(join(root, "07_tasks/tickets.json"), "utf8")).tasks;
  const doneFeatures = new Set(tasks.filter((t) => t.status === "done" && t.deliverable_layer === "backend").flatMap((t) => t.feature_ids ?? [])); // endpoint の担当は backend 層のタスク（基盤は同じ機能を共有するだけ）
  const missingDone = [];
  for (const f of feats) if (doneFeatures.has(f.id)) for (const eid of f.api_endpoints ?? []) {
    const e = epList.find((x) => x.id === eid); if (!e) continue;
    const key = `${e.method} ${e.path}`;
    if (!registered.has(key)) missingDone.push(`${key}（${f.id} は done なのに未登録）`);
  }
  return { contract: inContract.size, registered: registered.size, extra, missingDone };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2];
  if (cmd === "gen") { const r = gen(); console.log(`[contract gen] endpoints ${r.endpoints}・openapi:${r.hash} → ${OUT}`); process.exit(0); }
  if (cmd === "check") { const r = check(undefined, process.argv[3] ?? "main"); console.log(r.bad.length ? `[G11 openapi-diff] NG（比較元 ${r.base}）:\n  ${r.bad.join("\n  ")}` : `[G11 openapi-diff] OK（openapi:${r.hash}・比較元 ${r.base}・破壊的変更なし・生成物は最新）`); process.exit(r.bad.length ? 1 : 0); }
  if (cmd === "endpoints") { const r = endpoints(); const bad = [...r.extra.map((x) => `契約に無い登録: ${x}`), ...r.missingDone]; console.log(bad.length ? `[endpoint 実在性] NG:\n  ${bad.join("\n  ")}` : `[endpoint 実在性] OK（契約 ${r.contract}・登録 ${r.registered}・done なのに未登録 0）`); process.exit(bad.length ? 1 : 0); }
  console.error("usage: contract.mjs gen | check [base] | endpoints"); process.exit(1);
}
