// K-730「段 6 の下絵の部品とモック（/dev/mock/f5 の 94 の状態）を本線に入れ、帯・承認待ち・右のパネルに段 6 の画面の葉の差し込み口を足す（W0）」の試験
//   （実 Chrome と、ファイルを読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f5（索引と 94 の状態・代表が OK を出した下絵）と、差し込み口の器 features/F5/more/slots.tsx・先 fills/・帯の下の 1 行 trail.ts。
//   差し込み口の先は最初、今の本線と同じ物を返す：本番の画面の行（006〜013・018）は「今と同じ」を見る（前からの土台 approve-complete.harness.ts の mockApi）。
//   固定の待ちは使わない。name は exact。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { BUILT_ROUTES } from "../../lib/built-routes";
import {
  bandOf,
  k62Band,
  mockApi,
  openQueue,
  openTicket,
  pending,
  ticketOf,
  type Band,
} from "../features/F5/approve-complete.harness";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const MOCKS_SRC = join(WEB, "app/(dev)/dev/mock/f5/mocks.tsx");
const MORE = join(WEB, "features/F5/more");
const WIDTHS = [375, 768, 1440] as const;
const read = (f: string) => readFileSync(f, "utf8");
const code = (f: string) =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** MOCKS の並びを、機械（canvas_field_gate.py）と同じ読み方で読む */
function entries(): { id: string; ps: string; ticket: string }[] {
  const arr = /export const MOCKS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(read(MOCKS_SRC))?.[1] ?? "";
  return [...arr.matchAll(/\{\s*id:\s*"([^"]+)",[^{}]*?\bps:\s*"([^"]*)",[^{}]*?\bticket:\s*"([^"]*)"[^{}]*?\}/g)].map(
    (m) => ({ id: m[1]!, ps: m[2]!, ticket: m[3]! }),
  );
}
const STATES = entries();

/** 状態の持ち主（切り方.md の画面の葉の表）。頭の字で決まり、例外は下の EXCEPT */
const OWNER_BY_HEAD: [RegExp, string][] = [
  [/^stop-/, "K-734"],
  [/^withdraw-/, "K-735"],
  [/^checks-/, "K-740"],
  [/^selfedit-/, "K-743"],
  [/^return-/, "K-745"],
  [/^dry-/, "K-747"],
  [/^queue-filter-/, "K-749"],
  [/^history-/, "K-751"],
  [/^focus-/, "K-752"],
  [/^bulk-/, "K-769"],
  [/^room-/, "K-755"],
  [/^done-/, "K-756"],
  [/^talk-/, "K-762"],
  [/^tk-talk-/, "K-764"],
  [/^create-talk-/, "K-767"],
];
const EXCEPT: Record<string, string> = {
  "tk-talk-from-create": "K-767",
  "create-talk-proposal": "K-777",
  "create-talk-select": "K-777",
  "create-talk-applied-all": "K-777",
  "create-talk-applied-some": "K-777",
};
const ownerOf = (id: string) => EXCEPT[id] ?? OWNER_BY_HEAD.find(([re]) => re.test(id))?.[1] ?? "(無い)";

/** 差し込み口の器（slots.tsx）と先（fills/<束>.tsx）の名前 */
const SLOTS: Record<string, string[]> = {
  "fills/stop.tsx": ["StopRunActSlot", "RunStoppedSlot", "StopApprovalActSlot"],
  "fills/withdraw.tsx": ["ExecuteQueuedSlot"],
  "fills/checks.tsx": ["ChecksSlot", "ApproveChecksSlot", "QueueCheckCellSlot"],
  "fills/self-edit.tsx": ["SelfEditActSlot", "ArtifactAreaSlot"],
  "fills/dry-run.tsx": ["DryRunActSlot", "DryRunSlot"],
  "fills/queue-tools.tsx": ["QueueToolsSlot", "QueueEmptySlot"],
  "fills/queue-history.tsx": ["QueueHistorySlot"],
  "fills/queue-focus.tsx": ["QueueFocusSlot"],
  "fills/queue-bulk.tsx": ["QueueBulkSlot"],
  "fills/talk.tsx": ["TalkActSlot", "TicketAiTabButtonSlot", "TicketAiTabSlot"],
};
/** 帯・承認待ち・右のパネルのファイルが import する器 */
const USES: Record<string, string[]> = {
  "features/F5/delegate/delegate-band.tsx": [
    "StopRunActSlot",
    "RunStoppedSlot",
    "ChecksSlot",
    "TalkActSlot",
    "TicketTrail",
    "TicketNotice",
  ],
  "features/F5/approve-complete/decide.tsx": [
    "SelfEditActSlot",
    "StopApprovalActSlot",
    "ArtifactAreaSlot",
    "DryRunSlot",
    "ChecksSlot",
    "TicketTrail",
  ],
  "features/F5/approve-complete/band.tsx": ["StopRunActSlot", "ExecuteQueuedSlot", "TicketNotice"],
  "features/F5/approve-complete/artifact-card.tsx": ["DryRunActSlot"],
  "features/F5/approve-complete/approve-confirm.tsx": ["ApproveChecksSlot"],
  "features/F5/approve-complete/queue.tsx": ["QueueFocusSlot", "QueueHistorySlot", "QueueEmptySlot", "useQueueQuery"],
  "features/F5/approve-complete/queue-table.tsx": [
    "QueueToolsSlot",
    "QueueBulkSlot",
    "QueueHistorySlot",
    "QueueCheckCellSlot",
  ],
  "features/F5/approve-complete/queue-card.tsx": ["QueueToolsSlot", "QueueBulkSlot", "QueueCheckCellSlot"],
  "features/F6/thread/views.tsx": ["TicketAiTabButtonSlot"],
  "features/F6/thread/panel.tsx": ["TicketAiTabSlot"],
};

async function guard(page: Page, seen: string[] = []) {
  page.on("request", (r) => {
    if (/\/api\/|127\.0\.0\.1:38617/.test(r.url())) seen.push(r.url());
  });
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "モックは口を呼ばない" }));
}
async function openState(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/dev/mock/f5/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const overflowX = (page: Page) =>
  page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });

// ---------------------------------------------------------------- 下絵の置き場

test("K730-UI-001 入口：索引 /dev/mock/f5 の「状態の一覧」に 94 件のリンクが並び、どれを押しても 200 で開き、その状態の中に製品の時点の印 data-ps（PS0・PS2・PS3）と見出し h1 がある", async ({
  page,
}) => {
  test.setTimeout(240_000); // 94 の状態を開く（段 7 の k382 と同じ程度）
  expect(STATES.length, "MOCKS が読めない").toBe(94);
  await guard(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/dev/mock/f5"))?.status()).toBe(200);
  const links = page.getByRole("region", { name: "状態の一覧", exact: true }).getByRole("link");
  await expect(links).toHaveCount(94);
  for (const s of STATES) {
    await openState(page, s.id, 1440);
    const root = page.locator(`[data-mock="${s.id}"]`);
    await expect(root.locator(`[data-ps="${s.ps}"]`), `${s.id} の時点の印`).toHaveCount(1);
    expect(["PS0", "PS2", "PS3"]).toContain(s.ps);
    await expect(root.locator("h1").first(), `${s.id} の見出し`).toBeVisible();
  }
  await page.goto("/dev/mock/f5");
  await links.first().click();
  await expect(page).toHaveURL(new RegExp(`/dev/mock/f5/${STATES[0]!.id}$`));
});

for (const w of WIDTHS) {
  test(`K730-UI-002 画面：94 の状態を幅 ${w} で開くと、どれも横のはみ出しが 0 で「この状態はまだありません」が出ない`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    expect(STATES.length).toBe(94);
    await guard(page);
    for (const s of STATES) {
      await openState(page, s.id, w);
      await expect(page.getByText("この状態はまだありません", { exact: true })).toHaveCount(0);
      expect(await overflowX(page), `${s.id}・幅 ${w} の横のはみ出し`).toBe(0);
    }
  });
}

test("K730-UI-003 入口：MOCKS の 94 の ticket は切り方.md の画面の葉の持ち主の表と同じで、id の重なりが 0", () => {
  const ids = STATES.map((s) => s.id);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  for (const s of STATES) expect(s.ticket, `${s.id} の持ち主`).toBe(ownerOf(s.id));
  const written = [...read(MOCKS_SRC).matchAll(/^\s*\{ id: "/gm)].length;
  expect(STATES.length, "読めない行がある").toBe(written);
});

test("K730-UI-004 守り：94 の状態を開く間、口（/api/）にも本人の Bridge（127.0.0.1:38617）にも 1 本も要求が飛ばない", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const seen: string[] = [];
  await guard(page, seen);
  for (const s of STATES) await openState(page, s.id, 1440);
  expect(seen).toEqual([]);
});

// ---------------------------------------------------------------- 器と先（ファイル）

test("K730-UI-005 入口：器 features/F5/more/slots.tsx が 19 個の差し込み口と TicketTrail・TicketNotice を export し、先 fills/ の 10 ファイルがそれぞれの …Fill（と useQueueQuery）を export する。先は口を呼ばない", () => {
  const slots = read(join(MORE, "slots.tsx"));
  const all = Object.values(SLOTS).flat();
  expect(all).toHaveLength(19);
  for (const n of [...all, "TicketTrail", "TicketNotice"])
    expect(slots, `slots.tsx に ${n} が無い`).toMatch(new RegExp(`export function ${n}\\b`));
  for (const [file, names] of Object.entries(SLOTS)) {
    const p = join(MORE, file);
    expect(existsSync(p), `${file} が無い`).toBe(true);
    const src = code(p);
    for (const n of names) {
      const fill = n.replace(/Slot$/, "Fill");
      expect(src, `${file} に ${fill} が無い`).toMatch(new RegExp(`export function ${fill}\\b`));
    }
    expect(src, `${file} が口を呼ぶ`).not.toMatch(/\bfetch\(|\bcall\(|\/api\/v1/);
  }
  expect(code(join(MORE, "fills/queue-tools.tsx"))).toMatch(/export function useQueueQuery\b/);
});

// ---------------------------------------------------------------- 本番の画面は今と同じ

const makeBand = (status: string): Band => ({
  stage: status === "stopped" ? "doing" : "running",
  run: {
    phase: "make",
    status,
    pc: "live",
    stopped_reason: status === "stopped" ? "金額が見積と合いませんでした" : null,
  },
});

test("K730-UI-006 画面：作る段の実行が running の青い箱の acts は順に「AI と話す」「止める」、queued の箱の acts は「AI と話す」1 つ（差し込み口の場所が今の並びのまま在る）", async ({
  page,
}) => {
  const m = await mockApi(page, makeBand("running"));
  await openTicket(page);
  const box = k62Band(page);
  await expect(box).toContainText("山田のAI が作っています");
  await expect(box.locator(".k-band-acts").getByRole("button")).toHaveText(["AI と話す", "止める"]);
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf(makeBand("queued")) } });
  await page.reload();
  await expect(box).toContainText("山田のAI に任せました。");
  await expect(box.locator(".k-band-acts").getByRole("button")).toHaveText(["AI と話す"]);
});

test("K730-UI-007 画面：作る段の実行が stopped（理由が人の止めでない）の赤い箱（role=alert）は題「山田のAI が止まりました」・理由の全文・acts は「自分で直す」だけ（［直し方を AI に伝える］は無い・代表の決め answer=4d049789b537）で、箱の下に確認の結果の表（table「確認の結果」）", async ({
  page,
}) => {
  await mockApi(page, makeBand("stopped"));
  await openTicket(page);
  const box = k62Band(page);
  const alert = box.getByRole("alert");
  await expect(alert).toContainText("山田のAI が止まりました");
  await expect(alert).toContainText("金額が見積と合いませんでした");
  await expect(alert.locator(".k-band-acts").getByRole("button")).toHaveText(["自分で直す"]);
  await expect(box.getByRole("table", { name: "確認の結果", exact: true })).toBeVisible();
});

test("K730-UI-008 画面：承認待ち・承認する人の帯の acts は順に「承認して送る」「自分で直す」「差し戻す」「止める」。開いただけでは試し打ちの帯と帯の下の 1 行（.k-more-trail）と帯の上の知らせは無い", async ({
  page,
}) => {
  await mockApi(page, { stage: "awaiting_approval", approval: pending() });
  await openTicket(page);
  const band = bandOf(page);
  await expect(band).toContainText("あなたの承認を待っています");
  await expect(band.locator(".k-band").first().locator(".k-band-acts").getByRole("button")).toHaveText([
    "承認して送る",
    "自分で直す",
    "差し戻す",
    "止める",
  ]);
  await expect(band.getByText(/試し打ちを|試し打ちは/)).toHaveCount(0);
  await expect(page.locator(".k-more-trail")).toHaveCount(0);
  await expect(band.locator('.k-band-notice[data-tone="warn"]')).toHaveCount(0);
});

test("K730-UI-009 画面：成果物のカードのボタンは順に「大きく見る」「データを見る」「試し打ち（自分宛）」「先方に確かめてもらう」で、「大きく見る」は押せる", async ({
  page,
}) => {
  await mockApi(page, { stage: "awaiting_approval", approval: pending() });
  await openTicket(page);
  const card = page.getByRole("region", { name: "成果物", exact: true });
  await expect(card.getByRole("button")).toHaveText([
    "大きく見る",
    "データを見る",
    "試し打ち（自分宛）",
    "先方に確かめてもらう",
  ]);
  await expect(card.getByRole("button", { name: "大きく見る", exact: true })).toBeEnabled();
});

test("K730-UI-010 画面：承認の後の実行が running（PC が開いている）は青い箱「実行中」。queued・PC が閉じているは「実行待ち ・ PC が閉じています」と「PC をつなぐ」（/setup/bridge）", async ({
  page,
}) => {
  const m = await mockApi(page, { stage: "running", run: { phase: "execute", status: "running", pc: "live" } });
  await openTicket(page);
  const band = bandOf(page);
  await expect(band.getByText("実行中", { exact: true })).toBeVisible();
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "queued", pc: "asleep" } }) },
  });
  await page.reload();
  await expect(band.getByText("実行待ち ・ PC が閉じています", { exact: true })).toBeVisible();
  await expect(band.getByRole("link", { name: "PC をつなぐ", exact: true })).toHaveAttribute("href", "/setup/bridge");
});

test("K730-UI-011 画面：承認待ちの一覧（1440）に札「すべて 3」（押された形）・「AI の成果物」・「渡された」、並べ替えの字、［決めた履歴］、見出しの［続けて裁く（3 件）］が在る。375 のスマホのカードにも札「すべて 3」が在る", async ({
  page,
}) => {
  await mockApi(page);
  await openQueue(page, 1440);
  const list = page.getByRole("region", { name: "承認待ちの一覧", exact: true });
  const chips = list.getByRole("group", { name: "絞り込み", exact: true }).getByRole("button");
  await expect(chips.first()).toHaveText(/^すべて\s*3$/);
  await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
  for (const c of ["AI の成果物", "渡された"]) await expect(chips.filter({ hasText: c })).toHaveCount(1);
  await expect(list.getByText(/期限の近い順/)).toBeVisible();
  await expect(list.getByRole("button", { name: "決めた履歴", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "続けて裁く（3 件）", exact: true })).toBeVisible();
  await openQueue(page, 375);
  const mobile = page.getByRole("region", { name: "承認待ちの一覧（スマホ）", exact: true });
  await expect(mobile.getByRole("group", { name: "絞り込み", exact: true }).getByRole("button").first()).toHaveText(
    /^すべて\s*3$/,
  );
});

test("K730-UI-012 画面：承認の確かめの小窓（取り消せない・確認項目が 0 件の承認）は題「承認して送ります」・赤い注意「取り消せません」・四角は「成果物を目で見た」だけで、「チェックの無い確認項目」の字は無い。印を付けるまで「承認して送る」は押せない", async ({
  page,
}) => {
  await mockApi(page, { stage: "awaiting_approval", approval: pending() });
  await openTicket(page);
  await bandOf(page).getByRole("button", { name: "承認して送る", exact: true }).click();
  const d = page.getByRole("alertdialog", { name: "承認して送ります" });
  await expect(d.getByRole("heading", { name: "承認して送ります", exact: true })).toBeVisible();
  await expect(d.getByText("取り消せません", { exact: true })).toBeVisible();
  await expect(d.getByRole("checkbox")).toHaveCount(1);
  await expect(d.getByRole("checkbox", { name: "成果物を目で見た", exact: true })).toBeVisible();
  await expect(d.getByText(/チェックの無い確認項目/)).toHaveCount(0);
  await expect(d.getByRole("button", { name: "承認して送る", exact: true })).toBeDisabled();
});

test("K730-UI-013 画面：右のパネルのタブに「項目」「やり取り」「高本のAI」が順に在り、開いたときは「項目」が今いるタブ（字は K-571 が「属性」から替えた・D-150.36）", async ({
  page,
}) => {
  await mockApi(page, { stage: "doing", can_delegate: true });
  await openTicket(page);
  const tabs = page.getByRole("navigation", { name: "パネルのタブ", exact: true });
  await expect(tabs.getByRole("button")).toHaveText(["項目", "やり取り", "高本のAI"]);
  await expect(tabs.getByRole("button", { name: "項目", exact: true })).toHaveAttribute("aria-current", "page");
});

// ---------------------------------------------------------------- 帯の下の 1 行・帯が器を使う・道

test("K730-UI-014 入口：trail.ts が pushTrail・clearTrail・useTrail・pushNotice・clearNotice・useNotice・pushBand・clearBand・useBand・trailStamp を export し、trailStamp は日本時間の「MM/DD HH:MM」（2026-11-01T01:40:00Z →「11/01 10:40」）。TicketTrail は .k-more-trail・TicketNotice は NoticeBox で描く", async () => {
  const p = join(MORE, "trail.ts");
  expect(existsSync(p), "trail.ts が無い").toBe(true);
  const src = code(p);
  for (const n of [
    "pushTrail",
    "clearTrail",
    "useTrail",
    "pushNotice",
    "clearNotice",
    "useNotice",
    "pushBand",
    "clearBand",
    "useBand",
    "trailStamp",
  ])
    expect(src, `trail.ts に ${n} が無い`).toMatch(new RegExp(`export (function|const) ${n}\\b`));
  const out = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      `const m = await import(${JSON.stringify(p)}); process.stdout.write(m.trailStamp(Date.parse("2026-11-01T01:40:00Z")));`,
    ],
    { cwd: WEB, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
  );
  expect(out).toBe("11/01 10:40");
  expect(read(join(MORE, "slots.tsx"))).toMatch(/k-more-trail/);
  expect(read(join(MORE, "slots.tsx"))).toMatch(/NoticeBox/);
});

test("K730-UI-015 入口：帯・承認待ち・右のパネルのファイルが、決めた差し込み口を @/features/F5/more/slots から import する", () => {
  for (const [file, names] of Object.entries(USES)) {
    const src = code(join(WEB, file));
    const imp = /import\s*\{([^}]*)\}\s*from\s*"@\/features\/F5\/more\/slots"/.exec(src)?.[1] ?? "";
    for (const n of names) expect(imp, `${file} が ${n} を slots から読んでいない`).toMatch(new RegExp(`\\b${n}\\b`));
  }
});

test("K730-UI-016 入口：道の一覧（機械生成 scripts/ci/gen_built_routes.py）に /dev/mock/f5 と /dev/mock/f5/:id がある", () => {
  expect(BUILT_ROUTES).toContain("/dev/mock/f5");
  expect(BUILT_ROUTES).toContain("/dev/mock/f5/:id");
});

test("K730-UI-017 入口：持ち主の欄の検査 canvas_field_gate.py --no-base が 0 で終わり、読めない・重なりの語を出さない", () => {
  const out = execFileSync("python3", ["scripts/ci/canvas_field_gate.py", "--no-base"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  expect(out).toMatch(/canvas_field_gate：OK（/);
  expect(out).not.toMatch(/読めない|MOCKS の並びが無い|が 2 つある/);
});

test("K730-UI-018 守り：承認待ちを開くと listApprovalQueue は問い合わせが空の 1 本だけで、「もっと見る」の 2 本目は cursor だけ（kind・sort は付かない・差し込み口の足しは最初は空）", async ({
  page,
}) => {
  const asked: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname === "/api/v1/approvals/queue") asked.push(u.search);
  });
  const m = await mockApi(page);
  const first = m.on.queue;
  m.on.queue = async (req) => {
    const r = await first(req);
    if (new URL(req.url()).searchParams.get("cursor")) return r;
    const body = r.body as { data: unknown[]; meta: Record<string, unknown> };
    return { status: r.status, body: { ...body, meta: { ...body.meta, cursor: "bzIw" } } };
  };
  await openQueue(page);
  await expect(page.getByRole("region", { name: "承認待ちの一覧", exact: true })).toBeVisible();
  expect(asked).toEqual([""]);
  await page.getByRole("button", { name: "もっと見る", exact: true }).click();
  await expect.poll(() => asked.length).toBe(2);
  expect(asked[1]).toBe("?cursor=bzIw");
});
