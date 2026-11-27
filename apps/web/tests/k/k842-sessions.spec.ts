// K-842「ログインと安全の『入っている端末』『最近の安全の記録』を口 listMySessions・revokeMySession・revokeOtherSessions につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の me-sessions・me-session-revoke（本番と同じ部品 features/F10/account/login.tsx・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。本人確認の読み（getMySecurity）と取り直し（step-up）は f10-ops-kit、端末の 3 口はこの試験の中で網の手前で差し替える。
//   切る 2 口は本人確認を取り直す（D-154.52）。記録の画面へのリンクは置かない（D-154.2）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { signupViaApi } from "../_lib/api";
import { MOCK_BASE, WS_NAME, openAt, overflowX, passStepUp, stepDlg, toast } from "./f10-kit";
import { err, mockOps, ok, type Reply } from "./f10-ops-kit";
import { WIDTHS } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const PATH = "/mfa-setup";
const H = 60 * 60 * 1000;
const D = 24 * H;
const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const devices = (page: Page) => card(page, "入っている端末");
const events = (page: Page) => card(page, "最近の安全の記録");
const rowOf = (page: Page, name: string) => devices(page).locator(".k-set-row").filter({ hasText: name });
const allBtn = (page: Page) => devices(page).getByRole("button", { name: "この端末以外をすべて切る", exact: true });
const dlg = (page: Page) => page.getByRole("dialog").filter({ hasText: "本人確認して切る" });
const confirmBtn = (page: Page) => dlg(page).getByRole("button", { name: "本人確認して切る", exact: true });

interface Sess {
  id: string;
  kind: "web" | "bridge" | "api";
  name: string;
  place: string | null;
  issued_at: string;
  last_seen_at: string;
  current: boolean;
}
interface Ev {
  id: string;
  kind: string;
  occurred_at: string;
  device: string | null;
  place: string | null;
}
const iso = (ms: number) => new Date(ms).toISOString();
const OCT30 = "2026-10-30T09:00:00.000Z"; // 日本時間 10/30 18:00
const now = Date.now();
// 「今日 HH:mm」を見る行の時刻：今の日本時間の 0:00 と今のまん中（0:00 のすぐ後に流しても前の日にならない）
const JST = 9 * 60 * 60 * 1000;
const jstMidnight = Math.floor((now + JST) / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000) - JST;
const TODAY_EARLIER = jstMidnight + Math.floor((now - jstMidnight) / 2);
const MAC: Sess = {
  id: "0193c5a0-0000-7000-8000-0000000d0001",
  kind: "web",
  name: "MacBook Pro ・ Chrome",
  place: "東京",
  issued_at: iso(now - 3 * D),
  last_seen_at: iso(now),
  current: true,
};
const IPHONE: Sess = {
  id: "0193c5a0-0000-7000-8000-0000000d0002",
  kind: "web",
  name: "iPhone ・ Kaname アプリ",
  place: "東京",
  issued_at: iso(now - 5 * D),
  last_seen_at: iso(now - 2 * H - 60 * 1000),
  current: false,
};
const WIN: Sess = {
  id: "0193c5a0-0000-7000-8000-0000000d0003",
  kind: "web",
  name: "Windows ・ Edge",
  place: "大阪",
  issued_at: OCT30,
  last_seen_at: OCT30,
  current: false,
};
const PC: Sess = {
  id: "0193c5a0-0000-7000-8000-0000000d0004",
  kind: "bridge",
  name: "高本の MacBook（PC）",
  place: "東京",
  issued_at: iso(now - 2 * D),
  last_seen_at: iso(now - 10 * 60 * 1000),
  current: false,
};
const EVENTS: Ev[] = [
  { id: "e1", kind: "step_up", occurred_at: iso(TODAY_EARLIER), device: null, place: null },
  { id: "e2", kind: "suspicious_connection", occurred_at: OCT30, device: "Windows ・ Edge", place: "大阪" },
  { id: "e3", kind: "something_new_kind", occurred_at: OCT30, device: null, place: null },
];

type SessOp = "list" | "revoke" | "others";
interface SessApi {
  count: (op: SessOp) => number;
  ids: string[];
  state: { sessions: Sess[]; events: Ev[] };
  queue: (op: SessOp, ...r: Reply[]) => void;
  hold: (op: SessOp) => () => void;
}
/** 端末の 3 口の差し替え（f10-ops-kit の後に足す・こちらが先に当たる） */
async function mockSessions(page: Page, o: { sessions?: Sess[]; events?: Ev[] } = {}): Promise<SessApi> {
  const st = { sessions: o.sessions ?? [MAC, IPHONE, WIN], events: o.events ?? EVENTS };
  const counts: Record<SessOp, number> = { list: 0, revoke: 0, others: 0 };
  const ids: string[] = [];
  const queues = new Map<SessOp, Reply[]>();
  const holds = new Map<SessOp, Promise<void>>();
  await page.route(/\/api\/v1\/me\/sessions/, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const op: SessOp | null =
      req.method() === "GET" && p.endsWith("/me/sessions")
        ? "list"
        : req.method() === "DELETE"
          ? "revoke"
          : req.method() === "POST" && p.endsWith("/revoke-others")
            ? "others"
            : null;
    if (!op) return route.fallback();
    counts[op] += 1;
    const id = p.split("/").at(-1)!;
    if (op === "revoke") ids.push(id);
    const held = holds.get(op);
    if (held) await held;
    const q = queues.get(op);
    let r: Reply;
    if (q?.length) r = q.shift()!;
    else if (op === "list") r = ok({ sessions: st.sessions, events: st.events });
    else if (op === "revoke") {
      st.sessions = st.sessions.filter((s) => s.id !== id);
      st.events = [
        { id: `r${ids.length}`, kind: "sessions_revoked", occurred_at: iso(Date.now()), device: null, place: null },
        ...st.events,
      ];
      r = ok({ revoked: true });
    } else {
      const n = st.sessions.filter((s) => !s.current).length;
      st.sessions = st.sessions.filter((s) => s.current);
      r = ok({ revoked: n }, 201);
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return {
    count: (op) => counts[op],
    ids,
    state: st,
    queue: (op, ...r) => void queues.set(op, [...(queues.get(op) ?? []), ...r]),
    hold: (op) => {
      let open = () => {};
      holds.set(op, new Promise<void>((res) => (open = res)));
      return () => open();
    },
  };
}

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});
async function start(page: Page, o: { sessions?: Sess[]; events?: Ev[]; passkeyOnly?: boolean } = {}, width = 1440) {
  const mk = await mockOps(page);
  if (o.passkeyOnly)
    mk.set("security", () =>
      ok({
        passkeys: [
          { id: "pk1", name: "MacBook Pro（Touch ID）", created_at: OCT30, last_used_at: OCT30, synced: false },
        ],
        has_password: false,
        two_factor: false,
        backup_codes_left: null,
        two_factor_required: false,
        mfa_pending: false,
      }),
    );
  const ss = await mockSessions(page, o);
  await openAt(page, owner.token, PATH, width);
  await expect(devices(page)).toBeVisible();
  return { mk, ss };
}

// ---------------------------------------------------------------- モックとの突き合わせ
const BOX = ["width", "height", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const fp = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const PAIRS: FidelityPair[] = [
  fp("devices", 'section[aria-labelledby="lg-sessions"]', BOX),
  fp("dev-row", 'section[aria-labelledby="lg-sessions"] .k-set-row', ["height", "texts"]),
  fp("dev-btn", 'section[aria-labelledby="lg-sessions"] button', ["width", "height", "font-size", "color", "texts"]),
  fp("events", 'section[aria-labelledby="lg-events"]', BOX),
  fp("ev-row", 'section[aria-labelledby="lg-events"] .k-set-row', ["height"]),
  fp("dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]),
  fp("dialog-title", ".k-dialog h2", ["x", ...TEXT]),
  fp("dialog-btn", ".k-dialog button[data-variant]", ["font-size", "color", "background-color", "texts"]),
];
const STATES: Record<string, ((page: Page) => Promise<void>) | undefined> = {
  "me-sessions": undefined,
  "me-session-revoke": async (page) => {
    await rowOf(page, "Windows ・ Edge").getByRole("button", { name: "切る", exact: true }).click();
    await expect(dlg(page)).toBeVisible();
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K842-UI-001 ${id} 幅 ${w}：「入っている端末」「最近の安全の記録」の区画・行・札・確かめの小窓の位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockOps(page);
          await mockSessions(page, { events: [EVENTS[0]!, EVENTS[1]!, EVENTS[1]!, EVENTS[0]!] });
          await openAt(page, owner.token, PATH, w);
          await expect(devices(page)).toBeVisible();
          await drive?.(page);
        },
        { pairs: PAIRS, base: MOCK_BASE },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 一覧
test("K842-UI-002 /mfa-setup を直に開くと listMySessions を 1 回・答えの順に端末の行・今の端末に「この端末」の札があり「切る」が無い・ほかの端末には「切る」・パスキーの区画は前のまま", async ({
  page,
}) => {
  const { ss } = await start(page);
  await expect(devices(page).locator(".k-set-row .k-set-name")).toHaveText([MAC.name, IPHONE.name, WIN.name]);
  await expect(rowOf(page, MAC.name)).toContainText("この端末");
  await expect(rowOf(page, MAC.name).getByRole("button", { name: "切る", exact: true })).toHaveCount(0);
  for (const s of [IPHONE, WIN])
    await expect(rowOf(page, s.name).getByRole("button", { name: "切る", exact: true })).toBeVisible();
  await expect(card(page, "パスキー")).toBeVisible();
  expect(ss.count("list")).toBe(1);
});

test("K842-UI-003 2 行目の字：「東京 ・ いま」「東京 ・ 2 時間前」「大阪 ・ 10/30」・場所が null なら「場所は分からない」・iPhone の名前は電話の絵", async ({
  page,
}) => {
  const noPlace: Sess = {
    ...IPHONE,
    id: "0193c5a0-0000-7000-8000-0000000d0009",
    name: "Android ・ Chrome",
    place: null,
    last_seen_at: iso(now - 15 * 60 * 1000),
  };
  await start(page, { sessions: [MAC, IPHONE, WIN, noPlace] });
  await expect(rowOf(page, MAC.name)).toContainText("東京 ・ いま");
  await expect(rowOf(page, IPHONE.name)).toContainText("東京 ・ 2 時間前");
  await expect(rowOf(page, WIN.name)).toContainText("大阪 ・ 10/30");
  await expect(rowOf(page, noPlace.name)).toContainText("場所は分からない ・ 15 分前");
  await expect(rowOf(page, IPHONE.name).locator("svg.lucide-smartphone")).toHaveCount(1);
  await expect(rowOf(page, WIN.name).locator("svg.lucide-monitor")).toHaveCount(1);
});

test("K842-UI-004 最後に使ったのが 7 日より前の端末だけ「見覚えは？」の札と「・ 覚えがなければ切る」・6 日前の端末には出ない", async ({
  page,
}) => {
  const six: Sess = {
    ...IPHONE,
    id: "0193c5a0-0000-7000-8000-0000000d0008",
    name: "iPad ・ Safari",
    last_seen_at: iso(now - 6 * D),
  };
  await start(page, { sessions: [MAC, six, WIN] });
  await expect(rowOf(page, WIN.name)).toContainText("見覚えは？");
  await expect(rowOf(page, WIN.name)).toContainText("覚えがなければ切る");
  await expect(rowOf(page, six.name)).not.toContainText("見覚えは？");
  await expect(rowOf(page, six.name)).not.toContainText("覚えがなければ切る");
  await expect(rowOf(page, MAC.name)).not.toContainText("見覚えは？");
});

// ---------------------------------------------------------------- 1 つ切る
test("K842-UI-005 「切る」→ 確かめ「<名前> を切ります」・説明に場所と M/D・「本人確認して切る」で revokeMySession を道の id で 1 回・200 で閉じ「<名前> を切りました」・一覧を 1 回読み直し・行が消える", async ({
  page,
}) => {
  const { ss } = await start(page);
  await rowOf(page, WIN.name).getByRole("button", { name: "切る", exact: true }).click();
  await expect(dlg(page)).toContainText(`${WIN.name} を切ります`);
  await expect(dlg(page)).toContainText("大阪 で 10/30 に入った端末です。切ると、この端末は入り直すまで使えません");
  await confirmBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(toast(page)).toContainText(`${WIN.name} を切りました`);
  await expect(rowOf(page, WIN.name)).toHaveCount(0);
  expect(ss.count("revoke")).toBe(1);
  expect(ss.ids).toEqual([WIN.id]);
  expect(ss.count("list")).toBe(2);
});

test("K842-UI-006 切る口が 403 STEP_UP_REQUIRED：確かめが閉じ「本人か確かめます」の小窓・パスワードで通ると同じ口を 1 回だけやり直して切れる（口は合わせて 2 回）", async ({
  page,
}) => {
  const { mk, ss } = await start(page);
  ss.queue("revoke", err(403, "STEP_UP_REQUIRED"));
  await rowOf(page, IPHONE.name).getByRole("button", { name: "切る", exact: true }).click();
  await confirmBtn(page).click();
  await expect(stepDlg(page)).toContainText("端末を切る前に、本人か確かめます");
  await passStepUp(page);
  await expect(stepDlg(page)).toHaveCount(0);
  await expect(rowOf(page, IPHONE.name)).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(1);
  expect(ss.ids).toEqual([IPHONE.id, IPHONE.id]);
});

test("K842-UI-007 取り直しで「やめる」は口 1 回のまま・行は残る。2 回目も 403 なら口は 2 回で止まり、確かめの小窓に口の文", async ({
  page,
}) => {
  const { mk, ss } = await start(page);
  ss.queue("revoke", err(403, "STEP_UP_REQUIRED"));
  await rowOf(page, IPHONE.name).getByRole("button", { name: "切る", exact: true }).click();
  await confirmBtn(page).click();
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stepDlg(page)).toHaveCount(0);
  await expect(rowOf(page, IPHONE.name)).toHaveCount(1);
  expect(ss.count("revoke")).toBe(1);
  expect(mk.count("stepUp")).toBe(0);

  ss.queue(
    "revoke",
    err(403, "STEP_UP_REQUIRED"),
    err(403, "STEP_UP_REQUIRED", { message: "本人確認をもう一度してください" }),
  );
  await rowOf(page, IPHONE.name).getByRole("button", { name: "切る", exact: true }).click();
  await confirmBtn(page).click();
  await passStepUp(page);
  await expect(dlg(page)).toContainText("本人確認をもう一度してください");
  expect(ss.count("revoke")).toBe(3);
  await expect(rowOf(page, IPHONE.name)).toHaveCount(1);
});

// ---------------------------------------------------------------- この端末以外をすべて切る
test("K842-UI-008 「この端末以外をすべて切る」→ 確かめ・説明にほかの端末の名前・押すと revokeOtherSessions を 1 回・201 で「2 台の端末を切りました」・読み直すと今の端末だけ", async ({
  page,
}) => {
  const { ss } = await start(page);
  await allBtn(page).click();
  await expect(dlg(page)).toContainText("この端末以外をすべて切ります");
  await expect(dlg(page)).toContainText(`${IPHONE.name}と${WIN.name} が切れます。この端末はそのまま使えます`);
  await confirmBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(toast(page)).toContainText("2 台の端末を切りました");
  await expect(devices(page).locator(".k-set-row .k-set-name")).toHaveText([MAC.name]);
  expect(ss.count("others")).toBe(1);
  expect(ss.count("list")).toBe(2);
});

test("K842-UI-009 すべて切る口が 403 STEP_UP_REQUIRED：取り直しが通ると 1 回だけやり直して切れる（口は合わせて 2 回）", async ({
  page,
}) => {
  const { mk, ss } = await start(page);
  ss.queue("others", err(403, "STEP_UP_REQUIRED"));
  await allBtn(page).click();
  await confirmBtn(page).click();
  await passStepUp(page);
  await expect(devices(page).locator(".k-set-row .k-set-name")).toHaveText([MAC.name]);
  expect(mk.count("stepUp")).toBe(1);
  expect(ss.count("others")).toBe(2);
});

test("K842-UI-010 ほかの端末が無い：「この端末以外をすべて切る」は aria-disabled・押しても口を呼ばず小窓も開かない", async ({
  page,
}) => {
  const { ss } = await start(page, { sessions: [MAC] });
  await expect(allBtn(page)).toHaveAttribute("aria-disabled", "true");
  await allBtn(page).click({ force: true });
  await expect(dlg(page)).toHaveCount(0);
  expect(ss.count("others")).toBe(0);
});

test("K842-UI-011 PC（kind bridge）を切る確かめの説明に「PC の接続も切れ、この PC で動いている分身の仕事は止まります」", async ({
  page,
}) => {
  await start(page, { sessions: [MAC, PC] });
  await rowOf(page, PC.name).getByRole("button", { name: "切る", exact: true }).click();
  await expect(dlg(page)).toContainText("PC の接続も切れ、この PC で動いている分身の仕事は止まります");
  await expect(dlg(page)).not.toContainText("場所は分からない");
});

// ---------------------------------------------------------------- 断り・失敗
test("K842-UI-012 409 E-ME-030 は小窓の中に正本の文で開いたまま・読み直さない。404 は小窓が閉じ、読み直し、知らせに E-PAGE-001 の文", async ({
  page,
}) => {
  const { ss } = await start(page);
  ss.queue("revoke", err(409, "E-ME-030"), err(404, "E-PAGE-001"));
  await rowOf(page, IPHONE.name).getByRole("button", { name: "切る", exact: true }).click();
  await confirmBtn(page).click();
  await expect(dlg(page)).toContainText("この端末は切れません。ログアウトを使ってください");
  expect(ss.count("list")).toBe(1);
  await confirmBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(
    page.getByText("見つかりませんでした。消されたか、見る権限が無いかもしれません", { exact: false }),
  ).toBeVisible();
  expect(ss.count("list")).toBe(2);
  expect(ss.count("revoke")).toBe(2);
});

test("K842-UI-013 切る口が 503・網の切れ：小窓の中に E-PAGE-003 の文・開いたまま・行は残る・もう一度押すと切れる", async ({
  page,
}) => {
  const { ss } = await start(page);
  ss.queue("revoke", err(503, "E-PAGE-003"));
  await rowOf(page, WIN.name).getByRole("button", { name: "切る", exact: true }).click();
  await confirmBtn(page).click();
  await expect(dlg(page)).toContainText("Kaname の調子が悪くなっています");
  await expect(rowOf(page, WIN.name)).toHaveCount(1);
  await page.route(/\/api\/v1\/me\/sessions\/[^/]+$/, (r) =>
    r.request().method() === "DELETE" ? r.abort() : r.fallback(),
  );
  await confirmBtn(page).click();
  await expect(dlg(page)).toContainText("Kaname の調子が悪くなっています");
  await page.unroute(/\/api\/v1\/me\/sessions\/[^/]+$/);
  await confirmBtn(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(rowOf(page, WIN.name)).toHaveCount(0);
  expect(ss.count("revoke")).toBe(2);
});

test("K842-UI-014 一覧が 503：「入っている端末」の区画に調子が悪い形と「もう一度読む」・押すと一覧が出る（口 2 回）・パスキーの区画は出ている", async ({
  page,
}) => {
  await mockOps(page);
  const ss = await mockSessions(page);
  ss.queue("list", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await expect(devices(page)).toContainText("Kaname の調子が悪くなっています");
  await expect(card(page, "パスキー")).toBeVisible();
  await devices(page).getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(rowOf(page, IPHONE.name)).toBeVisible();
  expect(ss.count("list")).toBe(2);
});

// ---------------------------------------------------------------- 記録
test("K842-UI-015 最近の安全の記録：答えの順に字と時刻・今日は「今日 HH:mm」・知らない kind は「安全に関わる操作をした」・内部の名前が無い・記録の画面へのリンクが無い・0 件は「まだ記録はありません」", async ({
  page,
}) => {
  await start(page);
  const rows = events(page).locator(".k-set-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("本人確認を取り直した");
  await expect(rows.nth(0)).toContainText(/今日 \d{2}:\d{2}/);
  await expect(rows.nth(1)).toContainText("場所か端末が急に変わったので、入り直しにした（Windows ・ Edge）");
  await expect(rows.nth(1)).toContainText("10/30 18:00");
  await expect(rows.nth(2)).toContainText("安全に関わる操作をした");
  const text = await page.locator("main").innerText();
  for (const raw of ["step_up", "suspicious_connection", "something_new_kind", "sessions_revoked"])
    expect(text).not.toContain(raw);
  await expect(page.locator('main a[href^="/audit"], main a[href^="/workspace/log"]')).toHaveCount(0);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await start(page, { events: [] });
  await expect(events(page)).toContainText("まだ記録はありません");
});

// ---------------------------------------------------------------- 揺れ・ログイン・幅
test("K842-UI-016 二度押し：「本人確認して切る」を続けて 2 回押しても口は 1 回", async ({ page }) => {
  const { ss } = await start(page);
  const release = ss.hold("revoke");
  await rowOf(page, WIN.name).getByRole("button", { name: "切る", exact: true }).click();
  await confirmBtn(page).click();
  await confirmBtn(page).click({ force: true });
  release();
  await expect(dlg(page)).toHaveCount(0);
  expect(ss.count("revoke")).toBe(1);
});

test("K842-UI-017 切る口が 401：入り直し（/login）へ送られる・口は 1 回", async ({ page }) => {
  const { ss } = await start(page);
  ss.queue("revoke", err(401, "E-PAGE-002"));
  await rowOf(page, WIN.name).getByRole("button", { name: "切る", exact: true }).click();
  await confirmBtn(page).click();
  await expect(page).toHaveURL(/\/login/);
  expect(ss.count("revoke")).toBe(1);
});

test("K842-UI-018 幅 320・375・768・1024・1440：横のはみ出し 0（数値）。長い端末の名前・確かめの小窓を開いても 0", async ({
  page,
}) => {
  const long: Sess = { ...WIN, id: "0193c5a0-0000-7000-8000-0000000d0007", name: "とても長い端末の名前".repeat(8) };
  for (const w of WIDTHS) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await start(page, { sessions: [MAC, IPHONE, long] }, w);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    await rowOf(page, long.name).getByRole("button", { name: "切る", exact: true }).click();
    await expect(dlg(page)).toBeVisible();
    expect(await overflowX(page), `幅 ${w} 小窓`).toBe(0);
  }
});

test("K842-UI-019 二重の口なし：StrictMode でも開いたとき listMySessions は 1 回・getMySecurity は 1 回・取り直しで getMySecurity を読み直さない", async ({
  page,
}) => {
  const { mk, ss } = await start(page);
  await expect(rowOf(page, IPHONE.name)).toBeVisible();
  expect(ss.count("list")).toBe(1);
  expect(mk.count("security")).toBe(1);
  ss.queue("revoke", err(403, "STEP_UP_REQUIRED"));
  await rowOf(page, IPHONE.name).getByRole("button", { name: "切る", exact: true }).click();
  await confirmBtn(page).click();
  await passStepUp(page);
  await expect(rowOf(page, IPHONE.name)).toHaveCount(0);
  expect(mk.count("security")).toBe(1);
});

test("K842-UI-020 パスキーだけの人：取り直しの小窓はパスキーで確かめる形（パスワードの欄が無い）", async ({ page }) => {
  const { ss } = await start(page, { passkeyOnly: true });
  ss.queue("revoke", err(403, "STEP_UP_REQUIRED"));
  await rowOf(page, IPHONE.name).getByRole("button", { name: "切る", exact: true }).click();
  await confirmBtn(page).click();
  await expect(stepDlg(page)).toContainText("この端末のパスキー（指・顔・PC のロック）で確かめます");
  await expect(stepDlg(page).getByLabel("パスワード", { exact: true })).toHaveCount(0);
  expect(ss.count("revoke")).toBe(1);
});

test("K842-UI-021 幅 375：区画の「切る」「この端末以外をすべて切る」が見えて押せ、確かめの小窓が画面の中に出る", async ({
  page,
}) => {
  await start(page, {}, 375);
  await expect(allBtn(page)).toBeVisible();
  await rowOf(page, IPHONE.name).getByRole("button", { name: "切る", exact: true }).click();
  const box = (await dlg(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
});
