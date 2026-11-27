// K-380「段 7・段 9 共通の、詳細と承認待ちの差し込み口（入れた時点では何も出さない）と、詳細の頭の幅 767 以下の直し」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。
//   差し込み口の名前と形（段 7・段 9 の後ろの画面の葉が読む）：
//     features/F4/create-ticket/detail-slots.ts …… 題名の下の帯の順 BAND_ORDER（承認・実行 → 渡し → 保留・代表の答え ㉓）・譲る先 bandYieldTo・
//                                                   差し込み口に渡す値の形 SlotTicket・帯の順の器 useBandOrder（F5 の帯が出ているかを見張る）
//     features/F6/detail-slots.tsx ……………………… DetailScope・StageSlot・TitleSlot・HoldBandSlot・SectionSlot・PanelTabsSlot・ActualTimeSlot・EstimateSlot・
//                                                   usePrefetchDetail（詳細の本体 DetailBody が useRuns の横で呼ぶ先読みの差し込み口・この葉では何もしない・K-392 が中身）
//     features/F8/handover/detail-slots.tsx ……… DetailScope・AssigneeSlot・HandoverBandSlot・QueueRowSlot
//   どの差し込み口も、この葉では「中身（children）をそのまま返す」か「何も出さない（null）」。だから詳細と承認待ちの見た目と操作は今のまま。
//   題名の下の帯の入れ物 .k-detail-bands は、出ている帯の鍵を data-shown（BAND_ORDER の順・空白区切り・無ければ属性なし）に出す。
//   幅 767 以下の頭の行（開始日・期限・段の札）は 2 列の格子をやめ、横に並べて頭の行を 2 行までにする（代表の直し answer=fabd031f9b37・段7-詳細の頭.md）。
//   口は網の手前で差し替える（前からの土台 tests/features/F5/approve-complete.harness.ts）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { BAND_ORDER, bandYieldTo, type BandKey } from "../../features/F4/create-ticket/detail-slots";
import {
  QUEUE,
  jst,
  mockApi,
  openQueue,
  openTicket,
  pending,
  rowOf,
  ticketOf,
  withBand,
  type Band,
} from "../features/F5/approve-complete.harness";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const src = (rel: string) => readFileSync(join(WEB, rel), "utf8");
const F4 = "features/F4/create-ticket";
const F6_SLOTS = "features/F6/detail-slots.tsx";
const F8_SLOTS = "features/F8/handover/detail-slots.tsx";
/** キャンバスの詳細の形の絵 7 枚（作り手 04_design/canvas_gen/k257.py が書く） */
const BOARDS = ["TicketDetail", "StRunning", "StFailed", "StBefore", "StConfirmDone", "StDone", "StDelegated"] as const;

/** getTicket の答え（前からの土台の ticketOf に、頭の行が読む値を重ねる。実行の一覧は帯 b に結ぶ） */
function answer(b: Band, ticket: Record<string, unknown> = {}, stageName?: string) {
  const base = ticketOf(b) as unknown as Record<string, Record<string, unknown>>;
  return withBand(b, {
    ...base,
    ticket: { ...base["ticket"], start_on: "2026-10-30", created_at: "2026-10-30T08:44:00Z", ...ticket },
    kind: { name: "タスク", color: "#186F69" },
    stage: { key: b.stage, name: stageName ?? b.stage },
  });
}

async function openWith(page: Page, b: Band, width = 1440, ticket: Record<string, unknown> = {}, stageName?: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const m = await mockApi(page, b);
  m.on.ticket = () => ({ status: 200, body: { data: answer(b, ticket, stageName) } });
  await openTicket(page, width);
  await page.evaluate(() => document.fonts.ready);
  return { m, errors };
}

const meta = (page: Page) => page.locator("article.k-detail-card .k-detail-meta");
const part = (page: Page, name: string) => meta(page).locator(`[data-part="${name}"]`);
const bands = (page: Page) => page.locator("article.k-detail-card .k-detail-bands");
const panel = (page: Page) => page.getByRole("complementary", { name: "チケットのパネル" });
const rect = (loc: Locator) =>
  loc.first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  });
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** 宣言だけを見る（注を外す） */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** 書き出す名前（export function・export const・export { … } from のどれでも。K-382 が区画のファイルからの書き出しに替えても同じ名前を数える） */
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
      .filter(Boolean),
  );
  return [...direct, ...re].sort();
};

// ---- ファイルを読む（ブラウザ不要） ----

test("K380-SL-001 題名の下の帯の順は 1 か所（detail-slots.ts の BAND_ORDER）で ['approve','handover','hold']（承認・実行 → 渡し → 保留・代表の答え ㉓）。bandYieldTo は自分より前の出ている帯を返し、無ければ null", () => {
  expect([...BAND_ORDER]).toEqual(["approve", "handover", "hold"]);
  const set = (...k: BandKey[]) => new Set<BandKey>(k);
  expect(bandYieldTo("hold", set())).toBeNull();
  expect(bandYieldTo("hold", set("hold"))).toBeNull();
  expect(bandYieldTo("hold", set("handover", "hold"))).toBe("handover");
  expect(bandYieldTo("hold", set("approve", "handover", "hold"))).toBe("approve");
  expect(bandYieldTo("handover", set("hold"))).toBeNull();
  expect(bandYieldTo("handover", set("approve"))).toBe("approve");
  expect(bandYieldTo("approve", set("handover", "hold"))).toBeNull();
});

test("K380-SL-002 差し込み口の先の 2 つのファイル：F6 は DetailScope・StageSlot・TitleSlot・HoldBandSlot・SectionSlot・PanelTabsSlot・ActualTimeSlot・EstimateSlot・usePrefetchDetail の 9 つ、F8 は DetailScope・AssigneeSlot・HandoverBandSlot・QueueRowSlot をちょうど書き出す（export { … } from でもよい）。ファイルの中に定義が在れば、口を呼ばず要素も描かない（中身をそのまま返すか null）", () => {
  const f6 = src(F6_SLOTS);
  const f8 = src(F8_SLOTS);
  expect(exportsOf(f6)).toEqual(
    [
      "ActualTimeSlot",
      "DetailScope",
      "EstimateSlot",
      "HoldBandSlot",
      "PanelTabsSlot",
      "SectionSlot",
      "StageSlot",
      "TitleSlot",
      "usePrefetchDetail",
    ].sort(),
  );
  expect(exportsOf(f8)).toEqual(["AssigneeSlot", "DetailScope", "HandoverBandSlot", "QueueRowSlot"].sort());
  for (const [name, s] of [
    [F6_SLOTS, f6],
    [F8_SLOTS, f8],
  ] as const) {
    const c = code(s);
    // 区画のファイルからの書き出しだけ（K-382 の後）なら中身はここに無い：区画のファイルは K382-SL-001 と各画面の葉の試験が見る
    if (!/export\s+function\b/.test(c)) continue;
    expect(c, `${name} が口や見張りを使う`).not.toMatch(
      /\bfetch\(|lib\/api|useEffect|useQuery|useState|from "@\/lib\/auth/,
    );
    expect(c, `${name} が要素を描く`).not.toMatch(/<(div|span|section|aside|nav|button|a|p|tr|td)\b/);
    expect(c, `${name} が中身を返さない`).toMatch(/children/);
  }
});

test("K380-SL-003 差し込み口は前からのファイルに入っている：ticket-detail.tsx の DetailBody に先読みの F6.usePrefetchDetail、ticket-detail.tsx に F6.DetailScope・F8.DetailScope・F6.StageSlot・F6.TitleSlot・F8.HandoverBandSlot・F6.HoldBandSlot・F6.SectionSlot、detail-panel.tsx に F6.PanelTabsSlot・F6.EstimateSlot・F6.ActualTimeSlot・F8.AssigneeSlot、queue-table.tsx に F8.QueueRowSlot、detail-head.tsx の頭の行は段の札の差し込み口 stageSlot を受ける", () => {
  const want: [string, string[]][] = [
    [
      `${F4}/ticket-detail.tsx`,
      ["F6.DetailScope", "F8.DetailScope", "F6.StageSlot", "F6.TitleSlot", "F8.HandoverBandSlot", "F6.HoldBandSlot"],
    ],
    // 本文の場所と区画は K-571 が detail-body.tsx に切り出した（ticket-detail.tsx が DetailBodyArea で呼ぶ）
    [`${F4}/detail-body.tsx`, ["F6.SectionSlot"]],
    [`${F4}/detail-panel.tsx`, ["F6.PanelTabsSlot", "F6.EstimateSlot", "F6.ActualTimeSlot", "F8.AssigneeSlot"]],
    ["features/F5/approve-complete/queue-table.tsx", ["F8.QueueRowSlot"]],
  ];
  const bad: string[] = [];
  for (const [file, names] of want) {
    const c = code(src(file));
    for (const n of names) if (!c.includes(`<${n}`)) bad.push(`${file} に <${n} が無い`);
  }
  const detail = code(src(`${F4}/ticket-detail.tsx`));
  const body = detail.slice(detail.indexOf("function DetailBody"), detail.indexOf("function DetailView"));
  if (!/F6\.usePrefetchDetail\(\s*id\s*,/.test(body))
    bad.push("ticket-detail.tsx の DetailBody に F6.usePrefetchDetail(id, …) が無い（詳細の答えを待たない先読み）");
  const head = code(src(`${F4}/detail-head.tsx`));
  if (!/stageSlot\??\s*:/.test(head)) bad.push("detail-head.tsx の DetailMeta が stageSlot を受けない");
  if (!/export function StagePill\b/.test(head)) bad.push("detail-head.tsx が StagePill（今の段の札）を書き出さない");
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K380-SL-004 帯の並びは ticket-detail.tsx の .k-detail-bands の中で ApproveBand → DelegateBand → F8.HandoverBandSlot → F6.HoldBandSlot の順（BAND_ORDER と同じ順・帯の入れ物は 1 つ）", () => {
  const c = code(src(`${F4}/ticket-detail.tsx`));
  const start = c.indexOf('className="k-detail-bands"');
  expect(start, ".k-detail-bands が無い").toBeGreaterThan(-1);
  expect(c.indexOf('className="k-detail-bands"', start + 1), ".k-detail-bands が 2 つある").toBe(-1);
  const at = ["<ApproveBand", "<DelegateBand", "<F8.HandoverBandSlot", "<F6.HoldBandSlot"].map((n) =>
    c.indexOf(n, start),
  );
  expect(
    at.every((i) => i > start),
    `帯の入れ物の後に 4 つがそろわない：${at.join(",")}`,
  ).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
});

test("K380-CS-001 ticket-detail.css：幅 767 以下の .k-detail-meta-side は横に並べて折り返す（display: flex・flex-wrap: wrap・margin-left: 0・gap は縦横とも var(--k-s-xs)＝2 桁の日数でも幅 375 で 1 行に収める）。2 列の格子（grid-template-columns: max-content max-content）はどこにも無い", () => {
  const css = code(src(`${F4}/ticket-detail.css`));
  expect(css).not.toMatch(/grid-template-columns:\s*max-content\s+max-content/);
  const mq = css.slice(css.indexOf("@media (max-width: 767px)"));
  const rule = mq.match(/\.k-detail-meta-side\s*\{([^}]*)\}/);
  expect(rule, "767 以下の .k-detail-meta-side の規則が無い").not.toBeNull();
  const body = rule![1]!;
  expect(body).toMatch(/display:\s*flex/);
  expect(body).toMatch(/flex-wrap:\s*wrap/);
  expect(body).toMatch(/margin-left:\s*0/);
  // gap の系統（gap・row-gap・column-gap）の宣言はちょうど 1 つで、縦横とも var(--k-s-xs)（上書き・折り返しも落とす）
  const gaps = [...body.matchAll(/(?:^|;)\s*((?:row-|column-)?gap)\s*:\s*([^;]*)/g)].map(
    (m) => `${m[1]}: ${m[2]!.trim()}`,
  );
  expect(gaps).toEqual(["gap: var(--k-s-xs)"]);
});

test("K380-CV-001 キャンバスの詳細の形の絵 7 枚と作り手 k257.py：幅 767 以下の頭の行の右（開始日・期限・札）は横に並べる決まり（display:flex !important;flex-wrap:wrap）で、2 列の格子の決まりは無い", () => {
  const gen = readFileSync(join(ROOT, "04_design/canvas_gen/k257.py"), "utf8");
  expect(gen).not.toMatch(/grid-template-columns:max-content max-content/);
  expect(gen).toMatch(/margin-left: auto\\"\]\{display:flex !important;flex-wrap:wrap/);
  const bad: string[] = [];
  for (const b of BOARDS) {
    const html = readFileSync(join(ROOT, `04_design/canvas/${b}.dc.html`), "utf8");
    if (/grid-template-columns:max-content max-content/.test(html)) bad.push(`${b} に 2 列の格子が残る`);
    if (!/span\[style\*="margin-left: auto"\]\{display:flex !important;flex-wrap:wrap/.test(html))
      bad.push(`${b} に横に並べる決まりが無い`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

// ---- 実ブラウザ：差し込み口を入れても詳細と承認待ちは今のまま ----

test("K380-UI-001 幅 1440・作業中（帯なし）：頭の行・題名・パネルのタブ・属性・区画が今のまま（段の札「作業中」・タブ 属性／やり取り／高本のAI・担当者「高本」・予定と実績は空・区画 3 つ）。帯の入れ物は空で data-shown が無い・描き直しの誤り 0", async ({
  page,
}) => {
  const { errors } = await openWith(page, { stage: "doing" }, 1440, {}, "作業中");
  await expect(part(page, "stage")).toHaveText("作業中");
  await expect(part(page, "start")).toContainText("開始日 10/30");
  const tabs = panel(page).getByRole("navigation", { name: "パネルのタブ" });
  await expect(tabs.getByRole("button")).toHaveText(["項目", "やり取り", "高本のAI"]);
  // やり取りが押せるかは見ない（K-392 で押せる形になった。押せることは K226-UI-008 が見る）
  const field = (k: string) =>
    panel(page)
      .locator(".k-detail-field")
      .filter({ has: page.locator(`dt:text-is("${k}")`) });
  await expect(field("担当者").locator("dd .k-detail-who")).toContainText("高本");
  await expect(field("予定時間").locator("dd")).toHaveText("");
  await expect(field("実績時間").locator("dd")).toHaveText("");
  // 本文は 1 枚の読む形（K-571・K-577）：区画（section.k-section）の並びではなく、本文の字がそのまま出る
  await expect(page.locator("article.k-detail-card .k-detail-doc")).toContainText("月末の請求を出す");
  await expect(page.locator("article.k-detail-card .k-detail-doc > section.k-section")).toHaveCount(0);
  await expect(bands(page)).toHaveCount(1);
  expect(await bands(page).evaluate((e) => e.childElementCount)).toBe(0);
  await expect(bands(page)).not.toHaveAttribute("data-shown", /.*/);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K380-UI-002 幅 1440・承認待ち（承認する人）：帯の入れ物の中は「承認と実行」の帯 1 つだけで、data-shown は approve", async ({
  page,
}) => {
  await openWith(page, { stage: "awaiting_approval", approval: pending() }, 1440, {}, "承認待ち");
  await expect(page.getByRole("region", { name: "承認と実行" })).toBeVisible();
  await expect(bands(page).locator(":scope > *")).toHaveCount(1);
  await expect(bands(page)).toHaveAttribute("data-shown", "approve");
});

test("K380-UI-003 幅 1440・作業中で AI に任せられる：帯の入れ物の中は「AI に任せる」の帯 1 つだけで、data-shown は無い（任せる前の箱は approve に数えない・渡しと保留の帯に譲らせない・K-620）", async ({
  page,
}) => {
  await openWith(page, { stage: "doing", can_delegate: true }, 1440, {}, "作業中");
  await expect(page.getByRole("region", { name: "AI に任せる" })).toBeVisible();
  await expect(bands(page).locator(":scope > *")).toHaveCount(1);
  await expect(bands(page)).not.toHaveAttribute("data-shown", /.*/);
});

test("K380-UI-004 承認待ちの一覧（幅 1440）：行は今のまま（3 行・題名の並び・1 行目は「承認する」・ほかは「中身を見る」・どの行も「差し戻す」）", async ({
  page,
}) => {
  await mockApi(page);
  await openQueue(page);
  const titles = QUEUE().map((r) => r.title);
  const rows = page.getByRole("table").locator("tbody tr:not(.k-ap-group)");
  await expect(rows).toHaveCount(3);
  await expect(rows.locator(".k-ap-title > a")).toHaveText(titles);
  await expect(rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true })).toBeVisible();
  for (const t of titles.slice(1))
    await expect(rowOf(page, t).getByRole("link", { name: "中身を見る", exact: true })).toBeVisible();
  for (const t of titles)
    await expect(rowOf(page, t).getByRole("button", { name: "差し戻す", exact: true })).toBeVisible();
});

test("K380-UI-005 幅 375：頭の行は 2 行まで。1 行目に種別・番号・作成、2 行目に開始日・期限・段の札が横に並び（上の端がそろう）、2 行目は左に寄る。横溢れ 0", async ({
  page,
}) => {
  await openWith(page, { stage: "doing" }, 375, {}, "作業中");
  const side = meta(page).locator(".k-detail-meta-side");
  expect(await side.evaluate((e) => getComputedStyle(e).display)).toBe("flex");
  expect(await side.evaluate((e) => getComputedStyle(e).flexWrap)).toBe("wrap");
  const [kind, start, due, stage] = await Promise.all(
    ["kind", "start", "due", "stage"].map((n) => rect(part(page, n))),
  );
  expect(Math.abs(start!.top - due!.top), "開始日と期限の上の端").toBeLessThanOrEqual(2);
  expect(Math.abs(due!.top - stage!.top), "期限と段の札の上の端").toBeLessThanOrEqual(4);
  expect(start!.top, "2 行目は 1 行目の下").toBeGreaterThanOrEqual(kind!.bottom - 1);
  expect(Math.abs(start!.left - kind!.left), "2 行目は左に寄る").toBeLessThanOrEqual(1);
  expect(await overflowX(page)).toBe(0);
});

test("K380-UI-006 幅 375 で長い字（段の札「承認待ち」・期限「（12 日過ぎ）」）でも 2 行目の 3 つは横に並ぶ。幅 320 は折り返してよいが横溢れ 0 で、頭の行の右は頭の行の箱の中", async ({
  page,
}) => {
  const b: Band = { stage: "awaiting_approval", approval: pending() };
  await openWith(page, b, 375, { due_on: jst(-12) }, "承認待ち");
  await expect(part(page, "due")).toContainText("（12 日過ぎ）");
  const [start, due, stage] = await Promise.all(["start", "due", "stage"].map((n) => rect(part(page, n))));
  expect(Math.abs(start!.top - due!.top)).toBeLessThanOrEqual(2);
  expect(Math.abs(due!.top - stage!.top)).toBeLessThanOrEqual(4);
  expect(await overflowX(page)).toBe(0);
  await page.setViewportSize({ width: 320, height: 1000 });
  await expect(part(page, "stage")).toBeVisible();
  expect(await overflowX(page)).toBe(0);
  const box = await rect(meta(page));
  const side = await rect(meta(page).locator(".k-detail-meta-side"));
  expect(side.right).toBeLessThanOrEqual(box.right + 1);
});

test("K380-UI-007 幅 768・1440：頭の行は今のまま（開始日・期限・段の札は 1 行で右に寄る＝段の札の右の端が頭の行の中身の右の端）", async ({
  page,
}) => {
  await openWith(page, { stage: "doing" }, 1440, {}, "作業中");
  for (const w of [1440, 768]) {
    await page.setViewportSize({ width: w, height: 1000 });
    await expect(part(page, "stage")).toBeVisible();
    const m = meta(page);
    const inner = await m.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return r.right - Number.parseFloat(getComputedStyle(e).paddingRight);
    });
    const [start, stage] = await Promise.all(["start", "stage"].map((n) => rect(part(page, n))));
    expect(Math.abs(stage!.right - inner), `幅 ${w}：段の札が右に寄らない`).toBeLessThanOrEqual(1);
    expect(Math.abs(start!.top - stage!.top), `幅 ${w}：1 行でない`).toBeLessThanOrEqual(4);
    expect(await overflowX(page)).toBe(0);
  }
});
