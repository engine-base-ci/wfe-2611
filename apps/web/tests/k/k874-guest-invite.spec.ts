// K-874「メンバーの画面に「ゲスト」のタブと、招くの小窓に役割「ゲスト」とゲストのグループの選び肢を足して口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f11/mb-members・mb-guests・mb-add・mb-add-group-new・mb-add-created・mb-add-from-group・mb-group-new・mb-group-new-dup
//   （本番と同じ部品 features/F10/invite/views.tsx・guest-group-views.tsx。代表の答え answer=9201e2b32d4e・6fe309f41cc1・695325c0630f・6ba09f587792）。
//   mb-add-pick（選び肢を開いた形）は突き合わせない：選ぶ欄は端末の <select> で、開いた箱は端末が描く（K874-UI-004 が選び肢の中身を見る）。
//   ログイン・外枠・役（RequireRole）は本物（signupViaApi・loginAs）。メンバーの口 getWorkspaceMembers（K-419）・ゲストのグループの口
//   listGuestGroups・createGuestGroup（K-876）・招く口 createInvitations（K-419・K-876 で requester を足す）だけを網の手前で差し替える。
//   口の答えの形は 11_tickets/K-876.md の確定（listGuestGroups＝groups[]: id・name・request_scope{id,name}|null・guests[]・invitations[]／createGuestGroup＝201 { data: { group } }）と K-420 の試験（membersReply）と同じ。
//   本人の Bridge（127.0.0.1:38617）には届かせない（網の手前で 404）。固定の待ちは使わない（答えと移り終わりを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { ROOT } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const WS_NAME = "株式会社ENGINE BASE";
const SEC = 'section[aria-labelledby="members-title"]';
// 開いている小窓（段11 の本文は閉じた小窓（data-closed）も DOM に残すので、それを数えない）
const DLG = ".k-dialog:not([data-closed])";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const G_SALES = "0193c5a0-0000-7000-8000-00000000e001";
const G_DEV = "0193c5a0-0000-7000-8000-00000000e002";
const GG_SEIKO = "0193c5a0-0000-7000-8000-00000000f001";
const GG_KYOGI = "0193c5a0-0000-7000-8000-00000000f002";
const GG_NEW = "0193c5a0-0000-7000-8000-00000000f003";
const SEIKO = "セイコー株式会社（ゲスト）";
const KYOGI = "京蟻システム株式会社（ゲスト）";
const SORA = "株式会社ソラ（ゲスト）";
const DUP_TEXT = "同じ名前のゲストのグループがあります。別の名前にしてください";

// ---------------------------------------------------------------- 口の答え
const person = (id: string, name: string, email: string, role = "member") => ({
  id,
  name,
  email,
  role,
  group_role: null,
  primary: true,
  other_groups: [],
  self: false,
  suspended: false,
  pc: "ok",
  pc_days_away: null,
});
const membersReply = () => ({
  data: {
    groups: [
      {
        id: G_SALES,
        code: "EG",
        name: "営業",
        members: [
          // 下絵 mb-members と同じ人（自分の高本・木村）
          { ...person("p1", "高本 聖斗", "takamoto@engine-base.example", "admin"), self: true },
          person("p3", "木村 翔", "kimura@engine-base.example"),
        ],
      },
      {
        id: G_DEV,
        code: "JD",
        name: "受託開発",
        members: [person("p2", "佐藤 花子", "sato@engine-base.example", "manager")],
      },
    ],
    invitations: [],
    alerts: [],
    count: 3,
  },
});
/** listGuestGroups の確定の答えの形（11_tickets/K-876.md の K876-API-024・025）：request_scope は届け先が消えたら null */
interface GGroup {
  id: string;
  name: string;
  request_scope: { id: string; name: string } | null;
  guests: { id: string; name: string; email: string; suspended: boolean }[];
  invitations: { id: string; email: string; left_days: number }[];
}
const seiko = (): GGroup => ({
  id: GG_SEIKO,
  name: SEIKO,
  request_scope: { id: G_SALES, name: "営業" },
  guests: [
    { id: "g1", name: "山田 花子", email: "yamada@seiko.example", suspended: false },
    { id: "g2", name: "鈴木 健太", email: "suzuki@seiko.example", suspended: false },
  ],
  invitations: [{ id: "gi1", email: "tamura@seiko.example", left_days: 6 }],
});
const kyogi = (): GGroup => ({
  id: GG_KYOGI,
  name: KYOGI,
  request_scope: { id: G_DEV, name: "受託開発" },
  guests: [{ id: "g4", name: "大橋 誠", email: "ohashi@kyogi.example", suspended: false }],
  invitations: [],
});

interface Reply {
  status: number;
  body: unknown;
}
const err = (status: number, code: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, details: [] },
});
interface GMock {
  groups: GGroup[];
  reads: { members: number; guests: number };
  invites: { body: Record<string, unknown>; key: string | undefined }[];
  creates: Record<string, unknown>[];
  on: {
    guests: () => Reply;
    invite: (b: Record<string, unknown>) => Reply;
    create: (b: Record<string, unknown>) => Reply;
  };
  /** 招くの答えを止めておく（返した関数を呼ぶと答える・時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
}
async function mockGuests(page: Page): Promise<GMock> {
  const mk: GMock = {
    groups: [seiko(), kyogi()],
    reads: { members: 0, guests: 0 },
    invites: [],
    creates: [],
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      mk.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      guests: () => ({ status: 200, body: { data: { groups: mk.groups } } }),
      invite: (b) => {
        const emails = (b["emails"] as string[]) ?? [];
        const g = mk.groups.find((x) => x.id === b["guest_group_id"]);
        if (g) g.invitations.push(...emails.map((e, i) => ({ id: `n${i}`, email: e, left_days: 7 })));
        return {
          status: 201,
          body: {
            data: {
              invitations: emails.map((e, i) => ({
                id: `n${i}`,
                email: e,
                expires_at: "2026-11-30T09:00:00Z",
                mail: "sent",
              })),
            },
          },
        };
      },
      create: (b) => {
        const g: GGroup = {
          id: GG_NEW,
          name: String(b["name"]),
          request_scope: {
            id: String(b["request_scope_id"]),
            name: b["request_scope_id"] === G_DEV ? "受託開発" : "営業",
          },
          guests: [],
          invitations: [],
        };
        mk.groups.push(g);
        // 確定の答え（K876-API-007）：201 { data: { group: { id, name, request_scope: { id, name } } } }
        return { status: 201, body: { data: { group: { id: g.id, name: g.name, request_scope: g.request_scope } } } };
      },
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(
    /\/api\/v1\/(workspace\/members|guest-groups|invitations)(\?|$)/,
    async (route: Route, req: Request) => {
      const p = new URL(req.url()).pathname;
      let reply: Reply;
      if (req.method() === "GET" && p.endsWith("/workspace/members")) {
        mk.reads.members++;
        reply = { status: 200, body: membersReply() };
      } else if (req.method() === "GET" && p.endsWith("/guest-groups")) {
        mk.reads.guests++;
        reply = mk.on.guests();
      } else if (req.method() === "POST" && p.endsWith("/guest-groups")) {
        const b = req.postDataJSON() as Record<string, unknown>;
        mk.creates.push(b);
        reply = mk.on.create(b);
      } else if (req.method() === "POST" && p.endsWith("/invitations")) {
        const b = req.postDataJSON() as Record<string, unknown>;
        mk.invites.push({ body: b, key: req.headers()["idempotency-key"] });
        await mk.gate;
        reply = mk.on.invite(b);
      } else return route.fallback();
      await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
    },
  );
  return mk;
}

async function openMembers(page: Page, token: string, width = 1440, path = "/members"): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, token);
  await page.goto(path);
  await expect(page.locator(SEC).getByRole("heading", { level: 1 })).toBeVisible();
}
const tabs = (page: Page) => page.getByRole("navigation", { name: "メンバーとゲスト", exact: true });
async function openGuests(page: Page, token: string, width = 1440): Promise<void> {
  await openMembers(page, token, width);
  await tabs(page)
    .getByRole("link", { name: /^ゲスト \d+$/ })
    .click();
  await expect(page.locator(SEC).getByRole("heading", { name: "ゲスト", level: 1, exact: true })).toBeVisible();
  await expect(page.locator(".k-inv-group")).toHaveCount(2);
}
async function openInvite(page: Page): Promise<void> {
  await page.locator(SEC).getByRole("button", { name: "＋ 招く", exact: true }).click();
  await expect(page.locator(DLG).getByRole("heading", { name: "招く", exact: true })).toBeVisible();
}
const groupField = (page: Page) => page.locator(DLG).getByRole("combobox", { name: /^ゲストのグループ/ });
const sendBtn = (page: Page) => page.locator(DLG).getByRole("button", { name: /^(\d+ 人を)?招く$/ });
async function addMail(page: Page, text: string): Promise<void> {
  await page.locator(DLG).getByLabel("メール 必須", { exact: true }).fill(text);
  await page.locator(DLG).getByRole("button", { name: "足す", exact: true }).click();
}

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

// ---------------------------------------------------------------- モックと本番の突き合わせ
const BOX = ["width", "height", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
const PAIRS = (
  [
    ["tabs", ".k-inv-tabs", ["width", "height", "texts"]],
    ["tab", ".k-inv-tab", [...TEXT, "height"]],
    ["h1", `${SEC} h1`, ["x", ...TEXT]],
    ["acts", `${SEC} .k-page-acts button`, CTRL],
    ["group", ".k-inv-group", BOX],
    ["group-name", ".k-inv-group-name", TEXT],
    ["group-sub", ".k-inv-group-head .k-inv-sub", TEXT],
    ["row", ".k-inv-row", ["height", "texts"]],
    ["more", ".k-inv-group-head [aria-haspopup='menu']", CTRL],
    ["dialog", DLG, ["width", "x", "y", "background-color", "border-top-left-radius"]],
    ["dialog-title", `${DLG} h2`, ["x", "y", ...TEXT]],
    ["dialog-label", `${DLG} .k-label`, TEXT],
    ["dialog-err", `${DLG} .k-err`, TEXT],
    ["dialog-btn", `${DLG} button[data-variant]`, ["x", "y", ...CTRL]],
  ] as const
).map(([role, sel, props]) => ({ name: role, role, canvas: sel, app: sel, props: [...props] }));

const STATES: Record<string, (page: Page, mk: GMock) => Promise<void>> = {
  "mb-members": async () => {},
  "mb-guests": async (page) => {
    await tabs(page)
      .getByRole("link", { name: /^ゲスト \d+$/ })
      .click();
    // メンバーのタブもグループは 2 つなので、ゲストのタブに替わり終わる（見出しが「ゲスト」）まで待つ
    await expect(page.locator(SEC).getByRole("heading", { level: 1 })).toHaveText("ゲスト");
    await expect(page.locator(".k-inv-group")).toHaveCount(2);
  },
  "mb-add": async (page) => {
    await tabs(page)
      .getByRole("link", { name: /^ゲスト \d+$/ })
      .click();
    // メンバーのタブもグループは 2 つなので、ゲストのタブに替わり終わる（見出しが「ゲスト」）まで待つ
    await expect(page.locator(SEC).getByRole("heading", { level: 1 })).toHaveText("ゲスト");
    await openInvite(page);
    await addMail(page, "sano@seiko.example");
    await groupField(page).selectOption(SEIKO);
    await page
      .locator(DLG)
      .getByLabel("ひとこと（任意）", { exact: true })
      .fill("請求書のご確認と、ご依頼の受け付けをこちらでお願いします");
  },
  "mb-add-group-new": async (page) => {
    await tabs(page)
      .getByRole("link", { name: /^ゲスト \d+$/ })
      .click();
    // メンバーのタブもグループは 2 つなので、ゲストのタブに替わり終わる（見出しが「ゲスト」）まで待つ
    await expect(page.locator(SEC).getByRole("heading", { level: 1 })).toHaveText("ゲスト");
    await openInvite(page);
    await groupField(page).selectOption("＋ 新しいゲストのグループを作る");
    await page.getByLabel("名前 必須", { exact: true }).fill(SORA);
  },
  "mb-add-created": async (page) => {
    await tabs(page)
      .getByRole("link", { name: /^ゲスト \d+$/ })
      .click();
    // メンバーのタブもグループは 2 つなので、ゲストのタブに替わり終わる（見出しが「ゲスト」）まで待つ
    await expect(page.locator(SEC).getByRole("heading", { level: 1 })).toHaveText("ゲスト");
    await openInvite(page);
    await addMail(page, "nakano@sora.example");
    await groupField(page).selectOption("＋ 新しいゲストのグループを作る");
    await page.getByLabel("名前 必須", { exact: true }).fill(SORA);
    await page.getByRole("button", { name: "作る", exact: true }).click();
    await expect(page.locator(DLG)).toContainText(`ゲストのグループ「${SORA}」を作りました`);
  },
  "mb-add-from-group": async (page) => {
    await tabs(page)
      .getByRole("link", { name: /^ゲスト \d+$/ })
      .click();
    // メンバーのタブもグループは 2 つなので、ゲストのタブに替わり終わる（見出しが「ゲスト」）まで待つ
    await expect(page.locator(SEC).getByRole("heading", { level: 1 })).toHaveText("ゲスト");
    await page
      .locator(".k-inv-group")
      .filter({ hasText: KYOGI })
      .getByRole("button", { name: "＋ このゲストのグループに招く", exact: true })
      .click();
    await page.locator(DLG).getByLabel("メール 必須", { exact: true }).fill("kato@kyogi.example");
  },
  "mb-group-new": async (page) => {
    await tabs(page)
      .getByRole("link", { name: /^ゲスト \d+$/ })
      .click();
    // メンバーのタブもグループは 2 つなので、ゲストのタブに替わり終わる（見出しが「ゲスト」）まで待つ
    await expect(page.locator(SEC).getByRole("heading", { level: 1 })).toHaveText("ゲスト");
    await page.locator(SEC).getByRole("button", { name: "＋ ゲストのグループを作る", exact: true }).click();
  },
  "mb-group-new-dup": async (page, mk) => {
    mk.on.create = () => err(409, "E-GST-002");
    await tabs(page)
      .getByRole("link", { name: /^ゲスト \d+$/ })
      .click();
    // メンバーのタブもグループは 2 つなので、ゲストのタブに替わり終わる（見出しが「ゲスト」）まで待つ
    await expect(page.locator(SEC).getByRole("heading", { level: 1 })).toHaveText("ゲスト");
    await page.locator(SEC).getByRole("button", { name: "＋ ゲストのグループを作る", exact: true }).click();
    await page.getByLabel("名前 必須", { exact: true }).fill(SEIKO);
    await page.getByLabel(/^依頼が届く社内のグループ/).selectOption("営業");
    await page.getByRole("button", { name: "作る", exact: true }).click();
    await expect(page.locator(`${DLG} .k-err`)).toHaveText(DUP_TEXT);
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K874-UI-001 ${id} 幅 ${w}：外枠の中の本文（タブ・見出し・グループのカード・小窓・誤り）の位置と大きさと字がモックと合う`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await mockGuests(page);
          await openMembers(page, owner.token, w);
          await drive(page, mk);
          // グループの行のボタンを押すと頁が下へ送られる。y は頁の上からの位置で読むので、下絵と同じく頁の頭に戻してから比べる（K930 と同じ）
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        { pairs: PAIRS, base: "/dev/mock/f11", blur: true },
      );
      expect(new Set(rows.map((r) => r.part)), "本文の役で比べた").toContain("h1");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- タブ・読む
test("K874-UI-002 開くと口を 1 回ずつ並べて読む（直列にしない）・タブは「メンバー 3」「ゲスト 4」（ゲストの人数＋招待中）・URL の ?tab=guests でゲストのタブが直に開く", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openMembers(page, owner.token);
  expect(mk.reads).toEqual({ members: 1, guests: 1 });
  await expect(tabs(page).getByRole("link", { name: "メンバー 3", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(tabs(page).getByRole("link", { name: "ゲスト 4", exact: true })).toBeVisible();
  await page.goto("/members?tab=guests");
  await expect(page.locator(SEC).getByRole("heading", { name: "ゲスト", level: 1, exact: true })).toBeVisible();
  await expect(tabs(page).getByRole("link", { name: "ゲスト 4", exact: true })).toHaveAttribute("aria-current", "page");
  expect(mk.reads.guests, "タブを押しても読み直さない・開き直したときだけ").toBe(2);
});

test("K874-UI-003 ゲストのタブ：ゲストのグループごとに人が並び（名前・メール・役割「ゲスト」）・「依頼は 営業 に届く」・招待中は残りの日・「このゲストのグループに招く」が押せる・グループの「⋯」に 2 項目・人の行の「⋯」に 2 項目（一時的に止める・外す）が在る", async ({
  page,
}) => {
  await mockGuests(page);
  await openGuests(page, owner.token);
  const g = page.locator(".k-inv-group").filter({ hasText: SEIKO });
  await expect(g.locator(".k-inv-group-head")).toContainText("2 人 ＋ 招待中 1");
  await expect(g.locator(".k-inv-group-head")).toContainText("依頼は 営業 に届く");
  await expect(g.locator(".k-inv-row")).toHaveCount(3);
  await expect(g).toContainText("yamada@seiko.example");
  await expect(g.locator(".k-inv-row").nth(2)).toContainText("6 日");
  await expect(g.getByRole("button", { name: "＋ このゲストのグループに招く", exact: true })).toBeEnabled();
  await g.getByRole("button", { name: `${SEIKO}のほかの操作`, exact: true }).click();
  for (const name of ["名前を直す", "消す"])
    await expect(page.getByRole("menuitem", { name, exact: true })).toBeVisible(); // 押せるかは K-928 が受け持つ（この葉は在ることだけ）
  await page.keyboard.press("Escape");
  await g
    .locator(".k-inv-row")
    .filter({ hasText: "山田 花子" })
    .getByRole("button", { name: "山田 花子のほかの操作", exact: true })
    .click();
  for (const name of ["一時的に止める", "外す"])
    await expect(page.getByRole("menuitem", { name, exact: true })).toBeVisible(); // 押せるかは K-931 が受け持つ（この葉は在ることだけ）
  await page.keyboard.press("Escape");
  await expect(page.locator(SEC)).not.toContainText("取引先");
});

test("K874-UI-004 ゲストのグループが 1 つも無い：空の知らせと「＋ ゲストのグループを作る」（見出しの行と同じ 1 つ）・タブの数は「ゲスト 0」", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  mk.groups = [];
  await openMembers(page, owner.token, 1440, "/members?tab=guests");
  await expect(page.getByText("ゲストのグループがまだありません", { exact: true })).toBeVisible();
  await expect(page.locator(SEC).getByRole("button", { name: "＋ ゲストのグループを作る", exact: true })).toHaveCount(
    1,
  );
  await expect(tabs(page).getByRole("link", { name: "ゲスト 0", exact: true })).toBeVisible();
});

test("K874-UI-005 ゲストの口が読めない：503 は「読めませんでした」と再読み込み・メンバーのタブはそのまま出る／403 はゲストのタブだけ権限の知らせ", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  mk.on.guests = () => err(503, "E-PAGE-003");
  await openMembers(page, owner.token);
  await expect(page.locator(".k-inv-group")).toHaveCount(2); // メンバーのタブは出ている
  await tabs(page)
    .getByRole("link", { name: /^ゲスト/ })
    .click();
  await expect(page.getByText("読めませんでした", { exact: true })).toBeVisible();
  mk.on.guests = () => ({ status: 200, body: { data: { groups: mk.groups } } });
  await page.getByRole("button", { name: "再読み込み", exact: true }).click();
  await expect(page.locator(".k-inv-group")).toHaveCount(2);
  mk.on.guests = () => err(403, "FORBIDDEN");
  await page.reload();
  await expect(page.getByText("この画面を見る権限がありません。", { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- 招く
test("K874-UI-006 招くの小窓：役割の選び肢に「ゲスト」が増える・選ぶとグループの欄が「ゲストのグループ」に替わり、選び肢は既にあるグループ＋最後に「＋ 新しいゲストのグループを作る」・リンクで招く形は出ない・依頼が届くグループの欄は出ない", async ({
  page,
}) => {
  await mockGuests(page);
  await openMembers(page, owner.token);
  await openInvite(page);
  const role = page.locator(DLG).getByRole("combobox", { name: "役割", exact: true });
  await expect(role.locator("option")).toHaveText(["メンバー", "マネージャー", "閲覧のみ", "管理者", "ゲスト"]);
  await expect(page.locator(DLG).getByRole("combobox", { name: "グループ", exact: true })).toBeVisible();
  await role.selectOption("ゲスト");
  await expect(page.locator(DLG).getByRole("combobox", { name: "グループ", exact: true })).toHaveCount(0);
  const opts = await groupField(page).locator("option").allInnerTexts();
  expect(opts.slice(-3)).toEqual([SEIKO, KYOGI, "＋ 新しいゲストのグループを作る"]);
  await page.locator(".k-inv-more-sum").click();
  await expect(page.locator(DLG).getByRole("button", { name: /招待のリンクを作る/ })).toHaveCount(0);
  await expect(page.locator(DLG)).not.toContainText("依頼が届く社内のグループ");
  await expect(page.locator(DLG)).toContainText(
    "ゲストは、入ると依頼と見せたチケットの場所が開く（PC はつながない・チケットは直せない）",
  );
});

test("K874-UI-007 ゲストのタブの「＋ 招く」は役割「ゲスト」が選ばれて開く・グループを選ぶと「このグループの依頼は 営業 に届く（作るときに決めた物）」が出る・選ぶまで送れない", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await openInvite(page);
  await expect(page.locator(DLG).getByRole("combobox", { name: "役割", exact: true })).toHaveValue("requester");
  await addMail(page, "sano@seiko.example");
  await sendBtn(page).click();
  await expect(page.locator(DLG)).toContainText("ゲストのグループを選んでください");
  expect(mk.invites, "選ぶまで口を呼ばない").toHaveLength(0);
  await groupField(page).selectOption(SEIKO);
  await expect(page.locator(DLG)).toContainText("このグループの依頼は 営業 に届く（作るときに決めた物）");
});

test("K874-UI-008 送る：口へ role_key=requester・guest_group_id・メールの並び・ひとこと（scope_id は送らない・Idempotency-Key は 1 つ）・知らせ「… に招待を送りました」・小窓が閉じ、一覧が読み直されて招待中の行が増える", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await openInvite(page);
  await addMail(page, "sano@seiko.example");
  await addMail(page, "kato@seiko.example");
  await groupField(page).selectOption(SEIKO);
  await page.locator(DLG).getByLabel("ひとこと（任意）", { exact: true }).fill("ご依頼をこちらから");
  await page.locator(DLG).getByRole("button", { name: "2 人を招く", exact: true }).click();
  await expect(page.locator(".k-toast").filter({ hasText: "招待を送りました" })).toBeVisible();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.invites).toHaveLength(1);
  const b = mk.invites[0]!.body;
  expect(b["role_key"]).toBe("requester");
  expect(b["guest_group_id"]).toBe(GG_SEIKO);
  expect(b["emails"]).toEqual(["sano@seiko.example", "kato@seiko.example"]);
  expect(b["message"]).toBe("ご依頼をこちらから");
  expect(Object.keys(b), "依頼の届け先は招待に持たせない（グループが持つ）").not.toContain("scope_id");
  expect(mk.invites[0]!.key, "Idempotency-Key").toMatch(/\S+/);
  await expect(page.locator(".k-inv-group").filter({ hasText: SEIKO }).locator(".k-inv-row")).toHaveCount(5);
  expect(mk.reads.guests, "送った後に 1 回だけ読み直す").toBe(2);
});

test("K874-UI-009 二度押し：答えを止めたまま「招く」を 2 回押しても口は 1 回・送っている間はボタンが押せない", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await openInvite(page);
  await addMail(page, "sano@seiko.example");
  await groupField(page).selectOption(SEIKO);
  const release = mk.hold();
  await sendBtn(page).click();
  await expect(sendBtn(page)).toBeDisabled();
  await sendBtn(page).click({ force: true });
  expect(mk.invites).toHaveLength(1);
  release();
  await expect(page.locator(".k-toast").filter({ hasText: "招待を送りました" })).toBeVisible();
  expect(mk.invites).toHaveLength(1);
});

test("K874-UI-010 選んだゲストのグループがもう無い（404・E-GST-001）：小窓は閉じず「このゲストのグループは見つかりません」・選びは空に戻り・一覧を読み直して選び肢から消える・メールは残る", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await openInvite(page);
  await addMail(page, "sano@seiko.example");
  await groupField(page).selectOption(SEIKO);
  mk.groups = [kyogi()];
  mk.on.invite = () => err(404, "E-GST-001");
  await sendBtn(page).click();
  await expect(page.locator(DLG)).toContainText("このゲストのグループは見つかりません");
  await expect(groupField(page)).toHaveValue("");
  await expect(groupField(page).locator("option")).not.toContainText([SEIKO]);
  await expect(page.locator(DLG)).toContainText("sano@seiko.example");
});

test("K874-UI-011 招けなかった（503）：赤の知らせ・書いたメールとグループは残り、押し直せる。送り直すと 1 回目と別の Idempotency-Key ではなく同じ鍵で送る", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await openInvite(page);
  await addMail(page, "sano@seiko.example");
  await groupField(page).selectOption(SEIKO);
  mk.on.invite = () => err(503, "E-PAGE-003");
  await sendBtn(page).click();
  await expect(page.locator(`${DLG} [role='alert']`)).toBeVisible();
  await expect(groupField(page)).toHaveValue(SEIKO);
  mk.on.invite = (b) => ({
    status: 201,
    body: {
      data: {
        invitations: (b["emails"] as string[]).map((e) => ({
          id: "x",
          email: e,
          expires_at: "2026-11-30T09:00:00Z",
          mail: "sent",
        })),
      },
    },
  });
  await sendBtn(page).click();
  await expect(page.locator(".k-toast").filter({ hasText: "招待を送りました" })).toBeVisible();
  expect(mk.invites).toHaveLength(2);
  expect(mk.invites[1]!.key).toBe(mk.invites[0]!.key);
});

test("K874-UI-012 「＋ 新しいゲストのグループを作る」：作る小窓が開き（名前・依頼が届く社内のグループ）、作ると口へ name と request_scope_id・招くの小窓に戻って作ったグループが選ばれ「ゲストのグループ「…」を作りました」・書いたメールは残る・一覧に出る", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await openInvite(page);
  await addMail(page, "nakano@sora.example");
  await groupField(page).selectOption("＋ 新しいゲストのグループを作る");
  await expect(page.getByRole("heading", { name: "ゲストのグループを作る", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "招くに戻る", exact: true })).toBeVisible();
  await page.getByLabel("名前 必須", { exact: true }).fill(`\u3000${SORA} `);
  await page.getByLabel(/^依頼が届く社内のグループ/).selectOption("営業");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page.locator(DLG)).toContainText(`ゲストのグループ「${SORA}」を作りました`);
  expect(mk.creates).toEqual([{ name: SORA, request_scope_id: G_SALES }]);
  await expect(groupField(page)).toHaveValue(SORA);
  await expect(page.locator(DLG)).toContainText("nakano@sora.example");
  await expect(page.locator(DLG)).toContainText("このグループの依頼は 営業 に届く（作るときに決めた物）");
  await sendBtn(page).click();
  await expect(page.locator(".k-toast").filter({ hasText: "招待を送りました" })).toBeVisible();
  expect(mk.invites[0]!.body["guest_group_id"]).toBe(GG_NEW);
});

test("K874-UI-013 作る小窓の「招くに戻る」：作らずに招くの小窓へ戻り、選びは空・書いたメールは残る・口は呼ばない", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await openInvite(page);
  await addMail(page, "nakano@sora.example");
  await groupField(page).selectOption("＋ 新しいゲストのグループを作る");
  await page.getByRole("button", { name: "招くに戻る", exact: true }).click();
  await expect(page.locator(DLG).getByRole("heading", { name: "招く", exact: true })).toBeVisible();
  await expect(groupField(page)).toHaveValue("");
  await expect(page.locator(DLG)).toContainText("nakano@sora.example");
  expect(mk.creates).toHaveLength(0);
});

test("K874-UI-014 ゲストのタブの「＋ ゲストのグループを作る」：作る小窓（「招くに戻る」でなく「やめる」）・作ると知らせが出て、中の人が 0 のグループが一覧に増え、招くの小窓は開かない", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await page.locator(SEC).getByRole("button", { name: "＋ ゲストのグループを作る", exact: true }).click();
  await expect(page.getByRole("button", { name: "やめる", exact: true })).toBeVisible();
  await page.getByLabel("名前 必須", { exact: true }).fill(SORA);
  await page.getByLabel(/^依頼が届く社内のグループ/).selectOption("受託開発");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page.locator(".k-toast").filter({ hasText: `ゲストのグループ「${SORA}」を作りました` })).toBeVisible();
  expect(mk.creates).toEqual([{ name: SORA, request_scope_id: G_DEV }]);
  await expect(page.locator(".k-inv-group")).toHaveCount(3);
  await expect(page.locator(".k-inv-group").filter({ hasText: SORA })).toContainText("0 人");
  await expect(page.locator(DLG)).toHaveCount(0);
});

test("K874-UI-015 作る小窓の誤り：名前が空・空白だけは口を呼ばず欄の下に出る／同じ名前（409・E-GST-002）は欄の下に「同じ名前のゲストのグループがあります…」で小窓は閉じず入れた値が残る", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await page.locator(SEC).getByRole("button", { name: "＋ ゲストのグループを作る", exact: true }).click();
  await page.getByLabel("名前 必須", { exact: true }).fill("\u3000 ");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page.locator(`${DLG} .k-err`)).toContainText("名前を入れてください");
  expect(mk.creates, "空では口を呼ばない").toHaveLength(0);
  mk.on.create = () => err(409, "E-GST-002");
  await page.getByLabel("名前 必須", { exact: true }).fill(SEIKO);
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page.locator(`${DLG} .k-err`)).toHaveText(DUP_TEXT);
  await expect(page.getByLabel("名前 必須", { exact: true })).toHaveValue(SEIKO);
});

test("K874-UI-016 グループの行の「＋ このゲストのグループに招く」：役割「ゲスト」とそのグループが選ばれて開き、「このグループの依頼は 受託開発 に届く」が出る・送ると guest_group_id はそのグループ", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await page
    .locator(".k-inv-group")
    .filter({ hasText: KYOGI })
    .getByRole("button", { name: "＋ このゲストのグループに招く", exact: true })
    .click();
  await expect(page.locator(DLG).getByRole("combobox", { name: "役割", exact: true })).toHaveValue("requester");
  await expect(groupField(page)).toHaveValue(KYOGI);
  await expect(page.locator(DLG)).toContainText("このグループの依頼は 受託開発 に届く（作るときに決めた物）");
  await addMail(page, "kato@kyogi.example");
  await sendBtn(page).click();
  await expect(page.locator(".k-toast").filter({ hasText: "kato@kyogi.example に招待を送りました" })).toBeVisible();
  expect(mk.invites[0]!.body["guest_group_id"]).toBe(GG_KYOGI);
});

test("K874-UI-017 メンバーとして招く道は今までどおり：役割「メンバー」を選ぶと送るのは role_key=member と scope_id（グループ）で guest_group_id は付かない／ゲストを選んでから「メンバー」に戻すと、ゲストのグループの選びは消える", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openMembers(page, owner.token);
  await openInvite(page);
  await addMail(page, "kimura@engine-base.example");
  const role = page.locator(DLG).getByRole("combobox", { name: "役割", exact: true });
  await role.selectOption("ゲスト");
  await groupField(page).selectOption(SEIKO);
  await role.selectOption("メンバー");
  await expect(groupField(page)).toHaveCount(0);
  await sendBtn(page).click();
  await expect(
    page.locator(".k-toast").filter({ hasText: "kimura@engine-base.example に招待を送りました" }),
  ).toBeVisible();
  const b = mk.invites[0]!.body;
  expect(b["role_key"]).toBe("member");
  expect(b["scope_id"]).toBe(G_SALES);
  expect(Object.keys(b)).not.toContain("guest_group_id");
});

test("K874-UI-018 キーボード：小窓で Esc を押すと閉じて、焦点は開いた「＋ 招く」に戻る／ゲストのグループの欄は矢印で選べる", async ({
  page,
}) => {
  await mockGuests(page);
  await openGuests(page, owner.token);
  const open = page.locator(SEC).getByRole("button", { name: "＋ 招く", exact: true });
  await open.click();
  await expect(page.locator(DLG)).toBeVisible();
  await groupField(page).focus();
  await page.keyboard.press("ArrowDown");
  await expect(groupField(page)).not.toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(open).toBeFocused();
});

test("K874-UI-019 幅 320・375・768・1024・1440：ゲストのタブ・招くの小窓・作る小窓で横のはみ出しが 0（共通の外枠を含む画面）・小窓の頭と足が画面の中", async ({
  page,
}) => {
  await mockGuests(page);
  for (const w of WIDTHS) {
    await openGuests(page, owner.token, w);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `ゲストのタブ 幅 ${w}`,
    ).toBeLessThanOrEqual(0);
    await openInvite(page);
    await groupField(page).selectOption("＋ 新しいゲストのグループを作る");
    const box = await page.locator(DLG).boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.x, `作る小窓 幅 ${w}`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `作る小窓 幅 ${w}`).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height, `作る小窓の足 幅 ${w}`).toBeLessThanOrEqual(vp.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);
    await page.reload();
  }
});

// ---------------------------------------------------------------- 守り・部品
test("K874-UI-020 画面に「取引先」の字が無い（メンバーのタブ・ゲストのタブ・小窓 3 つ）", async ({ page }) => {
  await mockGuests(page);
  await openMembers(page, owner.token);
  await expect(page.locator("body")).not.toContainText("取引先");
  await tabs(page)
    .getByRole("link", { name: /^ゲスト/ })
    .click();
  await expect(page.locator("body")).not.toContainText("取引先");
  await openInvite(page);
  await groupField(page).selectOption("＋ 新しいゲストのグループを作る");
  await expect(page.locator("body")).not.toContainText("取引先");
});

test("K874-UI-021 部品は見た目だけ・写しを消した：features/F10/invite の guest-group-views.tsx と views.tsx は口を呼ばず（fetch・lib/api・useRouter なし）、下絵の stage9/ は無く、モックの render-cu-mb.tsx は本番の部品を import する", async () => {
  const dir = join(ROOT, "apps/web/features/F10/invite");
  for (const f of ["views.tsx", "guest-group-views.tsx"]) {
    const src = readFileSync(join(dir, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src, f).not.toMatch(/\bfetch\(|from "@\/lib\/api|useRouter|from "next\/navigation"/);
  }
  expect(existsSync(join(ROOT, "apps/web/app/(dev)/dev/mock/f11/stage9"))).toBe(false);
  const mb = readFileSync(join(ROOT, "apps/web/app/(dev)/dev/mock/f11/render-cu-mb.tsx"), "utf8");
  expect(mb).toContain("@/features/F10/invite/guest-group-views");
  expect(mb).not.toContain("./stage9/");
});

test("K874-UI-022 モックの持ち主：mocks.tsx で K-874 の状態はちょうど 9（mb-members・mb-guests・mb-add・mb-add-pick・mb-add-group-new・mb-add-created・mb-add-from-group・mb-group-new・mb-group-new-dup）で、頭の mock: と同じ", async () => {
  const src = readFileSync(join(ROOT, "apps/web/app/(dev)/dev/mock/f11/mocks.tsx"), "utf8");
  const mine = [...src.matchAll(/id:\s*"([^"]+)"[\s\S]*?ticket:\s*"(K-\d+)"/g)]
    .filter((m) => m[2] === "K-874")
    .map((m) => m[1]);
  expect(mine.sort()).toEqual(
    [
      "mb-add",
      "mb-add-created",
      "mb-add-from-group",
      "mb-add-group-new",
      "mb-add-pick",
      "mb-group-new",
      "mb-group-new-dup",
      "mb-guests",
      "mb-members",
    ].sort(),
  );
  const head = readFileSync(join(ROOT, "11_tickets/K-874.md"), "utf8")
    .match(/^mock:\s*\[(.*)\]$/m)![1]!
    .split(",")
    .map((s) => s.trim());
  expect(head.sort()).toEqual(mine.sort());
});

test("K874-UI-024 届け先が消えたゲストのグループ（request_scope が null）：グループは一覧に残り「依頼は … に届く」の字は出ない・招くの小窓で選んでも「このグループの依頼は … に届く」は出ず送れる", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  mk.groups = [{ ...seiko(), request_scope: null }, kyogi()];
  await openGuests(page, owner.token);
  const g = page.locator(".k-inv-group").filter({ hasText: SEIKO });
  await expect(g.locator(".k-inv-group-head")).toContainText("2 人 ＋ 招待中 1");
  await expect(g.locator(".k-inv-group-head")).not.toContainText("に届く");
  await openInvite(page);
  await addMail(page, "tamura2@seiko.example");
  await groupField(page).selectOption(SEIKO);
  await expect(page.locator(DLG)).not.toContainText("に届く");
  await sendBtn(page).click();
  await expect(page.locator(".k-toast").filter({ hasText: "招待を送りました" })).toBeVisible();
  expect(mk.invites[0]!.body["guest_group_id"]).toBe(GG_SEIKO);
});

test("K874-UI-025 作る口の断り：届け先の社内のグループが消えていた（404・E-GST-003）は小窓が閉じず「このグループは見つかりません」・届け先の選び肢を読み直す／権限が無い（403）は小窓の中に権限の字が出て閉じない", async ({
  page,
}) => {
  const mk = await mockGuests(page);
  await openGuests(page, owner.token);
  await page.locator(SEC).getByRole("button", { name: "＋ ゲストのグループを作る", exact: true }).click();
  await page.getByLabel("名前 必須", { exact: true }).fill(SORA);
  await page.getByLabel(/^依頼が届く社内のグループ/).selectOption("営業");
  const before = mk.reads.members;
  mk.on.create = () => err(404, "E-GST-003");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page.locator(`${DLG} .k-err`)).toContainText("このグループは見つかりません");
  await expect(page.getByLabel("名前 必須", { exact: true })).toHaveValue(SORA);
  await expect.poll(() => mk.reads.members, "届け先の選び肢を読み直す").toBeGreaterThan(before);
  mk.on.create = () => err(403, "FORBIDDEN");
  await page.getByLabel(/^依頼が届く社内のグループ/).selectOption("営業");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page.locator(`${DLG} .k-err`)).toContainText("権限");
  await expect(page.locator(DLG)).toBeVisible();
  expect(mk.groups).toHaveLength(2);
});
