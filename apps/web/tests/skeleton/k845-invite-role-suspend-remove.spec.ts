// K-845 中間テスト（段 11・M1）：招く → 参加する → 役割を変える → 兼ねる → 止める → 戻す → 外す → 外した人の担当が引き継ぎ先に出て、外した人は入れない → 30 日の内に招き直す
//   を、本物のブラウザ 3 つ（管理者・外す人・引き継ぎ先）・本物の DB・本物の口と、試験の PC でつなぐ（流れをまたぐ影響 E1・E2。段 9 の渡し・段 5 の承認と一緒に）。
//   中の 1 本 1 本の分岐は単体（口：K-807〜K-817・K-848・K-849 の apps/api/test/features/F10・画面：K-818〜K-822 の apps/web/tests/k）が持つ。
//   ここは「つないだときにだけ出るもの」を見る：招待のメールで入った人がメンバーの画面に出るか・役割と兼務がグループごとに効くか（D-154.15）・
//   止める／外すと開いていた画面とログインがすぐ効かなくなるか（D-154.20）・外すと選んだ引き継ぎ先にすぐ担当が移り（D-154.6・D-154.54）、
//   渡し中が取り消され（D-154.78）、承認する人が引き継ぎ先に替わるか（D-150.21・D-128.25）・招き直すとグループと役割だけ戻るか（D-154.26・D-154.41）。
//   口は網の手前で差し替えない（届く頭 x-forwarded-for だけを足す）。招待は画面の「＋ 招く」と試験の受け箱（_lib/mailbox.ts）の本物のメールで通す。
//   PC は K-58 の試験の PC（_lib/test-pc.ts）・AI は決まった答え（_lib/f5-flow.ts の AI）。この PC の中だけの口（38617）は開かない（本人の Bridge に触らない）。
//   本人確認の取り直しは、取り直しの時刻（sessions.step_up_at）を DB で置いて決める（15 分の内なら省く・D-154.18）。固定の待ちは置かない。
//   1 本ずつ順に流し、前の筋の人とチケットを次の筋が使う（1 回の通し）。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { PW, addTestEntry, admin, uniqEmail } from "../_lib/api";
import { AI, delegatedMark, workOf } from "../_lib/f5-flow";
import { answered, assigneeOf, handoversOf, openQueue, passOnScreen, queueRow } from "../_lib/f8-flow";
import { Mailbox, type Mail } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson, bodyOf, pairedPc, pressDelegate, ticketOf, type TicketSections } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";
// 足すグループ・引き継ぎ先の ▾ は部品 components/k の Select（Base UI・素の <select> は無い）。招くの小窓のグループ・役割は素の <select>
async function pick(page: Page, sel: Locator, label: string): Promise<void> {
  await sel.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const box = new Mailbox();
const ctxs: BrowserContext[] = [];
const pcs: TestPc[] = [];
test.describe.configure({ mode: "serial", timeout: 180_000 });
test.beforeAll(() => box.open());
test.afterAll(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
  await Promise.all(ctxs.splice(0).map((c) => c.close()));
  await box.close();
});

/** 文言（K-818〜K-822 の仕様の表・下絵 mb-*・md-*・K-335・K-336・正本の E-AUTH-011・E-AUTH-007 から。実装から書かない） */
const MSG = {
  inviteMail: /への招待が届きました/,
  suspendedRow: "一時的に止まっている",
  suspendedBand: "一時的に止まっています",
  loginSuspended: "このアカウントは、いま止められています。ワークスペースの管理者に聞いてください",
  loginGone: "このアカウントは、会社の登録が見つからないため使えません",
  waitingMe: "あなたの承認を待っています",
  removed: "を外しました",
} as const;
// 招く小窓のメールの欄の名前は必須の印つき（「メール 必須」／印 *）。印の有無を許す
const MAIL_LABEL = /^メール( 必須|\*)?$/;
const SECTIONS: TicketSections = { purpose: "先方の見積を出す", done: "先方が受け取った", todo: "- 見積を作る" };
const G = { sales: "営業部", tokyo: "東京チーム", acct: "経理部" } as const;

interface Person {
  name: string;
  email: string;
  memberId: string;
  userId: string;
  token: string;
  ctx: BrowserContext;
  page: Page;
}
interface World {
  a: Newcomer;
  aPage: Page;
  groups: Record<keyof typeof G, string>;
  b: Person;
  c: Person;
  t1: string;
  t2: string;
  t1Title: string;
  t2Title: string;
}
let w: World | null = null;
const W = (): World => {
  if (!w) throw new Error("前の筋（K845-M1-01）で人とグループができていない");
  return w;
};

// ---------------------------------------------------------------- 準備の道具（このファイルの中だけ・前からの道具は変えない）
const stepFresh = (memberId: string) =>
  admin("update sessions set step_up_at = now() where member_id = $1 and revoked_at is null", [memberId]);
const stepStale = (memberId: string) =>
  admin("update sessions set step_up_at = null where member_id = $1 and revoked_at is null", [memberId]);
const stepDlg = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます", exact: true });
async function passStepUp(page: Page): Promise<void> {
  await expect(stepDlg(page), "本人確認の取り直しの小窓が出る（取り直しが古い）").toBeVisible();
  await stepDlg(page).getByLabel("パスワード", { exact: true }).fill(PW);
  await stepDlg(page).getByRole("button", { name: "確かめる", exact: true }).click();
}
const tokenOf = (page: Page) => page.evaluate(() => window.localStorage.getItem("kaname.token"));
function inviteLink(mail: Mail): string {
  const hits = [...mail.text.matchAll(/https?:\/\/[^\s<>"）)]+\/invite\/[A-Za-z0-9_-]+/g)].map((m) => m[0]);
  if (hits.length !== 1) throw new Error(`招待のメールに招待のリンクが ${hits.length} 本：${mail.subject}`);
  return hits[0]!;
}
async function scopeOf(page: Page, token: string, body: Record<string, unknown>): Promise<string> {
  const r = await asPerson(page, token, "POST", "/scopes", body);
  if (r.status !== 201) throw new Error(`グループを足す口が ${r.status}`);
  return String(r.data?.["id"]);
}
async function ticketIn(page: Page, p: Person, scopeId: string, title: string): Promise<string> {
  const kinds = await asPerson(page, p.token, "GET", "/ticket_kinds");
  const kind = ((kinds.data as unknown as { id: string; name: string }[] | null) ?? []).find(
    (k) => k.name === "タスク",
  );
  if (!kind) throw new Error(`チケットの種類「タスク」が無い（口は ${kinds.status}）`);
  const due = new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10);
  const r = await asPerson(page, p.token, "POST", "/tickets", {
    scope_id: scopeId,
    kind_id: kind.id,
    title,
    assignee_member_id: p.memberId,
    due_on: due,
    body: bodyOf(SECTIONS),
  });
  if (r.status !== 201) throw new Error(`チケットを作る口が ${r.status}`);
  return String(r.data?.["id"] ?? (r.data?.["ticket"] as Record<string, unknown> | undefined)?.["id"]);
}
/** 招待のメールのリンクで新しく参加する（K-335）。付けるまで進めない（K-321）は入り方を 1 つ足して下ろす */
async function joinByMail(browser: Browser, email: string, name: string): Promise<Person> {
  const ctx = await browser.newContext();
  ctxs.push(ctx);
  await ownIp(ctx, 84);
  const page = await ctx.newPage();
  expect((await page.goto(inviteLink(await box.waitFor(email, 1, MSG.inviteMail))))?.status()).toBe(200);
  await page.getByLabel("名前", { exact: true }).fill(name);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "参加する", exact: true }).click();
  await page.waitForURL(/\/mfa-setup/);
  const [u] = await admin<{ id: string; m: string }>(
    `select u.id, m.id as m from kaname_auth."user" u join members m on m.auth_user_id = u.id
      where u.email = $1 and m.deleted_at is null`,
    [email],
  );
  await addTestEntry(u!.id);
  expect((await page.goto("/tickets"))?.status(), "参加した人がチケットの画面を開ける").toBe(200);
  const token = await tokenOf(page);
  expect(token, "参加した人はログインの印を持つ").toBeTruthy();
  return { name, email, memberId: u!.m, userId: u!.id, token: token!, ctx, page };
}
async function loginOnScreen(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("メールアドレス", { exact: true }).fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
}
const membershipsOf = (memberId: string) =>
  admin<{ scope_id: string; role: string; is_primary: boolean }>(
    "select scope_id, role, is_primary from scope_memberships where member_id = $1 and deleted_at is null order by is_primary desc, scope_id",
    [memberId],
  );

// ---------------------------------------------------------------- メンバーの画面の 1 歩
const region = (page: Page, g: string): Locator => page.getByRole("region", { name: g, exact: true });
async function openMembers(page: Page, groups: string[]): Promise<void> {
  await page.goto("/members");
  await expect(page.getByRole("heading", { level: 1, name: "メンバー", exact: true })).toBeVisible();
  for (const g of groups) {
    const t = region(page, g).locator(".k-f10m-toggle");
    if ((await t.getAttribute("aria-expanded")) !== "true") await t.click();
    await expect(t).toHaveAttribute("aria-expanded", "true");
  }
}
const rowOf = (page: Page, g: string, who: string): Locator =>
  region(page, g).locator(".k-f10m-row").filter({ hasText: who });
async function changeRole(page: Page, g: string, who: string, role: string): Promise<number> {
  await rowOf(page, g, who)
    .getByRole("button", { name: new RegExp(`^${who}の役割を変える`) })
    .click();
  const res = answered(page, "PATCH", /^\/api\/v1\/members\/[^/]+\/role$/);
  await page.getByRole("menuitem", { name: role, exact: true }).click();
  return (await res).status();
}

test("K845-M1-01 招く → 参加：管理者がメンバーの画面の「＋ 招く」で 2 人を営業部に招き、2 人が招待のメールのリンクで参加すると、営業部の行に 2 人がメンバーとして出る", async ({
  page,
  browser,
}) => {
  await ownIp(page.context(), 85);
  const a = await newcomer(page, box, "段11");
  // 層 2 つ（本部・課）とグループ 3 つ（営業部・その下の東京チーム・経理部）を口で作る（作る画面は K-805 が持つ）
  for (const label of ["本部", "課"])
    expect((await asPerson(page, a.token, "POST", "/layers", { label })).status, `層「${label}」を足す`).toBe(201);
  const sales = await scopeOf(page, a.token, { name: G.sales, ticket_prefix: "SALES" });
  const tokyo = await scopeOf(page, a.token, { name: G.tokyo, ticket_prefix: "TKY", parent_id: sales });
  const acct = await scopeOf(page, a.token, { name: G.acct, ticket_prefix: "ACC" });
  const layers = await admin<{ id: string; l: string | null }>(
    "select id, layer_id::text as l from scopes where id = any($1::uuid[])",
    [[sales, tokyo]],
  );
  expect(new Set(layers.map((r) => r.l)).size, "営業部と東京チームは違う層").toBe(2);
  // 招く（K-420 の小窓）
  const emails = [uniqEmail(), uniqEmail()];
  await openMembers(page, []);
  await page.getByRole("button", { name: "＋ 招く", exact: true }).click();
  const dlg = page.locator(".k-dialog");
  for (const e of emails) {
    await dlg.getByLabel(MAIL_LABEL).fill(e);
    await dlg.getByRole("button", { name: "足す", exact: true }).click();
  }
  await dlg.getByLabel("グループ", { exact: true }).selectOption({ label: G.sales });
  await dlg.getByLabel("役割", { exact: true }).selectOption({ label: "メンバー" });
  const sent = answered(page, "POST", /^\/api\/v1\/invitations$/);
  await dlg.getByRole("button", { name: "2 人を招く", exact: true }).click();
  expect((await sent).status(), "招く口が受ける").toBe(201);
  await expect(page.locator(".k-toast")).toContainText("2 人に招待を送りました");
  // 参加する（招待のメールのリンク・K-335）
  const b = await joinByMail(browser, emails[0]!, "佐藤 健");
  const c = await joinByMail(browser, emails[1]!, "田中 美咲");
  // 反映：開き直したメンバーの画面と DB
  await openMembers(page, [G.sales]);
  for (const p of [b, c]) {
    await expect(rowOf(page, G.sales, p.name), `${p.name} が営業部の行に出る`).toHaveCount(1);
    await expect(rowOf(page, G.sales, p.name)).toContainText("メンバー");
    expect(await membershipsOf(p.memberId)).toEqual([{ scope_id: sales, role: "member", is_primary: true }]);
  }
  const used = await admin<{ n: number }>(
    "select count(*)::int as n from invitations where lower(email) = any($1::text[]) and accepted_member_id is not null",
    [emails],
  );
  expect(used[0]!.n, "2 つの招待は使われた").toBe(2);
  w = {
    a,
    aPage: page,
    groups: { sales, tokyo, acct },
    b,
    c,
    t1: "",
    t2: "",
    t1Title: `見積を出す 段11 ${Date.now()}`,
    t2Title: `経費をまとめる 段11 ${Date.now()}`,
  };
});

test("K845-M1-02 役割を変える × 違う層のマネージャーを兼ねる：役割の ▾ で田中さんを営業部のマネージャーにし（取り直しの小窓を通る）、兼ねるグループに東京チームを足して、そこでもマネージャーにすると、2 つの層の行がどちらもマネージャー", async ({
  page,
}) => {
  const s = W();
  await ownIp(page.context(), 86);
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), s.a.token);
  await stepStale(s.a.memberId);
  await openMembers(page, [G.sales]);
  // 1 回目は取り直しが古いので小窓が出て、通ると同じ体で 1 回だけやり直す（D-154.18）
  await rowOf(page, G.sales, s.c.name)
    .getByRole("button", { name: new RegExp(`^${s.c.name}の役割を変える`) })
    .click();
  const first = answered(page, "PATCH", /^\/api\/v1\/members\/[^/]+\/role$/);
  await page.getByRole("menuitem", { name: "マネージャー", exact: true }).click();
  expect((await first).status(), "取り直しが古いと口は 403").toBe(403);
  const again = answered(page, "PATCH", /^\/api\/v1\/members\/[^/]+\/role$/);
  await passStepUp(page);
  expect((await again).status(), "通ったら 1 回だけやり直す").toBe(200);
  // 兼ねるグループを足す（K-820・役割を送らずメンバーで入る・D-154.70）
  await stepFresh(s.a.memberId);
  await page.goto(`/members/${s.c.memberId}?do=also`);
  const also = page.getByRole("dialog", { name: "兼ねるグループを足す・外す", exact: true });
  await pick(page, also.getByRole("combobox", { name: "足すグループ", exact: true }), G.tokyo);
  const saved = answered(page, "PATCH", /^\/api\/v1\/members\/[^/]+\/groups$/);
  await also.getByRole("button", { name: "本人確認して保存する", exact: true }).click();
  expect((await saved).status(), "兼ねるグループを足す口が受ける").toBe(200);
  // 兼ねる側の行で役割を変えると、そのグループの役割だけが変わる（D-154.66）
  await openMembers(page, [G.sales, G.tokyo]);
  await expect(rowOf(page, G.tokyo, s.c.name)).toContainText("兼ねている");
  await expect(rowOf(page, G.tokyo, s.c.name)).toContainText("メンバー");
  expect(await changeRole(page, G.tokyo, s.c.name, "マネージャー")).toBe(200);
  await openMembers(page, [G.sales, G.tokyo]);
  await expect(rowOf(page, G.sales, s.c.name)).toContainText("マネージャー");
  await expect(rowOf(page, G.tokyo, s.c.name)).toContainText("マネージャー");
  expect(await membershipsOf(s.c.memberId)).toEqual([
    { scope_id: s.groups.sales, role: "manager", is_primary: true },
    { scope_id: s.groups.tokyo, role: "manager", is_primary: false },
  ]);
  // 役割を変えてもその人の画面は切れない（止める・外すとは違う）
  expect((await asPerson(s.c.page, s.c.token, "GET", "/ticket_kinds")).status, "田中さんの印は生きている").toBe(200);
});

test("K845-M1-03 別の部署に作業員として兼ねる：佐藤さんに経理部を兼ねさせると、営業部（主）と経理部の両方の行に出て、経理部でもチケットを持てる", async ({
  page,
}) => {
  const s = W();
  await ownIp(page.context(), 87);
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), s.a.token);
  await stepFresh(s.a.memberId);
  await page.goto(`/members/${s.b.memberId}?do=also`);
  const also = page.getByRole("dialog", { name: "兼ねるグループを足す・外す", exact: true });
  await pick(page, also.getByRole("combobox", { name: "足すグループ", exact: true }), G.acct);
  const saved = answered(page, "PATCH", /^\/api\/v1\/members\/[^/]+\/groups$/);
  await also.getByRole("button", { name: "本人確認して保存する", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await openMembers(page, [G.sales, G.acct]);
  await expect(rowOf(page, G.sales, s.b.name)).toContainText("メンバー");
  await expect(rowOf(page, G.acct, s.b.name)).toContainText("兼ねている");
  // 佐藤さんが 2 つの部署のチケットを持つ（後の筋が外すときに引き継ぐ物）
  s.t1 = await ticketOf(s.b.page, { ...s.b, company: "" }, s.t1Title, SECTIONS);
  s.t2 = await ticketIn(s.b.page, s.b, s.groups.acct, s.t2Title);
  expect(await assigneeOf(s.t1)).toBe(s.b.memberId);
  expect(await assigneeOf(s.t2)).toBe(s.b.memberId);
  expect(
    (await admin<{ s: string }>("select scope_id::text as s from tickets where id = $1", [s.t2]))[0]!.s,
    "2 枚目は経理部のチケット",
  ).toBe(s.groups.acct);
});

test("K845-M1-04 止める → 入れない → 戻す → 入り直せる：止めると佐藤さんの開いていた画面はログインへ落ち、ログインも断られ、両方のグループの行が止まっている。担当はそのまま。戻すと入り直せる", async ({
  page,
}) => {
  const s = W();
  await ownIp(page.context(), 88);
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), s.a.token);
  await stepFresh(s.a.memberId);
  await page.goto(`/members/${s.b.memberId}`);
  await page.getByRole("button", { name: "一時的に止める", exact: true }).click();
  const stop = page.getByRole("alertdialog", { name: `${s.b.name} さんを一時的に止めますか`, exact: true });
  const res = answered(page, "POST", /^\/api\/v1\/members\/[^/]+\/suspend$/);
  await stop.getByRole("button", { name: "本人確認して止める", exact: true }).click();
  expect((await res).status()).toBe(200);
  await expect(page.getByText(MSG.suspendedBand)).toBeVisible();
  // 兼務：営業部と経理部の両方の行が止まっている（D-154.15）
  await openMembers(page, [G.sales, G.acct]);
  await expect(rowOf(page, G.sales, s.b.name)).toContainText(MSG.suspendedRow);
  await expect(rowOf(page, G.acct, s.b.name)).toContainText(MSG.suspendedRow);
  // 止めた瞬間に開いていた画面の印は効かない（G-14・D-154.20）
  expect((await asPerson(s.b.page, s.b.token, "GET", "/ticket_kinds")).status, "古い印は 401").toBe(401);
  await s.b.page.goto("/tickets");
  await expect.poll(() => new URL(s.b.page.url()).pathname, "開き直すとログインの画面").toBe("/login");
  await loginOnScreen(s.b.page, s.b.email);
  await expect(s.b.page.getByText(MSG.loginSuspended)).toBeVisible();
  expect(await tokenOf(s.b.page), "止められた人に印を持たせない").toBeFalsy();
  expect(await assigneeOf(s.t1), "担当はそのまま").toBe(s.b.memberId);
  // 戻す
  await page.goto(`/members/${s.b.memberId}`);
  await page.getByRole("button", { name: "戻す", exact: true }).click();
  const back = page.getByRole("alertdialog", { name: `${s.b.name} さんを戻しますか`, exact: true });
  const res2 = answered(page, "POST", /^\/api\/v1\/members\/[^/]+\/resume$/);
  await back.getByRole("button", { name: "本人確認して戻す", exact: true }).click();
  expect((await res2).status()).toBe(200);
  await expect(page.getByText(MSG.suspendedBand)).toHaveCount(0);
  expect((await asPerson(s.b.page, s.b.token, "GET", "/ticket_kinds")).status, "戻しても古い印は戻らない").toBe(401);
  await loginOnScreen(s.b.page, s.b.email);
  await expect.poll(() => tokenOf(s.b.page), "入り直すと印を持つ").toBeTruthy();
  s.b = { ...s.b, token: (await tokenOf(s.b.page))! };
});

test("K845-M1-05 外す前：佐藤さんの営業部のチケットが承認待ち・経理部のチケットが管理者へ渡し中のとき、外す小窓は 2 件の引き継ぎ先に主のグループのマネージャー（田中さん）を初めから選び、渡し中を取り消すと出す。外すと取り直しの小窓を通り、知らせが出る", async ({
  page,
}) => {
  const s = W();
  // 佐藤さんの PC で 1 枚目を承認待ちにする（段 5 の承認・承認する人は担当者）
  const pc = await pairedPc(s.b.page, s.b.token, "中間 段11 の MacBook");
  pcs.push(pc);
  const pw = workOf(pc);
  await s.b.page.goto(`/tickets/${s.t1}`);
  await pressDelegate(s.b.page);
  let job: Awaited<ReturnType<typeof pw.take>> = null;
  await expect.poll(async () => (job ??= await pw.take()), "任せた仕事が佐藤さんの PC に渡る").not.toBeNull();
  expect(
    await pw.finish(job!.job_id, { state: "done", result: AI.made, agent_session_id: `k845-${Date.now()}` }),
  ).toEqual({ status: 201, outcome: "awaiting_approval" });
  // 2 枚目を管理者に引き継いでもらう（段 9 の渡し・待っている）
  await s.b.page.goto(`/tickets/${s.t2}`);
  expect(await passOnScreen(s.b.page, s.a.name, { reason: "経理の締めは管理者が詳しい" })).toBe(201);
  expect((await handoversOf(s.t2)).map((h) => h.state)).toEqual(["waiting"]);
  // 外す（K-822）
  await ownIp(page.context(), 89);
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), s.a.token);
  await stepStale(s.a.memberId);
  await page.goto(`/members/${s.b.memberId}`);
  await page.getByRole("button", { name: "ワークスペースから外す", exact: true }).click();
  const d = page.getByRole("dialog", { name: `${s.b.name} さんをワークスペースから外す`, exact: true });
  await expect(d).toContainText("担当しているチケット 2 件の引き継ぎ先");
  await expect(
    d.getByRole("combobox", { name: "全部の引き継ぎ先", exact: true }),
    "初めの選びは主のグループのマネージャー（D-154.54）",
  ).toContainText(s.c.name);
  await expect(d).toContainText("外す前に取り消される");
  const first = answered(page, "POST", /^\/api\/v1\/members\/[^/]+\/remove$/);
  await d.getByRole("button", { name: "本人確認して外す", exact: true }).click();
  expect((await first).status(), "取り直しが古いと口は 403").toBe(403);
  const again = answered(page, "POST", /^\/api\/v1\/members\/[^/]+\/remove$/);
  await passStepUp(page);
  expect((await again).status(), "通ったら同じ体で 1 回だけやり直す").toBe(200);
  await expect(page.locator(".k-toast")).toContainText(MSG.removed);
  await expect.poll(() => new URL(page.url()).pathname, "外すとメンバーの画面へ").toBe("/members");
});

test("K845-M1-06 引き継ぎ先に出る：外した直後、2 枚とも田中さんが担当で、田中さんの画面の 1 枚目に承認の帯が出る。渡しは取り消され管理者の承認待ちから消える。佐藤さんはどちらのグループの行にも出ない", async ({
  page,
}) => {
  const s = W();
  expect(await assigneeOf(s.t1)).toBe(s.c.memberId);
  expect(await assigneeOf(s.t2)).toBe(s.c.memberId);
  expect(await delegatedMark(s.t1), "分身に任せた印は下りる（D-154.38）").toBe(false);
  // 段 5 の承認：承認する人は今の担当者（D-150.21・D-128.25）
  await s.c.page.goto(`/tickets/${s.t1}`);
  await expect(s.c.page.getByRole("region", { name: "承認と実行" })).toContainText(MSG.waitingMe);
  // 段 9 の渡し：取り消され、受ける側だった管理者にお知らせ（D-154.78）・承認待ちに残らない
  expect((await handoversOf(s.t2)).map((h) => h.state)).toEqual(["withdrawn"]);
  const notes = await admin<{ m: string; k: string; cause: string | null }>(
    `select member_id::text as m, event_kind_id as k, payload->>'cause' as cause from notifications
      where member_id = any($1::uuid[]) and event_kind_id in ('handover.withdrawn', 'member.tickets_received')
        and deleted_at is null order by event_kind_id`,
    [[s.a.memberId, s.c.memberId]],
  );
  expect(notes).toEqual([
    { m: s.a.memberId, k: "handover.withdrawn", cause: "member_removed" },
    { m: s.c.memberId, k: "member.tickets_received", cause: null },
  ]);
  await ownIp(page.context(), 90);
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), s.a.token);
  await openQueue(page);
  await expect(queueRow(page, s.t2Title), "取り消した渡しは承認待ちに出ない").toHaveCount(0);
  // 兼務の人はどのグループの行からも消える（D-154.15）
  await openMembers(page, [G.sales, G.acct]);
  await expect(rowOf(page, G.sales, s.b.name)).toHaveCount(0);
  await expect(rowOf(page, G.acct, s.b.name)).toHaveCount(0);
  const audit = await admin<{ n: number }>(
    "select count(*)::int as n from audit_events where action = 'member.remove' and target_id = $1",
    [s.b.memberId],
  );
  expect(audit[0]!.n, "外したことは記録に 1 行").toBe(1);
});

test("K845-M1-07 外した人は入れない：外した直後、佐藤さんの開いていた画面はログインへ落ち、ログインしても入れない。PC の印も効かない", async () => {
  const s = W();
  expect((await asPerson(s.b.page, s.b.token, "GET", "/ticket_kinds")).status, "古い印は 401").toBe(401);
  await s.b.page.goto("/tickets");
  await expect.poll(() => new URL(s.b.page.url()).pathname).toBe("/login");
  await loginOnScreen(s.b.page, s.b.email);
  await expect(s.b.page.getByText(MSG.loginGone)).toBeVisible();
  expect(await tokenOf(s.b.page), "外した人に印を持たせない").toBeFalsy();
  const live = await admin<{ n: number }>(
    "select count(*)::int as n from sessions where member_id = $1 and revoked_at is null",
    [s.b.memberId],
  );
  expect(live[0]!.n, "画面と PC のセッションは全部切れている").toBe(0);
});

test("K845-M1-08 30 日の内に招き直す：同じメールで営業部に招き直し、佐藤さんが今のアカウントで参加すると、営業部（主）と経理部（兼務）がメンバーで戻り、引き継いだチケットは田中さんのまま", async ({
  page,
}) => {
  const s = W();
  await ownIp(page.context(), 91);
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), s.a.token);
  await openMembers(page, []);
  await page.getByRole("button", { name: "＋ 招く", exact: true }).click();
  const dlg = page.locator(".k-dialog");
  await dlg.getByLabel(MAIL_LABEL).fill(s.b.email);
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await dlg.getByLabel("グループ", { exact: true }).selectOption({ label: G.sales });
  await dlg.getByLabel("役割", { exact: true }).selectOption({ label: "メンバー" });
  const sent = answered(page, "POST", /^\/api\/v1\/invitations$/);
  await dlg.getByRole("button", { name: "招く", exact: true }).click();
  expect((await sent).status()).toBe(201);
  // 佐藤さん：招待のメール（2 通目）→ ログインして参加する → 今のアカウントで参加する（K-336）
  const link = inviteLink(await box.waitFor(s.b.email, 2, MSG.inviteMail));
  const path = new URL(link).pathname;
  await s.b.page.goto(link);
  await s.b.page.getByRole("link", { name: "ログインして参加する", exact: true }).click();
  await s.b.page.waitForURL((u) => u.pathname === "/login" && u.searchParams.get("next") === path);
  await s.b.page.getByLabel("メールアドレス", { exact: true }).fill(s.b.email);
  await s.b.page.getByLabel("パスワード", { exact: true }).fill(PW);
  await s.b.page.getByRole("button", { name: "次へ", exact: true }).click();
  await s.b.page.waitForURL((u) => u.pathname === path);
  const join = answered(s.b.page, "POST", /^\/api\/v1\/auth\/invitations\/[^/]+\/accept$/);
  await s.b.page.getByRole("button", { name: "今のアカウントで参加する", exact: true }).click();
  expect((await join).status(), "参加の口が受ける").toBe(201);
  const [nb] = await admin<{ id: string }>(
    "select id from members where auth_user_id = $1 and deleted_at is null and tenant_id = (select tenant_id from members where id = $2)",
    [s.b.userId, s.a.memberId],
  );
  expect(nb, "会社の人の行が戻る（外した人の同じ行が生き返る・K-852）").toBeTruthy();
  expect(await membershipsOf(nb!.id)).toEqual([
    { scope_id: s.groups.sales, role: "member", is_primary: true },
    { scope_id: s.groups.acct, role: "member", is_primary: false },
  ]);
  expect(await assigneeOf(s.t1), "引き継いだチケットは戻らない").toBe(s.c.memberId);
  expect(await assigneeOf(s.t2)).toBe(s.c.memberId);
  await openMembers(page, [G.sales, G.acct]);
  await expect(rowOf(page, G.sales, s.b.name)).toHaveCount(1);
  await expect(rowOf(page, G.acct, s.b.name)).toContainText("兼ねている");
});
