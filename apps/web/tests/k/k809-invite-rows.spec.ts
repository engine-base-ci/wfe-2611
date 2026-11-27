// K-809「招待中の行の送り直す・取り消す・各グループの「このグループに招く」を口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の mb-invite-menu・mb-invite-revoke・mb-invite-group（本番と同じ部品 features/F10/members・代表 OK 2026-11-22）。
//   「知らせる」（催促）は作らない（D-154.1）。ログイン・外枠・役は本物。並び（getWorkspaceMembers）・招く（createInvitations）・送り直す（resendInvitation・K-807）・
//   取り消す（revokeInvitation・K-807）だけを網の手前で差し替える（f10-kit.ts）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { signupViaApi } from "../_lib/api";
import { F10_PAIRS, ID, MOCK_BASE, WS_NAME, err, mockApi, ok, openAt, overflowX, toast, type Api } from "./f10-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = "/members";
const MAIL = "kimura@engine-base.example";
const invited = (page: Page) => page.locator(".k-f10m-row[data-invited]");
const resendBtn = (page: Page) => invited(page).getByRole("button", { name: "送り直す", exact: true });
const revokeBtn = (page: Page) => invited(page).getByRole("button", { name: "取り消す", exact: true });
const revokeDlg = (page: Page) => page.getByRole("alertdialog", { name: "招待を取り消しますか", exact: true });
const box = (page: Page) => page.locator(".k-callout");
// グループは名前で 1 つに決める（hasText だと「経理も兼ねる」の行を持つ営業のカードにも当たる）
const card = (page: Page, g: string) => page.getByRole("region", { name: g, exact: true });
const groupBtn = (page: Page, g: string) =>
  card(page, g).getByRole("button", { name: "＋ このグループに招く", exact: true });
const resentOk = (mk: Api, mail = "sent") =>
  mk.set("resend", (c) => ok({ id: c.id, email: MAIL, expires_at: "2026-11-30T09:00:00Z", mail }));
const revokeOk = (mk: Api) => mk.set("revoke", (c) => ok({ id: c.id, revoked_at: "2026-11-23T09:00:00Z" }));

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});
// 初めは自分の主のグループ（営業）だけが開く（K-710）。招待中の行（kimura）は経理に在り、モック（mb-*）は 3 つとも開いた形なので、
//   見る前に受託開発・経理を開く（開くたび（goto のたび）に閉じに戻る）
async function openGroups(page: Page): Promise<void> {
  for (const g of ["受託開発", "経理"]) {
    const t = card(page, g).locator(".k-f10m-toggle");
    await t.click();
    await expect(t).toHaveAttribute("aria-expanded", "true");
  }
}
async function openList(page: Page, width = 1440): Promise<Api> {
  const mk = await mockApi(page);
  await openAt(page, owner.token, PATH, width);
  await openGroups(page);
  await expect(invited(page)).toHaveCount(1);
  return mk;
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const STATES: Record<string, (page: Page, mk: Api) => Promise<void>> = {
  "mb-invite-menu": async (page, mk) => {
    resentOk(mk);
    mk.set("members", () => {
      mk.w.invitations[0]!.left_days = 7;
      return {
        status: 200,
        body: { data: { groups: mk.w.groups, invitations: mk.w.invitations, alerts: [], count: 7 } },
      };
    });
    await resendBtn(page).click();
    await expect(page.getByRole("status").filter({ hasText: "送り直しました" })).toBeVisible();
  },
  "mb-invite-revoke": async (page) => {
    await revokeBtn(page).click();
    await expect(revokeDlg(page)).toBeVisible();
  },
  "mb-invite-group": async (page) => {
    await groupBtn(page, "営業").click();
    await expect(page.getByRole("dialog", { name: "招く", exact: true })).toBeVisible();
    await page.getByRole("dialog").getByLabel("メール").fill("yoshida@engine-base.example");
    await page.getByRole("dialog").getByRole("button", { name: "足す", exact: true }).click();
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K809-UI-001 ${id} 幅 ${w}：招待中の行・上の知らせ・確かめの小窓・招く小窓の位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const mk = await openList(page, w);
          await drive(page, mk);
        },
        { pairs: F10_PAIRS, base: MOCK_BASE, blur: true },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 行
test("K809-UI-002 招待中の行：「kimura@… 招待中 ・ あと 6 日」に「送り直す」「取り消す」が押せる形で在る。人の行には無い。「知らせる」は無い", async ({
  page,
}) => {
  await openList(page);
  await expect(invited(page)).toContainText("招待中 ・ あと 6 日");
  await expect(resendBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(revokeBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "送り直す", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /知らせる/ })).toHaveCount(0);
});

test("K809-UI-003 送り直す（メールが届いた）：口は POST /invitations/<id>/resend を体なしで 1 回・上に「kimura@… に招待を送り直しました。7 日のあいだ入れます」・行は「送り直しました ・ あと 7 日」（role=status）・並びを読み直す", async ({
  page,
}) => {
  const mk = await openList(page);
  resentOk(mk);
  mk.w.invitations[0]!.left_days = 7;
  await resendBtn(page).click();
  await expect(box(page)).toContainText(`${MAIL} に招待を送り直しました。7 日のあいだ入れます`);
  await expect(invited(page).getByRole("status")).toContainText("送り直しました ・ あと 7 日");
  expect(mk.of("resend")).toHaveLength(1);
  expect(mk.last("resend")!.id).toBe(ID.kimura);
  expect(mk.last("resend")!.body).toBeNull();
  expect(mk.count("members")).toBe(2);
});

test("K809-UI-004 送り直す（メールが届かなかった mail failed）：「kimura@… には送れませんでした。もう一度送り直せます」・「送り直しました」は出ない・もう一度押せて 2 回目の口が呼ばれる", async ({
  page,
}) => {
  const mk = await openList(page);
  resentOk(mk, "failed");
  await resendBtn(page).click();
  await expect(box(page)).toContainText(`${MAIL} には送れませんでした。もう一度送り直せます`);
  await expect(invited(page)).not.toContainText("送り直しました");
  await resendBtn(page).click();
  await expect.poll(() => mk.count("resend")).toBe(2);
});

test("K809-UI-005 1 日 1 回まで（409 E-INV-019・detail に次に送れる時刻）：上に「kimura@… へは 1 日に 1 回までです。次に送れるのは 11/24 18:00 以降です」（日本時間）・行は前のまま・メールの字は出ない", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.queue("resend", err(409, "E-INV-019", { detail: { 次に送れる時刻: "2026-11-24T09:00:00Z" } }));
  await resendBtn(page).click();
  await expect(box(page)).toContainText(`${MAIL} へは 1 日に 1 回までです。次に送れるのは 11/24 18:00 以降です`);
  await expect(invited(page)).toContainText("招待中 ・ あと 6 日");
  await expect(box(page)).not.toContainText("送り直しました");
});

test("K809-UI-006 送り直せない招待（別のタブで状態が変わった）：409 E-INV-017（もう入った）・409 E-INV-018（取り消し済み）・404 E-INV-016（もう無い）は赤い箱に正本の文を出し、並びを読み直す（口の数は読み直しぶん増える）", async ({
  page,
}) => {
  const mk = await openList(page);
  const cases = [err(409, "E-INV-017"), err(409, "E-INV-018"), err(404, "E-INV-016")];
  for (const [i, r] of cases.entries()) {
    mk.queue("resend", r);
    await resendBtn(page).click();
    await expect(box(page).first()).toBeVisible();
    await expect.poll(() => mk.count("members")).toBe(2 + i);
  }
  expect(mk.count("resend")).toBe(3);
});

test("K809-UI-007 送り直しが 503・403：赤い箱に正本の文・行は前のまま・「送り直しました」は出ない・押し直すと通る（口 2 回）", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.queue("resend", err(503, "E-PAGE-003"), err(403, "FORBIDDEN"));
  await resendBtn(page).click();
  await expect(box(page).first()).toBeVisible();
  await resendBtn(page).click();
  await expect.poll(() => mk.count("resend")).toBe(2);
  await expect(invited(page)).not.toContainText("送り直しました");
  resentOk(mk);
  await resendBtn(page).click();
  await expect(invited(page).getByRole("status")).toBeVisible();
});

test("K809-UI-008 送り直しの二度押し：答えを待つ間「送り直す」は押せない（aria-disabled）・口は 1 回", async ({
  page,
}) => {
  const mk = await openList(page);
  resentOk(mk);
  const release = mk.hold("resend");
  await resendBtn(page).click();
  await expect(resendBtn(page)).toHaveAttribute("aria-disabled", "true");
  await resendBtn(page).click({ force: true });
  release();
  await expect(invited(page).getByRole("status")).toBeVisible();
  expect(mk.count("resend")).toBe(1);
});

test("K809-UI-009 取り消す前の確かめ：「招待を取り消しますか」「kimura@… に送った招待は使えなくなります。招待のリンクも使えなくなります」・ボタン「招待を取り消す」「やめる」・開いたときの焦点は「やめる」。やめると口は 0 回で焦点は「取り消す」に戻る", async ({
  page,
}) => {
  const mk = await openList(page);
  await revokeBtn(page).click();
  await expect(revokeDlg(page)).toContainText(`${MAIL} に送った招待は使えなくなります。招待のリンクも使えなくなります`);
  await expect(revokeDlg(page).getByRole("button", { name: "やめる", exact: true })).toBeFocused();
  await revokeDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(revokeDlg(page)).toHaveCount(0);
  await expect(revokeBtn(page)).toBeFocused();
  expect(mk.count("revoke")).toBe(0);
});

test("K809-UI-010 取り消す：DELETE /invitations/<id> を 1 回・確かめが閉じ・知らせ「kimura@… への招待を取り消しました」・並びを読み直して招待中の行が消える（口 2 回）", async ({
  page,
}) => {
  const mk = await openList(page);
  revokeOk(mk);
  await revokeBtn(page).click();
  mk.w.invitations = [];
  await revokeDlg(page).getByRole("button", { name: "招待を取り消す", exact: true }).click();
  await expect(toast(page)).toContainText(`${MAIL} への招待を取り消しました`);
  await expect(invited(page)).toHaveCount(0);
  expect(mk.of("revoke")).toHaveLength(1);
  expect(mk.last("revoke")!.id).toBe(ID.kimura);
  expect(mk.count("members")).toBe(2);
});

test("K809-UI-011 取り消せない招待：409 E-INV-018（もう取り消した・別のタブで）・409 E-INV-017（もう入った）・404 E-INV-016 は確かめを閉じ、赤い箱に正本の文を出して並びを読み直す。503 は確かめを閉じ、赤い箱・招待中の行は残る", async ({
  page,
}) => {
  const mk = await openList(page);
  const cases = [err(409, "E-INV-018"), err(409, "E-INV-017"), err(404, "E-INV-016")];
  for (const [i, r] of cases.entries()) {
    mk.queue("revoke", r);
    await revokeBtn(page).click();
    await revokeDlg(page).getByRole("button", { name: "招待を取り消す", exact: true }).click();
    await expect(revokeDlg(page)).toHaveCount(0);
    await expect(box(page).first()).toBeVisible();
    await expect.poll(() => mk.count("members")).toBe(2 + i);
  }
  mk.queue("revoke", err(503, "E-PAGE-003"));
  await revokeBtn(page).click();
  await revokeDlg(page).getByRole("button", { name: "招待を取り消す", exact: true }).click();
  await expect(invited(page)).toHaveCount(1);
  expect(mk.count("revoke")).toBe(4);
});

test("K809-UI-012 取り消すの二度押し：答えを待つ間「招待を取り消す」は押せない・口は 1 回", async ({ page }) => {
  const mk = await openList(page);
  revokeOk(mk);
  const release = mk.hold("revoke");
  await revokeBtn(page).click();
  const go = revokeDlg(page).getByRole("button", { name: "招待を取り消す", exact: true });
  await go.click();
  await expect(go).toBeDisabled();
  await go.click({ force: true });
  release();
  await expect(revokeDlg(page)).toHaveCount(0);
  expect(mk.count("revoke")).toBe(1);
});

// ---------------------------------------------------------------- このグループに招く
test("K809-UI-013 「＋ このグループに招く」：押すと招く小窓が開き、グループがその行のグループに決まっている（営業・受託開発・経理で試す）。メールを足して招くと createInvitations の scope_id がそのグループの id", async ({
  page,
}) => {
  const mk = await openList(page);
  mk.set("invite", () =>
    ok(
      { invitations: [{ id: "n1", email: "a@engine-base.example", expires_at: "2026-11-30T09:00:00Z", mail: "sent" }] },
      201,
    ),
  );
  for (const [g, id] of [
    ["営業", ID.EG],
    ["受託開発", ID.JD],
    ["経理", ID.KR],
  ] as const) {
    await groupBtn(page, g).click();
    const d = page.getByRole("dialog", { name: "招く", exact: true });
    await expect(d.getByLabel("グループ")).toHaveValue(new RegExp(`${g}|${id}`));
    await d.getByLabel("メール").fill("a@engine-base.example");
    await d.getByRole("button", { name: "足す", exact: true }).click();
    await d.getByRole("button", { name: /招く$/ }).click();
    await expect(d).toHaveCount(0);
    expect(mk.last("invite")!.body).toMatchObject({ scope_id: id, emails: ["a@engine-base.example"] });
  }
  expect(mk.count("invite")).toBe(3);
});

test("K809-UI-014 小窓をやめる・Esc：口 0 回・焦点はそのグループの「＋ このグループに招く」に戻る・開き直すと空。上の「＋ 招く」からはグループを決めずに開く（K-420 のまま）", async ({
  page,
}) => {
  const mk = await openList(page);
  await groupBtn(page, "受託開発").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "招く", exact: true })).toHaveCount(0);
  await expect(groupBtn(page, "受託開発")).toBeFocused();
  await page.getByRole("button", { name: "＋ 招く", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "招く", exact: true }).getByLabel("グループ")).toHaveValue(
    new RegExp(`営業|${ID.EG}`),
  );
  expect(mk.count("invite")).toBe(0);
});

test("K809-UI-015 幅 320・375・768・1024・1440：横のはみ出し 0（数値）・招待中の行の 2 つのボタンが画面の中に収まり押せる（幅 375 で高さ 32px 以上）・確かめの小窓を開いても 0", async ({
  page,
}) => {
  await mockApi(page);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAt(page, owner.token, PATH, w);
    await openGroups(page);
    await expect(invited(page)).toHaveCount(1);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    for (const b of [resendBtn(page), revokeBtn(page)]) {
      const r = (await b.boundingBox())!;
      expect(r.x + r.width, `幅 ${w}`).toBeLessThanOrEqual(w);
      expect(r.height).toBeGreaterThanOrEqual(32);
    }
    await revokeBtn(page).click();
    expect(await overflowX(page), `小窓 幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
  }
});
