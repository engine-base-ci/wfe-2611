// K-452「詳細の子チケット・つながり（子の一覧・つながりの一覧・外す確かめ・つながりを足す小窓・「子チケットを作る」から作る面へ）を契約の口につなぐ」の試験
//   （実 Chrome・口は網の手前で差し替え：前からの土台 mockApi の上に tests/k/links-mock.ts・実装より先に積む）。
//   口の形は口の葉 K-441 の md（listTicketLinks・createTicketLink・deleteTicketLink・断り E-LNK-001〜003）と同じ。
//   子の一覧は listTicketLinks の答えの meta.children（K-441）。候補は前からの一覧の口 listTickets（view=all・q・グループは行の scope＝K-560）で探す。
//   カードは閉じた形が既定（見出しの行に件数 子 N ・ つながり M と「開く」）。「開く」を押したときに口を 1 回読む（k237 の口の数 6 を保つ・K452-UI-026）。
//   つながりは「関連」「派生元」の 2 つだけ（D-150.16・D-150.22）。画面は役の名前で出し分けず、口の答え（can_remove・visible・side）で出し分ける。
//   見ること：足す・外すの結果は画面だけでなく、開き直して口を読み直した答えにも出る。固定の待ちは使わない（要素と口の数を待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { openTicket } from "../features/F5/approve-complete.harness";
import {
  C1,
  EG130,
  EG97,
  FORBIDDEN_TEXT,
  KR31,
  OTHER,
  REL,
  SRC,
  TICKET,
  WIDTHS,
  addDialog,
  candidate,
  card,
  conflict,
  expectSameAsMock,
  failed,
  forbidden,
  gone,
  hidden,
  link,
  linkRow,
  type LinkApi,
  type LinksMock,
  type TicketApi,
  msg,
  openAdd,
  openCard,
  openLinks,
  overflowX,
  reloadLinks,
  search,
  twoLinks,
  unlinkBtn,
  variantLinks,
} from "./links-mock";
import { toastOf } from "./test-spec-mock";

/** モック f4-links-collapsed の「つながり 3」（見える 2 つ＋関連 1 つ） */
const twoLinksPlus = (): LinkApi[] => [...twoLinks(), link("related", KR31)];
const cardCss = (page: Page) => page.locator(".k-detail-links");
const heading3 = (page: Page, text: string) => card(page).getByRole("heading", { level: 3, name: text, exact: true });

test("K452-UI-001 読む：詳細の本文の下に見出し「子チケット・つながり」（「子を足す」「つながりを足す」）。「子チケット 2」は EG-120・EG-121（題名・段の札 作業中／完了）、「つながり 2」は派生元 EG-110（山田様からの問い合わせを受ける・完了）が先で関連 JD-150（京蟻 保守運用（年間）・作業中）が後。つながりの行ごとに「外す」。口は 1 回だけ読む（子も同じ答えで来る）", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  await expect(card(page).getByRole("heading", { level: 2, name: "子チケット・つながり", exact: true })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "子を足す", exact: true })).toBeEnabled();
  await expect(card(page).getByRole("button", { name: "つながりを足す", exact: true })).toBeEnabled();
  await expect(heading3(page, "子チケット 2")).toBeVisible();
  await expect(heading3(page, "つながり 2")).toBeVisible();
  const items = card(page).getByRole("listitem");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText("EG-120");
  await expect(items.nth(0)).toContainText("回答の下書きを作る");
  await expect(items.nth(0)).toContainText("作業中");
  await expect(items.nth(1)).toContainText("EG-121");
  await expect(items.nth(1)).toContainText("完了");
  await expect(items.nth(2)).toContainText("派生元");
  await expect(items.nth(2)).toContainText("EG-110");
  await expect(items.nth(2)).toContainText("山田様からの問い合わせを受ける");
  await expect(items.nth(3)).toContainText("関連");
  await expect(items.nth(3)).toContainText("JD-150");
  await expect(items.nth(3)).toContainText("京蟻 保守運用（年間）");
  await expect(items.nth(3)).toContainText("作業中");
  await expect(card(page).getByRole("button", { name: /とのつながりを外す$/ })).toHaveCount(2);
  expect(l.reads, "つながりの口の回数").toBe(1);
});

test("K452-UI-002 空：子もつながりも 0 件の詳細は「子チケット 0」に「子チケットはまだありません。「子を足す」から作れます。」、「つながり 0」に「つながりはまだありません。「つながりを足す」から足せます。」。「子を足す」「つながりを足す」は押せる", async ({
  page,
}) => {
  await openLinks(page, { links: [], children: [] });
  await expect(heading3(page, "子チケット 0")).toBeVisible();
  await expect(heading3(page, "つながり 0")).toBeVisible();
  await expect(card(page)).toContainText("子チケットはまだありません。「子を足す」から作れます。");
  await expect(card(page)).toContainText("つながりはまだありません。「つながりを足す」から足せます。");
  await expect(card(page).getByRole("button", { name: "子を足す", exact: true })).toBeEnabled();
  await expect(card(page).getByRole("button", { name: "つながりを足す", exact: true })).toBeEnabled();
});

test("K452-UI-003 読めない：つながりの口が 503 のとき、カードの中に role=alert で口の文（E-PAGE-003）と「もう一度読む」。詳細の題の行は読める。口を直して「もう一度読む」を押すと口の 2 回目で一覧が出る", async ({
  page,
}) => {
  const { l } = await openLinks(page, { readStatus: 503 });
  await expect(card(page).getByRole("alert")).toContainText(msg("E-PAGE-003"));
  // 本文の形（区画 → 自由な 1 枚）に依らず、カードの上の題の行が読めること（詳細の外枠は壊れない）
  await expect(page.getByRole("heading", { level: 1, name: "11 月分の請求書を送る" })).toBeVisible(); // 詳細の答え（土台 mockApi）の題名
  l.readStatus = 200;
  await card(page).getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(heading3(page, "つながり 2")).toBeVisible();
  await expect(card(page).getByRole("alert")).toHaveCount(0);
  expect(l.reads).toBe(2);
});

test("K452-UI-004 入力：派生元のつながりは side で札を分ける。side=derived（このチケットの派生元）は「派生元」、side=source（このチケットから派生した）は「派生先」、関連は「関連」。並びは口の順のまま（派生元の 2 つが関連より先）", async ({
  page,
}) => {
  await openLinks(page, {
    links: [link("derived_from", SRC), link("derived_from", OTHER, { side: "source" }), link("related", REL)],
    children: [],
  });
  await expect(linkRow(page, "EG-110")).toContainText("派生元");
  await expect(linkRow(page, "EG-140")).toContainText("派生先");
  await expect(linkRow(page, "EG-140")).not.toContainText("派生元");
  await expect(linkRow(page, "JD-150")).toContainText("関連");
  const items = card(page).getByRole("listitem");
  await expect(items.nth(0)).toContainText("EG-110");
  await expect(items.nth(1)).toContainText("EG-140");
  await expect(items.nth(2)).toContainText("JD-150");
});

test("K452-UI-005 守り：相手が見えないつながり（visible=false・番号だけ）は、番号と「見えないチケット」だけを出し、題名・段の札は出さず、番号はリンクにしない。口が can_remove を返していれば「外す」は出る", async ({
  page,
}) => {
  await openLinks(page, { links: [hidden("related", "EG-150")], children: [] });
  const r = linkRow(page, "EG-150");
  await expect(r).toContainText("見えないチケット");
  await expect(r).not.toContainText("完了");
  await expect(r.getByRole("link")).toHaveCount(0);
  await expect(unlinkBtn(page, "EG-150")).toBeVisible();
});

test("K452-UI-006 守り：口の答え can_remove が false のつながりには「外す」が出ない（役の名前で決めない）。can_remove が true の行だけ「外す」が出る。「つながりを足す」「子を足す」は常に押せる（足せないときは口が断る・K452-UI-018）", async ({
  page,
}) => {
  await openLinks(page, { links: [link("derived_from", SRC, { can_remove: false }), link("related", REL)] });
  await expect(card(page).getByRole("button", { name: /とのつながりを外す$/ })).toHaveCount(1);
  await expect(unlinkBtn(page, "JD-150")).toBeVisible();
  await expect(unlinkBtn(page, "EG-110")).toHaveCount(0);
  await expect(linkRow(page, "EG-110")).toBeVisible();
});

test("K452-UI-007 入口：「外す」を押すと確かめ「つながりを外しますか」（説明「EG-110 山田様からの問い合わせを受ける との「派生元」のつながりを外します。どちらのチケットも消えません。」・「外す」「やめる」）。「やめる」で閉じると口は 0 回で行はそのまま", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  await unlinkBtn(page, "EG-110").click();
  const c = page.getByRole("alertdialog");
  await expect(c).toContainText("つながりを外しますか");
  await expect(c).toContainText(
    "EG-110 山田様からの問い合わせを受ける との「派生元」のつながりを外します。どちらのチケットも消えません。",
  );
  await c.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(c).toHaveCount(0);
  await expect(linkRow(page, "EG-110")).toBeVisible();
  expect(l.removes.length).toBe(0);
});

test("K452-UI-008 入力：外す（正常）。確かめの「外す」→口に DELETE 1 回（道は /api/v1/ticket_links/<そのつながりの id>・体なし）。確かめが閉じ、行が消え、見出しは「つながり 1」。相手のチケットは消えない（子の一覧は 2 のまま）。開き直しても出ない", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const id = l.links[0]!.id;
  await unlinkBtn(page, "EG-110").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "外す", exact: true }).click();
  await expect.poll(() => l.removes.length).toBe(1);
  expect(l.removes[0]).toBe(id);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(linkRow(page, "EG-110")).toHaveCount(0);
  await expect(heading3(page, "つながり 1")).toBeVisible();
  await expect(heading3(page, "子チケット 2")).toBeVisible();
  await reloadLinks(page);
  await expect(heading3(page, "つながり 1")).toBeVisible();
  await expect(linkRow(page, "EG-110")).toHaveCount(0);
});

test("K452-UI-009 失敗：外すのに口が 404（別の人が先に外していた・E-PAGE-001）→ 確かめが閉じ、口を 1 回読み直して、もう無い行が一覧から消える（赤い箱は出さない）", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  await unlinkBtn(page, "EG-110").click();
  l.links = l.links.filter((x) => x.other.number !== "EG-110"); // 別の人が先に外した
  const reads = l.reads;
  await page.getByRole("alertdialog").getByRole("button", { name: "外す", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect.poll(() => l.reads).toBe(reads + 1);
  await expect(linkRow(page, "EG-110")).toHaveCount(0);
  await expect(heading3(page, "つながり 1")).toBeVisible();
});

test("K452-UI-010 失敗：外すのに口が 403（入口の FORBIDDEN・message 無し・両端に書けなくなった直後）→ 確かめの中の role=alert に既定の文（「この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください」）。口が 503 → E-PAGE-003 の文。どちらも確かめは閉じず・行は残る。押し直して 200 になると確かめが閉じ行が消える", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const ok = l.on.remove;
  l.on.remove = () => forbidden();
  await unlinkBtn(page, "EG-110").click();
  const c = page.getByRole("alertdialog");
  await c.getByRole("button", { name: "外す", exact: true }).click();
  await expect(c.getByRole("alert")).toContainText(FORBIDDEN_TEXT);
  l.on.remove = () => failed();
  await c.getByRole("button", { name: "外す", exact: true }).click();
  await expect(c.getByRole("alert")).toContainText(msg("E-PAGE-003"));
  await expect(cardCss(page).getByText("EG-110", { exact: true })).toBeVisible();
  l.on.remove = ok;
  await c.getByRole("button", { name: "外す", exact: true }).click();
  await expect(c).toHaveCount(0);
  await expect(linkRow(page, "EG-110")).toHaveCount(0);
  expect(l.removes.length).toBe(3);
});

test("K452-UI-011 入口：「つながりを足す」を押すと小窓「つながりを足す」（対象にこのチケットの番号と題名）。タブ「今あるチケットとつなぐ」「子チケットを作る」・つながりの種類（関連「つながりがあるだけ。順番は決めない」・派生元「このチケットは、選んだチケットから生まれた」・既定は関連）・探す欄「チケットを探す」（番号か題名で探す）・「やめる」「つなぐ」（候補を選ぶまで押せない）。開いても口は 0 回", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const d = await openAdd(page);
  await expect(d).toContainText("EG-133 11 月分の請求書を送る");
  await expect(d.getByRole("tab", { name: "今あるチケットとつなぐ", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(d.getByRole("tab", { name: "子チケットを作る", exact: true })).toBeVisible();
  await expect(d.getByRole("radio", { name: /^関連/ })).toBeChecked();
  await expect(d).toContainText("つながりがあるだけ。順番は決めない");
  await expect(d).toContainText("このチケットは、選んだチケットから生まれた");
  await expect(d.getByRole("radio", { name: /^派生元/ })).not.toBeChecked();
  await expect(d.getByPlaceholder("番号か題名で探す")).toHaveValue("");
  await expect(d.getByRole("button", { name: "つなぐ", exact: true })).toBeDisabled();
  await expect(d.getByRole("button", { name: "やめる", exact: true })).toBeEnabled();
  expect(l.searches.length + l.adds.length).toBe(0);
});

test("K452-UI-012 入力：探す。打ち終わってから一覧の口 listTickets を view=all・q＝打った字で 1 回だけ呼び（打つたびには呼ばない）、候補に番号・題名・グループの名前（一覧の行の scope＝今のグループ・K-560）・段の札。「保守契約」→ EG-097 セイコー様 保守契約の見積・営業・完了。番号の頭は EG のまま経理へ移したチケット（EG-099）は経理と出る。全角「ＥＧ－０９７」でも同じ候補が出る", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const d = await openAdd(page);
  await d.getByLabel("チケットを探す", { exact: true }).pressSequentially("保守契約");
  await expect.poll(() => l.searches.length).toBe(1);
  expect(l.searches[0]!.get("view")).toBe("all");
  expect(l.searches[0]!.get("q")).toBe("保守契約");
  const c = candidate(d, "EG-097");
  await expect(c).toBeVisible();
  await expect(c).toContainText("セイコー様 保守契約の見積");
  await expect(c).toContainText("営業");
  await expect(c).toContainText("完了");
  expect(l.searches.length, "打つたびには呼ばない").toBe(1);
  await search(d, "移した確認");
  await expect(candidate(d, "EG-099")).toContainText("経理");
  await expect(candidate(d, "EG-099")).not.toContainText("営業");
  await search(d, "ＥＧ－０９７");
  await expect(candidate(d, "EG-097")).toBeVisible();
  await expect(d.getByRole("list", { name: "候補" }).getByRole("button")).toHaveCount(1);
});

test("K452-UI-013 守り：選べない候補。いまの種類（関連）で、もうつながっている JD-150 は「もうつながっている」で押せず（aria-disabled）、押しても選ばれず「つなぐ」は押せないまま。EG-097 は選べて aria-pressed。種類を派生元にすると、派生元でつながっている EG-110 が選べなくなる。このチケット自身（EG-133）は候補に出ない", async ({
  page,
}) => {
  await openLinks(page);
  const d = await openAdd(page);
  await search(d, "保守");
  const linked = candidate(d, "JD-150");
  await expect(linked).toContainText("もうつながっている");
  await expect(linked).toHaveAttribute("aria-disabled", "true");
  await linked.click({ force: true });
  await expect(linked).not.toHaveAttribute("aria-pressed", "true");
  await expect(d.getByRole("button", { name: "つなぐ", exact: true })).toBeDisabled();
  await candidate(d, "EG-097").click();
  await expect(candidate(d, "EG-097")).toHaveAttribute("aria-pressed", "true");
  await expect(d.getByRole("button", { name: "つなぐ", exact: true })).toBeEnabled();
  await search(d, "山田様");
  await expect(candidate(d, "EG-110")).not.toHaveAttribute("aria-disabled", "true");
  await d.getByRole("radio", { name: /^派生元/ }).check();
  await expect(candidate(d, "EG-110")).toHaveAttribute("aria-disabled", "true");
  await search(d, "請求書");
  await expect(d.getByRole("status")).toContainText("合うチケットがありません。番号か題名の一部で探してください。");
  await expect(d.getByRole("list", { name: "候補" })).toHaveCount(0);
});

test("K452-UI-014 入力：合う候補が無い字で探すと role=status「合うチケットがありません。番号か題名の一部で探してください。」。「つなぐ」は押せない。字を消すと候補の表示も消える（探す前の状態に戻る）", async ({
  page,
}) => {
  await openLinks(page);
  const d = await openAdd(page);
  await search(d, "存在しない題名");
  await expect(d.getByRole("status")).toContainText("合うチケットがありません。番号か題名の一部で探してください。");
  await expect(d.getByRole("button", { name: "つなぐ", exact: true })).toBeDisabled();
  await search(d, "");
  await expect(d.getByRole("status")).toHaveCount(0);
  await expect(d.getByRole("list", { name: "候補" })).toHaveCount(0);
});

test("K452-UI-015 失敗：候補を探す口が 503 → 小窓の中に「候補を読み込めませんでした」。「つなぐ」は押せない・探す欄の字は残る・ほかの欄（種類・タブ）は使える。字を打ち直すと探し直す", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  l.searchStatus = 503;
  const d = await openAdd(page);
  await search(d, "保守");
  await expect(d.getByText("候補を読み込めませんでした", { exact: true })).toBeVisible();
  await expect(d.getByRole("button", { name: "つなぐ", exact: true })).toBeDisabled();
  await expect(d.getByLabel("チケットを探す", { exact: true })).toHaveValue("保守");
  await expect(d.getByRole("radio", { name: /^派生元/ })).toBeEnabled();
  l.searchStatus = 200;
  await search(d, "保守契約");
  await expect(candidate(d, "EG-097")).toBeVisible();
  await expect(d.getByText("候補を読み込めませんでした", { exact: true })).toHaveCount(0);
});

test("K452-UI-016 入力：関連でつなぐ（正常）。候補 EG-097 を選んで「つなぐ」→口に 1 回、{ other_ticket_id: EG-097 の id, kind: related } と Idempotency-Key。小窓が閉じ「EG-097 とつなぎました」が出て、「つながり 3」に関連 EG-097 の行が増える（子の一覧は 2 のまま）。開き直して口を読み直しても同じ行が出る", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const d = await openAdd(page);
  await search(d, "保守契約");
  await candidate(d, "EG-097").click();
  await d.getByRole("button", { name: "つなぐ", exact: true }).click();
  await expect.poll(() => l.adds.length).toBe(1);
  expect(l.adds[0]!.body).toEqual({ other_ticket_id: EG97.id, kind: "related" });
  expect(l.adds[0]!.key, "Idempotency-Key").toBeTruthy();
  await expect(addDialog(page)).toHaveCount(0);
  await expect(toastOf(page, "EG-097 とつなぎました")).toBeVisible();
  await expect(heading3(page, "つながり 3")).toBeVisible();
  await expect(linkRow(page, "EG-097")).toContainText("関連");
  await expect(heading3(page, "子チケット 2")).toBeVisible();
  const reads = l.reads;
  await reloadLinks(page);
  await expect(linkRow(page, "EG-097")).toBeVisible();
  expect(l.reads).toBeGreaterThan(reads);
});

test("K452-UI-017 入力：派生元でつなぐ。種類を「派生元」にして EG-097 を選んで「つなぐ」→体の kind は derived_from。新しい行は「派生元」の札で、並びは派生元の 2 つ（EG-110・EG-097）が関連（JD-150）より先（開き直しても同じ並び）", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const d = await openAdd(page);
  await d.getByRole("radio", { name: /^派生元/ }).check();
  await search(d, "保守契約");
  await candidate(d, "EG-097").click();
  await d.getByRole("button", { name: "つなぐ", exact: true }).click();
  await expect.poll(() => l.adds.length).toBe(1);
  expect(l.adds[0]!.body).toEqual({ other_ticket_id: EG97.id, kind: "derived_from" });
  await expect(linkRow(page, "EG-097")).toContainText("派生元");
  const order = async () => {
    const items = await card(page).getByRole("listitem").allInnerTexts();
    return items.slice(2).map((t) => /(EG-110|EG-097|JD-150)/.exec(t)?.[1]);
  };
  expect(await order()).toEqual(["EG-110", "EG-097", "JD-150"]);
  await reloadLinks(page);
  await expect(linkRow(page, "EG-097")).toBeVisible();
  expect(await order()).toEqual(["EG-110", "EG-097", "JD-150"]);
});

test("K452-UI-018 失敗：つなぐのに口が 409（E-LNK-001 同じチケットとはつなげられない・E-LNK-002 もうつながっている・E-LNK-003 派生元が輪になる）→ 小窓の上の role=alert に口の文。口が 404（相手が消えた・E-PAGE-001／入口が返す NOT_FOUND）→ どちらも候補の下に E-PAGE-001 の文（状態コード 404 で出し分ける）。口が 403（読むだけの人・FORBIDDEN・message 無し）→ 小窓の上の alert に既定の文。口が 503 → alert に E-PAGE-003 の文。どれも選んだ候補と種類は残り小窓は開いたまま・「つなぐ」は押せる", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const d = await openAdd(page);
  await search(d, "保守契約");
  await candidate(d, "EG-097").click();
  for (const code of ["E-LNK-001", "E-LNK-002", "E-LNK-003"]) {
    l.on.add = () => conflict(code);
    await d.getByRole("button", { name: "つなぐ", exact: true }).click();
    await expect(d.getByRole("alert")).toContainText(msg(code));
  }
  l.on.add = () => gone();
  await d.getByRole("button", { name: "つなぐ", exact: true }).click();
  await expect(d.getByText(msg("E-PAGE-001"), { exact: true })).toBeVisible();
  l.on.add = () => gone("NOT_FOUND");
  await d.getByRole("button", { name: "つなぐ", exact: true }).click();
  await expect(d.getByText(msg("E-PAGE-001"), { exact: true })).toBeVisible();
  l.on.add = () => forbidden();
  await d.getByRole("button", { name: "つなぐ", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText(FORBIDDEN_TEXT);
  l.on.add = () => failed();
  await d.getByRole("button", { name: "つなぐ", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText(msg("E-PAGE-003"));
  expect(l.adds.length).toBe(7);
  await expect(candidate(d, "EG-097")).toHaveAttribute("aria-pressed", "true");
  await expect(d.getByRole("radio", { name: /^関連/ })).toBeChecked();
  await expect(d.getByRole("button", { name: "つなぐ", exact: true })).toBeEnabled();
  await expect(cardCss(page).getByText("EG-097", { exact: true })).toHaveCount(0);
});

test("K452-UI-019 操作の揺れ：二度押し。答えを止めた間に「つなぐ」を押し、口に 1 回届いたのを待ってからボタンが押せない（busy）のを見てもう 1 回押す：口は 1 回だけ。答えを返すと小窓が閉じ、行が 1 つだけ増える", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const d = await openAdd(page);
  await search(d, "保守契約");
  await candidate(d, "EG-097").click();
  const release = l.hold();
  await d.getByRole("button", { name: "つなぐ", exact: true }).click();
  await expect.poll(() => l.adds.length).toBe(1);
  await expect(d.getByRole("button", { name: "つなぐ", exact: true })).toBeDisabled();
  await d.getByRole("button", { name: "つなぐ", exact: true }).click({ force: true });
  expect(l.adds.length).toBe(1);
  release();
  await expect(addDialog(page)).toHaveCount(0);
  await expect(heading3(page, "つながり 3")).toBeVisible();
  expect(l.adds.length).toBe(1);
});

test("K452-UI-020 入口：子チケットは作る面で作る。「子を足す」を押すと、小窓を出さず口 0 回で /tickets?new=1&parent=<このチケットの id> に移る。「つながりを足す」の小窓のタブ「子チケットを作る」の説明（子チケットは、親の担当・期限を写して作れます。作る面が、このチケットを親にして開きます。）と「子チケットを作る」でも同じ道へ移り、小窓は閉じる", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const at = (u: URL) =>
    u.pathname === "/tickets" && u.searchParams.get("new") === "1" && u.searchParams.get("parent") === TICKET;
  await card(page).getByRole("button", { name: "子を足す", exact: true }).click();
  await page.waitForURL(at);
  await openTicket(page);
  await expect(card(page)).toBeVisible();
  await openCard(page); // 開き直すとカードは閉じた形（K-452）
  const d = await openAdd(page);
  await d.getByRole("tab", { name: "子チケットを作る", exact: true }).click();
  await expect(d).toContainText(
    "子チケットは、親の担当・期限を写して作れます。作る面が、このチケットを親にして開きます。",
  );
  await d.getByRole("button", { name: "子チケットを作る", exact: true }).click();
  await page.waitForURL(at);
  expect(l.adds.length + l.removes.length, "書く口").toBe(0);
});

test("K452-UI-021 入口：キーボード。「つながりを足す」に焦点 → Enter で小窓 → Esc で閉じ、焦点は「つながりを足す」に戻る。外す確かめも Esc で閉じて焦点は「外す」に戻る（どちらも口 0 回）", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  const add = card(page).getByRole("button", { name: "つながりを足す", exact: true });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(addDialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(addDialog(page)).toHaveCount(0);
  await expect(add).toBeFocused();
  await unlinkBtn(page, "EG-110").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(unlinkBtn(page, "EG-110")).toBeFocused();
  expect(l.searches.length + l.adds.length + l.removes.length).toBe(0);
});

test("K452-UI-022 入口：幅 375・768・1440 で、カードと、つながりを足す小窓（候補が出ている状態）・外す確かめを開いても横溢れ 0。小窓は画面の中（左 0 以上・右が幅以下・足のボタンが画面の高さの中）", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openLinks(page);
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    await expect(card(page)).toBeVisible();
    expect(await overflowX(page), `幅 ${w} のカード`).toBeLessThanOrEqual(0);
    const d = await openAdd(page);
    await search(d, "保守");
    await expect(candidate(d, "EG-097")).toBeVisible();
    expect(await overflowX(page), `幅 ${w} の足す小窓`).toBeLessThanOrEqual(0);
    const r = await d.evaluate((e) => {
      const b = e.getBoundingClientRect();
      const foot = e.querySelector(".k-dialog-actions button")?.getBoundingClientRect();
      return { left: b.left, right: b.right, foot: foot?.bottom ?? 0, vw: innerWidth, vh: innerHeight };
    });
    expect(r.left, `幅 ${w} の左`).toBeGreaterThanOrEqual(0);
    expect(r.right, `幅 ${w} の右`).toBeLessThanOrEqual(r.vw);
    expect(r.foot, `幅 ${w} の足のボタン`).toBeLessThanOrEqual(r.vh);
    await d.getByRole("button", { name: "やめる", exact: true }).click();
    await unlinkBtn(page, "JD-150").click();
    expect(await overflowX(page), `幅 ${w} の外す確かめ`).toBeLessThanOrEqual(0);
    await page.getByRole("alertdialog").getByRole("button", { name: "やめる", exact: true }).click();
  }
});

test("K452-UI-023 守り（速さ）：「開く」を押したとき、つながりの口は 1 回だけ（二重なし・子の一覧も同じ答えで来るので別の口を呼ばない・K452-UI-026）。小窓を開く・外す確かめを開くだけでは口は 0 回。探す口は打ち終わりごとに 1 回", async ({
  page,
}) => {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (/\/api\//.test(r.url()) && r.method() !== "OPTIONS") seen.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  const { l } = await openLinks(page);
  await expect.poll(() => seen.filter((x) => x.endsWith("/links")).length).toBe(1);
  expect(l.reads).toBe(1);
  expect(seen.filter((x) => /\/api\/v1\/tickets$/.test(x)).length, "子のために一覧の口を呼ばない").toBe(0);
  const before = seen.length;
  const d = await openAdd(page);
  await d.getByRole("button", { name: "やめる", exact: true }).click();
  await unlinkBtn(page, "EG-110").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "やめる", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(seen.length - before, "小窓を開いて閉じるだけで増えた口").toBe(0);
});

test("K452-UI-024 入力：モックとの突き合わせ（6 の状態 × 幅 375・768・1440）。f4-links・f4-links-collapsed（閉じた形・子 2 ・ つながり 3）・f4-links-variants（派生元・派生先・見えない派生先・関連の 4 つ）・f4-links-empty・f4-link-remove・f4-link-add を本番で同じ形にして、カード・行・小窓・候補の役の値（大きさ・色・字・字の中身）がモックと同じ（px は ±2。位置は比べない）。f4-link-add は「保守」で探して EG-097 を選んだ形（候補は 3 つ：JD-150 はもうつながっている）", async ({
  browser,
}) => {
  test.setTimeout(360_000);
  const cases: {
    id: string;
    setup: { links?: LinkApi[]; children?: TicketApi[]; closed?: boolean };
    drive: (page: Page, l: LinksMock) => Promise<void>;
  }[] = [
    { id: "f4-links", setup: {}, drive: async () => undefined },
    {
      id: "f4-links-collapsed",
      setup: { links: [...twoLinksPlus()], closed: true },
      drive: async () => undefined,
    },
    { id: "f4-links-variants", setup: { links: variantLinks() }, drive: async () => undefined },
    { id: "f4-links-empty", setup: { links: [], children: [] }, drive: async () => undefined },
    {
      id: "f4-link-remove",
      setup: {},
      drive: async (page) => {
        await unlinkBtn(page, "JD-150").click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
      },
    },
    {
      id: "f4-link-add",
      setup: {},
      drive: async (page, l) => {
        l.searchAnswer = () => [REL, EG97, KR31];
        const d = await openAdd(page);
        await search(d, "保守");
        await candidate(d, "EG-097").click();
      },
    },
  ];
  for (const c of cases) {
    for (const w of WIDTHS) {
      await expectSameAsMock(browser, c.id, w, c.setup, c.drive);
    }
  }
});

test("K452-UI-025 入口：子チケットの番号はリンクで、押すとその子の詳細（/tickets/<子の id>・同じタブ）へ移る。見えない相手（K452-UI-005）の番号はリンクにしない。口は読み直す以外に呼ばない", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  await card(page).getByRole("link", { name: "EG-120", exact: true }).click();
  await page.waitForURL((u) => u.pathname === `/tickets/${C1.id}`);
  expect(l.adds.length + l.removes.length).toBe(0);
});

test("K452-UI-026 守り（速さ）：閉じた形が既定。詳細を開いても、つながりの口は呼ばない。見出しの行に件数（getTicket の child_count・link_count＝「子 2 ・ つながり 2」）と「開く」（aria-expanded=false）だけが出て、子・つながりの一覧・空の文・「子を足す」「つながりを足す」は出ない。「開く」を押したとき口を 1 回読んで一覧が出る（口 6 の数え方で、開いたときの口につながりは入らない）", async ({
  page,
}) => {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (/\/api\//.test(r.url()) && r.method() !== "OPTIONS") seen.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  const { l } = await openLinks(page, { closed: true });
  await expect.poll(() => seen.some((x) => x === `GET /api/v1/tickets/${TICKET}`)).toBe(true);
  await expect(card(page).getByRole("heading", { level: 2, name: "子チケット・つながり", exact: true })).toBeVisible();
  await expect(card(page)).toContainText("子 2 ・ つながり 2");
  const open = card(page).getByRole("button", { name: "開く", exact: true });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(card(page).getByRole("button")).toHaveCount(1);
  await expect(card(page).getByRole("listitem")).toHaveCount(0);
  expect(l.reads, "閉じたままは読まない").toBe(0);
  expect(seen.filter((x) => x.endsWith("/links")).length, "つながりの口").toBe(0);
  await open.click();
  await expect.poll(() => l.reads).toBe(1);
  await expect(heading3(page, "つながり 2")).toBeVisible();
  await expect(heading3(page, "子チケット 2")).toBeVisible();
});

test("K452-UI-027 入口：作る面で子を作って戻る。「子を足す」で作る面へ移り、子が 1 つ増えたあとブラウザの戻るで詳細に戻ると、閉じた形の件数は getTicket の読み直しで「子 3」になり、戻っただけではつながりの口を読まない。「開く」で口を読み直すと新しい子が出る（古い一覧を出さない）", async ({
  page,
}) => {
  const { l } = await openLinks(page);
  expect(l.reads).toBe(1);
  await card(page).getByRole("button", { name: "子を足す", exact: true }).click();
  await page.waitForURL(
    (u) => u.pathname === "/tickets" && u.searchParams.get("new") === "1" && u.searchParams.get("parent") === TICKET,
  );
  l.children = [...l.children, EG130]; // 作る面で子ができた
  await page.goBack();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText("子 3");
  expect(l.reads, "戻っただけでは読まない").toBe(1);
  await card(page).getByRole("button", { name: "開く", exact: true }).click();
  await expect.poll(() => l.reads).toBe(2);
  await expect(heading3(page, "子チケット 3")).toBeVisible();
  await expect(card(page).getByRole("listitem").filter({ hasText: "EG-130" })).toBeVisible();
});
