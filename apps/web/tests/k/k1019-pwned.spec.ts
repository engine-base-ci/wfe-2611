// K-1019「照合が使えなかった登録の帯と小窓（/ops の一覧の上）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops/op-list-pwned・op-pwned（この葉が持ち主）。部品は features/F12/ops/views-list.tsx の
//   WsListPage（pwned・onPwned）と PwnedDialog（K-941 が運ぶ）。入れ物は K-965 の ws-list-screen.tsx。
//   呼ぶ口：getOpsShell（帯の数 pwned.unchecked・K-965 の外枠と同じ鍵）・listOpsPwned（小窓を開いたときだけ）・ackOpsPwned（確かめた）。
//   運営の口は網の手前で差し替える（K-965 の ops-mock.ts に、この葉の 2 本を後から重ねる。後から足した route が先に効く）。
//   代表の答え 2026-11-23（D-156.35）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-1019.md と 1 対 1
import { expect, test, type Page, type Route } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, signInOps, shellOf, uid, type OpsMock } from "./ops-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
const BAND_PAIRS: FidelityPair[] = [
  pair("band", ".k-band", [...BOX, "texts"]),
  pair("bandbtn", ".k-band button", ["width", "height", "x", "y", "color", "texts"]),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
];
const DIALOG_PAIRS: FidelityPair[] = [
  pair("dialog", "[role='dialog']", BOX),
  pair("dtitle", "[role='dialog'] h2", ["x", "y", ...TEXT]),
  pair("ddesc", "[role='dialog'] p", ["x", ...TEXT]),
  pair("table", "[role='dialog'] .k-f12-rt-table", [...BOX, "texts"]),
  pair("card", "[role='dialog'] .k-f12-rt-card", [...BOX, "texts"]),
];
const BAND_TEXT = (n: number) => `パスワードの照合が使えなかった登録が ${n} 件あります`;
const DIALOG = "パスワードの照合が使えなかった登録";
/** 下絵（ops-sample.ts の PWNED_ROWS）と同じ字になる答え（日本時間 11/01 14:22・11/01 09:05・10/31 18:47） */
const PWNED_A = [
  {
    workspace: { id: uid(901), name: "山田工務店" },
    member: { id: uid(911), name: "山田 健二" },
    last_at: "2026-11-01T05:22:00.000Z",
    count: 1,
  },
  {
    workspace: { id: uid(902), name: "佐々木 恵" },
    member: { id: uid(912), name: "佐々木 恵" },
    last_at: "2026-11-01T00:05:00.000Z",
    count: 2,
  },
  {
    workspace: { id: uid(903), name: "北村デザイン事務所" },
    member: { id: uid(913), name: "北村 透" },
    last_at: "2026-10-31T09:47:00.000Z",
    count: 1,
  },
  /** 登録を確定しないまま去った申し込み（まとめて 1 行・workspace と member は null・K-1110・D-156.69） */
  { workspace: null, member: null, last_at: "2026-10-30T13:14:00.000Z", count: 3 },
];
/** 確定前の 1 行の［確かめた］が呼ぶ口の道の区切り（/api/v1/ops/pwned/pending/ack の 5 番目） */
const PENDING = "pending";
type Reply = { status: number; body: unknown } | "abort";
interface PwnedMock extends OpsMock {
  pwned: { list: () => Reply; ack: (tenant: string) => Reply; acks: string[]; lists: number };
}

/** K-965 の差し替えに、回収の 2 本を重ねる */
async function mockPwned(page: Page, unchecked = 4): Promise<PwnedMock> {
  const base = await mockOps(page);
  base.on.shell = () => ({ status: 200, body: { data: shellOf({ pwned: { unchecked } }) } });
  const rows: (typeof PWNED_A)[number][] = [...PWNED_A];
  const m = base as PwnedMock;
  m.pwned = {
    acks: [],
    lists: 0,
    list: () => ({ status: 200, body: { data: rows } }),
    ack: (tenant) => {
      const i = rows.findIndex((r) => (r.workspace?.id ?? PENDING) === tenant);
      if (i >= 0) rows.splice(i, 1);
      return { status: 200, body: { data: { acknowledged_at: new Date().toISOString(), remaining: rows.length } } };
    },
  };
  await page.route(
    /\/api\/v1\/ops\/(pwned|pwned\/pending\/ack|workspaces\/[^/]+\/pwned\/ack)(\?.*)?$/,
    async (route: Route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fallback();
      const p = new URL(req.url()).pathname;
      let r: Reply;
      if (p === "/api/v1/ops/pwned" && req.method() === "GET") {
        m.pwned.lists += 1;
        r = m.pwned.list();
      } else {
        const tenant = p.split("/")[5]!;
        m.pwned.acks.push(tenant);
        r = m.pwned.ack(tenant);
      }
      if (r === "abort") return route.abort("failed");
      await route.fulfill({
        status: r.status,
        headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
        contentType: "application/json",
        body: JSON.stringify(r.body),
      });
    },
  );
  return m;
}
async function open(page: Page, baseURL: string | undefined, unchecked = 4, width = 1440): Promise<PwnedMock> {
  const m = await mockPwned(page, unchecked);
  await signInOps(page, local(baseURL), "/ops", width);
  await expect(page.locator(".k-page-head h1")).toHaveText("ワークスペース");
  return m;
}
const dialog = (page: Page) => page.getByRole("dialog", { name: DIALOG, exact: true });
const openDialog = async (page: Page) => {
  await page.locator(".k-band").getByRole("button", { name: "見る", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
};
const ackBtn = (page: Page, ws: string, person: string) =>
  dialog(page).getByRole("button", { name: `${ws} の ${person} さんを確かめた`, exact: true });

test.describe("K-1019 帯と小窓の見た目", () => {
  for (const w of MATCH_WIDTHS)
    test(`K1019-UI-001 帯がモック op-list-pwned と同じ（幅 ${w}・「パスワードの照合が使えなかった登録が 4 件あります」と「見る」）`, async ({
      browser,
      baseURL,
    }) => {
      const { bad } = await matchMock(
        browser,
        "op-list-pwned",
        w,
        async (page) => void (await open(page, baseURL, 4, w)),
        {
          base: "/dev/mock/f12-ops",
          pairs: BAND_PAIRS,
        },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });

  for (const w of MATCH_WIDTHS)
    test(`K1019-UI-002 小窓がモック op-pwned と同じ（幅 ${w}・日時・ワークスペース・人・確かめた。狭い幅は縦の組）`, async ({
      browser,
      baseURL,
    }) => {
      const { bad } = await matchMock(
        browser,
        "op-pwned",
        w,
        async (page) => {
          await open(page, baseURL, 4, w);
          await openDialog(page);
          await expect(dialog(page).getByText("山田 健二", { exact: true }).first()).toBeVisible();
        },
        { base: "/dev/mock/f12-ops", pairs: DIALOG_PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
});

test.describe("K-1019 帯と小窓の動き", () => {
  test("K1019-UI-003 数が 0 なら帯を出さない。開いただけでは一覧の口（listOpsPwned）を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, 0);
    await expect(page.locator(".k-band").filter({ hasText: "パスワードの照合" })).toHaveCount(0);
    expect(m.pwned.lists).toBe(0);
  });

  test("K1019-UI-004 帯の「見る」で小窓が開き、一覧の口を 1 回呼ぶ。行は 日時（日本時間 MM/DD HH:mm）・ワークスペース・人の 3 行", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await expect(page.locator(".k-band")).toContainText(BAND_TEXT(4));
    await openDialog(page);
    for (const t of [
      "11/01 14:22",
      "山田工務店",
      "山田 健二",
      "11/01 09:05",
      "佐々木 恵",
      "10/31 18:47",
      "北村 透",
      "10/30 22:14",
      "（登録はまだ確定していません）",
    ])
      await expect(dialog(page).getByText(t, { exact: true }).first()).toBeVisible();
    expect(m.pwned.lists).toBe(1);
  });

  test("K1019-UI-005 「確かめた」でその会社の口を 1 回呼び、その行が消え、帯の数が答えの remaining になる。最後の 1 社で帯が消えて小窓が閉じる", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await openDialog(page);
    await ackBtn(page, "山田工務店", "山田 健二").click();
    await expect(dialog(page).getByText("山田 健二", { exact: true })).toHaveCount(0);
    expect(m.pwned.acks).toEqual([uid(901)]);
    await expect(page.locator(".k-band")).toContainText(BAND_TEXT(3));
    await ackBtn(page, "佐々木 恵", "佐々木 恵").click();
    await ackBtn(page, "北村デザイン事務所", "北村 透").click();
    await dialog(page).getByRole("button", { name: "（登録はまだ確定していません） を確かめた", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator(".k-band").filter({ hasText: "パスワードの照合" })).toHaveCount(0);
    expect(m.pwned.acks).toEqual([uid(901), uid(902), uid(903), PENDING]);
  });

  test("K1019-UI-012 確定前の 1 行（workspace・member が null・K-1110）：「（登録はまだ確定していません）」と人「—」・［確かめた］はまとめて確かめる口（POST /api/v1/ops/pwned/pending/ack）を 1 回・その行が消える・帯は答えの remaining", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await openDialog(page);
    const row = dialog(page).getByText("（登録はまだ確定していません）", { exact: true }).first();
    await expect(row).toBeVisible();
    await dialog(page).getByRole("button", { name: "（登録はまだ確定していません） を確かめた", exact: true }).click();
    await expect(dialog(page).getByText("（登録はまだ確定していません）", { exact: true })).toHaveCount(0);
    expect(m.pwned.acks).toEqual([PENDING]);
    await expect(page.locator(".k-band")).toContainText(BAND_TEXT(3));
  });

  test("K1019-UI-006 もう確かめてあった（409 E-OPS-026）：小窓に「この登録はもう確かめてあります」を出し、一覧を読み直す（2 回目の一覧の口）", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.pwned.ack = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-026" } });
    await openDialog(page);
    await ackBtn(page, "山田工務店", "山田 健二").click();
    await expect(dialog(page).getByText("この登録はもう確かめてあります", { exact: true })).toBeVisible();
    await expect.poll(() => m.pwned.lists).toBe(2);
  });

  test("K1019-UI-007 確かめたを書けない（503・網の切れ）：小窓に E-PAGE-003 の字を出し、行は残り、もう一度押せる", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.pwned.ack = () => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    await openDialog(page);
    await ackBtn(page, "山田工務店", "山田 健二").click();
    await expect(dialog(page).getByRole("alert")).toBeVisible();
    await expect(ackBtn(page, "山田工務店", "山田 健二")).toBeEnabled();
    m.pwned.ack = () => "abort";
    await ackBtn(page, "山田工務店", "山田 健二").click();
    await expect(dialog(page).getByRole("alert")).toBeVisible();
    expect(m.pwned.acks).toEqual([uid(901), uid(901)]);
  });

  test("K1019-UI-008 一覧が読めない（503）：小窓の本文は読めなかった旨（E-PAGE-007）と「もう一度」。押すと読み直して 3 行が出る", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    const ok = m.pwned.list;
    m.pwned.list = () => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    await openDialog(page);
    const again = dialog(page).getByRole("button", { name: "もう一度", exact: true });
    await expect(again).toBeVisible();
    m.pwned.list = ok;
    await again.click();
    await expect(dialog(page).getByText("山田 健二", { exact: true }).first()).toBeVisible();
    expect(m.pwned.lists).toBe(2);
  });

  test("K1019-UI-009 人が引けない行（member が null）は人の欄を「—」にし、ボタンの名前は「<ワークスペース> を確かめた」", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, 1);
    m.pwned.list = () => ({ status: 200, body: { data: [{ ...PWNED_A[0]!, member: null }] } });
    await openDialog(page);
    await expect(dialog(page).getByText("—", { exact: true }).first()).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "山田工務店 を確かめた", exact: true })).toBeVisible();
  });

  test("K1019-UI-010 閉じる（Esc）で小窓が閉じ、帯は残る。幅 375 で横に溢れない。設計の言葉・内部 ID を出さない", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL, 4, 375);
    await openDialog(page);
    expect(await overflowX(page)).toBe(0);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toContain("pwned");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator(".k-band")).toContainText(BAND_TEXT(4));
  });

  test("K1019-UI-011 字の守り：HTML の入ったワークスペースと人の名前が字のまま出て、スクリプトが動かない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, 1);
    const evil = '<img src=x onerror="window.__k1019=1">悪い名前';
    m.pwned.list = () => ({
      status: 200,
      body: {
        data: [{ ...PWNED_A[0]!, workspace: { id: uid(901), name: evil }, member: { id: uid(911), name: evil } }],
      },
    });
    await openDialog(page);
    await expect(dialog(page).getByText(evil, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __k1019?: number }).__k1019)).toBeUndefined();
  });
});
