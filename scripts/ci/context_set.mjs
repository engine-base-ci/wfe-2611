// G6 テナント文脈の網羅（静的）：packages/api の routes が DB に触る道は c.get("repo") だけ。pg／Pool／withTenant の直接使用と、/api 配下の app.use(tenantContext) の有無を見る。
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
const API = "apps/api/src"; // 設計書の配置：apps/api（Hono）。関門は packages/*
const bad = [];
function walk(d) {
  if (!existsSync(d)) return [];
  return readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
}
const app = readFileSync(join(API, "app.ts"), "utf8");
if (!/tenantContext\(/.test(app) || !/app\.use\("\/api\/\*"/.test(app)) bad.push("app.ts: /api/* に tenantContext が掛かっていない");
for (const f of walk(join(API, "routes")).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
  const s = readFileSync(f, "utf8");
  if (/from ["']pg["']|from ["']postgres["']|withTenant\(|new Pool\(|\.query\(/.test(s)) bad.push(`${f}: 関門の外で DB に触っている（pg／withTenant／.query）`);
  if (!/c\.get\("repo"\)/.test(s) && /\/api\//.test(s)) bad.push(`${f}: /api の route が c.get("repo") を使っていない`);
}
const routes = walk(join(API, "routes")).length;
if (bad.length) {
  console.error(`[G6] テナント文脈の網羅 NG:\n  ${bad.join("\n  ")}`);
  process.exit(1);
}
console.log(`[G6] テナント文脈の網羅 OK（routes ${routes} ファイル・/api/* は tenantContext の中）`);
