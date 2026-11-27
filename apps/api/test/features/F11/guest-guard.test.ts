// K-878「ゲストの守り：先方の口が返すのは、自分のゲストのグループの依頼・その依頼から作ったチケットだけ。社内の口は役割ゲスト（requester）に 403・
//   先方の口は社内の人に 403」の単体の試験（DB の行の守りと口の入口・本物の Postgres・偽の画面のログイン）。行 ID（K878-API-…）は 11_tickets/K-878.md の表の行と 1 対 1。
//   「見せる相手に自分のグループが選ばれたチケット」は K-881 が足す（その行は K-881 の試験 K881-API-019〜021）。
// 試験が決める守り（migration 20261127093800_guest_guard.sql・方針は packages/db/policies/20261127093800_guest_guard.sql）:
//   ゲストの文脈＝画面のログインの解決が役割 requester の人に付ける role "client"（K-875）。DB は app.role = 'client' で入る
//   app.is_guest_member()  … 今の人が、この会社の tenant_memberships.role = 'requester' で消していない所属を持つか
//   app.my_guest_group()   … 今の人が入っている、消していないゲストのグループ（無ければ null）
//   app.guest_ok()         … role が client・この会社の所属が requester で active・消していないグループに入っている
//   app.client_ok()        … 取引先の人の柵（前の形）を広げる：前の形（取引先の人として登録されている）か app.guest_ok()。policy の役の言葉は今までの client のまま（生成の作り手・行列の試験を変えない）
//   app.guest_sees_ticket(tid) … 自分のグループの（消していない）依頼から作ったチケットで、消していない・下書きでない（K-881 が「見せる相手に自分のグループが選ばれた」を足す）
//   app.member_ok()        … 社内の人の柵。役割 requester の所属を持つ人は、role が member でも通らない（柵の 2 層目）
//   方針（役は client＝app.client_ok() を前に付ける）：tickets_guest_read（app.guest_sees_ticket(id)）・client_requests_guest_read（guest_group_id が自分のグループ）・
//         guest_groups_guest_read（自分のグループの行だけ）。ゲストは書く方針を持たない
//   client_requests：client_id が空でよくなり、guest_group_id（ゲストのグループ）が足される。どちらかは要る（check）。グループは同じ会社（引き金）
// 入口：社内の口（契約の auth が member）は role client に 403。先方の口（auth が client）は role member・ops に 403・ログインしていなければ 401（入口 op.ts の今の動き）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let admin: Person;
let gA: string;
let gB: string;
beforeAll(async () => {
  f = await makeFixture([]);
  T = await f.company("K878 会社", "GD");
  O = await f.company("K878 別の会社", "GE");
  admin = await mem("admin");
  await f.admin.query(
    "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, 'manager')",
    [T.tenantId, admin.id, T.rootScope],
  );
  gA = await group("Ａ社");
  gB = await group("Ｂ社");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

type Json = Record<string, unknown>;
const asJson = async (r: Response): Promise<Json> => (await r.clone().json()) as Json;
const n = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
/** 社内の人を 1 人（所属の役割つき）。role が admin なら束の権限が付く */
async function mem(
  role: string,
  o: { tenant?: { tenantId: string; rootScope: string }; status?: string } = {},
): Promise<Person> {
  const c = o.tenant ?? T;
  const p = await f.person(c.tenantId, c.rootScope, { name: `${role} の人` });
  await f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, null, $3, $4)",
    [c.tenantId, p.id, role, o.status ?? "active"],
  );
  return p;
}
async function group(name: string, o: { tenant?: string; deleted?: boolean } = {}): Promise<string> {
  return (
    await f.admin.query<{ id: string }>(
      "insert into guest_groups (tenant_id, name, request_scope_id, deleted_at) values ($1, $2, $3, $4) returning id",
      [
        o.tenant ?? T.tenantId,
        `${name}${randomUUID().slice(0, 4)}`,
        (o.tenant ?? T.tenantId) === T.tenantId ? T.rootScope : O.rootScope,
        o.deleted ? new Date() : null,
      ],
    )
  ).rows[0]!.id;
}
/** ゲストの人（役割 requester）。g が null ならグループに入れない（name は読みやすさのための印） */
async function guest(_name: string, g: string | null, o: { status?: string } = {}): Promise<Person> {
  const p = await mem("requester", o.status ? { status: o.status } : {});
  if (g)
    await f.admin.query("insert into guest_group_members (tenant_id, guest_group_id, member_id) values ($1, $2, $3)", [
      T.tenantId,
      g,
      p.id,
    ]);
  return p;
}
const ctx = (p: Person, role: TenantContext["role"] = "client", tenantId = T.tenantId): TenantContext => ({
  tenantId,
  userId: p.id,
  role,
  stepUpAt: null,
});
/** その人の文脈で SQL を 1 つ流し、動いた行の数を返す。断られたら "denied" */
const attempt = async (c: TenantContext, sql: string, params: unknown[] = []): Promise<number | "denied"> => {
  try {
    return await withTenant(f.pool, c, async (cl) => (await cl.query(sql, params)).rowCount ?? 0);
  } catch (e) {
    if (/row-level security|permission denied/.test(String(e))) return "denied";
    throw e;
  }
};
const ids = async (c: TenantContext, table: string, where = "true", params: unknown[] = []): Promise<string[]> =>
  withTenant(f.pool, c, async (cl) =>
    (await cl.query<{ id: string }>(`select id from ${table} where ${where} order by id`, params)).rows.map(
      (r) => r.id,
    ),
  );
const fn = async (c: TenantContext, expr: string): Promise<unknown> =>
  withTenant(f.pool, c, async (cl) => (await cl.query<{ v: unknown }>(`select ${expr} as v`)).rows[0]!.v);
const ticket = async (title: string, o: { deleted?: boolean; clientId?: string; share?: Json } = {}): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, deleted_at, client_id, client_share)
       select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'),
              (select id from ticket_stages where tenant_id = $1 and key = 'todo'), $3, $4, $5, $6::jsonb
       returning id`,
      [
        T.tenantId,
        T.rootScope,
        title,
        o.deleted ? new Date() : null,
        o.clientId ?? null,
        JSON.stringify(o.share ?? {}),
      ],
    )
  ).rows[0]!.id;
/** ゲストのグループの依頼（ticketId を付けると「受けてチケットにした」依頼）。
 *  この葉の時点では、依頼から作ったチケットの枝（client_requests.ticket_id）だけでゲストに見える（K-878 の橋）。
 *  K-881 がこの枝を外して「見せる相手の行」だけにするとき、K878-API-005 は K-881 が見せる相手の行を入れる版に替える（K-881 の「前からの試験を替えた所」） */
const request = async (g: string, by: Person, o: { ticketId?: string } = {}): Promise<string> => {
  const id = (
    await f.admin.query<{ id: string }>(
      "insert into client_requests (tenant_id, guest_group_id, title, state, ticket_id, created_by) values ($1, $2, '依頼', $3, $4, $5) returning id",
      [T.tenantId, g, o.ticketId ? "ticketed" : "new", o.ticketId ?? null, by.id],
    )
  ).rows[0]!.id;
  return id;
};

describe("K-878 守りの関数（DB）", () => {
  it("K878-API-001 guest_ok と client_ok：role client・この会社で役割 requester（active）・消していないグループに入っている人だけ true（client_ok も同じ）。role が member・社内の人・グループなし・止めた・抜けた・グループが消えた・別の会社の文脈は false", async () => {
    const [a, none, stopped, left, ing] = [
      await guest("a", gA),
      await guest("none", null),
      await guest("stopped", gA, { status: "suspended" }),
      await guest("left", gA, { status: "left" }),
      await guest("ing", await group("消える社")),
    ];
    await f.admin.query(
      "update guest_groups set deleted_at = now() where id = (select guest_group_id from guest_group_members where member_id = $1)",
      [ing.id],
    );
    const ok = (c: TenantContext) => fn(c, "app.guest_ok()");
    const cok = (c: TenantContext) => fn(c, "app.client_ok()");
    expect(await ok(ctx(a))).toBe(true);
    expect(await ok(ctx(a, "member"))).toBe(false);
    expect(await ok(ctx(admin, "client"))).toBe(false);
    expect(await ok(ctx(a, "client", O.tenantId))).toBe(false);
    for (const p of [none, stopped, left, ing]) expect(await ok(ctx(p)), p.id).toBe(false);
    // client_ok は前の形に guest_ok を足した柵：ゲストは true・社内の人・グループなしのゲストは false
    expect(await cok(ctx(a))).toBe(true);
    for (const c of [ctx(admin, "client"), ctx(none), ctx(a, "member")]) expect(await cok(c)).toBe(false);
  });

  it("K878-API-002 member_ok（社内の人の柵）：社内の人は true のまま。役割 requester の人は、role が member でも client でも false（members・scopes・tenants が 0 行）", async () => {
    const a = await guest("a", gA);
    expect(await fn(ctx(admin, "member"), "app.member_ok()")).toBe(true);
    expect(await fn(ctx(a, "member"), "app.member_ok()")).toBe(false);
    expect(await fn(ctx(a, "client"), "app.member_ok()")).toBe(false);
    expect((await ids(ctx(admin, "member"), "members")).length).toBeGreaterThan(0);
    for (const table of ["members", "scopes", "tenants"]) expect(await ids(ctx(a, "member"), table), table).toEqual([]);
  });

  it("K878-API-003 is_guest_member と my_guest_group：ゲストは true と自分のグループ・社内の人は false と null・グループが消えたゲストの my_guest_group は null", async () => {
    const a = await guest("a", gA);
    const dead = await guest("dead", await group("消える社"));
    await f.admin.query(
      "update guest_groups set deleted_at = now() where id = (select guest_group_id from guest_group_members where member_id = $1)",
      [dead.id],
    );
    expect(await fn(ctx(a), "app.is_guest_member()")).toBe(true);
    expect(await fn(ctx(a), "app.my_guest_group()")).toBe(gA);
    expect(await fn(ctx(admin, "member"), "app.is_guest_member()")).toBe(false);
    expect(await fn(ctx(admin, "member"), "app.my_guest_group()")).toBeNull();
    expect(await fn(ctx(dead), "app.my_guest_group()")).toBeNull();
  });
});

describe("K-878 ゲストに見える物（依頼・依頼から作ったチケット）", () => {
  it("K878-API-004 依頼：自分のグループの依頼だけ（グループの別のゲストが出した物も）。別のグループの依頼・社内の古い形の依頼（client_id だけ）・別の会社のグループの依頼は 0 行", async () => {
    const [g4a, g4b] = [await group("四甲"), await group("四乙")];
    const [a1, a2, b1] = [await guest("a1", g4a), await guest("a2", g4a), await guest("b1", g4b)];
    const [rA1, rA2, rB] = [await request(g4a, a1), await request(g4a, a2), await request(g4b, b1)];
    const client = (
      await f.admin.query<{ id: string }>("insert into clients (tenant_id, name) values ($1, $2) returning id", [
        T.tenantId,
        `古い取引先${randomUUID().slice(0, 4)}`,
      ])
    ).rows[0]!.id;
    const legacy = (
      await f.admin.query<{ id: string }>(
        "insert into client_requests (tenant_id, client_id, title) values ($1, $2, '古い依頼') returning id",
        [T.tenantId, client],
      )
    ).rows[0]!.id;
    const og = await group("別社", { tenant: O.tenantId });
    const foreign = (
      await f.admin.query<{ id: string }>(
        "insert into client_requests (tenant_id, guest_group_id, title) values ($1, $2, '別の会社') returning id",
        [O.tenantId, og],
      )
    ).rows[0]!.id;
    expect(await ids(ctx(a1), "client_requests")).toEqual([rA1, rA2].sort());
    expect(await ids(ctx(a2), "client_requests")).toEqual([rA1, rA2].sort());
    expect(await ids(ctx(b1), "client_requests")).toEqual([rB]);
    for (const c of [ctx(a1), ctx(b1)]) {
      const mine = await ids(c, "client_requests");
      expect(mine).not.toContain(legacy);
      expect(mine).not.toContain(foreign);
    }
  });

  it("K878-API-005 依頼から作ったチケット：自分のグループの依頼から作った物だけが見え、グループの全員が同じ物を見る。別のグループの依頼のチケット・依頼と関係のない社内のチケット・消したチケットは 0 行", async () => {
    const [a1, a2, b1] = [await guest("a1", gA), await guest("a2", gA), await guest("b1", gB)];
    const [tA, tB, tFree, tGone] = [
      await ticket("Ａの依頼"),
      await ticket("Ｂの依頼"),
      await ticket("社内だけ"),
      await ticket("消した", { deleted: true }),
    ];
    await request(gA, a1, { ticketId: tA });
    await request(gB, b1, { ticketId: tB });
    await request(gA, a2, { ticketId: tGone });
    expect(await ids(ctx(a1), "tickets", "id = any($1::uuid[])", [[tA, tB, tFree, tGone]])).toEqual([tA]);
    expect(await ids(ctx(a2), "tickets", "id = any($1::uuid[])", [[tA, tB, tFree, tGone]])).toEqual([tA]);
    expect(await ids(ctx(b1), "tickets", "id = any($1::uuid[])", [[tA, tB, tFree, tGone]])).toEqual([tB]);
  });

  it("K878-API-006 前の取引先の形は効かない：client_id と client_share（progress を見せる）を付けたチケットも、ゲストには 0 行。ゲストは app.my_client() が空（取引先の人ではない）", async () => {
    const a = await guest("a", gA);
    const client = (
      await f.admin.query<{ id: string }>("insert into clients (tenant_id, name) values ($1, $2) returning id", [
        T.tenantId,
        `古い${randomUUID().slice(0, 4)}`,
      ])
    ).rows[0]!.id;
    const t = await ticket("前の形", { clientId: client, share: { progress: true } });
    expect(await ids(ctx(a), "tickets", "id = $1", [t])).toEqual([]);
    expect(await fn(ctx(a), "app.my_client()")).toBeNull();
    expect(await fn(ctx(a), "app.my_contact()")).toBeNull();
  });

  it("K878-API-007 ゲストのグループの行：自分のグループの 1 行だけ読める（別のグループは 0 行）。グループの人の表 guest_group_members はゲストには 0 行", async () => {
    const [a, b] = [await guest("a", gA), await guest("b", gB)];
    expect(await ids(ctx(a), "guest_groups")).toEqual([gA]);
    expect(await ids(ctx(b), "guest_groups")).toEqual([gB]);
    expect(await ids(ctx(a), "guest_group_members")).toEqual([]);
  });
});

describe("K-878 ゲストは社内の物を読めず、何も書けない", () => {
  it("K878-API-008 社内の表は 0 行：チケット（依頼と関係のない物）・メンバー・グループ・ワークスペース・所属・権限・グループへの所属。どれも管理の接続では行が在る", async () => {
    const a = await guest("a", gA);
    const free = await ticket("社内の仕事");
    expect(await ids(ctx(a), "tickets", "id = $1", [free])).toEqual([]);
    for (const table of ["members", "scopes", "tenants", "tenant_memberships", "scope_memberships", "permissions"]) {
      const there = await n(`select count(*) as n from ${table} where tenant_id = $1`, [T.tenantId]);
      expect(there, `${table} に行が在る`).toBeGreaterThan(0);
      expect(await ids(ctx(a), table), table).toEqual([]);
    }
  });

  it("K878-API-009 書けない：チケット・メンバー・所属・権限・ゲストのグループ・依頼を足す・直す・消すは断られるか 0 行。自分を管理者にする書き込みも通らず、役割は requester のまま", async () => {
    const a = await guest("a", gA);
    const t = await ticket("書かれないチケット");
    const r = await request(gA, a, { ticketId: t });
    const c = ctx(a);
    // 足す（insert）は行の守りが断る（denied）・直す／消す（update／delete）は見える行も書ける方針が無いので 0 行（それぞれ 1 つに決まる）
    const tries: [string, string, unknown[]][] = [
      [
        "チケットを足す",
        "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title) select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 limit 1), (select id from ticket_stages where tenant_id = $1 limit 1), 'x'",
        [T.tenantId, T.rootScope],
      ],
      ["チケットを直す", "update tickets set title = 'x' where id = $1", [t]],
      ["チケットを消す", "delete from tickets where id = $1", [t]],
      ["依頼を直す", "update client_requests set title = 'x' where id = $1", [r]],
      // 自分のグループへ正しい形（出した人は本人・state new・client_id 空）で足せるのは K-907 の方針（K907-API-021 が見る）。ここは形に合わない足し方が断られることだけを見る
      [
        "依頼を別のグループへ足す",
        "insert into client_requests (tenant_id, guest_group_id, title) values ($1, $2, 'x')",
        [T.tenantId, gB],
      ],
      [
        "依頼を自分のグループへ出した人の印なしで足す",
        "insert into client_requests (tenant_id, guest_group_id, title) values ($1, $2, 'x')",
        [T.tenantId, gA],
      ],
      ["グループを直す", "update guest_groups set name = 'x' where id = $1", [gA]],
      [
        "グループに入れる",
        "insert into guest_group_members (tenant_id, guest_group_id, member_id) values ($1, $2, $3)",
        [T.tenantId, gB, a.id],
      ],
      ["自分を管理者にする", "update tenant_memberships set role = 'admin' where member_id = $1", [a.id]],
      [
        "管理者の所属を足す",
        "insert into tenant_memberships (tenant_id, member_id, role) values ($1, $2, 'admin')",
        [T.tenantId, a.id],
      ],
      [
        "権限を足す",
        "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) values ($1, $2, 'tickets', 'edit')",
        [T.tenantId, a.id],
      ],
    ];
    for (const [label, sql, p] of tries) {
      const got = await attempt(c, sql, p);
      const want = /^\s*insert/i.test(sql) ? "denied" : 0;
      expect(got, `${label}`).toBe(want);
    }
    expect(
      (await f.admin.query<{ title: string }>("select title from tickets where id = $1", [t])).rows[0]!.title,
    ).toBe("書かれないチケット");
    expect(
      (await f.admin.query<{ role: string }>("select role from tenant_memberships where member_id = $1", [a.id]))
        .rows[0]!.role,
    ).toBe("requester");
    expect(await n("select count(*) as n from permissions where grantee_member_id = $1", [a.id])).toBe(0);
  });
});

describe("K-878 口の入口（役の柵）", () => {
  const SOME = randomUUID();
  const internal: [string, string, unknown?][] = [
    ["GET", "/workspace/members"],
    ["GET", "/tickets"],
    ["POST", "/tickets", {}],
    ["GET", "/credentials"],
    ["GET", "/guest-groups"],
    ["POST", "/invitations", { emails: ["x@guest.example"], scope_id: SOME, role_key: "member" }],
  ];
  const portal: [string, string, unknown?][] = [
    ["GET", "/portal"],
    ["GET", "/portal/notices"],
    ["GET", `/portal/requests/${SOME}`],
    ["POST", "/portal/requests", {}],
    ["GET", `/portal/tickets/${SOME}`],
  ];
  const call = (p: Person | null, role: "member" | "client" | "ops", [m, path, body]: [string, string, unknown?]) =>
    f.req(m, path, { ...(body === undefined ? {} : { body }), ...(p ? { headers: f.as(p, role) } : {}) });

  it("K878-API-010 社内の口はゲストの文脈に 403（FORBIDDEN）：メンバー・チケット・預けたログイン情報・ゲストのグループ・招くのどれも。何も書かない", async () => {
    const a = await guest("a", gA);
    const before = await n("select count(*) as n from invitations where tenant_id = $1", [T.tenantId]);
    for (const e of internal) {
      const r = await call(a, "client", e);
      expect(r.status, `${e[0]} ${e[1]}`).toBe(403);
      expect((await asJson(r))["code"]).toBe("FORBIDDEN");
    }
    expect(await n("select count(*) as n from invitations where tenant_id = $1", [T.tenantId])).toBe(before);
  });

  it("K878-API-011 先方の口は社内の人に 403（FORBIDDEN）：ホーム・お知らせ・依頼・見せてもらったチケットのどれも。管理者も同じ", async () => {
    for (const e of portal) {
      const r = await call(admin, "member", e);
      expect(r.status, `${e[0]} ${e[1]}`).toBe(403);
      expect((await asJson(r))["code"]).toBe("FORBIDDEN");
    }
  });

  it("K878-API-012 ゲストの文脈は先方の口の入口を通る（401・403 にならない。振る舞いはまだ無ければ 501）", async () => {
    const a = await guest("a", gA);
    for (const e of portal.slice(0, 2)) {
      const r = await call(a, "client", e);
      expect([401, 403], `${e[0]} ${e[1]}：${r.status}`).not.toContain(r.status);
    }
  });

  it("K878-API-013 ログインしていない：社内の口も先方の口も 401。運営の文脈（role ops）は社内の口にも先方の口にも通らない（403）", async () => {
    for (const e of [...internal, ...portal])
      expect((await call(null, "member", e)).status, `${e[0]} ${e[1]}`).toBe(401);
    for (const e of [internal[0]!, portal[0]!])
      expect((await call(admin, "ops", e)).status, `ops ${e[0]} ${e[1]}`).toBe(403);
  });
});

describe("K-878 外したらすぐ入れない・見えない（G-14）", () => {
  it("K878-API-014 抜けた（所属 left）・グループから外した・グループを消した・役割をメンバーに変えた直後から、同じ文脈で次の読みが 0 行になる（読む物は自分のグループの依頼とそのチケット）", async () => {
    const mk = async (name: string, g: string) => {
      const p = await guest(name, g);
      await request(g, p, { ticketId: await ticket(`見える仕事 ${name}`) });
      return p;
    };
    const [leave, unlink, kill, change] = [
      await mk("leave", gA),
      await mk("unlink", gA),
      await mk("kill", await group("消す社")),
      await mk("change", gA),
    ];
    const seen = async (p: Person) => (await ids(ctx(p), "client_requests")).length;
    for (const p of [leave, unlink, kill, change]) expect(await seen(p), p.id).toBeGreaterThan(0);
    await f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [leave.id]);
    await f.admin.query("update guest_group_members set deleted_at = now() where member_id = $1", [unlink.id]);
    await f.admin.query(
      "update guest_groups set deleted_at = now() where id = (select guest_group_id from guest_group_members where member_id = $1)",
      [kill.id],
    );
    await f.admin.query("update tenant_memberships set role = 'member' where member_id = $1", [change.id]);
    for (const p of [leave, unlink, kill, change]) {
      expect(await seen(p), p.id).toBe(0);
      expect(await ids(ctx(p), "tickets"), p.id).toEqual([]);
    }
  });

  it("K878-API-015 権限は役割から付かない：ゲストの所属には権限の行が 1 つも無い。メンバーだった人を役割ゲストに変えると、束の権限の行がなくなり has_permission は true から false になる", async () => {
    const a = await guest("a", gA);
    expect(await n("select count(*) as n from permissions where grantee_member_id = $1", [a.id])).toBe(0);
    const m = await mem("member");
    const can = () => fn(ctx(m, "member"), `has_permission(app.user_id(), 'tickets', '${T.rootScope}'::uuid, 'edit')`);
    expect(
      await n("select count(*) as n from permissions where grantee_member_id = $1 and bundle_role is not null", [m.id]),
    ).toBeGreaterThan(0);
    expect(await can()).toBe(true);
    await f.admin.query("update tenant_memberships set role = 'requester' where member_id = $1", [m.id]);
    expect(
      await n("select count(*) as n from permissions where grantee_member_id = $1 and bundle_role is not null", [m.id]),
    ).toBe(0);
    expect(await can()).toBe(false);
    expect(await fn(ctx(m, "member"), "app.member_ok()")).toBe(false);
  });
});

describe("K-878 方針と列", () => {
  it("K878-API-016 方針の一覧：tickets は前の方針が残り tickets_guest_read が足される。client_requests も前の方針が残り client_requests_guest_read が足される。guest_groups に guest_groups_guest_read", async () => {
    const names = async (table: string) =>
      (
        await f.admin.query<{ policyname: string }>(
          "select policyname from pg_policies where schemaname = 'public' and tablename = $1",
          [table],
        )
      ).rows.map((r) => r.policyname);
    expect(await names("tickets")).toEqual(
      expect.arrayContaining([
        "tickets_read",
        "tickets_create",
        "tickets_update",
        "tickets_client_read",
        "tickets_ops_read_with_grant",
        "tickets_guest_read",
      ]),
    );
    expect(await names("client_requests")).toEqual(
      expect.arrayContaining([
        "client_requests_read",
        "client_requests_same_client_read",
        "client_requests_submit",
        "client_requests_own_edit",
        "client_requests_ops_read_with_grant",
        "client_requests_guest_read",
      ]),
    );
    expect(await names("guest_groups")).toContain("guest_groups_guest_read");
  });

  it("K878-API-017 依頼の列：client_id が空でも入る（guest_group_id があれば）。どちらも空は 23514・別の会社のグループは 22023・前の形（client_id だけ）は今までどおり入る", async () => {
    const put = async (sql: string, p: unknown[]) => {
      try {
        await f.admin.query(sql, p);
        return "ok";
      } catch (e) {
        return String((e as { code?: unknown }).code);
      }
    };
    const og = await group("別の会社の社", { tenant: O.tenantId });
    const client = (
      await f.admin.query<{ id: string }>("insert into clients (tenant_id, name) values ($1, $2) returning id", [
        T.tenantId,
        `列${randomUUID().slice(0, 4)}`,
      ])
    ).rows[0]!.id;
    expect(
      await put("insert into client_requests (tenant_id, guest_group_id, title) values ($1, $2, 'x')", [
        T.tenantId,
        gA,
      ]),
    ).toBe("ok");
    expect(await put("insert into client_requests (tenant_id, title) values ($1, 'x')", [T.tenantId])).toBe("23514");
    expect(
      await put("insert into client_requests (tenant_id, guest_group_id, title) values ($1, $2, 'x')", [
        T.tenantId,
        og,
      ]),
    ).toBe("22023");
    expect(
      await put("insert into client_requests (tenant_id, client_id, title) values ($1, $2, 'x')", [T.tenantId, client]),
    ).toBe("ok");
  });
});
