// K-820「メンバーの 1 人の画面のグループを移す・兼ねるグループを足す外す 小窓を口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の md-move・md-also（本番と同じ部品 features/F10/member/dialogs-group.tsx・代表 OK 2026-11-22）。人ごとの「できること」は作らない（D-154.10）。
//   ログイン・外枠・役は本物。メンバーの 1 人（getMember・K-810）・グループの一覧（getWorkspaceMembers）・移す・兼ねる（updateMemberGroups・K-812）・
//   本人確認の取り直し（getMySecurity・stepUp）だけを網の手前で差し替える（f10-kit.ts）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
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
// ▾ は部品 components/k の Select（Base UI）。素の <select> は無いので、▾ を押して開いた portal の role=option を押す・数える
async function pick(page: Page, sel: Locator, label: string): Promise<void> {
  await sel.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const PATH = `/members/${ID.suzuki}`;
const g = (id: string, name: string, code: string, primary: boolean, role = "member") => ({
  id,
  name,
  code,
  primary,
  role,
});
const moveDlg = (page: Page) => page.getByRole("dialog", { name: "グループを移す", exact: true });
const alsoDlg = (page: Page) => page.getByRole("dialog", { name: "兼ねるグループを足す・外す", exact: true });
const moveBtn = (page: Page) => page.getByRole("button", { name: "グループを移す", exact: true });
const alsoBtn = (page: Page) => page.getByRole("button", { name: "＋ 兼ねるグループを足す", exact: true });
const groupsCard = (page: Page) => page.getByRole("region", { name: "グループと役割", exact: true });
const changed = (mk: Api, groups: ReturnType<typeof g>[]) =>
  mk.set("groups", (c) => ok({ member_id: c.id, company_role: "member", groups }, 200));

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});
async function openDetail(
  page: Page,
  o: { detail?: Record<string, unknown>; path?: string; width?: number } = {},
): Promise<Api> {
  const mk = await mockApi(page, o.detail ? { detail: o.detail } : {});
  await openAt(page, owner.token, o.path ?? PATH, o.width ?? 1440);
  await expect(page.getByRole("heading", { level: 1, name: "鈴木 一郎", exact: true })).toBeVisible();
  return mk;
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const STATES: Record<string, { detail?: Record<string, unknown>; drive: (page: Page) => Promise<void> }> = {
  "md-move": {
    drive: async (page) => {
      await moveBtn(page).click();
      await pick(page, moveDlg(page).getByRole("combobox", { name: "移す先のグループ", exact: true }), "受託開発");
    },
  },
  "md-also": {
    detail: { groups: [g(ID.EG, "営業", "EG", true), g(ID.JD, "受託開発", "JD", false)] },
    drive: async (page) => {
      await alsoBtn(page).click();
      await pick(page, alsoDlg(page).getByRole("combobox", { name: "足すグループ", exact: true }), "経理");
    },
  },
};
for (const [id, st] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K820-UI-001 ${id} 幅 ${w}：小窓の題・副題・欄・兼ねているグループの行・足のボタンの字と位置と大きさがモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await openDetail(page, { ...(st.detail ? { detail: st.detail } : {}), width: w });
          await st.drive(page);
        },
        // 頭の「一時的に止める」「ワークスペースから外す」は、小窓の登録（K-821・K-822）が無い間は本番で押せない形
        //   （aria-disabled・不透明度 0.55）、下絵は押せる形なので、頭のボタンの濃さと色は比べない（数・大きさ・字は比べる）
        { pairs: F10_PAIRS, base: MOCK_BASE, blur: true, skip: ["acts:opacity", "acts:color"] },
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("dialog");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く
test("K820-UI-002 入口：「グループを移す」「＋ 兼ねるグループを足す」で開く／直に ?do=move・?do=also で開く（開いたら URL から do が消え、読み直しても開き直さない）。開くとき、グループの一覧を getWorkspaceMembers で 1 回読む", async ({
  page,
}) => {
  const mk = await openDetail(page);
  await moveBtn(page).click();
  await expect(moveDlg(page)).toBeVisible();
  expect(mk.count("members")).toBe(1);
  await page.keyboard.press("Escape");
  await alsoBtn(page).click();
  await expect(alsoDlg(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(`${PATH}?do=move`);
  await expect(moveDlg(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  await page.reload();
  await expect(moveDlg(page)).toHaveCount(0);
  await page.goto(`${PATH}?do=also`);
  await expect(alsoDlg(page)).toBeVisible();
});

test("K820-UI-003 移す先の選び：いまの主のグループ（営業）は出ない（受託開発・経理の 2 つ）。副題「鈴木 一郎 の、いまのグループ：営業」。グループが 1 つしか無い会社は「移せるグループがありません」で足のボタンは押せない", async ({
  page,
}) => {
  const mk = await openDetail(page);
  await moveBtn(page).click();
  await expect(moveDlg(page)).toContainText("鈴木 一郎 の、いまのグループ：営業");
  await moveDlg(page).getByRole("combobox", { name: "移す先のグループ", exact: true }).click();
  await expect(page.getByRole("option")).toHaveText([/受託開発$/, /経理$/]);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  mk.w.groups = [mk.w.groups[0]!];
  await page.reload();
  await moveBtn(page).click();
  await expect(moveDlg(page)).toContainText("移せるグループがありません");
  await expect(moveDlg(page).getByRole("button", { name: "本人確認して移す", exact: true })).toBeDisabled();
});

// ---------------------------------------------------------------- 移す
test("K820-UI-004 移す：受託開発を選んで「本人確認して移す」→ updateMemberGroups の体は { primary_scope_id: 受託開発 } だけ（add・remove は送らない）・小窓が閉じ・グループと役割の区画が答えの groups で差し替わり「受託開発」が主・知らせ「鈴木 一郎 を 受託開発 に移しました」・メンバーの並びの読み直しの印を付ける", async ({
  page,
}) => {
  const mk = await openDetail(page);
  changed(mk, [g(ID.JD, "受託開発", "JD", true)]);
  await moveBtn(page).click();
  await pick(page, moveDlg(page).getByRole("combobox", { name: "移す先のグループ", exact: true }), "受託開発");
  await moveDlg(page).getByRole("button", { name: "本人確認して移す", exact: true }).click();
  await expect(toast(page)).toContainText("鈴木 一郎 を 受託開発 に移しました");
  await expect(moveDlg(page)).toHaveCount(0);
  expect(mk.of("groups")).toHaveLength(1);
  expect(mk.last("groups")!.id).toBe(ID.suzuki);
  expect(mk.last("groups")!.body).toEqual({ primary_scope_id: ID.JD });
  await expect(groupsCard(page)).toContainText("受託開発");
});

test("K820-UI-005 本人確認の取り直し：403 STEP_UP_REQUIRED で取り直しの小窓（「グループを移す前に、本人か確かめます」）→ パスワードで確かめると stepUp 1 回 → 同じ体でもう 1 回だけ updateMemberGroups。やめると何も送らず、移す小窓に戻る", async ({
  page,
}) => {
  const mk = await openDetail(page);
  changed(mk, [g(ID.JD, "受託開発", "JD", true)]);
  mk.queue("groups", err(403, "STEP_UP_REQUIRED"), err(403, "STEP_UP_REQUIRED"));
  await moveBtn(page).click();
  await moveDlg(page).getByRole("button", { name: "本人確認して移す", exact: true }).click();
  await expect(stepDlg(page)).toContainText("グループを移す前に、本人か確かめます");
  expect(mk.count("security")).toBe(1);
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(moveDlg(page)).toBeVisible();
  expect(mk.count("stepUp")).toBe(0);
  expect(mk.count("groups")).toBe(1);
  await moveDlg(page).getByRole("button", { name: "本人確認して移す", exact: true }).click();
  await passStepUp(page);
  await expect(toast(page)).toBeVisible();
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.of("groups").map((c) => c.body)).toEqual([{ primary_scope_id: ID.JD }, { primary_scope_id: ID.JD }]);
});

// ---------------------------------------------------------------- 兼ねる
test("K820-UI-006 兼ねる小窓：兼ねているグループの行（受託開発・「外す」）・足すグループの選び（営業は主・受託開発は兼ねているので出ない＝経理だけ）・変えていないとき足のボタンは押せない。兼ねていない人は「兼ねているグループはありません」", async ({
  page,
}) => {
  const mk = await openDetail(page, {
    detail: { groups: [g(ID.EG, "営業", "EG", true), g(ID.JD, "受託開発", "JD", false)] },
  });
  await alsoBtn(page).click();
  const d = alsoDlg(page);
  await expect(d.getByRole("button", { name: "受託開発を外す", exact: true })).toBeVisible();
  await d.getByRole("combobox", { name: "足すグループ", exact: true }).click();
  await expect(page.getByRole("option")).toHaveText([/経理$/]);
  await page.keyboard.press("Escape");
  await expect(d.getByRole("button", { name: "本人確認して保存する", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  mk.set("getMember", () => ({ status: 200, body: detailBody() }));
  await page.reload();
  await alsoBtn(page).click();
  await expect(alsoDlg(page)).toContainText("兼ねているグループはありません");
});

test("K820-UI-007 足す・外す：経理を足して保存 → 体は { add_scope_ids: [経理] }（role_key は送らない・メンバーで入る）／受託開発を外して保存 → { remove_scope_ids: [受託開発] }／足して外す → 1 つの体に 2 つ。答えで区画が差し替わり、小窓が閉じ、知らせ「鈴木 一郎 の兼ねるグループを直しました」", async ({
  page,
}) => {
  const mk = await openDetail(page, {
    detail: { groups: [g(ID.EG, "営業", "EG", true), g(ID.JD, "受託開発", "JD", false)] },
  });
  changed(mk, [g(ID.EG, "営業", "EG", true), g(ID.KR, "経理", "KR", false)]);
  await alsoBtn(page).click();
  let d = alsoDlg(page);
  await pick(page, d.getByRole("combobox", { name: "足すグループ", exact: true }), "経理");
  await d.getByRole("button", { name: "本人確認して保存する", exact: true }).click();
  await expect(toast(page)).toContainText("鈴木 一郎 の兼ねるグループを直しました");
  expect(mk.last("groups")!.body).toEqual({ add_scope_ids: [ID.KR] });
  await expect(groupsCard(page)).toContainText("経理");
  await alsoBtn(page).click();
  d = alsoDlg(page);
  await d.getByRole("button", { name: "経理を外す", exact: true }).click();
  await d.getByRole("button", { name: "本人確認して保存する", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(mk.last("groups")!.body).toEqual({ remove_scope_ids: [ID.KR] });
  await alsoBtn(page).click();
  await pick(page, d.getByRole("combobox", { name: "足すグループ", exact: true }), "受託開発");
  await d.getByRole("button", { name: "本人確認して保存する", exact: true }).click();
  expect(mk.count("groups")).toBe(3);
});

test("K820-UI-008 兼務（D-154.15）：営業の主＋受託開発のマネージャーを兼ねる人に、経理（別の部署）を作業員として足しても、受託開発の行と主のグループは変わらず「兼ねるグループ 受託開発・経理」と並ぶ。1 人が 3 つのグループに入れる（上限なし）・主を外す操作は出ない", async ({
  page,
}) => {
  const mk = await openDetail(page, {
    detail: { groups: [g(ID.EG, "営業", "EG", true), g(ID.JD, "受託開発", "JD", false, "manager")] },
  });
  changed(mk, [
    g(ID.EG, "営業", "EG", true),
    g(ID.JD, "受託開発", "JD", false, "manager"),
    g(ID.KR, "経理", "KR", false),
  ]);
  await alsoBtn(page).click();
  await expect(alsoDlg(page).getByRole("button", { name: "営業を外す", exact: true })).toHaveCount(0);
  await pick(page, alsoDlg(page).getByRole("combobox", { name: "足すグループ", exact: true }), "経理");
  await alsoDlg(page).getByRole("button", { name: "本人確認して保存する", exact: true }).click();
  await expect(groupsCard(page).locator(".k-set-row").nth(1)).toContainText("受託開発・経理");
  await expect(groupsCard(page)).toContainText("営業");
});

// ---------------------------------------------------------------- 失敗・揺れ
test("K820-UI-009 もう居ない（404 E-MEM-002）：小窓を閉じて詳細の読み直し → 「見つかりません」の画面。グループが変わっている（404 E-MEM-006・409 E-MEM-007）：小窓の赤い箱・グループの一覧を読み直して選びが新しくなる・小窓は閉じない", async ({
  page,
}) => {
  const mk = await openDetail(page);
  await moveBtn(page).click();
  mk.queue("groups", err(404, "E-MEM-006"), err(409, "E-MEM-007"));
  const go = moveDlg(page).getByRole("button", { name: "本人確認して移す", exact: true });
  await go.click();
  await expect(moveDlg(page).getByRole("alert")).toBeVisible();
  await go.click();
  await expect(moveDlg(page).getByRole("alert")).toBeVisible();
  await expect.poll(() => mk.count("members")).toBe(3);
  mk.queue("groups", err(404, "E-MEM-002"));
  mk.set("getMember", () => err(404, "E-MEM-002"));
  await go.click();
  await expect(moveDlg(page)).toHaveCount(0);
  await expect(page.getByText("PAGE-001", { exact: false })).toBeVisible();
});

test("K820-UI-010 503・権限が無い（403・権限を外された直後）・自分の変更（409 E-MEM-003）：小窓の赤い箱・中身は残る・押し直すと通る。区画は前のまま", async ({
  page,
}) => {
  const mk = await openDetail(page);
  mk.queue("groups", err(503, "E-PAGE-003"), err(403, "FORBIDDEN"), err(409, "E-MEM-003"));
  await moveBtn(page).click();
  const go = moveDlg(page).getByRole("button", { name: "本人確認して移す", exact: true });
  for (let i = 0; i < 3; i++) {
    await go.click();
    await expect(moveDlg(page).getByRole("alert")).toBeVisible();
  }
  // 小窓が開いている間、後ろの区画は読み上げの木から外れる（模態の小窓）。字そのものを見る
  await expect(page.getByRole("region", { name: "グループと役割", exact: true, includeHidden: true })).toContainText(
    "営業",
  );
  changed(mk, [g(ID.JD, "受託開発", "JD", true)]);
  await go.click();
  await expect(toast(page)).toBeVisible();
  expect(mk.count("groups")).toBe(4);
});

test("K820-UI-011 二度押し：答えを待つ間、足のボタンは押せない・口は 1 回（移す・兼ねるどちらも）", async ({
  page,
}) => {
  const mk = await openDetail(page);
  changed(mk, [g(ID.JD, "受託開発", "JD", true)]);
  const release = mk.hold("groups");
  await moveBtn(page).click();
  const go = moveDlg(page).getByRole("button", { name: "本人確認して移す", exact: true });
  await go.click();
  await expect(go).toBeDisabled();
  await go.click({ force: true });
  release();
  await expect(moveDlg(page)).toHaveCount(0);
  expect(mk.count("groups")).toBe(1);
});

test("K820-UI-012 自分を開いたとき：「グループを移す」「＋ 兼ねるグループを足す」は aria-disabled（title「自分のグループは、自分では変えられません」）・押しても小窓は開かない・?do=move でも開かない・口 0 回", async ({
  page,
}) => {
  const mk = await mockApi(page, {
    detail: { member: { ...detailBody().data.member, id: ID.takamoto, name: "高本 聖斗", self: true } },
  });
  await openAt(page, owner.token, `/members/${ID.takamoto}?do=move`);
  await expect(page.getByRole("heading", { level: 1, name: "高本 聖斗", exact: true })).toBeVisible();
  await expect(moveDlg(page)).toHaveCount(0);
  for (const b of [moveBtn(page), alsoBtn(page)]) {
    await expect(b).toHaveAttribute("aria-disabled", "true");
    await expect(b).toHaveAttribute("title", "自分のグループは、自分では変えられません");
    await b.click({ force: true });
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(mk.count("groups")).toBe(0);
});

test("K820-UI-013 幅 320・375・768・1024・1440：2 つの小窓を開いても横のはみ出し 0（数値）・足のボタンが画面の中に収まる", async ({
  page,
}) => {
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openDetail(page, {
      width: w,
      detail: { groups: [g(ID.EG, "営業", "EG", true), g(ID.JD, "受託開発", "JD", false)] },
    });
    await moveBtn(page).click();
    expect(await overflowX(page), `移す 幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await alsoBtn(page).click();
    expect(await overflowX(page), `兼ねる 幅 ${w}`).toBeLessThanOrEqual(0);
    const r = (await alsoDlg(page).getByRole("button", { name: "本人確認して保存する", exact: true }).boundingBox())!;
    expect(r.x + r.width, `幅 ${w}`).toBeLessThanOrEqual(w);
    await page.keyboard.press("Escape");
  }
});

test("K820-UI-014 やめる・Esc：口 0 回・焦点は開いたボタンに戻る・開き直すと選びは初めの値（書きかけが残らない）", async ({
  page,
}) => {
  const mk = await openDetail(page);
  await moveBtn(page).click();
  await pick(page, moveDlg(page).getByRole("combobox", { name: "移す先のグループ", exact: true }), "経理");
  await moveDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(moveBtn(page)).toBeFocused();
  await moveBtn(page).click();
  await expect(moveDlg(page).getByRole("combobox", { name: "移す先のグループ", exact: true })).toContainText(
    "受託開発",
  );
  await page.keyboard.press("Escape");
  await expect(moveBtn(page)).toBeFocused();
  expect(mk.count("groups")).toBe(0);
});
