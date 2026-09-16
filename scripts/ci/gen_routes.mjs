// flow.json の screens[].route → apps/web/lib/routes.ts（画面の URL の正本は flow。手で書かない：規約 screen-derivation G22）
//   node scripts/ci/gen_routes.mjs        生成
//   node scripts/ci/gen_routes.mjs check  最新か（hash）
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FLOW = process.env.FLOW ?? "05_flow/flow.json";
const OUT = process.env.OUT ?? "apps/web/lib/routes.ts";
const flow = JSON.parse(readFileSync(FLOW, "utf8"));
const rows = flow.screens
  .filter((s) => s.route)
  .map((s) => ({ id: s.id, route: s.route, needsLogin: s.needs_login !== false, release: s.release ?? "v1" }))
  .sort((a, b) => a.route.localeCompare(b.route));
const hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16);
const body = `// 生成物（scripts/ci/gen_routes.mjs ← ${FLOW}）。手で直さない。flow:${hash}
export interface RouteDef {
  id: string;
  route: string;
  needsLogin: boolean;
  release: string;
}
export const ROUTES: readonly RouteDef[] = ${JSON.stringify(rows, null, 2)};
/** ナビ・カード・ボタンの href が指してよい URL（flow の route ＋ 入口 /）。:id は実値に置き換わる */
export const ROUTE_PATTERNS: readonly string[] = ["/", ...ROUTES.map((r) => r.route)];
`;
if (process.argv[2] === "check") {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  const ok = cur.includes(`flow:${hash}`);
  console.log(ok ? `[routes] 最新（${rows.length} route）` : `[routes] 古い：node scripts/ci/gen_routes.mjs で再生成`);
  process.exit(ok ? 0 : 1);
}
writeFileSync(OUT, body);
console.log(`[routes] ${OUT}: ${rows.length} route`);
