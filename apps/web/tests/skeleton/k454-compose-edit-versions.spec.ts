// K-454 中間テスト（段 5・M1）：作る（K-442・K-569・K-450）→ 中身を書く・直す（K-447・K-571・K-569）→ 版と差分で戻す（K-449）を、本物のブラウザ・本物の DB・本物の口で 1 本の筋としてつなぐ
//   （段 5 の中間テスト 1・D-128.131）。中の 1 本 1 本の分岐は単体の試験（口：apps/api/test/features/F4・画面：apps/web/tests/k の k442〜k450・k569〜k574）が持つ。
//   ここは「つないだときにだけ出るもの」を見る：作る面で書いた本文・会社の項目・確認項目が作った詳細にそのまま出るか・本文を書き終えるたびに版が 1 つずつ増えて戻すと新しい版が足されるか・
//   戻しても項目と確認項目は変わらないか・更新の行がやり取りに並ぶか・別の人（別のタブ）が先に直したとき書いた中身が残るか。
//   口は網の手前で差し替えない（page.route で答えを作らない。1 人目だけ届く頭 x-forwarded-for を足す・K-64 と同じ）。準備は DB に直に入れる（会社の項目のマスタは段 10 まで画面が無い）。
//   人は newcomer.ts（登録の画面と受け箱）。PC・AI・メールは使わない。固定の待ちは置かない（押した結果は口の答え・画面の要素・DB の値が変わるのを待つ）。
//   ★前提：CI の web の組の G59 と同じ（API を試験の受け箱へ・画面は BASE_URL）。★組の葉が全部入った後に初めて流れる（この葉の CI だけがこの試験を選ぶ）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { expect, test } from "@playwright/test";
import {
  BAND_TITLE,
  addField,
  appendAndFinish,
  bodyAt,
  bodyBox,
  bodyNow,
  changeRowsOf,
  conflictBand,
  diffList,
  editBtn,
  editItem,
  fieldValuesOf,
  fillAndCreate,
  finishBody,
  goVersionsFromDetail,
  makeBtn,
  makeTicket,
  openCreateFromMenu,
  openSpecs,
  openTalk,
  openTicket,
  pairOf,
  readBody,
  restoreBody,
  restoreBtn,
  specBox,
  specsBlock,
  specsOf,
  startEdit,
  tagOf,
  typeAtEnd,
  verList,
  versionsUrl,
  docOf,
  para,
  itemsTab,
  type Node,
} from "../_lib/f4-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp } from "../_lib/newcomer";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
// 1 本の上限：登録（画面とメール）・準備・画面の行き来が 1 本に 8〜15 回。CI の台は VM が同時に走るので 150 秒
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 70);
});

/** 文言（K-442〜K-449・K-571・K-574 の md・画面の試験・errors.json の正本から。実装から書かない） */
const MSG = {
  template: "種別「タスク」のひな形が入っています。消しても、自由に書き換えても構いません", // K-442
  conflictCode: "E-SEC-004", // 本文の版が合わない（K-432）
  onlyBody: "本文を直しました", // 更新の行の文（K-574）
  restored: (n: number): string => `本文を版 ${n} に戻しました`, // 更新の行の文（K-574）
  needOwner: /先方の担当者名を.*ください/, // 会社の必須の項目が空（K-569）
} as const;
const WRITTEN = "月末の請求を出す";
const SPECS = ["請求書が宛先に届いている", "送る前に文面を目で見る"] as const;
const ADDED = "（控えを残す）";
const idsOf = (rows: { field: string }[]): string[] => rows.map((r) => r.field);

test("K454-M1-01 作る：ひな形のある種別で本文を自由に書き・会社の必須の項目を入れ・確認項目を 2 つ足して作る → 詳細に本文・項目・確認項目がそのまま出る（作ったときは更新の行を足さない）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m1-01");
  const owner = await addField(me, "先方の担当者名", "short_text", { required: true, position: 1 });
  await addField(me, "請求額", "number", { position: 2 });
  const title = `請求書を送る 中間5 ${tagOf("m1-01")}`;
  await openCreateFromMenu(page);
  // ひな形：薄い字の節と注・「ひな形を消す」が出る
  await expect(bodyBox(page).locator('[data-ghost="true"]').first()).toBeVisible();
  await expect(page.getByText(MSG.template)).toBeVisible();
  await expect(page.getByRole("button", { name: "ひな形を消す", exact: true })).toBeVisible();
  // 必須の項目が空だと作る口へ届かず、欄の下に赤い字（入れると通る）
  await page.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "担当者", exact: true }).click();
  await page.getByRole("option", { name: me.name, exact: true }).click();
  await page
    .getByRole("textbox", { name: "期限", exact: true })
    .fill(new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10));
  await makeBtn(page).click();
  await expect(pairOf(page, "先方の担当者名")).toContainText(MSG.needOwner);
  await expect(page).toHaveURL(/\/tickets\?new=1$/);
  // 本文・項目・確認項目を入れて作る
  const id = await fillAndCreate(page, me, title, {
    body: WRITTEN,
    texts: { 先方の担当者名: "経理の山田さん" },
    specs: [...SPECS],
  });
  const body = await bodyNow(id);
  expect(body.version, "作った直後は版 1").toBe(1);
  expect(body.text).toContain(WRITTEN);
  expect(JSON.stringify(body.doc), "薄いひな形の節は本文に入らない").not.toContain("ghost");
  expect(await fieldValuesOf(id)).toEqual([{ field_id: owner.id, value: "経理の山田さん" }]);
  const specs = await specsOf(id);
  expect(
    specs.map((s) => s.title),
    "足した順",
  ).toEqual([...SPECS]);
  expect(
    specs.every((s) => s.checked_at === null && s.source === "manual"),
    "チェック無し・人が足した行",
  ).toBe(true);
  expect(await changeRowsOf(id), "作ったときは更新の行を足さない").toHaveLength(0);
  // 作った詳細：本文・項目・確認項目
  await expect(readBody(page)).toContainText(WRITTEN);
  await expect(editBtn(page, "先方の担当者名")).toHaveText("経理の山田さん");
  await expect(specsBlock(page)).toContainText("2 件");
  await openSpecs(page, SPECS[0]);
  await expect(specBox(page, SPECS[1])).not.toBeChecked();
});

test("K454-M1-02 本文を直して書き終える：「本文を直す」→ 字を足す → 「書き終える」で版 2。読む形に出て、やり取りの更新の行が 1 つ（本文の字は行に入らない）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m1-02");
  const title = `本文を直す 中間5 ${tagOf("m1-02")}`;
  const id = await makeTicket(page, me, title, { doc: docOf(para(WRITTEN)) });
  await openTicket(page, id, title);
  expect(await appendAndFinish(page, ADDED), "本文を書き終える口が受ける").toBe(200);
  const after = await bodyNow(id);
  expect(after).toMatchObject({ version: 2, versions: 2 });
  expect(after.text).toContain(`${WRITTEN}${ADDED}`);
  await expect(readBody(page)).toContainText(`${WRITTEN}${ADDED}`);
  const rows = await changeRowsOf(id);
  expect(rows, "更新の行は 1 つ").toHaveLength(1);
  expect(rows[0]!.author_member_id, "直した人は本人").toBe(me.memberId);
  expect(rows[0]!.changes).toEqual([{ field: "body", from: "版 1", to: "版 2" }]);
  expect(JSON.stringify(rows[0]), "本文の字は更新の行に入らない").not.toContain(ADDED);
});

test("K454-M1-03 項目を直す：詳細の項目の表で会社の項目の値を押して直す → 1 項目 1 回の口・読み直しても同じ・更新の行が増える（本文は変わらない）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m1-03");
  const owner = await addField(me, "先方の担当者名", "short_text", { position: 1 });
  const title = `項目を直す 中間5 ${tagOf("m1-03")}`;
  const id = await makeTicket(page, me, title, { fields: { [owner.id]: "山田さん" } });
  await openTicket(page, id, title);
  await expect(editBtn(page, "先方の担当者名")).toHaveText("山田さん");
  expect(await editItem(page, "先方の担当者名", "佐々木さん"), "項目を直す口（updateTicket）が受ける").toBe(200);
  await expect(editBtn(page, "先方の担当者名")).toHaveText("佐々木さん");
  expect(await fieldValuesOf(id)).toEqual([{ field_id: owner.id, value: "佐々木さん" }]);
  expect((await bodyNow(id)).version, "本文は変わらない").toBe(1);
  await openTicket(page, id, title);
  await expect(editBtn(page, "先方の担当者名")).toHaveText("佐々木さん");
  const rows = await changeRowsOf(id);
  expect(rows).toHaveLength(1);
  expect(idsOf(rows[0]!.changes)).toEqual([`field:${owner.id}`]);
});

test("K454-M1-04 版と差分：詳細の「版と差分」から頁へ移り、版 2（いま）と版 1 が並び、差分に足した字が出る（頁を開くだけでは何も書かれない）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m1-04");
  const title = `版と差分 中間5 ${tagOf("m1-04")}`;
  const id = await makeTicket(page, me, title, { doc: docOf(para(WRITTEN)) });
  await openTicket(page, id, title);
  expect(await appendAndFinish(page, ADDED)).toBe(200);
  await goVersionsFromDetail(page, id);
  await expect(verList(page)).toHaveCount(2);
  await expect(verList(page).nth(0)).toHaveText(/^版 2（いま）/);
  await expect(verList(page).nth(1)).toHaveText(/^版 1/);
  await expect(diffList(page)).toContainText(ADDED);
  await expect(restoreBtn(page, 1)).toBeVisible();
  expect(await bodyNow(id), "頁を開いただけでは版は増えない").toMatchObject({ version: 2, versions: 2 });
});

test("K454-M1-05 本文を版 1 に戻す：戻す口が 2xx・新しい版 3（中身は版 1・版 2 は残る）・頁の一覧に版 3（いま）。戻しても会社の項目と確認項目は変わらない・更新の行に「戻しました」が並ぶ", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m1-05");
  const owner = await addField(me, "先方の担当者名", "short_text", { position: 1 });
  const title = `版を戻す 中間5 ${tagOf("m1-05")}`;
  const id = await makeTicket(page, me, title, {
    doc: docOf(para(WRITTEN)),
    fields: { [owner.id]: "山田さん" },
    specs: [...SPECS],
  });
  await openTicket(page, id, title);
  expect(await appendAndFinish(page, ADDED)).toBe(200);
  const v1 = await bodyAt(id, 1);
  await page.goto(versionsUrl(id));
  await expect(verList(page).first()).toHaveText(/^版 2（いま）/);
  expect(await restoreBody(page, 1), "戻す口が受ける").toBeLessThan(300);
  await expect(verList(page)).toHaveCount(3);
  await expect(verList(page).nth(0)).toHaveText(/^版 3（いま）/);
  const now = await bodyNow(id);
  expect(now).toMatchObject({ version: 3, versions: 3 });
  expect(now.doc as Node, "版 3 の木は版 1 と同じ").toEqual(v1.doc);
  expect((await bodyAt(id, 3)).restored_from).toBe(1);
  expect((await bodyAt(id, 2)).text, "版 2 は残る").toContain(ADDED);
  // 詳細：戻した本文・項目と確認項目は変わらない
  await openTicket(page, id, title);
  await expect(readBody(page)).not.toContainText(ADDED);
  await expect(editBtn(page, "先方の担当者名")).toHaveText("山田さん");
  expect((await specsOf(id)).map((s) => s.title)).toEqual([...SPECS]);
  // やり取り：本文を直した → 戻した の 2 行（古い順）
  const rows = await changeRowsOf(id);
  expect(rows.map((r) => r.changes[0]?.field)).toEqual(["body", "body"]);
  expect(rows[1]!.changes[0]).toMatchObject({ from: "版 2", to: "版 3", note: "版 1 に戻した" });
  const lines = await openTalk(page);
  await expect(lines).toHaveText([new RegExp(MSG.onlyBody), new RegExp(MSG.restored(1))]);
  await itemsTab(page).click();
});

test("K454-M1-06 別の人（別のタブ）が先に直した：タブ A（読み直さない）の「書き終える」は 409・帯「ほかの人が先に直しました」・書いた字は残り DB は先の版のまま → 帯の「比べる」で版と差分の頁が開く", async ({
  page,
  context,
}) => {
  const me = await newcomer(page, box, "m1-06");
  const title = `同時に直す 中間5 ${tagOf("m1-06")}`;
  const id = await makeTicket(page, me, title, { doc: docOf(para(WRITTEN)) });
  await openTicket(page, id, title);
  // タブ B で先に直して書き終える（版 2）。同じ人の別のタブは「別の人が先に直した」と同じ口の答えになる
  const b = await context.newPage();
  await openTicket(b, id, title);
  expect(await appendAndFinish(b, "（B の直し）")).toBe(200);
  await b.close();
  // タブ A は読み直さずに書き始めて書き終える
  await startEdit(page);
  await typeAtEnd(page, "（A の直し）");
  expect(await finishBody(page), "口は 409").toBe(409);
  await expect(conflictBand(page)).toContainText(BAND_TITLE);
  await expect(bodyBox(page)).toContainText("（A の直し）");
  const now = await bodyNow(id);
  expect(now.version, "DB は B の版 2 のまま").toBe(2);
  expect(now.text).toContain("（B の直し）");
  expect(now.text).not.toContain("（A の直し）");
  // 帯の「比べる」：新しいタブで版と差分の頁（書いている画面は残る）
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    conflictBand(page)
      .getByRole("button", { name: "比べる", exact: true })
      .or(conflictBand(page).getByRole("link", { name: "比べる", exact: true }))
      .click(),
  ]);
  await expect(popup).toHaveURL(new RegExp(`/tickets/${id}/versions$`));
  await expect(popup.getByRole("heading", { level: 1, name: "版と差分", exact: true })).toBeVisible();
  await expect(bodyBox(page)).toContainText("（A の直し）");
  expect(await bodyNow(id), "書かれていない（版 2・版が 2 つ）").toMatchObject({ version: 2, versions: 2 });
});
