// K-873「段 12 のゲストの場所（ゲストの場所）の部品（外枠・ホーム・依頼を出す・依頼のやり取り・見せてもらったチケット・招待直後・ログイン切れ）と、下絵 21 状態の描き手を本線に入れる」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。
//   的：/dev/mock/f11/<pt-の状態>。部品は features/F11/portal/{frame,home,request,work}.tsx（見た目だけ・値は props）。描き手 render-cp.tsx は K-871 の空の形を本物に替える。
//   ゲストの場所は社内の外枠（Shell）を使わない。口は呼ばない（網の手前で 599）。本人の Bridge（127.0.0.1:38617）は 404。固定の待ちは使わない。検収の画面は作らない（D-155.44）
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const PLACE = join(WEB, "app/(dev)/dev/mock/f11");
const PORTAL = join(WEB, "features/F11/portal");
const MOCKS_SRC = join(PLACE, "mocks.tsx");
const RENDER_SRC = join(PLACE, "render-cp.tsx");

/** ゲストの場所の下絵の状態（pt-・21）と、持ち主の画面の葉（mocks.tsx の ticket と同じ） */
const PT_OWNER: Record<string, string> = {
  "pt-home": "K-911",
  "pt-home-empty": "K-911",
  "pt-home-loading": "K-911",
  "pt-home-failed": "K-911",
  "pt-home-notice": "K-911",
  "pt-welcome": "K-911",
  "pt-session-expired": "K-911",
  "pt-new": "K-912",
  "pt-new-ps0": "K-912",
  "pt-new-empty": "K-912",
  "pt-new-attach-bad": "K-912",
  "pt-new-saving": "K-912",
  "pt-new-failed": "K-912",
  "pt-new-sent": "K-912",
  "pt-req": "K-912",
  "pt-req-accepted": "K-912",
  "pt-req-declined": "K-912",
  "pt-req-other": "K-912",
  "pt-work": "K-913",
  "pt-work-hidden": "K-913",
  "pt-work-request": "K-913",
};
const PT = Object.keys(PT_OWNER);
const PARTS = ["frame.tsx", "home.tsx", "request.tsx", "work.tsx"].map((f) => join(PORTAL, f));

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

test("K873-MK-001 mocks.tsx の pt- の状態はちょうど 21 個（K-911=7・K-912=11・K-913=3）で、持ち主がこの表のとおり・render-cp.tsx が全部を描く（case の字が 21 個）", () => {
  const pt = mockEntries().filter((e) => e.id.startsWith("pt-"));
  expect(pt.length).toBe(21);
  expect(Object.fromEntries(pt.map((e) => [e.id, e.ticket]))).toEqual(PT_OWNER);
  const cases = [...noComments(readFileSync(RENDER_SRC, "utf8")).matchAll(/case "(pt-[a-z0-9-]+)"/g)].map((m) => m[1]);
  expect([...new Set(cases)].sort()).toEqual([...PT].sort());
});

test("K873-MK-002 部品は見た目だけ：portal の 4 つの部品は口を呼ばない（fetch・lib/api・useEffect・useRouter・lib/auth が無い）・社内の外枠（Shell）を使わない・生の色が無い。portal.css は生の色（# と rgb・hsl）を書かず、px は @media の行にしか無い", () => {
  for (const f of PARTS) {
    expect(existsSync(f), `${f} が無い`).toBe(true);
    const s = noComments(readFileSync(f, "utf8"));
    expect(s, `${f} が口を呼んでいる`).not.toMatch(/fetch\(|lib\/api|useEffect|useRouter|lib\/auth/);
    expect(s, `${f} が社内の外枠を使う`).not.toMatch(/\bShell\b.*from "@\/components\/k"|<Shell\b/);
    expect(s, `${f} に生の色`).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  }
  const css = noComments(readFileSync(join(PORTAL, "portal.css"), "utf8"));
  expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  const px = css.split("\n").filter((l) => /\d\s*px/.test(l) && !/@media/.test(l));
  expect(px, px.join(" / ")).toEqual([]);
});

test("K873-MK-003 検収・取引先・呼び名の字が 0：portal の部品と render-cp.tsx（注を除く）に「検収」「取引先」「確認してほしい」「クライアント」「先方の人」が無い", () => {
  expect(
    readdirSync(PORTAL)
      .filter((f) => /\.tsx$/.test(f))
      .sort(),
  ).toEqual(["frame.tsx", "home.tsx", "request.tsx", "work.tsx"]);
  for (const f of [...PARTS, RENDER_SRC]) {
    const s = noComments(readFileSync(f, "utf8"));
    for (const w of ["検収", "取引先", "確認してほしい", "クライアント", "先方の人"])
      expect(s.includes(w), `${f} に ${w}`).toBe(false);
  }
});

// ---- 実ブラウザ ----

// 行 ID は字で書く（チケットの形の検査が試験の名前の中の行 ID を字で探す）
const WIDTH_ROWS = [
  { w: 375, row: "K873-UI-001" },
  { w: 768, row: "K873-UI-002" },
  { w: 1440, row: "K873-UI-003" },
] as const;

for (const { w, row } of WIDTH_ROWS) {
  test(`${row} 幅 ${w}：pt- の 21 状態がどれも 200 で開き、「この状態はまだありません」が無く、横のはみ出し 0・社内の外枠（.k-shell）が出ない`, async ({
    page,
  }) => {
    await guard(page);
    for (const id of PT) {
      await openState(page, id, w);
      expect(await overflowX(page), `${id} が幅 ${w} で横にはみ出す`).toBe(0);
      await expect(page.locator(".k-shell"), `${id} に社内の外枠`).toHaveCount(0);
    }
  });
}

test("K873-UI-004 失敗：21 状態を描いて pageerror と hydration の知らせが 0", async ({ page }) => {
  await guard(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text());
  });
  for (const id of PT) await openState(page, id, 1440);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K873-UI-005 外枠とホーム（pt-home）：外枠に「セイコー株式会社（ゲスト）」、h1「ENGINE BASE とのやり取り」。依頼とチケットの 2 つの箱が並び、検収の箱が無い", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "pt-home", 1440);
  await expect(page.getByText("セイコー株式会社（ゲスト）", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "ENGINE BASE とのやり取り", exact: true })).toBeVisible();
  await expect(page.getByText("11月分の請求書を送る", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("確認してほしい");
});

test("K873-UI-006 ホームの形（pt-home-empty・pt-home-loading・pt-home-failed・pt-home-notice）：空・読み込み中・読めなかった・お知らせ「メンテナンスのお知らせ」がそれぞれ出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "pt-home-notice", 1440);
  await expect(page.getByText("メンテナンスのお知らせ", { exact: true })).toBeVisible();
  await openState(page, "pt-home-empty", 1440);
  await expect(page.getByText("11月分の請求書を送る", { exact: true })).toHaveCount(0);
  await openState(page, "pt-home-loading", 1440);
  await expect(page.getByText("11月分の請求書を送る", { exact: true })).toHaveCount(0);
  await openState(page, "pt-home-failed", 1440);
  await expect(page.getByText("11月分の請求書を送る", { exact: true })).toHaveCount(0);
});

test("K873-UI-007 招待直後・ログイン切れ（pt-welcome・pt-session-expired）：「ようこそ、山田さん」が出る。ログイン切れは外枠に名前が出ない形（ログインしていない）", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "pt-welcome", 1440);
  await expect(page.getByText("ようこそ、山田さん", { exact: true })).toBeVisible();
  await openState(page, "pt-session-expired", 1440);
  await expect(page.locator("body")).not.toContainText("山田 花子");
});

test("K873-UI-008 依頼を出す（pt-new・pt-new-ps0）：h1「依頼を出す」と「ENGINE BASE の営業グループに届きます。セイコー株式会社（ゲスト）の皆さんにも見えます」。PC がつながっているときは「ENGINE BASE の担当の AI が聞いています」、閉じているときは「いまは担当の席が閉じているので、ここでは聞き返しません。」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "pt-new", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "依頼を出す", exact: true })).toBeVisible();
  await expect(
    page.getByText("ENGINE BASE の営業グループに届きます。セイコー株式会社（ゲスト）の皆さんにも見えます", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "ENGINE BASE の AI が聞いています。答えなくても出せます（担当が席にいないときは、あとで依頼のやり取りで聞きます）",
      { exact: true },
    ),
  ).toBeVisible();
  await openState(page, "pt-new-ps0", 1440);
  await expect(
    page.getByText("いまは担当の席が閉じているので、ここでは聞き返しません。", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("が聞いています");
});

test("K873-UI-009 依頼を出す・誤りと途中（pt-new-attach-bad・pt-new-failed・pt-new-sent）：「このファイルは足せませんでした」・「依頼を出せませんでした」・出した後は「依頼を出しました」と「やり取りに戻る」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "pt-new-attach-bad", 1440);
  await expect(page.getByText("このファイルは足せませんでした", { exact: true })).toBeVisible();
  await openState(page, "pt-new-failed", 1440);
  await expect(page.getByText("依頼を出せませんでした", { exact: true })).toBeVisible();
  await openState(page, "pt-new-sent", 1440);
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
  await expect(
    page.getByText("ENGINE BASE に届きました。返事が来たら、この場所とメールでお知らせします。", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("担当");
  await expect(page.getByRole("button", { name: "やり取りに戻る", exact: true })).toBeVisible();
});

test("K873-UI-010 依頼のやり取り（pt-req・pt-req-accepted・pt-req-declined・pt-req-other）：h1「12 月分の作業報告書もほしい」・受けた帯「ENGINE BASE が依頼を受けました」・断られた帯「この依頼は受けられませんでした」と理由・見せられていない依頼は「この依頼は見られません」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "pt-req", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "12 月分の作業報告書もほしい", exact: true })).toBeVisible();
  await openState(page, "pt-req-accepted", 1440);
  await expect(page.getByText("ENGINE BASE が依頼を受けました", { exact: true })).toBeVisible();
  // ゲストに期限・担当は見せない（D-155.41）：受けた帯に「期限」「担当」の字が無い
  await expect(page.locator("body")).not.toContainText("期限");
  await expect(page.locator("body")).not.toContainText("担当");
  await openState(page, "pt-req-declined", 1440);
  await expect(page.getByText("この依頼は受けられませんでした", { exact: true })).toBeVisible();
  await openState(page, "pt-req-other", 1440);
  await expect(page.getByText("この依頼は見られません", { exact: true })).toBeVisible();
});

test("K873-UI-011 見せてもらったチケット（pt-work）：h1「11月分の請求書を送る」・段の札はちょうど 3 つ（作っている・確認中・完了）・字「ここに出るのは、このチケットの題・本文・詳細・やり取りと、段の札だけです」。担当・期限の欄が無い", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "pt-work", 1440);
  await expect(page.getByRole("heading", { level: 1, name: "11月分の請求書を送る", exact: true })).toBeVisible();
  const stages = page.getByRole("group", { name: "いまの段", exact: true });
  await expect(stages.getByText("作っている", { exact: true })).toBeVisible();
  await expect(stages.getByText("確認中", { exact: true })).toBeVisible();
  await expect(stages.getByText("完了", { exact: true })).toBeVisible();
  await expect(
    page.getByText("ここに出るのは、このチケットの題・本文・詳細・やり取りと、段の札だけです", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("担当");
  await expect(page.locator("body")).not.toContainText("期限");
});

test("K873-UI-012 依頼から作ったチケット・見られない（pt-work-request・pt-work-hidden）：題「12 月分の作業報告書を作って送る」・見せていないチケットは「この仕事は見られません」", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "pt-work-request", 1440);
  await expect(
    page.getByRole("heading", { level: 1, name: "12 月分の作業報告書を作って送る", exact: true }),
  ).toBeVisible();
  await openState(page, "pt-work-hidden", 1440);
  await expect(page.getByText("この仕事は見られません", { exact: true })).toBeVisible();
});

test("K873-UI-013 押せる物の大きさ（幅 375・pt-home・pt-new・pt-work）：ボタンは幅も高さも 24px 以上", async ({
  page,
}) => {
  await guard(page);
  for (const id of ["pt-home", "pt-new", "pt-work"]) {
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
