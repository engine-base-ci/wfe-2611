// 契約（OpenAPI）と実装の整合。API ↦ UI の依存方向を固定する（T-F-15／T-A-*）。
//   gen        08_api/openapi.yaml＋endpoints.json → packages/contracts/src/{types,registry,schemas}.ts ＋ apps/api/src/routes/<table>.ts（route の登録だけ・振る舞いは contract/op.ts と hooks）
//   check      G11：生成物が最新か（hash）／main の openapi.yaml と比べて破壊的変更（path・method の削除、必須の追加、レスポンス項目の削除）が無いか
//   endpoints  endpoint 実在性：apps/api/src/routes/*.ts の登録が契約に無い → 赤。契約の endpoint のうち担当（backend 層）が done なのに未登録 → 赤
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const OPENAPI = "08_api/openapi.yaml";
const ENDPOINTS_JSON = "08_api/endpoints.json";
const OUT = "packages/contracts/src";
const ROUTES = "apps/api/src/routes";

/** 最小の YAML 読み（openapi.yaml は build_api.py が固定の形で出す：2 スペース・引用文字列） */
export function parsePaths(yaml) {
  const out = {}; // path → { method: { required, responseFields, operationId, tag, input, success } }
  const lines = yaml.split("\n");
  let i = lines.findIndex((l) => l === "paths:");
  let path = null, method = null, section = null;
  for (i = i + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\S/.test(l)) break;
    let m;
    if ((m = /^  (\/[^:]+):$/.exec(l))) { path = m[1]; out[path] = {}; continue; }
    if ((m = /^    (get|post|put|patch|delete):$/.exec(l))) { method = m[1].toUpperCase(); out[path][method] = { required: [], responseFields: [], operationId: "", tag: "", input: null, success: 200 }; section = null; continue; }
    if (!path || !method) continue;
    const cur = out[path][method];
    if ((m = /^      operationId: (\S+)/.exec(l))) cur.operationId = m[1];
    if (section === "tags" && (m = /^      - (\S+)/.exec(l)) && !cur.tag) cur.tag = m[1];
    if (/^      tags:/.test(l)) section = "tags";
    if (/^      requestBody:/.test(l)) section = "req";
    if (/^      responses:/.test(l)) section = "res";
    if (/^      (parameters|security|x-)/.test(l)) section = null;
    if (section === "req" && (m = /\$ref: '#\/components\/schemas\/(\w+)'/.exec(l))) cur.input = m[1];
    if ((m = /^\s+required: \[(.*)\]/.exec(l)) && section === "req") cur.required.push(...m[1].split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean));
    if ((m = /^\s+- (\w+)$/.exec(l)) && section === "req" && lines[i - 1] && /required:$/.test(lines[i - 1].trim())) cur.required.push(m[1]);
    if (section === "res" && (m = /^        '(2\d\d)':/.exec(l))) cur.success = Number(m[1]);
    if (section === "res" && (m = /^\s{16,}(\w+):$/.exec(l))) cur.responseFields.push(m[1]);
  }
  return out;
}
/** components.schemas → { Name: { props: {name: {type, format}}, required: [], table } }（&id／*id の別名を解く） */
export function parseComponents(yaml) {
  const lines = yaml.split("\n");
  let i = lines.findIndex((l) => l === "components:");
  const out = {}; const anchors = {};
  let name = null, prop = null, sec = null, propAnchor = null, inSchemas = false;
  for (i = i + 1; i < lines.length; i++) {
    const l = lines[i]; let m;
    if (/^\S/.test(l)) break;
    if (/^  \w+:$/.test(l)) { inSchemas = l === "  schemas:"; name = null; continue; }
    if (!inSchemas) continue;
    if ((m = /^    (\w+):$/.exec(l))) { name = m[1]; out[name] = { props: {}, required: [], table: null }; sec = null; prop = null; continue; }
    if (!name) continue;
    if (/^      properties:/.test(l)) { sec = "props"; continue; }
    if (/^      required:/.test(l)) { sec = "req"; continue; }
    if ((m = /^      x-table: (\S+)/.exec(l))) { out[name].table = m[1]; continue; }
    if (sec === "req" && (m = /^      - (\w+)/.exec(l))) { out[name].required.push(m[1]); continue; }
    if (sec === "props" && (m = /^        (\w+):(?: &(\w+))?$/.exec(l))) { prop = m[1]; propAnchor = m[2] ?? null; out[name].props[prop] = {}; if (propAnchor) anchors[propAnchor] = out[name].props[prop]; continue; }
    if (sec === "props" && (m = /^        (\w+): \*(\w+)$/.exec(l))) { out[name].props[m[1]] = anchors[m[2]] ?? {}; prop = null; continue; }
    if (sec === "props" && prop && (m = /^          (type|format): (\S+)/.exec(l))) { out[name].props[prop][m[1]] = m[2]; continue; }
    if (sec === "props" && prop && (m = /^            type: (\S+)/.exec(l))) { out[name].props[prop].items = m[1]; continue; }
  }
  return out;
}
const hashOf = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const slug = (s) => s.replace(/^\/api\/v1\//, "").replace(/[{}:]/g, "").replace(/[^a-z0-9]+/gi, "_").replace(/_+$/, "");
const kindOf = (method, path) => (method === "GET" ? (path.includes("{") ? "get" : "list") : method === "POST" ? "create" : method === "DELETE" ? "delete" : "update");

function zodOf(p) {
  if (p.type === "string" && p.format === "uuid") return "z.uuid()";
  if (p.type === "string" && p.format === "date-time") return "z.iso.datetime({ offset: true })";
  if (p.type === "string" && p.format === "date") return "z.iso.date()";
  if (p.type === "string") return "z.string().max(10000)";
  if (p.type === "integer") return "z.number().int()";
  if (p.type === "number") return "z.number()";
  if (p.type === "boolean") return "z.boolean()";
  if (p.type === "array") return p.items === "string" ? "z.array(z.string())" : "z.array(z.unknown())";
  if (p.type === "object") return "z.record(z.string(), z.unknown())";
  return "z.unknown()";
}

export function gen(root = ROOT) {
  const yaml = readFileSync(join(root, OPENAPI), "utf8");
  const epJson = readFileSync(join(root, ENDPOINTS_JSON), "utf8");
  const h = hashOf(yaml + epJson);
  const types = readFileSync(join(root, "08_api/types.ts"), "utf8");
  mkdirSync(join(root, OUT), { recursive: true });
  writeFileSync(join(root, OUT, "types.ts"), `// 生成物（scripts/ci/contract.mjs gen ← 08_api/types.ts ← openapi.yaml）。手で直さない。openapi:${h}\n` + types.replace(/^\/\/.*\n/, ""));
  const paths = parsePaths(yaml);
  const meta = new Map(JSON.parse(epJson).endpoints.map((e) => [`${e.method} ${e.path}`, e]));
  const eps = [];
  for (const [p, ms] of Object.entries(paths)) for (const [m, d] of Object.entries(ms)) {
    const hono = p.replace(/\{(\w+)\}/g, ":$1");
    const e = meta.get(`${m} ${hono}`) ?? {};
    const rl = /^(\d+)\/min\/(user|ip)$/.exec(e.rate_limit ?? "60/min/user");
    eps.push({
      method: m, path: hono, operationId: d.operationId, table: d.tag || slug(p).split("_")[0], kind: kindOf(m, p), input: d.input, success: d.success,
      auth: e.auth?.role ?? "member", rateLimit: { perMinute: Number(rl?.[1] ?? 60), key: rl?.[2] ?? "user" },
      chokePoints: e.choke_points ?? [], errors: (e.outputs_4xx ?? []).map((x) => x.status), acts: e.acts ?? [], screens: e.screens ?? [],
    });
  }
  const body = `// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml＋endpoints.json）。手で直さない。openapi:${h}
export type EndpointKind = "list" | "get" | "create" | "update" | "delete";
export interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  operationId: string;
  table: string;
  kind: EndpointKind;
  input: string | null;
  success: number;
  auth: "member" | "ops" | "public";
  rateLimit: { perMinute: number; key: "user" | "ip" };
  chokePoints: string[];
  errors: number[];
  acts: string[];
  screens: string[];
}
export const ENDPOINTS: readonly EndpointDef[] = ${JSON.stringify(eps, null, 2)};
export const OPENAPI_HASH = "${h}";
`;
  writeFileSync(join(root, OUT, "registry.ts"), body);
  // zod（入力の検証・表記ゆらぎの正規化は apps/api/src/contract/op.ts）
  const comps = parseComponents(yaml);
  const zl = [`// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml components）。手で直さない。openapi:${h}`, `import { z } from "zod";`, ""];
  for (const [name, c] of Object.entries(comps)) {
    if (name === "Error") continue;
    const props = Object.entries(c.props).map(([k, p]) => `  ${k}: ${zodOf(p)}${c.required.includes(k) ? "" : ".optional()"},`);
    zl.push(`export const ${name} = z.strictObject({\n${props.join("\n")}\n});`);
  }
  zl.push("", `export const SCHEMAS: Record<string, z.ZodType> = { ${Object.keys(comps).filter((n) => n !== "Error").join(", ")} };`, "");
  writeFileSync(join(root, OUT, "schemas.ts"), zl.join("\n"));
  // routes（登録だけ。振る舞いは contract/op.ts・個別は hooks）
  mkdirSync(join(root, ROUTES), { recursive: true });
  const byTable = new Map();
  for (const e of eps) byTable.set(e.table, [...(byTable.get(e.table) ?? []), e]);
  for (const [t, list] of byTable) {
    const lines = [
      `// 生成物（scripts/ci/contract.mjs gen ← openapi.yaml）。手で直さない。個別の振る舞いは apps/api/src/hooks/<operationId>.ts に書く（op が呼ぶ）`,
      `import type { Hono } from "hono";`, `import type { Vars } from "../middleware/tenant.js";`, `import { op, type ContractDeps } from "../contract/op.js";`, "",
      `export function register(app: Hono<Vars>, deps: ContractDeps): void {`,
      ...list.map((e) => `  app.${e.method.toLowerCase()}("${e.path}", op(deps, "${e.operationId}"));`),
      `}`, "",
    ];
    writeFileSync(join(root, ROUTES, `${t}.ts`), lines.join("\n"));
  }
  const idx = [`// 生成物（scripts/ci/contract.mjs gen）。手で直さない`, `import type { Hono } from "hono";`, `import type { Vars } from "../middleware/tenant.js";`, `import type { ContractDeps } from "../contract/op.js";`,
    ...[...byTable.keys()].map((t) => `import { register as ${t} } from "./${t}.js";`), "",
    `export function registerAll(app: Hono<Vars>, deps: ContractDeps): void {`, ...[...byTable.keys()].map((t) => `  ${t}(app, deps);`), `}`, ""];
  writeFileSync(join(root, ROUTES, "index.ts"), idx.join("\n"));
  return { hash: h, endpoints: eps.length, tables: byTable.size, schemas: Object.keys(comps).length - 1 };
}
export function check(root = ROOT, base = "main") {
  const yaml = readFileSync(join(root, OPENAPI), "utf8");
  const epJson = existsSync(join(root, ENDPOINTS_JSON)) ? readFileSync(join(root, ENDPOINTS_JSON), "utf8") : "";
  const h = hashOf(yaml + epJson);
  const bad = [];
  for (const f of ["types.ts", "registry.ts", "schemas.ts"]) {
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
  const inContract = new Set(); for (const [p, ms] of Object.entries(contract)) for (const m of Object.keys(ms)) inContract.add(`${m} ${p.replace(/\{(\w+)\}/g, ":$1")}`);
  const routesDir = join(root, ROUTES);
  const registered = new Set();
  if (existsSync(routesDir)) for (const f of readdirSync(routesDir).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
    const s = readFileSync(join(routesDir, f), "utf8");
    for (const m of s.matchAll(/\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)) registered.add(`${m[1].toUpperCase()} ${m[2]}`);
  }
  const extra = [...registered].filter((r) => !inContract.has(r));
  const feats = JSON.parse(readFileSync(join(root, "09_features/features.json"), "utf8")).items;
  const eps = JSON.parse(readFileSync(join(root, ENDPOINTS_JSON), "utf8")); const epList = eps.endpoints ?? eps.items;
  const tasks = JSON.parse(readFileSync(join(root, "07_tasks/tickets.json"), "utf8")).tasks;
  const doneFeatures = new Set(tasks.filter((t) => t.status === "done" && t.deliverable_layer === "backend").flatMap((t) => t.feature_ids ?? [])); // endpoint の担当は backend 層のタスク
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
  if (cmd === "gen") { const r = gen(); console.log(`[contract gen] endpoints ${r.endpoints}・routes ${r.tables} 表・schemas ${r.schemas}・openapi:${r.hash} → ${OUT}／${ROUTES}`); process.exit(0); }
  if (cmd === "check") { const r = check(undefined, process.argv[3] ?? "main"); console.log(r.bad.length ? `[G11 openapi-diff] NG（比較元 ${r.base}）:\n  ${r.bad.join("\n  ")}` : `[G11 openapi-diff] OK（openapi:${r.hash}・比較元 ${r.base}・破壊的変更なし・生成物は最新）`); process.exit(r.bad.length ? 1 : 0); }
  if (cmd === "endpoints") { const r = endpoints(); const bad = [...r.extra.map((x) => `契約に無い登録: ${x}`), ...r.missingDone]; console.log(bad.length ? `[endpoint 実在性] NG:\n  ${bad.join("\n  ")}` : `[endpoint 実在性] OK（契約 ${r.contract}・登録 ${r.registered}・done なのに未登録 0）`); process.exit(bad.length ? 1 : 0); }
  console.error("usage: contract.mjs gen | check [base] | endpoints"); process.exit(1);
}
