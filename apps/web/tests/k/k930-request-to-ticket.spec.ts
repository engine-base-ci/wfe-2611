// K-930「画面：届いた依頼からチケットを作る小窓と、作った後のチケットの詳細（チャットの頭に依頼のやり取りが残る）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f11/rq-create・rq-create-bad・rq-saving・rq-accepted・rq-accept-failed・tk-from-request（本番と同じ部品 features/F11/requests/{views,dialogs}.tsx と features/F11/share/・代表の決め answer=6ba09f587792）。
//   ログイン・外枠は本物（person・loginAs）。届いた依頼の口（listClientRequests ほか 5 本）・担当とグループの選び肢の前からの口（listMembers・listScopes）・作ったチケットの詳細の口だけを網の手前で差し替える。
//   答えの形は 11_tickets/K-898.md の「読む答えの形」と 11_tickets/K-894.md（acceptClientRequest・体 title?・body?・assignee_member_id・due_on・scope_id・kind_id?・guest_group_ids?）。
//   本人の Bridge（127.0.0.1:38617）は 404。固定の待ちは使わない（答えと移り終わりを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { loginAs } from "../_lib/api";
import { TICKET, detailOf } from "../features/F5/approve-complete.harness";
import { err, never, ok, pair, person, type Reply } from "./credentials-mock";
import { shellReply } from "./shell-answer";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { meta, ok as okT, panel, post, talkTab, type MessageView, type Who } from "./thread-mock";

/** 答えの meta（一覧の limit・書けるグループ）を付けて返す（ok の 2 つ目は状態コードなので meta を渡せない） */
const okMeta = (data: unknown, meta: Record<string, unknown>): Reply => ({ status: 200, body: { data, meta } });

test.use({ timezoneId: "Asia/Tokyo" });

const GROUP = "セイコー株式会社（ゲスト）";
const ID = (n: number) => `0193c5a0-0000-7000-8000-0000000f${String(n).padStart(4, "0")}`;
const T_ID = TICKET; // 作ったチケットの詳細は前からの土台（approve-complete.harness）の 1 件で開く
const GUEST_W: Who = { member_id: ID(701), display_name: "鈴木 健太 様", call_name: null };
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
/** 担当の選び肢（前からの口 listMembers）・グループの選び肢（前からの口 listScopes）。書けるグループは営業と受託開発 */
const MEMBERS = [
  { id: "m-takamoto", display_name: "高本 聖斗", kind_id: "human" },
  { id: "m-sato", display_name: "佐藤 花子", kind_id: "human" },
];
const SCOPES = [
  { id: "g-eg", name: "営業", ticket_prefix: "EG" },
  { id: "g-kr", name: "経理", ticket_prefix: "KR" },
  { id: "g-jd", name: "受託開発", ticket_prefix: "JD" },
];
// 外枠の口 getShell（K-466）：グループの選び肢は外枠と同じ答え（groups）から出る（/api/v1/scopes は呼ばない）。書けるのは営業と受託開発
const SHELL_GROUPS = SCOPES.map((g) => ({
  id: g.id,
  name: g.name,
  ticket_prefix: g.ticket_prefix,
  writable: g.id !== "g-kr",
  open_count: 0,
}));
const R1 = mk(1, "12 月分の作業報告書もほしい", "new");
const R2 = mk(2, "管理画面に検索の絞り込みを足したい", "asking", "JD 受託開発");
const R3 = mk(3, "10 月分の請求書の再発行", "done", "KR 経理");
/** 下絵の一覧と同じ並び（4 件）にするための 1 件（突き合わせの行だけで使う） */
const R4 = mk(4, "ログイン画面の文言を直してほしい", "new", "JD 受託開発");
const BODY = "いつもありがとうございます。11 月分と同じ形で、12 月分の作業報告書もいただけますか。";

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}
interface World {
  items: ReturnType<typeof mk>[];
  canAct: boolean;
  calls: Call[];
  once: Partial<Record<"list" | "get" | "patch" | "reply" | "accept" | "decline" | "members", Reply>>;
  hold: Set<"reply" | "accept" | "decline">;
  listGate?: Promise<void>;
  /** 分身の案（ticket_draft）を返すか。false は案の無い依頼（小窓の担当と期限は空で始まる） */
  draft: boolean;
}
const world = (o: Partial<World> = {}): World => ({
  items: [R1, R2, R3],
  canAct: true,
  calls: [],
  once: {},
  hold: new Set(),
  draft: true,
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
    if (p === "/api/v1/members" && method === "GET") {
      w.calls.push({ method, path: p, body: null });
      // once は 1 回だけ当てる（ほかの口の take と同じ。消さないと「もう一度」の読み直しも 503 のまま）
      const once = w.once.members;
      delete w.once.members;
      return send(route, once ?? okMeta(MEMBERS, { limit: 200 }));
    }
    if (p === "/api/v1/shell" && method === "GET") {
      w.calls.push({ method, path: p, body: null });
      const r = shellReply({ groups: SHELL_GROUPS });
      return route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    }
    if (p === "/api/v1/scopes" && method === "GET") {
      w.calls.push({ method, path: p, body: null });
      return send(route, okMeta(SCOPES, { limit: 200, writable: ["g-eg", "g-jd"] }));
    }
    const m = /^\/api\/v1\/client_requests(?:\/([^/]+))?(?:\/(reply|accept|decline))?$/.exec(p);
    if (!m) {
      if (p === `/api/v1/tickets/${T_ID}`)
        return send(route, ok(detailOf(T_ID, { title: "セイコー様 12 月分の作業報告書を作って送る" })));
      if (p === `/api/v1/tickets/${T_ID}/timeline`) {
        // 社内の読み（段 7）：依頼から来た書き込みは message.from_request が true（K-882）。false の行には鍵が無い
        const head = post(GUEST_W, "2026-11-23 10:20", BODY, {
          can_edit: false,
          can_delete: false,
          from_request: true,
        } as Partial<MessageView>);
        const mine = post(
          { member_id: ID(702), display_name: "高本 聖斗", call_name: "高本" },
          "2026-11-23 12:00",
          "作業を始めました。",
        );
        return send(route, okT([head, mine], meta({ post_count: 2 }) as unknown as Record<string, unknown>));
      }
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
          request: { ...item, body: BODY },
          messages: [],
          routes: ROUTES,
          can_act: w.canAct,
          pc_connected: true,
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
          reply_draft: "鈴木様 承知しました。11 月分と同じ形で、12/26 までにお送りします。",
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

// ---------------------------------------------------------------- 下絵との突き合わせ
for (const [mock, path, step] of [
  ["rq-create", `/requests/${R1.id}`, "open"],
  ["rq-create-bad", `/requests/${R1.id}`, "bad"],
  ["rq-saving", `/requests/${R1.id}`, "saving"],
  ["rq-accept-failed", `/requests/${R1.id}`, "failed"],
  ["rq-accepted", `/requests/${R1.id}`, "accepted"],
] as const) {
  for (const w of MATCH_WIDTHS) {
    test(`K930-UI-001 ${mock} 幅 ${w}：本物の小窓の字と位置が下絵と一致する`, async ({ browser }) => {
      const u = await person();
      const { rows, bad } = await matchMock(
        browser,
        mock,
        w,
        async (page) => {
          const world0 = world({
            hold: step === "saving" ? new Set(["accept"]) : new Set(),
            once: step === "failed" ? { accept: err(503, "SERVICE_UNAVAILABLE") } : {},
            // 下絵 rq-create-bad は担当と期限が空の形なので、案の無い依頼で開く（案があれば初期値が入る・D-155.8）
            draft: step !== "bad",
            items: [R1, R2, R4, R3], // 下絵の一覧は 4 件（幅 768 は一覧の下に本文が来るので件数で見出しの位置が変わる）
          });
          await loginAs(page, u.token);
          await mockWorld(page, world0);
          await page.goto(path);
          await btn(page, "チケットを作る").click();
          if (step === "bad")
            await dlg(page, "チケットを作る").getByRole("button", { name: "作る", exact: true }).click();
          if (step === "saving" || step === "failed" || step === "accepted") {
            const d = dlg(page, "チケットを作る");
            await d.getByRole("combobox", { name: "担当", exact: true }).click();
            await page.getByRole("option", { name: "高本 聖斗", exact: true }).click();
            await d.getByRole("textbox", { name: "期限", exact: true }).fill("12/26");
            await d.getByRole("button", { name: "作る", exact: true }).click();
          }
          if (step === "accepted") await expect(page.getByText(/チケットを作りました/)).toBeVisible();
          else await expect(dlg(page, "チケットを作る")).toBeVisible();
          // 下の「チケットを作る」を押すと頁が下へ送られる。y は頁の上からの位置で読むので、下絵と同じく頁の頭に戻してから比べる
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        {
          base: "/dev/mock/f11",
          pairs: [
            step === "accepted"
              ? pair("h1", "article.k-f11q-detail h1", ["x", "y", "font-size", "color", "texts"])
              : pair("h1", ".k-dialog h2", ["x", "y", "font-size", "color", "texts"]),
          ],
        },
      );
      expect(rows.length, "比べた役がある").toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K930-UI-002 チケットを作る小窓：依頼の値と分身の案（期限 12/26・担当 高本 聖斗）が入り、見せる相手が最初から入っている", async ({
  page,
}) => {
  await openFirst(page, world());
  await btn(page, "チケットを作る").click();
  const d = dlg(page, "チケットを作る");
  await expect(d.getByRole("textbox", { name: "題", exact: true })).toHaveValue(/作業報告書/);
  await expect(d.getByRole("textbox", { name: "本文", exact: true })).not.toHaveValue("");
  // 案の値が初期値に入る（D-155.8・K-899 の引き当て）。人が直せる
  await expect(d.getByRole("textbox", { name: "期限", exact: true })).toHaveValue("12/26");
  await expect(d.getByRole("combobox", { name: "担当", exact: true })).toContainText("高本 聖斗");
  const vis = d.getByRole("list", { name: "見せる相手", exact: true });
  await expect(vis.getByRole("checkbox")).toBeChecked();
  await expect(
    vis.getByText(new RegExp(`^\\s*${GROUP}(?:\\s*依頼を出したゲストのグループ。最初から入っている)?\\s*$`)),
  ).toBeVisible();
});

test("K930-UI-003 案の無い依頼で担当と期限が空：誤りが出て口は呼ばれず小窓は閉じない", async ({ page }) => {
  const w = world({ draft: false });
  await openFirst(page, w);
  await btn(page, "チケットを作る").click();
  const d = dlg(page, "チケットを作る");
  await expect(d.getByRole("textbox", { name: "期限", exact: true })).toHaveValue("");
  await d.getByRole("button", { name: "作る", exact: true }).click();
  await expect(d.getByText("担当の人を選んでください", { exact: true })).toBeVisible();
  await expect(d.getByText("期限を入れてください", { exact: true })).toBeVisible();
  expect(countOf(w, "POST", /\/accept$/)).toBe(0);
  await expect(d).toBeVisible();
});

test("K930-UI-004 チケットを作る：POST 1 回（二度押しも 1 回）・帯とチケットを開く", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-23T09:00:00+09:00"));
  const w = world({ hold: new Set(["accept"]) });
  await openFirst(page, w);
  await btn(page, "チケットを作る").click();
  const d = dlg(page, "チケットを作る");
  await d.getByRole("combobox", { name: "担当", exact: true }).click();
  await page.getByRole("option", { name: "高本 聖斗", exact: true }).click();
  await d.getByRole("textbox", { name: "期限", exact: true }).fill("12/26");
  await d.getByRole("button", { name: "作る", exact: true }).click();
  await expect.poll(() => countOf(w, "POST", /\/accept$/)).toBe(1);
  await expect(d.getByRole("button", { name: "作る", exact: true })).toBeDisabled();
  await d.getByRole("button", { name: "作る", exact: true }).click({ force: true });
  expect(countOf(w, "POST", /\/accept$/)).toBe(1);
  const b = w.calls.find((c) => /\/accept$/.test(c.path))!.body!;
  // 契約の体（K-894）：担当は選び肢の id・期限は日付（今日 2026-11-23 から見て次の 12/26）・グループは選んだ id・見せる相手の追加は無い（依頼のグループは口が必ず入れる）
  expect(b).toMatchObject({
    title: expect.stringContaining("作業報告書"),
    assignee_member_id: "m-takamoto",
    due_on: "2026-12-26",
    scope_id: "g-eg",
  });
  expect(b).not.toHaveProperty("guest_group_ids");
});

test("K930-UI-005 チケットを作れなかった：小窓は閉じず入力が残り、押し直せる", async ({ page }) => {
  const w = world({ once: { accept: err(503, "SERVICE_UNAVAILABLE") } });
  await openFirst(page, w);
  await btn(page, "チケットを作る").click();
  const d = dlg(page, "チケットを作る");
  await d.getByRole("combobox", { name: "担当", exact: true }).click();
  await page.getByRole("option", { name: "高本 聖斗", exact: true }).click();
  await d.getByRole("textbox", { name: "期限", exact: true }).fill("12/26");
  await d.getByRole("button", { name: "作る", exact: true }).click();
  await expect(d.getByText("チケットを作れませんでした", { exact: true })).toBeVisible();
  await expect(d.getByRole("textbox", { name: "期限", exact: true })).toHaveValue("12/26");
  await d.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page.getByText(/チケットを作りました/)).toBeVisible();
  expect(countOf(w, "POST", /\/accept$/)).toBe(2);
});

test("K930-UI-006 作ったチケットを開く：詳細のチャットの頭に依頼のやり取りが残る", async ({ page }) => {
  const w = world();
  await openFirst(page, w);
  await btn(page, "チケットを作る").click();
  const d = dlg(page, "チケットを作る");
  await d.getByRole("combobox", { name: "担当", exact: true }).click();
  await page.getByRole("option", { name: "高本 聖斗", exact: true }).click();
  await d.getByRole("textbox", { name: "期限", exact: true }).fill("12/26");
  await d.getByRole("button", { name: "作る", exact: true }).click();
  await btn(page, "チケットを開く").click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${T_ID}$`));
  await talkTab(page).click();
  const chat = panel(page);
  // チャットの頭の区切りは K-905 の部品が from_request で引く：札「依頼のやり取り」・依頼の本文・区切り「ここからチケットのやり取り」・その下に社内の書き込み
  await expect(chat.getByText("依頼のやり取り", { exact: true })).toBeVisible();
  await expect(chat.getByText(BODY, { exact: true })).toBeVisible();
  await expect(chat.getByText("ここからチケットのやり取り", { exact: true })).toBeVisible();
  await expect(chat.getByText("作業を始めました。", { exact: true })).toBeVisible();
});

test("K930-UI-007 担当とグループの選び肢は前からの口（listMembers・listScopes）から出る：担当は会社の人・グループは書けるグループだけ・口は 1 回ずつ", async ({
  page,
}) => {
  const w = world();
  await openFirst(page, w);
  await btn(page, "チケットを作る").click();
  const d = dlg(page, "チケットを作る");
  await d.getByRole("combobox", { name: "担当", exact: true }).click();
  await expect(page.getByRole("option", { name: "高本 聖斗", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "佐藤 花子", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const group = d.getByRole("combobox", { name: "グループ", exact: true });
  await group.click();
  await expect(page.getByRole("option", { name: "営業", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "受託開発", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "経理", exact: true })).toHaveCount(0); // 書けないグループは選べない
  expect(countOf(w, "GET", /\/api\/v1\/members$/)).toBe(1);
  expect(countOf(w, "GET", /\/api\/v1\/shell$/)).toBe(1); // グループは外枠の答え（K-466）。外枠が読んだ答えを使い回す
  expect(countOf(w, "GET", /\/api\/v1\/scopes$/)).toBe(0);
});

test("K930-UI-008 担当の選び肢が読めない（503）：小窓は開き、担当の欄に「読めませんでした」と「もう一度」・作るは口を呼ばない", async ({
  page,
}) => {
  const w = world({ once: { members: err(503, "SERVICE_UNAVAILABLE") } });
  await openFirst(page, w);
  await btn(page, "チケットを作る").click();
  const d = dlg(page, "チケットを作る");
  await expect(d.getByText("読めませんでした", { exact: true })).toBeVisible();
  await d.getByRole("button", { name: "作る", exact: true }).click();
  expect(countOf(w, "POST", /\/accept$/)).toBe(0);
  await d.getByRole("button", { name: "もう一度", exact: true }).click();
  await d.getByRole("combobox", { name: "担当", exact: true }).click();
  await expect(page.getByRole("option", { name: "高本 聖斗", exact: true })).toBeVisible();
});

async function fillAndCreate(page: Page, w: World): Promise<void> {
  await openFirst(page, w);
  await btn(page, "チケットを作る").click();
  const d = dlg(page, "チケットを作る");
  await d.getByRole("combobox", { name: "担当", exact: true }).click();
  await page.getByRole("option", { name: "高本 聖斗", exact: true }).click();
  await d.getByRole("textbox", { name: "期限", exact: true }).fill("12/26");
  await d.getByRole("button", { name: "作る", exact: true }).click();
}

test("K930-UI-009 もう決まっていた依頼（409・E-GST-120）：小窓に「この依頼はもう決まっています」・入力は残り・依頼を読み直す", async ({
  page,
}) => {
  const w = world({ once: { accept: err(409, "E-GST-120") } });
  await fillAndCreate(page, w);
  const d = dlg(page, "チケットを作る");
  await expect(d.getByText("この依頼はもう決まっています", { exact: true })).toBeVisible();
  await expect(d.getByRole("textbox", { name: "期限", exact: true })).toHaveValue("12/26");
  await expect.poll(() => countOf(w, "GET", /\/client_requests\/[^/]+$/)).toBeGreaterThanOrEqual(2);
});

test("K930-UI-010 見せる相手が選べない（404・E-GST-040／409・E-GST-041）：文は errors.json の「このゲストのグループは見つかりません」「見せる相手は 20 までです」：小窓は閉じず文を出し入力は残る", async ({
  page,
}) => {
  const w = world({ once: { accept: err(404, "E-GST-040") } });
  await fillAndCreate(page, w);
  const d = dlg(page, "チケットを作る");
  await expect(d.getByText("このゲストのグループは見つかりません", { exact: true })).toBeVisible();
  await expect(d.getByRole("textbox", { name: "期限", exact: true })).toHaveValue("12/26");
  w.once.accept = err(409, "E-GST-041");
  await d.getByRole("button", { name: "作る", exact: true }).click();
  await expect(d.getByText("見せる相手は 20 までです", { exact: true })).toBeVisible();
  await expect(d).toBeVisible();
});

test("K930-UI-011 担当が会社の人でない・種別が無い・本文が不正（422）／グループに書けない（403）：小窓は閉じず欄の下に「担当の人を選んでください」「グループを選んでください」・何も作られない", async ({
  page,
}) => {
  const w = world({
    once: {
      accept: {
        status: 422,
        body: { error: "validation_error", code: "VALIDATION_ERROR", details: [{ field: "assignee_member_id" }] },
      },
    },
  });
  await fillAndCreate(page, w);
  const d = dlg(page, "チケットを作る");
  await expect(d.getByText("担当の人を選んでください", { exact: true })).toBeVisible();
  await expect(d).toBeVisible();
  w.once.accept = err(403, "FORBIDDEN");
  await d.getByRole("button", { name: "作る", exact: true }).click();
  await expect(d.getByText("グループを選んでください", { exact: true })).toBeVisible();
  await expect(page.getByText(/チケットを作りました/)).toHaveCount(0);
});

for (const width of [375, 768, 1440]) {
  test(`K930-UI-012 幅 ${width}：チケットを作る小窓を開いた形で横のはみ出し 0・小窓の頭と足が画面の中`, async ({
    page,
  }) => {
    await open(page, world(), width, `/requests/${R1.id}`);
    await expect(detail(page)).toBeVisible();
    await btn(page, "チケットを作る").click();
    const d = dlg(page, "チケットを作る");
    await expect(d).toBeVisible();
    const bx = await d.boundingBox();
    const h = page.viewportSize()!.height;
    expect(bx!.y).toBeGreaterThanOrEqual(0);
    expect(bx!.y + bx!.height).toBeLessThanOrEqual(h);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
}

test("K930-UI-013 設計者の言葉・取引先・呼び名：チケットを作る小窓に「取引先」「クライアント」「先方の人」「client」「acceptance」「検収」が無い", async ({
  page,
}) => {
  await openFirst(page, world());
  await btn(page, "チケットを作る").click();
  const d = dlg(page, "チケットを作る");
  await expect(d).toBeVisible();
  expect(await d.innerText()).not.toMatch(/取引先|クライアント|先方の人|client|acceptance|検収/);
  await expect(
    d.getByText(
      "ゲストに見える 題・本文・詳細・チャットと、段の札だけ。担当・期限などはゲストに見えません。 依頼のやり取りは、チケットのチャットの頭に残ります。",
      { exact: true },
    ),
  ).toBeVisible();
});
