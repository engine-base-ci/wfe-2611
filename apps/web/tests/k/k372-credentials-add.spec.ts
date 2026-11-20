// K-372「預けたログイン情報の画面の預ける小窓（本人確認して保存）を口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   K-356 の試験から行を移した（行は消さない・行 ID だけ K356-UI-0xx から K372-UI-0xx に振り直した。元の番号は各行の題の後ろの（元 K356-UI-0xx））。
//   正のモック：/dev/mock/f3/cred-add-login・cred-add-key・cred-add-error・cred-stepup（本番と同じ部品 features/F3/credentials/views.tsx・代表 OK answer=0a262be577b2）。
//   モックとの見た目の比べ方は共通の道具 stage2-match.ts の matchMock だけ（base は /dev/mock/f3・K-335 が足した口）。口の差し替えと手順は共通の道具 credentials-mock.ts（K-356 が持つ）。
//   ログイン・外枠・段の門（RequireSetup）・役（RequireRole）は本物（signupViaApi・loginAs）。預けたログイン情報の口（listCredentials・createCredential）・
//     getMySecurity・stepUp だけを網の手前で差し替える（口の葉 K-351・K-352 と同時に書いているため。形は K-356 の「## 画面が読む値と送る値」）。
//   本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。固定の待ちは使わない（答えと移り終わりを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { admin, loginAs } from "../_lib/api";
import {
  PATH,
  SEC,
  WIDTHS,
  WS_NAME,
  msg,
  FAKE_PW,
  FAKE_VALUE,
  FAKE_TOTP,
  STEP_PW,
  USER_MAIL,
  P1,
  LIST,
  err,
  fieldErr,
  mockApi,
  type Mock,
  person,
  openList,
  row,
  addBtn,
  addDialog,
  checkDialog,
  save,
  choose,
  fillLogin,
  openAdd,
  DIALOG_PAIRS,
  DLG,
  type PairsOptions,
} from "./credentials-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K372_WRONG_STEP_PW } from "../../test/_fake/secrets";

test.use({ timezoneId: "Asia/Tokyo" });

// ---------------------------------------------------------------- モックと本番の突き合わせ（共通の道具 matchMock）
/** 小窓の状態：本番で開く手順 */
const DIALOG_PROD: Record<string, { o?: Partial<Mock>; act: (p: Page) => Promise<void> }> = {
  "cred-add-login": {
    act: async (p) => {
      await openAdd(p);
      await fillLogin(p, { destinations: "hacchu-navi.example" });
    },
  },
  "cred-add-key": {
    act: async (p) => {
      await openAdd(p);
      await choose(p, "種類", "API キー・値");
      await addDialog(p).getByLabel("名前", { exact: true }).fill("FREEE_API_KEY");
    },
  },
  "cred-add-error": {
    o: {
      once: { create: fieldErr({ name: "名前は英大文字と _ だけ。この名前は、このワークスペースにもうあります" }) },
    },
    act: async (p) => {
      await openAdd(p);
      await choose(p, "種類", "API キー・値");
      await addDialog(p).getByLabel("名前", { exact: true }).fill("freee-api-key");
      await addDialog(p).getByLabel("値", { exact: true }).fill("k356-value");
      await addDialog(p).getByLabel("使える場所").fill("api.freee.co.jp");
      await save(p).click();
      await expect(addDialog(p)).toContainText("名前は英大文字と _ だけ。この名前は、このワークスペースにもうあります");
    },
  },
  "cred-stepup": {
    o: { needStepUp: true },
    act: async (p) => {
      await openAdd(p);
      await fillLogin(p);
      await save(p).click();
      await expect(checkDialog(p)).toBeVisible();
    },
  },
};
for (const [id, c] of Object.entries(DIALOG_PROD)) {
  for (const w of MATCH_WIDTHS) {
    test(`K372-UI-001 ${id} 幅 ${w}：小窓（箱・題・補足・項目名・欄・選ぶ欄・注・誤りの文・注の箱・ボタン）の値がモックと同じ（元 K356-UI-002）`, async ({
      browser,
    }) => {
      const u = await person();
      const opts: PairsOptions = { pairs: DIALOG_PAIRS, base: "/dev/mock/f3", blur: true };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await loginAs(page, u.token);
          await mockApi(page, LIST, c.o);
          await openList(page, w);
          await c.act(page);
          await expect(page.locator(DLG).last()).toBeVisible();
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("dlg-title");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 預ける

test("K372-UI-002 預ける（ログイン情報）：入れて「本人確認して保存」→ POST /api/v1/credentials が 1 回・体は決めた形。小窓が閉じ、一覧を読み直して新しい行（札「確かめている」）が出る。パスワードは画面に残らない（元 K356-UI-010）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST);
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  await expect(addDialog(page)).toHaveCount(0);
  await expect(
    row(page, "HACCHU_NAVI_LOGIN").filter({ hasText: "www.hacchu-navi.example" }).locator(".k-set-pill"),
  ).toHaveText("確かめている");
  expect(m.creates).toEqual([
    {
      kind: "login",
      layer: "workspace",
      name: "HACCHU_NAVI_LOGIN",
      description: "発注ナビのログイン",
      login: USER_MAIL,
      password: FAKE_PW,
      two_factor: "sms",
      destinations: ["hacchu-navi.example", "www.hacchu-navi.example"],
      expires_on: "2027-11-10",
    },
  ]);
  expect(m.reads).toBe(2);
  expect(await page.content()).not.toContain(FAKE_PW);
});

test("K372-UI-003 預ける（API キー・値）：種類を替えるとログイン ID・パスワード・2 段階の欄が消え「値」が出る。体は kind key と value（login・password・two_factor を送らない）。説明が空なら送らない（元 K356-UI-011）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST);
  await openList(page);
  await openAdd(page);
  await choose(page, "種類", "API キー・値");
  const d = addDialog(page);
  await expect(d.getByLabel("ログイン ID")).toHaveCount(0);
  await expect(d.getByRole("combobox", { name: "2 段階の種類" })).toHaveCount(0);
  await d.getByLabel("名前", { exact: true }).fill("FREEE_API_KEY_2");
  await d.getByLabel("値", { exact: true }).fill(FAKE_VALUE);
  await d.getByLabel("使える場所").fill("api.freee.co.jp");
  await save(page).click();
  await expect(d).toHaveCount(0);
  expect(m.creates).toEqual([
    {
      kind: "key",
      layer: "workspace",
      name: "FREEE_API_KEY_2",
      value: FAKE_VALUE,
      destinations: ["api.freee.co.jp"],
    },
  ]);
});

test("K372-UI-004 2 段階が「認証アプリ（鍵を預ける）」のときだけ「認証アプリの鍵」の欄が出て、体に totp_secret が入る（SMS に戻すと欄が消え、送らない）（元 K356-UI-012）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST);
  await openList(page);
  await openAdd(page);
  await fillLogin(page, { name: "TOTP_SITE" });
  const d = addDialog(page);
  await expect(d.getByLabel("認証アプリの鍵")).toHaveCount(0);
  await choose(page, "2 段階の種類", "認証アプリ（鍵を預ける）");
  await d.getByLabel("認証アプリの鍵").fill(FAKE_TOTP);
  await save(page).click();
  await expect(d).toHaveCount(0);
  expect(m.creates[0]).toMatchObject({ two_factor: "totp", totp_secret: FAKE_TOTP });
  await openAdd(page);
  await fillLogin(page, { name: "SMS_SITE" });
  await choose(page, "2 段階の種類", "認証アプリ（鍵を預ける）");
  await choose(page, "2 段階の種類", "SMS");
  await expect(d.getByLabel("認証アプリの鍵")).toHaveCount(0);
  await save(page).click();
  await expect(d).toHaveCount(0);
  expect(m.creates[1]).not.toHaveProperty("totp_secret");
});

test("K372-UI-005 表記ゆらぎ：名前は NFKC・前後の空白を取り・大文字に（ｈａｃｃｈｕ＿ｎａｖｉ → HACCHU_NAVI）。使える場所はカンマ・読点・空白で区切り、NFKC・小文字・空は捨てる。期限の / は - に（元 K356-UI-013）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST);
  await openList(page);
  await openAdd(page);
  await fillLogin(page, {
    name: "  ｈａｃｃｈｕ＿ｎａｖｉ ",
    destinations: " Hacchu-Navi.Example、ＡＰＩ.example.com ,, ",
    expires: " 2027/1/5 ",
  });
  await save(page).click();
  await expect(addDialog(page)).toHaveCount(0);
  expect(m.creates[0]).toMatchObject({
    name: "HACCHU_NAVI",
    destinations: ["hacchu-navi.example", "api.example.com"],
    expires_on: "2027-01-05",
  });
});

test("K372-UI-006 預ける先を「自分だけ」にして保存 → 体の layer は personal。「自分だけ」のタブに替わり、新しい行が出る（元 K356-UI-014）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST);
  await openList(page);
  await openAdd(page);
  await fillLogin(page, { name: "MY_OWN_LOGIN" });
  await choose(page, "預ける先", "自分だけ");
  await save(page).click();
  await expect(addDialog(page)).toHaveCount(0);
  expect(m.creates[0]).toMatchObject({ layer: "personal" });
  await expect(page.locator(SEC).getByRole("tab", { name: "自分だけ" })).toHaveAttribute("aria-selected", "true");
  await expect(row(page, "MY_OWN_LOGIN")).toHaveCount(1);
});

test("K372-UI-007 口の 422：欄ごとの文（名前・使える場所・パスワード・期限）をその欄の下に出す。小窓は開いたまま・入れた値は残る・もう一度押せる（元 K356-UI-015）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  await mockApi(page, LIST, {
    once: {
      create: fieldErr({
        name: "名前は英大文字と _ にしてください",
        destinations: "使える場所を 1 つ以上入れてください",
        password: "パスワードを入れてください",
        expires_on: "期限は今日より後の日にしてください",
      }),
    },
  });
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  const d = addDialog(page);
  const field = (label: string) => d.locator(".k-field", { has: page.getByLabel(label, { exact: true }) });
  await expect(field("名前")).toContainText("名前は英大文字と _ にしてください");
  await expect(field("使える場所")).toContainText("使える場所を 1 つ以上入れてください");
  await expect(field("パスワード")).toContainText("パスワードを入れてください");
  await expect(field("期限（任意）")).toContainText("期限は今日より後の日にしてください");
  await expect(d.getByLabel("名前", { exact: true })).toHaveValue("HACCHU_NAVI_LOGIN");
  await expect(d.getByLabel("ログイン ID")).toHaveValue(USER_MAIL);
  await expect(save(page)).toBeEnabled();
});

test("K372-UI-008 口の 409（同じ預ける先に同じ名前がある）：口の文を名前の欄の下に出す（モック cred-add-error の場所）。小窓は開いたまま（元 K356-UI-016）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const dup = "この名前は、このワークスペースにもうあります";
  await mockApi(page, LIST, { once: { create: err(409, "CREDENTIAL_NAME_TAKEN", dup) } });
  await openList(page);
  await openAdd(page);
  await fillLogin(page, { name: "GMAIL_WORK" });
  await save(page).click();
  const d = addDialog(page);
  await expect(d.locator(".k-field", { has: page.getByLabel("名前", { exact: true }) })).toContainText(dup);
  await expect(d).toBeVisible();
});

test("K372-UI-009 本人確認の取り直し：口が 403 STEP_UP_REQUIRED → 預ける小窓が閉じ、取り直しの小窓（理由「ログイン情報を預ける前に、本人か確かめます」・パスワードの欄）。getMySecurity はこのとき 1 回。通ると同じ体で預けるをもう 1 回呼び、行が出る（元 K356-UI-017）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST, { needStepUp: true });
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  await expect(checkDialog(page)).toBeVisible();
  await expect(checkDialog(page)).toContainText("ログイン情報を預ける前に、本人か確かめます");
  await expect(addDialog(page)).toHaveCount(0);
  expect(m.securityReads).toBe(1);
  await checkDialog(page).getByLabel("パスワード", { exact: true }).fill(STEP_PW);
  await checkDialog(page).getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(checkDialog(page)).toHaveCount(0);
  await expect(row(page, "www.hacchu-navi.example")).toHaveCount(1);
  expect(m.stepUps).toEqual([{ password: STEP_PW }]);
  expect(m.creates).toHaveLength(2);
  expect(m.creates[1]).toEqual(m.creates[0]);
});

test("K372-UI-010 取り直しで「やめる」：預けるはもう呼ばない（1 回のまま）。預ける小窓に戻り、入れた値（パスワードも）が残る（元 K356-UI-018）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST, { needStepUp: true });
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  await checkDialog(page).getByRole("button", { name: "やめる" }).click();
  await expect(checkDialog(page)).toHaveCount(0);
  await expect(addDialog(page)).toBeVisible();
  await expect(addDialog(page).getByLabel("名前", { exact: true })).toHaveValue("HACCHU_NAVI_LOGIN");
  await expect(addDialog(page).getByLabel("パスワード", { exact: true })).toHaveValue(FAKE_PW);
  expect(m.creates).toHaveLength(1);
  expect(m.stepUps).toHaveLength(0);
});

test("K372-UI-011 手順 S3 の失敗：取り直しの口が 401 STEP_UP_FAILED（違うパスワード）→ 取り直しの小窓に口の文・閉じない。通った後も預けるが 403 STEP_UP_REQUIRED → 2 回目は取り直しを開かず、預ける小窓に戻って赤の知らせ（口の文）。預けるは 2 回まで（元 K356-UI-019）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const wrong = "パスワードが違います";
  const again = "本人確認を取り直してから、もう一度押してください";
  const m = await mockApi(page, LIST, {
    needStepUp: true,
    once: { stepUp: err(401, "STEP_UP_FAILED", wrong) },
  });
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  await checkDialog(page).getByLabel("パスワード", { exact: true }).fill(K372_WRONG_STEP_PW);
  await checkDialog(page).getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(checkDialog(page)).toContainText(wrong);
  expect(m.creates).toHaveLength(1);
  await checkDialog(page).getByLabel("パスワード", { exact: true }).fill(STEP_PW);
  // 取り直しの後の預けるは 403（口の文つき）
  m.once.create = err(403, "STEP_UP_REQUIRED", again);
  await checkDialog(page).getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(addDialog(page)).toBeVisible();
  await expect(addDialog(page).locator('[role="alert"]')).toHaveText(new RegExp(again));
  await expect(checkDialog(page)).toHaveCount(0);
  expect(m.creates).toHaveLength(2);
  expect(m.stepUps).toHaveLength(2);
});

test("K372-UI-012 2 段階を付けている人の取り直し：取り直しの小窓に 6 けたの枠も出る（getMySecurity の two_factor が true）（元 K356-UI-020）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  await mockApi(page, LIST, { needStepUp: true, twoFactor: true });
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  await expect(checkDialog(page).locator(".k-login-code-box")).toHaveCount(6);
});

test("K372-UI-013 二度押し：答えを止めた間に「本人確認して保存」を 2 回押しても、預けるの口は 1 回。待っている間ボタンは押せない（元 K356-UI-021）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST, { holdCreate: true });
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  const sent = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/v1/credentials");
  await save(page).click();
  await sent;
  await save(page).click({ force: true });
  await expect(save(page)).toBeDisabled();
  expect(m.creates).toHaveLength(1);
});

test("K372-UI-014 失敗：預けるの口が 503 → 小窓の中に赤の知らせ（口の文）・閉じない・値が残る・もう一度押せる。網が切れたとき → 正本 E-PAGE-008 の文（元 K356-UI-022）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const down = "いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください";
  const m = await mockApi(page, LIST, { once: { create: err(503, "SERVICE_UNAVAILABLE", down) } });
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  const alert = addDialog(page).locator('[role="alert"]');
  await expect(alert).toHaveText(new RegExp(down));
  await expect(addDialog(page).getByLabel("名前", { exact: true })).toHaveValue("HACCHU_NAVI_LOGIN");
  await expect(save(page)).toBeEnabled();
  m.once.create = "abort";
  await save(page).click();
  await expect(alert).toHaveText(new RegExp(msg("E-PAGE-008")));
  expect(m.creates).toHaveLength(2);
});

test("K372-UI-015 ログインが切れた（預けるの口が 401）：小窓に正本 E-PAGE-005 の文。小窓は閉じず、ページは移らない（元 K356-UI-023）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  await mockApi(page, LIST, { once: { create: err(401, "UNAUTHENTICATED") } });
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  await expect(addDialog(page).locator('[role="alert"]')).toHaveText(new RegExp(msg("E-PAGE-005")));
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));
});

test("K372-UI-016 「やめる」と Esc：何も送らず小窓が閉じる。次に開くと欄は空（前の入力を残さない・既定は ログイン情報・ワークスペース・SMS でなく なし）（元 K356-UI-024）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST);
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await addDialog(page).getByRole("button", { name: "やめる" }).click();
  await expect(addDialog(page)).toHaveCount(0);
  await openAdd(page);
  const d = addDialog(page);
  await expect(d.getByLabel("名前", { exact: true })).toHaveValue("");
  await expect(d.getByLabel("パスワード", { exact: true })).toHaveValue("");
  await expect(d.getByRole("combobox", { name: "種類" })).toContainText("ログイン情報（ID とパスワード）");
  await expect(d.getByRole("combobox", { name: "2 段階の種類" })).toContainText("なし");
  await expect(d.getByRole("combobox", { name: "預ける先" })).toContainText(WS_NAME);
  await page.keyboard.press("Escape");
  await expect(d).toHaveCount(0);
  expect(m.creates).toEqual([]);
});

test("K372-UI-017 はじめの設定の段 4（D-089）：段 3 まで通した人が 1 件預けると members.setup_step が 4 になる（段を通す口を 1 回）。通し終えた人（段 6）は段を通す口を呼ばない（元 K356-UI-026）", async ({
  page,
  browser,
}) => {
  const u = await person(3);
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST);
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  await expect(addDialog(page)).toHaveCount(0);
  await expect
    .poll(
      async () => (await admin<{ s: number }>("select setup_step as s from members where id = $1", [u.memberId]))[0]!.s,
    )
    .toBe(4);
  expect(m.setupStepCalls).toBe(1);

  const done = await person(6);
  const p2 = await browser.newPage();
  await loginAs(p2, done.token);
  const m2 = await mockApi(p2, LIST);
  await openList(p2);
  await openAdd(p2);
  await fillLogin(p2);
  await save(p2).click();
  await expect(addDialog(p2)).toHaveCount(0);
  await expect(row(p2, "www.hacchu-navi.example")).toHaveCount(1);
  expect(m2.setupStepCalls).toBe(0);
  await p2.close();
});

test("K372-UI-018 手順 S4 の失敗：段を通す口（/api/auth-ext/setup-step）が 503 でも、預けたことは成功のまま（小窓が閉じ・行が出る・赤の知らせを出さない）。段は 3 のまま（次に預けたときにもう一度通す）（元 K356-UI-028）", async ({
  page,
}) => {
  const u = await person(3);
  await loginAs(page, u.token);
  await page.route(/\/api\/auth-ext\/setup-step$/, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "down", code: "DOWN" }),
    }),
  );
  const m = await mockApi(page, LIST);
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  const marked = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/auth-ext/setup-step");
  await save(page).click();
  await marked;
  await expect(addDialog(page)).toHaveCount(0);
  await expect(row(page, "www.hacchu-navi.example")).toHaveCount(1);
  await expect(page.locator(`${SEC} [role="alert"]`)).toHaveCount(0);
  expect(m.setupStepCalls).toBe(1);
  expect((await admin<{ s: number }>("select setup_step as s from members where id = $1", [u.memberId]))[0]!.s).toBe(3);
});

test("K372-UI-019 幅 320〜1440（預ける小窓）：「預ける」が押せる（K-356 の灰色を外す）・小窓が画面の中で「本人確認して保存」が見える・横溢れ 0（元 K356-UI-027 の小窓の分）", async ({
  page,
}) => {
  test.setTimeout(180_000); // 幅 5 つ × 開き直しと person() を 1 本で流す（台が混んでも既定 60 秒で落ちない）
  const u = await person();
  await loginAs(page, u.token);
  await mockApi(page, [...LIST, P1]);
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  for (const w of WIDTHS) {
    await openList(page, w);
    await expect(addBtn(page), `幅 ${w} の「預ける」`).toBeEnabled();
    await openAdd(page);
    const b = await page.locator(DLG).last().boundingBox();
    const vw = await page.evaluate(() => window.innerWidth);
    expect(b).not.toBeNull();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(vw + 0.5);
    await expect(save(page)).toBeInViewport();
    expect(await over(), `幅 ${w} の小窓を開いたときの横溢れ`).toBe(0);
    await addDialog(page).getByRole("button", { name: "やめる" }).click();
    await expect(addDialog(page)).toHaveCount(0);
  }
});

// ---------------------------------------------------------------- 取り直しの後の送り直しが失敗したとき（K-352 の順：422 → 403 E-CRED-007 → 403 STEP_UP_REQUIRED → 409）
const AFTER_STEP_UP: {
  label: string;
  reply: Mock["once"]["create"];
  see: (page: Page) => Promise<void>;
}[] = [
  {
    label: "409 E-CRED-006（同じ名前）",
    reply: err(409, "E-CRED-006", "同じ名前のものがもう預けてあります。別の名前にするか、前のものを上書きしてください"),
    see: async (page) => {
      const d = addDialog(page);
      await expect(d.locator(".k-field", { has: page.getByLabel("名前", { exact: true }) })).toContainText(
        "同じ名前のものがもう預けてあります",
      );
    },
  },
  {
    label: "422（欄ごとの文）",
    reply: fieldErr({ destinations: "使える場所を 1 つ以上入れてください" }),
    see: async (page) => {
      const d = addDialog(page);
      await expect(d.locator(".k-field", { has: page.getByLabel("使える場所", { exact: true }) })).toContainText(
        "使える場所を 1 つ以上入れてください",
      );
    },
  },
  {
    label: "503（調子が悪い）",
    reply: err(
      503,
      "SERVICE_UNAVAILABLE",
      "いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください",
    ),
    see: async (page) => {
      await expect(addDialog(page).locator('[role="alert"]')).toHaveText(/いま Kaname の調子が悪くなっています/);
    },
  },
  {
    label: "401（ログインが切れた）",
    reply: err(401, "UNAUTHENTICATED"),
    see: async (page) => {
      await expect(addDialog(page).locator('[role="alert"]')).toHaveText(new RegExp(msg("E-PAGE-005")));
      await expect(page).toHaveURL(new RegExp(`${PATH}$`));
    },
  },
];

for (const c of AFTER_STEP_UP) {
  test(`K372-UI-020 取り直しが通った後の送り直しが ${c.label}：取り直しの小窓が閉じ、預ける小窓に戻ってその文を出す。入れた値（名前・パスワード）は残り、もう一度押せる。預けるは 2 回・取り直しは 1 回`, async ({
    page,
  }) => {
    const u = await person();
    await loginAs(page, u.token);
    const m = await mockApi(page, LIST, { needStepUp: true });
    await openList(page);
    await openAdd(page);
    await fillLogin(page);
    await save(page).click();
    await expect(checkDialog(page)).toBeVisible();
    await checkDialog(page).getByLabel("パスワード", { exact: true }).fill(STEP_PW);
    m.once.create = c.reply;
    await checkDialog(page).getByRole("button", { name: "確かめる", exact: true }).click();
    await expect(checkDialog(page)).toHaveCount(0);
    await expect(addDialog(page)).toBeVisible();
    await c.see(page);
    await expect(addDialog(page).getByLabel("名前", { exact: true })).toHaveValue("HACCHU_NAVI_LOGIN");
    await expect(addDialog(page).getByLabel("パスワード", { exact: true })).toHaveValue(FAKE_PW);
    await expect(save(page)).toBeEnabled();
    expect(m.creates).toHaveLength(2);
    expect(m.creates[1]).toEqual(m.creates[0]);
    expect(m.stepUps).toHaveLength(1);
  });
}

test("K372-UI-021 1 回目の 403 が E-CRED-007（ワークスペースに書けない・見るだけの役）：取り直しを開かず（getMySecurity も呼ばない）、預ける小窓の中に赤の知らせ（口の文）。預けるは 1 回・値は残る", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const deny = "ワークスペースに預けたものを変えられるのは管理者だけです。自分だけのものとして預けてください";
  const m = await mockApi(page, LIST, { once: { create: err(403, "E-CRED-007", deny) } });
  await openList(page);
  await openAdd(page);
  await fillLogin(page);
  await save(page).click();
  await expect(addDialog(page).locator('[role="alert"]')).toHaveText(new RegExp(deny));
  await expect(checkDialog(page)).toHaveCount(0);
  await expect(addDialog(page).getByLabel("名前", { exact: true })).toHaveValue("HACCHU_NAVI_LOGIN");
  expect(m.creates).toHaveLength(1);
  expect(m.securityReads).toBe(0);
  expect(m.stepUps).toHaveLength(0);
});
