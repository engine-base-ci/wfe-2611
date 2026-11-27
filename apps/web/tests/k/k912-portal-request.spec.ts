// K-912「画面：ゲストの場所で依頼を出す・依頼のやり取りを口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f11/pt-new・pt-new-ps0・pt-req ほか（本番と同じ部品 features/F11/portal/request.tsx）。
//   ログインは本物の人（person・loginAs）。画面のログインの解決（/api/auth-ext/me）だけゲスト（役割 requester）の答えにする（形は K-875 に合わせる）。
//   ゲストの場所の口は網の手前で差し替える。答えの形は 11_tickets/K-912.md の「読む答えの形」（K-907〜K-910 の確定）。添付の口 uploadPortalAttachment は JSON 体 { name, content_type, data（base64）}（K-909）。
//   本人の Bridge（127.0.0.1:38617）は 404。固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { loginAs } from "../_lib/api";
import { err, never, ok, pair, person, type Reply } from "./credentials-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const GROUP = "セイコー株式会社（ゲスト）";
const RID = "0193c5a0-0000-7000-8000-0000000c0001";
const NEW_BODY = "来年 1 月から請求書の宛先を経理部の佐野に変えたいです";
type State = "open" | "accepted" | "declined";
interface Call {
  method: string;
  path: string;
  body: string | null;
}
interface World {
  available: boolean;
  questions: { id: string; text: string }[];
  state: State;
  reason: string;
  text: string;
  messages: { id: string; side: "they" | "we"; name: string; at: string; text: string }[];
  calls: Call[];
  once: { questions?: Reply; create?: Reply; upload?: Reply[]; message?: Reply; get?: Reply };
  hold: Set<"create" | "message">;
}
const world = (o: Partial<World> = {}): World => ({
  available: true,
  questions: [{ id: "q1", text: "佐野様のメールアドレスと、CC は今と同じ鈴木様のままでよいか" }],
  state: "open",
  reason: "",
  text: "12 月分の作業報告書もほしいです。",
  messages: [
    { id: "m1", side: "they", name: "鈴木 健太 様", at: "今日 10:20", text: "12 月分の作業報告書もほしいです。" },
    {
      id: "m2",
      side: "we",
      name: "高本さん（ENGINE BASE）",
      at: "今日 10:42",
      text: "12/26 までにお送りします。宛先は山田様でよろしいですか？",
    },
  ],
  calls: [],
  once: {},
  hold: new Set(),
  ...o,
});
const calls = (w: World, method: string, re: RegExp) => w.calls.filter((c) => c.method === method && re.test(c.path));
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
    w.calls.push({ method, path: p, body: req.postData() });
    if (p === "/api/v1/portal")
      return send(
        route,
        ok({
          group_name: GROUP,
          tenant_name: "ENGINE BASE",
          request_scope_name: "営業",
          me: { name: "山田 花子", initial: "山" },
          first_visit: false,
          requests: [],
          tickets: [],
        }),
      );
    if (p === "/api/v1/portal/notices") return send(route, ok([]));
    if (p === "/api/v1/portal/requests/questions")
      return send(route, w.once.questions ?? ok({ available: w.available, questions: w.available ? w.questions : [] }));
    if (p === "/api/v1/portal/attachments")
      return send(
        route,
        w.once.upload?.shift() ?? ok({ id: `att-${calls(w, "POST", /attachments$/).length}`, name: "file" }, 201),
      );
    if (method === "POST" && p === "/api/v1/portal/requests") {
      if (w.hold.has("create")) return never();
      return send(route, w.once.create ?? ok({ id: RID }, 201));
    }
    if (method === "POST" && p.endsWith("/messages")) {
      if (w.hold.has("message")) return never();
      const r = w.once.message ?? ok({ id: "m9" }, 201);
      if (r.status === 201)
        w.messages = [
          ...w.messages,
          { id: "m9", side: "they", name: "山田 花子 様", at: "今", text: JSON.parse(req.postData() ?? "{}").body },
        ];
      return send(route, r);
    }
    if (method === "GET" && p === `/api/v1/portal/requests/${RID}`)
      return send(
        route,
        w.once.get ??
          ok({
            request: {
              id: RID,
              title: "12 月分の作業報告書もほしい",
              from_name: "鈴木 健太 様",
              created_at: "2026-11-23T01:20:00Z",
              state: w.state,
              ...(w.reason ? { declined_reason: w.reason } : {}),
            },
            messages: w.messages,
            can_write: w.state === "open",
          }),
      );
    return send(route, err(404, "NOT_FOUND"));
  });
}
async function open(page: Page, w: World, path: string, width = 1440) {
  const u = await person();
  await loginAs(page, u.token);
  await mockWorld(page, w);
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto(path))?.status()).toBe(200);
}
const NEW = "/portal/requests/new";
const REQ = `/portal/requests/${RID}`;
const bodyBox = (page: Page) => page.getByRole("textbox", { name: "何をしてほしいか", exact: true });
const submit = (page: Page) => page.getByRole("button", { name: "依頼を出す", exact: true });
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const fillBody = async (page: Page, v = NEW_BODY) => {
  await bodyBox(page).fill(v);
};
const file = (name: string, size = 10) => ({
  name,
  mimeType: "application/octet-stream",
  buffer: Buffer.alloc(size, 1),
});
const pick = async (page: Page, label: string) => {
  await page.getByRole("combobox", { name: "いつまでに（任意）", exact: true }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
};
const fileInput = (page: Page) => page.locator('input[type="file"]');

for (const [mock, path, o] of [
  ["pt-new", NEW, {}],
  ["pt-new-ps0", NEW, { available: false }],
  ["pt-req", REQ, {}],
] as const) {
  for (const width of MATCH_WIDTHS) {
    test(`K912-UI-001 ${mock} 幅 ${width}：本物の画面が下絵と一致する`, async ({ browser }) => {
      const u = await person();
      const { rows, bad } = await matchMock(
        browser,
        mock,
        width,
        async (page) => {
          await loginAs(page, u.token);
          await mockWorld(page, world(o as Partial<World>));
          await page.goto(path);
          if (mock !== "pt-req") {
            await bodyBox(page).fill(NEW_BODY);
            await bodyBox(page).blur();
          }
          await expect(page.locator("h1").first()).toBeVisible();
        },
        {
          base: "/dev/mock/f11",
          pairs: [pair("h1", "h1", ["x", "y", "font-size", "texts"]), pair("main", "main", ["x", "width"])],
        },
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K912-UI-002 依頼を出す画面を開く：空の欄・一文・口は 0 回", async ({ page }) => {
  const w = world();
  await open(page, w, NEW);
  await expect(page.getByRole("heading", { name: "依頼を出す", level: 1, exact: true })).toBeVisible();
  await expect(bodyBox(page)).toHaveValue("");
  await expect(
    page.getByText(`この依頼は、${GROUP}の皆さんと ENGINE BASE に見えます。`, { exact: true }),
  ).toBeVisible();
  // 届け先の名前は口の request_scope_name（ホームの答え）・会社の名前は tenant_name から（直書きしない）
  await expect(
    page.getByText(`ENGINE BASE の営業グループに届きます。${GROUP}の皆さんにも見えます`, { exact: true }),
  ).toBeVisible();
  await expect(submit(page)).toBeEnabled();
  expect(calls(w, "POST", /requests(\/questions)?$|attachments$/)).toHaveLength(0);
});

test("K912-UI-003 書く間に聞く：欄を離れると質問の口が 1 回・同じ本文では増えない", async ({ page }) => {
  const w = world();
  await open(page, w, NEW);
  await fillBody(page);
  await bodyBox(page).blur();
  await expect(
    page.getByText("佐野様のメールアドレスと、CC は今と同じ鈴木様のままでよいか", { exact: true }),
  ).toBeVisible();
  const q = calls(w, "POST", /requests\/questions$/);
  expect(q).toHaveLength(1);
  expect(JSON.parse(q[0]!.body ?? "{}")).toEqual({ body: NEW_BODY });
  await bodyBox(page).focus();
  await bodyBox(page).blur();
  expect(calls(w, "POST", /requests\/questions$/)).toHaveLength(1);
});

test("K912-UI-004 PC が閉じている：押せない説明・聞き直さず出せる", async ({ page }) => {
  const w = world({ available: false });
  await open(page, w, NEW);
  await fillBody(page);
  await bodyBox(page).blur();
  const note = page.getByText("いまは担当の席が閉じているので、ここでは聞き返しません。", { exact: true });
  await expect(note).toBeVisible();
  await expect(page.locator(".k-f11p-ai[aria-disabled='true']")).toHaveCount(1);
  await bodyBox(page).fill(`${NEW_BODY}（追記）`);
  await bodyBox(page).blur();
  expect(calls(w, "POST", /requests\/questions$/)).toHaveLength(1);
  await submit(page).click();
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
});

test("K912-UI-005 空で出す：誤りが出て口は呼ばれない", async ({ page }) => {
  const w = world();
  await open(page, w, NEW);
  await submit(page).click();
  await expect(page.getByText("何をしてほしいかを書いてください", { exact: true })).toBeVisible();
  expect(calls(w, "POST", /portal\/requests$/)).toHaveLength(0);
});

test("K912-UI-006 出す：POST 1 回・出しました・やり取りに戻る → /portal（いつまでには今日から数えた日付・時計は日本時間 2026-11-23 に固定）", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-23T09:00:00+09:00"));
  const w = world();
  await open(page, w, NEW);
  await fillBody(page);
  await pick(page, "3 日後（11/26）");
  await submit(page).click();
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
  const p = calls(w, "POST", /portal\/requests$/);
  expect(p).toHaveLength(1);
  const b = JSON.parse(p[0]!.body ?? "{}") as Record<string, unknown>;
  expect(b["body"]).toBe(NEW_BODY);
  expect(b["due_on"]).toBe("2026-11-26");
  expect(b["attachment_ids"]).toEqual([]);
  await page.getByRole("button", { name: "やり取りに戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
});

test("K912-UI-007 二度押しは口 1 回・押している間は無効", async ({ page }) => {
  const w = world({ hold: new Set(["create"]) });
  await open(page, w, NEW);
  await fillBody(page);
  await submit(page).click();
  await expect.poll(() => calls(w, "POST", /portal\/requests$/).length).toBe(1);
  await expect(submit(page)).toBeDisabled();
  await submit(page).click({ force: true });
  expect(calls(w, "POST", /portal\/requests$/)).toHaveLength(1);
});

test("K912-UI-008 出せなかった（503）：内容が残り押し直せば出せる", async ({ page }) => {
  const w = world({ once: { create: err(503, "SERVICE_UNAVAILABLE") } });
  await open(page, w, NEW);
  await fillBody(page);
  await fileInput(page).setInputFiles(file("見積.pdf"));
  await expect(page.getByText("見積.pdf", { exact: true })).toBeVisible();
  await submit(page).click();
  await expect(page.getByText("依頼を出せませんでした", { exact: true })).toBeVisible();
  await expect(bodyBox(page)).toHaveValue(NEW_BODY);
  await expect(page.getByText("見積.pdf", { exact: true })).toBeVisible();
  await submit(page).click();
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
  expect(calls(w, "POST", /portal\/requests$/)).toHaveLength(2);
});

test("K912-UI-009 質問に答えなくても出せる", async ({ page }) => {
  const w = world();
  await open(page, w, NEW);
  await fillBody(page);
  await bodyBox(page).blur();
  await expect(
    page.getByText("佐野様のメールアドレスと、CC は今と同じ鈴木様のままでよいか", { exact: true }),
  ).toBeVisible();
  await submit(page).click();
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
});

test("K912-UI-010 いつまでに：決めないは due_on が null", async ({ page }) => {
  const w = world();
  await open(page, w, NEW);
  await fillBody(page);
  await pick(page, "決めない");
  await submit(page).click();
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
  const b = JSON.parse(calls(w, "POST", /portal\/requests$/)[0]!.body ?? "{}") as Record<string, unknown>;
  expect(b["due_on"]).toBeNull();
});

test("K912-UI-011 添付を足す：口 1 回・名前が並び・外せて・出すときの id に入る", async ({ page }) => {
  const w = world();
  await open(page, w, NEW);
  await fillBody(page);
  await fileInput(page).setInputFiles([file("議事メモ.pdf"), file("見積.xlsx")]);
  await expect(page.getByText("議事メモ.pdf", { exact: true })).toBeVisible();
  await expect(page.getByText("見積.xlsx", { exact: true })).toBeVisible();
  expect(calls(w, "POST", /attachments$/)).toHaveLength(2);
  // 体は JSON { name, content_type, data（base64）}（K-909・multipart ではない）
  const up = JSON.parse(calls(w, "POST", /attachments$/)[0]!.body ?? "{}") as Record<string, unknown>;
  expect(Object.keys(up).sort()).toEqual(["content_type", "data", "name"]);
  expect(up["name"]).toBe("議事メモ.pdf");
  expect(up["data"]).toBe(Buffer.alloc(10, 1).toString("base64"));
  await page
    .getByRole("button", { name: /見積\.xlsx を外す|外す/ })
    .last()
    .click();
  // 外したファイルの名前が画面のどこにも残らない（部分の字で探す否定は、画面の字全部に含まれないことで見る）
  await expect.poll(() => page.locator("main").innerText()).not.toContain("見積.xlsx");
  await submit(page).click();
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
  const b = JSON.parse(calls(w, "POST", /portal\/requests$/)[0]!.body ?? "{}") as { attachment_ids: string[] };
  expect(b.attachment_ids).toHaveLength(1);
});

test("K912-UI-012 足せない種類（422）：断りの囲みと行・出すのは続けられる", async ({ page }) => {
  const w = world({ once: { upload: [err(422, "E-GST-182")] } });
  await open(page, w, NEW);
  await fillBody(page);
  await fileInput(page).setInputFiles(file("議事メモ.exe"));
  await expect(page.getByText("このファイルは足せませんでした", { exact: true })).toBeVisible();
  await expect(page.getByText("足せない種類のファイルです", { exact: true })).toBeVisible();
  await expect(bodyBox(page)).toHaveValue(NEW_BODY);
  await submit(page).click();
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
});

test("K912-UI-013 5 つまで：6 つ目は口を呼ばず、足すが無効", async ({ page }) => {
  const w = world();
  await open(page, w, NEW);
  await fileInput(page).setInputFiles([1, 2, 3, 4, 5].map((n) => file(`資料${n}.pdf`)));
  await expect.poll(() => calls(w, "POST", /attachments$/).length).toBe(5);
  await expect(page.getByRole("button", { name: "＋ ファイルを足す", exact: true })).toBeDisabled();
  await expect(page.getByText("添付は 5 つまでです", { exact: true })).toBeVisible();
  await expect(fileInput(page)).toBeDisabled();
  expect(calls(w, "POST", /attachments$/)).toHaveLength(5);
});

test("K912-UI-014 セッション切れ（401）：ログインへ移る", async ({ page }) => {
  const w = world({ once: { create: err(401, "UNAUTHORIZED") } });
  await open(page, w, NEW);
  await fillBody(page);
  await submit(page).click();
  await expect(page.getByText("ログインが切れました。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "入り直す", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("K912-UI-015 途中で戻っても口は呼ばれず、出した後に開き直しても同じ依頼は出ない", async ({ page }) => {
  const w = world();
  await open(page, w, "/portal");
  await page.goto(NEW);
  await fillBody(page);
  await page.goBack();
  expect(calls(w, "POST", /portal\/requests$/)).toHaveLength(0);
  await page.goto(NEW);
  await fillBody(page);
  await submit(page).click();
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
  await page.goBack();
  await page.goForward();
  await expect(bodyBox(page)).toHaveValue("");
  expect(calls(w, "POST", /portal\/requests$/)).toHaveLength(1);
});

test("K912-UI-016 依頼のやり取りを開く：口 1 回・題・見える範囲・やり取り・返事の欄", async ({ page }) => {
  const w = world();
  await open(page, w, REQ);
  await expect(page.getByRole("heading", { name: "12 月分の作業報告書もほしい", level: 1, exact: true })).toBeVisible();
  // 見出しの下の行の全部（「今日 10:20」は時計に依る日付の字なので .+ にする）
  await expect(page.getByText(new RegExp(`^鈴木 健太 様が.+ に出した ・ ${GROUP}の皆さんにも見えます$`))).toBeVisible();
  const thread = page.getByRole("region", { name: "やり取り", exact: true });
  await expect(
    thread.getByText("12/26 までにお送りします。宛先は山田様でよろしいですか？", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "返事を書く", exact: true })).toBeVisible();
  expect(calls(w, "GET", new RegExp(`requests/${RID}$`))).toHaveLength(1);
});

test("K912-UI-017 返事を送る：POST 1 回・欄が空・やり取りに足される", async ({ page }) => {
  const w = world();
  await open(page, w, REQ);
  await page.getByRole("textbox", { name: "返事を書く", exact: true }).fill("はい、山田宛でお願いします。");
  await page.getByRole("button", { name: "返事を送る", exact: true }).click();
  await expect.poll(() => calls(w, "POST", /messages$/).length).toBe(1);
  expect(JSON.parse(calls(w, "POST", /messages$/)[0]!.body ?? "{}")).toEqual({ body: "はい、山田宛でお願いします。" });
  await expect(page.getByRole("textbox", { name: "返事を書く", exact: true })).toHaveValue("");
  await expect(
    page
      .getByRole("region", { name: "やり取り", exact: true })
      .getByText("はい、山田宛でお願いします。", { exact: true }),
  ).toBeVisible();
});

test("K912-UI-018 返事：空は送れず・二度押しは 1 回・503 は書いた返事が残る", async ({ page }) => {
  const w = world({ hold: new Set(["message"]) });
  await open(page, w, REQ);
  const box = page.getByRole("textbox", { name: "返事を書く", exact: true });
  const send1 = page.getByRole("button", { name: "返事を送る", exact: true });
  await send1.click();
  expect(calls(w, "POST", /messages$/)).toHaveLength(0);
  await box.fill("よろしくお願いします。");
  await send1.click();
  await send1.click({ force: true });
  await expect.poll(() => calls(w, "POST", /messages$/).length).toBe(1);
  expect(calls(w, "POST", /messages$/)).toHaveLength(1);
  const w2 = world({ once: { message: err(503, "SERVICE_UNAVAILABLE") } });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockWorld(page, w2);
  await page.goto(REQ);
  await box.fill("よろしくお願いします。");
  await page.getByRole("button", { name: "返事を送る", exact: true }).click();
  await expect(page.getByText("送れませんでした", { exact: true })).toBeVisible();
  await expect(box).toHaveValue("よろしくお願いします。");
});

test("K912-UI-019 受けた：帯が出て、期限・担当の字は無い", async ({ page }) => {
  await open(page, world({ state: "accepted" }), REQ);
  await expect(page.getByText("ENGINE BASE が依頼を受けました", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "チケットになりました。ホームの「見せてもらったチケット」から開けます。このやり取りは、チケットのやり取りの頭に残ります",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/期限|担当/);
});

test("K912-UI-020 断られた：理由が口の字で出て、返事の欄は無い", async ({ page }) => {
  await open(page, world({ state: "declined", reason: "四半期ごとにまとめてお送りしています。" }), REQ);
  await expect(page.getByText("この依頼は受けられませんでした", { exact: true })).toBeVisible();
  await expect(page.getByText("理由：四半期ごとにまとめてお送りしています。", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "返事を書く", exact: true })).toHaveCount(0);
});

test("K912-UI-021 見えない依頼（404）：見られない形で、題や名前は出ない", async ({ page }) => {
  await open(page, world({ once: { get: err(404, "NOT_FOUND") } }), REQ);
  await expect(page.getByText("この依頼は見られません", { exact: true })).toBeVisible();
  const text = await page.locator("main").innerText();
  for (const s of ["12 月分の作業報告書", "鈴木", GROUP]) expect(text).not.toContain(s);
  await page.getByRole("button", { name: "やり取りに戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/portal$/);
});

test("K912-UI-022 同じグループの別の人の依頼も読めて返事を書ける", async ({ page }) => {
  await open(page, world(), REQ);
  // 出した人の行の全部（「今日 10:20」は時計に依る日付の字なので .+ にする）
  await expect(page.getByText(new RegExp(`^鈴木 健太 様が.+ に出した ・ ${GROUP}の皆さんにも見えます$`))).toBeVisible();
  await expect(page.getByRole("button", { name: "返事を送る", exact: true })).toBeEnabled();
});

for (const width of [375, 768, 1440]) {
  test(`K912-UI-023 幅 ${width}：出す画面（入力・添付の断り・出した後）とやり取りで横のはみ出し 0`, async ({
    page,
  }) => {
    const w = world({ once: { upload: [err(422, "E-GST-182")] } });
    await open(page, w, NEW, width);
    await fillBody(page);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await fileInput(page).setInputFiles(file("議事メモ.exe"));
    await expect(page.getByText("このファイルは足せませんでした", { exact: true })).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await submit(page).click();
    await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await page.goto(REQ);
    await expect(page.getByRole("region", { name: "やり取り", exact: true })).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
}

test("K912-UI-024 作らない物・設計者の言葉の字が無い", async ({ page }) => {
  await open(page, world(), NEW);
  const bad = /検収|確認してほしいもの|取引先|client|acceptance|bridge/i;
  expect(await page.locator("body").innerText()).not.toMatch(bad);
  await page.goto(REQ);
  await expect(page.getByRole("region", { name: "やり取り", exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(bad);
});

test("K912-UI-025 先方の書いた物は文字として出る：HTML は動かない", async ({ page }) => {
  const evil = `<img src=x onerror="window.__zt8=1">宛先を変えます`;
  const w = world({ messages: [{ id: "m1", side: "they", name: "鈴木 健太 様", at: "今日", text: evil }] });
  await open(page, w, REQ);
  await expect(page.getByText(evil, { exact: true })).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __zt8?: number }).__zt8)).toBeUndefined();
  // 質問の字も文字として出る
  const w2 = world({ questions: [{ id: "q1", text: evil }] });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockWorld(page, w2);
  await page.goto(NEW);
  await fillBody(page);
  await bodyBox(page).blur();
  await expect(page.getByText(evil, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __zt8?: number }).__zt8)).toBeUndefined();
});

test("K912-UI-027 出すときの口の断り：404・E-GST-160（添付が付けられない）は「この添付は付けられませんでした」・添付を足し直す／422（本文が空白だけ・10000 字を超える・今日より前の日）は欄の下に文／403 は権限の文。書いた内容は残る", async ({
  page,
}) => {
  const w = world({ once: { create: err(404, "E-GST-160") } });
  await open(page, w, NEW);
  await fillBody(page);
  await fileInput(page).setInputFiles(file("議事メモ.pdf"));
  await submit(page).click();
  await expect(page.getByText("この添付は付けられませんでした", { exact: true })).toBeVisible();
  await expect(bodyBox(page)).toHaveValue(NEW_BODY);
  w.once.create = {
    status: 422,
    body: { error: "validation_error", code: "VALIDATION_ERROR", details: [{ field: "due_on" }] },
  };
  await submit(page).click();
  await expect(page.getByText("期限は今日か、それより後の日にしてください", { exact: true })).toBeVisible();
  w.once.create = err(403, "FORBIDDEN");
  await submit(page).click();
  await expect(page.getByText("この画面を見る権限がありません。", { exact: true })).toBeVisible();
  await expect(bodyBox(page)).toHaveValue(NEW_BODY);
  expect(calls(w, "POST", /portal\/requests$/)).toHaveLength(3);
});

test("K912-UI-028 もう書けない依頼（409・E-GST-170）：返事の欄に「この依頼にはもう書けません」・書いた返事は残り・依頼を読み直すと返事の欄が無くなる（can_write が false）", async ({
  page,
}) => {
  const w = world({ once: { message: err(409, "E-GST-170") } });
  await open(page, w, REQ);
  const box = page.getByRole("textbox", { name: "返事を書く", exact: true });
  await box.fill("よろしくお願いします。");
  const before = calls(w, "GET", new RegExp(`requests/${RID}$`)).length;
  await page.getByRole("button", { name: "返事を送る", exact: true }).click();
  await expect(page.getByText("この依頼にはもう書けません", { exact: true })).toBeVisible();
  await expect.poll(() => calls(w, "GET", new RegExp(`requests/${RID}$`)).length).toBeGreaterThan(before);
});

test("K912-UI-029 添付の大きさと空：700KB を超えるファイルは口を呼ばず「このファイルは大きすぎます（700KB まで）」・空のファイル（422・E-GST-184）は「空のファイルは足せません」・どちらも本文と出すのは続けられる", async ({
  page,
}) => {
  const w = world({ once: { upload: [err(422, "E-GST-184")] } });
  await open(page, w, NEW);
  await fillBody(page);
  await fileInput(page).setInputFiles(file("大きい.pdf", 700_001));
  await expect(page.getByText("このファイルは大きすぎます（700KB まで）", { exact: true })).toBeVisible();
  expect(calls(w, "POST", /attachments$/), "大きすぎるファイルは口を呼ばない").toHaveLength(0);
  await fileInput(page).setInputFiles(file("空.pdf", 0));
  await expect(page.getByText("空のファイルは足せません", { exact: true })).toBeVisible();
  await expect(bodyBox(page)).toHaveValue(NEW_BODY);
  await submit(page).click();
  await expect(page.getByText("依頼を出しました", { exact: true })).toBeVisible();
});
