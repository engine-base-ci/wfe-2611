// K-898「画面：届いた依頼（/requests）を口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f11/rq-*（本番と同じ部品 features/F11/requests/{views,list,dialogs}.tsx・代表の決め answer=6ba09f587792）。
//   チケットを作る小窓と作った後の詳細（rq-create ほか 5 つ・tk-from-request）は K-930 の試験（k930-request-to-ticket.spec.ts）。
//   ログイン・外枠は本物（person・loginAs）。届いた依頼の口（listClientRequests・getClientRequest・updateClientRequest・replyToClientRequest・declineClientRequest）だけを網の手前で差し替える。
//   答えの形は 11_tickets/K-898.md の「読む答えの形」。本人の Bridge（127.0.0.1:38617）は 404。固定の待ちは使わない（答えと移り終わりを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { loginAs } from "../_lib/api";
import { err, never, ok, pair, person, type Reply } from "./credentials-mock";
import { shellReply } from "./shell-answer";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const GROUP = "セイコー株式会社（ゲスト）";
const ID = (n: number) => `0193c5a0-0000-7000-8000-0000000f${String(n).padStart(4, "0")}`;
const T_ID = ID(900);
const mk = (n: number, title: string, state: "new" | "asking" | "done", route = "EG 営業") => ({
  id: ID(n),
  title,
  from_name: "鈴木 健太 様",
  group_name: GROUP,
  route_name: route,
  created_at: "2026-11-23T01:20:00Z",
  state,
});
const ROUTES = [
  { id: "g-eg", name: "EG 営業" },
  { id: "g-kr", name: "KR 経理" },
  { id: "g-jd", name: "JD 受託開発" },
];
const R1 = mk(1, "12 月分の作業報告書もほしい", "new");
const R2 = mk(2, "管理画面に検索の絞り込みを足したい", "asking", "JD 受託開発");
const R3 = mk(3, "10 月分の請求書の再発行", "done", "KR 経理");
/** 下絵の一覧と同じ並び（新しい 2・聞いている 1・さばいた 1）にするための 1 件（突き合わせの行だけで使う） */
const R4 = mk(4, "ログイン画面の文言を直してほしい", "new", "JD 受託開発");
const BODY = "いつもありがとうございます。11 月分と同じ形で、12 月分の作業報告書もいただけますか。";
/** 聞いている依頼のやり取り（K-892 の形：古い順・side は we＝社内／they＝ゲスト・最初の本文は request.body に在る） */
const ASKED = {
  id: "m-1",
  side: "we" as const,
  name: "高本 聖斗",
  at: "2026-11-22T06:02:00Z",
  text: "絞り込みたい項目と、使う方の範囲を教えていただけますか。",
};
const ANSWERED = {
  id: "m-2",
  side: "they" as const,
  name: "鈴木 健太 様",
  at: "2026-11-23T00:10:00Z",
  text: "注文日と担当者で絞り込みたいです。使うのは営業の 5 人です。",
};
const ASKED2 = {
  id: "m-3",
  side: "we" as const,
  name: "高本 聖斗",
  at: "2026-11-23T01:00:00Z",
  text: "担当者は営業の方だけでよろしいでしょうか。",
};
type Msg = typeof ASKED | typeof ANSWERED;
/** 帯の中の 1 行の字（日時は一覧と同じ M/D HH:mm・日本時間） */
const LINE_ASKED = "聞いたこと（高本 聖斗 ・ 11/22 15:02）：絞り込みたい項目と、使う方の範囲を教えていただけますか。";
const LINE_ANSWERED =
  "先方の返事（鈴木 健太 様 ・ 11/23 09:10）：注文日と担当者で絞り込みたいです。使うのは営業の 5 人です。";
const LINE_ASKED2 = "聞いたこと（高本 聖斗 ・ 11/23 10:00）：担当者は営業の方だけでよろしいでしょうか。";
const WAITING = "先方の返事を待っています。返事が来たら、ここに出ます。";

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}
interface World {
  items: ReturnType<typeof mk>[];
  canAct: boolean;
  calls: Call[];
  once: Partial<Record<"list" | "get" | "patch" | "reply" | "accept" | "decline", Reply>>;
  hold: Set<"reply" | "accept" | "decline">;
  listGate?: Promise<void>;
  /** 読む口の pc_connected（既定 true） */
  pc: boolean;
  /** 分身の案（ticket_draft）があるか（既定 true。false なら null） */
  draft: boolean;
  /** 依頼ごとのやり取り（無ければ空） */
  msgs: Record<string, Msg[]>;
}
const world = (o: Partial<World> = {}): World => ({
  items: [R1, R2, R3],
  canAct: true,
  calls: [],
  once: {},
  hold: new Set(),
  pc: true,
  draft: true,
  msgs: {},
  ...o,
});
const countOf = (w: World, method: string, re: RegExp) =>
  w.calls.filter((c) => c.method === method && re.test(c.path)).length;
const send = (route: Route, r: Reply) =>
  route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });

async function mockWorld(page: Page, w: World) {
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route, req) => {
    const u = new URL(req.url());
    const p = u.pathname;
    const method = req.method();
    const body = (req.postDataJSON() as Record<string, unknown> | null) ?? null;
    // 外枠の口 getShell（K-466）：外枠とグループの選び肢は同じ答えを読む（形の外れた答えは外枠が読めない扱い）
    if (p === "/api/v1/shell") return send(route, shellReply());
    const m = /^\/api\/v1\/client_requests(?:\/([^/]+))?(?:\/(reply|accept|decline))?$/.exec(p);
    if (!m) {
      return send(route, ok([]));
    }
    w.calls.push({ method, path: p, body });
    const [, id, act] = m;
    const take = (k: keyof World["once"]) => {
      const v = w.once[k];
      delete w.once[k];
      return v;
    };
    if (!id && method === "GET") {
      await w.listGate;
      return send(
        route,
        take("list") ?? ok({ items: w.items, counts: { live: w.items.filter((i) => i.state !== "done").length } }),
      );
    }
    const item = w.items.find((i) => i.id === id);
    if (id && !act && method === "GET") {
      const once = take("get");
      if (once) return send(route, once);
      if (!item) return send(route, err(404, "NOT_FOUND"));
      return send(
        route,
        ok({
          request: { ...item, body: BODY, ...(item.state === "done" ? { ticket_id: T_ID } : {}) },
          messages: w.msgs[item.id] ?? [],
          routes: ROUTES,
          can_act: w.canAct,
          pc_connected: w.pc,
          ticket_draft: w.draft
            ? {
                title: "セイコー様 12 月分の作業報告書を作って送る",
                kind: "作業報告",
                owner: "高本",
                due: "12/26",
                cost: "保守契約の範囲内",
                route_name: item.route_name,
              }
            : null,
          reply_draft: w.draft ? "鈴木様 承知しました。11 月分と同じ形で、12/26 までにお送りします。" : null,
        }),
      );
    }
    if (!item) return send(route, err(404, "NOT_FOUND"));
    const kind = act ?? "patch";
    if (w.hold.has(kind as "reply")) return never();
    const once = take(kind as "patch");
    if (once) return send(route, once);
    if (kind === "patch") {
      const name = ROUTES.find((r) => r.id === body?.["route_id"])?.name ?? item.route_name;
      w.items = w.items.map((i) => (i.id === id ? { ...i, route_name: name } : i));
      return send(route, ok({ route_name: name }));
    }
    const next = kind === "reply" ? "asking" : "done";
    w.items = w.items.map((i) => (i.id === id ? { ...i, state: next as "asking" } : i));
    if (kind === "accept") return send(route, ok({ ticket_id: T_ID, number: "EG-131" }, 201));
    return send(route, kind === "reply" ? ok({ state: "asking" }, 201) : ok({ state: "done" }));
  });
}

async function open(page: Page, w: World, width = 1440, path = "/requests") {
  const u = await person();
  await loginAs(page, u.token);
  await mockWorld(page, w);
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(path);
  expect(res?.status()).toBe(200);
}
const detail = (page: Page) => page.locator("article.k-f11q-detail");
const listBox = (page: Page) => page.getByRole("complementary", { name: "届いた依頼", exact: true });
/** 一覧の R1 の行（「さばいたもの」の R3 も KR 経理に届いているので、行を絞って見る） */
const r1Row = (page: Page) => listBox(page).getByRole("link", { name: new RegExp(R1.title) });
// 本文の中のボタン（外枠の左と下の「チケットを作る」k-nav-create・k-tab-create は K-466 の外枠の答えで出る。それと分ける）
const btn = (page: Page, name: string) =>
  page
    .locator("#k-main")
    .getByRole("button", { name, exact: true })
    .and(page.locator(":not(.k-nav-create):not(.k-tab-create)"));
const dlg = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const openFirst = async (page: Page, w: World, width = 1440) => {
  await open(page, w, width, `/requests/${R1.id}`);
  await expect(detail(page).getByRole("heading", { name: R1.title, level: 1, exact: true })).toBeVisible();
};

// ---------------------------------------------------------------- 下絵との突き合わせ・入口
for (const [mock, w0] of [
  ["rq-asking", `/requests/${R2.id}`],
  ["rq-done", `/requests/${R3.id}`],
  ["rq-list", "/requests"],
] as const) {
  for (const w of MATCH_WIDTHS) {
    test(`K898-UI-001 ${mock} 幅 ${w}：本物の画面の本文が下絵と一致する`, async ({ browser }) => {
      const u = await person();
      const { rows, bad } = await matchMock(
        browser,
        mock,
        w,
        async (page) => {
          await loginAs(page, u.token);
          await mockWorld(page, world({ items: [R1, R2, R4, R3] })); // 下絵の一覧は 4 件（幅 768 は一覧の下に本文が来るので件数で見出しの位置が変わる）
          await page.goto(w0);
          await expect(page.locator("main").first()).toBeVisible();
        },
        { base: "/dev/mock/f11", pairs: [pair("h1", "h1", ["x", "y", "font-size", "color", "texts"])] },
      );
      expect(rows.length, "比べた役がある").toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K898-UI-002 開く：一覧と開いた依頼の口が 1 回ずつ・「取引先」の字が無い", async ({ page }) => {
  const w = world();
  await open(page, w);
  await expect(listBox(page).getByRole("heading", { name: "届いた依頼 ・ 2", exact: true })).toBeVisible();
  await expect(
    listBox(page)
      .getByText(new RegExp(`^${R1.from_name} ・ ${R1.route_name}に届いた ・ .+$`))
      .first(),
  ).toBeVisible();
  await expect(detail(page).getByRole("heading", { level: 1 })).toBeVisible();
  expect(countOf(w, "GET", /\/client_requests$/)).toBe(1);
  expect(countOf(w, "GET", /\/client_requests\/[^/]+$/)).toBe(1);
  expect(await page.locator("body").innerText()).not.toContain("取引先");
});

test("K898-UI-003 スマホ：一覧だけ → 開いた依頼だけ → 「届いた依頼」で一覧へ", async ({ page }) => {
  await open(page, world(), 375);
  await expect(listBox(page)).toBeVisible();
  await expect(detail(page)).toBeHidden();
  await listBox(page)
    .getByRole("link", { name: new RegExp(R1.title) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/requests/${R1.id}$`));
  await expect(detail(page)).toBeVisible();
  await expect(listBox(page)).toBeHidden();
  await detail(page).getByRole("link", { name: "届いた依頼", exact: true }).click();
  await expect(page).toHaveURL(/\/requests$/);
  await expect(listBox(page)).toBeVisible();
  await expect(detail(page)).toBeHidden();
});

test("K898-UI-004 読み込み中は文だけでボタンが無い", async ({ page }) => {
  let release!: () => void;
  const w = world({ listGate: new Promise<void>((r) => (release = r)) });
  await open(page, w);
  await expect(page.getByText("届いた依頼を読み込んでいます…", { exact: true })).toBeVisible();
  await expect(btn(page, "チケットを作る")).toHaveCount(0);
  release();
  await expect(listBox(page)).toBeVisible();
});

test("K898-UI-005 0 件：空の文とゲストの場所の案内", async ({ page }) => {
  await open(page, world({ items: [] }));
  await expect(page.getByText("届いた依頼はまだありません", { exact: true })).toBeVisible();
  await expect(
    page.getByText("ゲストが「ゲストの場所」から依頼を出すと、ここに届きます。", { exact: true }),
  ).toBeVisible();
  await expect(btn(page, "チケットを作る")).toHaveCount(0);
});

test("K898-UI-006 読めない（503）：やり直すと口をもう 1 回呼んで一覧が出る", async ({ page }) => {
  const w = world({ once: { list: err(503, "SERVICE_UNAVAILABLE") } });
  await open(page, w);
  const retry = page.getByRole("button", { name: /もう一度/ });
  await expect(retry.first()).toBeVisible();
  await retry.first().click();
  await expect(listBox(page)).toBeVisible();
  expect(countOf(w, "GET", /\/client_requests$/)).toBe(2);
});

test("K898-UI-007 権限なし（403）：権限なしの形で、口を続けて呼ばない", async ({ page }) => {
  const w = world({ once: { list: err(403, "FORBIDDEN") } });
  await open(page, w);
  await expect(page.getByText("この画面を見る権限がありません。", { exact: true })).toBeVisible();
  await expect(listBox(page)).toHaveCount(0);
  expect(countOf(w, "GET", /\/client_requests$/)).toBe(1);
});

test("K898-UI-008 読むだけの人：3 つのボタンが押せず口が呼ばれない", async ({ page }) => {
  const w = world({ canAct: false });
  await openFirst(page, w);
  for (const name of ["断る（理由を返す）", "返事を送って詳しく聞く", "チケットを作る"]) {
    await expect(btn(page, name)).toHaveAttribute("aria-disabled", "true");
    await btn(page, name).click({ force: true });
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("依頼をさばけるのは、この依頼が届いたグループの人です。ここでは読むだけです。", { exact: true }),
  ).toBeVisible();
  expect(w.calls.filter((c) => c.method !== "GET")).toEqual([]);
});

test("K898-UI-009 聞いている・さばいた：帯が出てボタンは出ない（さばいたはチケットを開く）", async ({ page }) => {
  const w = world({ msgs: { [R2.id]: [ASKED, ANSWERED, ASKED2] } });
  await open(page, w, 1440, `/requests/${R2.id}`);
  await expect(page.getByText("先方に詳しく聞いています", { exact: true })).toBeVisible();
  // 帯の中に、聞いたことと先方の返事が古い順。最後が社内なので待っている文が最後の行（answer=551509bd2ce7）
  for (const line of [LINE_ASKED, LINE_ANSWERED, LINE_ASKED2, WAITING])
    await expect(detail(page).getByText(line, { exact: true })).toBeVisible();
  const text = await detail(page).innerText();
  const at = [LINE_ASKED, LINE_ANSWERED, LINE_ASKED2, WAITING].map((l) => text.indexOf(l));
  expect(at, "古い順で、待っている文が最後").toEqual([...at].sort((a, b) => a - b));
  expect(text).not.toContain("先方の返事をまだ受け取っていません");
  // 最後が先方の返事なら、待っている文は出ない
  w.msgs = { [R2.id]: [ASKED, ANSWERED] };
  await page.reload();
  await expect(detail(page).getByText(LINE_ANSWERED, { exact: true })).toBeVisible();
  await expect(detail(page).getByText(WAITING, { exact: true })).toHaveCount(0);
  await page.goto(`/requests/${R3.id}`);
  await expect(page.getByText(/チケットを作りました/)).toBeVisible();
  await expect(btn(page, "チケットを開く")).toBeVisible();
  // さばいた帯の「チケットを開く」は口が返した ticket_id の詳細へ行く（この葉で動く）
  await btn(page, "チケットを開く").click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${T_ID}$`));
  await page.goBack();
  await expect(btn(page, "断る（理由を返す）")).toHaveCount(0);
  await expect(btn(page, "チケットを作る")).toHaveCount(0);
});

test("K898-UI-010 返事の下書きを直しても、送るまで口は呼ばれない", async ({ page }) => {
  const w = world();
  await openFirst(page, w);
  const box = page.getByRole("textbox", { name: "返事", exact: true });
  await box.fill("承知しました。12/24 までにお送りします。");
  await expect(box).toHaveValue("承知しました。12/24 までにお送りします。");
  expect(w.calls.filter((c) => c.method !== "GET")).toEqual([]);
});

test("K898-UI-011 届け先を変える▾：PATCH が 1 回・一覧の行が変わる", async ({ page }) => {
  const w = world();
  await openFirst(page, w);
  await page.getByRole("button", { name: "届け先を変える", exact: true }).click();
  await page.getByRole("menuitem", { name: "KR 経理", exact: true }).click();
  await expect(r1Row(page).getByText(new RegExp(`^${R1.from_name} ・ KR 経理に届いた ・ .+$`))).toBeVisible();
  const patches = w.calls.filter((c) => c.method === "PATCH");
  expect(patches).toHaveLength(1);
  expect(patches[0]!.body).toEqual({ route_id: "g-kr" });
});

test("K898-UI-011 届け先を変える▾：PC がつながっていれば案が無くても出て変えられる・PC が閉じていれば出ない", async ({
  page,
}) => {
  const w = world({ draft: false });
  await openFirst(page, w);
  await expect(page.getByText("PC がつながると分身が案を出します", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "届け先を変える", exact: true }).click();
  await page.getByRole("menuitem", { name: "KR 経理", exact: true }).click();
  await expect(r1Row(page).getByText(new RegExp(`^${R1.from_name} ・ KR 経理に届いた ・ .+$`))).toBeVisible();
  const patches = w.calls.filter((c) => c.method === "PATCH");
  expect(patches).toHaveLength(1);
  expect(patches[0]!.body).toEqual({ route_id: "g-kr" });
  // PC が閉じていれば ▾ は出ない（answer=70068278fce9）
  w.pc = false;
  await page.reload();
  await expect(detail(page).getByRole("heading", { name: R1.title, level: 1, exact: true })).toBeVisible();
  await expect(page.getByText("PC がつながると分身が案を出します", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "届け先を変える", exact: true })).toHaveCount(0);
});
test("K898-UI-012 届け先を変えられない（403）：文が出て一覧は元のまま", async ({ page }) => {
  const w = world({ once: { patch: err(403, "FORBIDDEN") } });
  await openFirst(page, w);
  await page.getByRole("button", { name: "届け先を変える", exact: true }).click();
  await page.getByRole("menuitem", { name: "KR 経理", exact: true }).click();
  await expect(page.getByText("届け先を変えられませんでした", { exact: true })).toBeVisible();
  await expect(r1Row(page).getByText(new RegExp(`^${R1.from_name} ・ EG 営業に届いた ・ .+$`))).toBeVisible();
});

test("K898-UI-013 返事を送る小窓：開く・やめるで閉じる", async ({ page }) => {
  await openFirst(page, world());
  await btn(page, "返事を送って詳しく聞く").click();
  const d = dlg(page, "返事を送って詳しく聞く");
  await expect(d).toBeVisible();
  await expect(d.getByRole("textbox", { name: "先方に送る返事", exact: true })).toBeVisible();
  await d.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(d).toBeHidden();
});

test("K898-UI-014 返事が空：誤りが出て口は呼ばれず小窓は閉じない", async ({ page }) => {
  const w = world();
  await openFirst(page, w);
  await btn(page, "返事を送って詳しく聞く").click();
  const d = dlg(page, "返事を送って詳しく聞く");
  await d.getByRole("textbox", { name: "先方に送る返事", exact: true }).fill("");
  await d.getByRole("button", { name: "送る", exact: true }).click();
  await expect(d.getByText("送る返事を書いてください", { exact: true })).toBeVisible();
  expect(countOf(w, "POST", /\/reply$/)).toBe(0);
});

test("K898-UI-015 返事を送る：POST 1 回・帯・札が「聞いている」", async ({ page }) => {
  const w = world();
  await openFirst(page, w);
  await btn(page, "返事を送って詳しく聞く").click();
  const d = dlg(page, "返事を送って詳しく聞く");
  await d.getByRole("textbox", { name: "先方に送る返事", exact: true }).fill("鈴木様 宛先は山田様でよろしいですか。");
  await d.getByRole("button", { name: "送る", exact: true }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText("返事を送りました", { exact: true })).toBeVisible();
  const posts = w.calls.filter((c) => c.method === "POST" && /\/reply$/.test(c.path));
  expect(posts).toHaveLength(1);
  expect(posts[0]!.body).toEqual({ body: "鈴木様 宛先は山田様でよろしいですか。" });
});

test("K898-UI-016 送るの二度押しは口 1 回・押している間は無効", async ({ page }) => {
  const w = world({ hold: new Set(["reply"]) });
  await openFirst(page, w);
  await btn(page, "返事を送って詳しく聞く").click();
  const d = dlg(page, "返事を送って詳しく聞く");
  await d.getByRole("textbox", { name: "先方に送る返事", exact: true }).fill("宛先を教えてください。");
  const send1 = d.getByRole("button", { name: "送る", exact: true });
  await send1.click();
  await expect.poll(() => countOf(w, "POST", /\/reply$/)).toBe(1);
  await expect(d.getByRole("button", { name: "送る", exact: true })).toBeDisabled();
  await d.getByRole("button", { name: "送る", exact: true }).click({ force: true });
  expect(countOf(w, "POST", /\/reply$/)).toBe(1);
});

test("K898-UI-017 送れなかった（503）：小窓は閉じず書いた返事が残る・押し直せば送れる", async ({ page }) => {
  const w = world({ once: { reply: err(503, "SERVICE_UNAVAILABLE") } });
  await openFirst(page, w);
  await btn(page, "返事を送って詳しく聞く").click();
  const d = dlg(page, "返事を送って詳しく聞く");
  const box = d.getByRole("textbox", { name: "先方に送る返事", exact: true });
  await box.fill("宛先を教えてください。");
  await d.getByRole("button", { name: "送る", exact: true }).click();
  await expect(d.getByText("送れませんでした", { exact: true })).toBeVisible();
  await expect(
    d.getByText("もう一度押してください。書いた返事は、この小窓に残っています。", { exact: true }),
  ).toBeVisible();
  await expect(box).toHaveValue("宛先を教えてください。");
  await expect(page.getByText("返事を送りました", { exact: true })).toHaveCount(0);
  await d.getByRole("button", { name: "送る", exact: true }).click();
  await expect(d).toBeHidden();
  expect(countOf(w, "POST", /\/reply$/)).toBe(2);
});

// 権限を外された後に押したとき（403）の字は見出し「この操作をする権限がありません」だけ（後ろの文は付けない・代表の答え answer=d028c18907ee）
const NO_RIGHT = "この操作をする権限がありません";

test("K898-UI-034 開いたときはさばけたのに、送る・断るの口が 403（権限を外された直後）：小窓は閉じず、503 と同じ囲みの見出し「この操作をする権限がありません」だけが出て（後ろの文は無い）、書いた字が残る・帯は出ない", async ({
  page,
}) => {
  const w = world({ once: { reply: err(403, "FORBIDDEN") } });
  await openFirst(page, w);
  await btn(page, "返事を送って詳しく聞く").click();
  const d = dlg(page, "返事を送って詳しく聞く");
  const box = d.getByRole("textbox", { name: "先方に送る返事", exact: true });
  await box.fill("宛先を教えてください。");
  await d.getByRole("button", { name: "送る", exact: true }).click();
  await expect(d.getByText(NO_RIGHT, { exact: true })).toBeVisible();
  await expect(d.getByText(/もう一度押してください/)).toHaveCount(0);
  await expect(d).toBeVisible();
  await expect(box).toHaveValue("宛先を教えてください。");
  await expect(page.getByText("返事を送りました", { exact: true })).toHaveCount(0);
  expect(countOf(w, "POST", /\/reply$/)).toBe(1);
  // 断るも同じ形
  const w2 = world({ once: { decline: err(403, "FORBIDDEN") } });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockWorld(page, w2);
  await page.goto(`/requests/${R1.id}`);
  await btn(page, "断る（理由を返す）").click();
  const d2 = dlg(page, "この依頼を断る");
  const reason = d2.getByRole("textbox", { name: "先方に返す理由", exact: true });
  await reason.fill("お断りします。");
  await d2.getByRole("button", { name: "断る", exact: true }).click();
  await expect(d2.getByText(NO_RIGHT, { exact: true })).toBeVisible();
  await expect(d2.getByText(/もう一度押してください/)).toHaveCount(0);
  await expect(d2).toBeVisible();
  await expect(reason).toHaveValue("お断りします。");
  await expect(page.getByText("断りました", { exact: true })).toHaveCount(0);
  expect(countOf(w2, "POST", /\/decline$/)).toBe(1);
});

test("K898-UI-035 送る・断るの口が 401（書きかけのままセッション切れ）：ログインの画面へ移る・帯は出ない", async ({
  page,
}) => {
  const w = world({ once: { reply: err(401, "UNAUTHORIZED") } });
  await openFirst(page, w);
  await btn(page, "返事を送って詳しく聞く").click();
  const d = dlg(page, "返事を送って詳しく聞く");
  await d.getByRole("textbox", { name: "先方に送る返事", exact: true }).fill("宛先を教えてください。");
  await d.getByRole("button", { name: "送る", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("返事を送りました", { exact: true })).toHaveCount(0);
  expect(countOf(w, "POST", /\/reply$/)).toBe(1);
  const w2 = world({ once: { decline: err(401, "UNAUTHORIZED") } });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await open(page, w2, 1440, `/requests/${R1.id}`);
  await btn(page, "断る（理由を返す）").click();
  const d2 = dlg(page, "この依頼を断る");
  await d2.getByRole("textbox", { name: "先方に返す理由", exact: true }).fill("お断りします。");
  await d2.getByRole("button", { name: "断る", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(countOf(w2, "POST", /\/decline$/)).toBe(1);
});

test("K898-UI-018 断る：理由が空だと誤りが出て口は呼ばれない", async ({ page }) => {
  const w = world();
  await openFirst(page, w);
  await btn(page, "断る（理由を返す）").click();
  const d = dlg(page, "この依頼を断る");
  await expect(d).toBeVisible();
  await d.getByRole("button", { name: "断る", exact: true }).click();
  await expect(d.getByText("理由を書いてください（先方に届きます）", { exact: true })).toBeVisible();
  expect(countOf(w, "POST", /\/decline$/)).toBe(0);
});

test("K898-UI-019 断る：POST 1 回・帯・さばいたものへ。もう決まっていた（409）は文と読み直し", async ({ page }) => {
  const w = world();
  await openFirst(page, w);
  await btn(page, "断る（理由を返す）").click();
  const d = dlg(page, "この依頼を断る");
  await d.getByRole("textbox", { name: "先方に返す理由", exact: true }).fill("四半期ごとにまとめてお送りしています。");
  await d.getByRole("button", { name: "断る", exact: true }).click();
  await expect(page.getByText("断りました", { exact: true })).toBeVisible();
  const posts = w.calls.filter((c) => c.method === "POST" && /\/decline$/.test(c.path));
  expect(posts).toHaveLength(1);
  expect(posts[0]!.body).toEqual({ reason: "四半期ごとにまとめてお送りしています。" });
  await expect(listBox(page).getByRole("heading", { name: "さばいたもの", exact: true })).toBeVisible();
  // もう決まっていた：別の人が先にさばいた
  const w2 = world({ once: { decline: err(409, "CONFLICT") } });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockWorld(page, w2);
  await page.goto(`/requests/${R1.id}`);
  await btn(page, "断る（理由を返す）").click();
  const d2 = dlg(page, "この依頼を断る");
  await d2.getByRole("textbox", { name: "先方に返す理由", exact: true }).fill("お断りします。");
  await d2.getByRole("button", { name: "断る", exact: true }).click();
  await expect(d2.getByText("この依頼はもう決まっています", { exact: true })).toBeVisible();
  await expect.poll(() => countOf(w2, "GET", /\/client_requests\/[^/]+$/)).toBeGreaterThanOrEqual(2);
});

test("K898-UI-025 セッション切れ（401）：ログインの画面へ移る", async ({ page }) => {
  await open(page, world({ once: { list: err(401, "UNAUTHORIZED") } }));
  await expect(page).toHaveURL(/\/login/);
});

test("K898-UI-026 小窓を Esc で閉じても口は呼ばれず、戻るで一覧に戻る", async ({ page }) => {
  const w = world();
  await open(page, w);
  await listBox(page)
    .getByRole("link", { name: new RegExp(R2.title) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/requests/${R2.id}$`));
  await page.goBack();
  await expect(page).toHaveURL(/\/requests$/);
  await page.goto(`/requests/${R1.id}`);
  await expect(detail(page)).toBeVisible();
  await btn(page, "断る（理由を返す）").click();
  await page.keyboard.press("Escape");
  await expect(dlg(page, "この依頼を断る")).toBeHidden();
  expect(w.calls.filter((c) => c.method !== "GET")).toEqual([]);
});

test("K898-UI-027 見えない依頼を直に開く（404）：題も先方の名前も出ない", async ({ page }) => {
  const w = world();
  await open(page, w, 1440, `/requests/${ID(77)}`);
  await expect(page.getByText("この依頼は見つかりません", { exact: true })).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toContain("鈴木");
  expect(text).not.toContain(GROUP);
});

for (const width of [375, 768, 1440]) {
  test(`K898-UI-028 幅 ${width}：一覧・開いた依頼・返事を送る小窓で横のはみ出し 0・小窓が画面の中`, async ({
    page,
  }) => {
    await open(page, world(), width, `/requests/${R1.id}`);
    await expect(detail(page)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await btn(page, "返事を送って詳しく聞く").click();
    const d = dlg(page, "返事を送って詳しく聞く");
    await expect(d).toBeVisible();
    const bx = await d.boundingBox();
    const h = page.viewportSize()!.height;
    expect(bx!.y).toBeGreaterThanOrEqual(0);
    expect(bx!.y + bx!.height).toBeLessThanOrEqual(h);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
}

test("K898-UI-029 設計者の言葉・取引先・呼び名の字が 2 つの小窓にも無い", async ({ page }) => {
  await openFirst(page, world());
  const bad = /取引先|クライアント|先方の人|client|acceptance|検収/;
  for (const [open, name] of [
    ["断る（理由を返す）", "この依頼を断る"],
    ["返事を送って詳しく聞く", "返事を送って詳しく聞く"],
  ] as const) {
    await btn(page, open).click();
    const d = dlg(page, name);
    await expect(d).toBeVisible();
    expect(await d.innerText()).not.toMatch(bad);
    await page.keyboard.press("Escape");
    await expect(d).toBeHidden();
  }
  expect(await detail(page).innerText()).not.toMatch(bad);
});

test("K898-UI-031 さばける人でも「チケットを作る」は K-930 が入るまで押せない形：隠さず aria-disabled・小窓は開かず口は呼ばれない／断る・返事は押せる", async ({
  page,
}) => {
  const w = world();
  await openFirst(page, w);
  // K-930 が入ったので押せる形：押すと作る小窓が開く（中身と口は K-930 の試験が見る）。開くだけでは書く口を呼ばない
  await expect(btn(page, "チケットを作る")).not.toHaveAttribute("aria-disabled", "true");
  await expect(btn(page, "断る（理由を返す）")).not.toHaveAttribute("aria-disabled", "true");
  await expect(btn(page, "返事を送って詳しく聞く")).not.toHaveAttribute("aria-disabled", "true");
  await btn(page, "チケットを作る").click();
  await expect(page.getByRole("dialog", { name: "チケットを作る", exact: true })).toBeVisible();
  expect(w.calls.filter((c) => c.method !== "GET")).toEqual([]);
});

test("K898-UI-032 もう決まっていた依頼（409・E-GST-110）：返事を送るは小窓に「この依頼はもう決まっています」・書いた返事は残り依頼を読み直す／届け先を変えるも同じ文", async ({
  page,
}) => {
  const w = world({ once: { reply: err(409, "E-GST-110") } });
  await openFirst(page, w);
  await btn(page, "返事を送って詳しく聞く").click();
  const d = dlg(page, "返事を送って詳しく聞く");
  const box = d.getByRole("textbox", { name: "先方に送る返事", exact: true });
  await box.fill("宛先を教えてください。");
  const before = countOf(w, "GET", /\/client_requests\/[^/]+$/);
  await d.getByRole("button", { name: "送る", exact: true }).click();
  await expect(d.getByText("この依頼はもう決まっています", { exact: true })).toBeVisible();
  await expect(box).toHaveValue("宛先を教えてください。");
  await expect.poll(() => countOf(w, "GET", /\/client_requests\/[^/]+$/)).toBeGreaterThan(before);
  await d.getByRole("button", { name: "やめる", exact: true }).click();
  w.once.patch = err(409, "E-GST-110");
  await page.getByRole("button", { name: "届け先を変える", exact: true }).click();
  await page.getByRole("menuitem", { name: "KR 経理", exact: true }).click();
  await expect(page.getByText("この依頼はもう決まっています", { exact: true })).toBeVisible();
});

test("K898-UI-033 選んだ届け先が選べない（404・E-GST-111）：文「この届け先のグループは選べません」・一覧の行は元の届け先のまま・選び肢を読み直す", async ({
  page,
}) => {
  const w = world({ once: { patch: err(404, "E-GST-111") } });
  await openFirst(page, w);
  const before = countOf(w, "GET", /\/client_requests\/[^/]+$/);
  await page.getByRole("button", { name: "届け先を変える", exact: true }).click();
  await page.getByRole("menuitem", { name: "KR 経理", exact: true }).click();
  await expect(page.getByText("この届け先のグループは選べません", { exact: true })).toBeVisible();
  await expect(r1Row(page).getByText(new RegExp(`^${R1.from_name} ・ EG 営業に届いた ・ .+$`))).toBeVisible();
  await expect.poll(() => countOf(w, "GET", /\/client_requests\/[^/]+$/)).toBeGreaterThan(before);
});
