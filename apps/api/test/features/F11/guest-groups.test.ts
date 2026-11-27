// K-876「ゲストのグループの置き場：ゲストのグループの表・作る口（名前と依頼が届く社内のグループ）・ゲスト（役割 requester の人）がどのグループに入るか・
//   既にあるグループの一覧を読む口・招待にゲストのグループを持たせる（招待は依頼の届け先を持たない）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン・メールは試験の偽）。
//   行 ID（K876-API-…）は 11_tickets/K-876.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイルの register（K-326）：apps/api/src/hooks/workspace-invitations.ts（K-419・K-876 が直す）・
//   apps/api/src/hooks/workspace-invitation-link.ts（K-421・段 9・直さない）・apps/api/src/hooks/guest-groups.ts（K-876 が作る）。
// 試験が決める形（契約は 05_flow/screen_api.d/K-419.py（直す）と K-876.py（足す）で書く）:
//   createGuestGroup   POST /guest-groups ← { name（前後の空白を取って 1〜80 字）, request_scope_id（依頼が届く社内のグループ）}
//                      → 201 { data: { group: { id, name, request_scope: { id, name } } } }
//   createInvitations  POST /invitations ← { emails, role_key（"requester" が足される）, message?,
//                                            scope_id?（requester 以外は要る・requester は持てない）, guest_group_id?（requester は要る・ほかは持てない）}
//                      → 201 { data: { invitations: [{ id, email, expires_at, mail }] } }（前と同じ形）。招待は依頼の届け先を持たない
//   listGuestGroups    GET /guest-groups → 200 { data: { groups: [{ id, name, request_scope: { id, name } | null, guests: [{ id, name, email, suspended }],
//                                                                   invitations: [{ id, email, left_days }] }] } }
//     名前の順。消したグループ・別の会社のグループ・抜けたゲストは出ない。members の view か invite を持つ人（社内の人）だけ
// DB（migration 20261127093600_guest_groups.sql）:
//   guest_groups（name・name_key＝表記ゆらぎをそろえた鍵・消していない物は会社の中で一意・request_scope_id＝依頼が届く社内のグループ）・
//   guest_group_members（1 人は 1 つのグループ）・invitations.guest_group_id（役割 requester の招待だけ）・
//   招待が受けられたとき（accepted_member_id）にグループへ入れる引き金・app.invitation_preview2 は requester の招待にゲストのグループの名前を返す・
//   app.workspace_members はゲストを出さない
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateAuth } from "@kaname/auth/migrate";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { createRepository } from "@kaname/db/repository";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const HOOKS = join(HERE, "..", "..", "..", "src", "hooks");
const HOOK_FILES = ["workspace-invitations.ts", "workspace-invitation-link.ts", "guest-groups.ts"].map((n) =>
  join(HOOKS, n),
);
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (code: string): string => ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${code} が無い）`;
const WS = "株式会社K876";
const NOTE = "先月の見積の件でお願いします";
const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

let f: Fixture;
let app: ReturnType<typeof createApp>;
const hooks: Record<string, Hook> = {};
const limits: Record<string, number> = {};
const mails: { to: string; subject: string; text: string }[] = [];
const failMailTo = new Set<string>();
let loading: Promise<void> | null = null;
let T: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let JD: string;
type P = Person & { email: string; authUserId: string };
let admin: P, mgr: P, member: P, inviter: P, outsider: P;

type J = Record<string, unknown> & {
  data?: Record<string, unknown>;
  details?: { field: string; message: string; email?: string; code?: string }[];
};
const json = async (r: Response) => (await r.clone().json()) as J;
const as = (p: Person, role: "member" | "client" = "member") => ({
  authorization: `Bearer fake:${role}:${p.tenantId}:${p.id}`,
});
const req = (method: string, path: string, o: { body?: unknown; headers?: Record<string, string> } = {}) =>
  Promise.resolve(
    app.request(`http://localhost/api/v1${path}`, {
      method,
      headers: { "content-type": "application/json", "x-forwarded-for": nextIp(), ...(o.headers ?? {}) },
      ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
    }),
  );
const ready = async () => {
  loading ??= (async () => {
    const d = {
      appPool: f.pool,
      repo: await createRepository(f.pool),
      mailer: async (m: { to: string; subject: string; text: string }) => {
        if (failMailTo.has(m.to)) throw new Error("送れなかった（試験）");
        mails.push(m);
      },
      config: { env: "test", webBaseUrl: "http://localhost:3000", opsEmail: "ops@example.com" },
    } as unknown as HookDeps;
    for (const file of HOOK_FILES)
      if (existsSync(file)) Object.assign(hooks, ((await import(file)) as { register: HookModule }).register.make(d));
  })();
  await loading;
};
const fresh = (tag: string) => `${tag}-${randomUUID().slice(0, 8)}@guest.example`;
const invite = (p: Person, body: Record<string, unknown>) => req("POST", "/invitations", { body, headers: as(p) });
/** ゲストとして招く体（既にあるグループを選ぶ。招待は依頼の届け先 scope_id を持たない） */
const base = (emails: string[], g: string, o: Record<string, unknown> = {}) => ({
  emails,
  role_key: "requester",
  message: NOTE,
  guest_group_id: g,
  ...o,
});
const mkGroup = (p: Person, body: Record<string, unknown>) => req("POST", "/guest-groups", { body, headers: as(p) });
const n = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const one = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
  (await f.admin.query(sql, p)).rows[0] as R;
const ctxOf = (p: Person): TenantContext => ({ tenantId: p.tenantId, userId: p.id, role: "member", stepUpAt: null });
const asApp = async (p: Person, sql: string, params: unknown[] = []): Promise<number | "denied"> => {
  try {
    return await withTenant(f.pool, ctxOf(p), async (cl) => (await cl.query(sql, params)).rowCount ?? 0);
  } catch (e) {
    if (/row-level security|permission denied/.test(String(e))) return "denied";
    throw e;
  }
};
/** 例外の番号（23505・23514・22023 など）だけを返す */
const failsWith = async (sql: string, params: unknown[] = []): Promise<string> => {
  try {
    await f.admin.query(sql, params);
    return "ok";
  } catch (e) {
    return String((e as { code?: unknown }).code ?? e);
  }
};
/** ゲストのグループを 1 つ DB に直に作る（届け先は同じ会社のいちばん上のグループ・o.scope で変える） */
const group = async (name: string, o: { tenant?: string; deleted?: boolean; scope?: string } = {}): Promise<string> =>
  (
    await one<{ id: string }>(
      "insert into guest_groups (tenant_id, name, request_scope_id, deleted_at) values ($1, $2, $3, $4) returning id",
      [
        o.tenant ?? T.tenantId,
        name,
        o.scope ?? ((o.tenant ?? T.tenantId) === T.tenantId ? T.rootScope : O.rootScope),
        o.deleted ? new Date() : null,
      ],
    )
  ).id;
const putIn = async (g: string, p: Person): Promise<void> => {
  await f.admin.query("insert into guest_group_members (tenant_id, guest_group_id, member_id) values ($1, $2, $3)", [
    p.tenantId,
    g,
    p.id,
  ]);
};
async function failOn(table: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k876_fail_${randomUUID().replaceAll("-", "")}`;
  await f.admin.query(
    `create function app.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'K876 試験の失敗'; end if; return new; end $$`,
  );
  await f.admin.query(`create trigger ${name} before insert on ${table} for each row execute function app.${name}()`);
  try {
    await fn();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on ${table}`);
    await f.admin.query(`drop function if exists app.${name}()`);
  }
}

beforeAll(async () => {
  f = await makeFixture();
  await migrateAuth(process.env["DATABASE_URL"]!);
  const web = async (hd: Headers) => {
    const m = /^Bearer fake:(member|client):([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(hd.get("authorization") ?? "");
    if (!m) return null;
    const ctx: TenantContext = { tenantId: m[2]!, userId: m[3]!, role: m[1] as "member" | "client", stepUpAt: null };
    return { ctx, termsPending: false, sessionId: "", authUserId: "" };
  };
  Object.assign(hooks, f.hooks);
  app = createApp({
    version: "test",
    repo: await createRepository(f.pool),
    resolve: withDevice(web, createDeviceResolver(f.pool)) as never,
    contract: { hooks, limits },
  });
  for (const op of [
    "getWorkspaceMembers",
    "createInvitations",
    "createInvitationLink",
    "listGuestGroups",
    "createGuestGroup",
  ])
    limits[op] = 10_000;
  T = await f.company(WS, "EG");
  // K-1103：招く時に席の上限（無料は 3 人まで）で止まる。この会社は社内 4 人（管理者・マネージャー・メンバー・招く権限の人）で社内の人も招くので、
  //   人数の上限を持たない試験だけのプラン（limits に members が無い＝上限なし）の契約にしておく（K-419 の invite-create.test.ts と同じ直し）。
  //   プランの行はこの会社の中に置く（運営の会社の free・team・business の並び＝選べるプランに混ぜない）
  const plan = await f.admin.query<{ id: string }>(
    "insert into plans (tenant_id, key, name, price_monthly, limits) values ($1, 'k876-unlimited', 'K876 の試験（上限なし）', 0, '{}'::jsonb) returning id",
    [T.tenantId],
  );
  await f.admin.query(
    "insert into subscriptions (tenant_id, plan_id, status_id, started_at) values ($1, $2, 'active', now() - interval '40 days')",
    [T.tenantId, plan.rows[0]!.id],
  );
  O = await f.company("K876 の別の会社", "OT");
  await f.admin.query("update scopes set name = '営業' where id = $1", [T.rootScope]);
  JD = (
    await f.admin.query<{ id: string }>(
      "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '受託開発', 'JD') returning id",
      [T.tenantId, T.rootScope],
    )
  ).rows[0]!.id;
  admin = await make("takamoto", "高本 聖斗", { role: "admin" });
  mgr = await make("sato", "佐藤 花子", { role: "manager" });
  member = await make("suzuki", "鈴木 一郎");
  inviter = await make("inviter", "招く権限の人");
  await f.admin.query(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'invite')",
    [T.tenantId, inviter.id],
  );
  outsider = await make("outsider", "別の会社の人", { tenant: O.tenantId, role: "admin" });
}, 120_000);
afterAll(async () => {
  await f?.close();
});

/** 人を 1 人作る（認証のアカウント・members・tenant_memberships）。role は役割（requester＝ゲスト）、status は所属の状態 */
async function make(
  key: string,
  name: string,
  o: { tenant?: string; scope?: string; role?: string; status?: string } = {},
): Promise<P> {
  const tenant = o.tenant ?? T.tenantId;
  const authUserId = randomUUID();
  const email = `${key}-${authUserId.slice(0, 8)}@guest.example`;
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
    [tenant, p.id, authUserId, o.role ?? "member", o.status ?? "active"],
  );
  return { ...p, email, authUserId };
}

describe("K-876 DB：ゲストのグループの置き場", () => {
  it("K876-API-001 表と列：guest_groups・guest_group_members の列は決めた物だけ（人ごと・項目ごとの見せ方の列は持たない）。invitations に guest_group_id が増え、役割 requester でない招待には付けられない（23514）", async () => {
    const cols = async (t: string) =>
      (
        await f.admin.query<{ column_name: string }>(
          "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by column_name",
          [t],
        )
      ).rows.map((r) => r.column_name);
    expect(await cols("guest_groups")).toEqual(
      [
        "created_at",
        "created_by",
        "deleted_at",
        "id",
        "name",
        "name_key",
        "request_scope_id",
        "tenant_id",
        "updated_at",
        "updated_by",
      ].sort(),
    );
    expect(await cols("guest_group_members")).toEqual(
      [
        "created_at",
        "created_by",
        "deleted_at",
        "guest_group_id",
        "id",
        "member_id",
        "tenant_id",
        "updated_at",
        "updated_by",
      ].sort(),
    );
    expect(await cols("invitations")).toContain("guest_group_id");
    const g = await group(`株式会社${randomUUID().slice(0, 6)}`);
    const row = (role: string, gid: string | null) =>
      failsWith(
        "insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, guest_group_id) values ($1, $2, $3, $4, $5, now() + interval '7 days', $6)",
        [T.tenantId, fresh("c"), role === "requester" ? null : T.rootScope, role, sha256(randomUUID()), gid],
      );
    expect(await row("member", g)).toBe("23514");
    expect(await row("requester", g)).toBe("ok");
    expect(await row("member", null)).toBe("ok");
  });

  it("K876-API-002 名前の形：空・空白だけ・81 字は 23514。80 字は入る", async () => {
    const put = (name: string) =>
      failsWith("insert into guest_groups (tenant_id, name, request_scope_id) values ($1, $2, $3)", [
        T.tenantId,
        name,
        T.rootScope,
      ]);
    for (const bad of ["", "   ", "あ".repeat(81)]) expect(await put(bad), JSON.stringify(bad)).toBe("23514");
    expect(await put("い".repeat(80))).toBe("ok");
  });

  it("K876-API-003 名前の重なり（表記ゆらぎ）：全角半角・大文字小文字・空白の違いだけの名前は同じ会社の中で 23505。別の会社・消した物と同じ名前は入る", async () => {
    const stem = `ＫＡＢＣ${randomUUID().slice(0, 4)}`;
    await group(`株式会社${stem}`);
    const dup = (name: string, tenant = T.tenantId, scope = T.rootScope) =>
      failsWith("insert into guest_groups (tenant_id, name, request_scope_id) values ($1, $2, $3)", [
        tenant,
        name,
        scope,
      ]);
    const half = `株式会社${stem}`.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    expect(await dup(half)).toBe("23505");
    expect(await dup(half.toLowerCase())).toBe("23505");
    expect(await dup(`株式会社 ${half.slice(4)}\u3000`)).toBe("23505");
    expect(await dup(half, O.tenantId, O.rootScope)).toBe("ok");
    const gone = await group(`消した${randomUUID().slice(0, 6)}`, { deleted: true });
    const goneName = (await one<{ name: string }>("select name from guest_groups where id = $1", [gone])).name;
    expect(await dup(goneName)).toBe("ok");
  });

  it("K876-API-004 入れるのは同じ会社の役割ゲストの人だけ：メンバー・別の会社の人・別の会社のグループは 22023。届け先が別の会社の社内のグループなのも 22023", async () => {
    const g = await group(`株式会社${randomUUID().slice(0, 6)}`);
    const og = await group(`別${randomUUID().slice(0, 6)}`, { tenant: O.tenantId });
    const guest = await make("g4", "ゲスト 4", { role: "requester" });
    const add = (gid: string, p: Person) =>
      failsWith("insert into guest_group_members (tenant_id, guest_group_id, member_id) values ($1, $2, $3)", [
        p.tenantId,
        gid,
        p.id,
      ]);
    expect(await add(g, member)).toBe("22023");
    expect(await add(g, outsider)).toBe("22023");
    expect(await add(og, guest)).toBe("22023");
    expect(await add(g, guest)).toBe("ok");
    expect(
      await failsWith("insert into guest_groups (tenant_id, name, request_scope_id) values ($1, $2, $3)", [
        T.tenantId,
        `届け先${randomUUID().slice(0, 6)}`,
        O.rootScope,
      ]),
    ).toBe("22023");
  });

  it("K876-API-005 1 人は 1 つのグループ：重ねて入れると 23505。外した（deleted_at）後は別のグループに入れる", async () => {
    const [g1, g2] = [await group(`甲${randomUUID().slice(0, 6)}`), await group(`乙${randomUUID().slice(0, 6)}`)];
    const guest = await make("g5", "ゲスト 5", { role: "requester" });
    await putIn(g1, guest);
    await expect(putIn(g2, guest)).rejects.toMatchObject({ code: "23505" });
    await f.admin.query("update guest_group_members set deleted_at = now() where member_id = $1", [guest.id]);
    await putIn(g2, guest);
    expect(
      await n("select count(*) as n from guest_group_members where member_id = $1 and deleted_at is null", [guest.id]),
    ).toBe(1);
  });

  it("K876-API-006 行の守り：members の view を持たない人は 0 行・持つ管理者は読める・書く権限（edit）の無い人の書き込みは断られる・別の会社の人は 0 行", async () => {
    const g = await group(`守り${randomUUID().slice(0, 6)}`);
    expect(await asApp(admin, "select id from guest_groups where id = $1", [g])).toBe(1);
    expect(await asApp(member, "select id from guest_groups where id = $1", [g])).toBe(0);
    expect(await asApp(outsider, "select id from guest_groups where id = $1", [g])).toBe(0);
    expect(
      await asApp(member, "insert into guest_groups (tenant_id, name, request_scope_id) values ($1, 'x', $2)", [
        T.tenantId,
        T.rootScope,
      ]),
    ).toBe("denied");
    expect(await asApp(member, "update guest_groups set name = 'y' where id = $1", [g])).toBe(0);
    expect(
      await asApp(admin, "update guest_groups set name = $2 where id = $1", [g, `守り直${randomUUID().slice(0, 6)}`]),
    ).toBe(1);
  });
});

describe("K-876 ゲストのグループを作る口（createGuestGroup）", () => {
  it("K876-API-007 作る：201・名前は前後の空白を取って入る・届け先 request_scope_id が付く・答えは request_scope の id と名前を持つ・証跡 guest_group.created が 1 行（名前は載せない）", async () => {
    await ready();
    const name = `新しい株式会社${randomUUID().slice(0, 6)}`;
    const r = await mkGroup(admin, { name: `  ${name} `, request_scope_id: JD });
    expect(r.status, await r.clone().text()).toBe(201);
    const g = (
      (await json(r)).data as { group: { id: string; name: string; request_scope: { id: string; name: string } } }
    ).group;
    expect(Object.keys(g).sort()).toEqual(["id", "name", "request_scope"]);
    expect(g).toMatchObject({ name, request_scope: { id: JD, name: "受託開発" } });
    expect(await one("select name, tenant_id, request_scope_id from guest_groups where id = $1", [g.id])).toEqual({
      name,
      tenant_id: T.tenantId,
      request_scope_id: JD,
    });
    const ev = await one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'guest_group.created' and target_id = $2",
      [T.tenantId, g.id],
    );
    expect(ev.payload).toEqual({ request_scope_id: JD });
  });

  it("K876-API-008 同じ名前（表記ゆらぎを含む）：409・E-GST-002（欄・details なし）・グループは増えない", async () => {
    await ready();
    const stem = `重複${randomUUID().slice(0, 6)}`;
    await group(`株式会社${stem}`);
    const before = await n("select count(*) as n from guest_groups where tenant_id = $1", [T.tenantId]);
    const r = await mkGroup(admin, { name: ` 株式会社\u3000${stem.toUpperCase()} `, request_scope_id: T.rootScope });
    expect(r.status, await r.clone().text()).toBe(409);
    const b = await json(r);
    expect(b["code"]).toBe("E-GST-002");
    expect(b["message"]).toBe(msg("E-GST-002"));
    expect(b.details).toBeUndefined();
    expect(await n("select count(*) as n from guest_groups where tenant_id = $1", [T.tenantId])).toBe(before);
  });

  it("K876-API-009 届け先の社内のグループが無い・消した・別の会社・知らない id：404・E-GST-003（欄・details なし）・何も作らない", async () => {
    await ready();
    const gone = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix, deleted_at) values ($1, $2, '消した届け先', 'XX', now()) returning id",
        [T.tenantId, T.rootScope],
      )
    ).rows[0]!.id;
    for (const id of [gone, O.rootScope, randomUUID()]) {
      const name = `届け先なし${randomUUID().slice(0, 6)}`;
      const r = await mkGroup(admin, { name, request_scope_id: id });
      expect(r.status, id).toBe(404);
      const b = await json(r);
      expect(b["code"]).toBe("E-GST-003");
      expect(b["message"]).toBe(msg("E-GST-003"));
      expect(b.details).toBeUndefined();
      expect(
        await n("select count(*) as n from guest_groups where tenant_id = $1 and name = $2", [T.tenantId, name]),
      ).toBe(0);
    }
  });

  it("K876-API-010 形の誤り（422・VALIDATION_ERROR・欄つき）：名前が無い・空白だけ・81 字・届け先が無い・uuid でない・知らない欄。どれも何も作らない", async () => {
    await ready();
    const before = await n("select count(*) as n from guest_groups where tenant_id = $1", [T.tenantId]);
    const ok = { name: `形${randomUUID().slice(0, 6)}`, request_scope_id: T.rootScope };
    const cases: [string, Record<string, unknown>][] = [
      ["名前が無い", { request_scope_id: T.rootScope }],
      ["空白だけ", { ...ok, name: "   " }],
      ["81 字", { ...ok, name: "あ".repeat(81) }],
      ["届け先が無い", { name: ok.name }],
      ["uuid でない", { ...ok, request_scope_id: "営業" }],
      ["知らない欄", { ...ok, guest_ids: [] }],
    ];
    for (const [label, body] of cases) {
      const r = await mkGroup(admin, body);
      expect(r.status, label).toBe(422);
      expect(((await json(r)).details ?? []).length, label).toBeGreaterThan(0);
    }
    expect(await n("select count(*) as n from guest_groups where tenant_id = $1", [T.tenantId])).toBe(before);
  });

  it("K876-API-011 権限：管理者と招く権限を付けたメンバーは作れる（201）。マネージャー・普通のメンバー・ゲストの文脈は 403・ログインしていない人は 401（何も作らない）", async () => {
    await ready();
    const guest = await make("g11", "ゲスト 11", { role: "requester" });
    const body = () => ({ name: `権限${randomUUID().slice(0, 6)}`, request_scope_id: T.rootScope });
    expect((await mkGroup(admin, body())).status).toBe(201);
    expect((await mkGroup(inviter, body())).status).toBe(201);
    const before = await n("select count(*) as n from guest_groups where tenant_id = $1", [T.tenantId]);
    for (const [who, role] of [
      [mgr, "member"],
      [member, "member"],
      [guest, "client"],
    ] as const) {
      const r = await req("POST", "/guest-groups", { body: body(), headers: as(who, role) });
      expect(r.status, who.email).toBe(403);
    }
    expect((await req("POST", "/guest-groups", { body: body() })).status).toBe(401);
    expect(await n("select count(*) as n from guest_groups where tenant_id = $1", [T.tenantId])).toBe(before);
  });
});

describe("K-876 招く口：ゲストのグループ", () => {
  it("K876-API-012 既にあるグループへ招く：201・招待は role_id requester・guest_group_id 付き・scope_id（依頼の届け先）は持たない・グループの数は変わらない・証跡 invitation.created の payload に role と guest_group_id（宛ては載せない）", async () => {
    await ready();
    const g = await group(`既存${randomUUID().slice(0, 6)}`);
    const before = await n("select count(*) as n from guest_groups where tenant_id = $1", [T.tenantId]);
    const e = fresh("a12");
    const r = await invite(admin, base([e], g));
    expect(r.status, await r.clone().text()).toBe(201);
    const inv = ((await json(r)).data as { invitations: { id: string }[] }).invitations[0]!;
    expect(await one("select role_id, guest_group_id, scope_id from invitations where id = $1", [inv.id])).toEqual({
      role_id: "requester",
      guest_group_id: g,
      scope_id: null,
    });
    expect(await n("select count(*) as n from guest_groups where tenant_id = $1", [T.tenantId])).toBe(before);
    const ev = await one<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where tenant_id = $1 and action = 'invitation.created' and target_id = $2",
      [T.tenantId, inv.id],
    );
    expect(ev.payload).toMatchObject({ role: "requester", guest_group_id: g });
    expect(JSON.stringify(ev.payload)).not.toContain(e);
  });

  it("K876-API-013 メール：件名と本文に、招いた人・ワークスペース・ゲストのグループ名・役割「ゲスト」・ひとことが載る。依頼が届く社内のグループ名（営業）は載らない", async () => {
    await ready();
    const e = fresh("a13");
    const name = `届く株式会社${randomUUID().slice(0, 6)}`;
    const g = await group(name);
    expect((await invite(admin, base([e], g))).status).toBe(201);
    const m = mails.find((x) => x.to === e)!;
    expect(m).toBeTruthy();
    const all = `${m.subject}\n${m.text}`;
    for (const s of ["高本 聖斗", WS, name, "ゲスト", NOTE]) expect(all, s).toContain(s);
    expect(all).not.toContain("営業");
  });

  it("K876-API-014 形の誤り（422・VALIDATION_ERROR・欄つき）：requester でグループが無い・scope_id がある・両方ある／メンバーの役に guest_group_id がある・scope_id が無い・guest_group_id が uuid でない。どれも何も作らない", async () => {
    await ready();
    const g = await group(`形${randomUUID().slice(0, 6)}`);
    const cases: [string, Record<string, unknown>][] = [
      ["requester でグループが無い", { guest_group_id: undefined }],
      ["requester に scope_id", { scope_id: T.rootScope }],
      ["メンバーの役に guest_group_id", { role_key: "member", scope_id: T.rootScope }],
      ["メンバーの役に scope_id が無い", { role_key: "member", guest_group_id: undefined }],
      ["uuid でない", { guest_group_id: "株式会社" }],
    ];
    for (const [label, o] of cases) {
      const e = fresh("a14");
      const r = await invite(admin, base([e], g, o));
      expect(r.status, label).toBe(422);
      expect(((await json(r)).details ?? []).length, label).toBeGreaterThan(0);
      expect(await n("select count(*) as n from invitations where lower(email) = lower($1)", [e]), label).toBe(0);
      expect(
        mails.some((m) => m.to === e),
        label,
      ).toBe(false);
    }
  });

  it("K876-API-015 無い・消した・別の会社のグループを選ぶ：404・E-GST-001（欄・details なし）・招待もメールも作らない", async () => {
    await ready();
    const gone = await group(`消${randomUUID().slice(0, 6)}`, { deleted: true });
    const og = await group(`別社${randomUUID().slice(0, 6)}`, { tenant: O.tenantId });
    for (const id of [gone, og, randomUUID()]) {
      const e = fresh("a15");
      const r = await invite(admin, base([e], id));
      expect(r.status, id).toBe(404);
      const b = await json(r);
      expect(b["code"]).toBe("E-GST-001");
      expect(b["message"]).toBe(msg("E-GST-001"));
      expect(b.details).toBeUndefined();
      expect(await n("select count(*) as n from invitations where lower(email) = lower($1)", [e])).toBe(0);
      expect(mails.some((m) => m.to === e)).toBe(false);
    }
  });

  it("K876-API-016 宛ての断り（今までと同じ）：社内のメンバーが混じれば 409・E-INV-010、形の違う宛てが混じれば 422・E-INV-009。どちらも全部か無しか（良い宛ての招待も作らない）", async () => {
    await ready();
    const g = await group(`断り${randomUUID().slice(0, 6)}`);
    const ok1 = fresh("a16a");
    const r1 = await invite(admin, base([member.email, ok1], g));
    expect(r1.status).toBe(409);
    expect((await json(r1))["code"]).toBe("E-INV-010");
    const ok2 = fresh("a16b");
    const r2 = await invite(admin, base([ok2, "bad@engine-base"], g));
    expect(r2.status).toBe(422);
    expect((await json(r2))["code"]).toBe("E-INV-009");
    for (const e of [ok1, ok2])
      expect(await n("select count(*) as n from invitations where lower(email) = lower($1)", [e])).toBe(0);
  });

  it("K876-API-017 権限：マネージャー・普通のメンバー・ゲストの文脈は 403（何も作らない）・ログインしていない人は 401。招く権限を付けたメンバーと管理者は招ける（ゲストとして招くときは本人確認の取り直しは要らない）", async () => {
    await ready();
    const g = await group(`権限${randomUUID().slice(0, 6)}`);
    const guest = await make("g17", "ゲスト 17", { role: "requester" });
    for (const [who, role] of [
      [mgr, "member"],
      [member, "member"],
      [guest, "client"],
    ] as const) {
      const e = fresh("a17");
      const r = await req("POST", "/invitations", { body: base([e], g), headers: as(who, role) });
      expect(r.status, who.email).toBe(403);
      expect(await n("select count(*) as n from invitations where lower(email) = lower($1)", [e])).toBe(0);
    }
    expect((await req("POST", "/invitations", { body: base([fresh("a17z")], g) })).status).toBe(401);
    expect((await invite(inviter, base([fresh("a17b")], g))).status).toBe(201);
    expect((await invite(admin, base([fresh("a17c")], g))).status).toBe(201);
  });

  it("K876-API-018 前からの招き方はそのまま・重ねて招く：メンバーの役（scope_id あり・グループの指定なし）は 201 で guest_group_id は空。同じ宛てを別のゲストのグループで招き直すと、前の招待は取り消され、新しい招待が新しいグループに付く（招待中は 1 つ）", async () => {
    await ready();
    const e0 = fresh("a18");
    expect((await invite(admin, { emails: [e0], scope_id: T.rootScope, role_key: "member" })).status).toBe(201);
    expect(
      await one("select role_id, guest_group_id from invitations where tenant_id = $1 and lower(email) = lower($2)", [
        T.tenantId,
        e0,
      ]),
    ).toEqual({
      role_id: "member",
      guest_group_id: null,
    });
    const e = fresh("a18b");
    const [g1, g2] = [
      await group(`重ね甲${randomUUID().slice(0, 6)}`),
      await group(`重ね乙${randomUUID().slice(0, 6)}`),
    ];
    expect((await invite(admin, base([e], g1))).status).toBe(201);
    expect((await invite(admin, base([e], g2))).status).toBe(201);
    const live = (
      await f.admin.query<{ guest_group_id: string }>(
        "select guest_group_id from invitations where tenant_id = $1 and lower(email) = lower($2) and revoked_at is null",
        [T.tenantId, e],
      )
    ).rows;
    expect(live.map((r) => r.guest_group_id)).toEqual([g2]);
  });

  it("K876-API-019 リンクで招く口はゲストを受けない（D-155.47）：createInvitationLink に role_key requester を付けると 422・VALIDATION_ERROR（欄 role_key）・招待の行は増えない", async () => {
    await ready();
    const before = await n("select count(*) as n from invitations where tenant_id = $1", [T.tenantId]);
    const r = await req("POST", "/invitations/link", {
      body: { scope_id: T.rootScope, role_key: "requester" },
      headers: as(admin),
    });
    expect(r.status, await r.clone().text()).toBe(422);
    expect(((await json(r)).details ?? []).map((d) => d.field)).toContain("role_key");
    expect(await n("select count(*) as n from invitations where tenant_id = $1", [T.tenantId])).toBe(before);
  });
});

describe("K-876 受ける・下見・並び", () => {
  /** 招待を 1 つ作り（口）、ゲストの人（requester）がそれを受けた形にする（accepted_member_id を付ける＝受ける道 3 つが共通で行う最後の更新） */
  const accepted = async (gid: string | null) => {
    const e = fresh("acc");
    const body = gid === null ? { emails: [e], scope_id: T.rootScope, role_key: "member" } : base([e], gid);
    const r = await invite(admin, body);
    expect(r.status, await r.clone().text()).toBe(201);
    const id = ((await json(r)).data as { invitations: { id: string }[] }).invitations[0]!.id;
    const p = await make("acc", "参加した人", { role: gid === null ? "member" : "requester" });
    await f.admin.query("update invitations set accepted_member_id = $2 where id = $1", [id, p.id]);
    return { id, p };
  };

  it("K876-API-020 受けたとき（accepted_member_id が付く）：guest_group_members に 1 行・グループは招待のもの。メンバーの役の招待を受けてもゲストのグループには入らない", async () => {
    await ready();
    const g = await group(`受ける${randomUUID().slice(0, 6)}`);
    const { p } = await accepted(g);
    const rows = (
      await f.admin.query("select guest_group_id, deleted_at from guest_group_members where member_id = $1", [p.id])
    ).rows;
    expect(rows).toEqual([{ guest_group_id: g, deleted_at: null }]);
    const m = await accepted(null);
    expect(await n("select count(*) as n from guest_group_members where member_id = $1", [m.p.id])).toBe(0);
  });

  it("K876-API-004 失敗（受けたとき）：ゲストの招待を、ゲストでない人（メンバーの役）や別の会社の人が受けようとすると、引き金が 22023 で落ち、受ける更新ごと戻る（accepted_member_id は空のまま・guest_group_members に行が無い）", async () => {
    await ready();
    const g = await group(`受け失敗${randomUUID().slice(0, 6)}`);
    const r = await invite(admin, base([fresh("a4f")], g));
    expect(r.status, await r.clone().text()).toBe(201);
    const id = ((await json(r)).data as { invitations: { id: string }[] }).invitations[0]!.id;
    for (const who of [member, outsider])
      expect(
        await failsWith("update invitations set accepted_member_id = $2 where id = $1", [id, who.id]),
        who.id,
      ).toBe("22023");
    const row = (
      await f.admin.query<{ accepted_member_id: string | null }>(
        "select accepted_member_id from invitations where id = $1",
        [id],
      )
    ).rows[0]!;
    expect(row.accepted_member_id).toBeNull();
    expect(await n("select count(*) as n from guest_group_members where guest_group_id = $1", [g])).toBe(0);
  });

  it("K876-API-021 抜けて戻る：前のグループの行が外れている人が別のグループの招待を受けると、今のグループは 1 つだけ（新しいグループ）", async () => {
    await ready();
    const [g1, g2] = [
      await group(`戻る甲${randomUUID().slice(0, 6)}`),
      await group(`戻る乙${randomUUID().slice(0, 6)}`),
    ];
    const guest = await make("g21", "戻るゲスト", { role: "requester" });
    await putIn(g1, guest);
    await f.admin.query("update guest_group_members set deleted_at = now() where member_id = $1", [guest.id]);
    const r = await invite(admin, base([fresh("a21")], g2));
    const id = ((await json(r)).data as { invitations: { id: string }[] }).invitations[0]!.id;
    await f.admin.query("update invitations set accepted_member_id = $2 where id = $1", [id, guest.id]);
    const live = (
      await f.admin.query<{ guest_group_id: string }>(
        "select guest_group_id from guest_group_members where member_id = $1 and deleted_at is null",
        [guest.id],
      )
    ).rows;
    expect(live.map((x) => x.guest_group_id)).toEqual([g2]);
  });

  it("K876-API-022 招待の下見（リンクを開いた人に見せる）：requester の招待は group_name にゲストのグループの名前を返し、社内のグループの名前（営業）は返さない。メンバーの役の招待は今までどおり社内のグループの名前", async () => {
    await ready();
    const name = `下見${randomUUID().slice(0, 6)}`;
    const g = await group(name);
    const r = await invite(admin, base([fresh("a22")], g));
    const id = ((await json(r)).data as { invitations: { id: string }[] }).invitations[0]!.id;
    const hash = (await one<{ token_hash: string }>("select token_hash from invitations where id = $1", [id]))
      .token_hash;
    const p = await one<{ group_name: string | null; role: string }>(
      "select group_name, role from app.invitation_preview2($1)",
      [hash],
    );
    expect(p).toEqual({ group_name: name, role: "requester" });
    const r2 = await invite(admin, { emails: [fresh("a22b")], scope_id: T.rootScope, role_key: "member" });
    const id2 = ((await json(r2)).data as { invitations: { id: string }[] }).invitations[0]!.id;
    const hash2 = (await one<{ token_hash: string }>("select token_hash from invitations where id = $1", [id2]))
      .token_hash;
    expect(
      (await one<{ group_name: string | null }>("select group_name from app.invitation_preview2($1)", [hash2]))
        .group_name,
    ).toBe("営業");
  });

  it("K876-API-023 メンバーの並び（getWorkspaceMembers）にゲストを出さない：グループの人にも招待中にも人数にも入らない（ゲストは listGuestGroups で読む・D-155.39・D-155.49）", async () => {
    await ready();
    const g = await group(`並び${randomUUID().slice(0, 6)}`);
    const guest = await make("g23", "並びのゲスト", { role: "requester" });
    await putIn(g, guest);
    const e = fresh("a23");
    expect((await invite(admin, base([e], g))).status).toBe(201);
    const d = (await json(await req("GET", "/workspace/members", { headers: as(admin) }))).data as {
      groups: { members: { id: string; email: string }[] }[];
      invitations: { email: string }[];
      count: number;
    };
    const ids = d.groups.flatMap((x) => x.members.map((m) => m.id));
    expect(ids).not.toContain(guest.id);
    expect(ids).toContain(admin.id);
    expect(d.invitations.map((i) => i.email)).not.toContain(e);
    expect(d.count).toBe(new Set(ids).size + d.invitations.length);
  });
});

describe("K-876 ゲストのグループの一覧の口（listGuestGroups）", () => {
  const list = async (p: Person, role: "member" | "client" = "member") =>
    req("GET", "/guest-groups", { headers: as(p, role) });
  type G = {
    id: string;
    name: string;
    request_scope: { id: string; name: string } | null;
    guests: Record<string, unknown>[];
    invitations: Record<string, unknown>[];
  };
  const groupsOf = async (r: Response) => ((await json(r)).data as { groups: G[] }).groups;

  it("K876-API-024 一覧の形：名前の順・鍵はちょうど（groups: id・name・request_scope・guests・invitations／request_scope: id・name／guests: id・name・email・suspended／invitations: id・email・left_days）。ゲストでない人・別の会社・消したグループは出ない", async () => {
    await ready();
    const tag = randomUUID().slice(0, 4);
    const [gb, ga] = [await group(`Ｂ${tag}`, { scope: JD }), await group(`Ａ${tag}`)];
    const gone = await group(`消${tag}`, { deleted: true });
    const og = await group(`別${tag}`, { tenant: O.tenantId });
    const guest = await make("g24", "ゲスト 24", { role: "requester" });
    await putIn(ga, guest);
    const r = await list(admin);
    expect(r.status, await r.clone().text()).toBe(200);
    const gs = await groupsOf(r);
    const mine = gs.filter((x) => [ga, gb].includes(x.id));
    expect(mine.map((x) => x.name)).toEqual([`Ａ${tag}`, `Ｂ${tag}`]);
    for (const x of mine)
      expect(Object.keys(x).sort()).toEqual(["guests", "id", "invitations", "name", "request_scope"]);
    expect(mine.find((x) => x.id === gb)!.request_scope).toEqual({ id: JD, name: "受託開発" });
    expect(Object.keys(mine[0]!.request_scope!).sort()).toEqual(["id", "name"]);
    const a = mine.find((x) => x.id === ga)!;
    expect(a.guests.map((x) => Object.keys(x).sort())).toEqual([["email", "id", "name", "suspended"]]);
    expect(a.guests[0]).toMatchObject({ id: guest.id, name: "ゲスト 24", email: guest.email, suspended: false });
    expect(gs.map((x) => x.id)).not.toContain(gone);
    expect(gs.map((x) => x.id)).not.toContain(og);
    expect(JSON.stringify(gs)).not.toContain(admin.email);
  });

  it("K876-API-025 0 件と届け先が消えたグループ：グループが 1 つも無い会社は 200・groups は空。人の居ないグループも出る（guests・invitations は空）。届け先の社内のグループを消した後は request_scope が null", async () => {
    await ready();
    const empty = await f.company("K876 空の会社", "EM");
    const boss = await make("g25", "空の会社の管理者", {
      tenant: empty.tenantId,
      scope: empty.rootScope,
      role: "admin",
    });
    const r0 = await list(boss);
    expect(r0.status).toBe(200);
    expect(await groupsOf(r0)).toEqual([]);
    const sub = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '届け先', 'DK') returning id",
        [empty.tenantId, empty.rootScope],
      )
    ).rows[0]!.id;
    const g = await group(`空${randomUUID().slice(0, 6)}`, { tenant: empty.tenantId, scope: sub });
    expect((await groupsOf(await list(boss))).find((x) => x.id === g)).toMatchObject({
      guests: [],
      invitations: [],
      request_scope: { id: sub, name: "届け先" },
    });
    await f.admin.query("update scopes set deleted_at = now() where id = $1", [sub]);
    expect((await groupsOf(await list(boss))).find((x) => x.id === g)!.request_scope).toBeNull();
  });

  it("K876-API-026 権限：members の view か invite を持たない普通のメンバー・ゲストの文脈は 403・招く権限だけの人は 200・ログインしていない人は 401・答えは no-store", async () => {
    await ready();
    const guest = await make("g26", "ゲスト 26", { role: "requester" });
    expect((await list(member)).status).toBe(403);
    expect((await list(inviter)).status).toBe(200); // 招く権限だけの人も読める（招く小窓で既にあるグループを選ぶため）
    expect((await list(guest, "client")).status).toBe(403);
    expect((await req("GET", "/guest-groups")).status).toBe(401);
    expect((await list(admin)).headers.get("cache-control") ?? "").toContain("no-store");
  });

  it("K876-API-027 人と招待の状態：まだ受けていない招待は invitations（id・email・left_days は残りを日で切り上げ）に出る・受けた人は guests に移る・取り消した／期限切れは出ない。止めたゲストは suspended true で出る・抜けた／消した人は出ない", async () => {
    await ready();
    const g = await group(`状態${randomUUID().slice(0, 6)}`);
    const [e1, e2, e3] = [fresh("p1"), fresh("p2"), fresh("p3")];
    const make1 = async (e: string) =>
      ((await json(await invite(admin, base([e], g)))).data as { invitations: { id: string }[] }).invitations[0]!.id;
    const [i1, i2, i3] = [await make1(e1), await make1(e2), await make1(e3)];
    await f.admin.query("update invitations set revoked_at = now() where id = $1", [i2]);
    await f.admin.query("update invitations set expires_at = now() - interval '1 hour' where id = $1", [i3]);
    const got = (await groupsOf(await list(admin))).find((x) => x.id === g)!;
    expect(got.invitations.map((x) => x["id"])).toEqual([i1]);
    expect(got.invitations[0]).toMatchObject({ email: e1, left_days: 7 });
    const joined = await make("g27", "受けたゲスト", { role: "requester" });
    await f.admin.query("update invitations set accepted_member_id = $2 where id = $1", [i1, joined.id]);
    const [stopped, left, gone] = [
      await make("g27a", "止めた", { role: "requester", status: "suspended" }),
      await make("g27b", "抜けた", { role: "requester", status: "left" }),
      await make("g27c", "消した人", { role: "requester" }),
    ];
    await f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    for (const p of [stopped, left, gone]) await putIn(g, p);
    const after = (await groupsOf(await list(admin))).find((x) => x.id === g)!;
    expect(after.invitations).toEqual([]);
    expect(after.guests.map((x) => [x["id"], x["suspended"]]).sort()).toEqual(
      [
        [joined.id, false],
        [stopped.id, true],
      ].sort(),
    );
  });
});

describe("K-876 手順の失敗", () => {
  it("K876-API-028 手順（メール）が失敗 [残る]：201・その人は mail failed・招待の行は残り、一覧の招待中に出る", async () => {
    await ready();
    const e = fresh("a28");
    const g = await group(`残る${randomUUID().slice(0, 6)}`);
    failMailTo.add(e);
    try {
      const r = await invite(admin, base([e], g));
      expect(r.status).toBe(201);
      expect(((await json(r)).data as { invitations: { mail: string }[] }).invitations[0]!.mail).toBe("failed");
      const got = (
        (await json(await req("GET", "/guest-groups", { headers: as(admin) }))).data as {
          groups: { id: string; invitations: { email: string }[] }[];
        }
      ).groups.find((x) => x.id === g)!;
      expect(got.invitations.map((x) => x.email)).toEqual([e]);
    } finally {
      failMailTo.delete(e);
    }
  });

  it("K876-API-029 手順（メール）の後片付け（送れなかった証跡 invitation.mail_failed）も失敗：201 のまま・ログに「招待のメールの結果を書けなかった」1 行（宛ての字は無い）・招待の行は残る", async () => {
    await ready();
    const e = fresh("a29");
    const g = await group(`後片付け${randomUUID().slice(0, 6)}`);
    failMailTo.add(e);
    const logs: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => logs.push(a.map(String).join(" "));
    try {
      await failOn("audit_events", "new.action = 'invitation.mail_failed'", async () => {
        expect((await invite(admin, base([e], g))).status).toBe(201);
      });
      const line = logs.filter((l) => l.includes("招待のメールの結果を書けなかった"));
      expect(line).toHaveLength(1);
      expect(line[0]).not.toContain(e);
      expect(
        await n("select count(*) as n from invitations where tenant_id = $1 and lower(email) = lower($2)", [
          T.tenantId,
          e,
        ]),
      ).toBe(1);
    } finally {
      console.error = orig;
      failMailTo.delete(e);
    }
  });
});
