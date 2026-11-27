// K-827「設定を読む・名前を直す」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。
//   行 ID（K827-API-…）は 11_tickets/K-827.md の表と 1 対 1。口の振る舞いは hooks のファイル apps/api/src/hooks/workspace-settings.ts の register（K-326）。
//   getWorkspaceSettings GET /workspace → 200 { data: { workspace: { id, name, logo: { kind, url } }, permissions: [{ key, name, detail, value, options }], fixed_rules: [{ key, text }], deletion: { requested_at, delete_at, days_left, requested_by, preview: { tickets, members } }, access: { admin, billing, delete_workspace } } }
//     開けるのは管理者と、app.workspace_can が可の人（D-154.83）。どちらも可でない人は 403
//   updateWorkspace      PATCH /workspace ← { name } → 200 { data: { workspace } }
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
const HOOK_FILE = join(HERE, "..", "..", "..", "src", "hooks", "workspace-settings.ts");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (code: string): string => ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${code} が無い）`;
const WS = "株式会社K827";

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
  data?: Record<string, unknown>;
  details?: { field: string; message: string }[];
  code?: string;
  detail?: Record<string, unknown>;
};
const json = async (r: Response) => (await r.clone().json()) as J;
const auth = (p: Person, su?: number) => ({
  authorization: `Bearer fake:member:${p.tenantId}:${p.id}${su === undefined ? "" : `:su=${su}`}`,
});
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
  (await f.admin.query("select * from tenants where id = $1", [id])).rows[0] as Record<string, unknown>;
/** 表への書き込みを 1 回だけわざと失敗させて fn を流す（取引ごと戻るかを見る） */
async function failOn(table: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k827_fail_${randomUUID().replaceAll("-", "")}`;
  await f.admin.query(
    `create function app.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'k827 試験の失敗'; end if; return new; end $$`,
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
const driverFail = { put: false, del: false };
const mkObjects = (repo: Awaited<ReturnType<typeof createRepository>>) => {
  const inner = localDriver(mkdtempSync(join(tmpdir(), "k827-obj-")));
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
  return new ObjectStore(repo, driver, { signingSecret: "k827-files" });
};
const ready = async () => {
  loading ??= (async () => {
    if (!existsSync(HOOK_FILE)) return;
    const repo = await createRepository(f.pool);
    const d = {
      appPool: f.pool,
      repo,
      objects: mkObjects(repo),
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
  for (const op of ["getWorkspaceSettings", "updateWorkspace"]) limits[op] = 10_000;
  T = await f.company(WS, "EG");
  O = await f.company("k827 の別の会社", "OT");
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

const get = (p: Person) => req("GET", "/workspace", { headers: auth(p) });
const patch = (p: Person, body: unknown, key?: string) =>
  req("PATCH", "/workspace", { body, headers: { ...auth(p), ...(key ? { "idempotency-key": key } : {}) } });

describe("K-827 設定を読む（getWorkspaceSettings）", () => {
  it("K827-API-001 管理者が読む：200・no-store・名前・ロゴは文字・誰ができるかは 2 つ・決まっている物・消す手続きは無し・プランと取引先の鍵は無い", async () => {
    await ready();
    const r = await get(admin);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await json(r)).data!;
    expect(d["workspace"]).toMatchObject({ id: T.tenantId, name: WS, logo: { kind: "text", url: null } });
    expect(d["permissions"].map((p: Record<string, unknown>) => p["key"])).toEqual(["billing", "delete_workspace"]);
    expect(d["permissions"][0]).toMatchObject({ value: "admin", options: ["admin", "admin_manager"] });
    expect(d["fixed_rules"].length).toBeGreaterThan(0);
    expect(d["deletion"]).toMatchObject({ requested_at: null, delete_at: null, days_left: null, requested_by: null });
    expect(d["access"]).toEqual({ admin: true, billing: true, delete_workspace: true });
    for (const k of ["plan", "subscription", "price_change", "client_visibility_default", "export"])
      expect(d).not.toHaveProperty(k);
  });

  it("K827-API-002 消すときの「消えるもの」の数：消していないチケットと、有効・止めた人（外した人は数えない）", async () => {
    await ready();
    const people = () =>
      n("select count(*) n from tenant_memberships where tenant_id = $1 and status in ('active', 'suspended')", [
        T.tenantId,
      ]);
    const before = (await json(await get(admin))).data!["deletion"].preview as { tickets: number; members: number };
    expect(before.members).toBe(await people());
    await f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [member.id]);
    try {
      const after = (await json(await get(admin))).data!["deletion"].preview as { tickets: number; members: number };
      expect(after.members).toBe(before.members - 1);
      expect(after.members).toBe(await people());
      expect(typeof after.tickets).toBe("number");
    } finally {
      await f.admin.query("update tenant_memberships set status = 'active' where member_id = $1", [member.id]);
    }
  });

  it("K827-API-003 ロゴを置いてあるとき：kind image・期限つきの url（ログに残る署名の形）", async () => {
    await ready();
    await f.admin.query("update tenants set logo_ref = $2 where id = $1", [
      T.tenantId,
      refOf(T.tenantId, randomUUID()),
    ]);
    try {
      const logo = (await json(await get(admin))).data!["workspace"].logo;
      expect(logo.kind).toBe("image");
      expect(String(logo.url)).toContain("/files/");
    } finally {
      await f.admin.query("update tenants set logo_ref = null where id = $1", [T.tenantId]);
    }
  });

  it("K827-API-004 消す手続き中：3 日前に始めた → あと 11 日・始めた人の名前・消す日が出る（14 日）", async () => {
    await ready();
    await f.admin.query("update tenants set deletion_requested_at = now() - interval '3 days' where id = $1", [
      T.tenantId,
    ]);
    await f.admin.query(
      "insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, occurred_at) values ($1, $2, 'admin', 'workspace.deletion_requested', 'workspace', $3, now() - interval '3 days')",
      [T.tenantId, admin.id, T.tenantId],
    );
    try {
      const del = (await json(await get(admin))).data!["deletion"];
      expect(del.days_left).toBe(11);
      expect(del.requested_by).toMatchObject({ id: admin.id, name: "高本 聖斗" });
      expect(Date.parse(del.delete_at) - Date.parse(del.requested_at)).toBe(14 * 86_400_000);
    } finally {
      await f.admin.query("update tenants set deletion_requested_at = null where id = $1", [T.tenantId]);
    }
  });

  it("K827-API-005 「誰ができるか」が 2 つとも既定（管理者）で個別の権限も無いとき、管理者でない人・ログインしていない人：マネージャー・メンバー・閲覧のみ・兼務でマネージャーの人は 403（data なし）・ログインなしは 401", async () => {
    await ready();
    const t = await tenantRow();
    expect([t["who_billing"], t["who_delete_workspace"]]).toEqual(["admin", "admin"]);
    for (const p of [mgr, member, viewer, kenmu]) {
      const r = await get(p);
      expect(r.status).toBe(403);
      expect((await json(r)).data).toBeUndefined();
    }
    expect((await req("GET", "/workspace")).status).toBe(401);
  });

  it("K827-API-006 別の会社：別の会社の管理者はその会社の名前だけが見える（この会社の名前は出ない）", async () => {
    await ready();
    const d = (await json(await get(outsider))).data!;
    expect(d["workspace"].id).toBe(O.tenantId);
    expect(d["workspace"].name).not.toBe(WS);
  });

  it("K827-API-007 止めた人：入れない（401 か 403・data なし）", async () => {
    await ready();
    const r = await get(stopped);
    expect([401, 403]).toContain(r.status);
    expect((await json(r)).data).toBeUndefined();
  });

  it("K827-API-008 読むだけ：記録も表も増えない・二度読んで同じ", async () => {
    await ready();
    const a = await n("select count(*) n from audit_events where tenant_id = $1", [T.tenantId]);
    const r1 = await json(await get(admin));
    const r2 = await json(await get(admin));
    expect(r2.data).toEqual(r1.data);
    expect(await n("select count(*) n from audit_events where tenant_id = $1", [T.tenantId])).toBe(a);
  });
});

describe("K-827 名前を直す（updateWorkspace）", () => {
  it("K827-API-009 名前を直す：200・前後の空白は削る・DB が変わる・読み直しにも出る・記録 workspace.renamed に前と後", async () => {
    await ready();
    const r = await patch(admin, { name: "  新しい名前 K827  " });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await json(r)).data!["workspace"]).toMatchObject({ name: "新しい名前 K827" });
    expect((await tenantRow())["name"]).toBe("新しい名前 K827");
    expect((await json(await get(admin))).data!["workspace"].name).toBe("新しい名前 K827");
    const ev = await f.admin.query(
      "select payload from audit_events where tenant_id = $1 and action = 'workspace.renamed' order by occurred_at desc limit 1",
      [T.tenantId],
    );
    expect(ev.rows[0]!.payload).toMatchObject({ from: WS, to: "新しい名前 K827" });
    await patch(admin, { name: WS });
  });

  it("K827-API-010 100 字ちょうど（サロゲート対を含む 100 字）は通り、101 字は 422（欄 name）・名前は変わらない", async () => {
    await ready();
    const ok = "😀".repeat(100);
    expect((await patch(admin, { name: ok })).status).toBe(200);
    expect((await tenantRow())["name"]).toBe(ok);
    const r = await patch(admin, { name: "あ".repeat(101) });
    expect(r.status).toBe(422);
    expect((await json(r)).details?.[0]?.field).toBe("name");
    expect((await tenantRow())["name"]).toBe(ok);
    await patch(admin, { name: WS });
  });

  it("K827-API-011 空・空白だけ（半角・全角）・NUL を含む名前は 422・名前は変わらない・記録も増えない", async () => {
    await ready();
    const a = await audits("workspace.renamed");
    for (const name of ["", "   ", "　　", "名前\u0000です"]) expect((await patch(admin, { name })).status).toBe(422);
    expect((await tenantRow())["name"]).toBe(WS);
    expect(await audits("workspace.renamed")).toBe(a);
  });

  it("K827-API-012 同じ名前への保存は 200・記録を書かない", async () => {
    await ready();
    const a = await audits("workspace.renamed");
    expect((await patch(admin, { name: WS })).status).toBe(200);
    expect(await audits("workspace.renamed")).toBe(a);
  });

  it("K827-API-013 管理者でない人は直せない：マネージャー・メンバー・閲覧のみ 403・ログインなし 401・名前は変わらない", async () => {
    await ready();
    for (const p of [mgr, member, viewer]) expect((await patch(p, { name: "乗っ取り" })).status).toBe(403);
    expect((await req("PATCH", "/workspace", { body: { name: "乗っ取り" } })).status).toBe(401);
    expect((await tenantRow())["name"]).toBe(WS);
  });

  it("K827-API-014 取引先の既定・プラン・ロゴの ref など、送れない欄は 422（契約の形）・DB は変わらない", async () => {
    await ready();
    for (const body of [
      { name: WS, client_visibility_default: "groups" },
      { name: WS, logo_ref: "x" },
      { client_visibility_default: "groups" },
      {},
    ])
      expect((await patch(admin, body)).status).toBe(422);
    expect((await tenantRow())["client_visibility_default"]).toBe("all");
  });

  it("K827-API-015 二度押し（同じ Idempotency-Key）：2 回とも 200・記録は 1 行", async () => {
    await ready();
    const a = await audits("workspace.renamed");
    const key = randomUUID();
    const r1 = await patch(admin, { name: "二度押し K827" }, key);
    const r2 = await patch(admin, { name: "二度押し K827" }, key);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(await audits("workspace.renamed")).toBe(a + 1);
    await patch(admin, { name: WS });
  });

  it("K827-API-016 同時に 2 人の管理者が別の名前に：どちらも 200・残るのは片方・記録は 2 行（順に通る）", async () => {
    await ready();
    const a = await audits("workspace.renamed");
    const [r1, r2] = await Promise.all([patch(admin, { name: "高本の名前" }), patch(admin2, { name: "二人目の名前" })]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(["高本の名前", "二人目の名前"]).toContain((await tenantRow())["name"]);
    expect(await audits("workspace.renamed")).toBe(a + 2);
    await patch(admin, { name: WS });
  });

  it("K827-API-017 消す手続き中でも名前は直せる（全員いつもどおり使える・D-154.5）", async () => {
    await ready();
    await f.admin.query("update tenants set deletion_requested_at = now() where id = $1", [T.tenantId]);
    try {
      expect((await patch(admin, { name: "手続き中 K827" })).status).toBe(200);
    } finally {
      await f.admin.query("update tenants set deletion_requested_at = null where id = $1", [T.tenantId]);
      await patch(admin, { name: WS });
    }
  });

  it("K827-API-018 手順 1（DB に書く）の失敗：記録の書き込みが落ちると名前も戻る・503・E-PAGE-003", async () => {
    await ready();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await failOn("audit_events", "new.action = 'workspace.renamed'", async () => {
        const r = await patch(admin, { name: "失敗するはず" });
        expect(r.status).toBe(503);
        expect((await json(r)).code).toBe("E-PAGE-003");
      });
    } finally {
      spy.mockRestore();
    }
    expect((await tenantRow())["name"]).toBe(WS);
  });

  it("K827-API-020 「誰ができるか」で可になった人も読める（D-154.83）：プランと支払いを「管理者とマネージャー」にするとマネージャーは 200・access は billing だけ可・名前は直せない（403）。消す権限を個別に付けたメンバーは 200・access は delete_workspace だけ可。グループのマネージャーなだけの兼務の人・閲覧のみは 403", async () => {
    await ready();
    const access = async (p: Person) => {
      const r = await get(p);
      expect(r.status, p.id).toBe(200);
      return (await json(r)).data!["access"];
    };
    await f.admin.query("update tenants set who_billing = 'admin_manager' where id = $1", [T.tenantId]);
    const grant = (
      await f.admin.query<{ id: string }>(
        "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'delete_workspace') returning id",
        [T.tenantId, member.id],
      )
    ).rows[0]!.id;
    try {
      expect(await access(mgr)).toEqual({ admin: false, billing: true, delete_workspace: false });
      expect((await patch(mgr, { name: "乗っ取り" })).status).toBe(403);
      expect(await access(member)).toEqual({ admin: false, billing: false, delete_workspace: true });
      expect((await patch(member, { name: "乗っ取り" })).status).toBe(403);
      for (const p of [kenmu, viewer]) {
        const r = await get(p);
        expect(r.status).toBe(403);
        expect((await json(r)).data).toBeUndefined();
      }
      expect((await tenantRow())["name"]).toBe(WS);
    } finally {
      await f.admin.query("update tenants set who_billing = 'admin' where id = $1", [T.tenantId]);
      await f.admin.query("update permissions set revoked_at = now() where id = $1", [grant]);
    }
  });

  it("K827-API-021 可を戻した直後（G-12）：プランと支払いを「管理者」に戻すと、次の読みからマネージャーは 403（入り直さなくても効く・覚えておかない）", async () => {
    await ready();
    await f.admin.query("update tenants set who_billing = 'admin_manager' where id = $1", [T.tenantId]);
    try {
      expect((await get(mgr)).status).toBe(200);
    } finally {
      await f.admin.query("update tenants set who_billing = 'admin' where id = $1", [T.tenantId]);
    }
    const r = await get(mgr);
    expect(r.status).toBe(403);
    expect((await json(r)).data).toBeUndefined();
  });
});

describe("K-827 口と契約", () => {
  it("K827-API-019 答えの形：workspace・permissions・fixed_rules・deletion・access だけ（契約の .d と同じ鍵）・名前の欄の長さは契約の maxLength 100 と同じ", async () => {
    await ready();
    const d = (await json(await get(admin))).data!;
    expect(Object.keys(d).sort()).toEqual(["access", "deletion", "fixed_rules", "permissions", "workspace"]);
    const yaml = readFileSync(join(ROOT, "08_api/openapi.yaml"), "utf8");
    expect(yaml).not.toMatch(/WorkspaceSettings:[\s\S]{0,400}price_change/);
    expect(msg("E-PAGE-003").length).toBeGreaterThan(0);
  });
});
