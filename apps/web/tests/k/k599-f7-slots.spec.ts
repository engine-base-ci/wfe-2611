// K-599「段 8 の外枠と詳細の差し込み口（外枠の鈴と探す欄・左のメニューの保存した条件・詳細の期限と「…」・止まった箱ぜんたい）を、入れた時点では何も出さずに足す」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。一覧の差し込み口（見え方のタブ・期限の印・数の札と絞りの札・extra と counts）は K-600 が持つ（試験は k600-f7-list-slots.spec.ts）。
//   差し込み口の名前と形（後ろの画面の葉 K-466・K-467・K-471・K-479・K-484・K-486・K-590 が読む）：
//     features/F7/shell-slots.tsx  …… useNoticeSlot・NoticeSlot・useSearchSlot・SearchSlot・SavedViewSlot（外枠。Shell の props に渡す shellProps と、Shell の中に置く node）・
//                                      groupHref（左のメニューのグループの行の行き先。概要が本物になるまで null＝行は押せない形。K-466 が外枠の groups に使い、K-480 が区画を本物にする）
//     features/F7/detail-slots.tsx …… DueSlot（期限を変える）・MoreMenuSlot（「…」）・StoppedHandSlot（止まった箱ぜんたい。ticket・run 全体・delegate・children）
//   2 つの入口は区画のファイル（features/F7/<区画>/…-slot.tsx）からの書き出しだけ。後ろの葉は自分の区画のファイルだけを直す。
//   どの差し込み口も、この葉では「中身（children＝今の要素）をそのまま返すか、何も出さない」。だから本番の外枠と詳細の見た目と操作は今のまま。
//   前からの帯の条件は 1 つだけ変わる：引き取った実行（taken_over_at がある止まった実行）は止まった箱を出さない（K-486 が自分で直すを作る前に、条件の足しだけを入れる）。
//   「今のまま」を確かめる行（UI）は、後ろの葉が区画を本物にしても崩れない形にした（鈴・探す欄・「期限を変える」「ほかの操作」・自分で直すを押せる形に変える葉が自分の試験で見る）：
//   見るのは「F7 の新しい口（お知らせ・探す・保存した条件・消す下見）を呼ばない」と「前からの物が残っている」だけ。
//   口は網の手前で差し替える（外枠は tests/k/list-mock.ts・詳細は前からの土台 tests/features/F5/approve-complete.harness.ts）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { mockApi, openTicket, runView, ticketOf, withBand, type Band } from "../features/F5/approve-complete.harness";
import { items, mockList, open } from "./list-mock";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const src = (rel: string) => readFileSync(join(WEB, rel), "utf8");
/** 宣言だけを見る（注を外す） */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** 書き出す名前（export function・export const・export { … } from のどれでも。区画のファイルからの書き出しに替わっても同じ名前を数える） */
const exportsOf = (s: string) => {
  const c = code(s);
  const direct = [...c.matchAll(/export\s+(?:function|const)\s+([A-Za-z]\w*)/g)].map((m) => m[1]!);
  const re = [...c.matchAll(/export\s*\{([^}]*)\}\s*from/g)].flatMap((m) =>
    m[1]!
      .split(",")
      .map((n) =>
        n
          .trim()
          .split(/\s+as\s+/)
          .pop()!
          .trim(),
      )
      .filter((n) => n && !n.startsWith("type ")),
  );
  return [...direct, ...re].sort();
};

const F7 = "features/F7";
const COLLECTORS: Record<string, readonly string[]> = {
  [`${F7}/shell-slots.tsx`]: [
    "NoticeSlot",
    "SavedViewSlot",
    "SearchSlot",
    "groupHref",
    "useNoticeSlot",
    "useSearchSlot",
  ],
  [`${F7}/detail-slots.tsx`]: ["DueSlot", "MoreMenuSlot", "StoppedHandSlot"],
};
/** 区画のファイル（後ろの葉が自分のファイルだけを直す）。入口の書き出し元 */
const SECTIONS = [
  "notice/notice-slot",
  "search/search-slot",
  "saved/saved-view-slot",
  "due/due-slot",
  "delete/more-menu-slot",
  "stopped/stopped-hand-slot",
  "overview/group-link-slot",
] as const;

// ---- ファイルを読む（ブラウザ不要） ----

test("K599-SL-001 差し込み口の入口 2 つ：shell-slots.tsx（6）・detail-slots.tsx（3）が、決めた名前をちょうど書き出す（export function でも export { … } from でもよい）。区画のファイルからの書き出しがある", () => {
  for (const [file, names] of Object.entries(COLLECTORS)) {
    const s = src(file);
    expect(exportsOf(s), file).toEqual([...names].sort());
    expect(s, `${file} が区画のファイルを読まない`).toMatch(/from "\.\/[a-z]+\/[a-z-]+-slot"/);
  }
});

test("K599-SL-002 区画のファイル 7 個が在り、2 つの入口のどれかがそのファイルを読む（読まれないファイルが無い）。区画のファイルは口を呼ぶ部品を直に import しない形にはまだ縛らない（後ろの葉が本物にする）", () => {
  const all = Object.keys(COLLECTORS)
    .map((f) => src(f))
    .join("\n");
  const bad: string[] = [];
  for (const s of SECTIONS) {
    try {
      readFileSync(join(WEB, F7, `${s}.tsx`), "utf8");
    } catch {
      bad.push(`${F7}/${s}.tsx が無い`);
      continue;
    }
    if (!all.includes(`from "./${s}"`)) bad.push(`入口が ${s} を読まない`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K599-SL-003 差し込み口は前からのファイルに入っている：ticket-shell.tsx（useNoticeSlot・useSearchSlot・NoticeSlot・SearchSlot・belowGroups に SavedViewSlot）・detail-panel.tsx（DueSlot・「日付と時間」の区画に k-f7-due-anchor）・detail-head.tsx（MoreMenuSlot）・ticket-detail.tsx（DelegateBand に slot）・delegate-band.tsx（止まった箱ぜんたい＝RunBox と確認の結果の表を入れた k-check-stack を StoppedHandSlot が包み、ticket・run・delegate・onChanged を渡す）", () => {
  const want: [string, string[]][] = [
    [
      "features/F4/create-ticket/ticket-shell.tsx",
      ["useNoticeSlot(", "useSearchSlot(", "<F7.NoticeSlot", "<F7.SearchSlot", "belowGroups={", "<F7.SavedViewSlot"],
    ],
    ["features/F4/create-ticket/detail-panel.tsx", ["<F7.DueSlot", "k-f7-due-anchor"]],
    ["features/F4/create-ticket/detail-head.tsx", ["<F7.MoreMenuSlot"]],
    ["features/F4/create-ticket/ticket-detail.tsx", ["slot={st}"]],
    ["features/F5/delegate/delegate-band.tsx", ["<F7.StoppedHandSlot", "ticket={slot}", "run={run}", "delegate={{"]],
  ];
  const bad: string[] = [];
  for (const [file, needles] of want) {
    const c = code(src(file));
    for (const n of needles) if (!c.includes(n)) bad.push(`${file} に ${n} が無い`);
  }
  // 止まった箱ぜんたいを包む：StoppedHandSlot の中に k-check-stack（RunBox と CheckTable）が入る（自分で直すのボタン 1 つだけを包まない）
  const band = code(src("features/F5/delegate/delegate-band.tsx"));
  const m = band.match(/<F7\.StoppedHandSlot[\s\S]*?<\/F7\.StoppedHandSlot>/);
  if (!m) bad.push("delegate-band.tsx に <F7.StoppedHandSlot …>…</F7.StoppedHandSlot> が無い");
  else if (!/k-check-stack/.test(m[0]) || !/<RunBox/.test(m[0]) || !/<CheckTable/.test(m[0]))
    bad.push("StoppedHandSlot が止まった箱ぜんたい（k-check-stack・RunBox・CheckTable）を包んでいない");
  // 読み直し onChanged を渡す（包みの開きタグの中＝k-check-stack より前）。K-486 が書き込みの後に呼ぶ
  else if (!/onChanged=\{/.test(m[0].slice(0, m[0].indexOf("k-check-stack"))))
    bad.push("StoppedHandSlot に onChanged（読み直し）を渡していない");
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K599-SL-004 外枠 Shell は新しい任意の props を受ける（渡さなければ今と同じ）：belowGroups・bellExpanded・onSearchOpen・onSearchInput・onSearchClose・onSearchKeyDown・defaultSearching。「準備中」の字を新しく足さない", () => {
  const c = code(src("components/k/shell.tsx"));
  const bad: string[] = [];
  for (const p of [
    "belowGroups",
    "bellExpanded",
    "onSearchOpen",
    "onSearchInput",
    "onSearchClose",
    "onSearchKeyDown",
    "defaultSearching",
  ])
    if (!new RegExp(`\\b${p}\\?:`).test(c)) bad.push(`Shell の props に ${p}?: が無い`);
  // 前からの shell.tsx（注を外したコード）の「準備中」は 9 個（知らせ・項目・自分のメニュー・会社の切り替え・グループの★・グループの行・いまの場所・探す 2）
  if ((c.match(/準備中/g) ?? []).length > 9) bad.push("shell.tsx の「準備中」の字が増えた");
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K599-SL-005 入口に定義がある間は、口を呼ばず・状態を持たず・要素を描かない（中身 children をそのまま返すか null）。区画のファイルからの書き出しだけになったら見ない（区画の中身は各画面の葉の試験が見る）", () => {
  for (const file of Object.keys(COLLECTORS)) {
    const c = code(src(file));
    if (!/export\s+function\b/.test(c)) continue;
    expect(c, `${file} が口や状態を使う`).not.toMatch(/\bfetch\(|lib\/api|useQuery|useState|useEffect/);
    expect(c, `${file} が要素を描く`).not.toMatch(/<(div|span|section|aside|nav|button|a|p|tr|td)\b/);
  }
});

// ---- 本番の画面は今のまま（区画が本物になるまで） ----
//   区画のファイルは `export const READY = false` を持つ。本物にする葉が true にしたら、その区画の「今のまま」の確かめはやめて、READY が true であることだけを見る
//   （本物の動きは、その葉の試験が見る。後ろの葉が K-599 の試験を替えずに済む形）

/** 区画のファイルの READY が true か（本物になったか） */
const ready = (section: (typeof SECTIONS)[number]): boolean =>
  /export const READY\s*(?::\s*boolean\s*)?=\s*true\b/.test(src(`${F7}/${section}.tsx`));

/** 呼んではいけない F7 の口（区画が本物になるまで）。鈴・探す欄は開くまで呼ばないので、読み込みでは見ない */
function forbidden(): RegExp {
  const parts: string[] = [];
  if (!ready("saved/saved-view-slot")) parts.push("saved_views");
  if (!ready("delete/more-menu-slot")) parts.push("delete-preview", "restore");
  return new RegExp(`/api/v1/.*(${parts.join("|") || "$^"})`);
}
function watch(page: Page) {
  const hits: string[] = [];
  const re = forbidden();
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (re.test(u.pathname)) hits.push(`${r.method()} ${u.pathname}`);
  });
  return hits;
}

test("K599-SL-006 全部の区画のファイル（7 個）が `export const READY`（true か false）を持つ（この葉ではどれも false・本物にする葉が true にする）", () => {
  const bad: string[] = [];
  for (const s of SECTIONS) {
    const c = code(src(`${F7}/${s}.tsx`));
    if (!/export const READY\s*(?::\s*boolean\s*)?=\s*(true|false)\b/.test(c)) bad.push(`${s} に READY が無い`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K599-SL-007 前からの型の足し：RunView（use-run.ts）に reason_kind と taken_over_at（どちらも無くてよい・null もある）が在り、止まった箱を出す条件 showRun（delegate-band.tsx）に「taken_over_at が無い」が入っている", () => {
  const run = code(src("features/F5/delegate/use-run.ts"));
  expect(run).toMatch(/\breason_kind\?:\s*string\s*\|\s*null/);
  expect(run).toMatch(/\btaken_over_at\?:\s*string\s*\|\s*null/);
  const band = code(src("features/F5/delegate/delegate-band.tsx"));
  const line = band.split("\n").find((l) => /const showRun\b/.test(l)) ?? "";
  expect(line, "showRun の行が無い").not.toBe("");
  expect(line).toMatch(/taken_over_at/);
});

test("K599-SL-008 グループの行の行き先 groupHref（overview/group-link-slot.tsx）：scopeId を受けて string か null を返す。READY が false のあいだは null（行は押せない形のまま）で、true のときだけ `/tickets?view=overview&scope=` を頭にした行き先を返す形に書いてある（K-480 が READY を true にする）", () => {
  const c = code(src(`${F7}/overview/group-link-slot.tsx`));
  expect(c).toMatch(/export function groupHref\(\s*scopeId:\s*string\s*\):\s*string\s*\|\s*null/);
  expect(c).toMatch(/READY\s*\?/);
  expect(c).toContain("/tickets?view=overview&scope=");
  expect(c, "groupHref が口や状態を使う").not.toMatch(/\bfetch\(|lib\/api|useQuery|useState|useEffect/);
  if (!ready("overview/group-link-slot")) expect(c).toMatch(/:\s*null\b/);
});

test("K599-UI-001 外枠（/tickets・幅 1440）は区画が本物になるまで今のまま：鈴と探す欄が在る（READY が false なら鈴は aria-disabled で押せない・探す欄は打てない）・左のメニューの保存した条件の口を呼ばない。F7 の新しい口を呼ばない", async ({
  page,
}) => {
  const hits = watch(page);
  await mockList(page, { list: () => ({ status: 200, body: { data: items(3), meta: { next_cursor: null } } }) });
  await open(page, "/tickets", 1440);
  const bell = page.locator("header.k-bar .k-bell");
  const search = page.locator('header.k-bar input[name="q"]');
  await expect(bell).toHaveCount(1);
  await expect(search).toHaveCount(1);
  if (!ready("notice/notice-slot")) await expect(bell).toHaveAttribute("aria-disabled", "true");
  if (!ready("search/search-slot")) await expect(search).toBeDisabled();
  expect(hits, hits.join("\n")).toEqual([]);
});

const doing: Band = { stage: "doing", approval: null, can_delegate: true };

test("K599-UI-002 詳細（/tickets/:id・幅 1440）：「期限」の行の「期限を変える」と題名の行の「ほかの操作」が在る。それぞれの区画の READY が false のあいだは押せない形（aria-disabled）・押しても小窓もメニューも開かない。F7 の新しい口を呼ばない", async ({
  page,
}) => {
  const hits = watch(page);
  await mockApi(page, doing);
  await openTicket(page, 1440);
  const due = page.getByRole("button", { name: "期限を変える", exact: true });
  const more = page.getByRole("button", { name: "ほかの操作", exact: true });
  await expect(due).toBeVisible();
  await expect(more).toBeVisible();
  if (!ready("due/due-slot")) {
    await expect(due).toHaveAttribute("aria-disabled", "true");
    await due.click({ force: true });
  }
  if (!ready("delete/more-menu-slot")) {
    await expect(more).toHaveAttribute("aria-disabled", "true");
    await more.click({ force: true });
  }
  if (!ready("due/due-slot") && !ready("delete/more-menu-slot"))
    await expect(page.locator('[role="dialog"], [role="alertdialog"], [role="menu"]')).toHaveCount(0);
  await expect(page.locator("section.k-detail-panel-sec.k-f7-due-anchor")).toHaveAccessibleName("日付と時間");
  expect(hits, hits.join("\n")).toEqual([]);
});

const STOPPED: Band = {
  stage: "doing",
  approval: null,
  can_delegate: true,
  run: { phase: "make", status: "stopped", pc: "live", stopped_reason: "金額が見積の月額と合いませんでした" },
};
const RUNS = /\/api\/v1\/tickets\/[^/]+\/runs$/;
const ONE_RUN = /\/api\/v1\/action_runs\/[^/]+$/;

test("K599-UI-003 止まった帯（AI が止まった詳細・幅 1440）：理由の字が帯に出て、帯のボタンは「自分で直す」だけ（「AI に任せる」「直し方を AI に伝える」は 0 個・answer=d25f2e58bffb）。止まった帯の区画の READY が false のあいだは「自分で直す」は押せない形で、押しても書く口を呼ばず小窓も開かない", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (/\/api\//.test(r.url()) && r.method() !== "GET" && r.method() !== "OPTIONS")
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  const m = await mockApi(page, STOPPED);
  m.on.ticket = () => ({ status: 200, body: { data: withBand(STOPPED, ticketOf(STOPPED)) } });
  await openTicket(page, 1440);
  const band = page.locator("section.k62-band");
  await expect(band).toContainText("金額が見積の月額と合いませんでした");
  await expect(band.getByRole("button", { name: "AI に任せる", exact: true })).toHaveCount(0);
  const self = band.getByRole("button", { name: "自分で直す", exact: true });
  await expect(self).toBeVisible();
  await expect(band.getByRole("button", { name: "直し方を AI に伝える", exact: true })).toHaveCount(0);
  if (!ready("stopped/stopped-hand-slot")) {
    await expect(self).toHaveAttribute("aria-disabled", "true");
    await self.click({ force: true });
    await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0);
    expect(writes, writes.join("\n")).toEqual([]);
  }
});

test("K599-UI-004 引き取った実行（止まっていて taken_over_at がある・reason_kind は何でも）は止まった箱を出さない：region「AI に任せる」には白い箱の「AI に任せる」だけが出る（role=alert の止まった箱・理由の字・直し方・自分で直すは出ない）。taken_over_at が無い同じ実行は止まった箱が出る（UI-003）", async ({
  page,
}) => {
  await mockApi(page, STOPPED);
  const taken = { ...runView(STOPPED)!, reason_kind: "unknown", taken_over_at: "2026-11-20T01:12:00.000Z" };
  await page.route(RUNS, (r) => r.fulfill({ json: { data: [taken], meta: { limit: 50 } } }));
  await page.route(ONE_RUN, (r) => r.fulfill({ json: { data: taken } }));
  await openTicket(page, 1440);
  const band = page.getByRole("region", { name: "AI に任せる" });
  await expect(band.getByRole("button", { name: "AI に任せる", exact: true })).toBeVisible();
  await expect(band.getByRole("alert")).toHaveCount(0);
  await expect(band).not.toContainText("金額が見積の月額と合いませんでした");
  await expect(band.getByRole("button", { name: "自分で直す", exact: true })).toHaveCount(0);
  await expect(band.getByRole("button", { name: "直し方を AI に伝える", exact: true })).toHaveCount(0);
});
