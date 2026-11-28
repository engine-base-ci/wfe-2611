// K-455 中間テスト（段 5・M2）：確かめて終える（K-450・K-435・K-572・K-566・K-573・K-565）と、親・期限・優先度・つながり・複製（K-443・K-444・K-452・K-446）を、
//   本物のブラウザ・本物の DB・本物の口でつなぐ（段 5 の中間テスト 2・D-128.131）。**詳細で期限を変えるのは段 8（K-483・K-484）の物**で、ここは作る面で決める分だけ。
//   中の 1 本 1 本の分岐は単体の試験（口：apps/api/test/features/F4・F5、画面：apps/web/tests/k の k443・k444・k446・k450・k452・k572・k573）が持つ。
//   ここは「つないだときにだけ出るもの」を見る：確認項目のチェックが DB・やり取りの行・完了の小窓の数にそろうか・完了の後に本文と確認項目が変えられないか・確認項目が 0 件のとき任せる前に止まるか・
//   作る面で決めた親・期限・優先度が詳細と親の詳細に出るか・親と期限の食い違いを止めるか・関連と派生元・子を足す・3 段目と別の会社を選べないか・複製が確認項目をチェックなしで写すか。
//   口は網の手前で差し替えない（1 人目だけ届く頭 x-forwarded-for を足す・K-64 と同じ）。準備は DB に直に入れる。PC は試験の PC（_lib/prep.ts の pairedPc）。メール・本物の AI は使わない。
//   固定の待ちは置かない。★前提：CI の web の組の G59 と同じ。★K-387（段 7）の後でないと動かない：詳細の親は updateTicket（K-440）を通る。
//   ★期限の「来週の月曜」は押した日から数えて 1〜7 日後の月曜。日付は固定せず、DB の値が月曜で今日より後・7 日以内かで見る。
//   ★組の葉が全部入った後に初めて流れる（この葉の CI だけがこの試験を選ぶ）。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { expect, test, type Page } from "@playwright/test";
import { API, admin, signupViaApi } from "../_lib/api";
import {
  COMPLETE_RE,
  CREATE_TICKET_RE,
  DELEGATE_RE,
  LINK_ROW_RE,
  PARENT_ENTRY,
  UPDATE_TICKET_RE,
  addField,
  aiBand,
  answered,
  bodyBox,
  bodyNow,
  changeRowsOf,
  childrenOf,
  completeBtn,
  completeDialog,
  countRequests,
  delegateBtn,
  docOf,
  duplicateOnDetail,
  editBtn,
  enterBtn,
  esc,
  execBand,
  fieldValuesOf,
  fillAndCreate,
  jstDay,
  linkCard,
  linkDialog,
  linkRow,
  linksOf,
  makeTicket,
  numRe,
  openCreateFromMenu,
  openLinkDialog,
  openSpecs,
  openTalk,
  openTicket,
  para,
  parentChip,
  parentDialog,
  parentRow,
  pickParentOnCreate,
  reasonBox,
  reasonGo,
  searchAndPickParent,
  setDoing,
  setDue,
  setParentOnDetail,
  showLinks,
  sortNotesOf,
  specBox,
  specTextBtn,
  specsBlock,
  specsOf,
  submitLink,
  tagOf,
  tasks,
  ticketRow,
  toggleSpec,
  unlinkButton,
} from "../_lib/f4-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp } from "../_lib/newcomer";
import { asPerson, pairedPc } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 71);
});
/** 立てた試験の PC は筋の終わりに必ず閉じる（自分で立てた分だけ） */
const pcs: TestPc[] = [];
test.afterEach(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
});

/** 文言（K-443・K-444・K-446・K-450・K-452・K-572・K-573・K-574・errors.json の正本から。実装から書かない） */
const MSG = {
  checkedLine: (t: string): string => `確認項目『${t}』にチェックを付けました`, // 更新の行（K-574）
  uncheckedLine: (t: string): string => `確認項目『${t}』のチェックを外しました`,
  fixedLine: (t: string): string => `確認項目『${t}』を直しました`,
  bodyUnchecked: "本文に、チェックのないやることが 1 つ残っています", // 完了の小窓（K-572）
  specUnchecked: "確認項目にチェックの付いていない物が 1 つあります",
  completed: "完了しました", // 完了の帯（K-63）
  delegated: "に任せました", // K-62 の帯（「〇〇のAI に任せました」）
  needPriorityReason: "優先度を高にする理由を書いてください", // 作る面（D-150.20）
  dueAfterParent: "より後です", // 親の期限より後の子を親にしようとした注意（K-443）
  linked: (number: string): string => `${number} とつなぎました`, // K-452
  unlinkAsk: "つながりを外しますか",
  tooDeep: "3 段目のチケットの下には作れません", // K-443
  noMatch: "合うチケットがありません。番号か題名の一部で探してください。", // K-452
  cycle: "E-LNK-003", // 派生元が輪になる（K-441）
  notFound: "E-PAGE-001", // 無い・見えない・別の会社（共通）
  doneBody: "E-SEC-005", // 完了したチケットの本文（K-432）
  doneSpec: "E-SPEC-001", // 完了したチケットの確認項目（K-434）
} as const;
const SPEC_A = "請求書が宛先に届いている";
const SPEC_B = "送る前に文面を目で見る";
const mmdd = (day: string): string => `${day.slice(5, 7)}/${day.slice(8, 10)}`;
/** 「来週の月曜」の日付が、月曜で・今日より後で・7 日以内か */
function expectNextMonday(day: string): void {
  expect(new Date(`${day}T00:00:00Z`).getUTCDay(), "月曜").toBe(1);
  expect(day > jstDay(0), "今日より後").toBe(true);
  expect(day <= jstDay(7), "7 日以内").toBe(true);
}
/** 親になるチケットを口で作り、期限を遠く（30 日後）にする（子の期限が親より後にならない） */
async function parentTicket(page: Page, me: Parameters<typeof makeTicket>[1], title: string): Promise<string> {
  const id = await makeTicket(page, me, title);
  await setDue(id, jstDay(30));
  return id;
}
const priorityOf = async (id: string) => {
  const r = await ticketRow(id);
  return { priority: r.priority, priority_reason: r.priority_reason };
};
/** 口を詳細と同じブラウザから直に叩く（PATCH）。完了後の本文を直に直そうとする行の準備 */
async function patchAs(
  page: Page,
  token: string,
  path: string,
  body: unknown,
): Promise<{ status: number; code: string | null }> {
  return page.evaluate(
    async ([url, tok, b]) => {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tok}`,
          "idempotency-key": `m2-${Math.random().toString(36).slice(2)}`,
        },
        body: b,
      });
      const j = (await res.json().catch(() => ({}))) as { code?: string };
      return { status: res.status, code: j.code ?? null };
    },
    [`${API}/api/v1${path}`, token, JSON.stringify(body)] as const,
  );
}

test("K455-M2-01 チェックを付ける・外す：詳細の確認項目の箱を押すと DB に「付けた人と時刻」が入り、外すと空に戻る。やり取りに名前つきの行が並ぶ（口は 1 回ずつ）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-01");
  const title = `チェックする 中間5 ${tagOf("m2-01")}`;
  const id = await makeTicket(page, me, title, { specs: [SPEC_A, SPEC_B] });
  await openTicket(page, id, title);
  await openSpecs(page, SPEC_A);
  expect(await toggleSpec(page, SPEC_A), "チェックを付ける口が受ける").toBe(200);
  await expect(specBox(page, SPEC_A)).toBeChecked();
  const [a, b] = await specsOf(id);
  expect(a!.checked_at, "付いた時刻").not.toBeNull();
  expect(a!.checked_by_member_id, "付けた人は本人").toBe(me.memberId);
  expect(b!.checked_at, "もう 1 つは付かない").toBeNull();
  expect(await toggleSpec(page, SPEC_A), "外す口が受ける").toBe(200);
  await expect(specBox(page, SPEC_A)).not.toBeChecked();
  expect((await specsOf(id))[0]!.checked_at).toBeNull();
  const rows = await changeRowsOf(id);
  expect(rows.map((r) => r.changes[0]?.field)).toEqual(["test_spec", "test_spec"]);
  expect(rows.every((r) => r.author_member_id === me.memberId)).toBe(true);
  await openTicket(page, id, title);
  const lines = await openTalk(page);
  await expect(lines).toHaveText([
    new RegExp(esc(MSG.checkedLine(SPEC_A))),
    new RegExp(esc(MSG.uncheckedLine(SPEC_A))),
  ]);
});

test("K455-M2-02 文を直せるのはチェックの前だけ：付いた行の文は押せず（口へ届かない）、外すと直せて DB の文とやり取りの行が替わる", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-02");
  const title = `文を直す 中間5 ${tagOf("m2-02")}`;
  const id = await makeTicket(page, me, title, { specs: [SPEC_A] });
  await openTicket(page, id, title);
  await openSpecs(page, SPEC_A);
  expect(await toggleSpec(page, SPEC_A)).toBe(200);
  const patches = countRequests(page, "PATCH", /^\/api\/v1\/test_specs\/[^/]+$/);
  await expect(specTextBtn(page, SPEC_A)).toHaveAttribute("aria-disabled", "true");
  await specTextBtn(page, SPEC_A).click({ force: true });
  await expect(specsBlock(page).getByRole("textbox", { name: "確認項目の文", exact: true })).toHaveCount(0);
  expect(patches.n, "付いた行の文を直す口は呼ばれない").toBe(0);
  expect(await toggleSpec(page, SPEC_A)).toBe(200);
  await specTextBtn(page, SPEC_A).click();
  const input = specsBlock(page).getByRole("textbox", { name: "確認項目の文", exact: true });
  await input.fill("請求書が宛先に確かに届いている");
  const res = answered(page, "PATCH", /^\/api\/v1\/test_specs\/[^/]+$/);
  await input.press("Enter");
  expect((await res).status(), "文を直す口が受ける").toBe(200);
  expect((await specsOf(id))[0]!.title).toBe("請求書が宛先に確かに届いている");
  expect((await changeRowsOf(id)).map((r) => r.changes[0]?.field)).toEqual(["test_spec", "test_spec", "test_spec"]);
});

test("K455-M2-03 完了にする：未チェックが残っていると小窓で数と行を見せ（戻って付ける／このまま完了にする）、止めはしない。完了すると段が完了・帯が「完了しました」", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-03");
  const title = `完了にする 中間5 ${tagOf("m2-03")}`;
  const id = await makeTicket(page, me, title, {
    doc: docOf(para("請求書を作って送る"), tasks(["請求書を作る", false], ["先方に送る", true])),
    specs: [SPEC_A, SPEC_B],
  });
  await setDoing(id);
  await admin(
    "update test_specs set checked_at = now(), checked_by_member_id = $2 where ticket_id = $1 and title = $3",
    [id, me.memberId, SPEC_A],
  );
  await openTicket(page, id, title);
  const completes = countRequests(page, "POST", COMPLETE_RE);
  await completeBtn(page).click();
  const d = completeDialog(page);
  await expect(d).toContainText(MSG.bodyUnchecked);
  await expect(d).toContainText(MSG.specUnchecked);
  await expect(d).toContainText(SPEC_B);
  // 「戻って付ける」：小窓が閉じ、完了の口は呼ばれず、段は作業中のまま
  await d.getByRole("button", { name: "戻って付ける", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(completes.n).toBe(0);
  expect((await ticketRow(id)).stage).toBe("doing");
  // 確認項目を付けて押し直すと、小窓は本文の注意だけ
  await openSpecs(page, SPEC_A);
  expect(await toggleSpec(page, SPEC_B)).toBe(200);
  await completeBtn(page).click();
  await expect(completeDialog(page)).toContainText(MSG.bodyUnchecked);
  await expect(completeDialog(page)).not.toContainText(MSG.specUnchecked);
  const done = answered(page, "POST", COMPLETE_RE);
  await completeDialog(page).getByRole("button", { name: "このまま完了にする", exact: true }).click();
  expect((await done).status(), "完了の口が受ける").toBeLessThan(300);
  await expect(execBand(page)).toContainText(MSG.completed);
  const row = await ticketRow(id);
  expect(row.stage).toBe("done");
  expect(row.completed_at).not.toBeNull();
});

test("K455-M2-04 完了の後は本文・確認項目を変えられない：「本文を直す」が出ず・確認項目は押せず・口に直に送っても 409（本文 E-SEC-005・確認項目 E-SPEC-001）で DB は変わらない", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-04");
  const title = `完了の後 中間5 ${tagOf("m2-04")}`;
  const id = await makeTicket(page, me, title, { specs: [SPEC_A] });
  await setDoing(id);
  await admin("update test_specs set checked_at = now(), checked_by_member_id = $2 where ticket_id = $1", [
    id,
    me.memberId,
  ]);
  await openTicket(page, id, title);
  const done = answered(page, "POST", COMPLETE_RE);
  await completeBtn(page).click();
  expect((await done).status(), "未チェックが無いので小窓なしで完了する").toBeLessThan(300);
  await expect(execBand(page)).toContainText(MSG.completed);
  await openTicket(page, id, title);
  await expect(enterBtn(page)).toHaveCount(0);
  await expect(bodyBox(page)).toHaveCount(0);
  await openSpecs(page, SPEC_A);
  await expect(specBox(page, SPEC_A)).toHaveAttribute("aria-disabled", "true");
  const before = await bodyNow(id);
  const direct = await patchAs(page, me.token, `/tickets/${id}/body`, {
    version: before.version,
    doc: docOf(para("完了後の直し")),
  });
  expect(direct).toEqual({ status: 409, code: MSG.doneBody });
  const spec = (await specsOf(id))[0]!;
  const direct2 = await patchAs(page, me.token, `/test_specs/${spec.id}`, { version: 1, checked: false });
  expect(direct2).toEqual({ status: 409, code: MSG.doneSpec });
  expect(await bodyNow(id), "本文は変わらない").toEqual(before);
  expect((await specsOf(id))[0]!.checked_at, "チェックは付いたまま").not.toBeNull();
});

test("K455-M2-05 AI に任せる（確認項目が 0 件）：任せる口を呼ばずに小窓で止まる → 「確認項目を足す」は確認項目を足す小窓を開く（パネルを閉じた状態でも）→ 理由を書いて任せると口が通り、理由が DB に残る（試験の PC をつなぐ）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-05");
  const pc = await pairedPc(page, me.token, `中間5 の MacBook (m2-05)`);
  pcs.push(pc);
  const title = `任せる 中間5 ${tagOf("m2-05")}`;
  const id = await makeTicket(page, me, title);
  await openTicket(page, id, title);
  const posts = countRequests(page, "POST", DELEGATE_RE);
  await delegateBtn(page).click();
  await expect(page.getByRole("dialog")).toContainText("確認項目がありません");
  await expect(reasonGo(page)).toBeDisabled();
  expect(posts.n, "小窓が開いただけでは任せる口を呼ばない").toBe(0);
  const addDialog = page.getByRole("dialog", { name: "確認項目を足す", exact: true });
  await page.getByRole("dialog").getByRole("button", { name: "確認項目を足す", exact: true }).click();
  await expect(
    addDialog,
    "「確認項目を足す」で、確認項目を足す小窓が開く（合図は詳細の一番上が聞く・K-571）",
  ).toBeVisible();
  expect(posts.n).toBe(0);
  await addDialog.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // パネルを閉じていても、足す小窓が開き、パネルも開く
  const panel = page.getByRole("complementary", { name: "チケットのパネル" });
  await panel.getByRole("button", { name: "パネルを閉じる" }).click();
  await expect(panel).toBeHidden();
  await delegateBtn(page).click();
  await page.getByRole("dialog").getByRole("button", { name: "確認項目を足す", exact: true }).click();
  await expect(addDialog).toBeVisible();
  // 小窓（modal）が開いている間は、ほかの所が読み上げから外れる（aria-hidden）。パネルは読み上げから外れた物も含めて探す
  await expect(page.getByRole("complementary", { name: "チケットのパネル", includeHidden: true })).toBeVisible();
  expect(posts.n).toBe(0);
  await addDialog.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await delegateBtn(page).click();
  await reasonBox(page).fill("　今回は目で見て決めるので使わない　");
  const res = answered(page, "POST", DELEGATE_RE);
  await reasonGo(page).click();
  expect((await res).status(), "任せる口が受ける").toBeLessThan(300);
  await expect(aiBand(page)).toContainText(`${me.name}のAI ${MSG.delegated}`);
  expect((await ticketRow(id)).no_spec_reason, "前後の空白を落とした理由が残る").toBe(
    "今回は目で見て決めるので使わない",
  );
});

test("K455-M2-06 AI に任せる（確認項目が 1 件以上）：小窓なしで任せる口が通り、使わない理由は残らない", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-06");
  const pc = await pairedPc(page, me.token, `中間5 の MacBook (m2-06)`);
  pcs.push(pc);
  const title = `任せる 確認あり 中間5 ${tagOf("m2-06")}`;
  const id = await makeTicket(page, me, title, { specs: [SPEC_A] });
  await openTicket(page, id, title);
  const res = answered(page, "POST", DELEGATE_RE);
  await delegateBtn(page).click();
  expect((await res).status()).toBeLessThan(300);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(aiBand(page)).toContainText("に任せました");
  expect((await ticketRow(id)).no_spec_reason).toBeNull();
});

test("K455-M2-07 作る面：期限の早見で「来週の月曜」・親の小窓で親を決め・優先度「高」は理由なしだと止まる → 作ると詳細に親の札と期限・親の詳細の「子チケット」に出る・親の期限は変わらない", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-07");
  const tag = tagOf("m2-07");
  const parentTitle = `親になる 中間5 ${tag}`;
  const title = `子を作る 中間5 ${tag}`;
  const p = await parentTicket(page, me, parentTitle);
  const posts = countRequests(page, "POST", CREATE_TICKET_RE);
  await openCreateFromMenu(page);
  const id = await fillAndCreate(page, me, title, {
    quick: "来週の月曜",
    extra: async (pg) => {
      await pickParentOnCreate(pg, tag, parentTitle);
      await pg.getByRole("combobox", { name: "優先度", exact: true }).click();
      await pg.getByRole("option", { name: "高", exact: true }).click();
      await pg.locator("header.k-page-head").getByRole("button", { name: "作る", exact: true }).click();
      await expect(pg.getByText(MSG.needPriorityReason, { exact: true })).toBeVisible();
      expect(posts.n, "理由が無いと作る口へ届かない").toBe(0);
      await pg.getByRole("textbox", { name: "高にする理由", exact: true }).fill("先方の締め切りが早いため");
    },
  });
  const row = await ticketRow(id);
  expect(row.parent_ticket_id, "決めた親が書かれる").toBe(p);
  expectNextMonday(row.due_on);
  expect(row.assignee_member_id).toBe(me.memberId);
  expect(await priorityOf(id)).toEqual({ priority: "high", priority_reason: "先方の締め切りが早いため" });
  await expect(parentChip(page).first()).toContainText(parentTitle);
  await expect(page.getByText(mmdd(row.due_on)).first()).toBeVisible();
  expect(await childrenOf(p)).toHaveLength(1);
  await openTicket(page, p, parentTitle);
  await showLinks(page);
  await expect(linkCard(page).getByRole("heading", { level: 3, name: "子チケット 1", exact: true })).toBeVisible();
  await expect(linkRow(page, title)).toBeVisible();
  expect((await ticketRow(p)).due_on).toBe(jstDay(30));
});

test("K455-M2-08 詳細の親：決める → 変える → 外す が、読み直した画面・DB・やり取りの更新の行にそろう（自分で変えたので知らせは出ない）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-08");
  const tag = tagOf("m2-08");
  const p1Title = `親 A 中間5 ${tag}`;
  const p2Title = `親 B 中間5 ${tag}`;
  const cTitle = `動かす子 中間5 ${tag}`;
  const p1 = await parentTicket(page, me, p1Title);
  const p2 = await parentTicket(page, me, p2Title);
  const c = await makeTicket(page, me, cTitle);
  await openTicket(page, c, cTitle);
  const entry = parentRow(page).getByRole("button", { name: PARENT_ENTRY, exact: true });
  expect(await setParentOnDetail(page, entry, tag, p1Title), "親を決める口（updateTicket）が受ける").toBe(200);
  await expect(parentChip(page).first()).toContainText(p1Title);
  expect((await ticketRow(c)).parent_ticket_id).toBe(p1);
  expect(await setParentOnDetail(page, parentChip(page).first(), tag, p2Title)).toBe(200);
  await expect(parentChip(page).first()).toContainText(p2Title);
  expect((await ticketRow(c)).parent_ticket_id).toBe(p2);
  const removed = answered(page, "PATCH", UPDATE_TICKET_RE);
  await parentRow(page).getByRole("button", { name: "親を外す", exact: true }).click();
  expect((await removed).status()).toBe(200);
  await expect(parentChip(page)).toHaveCount(0);
  expect((await ticketRow(c)).parent_ticket_id).toBeNull();
  await openTicket(page, c, cTitle);
  await expect(parentChip(page)).toHaveCount(0);
  const rows = await changeRowsOf(c);
  expect(
    rows.map((r) => r.changes[0]?.field),
    "決める・変える・外すで 3 行",
  ).toEqual(["parent", "parent", "parent"]);
  expect(await sortNotesOf(me.memberId, c), "担当者が自分で変えたら知らせは出ない").toBe(0);
});

test("K455-M2-09 親 × 期限：親の期限より後の期限の子は、親の小窓で注意が出て「親にする」が押せず口へ届かない → 親の期限が延びると親にできる（やり取りに 1 行）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-09");
  const tag = tagOf("m2-09");
  const pTitle = `期限の親 中間5 ${tag}`;
  const cTitle = `期限の子 中間5 ${tag}`;
  const p = await makeTicket(page, me, pTitle);
  const c = await makeTicket(page, me, cTitle);
  await setDue(p, jstDay(0));
  const childDue = (await ticketRow(c)).due_on;
  const patches = countRequests(page, "PATCH", UPDATE_TICKET_RE);
  await openTicket(page, c, cTitle);
  const entry = parentRow(page).getByRole("button", { name: PARENT_ENTRY, exact: true });
  await entry.click();
  await searchAndPickParent(page, tag, pTitle);
  const d = parentDialog(page);
  await expect(d.locator(".k-callout")).toContainText(MSG.dueAfterParent);
  await expect(d.getByRole("button", { name: "親にする", exact: true })).toBeDisabled();
  expect(patches.n, "押せないので口へ届かない").toBe(0);
  expect((await ticketRow(c)).parent_ticket_id).toBeNull();
  await d.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(parentDialog(page)).toHaveCount(0);
  await setDue(p, jstDay(30));
  await openTicket(page, c, cTitle);
  expect(await setParentOnDetail(page, entry, tag, pTitle), "親を決める口（updateTicket）が受ける").toBe(200);
  await expect(parentChip(page).first()).toContainText(pTitle);
  const row = await ticketRow(c);
  expect(row.parent_ticket_id).toBe(p);
  expect(row.due_on, "子の期限は変わらない（期限は段 8 の物）").toBe(childDue);
  expect((await changeRowsOf(c)).map((r) => r.changes[0]?.field)).toEqual(["parent"]);
  expect(await sortNotesOf(me.memberId, c)).toBe(0);
});

test("K455-M2-10 つながり：関連は両方の詳細に出て、片方で外すと両方から消える → 派生元を足すと、逆向きの派生元（輪）は 409 で足せない", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-10");
  const tag = tagOf("m2-10");
  const aTitle = `つなぐ元 中間5 ${tag}`;
  const bTitle = `つなぐ先 中間5 ${tag}`;
  const a = await makeTicket(page, me, aTitle);
  const b = await makeTicket(page, me, bTitle);
  const na = (await ticketRow(a)).number;
  const nb = (await ticketRow(b)).number;
  await openTicket(page, a, aTitle);
  await showLinks(page);
  let d = await openLinkDialog(page, "関連", tag, nb);
  expect((await submitLink(page, d)).status(), "つながりを足す口が受ける").toBe(201);
  await expect(
    page.getByRole("region", { name: /知らせ/ }).getByText(MSG.linked(nb), { exact: true }),
  ).toBeVisible();
  await expect(linkRow(page, numRe(nb))).toContainText("関連");
  expect(await linksOf(a)).toHaveLength(1);
  await openTicket(page, b, bTitle);
  await showLinks(page);
  await expect(linkRow(page, numRe(na))).toContainText("関連");
  await unlinkButton(page, na).click();
  const ask = page.getByRole("alertdialog");
  await expect(ask).toContainText(MSG.unlinkAsk);
  const removed = answered(page, "DELETE", LINK_ROW_RE);
  await ask.getByRole("button", { name: "外す", exact: true }).click();
  expect((await removed).status()).toBeLessThan(300);
  await expect(linkRow(page, numRe(na))).toHaveCount(0);
  expect(await linksOf(b), "外すと両方から消える").toHaveLength(0);
  await openTicket(page, a, aTitle);
  await showLinks(page);
  await expect(linkRow(page, numRe(nb))).toHaveCount(0);
  d = await openLinkDialog(page, "派生元", tag, nb);
  expect((await submitLink(page, d)).status()).toBe(201);
  await expect(linkRow(page, numRe(nb))).toContainText("派生元");
  expect(await linksOf(a)).toEqual([{ from_ticket_id: a, to_ticket_id: b, kind: "derived_from" }]);
  await openTicket(page, b, bTitle);
  await showLinks(page);
  // 画面の層：もうつながっている相手（A）は候補で押せない形（K-450 の候補の印）なので、画面からは輪を作れない
  await linkCard(page).getByRole("button", { name: "つながりを足す", exact: true }).click();
  const ld = linkDialog(page);
  await ld.getByRole("radio", { name: /^派生元/ }).check();
  await ld.getByLabel("チケットを探す", { exact: true }).fill(tag);
  await expect(
    ld.getByRole("list", { name: "候補", exact: true }).getByRole("button").filter({ hasText: numRe(na) }),
    "つながっている相手は押せない",
  ).toHaveAttribute("aria-disabled", "true");
  await ld.getByRole("button", { name: "やめる", exact: true }).click();
  // 口の層（最後の砦）：逆向きの派生元を直に足すと 409（輪）
  const loop = await asPerson(page, me.token, "POST", `/tickets/${b}/links`, { other_ticket_id: a, kind: "derived_from" });
  expect(loop.status, "派生元が輪になる").toBe(409);
  expect(loop.code).toBe(MSG.cycle);
  expect(await linksOf(b)).toHaveLength(1);
});

test("K455-M2-11 子を足す：親の詳細の「子を足す」→ 親つきの作る面 → 作ると、子は親の下に入り、親の詳細の「子チケット」に出る", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-11");
  const tag = tagOf("m2-11");
  const pTitle = `子を足す親 中間5 ${tag}`;
  const title = `足した子 中間5 ${tag}`;
  const p = await parentTicket(page, me, pTitle);
  await openTicket(page, p, pTitle);
  await showLinks(page);
  await expect(linkCard(page).getByRole("heading", { level: 3, name: "子チケット 0", exact: true })).toBeVisible();
  await linkCard(page).getByRole("button", { name: "子を足す", exact: true }).click();
  await page.waitForURL(
    (u) => u.pathname === "/tickets" && u.searchParams.get("new") === "1" && u.searchParams.get("parent") === p,
  );
  await expect(bodyBox(page)).toBeVisible();
  await expect(parentChip(page).first(), "作る面は親の札つきで開く").toContainText(pTitle);
  const id = await fillAndCreate(page, me, title, { quick: "来週の月曜" });
  const row = await ticketRow(id);
  expect(row.parent_ticket_id).toBe(p);
  expectNextMonday(row.due_on);
  await openTicket(page, p, pTitle);
  await showLinks(page);
  await expect(linkCard(page).getByRole("heading", { level: 3, name: "子チケット 1", exact: true })).toBeVisible();
  await expect(linkRow(page, title)).toBeVisible();
  expect((await childrenOf(p)).map((k) => k.id)).toEqual([id]);
});

test("K455-M2-12 守り：3 段目のチケットは親に選べない・別の会社のチケットは親にもつながりにも出ず、口で直に足そうとしても 404（つながりは増えない）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-12");
  const tag = tagOf("m2-12");
  const pTitle = `1 段目 中間5 ${tag}`;
  const cTitle = `2 段目 中間5 ${tag}`;
  const gTitle = `3 段目 中間5 ${tag}`;
  const tTitle = `親を探す子 中間5 ${tag}`;
  const xTitle = `他社のチケット 中間5 ${tag}`;
  const p = await makeTicket(page, me, pTitle);
  const c = await makeTicket(page, me, cTitle, { parent: p });
  const g = await makeTicket(page, me, gTitle, { parent: c });
  const t = await makeTicket(page, me, tTitle);
  const x = await signupViaApi(`他社 ${tag}`);
  const xt = await makeTicket(
    page,
    { memberId: x.memberId, token: x.token } as Parameters<typeof makeTicket>[1],
    xTitle,
  );
  expect(xt).not.toBe(t);
  await openTicket(page, t, tTitle);
  await parentRow(page).getByRole("button", { name: PARENT_ENTRY, exact: true }).click();
  const dlg = parentDialog(page);
  await expect(dlg).toBeVisible();
  await dlg.getByRole("textbox", { name: "番号か題名で探す", exact: true }).fill(tag);
  const deep = dlg.getByRole("radio", { name: new RegExp(esc(gTitle)) });
  await expect(deep).toHaveAttribute("aria-disabled", "true");
  await expect(deep).toContainText(MSG.tooDeep);
  await deep.click({ force: true });
  await expect(deep).toHaveAttribute("aria-checked", "false");
  await expect(dlg.getByRole("button", { name: "親にする", exact: true })).toBeDisabled();
  await expect(
    dlg.getByRole("radio", { name: new RegExp(esc(xTitle)) }),
    "別の会社のチケットは候補に出ない",
  ).toHaveCount(0);
  await searchAndPickParent(page, tag, cTitle);
  await expect(dlg.getByRole("button", { name: "親にする", exact: true })).toBeEnabled();
  await dlg.getByRole("button", { name: "やめる", exact: true }).click();
  expect((await ticketRow(t)).parent_ticket_id, "やめたので親は決まらない").toBeNull();
  expect((await ticketRow(g)).parent_ticket_id).toBe(c);
  await showLinks(page);
  await linkCard(page).getByRole("button", { name: "つながりを足す", exact: true }).click();
  const ld = page.getByRole("dialog", { name: "つながりを足す", exact: true });
  await ld.getByLabel("チケットを探す", { exact: true }).fill(tag);
  const list = ld.getByRole("list", { name: "候補", exact: true }).getByRole("button");
  await expect(list.filter({ hasText: pTitle })).toBeVisible();
  await expect(list.filter({ hasText: xTitle }), "別の会社のチケットは候補に出ない").toHaveCount(0);
  await ld.getByLabel("チケットを探す", { exact: true }).fill(xTitle);
  await expect(ld.getByText(MSG.noMatch, { exact: true })).toBeVisible();
  await ld.getByRole("button", { name: "やめる", exact: true }).click();
  const direct = await asPerson(page, me.token, "POST", `/tickets/${t}/links`, {
    other_ticket_id: xt,
    kind: "related",
  });
  expect(direct.status).toBe(404);
  expect(direct.code).toBe(MSG.notFound);
  expect(await linksOf(t)).toHaveLength(0);
});

test("K455-M2-13 複製：元（本文のチェックの箱・会社の項目・確認項目 2 件〔1 件はチェック済み〕・子 1 件）を詳細の「複製」で写すと、本文と項目と確認項目が写り（チェックは外れる）、元へのつながり（派生元）が 1 行。元は変わらない", async ({
  page,
}) => {
  const me = await newcomer(page, box, "m2-13");
  const owner = await addField(me, "先方の担当者名", "short_text", { position: 1 });
  const tag = tagOf("m2-13");
  const title = `複製の元 中間5 ${tag}`;
  const copyTitle = `複製した見積 中間5 ${tag}`;
  const doc = docOf(para("先方に出す見積"), tasks(["見積を作る", true], ["先方に送る", false]));
  const src = await makeTicket(page, me, title, { doc, fields: { [owner.id]: "山田さん" }, specs: [SPEC_A, SPEC_B] });
  await makeTicket(page, me, `内訳の下ごしらえ ${tagOf("child")}`, { parent: src });
  await admin(
    "update test_specs set checked_at = now(), checked_by_member_id = $2 where ticket_id = $1 and title = $3",
    [src, me.memberId, SPEC_A],
  );
  const before = await bodyNow(src);
  await openTicket(page, src, title);
  const dup = await duplicateOnDetail(page, copyTitle);
  expect(dup.status, "複製の口（作る口）が受ける").toBe(201);
  expect(dup.id).not.toBe(src);
  const copy = await bodyNow(dup.id);
  expect(copy.version, "複製は版 1").toBe(1);
  expect(copy.text, "本文の字が写る").toContain("先方に出す見積");
  expect(JSON.stringify(copy.doc), "本文のチェックの箱は外れて写る").not.toContain('"checked":true');
  expect(await fieldValuesOf(dup.id)).toEqual([{ field_id: owner.id, value: "山田さん" }]);
  const specs = await specsOf(dup.id);
  expect(specs.map((s) => s.title)).toEqual([SPEC_A, SPEC_B]);
  expect(
    specs.every((s) => s.checked_at === null),
    "確認項目のチェックは外れて写る",
  ).toBe(true);
  expect(await linksOf(dup.id)).toEqual([{ from_ticket_id: dup.id, to_ticket_id: src, kind: "derived_from" }]);
  expect((await childrenOf(dup.id)).length, "子チケットも写る").toBe(1);
  expect(await bodyNow(src), "元の本文は変わらない").toEqual(before);
  expect((await specsOf(src))[0]!.checked_at, "元のチェックは付いたまま").not.toBeNull();
  await expect(editBtn(page, "先方の担当者名")).toHaveText("山田さん");
});
