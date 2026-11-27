// K-1008「止める日の帯・止められた画面・中を見られている間の帯」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f12-user の uh-stop-soon・uh-stopped・uh-peek（本番と同じ部品 features/F12/help/status-parts・K-943）。
//   帯の形は getServiceStatusForMember の bands の stop・peek（K-970・K-969 が返す形・11_tickets/K-1008.md の前提と制約）。
//   ログイン・外枠は本物。稼働状況とお知らせの口（help-mock.ts）と、見るのをやめる口（closePeek）だけを網の手前で差し替える。
//   時刻は page.clock で決める（固定の待ちは使わない）。テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { USER_PAIRS, USER_WIDTHS, matchUser, overflowX } from "./f12-user-match";
import { err, mockHelp, statusTaka, type BandA, type HMock, type StatusA } from "./help-mock";

const NOW = new Date("2025-11-22T03:00:00Z");
const GRANT = "0193c5a0-0000-7000-8000-00000000a001";
const BAND = ".k-uh-bands .k-band";
const stopBand = (from: string): BandA => ({
  kind: "stop",
  title: "お支払いの確認が取れないため",
  from,
  closable: false,
  more: 0,
});
const SOON = stopBand("2025-11-28T15:00:00Z");
const STOPPED: BandA = {
  ...stopBand("2025-11-19T15:00:00Z"),
  title: "利用規約に反する使い方の疑いがあり、確かめるあいだ止めています",
};
const peekBand = (minutes = 52): BandA => ({
  kind: "peek",
  notice_id: GRANT, // 閉じる口 closePeek の id（K-969 が返す欄・まとめ役に頼んだ）
  title: "合同会社ミナト企画 ・ 湊 さくら さん",
  state: "問い合わせ「承認したのに動かない」",
  to: new Date(NOW.getTime() + minutes * 60_000).toISOString(),
  closable: false,
  more: 0,
});
const withBands = (...bands: BandA[]): StatusA => ({ ...statusTaka(), bands });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openAt(page: Page, path = "/tickets", width = 1440): Promise<void> {
  await page.clock.install({ time: NOW });
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(path);
}
interface Peek {
  calls: string[];
  next: number[];
}
async function mockPeekClose(page: Page): Promise<Peek> {
  const p: Peek = { calls: [], next: [] };
  await page.route(/\/api\/v1\/ops\/peeks\//, (route, req) => {
    p.calls.push(`${req.method()} ${new URL(req.url()).pathname}`);
    const status = p.next.shift() ?? 200;
    const body =
      status === 200 ? { data: { id: GRANT, closed_at: NOW.toISOString() } } : err(status, "E-PAGE-003").body;
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return p;
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const DRIVES: Record<string, (page: Page) => Promise<HMock | void>> = {
  "uh-stop-soon": async (page) => {
    await mockHelp(page, { status: withBands(SOON) });
    await openAt(page, "/tickets", page.viewportSize()!.width);
    await expect(page.locator(BAND)).toBeVisible();
  },
  "uh-stopped": async (page) => {
    await mockHelp(page, { status: withBands(STOPPED) });
    await openAt(page, "/tickets", page.viewportSize()!.width);
    await expect(
      page.getByRole("heading", { name: "このワークスペースは止められています", level: 1, exact: true }),
    ).toBeVisible();
  },
  "uh-peek": async (page) => {
    await mockHelp(page, { status: withBands(peekBand()) });
    await openAt(page, "/tickets", page.viewportSize()!.width);
    await expect(page.locator(".k-uh-peek-bar")).toBeVisible();
  },
  "uh-peek-customer": async (page) => {
    // 顧客の側（会社の人の画面）：閉じる id を持たない帯（K1008-UI-012 と同じ答え・D-156.50）
    const { notice_id: _ops, ...rest } = peekBand();
    void _ops;
    await mockHelp(page, { status: withBands({ ...rest, title: "運営が中を見ています" }) });
    await openAt(page, "/tickets", page.viewportSize()!.width);
    await expect(page.locator(BAND)).toContainText("運営が中を見ています");
  },
};
for (const id of Object.keys(DRIVES)) {
  for (const w of USER_WIDTHS) {
    test(`K1008-UI-001 ${id} 幅 ${w}：止める日の帯・止められた画面・中を見られている間の帯の位置と大きさと字がモックと同じ`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const pairs = USER_PAIRS.filter((p) => ["band", "full", "peek", "state"].includes(p.name));
      // 止められた画面の運営の宛先は設定の値（試験の環境の宛先）で、下絵は見本の字（info@kaname.example）
      const skip = id === "uh-stopped" ? ["full:texts"] : [];
      const { bad, rows } = await matchUser(browser, id, w, async (p) => void (await DRIVES[id]!(p)), { pairs, skip });
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 止める日
test("K1008-UI-002 止める日が決まった帯（管理者に口が返した物）：「11/29 にこのワークスペースを止めます」・理由・× が無い・「問い合わせる」は /inquiry?from=<今の道>", async ({
  page,
}) => {
  await mockHelp(page, { status: withBands(SOON) });
  await openAt(page);
  await expect(page.locator(BAND)).toContainText("11/29 にこのワークスペースを止めます");
  await expect(page.locator(BAND)).toContainText("理由：お支払いの確認が取れないため");
  await expect(page.locator(BAND).getByRole("button", { name: "閉じる", exact: true })).toHaveCount(0);
  await page.locator(BAND).getByRole("button", { name: "問い合わせる", exact: true }).click();
  await expect(page).toHaveURL(/\/inquiry\?from=%2Ftickets$/);
});

test("K1008-UI-003 止めた後に入る：外枠も本文も出さず「このワークスペースは止められています」・止めた日（11/20）・理由・運営の宛先（設定の値）・押せる物は「問い合わせる」だけ", async ({
  page,
}) => {
  await mockHelp(page, { status: withBands(STOPPED) });
  await openAt(page);
  await expect(
    page.getByRole("heading", { name: "このワークスペースは止められています", level: 1, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("11/20 から止まっています。データは消えていません。再開すると、そのまま続きから使えます", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("利用規約に反する使い方の疑いがあり、確かめるあいだ止めています", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".k-uh-full-card")).toContainText("@");
  await expect(page.locator("[data-ticket-shell]")).toHaveCount(0);
  const buttons = await page.locator("main button, main a[href]").allTextContents();
  expect(buttons.map((t) => t.trim()).filter(Boolean)).toEqual(["問い合わせる"]);
});

test("K1008-UI-004 止めた後でも、困ったとき・お知らせと問い合わせの道（/notices・/inquiry）は開ける・ほかの道（/approvals）は止められた画面", async ({
  page,
}) => {
  await mockHelp(page, { status: withBands(STOPPED) });
  await openAt(page);
  await page.getByRole("button", { name: "問い合わせる", exact: true }).click();
  await expect(page).toHaveURL(/\/inquiry(\?|$)/);
  await expect(page.locator('[role="dialog"]:has(h2:text-is("問い合わせる"))')).toBeVisible();
  await page.goto("/notices");
  await expect(page.getByRole("heading", { name: "困ったとき・お知らせ", level: 1, exact: true })).toBeVisible();
  await page.goto("/approvals");
  await expect(
    page.getByRole("heading", { name: "このワークスペースは止められています", level: 1, exact: true }),
  ).toBeVisible();
});

test("K1008-UI-005 止める日を過ぎた瞬間：開いている間に止める日が来たら、次に稼働状況を読んだときに止められた画面に替わる（止める日の前は帯）", async ({
  page,
}) => {
  const mk = await mockHelp(page, { status: withBands(stopBand("2025-11-22T03:01:00Z")) });
  await openAt(page);
  await expect(page.locator(BAND)).toContainText("にこのワークスペースを止めます");
  await page.clock.runFor(61_000);
  await page.goto("/approvals");
  await expect(
    page.getByRole("heading", { name: "このワークスペースは止められています", level: 1, exact: true }),
  ).toBeVisible();
  expect(mk.count("status")).toBeGreaterThanOrEqual(1);
});

// ---------------------------------------------------------------- 中を見られている間
test("K1008-UI-006 中を見られている間：画面の上に「運営として見ています」・見ている先・理由・「残り 52 分」・外枠と本文はその下に出る", async ({
  page,
}) => {
  await mockHelp(page, { status: withBands(peekBand()) });
  await openAt(page);
  const bar = page.locator(".k-uh-peek-bar");
  await expect(bar).toContainText("運営として見ています");
  await expect(bar).toContainText("合同会社ミナト企画 ・ 湊 さくら さん の画面 ・ 見るだけ（押しても何も変わらない）");
  await expect(bar).toContainText("理由：問い合わせ「承認したのに動かない」");
  await expect(bar).toContainText("残り 52 分");
  await expect(page.locator("[data-ticket-shell]")).toBeVisible();
  expect((await bar.boundingBox())!.y).toBeLessThanOrEqual(
    (await page.locator("[data-ticket-shell]").boundingBox())!.y,
  );
});

test("K1008-UI-012 顧客の側（会社の人の画面）：上の帯に「運営が中を見ています」・理由・「残り 52 分」。× も「見るのをやめる」も無く、運営の側の帯は出ない・外枠はふつうに出る（D-156.50）", async ({
  page,
}) => {
  const { notice_id: _ops, ...rest } = peekBand(); // 顧客の側は閉じる id を持たない（口は null で返す・道具の型は欄なしで表す）
  void _ops;
  const customer: BandA = { ...rest, title: "運営が中を見ています" };
  await mockHelp(page, { status: withBands(customer) });
  await openAt(page);
  const band = page.locator(BAND);
  await expect(band).toContainText("運営が中を見ています");
  await expect(band).toContainText("理由：問い合わせ「承認したのに動かない」");
  await expect(band).toContainText("残り 52 分");
  await expect(band.getByRole("button")).toHaveCount(0);
  await expect(page.locator(".k-uh-peek-bar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "見るのをやめる", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-ticket-shell]")).toBeVisible();
});

test("K1008-UI-007 残りの時間：1 分ごとに減り、期限を過ぎたら稼働状況を読み直して帯が消える", async ({ page }) => {
  const mk = await mockHelp(page, { status: withBands(peekBand(2)) });
  await openAt(page);
  await expect(page.locator(".k-uh-peek-bar")).toContainText("残り 2 分");
  await page.clock.runFor(60_000);
  await expect(page.locator(".k-uh-peek-bar")).toContainText("残り 1 分");
  mk.status = statusTaka();
  await page.clock.runFor(61_000);
  await expect(page.locator(".k-uh-peek-bar")).toHaveCount(0);
  expect(mk.count("status")).toBe(2);
});

test("K1008-UI-008 「見るのをやめる」：closePeek を 1 回（DELETE /ops/peeks/<id>）・運営の場所（/ops）へ。失敗（503）は帯の中に赤い箱（E-PAGE-003）で帯は残る", async ({
  page,
}) => {
  await mockHelp(page, { status: withBands(peekBand()) });
  const p = await mockPeekClose(page);
  p.next.push(503);
  await openAt(page);
  const stopBtn = page.locator(".k-uh-peek-bar").getByRole("button", { name: "見るのをやめる", exact: true });
  await stopBtn.click();
  await expect(page.locator('.k-uh-peek-bar [role="alert"][data-code="E-PAGE-003"]')).toBeVisible();
  await stopBtn.click();
  await expect(page).toHaveURL(/\/ops$/);
  expect(p.calls).toEqual([`DELETE /api/v1/ops/peeks/${GRANT}`, `DELETE /api/v1/ops/peeks/${GRANT}`]);
});

// ---------------------------------------------------------------- 守り・失敗・幅
test("K1008-UI-009 理由・見ている先に HTML が入っても字のまま・スクリプトが動かない", async ({ page }) => {
  await mockHelp(page, {
    status: withBands({ ...peekBand(), state: '<img src=x onerror="window.__x=1">理由' }),
  });
  await openAt(page);
  await expect(page.locator(".k-uh-peek-bar")).toContainText('<img src=x onerror="window.__x=1">理由');
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
});

test("K1008-UI-010 稼働状況が読めない（503）：止められた画面にしない（読めないのに止めない・止めるのは口の入口の仕事）", async ({
  page,
}) => {
  const mk = await mockHelp(page, { status: withBands(STOPPED) });
  mk.script("status", err(503, "E-PAGE-003"));
  await openAt(page);
  await expect(page.locator("[data-ticket-shell]")).toBeVisible();
  await expect(page.getByRole("heading", { name: "このワークスペースは止められています", exact: true })).toHaveCount(0);
});

test("K1008-UI-011 幅 320・375・768・1024・1440：止める日の帯・止められた画面・中を見られている間で横のはみ出しが 0", async ({
  page,
}) => {
  await page.clock.install({ time: NOW });
  for (const status of [withBands(SOON), withBands(STOPPED), withBands(peekBand())]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockHelp(page, { status });
    for (const w of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await loginAs(page, owner.token);
      await page.goto("/tickets");
      await expect(page.locator(".k-band, .k-uh-full-card, .k-uh-peek-bar").first()).toBeVisible();
      expect(await overflowX(page), `${status.bands[0]!.kind} 幅 ${w}`).toBeLessThanOrEqual(0);
    }
  }
});
