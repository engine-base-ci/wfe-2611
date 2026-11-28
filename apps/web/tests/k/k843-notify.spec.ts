// K-843「知らせの画面（/notifications）を口 getNotificationSettings・updateNotificationSettings・copyNotificationSettings につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の me-notify・me-notify-quiet・me-notify-copy・me-notify-failed（本番と同じ部品 features/F10/account/notify.tsx・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。getMe は f10-ops-kit、知らせの 3 口はこの試験の中で網の手前で差し替える。保存だけ（D-154.24）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { signupViaApi } from "../_lib/api";
import { F10_PAIRS, MOCK_BASE, WS_NAME, openAt, overflowX, toast } from "./f10-kit";
import { KYOTO_ID, SOLO_ID, WS_ID, err, me, mockOps, ok, type Me, type Reply } from "./f10-ops-kit";
import { WIDTHS } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = "/notifications";
const SEC = 'section[aria-labelledby="notify-title"]';
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
const panel = (page: Page) => page.getByRole("tabpanel");
const exactText = (s: string) => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
/** 行の名前の欄（.k-set-name）の字が name と完全に同じ行だけ（「承認を待っている」が「承認を待っている（期限が今日）」に当たらない） */
const evRow = (page: Page, name: string) =>
  panel(page)
    .locator(".k-set-row")
    .filter({ has: page.locator(".k-set-name").filter({ hasText: exactText(name) }) });
const box = (page: Page, row: string, ch: "ベル" | "メール") => evRow(page, row).getByLabel(ch, { exact: true });
const copyBtn = (page: Page) =>
  page.getByRole("button", { name: "この設定をほかのワークスペースにも写す", exact: true });
const copyDlg = (page: Page) =>
  page.getByRole("dialog", { name: "この設定をほかのワークスペースにも写す", exact: true });
const ROW_FAIL = "保存できませんでした。もう一度、押してください";
const TOP_FAIL = "保存できませんでした。通信を確かめて、もう一度押してください";

const KEYS = [
  ["approval_waiting", true, true],
  ["mentioned", true, true],
  ["handed_over", true, true],
  ["clone_stopped", true, true],
  ["clone_finished", true, false],
  ["ticket_changed", true, false],
  ["new_device", true, true],
] as const;
const NAMES = [
  "承認を待っている",
  "@ で呼ばれた・やり取りで知らせる人にされた",
  "渡された・配られた",
  "分身が止まった・落ちて直せない",
  "分身が実行を終えた",
  "自分が担当・承認するチケットが動いた",
  "新しい端末で入った",
];
interface Settings {
  workspace_id: string;
  email_digest: boolean;
  quiet_hours: { preset: string };
  paused_until: string | null;
  urgent_override: string[];
  events: { key: string; bell: boolean; mail: boolean; fixed: boolean }[];
}
const settingsOf = (id: string, o: Partial<Settings> = {}): Settings => ({
  workspace_id: id,
  email_digest: true,
  quiet_hours: { preset: "weekdays_night_weekend" },
  paused_until: null,
  urgent_override: ["approval_due_today", "clone_stopped"],
  // 答えの順は決まった順と違えて返す（画面が並べ直す）
  events: [...KEYS].reverse().map(([key, bell, mail]) => ({ key, bell, mail, fixed: key === "new_device" })),
  ...o,
});

type NOp = "get" | "patch" | "copy";
interface NCall {
  op: NOp;
  query: Record<string, string>;
  body: Record<string, unknown> | null;
}
interface NApi {
  calls: NCall[];
  count: (op: NOp, ws?: string) => number;
  last: (op: NOp) => NCall | undefined;
  queue: (op: NOp, ...r: Reply[]) => void;
  hold: (op: NOp) => () => void;
  state: Map<string, Settings>;
}
/** 次の 0:00・明日の 8:00（日本時間） */
const JST = 9 * 60 * 60 * 1000;
const nextMidnightJst = () => {
  const t = new Date(Date.now() + JST);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1) - JST).toISOString();
};
const tomorrow8Jst = () => {
  const t = new Date(Date.now() + JST);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1, 8) - JST).toISOString();
};
async function mockNotify(page: Page): Promise<NApi> {
  const state = new Map<string, Settings>([WS_ID, SOLO_ID, KYOTO_ID].map((id) => [id, settingsOf(id)]));
  const calls: NCall[] = [];
  const queues = new Map<NOp, Reply[]>();
  const holds = new Map<NOp, Promise<void>>();
  await page.route(/\/api\/v1\/me\/notification-settings/, async (route: Route, req: Request) => {
    const url = new URL(req.url());
    const op: NOp = req.method() === "GET" ? "get" : url.pathname.endsWith("/copy") ? "copy" : "patch";
    const body = req.method() === "GET" ? null : ((req.postDataJSON() as Record<string, unknown> | null) ?? null);
    const c: NCall = { op, query: Object.fromEntries(url.searchParams.entries()), body };
    calls.push(c);
    const held = holds.get(op);
    if (held) await held;
    const q = queues.get(op);
    let r: Reply;
    if (q?.length) r = q.shift()!;
    else if (op === "get") r = ok(state.get(c.query["workspace_id"] ?? WS_ID));
    else if (op === "patch") {
      const id = String(body?.["workspace_id"] ?? WS_ID);
      const cur = state.get(id)!;
      const evs = (body?.["events"] as Settings["events"] | undefined) ?? [];
      const pause = body?.["pause"];
      const next: Settings = {
        ...cur,
        ...(body?.["quiet_hours"] ? { quiet_hours: body["quiet_hours"] as Settings["quiet_hours"] } : {}),
        ...(body?.["urgent_override"] ? { urgent_override: body["urgent_override"] as string[] } : {}),
        ...(pause === undefined
          ? {}
          : {
              paused_until:
                pause === null
                  ? null
                  : pause === "today"
                    ? nextMidnightJst()
                    : pause === "tomorrow_morning"
                      ? tomorrow8Jst()
                      : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }),
        events: cur.events.map((e) => {
          const hit = evs.find((x) => x.key === e.key);
          return hit ? { ...e, bell: hit.bell, mail: hit.mail } : e;
        }),
      };
      state.set(id, next);
      r = ok(next);
    } else {
      const from = state.get(String(body?.["from_workspace_id"]))!;
      const to = (body?.["to_workspace_ids"] as string[]) ?? [];
      for (const id of to)
        state.set(id, { ...from, workspace_id: id, paused_until: state.get(id)?.paused_until ?? null });
      r = ok({ copied_to: to }, 201);
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return {
    calls,
    state,
    count: (op, ws) =>
      calls.filter((c) => c.op === op && (!ws || (c.query["workspace_id"] ?? c.body?.["workspace_id"]) === ws)).length,
    last: (op) => calls.filter((c) => c.op === op).at(-1),
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
async function start(page: Page, o: { me?: Me } = {}, width = 1440) {
  const mk = await mockOps(page, o.me ? { me: o.me } : {});
  const nt = await mockNotify(page);
  await openAt(page, owner.token, PATH, width);
  await expect(page.locator(SEC)).toBeVisible();
  return { mk, nt };
}

// ---------------------------------------------------------------- モックとの突き合わせ
const PAIRS = F10_PAIRS.filter((p) =>
  [
    "sub",
    "sub-item",
    "h1",
    "acts",
    "band",
    "callout",
    "card",
    "row-set",
    "dialog",
    "dialog-title",
    "dialog-btn",
  ].includes(p.name),
);
const STATES: Record<string, ((page: Page, nt: NApi) => Promise<void>) | undefined> = {
  "me-notify": undefined,
  "me-notify-quiet": async (page) => {
    await panel(page).getByRole("button", { name: "今日いっぱい", exact: true }).click();
    await expect(panel(page)).toContainText("いま止めています ・ 今日いっぱい");
    await panel(page).getByRole("button", { name: "静かにする時間を選ぶ", exact: true }).click();
  },
  "me-notify-copy": async (page) => {
    await copyBtn(page).click();
    await expect(copyDlg(page)).toBeVisible();
  },
  "me-notify-failed": async (page, nt) => {
    nt.queue("patch", err(503, "E-PAGE-003"));
    await box(page, NAMES[1]!, "ベル").click();
    await expect(page.getByText(TOP_FAIL, { exact: true })).toBeVisible();
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K843-UI-001 ${id} 幅 ${w}：第 2 ナビ・見出し・出来事・静かにする時間・帯・赤い箱・写す小窓の位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockOps(page);
          const nt = await mockNotify(page);
          await openAt(page, owner.token, PATH, w);
          await expect(page.locator(SEC)).toBeVisible();
          await expect(evRow(page, NAMES[0]!)).toBeVisible();
          await drive?.(page, nt);
        },
        { pairs: PAIRS, base: MOCK_BASE },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く・タブ
test("K843-UI-002 /notifications を直に開くと今の会社の workspace_id で 1 回読む・見出し「お知らせ」・パンくずの今の場所「お知らせ」・第 2 ナビの「お知らせ」が今の場所（D-152.11・K-1113 の決め）・タブは会社の順で今の会社が選ばれている", async ({
  page,
}) => {
  const { nt } = await start(page);
  await expect(page.locator(SEC).getByRole("heading", { level: 1, name: "お知らせ", exact: true })).toBeVisible();
  await expect(page.locator('.k-me-sub a[aria-current="page"]')).toHaveText("お知らせ");
  await expect(page.getByRole("navigation", { name: "いまの場所" }).locator('[aria-current="page"]')).toHaveText(
    "お知らせ",
  );
  await expect(page.getByRole("tab")).toHaveText(["株式会社ENGINE BASE", "高本 聖斗（個人）", "京蟻システム株式会社"]);
  await expect(tab(page, "株式会社ENGINE BASE")).toHaveAttribute("aria-selected", "true");
  await expect(evRow(page, NAMES[0]!)).toBeVisible();
  expect(nt.count("get")).toBe(1);
  expect(nt.calls[0]!.query["workspace_id"]).toBe(WS_ID);
});

test("K843-UI-003 出来事は 7 行（覚えたいことの知らせは無い）が決まった順で字と補足は下絵のとおり・チェックは答えの値・「新しい端末で入った」の 2 つは押せない", async ({
  page,
}) => {
  await start(page);
  await expect(panel(page).locator(".k-set-row .k-set-name").first()).toHaveText(NAMES[0]!);
  for (const [i, n] of NAMES.entries()) {
    const [, bell, mail] = KEYS[i]!;
    if (bell) await expect(box(page, n, "ベル")).toBeChecked();
    if (mail) await expect(box(page, n, "メール")).toBeChecked();
    else await expect(box(page, n, "メール")).not.toBeChecked();
  }
  await expect(evRow(page, "承認を待っている")).toContainText("自分が承認する人のとき");
  await expect(box(page, "新しい端末で入った", "ベル")).toBeDisabled();
  await expect(box(page, "新しい端末で入った", "メール")).toBeDisabled();
  await expect(evRow(page, "新しい端末で入った")).toContainText("安全のため止められない");
  await expect(panel(page).locator(".k-set-row").filter({ hasText: "覚えたいこと" })).toHaveCount(0);
});

test("K843-UI-004 別のタブを開くとその workspace_id で 1 回読む・前のタブに戻っても読み直さない", async ({ page }) => {
  const { nt } = await start(page);
  await tab(page, "京蟻システム株式会社").click();
  await expect(evRow(page, NAMES[0]!)).toBeVisible();
  expect(nt.count("get", KYOTO_ID)).toBe(1);
  await tab(page, "株式会社ENGINE BASE").click();
  await tab(page, "京蟻システム株式会社").click();
  await expect(evRow(page, NAMES[0]!)).toBeVisible();
  expect(nt.count("get", WS_ID)).toBe(1);
  expect(nt.count("get", KYOTO_ID)).toBe(1);
});

// ---------------------------------------------------------------- 押したら保存
test("K843-UI-005 「分身が実行を終えた」のメールを押すとその行だけ 1 回送る・開き直しても真", async ({ page }) => {
  const { nt } = await start(page);
  await box(page, "分身が実行を終えた", "メール").click();
  await expect(box(page, "分身が実行を終えた", "メール")).toBeChecked();
  await expect.poll(() => nt.count("patch")).toBe(1);
  expect(nt.last("patch")!.body).toEqual({
    workspace_id: WS_ID,
    events: [{ key: "clone_finished", bell: true, mail: true }],
  });
  await page.reload();
  await expect(box(page, "分身が実行を終えた", "メール")).toBeChecked();
});

test("K843-UI-006 保存の失敗（503）はチェックが戻り、行の補足と上の赤い箱・次の成功で両方消える。409 E-ME-040 は戻して赤い箱に口の文", async ({
  page,
}) => {
  const { nt } = await start(page);
  nt.queue("patch", err(503, "E-PAGE-003"));
  await box(page, NAMES[1]!, "メール").click();
  await expect(page.getByText(TOP_FAIL, { exact: true })).toBeVisible();
  await expect(evRow(page, NAMES[1]!)).toContainText(ROW_FAIL);
  await expect(box(page, NAMES[1]!, "メール")).toBeChecked();
  await box(page, NAMES[1]!, "メール").click();
  await expect(box(page, NAMES[1]!, "メール")).not.toBeChecked();
  await expect(page.getByText(TOP_FAIL, { exact: true })).toHaveCount(0);
  await expect(evRow(page, NAMES[1]!)).not.toContainText(ROW_FAIL);

  nt.queue("patch", err(409, "E-ME-040", { message: "この知らせは安全のため止められません" }));
  await box(page, NAMES[2]!, "ベル").click();
  await expect(page.getByText("この知らせは安全のため止められません", { exact: false })).toBeVisible();
  await expect(box(page, NAMES[2]!, "ベル")).toBeChecked();
});

test("K843-UI-007 静かにする時間の ▾ に 4 つ・「毎日 20:00〜8:00」を選ぶと preset every_night を 1 回・ボタンの字が替わる", async ({
  page,
}) => {
  const { nt } = await start(page);
  await panel(page).getByRole("button", { name: "静かにする時間を選ぶ", exact: true }).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "平日 20:00〜8:00 ・ 土日",
    "毎日 20:00〜8:00",
    "土日だけ",
    "使わない",
  ]);
  await page.getByRole("menuitem", { name: "毎日 20:00〜8:00", exact: true }).click();
  await expect(panel(page).getByRole("button", { name: "静かにする時間を選ぶ", exact: true })).toContainText(
    "毎日 20:00〜8:00 ▾",
  );
  expect(nt.count("patch")).toBe(1);
  expect(nt.last("patch")!.body).toEqual({ workspace_id: WS_ID, quiet_hours: { preset: "every_night" } });
});

test("K843-UI-008 「今日いっぱい」で pause today・帯「いま止めています ・ 今日いっぱい」・［止めるのをやめる］で pause null・帯が消える", async ({
  page,
}) => {
  const { nt } = await start(page);
  await panel(page).getByRole("button", { name: "今日いっぱい", exact: true }).click();
  await expect(panel(page)).toContainText("いま止めています ・ 今日いっぱい");
  await expect(panel(page)).toContainText("メールは止まっています。受け箱にはたまります");
  expect(nt.last("patch")!.body).toEqual({ workspace_id: WS_ID, pause: "today" });
  await panel(page).getByRole("button", { name: "止めるのをやめる", exact: true }).click();
  await expect(panel(page)).not.toContainText("いま止めています");
  expect(nt.last("patch")!.body).toEqual({ workspace_id: WS_ID, pause: null });
  expect(nt.count("patch")).toBe(2);
});

test("K843-UI-009 paused_until が明日の 8:00 なら「明日の朝まで」・ほかは「HH:mm まで」・過ぎていれば帯を出さない", async ({
  page,
}) => {
  const { nt } = await start(page);
  await panel(page).getByRole("button", { name: "明日の朝まで", exact: true }).click();
  await expect(panel(page)).toContainText("いま止めています ・ 明日の朝まで");
  await panel(page).getByRole("button", { name: "1 時間", exact: true }).click();
  await expect(panel(page)).toContainText(/いま止めています ・ \d{2}:\d{2} まで/);
  nt.state.set(KYOTO_ID, settingsOf(KYOTO_ID, { paused_until: new Date(Date.now() - 60 * 1000).toISOString() }));
  await tab(page, "京蟻システム株式会社").click();
  await expect(evRow(page, NAMES[0]!)).toBeVisible();
  await expect(panel(page)).not.toContainText("いま止めています");
});

test("K843-UI-010 止めていても知らせるの「分身が止まった」を外すと urgent_override に approval_due_today だけを 1 回", async ({
  page,
}) => {
  const { nt } = await start(page);
  await panel(page).getByLabel("分身が止まった", { exact: true }).click();
  await expect(panel(page).getByLabel("分身が止まった", { exact: true })).not.toBeChecked();
  expect(nt.count("patch")).toBe(1);
  expect(nt.last("patch")!.body).toEqual({ workspace_id: WS_ID, urgent_override: ["approval_due_today"] });
});

// ---------------------------------------------------------------- 写す
test("K843-UI-011 写す：ほかの会社が並び初めは選ばない・1 つ選ぶと［写す］が押せる・1 回送る・201 で閉じて知らせ・写した先のタブは 1 回読み直す", async ({
  page,
}) => {
  const { nt } = await start(page);
  await tab(page, "京蟻システム株式会社").click();
  await expect(evRow(page, NAMES[0]!)).toBeVisible();
  await tab(page, "株式会社ENGINE BASE").click();
  await copyBtn(page).click();
  await expect(copyDlg(page)).toContainText(
    "いま開いている「株式会社ENGINE BASE」のお知らせの受け方を、選んだ場所に写します",
  );
  await expect(copyDlg(page).getByRole("checkbox")).toHaveCount(2);
  await expect(copyDlg(page).getByLabel("株式会社ENGINE BASE", { exact: true })).toHaveCount(0);
  const go = copyDlg(page).getByRole("button", { name: "写す", exact: true });
  await expect(go).toBeDisabled();
  await copyDlg(page).getByLabel("京蟻システム株式会社", { exact: true }).check();
  await go.click();
  await expect(copyDlg(page)).toHaveCount(0);
  await expect(toast(page)).toContainText("1 つのワークスペースに写しました");
  expect(nt.last("copy")!.body).toEqual({ from_workspace_id: WS_ID, to_workspace_ids: [KYOTO_ID] });
  await tab(page, "京蟻システム株式会社").click();
  await expect(evRow(page, NAMES[0]!)).toBeVisible();
  expect(nt.count("get", KYOTO_ID)).toBe(2);
});

test("K843-UI-012 写すの失敗：503 は小窓の中に E-PAGE-003 の文で開いたまま・404 は E-PAGE-001 の文で自分を読み直す", async ({
  page,
}) => {
  const { mk, nt } = await start(page);
  nt.queue("copy", err(503, "E-PAGE-003"), err(404, "E-PAGE-001"));
  await copyBtn(page).click();
  await copyDlg(page).getByLabel("京蟻システム株式会社", { exact: true }).check();
  await copyDlg(page).getByRole("button", { name: "写す", exact: true }).click();
  await expect(copyDlg(page)).toContainText("Kaname の調子が悪くなっています");
  await copyDlg(page).getByRole("button", { name: "写す", exact: true }).click();
  await expect(copyDlg(page)).toContainText("見つかりませんでした。消されたか、見る権限が無いかもしれません");
  await expect.poll(() => mk.count("me")).toBe(2);
  expect(nt.count("copy")).toBe(2);
});

test("K843-UI-013 ワークスペースが 1 つ：［この設定をほかのワークスペースにも写す］は aria-disabled・押しても小窓が開かない", async ({
  page,
}) => {
  const one = me();
  await start(page, { me: { ...one, workspaces: one.workspaces.filter((w) => w.current) } });
  await expect(copyBtn(page)).toHaveAttribute("aria-disabled", "true");
  await copyBtn(page).click({ force: true });
  await expect(copyDlg(page)).toHaveCount(0);
});

test("K843-UI-014 タブの読みが 503 ならそのタブに「もう一度読む」・押すと出る（口 2 回）・ほかのタブは使える。404 は E-PAGE-001 の文", async ({
  page,
}) => {
  const { nt } = await start(page);
  nt.queue("get", err(503, "E-PAGE-003"));
  await tab(page, "京蟻システム株式会社").click();
  await expect(panel(page)).toContainText("Kaname の調子が悪くなっています");
  await tab(page, "株式会社ENGINE BASE").click();
  await expect(evRow(page, NAMES[0]!)).toBeVisible();
  await tab(page, "京蟻システム株式会社").click();
  await panel(page).getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(evRow(page, NAMES[0]!)).toBeVisible();
  expect(nt.count("get", KYOTO_ID)).toBe(2);

  nt.queue("get", err(404, "E-PAGE-001"));
  await tab(page, "高本 聖斗（個人）").click();
  await expect(panel(page)).toContainText("見つかりませんでした。消されたか、見る権限が無いかもしれません");
});

// ---------------------------------------------------------------- 揺れ・ログイン・幅・口の数
test("K843-UI-015 二度押し：保存の答えを待つ間その行のチェックは押せず、続けて押しても口は 1 回", async ({ page }) => {
  const { nt } = await start(page);
  const release = nt.hold("patch");
  await box(page, NAMES[4]!, "メール").click();
  await expect(box(page, NAMES[4]!, "メール")).toBeDisabled();
  await box(page, NAMES[4]!, "メール").click({ force: true });
  release();
  await expect(box(page, NAMES[4]!, "メール")).toBeEnabled();
  expect(nt.count("patch")).toBe(1);
});

test("K843-UI-016 保存の口が 401：入り直し（/login）へ送られる・口は 1 回", async ({ page }) => {
  const { nt } = await start(page);
  nt.queue("patch", err(401, "E-PAGE-002"));
  await box(page, NAMES[4]!, "メール").click();
  await expect(page).toHaveURL(/\/login/);
  expect(nt.count("patch")).toBe(1);
});

test("K843-UI-017 幅 320・375・768・1024・1440：横のはみ出し 0（数値）。100 字の会社名のタブ・写す小窓を開いても 0", async ({
  page,
}) => {
  const base = me();
  const long: Me = {
    ...base,
    workspaces: base.workspaces.map((w) => (w.tenant_id === KYOTO_ID ? { ...w, name: "長".repeat(100) } : w)),
  };
  for (const w of WIDTHS) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await start(page, { me: long }, w);
    await expect(evRow(page, NAMES[0]!)).toBeVisible();
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    await copyBtn(page).click();
    await expect(copyDlg(page)).toBeVisible();
    expect(await overflowX(page), `幅 ${w} 小窓`).toBe(0);
  }
});

test("K843-UI-018 二重の口なし：StrictMode でも getMe は 1 回・タブごとの読みは 1 回・保存のあとに読み直さない", async ({
  page,
}) => {
  const { mk, nt } = await start(page);
  await expect(evRow(page, NAMES[0]!)).toBeVisible();
  await box(page, NAMES[4]!, "メール").click();
  await expect.poll(() => nt.count("patch")).toBe(1);
  expect(mk.count("me")).toBe(1);
  expect(nt.count("get")).toBe(1);
});

test("K843-UI-019 送る体の鍵は決まった物だけ（paused_until・email_digest・人を指す欄を送らない）", async ({ page }) => {
  const { nt } = await start(page);
  await box(page, NAMES[4]!, "メール").click();
  await panel(page).getByRole("button", { name: "1 時間", exact: true }).click();
  await panel(page).getByLabel("分身が止まった", { exact: true }).click();
  await copyBtn(page).click();
  await copyDlg(page).getByLabel("京蟻システム株式会社", { exact: true }).check();
  await copyDlg(page).getByRole("button", { name: "写す", exact: true }).click();
  await expect(copyDlg(page)).toHaveCount(0);
  const allowed = new Set([
    "workspace_id",
    "events",
    "quiet_hours",
    "pause",
    "urgent_override",
    "from_workspace_id",
    "to_workspace_ids",
  ]);
  const keys = nt.calls.filter((c) => c.body).flatMap((c) => Object.keys(c.body!));
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.filter((k) => !allowed.has(k))).toEqual([]);
  expect(nt.count("patch")).toBe(3);
});

test("K843-UI-020 幅 375：タブ・出来事のチェック・［写す］のボタンが見えて押せる", async ({ page }) => {
  const { nt } = await start(page, {}, 375);
  await expect(tab(page, "株式会社ENGINE BASE")).toBeVisible();
  await expect(copyBtn(page)).toBeVisible();
  await box(page, NAMES[4]!, "メール").click();
  await expect.poll(() => nt.count("patch")).toBe(1);
});
