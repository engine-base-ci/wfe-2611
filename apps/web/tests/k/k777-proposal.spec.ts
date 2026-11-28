// K-777「画面：AI の案のカード（［全部使う］［選んで使う］＝欄ごとのチェック・使った欄の印）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5 の create-talk-proposal・create-talk-select・create-talk-applied-all・create-talk-applied-some（代表 OK：2026-11-23）。
//   人が直した欄と案が食い違うときは小窓を出さず会話で AI が聞く（answer=85c6211ac1b5）。案の形は K-775（proposal { title?, body?, checks?[] }・出した欄だけ）。
//   作る面は K-442 の create-mock.ts・会話の口は K-767 の create-talk-mock.ts。固定の待ちは使わない。name は { exact: true }。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type Page } from "@playwright/test";
import { bodyBox, openCreate } from "./create-mock";
import {
  AI_LINE,
  CT_SAY,
  ME_LINE,
  chatBox,
  chatSend,
  chatSide,
  draftView,
  howAi,
  mockCreateTalk,
  type CreateTalkMock,
} from "./create-talk-mock";
import { msgOf, at } from "./talk-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const P_TITLE = "セイコー様へ 12 月分の作業報告書を送る";
const P_BODY = "11 月分と同じ形で 12 月分の作業報告書を作り、PDF で山田様にメールで送る";
const P_CHECKS = ["作業時間の合計が稼働記録と同じ", "宛名が山田様になっている", "12/26 までに送っている"];
const proposalMsg = (pr: Record<string, unknown> = { title: P_TITLE, body: P_BODY, checks: P_CHECKS }) =>
  msgOf({ who: "ai", at: at(0, "10:40"), text: "", proposal: pr });
const card = (p: Page) => chatSide(p).getByRole("article", { name: "AI の案", exact: true });
const titleBox = (p: Page) => p.getByRole("textbox", { name: /^題名/ });
/** 左の作る面の確認項目の欄（K-450 の specs-item の並び） */
const specList = (p: Page) => p.locator("form").getByRole("list", { name: "確認項目", exact: true });
/** 下絵 create-talk-proposal と同じ AI の返事の字（「見たもの」は K-755 が下絵から外す） */
const AI_SAY = "11 月分のチケットを見て案を作りました。欄に入れる物を選んでください。期限は 12/26（金）にしています。";

async function withProposal(page: Page, pr?: Record<string, unknown>, w = 1440): Promise<CreateTalkMock> {
  const t = await mockCreateTalk(page);
  // 行の id は読み直しでも同じ（本物の口と同じ）。読むたびに作り直すと id が乱数で替わり、使った結果を覚えたカードが別の案に見える（K-762 の流れの読み直し）
  const messages = [ME_LINE(), AI_LINE(AI_SAY), proposalMsg(pr)];
  t.on.view = () => ({
    status: 200,
    body: {
      data: draftView({ messages }),
    },
  });
  await openCreate(page, w);
  await howAi(page).click();
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect(card(page)).toBeVisible();
  return t;
}

test("K777-UI-001 案のカード：案の行は「案」の札・「チケットの案」・「まだ欄には入っていません」と、出した欄（題名・本文・確認項目（3 件））の中身の先頭と［全部使う］［選んで使う］", async ({
  page,
}) => {
  await withProposal(page);
  await expect(card(page).locator(".k-room-prop-head")).toContainText("チケットの案");
  await expect(card(page).locator(".k-room-prop-head")).toContainText("まだ欄には入っていません");
  const items = card(page).locator(".k-room-prop-list > li");
  await expect(items.locator(".k-room-prop-name")).toHaveText(["題名", "本文", "確認項目（3 件）"]);
  await expect(items.nth(0).locator(".k-room-prop-val")).toHaveText(P_TITLE);
  await expect(items.nth(2).locator(".k-room-prop-val")).toHaveText("作業時間の合計が稼働記録と同じ ほか 2 件");
  await expect(card(page).getByRole("button", { name: "全部使う", exact: true })).toBeVisible();
  await expect(card(page).getByRole("button", { name: "選んで使う", exact: true })).toBeVisible();
});

test("K777-UI-002 出した欄だけ：題名だけの案なら題名の行だけが出る（本文・確認項目の行は出さない）", async ({
  page,
}) => {
  await withProposal(page, { title: P_TITLE });
  await expect(card(page).locator(".k-room-prop-list > li")).toHaveCount(1);
  await expect(card(page).locator(".k-room-prop-name")).toHaveText(["題名"]);
});

test("K777-UI-003 全部使う：左の題名・本文に案の字が入り、確認項目に案の 3 件が足される。入った欄の名前の横に「AI の案」の札・カードは「全部の欄に入りました」と各行「欄に入りました」", async ({
  page,
}) => {
  await withProposal(page);
  await card(page).getByRole("button", { name: "全部使う", exact: true }).click();
  await expect(titleBox(page)).toHaveValue(P_TITLE);
  await expect(bodyBox(page)).toContainText(P_BODY);
  for (const c of P_CHECKS) await expect(specList(page).getByText(c, { exact: true })).toHaveCount(1);
  await expect(page.getByText("AI の案", { exact: true })).not.toHaveCount(0);
  await expect(card(page).locator(".k-room-prop-head")).toContainText("全部の欄に入りました");
  await expect(card(page).locator(".k-room-prop-name small")).toHaveText([
    "欄に入りました",
    "欄に入りました",
    "欄に入りました",
  ]);
  await expect(card(page).getByRole("button")).toHaveCount(0);
});

test("K777-UI-004 選んで使う：押すと欄ごとの四角（最初は全部に印）と［選んだ欄を使う（N 件）］［やめる］。印を外すと数が減る・［やめる］で元のカードに戻る", async ({
  page,
}) => {
  await withProposal(page);
  await card(page).getByRole("button", { name: "選んで使う", exact: true }).click();
  await expect(card(page).locator(".k-room-prop-head")).toContainText("使う欄にチェックを付けてください");
  const boxes = card(page).getByRole("checkbox");
  await expect(boxes).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(boxes.nth(i)).toBeChecked();
  await card(page).getByRole("checkbox", { name: "本文", exact: true }).uncheck();
  await expect(card(page).getByRole("button", { name: "選んだ欄を使う（2 件）", exact: true })).toBeVisible();
  await card(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(card(page).getByRole("button", { name: "全部使う", exact: true })).toBeVisible();
});

test("K777-UI-005 選んだ欄を使う：題名と確認項目だけを入れ、本文は入れない。カードは「選んだ欄に入りました」・本文の行は「使っていません」", async ({
  page,
}) => {
  await withProposal(page);
  await titleBox(page).fill("");
  await card(page).getByRole("button", { name: "選んで使う", exact: true }).click();
  await card(page).getByRole("checkbox", { name: "本文", exact: true }).uncheck();
  await card(page).getByRole("button", { name: "選んだ欄を使う（2 件）", exact: true }).click();
  await expect(titleBox(page)).toHaveValue(P_TITLE);
  await expect(bodyBox(page)).not.toContainText(P_BODY);
  for (const c of P_CHECKS) await expect(specList(page).getByText(c, { exact: true })).toHaveCount(1);
  await expect(card(page).locator(".k-room-prop-head")).toContainText("選んだ欄に入りました");
  await expect(card(page).locator(".k-room-prop-name small")).toHaveText([
    "欄に入りました",
    "使っていません",
    "欄に入りました",
  ]);
});

test("K777-UI-006 選ぶ数が 0：全部の印を外すと［選んだ欄を使う（0 件）］は押せない", async ({ page }) => {
  await withProposal(page);
  await card(page).getByRole("button", { name: "選んで使う", exact: true }).click();
  for (const n of ["題名", "本文", "確認項目（3 件）"])
    await card(page).getByRole("checkbox", { name: n, exact: true }).uncheck();
  await expect(card(page).getByRole("button", { name: "選んだ欄を使う（0 件）", exact: true })).toBeDisabled();
});

test("K777-UI-007 人が直した欄：人が題名を書いてあっても小窓を出さずに案の字に替える（食い違いは会話で AI が聞く・answer=85c6211ac1b5）。確認項目はもとの物を残して足す（同じ字は 2 つにしない）", async ({
  page,
}) => {
  await withProposal(page);
  await titleBox(page).fill("自分で書いた題名");
  await card(page).getByRole("button", { name: "全部使う", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(titleBox(page)).toHaveValue(P_TITLE);
  await expect(specList(page).getByText(P_CHECKS[0]!, { exact: true })).toHaveCount(1);
});

test("K777-UI-008 使った後に直した：入れた欄を人が直すと、札が「AI の案」から「直しました」に替わり、次に言うとき edited にその欄が入る", async ({
  page,
}) => {
  const t = await withProposal(page);
  await card(page).getByRole("button", { name: "全部使う", exact: true }).click();
  await titleBox(page).fill(`${P_TITLE}（12/26 まで）`);
  await expect(page.getByText("直しました", { exact: true }).first()).toBeVisible();
  const n = t.says.length;
  await chatBox(page).fill("期限を入れた");
  await chatSend(page).click();
  await expect.poll(() => t.says.length).toBe(n + 1);
  expect(t.says.at(-1)!.body["edited"]).toEqual(["title"]);
  // 言った後の読み直し（同じ画面）でも、使ったカードは「全部の欄に入りました」のまま（題名は直したので題名の行は「欄に入りました」のまま覚えている）
  await expect(card(page).locator(".k-room-prop-head")).toContainText("全部の欄に入りました");
});

test("K777-UI-009 使った直後に言う：案を入れた欄は edited に入れない（AI の案のままの欄は直した欄ではない）", async ({
  page,
}) => {
  const t = await withProposal(page);
  await card(page).getByRole("button", { name: "全部使う", exact: true }).click();
  const n = t.says.length;
  await chatBox(page).fill("これで足りる？");
  await chatSend(page).click();
  await expect.poll(() => t.says.length).toBe(n + 1);
  expect(t.says.at(-1)!.body["edited"]).toEqual([]);
  expect((t.says.at(-1)!.body["draft"] as Record<string, unknown>)["title"]).toBe(P_TITLE);
});

test("K777-UI-010 守り：案を使うだけでは口を呼ばない（作る口・言う口 0）・字は HTML にしない", async ({ page }) => {
  const t = await withProposal(page, { title: "<img src=x>の題名" });
  const n = t.says.length;
  await card(page).getByRole("button", { name: "全部使う", exact: true }).click();
  await expect(titleBox(page)).toHaveValue("<img src=x>の題名");
  await expect(card(page).locator("img")).toHaveCount(0);
  expect(t.says.length).toBe(n);
  expect(t.create.creates.length).toBe(0);
});

test("K777-UI-011 キーボード：［選んで使う］から四角を Space で切り替え、Tab で［選んだ欄を使う］に届き Enter で入る", async ({
  page,
}) => {
  await withProposal(page);
  await card(page).getByRole("button", { name: "選んで使う", exact: true }).focus();
  await page.keyboard.press("Enter");
  const box = card(page).getByRole("checkbox", { name: "本文", exact: true });
  await box.focus();
  await page.keyboard.press("Space");
  await expect(box).not.toBeChecked();
  await card(page).getByRole("button", { name: "選んだ欄を使う（2 件）", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(titleBox(page)).toHaveValue(P_TITLE);
});

test("K777-UI-014 先頭の字：本文が 81 字以上なら先頭 80 字と「…」・確認項目が 1 件なら「確認項目（1 件）」とその字そのまま", async ({
  page,
}) => {
  const long = "あ".repeat(90);
  await withProposal(page, { body: long, checks: ["宛名が山田様になっている"] });
  const items = card(page).locator(".k-room-prop-list > li");
  await expect(items.locator(".k-room-prop-name")).toHaveText(["本文", "確認項目（1 件）"]);
  await expect(items.nth(0).locator(".k-room-prop-val")).toHaveText(`${"あ".repeat(80)}…`);
  await expect(items.nth(1).locator(".k-room-prop-val")).toHaveText("宛名が山田様になっている");
});

test("K777-UI-015 案が 2 つ：古い案のカードも新しい案のカードも別々に使え、後から使ったカードの字が欄に入る（前に使ったカードの行は、欄の字が替わったので「使っていません」に替わる）", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  t.on.view = () => ({
    status: 200,
    body: {
      data: draftView({
        messages: [
          ME_LINE(),
          AI_LINE(AI_SAY),
          proposalMsg({ title: "古い題名" }),
          AI_LINE("直しました"),
          proposalMsg({ title: "新しい題名" }),
        ],
      }),
    },
  });
  await openCreate(page);
  await howAi(page).click();
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  const cards = chatSide(page).getByRole("article", { name: "AI の案", exact: true });
  await expect(cards).toHaveCount(2);
  await cards.nth(1).getByRole("button", { name: "全部使う", exact: true }).click();
  await expect(titleBox(page)).toHaveValue("新しい題名");
  await cards.nth(0).getByRole("button", { name: "全部使う", exact: true }).click();
  await expect(titleBox(page)).toHaveValue("古い題名");
  await expect(cards.nth(1).locator(".k-room-prop-name small")).toHaveText(["使っていません"]);
});

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
const p = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
const PROP_PAIRS: FidelityPair[] = [
  p("prop", ".k-room-prop", BOX),
  p("prop-head", ".k-room-prop-head", ["x", "y", "width", "texts"]),
  p("prop-list", ".k-room-prop-list", ["x", "y", "width", "texts"]),
  p("prop-name", ".k-room-prop-name", ["font-size", "font-weight", "color"]),
  p("prop-val", ".k-room-prop-val", ["font-size", "color"]),
  p("choice", ".k-room-prop .k-room-choice", ["x", "y", "height"]),
  p("acts", ".k-room-prop-acts button", CTRL),
];
// 注：左の欄は K-442 の作る面で下絵の見本の欄と違うので、カードの役だけを比べる。
//   カードの上の会話（人の言葉・AI の返事）は下絵と同じ字にしたが、カードの y は会話の欄の巻き（欄の高さ）で変わるので、y はカードの上端から読む代わりに比べない
//   下絵の選んで使うの印は人が外した後の形＝本文だけ外す
const Y_SKIP = ["prop:y", "prop-head:y", "prop-list:y", "choice:y", "acts:y"];
async function match(browser: Browser, id: string, after: (pg: Page) => Promise<void>) {
  const bad: string[] = [];
  for (const w of MATCH_WIDTHS.filter((x) => x >= 768)) {
    const r = await matchMock(
      browser,
      id,
      w,
      async (pg) => {
        await withProposal(pg, undefined, w);
        await after(pg);
      },
      { pairs: PROP_PAIRS, base: "/dev/mock/f5", skip: Y_SKIP },
    );
    bad.push(...r.bad);
  }
  expect(bad, bad.join("\n")).toEqual([]);
}
test("K777-UI-012 下絵との突き合わせ：create-talk-proposal・create-talk-select（本文だけ外した形）", async ({
  browser,
}) => {
  await match(browser, "create-talk-proposal", async () => undefined);
  await match(browser, "create-talk-select", async (pg) => {
    await card(pg).getByRole("button", { name: "選んで使う", exact: true }).click();
    await card(pg).getByRole("checkbox", { name: "本文", exact: true }).uncheck();
  });
});
test("K777-UI-013 下絵との突き合わせ：create-talk-applied-all・create-talk-applied-some", async ({ browser }) => {
  await match(browser, "create-talk-applied-all", async (pg) => {
    await card(pg).getByRole("button", { name: "全部使う", exact: true }).click();
  });
  await match(browser, "create-talk-applied-some", async (pg) => {
    await card(pg).getByRole("button", { name: "選んで使う", exact: true }).click();
    await card(pg).getByRole("checkbox", { name: "本文", exact: true }).uncheck();
    await card(pg).getByRole("button", { name: "選んだ欄を使う（2 件）", exact: true }).click();
  });
});
