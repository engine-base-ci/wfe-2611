// K-821「メンバーの 1 人を一時的に止める・戻す（確かめの小窓）と、2 段階認証を戻す（押せない形）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の md-suspend・md-resume・md-2fa-reset（本番と同じ部品 features/F10/member・代表 OK 2026-11-22。2 段階認証を戻すは後のフェーズ・D-154.3）。
//   ログイン・外枠・役は本物。メンバーの 1 人（getMember・K-810）・止める（suspendMember）・戻す（resumeMember）（K-814）・メンバーの並び・本人確認の取り直しだけを網の手前で差し替える（f10-kit.ts）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { signupViaApi } from "../_lib/api";
import {
  F10_PAIRS,
  ID,
  MOCK_BASE,
  WS_NAME,
  detailBody,
  err,
  mockApi,
  ok,
  openAt,
  overflowX,
  passStepUp,
  stepDlg,
  toast,
  type Api,
} from "./f10-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = `/members/${ID.suzuki}`;
const PATH_S = `/members/${ID.yamaguchi}`;
const member = (o: Record<string, unknown>) => ({ ...detailBody().data.member, ...o });
const SUSP = {
  member: member({
    id: ID.yamaguchi,
    name: "山口 健",
    email: "yamaguchi@engine-base.example",
    role: "viewer",
    suspended: true,
    suspended_at: "2026-11-01T08:40:00Z",
    role_changed: null,
  }),
  groups: [{ id: ID.JD, name: "受託開発", code: "JD", primary: true, role: "viewer" }],
  assigned: { tickets: 0, overdue: 0, stuck: 0, handing: 0 },
  clone: { pc: "none", pc_days_away: null, device: null },
};
const APP_USER = {
  member: member({ id: ID.tanaka, name: "田中 美咲", email: "tanaka@engine-base.example" }),
  login: { passkeys: 0, has_password: true, two_factor: true, last_login_at: "2026-11-02T00:12:00Z" },
};
const stopDlg = (page: Page) =>
  page.getByRole("alertdialog", { name: "鈴木 一郎 さんを一時的に止めますか", exact: true });
const backDlg = (page: Page) => page.getByRole("alertdialog", { name: "山口 健 さんを戻しますか", exact: true });
const stopBtn = (page: Page) => page.getByRole("button", { name: "一時的に止める", exact: true });
const backBtn = (page: Page) => page.getByRole("button", { name: "戻す", exact: true });
const go = (d: ReturnType<typeof stopDlg>, label: string) => d.getByRole("button", { name: label, exact: true });
const stateBody = (suspended: boolean) => (c: { id: string }) =>
  ok({ member_id: c.id, suspended, suspended_at: suspended ? "2026-11-23T09:00:00Z" : null });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});
async function openAs(page: Page, path: string, detail?: Record<string, unknown>, width = 1440): Promise<Api> {
  const mk = await mockApi(page, detail ? { detail } : {});
  await openAt(page, owner.token, path, width);
  await expect(page.locator("main h1, section h1").first()).toBeVisible();
  return mk;
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const STATES: Record<string, { path: string; detail?: Record<string, unknown>; drive: (page: Page) => Promise<void> }> =
  {
    "md-suspend": {
      path: PATH,
      drive: async (page) => {
        await stopBtn(page).click();
        await expect(stopDlg(page)).toBeVisible();
      },
    },
    "md-resume": {
      path: PATH_S,
      detail: SUSP,
      drive: async (page) => {
        await backBtn(page).click();
        await expect(backDlg(page)).toBeVisible();
      },
    },
    "md-2fa-reset": { path: `/members/${ID.tanaka}`, detail: APP_USER, drive: async () => {} },
  };
for (const [id, st] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K821-UI-001 ${id} 幅 ${w}：確かめの小窓・止まっている帯・ログインの区画（2 段階認証を戻すは押せない形）の字と位置と大きさがモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await openAs(page, st.path, st.detail, w);
          await st.drive(page);
        },
        // 頭の「ワークスペースから外す」は、小窓の登録（K-822）が無い間は本番で押せない形（aria-disabled・不透明度 0.55）、
        //   下絵は押せる形なので、頭のボタンの濃さと色は比べない（数・大きさ・字は比べる）
        { pairs: F10_PAIRS, base: MOCK_BASE, blur: true, skip: ["acts:opacity", "acts:color"] },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 止める
test("K821-UI-002 「一時的に止める」で確かめの小窓：題「鈴木 一郎 さんを一時的に止めますか」・本文「入れなくなり、分身も止まります。担当しているチケットはそのままです。いつでも戻せます」・ボタン「本人確認して止める」「やめる」・開いたときの焦点は「やめる」。?do=suspend でも開く。やめると口 0 回", async ({
  page,
}) => {
  const mk = await openAs(page, PATH);
  await stopBtn(page).click();
  await expect(stopDlg(page)).toContainText(
    "入れなくなり、分身も止まります。担当しているチケットはそのままです。いつでも戻せます",
  );
  await expect(go(stopDlg(page), "やめる")).toBeFocused();
  await go(stopDlg(page), "やめる").click();
  await expect(stopDlg(page)).toHaveCount(0);
  await expect(stopBtn(page)).toBeFocused();
  expect(mk.count("suspend")).toBe(0);
  await page.goto(`${PATH}?do=suspend`);
  await expect(stopDlg(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));
});

test("K821-UI-003 止める：POST /members/<id>/suspend を体 {} で 1 回・確かめが閉じ・知らせ「鈴木 一郎 を一時的に止めました」・詳細を読み直して帯「一時的に止まっています」が出て「一時的に止める」が消え「戻す」が出る・メンバーの並びの読み直しの印を付ける", async ({
  page,
}) => {
  const mk = await openAs(page, PATH);
  mk.set("suspend", stateBody(true));
  await stopBtn(page).click();
  mk.set("getMember", () => ({
    status: 200,
    body: detailBody({ member: member({ suspended: true, suspended_at: "2026-11-23T09:00:00Z" }) }),
  }));
  await go(stopDlg(page), "本人確認して止める").click();
  await expect(toast(page)).toContainText("鈴木 一郎 を一時的に止めました");
  await expect(stopDlg(page)).toHaveCount(0);
  expect(mk.of("suspend")).toHaveLength(1);
  expect(mk.last("suspend")!.id).toBe(ID.suzuki);
  expect(mk.last("suspend")!.body).toEqual({});
  await expect(page.locator(".k-band")).toContainText("一時的に止まっています");
  await expect(stopBtn(page)).toHaveCount(0);
  await expect(backBtn(page)).toBeVisible();
  expect(mk.count("getMember")).toBe(2);
});

test("K821-UI-004 本人確認の取り直し：403 STEP_UP_REQUIRED で小窓（「鈴木 一郎 を一時的に止める前に、本人か確かめます」）→ パスワードで確かめると stepUp 1 回 → 同じ口をもう 1 回だけ。やめると何も送らず、確かめの小窓に戻る", async ({
  page,
}) => {
  const mk = await openAs(page, PATH);
  mk.set("suspend", stateBody(true));
  mk.queue("suspend", err(403, "STEP_UP_REQUIRED"), err(403, "STEP_UP_REQUIRED"));
  await stopBtn(page).click();
  await go(stopDlg(page), "本人確認して止める").click();
  await expect(stepDlg(page)).toContainText("鈴木 一郎 を一時的に止める前に、本人か確かめます");
  expect(mk.count("security")).toBe(1);
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stopDlg(page)).toBeVisible();
  expect(mk.count("stepUp")).toBe(0);
  await go(stopDlg(page), "本人確認して止める").click();
  await passStepUp(page);
  await expect(toast(page)).toBeVisible();
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.count("suspend")).toBe(3);
});

test("K821-UI-005 最後の管理者を止める（409 E-MEM-004）：確かめを閉じ、上の赤い箱「止められません」「佐藤 花子は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、止めてください」・帯は出ない", async ({
  page,
}) => {
  const mk = await openAs(page, `/members/${ID.sato}`, {
    member: member({ id: ID.sato, name: "佐藤 花子", role: "admin" }),
  });
  mk.queue("suspend", err(409, "E-MEM-004"));
  await stopBtn(page).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "本人確認して止める", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.locator(".k-callout")).toContainText("止められません");
  await expect(page.locator(".k-callout")).toContainText(
    "佐藤 花子は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、止めてください",
  );
  await expect(page.locator(".k-band")).toHaveCount(0);
});

test("K821-UI-006 止められない・もう止まっている：409 E-MEM-009（別のタブで止めた）→ 赤い箱 info と詳細の読み直し・帯が出る／409 E-MEM-005（自分）→ 赤い箱／404 E-MEM-002 → 見つかりません／503・403（権限を外された直後）→ 赤い箱・確かめを閉じる・押し直せる", async ({
  page,
}) => {
  const mk = await openAs(page, PATH);
  const press = async () => {
    await stopBtn(page).click();
    await go(page.getByRole("alertdialog"), "本人確認して止める").click();
  };
  mk.queue("suspend", err(409, "E-MEM-009"));
  mk.set("getMember", () => ({
    status: 200,
    body: detailBody({ member: member({ suspended: true, suspended_at: "2026-11-23T09:00:00Z" }) }),
  }));
  await press();
  await expect(page.locator(".k-band")).toContainText("一時的に止まっています");
  await expect(page.locator(".k-callout").first()).toBeVisible();
  mk.set("getMember", () => ({ status: 200, body: detailBody() }));
  await page.reload();
  mk.queue("suspend", err(409, "E-MEM-005"));
  await press();
  await expect(page.locator(".k-callout")).toContainText("自分");
  mk.queue("suspend", err(503, "E-PAGE-003"));
  await press();
  await expect(page.locator(".k-callout").first()).toBeVisible();
  mk.queue("suspend", err(403, "FORBIDDEN"));
  await press();
  await expect(page.locator(".k-callout").first()).toBeVisible();
  await expect(page.locator(".k-band")).toHaveCount(0);
  mk.queue("suspend", err(404, "E-MEM-002"));
  mk.set("getMember", () => err(404, "E-MEM-002"));
  await press();
  await expect(page.getByText("PAGE-001", { exact: false })).toBeVisible();
  expect(mk.count("suspend")).toBe(5);
});

test("K821-UI-007 止める確かめの二度押し：答えを待つ間「本人確認して止める」は押せない・口は 1 回", async ({
  page,
}) => {
  const mk = await openAs(page, PATH);
  mk.set("suspend", stateBody(true));
  const release = mk.hold("suspend");
  await stopBtn(page).click();
  const b = go(stopDlg(page), "本人確認して止める");
  await b.click();
  await expect(b).toBeDisabled();
  await b.click({ force: true });
  release();
  await expect(stopDlg(page)).toHaveCount(0);
  expect(mk.count("suspend")).toBe(1);
});

// ---------------------------------------------------------------- 戻す
test("K821-UI-008 戻す：帯の「戻す」で確かめ「山口 健 さんを戻しますか」「また入れるようになり、分身も動きます。止めていたあいだの担当はそのままです」・「本人確認して戻す」→ POST /members/<id>/resume を体 {} で 1 回・知らせ「山口 健 を戻しました」・帯が消えて「一時的に止める」が出る。?do=resume でも開く", async ({
  page,
}) => {
  const mk = await openAs(page, PATH_S, SUSP);
  mk.set("resume", stateBody(false));
  await backBtn(page).click();
  await expect(backDlg(page)).toContainText(
    "また入れるようになり、分身も動きます。止めていたあいだの担当はそのままです",
  );
  mk.set("getMember", () => ({
    status: 200,
    body: detailBody({ ...SUSP, member: { ...SUSP.member, suspended: false, suspended_at: null } }),
  }));
  await go(backDlg(page), "本人確認して戻す").click();
  await expect(toast(page)).toContainText("山口 健 を戻しました");
  expect(mk.last("resume")!.id).toBe(ID.yamaguchi);
  expect(mk.last("resume")!.body).toEqual({});
  await expect(page.locator(".k-band")).toHaveCount(0);
  await expect(stopBtn(page)).toBeVisible();
  mk.set("getMember", () => ({ status: 200, body: detailBody(SUSP) }));
  await page.goto(`${PATH_S}?do=resume`);
  await expect(backDlg(page)).toBeVisible();
});

test("K821-UI-009 戻す側の失敗と取り直し：403 STEP_UP_REQUIRED → 取り直して 1 回だけやり直す／409 E-MEM-010（もう戻っている）→ 赤い箱と読み直し／503 → 赤い箱・確かめを閉じる／二度押しは口 1 回", async ({
  page,
}) => {
  const mk = await openAs(page, PATH_S, SUSP);
  mk.set("resume", stateBody(false));
  mk.queue("resume", err(403, "STEP_UP_REQUIRED"));
  await backBtn(page).click();
  await go(backDlg(page), "本人確認して戻す").click();
  await passStepUp(page);
  await expect(toast(page)).toBeVisible();
  expect(mk.count("resume")).toBe(2);
  expect(mk.count("stepUp")).toBe(1);
  await page.goto(PATH_S);
  mk.queue("resume", err(409, "E-MEM-010"), err(503, "E-PAGE-003"));
  for (let i = 0; i < 2; i++) {
    await backBtn(page).click();
    await go(backDlg(page), "本人確認して戻す").click();
    await expect(page.locator(".k-callout").first()).toBeVisible();
    await page.goto(PATH_S);
  }
  const release = mk.hold("resume");
  await backBtn(page).click();
  const b = go(backDlg(page), "本人確認して戻す");
  await b.click();
  await expect(b).toBeDisabled();
  await b.click({ force: true });
  release();
  await expect(backDlg(page)).toHaveCount(0);
  expect(mk.count("resume")).toBe(5);
});

// ---------------------------------------------------------------- 2 段階認証を戻す・自分・兼務
test("K821-UI-010 「2 段階認証を戻す」（認証アプリを付けた人）は aria-disabled（title「まだ使えません」）で、押しても口も小窓も出ない（D-154.3）。「あとで使えるようになります」の説明が在る。認証アプリの無い人にはボタンが出ない", async ({
  page,
}) => {
  const mk = await openAs(page, `/members/${ID.tanaka}`, APP_USER);
  const b = page.getByRole("button", { name: "2 段階認証を戻す", exact: true });
  await expect(b).toHaveAttribute("aria-disabled", "true");
  await expect(b).toHaveAttribute("title", "まだ使えません");
  await b.click({ force: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByText("あとで使えるようになります", { exact: false }).first()).toBeVisible();
  expect(mk.calls.map((c) => c.op)).toEqual(["getMember"]);
  mk.set("getMember", () => ({ status: 200, body: detailBody() }));
  await page.reload();
  await expect(page.getByRole("button", { name: "2 段階認証を戻す", exact: true })).toHaveCount(0);
});

test("K821-UI-011 自分を開いたとき：「一時的に止める」は aria-disabled（title「自分は止められません。抜けるのは自分の設定から」）・?do=suspend でも開かない・口 0 回", async ({
  page,
}) => {
  const mk = await openAs(page, `/members/${ID.takamoto}?do=suspend`, {
    member: member({ id: ID.takamoto, name: "高本 聖斗", self: true, role: "admin" }),
  });
  await expect(stopDlg(page)).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  const b = stopBtn(page);
  await expect(b).toHaveAttribute("aria-disabled", "true");
  await expect(b).toHaveAttribute("title", "自分は止められません。抜けるのは自分の設定から");
  await b.click({ force: true });
  expect(mk.count("suspend")).toBe(0);
});

test("K821-UI-012 兼務（D-154.15）：営業と受託開発を兼ねる人を止めると、メンバーの画面では両方のグループの行が「一時的に止まっている」になる（片方だけにならない）。戻すと両方が元の状態の字に戻る", async ({
  page,
}) => {
  const mk = await openAs(page, `/members/${ID.sato}`, {
    member: member({ id: ID.sato, name: "佐藤 花子", role: "manager" }),
  });
  mk.set("suspend", stateBody(true));
  mk.set("resume", stateBody(false));
  const setSuspended = (v: boolean) =>
    mk.w.groups.forEach((gr) => gr.members.forEach((m) => m.id === ID.sato && (m.suspended = v)));
  // グループは名前で 1 つに決める（hasText だと「受託開発も兼ねる」の行を持つ営業のカードにも当たる）
  const card = (gname: string) => page.getByRole("region", { name: gname, exact: true });
  const row = (gname: string) => card(gname).locator(".k-f10m-row").filter({ hasText: "佐藤 花子" });
  // 初めは自分の主のグループ（営業）だけが開く（K-710）。受託開発の行は見る前に開く
  const openDev = async () => {
    const t = card("受託開発").locator(".k-f10m-toggle");
    await t.click();
    await expect(t).toHaveAttribute("aria-expanded", "true");
  };
  await stopBtn(page).click();
  setSuspended(true);
  await page.getByRole("alertdialog").getByRole("button", { name: "本人確認して止める", exact: true }).click();
  await expect(toast(page)).toBeVisible();
  await page.goto("/members");
  await openDev();
  await expect(row("営業")).toContainText("一時的に止まっている");
  await expect(row("受託開発")).toContainText("一時的に止まっている");
  setSuspended(false);
  await page.reload();
  await openDev();
  await expect(row("営業")).not.toContainText("一時的に止まっている");
  await expect(row("受託開発")).not.toContainText("一時的に止まっている");
});

test("K821-UI-013 幅 320・375・768・1024・1440：止める・戻すの確かめを開いても、2 段階認証の区画でも、横のはみ出し 0（数値）", async ({
  page,
}) => {
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAs(page, PATH, undefined, w);
    await stopBtn(page).click();
    expect(await overflowX(page), `止める 幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await openAs(page, PATH_S, SUSP, w);
    await backBtn(page).click();
    expect(await overflowX(page), `戻す 幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await openAs(page, `/members/${ID.tanaka}`, APP_USER, w);
    expect(await overflowX(page), `認証 幅 ${w}`).toBeLessThanOrEqual(0);
  }
});
