// K-233 で変えた 2 ファイル（packages/auth/src/index.ts・apps/api/src/middleware/tenant.ts）の、前から試験の無かった関数を通す試験（口・本物の DB・本物の Better Auth）。
//   行 ID（K233-API-019〜…）は 11_tickets/K-233.md の表と 1 対 1。
//   メールは試験用の受け箱（配列）で受け、本物には送らない。送出先が無いときの代わり（ログに出す）は console.warn を見張る。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth, type Auth, type Mail } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { mailTag } from "@kaname/auth/signup";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { createApp } from "../src/app.js";
import { anonymousResolver } from "../src/middleware/tenant.js";
import { ticketHooks } from "../src/hooks/tickets.js";
import { keepAuth, verifiedUser } from "./_pending.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "correct-horse-battery-1";
const NEW_PW = "correct-horse-battery-2";
const WEB = "http://localhost:3123";
const SECRET = "k233-mail-paths".padEnd(40, "0"); // 試験だけの作り物（秘密の検査に当たらない形）

let admin: pg.Pool;
let appPool: pg.Pool;
let withMail: { auth: Auth; pool: pg.Pool };
let noMail: { auth: Auth; pool: pg.Pool };
let app: ReturnType<typeof createApp>;
let bare: ReturnType<typeof createApp>;
const box: Mail[] = [];

const uniq = () => `k233m-${Date.now().toString(36)}${Math.floor(Math.random() * 1e5)}@example.com`;
const tokenOf = (url: string) => new URL(url).searchParams.get("token") ?? "";
const scopes = (a: ReturnType<typeof createApp>, token?: string) =>
  a.request("http://localhost/api/v1/scopes", {
    headers: { "x-screen-id": "tickets", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  appPool = createPool({ databaseUrl: APP_URL, max: 4 });
  const repo = await createRepository(appPool);
  const base = {
    authDatabaseUrl: AUTH_URL,
    appPool,
    secret: SECRET,
    baseURL: "http://localhost:3001",
    webBaseURL: WEB,
  };
  withMail = keepAuth(createAuth({ ...base, mailer: async (m) => void box.push(m) }));
  noMail = createAuth(base);
  app = createApp({
    repo,
    auth: withMail.auth,
    resolve: createSessionResolver(withMail.auth, appPool),
    contract: { hooks: ticketHooks(appPool) },
  });
  bare = createApp({ repo });
}, 60_000);
afterEach(() => {
  box.length = 0;
  vi.restoreAllMocks();
});
afterAll(async () => {
  await withMail.pool.end();
  await noMail.pool.end();
  await appPool.end();
  await admin.end();
});

describe("K-233 メールの道（試験用の受け箱で受ける）", () => {
  it("K233-API-019 登録済みの人が再設定を頼む：受け箱に 1 通・宛先は本人・kind reset・件名・リンクは画面の /password-reset?token=…・本文にリンクと 30 分", async () => {
    const email = uniq();
    await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K233 メール" });
    await withMail.auth.api.requestPasswordReset({ body: { email } });
    expect(box).toHaveLength(1);
    const m = box[0]!;
    expect(m.to).toBe(email);
    expect(m.kind).toBe("reset");
    expect(m.subject).toBe("Kaname のパスワードを再設定する");
    expect(m.url.startsWith(`${WEB}/password-reset?token=`)).toBe(true);
    expect(tokenOf(m.url).length).toBeGreaterThan(0);
    expect(m.text).toContain(m.url);
    expect(m.text).toContain("30 分");
  });

  it("K233-API-020 登録の無いアドレスで再設定を頼む：例外にならず、受け箱は 0 通（登録の有無を漏らさない）", async () => {
    await expect(withMail.auth.api.requestPasswordReset({ body: { email: uniq() } })).resolves.toBeDefined();
    expect(box).toHaveLength(0);
  });

  it("K233-API-021 メールのリンクで再設定する：その人の public.sessions が全部閉じ理由は password_changed・前の印は 401・新しいパスワードで入れる", async () => {
    const email = uniq();
    const v = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K233 再設定" });
    expect((await scopes(app, v.token)).status).toBe(200);
    await withMail.auth.api.requestPasswordReset({ body: { email } });
    const token = tokenOf(box[0]!.url);
    await withMail.auth.api.resetPassword({ body: { newPassword: NEW_PW, token } });
    const rows = (
      await admin.query<{ revoked_at: Date | null; revoke_reason_id: string | null }>(
        "select s.revoked_at, s.revoke_reason_id from sessions s join members m on m.id = s.member_id where m.auth_user_id = $1",
        [v.userId],
      )
    ).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.revoked_at !== null && r.revoke_reason_id === "password_changed")).toBe(true);
    expect((await scopes(app, v.token)).status).toBe(401);
    const again = await withMail.auth.api.signInEmail({ body: { email, password: NEW_PW } });
    expect(again.token).toBeTruthy();
  });

  it("K233-API-022 確認のメールを頼む：受け箱に 1 通・宛先は本人・kind verify・件名・リンクは画面の /verify-email?token=…・本文にリンクと 30 分", async () => {
    const email = uniq();
    await withMail.auth.api.signUpEmail({ body: { name: "確認待ち", email, password: PW } });
    box.length = 0; // 登録の時点では送らない（sendOnSignUp: false）。頼んだ分だけを見る
    await withMail.auth.api.sendVerificationEmail({ body: { email } });
    expect(box).toHaveLength(1);
    const m = box[0]!;
    expect(m.to).toBe(email);
    expect(m.kind).toBe("verify");
    expect(m.subject).toBe("Kaname のメールアドレスを確認する");
    expect(m.url.startsWith(`${WEB}/verify-email?token=`)).toBe(true);
    expect(tokenOf(m.url).length).toBeGreaterThan(0);
    expect(m.text).toContain(m.url);
    expect(m.text).toContain("30 分");
  });

  it("K233-API-023 メールの送出先が無い：再設定を頼んでも例外にならず、送出先が無いことと宛先・リンクを 1 行ログに出す", async () => {
    const email = uniq();
    await noMail.auth.api.signUpEmail({ body: { name: "送出先なし", email, password: PW } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(noMail.auth.api.requestPasswordReset({ body: { email } })).resolves.toBeDefined();
    const lines = warn.mock.calls.map((a) => String(a[0])).filter((s) => s.includes("メールの送出先が無い"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(`reset → ${mailTag(email)}`);
    expect(lines[0]).not.toContain(email);
    expect(lines[0]).toContain(`${WEB}/password-reset?token=`);
    expect(box).toHaveLength(0);
  });
});

describe("K-233 解決を渡さない入口", () => {
  it("K233-API-024 解決を渡さないアプリ：既定の解決は null を返し、GET /api/v1/scopes は印があっても無くても 401・code UNAUTHENTICATED", async () => {
    expect(await anonymousResolver({} as never)).toBeNull();
    const v = await verifiedUser(AUTH_URL, { email: uniq(), password: PW, companyName: "K233 解決なし" });
    for (const t of [undefined, v.token]) {
      const r = await scopes(bare, t);
      expect(r.status).toBe(401);
      expect(((await r.json()) as { code: string }).code).toBe("UNAUTHENTICATED");
    }
  });
});
