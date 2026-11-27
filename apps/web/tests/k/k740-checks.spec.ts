// K-740「画面：確認の表（承認の帯の下・止まった帯の下・承認待ちの列・承認の確かめの小窓の注意とその場のチェック）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5/checks-*（代表が OK を出した段 6 の下絵）。見せ方は数だけ（D-153.3）。字・並びは下絵が正。
//   土台は approve-complete.harness.ts の mockApi。承認の 1 件の checks・実行の checks.rows（K-739）と確認項目の口（listTestSpecs・updateTestSpec・K-450）は
//   段 6 の道具 f5-more-kit.ts の layer で重ねる。固定の待ちは使わない。name は exact
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  A_OPEN,
  bandOf,
  detailOf,
  k62Band,
  mockApi,
  openQueue,
  openTicket,
  pending,
  qrow,
  ticketOf,
  withBand,
  type Band,
  type Mock,
} from "../features/F5/approve-complete.harness";
import {
  DOWN,
  TICKET,
  WIDTHS,
  confirmOf,
  layer,
  msg,
  noOverflow,
  refuse,
  runReplies,
  runRow,
  type Writes,
} from "./f5-more-kit";
import { matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const SPEC_RE = /^\/api\/v1\/test_specs\/[^/]+$/;
const SPECS = `/api/v1/tickets/${TICKET}/test-specs`;
const ROWS = [
  { id: "0193c5a0-0000-7000-8000-00000000f001", text: "金額が見積の月額と一致している", checked: true },
  { id: "0193c5a0-0000-7000-8000-00000000f002", text: "インボイスの必須記載事項を満たしている", checked: true },
  { id: "0193c5a0-0000-7000-8000-00000000f003", text: "宛名と CC が取引先のルールどおり", checked: true },
  { id: "0193c5a0-0000-7000-8000-00000000f004", text: "送る前に PDF を目で見る", checked: true },
  { id: "0193c5a0-0000-7000-8000-00000000f005", text: "山田様へのメールの文面を確かめる", checked: false },
];
const PENDING_ROWS = ROWS.map((r, i) => (i === 3 ? { ...r, checked: false } : r));
const REASON = "社内の確認だけで済む作業なので、確認項目は使わないと決めました";
const summaryOf = (rows: { checked: boolean }[]) =>
  rows.length ? `${rows.filter((r) => r.checked).length} ／ ${rows.length} 済み` : "検査なし";

interface C {
  m: Mock;
  w: Writes;
  rows: { id: string; text: string; checked: boolean }[];
  detail: number | "fail";
  version: Record<string, number>;
}
/** 承認待ち（承認する人）。承認の 1 件の checks は c.rows、確認項目の口は c.rows と版で答える */
async function mockChecks(page: Page, rows = ROWS, o: { reason?: string | null } = {}): Promise<C> {
  const band: Band = { stage: "awaiting_approval", approval: pending() };
  const m = await mockApi(page, band);
  const c: C = { m, w: undefined as unknown as Writes, rows: rows.map((r) => ({ ...r })), detail: 200, version: {} };
  m.on.ticket = () => ({
    status: 200,
    body: { data: withBand(band, { ...ticketOf(band), no_spec_reason: o.reason ?? null }) },
  });
  m.on.detail = () =>
    c.detail === "fail"
      ? { status: 500, body: { error: "internal" } }
      : { status: 200, body: { data: detailOf(A_OPEN, { checks: c.rows, check_summary: summaryOf(c.rows) }) } };
  c.w = await layer(page, (req, path) => {
    if (path === SPECS && req.method() === "GET")
      return {
        status: 200,
        body: {
          data: c.rows.map((r, i) => ({
            id: r.id,
            title: r.text,
            checked: r.checked,
            position: i,
            source: "human",
            version: c.version[r.id] ?? 1,
          })),
          meta: { count: c.rows.length, limit: 50, can_edit: true },
        },
      };
    if (req.method() === "PATCH" && SPEC_RE.test(path)) {
      const id = path.split("/").at(-1)!;
      const body = req.postDataJSON() as { version: number; checked: boolean };
      c.version[id] = body.version + 1;
      c.rows = c.rows.map((r) => (r.id === id ? { ...r, checked: body.checked } : r));
      const r = c.rows.find((x) => x.id === id)!;
      return {
        status: 200,
        body: { data: { id, title: r.text, checked: r.checked, position: 0, source: "human", version: c.version[id] } },
      };
    }
    return null;
  });
  return c;
}
const area = (page: Page) => page.getByRole("region", { name: "確認", exact: true });
const openApprove = async (page: Page) => {
  await bandOf(page).getByRole("button", { name: "承認して送る", exact: true }).click();
  await expect(confirmOf(page)).toBeVisible();
};
const pend = (page: Page) => confirmOf(page).locator("fieldset.k-more-pending");

test("K740-UI-001 対象の状態：承認待ち・確認項目 5 件のうち 4 件済みなら、成果物のカードの下の区画「確認」に「確認 4 ／ 5 済み」・表「確認の結果」の列見出し「確認項目」1 つ・5 行が口の並びで、済みは ✓（チェック済み）・まだは □（まだ）と文。だれが・いつ・根拠の字は無い", async ({
  page,
}) => {
  await mockChecks(page);
  await openTicket(page);
  const a = area(page);
  await expect(a.getByText("確認 4 ／ 5 済み", { exact: true })).toBeVisible();
  const t = a.getByRole("table", { name: "確認の結果", exact: true });
  await expect(t.getByRole("columnheader")).toHaveText(["確認項目"]);
  await expect(t.locator("tbody tr")).toHaveText(ROWS.map((r) => new RegExp(r.text)));
  await expect(t.getByLabel("チェック済み", { exact: true })).toHaveCount(4);
  await expect(t.getByLabel("まだ", { exact: true })).toHaveCount(1);
  await expect(a).not.toContainText("高本のAI");
  await expect(a).not.toContainText("根拠");
  const card = await page.getByRole("region", { name: "成果物", exact: true }).boundingBox();
  const box = await a.boundingBox();
  expect(card && box && box.y >= card.y + card.height - 1).toBe(true);
});

test("K740-UI-002 対象の状態：確認項目 0 件で使わない理由があれば「確認 検査なし」・行 0・表の下に「検査なし（理由）」。理由が無いときは「検査なし」だけ", async ({
  page,
}) => {
  await mockChecks(page, [], { reason: REASON });
  await openTicket(page);
  await expect(area(page).getByText("確認 検査なし", { exact: true })).toBeVisible();
  await expect(area(page).locator("tbody tr")).toHaveCount(0);
  await expect(area(page).getByText(`検査なし（${REASON}）`, { exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockChecks(page, [], { reason: null });
  await openTicket(page);
  await expect(area(page).locator(".k-more-reason")).toHaveText("検査なし");
});

test("K740-UI-003 失敗：承認の 1 件（getApproval）が 500 なら確認の区画が無い（数を言い切らない）", async ({
  page,
}) => {
  const c = await mockChecks(page);
  c.detail = "fail";
  await openTicket(page);
  await expect(bandOf(page)).toContainText("あなたの承認を待っています");
  await expect(area(page)).toHaveCount(0);
});

const stoppedWith = async (page: Page, checks: Record<string, unknown>, width?: number) => {
  await mockApi(page, {
    stage: "doing",
    run: { phase: "make", status: "stopped", stopped_reason: "金額が合いませんでした" },
  });
  const run = runRow({ status: "stopped", stopped_reason: "金額が合いませんでした", checks });
  const runs = runReplies(() => run);
  await layer(page, (_req, path) => runs(path));
  await (width === undefined ? openTicket(page) : openTicket(page, width));
};
test("K740-UI-004 対象の状態：作る段の止まった実行の checks.rows が 3 件のうち 1 件済みなら、止まった箱の下の区画に「確認 1 ／ 3 済み」と 3 行（✓ 1・□ 2）", async ({
  page,
}) => {
  const rows = [
    { id: "a", text: "金額が見積の月額と一致している", checked: false },
    { id: "b", text: "インボイスの必須記載事項を満たしている", checked: true },
    { id: "c", text: "送る前に PDF を目で見る", checked: false },
  ];
  await stoppedWith(page, { state: "partial", counts: { done: 1, total: 3 }, summary: "1 ／ 3 済み", rows });
  const a = k62Band(page).getByRole("region", { name: "確認", exact: true });
  await expect(a.getByText("確認 1 ／ 3 済み", { exact: true })).toBeVisible();
  await expect(a.locator("tbody tr")).toHaveCount(3);
  await expect(a.getByLabel("チェック済み", { exact: true })).toHaveCount(1);
  await expect(a.getByLabel("まだ", { exact: true })).toHaveCount(2);
});

test("K740-UI-005 対象の状態：止まった実行の checks に rows が無い（前の口の答え）なら、表「確認の結果」と「検査なし（まだ流していません）」", async ({
  page,
}) => {
  await stoppedWith(page, { state: "none" });
  await expect(k62Band(page).getByRole("table", { name: "確認の結果", exact: true })).toBeVisible();
  await expect(k62Band(page).getByText("検査なし（まだ流していません）", { exact: true })).toBeVisible();
});

const queueWith = async (page: Page) => {
  const m = await mockApi(page);
  m.on.queue = () => {
    const rows = [
      qrow("0193c5a0-0000-7000-8000-0000000a0101", { title: "見積を出す", check_summary: "4 ／ 5 済み" }),
      qrow("0193c5a0-0000-7000-8000-0000000a0102", { title: "請求書を送る", check_summary: "検査なし" }),
      qrow("0193c5a0-0000-7000-8000-0000000a0103", { title: "渡された行", check_summary: "" }),
    ];
    return { status: 200, body: { data: rows, meta: { limit: 20, counts: { total: 3 } } } };
  };
};
test("K740-UI-006 画面：承認待ちの一覧の列「確認」は口の字そのまま（「4 ／ 5 済み」・「検査なし」）、空の字の行は「—」", async ({
  page,
}) => {
  await queueWith(page);
  await openQueue(page, 1440);
  const cell = (t: string) => page.getByRole("row").filter({ hasText: t }).locator("td.k-ap-check");
  await expect(cell("見積を出す")).toHaveText("4 ／ 5 済み");
  await expect(cell("請求書を送る")).toHaveText("検査なし");
  await expect(cell("渡された行")).toHaveText("—");
});

test("K740-UI-007 画面：スマホのカード（375）に「確認 4 ／ 5 済み」の 1 行が在り、まだの行があるので印 data-open が付く。空の字の行のカードには「確認」の 1 行が無い", async ({
  page,
}) => {
  await queueWith(page);
  await openQueue(page, 375);
  const cards = page.getByRole("region", { name: "承認待ちの一覧（スマホ）", exact: true });
  const line = cards.getByText("確認 4 ／ 5 済み", { exact: true });
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute("data-open", "");
  await expect(
    cards
      .getByRole("listitem")
      .filter({ hasText: "渡された行" })
      .getByText(/^確認 /),
  ).toHaveCount(0);
});

test("K740-UI-008 入口：承認の帯の「承認して送る」の小窓に、チェックの無い 2 行があれば「チェックの無い確認項目が 2 件あります」・説明・その 2 行の文の四角（付いていない）が「成果物を目で見た」の前に在る。開いただけでは口は増えない", async ({
  page,
}) => {
  const c = await mockChecks(page, PENDING_ROWS);
  await openTicket(page);
  await openApprove(page);
  const f = pend(page);
  await expect(f.getByText("チェックの無い確認項目が 2 件あります", { exact: true })).toBeVisible();
  await expect(
    f.getByText("見て確かめた物は、ここでチェックを付けられます。付けなくても承認できます", { exact: true }),
  ).toBeVisible();
  for (const t of ["送る前に PDF を目で見る", "山田様へのメールの文面を確かめる"])
    await expect(f.getByRole("checkbox", { name: t, exact: true })).not.toBeChecked();
  const fb = await f.boundingBox();
  const seen = await confirmOf(page).getByRole("checkbox", { name: "成果物を目で見た", exact: true }).boundingBox();
  expect(fb && seen && fb.y < seen.y).toBe(true);
  expect(c.w.reads(SPECS)).toBe(0);
  expect(c.w.all).toEqual([]);
});

test("K740-UI-009 入力：小窓の四角を付けると確認項目の一覧を 1 回読み、付け外しの口に 1 回（体は { version: 読んだ版, checked: true }）。四角が付き、承認の 1 件を読み直して帯の要約が「確認 4 ／ 5 済み」に替わる", async ({
  page,
}) => {
  const c = await mockChecks(page, PENDING_ROWS);
  await openTicket(page);
  await openApprove(page);
  const box = pend(page).getByRole("checkbox", { name: "送る前に PDF を目で見る", exact: true });
  await box.check();
  await expect.poll(() => c.w.of(SPEC_RE).length).toBe(1);
  expect(c.w.reads(SPECS)).toBe(1);
  // 書いた口の控え（f5-more-kit の layer・K-730）は method も持つ（K734・K735 の行と同じ形で見る）
  expect(c.w.of(SPEC_RE)[0]).toEqual({
    method: "PATCH",
    path: `/api/v1/test_specs/${ROWS[3]!.id}`,
    body: { version: 1, checked: true },
  });
  await expect(box).toBeChecked();
  // 小窓（modal）が開いている間は外に aria-hidden が付くので、閉じてから区画を見る
  await confirmOf(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(confirmOf(page)).toHaveCount(0);
  await expect(area(page).getByText("確認 4 ／ 5 済み", { exact: true })).toBeVisible();
});

test("K740-UI-010 入力：付けた四角を外すと、付け外しの口に { version: 答えの版, checked: false } が 1 回（一覧は読み直さない）で四角が外れる", async ({
  page,
}) => {
  const c = await mockChecks(page, PENDING_ROWS);
  await openTicket(page);
  await openApprove(page);
  const box = pend(page).getByRole("checkbox", { name: "送る前に PDF を目で見る", exact: true });
  await box.check();
  await expect.poll(() => c.w.of(SPEC_RE).length).toBe(1);
  await box.uncheck();
  await expect.poll(() => c.w.of(SPEC_RE).length).toBe(2);
  expect(c.w.of(SPEC_RE)[1]!.body).toEqual({ version: 2, checked: false });
  expect(c.w.reads(SPECS)).toBe(1);
  await expect(box).not.toBeChecked();
});

test("K740-UI-011 失敗：手順 S1 の失敗（409・E-SPEC-020 先に変えられた／503）は四角が元に戻り、fieldset の中に正本の文（role=alert）。409 は確認項目の一覧と承認の 1 件を読み直す", async ({
  page,
}) => {
  const c = await mockChecks(page, PENDING_ROWS);
  await openTicket(page);
  await openApprove(page);
  for (const [r, text] of [
    [refuse(409, "E-SPEC-020"), msg("E-SPEC-020")],
    [DOWN, msg("E-PAGE-003")],
  ] as const) {
    c.w.next.push(r);
    const lists = c.w.reads(SPECS);
    const box = pend(page).getByRole("checkbox", { name: "山田様へのメールの文面を確かめる", exact: true });
    await box.click();
    await expect(pend(page).getByRole("alert")).toHaveText(text);
    await expect(box).not.toBeChecked();
    if (r.status === 409) await expect.poll(() => c.w.reads(SPECS)).toBeGreaterThan(lists);
  }
});

test("K740-UI-012 守り：チェックの無い行を残したまま「成果物を目で見た」を付けて「承認して送る」を押すと、承認の口に 1 回（体は {}）。チェックの無い行は承認を止めない", async ({
  page,
}) => {
  const c = await mockChecks(page, PENDING_ROWS);
  await openTicket(page);
  await openApprove(page);
  await confirmOf(page).getByRole("checkbox", { name: "成果物を目で見た", exact: true }).check();
  await confirmOf(page).locator(".k-dialog-actions").getByRole("button", { name: "承認して送る", exact: true }).click();
  await expect.poll(() => c.m.approves.length).toBe(1);
  expect(c.m.approves[0]!.body).toEqual({});
});

test("K740-UI-013 入口：承認待ちの一覧の行の「承認する」の小窓には「チェックの無い確認項目」の字も四角の行も無く、口も増えない", async ({
  page,
}) => {
  const m = await mockApi(page);
  const w = await layer(page, () => null);
  await openQueue(page);
  await page
    .getByRole("row")
    .filter({ hasText: "見積を出す" })
    .getByRole("button", { name: "承認する", exact: true })
    .click();
  await expect(confirmOf(page)).toBeVisible();
  await expect(confirmOf(page).getByText(/チェックの無い確認項目/)).toHaveCount(0);
  await expect(confirmOf(page).locator("fieldset.k-more-pending")).toHaveCount(0);
  expect(w.reads(SPECS)).toBe(0);
  expect(m.approves).toHaveLength(0);
});

test("K740-UI-014 守り：確認項目の文に HTML（<img src=x onerror=alert(1)> と <b>太字</b>）があっても、区画と小窓に字のまま出て img も b もできず、ダイアログ（alert）は開かない", async ({
  page,
}) => {
  const bad = [
    { id: "x1", text: "<img src=x onerror=alert(1)>", checked: false },
    { id: "x2", text: "<b>太字</b>", checked: true },
  ];
  let alerted = false;
  page.on("dialog", (d) => {
    alerted = true;
    void d.dismiss();
  });
  await mockChecks(page, bad);
  await openTicket(page);
  await expect(area(page).getByText("<img src=x onerror=alert(1)>", { exact: true })).toBeVisible();
  await expect(area(page).getByText("<b>太字</b>", { exact: true })).toBeVisible();
  await expect(area(page).locator("b")).toHaveCount(0);
  await expect(page.locator("#k-main img[src='x']")).toHaveCount(0);
  await openApprove(page);
  await expect(pend(page).getByText("<img src=x onerror=alert(1)>", { exact: true })).toBeVisible();
  await expect(page.locator("[role=alertdialog] img[src='x'], [role=alertdialog] b")).toHaveCount(0);
  expect(alerted).toBe(false);
});

test("K740-UI-015 入力：とても長い確認項目の文（空白の無い 600 字）と空の文でも、幅 375 で区画と小窓の横溢れ 0。空の文の行も □ の印の行として出る", async ({
  page,
}) => {
  const rows = [
    { id: "l1", text: "あ".repeat(600), checked: false },
    { id: "l2", text: "", checked: false },
  ];
  await mockChecks(page, rows);
  await openTicket(page, 375);
  await expect(area(page).locator("tbody tr")).toHaveCount(2);
  await noOverflow(page, 375);
  await openApprove(page);
  await noOverflow(page, 375);
});

const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height"];
const C_PAIRS: FidelityPair[] = [
  pair("checks", ".k-more-checks", ["width", "background-color", "border-top-color"]),
  pair("sum", ".k-more-sum", TXT),
  pair("table", ".k-more-checks .k-check-table", ["width", "border-top-color", "border-top-left-radius"]),
  pair("mark", ".k-more-mark", ["width", "height", "color", "background-color"]),
  pair("reason", ".k-more-reason", TXT),
  pair("cell", "td.k-ap-check", TXT),
  pair("pending", ".k-more-pending", ["background-color", "border-top-color", "padding-top"]),
  pair("choice", ".k-more-pending .k-more-choice", TXT),
];
test("K740-UI-016 画面：下絵との突き合わせ（checks-table・checks-failed・checks-queue-column・checks-approve-modal・checks-none）。幅 375・768・1440 で確認の区画・列のセル・小窓の注意と四角の形が下絵と同じ", async ({
  browser,
}) => {
  // 本番もモックと同じ幅で開く（前は 1440 で開いて、狭い幅のモックと 1440 の本番を比べていた・K734-UI-018 と同じ直し）
  const drives: [string, (p: Page, w: number) => Promise<void>][] = [
    [
      "checks-table",
      async (p, w) => {
        await mockChecks(p);
        await openTicket(p, w);
        await expect(area(p)).toBeVisible();
      },
    ],
    [
      "checks-failed",
      async (p, w) => {
        await stoppedWith(
          p,
          {
            state: "partial",
            summary: "1 ／ 3 済み",
            rows: [
              { id: "a", text: "金額", checked: false },
              { id: "b", text: "インボイス", checked: true },
              { id: "c", text: "PDF", checked: false },
            ],
          },
          w, // 本番もモックと同じ幅で開く（K734-UI-018 と同じ直し）
        );
      },
    ],
    [
      "checks-queue-column",
      async (p, w) => {
        await queueWith(p);
        await openQueue(p, w); // 本番もモックと同じ幅で開く（K734-UI-018 と同じ直し）
      },
    ],
    [
      "checks-approve-modal",
      async (p, w) => {
        await mockChecks(p, PENDING_ROWS);
        await openTicket(p, w);
        await openApprove(p);
      },
    ],
    [
      "checks-none",
      async (p, w) => {
        await mockChecks(p, [], { reason: REASON });
        await openTicket(p, w);
        await expect(area(p)).toBeVisible();
      },
    ],
  ];
  for (const [id, drive] of drives) {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (p) => {
          await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
          await drive(p, w);
        },
        { base: "/dev/mock/f5", pairs: C_PAIRS, blur: true },
      );
      expect(rows.length, `${id}・幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, `${id}・幅 ${w}\n${bad.join("\n")}`).toEqual([]);
    }
  }
});

test("K740-UI-017 守り：詳細・承認待ちを開くだけでは口が増えない（承認の 1 件・詳細・一覧は 1 本ずつ・確認項目の一覧は 0）。書く口は付け外しと承認だけで、本人の Bridge に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("127.0.0.1:38617")) bridge.push(r.url());
  });
  const c = await mockChecks(page);
  await openTicket(page);
  await expect(area(page)).toBeVisible();
  expect(c.w.reads(`/api/v1/approvals/${A_OPEN}`)).toBe(1);
  expect(c.w.reads(SPECS)).toBe(0);
  expect(c.w.all).toEqual([]);
  expect(bridge).toEqual([]);
});

test("K740-UI-018 入口（ファイルを読む）：先 features/F5/more/fills/checks.tsx が ChecksFill・ApproveChecksFill・QueueCheckCellFill を export し、updateTestSpec を呼ぶ段 6 のファイルは features/F5/checks/ だけ", () => {
  const fill = join(WEB, "features/F5/more/fills/checks.tsx");
  expect(existsSync(fill)).toBe(true);
  const src = readFileSync(fill, "utf8");
  for (const n of ["ChecksFill", "ApproveChecksFill", "QueueCheckCellFill"])
    expect(src).toMatch(new RegExp(`export function ${n}\\b`));
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? files(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
    );
  const f5 = files(join(WEB, "features/F5")).filter((f) => /"updateTestSpec"/.test(readFileSync(f, "utf8")));
  expect(f5.length).toBeGreaterThan(0);
  for (const f of f5) expect(f).toContain(join("features", "F5", "checks"));
});
