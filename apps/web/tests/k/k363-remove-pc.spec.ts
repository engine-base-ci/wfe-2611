// K-363「PC の行の「…」から PC を外す：確かめの小窓・本人確認の取り直しの小窓（StepUp・K-318 の部品）」の画面の試験（実 Chrome・実装より先に積む）。
//   画面：/setup/bridge（K-57 の features/F3/connect-pc）。正のモック（代表の OK（2026-11-19・会話で・PC の行の下絵と A の 1〜8 は勧めの形のまま・PM の決定の控え））：/dev/mock/f3-pc/pc-menu・pc-remove・pc-remove-stepup（K-369 が本線に入れる。pc-removed・pc-remove-error の字は K363-UI-002〜005 などの行が見る）。
//   口（listMyDevices・revokeMyDevice・getMySecurity・stepUp）は網の手前（page.route）で差し替える。口の振る舞いは
//   apps/api/test/features/F3/remove-pc.test.ts（K-362）が本物の DB で持つ。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   固定の待ち（waitForTimeout）は使わない。答えを待たせる行は、口の答えを約束で止めて、押した後に放す。
//   壁の時計で比べない。「定期の読みより先に読み直した」（K363-UI-004）は、画面の時計を止めて（page.clock）定期の読みが起きない間の読みを数える。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { MATCH_WIDTHS, matchMock, type MatchOptions } from "./stage2-match";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K363_STEP_PW, K363_WEB_TOKEN, K363_WRONG_STEP_PW } from "../../test/_fake/secrets";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const BODY = 'section[aria-labelledby="pc-list-title"]';
const NAME = "高本の MacBook";
const REASON = "PC を外す前に、本人か確かめます";
const DONE = "外しました。もう一度つなぐときは、この画面からつなぎ直してください";
const TITLE = `「${NAME}」を外しますか？`;
const DESC =
  "外すと、この PC の Bridge は Kaname に仕事を取りに来なくなり、預けたログイン情報もこの PC からは取り出せなくなります。この PC が動かしていた仕事は止まります。待っている仕事は消えません。もう一度使うときは、この画面からつなぎ直します";
const PW = K363_STEP_PW;
/** 文は正本（07_qa/test-specs/errors.json）から番号で引く */
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;

interface Dev {
  id: string;
  device_label: string;
  state: "live" | "asleep" | "waiting";
  last_seen_at: string | null;
  connected_at: string;
  version: string | null;
  health: unknown[];
  revoke_reason: null;
}
const pc = (id: string, label: string): Dev => ({
  id,
  device_label: label,
  state: "live",
  last_seen_at: new Date().toISOString(),
  connected_at: "2026-11-01T01:00:00Z",
  version: "1.4.0",
  health: [],
  revoke_reason: null,
});
const D1 = "11111111-0000-4000-8000-000000000363";
const D2 = "22222222-0000-4000-8000-000000000363";
interface Sec {
  passkeys: unknown[];
  has_password: boolean;
  two_factor: boolean;
  backup_codes_left: number | null;
}
const PASSWORD_ONLY: Sec = { passkeys: [], has_password: true, two_factor: false, backup_codes_left: null };
const PASSWORD_2FA: Sec = { passkeys: [], has_password: true, two_factor: true, backup_codes_left: 9 };
const PASSKEY_ONLY: Sec = {
  passkeys: [
    { id: "pk1", name: "Mac（Chrome）", created_at: "2026-11-01T00:00:00Z", last_used_at: null, synced: false },
  ],
  has_password: false,
  two_factor: false,
  backup_codes_left: null,
};

type Reply = { status: number; body: unknown };
interface Mock {
  devices: Dev[];
  sec: Sec;
  reads: number;
  /** 外す口が「外した」と答えた時点までに、一覧を読んだ回数（その後に増えた分が、外した後の読み。null はまだ外していない） */
  readsAtDelete: number | null;
  deletes: string[];
  stepUps: Record<string, unknown>[];
  /** 外すが取り直しを求める（stepUp が通るまで 403） */
  needStepUp: boolean;
  /** 次の答えを差し替える（1 回だけ） */
  once: Partial<Record<"delete" | "list" | "stepUp", Reply>>;
  /** 外すの答えを止めておく（放すまで答えない） */
  hold: { release: () => void } | null;
}
const ok = (data: unknown, status = 200): Reply => ({ status, body: { data, meta: {} } });
const err = (status: number, code: string, message?: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, ...(message ? { message } : {}) },
});

async function mockApi(page: Page, o: { devices?: Dev[]; sec?: Sec; needStepUp?: boolean } = {}): Promise<Mock> {
  const m: Mock = {
    devices: structuredClone(o.devices ?? [pc(D1, NAME)]),
    sec: o.sec ?? PASSWORD_ONLY,
    reads: 0,
    readsAtDelete: null,
    deletes: [],
    stepUps: [],
    needStepUp: o.needStepUp ?? false,
    once: {},
    hold: null,
  };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), K363_WEB_TOKEN);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const method = req.method();
    const take = (k: keyof Mock["once"]): Reply | undefined => {
      const v = m.once[k];
      delete m.once[k];
      return v;
    };
    let r: Reply = err(404, "NOT_FOUND");
    if (method === "GET" && p === "/api/v1/bridge/devices") {
      m.reads += 1;
      r = take("list") ?? ok(m.devices);
    } else if (method === "DELETE" && p.startsWith("/api/v1/bridge/devices/")) {
      const id = p.split("/").pop()!;
      m.deletes.push(id);
      if (m.hold) {
        const h = m.hold;
        await new Promise<void>((res) => {
          h.release = res;
        });
      }
      const once = take("delete");
      if (once) r = once;
      else if (m.needStepUp) r = err(403, "STEP_UP_REQUIRED", "本人確認を取り直してから");
      else if (!m.devices.some((d) => d.id === id)) r = err(404, "NOT_FOUND");
      else {
        const d = m.devices.find((x) => x.id === id)!;
        m.devices = m.devices.filter((x) => x.id !== id);
        r = ok({
          id,
          device_label: d.device_label,
          revoked_at: new Date().toISOString(),
          revoke_reason: "端末を外した",
        });
        m.readsAtDelete = m.reads;
      }
    } else if (method === "GET" && p === "/api/v1/me/security") {
      r = ok({ ...m.sec, two_factor_required: false, mfa_pending: false });
    } else if (method === "POST" && p === "/api/v1/auth/step-up") {
      m.stepUps.push((req.postDataJSON() as Record<string, unknown> | null) ?? {});
      r = take("stepUp") ?? ok({ step_up_at: new Date().toISOString() }, 201);
      if (r.status === 201) m.needStepUp = false;
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}
async function open(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto("/setup/bridge");
  expect(res?.status()).toBe(200);
  await expect(page.locator(`${BODY} .k-pc-row`).first()).toBeVisible();
}
const row = (page: Page, name = NAME) => page.locator(`${BODY} .k-pc-row`, { hasText: name });
const more = (page: Page, name = NAME) => row(page, name).getByRole("button", { name: /^…/ });
const confirmDlg = (page: Page) => page.getByRole("alertdialog", { name: TITLE });
const checkDlg = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます" });
async function startRemove(page: Page, name = NAME) {
  await more(page, name).click();
  await page.getByRole("menuitem", { name: "この PC を外す" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
}
const pressRemove = (page: Page) =>
  page.getByRole("alertdialog").getByRole("button", { name: "外す", exact: true }).click();

// ---------------------------------------------------------------- 行

test("K363-UI-001 PC の行の「…」は押せる（aria-disabled でない）。押すとメニューに「この PC を外す」が 1 つ。口はまだ呼ばない", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await expect(more(page)).not.toHaveAttribute("aria-disabled", "true");
  await more(page).click();
  const items = page.getByRole("menuitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveText("この PC を外す");
  expect(m.deletes).toEqual([]);
});

test("K363-UI-002 「この PC を外す」：確かめの小窓（題・本文・「外す」「やめる」）。開いたときのフォーカスは「やめる」。DELETE は 0 回", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await startRemove(page);
  await expect(confirmDlg(page)).toBeVisible();
  await expect(confirmDlg(page)).toContainText(DESC);
  await expect(confirmDlg(page).getByRole("button", { name: "やめる", exact: true })).toBeFocused();
  await expect(confirmDlg(page).getByRole("button", { name: "外す", exact: true })).toBeVisible();
  expect(m.deletes).toEqual([]);
});

test("K363-UI-003 確かめの小窓の「やめる」：閉じて口を呼ばない。行は残る", async ({ page }) => {
  const m = await mockApi(page);
  await open(page);
  await startRemove(page);
  await confirmDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(row(page)).toHaveCount(1);
  expect(m.deletes).toEqual([]);
});

test("K363-UI-004 「外す」（取り直しが 15 分の内）：DELETE がその PC にちょうど 1 回 → 次の定期の読み（5 秒）を待たずに一覧を読み直し、行が消え、一覧の上の帯（role=status）に知らせが出る", async ({
  page,
}) => {
  // 定期の読み（前の読みの答えから 5 秒後・devices.ts の pollDevices の setTimeout）は、画面の時計を止めて起こさない。
  //   壁の時計で比べない（台が混んでも同じ結果）。定期の読みが画面の時計で動くことは K57-UI-016 が見ている
  await page.clock.install();
  const m = await mockApi(page, { devices: [pc(D1, NAME), pc(D2, "会社の Windows")] });
  await open(page);
  await startRemove(page);
  // ここで時計を止める（K60-UI-033 と同じ形）。止めるまでに出た定期の読みは「外す」を押すより前に口に届くので、下の数では「外す前」に入る
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await pressRemove(page);
  // 外す口が答えた後に、一覧の読みが 1 回以上増える。時計は止まっているので、定期の読みでは満たせない（＝外した後の読み直し）
  await expect
    .poll(() => (m.readsAtDelete === null ? 0 : m.reads - m.readsAtDelete), {
      message: "外した答えの後に、定期の読みを待たずに一覧を読み直した",
    })
    .toBeGreaterThanOrEqual(1);
  expect(m.deletes).toEqual([D1]);
  await page.clock.resume();
  await expect(page.getByRole("status").filter({ hasText: DONE })).toBeVisible();
  await expect(row(page)).toHaveCount(0);
  await expect(row(page, "会社の Windows")).toHaveCount(1);
  expect(m.deletes).toEqual([D1]);
});

test("K363-UI-005 外したのが最後の PC：一覧は「まだありません」と「＋ PC をつなぐ」の形（PC 無し）に変わる", async ({
  page,
}) => {
  await mockApi(page);
  await open(page);
  await startRemove(page);
  await pressRemove(page);
  await expect(page.locator(`${BODY} .k-pc-empty`)).toHaveText("まだありません");
  await expect(page.locator(BODY).getByRole("button", { name: "＋ PC をつなぐ" })).toBeVisible();
});

test("K363-UI-006 取り直しが要る（パスワードの人）：403・STEP_UP_REQUIRED で取り直しの小窓（理由・パスワードの欄・6 けた無し）。確かめると stepUp 1 回 → 同じ PC を続けて外す（もう一度押させない）", async ({
  page,
}) => {
  const m = await mockApi(page, { needStepUp: true });
  await open(page);
  await startRemove(page);
  await pressRemove(page);
  await expect(checkDlg(page)).toBeVisible();
  await expect(checkDlg(page)).toContainText(REASON);
  await expect(checkDlg(page).locator(".k-login-code-box")).toHaveCount(0);
  await checkDlg(page).getByLabel("パスワード", { exact: true }).fill(PW);
  await checkDlg(page).getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: DONE })).toBeVisible();
  expect(m.stepUps).toEqual([{ password: PW }]);
  expect(m.deletes).toEqual([D1, D1]);
  await expect(row(page)).toHaveCount(0);
});

test("K363-UI-007 取り直しが要る（2 段階の人）：小窓に 6 けたの欄が出て、stepUp の体はパスワードとコード", async ({
  page,
}) => {
  const m = await mockApi(page, { needStepUp: true, sec: PASSWORD_2FA });
  await open(page);
  await startRemove(page);
  await pressRemove(page);
  await expect(checkDlg(page).locator(".k-login-code-box")).toHaveCount(6);
  await checkDlg(page).getByLabel("パスワード", { exact: true }).fill(PW);
  await checkDlg(page).locator(".k-login-code-box").first().click();
  await page.keyboard.type("123456");
  await checkDlg(page).getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: DONE })).toBeVisible();
  expect(m.stepUps).toEqual([{ password: PW, code: "123456" }]);
});

test("K363-UI-008 取り直しが要る（パスキーだけの人）：欄を出さず「パスキーで確かめる」だけ", async ({ page }) => {
  await mockApi(page, { needStepUp: true, sec: PASSKEY_ONLY });
  await open(page);
  await startRemove(page);
  await pressRemove(page);
  await expect(checkDlg(page).getByRole("button", { name: "パスキーで確かめる" })).toBeVisible();
  await expect(checkDlg(page).getByLabel("パスワード")).toHaveCount(0);
});

test("K363-UI-009 取り直しの小窓の「やめる」：stepUp 0 回・DELETE は最初の 1 回だけ・行は残る", async ({ page }) => {
  const m = await mockApi(page, { needStepUp: true });
  await open(page);
  await startRemove(page);
  await pressRemove(page);
  await checkDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(checkDlg(page)).toHaveCount(0);
  expect(m.stepUps).toEqual([]);
  expect(m.deletes).toEqual([D1]);
  await expect(row(page)).toHaveCount(1);
});

test("K363-UI-010 取り直しのパスワードが違う（stepUp 401・STEP_UP_FAILED）：小窓は閉じず欄の下に口の文。DELETE は 1 回のまま", async ({
  page,
}) => {
  const m = await mockApi(page, { needStepUp: true });
  m.once.stepUp = err(401, "STEP_UP_FAILED", msg("E-AUTH-021"));
  await open(page);
  await startRemove(page);
  await pressRemove(page);
  await checkDlg(page).getByLabel("パスワード", { exact: true }).fill(K363_WRONG_STEP_PW);
  await checkDlg(page).getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(checkDlg(page)).toContainText(msg("E-AUTH-021"));
  await expect(checkDlg(page)).toBeVisible();
  expect(m.deletes).toEqual([D1]);
});

test("K363-UI-011 もう外した PC（ほかのタブで外した・404）：小窓を閉じ、赤い知らせ（role=alert）に E-PAGE-001 の文。一覧を読み直して行が消える", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await startRemove(page);
  m.devices = []; // ほかのタブで外した
  await pressRemove(page);
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-001") })).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(row(page)).toHaveCount(0);
});

test("K363-UI-012 S1 の失敗：口が 503・E-PAGE-003 → 小窓を閉じ、赤い知らせに E-PAGE-003 の文。行は残り、もう一度「…」から外せる", async ({
  page,
}) => {
  const m = await mockApi(page);
  m.once.delete = err(503, "E-PAGE-003", msg("E-PAGE-003"));
  await open(page);
  await startRemove(page);
  await pressRemove(page);
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-003") })).toBeVisible();
  await expect(row(page)).toHaveCount(1);
  await startRemove(page);
  await pressRemove(page);
  await expect(page.getByRole("status").filter({ hasText: DONE })).toBeVisible();
  expect(m.deletes).toEqual([D1, D1]);
});

test("K363-UI-013 ログインが切れた（401）：入り直しへ移る（/login?next=%2Fsetup%2Fbridge）", async ({ page }) => {
  const m = await mockApi(page);
  m.once.delete = err(401, "UNAUTHENTICATED");
  await open(page);
  await startRemove(page);
  await pressRemove(page);
  await expect(page).toHaveURL(/\/login\?next=%2Fsetup%2Fbridge$/);
});

test("K363-UI-014 「外す」の 2 回押し（答えを待っている間）：主ボタンは処理中で押せず、DELETE はちょうど 1 回", async ({
  page,
}) => {
  const m = await mockApi(page);
  m.hold = { release: () => undefined };
  await open(page);
  await startRemove(page);
  const btn = page.getByRole("alertdialog").getByRole("button", { name: "外す", exact: true });
  await btn.click();
  await expect.poll(() => m.deletes.length).toBe(1);
  await btn.click({ force: true });
  await expect(btn).toBeDisabled();
  m.hold.release();
  await expect(page.getByRole("status").filter({ hasText: DONE })).toBeVisible();
  expect(m.deletes).toEqual([D1]);
});

test("K363-UI-015 外した後の一覧の読み直しが失敗（503）：知らせ「外しました…」は出て、次に読めたときに行が消える", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await startRemove(page);
  m.once.list = err(503, "E-PAGE-003");
  await pressRemove(page);
  await expect(page.getByRole("status").filter({ hasText: DONE })).toBeVisible();
  await expect(row(page)).toHaveCount(0, { timeout: 15_000 });
});

test("K363-UI-016 キーボード：「…」に Tab で届き、Enter でメニュー、Enter で確かめの小窓、Esc で閉じて口を呼ばない", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await more(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "この PC を外す" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(confirmDlg(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(m.deletes).toEqual([]);
});

test("K363-UI-017 幅 320・375・768・1024・1440 でメニューと確かめの小窓を開いた形：横溢れ 0（scrollWidth − clientWidth を数で）", async ({
  page,
}) => {
  await mockApi(page);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await open(page, w);
    await startRemove(page);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `幅 ${w}`).toBe(0);
    await confirmDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  }
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock・置き場は /dev/mock/f3-pc・K-369 が本線に入れる）

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const DLG = ".k-dialog";
//   PC の行は 1 行目（高本の MacBook）だけを比べる（モックは 2 行。組の値はどちらの側もちょうど 1 つの要素で比べる）。
//   行の高さは比べない：行の中に差す部品（Claude Code の直し方・AI が使うブラウザを選ぶ欄）の見た目は K-361・K-368 の受け持ちで、
//   この葉と順が無い。行の位置（x・y）は、見出しの行の「＋ PC をつなぐ」の高さを含めて比べる。
//   「…」の縦の位置（y）は比べない：下絵の 1 行目は選ぶ欄つきで行が上ぞろえ（pc-row-parts.css）、この試験の作り物の PC は browser を持たず
//   欄が出ないので行は中ぞろえ（connect-pc.css）。欄の有無で「…」が数 px 上下する決まりは部品の CSS（pc-row-parts.css）の 1 か所で、
//   下絵と本番が同じ決まりを読む（どの葉の組も「…」の縦の位置は比べない）。
//   メニューと項目の y は「…」のボタンの上端から比べる（「…」からの並びだけを見る）
const ROW1 = `${BODY} .k-pc-row:nth-child(1)`;
const FROM_MORE = {
  max_width: 1440,
  canvas: `${ROW1} .k-pc-more`,
  app: `${ROW1} .k-pc-more`,
  why: "「…」の縦の位置は行の中の部品（選ぶ欄の有無）で変わる。メニューは「…」からの並びだけを比べる（K-363）",
};
const PAIRS: FidelityPair[] = [
  pair(
    "pc-row",
    ROW1,
    BOX.filter((p) => p !== "height"),
  ),
  pair("pc-more", `${ROW1} .k-pc-more`, [...BOX.filter((p) => p !== "y"), "color"]),
  { ...pair("pc-menu", '[role="menu"]', BOX), y_from: FROM_MORE } as FidelityPair,
  { ...pair("pc-menu-item", '[role="menuitem"]', [...BOX, ...TXT]), y_from: FROM_MORE } as FidelityPair,
  pair("dlg", DLG, BOX),
  pair("dlg-title", `${DLG} .k-dialog-title`, ["x", "y", ...TXT]),
  pair("dlg-desc", `${DLG} .k-dialog-describe`, ["x", "y", "font-size", "color"]),
  pair("dlg-input", `${DLG} input:not(.k-login-code-box)`, [...BOX, "font-size"]),
  pair("dlg-btn", `${DLG} .k-dialog-actions button`, [...BOX, "font-size", "color", "texts"]),
];
const DRIVE: Record<string, { o: Parameters<typeof mockApi>[1]; act: (p: Page) => Promise<void> }> = {
  "pc-menu": { o: {}, act: (p) => more(p).click() },
  "pc-remove": { o: {}, act: (p) => startRemove(p) },
  "pc-remove-stepup": {
    o: { needStepUp: true },
    act: async (p) => {
      await startRemove(p);
      await pressRemove(p);
      await expect(checkDlg(p)).toBeVisible();
    },
  },
};
for (const [id, c] of Object.entries(DRIVE)) {
  for (const w of MATCH_WIDTHS) {
    test(`K363-UI-018 ${id} 幅 ${w}：PC の行・「…」・メニュー・小窓（箱・題・本文・欄・ボタン）の値がモック /dev/mock/f3-pc/${id} と同じ（共通の道具 matchMock）`, async ({
      browser,
    }) => {
      const opts = { pairs: PAIRS, base: "/dev/mock/f3-pc", blur: true } as MatchOptions & { base: string };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockApi(page, c.o);
          await open(page, w);
          await c.act(page);
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "PC の行で比べた").toContain("pc-row");
      expect(bad).toEqual([]);
    });
  }
}
