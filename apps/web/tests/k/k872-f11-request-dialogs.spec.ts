// K-872「段 12 の依頼の小窓（返事を送って詳しく聞く・この依頼を断る・チケットを作る）の部品と、届いた依頼の下絵 22 状態の描き手を本線に入れる」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。
//   的：/dev/mock/f11/<rq-の状態>。小窓の部品は features/F11/requests/dialogs.tsx（見た目だけ・値は props）。描き手 render-cu-rq.tsx は K-871 の空の形を本物に替える。
//   口は呼ばない（網の手前で 599）。本人の Bridge（127.0.0.1:38617）は 404。固定の待ちは使わない。検収の小窓・帯は作らない（D-155.44）
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const PLACE = join(WEB, "app/(dev)/dev/mock/f11");
const F11 = join(WEB, "features/F11");
const MOCKS_SRC = join(PLACE, "mocks.tsx");
const DIALOGS_SRC = join(F11, "requests/dialogs.tsx");
const RENDER_SRC = join(PLACE, "render-cu-rq.tsx");

/** 届いた依頼の下絵の状態（rq-・22）と、持ち主の画面の葉（mocks.tsx の ticket と同じ） */
const RQ_OWNER: Record<string, string> = {
  "rq-new": "K-899",
  "rq-new-ps0": "K-899",
  "rq-asking": "K-898",
  "rq-done": "K-898",
  "rq-empty": "K-898",
  "rq-loading": "K-898",
  "rq-failed": "K-898",
  "rq-noaccess": "K-898",
  "rq-readonly": "K-898",
  "rq-edited": "K-898",
  "rq-route": "K-898",
  "rq-create": "K-930",
  "rq-create-bad": "K-930",
  "rq-saving": "K-930",
  "rq-accepted": "K-930",
  "rq-accept-failed": "K-930",
  "rq-ask": "K-898",
  "rq-ask-error": "K-898",
  "rq-decline": "K-898",
  "rq-decline-error": "K-898",
  "rq-declined": "K-898",
  "rq-list": "K-898",
};
const RQ = Object.keys(RQ_OWNER);

function mockEntries(): { id: string; ticket: string }[] {
  const src = readFileSync(MOCKS_SRC, "utf8");
  return [...src.matchAll(/\{\s*id:\s*"([^"]+)",[^{}]*?\bticket:\s*"([^"]*)"/g)].map((m) => ({
    id: m[1]!,
    ticket: m[2]!,
  }));
}

const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "モックは口を呼ばない" }));
}
async function openState(page: Page, id: string, width: number, height = width === 375 ? 812 : 900) {
  await page.setViewportSize({ width, height });
  const res = await page.goto(`/dev/mock/f11/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await expect(page.getByText("この状態はまだありません", { exact: true })).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K872-MK-001 mocks.tsx の rq- の状態はちょうど 22 個（K-898=15・K-899=2・K-930=5）で、持ち主がこの表のとおり・render-cu-rq.tsx が全部を描く（case の字が 22 個）", () => {
  const rq = mockEntries().filter((e) => e.id.startsWith("rq-"));
  expect(rq.length).toBe(22);
  expect(Object.fromEntries(rq.map((e) => [e.id, e.ticket]))).toEqual(RQ_OWNER);
  const cases = [...noComments(readFileSync(RENDER_SRC, "utf8")).matchAll(/case "(rq-[a-z0-9-]+)"/g)].map((m) => m[1]);
  expect([...new Set(cases)].sort()).toEqual([...RQ].sort());
});

test("K872-MK-002 小窓の部品は見た目だけ：dialogs.tsx は AskDialog・DeclineDialog・CreateTicketDialog を書き出し、口を呼ばない（fetch・lib/api・useEffect・useRouter・lib/auth が無い）。生の色と px が無い", () => {
  expect(existsSync(DIALOGS_SRC)).toBe(true);
  const s = noComments(readFileSync(DIALOGS_SRC, "utf8"));
  for (const n of ["AskDialog", "DeclineDialog", "CreateTicketDialog"])
    expect(s).toMatch(new RegExp(`export function ${n}\\b`));
  expect(s).not.toMatch(/fetch\(|lib\/api|useEffect|useRouter|lib\/auth/);
  expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|\d\s*px/);
});

test("K872-MK-003 検収・取引先・呼び名の字が 0：dialogs.tsx と render-cu-rq.tsx（注を除く）に「検収」「取引先」「催促」「クライアント」「先方の人」が無い", () => {
  for (const f of [DIALOGS_SRC, RENDER_SRC]) {
    const s = noComments(readFileSync(f, "utf8"));
    for (const w of ["検収", "取引先", "催促", "クライアント", "先方の人"])
      expect(s.includes(w), `${f} に ${w}`).toBe(false);
  }
});

// ---- 実ブラウザ ----

// 行 ID は字で書く（チケットの形の検査が試験の名前の中の行 ID を字で探す）
const WIDTH_ROWS = [
  { w: 375, row: "K872-UI-001" },
  { w: 768, row: "K872-UI-002" },
  { w: 1440, row: "K872-UI-003" },
] as const;

for (const { w, row } of WIDTH_ROWS) {
  test(`${row} 幅 ${w}：rq- の 22 状態がどれも 200 で開き、「この状態はまだありません」が無く、横のはみ出し 0`, async ({
    page,
  }) => {
    await guard(page);
    for (const id of RQ) {
      await openState(page, id, w);
      expect(await overflowX(page), `${id} が幅 ${w} で横にはみ出す`).toBe(0);
    }
  });
}

test("K872-UI-004 失敗：22 状態を描いて pageerror と hydration の知らせが 0", async ({ page }) => {
  await guard(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text());
  });
  for (const id of RQ) await openState(page, id, 1440);
  expect(errors, errors.join("\n")).toEqual([]);
});

// 下絵の頁の後ろ（届いた依頼の詳細・K-898）にも同じ字のボタンと札が在るので、小窓の中で探す
test("K872-UI-005 返事を送って詳しく聞く（rq-ask・rq-ask-error）：題と、必須の欄「先方に送る返事」・ボタン やめる・送る。空のときは「送る返事を書いてください」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "rq-ask", 1440);
  await expect(page.getByRole("dialog").getByText("返事を送って詳しく聞く", { exact: true })).toBeVisible();
  await expect(page.getByLabel("先方に送る返事*", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "送る", exact: true })).toBeEnabled();
  await openState(page, "rq-ask-error", 1440);
  await expect(page.getByText("送る返事を書いてください", { exact: true })).toBeVisible();
});

test("K872-UI-006 この依頼を断る（rq-decline・rq-decline-error）：題・「先方に返す理由」・字「この理由は先方に見えます。」・「先方に見える」の札。空のときは「理由を書いてください（先方に届きます）」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "rq-decline", 1440);
  await expect(page.getByRole("dialog").getByText("この依頼を断る", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("この理由は先方に見えます。", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("先方に見える", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "断る", exact: true })).toBeEnabled();
  await openState(page, "rq-decline-error", 1440);
  await expect(page.getByText("理由を書いてください（先方に届きます）", { exact: true })).toBeVisible();
});

test("K872-UI-007 チケットを作る（rq-create）：題・本文は依頼から入っていて、担当・期限が必須の欄で入っている（高本 聖斗・12/26）。見せる相手「セイコー株式会社（ゲスト）」は最初から選ばれている。字「題・本文・詳細・チャットと、段の札だけ」と「担当・期限などはゲストに見えません」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "rq-create", 1440);
  await expect(page.getByText("チケットを作る", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("題*", { exact: true })).toHaveValue("セイコー様 12 月分の作業報告書を作って送る");
  await expect(page.getByLabel("期限*", { exact: true })).toHaveValue("12/26");
  await expect(page.getByRole("checkbox", { name: /セイコー株式会社（ゲスト）/ })).toBeChecked();
  await expect(
    page.getByText(
      "ゲストに見える 題・本文・詳細・チャットと、段の札だけ。担当・期限などはゲストに見えません。 依頼のやり取りは、チケットのチャットの頭に残ります。",
      { exact: true },
    ),
  ).toBeVisible();
});

test("K872-UI-008 チケットを作る・誤りと途中（rq-create-bad・rq-saving・rq-accept-failed）：担当と期限が空の誤り「担当の人を選んでください」「期限を入れてください」・作っている間は やめる が押せない・断られたら「チケットを作れませんでした」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "rq-create-bad", 1440);
  await expect(page.getByText("担当の人を選んでください", { exact: true })).toBeVisible();
  await expect(page.getByText("期限を入れてください", { exact: true })).toBeVisible();
  await openState(page, "rq-saving", 1440);
  await expect(page.getByRole("button", { name: "やめる", exact: true })).toBeDisabled();
  await openState(page, "rq-accept-failed", 1440);
  await expect(page.getByText("チケットを作れませんでした", { exact: true })).toBeVisible();
});

test("K872-UI-009 開いた依頼の帯（rq-accepted・rq-declined）：作った後は「チケットを作りました（EG-131）」、断った後は「断りました」と「理由を先方に返しました。この依頼は「さばいたもの」に移ります。」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "rq-accepted", 1440);
  await expect(page.getByText("チケットを作りました（EG-131）", { exact: true })).toBeVisible();
  await openState(page, "rq-declined", 1440);
  await expect(page.getByText("断りました", { exact: true })).toBeVisible();
});

test("K872-UI-010 押せる物の大きさ（幅 375・rq-create・rq-decline・rq-ask）：ボタンは幅も高さも 24px 以上", async ({
  page,
}) => {
  await guard(page);
  for (const id of ["rq-create", "rq-decline", "rq-ask"]) {
    await openState(page, id, 375);
    const small = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>("button:not([disabled])")]
          .map((b) => b.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.width < 24 || r.height < 24)).length,
    );
    expect(small, `${id}：24px に足りないボタン`).toBe(0);
  }
});

test("K872-UI-011 小窓 × 高さ 812・560（幅 375・rq-create・rq-decline・rq-ask）：小窓の上端が 0 以上・下端が画面の高さ以下", async ({
  page,
}) => {
  await guard(page);
  for (const id of ["rq-create", "rq-decline", "rq-ask"]) {
    for (const h of [812, 560]) {
      await openState(page, id, 375, h);
      const box = await page.getByRole("dialog").first().boundingBox();
      expect(box, `${id} の小窓が無い`).not.toBeNull();
      expect(box!.y, `${id}@${h} の上端`).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, `${id}@${h} の下端`).toBeLessThanOrEqual(h);
    }
  }
});
