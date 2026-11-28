// K-957「帯（障害・メンテ）と画面いっぱいの形（メンテ中・障害）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f12-user の uh-band-incident・uh-band-maint・uh-maint・uh-down（本番と同じ部品 features/F12/help/status-parts・K-943）。
//   帯は外枠 TicketShell の 1 つの差し込み口に並ぶ（D-156.10）。外枠を触るので、外枠を含む画面を幅ごとに数で測る（L-003 G-05）。
//   ログイン・外枠は本物。稼働状況とお知らせの口だけを網の手前で差し替える（help-mock.ts・K-956）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { USER_PAIRS, USER_WIDTHS, matchUser, overflowX } from "./f12-user-match";
import {
  GONE,
  N_INCIDENT,
  N_MAINT,
  err,
  incidentBand,
  maintBand,
  mockHelp,
  noticesTaka,
  statusTaka,
  type HMock,
  type StatusA,
} from "./help-mock";

/** 外枠 TicketShell を使う画面（2026-11-23 の本線と段 13 の道） */
const SHELL_PAGES = ["/tickets", "/approvals", "/settings/credentials", "/notices", "/inquiry"] as const;
const BAND = ".k-uh-bands .k-band";

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

/** 下絵の障害の帯の 2 行目＝最新の続報の本文 */
const noticesWithUpdate = () => {
  const ns = noticesTaka();
  ns[0]!.updates = [
    { state: "identified", body: "データは消えていません。承認したものは順に動きます", at: "2025-11-02T01:30:00Z" },
  ];
  return ns;
};
const withBands = (...bands: StatusA["bands"]): StatusA => ({ ...statusTaka(), bands });
async function openAt(page: Page, path = "/tickets", width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(path);
}
async function mockWith(page: Page, status: StatusA): Promise<HMock> {
  return mockHelp(page, { status, notices: noticesWithUpdate() });
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const DRIVES: Record<string, (page: Page) => Promise<void>> = {
  "uh-band-incident": async (page) => {
    await mockWith(page, withBands(incidentBand()));
    await openAt(page, "/tickets", page.viewportSize()!.width);
    await expect(page.locator(BAND)).toBeVisible();
  },
  "uh-band-maint": async (page) => {
    // 下絵 uh-band-maint の影響の字（短い 1 文）で開く。長い影響の字の出方は uh-maint（画面いっぱいの形）が見る
    const ns = noticesWithUpdate();
    for (const n of ns)
      if (n.maintenance) n.maintenance.impact = "この間は使えません。承認したものは終わってから動きます";
    await mockHelp(page, { status: withBands(maintBand()), notices: ns });
    await openAt(page, "/tickets", page.viewportSize()!.width);
    await expect(page.locator(BAND)).toBeVisible();
  },
  "uh-maint": async (page) => {
    await mockWith(page, {
      ...statusTaka(),
      maintenance_now: { from: "2025-11-09T17:00:00Z", to: "2025-11-09T18:00:00Z" },
    });
    await openAt(page, "/tickets", page.viewportSize()!.width);
    await expect(page.getByRole("heading", { name: "いまメンテナンス中です", level: 1, exact: true })).toBeVisible();
  },
  "uh-down": async (page) => {
    const ns = noticesTaka();
    ns[0]!.updates = [
      {
        state: "identified",
        body: "チケットの保存が遅くなっている。読むことはできる。分身の実行は止めている（承認したものは直ったら順に動く）",
        at: "2025-11-02T01:42:00Z",
      },
    ];
    await mockHelp(page, {
      notices: ns,
      status: {
        components: [{ key: "web", label: "画面", state: "down" }],
        bands: [incidentBand({ from: "2025-11-02T01:38:00Z" })],
        maintenance_now: null,
      },
    });
    await openAt(page, "/tickets", page.viewportSize()!.width);
    await expect(
      page.getByRole("heading", { name: "Kaname の調子が悪くなっています", level: 1, exact: true }),
    ).toBeVisible();
  },
};
for (const id of Object.keys(DRIVES)) {
  for (const w of USER_WIDTHS) {
    test(`K957-UI-001 ${id} 幅 ${w}：帯・メンテ中・障害の画面の位置と大きさと字がモックと同じ（下の本文は比べない）`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const pairs = USER_PAIRS.filter((p) => ["band", "full", "state"].includes(p.name));
      // 障害の番号は口の番号（notice_id の頭）で、下絵は見本の字（INC-2611-03）
      const skip = id === "uh-down" ? ["full:texts"] : [];
      const { bad, rows } = await matchUser(browser, id, w, DRIVES[id]!, { pairs, skip });
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 帯
test("K957-UI-002 障害の帯：本文の上に「障害 ・ 分身の実行が遅れています（11/02 09:40〜）」と「原因が分かった ・ <最新の続報>」・稼働状況 1 回・お知らせ 1 回", async ({
  page,
}) => {
  const mk = await mockWith(page, withBands(incidentBand()));
  await openAt(page);
  await expect(page.locator(BAND)).toContainText("障害 ・ 分身の実行が遅れています（11/02 09:40〜）");
  await expect(page.locator(BAND)).toContainText(
    "原因が分かった ・ データは消えていません。承認したものは順に動きます",
  );
  const bandTop = await page.locator(BAND).boundingBox();
  const head = await page.locator("[data-ticket-shell] .k-page-head, [data-ticket-shell] h1").first().boundingBox();
  expect(bandTop!.y).toBeLessThan(head!.y);
  await expect.poll(() => [mk.count("shellStatus"), mk.count("notices")]).toEqual([1, 1]);
});

test("K957-UI-003 帯が無いとき：帯の場所を出さず、お知らせの口を呼ばない（稼働状況は 1 回）", async ({ page }) => {
  const mk = await mockWith(page, statusTaka());
  await openAt(page);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator(".k-uh-bands")).toHaveCount(0);
  await expect.poll(() => [mk.count("shellStatus"), mk.count("notices")]).toEqual([1, 0]);
});

test("K957-UI-004 障害の帯を閉じる：その画面では消え、別の画面に移るとまた出る（直るまで出る・D-156.27）", async ({
  page,
}) => {
  await mockWith(page, withBands(incidentBand()));
  await openAt(page);
  await page.locator(BAND).getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.locator(BAND)).toHaveCount(0);
  await page.goto("/approvals");
  await expect(page.locator(BAND)).toContainText("障害 ・ 分身の実行が遅れています");
});

test("K957-UI-005 メンテの帯を閉じる：消え、別の画面・読み直しでも出ない。別のメンテのお知らせの帯は出る", async ({
  page,
}) => {
  const mk = await mockWith(page, withBands(maintBand()));
  await openAt(page);
  await page.locator(BAND).getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.locator(BAND)).toHaveCount(0);
  await page.goto("/approvals");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator(BAND)).toHaveCount(0);
  mk.status = withBands(maintBand({ notice_id: N_INCIDENT, title: "別のメンテナンス" }));
  await page.reload();
  await expect(page.locator(BAND)).toContainText("メンテナンスの予定");
});

test("K957-UI-006 帯が重なる：頭の 1 つだけを出し「ほか N 件のお知らせ」（N＝残りの帯の数＋その帯の more）で /notices へ", async ({
  page,
}) => {
  await mockWith(page, withBands(incidentBand({ more: 2 }), maintBand()));
  await openAt(page);
  await expect(page.locator(BAND)).toHaveCount(1);
  await expect(page.locator(BAND)).toContainText("障害 ・");
  const more = page.locator(".k-uh-bands").getByRole("link", { name: "ほか 3 件のお知らせ", exact: true });
  await expect(more).toHaveAttribute("href", "/notices");
});

test("K957-UI-007 「詳しく」でそのお知らせ 1 件（/notices/<id>）へ。着いた画面にそのお知らせの題の見出しが出る（見つからないにならない）", async ({
  page,
}) => {
  await mockWith(page, withBands(maintBand()));
  await openAt(page);
  await page.locator(BAND).getByRole("button", { name: "詳しく", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/notices/${N_MAINT}$`));
  const title = noticesWithUpdate().find((n) => n.id === N_MAINT)!.title;
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});

test("K957-UI-014 帯だけのお知らせ（一覧の答えに無い notice_id）：帯に題と 2 行目は出るが「詳しく」は出さない（押すと見つからないになる行き先を作らない）", async ({
  page,
}) => {
  // 帯だけのお知らせは一覧の答えに無いので、2 行目は帯の答えの note（K-955・D-156.45）から出る
  const band = {
    ...incidentBand({ notice_id: GONE, title: "帯だけの障害のお知らせ" }),
    note: "復旧の見込みを調べています",
  };
  await mockWith(page, withBands(band));
  await openAt(page);
  await expect(page.locator(BAND)).toContainText("帯だけの障害のお知らせ");
  await expect(page.locator(BAND)).toContainText("復旧の見込みを調べています");
  await expect(page.locator(BAND).getByRole("button", { name: "詳しく", exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- 画面いっぱい
test("K957-UI-008 メンテ中（maintenance_now）：外枠も本文も出さず「いまメンテナンス中です」・時間・お知らせを出した日（11/03）", async ({
  page,
}) => {
  await mockWith(page, {
    ...statusTaka(),
    maintenance_now: { from: "2025-11-09T17:00:00Z", to: "2025-11-09T18:00:00Z" },
  });
  await openAt(page);
  await expect(page.getByRole("heading", { name: "いまメンテナンス中です", level: 1, exact: true })).toBeVisible();
  await expect(
    page.getByText("11/10（月）2:00〜3:00 の予定です。終わると自動でこの画面が切り替わります", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("お知らせは 11/03 に出しました", { exact: true })).toBeVisible();
  await expect(page.locator("[data-ticket-shell]")).toHaveCount(0);
  await expect(page.locator("nav")).toHaveCount(0);
});

test("K957-UI-009 障害の画面（画面が down）：「Kaname の調子が悪くなっています」・「もう一度」で稼働状況を読み直し、直っていればふつうの画面に戻る", async ({
  page,
}) => {
  const mk = await mockHelp(page, {
    status: {
      components: [{ key: "web", label: "画面", state: "down" }],
      bands: [incidentBand()],
      maintenance_now: null,
    },
  });
  await openAt(page);
  await expect(
    page.getByRole("heading", { name: "Kaname の調子が悪くなっています", level: 1, exact: true }),
  ).toBeVisible();
  mk.status = statusTaka();
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(page.locator("[data-ticket-shell]")).toBeVisible();
  await expect.poll(() => mk.count("shellStatus")).toBe(2);
});

test("K957-UI-010 稼働状況が読めない（503・網の切れ）：帯も画面いっぱいも出さず、画面はふつうに使える（読めないのに止めない）", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  mk.script("status", err(503, "E-PAGE-003"));
  await openAt(page);
  await expect(page.locator("[data-ticket-shell]")).toBeVisible();
  await expect(page.locator(".k-uh-bands")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "いまメンテナンス中です", exact: true })).toHaveCount(0);
});

test("K957-UI-011 帯の題に HTML が入っても字のまま・スクリプトが動かない", async ({ page }) => {
  await mockWith(page, withBands(incidentBand({ title: '<img src=x onerror="window.__x=1">遅れ' })));
  await openAt(page);
  await expect(page.locator(BAND)).toContainText('<img src=x onerror="window.__x=1">遅れ');
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
});

test("K957-UI-012 共通の外枠：外枠を使う全部の画面（/tickets・/approvals・/settings/credentials・/notices・/inquiry）× 幅 320・375・768・1024・1440 で、帯が出ている間も横のはみ出しが 0", async ({
  page,
}) => {
  await mockWith(page, withBands(incidentBand({ more: 1 })));
  for (const path of SHELL_PAGES) {
    for (const w of [320, 375, 768, 1024, 1440]) {
      await openAt(page, path, w);
      await expect(page.locator(BAND)).toBeVisible();
      expect(await overflowX(page), `${path} 幅 ${w}`).toBeLessThanOrEqual(0);
    }
  }
});

test("K957-UI-013 帯が無い間の外枠：外枠を使う全部の画面で帯の場所が 0・本文の見出しの位置が帯を入れる前と同じ（上に余白を足さない）", async ({
  page,
}) => {
  await mockWith(page, statusTaka());
  for (const path of SHELL_PAGES) {
    await openAt(page, path);
    await expect(page.locator("[data-ticket-shell]")).toBeVisible();
    await expect(page.locator(".k-uh-bands")).toHaveCount(0);
    const first = await page.locator("[data-ticket-shell] > *").first().boundingBox();
    const shell = await page.locator("[data-ticket-shell]").boundingBox();
    expect(first!.y - shell!.y, path).toBeLessThanOrEqual(0);
  }
});
