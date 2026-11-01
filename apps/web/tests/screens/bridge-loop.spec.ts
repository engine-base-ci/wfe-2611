// 受け取って返す（D-090・T-B-03）を画面から押して確かめる。テストの名前に正本の行 ID を持つ（op_gate.py）。
// Bridge の役は、本物の口（x-bridge-session）を叩いて演じる。画面から見える振る舞いは実物と同じ。
// 止まったものは自動で再開しない。止まったら理由だけを出し、次に送る文で決まる（D-104.15 で D-090.5 を改めた）。
import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { API, admin, bridgeAnswer, bridgeAsk, bridgeAsleep, bridgeBeat, bridgeFinish, bridgeProgress, bridgeTake, claimBridge, jobStates, loginAs, hideRealBridge, setupStep, signupViaApi, toolAudit } from "../_lib/api";

// 偽の Bridge で演じるので、この PC の本物は止めておく（港と「入っている」判定がぶつかる）
// 「起こす」を試すと kaname-bridge:// で本物が立ち上がる。次のテストに持ち越さない（G-10）
// 本物の Bridge は止めない（本人の仕事が死ぬ）。画面からだけ見えなくする
test.beforeEach(({ page }) => hideRealBridge(page));

/** 「この PC に Bridge が入っていない人」を演じるテストは、本当に入っている PC では作れない。
 *  起こす（kaname-bridge://）を押すと本物が立ち上がってしまうため。黙って通さず、理由つきで止める */
const BRIDGE_APP = "/Applications/Kaname Bridge.app";
/** 「まだ配布していない」を演じるテストは、配布物を置いてある環境では作れない（BRIDGE_RELEASE_DIR に .dmg がある）。黙って通さず理由つきで止める */
const needsNoRelease = async (): Promise<void> => {
  let served = false;
  try {
    const r = await fetch(`${API}/api/auth-ext/bridge/download?os=mac`, { redirect: "manual" });
    served = r.status !== 404;
  } catch {
    served = false;
  }
  test.skip(served, "この環境には配布物が置いてあるので「まだ配布していない」を作れない（BLOCKED：BRIDGE_RELEASE_DIR を外した環境か staging で流す）");
};

const needsNoBridge = (): void => {
  test.skip(
    existsSync(BRIDGE_APP),
    "この PC には Bridge が入っているので「入っていない人」を作れない（BLOCKED：入っていない PC か staging で流す）",
  );
};


/** はじめの設定を通した人が、この PC をつないだ状態で会話モードを開く */
async function connected(page: Page) {
  const u = await signupViaApi();
  const sid = await claimBridge(u.token);
  await setupStep(u.memberId, 6); // アプリの枠の画面（会話モード）に入れる
  await loginAs(page, u.token);
  return { u, sid };
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
    agent_session_id: "qa-session-0001",
  });
  await expect(page.locator('[data-who="ai"]').last()).toContainText("案件はどこから来ますか");
  await say(page, "紹介と発注ナビです");
  const j2 = await bridgeTake(sid);
  expect(j2.json.data?.agent_session_id, "2 回目は同じ続きを引き継ぐ").toBe("qa-session-0001");
  const convs = await jobStates(u.memberId);
  expect(convs.length).toBe(2);
});

test("BRG-03-007 BRG-03-008 止まったら理由がそのまま会話に出る。ボタンは置かず、入力欄は開いたまま（D-104.15）", async ({ page }) => {
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

test("BRG-03-009 BRG-03-012 止まった後に「続けて」と送ると同じ続きで動き、止まった記録は履歴として残る（D-104.15）", async ({ page }) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "追いメールの下書きを作って");
  const j = await bridgeTake(sid);
  await bridgeFinish(sid, { job_id: j.json.data!.job_id, state: "stopped", reason: STOP, agent_session_id: "qa-session-0002" });
  await expect(page.locator("[data-stopped-reason]")).toContainText("上限");
  await say(page, "続けて");
  await expect(page.locator("[data-stopped-reason]"), "止まった記録は履歴として残る").toContainText("上限");
  await expect(page.locator("[data-choose]"), "押せないボタンは最初から無い").toHaveCount(0);
  const j2 = await bridgeTake(sid);
  expect(j2.json.data?.agent_session_id, "続けては同じ続きを引き継ぐ").toBe("qa-session-0002");
  expect((await jobStates(u.memberId)).map((x) => x.state_id)).toEqual(["stopped", "running"]);
});

test("BRG-03-010 最初からやり直すときは「新しく話す」。続き（session）を引き継がない（D-104.15）", async ({ page }) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "見積を作って");
  const j = await bridgeTake(sid);
  await bridgeFinish(sid, { job_id: j.json.data!.job_id, state: "stopped", reason: STOP, agent_session_id: "qa-session-0003" });
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
  expect((await jobStates(u.memberId)).map((x) => x.state_id), "並びは増えない").toEqual(["stopped"]);
  expect((await bridgeTake(sid)).json.data, "Bridge に渡る仕事も無い").toBeNull();
});

test("BRG-03-013 BRG-03-015 知らせが来なくなったら「切れています」に変わり、言ったことは溜まる", async ({ page }) => {
  const { u, sid } = await connected(page);
  await bridgeAsleep(sid);
  await page.goto("/setup/bridge");
  await expect(page.locator("[data-disconnected]")).toContainText("いまは仕事を渡せません");
  await expect(page.locator("[data-connected]"), "つないだ記録があっても接続中と出し続けない").toHaveCount(0);
  await page.goto("/ai/chat");
  await expect(page.locator("[data-asleep]")).toContainText("溜めておいて");
  await say(page, "起きたらこれをやって");
  await expect(page.locator('[data-who="me"]')).toContainText("起きたら");
  expect((await jobStates(u.memberId)).map((x) => x.state_id), "溜まって待つ").toEqual(["queued"]);
  await bridgeBeat(sid); // 起きた
  const j = await bridgeTake(sid);
  expect(j.json.data?.prompt, "起きたら溜まった分から動く").toBe("起きたらこれをやって");
});

test("BRG-03-019 BRG-03-023 切れている間：経過は人の言葉で出し、やることを 1 つだけ出す（次の段へ逃がさない）", async ({
  page,
}) => {
  const { sid } = await connected(page);
  await admin("update sessions set last_seen_at = now() - interval '25 hours' where id = $1", [sid]);
  await page.goto("/setup/bridge");
  const box = page.locator('[data-state="slp"]');
  await expect(box).toContainText("昨日", { timeout: 15_000 }); // 87853 秒 のような機械の数字を見せない
  await expect(box, "秒でそのまま出さない").not.toContainText(/\d{4,} 秒/);
  await expect(page.locator("[data-wake]"), "やることは ボタン 1 つで起こす").toBeVisible();
  await expect(box, "つないだ端末の名前を言う").toContainText("MacBook Pro（QA）");
  // 本文の中に「次の段へ行く道」を置かない（上の手順バーは進み具合の表示なので別）
  await expect(
    box.getByRole("link", { name: /話す|書いておく/ }),
    "段 1 を通していない人を次の段へ逃がさない",
  ).toHaveCount(0);
});

test("BRG-03-026 「接続を確かめる」は、この PC の Bridge を見に行って、見つからなければそう言う", async ({
  page,
}) => {
  const { sid } = await connected(page);
  await bridgeAsleep(sid);
  await page.goto("/setup/bridge");
  await expect(page.locator('[data-state="slp"]')).toBeVisible({ timeout: 15_000 });
  const watching = page.locator("[data-watching]");
  await expect(watching, "見ていることを言う").toContainText("見つかりません");
  const before = await watching.innerText();
  await page.getByRole("button", { name: /接続を確かめる|確かめています/ }).click();
  // 押した結果が変わる（時刻が進む）＝押しても何も起きない、にならない
  await expect
    .poll(async () => (await watching.innerText()) !== before, { timeout: 15_000 })
    .toBe(true);
});

test("BRG-03-014 起きたら渡せる状態に戻り、Bridge が返した自己診断がそのまま出る", async ({ page }) => {
  needsNoBridge();
  const { sid } = await connected(page);
  await bridgeAsleep(sid);
  await bridgeBeat(sid, [
    { name: "本人のサブスクの Claude Code がある", ok: true, detail: "/opt/homebrew/bin/claude" },
    { name: "Chrome がある（本人のログイン済みプロファイルを使う）", ok: false, detail: "見つかりません" },
  ]);
  await page.goto("/setup/bridge");
  await expect(page.locator("[data-connected]")).toContainText("いま仕事を渡せます");
  await expect(page.locator('[data-check="ok"]')).toHaveCount(1);
  await expect(page.locator('[data-check="ng"]'), "できない項目を隠さない").toHaveCount(1);
  await expect(page.locator('[data-check="ng"]')).toContainText("見つかりません");
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
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await expect(page.locator("[data-asleep]"), "B 起きているときは出さない（誤検知なし）").toHaveCount(0);
  await bridgeAsleep(sid);
  await page.reload();
  const bar = page.locator("[data-asleep]");
  await expect(bar, "A 出る").toBeVisible();
  const text = (await bar.innerText()).replace(/\s+/g, "");
  expect(text, "C 文言：何が起きたか・このあとどうなるか").toContain("いまは動けません");
  expect(text).toContain("溜めておいて");
  expect(INTERNAL.test(text), `C 内部語が混ざっている: ${text}`).toBe(false);
  await page.getByRole("link", { name: "PC の状態を見る" }).click(); // C 一手を押すと回復の道に出る
  await expect(page).toHaveURL(/\/setup\/bridge$/);
  await expect(page.locator("[data-disconnected]")).toBeVisible();
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

test("BRG-03-021 確かめ終わる前に手順やダウンロードを出さない（一瞬出てから入れ替わるのを作らない）", async ({
  page,
}) => {
  needsNoBridge();
  const { sid } = await connected(page);
  await bridgeAsleep(sid);
  // 開いた瞬間から 2 秒、出ている中身を 50ms ごとに記録する
  await page.addInitScript(() => {
    (window as unknown as { __seen: string[] }).__seen = [];
    const id = setInterval(() => {
      const el = document.querySelector("[data-state]");
      const t = document.body?.innerText ?? "";
      (window as unknown as { __seen: string[] }).__seen.push(
        `${el?.getAttribute("data-state") ?? "-"}|${t.includes("接続コード") ? "手順" : ""}`,
      );
    }, 50);
    setTimeout(() => clearInterval(id), 2500);
  });
  await page.goto("/setup/bridge");
  await expect(page.locator('[data-state="slp"]')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  const seen = (await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen)) as string[];
  const states = [...new Set(seen.map((x) => x.split("|")[0]!))].filter((x) => x !== "-");
  // 出てよいのは「確かめています」と、その次の 1 回だけ。手順（n）を挟まない
  expect(states.filter((x) => x !== "loading" && x !== "slp"), `出た状態の並び: ${states.join(" → ")}`).toEqual([]);
  expect(states[0], "まず確かめる").toBe("loading");
  expect(seen.filter((x) => x.endsWith("|手順")).length, "切れている人に接続コードを一瞬でも出さない").toBe(0);
});

test("BRG-03-022 「まだ配布していません」の置き場は、押したら理由といまできることを言う", async ({ page }) => {
  await needsNoRelease();
  const u = await signupViaApi();
  await setupStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.goto("/setup/bridge");
  const card = page.locator("[data-download]").first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  const msg = page.locator("[data-download-msg]");
  await expect(msg, "押しても何も起きない的を置かない").toBeVisible();
  await expect(msg).toContainText("まだ配布していません");
  await expect(msg).toContainText("署名と置き場");
  await expect(msg, "人にコマンドを打たせない").not.toContainText("pnpm");
});

// 配布（T-B-06）：置き場は Kaname のサーバー。顧客は 3 手だけ
test("BRG-06-005 配布物を置いていないときは、押すと理由が出る（コマンドは出さない）", async ({ page }) => {
  await needsNoRelease();
  const u = await signupViaApi();
  await setupStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.goto("/setup/bridge");
  await page.locator('[data-download="mac"]').click();
  const msg = page.locator("[data-download-msg]");
  await expect(msg).toContainText("まだ配布していません", { timeout: 15_000 });
  await expect(msg, "人にコマンドを打たせない").not.toContainText("pnpm");
});

test("BRG-06-008 署名が済むまでは、OS に止められたときの越え方だけを出す（Mac は「このまま開く」・Windows は「詳細情報」→「実行」。右クリックは案内しない・コマンドは出さない）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.goto("/setup/bridge");
  const w = page.locator("details[data-os-warning]");
  await expect(w).toBeVisible({ timeout: 15_000 });
  await expect(w.locator('[data-os-warning="mac"]'), "閉じている間は中身を出さない").toBeHidden();
  await w.locator("summary").click();
  const mac = w.locator('[data-os-warning="mac"]');
  await expect(mac).toBeVisible();
  await expect(mac).toContainText("完了");
  await expect(mac).toContainText("プライバシーとセキュリティ");
  await expect(mac).toContainText("このまま開く");
  await expect(w.locator('[data-os-warning="win"]')).toContainText("詳細情報");
  await expect(w.locator('[data-os-warning="win"]')).toContainText("実行");
  const text = await w.innerText();
  expect(text, "いまの macOS では効かない越え方を案内しない").not.toContain("右クリック");
  expect(text, "人にコマンドを打たせない").not.toMatch(/xattr|sudo|terminal|ターミナル/i);
});

test("BRG-06-006 顧客の手順は 3 つだけ（受け取る・開く・初回だけ許可）。接続コードもコマンドも打たせない", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.goto("/setup/bridge");
  const lead = page.locator("[data-install-lead]");
  await expect(lead).toBeVisible({ timeout: 15_000 });
  await expect(lead.locator("li"), "手順は 3 つ").toHaveCount(3);
  await expect(lead).toContainText("受け取る");
  await expect(lead).toContainText("開く");
  await expect(lead).toContainText("許可");
  const body = (await page.locator("main").innerText()).replace(/\s+/g, "");
  expect(body.includes("pnpm"), "画面にコマンドを出さない").toBe(false);
  await expect(page.locator("[data-pair-code]"), "接続コードは畳んである（打たせない）").toBeHidden();
});

test("BRG-06-004 ダウンロードは Kaname の口を通る（外のサービスへ飛ばさない）", async ({ page, request }) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.goto("/setup/bridge");
  const hits: string[] = [];
  page.on("request", (r) => hits.push(r.url()));
  await page.locator('[data-download="win"]').click();
  await expect(page.locator("[data-download-msg]")).toBeVisible({ timeout: 15_000 });
  expect(hits.some((h) => /\/api\/auth-ext\/bridge\/download\?os=win/.test(h)), "Kaname の口を叩く").toBe(true);
  expect(hits.some((h) => /github\.com|githubusercontent/.test(h)), "外のサービスへは行かない").toBe(false);
  const r = await request.get(`${API}/api/auth-ext/bridge/download?os=win`);
  expect([302, 404]).toContain(r.status()); // 置いてあれば実物へ、無ければ理由
});

test("BRG-06-010 止まっているときは、ボタン 1 つで起こす（人に探させない）", async ({ page }) => {
  needsNoBridge();
  const { sid } = await connected(page);
  await bridgeAsleep(sid);
  await page.goto("/setup/bridge");
  const box = page.locator('[data-state="slp"]');
  await expect(box).toBeVisible({ timeout: 15_000 });
  await expect(box, "Launchpad から探せ、と言わない").not.toContainText("Launchpad");
  // 押すと この PC の Bridge を起こす合図（kaname-bridge://）を出す
  const asked: string[] = [];
  await page.route("kaname-bridge://**", (r) => {
    asked.push(r.request().url());
    void r.abort();
  });
  await page.locator("[data-wake]").click();
  await expect(page.locator("[data-wake-msg]"), "出てこないときは理由を言う").toContainText("入っていないかも");
  await expect(box).toContainText("PC を立ち上げると Bridge も一緒に立ち上がる");
});

// ---- 1 行 1 イベント（D-093）：途中経過・確認・会話の id・完了の判定。Bridge の役は本物の口を叩いて演じる
test("BRG-03-027 動いている間、何をしているかが会話に出る（無言で待たせない）", async ({ page }) => {
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "請求書を作っておいて");
  const j = await bridgeTake(sid);
  await bridgeProgress(sid, { job_id: j.json.data!.job_id, seq: 1, kind: "progress", text: "「Read」を使っています：台帳/請求.csv" });
  await bridgeProgress(sid, { job_id: j.json.data!.job_id, seq: 2, kind: "progress", text: "請求書の下書きを作っています" });
  // 作業中は吹き出しの外に「いま何をしているか」の 1 行（D-104.8 で数行の経過を 1 行と道具の行に改めた）
  await expect(page.locator("[data-working] .ws")).toHaveText("請求書の下書きを作っています…");
  await bridgeProgress(sid, { job_id: j.json.data!.job_id, seq: 3, kind: "status", text: "読んでいます：台帳/請求.csv" });
  await expect(page.locator("[data-working] .ws")).toHaveText("読んでいます：台帳/請求.csv");
});

test("BRG-03-028 SCR-CLONE-CHAT-119 BRG-03-029 確認カードが出て、「許可する」で Bridge に allow が渡り、記録と証跡が残る", async ({ page }) => {
  const { u, sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "請求書を送っておいて");
  const j = await bridgeTake(sid);
  const job = j.json.data!.job_id;
  await bridgeAsk(sid, { job_id: job, request_id: "req-1", tool: "Bash", input: { command: "freee-cli invoice send --id 42" }, summary: "Bash: freee-cli invoice send --id 42" });
  const card = page.locator('[data-part="ask"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("freee-cli invoice send");
  expect((await bridgeAnswer(sid, { job_id: job, request_id: "req-1" })).json.data.answer, "答える前は null（勝手に許可しない）").toBeNull();
  await page.locator('[data-answer="allow"]').click();
  await expect.poll(async () => (await bridgeAnswer(sid, { job_id: job, request_id: "req-1" })).json.data.answer).toBe("allow");
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
  await bridgeAsk(sid, { job_id: job, request_id: "req-2", tool: "Bash", input: { command: "rm -rf build" }, summary: "Bash: rm -rf build" });
  await page.locator('[data-answer="deny"]').click();
  await expect.poll(async () => (await bridgeAnswer(sid, { job_id: job, request_id: "req-2" })).json.data.answer).toBe("deny");
  await expect(page.locator('[data-who="note"]').last()).toContainText("許可しませんでした");
  expect((await toolAudit(job)).map((a) => a.action)).toEqual(["bridge.tool_denied"]);
});

test("BRG-03-031 init で会話の id を先に覚えるので、途中で落ちても「続けて」で同じ続きを引き継ぐ", async ({ page }) => {
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "見積を作って");
  const j = await bridgeTake(sid);
  await bridgeProgress(sid, { job_id: j.json.data!.job_id, seq: 1, kind: "init", agent_session_id: "qa-session-init" });
  // 落ちた：result も session も無いまま止まる
  await bridgeFinish(sid, { job_id: j.json.data!.job_id, state: "stopped", reason: "Claude Code が途中で終わりました（終了コード 137）" });
  await say(page, "続けて");
  const j2 = await bridgeTake(sid);
  expect(j2.json.data?.agent_session_id, "init で覚えた id を「続けて」が引き継ぐ").toBe("qa-session-init");
});

test("BRG-03-032 result の is_error は失敗。終了コード 0 でも「終わった」にならず理由が出る", async ({ page }) => {
  const { sid } = await connected(page);
  await page.goto("/ai/chat");
  await say(page, "今日の予定を教えて");
  const j = await bridgeTake(sid);
  // Bridge は result.is_error を読んで理由に言い換える（stream.test.ts）。画面はその理由をそのまま出す
  await bridgeFinish(sid, { job_id: j.json.data!.job_id, state: "stopped", reason: "Claude Code にログインできていません。Bridge の「ログインする」を押して、ブラウザで 1 回許可してください" });
  await expect(page.locator("[data-stopped-reason]")).toContainText("ログインできていません");
  await expect(page.locator('[data-who="ai"]'), "失敗を返事として出さない").toHaveCount(0);
});
