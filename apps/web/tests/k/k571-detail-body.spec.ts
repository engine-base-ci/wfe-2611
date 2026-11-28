// K-571「詳細：本文を読む形・結果の場所・右のパネルの項目」の画面の試験（実 Chrome）。行 ID は 11_tickets/K-571.md の行の表（K571-UI-001〜028）。
//   正の絵：下絵 v2 /dev/mock/f4v2/f4v2-detail-new・f4v2-detail-worked（部品 features/F4/doc/detail-views.tsx・views.tsx）。
//   口は網の手前で差し替える：tests/k/detail-body-mock.ts の mockDetail（K-560 の答え）。会社の項目の保存は K-569・確認項目は K-450 の口。
//   前の形（区画の並び）の答えも読めること（K-575 まで）。固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  COMPANY,
  EMPTY,
  GHOST,
  H2,
  P,
  RESULTS,
  TID,
  WIDTHS,
  answer,
  bodyRegion,
  doc,
  MOCK_BODY,
  mockDetail,
  openDetail,
  overflowX,
  panel,
} from "./detail-body-mock";
import { matchMock } from "./stage2-match";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const F4 = join(ROOT, "apps/web/features/F4/create-ticket");
const src = (f: string): string => readFileSync(join(F4, f), "utf8").replace(/\/\/[^\n]*/g, "");
const EDITOR_CHUNK = /prosemirror-(state|view|model)|@tiptap\/core/i;
const field = (page: Page, k: string) =>
  panel(page)
    .locator(".k-detail-field")
    .filter({ has: page.locator(`dt:text-is("${k}")`) });

test("K571-UI-001 並び：頭の行 → 題の行 → 題の下の帯の入れ物 → 本文 → 結果の場所（出ているときだけ）→ 子チケット・つながり。右にパネル。区画の見出し（目的など）の h2 の並び・本文の道具の帯・本文の目次が無い", async ({
  page,
}) => {
  await mockDetail(page, { results: RESULTS });
  await openDetail(page);
  const y = async (loc: ReturnType<Page["locator"]>) => (await loc.first().boundingBox())!.y;
  const ys = [
    await y(page.locator(".k-detail-meta")),
    await y(page.getByRole("heading", { level: 1 })),
    await y(bodyRegion(page)),
    await y(page.getByRole("region", { name: "成果物" })),
    await y(page.getByRole("region", { name: "子チケット・つながり" })),
  ];
  expect(ys, "上から下の順").toEqual([...ys].sort((a, b) => a - b));
  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole("toolbar", { name: "本文の道具" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "本文の目次" })).toHaveCount(0);
  await expect(page.locator("article.k-detail-card .k-detail-doc > section.k-section")).toHaveCount(0);
});

test("K571-UI-002 本文を読む形で出す：見出し・段落・チェックの箱（済みと未）・表（見出しの行つき）が文書どおり。編集の部品（prosemirror・@tiptap）を読み込まず、HTML の字は字のまま動かない", async ({
  page,
}) => {
  const scripts: Promise<string>[] = [];
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") scripts.push(r.text().catch(() => ""));
  });
  const evil = '<img src=x onerror="window.__k571 = 1">';
  await mockDetail(page, {
    body: { doc: doc(H2("目的"), P("セイコー商事に請求を届ける"), P(evil)), text: "x", version: 1 },
  });
  await openDetail(page);
  const body = bodyRegion(page);
  await expect(body.getByRole("heading", { level: 2, name: "目的" })).toBeVisible();
  await expect(body).toContainText(evil);
  expect(await page.evaluate(() => (window as unknown as { __k571?: number }).__k571)).toBeUndefined();
  await page.waitForLoadState("networkidle");
  expect(
    (await Promise.all(scripts)).some((s) => EDITOR_CHUNK.test(s)),
    "編集の部品を読み込まない",
  ).toBe(false);
  await expect(page.getByRole("textbox", { name: "本文", exact: true })).toHaveCount(0);
  // 表とチェックの箱は別の答えで
  const p2 = await page.context().newPage();
  await mockDetail(p2);
  await openDetail(p2);
  await expect(bodyRegion(p2).getByRole("checkbox")).toHaveCount(2);
  expect(await bodyRegion(p2).getByRole("checkbox", { checked: true }).count()).toBe(1);
  await expect(bodyRegion(p2).getByRole("columnheader")).toHaveText(["項目", "金額"]);
});

test("K571-UI-003 本文が空（空の木・区画の並びも無い）：場所（region「本文」・.k-detail-doc）は在り、本文の字は無く、薄い字「本文はまだ書かれていません」が 1 つ出る。エラーは出ない（入口「本文を直す」は K-447 が足す）。薄い節だけの本文も説明の字は出さず、同じ薄い字を出す。書いた本文には薄い字を出さない", async ({
  page,
}) => {
  await mockDetail(page, { body: { doc: EMPTY, text: "", version: 0 } });
  await openDetail(page);
  await expect(bodyRegion(page)).toBeVisible();
  // 「本文を直す」の入口（K-447・BodySlot が足す）は .k-detail-doc の外。本文の字だけを見る
  await expect(bodyRegion(page).locator(".k-detail-doc")).toHaveCount(1);
  expect((await bodyRegion(page).locator(".k-detail-doc").innerText()).trim()).toBe("");
  // 空のときは薄い字を 1 つ（下絵 f4v2-detail-empty・.k-detail-doc の外）
  await expect(bodyRegion(page).locator("p.k-f4d-hint")).toHaveText(["本文はまだ書かれていません"]);
  await expect(page.locator('[data-state="error"]')).toHaveCount(0);
  const p2 = await page.context().newPage();
  await mockDetail(p2, { body: { doc: doc(GHOST("書いていない説明")), text: "", version: 1 } });
  await openDetail(p2);
  await expect(bodyRegion(p2)).not.toContainText("書いていない説明");
  await expect(bodyRegion(p2).locator("p.k-f4d-hint")).toHaveText(["本文はまだ書かれていません"]);
  // 書いた本文には出さない
  const p3 = await page.context().newPage();
  await mockDetail(p3);
  await openDetail(p3);
  await expect(bodyRegion(p3).locator(".k-detail-doc")).not.toHaveText("");
  await expect(bodyRegion(p3).getByText("本文はまだ書かれていません")).toHaveCount(0);
});

test("K571-UI-004 前の形（本文の行が無く、区画の並び sections で来る・K-575 まで）：区画の見出し（h2）と字（改行を残す）で読める。編集の入口は出ない", async ({
  page,
}) => {
  await mockDetail(page, {
    body: { doc: EMPTY, text: "", version: 0 },
    sections: [
      { key: "purpose", label: "目的", body: { text: "月末の請求を出す" }, version: 1 },
      { key: "todo", label: "実施事項", body: { text: "請求書を作る\n先方に送る" }, version: 4 },
    ],
  });
  await openDetail(page);
  // 区画を描くときは、空の本文の薄い字を出さない
  await expect(bodyRegion(page).getByText("本文はまだ書かれていません")).toHaveCount(0);
  const secs = page.locator("article.k-detail-card .k-detail-doc > section.k-section");
  await expect(secs).toHaveCount(2);
  await expect(secs.nth(0).getByRole("heading", { level: 2, name: "目的" })).toBeVisible();
  await expect(secs.nth(1)).toContainText("請求書を作る");
  await expect(page.getByRole("textbox", { name: "本文", exact: true })).toHaveCount(0);
});

test("K571-UI-005 結果の場所：成果物・決定ログ・申し送りが答えに在るときだけ本文の下に出る。成果物の名前と作った印・決定の文と決めた人（AI は「AI」）・申し送りの文", async ({
  page,
}) => {
  await mockDetail(page, { results: RESULTS });
  await openDetail(page);
  await expect(page.getByRole("region", { name: "成果物" })).toContainText("請求書.pdf");
  const log = page.getByRole("region", { name: "決定ログ" });
  await expect(log).toContainText("追加対応は 2 件を明細に分けて載せる");
  await expect(log).toContainText("高本");
  await expect(log).toContainText("AI");
  // AI が決めた行は「〈呼び名〉のAI（AI が決めた）」（代表の答え answer=538b4df12feb・決定の口の decided_by_ai）
  await expect(log).toContainText("高本のAI（AI が決めた）");
  await expect(page.getByRole("region", { name: "申し送り" })).toContainText("宛先の経理担当が変わっていないか");
});

test("K571-UI-006 結果の場所が無い：results が空なら場所ごと出ない。1 つだけ在れば、その 1 つだけ出る", async ({
  page,
}) => {
  await mockDetail(page, { results: {} });
  await openDetail(page);
  for (const n of ["成果物", "決定ログ", "申し送り"])
    await expect(page.getByRole("region", { name: n })).toHaveCount(0);
  const p2 = await page.context().newPage();
  await mockDetail(p2, { results: { handoff: RESULTS.handoff } });
  await openDetail(p2);
  await expect(p2.getByRole("region", { name: "申し送り" })).toBeVisible();
  await expect(p2.getByRole("region", { name: "成果物" })).toHaveCount(0);
  await expect(p2.getByRole("region", { name: "決定ログ" })).toHaveCount(0);
});

test("K571-UI-007 差し込み口が残り、入口が足される（複製・版と差分・本文・パネルの親の行・子チケットとつながりのカード・題の行の完了にする／AI に任せる）：ticket-detail.tsx に F6.SectionSlot（結果の場所と前の形の区画の 1 つずつ）・F6.DetailScope・F8.DetailScope・帯の順の入れ物、detail-panel.tsx に F6.PanelTabsSlot・F6.EstimateSlot・F6.ActualTimeSlot・F8.AssigneeSlot、題の行に複製と版と差分の入口、本文に BodySlot", () => {
  // 本文の場所と区画（F6.SectionSlot・BodySlot）は K-571 が detail-body.tsx に切り出した。詳細は 2 つを合わせて見る
  const d = src("ticket-detail.tsx") + src("detail-body.tsx");
  const bad: string[] = [];
  for (const n of [
    "F6.SectionSlot",
    "F6.DetailScope",
    "F8.DetailScope",
    "F6.StageSlot",
    "F6.TitleSlot",
    "F8.HandoverBandSlot",
    "F6.HoldBandSlot",
  ])
    if (!d.includes(`<${n}`)) bad.push(`ticket-detail.tsx に <${n} が無い`);
  if (!/className="k-detail-bands"/.test(d)) bad.push("帯の入れ物 k-detail-bands が無い");
  const p = src("detail-panel.tsx");
  for (const n of ["F6.PanelTabsSlot", "F6.EstimateSlot", "F6.ActualTimeSlot", "F8.AssigneeSlot"])
    if (!p.includes(`<${n}`)) bad.push(`detail-panel.tsx に <${n} が無い`);
  const e = src("detail-entry-slots.tsx");
  for (const n of [
    "DuplicateEntry",
    "VersionsEntry",
    "BodySlot",
    "ParentRowSlot",
    "LinksEntry",
    "CompleteActSlot",
    "DelegateActSlot",
  ])
    if (!new RegExp(`export function ${n}\\b`).test(e)) bad.push(`detail-entry-slots.tsx が ${n} を書き出さない`);
  for (const [n, f] of [
    ["DuplicateEntry", "duplicate/detail-entry.tsx"],
    ["VersionsEntry", "versions/versions-entry.tsx"],
    ["BodySlot", "body-edit/body-slot.tsx"],
    ["ParentRowSlot", "parent/detail-row-slot.tsx"],
    ["LinksEntry", "links/detail-entry.tsx"],
    ["CompleteActSlot", "../F5/approve-complete/complete-act-slot.tsx"],
    ["DelegateActSlot", "../F5/delegate/delegate-act-slot.tsx"],
  ] as const) {
    if (!new RegExp(`<${n}Fill\\b`).test(e)) bad.push(`detail-entry-slots.tsx の ${n} が先の ${n}Fill を呼ばない`);
    const fp = join(ROOT, "apps/web/features/F4", f);
    if (!existsSync(fp) || !new RegExp(`export (?:function|const) ${n}Fill\\b`).test(readFileSync(fp, "utf8")))
      bad.push(`先のファイル ${f} が ${n}Fill を書き出さない`);
  }
  if (!/<(DuplicateEntry|E\.DuplicateEntry)\b/.test(src("detail-head.tsx") + d)) bad.push("題の行に複製の入口が無い");
  if (!/<(VersionsEntry|E\.VersionsEntry)\b/.test(src("detail-head.tsx") + d)) bad.push("題の行に版と差分の入口が無い");
  if (!/<(BodySlot|E\.BodySlot)\b/.test(d)) bad.push("本文に BodySlot が無い");
  if (!/<(LinksEntry|E\.LinksEntry)\b/.test(d)) bad.push("子チケット・つながりのカードを LinksEntry で呼んでいない");
  if (!/<(ParentRowSlot|E\.ParentRowSlot)\b/.test(src("detail-panel.tsx")))
    bad.push("パネルの「親」の行に ParentRowSlot が無い");
  for (const n of ["CompleteActSlot", "DelegateActSlot"])
    if (!new RegExp(`<(${n}|E\\.${n})\\b`).test(src("detail-head.tsx") + d)) bad.push(`題の行に ${n} が無い`);
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K571-UI-008 題の行：h1 の右に 複製・版と差分・ほかの操作が在る（押せるかは K-446・K-449・K-458 が決める。この葉は在ることだけを見る＝押せない形でも押せる形でも緑）。「版と差分」は 1 つ・業務の型は出ない", async ({
  page,
}) => {
  await mockDetail(page);
  await openDetail(page);
  const head = page.locator("header.k-page-head");
  for (const n of ["複製", "版と差分", "ほかの操作"])
    await expect(head.getByRole("button", { name: n, exact: true }), n).toHaveCount(1);
  await expect(page.getByRole("button", { name: "版と差分", exact: true })).toHaveCount(1);
  await expect(page.getByText("業務の型")).toHaveCount(0);
});

test("K571-UI-009 右のパネルのタブ：項目（今いる・aria-current）・やり取り・〈名前〉のAI。前の「属性」は無い。AI のタブは押せない形", async ({
  page,
}) => {
  await mockDetail(page);
  await openDetail(page);
  const tabs = panel(page).getByRole("navigation", { name: "パネルのタブ" });
  await expect(tabs.getByRole("button")).toHaveText(["項目", "やり取り", "高本のAI"]);
  await expect(tabs.getByRole("button", { name: "項目", exact: true })).toHaveAttribute("aria-current", "page");
  // AI のタブは K-764（段 6・右のパネルの「〈名〉のAI」）が押せる形にした。押せない形の印は付かない
  await expect(tabs.getByRole("button", { name: "高本のAI" })).not.toHaveAttribute("aria-disabled", "true");
});

test("K571-UI-010 項目の並び：担当（担当者・承認する人・優先度）・日付と時間（開始日・期限・予定時間・実績時間と、日付の会社の項目）・関連（グループ・節目・親と、ほかの会社の項目）・確認項目の 4 つの区。会社の項目は用意してある項目と同じ並びに入る（見出しで分けない）", async ({
  page,
}) => {
  await mockDetail(page);
  await openDetail(page);
  const heads = await panel(page).locator(".k-detail-panel-sec > h2").allInnerTexts();
  expect(heads.map((x) => x.trim()).slice(0, 4)).toEqual(["担当", "日付と時間", "関連", "確認項目"]);
  const names = async (sec: string) =>
    (await panel(page).locator(`section[aria-label="${sec}"] dt`).allInnerTexts()).map((x) => x.trim());
  expect(await names("日付と時間")).toEqual(["開始日", "期限", "予定時間", "実績時間", "支払期日"]);
  expect(await names("関連")).toEqual(expect.arrayContaining(["グループ", "節目", "親", "PJコード", "請求額", "分類"]));
  await expect(field(page, "担当者").locator("dd .k-detail-who")).toContainText("高本");
  await expect(field(page, "グループ")).toContainText("営業（EG）");
});

test("K571-UI-011 会社の項目の見せ方：日付「12/15（火）」・数は 3 桁区切り「95,000」・値の無い項目は名前だけで値は空白。並びは答えの順。会社の項目が 0 件なら行が出ない", async ({
  page,
}) => {
  await mockDetail(page);
  await openDetail(page);
  await expect(field(page, "支払期日")).toContainText("12/15（火）");
  // 請求額は金額の種類（桁を区切り後ろに「円」・answer=6280a4739b6e）
  await expect(field(page, "請求額")).toContainText("95,000 円");
  expect((await field(page, "PJコード").locator("dd").innerText()).trim()).toBe("");
  const p2 = await page.context().newPage();
  await mockDetail(p2, { fields: [] });
  await openDetail(p2);
  await expect(field(p2, "支払期日")).toHaveCount(0);
  await expect(field(p2, "担当者")).toBeVisible();
});

test("K571-UI-012 会社の項目の値を直す：値を押して直すと更新の口に 1 項目だけ届き（K-569 の保存の道具）、読み直した詳細に出る。口を足さない", async ({
  page,
}) => {
  const m = await mockDetail(page);
  const patches: unknown[] = [];
  await page.route(new RegExp(`/api/v1/tickets/${TID}$`), async (route) => {
    if (route.request().method() === "PATCH") {
      patches.push(route.request().postDataJSON());
      const b = route.request().postDataJSON() as { fields: Record<string, unknown> };
      for (const f of m.a.fields) if (f.id in b.fields) f.value = b.fields[f.id];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { ticket: { id: TID } } }),
      });
    }
    return route.fallback();
  });
  await openDetail(page);
  await field(page, "請求額").locator("dd").getByRole("button").first().click();
  await page.getByRole("textbox", { name: "請求額", exact: true }).fill("120000");
  await page.getByRole("textbox", { name: "請求額", exact: true }).press("Enter");
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toEqual({ fields: { [COMPANY[2]!.id]: 120000 } });
  await page.reload();
  await expect(field(page, "請求額")).toContainText("120,000");
});

test("K571-UI-013 確認項目：「N 件 ・ 開く」（件数は答えの spec_count）。開くと K-450 の欄が出て、そのとき確認項目の口が 1 回呼ばれる。件数 0 は「0 件」", async ({
  page,
}) => {
  await mockDetail(page);
  // この口は後から置いた差し替えが受ける（mockDetail の数えには入らない）ので、ここで数える
  let specReads = 0;
  await page.route(new RegExp(`/api/v1/tickets/${TID}/test-specs$`), (route) => {
    specReads += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ id: "s1", title: "請求書が宛先に届いている", checked_at: null, version: 1 }],
        meta: { count: 1, limit: 50, can_edit: true },
      }),
    });
  });
  await openDetail(page);
  const sec = panel(page).locator('section[aria-label="確認項目"]');
  await expect(sec).toContainText("3 件");
  expect(specReads).toBe(0);
  await sec.getByRole("button", { name: "開く" }).click();
  await expect(sec).toContainText("請求書が宛先に届いている");
  expect(specReads).toBe(1);
  const p2 = await page.context().newPage();
  await mockDetail(p2, { spec_count: 0, spec_unchecked: 0 });
  await openDetail(p2);
  await expect(panel(p2).locator('section[aria-label="確認項目"]')).toContainText("0 件");
});

test("K571-UI-014 段 7・8・9 の差し込み口と帯の順が前のまま：承認待ちの詳細で帯の入れ物 .k-detail-bands に「承認と実行」の帯が 1 つ・「日付と時間」の区が className を受けて印（k-f7-due-anchor）を付けられる形・期限の行に差し込める", async ({
  page,
}) => {
  await mockDetail(page, {
    approval: { id: "a1", can_decide: true, irreversible: true, note: null, approver_name: "高本" },
  });
  await openDetail(page);
  await expect(page.locator(".k-detail-bands")).toHaveCount(1);
  const c = src("detail-panel.tsx");
  expect(/function Sec\([^)]*className/.test(c) || /className\??:\s*string/.test(c), "Sec が className を受ける").toBe(
    true,
  );
  await expect(panel(page).locator('section[aria-label="日付と時間"]')).toBeVisible();
  await expect(field(page, "期限")).toBeVisible();
});

test("K571-UI-015 子チケット・つながりのカードは前のまま：本文のカードの下に別のカード・見出し・子を足す／つながりを足す（在るだけを見る・押せない形か押せる形かは K-452 が決める）・嘘の行を出さない", async ({
  page,
}) => {
  await mockDetail(page);
  await page.route(new RegExp(`/api/v1/tickets/${TID}/links$`), (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { children: [] } }),
    }),
  );
  await openDetail(page);
  const card = page.getByRole("region", { name: "子チケット・つながり" });
  // カードは閉じた形（件数と「開く」）が既定で、「開く」で一覧を読む（K-452 の決め）
  await card.getByRole("button", { name: "開く", exact: true }).click();
  // 在ることだけを見る（押せるか・押せない形かは K-452 が決める。K-452 が入っても赤くならない）
  for (const n of ["子を足す", "つながりを足す"])
    await expect(card.getByRole("button", { name: n, exact: true }), n).toHaveCount(1);
  await expect(card.locator("a, li")).toHaveCount(0);
});

test("K571-UI-016 一覧の右に開く詳細（layout=side）：題は h2・本文は読む形・結果の場所が出る・右のパネルは描かない。口は詳細 1 本", async ({
  page,
}) => {
  const m = await mockDetail(page, { results: RESULTS });
  await page.route(/\/api\/v1\/tickets(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: TID,
            number: "EG-571",
            title: "セイコー商事の 11 月分の請求書を送る",
            kind: { id: "k", name: "タスク" },
            stage: { id: "s", name: "未着手", key: "todo" },
            assignee: null,
            due_on: null,
            overdue: false,
            updated_at: "2026-11-21T00:00:00Z",
            parent_ticket_id: null,
            delegated_to_clone: false,
          },
        ],
        meta: { next_cursor: null },
      }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tickets?open=EG-571");
  await expect(page.getByRole("heading", { level: 2, name: "セイコー商事の 11 月分の請求書を送る" })).toBeVisible();
  await expect(bodyRegion(page)).toContainText("セイコー商事に 11 月分の請求を間違いなく届ける");
  await expect(page.getByRole("region", { name: "成果物" })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  expect(m.seen.filter((s) => s === `GET /api/v1/tickets/${TID}`)).toHaveLength(1);
});

test("K571-UI-017 見つからない・見えない・読めない：404 は「見つかりませんでした」・403 は権限の文・uuid でない道は口を呼ばずに見つからない。本文もパネルも出ない", async ({
  page,
}) => {
  const m = await mockDetail(page, { status: 404 });
  await page.goto(`/tickets/${TID}`);
  await expect(page.locator('[data-state="error"][data-code="E-PAGE-001"]')).toBeVisible();
  await expect(bodyRegion(page)).toHaveCount(0);
  const p2 = await page.context().newPage();
  await mockDetail(p2, { status: 403 });
  await p2.goto(`/tickets/${TID}`);
  await expect(p2.locator('[data-state="error"]')).toBeVisible();
  const p3 = await page.context().newPage();
  const m3 = await mockDetail(p3);
  await p3.goto("/tickets/not-a-uuid");
  await expect(p3.locator('[data-state="error"][data-code="E-PAGE-001"]')).toBeVisible();
  expect(m3.seen.filter((s) => s.includes("/tickets/not-a-uuid"))).toEqual([]);
  expect(m.seen.length).toBeGreaterThan(0);
});

test("K571-UI-018 完了したチケット：段の札は答えの段・本文は読める・会社の項目の値は読める（直せるかは K-569）・確認項目の件数が出る", async ({
  page,
}) => {
  await mockDetail(page, { completed: { at: "2026-11-21T00:30:00Z", by: "高本" } });
  await openDetail(page);
  await expect(bodyRegion(page)).toContainText("セイコー商事に 11 月分の請求を間違いなく届ける");
  await expect(field(page, "請求額")).toContainText("95,000");
  await expect(panel(page).locator('section[aria-label="確認項目"]')).toContainText("3 件");
});

test("K571-UI-019 本文のチェックの箱は読む形では押せない：aria-disabled・押しても口（PATCH・POST）が呼ばれず、付いた状態も変わらない（付けるのは直すとき・K-447）", async ({
  page,
}) => {
  const m = await mockDetail(page);
  await openDetail(page);
  const box = bodyRegion(page).getByRole("checkbox", { checked: false }).first();
  await box.click({ force: true });
  await expect(box).not.toBeChecked();
  expect(m.seen.filter((s) => !s.startsWith("GET"))).toEqual([]);
});

test("K571-UI-020 幅 375・768・1440 のはみ出し 0：長い本文（空白の無い 300 字・表）・結果の場所・パネル。右のパネルは 1023 以下で本文の下に出る", async ({
  page,
}) => {
  await mockDetail(page, {
    results: RESULTS,
    body: {
      doc: doc(P("あ".repeat(300)), ...(answer().body.doc as ReturnType<typeof doc>).content.slice(0, 5)),
      text: "x",
      version: 1,
    },
  });
  const bad: string[] = [];
  for (const w of WIDTHS) {
    await openDetail(page, w);
    const o = await overflowX(page);
    if (o !== 0) bad.push(`幅 ${w}：${o}px`);
    if (w < 1024) {
      const b = (await panel(page).boundingBox())!;
      const m = (await bodyRegion(page).boundingBox())!;
      if (b.y < m.y) bad.push(`幅 ${w}：パネルが本文の上`);
    }
  }
  expect(bad).toEqual([]);
});

test("K571-UI-021 パネルを閉じる・開く：押すとパネルが消えて本文が広がり、「パネルを開く」で戻る。キーボードの場所が移る（口は呼ばない）", async ({
  page,
}) => {
  const m = await mockDetail(page);
  await openDetail(page);
  const n = m.seen.length;
  await panel(page).getByRole("button", { name: "パネルを閉じる" }).click();
  await expect(panel(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "パネルを開く" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "パネルを閉じる" })).toBeFocused();
  expect(m.seen.length).toBe(n);
});

test("K571-UI-022 読み上げとキーボード：本文は region「本文」・結果の場所は region（成果物・決定ログ・申し送り）・項目の区は h2 と aria-label・パネルのタブは nav。Tab は 題の行の入口 → 帯 → 本文のあと パネルへ", async ({
  page,
}) => {
  await mockDetail(page, { results: RESULTS });
  await openDetail(page);
  // 決定ログの見出しは生きている決定の数つき「決定ログ（N）」（K-397 の区画）
  for (const n of ["本文", "成果物", /^決定ログ(（\d+）)?$/, "申し送り"])
    await expect(page.getByRole("region", { name: n, exact: true })).toHaveCount(1);
  for (const n of ["担当", "日付と時間", "関連", "確認項目"])
    await expect(panel(page).locator(`section[aria-label="${n}"]`)).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
  // h1 は焦点を受けない（頁の頭から回る）。外枠の左のメニューは飛ばし、外枠の「本文へ」（k-skip）で本文に入ってから Tab
  await page.locator("a.k-skip").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement?.closest("header, article, aside")?.tagName ?? "");
  expect(first).not.toBe("");
});

const PAIRS: FidelityPair[] = [
  {
    name: "h1",
    role: "h1",
    canvas: ".k-detail-title h1",
    app: ".k-detail-title h1",
    props: ["font-size", "font-weight", "color", "texts"],
  },
  {
    name: "body-h2",
    role: "body-h2",
    canvas: ".k-f4d-doc h2",
    app: ".k-detail-doc h2",
    props: ["font-size", "font-weight", "color", "texts"],
  },
  {
    name: "body-p",
    role: "body-p",
    canvas: ".k-f4d-doc p",
    app: ".k-detail-doc p",
    props: ["font-size", "color", "line-height"],
  },
  {
    name: "tabs",
    role: "tabs",
    canvas: ".k-detail-tabs button",
    app: ".k-detail-tabs button",
    props: ["font-size", "color", "texts"],
  },
  {
    name: "sec-h2",
    role: "sec-h2",
    canvas: ".k-detail-panel-sec > h2",
    app: ".k-detail-panel-sec > h2",
    props: ["font-size", "color", "texts"],
  },
  {
    name: "field-dt",
    role: "field-dt",
    canvas: ".k-detail-field dt",
    app: ".k-detail-field dt",
    props: ["font-size", "color", "texts"],
  },
  {
    name: "result-h2",
    role: "result-h2",
    canvas: ".k-f4d-result h2",
    app: ".k-f4d-result h2",
    props: ["font-size", "color", "texts"],
  },
];
for (const [row, id, results] of [
  ["K571-UI-023", "f4v2-detail-new", {}],
  ["K571-UI-024", "f4v2-detail-worked", RESULTS],
] as const) {
  test(`${row} 下絵との突き合わせ（${id}）：幅 375・768・1440 で題・本文の見出しと字・パネルのタブと区の見出しと項目の名前${id === "f4v2-detail-worked" ? "・結果の場所の見出し" : ""}が下絵と同じ（位置は比べない）`, async ({
    browser,
  }) => {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          // 本文は下絵の本文と同じ見出しと段落の並び（MOCK_BODY）にして比べる
          await mockDetail(page, { results, body: { doc: MOCK_BODY, text: "目的", version: 3 } });
          await openDetail(page, w);
          await expect(panel(page)).toBeVisible();
        },
        { base: "/dev/mock/f4v2", pairs: PAIRS, blur: true },
      );
      expect(rows.length, `${id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  });
}

/** 選ぶ欄の会社の項目に 1 つ目の選択肢を入れる（下絵 f4v2-detail-more の値） */
const picked = (f: (typeof COMPANY)[number]) => (f.field_type === "select" ? { ...f, value: f.options[0]!.id } : f);

const MORE_PAIRS: FidelityPair[] = [
  {
    name: "more",
    role: "more",
    canvas: '.k-page-head [aria-label="ほかの操作"], .k-page-head .k-f4-more-btn',
    app: '.k-page-head [aria-label="ほかの操作"], .k-page-head .k-detail-more, .k-page-head .k-f4-more-btn',
    props: ["width", "height"],
  },
  {
    name: "tabs",
    role: "tabs",
    canvas: ".k-detail-tabs button",
    app: ".k-detail-tabs button",
    props: ["font-size", "color", "texts"],
  },
  {
    name: "field-dt",
    role: "field-dt",
    canvas: ".k-detail-field dt",
    app: ".k-detail-field dt",
    props: ["font-size", "color", "texts"],
  },
  {
    name: "field-dd",
    role: "field-dd",
    canvas: ".k-detail-field dd",
    app: ".k-detail-field dd",
    props: ["font-size", "color", "texts"],
  },
];
const EMPTY_PAIRS: FidelityPair[] = [
  ...PAIRS.filter((p) => ["h1", "tabs", "sec-h2", "field-dt"].includes(p.name)),
  {
    name: "body-empty",
    role: "body-empty",
    canvas: ".k-f4d-body-wrap p.k-f4d-hint",
    app: '[aria-label="本文"] p.k-f4d-hint',
    props: ["font-size", "color", "texts"],
  },
];
for (const [row, id, pairs, body] of [
  ["K571-UI-026", "f4v2-detail-more", MORE_PAIRS, undefined],
  ["K571-UI-027", "f4v2-detail-empty", EMPTY_PAIRS, { doc: EMPTY, text: "", version: 0 }],
] as const) {
  test(`${row} 下絵との突き合わせ（${id}）：幅 375・768・1440 で${id === "f4v2-detail-more" ? "題の行の「ほかの操作」の箱とグループの行" : "本文が空のときの題・薄い字「本文はまだ書かれていません」・パネルのタブと区の見出し・項目の名前"}が下絵と同じ値`, async ({
    browser,
  }) => {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          // 会社の項目の選ぶ値は下絵と同じ（PJコード「SK-2026-11」・分類「請求」）。既定の作り物は空のまま（K571-UI-011 が空の行を見る）
          await mockDetail(page, body ? { body } : { fields: COMPANY.map(picked) });
          await openDetail(page, w);
          await expect(panel(page)).toBeVisible();
          if (body) await expect(bodyRegion(page)).toBeVisible();
        },
        { base: "/dev/mock/f4v2", pairs: [...pairs], blur: true },
      );
      expect(rows.length, `${id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  });
}

// X7：「確認項目を足す」の合図（K-573 が出す）は、本物の詳細では右のパネルの「項目」タブの中にしか聞き手が居ないと死にボタンになる。詳細の一番上で聞く
test("K571-UI-028 「確認項目を足す」の合図を詳細の一番上で聞く：パネルを閉じている・「やり取り」のタブ・幅 768（パネルが本文の下）・一覧の右の詳細（パネル無し）でも、合図で足す小窓が開く（パネルがあるときは開いて「項目」のタブにする）。別のチケットの id では開かない", async ({
  page,
}) => {
  await mockDetail(page);
  await page.route(new RegExp(`/api/v1/tickets/${TID}/test-specs$`), (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { count: 0, limit: 50, can_edit: true } }),
    }),
  );
  const dlg = (p: Page) => p.getByRole("dialog", { name: "確認項目を足す", exact: true });
  const fire = (p: Page, id: string) =>
    p.evaluate(
      (i) => window.dispatchEvent(new CustomEvent("kaname:f4:open-spec-add", { detail: { ticketId: i } })),
      id,
    );
  const close = async (p: Page) => {
    await dlg(p).getByRole("button", { name: "やめる", exact: true }).click();
    await expect(dlg(p)).toHaveCount(0);
  };
  await openDetail(page);
  await fire(page, "00000000-0000-4000-8000-0000000000ff");
  await expect(dlg(page), "別のチケットの合図では開かない").toHaveCount(0);
  // パネルを閉じている
  await panel(page).getByRole("button", { name: "パネルを閉じる" }).click();
  await expect(panel(page)).toBeHidden();
  await fire(page, TID);
  await expect(dlg(page)).toBeVisible();
  // 小窓（modal）が開いている間は、ほかの所が読み上げから外れる（aria-hidden）。パネルは読み上げから外れた物も含めて探す
  const shown = { includeHidden: true } as const;
  const panelUnder = page.getByRole("complementary", { name: "チケットのパネル", ...shown });
  await expect(panelUnder).toBeVisible();
  await close(page);
  // 「やり取り」のタブ
  const tabs = panelUnder.getByRole("navigation", { name: "パネルのタブ", ...shown });
  await tabs.getByRole("button", { name: "やり取り", exact: true }).click();
  await fire(page, TID);
  await expect(dlg(page)).toBeVisible();
  await expect(tabs.getByRole("button", { name: "項目", exact: true, ...shown })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await close(page);
  // 幅 768（パネルは本文の下）
  const p2 = await page.context().newPage();
  await mockDetail(p2);
  await p2.route(new RegExp(`/api/v1/tickets/${TID}/test-specs$`), (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { count: 0, limit: 50, can_edit: true } }),
    }),
  );
  await openDetail(p2, 768);
  await fire(p2, TID);
  await expect(dlg(p2)).toBeVisible();
  // 一覧の右の詳細（パネル無し）：小窓だけが開く
  const p3 = await page.context().newPage();
  await mockDetail(p3);
  await p3.route(new RegExp(`/api/v1/tickets/${TID}/test-specs$`), (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { count: 0, limit: 50, can_edit: true } }),
    }),
  );
  await p3.route(/\/api\/v1\/tickets(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: TID,
            number: "EG-571",
            title: "セイコー商事の 11 月分の請求書を送る",
            kind: { id: "k", name: "タスク" },
            stage: { id: "s", name: "未着手", key: "todo" },
            assignee: null,
            due_on: null,
            overdue: false,
            updated_at: "2026-11-21T00:00:00Z",
            parent_ticket_id: null,
            delegated_to_clone: false,
          },
        ],
        meta: { next_cursor: null },
      }),
    }),
  );
  await p3.setViewportSize({ width: 1440, height: 900 });
  await p3.goto("/tickets?open=EG-571");
  await expect(p3.getByRole("heading", { level: 2, name: "セイコー商事の 11 月分の請求書を送る" })).toBeVisible();
  await expect(panel(p3)).toHaveCount(0);
  await fire(p3, TID);
  await expect(dlg(p3)).toBeVisible();
});

test("K571-UI-025 口の数：詳細を開いたときの口は台帳の 6 本（me・scopes・approvals/queue・bridge/devices・tickets/:id・tickets/:id/runs）のまま。本文・項目・結果の場所のために足した口は 0。確認項目を開くときだけ 1 本（K-450）", async ({
  page,
}) => {
  const m = await mockDetail(page, { results: RESULTS });
  await openDetail(page);
  await page.waitForLoadState("networkidle");
  const api = m.seen.filter((s) => !s.includes("get-session"));
  const kinds = new Set(api.map((s) => s.replace(TID, ":id")));
  expect([...kinds].sort()).toEqual(
    // 外枠の 3 本（approvals/queue・bridge/devices・scopes）は getShell 1 本に（K-466）。障害の帯の service-status（K-957）・
    // 決定ログの区画の decisions（K-397）・やり取りの timeline（K-392）は、それぞれの葉が足した口。本文・項目のための口は 0 のまま
    [
      "GET /api/auth-ext/me",
      "GET /api/v1/service-status",
      "GET /api/v1/shell",
      "GET /api/v1/tickets/:id",
      "GET /api/v1/tickets/:id/decisions",
      "GET /api/v1/tickets/:id/runs",
      "GET /api/v1/tickets/:id/timeline",
    ].sort(),
  );
  expect(api.filter((s) => s === `GET /api/v1/tickets/${TID}`)).toHaveLength(1);
  expect(api.filter((s) => s.includes("ticket-fields") || s.includes("test-specs"))).toEqual([]);
});
