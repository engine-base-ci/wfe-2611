// K-600「段 8 の一覧の差し込み口（見え方のタブ・期限の印・数の札と絞りの札・URL の絞りの組 extra と数 counts）を、入れた時点では何も出さずに足す」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。外枠と詳細の差し込み口は K-599（試験は k599-f7-slots.spec.ts）。
//   差し込み口の名前と形（後ろの画面の葉 K-478・K-480・K-481・K-482 が読む）：
//     features/F7/list-slots.tsx …… OverviewSlot・CalendarSlot・GanttSlot・viewReady（見え方）・DueMarkSlot（表の期限セルの印）・NumberCardsSlot・MineChipsSlot（自分に関わるもの）
//   入口は区画のファイル（features/F7/<区画>/…-slot.tsx）からの書き出しだけ。後ろの葉は自分の区画のファイルだけを直す。
//   どの差し込み口も、この葉では「中身（children＝今の要素）をそのまま返すか、何も出さない」。だから本番の一覧の見た目と操作は今のまま。
//   見え方のタブは viewReady（区画の READY）が true になるまで、今と同じ押せない形のまま。?view=overview|calendar|gantt は今は ?view=mine と同じ。
//   一覧の口の絞りの組 extra（URL の問い合わせから読み、listTickets にそのまま足す）と数 counts（答えの meta.counts）は、この葉で配線だけを入れる（札・絞りの行はまだ描かない）。
//   「今のまま」を確かめる行（UI）は、後ろの葉が区画を本物にしても崩れない形にした（見え方のタブ・数の札・絞りの札を押せる形に変える葉が自分の試験で見る）：
//   見るのは「F7 の新しい口（概要の口）を呼ばない」と「前からの物が残っている」だけ。
//   口は網の手前で差し替える（一覧は tests/k/list-mock.ts）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { SALES, items, mockList, open, rowsOf, views, type Reply } from "./list-mock";

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
const ENTRY = `${F7}/list-slots.tsx`;
const NAMES = [
  "CalendarSlot",
  "DueMarkSlot",
  "GanttSlot",
  "MineChipsSlot",
  "NumberCardsSlot",
  "OverviewSlot",
  "viewReady",
] as const;
/** 区画のファイル（後ろの葉が自分のファイルだけを直す）。入口の書き出し元 */
const SECTIONS = [
  "overview/overview-slot",
  "calendar/calendar-slot",
  "gantt/gantt-slot",
  "due/due-mark-slot",
  "due/number-cards-slot",
  "due/mine-chips-slot",
] as const;

// ---- ファイルを読む（ブラウザ不要） ----

test("K600-SL-001 差し込み口の入口 list-slots.tsx（7）が、決めた名前をちょうど書き出す（export function でも export { … } from でもよい）。区画のファイルからの書き出しがある", () => {
  const s = src(ENTRY);
  expect(exportsOf(s)).toEqual([...NAMES].sort());
  expect(s, "list-slots.tsx が区画のファイルを読まない").toMatch(/from "\.\/[a-z]+\/[a-z-]+-slot"/);
});

test("K600-SL-002 区画のファイル 6 個が在り、入口がそのファイルを読む（読まれないファイルが無い）。区画のファイルは口を呼ぶ部品を直に import しない形にはまだ縛らない（後ろの葉が本物にする）", () => {
  const entry = src(ENTRY);
  const bad: string[] = [];
  for (const s of SECTIONS) {
    try {
      readFileSync(join(WEB, F7, `${s}.tsx`), "utf8");
    } catch {
      bad.push(`${F7}/${s}.tsx が無い`);
      continue;
    }
    if (!entry.includes(`from "./${s}"`)) bad.push(`入口が ${s} を読まない`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K600-SL-003 差し込み口は前からのファイルに入っている：list-table.tsx（DueMarkSlot）・list-page.tsx（NumberCardsSlot・MineChipsSlot・OverviewSlot・CalendarSlot・GanttSlot）・list-views.tsx（viewReady）・use-ticket-list.ts（ListView に overview・calendar・gantt）・tickets-page.tsx（?view= の読みに viewReady）", () => {
  const want: [string, string[]][] = [
    ["features/F4/ticket-list/list-table.tsx", ["<F7.DueMarkSlot"]],
    [
      "features/F4/ticket-list/list-page.tsx",
      ["<F7.NumberCardsSlot", "<F7.MineChipsSlot", "<F7.OverviewSlot", "<F7.CalendarSlot", "<F7.GanttSlot"],
    ],
    ["features/F4/ticket-list/list-views.tsx", ["viewReady("]],
    ["features/F4/create-ticket/tickets-page.tsx", ["viewReady("]],
  ];
  const bad: string[] = [];
  for (const [file, needles] of want) {
    const c = code(src(file));
    for (const n of needles) if (!c.includes(n)) bad.push(`${file} に ${n} が無い`);
  }
  const hook = code(src("features/F4/ticket-list/use-ticket-list.ts"));
  if (!/export type ListView = "mine" \| "all" \| "overview" \| "calendar" \| "gantt"/.test(hook))
    bad.push('use-ticket-list.ts の ListView が "mine" | "all" | "overview" | "calendar" | "gantt" でない');
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K600-SL-004 入口に定義がある間は、口を呼ばず・状態を持たず・要素を描かない（中身 children をそのまま返すか null）。区画のファイルからの書き出しだけになったら見ない（区画の中身は各画面の葉の試験が見る）", () => {
  const c = code(src(ENTRY));
  if (!/export\s+function\b/.test(c)) return;
  expect(c, "list-slots.tsx が口や状態を使う").not.toMatch(/\bfetch\(|lib\/api|useQuery|useState|useEffect/);
  expect(c, "list-slots.tsx が要素を描く").not.toMatch(/<(div|span|section|aside|nav|button|a|p|tr|td)\b/);
});

// ---- 本番の画面は今のまま（区画が本物になるまで） ----
//   区画のファイルは `export const READY = false` を持つ。本物にする葉が true にしたら、その区画の「今のまま」の確かめはやめて、READY が true であることだけを見る
//   （本物の動きは、その葉の試験が見る。後ろの葉が K-600 の試験を替えずに済む形）

/** 区画のファイルの READY が true か（本物になったか） */
const ready = (section: (typeof SECTIONS)[number]): boolean =>
  /export const READY\s*(?::\s*boolean\s*)?=\s*true\b/.test(src(`${F7}/${section}.tsx`));

/** 呼んではいけない F7 の口（区画が本物になるまで）。概要の口だけ。札の数は一覧の答えの meta.counts なので口は増えない */
function forbidden(): RegExp {
  const parts: string[] = [];
  if (!ready("overview/overview-slot")) parts.push("scopes\\/[^/]+\\/overview");
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

test("K600-SL-005 全部の区画のファイル（6 個）が `export const READY`（true か false）を持つ（この葉ではどれも false・本物にする葉が true にする）。viewReady は概要・カレンダー・ガントの READY を読む", () => {
  const bad: string[] = [];
  for (const s of SECTIONS) {
    const c = code(src(`${F7}/${s}.tsx`));
    if (!/export const READY\s*(?::\s*boolean\s*)?=\s*(true|false)\b/.test(c)) bad.push(`${s} に READY が無い`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
  const view = code(src(`${F7}/overview/overview-slot.tsx`));
  expect(view).toMatch(/export function viewReady\b/);
  for (const f of ["overview/overview-slot", "calendar/calendar-slot", "gantt/gantt-slot"])
    expect(view + code(src(`${F7}/${f}.tsx`)), f).toContain("READY");
});

test("K600-SL-006 一覧の絞りの組と数：use-ticket-list.ts は filter に extra（listTickets の問い合わせにそのまま足す欄の組）を受け、返り値に counts（答えの meta.counts か null）を持つ。list-page.tsx は URL の問い合わせから extra を読み、NumberCardsSlot・MineChipsSlot に extra・onExtra・counts を渡し（MineChipsSlot には rows も）、概要・カレンダー・ガントのときは useTicketList を読まない（enabled を偽にする）", () => {
  const hook = code(src("features/F4/ticket-list/use-ticket-list.ts"));
  const page = code(src("features/F4/ticket-list/list-page.tsx"));
  const bad: string[] = [];
  if (!/\bextra\?:\s*Readonly<Record<string,\s*string>>/.test(hook))
    bad.push("use-ticket-list.ts の filter に extra?: Readonly<Record<string, string>> が無い");
  if (!/\bcounts\b/.test(hook)) bad.push("use-ticket-list.ts の返り値に counts が無い");
  if (!/meta\??\.counts/.test(hook)) bad.push("use-ticket-list.ts が答えの meta.counts を読まない");
  for (const n of ["extra=", "onExtra=", "counts="])
    if (!page.includes(n)) bad.push(`list-page.tsx の差し込み口に ${n} を渡していない`);
  if (!/<F7\.MineChipsSlot[^>]*\brows=/.test(page)) bad.push("MineChipsSlot に rows を渡していない");
  if (!/useTicketList\([^)]*enabled/.test(page) && !/enabled:\s*[^,}]*(overview|calendar|gantt)/.test(page))
    bad.push("概要・カレンダー・ガントのとき useTicketList を読まない形（enabled）が無い");
  expect(bad, bad.join("\n")).toEqual([]);
});

test('K600-SL-007 グループを選んだときの見え方：list-page.tsx の listView の式は、overview・calendar・gantt の見え方を scope があっても残す形を持つ（`scope !== null ? "all" : view` だけを残さない）。place・ListHead の view は listView から作る。list-views.tsx のタブのリンクが scope を足せる', () => {
  const page = code(src("features/F4/ticket-list/list-page.tsx"));
  const line = page.split("\n").find((l) => /const listView\b/.test(l)) ?? "";
  expect(line, "listView の行が無い").not.toBe("");
  expect(line, "listView が scope だけで all に決まる").toMatch(/overview|calendar|gantt|viewReady|isViewTab/);
  expect(page, "place が listView から作られていない").toMatch(/const place\s*=\s*`\$\{listView\}/);
  expect(page, "ListHead に listView を渡していない").toMatch(/<ListHead[^>]*view=\{listView\}/);
  expect(code(src("features/F4/ticket-list/list-views.tsx")), "タブのリンクに scope が無い").toMatch(/scope/);
});

const VIEWS = [
  ["概要", "overview", "overview/overview-slot"],
  ["カレンダー", "calendar", "calendar/calendar-slot"],
  ["ガント", "gantt", "gantt/gantt-slot"],
] as const;

const listOk = (data: unknown[], meta: Record<string, unknown> = { next_cursor: null }): Reply => ({
  status: 200,
  body: { data, meta },
});

test("K600-UI-001 自分に関わるもの（/tickets・幅 1440）は区画が本物になるまで今のまま：見え方のタブ 5 つ（概要・カレンダー・ガントは READY が false なら押せない形＝aria-disabled でリンクでない・true ならリンク）・今いるのは「自分に関わるもの」・数の札の組（4 つ）・絞りの札 5 つ（READY が false のとき）。F7 の新しい口を呼ばない", async ({
  page,
}) => {
  const hits = watch(page);
  await mockList(page, { list: () => listOk(items(3)) });
  await open(page, "/tickets", 1440);
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(views(page).locator(".k-list-view")).toHaveCount(5);
  for (const [name, , sec] of VIEWS) {
    const t = views(page).getByText(name, { exact: true });
    if (ready(sec)) {
      expect(await t.evaluate((e) => e.tagName), name).toBe("A");
      continue;
    }
    await expect(t, name).toHaveAttribute("aria-disabled", "true");
    expect(await t.evaluate((e) => e.tagName), name).not.toBe("A");
  }
  await expect(views(page).locator('[aria-current="page"]')).toHaveText("自分に関わるもの");
  await expect(page.getByRole("group", { name: "数の札" }).locator(":scope > *, :scope > * > *")).not.toHaveCount(0);
  if (!ready("due/number-cards-slot"))
    await expect(page.getByRole("group", { name: "数の札" }).locator(".k-list-card")).toHaveCount(4);
  if (!ready("due/mine-chips-slot"))
    await expect(page.getByRole("group", { name: "自分に関わるものの絞り込み" }).locator("[data-chip]")).toHaveCount(5);
  expect(hits, hits.join("\n")).toEqual([]);
});

test("K600-UI-002 ?view=overview・?view=calendar・?view=gantt は、その区画の READY が false のあいだ ?view=mine と同じ（今いるのは「自分に関わるもの」・表が出る・F7 の新しい口を呼ばない）。true の区画は見ない（READY が true であることだけ）", async ({
  page,
}) => {
  const hits = watch(page);
  await mockList(page, { list: () => listOk(items(3)) });
  for (const [, v, sec] of VIEWS) {
    if (ready(sec)) {
      expect(src(`${F7}/${sec}.tsx`)).toMatch(/READY\s*(?::\s*boolean\s*)?=\s*true/);
      continue;
    }
    await open(page, `/tickets?view=${v}`, 1440);
    await expect(rowsOf(page), v).toHaveCount(3);
    await expect(views(page).locator('[aria-current="page"]'), v).toHaveText("自分に関わるもの");
  }
  expect(hits, hits.join("\n")).toEqual([]);
});

test("K600-UI-006 グループを選んだ見え方（?view=overview・calendar・gantt&scope=<id>）：その区画の READY が false のあいだは今のまま＝グループの一覧（表が出る・今いるのは「一覧」・一覧の口の問い合わせは view=all と scope_id・概要の口を呼ばない）。true の区画は見ない（その葉の試験が見る）", async ({
  page,
}) => {
  const hits = watch(page);
  const m = await mockList(page, { list: () => listOk(items(3)) });
  for (const [, v, sec] of VIEWS) {
    if (ready(sec)) continue;
    await open(page, `/tickets?view=${v}&scope=${SALES}`, 1440);
    await expect(rowsOf(page), v).toHaveCount(3);
    await expect(views(page).locator('[aria-current="page"]'), v).toHaveText("一覧");
    const last = m.listCalls[m.listCalls.length - 1]!;
    expect(last.get("view"), v).toBe("all");
    expect(last.get("scope_id"), v).toBe(SALES);
  }
  expect(hits, hits.join("\n")).toEqual([]);
});

test("K600-UI-007 グループだけの URL（?scope=<id>・view 無し）は今のまま：グループの一覧（表が出る・今いるのは「一覧」・口の問い合わせは view=all と scope_id）", async ({
  page,
}) => {
  const m = await mockList(page, { list: () => listOk(items(3)) });
  await open(page, `/tickets?scope=${SALES}`, 1440);
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(views(page).locator('[aria-current="page"]')).toHaveText("一覧");
  const last = m.listCalls[m.listCalls.length - 1]!;
  expect(last.get("view")).toBe("all");
  expect(last.get("scope_id")).toBe(SALES);
});

test("K600-UI-003 表の期限セル（/tickets?view=all・期限切れの行）：期限切れの炎（読み上げ「期限切れ」）がちょうど 1 つ出る（差し込み口が印を二重に描かない。期限の印の区画が本物になっても炎は 1 つ）", async ({
  page,
}) => {
  await mockList(page, {
    list: () => listOk([...items(2), { ...items(1, 3)[0], due_on: "2026-11-01", overdue: true }]),
  });
  await open(page, "/tickets?view=all", 1440);
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(page.getByRole("img", { name: "期限切れ", exact: true })).toHaveCount(1);
});

test("K600-UI-004 URL の絞りの組は一覧の口の問い合わせにそのまま足される：/tickets?view=all&overdue=true&sort=due_on で listTickets の問い合わせに view=all・overdue=true・sort=due_on が付き、読みは 1 回（二重に読まない）。欄の無い /tickets?view=all では overdue・sort を付けない", async ({
  page,
}) => {
  const m = await mockList(page, { list: () => listOk(items(3)) });
  await open(page, "/tickets?view=all&overdue=true&sort=due_on", 1440);
  await expect(rowsOf(page)).toHaveCount(3);
  expect(m.listCalls, "一覧の口を読んだ回数").toHaveLength(1);
  expect(Object.fromEntries(m.listCalls[0]!)).toMatchObject({ view: "all", overdue: "true", sort: "due_on" });
  await open(page, "/tickets?view=all", 1440);
  await expect(rowsOf(page)).toHaveCount(3);
  const last = m.listCalls[m.listCalls.length - 1]!;
  expect(last.get("overdue")).toBeNull();
  expect(last.get("sort")).toBeNull();
});

test("K600-UI-005 数 counts を読む：自分に関わるものの 1 回目の答えに meta.counts があっても画面は今のまま（数の札は今の 4 つ・値を勝手に変えない）。meta.counts が無い答え（view=all）でも表は出る（壊れない）", async ({
  page,
}) => {
  const counts = { overdue: 2, today: 3, assigned: 11, ai: 5, approve: 2 };
  await mockList(page, {
    list: (q) => (q.get("view") === "all" ? listOk(items(2)) : listOk(items(3), { next_cursor: null, counts })),
  });
  await open(page, "/tickets", 1440);
  await expect(rowsOf(page)).toHaveCount(3);
  if (!ready("due/number-cards-slot"))
    await expect(page.getByRole("group", { name: "数の札" }).locator(".k-list-card")).toHaveCount(4);
  await open(page, "/tickets?view=all", 1440);
  await expect(rowsOf(page)).toHaveCount(2);
});
