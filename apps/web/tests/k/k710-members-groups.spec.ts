// K-710「メンバーをグループごとに（グループを押すとメンバーが出る）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：メンバーの画面は段 11 の /dev/mock/f10（本番と同じ部品 features/F10/members。K-818 が F9 の GroupMembersBody を F10 の MembersPage に替えた・見た目の突き合わせは K818-UI-001）。メンバーの画面の入れ物・並びを読む・招くの小窓は段 9 の K-420 の物。
//   モックとの見た目の比べ方は K-818 の K818-UI-001（matchMock・/dev/mock/f10）に移した。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。メンバーの口（getWorkspaceMembers・createInvitations・K-419）だけを網の手前で差し替える。
//   口の答えの形は 11_tickets/K-419.md。本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。
//   K-420 の試験（k420-members-invite.spec.ts）の替え方は 11_tickets/K-710.md の「前からの試験を替えた所」。テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { BUILT_ROUTES } from "../../lib/built-routes";
import { loginAs, signupViaApi } from "../_lib/api";
import { mockSettings } from "./settings-mock";

const PATH = "/members";
const SEC = 'section[aria-labelledby="members-title"]';
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const uid = (n: number) => `0193c5a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const G_EG = uid(0xe001);
const G_JD = uid(0xe002);
const G_KR = uid(0xe003);

// ---------------------------------------------------------------- 口の答え（K-419 の形・名前はモックの見本と同じ）
interface Mem {
  id: string;
  name: string;
  email: string;
  role: string;
  group_role: string | null;
  primary: boolean;
  other_groups: string[];
  self: boolean;
  suspended: boolean;
  pc: "ok" | "away" | "never" | "none";
  pc_days_away: number | null;
}
const m = (o: Partial<Mem> & Pick<Mem, "id" | "name">): Mem => ({
  email: `${o.id}@engine-base.example`,
  role: "member",
  group_role: null,
  primary: true,
  other_groups: [],
  self: false,
  suspended: false,
  pc: "ok",
  pc_days_away: null,
  ...o,
});
const EG: Mem[] = [
  m({ id: "takamoto", name: "高本 聖斗", role: "admin", self: true }),
  m({ id: "sato", name: "佐藤 花子", role: "manager", group_role: "manager" }),
  m({ id: "suzuki", name: "鈴木 一郎", pc: "away", pc_days_away: 3 }),
  m({ id: "kimura", name: "木村 誠", pc: "none" }),
];
const JD: Mem[] = [
  m({ id: "tanaka", name: "田中 美咲", role: "manager", group_role: "manager" }),
  m({ id: "ito", name: "伊藤 健" }),
  m({ id: "watanabe", name: "渡辺 葵", pc: "none" }),
];
const KR: Mem[] = [
  m({ id: "yamaguchi", name: "山口 恵", role: "manager", group_role: "manager" }),
  m({ id: "ono", name: "小野 翔", pc: "none" }),
];
const INVITED = {
  id: "i1",
  email: "yoshida@engine-base.example",
  scope_id: G_EG,
  role: "member",
  expires_at: "2026-11-27T09:00:00Z",
  left_days: 5,
};
type Groups = { id: string; code: string | null; name: string; members: Mem[] }[];
const taka = (): Groups => [
  { id: G_EG, code: "EG", name: "営業", members: EG },
  { id: G_JD, code: "JD", name: "受託開発", members: JD },
  { id: G_KR, code: "KR", name: "経理", members: KR },
];
const reply = (groups: Groups, invited: (typeof INVITED)[]) => ({
  data: {
    groups,
    invitations: invited,
    alerts: [],
    count: new Set(groups.flatMap((g) => g.members.map((x) => x.id))).size + invited.length,
  },
});

interface MMock {
  reads: number;
  groups: Groups;
  invited: (typeof INVITED)[];
  posts: Record<string, unknown>[];
}
async function mockMembers(
  page: Page,
  groups: Groups = taka(),
  invited: (typeof INVITED)[] = [INVITED],
): Promise<MMock> {
  const mk: MMock = { reads: 0, groups, invited, posts: [] };
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/v1\/(workspace\/members|invitations(\/link)?)(\?|$)/, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() === "GET" && p.endsWith("/workspace/members")) {
      mk.reads++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(reply(mk.groups, mk.invited)),
      });
    }
    if (req.method() === "POST" && p.endsWith("/invitations")) {
      const b = req.postDataJSON() as Record<string, unknown>;
      mk.posts.push(b);
      mk.invited = [
        ...mk.invited,
        { ...INVITED, id: `n${mk.posts.length}`, email: String((b["emails"] as string[])[0]) },
      ];
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            invitations: (b["emails"] as string[]).map((e, i) => ({
              id: `n${i}`,
              email: e,
              expires_at: INVITED.expires_at,
              mail: "sent",
            })),
          },
        }),
      });
    }
    return route.fallback();
  });
  return mk;
}

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openMembers(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(PATH);
  await expect(page.locator(SEC).getByRole("heading", { name: "メンバー", level: 1 })).toBeVisible();
  await expect(page.locator(".k-f10m-group")).not.toHaveCount(0);
}
const head = (page: Page, name: string) => page.locator(".k-f10m-toggle").filter({ hasText: name });
const group = (page: Page, name: string) => page.locator(".k-f10m-group").filter({ has: head(page, name) });

// モックとの突き合わせ（旧 K710-UI-001）は、メンバーの画面の正の絵が /dev/mock/f10 に替わったので K-818 の K818-UI-001 が持つ（K-818・2026-11-23）。この番号は欠けたまま

// ---------------------------------------------------------------- 開く・並び
test("K710-UI-002 /members を開くと並びの口を 1 回だけ読み、見出し「メンバー」の下に「3 つのグループ ・ 9 人。グループを押すと、そのグループのメンバーが出ます」（9＝重ねない人数）・左の第 2 ナビ「メンバー」の札は口の count のまま（人＋招待中＝10）・左のバーの「ワークスペースの管理」が今の場所", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  await openMembers(page);
  expect(mk.reads).toBe(1);
  await expect(page.locator(`${SEC} .k-page-sub`)).toHaveText("グループごとに並ぶ。役割はその場で変えられる");
  await expect(page.locator(".k-inv-sub-count")).toHaveText("10");
  await expect(
    page.getByRole("navigation", { name: "メニュー", exact: true }).getByRole("link", { name: "ワークスペースの管理" }),
  ).toHaveAttribute("aria-current", "page");
});

test("K710-UI-003 グループの行：営業・受託開発・経理の順に 3 行・札 EG・JD・KR の色（teal・plum・amber）・人数（営業は「4 人 ＋ 招待中 1」・受託開発「3 人」・経理「2 人」）・マネージャーの行", async ({
  page,
}) => {
  await mockMembers(page);
  await openMembers(page);
  await expect(page.locator(".k-f10m-toggle")).toHaveCount(3);
  const want: [string, string, string, string, string][] = [
    ["営業", "EG", "teal", "4 人 ＋ 招待中 1", "マネージャー：佐藤 花子"],
    ["受託開発", "JD", "plum", "3 人", "マネージャー：田中 美咲"],
    ["経理", "KR", "amber", "2 人", "マネージャー：山口 恵"],
  ];
  for (const [name, code, tone, count, mgr] of want) {
    const h = head(page, name);
    await expect(h.locator(".k-inv-code")).toHaveText(code);
    await expect(h.locator(".k-inv-code")).toHaveAttribute("data-tone", tone);
    await expect(h.locator(".k-inv-sub").first()).toHaveText(count);
    await expect(h.locator(".k-f10m-manager")).toHaveText(mgr);
  }
});

test("K710-UI-004 初めは自分の主のグループ（営業）だけが開く：aria-expanded が営業だけ true・開いた中に 1 人 1 行（人 4 ＋ 招待中 1）・閉じたグループは人の行が画面に無い", async ({
  page,
}) => {
  await mockMembers(page);
  await openMembers(page);
  await expect(head(page, "営業")).toHaveAttribute("aria-expanded", "true");
  await expect(head(page, "受託開発")).toHaveAttribute("aria-expanded", "false");
  await expect(head(page, "経理")).toHaveAttribute("aria-expanded", "false");
  await expect(group(page, "営業").locator(".k-inv-row")).toHaveCount(5);
  await expect(group(page, "営業").locator(".k-inv-row").filter({ hasText: "高本 聖斗" })).toContainText("自分");
  await expect(
    group(page, "営業").locator(".k-inv-row").filter({ hasText: "yoshida@engine-base.example" }),
  ).toContainText("招待中");
  await expect(group(page, "受託開発").locator(".k-inv-row")).toHaveCount(0);
  await expect(page.locator(".k-inv-row")).toHaveCount(5);
});

test("K710-UI-005 グループの行を押すと開き（人の行が出て aria-expanded が true）、もう一度押すと閉じる・複数を同時に開ける・開き閉じで口は呼ばない（並びの口は 1 回のまま）", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  await openMembers(page);
  await head(page, "受託開発").click();
  await expect(head(page, "受託開発")).toHaveAttribute("aria-expanded", "true");
  await expect(group(page, "受託開発").locator(".k-inv-row")).toHaveCount(3);
  await expect(head(page, "営業")).toHaveAttribute("aria-expanded", "true");
  await head(page, "営業").click();
  await expect(group(page, "営業").locator(".k-inv-row")).toHaveCount(0);
  await head(page, "営業").click();
  await expect(group(page, "営業").locator(".k-inv-row")).toHaveCount(5);
  await head(page, "受託開発").click();
  await expect(group(page, "受託開発").locator(".k-inv-row")).toHaveCount(0);
  expect(mk.reads).toBe(1);
});

test("K710-UI-006 自分がどのグループにも主で入っていないときは、最初のグループ（営業）が開く（全部閉じたまま、にはしない）", async ({
  page,
}) => {
  const groups = taka();
  groups[0] = { ...groups[0]!, members: EG.map((x) => ({ ...x, self: false })) };
  await mockMembers(page, groups, []);
  await openMembers(page);
  await expect(head(page, "営業")).toHaveAttribute("aria-expanded", "true");
  await expect(head(page, "受託開発")).toHaveAttribute("aria-expanded", "false");
});

test("K710-UI-007 マネージャーがいないグループは「マネージャー：なし」・2 人いれば「・」でつなぐ・兼ねる人が別のグループのマネージャーでも、そのグループの行の group_role で決まる", async ({
  page,
}) => {
  const groups = taka();
  groups[1] = { ...groups[1]!, members: JD.map((x) => ({ ...x, group_role: null })) };
  groups[2] = {
    ...groups[2]!,
    members: [...KR, m({ id: "sato", name: "佐藤 花子", role: "manager", group_role: "manager", primary: false })],
  };
  await mockMembers(page, groups, []);
  await openMembers(page);
  await expect(head(page, "受託開発").locator(".k-f10m-manager")).toHaveText("マネージャー：なし");
  await expect(head(page, "経理").locator(".k-f10m-manager")).toHaveText("マネージャー：山口 恵・佐藤 花子");
});

test("K710-UI-008 人がいないグループは「0 人」で、開くと「このグループにはまだ人がいません」（仮）が出て人の行は無い", async ({
  page,
}) => {
  const groups = taka();
  groups[2] = { ...groups[2]!, members: [] };
  await mockMembers(page, groups, []);
  await openMembers(page);
  await expect(head(page, "経理").locator(".k-inv-sub").first()).toHaveText("0 人");
  await head(page, "経理").click();
  await expect(group(page, "経理").getByText("このグループにはまだ人がいません", { exact: true })).toBeVisible();
  await expect(group(page, "経理").locator(".k-inv-row")).toHaveCount(0);
});

// K710-UI-009（「＋ グループ」「＋ このグループに招く」が押せない形）は、K-805・K-809 が押せる形にするので、それぞれの試験（K805-UI-002・K809-UI-013）が持つ。この番号は欠けたまま

test("K710-UI-010 招いた後に並びを読み直しても開き閉じは変わらない（開いていた受託開発は開いたまま・初めの開き方に戻らない）・営業の招待中が「＋ 招待中 2」になる", async ({
  page,
}) => {
  const mk = await mockMembers(page);
  await openMembers(page);
  await head(page, "受託開発").click();
  await page.locator(SEC).getByRole("button", { name: "＋ 招く", exact: true }).click();
  const dlg = page.locator(".k-dialog");
  await dlg.getByLabel("メール").fill("nakamura@engine-base.example");
  await dlg.getByRole("button", { name: "足す" }).click();
  await dlg.getByRole("button", { name: /^(\d+ 人を)?招く$/ }).click();
  await expect(page.locator(".k-toast")).toContainText("招待を送りました");
  await expect.poll(() => mk.reads).toBe(2);
  await expect(head(page, "営業").locator(".k-inv-sub").first()).toHaveText("4 人 ＋ 招待中 2");
  await expect(head(page, "受託開発")).toHaveAttribute("aria-expanded", "true");
  await expect(group(page, "受託開発").locator(".k-inv-row")).toHaveCount(3);
});

test("K710-UI-011 キーボードだけ：グループの行に Tab で届き Enter でも Space でも開閉する・aria-controls は開いている間だけ在る人の一覧を指す・Tab を 30 回押しても焦点が画面の外へ出ない", async ({
  page,
}) => {
  await mockMembers(page);
  await openMembers(page);
  const h = head(page, "経理");
  await h.focus();
  await page.keyboard.press("Enter");
  await expect(h).toHaveAttribute("aria-expanded", "true");
  const id = await h.getAttribute("aria-controls");
  await expect(page.locator(`#${id}`)).toBeVisible();
  await page.keyboard.press("Space");
  await expect(h).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Space");
  await expect(h).toHaveAttribute("aria-expanded", "true");
  for (let i = 0; i < 30; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});

test("K710-UI-012 グループ名・マネージャーの名前に HTML が入っていても文字として出て動かない（img も作られない）", async ({
  page,
}) => {
  const groups = taka();
  groups[0] = {
    ...groups[0]!,
    name: '<img src=x onerror="window.__x=1">営業',
    members: EG.map((x) => (x.id === "sato" ? { ...x, name: "<b>佐藤</b>" } : x)),
  };
  await mockMembers(page, groups, []);
  await openMembers(page);
  await expect(page.locator(".k-f10m-toggle").first()).toContainText('<img src=x onerror="window.__x=1">営業');
  await expect(page.locator(".k-f10m-toggle").first().locator(".k-f10m-manager")).toHaveText(
    "マネージャー：<b>佐藤</b>",
  );
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator(`${SEC} img, ${SEC} b`).count()).toBe(0);
});

for (const w of WIDTHS) {
  test(`K710-UI-013 幅 ${w}：横のはみ出し 0（数値）・全部のグループを開いても 0・幅 767 以下はマネージャーの行が名前の行の下に折り返す`, async ({
    page,
  }) => {
    await mockMembers(page);
    await openMembers(page, w);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await head(page, "受託開発").click();
    await head(page, "経理").click();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    if (w <= 767) {
      const name = await head(page, "営業").locator(".k-inv-group-name").boundingBox();
      const mgr = await head(page, "営業").locator(".k-f10m-manager").boundingBox();
      expect(mgr!.y).toBeGreaterThan(name!.y + name!.height - 1);
    }
  });
}

test("K710-UI-014 口が 503 のときは K-420 のまま「メンバーを読み込めませんでした」と「もう一度読む」・「＋ 招く」は押せない・もう一度読むでグループの行が出る（グループの行に変えても失敗の出方は変わらない）", async ({
  page,
}) => {
  let n = 0;
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/v1\/workspace\/members(\?|$)/, (route) => {
    n++;
    if (n === 1)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "e-page-003", code: "E-PAGE-003" }),
      });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply(taka(), [])) });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto(PATH);
  await expect(page.getByText("メンバーを読み込めませんでした", { exact: false })).toBeVisible();
  await expect(page.locator(SEC).getByRole("button", { name: "＋ 招く", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.locator(".k-f10m-toggle")).toHaveCount(3);
  expect(n).toBe(2);
});

test("K710-UI-015 左のバーの「ワークスペースの管理」の第 2 ナビ：「チケットの設定」が押せるリンク（道 /workspace/ticket-settings・「決まり」の字は無い）・メンバーが今の場所の印・「記録」「設定」は押せない形のまま・押すとチケットの設定の画面に移り、そこでは「チケットの設定」が今の場所の印", async ({
  page,
}) => {
  await mockSettings(page);
  await mockMembers(page);
  await openMembers(page);
  const sub = page.locator('aside[aria-label="ワークスペースの管理の中"]');
  await expect(sub.getByText("決まり", { exact: true })).toHaveCount(0);
  await expect(sub.getByRole("link", { name: /^メンバー/ })).toHaveAttribute("aria-current", "page");
  const ts = sub.getByRole("link", { name: /^チケットの設定/ });
  await expect(ts).toHaveAttribute("href", "/workspace/ticket-settings");
  await expect(ts).not.toHaveAttribute("aria-disabled", "true");
  const built: Record<string, string> = { 記録: "/audit", 設定: "/settings/company" };
  for (const n of ["記録", "設定"]) {
    const it = sub.locator(".k-me-sub-i").filter({ hasText: new RegExp(`^\\s*${n}\\s*$`) });
    if (BUILT_ROUTES.includes(built[n]!)) await expect(it).not.toHaveAttribute("aria-disabled", "true");
    else await expect(it).toHaveAttribute("aria-disabled", "true");
  }
  await ts.click();
  await expect(page).toHaveURL(/\/workspace\/ticket-settings$/);
  await expect(
    page.locator('aside[aria-label="ワークスペースの管理の中"]').getByRole("link", { name: /^チケットの設定/ }),
  ).toHaveAttribute("aria-current", "page");
});
