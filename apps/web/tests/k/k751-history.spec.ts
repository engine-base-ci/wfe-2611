// K-751「画面：決めた履歴の板（札・期間・日ごとの行・［取り消す］＝承認の取り下げ・間に合わなかったとき）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5/history-*（代表が OK を出した段 6 の下絵）。字・並び・ボタンは下絵が正。
//   土台は approve-complete.harness.ts の mockApi。決めた履歴 listApprovalHistory（K-750）と取り下げ withdrawApproval（K-733）は
//   段 6 の道具 f5-more-kit.ts の layer で重ねる。固定の待ちは使わない。name は exact
import { expect, test, type Page } from "@playwright/test";
import { mockApi, openQueue, type Mock } from "../features/F5/approve-complete.harness";
import { DIALOG_PAIRS, DOWN, TICKET, WIDTHS, layer, msg, noOverflow, refuse, type Writes } from "./f5-more-kit";
import { matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const HISTORY = "/api/v1/approvals/history";
const WITHDRAW = /^\/api\/v1\/approvals\/[^/]+\/withdraw$/;
const UNDO_ID = "0193c5a0-0000-7000-8000-0000000a0301";
const jstDate = (daysAgo: number) =>
  new Date(Date.now() + 9 * 3600_000 - daysAgo * 86400_000).toISOString().slice(0, 10);
const at = (daysAgo: number, hh: string) => new Date(`${jstDate(daysAgo)}T${hh}:00+09:00`).toISOString();
const hrow = (o: Record<string, unknown>) => ({
  id: "0193c5a0-0000-7000-8000-0000000a03ff",
  ticket_id: TICKET,
  ticket_number: "EG-133",
  title: "11 月分の請求書を送る",
  decision: "approve",
  decided_at: at(0, "15:00"),
  reason: null,
  next_actor: null,
  withdrawn_at: null,
  run_status: "done",
  can_withdraw: false,
  ...o,
});
const ROWS = () => [
  hrow({
    id: UNDO_ID,
    ticket_number: "KR-031",
    title: "入金の照合（10 月分）",
    decided_at: at(0, "10:50"),
    run_status: "queued",
    can_withdraw: true,
  }),
  hrow({ id: "0193c5a0-0000-7000-8000-0000000a0302", decided_at: at(0, "09:30"), run_status: "done" }),
  hrow({
    id: "0193c5a0-0000-7000-8000-0000000a0303",
    decision: "return",
    reason: "結論が先に見えない",
    run_status: null,
    decided_at: at(0, "08:10"),
  }),
  hrow({
    id: "0193c5a0-0000-7000-8000-0000000a0304",
    decided_at: at(1, "15:05"),
    withdrawn_at: at(1, "15:06"),
    run_status: "cancelled",
  }),
];

interface H {
  m: Mock;
  w: Writes;
  asked: URLSearchParams[];
  rows: Record<string, unknown>[];
  cursor: string | null;
  fail: boolean;
}
async function mockHistory(page: Page, o: Partial<Pick<H, "rows" | "cursor">> = {}): Promise<H> {
  const m = await mockApi(page);
  const h: H = {
    m,
    w: undefined as unknown as Writes,
    asked: [],
    rows: o.rows ?? ROWS(),
    cursor: o.cursor ?? null,
    fail: false,
  };
  h.w = await layer(page, (req, path) => {
    if (path === HISTORY) {
      const sp = new URL(req.url()).searchParams;
      h.asked.push(sp);
      if (h.fail) return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
      const d = sp.get("decision");
      const rows = d ? h.rows.filter((r) => r["decision"] === d) : h.rows;
      const meta: Record<string, unknown> = { limit: 20, counts: { total: 4, approve: 3, return: 1, stop: 0 } };
      if (h.cursor && !sp.get("cursor")) meta["cursor"] = h.cursor;
      return { status: 200, body: { data: rows, meta } };
    }
    if (req.method() === "POST" && WITHDRAW.test(path)) {
      h.rows = h.rows.map((r) =>
        r["id"] === UNDO_ID ? { ...r, can_withdraw: false, withdrawn_at: new Date().toISOString() } : r,
      );
      return {
        status: 201,
        body: {
          data: {
            id: UNDO_ID,
            withdrawn_at: new Date().toISOString(),
            ticket_id: TICKET,
            approval_id: "0193c5a0-0000-7000-8000-0000000a0399",
          },
        },
      };
    }
    return null;
  });
  return h;
}
const sheet = (page: Page) => page.getByRole("dialog", { name: "決めた履歴", exact: true });
const histBtn = (page: Page) =>
  page
    // 幅 767 以下は K-412 のカードの並び「承認待ちの一覧（スマホ）」に出る（PC の表の区画は見えない）
    .getByRole("region", { name: /^承認待ちの一覧(（スマホ）)?$/ })
    .getByRole("button", { name: "決めた履歴", exact: true });
const openSheet = async (page: Page) => {
  await histBtn(page).click();
  await expect(sheet(page)).toBeVisible();
};
const chips = (page: Page) => sheet(page).getByRole("group", { name: "絞り込み", exact: true }).getByRole("button");
const qs = (sp: URLSearchParams) => Object.fromEntries([...sp.entries()]);
const undoRow = (page: Page) => sheet(page).locator(".k-more-hist-row").filter({ hasText: "KR-031" });
/** 取り下げの確かめの小窓（Confirm＝役 alertdialog。板は dialog「決めた履歴」のまま） */
const undoConfirm = (page: Page) => page.getByRole("alertdialog", { name: "この承認を取り下げます" });
const confirmBtn = (page: Page) =>
  undoConfirm(page).locator(".k-dialog-actions").getByRole("button", { name: "取り下げる", exact: true });

test("K751-UI-001 入口：承認待ちの道具の行の「決めた履歴」で右から板（dialog「決めた履歴」）が開き、決めた履歴の口に 1 回（from は今日から 6 日前・decision なし）。開くまでは口 0", async ({
  page,
}) => {
  const h = await mockHistory(page);
  await openQueue(page);
  expect(h.asked).toHaveLength(0);
  await openSheet(page);
  await expect.poll(() => h.asked.length).toBe(1);
  expect(qs(h.asked[0]!)).toEqual({ from: jstDate(6) });
});

test("K751-UI-002 対象の状態：札が順に「すべて 4」「承認 3」「差し戻し 1」（すべてが押された形）・期間「この 1 週間 ▾」・見出しは「今日」と「MM/DD（曜）」・行は新しい順・下の注記", async ({
  page,
}) => {
  await mockHistory(page);
  await openQueue(page);
  await openSheet(page);
  await expect(chips(page)).toHaveText(["すべて 4", "承認 3", "差し戻し 1"]);
  await expect(chips(page).first()).toHaveAttribute("aria-pressed", "true");
  await expect(sheet(page).getByRole("button", { name: "この 1 週間 ▾", exact: true })).toBeVisible();
  const y = jstDate(1);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][new Date(`${y}T12:00:00+09:00`).getUTCDay()];
  await expect(sheet(page).locator("h3.k-more-day")).toHaveText([
    "今日",
    `${y.slice(5, 7)}/${y.slice(8, 10)}（${wd}）`,
  ]);
  await expect(sheet(page).locator(".k-more-hist-row time")).toHaveText(["10:50", "09:30", "08:10", "15:05"]);
  await expect(
    sheet(page).getByText(
      "「取り消す」は、実行がまだ始まっていない承認だけ。実行が始まったあとは、差し戻しの書き込みで",
      { exact: true },
    ),
  ).toBeVisible();
});

test("K751-UI-003 対象の状態：行の下の 1 行は 承認・queued「実行の予定」・done「送った」・取り下げ済み「取り下げた」・差し戻し「理由：…」・止めた「成果物は使っていません」。決めは太字、「取り消す」は can_withdraw の行だけ", async ({
  page,
}) => {
  await mockHistory(page, {
    rows: [
      ...ROWS(),
      hrow({
        id: "0193c5a0-0000-7000-8000-0000000a0305",
        decision: "stop",
        run_status: null,
        decided_at: at(1, "09:00"),
      }),
    ],
  });
  await openQueue(page);
  await openSheet(page);
  await expect(sheet(page).locator(".k-more-hist-sub")).toHaveText([
    "実行の予定",
    "送った",
    "理由：結論が先に見えない",
    "取り下げた",
    "成果物は使っていません",
  ]);
  await expect(sheet(page).locator(".k-more-hist-row b")).toHaveText(["承認", "承認", "差し戻し", "承認", "止めた"]);
  await expect(undoRow(page)).toContainText("KR-031 入金の照合（10 月分）");
  await expect(sheet(page).getByRole("button", { name: "取り消す", exact: true })).toHaveCount(1);
  await expect(undoRow(page).getByRole("button", { name: "取り消す", exact: true })).toBeVisible();
});

test("K751-UI-004 入口：承認待ちが空の画面の「決めた履歴」でも同じ板が開く", async ({ page }) => {
  const h = await mockHistory(page);
  h.m.on.queue = () => ({ status: 200, body: { data: [], meta: { limit: 20, counts: { total: 0 } } } });
  await openQueue(page);
  await page.locator('#k-main [data-state="empty"]').getByRole("button", { name: "決めた履歴", exact: true }).click();
  await expect(sheet(page)).toBeVisible();
  await expect.poll(() => h.asked.length).toBe(1);
});

test("K751-UI-005 入力：札「差し戻し」で決めた履歴の口に decision=return（from は同じ）で 1 回・「差し戻し」が押された形・札の数は同じ", async ({
  page,
}) => {
  const h = await mockHistory(page);
  await openQueue(page);
  await openSheet(page);
  await chips(page).filter({ hasText: "差し戻し" }).click();
  await expect.poll(() => h.asked.length).toBe(2);
  expect(qs(h.asked[1]!)).toEqual({ from: jstDate(6), decision: "return" });
  await expect(chips(page).filter({ hasText: "差し戻し" })).toHaveAttribute("aria-pressed", "true");
  await expect(chips(page)).toHaveText(["すべて 4", "承認 3", "差し戻し 1"]);
});

test("K751-UI-006 入力：期間のボタンで箱（listbox「期間」）に「この 1 週間」「この 1 か月」「この 3 か月」。「この 1 か月」で from が今日から 29 日前の 1 回・ボタンは「この 1 か月 ▾」", async ({
  page,
}) => {
  const h = await mockHistory(page);
  await openQueue(page);
  await openSheet(page);
  await sheet(page).getByRole("button", { name: "この 1 週間 ▾", exact: true }).click();
  const box = page.getByRole("listbox", { name: "期間", exact: true });
  await expect(box.getByRole("option")).toHaveText(["この 1 週間", "この 1 か月", "この 3 か月"]);
  await box.getByRole("option", { name: "この 1 か月", exact: true }).click();
  await expect.poll(() => h.asked.length).toBe(2);
  expect(qs(h.asked[1]!)).toEqual({ from: jstDate(29) });
  await expect(sheet(page).getByRole("button", { name: "この 1 か月 ▾", exact: true })).toBeVisible();
});

test("K751-UI-007 操作の揺れ：続きがあるとき「もっと見る」の口は今の decision・from と cursor を持ち、札を替えた後の口は cursor を持たない", async ({
  page,
}) => {
  const h = await mockHistory(page, { cursor: "MjAyNnww" });
  await openQueue(page);
  await openSheet(page);
  await chips(page).filter({ hasText: "承認" }).click();
  await sheet(page).getByRole("button", { name: "もっと見る", exact: true }).click();
  await expect.poll(() => qs(h.asked.at(-1)!)).toEqual({ from: jstDate(6), decision: "approve", cursor: "MjAyNnww" });
  await chips(page).filter({ hasText: "差し戻し" }).click();
  await expect.poll(() => qs(h.asked.at(-1)!)).toEqual({ from: jstDate(6), decision: "return" });
});

test("K751-UI-008 入力：取り下げられる行の「取り消す」で口を呼ばずに小窓「この承認を取り下げます」（本文「KR-031 入金の照合（10 月分）。実行はまだ始まっていないので、承認待ちに戻せます」・足「やめる」「取り下げる」）", async ({
  page,
}) => {
  const h = await mockHistory(page);
  await openQueue(page);
  await openSheet(page);
  await undoRow(page).getByRole("button", { name: "取り消す", exact: true }).click();
  const d = undoConfirm(page);
  await expect(
    d.getByText("KR-031 入金の照合（10 月分）。実行はまだ始まっていないので、承認待ちに戻せます", { exact: true }),
  ).toBeVisible();
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText(["やめる", "取り下げる"]);
  expect(h.w.of(WITHDRAW)).toHaveLength(0);
});

test("K751-UI-009 入力：小窓の「取り下げる」で取り下げの口に 1 回（行の id・体は {}）。小窓が閉じ、決めた履歴と承認待ちの一覧を読み直し、その行の「取り消す」が消える", async ({
  page,
}) => {
  const h = await mockHistory(page);
  await openQueue(page);
  await openSheet(page);
  const q0 = h.m.queueReads;
  await undoRow(page).getByRole("button", { name: "取り消す", exact: true }).click();
  await confirmBtn(page).click();
  await expect.poll(() => h.w.of(WITHDRAW).length).toBe(1);
  // 書いた口の控え（f5-more-kit の layer・K-730）は method も持つ（K734・K735 と同じ形で見る）
  expect(h.w.of(WITHDRAW)[0]).toEqual({ method: "POST", path: `/api/v1/approvals/${UNDO_ID}/withdraw`, body: {} });
  await expect(page.getByRole("heading", { name: "この承認を取り下げます", exact: true })).toHaveCount(0);
  await expect.poll(() => h.asked.length).toBeGreaterThan(1);
  await expect.poll(() => h.m.queueReads).toBeGreaterThan(q0);
  await expect(undoRow(page).getByRole("button", { name: "取り消す", exact: true })).toHaveCount(0);
});

test("K751-UI-010 失敗：手順 S1 の失敗（409・E-APR-010）は小窓を閉じ、承認待ちの画面の上に「もう実行が始まっているので、取り消せません。差し戻しの書き込みで知らせてください」（role=alert）。決めた履歴を読み直す", async ({
  page,
}) => {
  const h = await mockHistory(page);
  await openQueue(page);
  await openSheet(page);
  h.w.next.push(refuse(409, "E-APR-010"));
  const n = h.asked.length;
  await undoRow(page).getByRole("button", { name: "取り消す", exact: true }).click();
  await confirmBtn(page).click();
  // 決めた履歴の板（modal）は開いたままなので、後ろの承認待ちの画面は読み上げの木から外れる（aria-hidden）。見えているかで確かめる
  await expect(
    page
      .locator("#k-main")
      .getByRole("alert", { includeHidden: true })
      .filter({ hasText: "もう実行が始まっているので、取り消せません。差し戻しの書き込みで知らせてください" }),
  ).toBeVisible();
  await expect.poll(() => h.asked.length).toBeGreaterThan(n);
});

test("K751-UI-011 失敗：手順 S1 の失敗（409・E-APR-011・403・503）はどれも承認待ちの画面の上に正本の文", async ({
  page,
}) => {
  const h = await mockHistory(page);
  await openQueue(page);
  for (const [r, text] of [
    [refuse(409, "E-APR-011"), msg("E-APR-011")],
    [refuse(403, "FORBIDDEN", "forbidden"), msg("E-PAGE-002")],
    [DOWN, msg("E-PAGE-003")],
  ] as const) {
    h.rows = ROWS();
    if (!(await sheet(page).isVisible())) await openSheet(page);
    h.w.next.push(r);
    await undoRow(page).getByRole("button", { name: "取り消す", exact: true }).click();
    await confirmBtn(page).click();
    await expect(
      page.locator("#k-main").getByRole("alert", { includeHidden: true }).filter({ hasText: text }),
    ).toBeVisible(); // 板（modal）が開いたままの後ろの画面（aria-hidden）なので includeHidden で探し、見えているかで確かめる
  }
});

test("K751-UI-012 操作の揺れ：答えを止めた間に「取り下げる」を 2 回押しても口は 1 回。待つ間は主ボタンが処理中で小窓は閉じない", async ({
  page,
}) => {
  const h = await mockHistory(page);
  await openQueue(page);
  await openSheet(page);
  const release = h.w.hold();
  await undoRow(page).getByRole("button", { name: "取り消す", exact: true }).click();
  await confirmBtn(page).click();
  await expect.poll(() => h.w.of(WITHDRAW).length).toBe(1);
  await confirmBtn(page).click({ force: true });
  await expect(confirmBtn(page)).toHaveAttribute("aria-busy", "true");
  release();
  await expect(page.getByRole("heading", { name: "この承認を取り下げます", exact: true })).toHaveCount(0);
  expect(h.w.of(WITHDRAW)).toHaveLength(1);
});

test("K751-UI-013 対象の状態：この 1 週間に 0 件なら「この 1 週間に決めたものはありません」。決めた履歴の口が 503 なら「決めた履歴を読み込めませんでした」と［もう一度］で読み直す", async ({
  page,
}) => {
  const h = await mockHistory(page, { rows: [] });
  await openQueue(page);
  await openSheet(page);
  await expect(sheet(page).getByText("この 1 週間に決めたものはありません", { exact: true })).toBeVisible();
  h.fail = true;
  await chips(page).filter({ hasText: "承認" }).click();
  await expect(sheet(page).getByText("決めた履歴を読み込めませんでした", { exact: true })).toBeVisible();
  h.fail = false;
  h.rows = ROWS();
  const n = h.asked.length;
  await sheet(page).getByRole("button", { name: "もう一度", exact: true }).click();
  await expect.poll(() => h.asked.length).toBe(n + 1);
  await expect(sheet(page).locator(".k-more-hist-row")).not.toHaveCount(0);
});

test("K751-UI-014 画面：「決めた履歴」で Enter → 板の中に焦点・Esc で閉じて焦点が「決めた履歴」へ。幅 768・1440 は道具の行から、375 は空の画面から開き、どの幅でも横溢れ 0・板が画面の中", async ({
  page,
}) => {
  const h = await mockHistory(page);
  const full = h.m.on.queue;
  for (const w of WIDTHS) {
    // 375 だけ空の画面から開く。ほかの幅は並びのある形に戻す（前は 375 の空のまま 768・1440 を開いていた）
    h.m.on.queue =
      w === 375 ? () => ({ status: 200, body: { data: [], meta: { limit: 20, counts: { total: 0 } } } }) : full;
    await openQueue(page, w);
    const btn =
      w === 375
        ? page.locator('#k-main [data-state="empty"]').getByRole("button", { name: "決めた履歴", exact: true })
        : histBtn(page);
    await btn.focus();
    await page.keyboard.press("Enter");
    await expect(sheet(page)).toBeVisible();
    expect(await sheet(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await noOverflow(page, w);
    const r = await sheet(page).boundingBox();
    expect(r && r.x >= -0.5 && r.x + r.width <= w + 0.5).toBe(true);
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await expect(btn).toBeFocused();
  }
});

const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height"];
const H_PAIRS: FidelityPair[] = [
  pair("sheet", ".k62-run-sheet", ["width", "background-color", "border-top-left-radius"]),
  pair("chip", ".k62-run-chip", ["height", "background-color", "border-top-color", ...TXT]),
  pair("day", ".k-more-day", TXT),
  pair("row", ".k-more-hist-row", ["padding-top", "border-top-color"]),
  pair("sub", ".k-more-hist-sub", TXT),
  pair("note", ".k-more-hist-note", TXT),
  pair("alert", "#k-main .k-callout", ["background-color", "border-top-color", "color"]),
];
test("K751-UI-015 画面：下絵との突き合わせ（history-list・history-empty・history-undo-confirm・history-undo-late）。幅 375・768・1440 で板・札・日の見出し・行・注記・小窓・画面の上の知らせの形が下絵と同じ", async ({
  browser,
}) => {
  // 本番もモックと同じ幅で開く（前は 1440 で開いていた・K734-UI-018 と同じ直し）
  const drives: [string, (p: Page, w: number) => Promise<void>, FidelityPair[]][] = [
    [
      "history-list",
      async (p, w) => {
        await mockHistory(p);
        await openQueue(p, w);
        await openSheet(p);
      },
      H_PAIRS,
    ],
    [
      "history-empty",
      async (p, w) => {
        await mockHistory(p, { rows: [] });
        await openQueue(p, w);
        await openSheet(p);
      },
      H_PAIRS,
    ],
    [
      "history-undo-confirm",
      async (p, w) => {
        await mockHistory(p);
        await openQueue(p, w);
        await openSheet(p);
        await undoRow(p).getByRole("button", { name: "取り消す", exact: true }).click();
      },
      DIALOG_PAIRS,
    ],
    [
      "history-undo-late",
      async (p, w) => {
        const h = await mockHistory(p);
        await openQueue(p, w);
        await openSheet(p);
        h.w.next.push(refuse(409, "E-APR-010"));
        await undoRow(p).getByRole("button", { name: "取り消す", exact: true }).click();
        await confirmBtn(p).click();
        await expect(p.locator("#k-main .k-callout")).toBeVisible();
      },
      H_PAIRS,
    ],
  ];
  for (const [id, drive, pairs] of drives) {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (p) => {
          await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
          await drive(p, w);
          await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
        },
        { base: "/dev/mock/f5", pairs, blur: true },
      );
      expect(rows.length, `${id}・幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, `${id}・幅 ${w}\n${bad.join("\n")}`).toEqual([]);
    }
  }
});

test("K751-UI-016 守り：理由・題名に <img src=x onerror=alert(1)> があっても行に字のまま出て img ができず、ダイアログは開かない", async ({
  page,
}) => {
  let alerted = false;
  page.on("dialog", (d) => {
    alerted = true;
    void d.dismiss();
  });
  const bad = "<img src=x onerror=alert(1)>";
  await mockHistory(page, { rows: [hrow({ decision: "return", reason: bad, title: bad, run_status: null })] });
  await openQueue(page);
  await openSheet(page);
  await expect(sheet(page).getByText(`理由：${bad}`, { exact: true })).toBeVisible();
  await expect(page.locator("[role=dialog] img[src='x']")).toHaveCount(0);
  expect(alerted).toBe(false);
});

test("K751-UI-017 守り：承認待ちを開くだけでは決めた履歴を読まず、板を開いて閉じるだけでは書く口 0。書く口は取り下げの口だけ", async ({
  page,
}) => {
  const h = await mockHistory(page);
  await openQueue(page);
  expect(h.asked).toHaveLength(0);
  await openSheet(page);
  await page.keyboard.press("Escape");
  expect(h.w.all).toEqual([]);
  await openSheet(page);
  await undoRow(page).getByRole("button", { name: "取り消す", exact: true }).click();
  await confirmBtn(page).click();
  await expect.poll(() => h.w.all.length).toBe(1);
  expect(WITHDRAW.test(h.w.all[0]!.path)).toBe(true);
});
