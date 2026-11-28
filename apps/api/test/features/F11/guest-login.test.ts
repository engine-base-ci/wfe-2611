// K-875「ゲストとしてログインする：画面のログインの解決が役割ゲスト（requester）の人を role client で返す・/me がゲストにも role_id requester を返す・付けるまで進めない・外した直後から入れない」の単体の試験
//   （口・本物の Postgres・本物の Better Auth のログイン。K-233 の k233_session_resolve.test.ts と同じ土台）。行 ID（K875-API-…）は 11_tickets/K-875.md の表と 1 対 1。
//   ゲストは「本物の人を作り、所属の役割を requester に変え、ゲストのグループに入れる」形で作る。
//   試験が決める形：解決の ctx.role は所属が requester なら client・そうでなければ member。/me はゲストなら role_id "requester"・scope_id null。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth, type Auth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
// 作り物の秘密の値は _fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { TEST_AUTH_SECRET } from "../../_fake/secrets.js";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { createApp } from "../../../src/app.js";
import { authExt } from "../../../src/auth/ext.js";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { keepAuth, verifiedUser } from "../../_pending.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "correct-horse-battery-1";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

let admin: pg.Pool;
let appPool: pg.Pool;
let authPool: pg.Pool;
let auth: Auth;
let app: ReturnType<typeof createApp>;
let broken: ReturnType<typeof createApp>;

// 文を数える（K-233 と同じ：接続を取る所を包み、その接続の query を記録する）
interface Hit {
  sql: string;
}
const hits: Hit[] = [];
function tap(pool: pg.Pool): void {
  const orig = pool.connect.bind(pool) as unknown as (cb?: unknown) => unknown;
  const wrap = (cl: pg.PoolClient): pg.PoolClient => {
    const c = cl as pg.PoolClient & { __k875?: boolean };
    if (!c.__k875) {
      const q = c.query.bind(c) as (...a: unknown[]) => unknown;
      (c as unknown as { query: (...a: unknown[]) => unknown }).query = (...a: unknown[]) => {
        const t = a[0];
        hits.push({ sql: typeof t === "string" ? t : String((t as { text?: string } | null)?.text ?? "") });
        return q(...a);
      };
      c.__k875 = true;
    }
    return cl;
  };
  (
    pool as unknown as { connect: (cb?: (e: Error | undefined, c?: pg.PoolClient, d?: unknown) => void) => unknown }
  ).connect = (cb) =>
    cb
      ? orig((e: Error | undefined, c?: pg.PoolClient, d?: unknown) => cb(e, c ? wrap(c) : c, d))
      : (orig() as Promise<pg.PoolClient>).then(wrap);
}
const counted = async <T>(fn: () => Promise<T>): Promise<{ out: T; sql: string[] }> => {
  hits.length = 0;
  const out = await fn();
  return { out, sql: hits.map((h) => h.sql) };
};
const beforeFirstBegin = (sql: string[]) => {
  const i = sql.findIndex((s) => /^\s*begin\b/i.test(s));
  return i < 0 ? sql : sql.slice(0, i);
};
const nm = (sql: string[], re: RegExp) => sql.filter((s) => re.test(s)).length;

interface Who {
  token: string;
  userId: string;
  memberId: string;
  tenantId: string;
  rootScope: string;
  authSessionId: string;
}
const uniq = () => `k875-${Date.now().toString(36)}${Math.floor(Math.random() * 1e5)}`;
/** 本物の人（会社の代表）を作る */
async function person(company = "K875 の会社"): Promise<Who> {
  const v = await verifiedUser(AUTH_URL, { email: `${uniq()}@example.com`, password: PW, companyName: company });
  const m = (
    await admin.query<{ id: string; tenant_id: string }>(
      "select id, tenant_id from members where auth_user_id = $1 and deleted_at is null",
      [v.userId],
    )
  ).rows[0]!;
  const s = (await admin.query<{ id: string }>('select id from kaname_auth."session" where token = $1', [v.token]))
    .rows[0]!;
  const root = (
    await admin.query<{ id: string }>(
      "select id from scopes where tenant_id = $1 and parent_id is null and deleted_at is null limit 1",
      [m.tenant_id],
    )
  ).rows[0]!;
  return {
    token: v.token,
    userId: v.userId,
    memberId: m.id,
    tenantId: m.tenant_id,
    rootScope: root.id,
    authSessionId: s.id,
  };
}
/** 引き金を通さずに書く（session_replication_role = replica）。所属の役割を変えると、役割の束の引き金（0080）が権限の行を作り直し、
 *  権限の引き金（0092・D-128.121）が画面のセッションを切る。この試験は「役割の答えは毎回その時の所属から引く」を見るので、
 *  ログイン中のセッションを残したまま所属だけを変える（束の権限の行は消す＝ゲストは束を持たない）。期待は変えない */
async function quiet(sqls: [string, unknown[]][]): Promise<number> {
  const c = await admin.connect();
  let n = 0;
  try {
    await c.query("begin");
    await c.query("set local session_replication_role = replica");
    for (const [sql, args] of sqls) n += (await c.query(sql, args)).rowCount ?? 0;
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
  return n;
}
/** 所属の役割だけを変える（セッションは切らない・quiet） */
const setRole = (w: Who, role: string): Promise<number> =>
  quiet([
    ["update tenant_memberships set role = $3 where tenant_id = $1 and member_id = $2", [w.tenantId, w.memberId, role]],
  ]);
/** その人の所属を役割ゲスト（requester）にして、ゲストのグループに入れる。group が false ならグループに入れない */
async function toGuest(w: Who, o: { group?: boolean; status?: string } = {}): Promise<void> {
  const up = await quiet([
    [
      "update tenant_memberships set role = 'requester', status = $2 where tenant_id = $1 and member_id = $3",
      [w.tenantId, o.status ?? "active", w.memberId],
    ],
    [
      "delete from permissions where tenant_id = $1 and grantee_member_id = $2 and bundle_role is not null",
      [w.tenantId, w.memberId],
    ],
  ]);
  if (!up)
    await admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'requester', $4)",
      [w.tenantId, w.memberId, w.userId, o.status ?? "active"],
    );
  if (o.group === false) return;
  const g = (
    await admin.query<{ id: string }>(
      "insert into guest_groups (tenant_id, name, request_scope_id) values ($1, $2, $3) returning id",
      [w.tenantId, `ゲスト社${uniq()}`, w.rootScope],
    )
  ).rows[0]!;
  await admin.query("insert into guest_group_members (tenant_id, guest_group_id, member_id) values ($1, $2, $3)", [
    w.tenantId,
    g.id,
    w.memberId,
  ]);
}
const head = (t: string) => ({ authorization: `Bearer ${t}`, "user-agent": UA });
const get = (a: ReturnType<typeof createApp>, path: string, h: Record<string, string> = {}) =>
  a.request(`http://localhost${path}`, { headers: { "x-screen-id": "tickets", ...h } });
const portal = (t: string) => get(app, "/api/v1/portal/notices", head(t));
const scopes = (t: string) => get(app, "/api/v1/scopes", head(t));
const me = (t: string) => get(app, "/api/auth-ext/me", head(t));

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  appPool = createPool({ databaseUrl: APP_URL, max: 4 });
  const repo = await createRepository(appPool);
  const made = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: TEST_AUTH_SECRET,
      baseURL: "http://localhost:3001",
      webBaseURL: "http://localhost:3123",
      mailer: async () => undefined,
    }),
  );
  auth = made.auth;
  authPool = made.pool;
  tap(appPool);
  tap(authPool);
  const ext = (resolvePool: pg.Pool) =>
    authExt({
      auth,
      appPool: resolvePool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 1 }),
      repo,
      secrets: new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9)),
      mailer: async () => undefined,
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
      },
    });
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: ext(appPool),
    contract: { hooks: ticketHooks(appPool) },
  });
  const down = Object.assign(Object.create(appPool) as pg.Pool, {
    query: () => Promise.reject(Object.assign(new Error("試験：解決の文が落ちた"), { name: "DbDown" })),
  });
  broken = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, down),
    contract: { hooks: ticketHooks(appPool) },
  });
}, 60_000);
afterAll(async () => {
  await authPool.end();
  await appPool.end();
  await admin.end();
});

describe("K-875 ゲストとしてログインする", () => {
  it("K875-API-001 ゲストのグループに入ったゲストが先方の口（お知らせ一覧）を叩くと、401・403 のどちらでもなく入口を通る（先方の口の中身は K-906）。同じ人の get-session も 200", async () => {
    const w = await person();
    await toGuest(w);
    const r = await portal(w.token);
    expect([401, 403], await r.clone().text()).not.toContain(r.status);
    expect((await get(app, "/api/auth/get-session", head(w.token))).status).toBe(200);
  });

  it("K875-API-002 役の柵：ゲストが社内の口（GET /api/v1/scopes）を叩くと 403・FORBIDDEN。社内の人は先方の口で 403・社内の口で 200", async () => {
    const guest = await person();
    await toGuest(guest);
    const r = await scopes(guest.token);
    expect(r.status).toBe(403);
    expect(((await r.json()) as { code?: string }).code).toBe("FORBIDDEN");
    const staff = await person();
    expect((await portal(staff.token)).status).toBe(403);
    expect((await scopes(staff.token)).status).toBe(200);
  });

  it("K875-API-003 ゲストの /me：200・鍵は member_id・tenant_id・display_name・role_id・scope_id・workspace_name のまま・role_id は requester・display_name は本人の名前・scope_id は null", async () => {
    const w = await person("ゲストの /me の会社");
    await toGuest(w);
    const name = (
      await admin.query<{ display_name: string }>("select display_name from members where id = $1", [w.memberId])
    ).rows[0]!.display_name;
    const r = await me(w.token);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = ((await r.json()) as { data: Record<string, unknown> }).data;
    expect(Object.keys(d).sort()).toEqual([
      "display_name",
      "member_id",
      "role_id",
      "scope_id",
      "tenant_id",
      "workspace_name",
    ]);
    expect(d["member_id"]).toBe(w.memberId);
    expect(d["tenant_id"]).toBe(w.tenantId);
    expect(d["role_id"]).toBe("requester");
    expect(d["display_name"]).toBe(name);
    expect(d["scope_id"]).toBeNull();
  });

  it("K875-API-004 社内の人の /me は今までどおり：本人の member_id・tenant_id・role_id は owner・scope_id は主のグループ", async () => {
    const w = await person();
    const d = ((await (await me(w.token)).json()) as { data: Record<string, unknown> }).data;
    expect(d["member_id"]).toBe(w.memberId);
    expect(d["tenant_id"]).toBe(w.tenantId);
    expect(d["role_id"]).toBe("owner");
    expect(d["scope_id"]).not.toBeNull();
  });

  it("K875-API-005 付けるまで進めない（D-155.48）：ゲストのセッションに mfa_pending を立てると先方の口は 403・MFA_REQUIRED（社内の人と同じ）。下ろすと入口を通る", async () => {
    const w = await person();
    await toGuest(w);
    await admin.query("update sessions set mfa_pending = true where auth_session_id = $1", [w.authSessionId]);
    const r = await portal(w.token);
    expect(r.status).toBe(403);
    expect(((await r.json()) as { code?: string }).code).toBe("MFA_REQUIRED");
    await admin.query("update sessions set mfa_pending = false where auth_session_id = $1", [w.authSessionId]);
    expect([200, 501]).toContain((await portal(w.token)).status);
  });

  it("K875-API-006 外した直後（G-14）：役割をメンバーに変えると次の要求から社内の口 200・先方の口 403。requester に戻せば逆。members.deleted_at を付けると 401", async () => {
    const w = await person();
    await toGuest(w);
    expect((await scopes(w.token)).status).toBe(403);
    await setRole(w, "member");
    expect((await scopes(w.token)).status).toBe(200);
    expect((await portal(w.token)).status).toBe(403);
    await setRole(w, "requester");
    expect((await scopes(w.token)).status).toBe(403);
    expect([200, 501]).toContain((await portal(w.token)).status);
    await admin.query("update members set deleted_at = now() where id = $1", [w.memberId]);
    expect((await portal(w.token)).status).toBe(401);
  });

  it("K875-API-007 速さ：ゲストの 2 回目の要求は、解決の文が社内の人と同じ数（begin の前が 2 本・kaname_auth を引く文が 1 本・member_left を引く文が 0 本・全体 10 以下）", async () => {
    const w = await person();
    await toGuest(w);
    await portal(w.token);
    const { out, sql } = await counted(() => portal(w.token));
    expect([200, 501]).toContain(out.status);
    expect(sql.length, sql.join("\n")).toBeLessThanOrEqual(10);
    expect(beforeFirstBegin(sql).length, sql.join("\n")).toBe(2);
    expect(nm(sql, /kaname_auth/), sql.join("\n")).toBe(1);
    expect(nm(sql, /member_left/), sql.join("\n")).toBe(0);
  });

  it("K875-API-008 session_role の値：社内の人は member・ゲストは client・止めたゲストも client・消した所属だけの人は member", async () => {
    const role = async (w: Who) =>
      (
        await admin.query<{ r: string }>(
          "select app.session_role(s.id) as r from sessions s where s.auth_session_id = $1",
          [w.authSessionId],
        )
      ).rows[0]!.r;
    const [staff, guest, suspended, gone] = [await person(), await person(), await person(), await person()];
    await toGuest(guest);
    await toGuest(suspended, { status: "suspended" });
    await toGuest(gone);
    await admin.query("update tenant_memberships set deleted_at = now() where tenant_id = $1 and member_id = $2", [
      gone.tenantId,
      gone.memberId,
    ]);
    expect(await role(staff)).toBe("member");
    expect(await role(guest)).toBe("client");
    expect(await role(suspended)).toBe("client");
    expect(await role(gone)).toBe("member");
  });

  it("K875-API-009 グループに入っていないゲスト：role は client（グループは K-878 の守りが見る）。先方の口の入口は通り・社内の口は 403・/me は role_id requester", async () => {
    const w = await person();
    await toGuest(w, { group: false });
    expect([200, 501, 403]).toContain((await portal(w.token)).status);
    expect((await portal(w.token)).status).not.toBe(401);
    expect((await scopes(w.token)).status).toBe(403);
    const d = ((await (await me(w.token)).json()) as { data: Record<string, unknown> }).data;
    expect(d["role_id"]).toBe("requester");
  });

  it("K875-API-010 失敗：解決の文が落ちたアプリは、社内の人にもゲストにも同じ答え（401 か 503）。役割の列のために新しい失敗を足さない", async () => {
    const [staff, guest] = [await person(), await person()];
    await toGuest(guest);
    const [a, b] = [
      await get(broken, "/api/v1/scopes", head(staff.token)),
      await get(broken, "/api/v1/portal/notices", head(guest.token)),
    ];
    expect([401, 503]).toContain(a.status);
    expect(b.status).toBe(a.status);
  });

  it("K875-API-011 ログアウト：ゲストがログアウトすると次の要求は 401（社内の人と同じ）。ログアウト後の /me も 401", async () => {
    const w = await person();
    await toGuest(w);
    await auth.api.signOut({ headers: new Headers(head(w.token)) });
    await admin.query("select app.close_session($1, 'logout')", [w.authSessionId]);
    expect((await portal(w.token)).status).toBe(401);
    expect((await me(w.token)).status).toBe(401);
  });
});
