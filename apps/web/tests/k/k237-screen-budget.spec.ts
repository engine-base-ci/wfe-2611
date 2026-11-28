// K-237「速さの検査：画面ごとの口の数と直列の段」の画面の試験（実 Chrome・口は網の手前で差し替え・tests/k/list-mock.ts を読むだけで使う）。
//   行 ID（K237-UI-…）は 11_tickets/K-237.md の表と 1 対 1。上限と呼んでよい口は台帳 scripts/ci/perf_budget.json の screens
//   （台帳の形と緩めないことは scripts/ci/k237_perf_ledger_test.py が見る）。
//   段の数え方：口の答えを全部止めた間に出た要求が 1 段目。目印の口（台帳の marks）が全部出たのを見てから止めを外し、
//   外した後に出た要求を 2 段目以降と数える（外した後は本文の出来上がりが見えて網が静かになってから数える）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { idOf, mockList, open } from "./list-mock";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
interface ScreenBudget {
  path: string;
  marks: string[];
  calls: string[];
  max_calls: number;
  max_stages: number;
}
const LEDGER = JSON.parse(readFileSync(join(ROOT, "scripts/ci/perf_budget.json"), "utf8")) as {
  screens: ScreenBudget[];
};
const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const TICKET = idOf(7);
const real = (p: string) => p.replace(":id", TICKET);
const bare = (k: string) => k.split("?")[0]!;

/** 画面ごとの本文の出来上がり（list-mock の答えで描く所）。台帳に後から足した画面は、帯の h1 が出たら出来上がりと見る */
function readyOf(page: Page, path: string): Locator {
  if (path === "/tickets")
    return page.getByRole("table", { name: "チケットの一覧" }).locator("tbody tr[data-ticket]").first();
  if (path === "/tickets?new=1") return page.locator("header.k-page-head h1", { hasText: "チケットを作る" });
  if (path === "/tickets/:id") return page.locator("header.k-page-head h1", { hasText: "チケット 7" });
  if (path === "/approvals") return page.locator("header.k-page-head h1", { hasText: "承認待ち" });
  return page.locator("header.k-page-head h1").first();
}
interface Load {
  before: string[];
  after: string[];
}
async function measure(page: Page, s: ScreenBudget): Promise<Load> {
  await mockList(page);
  const st = { held: true };
  const before: string[] = [];
  const after: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(API_RE, async (route, req) => {
    if (req.method() === "OPTIONS") return route.fallback();
    const u = new URL(req.url());
    (st.held ? before : after).push(`${req.method()} ${u.pathname}${u.search}`);
    if (st.held) await gate;
    return route.fallback();
  });
  await open(page, real(s.path));
  const marks = s.marks.map(real);
  await expect.poll(() => marks.filter((m) => !before.some((k) => bare(k) === m)), { timeout: 30_000 }).toEqual([]);
  st.held = false;
  release();
  // 本文の出来上がり（答えを使って描いた所）が見えてから、網が静かになるのを待って数える
  await expect(readyOf(page, s.path)).toBeVisible();
  await page.waitForLoadState("networkidle");
  return { before, after };
}

test("K237-UI-001 台帳の画面ごと：止めた間に目印の口が出る・止めを外した後に出た口 0（段 1）・口の数が上限以下・同じ口 2 回 0", async ({
  page,
}) => {
  expect(LEDGER.screens.length).toBeGreaterThan(0);
  const over: string[] = [];
  for (const s of LEDGER.screens) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const l = await measure(page, s);
    const all = [...l.before, ...l.after];
    const dups = all.filter((k, i) => all.indexOf(k) !== i);
    // 段の上限は 1（台帳の形の試験が max_stages = 1 を見る）：止めを外した後に出た口が 1 本でもあれば 2 段目
    if (l.after.length > 0 || all.length > s.max_calls || dups.length)
      over.push(
        `${s.path}：口 ${all.length}（上限 ${s.max_calls}）・後の段 ${l.after.join(", ") || "なし"}・二重 ${dups.join(", ") || "なし"}`,
      );
  }
  expect(over, over.join("\n")).toEqual([]);
});

test("K237-UI-002 台帳の画面ごと：呼んだ口の道は全部、台帳の calls にある（台帳に無い口を足したら赤）", async ({
  page,
}) => {
  const extra: string[] = [];
  for (const s of LEDGER.screens) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const l = await measure(page, s);
    const allowed = new Set(s.calls.map((c) => bare(real(c))));
    for (const k of [...l.before, ...l.after]) {
      const p = bare(k.split(" ")[1]!);
      if (!allowed.has(p)) extra.push(`${s.path}：${p}`);
    }
  }
  expect(extra, extra.join("\n")).toEqual([]);
});
