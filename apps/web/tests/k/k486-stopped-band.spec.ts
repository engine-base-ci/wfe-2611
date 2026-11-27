// K-486「画面：止まった帯（理由ごとの一手・「自分で直す」・PC か AI が壊れたときの案内）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f7 の f7-stop-broken・f7-stop-retry・f7-stop-takeover・f7-stop-denied（本番と同じ部品 features/F7/stopped/views.tsx）。
//   f7-stop-pc-closed・f7-stop-ask-again は前からの承認と実行の帯（K-63）と同じ場面なので、この葉では作らない（md の決めたこと）。
//   口は網の手前で差し替える（前からの土台 mockApi の上に tests/k/stopped-mock.ts の mockStopped）。口の形と番号は K-485 の md に合わせる。
//   止まった帯が出るのは、作る段（phase make）の止まった・やめた実行で、まだ引き取っていないときだけ（承認の後の実行・動いている・待っている実行は前からの帯のまま）。
//   理由の種類は口の答えの reason_kind。理由が届かない・種類が決まらないときは「理由は届いていません」（黙って別の種類にしない）。
//   一手の押せる・押せないは、AI に任せる＝getTicket の can.delegate・自分で直す＝担当者本人（getTicket の assignee.id と /me の member_id が同じ）で決める（役の名前では決めない）。
//   押した直後の口の数は expect.poll で待つ。固定の待ちは使わない（要素と答えを待つ）。文は正本 errors.json の 1 件（番号で引く）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { openTicketSettled } from "../features/F5/approve-complete.harness";
import { ROOT, overflowX } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import {
  BRIDGE_STOPPED,
  FAILED,
  NO_REASON,
  RETRY_PAIRS,
  RUN2,
  RUN_ID,
  STOP_PAIRS,
  TICKET,
  WHO,
  btn,
  delegateSec,
  errReply,
  mockStopped,
  run,
  setupLink,
  stopBox,
  stopSec,
  takeoverDialog,
  type ReasonKind,
  type StopOptions,
} from "./stopped-mock";

const ERRORS = JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
  errors: { id: string; message: string }[];
};
const msg = (id: string): string => {
  const m = ERRORS.errors.find((e) => e.id === id)?.message;
  if (!m) throw new Error(`正本 errors.json に無い番号：${id}`);
  return m;
};
const firstSentence = (id: string) => {
  const m = msg(id);
  const i = m.indexOf("。");
  return i < 0 ? m : m.slice(0, i + 1);
};
const TITLE = `${WHO} が止まりました`;
const DELEGATE = "AI に任せる";
const HOW = "直し方を AI に伝える";
const TAKEOVER = "自分で直す";
const CONNECT = "PC をつなぐ";

/** 原因ごとの帯の字（部品 stop-copy.ts の字・モックと同じ。1 行目は理由の 1 行・2 行目は直す場所の案内） */
const BROKEN: Record<string, { kind: ReasonKind; line: () => string; sub: string }> = {
  "bridge-old": {
    kind: "bridge_outdated",
    line: () => msg("E-CONN-012"),
    sub: "「PC をつなぐ」の画面から Bridge を入れ直せます",
  },
  "claude-broken": {
    kind: "claude_missing",
    line: () => firstSentence("E-CONN-011"),
    sub: "「PC をつなぐ」の画面の「Claude Code を取り直す」で直ります",
  },
  "claude-login": {
    kind: "claude_login",
    line: () => firstSentence("E-CONN-010"),
    sub: "「PC をつなぐ」の画面の「ログインする」を押して、ブラウザで 1 回許可してください",
  },
  browser: {
    kind: "browser_unreachable",
    line: () => firstSentence("E-STP-011"),
    sub: "「PC をつなぐ」の画面に、つなぎ方と「もう一度確かめる」があります",
  },
};

async function open(page: Page, o: StopOptions = {}, width = 1440) {
  const s = await mockStopped(page, o);
  await openTicketSettled(page, width);
  return s;
}
const stopped = (reason_kind: ReasonKind, stopped_reason: string | null, extra: Parameters<typeof run>[0] = {}) => [
  run({ reason_kind, stopped_reason, ...extra }),
];

test("K486-UI-001 確認で落ちた（種類 unknown・理由の全文あり）：赤い箱（role=alert）の題「高本のAI が止まりました」・理由は全文・確認の結果の表・帯のボタンは自分で直す（押せる）だけ（AI に任せる・直し方を AI に伝える は 0 個・answer=d25f2e58bffb）", async ({
  page,
}) => {
  await open(page, { runs: stopped("unknown", FAILED) });
  await expect(stopSec(page)).toHaveCount(1);
  await expect(stopBox(page)).toHaveAttribute("role", "alert");
  await expect(stopBox(page).getByRole("heading", { level: 3 })).toHaveText(TITLE);
  await expect(stopBox(page)).toContainText(FAILED);
  await expect(page.getByRole("table", { name: "確認の結果", exact: true })).toBeVisible();
  await expect(btn(page, DELEGATE)).toHaveCount(0);
  await expect(btn(page, HOW)).toHaveCount(0);
  await expect(btn(page, TAKEOVER)).toBeEnabled();
  await expect(btn(page, TAKEOVER)).toHaveAttribute("data-variant", "outlined");
});

for (const c of Object.values(BROKEN)) {
  test(`K486-UI-002 PC か AI が壊れた（${c.kind}）：題「高本のAI が止まりました」・理由の 1 行と直す場所の案内の字・主は「PC をつなぐ」（/setup/bridge へのリンク）・AI に任せる・自分で直す（どちらも白地）。直し方を AI に伝えるは出ない`, async ({
    page,
  }) => {
    await open(page, { runs: stopped(c.kind, "（内部の文）") });
    await expect(stopBox(page).getByRole("heading", { level: 3 })).toHaveText(TITLE);
    await expect(stopBox(page).locator(".k-band-line")).toHaveText(c.line());
    await expect(stopBox(page).locator(".k-band-sub")).toHaveText(c.sub);
    await expect(setupLink(page, CONNECT)).toHaveAttribute("href", "/setup/bridge");
    await expect(setupLink(page, CONNECT)).toHaveAttribute("data-variant", "primary");
    await expect(btn(page, DELEGATE)).toHaveAttribute("data-variant", "outlined");
    await expect(btn(page, TAKEOVER)).toBeEnabled();
    await expect(btn(page, HOW)).toHaveCount(0);
  });
}

test("K486-UI-003 理由が届かない（種類 unknown・「理由は届いていません」の文）：帯の 1 行は「AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます」。理由の文が空（null）でも同じ", async ({
  page,
}) => {
  await open(page, { runs: stopped("unknown", NO_REASON) });
  await expect(stopBox(page).locator(".k-band-line")).toHaveText(NO_REASON);
  await expect(btn(page, DELEGATE)).toBeEnabled();
  await expect(btn(page, HOW)).toHaveAttribute("aria-disabled", "true");
  await open(page, { runs: stopped("unknown", null) });
  await expect(stopBox(page).locator(".k-band-line")).toHaveText(NO_REASON);
});

test("K486-UI-004 PC が途中で止まった（種類 pc_closed・文は D-129.47 のとおり）：帯の 1 行は口が返した文のまま（Bridge を開き直す案内を含む）・AI に任せる（主）・直し方・自分で直す", async ({
  page,
}) => {
  await open(page, { runs: stopped("pc_closed", BRIDGE_STOPPED) });
  await expect(stopBox(page).locator(".k-band-line")).toHaveText(BRIDGE_STOPPED);
  await expect(btn(page, DELEGATE)).toHaveAttribute("data-variant", "primary");
  await expect(btn(page, TAKEOVER)).toBeEnabled();
});

test("K486-UI-005 種類が無い・知らない値（古い口・K-485 より前の答え）：reason_kind の鍵が無い・null・知らない文字のどれでも「止まった」帯は出て、理由の全文を出す（種類を当て推量しない・PC をつなぐは出ない）", async ({
  page,
}) => {
  for (const kind of [undefined, null, "なにか新しい種類"] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const r = run({ stopped_reason: FAILED });
    const raw: Record<string, unknown> = { ...r };
    if (kind === undefined) delete raw["reason_kind"];
    else raw["reason_kind"] = kind;
    await open(page, { runs: [raw as unknown as ReturnType<typeof run>] });
    await expect(stopBox(page).getByRole("heading", { level: 3 })).toHaveText(TITLE);
    await expect(stopBox(page)).toContainText(FAILED);
    await expect(setupLink(page, CONNECT)).toHaveCount(0);
    await expect(btn(page, DELEGATE)).toBeEnabled();
  }
});

test("K486-UI-006 「PC をつなぐ」を押すと PC をつなぐ画面（/setup/bridge）へ移る", async ({ page }) => {
  await open(page, { runs: stopped("bridge_outdated", "（内部の文）") });
  await setupLink(page, CONNECT).click();
  await expect(page).toHaveURL(/\/setup\/bridge$/);
});

test("K486-UI-007 自分で直すを押すと確認の小窓（題「自分で直しますか？」・本文・やめる／自分で直す）。開いた時点で口は 0 回。焦点は取り消しの側（やめる）", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  await btn(page, TAKEOVER).click();
  await expect(takeoverDialog(page)).toBeVisible();
  await expect(takeoverDialog(page)).toContainText(`${WHO} の仕事を外して`);
  await expect(takeoverDialog(page).getByRole("button", { name: "やめる", exact: true })).toBeFocused();
  await expect(takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true })).toBeVisible();
  expect(s.takeovers).toEqual([]);
});

test("K486-UI-008 やめる・Esc で閉じて口に 0 回・焦点は「自分で直す」に戻る。帯は残る", async ({ page }) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  await btn(page, TAKEOVER).click();
  await takeoverDialog(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(takeoverDialog(page)).toHaveCount(0);
  await expect(btn(page, TAKEOVER)).toBeFocused();
  await btn(page, TAKEOVER).press("Enter");
  await expect(takeoverDialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(takeoverDialog(page)).toHaveCount(0);
  await expect(btn(page, TAKEOVER)).toBeFocused();
  await expect(stopSec(page)).toHaveCount(1);
  expect(s.takeovers).toEqual([]);
});

test("K486-UI-009 自分で直す（正常）：口に 1 回（体は空）。小窓が閉じ、お知らせ「自分で進めることにしました」・止まった帯が消え、AI に任せるの白い箱（押せる）が出る。口は 実行 1 件への 1 回だけ", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  await btn(page, TAKEOVER).click();
  await takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true }).click();
  await expect.poll(() => s.takeovers.length).toBe(1);
  expect(s.takeovers[0]!.id).toBe(RUN_ID);
  expect(s.takeovers[0]!.body ?? {}).toEqual({});
  await expect(takeoverDialog(page)).toHaveCount(0);
  await expect(page.getByText("自分で進めることにしました")).toBeVisible();
  await expect(stopSec(page)).toHaveCount(0);
  await expect(delegateSec(page).getByRole("button", { name: DELEGATE, exact: true })).toBeEnabled();
});

test("K486-UI-010 開き直す（再取得）：引き取った後に詳細を開き直しても、止まった帯は出ず AI に任せるの白い箱だけが出る（実行の記録の taken_over_at から決める）", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  await btn(page, TAKEOVER).click();
  await takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true }).click();
  await expect(stopSec(page)).toHaveCount(0);
  const before = s.runsReads;
  await openTicketSettled(page);
  await expect.poll(() => s.runsReads).toBeGreaterThan(before);
  await expect(stopSec(page)).toHaveCount(0);
  await expect(delegateSec(page).getByRole("button", { name: DELEGATE, exact: true })).toBeEnabled();
});

test("K486-UI-011 二度押し：答えを止めた間に「自分で直す」を押すと口に 1 回届き、確認の小窓のボタンは押せない（busy）・小窓は閉じない。もう 1 回押しても口は 1 回だけ。答えると閉じる", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  await btn(page, TAKEOVER).click();
  const go = takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true });
  const release = s.hold();
  await go.click();
  await expect.poll(() => s.takeovers.length).toBe(1);
  await expect(go).toBeDisabled();
  await go.click({ force: true });
  await page.keyboard.press("Escape");
  await expect(takeoverDialog(page)).toBeVisible();
  release();
  await expect(takeoverDialog(page)).toHaveCount(0);
  expect(s.takeovers.length).toBe(1);
});

test("K486-UI-012 口の断り（担当者が替わっていた・403・E-STP-001）：小窓の上の赤い箱に正本の文・小窓は開いたまま・帯は残る。やめるで閉じられる", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  s.on.takeover = () => errReply(403, "E-STP-001");
  await btn(page, TAKEOVER).click();
  await takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true }).click();
  await expect(takeoverDialog(page).locator(".k-band-notice")).toHaveText(msg("E-STP-001"));
  await expect(takeoverDialog(page)).toBeVisible();
  await takeoverDialog(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(takeoverDialog(page)).toHaveCount(0);
  await expect(stopSec(page)).toHaveCount(1);
});

test("K486-UI-013 口の断り（今は切り替えられない・409・E-STP-002）と、新しい実行に替わった（409・E-STP-004）：赤い箱に正本の文・詳細と実行の一覧を読み直す（読み直しの数が増える）。小窓は開いたまま", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  for (const code of ["E-STP-002", "E-STP-004"]) {
    s.on.takeover = () => errReply(409, code);
    const reads = s.ticketReads + s.runsReads;
    if (!(await takeoverDialog(page).isVisible())) await btn(page, TAKEOVER).click();
    await takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true }).click();
    await expect(takeoverDialog(page).locator(".k-band-notice")).toHaveText(msg(code));
    await expect.poll(() => s.ticketReads + s.runsReads).toBeGreaterThan(reads);
    await expect(takeoverDialog(page)).toBeVisible();
  }
});

test("K486-UI-014 別のタブで先に引き取られた（409・E-STP-003）：赤い箱に正本の文。読み直しで帯が消え、小窓を閉じると AI に任せるの白い箱が出る", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  s.on.takeover = () => {
    s.runs = s.runs.map((r) => ({ ...r, taken_over_at: "2026-11-20T01:10:00.000Z" }));
    return errReply(409, "E-STP-003");
  };
  await btn(page, TAKEOVER).click();
  await takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true }).click();
  await expect(takeoverDialog(page).locator(".k-band-notice")).toHaveText(msg("E-STP-003"));
  await takeoverDialog(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stopSec(page)).toHaveCount(0);
  await expect(delegateSec(page).getByRole("button", { name: DELEGATE, exact: true })).toBeEnabled();
});

test("K486-UI-015 送れない（500）：確認の小窓の上の赤い箱に E-PAGE-007 の 1 文目・小窓は開いたまま。押し直すと 2 回目を送り、通れば閉じる（口は 2 回）", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  const ok = s.on.takeover;
  let n = 0;
  s.on.takeover = (req) => {
    n++;
    return n === 1 ? { status: 500, body: { error: "internal", code: "INTERNAL" } } : ok(req);
  };
  await btn(page, TAKEOVER).click();
  const go = takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true });
  await go.click();
  await expect(takeoverDialog(page).locator(".k-band-notice")).toContainText(firstSentence("E-PAGE-007"));
  await go.click();
  await expect(takeoverDialog(page)).toHaveCount(0);
  await expect.poll(() => s.takeovers.length).toBe(2);
});

test("K486-UI-016 見るだけの人（山口・can.delegate が偽で担当者でもない）：一手の 3 つは押せない形（aria-disabled・指を置くと「押せるのは担当者の高本さんだけです」）。押しても小窓は開かず口を呼ばない。帯と理由は読める", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED), viewer: "viewer" });
  await expect(stopBox(page).getByRole("heading", { level: 3 })).toHaveText(TITLE);
  await expect(stopBox(page)).toContainText(FAILED);
  for (const n of [DELEGATE, HOW, TAKEOVER]) {
    const b = btn(page, n);
    await expect(b, n).toHaveAttribute("aria-disabled", "true");
    await b.click({ force: true });
  }
  await expect(btn(page, TAKEOVER)).toHaveAttribute("title", "押せるのは担当者の高本さんだけです");
  await expect(takeoverDialog(page)).toHaveCount(0);
  expect(s.takeovers).toEqual([]);
  expect(s.delegates).toEqual([]);
});

test("K486-UI-017 書ける人だが担当者でない人（鈴木）は AI に任せるを押せるか：can.delegate が真ならもう一度の「AI に任せる」は押せ、自分で直すだけが押せない（担当者本人だけ）", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED), viewer: "other" });
  await expect(btn(page, TAKEOVER)).toHaveAttribute("aria-disabled", "true");
  await expect(btn(page, DELEGATE)).toBeEnabled();
  await btn(page, TAKEOVER).click({ force: true });
  await expect(takeoverDialog(page)).toHaveCount(0);
  expect(s.takeovers).toEqual([]);
  await btn(page, DELEGATE).click();
  await expect.poll(() => s.delegates.length).toBe(1);
  expect(s.takeovers).toEqual([]);
});

test("K486-UI-018 もう一度（AI に任せる）：前からの口を 1 回呼び、止まった帯が前からの「任せました」の帯（題「高本のAI に任せました。」・要約「PC が受け取るのを待っています」・AI と話すは押せない）に替わる", async ({
  page,
}) => {
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  await btn(page, DELEGATE).click();
  await expect.poll(() => s.delegates.length).toBe(1);
  await expect(stopSec(page)).toHaveCount(0);
  const band = page.locator(".k-detail-bands .k-band").filter({ hasText: "に任せました" });
  await expect(band.getByRole("heading", { level: 3 })).toHaveText(`${WHO} に任せました。`);
  await expect(band.locator(".k-band-sub")).toHaveText("PC が受け取るのを待っています");
  await expect(band.getByRole("button", { name: "AI と話す", exact: true })).toHaveAttribute("aria-disabled", "true");
  expect(s.runs[0]!.id).toBe(RUN2);
});

test("K486-UI-019 やめた（cancelled）も同じ帯：種類が決まらなければ理由の全文・PC を外して止まった文も口が返した文のまま", async ({
  page,
}) => {
  await open(page, {
    runs: [run({ status: "cancelled", stopped_reason: "PC でこの実行をやめました", reason_kind: "unknown" })],
  });
  await expect(stopBox(page).getByRole("heading", { level: 3 })).toHaveText(TITLE);
  await expect(stopBox(page)).toContainText("PC でこの実行をやめました");
  await expect(btn(page, TAKEOVER)).toBeEnabled();
});

test("K486-UI-020 この帯を出さない物：承認の後の実行（phase execute）が止まった・動いている・待っている・引き取った後は、この葉の区画が出ない（前からの帯のまま・実行が動いている間の「自分で直す」は帯に無い）", async ({
  page,
}) => {
  const cases = [
    run({ phase: "execute", status: "stopped", stopped_reason: NO_REASON, reason_kind: "unknown" }),
    run({ status: "running", stopped_reason: null, reason_kind: null, finished_at: null }),
    run({ status: "queued", stopped_reason: null, reason_kind: null, finished_at: null, started_at: null }),
    run({ taken_over_at: "2026-11-20T01:10:00.000Z" }),
  ];
  for (const r of cases) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await open(page, { runs: [r], stage: r.phase === "execute" ? "running" : "doing" });
    await expect(stopSec(page), `${r.phase}:${r.status}:${r.taken_over_at}`).toHaveCount(0);
  }
});

for (const w of MATCH_WIDTHS) {
  test(`K486-UI-021 幅 ${w}：止まった帯と確認の小窓は横溢れ 0・小窓は画面の中（左の端 0 以上・右の端が幅以下・足のボタンが画面の高さの中）`, async ({
    page,
  }) => {
    await open(page, { runs: stopped("unknown", FAILED) }, w);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await btn(page, TAKEOVER).click();
    await expect(takeoverDialog(page)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    const b = (await takeoverDialog(page).boundingBox())!;
    const vp = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    const foot = (await takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true }).boundingBox())!;
    expect(foot.y + foot.height).toBeLessThanOrEqual(vp.height);
  });
}

test("K486-UI-022 口の数（速さ）：詳細を開くと getTicket 1 回・実行の一覧 1 回（今の実行の 1 件の読みは今までのまま・この葉は増やさない・口の数 6 のまま）。自分で直すを押した時だけ口が 1 本増え、そのあとの読み直しは getTicket と実行の一覧が 1 回ずつ", async ({
  page,
}) => {
  const hits: string[] = [];
  page.on("request", (r) => {
    const p = new URL(r.url()).pathname;
    if (p.startsWith(`/api/v1/action_runs/`) || p === `/api/v1/tickets/${TICKET}/runs`) hits.push(`${r.method()} ${p}`);
  });
  const s = await open(page, { runs: stopped("unknown", FAILED) });
  expect(s.ticketReads).toBe(1);
  expect(s.runsReads).toBe(1);
  expect(hits.filter((h) => h.startsWith("POST"))).toEqual([]);
  await btn(page, TAKEOVER).click();
  await expect(takeoverDialog(page)).toBeVisible();
  expect(s.takeovers).toEqual([]);
  await takeoverDialog(page).getByRole("button", { name: TAKEOVER, exact: true }).click();
  await expect(takeoverDialog(page)).toHaveCount(0);
  expect(hits.filter((h) => h.startsWith("POST"))).toEqual([`POST /api/v1/action_runs/${RUN_ID}/takeover`]);
  await expect.poll(() => s.ticketReads).toBe(2);
  await expect.poll(() => s.runsReads).toBe(2);
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock）
/** 本番をモックの状態にする手順 */
const DRIVE: Record<
  string,
  { widths: readonly number[]; pairs: typeof STOP_PAIRS; go: (p: Page, w: number) => Promise<void> }
> = {
  "f7-stop-broken": {
    widths: [375, 1440],
    // モックは 1 つの原因（Bridge が古い）だけを出す。本番も reason_kind が bridge_outdated の 1 つで比べる（4 つの原因の字は reason_kind を替えて UI-002 が 1 つずつ見る）
    pairs: STOP_PAIRS,
    go: async (p, w) => {
      await open(p, { runs: stopped("bridge_outdated", "（内部の文）") }, w);
    },
  },
  "f7-stop-retry": {
    widths: [1440],
    pairs: RETRY_PAIRS,
    go: async (p, w) => {
      const s = await open(p, { runs: stopped("unknown", FAILED) }, w);
      await btn(p, DELEGATE).click();
      await expect.poll(() => s.delegates.length).toBe(1);
      await expect(p.locator(".k-detail-bands .k-band").filter({ hasText: "に任せました" })).toBeVisible();
    },
  },
  "f7-stop-takeover": {
    widths: [1440],
    pairs: STOP_PAIRS,
    go: async (p, w) => {
      await open(p, { runs: stopped("unknown", FAILED) }, w);
      await btn(p, TAKEOVER).click();
      await expect(takeoverDialog(p)).toBeVisible();
    },
  },
  "f7-stop-denied": {
    widths: [375, 1440],
    pairs: STOP_PAIRS,
    go: async (p, w) => {
      await open(p, { runs: stopped("unknown", FAILED), viewer: "viewer" }, w);
    },
  },
};
for (const [id, c] of Object.entries(DRIVE)) {
  for (const w of c.widths) {
    test(`K486-UI-023 ${id} 幅 ${w}：止まった帯・一手のボタン・確認の小窓の値がモックと同じ（共通の道具 matchMock・役は STOP_PAIRS／RETRY_PAIRS）`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(browser, id, w, (p) => c.go(p, w), {
        base: "/dev/mock/f7",
        pairs: c.pairs,
        blur: true,
      });
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}
