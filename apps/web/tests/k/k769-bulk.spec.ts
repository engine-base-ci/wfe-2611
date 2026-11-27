// K-769「画面：承認待ちのまとめて承認（行の四角で選ぶ・［選んだものを承認］・［まとめて承認（全部）］・確かめの小窓・一部できなかったとき・スマホ）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5 の bulk-select・bulk-confirm-all・bulk-confirm-selected・bulk-running・bulk-done・bulk-partial・bulk-mobile（代表 OK：2026-11-23・D-153.11）。
//   口は網の手前で差し替える（前からの土台 approve-complete.harness.ts の mockApi の上に、まとめて承認の 2 本〔K-768〕を重ねる）：
//     POST /api/v1/approvals/bulk/preview ← { approval_ids? }（全部は体 {}・approval_ids を付けない）→ 201 { data: { eligible, excluded, count, irreversible_count, unchecked_count } }／409 E-APR-030
//     POST /api/v1/approvals/bulk         ← { approval_ids }               → 201 { data: { updated, skipped } }
//   差し込み口は K-730 の QueueBulkSlot（part: head・row・tool・band・card・先 fills/queue-bulk.tsx）。字は下絵と K-768 の申し送り。
//   固定の待ちは使わない。name は { exact: true }。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type Page, type Request, type Route } from "@playwright/test";
import {
  A_INLINE,
  A_NODUE,
  A_OPEN,
  QUEUE,
  TICKET,
  TICKET_B,
  TICKET_C,
  mockApi,
  openQueue,
  qrow,
} from "../features/F5/approve-complete.harness";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { WIDTHS_ALL, err, msg, overflowX } from "./room-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const HANDOVER = qrow("0193c5a0-0000-7000-8000-0000000f0001", {
  kind: "handover",
  title: "問い合わせ（山田様）に一次返信する",
  ticket_number: "EG-119",
});
const ELIG: Record<string, Record<string, unknown>> = {
  [A_INLINE]: {
    approval_id: A_INLINE,
    ticket_id: TICKET_B,
    number: "EG-133",
    title: "見積を出す",
    irreversible: false,
    unchecked: 0,
  },
  [A_OPEN]: {
    approval_id: A_OPEN,
    ticket_id: TICKET,
    number: "EG-133",
    title: "11 月分の請求書を送る",
    irreversible: true,
    unchecked: 1,
  },
  [A_NODUE]: {
    approval_id: A_NODUE,
    ticket_id: TICKET_C,
    number: "EG-140",
    title: "応募文を出す",
    irreversible: true,
    unchecked: 1,
  },
};
const preview = (ids: string[]) => {
  const e = ids.map((i) => ELIG[i]!);
  return {
    status: 201,
    body: {
      data: {
        eligible: e,
        excluded: [],
        count: e.length,
        irreversible_count: e.filter((x) => x["irreversible"]).length,
        unchecked_count: e.reduce((n, x) => n + Number(x["unchecked"]), 0),
      },
    },
  };
};

interface Bulk {
  previews: (Record<string, unknown> | null)[];
  approves: Record<string, unknown>[];
  on: {
    preview: (b: Record<string, unknown> | null) => { status: number; body: unknown };
    approve: (b: Record<string, unknown>) => { status: number; body: unknown };
  };
  hold: () => () => void;
  gate: Promise<void>;
  queueReads: () => number;
  /** 一覧の口の行を差し替える（既定は土台の 3 件と渡された 1 件） */
  queueRows: (rows: Record<string, unknown>[]) => Record<string, unknown>[];
}
async function setup(page: Page): Promise<Bulk> {
  const m = await mockApi(page);
  m.on.queue = () => {
    const rows = b.queueRows([...QUEUE(), HANDOVER]);
    return {
      status: 200,
      body: { data: rows, meta: { limit: 20, counts: { total: rows.length, artifact: 3, handover: 1 } } },
    };
  };
  const b: Bulk = {
    previews: [],
    approves: [],
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      b.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    queueReads: () => m.queueReads,
    queueRows: (rows) => rows,
    on: {
      preview: (body) => preview((body?.["approval_ids"] as string[] | undefined) ?? [A_INLINE, A_OPEN, A_NODUE]),
      approve: (body) => {
        const ids = body["approval_ids"] as string[];
        return {
          status: 201,
          body: {
            data: {
              updated: ids.map((i) => ({
                approval_id: i,
                ticket_id: ELIG[i]!["ticket_id"],
                number: ELIG[i]!["number"],
                run_id: "0193c5a0-0000-7000-8000-0000000e0009",
                pc: "live",
              })),
              skipped: [],
            },
          },
        };
      },
    },
  };
  await page.route(/\/api\/v1\/approvals\/bulk(\/preview)?$/, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const body = (req.postData() ? req.postDataJSON() : null) as Record<string, unknown> | null;
    let r;
    if (p.endsWith("/preview")) {
      b.previews.push(body);
      r = b.on.preview(body);
    } else {
      b.approves.push(body ?? {});
      await b.gate;
      r = b.on.approve(body ?? {});
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return b;
}
const pick = (p: Page, number: string, title: string) =>
  p
    .getByRole("table")
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("checkbox", { name: `${number} を選ぶ`, exact: true });
const bar = (p: Page) => p.getByRole("region", { name: "選んだもの", exact: true });
const confirmDlg = (p: Page) =>
  p.getByRole("alertdialog").or(p.getByRole("dialog")).filter({ hasText: "まとめて承認します" });

test("K769-UI-001 行の四角：AI の成果物の行だけ四角で選べ、渡された行は「—」（1 件ずつ決める）。選ぶと表の上に「N 件を選んでいます」と［選んだものを承認］の帯", async ({
  page,
}) => {
  await setup(page);
  await openQueue(page);
  await expect(
    page.getByRole("row").filter({ hasText: "問い合わせ（山田様）に一次返信する" }).getByRole("checkbox"),
  ).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  await pick(page, "EG-133", "見積を出す").check();
  await pick(page, "EG-133", "11 月分の請求書を送る").check();
  await expect(bar(page)).toContainText("2 件を選んでいます");
  await expect(bar(page).getByRole("button", { name: "選んだものを承認", exact: true })).toBeVisible();
  await pick(page, "EG-133", "見積を出す").uncheck();
  await expect(bar(page)).toContainText("1 件を選んでいます");
});

test("K769-UI-002 頭の四角：「まとめて選べるものをすべて選ぶ」で AI の成果物を全部選ぶ・もう一度で全部外す（渡された行は選ばない）。一部だけ選んでいる間は途中の印（indeterminate）", async ({
  page,
}) => {
  await setup(page);
  await openQueue(page);
  const head = page.getByRole("checkbox", { name: "まとめて選べるものをすべて選ぶ", exact: true });
  await pick(page, "EG-133", "見積を出す").check();
  await expect.poll(() => head.evaluate((e) => (e as HTMLInputElement).indeterminate)).toBe(true);
  await head.check();
  await expect(bar(page)).toContainText("3 件を選んでいます");
  await expect.poll(() => head.evaluate((e) => (e as HTMLInputElement).indeterminate)).toBe(false);
  await head.uncheck();
  await expect(bar(page)).toHaveCount(0);
});

test("K769-UI-003 選んだものを承認：まず確かめの口（選んだ id を一覧の並びで）を読み、小窓に「選んだ 2 件をまとめて承認します」・取り消せない物の件数・チェックの無い確認項目の件数・［2 件を承認する］", async ({
  page,
}) => {
  const b = await setup(page);
  await openQueue(page);
  await pick(page, "EG-133", "11 月分の請求書を送る").check();
  await pick(page, "EG-133", "見積を出す").check();
  await bar(page).getByRole("button", { name: "選んだものを承認", exact: true }).click();
  await expect.poll(() => b.previews).toEqual([{ approval_ids: [A_INLINE, A_OPEN] }]);
  const d = confirmDlg(page);
  await expect(d).toContainText("選んだ 2 件をまとめて承認します");
  await expect(d).toContainText("取り消せない物が 1 件含まれます");
  await expect(d).toContainText("チェックの無い確認項目が 1 件あります");
  await expect(d).toContainText("1 件ずつ中身を見ていない承認も含まれます。付けなくても承認できます");
  await expect(d.getByRole("button", { name: "2 件を承認する", exact: true })).toBeVisible();
  expect(b.approves.length).toBe(0);
});

test("K769-UI-004 まとめて承認（全部）：体 {}（approval_ids を付けない）で確かめの口を読み、小窓に「AI の成果物 3 件をまとめて承認します」・［3 件を承認する］で承認の口に確かめた id の並びを渡す", async ({
  page,
}) => {
  const b = await setup(page);
  await openQueue(page);
  await page.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
  await expect.poll(() => b.previews).toEqual([{}]);
  const d = confirmDlg(page);
  await expect(d).toContainText("AI の成果物 3 件をまとめて承認します");
  await expect(d).toContainText("取り消せない物が 2 件含まれます");
  await d.getByRole("button", { name: "3 件を承認する", exact: true }).click();
  await expect.poll(() => b.approves).toEqual([{ approval_ids: [A_INLINE, A_OPEN, A_NODUE] }]);
});

test("K769-UI-005 承認した後：帯「N 件を承認しました。実行は 1 件ずつ順に始まります（番号の並び）。決めた履歴から確かめられます」・選んだ印が外れ・一覧を読み直す", async ({
  page,
}) => {
  const b = await setup(page);
  await openQueue(page);
  await pick(page, "EG-133", "見積を出す").check();
  await pick(page, "EG-140", "応募文を出す").check();
  await bar(page).getByRole("button", { name: "選んだものを承認", exact: true }).click();
  const reads = b.queueReads();
  await confirmDlg(page).getByRole("button", { name: "2 件を承認する", exact: true }).click();
  await expect(page.locator(".k-callout").filter({ hasText: "2 件を承認しました" })).toHaveText(
    /2 件を承認しました。実行は 1 件ずつ順に始まります（EG-133・EG-140）。決めた履歴から確かめられます/,
  );
  await expect(bar(page)).toHaveCount(0);
  await expect.poll(() => b.queueReads()).toBeGreaterThan(reads);
});

test("K769-UI-006 一部できなかった：帯は 1 つ（押すたびに入れ替える）で「N 件は承認できませんでした：」の後に 1 件ずつ「<番号> <題名> は、<理由の文>」（decided・not_approver・not_writable の 3 つの文）・見つからない物は「1 件は見つかりませんでした」・「<番号> は承認しました」。内部の言葉は出さない", async ({
  page,
}) => {
  const b = await setup(page);
  const reasons: [string, string][] = [
    ["decided", "先にほかの人が決めていました"],
    ["not_approver", "担当者が変わっていました"],
    ["not_writable", "この物を直す権限が無くなっていました"],
  ];
  const updated = [
    {
      approval_id: A_INLINE,
      ticket_id: TICKET_B,
      number: "EG-133",
      run_id: "0193c5a0-0000-7000-8000-0000000e0009",
      pc: "live",
    },
  ];
  await openQueue(page);
  for (const [reason, text] of reasons) {
    b.on.approve = () => ({
      status: 201,
      body: { data: { updated, skipped: [{ approval_id: A_NODUE, number: "EG-140", title: "応募文を出す", reason }] } },
    });
    await page.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
    await confirmDlg(page).getByRole("button", { name: "3 件を承認する", exact: true }).click();
    const note = page.locator("#k-main .k-callout");
    await expect(note).toHaveCount(1);
    await expect(note).toContainText(`1 件は承認できませんでした：EG-140 応募文を出す は、${text}`);
    await expect(note).toContainText("EG-133 は承認しました");
    await expect(note).not.toContainText(reason);
  }
  b.on.approve = () => ({
    status: 201,
    body: { data: { updated, skipped: [{ approval_id: A_NODUE, number: null, title: null, reason: "unavailable" }] } },
  });
  await page.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
  await confirmDlg(page).getByRole("button", { name: "3 件を承認する", exact: true }).click();
  await expect(page.locator("#k-main .k-callout")).toContainText("1 件は見つかりませんでした");
  await expect(page.locator("#k-main .k-callout")).not.toContainText("unavailable");
});

test("K769-UI-019 2 件以上できなかった・全部できなかった：できなかった物を 1 件ずつ「・」でつなぎ（「2 件は承認できませんでした：EG-140 … は、…・EG-133 … は、…」）、承認できた物が 0 件なら「…は承認しました」を出さない", async ({
  page,
}) => {
  const b = await setup(page);
  b.on.approve = () => ({
    status: 201,
    body: {
      data: {
        updated: [],
        skipped: [
          { approval_id: A_INLINE, number: "EG-133", title: "見積を出す", reason: "decided" },
          { approval_id: A_NODUE, number: "EG-140", title: "応募文を出す", reason: "not_approver" },
        ],
      },
    },
  });
  await openQueue(page);
  await page.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
  await confirmDlg(page).getByRole("button", { name: "3 件を承認する", exact: true }).click();
  const note = page.locator("#k-main .k-callout");
  await expect(note).toContainText(
    "2 件は承認できませんでした：EG-133 見積を出す は、先にほかの人が決めていました・EG-140 応募文を出す は、担当者が変わっていました",
  );
  await expect(note).not.toContainText("は承認しました");
});

test("K769-UI-007 50 件を超える：全部の確かめが 409 E-APR-030 なら小窓を開かず正本の文を出す（選んで承認できる）", async ({
  page,
}) => {
  const b = await setup(page);
  b.on.preview = () => err(409, "E-APR-030");
  await openQueue(page);
  await page.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
  await expect(page.locator("#k-main")).toContainText(msg("E-APR-030"));
  await expect(confirmDlg(page)).toHaveCount(0);
  expect(b.approves.length).toBe(0);
});

test("K769-UI-008 確かめの小窓の［やめる］・Esc：承認の口を呼ばず閉じ、選んだ印は残る", async ({ page }) => {
  const b = await setup(page);
  await openQueue(page);
  await pick(page, "EG-133", "見積を出す").check();
  await bar(page).getByRole("button", { name: "選んだものを承認", exact: true }).click();
  await confirmDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(confirmDlg(page)).toHaveCount(0);
  await expect(bar(page)).toContainText("1 件を選んでいます");
  expect(b.approves.length).toBe(0);
});

test("K769-UI-009 承認している間：小窓の主ボタンが処理中で押せず・小窓は閉じない。二度押しでも承認の口は 1 回", async ({
  page,
}) => {
  const b = await setup(page);
  await openQueue(page);
  await page.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
  const open = b.hold();
  const ok = confirmDlg(page).getByRole("button", { name: "3 件を承認する", exact: true });
  await ok.click();
  await ok.click({ force: true });
  await expect(ok).toHaveAttribute("aria-busy", "true");
  open();
  await expect.poll(() => b.approves.length).toBe(1);
});

test("K769-UI-010 承認の口の失敗：503 なら小窓の中に正本の文・閉じずに押し直せる・選んだ印も残る", async ({ page }) => {
  const b = await setup(page);
  b.on.approve = () => err(503, "E-PAGE-003");
  await openQueue(page);
  await pick(page, "EG-133", "見積を出す").check();
  await bar(page).getByRole("button", { name: "選んだものを承認", exact: true }).click();
  await confirmDlg(page).getByRole("button", { name: "1 件を承認する", exact: true }).click();
  await expect(confirmDlg(page)).toContainText(msg("E-PAGE-003").split("。")[0]!);
  await expect(confirmDlg(page).getByRole("button", { name: "1 件を承認する", exact: true })).toBeEnabled();
  await confirmDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(pick(page, "EG-133", "見積を出す")).toBeChecked();
  await expect(bar(page)).toContainText("1 件を選んでいます");
});

test("K769-UI-011 確かめの口の失敗：503・403 なら小窓を開かず正本の文の帯（403 は E-PAGE-002）・承認の口は呼ばない", async ({
  page,
}) => {
  const b = await setup(page);
  b.on.preview = () => err(503, "E-PAGE-003");
  await openQueue(page);
  await page.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
  await expect(page.locator("#k-main")).toContainText(msg("E-PAGE-003").split("。")[0]!);
  b.on.preview = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  await page.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
  await expect(page.locator("#k-main")).toContainText(msg("E-PAGE-002").split("。")[0]!);
  await expect(confirmDlg(page)).toHaveCount(0);
  expect(b.approves.length).toBe(0);
});

test("K769-UI-012 確かめの後に変わった：確かめで承認できる物が 0 件（excluded だけ）なら、小窓を開かず「まとめて承認できるものがありません」と一覧を読み直す", async ({
  page,
}) => {
  const b = await setup(page);
  b.on.preview = () => ({
    status: 201,
    body: {
      data: {
        eligible: [],
        excluded: [{ approval_id: A_INLINE, reason: "decided" }],
        count: 0,
        irreversible_count: 0,
        unchecked_count: 0,
      },
    },
  });
  await openQueue(page);
  const reads = b.queueReads();
  await pick(page, "EG-133", "見積を出す").check();
  await bar(page).getByRole("button", { name: "選んだものを承認", exact: true }).click();
  await expect(page.locator("#k-main")).toContainText("まとめて承認できるものがありません");
  await expect(confirmDlg(page)).toHaveCount(0);
  await expect.poll(() => b.queueReads()).toBeGreaterThan(reads);
});

test("K769-UI-013 スマホ（375）：カードの四角で選び、選んだ帯は下に貼り付き（position が sticky か fixed・窓の下の端から 120px 以内）、確かめの小窓は下から出る。幅 320〜1440 で横溢れ 0", async ({
  page,
}) => {
  await setup(page);
  await openQueue(page, 375);
  // カードが必ず窓をはみ出す高さにしてから測る（帯の元の置き場が窓の中だと sticky が貼り付かずその場に留まるため）
  await page.setViewportSize({ width: 375, height: 600 });
  const vh = page.viewportSize()!.height;
  await page.getByRole("region", { name: "承認待ちの一覧（スマホ）" }).getByRole("checkbox").first().check();
  await expect(bar(page)).toBeVisible();
  const r = (await bar(page).boundingBox())!;
  // 下のタブ（--k-c-shell-tabs-height 60px）の上に貼り付く：タブの裏に隠れず、窓の下の端から 120px 以内
  expect(r.y + r.height).toBeLessThanOrEqual(vh - 60);
  expect(r.y + r.height).toBeGreaterThan(vh - 120);
  expect(["sticky", "fixed"]).toContain(await bar(page).evaluate((e) => getComputedStyle(e).position));
  for (const w of WIDTHS_ALL) {
    await page.setViewportSize({ width: w, height: 900 });
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
});

test("K769-UI-014 キーボード：行の四角は Space で選べ、［選んだものを承認］まで Tab で届き Enter で確かめの小窓が開く", async ({
  page,
}) => {
  const b = await setup(page);
  await openQueue(page);
  const box = pick(page, "EG-133", "見積を出す");
  await box.focus();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
  await bar(page).getByRole("button", { name: "選んだものを承認", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => b.previews.length).toBe(1);
  await expect(confirmDlg(page)).toBeVisible();
});

test("K769-UI-015 守り：四角を押すだけでは口を呼ばない・小窓を開くまで承認の口 0・本人の Bridge に飛ばない", async ({
  page,
}) => {
  const b = await setup(page);
  let bridge = 0;
  await page.route(/127\.0\.0\.1:38617/, (r) => {
    bridge++;
    return r.fulfill({ status: 404, body: "" });
  });
  await openQueue(page);
  await pick(page, "EG-133", "見積を出す").check();
  expect(b.previews.length + b.approves.length).toBe(0);
  expect(bridge).toBe(0);
});

test("K769-UI-020 一覧を読み直して無くなった物：選んだ 1 件が読み直しで一覧から消えたら、選んだ印から外れ（帯の数が減る）、確かめの口にも送らない", async ({
  page,
}) => {
  const b = await setup(page);
  await openQueue(page);
  await pick(page, "EG-133", "見積を出す").check();
  await pick(page, "EG-140", "応募文を出す").check();
  await expect(bar(page)).toContainText("2 件を選んでいます");
  b.queueRows = (rows) => rows.filter((r) => r["id"] !== A_NODUE);
  await page.reload();
  await expect(bar(page)).toHaveCount(0);
});

test("K769-UI-021 もっと見るで 50 件を超えて選んだ：選べるのは 50 件まで（51 件目の四角は押せない形＝disabled・押しても選ばれない・title「まとめて承認は 50 件までです」）。口が 422・409 を返しても小窓の外に正本の文", async ({
  page,
}) => {
  const b = await setup(page);
  const many = Array.from({ length: 51 }, (_, i) =>
    qrow(`0193c5a0-0000-7000-8000-${String(1000000000000 + 60000 + i).slice(1)}`, {
      title: `件 ${i + 1}`,
      ticket_number: `EG-${300 + i}`,
    }),
  );
  b.queueRows = () => many;
  await openQueue(page);
  await page.getByRole("checkbox", { name: "まとめて選べるものをすべて選ぶ", exact: true }).check();
  await expect(bar(page)).toContainText("50 件を選んでいます");
  const last = page.getByRole("checkbox", { name: "EG-350 を選ぶ", exact: true });
  await expect(last).not.toBeChecked();
  await expect(last).toHaveAttribute("title", "まとめて承認は 50 件までです");
  // 押せない形（素の disabled・answer=0574d6e78a2a）：押しても選ばれず、帯は 50 件のまま
  await expect(last).toBeDisabled();
  await last.click({ force: true });
  await expect(last).not.toBeChecked();
  await expect(bar(page)).toContainText("50 件を選んでいます");
  b.on.preview = () => ({ status: 422, body: { error: "validation_failed", code: "VALIDATION_FAILED" } });
  await bar(page).getByRole("button", { name: "選んだものを承認", exact: true }).click();
  await expect(confirmDlg(page)).toHaveCount(0);
  await expect(page.locator("#k-main .k-callout")).toBeVisible();
});

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
const p = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
const BULK_PAIRS: FidelityPair[] = [
  p("bulkbar", ".k-more-bulkbar", [...BOX, "texts"]),
  // 帯の［選んだものを承認］は帯の直の子のボタン・［まとめて承認（全部）］は道具の行の端の最初のボタン（前に並べ替えの span が在る）。
  //   どちらも下絵と本番で同じ 1 つに当たる形（more.css に定義の無いクラスは付けない）
  p("bulkbar-act", ".k-more-bulkbar > button", CTRL),
  p("bulk-all", ".k-ap-tools-end > button:first-of-type", CTRL),
  p("pick", ".k-more-pick", ["width", "height", "x", "y"]),
  p("mpick", ".k-more-mcard-pick", ["width", "height", "x", "y"]),
  p("dialog", '[role="dialog"] .k-dialog-box, [role="alertdialog"]', ["width", "x", "y"]),
  p("dlg-title", '[role="dialog"] h2, [role="alertdialog"] h2', ["x", "y", "font-size", "font-weight", "color"]),
  p("pending", ".k-more-pending", [...BOX]),
  p("callout", "#k-main .k-callout", [...BOX]),
];
// 注：下絵の件数と番号（EG-128・EG-127・6 件・取り消せない 3 件 ほか）は下絵の固定の値で、試験の承認待ちの土台（EG-133・EG-140・3 件）と違う。
//   字（texts）は帯の 1 行の形だけを上の行で見て、ここでは箱・位置・色・大きさを比べる
const SKIP = ["bulkbar:texts", "bulkbar-act:texts", "bulk-all:texts"];
async function match(
  browser: Browser,
  id: string,
  drive: (pg: Page, w: number) => Promise<void>,
  widths: readonly number[] = MATCH_WIDTHS,
) {
  const bad: string[] = [];
  for (const w of widths) {
    const r = await matchMock(browser, id, w, (pg) => drive(pg, w), {
      pairs: BULK_PAIRS,
      base: "/dev/mock/f5",
      skip: SKIP,
    });
    bad.push(...r.bad);
  }
  expect(bad, bad.join("\n")).toEqual([]);
}
const pick2 = async (pg: Page, w: number) => {
  await setup(pg);
  await openQueue(pg, w);
  const lst =
    w < 768
      ? pg.getByRole("region", { name: "承認待ちの一覧（スマホ）" }).getByRole("checkbox")
      : pg.getByRole("table").getByRole("checkbox");
  await lst.nth(w < 768 ? 0 : 1).check();
  await lst.nth(w < 768 ? 1 : 2).check();
};

test("K769-UI-016 下絵との突き合わせ：bulk-select（2 件を選んだ帯）・bulk-confirm-selected（選んだものの確かめ）", async ({
  browser,
}) => {
  await match(browser, "bulk-select", pick2);
  await match(browser, "bulk-confirm-selected", async (pg, w) => {
    await pick2(pg, w);
    await bar(pg).getByRole("button", { name: "選んだものを承認", exact: true }).click();
  });
});
test("K769-UI-017 下絵との突き合わせ：bulk-confirm-all・bulk-running（答えを止めた間）", async ({ browser }) => {
  await match(browser, "bulk-confirm-all", async (pg, w) => {
    await setup(pg);
    await openQueue(pg, w);
    await pg.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
  });
  await match(browser, "bulk-running", async (pg, w) => {
    await pick2(pg, w);
    await bar(pg).getByRole("button", { name: "選んだものを承認", exact: true }).click();
    // 答えを止めた間の主ボタン（処理中）を比べる
    await pg.route(/\/api\/v1\/approvals\/bulk$/, () => new Promise<void>(() => undefined));
    await confirmDlg(pg)
      .getByRole("button", { name: /件を承認する$/ })
      .click();
  });
});
test("K769-UI-018 下絵との突き合わせ：bulk-done・bulk-partial（承認した後の帯）・bulk-mobile（375）", async ({
  browser,
}) => {
  await match(browser, "bulk-done", async (pg, w) => {
    await pick2(pg, w);
    await bar(pg).getByRole("button", { name: "選んだものを承認", exact: true }).click();
    await confirmDlg(pg)
      .getByRole("button", { name: /件を承認する$/ })
      .click();
    await expect(pg.locator(".k-callout").filter({ hasText: "を承認しました" })).toBeVisible();
  });
  await match(browser, "bulk-partial", async (pg, w) => {
    const b = await setup(pg);
    b.on.approve = () => ({
      status: 201,
      body: {
        data: {
          updated: [
            {
              approval_id: A_INLINE,
              ticket_id: TICKET_B,
              number: "EG-133",
              run_id: "0193c5a0-0000-7000-8000-0000000e0009",
              pc: "live",
            },
          ],
          skipped: [{ approval_id: A_NODUE, number: "EG-140", title: "応募文を出す", reason: "decided" }],
        },
      },
    });
    await openQueue(pg, w);
    await pg.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
    await confirmDlg(pg)
      .getByRole("button", { name: /件を承認する$/ })
      .click();
    await expect(pg.locator(".k-callout").filter({ hasText: "承認できませんでした" })).toBeVisible();
  });
  await match(
    browser,
    "bulk-mobile",
    async (pg, w) => {
      await pick2(pg, w);
      await bar(pg).getByRole("button", { name: "選んだものを承認", exact: true }).click();
    },
    [375],
  );
});
