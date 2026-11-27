// K-913「画面：ゲストの場所で見せてもらったチケットを口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f11/pt-work・pt-work-request・pt-work-hidden（本番と同じ部品 features/F11/portal/work.tsx）。
//   ログインは本物の人（person・loginAs）。画面のログインの解決（/api/auth-ext/me）だけゲスト（役割 requester）の答えにする（形は K-875 に合わせる）。
//   ゲストの場所の口は網の手前で差し替える。答えの形は 11_tickets/K-913.md の「読む答えの形」。チャットに書く口の住所は K-882 の仮の名前に合わせた。
//   本人の Bridge（127.0.0.1:38617）は 404。固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { loginAs } from "../_lib/api";
import { err, never, ok, pair, person, type Reply } from "./credentials-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const GROUP = "セイコー株式会社（ゲスト）";
const TID = "0193c5a0-0000-7000-8000-0000000d0001";
const PATH = `/portal/tickets/${TID}`;
interface Msg {
  id: string;
  side: "they" | "we";
  name: string;
  at: string;
  text: string;
  /** K-882 の確定：依頼から来た書き込みにだけ `from_request: true` の鍵が付く（false の行には鍵が無い） */
  from_request?: true;
}
const CHAT: Msg[] = [
  {
    id: "c1",
    side: "we",
    name: "高本さん（ENGINE BASE）",
    at: "10/30 17:50",
    text: "作業を始めました。できたらここでお知らせします。",
  },
  { id: "c2", side: "they", name: "山田 花子 様", at: "10/31 09:12", text: "はい、お願いします。" },
];
const FROM_REQ: Msg[] = [
  {
    id: "r1",
    side: "they",
    name: "鈴木 健太 様",
    at: "10/29 10:20",
    text: "12 月分の作業報告書もほしいです。",
    from_request: true,
  },
  {
    id: "r2",
    side: "we",
    name: "高本さん（ENGINE BASE）",
    at: "10/29 10:42",
    text: "12/26 までにお送りします。宛先は山田様でよろしいですか？",
    from_request: true,
  },
];
interface Call {
  method: string;
  path: string;
  body: string | null;
  /** 問い合わせ（?visit=elsewhere など・K913-UI-023） */
  search?: string;
}
interface World {
  stage: string;
  title: string;
  fromRequest: boolean;
  messages: Msg[];
  extra: Record<string, unknown>;
  detail: string | null;
  calls: Call[];
  once: { get?: Reply; post?: Reply };
  hold: boolean;
  gate?: Promise<void>;
}
const world = (o: Partial<World> = {}): World => ({
  stage: "確認中",
  title: "11月分の請求書を送る",
  fromRequest: false,
  messages: CHAT,
  extra: {},
  detail: null,
  calls: [],
  once: {},
  hold: false,
  ...o,
});
const posts = (w: World) => w.calls.filter((c) => c.method === "POST" && /messages$/.test(c.path));
const gets = (w: World) => w.calls.filter((c) => c.method === "GET" && c.path === `/api/v1/portal/tickets/${TID}`);
const send = (route: Route, r: Reply) =>
  route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });

async function mockWorld(page: Page, w: World) {
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route, req) => {
    const p = new URL(req.url()).pathname;
    const method = req.method();
    if (p === "/api/auth-ext/me")
      return send(
        route,
        ok({
          member_id: "11111111-0000-4000-8000-0000000000a1",
          tenant_id: "11111111-0000-4000-8000-0000000000a2",
          display_name: "山田 花子",
          role_id: null,
          role: "requester",
          scope_id: null,
        }),
      );
    if (!p.startsWith("/api/v1/portal")) return send(route, ok([]));
    w.calls.push({ method, path: p, body: req.postData(), search: new URL(req.url()).search });
    if (p === "/api/v1/portal")
      return send(
        route,
        ok({
          group_name: GROUP,
          tenant_name: "ENGINE BASE",
          me: { name: "山田 花子", initial: "山" },
          first_visit: false,
          requests: [],
          tickets: [],
        }),
      );
    if (p === "/api/v1/portal/notices") return send(route, ok([]));
    if (method === "GET" && p === `/api/v1/portal/tickets/${TID}`) {
      await w.gate;
      return send(
        route,
        w.once.get ??
          ok({
            ticket: {
              id: TID,
              title: w.title,
              stage: w.stage,
              body: "セイコー様に 11 月分の保守費を請求し、11/30 までに入金していただく。",
              detail: w.detail ?? "請求書は 11 月分の保守費と追加対応 2 回分。宛名は経理部 山田様。",
              from_request: w.fromRequest,
              ...w.extra,
            },
            messages: w.fromRequest ? [...FROM_REQ, ...w.messages] : w.messages,
          }),
      );
    }
    if (method === "POST" && p === `/api/v1/portal/tickets/${TID}/messages`) {
      if (w.hold) return never();
      const r = w.once.post ?? ok({ id: "c9" }, 201);
      if (r.status === 201)
        w.messages = [
          ...w.messages,
          { id: "c9", side: "they", name: "山田 花子 様", at: "今", text: JSON.parse(req.postData() ?? "{}").body },
        ];
      return send(route, r);
    }
    return send(route, err(404, "NOT_FOUND"));
  });
}
async function open(page: Page, w: World, width = 1440, path = PATH) {
  const u = await person();
  await loginAs(page, u.token);
  await mockWorld(page, w);
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto(path))?.status()).toBe(200);
}
const title = (page: Page, t = "11月分の請求書を送る") => page.getByRole("heading", { name: t, level: 1, exact: true });
const sec = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const reply = (page: Page) => page.getByRole("textbox", { name: "やり取りに書く", exact: true });
const sendBtn = (page: Page) => page.getByRole("button", { name: "送る", exact: true });
const stages = (page: Page) => page.getByRole("group", { name: "いまの段", exact: true }).locator(".k-badge");
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [mock, o] of [
  ["pt-work", {}],
  ["pt-work-request", { fromRequest: true, title: "12 月分の作業報告書を作って送る" }],
  ["pt-work-hidden", { once: { get: err(404, "NOT_FOUND") } }],
] as const) {
  for (const width of MATCH_WIDTHS) {
    test(`K913-UI-001 ${mock} 幅 ${width}：本物の画面が下絵と一致する`, async ({ browser }) => {
      const u = await person();
      const { rows, bad } = await matchMock(
        browser,
        mock,
        width,
        async (page) => {
          await loginAs(page, u.token);
          await mockWorld(page, world(o as Partial<World>));
          await page.goto(PATH);
          await expect(
            page.locator("[data-portal-frame] main h1, [data-portal-frame] main [role='heading']").first(),
          ).toBeVisible();
        },
        {
          base: "/dev/mock/f11",
          pairs: [pair("h1", "h1", ["x", "y", "font-size", "texts"]), pair("cards", ".k-f11p-card", ["x", "width"])],
        },
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K913-UI-002 開く：口 1 回・題・説明・4 つの区画", async ({ page }) => {
  const w = world();
  await open(page, w);
  await expect(title(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "← 戻る", exact: true })).toBeVisible();
  await expect(
    page.getByText("ここに出るのは、このチケットの題・本文・詳細・やり取りと、段の札だけです", { exact: true }),
  ).toBeVisible();
  await expect(sec(page, "本文")).toContainText("11 月分の保守費を請求し");
  await expect(sec(page, "詳細")).toContainText("追加対応 2 回分");
  await expect(sec(page, "このチケットのやり取り")).toContainText("作業を始めました");
  await expect(reply(page)).toBeVisible();
  expect(gets(w)).toHaveLength(1);
});

test("K913-UI-003 段の札：3 つの順・いまの段だけ目立つ・3 つ以外は「作っている」", async ({ page }) => {
  const w = world();
  await open(page, w);
  await expect(stages(page)).toHaveText(["作っている", "確認中", "完了"]);
  await expect(stages(page).nth(1)).toHaveAttribute("data-tone", "progress");
  await expect(page.locator(".k-f11p-stages .k-badge[data-tone='progress']")).toHaveCount(1);
  for (const [stage, idx] of [
    ["完了", 2],
    ["承認待ち", 0],
  ] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockWorld(page, world({ stage }));
    await page.goto(PATH);
    await expect(stages(page).nth(idx)).toHaveAttribute("data-tone", "progress");
    await expect(page.locator(".k-f11p-stages .k-badge[data-tone='progress']")).toHaveCount(1);
  }
});

test("K913-UI-004 社内の欄を出さない：口が返しても担当・期限・確認項目・決定ログ・成果物・分身は出ない", async ({
  page,
}) => {
  const extra = {
    assignee: "高本 聖斗",
    due_on: "2026-12-26",
    checks: [{ text: "宛名が正しい" }],
    decisions: [{ text: "経理部宛でよい" }],
    artifacts: [{ name: "請求書.pdf" }],
    agent_log: "分身の記録 X-1",
  };
  await open(page, world({ extra }));
  await expect(title(page)).toBeVisible();
  const text = await page.locator("main").innerText();
  for (const s of [
    "高本 聖斗",
    "12/26",
    "2026-12-26",
    "宛名が正しい",
    "経理部宛でよい",
    "請求書.pdf",
    "分身の記録",
    "確認項目",
    "決定ログ",
    "担当",
    "期限",
  ]) {
    expect(text, `${s} が画面に出ている`).not.toContain(s);
  }
});

test("K913-UI-005 詳細が空のとき：口が空の字を返す（詳細の区画が無い）と、詳細の区画は出て「詳細はまだありません」と書く（下絵に無い字・区画を隠さない）", async ({
  page,
}) => {
  await open(page, world({ detail: "" }));
  await expect(title(page)).toBeVisible();
  await expect(sec(page, "詳細")).toContainText("詳細はまだありません");
  await expect(sec(page, "本文")).toContainText("11 月分の保守費を請求し");
});

test("K913-UI-006 依頼から作ったチケット：やり取りの頭に依頼のやり取り・普通のチケットには無い", async ({ page }) => {
  await open(page, world({ fromRequest: true, title: "12 月分の作業報告書を作って送る" }));
  const chat = sec(page, "このチケットのやり取り");
  await expect(chat.getByText("依頼のやり取り", { exact: true })).toBeVisible();
  await expect(chat.getByText("12 月分の作業報告書もほしいです。", { exact: true })).toBeVisible();
  await expect(chat.getByText("ここからチケットのやり取り", { exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockWorld(page, world());
  await page.goto(PATH);
  await expect(title(page)).toBeVisible();
  await expect(page.getByText("依頼のやり取り", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ここからチケットのやり取り", { exact: true })).toHaveCount(0);
});

test("K913-UI-007 やり取りに書く：POST 1 回・欄が空・最後に足される", async ({ page }) => {
  const w = world();
  await open(page, w);
  await reply(page).fill("宛先は山田でお願いします。");
  await sendBtn(page).click();
  await expect.poll(() => posts(w).length).toBe(1);
  expect(JSON.parse(posts(w)[0]!.body ?? "{}")).toEqual({ body: "宛先は山田でお願いします。" });
  await expect(reply(page)).toHaveValue("");
  await expect(
    sec(page, "このチケットのやり取り").getByText("宛先は山田でお願いします。", { exact: true }),
  ).toBeVisible();
});

test("K913-UI-008 空は送れず・二度押しは 1 回", async ({ page }) => {
  const w = world({ hold: true });
  await open(page, w);
  await sendBtn(page).click();
  expect(posts(w)).toHaveLength(0);
  await reply(page).fill("よろしくお願いします。");
  await sendBtn(page).click();
  await sendBtn(page).click({ force: true });
  await expect.poll(() => posts(w).length).toBe(1);
  await expect(sendBtn(page)).toBeDisabled();
  expect(posts(w)).toHaveLength(1);
});

test("K913-UI-009 送れなかった（503）：文が出て書いた内容が残り、押し直せば送れる", async ({ page }) => {
  const w = world({ once: { post: err(503, "SERVICE_UNAVAILABLE") } });
  await open(page, w);
  await reply(page).fill("よろしくお願いします。");
  await sendBtn(page).click();
  await expect(page.getByText("送れませんでした", { exact: true })).toBeVisible();
  await expect(reply(page)).toHaveValue("よろしくお願いします。");
  await sendBtn(page).click();
  await expect(reply(page)).toHaveValue("");
  expect(posts(w)).toHaveLength(2);
});

test("K913-UI-010 見せていないチケットを直に開く（404）：見られない形で題や本文は出ない", async ({ page }) => {
  await open(page, world({ once: { get: err(404, "NOT_FOUND") } }));
  await expect(page.getByText("この仕事は見られません", { exact: true })).toBeVisible();
  const text = await page.locator("main").innerText();
  for (const s of ["11月分の請求書", "保守費", "作業を始めました"]) expect(text).not.toContain(s);
  await page.getByRole("button", { name: "やり取りに戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
});

test("K913-UI-011 開いている間に見せるのをやめられた（書く口が 404・E-GST-060）：書こうとすると下絵の「この仕事は見られません」の形に切り替わる（口の文 E-GST-060 も同じ字）", async ({
  page,
}) => {
  const w = world({ once: { post: err(404, "E-GST-060") } });
  await open(page, w);
  await reply(page).fill("もう一件お願いします。");
  await sendBtn(page).click();
  await expect(page.getByText("この仕事は見られません", { exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("作業を始めました");
  await expect(reply(page)).toHaveCount(0);
});

test("K913-UI-012 セッション切れ（401）はログインへ・403 は見られない形", async ({ page }) => {
  await open(page, world({ once: { get: err(403, "FORBIDDEN") } }));
  await expect(page.getByText("この仕事は見られません", { exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockWorld(page, world({ once: { get: err(401, "UNAUTHORIZED") } }));
  await page.goto(PATH);
  await expect(page.getByText("ログインが切れました。", { exact: true })).toBeVisible();
  await expect(page.locator("section.k-f11p-card")).toHaveCount(0);
  await page.getByRole("button", { name: "入り直す", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("K913-UI-013 読み込み中は文だけ・読めない（503）はもう一度で出る", async ({ page }) => {
  let release!: () => void;
  const w = world({ gate: new Promise<void>((r) => (release = r)) });
  await open(page, w);
  await expect(page.locator("section.k-f11p-card")).toHaveCount(0);
  release();
  await expect(title(page)).toBeVisible();
  const w2 = world({ once: { get: err(503, "SERVICE_UNAVAILABLE") } });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockWorld(page, w2);
  await page.goto(PATH);
  const retry = page.getByRole("button", { name: /もう一度/ });
  await expect(retry.first()).toBeVisible();
  await retry.first().click();
  await expect(title(page)).toBeVisible();
  expect(gets(w2)).toHaveLength(2);
});

test("K913-UI-014 「← 戻る」で /portal へ移る", async ({ page }) => {
  await open(page, world());
  await page.getByRole("button", { name: "← 戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
});

test("K913-UI-023 チケットの画面の外枠はホームの読みを visit=elsewhere で 1 回だけ呼ぶ（初めての印を付けない）。「← 戻る」でホームへ移ると visit なしで読む（ホームを開いたときだけ印が付く・answer=b187f0c59dec）", async ({
  page,
}) => {
  const w = world();
  await open(page, w);
  const homes = () => w.calls.filter((c) => c.method === "GET" && c.path === "/api/v1/portal");
  await expect.poll(() => homes().length).toBe(1);
  expect(homes().map((c) => c.search)).toEqual(["?visit=elsewhere"]);
  await page.getByRole("button", { name: "← 戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect.poll(() => homes().length).toBe(2);
  expect(homes()[1]!.search).toBe("");
});

test("K913-UI-015 同じグループの別の人の書き込みも並ぶ", async ({ page }) => {
  const other: Msg = {
    id: "o1",
    side: "they",
    name: "鈴木 健太 様",
    at: "11/01 10:00",
    text: "こちらでも確認しました。",
  };
  await open(page, world({ messages: [...CHAT, other] }));
  const chat = sec(page, "このチケットのやり取り");
  await expect(chat.getByText("鈴木 健太 様 ・ 11/01 10:00", { exact: true })).toBeVisible();
  await expect(chat.getByText("こちらでも確認しました。", { exact: true })).toBeVisible();
  await expect(reply(page)).toBeEnabled();
});

test("K913-UI-016 外枠：社内の Shell は無く、帯と下の一文がある", async ({ page }) => {
  await open(page, world());
  await expect(page.locator(".k-shell")).toHaveCount(0);
  await expect(page.locator(".k-f11p-head")).toContainText(GROUP);
  await expect(page.locator(".k-f11p-head")).toContainText("山田 花子 様");
  await expect(
    page.getByText("この場所で見えるのは、ENGINE BASE が見せると決めたものだけです", { exact: true }),
  ).toBeVisible();
});

test("K913-UI-017 作らない物・設計者の言葉の字が無い", async ({ page }) => {
  await open(page, world({ fromRequest: true }));
  await expect(sec(page, "本文")).toBeVisible();
  const text = await page.locator("body").innerText();
  for (const s of ["検収", "確認してほしいもの", "直してほしい", "取引先", "client", "acceptance"])
    expect(text).not.toContain(s);
  expect(text).not.toMatch(/(^|\s)OK(\s|$)/);
});

for (const width of [375, 768, 1440]) {
  test(`K913-UI-018 幅 ${width}：チケット・依頼から作ったチケット・見られないで横のはみ出し 0`, async ({ page }) => {
    await open(page, world(), width);
    await expect(title(page)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    for (const o of [{ fromRequest: true }, { once: { get: err(404, "NOT_FOUND") } }]) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await mockWorld(page, world(o as Partial<World>));
      await page.goto(PATH);
      await expect(page.locator("[data-portal-frame] main")).toBeVisible();
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
    }
  });
}

test("K913-UI-019 書き込みの HTML は文字として出る（スクリプトは動かない）", async ({ page }) => {
  const evil: Msg = {
    id: "e1",
    side: "we",
    name: "高本さん（ENGINE BASE）",
    at: "今",
    text: `<img src=x onerror="window.__zt8=1">確認しました`,
  };
  await open(page, world({ messages: [evil] }));
  await expect(page.getByText(evil.text, { exact: true })).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __zt8?: number }).__zt8)).toBeUndefined();
});

test("K913-UI-020 長い題と長い書き込み（幅 375）：横にはみ出さず題は折り返す", async ({ page }) => {
  const longTitle = "とても長い題".repeat(34);
  const longMsg: Msg = { id: "l1", side: "we", name: "高本さん（ENGINE BASE）", at: "今", text: "あ".repeat(2000) };
  await open(page, world({ title: longTitle, messages: [longMsg] }), 375);
  await expect(title(page, longTitle)).toBeVisible();
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
  const h = (await title(page, longTitle).boundingBox())!;
  expect(h.height).toBeGreaterThan(40);
});

test("K913-UI-021 幅 375：「← 戻る」と「送る」は 24px 以上", async ({ page }) => {
  await open(page, world(), 375);
  for (const loc of [page.getByRole("button", { name: "← 戻る", exact: true }), sendBtn(page)]) {
    const b = (await loc.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(24);
    expect(b.height).toBeGreaterThanOrEqual(24);
  }
});
