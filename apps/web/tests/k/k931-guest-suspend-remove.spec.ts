// K-931「ゲストのタブの人の行の「⋯」から、ゲストを 1 人だけ一時的に止める・戻す・外す」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f11/mb-guest-menu・mb-guest-suspend・mb-guest-suspended・mb-guest-resume・mb-guest-remove
//   （本番と同じ部品 features/F10/invite/・代表の答え answer=03b52b9684c4・D-155.55）。
//   ログイン・外枠は本物（signupViaApi・loginAs）。メンバーの口 getWorkspaceMembers・ゲストのグループの口 listGuestGroups（K-876）・
//   止める suspendMember（POST /members/:id/suspend・200 { data: { member_id, suspended, suspended_at } }）・戻す resumeMember（POST /members/:id/resume）（K-814）・
//   外す removeMember（POST /members/:id/remove・担当 0 件は体 {}・200 { data: { member_id, tickets_moved, handovers_cancelled, restorable_until } }）（K-848）・
//   本人確認の取り直し（getMySecurity・stepUp）だけを網の手前で差し替える。本人の Bridge（127.0.0.1:38617）には届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { PW, loginAs, signupViaApi } from "../_lib/api";
import { ROOT } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const SEC = 'section[aria-labelledby="members-title"]';
const G_SALES = "0193c5a0-0000-7000-8000-00000000e001";
const GG_SEIKO = "0193c5a0-0000-7000-8000-00000000f001";
const GG_KYOGI = "0193c5a0-0000-7000-8000-00000000f002";
const YAMADA = "0193c5a0-0000-7000-8000-00000000a001";
const SUZUKI = "0193c5a0-0000-7000-8000-00000000a002";
const OHASHI = "0193c5a0-0000-7000-8000-00000000a004";
const SEIKO = "セイコー株式会社（ゲスト）";
const KYOGI = "京蟻システム株式会社（ゲスト）";

type Op = "suspend" | "resume" | "remove" | "security" | "stepUp";
interface Reply {
  status: number;
  body: unknown;
}
const err = (status: number, code: string, kind?: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, details: [], ...(kind ? { kind } : {}) },
});
/** listGuestGroups の確定の答えの形（11_tickets/K-876.md の K876-API-024・025・027） */
interface Guest {
  id: string;
  name: string;
  email: string;
  suspended: boolean;
}
interface Grp {
  id: string;
  name: string;
  request_scope: { id: string; name: string } | null;
  guests: Guest[];
  invitations: { id: string; email: string; left_days: number }[];
}
const groups = (): Grp[] => [
  {
    id: GG_SEIKO,
    name: SEIKO,
    request_scope: { id: G_SALES, name: "営業" },
    guests: [
      { id: YAMADA, name: "山田 花子", email: "yamada@seiko.example", suspended: false },
      { id: SUZUKI, name: "鈴木 健太", email: "suzuki@seiko.example", suspended: false },
    ],
    invitations: [{ id: "gi1", email: "tamura@seiko.example", left_days: 6 }],
  },
  {
    id: GG_KYOGI,
    name: KYOGI,
    request_scope: { id: G_SALES, name: "営業" },
    guests: [{ id: OHASHI, name: "大橋 誠", email: "ohashi@kyogi.example", suspended: false }],
    invitations: [],
  },
];
interface Mk {
  groups: Grp[];
  guestReads: number;
  calls: { op: Op; id: string; body: unknown }[];
  queue: Partial<Record<Op, Reply[]>>;
  gate: Promise<void>;
  hold: () => () => void;
  count: (op: Op) => number;
}
const find = (mk: Mk, id: string) => mk.groups.flatMap((g) => g.guests).find((x) => x.id === id);
const ok = (op: Op, mk: Mk, id: string): Reply => {
  const now = "2026-11-23T09:00:00Z";
  if (op === "suspend" || op === "resume") {
    const g = find(mk, id);
    if (g) g.suspended = op === "suspend";
    return {
      status: 200,
      body: { data: { member_id: id, suspended: op === "suspend", suspended_at: op === "suspend" ? now : null } },
    };
  }
  if (op === "remove") {
    mk.groups = mk.groups.map((g) => ({ ...g, guests: g.guests.filter((x) => x.id !== id) }));
    return {
      status: 200,
      body: {
        data: { member_id: id, tickets_moved: 0, handovers_cancelled: 0, restorable_until: "2026-12-23T09:00:00Z" },
      },
    };
  }
  if (op === "security")
    return {
      status: 200,
      body: {
        data: {
          passkeys: [],
          has_password: true,
          two_factor: false,
          backup_codes_left: null,
          two_factor_required: false,
          mfa_pending: false,
        },
      },
    };
  return { status: 201, body: { data: { step_up_at: now } } };
};
const ROUTES: [Op, string, RegExp][] = [
  ["suspend", "POST", /\/api\/v1\/members\/([^/]+)\/suspend$/],
  ["resume", "POST", /\/api\/v1\/members\/([^/]+)\/resume$/],
  ["remove", "POST", /\/api\/v1\/members\/([^/]+)\/remove$/],
  ["security", "GET", /\/api\/v1\/me\/security$/],
  ["stepUp", "POST", /\/api\/v1\/auth\/step-up$/],
];
async function mockApi(page: Page): Promise<Mk> {
  const mk: Mk = {
    groups: groups(),
    guestReads: 0,
    calls: [],
    queue: {},
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      mk.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    count: (op) => mk.calls.filter((c) => c.op === op).length,
  };
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/v1\/(workspace\/members|guest-groups)(\?|$)/, async (route: Route, req: Request) => {
    if (req.method() !== "GET") return route.fallback();
    const p = new URL(req.url()).pathname;
    const body = p.endsWith("/workspace/members")
      ? {
          data: {
            groups: [{ id: G_SALES, code: "EG", name: "営業", members: [] }],
            invitations: [],
            alerts: [],
            count: 0,
          },
        }
      : (mk.guestReads++, { data: { groups: mk.groups } });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route(
    /\/api\/v1\/(members\/[^/]+\/(suspend|resume|remove)|me\/security|auth\/step-up)$/,
    async (route, req) => {
      const p = new URL(req.url()).pathname;
      const hit = ROUTES.find(([, m, re]) => m === req.method() && re.test(p));
      if (!hit) return route.fallback();
      const [op, , re] = hit;
      const id = p.match(re)?.[1] ?? "";
      const raw = req.postData();
      mk.calls.push({ op, id, body: raw ? (JSON.parse(raw) as unknown) : null });
      if (op !== "security" && op !== "stepUp") await mk.gate;
      const reply = mk.queue[op]?.shift() ?? ok(op, mk, id);
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
const personRow = (page: Page, name: string) => page.locator(".k-inv-row").filter({ hasText: name });
const more = (page: Page, name: string) =>
  personRow(page, name).getByRole("button", { name: `${name}のほかの操作`, exact: true });
async function menu(page: Page, name: string, item: "一時的に止める" | "戻す" | "外す"): Promise<void> {
  await more(page, name).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}
const confirmDlg = (page: Page) => page.getByRole("alertdialog");
const go = (page: Page, label: string) => confirmDlg(page).getByRole("button", { name: label, exact: true });
const stepDlg = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます", exact: true });
async function passStepUp(page: Page): Promise<void> {
  await expect(stepDlg(page)).toBeVisible();
  await stepDlg(page).getByLabel("パスワード", { exact: true }).fill(PW);
  await stepDlg(page).getByRole("button", { name: "確かめる", exact: true }).click();
}
/** 知らせは 5 秒残って重なる（components/k/notice.tsx）ので、字で 1 つに絞って探す */
const toast = (page: Page, text: string) => page.locator(".k-toast").filter({ hasText: text });
/** 番号の文の頭（errors.json と errors.d/ から読む。画面は errorText で同じ文を引く） */
function errorHead(code: string): string {
  const dir = join(ROOT, "07_qa/test-specs");
  const files = [join(dir, "errors.json"), ...readdirSync(join(dir, "errors.d")).map((f) => join(dir, "errors.d", f))];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const raw = JSON.parse(readFileSync(f, "utf8")) as unknown;
    const list = (Array.isArray(raw) ? raw : ((raw as { errors?: unknown[] }).errors ?? [])) as {
      id?: string;
      message?: string;
    }[];
    const e = list.find((x) => x.id === code);
    if (e?.message) return e.message.split("。")[0]!;
  }
  throw new Error(`${code} の文が errors に無い`);
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
    ["more", ".k-inv-row [aria-haspopup='menu']", CTRL],
    ["state", ".k-inv-row .k-inv-state", TEXT],
    ["menu", ".k-select-popup", ["width", "background-color", "border-top-left-radius"]],
    ["menu-item", ".k-select-popup [role='menuitem']", [...TEXT, "height"]],
    ["confirm", "[role='alertdialog']", ["width", "x", "y", "background-color", "border-top-left-radius"]],
    ["confirm-title", "[role='alertdialog'] h2", ["x", "y", ...TEXT]],
    ["confirm-btn", "[role='alertdialog'] button", ["x", "y", ...CTRL]],
  ] as const
).map(([role, sel, props]) => ({ name: role, role, canvas: sel, app: sel, props: [...props] }));
const STATES: Record<string, (page: Page, mk: Mk) => Promise<void>> = {
  "mb-guest-menu": async (page) => {
    await more(page, "山田 花子").click();
    await expect(page.getByRole("menuitem", { name: "一時的に止める", exact: true })).toBeVisible();
  },
  "mb-guest-suspend": async (page) => {
    await menu(page, "山田 花子", "一時的に止める");
    await expect(confirmDlg(page)).toBeVisible();
  },
  "mb-guest-suspended": async (page, mk) => {
    find(mk, SUZUKI)!.suspended = true;
    await page.reload();
    await more(page, "鈴木 健太").click();
    await expect(page.getByRole("menuitem", { name: "戻す", exact: true })).toBeVisible();
  },
  "mb-guest-resume": async (page, mk) => {
    find(mk, SUZUKI)!.suspended = true;
    await page.reload();
    await menu(page, "鈴木 健太", "戻す");
    await expect(confirmDlg(page)).toBeVisible();
  },
  "mb-guest-remove": async (page) => {
    await menu(page, "山田 花子", "外す");
    await expect(confirmDlg(page)).toBeVisible();
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K931-UI-001 ${id} 幅 ${w}：人の行の「⋯」・止めている行・確かめの位置と大きさと字がモックと合う`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await mockApi(page);
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

// ---------------------------------------------------------------- 「⋯」
test("K931-UI-002 人の行の「⋯」は押せる形で、メニューは「一時的に止める」「外す」の 2 つ（どちらも押せる）・キーボードで開いて Esc で閉じ、焦点は「⋯」に戻る。招待中の行には「⋯」が無い", async ({
  page,
}) => {
  await mockApi(page);
  await openGuests(page, owner.token);
  const b = more(page, "山田 花子");
  await b.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  for (const name of ["一時的に止める", "外す"])
    await expect(page.getByRole("menuitem", { name, exact: true })).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem")).toHaveCount(0);
  await expect(b).toBeFocused();
  await expect(personRow(page, "tamura@seiko.example")).toHaveCount(1);
  await expect(personRow(page, "tamura@seiko.example").getByRole("button", { name: /のほかの操作$/ })).toHaveCount(0);
});

// ---------------------------------------------------------------- 止める・戻す
test("K931-UI-003 止める：確かめ「山田 花子 さんを一時的に止めますか」「止めると、すぐ入れなくなります。出した依頼とやり取りは残ります。いつでも戻せます。」・焦点は「やめる」→「本人確認して止める」で POST /members/<id>/suspend を体 {} で 1 回・確かめが閉じ・知らせ「山田 花子 を一時的に止めました」・一覧を 1 回読み直して行に「一時的に止まっている」・「⋯」は「戻す」「外す」", async ({
  page,
}) => {
  const mk = await mockApi(page);
  await openGuests(page, owner.token);
  await menu(page, "山田 花子", "一時的に止める");
  const d = confirmDlg(page);
  await expect(d.getByRole("heading", { name: "山田 花子 さんを一時的に止めますか", exact: true })).toBeVisible();
  await expect(d).toContainText("止めると、すぐ入れなくなります。出した依頼とやり取りは残ります。いつでも戻せます。");
  await expect(go(page, "やめる")).toBeFocused();
  await go(page, "本人確認して止める").click();
  await expect(d).toHaveCount(0);
  expect(mk.calls.filter((c) => c.op === "suspend")).toEqual([{ op: "suspend", id: YAMADA, body: {} }]);
  await expect(toast(page, "山田 花子 を一時的に止めました")).toBeVisible();
  await expect(personRow(page, "山田 花子").locator(".k-inv-state")).toHaveText("一時的に止まっている");
  expect(mk.guestReads, "止めた後に 1 回だけ読み直す").toBe(2);
  await more(page, "山田 花子").click();
  await expect(page.getByRole("menuitem", { name: "戻す", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "一時的に止める", exact: true })).toHaveCount(0);
  await expect(page.locator(".k-inv-group").filter({ hasText: SEIKO }).locator(".k-inv-group-head")).toContainText(
    "2 人 ＋ 招待中 1",
  ); // 止めている人も数える
});

test("K931-UI-004 戻す：止めているゲストの「⋯」→「戻す」で確かめ「鈴木 健太 さんを戻しますか」「また入れるようになります。本人は入り直します。」→「本人確認して戻す」で POST /members/<id>/resume を体 {} で 1 回・知らせ「鈴木 健太 を戻しました」・行の「一時的に止まっている」が消える", async ({
  page,
}) => {
  const mk = await mockApi(page);
  find(mk, SUZUKI)!.suspended = true;
  await openGuests(page, owner.token);
  await expect(personRow(page, "鈴木 健太").locator(".k-inv-state")).toHaveText("一時的に止まっている");
  await menu(page, "鈴木 健太", "戻す");
  const d = confirmDlg(page);
  await expect(d.getByRole("heading", { name: "鈴木 健太 さんを戻しますか", exact: true })).toBeVisible();
  await expect(d).toContainText("また入れるようになります。本人は入り直します。");
  await go(page, "本人確認して戻す").click();
  await expect(toast(page, "鈴木 健太 を戻しました")).toBeVisible();
  expect(mk.calls.filter((c) => c.op === "resume")).toEqual([{ op: "resume", id: SUZUKI, body: {} }]);
  await expect(personRow(page, "鈴木 健太").locator(".k-inv-state")).toHaveText("");
});

test("K931-UI-005 本人確認の取り直し：止める口が 403 STEP_UP_REQUIRED → 小窓「本人か確かめます」→ パスワードで確かめると stepUp 1 回 → 同じ体でもう 1 回だけ suspendMember。小窓をやめると何も送らず、確かめの小窓に戻る（押し直せる）", async ({
  page,
}) => {
  const mk = await mockApi(page);
  await openGuests(page, owner.token);
  mk.queue.suspend = [err(403, "STEP_UP_REQUIRED", "step_up")];
  await menu(page, "山田 花子", "一時的に止める");
  await go(page, "本人確認して止める").click();
  await passStepUp(page);
  await expect(toast(page, "山田 花子 を一時的に止めました")).toBeVisible();
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.calls.filter((c) => c.op === "suspend").map((c) => c.body)).toEqual([{}, {}]);
  mk.queue.remove = [err(403, "STEP_UP_REQUIRED", "step_up")];
  await menu(page, "鈴木 健太", "外す");
  await go(page, "本人確認して外す").click();
  await expect(stepDlg(page)).toBeVisible();
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stepDlg(page)).toHaveCount(0);
  await expect(confirmDlg(page)).toBeVisible();
  await expect(go(page, "本人確認して外す")).toBeEnabled();
  expect(mk.count("remove")).toBe(1);
  expect(mk.count("stepUp")).toBe(1);
});

// ---------------------------------------------------------------- 外す
test("K931-UI-006 外す確かめ：「山田 花子 さんを外しますか」・赤い箱「外すと、すぐ入れなくなります。」「出した依頼とやり取りは残ります。」・「外したあとは元に戻せません。もう一度入ってもらうときは、招き直します。」・引き継ぎ先の欄は無い・焦点は「やめる」・やめると口を呼ばない", async ({
  page,
}) => {
  const mk = await mockApi(page);
  await openGuests(page, owner.token);
  await menu(page, "山田 花子", "外す");
  const d = confirmDlg(page);
  await expect(d.getByRole("heading", { name: "山田 花子 さんを外しますか", exact: true })).toBeVisible();
  await expect(d).toContainText("外すと、すぐ入れなくなります。");
  await expect(d).toContainText("出した依頼とやり取りは残ります。");
  await expect(d).toContainText("外したあとは元に戻せません。もう一度入ってもらうときは、招き直します。");
  await expect(d.getByRole("combobox")).toHaveCount(0);
  await expect(go(page, "やめる")).toBeFocused();
  await go(page, "やめる").click();
  await expect(d).toHaveCount(0);
  expect(mk.count("remove")).toBe(0);
});

test("K931-UI-007 外す：「本人確認して外す」で POST /members/<id>/remove を体 {}（ゲストは担当を持たない）で 1 回・確かめが閉じ・知らせ「山田 花子 さんを外しました」・一覧を読み直してその行が消え「1 人 ＋ 招待中 1」・タブは「ゲスト 3」・ほかの人とグループはそのまま", async ({
  page,
}) => {
  const mk = await mockApi(page);
  await openGuests(page, owner.token);
  await menu(page, "山田 花子", "外す");
  await go(page, "本人確認して外す").click();
  await expect(confirmDlg(page)).toHaveCount(0);
  expect(mk.calls.filter((c) => c.op === "remove")).toEqual([{ op: "remove", id: YAMADA, body: {} }]);
  await expect(toast(page, "山田 花子 さんを外しました")).toBeVisible();
  await expect(personRow(page, "山田 花子")).toHaveCount(0);
  const g = page.locator(".k-inv-group").filter({ hasText: SEIKO });
  await expect(g.locator(".k-inv-group-head")).toContainText("1 人 ＋ 招待中 1");
  await expect(
    page
      .getByRole("navigation", { name: "メンバーとゲスト", exact: true })
      .getByRole("link", { name: "ゲスト 3", exact: true }),
  ).toBeVisible();
  await expect(personRow(page, "鈴木 健太")).toHaveCount(1);
  await expect(personRow(page, "大橋 誠")).toHaveCount(1);
  expect(mk.guestReads, "外した後に 1 回だけ読み直す").toBe(2);
});

// ---------------------------------------------------------------- 失敗・揺れ・守り
test("K931-UI-008 失敗：503 は確かめを閉じずに中の赤の知らせ・行はそのまま・押し直せる／403（権限が無い）は中の赤の知らせに「この画面を見る権限がありません。」・閉じない／もう居ない（404 E-MEM-002）は確かめを閉じて番号の文の知らせ・一覧を読み直して行が消える／別の人が先に止めた・戻した（409 E-MEM-009・E-MEM-010）は確かめを閉じて番号の文の知らせ・一覧を読み直して行が今の形になる", async ({
  page,
}) => {
  const mk = await mockApi(page);
  await openGuests(page, owner.token);
  mk.queue.suspend = [err(503, "E-PAGE-003"), err(403, "FORBIDDEN")];
  await menu(page, "山田 花子", "一時的に止める");
  await go(page, "本人確認して止める").click();
  await expect(confirmDlg(page).locator("[role='alert']")).toBeVisible();
  await expect(personRow(page, "山田 花子").locator(".k-inv-state")).toHaveText("");
  await go(page, "本人確認して止める").click();
  await expect(confirmDlg(page).locator("[role='alert']")).toContainText("この画面を見る権限がありません。");
  await expect(confirmDlg(page)).toBeVisible();
  await go(page, "やめる").click();
  mk.groups[0]!.guests = mk.groups[0]!.guests.filter((x) => x.id !== YAMADA);
  mk.queue.remove = [err(404, "E-MEM-002")];
  await menu(page, "山田 花子", "外す");
  await go(page, "本人確認して外す").click();
  await expect(confirmDlg(page)).toHaveCount(0);
  await expect(toast(page, errorHead("E-MEM-002"))).toBeVisible();
  await expect(personRow(page, "山田 花子")).toHaveCount(0);
  // 別の人が先に止めた（409 E-MEM-009）：開いていた画面では入っている形のまま「一時的に止める」を押す
  let reads = mk.guestReads;
  find(mk, SUZUKI)!.suspended = true;
  mk.queue.suspend = [err(409, "E-MEM-009")];
  await menu(page, "鈴木 健太", "一時的に止める");
  await go(page, "本人確認して止める").click();
  await expect(confirmDlg(page)).toHaveCount(0);
  await expect(toast(page, errorHead("E-MEM-009"))).toBeVisible();
  await expect(personRow(page, "鈴木 健太").locator(".k-inv-state")).toHaveText("一時的に止まっている");
  expect(mk.guestReads, "409 の後に 1 回だけ読み直す").toBe(reads + 1);
  // 別の人が先に戻した（409 E-MEM-010）：止めている形のまま「戻す」を押す
  reads = mk.guestReads;
  find(mk, SUZUKI)!.suspended = false;
  mk.queue.resume = [err(409, "E-MEM-010")];
  await menu(page, "鈴木 健太", "戻す");
  await go(page, "本人確認して戻す").click();
  await expect(confirmDlg(page)).toHaveCount(0);
  await expect(toast(page, errorHead("E-MEM-010"))).toBeVisible();
  await expect(personRow(page, "鈴木 健太").locator(".k-inv-state")).toHaveText("");
  expect(mk.guestReads, "409 の後に 1 回だけ読み直す").toBe(reads + 1);
});

test("K931-UI-009 二度押し：答えを止めたまま「本人確認して止める」「本人確認して外す」を 2 回押しても口は 1 回ずつ・待つ間は押せない（外すのは、前の半分で止めたゲスト＝「⋯」は「戻す」「外す」）", async ({
  page,
}) => {
  const mk = await mockApi(page);
  await openGuests(page, owner.token);
  let release = mk.hold();
  await menu(page, "山田 花子", "一時的に止める");
  const s = go(page, "本人確認して止める");
  await s.click();
  await expect(s).toBeDisabled();
  await s.click({ force: true });
  release();
  await expect(toast(page, "山田 花子 を一時的に止めました")).toBeVisible();
  expect(mk.count("suspend")).toBe(1);
  release = mk.hold();
  await expect(personRow(page, "山田 花子").locator(".k-inv-state")).toHaveText("一時的に止まっている");
  await more(page, "山田 花子").click();
  await expect(page.getByRole("menuitem", { name: "戻す", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "外す", exact: true }).click();
  const r = go(page, "本人確認して外す");
  await r.click();
  await expect(r).toBeDisabled();
  await r.click({ force: true });
  release();
  await expect(toast(page, "山田 花子 さんを外しました")).toBeVisible();
  expect(mk.calls.filter((c) => c.op === "remove")).toEqual([{ op: "remove", id: YAMADA, body: {} }]);
  await expect(personRow(page, "山田 花子")).toHaveCount(0);
});

test("K931-UI-010 幅 320・375・768・1024・1440：人の行の「⋯」が見えて押せ（スマホでも）、止めている行の「一時的に止まっている」が見え、確かめが画面の中・横のはみ出し 0", async ({
  page,
}) => {
  const mk = await mockApi(page);
  find(mk, SUZUKI)!.suspended = true;
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openGuests(page, owner.token, w);
    await expect(personRow(page, "鈴木 健太").locator(".k-inv-state"), `幅 ${w}`).toBeVisible();
    await menu(page, "山田 花子", "外す");
    const c = await confirmDlg(page).boundingBox();
    const vp = page.viewportSize()!;
    expect(c!.x + c!.width, `確かめ 幅 ${w}`).toBeLessThanOrEqual(vp.width);
    expect(c!.y + c!.height, `確かめ 幅 ${w}`).toBeLessThanOrEqual(vp.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `幅 ${w}`,
    ).toBeLessThanOrEqual(0);
    await go(page, "やめる").click();
  }
});

test("K931-UI-011 モックの持ち主：mocks.tsx で K-931 の状態はちょうど 5（mb-guest-menu・mb-guest-suspend・mb-guest-suspended・mb-guest-resume・mb-guest-remove）で、頭の mock: と同じ。確かめと行に「取引先」の字が無い", async ({
  page,
}) => {
  const src = readFileSync(join(ROOT, "apps/web/app/(dev)/dev/mock/f11/mocks.tsx"), "utf8");
  const mine = [...src.matchAll(/id:\s*"([^"]+)"[\s\S]*?ticket:\s*"(K-\d+)"/g)]
    .filter((m) => m[2] === "K-931")
    .map((m) => m[1]);
  expect(mine.sort()).toEqual([
    "mb-guest-menu",
    "mb-guest-remove",
    "mb-guest-resume",
    "mb-guest-suspend",
    "mb-guest-suspended",
  ]);
  const head = readFileSync(join(ROOT, "11_tickets/K-931.md"), "utf8")
    .match(/^mock:\s*\[(.*)\]$/m)![1]!
    .split(",")
    .map((s) => s.trim());
  expect(head.sort()).toEqual(mine.sort());
  await mockApi(page);
  await openGuests(page, owner.token);
  await menu(page, "山田 花子", "外す");
  await expect(page.locator("body")).not.toContainText("取引先");
});
