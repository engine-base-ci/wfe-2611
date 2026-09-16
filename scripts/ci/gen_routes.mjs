// flow.json の screens[].route → apps/web/lib/routes.ts（画面の URL の正本は flow。手で書かない：規約 screen-derivation G22）
//   node scripts/ci/gen_routes.mjs        生成
//   node scripts/ci/gen_routes.mjs check  最新か（hash）
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FLOW = process.env.FLOW ?? "05_flow/flow.json";
const OUT = process.env.OUT ?? "apps/web/lib/routes.ts";
const NAV_OUT = process.env.NAV_OUT ?? "apps/web/lib/nav.ts";
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
// ナビ（主ナビ 6 本・役割ごとの本数・第2ナビ・画面の型・時点の caps）も flow から。画面ごとに手で書かない（screen-derivation §6）
const nav = flow.navigation;
const navData = {
  sections: nav.sections.map((x) => ({ key: x.key, label: x.label, icon: x.icon, screens: x.screens })),
  sectionsByRole: nav.sections_by_role,
  byRole: nav.by_role,
  subByScreen: Object.fromEntries(Object.entries(nav.sub_by_screen).map(([k, v]) => [k, v.map((i) => ({ label: i.label, desc: i.desc ?? "", ...(i.group ? { group: i.group } : {}), ...(i.state ? { state: i.state } : {}) }))])),
  layoutByScreen: nav.layout?.by_screen ?? {},
  subModeByScreen: nav.sub_mode?.by_screen ?? {},
  mainMinPx: nav.main_width?.min_px ?? 720,
  productStates: (flow.product_states ?? []).map((p) => ({ id: p.id, name: p.name, caps: p.caps ?? [] })),
  screens: Object.fromEntries(flow.screens.map((s) => [s.id, { id: s.id, name: s.name, route: s.route, needsLogin: s.needs_login !== false, hasShell: s.has_shell !== false, roles: s.roles ?? [], purpose: s.purpose ?? "", primaryAction: s.primary_action ?? "", release: s.release ?? "v1" }])),
  roles: flow.roles.map((r) => ({ id: r.id, name: r.name })),
};
const navHash = createHash("sha256").update(JSON.stringify(navData)).digest("hex").slice(0, 16);
const navBody = `// 生成物（scripts/ci/gen_routes.mjs ← ${FLOW} navigation／screens／product_states）。手で直さない。flow:${navHash}
export interface NavSection { key: string; label: string; icon: string; screens: string[] }
export interface SubItem { label: string; desc: string; group?: string; state?: string }
export interface ScreenMeta { id: string; name: string; route: string; needsLogin: boolean; hasShell: boolean; roles: string[]; purpose: string; primaryAction: string; release: string }
export interface ProductState { id: string; name: string; caps: string[] }
export interface NavData {
  sections: readonly NavSection[]; sectionsByRole: Record<string, readonly string[]>; byRole: Record<string, readonly string[]>;
  subByScreen: Record<string, readonly SubItem[]>; layoutByScreen: Record<string, string>; subModeByScreen: Record<string, string>; mainMinPx: number;
  productStates: readonly ProductState[]; screens: Record<ScreenId, ScreenMeta>; roles: readonly { id: RoleId; name: string }[];
}
export type RoleId = ${navData.roles.map((r) => JSON.stringify(r.id)).join(" | ")};
export type ScreenId = ${Object.keys(navData.screens).map((k) => JSON.stringify(k)).join(" | ")};
export const NAV: NavData = ${JSON.stringify(navData, null, 2)};
`;
if (process.argv[2] === "check") {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  const curNav = existsSync(NAV_OUT) ? readFileSync(NAV_OUT, "utf8") : "";
  const ok = cur.includes(`flow:${hash}`) && curNav.includes(`flow:${navHash}`);
  console.log(ok ? `[routes] 最新（${rows.length} route）` : `[routes] 古い：node scripts/ci/gen_routes.mjs で再生成`);
  process.exit(ok ? 0 : 1);
}
writeFileSync(OUT, body);
writeFileSync(NAV_OUT, navBody);
console.log(`[routes] ${OUT}: ${rows.length} route / ${NAV_OUT}: ${navData.sections.length} sections・${Object.keys(navData.screens).length} screens`);
