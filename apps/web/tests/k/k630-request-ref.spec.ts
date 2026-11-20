// K-630「コードを渡す口 answerCredentialLoginCheck は request_ref が要る（K-355 の契約）：頼みの印が無い行では口を呼ばず、確かめの最初からやり直すよう促す」の画面の試験（実 Chrome・実装より先に積む）。
//   正は K-357 の画面（features/F3/credentials/check-credential.tsx・CheckCodeDialog）。ログイン・外枠・段の門・役は本物。
//   預けたログイン情報の口（listCredentials・answerCredentialLoginCheck）と getMySecurity だけを網の手前で差し替える。本人の Bridge（127.0.0.1:38617）にも届かせない。
//   読み直しは時計を進めて数える（固定の待ちは使わない）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { spawnSync } from "node:child_process";
import { expect, test, type Page, type Route } from "@playwright/test";
import { admin, loginAs, setupStep, signupViaApi } from "../_lib/api";

const PATH = "/settings/credentials";
const SEC = 'section[aria-labelledby="credentials-title"]';
const NOW = "2026-11-18T03:00:00Z";
const POLL_MS = 3_000;
const T0 = "2026-09-01T00:00:00Z";
/** 頼みの印が無いときに小窓の中へ出す文（check-credential.tsx の定数・口は呼ばない） */
const NO_REF_TEXT = "コードの頼みが見つかりません。もう一度確かめてください";

test.use({ timezoneId: "Asia/Tokyo" });

interface Item {
  id: string;
  name: string;
  description: string | null;
  layer: "workspace";
  kind: "login";
  two_factor: "sms" | "push";
  destinations: string[];
  expires_on: string | null;
  use_count: number;
  last_used_at: string | null;
  login_check: { state: string; detail: string | null; at: string | null; request_id?: string | null };
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}
const item = (two: Item["two_factor"], requestId: string | null | undefined): Item => ({
  id: "c2",
  name: "HACCHU_NAVI_LOGIN",
  description: "発注ナビのログイン",
  layer: "workspace",
  kind: "login",
  two_factor: two,
  destinations: ["hacchu-navi.example"],
  expires_on: null,
  use_count: 22,
  last_used_at: "2026-11-18T01:00:00Z",
  login_check: {
    state: "asking",
    detail: null,
    at: "2026-11-18T02:58:00Z",
    ...(requestId === undefined ? {} : { request_id: requestId }),
  },
  can_edit: true,
  created_at: T0,
  updated_at: T0,
});

interface Mock {
  items: Item[];
  reads: number;
  answers: Record<string, unknown>[];
  after: { at: number; items: Item[] } | null;
}
async function mockApi(page: Page, items: Item[], after: Mock["after"] = null): Promise<Mock> {
  const m: Mock = { items, reads: 0, answers: [], after };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/v1\/(credentials|me\/security)(\/|\?|$)/, async (route: Route, req) => {
    const p = new URL(req.url()).pathname;
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "GET" && p === "/api/v1/credentials") {
      m.reads += 1;
      if (m.after && m.reads >= m.after.at) m.items = m.after.items;
      return json(200, { data: m.items, meta: {} });
    }
    if (req.method() === "POST" && /\/login-check\/answer$/.test(p)) {
      m.answers.push((req.postDataJSON() as Record<string, unknown> | null) ?? {});
      return json(201, { data: { accepted: true }, meta: {} });
    }
    if (req.method() === "GET" && p === "/api/v1/me/security") {
      return json(200, {
        data: { passkeys: [], has_password: true, two_factor: false, backup_codes_left: null, mfa_pending: false },
        meta: {},
      });
    }
    return json(404, { error: "not_found", code: "NOT_FOUND" });
  });
  return m;
}
async function ready(page: Page, items: Item[], after: Mock["after"] = null): Promise<Mock> {
  const u = await signupViaApi("株式会社ENGINE BASE");
  await admin("update members set display_name = $2 where id = $1", [u.memberId, "高本 聖斗"]);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  const m = await mockApi(page, items, after);
  await page.clock.install({ time: new Date(NOW) });
  await page.setViewportSize({ width: 1440, height: 900 });
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/credentials");
  const res = await page.goto(PATH);
  expect(res?.status()).toBe(200);
  await answered;
  await expect(page.locator(`${SEC} h1`)).toHaveText("預けたログイン情報");
  return m;
}
const codeBtn = (page: Page) =>
  page.locator(`${SEC} .k-set-row`, { hasText: "HACCHU_NAVI_LOGIN" }).getByRole("button", { name: "コードを入れる", exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: "HACCHU_NAVI_LOGIN のコードを入れる" });

test("K630-UI-001 頼みの印あり（request_id=rq-c2）・SMS：コードを入れて「PC に渡す」→ 口に { request_ref, code } が 1 回・小窓が閉じる（前からの動きのまま）", async ({
  page,
}) => {
  const m = await ready(page, [item("sms", "rq-c2")]);
  await codeBtn(page).click();
  const d = dialog(page);
  await d.getByLabel("コード", { exact: true }).fill("123456");
  await d.getByRole("button", { name: "PC に渡す", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(m.answers).toEqual([{ request_ref: "rq-c2", code: "123456" }]);
});

test("K630-UI-002 頼みの印なし（request_id が一覧に無い）・SMS：「PC に渡す」で口は 0 回・小窓の中に「もう一度確かめてください」の文・小窓は閉じず入れた字は残る", async ({
  page,
}) => {
  const m = await ready(page, [item("sms", undefined)]);
  await codeBtn(page).click();
  const d = dialog(page);
  await d.getByLabel("コード", { exact: true }).fill("123456");
  await d.getByRole("button", { name: "PC に渡す", exact: true }).click();
  await expect(d.getByText(NO_REF_TEXT, { exact: true })).toBeVisible();
  await expect(d.getByLabel("コード", { exact: true })).toHaveValue("123456");
  expect(m.answers).toEqual([]);
});

test("K630-UI-003 頼みの印が null・スマホのアプリで承認（push）：「PC に渡す」で口は 0 回・同じ文が小窓の中に出る（コードの欄は出ない）", async ({
  page,
}) => {
  const m = await ready(page, [item("push", null)]);
  await codeBtn(page).click();
  const d = dialog(page);
  await expect(d.getByLabel("コード", { exact: true })).toHaveCount(0);
  await d.getByRole("button", { name: "PC に渡す", exact: true }).click();
  await expect(d.getByText(NO_REF_TEXT, { exact: true })).toBeVisible();
  expect(m.answers).toEqual([]);
});

test("K630-UI-004 頼みの印が空の字（request_id=\"\"）：空は無いのと同じ。口は 0 回・文が出る", async ({ page }) => {
  const m = await ready(page, [item("sms", "")]);
  await codeBtn(page).click();
  const d = dialog(page);
  await d.getByLabel("コード", { exact: true }).fill("123456");
  await d.getByRole("button", { name: "PC に渡す", exact: true }).click();
  await expect(d.getByText(NO_REF_TEXT, { exact: true })).toBeVisible();
  expect(m.answers).toEqual([]);
});

test("K630-UI-005 時間の流れ：印なしで断られ「あとで」で閉じた後、読み直しで印が付いた一覧が来たら、開き直して渡すと口に { request_ref, code } が 1 回届く（前の断りは持ち越さない）", async ({
  page,
}) => {
  const m = await ready(page, [item("sms", undefined)], { at: 2, items: [item("sms", "rq-new")] });
  await codeBtn(page).click();
  let d = dialog(page);
  await d.getByLabel("コード", { exact: true }).fill("123456");
  await d.getByRole("button", { name: "PC に渡す", exact: true }).click();
  await expect(d.getByText(NO_REF_TEXT, { exact: true })).toBeVisible();
  await d.getByRole("button", { name: "あとで", exact: true }).click();
  await expect(d).toHaveCount(0);
  const before = m.reads;
  await page.clock.runFor(POLL_MS);
  await expect.poll(() => m.reads).toBeGreaterThan(before);
  await codeBtn(page).click();
  d = dialog(page);
  await expect(d.getByText(NO_REF_TEXT, { exact: true })).toHaveCount(0);
  await d.getByLabel("コード", { exact: true }).fill("654321");
  await d.getByRole("button", { name: "PC に渡す", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(m.answers).toEqual([{ request_ref: "rq-new", code: "654321" }]);
});

test("K630-UI-006 型が契約に合う：画面（apps/web）の tsc に、預けたログイン情報の画面（features/F3/credentials）の型の誤りが 0 件", async () => {
  test.setTimeout(420_000);
  const r = spawnSync("pnpm", ["--filter", "@kaname/web", "exec", "tsc", "--noEmit", "--pretty", "false"], {
    encoding: "utf8",
    timeout: 400_000,
  });
  expect(r.error).toBeUndefined();
  const mine = `${r.stdout}${r.stderr}`.split("\n").filter((l) => l.includes("features/F3/credentials"));
  expect(mine).toEqual([]);
});
