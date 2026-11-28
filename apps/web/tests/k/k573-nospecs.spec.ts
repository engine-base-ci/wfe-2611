// K-573「画面：『AI に任せる』で確認項目が 0 件のときの小窓（足す／理由を書いて任せる）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f4v2/f4v2-nospecs（代表が OK を出した下絵 v2・部品 features/F4/doc/detail-views.tsx の NoSpecsDialog）。字・並び・ボタンは下絵が正。
//   詳細と帯は前からの土台（approve-complete.harness.ts の mockApi）。getTicket の spec_count・no_spec_reason（K-560）と任せる口 delegateTicket（K-565）は
//   網の手前で重ねる（口の葉 K-560・K-565 と同時に書いているため。答えの形は 11_tickets/K-565.md・K-560.md）。道具は nospecs-mock.ts（この葉が持つ）。
//   「確認項目を足す」は K-450 の足す小窓を開く合図（window の kaname:f4:open-spec-add・detail は { ticketId }）。小窓そのものは K-450 の試験が見る。
//   固定の待ちは使わない。name は exact。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  TICKET,
  WIDTHS,
  addBtn,
  delegateBtn,
  dlg,
  failed,
  goBtn,
  mockNoSpecs,
  msg,
  noOverflow,
  noPc,
  noSpec,
  openDetail,
  quitBtn,
  reasonBox,
  running,
  specAddSignals,
  tooMany,
  wrongStage,
} from "./nospecs-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { bandOf, pending } from "../features/F5/approve-complete.harness";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const REASON = "定型の作業で、送ったメールを見れば確かめられる";
const TITLE = "確認項目がありません";
const LEAD = "足すか、使わない理由を書いてください。確認項目が無いと、終わったときに機械と人が確かめられません。";
const WHY_DISABLED = "理由を書くか、確認項目を足してください";
const MADE = /のAI に任せました。/;
const pressDelegate = async (page: Parameters<typeof openDetail>[0]) => {
  await delegateBtn(page).click();
  await expect(dlg(page)).toBeVisible();
};

// ---------------------------------------------------------------- 小窓を出す・出さない

test("K573-UI-001 入口：確認項目が 0 件で「AI に任せる」を押すと、任せる口を呼ばずに小窓「AI に任せる」が開く：対象の行「EG-133 11 月分の請求書を送る」・赤い注意「確認項目がありません」（足すか、使わない理由を書いてください…）・必須の欄「確認項目を使わない理由」（例の字つき・空）・足「やめる」「確認項目を足す」「理由を書いて任せる」（押せない）", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  await openDetail(page);
  await pressDelegate(page);
  const d = dlg(page);
  await expect(d.getByRole("heading", { name: "AI に任せる", exact: true })).toBeVisible();
  await expect(d.locator(".k-dialog-target")).toHaveText("EG-133 11 月分の請求書を送る");
  await expect(d.getByRole("alert").filter({ hasText: TITLE })).toBeVisible();
  await expect(d.getByText(LEAD, { exact: true })).toBeVisible();
  await expect(reasonBox(page)).toBeVisible();
  await expect(reasonBox(page)).toHaveJSProperty("required", true);
  await expect(reasonBox(page)).toHaveValue("");
  await expect(reasonBox(page)).toHaveAttribute("placeholder", `例：${REASON}`);
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText([
    "やめる",
    "確認項目を足す",
    "理由を書いて任せる",
  ]);
  await expect(goBtn(page)).toBeDisabled();
  expect(m.delegates).toHaveLength(0);
});

test("K573-UI-007 入力：確認項目が 1 件以上（spec_count 2）なら小窓を出さず、前のとおり任せる口に空の体 {} で 1 回届き、帯が「〇〇のAI に任せました。」になる", async ({
  page,
}) => {
  const m = await mockNoSpecs(page, { specCount: 2 });
  await openDetail(page);
  await delegateBtn(page).click();
  await expect.poll(() => m.delegates.length).toBe(1);
  expect(m.delegates[0]).toEqual({});
  await expect(dlg(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "AI に任せる", exact: true })).toContainText(MADE);
});

test("K573-UI-008 入力：getTicket が確認項目の数を持たない（前の口の答え）・null のときも、前のとおり小窓を出さずに空の体 {} で任せる（口の最後の砦に任せる）", async ({
  page,
}) => {
  const m = await mockNoSpecs(page, { specCount: "absent" });
  await openDetail(page);
  await delegateBtn(page).click();
  await expect.poll(() => m.delegates.length).toBe(1);
  expect(m.delegates[0]).toEqual({});
  await expect(dlg(page)).toHaveCount(0);
  const m2 = await mockNoSpecs(page, { specCount: null });
  await openDetail(page);
  await delegateBtn(page).click();
  await expect.poll(() => m2.delegates.length).toBe(1);
  expect(m2.delegates[0]).toEqual({});
});

// ---------------------------------------------------------------- 理由を書いて任せる

test("K573-UI-002 入力：「理由を書いて任せる」は理由が空・空白だけ（半角・全角・タブ・改行）の間は押せない（title「理由を書くか、確認項目を足してください」）で、1 字でも書くと押せ、消すとまた押せない。押せない間に押しても任せる口は 0 回", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  await openDetail(page);
  await pressDelegate(page);
  await expect(goBtn(page)).toHaveAttribute("title", WHY_DISABLED);
  for (const blank of [" ", "　", "\t", "\n", " 　\t\n "]) {
    await reasonBox(page).fill(blank);
    await expect(goBtn(page)).toBeDisabled();
  }
  await goBtn(page).click({ force: true });
  await reasonBox(page).fill("定");
  await expect(goBtn(page)).toBeEnabled();
  await reasonBox(page).fill("");
  await expect(goBtn(page)).toBeDisabled();
  expect(m.delegates).toHaveLength(0);
});

test("K573-UI-003 入力：理由を書いて「理由を書いて任せる」を押すと、任せる口に 1 回（体は { no_spec_reason } だけ・前後の空白を落とした字）。小窓が閉じ、帯が「〇〇のAI に任せました。」になる", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  await openDetail(page);
  await pressDelegate(page);
  await reasonBox(page).fill(`\u3000 ${REASON} \n`);
  await goBtn(page).click();
  await expect.poll(() => m.delegates.length).toBe(1);
  expect(m.delegates[0]).toEqual({ no_spec_reason: REASON });
  await expect(dlg(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "AI に任せる", exact: true })).toContainText(MADE);
});

test("K573-UI-006 入力：前に残した理由（getTicket の no_spec_reason）があれば欄に入っていて、そのまま「理由を書いて任せる」が押せる。押すと体の理由は残っていた字", async ({
  page,
}) => {
  const m = await mockNoSpecs(page, { noSpecReason: REASON });
  await openDetail(page);
  await pressDelegate(page);
  await expect(reasonBox(page)).toHaveValue(REASON);
  await expect(goBtn(page)).toBeEnabled();
  await goBtn(page).click();
  await expect.poll(() => m.delegates.length).toBe(1);
  expect(m.delegates[0]).toEqual({ no_spec_reason: REASON });
});

test("K573-UI-013 入力：理由は 500 字まで。501 字入れても欄は 500 字で止まり、任せると体の理由は 500 字", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  await openDetail(page);
  await pressDelegate(page);
  await reasonBox(page).fill("あ".repeat(501));
  await expect(reasonBox(page)).toHaveValue("あ".repeat(500));
  await goBtn(page).click();
  await expect.poll(() => m.delegates.length).toBe(1);
  expect(m.delegates[0]).toEqual({ no_spec_reason: "あ".repeat(500) });
});

// ---------------------------------------------------------------- やめる・足す

test("K573-UI-004 操作：「やめる」・Esc・頭の右上の ×「閉じる」で小窓が閉じ、任せる口は 0 回で「AI に任せる」が残る（焦点も戻る）。書きかけの理由は捨てられ、開き直すと空", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  await openDetail(page);
  for (const close of [
    () => quitBtn(page).click(),
    () => page.keyboard.press("Escape"),
    () => dlg(page).locator(".k-dialog-head").getByRole("button", { name: "閉じる" }).click(),
  ]) {
    await pressDelegate(page);
    await reasonBox(page).fill("書きかけ");
    await close();
    await expect(dlg(page)).toHaveCount(0);
    await expect(delegateBtn(page)).toBeVisible();
  }
  await pressDelegate(page);
  await expect(reasonBox(page)).toHaveValue("");
  expect(m.delegates).toHaveLength(0);
});

test("K573-UI-005 入力：「確認項目を足す」を押すと、小窓が閉じ、確認項目を足す小窓を開く合図（window の kaname:f4:open-spec-add・detail は { ticketId }）が 1 回出る。任せる口は 0 回で、「AI に任せる」が残る（足し終えたらもう一度押す）", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  await openDetail(page);
  await pressDelegate(page);
  await reasonBox(page).fill("途中の字");
  await addBtn(page).click();
  // 閉じるのは「AI に任せる」の小窓。合図を受けて K-450 の「確認項目を足す」の小窓が開くのは、つないだ後の正しい動き（段どうしを合わせた後）
  await expect(page.getByRole("dialog", { name: "AI に任せる" })).toHaveCount(0);
  expect(await specAddSignals(page)).toEqual([{ ticketId: TICKET }]);
  expect(m.delegates).toHaveLength(0);
  // 「確認項目を足す」の小窓（modal）が開いているので、後ろの画面は読み上げの木から外れる。見えているかで確かめる
  await expect(page.getByRole("button", { name: "AI に任せる", exact: true, includeHidden: true })).toBeVisible();
});

// ---------------------------------------------------------------- 失敗

test("K573-UI-009 失敗：画面は確認項目が 1 件と思っていたが口は 0 件（任せる口が 409・E-CONF-020）：小窓が開き（赤い注意）、詳細を読み直す（2 回目）。理由を書いて任せ直すと体は { no_spec_reason } で通り、帯が「任せました」になる（口は合計 2 回）", async ({
  page,
}) => {
  const m = await mockNoSpecs(page, { specCount: 1 });
  m.next = [noSpec()];
  await openDetail(page);
  const release = m.hold();
  await delegateBtn(page).click();
  await expect.poll(() => m.delegates.length).toBe(1);
  expect(m.delegates[0]).toEqual({});
  m.specCount = 0; // その間に確認項目が外された
  release();
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page).getByRole("alert").filter({ hasText: TITLE })).toBeVisible();
  await expect.poll(() => m.ticketReads).toBeGreaterThanOrEqual(2);
  await reasonBox(page).fill(REASON);
  await goBtn(page).click();
  await expect.poll(() => m.delegates.length).toBe(2);
  expect(m.delegates[1]).toEqual({ no_spec_reason: REASON });
  await expect(dlg(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "AI に任せる", exact: true })).toContainText(MADE);
});

test("K573-UI-010 失敗：小窓から任せて口が 409・E-CONF-013（もう走っている）：小窓が閉じ、帯に正本の文と走っている実行が出る（前の帯と同じ）。E-CONF-014（任せられない段）は小窓が閉じ、帯に正本の文・詳細を読み直す", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  m.next = [running()];
  await openDetail(page);
  await pressDelegate(page);
  await reasonBox(page).fill(REASON);
  await goBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "AI に任せる", exact: true })).toContainText(msg("E-CONF-013"));
  const m2 = await mockNoSpecs(page);
  m2.next = [wrongStage()];
  await openDetail(page);
  await pressDelegate(page);
  await reasonBox(page).fill(REASON);
  const reads = m2.ticketReads;
  await goBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "AI に任せる", exact: true })).toContainText(msg("E-CONF-014"));
  await expect.poll(() => m2.ticketReads).toBeGreaterThan(reads);
});

test("K573-UI-011 失敗：口が 503（E-PAGE-003）・409・E-CONN-001（PC がつながっていない・「PC をつなぐ」のリンク）・429（待つ秒数）：小窓は開いたまま、中の赤い箱に正本の文。書いた理由は残る。503 は押し直すと通る。429 は待つ間「理由を書いて任せる」が押せない", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  await openDetail(page);
  await pressDelegate(page);
  await reasonBox(page).fill(REASON);
  m.next = [failed()];
  await goBtn(page).click();
  await expect(
    dlg(page)
      .getByRole("alert")
      .filter({ hasText: msg("E-PAGE-003") }),
  ).toBeVisible();
  await expect(reasonBox(page)).toHaveValue(REASON);
  await expect(goBtn(page)).toBeEnabled();
  m.next = [noPc()];
  await goBtn(page).click();
  await expect(dlg(page).getByText(msg("E-CONN-001"), { exact: false })).toBeVisible();
  await expect(dlg(page).getByRole("link", { name: "PC をつなぐ", exact: true })).toHaveAttribute(
    "href",
    "/setup/bridge",
  );
  m.next = [tooMany(60)];
  await goBtn(page).click();
  await expect(
    dlg(page).getByText("押しすぎです。60 秒たってから、もう一度押してください", { exact: true }),
  ).toBeVisible();
  await expect(goBtn(page)).toBeDisabled();
  await expect(reasonBox(page)).toHaveValue(REASON);
  expect(m.delegates).toHaveLength(3);
  expect(m.started).toBe(false);
});

test("K573-UI-012 操作の揺れ：「理由を書いて任せる」の二度押し（答えを止めた間に続けて 2 回）は、任せる口 1 回。送っている間は押せない形で、小窓は閉じない。答えが来ると任せた形になる", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  await openDetail(page);
  await pressDelegate(page);
  await reasonBox(page).fill(REASON);
  const release = m.hold();
  await goBtn(page).click();
  await expect.poll(() => m.delegates.length).toBe(1);
  await expect(goBtn(page)).toBeDisabled();
  await goBtn(page).dispatchEvent("click");
  await expect(dlg(page)).toBeVisible();
  release();
  await expect(dlg(page)).toHaveCount(0);
  expect(m.delegates).toHaveLength(1);
});

// ---------------------------------------------------------------- 画面

test("K573-UI-014 画面：幅 375・768・1440 で小窓を開いても横溢れ 0。小窓が画面の中（左が 0 以上・右が幅以下）で、足の 3 つのボタンと「閉じる」が画面の中", async ({
  page,
}) => {
  await mockNoSpecs(page);
  for (const w of WIDTHS) {
    await openDetail(page, w);
    await pressDelegate(page);
    await noOverflow(page, w);
    const box = await dlg(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(w);
    for (const b of [quitBtn(page), addBtn(page), goBtn(page), dlg(page).getByRole("button", { name: "閉じる" })]) {
      const r = await b.boundingBox();
      expect(r, `幅 ${w}：画面の外`).not.toBeNull();
      expect(r!.x).toBeGreaterThanOrEqual(0);
      expect(r!.x + r!.width).toBeLessThanOrEqual(w);
    }
    await page.keyboard.press("Escape");
  }
});

test("K573-UI-015 画面：キーボードだけで、「AI に任せる」を Enter で小窓が開き、理由の欄から Tab で「やめる」→「確認項目を足す」の順に回る（押せない「理由を書いて任せる」は飛ばす）。理由を書くと Tab が「理由を書いて任せる」まで届き、Enter で任せられる。Esc で閉じると焦点は「AI に任せる」へ戻る", async ({
  page,
}) => {
  const m = await mockNoSpecs(page);
  await openDetail(page);
  await delegateBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(dlg(page)).toBeVisible();
  await reasonBox(page).focus();
  await page.keyboard.press("Tab");
  await expect(quitBtn(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(addBtn(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await expect(delegateBtn(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await reasonBox(page).fill(REASON);
  await addBtn(page).focus();
  await page.keyboard.press("Tab");
  await expect(goBtn(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => m.delegates.length).toBe(1);
});

const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height"];
const D_PAIRS: FidelityPair[] = [
  pair("dialog", ".k-dialog", ["x", "width", "background-color", "border-top-left-radius"]),
  pair("title", ".k-dialog-title", [...TXT, "x", "texts"]),
  pair("target", ".k-dialog-target", [...TXT, "x"]),
  pair("callout", ".k-callout", ["x", "width", "height", "background-color", "border-top-color"]),
  pair("callout-title", ".k-callout-title", [...TXT, "texts"]),
  pair("reason", ".k-dialog textarea", ["x", "width", "height", "font-size", "border-top-color", "background-color"]),
  pair("acts", ".k-dialog-actions .k-btn", [
    "width",
    "height",
    "font-size",
    "color",
    "background-color",
    "border-top-color",
    "opacity",
    "texts",
  ]),
];
test("K573-UI-016 画面：下絵との突き合わせ（f4v2-nospecs）：幅 375・768・1440 で小窓の箱・題・赤い注意（色・幅）・理由の欄・足の 3 つのボタン（押せない「理由を書いて任せる」の薄さを含む）が下絵と同じ（対象の行の字は番号・題名の違いを除く）", async ({
  browser,
}) => {
  for (const w of MATCH_WIDTHS) {
    const { rows, bad } = await matchMock(
      browser,
      "f4v2-nospecs",
      w,
      async (page) => {
        await mockNoSpecs(page);
        await openDetail(page, w);
        await pressDelegate(page);
        await expect(reasonBox(page)).toBeVisible();
      },
      { base: "/dev/mock/f4v2", pairs: D_PAIRS, blur: true },
    );
    expect(rows.length, `幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
    expect(bad, bad.join("\n")).toEqual([]);
  }
});

// ---------------------------------------------------------------- 口の数・守り

test("K573-UI-017 守り：小窓を開くだけでは口が増えない（getTicket 1 本のまま・任せる口 0 回）。書く口は任せる口だけで、本人の Bridge（38617）に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("127.0.0.1:38617")) bridge.push(r.url());
  });
  const m = await mockNoSpecs(page);
  await openDetail(page);
  const reads = m.ticketReads;
  await pressDelegate(page);
  await reasonBox(page).fill(REASON);
  expect(m.ticketReads).toBe(reads);
  expect(m.delegates).toHaveLength(0);
  expect(m.otherWrites).toEqual([]);
  expect(bridge).toEqual([]);
});

test("K573-UI-018 入口の確かめ（ブラウザを使わない）：「確認項目を足す」の合図の名前 kaname:f4:open-spec-add を features/F5/delegate/spec-add-event.ts が 1 か所に持ち、小窓の部品が確認項目の数（specCount）を読む", async () => {
  const f = join(WEB, "features/F5/delegate/spec-add-event.ts");
  expect(existsSync(f), "spec-add-event.ts が無い").toBe(true);
  const src = readFileSync(f, "utf8");
  expect(src).toMatch(/OPEN_SPEC_ADD_EVENT\s*=\s*"kaname:f4:open-spec-add"/);
  const band = readFileSync(join(WEB, "features/F5/delegate/delegate-band.tsx"), "utf8");
  expect(band, "delegate-band.tsx が specCount を読んでいない").toMatch(/specCount/);
});

// X8：「AI に任せる」は下絵 v2 のとおり題の行に出る（F5 の帯は状態の知らせだけ）
test("K573-UI-019 入口の置き場：「AI に任せる」は題の行（header.k-page-head の中）に 1 つだけ出て、帯（region「AI に任せる」）の中には無い。押すと同じ小窓が開き、止まった帯の中にも無い", async ({
  page,
}) => {
  await mockNoSpecs(page);
  await openDetail(page);
  await expect(
    page.locator("header.k-page-head").getByRole("button", { name: "AI に任せる", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: "AI に任せる", exact: true })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "AI に任せる" }).getByRole("button")).toHaveCount(0);
  await delegateBtn(page).click();
  await expect(dlg(page)).toBeVisible();
  await expect(goBtn(page)).toBeDisabled();
});

// 承認のカードの「検査なし」の横に、確認項目を使わない理由を出す（getTicket の no_spec_reason・D-150.45）
/** 承認待ちの詳細を開き、帯が出るまで待つ。決められる人は承認の帯（K-63 の region「承認と実行」）、決められない人は K-62 の帯（region「AI に任せる」）。
 *  openDetail は「AI に任せる」の帯だけを待つので、決められる人の承認待ちでは使えない */
async function openApproval(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await page.goto(`/tickets/${TICKET}`))?.status()).toBe(200);
  await expect(bandOf(page).or(page.getByRole("region", { name: "AI に任せる", exact: true }))).toBeVisible();
}
test("K573-UI-020 承認のカード：承認待ちの詳細で、確認の要約（検査なし）の横に「確認項目を使わない理由：…」が出る（決められる人の帯・決められない人の帯とも）。理由が無いチケットでは出ない", async ({
  page,
}) => {
  await mockNoSpecs(page, {
    specCount: 0,
    noSpecReason: REASON,
    band: { stage: "awaiting_approval", approval: pending() },
  });
  await openApproval(page);
  await expect(bandOf(page)).toContainText(`確認項目を使わない理由：${REASON}`);
  const p2 = await page.context().newPage();
  await mockNoSpecs(p2, {
    specCount: 0,
    noSpecReason: REASON,
    band: { stage: "awaiting_approval", approval: pending({ can_decide: false }) },
  });
  await openApproval(p2);
  await expect(p2.getByRole("region", { name: "AI に任せる" })).toContainText(`確認項目を使わない理由：${REASON}`);
  const p3 = await page.context().newPage();
  await mockNoSpecs(p3, {
    specCount: 0,
    noSpecReason: null,
    band: { stage: "awaiting_approval", approval: pending() },
  });
  await openApproval(p3);
  await expect(bandOf(p3)).not.toContainText("確認項目を使わない理由");
});
