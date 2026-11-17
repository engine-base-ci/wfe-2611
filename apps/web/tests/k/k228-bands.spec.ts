// K-228「詳細の帯（2）：作っています・任せました・実行待ち・実行中・止まった・完了の確かめ・完了・任せる前の帯をキャンバスに合わせる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：StRunning（作っています）・StFailed（止まった）・StBefore・StConfirmDone・StDone・StDelegated（どれも K-257 が詳細の形にそろえて起こし直し、代表の OK の後に正）。
//   口は網の手前で差し替える（前からの土台 approve-complete.harness.ts。実行は runView の by が「山田」）。
//   画面の形（実装の役が作る・帯の箱の部品は K-227 の components/k/band.tsx）：
//     作る段（phase make）は region「AI に任せる」、承認の後の実行と完了の確かめ・完了は region「承認と実行」の中に
//     帯の箱 .k-band（[role="status"]、止まったときは [role="alert"]）：h3 の題・.k-band-sub・.k-band-acts。作っている間は ol[aria-label="進み"]
//   帯の文は今の文を残す（前からの K-62・K-63 の試験が文で見ている）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { MSG, bandOf, k62Band, mockApi, openTicketSettled, type Band } from "../features/F5/approve-complete.harness";
import {
  LINE,
  ROOT,
  WHITE,
  WIDTHS,
  box,
  countWrites,
  cssOf,
  expectInert,
  fidelityCompareTests,
  fidelityConfigTest,
  overflowX,
} from "./detail-kit";

const C = {
  infoBg: "rgb(238, 243, 253)",
  infoLine: "rgb(199, 215, 245)",
  infoText: "rgb(30, 64, 175)",
  warnBg: "rgb(255, 248, 238)",
  warnLine: "rgb(243, 211, 167)",
  warnText: "rgb(122, 74, 5)",
  dangerBg: "rgb(253, 236, 236)",
  dangerLine: "rgb(243, 199, 199)",
  dangerText: "rgb(153, 27, 27)",
  okBg: "rgb(232, 245, 236)",
  okLine: "rgb(205, 232, 213)",
  okText: "rgb(22, 101, 52)",
  navy: "rgb(34, 52, 92)",
  blue: "rgb(29, 78, 216)",
};
const make = (status: string, pc = "live", o: Record<string, unknown> = {}): Band => ({
  stage: status === "stopped" ? "doing" : "running",
  run: { phase: "make", status, pc, stopped_reason: null, ...o },
  can_delegate: status === "stopped",
});
const exec = (status: string, pc = "live", o: Record<string, unknown> = {}): Band => ({
  stage: status === "stopped" ? "doing" : "running",
  run: { phase: "execute", status, pc, stopped_reason: null, ...o },
  can_complete: status === "stopped",
});
const STATES: Record<string, Band> = {
  作っています: make("running"),
  任せました: make("queued"),
  実行待ち: exec("queued", "asleep"),
  実行中: exec("running"),
  止まった: make("stopped", "live", { stopped_reason: "先方の画面が開けませんでした" }),
  実行が止まった: exec("stopped", "live", { stopped_reason: MSG.stoppedNoReason }),
  完了の確かめ: { stage: "doing", can_complete: true, todo: "- [x] 請求書を作る\n- [x] 先方に送る" },
  完了: { stage: "done", completed: { at: "2026-11-08T06:20:00Z", by: "高本" } },
  任せる前: { stage: "doing", can_delegate: true },
};
const boxIn = (page: Page, region: string) =>
  page.getByRole("region", { name: region }).locator(':is([role="status"], [role="alert"]).k-band');
const card = (page: Page) => page.locator("article.k-detail-card");
async function open(page: Page, b: Band, width = 1440) {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const m = await mockApi(page, b);
  await openTicketSettled(page, width);
  return m;
}
async function colors(page: Page, region: string) {
  const b = boxIn(page, region);
  await expect(b).toHaveCount(1);
  return [
    await cssOf(b, "background-color"),
    await cssOf(b, "border-top-color"),
    await cssOf(b.locator("h3"), "color"),
  ];
}

test("K228-UI-001 作っています（作る段・PC が開いている・許可を求めている）：region「AI に任せる」の青い箱（#EEF3FD・線 #C7D7F5・余白 12px 14px）・題 h3「山田のAI が作っています」13px・700・#1E40AF・要約 12px「開始 HH:MM ・ N 分」", async ({
  page,
}) => {
  await open(page, STATES["作っています"]!);
  expect(await colors(page, "AI に任せる")).toEqual([C.infoBg, C.infoLine, C.infoText]);
  const h3 = boxIn(page, "AI に任せる").locator("h3");
  await expect(h3).toHaveText("山田のAI が作っています");
  expect(await cssOf(h3, "font-size")).toBe("13px");
  expect(await cssOf(h3, "font-weight")).toBe("700");
  const sub = boxIn(page, "AI に任せる").locator(".k-band-sub");
  await expect(sub).toHaveText(/^開始 \d{2}:\d{2} ・ \d+ 分$/);
  expect(await cssOf(sub, "font-size")).toBe("12px");
  expect(await cssOf(boxIn(page, "AI に任せる"), "padding-top")).toBe("12px");
  expect(await cssOf(boxIn(page, "AI に任せる"), "padding-left")).toBe("14px");
  // 作る段で AI が許可を求めている（asking）も同じ題と進み（作るが今）
  await open(page, make("asking"));
  await expect(boxIn(page, "AI に任せる").locator("h3")).toHaveText("山田のAI が作っています");
  await expect(boxIn(page, "AI に任せる").locator('[data-state="now"]')).toContainText("作る");
});

test("K228-UI-002 作っていますの進み：ol「進み」に 5 段（受け取る・作る・確かめる・あなたの承認・実行）。済みは緑の上線 3px、今は青、先は灰", async ({
  page,
}) => {
  await open(page, STATES["作っています"]!);
  const steps = boxIn(page, "AI に任せる").getByRole("list", { name: "進み" }).getByRole("listitem");
  await expect(steps).toHaveCount(5);
  const names = (await steps.allInnerTexts()).map((t) =>
    t
      .replace(/^[✓●]\s*/, "")
      .split("\n")[0]!
      .trim(),
  );
  expect(names).toEqual(["受け取る", "作る", "確かめる", "あなたの承認", "実行"]);
  const states = await steps.evaluateAll((els) => els.map((e) => e.getAttribute("data-state")));
  expect(states).toEqual(["done", "now", "next", "next", "next"]);
  expect(await cssOf(steps.nth(0), "border-top-color")).toBe(C.okText);
  expect(await cssOf(steps.nth(0), "border-top-width")).toBe("3px");
  expect(await cssOf(steps.nth(1), "border-top-color")).toBe(C.blue);
  expect(await cssOf(steps.nth(2), "border-top-color")).toBe(LINE);
});

test("K228-UI-003 作っていますのボタン：AI と話す・止める は在るが押せない（aria-disabled・薄さ 0.55・押しても口を呼ばない）", async ({
  page,
}) => {
  const writes = countWrites(page);
  await open(page, STATES["作っています"]!);
  for (const n of ["AI と話す", "止める"])
    await expectInert(page, boxIn(page, "AI に任せる").getByRole("button", { name: n, exact: true }), n, writes);
});

test("K228-UI-004 任せました（作る段・受け取り待ち）：淡い橙の箱（#FFF8EE・線 #F3D3A7）・題「山田のAI に任せました。」#7A4A05（前からの K62-UI-032 の「任せました。PC が…」のつながりを残す）・要約は PC が開いていれば「PC が受け取るのを待っています」、閉じていれば「PC が起きるのを待っています」・AI と話す（押せない）", async ({
  page,
}) => {
  const writes = countWrites(page);
  await open(page, STATES["任せました"]!);
  expect(await colors(page, "AI に任せる")).toEqual([C.warnBg, C.warnLine, C.warnText]);
  await expect(boxIn(page, "AI に任せる").locator("h3")).toHaveText("山田のAI に任せました。");
  await expect(boxIn(page, "AI に任せる")).toContainText("山田のAI に任せました。PC が受け取るのを待っています");
  await expect(boxIn(page, "AI に任せる").locator(".k-band-sub")).toHaveText("PC が受け取るのを待っています");
  await expectInert(page, boxIn(page, "AI に任せる").getByRole("button", { name: "AI と話す" }), "AI と話す", writes);
  await open(page, make("queued", "asleep"));
  await expect(boxIn(page, "AI に任せる").locator(".k-band-sub")).toHaveText("PC が起きるのを待っています");
});

test("K228-UI-005 実行待ち（承認の後・PC が閉じている）：region「承認と実行」の淡い橙の箱・題「実行待ち ・ PC が閉じています」・前からの文・「PC をつなぐ」を押すと /setup/bridge", async ({
  page,
}) => {
  await open(page, STATES["実行待ち"]!);
  expect(await colors(page, "承認と実行")).toEqual([C.warnBg, C.warnLine, C.warnText]);
  await expect(boxIn(page, "承認と実行").locator("h3")).toHaveText("実行待ち ・ PC が閉じています");
  await expect(boxIn(page, "承認と実行").getByText(MSG.pcClosed)).toBeVisible();
  await expect(bandOf(page).getByRole("button")).toHaveCount(0);
  await boxIn(page, "承認と実行").getByRole("link", { name: "PC をつなぐ" }).click();
  await expect(page).toHaveURL(/\/setup\/bridge$/);
});

test("K228-UI-006 承認の後の実行中・PC が閉じた実行中・許可を求めている：region「承認と実行」の青い箱で、題がそれぞれ「実行中」・前からの 2 つの文。ボタンは無い", async ({
  page,
}) => {
  const cases: [Band, string][] = [
    [exec("running"), "実行中"],
    [exec("running", "asleep"), MSG.runningAsleep],
    [exec("asking"), MSG.asking],
  ];
  for (const [b, title] of cases) {
    await open(page, b);
    expect(await colors(page, "承認と実行"), title).toEqual([C.infoBg, C.infoLine, C.infoText]);
    await expect(boxIn(page, "承認と実行").locator("h3"), title).toHaveText(title);
    await expect(bandOf(page).getByRole("button"), title).toHaveCount(0);
  }
});

test("K228-UI-007 止まった・やめた（作る段）：赤い箱（role=alert・#FDECEC・線 #F3C7C7）・題「山田のAI が止まりました」#991B1B・理由は全文・AI に任せる（押せる）・直し方を AI に伝える と 自分で直す（押せない）", async ({
  page,
}) => {
  const writes = countWrites(page);
  await open(page, STATES["止まった"]!);
  const b = k62Band(page).locator('[role="alert"].k-band');
  await expect(b).toHaveCount(1);
  expect(await colors(page, "AI に任せる")).toEqual([C.dangerBg, C.dangerLine, C.dangerText]);
  await expect(b.locator("h3")).toHaveText("山田のAI が止まりました");
  await expect(b).toContainText("先方の画面が開けませんでした");
  await expect(b.getByRole("button", { name: "AI に任せる", exact: true })).toBeEnabled();
  for (const n of ["直し方を AI に伝える", "自分で直す"])
    await expectInert(page, b.getByRole("button", { name: n, exact: true }), n, writes);
  // やめた（cancelled）も同じ赤い箱と題
  await open(page, make("cancelled", "live", { stopped_reason: "PC でこの実行をやめました" }));
  await expect(k62Band(page).locator('[role="alert"].k-band h3')).toHaveText("山田のAI が止まりました");
  await expect(k62Band(page).locator('[role="alert"].k-band')).toContainText("PC でこの実行をやめました");
});

test("K228-UI-008 止まった（作る段）の確認の結果の表：見出しの列が 確認項目・種類・1 回目・2 回目・根拠。今の口は結果を返さないので行は 0 で、表の下に「検査なし（まだ流していません）」", async ({
  page,
}) => {
  await open(page, STATES["止まった"]!);
  const t = card(page).getByRole("table", { name: "確認の結果" });
  await expect(t.getByRole("columnheader")).toHaveText(["確認項目", "種類", "1 回目", "2 回目", "根拠"]);
  await expect(t.locator("tbody tr")).toHaveCount(0);
  await expect(card(page).locator(".k-check-empty")).toHaveText("検査なし（まだ流していません）");
});

test("K228-UI-021 止まった（作る段）の確認の結果の表の左右は帯の箱とそろう：幅 375・1440 で、表 table「確認の結果」の左端と右端が、その上の帯の箱（role=alert の .k-band）の左端と右端から 1px 以内（キャンバス StFailed を切る段で直した形・767 以下は 16px・1440 は 20px）", async ({
  page,
}) => {
  const bad: string[] = [];
  for (const w of [375, 1440]) {
    await open(page, STATES["止まった"]!, w);
    const band = card(page).locator('[role="alert"].k-band');
    const table = card(page).getByRole("table", { name: "確認の結果" });
    await expect(band).toHaveCount(1);
    await expect(table).toHaveCount(1);
    const edge = (l: typeof band) =>
      l.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right) };
      });
    const b = await edge(band);
    // 表は器の中で横に送れる（幅 375 で表が器より広い）ので、右端は器（表の親）で見る
    const t = await edge(table);
    const wrap = await table.evaluate((e) => {
      const r = e.parentElement!.getBoundingClientRect();
      const cs = getComputedStyle(e.parentElement!);
      return { right: Math.round(r.right - parseFloat(cs.paddingRight)) };
    });
    if (Math.abs(t.left - b.left) > 1) bad.push(`幅 ${w}：表の左 ${t.left}・帯の左 ${b.left}`);
    if (Math.abs(wrap.right - b.right) > 1) bad.push(`幅 ${w}：表の器の右 ${wrap.right}・帯の右 ${b.right}`);
  }
  expect(bad).toEqual([]);
});

test("K228-UI-009 承認の後の実行が止まった：region「承認と実行」の赤い箱 1 つの中に、題「実行が止まりました」と理由の全文（5000 字を切らない）と「完了にする」", async ({
  page,
}) => {
  const long = "先方の画面で確かめてください。".repeat(400).slice(0, 5000);
  await open(page, exec("stopped", "live", { stopped_reason: long }));
  const b = bandOf(page).locator('[role="alert"].k-band');
  await expect(b).toHaveCount(1);
  expect(await colors(page, "承認と実行")).toEqual([C.dangerBg, C.dangerLine, C.dangerText]);
  await expect(b.locator("h3")).toHaveText("実行が止まりました");
  const shown = await b.innerText();
  expect(shown.replace(/\s/g, "")).toContain(long);
  expect(shown).not.toContain("…");
  await expect(b.getByRole("button", { name: "完了にする", exact: true })).toBeVisible();
});

test("K228-UI-010 完了の確かめ：白い箱（線 #DDE2E9）・題「完了の条件を確かめて完了にしてください」#22345C・実施事項が 1 件以上あって全部済みなら要約「実施事項は全部終わりました」（残りがある・0 件なら出ない）・完了にする（primary・高さ 30）", async ({
  page,
}) => {
  await open(page, STATES["完了の確かめ"]!);
  expect(await colors(page, "承認と実行")).toEqual([WHITE, LINE, C.navy]);
  const b = boxIn(page, "承認と実行");
  await expect(b.locator("h3")).toHaveText(MSG.completeHint);
  await expect(b.locator(".k-band-sub")).toHaveText("実施事項は全部終わりました");
  const btn = b.getByRole("button", { name: "完了にする", exact: true });
  await expect(btn).toHaveAttribute("data-variant", "primary");
  expect(Math.round((await box(btn)).height)).toBe(30);
  await open(page, { stage: "doing", can_complete: true, todo: "- [x] 請求書を作る\n- 先方に送る" });
  await expect(boxIn(page, "承認と実行").locator(".k-band-sub")).toHaveCount(0);
  await open(page, { stage: "doing", can_complete: true, todo: "項目の無い本文" }); // 実施事項が 0 件なら「全部終わりました」と言わない
  await expect(boxIn(page, "承認と実行").locator(".k-band-sub")).toHaveCount(0);
});

test("K228-UI-011 完了：緑の箱（#E8F5EC・線 #CDE8D5）・題は前からの文「完了しました（高本・11/08 15:20）」#166534・ボタンなし", async ({
  page,
}) => {
  await open(page, STATES["完了"]!);
  expect(await colors(page, "承認と実行")).toEqual([C.okBg, C.okLine, C.okText]);
  await expect(boxIn(page, "承認と実行").locator("h3")).toHaveText("完了しました（高本・11/08 15:20）");
  await expect(bandOf(page).getByRole("button")).toHaveCount(0);
});

test("K228-UI-012 任せる前：白い箱・題「AI に任せる」#22345C・要約「高本のAI が実施事項を進め、確かめてから承認を待ちます」（見ている人の名前・読めなければ「自分のAI」）・AI に任せる（primary・高さ 30）", async ({
  page,
}) => {
  await open(page, STATES["任せる前"]!);
  expect(await colors(page, "AI に任せる")).toEqual([WHITE, LINE, C.navy]);
  const b = boxIn(page, "AI に任せる");
  await expect(b.locator("h3")).toHaveText("AI に任せる");
  await expect(b.locator(".k-band-sub")).toHaveText("高本のAI が実施事項を進め、確かめてから承認を待ちます");
  const btn = b.getByRole("button", { name: "AI に任せる", exact: true });
  await expect(btn).toHaveAttribute("data-variant", "primary");
  expect(Math.round((await box(btn)).height)).toBe(30);
  // 見ている人の名前が読めない（/me が 500）なら「自分のAI が…」
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockApi(page, STATES["任せる前"]!);
  await page.route(/\/api\/auth-ext\/me$/, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "E-PAGE-003" }) }),
  );
  await openTicketSettled(page);
  await expect(boxIn(page, "AI に任せる").locator(".k-band-sub")).toHaveText(
    "自分のAI が実施事項を進め、確かめてから承認を待ちます",
  );
});

test("K228-UI-013 帯の箱は 1 つ：9 つの状態のどれでも、カードの中の帯の箱（.k-band の status か alert）がちょうど 1 つ", async ({
  page,
}) => {
  for (const [name, b] of Object.entries(STATES)) {
    await open(page, b);
    await expect(card(page).locator(':is([role="status"], [role="alert"]).k-band'), name).toHaveCount(1);
  }
});

test("K228-UI-014 幅 375：9 つの状態のどれでも、帯の箱はカードの中に収まり（ボタンは題の下に折り返す）、横溢れ 0", async ({
  page,
}) => {
  const bad: string[] = [];
  for (const [name, b] of Object.entries(STATES)) {
    await open(page, b, 375);
    const bx = card(page).locator(':is([role="status"], [role="alert"]).k-band');
    await expect(bx, name).toHaveCount(1);
    const c = await box(card(page));
    const r = await box(bx);
    if (r.x < c.x || r.x + r.width > c.x + c.width + 1) bad.push(`${name}：箱がカードの外`);
    const o = await overflowX(page);
    if (o !== 0) bad.push(`${name}：横溢れ ${o}px`);
  }
  expect(bad).toEqual([]);
});

test("K228-UI-015 幅 320・375・768・1024・1440：作っていますと止まったで横溢れ 0", async ({ page }) => {
  const bad: string[] = [];
  for (const name of ["作っています", "止まった"]) {
    for (const w of WIDTHS) {
      await open(page, STATES[name]!, w);
      await expect(card(page).locator(':is([role="status"], [role="alert"]).k-band')).toHaveCount(1);
      const o = await overflowX(page);
      if (o !== 0) bad.push(`${name} 幅 ${w}：${o}px`);
    }
  }
  expect(bad).toEqual([]);
});

test("K228-UI-016 押しすぎ（AI に任せるが 429）の知らせ：帯の region の中の淡い橙の箱（.k-band-notice・線 1px #F3D3A7）に「押しすぎです。30 秒たってから、もう一度押してください」", async ({
  page,
}) => {
  await open(page, STATES["任せる前"]!);
  await page.route(/\/api\/v1\/tickets\/[^/]+\/delegate$/, (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 30 }),
    }),
  );
  await k62Band(page).getByRole("button", { name: "AI に任せる", exact: true }).click();
  const n = k62Band(page).locator(".k-band-notice");
  await expect(n).toHaveText("押しすぎです。30 秒たってから、もう一度押してください");
  expect(await cssOf(n, "background-color")).toBe(C.warnBg);
  expect(await cssOf(n, "border-top-color")).toBe(C.warnLine);
  expect(await cssOf(n, "border-top-width")).toBe("1px");
});

test("K228-UI-019 操作要素の表：K-62・K-63 の表（07_qa/test-specs/k/delegate.md・approve-complete.md）に、帯に足した AI と話す・直し方を AI に伝える・自分で直す・止める のボタンと PC をつなぐ のリンクの行が在る", () => {
  const md = ["delegate", "approve-complete"]
    .map((f) => readFileSync(join(ROOT, `07_qa/test-specs/k/${f}.md`), "utf8"))
    .join("\n");
  const have = new Set([...md.matchAll(/（([a-z]+)）「(.+?)」/g)].map((x) => `${x[1]}|${x[2]}`));
  const want = [
    "button|AI と話す",
    "button|直し方を AI に伝える",
    "button|自分で直す",
    "button|止める",
    "link|PC をつなぐ",
  ];
  expect(want.filter((k) => !have.has(k))).toEqual([]);
});

test("K228-UI-020 完了にするも出る止まった：作る段で止まって完了にもできる・承認の後の実行が止まって任せることもできる のどちらも、押せる主ボタンは 1 つで「完了にする」・AI に任せるは outlined（決める人の答え answer=5cf21973b39f）", async ({
  page,
}) => {
  const both: Band[] = [
    {
      ...make("stopped", "live", { stopped_reason: "PC でこの実行をやめました" }),
      can_complete: true,
      can_delegate: true,
    },
    { ...exec("stopped", "live", { stopped_reason: MSG.stoppedNoReason }), can_complete: true, can_delegate: true },
  ];
  for (const [i, b] of both.entries()) {
    await open(page, b);
    await expect(page.getByRole("button", { name: "完了にする", exact: true }), `場合 ${i}`).toBeVisible();
    const primaries = page.locator('#k-main .k-btn[data-variant="primary"]:not([aria-disabled="true"])');
    await expect(primaries, `場合 ${i}`).toHaveCount(1);
    await expect(primaries, `場合 ${i}`).toHaveText("完了にする");
    await expect(page.getByRole("button", { name: "AI に任せる", exact: true }), `場合 ${i}`).toHaveAttribute(
      "data-variant",
      "outlined",
    );
  }
});

fidelityConfigTest(
  "K228-UI-017 突き合わせの設定：band-running・band-failed・band-before・band-confirm-done・band-done・band-delegated が enrolled・持ち主 K-228・画面を整える道具に鍵・画面の側のセレクタに .k-panel が無い",
  ["band-running", "band-failed", "band-before", "band-confirm-done", "band-done", "band-delegated"],
  "K-228",
);
for (const [id, label] of [
  ["band-running", "StRunning"],
  ["band-failed", "StFailed"],
  ["band-before", "StBefore"],
  ["band-confirm-done", "StConfirmDone"],
  ["band-done", "StDone"],
  ["band-delegated", "StDelegated"],
] as const)
  fidelityCompareTests("K228-UI-018", id, label);
