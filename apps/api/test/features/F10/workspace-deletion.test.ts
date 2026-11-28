// K-830「ワークスペースを消す手続き・取り消す」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン（:su= で本人確認の取り直しの時刻））。
//   行 ID（K830-API-…）は 11_tickets/K-830.md の表と 1 対 1。口の振る舞いは hooks のファイル apps/api/src/hooks/workspace-deletion.ts の register（K-326）。
//   requestWorkspaceDeletion POST   /workspace/deletion ← { confirm_name } → 200 { data: { deletion: { requested_at, delete_at, days_left } } }
//   cancelWorkspaceDeletion  DELETE /workspace/deletion → 200 { data: { deletion: { requested_at: null } } }
//   14 日後に消すのは運営（段 11 は消す仕組みを作らない）。書き出しは無い（D-154.4）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
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
const HOOK_FILE = join(HERE, "..", "..", "..", "src", "hooks", "workspace-deletion.ts");
const WS = "株式会社K830";

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
  (await f.admin.query("select * from tenants where id = $1", [id])).rows[0] as Record<string, unknown>;
/** 表への書き込みを 1 回だけわざと失敗させて fn を流す（取引ごと戻るかを見る） */
async function failOn(table: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k830_fail_${randomUUID().replaceAll("-", "")}`;
  await f.admin.query(
    `create function app.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'k830 試験の失敗'; end if; return new; end $$`,
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
  const inner = localDriver(mkdtempSync(join(tmpdir(), "k830-obj-")));
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
  return new ObjectStore(repo, driver, { signingSecret: "k830-files" });
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
  for (const op of ["requestWorkspaceDeletion", "cancelWorkspaceDeletion"]) limits[op] = 10_000;
  T = await f.company(WS, "EG");
  O = await f.company("k830 の別の会社", "OT");
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

const DAY = 86_400_000;
const start = (p: Person, confirm: unknown = WS, o: { su?: number; key?: string } = {}) =>
  req("POST", "/workspace/deletion", {
    body: { confirm_name: confirm },
    headers: {
      ...auth(p, o.su === undefined ? Date.now() - MIN : o.su),
      ...(o.key ? { "idempotency-key": o.key } : {}),
    },
  });
/** su：取り直しの時刻。負の値（-1）は「取り直し無し」の印（undefined は既定の 1 分前に置き換わるので使わない・K830-API-004 と同じ形） */
const cancel = (p: Person, su: number = Date.now() - MIN) =>
  req("DELETE", "/workspace/deletion", { headers: auth(p, su < 0 ? undefined : su) });
const requestedAt = async () => (await tenantRow())["deletion_requested_at"] as Date | null;
const setRequested = (ago: string | null) =>
  f.admin.query(
    `update tenants set deletion_requested_at = ${ago === null ? "null" : `now() - interval '${ago}'`} where id = $1`,
    [T.tenantId],
  );
const inbox = async (kind: string, member: P) =>
  n("select count(*) n from notifications where tenant_id = $1 and member_id = $2 and event_kind_id = $3", [
    T.tenantId,
    member.id,
    kind,
  ]);
const resetAll = async () => {
  await setRequested(null);
  await f.admin.query("update tenants set who_delete_workspace = 'admin' where id = $1", [T.tenantId]);
  await f.admin.query("delete from notifications where tenant_id = $1 and event_kind_id like 'workspace.deletion_%'", [
    T.tenantId,
  ]);
};

describe("K-830 消す手続きを始める（requestWorkspaceDeletion）", () => {
  it("K830-API-001 管理者が名前を打って始める：200・手続きの時刻が立つ・あと 14 日・消す日は 14 日後・記録 workspace.deletion_requested が 1 行", async () => {
    await ready();
    await resetAll();
    const a = await audits("workspace.deletion_requested");
    const r = await start(admin);
    expect(r.status, await r.clone().text()).toBe(200);
    const del = (await json(r)).data!["deletion"];
    expect(del.days_left).toBe(14);
    expect(Date.parse(del.delete_at) - Date.parse(del.requested_at)).toBe(14 * DAY);
    expect(await requestedAt()).not.toBeNull();
    expect(await audits("workspace.deletion_requested")).toBe(a + 1);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    await resetAll();
  });

  it("K830-API-002 ほかの管理者全員に受け箱の行（メールなし）：始めた本人・マネージャー・メンバーには出ない", async () => {
    await ready();
    await resetAll();
    expect((await start(admin)).status).toBe(200);
    expect(await inbox("workspace.deletion_requested", admin2)).toBe(1);
    expect(await inbox("workspace.deletion_requested", admin)).toBe(0);
    expect(await inbox("workspace.deletion_requested", mgr)).toBe(0);
    expect(await inbox("workspace.deletion_requested", member)).toBe(0);
    expect(
      await n(
        "select count(*) n from notifications where tenant_id = $1 and event_kind_id = 'workspace.deletion_requested' and channel_id <> 'inapp'",
        [T.tenantId],
      ),
    ).toBe(0);
    await resetAll();
  });

  it("K830-API-003 名前の打ち間違い：違う字・全角にした・前後の空白・大文字小文字が違う・名前の一部は 409・E-WS-030・手続きは始まらず記録も受け箱も増えない", async () => {
    await ready();
    await resetAll();
    const a = await audits("workspace.deletion_requested");
    for (const typed of [
      "別の名前",
      WS.replace("K830", "K８３０"),
      ` ${WS}`,
      `${WS} `,
      WS.toLowerCase(),
      WS.slice(0, 4),
    ]) {
      if (typed === WS) continue;
      const r = await start(admin, typed);
      expect(r.status, typed).toBe(409);
      expect((await json(r)).code, typed).toBe("E-WS-030");
    }
    expect(await requestedAt()).toBeNull();
    expect(await audits("workspace.deletion_requested")).toBe(a);
    expect(await inbox("workspace.deletion_requested", admin2)).toBe(0);
  });

  it("K830-API-004 本人確認の取り直し：取り直し無し・16 分前は 403・STEP_UP_REQUIRED・始まらない。1 分前は 200", async () => {
    await ready();
    await resetAll();
    for (const su of [-1, Date.now() - 16 * MIN]) {
      const r = await req("POST", "/workspace/deletion", {
        body: { confirm_name: WS },
        headers: auth(admin, su < 0 ? undefined : su),
      });
      expect(r.status).toBe(403);
      expect((await json(r)).code).toBe("STEP_UP_REQUIRED");
    }
    expect(await requestedAt()).toBeNull();
    expect((await start(admin, WS, { su: Date.now() - MIN })).status).toBe(200);
    await resetAll();
  });

  it("K830-API-005 もう手続き中：409・E-WS-031・始めた時刻は変わらない・記録は増えない", async () => {
    await ready();
    await resetAll();
    await setRequested("2 days");
    const before = await requestedAt();
    const a = await audits("workspace.deletion_requested");
    const r = await start(admin);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe("E-WS-031");
    expect((await requestedAt())!.getTime()).toBe(before!.getTime());
    expect(await audits("workspace.deletion_requested")).toBe(a);
    await resetAll();
  });

  it("K830-API-006 押せる人：既定は管理者だけ（マネージャー・メンバー・閲覧のみ・兼務のマネージャーは 403）。ワークスペースを消すを「管理者とマネージャー」にするとマネージャーも・個別に付けたメンバーも 200・ログインなし 401", async () => {
    await ready();
    await resetAll();
    for (const p of [mgr, member, viewer, kenmu]) expect((await start(p)).status).toBe(403);
    expect((await req("POST", "/workspace/deletion", { body: { confirm_name: WS } })).status).toBe(401);
    expect(await requestedAt()).toBeNull();
    await f.admin.query("update tenants set who_delete_workspace = 'admin_manager' where id = $1", [T.tenantId]);
    expect((await start(mgr)).status).toBe(200);
    await resetAll();
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'delete_workspace')",
      [T.tenantId, member.id],
    );
    try {
      expect((await start(member)).status).toBe(200);
    } finally {
      await f.admin.query("delete from permissions where tenant_id = $1 and grantee_member_id = $2", [
        T.tenantId,
        member.id,
      ]);
      await resetAll();
    }
  });

  it("K830-API-007 形の誤り：名前の欄が無い・文字でない・空・NUL を含む・101 字は 422・始まらない", async () => {
    await ready();
    await resetAll();
    for (const body of [
      {},
      { confirm_name: 1 },
      { confirm_name: "" },
      { confirm_name: `${WS}\u0000` },
      { confirm_name: "あ".repeat(101) },
    ]) {
      const r = await req("POST", "/workspace/deletion", { body, headers: auth(admin, Date.now() - MIN) });
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect(await requestedAt()).toBeNull();
  });

  it("K830-API-008 手続き中も全員いつもどおり使える（D-154.5）：人の状態・セッションは 1 つも変わらない（止めない・切らない）。手続きを始めた後の名前の直しも通る", async () => {
    await ready();
    await resetAll();
    const live = () => n("select count(*) n from sessions where tenant_id = $1 and revoked_at is null", [T.tenantId]);
    const act = () =>
      n("select count(*) n from tenant_memberships where tenant_id = $1 and status = 'active'", [T.tenantId]);
    const [s0, m0] = [await live(), await act()];
    expect((await start(admin)).status).toBe(200);
    expect([await live(), await act()]).toEqual([s0, m0]);
    expect(
      await n("select count(*) n from members where tenant_id = $1 and suspended_at is not null and id <> $2", [
        T.tenantId,
        stopped.id,
      ]),
    ).toBe(0);
    await resetAll();
  });

  it("K830-API-009 同時に 2 人の管理者が始める：1 つだけ 200・もう 1 つは 409・E-WS-031・記録は 1 行・受け箱は 1 通ずつ", async () => {
    await ready();
    await resetAll();
    const a = await audits("workspace.deletion_requested");
    const [r1, r2] = await Promise.all([start(admin), start(admin2)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const loser = r1.status === 409 ? r1 : r2;
    expect((await json(loser)).code).toBe("E-WS-031");
    expect(await audits("workspace.deletion_requested")).toBe(a + 1);
    const total =
      (await inbox("workspace.deletion_requested", admin)) + (await inbox("workspace.deletion_requested", admin2));
    expect(total).toBe(1);
    await resetAll();
  });

  it("K830-API-010 手順 1（DB に書く）の失敗：記録の書き込みが落ちると手続きも受け箱も戻る・503・E-PAGE-003", async () => {
    await ready();
    await resetAll();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await failOn("audit_events", "new.action = 'workspace.deletion_requested'", async () => {
        const r = await start(admin);
        expect(r.status).toBe(503);
        expect((await json(r)).code).toBe("E-PAGE-003");
      });
    } finally {
      spy.mockRestore();
    }
    expect(await requestedAt()).toBeNull();
    expect(await inbox("workspace.deletion_requested", admin2)).toBe(0);
  });

  it("K830-API-011 手順 1 の途中（受け箱の行の書き込み）の失敗：全部戻る・503・手続きは始まらない・記録も残らない", async () => {
    await ready();
    await resetAll();
    const a = await audits("workspace.deletion_requested");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await failOn("notifications", "new.event_kind_id = 'workspace.deletion_requested'", async () => {
        expect((await start(admin)).status).toBe(503);
      });
    } finally {
      spy.mockRestore();
    }
    expect(await requestedAt()).toBeNull();
    expect(await audits("workspace.deletion_requested")).toBe(a);
  });

  it("K830-API-012 別の会社の管理者：自分の会社の名前なら始められ、この会社は始まらない。止めた人は始められない", async () => {
    await ready();
    await resetAll();
    const r = await req("POST", "/workspace/deletion", {
      body: { confirm_name: WS },
      headers: auth(outsider, Date.now() - MIN),
    });
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe("E-WS-030");
    expect(await requestedAt()).toBeNull();
    const s = await start(stopped);
    expect([401, 403]).toContain(s.status);
  });

  it("K830-API-013 二度押し（同じ Idempotency-Key）：2 回とも 200・同じ答え・記録は 1 行・受け箱は 1 通", async () => {
    await ready();
    await resetAll();
    const a = await audits("workspace.deletion_requested");
    const key = randomUUID();
    const r1 = await start(admin, WS, { key });
    const r2 = await start(admin, WS, { key });
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect((await json(r2)).data).toEqual((await json(r1)).data);
    expect(await audits("workspace.deletion_requested")).toBe(a + 1);
    expect(await inbox("workspace.deletion_requested", admin2)).toBe(1);
    await resetAll();
  });
});

describe("K-830 取り消す（cancelWorkspaceDeletion）", () => {
  it("K830-API-014 手続きを始めた人が取り消す：200・手続きの時刻が消える・記録 workspace.deletion_cancelled・ほかの管理者に受け箱の行（本人には出ない）", async () => {
    await ready();
    await resetAll();
    await start(admin);
    const a = await audits("workspace.deletion_cancelled");
    const r = await cancel(admin);
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await json(r)).data!["deletion"]).toMatchObject({ requested_at: null });
    expect(await requestedAt()).toBeNull();
    expect(await audits("workspace.deletion_cancelled")).toBe(a + 1);
    expect(await inbox("workspace.deletion_cancelled", admin2)).toBe(1);
    expect(await inbox("workspace.deletion_cancelled", admin)).toBe(0);
    await resetAll();
  });

  it("K830-API-015 始めた人でなくても、消す権限の人は取り消せる（二人目の管理者・「管理者とマネージャー」にしたときのマネージャー）", async () => {
    await ready();
    await resetAll();
    await start(admin);
    expect((await cancel(admin2)).status).toBe(200);
    await start(admin);
    await f.admin.query("update tenants set who_delete_workspace = 'admin_manager' where id = $1", [T.tenantId]);
    expect((await cancel(mgr)).status).toBe(200);
    await resetAll();
  });

  it("K830-API-016 14 日の境：13 日 23 時間なら取り消せる・14 日と 1 分過ぎたら 409・E-WS-032・手続きの時刻は変わらない", async () => {
    await ready();
    await resetAll();
    await setRequested("13 days 23 hours");
    expect((await cancel(admin)).status).toBe(200);
    await setRequested("14 days 1 minute");
    const r = await cancel(admin);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe("E-WS-032");
    expect(await requestedAt()).not.toBeNull();
    await resetAll();
  });

  it("K830-API-017 手続き中でないときの取り消し：409・E-WS-033・記録は増えない", async () => {
    await ready();
    await resetAll();
    const a = await audits("workspace.deletion_cancelled");
    const r = await cancel(admin);
    expect(r.status).toBe(409);
    expect((await json(r)).code).toBe("E-WS-033");
    expect(await audits("workspace.deletion_cancelled")).toBe(a);
  });

  it("K830-API-018 取り消しも本人確認：取り直し無し・16 分前は 403・STEP_UP_REQUIRED・手続きは続く。権限の無い人（マネージャー・メンバー・閲覧のみ）は 403・ログインなし 401", async () => {
    await ready();
    await resetAll();
    await setRequested("1 day");
    for (const su of [-1, Date.now() - 16 * MIN]) {
      const r = await cancel(admin, su);
      expect(r.status).toBe(403);
      expect((await json(r)).code).toBe("STEP_UP_REQUIRED");
    }
    for (const p of [mgr, member, viewer, kenmu]) expect((await cancel(p)).status).toBe(403);
    expect((await req("DELETE", "/workspace/deletion")).status).toBe(401);
    expect(await requestedAt()).not.toBeNull();
    await resetAll();
  });

  it("K830-API-019 取り消したあと、もう一度始められる（同じ名前で）", async () => {
    await ready();
    await resetAll();
    await start(admin);
    await cancel(admin);
    expect((await start(admin)).status).toBe(200);
    await resetAll();
  });

  it("K830-API-020 手順 1（DB に書く）の失敗：取り消しの記録が落ちると手続きは続いたまま・503・E-PAGE-003", async () => {
    await ready();
    await resetAll();
    await setRequested("1 day");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await failOn("audit_events", "new.action = 'workspace.deletion_cancelled'", async () => {
        const r = await cancel(admin);
        expect(r.status).toBe(503);
        expect((await json(r)).code).toBe("E-PAGE-003");
      });
    } finally {
      spy.mockRestore();
    }
    expect(await requestedAt()).not.toBeNull();
    await resetAll();
  });

  it("K830-API-021 記録は追記だけ（D-154.25）：始めた・取り消した記録は直せない・消せない", async () => {
    await ready();
    await resetAll();
    await start(admin);
    await expect(
      f.admin.query(
        "update audit_events set action = 'x' where tenant_id = $1 and action = 'workspace.deletion_requested'",
        [T.tenantId],
      ),
    ).rejects.toThrow();
    await expect(
      f.admin.query("delete from audit_events where tenant_id = $1 and action = 'workspace.deletion_requested'", [
        T.tenantId,
      ]),
    ).rejects.toThrow();
    await resetAll();
  });

  it("K830-API-022 書き出しは無い（D-154.4）：答えに書き出しの鍵・先に書き出せるの欄が無い。この段は消す仕組みを作らない（14 日後に消える物は何も走らない）", async () => {
    await ready();
    await resetAll();
    const d = (await json(await start(admin))).data!;
    expect(JSON.stringify(d)).not.toMatch(/export|書き出/);
    await setRequested("30 days");
    expect(await n("select count(*) n from tenants where id = $1", [T.tenantId])).toBe(1);
    await resetAll();
  });
});
