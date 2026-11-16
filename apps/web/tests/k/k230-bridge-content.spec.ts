// K-230「PC をつなぐの中身をキャンバス（EdPC・MePC・MePCInstalled）に合わせる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas/EdPC.dc.html（つなぐ小窓 580px・3 段の丸・接続コードの箱・受け取るは字のリンク・共用の PC の注意・足の帯の あとで と待っている印）・
//     MePC.dc.html（つないでいる PC のカードの行・使った量の箱）・MePCInstalled.dc.html（K-219・この PC に Bridge が入っている・正）。外枠と第 2 ナビと見出しの行は K-220。
//   前からの試験との約束（K-138 が持つ m2-bridge-ticket.spec.ts・staging の steps.ts と、K-220 が持つ connect-pc.spec.ts を壊さない）：
//     本文の h1 はキャンバスどおり「PC と使った量」（K-220）・小窓の題「PC をつなぐ」も h1（小窓が開くと後ろは読み上げの木から外れるので、h1 は読み上げで 1 つ）・
//     接続コードの data-testid="pairing-code" の innerText は 6 字のまま・「つながっています」で始まる role=status・region「切れています」・
//     「Bridge を起こす」「新しいコード」「この PC の Bridge につなぐ」「このアカウントに切り替える」「戻る」「前の設定の画面」を残す。
//   口（API）とこの PC の中だけの口（127.0.0.1:38617）は網の手前で差し替える（本人の Bridge に届かせない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import {
  compareFonts,
  compareRows,
  loadedFonts,
  mismatches,
  readVals,
  type FidelityPair,
} from "../../../../scripts/ci/fidelity_compare.mjs";
import { FIDELITY_STATES, routeCanvasFonts } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WS = "aaaaaaaa-0000-4000-8000-000000000230";
const ME = "11111111-0000-4000-8000-000000000230";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const PRIMARY = "rgb(34, 52, 92)";
const WHITE = "rgb(255, 255, 255)";
const LINE = "rgb(221, 226, 233)";
const LINE_SOFT = "rgb(237, 240, 244)";
const GREEN = "rgb(22, 101, 52)";
const MUTED = "rgb(74, 85, 99)";
const BODY = 'section[aria-labelledby="connect-pc-title"]';
const SEEN = "2026-11-15T00:00:00Z"; // 日本時間で 11/15 09:00
/** 接続コードに使える字（staging・m2 と同じ） */
const CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const CODE_CHARS = "ABCDEFGHJK";

// 時刻の書き方が日本時間を明示しているかを見るため、ブラウザの時間帯は日本でない所にする
test.use({ timezoneId: "UTC" });

type DevState = "live" | "waiting" | "asleep";
type Reply = { status: number; body: unknown };
interface Mock {
  downloads: string[];
  codes: number;
  devices: DevState[];
  installed: boolean;
}
const ok = (data: unknown, meta: Record<string, unknown> = {}): Reply => ({ status: 200, body: { data, meta } });

async function mockApi(page: Page, o: Partial<Mock> = {}): Promise<Mock> {
  const m: Mock = { downloads: [], codes: 0, devices: [], installed: false, ...o };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, async (route, req) => {
    if (!m.installed) return route.abort("connectionrefused");
    const cors = {
      "access-control-allow-origin": req.headers()["origin"] ?? "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
    const body =
      new URL(req.url()).pathname === "/ping"
        ? { app: "kaname-bridge", version: "1.4.0", device_label: "この PC", connected: false }
        : { ok: true };
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    let r: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (p === "/api/auth-ext/me")
      r = ok({ member_id: ME, tenant_id: WS, display_name: "高本", role_id: "owner", scope_id: null });
    else if (p === "/api/v1/scopes") r = ok([], { limit: 200, writable: [] });
    else if (p === "/api/v1/approvals/queue") r = ok([], { limit: 20, counts: { total: 0 }, cursor: null });
    else if (p === "/api/v1/bridge/devices")
      r = ok(
        m.devices.map((state, i) => ({
          id: `d${i}`,
          device_label: i === 0 ? "高本の MacBook" : "事務所の Windows",
          state,
          last_seen_at: state === "waiting" ? null : SEEN,
          version: "1.4.0",
        })),
      );
    else if (p === "/api/v1/bridge/pairing-codes" && req.method() === "POST") {
      m.codes += 1;
      r = {
        status: 201,
        body: {
          data: { code: `KQ7M${CODE_CHARS[m.codes % 10]}X`, expires_at: new Date(Date.now() + 600_000).toISOString() },
        },
      };
    } else {
      const d = /^\/api\/v1\/bridge\/releases\/(\w+)\/file$/.exec(p);
      if (d) {
        m.downloads.push(d[1]!);
        return route.fulfill({ status: 200, contentType: "application/octet-stream", body: "Kaname-Bridge" });
      }
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}
async function open(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto("/setup/bridge");
  expect(res?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}
const dialog = (page: Page) => page.getByRole("dialog", { name: "PC をつなぐ" });
const rows0 = (page: Page) => page.locator(`${BODY} .k-pc-card .k-pc-row`).first();
/** 要素から本文の箱までの不透明度を掛けた値（親にも薄さを掛けると二重になるのを見る） */
const seenOpacity = (l: ReturnType<Page["locator"]>) =>
  l.evaluate((e) => {
    let v = 1;
    for (let x: Element | null = e; x; x = x.parentElement) v *= Number(getComputedStyle(x).opacity);
    return v;
  });
const color = (l: ReturnType<Page["locator"]>, prop: string) =>
  l.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);

test("K230-UI-001 PC が無い・Bridge も無い：つなぐ小窓が開く（幅 580・角丸 12・白）。題「PC をつなぐ」は h1・15px・700、補足 12px 灰、右上に「閉じる」", async ({
  page,
}) => {
  await mockApi(page);
  await open(page);
  const d = dialog(page);
  await expect(d).toBeVisible();
  const pop = page.locator(".k-dialog");
  expect(Math.round((await pop.boundingBox())!.width)).toBe(580);
  expect(await color(pop, "border-top-left-radius")).toBe("12px");
  expect(await color(pop, "background-color")).toBe(WHITE);
  const title = d.getByRole("heading", { level: 1, name: "PC をつなぐ" });
  await expect(title).toBeVisible();
  expect(await title.evaluate((e) => getComputedStyle(e).fontSize)).toBe("15px");
  expect(await title.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
  const sub = d.getByText("分身はこの PC で動く。3 分ほど", { exact: true });
  expect(await sub.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  expect(await sub.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  await expect(d.getByRole("button", { name: "閉じる" })).toBeVisible();
  const head = page.locator(".k-dialog-head");
  const subBox = (await sub.boundingBox())!;
  const headBox = (await head.boundingBox())!;
  expect(subBox.y + subBox.height, "補足は頭の中（題の下）").toBeLessThanOrEqual(headBox.y + headBox.height);
  await page.setViewportSize({ width: 375, height: 1000 });
  expect(Math.round((await pop.boundingBox())!.width), "幅 375 は左右 16px の内側").toBe(343);
});

test("K230-UI-002 3 段：丸の番号（26px・円）。2 段目は紺の「2」・3 段目は灰の地の「3」。受け取りを始めると 1 段目は緑の ✓。題は 600、段の間に線 #EDF0F4", async ({
  page,
}) => {
  await mockApi(page);
  await open(page);
  const steps = dialog(page).locator(".k-steps > li");
  await expect(steps).toHaveCount(3);
  const dot = (i: number) => steps.nth(i).locator(".k-step-dot");
  for (let i = 0; i < 3; i += 1) {
    const r = (await dot(i).boundingBox())!;
    expect(Math.round(r.width)).toBe(26);
    expect(Math.round(r.height)).toBe(26);
    expect(await color(dot(i), "border-top-left-radius")).toBe("9999px");
  }
  await expect(dot(1)).toHaveText("2");
  expect(await color(dot(1), "background-color")).toBe(PRIMARY);
  await expect(dot(2)).toHaveText("3");
  expect(await color(dot(2), "background-color")).toBe("rgb(238, 240, 244)");
  expect(await color(dot(2), "color")).toBe(MUTED);
  await expect(dot(0)).toHaveText("1");
  await dialog(page).getByRole("button", { name: "Mac 用を受け取る" }).click();
  await expect(dot(0)).toHaveText("✓");
  expect(await color(dot(0), "background-color")).toBe(GREEN);
  expect(await color(steps.nth(1).locator(".k-step-title"), "font-weight")).toBe("600");
  await expect(steps.nth(0)).toContainText(
    "Mac・Windows に入れる小さなアプリ。ブラウザを動かし、預けたログイン情報を入れる役目",
  );
  await expect(steps.nth(1)).toContainText("10 分で切れる ・ この PC 専用の鍵が作られ、ほかの PC からは使えない");
  await expect(steps.nth(2)).toContainText("分身が「ナレッジのページを開いて閉じる」を試す。終わればつながった");
  expect(await color(steps.nth(1), "border-top-color")).toBe(LINE_SOFT);
});

test("K230-UI-003 接続コード：1 字ずつの箱が 6 つ（34×42・線 1px 紺・角丸 8・20px・700）。pairing-code の innerText は改行の無い 6 字", async ({
  page,
}) => {
  await mockApi(page);
  await open(page);
  const code = dialog(page).getByTestId("pairing-code");
  await expect(code).toHaveText(CODE_RE);
  expect(await code.innerText()).toMatch(CODE_RE);
  const cells = code.locator(".k-code-cell");
  await expect(cells).toHaveCount(6);
  for (let i = 0; i < 6; i += 1) {
    const c = cells.nth(i);
    const r = (await c.boundingBox())!;
    expect(Math.round(r.width)).toBe(34);
    expect(Math.round(r.height)).toBe(42);
    expect(await color(c, "border-top-color")).toBe(PRIMARY);
    expect(await color(c, "border-top-left-radius")).toBe("8px");
    expect(await color(c, "font-size")).toBe("20px");
    expect(await color(c, "font-weight")).toBe("700");
  }
});

test("K230-UI-004 受け取る：1 段目の説明の中の字のリンク「Mac 用」「Windows 用」（読み上げの名前は「Mac 用を受け取る」「Windows 用を受け取る」・枠のボタンではない）。Enter でも受け取りの口を呼ぶ", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  const step1 = dialog(page).locator(".k-steps > li").first();
  const mac = step1.getByRole("button", { name: "Mac 用を受け取る" });
  const win = step1.getByRole("button", { name: "Windows 用を受け取る" });
  await expect(mac).toHaveText("Mac 用");
  await expect(win).toHaveText("Windows 用");
  await expect(step1.locator(".k-btn")).toHaveCount(0);
  await win.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => m.downloads).toEqual(["win"]);
  await expect(page.getByText("ダウンロードを始めました")).toBeVisible();
});

test("K230-UI-005 足の帯：「あとで」（高さ 30・白地・線 #DDE2E9）と、橙の点（8px・#B45309）つきの「アプリからの返事を待っています…」", async ({
  page,
}) => {
  await mockApi(page);
  await open(page);
  const foot = page.locator(".k-dialog-actions");
  const later = foot.getByRole("button", { name: "あとで" });
  expect(Math.round((await later.boundingBox())!.height)).toBe(30);
  expect(await color(later, "background-color")).toBe(WHITE);
  expect(await color(later, "border-top-color")).toBe(LINE);
  const wait = foot.getByText("アプリからの返事を待っています…");
  await expect(wait).toBeVisible();
  const dot = foot.locator(".k-wait-dot");
  expect(Math.round((await dot.boundingBox())!.width)).toBe(8);
  expect(await color(dot, "background-color")).toBe("rgb(180, 83, 9)");
});

test("K230-UI-006 「あとで」と「閉じる」：小窓が閉じて本文（つないでいる PC のカード）が出る。カードの「＋ PC をつなぐ」で小窓がまた開き、コードが出る", async ({
  page,
}) => {
  await mockApi(page);
  await open(page);
  await page.locator(".k-dialog-actions").getByRole("button", { name: "あとで" }).click();
  await expect(dialog(page)).toHaveCount(0);
  const add = page.locator(BODY).getByRole("button", { name: "＋ PC をつなぐ" });
  await expect(add).toBeVisible();
  expect(Math.round((await add.boundingBox())!.height)).toBe(30);
  await add.click();
  await expect(dialog(page).getByTestId("pairing-code")).toHaveText(CODE_RE);
  await dialog(page).getByRole("button", { name: "閉じる" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("K230-UI-007 「新しいコード」は 2 段目の説明の中（字のリンクの形・12px）に残り、押すと別のコードに替わる（口は 1 回）", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  const code = dialog(page).getByTestId("pairing-code");
  const first = await code.innerText();
  const step2 = dialog(page).locator(".k-steps > li").nth(1);
  const again = step2.getByRole("button", { name: "新しいコード" });
  expect(await color(again, "font-size")).toBe("12px");
  const limit = step2.getByText(/10 分で切れる/);
  expect(
    Math.abs((await again.boundingBox())!.y - (await limit.boundingBox())!.y),
    "「10 分で切れる…」と同じ行",
  ).toBeLessThanOrEqual(4);
  expect(await color(again, "background-color")).toBe("rgba(0, 0, 0, 0)");
  const before = m.codes;
  await again.click();
  await expect(code).not.toHaveText(first);
  expect(m.codes - before).toBe(1);
});

test("K230-UI-008 共用の PC の注意：淡い橙の箱（#FFF8EE・線 #F3D3A7・角丸 8・12px）に「!」（#7A4A05）と「つなぐ PC は、あなたしか使わないものにする…」", async ({
  page,
}) => {
  await mockApi(page);
  await open(page);
  const note = dialog(page).locator(".k-pc-shared-note");
  await expect(note).toContainText("つなぐ PC は、あなたしか使わないものにする");
  expect(await color(note, "background-color")).toBe("rgb(255, 248, 238)");
  expect(await color(note, "border-top-color")).toBe("rgb(243, 211, 167)");
  expect(await color(note, "border-top-left-radius")).toBe("8px");
  expect(await color(note, "font-size")).toBe("12px");
  expect(await color(note.getByText("!", { exact: true }), "color")).toBe("rgb(122, 74, 5)");
});

test("K230-UI-009 つながっている：小窓は開かない。白いカード「つないでいる PC」（角丸 10・線 #DDE2E9）の行に名前と緑の札「つながっている」・11px の補足（Bridge 1.4.0）。青い Callout は無く、名前は本文に 1 回だけ", async ({
  page,
}) => {
  await mockApi(page, { devices: ["live"] });
  await open(page);
  await expect(dialog(page)).toHaveCount(0);
  const card = page.locator(`${BODY} .k-pc-card`, { hasText: "つないでいる PC" });
  expect(await color(card, "background-color")).toBe(WHITE);
  expect(await color(card, "border-top-color")).toBe(LINE);
  expect(await color(card, "border-top-left-radius")).toBe("10px");
  const row = card.locator(".k-pc-row").first();
  await expect(row).toContainText("高本の MacBook");
  const pill = row.locator(".k-pc-pill", { hasText: "つながっている" });
  expect(await color(pill, "background-color")).toBe("rgb(232, 245, 236)");
  expect(await color(pill, "color")).toBe(GREEN);
  await expect(row.locator(".k-pc-icon svg")).toHaveCount(1);
  // 札「いつも使う」はキャンバスに在る（最初の行・地 #EEF0F4・字 #4A5563）。どの PC をいつも使うかの値が無いので、グレー（薄さ 0.55）で出す
  const always = rows0(page).locator(".k-pc-pill", { hasText: "いつも使う" });
  await expect(always).toHaveCount(1);
  expect(await color(always, "background-color")).toBe("rgb(238, 240, 244)");
  expect(await color(always, "color")).toBe(MUTED);
  expect(await seenOpacity(always), "先祖まで掛けた薄さ（二重にしない）").toBeCloseTo(0.55, 2);
  expect(await seenOpacity(pill), "状態の札は薄くしない").toBeCloseTo(1, 2);
  expect(await seenOpacity(row.getByText("高本の MacBook", { exact: true })), "名前は薄くしない").toBeCloseTo(1, 2);
  const detail = row.locator(".k-pc-detail");
  expect(await color(detail, "font-size")).toBe("11px");
  await expect(detail).toContainText("Kaname の常駐アプリ v1.4.0");
  await expect(page.locator(`${BODY} .k-callout[data-tone="info"]`)).toHaveCount(0);
  const seen = await page.locator(BODY).evaluate((b) => {
    const c = b.cloneNode(true) as HTMLElement;
    for (const x of c.querySelectorAll(".k-sr, .sr-only")) x.remove(); // 読み上げだけの字は数えない
    return c.textContent ?? "";
  });
  expect(seen.split("高本の MacBook").length - 1, "見える字の中で名前は 1 回").toBe(1);
});

test("K230-UI-010 つながっている（読み上げ）：「つながっています」で始まる role=status があり、名前と版（1.4.0）を含む", async ({
  page,
}) => {
  await mockApi(page, { devices: ["live"] });
  await open(page);
  const s = page
    .getByRole("status")
    .filter({ hasText: /^つながっています/ })
    .first();
  await expect(s).toBeAttached();
  await expect(s).toContainText("高本の MacBook");
  await expect(s).toContainText("1.4.0");
});

test("K230-UI-011 切れている：小窓は開かない。橙の札「切れている」・「最後に見えた 11/15 09:00」（日本時間）・淡い橙の「直し方」の箱に E-CONN-001 の文と「Bridge を起こす」。region「切れています」", async ({
  page,
}) => {
  await mockApi(page, { devices: ["asleep"] });
  await open(page);
  await expect(dialog(page)).toHaveCount(0);
  const region = page.getByRole("region", { name: "切れています" });
  await expect(region).toBeVisible();
  const pill = region.locator(".k-pc-pill", { hasText: "切れている" });
  expect(await color(pill, "background-color")).toBe("rgb(252, 235, 213)");
  expect(await color(pill, "color")).toBe("rgb(122, 74, 5)");
  await expect(region).toContainText("最後に見えた 11/15 09:00");
  const fix = region.locator(".k-pc-fix");
  expect(await color(fix, "background-color")).toBe("rgb(255, 248, 238)");
  await expect(fix).toContainText("直し方");
  await expect(fix).toContainText(/まだつながっていません。Bridge を開いたら/);
  await fix.getByRole("button", { name: "Bridge を起こす" }).click();
  await expect(page.locator('iframe[src="kaname-bridge://open"]')).toHaveCount(1);
});

test("K230-UI-012 つないでいる PC の一覧：カードの行は上に線 #EDF0F4 で区切り（点の並びではない）。行の「…」は使えない（aria-disabled・見た目の薄さ 0.55・押してもメニューが開かない）。札「いつも使う」は 2 台でも最初の行の 1 つだけ", async ({
  page,
}) => {
  await mockApi(page, { devices: ["live", "asleep"] });
  await open(page);
  const rows = page.locator(`${BODY} .k-pc-card .k-pc-row`);
  await expect(rows).toHaveCount(2);
  for (let i = 0; i < 2; i += 1) {
    expect(await color(rows.nth(i), "border-top-color")).toBe(LINE_SOFT);
    expect(await color(rows.nth(i), "list-style-type")).not.toBe("disc");
    const more = rows.nth(i).getByRole("button", { name: /^…/ });
    await expect(more).toHaveAttribute("aria-disabled", "true");
    expect(await seenOpacity(more), "先祖まで掛けた薄さ（二重にしない）").toBeCloseTo(0.55, 2);
    await more.click({ force: true });
    await expect(page.getByRole("menu")).toHaveCount(0);
  }
  await expect(page.locator(`${BODY} ul:not([class])`)).toHaveCount(0);
  // 札「いつも使う」はキャンバスどおり最初の行の 1 つだけ（2 台でも）
  const always = page.locator(`${BODY} .k-pc-card .k-pc-pill`, { hasText: "いつも使う" });
  await expect(always).toHaveCount(1);
  await expect(rows.nth(0).locator(".k-pc-pill", { hasText: "いつも使う" })).toHaveCount(1);
});

test("K230-UI-013 返事を待っている PC：一覧の行に灰の札「返事を待っています」と「高本の MacBook はつながりました」。小窓の足の帯は待っている印のまま", async ({
  page,
}) => {
  await mockApi(page, { devices: ["waiting"] });
  await open(page);
  await expect(page.getByText("高本の MacBook はつながりました")).toBeAttached();
  const pill = page.locator(`${BODY} .k-pc-pill`, { hasText: "返事を待っています" });
  await expect(pill).toBeAttached();
  expect(await color(pill, "color")).toBe(MUTED);
  await expect(page.locator(".k-dialog-actions").getByText("アプリからの返事を待っています…")).toBeVisible();
});

test("K230-UI-014 この PC に Bridge が入っている：小窓は開かない。白いカード「この PC の Bridge」（角丸 10）に版つきの文と紺の小さなボタン「この PC の Bridge につなぐ」（高さ 30）。一覧のカードは「まだありません」", async ({
  page,
}) => {
  await mockApi(page, { installed: true });
  await open(page);
  await expect(dialog(page)).toHaveCount(0);
  const card = page.locator(`${BODY} .k-pc-card`, { hasText: "この PC の Bridge" });
  expect(await color(card, "border-top-left-radius")).toBe("10px");
  await expect(card).toContainText("この PC に Bridge が入っています（v1.4.0）");
  const go = card.getByRole("button", { name: "この PC の Bridge につなぐ" });
  expect(Math.round((await go.boundingBox())!.height)).toBe(30);
  expect(await color(go, "background-color")).toBe(PRIMARY);
  const list = page.locator(`${BODY} .k-pc-card`, { hasText: "つないでいる PC" });
  await expect(list).toContainText("まだありません");
  await expect(list.getByRole("button", { name: "＋ PC をつなぐ" }), "キャンバスの MePCInstalled に無い").toHaveCount(
    0,
  );
  await expect(page.getByTestId("pairing-code")).toHaveCount(0);
});

test("K230-UI-015 使った量の箱（つながっている）：「5 時間の枠」「今月」と「ワークスペースごとの内訳（今月）」の箱は出すが、本当の値が無いので数（%）も帯の長さも出さない（D-145.9）", async ({
  page,
}) => {
  await mockApi(page, { devices: ["live"] });
  await open(page);
  const usage = page.locator(`${BODY} .k-pc-usage`);
  await expect(usage).toContainText("5 時間の枠");
  await expect(usage).toContainText("今月");
  expect(await usage.innerText()).not.toMatch(/\d+\s*%/);
  const bars = usage.locator(".k-pc-bar > span");
  expect(await bars.count()).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < (await bars.count()); i += 1)
    expect(Math.round((await bars.nth(i).boundingBox())?.width ?? 0)).toBe(0);
  const per = page.locator(`${BODY} .k-pc-card`, { hasText: "ワークスペースごとの内訳（今月）" });
  await expect(per).toBeVisible();
  await expect(per.locator(".k-pc-row")).toHaveCount(0);
});

test("K230-UI-016 本文の見出しはキャンバスどおり「PC と使った量」（つながっている状態の level 1 の見出し）。「PC をつなぐ」の見出しは小窓の題だけ", async ({
  page,
}) => {
  await mockApi(page, { devices: ["live"] });
  await open(page);
  await expect(page.getByRole("heading", { level: 1, name: "PC と使った量" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PC をつなぐ" })).toHaveCount(0);
});

test("K230-UI-017 小窓のキーボード：開いたときフォーカスは「閉じる」に無い。読み上げの h1 は小窓の題 1 つだけ。Esc で閉じ、本文の h1 が読み上げに戻る", async ({
  page,
}) => {
  await mockApi(page);
  await open(page);
  await expect(dialog(page)).toBeVisible();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  expect(focused).not.toBe("閉じる");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "PC と使った量" })).toBeVisible();
});

interface YFrom {
  max_width: number;
  canvas: string;
  app: string;
  why: string;
}
interface Group {
  id: string;
  canvas: string;
  app: string;
  state: string;
  widths: number[];
  pairs: FidelityPair[];
  owner: string;
  enrolled: boolean;
}
const CFG = JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: Group[] };
const MINE = ["bridge-code", "bridge-connected", "bridge-installed"];

test("K230-UI-018 突き合わせの設定：bridge-code・bridge-connected・bridge-installed が enrolled・持ち主 K-230・bridge-code の足のボタンの組は両側とも「あとで」・描き足した 7 つの操作（新しいコード・Bridge を起こす・前の設定の画面 ×3・戻る・このアカウントに切り替える）の対が在る・前の設定の画面は縦の位置を比べない・戻るは ?from= つきで開く・鍵が在る", () => {
  for (const id of MINE) {
    const g = CFG.groups.find((x) => x.id === id);
    expect(g, id).toBeTruthy();
    expect(g!.enrolled, id).toBe(true);
    expect(g!.owner, id).toBe("K-230");
    expect(FIDELITY_STATES[g!.state], id).toBeTruthy();
  }
  const code = CFG.groups.find((x) => x.id === "bridge-code")!;
  // bridge-code の primary は「あとで」と「新しいコード」の 2 つ。対は名前で探す
  const btn = code.pairs.find((p) => p.name === "足のボタン（あとで）");
  expect(btn, "bridge-code に「足のボタン（あとで）」の対").toBeTruthy();
  expect(btn!.canvas, "EdPC に紺のボタンは無い（足の帯の あとで と比べる）").not.toContain("#22345C");
  expect(btn!.app).not.toContain('data-variant="primary"');
  // キャンバスに無かった操作は残し、K-257 が絵に描き足す（決める人の答え answer=fd9dcd7a7cc8）。描き足した後の絵と突き合わせる対を持つ
  const added: [Group, string, string][] = [
    [code, "新しいコード", '[data-act="new-code"]'],
    [CFG.groups.find((x) => x.id === "bridge-connected")!, "Bridge を起こす", '[data-act="wake"]'],
  ];
  for (const [g, name, sel] of added) {
    const pair = g.pairs.find((p) => p.name === name);
    expect(pair, `${g.id} に「${name}」の対`).toBeTruthy();
    expect(pair!.role, name).toBe("primary");
    expect(pair!.canvas, `${name} の絵の側`).toBe(sel);
    expect(pair!.app, `${name} の画面の側`).toBe(sel);
  }
  // K-257 が描き足した残りの 5 つ（前の設定の画面は 3 枚とも本文の最後・戻るは MePC の頭・切り替えるは MePCInstalled のつなぐの隣）
  const byId = (id: string) => CFG.groups.find((x) => x.id === id)!;
  const LEGACY = ["font-size", "font-weight", "color", "x"];
  const BACK = ["font-size", "font-weight", "color", "x", "y"];
  const PRIMARY = ["height", "background-color", "color", "font-size", "font-weight", "border-radius", "x", "y"];
  const more: [Group, string, string, string, string[]][] = [
    [code, "前の設定の画面", '[data-act="legacy"]', "band-title", LEGACY],
    [byId("bridge-connected"), "前の設定の画面", '[data-act="legacy"]', "band-title", LEGACY],
    [byId("bridge-installed"), "前の設定の画面", '[data-act="legacy"]', "band-title", LEGACY],
    [byId("bridge-connected"), "戻る", '[data-act="back"]', "band-title", BACK],
    [byId("bridge-installed"), "このアカウントに切り替える", '[data-act="switch-account"]', "primary", PRIMARY],
  ];
  for (const [g, name, sel, role, props] of more) {
    const pair = g.pairs.find((p) => p.name === name);
    expect(pair, `${g.id} に「${name}」の対`).toBeTruthy();
    expect(pair!.canvas, `${g.id} の ${name} の絵の側`).toBe(sel);
    expect(pair!.app, `${g.id} の ${name} の画面の側`).toBe(sel);
    expect(pair!.role, `${g.id} の ${name} の役`).toBe(role);
    for (const prop of props) expect(pair!.props, `${g.id} の ${name} は ${prop} を比べる`).toContain(prop);
    // 前の設定の画面は本文の最後の文の中で、上の中身の高さで縦の位置が変わるので y を比べない
    if (name === "前の設定の画面") expect(pair!.props, `${g.id} の ${name}`).not.toContain("y");
  }
  // 戻るはほかの画面から開いたときだけ出るので、bridge-connected は ?from= つき（一覧から来た形）で開く
  expect(byId("bridge-connected").app).toBe("/setup/bridge?from=%2Ftickets");
  // 375 は外枠の決まり（767 以下は上の帯なし）に従い、y は本文の箱の上端から比べる（PM の決め 2026-11-17）。訳は必ず書く
  for (const id of ["bridge-connected", "bridge-installed"]) {
    for (const p of byId(id).pairs.filter((x) => x.props.includes("y"))) {
      const yf = (p as FidelityPair & { y_from?: YFrom }).y_from;
      expect(yf, `${id} の ${p.name} に y_from`).toBeTruthy();
      expect(yf!.max_width, `${id} の ${p.name}`).toBe(767);
      expect(yf!.why.length, `${id} の ${p.name} の訳`).toBeGreaterThan(10);
      const box = p.name === "Bridge を起こす" ? "直し方の箱" : "本文の箱";
      if (box === "本文の箱") {
        expect(yf!.canvas, `${id} の ${p.name}`).toBe("main > div > section");
        expect(yf!.app, `${id} の ${p.name}`).toBe(".k-page");
      } else {
        expect(yf!.app, `${id} の ${p.name}：口に無い補足の行の高さだけを外す`).toBe(".k-pc-fix");
        expect(yf!.canvas).toContain("#FFF8EE");
      }
    }
  }
});

for (const id of MINE) {
  const G = CFG.groups.find((x) => x.id === id);
  for (const w of G?.widths ?? [1440]) {
    test(`K230-UI-019 ${id}（${G?.canvas}）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
      expect(G).toBeTruthy();
      const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await routeCanvasFonts(canvasPage);
      await canvasPage.goto(pathToFileURL(join(ROOT, `04_design/canvas/${G!.canvas}.dc.html`)).href);
      for (const p of G!.pairs) await canvasPage.locator(p.canvas).first().waitFor({ state: "visible" });
      await canvasPage.evaluate(() => document.fonts.ready);
      const canvasVals = await readVals(canvasPage, G!.pairs, "canvas");
      const canvasFonts = await loadedFonts(canvasPage);
      await canvasPage.close();

      const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await FIDELITY_STATES[G!.state]!(appPage, G!.app);
      for (const p of G!.pairs) await appPage.locator(p.app).first().waitFor({ state: "visible" });
      await appPage.evaluate(() => document.fonts.ready);
      const appVals = await readVals(appPage, G!.pairs, "app");
      const appFonts = await loadedFonts(appPage);
      await appPage.close();

      const rows = [...compareRows(G!.pairs, canvasVals, appVals), compareFonts(canvasFonts, appFonts)];
      const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
      expect(mismatches(rows), bad.join("\n")).toBe(0);
    });
  }
}

test("K230-UI-020 台帳：PC をつなぐの画面の k-steps・k-code（未定義のクラス）の行が無い", () => {
  const ledger = JSON.parse(readFileSync(join(ROOT, "scripts/ci/class_ledger.json"), "utf8")) as {
    entries: { cls: string; file: string }[];
  };
  const left = ledger.entries.filter(
    (e) =>
      e.file === "apps/web/features/F3/connect-pc/connect-pc.tsx" && ["k-steps", "k-code", "k-row"].includes(e.cls),
  );
  expect(left).toEqual([]);
});

test("K230-UI-021 幅 320・375・768・1024・1440：小窓は画面の中（左右の端が 0〜幅）・横溢れ 0。つながっている本文も横溢れ 0", async ({
  page,
}) => {
  const bad: string[] = [];
  await mockApi(page);
  for (const w of WIDTHS) {
    await open(page, w);
    const r = (await page.locator(".k-dialog").boundingBox())!;
    if (r.x < 0 || r.x + r.width > w) bad.push(`幅 ${w}：小窓が画面の外（${r.x}〜${r.x + r.width}）`);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o !== 0) bad.push(`幅 ${w}：小窓のとき横溢れ ${o}px`);
  }
  const live = await page.context().newPage();
  await mockApi(live, { devices: ["live"] });
  for (const w of WIDTHS) {
    await open(live, w);
    const o = await live.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o !== 0) bad.push(`幅 ${w}：つながっているとき横溢れ ${o}px`);
  }
  await live.close();
  expect(bad).toEqual([]);
});

test("K230-UI-022 待っている → つながっている：小窓は自分で閉じ、本文の「つながっています」で始まる role=status が読み上げに見える", async ({
  page,
}) => {
  const m = await mockApi(page, { devices: ["waiting"] });
  await page.clock.install();
  await open(page);
  await expect(dialog(page)).toBeVisible();
  m.devices = ["live"];
  await page.clock.fastForward(6_000);
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /^つながっています/ })
      .first(),
  ).toBeVisible();
});

test("K230-UI-023 「あとで」で閉じた後：一覧を読み直しても（6 秒進めても）小窓は自分で開き直さない。開くのは画面を開いた最初の 1 回と「＋ PC をつなぐ」だけ", async ({
  page,
}) => {
  await mockApi(page);
  await page.clock.install();
  await open(page);
  await page.locator(".k-dialog-actions").getByRole("button", { name: "あとで" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.clock.fastForward(6_000);
  await page.clock.fastForward(6_000);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator(BODY).getByRole("button", { name: "＋ PC をつなぐ" })).toBeVisible();
});

test("K230-UI-024 小窓を開いている間にこの PC で Bridge が入った（where が installed に変わった）：小窓は閉じ、「この PC の Bridge」のカードが出る", async ({
  page,
}) => {
  const m = await mockApi(page);
  await page.clock.install();
  await open(page);
  await expect(dialog(page)).toBeVisible();
  m.installed = true;
  await page.clock.fastForward(6_000);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator(`${BODY} .k-pc-card`, { hasText: "この PC の Bridge" })).toBeVisible();
});

test("K230-UI-025 超えそうなとき（つながっている）：キャンバスのカードを出す。本当の値が無いので、切り替えと選ぶ欄はグレー（薄さ 0.55）で押せず、押しても変わらない。選ぶ欄に値の字を書かない", async ({
  page,
}) => {
  await mockApi(page, { devices: ["live"] });
  await open(page);
  const card = page.locator(`${BODY} .k-pc-card`, { hasText: "超えそうなとき" });
  expect(await color(card, "background-color")).toBe(WHITE);
  expect(await color(card, "border-top-left-radius")).toBe("10px");
  await expect(card.locator(".k-pc-set-row")).toHaveCount(2);
  await expect(card.locator(".k-pc-set-row").nth(0)).toContainText("80% を超えたら知らせる");
  await expect(card.locator(".k-pc-set-row").nth(1)).toContainText("枠を使い切ったら");
  const sw = card.getByRole("switch");
  const pick = card.locator(".k-pc-set-row").nth(1).getByRole("button");
  for (const el of [sw, pick]) {
    await expect(el).toHaveAttribute("aria-disabled", "true");
    expect(await seenOpacity(el), "先祖まで掛けた薄さ（二重にしない）").toBeCloseTo(0.55, 2);
    expect(await el.getAttribute("tabindex")).toBe("-1");
  }
  const before = await sw.getAttribute("aria-checked");
  await sw.click({ force: true });
  expect(await sw.getAttribute("aria-checked")).toBe(before);
  await pick.click({ force: true });
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(card).not.toContainText("満ちるまで待つ");
});

test("K230-UI-026 見出しの行（幅 375）：戻る・見出しの行と説明の行の縦の間はキャンバスの 10px", async ({ page }) => {
  await mockApi(page, { devices: ["live"] });
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto("/setup/bridge?from=%2Ftickets");
  await page.evaluate(() => document.fonts.ready);
  const h1 = (await page.locator(`${BODY} .k-page-head h1`).boundingBox())!;
  const desc = (await page.locator(`${BODY} .k-page-head .k-desc`).boundingBox())!;
  expect(desc.y, "説明は見出しの下の行").toBeGreaterThan(h1.y + 1);
  expect(Math.round(desc.y - (h1.y + h1.height))).toBe(10);
});

test("K230-UI-027 比べ方の y_from：幅 767 以下は y を y_from の箱の上端から読む（上に 48px の帯があっても無くても同じ）。768 以上は頁の上端から。訳（why）が無ければ投げる", async ({
  page,
}) => {
  const html = (bar: number) =>
    `<div style="height:${bar}px"></div><section id="b" style="padding:10px"><p id="t" style="margin:0;height:20px">x</p></section>`;
  const pair = {
    name: "試し",
    role: "h1",
    canvas: "#t",
    app: "#t",
    props: ["y"],
    y_from: { max_width: 767, canvas: "#b", app: "#b", why: "試しの訳（帯の高さで y を比べない）" },
  } as FidelityPair;
  await page.setViewportSize({ width: 375, height: 600 });
  await page.setContent(html(48));
  expect((await readVals(page, [pair], "app"))[0]!["y"]).toBe("10px");
  await page.setContent(html(0));
  expect((await readVals(page, [pair], "canvas"))[0]!["y"]).toBe("10px");
  await page.setViewportSize({ width: 768, height: 600 });
  await page.setContent(html(48));
  expect((await readVals(page, [pair], "app"))[0]!["y"]).toBe("58px");
  await page.setViewportSize({ width: 375, height: 600 });
  const noWhy = { ...pair, y_from: { max_width: 767, canvas: "#b", app: "#b" } } as FidelityPair;
  await expect(readVals(page, [noWhy], "app")).rejects.toThrow(/why/);
});
