// T-U-07 自分のAIと話す。テストの名前に正本の行 ID を持つ（op_gate.py）。自分のAIの返答は Bridge 経由（T-I-01）。ここでは Bridge の有無で変わる状態と、人が押せるものを押す
import { expect, test } from "@playwright/test";
import { agentNewConversation, bridgeRow, loginAs, noOverflow, setupStep, signupViaApi } from "../_lib/api";
import { bridgeFinish, bridgeTake, claimBridge } from "../_lib/api";

test("SCR-ONBOARD-INTERVIEW-001 SCR-ONBOARD-INTERVIEW-013 SCR-ONBOARD-INTERVIEW-014 SCR-ONBOARD-INTERVIEW-033 SCR-ONBOARD-INTERVIEW-008 Bridge 未接続：4 幅で横溢れ 0・時点の部品（AI）が無い・「PCをつなぐ」→ /setup/bridge", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/onboard/interview");
  await expect(page.locator("[data-state='nb']")).toContainText("先に自分のPCをつないでください", { timeout: 15_000 });
  await expect(page.locator("[data-requires~='ai']")).toHaveCount(0);
  await page.locator("[data-state='nb']").getByRole("link", { name: "PCをつなぐ" }).click();
  await expect(page).toHaveURL(/\/setup\/bridge/);
});
test("SCR-ONBOARD-INTERVIEW-003 SCR-ONBOARD-INTERVIEW-049 SCR-ONBOARD-INTERVIEW-050 SCR-ONBOARD-INTERVIEW-051 SCR-ONBOARD-INTERVIEW-052 SCR-ONBOARD-INTERVIEW-074 最初：つながると自分のAI の最初の吹き出しに質問と選択肢 4 つ＋その他（自分で書く）。選ぶと答えとして会話に積まれる（分かったことには自分のAI が覚えた事実だけ・D-114）。自分で書くは入力欄へ", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await page.goto("/onboard/interview");
  await expect(page.locator("[data-state='0']")).toBeVisible({ timeout: 15_000 });
  // モックどおり：最初の問いは自分のAI の吹き出し（名前・アイコン）で、選択肢はその中
  const first = page.locator("[data-opening]");
  await expect(first.locator(".who")).toHaveText("自分のAI");
  await expect(first.locator(".bub b")).toHaveText("あなたが欄を埋めることはありません。");
  const opts = first.getByRole("group", { name: "答えの候補" });
  for (const n of ["受託・制作", "店舗・サービス業", "EC・物販", "その他", "その他（自分で書く）"]) {
    await expect(opts.getByRole("button", { name: n, exact: true })).toBeVisible();
  }
  const av = await first.locator(".av").boundingBox();
  expect(Math.round(av!.width), "アイコンが潰れない").toBe(Math.round(av!.height));
  // 自分で書く：何も送らず入力欄へ
  await opts.getByRole("button", { name: "その他（自分で書く）" }).click();
  await expect(page.getByRole("textbox", { name: "自分のAIに書く" })).toBeFocused();
  // はじめの設定の聞き取りは会社のことを覚える場なので「記憶に使わない」は出さない（2026-09-30）
  await expect(page.locator('[data-part="composer"] [data-incognito]')).toHaveCount(0);
  await expect(page.locator("[data-who='me']")).toHaveCount(0);
  await opts.getByRole("button", { name: "受託・制作", exact: true }).click();
  await expect(page.locator("[data-state='n']")).toContainText("受託・制作");
  // 分かったことには、送った答えを並べない（自分のAI が覚えた事実だけ・D-114）
  await expect(page.locator("[data-chat-side]")).not.toContainText("受託・制作");
  // 会話は 1 本で続くので、答えた後は最初の質問の選択肢を出さない（D-062）。
  // 残りの選択肢を押すには「新しい会話」で 1 本を閉じる（人が押すのと同じ口）
  for (const n of ["店舗・サービス業", "EC・物販", "その他"]) {
    await agentNewConversation(u.token);
    await page.goto("/onboard/interview");
    await page.locator("[data-opening]").getByRole("button", { name: n, exact: true }).click();
    await expect(page.locator("[data-state='n']")).toContainText(n);
  }
});
test("SCR-ONBOARD-INTERVIEW-081 手順バー：済んだ段と今の段だけ押せる。まだ届かない段は押せない形で出る（押しても戻されるだけ、を作らない）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await setupStep(u.memberId, 1); // 段 1 が済み・段 2（話す）が今
  await page.goto("/onboard/interview");
  const bar = page.getByRole("list", { name: "手順" });
  await expect(bar.getByRole("link", { name: "（済）1. PCをつなぐ" })).toBeVisible({ timeout: 15_000 });
  await expect(bar.getByRole("link", { name: "2. 話す" })).toHaveAttribute("aria-current", "step");
  for (const s of ["3. たたき台", "4. ログイン情報", "5. テスト", "6. 本番へ"]) {
    await expect(bar.getByRole("link", { name: s })).toHaveCount(0);
    // まだ開けない段はリンクではなく、押すと理由が出るボタン（D-116）
    await expect(bar.getByText(s)).toHaveAttribute("data-step-locked");
    await expect(bar.getByText(s)).toHaveAttribute("aria-label", `${s}（まだ開けません。押すと理由が出ます）`);
  }
  await bar.getByText("4. ログイン情報").click();
  await expect(page, "押しても移らない（理由が出るだけ）").toHaveURL(/\/onboard\/interview$/);
  await expect(page.locator("[data-step-note]")).toContainText(
    "「4. ログイン情報」は、いまの段「2. 話す」で自分のAI に 1 つ答えると開きます",
  );
  // 次の段まで進むと押せるようになる
  await setupStep(u.memberId, 2);
  await page.reload();
  await expect(bar.getByRole("link", { name: "3. たたき台" })).toBeVisible({ timeout: 15_000 });
  await expect(bar.getByText("4. ログイン情報")).toHaveAttribute("data-step-locked");
});
test("SCR-ONBOARD-INTERVIEW-064 SCR-ONBOARD-INTERVIEW-065 SCR-ONBOARD-INTERVIEW-047 SCR-ONBOARD-INTERVIEW-048 SCR-ONBOARD-INTERVIEW-015 SCR-ONBOARD-INTERVIEW-016 SCR-ONBOARD-INTERVIEW-017 SCR-ONBOARD-INTERVIEW-018 SCR-ONBOARD-INTERVIEW-019 自由に書いて送る：全角・空白・記号・NFD・大文字は書いたまま積まれる（会話の文は正規化しない＝人の言葉）。空は送らない", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await page.goto("/onboard/interview");
  const box = page.getByRole("textbox", { name: "自分のAIに書く" });
  await expect(box).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "送る" }), "空は送れない（押せない）").toBeDisabled();
  await expect(page.locator("[data-state='0']")).toBeVisible(); // 空は積まれない
  const text = "ＥＣ‐物販　と ガ゙ー DE Support".normalize("NFD");
  await box.fill(text);
  await page.getByRole("button", { name: "送る" }).click();
  await expect(page.locator("[data-state='n'] [data-who='me']").last()).toContainText("ＥＣ‐物販");
  await expect(page.locator("[data-state='n'] [data-who='me']").last()).toContainText("DE Support");
  // 分かったことには、書いた文をそのまま並べない（自分のAI が覚えた事実だけ・D-114）
  await expect(page.locator("[data-chat-side]")).not.toContainText("DE Support");
});
test("SCR-ONBOARD-INTERVIEW-009 SCR-ONBOARD-INTERVIEW-010 SCR-ONBOARD-INTERVIEW-027 SCR-ONBOARD-INTERVIEW-028 SCR-ONBOARD-INTERVIEW-029 SCR-ONBOARD-INTERVIEW-030 SCR-ONBOARD-INTERVIEW-055 SCR-ONBOARD-INTERVIEW-056 SCR-ONBOARD-INTERVIEW-057 SCR-ONBOARD-INTERVIEW-058 手順バーの 1〜4 → それぞれの画面が開く", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 3); // 段 4（ログイン情報）が今の段＝開ける（D-089）
  await loginAs(page, u.token);
  for (const [label, href] of [
    [/PCをつなぐ$/, "/setup/bridge"],
    [/話す$/, "/onboard/interview"],
    [/たたき台$/, "/onboard/draft"],
    [/ログイン情報$/, "/settings/credentials"],
  ] as const) {
    await page.goto("/onboard/interview");
    await page.getByRole("list", { name: "手順" }).getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/") + "$"));
  }
});

// 止まりました（D-090）：聞き取りの画面も会話モードと同じ部品（AgentChat・D-103）。止まった理由が出て、選ぶまで入力できない。
// 続きから／最初からやり直す／やめる を 1 つずつ押して、仕事の並びが変わることまで見る
test("SCR-ONBOARD-INTERVIEW-054 止まりました：理由だけが出て、ボタンは置かず入力欄は開いたまま。「続けて」と送ると同じ続きで動く（D-104.15）", async ({
  page,
}) => {
  const u = await signupViaApi();
  const sid = await claimBridge(u.token);
  await setupStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.goto("/onboard/interview");
  const box = page.getByRole("textbox", { name: "自分のAIに書く" });
  const takeNext = async () => {
    let job: { job_id: string; agent_session_id: string | null } | null = null;
    await expect
      .poll(async () => ((job = (await bridgeTake(sid)).json.data), job !== null), { timeout: 15_000 })
      .toBe(true);
    return job!;
  };
  await expect(box).toBeVisible({ timeout: 15_000 });
  await box.fill("うちは受託の会社です");
  await page.getByRole("button", { name: "送る" }).click();
  const first = await takeNext();
  await bridgeFinish(sid, {
    job_id: first.job_id,
    state: "stopped",
    reason: "本人のサブスクの上限に当たりました",
    agent_session_id: "5f1e2d3c-0000-4000-8000-00000000d001",
  });
  await expect(page.locator("[data-state='stp']")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-stopped-reason]")).toContainText("本人のサブスクの上限に当たりました");
  await expect(page.locator("[data-choose]"), "選ぶボタンは置かない").toHaveCount(0);
  await expect(box, "入力欄は開いたまま").toBeEnabled();
  await box.fill("続けて");
  await page.getByRole("button", { name: "送る" }).click();
  const second = await takeNext();
  expect(second.agent_session_id, "続けては同じ続き（session）で動く").toBe("5f1e2d3c-0000-4000-8000-00000000d001");
});
