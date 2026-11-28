// K-590「画面：詳細の「…」から消す（子・孫の扱い・理由）・消した直後の「元に戻す」」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f7 の f7-delete-confirm・f7-delete-children・f7-delete-denied・f7-delete-undo（本番と同じ部品 features/F7/delete/views.tsx）。
//   「…」の箱は段 5 の K-458 の DetailMore（箱の絵は f4-more-menu・突き合わせは K458-UI-015）。この葉は onDelete を渡して「消す」を押せるようにするだけで、箱の項目と押せない形は見ない。
//   アーカイブは作らない（D-151.20）。モック f7-delete-archive は持たず、「…」の箱にも「アーカイブ」の項目は出ない。
//   口は網の手前で差し替える（前からの土台 mockApi の上に tests/k/delete-mock.ts の mockDelete）。口の形と番号は K-487・K-488・K-489 の md に合わせる。
//   消す人かどうかは画面では決めない（口が決める）：「…」の「消す」は誰にでも押せ、下見の口が 403 を返したら小窓に断りだけを出す。
//   下見の答えは件数だけ（つながりの番号・承認の宛先の名前は無い）。宛先の名前は getTicket の approval.approver_name から。
//   押した直後の口の数は expect.poll で待つ。固定の待ちは使わない（要素と答えを待つ。5 秒で消えるお知らせは「消えるのを待つ」形で見る）。
//   文は正本 errors.json の 1 件（番号で引く）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  DELETE_PAIRS,
  PARENT,
  PARENT_OF,
  PARENT_OF_BUSY,
  PLAIN,
  TICKET,
  cancelBtn,
  caution,
  choice,
  deleteItem,
  dlg,
  errReply,
  goBtn,
  menuOf,
  mockDelete,
  moreBtn,
  noticeOf,
  openConfirm,
  openDetail,
  parentBox,
  reasonInput,
  togetherOf,
  undoBtn,
  type DeleteMock,
  type DeleteOptions,
} from "./delete-mock";
import { ROOT, countWrites, overflowX } from "./kit";
import { table } from "./list-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const ERRORS = JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
  errors: { id: string; message: string }[];
};
const msg = (id: string): string => {
  const m = ERRORS.errors.find((e) => e.id === id)?.message;
  if (!m) throw new Error(`正本 errors.json に無い番号：${id}（K-487・K-488・K-489 が足す）`);
  return m;
};
const firstSentence = (id: string) => {
  const m = msg(id);
  const i = m.indexOf("。");
  return i < 0 ? m : m.slice(0, i + 1);
};
/** K-487・K-488・K-489 の番号（文は errors.json から引く） */
const E = {
  deny: "E-DEL-001",
  needChoice: "E-DEL-010",
  parentSelf: "E-DEL-011",
  parentDepth: "E-DEL-012",
  cascadeDenied: "E-DEL-013",
  noParent: "E-DEL-014",
  restoreDeny: "E-DEL-040",
  restoreAlready: "E-DEL-041",
  restoreExpired: "E-DEL-042",
  restoreParentGone: "E-DEL-043",
} as const;

const REASON = "重複して作ってしまった";
const TITLE = "セイコー様へ 11月分の請求書を送る";
const PARENT_LABEL = "EG-097 保守契約の見積";
const children = (o: DeleteOptions = {}): DeleteOptions => ({
  number: "EG-124",
  title: "セイコー様 保守契約の更新",
  preview: PARENT_OF,
  approver: null,
  ...o,
});
const previewReply = (data: unknown) => ({ status: 200, body: { data, meta: {} } });

async function setup(page: Page, o: DeleteOptions = {}): Promise<DeleteMock> {
  return mockDelete(page, o);
}
async function pickParent(page: Page): Promise<void> {
  await choice(page, "別の親へ移す").check();
  await parentBox(page).fill("保守");
  await page.getByRole("option", { name: PARENT_LABEL, exact: true }).click();
}
const listLink = (page: Page, title: string) => table(page).getByRole("link", { name: title, exact: true });

test("K590-UI-001 「…」を開く：箱（K-458 の DetailMore）の中の「消す」が押せる（aria-disabled でない）。アーカイブは出ない。開いただけでは下見を読まず、小窓も出ない。箱の項目 8 つの並びと押せない形は K-458 が見る", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  const writes = countWrites(page);
  await moreBtn(page).click();
  await expect(menuOf(page)).toBeVisible();
  await expect(menuOf(page).getByRole("menuitem")).toHaveCount(8);
  await expect(deleteItem(page)).toBeVisible();
  await expect(deleteItem(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(menuOf(page).getByRole("menuitem", { name: "アーカイブ", exact: true })).toHaveCount(0);
  expect(d.previews).toBe(0);
  expect(writes.n).toBe(0);
  await expect(dlg(page)).toHaveCount(0);
});

test("K590-UI-002 「消す」→ 下見を 1 回読んで確認の小窓：題・対象・一緒に起きること（承認待ちの取り下げ・つながり・添付と成果物）・30 日の注・理由（任意・空）・やめる／消す", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await openConfirm(page);
  expect(d.previews).toBe(1);
  await expect(dlg(page)).toContainText(`EG-128 ${TITLE}`);
  expect(await togetherOf(page)).toEqual([
    "承認待ちから取り下げられる（高本 宛 1 件）",
    "子チケット 0 件、つながり 2 件は外れるだけで残る",
    "添付 1 件・成果物 1 件も消える",
  ]);
  await expect(dlg(page).locator(".k-f7-del-note")).toHaveText("消したチケットは 30 日以内なら戻せます");
  await expect(reasonInput(page)).toHaveValue("");
  await expect(dlg(page).getByRole("radio")).toHaveCount(0);
  await expect(cancelBtn(page)).toBeVisible();
  await expect(goBtn(page)).toHaveAttribute("data-variant", "danger");
  expect(d.deletes).toEqual([]);
});

test("K590-UI-003 一緒に起きることは件数が 0 の行を出さない：承認待ちが 0 なら承認の行なし・走っている AI の実行があれば「N 件は止まる」・添付と成果物が 0 なら行なし。承認の宛先の名前が分からないときは「（1 件）」", async ({
  page,
}) => {
  const d = await setup(page, {
    preview: { ...PLAIN, pending_approvals: 0, attachments: 0, artifacts: 0, links: 0, running_runs: 2 },
  });
  await openDetail(page, d);
  await openConfirm(page);
  expect(await togetherOf(page)).toEqual([
    "走っている AI の実行 2 件は止まる",
    "子チケット 0 件、つながり 0 件は外れるだけで残る",
  ]);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const e = await setup(page, { approver: null });
  await openDetail(page, e);
  await openConfirm(page);
  expect((await togetherOf(page))[0]).toBe("承認待ちから取り下げられる（1 件）");
});

test("K590-UI-004 理由は任意：空のまま消せて、口の問い合わせに reason が無い。書けば前後の空白を取って reason に入る（口には理由だけが渡り、小窓の字は残らない）", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await openConfirm(page);
  await goBtn(page).click();
  await expect.poll(() => d.deletes.length).toBe(1);
  expect(d.deletes[0]!.q).not.toHaveProperty("reason");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const e = await setup(page);
  await openDetail(page, e);
  await openConfirm(page);
  await reasonInput(page).fill(`  ${REASON}  `);
  await goBtn(page).click();
  await expect.poll(() => e.deletes.length).toBe(1);
  expect(e.deletes[0]!.q).toMatchObject({ reason: REASON });
});

test("K590-UI-005 子・孫がいる親：3 択の小窓（案内「このチケットには子チケット 4 件・孫 2 件があります。どう扱うか選んでください」・別の親へ移す が選ばれた形・一緒に消す・親を外して単体にする）。移す先を選ぶまで「消す」は押せない", async ({
  page,
}) => {
  const d = await setup(page, children());
  await openDetail(page, d);
  await openConfirm(page);
  await expect(dlg(page).locator(".k-callout")).toHaveText(
    "このチケットには子チケット 4 件・孫 2 件があります。どう扱うか選んでください",
  );
  await expect(choice(page, "別の親へ移す")).toBeChecked();
  await expect(choice(page, "一緒に消す")).not.toBeChecked();
  await expect(choice(page, "親を外して単体にする")).not.toBeChecked();
  expect((await togetherOf(page))[0]).toBe(
    "子チケット 4 件・孫 2 件は選んだ親の下へ移る。つながり 1 件は外れるだけで残る",
  );
  await expect(goBtn(page)).toHaveAttribute("aria-disabled", "true");
  await goBtn(page).click({ force: true });
  expect(d.deletes).toEqual([]);
});

for (const w of [375, 1440] as const) {
  test(`K590-UI-028 幅 ${w}：子・孫の扱いの 3 択で、ラジオの丸の中心が、その選択肢の文の 1 行目の中心と 1px 以内でそろう`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    const d = await setup(page, children());
    await openDetail(page, d);
    await openConfirm(page);
    await expect(dlg(page).getByRole("radio")).toHaveCount(3);
    const gaps = await dlg(page)
      .locator(".k-f7-del-choice")
      .evaluateAll((labels) =>
        labels.map((l) => {
          const r = l.querySelector("input")!.getBoundingClientRect();
          const text = l.querySelector(".k-f7-del-choice-text")!;
          const cs = getComputedStyle(text);
          const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
          const first = text.getBoundingClientRect().top + line / 2;
          return Math.abs(r.top + r.height / 2 - first);
        }),
      );
    expect(Math.max(...gaps), `ずれ（px）${gaps.join("・")}`).toBeLessThanOrEqual(1);
  });
}

test("K590-UI-006 別の親へ移す：親を探す欄（前からの「親のチケット」）で「保守」と打つと候補が出て、選ぶと「消す」が押せる。口の問い合わせは children=move・parent_id＝選んだ親", async ({
  page,
}) => {
  const d = await setup(page, children());
  await openDetail(page, d);
  await openConfirm(page);
  await expect(parentBox(page)).toBeVisible();
  await pickParent(page);
  await expect(parentBox(page)).toHaveValue(PARENT_LABEL);
  await expect(goBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await reasonInput(page).fill(REASON);
  await goBtn(page).click();
  await expect.poll(() => d.deletes.length).toBe(1);
  expect(d.deletes[0]!.q).toEqual({ children: "move", parent_id: PARENT, reason: REASON });
});

test("K590-UI-007 一緒に消す：選ぶと親を探す欄が消え、一緒に起きることの行が「子チケット 4 件・孫 2 件も一緒に消える。…」に替わり、「消す」が押せる。子・孫の承認待ち・走っている AI の実行の数は一緒に消すを選んだときだけ数に足される。口の問い合わせは children=cascade（parent_id なし）", async ({
  page,
}) => {
  const d = await setup(page, children({ preview: PARENT_OF_BUSY }));
  await openDetail(page, d);
  await openConfirm(page);
  // 子・孫の分（承認待ち 2・走っている実行 1）は、一緒に消すを選んだときだけ数に足される（別の親へ移す・親を外すは自分の分だけ）
  expect(await togetherOf(page)).toEqual([
    "承認待ちから取り下げられる（1 件）",
    "走っている AI の実行 1 件は止まる",
    "子チケット 4 件・孫 2 件は選んだ親の下へ移る。つながり 1 件は外れるだけで残る",
  ]);
  await choice(page, "一緒に消す").check();
  await expect(parentBox(page)).toHaveCount(0);
  expect(await togetherOf(page)).toEqual([
    "承認待ちから取り下げられる（3 件）",
    "走っている AI の実行 2 件は止まる",
    "子チケット 4 件・孫 2 件も一緒に消える。つながり 1 件は外れるだけで残る",
  ]);
  await choice(page, "親を外して単体にする").check();
  expect((await togetherOf(page)).slice(0, 2)).toEqual([
    "承認待ちから取り下げられる（1 件）",
    "走っている AI の実行 1 件は止まる",
  ]);
  await choice(page, "一緒に消す").check();
  await goBtn(page).click();
  await expect.poll(() => d.deletes.length).toBe(1);
  expect(d.deletes[0]!.q).toEqual({ children: "cascade" });
});

test("K590-UI-008 親を外して単体にする：行は「子チケット 4 件は親なしの単体で残る（孫は子の下のまま）。…」・口の問い合わせは children=detach", async ({
  page,
}) => {
  const d = await setup(page, children());
  await openDetail(page, d);
  await openConfirm(page);
  await choice(page, "親を外して単体にする").check();
  expect((await togetherOf(page))[0]).toBe(
    "子チケット 4 件は親なしの単体で残る（孫は子の下のまま）。つながり 1 件は外れるだけで残る",
  );
  await goBtn(page).click();
  await expect.poll(() => d.deletes.length).toBe(1);
  expect(d.deletes[0]!.q).toEqual({ children: "detach" });
});

test("K590-UI-009 移す先が選べない（409・E-DEL-011 自分か子孫／409・E-DEL-012 3 段を超える／404・E-DEL-014 見つからない）：親を探す欄の下に正本の文（赤い字）。赤い箱は出ず、選んだ扱いと理由は残り、小窓は開いたまま", async ({
  page,
}) => {
  const d = await setup(page, children());
  await openDetail(page, d);
  await openConfirm(page);
  await pickParent(page);
  await reasonInput(page).fill(REASON);
  for (const [status, code] of [
    [409, E.parentSelf],
    [409, E.parentDepth],
    [404, E.noParent],
  ] as const) {
    d.on.remove = () => errReply(status, code);
    await goBtn(page).click();
    await expect.poll(() => dlg(page).locator(".k-err").allTextContents(), code).toContain(msg(code));
    await expect(noticeOf(page)).toHaveCount(0);
    await expect(choice(page, "別の親へ移す")).toBeChecked();
    await expect(reasonInput(page)).toHaveValue(REASON);
    await expect(dlg(page)).toBeVisible();
  }
});

test("K590-UI-010 消す（正常・子なし）：理由を書いて消すと口に 1 回（問い合わせは reason だけ）。小窓が閉じ、一覧（/tickets）へ移り、小さなお知らせ「EG-128 を消しました」と「元に戻す」が出て、一覧に EG-128 は無い", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await openConfirm(page);
  await reasonInput(page).fill(REASON);
  await goBtn(page).click();
  await expect.poll(() => d.deletes.length).toBe(1);
  expect(d.deletes[0]!.q).toEqual({ reason: REASON });
  await expect(dlg(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/tickets(\?|$)/);
  await expect(page.getByText("EG-128 を消しました", { exact: true })).toBeVisible();
  await expect(undoBtn(page)).toBeVisible();
  await expect(listLink(page, "更新の見積を作る")).toBeVisible();
  await expect(listLink(page, TITLE)).toHaveCount(0);
});

test("K590-UI-011 再取得：消した後にそのチケットを開き直すと見つかりません（E-PAGE-001）。一覧にも出ない（口の答えで決まる）", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await openConfirm(page);
  await goBtn(page).click();
  await expect(page).toHaveURL(/\/tickets(\?|$)/);
  const res = await page.goto(`/tickets/${TICKET}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText(firstSentence("E-PAGE-001")).first()).toBeVisible();
  await page.goto("/tickets");
  await expect(listLink(page, "更新の見積を作る")).toBeVisible();
  await expect(listLink(page, TITLE)).toHaveCount(0);
});

test("K590-UI-012 元に戻す：お知らせの「元に戻す」を押すと戻す口を 1 回呼び、そのチケットの詳細へ戻り、お知らせ「EG-128 を元に戻しました」が出る。一覧にもまた出る（再取得）", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await openConfirm(page);
  await goBtn(page).click();
  await expect(undoBtn(page)).toBeVisible();
  await undoBtn(page).click();
  await expect.poll(() => d.restores.length).toBe(1);
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET}$`));
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByText("EG-128 を元に戻しました", { exact: true })).toBeVisible();
  expect(d.deleted).toBe(false);
  await page.goto("/tickets");
  await expect(listLink(page, TITLE)).toBeVisible();
});

test("K590-UI-013 お知らせは 5 秒で消える：消えた後は「元に戻す」が無く、戻す口は 0 回（消えた後に戻すのは記録の画面・F10）", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await openConfirm(page);
  await goBtn(page).click();
  const toast = page.getByText("EG-128 を消しました", { exact: true });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCount(0, { timeout: 9_000 });
  await expect(undoBtn(page)).toHaveCount(0);
  expect(d.restores).toEqual([]);
});

for (const [status, code] of [
  [403, E.restoreDeny],
  [409, E.restoreAlready],
  [409, E.restoreExpired],
  [409, E.restoreParentGone],
] as const) {
  test(`K590-UI-014 戻せない（${status}・${code}）：失敗のお知らせに正本の文が出て、自分で閉じるまで残る。一覧のまま移らず、戻す口は 1 回`, async ({
    page,
  }) => {
    const d = await setup(page);
    await openDetail(page, d);
    await openConfirm(page);
    await goBtn(page).click();
    d.on.restore = () => errReply(status, code);
    await undoBtn(page).click();
    await expect.poll(() => d.restores.length).toBe(1);
    await expect(page.getByText(msg(code)).first()).toBeVisible();
    await expect(page).toHaveURL(/\/tickets(\?|$)/);
    await expect(page.getByRole("button", { name: "閉じる", exact: true }).first()).toBeVisible();
  });
}

test("K590-UI-015 消す口が断った（権限が無くなった・403・E-DEL-001）：小窓の上の橙の箱に正本の文・小窓は開いたまま・一緒に起きることと書いた理由は残る・消えていない", async ({
  page,
}) => {
  const d = await setup(page);
  d.on.remove = () => errReply(403, E.deny);
  await openDetail(page, d);
  await openConfirm(page);
  await reasonInput(page).fill(REASON);
  await goBtn(page).click();
  await expect(noticeOf(page)).toHaveText(msg(E.deny));
  await expect(noticeOf(page)).toHaveAttribute("data-tone", "warn");
  await expect(reasonInput(page)).toHaveValue(REASON);
  expect((await togetherOf(page)).length).toBe(3);
  await expect(dlg(page)).toBeVisible();
  expect(d.deleted).toBe(false);
});

test("K590-UI-016 消せない人（下見が 403・E-DEL-001）：小窓には橙の箱（正本の文）と「やめる」だけが出る。一緒に起きること・理由・「消す」は出ず、消す口は 0 回", async ({
  page,
}) => {
  const d = await setup(page);
  d.on.preview = () => errReply(403, E.deny);
  await openDetail(page, d);
  await moreBtn(page).click();
  await deleteItem(page).click();
  await expect(dlg(page)).toBeVisible();
  expect(d.previews).toBe(1);
  await expect(noticeOf(page)).toHaveText(msg(E.deny));
  await expect(cancelBtn(page)).toBeVisible();
  await expect(goBtn(page)).toHaveCount(0);
  await expect(reasonInput(page)).toHaveCount(0);
  await expect(caution(page)).toHaveCount(0);
  await cancelBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(d.deletes).toEqual([]);
});

test("K590-UI-017 一緒に消す子・孫に消せない物がある（403・E-DEL-013）：小窓の上の橙の箱に正本の文・選んだ「一緒に消す」と理由は残り、小窓は開いたまま。別の扱い（親を外して単体にする）に替えて消せる", async ({
  page,
}) => {
  const d = await setup(page, children());
  await openDetail(page, d);
  await openConfirm(page);
  await choice(page, "一緒に消す").check();
  await reasonInput(page).fill(REASON);
  d.on.remove = () => errReply(403, E.cascadeDenied);
  await goBtn(page).click();
  await expect(noticeOf(page)).toHaveText(msg(E.cascadeDenied));
  await expect(noticeOf(page)).toHaveAttribute("data-tone", "warn");
  await expect(choice(page, "一緒に消す")).toBeChecked();
  await expect(reasonInput(page)).toHaveValue(REASON);
  await expect(dlg(page)).toBeVisible();
  await choice(page, "親を外して単体にする").check();
  d.on.remove = () => ({ status: 200, body: { data: { id: TICKET }, meta: {} } });
  await goBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(d.deletes.map((x) => x.q["children"])).toEqual(["cascade", "detach"]);
});

test("K590-UI-018 別のタブで子が増えた（409・E-DEL-010）：下見を読み直して子・孫の扱いを選ぶ小窓に替わる（案内・3 択）。橙の箱に正本の文・理由は残る・移す先を選ぶまで「消す」は押せない", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await openConfirm(page);
  await reasonInput(page).fill(REASON);
  d.on.remove = () => {
    d.on.preview = () => previewReply(PARENT_OF);
    return errReply(409, E.needChoice);
  };
  await goBtn(page).click();
  await expect(dlg(page).locator(".k-callout")).toBeVisible();
  await expect(noticeOf(page)).toHaveText(msg(E.needChoice));
  await expect(dlg(page).getByRole("radio")).toHaveCount(3);
  await expect(reasonInput(page)).toHaveValue(REASON);
  await expect(goBtn(page)).toHaveAttribute("aria-disabled", "true");
});

test("K590-UI-019 もう無い・見えない（404）：小窓が閉じ、見つかりません（E-PAGE-001）の画面になる（詳細を読み直す）", async ({
  page,
}) => {
  const d = await setup(page);
  d.on.remove = () => {
    d.deleted = true; // 別のタブで先に消された
    return errReply(404, "E-PAGE-001");
  };
  await openDetail(page, d);
  await openConfirm(page);
  await goBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(page.getByText(firstSentence("E-PAGE-001")).first()).toBeVisible();
});

test("K590-UI-020 送れない（500）：小窓の上の赤い箱に E-PAGE-007 の 1 文目・理由は残る。押し直すと 2 回目を送り、通れば閉じて一覧へ（口は 2 回）", async ({
  page,
}) => {
  const d = await setup(page);
  const ok = d.on.remove;
  let n = 0;
  d.on.remove = (req) => {
    n++;
    return n === 1 ? { status: 500, body: { error: "internal", code: "INTERNAL" } } : ok(req);
  };
  await openDetail(page, d);
  await openConfirm(page);
  await reasonInput(page).fill(REASON);
  await goBtn(page).click();
  await expect(noticeOf(page)).toContainText(firstSentence("E-PAGE-007"));
  await expect(reasonInput(page)).toHaveValue(REASON);
  await goBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect.poll(() => d.deletes.length).toBe(2);
  await expect(page).toHaveURL(/\/tickets(\?|$)/);
});

test("K590-UI-021 二度押し：答えを止めた間に「消す」を押すと口に 1 回届き、ボタンは押せない（busy）・小窓は閉じない。もう 1 回押しても口は 1 回だけ。答えると閉じる", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await openConfirm(page);
  const release = d.hold();
  await goBtn(page).click();
  await expect.poll(() => d.deletes.length).toBe(1);
  await expect(goBtn(page)).toBeDisabled();
  await goBtn(page).click({ force: true });
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toBeVisible();
  release();
  await expect(dlg(page)).toHaveCount(0);
  expect(d.deletes.length).toBe(1);
});

test("K590-UI-022 キーボード：「…」に焦点 → Enter で箱 → 「消す」で Enter → 確認の小窓 → Esc で閉じて焦点は「…」に戻る（口に 0 回）", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await moreBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(menuOf(page)).toBeVisible();
  await deleteItem(page).focus();
  await page.keyboard.press("Enter");
  await expect(dlg(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await expect(moreBtn(page)).toBeFocused();
  expect(d.deletes).toEqual([]);
});

test("K590-UI-026 理由は 400 字まで（K-488 の上限）：450 字を打っても欄は 400 字で止まり、消すと reason は 400 字", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  await openConfirm(page);
  await reasonInput(page).focus();
  await page.keyboard.insertText("あ".repeat(450));
  expect([...(await reasonInput(page).inputValue())].length).toBe(400);
  await goBtn(page).click();
  await expect.poll(() => d.deletes.length).toBe(1);
  expect([...(d.deletes[0]!.q["reason"] ?? "")].length).toBe(400);
});

test("K590-UI-027 下見が読めない（500）：小窓には赤い箱（E-PAGE-007 の 1 文目）と「やめる」だけが出る。一緒に起きること・理由・「消す」は出ず、消す口は 0 回。やめるで閉じられる", async ({
  page,
}) => {
  const d = await setup(page);
  d.on.preview = () => ({ status: 500, body: { error: "internal", code: "INTERNAL" } });
  await openDetail(page, d);
  await moreBtn(page).click();
  await deleteItem(page).click();
  await expect(dlg(page)).toBeVisible();
  await expect(noticeOf(page)).toContainText(firstSentence("E-PAGE-007"));
  await expect(noticeOf(page)).toHaveAttribute("data-tone", "danger");
  await expect(goBtn(page)).toHaveCount(0);
  await expect(reasonInput(page)).toHaveCount(0);
  await cancelBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(d.deletes).toEqual([]);
});

for (const w of MATCH_WIDTHS) {
  test(`K590-UI-023 幅 ${w}：「…」の箱・確認の小窓・子・孫の扱いの小窓は横溢れ 0・画面の中（左の端 0 以上・右の端が幅以下・足のボタンが画面の高さの中）`, async ({
    page,
  }) => {
    const d = await setup(page, children());
    await openDetail(page, d, w);
    await moreBtn(page).click();
    await expect(menuOf(page)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await deleteItem(page).click();
    await expect(dlg(page)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    const b = (await dlg(page).boundingBox())!;
    const vp = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    const foot = (await goBtn(page).boundingBox())!;
    expect(foot.y + foot.height).toBeLessThanOrEqual(vp.height);
  });
}

test("K590-UI-024 口の数（速さ）：詳細を開いて「…」を開いても下見は 0 回（getTicket 1 回）。「消す」を押した時に下見 1 回・確定で消す口 1 回。消した後の読み直しは一覧だけ", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page, d);
  expect(d.ticketReads).toBe(1);
  await moreBtn(page).click();
  await expect(menuOf(page)).toBeVisible();
  expect(d.previews).toBe(0);
  await deleteItem(page).click();
  await expect(dlg(page)).toBeVisible();
  expect(d.previews).toBe(1);
  await goBtn(page).click();
  await expect(page).toHaveURL(/\/tickets(\?|$)/);
  expect(d.deletes.length).toBe(1);
  expect(d.ticketReads).toBe(1);
  expect(d.restores).toEqual([]);
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock）
/** 本番をモックの状態にする手順 */
const DRIVE: Record<string, { widths: readonly number[]; skip?: string[]; go: (p: Page, w: number) => Promise<void> }> =
  {
    "f7-delete-confirm": {
      widths: [375, 1440],
      go: async (p, w) => {
        const d = await setup(p);
        await openDetail(p, d, w);
        await openConfirm(p);
        await reasonInput(p).fill(REASON);
      },
    },
    "f7-delete-children": {
      // 移す先は本番では前からの親を探す欄（モックは「移す先：…［変える］」の行）。一緒に起きることの子の行は選んだ親の名前を出さない（件数だけ）ので字を比べない
      widths: [375, 1440],
      skip: ["dialog-caution:texts"],
      go: async (p, w) => {
        const d = await setup(p, children());
        await openDetail(p, d, w);
        await openConfirm(p);
        await pickParent(p);
      },
    },
    "f7-delete-denied": {
      widths: [1440],
      go: async (p, w) => {
        const d = await setup(p, { preview: { ...PLAIN, pending_approvals: 0 } });
        d.on.remove = () => errReply(403, E.deny);
        await openDetail(p, d, w);
        await openConfirm(p);
        await reasonInput(p).fill(REASON);
        await goBtn(p).click();
        await expect(noticeOf(p)).toBeVisible();
      },
    },
    "f7-delete-undo": {
      // 消えた後の一覧の中身は本番の口の答え（モックの一覧とは顔ぶれが違う）。お知らせと「元に戻す」だけを比べる
      widths: [375, 1440],
      go: async (p, w) => {
        const d = await setup(p);
        await openDetail(p, d, w);
        await openConfirm(p);
        await goBtn(p).click();
        await expect(undoBtn(p)).toBeVisible();
      },
    },
  };
for (const [id, c] of Object.entries(DRIVE)) {
  for (const w of c.widths) {
    test(`K590-UI-025 ${id} 幅 ${w}：確認の小窓・断り・お知らせの値がモックと同じ（共通の道具 matchMock・役は DELETE_PAIRS）`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(browser, id, w, (p) => c.go(p, w), {
        base: "/dev/mock/f7",
        pairs: DELETE_PAIRS,
        blur: true,
        ...(c.skip ? { skip: c.skip } : {}),
      });
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}
