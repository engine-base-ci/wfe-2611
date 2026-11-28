// K-368「PC の行で AI が使うブラウザを選ぶ欄と、Chrome とつながらないときのその場の一手（BrowserFix）を契約の口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   画面：/setup/bridge（K-57 の features/F3/connect-pc）。正のモック：/dev/mock/f3-pc の pc-browser-pick・saved・fix・checking・ok・still・timeout・asleep
//   （本番と同じ部品 apps/web/features/F3/connect-pc/pc-row-parts.tsx の BrowserChoice・BrowserFix。K-369 が本線に入れる・代表の OK 2026-11-19）。
//   口（listMyDevices・updateMyDevice・checkMyDeviceBrowser）は網の手前（page.route）で差し替える。口の振る舞いは K-364・K-365 の試験が本物の DB で持つ。
//   本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。固定の待ち（waitForTimeout）は使わない：答えを待たせる行は約束で止めて放し、
//   90 秒の上限は page.clock で進める。会話の 1 行の一手（components/ai/browser-fix.tsx）は screens/browser-notice.spec.ts（切る段で替えた・carry）が本物の口で見る。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { MATCH_WIDTHS, matchMock, type MatchOptions } from "./stage2-match";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K368_WEB_TOKEN } from "../../test/_fake/secrets";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const BODY = 'section[aria-labelledby="pc-list-title"]';
const MAC = "高本の MacBook";
const MINI = "事務所の Mac mini";
const D1 = "11111111-0000-4000-8000-000000000368";
const D2 = "22222222-0000-4000-8000-000000000368";
const D3 = "33333333-0000-4000-8000-000000000368";
const CHROME_CHECK = "AI が Chrome を使える（Claude in Chrome）";
const CWS = "https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn";
const SAVED = "変えました。次の仕事から使います";
const CHECKING = "確かめています（1 分ほどかかります）…";
const OK = "つながりました。AI は Chrome を使えます";
const STILL = "まだつながっていません。上の手順を見直してから、もう一度押してください";
const TIMEOUT = "結果が返ってきませんでした。PC の Bridge が動いているか確かめてください";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/** 文は正本（07_qa/test-specs/errors.json）から引く。眠っている PC の文は K-365 が足す（番号でなく where.state で引く） */
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string; where?: { state?: string } }[];
  }
).errors;
const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;
const ASLEEP = ERRORS.find((e) => e.where?.state === "browser_check_asleep");
const ASLEEP_ID = ASLEEP?.id ?? "(where.state browser_check_asleep が errors.json に無い・K-365)";
const ASLEEP_TEXT = ASLEEP?.message ?? ASLEEP_ID;
const waitText = (sec: number) => msg("E-LIM-005").replace("{秒}", String(sec));

type Check = { name: string; ok: boolean; detail: string; fix?: string | null };
const H: Record<"chromeNg" | "chromeOk" | "chromeUnused" | "claudeMissing", Check[]> = {
  chromeNg: [
    {
      name: CHROME_CHECK,
      ok: false,
      detail:
        "つながっていません（2026/11/19 10:00:00）。Chrome を開き、拡張機能「Claude in Chrome」がこの Claude と同じアカウントでログインしているか確かめてください",
    },
  ],
  chromeOk: [{ name: CHROME_CHECK, ok: true, detail: "つながっています（2026/11/19 10:01:00）" }],
  chromeUnused: [
    { name: CHROME_CHECK, ok: true, detail: "まだ使っていません（AI が初めてブラウザを使うときに確かめます）" },
  ],
  // K-361 の形（本人のサブスクの Claude Code が無い）
  claudeMissing: [
    { name: "本人のサブスクの Claude Code がある", ok: false, detail: "この PC にありません", fix: "install" },
    {
      name: "Claude Code にログインできている",
      ok: false,
      detail: "先に Claude Code を入れてください",
      fix: "install",
    },
  ],
};

type Browser3 = "chrome" | "dedicated" | "off";
interface Dev {
  id: string;
  device_label: string;
  state: "live" | "asleep" | "waiting";
  last_seen_at: string | null;
  connected_at: string;
  version: string | null;
  health: Check[];
  health_at: string | null;
  browser?: Browser3;
  revoke_reason: null;
}
/** モックの行と同じ補足の字になる値（11/02 につないだ ・ Kaname の常駐アプリ v0.9.4） */
const dev = (id: string, label: string, o: Partial<Dev> = {}): Dev => ({
  id,
  device_label: label,
  state: "live",
  last_seen_at: new Date().toISOString(),
  connected_at: "2026-11-02T01:00:00Z",
  version: "0.9.4",
  health: [],
  health_at: "2026-11-19T01:00:00Z",
  browser: "chrome",
  revoke_reason: null,
  ...o,
});
const asleep = (id: string, label: string, o: Partial<Dev> = {}): Dev =>
  dev(id, label, { state: "asleep", last_seen_at: "2026-11-15T00:02:00Z", ...o });

type Reply = { status: number; body: unknown };
interface Mock {
  devices: Dev[];
  reads: number;
  patches: { id: string; body: unknown }[];
  checks: { id: string; body: unknown }[];
  /** 確かめの仕事を Bridge が済ませた後の自己診断（null＝返ってこない）。次の一覧の読みで health_at が新しくなる */
  answer: "ok" | "still" | null;
  once: Partial<Record<"patch" | "check" | "list", Reply>>;
  /** 答えを止めておく口（放すまで答えない） */
  hold: Partial<Record<"patch" | "check", { release: () => void }>>;
}
const ok = (data: unknown, status = 200): Reply => ({ status, body: { data, meta: {} } });
const err = (status: number, code: string, extra: Record<string, unknown> = {}): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, ...extra },
});

async function mockApi(page: Page, devices: Dev[]): Promise<Mock> {
  const m: Mock = {
    devices: structuredClone(devices),
    reads: 0,
    patches: [],
    checks: [],
    answer: null,
    once: {},
    hold: {},
  };
  let pending: string | null = null; // 確かめを積んだ PC（次の一覧の読みで答えを入れる）
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), K368_WEB_TOKEN);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const method = req.method();
    const take = (k: keyof Mock["once"]): Reply | undefined => {
      const v = m.once[k];
      delete m.once[k];
      return v;
    };
    const holdOn = async (k: keyof Mock["hold"]) => {
      const h = m.hold[k];
      if (!h) return;
      await new Promise<void>((res) => {
        h.release = res;
      });
      delete m.hold[k];
    };
    let r: Reply = err(404, "NOT_FOUND");
    const one = /^\/api\/v1\/bridge\/devices\/([^/]+)(\/browser-check)?$/.exec(p);
    if (method === "GET" && p === "/api/v1/bridge/devices") {
      m.reads += 1;
      if (pending && m.answer) {
        const d = m.devices.find((x) => x.id === pending);
        if (d) {
          d.health = m.answer === "ok" ? H.chromeOk : H.chromeNg;
          d.health_at = new Date(Date.parse(d.health_at ?? "2026-11-19T01:00:00Z") + 60_000).toISOString();
        }
        pending = null;
      }
      r = take("list") ?? ok(m.devices);
    } else if (method === "PATCH" && one && !one[2]) {
      const id = decodeURIComponent(one[1]!);
      const body = req.postDataJSON() as { browser?: Browser3 } | null;
      m.patches.push({ id, body });
      await holdOn("patch");
      const d = m.devices.find((x) => x.id === id);
      r = take("patch") ?? (d ? ok({ id, browser: body?.browser }) : err(404, "NOT_FOUND"));
      if (r.status === 200 && d && body?.browser) d.browser = body.browser;
    } else if (method === "POST" && one && one[2]) {
      const id = decodeURIComponent(one[1]!);
      m.checks.push({ id, body: req.postDataJSON() as unknown });
      await holdOn("check");
      const d = m.devices.find((x) => x.id === id);
      r =
        take("check") ??
        (!d
          ? err(404, "NOT_FOUND")
          : d.state !== "live"
            ? err(409, ASLEEP_ID, { message: ASLEEP_TEXT })
            : ok({ job_id: "99999999-0000-4000-8000-000000000368" }, 201));
      if (r.status === 201) pending = id;
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
const row = (page: Page, name = MAC) => page.locator(`${BODY} .k-pc-row`, { hasText: name });
const pick = (page: Page, name = MAC) => row(page, name).locator("[data-browser-pick]");
const radio = (page: Page, v: Browser3, name = MAC) => pick(page, name).locator(`input[type="radio"][value="${v}"]`);
const fix = (page: Page, name = MAC) => row(page, name).locator('[data-part="browser-fix"]');
const checkBtn = (page: Page, name = MAC) => fix(page, name).locator("[data-browser-check]");
const label = (v: Browser3) => ({ chrome: "自分の Chrome", dedicated: "Bridge 専用のブラウザ", off: "使わない" })[v];
const choose = (page: Page, v: Browser3, name = MAC) =>
  pick(page, name)
    .locator(".k-pc-choice", { hasText: label(v) })
    .click();
const status = (page: Page, text: string, name = MAC) => row(page, name).getByRole("status").filter({ hasText: text });
const alert = (page: Page, text: string, name = MAC) => row(page, name).getByRole("alert").filter({ hasText: text });

// ---------------------------------------------------------------- 選ぶ欄（口 updateMyDevice・K-364）

test("K368-UI-002 つないだばかりの PC の行：本文の補足の下に選ぶ欄（題「AI が使うブラウザ」・ラジオ 3 つ・自分の Chrome に「（既定）」）。一覧の browser に印が付き、行ごとに別の組。自己診断の Chrome の行が無い（health が空）chrome の行に一手は無い。口 PATCH は 0 回", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC), dev(D2, "会社の Windows", { browser: "off" })]);
  await open(page);
  await expect(pick(page).locator("legend")).toHaveText("AI が使うブラウザ");
  await expect(pick(page).locator('input[type="radio"]')).toHaveCount(3);
  await expect(pick(page).locator(".k-pc-choice").first()).toContainText("自分の Chrome（既定）");
  await expect(radio(page, "chrome")).toBeChecked();
  await expect(radio(page, "off", "会社の Windows")).toBeChecked();
  const names = await page
    .locator(`${BODY} [data-browser-pick] input[value="chrome"]`)
    .evaluateAll((es) => es.map((e) => (e as HTMLInputElement).name));
  expect(new Set(names).size, "行ごとに別のラジオの組").toBe(2);
  const after = await row(page).evaluate((r) => {
    const d = r.querySelector(".k-pc-detail");
    const f = r.querySelector("[data-browser-pick]");
    return !!d && !!f && (d.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(after, "選ぶ欄は補足の行の後").toBe(true);
  await expect(fix(page), "Chrome の行が無い（health が空）ときは一手を出さない").toHaveCount(0);
  await expect(fix(page, "会社の Windows")).toHaveCount(0);
  expect(m.patches).toEqual([]);
});

test("K368-UI-003 「Bridge 専用のブラウザ」を押す：PATCH /api/v1/bridge/devices/<その PC> を体 { browser: dedicated } でちょうど 1 回。行に「変えました。次の仕事から使います」（role=status）、印は dedicated。読み直しても dedicated", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC)]);
  await open(page);
  await choose(page, "dedicated");
  await expect(status(page, SAVED)).toBeVisible();
  await expect(radio(page, "dedicated")).toBeChecked();
  expect(m.patches).toEqual([{ id: D1, body: { browser: "dedicated" } }]);
  const reads = m.reads;
  await expect.poll(() => m.reads, { timeout: 15_000 }).toBeGreaterThan(reads);
  await expect(radio(page, "dedicated")).toBeChecked();
  await page.reload();
  await expect(radio(page, "dedicated")).toBeChecked();
  expect(m.patches).toHaveLength(1);
});

test("K368-UI-004 今と同じ値（自分の Chrome）を押す：口を呼ばない（次の一覧の読みの後も PATCH 0 回・知らせも出ない）", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC)]);
  await open(page);
  await choose(page, "chrome");
  const reads = m.reads;
  await expect.poll(() => m.reads, { timeout: 15_000 }).toBeGreaterThan(reads);
  expect(m.patches).toEqual([]);
  await expect(status(page, SAVED)).toHaveCount(0);
  await expect(radio(page, "chrome")).toBeChecked();
});

test("K368-UI-005 答えを待つ間（PATCH を止めている）：その行の 3 つは押せない（disabled・aria-busy）。もう 1 つ押しても口は 1 回のまま。答えが来たら押せる", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC)]);
  m.hold.patch = { release: () => undefined };
  await open(page);
  await choose(page, "dedicated");
  await expect.poll(() => m.patches.length).toBe(1);
  for (const v of ["chrome", "dedicated", "off"] as const) await expect(radio(page, v)).toBeDisabled();
  await expect(pick(page)).toHaveAttribute("aria-busy", "true");
  await radio(page, "off").click({ force: true });
  m.hold.patch!.release();
  await expect(status(page, SAVED)).toBeVisible();
  for (const v of ["chrome", "dedicated", "off"] as const) await expect(radio(page, v)).toBeEnabled();
  expect(m.patches).toHaveLength(1);
  await expect(radio(page, "dedicated")).toBeChecked();
});

test("K368-UI-006 手順 1 の失敗：選ぶ口が 503・E-PAGE-003 → 行に赤い知らせ（role=alert）で E-PAGE-003 の文。印は前の値（自分の Chrome）のまま", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC)]);
  m.once.patch = err(503, "E-PAGE-003", { message: msg("E-PAGE-003") });
  await open(page);
  await choose(page, "dedicated");
  await expect(alert(page, msg("E-PAGE-003"))).toBeVisible();
  await expect(radio(page, "chrome")).toBeChecked();
  await expect(radio(page, "dedicated")).not.toBeChecked();
  await expect(status(page, SAVED)).toHaveCount(0);
  expect(m.patches).toHaveLength(1);
});

test("K368-UI-007 ログインが切れた（選ぶ口が 401・確かめる口が 401）：どちらも入り直しへ移る（/login?next=%2Fsetup%2Fbridge）", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  m.once.patch = err(401, "UNAUTHENTICATED");
  await open(page);
  await choose(page, "off");
  await expect(page).toHaveURL(/\/login\?next=%2Fsetup%2Fbridge$/);
  m.once.check = err(401, "UNAUTHENTICATED");
  await open(page);
  await checkBtn(page).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fsetup%2Fbridge$/);
  expect(m.checks).toHaveLength(1);
});

test("K368-UI-008 もう外した PC（ほかのタブで外した・選ぶ口も確かめる口も 404）：行に赤い知らせで E-PAGE-001 の文。次の一覧の読みで行が消える", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg }), dev(D2, MINI, { health: H.chromeNg })]);
  await open(page);
  m.devices = m.devices.filter((d) => d.id !== D1); // ほかのタブで外した（画面はまだ古い一覧）
  await choose(page, "dedicated");
  await expect(alert(page, msg("E-PAGE-001"))).toBeVisible();
  await expect(row(page)).toHaveCount(0, { timeout: 15_000 });
  m.devices = [];
  await checkBtn(page, MINI).click();
  await expect(alert(page, msg("E-PAGE-001"), MINI)).toBeVisible();
  expect(m.patches.map((x) => x.id)).toEqual([D1]);
  expect(m.checks.map((x) => x.id)).toEqual([D2]);
});

test("K368-UI-009 PC 2 台で 2 台目を「使わない」：PATCH は 2 台目の id だけ。1 台目の印は自分の Chrome のまま", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC), dev(D2, "会社の Windows")]);
  await open(page);
  await choose(page, "off", "会社の Windows");
  await expect(status(page, SAVED, "会社の Windows")).toBeVisible();
  expect(m.patches).toEqual([{ id: D2, body: { browser: "off" } }]);
  await expect(radio(page, "chrome")).toBeChecked();
  await expect(radio(page, "off", "会社の Windows")).toBeChecked();
  await expect(status(page, SAVED)).toHaveCount(0);
});

// ---------------------------------------------------------------- その場の一手（口 checkMyDeviceBrowser・K-365）

test("K368-UI-010 自己診断の Chrome の行が ✗（自分の Chrome の PC）：選ぶ欄の下に一手（題「AI が Chrome を使えません。」）。つなぎ方は閉じていて、押すと 3 つの手順と Chrome ウェブストアの入口（新しいタブ・noopener）。✓ の PC の行には出ない", async ({
  page,
}) => {
  await mockApi(page, [dev(D1, MAC, { health: H.chromeNg }), dev(D2, "会社の Windows", { health: H.chromeOk })]);
  await open(page);
  await expect(fix(page).locator(".k-pc-part-title")).toHaveText("AI が Chrome を使えません。");
  const order = await row(page).evaluate((r) => {
    const a = r.querySelector("[data-browser-pick]");
    const b = r.querySelector('[data-part="browser-fix"]');
    return !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(order, "一手は選ぶ欄の後").toBe(true);
  await expect(fix(page).locator("ol")).toBeHidden();
  await fix(page).getByText("つなぎ方を見る").click();
  await expect(fix(page).locator("ol li")).toHaveCount(3);
  const link = fix(page).locator("[data-browser-install]");
  await expect(link).toHaveAttribute("href", CWS);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(fix(page, "会社の Windows")).toHaveCount(0);
});

test("K368-UI-011 「もう一度確かめる」→ Bridge が ✓ を送る：POST …/<その PC>/browser-check を体 {} でちょうど 1 回。押すと「確かめています…」で押せず「確かめています（1 分ほどかかります）…」。新しい自己診断が来たら一手は消え、選ぶ欄に「つながりました。AI は Chrome を使えます」", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  m.answer = "ok";
  m.hold.check = { release: () => undefined };
  await open(page);
  await checkBtn(page).click();
  await expect(checkBtn(page)).toHaveText("確かめています…");
  await expect(checkBtn(page)).toBeDisabled();
  await expect(fix(page).getByRole("status").filter({ hasText: CHECKING })).toBeVisible();
  m.hold.check!.release();
  await expect(status(page, OK)).toBeVisible({ timeout: 30_000 });
  await expect(fix(page)).toHaveCount(0);
  expect(m.checks).toEqual([{ id: D1, body: {} }]);
});

test("K368-UI-012 確かめて、まだ ✗：一手の中に赤い知らせ「まだつながっていません。上の手順を見直してから、もう一度押してください」。ボタンはまた押せる", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  m.answer = "still";
  await open(page);
  await checkBtn(page).click();
  await expect(fix(page).getByRole("alert").filter({ hasText: STILL })).toBeVisible({ timeout: 30_000 });
  await expect(checkBtn(page)).toBeEnabled();
  await expect(checkBtn(page)).toHaveText("もう一度確かめる");
  expect(m.checks).toHaveLength(1);
});

test("K368-UI-013 手順 3 の失敗（時間切れ）：自己診断が 90 秒たっても新しくならない（page.clock で進める）。60 秒ではまだ待ち、90 秒を越えたら「結果が返ってきませんでした。PC の Bridge が動いているか確かめてください」", async ({
  page,
}) => {
  await page.clock.install();
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  m.answer = null;
  await open(page);
  await checkBtn(page).click();
  await expect.poll(() => m.checks.length).toBe(1);
  await expect(fix(page).getByRole("status").filter({ hasText: CHECKING })).toBeVisible();
  await page.clock.runFor(60_000);
  await expect(fix(page).getByRole("alert").filter({ hasText: TIMEOUT })).toHaveCount(0);
  await expect
    .poll(
      async () => {
        await page.clock.runFor(5_000);
        return fix(page).getByRole("alert").filter({ hasText: TIMEOUT }).count();
      },
      { timeout: 30_000 },
    )
    .toBe(1);
  await expect(checkBtn(page)).toBeEnabled();
});

test("K368-UI-014 眠っている PC で「もう一度確かめる」：口が 409（目録で where.state が browser_check_asleep の文）→ その行の一手に赤い知らせでその文。確かめ中の字は残らず、押し直せる", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeOk }), asleep(D2, MINI, { health: H.chromeNg })]);
  await open(page);
  await expect(pick(page, MINI)).toBeVisible();
  await checkBtn(page, MINI).click();
  await expect(fix(page, MINI).getByRole("alert").filter({ hasText: ASLEEP_TEXT })).toBeVisible();
  await expect(fix(page, MINI).getByRole("status").filter({ hasText: CHECKING })).toHaveCount(0);
  await expect(checkBtn(page, MINI)).toBeEnabled();
  expect(m.checks.map((x) => x.id)).toEqual([D2]);
});

test("K368-UI-015 確かめの 2 回押し（答えを止めている間）：ボタンは押せず、口はちょうど 1 回", async ({ page }) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  m.hold.check = { release: () => undefined };
  m.answer = "ok";
  await open(page);
  await checkBtn(page).click();
  await expect.poll(() => m.checks.length).toBe(1);
  await checkBtn(page).click({ force: true });
  await expect(checkBtn(page)).toBeDisabled();
  m.hold.check!.release();
  await expect(status(page, OK)).toBeVisible({ timeout: 30_000 });
  expect(m.checks).toHaveLength(1);
});

test("K368-UI-016 一手の「Bridge 専用に切り替える」：PATCH をその PC の id で { browser: dedicated } 1 回。選ぶ欄の印が dedicated・「変えました。次の仕事から使います」。一手は消える（自分の Chrome でない PC には出さない）", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  await open(page);
  await fix(page).locator("[data-browser-dedicated]").click();
  await expect(status(page, SAVED)).toBeVisible();
  await expect(radio(page, "dedicated")).toBeChecked();
  await expect(fix(page)).toHaveCount(0);
  expect(m.patches).toEqual([{ id: D1, body: { browser: "dedicated" } }]);
  expect(m.checks).toEqual([]);
});

test("K368-UI-017 PC 2 台とも ✗ で 2 台目の行の「もう一度確かめる」：確かめの口は 2 台目の id だけ。1 台目の行は確かめ中にならない", async ({
  page,
}) => {
  const m = await mockApi(page, [
    dev(D1, MAC, { health: H.chromeNg }),
    dev(D2, "会社の Windows", { health: H.chromeNg }),
  ]);
  m.hold.check = { release: () => undefined };
  await open(page);
  await checkBtn(page, "会社の Windows").click();
  await expect.poll(() => m.checks.map((x) => x.id)).toEqual([D2]);
  await expect(checkBtn(page, "会社の Windows")).toBeDisabled();
  await expect(checkBtn(page)).toBeEnabled();
  await expect(fix(page).getByRole("status").filter({ hasText: CHECKING })).toHaveCount(0);
  m.hold.check!.release();
});

test("K368-UI-018 一手を出さない分岐：Chrome の行が「まだ使っていません」（✓）の PC・Bridge 専用を選んで古い ✗ の行が残る PC・使わないの PC → どの行にも一手は無く、選ぶ欄はある", async ({
  page,
}) => {
  await mockApi(page, [
    dev(D1, MAC, { health: H.chromeUnused }),
    dev(D2, "会社の Windows", { browser: "dedicated", health: H.chromeNg }),
    dev(D3, "家の iMac", { browser: "off", health: H.chromeNg }),
  ]);
  await open(page);
  await expect(page.locator(`${BODY} [data-browser-pick]`)).toHaveCount(3);
  await expect(page.locator(`${BODY} [data-part="browser-fix"]`)).toHaveCount(0);
});

test("K368-UI-019 Claude Code の直し方が出ている行（入っていない）：その行にはブラウザの欄も一手も出さない（先に直す物だけ・代表の答え A-3）。Claude Code が済んでいる行には出す", async ({
  page,
}) => {
  await mockApi(page, [
    dev(D1, MAC, { health: [...H.claudeMissing, ...H.chromeNg] }),
    dev(D2, "会社の Windows", { health: H.chromeNg }),
  ]);
  await open(page);
  await expect(row(page).locator('[data-part="claude-fix"]')).toBeVisible();
  await expect(pick(page)).toHaveCount(0);
  await expect(fix(page)).toHaveCount(0);
  await expect(pick(page, "会社の Windows")).toBeVisible();
  await expect(fix(page, "会社の Windows")).toBeVisible();
});

test("K368-UI-020 一覧の行に browser が無い（読めない）：今の値が分からないので、選ぶ欄も一手も出さない（嘘の印を付けない）", async ({
  page,
}) => {
  const noBrowser = dev(D1, MAC, { health: H.chromeNg });
  delete noBrowser.browser;
  await mockApi(page, [noBrowser, dev(D2, "会社の Windows")]);
  await open(page);
  await expect(pick(page)).toHaveCount(0);
  await expect(fix(page)).toHaveCount(0);
  await expect(pick(page, "会社の Windows")).toBeVisible();
});

test("K368-UI-021 手順 2 の失敗：確かめる口が 503・E-PAGE-003 → 一手の中に赤い知らせで E-PAGE-003 の文。確かめ中の字は消え、押し直せる（2 回目は ✓ で「つながりました」）", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  m.once.check = err(503, "E-PAGE-003", { message: msg("E-PAGE-003") });
  await open(page);
  await checkBtn(page).click();
  await expect(
    fix(page)
      .getByRole("alert")
      .filter({ hasText: msg("E-PAGE-003") }),
  ).toBeVisible();
  await expect(fix(page).getByRole("status").filter({ hasText: CHECKING })).toHaveCount(0);
  m.answer = "ok";
  await checkBtn(page).click();
  await expect(status(page, OK)).toBeVisible({ timeout: 30_000 });
  expect(m.checks).toHaveLength(2);
});

test("K368-UI-022 確かめを押しすぎた（429・retry_after_sec 30）：一手の中に E-LIM-005 の文（{秒} に 30）。押し直せる", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  m.once.check = err(429, "RATE_LIMITED", { retry_after_sec: 30 });
  await open(page);
  await checkBtn(page).click();
  await expect(
    fix(page)
      .getByRole("alert")
      .filter({ hasText: waitText(30) }),
  ).toBeVisible();
  await expect(checkBtn(page)).toBeEnabled();
  expect(m.checks).toHaveLength(1);
});

test("K368-UI-023 キーボード：自分の Chrome のラジオにフォーカスして ↓ で Bridge 専用に移ると、PATCH が 1 回（dedicated）で知らせが出る。一手の「もう一度確かめる」は Enter で押せる", async ({
  page,
}) => {
  const m = await mockApi(page, [
    dev(D1, MAC, { health: H.chromeNg }),
    dev(D2, "会社の Windows", { health: H.chromeNg }),
  ]);
  m.answer = "ok";
  await open(page);
  await checkBtn(page, "会社の Windows").focus();
  await page.keyboard.press("Enter");
  await expect(status(page, OK, "会社の Windows")).toBeVisible({ timeout: 30_000 });
  await radio(page, "chrome").focus();
  await page.keyboard.press("ArrowDown");
  await expect(status(page, SAVED)).toBeVisible();
  expect(m.patches).toEqual([{ id: D1, body: { browser: "dedicated" } }]);
  expect(m.checks.map((x) => x.id)).toEqual([D2]);
});

test("K368-UI-024 幅 320・375・768・1024・1440 で一手のつなぎ方を開き、まだ ✗ の知らせを出した形：横溢れ 0（scrollWidth − clientWidth を数で）", async ({
  page,
}) => {
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  m.answer = "still";
  for (const w of [320, 375, 768, 1024, 1440]) {
    await open(page, w);
    await fix(page).getByText("つなぎ方を見る").click();
    await checkBtn(page).click();
    await expect(fix(page).getByRole("alert").filter({ hasText: STILL })).toBeVisible({ timeout: 30_000 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `幅 ${w}`).toBe(0);
  }
});

test("K368-UI-025 スマホ（iPhone の端末・幅 375）：PC はつなげないが、行の選ぶ欄と「もう一度確かめる」は押せる（リモコン・代表の決め 2026-11-19）。口はその PC の id で呼ぶ", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ userAgent: IPHONE_UA, viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  const m = await mockApi(page, [dev(D1, MAC, { health: H.chromeNg })]);
  m.answer = "ok";
  const res = await page.goto("/setup/bridge");
  expect(res?.status()).toBe(200);
  await expect(radio(page, "off")).toBeEnabled();
  await checkBtn(page).click();
  await expect(status(page, OK)).toBeVisible({ timeout: 30_000 });
  await choose(page, "off");
  await expect(status(page, SAVED)).toBeVisible();
  expect(m.checks.map((x) => x.id)).toEqual([D1]);
  expect(m.patches).toEqual([{ id: D1, body: { browser: "off" } }]);
  await ctx.close();
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock・置き場は /dev/mock/f3-pc・K-369 が本線に入れる）
//   行の中の部品だけを、行の上端からの y で比べる（行より上の物＝見出しの行の「＋ PC をつなぐ」・「…」の形は K-361・K-363 と下絵の側の受け持ち）。
//   モックと同じ行で開く：どの行も browser を持つ（下絵は PC ごとに選ぶ欄をいつも出す・代表の答え A-2）。2 行目は眠っている Mac mini（直し方の箱と「Bridge を起こす」）

const BOX = ["width", "height", "x", "background-color", "border-top-color", "border-top-left-radius"];
const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "x", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
function pairsOf(n: number): FidelityPair[] {
  const R = `${BODY} .k-pc-row:nth-child(${n})`;
  const yFrom = {
    max_width: 1440,
    canvas: R,
    app: R,
    why: "行より上の物（見出しの行のボタン・眠っている行の起こすボタン）の受け持ちは別の葉。行の中の部品の並びだけを行の上端から比べる（K-368）",
  };
  const p = (name: string, sel: string, props: string[], y = true): FidelityPair =>
    ({
      name,
      role: name,
      canvas: sel,
      app: sel,
      props: y ? [...props, "y"] : props,
      ...(y ? { y_from: yFrom } : {}),
    }) as FidelityPair;
  return [
    p("browser-pick", `${R} [data-browser-pick]`, BOX),
    p("browser-legend", `${R} .k-pc-browser-legend`, ["x", ...TXT]),
    p("browser-choice", `${R} .k-pc-choice`, [...BOX, "texts"]),
    p("browser-choice-desc", `${R} .k-pc-choice-desc`, TXT),
    p("browser-radio", `${R} [data-browser-pick] input[type="radio"]`, ["width", "height", "x", "opacity"]),
    p("browser-fix", `${R} [data-part="browser-fix"]`, BOX),
    p("browser-fix-title", `${R} .k-pc-part-title`, ["x", ...TXT]),
    p("browser-fix-steps", `${R} .k-pc-fix-steps`, [...BOX, "texts"]),
    p("browser-fix-btn", `${R} [data-part="browser-fix"] .k-pc-btn`, CTRL),
    p("row-note", `${R} .k-pc-part-note`, [...BOX, ...TXT]),
  ];
}
const mini = (o: Partial<Dev> = {}) => asleep(D2, MINI, o);
interface Drive {
  devices: Dev[];
  answer?: Mock["answer"];
  rowN: number;
  act?: (p: Page) => Promise<void>;
}
const DRIVE: Record<string, Drive> = {
  "pc-browser-pick": { devices: [dev(D1, MAC), mini()], rowN: 1 },
  "pc-browser-saved": {
    devices: [dev(D1, MAC), mini()],
    rowN: 1,
    act: async (p) => {
      await choose(p, "dedicated");
      await expect(status(p, SAVED)).toBeVisible();
    },
  },
  "pc-browser-fix": {
    devices: [dev(D1, MAC, { health: H.chromeNg }), mini()],
    rowN: 1,
    act: (p) => fix(p).getByText("つなぎ方を見る").click(),
  },
  "pc-browser-checking": {
    devices: [dev(D1, MAC, { health: H.chromeNg }), mini()],
    answer: null,
    rowN: 1,
    act: async (p) => {
      await checkBtn(p).click();
      await expect(fix(p).getByRole("status").filter({ hasText: CHECKING })).toBeVisible();
    },
  },
  "pc-browser-ok": {
    devices: [dev(D1, MAC, { health: H.chromeNg }), mini()],
    answer: "ok",
    rowN: 1,
    act: async (p) => {
      await checkBtn(p).click();
      await expect(status(p, OK)).toBeVisible({ timeout: 30_000 });
    },
  },
  "pc-browser-still": {
    devices: [dev(D1, MAC, { health: H.chromeNg }), mini()],
    answer: "still",
    rowN: 1,
    act: async (p) => {
      await checkBtn(p).click();
      await expect(fix(p).getByRole("alert").filter({ hasText: STILL })).toBeVisible({ timeout: 30_000 });
    },
  },
  "pc-browser-timeout": {
    devices: [dev(D1, MAC, { health: H.chromeNg }), mini()],
    answer: null,
    rowN: 1,
    act: async (p) => {
      await checkBtn(p).click();
      await expect
        .poll(
          async () => {
            await p.clock.runFor(10_000);
            return fix(p).getByRole("alert").filter({ hasText: TIMEOUT }).count();
          },
          { timeout: 30_000 },
        )
        .toBe(1);
    },
  },
  "pc-browser-asleep": {
    devices: [dev(D1, MAC), asleep(D2, MINI, { health: H.chromeNg })],
    rowN: 2,
    act: async (p) => {
      await checkBtn(p, MINI).click();
      await expect(fix(p, MINI).getByRole("alert").filter({ hasText: ASLEEP_TEXT })).toBeVisible();
    },
  },
};
for (const [id, c] of Object.entries(DRIVE)) {
  for (const w of MATCH_WIDTHS) {
    test(`K368-UI-001 ${id} 幅 ${w}：PC の行の選ぶ欄・一手・知らせ（箱・字・ボタン・行の上端からの位置）の値がモック /dev/mock/f3-pc/${id} と同じ（共通の道具 matchMock）`, async ({
      browser,
    }) => {
      const opts = { pairs: pairsOf(c.rowN), base: "/dev/mock/f3-pc", blur: true } as MatchOptions & { base: string };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          if (id === "pc-browser-timeout") await page.clock.install();
          const m = await mockApi(page, c.devices);
          m.answer = c.answer ?? null;
          await open(page, w);
          if (c.act) await c.act(page);
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "選ぶ欄で比べた").toContain("browser-pick");
      expect(bad).toEqual([]);
    });
  }
}
