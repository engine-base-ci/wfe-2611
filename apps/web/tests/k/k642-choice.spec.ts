// K-642「丸い選択・四角い選択の共通の部品（印を字の 1 行目の真ん中にそろえる）と、ずれを機械で止める」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。
//   形（実装の役が作る）：components/k/choice.tsx の Checkbox・Radio・RadioGroup。label が印（ネイティブの input）を包み、
//     印は字の 1 行目の高さの箱の縦の真ん中に置く（字が 2 行以上でも 1 行目）。大きさと間は正本のトークン（DESIGN-kaname.md の choice・choice-box）。
//     画面の .tsx（apps/web の app・components・features）は、ネイティブの丸・四角を直に書かず、この部品だけを使う（例外は下の RAW_OK の 3 つ・理由つき）。
//   ずれの測り方は tests/_lib/choice-align.mjs の 1 か所（下絵の頁の作り手も同じ物を読む）。上限は 1px。
//   見本：/dev/k/choice（部品の見本・この葉が作る）と、開発用の置き場 /dev/mock/<流れ>/ の全部の状態（流れのフォルダはファイルから拾うので、
//     後から段のモックが入っても自動で測る）。
//   口は呼ばない（網の手前で 599）。本人の Bridge（127.0.0.1:38617）にも届かせない（404）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  CHOICE_ALIGN_LIMIT_PX,
  choiceAlignLines,
  choiceAlignOf,
  measureChoiceAlign,
  type ChoiceAlignResult,
  type ChoiceEdgeBad,
} from "../_lib/choice-align.mjs";
import { FIDELITY_STATES } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const GALLERY = "/dev/k/choice";
const MOCK_DIR = join(WEB, "app/(dev)/dev/mock");
/** ネイティブの丸・四角を直に書いてよいファイル（部品そのものと、理由つきの 3 つ） */
const CHOICE_FILE = "apps/web/components/k/choice.tsx";
const RAW_OK: Record<string, string> = {
  "apps/web/components/k/theme.tsx":
    "見た目の切り替えは札の形：丸は視覚から隠し（不透明度 0）、札そのものに印を描く。印と字を横に並べない",
  "apps/web/components/ui/field.tsx":
    '前の画面の文字の入力欄：受け取った type を input に渡す（字でない type）。丸・四角を渡す呼び手は、呼び手の type="checkbox" の字で赤になる',
  "apps/web/app/(dev)/dev/fake-login/page.tsx":
    "外のサイトのログイン画面の偽物（Bridge の試験の的）。Kaname の部品を使わない",
};

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(n)) out.push(p);
  }
  return out;
}
const rel = (p: string) => p.slice(ROOT.length + 1);
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const runPy = (args: string[]) =>
  execFileSync("python3", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000 });
/** ネイティブの丸・四角・その役目を直に書いた所。4 つの形を数える：
 *   ・type="checkbox" / type={"radio"} / role="checkbox"（属性の字）
 *   ・type: "checkbox"（{...{ type: "radio" }} や createElement の props の形）
 *   ・<input … type={変数}>（字でない type。何の形の input か読めないので赤に倒す）
 *   ・外の部品の丸・四角（@base-ui/react の checkbox・checkbox-group・radio・radio-group・switch）の import */
const RAW = [
  /\b(?:type|role)=\{?\s*["'`](?:checkbox|radio)["'`]\s*\}?/g,
  /\btype\s*:\s*["'`](?:checkbox|radio)["'`]/g,
  /<input\b(?:[^>]|=>)*?\btype=\{(?!\s*["'`])/g,
  /from\s+["']@base-ui\/react\/(?:checkbox|checkbox-group|radio|radio-group|switch)["']/g,
];
const rawCount = (src: string) => RAW.reduce((n, rx) => n + [...src.matchAll(rx)].length, 0);

/** 正本の components の部品の 1 つの値（例 choice-box の width） */
function designValue(part: string, key: string): string {
  const md = readFileSync(join(ROOT, "04_design/DESIGN-kaname.md"), "utf8");
  const m = md.match(new RegExp(`\\n {2}${part}:[^\\n]*\\n((?: {4}[^\\n]*\\n)+)`));
  expect(m, `DESIGN-kaname.md の components に ${part} が無い`).not.toBeNull();
  const v = m![1]!.match(new RegExp(`^ {4}${key}: *"?([^"\\n#]+?)"? *(?:#.*)?$`, "m"));
  expect(v, `DESIGN-kaname.md の ${part} に ${key} が無い`).not.toBeNull();
  return v![1]!.trim();
}

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "見本は口を呼ばない" }));
}
async function open(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(path);
  expect(res?.status(), `${path} を開けない`).toBe(200);
  await page.locator("main").first().waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
}
const fail = (r: ChoiceAlignResult, where: string) => choiceAlignLines(r, where).join("\n");
const gallery = (page: Page) => page.getByRole("main");

// ---- ファイル：部品だけを使う・正本とトークン・見た目の検査 ----

test("K642-SRC-001 画面の .tsx（apps/web の app・components・features・注を除く）で、ネイティブの丸・四角を直に書いたファイル（type か role が checkbox・radio の字・type: の形・字でない type の input・外の部品の丸・四角の import）は、部品 components/k/choice.tsx と理由つきの例外（theme.tsx・components/ui/field.tsx・dev の fake-login）だけ。部品は丸と四角の両方を書き、例外はどれも今も直に書いている（使われなくなった例外を残さない）", () => {
  const files = ["app", "components", "features"].flatMap((d) => walk(join(WEB, d), /\.tsx?$/));
  const hits = new Map<string, number>();
  for (const f of files) {
    const n = rawCount(noComments(readFileSync(f, "utf8")));
    if (n) hits.set(rel(f), n);
  }
  expect(files.length, "読む .tsx が 1 つも無い").toBeGreaterThan(100);
  const extra = [...hits.keys()].filter((f) => f !== CHOICE_FILE && !(f in RAW_OK));
  expect(extra, `部品を使わずに丸・四角を直に書いている：\n${extra.join("\n")}`).toEqual([]);
  const src = noComments(readFileSync(join(ROOT, CHOICE_FILE), "utf8"));
  expect(src).toMatch(/["'`]checkbox["'`]/);
  expect(src).toMatch(/["'`]radio["'`]/);
  for (const f of Object.keys(RAW_OK))
    expect(hits.get(f) ?? 0, `${f} は例外に載っているのに直に書いていない`).toBeGreaterThan(0);
});

test("K642-SRC-002 部品の入口 components/k/index.ts が Checkbox・Radio・RadioGroup を ./choice から出す。choice.tsx は label が印（input）を包み、label のクラスに k-choice、印のクラスに k-choice-input を持つ", () => {
  const index = noComments(readFileSync(join(WEB, "components/k/index.ts"), "utf8"));
  const line = index.match(/export\s*\{([^}]*)\}\s*from\s*["']\.\/choice["']/);
  expect(line, "index.ts に ./choice の export が無い").not.toBeNull();
  for (const name of ["Checkbox", "Radio", "RadioGroup"]) expect(line![1]).toMatch(new RegExp(`\\b${name}\\b`));
  const src = noComments(readFileSync(join(ROOT, CHOICE_FILE), "utf8"));
  expect(src).toMatch(/<label[\s\S]*?className=[^>]*k-choice/);
  expect(src).toMatch(/<input[\s\S]*?className=[^>]*k-choice-input/);
});

test("K642-TK-001 正本 DESIGN-kaname.md の components に choice（typography・lineHeight・gap）と choice-box（width・height・margin）が在り、作り手 gen_tokens.py が --k-c-choice-gap・--k-c-choice-box-width・-height・-margin を出す（k-tokens.css が正本どおり・--check が緑）。k.css の .k-choice が gap を、.k-choice-input が width・height・margin をそのトークンで読む", () => {
  for (const k of ["typography", "lineHeight", "gap"]) designValue("choice", k);
  const w = designValue("choice-box", "width");
  const h = designValue("choice-box", "height");
  designValue("choice-box", "margin");
  const tokens = readFileSync(join(WEB, "styles/k-tokens.css"), "utf8");
  for (const t of ["--k-c-choice-gap", "--k-c-choice-box-margin"])
    expect(tokens).toMatch(new RegExp(`${t}:\\s*[^;]+;`));
  expect(tokens).toMatch(new RegExp(`--k-c-choice-box-width:\\s*${w};`));
  expect(tokens).toMatch(new RegExp(`--k-c-choice-box-height:\\s*${h};`));
  expect(runPy(["04_design/gen_tokens.py", "--web", "--check"])).toMatch(/正本どおり/);
  const k = noComments(readFileSync(join(WEB, "components/k/k.css"), "utf8"));
  const rule = (sel: string) => {
    const m = k.match(new RegExp(`(?:^|\\})\\s*${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`));
    expect(m, `k.css に ${sel} の規則が無い`).not.toBeNull();
    return m![1]!;
  };
  expect(rule(".k-choice")).toMatch(/(?:^|;)\s*gap:\s*var\(--k-c-choice-gap\)/);
  const box = rule(".k-choice-input");
  expect(box).toMatch(/width:\s*var\(--k-c-choice-box-width\)/);
  expect(box).toMatch(/height:\s*var\(--k-c-choice-box-height\)/);
  expect(box).toMatch(/margin:\s*var\(--k-c-choice-box-margin\)/);
});

test("K642-DS-001 design_gate の D1〜D8（--part --scales --usage）が緑：足した部品 choice・choice-box の対応（design-gate.json）が在り、FAIL も「D5 choice」も無い", () => {
  const out = runPy([
    "scripts/ci/design_gate.py",
    "--design",
    "04_design/DESIGN-kaname.md",
    "--mocks",
    "apps/web/components/k",
    "apps/web/features",
    "--css",
    "apps/web/styles/k-tokens.css",
    "--part",
    "--scales",
    "--usage",
    "apps/web",
    "apps/bridge/src",
  ]);
  expect(out).not.toMatch(/\bFAIL\b/);
  expect(out).not.toMatch(/D5 choice/);
});

// ---- 測る関数そのもの（検査が何も見ていないのに緑にならない） ----

test("K642-AL-001 測る関数：ずれた印（字の行より上に寄る四角・素の丸）は bad に出て、行の高さの箱の真ん中に置いた丸（字は 1 つの書体で描く英字）は出ない。見えない印（不透明度 0）は hidden、字の無い印は bare に数え、どれも測った数に入れない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.setContent(`<style>*{margin:0}body{font:13px/1.6 sans-serif}</style>
<label id="up" style="display:flex;align-items:flex-start;gap:6px;font-size:12px;line-height:2"><input type="checkbox">上に寄る四角</label>
<label id="ok" style="display:grid;grid-template-columns:13px 1fr;gap:8px;align-items:start;font-size:12px;line-height:1.5"><span style="display:flex;align-items:center;height:calc(12px * 1.5)"><input type="radio" name="a" style="width:13px;height:13px"></span><span>centered radio</span></label>
<label id="raw"><input type="radio" name="b" style="width:13px;height:13px;vertical-align:baseline;margin-top:-6px"> 素の丸</label>
<label style="position:relative"><input type="radio" name="c" style="position:absolute;opacity:0">隠した丸</label>
<table><tr><td><input type="checkbox" aria-label="字の無い四角"></td></tr></table>`);
  const r = await page.evaluate(measureChoiceAlign, CHOICE_ALIGN_LIMIT_PX);
  expect(r.measured).toBe(3);
  expect(r.hidden).toBe(1);
  expect(r.bare).toHaveLength(1);
  const bad = r.bad.filter((b) => b.kind === "mid").map((b) => b.where);
  expect(
    bad.some((w) => w.includes("上に寄る四角")),
    fail(r, "data:"),
  ).toBe(true);
  expect(
    bad.some((w) => w.includes("素の丸")),
    fail(r, "data:"),
  ).toBe(true);
  expect(
    bad.some((w) => w.includes("centered radio")),
    fail(r, "data:"),
  ).toBe(false);
  expect(choiceAlignLines(r, "data:")[0]).toContain("3 個を測った");
});

test("K642-AL-002 測る関数（同じ並び）：同じ親の兄弟の行を縦に積んだ列で、印の左端が 1 つだけ 4px 右に寄ると left、同じ字の大きさで印と字の間が 1 つだけ 2px 違うと gap で bad に出る。字の大きさの違う行の間の違い・左端もそろった列・横に並べた行・別の所の単独の行・字の無い印の横並び・字が印の左にある行は bad にしない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 1000 });
  const box = (ml: number) => `<input type="checkbox" style="margin:0 0 0 ${ml}px;width:13px;height:13px">`;
  const row = (ml: number, gap: number, text: string, fs = 13) =>
    `<label style="display:flex;align-items:center;gap:${gap}px;font-size:${fs}px">${box(ml)}${text}</label>`;
  const right = (text: string) =>
    `<label style="display:flex;align-items:center;justify-content:space-between;width:300px">${text}${box(0)}</label>`;
  await page.setContent(`<style>*{margin:0}body{font:13px/1.6 sans-serif}section{margin-bottom:12px}</style>
<section>${row(0, 8, "左端の一つめ")}${row(4, 8, "左端が寄る二つめ")}${row(0, 8, "左端の三つめ")}</section>
<section>${row(0, 8, "間の一つめ")}${row(0, 6, "間が狭い二つめ")}</section>
<section>${row(4, 8, "本文の大きさ")}${row(4, 6, "小窓の大きさ", 12)}</section>
<section>${row(4, 8, "そろう一つめ")}${row(4, 8, "そろう二つめ")}<div>${box(4).replace("<input", '<input aria-label="字の無い四角"')}</div></section>
<section style="display:flex;gap:24px">${row(0, 8, "横の一つめ")}${row(4, 8, "横の二つめ")}</section>
<section><div>${row(0, 8, "離れた一つめ")}</div></section><section><div>${row(4, 6, "離れた二つめ")}</div></section>
<section><div><input type="checkbox" aria-label="横の字の無い一" style="margin:0"><input type="checkbox" aria-label="横の字の無い二" style="margin:0 0 0 24px"></div></section>
<section>${right("字が左")}${right("字が左の長い行の字")}</section>`);
  const r = await page.evaluate(measureChoiceAlign, CHOICE_ALIGN_LIMIT_PX);
  const edge = (k: ChoiceEdgeBad["kind"]) => r.bad.filter((b): b is ChoiceEdgeBad => b.kind === k);
  const left = edge("left");
  const gap = edge("gap");
  expect(
    left.map((b) => b.where),
    fail(r, "data:"),
  ).toEqual([expect.stringContaining("左端が寄る二つめ")]);
  expect(left[0]!.diff).toBe(4);
  expect(gap, fail(r, "data:")).toHaveLength(1);
  expect(gap[0]!.names.join("・")).toContain("間が狭い二つめ");
  expect(gap[0]!.diff).toBe(2);
  // 比べる並び（行が 2 つ以上）は 5 つ：左端・間・大きさ違い・そろう・字が左。横・離れた・字の無い印は並びにしない
  expect(r.columns, fail(r, "data:")).toHaveLength(5);
  const all = r.bad.flatMap((b) => ("names" in b ? b.names : [b.where])).join("・");
  for (const ok of [
    "本文の大きさ",
    "小窓の大きさ",
    "そろう一つめ",
    "横の一つめ",
    "離れた二つめ",
    "横の字の無い",
    "字が左",
  ])
    expect(all, fail(r, "data:")).not.toContain(ok);
  // そろう列は字のある 2 行（字の無い印は数えない）。左端も間も 0
  const okCol = r.columns.find((c) => c.names.some((n) => n.includes("そろう一つめ")));
  expect(okCol?.marks).toBe(2);
  expect(okCol?.left).toBe(0);
  expect(okCol?.gap).toBe(0);
  expect(r.leftMax).toBe(4);
  expect(r.gapMax).toBe(2);
  expect(choiceAlignLines(r, "data:").join("\n")).toContain("同じ並びの印の左端から 右へ 4px");
});

// ---- 実ブラウザ：部品の見本 /dev/k/choice ----

for (const w of [375, 1440]) {
  test(`K642-UI-001 部品の見本（${GALLERY}・幅 ${w}）：字のある印を 8 個以上測り、どの印も字の 1 行目の真ん中から ${CHOICE_ALIGN_LIMIT_PX}px 以内。字の無い四角は 1 個以上（bare）`, async ({
    page,
  }) => {
    await guard(page);
    await open(page, GALLERY, w);
    const r = await choiceAlignOf(page);
    expect(r.measured, fail(r, `${GALLERY}@${w}`)).toBeGreaterThanOrEqual(8);
    expect(r.bare.length).toBeGreaterThanOrEqual(1);
    expect(r.bad, fail(r, `${GALLERY}@${w}`)).toEqual([]);
  });
}

test(`K642-UI-002 字が 2 行以上（${GALLERY}・幅 375 の「長い字の四角」[data-choice-demo="wrap"]）：字は 2 行以上に折り返し、印は 1 行目の真ん中から ${CHOICE_ALIGN_LIMIT_PX}px 以内で、字の全部の行の真ん中からは ${CHOICE_ALIGN_LIMIT_PX}px より離れる（1 行目にそろえ、2 行の真ん中に寄らない）`, async ({
  page,
}) => {
  await guard(page);
  await open(page, GALLERY, 375);
  const demo = page.locator('[data-choice-demo="wrap"]');
  await expect(demo).toHaveCount(1);
  const row = await demo.evaluate((el) => {
    const input = el.matches("input") ? el : el.querySelector("input");
    const label = (input as HTMLInputElement).closest("label") as HTMLElement;
    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
      const box = (input as HTMLElement).getBoundingClientRect();
      const tops = rects.map((x) => x.top);
      const bottoms = rects.map((x) => x.bottom);
      return {
        lines: new Set(tops.map((t) => Math.round(t))).size,
        box: box.top + box.height / 2,
        first: rects[0]!.top + rects[0]!.height / 2,
        block: (Math.min(...tops) + Math.max(...bottoms)) / 2,
      };
    }
    return null;
  });
  expect(row, "長い字の四角の字が無い").not.toBeNull();
  expect(row!.lines).toBeGreaterThanOrEqual(2);
  expect(Math.abs(row!.box - row!.first)).toBeLessThanOrEqual(CHOICE_ALIGN_LIMIT_PX);
  expect(Math.abs(row!.box - row!.block)).toBeGreaterThan(CHOICE_ALIGN_LIMIT_PX);
});

test(`K642-UI-003 キーボードと読み上げ（${GALLERY}・幅 1440）：四角「一行の字」は名前どおりに読め、焦点を当てて Space で外れ、もう一度で付く。丸の組は役目 group・名前「丸い選択の組」で「ひとつめ」に印。焦点を当てて ↓ で「ふたつめ」、もう一度 ↓ で押せない「みっつめ」を飛ばして「ひとつめ」に戻る`, async ({
  page,
}) => {
  await guard(page);
  await open(page, GALLERY, 1440);
  const one = gallery(page).getByRole("checkbox", { name: "一行の字", exact: true });
  await expect(one).toBeChecked();
  await one.focus();
  await page.keyboard.press("Space");
  await expect(one).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(one).toBeChecked();
  const group = gallery(page).getByRole("group", { name: "丸い選択の組", exact: true });
  const first = group.getByRole("radio", { name: "ひとつめ", exact: true });
  const second = group.getByRole("radio", { name: /^ふたつめ/ });
  const third = group.getByRole("radio", { name: "みっつめ", exact: true });
  await expect(first).toBeChecked();
  await expect(third).toBeDisabled();
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(second).toBeChecked();
  await expect(second).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(first).toBeChecked();
  await expect(third).not.toBeChecked();
});

test(`K642-UI-004 押せない形（${GALLERY}・幅 1440）：四角「押せない四角」は押せず、字を押しても印は変わらない。label の指の形は not-allowed、印の不透明度は正本の input-disabled の値（--k-c-input-disabled-opacity）`, async ({
  page,
}) => {
  await guard(page);
  await open(page, GALLERY, 1440);
  const off = gallery(page).getByRole("checkbox", { name: "押せない四角", exact: true });
  await expect(off).toBeDisabled();
  const before = await off.isChecked();
  await gallery(page).getByText("押せない四角", { exact: true }).click({ force: true });
  expect(await off.isChecked()).toBe(before);
  const look = await off.evaluate((el) => {
    const label = el.closest("label") as HTMLElement;
    const token = getComputedStyle(document.documentElement).getPropertyValue("--k-c-input-disabled-opacity").trim();
    return { cursor: getComputedStyle(label).cursor, opacity: getComputedStyle(el).opacity, token };
  });
  expect(look.cursor).toBe("not-allowed");
  expect(look.token, "--k-c-input-disabled-opacity が無い").not.toBe("");
  expect(Number(look.opacity)).toBeCloseTo(Number(look.token), 3);
});

// ---- 実ブラウザ：開発用の置き場の全部の状態（どの画面のどの選択でも自動で拾う） ----

const MOCK_FLOWS = existsSync(MOCK_DIR)
  ? readdirSync(MOCK_DIR)
      .filter((d) => existsSync(join(MOCK_DIR, d, "page.tsx")))
      .sort()
  : [];

test("K642-UI-005 置き場の流れのフォルダを拾える（app/(dev)/dev/mock の下に page.tsx を持つフォルダが 1 つ以上・f3-pc と f6 を含む）", () => {
  expect(MOCK_FLOWS.length).toBeGreaterThan(0);
  expect(MOCK_FLOWS).toEqual(expect.arrayContaining(["f3-pc", "f6"]));
});

for (const flow of MOCK_FLOWS) {
  test(`K642-UI-006 置き場 /dev/mock/${flow} の全部の状態（索引のリンクの先）：幅 1440 と 375 で、どの選択の印も字の 1 行目の真ん中から ${CHOICE_ALIGN_LIMIT_PX}px 以内（測った数を注記に出す）`, async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await guard(page);
    await open(page, `/dev/mock/${flow}`, 1440);
    const hrefs = await page
      .locator(`a[href^="/dev/mock/${flow}/"]`)
      .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href") ?? ""))]);
    const states = hrefs.filter((h) => new RegExp(`^/dev/mock/${flow}/[^/?#]+$`).test(h)).sort();
    expect(states.length, `/dev/mock/${flow} の索引に状態のリンクが無い`).toBeGreaterThan(0);
    const bad: string[] = [];
    let measured = 0;
    for (const s of states) {
      for (const w of [1440, 375]) {
        if (w === 1440) await open(page, s, w);
        else await page.setViewportSize({ width: 375, height: 812 });
        const r = await choiceAlignOf(page);
        measured += r.measured;
        if (r.bad.length) bad.push(...choiceAlignLines(r, `${s}@${w}`));
      }
    }
    test.info().annotations.push({ type: "測った印", description: `${states.length} 状態・${measured} 個` });
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test(`K642-UI-007 部品を使った本物の選択が置き場で測れる：/dev/mock/f3-pc/pc-browser-pick の「AI が使うブラウザ」の丸 3 個と /dev/mock/f6/dec-add の「どこまで効かせる」の丸 2 個が、どれも部品（label.k-choice）の中にあり、字の 1 行目の真ん中から ${CHOICE_ALIGN_LIMIT_PX}px 以内（幅 1440）`, async ({
  page,
}) => {
  await guard(page);
  for (const [path, group, n] of [
    ["/dev/mock/f3-pc/pc-browser-pick", "AI が使うブラウザ", 3],
    ["/dev/mock/f6/dec-add", "どこまで効かせる", 2],
  ] as const) {
    await open(page, path, 1440);
    const radios = page.getByRole("group", { name: group, exact: true }).first().getByRole("radio");
    await expect(radios).toHaveCount(n);
    for (const el of await radios.all()) {
      expect(
        await el.evaluate((x) => x.closest("label")?.classList.contains("k-choice") ?? false),
        `${path} の丸が部品の外`,
      ).toBe(true);
    }
    const r = await choiceAlignOf(page);
    const ours = r.rows.filter((x) => x.where.startsWith("radio"));
    expect(ours.length, fail(r, path)).toBeGreaterThanOrEqual(n);
    expect(r.bad, fail(r, path)).toEqual([]);
  }
});

// ---- 実ブラウザ：本番の画面（見た目の突き合わせに入れた組の状態） ----
//   04_design/fidelity.json の入れた組（enrolled）の画面を、突き合わせと同じ道具（FIDELITY_STATES）で整えて測る。
//   組はファイルから拾うので、後から組が入っても自動で測る。所ごとの CSS が残る本番の文脈（同意・小窓・表）で、印と字がそろうかを見る

interface FidelityGroup {
  id: string;
  app: string;
  state: string;
  widths: number[];
  enrolled: boolean;
}
const FIDELITY = (
  JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: FidelityGroup[] }
).groups.filter((g) => g.enrolled);
/** 本物の選択が必ず在る組と、測れる印の下の数（同意のチェック 1・完了の小窓の実施事項と確かめ・差し戻しの小窓の丸 2 と四角 1） */
const MUST: Record<string, number> = { "consent-terms": 1, "complete-modal": 2, "return-modal": 3 };

test("K642-UI-008 本番の画面の組を拾える：fidelity.json の入れた組が 1 つ以上で、consent-terms・complete-modal・return-modal を含み、どれも画面を整える道具を持つ", () => {
  expect(FIDELITY.length).toBeGreaterThan(0);
  expect(FIDELITY.map((g) => g.id)).toEqual(expect.arrayContaining(Object.keys(MUST)));
  for (const g of FIDELITY) expect(FIDELITY_STATES[g.state], `${g.id} の state ${g.state}`).toBeTruthy();
});

for (const g of FIDELITY) {
  const wide = Math.max(...g.widths);
  const narrow = Math.min(...g.widths);
  test(`K642-UI-009 本番の画面 ${g.id}（${g.app}）：組の幅の広い方（${wide}）と狭い方（${narrow}）で、どの選択の印も字の 1 行目の真ん中から ${CHOICE_ALIGN_LIMIT_PX}px 以内${g.id in MUST ? `。字のある印を ${MUST[g.id]} 個以上測る` : ""}`, async ({
    browser,
  }) => {
    const page = await browser.newPage({ viewport: { width: wide, height: 1000 }, colorScheme: "light" });
    await FIDELITY_STATES[g.state]!(page, g.app);
    const bad: string[] = [];
    let least = Number.POSITIVE_INFINITY;
    for (const w of wide === narrow ? [wide] : [wide, narrow]) {
      await page.setViewportSize({ width: w, height: 1000 });
      const r = await choiceAlignOf(page);
      least = Math.min(least, r.measured);
      if (r.bad.length) bad.push(...choiceAlignLines(r, `${g.id}@${w}`));
    }
    await page.close();
    expect(bad, bad.join("\n")).toEqual([]);
    if (g.id in MUST) expect(least, `${g.id} で測った印が少ない`).toBeGreaterThanOrEqual(MUST[g.id]!);
  });
}
