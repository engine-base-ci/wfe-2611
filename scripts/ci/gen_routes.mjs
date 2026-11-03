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
// 指定が無い・無い・見えない のときの行き先（D-086）。画面ではなく規則なので screens には入らない
const fb = nav.fallbacks;
const routeOf = (id) => flow.screens.find((s) => s.id === id)?.route ?? "/" + id;
const fallbacks = {
  entry: {
    anonymous: routeOf(fb.entry.anonymous),
    // PC をつなぐ前でも使える（D-127.8）。flow に「PC が無いとき」の行き先が無ければ、ふだんの入口と同じ
    noBridge: routeOf((fb.entry.signed_in.find((x) => x.when === "no_bridge") ?? fb.entry.signed_in.find((x) => x.when === "default")).screen),
    signedIn: routeOf(fb.entry.signed_in.find((x) => x.when === "default").screen),
  },
  notFound: { title: fb.not_found.title },
  forbidden: { title: fb.forbidden.title, back: routeOf(fb.forbidden.back.signed_in) },
};
const navHash = createHash("sha256").update(JSON.stringify({ navData, fallbacks })).digest("hex").slice(0, 16);
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

/** 指定が無い・無い・見えない のときの行き先（D-086・flow.json navigation.fallbacks） */
export const FALLBACKS = ${JSON.stringify(fallbacks, null, 2)} as const;
`;
// 生成物と flow のずれ（画面ごと・ナビの項目ごと）。本物の画面ができるまでは前の生成物を残すので、
// ずれを scripts/ci/ui_baseline.json に記録し、記録に無いずれが出たら赤にする（D-128.117・緑にするのは KN-37）
const BASE = process.env.UI_BASELINE ?? "scripts/ci/ui_baseline.json";
const grab = (text, start, end) => {
  const i = text.indexOf(start);
  if (i < 0) return null;
  const j = text.indexOf(end, i + start.length);
  try {
    return JSON.parse(text.slice(i + start.length, j < 0 ? undefined : j));
  } catch {
    return null;
  }
};
const h8 = (v) => createHash("sha256").update(JSON.stringify(v ?? null)).digest("hex").slice(0, 8);
// ずれの印は「どこが」＋「flow 側の値」。記録したあとで flow 側を変えたら、別の印になって赤になる
const drift = (cur, curNav) => {
  const out = [];
  const oldRows = grab(cur, "export const ROUTES: readonly RouteDef[] = ", ";\n") ?? [];
  const key = (r) => JSON.stringify(r);
  const oldSet = new Set(oldRows.map(key));
  const newSet = new Set(rows.map(key));
  for (const r of rows) if (!oldSet.has(key(r))) out.push(`route:${r.id}@${h8(r)}`);
  for (const r of oldRows) if (!newSet.has(key(r)) && !rows.some((x) => x.id === r.id)) out.push(`route:${r.id}（flow に無い）`);
  const oldNav = grab(curNav, "export const NAV: NavData = ", ";\n\n/**") ?? {};
  const oldFb = grab(curNav, "export const FALLBACKS = ", " as const;") ?? {};
  for (const k of Object.keys(navData)) {
    if (k === "screens") {
      const o = oldNav.screens ?? {};
      for (const id of new Set([...Object.keys(navData.screens), ...Object.keys(o)]))
        if (JSON.stringify(navData.screens[id]) !== JSON.stringify(o[id])) out.push(`nav.screens:${id}@${h8(navData.screens[id])}`);
    } else if (JSON.stringify(navData[k]) !== JSON.stringify(oldNav[k])) out.push(`nav:${k}@${h8(navData[k])}`);
  }
  for (const k of new Set([...Object.keys(fallbacks), ...Object.keys(oldFb)]))
    if (JSON.stringify(fallbacks[k]) !== JSON.stringify(oldFb[k])) out.push(`fallbacks:${k}@${h8(fallbacks[k])}`);
  return [...new Set(out)].sort();
};
if (process.argv[2] === "check" || process.argv[2] === "record") {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  const curNav = existsSync(NAV_OUT) ? readFileSync(NAV_OUT, "utf8") : "";
  const fresh = cur.includes(`flow:${hash}`) && curNav.includes(`flow:${navHash}`);
  const d = fresh ? [] : drift(cur, curNav);
  const base = existsSync(BASE) ? JSON.parse(readFileSync(BASE, "utf8")) : {};
  if (process.argv[2] === "record") {
    base.routes = { ticket: "KN-37", reason: "本物の画面ができるまで前の生成物を残す（D-128.117）", drift: d };
    writeFileSync(BASE, JSON.stringify(base, null, 1) + "\n");
    console.log(`[routes] ずれ ${d.length} を記録した（${BASE}）`);
    process.exit(0);
  }
  if (fresh) {
    console.log(`[routes] 最新（${rows.length} route）`);
    process.exit(0);
  }
  const known = new Set(base.routes?.drift ?? []);
  const added = d.filter((x) => !known.has(x));
  const gone = [...known].filter((x) => !d.includes(x));
  if (added.length) {
    console.error(`[routes] 記録に無いずれ ${added.length}：${added.slice(0, 8).join("、")}`);
    console.error("  flow を直したら生成し直す（node scripts/ci/gen_routes.mjs）。前の画面を残すために生成できないなら、理由を決めて record する");
    process.exit(1);
  }
  console.log(`[routes] 前の生成物を残している：ずれ ${d.length}（記録どおり・緑にするのは ${base.routes?.ticket ?? "KN-37"}）` + (gone.length ? `。直ったずれ ${gone.length} → record で記録を下げる` : ""));
  process.exit(0);
}
writeFileSync(OUT, body);
writeFileSync(NAV_OUT, navBody);
console.log(`[routes] ${OUT}: ${rows.length} route / ${NAV_OUT}: ${navData.sections.length} sections・${Object.keys(navData.screens).length} screens`);
