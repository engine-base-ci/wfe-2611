// K-828「ロゴを変える」の口の試験（本物の DB・置き場は本物のローカルの置き場を包んだ偽（置けない・消せないを 1 回ずつ起こせる）・口の入口は createApp と契約の op・偽の画面のログイン）。
//   行 ID（K828-API-…）は 11_tickets/K-828.md の表と 1 対 1。口の振る舞いは hooks のファイル apps/api/src/hooks/workspace-logo.ts の register（K-326）。
//   uploadWorkspaceLogo POST /workspace/logo（multipart・欄 file・契約の入口の multipart の道を通る）→ 201 { data: { logo: { kind: "image", url } } }
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
const HOOK_FILE = join(HERE, "..", "..", "..", "src", "hooks", "workspace-logo.ts");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (code: string): string => ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${code} が無い）`;
const WS = "株式会社K828";

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
  data?: Record<string, unknown> & { workspace: { logo: { kind: unknown } } };
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
  const name = `k828_fail_${randomUUID().replaceAll("-", "")}`;
  await f.admin.query(
    `create function app.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'k828 試験の失敗'; end if; return new; end $$`,
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
  const inner = localDriver(mkdtempSync(join(tmpdir(), "k828-obj-")));
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
  return new ObjectStore(repo, driver, { signingSecret: "k828-files" });
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
  for (const op of ["uploadWorkspaceLogo"]) limits[op] = 10_000;
  T = await f.company(WS, "EG");
  O = await f.company("k828 の別の会社", "OT");
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

const MB2 = 2 * 1024 * 1024;
/** 中身の先頭の印が合う画像（size バイトちょうど） */
const img = (kind: "png" | "jpeg" | "webp" | "gif", size = 1024): Uint8Array => {
  const head: Record<string, number[]> = {
    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    jpeg: [0xff, 0xd8, 0xff, 0xe0],
    webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  };
  const b = new Uint8Array(size);
  b.set(head[kind]!);
  return b;
};
const ctxOf = (p: Person): TenantContext => ({ tenantId: p.tenantId, userId: p.id, role: "member", stepUpAt: null });
const form = (bytes: Uint8Array | string | null, type = "image/png", name = "logo.png") => {
  const fd = new FormData();
  if (bytes !== null) fd.set("file", new File([bytes], name, { type }));
  return fd;
};
const up = (p: Person, fd: FormData, key?: string) =>
  req("POST", "/workspace/logo", { raw: fd, headers: { ...auth(p), ...(key ? { "idempotency-key": key } : {}) } });
const logoRef = async (id = T.tenantId) => (await tenantRow(id))["logo_ref"] as string | null;
const reset = async () => f.admin.query("update tenants set logo_ref = null where id = $1", [T.tenantId]);

describe("K-828 ロゴを変える（uploadWorkspaceLogo）", () => {
  it("K828-API-001 PNG を置く：201・logo は image と期限つきの url・logo_ref が自分の会社の ref になり実体が置かれる・記録 workspace.logo_changed が 1 行・設定を読み直しても image", async () => {
    await ready();
    await reset();
    const r = await up(admin, form(img("png")));
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await json(r)).data!["logo"]).toMatchObject({ kind: "image" });
    const ref = (await logoRef())!;
    expect(ref).toContain(T.tenantId);
    expect((await store.get(ctxOf(admin), ref)).status).toBe("done");
    expect(await audits("workspace.logo_changed")).toBeGreaterThanOrEqual(1);
    const s = await req("GET", "/workspace", { headers: auth(admin) });
    expect((await json(s)).data!["workspace"].logo.kind).toBe("image");
  });

  it("K828-API-002 JPEG・WebP も置ける（中身の先頭の印で見る）", async () => {
    await ready();
    for (const [kind, type] of [
      ["jpeg", "image/jpeg"],
      ["webp", "image/webp"],
    ] as const) {
      const r = await up(admin, form(img(kind), type, `logo.${kind}`));
      expect(r.status, kind).toBe(201);
    }
  });

  it("K828-API-003 大きさ：2 MB ちょうどは 201・2 MB + 1 バイトは 413・E-WS-010（ロゴは 2 MB まで）・ロゴは変わらない", async () => {
    await ready();
    expect((await up(admin, form(img("png", MB2)))).status).toBe(201);
    const keep = await logoRef();
    const r = await up(admin, form(img("png", MB2 + 1)));
    expect(r.status).toBe(413);
    expect((await json(r)).code).toBe("E-WS-010");
    expect(await logoRef()).toBe(keep);
    expect(msg("E-WS-010")).toContain("2 MB");
  });

  it("K828-API-004 種類が違う：中身が画像でない（名前と content-type だけ png）・SVG・GIF・空のファイルは 422・E-WS-011・ロゴは変わらない", async () => {
    await ready();
    const keep = await logoRef();
    const cases: [Uint8Array | string, string, string][] = [
      ["これは画像ではありません", "image/png", "a.png"],
      ['<svg xmlns="http://www.w3.org/2000/svg"/>', "image/svg+xml", "a.svg"],
      [img("gif"), "image/gif", "a.gif"],
      [new Uint8Array(0), "image/png", "empty.png"],
    ];
    for (const [b, t, nm] of cases) {
      const r = await up(admin, form(b, t, nm));
      expect(r.status, nm).toBe(422);
      expect((await json(r)).code, nm).toBe("E-WS-011");
    }
    expect(await logoRef()).toBe(keep);
  });

  it("K828-API-005 content-type が嘘でも中身が PNG なら通る（content-type は信じない）", async () => {
    await ready();
    expect((await up(admin, form(img("png"), "text/plain", "x.txt"))).status).toBe(201);
  });

  it("K828-API-006 file の欄が無い体は 422（欄 file）", async () => {
    await ready();
    const r = await up(admin, form(null));
    expect(r.status).toBe(422);
    expect((await json(r)).details?.[0]?.field).toBe("file");
  });

  it("K828-API-007 置き換え：前の実体が置き場から消え、新しい ref になる", async () => {
    await ready();
    await up(admin, form(img("png")));
    const old = (await logoRef())!;
    expect((await up(admin, form(img("jpeg"), "image/jpeg", "b.jpg"))).status).toBe(201);
    const now = (await logoRef())!;
    expect(now).not.toBe(old);
    expect((await store.get(ctxOf(admin), old)).status).not.toBe("done");
    expect((await store.get(ctxOf(admin), now)).status).toBe("done");
  });

  it("K828-API-008 手順 1（置き場に置く）の失敗：502・E-WS-012・logo_ref は前のまま・前の実体は残る・記録は増えない", async () => {
    await ready();
    await up(admin, form(img("png")));
    const keep = (await logoRef())!;
    const a = await audits("workspace.logo_changed");
    driverFail.put = true;
    try {
      const r = await up(admin, form(img("png")));
      expect(r.status).toBe(502);
      expect((await json(r)).code).toBe("E-WS-012");
    } finally {
      driverFail.put = false;
    }
    expect(await logoRef()).toBe(keep);
    expect((await store.get(ctxOf(admin), keep)).status).toBe("done");
    expect(await audits("workspace.logo_changed")).toBe(a);
  });

  it("K828-API-009 手順 2（DB に書く）の失敗：503・E-PAGE-003・logo_ref は前のまま・先に置いた新しい実体は消す", async () => {
    await ready();
    await up(admin, form(img("png")));
    const keep = await logoRef();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await failOn("audit_events", "new.action = 'workspace.logo_changed'", async () => {
        const r = await up(admin, form(img("webp"), "image/webp", "c.webp"));
        expect(r.status).toBe(503);
        expect((await json(r)).code).toBe("E-PAGE-003");
      });
    } finally {
      spy.mockRestore();
    }
    expect(await logoRef()).toBe(keep);
  });

  it("K828-API-010 手順 3（前の実体を消す後片付け）の失敗 [残る]：201 のまま・新しい ref・ログに 1 行・前の実体は残る（次の置き換えで消える）", async () => {
    await ready();
    await up(admin, form(img("png")));
    const old = (await logoRef())!;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    driverFail.del = true;
    try {
      const r = await up(admin, form(img("jpeg"), "image/jpeg", "d.jpg"));
      expect(r.status).toBe(201);
    } finally {
      driverFail.del = false;
    }
    const lines = spy.mock.calls.map((c) => String(c[0]));
    spy.mockRestore();
    expect(lines.filter((l) => l.includes("[workspace-logo]")).length).toBe(1);
    expect(await logoRef()).not.toBe(old);
    expect((await store.get(ctxOf(admin), old)).status).toBe("done");
  });

  it("K828-API-011 管理者でない人は置けない：マネージャー・メンバー・閲覧のみ・兼務のマネージャー 403・ログインなし 401・ロゴは変わらない", async () => {
    await ready();
    await reset();
    for (const p of [mgr, member, viewer, kenmu]) expect((await up(p, form(img("png")))).status).toBe(403);
    expect((await req("POST", "/workspace/logo", { raw: form(img("png")) })).status).toBe(401);
    expect(await logoRef()).toBeNull();
  });

  it("K828-API-012 別の会社の管理者が置いても、この会社のロゴは変わらない・止めた人は置けない", async () => {
    await ready();
    await reset();
    expect((await up(outsider, form(img("png")))).status).toBe(201);
    expect(await logoRef()).toBeNull();
    expect(await logoRef(O.tenantId)).toContain(O.tenantId);
    const r = await up(stopped, form(img("png")));
    expect([401, 403]).toContain(r.status);
  });

  it("K828-API-013 二度押し（同じ Idempotency-Key）：2 回とも 201・同じ答え・記録は 1 行", async () => {
    await ready();
    const a = await audits("workspace.logo_changed");
    const key = randomUUID();
    const fd1 = form(img("png"));
    const r1 = await up(admin, fd1, key);
    const r2 = await up(admin, form(img("png")), key);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect((await json(r2)).data).toEqual((await json(r1)).data);
    expect(await audits("workspace.logo_changed")).toBe(a + 1);
  });

  it("K828-API-014 同時に 2 人の管理者が置く：どちらも 201・残るのは片方の ref・実体は 1 つだけ残る", async () => {
    await ready();
    await reset();
    const [r1, r2] = await Promise.all([
      up(admin, form(img("png"))),
      up(admin2, form(img("jpeg"), "image/jpeg", "e.jpg")),
    ]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    const now = (await logoRef())!;
    expect((await store.get(ctxOf(admin), now)).status).toBe("done");
  });

  it("K828-API-015 入口の multipart の道：JSON の体は 422（欄 body）・体が 2 MB ＋ 64 KB を超えると 413・E-WS-010・ほかの JSON の口（PATCH /workspace）は今までどおり 1 MB を超えると 413・PAYLOAD_TOO_LARGE・ロゴは変わらない", async () => {
    await ready();
    const keep = await logoRef();
    const asJson = await req("POST", "/workspace/logo", { body: { file: "logo.png" }, headers: auth(admin) });
    expect(asJson.status).toBe(422);
    expect((await json(asJson)).details?.[0]?.field).toBe("body");
    const huge = await up(admin, form(img("png", MB2 + 128 * 1024)));
    expect(huge.status).toBe(413);
    expect((await json(huge)).code).toBe("E-WS-010");
    const other = await req("PATCH", "/workspace", {
      raw: JSON.stringify({ name: "あ".repeat(400_000) }),
      headers: { ...auth(admin), "content-type": "application/json" },
    });
    expect(other.status).toBe(413);
    expect((await json(other)).code).toBe("PAYLOAD_TOO_LARGE");
    expect(await logoRef()).toBe(keep);
  });
});
