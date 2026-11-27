// K-747「画面：試し打ち（カードの［試し打ち（自分宛）］・確かめの小窓・試し打ち中・届いた／止まった の帯）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5/dry-*（代表が OK を出した段 6 の下絵）。字・並び・ボタンは下絵が正。試し打ちは任意（D-153.6）。
//   土台は approve-complete.harness.ts の mockApi。試し打ちの口 dryRunTicket（K-746）・実行（phase dry_run）・セッション（メールアドレス）は
//   段 6 の道具 f5-more-kit.ts の layer で重ねる。3 秒の読み直しは時計を進める（固定の待ちは使わない）。name は exact
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { ME, bandOf, k62Band, mockApi, openTicket, pending, type Mock } from "../features/F5/approve-complete.harness";
import {
  BAND_PAIRS,
  DIALOG_PAIRS,
  DOWN,
  RUN_ID,
  STOPPED_AT,
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
  type Writes,
} from "./f5-more-kit";
import { matchMock } from "./stage2-match";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const DRY = `/api/v1/tickets/${TICKET}/dry-run`;
const MAIL = "takamoto@engine-base.example";
const MSG = {
  btn: "試し打ち（自分宛）",
  title: "試し打ちします",
  body: (mail: string | null) =>
    `${mail ? `あなた（${mail}）宛てに送ります` : "あなた宛てに送ります"}。本来の宛先には送りません。承認待ちはそのままで、何回でも試せます。試し打ちは任意で、しなくても承認できます`,
  detail: "宛先を差し替えられない操作（応募フォームなど）は、実行せずに止まります",
  running: "試し打ちを実行しています",
  runningLine: "本来の宛先には送りません。承認待ちはそのままです",
  done: "試し打ちをあなた宛てに送りました",
  doneLine: "本来の宛先には送っていません。承認待ちはそのままです",
  stopped: "試し打ちは止まりました",
  headReason: "宛先を差し替えられない操作があったので、実行せずに止まりました",
  headLine:
    "宛先を差し替えられない操作（応募フォームなど）があったので、実行せずに止まりました。本来の宛先には何も送っていません",
  again: "もう一度試し打ち",
} as const;

interface D {
  m: Mock;
  w: Writes;
  run: Record<string, unknown> | null;
  mail: string | null;
  count: number;
}
async function mockDry(page: Page, o: { run?: Record<string, unknown> | null; mail?: string | null } = {}): Promise<D> {
  const m = await mockApi(page, { stage: "awaiting_approval", approval: pending() });
  const d: D = {
    m,
    w: undefined as unknown as Writes,
    run: o.run ?? null,
    mail: o.mail === undefined ? MAIL : o.mail,
    count: 0,
  };
  const runs = runReplies(() => d.run);
  d.w = await layer(page, (req, path) => {
    if (req.method() === "POST" && path === DRY) {
      d.count++;
      const id = d.count === 1 ? RUN_ID : `0193c5a0-0000-7000-8000-0000000e00${String(d.count).padStart(2, "0")}`;
      d.run = runRow({ id, phase: "dry_run", status: "queued", by: { member_id: ME, display_name: "高本" } });
      return {
        status: 201,
        body: { data: { run_id: id, job_id: "0193c5a0-0000-7000-8000-0000000b0009", pc: "live" } },
      };
    }
    if (path === "/api/auth/get-session")
      return d.mail
        ? {
            status: 200,
            body: {
              session: { id: "s1", userId: ME, token: "t", expiresAt: "2099-01-01T00:00:00Z" },
              user: { id: ME, email: d.mail, name: "高本", emailVerified: true },
            },
          }
        : { status: 200, body: null };
    return runs(path);
  });
  return d;
}
const dryBtn = (page: Page) =>
  page.getByRole("region", { name: "成果物", exact: true }).getByRole("button", { name: MSG.btn, exact: true });
const go = (page: Page) =>
  confirmOf(page).locator(".k-dialog-actions").getByRole("button", { name: "試し打ちする", exact: true });
const dryBand = (page: Page, title: string) => bandOf(page).locator(".k-band").filter({ hasText: title });
const openDry = async (page: Page) => {
  await dryBtn(page).click();
  await expect(confirmOf(page)).toBeVisible();
};

test("K747-UI-001 入口：承認待ちの成果物のカードの「試し打ち（自分宛）」は押せる形（ghost）で、押すと口を呼ばずに小窓「試し打ちします」（本文・注記・足「やめる」「試し打ちする」）が開く", async ({
  page,
}) => {
  const d = await mockDry(page);
  await openTicket(page);
  await expect(dryBtn(page)).toBeEnabled();
  await expect(dryBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(dryBtn(page)).toHaveAttribute("data-variant", "ghost");
  await openDry(page);
  const dl = confirmOf(page);
  await expect(dl.getByRole("heading", { name: MSG.title, exact: true })).toBeVisible();
  await expect(dl.getByText(MSG.body(MAIL), { exact: true })).toBeVisible();
  await expect(dl.getByText(MSG.detail, { exact: true })).toBeVisible();
  await expect(dl.locator(".k-dialog-actions").getByRole("button")).toHaveText(["やめる", "試し打ちする"]);
  expect(d.w.of(/dry-run$/)).toHaveLength(0);
});

test("K747-UI-002 入力：セッションのメールアドレスが読めないとき、本文は「あなた宛てに送ります。…」（括弧なし）", async ({
  page,
}) => {
  await mockDry(page, { mail: null });
  await openTicket(page);
  await openDry(page);
  await expect(confirmOf(page).getByText(MSG.body(null), { exact: true })).toBeVisible();
});

test("K747-UI-003 入力：小窓の「試し打ちする」で試し打ちの口に 1 回（体は {}）。小窓が閉じ、承認の帯の箱のすぐ下に青い帯「試し打ちを実行しています」・要約「宛先をあなたに差し替えています…」・1 行。承認の帯はそのまま", async ({
  page,
}) => {
  const d = await mockDry(page);
  await openTicket(page);
  await openDry(page);
  await go(page).click();
  await expect.poll(() => d.w.of(/dry-run$/).length).toBe(1);
  expect(d.w.of(/dry-run$/)[0]).toEqual({ path: DRY, body: {} });
  await expect(confirmOf(page)).toHaveCount(0);
  const b = dryBand(page, MSG.running);
  await expect(b.locator(".k-band-sub")).toContainText("宛先をあなたに差し替えています");
  await expect(b).toContainText(MSG.runningLine);
  await expect(bandOf(page)).toContainText("あなたの承認を待っています");
  await expect(bandOf(page).getByRole("button", { name: "承認して送る", exact: true })).toBeVisible();
  const ap = await bandOf(page).locator(".k-band").first().boundingBox();
  const dr = await b.boundingBox();
  const card = await page.getByRole("region", { name: "成果物", exact: true }).boundingBox();
  expect(ap && dr && card && dr.y >= ap.y + ap.height - 1 && dr.y < card.y).toBe(true);
});

test("K747-UI-004 操作の揺れ：答えを止めた間に「試し打ちする」を 2 回押し Esc を押しても口は 1 回。待つ間は主ボタンが処理中で小窓は閉じない", async ({
  page,
}) => {
  const d = await mockDry(page);
  await openTicket(page);
  const release = d.w.hold();
  await openDry(page);
  await go(page).click();
  await expect.poll(() => d.w.of(/dry-run$/).length).toBe(1);
  await go(page).click({ force: true });
  await page.keyboard.press("Escape");
  await expect(go(page)).toHaveAttribute("aria-busy", "true");
  await expect(confirmOf(page)).toBeVisible();
  release();
  await expect(confirmOf(page)).toHaveCount(0);
  expect(d.w.of(/dry-run$/)).toHaveLength(1);
});

test("K747-UI-005 時間の流れ：試し打ち中に 3 秒進めると実行が done で、帯が緑「試し打ちをあなた宛てに送りました」・要約「届いた物を確かめてください ・ HH:MM」・1 行・「もう一度試し打ち」。その後は実行の 1 件を読まない", async ({
  page,
}) => {
  await page.clock.install();
  const d = await mockDry(page);
  await openTicket(page);
  await openDry(page);
  await go(page).click();
  await expect(dryBand(page, MSG.running)).toBeVisible();
  d.run = { ...d.run!, status: "done", finished_at: STOPPED_AT };
  await page.clock.fastForward(3_500);
  const b = dryBand(page, MSG.done);
  await expect(b.locator(".k-band-sub")).toHaveText("届いた物を確かめてください ・ 10:40");
  await expect(b).toContainText(MSG.doneLine);
  await expect(b.getByRole("button", { name: MSG.again, exact: true })).toBeVisible();
  const reads = d.w.reads("/api/v1/action_runs/");
  await page.clock.fastForward(7_000);
  expect(d.w.reads("/api/v1/action_runs/")).toBe(reads);
});

test("K747-UI-006 対象の状態：実行の一覧の頭が dry_run で stopped・理由が既定の字なら、赤い帯（role=alert）「試し打ちは止まりました」・1 行は下絵の字・「もう一度試し打ち」。開き直しても同じ", async ({
  page,
}) => {
  await mockDry(page, {
    run: runRow({ phase: "dry_run", status: "stopped", stopped_reason: MSG.headReason, finished_at: STOPPED_AT }),
  });
  for (let i = 0; i < 2; i++) {
    await openTicket(page);
    const b = bandOf(page).getByRole("alert").filter({ hasText: MSG.stopped });
    await expect(b).toContainText(MSG.headLine);
    await expect(b.getByRole("button", { name: MSG.again, exact: true })).toBeVisible();
  }
});

test("K747-UI-007 対象の状態：頭の dry_run が stopped で理由「承認が決まったので、待っていた試し打ちを止めました」・cancelled で「PC でこの試し打ちをやめました。もう一度試し打ちできます」なら、赤い帯の 1 行は理由の全文そのまま", async ({
  page,
}) => {
  for (const [status, reason] of [
    ["stopped", "承認が決まったので、待っていた試し打ちを止めました"],
    ["cancelled", "PC でこの試し打ちをやめました。もう一度試し打ちできます"],
  ] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockDry(page, { run: runRow({ phase: "dry_run", status, stopped_reason: reason, finished_at: STOPPED_AT }) });
    await openTicket(page);
    const b = bandOf(page).getByRole("alert").filter({ hasText: MSG.stopped });
    await expect(b.locator(".k-band-line, p").filter({ hasText: reason })).toHaveText(reason);
  }
});

test("K747-UI-008 失敗：手順 S1 の失敗（409・E-CONF-013・E-RUN-003・E-RUN-005・403・503）は小窓を閉じ、帯の上の知らせに正本の文。試し打ちの帯は出ない。E-RUN-003 はチケットを読み直す", async ({
  page,
}) => {
  const d = await mockDry(page);
  await openTicket(page);
  for (const [r, text] of [
    [refuse(409, "E-CONF-013"), msg("E-CONF-013")],
    [refuse(409, "E-RUN-003"), msg("E-RUN-003")],
    [refuse(409, "E-RUN-005"), msg("E-RUN-005")],
    [refuse(403, "FORBIDDEN", "forbidden"), msg("E-PAGE-002")],
    [DOWN, msg("E-PAGE-003")],
  ] as const) {
    d.w.next.push(r);
    const t0 = d.w.reads(`/api/v1/tickets/${TICKET}`);
    await openDry(page);
    await go(page).click();
    await expect(confirmOf(page)).toHaveCount(0);
    await expect(noticeOf(page)).toHaveText(text);
    await expect(dryBand(page, MSG.running)).toHaveCount(0);
    if ((r.body as { code: string }).code === "E-RUN-003")
      await expect.poll(() => d.w.reads(`/api/v1/tickets/${TICKET}`)).toBeGreaterThan(t0);
  }
});

test("K747-UI-009 失敗：手順 S1 の失敗（409・E-RUN-004・detail.reason）は知らせ「試し打ちを動かす AI が使えません（〈理由〉）」", async ({
  page,
}) => {
  const d = await mockDry(page);
  await openTicket(page);
  const why = "AI に任せた人がこのチケットを直せなくなりました";
  d.w.next.push({ status: 409, body: { error: "conflict", code: "E-RUN-004", detail: { reason: why } } });
  await openDry(page);
  await go(page).click();
  await expect(noticeOf(page)).toHaveText(`${msg("E-RUN-004")}（${why}）`);
});

test("K747-UI-010 対象の状態：実行の一覧の頭が dry_run で running なら、任せる帯に「作っています」の箱が無く、承認と実行の帯に「実行中」の箱も無い", async ({
  page,
}) => {
  await mockDry(page, { run: runRow({ phase: "dry_run", status: "running" }) });
  await openTicket(page);
  await expect(dryBand(page, MSG.running)).toBeVisible();
  await expect(k62Band(page).getByText(/が作っています/)).toHaveCount(0);
  await expect(bandOf(page).getByText("実行中", { exact: true })).toHaveCount(0);
});

test("K747-UI-011 入力：届いた帯の「もう一度試し打ち」で同じ小窓が開き、「試し打ちする」で口に 2 回目（新しい run_id）・帯は「試し打ちを実行しています」に戻る", async ({
  page,
}) => {
  const d = await mockDry(page, { run: runRow({ phase: "dry_run", status: "done", finished_at: STOPPED_AT }) });
  await openTicket(page);
  await dryBand(page, MSG.done).getByRole("button", { name: MSG.again, exact: true }).click();
  await expect(confirmOf(page).getByRole("heading", { name: MSG.title, exact: true })).toBeVisible();
  await go(page).click();
  await expect.poll(() => d.w.of(/dry-run$/).length).toBe(1);
  await expect(dryBand(page, MSG.running)).toBeVisible();
  await expect(dryBand(page, MSG.done)).toHaveCount(0);
});

test("K747-UI-012 守り：試し打ちは任意。一度もしないで「承認して送る」→「成果物を目で見た」→「承認して送る」で承認の口に 1 回（試し打ちを求めない）", async ({
  page,
}) => {
  const d = await mockDry(page);
  await openTicket(page);
  await bandOf(page).getByRole("button", { name: "承認して送る", exact: true }).click();
  await confirmOf(page).getByRole("checkbox", { name: "成果物を目で見た", exact: true }).check();
  await confirmOf(page).locator(".k-dialog-actions").getByRole("button", { name: "承認して送る", exact: true }).click();
  await expect.poll(() => d.m.approves.length).toBe(1);
  expect(d.w.of(/dry-run$/)).toHaveLength(0);
});

test("K747-UI-013 守り：メールアドレスは小窓の本文にだけ出て、小窓を閉じた後の頁（帯・知らせ）には無い", async ({
  page,
}) => {
  await mockDry(page);
  await openTicket(page);
  await openDry(page);
  await go(page).click();
  await expect(dryBand(page, MSG.running)).toBeVisible();
  await expect(page.locator("#k-main")).not.toContainText(MAIL);
});

test("K747-UI-014 画面：キーボードだけで、Tab で「試し打ち（自分宛）」に届き Enter で小窓が開き、Esc で閉じて焦点が戻る", async ({
  page,
}) => {
  await mockDry(page);
  await openTicket(page);
  await dryBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(confirmOf(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dryBtn(page)).toBeFocused();
});

test("K747-UI-015 画面：幅 375・768・1440 で小窓と帯は横溢れ 0・足の 2 つが画面の中。375 では小窓の下の端が画面の下の端から 16px（±1・下絵の下から出す形の余白）", async ({
  page,
}) => {
  for (const w of WIDTHS) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockDry(page);
    await openTicket(page, w);
    await openDry(page);
    await noOverflow(page, w);
    for (const b of await confirmOf(page).locator(".k-dialog-actions").getByRole("button").all())
      await expect(b).toBeInViewport();
    if (w === 375) {
      const r = await confirmOf(page).boundingBox();
      expect(r && Math.abs(812 - (r.y + r.height) - SHEET_GAP) <= 1).toBe(true);
    }
    await go(page).click();
    await expect(dryBand(page, MSG.running)).toBeVisible();
    await noOverflow(page, w);
  }
});

test("K747-UI-016 画面：下絵との突き合わせ（dry-card・dry-confirm・dry-running・dry-done・dry-stopped）。幅 375・768・1440 でカードのボタン・小窓・試し打ちの帯の形が下絵と同じ", async ({
  browser,
}) => {
  const stoppedRun = runRow({
    phase: "dry_run",
    status: "stopped",
    stopped_reason: MSG.headReason,
    finished_at: STOPPED_AT,
  });
  const doneRun = runRow({ phase: "dry_run", status: "done", finished_at: STOPPED_AT });
  // 本番もモックと同じ幅で開く（前は 1440 で開いて、狭い幅のモックと 1440 の本番を比べていた・K734-UI-018 と同じ直し）
  const drives: [string, (p: Page, w: number) => Promise<void>, boolean][] = [
    [
      "dry-card",
      async (p, w) => {
        await mockDry(p);
        await openTicket(p, w);
      },
      false,
    ],
    [
      "dry-confirm",
      async (p, w) => {
        await mockDry(p);
        await openTicket(p, w);
        await openDry(p);
      },
      true,
    ],
    [
      "dry-running",
      async (p, w) => {
        await mockDry(p, { run: runRow({ phase: "dry_run", status: "running" }) });
        await openTicket(p, w);
      },
      false,
    ],
    [
      "dry-done",
      async (p, w) => {
        await mockDry(p, { run: doneRun });
        await openTicket(p, w);
      },
      false,
    ],
    [
      "dry-stopped",
      async (p, w) => {
        await mockDry(p, { run: stoppedRun });
        await openTicket(p, w);
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
          await drive(p, w);
        },
        { base: "/dev/mock/f5", pairs: dialog ? DIALOG_PAIRS : BAND_PAIRS, blur: true },
      );
      expect(rows.length, `${id}・幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, `${id}・幅 ${w}\n${bad.join("\n")}`).toEqual([]);
    }
  }
});

test("K747-UI-017 守り：止まった理由に <img src=x onerror=alert(1)> があっても赤い帯の 1 行に字のまま出て img ができず、ダイアログは開かない", async ({
  page,
}) => {
  let alerted = false;
  page.on("dialog", (dl) => {
    alerted = true;
    void dl.dismiss();
  });
  const bad = "<img src=x onerror=alert(1)>";
  await mockDry(page, {
    run: runRow({ phase: "dry_run", status: "stopped", stopped_reason: bad, finished_at: STOPPED_AT }),
  });
  await openTicket(page);
  await expect(bandOf(page).getByRole("alert").filter({ hasText: MSG.stopped })).toContainText(bad);
  await expect(page.locator("#k-main img[src='x']")).toHaveCount(0);
  expect(alerted).toBe(false);
});

test('K747-UI-018 入口（ファイルを読む）：先 features/F5/more/fills/dry-run.tsx が DryRunActFill・DryRunFill を export し、dryRunTicket は features/F5/dry-run/ からだけ呼ばれる。use-run.ts の phase の型に "dry_run" が在る', () => {
  const fill = join(WEB, "features/F5/more/fills/dry-run.tsx");
  expect(existsSync(fill)).toBe(true);
  const src = readFileSync(fill, "utf8");
  for (const n of ["DryRunActFill", "DryRunFill"]) expect(src).toMatch(new RegExp(`export function ${n}\\b`));
  expect(readFileSync(join(WEB, "features/F5/delegate/use-run.ts"), "utf8")).toMatch(/phase:[^;\n]*"dry_run"/);
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? files(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
    );
  const callers = files(join(WEB, "features")).filter((f) => /"dryRunTicket"/.test(readFileSync(f, "utf8")));
  expect(callers.length).toBeGreaterThan(0);
  for (const f of callers) expect(f).toContain(join("features", "F5", "dry-run"));
});
