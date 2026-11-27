// K-735「画面：承認を取り下げる（実行待ちの帯の［承認を取り下げる］・確かめの小窓・取り下げた後の 1 行・間に合わなかったとき）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5/withdraw-*（代表が OK を出した段 6 の下絵）。字・並び・ボタンは下絵が正。
//   土台は approve-complete.harness.ts の mockApi。取り下げの口 withdrawApproval（K-733）・決めた履歴 listApprovalHistory（K-750）・実行は
//   段 6 の道具 f5-more-kit.ts の layer で重ねる（答えの形は 11_tickets/K-733.md・K-750.md）。固定の待ちは使わない。name は exact
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { ME, bandOf, mockApi, openTicket, pending, ticketOf, type Mock } from "../features/F5/approve-complete.harness";
import {
  BAND_PAIRS,
  DIALOG_PAIRS,
  DOWN,
  TARGET,
  TICKET,
  WIDTHS,
  SHEET_GAP,
  confirmOf,
  layer,
  msg,
  noOverflow,
  noticeOf,
  refuse,
  runReplies,
  runRow,
  trailOf,
  type Writes,
} from "./f5-more-kit";
import { matchMock } from "./stage2-match";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const WITHDRAW = /^\/api\/v1\/approvals\/[^/]+\/withdraw$/;
const HISTORY = "/api/v1/approvals/history";
const APPROVED = "0193c5a0-0000-7000-8000-0000000a0d01";
const MSG = {
  title: "実行待ち ・ PC が受け取るのを待っています",
  sub: "PC が受け取るまでは承認を取り下げられます",
  btn: "承認を取り下げる",
  dlgTitle: "承認を取り下げます",
  dlgBody: `${TARGET}。PC がまだ受け取っていないので、承認待ちに戻せます。戻したあと、もう一度決められます`,
  done: "高本が承認を取り下げました（承認待ちに戻りました）",
} as const;

interface W {
  m: Mock;
  w: Writes;
  run: Record<string, unknown>;
  history: Record<string, unknown>[];
}
const histRow = (o: Record<string, unknown> = {}) => ({
  id: APPROVED,
  ticket_id: TICKET,
  ticket_number: "EG-133",
  title: "11 月分の請求書を送る",
  decision: "approve",
  decided_at: new Date().toISOString(),
  reason: null,
  next_actor: null,
  withdrawn_at: null,
  run_status: "queued",
  can_withdraw: true,
  ...o,
});
/** 承認の後の実行が実行待ち。by が自分（承認した本人）なら取り下げられる */
async function mockWithdraw(page: Page, o: { pc?: string; byMe?: boolean } = {}): Promise<W> {
  const run = runRow({
    phase: "execute",
    status: "queued",
    pc: o.pc ?? "live",
    by:
      o.byMe === false
        ? { member_id: "11111111-0000-4000-8000-000000000009", display_name: "佐藤" }
        : { member_id: ME, display_name: "高本" },
  });
  const m = await mockApi(page, { stage: "running", run: { phase: "execute", status: "queued", pc: o.pc ?? "live" } });
  const s: W = { m, w: undefined as unknown as Writes, run, history: [histRow()] };
  const runs = runReplies(() => s.run);
  s.w = await layer(page, (req, path) => {
    if (req.method() === "POST" && WITHDRAW.test(path)) {
      m.on.ticket = () => ({
        status: 200,
        body: { data: ticketOf({ stage: "awaiting_approval", approval: pending() }) },
      });
      s.run = runRow({ phase: "execute", status: "cancelled", by: s.run["by"] });
      return {
        status: 201,
        body: {
          data: {
            id: APPROVED,
            withdrawn_at: new Date().toISOString(),
            ticket_id: TICKET,
            approval_id: "0193c5a0-0000-7000-8000-0000000a0002",
          },
        },
      };
    }
    if (path === HISTORY) return { status: 200, body: { data: s.history, meta: { limit: 20, counts: {} } } };
    return runs(path);
  });
  return s;
}
const btn = (page: Page) => bandOf(page).getByRole("button", { name: MSG.btn, exact: true });
const go = (page: Page) =>
  confirmOf(page).locator(".k-dialog-actions").getByRole("button", { name: "取り下げる", exact: true });

test("K735-UI-001 入口：承認の後の実行が queued・PC が開いている・見ている人が承認した本人なら、承認と実行の帯に箱「実行待ち ・ PC が受け取るのを待っています」・要約に「PC が受け取るまでは承認を取り下げられます」・acts は押せる「承認を取り下げる」1 つ。「実行中」の箱は無い", async ({
  page,
}) => {
  await mockWithdraw(page);
  await openTicket(page);
  const band = bandOf(page);
  await expect(band.getByRole("heading", { name: MSG.title, exact: true })).toBeVisible();
  await expect(band.locator(".k-band-sub")).toContainText(MSG.sub);
  await expect(band.locator(".k-band-acts").getByRole("button")).toHaveText([MSG.btn]);
  await expect(btn(page)).toBeEnabled();
  await expect(band.getByText("実行中", { exact: true })).toHaveCount(0);
});

test("K735-UI-002 入口：PC が閉じている（asleep）なら箱「実行待ち ・ PC が閉じています」と前の文のまま、acts に「PC をつなぐ」（/setup/bridge）と押せる「承認を取り下げる」", async ({
  page,
}) => {
  await mockWithdraw(page, { pc: "asleep" });
  await openTicket(page);
  const band = bandOf(page);
  await expect(band.getByText("実行待ち ・ PC が閉じています", { exact: true })).toBeVisible();
  await expect(band.getByRole("link", { name: "PC をつなぐ", exact: true })).toHaveAttribute("href", "/setup/bridge");
  await expect(btn(page)).toBeEnabled();
});

test("K735-UI-003 守り：見ている人が承認した人でない（実行の by が別の人）なら「承認を取り下げる」が無く決めた履歴の口も呼ばない。決めた履歴にこのチケットの取り下げられる行が無い（can_withdraw が false・別のチケットの行だけ）ときも無い", async ({
  page,
}) => {
  const a = await mockWithdraw(page, { byMe: false });
  await openTicket(page);
  await expect(bandOf(page)).toContainText("実行中");
  await expect(btn(page)).toHaveCount(0);
  expect(a.w.reads(HISTORY)).toBe(0);
  for (const rows of [
    [histRow({ can_withdraw: false })],
    [histRow({ ticket_id: "0193c5a0-0000-7000-8000-00000000c066" })],
  ]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const b = await mockWithdraw(page);
    b.history = rows;
    await openTicket(page);
    await expect.poll(() => b.w.reads(HISTORY)).toBeGreaterThan(0);
    await expect(bandOf(page).locator(".k-band")).toHaveCount(1);
    await expect(btn(page)).toHaveCount(0);
  }
});

test("K735-UI-004 入力：「承認を取り下げる」で口を呼ばずに小窓「承認を取り下げます」（本文と足「やめる」「取り下げる」）。「取り下げる」で取り下げの口に 1 回（決めた履歴の行の id・体は {}）。小窓が閉じ、承認の帯「あなたの承認を待っています」とその下に 1 行「MM/DD HH:MM 高本が承認を取り下げました（承認待ちに戻りました）」。やり取りを読み直す", async ({
  page,
}) => {
  const s = await mockWithdraw(page);
  await openTicket(page);
  const tl0 = s.w.reads(`/api/v1/tickets/${TICKET}/timeline`);
  await btn(page).click();
  const d = confirmOf(page);
  await expect(d.getByRole("heading", { name: MSG.dlgTitle, exact: true })).toBeVisible();
  await expect(d.getByText(MSG.dlgBody, { exact: true })).toBeVisible();
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText(["やめる", "取り下げる"]);
  expect(s.w.of(WITHDRAW)).toHaveLength(0);
  await go(page).click();
  await expect.poll(() => s.w.of(WITHDRAW).length).toBe(1);
  expect(s.w.of(WITHDRAW)[0]).toEqual({ method: "POST", path: `/api/v1/approvals/${APPROVED}/withdraw`, body: {} });
  await expect(confirmOf(page)).toHaveCount(0);
  await expect(bandOf(page)).toContainText("あなたの承認を待っています");
  await expect(trailOf(page)).toHaveCount(1);
  await expect(trailOf(page).locator("time")).toHaveText(/^\d\d\/\d\d \d\d:\d\d$/);
  await expect(trailOf(page)).toContainText(MSG.done);
  await expect.poll(() => s.w.reads(`/api/v1/tickets/${TICKET}/timeline`)).toBeGreaterThan(tl0);
});

test("K735-UI-005 失敗：手順 S1 の失敗（409・E-APR-010 PC がもう受け取って動かしている）は小窓を閉じ、帯の上の知らせに「もう実行が始まっています。止めるには［止める］を押してください」。読み直した帯は「実行中」の箱で「承認を取り下げる」は無い", async ({
  page,
}) => {
  const s = await mockWithdraw(page);
  await openTicket(page);
  s.w.next.push(refuse(409, "E-APR-010"));
  await btn(page).click();
  s.run = runRow({ phase: "execute", status: "running", by: { member_id: ME, display_name: "高本" } });
  s.history = [histRow({ run_status: "running", can_withdraw: false })];
  await go(page).click();
  await expect(confirmOf(page)).toHaveCount(0);
  await expect(noticeOf(page)).toHaveText(msg("E-APR-010"));
  await expect(noticeOf(page)).toHaveText("もう実行が始まっています。止めるには［止める］を押してください");
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(btn(page)).toHaveCount(0);
});

test("K735-UI-006 失敗：手順 S1 の失敗（409・E-APR-011・E-APR-012・403・503）はどれも小窓を閉じ、帯の上の知らせに正本の文", async ({
  page,
}) => {
  const s = await mockWithdraw(page);
  await openTicket(page);
  for (const [r, text] of [
    [refuse(409, "E-APR-011"), msg("E-APR-011")],
    [refuse(409, "E-APR-012"), msg("E-APR-012")],
    [refuse(403, "FORBIDDEN", "forbidden"), msg("E-PAGE-002")],
    [DOWN, msg("E-PAGE-003")],
  ] as const) {
    s.w.next.push(r);
    await btn(page).click();
    await go(page).click();
    await expect(confirmOf(page)).toHaveCount(0);
    await expect(noticeOf(page)).toHaveText(text);
  }
});

test("K735-UI-007 操作：小窓の「やめる」・Esc は口を呼ばずに閉じ、焦点は「承認を取り下げる」へ戻る", async ({
  page,
}) => {
  const s = await mockWithdraw(page);
  await openTicket(page);
  for (const c of [
    () => confirmOf(page).getByRole("button", { name: "やめる", exact: true }).click(),
    () => page.keyboard.press("Escape"),
  ]) {
    await btn(page).click();
    await expect(confirmOf(page)).toBeVisible();
    await c();
    await expect(confirmOf(page)).toHaveCount(0);
    await expect(btn(page)).toBeFocused();
  }
  expect(s.w.of(WITHDRAW)).toHaveLength(0);
});

test("K735-UI-008 操作の揺れ：答えを止めた間に「取り下げる」を 2 回押しても口は 1 回。待つ間は主ボタンが処理中で小窓は閉じない", async ({
  page,
}) => {
  const s = await mockWithdraw(page);
  await openTicket(page);
  const release = s.w.hold();
  await btn(page).click();
  await go(page).click();
  await expect.poll(() => s.w.of(WITHDRAW).length).toBe(1);
  await go(page).click({ force: true });
  await expect(go(page)).toHaveAttribute("aria-busy", "true");
  await expect(confirmOf(page)).toBeVisible();
  release();
  await expect(confirmOf(page)).toHaveCount(0);
  expect(s.w.of(WITHDRAW)).toHaveLength(1);
});

test("K735-UI-009 時間の流れ：開いた後に PC が受け取って実行が running に替わる（3 秒の読み直し）と、「承認を取り下げる」が消えて「実行中」の箱になる", async ({
  page,
}) => {
  await page.clock.install();
  const s = await mockWithdraw(page);
  await openTicket(page);
  await expect(btn(page)).toBeVisible();
  s.run = runRow({ phase: "execute", status: "running", by: { member_id: ME, display_name: "高本" } });
  s.m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "running", pc: "live" } }) },
  });
  s.history = [histRow({ run_status: "running", can_withdraw: false })];
  await page.clock.fastForward(3_500);
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(btn(page)).toHaveCount(0);
});

test("K735-UI-010 画面：キーボードだけで、Tab で「承認を取り下げる」に届き Enter で小窓が開き、Esc で閉じて焦点が戻る", async ({
  page,
}) => {
  await mockWithdraw(page);
  await openTicket(page);
  await btn(page).focus();
  await page.keyboard.press("Enter");
  await expect(confirmOf(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(btn(page)).toBeFocused();
});

test("K735-UI-011 画面：幅 375・768・1440 で小窓は横溢れ 0・足の 2 つが画面の中。375 では小窓の下の端が画面の下の端から 16px（±1・下絵の下から出す形の余白）", async ({
  page,
}) => {
  for (const w of WIDTHS) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockWithdraw(page);
    await openTicket(page, w);
    await btn(page).click();
    await expect(confirmOf(page)).toBeVisible();
    await noOverflow(page, w);
    for (const b of await confirmOf(page).locator(".k-dialog-actions").getByRole("button").all())
      await expect(b).toBeInViewport();
    if (w === 375) {
      const r = await confirmOf(page).boundingBox();
      expect(r && Math.abs(812 - (r.y + r.height) - SHEET_GAP) <= 1).toBe(true);
    }
  }
});

test("K735-UI-012 守り：開く・小窓を開く・やめるだけでは書く口 0。書く口は取り下げの口だけで、本人の Bridge に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("127.0.0.1:38617")) bridge.push(r.url());
  });
  const s = await mockWithdraw(page);
  await openTicket(page);
  await btn(page).click();
  await confirmOf(page).getByRole("button", { name: "やめる", exact: true }).click();
  expect(s.w.all).toEqual([]);
  await btn(page).click();
  await go(page).click();
  await expect.poll(() => s.w.all.length).toBe(1);
  expect(WITHDRAW.test(s.w.all[0]!.path)).toBe(true);
  expect(bridge).toEqual([]);
});

test("K735-UI-013 画面：下絵との突き合わせ（withdraw-band・withdraw-confirm・withdraw-done）。幅 375・768・1440 で帯の箱・題と要約・acts・小窓の箱と題と足・帯の下の 1 行の形が下絵と同じ", async ({
  browser,
}) => {
  const drives: [string, (p: Page) => Promise<void>, boolean][] = [
    [
      "withdraw-band",
      async (p) => {
        await mockWithdraw(p);
        await openTicket(p, 1440);
        await expect(btn(p)).toBeVisible();
      },
      false,
    ],
    [
      "withdraw-confirm",
      async (p) => {
        await mockWithdraw(p);
        await openTicket(p, 1440);
        await btn(p).click();
      },
      true,
    ],
    [
      "withdraw-done",
      async (p) => {
        await mockWithdraw(p);
        await openTicket(p, 1440);
        await btn(p).click();
        await go(p).click();
        await expect(trailOf(p)).toHaveCount(1);
      },
      false,
    ],
  ];
  for (const [id, drive, dialog] of drives) {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (p) => {
          await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
          await drive(p);
        },
        { base: "/dev/mock/f5", pairs: dialog ? DIALOG_PAIRS : BAND_PAIRS, blur: true },
      );
      expect(rows.length, `${id}・幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, `${id}・幅 ${w}\n${bad.join("\n")}`).toEqual([]);
    }
  }
});

test("K735-UI-014 入口（ファイルを読む）：先 features/F5/more/fills/withdraw.tsx が ExecuteQueuedFill を export し、withdrawApproval は features/F5/withdraw/ からだけ呼ばれる", () => {
  const fill = join(WEB, "features/F5/more/fills/withdraw.tsx");
  expect(existsSync(fill)).toBe(true);
  expect(readFileSync(fill, "utf8")).toMatch(/export function ExecuteQueuedFill\b/);
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? files(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
    );
  const callers = files(join(WEB, "features")).filter((f) => /"withdrawApproval"/.test(readFileSync(f, "utf8")));
  expect(callers.length).toBeGreaterThan(0);
  for (const f of callers) expect(f).toMatch(/features\/F5\/(withdraw|more\/fills\/queue-history|history)/);
});
