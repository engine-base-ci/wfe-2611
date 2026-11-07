// K-58 中間テスト 2：PC をつなぐ（K-57）→ チケットを作る（K-60）を、本物のブラウザ・本物の DB・本物の口と、本物の Bridge の決まりで立てた試験の PC でつなぐ（D-128.131）。
//   中の 1 本 1 本の分岐は単体の試験（apps/api/test/features/F3・F4、apps/web/tests/features/F3・F4、apps/bridge/test/pairing.test.ts）が持つ。
//   ここは「つないだときにだけ出るもの」を見る：画面に出たコードが PC の引き取りで本当に通るか・つながった PC の持ち主とチケットを作る人が同じか・
//   PC の生死の判定が画面ごと（PC をつなぐの画面＝listMyDevices／会話などの画面＝app.bridge_state）にずれないか・使い始めの手順の進みが残るか。
//   口は網の手前で差し替えない（page.route で答えを作らない）。人は K-54 の正常の筋と同じ道で作る（_lib/newcomer.ts・受け箱）。
//   PC は _lib/test-pc.ts（apps/bridge/src の pairing・local・loop をそのまま使う）。時刻は DB の時刻を進める（_lib/clock.ts・待たない）。
//   ★前提：CI の web の組の G59 と同じ（API を試験の受け箱へ・画面は 127.0.0.1:3124・この PC の口 38617 が空いている）
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { expect, test, type Page } from "@playwright/test";
import { API, admin } from "../_lib/api";
import { elapsePairingCodes, lastBeatAgo } from "../_lib/clock";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { testPc, type TestPc } from "../_lib/test-pc";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context);
});
/** 開いた PC は筋の終わりに必ず閉じる（この PC の口 38617 を次の筋に残さない・G-10） */
const pcs: TestPc[] = [];
const pcOf = (label: string): TestPc => {
  const p = testPc(label);
  pcs.push(p);
  return p;
};
test.afterEach(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
});

const CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const CODE_DEAD = "その接続コードは使えません。Kaname の「PC をつなぐ」の画面に出ている、新しいコードを入れてください"; // E-CONN-013
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

/** PC をつなぐの画面を開く（入口は案内から：戻る先は開いた画面） */
async function openConnect(page: Page, from = "/tickets"): Promise<void> {
  const res = await page.goto(`/setup/bridge?from=${encodeURIComponent(from)}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "PC をつなぐ" })).toBeVisible();
}
/** 画面に出ている接続コード（人が読んで Bridge の窓に入れるもの） */
async function codeOnScreen(page: Page): Promise<string> {
  const c = page.getByTestId("pairing-code");
  await expect(c).toHaveText(CODE_RE);
  return (await c.innerText()).trim();
}
/** 「つながっています」の印（見出しが「つながっています」で始まる知らせ。待っている間の知らせの本文の「「つながっています」に変わります」とは分ける） */
const liveOn = (page: Page) =>
  page
    .getByRole("status")
    .filter({ hasText: /^つながっています/ })
    .first();
/** 記録はできたが、まだ最初の知らせが無い（D-090） */
const waitingOn = (page: Page, pc: TestPc) => page.getByText(`${pc.label} はつながりました`);

/** 画面のコードを PC に入れ、最初の知らせを送る → 画面が自分で「つながっています」に変わる */
async function connectByCode(page: Page, pc: TestPc): Promise<void> {
  const r = await pc.enterCode(await codeOnScreen(page));
  expect(r, "画面に出たコードで PC が引き取れる").toEqual({ ok: true, token: expect.stringMatching(/^kpc_/) });
  await expect(waitingOn(page, pc), "最初の知らせの前は「つながっています」と言わない").toBeVisible();
  await expect(liveOn(page)).toHaveCount(0);
  expect(await pc.beat(), "生きている知らせが通る（契約の 201）").toBe(201);
  await expect(liveOn(page), "画面が自分で気づく（再読み込みしない）").toBeVisible();
  await expect(liveOn(page)).toContainText(pc.label);
}

/** チケットの画面の「＋ チケットを作る」から作る → 詳細へ。できたチケットの id を返す */
async function createTicket(page: Page, me: Newcomer, title: string): Promise<string> {
  await page.goto("/tickets");
  await page.getByRole("button", { name: "＋ チケットを作る" }).click();
  await expect(page.getByRole("region", { name: "チケットを作る" })).toBeVisible();
  await page.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "担当者" }).click();
  await page.getByRole("option", { name: me.name, exact: true }).click();
  await page.getByRole("textbox", { name: "期限", exact: true }).fill(jst(3));
  await page.getByRole("textbox", { name: "目的", exact: true }).fill("中間テスト 2 の目的");
  await page.getByRole("textbox", { name: "完了の条件", exact: true }).fill("中間テスト 2 の完了の条件");
  await page.getByRole("textbox", { name: "実施事項", exact: true }).fill("中間テスト 2 の実施事項");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("未着手", { exact: true })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** DB：その PC の行（持ち主・名前） */
const deviceRow = (id: string) =>
  admin<{ member_id: string; device_label: string; revoked_at: Date | null }>(
    "select member_id, device_label, revoked_at from sessions where id = $1 and kind_id = 'bridge'",
    [id],
  );
const ticketRow = (id: string) =>
  admin<{ assignee_member_id: string; created_by: string }>(
    "select assignee_member_id, created_by from tickets where id = $1 and deleted_at is null",
    [id],
  );
const setupStepOf = async (memberId: string): Promise<number> =>
  Number((await admin<{ s: number }>("select setup_step as s from members where id = $1", [memberId]))[0]!.s ?? 0);
const bridgeRows = (memberId: string) =>
  admin<{ id: string }>(
    "select id from sessions where member_id = $1 and kind_id = 'bridge' and revoked_at is null and deleted_at is null",
    [memberId],
  );
/** PC をつなぐの画面が読む判定（listMyDevices）。画面と同じブラウザから、本人のログインで口を呼ぶ
 *  （試験の側から直に呼ぶと端末の印が変わり、ログインの印が通らない・D-128.120） */
async function devicesFor(page: Page, me: Newcomer): Promise<{ id: string; state: string }[]> {
  const r = await page.evaluate(
    async ([api, token]) => {
      const res = await fetch(`${api}/api/v1/bridge/devices`, { headers: { authorization: `Bearer ${token}` } });
      return { status: res.status, body: (await res.json()) as { data: { id: string; state: string }[] } };
    },
    [API, me.token] as const,
  );
  expect(r.status).toBe(200);
  return r.body.data;
}
/** 会話など、ほかの画面が読む判定（app.bridge_state の live・K-62 の任せるも同じ 75 秒） */
const stateLive = async (memberId: string): Promise<boolean> =>
  Boolean((await admin<{ s: { live: boolean } }>("select app.bridge_state($1) as s", [memberId]))[0]!.s.live);

test("K58-M2-01 正常（コードを打つ）：登録した人が PC をつなぐ → つながった印 → チケットを作る。PC の持ち主とチケットを作った人が同じ", async ({
  page,
}) => {
  const me = await newcomer(page, box, "正常");
  expect(await bridgeRows(me.memberId), "つなぐ前は PC が無い").toEqual([]);
  await openConnect(page);
  const pc = pcOf("中間2 の MacBook (正常)");
  await connectByCode(page, pc);
  const dev = await pc.deviceId();
  expect((await deviceRow(dev))[0], "PC は画面でログインしている本人のもの").toMatchObject({
    member_id: me.memberId,
    device_label: pc.label,
    revoked_at: null,
  });
  const told = await admin<{ n: number }>(
    "select count(*)::int as n from notifications where member_id = $1 and event_kind_id = 'bridge.connected'",
    [me.memberId],
  );
  expect(told[0]!.n, "受け箱に「PC がつながりました」が 1 件").toBe(1);
  await page.getByRole("link", { name: "戻る" }).click();
  await expect(page, "開いた画面（チケットの画面）へ戻る").toHaveURL(/\/tickets$/);
  const id = await createTicket(page, me, "PC をつないでから作るチケット");
  expect((await ticketRow(id))[0], "チケットを作ったのも担当も、PC の持ち主と同じ人").toEqual({
    assignee_member_id: me.memberId,
    created_by: me.memberId,
  });
  expect(await devicesFor(page, me), "チケットを作った後も、その人の PC はつながったまま 1 台").toEqual([
    expect.objectContaining({ id: dev, state: "live" }),
  ]);
});

test("K58-M2-02 正常（この PC の Bridge）：Bridge が動いている PC では、コードを打たずにボタン 1 つでつながり、チケットを作れる", async ({
  page,
}) => {
  const me = await newcomer(page, box, "この PC");
  const pc = pcOf("中間2 の MacBook (この PC)");
  await pc.openLocal();
  await openConnect(page);
  await expect(page.getByTestId("pairing-code"), "入っている PC にはコードを見せない").toHaveCount(0);
  await page.getByRole("button", { name: "この PC の Bridge につなぐ" }).click();
  await expect(page.getByText("この PC の Bridge にコードを渡しました")).toBeVisible();
  await expect(waitingOn(page, pc)).toBeVisible();
  expect(pc.token(), "画面が渡したコードで、この PC の Bridge が引き取った").toMatch(/^kpc_/);
  expect(await pc.beat()).toBe(201);
  await expect(liveOn(page)).toContainText(pc.label);
  expect((await deviceRow(await pc.deviceId()))[0]!.member_id).toBe(me.memberId);
  const id = await createTicket(page, me, "この PC の Bridge でつないでから作るチケット");
  expect((await ticketRow(id))[0]!.created_by).toBe(me.memberId);
});

test("K58-M2-03 つないでからしばらく：最後の知らせから 74 秒はつながっている・76 秒は閉じている。PC をつなぐの画面とほかの画面の判定がずれない", async ({
  page,
}) => {
  const me = await newcomer(page, box, "しばらく");
  await openConnect(page);
  const pc = pcOf("中間2 の MacBook (しばらく)");
  await connectByCode(page, pc);
  const dev = await pc.deviceId();
  // 境目そのもの（74・76 秒）は、時刻を置いた直後に両方の判定を読む（画面の読み込みの秒で境目が動かないように・待たない）
  for (const [ago, live] of [
    ["74 seconds", true],
    ["76 seconds", false],
  ] as const) {
    expect(await lastBeatAgo(dev, ago)).toBe(1);
    const [devices, other] = await Promise.all([devicesFor(page, me), stateLive(me.memberId)]);
    expect(devices.find((d) => d.id === dev)?.state, `${ago}：PC をつなぐの画面の判定`).toBe(live ? "live" : "asleep");
    expect(other, `${ago}：ほかの画面の判定が同じ`).toBe(live);
  }
  // 画面は境目から離れたところで両側を見る（60 秒＝つながっている・76 秒を過ぎた＝閉じている）
  expect(await lastBeatAgo(dev, "60 seconds")).toBe(1);
  await page.reload();
  await expect(liveOn(page)).toBeVisible();
  expect(await lastBeatAgo(dev, "76 seconds")).toBe(1);
  await page.reload();
  await expect(page.getByRole("region", { name: "切れています" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bridge を起こす" })).toBeVisible();
  // PC が起きて知らせる → 画面が自分で戻る
  expect(await pc.beat()).toBe(201);
  await expect(liveOn(page)).toBeVisible();
});

test("K58-M2-04 PC を閉じたまま：つないだ後に PC を閉じても、チケットは作れる（作ることは PC の有無に縛られない・D-127.8）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "閉じたまま");
  await openConnect(page);
  const pc = pcOf("中間2 の MacBook (閉じたまま)");
  await connectByCode(page, pc);
  const dev = await pc.deviceId();
  await pc.close();
  expect(await lastBeatAgo(dev, "5 minutes"), "PC を閉じて 5 分").toBe(1);
  expect(await stateLive(me.memberId)).toBe(false);
  const id = await createTicket(page, me, "PC を閉じたまま作るチケット");
  expect((await ticketRow(id))[0]!.created_by).toBe(me.memberId);
  // PC は外れていない（閉じているだけ）。PC をつなぐの画面は「切れています」と起こす道を出す
  expect((await deviceRow(dev))[0]!.revoked_at).toBeNull();
  await openConnect(page);
  await expect(page.getByRole("region", { name: "切れています" })).toBeVisible();
});

test("K58-M2-05 コードの期限切れ：10 分を過ぎたコードは PC が引き取れない。画面の「新しいコード」で出し直すと通り、使い始めの手順が進む", async ({
  page,
}) => {
  const me = await newcomer(page, box, "期限切れ");
  await openConnect(page);
  const first = await codeOnScreen(page);
  expect(await elapsePairingCodes(me.memberId, "10 minutes 1 second"), "DB の時刻を 10 分 1 秒進める").toBe(1);
  const pc = pcOf("中間2 の MacBook (期限切れ)");
  expect(await pc.enterCode(first), "PC 側に「使えません」（違う・使った・期限切れを見分けさせない）").toEqual({
    ok: false,
    message: CODE_DEAD,
  });
  expect(await bridgeRows(me.memberId), "期限切れのコードでは PC ができない").toEqual([]);
  expect(await setupStepOf(me.memberId), "手順は進まない").toBe(0);
  await page.getByRole("button", { name: "新しいコード" }).click();
  await expect(page.getByTestId("pairing-code")).not.toHaveText(first);
  await connectByCode(page, pc);
  expect(await setupStepOf(me.memberId), "出し直したコードで「PC をつなぐ」が済む").toBeGreaterThanOrEqual(1);
});

test("K58-M2-06 別のタブ：タブ B でコードを出すとタブ A のコードは使えない。B のコードでつながると、A も B も自分で「つながっています」に変わる", async ({
  page,
  context,
}) => {
  const me = await newcomer(page, box, "別のタブ");
  await openConnect(page); // タブ A
  const a = await codeOnScreen(page);
  const tabB = await context.newPage();
  await openConnect(tabB); // タブ B（同じ人・同じブラウザ）
  const b = await codeOnScreen(tabB);
  expect(b, "タブごとに新しいコード").not.toBe(a);
  const pc = pcOf("中間2 の MacBook (別のタブ)");
  expect(await pc.enterCode(a), "前のタブのコードは使えない（最後の 1 つだけが生きる）").toEqual({
    ok: false,
    message: CODE_DEAD,
  });
  expect(await pc.enterCode(b)).toEqual({ ok: true, token: expect.stringMatching(/^kpc_/) });
  expect(await pc.beat()).toBe(201);
  await expect(liveOn(tabB), "コードを出したタブ").toBeVisible();
  await expect(liveOn(page), "もう 1 つのタブも、再読み込みせずに同じ").toBeVisible();
  expect(await bridgeRows(me.memberId), "PC は 1 台").toHaveLength(1);
  await tabB.close();
});

test("K58-M2-07 使い始めの手順：つなぐ前は入口が「PC をつなぐ」へ、つないだ後は次の段（話す）へ送る。チケットの画面はどちらでも開ける", async ({
  page,
}) => {
  const me = await newcomer(page, box, "手順");
  await page.goto("/");
  await expect(page, "まだ何もしていない人は「PC をつなぐ」へ").toHaveURL(/\/setup\/bridge$/);
  const pc = pcOf("中間2 の MacBook (手順)");
  await connectByCode(page, pc);
  expect(await setupStepOf(me.memberId)).toBeGreaterThanOrEqual(1);
  await page.goto("/");
  await expect(page, "「PC をつなぐ」が済んだ人は、次の段（話す）へ").toHaveURL(/\/onboard\/interview$/);
  await page.goto("/setup/bridge");
  await expect(liveOn(page), "済んだ段の画面に戻っても、つながったまま").toBeVisible();
  await page.goto("/tickets");
  await expect(page.getByRole("button", { name: "＋ チケットを作る" }), "チケットの画面は手順の門の外").toBeVisible();
});
