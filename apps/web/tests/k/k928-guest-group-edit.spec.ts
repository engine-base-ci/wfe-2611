// K-928「ゲストのタブのグループの行の「⋯」から、名前を直す小窓と消す確かめを押せる形にして口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f11/mb-group-menu・mb-group-rename・mb-group-rename-dup・mb-group-delete（本番と同じ部品 features/F10/invite/guest-group-views.tsx・代表の答え answer=695325c0630f・6ba09f587792）。
//   ログイン・外枠は本物（signupViaApi・loginAs）。メンバーの口 getWorkspaceMembers・ゲストのグループの口 listGuestGroups（K-876）・
//   名前を直す updateGuestGroup（PATCH /guest-groups/:id・200 { data: { id, name } }）・消す deleteGuestGroup（DELETE /guest-groups/:id・200 { data: { id } }）（K-927 の確定）だけを網の手前で差し替える。
//   口の答えの形は 11_tickets/K-876.md・K-927.md の確定。本人の Bridge（127.0.0.1:38617）には届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { ROOT } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const SEC = 'section[aria-labelledby="members-title"]';
const DLG = ".k-dialog";
const G_SALES = "0193c5a0-0000-7000-8000-00000000e001";
const GG_SEIKO = "0193c5a0-0000-7000-8000-00000000f001";
const GG_KYOGI = "0193c5a0-0000-7000-8000-00000000f002";
const SEIKO = "セイコー株式会社（ゲスト）";
const KYOGI = "京蟻システム株式会社（ゲスト）";
const DUP_TEXT = "同じ名前のゲストのグループがあります。別の名前にしてください";

interface Reply {
  status: number;
  body: unknown;
}
const err = (status: number, code: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, details: [] },
});
/** listGuestGroups の確定の答えの形（11_tickets/K-876.md の K876-API-024・025）。止めているゲストは suspended が true（人数には数える） */
interface Grp {
  id: string;
  name: string;
  request_scope: { id: string; name: string } | null;
  guests: { id: string; name: string; email: string; suspended: boolean }[];
  invitations: { id: string; email: string; left_days: number }[];
}
const groups = (): Grp[] => [
  {
    id: GG_SEIKO,
    name: SEIKO,
    request_scope: { id: G_SALES, name: "営業" },
    guests: [
      { id: "g1", name: "山田 花子", email: "yamada@seiko.example", suspended: false },
      { id: "g2", name: "鈴木 健太", email: "suzuki@seiko.example", suspended: false },
    ],
    invitations: [{ id: "gi1", email: "tamura@seiko.example", left_days: 6 }],
  },
  {
    id: GG_KYOGI,
    name: KYOGI,
    request_scope: { id: G_SALES, name: "営業" },
    guests: [{ id: "g4", name: "大橋 誠", email: "ohashi@kyogi.example", suspended: false }],
    invitations: [],
  },
];
interface EMock {
  groups: Grp[];
  guestReads: number;
  patches: { id: string; body: Record<string, unknown> }[];
  deletes: string[];
  on: { patch: (id: string, b: Record<string, unknown>) => Reply; del: (id: string) => Reply };
  hold: () => () => void;
  gate: Promise<void>;
}
async function mockEdit(page: Page): Promise<EMock> {
  const mk: EMock = {
    groups: groups(),
    guestReads: 0,
    patches: [],
    deletes: [],
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      mk.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      patch: (id, b) => {
        const g = mk.groups.find((x) => x.id === id);
        if (g) g.name = String(b["name"]);
        return { status: 200, body: { data: { id, name: b["name"] } } };
      },
      del: (id) => {
        mk.groups = mk.groups.filter((x) => x.id !== id);
        return { status: 200, body: { data: { id } } };
      },
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(
    /\/api\/v1\/(workspace\/members|guest-groups(\/[^/?]+)?)(\?|$)/,
    async (route: Route, req: Request) => {
      const p = new URL(req.url()).pathname;
      const id = p.split("/").pop()!;
      let reply: Reply;
      if (req.method() === "GET" && p.endsWith("/workspace/members"))
        reply = {
          status: 200,
          body: {
            data: {
              groups: [{ id: G_SALES, code: "EG", name: "営業", members: [] }],
              invitations: [],
              alerts: [],
              count: 0,
            },
          },
        };
      else if (req.method() === "GET") {
        mk.guestReads++;
        reply = { status: 200, body: { data: { groups: mk.groups } } };
      } else if (req.method() === "PATCH") {
        const b = req.postDataJSON() as Record<string, unknown>;
        mk.patches.push({ id, body: b });
        await mk.gate;
        reply = mk.on.patch(id, b);
      } else if (req.method() === "DELETE") {
        mk.deletes.push(id);
        await mk.gate;
        reply = mk.on.del(id);
      } else return route.fallback();
      await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
    },
  );
  return mk;
}
async function openGuests(page: Page, token: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, token);
  await page.goto("/members?tab=guests");
  await expect(page.locator(SEC).getByRole("heading", { name: "ゲスト", level: 1, exact: true })).toBeVisible();
  await expect(page.locator(".k-inv-group")).toHaveCount(2);
}
const row = (page: Page, name: string) => page.locator(".k-inv-group").filter({ hasText: name });
const more = (page: Page, name: string) =>
  row(page, name).getByRole("button", { name: `${name}のほかの操作`, exact: true });
async function menu(page: Page, name: string, item: "名前を直す" | "消す"): Promise<void> {
  await more(page, name).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

// ---------------------------------------------------------------- モックと本番の突き合わせ
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
const PAIRS = (
  [
    ["more", ".k-inv-group-head [aria-haspopup='menu']", CTRL],
    ["menu", ".k-select-popup", ["width", "background-color", "border-top-left-radius"]],
    ["menu-item", ".k-select-popup [role='menuitem']", [...TEXT, "height"]],
    ["dialog", DLG, ["width", "x", "y", "background-color", "border-top-left-radius"]],
    ["dialog-title", `${DLG} h2`, ["x", "y", ...TEXT]],
    ["dialog-label", `${DLG} .k-label`, TEXT],
    ["dialog-err", `${DLG} .k-err`, TEXT],
    ["dialog-btn", `${DLG} button[data-variant]`, ["x", "y", ...CTRL]],
    ["confirm", "[role='alertdialog']", ["width", "x", "y", "background-color", "border-top-left-radius"]],
    ["confirm-btn", "[role='alertdialog'] button", ["x", "y", ...CTRL]],
  ] as const
).map(([role, sel, props]) => ({ name: role, role, canvas: sel, app: sel, props: [...props] }));
const STATES: Record<string, (page: Page, mk: EMock) => Promise<void>> = {
  "mb-group-menu": async (page) => {
    await more(page, SEIKO).click();
    await expect(page.getByRole("menuitem", { name: "名前を直す", exact: true })).toBeVisible();
  },
  "mb-group-rename": async (page) => {
    await menu(page, SEIKO, "名前を直す");
    await page.getByLabel("名前 必須", { exact: true }).fill("セイコー（ゲスト）");
  },
  "mb-group-rename-dup": async (page, mk) => {
    mk.on.patch = () => err(409, "E-GST-002");
    await menu(page, SEIKO, "名前を直す");
    await page.getByLabel("名前 必須", { exact: true }).fill(KYOGI);
    await page.getByRole("button", { name: "直す", exact: true }).click();
    await expect(page.locator(`${DLG} .k-err`)).toHaveText(DUP_TEXT);
  },
  "mb-group-delete": async (page) => {
    await menu(page, SEIKO, "消す");
    await expect(page.getByRole("alertdialog")).toBeVisible();
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K928-UI-001 ${id} 幅 ${w}：「⋯」のメニュー・小窓・確かめの位置と大きさと字がモックと合う`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await mockEdit(page);
          await openGuests(page, owner.token, w);
          await drive(page, mk);
        },
        { pairs: PAIRS, base: "/dev/mock/f11", blur: true },
      );
      expect(rows.length, "比べた役がある").toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 名前を直す
test("K928-UI-002 「⋯」は押せる形になり、メニューは「名前を直す」「消す」の 2 つ（どちらも押せる）・キーボードで開いて Esc で閉じ、焦点は「⋯」に戻る", async ({
  page,
}) => {
  await mockEdit(page);
  await openGuests(page, owner.token);
  const b = more(page, SEIKO);
  await b.focus();
  await page.keyboard.press("Enter");
  for (const name of ["名前を直す", "消す"])
    await expect(page.getByRole("menuitem", { name, exact: true })).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem")).toHaveCount(0);
  await expect(b).toBeFocused();
});

test("K928-UI-003 名前を直す小窓：今の名前が入って開き、直して「直す」を押すと口へ name（前後の空白を取った字）・小窓が閉じ・知らせ・一覧の名前が替わる・中の人と届け先はそのまま", async ({
  page,
}) => {
  const mk = await mockEdit(page);
  await openGuests(page, owner.token);
  await menu(page, SEIKO, "名前を直す");
  await expect(page.getByRole("heading", { name: "ゲストのグループの名前を直す", exact: true })).toBeVisible();
  await expect(page.getByLabel("名前 必須", { exact: true })).toHaveValue(SEIKO);
  await expect(page.locator(DLG)).toContainText("直しても、中のゲストと見せているチケットはそのまま");
  await page.getByLabel("名前 必須", { exact: true }).fill("\u3000セイコー（ゲスト） ");
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(page.locator(".k-toast").filter({ hasText: "ゲストのグループの名前を直しました" })).toBeVisible();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.patches).toEqual([{ id: GG_SEIKO, body: { name: "セイコー（ゲスト）" } }]);
  const g = row(page, "セイコー（ゲスト）");
  await expect(g).toContainText("2 人 ＋ 招待中 1");
  await expect(g).toContainText("依頼は 営業 に届く");
  expect(mk.guestReads, "直した後に 1 回だけ読み直す").toBe(2);
});

test("K928-UI-004 名前を変えずに「直す」・名前が空：変えないときは口を呼ばずに閉じる／空・空白だけは口を呼ばず欄の下に「名前を入れてください」", async ({
  page,
}) => {
  const mk = await mockEdit(page);
  await openGuests(page, owner.token);
  await menu(page, SEIKO, "名前を直す");
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.patches).toHaveLength(0);
  await menu(page, SEIKO, "名前を直す");
  await page.getByLabel("名前 必須", { exact: true }).fill("\u3000 ");
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(page.locator(`${DLG} .k-err`)).toContainText("名前を入れてください");
  expect(mk.patches).toHaveLength(0);
});

test("K928-UI-005 同じ名前（409・E-GST-002）：欄の下に「同じ名前のゲストのグループがあります。別の名前にしてください」・小窓は閉じず入れた値が残る・一覧の名前は替わらない。表記ゆらぎの違いだけ（全角半角・空白）でも口の答えのとおり同じ名前として断る", async ({
  page,
}) => {
  const mk = await mockEdit(page);
  mk.on.patch = () => err(409, "E-GST-002");
  await openGuests(page, owner.token);
  await menu(page, SEIKO, "名前を直す");
  await page.getByLabel("名前 必須", { exact: true }).fill("京蟻システム株式会社 （ゲスト）");
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(page.locator(`${DLG} .k-err`)).toHaveText(DUP_TEXT);
  await expect(page.getByLabel("名前 必須", { exact: true })).toHaveValue("京蟻システム株式会社 （ゲスト）");
  await expect(row(page, SEIKO)).toHaveCount(1);
});

test("K928-UI-006 二度押し：答えを止めたまま「直す」を 2 回押しても口は 1 回・直している間は「やめる」も押せない", async ({
  page,
}) => {
  const mk = await mockEdit(page);
  await openGuests(page, owner.token);
  await menu(page, SEIKO, "名前を直す");
  await page.getByLabel("名前 必須", { exact: true }).fill("セイコー（ゲスト）");
  const release = mk.hold();
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(page.getByRole("button", { name: "やめる", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "直す", exact: true }).click({ force: true });
  expect(mk.patches).toHaveLength(1);
  release();
  await expect(page.locator(".k-toast").filter({ hasText: "名前を直しました" })).toBeVisible();
});

test("K928-UI-007 直せなかった：もう消えていた（404・E-GST-001）は「このゲストのグループは見つかりません」・小窓は閉じて一覧を読み直し、そのグループが無くなる／503 は小窓の赤の知らせで入れた値が残り、押し直せる", async ({
  page,
}) => {
  const mk = await mockEdit(page);
  await openGuests(page, owner.token);
  mk.on.patch = () => err(503, "E-PAGE-003");
  await menu(page, SEIKO, "名前を直す");
  await page.getByLabel("名前 必須", { exact: true }).fill("セイコー（ゲスト）");
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(page.locator(`${DLG} [role='alert']`)).toBeVisible();
  await expect(page.getByLabel("名前 必須", { exact: true })).toHaveValue("セイコー（ゲスト）");
  mk.groups = mk.groups.filter((g) => g.id !== GG_SEIKO);
  mk.on.patch = () => err(404, "E-GST-001");
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(page.locator(".k-toast").filter({ hasText: "このゲストのグループは見つかりません" })).toBeVisible();
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(page.locator(".k-inv-group")).toHaveCount(1);
});

// ---------------------------------------------------------------- 消す
test("K928-UI-008 消す確かめ：「ゲストのグループ「セイコー株式会社（ゲスト）」を消しますか」・中のゲストの数（2 人・招待中 1）・「消すと、中のゲストは入れなくなります。」「見せていたチケットから外れます。チケットは残ります。」・焦点は「やめる」・やめると口を呼ばない", async ({
  page,
}) => {
  const mk = await mockEdit(page);
  await openGuests(page, owner.token);
  await menu(page, SEIKO, "消す");
  const d = page.getByRole("alertdialog");
  await expect(d).toContainText(`ゲストのグループ「${SEIKO}」を消しますか`);
  await expect(d).toContainText("中のゲスト（2 人・招待中 1）");
  await expect(d).toContainText("消すと、中のゲストは入れなくなります。");
  await expect(d).toContainText("見せていたチケットから外れます。チケットは残ります。");
  await expect(d).toContainText("消したあとは元に戻せません");
  await expect(d.getByRole("button", { name: "やめる", exact: true })).toBeFocused();
  await d.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(mk.deletes).toHaveLength(0);
});

test("K928-UI-009 消す：「消す」を押すと口へ DELETE（そのグループの id だけ）・確かめが閉じ・知らせ「ゲストのグループ「…」を消しました」・一覧からそのグループが消えて 1 つになり・タブの数が減る・もう一方のグループはそのまま", async ({
  page,
}) => {
  const mk = await mockEdit(page);
  await openGuests(page, owner.token);
  await menu(page, SEIKO, "消す");
  await page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true }).click();
  await expect(page.locator(".k-toast").filter({ hasText: `ゲストのグループ「${SEIKO}」を消しました` })).toBeVisible();
  expect(mk.deletes).toEqual([GG_SEIKO]);
  await expect(page.locator(".k-inv-group")).toHaveCount(1);
  await expect(row(page, KYOGI)).toContainText("1 人");
  await expect(
    page
      .getByRole("navigation", { name: "メンバーとゲスト", exact: true })
      .getByRole("link", { name: "ゲスト 1", exact: true }),
  ).toBeVisible();
});

test("K928-UI-010 消せなかった：503 は確かめを閉じずに赤の知らせ・グループは一覧に残り押し直せる／もう消えていた（404・E-GST-001）は知らせの後に一覧を読み直して消える／ゲストが 1 人もいないグループは「中のゲスト」の行を出さない", async ({
  page,
}) => {
  const mk = await mockEdit(page);
  await openGuests(page, owner.token);
  mk.on.del = () => err(503, "E-PAGE-003");
  await menu(page, SEIKO, "消す");
  await page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true }).click();
  await expect(page.getByRole("alertdialog").locator("[role='alert']")).toBeVisible();
  await expect(row(page, SEIKO)).toHaveCount(1);
  mk.groups = mk.groups.filter((g) => g.id !== GG_SEIKO);
  mk.on.del = () => err(404, "E-GST-001");
  await page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true }).click();
  await expect(page.locator(".k-toast").filter({ hasText: "このゲストのグループは見つかりません" })).toBeVisible();
  await expect(page.locator(".k-inv-group")).toHaveCount(1);
  mk.groups[0]!.guests = [];
  mk.groups[0]!.invitations = [];
  await page.reload();
  await menu(page, KYOGI, "消す");
  await expect(page.getByRole("alertdialog")).not.toContainText("中のゲスト（");
});

test("K928-UI-011 二度押し：答えを止めたまま「消す」を 2 回押しても口は 1 回", async ({ page }) => {
  const mk = await mockEdit(page);
  await openGuests(page, owner.token);
  await menu(page, SEIKO, "消す");
  const release = mk.hold();
  const go = page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true });
  await go.click();
  await go.click({ force: true });
  expect(mk.deletes).toHaveLength(1);
  release();
  await expect(page.locator(".k-toast").filter({ hasText: "を消しました" })).toBeVisible();
});

test("K928-UI-012 幅 320・375・768・1024・1440：「⋯」のメニュー・名前を直す小窓・消す確かめで横のはみ出し 0・小窓の足は画面の中", async ({
  page,
}) => {
  await mockEdit(page);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openGuests(page, owner.token, w);
    await menu(page, SEIKO, "名前を直す");
    const box = await page.locator(DLG).boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.x + box!.width, `幅 ${w}`).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height, `幅 ${w}`).toBeLessThanOrEqual(vp.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `幅 ${w}`,
    ).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "やめる", exact: true }).click();
    await menu(page, SEIKO, "消す");
    const c = await page.getByRole("alertdialog").boundingBox();
    expect(c!.x + c!.width, `確かめ 幅 ${w}`).toBeLessThanOrEqual(vp.width);
    await page.getByRole("alertdialog").getByRole("button", { name: "やめる", exact: true }).click();
  }
});

test("K928-UI-013 モックの持ち主：mocks.tsx で K-928 の状態はちょうど 4（mb-group-menu・mb-group-rename・mb-group-rename-dup・mb-group-delete）で、頭の mock: と同じ。「取引先」の字が小窓に無い", async ({
  page,
}) => {
  const src = readFileSync(join(ROOT, "apps/web/app/(dev)/dev/mock/f11/mocks.tsx"), "utf8");
  const mine = [...src.matchAll(/id:\s*"([^"]+)"[\s\S]*?ticket:\s*"(K-\d+)"/g)]
    .filter((m) => m[2] === "K-928")
    .map((m) => m[1]);
  expect(mine.sort()).toEqual(["mb-group-delete", "mb-group-menu", "mb-group-rename", "mb-group-rename-dup"]);
  const head = readFileSync(join(ROOT, "11_tickets/K-928.md"), "utf8")
    .match(/^mock:\s*\[(.*)\]$/m)![1]!
    .split(",")
    .map((s) => s.trim());
  expect(head.sort()).toEqual(mine.sort());
  await mockEdit(page);
  await openGuests(page, owner.token);
  await menu(page, SEIKO, "名前を直す");
  await expect(page.locator("body")).not.toContainText("取引先");
});

test("K928-UI-014 権限が無い（403）：直す・消すとも小窓／確かめの中の赤の知らせに権限の字が出て閉じず、グループは残る（役の名前では出し分けない）／止めているゲストも人数に数える", async ({
  page,
}) => {
  const mk = await mockEdit(page);
  mk.groups[1]!.guests = [{ id: "g5", name: "止めた 人", email: "stopped@kyogi.example", suspended: true }];
  mk.groups[1]!.invitations = [{ id: "gi9", email: "new@kyogi.example", left_days: 3 }];
  await openGuests(page, owner.token);
  mk.on.patch = () => err(403, "FORBIDDEN");
  await menu(page, SEIKO, "名前を直す");
  await page.getByLabel("名前 必須", { exact: true }).fill("セイコー（ゲスト）");
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(page.locator(`${DLG} [role='alert']`)).toContainText("権限");
  await expect(page.getByLabel("名前 必須", { exact: true })).toHaveValue("セイコー（ゲスト）");
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  mk.on.del = () => err(403, "FORBIDDEN");
  await menu(page, KYOGI, "消す");
  const d = page.getByRole("alertdialog");
  await expect(d).toContainText("中のゲスト（1 人・招待中 1）"); // 止めている人も数える
  await d.getByRole("button", { name: "消す", exact: true }).click();
  await expect(d.locator("[role='alert']")).toContainText("権限");
  await expect(d).toBeVisible();
  await expect(page.locator(".k-inv-group")).toHaveCount(2);
});
