// T-B-05 鍵を受け取る（D-102.2・D-017.1）を、画面 → API → 本物の Bridge の受け取り口（apps/bridge/dist/vault.js）で通す。
//   画面で預けたログイン情報を、本人の Bridge が「動いている仕事」のためにだけ受け取り、使った後は消える。画面・DB・証跡に値は出ない。
//   テストの名前に正本の行 ID を持つ（op_gate.py）。本人の Bridge は使わない（claimBridge で QA の端末をつなぐ）
import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { API, admin, api, bridgeTake, claimBridge, loginAs, setupDone, signupViaApi } from "../_lib/api";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
type Cred = { login: string; password: string; totpSecret: string | null; serviceName: string | null };
type VaultMod = {
  withCredential: <T>(
    d: { apiBase: string; sessionId: () => string | null; timeoutMs?: number },
    jobId: string,
    credentialId: string,
    use: (c: Cred) => Promise<T>,
  ) => Promise<T>;
  CredentialError: new (...a: never[]) => Error & { kind: string; handoff: string | null };
};
const vault = () => createRequire(join(ROOT, "apps/bridge/dist/loop.js"))("./vault.js") as VaultMod;
const PASSWORD = "S3cret-Plain!";
const TOTP = "JBSWY3DPEHPK3PXP";

/** 画面でログイン情報を 1 件預け、Bridge をつなぎ、会話の仕事を 1 件渡して running にする */
async function stored(page: import("@playwright/test").Page) {
  const u = await signupViaApi();
  await setupDone(u);
  await loginAs(page, u.token);
  await page.goto("/settings/credentials");
  await expect(page.locator("[data-state='ge']")).toContainText("まだ資格情報がありません", { timeout: 15_000 });
  await page.getByRole("button", { name: "追加する" }).click();
  await page.getByLabel("サービス").fill("発注ナビ");
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
  await page.locator("[data-two-factor]").selectOption("totp");
  await page.getByLabel("認証アプリの秘密鍵").fill(TOTP);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("発注ナビ", { timeout: 15_000 });
  const cred = (
    await admin<{ id: string; vault_ref: string }>("select id, vault_ref from credentials where tenant_id = $1", [
      u.tenantId,
    ])
  )[0]!;
  const sid = await claimBridge(u.token, "QA の PC（鍵を受け取る）");
  // 預けた直後に積まれる「1 回だけログインを試す」仕事（T-B-38）が、この人の動いている仕事。Bridge が取る
  const took = await bridgeTake(sid);
  expect(took.json.data).toMatchObject({ kind: "login_check", credential_id: cred.id });
  const say = { json: { data: { job_id: took.json.data!.job_id } } };
  const deps = { apiBase: API, sessionId: () => sid, timeoutMs: 10_000 };
  const audits = () =>
    admin<{ action: string; choke_point_id: string; payload: Record<string, unknown> }>(
      "select action, choke_point_id, payload from audit_events where tenant_id = $1 and target_type = 'credentials' and action like 'credential.bridge_%' order by created_at",
      [u.tenantId],
    );
  return { u, cred, sid, jobId: say.json.data.job_id, deps, audits };
}
/** 画面と DB に値が出ていない（関門 C8 の外に値を置かない） */
async function noLeak(page: import("@playwright/test").Page, tenantId: string) {
  await page.reload();
  await expect(page.locator("[data-state='n']")).toContainText("預かり先の番号", { timeout: 15_000 });
  const text = await page.locator("body").innerText();
  expect(text).not.toContain(PASSWORD);
  expect(text).not.toContain(TOTP);
  const leak = await admin<{ n: string }>(
    "select count(*) as n from audit_events where tenant_id = $1 and (payload::text like $2 or payload::text like $3)",
    [tenantId, `%${PASSWORD}%`, `%${TOTP}%`],
  );
  expect(Number(leak[0]!.n), "証跡に値が書かれている").toBe(0);
}

test("BRG-05-004 画面で預けたログイン情報を、本人の Bridge が動いている仕事のためにだけ受け取る。使った後は消え、画面・DB・証跡に値は出ない。証跡は C8 で 1 行", async ({
  page,
}) => {
  const s = await stored(page);
  const { withCredential } = vault();
  let held: Cred | null = null;
  const seen = await withCredential(s.deps, s.jobId, s.cred.id, async (c) => {
    held = c;
    return { ...c };
  });
  // 画面で入れた値がそのまま Bridge に届く（AI には渡らない：ここは Bridge の鍵で頼んでいる）
  expect(seen).toEqual({
    login: "me@example.com",
    password: PASSWORD,
    totpSecret: TOTP,
    serviceName: "発注ナビ",
    serviceDomain: null,
    twoFactor: "totp",
  });
  // 使い終わったら消えている
  expect(held).toMatchObject({ login: "", password: "", totpSecret: null });
  // 証跡：関門 C8 で 1 行。値は書かない
  const a = await s.audits();
  expect(a.map((x) => [x.action, x.choke_point_id])).toEqual([["credential.bridge_resolve", "C8"]]);
  expect(a[0]!.payload).toMatchObject({ job_id: s.jobId, service_name: "発注ナビ" });
  await noLeak(page, s.u.tenantId);
  // 一覧は「預けた · 預かり先の番号 …」のまま（値を見せる列は無い）
  await expect(page.locator("[data-state='n']")).toContainText("預かり先の番号");
});

test("BRG-05-004 他人の Bridge の鍵では受け取れない（404・あることも教えない）。仕事が終わった後は 403 と理由。拒んだことが証跡に残る", async ({
  page,
}) => {
  const s = await stored(page);
  const { withCredential } = vault();
  // 別の会社の Bridge
  const other = await signupViaApi();
  const otherSid = await claimBridge(other.token, "よその PC");
  const o = await api<{ data: { job_id: string } }>("/api/auth-ext/agent/say", { text: "x" }, other.token);
  await bridgeTake(otherSid);
  const e1 = await withCredential(
    { ...s.deps, sessionId: () => otherSid },
    o.json.data.job_id,
    s.cred.id,
    async () => "成功してはいけない",
  ).catch((e: Error & { kind: string }) => e);
  expect(e1).toBeInstanceOf(Error);
  expect((e1 as Error & { kind: string }).kind).toBe("notfound");
  // 自分の仕事が終わった（Bridge が途中で死んで止まった、でも同じ）→ 動いていないので受け取れない
  await admin(
    "update bridge_jobs set state_id = 'stopped', stopped_reason = 'テストで止めた', finished_at = now() where id = $1",
    [s.jobId],
  );
  const e2 = await withCredential(s.deps, s.jobId, s.cred.id, async () => "成功してはいけない").catch(
    (e: Error & { kind: string; handoff: string | null }) => e,
  );
  expect((e2 as Error & { kind: string }).kind).toBe("denied");
  expect((e2 as Error).message).toContain("動いている仕事");
  expect((e2 as Error & { handoff: string | null }).handoff).toBe("仕事を始めてから");
  const a = await s.audits();
  expect(a.map((x) => x.action)).toEqual(["credential.bridge_denied"]);
  expect(a[0]!.payload).toMatchObject({ reason: "job_not_running" });
  await noLeak(page, s.u.tenantId);
});

test("BRG-05-005 Kaname に届かないとき（G-11）、Bridge は成功にせず理由を持って止まる。預けたものは画面にそのまま残る", async ({
  page,
}) => {
  const s = await stored(page);
  const { withCredential } = vault();
  const e = await withCredential(
    { ...s.deps, apiBase: "http://127.0.0.1:9", timeoutMs: 2_000 },
    s.jobId,
    s.cred.id,
    async () => "成功してはいけない",
  ).catch((x: Error & { kind: string }) => x);
  expect((e as Error & { kind: string }).kind).toBe("unreachable");
  expect((e as Error).message).toContain("届かない");
  expect(await s.audits()).toEqual([]);
  await noLeak(page, s.u.tenantId);
});

test("BRG-05-006 預かり先の中身が欠けている・読めないとき（G-15）、成功にしない。画面の行は変わらず、預け直しの一手が返る", async ({
  page,
}) => {
  const s = await stored(page);
  const { withCredential } = vault();
  // 預かり先の参照を、存在しないものに差し替える（預かり先が消えた・読めない）
  await admin("update credentials set vault_ref = 'sec_0000000000000000000000000000' where id = $1", [s.cred.id]);
  const e = await withCredential(s.deps, s.jobId, s.cred.id, async () => "成功してはいけない").catch(
    (x: Error & { kind: string; handoff: string | null }) => x,
  );
  expect(["denied", "unreachable", "incomplete"]).toContain((e as Error & { kind: string }).kind);
  expect((e as Error & { handoff: string | null }).handoff).toBeTruthy();
  expect((e as Error).message.length).toBeGreaterThan(5);
  expect(await s.audits()).toEqual([]); // 解けていないので「受け取った」は残らない
  await noLeak(page, s.u.tenantId);
});
