// K-927「ゲストのグループの名前を直す・消す口（updateGuestGroup・deleteGuestGroup）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K927-API-…）は 11_tickets/K-927.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/guest-group-edit.ts の register（K-326）。
// 試験が決める口の形（契約は 05_flow/screen_api.d/K-927.py で作る）:
//   updateGuestGroup  PATCH  /api/v1/guest-groups/:id   body { name }（知らない欄は 422）→ 200 { data: { id, name } }
//   deleteGuestGroup  DELETE /api/v1/guest-groups/:id   → 200 { data: { id } }
//   断り：無い・消した・別の会社は 404・E-GST-001（欄・details なし）／名前の重なり 409・E-GST-002／権限なし 403／ログインなし 401／503 E-PAGE-003
//   消す：1 つの取引で、見せる相手を外し・中のゲストを会社から抜けた扱い（members.deleted_at・所属 status left）にしセッションを切り（理由 guest_group_deleted）・受けていない招待を取り消し・グループに deleted_at を付ける。チケット・依頼・やり取りは残る
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const HOOKS_DIR = join(HERE, "..", "..", "..", "src", "hooks");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (code: string): string => ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${code} が無い）`;
const NO_SUCH = "00000000-0000-4000-8000-0000000000dd";

let f: Fixture;
let loaded = false;
const mails: unknown[] = [];
/** true の間、メールの送り出し（偽）は呼ばれると落ちる。K927-API-017 の失敗の行が、呼ばれないことを見る */
const mailFails = { value: false };
async function ready(): Promise<void> {
  if (loaded) return;
  const m = (await import(join(HOOKS_DIR, "guest-group-edit.ts"))) as { register: HookModule };
  const mailer = async (x: unknown) => {
    mails.push(x);
    if (mailFails.value) throw new Error("送り出しが落ちた");
  };
  Object.assign(f.hooks, m.register.make({ appPool: f.pool, mailer } as unknown as HookDeps));
  // K927-API-020 はグループの一覧（K-876 の listGuestGroups）で消えた後を見るので、その口の hooks も足す
  const list = (await import(join(HOOKS_DIR, "guest-groups.ts"))) as { register: HookModule };
  Object.assign(f.hooks, list.register.make({ appPool: f.pool, mailer } as unknown as HookDeps));
  loaded = true;
}
beforeAll(async () => {
  f = await makeFixture([]);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

type Json = Record<string, unknown>;
const asJson = async (r: Response): Promise<Json> => (await r.clone().json()) as Json;
const bare = (j: Json): void => {
  for (const k of ["field", "details", "detail"]) expect(Object.keys(j), `${k} を付けない`).not.toContain(k);
};
interface World {
  tenantId: string;
  root: string;
  admin: Person; // 管理者（members の edit を持つ）
  editor: Person; // members の edit を付けた人
  inviter: Person; // 招く権限（invite）だけの人
  mgr: Person;
  member: Person;
}
async function memberOf(w: { tenantId: string; root: string }, name: string, role: string): Promise<Person> {
  const p = await f.person(w.tenantId, w.root, { name, ticketAbility: "edit" });
  await f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, null, $3, 'active')",
    [w.tenantId, p.id, role],
  );
  return p;
}
async function world(): Promise<World> {
  await ready();
  const c = await f.company(`K927 の会社 ${Math.random().toString(36).slice(2, 7)}`, "GE");
  const base = { tenantId: c.tenantId, root: c.rootScope };
  const grant = async (p: Person, ability: string) =>
    f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, $3)",
      [c.tenantId, p.id, ability],
    );
  const editor = await memberOf(base, "編集の人", "member");
  await grant(editor, "edit");
  const inviter = await memberOf(base, "招く権限の人", "member");
  await grant(inviter, "invite");
  return {
    ...base,
    admin: await memberOf(base, "高本", "admin"),
    editor,
    inviter,
    mgr: await memberOf(base, "マネージャー", "manager"),
    member: await memberOf(base, "普通の人", "member"),
  };
}
const gg = async (
  w: World,
  name: string,
  o: { deleted?: boolean; tenant?: string; scope?: string } = {},
): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      "insert into guest_groups (tenant_id, name, request_scope_id, deleted_at) values ($1, $2, $3, $4) returning id",
      [o.tenant ?? w.tenantId, name, o.scope ?? w.root, o.deleted ? new Date() : null],
    )
  ).rows[0]!.id;
const guest = async (w: World, name: string, g: string): Promise<Person> => {
  const p = await f.person(w.tenantId, w.root, { name });
  await f.admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, null, 'requester', 'active')",
    [w.tenantId, p.id],
  );
  await f.admin.query("insert into guest_group_members (tenant_id, guest_group_id, member_id) values ($1, $2, $3)", [
    w.tenantId,
    g,
    p.id,
  ]);
  return p;
};
const session = async (w: World, p: Person): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      "insert into sessions (tenant_id, member_id, kind_id, auth_session_id) values ($1, $2, 'web', $3) returning id",
      [w.tenantId, p.id, `k927-${randomUUID()}`],
    )
  ).rows[0]!.id;
const ticket = async (w: World): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title)
       select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'),
              (select id from ticket_stages where tenant_id = $1 and key = 'doing'), '見せていたチケット' returning id`,
      [w.tenantId, w.root],
    )
  ).rows[0]!.id;
const share = async (w: World, t: string, g: string): Promise<void> => {
  await f.admin.query(
    "insert into ticket_guest_shares (tenant_id, ticket_id, guest_group_id, shared_by) values ($1, $2, $3, $4)",
    [w.tenantId, t, g, w.admin.id],
  );
};
const rename = (id: string, body: unknown, p: Person | null, role: "member" | "client" = "member") =>
  f.req("PATCH", `/guest-groups/${id}`, { body, ...(p ? { headers: f.as(p, role) } : {}) });
const remove = (id: string, p: Person | null, role: "member" | "client" = "member") =>
  f.req("DELETE", `/guest-groups/${id}`, p ? { headers: f.as(p, role) } : {});
const n = async (sql: string, p: unknown[] = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);
const nameOf = async (g: string) =>
  (await f.admin.query<{ name: string }>("select name from guest_groups where id = $1", [g])).rows[0]!.name;
const live = (g: string) => n("select count(*) as n from guest_groups where id = $1 and deleted_at is null", [g]);
const audit = (w: World, action: string) =>
  f.admin.query<{ payload: Json }>(
    "select payload from audit_events where tenant_id = $1 and action = $2 order by created_at",
    [w.tenantId, action],
  );
const asGuest = (w: World, p: Person): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role: "client",
  stepUpAt: null,
});
const guestSees = async (w: World, p: Person, t: string): Promise<number> =>
  withTenant(
    f.pool,
    asGuest(w, p),
    async (cl) => (await cl.query("select id from tickets where id = $1", [t])).rowCount ?? 0,
  );
async function failOn(table: string, cond: string, fn: () => Promise<void>): Promise<void> {
  const name = `k927_fail_${randomUUID().replaceAll("-", "")}`;
  await f.admin.query(
    `create function app.${name}() returns trigger language plpgsql as $$ begin if ${cond} then raise exception 'K927 試験の失敗'; end if; return new; end $$`,
  );
  await f.admin.query(`create trigger ${name} before insert on ${table} for each row execute function app.${name}()`);
  try {
    await fn();
  } finally {
    await f.admin.query(`drop trigger if exists ${name} on ${table}`);
    await f.admin.query(`drop function if exists app.${name}()`);
  }
}
const inv = async (
  w: World,
  g: string | null,
  o: { accepted?: boolean; revoked?: boolean; role?: string } = {},
): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      `insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, guest_group_id, accepted_member_id, revoked_at)
       values ($1, $2, $3, $4, $5, now() + interval '7 days', $6, $7, $8) returning id`,
      [
        w.tenantId,
        `${randomUUID().slice(0, 8)}@guest.example`,
        (o.role ?? "requester") === "requester" ? null : w.root,
        o.role ?? "requester",
        randomUUID().replaceAll("-", ""),
        g,
        o.accepted ? w.admin.id : null,
        o.revoked ? new Date() : null,
      ],
    )
  ).rows[0]!.id;

describe("K-927 名前を直す（updateGuestGroup）", () => {
  it("K927-API-001 直す：200・答えの鍵はちょうど id・name・名前は前後の空白が取れて入る・name_key が新しくなる・届け先と中のゲストはそのまま・証跡 guest_group.renamed が 1 行で payload は guest_group_id だけ", async () => {
    const w = await world();
    const g = await gg(w, "旧Ａ社");
    const a = await guest(w, "山田", g);
    const keyBefore = (await f.admin.query<{ k: string }>("select name_key as k from guest_groups where id = $1", [g]))
      .rows[0]!.k;
    const r = await rename(g, { name: "  新Ａ社（ゲスト）  " }, w.admin);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    const d = (await asJson(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual(["id", "name"]);
    expect(d).toEqual({ id: g, name: "新Ａ社（ゲスト）" });
    expect(await nameOf(g)).toBe("新Ａ社（ゲスト）");
    expect(
      (await f.admin.query<{ k: string }>("select name_key as k from guest_groups where id = $1", [g])).rows[0]!.k,
    ).not.toBe(keyBefore);
    expect(
      await n(
        "select count(*) as n from guest_group_members where guest_group_id = $1 and member_id = $2 and deleted_at is null",
        [g, a.id],
      ),
    ).toBe(1);
    expect(
      (await f.admin.query<{ s: string }>("select request_scope_id as s from guest_groups where id = $1", [g])).rows[0]!
        .s,
    ).toBe(w.root);
    const ev = await audit(w, "guest_group.renamed");
    expect(ev.rows.map((x) => x.payload)).toEqual([{ guest_group_id: g }]);
  });

  it("K927-API-002 表記ゆらぎ：別のグループと空白・大文字小文字・全角半角だけ違う名前は 409・E-GST-002・正本の文・欄・details なし・名前は変わらない。自分の名前の大文字小文字だけを直すのは 200", async () => {
    const w = await world();
    const [g1, g2] = [await gg(w, "Alpha Corp"), await gg(w, "Beta Corp")];
    for (const dup of ["alpha corp", "ＡＬＰＨＡ　ＣＯＲＰ", " Alpha  Corp "]) {
      const r = await rename(g2, { name: dup }, w.admin);
      expect(r.status, dup).toBe(409);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-GST-002");
      expect(j["message"]).toBe(msg("E-GST-002"));
      bare(j);
    }
    expect(await nameOf(g2)).toBe("Beta Corp");
    expect((await rename(g1, { name: "ALPHA CORP" }, w.admin)).status).toBe(200);
    expect(await nameOf(g1)).toBe("ALPHA CORP");
  });

  it("K927-API-003 入力：名前が無い・空・空白だけ・81 字・数字・知らない欄はどれも 422・何も変えない。80 字は通る", async () => {
    const w = await world();
    const g = await gg(w, "入力の社");
    for (const b of [
      {},
      { name: "" },
      { name: "   " },
      { name: "あ".repeat(81) },
      { name: 7 },
      { name: "社", request_scope_id: w.root },
    ]) {
      expect((await rename(g, b, w.admin)).status, JSON.stringify(b)).toBe(422);
    }
    expect(await nameOf(g)).toBe("入力の社");
    expect((await rename(g, { name: "あ".repeat(80) }, w.admin)).status).toBe(200);
  });

  it("K927-API-004 失敗：無い・消した・別の会社・知らない id は 404・E-GST-001・正本の文・欄・details なし・何も変えない", async () => {
    const w = await world();
    const o = await f.company("K927 別の会社", "OZ");
    const [dead, other] = [
      await gg(w, "消した社", { deleted: true }),
      await gg(w, "別の会社の社", { tenant: o.tenantId, scope: o.rootScope }),
    ];
    for (const id of [dead, other, NO_SUCH]) {
      const r = await rename(id, { name: "直せない" }, w.admin);
      expect(r.status, id).toBe(404);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-GST-001");
      expect(j["message"]).toBe(msg("E-GST-001"));
      bare(j);
    }
    expect(await nameOf(dead)).toBe("消した社");
    expect(await nameOf(other)).toBe("別の会社の社");
  });

  it("K927-API-005 守り（直す権限）：管理者・members の edit を付けた人は 200。マネージャー・普通のメンバー・招く権限（invite）だけの人・ゲストの文脈は 403・ログインしていない人は 401・何も変えない", async () => {
    const w = await world();
    const g = await gg(w, "権限の社");
    const gst = await guest(w, "ゲスト", g);
    for (const p of [w.mgr, w.member, w.inviter])
      expect((await rename(g, { name: "通らない" }, p)).status, p.id).toBe(403);
    expect((await rename(g, { name: "ゲストから" }, gst, "client")).status).toBe(403);
    expect((await rename(g, { name: "ログインなし" }, null)).status).toBe(401);
    expect(await nameOf(g)).toBe("権限の社");
    expect((await rename(g, { name: "編集の人から" }, w.editor)).status).toBe(200);
    expect((await rename(g, { name: "管理者から" }, w.admin)).status).toBe(200);
  });
});

describe("K-927 消す（deleteGuestGroup）", () => {
  it("K927-API-006 消す：200・答えの鍵は id だけ・グループと所属の行に deleted_at・一覧の口（listGuestGroups）に出ない", async () => {
    const w = await world();
    const g = await gg(w, "消す社");
    const [a, b] = [await guest(w, "山田", g), await guest(w, "鈴木", g)];
    const r = await remove(g, w.admin);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(Object.keys((await asJson(r)).data as Json)).toEqual(["id"]);
    expect(await live(g)).toBe(0);
    expect(
      await n("select count(*) as n from guest_group_members where guest_group_id = $1 and deleted_at is null", [g]),
    ).toBe(0);
    expect(
      await n(
        "select count(*) as n from guest_group_members where guest_group_id = $1 and member_id = any($2::uuid[])",
        [g, [a.id, b.id]],
      ),
    ).toBe(2);
    const list = await f.req("GET", "/guest-groups", { headers: f.as(w.admin, "member") });
    if (list.status === 200) {
      const groups = ((await asJson(list)).data as { groups: { id: string }[] }).groups;
      expect(groups.map((x) => x.id)).not.toContain(g);
    }
  });

  it("K927-API-007 守り（G-14）：中のゲストの members.deleted_at が付き・所属 status が left・生きていたセッションは revoked（理由 guest_group_deleted）。別のグループのゲストは何も変わらない", async () => {
    const w = await world();
    const [g, keep] = [await gg(w, "消す社"), await gg(w, "残す社")];
    const [a, b] = [await guest(w, "消える山田", g), await guest(w, "残る佐藤", keep)];
    const [sa, sb] = [await session(w, a), await session(w, b)];
    expect((await remove(g, w.admin)).status).toBe(200);
    const row = async (id: string) =>
      (
        await f.admin.query<{ d: Date | null; st: string }>(
          "select m.deleted_at as d, tm.status as st from members m join tenant_memberships tm on tm.member_id = m.id where m.id = $1",
          [id],
        )
      ).rows[0]!;
    expect((await row(a.id)).d).not.toBeNull();
    expect((await row(a.id)).st).toBe("left");
    expect((await row(b.id)).d).toBeNull();
    expect((await row(b.id)).st).toBe("active");
    const ses = async (id: string) =>
      (
        await f.admin.query<{ r: Date | null; why: string | null }>(
          "select revoked_at as r, revoke_reason_id as why from sessions where id = $1",
          [id],
        )
      ).rows[0]!;
    expect((await ses(sa)).r).not.toBeNull();
    expect((await ses(sa)).why).toBe("guest_group_deleted");
    expect((await ses(sb)).r).toBeNull();
    expect(await live(keep)).toBe(1);
  });

  it("K927-API-008 守り（G-14）：消した直後、ゲストの文脈は自分のグループを持たず（my_guest_group が null）、見せていたチケットを読めない。社内の人は変わらず読める", async () => {
    const w = await world();
    const g = await gg(w, "消す社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    expect(await guestSees(w, a, t)).toBe(1);
    expect((await remove(g, w.admin)).status).toBe(200);
    expect(await guestSees(w, a, t)).toBe(0);
    const grp = await withTenant(
      f.pool,
      asGuest(w, a),
      async (cl) => (await cl.query<{ g: string | null }>("select app.my_guest_group() as g")).rows[0]!.g,
    );
    expect(grp).toBeNull();
    const staff = await withTenant(
      f.pool,
      { tenantId: w.tenantId, userId: w.admin.id, role: "member", stepUpAt: null },
      async (cl) => (await cl.query("select id from tickets where id = $1", [t])).rowCount ?? 0,
    );
    expect(staff).toBe(1);
  });

  it("K927-API-009 残る物：見せていたチケット・依頼（状態も変わらない）・依頼のやり取り・チケットのチャットは残る。チケットは消えず deleted_at は空のまま", async () => {
    const w = await world();
    const g = await gg(w, "消す社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    const req = (
      await f.admin.query<{ id: string }>(
        "insert into client_requests (tenant_id, guest_group_id, title, body, state, created_by) values ($1, $2, '依頼', '本文', 'asking', $3) returning id",
        [w.tenantId, g, a.id],
      )
    ).rows[0]!.id;
    await f.admin.query(
      "insert into client_request_messages (tenant_id, client_request_id, side, kind, body, author_member_id) values ($1, $2, 'guest', 'message', 'やり取り', $3)",
      [w.tenantId, req, a.id],
    );
    await f.admin.query(
      "insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, guest_visible) values ($1, $2, $3, 'post', 'チャット', true)",
      [w.tenantId, t, a.id],
    );
    expect((await remove(g, w.admin)).status).toBe(200);
    expect(await n("select count(*) as n from tickets where id = $1 and deleted_at is null", [t])).toBe(1);
    expect(
      (
        await f.admin.query<{ state: string; g: string }>(
          "select state, guest_group_id as g from client_requests where id = $1 and deleted_at is null",
          [req],
        )
      ).rows[0],
    ).toEqual({ state: "asking", g });
    expect(
      await n("select count(*) as n from client_request_messages where client_request_id = $1 and deleted_at is null", [
        req,
      ]),
    ).toBe(1);
    expect(await n("select count(*) as n from ticket_messages where ticket_id = $1 and deleted_at is null", [t])).toBe(
      1,
    );
  });

  it("K927-API-010 守り：そのグループへの見せる相手の行は全部 deleted_at。別のグループへの行は残る。外した 1 つごとに証跡 ticket.guest_share_removed", async () => {
    const w = await world();
    const [g, keep] = [await gg(w, "消す社"), await gg(w, "残す社")];
    const [t1, t2] = [await ticket(w), await ticket(w)];
    await share(w, t1, g);
    await share(w, t2, g);
    await share(w, t2, keep);
    expect((await remove(g, w.admin)).status).toBe(200);
    expect(
      await n("select count(*) as n from ticket_guest_shares where guest_group_id = $1 and deleted_at is null", [g]),
    ).toBe(0);
    expect(
      await n("select count(*) as n from ticket_guest_shares where guest_group_id = $1 and deleted_at is null", [keep]),
    ).toBe(1);
    expect((await audit(w, "ticket.guest_share_removed")).rows.length).toBe(2);
  });

  it("K927-API-011 失敗：消す：無い・消した（2 回目）・別の会社・知らない id は 404・E-GST-001・欄・details なし・何も変えない", async () => {
    const w = await world();
    const o = await f.company("K927 別の会社 2", "OY");
    const [once, other] = [
      await gg(w, "一度だけ"),
      await gg(w, "別の会社の社", { tenant: o.tenantId, scope: o.rootScope }),
    ];
    expect((await remove(once, w.admin)).status).toBe(200);
    for (const id of [once, other, NO_SUCH]) {
      const r = await remove(id, w.admin);
      expect(r.status, id).toBe(404);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-GST-001");
      bare(j);
    }
    expect(await live(other)).toBe(1);
  });

  it("K927-API-012 守り（消す権限）：管理者・members の edit を付けた人は 200。マネージャー・普通のメンバー・招く権限だけの人・ゲストの文脈は 403・ログインしていない人は 401・何も変えない", async () => {
    const w = await world();
    const g = await gg(w, "権限の社");
    const gst = await guest(w, "ゲスト", g);
    for (const p of [w.mgr, w.member, w.inviter]) expect((await remove(g, p)).status, p.id).toBe(403);
    expect((await remove(g, gst, "client")).status).toBe(403);
    expect((await remove(g, null)).status).toBe(401);
    expect(await live(g)).toBe(1);
    expect((await remove(g, w.editor)).status).toBe(200);
    const g2 = await gg(w, "管理者が消す社");
    expect((await remove(g2, w.admin)).status).toBe(200);
  });

  it("K927-API-013 招待：このグループの受けていない招待は revoked_at が付く。受けた・取り消し済み・別のグループ・メンバーの役の招待は触らない", async () => {
    const w = await world();
    const [g, other] = [await gg(w, "消す社"), await gg(w, "別の社")];
    const [open, accepted, done, otherInv, memberInv] = [
      await inv(w, g),
      await inv(w, g, { accepted: true }),
      await inv(w, g, { revoked: true }),
      await inv(w, other),
      await inv(w, null, { role: "member" }),
    ];
    expect((await remove(g, w.admin)).status).toBe(200);
    const revoked = async (id: string) =>
      (await f.admin.query<{ r: Date | null }>("select revoked_at as r from invitations where id = $1", [id])).rows[0]!
        .r;
    expect(await revoked(open)).not.toBeNull();
    expect(await revoked(accepted)).toBeNull();
    expect(await revoked(done)).not.toBeNull();
    expect(await revoked(otherInv)).toBeNull();
    expect(await revoked(memberInv)).toBeNull();
  });

  it("K927-API-014 失敗（手順 2 の途中）：証跡 guest_group.deleted を書けなければ 503・E-PAGE-003・グループも所属も人もセッションも招待も見せる相手も何も変わらない（1 つの取引）", async () => {
    const w = await world();
    const g = await gg(w, "戻る社");
    const a = await guest(w, "山田", g);
    const s = await session(w, a);
    const i = await inv(w, g);
    const t = await ticket(w);
    await share(w, t, g);
    await failOn("audit_events", "new.action = 'guest_group.deleted'", async () => {
      const r = await remove(g, w.admin);
      expect(r.status).toBe(503);
      expect((await asJson(r))["code"]).toBe("E-PAGE-003");
    });
    expect(await live(g)).toBe(1);
    expect(
      (await f.admin.query<{ d: Date | null }>("select deleted_at as d from members where id = $1", [a.id])).rows[0]!.d,
    ).toBeNull();
    expect(
      (await f.admin.query<{ r: Date | null }>("select revoked_at as r from sessions where id = $1", [s])).rows[0]!.r,
    ).toBeNull();
    expect(
      (await f.admin.query<{ r: Date | null }>("select revoked_at as r from invitations where id = $1", [i])).rows[0]!
        .r,
    ).toBeNull();
    expect(
      await n("select count(*) as n from ticket_guest_shares where guest_group_id = $1 and deleted_at is null", [g]),
    ).toBe(1);
    expect((await remove(g, w.admin)).status).toBe(200);
  });

  it("K927-API-015 守り（証跡）：消すと guest_group.deleted が 1 行・payload は guest_group_id・guest_count・share_count だけ（名前もメールも載せない）。断られた消すは書かない", async () => {
    const w = await world();
    const g = await gg(w, "証跡の社名");
    await guest(w, "山田", g);
    await guest(w, "鈴木", g);
    const t = await ticket(w);
    await share(w, t, g);
    await remove(NO_SUCH, w.admin);
    await remove(g, w.member);
    expect((await remove(g, w.admin)).status).toBe(200);
    const ev = await audit(w, "guest_group.deleted");
    expect(ev.rows.map((x) => x.payload)).toEqual([{ guest_group_id: g, guest_count: 2, share_count: 1 }]);
    expect(JSON.stringify(ev.rows[0]!.payload)).not.toContain("証跡の社名");
  });

  it("K927-API-016 操作の揺れ：同時に 2 人が消すと、片方が 200・もう片方が 404・E-GST-001（証跡は 1 行）", async () => {
    const w = await world();
    const g = await gg(w, "同時の社");
    await guest(w, "山田", g);
    const [r1, r2] = await Promise.all([remove(g, w.admin), remove(g, w.editor)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 404]);
    const lost = r1.status === 404 ? r1 : r2;
    expect((await asJson(lost))["code"]).toBe("E-GST-001");
    expect((await audit(w, "guest_group.deleted")).rows.length).toBe(1);
  });

  it("K927-API-017 外に出す物：直す・消すで、メールを 1 通も送らず、ゲストの受け箱に何も入れない", async () => {
    const w = await world();
    const g = await gg(w, "静かな社");
    const a = await guest(w, "山田", g);
    const before = mails.length;
    const inbox = () => n("select count(*) as n from notifications where member_id = $1", [a.id]);
    const had = await inbox();
    expect((await rename(g, { name: "静かな社（改）" }, w.admin)).status).toBe(200);
    expect((await remove(g, w.admin)).status).toBe(200);
    expect(mails.length).toBe(before);
    expect(await inbox()).toBe(had);
  });

  it("K927-API-017 失敗（外に出す物）：メール・お知らせの送り出しが落ちる設定でも、直す・消すは変わらず 200（送り出しの部品を呼ばない）", async () => {
    const w = await world();
    const g = await gg(w, "送らない社");
    await guest(w, "山田", g);
    const before = mails.length;
    const saved = mailFails.value;
    mailFails.value = true;
    try {
      expect((await rename(g, { name: "送らない社（改）" }, w.admin)).status).toBe(200);
      expect((await remove(g, w.admin)).status).toBe(200);
    } finally {
      mailFails.value = saved;
    }
    expect(mails.length).toBe(before);
  });

  it("K927-API-018 操作の揺れ：消した名前でもう一度作れる（一意は消していない物だけ）。消したグループは名前を直せない（404）", async () => {
    const w = await world();
    const g = await gg(w, "使い回す社");
    expect((await remove(g, w.admin)).status).toBe(200);
    const again = await gg(w, "使い回す社");
    expect(await live(again)).toBe(1);
    expect((await rename(g, { name: "直せない" }, w.admin)).status).toBe(404);
  });

  it("K927-API-019 対象の状態：人のいないグループも消せる。200・ゲスト 0 人・見せる相手 0・証跡の件数は 0", async () => {
    const w = await world();
    const g = await gg(w, "空の社");
    expect((await remove(g, w.admin)).status).toBe(200);
    expect((await audit(w, "guest_group.deleted")).rows.map((x) => x.payload)).toEqual([
      { guest_group_id: g, guest_count: 0, share_count: 0 },
    ]);
  });

  it("K927-API-020 守り（消えた後の行は読みから外れる）：口で消したグループは、グループの一覧（listGuestGroups）に出ず・見せていたチケットはそのグループのゲストに見えず・名前を直す口は 404", async () => {
    const w = await world();
    const g = await gg(w, "消えて見えない社");
    const a = await guest(w, "山田", g);
    const t = await ticket(w);
    await share(w, t, g);
    const listed = async (): Promise<string[]> =>
      (
        (await asJson(await f.req("GET", "/guest-groups", { headers: f.as(w.admin, "member") }))).data as {
          groups: { id: string }[];
        }
      ).groups.map((x) => x.id);
    expect(await listed()).toContain(g);
    expect((await remove(g, w.admin)).status).toBe(200);
    expect(await listed()).not.toContain(g);
    expect(await guestSees(w, a, t)).toBe(0);
    expect((await rename(g, { name: "直す" }, w.admin)).status).toBe(404);
  });

  it("K927-API-021 守り（上限）：直す・消すとも、同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数・no-store", async () => {
    const w = await world();
    const g = await gg(w, "上限の社");
    for (const [op, call] of [
      ["updateGuestGroup", (i: number) => rename(g, { name: `上限 ${i}` }, w.admin)],
      ["deleteGuestGroup", () => remove(NO_SUCH, w.admin)],
    ] as const) {
      f.limits[op] = 2;
      try {
        const rs = [];
        for (let i = 0; i < 3; i++) rs.push(await call(i));
        expect(rs[2]!.status, op).toBe(429);
        const j = await asJson(rs[2]!);
        expect(Number.isInteger(j["retry_after_sec"])).toBe(true);
        expect(j["retry_after_sec"] as number).toBeGreaterThanOrEqual(1);
        expect(j["retry_after_sec"] as number).toBeLessThanOrEqual(60);
        expect(rs[2]!.headers.get("cache-control") ?? "").toContain("no-store");
      } finally {
        delete f.limits[op];
      }
    }
  });

  it("K927-API-022 守り（no-store）：200 の答え・404 の答えに Cache-Control の private か no-store が付く", async () => {
    const w = await world();
    const g = await gg(w, "答えの社");
    const ok = await rename(g, { name: "答えの社（改）" }, w.admin);
    const gone = await remove(NO_SUCH, w.admin);
    const del = await remove(g, w.admin);
    for (const r of [ok, gone, del]) expect(r.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
  });
});
