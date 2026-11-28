// 検査の検査（L-019）：何も無ければ緑・よその宛先への fetch を置くと赤・片付けると緑
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkNetBoundary } from "./net_boundary.mjs";

const root = mkdtempSync(join(tmpdir(), "kaname-net-"));
mkdirSync(join(root, "apps/bridge/src"), { recursive: true });
mkdirSync(join(root, "apps/web/lib"), { recursive: true });
const scopes = [
  { dir: "apps/bridge/src", bases: ["d.apiBase", "API_BASE"], allow: { "apps/bridge/src/update.ts": ["u.url"] } },
  { dir: "apps/web/lib", bases: ["apiBase()", "LOCAL"], allow: {} },
];
// 緑：基点から始まる・許した変数
writeFileSync(join(root, "apps/bridge/src/ok.ts"), "export const f = (d: { apiBase: string }) => fetch(`${d.apiBase}/api/x`);\nexport const g = () => fetch(API_BASE + '/health');\n");
writeFileSync(join(root, "apps/bridge/src/update.ts"), "export const h = (u: { url: string }) => fetch(u.url);\n");
writeFileSync(join(root, "apps/web/lib/ok.ts"), "export const w = () => fetch(`${apiBase()}/api/y`);\nexport const l = () => fetch(`${LOCAL}/ping`);\n");
const green = checkNetBoundary(root, scopes);
// 赤：よその宛先・文字どおりの URL・許していない変数
writeFileSync(join(root, "apps/bridge/src/bad.ts"), 'export const a = () => fetch("https://evil.example/x");\nexport const b = (x: string) => fetch(x);\nexport const c = () => fetch(`https://${host}/y`);\n');
writeFileSync(join(root, "apps/web/lib/bad.ts"), "export const z = (u: { url: string }) => fetch(u.url);\n");
const red = checkNetBoundary(root, scopes);
rmSync(join(root, "apps/bridge/src/bad.ts"));
rmSync(join(root, "apps/web/lib/bad.ts"));
const again = checkNetBoundary(root, scopes);
const ok = green.violations.length === 0 && green.seen === 5 && red.violations.length === 4 && again.violations.length === 0;
console.log(ok ? "[net_boundary self-test] OK（何も無ければ緑・迂回 4 を検出・片付けると緑）" : `[net_boundary self-test] NG ${JSON.stringify({ green, red, again })}`);
process.exit(ok ? 0 : 1);
