// K-840「メールを変える小窓と、確かめのリンクの先（/account/email-confirm）を口 requestEmailChange・verifyEmailChange につなぐ：形の誤り・もう使われている・送った・変わった／期限切れ／使った後」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f10 の me-email・me-email-error・me-email-sent・me-email-done（本番と同じ部品 features/F10/account/dialogs.tsx・profile.tsx・代表 OK 2026-11-22）。
//   ログイン・外枠・役は本物。メールを変える口と自分の読み（K-833・K-835）・本人確認の取り直しだけを網の手前で差し替える（f10-ops-kit.ts）。メールの送出は口の側（関門 C6）で、画面は送れたかどうかの答えだけを見る。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { signupViaApi } from "../_lib/api";
import { MOCK_BASE, WS_NAME, openAt, overflowX, passStepUp, stepDlg } from "./f10-kit";
import { ME_PAIRS, err, fpair, me, mockOps, ok } from "./f10-ops-kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const PATH = "/account";
const CONFIRM = "/account/email-confirm?token=tok-1";
const NEW = "new-takamoto@engine-base.example";
const OLD = "takamoto@engine-base.example";
const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const mailRow = (page: Page) => card(page, "自分").locator(".k-set-row").filter({ hasText: "メール" });
const dlg = (page: Page) => page.getByRole("dialog", { name: "メールを変える", exact: true });
const next = (page: Page) => dlg(page).getByLabel("新しいメール", { exact: true });
const send = (page: Page) => dlg(page).getByRole("button", { name: "本人確認して送る", exact: true });
const open = async (page: Page) => {
  await mailRow(page).getByRole("button", { name: "変える", exact: true }).click();
  await expect(dlg(page)).toBeVisible();
};
const BAD_FORM = "メールの形が違います。「名前@会社.example」のように入れてください";
const TAKEN = "このメールは、もう別のアカウントで使われています。別のメールを入れてください";
const PENDING = me({ member: { email_pending: NEW } });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi(WS_NAME);
});

const STATES: Record<string, { me?: ReturnType<typeof me>; drive?: (page: Page) => Promise<void> }> = {
  "me-email": { drive: open },
  "me-email-error": {
    drive: async (page) => {
      await open(page);
      await next(page).fill("takamoto@engine-base");
      await expect(dlg(page)).toContainText(BAD_FORM);
    },
  },
  "me-email-sent": { me: PENDING },
};
for (const [id, st] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K840-UI-001 ${id} 幅 ${w}：小窓（題・今のメール・新しいメール・誤り・足のボタン）と確かめ待ちの行（札・説明・送り直す・やめる）の位置と大きさと字がモックと同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockOps(page, st.me ? { me: st.me } : {});
          await openAt(page, owner.token, PATH, w);
          await expect(page.locator('section[aria-labelledby="profile-title"]')).toBeVisible();
          await st.drive?.(page);
        },
        { pairs: ME_PAIRS, base: MOCK_BASE, blur: false },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

/** me-email-done は 3 枚が縦に並ぶ（changed・expired・used）。本番は 1 枚ずつ開くので、モックの n 枚目と本番の 1 枚を比べる */
const DONE: [string, number, string][] = [
  ["changed", 1, "tok-ok"],
  ["expired", 2, "tok-expired"],
  ["used", 3, "tok-used"],
];
const FRAME = '[data-part="auth-box"]';
const donePairs = (n: number): FidelityPair[] => {
  const mock = `.k-f10a-stack > :nth-child(${n}) ${FRAME}`;
  const box = ["width", "height", "x", "background-color", "border-top-left-radius"];
  const text = ["font-size", "font-weight", "color", "line-height", "texts"];
  return [
    fpair("box", mock, box, FRAME),
    fpair("badge", `${mock} .k-auth-badge`, [...box, "texts"], `${FRAME} .k-auth-badge`),
    fpair("h1", `${mock} h1`, ["x", ...text], `${FRAME} h1`),
    fpair("callout", `${mock} .k-callout`, [...box, "texts"], `${FRAME} .k-callout`),
    fpair("act", `${mock} a.k-btn`, ["width", "height", "x", "texts"], `${FRAME} a.k-btn`),
  ];
};
for (const [kind, n, token] of DONE) {
  for (const w of MATCH_WIDTHS) {
    test(`K840-UI-001 me-email-done（${kind}）幅 ${w}：確かめのリンクの先の札・題・説明・ボタンの位置と大きさと字がモックの ${n} 枚目と同じ`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchMock(
        browser,
        "me-email-done",
        w,
        async (page) => {
          const mk = await mockOps(page);
          if (kind === "expired") mk.set("emailVerify", () => err(409, "E-ME-022"));
          if (kind === "used") mk.set("emailVerify", () => err(409, "E-ME-023"));
          await openAt(page, owner.token, `/account/email-confirm?token=${token}`, w);
          await expect(page.locator(`${FRAME} h1`)).toBeVisible();
        },
        { pairs: donePairs(n), base: MOCK_BASE, blur: false },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K840-UI-002 「メール［変える］」で小窓：題「メールを変える」・「新しいアドレスに確かめのメールを送ります。リンクを押すまでは、今のメールのままです」・今のメール（書き換えられない）・新しいメール（空）。開くだけでは口を呼ばない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  await expect(dlg(page)).toContainText(
    "新しいアドレスに確かめのメールを送ります。リンクを押すまでは、今のメールのままです",
  );
  await expect(dlg(page).getByLabel("今のメール", { exact: true })).toHaveValue(OLD);
  await expect(dlg(page).getByLabel("今のメール", { exact: true })).toHaveAttribute("readonly", "");
  await expect(next(page)).toHaveValue("");
  expect(mk.calls.map((c) => c.op)).toEqual(["me"]);
});

test("K840-UI-003 形の誤り：打つと「メールの形が違います。…」・押しても送らない（口 0 回・取り直しの小窓も出ない）。直すと誤りが消える。空のままでも送らない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  await send(page).click();
  await next(page).fill("takamoto@engine-base");
  await expect(dlg(page)).toContainText(BAD_FORM);
  await send(page).click();
  expect(mk.count("emailChange")).toBe(0);
  await expect(stepDlg(page)).toHaveCount(0);
  await next(page).fill("takamoto@engine-base.example2");
  await expect(dlg(page)).not.toContainText(BAD_FORM);
});

test("K840-UI-004 表記ゆらぎ：全角の「ＮＥＷ＠ｅｎｇｉｎｅ－ｂａｓｅ．ｅｘａｍｐｌｅ」・前後の空白は半角にそろえてから形を見て、そろえた字を送る（requestEmailChange {email}）。送る体の鍵は email だけ", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill("　ＮＥＷ＠ｅｎｇｉｎｅ－ｂａｓｅ．ｅｘａｍｐｌｅ ");
  await expect(dlg(page)).not.toContainText(BAD_FORM);
  await send(page).click();
  await expect.poll(() => mk.count("emailChange")).toBe(1);
  expect(mk.last("emailChange")!.body).toEqual({ email: "NEW@engine-base.example" });
});

test("K840-UI-005 送る：requestEmailChange を 1 回・小窓が閉じ・「メール」の行が確かめ待ち（札「確かめ待ち」・「確かめのメールを … に送りました。リンクを押すと変わります。それまでは … で入れます」・［送り直す］［やめる］）。自分を 1 回だけ読み直す。今のメールは変わらない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill(NEW);
  await send(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("emailChange")).toBe(1);
  expect(mk.last("emailChange")!.body).toEqual({ email: NEW });
  await expect(mailRow(page)).toContainText("確かめ待ち");
  await expect(mailRow(page)).toContainText(
    `確かめのメールを ${NEW} に送りました。リンクを押すと変わります。それまでは ${OLD} で入れます`,
  );
  await expect(mailRow(page).getByRole("button", { name: "送り直す", exact: true })).toBeVisible();
  await expect(mailRow(page).getByRole("button", { name: "やめる", exact: true })).toBeVisible();
  expect(mk.count("me")).toBe(2);
});

test("K840-UI-006 本人確認の取り直し：403 STEP_UP_REQUIRED で小窓（「メールを変える前に、本人か確かめます」）→ パスワードで確かめると stepUp 1 回 → 同じ体でもう 1 回だけ requestEmailChange（押し直させない）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailChange", err(403, "STEP_UP_REQUIRED"));
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill(NEW);
  await send(page).click();
  await expect(stepDlg(page)).toContainText("メールを変える前に、本人か確かめます");
  await passStepUp(page);
  await expect(stepDlg(page)).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.count("emailChange")).toBe(2);
  expect(mk.of("emailChange")[1]!.body).toEqual({ email: NEW });
  await expect(mailRow(page)).toContainText("確かめ待ち");
});

test("K840-UI-007 取り直しを「やめる」：stepUp 0 回・やり直し 0 回・メールの小窓に戻る（打った字は残る）・確かめ待ちにならない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailChange", err(403, "STEP_UP_REQUIRED"));
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill(NEW);
  await send(page).click();
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stepDlg(page)).toHaveCount(0);
  await expect(next(page)).toHaveValue(NEW);
  expect(mk.count("stepUp")).toBe(0);
  expect(mk.count("emailChange")).toBe(1);
  await expect(mailRow(page)).not.toContainText("確かめ待ち");
});

test("K840-UI-008 もう使われている（409 E-ME-021）：欄の下に「このメールは、もう別のアカウントで使われています。別のメールを入れてください」・小窓は開いたまま・字は残る・別のメールで送り直せる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailChange", err(409, "E-ME-021"));
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill("sato@engine-base.example");
  await send(page).click();
  await expect(dlg(page)).toContainText(TAKEN);
  await expect(next(page)).toHaveValue("sato@engine-base.example");
  await next(page).fill(NEW);
  await expect(dlg(page)).not.toContainText(TAKEN);
  await send(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("emailChange")).toBe(2);
});

test("K840-UI-009 今のメールと同じ（409 E-ME-026）：欄の下に「今のメールと同じです」（仮）・小窓は開いたまま・確かめ待ちにならない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailChange", err(409, "E-ME-026"));
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill(OLD);
  await send(page).click();
  await expect(dlg(page)).toContainText("今のメールと同じです");
  await expect(mailRow(page)).not.toContainText("確かめ待ち");
  expect(mk.count("emailChange")).toBe(1);
});

test("K840-UI-010 送りすぎ（429 E-ME-024）：「メールを送りすぎです。しばらくしてからやり直してください」（仮）・小窓は開いたまま", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailChange", err(429, "E-ME-024", { retry_after_sec: 600 }));
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill(NEW);
  await send(page).click();
  await expect(dlg(page)).toContainText("メールを送りすぎです。しばらくしてからやり直してください");
  await expect(dlg(page)).toBeVisible();
  expect(mk.count("emailChange")).toBe(1);
});

test("K840-UI-011 確かめのメールが送れなかった（502 E-ME-025）：「確かめのメールを送れませんでした。少し待ってやり直してください」（仮）・小窓は開いたまま・「メール」の行は確かめ待ちにならない（送れたと嘘をつかない）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailChange", err(502, "E-ME-025"));
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill(NEW);
  await send(page).click();
  await expect(dlg(page)).toContainText("確かめのメールを送れませんでした。少し待ってやり直してください");
  await expect(mailRow(page)).not.toContainText("確かめ待ち");
  expect(mk.count("me")).toBe(1);
});

test("K840-UI-012 失敗（503）：小窓の中に Kaname の調子が悪い旨の赤い箱・開いたまま・もう一度押せる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailChange", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill(NEW);
  await send(page).click();
  await expect(dlg(page)).toContainText("Kaname の調子が悪くなっています");
  await send(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("emailChange")).toBe(2);
});

test("K840-UI-013 二度押し：答えを待つ間は主ボタンが処理中で、続けて押しても口は 1 回（メールを 2 通送らない）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  const release = mk.hold("emailChange");
  await openAt(page, owner.token, PATH);
  await open(page);
  await next(page).fill(NEW);
  await send(page).dblclick();
  await expect.poll(() => mk.count("emailChange")).toBe(1);
  release();
  await expect(dlg(page)).toHaveCount(0);
  expect(mk.count("emailChange")).toBe(1);
});

test("K840-UI-014 確かめ待ちの［送り直す］：待っている宛てで requestEmailChange を 1 回・「確かめのメールを送り直しました」（仮・role=status）・宛ては変わらない。429 は「メールを送りすぎです…」を行に出す", async ({
  page,
}) => {
  const mk = await mockOps(page, { me: PENDING });
  mk.queue(
    "emailChange",
    { status: 201, body: { data: { pending_email: NEW, expires_at: "2026-11-24T00:00:00Z" } } },
    err(429, "E-ME-024"),
  );
  await openAt(page, owner.token, PATH);
  await mailRow(page).getByRole("button", { name: "送り直す", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "確かめのメールを送り直しました" })).toBeVisible();
  expect(mk.last("emailChange")!.body).toEqual({ email: NEW });
  await mailRow(page).getByRole("button", { name: "送り直す", exact: true }).click();
  await expect(mailRow(page)).toContainText("メールを送りすぎです。しばらくしてからやり直してください");
  await expect(mailRow(page)).toContainText(NEW);
});

test("K840-UI-015 ［やめる］は口が無いので押せない形（aria-disabled・title「まだ使えません」・押しても口を呼ばない・隠さない）", async ({
  page,
}) => {
  const mk = await mockOps(page, { me: PENDING });
  await openAt(page, owner.token, PATH);
  const b = mailRow(page).getByRole("button", { name: "やめる", exact: true });
  await expect(b).toHaveAttribute("aria-disabled", "true");
  await expect(b).toHaveAttribute("title", "まだ使えません");
  await b.click({ force: true });
  expect(mk.calls.map((c) => c.op)).toEqual(["me"]);
  await expect(mailRow(page)).toContainText("確かめ待ち");
});

test("K840-UI-016 確かめのリンクを押した先（変わった）：/account/email-confirm?token=… は verifyEmailChange を {token} で 1 回・札「✓」・題「メールを変えました」・「これからは新しいメールで入れます。知らせも新しいメールに届きます」・［自分の設定へ戻る］。外枠の外の画面（左のバーが無い）", async ({
  page,
}) => {
  const mk = await mockOps(page, { me: PENDING });
  await openAt(page, owner.token, CONFIRM);
  await expect(page.getByRole("heading", { level: 1, name: "メールを変えました", exact: true })).toBeVisible();
  await expect(page.locator(FRAME)).toContainText("これからは新しいメールで入れます。知らせも新しいメールに届きます");
  expect(mk.count("emailVerify")).toBe(1);
  expect(mk.last("emailVerify")!.body).toEqual({ token: "tok-1" });
  await expect(page.getByRole("link", { name: "自分の設定へ戻る", exact: true })).toHaveAttribute("href", "/account");
  await expect(page.locator("nav[aria-label]").filter({ hasText: "チケット" })).toHaveCount(0);
});

test("K840-UI-017 期限切れ（409 E-ME-022）：札「期」・題「リンクの期限が切れました」・「確かめのメールのリンクは、送ってから一定の時間で切れます。自分の設定からもう一度メールを変えてください」。メールは変わらない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailVerify", err(409, "E-ME-022"));
  await openAt(page, owner.token, CONFIRM);
  await expect(page.getByRole("heading", { level: 1, name: "リンクの期限が切れました", exact: true })).toBeVisible();
  await expect(page.locator(FRAME)).toContainText("自分の設定からもう一度メールを変えてください");
  expect(mk.count("emailVerify")).toBe(1);
});

test("K840-UI-018 もう使った（409 E-ME-023）：札「済」・題「このリンクはもう使いました」・「メールはすでに変わっています。もう一度押す必要はありません」", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailVerify", err(409, "E-ME-023"));
  await openAt(page, owner.token, CONFIRM);
  await expect(page.getByRole("heading", { level: 1, name: "このリンクはもう使いました", exact: true })).toBeVisible();
  await expect(page.locator(FRAME)).toContainText("メールはすでに変わっています。もう一度押す必要はありません");
  expect(mk.count("emailVerify")).toBe(1);
});

test("K840-UI-019 使えないリンク（409 E-PAGE-006・在るかを漏らさない形）と、印が無い道（/account/email-confirm）：「このリンクは使えません」と E-PAGE-006 の文・自分の設定へ戻る。印が無いときは口を呼ばない", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailVerify", err(409, "E-PAGE-006"));
  await openAt(page, owner.token, CONFIRM);
  await expect(page.getByRole("heading", { level: 1, name: "このリンクは使えません", exact: true })).toBeVisible();
  await expect(page.locator(FRAME)).toContainText("このリンクは使えなくなりました。期限が切れたか、もう使われています");
  expect(mk.count("emailVerify")).toBe(1);
  await page.goto("/account/email-confirm");
  await expect(page.getByRole("heading", { level: 1, name: "このリンクは使えません", exact: true })).toBeVisible();
  expect(mk.count("emailVerify")).toBe(1);
});

test("K840-UI-020 確かめは 1 回だけ：StrictMode でも verifyEmailChange は 1 回（印は 1 回しか使えない）。開き直すと 2 回目は「もう使いました」になる", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailVerify", ok({ changed: true, email: NEW }, 201), err(409, "E-ME-023"));
  await openAt(page, owner.token, CONFIRM);
  await expect(page.getByRole("heading", { level: 1, name: "メールを変えました", exact: true })).toBeVisible();
  expect(mk.count("emailVerify")).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "このリンクはもう使いました", exact: true })).toBeVisible();
  expect(mk.count("emailVerify")).toBe(2);
});

test("K840-UI-021 確かめの失敗（503・印は使われていない）：調子が悪い画面と「もう一度読む」・押すと確かめ直して「メールを変えました」（口 2 回）", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.queue("emailVerify", err(503, "E-PAGE-003"));
  await openAt(page, owner.token, CONFIRM);
  await expect(page.getByText("PAGE-", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "メールを変えました", exact: true })).toBeVisible();
  expect(mk.count("emailVerify")).toBe(2);
});

test("K840-UI-022 ログインしていない人がリンクを開く：入り直し（/login）へ送られる（確かめる口は 401）。入り直したあとにこの道へ戻る", async ({
  page,
}) => {
  const mk = await mockOps(page);
  mk.set("emailVerify", () => err(401, "E-PAGE-005"));
  await page.goto(CONFIRM);
  await expect(page).toHaveURL(/\/login/);
  expect(mk.count("emailVerify")).toBe(1);
  expect(decodeURIComponent(page.url())).toContain("/account/email-confirm");
});

test("K840-UI-023 変わったあと［自分の設定へ戻る］：/account へ移り、新しいメールが出る（別の読みで確かめる）・確かめ待ちの札は無い", async ({
  page,
}) => {
  await mockOps(page, { me: PENDING });
  await openAt(page, owner.token, CONFIRM);
  await page.getByRole("link", { name: "自分の設定へ戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(mailRow(page)).toContainText(NEW);
  await expect(mailRow(page)).not.toContainText("確かめ待ち");
});

test("K840-UI-024 幅 320・375・768・1024・1440：横のはみ出し 0（数値）。小窓・確かめ待ちの行・確かめのリンクの先（3 つの形）・長いメールでも 0", async ({
  page,
}) => {
  const long = `${"a".repeat(60)}@${"b".repeat(60)}.example`;
  const mk = await mockOps(page, { me: me({ member: { email_pending: long } }) });
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAt(page, owner.token, PATH, w);
    await expect(mailRow(page)).toContainText("確かめ待ち");
    expect(await overflowX(page), `行 幅 ${w}`).toBeLessThanOrEqual(0);
  }
  for (const [reply, label] of [
    [null, "changed"],
    [err(409, "E-ME-022"), "expired"],
    [err(409, "E-ME-023"), "used"],
  ] as const) {
    if (reply) mk.queue("emailVerify", reply);
    await openAt(page, owner.token, CONFIRM, 320);
    await expect(page.locator(`${FRAME} h1`)).toBeVisible();
    expect(await overflowX(page), label).toBeLessThanOrEqual(0);
  }
});
