// K-580「作る面の ＋ つながりを足す」の画面の試験（実 Chrome）。行 ID は 11_tickets/K-580.md の行の表（K580-UI-001〜023。UN は apps/web/test/k580-create-links.test.ts）。
//   正の絵：下絵 v2 の作る面 k-f4d-addlink（/dev/mock/f4v2/f4v2-create-*）に、つながりを足した後の形 f4v2-create-links と小窓 f4v2-create-link-add（下絵に足してもらう・K-580 の頼み）。
//   口は網の手前で差し替える：create-mock.ts の mockCreate（一覧の口は catalog の行を q で探す・作る口の断りは createReplies・作った後の詳細とつながりの口は最後に作った体の links から組む）。
//   つながりは作るとき createTicket の links（[{ kind, other_ticket_id }]）で 1 つの取引で張る（K-437 に足す・作る前は口を呼ばない）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  ISSUE,
  NEW_ID,
  SCOPE,
  TASK,
  bodyBox,
  fillDue,
  fillRequired,
  holdCreate,
  jstDay,
  loaded,
  mockCreate,
  openCreate,
  overflowX,
  settledDetail,
  type CatalogRow,
  type CreateMock,
  type Reply,
} from "./create-mock";
import { FORBIDDEN_TEXT, notFound } from "./items-mock";
import { matchMock } from "./stage2-match";

const WIDTHS = [375, 768, 1440] as const;
const DONE = { id: "st-done", key: "done", name: "完了" };
const DOING = { id: "st-doing", key: "doing", name: "作業中" };
const TODO = { id: "st-todo", key: "todo", name: "未着手" };
const SC_EG = { id: SCOPE, name: "営業" };
const SC_KR = { id: "sc-kr", name: "経理" };
const SC_JD = { id: "sc-jd", name: "受託開発" };
const row = (n: number, number: string, title: string, stage = TODO, scope = SC_EG): CatalogRow => ({
  id: `6c000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  number,
  title,
  depth: 1,
  stage,
  scope,
});
/** モック f4-link-add と同じ人たち（番号・題名・段・グループ） */
const A = row(5, "EG-097", "セイコー様 保守契約の見積", DONE);
const B = row(3, "EG-110", "山田様からの問い合わせを受ける", DONE);
const C = row(6, "KR-031", "入金の照合（11月分）", TODO, SC_KR);
// JD-150 のグループは下絵と同じ受託開発（下絵 f4v2-create-link-add を候補 2 件に描き直して突き合わせに入った・2026-11-28 answer=13cf83d4f60d）
const D = row(4, "JD-150", "京蟻 保守運用（年間）", DOING, SC_JD);
const LONG = row(9, "EG-199", `とても長い題名の相手 ${"あ".repeat(80)}`, DOING);
const CATALOG = [A, B, C, D, LONG];

const make = (page: Page) => page.locator("header.k-page-head").getByRole("button", { name: "作る", exact: true });
const addBtn = (page: Page) => page.getByRole("button", { name: /つながりを足す/ });
const dlg = (page: Page) => page.getByRole("dialog", { name: "つながりを足す", exact: true });
const chosen = (page: Page) => page.getByRole("list", { name: "足したつながり", exact: true });
const unlink = (page: Page, number: string) =>
  page.getByRole("button", { name: `${number} とのつながりを外す`, exact: true });
const confirm = (page: Page) => dlg(page).getByRole("button", { name: "足す", exact: true });
const queryBox = (page: Page) => dlg(page).getByRole("textbox", { name: "チケットを探す", exact: true });
const cand = (page: Page, number: string) => dlg(page).getByRole("button", { name: new RegExp(number) });
type Sent = { links?: { kind: string; other_ticket_id: string }[] } & Record<string, unknown>;
const lastCreate = (m: CreateMock): Sent => m.creates[m.creates.length - 1] as Sent;
const draftLinks = (m: CreateMock): { kind: string; id: string; number: string }[] =>
  (m.draftSaves.at(-1) as { body?: { links?: { kind: string; id: string; number: string }[] } } | undefined)?.body
    ?.links ?? [];
const draftOf = (links: unknown): CreateMock["drafts"][number] => ({
  draft_id: "0193c5a0-0000-7000-8000-00000000d580",
  saved_at: "2026-11-16T01:42:00Z",
  body: { title: "下書きの題名", links, notify_member_ids: [] },
});
const asDraft = (c: CatalogRow, kind: "related" | "derived_from") => ({
  kind,
  id: c.id,
  number: c.number,
  title: c.title,
  stage: { key: c.stage?.key, name: c.stage?.name },
});

async function open(page: Page, o: Partial<CreateMock> = {}, width = 1440): Promise<CreateMock> {
  const m = await mockCreate(page, { catalog: CATALOG, ...o });
  await openCreate(page, width);
  await loaded(page);
  await expect(bodyBox(page)).toBeVisible();
  return m;
}
/** 小窓を開き、種類（既定は関連）・探す字・候補を選んで「足す」を押す。小窓が閉じるまで待つ */
async function pick(page: Page, q: string, c: CatalogRow, kind: "related" | "derived_from" = "related"): Promise<void> {
  await addBtn(page).click();
  const d = dlg(page);
  await expect(d).toBeVisible();
  await d.getByRole("radio", { name: kind === "derived_from" ? /^派生元/ : /^関連/ }).check();
  await queryBox(page).fill(q);
  await cand(page, c.number).click();
  await confirm(page).click();
  await expect(d).toHaveCount(0);
}
const items = (page: Page) => chosen(page).getByRole("listitem");

test("K580-UI-001 入口：本文の下・項目の表の上に「＋ つながりを足す」（ヒント「関連・派生元のチケットを足します」）が押せる形で出る。まだ足していないときは足した一覧は出ない", async ({
  page,
}) => {
  await open(page);
  const btn = addBtn(page);
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
  await expect(btn).not.toHaveAttribute("aria-disabled", "true");
  await expect(btn).toContainText("関連・派生元のチケットを足します");
  const y = async (l: ReturnType<Page["locator"]>) => (await l.first().boundingBox())!.y;
  expect(await y(bodyBox(page))).toBeLessThan(await y(btn));
  expect(await y(btn)).toBeLessThan(await y(page.getByRole("group", { name: "項目", exact: true })));
  await expect(chosen(page)).toHaveCount(0);
});

test("K580-UI-002 小窓を開く：「つながりを足す」の小窓に「今あるチケットとつなぐ」だけが出て「子チケットを作る」は出ない。対象の字は題名が無ければ「作成中のチケット」・あれば「作成中：<題名>」。開いても口は呼ばれない", async ({
  page,
}) => {
  const m = await open(page);
  const before = m.listCalls.length;
  await addBtn(page).click();
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page)).toContainText("今あるチケットとつなぐ");
  await expect(dlg(page).getByText("子チケットを作る")).toHaveCount(0);
  await expect(dlg(page)).toContainText("作成中のチケット");
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await page.getByRole("textbox", { name: "題名", exact: true }).fill("請求書を送る");
  await addBtn(page).click();
  await expect(dlg(page)).toContainText("作成中：請求書を送る");
  expect(m.listCalls.length).toBe(before);
  expect(m.creates).toHaveLength(0);
});

test("K580-UI-003 探す：打ち終わってから 1 回だけ一覧の口（view=all・q・limit=20）を呼び、候補が番号・題名・グループ名・段の札で出る。字を消すと呼ばない", async ({
  page,
}) => {
  const m = await open(page);
  await addBtn(page).click();
  const before = m.listCalls.length;
  await queryBox(page).pressSequentially("保守");
  await expect(cand(page, "EG-097")).toBeVisible();
  await expect(cand(page, "JD-150")).toBeVisible();
  const made = m.listCalls.slice(before);
  expect(made).toHaveLength(1);
  expect(made[0]!.get("q")).toBe("保守");
  expect(made[0]!.get("view")).toBe("all");
  expect(made[0]!.get("limit")).toBe("20");
  await expect(cand(page, "EG-097")).toContainText("セイコー様 保守契約の見積");
  await expect(cand(page, "EG-097")).toContainText("営業");
  await expect(cand(page, "EG-097")).toContainText("完了");
  await queryBox(page).fill("入金");
  await expect(cand(page, "KR-031")).toContainText("経理");
  const after = m.listCalls.length;
  await queryBox(page).fill("");
  await expect(cand(page, "KR-031")).toHaveCount(0);
  expect(m.listCalls.length).toBe(after);
});

test("K580-UI-004 足す（関連）：候補を選んで「足す」を押すと小窓が閉じ、作る面に「関連・EG-097・題名」の行と「外す」が出る。作る口もつながりの口も呼ばれず、下書きに links（種類・id・番号）が残る", async ({
  page,
}) => {
  const m = await open(page);
  await pick(page, "保守", A);
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("関連");
  await expect(items(page).first()).toContainText("EG-097");
  await expect(items(page).first()).toContainText("セイコー様 保守契約の見積");
  await expect(unlink(page, "EG-097")).toBeVisible();
  expect(m.creates).toHaveLength(0);
  await expect.poll(() => draftLinks(m).map((x) => [x.kind, x.id, x.number])).toEqual([["related", A.id, "EG-097"]]);
});

test("K580-UI-005 足す（派生元・複数）：派生元の行は関連の行より上に並ぶ（それぞれ足した順）。足した順が違っても並びは同じ", async ({
  page,
}) => {
  await open(page);
  await pick(page, "保守運用", D, "related");
  await pick(page, "保守契約", A, "derived_from");
  await pick(page, "問い合わせ", B, "related");
  await expect(items(page)).toHaveCount(3);
  const texts = await items(page).allTextContents();
  expect(texts.map((t) => (/EG-097/.test(t) ? "A" : /JD-150/.test(t) ? "D" : "B"))).toEqual(["A", "D", "B"]);
  expect(texts[0]).toContain("派生元");
  expect(texts[1]).toContain("関連");
});

test("K580-UI-006 選べない候補：足した相手は同じ種類では「もうつながっている」で押せない（aria-disabled）。種類を替えると同じ相手を足せる。選んだ後に種類を替えて選べなくなったら選びが外れて「足す」が押せない", async ({
  page,
}) => {
  await open(page);
  await pick(page, "保守契約", A, "related");
  await addBtn(page).click();
  const d = dlg(page);
  await queryBox(page).fill("保守契約");
  await expect(cand(page, "EG-097")).toHaveAttribute("aria-disabled", "true");
  await expect(cand(page, "EG-097")).toContainText("もうつながっている");
  await d.getByRole("radio", { name: /^派生元/ }).check();
  await expect(cand(page, "EG-097")).not.toHaveAttribute("aria-disabled", "true");
  await cand(page, "EG-097").click();
  await expect(confirm(page)).toBeEnabled();
  await d.getByRole("radio", { name: /^関連/ }).check();
  await expect(cand(page, "EG-097")).toHaveAttribute("aria-disabled", "true");
  await expect(confirm(page)).toBeDisabled();
  await d.getByRole("radio", { name: /^派生元/ }).check();
  await cand(page, "EG-097").click();
  await confirm(page).click();
  await expect(items(page)).toHaveCount(2);
});

test("K580-UI-007 外す：「外す」で行が消え、下書きからも消え、その相手はまた選べる。口は呼ばれない", async ({
  page,
}) => {
  const m = await open(page);
  await pick(page, "保守契約", A);
  await pick(page, "問い合わせ", B);
  const before = m.listCalls.length;
  await unlink(page, "EG-097").click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("EG-110");
  await expect.poll(() => draftLinks(m).map((x) => x.number)).toEqual(["EG-110"]);
  await addBtn(page).click();
  await queryBox(page).fill("保守契約");
  await expect(cand(page, "EG-097")).not.toHaveAttribute("aria-disabled", "true");
  expect(m.creates).toHaveLength(0);
  expect(m.listCalls.length).toBe(before + 1);
});

test("K580-UI-008 作る：足した相手が作る口の links に [{ kind, other_ticket_id }] だけで届く（派生元 → 関連の順）。足していなければ links の鍵が無い（体の鍵は前のまま）", async ({
  page,
  context,
}) => {
  const m = await open(page);
  await pick(page, "保守契約", A, "related");
  await pick(page, "問い合わせ", B, "derived_from");
  await fillRequired(page);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(lastCreate(m).links).toEqual([
    { kind: "derived_from", other_ticket_id: B.id },
    { kind: "related", other_ticket_id: A.id },
  ]);
  for (const l of lastCreate(m).links!) expect(Object.keys(l).sort()).toEqual(["kind", "other_ticket_id"]);
  expect(JSON.stringify(lastCreate(m))).not.toContain("セイコー");
  const p2 = await context.newPage();
  const m2 = await mockCreate(p2, { catalog: CATALOG });
  await openCreate(p2);
  await loaded(p2);
  await fillRequired(p2);
  await make(p2).click();
  await expect.poll(() => m2.creates.length).toBe(1);
  expect(Object.keys(lastCreate(m2))).not.toContain("links");
});

test("K580-UI-009 作った → 詳細：別の GET で読み直した詳細のつながりのカードに「つながり 2」が出て、「開く」で EG-110・EG-097 の行が出る（作った答えだけで合格にしない）", async ({
  page,
}) => {
  const m = await open(page);
  await pick(page, "保守契約", A, "related");
  await pick(page, "問い合わせ", B, "derived_from");
  await fillRequired(page);
  await make(page).click();
  await settledDetail(page);
  expect(m.creates).toHaveLength(1);
  await page.reload();
  const card = page.getByRole("region", { name: "子チケット・つながり", exact: true });
  await expect(card).toContainText("つながり 2");
  await card.getByRole("button", { name: "開く", exact: true }).click();
  await expect(card).toContainText("EG-110");
  await expect(card).toContainText("EG-097");
  await expect(card).toContainText("派生元");
  expect(m.creates).toHaveLength(1);
});

test("K580-UI-010 下書き：足すと下書きに残り、開き直すと行が戻る（作ると links が届く）。links の無い古い下書き・形の違う行は捨てて、題名などは戻る", async ({
  page,
}) => {
  const m = await open(page);
  await pick(page, "保守契約", A, "derived_from");
  await expect.poll(() => draftLinks(m).length).toBe(1);
  await page.evaluate(() => window.localStorage.removeItem("kaname.ticket-draft"));
  await page.reload();
  await loaded(page);
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("派生元");
  await fillRequired(page);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(lastCreate(m).links).toEqual([{ kind: "derived_from", other_ticket_id: A.id }]);
  const p2 = await page.context().newPage();
  const m2 = await mockCreate(p2, {
    catalog: CATALOG,
    drafts: [
      draftOf([
        { ...asDraft(A, "related"), kind: "blocks" },
        { ...asDraft(B, "related"), id: 5 },
        asDraft(C, "related"),
      ]),
    ],
  });
  await openCreate(p2);
  await loaded(p2);
  await expect(p2.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("下書きの題名");
  await expect(chosen(p2).getByRole("listitem")).toHaveCount(1);
  await expect(chosen(p2)).toContainText("KR-031");
  const p3 = await page.context().newPage();
  await mockCreate(p3, { catalog: CATALOG, drafts: [draftOf("x")] });
  await openCreate(p3);
  await loaded(p3);
  await expect(p3.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("下書きの題名");
  await expect(chosen(p3)).toHaveCount(0);
  expect(m2.creates).toHaveLength(0);
});

test("K580-UI-011 404（選んだ相手が消えた・見えなくなった）：赤い箱に番号つき（E-PAGE-001）で出る。足した行と書いた物は残り、その行を外して押し直すと links 無しで作れる", async ({
  page,
}) => {
  const m = await open(page);
  await pick(page, "保守契約", A);
  await fillRequired(page, "請求書を送る", "残る本文");
  m.createReplies.push(notFound());
  await make(page).click();
  await expect(page.locator('[data-state="error"][data-code="E-PAGE-001"]')).toBeVisible();
  await expect(items(page)).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("請求書を送る");
  await expect(bodyBox(page)).toContainText("残る本文");
  await unlink(page, "EG-097").click();
  await make(page).click();
  await settledDetail(page);
  expect(m.creates).toHaveLength(2);
  expect(Object.keys(lastCreate(m))).not.toContain("links");
});

test("K580-UI-012 403（相手に書けない）：赤い箱に既定の文（K-452 と同じ 1 つの文）が出る。足した行・書いた物は残り、作った物は無い", async ({
  page,
}) => {
  const m = await open(page);
  await pick(page, "保守契約", A);
  await fillRequired(page);
  m.createReplies.push({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  await make(page).click();
  await expect(page.getByRole("alert").filter({ hasText: FORBIDDEN_TEXT })).toBeVisible();
  await expect(items(page)).toHaveCount(1);
  expect(m.creates).toHaveLength(1);
  await expect(page).toHaveURL(/\/tickets\?new=1/);
});

test("K580-UI-013 422（links.0 の欄つき）：赤い箱に出る。足した行は残り、押し直せる", async ({ page }) => {
  const m = await open(page);
  await pick(page, "保守契約", A);
  await fillRequired(page);
  const bad: Reply = {
    status: 422,
    body: {
      error: "validation_failed",
      code: "VALIDATION_ERROR",
      details: [{ field: "links.0", message: "つながりの形が違います" }],
    },
  };
  m.createReplies.push(bad);
  await make(page).click();
  await expect(page.locator('[data-state="error"]')).toBeVisible();
  await expect(items(page)).toHaveCount(1);
  await make(page).click();
  await settledDetail(page);
  expect(m.creates).toHaveLength(2);
});

test("K580-UI-014 失敗（探す口が落ちる）：探す欄の下に「候補を読み込めませんでした」が出て「足す」は押せない。口が戻れば探し直せる", async ({
  page,
}) => {
  const m = await open(page);
  m.listStatus = 500;
  await addBtn(page).click();
  await queryBox(page).fill("保守");
  await expect(dlg(page).getByText("候補を読み込めませんでした")).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  m.listStatus = 200;
  await queryBox(page).fill("保守運用");
  await expect(cand(page, "JD-150")).toBeVisible();
  await cand(page, "JD-150").click();
  await expect(confirm(page)).toBeEnabled();
});

test("K580-UI-015 二度押し：答えを待つ間は「作る」も「外す」も押せない形で、作る口は 1 回・links も 1 回分。答えが来ると詳細へ移る", async ({
  page,
}) => {
  const m = await open(page);
  await pick(page, "保守契約", A);
  await fillRequired(page);
  const release = holdCreate(m);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  await expect(make(page)).toBeDisabled();
  await expect(unlink(page, "EG-097")).toBeDisabled();
  await page.keyboard.press("Enter");
  release();
  await settledDetail(page);
  expect(m.creates).toHaveLength(1);
  expect(lastCreate(m).links).toHaveLength(1);
});

test("K580-UI-016 上限：20 件足してある（下書きから戻した）と「＋ つながりを足す」が押せない形になり「つながりは 20 件までです」が出る。1 件外すと押せる", async ({
  page,
}) => {
  const many = Array.from({ length: 20 }, (_v, i) =>
    asDraft(row(100 + i, `EG-${300 + i}`, `相手 ${i}`), i % 2 === 0 ? "related" : "derived_from"),
  );
  await open(page, { drafts: [draftOf(many)] });
  await expect(items(page)).toHaveCount(20);
  await expect(addBtn(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("つながりは 20 件までです")).toBeVisible();
  await unlink(page, "EG-300").click();
  await expect(items(page)).toHaveCount(19);
  await expect(addBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(addBtn(page)).toBeEnabled();
});

test("K580-UI-017 種別を変えても足した相手は残る（種別に依らない）。作ると links は同じ", async ({ page }) => {
  const m = await open(page);
  await pick(page, "保守契約", A);
  await page.getByRole("combobox", { name: "種別" }).click();
  await page.getByRole("option", { name: "課題", exact: true }).click();
  await expect(items(page)).toHaveCount(1);
  await fillRequired(page);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect((lastCreate(m) as { kind_id?: string }).kind_id).toBe(ISSUE);
  expect(lastCreate(m).links).toEqual([{ kind: "related", other_ticket_id: A.id }]);
  void TASK;
});

test("K580-UI-018 やめる・Esc：何も足さずに閉じ、焦点は「＋ つながりを足す」に戻る。開き直すと探す字も選びも空", async ({
  page,
}) => {
  await open(page);
  await addBtn(page).click();
  await queryBox(page).fill("保守契約");
  await cand(page, "EG-097").click();
  await expect(confirm(page)).toBeEnabled();
  await dlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(chosen(page)).toHaveCount(0);
  await expect(addBtn(page)).toBeFocused();
  await addBtn(page).click();
  await expect(queryBox(page)).toHaveValue("");
  await expect(confirm(page)).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await expect(addBtn(page)).toBeFocused();
});

test("K580-UI-019 幅 375・768・1440 のはみ出し 0：長い題名の相手を足した形と、小窓を開いた形。小窓は画面の中に収まる", async ({
  page,
}) => {
  const bad: string[] = [];
  const drafts = [draftOf([asDraft(LONG, "related"), asDraft(A, "derived_from")])];
  await mockCreate(page, { catalog: CATALOG, drafts });
  for (const w of WIDTHS) {
    await openCreate(page, w);
    await loaded(page);
    await expect(items(page)).toHaveCount(2);
    const o = await overflowX(page);
    if (o !== 0) bad.push(`幅 ${w}（足した形）：${o}px`);
    await addBtn(page).click();
    await expect(dlg(page)).toBeVisible();
    await queryBox(page).fill("とても長い");
    await expect(cand(page, "EG-199")).toBeVisible();
    const o2 = await overflowX(page);
    if (o2 !== 0) bad.push(`幅 ${w}（小窓）：${o2}px`);
    const b = (await dlg(page).boundingBox())!;
    if (b.x < 0 || b.x + b.width > w) bad.push(`幅 ${w}：小窓が画面の外`);
    await page.keyboard.press("Escape");
    await expect(dlg(page)).toHaveCount(0);
  }
  expect(bad).toEqual([]);
});

test("K580-UI-020 キーボードと読み上げ：「＋ つながりを足す」は button・足した行の「外す」は「<番号> とのつながりを外す」で、Tab で足した順（上から）に回る。小窓は名前「つながりを足す」の dialog", async ({
  page,
}) => {
  await open(page);
  await pick(page, "保守契約", A, "derived_from");
  await pick(page, "保守運用", D, "related");
  await addBtn(page).focus();
  await page.keyboard.press("Tab");
  await expect(unlink(page, "EG-097")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(unlink(page, "JD-150")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(items(page)).toHaveCount(1);
  await addBtn(page).press("Enter");
  await expect(dlg(page)).toBeVisible();
});

const PAIRS: FidelityPair[] = [
  {
    name: "addlink",
    role: "addlink",
    canvas: ".k-f4d-addlink",
    app: ".k-f4d-addlink",
    props: ["width", "height", "font-size", "color", "texts"],
  },
  {
    name: "chosen-row",
    role: "chosen-row",
    canvas: ".k-f4d-chosen-row",
    app: ".k-f4d-chosen-row",
    props: ["width", "height", "font-size", "color", "texts"],
  },
  {
    name: "chosen-kind",
    role: "chosen-kind",
    canvas: ".k-f4d-chosen-kind",
    app: ".k-f4d-chosen-kind",
    props: ["font-size", "color", "background-color", "texts"],
  },
  {
    name: "chosen-unlink",
    role: "chosen-unlink",
    canvas: ".k-f4d-chosen-row button",
    app: ".k-f4d-chosen-row button",
    props: ["height", "font-size", "color"],
  },
  {
    name: "types",
    role: "types",
    canvas: ".k-f4-links-types",
    app: ".k-f4-links-types",
    props: ["width", "height", "texts"],
  },
  {
    name: "cand",
    role: "cand",
    canvas: ".k-f4-links-cand",
    app: ".k-f4-links-cand",
    props: ["height", "font-size", "color", "background-color", "texts"],
  },
];
for (const [row_, id] of [
  ["K580-UI-021", "f4v2-create-links"],
  ["K580-UI-022", "f4v2-create-link-add"],
] as const) {
  test(`${row_} 下絵との突き合わせ（${id}）：幅 375・768・1440 で${id === "f4v2-create-links" ? "足した行の字・種類の札・外すの高さと色" : "小窓の種類・候補の行の字と高さと色"}が下絵と同じ`, async ({
    browser,
  }) => {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockCreate(page, { catalog: CATALOG });
          await openCreate(page, w);
          await loaded(page);
          await page.getByRole("textbox", { name: "題名", exact: true }).fill("セイコー商事の 11 月分の請求書を送る");
          await fillDue(page, jstDay(3));
          if (id === "f4v2-create-links") {
            await pick(page, "保守契約", A, "related");
            await pick(page, "問い合わせ", B, "derived_from");
          } else {
            await addBtn(page).click();
            await queryBox(page).fill("保守");
            await cand(page, "EG-097").click();
          }
        },
        { base: "/dev/mock/f4v2", pairs: PAIRS, blur: true },
      );
      expect(rows.length, `${id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  });
}

test("K580-UI-023 口の数：作る面を開いても小窓を開いても一覧の口は 0 回・探すと打ち終わりごとに 1 回・足す／外すでは 0 回。作ると作る口は 1 回で、つながりの口（/links）への書き込みは 0。本人の Bridge に飛ばない", async ({
  page,
}) => {
  const seen: string[] = [];
  const bridge: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (/\/api\/(v1|auth-ext)\//.test(u.pathname)) seen.push(`${r.method()} ${u.pathname}${u.search}`);
    if (u.host.includes("38617")) bridge.push(r.url());
  });
  const m = await open(page);
  const lists = () => seen.filter((s) => s.startsWith("GET /api/v1/tickets?")).length;
  expect(lists()).toBe(0);
  await addBtn(page).click();
  await expect(dlg(page)).toBeVisible();
  expect(lists()).toBe(0);
  await queryBox(page).fill("保守契約");
  await expect(cand(page, "EG-097")).toBeVisible();
  expect(lists()).toBe(1);
  await cand(page, "EG-097").click();
  await confirm(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await unlink(page, "EG-097").click();
  expect(lists()).toBe(1);
  await pick(page, "問い合わせ", B);
  await fillRequired(page);
  await make(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(seen.filter((s) => s.startsWith("POST /api/v1/tickets") && s.includes("/links"))).toEqual([]);
  expect(seen.filter((s) => s === "POST /api/v1/tickets")).toHaveLength(1);
  expect(bridge).toEqual([]);
  void NEW_ID;
});
