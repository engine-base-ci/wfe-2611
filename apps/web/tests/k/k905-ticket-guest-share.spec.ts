// K-905「チケットの詳細の右のパネルに「ゲストに見せる」の区画を足し、見せる相手（ゲストのグループ）を選ぶ小窓・見せるのをやめる確かめを口につなぐ」の画面の試験
//   （実 Chrome・実装より先に積む）。正のモック：/dev/mock/f11/tk-private・tk-share・tk-share-empty・tk-share-saving・tk-share-failed・tk-shown・tk-shown-readonly・tk-unshare
//   （本番と同じ部品 features/F11/share/views.tsx・代表の決め answer=6ba09f587792）。やり取り（チャット）の頭の印は段 7 のやり取りのタブの側で、この葉では突き合わせない。
//   詳細は前からの土台（approve-complete.harness の mockApi・openTicket）で開く。ログインの印は本物。口は読む listTicketGuestShares（GET /api/v1/tickets/:id/guest-shares）と
//   付け外し updateTicketGuestShares（PATCH 同じ住所・{ add, remove }）を網の手前で差し替え、詳細の答え（getTicket）に guest_share（shared・can_change）を足す。
//   PM の決め 2026-11-27 案 (a)：初めの読み込みでは見せる相手の口を呼ばず、区画とやり取りの頭の印は詳細の答えの guest_share で出す（台帳 /tickets/:id の上限 8 を超えない）。
//   見せる相手の口は小窓を開いたとき（候補と概要）と、404・E-GST-040 の候補の読み直しだけ。付け外しの後は詳細を 1 回読み直す。口の答えの形は 11_tickets/K-881.md（shared・choices）。
//   K-881 の md に無い 2 つの欄を仮に置く：答えの can_change（見ている人が変えられるか）と、グループごとの summary（「山田 花子 様・鈴木 健太 様 ほか（3 人・招待中 1）」）。
//   違えば下の SHARES・reply だけを合わせる。固定の待ちは使わない（答えと移り終わりを待つ）。本人の Bridge（127.0.0.1:38617）は網の手前で 404。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { TICKET, mockApi, openTicket, ticketOf, withBand } from "../features/F5/approve-complete.harness";
import { loginAs, signupViaApi } from "../_lib/api";
import { ROOT } from "./kit";
import {
  SUZU_W,
  TAKA_W,
  THREAD_FULL,
  mockThread,
  openThread,
  panel,
  post,
  type MessageView,
  type Who,
} from "./thread-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const SEC = 'section[aria-label="ゲストに見せる"]';
const DLG = ".k-dialog";
const GG = {
  seiko: {
    id: "0193c5a0-0000-7000-8000-00000000f001",
    name: "セイコー株式会社（ゲスト）",
    summary: "山田 花子 様・鈴木 健太 様 ほか（3 人・招待中 1）",
  },
  kyogi: {
    id: "0193c5a0-0000-7000-8000-00000000f002",
    name: "京蟻システム株式会社（ゲスト）",
    summary: "大橋 誠 様（1 人）",
  },
  minato: { id: "0193c5a0-0000-7000-8000-00000000f003", name: "合同会社ミナト（ゲスト）", summary: "小林 様（1 人）" },
} as const;
type G = (typeof GG)[keyof typeof GG];
const ALL: G[] = [GG.seiko, GG.kyogi, GG.minato];
const NOTES = [
  "題・本文・詳細・チャット",
  "段の札（作っている・確認中・完了）",
  "担当・期限などの社内の欄・確認項目・決定ログ・分身の記録",
];

interface Reply {
  status: number;
  body: unknown;
}
const err = (status: number, code: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, details: [] },
});
interface S {
  shared: G[];
  all: G[];
  canChange: boolean;
  /** 見せる相手の口（GET /tickets/:id/guest-shares）を読んだ回数 */
  reads: number;
  /** 詳細（GET /tickets/:id）を読んだ回数 */
  details: number;
  patches: { body: { add?: string[]; remove?: string[] } }[];
  on: { read: () => Reply; patch: (b: { add?: string[]; remove?: string[] }) => Reply };
  hold: () => () => void;
  gate: Promise<void>;
}
const view = (s: S) => ({
  data: {
    shared: s.shared.map((g) => ({ guest_group_id: g.id, name: g.name, summary: g.summary })),
    choices: s.canChange
      ? s.all.filter((g) => !s.shared.includes(g)).map((g) => ({ id: g.id, name: g.name, summary: g.summary }))
      : [],
    can_change: s.canChange,
  },
});
/** 詳細の答え（getTicket）の guest_share：見せている相手（名前の順・summary は載せない）と can_change */
const shareOf = (shared: G[], canChange: boolean) => ({
  shared: shared.map((g) => ({ guest_group_id: g.id, name: g.name })),
  can_change: canChange,
});
async function mockShares(
  page: Page,
  init: Partial<Pick<S, "shared" | "all" | "canChange">> = {},
  base = true,
): Promise<S> {
  const s: S = {
    shared: [],
    all: ALL,
    canChange: true,
    reads: 0,
    details: 0,
    patches: [],
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      s.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      read: () => ({ status: 200, body: view(s) }),
      patch: (b) => {
        s.shared = [
          ...s.shared.filter((g) => !(b.remove ?? []).includes(g.id)),
          ...s.all.filter((g) => (b.add ?? []).includes(g.id) && !s.shared.includes(g)),
        ];
        return { status: 200, body: view(s) };
      },
    },
    ...init,
  };
  if (base) {
    const m = await mockApi(page, { stage: "doing" });
    const band = { stage: "doing" };
    // 詳細の答えに今の見せる相手を載せる（付け外しの後の読み直しで替わる）
    m.on.ticket = () => ({
      status: 200,
      body: { data: withBand(band, { ...ticketOf(band), guest_share: shareOf(s.shared, s.canChange) }) },
    });
  }
  page.on("request", (r) => {
    if (r.method() === "GET" && new URL(r.url()).pathname === `/api/v1/tickets/${TICKET}`) s.details++;
  });
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(new RegExp(`/api/v1/tickets/${TICKET}/guest-shares(\\?|$)`), async (route: Route, req: Request) => {
    let reply: Reply;
    if (req.method() === "GET") {
      s.reads++;
      reply = s.on.read();
    } else if (req.method() === "PATCH") {
      const b = req.postDataJSON() as { add?: string[]; remove?: string[] };
      s.patches.push({ body: b });
      await s.gate;
      reply = s.on.patch(b);
    } else return route.fallback();
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return s;
}
async function open(page: Page, token: string, width = 1440): Promise<void> {
  await loginAs(page, token);
  await openTicket(page, width);
  await expect(page.locator(SEC)).toBeVisible();
}
const sec = (page: Page) => page.locator(SEC);
const pick = async (page: Page, g: G, on = true) =>
  page
    .locator(DLG)
    .getByRole("checkbox", { name: new RegExp(`^${g.name}`) })
    .setChecked(on);
const decide = (page: Page) => page.locator(DLG).getByRole("button", { name: "決める", exact: true });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

// ---------------------------------------------------------------- モックと本番の突き合わせ
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
const PAIRS = (
  [
    ["share", SEC, ["width", "x", "background-color", "border-top-color"]],
    ["share-h2", `${SEC} h2`, TEXT],
    ["share-badge", `${SEC} .k-badge`, [...TEXT, "background-color", "height"]],
    ["share-btn", `${SEC} button`, CTRL],
    ["share-notes", `${SEC} .k-f11v-notes li`, TEXT],
    ["dialog", DLG, ["width", "x", "background-color", "border-top-left-radius"]],
    ["dialog-title", `${DLG} h2`, TEXT],
    ["dialog-row", `${DLG} .k-f11v-vis li`, ["height", "x"]],
    ["dialog-notes", `${DLG} .k-f11v-notes li`, TEXT],
    ["dialog-callout", `${DLG} [role='alert'], ${DLG} .k-callout`, ["width", "background-color", "font-size", "color"]],
    ["dialog-btn", `${DLG} button[data-variant]`, CTRL],
    ["confirm", "[role='alertdialog']", ["width", "x", "background-color", "border-top-left-radius"]],
    ["confirm-btn", "[role='alertdialog'] button", CTRL],
  ] as const
).map(([role, sel, props]) => ({ name: role, role, canvas: sel, app: sel, props: [...props] }));
const STATES: Record<string, (page: Page, s: S) => Promise<void>> = {
  "tk-private": async () => {},
  "tk-share": async (page) => {
    await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
    await pick(page, GG.seiko);
  },
  "tk-share-empty": async (page, s) => {
    s.all = [];
    await page.reload();
    await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
  },
  "tk-share-saving": async (page, s) => {
    s.hold();
    await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
    await pick(page, GG.seiko);
    await decide(page).click();
    await expect(decide(page)).toBeDisabled();
  },
  "tk-share-failed": async (page, s) => {
    s.on.patch = () => err(503, "E-PAGE-003");
    await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
    await pick(page, GG.seiko);
    await decide(page).click();
    await expect(page.locator(DLG)).toContainText("見せる相手を決められませんでした");
  },
  "tk-shown": async () => {},
  "tk-shown-readonly": async () => {},
  "tk-unshare": async (page) => {
    await sec(page).getByRole("button", { name: "見せるのをやめる", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
  },
};
const INIT: Record<string, Partial<Pick<S, "shared" | "all" | "canChange">>> = {
  "tk-share-empty": { all: ALL },
  "tk-shown": { shared: [GG.seiko] },
  "tk-shown-readonly": { shared: [GG.seiko], canChange: false },
  "tk-unshare": { shared: [GG.seiko] },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K905-UI-001 ${id} 幅 ${w}：右のパネルの「ゲストに見せる」の区画・小窓・確かめの位置と大きさと字がモックと合う`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const s = await mockShares(page, INIT[id] ?? {});
          await open(page, owner.token, w);
          await drive(page, s);
        },
        { pairs: PAIRS, base: "/dev/mock/f11", blur: true },
      );
      expect(new Set(rows.map((r) => r.part)), "区画の役で比べた").toContain("share-h2");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 読む・既定
test("K905-UI-002 詳細を開いても見せる相手の口は呼ばない（網が静かになるまで 0 回・区画は詳細の答えの guest_share で出す）・既定は「社内だけ（ゲストには見えません）」と「ゲストに見せる」だけ・右のパネルに「取引先」の字が無い", async ({
  page,
}) => {
  const s = await mockShares(page);
  await open(page, owner.token);
  await page.waitForLoadState("networkidle");
  expect(s.reads, "初めの読み込みで見せる相手の口を呼ばない").toBe(0);
  await expect(sec(page).locator(".k-badge")).toHaveText("社内だけ");
  await expect(sec(page)).toContainText("ゲストには見えません");
  await expect(sec(page).getByRole("button")).toHaveCount(1);
  await expect(page.getByRole("complementary", { name: "チケットのパネル", exact: true })).not.toContainText("取引先");
});

test("K905-UI-003 見せる相手を選ぶ小窓：開いたときに見せる相手の口を 1 回読む・題に番号とチケットの題・グループは全部の候補（3 つ）が箱で並び 1 つずつの概要・何も選んでいない・「見えるもの」「見せない」の説明が小窓の中にある・「決める」は選ぶまで押せない", async ({
  page,
}) => {
  const s = await mockShares(page);
  await open(page, owner.token);
  await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
  await expect(page.locator(DLG).getByRole("heading", { name: "ゲストに見せる", exact: true })).toBeVisible();
  await expect(page.locator(DLG)).toContainText("11 月分の請求書を送る");
  const boxes = page.locator(DLG).getByRole("checkbox");
  await expect(boxes).toHaveCount(3);
  expect(s.reads, "小窓を開いたときに 1 回").toBe(1);
  for (const g of ALL) {
    await expect(page.locator(DLG).getByRole("checkbox", { name: new RegExp(`^${g.name}`) })).not.toBeChecked();
    await expect(page.locator(DLG)).toContainText(g.summary);
  }
  for (const n of NOTES) await expect(page.locator(DLG)).toContainText(n);
  await expect(page.locator(DLG)).toContainText("ゲストに見えるもの");
  await expect(decide(page)).toBeDisabled();
});

test("K905-UI-004 見せる：2 つ選んで「決める」を押すと PATCH に add が 2 つの id（remove は空）・小窓が閉じ・区画は「見せている相手」に 2 つの名前・見える物の説明・「相手を選ぶ」「見せるのをやめる」が出る・詳細を 1 回だけ読み直す（再取得）・見せる相手の口は小窓を開いたときの 1 回だけ", async ({
  page,
}) => {
  const s = await mockShares(page);
  await open(page, owner.token);
  await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
  await pick(page, GG.seiko);
  await pick(page, GG.kyogi);
  const before = s.details;
  await decide(page).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(s.patches).toHaveLength(1);
  expect([...(s.patches[0]!.body.add ?? [])].sort()).toEqual([GG.seiko.id, GG.kyogi.id].sort());
  expect(s.patches[0]!.body.remove ?? []).toEqual([]);
  const list = sec(page).getByRole("list", { name: "見せている相手", exact: true });
  await expect(list.locator("li")).toHaveText([GG.seiko.name, GG.kyogi.name]);
  for (const n of NOTES) await expect(sec(page)).toContainText(n);
  await expect(sec(page).getByRole("button", { name: "相手を選ぶ", exact: true })).toBeVisible();
  await expect(sec(page).getByRole("button", { name: "見せるのをやめる", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(s.details - before, "付けた後に詳細を 1 回だけ読み直す").toBe(1);
  expect(s.reads, "見せる相手の口は小窓を開いたときの 1 回だけ").toBe(1);
});

test("K905-UI-005 相手を変える：見せている小窓は見せている相手に印が付いて開く・1 つ外して 1 つ足すと PATCH は add と remove が 1 つずつ・詳細を 1 回だけ読み直し区画の名前の並びが替わる", async ({
  page,
}) => {
  const s = await mockShares(page, { shared: [GG.seiko, GG.kyogi] });
  await open(page, owner.token);
  await sec(page).getByRole("button", { name: "相手を選ぶ", exact: true }).click();
  await expect(page.locator(DLG).getByRole("checkbox", { name: new RegExp(`^${GG.seiko.name}`) })).toBeChecked();
  await expect(page.locator(DLG).getByRole("checkbox", { name: new RegExp(`^${GG.minato.name}`) })).not.toBeChecked();
  await pick(page, GG.kyogi, false);
  await pick(page, GG.minato);
  const before = s.details;
  await decide(page).click();
  expect(s.patches[0]!.body).toEqual({ add: [GG.minato.id], remove: [GG.kyogi.id] });
  await expect(sec(page).getByRole("list", { name: "見せている相手", exact: true }).locator("li")).toHaveText([
    GG.seiko.name,
    GG.minato.name,
  ]);
  await page.waitForLoadState("networkidle");
  expect(s.details - before, "変えた後に詳細を 1 回だけ読み直す").toBe(1);
});

test("K905-UI-006 見せるのをやめる：確かめ「セイコー株式会社（ゲスト）に見せるのをやめますか」・「ゲストの画面から、このチケットは消えます。」「チケットは残ります」・「やめる」は口を呼ばない・「見せるのをやめる」で PATCH に remove・詳細を 1 回だけ読み直し区画は「社内だけ」に戻り、チケットの詳細はそのまま出ている・確かめの名前は詳細の答えから出し見せる相手の口は 0 回", async ({
  page,
}) => {
  const s = await mockShares(page, { shared: [GG.seiko] });
  await open(page, owner.token);
  await sec(page).getByRole("button", { name: "見せるのをやめる", exact: true }).click();
  const d = page.getByRole("alertdialog");
  await expect(d).toContainText(`${GG.seiko.name}に見せるのをやめますか`);
  await expect(d).toContainText("ゲストの画面から、このチケットは消えます。");
  await expect(d).toContainText("チケットは残ります。");
  await d.getByRole("button", { name: "やめる", exact: true }).click();
  expect(s.patches).toHaveLength(0);
  await sec(page).getByRole("button", { name: "見せるのをやめる", exact: true }).click();
  const before = s.details;
  await page.getByRole("alertdialog").getByRole("button", { name: "見せるのをやめる", exact: true }).click();
  await expect(sec(page).locator(".k-badge")).toHaveText("社内だけ");
  await page.waitForLoadState("networkidle");
  expect(s.details - before, "外した後に詳細を 1 回だけ読み直す").toBe(1);
  expect(s.patches).toHaveLength(1);
  expect(s.patches[0]!.body).toEqual({ remove: [GG.seiko.id] });
  await expect(page.getByRole("heading", { level: 1, name: /11 月分の請求書を送る/ })).toBeVisible();
  expect(s.reads, "やめる確かめは見せる相手の口を読まない").toBe(0);
});

test("K905-UI-007 複数に見せているとき「見せるのをやめる」は全部を外す確かめ（題は「2 つのゲストのグループに見せるのをやめますか」）で、PATCH の remove は 2 つの id", async ({
  page,
}) => {
  const s = await mockShares(page, { shared: [GG.seiko, GG.kyogi] });
  await open(page, owner.token);
  await sec(page).getByRole("button", { name: "見せるのをやめる", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("2 つのゲストのグループに見せるのをやめますか");
  await page.getByRole("alertdialog").getByRole("button", { name: "見せるのをやめる", exact: true }).click();
  await expect(sec(page).locator(".k-badge")).toHaveText("社内だけ");
  expect([...(s.patches[0]!.body.remove ?? [])].sort()).toEqual([GG.seiko.id, GG.kyogi.id].sort());
});

test("K905-UI-008 ゲストのグループがまだ無い：小窓は「ゲストのグループがまだありません」「メンバーの画面の「ゲスト」のタブで、ゲストのグループを作ってから、もう一度開いてください。」・箱は出ず「決める」は押せない・付け外しの口は呼ばない（見せる相手の口は小窓を開いたときの 1 回）", async ({
  page,
}) => {
  const s = await mockShares(page, { all: [] });
  await open(page, owner.token);
  await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
  await expect(page.locator(DLG)).toContainText("ゲストのグループがまだありません");
  await expect(page.locator(DLG)).toContainText(
    "メンバーの画面の「ゲスト」のタブで、ゲストのグループを作ってから、もう一度開いてください。",
  );
  await expect(page.locator(DLG).getByRole("checkbox")).toHaveCount(0);
  await expect(decide(page)).toBeDisabled();
  expect(s.patches).toHaveLength(0);
  expect(s.reads, "見せる相手の口は小窓を開いたときの 1 回").toBe(1);
});

// ---------------------------------------------------------------- 失敗・揺れ
test("K905-UI-009 決められなかった：503 は小窓の中に「見せる相手を決められませんでした」「もう一度押してください。選んだ相手は、この小窓に残っています。」・選びは残り押し直せる／404・E-GST-040（そのグループが消えていた）は「このゲストのグループは見つかりません」で候補を読み直して消えた物が無くなる／409・E-GST-041 は「見せる相手は 20 までです」", async ({
  page,
}) => {
  const s = await mockShares(page);
  await open(page, owner.token);
  await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
  await pick(page, GG.seiko);
  s.on.patch = () => err(503, "E-PAGE-003");
  await decide(page).click();
  await expect(page.locator(DLG)).toContainText("見せる相手を決められませんでした");
  await expect(page.locator(DLG)).toContainText("もう一度押してください。選んだ相手は、この小窓に残っています。");
  await expect(page.locator(DLG).getByRole("checkbox", { name: new RegExp(`^${GG.seiko.name}`) })).toBeChecked();
  s.all = [GG.kyogi, GG.minato];
  s.on.patch = () => err(404, "E-GST-040");
  await decide(page).click();
  await expect(page.locator(DLG)).toContainText("このゲストのグループは見つかりません");
  await expect(page.locator(DLG).getByRole("checkbox")).toHaveCount(2);
  s.on.patch = () => err(409, "E-GST-041");
  await pick(page, GG.kyogi);
  await decide(page).click();
  await expect(page.locator(DLG)).toContainText("見せる相手は 20 までです");
  expect(await sec(page).locator(".k-badge").innerText(), "失敗の間は区画は変わらない").toBe("社内だけ");
});

test("K905-UI-010 二度押し：答えを止めたまま「決める」を 2 回押しても口は 1 回・送っている間は「やめる」も押せない", async ({
  page,
}) => {
  const s = await mockShares(page);
  await open(page, owner.token);
  await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
  await pick(page, GG.seiko);
  const release = s.hold();
  await decide(page).click();
  await expect(page.locator(DLG).getByRole("button", { name: "やめる", exact: true })).toBeDisabled();
  await decide(page).click({ force: true });
  expect(s.patches).toHaveLength(1);
  release();
  await expect(sec(page).getByRole("list", { name: "見せている相手", exact: true })).toBeVisible();
  expect(s.patches).toHaveLength(1);
});

test("K905-UI-011 読むだけの人（口の答えが can_change=false）：ボタンは aria-disabled・title「見せる相手を変えられるのは、書ける人だけです」・押しても小窓は開かず見せる相手の口も付け外しの口も呼ばない・「見せる相手を変えられるのは、書ける人だけです。」の 1 行。見せている相手の名前は読める（画面は役の名前で決めず口の答えで決める）", async ({
  page,
}) => {
  const s = await mockShares(page, { shared: [GG.seiko], canChange: false });
  await open(page, owner.token);
  await expect(sec(page).getByRole("list", { name: "見せている相手", exact: true }).locator("li")).toHaveText([
    GG.seiko.name,
  ]);
  for (const name of ["相手を選ぶ", "見せるのをやめる"]) {
    const b = sec(page).getByRole("button", { name, exact: true });
    await expect(b).toHaveAttribute("aria-disabled", "true");
    await expect(b).toHaveAttribute("title", "見せる相手を変えられるのは、書ける人だけです");
    await b.click({ force: true });
  }
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(sec(page)).toContainText("見せる相手を変えられるのは、書ける人だけです。");
  expect(s.patches).toHaveLength(0);
  await page.waitForLoadState("networkidle");
  expect(s.reads, "読むだけの人は見せる相手の口を呼ばない").toBe(0);
});

test("K905-UI-012 小窓を開いたときに見せる相手の口が読めない（503）：小窓の中に「ゲストに見せる設定を読めませんでした」と「もう一度読む」・箱は出ず「決める」は押せない・区画は詳細の答えのまま（「社内だけ」）・押すと読み直して候補 3 つの箱が出る", async ({
  page,
}) => {
  const s = await mockShares(page);
  s.on.read = () => err(503, "E-PAGE-003");
  await open(page, owner.token);
  await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
  await expect(page.locator(DLG)).toContainText("ゲストに見せる設定を読めませんでした");
  await expect(page.locator(DLG).getByRole("checkbox")).toHaveCount(0);
  await expect(decide(page)).toBeDisabled();
  await expect(sec(page).locator(".k-badge")).toHaveText("社内だけ");
  await expect(page.getByRole("heading", { level: 1, name: /11 月分の請求書を送る/ })).toBeVisible();
  s.on.read = () => ({ status: 200, body: view(s) });
  await page.locator(DLG).getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.locator(DLG).getByRole("checkbox")).toHaveCount(3);
  expect(s.reads).toBe(2);
});

test("K905-UI-013 キーボード：「ゲストに見せる」を Enter で開き、Esc で閉じて焦点は開いたボタンに戻る・箱はスペースで選べる・確かめでも Esc で閉じて焦点は「見せるのをやめる」に戻る", async ({
  page,
}) => {
  await mockShares(page, { shared: [] });
  await open(page, owner.token);
  const b = sec(page).getByRole("button", { name: "ゲストに見せる", exact: true });
  await b.focus();
  await page.keyboard.press("Enter");
  await page
    .locator(DLG)
    .getByRole("checkbox", { name: new RegExp(`^${GG.seiko.name}`) })
    .focus();
  await page.keyboard.press("Space");
  await expect(page.locator(DLG).getByRole("checkbox", { name: new RegExp(`^${GG.seiko.name}`) })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(b).toBeFocused();
});

test("K905-UI-014 幅 1024・1440：区画と小窓で横のはみ出し 0・小窓の足は画面の中・右のパネルの中で区画は ItemsPanel の区（最後の「確認項目」）の後・実行の記録（最新）の前に出る（代表の答え answer=9096d8002961）", async ({
  page,
}) => {
  await mockShares(page);
  for (const w of [1024, 1440]) {
    await open(page, owner.token, w);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `幅 ${w}`,
    ).toBeLessThanOrEqual(0);
    const heads = await page
      .getByRole("complementary", { name: "チケットのパネル", exact: true })
      .locator("h2")
      .allInnerTexts();
    const at = heads.indexOf("ゲストに見せる");
    expect(heads.indexOf("確認項目"), "ItemsPanel の最後の区が在る").toBeGreaterThanOrEqual(0);
    expect(at, "ItemsPanel の区の後").toBe(heads.indexOf("確認項目") + 1);
    expect(heads.indexOf("実行の記録（最新）"), "実行の記録（最新）の前").toBe(at + 1);
    await sec(page).getByRole("button", { name: "ゲストに見せる", exact: true }).click();
    const box = await page.locator(DLG).boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.x + box!.width, `幅 ${w}`).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height, `幅 ${w}`).toBeLessThanOrEqual(vp.height);
    await page.keyboard.press("Escape");
  }
});

test("K905-UI-015 モックの持ち主：mocks.tsx で K-905 の状態はちょうど 8 で頭の mock: と同じ・ゲストに見せる部品（features/F11/share/views.tsx）は口を呼ばない（fetch・lib/api なし）", async () => {
  const src = readFileSync(join(ROOT, "apps/web/app/(dev)/dev/mock/f11/mocks.tsx"), "utf8");
  const mine = [...src.matchAll(/id:\s*"([^"]+)"[\s\S]*?ticket:\s*"(K-\d+)"/g)]
    .filter((m) => m[2] === "K-905")
    .map((m) => m[1]);
  expect(mine.sort()).toEqual([
    "tk-private",
    "tk-share",
    "tk-share-empty",
    "tk-share-failed",
    "tk-share-saving",
    "tk-shown",
    "tk-shown-readonly",
    "tk-unshare",
  ]);
  const head = readFileSync(join(ROOT, "11_tickets/K-905.md"), "utf8")
    .match(/^mock:\s*\[(.*)\]$/m)![1]!
    .split(",")
    .map((s) => s.trim());
  expect(head.sort()).toEqual(mine.sort());
  const views = readFileSync(join(ROOT, "apps/web/features/F11/share/views.tsx"), "utf8").replace(/\/\/.*$/gm, "");
  expect(views).not.toMatch(/\bfetch\(|from "@\/lib\/api|useRouter/);
});

// ---------------------------------------------------------------- チャットの頭の印（まとめ役の決め 1：K-905 が `from_request` で引く）
const GUEST_W: Who = {
  member_id: "11111111-0000-4000-8000-0000000000b1",
  display_name: "鈴木 健太 様",
  call_name: null,
};
const fromReq = (who: Who, at: string, body: string) =>
  post(who, at, body, { can_edit: false, can_delete: false, from_request: true } as Partial<MessageView>);

test("K905-UI-017 見せているチケットのやり取りの頭に印「ゲストに見えるやり取り」：見せているとき（詳細の答えの guest_share.shared が空でない）だけ出る（見せていなければ無い）・見せる相手の口は 0 回", async ({
  page,
}) => {
  await mockThread(page, { items: THREAD_FULL(), extra: { guest_share: shareOf([GG.seiko], true) } });
  const s = await mockShares(page, { shared: [GG.seiko] }, false);
  await loginAs(page, owner.token);
  await openThread(page);
  await expect(panel(page).getByText("ゲストに見えるやり取り", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(s.reads, "印は詳細の答えで出す").toBe(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockThread(page, { items: THREAD_FULL(), extra: { guest_share: shareOf([], true) } });
  await mockShares(page, { shared: [] }, false);
  await openThread(page);
  await expect(panel(page).getByText("ゲストに見えるやり取り", { exact: true })).toHaveCount(0);
});

test("K905-UI-018 依頼から作ったチケットのやり取り：口の書き込みの `from_request: true` の頭の連続に札「依頼のやり取り」・その最後の下に区切り「ここからチケットのやり取り」。鍵の無い書き込みだけなら札も区切りも無い", async ({
  page,
}) => {
  const items = [
    fromReq(GUEST_W, "2026-11-23 10:20", "12 月分の作業報告書もほしいです。"),
    fromReq(TAKA_W, "2026-11-23 10:42", "12/26 までにお送りします。"),
    post(SUZU_W, "2026-11-23 12:00", "作業を始めました。"),
  ];
  await mockThread(page, { items, extra: { guest_share: shareOf([GG.seiko], true) } });
  await mockShares(page, { shared: [GG.seiko] }, false);
  await loginAs(page, owner.token);
  await openThread(page);
  const chat = panel(page);
  await expect(chat.getByText("依頼のやり取り", { exact: true })).toHaveCount(1);
  await expect(chat.getByText("ここからチケットのやり取り", { exact: true })).toHaveCount(1);
  const order = await chat.locator("[role='feed'] > *").allInnerTexts();
  const iMark = order.findIndex((t) => t.includes("依頼のやり取り"));
  const iHead = order.findIndex((t) => t.includes("12 月分の作業報告書もほしいです。"));
  const iSplit = order.findIndex((t) => t.includes("ここからチケットのやり取り"));
  const iMine = order.findIndex((t) => t.includes("作業を始めました。"));
  expect(iMark).toBeLessThan(iHead);
  expect(iHead).toBeLessThan(iSplit);
  expect(iSplit).toBeLessThan(iMine);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockThread(page, {
    items: [post(SUZU_W, "2026-11-23 12:00", "作業を始めました。")],
    extra: { guest_share: shareOf([], true) },
  });
  await mockShares(page, { shared: [] }, false);
  await openThread(page);
  await expect(panel(page).getByText("依頼のやり取り", { exact: true })).toHaveCount(0);
  await expect(panel(page).getByText("ここからチケットのやり取り", { exact: true })).toHaveCount(0);
});
