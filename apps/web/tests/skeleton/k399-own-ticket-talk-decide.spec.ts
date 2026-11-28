// K-399 段 7 の統合テスト：自分でやるチケットを作業中にし、やり取りで相談し、決定を残し、実績を入れて、完了の小窓で終える（端から端）と、
//   F5 との流れをまたぐ試験 3 つ（AI に任せている間は段を変えられない・承認待ちの間に書き込める・完了したチケットに書ける）を、
//   本物のブラウザ・本物の DB・本物の口と、試験の PC でつなぐ（D-128.131）。
//   中の 1 本 1 本の分岐は各葉の単体の試験（K-383〜K-391 の口・K-392〜K-398 の画面）が持つ。ここは「つないだときにだけ出るもの」を見る：
//   段・実績・決定の変更がやり取りに 1 行ずつ残るか・@ した人の受け箱に 1 通入るか・書き込みを決定にすると本文の区画に出て元へ戻れるか・
//   完了の小窓（F5）まで行けるか・仕組みの段（F5 の実行中・承認待ち）の間は段を変えられず書き込みはできるか・完了したチケットに書けるか。
//   口は網の手前で差し替えない（page.route で答えを作らない。届く頭 x-forwarded-for だけを足す）。AI は決まった答え（_lib/f5-flow.ts の AI）。
//   人は _lib/newcomer.ts（登録の画面と受け箱）、同じ会社のもう 1 人とチケットと PC は _lib/prep.ts（口の道）。前からある道具は変えない。
//   置き場は tests/skeleton（CI の web の組の G59・K-64 と同じ）。固定の待ちは使わない（expect が画面の変わるのを待つ）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { API, admin, loginAs } from "../_lib/api";
import { AI, ticketState, workOf, type Job, type PcWork } from "../_lib/f5-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { pairedPc, pressDelegate, teammate, ticketOf } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
// 1 本の上限：登録（画面とメール）・PC の引き取り・3 秒ごとの読み直しを待つ切り替わりが 1 本に数回ある。CI の台は VM が同時に走るので 120 秒（K-64 と同じ）
test.describe.configure({ timeout: 120_000 });

/** 文（代表の答え ㉒・正本・各葉の md から。実装から書かない） */
const MSG = {
  locked: "AI が動いている間と承認待ちの間は、状態を変えられません", // ㉒
  stageLine: "が状態を 未着手 → 作業中 に変えた", // ㉒ 更新の記録の 1 行
  timeLine: "が実績を 1 時間 に変えた", // ㉒
  decisionLine: "が決定を足した", // ㉒
  holdChange: "状態：作業中 → 保留", // ⑮4 書き込みと一緒に残った変更（K-392 の字）
  holdBand: "保留中です", // ④ 保留の帯（K-395・㉒）
  waitingMe: "あなたの承認を待っています", // K-63 の帯
} as const;
const SECTIONS = {
  purpose: "先方に請求書を送る",
  done: "先方が請求書を受け取った",
  todo: "- 請求書を作る\n- 先方に送る",
} as const;

// ---------------------------------------------------------------- 道具（この試験の中だけ）
const meta = (page: Page) => page.locator(".k-detail-meta");
const stageBtn = (page: Page) => meta(page).getByRole("button", { name: /^状態：/ });
const stagePart = (page: Page) => meta(page).locator('[data-part="stage"]');
const panel = (page: Page) => page.getByRole("complementary", { name: "チケットのパネル" });
const tab = (page: Page, name: RegExp) =>
  panel(page).getByRole("navigation", { name: "パネルのタブ" }).getByRole("button", { name });
const stageItem = (page: Page, key: string) =>
  page.getByRole("menuitem").filter({ has: page.locator(`.k-detail-stage[data-stage="${key}"]`) });
const composer = (page: Page) => panel(page).getByRole("textbox", { name: "書き込み", exact: true });
const sendBtn = (page: Page) => panel(page).getByRole("button", { name: "書き込む", exact: true });
const logSec = (page: Page) => page.locator("section:has(#sec-decisions)").first();

const openTicket = async (page: Page, id: string, title: string) => {
  const res = await page.goto(`/tickets/${id}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
};
const openTalk = async (page: Page) => {
  await tab(page, /^やり取り/).click();
  await expect(tab(page, /^やり取り/)).toHaveAttribute("aria-current", "page");
};
/** DB の今の時刻（受け箱の数の起点。台の時計と DB の時計のずれに左右されない） */
const dbNow = async (): Promise<Date> => (await admin<{ n: Date }>("select now() as n"))[0]!.n;
/** やり取りに書いて、口が 201 で受けるのを待つ */
async function write(page: Page, text: string): Promise<void> {
  await openTalk(page);
  await composer(page).fill(text);
  const res = page.waitForResponse(
    (r) => r.request().method() === "POST" && /\/api\/v1\/tickets\/[^/]+\/messages$/.test(new URL(r.url()).pathname),
  );
  await sendBtn(page).click();
  expect((await res).status(), "書き込みの口が受ける").toBe(201);
  await expect(panel(page).locator("article.k-talk-post").filter({ hasText: text })).toBeVisible();
}
/** 人のログインの印で PATCH を直に呼ぶ（その人の画面と同じブラウザから。_lib/prep.ts の asPerson と同じ呼び方で、そちらに PATCH が無いのでここに置く） */
async function patchAs(page: Page, token: string, path: string, body: Record<string, unknown>) {
  return page.evaluate(
    async ([url, tok, b]) => {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tok}`,
          "idempotency-key": crypto.randomUUID(),
        },
        body: b,
      });
      return { status: res.status, code: ((await res.json().catch(() => ({}))) as { code?: string }).code ?? null };
    },
    [`${API}/api/v1${path}`, token, JSON.stringify(body)] as const,
  );
}
const messages = (ticketId: string) =>
  admin<{ kind: string; body: string | null; mentions: string[]; author: string | null }>(
    `select kind, body, mentions::text[] as mentions, author_member_id as author from ticket_messages
      where ticket_id = $1 and deleted_at is null order by created_at, id`,
    [ticketId],
  );
const noticesFor = async (memberId: string, since: Date): Promise<number> =>
  Number(
    (
      await admin<{ n: string }>(
        "select count(*)::text as n from notifications where member_id = $1 and created_at >= $2 and deleted_at is null",
        [memberId, since],
      )
    )[0]!.n,
  );

// ---------------------------------------------------------------- 通し（自分でやるチケット）
test.describe.serial("通し：自分でやるチケットを進めて、話して、決めて、終える", () => {
  let ctx: BrowserContext;
  let page: Page;
  let me: Newcomer;
  let mate: { memberId: string; token: string };
  let t: string;
  const title = `請求書を送る 段7 通し ${randomUUID().slice(0, 6)}`;
  let postAt = new Date();

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ timezoneId: "Asia/Tokyo" });
    await ownIp(ctx, 67);
    page = await ctx.newPage();
    me = await newcomer(page, box, `段7 ${randomUUID().slice(0, 6)}`);
    // 同じ会社のもう 1 人（@ で呼ぶ相手）。招待で入った人にはグループが無いので、本人のグループにそろえる（まだ無い口を準備に使わない）
    const m = await teammate(me, "同僚 七");
    await admin("update members set scope_id = (select scope_id from members where id = $1) where id = $2", [
      me.memberId,
      m.memberId,
    ]);
    mate = { memberId: m.memberId, token: m.token };
    t = await ticketOf(page, me, title, SECTIONS);
  });
  test.afterAll(async () => {
    await ctx.close();
  });

  test("K399-T1-001 自分のチケット（未着手）を段の札で作業中にする：札は「作業中」・DB の段は doing・やり取りに段の変更の 1 行（kind change が 1 つ）", async () => {
    await openTicket(page, t, title);
    await expect(stagePart(page)).toHaveText("未着手");
    await stageBtn(page).click();
    await stageItem(page, "doing").click();
    await expect(stagePart(page)).toHaveText("作業中");
    expect((await ticketState(t)).stage).toBe("doing");
    expect((await messages(t)).filter((x) => x.kind === "change")).toHaveLength(1);
    await openTalk(page);
    await expect(panel(page)).toContainText(MSG.stageLine);
  });

  test("K399-T1-002 やり取りで @ して、知らせる人にも同僚を足して書く：一覧の下に出る・DB に kind post が 1 つ（mentions に同僚）・同僚の受け箱にちょうど 1 通（@ と知らせる人の両方でも 1 通）・自分には 0", async () => {
    postAt = await dbNow();
    await openTalk(page);
    await composer(page).fill("宛名を確かめます @同僚");
    await panel(page)
      .getByRole("option", { name: /同僚 七/ })
      .click();
    // 知らせる人にも同僚を足す（最初の知らせる人は担当者と承認する人＝本人なので外れている）
    await panel(page).getByRole("button", { name: "知らせる人を足す" }).click();
    const pick = page.getByRole("dialog", { name: "知らせる人を選ぶ" });
    await pick.getByRole("checkbox", { name: /同僚 七/ }).check();
    await pick.getByRole("button", { name: "閉じる" }).click();
    await expect(panel(page).getByRole("list", { name: "知らせる人" })).toContainText("同僚 七");
    const res = page.waitForResponse(
      (r) => r.request().method() === "POST" && /\/api\/v1\/tickets\/[^/]+\/messages$/.test(new URL(r.url()).pathname),
    );
    await sendBtn(page).click();
    expect((await res).status()).toBe(201);
    const posted = panel(page).locator("article.k-talk-post").filter({ hasText: "宛名を確かめます" });
    await expect(posted).toBeVisible();
    await expect(posted).toContainText(me.name);
    const posts = (await messages(t)).filter((x) => x.kind === "post");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.mentions).toEqual([mate.memberId]);
    expect(posts[0]!.author).toBe(me.memberId);
    await expect.poll(() => noticesFor(mate.memberId, postAt), "@ と知らせる人の両方でも 1 通").toBe(1);
    expect(await noticesFor(me.memberId, postAt), "自分には知らせない").toBe(0);
  });

  test("K399-T1-003 書き込みを決定にする：「✓ 決定にした」・区画が「決定ログ（1）」・DB に決定 1 行（元の書き込み・決めた人は本人）・やり取りに 1 行・元のリンクでその書き込みへ戻る", async () => {
    const posted = panel(page).locator("article.k-talk-post").filter({ hasText: "宛名を確かめます" });
    await posted.getByRole("button", { name: "決定にする" }).click();
    const dlg = page.getByRole("dialog", { name: "決定にする" });
    await expect(dlg).toBeVisible();
    await dlg.getByRole("textbox", { name: /決めたこと/ }).fill("宛名は経理部 山田様");
    await dlg.getByRole("textbox", { name: "理由", exact: true }).fill("先方の指定");
    await dlg.getByRole("button", { name: "決定にする" }).click();
    await expect(dlg).toHaveCount(0);
    await expect(posted).toContainText("✓ 決定にした");
    await expect(logSec(page).locator("#sec-decisions")).toHaveText("決定ログ（1）");
    await expect(logSec(page).locator(".k-dec-item").first()).toContainText("宛名は経理部 山田様");
    const [post] = await admin<{ id: string }>(
      "select id from ticket_messages where ticket_id = $1 and kind = 'post'",
      [t],
    );
    const decs = await admin<{ text: string; source_message_id: string | null; decided_by: string | null }>(
      "select text, source_message_id, decided_by from ticket_decisions where ticket_id = $1",
      [t],
    );
    expect(decs).toEqual([{ text: "宛名は経理部 山田様", source_message_id: post!.id, decided_by: me.memberId }]);
    await expect(panel(page)).toContainText(MSG.decisionLine);
    // 元の書き込みへ戻る（区画のリンク → やり取りのタブのその書き込み）
    await tab(page, /^項目/).click();
    await logSec(page)
      .locator(".k-dec-item")
      .first()
      .getByRole("link", { name: /元：やり取り/ })
      .click();
    await expect(tab(page, /^やり取り/)).toHaveAttribute("aria-current", "page");
    await expect(panel(page).locator(`[id="msg-${post!.id}"]`)).toBeInViewport();
  });

  test("K399-T1-004 実績を 1 時間にする：「1 時間」・DB の actual_minutes が 60・やり取りに実績の 1 行", async () => {
    await tab(page, /^項目/).click();
    const actual = panel(page)
      .getByRole("region", { name: "日付と時間" })
      .locator(".k-detail-field")
      .filter({ hasText: "実績" })
      .locator("dd");
    await actual.getByRole("button", { name: "直す" }).click();
    await panel(page).getByRole("textbox", { name: "時間", exact: true }).fill("1");
    await panel(page).getByRole("textbox", { name: "分", exact: true }).fill("0");
    await panel(page).getByRole("button", { name: "保存" }).click();
    await expect(actual.locator(".k-prog-time")).toContainText("1 時間");
    const [row] = await admin<{ m: number }>("select actual_minutes as m from tickets where id = $1", [t]);
    expect(row!.m).toBe(60);
    await openTalk(page);
    await expect(panel(page)).toContainText(MSG.timeLine);
  });

  test("K399-T1-006 同僚（担当者でない人）が書く欄の「状態 ▾」で保留を選び、理由と再開の条件を入れて書く：DB の段が hold・その書き込みに段の変更・同僚の画面に「状態：作業中 → 保留」・本人（担当者）の受け箱にちょうど 1 通・本人の画面に保留の帯。本人が帯から作業中に戻す", async ({
    browser,
  }) => {
    const ctx2 = await browser.newContext({ timezoneId: "Asia/Tokyo" });
    await ownIp(ctx2, 69);
    const since = await dbNow();
    try {
      const page2 = await ctx2.newPage();
      await loginAs(page2, mate.token);
      await openTicket(page2, t, title);
      await tab(page2, /^やり取り/).click();
      await composer(page2).fill("先方の検収を待ちます");
      await panel(page2)
        .getByRole("button", { name: /^状態 / })
        .click();
      await stageItem(page2, "hold").click();
      await panel(page2)
        .getByRole("textbox", { name: /保留の理由/ })
        .fill("先方の検収待ち");
      await panel(page2)
        .getByRole("textbox", { name: /再開の条件/ })
        .fill("検収の連絡が来たら");
      const res = page2.waitForResponse(
        (r) =>
          r.request().method() === "POST" && /\/api\/v1\/tickets\/[^/]+\/messages$/.test(new URL(r.url()).pathname),
      );
      await sendBtn(page2).click();
      expect((await res).status(), "書き込みと段を 1 つの口で").toBe(201);
      const posted = panel(page2).locator("article.k-talk-post").filter({ hasText: "先方の検収を待ちます" });
      await expect(posted).toContainText(MSG.holdChange);
    } finally {
      await ctx2.close();
    }
    expect((await ticketState(t)).stage).toBe("hold");
    const [row] = await admin<{ changes: { field: string }[] | null }>(
      "select changes from ticket_messages where ticket_id = $1 and kind = 'post' and body = $2",
      [t, "先方の検収を待ちます"],
    );
    expect(row!.changes?.map((c) => c.field)).toContain("stage");
    await expect
      .poll(() => noticesFor(me.memberId, since), "担当者への知らせは 1 通（書き込みの知らせと段の知らせを重ねない）")
      .toBe(1);
    // 本人の画面：保留の帯（理由・再開の条件）→ 帯から作業中に戻す（次の完了の前提）
    await openTicket(page, t, title);
    const band = page.locator(".k-detail-bands .k-band").filter({ hasText: MSG.holdBand });
    await expect(band).toContainText("先方の検収待ち");
    await expect(band).toContainText("検収の連絡が来たら");
    await band.getByRole("button", { name: "作業中に戻す" }).click();
    await expect(stagePart(page)).toHaveText("作業中");
    await expect(band).toHaveCount(0);
    expect((await ticketState(t)).stage).toBe("doing");
  });

  test("K399-T1-005 段のメニューの「完了 確かめて完了にする…」から完了の小窓で終える：札は「完了」・題名の下に「完了しました（…）」・DB は done で completed_by が本人", async () => {
    // 準備：確かめる物が 0 件なら完了の小窓は出さない（K-572・K-703 の決まり）ので、確認項目を 1 件足してから開き直す
    await admin(
      "insert into test_specs (tenant_id, ticket_id, check_kind, title, created_by, updated_by) select tenant_id, id, 'human', $2, $3, $3 from tickets where id = $1",
      [t, "宛名が経理部 山田様になっている", me.memberId],
    );
    await openTicket(page, t, title);
    await stageBtn(page).click();
    await page.getByRole("menuitem").filter({ hasText: "確かめて完了にする" }).click();
    const dlg = page.getByRole("dialog", { name: "完了にする" });
    await expect(dlg).toBeVisible();
    // 小窓はチェックの無い物を知らせ、「このまま完了にする」で終える（K-455・K-572 の小窓の形。チェックの箱は置かない）
    await expect(dlg).toContainText("宛名が経理部 山田様になっている");
    await dlg.getByRole("button", { name: "このまま完了にする", exact: true }).click();
    await expect(dlg).toHaveCount(0);
    await expect(stagePart(page)).toHaveText("完了");
    await expect(page.locator(".k-detail-bands")).toContainText("完了しました（");
    const s = await ticketState(t);
    expect(s.stage).toBe("done");
    expect(s.completed_by).toBe(me.memberId);
    expect(s.completed_at).not.toBeNull();
  });

  test("K399-X-003 完了したチケットに書く：一覧に出る・DB の段は done のまま（completed_at も同じ）・書く欄の「状態 ▾」は押せない", async () => {
    const before = await ticketState(t);
    await write(page, "送付済みです。ありがとうございました");
    const after = await ticketState(t);
    expect(after.stage).toBe("done");
    expect(after.completed_at?.toISOString()).toBe(before.completed_at?.toISOString());
    await expect(panel(page).getByRole("button", { name: /^状態 / })).toHaveAttribute("aria-disabled", "true");
  });
});

// ---------------------------------------------------------------- F5 とまたぐ（AI に任せている間・承認待ちの間）
test.describe.serial("F5 とまたぐ：AI に任せている間と承認待ちの間のチケット", () => {
  let ctx: BrowserContext;
  let page: Page;
  let me: Newcomer;
  let pc: TestPc;
  let w: PcWork;
  let job: Job;
  let t: string;
  const title = `見積を送る 段7 またぐ ${randomUUID().slice(0, 6)}`;
  const session = randomUUID();

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ timezoneId: "Asia/Tokyo" });
    await ownIp(ctx, 68);
    page = await ctx.newPage();
    me = await newcomer(page, box, `段7x ${randomUUID().slice(0, 6)}`);
    pc = await pairedPc(page, me.token, "段 7 の MacBook");
    w = workOf(pc);
    t = await ticketOf(page, me, title, SECTIONS);
  });
  test.afterAll(async () => {
    await pc?.close();
    await ctx.close();
  });

  test("K399-X-001 AI に任せている間（実行中）：札は鍵の札でメニューを開かない・updateTicket に直に送ると 409・DB の段は running のまま・段の変更の 1 行は増えない", async () => {
    await openTicket(page, t, title);
    await pressDelegate(page);
    let got: Job | null = null;
    await expect.poll(async () => (got ??= await w.take()), "任せた仕事は任せた人の PC に渡る").not.toBeNull();
    job = got!;
    expect((await ticketState(t)).stage).toBe("running");
    const lock = meta(page).locator(".k-prog-stage-locked");
    await expect(lock).toHaveText("実行中");
    await expect(lock).toHaveAttribute("title", MSG.locked);
    await expect(stageBtn(page)).toHaveCount(0);
    await lock.click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    const changesBefore = (await messages(t)).filter((x) => x.kind === "change").length;
    const r = await patchAs(page, me.token, `/tickets/${t}`, {
      stage_key: "hold",
      hold_reason: "止めたい",
      resume_condition: "あとで",
    });
    expect(r.status, "仕組みの段の間は口が断る").toBe(409);
    expect((await ticketState(t)).stage).toBe("running");
    expect((await messages(t)).filter((x) => x.kind === "change")).toHaveLength(changesBefore);
  });

  test("K399-X-002 承認待ちの間にやり取りに書く：一覧に出る・DB の段は awaiting_approval のまま・承認待ちの帯のまま・札は鍵の札", async () => {
    expect(await w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: session })).toEqual({
      status: 201,
      outcome: "awaiting_approval",
    });
    await expect(page.getByRole("region", { name: "承認と実行" })).toContainText(MSG.waitingMe);
    await write(page, "確認お願いします");
    expect((await ticketState(t)).stage).toBe("awaiting_approval");
    const [a] = await admin<{ n: string }>(
      "select count(*)::text as n from approvals where ticket_id = $1 and decided_at is null and deleted_at is null",
      [t],
    );
    expect(Number(a!.n), "承認待ちは残る").toBe(1);
    await expect(page.getByRole("region", { name: "承認と実行" })).toContainText(MSG.waitingMe);
    await expect(meta(page).locator(".k-prog-stage-locked")).toHaveText("承認待ち");
  });
});
