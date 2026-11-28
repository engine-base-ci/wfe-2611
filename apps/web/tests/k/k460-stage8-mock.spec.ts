// K-460「段 8 の部品とモック（/dev/mock/f7 の 42 の状態）・正本に足す値・カレンダーの部品の決め・お知らせに押せるボタン（useNotify の action）」の試験
//   （実 Chrome と、ファイル・検査の道具を読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f7（索引）と /dev/mock/f7/<状態>。モックは本番と同じ部品（features/F7/<区画>/views.tsx・components/k・前からの features/F4・F5）を
//   決めた値で並べたもの。後ろの画面の葉（K-466・K-467・K-471・K-478〜K-482・K-484・K-486・K-590）が、このモックを正の絵にして本物の値と動きをつなぐ。
//   見ること：42 の状態が全部描ける・幅 375／768／1440 で横のはみ出し 0・状態の持ち主は画面の葉・部品は見た目だけ・
//   下絵が借りていた値を正本の名前にした（値は見た目が変わらない）・カレンダーの部品の決め・お知らせの「元に戻す」ボタン。
//   差し込み口は外枠と詳細が K-599・一覧が K-600 が持つので、ここでは見ない。決定ログの §151 は K-601 が持つ（試験は scripts/ci/k601_decision_log_test.py）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { isBuilt } from "../../lib/built-routes";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const STATES = join(WEB, "app/(dev)/dev/mock/f7/states");
const F7 = join(WEB, "features/F7");
const DESIGN = join(ROOT, "04_design/DESIGN-kaname.md");
const TOKENS = join(WEB, "styles/k-tokens.css");
const GATE = join(ROOT, "design-gate.json");
const DOC = join(ROOT, "07_functional/段8-F7");

/** 画面の葉と、その葉が本物にするモックの状態（11_tickets/K-460.md の MK-001・切り方.md 2 章。口の葉・試験の葉は持たない） */
const LEAVES: Record<string, readonly string[]> = {
  "K-466": ["f7-shell-badges"],
  "K-467": ["f7-bell-open", "f7-bell-past", "f7-bell-filter", "f7-bell-empty", "f7-bell-failed", "f7-bell-mobile"],
  "K-471": [
    "f7-search-start",
    "f7-search-results",
    "f7-search-empty",
    "f7-search-wait",
    "f7-search-failed",
    "f7-search-mobile",
  ],
  "K-478": [
    "f7-mine",
    "f7-mine-mobile",
    "f7-filter-advanced",
    "f7-view-settings",
    "f7-mine-settings",
    "f7-tidy-marks",
    "f7-tidy-numbers",
    "f7-tidy-stuck-up",
  ],
  "K-479": ["f7-save-dialog", "f7-save-error", "f7-saved-menu"],
  "K-480": ["f7-overview"],
  "K-481": ["f7-calendar", "f7-calendar-day", "f7-view-empty"],
  "K-482": ["f7-gantt", "f7-gantt-move", "f7-gantt-nodate", "f7-hold-view"],
  "K-484": ["f7-tidy-due", "f7-tidy-due-error"],
  "K-486": ["f7-stop-broken", "f7-stop-retry", "f7-stop-takeover", "f7-stop-denied"],
  "K-590": ["f7-delete-confirm", "f7-delete-children", "f7-delete-denied", "f7-delete-undo"],
};
const ALL = Object.values(LEAVES).flat();
const OWNER = new Map(Object.entries(LEAVES).flatMap(([k, ids]) => ids.map((id) => [id, k] as const)));

/** 集め場所 mocks.tsx から、状態の id・持ち主（ticket）・leaf を拾う（1 つの状態は id → screen → label → ticket → leaf の順に並ぶ。ラベルに } は入れない）。
 *  states/*.tsx は 3 つの書き方（辞書の鍵・id:・entry(…)・deleted(…)）が混ざるので持ち主は読まず、中身が在るかの確かめ（statesBodyKeys）にだけ使う */
function mockEntries(): { id: string; ticket: string; leaf: string }[] {
  const src = readFileSync(join(WEB, "app/(dev)/dev/mock/f7/mocks.tsx"), "utf8");
  return [...src.matchAll(/\bid: "(f7-[a-z0-9-]+)",[^}]*?\bticket: "(K-\d+)",\s*leaf: "(K-\d+)"/g)].map((m) => ({
    id: m[1]!,
    ticket: m[2]!,
    leaf: m[3]!,
  }));
}
/** states/*.tsx の全部をつないだ字（状態の中身が在るかを、id の字が文字列として在るかで確かめる） */
const statesText = () =>
  readdirSync(STATES)
    .filter((n) => n.endsWith(".tsx"))
    .map((n) => readFileSync(join(STATES, n), "utf8"))
    .join("\n");
const walk = (dir: string, ext: string[]): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, ext) : ext.some((e) => n.endsWith(e)) ? [p] : [];
  });

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "モックは口を呼ばない" }));
}
async function openState(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/dev/mock/f7/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const runPy = (args: string[]) =>
  execFileSync("python3", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000 });

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K460-MK-001 モックの状態は 42 個で、画面の葉 11 本（K-466 1・K-467 6・K-471 6・K-478 8・K-479 3・K-480 1・K-481 3・K-482 4・K-484 2・K-486 4・K-590 4）が持つ状態の和とちょうど同じ（余りも欠けも重なりも 0）", () => {
  const ids = mockEntries().map((e) => e.id);
  expect(ids.length).toBe(42);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual([...ALL].sort());
  expect(ALL.length).toBe(42);
});

test("K460-MK-002 各状態の持ち主は画面の葉（口の葉・試験の葉を指さない）・leaf の欄と ticket の欄が同じ字・screen は shell か tickets", () => {
  const bad = mockEntries()
    .filter((e) => OWNER.get(e.id) !== e.ticket || e.leaf !== e.ticket)
    .map((e) => `${e.id}：ticket ${e.ticket || "持ち主なし"}・leaf ${e.leaf}（正は ${OWNER.get(e.id) ?? "無い"}）`);
  expect(bad, bad.join("\n")).toEqual([]);
  const text = statesText();
  const missing = ALL.filter((id) => !text.includes(`"${id}"`));
  expect(missing, `states/ に中身が無い状態：${missing.join("・")}`).toEqual([]);
  const types = readFileSync(join(WEB, "app/(dev)/dev/mock/f7/types.ts"), "utf8");
  expect(types).toMatch(/screen: "shell" \| "tickets"/);
  expect(types).toMatch(/\bticket: string/);
  const mocks = readFileSync(join(WEB, "app/(dev)/dev/mock/f7/mocks.tsx"), "utf8");
  for (const area of ["notice", "overview", "saved", "stopped"]) expect(mocks, area).toContain(`./states/${area}`);
  expect(mocks).not.toMatch(/\bK-0\b/);
});

test("K460-MK-003 部品は見た目だけ：features/F7 の .tsx は口を呼ばない（fetch・lib/api・useRouter・lib/auth・useQuery）・生の色や大きさを書かない（style=・#色・px）", () => {
  const files = walk(F7, [".tsx"]).filter((f) => !/-slot\.tsx$/.test(f));
  expect(files.length, "部品のファイルが 30 に満たない").toBeGreaterThanOrEqual(30);
  // 後の葉が口につないだ部品（口を呼んでよい。生の値の決まりはそのまま）：ガントの期限 K-482・お知らせ K-467・保存した条件 K-479・探す K-471
  const LIVE = new Set([
    "gantt/gantt-view.tsx",
    "gantt/set-due-dialog.tsx",
    "notice/notice-live.tsx",
    "saved/save-view-dialog.tsx",
    "search/search-live.tsx",
  ]);
  const bad: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\((?:max|min)-width: \d+px\)/g, ""); // 幅の区切り（@media と同じ・正本の決まりの外）は生の値に数えない
    const live = [...LIVE].some((x) => f.endsWith(`/${x}`));
    if (!live && /\bfetch\(|lib\/api|useRouter|from "@\/lib\/auth|useQuery|useMutation/.test(src))
      bad.push(`${f}：口を呼ぶ`);
    if (/style=\{|#[0-9a-fA-F]{3,6}\b|\b\d+px\b/.test(src)) bad.push(`${f}：生の値`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K460-MK-004 道の一覧：/dev/mock/f7 と /dev/mock/f7/f7-bell-open が作った道", () => {
  expect(isBuilt("/dev/mock/f7")).toBe(true);
  expect(isBuilt("/dev/mock/f7/f7-bell-open")).toBe(true);
});

test("K460-MK-005 ガントの数の値（行の高さ・目盛りの高さ・セルの幅）は正本の名前から読む：gantt-inner.tsx に cellHeight・scaleHeight・cellWidth の数字の直書き（36・28・32・72・96）が無い", () => {
  const src = readFileSync(join(F7, "gantt/gantt-inner.tsx"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  expect(src).not.toMatch(/cellHeight=\{\s*\d/);
  expect(src).not.toMatch(/scaleHeight=\{\s*\d/);
  expect(src).not.toMatch(/\{\s*day:\s*32\b|week:\s*72\b|month:\s*96\b/);
  expect(src).toMatch(/--k-c-gantt-(row|scale|cell)/);
});

test("K460-MK-006 下絵の探す結果の会話の行は押せる形：states/notice.tsx の kind が conversation の行に href（/ai/chat?c=…）がある（K-471 が押せる行を本番にする・D-145.9 の「行き先が在れば押せる」）", () => {
  const src = readFileSync(join(STATES, "notice.tsx"), "utf8");
  const at = src.indexOf('kind: "conversation",\n    hits:');
  expect(at, "会話の組が無い").toBeGreaterThan(-1);
  expect(src.slice(at, at + 500)).toMatch(/href: "\/ai\/chat\?c=/);
});

test("K460-TL-001 中間・またぐ試験の道具 tests/_lib/f7-flow.ts の形：決めた 29 の名前を書き出し、口を page.route で作り物にせず、固定の待ち（waitForTimeout）を使わず、前からの道具（./api・./newcomer・./prep）だけを読む。これを読む段 8 の中間の試験（skeleton の K-591〜K-595・K-597・K-598）がどれも同じ道具を import する", () => {
  const file = join(WEB, "tests/_lib/f7-flow.ts");
  expect(existsSync(file), "f7-flow.ts が無い").toBe(true);
  const raw = readFileSync(file, "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const names = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|interface)\s+([A-Za-z_]\w*)/gm)].map(
    (m) => m[1]!,
  );
  const want = [
    "Mate",
    "mateOf",
    "answered",
    "NOTICE_RE",
    "READ_ALL_RE",
    "SEARCH_RE",
    "TICKET_RE",
    "RESTORE_RE",
    "SAVED_RE",
    "ticketFacts",
    "scopeOf",
    "noteRow",
    "dropPcNotice",
    "notesOf",
    "ticketRow",
    "setDueDays",
    "completeByDb",
    "jst",
    "ticketFor",
    "openTicket",
    "bell",
    "bellCount",
    "noticeBox",
    "openBell",
    "noticeRow",
    "approvalsBadge",
    "searchFor",
    "deleteOnScreen",
    "handoversOf",
  ];
  expect(want.length).toBe(29);
  expect([...names].sort()).toEqual([...want].sort());
  expect(src, "口を網の手前で作り物にしている").not.toMatch(/\.route\(/);
  expect(src, "固定の待ち").not.toMatch(/waitForTimeout\(/);
  const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]!).sort();
  expect(imports).toEqual(["./api", "./newcomer", "./prep", "@playwright/test"]);
  const SKELETON = join(WEB, "tests/skeleton");
  const readers = ["k591", "k592", "k593", "k594", "k595", "k597", "k598"].map((k) =>
    readdirSync(SKELETON).find((n) => n.startsWith(`${k}-`) && n.endsWith(".spec.ts")),
  );
  expect(
    readers.filter((r) => !r),
    "中間の試験が無い葉がある",
  ).toEqual([]);
  const notReading = readers.filter((r) => !/_lib\/f7-flow/.test(readFileSync(join(SKELETON, r!), "utf8")));
  expect(notReading, `f7-flow を読まない中間の試験：${notReading.join("・")}`).toEqual([]);
});

// ---- 正本の値 ----

/** 下絵が借りていた値を、そのままの値で正本の名前にしたもの（名前 → 欄 → 値）。11_tickets/K-460.md の「足す値」の表 */
const ADDED: Record<string, Record<string, string>> = {
  "notice-panel": { width: "420px" },
  "search-panel": { width: "580px", top: "144px" },
  "notice-avatar": { width: "22px", height: "22px" },
  "more-menu-min": { width: "220px" },
  "calendar-day": { height: "112px" },
  "calendar-day-compact": { height: "56px" },
  "calendar-tray": { width: "384px" },
  "f7-dot": { width: "6px", height: "6px" },
  "gantt-body": { height: "624px" },
  "gantt-row": { height: "36px" },
  "gantt-scale": { height: "28px" },
  "gantt-cell-day": { width: "32px" },
  "gantt-cell-week": { width: "72px" },
  "gantt-cell-month": { width: "96px" },
};
const TONES = [
  "neutral",
  "indigo",
  "tertiary",
  "warning",
  "progress",
  "amber",
  "success",
  "danger",
  "hold",
  "teal",
  "teal-light",
  "lavender",
  "plum",
  "coral",
  "sage",
];

test("K460-DS-001 正本（DESIGN-kaname.md の components）と生成物（k-tokens.css）に、足す値 14 の部品・17 の欄が入っている（値は下絵が借りていた値のまま）", () => {
  const design = readFileSync(DESIGN, "utf8");
  const tokens = readFileSync(TOKENS, "utf8");
  const bad: string[] = [];
  let count = 0;
  for (const [part, props] of Object.entries(ADDED)) {
    const at = design.search(new RegExp(`^  ${part}:`, "m"));
    if (at < 0) {
      bad.push(`DESIGN に ${part} が無い`);
      continue;
    }
    const block = design.slice(at).split(/\n {2}[a-z0-9-]+:|\n[^ \n]/)[0]!;
    for (const [prop, value] of Object.entries(props)) {
      count++;
      if (!new RegExp(`\\b${prop}: "${value}"`).test(block)) bad.push(`DESIGN の ${part}.${prop} が ${value} でない`);
      const css = `--k-c-${part}-${prop}: ${value};`;
      if (!tokens.includes(css)) bad.push(`k-tokens.css に ${css} が無い`);
    }
  }
  expect(Object.keys(ADDED).length).toBe(14);
  expect(count).toBe(17);
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K460-DS-002 下絵が借りていた値の置き換えを CSS に反映した：notice.css・search.css・calendar.css・gantt.css・delete.css が新しい名前を読み、前の借り物（--k-c-dialog-form-width・--k-c-dialog-connect-width・--k-c-detail-avatar-*・--k-c-pc-menu-min-width・--k-s-xl を掛ける式・due.css の 1px の影）が無く、F7 の CSS に 100vw・100dvh が無い", () => {
  const css = (a: string, f: string) => readFileSync(join(F7, a, f), "utf8");
  const notice = css("notice", "notice.css");
  expect(notice).toContain("var(--k-c-notice-panel-width)");
  expect(notice).toContain("var(--k-c-notice-avatar-width)");
  expect(notice).not.toMatch(/dialog-form-width|detail-avatar/);
  const search = css("search", "search.css");
  expect(search).toContain("var(--k-c-search-panel-width)");
  expect(search).toContain("var(--k-c-search-panel-top)");
  expect(search).not.toMatch(/dialog-connect-width|--k-s-2xl/);
  const cal = css("calendar", "calendar.css");
  expect(cal).toContain("var(--k-c-calendar-day-height)");
  expect(cal).toContain("var(--k-c-calendar-day-compact-height)");
  expect(cal).toContain("var(--k-c-f7-dot-width)");
  expect(cal).toContain("var(--k-c-calendar-tray-width)");
  expect(cal).not.toMatch(/calc\(var\(--k-s-xl\)|--k-s-xs\) \* 1\.5/);
  const gantt = css("gantt", "gantt.css");
  // 本体の高さは K-482（2026-11-27）が「目盛り 2 段＋行 18 本」の式にした（同じトークンの行と目盛りの高さから作る）
  expect(gantt).toMatch(/var\(--k-c-gantt-scale-height\)[^;]*var\(--k-c-gantt-row-height\)/);
  expect(gantt).not.toMatch(/--k-s-xl\) \* 13/);
  expect(css("due", "due.css")).not.toMatch(/inset 0 0 0 1px/);
  // 画面の幅・高さの生の式（100vw・100dvh）は D8 が赤にする。許す例外は足さない（控え帳）ので、親の大きさ（%）に替える
  const raw = walk(F7, [".css"]).filter((f) =>
    /\b100(vw|dvh|vh)\b/.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")),
  );
  expect(raw, `100vw・100dvh が残る：${raw.join("・")}`).toEqual([]);
  expect(css("delete", "delete.css")).toContain("var(--k-c-more-menu-min-width)");
  expect(css("delete", "delete.css")).not.toContain("pc-menu-min");
});

test("K460-DS-003 見え方の色の段：DESIGN-kaname.md に「見え方の色の段」の節があり 15 の段の名前を持つ。tones.css は同じ 15 の段で、新しい色の値（#・rgb）を足していない", () => {
  const design = readFileSync(DESIGN, "utf8");
  const at = design.indexOf("見え方の色の段");
  expect(at, "DESIGN に「見え方の色の段」の節が無い").toBeGreaterThan(-1);
  const section = design.slice(at, at + 6000);
  for (const t of TONES) expect(section, `段 ${t}`).toContain(`\`${t}\``);
  const tones = readFileSync(join(F7, "overview/tones.css"), "utf8");
  const defined = [...tones.matchAll(/\[data-f7-tone="([a-z-]+)"\]/g)].map((m) => m[1]);
  expect([...defined].sort()).toEqual([...TONES].sort());
  expect(tones).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgba?\(/);
});

test("K460-DS-004 正本の値の検査（design_gate の D1〜D8）に FAIL が無い（新しい部品は対応する規則か訳つきの除外のどちらか）", () => {
  const base = [
    "scripts/ci/design_gate.py",
    "--design",
    "04_design/DESIGN-kaname.md",
    "--mocks",
    "apps/web/components/k",
    "apps/web/features",
    "--css",
    "apps/web/styles/k-tokens.css",
  ];
  expect(runPy([...base, "--part", "--scales", "--usage", "apps/web", "apps/bridge/src"])).not.toMatch(
    /\bFAIL\b|不合格/,
  );
  // 台帳との比べ方を指定しないと design_gate は「D8 比べ方の指定が無い」で終わる（k261 の RL-010）。手元・容れ物とも --no-base
  expect(runPy([...base, "--part", "--no-components", "--raw-lengths", "--no-base"])).not.toMatch(/\bFAIL\b|不合格/);
  const gate = JSON.parse(readFileSync(GATE, "utf8")) as { component_exempt?: { part: string; reason: string }[] };
  for (const r of gate.component_exempt ?? []) expect(r.reason.trim().length, r.part).toBeGreaterThan(0);
});

// ---- カレンダー・お知らせのボタン（決定ログの §151 は K-601 の試験が見る） ----

test("K460-CAL-001 カレンダーの部品：外の部品（FullCalendar・schedule-x・react-big-calendar）は入れない。決めを 07_functional/段8-F7/カレンダーの部品.md に書き（理由 3 つ以上・K-481 に残す決め）、selected-stack.json の calendar・timeline が「未定」のままでない（timeline は svar-gantt）", () => {
  const pkg = readFileSync(join(WEB, "package.json"), "utf8");
  expect(pkg).not.toMatch(/fullcalendar|schedule-x|react-big-calendar/i);
  const doc = join(DOC, "カレンダーの部品.md");
  expect(existsSync(doc), "カレンダーの部品.md が無い").toBe(true);
  const md = readFileSync(doc, "utf8");
  expect(md).toContain("外の部品は入れない");
  expect((md.match(/^\s*[-・]\s*理由/gm) ?? []).length).toBeGreaterThanOrEqual(3);
  expect(md).toContain("K-481");
  const stack = JSON.parse(readFileSync(join(ROOT, "02_tech_stack/selected-stack.json"), "utf8")) as {
    stack: { frontend: { task_views: { calendar: string; timeline: string } } };
  };
  const cal = stack.stack.frontend.task_views.calendar;
  expect(cal).not.toContain("未定");
  expect(cal).toContain("features/F7/calendar");
  const timeline = stack.stack.frontend.task_views.timeline;
  expect(timeline, "timeline が「未定」のまま（ガントは svar-gantt・D-079）").not.toContain("未定");
  expect(timeline).toContain("svar-gantt");
  expect(pkg).toContain("@svar-ui/react-gantt");
});

test("K460-NT-001 お知らせに押せるボタン：components/k/notice.tsx は notify（action・duration を受け、お知らせの鍵を返す）と dismissNotify(鍵) を書き出し、useNotify は notify を返す。UndoToast は sonner を直に読まず notify・dismissNotify だけを使う。k.css に .k-toast-action があり正本のトークンだけを読む", () => {
  const notice = readFileSync(join(WEB, "components/k/notice.tsx"), "utf8");
  expect(notice).toMatch(/action\?:\s*\{\s*label:\s*string;\s*onClick:/);
  expect(notice).toMatch(/duration\?:\s*number/);
  expect(notice).toMatch(/actionButton:\s*"k-toast-action"/);
  expect(notice, "スマホで下のタブに重なる").toMatch(/mobileOffset=\{\{\s*bottom:[^}]*--k-c-shell-tabs-height/);
  expect(notice).toMatch(/export function notify\(/);
  expect(notice).toMatch(/export function dismissNotify\(/);
  expect(notice).toMatch(/export function useNotify\(\)[\s\S]{0,80}return notify/);
  const undo = readFileSync(join(F7, "delete/undo-toast.tsx"), "utf8");
  expect(undo).not.toMatch(/from "sonner"/);
  expect(undo).not.toMatch(/TOASTER_ID/);
  expect(undo).toMatch(/from "@\/components\/k"/);
  expect(undo).toMatch(/\bnotify\(/);
  expect(undo).toMatch(/\bdismissNotify\(/);
  const css = readFileSync(join(WEB, "components/k/k.css"), "utf8");
  const rule = /\.k-toast-action\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  expect(rule.length, ".k-toast-action の規則が無い").toBeGreaterThan(0);
  expect(rule).not.toMatch(/#[0-9a-fA-F]{3,6}\b|\b\d+px\b/);
  expect(readFileSync(join(F7, "delete/delete.css"), "utf8")).not.toContain("k-f7-undo-btn");
});

// ---- モックの置き場（実 Chrome） ----

test("K460-UI-001 索引 /dev/mock/f7 に 42 のリンク（/dev/mock/f7/<状態>）。「この状態はありません」が無い", async ({
  page,
}) => {
  await guard(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/dev/mock/f7"))?.status()).toBe(200);
  const links = page.locator('a[href^="/dev/mock/f7/"]');
  await expect(links).toHaveCount(42);
  const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect([...hrefs].sort()).toEqual(ALL.map((id) => `/dev/mock/f7/${id}`).sort());
});

/** 42 の状態を前半 21・後半 21 に分けて開く（1 つの試験に 42 を詰めると、台が混んだときに上限の 240 秒に足りなくなる） */
const FIRST = ALL.slice(0, 21);
const SECOND = ALL.slice(21);

/** ids の状態を幅 width で開き、「この状態はありません」と横のはみ出しを数える */
async function statesAt(page: Page, ids: readonly string[], width: number) {
  await guard(page);
  const bad: string[] = [];
  for (const id of ids) {
    await openState(page, id, width);
    await expect(page.getByText("この状態はありません")).toHaveCount(0);
    const over = await overflowX(page);
    if (over > 0) bad.push(`${id}：横に ${over}px はみ出す`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
}

test("K460-UI-002 幅 375（前半 21 の状態）：200 で開き、「この状態はありません」が無く、横のはみ出し 0", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await statesAt(page, FIRST, 375);
});
test("K460-UI-009 幅 375（後半 21 の状態）：200 で開き、「この状態はありません」が無く、横のはみ出し 0", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await statesAt(page, SECOND, 375);
});
test("K460-UI-003 幅 768（前半 21 の状態）：200 で開き、「この状態はありません」が無く、横のはみ出し 0", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await statesAt(page, FIRST, 768);
});
test("K460-UI-010 幅 768（後半 21 の状態）：200 で開き、「この状態はありません」が無く、横のはみ出し 0", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await statesAt(page, SECOND, 768);
});
test("K460-UI-004 幅 1440（前半 21 の状態）：200 で開き、「この状態はありません」が無く、横のはみ出し 0", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await statesAt(page, FIRST, 1440);
});
test("K460-UI-011 幅 1440（後半 21 の状態）：200 で開き、「この状態はありません」が無く、横のはみ出し 0", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await statesAt(page, SECOND, 1440);
});

/** ids の状態を開き直して、pageerror と hydration のお知らせを集める。描き終わりは「ブラウザの手が空く」まで待つ（networkidle は 1 状態ごとに遅い） */
async function errorsOf(page: Page, ids: readonly string[]) {
  await guard(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text());
  });
  for (const id of ids) {
    await openState(page, id, 1440);
    await page.evaluate(() => new Promise<void>((done) => window.requestIdleCallback(() => done(), { timeout: 2000 })));
  }
  return errors;
}

test("K460-UI-005 描き直し（前半 21 の状態）：pageerror と hydration のお知らせが 0", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await errorsOf(page, FIRST);
  expect(errors, errors.join("\n")).toEqual([]);
});
test("K460-UI-012 描き直し（後半 21 の状態）：pageerror と hydration のお知らせが 0", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await errorsOf(page, SECOND);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K460-UI-006 お知らせの「元に戻す」：f7-delete-undo に、お知らせの置き場（名前「お知らせ」）の中で「元に戻す」のボタンが見え、位置が画面の中", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "f7-delete-undo", 1440);
  // 置き場の読み上げの名前は「お知らせ alt+T」（sonner が操作のキーを足す）。名前の一部で探すと通知の箱と取り違えるので、頭の字で選ぶ
  const region = page.locator('section[aria-label^="お知らせ "]');
  const btn = region.getByRole("button", { name: "元に戻す", exact: true });
  await expect(btn).toBeVisible();
  const vp = page.viewportSize()!;
  // 出てくる動き（下から上がる）が終わった後の位置で見る（動きの途中は画面の下に少しはみ出す）
  await expect
    .poll(async () => {
      const b = (await btn.boundingBox())!;
      return b.y + b.height;
    })
    .toBeLessThanOrEqual(vp.height);
  const box = (await btn.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
});

test("K460-UI-007 値を置き換えても見た目が変わらない：お知らせの箱の幅 420・探す箱の幅 580・探す箱の上端は帯の下 96（幅 1440）・カレンダーの日の高さ 112（幅 1440）・56（幅 375）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "f7-bell-open", 1440);
  const notice = page.getByRole("region", { name: "お知らせ", exact: true }).first();
  expect(Math.round((await notice.boundingBox())!.width)).toBe(420);
  await openState(page, "f7-search-results", 1440);
  const search = page.locator(".k-f7-search");
  const sb = (await search.boundingBox())!;
  expect(Math.round(sb.width)).toBe(580);
  expect(Math.round(sb.y)).toBe(144);
  await openState(page, "f7-calendar", 1440);
  expect(Math.round((await page.locator(".k-f7-calendar-cell").first().boundingBox())!.height)).toBe(112);
  await openState(page, "f7-calendar", 375);
  expect(Math.round((await page.locator(".k-f7-calendar-cell").first().boundingBox())!.height)).toBe(56);
});
