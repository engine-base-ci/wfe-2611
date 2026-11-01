// T-B-14 資格情報の置き場を Infisical に（D-101・D-102）。
//   手元の API（up.sh）は .env の INFISICAL_* で本物の Infisical（dev の環境）に入っている。画面で預けたものを、このテストが
//   Infisical から直接読み（同じ Machine Identity で入る）、会社の置き場（/tenants/<会社>）に暗号文だけがあること・表には参照 ID だけであることを見る（BRG-14-001・002）。
//   届かない・上限（BRG-14-005・008）は本物の置き場では起こせない。API の返しは apps/api/test/vault_guard.test.ts が置き場を落として実測している
//   （502 E-SEC-001／503 E-SEC-003・表に行なし）ので、ここではその返しと同じ中身を画面に差し込み、文言と一手・行ができないことを実 Chrome で押す。
//   テストの名前に正本の行 ID を持つ（op_gate.py）
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { admin, loginAs, setupStep, signupViaApi } from "../_lib/api";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const PASSWORD = "S3cret-Plain!";
const LOGIN = "me@example.com";
const STORE_URL = "**/api/auth-ext/vault/credentials";

/** .env の INFISICAL_*（値は読むだけ・出力しない） */
function infisicalEnv() {
  const env: Record<string, string> = {};
  for (const ln of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
    const m = /^\s*(INFISICAL_[A-Z_]+)\s*=\s*(.*?)\s*$/.exec(ln);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return {
    siteUrl: (env["INFISICAL_SITE_URL"] ?? "https://us.infisical.com").replace(/\/$/, ""),
    clientId: env["INFISICAL_CLIENT_ID"] ?? "",
    clientSecret: env["INFISICAL_CLIENT_SECRET"] ?? "",
    projectId: env["INFISICAL_PROJECT_ID"] ?? "",
    environment: env["INFISICAL_ENVIRONMENT"] ?? "",
  };
}
/** Machine Identity で入って、会社の置き場の 1 件をそのまま読む（無ければ null）。packages/secrets の InfisicalVault と同じ口 */
async function readFromInfisical(ref: string, tenantId: string): Promise<string | null> {
  const e = infisicalEnv();
  const login = await fetch(`${e.siteUrl}/api/v1/auth/universal-auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: e.clientId, clientSecret: e.clientSecret }),
  });
  expect(login.status, "Infisical に入る").toBe(200);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const q = new URLSearchParams({
    projectId: e.projectId,
    environment: e.environment,
    secretPath: `/tenants/${tenantId}`,
    expandSecretReferences: "false",
    includeImports: "false",
  });
  const r = await fetch(`${e.siteUrl}/api/v4/secrets/${ref.replace(/[^A-Za-z0-9_]/g, "_")}?${q}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (r.status === 404) return null;
  expect(r.status).toBe(200);
  return ((await r.json()) as { secret?: { secretValue?: string } }).secret?.secretValue ?? null;
}
/** 登録 → はじめの設定を済ませた人（PC はつながない）→ 画面を開く */
async function open(page: Page) {
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.goto("/settings/credentials");
  await expect(page.locator("[data-state='ge']")).toContainText("まだ資格情報がありません", { timeout: 15_000 });
  return u;
}
/** 入力まで（保存は押さない） */
async function fill(page: Page, service: string) {
  await page.getByRole("button", { name: "追加する" }).click();
  await page.getByLabel("サービス").fill(service);
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await page.getByLabel("メールアドレス（ログイン名）").fill(LOGIN);
  await page.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
}

test("BRG-14-001 BRG-14-002 画面で預ける → Infisical の会社の置き場（/tenants/<会社>）に暗号文だけ・表には参照 ID だけ・別の会社の置き場からは読めない", async ({
  page,
}) => {
  test.skip(!infisicalEnv().clientId, ".env に INFISICAL_* が無い（手元の API が Infisical に入っていない）");
  const u = await open(page);
  await fill(page, "発注ナビ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("預かり先の番号", { timeout: 15_000 });
  // 表には参照 ID だけ（平文の列そのものが無い）
  const rows = await admin<{ vault_ref: string }>("select vault_ref from credentials where tenant_id = $1", [u.tenantId]);
  expect(rows).toHaveLength(1);
  const ref = rows[0]!.vault_ref;
  expect(ref).toMatch(/^sec_/);
  const cols = (
    await admin<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'credentials'")
  ).map((c) => c.column_name);
  for (const plain of ["login", "password", "totp_secret", "secret"]) expect(cols, "平文の列は無い").not.toContain(plain);
  // Infisical の会社の置き場には、Kaname が会社ごとの鍵で暗号化した中身（JSON）だけ。平文は base64 を開いても無い
  const raw = await readFromInfisical(ref, u.tenantId);
  expect(raw, "Infisical の /tenants/<会社> にある").not.toBeNull();
  const s = JSON.parse(raw!) as { tenantId: string; iv: string; tag: string; data: string; kind: string; revokedAt: null };
  expect(s.tenantId).toBe(u.tenantId);
  expect(s.kind).toBe("basic");
  expect(s.revokedAt).toBeNull();
  expect(Buffer.from(s.iv, "base64")).toHaveLength(12);
  expect(Buffer.from(s.tag, "base64")).toHaveLength(16);
  for (const plain of [PASSWORD, LOGIN, "発注ナビ"]) {
    expect(raw, "置き場の中身に平文が無い").not.toContain(plain);
    expect(Buffer.from(s.data, "base64").toString("utf8"), "暗号文を開いても平文でない").not.toContain(plain);
  }
  // 別の会社の置き場からは、参照 ID を知っていても読めない（BRG-14-002）
  const other = await signupViaApi("別の会社");
  expect(await readFromInfisical(ref, other.tenantId)).toBeNull();
  // 画面にも値は出ない（参照 ID の番号だけ）
  await expect(page.locator("[data-state='n']")).not.toContainText(PASSWORD);
});

test("BRG-14-005 E-SEC-001-C 置き場に届かない（API の返し 502 E-SEC-001 を差し込む）→ 文言と一手が出て、預けたものに行はできない。戻れば同じ入力で預かる", async ({
  page,
}) => {
  const u = await open(page);
  await page.route(STORE_URL, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({
            error: "e-sec-001",
            code: "E-SEC-001",
            message: "預かり先に保管できませんでした。もう一度試してください",
            handoff: "もう一度保存する。続くときは運営に連絡する",
          }),
        })
      : route.continue(),
  );
  await fill(page, "発注ナビ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='i'] p[role=alert]")).toHaveText("預かり先に保管できませんでした。もう一度試してください");
  // 一手「もう一度保存する」が成り立つ：入れたものは消えず、保存できる状態のまま
  expect(await page.getByLabel("パスワード", { exact: true }).inputValue()).toBe(PASSWORD);
  await expect(page.getByRole("button", { name: "保存する" })).toBeEnabled();
  expect(await admin("select 1 from credentials where tenant_id = $1", [u.tenantId]), "表に行はできない").toHaveLength(0);
  await page.unroute(STORE_URL);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("預かり先の番号", { timeout: 15_000 });
  expect(await admin("select 1 from credentials where tenant_id = $1", [u.tenantId])).toHaveLength(1);
});

test("BRG-14-008 E-SEC-003-C 上限に当たった（API の返し 503 E-SEC-003・42 秒を差し込む）→「いま混み合っています。42 秒ほど…」と出て、預けたものに行はできない", async ({
  page,
}) => {
  const u = await open(page);
  await page.route(STORE_URL, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "e-sec-003",
            code: "E-SEC-003",
            message: "いま混み合っています。42 秒ほど待ってからもう一度保存してください",
            retry_after_sec: 42,
          }),
        })
      : route.continue(),
  );
  await fill(page, "発注ナビ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='i'] p[role=alert]")).toHaveText("いま混み合っています。42 秒ほど待ってからもう一度保存してください");
  expect(await page.getByLabel("パスワード", { exact: true }).inputValue(), "待ってから押し直せる").toBe(PASSWORD);
  expect(await admin("select 1 from credentials where tenant_id = $1", [u.tenantId]), "表に行はできない").toHaveLength(0);
  await expect(page.locator("[data-state='n']")).toHaveCount(0);
});
