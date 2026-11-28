// K-1103 招く・人を足すときに、プランの人数（席）の上限で止める（F12 → F3 の効き方・flows.json の E4）。本物の DB・本物の行の守り・
//   口の入口は createApp と契約の op・偽の画面のログイン（:su= で本人確認の取り直しの時刻）・メールは試験の偽。
//   行 ID（K1103-…）は 11_tickets/K-1103.md の表と 1 対 1。招く口は K-419（hooks/workspace-invitations.ts）、リンクの口は K-421
//   （hooks/workspace-invitation-link.ts）、ゲストを招く欄は K-876。この葉は席を確かめる関数（app.seat_check）を足し、2 つの口が招待を書く同じ取引の頭で呼ぶ。
//   数えるのは社内の人（K-961 の app.tenant_seat_count・ゲストは数えない＝D-156.51）と、使っていない・取り消していない・期限の内の社内の役の招待。
//   上限はいまのプラン（K-961 の app.tenant_plan_id）の limits.members。ゲストを招くときは上限で止めない（D-156.51）。
//   止めたら招待の行もメールも作らない（全部か無しか）。断りは 409 E-PLAN-003（欄なし・detail { members, invited, member_limit }）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
const HOOK_FILES = ["workspace-invitations.ts", "workspace-invitation-link.ts"].map((x) =>
  join(HERE, "..", "..", "..", "src", "hooks", x),
);
const OPS_TENANT = "00000000-0000-4000-8000-000000000001";

let f: Fixture;
let app: ReturnType<typeof createApp>;
const hooks: Record<string, Hook> = {};
const limits: Record<string, number> = {};
const mails: { to: string; subject: string; text: string }[] = [];
let loading: Promise<void> | null = null;

type J = Record<string, unknown> & { data?: Record<string, unknown> };
interface Ws {
  tenantId: string;
  rootScope: string;
  admin: Person;
}
const json = async (r: Response) => (await r.clone().json()) as J;
const auth = (p: Person) => ({ authorization: `Bearer fake:member:${p.tenantId}:${p.id}:su=${Date.now() - 60_000}` });
const post = (p: Person, path: string, body: unknown) =>
  Promise.resolve(
    app.request(`http://localhost/api/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": nextIp(), ...auth(p) },
      body: JSON.stringify(body),
    }),
  );
const ready = async () => {
  loading ??= (async () => {
    const d = {
      appPool: f.pool,
      repo: await createRepository(f.pool),
      mailer: async (m: { to: string; subject: string; text: string }) => {
        mails.push(m);
      },
      config: { env: "test", webBaseUrl: "http://localhost:3000", opsEmail: "ops@example.com" },
    } as unknown as HookDeps;
    for (const file of HOOK_FILES)
      if (existsSync(file)) Object.assign(hooks, ((await import(file)) as { register: HookModule }).register.make(d));
  })();
  await loading;
};
const fresh = (tag: string) => `${tag}-${randomUUID().slice(0, 8)}@k1103.example`;
const invite = (ws: Ws, emails: string[], o: Record<string, unknown> = {}) =>
  post(ws.admin, "/invitations", { emails, scope_id: ws.rootScope, role_key: "member", ...o });
const n = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const invitations = (ws: Ws) =>
  n("select count(*) as n from invitations where tenant_id = $1 and deleted_at is null", [ws.tenantId]);
const mailsTo = (emails: string[]) => mails.filter((m) => emails.includes(m.to)).length;
const planId = async (key: string) =>
  (
    await f.admin.query<{ id: string }>(
      "select id from plans where tenant_id = $1 and key = $2 and deleted_at is null",
      [OPS_TENANT, key],
    )
  ).rows[0]!.id;
/** 契約の行を直に置く（started・ended は今からの秒。ended を省くと終わりなし） */
const subscribe = async (ws: Ws, key: string, o: { startedSec?: number; endedSec?: number } = {}) =>
  f.admin.query(
    `insert into subscriptions (tenant_id, plan_id, status_id, started_at, ended_at)
     values ($1, $2, 'active', now() + make_interval(secs => $3), case when $4::int is null then null else now() + make_interval(secs => $4::int) end)`,
    [ws.tenantId, await planId(key), o.startedSec ?? -86_400 * 40, o.endedSec ?? null],
  );
/** 人を 1 人足す（members ＋ 同じ会社の所属。role requester はゲスト） */
async function addPerson(tenantId: string, scope: string, name: string, role: string): Promise<Person> {
  const authUserId = randomUUID();
  await f.admin.query(
    'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
    [authUserId, name, fresh("person")],
  );
  const p = await f.person(tenantId, scope, { name, authUserId });
  await f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, $4, 'active')",
    [tenantId, p.id, authUserId, role],
  );
  return p;
}
/** 会社を 1 つ作る：管理者を入れて社内の人を internal 人（管理者を含む）・ゲストを guests 人 */
async function ws(label: string, internal: number, guests = 0): Promise<Ws> {
  const c = await f.company(`K1103 ${label}`);
  const admin = await addPerson(c.tenantId, c.rootScope, "高本 聖斗", "admin");
  for (let i = 1; i < internal; i++) await addPerson(c.tenantId, c.rootScope, `社内の人 ${i}`, "member");
  for (let i = 0; i < guests; i++) await addPerson(c.tenantId, c.rootScope, `先方の人 ${i + 1}`, "requester");
  return { ...c, admin };
}
/** 招待の行を直に置く（期限・取り消し・使った） */
const putInvite = (w: Ws, o: { role?: string; expires?: string; revoked?: boolean; used?: boolean } = {}) =>
  f.admin.query(
    `insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by, revoked_at, accepted_member_id)
     values ($1, $2, $3, $4, $5, now() + ($6::text)::interval, $7, $8, $9)`,
    [
      w.tenantId,
      fresh("put"),
      w.rootScope,
      o.role ?? "member",
      randomUUID().replaceAll("-", ""),
      o.expires ?? "7 days",
      w.admin.id,
      o.revoked ? new Date() : null,
      o.used ? w.admin.id : null,
    ],
  );
const isFlat = (b: J) => !("field" in b) && !("details" in b);

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
  for (const op of ["createInvitations", "createInvitationLink"]) limits[op] = 10_000;
}, 120_000);
afterAll(async () => {
  await f?.close();
});

describe("K-1103 招く口とプランの人数の上限（無料は 3 人まで）", () => {
  it("K1103-API-001 無料・社内 2 人：1 人招くと 201 で招待が 1 つ・メールが 1 通（3 人目は上限の内）", async () => {
    await ready();
    const w = await ws("2 人", 2);
    const to = fresh("third");
    const r = await invite(w, [to]);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await invitations(w)).toBe(1);
    expect(mailsTo([to])).toBe(1);
  });

  it("K1103-API-002 無料・社内 3 人：招くと 409 E-PLAN-003・欄と details なし・detail { members 3, invited 0, member_limit 3 }。招待もメールも作らない", async () => {
    await ready();
    const w = await ws("満員", 3);
    const to = fresh("fourth");
    const r = await invite(w, [to]);
    const b = await json(r);
    expect(r.status).toBe(409);
    expect(b["code"]).toBe("E-PLAN-003");
    expect(isFlat(b)).toBe(true);
    expect(b["detail"]).toEqual({ members: 3, invited: 0, member_limit: 3 });
    expect(await invitations(w)).toBe(0);
    expect(mailsTo([to])).toBe(0);
  });

  it("K1103-API-003 招待中も数える：社内 2 人＋招待中 1 は 409。期限切れ・取り消し・使った招待は数えず、社内 2 人ならもう 1 人招ける", async () => {
    await ready();
    const pending = await ws("招待中", 2);
    await putInvite(pending);
    const r1 = await invite(pending, [fresh("over")]);
    expect(r1.status).toBe(409);
    expect((await json(r1))["detail"]).toEqual({ members: 2, invited: 1, member_limit: 3 });
    const old = await ws("古い招待", 2);
    await putInvite(old, { expires: "-1 hour" });
    await putInvite(old, { revoked: true });
    await putInvite(old, { used: true });
    const r2 = await invite(old, [fresh("ok")]);
    expect(r2.status, await r2.clone().text()).toBe(201);
  });

  it("K1103-API-004 まとめて招く：社内 1 人の無料で 3 人まとめては 409 で 1 つも作らずメール 0・2 人なら 201 で 2 つ", async () => {
    await ready();
    const w = await ws("まとめて", 1);
    const three = [fresh("a"), fresh("b"), fresh("c")];
    const r1 = await invite(w, three);
    expect(r1.status).toBe(409);
    expect((await json(r1))["detail"]).toEqual({ members: 1, invited: 0, member_limit: 3 });
    expect(await invitations(w)).toBe(0);
    expect(mailsTo(three)).toBe(0);
    const r2 = await invite(w, three.slice(0, 2));
    expect(r2.status, await r2.clone().text()).toBe(201);
    expect(await invitations(w)).toBe(2);
  });

  it("K1103-API-005 ゲストは数えない・止めない（D-156.51）：社内 2 人＋ゲスト 3 人で社内を 1 人招ける。社内 3 人の満員でもゲストは招けてメールが届く", async () => {
    await ready();
    const mixed = await ws("ゲスト 3 人", 2, 3);
    const r1 = await invite(mixed, [fresh("staff")]);
    expect(r1.status, await r1.clone().text()).toBe(201);
    const full = await ws("満員でゲスト", 3);
    const to = fresh("guest");
    // ゲストは先にあるゲストのグループに招く（招く口の形は guest_group_id・K-876 の新しい形。前の guest_group_name は無い）
    const group = (
      await f.admin.query<{ id: string }>(
        "insert into guest_groups (tenant_id, name, request_scope_id) values ($1, $2, $3) returning id",
        [full.tenantId, "合同会社ミナト企画（ゲスト）", full.rootScope],
      )
    ).rows[0]!.id;
    const r2 = await invite(full, [to], { role_key: "requester", guest_group_id: group, scope_id: undefined });
    expect(r2.status, await r2.clone().text()).toBe(201);
    expect(mailsTo([to])).toBe(1);
    expect(
      await n("select count(*) as n from invitations where tenant_id = $1 and role_id = 'requester'", [full.tenantId]),
    ).toBe(1);
  });

  it("K1103-API-006 上のプランでは止まらない：無料の満員の会社をチームに上げた直後に 4 人目を招くと 201（上限 10）", async () => {
    await ready();
    const w = await ws("上げた", 3);
    expect((await invite(w, [fresh("before")])).status).toBe(409);
    await subscribe(w, "team", { startedSec: -1 });
    const r = await invite(w, [fresh("after")]);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await invitations(w)).toBe(1);
  });

  it("K1103-API-007 下げる予定の間（来月 1 日に無料へ）は今のプラン（ビジネス）の上限で数え、4 人目を招ける", async () => {
    await ready();
    const w = await ws("下げる予定", 3);
    const firstOfNextMonthSec = 86_400 * 20;
    await subscribe(w, "business", { startedSec: -86_400 * 40, endedSec: firstOfNextMonthSec });
    const r = await invite(w, [fresh("still")]);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await invitations(w)).toBe(1);
  });

  it("K1103-API-008 招待のリンク（K-421）も同じ：無料の満員の会社はリンクを作れず 409 E-PLAN-003・欄なし・招待 0", async () => {
    await ready();
    const w = await ws("リンク", 3);
    const r = await post(w.admin, "/invitations/link", { scope_id: w.rootScope, role_key: "member" });
    const b = await json(r);
    expect(r.status).toBe(409);
    expect(b["code"]).toBe("E-PLAN-003");
    expect(isFlat(b)).toBe(true);
    expect(await invitations(w)).toBe(0);
  });

  it("K1103-API-009 同時に 2 本：社内 2 人の無料で別々の 1 人を同時に招くと、201 と 409 が 1 つずつで招待は 1 つ", async () => {
    await ready();
    const w = await ws("同時", 2);
    const rs = await Promise.all([invite(w, [fresh("x")]), invite(w, [fresh("y")])]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await invitations(w)).toBe(1);
  });

  it("K1103-API-010 別の会社の人・招待は数えない：別の会社が社内 5 人と招待中 3 でも、社内 2 人の会社は 1 人招ける", async () => {
    await ready();
    const other = await ws("別の会社", 5);
    for (let i = 0; i < 3; i++) await putInvite(other);
    const w = await ws("自分の会社", 2);
    const r = await invite(w, [fresh("mine")]);
    expect(r.status, await r.clone().text()).toBe(201);
  });
});

describe("K-1103 席を確かめる関数（app.seat_check）", () => {
  /** 会社の人の文脈（アプリの接続・app.tenant_id と app.user_id）で関数を呼び、例外なら code と hint と detail を返す */
  const check = async (w: Ws, adding: number, replacing: string[] = []) => {
    const c = await f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [w.tenantId, w.admin.id],
      );
      return await c.query("select app.seat_check($1::int, $2::text[])", [adding, replacing]).then(
        () => null,
        (e: unknown) => e as { code?: string; hint?: string; detail?: string },
      );
    } finally {
      await c.query("rollback");
      c.release();
    }
  };

  it("K1103-DB-001 アプリの接続から呼べ、自分の会社だけを数える：満員に 1 足すと P0001・hint E-PLAN-003・detail は「3,0,3」。0 足すなら通る。社内 2 人に 1 なら通る", async () => {
    const full = await ws("関数 満員", 3);
    const err = await check(full, 1);
    expect([err?.code, err?.hint, err?.detail]).toEqual(["P0001", "E-PLAN-003", "3,0,3"]);
    expect(await check(full, 0)).toBeNull();
    expect(await check(await ws("関数 2 人", 2), 1)).toBeNull();
  });

  it("K1103-DB-002 送り直し：招待中の宛てに送り直す分（取り消して作り直す・K-419）は数え直さない。社内 2 人＋招待中 1 の会社で同じ宛てなら通り、別の宛てなら止まる", async () => {
    const w = await ws("送り直し", 2);
    const to = fresh("again");
    await f.admin.query(
      `insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by)
       values ($1, $2, $3, 'member', $4, now() + interval '7 days', $5)`,
      [w.tenantId, to, w.rootScope, randomUUID().replaceAll("-", ""), w.admin.id],
    );
    expect(await check(w, 1, [to])).toBeNull();
    expect((await check(w, 1, [fresh("other")]))?.hint).toBe("E-PLAN-003");
    const r = await invite(w, [to]);
    expect(r.status, await r.clone().text()).toBe(201);
  });
});
