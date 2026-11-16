// D-128.150：前の「PC をつなぐ」画面（/setup/bridge/legacy）の試験。消さずに残し、K-89・K-90・K-91 がこの画面と試験を使う。接続コードの口は K-57 の契約の口に替えた
// QA 担当 B：「自分のPCをつなぐ」（/setup/bridge・T-U-09）の状態と操作、共通の枠（T-US-01）の上の帯の操作を実ブラウザで確かめる。
// この画面は この PC の Bridge（127.0.0.1:38617 の /ping・/check・/pair・/install-claude・/login-claude・/login-code）にも聞く。
// 本人の本物の Bridge は止めない（hideRealBridge）。この PC の口は page.route で偽の答えを返して状態を作る（試験のブラウザの中だけ）。
// 期待はモック 06_mockup/v1/v1-bridge-setup.html と決定ログ（D-089.8・D-089.10・D-091・D-119・D-120）から書く。テストの名前に正本の行 ID を持つ
import { expect, test, type Page } from "@playwright/test";
import {
  API,
  admin,
  api,
  bridgeBeat,
  bridgeTake,
  claimBridge,
  deviceRowId,
  hideRealBridge,
  loginAs,
  setupStep,
  signupViaApi,
} from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";
import { localBridge } from "../_lib/local-bridge";

const CHROME_CHECK = "AI が Chrome を使える（Claude in Chrome）";

let bridges: AgentBridge[] = [];
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});

/** 押すまで待たせる関門（その間の画面を見るため） */
function gate() {
  let open!: () => void;
  const p = new Promise<void>((ok) => (open = ok));
  return { wait: p, open };
}
/** 本物の Bridge と同じに、画面が渡した接続コードを Kaname の口で引き取る（端末の行ができ、段 1 が通る）。
 *  本物の Bridge は引き取ったらすぐ生きている知らせを送る（K-57：「つながっています」は最初の知らせから・D-090） */
const claimWith = (label: string) => async (code: string) => {
  const c = await api<{ data: { device_token: string } }>("/api/v1/bridge/claim", { code, device_label: label });
  if (c.status !== 201) return false;
  await bridgeBeat(c.json.data.device_token);
  return true;
};
const stepOf = async (memberId: string) =>
  (await admin<{ s: number }>("select setup_step as s from members where id = $1", [memberId]))[0]!.s;
const browserOf = async (memberId: string) =>
  (
    await admin<{ b: string }>(
      "select browser as b from sessions where member_id = $1 and kind_id = 'bridge' and revoked_at is null order by last_seen_at desc limit 1",
      [memberId],
    )
  )[0]?.b;
const steps = (page: Page) => page.getByRole("list", { name: "手順" }).locator("li");

/** つながった人（端末の行・知らせが来ている・この PC の口が答える）。health を渡すと Bridge の自己診断として返す */
async function connected(page: Page, health?: { name: string; ok: boolean; detail?: string }[], step = 1) {
  const u = await signupViaApi();
  const token = await claimBridge(u.token, "MacBook Pro（QA-B つながった）");
  await bridgeBeat(token, health);
  // 画面と DB の行は sessions の id、Bridge の口は PC の印（K-57 で分けた・D-128.137）
  const sid = await deviceRowId(token);
  await setupStep(u.memberId, step);
  await hideRealBridge(page);
  await localBridge(page, { label: "MacBook Pro（QA-B つながった）" });
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/setup/bridge/legacy");
  await expect(page.locator('[data-state="ok"]')).toBeVisible({ timeout: 20_000 });
  return { u, sid, token };
}

test("BRG-02-001 SCR-BRIDGE-SETUP-059 状態「接続中（ブラウザ・未インストール）」：手順バー・見出し・受け取る（macOS／Windows）・開く・許可の 3 つ・何をするか／しないか が出て、接続コードは本物（引き取れる）", async ({
  page,
}) => {
  await hideRealBridge(page); // この PC の口は答えない＝入っていない
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/setup/bridge/legacy");
  await expect(page.locator("h1")).toHaveText("自分のPCをつなぐ");
  await expect(steps(page)).toHaveCount(6);
  await expect(steps(page)).toHaveText([
    "1. PCをつなぐ",
    "2. 話す",
    "3. たたき台",
    "4. ログイン情報",
    "5. テスト",
    "6. 本番へ",
  ]);
  const web = page.locator('[data-where="web"]');
  await expect(web).toBeVisible({ timeout: 20_000 });
  await expect(web).toContainText("この PC に Bridge がまだありません");
  await expect(page.locator('[data-download="mac"]')).toContainText("macOS");
  await expect(page.locator('[data-download="mac"]')).toContainText("Apple Silicon / Intel");
  await expect(page.locator('[data-download="win"]')).toContainText("Windows");
  await expect(page.locator('[data-download="win"]')).toContainText("10 以降");
  await expect(page.locator("[data-install-lead] > li")).toHaveCount(3);
  await expect(page.locator("[data-install-lead]")).toContainText("「許可」を押してください");
  await expect(page.getByRole("heading", { name: "Bridge が何をするか・しないか" })).toBeVisible();
  await expect(page.getByText("銀行をブラウザで触らない")).toBeVisible();
  await expect(page.locator("[data-connect-here]"), "入っていない人に「つなぐ」は出さない").toHaveCount(0);
  // 次へは押せず、何をすれば進めるかが出る
  await expect(page.locator("[data-wiz-next-go]")).toBeDisabled();
  await expect(page.locator("[data-wiz-next-note]")).toHaveText("PC の Bridge がつながると進めます");
  // 接続コード：モックの KNM-4821 の決め打ちではなく、Kaname が発行した本物の番号（K-57 の英数字 6 けた・引き取れる）
  await page.getByText("うまくつながらないとき（接続コードを手で入れる）").click();
  const code = (await page.locator("[data-pair-code]").innerText()).trim();
  expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  const c = await api<{ data: { connected: boolean } }>("/api/v1/bridge/claim", {
    code,
    device_label: "QA-B 確かめ",
  });
  expect(c.status, "画面に出た番号はそのまま引き取れる").toBe(201);
});

test("SCR-BRIDGE-SETUP-060 SCR-BRIDGE-SETUP-096 状態「ブラウザ・Bridge が入っている」：ダウンロードもコードも出さずこの PC の Bridge につなぐ。「接続を確かめる」を押すと見直して結果が出る", async ({
  page,
}) => {
  const u = await signupViaApi();
  const g = gate();
  await hideRealBridge(page);
  const seen = await localBridge(page, {
    label: "MacBook Pro（QA-B 入っている）",
    onPair: async (code) => {
      await g.wait; // つなぎ終わるまでの画面を見る
      return claimWith("MacBook Pro（QA-B 入っている）")(code);
    },
  });
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/setup/bridge/legacy");
  const ins = page.locator('[data-where="installed"]');
  await expect(ins).toBeVisible({ timeout: 20_000 });
  await expect(ins).toContainText("この PC で Bridge が動いています。");
  await expect(ins).toContainText("入れる作業も接続コードの入力も要りません");
  await expect(ins, "端末名は この PC の Bridge が答えた値（決め打ちでない）").toContainText(
    "（MacBook Pro（QA-B 入っている））",
  );
  await expect(page.locator("[data-install-lead]"), "入っている人にダウンロードは出さない").toHaveCount(0);
  await expect(page.locator("[data-pair-code]"), "コードも見せない").toHaveCount(0);
  await expect(page.locator("[data-connect-here]")).toBeVisible();
  await expect.poll(() => seen.codes.length, { timeout: 15_000 }).toBe(1);
  expect(seen.codes[0], "画面が発行した接続コードをそのまま Bridge に渡す").toMatch(
    /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/,
  );
  // 096：つながる前に「接続を確かめる」を押す → この PC を見直し、まだつながっていないと出る
  const recheck = page.getByRole("button", { name: "接続を確かめる" });
  await recheck.click();
  await expect(page.locator('[data-state="ng"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("まだつながっていません。")).toBeVisible();
  // Bridge が引き取り終わる → 押さずに「つながりました」へ。段 1 が記録される（別に DB を読む）
  g.open();
  await expect(page.locator('[data-state="ok"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-connected]")).toHaveText("つながりました。いま仕事を渡せます");
  await expect(page.locator("tr[data-live='1']")).toContainText("MacBook Pro（QA-B 入っている）");
  await expect.poll(() => stepOf(u.memberId), { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  // つながった後にもう一度押しても、記録をもう一度読み直してつながったまま
  await page.reload();
  await expect(page.locator('[data-state="ok"]')).toBeVisible({ timeout: 20_000 });
});

test("BRG-01-001 SCR-BRIDGE-SETUP-061 状態「アプリ（Bridge の窓）の中」：入れる作業も接続コードも出さず、開いた時点で自動でつながり「自分のAIと話すへ」が出る", async ({
  browser,
}) => {
  const u = await signupViaApi();
  const g = gate();
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 KanameBridge/0.0.0-qa" });
  const page = await ctx.newPage();
  try {
    await hideRealBridge(page);
    await localBridge(page, {
      label: "MacBook Pro（QA-B アプリ）",
      onPair: async (code) => {
        await g.wait;
        return claimWith("MacBook Pro（QA-B アプリ）")(code);
      },
    });
    await loginAs(page, u.token);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/setup/bridge/legacy");
    await expect(page.locator("h1")).toHaveText("自分のPCをつなぐ");
    const app = page.locator('[data-where="app"]');
    await expect(app).toBeVisible({ timeout: 20_000 });
    await expect(app).toContainText("Kaname のアプリ（Bridge）の中で開いています。");
    await expect(app).toContainText("入れる作業も接続コードの入力も要りません");
    await expect(page.locator("[data-install-lead]")).toHaveCount(0);
    await expect(page.locator("[data-pair-code]")).toHaveCount(0);
    g.open();
    await expect(page.locator('[data-state="ok"]'), "押さずにつながる").toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: "自分のAIと話すへ" })).toBeVisible();
  } finally {
    g.open();
    await ctx.close();
  }
});

test("BRG-01-002 BRG-02-002 BRG-04-002 SCR-BRIDGE-SETUP-072 SCR-BRIDGE-SETUP-080 SCR-BRIDGE-SETUP-081 状態「Claude Code が無い」：理由と「Claude Code を入れる」が出て、押すと Bridge が入れ、続けて「ログインする」で入口とコード欄が出て、決定で出なくなる", async ({
  page,
}) => {
  const u = await signupViaApi();
  const g = gate();
  await hideRealBridge(page);
  const seen = await localBridge(page, {
    claudeOk: false,
    loggedIn: false,
    onPair: async () => {
      await g.wait; // つなぐのは止めておく（モックの cc は PS0：まだつながっていない）
      return false;
    },
  });
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/setup/bridge/legacy");
  try {
    await expect(page.locator("h1")).toHaveText("自分のPCをつなぐ");
    const box = page.locator("[data-need-claude]");
    await expect(box).toContainText("この PC に Claude Code がありません。", { timeout: 20_000 });
    await expect(box).toContainText("あなたのサブスクの Claude Code");
    await expect(box).toContainText("ターミナルは触りません");
    await expect(page.locator("[data-install-claude]")).toHaveText("Claude Code を入れる");
    await expect(page.locator("[data-login-claude]"), "入れる前はログインを出さない（D-091.5）").toHaveCount(0);
    // 080：押すと Bridge が入れる（画面は頼むだけ）
    await page.locator("[data-install-claude]").click();
    await expect(page.locator("[data-install-msg]")).toContainText("入りました", { timeout: 15_000 });
    expect(seen.install).toBe(1);
    await expect(page.locator("[data-install-claude]"), "入った後は入れるが消える").toHaveCount(0);
    await expect(box).toContainText("Claude Code にまだログインしていません。");
    // 081：ログインする → 入口とコード欄 → 決定で出なくなる
    await page.locator("[data-login-claude]").click();
    const step = page.locator("[data-login-step]");
    await expect(step).toBeVisible({ timeout: 15_000 });
    expect(seen.login).toBe(1);
    await expect(step.getByRole("link", { name: "この入口" })).toHaveAttribute("href", /^https:\/\//);
    await expect(step.getByRole("button", { name: "決定" })).toBeDisabled();
    await step.getByLabel("ブラウザに出たコード").fill("qa-b-code");
    await step.getByRole("button", { name: "決定" }).click();
    await expect(page.locator("[data-install-msg]")).toContainText("ログインできました", { timeout: 15_000 });
    expect(seen.loginCode, "貼ったコードをそのまま Bridge に渡す").toBe("qa-b-code");
    await expect(box, "揃ったら出さない").toHaveCount(0);
  } finally {
    g.open();
  }
});

test("SCR-BRIDGE-SETUP-062 状態「切れている（知らせが来ていない）」：渡せないことと、端末名・最後の知らせ（実データ）・溜まった分は消えない・やること が出る", async ({
  page,
}) => {
  const u = await signupViaApi();
  const token = await claimBridge(u.token, "MacBook Pro（QA-B 寝ている）");
  await bridgeBeat(token); // 一度は知らせが来た PC（K-57：知らせの無い PC は「まだ」で、「切れている」ではない）
  await admin("update sessions set last_seen_at = now() - interval '7 minutes' where id = $1", [
    await deviceRowId(token),
  ]);
  await hideRealBridge(page); // この PC の Bridge は返事をしない（閉じている）
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/setup/bridge/legacy");
  const slp = page.locator('[data-state="slp"]');
  await expect(slp).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("h1")).toHaveText("自分のPCをつなぐ");
  await expect(slp.locator("[data-disconnected]")).toHaveText("切れています。いまは仕事を渡せません");
  await expect(slp, "端末名は登録の値").toContainText("MacBook Pro（QA-B 寝ている） とはつながっていますが");
  await expect(slp, "最後の知らせは DB の値から（モックの 4 分 12 秒の決め打ちでない）").toContainText(
    /最後の知らせは [78] 分前\s*です/,
  );
  await expect(slp).toContainText("溜まった分は消えません");
  await expect(slp.getByRole("heading", { name: "やること" })).toBeVisible();
  await expect(slp.locator("[data-wake]"), "つないだことのある端末なので起こす道が出る").toBeVisible();
  await expect(slp.getByRole("button", { name: "接続を確かめる" })).toBeVisible();
  // つないだ記録があるので段 1 は通っている：手順バーの 2 は押せる（リンク）
  await expect(page.getByRole("link", { name: "2. 話す" })).toHaveAttribute("href", "/onboard/interview");
});

test("SCR-BRIDGE-SETUP-089 SCR-BRIDGE-SETUP-090 状態「接続中」：手順バーの「1. PCをつなぐ」はこの画面を開き、まだ届かない「2. 話す」は押すと何をすれば開くかが出る（飛ばせない・D-089）", async ({
  page,
}) => {
  await hideRealBridge(page);
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/setup/bridge/legacy");
  await expect(page.locator('[data-where="web"]')).toBeVisible({ timeout: 20_000 });
  const one = page.getByRole("link", { name: "1. PCをつなぐ" });
  await expect(one).toHaveAttribute("aria-current", "step");
  const two = page.getByRole("button", { name: "2. 話す（まだ開けません。押すと理由が出ます）" });
  await two.click();
  await expect(page.locator("[data-step-note]")).toHaveText(
    /^「2\. 話す」は、いまの段「1\. PCをつなぐ」で\s*PC の Bridge がつながると開きます$/,
  );
  await expect(page).toHaveURL(/\/setup\/bridge\/legacy$/);
  // 「1. PCをつなぐ」の行き先 /setup/bridge は K-57 の新しい画面（D-128.150：前の画面は /setup/bridge/legacy に残した）
  await one.click();
  await expect(page).toHaveURL(/\/setup\/bridge$/);
  // 本文の h1 は「PC と使った量」（K-220）。つなぐ小窓（K-230）が開くと題「PC をつなぐ」も h1 で、後ろの h1 は読み上げから外れる。読み上げの見出しで見る
  await expect(page.getByRole("heading", { level: 1, name: /^(PC と使った量|PC をつなぐ)$/ })).toBeVisible();
});

test("SCR-BRIDGE-SETUP-090 SCR-BRIDGE-SETUP-091 SCR-BRIDGE-SETUP-092 状態「つながった」（段 3 まで通した人）：手順バーの 2・3・4 を押すとそれぞれの画面が開く（200・h1）。5・6 は届いていない段として、いまの段で何をすれば開くかが出る", async ({
  page,
}) => {
  await connected(page, undefined, 3);
  for (const [name, url, h1] of [
    ["2. 話す", /\/onboard\/interview$/, "自分のAIと話す"],
    ["3. たたき台", /\/onboard\/draft$/, "たたき台を確かめる"],
    ["4. ログイン情報", /\/settings\/credentials$/, "ログイン情報を預ける"],
  ] as const) {
    await page.goto("/setup/bridge/legacy");
    await expect(page.locator('[data-state="ok"]')).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: new RegExp(`^(（済）)?${name}$`) }).click();
    await expect(page).toHaveURL(url, { timeout: 15_000 });
    await expect(page.locator("h1").first()).toHaveText(h1, { timeout: 15_000 });
    expect((await page.request.get(page.url())).status(), "実在ルート（200）").toBe(200);
  }
  // 5・6 は届いていない段（押しても 404 にせず、いまの段で何をすれば開くかを言う・D-116.2）
  await page.goto("/setup/bridge/legacy");
  // 進み具合（段 3 まで）が読めてから押す（読めていない間は 1 段目扱いの文が出る）
  await expect(page.locator("ol[aria-label='手順'] li", { hasText: "3. たたき台" })).toHaveClass(/st-success/, {
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "5. テスト（まだ開けません。押すと理由が出ます）" }).click();
  await expect(page.locator("[data-step-note]")).toHaveText(
    "「5. テスト」は、いまの段「4. ログイン情報」でログイン情報を 1 件預けると開きます",
  );
  await page.getByRole("button", { name: "6. 本番へ（まだ開けません。押すと理由が出ます）" }).click();
  await expect(page.locator("[data-step-note]")).toHaveText(
    "「6. 本番へ」は、いまの段「4. ログイン情報」でログイン情報を 1 件預けると開きます",
  );
});

test("SCR-BRIDGE-SETUP-100 状態「つながった」：下の帯の「次へ：2. 話す」が押せて、自分のAIと話す が開く", async ({
  page,
}) => {
  await connected(page);
  const next = page.locator("[data-wiz-next-go]");
  await expect(next).toHaveText("次へ：2. 話す");
  await expect(next).toBeEnabled({ timeout: 15_000 });
  await next.click();
  await expect(page).toHaveURL(/\/onboard\/interview$/, { timeout: 15_000 });
  await expect(page.locator("h1").first()).toHaveText("自分のAIと話す", { timeout: 15_000 });
});

test("SCR-BRIDGE-SETUP-097 SCR-BRIDGE-SETUP-098 SCR-BRIDGE-SETUP-099 状態「つながった」：AI が使うブラウザの 3 つを選ぶと切り替わり、Kaname に送られる（端末の行が変わる）", async ({
  page,
}) => {
  const { u } = await connected(page);
  const pick = page.locator("[data-browser-pick]");
  await expect(pick.locator('input[value="chrome"]')).toBeChecked();
  for (const [label, value] of [
    ["Bridge 専用のブラウザ", "dedicated"],
    ["使わない", "off"],
    ["自分の Chrome（Claude in Chrome）", "chrome"],
  ] as const) {
    await pick.getByText(label, { exact: true }).click();
    await expect(page.locator("[data-browser-pick-msg]")).toHaveText("変えました。次の仕事から使います");
    await expect(pick.locator(`input[value="${value}"]`)).toBeChecked();
    await expect.poll(() => browserOf(u.memberId)).toBe(value);
  }
  // 読み直しても選んだ値（Kaname が正本）
  await page.reload();
  await expect(page.locator('[data-browser-pick] input[value="chrome"]')).toBeChecked({ timeout: 20_000 });
});

const CHROME_NG = [
  { name: "本人のサブスクの Claude Code がある", ok: true, detail: "/usr/local/bin/claude" },
  { name: CHROME_CHECK, ok: false, detail: "つながっていません" },
];

test("SCR-BRIDGE-SETUP-101 SCR-BRIDGE-SETUP-102 状態「つながった・AI が Chrome を使えない」：「つなぎ方を見る」は開いて出て、押すと閉じ・もう一度で開く。「Chrome ウェブストアで開く」は公式の入口を新しいタブで開く", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await connected(page, CHROME_NG);
  await expect(page.locator("tr[data-check]", { hasText: CHROME_CHECK })).toHaveAttribute("data-check", "ng");
  const off = page.locator("[data-browser-off]");
  await expect(off).toContainText("AI が Chrome を使えません。");
  const details = off.locator("[data-browser-fix] details");
  const list = details.locator("ol");
  await expect(list).toBeVisible();
  await details.locator("summary", { hasText: "つなぎ方を見る" }).click();
  await expect(list).toBeHidden();
  await details.locator("summary", { hasText: "つなぎ方を見る" }).click();
  await expect(list).toBeVisible();
  await expect(list.locator("li")).toHaveCount(3);
  // 外の入口は新しいタブ（Chrome ウェブストアは Chrome が特別に扱う場所なので、中身は差し替えずに開いた先の URL を見る）
  const link = off.locator("[data-browser-install]");
  await expect(link).toHaveText("Chrome ウェブストアで開く");
  await expect(link).toHaveAttribute("target", "_blank");
  const [tab] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await expect
    .poll(() => tab.url(), { timeout: 15_000 })
    .toContain("chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn");
  await tab.close().catch(() => undefined);
  await expect(page, "元の画面はそのまま").toHaveURL(/\/setup\/bridge$/);
});

test("SCR-BRIDGE-SETUP-104 状態「つながった・AI が Chrome を使えない」：「Bridge 専用のブラウザに切り替える」で端末の選択が専用になり、下の選ぶ欄にも印が付く", async ({
  page,
}) => {
  const { u } = await connected(page, CHROME_NG);
  const off = page.locator("[data-browser-off]");
  await off.locator("[data-browser-dedicated]").click();
  await expect(off.locator("[data-browser-fix-msg]")).toHaveText(
    "Bridge 専用のブラウザに切り替えました。次の仕事から使います",
  );
  await expect.poll(() => browserOf(u.memberId)).toBe("dedicated");
  await expect(page.locator('[data-browser-pick] input[value="dedicated"]')).toBeChecked({ timeout: 15_000 });
});

test("SCR-BRIDGE-SETUP-103 状態「つながった・AI が Chrome を使えない」：PC の画面の「もう一度確かめる」で Bridge が小さな仕事で試し、つながれば「つながりました」と出て、Chrome の行が「できる」になる", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await hideRealBridge(page);
  const u = await signupViaApi();
  const b = await startAgentBridge(u.token, { browser: "chrome" });
  bridges.push(b);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  // 拡張機能とつながっていない を本物の輪で起こす（ブラウザを使う仕事を 1 つ渡す）
  await page.goto("/ai/chat");
  const box = page.getByRole("textbox", { name: "自分のAIに書く" });
  await expect(box).toBeVisible({ timeout: 30_000 });
  await box.fill("ブラウザで example.com を開いて");
  await box.press("Enter");
  await expect(page.getByText("Chrome の拡張機能とつながっていないので、ブラウザを使わずに答えます。")).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(
      async () =>
        JSON.stringify(
          (await admin<{ h: unknown }>("select health as h from sessions where id = $1", [b.sid]))[0]?.h ?? null,
        ),
      { timeout: 30_000 },
    )
    .toContain('"ok":false');
  await localBridge(page);
  await page.goto("/setup/bridge/legacy");
  const row = page.locator("tr[data-check]", { hasText: CHROME_CHECK });
  await expect(row).toHaveAttribute("data-check", "ng", { timeout: 20_000 });
  const off = page.locator("[data-browser-off]");
  await off.locator("[data-browser-check]").click();
  await expect(off.locator("[data-browser-fix-msg]")).toHaveText("確かめています（1 分ほどかかります）…");
  // 結果は PC の画面の行に出す（D-120「もう一度確かめる」）：Chrome の行が「できる」になり、一手の帯は消える
  await expect(row).toHaveAttribute("data-check", "ok", { timeout: 100_000 });
  await expect(row).toContainText("できる");
  await expect(page.locator("[data-browser-off]"), "つながったら一手の帯は消える").toHaveCount(0);
  // Bridge が小さな仕事で試した（会話に属さない仕事・終わっている）。会話には出さない
  const jobs = await admin<{ state_id: string; nocv: boolean }>(
    "select state_id, conversation_id is null as nocv from bridge_jobs where member_id = $1 order by created_at",
    [u.memberId],
  );
  expect(jobs.at(-1)).toEqual({ state_id: "done", nocv: true });
  expect(
    jobs.filter((j) => j.nocv),
    "確かめる仕事は 1 件だけ",
  ).toHaveLength(1);
});

// ---- 共通の枠（T-US-01）の上の帯。アプリの枠の見本（/dev/shell）で、時点（ps）ごとに出る操作を押す
test("USH-01-055 上の帯の「高本AI」を押すと自分のAIのパネルが開き、もう一度押すと閉じる", async ({ page }) => {
  await hideRealBridge(page);
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/shell?screen=goals&role=R1&ps=PS3");
  const btn = page.locator(".topbar button.ap-toggle");
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await expect(btn).toContainText("高本AI");
  const panel = page.locator("aside.aipanel");
  const was = (await btn.getAttribute("aria-pressed")) === "true";
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", String(!was));
  const isOn = () => panel.evaluate((e) => e.classList.contains("on"));
  await expect.poll(isOn, { message: "パネルの開閉が押した通りになる" }).toBe(!was);
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", String(was));
  await expect.poll(isOn).toBe(was);
});

test("USH-01-057 AI がまだ無い時点（PS0）の上の帯の「PC をつなぐと話せます」を押すと 自分のPCをつなぐ が開く（200・h1）", async ({
  page,
}) => {
  await hideRealBridge(page);
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/shell?screen=goals&role=R1&ps=PS0");
  const link = page.getByRole("link", { name: "PC をつなぐと話せます" });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await expect(link).toHaveAttribute("href", "/setup/bridge");
  await link.click();
  await expect(page).toHaveURL(/\/setup\/bridge$/, { timeout: 15_000 });
  // /setup/bridge は K-57 の新しい画面（D-128.150）
  await expect(page.getByRole("heading", { level: 1, name: /^(PC と使った量|PC をつなぐ)$/ })).toBeVisible({
    timeout: 15_000,
  });
  expect((await page.request.get(page.url())).status(), "実在ルート（200）").toBe(200);
});

test("SCR-BRIDGE-SETUP-070 状態「つながった」：「この端末を外す」は確かめてから外す。やめると何も変わらず、外すとその端末の鍵が失効して Bridge は仕事を取れなくなる", async ({
  page,
}) => {
  const { u, sid, token } = await connected(page);
  const btn = page.locator(`[data-bridge-revoke="${sid}"]`);
  await expect(btn).toHaveText("この端末を外す");
  // やめる → 何も変わらない
  await btn.click();
  const dlg = page.locator("dialog[data-confirm]");
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText("MacBook Pro（QA-B つながった）");
  await dlg.locator("[data-confirm-cancel]").click();
  await expect(dlg).toBeHidden();
  expect(
    (await admin<{ r: string | null }>("select revoked_at as r from sessions where id = $1", [sid]))[0]!.r,
  ).toBeNull();
  // 外す → 失効し、その鍵では仕事を取れない（410）
  await btn.click();
  await dlg.locator("[data-confirm-ok]").click();
  await expect(page.getByText("外しました。もう一度つなぐときは、この画面からつなぎ直してください")).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(
      async () =>
        (await admin<{ r: string | null }>("select revoked_at as r from sessions where id = $1", [sid]))[0]!.r,
    )
    .not.toBeNull();
  expect((await bridgeTake(token)).status, "外した鍵では仕事を取れない").toBe(410);
  void u;
});

// ---------------------------------------------------------------- つながった後の 3 つの状態（モック v1-bridge-setup の chromeoff／nobrowser／old）
// 期待はモックから：見出しは「自分のPCをつなぐ」、一言はモックの状態の一言、その状態の一手がその場に出る
async function connectedAs(
  page: Page,
  o: { health?: { name: string; ok: boolean; detail?: string }[]; browser?: "off"; old?: boolean },
) {
  const u = await signupViaApi();
  const sid = await claimBridge(u.token, "MacBook Pro（QA-B 状態）");
  if (o.old)
    // 約束の版を送らない（古い）Bridge の知らせ
    await fetch(`${API}/api/v1/bridge/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-session": sid },
      body: JSON.stringify({ health: [] }),
    });
  else await bridgeBeat(sid, o.health);
  await setupStep(u.memberId, 1);
  if (o.browser) await api("/api/auth-ext/agent/browser", { browser: o.browser }, u.token);
  await hideRealBridge(page);
  await localBridge(page, { label: "MacBook Pro（QA-B 状態）" });
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/setup/bridge/legacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("自分のPCをつなぐ", { timeout: 20_000 });
}

test("SCR-BRIDGE-SETUP-107 状態「つながった・AI が Chrome を使えない」がモックどおり：つながりました の一言と、その場のつなぎ方", async ({
  page,
}) => {
  await connectedAs(page, { health: CHROME_NG });
  await expect(page.locator("[data-connected]")).toContainText("つながりました。", { timeout: 20_000 });
  await expect(page.locator("tr[data-check]", { hasText: CHROME_CHECK })).toHaveAttribute("data-check", "ng");
  await expect(page.locator("[data-browser-off] [data-browser-fix]")).toBeVisible();
});

test("SCR-BRIDGE-SETUP-108 状態「つながった・ブラウザを使わない設定」がモックどおり：使わない設定の行は「できる」、ここで使うに戻せる", async ({
  page,
}) => {
  await connectedAs(page, {
    browser: "off",
    health: [
      { name: "本人のサブスクの Claude Code がある", ok: true, detail: "/usr/local/bin/claude" },
      { name: "AI はブラウザを使わない設定です", ok: true },
    ],
  });
  await expect(page.locator("[data-connected]")).toContainText("つながりました。", { timeout: 20_000 });
  await expect(page.locator("tr[data-check]", { hasText: "AI はブラウザを使わない設定です" })).toHaveAttribute(
    "data-check",
    "ok",
  );
  await expect(page.locator('[data-browser-pick] input[value="off"]')).toBeChecked();
  await expect(page.locator('[data-browser-pick] input[value="chrome"]')).toBeEnabled();
});

test("SCR-BRIDGE-SETUP-109 状態「つながった・Bridge が古い」がモックどおり：「仕事を渡せません」と言い（「いま仕事を渡せます」と言わない）、その場に入れ直す口", async ({
  page,
}) => {
  await connectedAs(page, { old: true });
  const lead = page.locator("[data-connected]");
  await expect(lead).toContainText("つながっていますが、Bridge が古いので仕事を渡せません。", { timeout: 20_000 });
  await expect(lead).not.toContainText("いま仕事を渡せます");
  await expect(page.locator("[data-bridge-reinstall]")).toBeVisible();
});
