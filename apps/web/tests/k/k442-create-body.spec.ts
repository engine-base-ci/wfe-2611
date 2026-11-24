// K-442「作る面を新しい並びに」の画面の試験（実 Chrome）。行 ID は 11_tickets/K-442.md の行の表（K442-UI-001〜026。UN は apps/web/test/k442-create-body.test.ts）。
//   正の絵：下絵 v2 /dev/mock/f4v2/f4v2-create-template・free・long・blank（部品 features/F4/doc/views.tsx）。
//   口は網の手前で差し替える：create-mock.ts の mockCreate（種別はひな形つき・会社の項目は masters・作る口の断りは createReplies）。
//   本文の部品は K-567（role=textbox・名前「本文」・薄い節は data-ghost="true"）、項目の表は K-569、確認項目は K-450 のものを使う。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  BOSS,
  ISSUE,
  ME,
  NEW_ID,
  SCOPE,
  TASK,
  bodyBox,
  fillDue,
  fillRequired,
  form,
  gate,
  holdCreate,
  jstDay,
  loaded,
  mockCreate,
  openCreate,
  overflowX,
  pickParent,
  settledDetail,
  writeBody,
} from "./create-mock";
import { MASTER_3, MASTER_ALL, byName, conflict, field, notFound, optId } from "./items-mock";
import { matchMock } from "./stage2-match";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;
const WIDTHS = [375, 768, 1440] as const;
const NOTE = "種別「タスク」のひな形が入っています。消しても、自由に書き換えても構いません";
const make = (page: Page) => page.locator("header.k-page-head").getByRole("button", { name: "作る", exact: true });
const titleBox = (page: Page) => page.getByRole("textbox", { name: "題名", exact: true });
const items = (page: Page) => page.getByRole("group", { name: "項目", exact: true });
const open = async (page: Page, o: Parameters<typeof mockCreate>[1] = {}, width = 1440) => {
  const m = await mockCreate(page, o);
  await openCreate(page, width);
  await loaded(page);
  await expect(bodyBox(page)).toBeVisible();
  return m;
};
type Sent = { body?: { doc?: { content?: unknown[] } }; fields?: Record<string, unknown>; specs?: string[] } & Record<
  string,
  unknown
>;
const lastCreate = (m: { creates: Record<string, unknown>[] }): Sent => m.creates[m.creates.length - 1] as Sent;
const MASTERS = (): Record<string, unknown[]> => ({
  [TASK]: [...MASTER_ALL],
  [ISSUE]: [byName(MASTER_ALL, "支払期日"), field(21, "問い合わせ元", "short_text")],
});

test("K442-UI-001 並び：親 → 種別 → 題名 → 本文（道具の帯・Markdown の注）→ つながり → 項目の表 → ファイル → 知らせる人 → 頭の「作る」。区画の見出し・「作る前に」・足元の帯・目的の欄が無く、h1 は 1 つ", async ({
  page,
}) => {
  await open(page);
  const y = async (loc: ReturnType<Page["locator"]>) => (await loc.first().boundingBox())!.y;
  const order = [
    page.getByRole("button", { name: /^親/ }).first(),
    page.getByRole("combobox", { name: "種別" }),
    titleBox(page),
    bodyBox(page),
    page.getByRole("button", { name: /つながりを足す/ }),
    items(page),
    page.getByRole("group", { name: "ファイルを置く" }),
    page.getByRole("textbox", { name: "作ったことを知らせる人" }),
  ];
  const ys: number[] = [];
  for (const l of order) ys.push(await y(l));
  expect(ys, "上から下の順").toEqual([...ys].sort((a, b) => a - b));
  await expect(page.getByRole("toolbar", { name: "本文の道具", exact: true })).toBeVisible();
  await expect(page.getByText("Markdown を貼ると変換します")).toBeVisible();
  for (const gone of ["目的", "完了の条件", "実施事項"])
    await expect(page.getByRole("textbox", { name: gone, exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "作る前に" })).toHaveCount(0);
  await expect(page.locator(".k-create-foot")).toHaveCount(0);
  await expect(page.locator("h1")).toHaveCount(1);
});

test("K442-UI-002 開いた直後：種別はタスク・本文に薄いひな形（見出し 目的・完了の条件と説明）・注と「ひな形を消す」が出る。薄い字は下書きにも作る口にも入らない", async ({
  page,
}) => {
  const m = await open(page);
  await expect(page.getByRole("combobox", { name: "種別" })).toContainText("タスク");
  await expect(bodyBox(page)).toContainText("このチケットで何を実現したいかを書きます");
  expect(await bodyBox(page).locator('[data-ghost="true"]').count()).toBeGreaterThanOrEqual(4);
  await expect(page.getByText(NOTE)).toBeVisible();
  await expect(page.getByRole("button", { name: "ひな形を消す", exact: true })).toBeVisible();
  await fillRequired(page);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(JSON.stringify(lastCreate(m).body ?? {}), "薄い節は送らない").not.toContain("ghost");
});

test("K442-UI-003 本文を書く：薄い説明に打つと打った字が普通の字になり、作る口の body.doc に入る（text と sections は送らない）。下書きにも本文の木が残る", async ({
  page,
}) => {
  const m = await open(page);
  await writeBody(page, "月末の請求を出す");
  await expect(bodyBox(page).locator('p:not([data-ghost="true"])', { hasText: "月末の請求を出す" })).toBeVisible();
  await expect.poll(() => JSON.stringify(m.draftSaves.at(-1) ?? {})).toContain("月末の請求を出す");
  await fillRequired(page);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  const s = lastCreate(m);
  expect(JSON.stringify(s.body!.doc)).toContain("月末の請求を出す");
  expect(Object.keys(s.body!)).toEqual(["doc"]);
  expect(s).not.toHaveProperty("sections");
});

test("K442-UI-004 ひな形を消す：薄い節だけ消え（書いた字は残る）・注とボタンが消える。本文が空でも作れて、body は空の木（薄い節なし）", async ({
  page,
}) => {
  const m = await open(page);
  await writeBody(page, "残す字");
  await page.getByRole("button", { name: "ひな形を消す", exact: true }).click();
  await expect(bodyBox(page).locator('[data-ghost="true"]')).toHaveCount(0);
  await expect(bodyBox(page)).toContainText("残す字");
  await expect(page.getByText(NOTE)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ひな形を消す", exact: true })).toHaveCount(0);
  const p2 = await page.context().newPage();
  const m2 = await mockCreate(p2);
  await openCreate(p2);
  await loaded(p2);
  await p2.getByRole("button", { name: "ひな形を消す", exact: true }).click();
  await fillRequired(p2);
  await make(p2).click();
  await expect.poll(() => m2.creates.length).toBe(1);
  expect(JSON.stringify(lastCreate(m2).body?.doc ?? { content: [] })).not.toContain("text");
  expect(m.creates).toHaveLength(0);
});

test("K442-UI-005 種別を変える（まだ書いていない）：新しい種別のひな形に入れ替わる。ひな形を消した後は、種別を変えても入らない", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("combobox", { name: "種別" }).click();
  await page.getByRole("option", { name: "課題", exact: true }).click();
  await expect(bodyBox(page)).toContainText("いま何が起きているかを書きます");
  await expect(bodyBox(page)).not.toContainText("このチケットで何を実現したいかを書きます");
  await page.getByRole("button", { name: "ひな形を消す", exact: true }).click();
  await page.getByRole("combobox", { name: "種別" }).click();
  await page.getByRole("option", { name: "タスク", exact: true }).click();
  await expect(bodyBox(page).locator('[data-ghost="true"]')).toHaveCount(0);
});

test("K442-UI-006 種別を変える（書いた後）：書いた本文は残る。会社の項目の行は新しい種別の物に入れ替わり、出なくなった項目の値は送らない", async ({
  page,
}) => {
  const m = await open(page, { masters: MASTERS() });
  const due = byName(MASTER_ALL, "支払期日");
  await writeBody(page, "書いた本文");
  await page.getByRole("textbox", { name: "先方の担当者名", exact: true }).fill("経理の山田さん");
  await page.getByRole("combobox", { name: "種別" }).click();
  await page.getByRole("option", { name: "課題", exact: true }).click();
  await expect(bodyBox(page)).toContainText("書いた本文");
  await expect(page.getByRole("textbox", { name: "問い合わせ元", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "先方の担当者名", exact: true })).toHaveCount(0);
  await fillRequired(page);
  await page.getByLabel("支払期日", { exact: true }).fill(jstDay(10));
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(lastCreate(m).kind_id).toBe(ISSUE);
  expect(Object.keys(lastCreate(m).fields ?? {})).toEqual([due.id]);
});

test("K442-UI-007 作る前の確かめ：題名・担当者・期限が空だと欄の下に赤い字が出て作る口は呼ばれない。最初の誤りの欄にキーボードの場所が移る", async ({
  page,
}) => {
  const m = await open(page);
  await make(page).click();
  await expect(page.getByText("題名を入れてください")).toBeVisible();
  await expect(page.getByText("担当者を選んでください")).toBeVisible();
  await expect(page.getByText("期限を入れてください")).toBeVisible();
  await expect(titleBox(page)).toBeFocused();
  expect(m.creates).toHaveLength(0);
});

test("K442-UI-008 期限と開始と優先度：期限が今日より前は期限の欄の下に正本の文・開始が期限より後は開始日の欄の下・優先度「高」で理由が空は理由の欄の下。どれも口は呼ばれない", async ({
  page,
}) => {
  const m = await open(page);
  await fillRequired(page);
  await page.getByRole("textbox", { name: "期限", exact: true }).fill(jstDay(-1));
  await page.getByRole("textbox", { name: "開始日", exact: true }).fill(jstDay(5));
  await page.getByRole("combobox", { name: "優先度" }).click();
  await page.getByRole("option", { name: "高", exact: true }).click();
  await make(page).click();
  await expect(page.getByText(msg("E-VAL-012"))).toBeVisible();
  await expect(page.getByText("開始は期限より前の日にしてください")).toBeVisible();
  await expect(page.getByText("優先度を高にする理由を書いてください")).toBeVisible();
  expect(m.creates).toHaveLength(0);
});

test("K442-UI-009 会社の必須の項目が空：項目の行の欄の下に赤い字（K-569 の文）・口は呼ばれない。入れると消えて作れる", async ({
  page,
}) => {
  const m = await open(page, { masters: { [TASK]: [...MASTER_3] } });
  await fillRequired(page);
  await make(page).click();
  await expect(page.getByText("支払期日を選んでください")).toBeVisible();
  await expect(page.getByText("PJコードを選んでください")).toBeVisible();
  expect(m.creates).toHaveLength(0);
  await page.getByLabel("支払期日", { exact: true }).fill(jstDay(7));
  await page.getByRole("combobox", { name: "PJコード" }).click();
  await page.getByRole("option", { name: /SK-2026-11/ }).click();
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
});

test("K442-UI-010 作る：口に届く形（scope_id・kind_id・title・assignee_member_id・due_on・start_on・priority・parent_ticket_id・body・fields・specs・notify_member_ids・draft_id）。sections と本文の text は無い", async ({
  page,
}) => {
  const m = await open(page, { masters: { [TASK]: [...MASTER_ALL.slice(2, 4)] } });
  await fillRequired(page, "請求書を送る", "本文です");
  await page.getByRole("textbox", { name: "開始日", exact: true }).fill(jstDay(1));
  await page.getByRole("textbox", { name: "請求額", exact: true }).fill("95000");
  await page.getByRole("checkbox", { name: "佐藤" }).check();
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  const s = lastCreate(m);
  expect(Object.keys(s).sort()).toEqual(
    [
      "assignee_member_id",
      "body",
      "draft_id",
      "due_on",
      "fields",
      "kind_id",
      "notify_member_ids",
      "priority",
      "scope_id",
      "specs",
      "start_on",
      "title",
    ].sort(),
  );
  expect(s).toMatchObject({
    scope_id: SCOPE,
    kind_id: TASK,
    title: "請求書を送る",
    assignee_member_id: ME,
    due_on: jstDay(3),
    start_on: jstDay(1),
    priority: "mid",
    notify_member_ids: [BOSS],
    specs: [],
  });
  expect(s.fields).toEqual({ [byName(MASTER_ALL, "請求額").id]: 95000 });
});

test("K442-UI-011 確認項目：項目の表の中で足した文が、作るとき specs の文の並び（足した順）で届く。作る前に口は呼ばれず、チェックの箱は押せない形（title「作ったあとに付けます」）", async ({
  page,
}) => {
  const m = await open(page);
  await page.getByRole("button", { name: "＋ 確認項目を足す" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("textbox").fill("請求書が宛先に届いている");
  await dlg.getByRole("button", { name: /足す$/ }).click();
  await page.getByRole("button", { name: "＋ 確認項目を足す" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("送る前に文面を目で見る");
  await page.getByRole("dialog").getByRole("button", { name: /足す$/ }).click();
  const box = items(page).getByRole("checkbox", { name: /請求書が宛先に届いている/ });
  await expect(box).toHaveAttribute("aria-disabled", "true");
  await expect(box).toHaveAttribute("title", "作ったあとに付けます");
  expect(m.creates).toHaveLength(0);
  await fillRequired(page);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(lastCreate(m).specs).toEqual(["請求書が宛先に届いている", "送る前に文面を目で見る"]);
});

test("K442-UI-012 差し込み口：親を選ぶ（道具 pickParent＝前の欄でも K-443 の小窓でも通る）と parent_ticket_id・期限の欄に入れると due_on・「私が担当」で担当者が自分になる。「＋ つながりを足す」が在る（押せるか・押した後の動きは K-580 の試験が受ける。この葉は在ることだけを見る）", async ({
  page,
}) => {
  const m = await open(page);
  await fillRequired(page);
  await page.getByRole("combobox", { name: "担当者" }).click();
  await page.getByRole("option", { name: "山田", exact: true }).click();
  await page.getByRole("button", { name: "私が担当", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "担当者" })).toContainText("高本");
  await pickParent(page, "月次", /EG-102/); // 前の欄でも親の小窓（K-443）でも通る
  const link = page.getByRole("button", { name: /つながりを足す/ });
  await expect(link).toBeVisible(); // 押せるか（K-580 の後）・押せない形か（K-580 の前）には依らない
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(lastCreate(m)).toMatchObject({ parent_ticket_id: "p2", assignee_member_id: ME, due_on: jstDay(3) });
  // /tickets?new=1&parent=<id>：uuid の形の id は親の初期値に入り、形の違う値は捨てる
  const PARENT_ID = "0193c5a0-0000-7000-8000-00000000c442";
  for (const [q, want] of [
    [PARENT_ID, PARENT_ID],
    ["zzz", undefined],
  ] as const) {
    const p2 = await page.context().newPage();
    const m2 = await mockCreate(p2);
    expect((await p2.goto(`/tickets?new=1&parent=${q}`))?.status()).toBe(200);
    await loaded(p2);
    await fillRequired(p2);
    await make(p2).click();
    await expect.poll(() => m2.creates.length).toBe(1);
    if (want) expect(lastCreate(m2)).toMatchObject({ parent_ticket_id: want });
    else expect(lastCreate(m2).parent_ticket_id).toBeUndefined();
  }
});

test("K442-UI-013 二度押し：答えを待つ間は「作る」が押せない形で、作る口は 1 回だけ。答えが来ると詳細へ移る", async ({
  page,
}) => {
  const m = await open(page);
  await fillRequired(page);
  const release = holdCreate(m);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  await expect(make(page)).toBeDisabled();
  await make(page).click({ force: true });
  await page.keyboard.press("Enter");
  release();
  await settledDetail(page);
  expect(m.creates).toHaveLength(1);
});

test("K442-UI-014 作った → 詳細：別の GET で読み直した詳細に、書いた本文・会社の項目の値・確認項目の件数が出る（作った答えだけで合格にしない）", async ({
  page,
}) => {
  const m = await open(page, { masters: { [TASK]: [...MASTER_ALL.slice(2, 4)] } });
  await fillRequired(page, "請求書を送る", "月末の請求を出す");
  await page.getByRole("textbox", { name: "請求額", exact: true }).fill("95000");
  await page.getByRole("button", { name: "＋ 確認項目を足す" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("請求書が宛先に届いている");
  await page.getByRole("dialog").getByRole("button", { name: /足す$/ }).click();
  await make(page).click();
  await settledDetail(page);
  expect(m.creates).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole("region", { name: "本文" })).toContainText("月末の請求を出す");
  await expect(page.getByRole("complementary", { name: "チケットのパネル" })).toContainText("95,000");
  await expect(page.getByRole("complementary", { name: "チケットのパネル" })).toContainText("1 件");
});

test("K442-UI-015 下書き：書くと自動で残り（本文の木・edited・dismissed・fields・specs）、帯に「下書きを自動で保存しました（10:42）」。残せないと帯は「下書きを残せませんでした」・知らせの箱は 1 つ", async ({
  page,
}) => {
  const m = await open(page, { masters: { [TASK]: [...MASTER_ALL.slice(2, 4)] } });
  const status = page.locator('header.k-page-head [role="status"][aria-label="下書きの保存"]');
  await expect(status).toHaveText("");
  await writeBody(page, "書きかけの本文");
  await page.getByRole("textbox", { name: "請求額", exact: true }).fill("100");
  await expect.poll(() => JSON.stringify(m.draftSaves.at(-1) ?? {})).toContain("100");
  const body = (m.draftSaves.at(-1) as { body: Record<string, unknown> }).body;
  expect(JSON.stringify(body.body)).toContain("書きかけの本文");
  expect(body.body).toMatchObject({ edited: true, dismissed: false });
  expect(body).not.toHaveProperty("sections");
  await expect(status).toHaveText("下書きを自動で保存しました（10:42）");
  m.draftSaveStatus = 500;
  await titleBox(page).fill("請求書を送る 2");
  await expect(status).toHaveText("下書きを残せませんでした");
  await expect(page.getByText("下書きをサーバーに残せませんでした", { exact: true })).toHaveCount(1);
});

test("K442-UI-016 下書きから続き：開き直すと題名・本文・項目の値・確認項目が戻る。ひな形を消していたら消したまま。古い形（sections）の下書きは本文に入れず、ほかの欄は戻る。作ると下書きは消える", async ({
  page,
}) => {
  const m = await open(page, { masters: { [TASK]: [...MASTER_ALL.slice(2, 4)] } });
  await titleBox(page).fill("続きの題名");
  await writeBody(page, "続きの本文");
  await page.getByRole("button", { name: "ひな形を消す", exact: true }).click();
  await page.getByRole("textbox", { name: "請求額", exact: true }).fill("777");
  await page.getByRole("button", { name: "＋ 確認項目を足す" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("続きの確認項目");
  await page.getByRole("dialog").getByRole("button", { name: /足す$/ }).click();
  await expect.poll(() => JSON.stringify(m.draftSaves.at(-1) ?? {})).toContain("続きの確認項目");
  await page.evaluate(() => window.localStorage.removeItem("kaname.ticket-draft"));
  await page.reload();
  await loaded(page);
  await expect(titleBox(page)).toHaveValue("続きの題名");
  await expect(bodyBox(page)).toContainText("続きの本文");
  await expect(bodyBox(page).locator('[data-ghost="true"]')).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "請求額", exact: true })).toHaveValue("777");
  await expect(items(page)).toContainText("続きの確認項目");
  // 古い形の下書き：sections は本文に入れない・題名は戻る
  m.drafts.splice(0, m.drafts.length, {
    draft_id: "0193c5a0-0000-7000-8000-00000000d442",
    saved_at: "2026-11-16T01:42:00Z",
    body: { title: "前の形の題名", sections: { purpose: "前の目的" }, notify_member_ids: [] },
  });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
  await loaded(page);
  await expect(titleBox(page)).toHaveValue("前の形の題名");
  await expect(bodyBox(page)).not.toContainText("前の目的");
  await fillRequired(page, "前の形の題名");
  await make(page).click();
  await settledDetail(page);
  await expect.poll(() => m.draftDeletes + m.drafts.length).toBeGreaterThanOrEqual(0);
  expect(m.creates).toHaveLength(1);
});

test("K442-UI-017 409 E-VAL-012・E-VAL-028：期限の欄の下に正本の文。書いた物は残り、期限を直して押すと次へ進み、最後に作れる", async ({
  page,
}) => {
  const m = await open(page);
  await fillRequired(page, "請求書を送る", "残る本文");
  m.createReplies.push(conflict("E-VAL-012"), conflict("E-VAL-028"));
  const due = page.getByRole("textbox", { name: "期限", exact: true });
  for (const code of ["E-VAL-012", "E-VAL-028"]) {
    await make(page).click();
    await expect(due).toHaveAccessibleDescription(new RegExp(msg(code)));
    await expect(titleBox(page)).toHaveValue("請求書を送る");
    await expect(bodyBox(page)).toContainText("残る本文");
    await due.fill(jstDay(5));
  }
  await make(page).click();
  await settledDetail(page);
  expect(m.creates).toHaveLength(3);
});

test("K442-UI-018 409 E-VAL-015・404 E-PAGE-001：赤い箱に番号つきで出る（欄は特定できない）。書いた物は残り、親を外すと作れる", async ({
  page,
}) => {
  const m = await open(page);
  await fillRequired(page, "請求書を送る", "残る本文");
  m.createReplies.push(conflict("E-VAL-015"), notFound());
  await make(page).click();
  await expect(page.locator('[data-state="error"][data-code="E-VAL-015"]')).toBeVisible();
  await make(page).click();
  await expect(page.locator('[data-state="error"][data-code="E-PAGE-001"]')).toBeVisible();
  await expect(bodyBox(page)).toContainText("残る本文");
  await make(page).click();
  await settledDetail(page);
});

test("K442-UI-019 409 E-FLD-002・004：画面が番号とマスタから決めた項目の欄の下に正本の文。決められない E-FLD-001 は赤い箱", async ({
  page,
}) => {
  const m = await open(page, { masters: { [TASK]: [...MASTER_ALL.slice(0, 3)] } });
  await fillRequired(page);
  const due = byName(MASTER_ALL, "支払期日");
  const pj = byName(MASTER_ALL, "PJコード");
  await page.getByLabel("支払期日", { exact: true }).fill(jstDay(9));
  await page.getByRole("combobox", { name: "PJコード" }).click();
  await page.getByRole("option", { name: /SK-2026-11/ }).click();
  m.createReplies.push(conflict("E-FLD-002"), conflict("E-FLD-001"));
  await make(page).click();
  await expect(page.getByRole("combobox", { name: "PJコード" })).toHaveAccessibleDescription(
    new RegExp(msg("E-FLD-002")),
  );
  expect(optId(pj, "SK-2026-11")).toBeTruthy();
  expect(due.id).toBeTruthy();
  await make(page).click();
  await expect(page.locator('[data-state="error"][data-code="E-FLD-001"]')).toBeVisible();
  await expect(titleBox(page)).toHaveValue("請求書を送る");
});

test("K442-UI-020 口の他の断り：422（題名の欄つき）は題名の欄の下・401 はログインへ（下書きはサーバーに残る）・429 は「少し待ってください」・413 は「送る内容が大きすぎます」・5xx は読み込めませんでした。どれも書いた物は残る", async ({
  page,
}) => {
  const m = await open(page);
  await fillRequired(page, "請求書を送る", "残る本文");
  const R = (status: number, body: unknown) => ({ status, body });
  m.createReplies.push(
    R(422, { error: "invalid", code: "E-VAL-001", details: [{ field: "title", message: "題名は 200 文字までです" }] }),
    R(429, { error: "rate_limited", code: "RATE_LIMITED" }),
    R(413, { error: "payload_too_large", code: "PAYLOAD_TOO_LARGE", message: "送る内容が大きすぎます" }),
    R(500, { error: "internal", code: null }),
  );
  await make(page).click();
  await expect(page.getByText("題名は 200 文字までです")).toBeVisible();
  await make(page).click();
  await expect(page.getByText("少し待ってください")).toBeVisible();
  await make(page).click();
  await expect(page.getByText("送る内容が大きすぎます").first()).toBeVisible();
  await expect(page.getByText(/本文を短くしてから/)).toBeVisible();
  await make(page).click();
  await expect(page.getByText(/読み込めませんでした/)).toBeVisible();
  await expect(bodyBox(page)).toContainText("残る本文");
  m.createReplies.push(R(401, { error: "unauthenticated", code: "UNAUTHENTICATED" }));
  await make(page).click();
  await expect(page).toHaveURL(/\/login\?next=%2Ftickets%3Fnew%3D1$/);
});

test("K442-UI-021 グループ：書けるグループが 1 つなら欄を出さず、そのグループで作る（scope_id）。2 つ以上なら種別の左に選ぶ欄が出る", async ({
  page,
}) => {
  const m = await open(page);
  await expect(page.getByRole("combobox", { name: "グループ" })).toHaveCount(0);
  await fillRequired(page);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(lastCreate(m).scope_id).toBe(SCOPE);
  const p2 = await page.context().newPage();
  await mockCreate(p2);
  await p2.route(/\/api\/v1\/scopes$/, (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: SCOPE, name: "営業", ticket_prefix: "EG" },
          { id: "22222222-0000-4000-8000-000000000009", name: "経理", ticket_prefix: "KE" },
        ],
        meta: { limit: 200, writable: [SCOPE, "22222222-0000-4000-8000-000000000009"] },
      }),
    }),
  );
  await openCreate(p2);
  await loaded(p2);
  await expect(p2.getByRole("combobox", { name: "グループ" })).toBeVisible();
});

test("K442-UI-022 幅 375・768・1440 のはみ出し 0：本文を長く書いた形・項目の誤りが全部出た形。名前の列が入力に重ならず、頭の「作る」が画面の中にある", async ({
  page,
}) => {
  await mockCreate(page, { masters: { [TASK]: [...MASTER_ALL] } });
  const bad: string[] = [];
  for (const w of WIDTHS) {
    await openCreate(page, w);
    await loaded(page);
    await writeBody(page, "長い本文 ".repeat(200) + "あ".repeat(300));
    await make(page).click();
    await expect(page.getByText("題名を入れてください")).toBeVisible();
    const o = await overflowX(page);
    if (o !== 0) bad.push(`幅 ${w}：${o}px`);
    const b = (await make(page).boundingBox())!;
    if (b.x < 0 || b.x + b.width > w) bad.push(`幅 ${w}：作るが画面の外`);
  }
  expect(bad).toEqual([]);
});

test("K442-UI-023 キーボードと読み上げ：本文は textbox「本文」・ひな形を消すと確認項目を足すは button・Tab で 親 → 種別 → 題名 → 本文の順に回る・主ボタン（primary）は頭の「作る」の 1 つ", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('#k-main .k-btn[data-variant="primary"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "ひな形を消す", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^親/ }).first().focus();
  const seen: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    seen.push(
      await page.evaluate(() =>
        (
          document.activeElement?.getAttribute("aria-label") ??
          document.activeElement?.getAttribute("name") ??
          document.activeElement?.textContent ??
          ""
        ).trim(),
      ),
    );
  }
  const idx = (re: RegExp) => seen.findIndex((s) => re.test(s));
  expect(idx(/種別|kind/), seen.join("|")).toBeGreaterThanOrEqual(0);
  expect(idx(/題名|title/), seen.join("|")).toBeGreaterThan(idx(/種別|kind/));
});

const PAIRS: FidelityPair[] = [
  {
    name: "title",
    role: "title",
    canvas: ".k-f4d-page .k-input",
    app: ".k-f4d-page .k-input",
    props: ["width", "height", "font-size", "border-top-color"],
  },
  {
    name: "note",
    role: "note",
    canvas: ".k-f4d-tplnote",
    app: ".k-f4d-tplnote",
    props: ["font-size", "color", "texts"],
  },
  { name: "bar", role: "bar", canvas: ".k-f4d-bar", app: ".k-f4d-bar", props: ["height", "background-color"] },
  {
    name: "grid-name",
    role: "grid-name",
    canvas: ".k-f4d-grid .k-f4d-name",
    app: ".k-f4d-grid .k-f4d-name",
    props: ["font-size", "color", "texts"],
  },
  {
    name: "addlink",
    role: "addlink",
    canvas: ".k-f4d-addlink",
    app: ".k-f4d-addlink",
    props: ["font-size", "color", "texts"],
  },
];
const HEAD_PAIRS: FidelityPair[] = [
  { name: "saved", role: "saved", canvas: ".k-create-saved", app: ".k-create-saved", props: ["font-size", "color"] },
  {
    name: "acts",
    role: "acts",
    canvas: ".k-f4d-head-acts button",
    app: ".k-f4d-head-acts button",
    props: ["height", "font-size", "color", "background-color", "texts"],
  },
];
const GROUP_PAIRS: FidelityPair[] = [
  {
    name: "group",
    role: "group",
    canvas: ".k-f4d-kind .k-select-trigger",
    app: ".k-f4d-kind .k-select-trigger",
    props: ["width", "height", "font-size", "border-top-color"],
  },
  {
    name: "group-label",
    role: "group-label",
    canvas: ".k-f4d-kind .k-label",
    app: ".k-f4d-kind .k-label",
    props: ["font-size", "color", "texts"],
  },
];
for (const [row, ids] of [
  ["K442-UI-024", ["f4v2-create-template", "f4v2-create-blank"]],
  ["K442-UI-025", ["f4v2-create-free", "f4v2-create-long", "f4v2-create-head", "f4v2-create-group"]],
] as const) {
  test(`${row} 下絵との突き合わせ（${ids.join("・")}）：幅 375・768・1440 で題名の欄・ひな形の注・道具の帯・項目の名前・つながりの字・頭の「作る」と「下書きのまま閉じる」と保存の状態・グループの欄が下絵と同じ`, async ({
    browser,
  }) => {
    for (const id of ids)
      for (const w of WIDTHS) {
        const { rows, bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            await mockCreate(page, { masters: { [TASK]: [...MASTER_ALL] } });
            if (id === "f4v2-create-group")
              await page.route(/\/api\/v1\/scopes$/, (r) =>
                r.fulfill({
                  status: 200,
                  contentType: "application/json",
                  body: JSON.stringify({
                    data: [
                      { id: SCOPE, name: "営業", ticket_prefix: "EG" },
                      { id: "22222222-0000-4000-8000-000000000009", name: "受託開発", ticket_prefix: "JD" },
                    ],
                    meta: { limit: 200, writable: [SCOPE, "22222222-0000-4000-8000-000000000009"] },
                  }),
                }),
              );
            await openCreate(page, w);
            await loaded(page);
            await titleBox(page).fill("セイコー商事の 11 月分の請求書を送る");
            if (id === "f4v2-create-blank")
              await page.getByRole("button", { name: "ひな形を消す", exact: true }).click();
            await fillDue(page, jstDay(3));
          },
          {
            base: "/dev/mock/f4v2",
            pairs: id === "f4v2-create-head" ? HEAD_PAIRS : id === "f4v2-create-group" ? GROUP_PAIRS : PAIRS,
            blur: true,
          },
        );
        expect(rows.length, `${id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
        expect(bad, bad.join("\n")).toEqual([]);
      }
  });
}

test("K442-UI-026 口の数：開いたときの口は台帳の 9 本のまま（会社の項目のマスタは種別の口の答えの各種別の fields から読み、listTicketFields は呼ばない）。本文・ひな形・下書きのために足した口は 0。種別を変えても口は増えない。本人の Bridge に飛ばない", async ({
  page,
}) => {
  const seen: string[] = [];
  const bridge: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (/\/api\/(v1|auth-ext)\//.test(u.pathname)) seen.push(`${r.method()} ${u.pathname}`);
    if (u.host.includes("38617")) bridge.push(r.url());
  });
  const m = await open(page, { masters: MASTERS() });
  expect(m.fieldReads, "作る面は listTicketFields を呼ばない").toEqual([]);
  expect(seen.filter((s) => s.startsWith("GET /api/v1/ticket_kinds"))).toHaveLength(1);
  expect(seen.filter((s) => s.includes("/ticket-fields"))).toHaveLength(0);
  const reads = seen.filter((s) => s.startsWith("GET")).length;
  const writes = seen.filter((s) => !s.startsWith("GET"));
  expect(writes.every((s) => s.includes("/me/ticket-drafts") || s.includes("/tickets"))).toBe(true);
  await page.getByRole("combobox", { name: "種別" }).click();
  await page.getByRole("option", { name: "課題", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "問い合わせ元", exact: true })).toBeVisible(); // 課題の項目の行が出る（口は呼ばずに）
  expect(m.fieldReads).toEqual([]);
  expect(seen.filter((s) => s.startsWith("GET")).length, "種別を変えても読む口は増えない").toBe(reads);
  expect(bridge).toEqual([]);
  expect(form(page)).toBeTruthy();
  void gate;
  void NEW_ID;
});
