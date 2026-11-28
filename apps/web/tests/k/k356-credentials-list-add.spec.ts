// K-356「預けたログイン情報の画面を口につなぐ：一覧・空・読めない・自分だけのタブ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f3/cred-list・cred-empty・cred-personal・cred-failed（本番と同じ部品 features/F3/credentials/views.tsx・代表 OK answer=0a262be577b2）。
//   外枠は TicketShell・第 2 ナビは MeSub（current="credentials"）。モックとの見た目の比べ方は共通の道具 stage2-match.ts の matchMock だけ（base は /dev/mock/f3・K-335 が足した口）。
//   預ける小窓（cred-add-*・cred-stepup・本人確認して保存・段 4）は K-372 の試験（k372-credentials-add.spec.ts）。口の差し替えと手順は共通の道具 credentials-mock.ts（この葉が持つ）。
//   ログイン・外枠・段の門（RequireSetup）・役（RequireRole）は本物（signupViaApi・loginAs）。預けたログイン情報の口（listCredentials）だけを網の手前で差し替える。
//   本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。固定の待ちは使わない（答えと移り終わりを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test } from "@playwright/test";
import { loginAs } from "../_lib/api";
import {
  PATH,
  SEC,
  ME_SUB,
  WIDTHS,
  NOW,
  WS_NAME,
  ME_NAME,
  type CheckState,
  type Item,
  lc,
  C1,
  C3,
  C4,
  P1,
  LIST,
  err,
  mockApi,
  type Mock,
  person,
  open,
  openList,
  row,
  addBtn,
  BODY_PAIRS,
  type PairsOptions,
} from "./credentials-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

// ---------------------------------------------------------------- モックと本番の突き合わせ（共通の道具 matchMock）
/** 本文の状態：本番の一覧の答え（タブ・読めない） */
const BODY_PROD: Record<string, { items: Item[]; o?: Partial<Mock>; tab?: "自分だけ" }> = {
  "cred-list": { items: LIST },
  "cred-empty": { items: [] },
  "cred-personal": { items: [...LIST, P1], tab: "自分だけ" },
  "cred-failed": { items: LIST, o: { once: { read: err(503, "SERVICE_UNAVAILABLE") } } },
};
for (const [id, c] of Object.entries(BODY_PROD)) {
  for (const w of MATCH_WIDTHS) {
    test(`K356-UI-001 ${id} 幅 ${w}：外枠の中の本文（見出し・知らせ・タブ・カード・行の名前・中身の位置と字の大きさと字・札・注）の値がモックと同じ（行の操作のボタンの薄さは K-357 まで、「預ける」の薄さは K-372 まで灰色なので比べない）`, async ({
      browser,
    }) => {
      const u = await person();
      const opts: PairsOptions = {
        pairs: BODY_PAIRS,
        base: "/dev/mock/f3",
        skip: ["cred-btn:opacity", "cred-add:opacity"],
      };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await loginAs(page, u.token);
          await mockApi(page, c.items, c.o);
          await openList(page, w);
          if (c.tab) {
            await page.locator(SEC).getByRole("tab", { name: c.tab }).click();
            await expect(page.locator(SEC).getByRole("tab", { name: c.tab })).toHaveAttribute("aria-selected", "true");
          }
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "本文の役で比べた").toContain("cred-h1");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 一覧

test("K356-UI-003 開く：外枠・パンくず「自分の設定 › 預けたログイン情報」・第 2 ナビの今の項目・h1。一覧の口はちょうど 1 回・前の道すじ（/api/auth-ext/vault）は 0 回・getMySecurity は呼ばない", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST);
  await openList(page);
  await expect(page.locator(".k-shell").first()).toBeVisible();
  await expect(page.getByText("自分の設定").first()).toBeVisible();
  await expect(page.locator(ME_SUB).getByRole("link", { name: "預けたログイン情報" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(`${SEC} .k-set-row`)).toHaveCount(4);
  expect(m.reads).toBe(1);
  expect(m.legacy).toEqual([]);
  expect(m.securityReads).toBe(0);
});

test("K356-UI-004 行の中身：名前・説明・使える場所・使われ方（これまでに N 回 ・ 最後 MM/DD／今日／まだ使っていない）・札・補足（コードを待っている（あと N 分）・M/D HH:MM に確かめた・あと N 日で期限）。使うもの（やり方・取引先）・この 1 か月の回数・チケット番号は出さない（代表の答え answer=e34268dbfbac）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  await mockApi(page, LIST);
  await openList(page);
  const detail = (n: string) => row(page, n).locator(".k-set-detail");
  const pill = (n: string) => row(page, n).locator(".k-set-pill");
  await expect(detail("GMAIL_WORK")).toHaveText(
    "会社の Gmail（送信用） ・ 使える場所：mail.google.com・smtp.gmail.comこれまでに 18 回 ・ 最後 11/01",
  );
  await expect(pill("GMAIL_WORK")).toHaveText("使える");
  await expect(detail("HACCHU_NAVI_LOGIN")).toContainText(
    "これまでに 22 回 ・ 最後 今日 ・ SMS のコードを待っている（あと 8 分）",
  );
  await expect(pill("HACCHU_NAVI_LOGIN")).toHaveText("コードが要る");
  await expect(detail("FREEE_API_KEY")).toContainText("これまでに 3 回 ・ 最後 10/29 ・ あと 1 日で期限");
  await expect(pill("FREEE_API_KEY")).toHaveText("期限が近い");
  await expect(detail("SEIKO_PORTAL")).toContainText("これまでに 1 回 ・ 最後 11/01 ・ 11/18 10:20 に確かめた");
  await expect(pill("SEIKO_PORTAL")).toHaveText("パスワードが違う");
  await expect(page.locator(SEC)).not.toContainText("やり方「");
  await expect(page.locator(SEC)).not.toContainText("この 1 か月");
  // 値・参照の番号は画面のどこにも出さない
  await expect(page.locator(SEC)).not.toContainText("vault");
  await expect(page.locator(SEC)).not.toContainText("sec_");
});

test("K356-UI-005 札の決め方（代表の答え answer=e34268dbfbac）：確かめが使える（か鍵）で、期限の 1 日前と当日は「期限が近い」（「あと 1 日で期限」「今日で期限」）・2 日前までは「使える」（期限の補足は出さない）。期限が過ぎていれば「期限が近い」と「期限が過ぎています」。確かめが使えるでなければ確かめの札が先", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  // 今日は日本の 11/18（NOW）
  await mockApi(page, [
    { ...C3, id: "e1", name: "DUE_TOMORROW", expires_on: "2026-11-19" },
    { ...C3, id: "e0", name: "DUE_TODAY", expires_on: "2026-11-18" },
    { ...C3, id: "e2", name: "DUE_IN_2_DAYS", expires_on: "2026-11-20" },
    { ...C3, id: "ep", name: "PAST_DUE", expires_on: "2026-11-10" },
    { ...C4, id: "eb", name: "BAD_AND_SOON", expires_on: "2026-11-19" },
  ]);
  await openList(page);
  await expect(row(page, "DUE_TOMORROW").locator(".k-set-pill")).toHaveText("期限が近い");
  await expect(row(page, "DUE_TOMORROW").locator(".k-set-detail")).toContainText("あと 1 日で期限");
  await expect(row(page, "DUE_TODAY").locator(".k-set-pill")).toHaveText("期限が近い");
  await expect(row(page, "DUE_TODAY").locator(".k-set-detail")).toContainText("今日で期限");
  await expect(row(page, "DUE_IN_2_DAYS").locator(".k-set-pill")).toHaveText("使える");
  await expect(row(page, "DUE_IN_2_DAYS").locator(".k-set-detail")).not.toContainText("期限");
  await expect(row(page, "PAST_DUE").locator(".k-set-pill")).toHaveText("期限が近い");
  await expect(row(page, "PAST_DUE").locator(".k-set-detail")).toContainText("期限が過ぎています");
  await expect(row(page, "BAD_AND_SOON").locator(".k-set-pill")).toHaveText("パスワードが違う");
});

test("K356-UI-006 タブ：ワークスペースの物と自分だけの物を分けて出す（見出しの件数はタブごと）。タブを替えても一覧の口を呼び直さない。使ったことが無い行は「まだ使っていない」", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, [...LIST, P1]);
  await openList(page);
  await expect(page.locator(`${SEC} .k-set-card-head h2`)).toHaveText("4 件");
  await expect(row(page, "MY_NOTE_LOGIN")).toHaveCount(0);
  await page.locator(SEC).getByRole("tab", { name: "自分だけ" }).click();
  await expect(page.locator(`${SEC} .k-set-card-head h2`)).toHaveText("1 件");
  await expect(row(page, "MY_NOTE_LOGIN").locator(".k-set-detail")).toContainText("まだ使っていない");
  await expect(row(page, "GMAIL_WORK")).toHaveCount(0);
  await expect(page.locator(SEC)).toContainText(`ワークスペース（${WS_NAME}）の物は`);
  await expect(page.locator(SEC)).toContainText(`自分だけ（${ME_NAME}）の物は`);
  expect(m.reads).toBe(1);
});

test("K356-UI-007 空：1 件も無い → 「まだ預けていません」のカードと知らせ（自分だけのタブも同じ）。「預ける」は出る（押せるのは K-372 が入ってから・K372-UI-019 が見る）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  await mockApi(page, []);
  await openList(page);
  await expect(page.locator(`${SEC} .k-set-card-head h2`)).toHaveText("まだ預けていません");
  await page.locator(SEC).getByRole("tab", { name: "自分だけ" }).click();
  await expect(page.locator(`${SEC} .k-set-card-head h2`)).toHaveText("まだ預けていません");
  await expect(addBtn(page)).toBeVisible();
});

test("K356-UI-008 読めない：一覧の口が 503 → 赤の箱「預けたログイン情報を読めませんでした。少し待ってから、このページをもう一度開いてください」。網が切れたときも同じ箱。開き直して読めれば一覧", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const m = await mockApi(page, LIST, { once: { read: err(503, "SERVICE_UNAVAILABLE") } });
  await openList(page);
  const failed = page.locator(`${SEC} .k-auth-result[role="alert"]`);
  await expect(failed).toHaveText(
    /預けたログイン情報を読めませんでした。少し待ってから、このページをもう一度開いてください/,
  );
  await expect(page.locator(`${SEC} .k-set-row`)).toHaveCount(0);
  m.once.read = "abort";
  await open(page);
  await expect(failed).toBeVisible();
  await openList(page);
  await expect(page.locator(`${SEC} .k-set-row`)).toHaveCount(4);
});

test("K356-UI-009 ログインが切れた：一覧の口が 401 → /login?next=%2Fsettings%2Fcredentials へ移る", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  await mockApi(page, LIST, { once: { read: err(401, "UNAUTHENTICATED") } });
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto(PATH);
  await page.waitForURL(/\/login\?next=%2Fsettings%2Fcredentials$/);
});

test("K356-UI-025 行の操作はモックどおり出す（キャンバスに在る物は隠さない・D-145.9）：どの行にも「上書き」「消す」、コードが要る行に「コードを入れる」、パスワードが違う行に「もう一度確かめる」。押せるかは K-357 が受け持つ（K-357 が入る前は灰色・後は押せる。どちらでもこの行は通る）", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  await mockApi(page, LIST);
  await openList(page);
  for (const n of ["GMAIL_WORK", "HACCHU_NAVI_LOGIN", "FREEE_API_KEY", "SEIKO_PORTAL"]) {
    await expect(row(page, n).getByRole("button", { name: "上書き", exact: true }), n).toBeVisible();
    await expect(row(page, n).getByRole("button", { name: "消す", exact: true }), n).toBeVisible();
  }
  await expect(
    row(page, "HACCHU_NAVI_LOGIN").getByRole("button", { name: "コードを入れる", exact: true }),
  ).toBeVisible();
  await expect(row(page, "SEIKO_PORTAL").getByRole("button", { name: "もう一度確かめる", exact: true })).toBeVisible();
  await expect(row(page, "GMAIL_WORK").getByRole("button", { name: "もう一度確かめる", exact: true })).toHaveCount(0);
});

test("K356-UI-027 幅 320〜1440（一覧）：横溢れ 0・h1 の 1 文字目が画面の中・タブが溢れない（小窓の幅は K372-UI-019）", async ({
  page,
}) => {
  test.setTimeout(180_000); // 幅 5 つ × 開き直しと person() を 1 本で流す（台が混んでも既定 60 秒で落ちない）
  const u = await person();
  await loginAs(page, u.token);
  await mockApi(page, [...LIST, P1]);
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  for (const w of WIDTHS) {
    await openList(page, w);
    expect(await over(), `幅 ${w} の一覧の横溢れ`).toBe(0);
    const tabs = await page.locator(`${SEC} .k-tabs-list`).evaluate((e) => e.scrollWidth - e.clientWidth);
    expect(tabs, `幅 ${w} のタブ`).toBeLessThanOrEqual(0);
    const x = await page.locator(`${SEC} h1`).evaluate((e) => {
      const r = document.createRange();
      r.setStart(e.firstChild ?? e, 0);
      r.setEnd(e.firstChild ?? e, 1);
      return r.getBoundingClientRect().left;
    });
    expect(x, `幅 ${w} の h1 の 1 文字目`).toBeGreaterThanOrEqual(0);
  }
});

test("K356-UI-029 確かめの状態（login_check.state）から札と補足を決める：null の鍵は使える・null のログインは「まだ確かめていない」・pending／running／waiting は確かめている・no_bridge は PC がつながると確かめる・bad_code はパスワードが違う・needs_2fa／unreachable／no_form／stopped／no_answer は「止まった」と口の detail の文", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  const L = (name: string, state: CheckState | null, detail: string | null = null): Item => ({
    ...C1,
    id: name,
    name,
    login_check: lc(state, { at: "2026-11-18T01:20:00Z", detail }),
  });
  await mockApi(page, [
    { ...C3, id: "k0", name: "KEY_NO_EXPIRY", expires_on: null },
    L("LOGIN_UNCHECKED", null),
    L("S_PENDING", "pending"),
    L("S_RUNNING", "running"),
    L("S_WAITING", "waiting"),
    L("S_NO_BRIDGE", "no_bridge"),
    L("S_BAD_CODE", "bad_code"),
    L("S_NEEDS_2FA", "needs_2fa", "2 段階認証が要ります。上書きで 2 段階の種類を選んでください"),
    L("S_UNREACHABLE", "unreachable", "サービスに届きませんでした"),
    L("S_NO_FORM", "no_form", "ログインの画面が見つかりませんでした"),
    L("S_STOPPED", "stopped", "PC が途中で止まりました"),
    L("S_NO_ANSWER", "no_answer", "10 分のあいだにコードが届かなかったので止めました"),
  ]);
  await openList(page);
  const pill = (n: string) => row(page, n).locator(".k-set-pill");
  await expect(pill("KEY_NO_EXPIRY")).toHaveText("使える");
  await expect(pill("LOGIN_UNCHECKED")).toHaveText("まだ確かめていない");
  for (const n of ["S_PENDING", "S_RUNNING", "S_WAITING"]) await expect(pill(n), n).toHaveText("確かめている");
  await expect(pill("S_NO_BRIDGE")).toHaveText("PC がつながると確かめる");
  await expect(row(page, "S_NO_BRIDGE").locator(".k-set-detail")).toContainText(
    "PC をつなぐと、1 回ログインして確かめる",
  );
  await expect(pill("S_BAD_CODE")).toHaveText("パスワードが違う");
  for (const [n, d] of [
    ["S_NEEDS_2FA", "2 段階認証が要ります。上書きで 2 段階の種類を選んでください"],
    ["S_UNREACHABLE", "サービスに届きませんでした"],
    ["S_NO_FORM", "ログインの画面が見つかりませんでした"],
    ["S_STOPPED", "PC が途中で止まりました"],
    ["S_NO_ANSWER", "10 分のあいだにコードが届かなかったので止めました"],
  ] as const) {
    await expect(pill(n), n).toHaveText("止まった");
    await expect(row(page, n).locator(".k-set-detail"), n).toContainText(`${d} ・ 11/18 10:20 に確かめた`);
  }
});
