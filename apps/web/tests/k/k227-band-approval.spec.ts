// K-227「詳細の帯（1）：承認待ち・決められない人の帯をキャンバス（TicketDetail の帯）に合わせる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas/TicketDetail.dc.html の main article [role="status"]。口は網の手前で差し替える（前からの土台 approve-complete.harness.ts）。
//   画面の形（実装の役が作る）：帯の region（section[aria-label="承認と実行"]・決められない人は section[aria-label="AI に任せる"]）の中に、
//     帯の箱 [role="status"].k-band（h3 の題・.k-band-sub の要約・.k-band-acts のボタン・.k-band-caution の取り消せない注意）と、
//     その下に成果物のカード section[aria-label="成果物"]（帯の箱の外・region の中）。口の失敗の知らせは .k-band-notice[role="alert"]
//   承認するボタンを押した後（確かめの小窓）は K-229 が持つ。この試験は承認するボタンを押さない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  ARTIFACT,
  MSG,
  bandOf,
  detailOf,
  dialog,
  k62Band,
  mockApi,
  openTicket,
  openTicketSettled,
  pending,
  reasonBox,
  ticketOf,
  type Band,
} from "../features/F5/approve-complete.harness";
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

const ORANGE_BG = "rgb(252, 235, 213)";
const ORANGE_LINE = "rgb(243, 211, 167)";
const ORANGE_TEXT = "rgb(122, 74, 5)";
const NAVY = "rgb(34, 52, 92)";
const statusBox = (page: Page, region = "承認と実行") =>
  page.getByRole("region", { name: region }).locator('[role="status"].k-band');
const artifactCard = (page: Page) => bandOf(page).getByRole("region", { name: "成果物" });
const card = (page: Page) => page.locator("article.k-detail-card");
const ACTS = ["承認して送る", "自分で直す", "差し戻す", "止める"];

test("K227-UI-001 承認待ちの帯の箱：淡い橙（#FCEBD5）・線 #F3D3A7・角丸 8・余白 10px 12px。カードの左右 20px 内側に収まる", async ({
  page,
}) => {
  await mockApi(page);
  await openTicketSettled(page);
  const b = statusBox(page);
  await expect(b).toHaveCount(1);
  expect(await cssOf(b, "background-color")).toBe(ORANGE_BG);
  expect(await cssOf(b, "border-top-color")).toBe(ORANGE_LINE);
  expect(await cssOf(b, "border-top-left-radius")).toBe("8px");
  expect(await cssOf(b, "padding-top")).toBe("10px");
  expect(await cssOf(b, "padding-left")).toBe("12px");
  const c = await box(card(page));
  const r = await box(b);
  expect(Math.abs(r.x - (c.x + 21))).toBeLessThanOrEqual(1);
  expect(Math.abs(c.x + c.width - 21 - (r.x + r.width))).toBeLessThanOrEqual(1);
});

test("K227-UI-002 帯の題と要約：題 h3「あなたの承認を待っています」13px・700・#7A4A05。要約は 12px の 1 行（成果物を作った時刻と確認の要約）で灰の札（Badge）を使わない", async ({
  page,
}) => {
  await mockApi(page);
  await openTicketSettled(page);
  const h3 = statusBox(page).locator("h3");
  await expect(h3).toHaveText(MSG.waitingMe);
  expect(await cssOf(h3, "font-size")).toBe("13px");
  expect(await cssOf(h3, "font-weight")).toBe("700");
  expect(await cssOf(h3, "color")).toBe(ORANGE_TEXT);
  const sub = statusBox(page).locator(".k-band-sub");
  await expect(sub).toHaveText(/^成果物は \d{1,2}\/\d{1,2} \d{2}:\d{2} に作成 ・ 確認 検査なし（まだ流していません）$/);
  expect(await cssOf(sub, "font-size")).toBe("12px");
  await expect(bandOf(page).locator(".k-badge")).toHaveCount(0);
});

test("K227-UI-003 帯のボタン：承認して送る（紺・高さ 32）・自分で直す・差し戻す（白地・線 #F3D3A7・高さ 32）・止める の順で、間 6px", async ({
  page,
}) => {
  await mockApi(page);
  await openTicketSettled(page);
  const acts = statusBox(page).locator(".k-band-acts");
  const names = (await acts.getByRole("button").allInnerTexts()).map((x) => x.trim());
  expect(names).toEqual(ACTS);
  const send = acts.getByRole("button", { name: "承認して送る" });
  expect(await cssOf(send, "background-color")).toBe(NAVY);
  expect(Math.round((await box(send)).height)).toBe(32);
  const ret = acts.getByRole("button", { name: "差し戻す" });
  expect(await cssOf(ret, "background-color")).toBe(WHITE);
  expect(await cssOf(ret, "border-top-color")).toBe(ORANGE_LINE);
  expect(Math.round((await box(ret)).height)).toBe(32);
  const a = await box(acts.getByRole("button").nth(0));
  const b = await box(acts.getByRole("button").nth(1));
  expect(Math.abs(b.x - (a.x + a.width) - 6)).toBeLessThanOrEqual(1);
});

test("K227-UI-004 K63-UI-077 K63-UI-078 まだ使えない「自分で直す」「止める」：在る・aria-disabled・薄さ 0.55・押しても Enter でも口を呼ばず小窓も開かない", async ({
  page,
}) => {
  const writes = countWrites(page);
  await mockApi(page);
  await openTicketSettled(page);
  for (const n of ["自分で直す", "止める"])
    await expectInert(page, statusBox(page).getByRole("button", { name: n, exact: true }), n, writes);
});

test("K227-UI-005 幅 375：ボタンは題と要約の下に折り返し、帯の箱はカードの中に収まり、横溢れ 0", async ({ page }) => {
  await mockApi(page);
  await openTicketSettled(page, 375);
  await expect(artifactCard(page)).toBeVisible();
  const title = await box(statusBox(page).locator("h3"));
  const acts = await box(statusBox(page).locator(".k-band-acts"));
  expect(acts.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
  const c = await box(card(page));
  const r = await box(statusBox(page));
  expect(r.x + r.width).toBeLessThanOrEqual(c.x + c.width + 1);
  expect(await overflowX(page)).toBe(0);
});

test("K227-UI-006 K63-UI-079 K63-UI-080 K63-UI-081 K63-UI-082 成果物は帯の箱の外のカード（白・線 #DDE2E9・角丸 8）：中身の字・「成果物の版 1」・大きく見る（押せる）・データを見る・試し打ち（自分宛）・先方に確かめてもらう（押せない）", async ({
  page,
}) => {
  const writes = countWrites(page);
  await mockApi(page);
  await openTicketSettled(page);
  const c = artifactCard(page);
  const s = await box(statusBox(page));
  expect((await box(c)).y).toBeGreaterThanOrEqual(s.y + s.height - 1);
  await expect(statusBox(page)).not.toContainText("11 月分の請求書をお送りします。");
  expect(await cssOf(c, "background-color")).toBe(WHITE);
  expect(await cssOf(c, "border-top-color")).toBe(LINE);
  expect(await cssOf(c, "border-top-left-radius")).toBe("8px");
  await expect(c).toContainText("株式会社サンプル 御中");
  await expect(c).toContainText("11 月分の請求書をお送りします。");
  await expect(c).toContainText("成果物の版 1");
  await expect(c.getByRole("button", { name: "大きく見る" })).toBeEnabled();
  for (const n of ["データを見る", "試し打ち（自分宛）", "先方に確かめてもらう"])
    await expectInert(page, c.getByRole("button", { name: n, exact: true }), n, writes);
});

test("K227-UI-007 「大きく見る」：小窓「成果物」に成果物の全文が改行を残して出る。Esc で閉じ、書く口は呼ばれない", async ({
  page,
}) => {
  const writes = countWrites(page);
  await mockApi(page);
  await openTicketSettled(page);
  await artifactCard(page).getByRole("button", { name: "大きく見る" }).click();
  const d = page.getByRole("dialog", { name: "成果物" });
  await expect(d).toBeVisible();
  const text = await d.locator(".k-pre").innerText();
  expect(text).toBe(ARTIFACT);
  await page.keyboard.press("Escape");
  await expect(d).toHaveCount(0);
  expect(writes.n).toBe(0);
});

test("K227-UI-008 空白の無い長い成果物（3000 字）：カードの字の頭（.k-artifact-head）は高さ 240px 以下で、幅 375 でも横溢れ 0。全文は「大きく見る」の小窓に出る", async ({
  page,
}) => {
  const long = "請".repeat(1500) + "x".repeat(1500);
  const m = await mockApi(page);
  m.on.detail = (req) => ({
    status: 200,
    body: {
      data: detailOf(new URL(req.url()).pathname.split("/").at(-1)!, { artifact_version: { version: 2, text: long } }),
    },
  });
  await openTicketSettled(page, 375);
  await expect(artifactCard(page)).toContainText("成果物の版 2");
  expect((await box(artifactCard(page).locator(".k-artifact-head"))).height).toBeLessThanOrEqual(240);
  expect(await overflowX(page)).toBe(0);
  await artifactCard(page).getByRole("button", { name: "大きく見る" }).click();
  expect((await page.getByRole("dialog", { name: "成果物" }).locator(".k-pre").innerText()).length).toBe(3000);
});

test("K227-UI-009 取り消せない注意：帯の箱の中の赤い箱（#FDECEC・線 #F3C7C7・字 #991B1B）に「取り消せません」。取り消せる承認は赤い箱が無く、ボタンは「承認する」", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  const red = statusBox(page).locator(".k-band-caution");
  await expect(red).toHaveText("取り消せません");
  expect(await cssOf(red, "background-color")).toBe("rgb(253, 236, 236)");
  expect(await cssOf(red, "border-top-color")).toBe("rgb(243, 199, 199)");
  expect(await cssOf(red, "color")).toBe("rgb(153, 27, 27)");
  const ok: Band = { stage: "awaiting_approval", approval: pending({ irreversible: false }) };
  m.on.detail = (req) => ({
    status: 200,
    body: { data: detailOf(new URL(req.url()).pathname.split("/").at(-1)!, { cautions: [], irreversible: false }) },
  });
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf(ok) } });
  await page.reload();
  await expect(statusBox(page).getByRole("button", { name: "承認する", exact: true })).toBeVisible();
  await expect(statusBox(page).locator(".k-band-caution")).toHaveCount(0);
});

test("K227-UI-010 24 時間の聞き直し（approval.note）：帯の箱の中に文が出る（箱の外に別の知らせを並べない）", async ({
  page,
}) => {
  await mockApi(page, { stage: "awaiting_approval", approval: pending({ note: MSG.note24h }) });
  await openTicketSettled(page);
  await expect(statusBox(page)).toContainText(MSG.note24h);
  // 帯の箱の外に知らせ（Callout）を並べない
  await expect(bandOf(page).locator('.k-callout:not([role="status"].k-band .k-callout)')).toHaveCount(0);
});

test("K227-UI-011 決められない人：K-62 の帯（region「AI に任せる」）が同じ橙の箱で、題 h3「成果物ができました。承認待ちです」・確認の要約は 12px の字（札にしない）・ボタンなし", async ({
  page,
}) => {
  await mockApi(page, { stage: "awaiting_approval", approval: pending({ can_decide: false, approver_name: "佐藤" }) });
  await openTicketSettled(page);
  const b = statusBox(page, "AI に任せる");
  await expect(b).toHaveCount(1);
  expect(await cssOf(b, "background-color")).toBe(ORANGE_BG);
  expect(await cssOf(b, "border-top-color")).toBe(ORANGE_LINE);
  await expect(b.locator("h3")).toHaveText(MSG.k62Waiting);
  const sub = b.locator(".k-band-sub");
  await expect(sub).toContainText(MSG.checkNone);
  expect(await cssOf(sub, "font-size")).toBe("12px");
  await expect(k62Band(page).locator(".k-badge")).toHaveCount(0);
  await expect(b.getByRole("button")).toHaveCount(0);
});

test("K227-UI-012 担当者がいない承認待ち：同じ橙の箱に「担当者がいないので、承認する人がいません。担当者を決めてください」・ボタンなし", async ({
  page,
}) => {
  await mockApi(page, {
    stage: "awaiting_approval",
    approval: pending({ can_decide: false, approver_name: null }),
    assignee: null,
  });
  await openTicket(page);
  const b = statusBox(page);
  await expect(b).toContainText(MSG.noAssignee);
  expect(await cssOf(b, "background-color")).toBe(ORANGE_BG);
  await expect(b.getByRole("button")).toHaveCount(0);
});

test("K227-UI-013 帯の箱は 1 つ（決められる人・決められない人・担当者がいない のどれでも、カードの中の [role=status].k-band がちょうど 1 つ）", async ({
  page,
}) => {
  const cases: Band[] = [
    { stage: "awaiting_approval", approval: pending() },
    { stage: "awaiting_approval", approval: pending({ can_decide: false, approver_name: "佐藤" }) },
    { stage: "awaiting_approval", approval: pending({ can_decide: false, approver_name: null }), assignee: null },
  ];
  for (const [i, b] of cases.entries()) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockApi(page, b);
    await openTicketSettled(page);
    await expect(card(page).locator('[role="status"].k-band'), `場合 ${i}`).toHaveCount(1);
  }
});

test("K227-UI-014 作業中で AI に任せられて完了にもできる：本文の主ボタン（primary）は 1 つで「完了にする」、「AI に任せる」は outlined（決める人の答え answer=5cf21973b39f）", async ({
  page,
}) => {
  await mockApi(page, { stage: "doing", can_delegate: true, can_complete: true });
  await openTicketSettled(page);
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toBeVisible();
  const primaries = page.locator('#k-main .k-btn[data-variant="primary"]:not([aria-disabled="true"])');
  await expect(primaries).toHaveCount(1);
  await expect(primaries).toHaveText("完了にする");
  await expect(page.getByRole("button", { name: "AI に任せる", exact: true })).toHaveAttribute(
    "data-variant",
    "outlined",
  );
});

test("K227-UI-015 口の失敗の知らせ（差し戻しが 409）：帯の region の中の赤い箱（role=alert・#FDECEC・線 #F3C7C7）に正本の文。地の文に混ぜない", async ({
  page,
}) => {
  const m = await mockApi(page);
  m.on.ret = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  await openTicketSettled(page);
  await statusBox(page).getByRole("button", { name: "差し戻す" }).click();
  await reasonBox(page).fill("宛名を直してください");
  await dialog(page)
    .getByRole("button", { name: /^差し戻(す|して作り直させる)$/ })
    .click();
  const n = bandOf(page).locator('.k-band-notice[role="alert"]');
  await expect(n).toContainText(MSG.decided);
  expect(await cssOf(n, "background-color")).toBe("rgb(253, 236, 236)");
  expect(await cssOf(n, "border-top-color")).toBe("rgb(243, 199, 199)");
  expect(await cssOf(n, "border-top-width")).toBe("1px");
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toHaveCount(1); // alert は 1 つ（前からの試験が filter で探す）
});

test("K227-UI-016 幅 320・375・768・1024・1440：承認待ちの帯と成果物のカードを出しても横溢れ 0", async ({ page }) => {
  await mockApi(page);
  const bad: string[] = [];
  for (const w of WIDTHS) {
    await openTicketSettled(page, w);
    await expect(artifactCard(page)).toBeVisible(); // 成果物のカードは承認の 1 件の答えの後に出る
    const o = await overflowX(page);
    if (o !== 0) bad.push(`幅 ${w}：${o}px`);
  }
  expect(bad).toEqual([]);
});

test("K227-UI-017 操作要素の表：K-63 の表（07_qa/test-specs/k/approve-complete.md）に、帯と成果物のカードに足した 6 つのボタンの行が在る（前からの K63-UI-020 が替えずに緑）", () => {
  const md = readFileSync(join(ROOT, "07_qa/test-specs/k/approve-complete.md"), "utf8");
  const have = new Set([...md.matchAll(/（([a-z]+)）「(.+?)」/g)].map((x) => `${x[1]}|${x[2]}`));
  const want = ["自分で直す", "止める", "大きく見る", "データを見る", "試し打ち（自分宛）", "先方に確かめてもらう"];
  expect(want.filter((n) => !have.has(`button|${n}`))).toEqual([]);
});

const CHECKED = "検査 3 件 すべて通った";
const decider: Band = { stage: "awaiting_approval", approval: pending() };
const watcher: Band = { stage: "awaiting_approval", approval: pending({ can_decide: false, approver_name: "佐藤" }) };

test("K227-UI-020 確認の要約は承認の 1 件の check_summary から出る（決められる人の帯の要約と、決められない人の帯の要約の両方。固定の「検査なし」の文を出さない）", async ({
  page,
}) => {
  for (const b of [decider, watcher]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const m = await mockApi(page, b);
    m.on.detail = (req) => ({
      status: 200,
      body: { data: detailOf(new URL(req.url()).pathname.split("/").at(-1)!, { check_summary: CHECKED }) },
    });
    await openTicketSettled(page);
    const sub = statusBox(page, b === decider ? "承認と実行" : "AI に任せる").locator(".k-band-sub");
    // 決められる人の要約は「… ・ 確認 〈check_summary〉」、決められない人の要約は check_summary そのまま
    await expect(sub).toContainText(b === decider ? `確認 ${CHECKED}` : CHECKED);
    await expect(sub).not.toContainText(MSG.checkNone);
  }
});

test("K227-UI-021 承認の 1 件が読めない（500）：決められない人の帯は題だけで要約（.k-band-sub）も「検査なし」の字も無い。決められる人の帯の要約に「確認」の部分が無い", async ({
  page,
}) => {
  for (const b of [watcher, decider]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const m = await mockApi(page, b);
    let asked = 0;
    m.on.detail = () => {
      asked += 1;
      return { status: 500, body: { error: "internal", code: "E-PAGE-003" } };
    };
    await openTicketSettled(page);
    await expect.poll(() => asked).toBeGreaterThan(0);
    if (b === watcher) {
      const box = statusBox(page, "AI に任せる");
      await expect(box.locator("h3")).toHaveText(MSG.k62Waiting);
      await expect(box.locator(".k-band-sub")).toHaveCount(0);
      await expect(box).not.toContainText(MSG.checkNone);
    } else {
      await expect(statusBox(page).locator("h3")).toHaveText(MSG.waitingMe);
      await expect(statusBox(page)).not.toContainText("確認");
      await expect(statusBox(page)).not.toContainText(MSG.checkNone);
    }
  }
});

test("K227-UI-022 承認の 1 件の答えに確認の要約が無い（check_summary が空）：決められる人の帯の要約は「成果物は M/D HH:MM に作成」だけで、「確認」の部分も「検査なし」の字も無い", async ({
  page,
}) => {
  const m = await mockApi(page, decider);
  m.on.detail = (req) => ({
    status: 200,
    body: { data: detailOf(new URL(req.url()).pathname.split("/").at(-1)!, { check_summary: "" }) },
  });
  await openTicketSettled(page);
  await expect(statusBox(page).locator(".k-band-sub")).toHaveText(/^成果物は \d{1,2}\/\d{1,2} \d{2}:\d{2} に作成$/);
  await expect(statusBox(page)).not.toContainText(MSG.checkNone);
});

fidelityConfigTest(
  "K227-UI-018 突き合わせの設定：band-approval が enrolled・持ち主 K-227・画面を整える道具に鍵・画面の側のセレクタに .k-panel が無い",
  ["band-approval"],
  "K-227",
);
fidelityCompareTests("K227-UI-019", "band-approval", "TicketDetail の承認の帯");
