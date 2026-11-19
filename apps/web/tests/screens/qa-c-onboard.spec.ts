// QA 担当 C：はじめの設定の「話す」（T-U-07）・「たたき台」（T-U-08）と、アカウント作成・メール確認・ログイン・
// パスワード再設定・招待・2 段階・ログイン情報（T-U-01〜06・10）の、結果が空欄だった行を実ブラウザで押して確かめる。
// テストの名前に正本の行 ID を持つ（op_gate.py）。期待は仕様・モック・決定ログから書く（G-09）。
// Bridge は本物の輪（apps/bridge の loop）を回し、CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）。本人の本物の Bridge は止めない
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  admin,
  API,
  hideRealBridge,
  HOME_RE,
  loginAs,
  PW,
  setupDone,
  setupStep,
  sha256,
  signupViaApi,
  uniqEmail,
  mailTag,
} from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";
import { ownIp } from "../_lib/newcomer";

let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});

// ---- 共通の小道具 ----
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
const say = async (page: Page, text: string) => {
  await box(page).fill(text);
  await box(page).press("Enter");
};
/** 書き終わった返事（書きかけの吹き出しは含めない） */
const lastAi = (page: Page) => page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
const lastJob = async (memberId: string) =>
  (
    await admin<{ prompt: string; model: string | null; effort: string | null; permission_mode: string }>(
      "select prompt, model, effort, permission_mode from bridge_jobs where member_id = $1 order by created_at desc limit 1",
      [memberId],
    )
  )[0];
const count = async (sql: string, p: unknown[]) => (await admin<{ n: number }>(sql, p))[0]!.n;

/** API のログ（KANAME_API_LOG）から、その宛先・その件名の [mail] 行だけを読む */
function mailLines(email: string, subject: string): string[] {
  const p = process.env["KANAME_API_LOG"];
  if (!p) throw new Error("KANAME_API_LOG が無い（メールの行は API のログで確かめる）");
  return readFileSync(p, "utf8")
    .split("\n")
    .filter(
      (l) =>
        l.startsWith("[mail]") &&
        (l.includes(`→ ${email}（${subject}）`) || l.includes(`→ ${mailTag(email)}（${subject}）`)),
    ); // ログの宛先は印（K-51・TP-REG-14）
}
/** 送出先（Resend）が受け取りを拒む宛先：example.com は送出先が拒否する（_lib/api.ts の注記）。
 *  抑止の接頭辞（qa-）を付けないので、実際に送出先へ出して拒否が返る */
const rejectedEmail = () => `rejected-${Date.now().toString(36)}${Math.floor(Math.random() * 1e5)}@example.com`;

/** はじめの設定の「話す」を、Bridge の輪が回っている状態（途中）で開く */
async function interview(page: Page) {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboard/interview");
  await expect(box(page)).toBeVisible({ timeout: 20_000 });
  return u;
}
/** 1 往復して「途中」の状態にする（自分の文と自分のAI の返事が並ぶ） */
async function midway(page: Page, text = "うちは受託の会社です") {
  await say(page, text);
  await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 15_000 });
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-working]"), "作業の行が畳まれる（返事が終わった）").toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.locator("[data-stop]"), "動いていない").toHaveCount(0);
}
/** たたき台がある人（自分のAI が道具で置く）で、たたき台の画面を開く */
async function draft(page: Page) {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 2);
  const r = await fetch(`${API}/api/auth-ext/agent/say`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${u.token}` },
    body: JSON.stringify({ text: "たたき台を置いて" }),
  });
  expect(r.ok, `agent/say ${r.status}`).toBe(true);
  await expect
    .poll(async () => count("select count(*)::int as n from duties where tenant_id = $1", [u.tenantId]), {
      timeout: 60_000,
    })
    .toBeGreaterThan(0);
  // 置き終わりの返事まで待つ（その仕事が動いている間は次の文が順番待ちになる）
  await expect
    .poll(
      async () =>
        count("select count(*)::int as n from bridge_jobs where member_id = $1 and state_id = 'done'", [u.memberId]),
      {
        timeout: 60_000,
      },
    )
    .toBeGreaterThan(0);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboard/draft");
  await expect(page.locator("[data-state='n'] [data-card='goals']")).toContainText("今期の売上", { timeout: 20_000 });
  return u;
}
/** たたき台の「会話で直す」状態にする */
async function fixing(page: Page) {
  const u = await draft(page);
  await page.locator("[data-card='goals']").getByRole("button", { name: "会話で直す" }).click();
  await expect(page.locator("[data-state='f'] [data-draft-chat]")).toBeVisible();
  await expect(box(page)).toBeVisible();
  return u;
}
/** 1 往復させる（会話で直す の中で） */
async function fixingMidway(page: Page, text = "目標の数字を見直したい") {
  await say(page, text);
  await expect(page.locator('[data-state="f"] .msg[data-who="me"]').last()).toContainText(text, { timeout: 15_000 });
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
}

// =====================================================================================
// アカウント作成・メール確認・パスワード再設定・ログイン・招待・2 段階（T-U-01〜06）
// =====================================================================================

test("SCR-SIGNUP-030 ボタン「はじめる」：通常は保留の申し込みができてメール確認へ。既に登録済みのメールでは状態「既に登録済み」になり、申し込みは増えない", async ({
  page,
}) => {
  // 通常
  const email = uniqEmail();
  await page.goto("/signup");
  await expect(page.locator("form[data-state='n']")).toBeVisible();
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("はじめる社");
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/verify-email\?sent=1/);
  await expect(page.locator("[data-state='n']")).toContainText(email);
  expect(
    await count("select count(*)::int as n from kaname_auth.pending_signup where email = $1", [email]),
    "保留の申し込みができる",
  ).toBe(1);
  // 既に登録済み（確認まで済んだ人のメール）
  const done = await signupViaApi("先に登録した社");
  const pendBefore = await count("select count(*)::int as n from kaname_auth.pending_signup where email = $1", [
    done.email,
  ]);
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(done.email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("後から来た社");
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("form[data-state='e']")).toBeVisible();
  await expect(page.getByText("このメールアドレスは既に登録されています")).toBeVisible();
  // 状態「既に登録済み」のままもう一度押しても、先へは進まず、申し込みも会社も増えない
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("form[data-state='e']")).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
  expect(
    await count("select count(*)::int as n from kaname_auth.pending_signup where email = $1", [done.email]),
    "申し込みは増えない",
  ).toBe(pendBefore);
  expect(
    await count(
      "select count(*)::int as n from tenants where name = '後から来た社' and created_at > now() - interval '5 minutes'",
      [],
    ),
  ).toBe(0);
});

test("SCR-VERIFY-EMAIL-028 送れなかった確認のメールを「送った」にしない：送出先が拒む宛先で申し込むと、ログに「[mail] 送れなかった → 宛先: 理由」が出て「送った」は出ない。画面も「送りました」と言わない", async ({
  page,
}) => {
  const email = rejectedEmail();
  const subject = "Kaname｜メールアドレスの確認（登録を確定する）";
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("拒まれる社");
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await expect(page.locator("[data-state='f']")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("body")).not.toContainText("リンクを送りました");
  await expect.poll(() => mailLines(email, subject).join("\n"), { timeout: 15_000 }).toContain("[mail] 送れなかった →");
  const lines = mailLines(email, subject);
  const failed = lines.find((l) => l.startsWith("[mail] 送れなかった"))!;
  expect(failed, "宛先と理由が書かれる").toMatch(new RegExp(`^\\[mail\\] 送れなかった → ${mailTag(email)}（.+）: .+`));
  expect(
    lines.filter((l) => l.startsWith("[mail] 送った")),
    "「送った」は出ない",
  ).toHaveLength(0);
  // 「もう一度送る」でも同じ（送れなかったものを送ったにしない）
  await page.locator("[data-state='f']").getByRole("button", { name: "もう一度送る" }).click();
  await expect
    .poll(() => mailLines(email, subject).filter((l) => l.startsWith("[mail] 送れなかった")).length, {
      timeout: 15_000,
    })
    .toBe(2);
  await expect(page.locator("body")).not.toContainText("もう一度送りました");
  expect(mailLines(email, subject).filter((l) => l.startsWith("[mail] 送った"))).toHaveLength(0);
});

test("SCR-PASSWORD-RESET-037 SCR-PASSWORD-RESET-035 ボタン「再設定メールを送る」：押すと状態「送りました」になり、リンクが出る。送出先が拒む宛先では、ログに「[mail] 送れなかった → 宛先: 理由」が出て「送った」は出ない", async ({
  page,
}) => {
  // 押すと処理が起きる（ふつうの宛先：リンクが API のログに出て、状態が変わる）
  const ok = await signupViaApi("再設定する社");
  await page.goto("/password-reset");
  await expect(page.locator("[data-state='n']")).toBeVisible();
  await page.getByLabel("メールアドレス").fill(ok.email);
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.locator("[data-state='s'] h1")).toHaveText("パスワードを作り直す");
  const readLog = () => readFileSync(process.env["KANAME_API_LOG"]!, "utf8");
  await expect.poll(() => readLog().includes(`（reset → ${mailTag(ok.email)}）`), { timeout: 15_000 }).toBe(true);
  // 送出先が拒む宛先（登録はある）
  const email = rejectedEmail();
  await signupViaApi("拒まれる再設定の社", email);
  const subject = "Kaname のパスワードを再設定する";
  await page.goto("/password-reset");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect.poll(() => mailLines(email, subject).join("\n"), { timeout: 15_000 }).toContain("[mail] 送れなかった →");
  const lines = mailLines(email, subject);
  expect(
    lines.find((l) => l.startsWith("[mail] 送れなかった")),
    "宛先と理由が書かれる",
  ).toMatch(/送れなかった → .+（.+）: .+/);
  expect(
    lines.filter((l) => l.startsWith("[mail] 送った")),
    "「送った」は出ない",
  ).toHaveLength(0);
});

test("SCR-LOGIN-037 ボタン「ログイン」：通常は正しい組み合わせで入る。状態「失敗」から正しく入れ直して押すと入れる（失敗のままにならない）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u);
  await page.goto("/login");
  await expect(page.locator("form[data-state='n']")).toBeVisible();
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード", { exact: true }).fill("wrong-password-000");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator("form[data-state='e']")).toContainText("あと 4 回で 15 分ロックします");
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token")), "失敗では入らない").toBeFalsy();
  // 状態「失敗」から正しいパスワードで押す
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.waitForURL(HOME_RE, { timeout: 30_000 });
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeTruthy();
});

test("SCR-INVITE-ACCEPT-026 ボタン「参加する」：担当者として・閲覧のみとして、どちらも押すとその役割の会員が 1 人でき、付けるまで進めないの画面へ進む（K-335 で契約の口と段 3 の部品に載せ替え・切る段で替えた）", async ({
  page,
}) => {
  for (const [role, membership] of [
    ["staff", "member"],
    ["viewer", "viewer"],
  ] as const) {
    const boss = await signupViaApi("招く会社");
    const token = randomBytes(24).toString("base64url");
    const email = uniqEmail();
    await admin(
      "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, $3, $4, now() + interval '7 days', $5)",
      [boss.tenantId, email, role, sha256(token), boss.memberId],
    );
    // 下見の口は 10 回／分／IP（K-331）。同じ回の CI でほかの招待の試験と続けて流れるので、別の IP の頭を付ける（口の答えは作らない）
    await ownIp(page.context(), 35);
    await page.goto(`/invite/${token}`);
    await expect(page.locator("form[data-auth='invite'][data-state='new']")).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("名前").fill(role === "staff" ? "担当 太郎" : "閲覧 花子");
    await page.getByLabel("パスワード", { exact: true }).fill(PW);
    await page.getByRole("button", { name: "参加する" }).click();
    // 入り方は登録と同じ：参加の後は「付けるまで進めない」（answer=becc3d3aa526 ①）。規約は画面の中で同意（続けると同意）
    await expect(page).toHaveURL(/\/mfa-setup/, { timeout: 20_000 });
    expect(
      await count(
        "select count(*)::int as n from tenant_memberships where tenant_id = $1 and role = $2 and status = 'active'",
        [boss.tenantId, membership],
      ),
      `${role} が所属 ${membership} で 1 人`,
    ).toBe(1);
    const inv = await admin<{ m: string | null }>(
      "select accepted_member_id as m from invitations where token_hash = $1",
      [sha256(token)],
    );
    expect(inv[0]!.m, "招待は受けた印（参加した会員）が付く").not.toBeNull();
    await page.evaluate(() => window.localStorage.clear());
  }
});

// =====================================================================================
// はじめの設定：自分のAIと話す（T-U-07）
// =====================================================================================

test("SCR-ONBOARD-INTERVIEW-075 入力欄「自分のAIに書く」（途中）：書いた文が受け付けられて Bridge への仕事に載り、読み直しても（別 GET）会話に残る", async ({
  page,
}) => {
  const u = await interview(page);
  await midway(page);
  await say(page, "取引先は 12 社あります");
  await expect
    .poll(async () => (await lastJob(u.memberId))?.prompt ?? "", { timeout: 15_000 })
    .toContain("取引先は 12 社あります");
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.locator("[data-state='n'] [data-who='me']").last()).toContainText("取引先は 12 社あります", {
    timeout: 20_000,
  });
});

test("SCR-ONBOARD-INTERVIEW-071 ボタン「タスクにする」（途中）：自分のAI の返事から押すと「タスクにしました」が出て、タスクが 1 件できる", async ({
  page,
}) => {
  const u = await interview(page);
  await midway(page);
  expect(await count("select count(*)::int as n from tasks where tenant_id = $1", [u.tenantId])).toBe(0);
  await lastAi(page).locator("[data-to-task]").click();
  await expect(page.getByText("タスクにしました")).toBeVisible({ timeout: 15_000 });
  expect(await count("select count(*)::int as n from tasks where tenant_id = $1", [u.tenantId])).toBe(1);
});

test("SCR-ONBOARD-INTERVIEW-072 ボタン「書き出す」（途中）：自分のAI の返事から押すと成果物が横に開き、版 1 が残る", async ({
  page,
}) => {
  const u = await interview(page);
  await midway(page);
  await lastAi(page).locator("[data-export]").click();
  const panel = page.locator("[data-artifact]");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel.locator(".ah .v")).toHaveText("版 1");
  await expect
    .poll(
      async () =>
        count(
          "select count(*)::int as n from artifact_versions v join artifacts a on a.id = v.artifact_id where a.owner_member_id = $1",
          [u.memberId],
        ),
      {
        timeout: 15_000,
      },
    )
    .toBe(1);
});

test("SCR-ONBOARD-INTERVIEW-073 ボタン「直して送り直す」（途中）：自分の文から押すと入力欄に「直して送り直す」が付き、直して送るとその時点から新しい会話になる", async ({
  page,
}) => {
  const u = await interview(page);
  await midway(page);
  const before = await count("select count(*)::int as n from conversations where owner_member_id = $1", [u.memberId]);
  await page
    .locator('[data-state="n"] .msg[data-who="me"]')
    .last()
    .getByRole("button", { name: "直して送り直す" })
    .click();
  await expect(page.locator(".cchip[title='直して送り直す']")).toContainText("直して送り直す");
  await box(page).fill("うちは制作の会社です");
  await box(page).press("Enter");
  await expect
    .poll(async () => count("select count(*)::int as n from conversations where owner_member_id = $1", [u.memberId]), {
      timeout: 15_000,
    })
    .toBe(before + 1);
  await expect
    .poll(async () => (await lastJob(u.memberId))?.prompt ?? "", { timeout: 15_000 })
    .toContain("うちは制作の会社です");
});

test("SCR-ONBOARD-INTERVIEW-076 ボタン「資料・画像を付ける」（途中）：押すとファイルを選べ、選んだ資料が入力欄の上に並び、送ると自分のAI が受け取る", async ({
  page,
}) => {
  await interview(page);
  await midway(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "資料・画像を付ける" }).click();
  await (
    await chooser
  ).setFiles([{ name: "会社案内.txt", mimeType: "text/plain", buffer: Buffer.from("受託開発の会社です\n") }]);
  await expect(page.locator("[data-att-state='ok']")).toContainText("会社案内.txt", { timeout: 15_000 });
  await say(page, "この資料を読んで");
  await expect(lastAi(page)).toContainText("会社案内.txt", { timeout: 30_000 });
});

test("SCR-ONBOARD-INTERVIEW-077 ボタン「声で入力」（途中）：押すと聞いている帯が出て、話したことが入力欄の文字になり、直して送れる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeRec {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        setTimeout(
          () => this.onresult?.({ results: [Object.assign([{ transcript: "社員は三人です" }], { isFinal: true })] }),
          200,
        );
      }
      stop() {
        setTimeout(() => this.onend?.(), 50);
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRec, webkitSpeechRecognition: FakeRec });
  });
  await interview(page);
  await midway(page);
  await page.getByRole("button", { name: "声で入力" }).click();
  await expect(page.locator(".rec")).toContainText("聞いています");
  await expect(box(page)).toHaveValue("社員は三人です", { timeout: 5_000 });
  await page.locator(".rec").getByRole("button", { name: "止める" }).click();
  await expect(page.locator(".rec")).toHaveCount(0);
  await box(page).fill("社員は三人です（私を入れて）");
  await box(page).press("Enter");
  await expect(page.locator('[data-state="n"] .msg[data-who="me"]').last()).toContainText("私を入れて");
});

test("SCR-ONBOARD-INTERVIEW-080 ボタン「毎回聞く」（途中）：押すと許可のモードを選べ、選んだモードが次の仕事に載る", async ({
  page,
}) => {
  const u = await interview(page);
  await midway(page);
  await page.getByRole("button", { name: /毎回聞く/ }).click();
  const list = page.getByRole("listbox", { name: "許可のモード" });
  await expect(list).toBeVisible();
  await list.getByRole("option", { name: /計画だけ/ }).click();
  await expect(page.getByRole("button", { name: /計画だけ/ })).toBeVisible();
  await say(page, "進め方だけ教えて");
  await expect
    .poll(async () => (await lastJob(u.memberId))?.prompt ?? "", { timeout: 15_000 })
    .toContain("進め方だけ教えて");
  expect((await lastJob(u.memberId))!.permission_mode).toBe("plan");
});

test("SCR-ONBOARD-INTERVIEW-083 SCR-ONBOARD-INTERVIEW-084 ボタン「Opus 5.5」「中」（途中）：モデルと考える強さを選ぶとボタンに出て、次の仕事の起動の引数（--model・--effort）になる", async ({
  page,
}) => {
  const u = await interview(page);
  await midway(page);
  await page.locator("[data-model]").click();
  await page
    .getByRole("listbox", { name: "モデル" })
    .getByRole("option", { name: /^Opus 5\.5/ })
    .click();
  await expect(page.locator("[data-model]")).toHaveText("Opus 5.5");
  await page.locator("[data-effort]").click();
  await page.getByRole("listbox", { name: "考える強さ" }).getByRole("option", { name: "中", exact: true }).click();
  await expect(page.locator("[data-effort]")).toHaveText("中");
  await say(page, "引数を見せて");
  await expect(lastAi(page)).toContainText("モデル=claude-opus-5-5 強さ=medium", { timeout: 30_000 });
  const j = (await lastJob(u.memberId))!;
  expect({ model: j.model, effort: j.effort }).toEqual({ model: "claude-opus-5-5", effort: "medium" });
});

test("SCR-ONBOARD-INTERVIEW-082 「次へ：3. たたき台」（途中）：自分のAI に答えると下の帯の「次へ：3. たたき台」が押せ、押すと /onboard/draft が開く（段 2 を通した記録が付く）", async ({
  page,
}) => {
  const u = await interview(page);
  const go = page.locator("[data-wiz-next-go]");
  await expect(go).toContainText("次へ：3. たたき台");
  await expect(go, "答える前は押せない").toBeDisabled();
  await midway(page);
  await expect(go).toBeEnabled({ timeout: 15_000 });
  await go.click();
  await expect(page).toHaveURL(/\/onboard\/draft$/);
  await expect(page.locator("h1")).toHaveText("たたき台を確かめる");
  expect(
    (await admin<{ s: number }>("select setup_step as s from members where id = $1", [u.memberId]))[0]!.s,
  ).toBeGreaterThanOrEqual(2);
});

// =====================================================================================
// はじめの設定：たたき台を確かめる（T-U-08）
// =====================================================================================

test("SCR-ONBOARD-DRAFT-062 「これでいく（次：4. ログイン情報）」：たたき台・会話で直す のどちらの状態でも下の帯から押せ、押すと段 3 を通して /settings/credentials が開く", async ({
  page,
}) => {
  const u = await fixing(page); // 会話で直す の状態
  const go = page.locator("[data-wiz-next-go]");
  await expect(go).toContainText("これでいく（次：4. ログイン情報）");
  await expect(go).toBeEnabled();
  await go.click();
  await expect(page).toHaveURL(/\/settings\/credentials$/);
  await expect(page.locator("h1")).toHaveText("ログイン情報を預ける");
  expect((await admin<{ s: number }>("select setup_step as s from members where id = $1", [u.memberId]))[0]!.s).toBe(3);
  // たたき台 の状態からも
  await page.goto("/onboard/draft");
  await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-wiz-next-go]").click();
  await expect(page).toHaveURL(/\/settings\/credentials$/);
});

test("SCR-ONBOARD-DRAFT-056 入力欄「自分のAIに書く」（会話で直す）：書いた文が仕事に載り、自分のAI にはたたき台が添えられ、読み直しても（別 GET）会話に残る", async ({
  page,
}) => {
  const u = await fixing(page);
  await fixingMidway(page, "目標を 10 件にしたい");
  const j = (await lastJob(u.memberId))!;
  expect(j.prompt).toContain("目標を 10 件にしたい");
  expect(j.prompt, "確かめているたたき台が添えられる").toContain("たたき台");
  await page.reload();
  await page.locator("[data-card='goals']").getByRole("button", { name: "会話で直す" }).click();
  await expect(page.locator('[data-state="f"] .msg[data-who="me"]').last()).toContainText("目標を 10 件にしたい", {
    timeout: 20_000,
  });
});

test("SCR-ONBOARD-DRAFT-052 ボタン「タスクにする」（会話で直す）：自分のAI の返事から押すと「タスクにしました」が出て、タスクが 1 件できる", async ({
  page,
}) => {
  const u = await fixing(page);
  await fixingMidway(page);
  const before = await count("select count(*)::int as n from tasks where tenant_id = $1", [u.tenantId]);
  await lastAi(page).locator("[data-to-task]").click();
  await expect(page.getByText("タスクにしました")).toBeVisible({ timeout: 15_000 });
  expect(await count("select count(*)::int as n from tasks where tenant_id = $1", [u.tenantId])).toBe(before + 1);
});

test("SCR-ONBOARD-DRAFT-053 ボタン「書き出す」（会話で直す）：自分のAI の返事から押すと成果物が横に開き、版 1 が残る", async ({
  page,
}) => {
  const u = await fixing(page);
  await fixingMidway(page);
  await lastAi(page).locator("[data-export]").click();
  const panel = page.locator("[data-artifact]");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel.locator(".ah .v")).toHaveText("版 1");
  await expect
    .poll(
      async () =>
        count(
          "select count(*)::int as n from artifact_versions v join artifacts a on a.id = v.artifact_id where a.owner_member_id = $1",
          [u.memberId],
        ),
      {
        timeout: 15_000,
      },
    )
    .toBe(1);
});

test("SCR-ONBOARD-DRAFT-054 ボタン「直して送り直す」（会話で直す）：自分の文から押して直して送ると、その時点から新しい会話になる", async ({
  page,
}) => {
  const u = await fixing(page);
  await fixingMidway(page, "目標の数字を見直したい");
  const before = await count("select count(*)::int as n from conversations where owner_member_id = $1", [u.memberId]);
  await page
    .locator('[data-state="f"] .msg[data-who="me"]')
    .last()
    .getByRole("button", { name: "直して送り直す" })
    .click();
  await expect(page.locator(".cchip[title='直して送り直す']")).toContainText("直して送り直す");
  await box(page).fill("台帳の段を見直したい");
  await box(page).press("Enter");
  await expect
    .poll(async () => count("select count(*)::int as n from conversations where owner_member_id = $1", [u.memberId]), {
      timeout: 15_000,
    })
    .toBe(before + 1);
  await expect
    .poll(async () => (await lastJob(u.memberId))?.prompt ?? "", { timeout: 15_000 })
    .toContain("台帳の段を見直したい");
});

test("SCR-ONBOARD-DRAFT-055 「その他（自分で書く）」（会話で直す）：自分のAI が選択肢で訊いてきたとき、選択肢に無い答えを自分で書いて送ると、その答えで続きが動く", async ({
  page,
}) => {
  await fixing(page);
  await say(page, "請求のこと聞いて");
  const qc = page.locator('[data-part="question"]');
  await expect(qc).toBeVisible({ timeout: 20_000 });
  await expect(qc.getByText("その他（自分で書く）").first()).toBeVisible();
  await qc.getByRole("textbox", { name: "その他の答え" }).fill("11 月");
  await qc.getByRole("button", { name: "次へ" }).click();
  await qc.getByRole("textbox", { name: "その他の答え" }).fill("請求書だけ");
  await qc.getByRole("button", { name: "送る" }).click();
  await expect(lastAi(page)).toContainText("11 月", { timeout: 20_000 });
  await expect(lastAi(page)).toContainText("請求書だけ");
});

test("SCR-ONBOARD-DRAFT-057 ボタン「資料・画像を付ける」（会話で直す）：押すとファイルを選べ、選んだ資料が並び、送ると自分のAI が受け取る", async ({
  page,
}) => {
  await fixing(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "資料・画像を付ける" }).click();
  await (
    await chooser
  ).setFiles([{ name: "去年の売上.csv", mimeType: "text/csv", buffer: Buffer.from("月,売上\n9,100\n") }]);
  await expect(page.locator("[data-att-state='ok']")).toContainText("去年の売上.csv", { timeout: 15_000 });
  await say(page, "この数字で目標を見て");
  await expect(lastAi(page)).toContainText("去年の売上.csv", { timeout: 30_000 });
});

test("SCR-ONBOARD-DRAFT-058 ボタン「声で入力」（会話で直す）：押すと聞いている帯が出て、話したことが入力欄の文字になり、送れる", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeRec {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        setTimeout(
          () => this.onresult?.({ results: [Object.assign([{ transcript: "成約を十件にして" }], { isFinal: true })] }),
          200,
        );
      }
      stop() {
        setTimeout(() => this.onend?.(), 50);
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRec, webkitSpeechRecognition: FakeRec });
  });
  await fixing(page);
  await page.getByRole("button", { name: "声で入力" }).click();
  await expect(page.locator(".rec")).toContainText("聞いています");
  await expect(box(page)).toHaveValue("成約を十件にして", { timeout: 5_000 });
  await page.locator(".rec").getByRole("button", { name: "止める" }).click();
  await expect(page.locator(".rec")).toHaveCount(0);
  await box(page).press("Enter");
  await expect(page.locator('[data-state="f"] .msg[data-who="me"]').last()).toContainText("成約を十件にして", {
    timeout: 15_000,
  });
});

test("SCR-ONBOARD-DRAFT-061 ボタン「毎回聞く」（会話で直す）：押すと許可のモードを選べ、選んだモードが次の仕事に載る", async ({
  page,
}) => {
  const u = await fixing(page);
  await page.getByRole("button", { name: /毎回聞く/ }).click();
  await page
    .getByRole("listbox", { name: "許可のモード" })
    .getByRole("option", { name: /計画だけ/ })
    .click();
  await expect(page.getByRole("button", { name: /計画だけ/ })).toBeVisible();
  await say(page, "直し方だけ教えて");
  await expect
    .poll(async () => (await lastJob(u.memberId))?.prompt ?? "", { timeout: 15_000 })
    .toContain("直し方だけ教えて");
  expect((await lastJob(u.memberId))!.permission_mode).toBe("plan");
});

test("SCR-ONBOARD-DRAFT-063 SCR-ONBOARD-DRAFT-064 ボタン「Opus 5.5」「中」（会話で直す）：モデルと考える強さを選ぶとボタンに出て、次の仕事の起動の引数になる", async ({
  page,
}) => {
  const u = await fixing(page);
  await page.locator("[data-model]").click();
  await page
    .getByRole("listbox", { name: "モデル" })
    .getByRole("option", { name: /^Opus 5\.5/ })
    .click();
  await expect(page.locator("[data-model]")).toHaveText("Opus 5.5");
  await page.locator("[data-effort]").click();
  await page.getByRole("listbox", { name: "考える強さ" }).getByRole("option", { name: "中", exact: true }).click();
  await expect(page.locator("[data-effort]")).toHaveText("中");
  await say(page, "引数を見せて");
  await expect(lastAi(page)).toContainText("モデル=claude-opus-5-5 強さ=medium", { timeout: 30_000 });
  const j = (await lastJob(u.memberId))!;
  expect({ model: j.model, effort: j.effort }).toEqual({ model: "claude-opus-5-5", effort: "medium" });
});

// =====================================================================================
// ログイン情報を預ける（T-U-10）
// =====================================================================================

/** 追加する → サービス → 入力 → 保存する。預けたものが 1 件増える */
async function addCredential(page: Page, service: string) {
  await page.getByLabel("サービス").fill(service);
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await expect(page.locator("[data-state='i']")).toContainText(`${service} のログイン情報`);
  await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("S3cret-Plain!");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText(service, { timeout: 15_000 });
}

test("SCR-CREDENTIALS-051 ボタン「保存する」（入力・空）：空の状態から入れて押すと預けたものに並び（DB は預かり先の番号だけ）、2 件目も入力から押すと増える", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 3);
  await loginAs(page, u.token);
  await page.goto("/settings/credentials");
  await expect(page.locator("[data-state='ge']")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-state='ge']").getByRole("button", { name: "追加する" }).click();
  await addCredential(page, "保存テスト社");
  expect(
    await count("select count(*)::int as n from credentials where tenant_id = $1 and vault_ref like 'sec_%'", [
      u.tenantId,
    ]),
  ).toBe(1);
  await page.locator("[data-state='n']").getByRole("button", { name: "追加する" }).click();
  await addCredential(page, "二件目社");
  expect(await count("select count(*)::int as n from credentials where tenant_id = $1", [u.tenantId])).toBe(2);
  await page.reload();
  await expect(page.locator("[data-state='n']")).toContainText("二件目社", { timeout: 15_000 });
});

test("SCR-CREDENTIALS-056 SCR-CREDENTIALS-050 「次へ：5. テスト」（預けたもの・追加する・入力）：はじめの設定 4 を通した後は下の帯の「次へ：5. テスト」がどの状態でも押せ、5 テストで動かす（/onboard/testrun）に移る（「Kaname を開く」は 5 ができたので無い）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 3);
  await loginAs(page, u.token);
  await page.goto("/settings/credentials");
  await expect(page.locator("[data-state='ge']")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-state='ge']").getByRole("button", { name: "追加する" }).click();
  await addCredential(page, "開く前の社"); // 1 件預けると段 4 を通す（D-089）
  const go = page.locator("[data-wiz-next-go]");
  for (const state of ["n", "a", "i"] as const) {
    await page.goto("/settings/credentials");
    await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 15_000 });
    if (state !== "n") {
      await page.locator("[data-state='n']").getByRole("button", { name: "追加する" }).click();
      await expect(page.locator("[data-state='a']")).toBeVisible();
      if (state === "i") {
        await page.getByLabel("サービス").fill("入力中の社");
        await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
        await expect(page.locator("[data-state='i']")).toBeVisible();
      }
    }
    await expect(go).toHaveText(/次へ：5\. テスト/);
    await expect(go).toBeEnabled();
    await expect(page.getByRole("link", { name: "Kaname を開く" })).toHaveCount(0);
    await go.click();
    await page.waitForURL(/\/onboard\/testrun/, { timeout: 20_000 });
    await expect(page.locator("h1")).toHaveText("テストで動かす");
  }
});
