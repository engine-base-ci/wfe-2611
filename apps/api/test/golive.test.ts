// 本番に切り替える（T-U-12・D-116.5・E-DEP-004）を本物の Postgres（RLS あり）で通す。
//   切り替える前の確認（赤・黄）の判定、赤があれば切り替えない、黄は承知のうえで、止めたまま本番へ、証跡、他社の分は触れない
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { keepAuth, verifiedUser } from "./_pending.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const X = "/api/auth-ext";
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const post = (path: string, body: unknown, h: Record<string, string> = {}) => req("POST", path, body, h);
const json = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;
const uniq = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface Check {
  id: string;
  level: "ok" | "warn" | "red" | "paused";
  title: string;
  detail: string;
  employee_id?: string;
}
interface GoLive {
  checks: Check[];
  schedule: { duty: string; staff: string; paused: boolean }[];
  red: number;
  warn: number;
  ready: boolean;
  shortfall: string | null;
  live: { at: string; by: string } | null;
}

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  const appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  const { auth } = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3001",
      webBaseURL: "http://localhost:3123",
      mailer: async () => undefined,
    }),
  );
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-golive-"))), {
    signingSecret: "test-files",
    maxBytes: 4 * 1024 * 1024,
  });
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth,
      appPool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }),
      repo,
      secrets,
      objects,
      mailer: async (m) => void sent.push({ to: m.to, url: m.url, kind: m.kind }),
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
      },
    }),
  });
}, 60_000);

/** 会社を作り、5 テスト まで通した人にする。Bridge の行は bridge=true のとき */
async function signUp(bridge = true) {
  const email = `${uniq()}@example.com`;
  // 申し込みは直に置き、確認だけを通す（前の道すじ /sign-up は K-51 で契約の口に移した）
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K" });
  const H = { authorization: `Bearer ${ver.token}` };
  const me = await json<{ member_id: string; tenant_id: string }>(req("GET", "/me", undefined, H));
  const scope = (await admin.query("select scope_id from members where id = $1", [me.member_id])).rows[0]
    .scope_id as string;
  await admin.query("select app.setup_step_done($1, 5::smallint)", [me.member_id]);
  if (bridge)
    await admin.query(
      "insert into sessions (tenant_id, member_id, kind_id, device_label, auth_session_id, alive_at) values ($1, $2, 'bridge', 'QA の PC', $3, now())",
      [me.tenant_id, me.member_id, uniq()],
    );
  return { H, member: me.member_id, tenant: me.tenant_id, scope };
}
type U = Awaited<ReturnType<typeof signUp>>;
async function employee(u: U, name: string, duty: string, services: string[] = []) {
  const m = (
    await admin.query(
      "insert into members (tenant_id, scope_id, kind_id, display_name, role_id) values ($1, $2, 'ai_employee', $3, 'staff') returning id",
      [u.tenant, u.scope, name],
    )
  ).rows[0].id as string;
  const a = (
    await admin.query(
      "insert into ai_employees (tenant_id, scope_id, member_id, created_by) values ($1, $2, $3, $4) returning id",
      [u.tenant, u.scope, m, u.member],
    )
  ).rows[0].id as string;
  await admin.query(
    "insert into duties (tenant_id, scope_id, ai_employee_id, name, definition_md, constraints, created_by) values ($1, $2, $3, $4, $4, $5, $6)",
    [u.tenant, u.scope, a, duty, JSON.stringify({ services }), u.member],
  );
  return { aiId: a, memberId: m };
}
async function goalFor(u: U, to: string[]) {
  await admin.query("insert into goal_kinds (key, label) values ('qa_seed', '目標') on conflict (key) do nothing");
  const g = (
    await admin.query(
      "insert into goals (tenant_id, scope_id, kind_id, period_start, period_end, target_value, created_by) values ($1, $2, 'qa_seed', '2026-10-01', '2026-12-31', 100, $3) returning id",
      [u.tenant, u.scope, u.member],
    )
  ).rows[0].id as string;
  for (const m of to)
    await admin.query(
      "insert into goal_allocations (tenant_id, goal_id, assignee_member_id, allocated_value, created_by) values ($1, $2, $3, 1, $4)",
      [u.tenant, g, m, u.member],
    );
}
async function credential(u: U, service: string, state: string | null) {
  // K-358：前の道すじ /vault/credentials を消したので、行を直に置く（本番に切り替える判定は行の login_check_state だけを読む・値は要らない）
  const c = (
    await admin.query<{ id: string }>(
      "insert into credentials (tenant_id, scope_id, owner_member_id, service_name, kind_id, vault_ref, created_by) values ($1, $2, $3, $4, 'basic', 'sec_golive_test', $3) returning id",
      [u.tenant, u.scope, u.member, service],
    )
  ).rows[0]!;
  await admin.query("update credentials set login_check_state = $2, login_check_detail = $3 where id = $1", [
    c.id,
    state,
    state ? `state ${state}` : null,
  ]);
  return c.id;
}
const golive = (u: U) => json<GoLive>(req("GET", "/onboard/golive", undefined, u.H));
const level = (g: GoLive, id: string) => g.checks.find((c) => c.id === id)?.level;

describe("本番に切り替える（D-116.5・E-DEP-004）", () => {
  it("会社モデル・Bridge・承認のルール・AI社員ごとのログイン情報と目標を本物の記録から判定する。赤の文は E-DEP-004 の形", async () => {
    const u = await signUp(false);
    let g = await golive(u);
    expect(level(g, "model")).toBe("red");
    expect(g.checks.find((c) => c.id === "model")!.detail).toBe(
      "目標がありません・担当業務がありません・AI社員がいません",
    );
    expect(level(g, "bridge")).toBe("red");
    expect(level(g, "approval")).toBe("ok");
    expect(g.ready).toBe(false);
    expect(g.shortfall).toBe(
      "本番に切り替える前に 2 つ足りません：会社モデル／Bridge の接続。埋めると切り替えられます",
    );
    // 会社モデルと Bridge がそろい、AI社員が使うサービスのログイン情報と目標が足りない
    const sales = await employee(u, "営業社員", "新着を台帳に入れる", ["freee", "発注ナビ"]);
    const acct = await employee(u, "経理社員", "請求書を下書きする");
    await goalFor(u, [acct.memberId]);
    await admin.query(
      "insert into sessions (tenant_id, member_id, kind_id, device_label, auth_session_id, alive_at) values ($1, $2, 'bridge', 'QA の PC', $3, now())",
      [u.tenant, u.member, uniq()],
    );
    await credential(u, "発注ナビ", "ok");
    g = await golive(u);
    expect(level(g, "model")).toBe("ok");
    expect(level(g, "bridge")).toBe("ok");
    expect(level(g, `cred:${sales.aiId}:freee`)).toBe("red");
    expect(level(g, `cred:${sales.aiId}:発注ナビ`)).toBe("ok");
    expect(level(g, `goal:${sales.aiId}`)).toBe("red");
    expect(level(g, `goal:${acct.aiId}`)).toBe("ok");
    expect(g.red).toBe(2);
    expect(g.shortfall).toBe(
      "本番に切り替える前に 2 つ足りません：営業社員の freee のログイン情報／営業社員の目標。埋めると切り替えられます",
    );
    expect(g.schedule.map((s) => [s.staff, s.duty, s.paused])).toEqual([
      ["営業社員", "新着を台帳に入れる", false],
      ["経理社員", "請求書を下書きする", false],
    ]);
    // 赤がある間は切り替えない（409・E-DEP-004 の文言）。会社は本番にならない
    const r = await post("/onboard/golive", { accept_warnings: true }, u.H);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { code: string; message: string }).message).toContain("2 つ足りません");
    expect((await admin.query("select live_at from tenants where id = $1", [u.tenant])).rows[0].live_at).toBeNull();
    expect((await admin.query("select setup_step from members where id = $1", [u.member])).rows[0].setup_step).toBe(5);
  });

  it("ログイン情報の状態：ログインできた＝OK・できなかった＝赤・途中で止まった＝黄・まだ＝黄・規約で禁止＝赤。外に出る操作を auto にした会社の設定は赤", async () => {
    const u = await signUp();
    const a = await employee(u, "A", "a", ["ok.example", "bad.example", "two.example", "new.example"]);
    await goalFor(u, [a.memberId]);
    await credential(u, "ok.example", "ok");
    await credential(u, "bad.example", "bad_password");
    await credential(u, "two.example", "needs_2fa");
    await credential(u, "new.example", null);
    let g = await golive(u);
    expect(level(g, `cred:${a.aiId}:ok.example`)).toBe("ok");
    expect(level(g, `cred:${a.aiId}:bad.example`)).toBe("red");
    expect(level(g, `cred:${a.aiId}:two.example`)).toBe("warn");
    expect(level(g, `cred:${a.aiId}:new.example`)).toBe("warn");
    expect([g.red, g.warn]).toEqual([1, 2]);
    await admin.query(
      "insert into policies (tenant_id, scope_id, action_kind_id, mode_id, created_by) values ($1, $2, 'external_send', 'auto', $3)",
      [u.tenant, u.scope, u.member],
    );
    g = await golive(u);
    expect(level(g, "approval")).toBe("red");
    expect(g.checks.find((c) => c.id === "approval")!.detail).toContain("承認なしで動く設定");
  });

  it("黄だけなら、承知なしは 409・承知すれば切り替わる（tenants.live_at・段 6・証跡に警告）。もう一度押しても日時は変わらない", async () => {
    const u = await signUp();
    const a = await employee(u, "営業社員", "新着を台帳に入れる", ["freee"]);
    await goalFor(u, [a.memberId]);
    await credential(u, "freee", null);
    const g = await golive(u);
    expect([g.red, g.warn, g.ready]).toEqual([0, 1, true]);
    expect(g.shortfall).toBeNull();
    const r1 = await post("/onboard/golive", {}, u.H);
    expect(r1.status).toBe(409);
    expect(((await r1.json()) as { code: string }).code).toBe("GOLIVE_WARNINGS");
    expect((await admin.query("select live_at from tenants where id = $1", [u.tenant])).rows[0].live_at).toBeNull();
    const r2 = await post("/onboard/golive", { accept_warnings: true }, u.H);
    expect(r2.status).toBe(200);
    const live1 = (await admin.query("select live_at, live_by from tenants where id = $1", [u.tenant])).rows[0];
    expect(live1.live_at).toBeTruthy();
    expect(live1.live_by).toBe(u.member);
    expect((await admin.query("select setup_step from members where id = $1", [u.member])).rows[0].setup_step).toBe(6);
    const au = (
      await admin.query("select payload from audit_events where action = 'golive.switched' and tenant_id = $1", [
        u.tenant,
      ])
    ).rows;
    expect(au).toHaveLength(1);
    expect(au[0].payload.warnings_accepted).toBe(1);
    expect(au[0].payload.warnings).toEqual(["営業社員が使う freee のログイン情報と権限"]);
    expect((await golive(u)).live?.by).toBe(
      (await admin.query("select display_name from members where id = $1", [u.member])).rows[0].display_name,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect((await post("/onboard/golive", { accept_warnings: true }, u.H)).status).toBe(200);
    expect((await admin.query("select live_at from tenants where id = $1", [u.tenant])).rows[0].live_at.getTime()).toBe(
      live1.live_at.getTime(),
    );
  });

  it("止めたまま本番へ：足りない AI社員を止めると、その行は見ず、赤が消えて切り替えられる。戻せる。他社の AI社員は 404 で変わらない", async () => {
    const u = await signUp();
    const a = await employee(u, "営業社員", "新着を台帳に入れる", ["freee"]);
    await goalFor(u, []); // 目標はあるが、営業社員には配っていない
    let g = await golive(u);
    expect(g.red).toBe(2);
    expect(
      (await post("/onboard/golive/pause", { employee_id: a.aiId, paused: true, reason: "freee は来月" }, u.H)).status,
    ).toBe(200);
    g = await golive(u);
    expect(g.checks.filter((c) => c.employee_id === a.aiId).map((c) => c.level)).toEqual(["paused"]);
    expect(g.checks.find((c) => c.id === `paused:${a.aiId}`)!.detail).toBe("freee は来月");
    expect([g.red, g.ready]).toEqual([0, true]);
    expect(g.schedule[0]!.paused).toBe(true);
    expect((await post("/onboard/golive/pause", { employee_id: a.aiId, paused: false }, u.H)).status).toBe(200);
    expect((await golive(u)).red).toBe(2);
    expect(
      (
        await admin.query(
          "select action from audit_events where target_type = 'ai_employees' and target_id = $1 order by created_at",
          [a.aiId],
        )
      ).rows.map((r) => r.action),
    ).toEqual(["golive.employee_paused", "golive.employee_resumed"]);
    const other = await signUp();
    expect((await post("/onboard/golive/pause", { employee_id: a.aiId, paused: true }, other.H)).status).toBe(404);
    expect(
      (await admin.query("select paused_at from ai_employees where id = $1", [a.aiId])).rows[0].paused_at,
    ).toBeNull();
    expect((await post("/onboard/golive/pause", { employee_id: "x", paused: true }, u.H)).status).toBe(422);
    expect((await post("/onboard/golive/pause", { employee_id: a.aiId, paused: "yes" }, u.H)).status).toBe(422);
    expect((await req("GET", "/onboard/golive")).status).toBe(401);
    expect((await post("/onboard/golive", {})).status).toBe(401);
  });
});
