// K-844「右上の自分のメニューと左上のワークスペースの切り替えを外枠に載せ、口 getMe につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の me-menu・me-org（本番と同じ部品 features/F10/account/menu.tsx・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。getMe は f10-ops-kit、切り替え（switchWorkspace）と届いた招待（listMyInvitations）はこの試験の中で網の手前で差し替える（口は K-851）。
//   届いた招待を押した先は代表の答え待ちなので押せない形（D-154.81）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { signupViaApi } from "../_lib/api";
import { MOCK_BASE, WS_NAME, openAt, overflowX } from "./f10-kit";
import { DOT, KYOTO_ID, err, me, mockOps, ok, type Me, type Reply } from "./f10-ops-kit";
import { WIDTHS } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const TICKETS = "/tickets";
const meBtn = (page: Page) => page.getByRole("button", { name: "自分のメニュー", exact: true }).first();
const menu = (page: Page) => page.getByRole("menu", { name: "自分のメニュー", exact: true });
const orgBtn = (page: Page) => page.getByRole("button", { name: "ワークスペースを切り替える", exact: true }).first();
const orgMenu = (page: Page) => page.getByRole("menu", { name: "ワークスペースを切り替える", exact: true });
const item = (page: Page, name: string) => menu(page).getByRole("menuitem", { name: new RegExp(`^${name}`) });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});
interface SwApi {
  switches: string[];
  invReads: number;
  queue: (op: "switch" | "invites", ...r: Reply[]) => void;
  hold: () => () => void;
}
/** 切り替えと届いた招待の 2 口の差し替え（f10-ops-kit の後に足す・こちらが先に当たる）。既定は届いた招待 1 件 */
async function mockSwitch(page: Page, total = 1): Promise<SwApi> {
  const api: SwApi = { switches: [], invReads: 0, queue: () => {}, hold: () => () => {} };
  const queues = { switch: [] as Reply[], invites: [] as Reply[] };
  let held: Promise<void> | null = null;
  api.queue = (op, ...r) => void queues[op].push(...r);
  api.hold = () => {
    let open = () => {};
    held = new Promise<void>((res) => (open = res));
    return () => open();
  };
  await page.route(/\/api\/v1\/me\/(invitations$|workspaces\/[^/]+\/switch$)/, async (route: Route, req: Request) => {
    const path = new URL(req.url()).pathname;
    let r: Reply;
    if (path.endsWith("/invitations")) {
      api.invReads += 1;
      const list = Array.from({ length: total }, (_, i) => ({
        id: `0193c5a0-0000-7000-8000-00000000e00${i}`,
        workspace_name: `招いた会社 ${i + 1}`,
        inviter_name: "佐藤",
        expires_at: new Date(Date.now() + 3 * 864e5).toISOString(),
      }));
      r = queues.invites.shift() ?? ok({ invitations: list, total });
    } else {
      const id = path.split("/").at(-2)!;
      api.switches.push(id);
      if (held) await held;
      r = queues.switch.shift() ?? ok({ tenant_id: id, switched: true });
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return api;
}
async function start(page: Page, o: { me?: Me; path?: string; width?: number; token?: string; invites?: number } = {}) {
  const mk = await mockOps(page, o.me ? { me: o.me } : {});
  const sw = await mockSwitch(page, o.invites ?? 1);
  await openAt(page, o.token ?? owner.token, o.path ?? TICKETS, o.width ?? 1440);
  await expect(meBtn(page)).toBeVisible();
  return Object.assign(mk, { sw });
}
const orgRow = (page: Page, t: string) => orgMenu(page).locator(".k-f10a-pop-line").filter({ hasText: t });

// ---------------------------------------------------------------- モックとの突き合わせ
const BOX = ["width", "height", "background-color", "border-top-color", "border-top-left-radius"];
const fp = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const PAIRS: FidelityPair[] = [
  fp("pop", ".k-f10a-pop", BOX),
  fp("who", ".k-f10a-who", ["height", "texts"]),
  fp("face", ".k-f10a-who .k-f10a-avatar", BOX),
  fp("item", ".k-f10a-pop-item", ["height", "font-size"]),
  fp("sep", ".k-f10a-sep", ["height", "background-color"]),
  fp("line", ".k-f10a-pop-line", ["height", "font-size"]),
  fp("mark", ".k-f10a-mark", BOX),
];
const STATES: Record<string, (page: Page) => Promise<void>> = {
  "me-menu": async (page) => {
    await meBtn(page).click();
    await expect(menu(page)).toContainText("株式会社ENGINE BASE ・ 営業");
  },
  "me-org": async (page) => {
    await orgBtn(page).click();
    await expect(orgMenu(page)).toContainText("京蟻システム株式会社");
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K844-UI-001 ${id} 幅 ${w}：開いた箱・誰か・項目・区切り・会社の行の位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockOps(page);
          await mockSwitch(page, 1);
          await openAt(page, owner.token, TICKETS, w);
          await expect(meBtn(page)).toBeVisible();
          await drive(page);
        },
        { pairs: PAIRS, base: MOCK_BASE },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 自分のメニュー
test("K844-UI-002 開いただけでは getMe を呼ばず、自分のメニューを開くと 1 回・名前・「株式会社ENGINE BASE ・ 営業」・顔の 1 文字", async ({
  page,
}) => {
  const mk = await start(page);
  await page.waitForLoadState("networkidle");
  expect(mk.count("me")).toBe(0);
  await meBtn(page).click();
  await expect(menu(page)).toContainText("高本 聖斗");
  await expect(menu(page)).toContainText("株式会社ENGINE BASE ・ 営業");
  await expect(menu(page).locator(".k-f10a-who .k-f10a-avatar")).toHaveText("高");
  expect(mk.count("me")).toBe(1);
});

test("K844-UI-003 今の会社の顔が写真なら img（alt「顔の写真」）・文字なら 1 文字（顔は今いるワークスペースの物だけ）", async ({
  page,
}) => {
  await start(page, { me: me({ member: { avatar: { kind: "image", initial: "高", url: DOT } } }) });
  await meBtn(page).click();
  await expect(menu(page).getByRole("img", { name: "顔の写真", exact: true })).toBeVisible();
  await expect(menu(page).locator(".k-f10a-who .k-f10a-avatar")).toHaveCount(0);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await start(page);
  await meBtn(page).click();
  await expect(menu(page).getByRole("img", { name: "顔の写真", exact: true })).toHaveCount(0);
  await expect(menu(page).locator(".k-f10a-who .k-f10a-avatar")).toHaveText("高");
});

test("K844-UI-004 PC をつないでいない：「PC をまだつないでいない」・副「つなぐと分身が動く」", async ({ page }) => {
  await start(page);
  await meBtn(page).click();
  await expect(menu(page)).toContainText("PC をまだつないでいない");
  await expect(menu(page)).toContainText("つなぐと分身が動く");
});

test("K844-UI-005 項目の並び・押せない項目は aria-disabled と title「まだ使えません」・字に「準備中」が無い", async ({
  page,
}) => {
  await start(page);
  await meBtn(page).click();
  await expect(menu(page).getByRole("menuitem")).toHaveText([
    /^分身の部屋/,
    /^自分の設定/,
    /^自分の使った量/,
    /^キーボードの操作/,
    /^困ったとき・お知らせ/,
    /^ログアウト/,
  ]);
  for (const n of ["分身の部屋", "自分の使った量", "キーボードの操作", "困ったとき・お知らせ"]) {
    await expect(item(page, n)).toHaveAttribute("aria-disabled", "true");
    await expect(item(page, n)).toHaveAttribute("title", "まだ使えません");
  }
  await expect(item(page, "自分の設定")).not.toHaveAttribute("aria-disabled", "true");
  await expect(menu(page).getByRole("radio")).toHaveCount(3);
  expect(await menu(page).innerText()).not.toContain("準備中");
});

test("K844-UI-006 「自分の設定」を押すと /account へ移る", async ({ page }) => {
  await start(page);
  await meBtn(page).click();
  await item(page, "自分の設定").click();
  await expect(page).toHaveURL(/\/account$/);
});

test("K844-UI-007 見た目：3 つ・今の値が選ばれている・「暗い」で data-theme dark と cookie k-theme・口は呼ばない", async ({
  page,
}) => {
  const mk = await start(page);
  await meBtn(page).click();
  await expect(menu(page).getByLabel("明るい", { exact: true })).toBeAttached();
  await expect(menu(page).getByLabel("PC に合わせる", { exact: true })).toBeAttached();
  await expect(menu(page).locator("input[type=radio]:checked")).toHaveCount(1);
  await menu(page).getByLabel("暗い", { exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "k-theme")?.value).toBe("dark");
  expect(mk.count("updateMe")).toBe(0);
});

test("K844-UI-008 「ログアウト」を押すとログアウトの口を 1 回呼び /login へ移る", async ({ page }) => {
  const other = await signupViaApi(WS_NAME);
  await start(page, { token: other.token });
  let outs = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/v1\/auth\/sign-out$/.test(new URL(r.url()).pathname)) outs += 1;
  });
  await meBtn(page).click();
  await item(page, "ログアウト").click();
  await expect(page).toHaveURL(/\/login/);
  expect(outs).toBe(1);
});

test("K844-UI-009 Esc で箱が閉じ、焦点が「自分のメニュー」に戻る", async ({ page }) => {
  await start(page);
  await meBtn(page).click();
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(meBtn(page)).toBeFocused();
});

test("K844-UI-010 閉じて開き直しても getMe は 1 回のまま", async ({ page }) => {
  const mk = await start(page);
  await meBtn(page).click();
  await expect(menu(page)).toContainText("株式会社ENGINE BASE ・ 営業");
  await page.keyboard.press("Escape");
  await meBtn(page).click();
  await expect(menu(page)).toContainText("株式会社ENGINE BASE ・ 営業");
  expect(mk.count("me")).toBe(1);
});

test("K844-UI-011 getMe が 503：箱は開き、名前は外枠の名前・2 行目は出さない・ログアウトは使える", async ({ page }) => {
  const mk = await start(page);
  mk.queue("me", err(503, "E-PAGE-003"));
  await meBtn(page).click();
  await expect(menu(page)).toBeVisible();
  await expect.poll(() => mk.count("me")).toBe(1);
  await expect(menu(page)).not.toContainText("株式会社ENGINE BASE ・ 営業");
  await expect(item(page, "ログアウト")).not.toHaveAttribute("aria-disabled", "true");
});

// ---------------------------------------------------------------- ワークスペースの切り替え
test("K844-UI-012 左上の ▾ は押せる引き金・開くと会社が答えの順に役割の字つき・今の会社に「いま開いている」の ✓ があり押す物でない", async ({
  page,
}) => {
  await start(page);
  await orgBtn(page).click();
  const lines = orgMenu(page).locator(".k-f10a-pop-line .k-f10a-grow");
  await expect(lines.nth(0)).toContainText("株式会社ENGINE BASE");
  await expect(lines.nth(0)).toContainText("管理者");
  await expect(lines.nth(1)).toContainText("高本 聖斗（個人）");
  await expect(lines.nth(1)).toContainText("自分だけ");
  await expect(lines.nth(2)).toContainText("京蟻システム株式会社");
  await expect(lines.nth(2)).toContainText("メンバー");
  const now = orgMenu(page).locator('[data-now=""]');
  await expect(now).toContainText("株式会社ENGINE BASE");
  await expect(now.getByLabel("いま開いている", { exact: true })).toBeVisible();
  await expect(now.getByRole("button")).toHaveCount(0);
});

test("K844-UI-013 ほかの会社の行を押すと switchWorkspace をその会社の id で 1 回・200 で /tickets を開き直す", async ({
  page,
}) => {
  const mk = await start(page, { path: "/approvals" });
  await orgBtn(page).click();
  await orgRow(page, "京蟻システム株式会社").click();
  await expect(page).toHaveURL(/\/tickets$/);
  expect(mk.sw.switches).toEqual([KYOTO_ID]);
});

test("K844-UI-014 切り替えで getMe が 503：今の会社の 1 行と「ワークスペースの一覧を読めませんでした」・［もう一度読む］で一覧が出る（getMe 2 回）", async ({
  page,
}) => {
  const mk = await start(page);
  mk.queue("me", err(503, "E-PAGE-003"));
  await orgBtn(page).click();
  await expect(orgMenu(page)).toContainText("ワークスペースの一覧を読めませんでした");
  await expect(orgMenu(page)).not.toContainText("京蟻システム株式会社");
  await orgMenu(page).getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(orgMenu(page)).toContainText("京蟻システム株式会社");
  expect(mk.count("me")).toBe(2);
});

// ---------------------------------------------------------------- 幅・どの画面でも・兼務
test("K844-UI-015 幅 375：上の帯の「自分のメニュー」から同じ箱が開き、画面の中に収まる", async ({ page }) => {
  await start(page, { width: 375 });
  await page.locator("header.k-bar").getByRole("button", { name: "自分のメニュー", exact: true }).click();
  await expect(item(page, "自分の設定")).toBeVisible();
  const b = (await menu(page).boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(375);
});

test("K844-UI-016 幅 320・375・768・1024・1440：箱を開いても横のはみ出し 0。100 字の名前・100 字の会社名でも 0", async ({
  page,
}) => {
  const base = me({ member: { name: "名".repeat(100) } });
  const long: Me = { ...base, workspaces: base.workspaces.map((w) => ({ ...w, name: "社".repeat(100) })) };
  for (const w of WIDTHS) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await start(page, { me: long, width: w });
    await meBtn(page).click();
    await expect(menu(page)).toBeVisible();
    // 開いた直後の 1 描画は、置き場がずらして収める前の位置（引き金の端）にある。収まるのを待ってから測る
    await expect.poll(() => overflowX(page), { message: `幅 ${w}` }).toBe(0);
    await page.keyboard.press("Escape");
  }
});

test("K844-UI-017 外枠を持つ画面 /tickets・/approvals・/account のどれでも同じメニューと押せる ▾ が出る", async ({
  page,
}) => {
  for (const path of ["/tickets", "/approvals", "/account"]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await start(page, { path });
    await meBtn(page).click();
    await expect(item(page, "自分の設定"), path).toBeVisible();
    await expect(item(page, "ログアウト"), path).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(orgBtn(page), path).toBeVisible();
  }
});

test("K844-UI-018 兼務の人（主 営業・兼務 経理）：2 行目は主のグループだけ「株式会社ENGINE BASE ・ 営業」", async ({
  page,
}) => {
  // getMe の workspaces[].group は主のグループだけを持つ（K-833）。兼務の経理は答えに無く、画面も足さない
  await start(page);
  await meBtn(page).click();
  await expect(menu(page)).toContainText("株式会社ENGINE BASE ・ 営業");
  await expect(menu(page)).not.toContainText("経理");
});

// ---------------------------------------------------------------- 切り替えの断り・届いた招待
test("K844-UI-019 切り替えが 404：箱の中に「そのワークスペースには入れません」・getMe を 1 回読み直してその会社の行が消える・道は変わらない", async ({
  page,
}) => {
  const mk = await start(page);
  await orgBtn(page).click();
  await expect(orgRow(page, "京蟻システム株式会社")).toBeVisible();
  mk.state.me = { ...mk.state.me, workspaces: mk.state.me.workspaces.filter((w) => w.tenant_id !== KYOTO_ID) };
  mk.sw.queue("switch", err(404, "E-PAGE-001"));
  const before = page.url();
  await orgRow(page, "京蟻システム株式会社").click();
  await expect(orgMenu(page)).toContainText("そのワークスペースには入れません");
  await expect(orgRow(page, "京蟻システム株式会社")).toHaveCount(0);
  expect(page.url()).toBe(before);
  expect(mk.count("me")).toBe(2);
});

test("K844-UI-020 切り替えが 503：箱の中に E-PAGE-003 の文・道は変わらない・もう一度押すと切り替わる（口 2 回）", async ({
  page,
}) => {
  const mk = await start(page, { path: "/approvals" });
  mk.sw.queue("switch", err(503, "E-PAGE-003"));
  await orgBtn(page).click();
  await orgRow(page, "京蟻システム株式会社").click();
  await expect(orgMenu(page)).toContainText("Kaname の調子が悪くなっています");
  await expect(page).toHaveURL(/\/approvals$/);
  await orgRow(page, "京蟻システム株式会社").click();
  await expect(page).toHaveURL(/\/tickets$/);
  expect(mk.sw.switches.length).toBe(2);
});

test("K844-UI-021 二度押し：答えを待つ間、ほかの行も押せず、続けて押しても切り替えの口は 1 回", async ({ page }) => {
  const mk = await start(page, { path: "/approvals" });
  const release = mk.sw.hold();
  await orgBtn(page).click();
  await orgRow(page, "京蟻システム株式会社").click();
  await orgRow(page, "京蟻システム株式会社").click({ force: true });
  await orgRow(page, "高本 聖斗（個人）").click({ force: true });
  release();
  await expect(page).toHaveURL(/\/tickets$/);
  expect(mk.sw.switches).toEqual([KYOTO_ID]);
});

test("K844-UI-022 届いた招待：開くと listMyInvitations を 1 回・2 件は「届いた招待 2 ›」・0 件は「届いた招待はありません」・どちらも押せない形・新しいワークスペースを作るも押せない形・「準備中」の字が無い", async ({
  page,
}) => {
  for (const [n, text] of [
    [2, "届いた招待 2 ›"],
    [0, "届いた招待はありません"],
  ] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const mk = await start(page, { invites: n });
    await orgBtn(page).click();
    const inv = orgRow(page, text);
    await expect(inv, text).toBeVisible();
    expect(mk.sw.invReads, text).toBe(1);
    const before = page.url();
    for (const row of [inv, orgRow(page, "新しいワークスペースを作る")]) {
      await expect(row).toHaveAttribute("aria-disabled", "true");
      await expect(row).toHaveAttribute("title", "まだ使えません");
      await row.click({ force: true });
      expect(page.url()).toBe(before);
    }
    expect(mk.sw.switches).toEqual([]);
    expect(await orgMenu(page).innerText()).not.toContain("準備中");
  }
});
