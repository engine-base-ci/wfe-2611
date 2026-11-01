// 実ブラウザの検査の土台（T-US-00）。jsdom では出ない層（実レイアウト・ネイティブ検証・ポインタ）を Playwright で測る（L-003）
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { ROUTE_PATTERNS } from "../../lib/routes";

/** 測る幅（規約 web/testing.md：320〜1920 のうち共通シェルが折れる 4 点） */
export const WIDTHS = [375, 768, 1024, 1440] as const;

/** 横溢れを数値で測る（目視では気付けない・G-05）。0 が合格 */
export async function measureOverflow(page: Page, path: string): Promise<{ width: number; overflow: number }[]> {
  const out: { width: number; overflow: number }[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const res = await page.goto(path);
    if (res && res.status() >= 400) throw new Error(`${path} が ${res.status()}（幅 ${width}）`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    out.push({ width, overflow });
  }
  return out;
}

/** apps/web/app にある page.tsx から実在ルートを出す（route group (x) は消す・[id] は :id） */
export function existingPageRoutes(appDir = join(fileURLToPath(import.meta.url), "..", "..", "..", "app")): string[] {
  const routes: string[] = [];
  const walk = (dir: string, segs: string[]) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name.startsWith("(") && name.endsWith(")")) walk(p, segs);
        else walk(p, [...segs, name.replace(/^\[(\w+)\]$/, ":$1")]);
      } else if (/^page\.(tsx|ts|jsx|js)$/.test(name)) routes.push("/" + segs.join("/"));
    }
  };
  walk(appDir, []);
  return routes.map((r) => (r === "/" ? r : r.replace(/\/$/, ""))).sort();
}

/** 画面の内部リンク（同じ origin の a[href]）を集める。外部・mailto・# は除く */
export async function collectInternalHrefs(page: Page): Promise<string[]> {
  const hrefs = await page.$$eval("a[href]", (as) =>
    as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""),
  );
  return [
    ...new Set(hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//")).map((h) => h.split(/[?#]/)[0]!)),
  ].sort();
}

const toPattern = (route: string) => new RegExp("^" + route.replace(/:[A-Za-z_]+/g, "[^/]+") + "$");
/** href のうち、実在ルート（page.tsx）にも flow の route にも無いもの（G-04：押すと 404 になる導線） */
export function hrefViolations(hrefs: readonly string[], existing: readonly string[]): string[] {
  const ok = existing.map(toPattern);
  return hrefs.filter((h) => !ok.some((re) => re.test(h)));
}
/** flow の route（画面の正本）のうち、まだ page.tsx が無いもの（T-U-* の残り。報告用） */
export function unimplementedFlowRoutes(existing: readonly string[]): string[] {
  const ok = existing.map(toPattern);
  return ROUTE_PATTERNS.filter((r) => !ok.some((re) => re.test(r)));
}
