// K-1102 統合テスト（段 13・staging）の運営の筋：K-999 が staging で作れなかった 2 本（K999-STG-03・04）を、staging の試験だけの運営の人と
//   そのパスキー（K-1101 の人の準備・Environment staging の秘密）で通す。中の分岐は単体と中間（K-996・K-997・K-998）が開発の環境で持つ。
//   ここで見るのは 2 つだけ：① 運営のパスキーで入ったセッションの印が、別の住所の運営の口に画面から通ること
//   ② 運営の操作が、別のブラウザで入っている顧客の画面と口に、本物の DB ごしに効くこと（返事・お知らせ・中を見ている帯・止める日の帯）。
//   値段は決めない・差し戻さない（staging の全部の会社の請求に効く）。案の下書きと影響を見るまで（決めるは K-998 と人が確かめる K999-H-001）。
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204）。「できた」はその回の JUnit の記録で決める（K-65 の PM の決め 1）。
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない・固定の待ちを置かない。
//   ★記録に出さない：staging の住所・試験の宛先・確認のリンク・パスキーの鍵。住所は道（pathname）だけを比べる。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。直すのは道具（_lib/ops-steps.ts）と設定の側
import { expect, test, type Page } from "@playwright/test";
import { latestTo, readMail, verifyLink } from "./_lib/resend";
import { h1, hasLoginMark, person, readAs, submitSignup, type Person } from "./_lib/steps";
import { enterWithTwoFactor } from "./_lib/handover-steps";
import { askOnScreen, openHelp } from "./_lib/f12-steps";
import {
  enterOps,
  ensureProposal,
  openPeek,
  resume,
  scheduleStop,
  sendWorkspaceNotice,
  takeAndReply,
  workspaceIdOf,
} from "./_lib/ops-steps";

const SENT = "確認メールを送りました"; // K-51 の待つ画面の見出し
const MAIL_RECORD_MS = 120_000;
type Row = Record<string, unknown>;

/** 登録の画面 → Resend の記録に出た確認のメール → リンクを開いて 2 段階を付けて中へ（K-999 と同じ筋） */
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

test("K1102-STG-01 運営が回す：顧客が問い合わせる → 運営がパスキーで入る → 受信箱で取って返す → 顧客が返事を読む → 1 社にお知らせ → 中を見る（顧客に帯）→ 止める日を決める（管理者に帯）→ 再開", async ({
  page,
  browser,
}) => {
  test.setTimeout(480_000);
  const me = person("段13 運営が回す");
  await signUpAndEnter(page, me);
  expect(await openHelp(page), "困ったとき・お知らせの画面が開ける").toBe(200);
  const title = `統合テスト 運営に聞く ${Date.now().toString(36)}`;
  expect(await askOnScreen(page, title, "請求書の宛名を変えたいです"), "問い合わせる口が 201").toBe(201);
  const inq = ((await readAs(page, "/inquiries")).data as Row[]).find((x) => x["title"] === title);
  expect(inq?.["state"], "返事を待っている").toBe("waiting");

  const opsCtx = await browser.newContext();
  const ops = await opsCtx.newPage();
  try {
    await enterOps(ops);
    const shell = await readAs(ops, "/ops/shell");
    expect(shell.status, "運営の外枠の口がパスキーのセッションで読める").toBe(200);
    const wsId = await workspaceIdOf(ops, me.company);
    expect(wsId, "全社の一覧に登録した会社が出る").not.toBeNull();

    expect(await takeAndReply(ops, String(inq!["id"]), "設定のプランと支払いから変えられます"), "返す口が 201").toBe(
      201,
    );
    const after = ((await readAs(page, "/inquiries")).data as Row[]).find((x) => x["id"] === inq!["id"]);
    expect(after?.["state"], "顧客の口で返事あり").toBe("replied");
    const thread = (((await readAs(page, `/inquiries/${String(inq!["id"])}`)).data as Row)["messages"] ?? []) as Row[];
    expect(
      thread.map((m) => m["from"]),
      "顧客のやり取りは自分 1 つと運営の返事 1 つ（社内メモは出ない）",
    ).toEqual(["me", "ops"]);

    const noticeTitle = `統合テスト 1 社へのお知らせ ${Date.now().toString(36)}`;
    expect(
      await sendWorkspaceNotice(ops, wsId!, noticeTitle, "設定の手順をお送りします"),
      "1 社にお知らせを送る口が 201",
    ).toBe(201);
    const notices = (await readAs(page, "/notices")).data as Row[];
    expect(
      notices.some((x) => x["title"] === noticeTitle),
      "顧客のお知らせの一覧に届く",
    ).toBe(true);

    expect(await openPeek(ops, wsId!), "中を見る口が 201").toBe(201);
    const band = (await readAs(page, "/service-status")).data as Row;
    const kinds = ((band["bands"] ?? []) as Row[]).map((x) => x["kind"]);
    expect(kinds, "顧客の帯に運営が見ている（kind peek）").toContain("peek");

    expect(await scheduleStop(ops, wsId!), "止める日を決める口が 201（K-970 の契約の outputs_2xx）").toBe(201);
    const ws1 = (await readAs(ops, `/ops/workspaces/${wsId!}`)).data as Row;
    const stop1 = ws1["stop"] as Row | null;
    expect([typeof stop1?.["stop_on"], stop1?.["stopped_at"] ?? null], "止める日が在り、まだ止めていない").toEqual([
      "string",
      null,
    ]);
    expect(await resume(ops, wsId!), "再開の口が 201（K-970 の契約の outputs_2xx）").toBe(201);
    const ws2 = (await readAs(ops, `/ops/workspaces/${wsId!}`)).data as Row;
    expect(ws2["stop"] ?? null, "止める印が無い（再開した）").toBeNull();
  } finally {
    await opsCtx.close();
  }
});

test("K1102-STG-02 配る・値段：運営がパスキーで入る → プランの一覧 → 値段の案の下書き（前の回の物を使う）→ 影響を見る → ひな形と操作を読む（決めない・値段は変わらない）", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await enterOps(page);
  const plans = await readAs(page, "/ops/plans");
  expect(plans.status, "運営のプランの口が読める").toBe(200);
  const keys = ((plans.data ?? []) as Row[]).map((x) => x["plan_key"]);
  expect(keys, "プランは 3 つ").toEqual(["free", "team", "business"]);
  const before = ((plans.data ?? []) as Row[]).map((x) => x["price_monthly"]);

  const id = await ensureProposal(page, `統合テスト 値段の案 ${Date.now().toString(36)}`);
  expect(id, "試験の案（下書き）が在る").not.toBeNull();
  const impact = await readAs(page, `/ops/plan_proposals/${id!}/impact`);
  expect(impact.status, "影響の口が読める").toBe(200);
  expect(typeof (impact.data as Row)["customers"], "影響を受ける顧客の数がある").toBe("number");

  const templates = await readAs(page, "/ops/templates");
  expect([templates.status, Array.isArray(templates.data)], "ひな形の一覧が読める").toEqual([200, true]);
  const operations = await readAs(page, "/ops/operations");
  expect([operations.status, Array.isArray(operations.data)], "操作の一覧が読める（見るだけ）").toEqual([200, true]);
  const again = ((await readAs(page, "/ops/plans")).data ?? []) as Row[];
  expect(
    again.map((x) => x["price_monthly"]),
    "値段は変わらない",
  ).toEqual(before);
});
