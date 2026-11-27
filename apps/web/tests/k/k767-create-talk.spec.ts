// K-767「画面：チケットを作る画面の右の AI との会話（会話の欄・送る／止める・書きながら・作業中の 1 行・言うたびに欄の今の中身を渡した印・PC がまだ・スマホは頭の［AI と話して作る］で全画面）と、作った後に会話をチケットへ移す」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5 の create-talk-empty・create-talk-thinking・create-talk-writing・create-talk-edited・create-talk-error・create-talk-nopc・
//   create-talk-mobile・create-talk-mobile-form・tk-talk-from-create（代表 OK：2026-11-23・D-153.17・D-153.35・D-153.36）。案のカード（create-talk-proposal ほか）は K-777。
//   作る画面は段 5 の K-442（tests/k/create-mock.ts の mockCreate）。会話の口は create-talk-mock.ts の mockCreateTalk。「見たもの」は出さない（D-153.34）。
//   固定の待ちは使わない。name は { exact: true }。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type Page } from "@playwright/test";
import { fillRequired, openCreate } from "./create-mock";
import {
  AI_LINE,
  CT_SAY,
  DCONV,
  JOB,
  ME_LINE,
  NEW_ID,
  chatBox,
  chatSend,
  chatSide,
  draftView,
  howAi,
  mockCreateTalk,
  working,
} from "./create-talk-mock";
import { err, msg, overflowX, WIDTHS_ALL } from "./room-mock";
import { at, msgOf } from "./talk-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const titleBox = (p: Page) => p.getByRole("textbox", { name: /^題名/ });
const openTalk = async (p: Page, w = 1440) => {
  await openCreate(p, w);
  await howAi(p).click();
  await expect(chatSide(p)).toBeVisible();
};
const bubbles = (p: Page) => chatSide(p).locator(".k-room-msg");

test("K767-UI-001 入口：作り方の「AI と話して作る」が押せる形になり、押すと欄の右に会話（頭「高本のAIと話して作る」・「何を作りたいか、話しかけてください」と例 3 つ）が開き、道に how=ai が付く。会話の口はまだ呼ばない", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  await openCreate(page);
  await expect(howAi(page)).not.toHaveAttribute("aria-disabled", "true");
  await howAi(page).click();
  await expect(howAi(page)).toHaveAttribute("aria-current", "true");
  await expect(chatSide(page).locator(".k-room-chat-title b")).toHaveText("高本のAIと話して作る");
  await expect
    .poll(async () => (await chatSide(page).locator(".k-room-empty h2").textContent())?.replace(/⁠/g, ""))
    .toBe("何を作りたいか、話しかけてください");
  await expect(chatSide(page).getByRole("list", { name: "話しかける例", exact: true }).getByRole("button")).toHaveCount(
    3,
  );
  await expect(page).toHaveURL(/[?&]how=ai/);
  expect(t.starts).toBe(0);
});

test("K767-UI-002 はじめの一言：書いて［送る］で、会話を始める口 1 回 → 言う口 1 回（体は text・その時の欄の中身 draft { title, body, checks }・edited は空）", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  await openTalk(page);
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect.poll(() => t.says.length).toBe(1);
  expect(t.starts).toBe(1);
  expect(t.says[0]!.id).toBe(DCONV);
  expect(t.says[0]!.body).toEqual({ text: CT_SAY, draft: { title: "", body: "", checks: [] }, edited: [] });
  await expect(chatBox(page)).toHaveValue("");
});

test("K767-UI-003 例を押す：話しかける例のボタンを押すと、その字で始めて言う（欄の中身も付ける）", async ({ page }) => {
  const t = await mockCreateTalk(page);
  await openTalk(page);
  await chatSide(page).getByRole("list", { name: "話しかける例", exact: true }).getByRole("button").first().click();
  await expect.poll(() => t.says.length).toBe(1);
  expect(String(t.says[0]!.body["text"])).toContain("チケットを作りたい");
});

test("K767-UI-004 欄の今の中身を渡す：人が題名を書いてから言うと draft.title にその字・前に AI に渡した後で直した欄は edited に入り、人の言葉の上に「題名（直した）を AI に渡しました」の印", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  // 1 回目の答えは AI が作業を終えた形で返す（作業中のままだと［送る］が［止める］に替わり 2 回目を言えない。2 回目を言う前の形をそろえる）
  t.on.view = () => ({
    status: 200,
    body: {
      data: draftView({
        messages:
          t.says.length >= 2
            ? [ME_LINE({ text: "これで足りる？" }), ME_LINE({ text: "期限も入れた", passed: ["title"] })]
            : t.says.length === 1
              ? [ME_LINE({ text: "これで足りる？" })]
              : [],
      }),
    },
  });
  await openTalk(page);
  await titleBox(page).fill("来週の定例の議事録をまとめる");
  await chatBox(page).fill("これで足りる？");
  await chatSend(page).click();
  await expect.poll(() => t.says.length).toBe(1);
  expect((t.says[0]!.body["draft"] as Record<string, unknown>)["title"]).toBe("来週の定例の議事録をまとめる");
  await titleBox(page).fill("来週の定例の議事録を 12/03 までにまとめる");
  await chatBox(page).fill("期限も入れた");
  await chatSend(page).click();
  await expect.poll(() => t.says.length).toBe(2);
  expect(t.says[1]!.body["edited"]).toEqual(["title"]);
  await expect(chatSide(page).locator(".k-room-passed").last()).toHaveText("題名（直した）を AI に渡しました");
});

test("K767-UI-005 作業中・書きながら・止める：work が在れば作業中の 1 行（考えています…）。［止める］で止める口に 1 回・読み直して partial が在れば書きながらの返事の印", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  t.on.view = () => ({
    status: 200,
    body: {
      data: draftView({
        messages: [ME_LINE()],
        running_job_id: JOB,
        work: working({ status: "考えています…（EG-098 11 月分を見ています）" }),
      }),
    },
  });
  await openTalk(page);
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect(chatSide(page).locator(".k-room-work")).toHaveText("考えています…（EG-098 11 月分を見ています）");
  t.on.view = () => ({
    status: 200,
    body: {
      data: draftView({
        messages: [ME_LINE()],
        running_job_id: JOB,
        work: working({ partial: "11 月分のチケットを見ました。", stopping: true }),
      }),
    },
  });
  await chatSide(page).locator(".k-room-composer").getByRole("button", { name: "止める", exact: true }).click();
  await expect.poll(() => t.stops).toBe(1);
  await expect(chatSide(page).locator(".k-room-caret")).toHaveCount(1);
});

test("K767-UI-006 AI の返事：吹き出しで出し、「見たもの」の 1 行は出さない（D-153.34）・字は HTML にしない", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  t.on.view = () => ({
    status: 200,
    body: { data: draftView({ messages: [ME_LINE(), AI_LINE("<b>案</b>を作りました")] }) },
  });
  await openTalk(page);
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect(bubbles(page)).toHaveCount(2);
  await expect(chatSide(page).locator(".k-room-took")).toHaveCount(0);
  await expect(bubbles(page).nth(1).locator("b")).toHaveCount(0);
});

test("K767-UI-007 言う口の断り：503 は「答えを返せませんでした」の帯（字は書く欄に残り吹き出しは出さない）・409 E-TALK-012 は書く欄の注（書けるまま）・409 E-TALK-060 は PC の案内で書く欄は書けない形。左の欄の中身は消えない", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  await openTalk(page);
  await titleBox(page).fill("来週の定例の議事録をまとめる");
  t.on.say = () => err(503, "E-PAGE-003");
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect(chatSide(page)).toContainText("答えを返せませんでした");
  await expect(chatSide(page)).toContainText("もう一度送れます。左の欄に書いた物は消えていません");
  await expect(chatBox(page)).toHaveValue(CT_SAY);
  await expect(bubbles(page)).toHaveCount(0);
  t.on.say = () => err(409, "E-TALK-012");
  await chatSend(page).click();
  await expect(chatSide(page)).toContainText(msg("E-TALK-012").split("。")[0]!);
  await expect(chatBox(page)).toBeEnabled();
  t.on.say = () => err(409, "E-TALK-060");
  await chatSend(page).click();
  await expect(chatSide(page).locator(".k-room-pc")).toContainText("PC がまだつながっていません");
  await expect(chatBox(page)).toBeDisabled();
  await expect(titleBox(page)).toHaveValue("来週の定例の議事録をまとめる");
});

test("K767-UI-008 始める口の断り：403 E-TALK-062 なら会話を作らず正本の文と書けない形・409 E-TALK-061（作る画面の会話でない）は正本の文と［新しく話す］で始め直せる", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  t.on.start = () => err(403, "E-TALK-062");
  await openTalk(page);
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect(chatSide(page)).toContainText(msg("E-TALK-062"));
  expect(t.says.length).toBe(0);
  t.on.start = () => ({ status: 201, body: { data: { id: DCONV } } });
  t.on.say = () => err(409, "E-TALK-061");
  await page.reload();
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect(chatSide(page)).toContainText(msg("E-TALK-061"));
  await chatSide(page).getByRole("button", { name: "新しく話す", exact: true }).click();
  t.on.say = () => ({ status: 201, body: { data: { id: "x", conversation_id: DCONV, job_id: JOB } } });
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect.poll(() => t.starts).toBe(3);
});

test("K767-UI-009 PC がまだ：pc が none なら「PC をつなぐと、AI と話して作れます」「それまでは、左の欄に自分で書いて作れます」・例は押せない・書く欄は書けない（左の欄はそのまま使える）", async ({
  page,
}) => {
  await mockCreateTalk(page, { pc: "none" });
  await openTalk(page);
  await expect
    .poll(async () => (await chatSide(page).locator(".k-room-empty h2").textContent())?.replace(/⁠/g, ""))
    .toBe("PC をつなぐと、AI と話して作れます");
  await expect(chatSide(page)).toContainText("それまでは、左の欄に自分で書いて作れます");
  await expect(
    chatSide(page).getByRole("list", { name: "話しかける例", exact: true }).getByRole("button").first(),
  ).toBeDisabled();
  await expect(chatBox(page)).toBeDisabled();
  await titleBox(page).fill("自分で書く");
  await expect(titleBox(page)).toHaveValue("自分で書く");
});

test("K767-UI-010 作った後：会話があれば、作る口の 201 の直後に会話を移す口（{ ticket_id }）に 1 回。答えの conversation_id の会話を右のパネルで開く形（/tickets/<id>?ai=1）へ移る", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  await openTalk(page);
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect.poll(() => t.says.length).toBe(1);
  await fillRequired(page, "セイコー様へ 12 月分の作業報告書を送る");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect.poll(() => t.adopts).toEqual([{ id: DCONV, body: { ticket_id: NEW_ID } }]);
  await expect(page).toHaveURL(new RegExp(`/tickets/${NEW_ID}\\?ai=1`));
});

test("K767-UI-011 会話が無いまま作った：会話を移す口は呼ばず、今までどおり詳細へ（?ai は付けない）", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  await openTalk(page);
  await fillRequired(page, "自分で書いた");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${NEW_ID}$`));
  expect(t.adopts.length).toBe(0);
});

test("K767-UI-012 移す口の失敗：403・404・409（081・082）・503 なら、チケットの詳細を ?ai=1&adopt=failed で開き、右のパネルの AI のタブの上に「作る時の会話をこのチケットに移せませんでした。作る画面の会話は残っています」（作ったチケットは在る）", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  t.on.adopt = () => err(503, "E-PAGE-003");
  await openTalk(page);
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect.poll(() => t.says.length).toBe(1);
  await fillRequired(page, "セイコー様へ 12 月分の作業報告書を送る");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${NEW_ID}\\?ai=1&adopt=failed`));
  await expect(page.getByRole("region", { name: "AI と話す", exact: true })).toContainText(
    "作る時の会話をこのチケットに移せませんでした。作る画面の会話は残っています",
  );
});

test("K767-UI-013 二度押し：［送る］の答えを待つ間は処理中で、二度押しでも始める口・言う口は 1 回ずつ", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  await openTalk(page);
  await chatBox(page).fill(CT_SAY);
  const open = t.hold();
  await chatSend(page).click();
  await chatSend(page).click({ force: true });
  open();
  await expect.poll(() => t.says.length).toBe(1);
  expect(t.starts).toBe(1);
});

test("K767-UI-014 スマホ（375）：欄の画面の頭に［AI と話して作る］がいつも出て、押すと道に how=ai が付き会話が全画面・「‹」（欄へ戻る）で欄の画面に戻り how=ai が外れる", async ({
  page,
}) => {
  await mockCreateTalk(page);
  await openCreate(page, 375);
  await expect(page.locator(".k-room-ct")).toHaveAttribute("data-mview", "form");
  await page.locator(".k-room-cf-ask").click();
  await expect(page.locator(".k-room-ct")).toHaveAttribute("data-mview", "chat");
  await expect(page).toHaveURL(/[?&]how=ai/);
  await page.getByRole("button", { name: "欄へ戻る", exact: true }).click();
  await expect(page.locator(".k-room-ct")).toHaveAttribute("data-mview", "form");
  await expect(page).not.toHaveURL(/how=ai/);
});

test("K767-UI-015 幅 320・375・768・1024・1440 で会話を開いても横溢れ 0（767 以下は頭の入口から全画面で開く）・1440 では欄と会話が横に並ぶ", async ({
  page,
}) => {
  await mockCreateTalk(page);
  for (const w of WIDTHS_ALL) {
    await openCreate(page, w);
    if (w >= 768) await howAi(page).click();
    else await page.locator(".k-room-cf-ask").click();
    await expect(chatSide(page)).toBeVisible();
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
  await openTalk(page, 1440);
  const f = (await titleBox(page).boundingBox())!;
  const c = (await chatSide(page).boundingBox())!;
  expect(c.x).toBeGreaterThan(f.x + f.width - 1);
});

test("K767-UI-016 守り：会話を開くだけでは始める口・言う口 0・作る口は今の 1 本のまま・本人の Bridge に飛ばない", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  let bridge = 0;
  await page.route(/127\.0\.0\.1:38617/, (r) => {
    bridge++;
    return r.fulfill({ status: 404, body: "" });
  });
  await openTalk(page);
  expect(t.starts + t.says.length + t.adopts.length).toBe(0);
  expect(t.create.creates.length).toBe(0);
  expect(bridge).toBe(0);
});

test("K767-UI-022 言う口の 403（作る権限を外された直後・D-153.35）：会話の欄の上に正本 E-TALK-062 の文・書く欄と例は押せない形・左の欄は書ける", async ({
  page,
}) => {
  const t = await mockCreateTalk(page);
  await openTalk(page);
  t.on.say = () => err(403, "E-TALK-062");
  await chatBox(page).fill(CT_SAY);
  await chatSend(page).click();
  await expect(chatSide(page)).toContainText(msg("E-TALK-062"));
  await expect(chatBox(page)).toBeDisabled();
  await titleBox(page).fill("自分で書く");
  await expect(titleBox(page)).toHaveValue("自分で書く");
});

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
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
const CC_PAIRS: FidelityPair[] = [
  p("cc", ".k-room-cc", ["x", "y", "width", "background-color"]),
  p("cc-bar", ".k-room-cc-bar", ["x", "y", "width", "height", "texts"]),
  p("cc-aside", ".k-room-cc-aside", ["x", "y", ...TEXT]),
  p("empty", ".k-room-cc .k-room-empty", [...BOX, "texts"]),
  p("starters", ".k-room-starters", ["x", "y", "width", "texts"]),
  p("bubble-me", '.k-room-cc .k-room-msg[data-who="me"] .k-room-bubble', BOX),
  p("bubble-ai", '.k-room-cc .k-room-msg[data-who="ai"] .k-room-bubble', ["x", "width", "background-color"]),
  p("passed", ".k-room-passed", ["font-size", "color", "texts"]),
  p("took", ".k-room-cc .k-room-took", ["texts"]),
  p("work", ".k-room-cc .k-room-work", ["x", ...TEXT]),
  p("callout", ".k-room-cc .k-callout", [...BOX, "texts"]),
  p("pc", ".k-room-cc .k-room-pc", [...BOX]),
  p("composer", ".k-room-cc .k-room-composer", BOX),
  p("send", ".k-room-cc .k-room-send", CTRL),
  p("ask", ".k-room-cf-ask", CTRL),
];
// 注：左の欄は段 5 の K-442 の作る面の物で、下絵の CreateFormView（見本の値）と中身の字が違うので比べない（会話の側の役だけを比べる）。
//   下絵の「見たもの」（D-153.34）・AI の返事の中の箇条は K-755 が下絵の側を直す。比べない役は無い
const SKIP: string[] = [];
async function match(
  browser: Browser,
  id: string,
  drive: (pg: Page, w: number) => Promise<void>,
  widths: readonly number[] = MATCH_WIDTHS,
) {
  const bad: string[] = [];
  for (const w of widths) {
    const r = await matchMock(browser, id, w, (pg) => drive(pg, w), {
      pairs: CC_PAIRS,
      base: "/dev/mock/f5",
      skip: SKIP,
    });
    bad.push(...r.bad);
  }
  expect(bad, bad.join("\n")).toEqual([]);
}
const sayOnce = async (pg: Page, w: number, view: Record<string, unknown>, o: { pc?: "none" } = {}) => {
  const t = await mockCreateTalk(pg, o);
  t.on.view = () => ({ status: 200, body: { data: draftView(view) } });
  await openTalk(pg, w);
  await chatBox(pg).fill(CT_SAY);
  await chatSend(pg).click();
};

test("K767-UI-017 下絵との突き合わせ：create-talk-empty・create-talk-nopc（PC がまだ）", async ({ browser }) => {
  await match(
    browser,
    "create-talk-empty",
    async (pg, w) => {
      await mockCreateTalk(pg);
      await openTalk(pg, w);
    },
    [768, 1440],
  );
  await match(
    browser,
    "create-talk-nopc",
    async (pg, w) => {
      await mockCreateTalk(pg, { pc: "none" });
      await openTalk(pg, w);
    },
    [768, 1440],
  );
});
test("K767-UI-018 下絵との突き合わせ：create-talk-thinking・create-talk-writing・create-talk-error", async ({
  browser,
}) => {
  await match(
    browser,
    "create-talk-thinking",
    (pg, w) =>
      sayOnce(pg, w, {
        messages: [ME_LINE()],
        running_job_id: JOB,
        work: working({ status: "考えています…（EG-098 11 月分を見ています）" }),
      }),
    [768, 1440],
  );
  await match(
    browser,
    "create-talk-writing",
    (pg, w) =>
      sayOnce(pg, w, {
        messages: [ME_LINE()],
        running_job_id: JOB,
        work: working({
          partial:
            "11 月分のチケットを見ました。同じ形なら、題名は「セイコー様へ 12 月分の作業報告書を送る」、本文には",
        }),
      }),
    [768, 1440],
  );
  await match(
    browser,
    "create-talk-error",
    async (pg, w) => {
      const t = await mockCreateTalk(pg);
      t.on.say = () => err(503, "E-PAGE-003");
      await openTalk(pg, w);
      await chatBox(pg).fill(CT_SAY);
      await chatSend(pg).click();
    },
    [768, 1440],
  );
});
test("K767-UI-019 下絵との突き合わせ：create-talk-edited（直した欄を渡した印・会話の並びを下絵と同じにする）", async ({
  browser,
}) => {
  const prop = msgOf({
    who: "ai",
    at: at(0, "10:40"),
    text: "",
    proposal: {
      title: "セイコー様へ 12 月分の作業報告書を送る",
      body: "11 月分と同じ形で…",
      checks: ["作業時間の合計が稼働記録と同じ", "宛名が山田様になっている", "12/26 までに送っている"],
    },
  });
  await match(
    browser,
    "create-talk-edited",
    (pg, w) =>
      sayOnce(pg, w, {
        messages: [
          ME_LINE(),
          AI_LINE(
            "11 月分のチケットを見て案を作りました。欄に入れる物を選んでください。期限は 12/26（金）にしています。",
          ),
          prop,
          AI_LINE("左の欄に入れました。足りない物はありますか？ 例えば、山田様のほかに送る人がいれば足します。"),
          ME_LINE({ text: "鈴木さんにも送るので、確認項目にも入れて", passed: ["title", "body"] }),
          AI_LINE(
            "直した題名の「12/26 までに」と、本文の「鈴木さん」を踏まえました。確認項目に「鈴木さんにも送っている」を足す案です。",
          ),
        ],
      }),
    [768, 1440],
  );
});
test("K767-UI-020 下絵との突き合わせ：create-talk-mobile（375 の会話の全画面・人・AI・案の行）・create-talk-mobile-form（375 の欄の画面の頭の入口）", async ({
  browser,
}) => {
  const prop = msgOf({
    who: "ai",
    at: at(0, "10:40"),
    text: "",
    proposal: {
      title: "セイコー様へ 12 月分の作業報告書を送る",
      body: "11 月分と同じ形で…",
      checks: ["作業時間の合計が稼働記録と同じ"],
    },
  });
  await match(
    browser,
    "create-talk-mobile",
    async (pg, w) => {
      const t = await mockCreateTalk(pg);
      t.on.view = () => ({
        status: 200,
        body: {
          data: draftView({
            messages: [
              ME_LINE(),
              AI_LINE(
                "11 月分のチケットを見て案を作りました。欄に入れる物を選んでください。期限は 12/26（金）にしています。",
              ),
              prop,
            ],
          }),
        },
      });
      await openCreate(pg, w);
      await pg.locator(".k-room-cf-ask").click();
      await chatBox(pg).fill(CT_SAY);
      await chatSend(pg).click();
      await expect(chatSide(pg).locator(".k-room-msg")).toHaveCount(3);
    },
    [375],
  );
  await match(
    browser,
    "create-talk-mobile-form",
    async (pg, w) => {
      await mockCreateTalk(pg);
      await openCreate(pg, w);
    },
    [375],
  );
});
test("K767-UI-021 下絵との突き合わせ：tk-talk-from-create（作った後の右のパネルは K-764 の区画・この葉は ?ai=1 で開く形へ移るまで）", async ({
  browser,
}) => {
  const r = await matchMock(
    browser,
    "tk-talk-from-create",
    1440,
    async (pg) => {
      const t = await mockCreateTalk(pg);
      await openTalk(pg, 1440);
      await chatBox(pg).fill(CT_SAY);
      await chatSend(pg).click();
      await expect.poll(() => t.says.length).toBe(1);
      await fillRequired(pg, "セイコー様へ 12 月分の作業報告書を送る");
      await pg.getByRole("button", { name: "作る", exact: true }).click();
      await expect(pg).toHaveURL(/\?ai=1/);
    },
    {
      pairs: [
        p("panel", ".k-room-panel", ["x", "y", "width"]),
        p("ptab-on", '.k-room-ptabs [aria-current="page"]', CTRL),
      ],
      base: "/dev/mock/f5",
    },
  );
  expect(r.bad, r.bad.join("\n")).toEqual([]);
});
