// K-829「誰ができるかを変える」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン（:su= で本人確認の取り直しの時刻））。
//   行 ID（K829-API-…）は 11_tickets/K-829.md の表と 1 対 1。口の振る舞いは hooks のファイル apps/api/src/hooks/workspace-permissions.ts の register（K-326）。
//   updateWorkspacePermissions PATCH /workspace/permissions ← { billing?: "admin"|"admin_manager", delete_workspace?: "admin"|"admin_manager" }（1 つ以上）→ 200 { data: { permissions: [{ key, value }] } }
//   共通の判定：DB の関数 app.workspace_can(ability) ＝ K-827 の読む口・段 13 の changePlan・K-830 が使う（K-827 が作る・この葉は値を変えた後の判定を見る）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { ObjectStore, refOf } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { migrateAuth } from "@kaname/auth/migrate";
import { createRepository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const HOOK_FILE = join(HERE, "..", "..", "..", "src", "hooks", "workspace-permissions.ts");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (code: string): string => ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${code} が無い）`;
const WS = "株式会社K829";

let f: Fixture;
let app: ReturnType<typeof createApp>;
const hooks: Record<string, Hook> = {};
const limits: Record<string, number> = {};
let loading: Promise<void> | null = null;
let T: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let GD: string;
type P = Person & { email: string };
let admin: P, admin2: P, mgr: P, member: P, viewer: P, kenmu: P, stopped: P, outsider: P;

type J = Record<string, unknown> & {
  data?: Record<string, any>;
  details?: { field: string; message: string }[];
  code?: string;
  detail?: Record<string, unknown>;
};
const json = async (r: Response) => (await r.clone().json()) as J;
const auth = (p: Person, su?: number) => ({
  authorization: `Bearer fake:member:${p.tenantId}:${p.id}${su === undefined ? "" : `:su=${su}`}`,
});
const MIN = 60_000;
void refOf;
const req = (
  method: string,
  path: string,
  o: { body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {},
) =>
  Promise.resolve(
    app.request(`http://localhost/api/v1${path}`, {
      method,
      headers: {
        ...(o.raw === undefined ? { "content-type": "application/json" } : {}),
        "x-forwarded-for": nextIp(),
        ...(o.headers ?? {}),
      },
      ...(o.raw !== undefined ? { body: o.raw } : o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
    }),
  );
const n = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const audits = (action: string) =>
  n("select count(*) n from audit_events where tenant_id = $1 and action = $2", [T.tenantId, action]);
const tenantRow = async (id = T.tenantId) =>
  (await f.admin.query("select * from tenants where id = $1", [id])).rows[0] as Record<string, any>;
/** 表への書き込みを 1 回だけわざと失敗させて fn を流す（取引ごと戻るかを見る） */
async function failOn(table: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k829_fail_${randomUUID().replaceAll("-", "")}`;
  await f.admin.query(
    `create function app.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'k829 試験の失敗'; end if; return new; end $$`,
  );
  await f.admin.query(
    `create trigger ${name} before insert or update on ${table} for each row execute function app.${name}()`,
  );
  try {
    await fn();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on ${table}`);
    await f.admin.query(`drop function if exists app.${name}()`);
  }
}

/** 置き場（関門 C4）の偽：本物のローカルの置き場を、試験が 1 回だけ失敗させられる形で包む */
let store: ObjectStore;
const driverFail = { put: false, del: false };
const mkObjects = (repo: Awaited<ReturnType<typeof createRepository>>) => {
  const inner = localDriver(mkdtempSync(join(tmpdir(), "k829-obj-")));
  const driver = {
    put: async (...a: Parameters<typeof inner.put>) => {
      if (driverFail.put) throw new Error("置けなかった（試験）");
      return inner.put(...a);
    },
    get: inner.get.bind(inner),
    delete: async (...a: Parameters<typeof inner.delete>) => {
      if (driverFail.del) throw new Error("消せなかった（試験）");
      return inner.delete(...a);
    },
  };
  return new ObjectStore(repo, driver, { signingSecret: "k829-files" });
};
const ready = async () => {
  loading ??= (async () => {
    if (!existsSync(HOOK_FILE)) return;
    const repo = await createRepository(f.pool);
    const d = {
      appPool: f.pool,
      repo,
      objects: (store = mkObjects(repo)),
      config: { env: "test", webBaseUrl: "http://localhost:3000", opsEmail: "ops@example.com" },
    } as unknown as HookDeps;
    Object.assign(hooks, ((await import(HOOK_FILE)) as { register: HookModule }).register.make(d));
  })();
  await loading;
};

beforeAll(async () => {
  f = await makeFixture();
  await migrateAuth(process.env["DATABASE_URL"]!);
  const web = async (hd: Headers) => {
    const m = /^Bearer fake:(member):([0-9a-f-]{36}):([0-9a-f-]{36})(?::su=(\d+))?$/.exec(
      hd.get("authorization") ?? "",
    );
    if (!m) return null;
    const ctx: TenantContext = {
      tenantId: m[2]!,
      userId: m[3]!,
      role: "member",
      stepUpAt: m[4] ? new Date(Number(m[4])) : null,
    };
    return { ctx, termsPending: false, sessionId: "", authUserId: "" };
  };
  Object.assign(hooks, f.hooks);
  app = createApp({
    version: "test",
    repo: await createRepository(f.pool),
    resolve: withDevice(web, createDeviceResolver(f.pool)) as never,
    contract: { hooks, limits },
  });
  for (const op of ["updateWorkspacePermissions"]) limits[op] = 10_000;
  T = await f.company(WS, "EG");
  O = await f.company("k829 の別の会社", "OT");
  await f.admin.query("update scopes set name = '営業' where id = $1", [T.rootScope]);
  GD = (
    await f.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '受託開発', 'JD') returning id",
      [T.tenantId, T.rootScope],
    )
  ).rows[0]!.id;
  const make = async (
    key: string,
    name: string,
    o: { tenant?: string; scope?: string; role?: string; stopped?: boolean } = {},
  ): Promise<P> => {
    const tenant = o.tenant ?? T.tenantId;
    const authUserId = randomUUID();
    const email = `${key}-${authUserId.slice(0, 8)}@engine-base.example`;
    await f.admin.query(
      'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
      [authUserId, name, email],
    );
    const p = await f.person(tenant, o.scope ?? (tenant === T.tenantId ? T.rootScope : O.rootScope), {
      name,
      authUserId,
    });
    await f.admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, $4, $5)",
      [tenant, p.id, authUserId, o.role ?? "member", o.stopped ? "suspended" : "active"],
    );
    if (o.stopped)
      await f.admin.query("update members set suspended_at = now(), suspended_by = $2 where id = $1", [p.id, admin.id]);
    return { ...p, email };
  };
  admin = await make("takamoto", "高本 聖斗", { role: "admin" });
  admin2 = await make("admin2", "二人目の管理者", { role: "admin" });
  mgr = await make("sato", "佐藤 花子", { role: "manager" });
  member = await make("suzuki", "鈴木 一郎");
  viewer = await make("yamaguchi", "山口 健", { scope: GD, role: "viewer" });
  // 兼務：営業の主・受託開発のマネージャーを兼ねる。会社全体の役割は member（管理者ではない）
  kenmu = await make("tanaka", "田中 美咲");
  await f.admin.query(
    "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'manager')",
    [T.tenantId, GD, kenmu.id],
  );
  stopped = await make("stopped", "止めた人", { stopped: true });
  outsider = await make("outsider", "別の会社の管理者", { tenant: O.tenantId, role: "admin" });
}, 120_000);
afterAll(async () => {
  await f?.close();
});

const patch = (p: Person, body: unknown, o: { su?: number; key?: string } = {}) =>
  req("PATCH", "/workspace/permissions", {
    body,
    headers: { ...auth(p, o.su), ...(o.key ? { "idempotency-key": o.key } : {}) },
  });
const fresh = () => Date.now() - MIN; // 1 分前に取り直した
const col = async (c: "who_billing" | "who_delete_workspace", id = T.tenantId) => (await tenantRow(id))[c] as string;
const reset = async () =>
  f.admin.query("update tenants set who_billing = 'admin', who_delete_workspace = 'admin' where id = $1", [T.tenantId]);
/** その人の文脈で app.workspace_can を呼ぶ（口を通さず DB の関数だけを見る） */
const can = async (p: Person, ability: string): Promise<boolean> => {
  const c = await f.pool.connect();
  try {
    await c.query("begin");
    await c.query(
      "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
      [p.tenantId, p.id],
    );
    const r = await c.query<{ ok: boolean }>("select app.workspace_can($1) as ok", [ability]);
    return r.rows[0]!.ok;
  } finally {
    await c.query("rollback");
    c.release();
  }
};
const lastChange = async () =>
  (
    await f.admin.query(
      "select payload from audit_events where tenant_id = $1 and action = 'workspace.permissions_changed' order by occurred_at desc limit 1",
      [T.tenantId],
    )
  ).rows[0]?.payload as Record<string, any> | undefined;

describe("K-829 誰ができるかを変える（updateWorkspacePermissions）", () => {
  it("K829-API-001 管理者が変える：プランと支払いを「管理者とマネージャー」に → 200・答えに 2 つの今の値・DB の列が変わる・記録に前と後", async () => {
    await ready();
    await reset();
    const r = await patch(admin, { billing: "admin_manager" }, { su: fresh() });
    expect(r.status, await r.clone().text()).toBe(200);
    const rows = (await json(r)).data!["permissions"] as { key: string; value: string }[];
    expect(rows).toEqual([
      { key: "billing", value: "admin_manager" },
      { key: "delete_workspace", value: "admin" },
    ]);
    expect(await col("who_billing")).toBe("admin_manager");
    expect(await col("who_delete_workspace")).toBe("admin");
    expect(await lastChange()).toMatchObject({ changes: [{ key: "billing", from: "admin", to: "admin_manager" }] });
    await reset();
  });

  it("K829-API-002 2 つ同時に変える：どちらも変わる・記録は 1 行で changes は 2 つ", async () => {
    await ready();
    await reset();
    const a = await audits("workspace.permissions_changed");
    expect(
      (await patch(admin, { billing: "admin_manager", delete_workspace: "admin_manager" }, { su: fresh() })).status,
    ).toBe(200);
    expect([await col("who_billing"), await col("who_delete_workspace")]).toEqual(["admin_manager", "admin_manager"]);
    expect(await audits("workspace.permissions_changed")).toBe(a + 1);
    expect((await lastChange())!["changes"]).toHaveLength(2);
    await reset();
  });

  it("K829-API-003 同じ値に変える：200・記録を書かない・列も変わらない", async () => {
    await ready();
    await reset();
    const a = await audits("workspace.permissions_changed");
    expect((await patch(admin, { billing: "admin" }, { su: fresh() })).status).toBe(200);
    expect(await audits("workspace.permissions_changed")).toBe(a);
  });

  it("K829-API-004 本人確認の取り直し：取り直し無し・16 分前は 403・STEP_UP_REQUIRED・変わらない。1 分前は 200", async () => {
    await ready();
    await reset();
    for (const su of [undefined, Date.now() - 16 * MIN]) {
      const r = await patch(admin, { billing: "admin_manager" }, su === undefined ? {} : { su });
      expect(r.status).toBe(403);
      expect((await json(r)).code).toBe("STEP_UP_REQUIRED");
    }
    expect(await col("who_billing")).toBe("admin");
    expect((await patch(admin, { billing: "admin_manager" }, { su: Date.now() - MIN })).status).toBe(200);
    await reset();
  });

  it("K829-API-005 変えられるのは管理者だけ：マネージャー・メンバー・閲覧のみ・billing の権限を個別に付けた人・兼務のマネージャーは 403・ログインなし 401・変わらない", async () => {
    await ready();
    await reset();
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'billing')",
      [T.tenantId, member.id],
    );
    try {
      for (const p of [mgr, member, viewer, kenmu])
        expect((await patch(p, { billing: "admin_manager" }, { su: fresh() })).status).toBe(403);
      expect((await req("PATCH", "/workspace/permissions", { body: { billing: "admin_manager" } })).status).toBe(401);
      expect(await col("who_billing")).toBe("admin");
    } finally {
      await f.admin.query("delete from permissions where tenant_id = $1 and grantee_member_id = $2", [
        T.tenantId,
        member.id,
      ]);
    }
  });

  it("K829-API-006 形の誤り：空の体・知らない値・知らない欄（export など）・文字でない値は 422・変わらない", async () => {
    await ready();
    await reset();
    for (const body of [{}, { billing: "everyone" }, { export: "admin" }, { billing: 1 }, { billing: null }])
      expect((await patch(admin, body, { su: fresh() })).status, JSON.stringify(body)).toBe(422);
    expect(await col("who_billing")).toBe("admin");
  });

  it("K829-API-007 変えた直後に効く（G-12）：マネージャーのプランと支払いは、変えた直後の判定で true・戻した直後に false", async () => {
    await ready();
    await reset();
    expect(await can(mgr, "billing")).toBe(false);
    await patch(admin, { billing: "admin_manager" }, { su: fresh() });
    expect(await can(mgr, "billing")).toBe(true);
    expect(await can(mgr, "delete_workspace")).toBe(false);
    await patch(admin, { billing: "admin" }, { su: fresh() });
    expect(await can(mgr, "billing")).toBe(false);
  });

  it("K829-API-008 共通の判定 app.workspace_can：管理者は常に true・マネージャーは列が admin_manager のときだけ・メンバー／閲覧のみ／兼務のマネージャー／止めた人は false・個別に付けた人は true", async () => {
    await ready();
    await reset();
    expect([await can(admin, "billing"), await can(admin, "delete_workspace")]).toEqual([true, true]);
    expect([
      await can(member, "delete_workspace"),
      await can(viewer, "billing"),
      await can(kenmu, "billing"),
      await can(stopped, "billing"),
    ]).toEqual([false, false, false, false]);
    await f.admin.query("update tenants set who_delete_workspace = 'admin_manager' where id = $1", [T.tenantId]);
    expect([
      await can(mgr, "delete_workspace"),
      await can(mgr, "billing"),
      await can(member, "delete_workspace"),
      await can(kenmu, "delete_workspace"),
    ]).toEqual([true, false, false, false]);
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'delete_workspace')",
      [T.tenantId, member.id],
    );
    try {
      expect(await can(member, "delete_workspace")).toBe(true);
      expect(await can(member, "billing")).toBe(false);
    } finally {
      await f.admin.query("delete from permissions where tenant_id = $1 and grantee_member_id = $2", [
        T.tenantId,
        member.id,
      ]);
      await reset();
    }
  });

  it("K829-API-009 知らない権限の名前（export など）は DB の関数でも false（書き出しは作らない）", async () => {
    await ready();
    expect(await can(admin, "export")).toBe(false);
    expect(await can(admin, "unknown")).toBe(false);
  });

  it("K829-API-010 別の会社の管理者：自分の会社の列だけが変わり、この会社は変わらない。この会社の管理者の判定はこの会社の列だけを見る", async () => {
    await ready();
    await reset();
    expect((await patch(outsider, { billing: "admin_manager" }, { su: fresh() })).status).toBe(200);
    expect(await col("who_billing")).toBe("admin");
    expect(await col("who_billing", O.tenantId)).toBe("admin_manager");
    await f.admin.query("update tenants set who_billing = 'admin' where id = $1", [O.tenantId]);
  });

  it("K829-API-011 止めた人は変えられない（401 か 403）", async () => {
    await ready();
    const r = await patch(stopped, { billing: "admin_manager" }, { su: fresh() });
    expect([401, 403]).toContain(r.status);
    expect(await col("who_billing")).toBe("admin");
  });

  it("K829-API-012 二度押し（同じ Idempotency-Key）：2 回とも 200・記録は 1 行", async () => {
    await ready();
    await reset();
    const a = await audits("workspace.permissions_changed");
    const key = randomUUID();
    const r1 = await patch(admin, { billing: "admin_manager" }, { su: fresh(), key });
    const r2 = await patch(admin, { billing: "admin_manager" }, { su: fresh(), key });
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(await audits("workspace.permissions_changed")).toBe(a + 1);
    await reset();
  });

  it("K829-API-013 同時に 2 人の管理者が逆の値に変える：どちらも 200・最後に通った値が残り、記録の前と後がつながる（順に通る）", async () => {
    await ready();
    await reset();
    const a = await audits("workspace.permissions_changed");
    const [r1, r2] = await Promise.all([
      patch(admin, { billing: "admin_manager" }, { su: fresh() }),
      patch(admin2, { billing: "admin" }, { su: fresh() }),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(["admin", "admin_manager"]).toContain(await col("who_billing"));
    expect((await audits("workspace.permissions_changed")) - a).toBeLessThanOrEqual(2);
    await reset();
  });

  it("K829-API-014 手順 1（DB に書く）の失敗：記録の書き込みが落ちると列も戻る・503・E-PAGE-003", async () => {
    await ready();
    await reset();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await failOn("audit_events", "new.action = 'workspace.permissions_changed'", async () => {
        const r = await patch(admin, { billing: "admin_manager" }, { su: fresh() });
        expect(r.status).toBe(503);
        expect((await json(r)).code).toBe("E-PAGE-003");
      });
    } finally {
      spy.mockRestore();
    }
    expect(await col("who_billing")).toBe("admin");
  });

  it("K829-API-015 DB の最後の砦：列に admin・admin_manager 以外を直に入れると check で断られる（口を通らない書き込みでも）", async () => {
    await ready();
    await expect(
      f.admin.query("update tenants set who_billing = 'everyone' where id = $1", [T.tenantId]),
    ).rejects.toThrow();
    await expect(
      f.admin.query("update tenants set who_delete_workspace = null where id = $1", [T.tenantId]),
    ).rejects.toThrow();
  });

  it("K829-API-016 消す手続き中でも変えられる（全員いつもどおり使える・D-154.5）", async () => {
    await ready();
    await reset();
    await f.admin.query("update tenants set deletion_requested_at = now() where id = $1", [T.tenantId]);
    try {
      expect((await patch(admin, { delete_workspace: "admin_manager" }, { su: fresh() })).status).toBe(200);
    } finally {
      await f.admin.query("update tenants set deletion_requested_at = null where id = $1", [T.tenantId]);
      await reset();
    }
  });
});
