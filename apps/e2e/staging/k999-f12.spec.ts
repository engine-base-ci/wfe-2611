// K-999 統合テスト（段 13・staging）：顧客が困ったときに 1 か所で運営に聞け、お知らせ・稼働状況・請求とプランを見られる（J14）を、
//   初めての会社として staging（本番と同じ形・D-128.144）の上で頭から通す。中の分岐は単体と中間（K-996・K-997・K-998）が開発の環境で持つ。
//   ここで見るのは 2 つだけ：① 画面 → 別の住所の口 → 本物の DB が、登録した本物の人の上でつながること
//   ② staging でしか出ないもの（本物の確認のメール・口と画面が別の住所・接続の束ね役ごしの会社の分け）。
//   運営の筋（パスキーで入る・受信箱・お知らせ・中を見る・止める・配る）は、staging の試験が使える運営の人とパスキーがまだ無いので試験を持たない
//   （K-999 の md の judge-skip・人の準備の葉が入ってから足す）。照合の回収とお金を動かす筋も staging では作らない（judge-skip）。
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204）。「できた」はその回の JUnit の記録で決める（K-65 の PM の決め 1）。
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない・固定の待ちを置かない。
//   ★記録に出さない：staging の住所・試験の宛先・確認のリンク。住所は道（pathname）だけを比べる。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。直すのは道具（_lib/f12-steps.ts）と設定の側
import { expect, test, type Page } from "@playwright/test";
import { latestTo, readMail, verifyLink } from "./_lib/resend";
import { h1, hasLoginMark, pathOf, person, readAs, submitSignup, type Person } from "./_lib/steps";
import { enterWithTwoFactor } from "./_lib/handover-steps";
import { BILLING, SETTINGS, askOnScreen, openHelp, openThread, replyOnScreen, resolveOnScreen } from "./_lib/f12-steps";

const SENT = "確認メールを送りました"; // K-51 の待つ画面の見出し
const MAIL_RECORD_MS = 120_000;
type Row = Record<string, unknown>;

/** 登録の画面 → Resend の記録に出た確認のメール → リンクを開いて 2 段階を付けて中へ（K-65・K-418 と同じ筋） */
async function signUpAndEnter(page: Page, me: Person): Promise<void> {
  expect(await submitSignup(page, me), "登録の口が受ける（201）").toBe(201);
  await expect(h1(page, SENT)).toBeVisible();
  const found: { mail: Awaited<ReturnType<typeof latestTo>> } = { mail: null };
  await expect
    .poll(async () => (found.mail ??= await latestTo(me.email)) !== null, {
      message: "確認のメールが Resend の記録に出る",
      timeout: MAIL_RECORD_MS,
      intervals: [2_000],
    })
    .toBe(true);
  const link = verifyLink(await readMail(found.mail!.id));
  expect(link !== null, "メールの本文に確認のリンクがある").toBe(true);
  await enterWithTwoFactor(page, link!, me);
  expect(await hasLoginMark(page), "ログインの印を持つ").toBe(true);
}

test("K999-STG-01 困ったとき・お知らせ：登録 → 困ったとき・お知らせを開く（稼働状況・お知らせ）→ 問い合わせる → 自分の問い合わせ → 1 件で返事を書く → 済みにする", async ({
  page,
}) => {
  test.setTimeout(360_000);
  const me = person("段13 困ったとき");
  await signUpAndEnter(page, me);
  expect(await openHelp(page), "困ったとき・お知らせの画面が開ける").toBe(200);
  const status = await readAs(page, "/service-status");
  expect(status.status, "稼働状況の口が読める").toBe(200);
  const comps = ((status.data as Row)["components"] ?? []) as Row[];
  expect(comps.map((c) => c["key"]).sort(), "様子は 3 行（web・runs・pc）").toEqual(["pc", "runs", "web"]);
  const notices = await readAs(page, "/notices");
  expect([notices.status, Array.isArray(notices.data)], "お知らせの一覧が読める").toEqual([200, true]);

  const title = `統合テスト 実行待ちのまま ${Date.now().toString(36)}`;
  expect(
    await askOnScreen(page, title, "PC をつけているのに 30 分たっても実行待ちのままです"),
    "問い合わせる口が 201",
  ).toBe(201);
  await expect(page.getByText("運営に届きました", { exact: true }).first()).toBeVisible();
  const mine = await readAs(page, "/inquiries");
  expect(mine.status).toBe(200);
  const row = (mine.data as Row[]).find((x) => x["title"] === title);
  expect(row?.["state"], "自分の問い合わせに返事を待っているで出る").toBe("waiting");
  const id = String(row!["id"]);

  await openThread(page, id, title);
  await expect(page.getByText("返事を待っている", { exact: true }).first()).toBeVisible();
  expect(await replyOnScreen(page, "PC を開き直しても同じです"), "返事を書く口が 201").toBe(201);
  const one = await readAs(page, `/inquiries/${id}`);
  const msgs = ((one.data as Row)["messages"] ?? []) as Row[];
  expect(
    msgs.map((m) => m["from"]),
    "やり取りは自分の 2 つ（運営の返事・社内メモは無い）",
  ).toEqual(["me", "me"]);
  expect(await resolveOnScreen(page), "済みにする口が 200").toBe(200);
  await expect(page.getByText("済み", { exact: true }).first()).toBeVisible();
  const after = await readAs(page, "/inquiries");
  expect((after.data as Row[]).find((x) => x["id"] === id)?.["state"], "口の読み直しでも済み").toBe("done");
  expect(pathOf(page), "1 件のやり取りの画面のまま").toBe(`/inquiry/${id}`);
});

test("K999-STG-02 お金とプラン：登録 → 請求書の画面（無料で請求書は無い）→ 設定の「プランと支払い」に いまの人数と上限（D-156.36）", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const me = person("段13 お金");
  await signUpAndEnter(page, me);
  const bill = await readAs(page, "/workspace/billing");
  expect(bill.status, "請求書の口が管理者に読める").toBe(200);
  const d = bill.data as Row;
  expect([d["free"], d["invoices"], d["overdue"]], "無料は請求書が無く・期限の注意も無い").toEqual([true, [], null]);
  const res = await page.goto(BILLING);
  expect(res?.status(), "請求書の画面が開ける").toBe(200);
  await expect(h1(page, "請求書")).toBeVisible();

  const plans = await readAs(page, "/workspace/plans");
  expect(plans.status, "選べるプランの口が読める").toBe(200);
  const rows = plans.data as Row[];
  const cur = rows.find((x) => x["current"] === true);
  expect(cur?.["plan_key"], "初めての会社は無料").toBe("free");
  expect(
    rows.map((x) => x["plan_key"]),
    "選べるプランは 3 つ",
  ).toEqual(["free", "team", "business"]);
  await page.goto(SETTINGS);
  await expect(page.getByText(/いま 1 人/).first(), "プランと支払いの行に いま 1 人").toBeVisible();
  await expect(page.getByText(`${String(cur!["member_limit"])} 人まで`, { exact: false }).first()).toBeVisible();
});
