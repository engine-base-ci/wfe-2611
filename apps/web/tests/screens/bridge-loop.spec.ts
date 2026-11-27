// 受け取って返す（D-090・T-B-03）を画面から押して確かめる。テストの名前に正本の行 ID を持つ（op_gate.py）。
// Bridge の役は、本物の口（x-bridge-session）を叩いて演じる。画面から見える振る舞いは実物と同じ。
// 止まったものは自動で再開しない。止まったら理由だけを出し、次に送る文で決まる（D-104.15 で D-090.5 を改めた）。
// K-367：前の「PC をつなぐ」画面（T-U-09）を消したので、その画面を開いていた 10 本（BRG-03-019/023・026・014・021・022・
//   BRG-06-005・008・006・004・010）を消した（行は置き換え先の行 ID つきの BLOCKED・07_qa/test-specs/screens/bridge-setup.md ほか）。
//   BRG-03-013/015 は会話の画面の側だけを残した（PC の画面の「切れています」は K230-UI-011・K57-UI-015 が見る）。前の画面が在っても無くても通る。
//   PC をつなぐ・生きている知らせ・受け取るは K-57 の契約の口（/api/v1/bridge/*）。
//   Bridge の口は PC の印（"kpc_…"）、DB の行は sessions の id（deviceRowId で引く・K-57 で分けた・D-128.137）
import { expect, test, type Page } from "@playwright/test";
import {
  bridgeAnswer,
  bridgeAsk,
  bridgeAsleep,
  bridgeBeat,
  bridgeFinish,
  bridgeProgress,
  bridgeTake,
  claimBridge,
  deviceRowId,
  jobStates,
  loginAs,
  hideRealBridge,
  setupStep,
  signupViaApi,
  toolAudit,
} from "../_lib/api";

// 偽の Bridge で演じるので、この PC の本物は止めておく（港と「入っている」判定がぶつかる）
// 「起こす」を試すと kaname-bridge:// で本物が立ち上がる。次のテストに持ち越さない（G-10）
// 本物の Bridge は止めない（本人の仕事が死ぬ）。画面からだけ見えなくする
test.beforeEach(({ page }) => hideRealBridge(page));

/** はじめの設定を通した人が、この PC をつないだ状態で会話モードを開く */
async function connected(page: Page) {
  const u = await signupViaApi();
  const sid = await claimBridge(u.token); // PC の印（Bridge の口に載せる）
  const row = await deviceRowId(sid); // その PC の sessions の行（DB の時刻を動かすとき）
  await setupStep(u.memberId, 6); // アプリの枠の画面（会話モード）に入れる
  await loginAs(page, u.token);
  return { u, sid, row };
}
/** 書いて送る。画面に自分の言葉が出るまで待つ（出た＝サーバーに積まれた。Bridge はその後で取りに行く） */
const say = async (page: Page, text: string) => {
  await page.waitForSelector('[data-part="conversation"]');
  await page.getByRole("textbox", { name: "自分のAIに書く" }).fill(text);
  await page.getByRole("button", { name: "送る" }).click();
  await expect(page.locator('[data-who="me"]').last()).toContainText(text.slice(0, 12));
};
const STOP = "Claude Code が途中で終わりました（本人のサブスクの上限に当たりました）";

test("BRG-03-004 BRG-03-005 言ったことがこの PC の Bridge に渡り、動いていることが画面に出る", async ({ page }) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "会社のことを教えるから聞いて");
  await expect(page.locator('[data-who="me"]')).toContainText("会社のこと");
  const job = await bridgeTake(sid);
  // PC が取ったら作業中の 1 行が出る（送った・届いたの細かい段階は出さない・D-104.8）
  await expect(page.locator("[data-working]")).toBeVisible();
  expect(job.json.data?.prompt, "Bridge が受け取るのは、人が言った言葉そのもの").toBe("会社のことを教えるから聞いて");
  expect((await jobStates(u.memberId)).length).toBe(1);
});

test("BRG-03-006 返事が会話に出て、2 回目からは同じ続き（session）を引き継ぐ", async ({ page }) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "受託開発をしています");
  const j1 = await bridgeTake(sid);
  expect(j1.json.data?.agent_session_id, "1 回目はまだ続きが無い").toBeNull();
  await bridgeFinish(sid, {
    job_id: j1.json.data!.job_id,
    state: "done",
    result: "分かりました。案件はどこから来ますか？",
    agent_session_id: "5f1e2d3c-0000-4000-8000-00000000c001",
  });
  await expect(page.locator('[data-who="ai"]').last()).toContainText("案件はどこから来ますか");
  await say(page, "紹介と発注ナビです");
  const j2 = await bridgeTake(sid);
  expect(j2.json.data?.agent_session_id, "2 回目は同じ続きを引き継ぐ").toBe("5f1e2d3c-0000-4000-8000-00000000c001");
  const convs = await jobStates(u.memberId);
  expect(convs.length).toBe(2);
});

test("BRG-03-007 BRG-03-008 止まったら理由がそのまま会話に出る。ボタンは置かず、入力欄は開いたまま（D-104.15）", async ({
  page,
}) => {
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "請求書を作っておいて");
  const j = await bridgeTake(sid);
  await bridgeFinish(sid, { job_id: j.json.data!.job_id, state: "stopped", reason: STOP });
  await expect(page.locator("[data-stopped-reason]")).toContainText("上限に当たりました");
  await expect(page.locator("[data-choose]"), "選ぶボタンは置かない").toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "自分のAIに書く" })).toBeEnabled();
  await expect(page.locator("[data-working]")).toHaveCount(0); // 止まったものを「動いています」と言わない
});

test("BRG-03-009 BRG-03-012 止まった後に「続けて」と送ると同じ続きで動き、止まった記録は履歴として残る（D-104.15）", async ({
  page,
}) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "追いメールの下書きを作って");
  const j = await bridgeTake(sid);
  await bridgeFinish(sid, {
    job_id: j.json.data!.job_id,
    state: "stopped",
    reason: STOP,
    agent_session_id: "5f1e2d3c-0000-4000-8000-00000000c002",
  });
  await expect(page.locator("[data-stopped-reason]")).toContainText("上限");
  await say(page, "続けて");
  await expect(page.locator("[data-stopped-reason]"), "止まった記録は履歴として残る").toContainText("上限");
  await expect(page.locator("[data-choose]"), "押せないボタンは最初から無い").toHaveCount(0);
  const j2 = await bridgeTake(sid);
  expect(j2.json.data?.agent_session_id, "続けては同じ続きを引き継ぐ").toBe("5f1e2d3c-0000-4000-8000-00000000c002");
  expect((await jobStates(u.memberId)).map((x) => x.state_id)).toEqual(["stopped", "running"]);
});

test("BRG-03-010 最初からやり直すときは「新しく話す」。続き（session）を引き継がない（D-104.15）", async ({ page }) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "見積を作って");
  const j = await bridgeTake(sid);
  await bridgeFinish(sid, {
    job_id: j.json.data!.job_id,
    state: "stopped",
    reason: STOP,
    agent_session_id: "5f1e2d3c-0000-4000-8000-00000000c003",
  });
  await page.locator("[data-new-conversation]").click();
  await expect(page.locator('[data-who="me"]'), "新しい会話は空から").toHaveCount(0);
  await say(page, "見積をもう一度");
  const j2 = await bridgeTake(sid);
  expect(j2.json.data?.agent_session_id, "やり直しは前の続きを持たない").toBeNull();
  expect((await jobStates(u.memberId)).map((x) => x.state_id)).toEqual(["stopped", "running"]);
});

test("BRG-03-011 何も送らなければ止まったまま。勝手に動き出さず、並びも増えない（D-104.15）", async ({ page }) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "とりあえず調べておいて");
  const j = await bridgeTake(sid);
  await bridgeFinish(sid, { job_id: j.json.data!.job_id, state: "stopped", reason: STOP });
  await expect(page.locator("[data-stopped-reason]")).toBeVisible();
  await page.waitForTimeout(3000);
  expect(
    (await jobStates(u.memberId)).map((x) => x.state_id),
    "並びは増えない",
  ).toEqual(["stopped"]);
  expect((await bridgeTake(sid)).json.data, "Bridge に渡る仕事も無い").toBeNull();
});

test("BRG-03-013 BRG-03-015 知らせが来なくなったら会話の画面が「溜めておいて」に変わり、言ったことは溜まる（PC の画面の「切れています」は K230-UI-011・K57-UI-015）", async ({
  page,
}) => {
  const { u, sid, row } = await connected(page);
  await bridgeAsleep(row);
  await page.goto("/ai/chat");
  await expect(page.locator("[data-asleep]")).toContainText("溜めておいて");
  await say(page, "起きたらこれをやって");
  await expect(page.locator('[data-who="me"]')).toContainText("起きたら");
  expect(
    (await jobStates(u.memberId)).map((x) => x.state_id),
    "溜まって待つ",
  ).toEqual(["queued"]);
  await bridgeBeat(sid); // 起きた
  const j = await bridgeTake(sid);
  expect(j.json.data?.prompt, "起きたら溜まった分から動く").toBe("起きたらこれをやって");
});

test("BRG-03-016 「新しい会話」で今の 1 本が閉じ、前のやりとりは消えない", async ({ page }) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "ここまでの話は覚えておいて");
  const j = await bridgeTake(sid);
  await bridgeFinish(sid, { job_id: j.json.data!.job_id, state: "done", result: "覚えました" });
  await expect(page.locator('[data-who="ai"]').last()).toContainText("覚えました");
  await page.locator("[data-new-conversation]").click();
  await expect(page.locator('[data-who="me"]'), "新しい 1 本なので、前のやりとりは出ない").toHaveCount(0);
  const rows = await jobStates(u.memberId);
  expect(rows.length, "前の仕事は消えない").toBe(1);
});

test("BRG-03-017 つないでいない人が言おうとしたら、理由を返して受け付けない", async ({ page }) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.goto("/ai/chat");
  await expect(page.locator('[data-requires="nobridge"]')).toContainText("つながっていません");
  expect((await jobStates(u.memberId)).length, "仕事は並ばない").toBe(0);
});

test("BRG-03-018 別の端末の鍵では、その人の仕事は取れない（自分の分だけ）", async ({ page }) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "私の分の仕事");
  const other = await signupViaApi("別の会社");
  const otherSid = await claimBridge(other.token, "他人の PC");
  const stolen = await bridgeTake(otherSid);
  expect(stolen.json.data, "他人の鍵では取れない").toBeNull();
  const mine = await bridgeTake(sid);
  expect(mine.json.data?.prompt).toBe("私の分の仕事");
  expect((await jobStates(u.memberId)).length).toBe(1);
});

// ---- エラー一覧の行（E-…-A 出る／B 出ない／C 文言と一手）。出せないエラーはデッドコード（G-08）
const INTERNAL = /D-\d{3}|bridge_jobs|session|job_id|queued|stopped|RLS|409|null/;

test("E-CONN-002-A E-CONN-002-B E-CONN-002-C PC が閉じている間の指示：出る・起きていれば出ない・文言と一手", async ({
  page,
}) => {
  const { row } = await connected(page);
  await page.goto("/ai/chat");
  await expect(page.locator("[data-asleep]"), "B 起きているときは出さない（誤検知なし）").toHaveCount(0);
  await bridgeAsleep(row);
  await page.reload();
  const bar = page.locator("[data-asleep]");
  await expect(bar, "A 出る").toBeVisible();
  const text = (await bar.innerText()).replace(/\s+/g, "");
  expect(text, "C 文言：何が起きたか・このあとどうなるか").toContain("いまは動けません");
  expect(text).toContain("溜めておいて");
  expect(INTERNAL.test(text), `C 内部語が混ざっている: ${text}`).toBe(false);
  await page.getByRole("link", { name: "PC の状態を見る" }).click(); // C 一手を押すと回復の道に出る
  await expect(page).toHaveURL(/\/setup\/bridge$/);
  // 行き先は K-57 の「PC をつなぐ」の画面。眠っている PC は「切れています」と起こすボタン（E-CONN-001）
  await expect(page.getByRole("region", { name: "切れています" })).toBeVisible({ timeout: 15_000 });
});

test("E-SIG-002-A E-SIG-002-B E-SIG-002-C 合図を出さずに終わった：出る・最後まで返れば出ない・文言と一手", async ({
  page,
}) => {
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "今月の数字をまとめて");
  const j1 = await bridgeTake(sid);
  await bridgeFinish(sid, { job_id: j1.json.data!.job_id, state: "done", result: "まとめました" });
  await expect(page.locator('[data-part="stopped"]'), "B 最後まで返れば出ない").toHaveCount(0);
  await say(page, "もう一度まとめて");
  const j2 = await bridgeTake(sid);
  await bridgeFinish(sid, {
    job_id: j2.json.data!.job_id,
    state: "stopped",
    reason: "Claude Code が何も返さずに終わりました",
  });
  const card = page.locator('[data-part="stopped"]');
  await expect(card, "A 出る").toBeVisible();
  const text = (await card.innerText()).replace(/\s+/g, "");
  expect(text).toContain("ここで止まりました");
  expect(text).toContain("何も返さずに終わりました");
  expect(INTERNAL.test(text.replace("ここで止まりました", "")), `C 内部語が混ざっている: ${text}`).toBe(false);
  // C 一手＝「続けて」と送る（D-104.15）。入力欄は開いたまま
  await expect(page.getByRole("textbox", { name: "自分のAIに書く" })).toBeEnabled();
  await say(page, "続けて");
});

// ---- 1 行 1 イベント（D-093）：途中経過・確認・会話の id・完了の判定。Bridge の役は本物の口を叩いて演じる
test("BRG-03-027 動いている間、何をしているかが会話に出る（無言で待たせない）", async ({ page }) => {
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "請求書を作っておいて");
  const j = await bridgeTake(sid);
  await bridgeProgress(sid, {
    job_id: j.json.data!.job_id,
    seq: 1,
    kind: "progress",
    text: "「Read」を使っています：台帳/請求.csv",
  });
  await bridgeProgress(sid, {
    job_id: j.json.data!.job_id,
    seq: 2,
    kind: "progress",
    text: "請求書の下書きを作っています",
  });
  // 作業中は吹き出しの外に「いま何をしているか」の 1 行（D-104.8 で数行の経過を 1 行と道具の行に改めた）
  await expect(page.locator("[data-working] .ws")).toHaveText("請求書の下書きを作っています…");
  await bridgeProgress(sid, {
    job_id: j.json.data!.job_id,
    seq: 3,
    kind: "status",
    text: "読んでいます：台帳/請求.csv",
  });
  await expect(page.locator("[data-working] .ws")).toHaveText("読んでいます：台帳/請求.csv");
});

test("BRG-03-028 SCR-CLONE-CHAT-119 BRG-03-029 確認カードが出て、「許可する」で Bridge に allow が渡り、記録と証跡が残る", async ({
  page,
}) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "請求書を送っておいて");
  const j = await bridgeTake(sid);
  const job = j.json.data!.job_id;
  await bridgeAsk(sid, {
    job_id: job,
    request_id: "req-1",
    tool: "Bash",
    input: { command: "freee-cli invoice send --id 42" },
    summary: "Bash: freee-cli invoice send --id 42",
  });
  const card = page.locator('[data-part="ask"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("freee-cli invoice send");
  expect(
    (await bridgeAnswer(sid, { job_id: job, request_id: "req-1" })).json.data.answer,
    "答える前は null（勝手に許可しない）",
  ).toBeNull();
  await page.locator('[data-answer="allow"]').click();
  await expect
    .poll(async () => (await bridgeAnswer(sid, { job_id: job, request_id: "req-1" })).json.data.answer)
    .toBe("allow");
  await expect(page.locator('[data-who="note"]').last()).toContainText("許可しました");
  await expect(card, "答えたら確認カードは消える").toHaveCount(0);
  const audit = await toolAudit(job);
  expect(audit.map((a) => a.action)).toEqual(["bridge.tool_allowed"]);
  expect(audit[0]!.actor_member_id, "誰が許可したかが証跡に残る").toBe(u.memberId);
});

test("BRG-03-030 SCR-CLONE-CHAT-120 「許可しない」で Bridge に deny が渡り、勝手に許可しない", async ({ page }) => {
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "古いファイルを消して");
  const j = await bridgeTake(sid);
  const job = j.json.data!.job_id;
  await bridgeAsk(sid, {
    job_id: job,
    request_id: "req-2",
    tool: "Bash",
    input: { command: "rm -rf build" },
    summary: "Bash: rm -rf build",
  });
  await page.locator('[data-answer="deny"]').click();
  await expect
    .poll(async () => (await bridgeAnswer(sid, { job_id: job, request_id: "req-2" })).json.data.answer)
    .toBe("deny");
  await expect(page.locator('[data-who="note"]').last()).toContainText("許可しませんでした");
  expect((await toolAudit(job)).map((a) => a.action)).toEqual(["bridge.tool_denied"]);
});

test("BRG-03-031 init で会話の id を先に覚えるので、途中で落ちても「続けて」で同じ続きを引き継ぐ", async ({ page }) => {
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "見積を作って");
  const j = await bridgeTake(sid);
  await bridgeProgress(sid, {
    job_id: j.json.data!.job_id,
    seq: 1,
    kind: "init",
    agent_session_id: "5f1e2d3c-0000-4000-8000-00000000c004",
  });
  // 落ちた：result も session も無いまま止まる
  await bridgeFinish(sid, {
    job_id: j.json.data!.job_id,
    state: "stopped",
    reason: "Claude Code が途中で終わりました（終了コード 137）",
  });
  await say(page, "続けて");
  const j2 = await bridgeTake(sid);
  expect(j2.json.data?.agent_session_id, "init で覚えた id を「続けて」が引き継ぐ").toBe(
    "5f1e2d3c-0000-4000-8000-00000000c004",
  );
});

test("BRG-03-032 result の is_error は失敗。終了コード 0 でも「終わった」にならず理由が出る", async ({ page }) => {
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "今日の予定を教えて");
  const j = await bridgeTake(sid);
  // Bridge は result.is_error を読んで理由に言い換える（stream.test.ts）。画面はその理由をそのまま出す
  await bridgeFinish(sid, {
    job_id: j.json.data!.job_id,
    state: "stopped",
    reason: "Claude Code にログインできていません。Bridge の「ログインする」を押して、ブラウザで 1 回許可してください",
  });
  await expect(page.locator("[data-stopped-reason]")).toContainText("ログインできていません");
  await expect(page.locator('[data-who="ai"]'), "失敗を返事として出さない").toHaveCount(0);
});
