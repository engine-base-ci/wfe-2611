// K-972「運営の 1 社の画面：中を見る・止める・再開・お知らせを送るの小窓」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops の op-peek・op-peek-open・op-stop・op-stopped・op-ws-notice（この葉が持ち主）。
//   部品は features/F12/ops/tenant-dialogs.tsx・tenant-frame.tsx（K-941 が運ぶ）。口は網の手前で差し替える（ops-mock.ts・ops-ws-mock.ts・K-971）。
//   本人確認の取り直しは前からの口（getMySecurity・stepUp・K-318）と StepUp の小窓。パスキーは仮の認証器（ops-mock.ts の signInOps が付けた物）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-972.md の表と 1 対 1
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps } from "./ops-mock";
import { count, mockWs, type WsMock } from "./ops-ws-mock";
import { WS_ID, WS_INQUIRIES, wsOf } from "./ops-ws-answers";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
// ▾ は部品 components/k の Select（Base UI）。素の <select> は無いので、▾ を押して開いた portal の role=option を押す・数える
async function choose(page: Page, sel: Locator, label: string): Promise<void> {
  await sel.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
/** 小窓と帯の役（1 社の頭とタブは K-971 の受け持ち） */
const PAIRS: FidelityPair[] = [
  pair("dialog", "[role='dialog']", BOX),
  pair("dtitle", "[role='dialog'] h2", ["x", "y", ...TEXT]),
  pair("field", "[role='dialog'] .k-field", BOX),
  pair("fieldset", "[role='dialog'] .k-op-fieldset", BOX),
  pair("callout", "[role='dialog'] .k-callout", [...BOX, "texts"]),
  pair("dacts", "[role='dialog'] .k-dialog-actions, [role='dialog'] footer", BOX),
  pair("band", ".k-band", [...BOX, "texts"]),
  pair("badge", ".k-page-head .k-badge", ["width", "height", "color", "background-color", "texts"]),
];
const PATH = `/ops/tenants/${WS_ID}`;
const CAPS = ["inquiry", "money", "peek", "stop", "notice"];
const PEEK = { id: "0193c5a0-0000-7000-8000-000000097201" };

async function open(page: Page, baseURL: string | undefined, width = 1440, caps: string[] = CAPS): Promise<WsMock> {
  const ops = await mockOps(page);
  ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: "op", caps } }) } });
  const ws = await mockWs(page);
  await page.route(/\/api\/v1\/(me\/security|auth\/step-up)$/, async (route, req) => {
    const p = new URL(req.url()).pathname;
    ws.calls.push(`${req.method()} ${p}`);
    const body = p.endsWith("/me/security")
      ? { data: { has_password: false, two_factor: false, two_factor_required: false, mfa_pending: false } }
      : { data: { step_up_at: new Date().toISOString() } };
    await route.fulfill({
      status: p.endsWith("/me/security") ? 200 : 201,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await signInOps(page, local(baseURL), PATH, width);
  await expect(page.locator(".k-page-head h1")).toHaveText("合同会社ミナト企画");
  return ws;
}
const dialog = (page: Page, title: string) =>
  page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const jstDay = (days: number): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(Date.now() + days * 86_400_000));
const md = (iso: string) => `${Number(iso.slice(5, 7))}/${iso.slice(8, 10)}`;
const inMin = (n: number) => new Date(Date.now() + n * 60_000).toISOString();

test.describe("K-972 小窓と帯の見た目", () => {
  const STATES: [string, string, (p: Page, ws: WsMock) => Promise<void>][] = [
    ["K972-UI-001", "op-peek", async (p) => void (await btn(p, "中を見る").click())],
    ["K972-UI-002", "op-peek-open", async () => undefined],
    [
      "K972-UI-003",
      "op-stop",
      async (p) => {
        await p.getByRole("button", { name: "そのほかの操作", exact: true }).click();
        await p.getByRole("menuitem", { name: "止める", exact: true }).click();
      },
    ],
    ["K972-UI-004", "op-stopped", async () => undefined],
    ["K972-UI-005", "op-ws-notice", async (p) => void (await btn(p, "お知らせを送る").click())],
  ];
  STATES.forEach(([row, id, drive]) => {
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}・小窓か帯と頭の札）`, async ({ browser, baseURL }) => {
        const { bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            const ws = await mockWsFor(page, baseURL, w, id);
            await drive(page, ws);
          },
          { base: "/dev/mock/f12-ops", pairs: PAIRS },
        );
        expect(bad, bad.join("\n")).toEqual([]);
      });
  });
});

/** 状態に合う 1 社の答えで開く（中を見ている間・止めている） */
async function mockWsFor(page: Page, baseURL: string | undefined, w: number, id: string): Promise<WsMock> {
  const ops = await mockOps(page);
  ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: "op", caps: CAPS } }) } });
  const ws = await mockWs(page);
  if (id === "op-peek-open")
    ws.on.ws = () => ({
      status: 200,
      body: {
        data: wsOf({ peek: { id: PEEK.id, expires_at: inMin(38), reason: "問い合わせ「承認したのに動かない」" } }),
      },
    });
  if (id === "op-stopped")
    ws.on.ws = () => ({
      status: 200,
      body: {
        data: wsOf({
          state: "stopped",
          stop: {
            reason_key: "unpaid",
            stop_on: "2026-11-09",
            stopped_at: "2026-11-08T15:00:00Z",
            noticed_at: "2026-11-02T00:00:00Z",
          },
        }),
      },
    });
  await signInOps(page, local(baseURL), PATH, w);
  await expect(page.locator(".k-page-head h1")).toHaveText("合同会社ミナト企画");
  return ws;
}

test.describe("K-972 中を見る", () => {
  test("K972-UI-006 開く：［中を見る］で小窓。理由は その会社の開いている問い合わせ・障害の調べ・請求の確認・ほか、見る時間は 30 分・1 時間（既定 1 時間）。［見るだけで開く］で口を 1 回（理由の字・60・inquiry_id）・帯が出て 1 社を読み直す", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    const sent = `問い合わせ「${WS_INQUIRIES[0]!.title}」`;
    ws.on.peekOpen = () => {
      ws.on.ws = () => ({
        status: 200,
        body: { data: wsOf({ peek: { id: PEEK.id, expires_at: inMin(60), reason: sent } }) },
      });
      return {
        status: 201,
        body: { data: { id: PEEK.id, workspace_id: WS_ID, reason: sent, expires_at: inMin(60), closed_at: null } },
      };
    };
    await btn(page, "中を見る").click();
    const d = dialog(page, "中を見る");
    await d.getByRole("combobox", { name: "見る時間", exact: true }).click();
    await expect(page.getByRole("option")).toHaveText([/^✓?30 分$/, /^✓?1 時間$/]);
    await page.keyboard.press("Escape");
    await d.getByRole("button", { name: "見るだけで開く", exact: true }).click();
    const band = page.locator(".k-band").filter({ hasText: "合同会社ミナト企画 の中を見ています（見るだけ）" });
    await expect(band).toBeVisible();
    await expect(band).toContainText(`理由：${sent}`);
    expect(ws.bodies.peekOpen).toEqual([
      { reason: `問い合わせ「${WS_INQUIRIES[0]!.title}」`, minutes: 60, inquiry_id: WS_INQUIRIES[0]!.id },
    ]);
    expect(count(ws, `GET /api/v1/ops/workspaces/${WS_ID}`) - count(ws, `GET /api/v1/ops/workspaces/${WS_ID}/`)).toBe(
      2,
    );
  });

  test("K972-UI-007 本人確認の取り直し：403 STEP_UP_REQUIRED なら getMySecurity を 1 回・「本人か確かめます」・［パスキーで確かめる］で stepUp を 1 回・開く口をもう 1 回（同じ体）", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    let n = 0;
    ws.on.peekOpen = () =>
      ++n === 1
        ? { status: 403, body: { error: "forbidden", code: "STEP_UP_REQUIRED" } }
        : {
            status: 201,
            body: { data: { id: PEEK.id, workspace_id: WS_ID, reason: "x", expires_at: inMin(60), closed_at: null } },
          };
    await btn(page, "中を見る").click();
    await dialog(page, "中を見る").getByRole("button", { name: "見るだけで開く", exact: true }).click();
    await dialog(page, "本人か確かめます").getByRole("button", { name: "パスキーで確かめる", exact: true }).click();
    await expect(dialog(page, "中を見る")).toHaveCount(0);
    // やり直しの口は取り直しの答えの後に出る（小窓が閉じた時点ではまだのことがある）
    await expect
      .poll(() => [count(ws, "GET /api/v1/me/security"), count(ws, "POST /api/v1/auth/step-up"), n])
      .toEqual([1, 1, 2]);
    expect(ws.bodies.peekOpen![1]).toEqual(ws.bodies.peekOpen![0]);
  });

  test("K972-UI-008 もう開いている（409 E-OPS-001）：小窓の中に「このワークスペースはもう開いています」の赤い箱・小窓は閉じない", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    ws.on.peekOpen = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-001" } });
    await btn(page, "中を見る").click();
    const d = dialog(page, "中を見る");
    await d.getByRole("button", { name: "見るだけで開く", exact: true }).click();
    await expect(d.getByRole("alert")).toContainText("このワークスペースはもう開いています");
    await expect(d).toBeVisible();
  });

  test("K972-UI-009 見ている間の帯：残り 38 分と理由。［閉じる］で閉じる口を 1 回（道の id は peek.id）・帯が消える。もう閉じていた（409 E-OPS-002）ときも読み直して帯が消える", async ({
    page,
    baseURL,
  }) => {
    const ws = await mockWsFor(page, baseURL, 1440, "op-peek-open");
    const band = page.locator(".k-band").filter({ hasText: "の中を見ています" });
    await expect(band).toContainText(/残り 3[78] 分/);
    ws.on.peekClose = () => {
      ws.on.ws = () => ({ status: 200, body: { data: wsOf() } });
      return { status: 409, body: { error: "conflict", code: "E-OPS-002" } };
    };
    await band.getByRole("button", { name: "閉じる", exact: true }).click();
    await expect(band).toHaveCount(0);
    expect(count(ws, `DELETE /api/v1/ops/peeks/${PEEK.id}`)).toBe(1);
  });
});

test.describe("K-972 止める・再開", () => {
  const openStop = async (page: Page) => {
    await page.getByRole("button", { name: "そのほかの操作", exact: true }).click();
    await page.getByRole("menuitem", { name: "止める", exact: true }).click();
    return dialog(page, "止める");
  };

  test("K972-UI-010 止める小窓：理由は 4 つ（請求が払われない・規約に反する・危ない使い方をしている・管理者から頼まれた）・既定は先に知らせて 7 日後・ボタンは「<M/D> に止める」", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    const d = await openStop(page);
    await d.getByRole("combobox", { name: "理由", exact: true }).click();
    await expect(page.getByRole("option")).toHaveText([
      /^✓?請求が払われない$/,
      /^✓?規約に反する$/,
      /^✓?危ない使い方をしている$/,
      /^✓?管理者から頼まれた$/,
    ]);
    await page.keyboard.press("Escape");
    await expect(d.getByLabel("止める日", { exact: true })).toHaveValue(jstDay(7));
    await expect(d.getByRole("button", { name: `${md(jstDay(7))} に止める`, exact: true })).toBeVisible();
  });

  test("K972-UI-011 日を決めて止める：管理者へのお知らせを書いて押すと口を 1 回（unpaid・scheduled・stop_on・admin_notice）・小窓が閉じ「<M/D> に止めます」と出る", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    ws.on.stop = () => ({
      status: 201,
      body: {
        data: wsOf({
          stop: { reason_key: "unpaid", stop_on: jstDay(7), stopped_at: null, noticed_at: new Date().toISOString() },
        }),
      },
    });
    const d = await openStop(page);
    await d.getByLabel("管理者へのお知らせ", { exact: true }).fill("お支払いが確かめられていません");
    await d.getByRole("button", { name: `${md(jstDay(7))} に止める`, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: `${md(jstDay(7))} に止めます` })).toBeVisible();
    expect(ws.bodies.stop).toEqual([
      { reason_key: "unpaid", mode: "scheduled", stop_on: jstDay(7), admin_notice: "お支払いが確かめられていません" },
    ]);
  });

  test("K972-UI-012 すぐ止めるは規約に反する・危ないときだけ選べる：請求が払われないでは押せない形。規約に反するに替えて選ぶとボタンは「すぐ止める」・体に stop_on が無い・止めている形（札「止めている」・帯・再開する）になる", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    ws.on.stop = () => ({
      status: 201,
      body: {
        data: wsOf({
          state: "stopped",
          stop: { reason_key: "violation", stop_on: jstDay(0), stopped_at: new Date().toISOString(), noticed_at: null },
        }),
      },
    });
    const d = await openStop(page);
    const now = d.getByRole("radio", { name: /すぐ止める/ });
    await expect(now).toBeDisabled();
    await choose(page, d.getByRole("combobox", { name: "理由", exact: true }), "規約に反する");
    await now.check();
    await d.getByRole("button", { name: "すぐ止める", exact: true }).click();
    await expect(page.locator(".k-band").filter({ hasText: "このワークスペースは止めています" })).toBeVisible();
    await expect(page.locator(".k-page-head").getByText(/^止めている/)).toBeVisible();
    expect(ws.bodies.stop).toEqual([{ reason_key: "violation", mode: "now" }]);
  });

  test("K972-UI-013 止める断り：もう止める日が決まっている（409 E-OPS-003）・止める日が今日以前（409 E-OPS-006）は小窓の中の赤い箱に errors の字", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    const d = await openStop(page);
    for (const [code, text] of [
      ["E-OPS-003", "このワークスペースはもう止める日が決まっているか、止めています"],
      ["E-OPS-006", "止める日は明日以降にしてください"],
    ] as const) {
      ws.on.stop = () => ({ status: 409, body: { error: "conflict", code } });
      await d.getByRole("button", { name: `${md(jstDay(7))} に止める`, exact: true }).click();
      await expect(d.getByRole("alert")).toContainText(text);
    }
  });

  test("K972-UI-014 再開：止めている帯の［再開する］で口を 1 回（体 {}）・使っている に戻り帯が消える", async ({
    page,
    baseURL,
  }) => {
    const ws = await mockWsFor(page, baseURL, 1440, "op-stopped");
    const band = page.locator(".k-band").filter({ hasText: "このワークスペースは止めています" });
    await expect(band).toContainText("請求が払われない");
    ws.on.resume = () => ({ status: 201, body: { data: wsOf() } });
    await band.getByRole("button", { name: "再開する", exact: true }).click();
    await expect(band).toHaveCount(0);
    await expect(page.locator(".k-page-head").getByText("使っている", { exact: true })).toBeVisible();
    expect(ws.bodies.resume).toEqual([{}]);
  });
});

test.describe("K-972 お知らせを送る", () => {
  test("K972-UI-015 送る：題・本文・出す場所（画面の上の帯・お知らせの一覧・どちらも）を書いて［送る］で口を 1 回（placements は帯なら ['band']）・小窓が閉じ「送りました」", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    ws.on.notice = () => ({ status: 201, body: { data: { id: "n1" } } });
    await btn(page, "お知らせを送る").click();
    const d = dialog(page, "お知らせを送る");
    await d.getByRole("combobox", { name: "出す場所", exact: true }).click();
    await expect(page.getByRole("option")).toHaveText([/^✓?画面の上の帯$/, /^✓?お知らせの一覧$/, /^✓?どちらも$/]);
    await page.keyboard.press("Escape");
    await d.getByLabel("題", { exact: true }).fill("請求書の宛名のご確認");
    await d.getByLabel("本文", { exact: true }).fill("宛名を変えました");
    await d.getByRole("button", { name: "送る", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "送りました" })).toBeVisible();
    expect(ws.bodies.notice).toEqual([
      { title: "請求書の宛名のご確認", body: "宛名を変えました", placements: ["band"] },
    ]);
  });

  test("K972-UI-020 誰に「管理者だけ」：出す場所は「お知らせの一覧」になり「画面の上の帯」「どちらも」は選べない（D-156.57）・送ると体に admins_only true と placements ['list']", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    ws.on.notice = () => ({ status: 201, body: { data: { id: "n2" } } });
    await btn(page, "お知らせを送る").click();
    const d = dialog(page, "お知らせを送る");
    await d.getByRole("radio", { name: /^管理者だけ/ }).check();
    const where = d.getByRole("combobox", { name: "出す場所", exact: true });
    await expect(where).toContainText("お知らせの一覧");
    await where.click();
    await expect(page.getByRole("option", { name: "画面の上の帯", exact: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.getByRole("option", { name: "どちらも", exact: true })).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");
    await d.getByLabel("題", { exact: true }).fill("値段が変わります");
    await d.getByLabel("本文", { exact: true }).fill("来年 4 月から値段が変わります");
    await d.getByRole("button", { name: "送る", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "送りました" })).toBeVisible();
    expect(ws.bodies.notice).toEqual([
      { title: "値段が変わります", body: "来年 4 月から値段が変わります", placements: ["list"], admins_only: true },
    ]);
  });

  test("K972-UI-016 送る前の守り：題か本文が空（空白だけを含む）のうちは［送る］が押せない・口を呼ばない。送れない（503）は小窓の中の赤い箱で、書いた字は残る", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    ws.on.notice = () => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    await btn(page, "お知らせを送る").click();
    const d = dialog(page, "お知らせを送る");
    await d.getByLabel("題", { exact: true }).fill("   ");
    await expect(d.getByRole("button", { name: "送る", exact: true })).toBeDisabled();
    await d.getByLabel("題", { exact: true }).fill("お知らせ");
    await d.getByLabel("本文", { exact: true }).fill("本文");
    await d.getByRole("button", { name: "送る", exact: true }).click();
    await expect(d.getByRole("alert")).toBeVisible();
    await expect(d.getByLabel("本文", { exact: true })).toHaveValue("本文");
    expect(count(ws, `POST /api/v1/ops/workspaces/${WS_ID}/notices`)).toBe(1);
  });
});

test.describe("K-972 守りと幅", () => {
  test("K972-UI-017 できることが無い：peek・stop・notice を持たない人には［中を見る］［お知らせを送る］［⋯ › 止める］が押せない形（隠さない）で、押しても口を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL, 1440, ["inquiry"]);
    for (const n of ["中を見る", "お知らせを送る"]) await expect(btn(page, n)).toHaveAttribute("aria-disabled", "true");
    await btn(page, "中を見る").click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "そのほかの操作", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "止める", exact: true })).toHaveAttribute("aria-disabled", "true");
    expect(ws.calls.filter((c) => c.startsWith("POST")).length).toBe(0);
  });

  test("K972-UI-018 やめる：3 つの小窓とも［やめる］と Esc で閉じ、口を呼ばない", async ({ page, baseURL }) => {
    const ws = await open(page, baseURL);
    await btn(page, "中を見る").click();
    await dialog(page, "中を見る").getByRole("button", { name: "やめる", exact: true }).click();
    await btn(page, "お知らせを送る").click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "そのほかの操作", exact: true }).click();
    await page.getByRole("menuitem", { name: "止める", exact: true }).click();
    await dialog(page, "止める").getByRole("button", { name: "やめる", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.calls.filter((c) => c.startsWith("POST")).length).toBe(0);
  });

  test("K972-UI-021 1 社の答えの欄を使う：小窓の対象の人数は members.count（PC の数ではない）・帯の理由は ws.peek.reason。reason が null なら、この画面で開いた直後は送った理由・開き直した後は理由を出さない", async ({
    page,
    baseURL,
  }) => {
    const ws = await open(page, baseURL);
    const many = { members: { count: 9 }, pc: { connected: 2, total: 3 } };
    const peekBand = () => page.locator(".k-band").filter({ hasText: "の中を見ています" });
    ws.on.ws = () => ({ status: 200, body: { data: wsOf(many) } });
    await page.reload();
    await expect(page.locator(".k-page-head h1")).toHaveText("合同会社ミナト企画");
    await btn(page, "中を見る").click();
    const d = dialog(page, "中を見る");
    await expect(d).toContainText("合同会社ミナト企画 ・ 9 人");
    await expect(d).not.toContainText("・ 3 人");
    const sent = `問い合わせ「${WS_INQUIRIES[0]!.title}」`;
    const nullPeek = { ...many, peek: { id: PEEK.id, expires_at: inMin(60), reason: null } };
    ws.on.peekOpen = () => {
      ws.on.ws = () => ({ status: 200, body: { data: wsOf(nullPeek) } });
      return {
        status: 201,
        body: { data: { id: PEEK.id, workspace_id: WS_ID, reason: sent, expires_at: inMin(60), closed_at: null } },
      };
    };
    await d.getByRole("button", { name: "見るだけで開く", exact: true }).click();
    await expect(peekBand()).toContainText(`理由：${sent}`);
    await page.reload();
    await expect(page.locator(".k-page-head h1")).toHaveText("合同会社ミナト企画");
    await expect(peekBand()).toBeVisible();
    await expect(peekBand()).not.toContainText("理由：");
    ws.on.ws = () => ({
      status: 200,
      body: { data: wsOf({ ...many, peek: { id: PEEK.id, expires_at: inMin(30), reason: "請求の確認" } }) },
    });
    await page.reload();
    await expect(page.locator(".k-page-head h1")).toHaveText("合同会社ミナト企画");
    await expect(peekBand()).toContainText("理由：請求の確認");
  });

  test("K972-UI-019 幅と字：320・375・768・1440 で 3 つの小窓と止めている帯の横のはみ出しが 0 以下。取引先・業務の型・書き出・CSV の字が無い", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    for (const w of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      for (const name of ["中を見る", "お知らせを送る"]) {
        await btn(page, name).click();
        expect(await overflowX(page), `${w} ${name}`).toBeLessThanOrEqual(0);
        expect(await page.getByRole("dialog").innerText()).not.toMatch(FORBIDDEN);
        await page.keyboard.press("Escape");
      }
    }
  });
});
