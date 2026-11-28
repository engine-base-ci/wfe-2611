// K-832「ワークスペースを消す小窓と、消す手続き中の帯：名前を打って確かめ・本人確認・14 日は取り消せる・手続き中も全員使える」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の st-delete・st-delete-ready・st-deleting（本番と同じ部品 features/F10/ws/delete-dialog.tsx・settings.tsx・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。設定の口と消す手続きの口（K-827・K-830）だけを網の手前で差し替える（f10-ops-kit.ts）。先に書き出せるは作らない（D-154.4）・手続き中も全員いつもどおり使える（D-154.5）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { signupViaApi } from "../_lib/api";
import { MOCK_BASE, WS_NAME, openAt, overflowX, passStepUp, stepDlg } from "./f10-kit";
import { DELETING, SET_PAIRS, err, jst, mockOps, settings } from "./f10-ops-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = "/settings/company";
const SEC = 'section[aria-labelledby="wset-title"]';
const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const dlg = (page: Page) => page.getByRole("dialog", { name: "ワークスペースを消す", exact: true });
const nameField = (page: Page) =>
  dlg(page).getByLabel("確かめのため、ワークスペースの名前を打ってください", { exact: true });
const go = (page: Page) => dlg(page).getByRole("button", { name: "本人確認して消す手続きをする", exact: true });
const openDlg = async (page: Page) => {
  await card(page, "ワークスペースを消す").getByRole("button", { name: "消す手続き", exact: true }).click();
  await expect(dlg(page)).toBeVisible();
};
const band = (page: Page) => page.locator(".k-band");
const cancel = (page: Page) => band(page).getByRole("button", { name: "本人確認して取り消す", exact: true });
const deleting = () => settings({ deletion: { ...DELETING } });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

const STATES: Record<string, { s?: ReturnType<typeof settings>; typed?: string }> = {
  "st-delete": { typed: "株式会社ENGINE" },
  "st-delete-ready": { typed: WS_NAME },
  "st-deleting": { s: deleting() },
};
for (const [id, st] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K832-UI-001 ${id} 幅 ${w}：小窓（題・消えるもの・箇条・名前の欄・足のボタン）・手続き中の帯・札の位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockOps(page, st.s ? { settings: st.s } : {});
          await openAt(page, owner.token, PATH, w);
          await expect(page.locator(SEC)).toBeVisible();
          if (st.typed !== undefined) {
            await openDlg(page);
            await nameField(page).fill(st.typed);
            // ［消す手続き］を押すと区画まで下に動く。小窓は画面に貼り付くので、下絵（上の端）と同じく頁の上の端で位置を読む
            await page.evaluate(() => window.scrollTo(0, 0));
          }
        },
        { pairs: SET_PAIRS, base: MOCK_BASE, blur: false },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K832-UI-002 「消す手続き」を押すと小窓：題「ワークスペースを消す」・「<名前> を消す ・ 消すと戻せません」・消えるものは口の数（チケット 69 件・メンバー 5 人）・「14 日は取り消せる」の箇条。開くだけでは口を呼ばない（設定の読みは 1 回のまま）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await expect(dlg(page)).toContainText(`${WS_NAME} を消す ・ 消すと戻せません`);
  await expect(dlg(page)).toContainText(
    "チケット 69 件・記録・預けたログイン情報・メンバー 5 人の分身の記憶（このワークスペースの分）",
  );
  await expect(dlg(page)).toContainText("消す手続きから 14 日は取り消せる。そのあと完全に消える");
  expect(mk.calls.map((c) => c.op)).toEqual(["settings"]);
});

test("K832-UI-003 名前の確かめ：完全に同じになるまで主ボタンは押せない。全角半角・大文字小文字・前後の空白の違いは同じとみなさない。合うと「名前が合いました」", async ({
  page,
}) => {
  await mockOps(page);
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await expect(go(page)).toBeDisabled();
  await expect(dlg(page)).toContainText("名前が合うと押せる");
  for (const typed of [
    "",
    "株式会社ENGINE",
    `${WS_NAME} `,
    ` ${WS_NAME}`,
    "株式会社engine base",
    "株式会社ＥＮＧＩＮＥ ＢＡＳＥ",
  ]) {
    await nameField(page).fill(typed);
    await expect(go(page), JSON.stringify(typed)).toBeDisabled();
  }
  await nameField(page).fill(WS_NAME);
  await expect(go(page)).toBeEnabled();
  await expect(dlg(page)).toContainText("名前が合いました");
});

test("K832-UI-004 押すと requestWorkspaceDeletion を {confirm_name} で 1 回 → 小窓が閉じ、帯「あと 14 日」・「手続き中」の札が出て「消す手続き」のボタンは無くなる。設定を 1 回だけ読み直す（始めた人の名前を読む）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("deletion")).toBe(1);
  expect(mk.last("deletion")!.body).toEqual({ confirm_name: WS_NAME });
  await expect(band(page)).toContainText("このワークスペースは、消す手続き中です（あと 14 日）");
  await expect(band(page)).toContainText("手続きを始めた人：高本 聖斗");
  await expect(card(page, "ワークスペースを消す")).toContainText("手続き中");
  await expect(card(page, "ワークスペースを消す").getByRole("button", { name: "消す手続き", exact: true })).toHaveCount(
    0,
  );
  expect(mk.count("settings")).toBe(2);
});

test("K832-UI-005 本人確認の取り直し：403 STEP_UP_REQUIRED で小窓（「ワークスペースを消す手続きを始める前に、本人か確かめます」）→ パスワードで確かめると stepUp 1 回 → 同じ体でもう 1 回だけ requestWorkspaceDeletion（押し直させない）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("deletion", err(403, "STEP_UP_REQUIRED"));
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).click();
  await expect(stepDlg(page)).toContainText("ワークスペースを消す手続きを始める前に、本人か確かめます");
  await passStepUp(page);
  await expect(stepDlg(page)).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.count("deletion")).toBe(2);
  expect(mk.of("deletion")[1]!.body).toEqual({ confirm_name: WS_NAME });
  await expect(band(page)).toContainText("あと 14 日");
});

test("K832-UI-006 取り直しを「やめる」：stepUp 0 回・やり直し 0 回・名前の小窓に戻る（打った名前は残る）・帯は出ない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("deletion", err(403, "STEP_UP_REQUIRED"));
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).click();
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stepDlg(page)).toHaveCount(0);
  await expect(nameField(page)).toHaveValue(WS_NAME);
  expect(mk.count("stepUp")).toBe(0);
  expect(mk.count("deletion")).toBe(1);
  await expect(band(page)).toHaveCount(0);
});

test("K832-UI-007 取り直しのパスワードが違う（401 STEP_UP_FAILED）：取り直しの小窓は閉じず欄の下に口の文。消す手続きの口は 1 回のまま", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("deletion", err(403, "STEP_UP_REQUIRED"));
  mk.queue("stepUp", err(401, "STEP_UP_FAILED"));
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).click();
  await passStepUp(page);
  await expect(stepDlg(page)).toBeVisible();
  await expect(stepDlg(page).getByRole("alert").or(stepDlg(page).locator(".k-err"))).toBeVisible();
  expect(mk.count("deletion")).toBe(1);
});

test("K832-UI-008 口の最後の砦（409 E-WS-030 名前が合っていません）：欄の下に口の文・小窓は開いたまま・打ち直して送り直せる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("deletion", err(409, "E-WS-030"));
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).click();
  await expect(dlg(page)).toContainText("名前が合っていません");
  await expect(dlg(page)).toBeVisible();
  await go(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("deletion")).toBe(2);
});

test("K832-UI-009 すでに手続き中（409 E-WS-031・ほかの管理者が先に始めた）：小窓を閉じ、設定を読み直して帯を出す。口は 1 回", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("deletion", err(409, "E-WS-031"));
  await openAt(page, owner.token, PATH);
  // 最初の読み（手続き前）が出てから、ほかの管理者が始めた後の答えに替える（先に替えると最初の読みが手続き中になり［消す手続き］が出ない）
  await expect(
    card(page, "ワークスペースを消す").getByRole("button", { name: "消す手続き", exact: true }),
  ).toBeVisible();
  mk.state.settings = deleting();
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(band(page)).toContainText("あと 13 日");
  expect(mk.count("deletion")).toBe(1);
  expect(mk.count("settings")).toBe(2);
});

test("K832-UI-010 失敗（503）：小窓の中に Kaname の調子が悪い旨の赤い箱・小窓は開いたまま・もう一度押せる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("deletion", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).click();
  await expect(dlg(page)).toContainText("Kaname の調子が悪くなっています");
  await expect(go(page)).toBeEnabled();
  await go(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("deletion")).toBe(2);
});

test("K832-UI-011 押せる人でなくなった直後（403 FORBIDDEN・「誰ができるか」が変わった）：小窓を閉じ「この画面を見る権限がありません」の画面に替える", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("deletion", err(403, "FORBIDDEN"));
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).click();
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("deletion")).toBe(1);
});

test("K832-UI-012 二度押し：答えを待つ間は主ボタンが処理中で、続けて押しても口は 1 回", async ({ page }) => {
  const mk = await mockOps(page);
  const release = mk.hold("deletion");
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).dblclick();
  await expect.poll(() => mk.count("deletion")).toBe(1);
  release();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("deletion")).toBe(1);
});

test("K832-UI-013 小窓を「やめる」・Esc で閉じる：口 0 回。次に開くと名前の欄は空に戻っている", async ({ page }) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await dlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  await openDlg(page);
  await expect(nameField(page)).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("deletion")).toBe(0);
});

test("K832-UI-014 手続き中の設定を直に開く：帯（赤）「このワークスペースは、消す手続き中です（あと 13 日）」・「手続きを始めた人：高本 聖斗 ・ 11/09 10:12」・「本人確認して取り消す」・札「手続き中」。読みは 1 回", async ({
  page,
}) => {
  const mk = await mockOps(page, { settings: deleting() });
  await openAt(page, owner.token, PATH);
  await expect(band(page)).toContainText("このワークスペースは、消す手続き中です（あと 13 日）");
  await expect(band(page)).toContainText(`手続きを始めた人：高本 聖斗 ・ ${jst(DELETING.requested_at)}`);
  await expect(cancel(page)).toBeVisible();
  await expect(card(page, "ワークスペースを消す")).toContainText("手続き中");
  expect(mk.count("settings")).toBe(1);
});

test("K832-UI-015 取り消す：cancelWorkspaceDeletion を 1 回 → 帯が消え「消す手続き」が戻る。設定を 1 回だけ読み直す。開き直しても帯は無い", async ({
  page,
}) => {
  const mk = await mockOps(page, { settings: deleting() });
  await openAt(page, owner.token, PATH);
  await cancel(page).click();
  await expect(band(page)).toHaveCount(0);
  await expect(
    card(page, "ワークスペースを消す").getByRole("button", { name: "消す手続き", exact: true }),
  ).toBeVisible();
  expect(mk.count("cancelDeletion")).toBe(1);
  expect(mk.count("settings")).toBe(2);
  await page.reload();
  await expect(band(page)).toHaveCount(0);
});

test("K832-UI-016 取り消しの本人確認：403 STEP_UP_REQUIRED で取り直しの小窓（「消す手続きを取り消す前に、本人か確かめます」）→ stepUp 1 回 → 取り消しはもう 1 回だけ。やめると 0 回で帯は残る", async ({
  page,
}) => {
  const mk = await mockOps(page, { settings: deleting() });
  // やめた後の押し直しは送らず取り直しの小窓から・取り直した後に 1 回だけ送る（口 2 回・K-820 の形に揃える PM の決め 2026-11-28）
  mk.queue("cancelDeletion", err(403, "STEP_UP_REQUIRED"));
  await openAt(page, owner.token, PATH);
  await cancel(page).click();
  await expect(stepDlg(page)).toContainText("消す手続きを取り消す前に、本人か確かめます");
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  expect(mk.count("stepUp")).toBe(0);
  await expect(band(page)).toBeVisible();
  await cancel(page).click();
  await passStepUp(page);
  await expect(band(page)).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.count("cancelDeletion")).toBe(2);
});

test("K832-UI-017 14 日を過ぎた（409 E-WS-032）：帯の下に口の文を赤い箱で出し、設定を読み直す。帯の「取り消す」はそのまま", async ({
  page,
}) => {
  const mk = await mockOps(page, { settings: deleting() });
  mk.queue("cancelDeletion", err(409, "E-WS-032"));
  await openAt(page, owner.token, PATH);
  await cancel(page).click();
  await expect(page.getByText("取り消せる 14 日を過ぎました", { exact: false })).toBeVisible();
  await expect.poll(() => mk.count("settings")).toBe(2);
});

test("K832-UI-018 すでに取り消されていた（409 E-WS-033・ほかの管理者が先に取り消した）：設定を読み直して帯が消える", async ({
  page,
}) => {
  const mk = await mockOps(page, { settings: deleting() });
  await openAt(page, owner.token, PATH);
  // 最初の読み（手続き中）が帯に出てから、ほかの管理者が取り消した後の答えに替える（先に替えると最初の読みが取り消し後の答えになる）
  await expect(cancel(page)).toBeVisible();
  mk.queue("cancelDeletion", err(409, "E-WS-033"));
  mk.state.settings = settings();
  await cancel(page).click();
  await expect(band(page)).toHaveCount(0);
  expect(mk.count("settings")).toBe(2);
});

test("K832-UI-019 取り消しの失敗（503）：帯は残り、Kaname の調子が悪い旨の赤い箱。もう一度押せる", async ({ page }) => {
  const mk = await mockOps(page, { settings: deleting() });
  mk.queue("cancelDeletion", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await cancel(page).click();
  await expect(page.getByText("Kaname の調子が悪くなっています", { exact: false })).toBeVisible();
  await expect(band(page)).toBeVisible();
  await cancel(page).click();
  await expect(band(page)).toHaveCount(0);
  expect(mk.count("cancelDeletion")).toBe(2);
});

test("K832-UI-020 手続き中も全員いつもどおり使える（D-154.5）：名前の保存・ロゴ・誰ができるかの ▾ が押せる形のまま・保存は送られる・左のバーと第 2 ナビも使える", async ({
  page,
}) => {
  const mk = await mockOps(page, { settings: deleting() });
  await openAt(page, owner.token, PATH);
  const name = page.getByLabel("名前", { exact: true });
  await expect(name).toBeEnabled();
  await name.fill("手続き中の名前");
  await name.press("Enter");
  await expect.poll(() => mk.count("rename")).toBe(1);
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await expect(card(page, "誰ができるか").locator(".k-set-row").first().getByRole("button")).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByRole("link", { name: "メンバー", exact: true }).first()).toHaveAttribute("href", "/members");
});

test("K832-UI-021 始めた人が分からない（requested_by が null）：「手続きを始めた人」の行を出さない（落ちない）。あと 1 日・あと 0 日の字", async ({
  page,
}) => {
  const mk = await mockOps(page, {
    settings: settings({ deletion: { ...DELETING, requested_by: null, days_left: 1 } }),
  });
  await openAt(page, owner.token, PATH);
  await expect(band(page)).toContainText("あと 1 日");
  await expect(band(page)).not.toContainText("手続きを始めた人");
  mk.state.settings = settings({ deletion: { ...DELETING, days_left: 0 } });
  await page.reload();
  await expect(band(page)).toContainText("あと 0 日");
});

test("K832-UI-022 書き出しは作らない：小窓に「先に書き出せる」「書き出す」「ダウンロード」の字・ボタンが無い（D-154.4）", async ({
  page,
}) => {
  await mockOps(page);
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  for (const t of ["先に書き出", "書き出す", "ダウンロード", "エクスポート"]) {
    await expect(dlg(page)).not.toContainText(t);
  }
});

test("K832-UI-023 幅 320・375・768・1024・1440：横のはみ出し 0（数値）。小窓を開いた状態・手続き中の帯・長い名前でも 0", async ({
  page,
}) => {
  const long = "長".repeat(100);
  const mk = await mockOps(page, {
    settings: settings({ workspace: { id: "w", name: long, logo: { kind: "text", url: null } } }),
  });
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAt(page, owner.token, PATH, w);
    await openDlg(page);
    expect(await overflowX(page), `小窓 幅 ${w}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
  }
  mk.state.settings = settings({ deletion: { ...DELETING } });
  for (const w of [320, 768]) {
    await openAt(page, owner.token, PATH, w);
    await expect(band(page)).toBeVisible();
    expect(await overflowX(page), `帯 幅 ${w}`).toBeLessThanOrEqual(0);
  }
});

test("K832-UI-024 「誰ができるか」で可になった人（口の access・D-154.83）：消すが可の人（管理者でない）は「消す手続き」を押して小窓から始められる（口 1 回）。支払いだけが可の人には、手続き中の帯は出るが「本人確認して取り消す」は押せない形で口を呼ばない", async ({
  page,
}) => {
  const mk = await mockOps(page, {
    settings: settings({ access: { admin: false, billing: false, delete_workspace: true } }),
  });
  await openAt(page, owner.token, PATH);
  await openDlg(page);
  await nameField(page).fill(WS_NAME);
  await go(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("deletion")).toBe(1);
  const mk2 = await mockOps(page, {
    settings: settings({ deletion: { ...DELETING }, access: { admin: false, billing: true, delete_workspace: false } }),
  });
  await openAt(page, owner.token, PATH);
  await expect(band(page)).toContainText("このワークスペースは、消す手続き中です（あと 13 日）");
  await expect(cancel(page)).toHaveAttribute("aria-disabled", "true");
  await cancel(page).click({ force: true });
  expect(mk2.count("cancelDeletion")).toBe(0);
});
