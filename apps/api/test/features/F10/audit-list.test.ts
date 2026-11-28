// K-823「記録を探す口 listAuditEvents（札・人・チケット・期間・続き・権限の分け方）」の口の試験（本物の DB・本物の行の守り・
//   口の入口は createApp と契約の op・偽の画面のログイン・記録の行は admin の接続で audit_events に直に入れる）。
//   行 ID（K823-API-…）は 11_tickets/K-823.md の表と 1 対 1。口の振る舞いは葉の hooks のファイル apps/api/src/hooks/audit.ts の register（K-326）。
//   ことばで探す（q）は K-850（audit-search.test.ts）。書き出しは作らない（D-154.4）。
//   入力の形（K-823 の契約・05_flow/screen_api.d/K-823.py）:
//     listAuditEvents  GET /audit_events?kind&member_id&ticket_id&from&to&cursor&limit
//       → 200 { data: { entries: [{ id, occurred_at, kind, action, actor: {id,name}|null, target: {type,id,label}|null, text, reason, device, step_up, deleted }], next_cursor } }
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateAuth } from "@kaname/auth/migrate";
import { createRepository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { AUDIT_KINDS, AUDIT_LIMIT_DEFAULT, AUDIT_LIMIT_MAX } from "../../../src/features/F10/audit/patterns.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const HOOK_FILE = join(HERE, "..", "..", "..", "src", "hooks", "audit.ts");
const BASE = Date.parse("2026-11-20T00:00:00Z");
const at = (sec: number) => new Date(BASE + sec * 1000).toISOString();
// 続きの印は base64url（パディングなし・1〜200 字）。中身は <occurred_at の UTC・マイクロ秒 6 桁の ISO>_<id>（K-823 の前提と制約）
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const CURSOR_FORM = /^[A-Za-z0-9_-]{1,200}$/;

let f: Fixture;
let app: ReturnType<typeof createApp>;
const hooks: Record<string, Hook> = {};
const limits: Record<string, number> = {};
let loading: Promise<void> | null = null;
let T: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let JD: string;
let CS: string;
let admin: Person, boss: Person, mgr: Person, mgrJD: Person, worker: Person, staff: Person;
let viewer: Person, req0: Person, stopped: Person, burst: Person, outsider: Person;
let tJD: string, tCS: string, tEG: string;
const E: Record<string, string> = {};

type Entry = {
  id: string;
  occurred_at: string;
  kind: string | null;
  action: string;
  actor: { id: string; name: string } | null;
  target: { type: string; id: string; label: string | null } | null;
  text: string;
  reason: string | null;
  device: string | null;
  step_up: boolean;
  deleted: boolean;
};
type J = Record<string, unknown> & { data?: { entries: Entry[]; next_cursor: string | null }; details?: unknown };
const json = async (r: Response) => (await r.clone().json()) as J;
const auth = (p: Person) => ({ authorization: `Bearer fake:member:${p.tenantId}:${p.id}` });
const get = (p: Person | null, qs = "") =>
  Promise.resolve(
    app.request(`http://localhost/api/v1/audit_events${qs ? `?${qs}` : ""}`, {
      method: "GET",
      headers: { "x-forwarded-for": nextIp(), ...(p ? auth(p) : {}) },
    }),
  );
const ids = async (r: Response) => ((await json(r)).data?.entries ?? []).map((e) => e.id);
const ready = async () => {
  loading ??= (async () => {
    if (!existsSync(HOOK_FILE)) return;
    const d = {
      appPool: f.pool,
      repo: await createRepository(f.pool),
      mailer: async () => undefined,
      config: { env: "test", webBaseUrl: "http://localhost:3000", opsEmail: "ops@example.com" },
    } as unknown as HookDeps;
    Object.assign(hooks, ((await import(HOOK_FILE)) as { register: HookModule }).register.make(d));
  })();
  await loading;
};
const one = async <R = string>(sql: string, p: unknown[] = []) => (await f.admin.query<{ v: R }>(sql, p)).rows[0]!.v;
const n = async (sql: string, p: unknown[] = []) => Number(await one<string>(sql, p));
const sortSet = (a: string[]) => [...a].sort();

async function ev(o: {
  tenant?: string;
  actor?: Person | null;
  action: string;
  type?: string;
  target?: string | null;
  payload?: Record<string, unknown>;
  sec: number;
}): Promise<string> {
  return one(
    `insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, payload, occurred_at)
     values ($1, $2, 'member', $3, $4, $5, $6, $7) returning id as v`,
    [
      o.tenant ?? T.tenantId,
      o.actor?.id ?? null,
      o.action,
      o.type ?? "members",
      o.target ?? null,
      o.payload ?? {},
      at(o.sec),
    ],
  );
}

beforeAll(async () => {
  f = await makeFixture();
  await migrateAuth(process.env["DATABASE_URL"]!);
  const web = async (hd: Headers) => {
    const m = /^Bearer fake:(member):([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(hd.get("authorization") ?? "");
    if (!m) return null;
    const ctx: TenantContext = { tenantId: m[2]!, userId: m[3]!, role: "member", stepUpAt: null };
    return { ctx, termsPending: false, sessionId: "", authUserId: "" };
  };
  Object.assign(hooks, f.hooks);
  app = createApp({
    version: "test",
    repo: await createRepository(f.pool),
    resolve: withDevice(web, createDeviceResolver(f.pool)) as never,
    contract: { hooks, limits },
  });
  limits["listAuditEvents"] = 10_000;
  T = await f.company("株式会社K823", "EG");
  O = await f.company("K823 の別の会社", "OT");
  const scope = async (name: string, prefix: string) =>
    one("insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id as v", [
      T.tenantId,
      T.rootScope,
      name,
      prefix,
    ]);
  JD = await scope("受託開発", "JD");
  CS = await scope("サポート", "CS");
  const make = async (
    name: string,
    o: { tenant?: string; scope?: string; role?: string; stopped?: boolean; groupRole?: string } = {},
  ): Promise<Person> => {
    const tenant = o.tenant ?? T.tenantId;
    const sc = o.scope ?? (tenant === T.tenantId ? T.rootScope : O.rootScope);
    const authUserId = randomUUID();
    await f.admin.query(
      'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
      [authUserId, name, `${authUserId.slice(0, 8)}@engine-base.example`],
    );
    const p = await f.person(tenant, sc, { name, authUserId });
    await f.admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, $4, $5)",
      [tenant, p.id, authUserId, o.role ?? "member", o.stopped ? "suspended" : "active"],
    );
    await joinGroup(p, sc, o.groupRole ?? "member", true);
    return p;
  };
  const joinGroup = (p: Person, sc: string, role: string, primary = false) =>
    f.admin.query(
      `insert into scope_memberships (tenant_id, scope_id, member_id, role, is_primary) values ($1, $2, $3, $4, $5)
       on conflict (member_id, scope_id) do update set role = excluded.role, is_primary = excluded.is_primary, deleted_at = null`,
      [p.tenantId, sc, p.id, role, primary],
    );
  admin = await make("高本 聖斗", { role: "admin", groupRole: "manager" });
  boss = await make("大塚 部長", { role: "manager", groupRole: "manager" });
  mgr = await make("佐藤 花子", { scope: JD, role: "manager", groupRole: "manager" });
  await joinGroup(mgr, CS, "manager");
  mgrJD = await make("井上 リーダー", { scope: JD, role: "manager", groupRole: "manager" });
  worker = await make("鈴木 一郎", { scope: JD });
  staff = await make("田中 美咲");
  await joinGroup(staff, CS, "member");
  viewer = await make("山口 健", { scope: JD, role: "viewer", groupRole: "viewer" });
  req0 = await make("先方の人", { role: "requester" });
  stopped = await make("止めた人", { scope: JD, stopped: true });
  burst = await make("連投の人", { scope: JD });
  outsider = await make("別の会社の管理者", { tenant: O.tenantId, role: "admin" });
  const kind = await one("select id as v from ticket_kinds where tenant_id = $1 and deleted_at is null limit 1", [
    T.tenantId,
  ]);
  const stage = await one("select id as v from ticket_stages where tenant_id = $1 limit 1", [T.tenantId]);
  const tk = (sc: string, number: string) =>
    one(
      "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, created_by) values ($1, $2, $3, $4, $5, $6, $7) returning id as v",
      [T.tenantId, sc, number, kind, stage, `${number} のチケット`, admin.id],
    );
  tJD = await tk(JD, "JD-1");
  tCS = await tk(CS, "CS-1");
  tEG = await tk(T.rootScope, "EG-1");
  E["a1"] = await ev({
    actor: admin,
    action: "member.role_change",
    target: worker.id,
    // K-811 の形：{ scope_id, from, to }（役割の鍵）。reason・step_up は理由・本人確認の欄の確かめ（K823-API-014）
    payload: { scope_id: JD, from: "manager", to: "member", reason: "兼務が終わったため", step_up: true },
    sec: 10,
  });
  E["a2"] = await ev({
    actor: admin,
    action: "scope.create",
    type: "scopes",
    target: JD,
    // K-802 の形（名前は入れない）。グループの名前は対象の scopes から引く
    payload: { parent_id: T.rootScope, ticket_prefix: "JD", manager_count: 2, member_count: 4 },
    sec: 20,
  });
  E["a3"] = await ev({ actor: admin, action: "tickets.delete", type: "tickets", target: tJD, sec: 30 });
  E["a4"] = await ev({ actor: mgr, action: "tickets.delete", type: "tickets", target: tJD, sec: 40 });
  E["a5"] = await ev({ actor: worker, action: "clone.allow", type: "tickets", target: tJD, sec: 50 });
  E["a6"] = await ev({
    actor: staff,
    action: "session.new_device",
    target: staff.id,
    payload: { device: "iPhone から" },
    sec: 60,
  });
  E["a7"] = await ev({ actor: admin, action: "external.send", type: "tickets", target: tEG, sec: 70 });
  E["a8"] = await ev({ actor: worker, action: "tickets.delete", type: "tickets", target: tEG, sec: 80 });
  E["a9"] = await ev({ actor: stopped, action: "clone.allow", sec: 90 });
  E["a10"] = await ev({ actor: boss, action: "permission.granted", sec: 100 });
  E["a11"] = await ev({ actor: admin, action: "weird.thing", type: "other", sec: 110 });
  E["a12"] = await ev({ actor: admin, action: "tickets.delete", type: "tickets", target: tCS, sec: 120 });
  E["a13"] = await ev({ actor: admin, action: "member.suspend", target: staff.id, sec: 130 });
  E["o1"] = await ev({
    tenant: O.tenantId,
    actor: outsider,
    action: "member.role_change",
    target: outsider.id,
    sec: 25,
  });
  for (let i = 0; i < 120; i++)
    await ev({ actor: burst, action: "permission.granted", target: burst.id, sec: 1000 + Math.floor(i / 3) });
  await f.admin.query(
    "insert into ops_audit_events (target_tenant_id, action, target_type, occurred_at) values ($1, 'ops.support_opened', 'tenant', $2)",
    [T.tenantId, at(140)],
  );
}, 180_000);
afterAll(async () => {
  await f?.close();
});

describe("K-823 記録を探す（listAuditEvents）", () => {
  it("K823-API-001 管理者が自分の行を読む：200・no-store・1 件の形（人の名前・対象の名前・札・文・理由・本人確認）", async () => {
    await ready();
    const r = await get(admin, `member_id=${admin.id}&kind=perm`);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const e = (await json(r)).data!.entries.find((x) => x.id === E["a1"])!;
    expect(e).toMatchObject({
      kind: "perm",
      action: "member.role_change",
      actor: { id: admin.id, name: "高本 聖斗" },
      target: { type: "members", id: worker.id, label: "鈴木 一郎" },
      reason: "兼務が終わったため",
      step_up: true,
      deleted: false,
      device: null,
    });
    expect(e.occurred_at).toBe(at(10));
    expect((await json(r)).data).toMatchObject({ scope: "all" });
  });

  it("K823-API-002 並びは新しい順・同じ時刻の行は id の大きい順（連投の 120 行を SQL の並びと照らす）", async () => {
    await ready();
    const want = (
      await f.admin.query<{ id: string }>(
        "select id from audit_events where tenant_id = $1 and actor_member_id = $2 order by occurred_at desc, id desc limit 100",
        [T.tenantId, burst.id],
      )
    ).rows.map((x) => x.id);
    expect(await ids(await get(admin, `member_id=${burst.id}&limit=100`))).toEqual(want);
  });

  it("K823-API-003 札は action から決まる：権限・外に出した・新しい端末・分身・消した・当たらない action は札なし。消したは tickets.delete だけ・書く葉の名前は権限", async () => {
    await ready();
    const r = await get(admin, "limit=100&from=" + at(0) + "&to=" + at(200));
    const by = new Map((await json(r)).data!.entries.map((x) => [x.id, x]));
    const k = (id: string) => by.get(E[id]!)?.kind;
    expect([k("a1"), k("a2"), k("a7"), k("a6"), k("a5"), k("a3"), k("a11"), k("a13")]).toEqual([
      "perm",
      "perm",
      "out",
      "device",
      "ai",
      "deleted",
      null,
      "perm",
    ]);
    expect(by.get(E["a3"]!)!.deleted).toBe(true);
    expect(by.get(E["a1"]!)!.deleted).toBe(false);
    // 消した（30 日は戻せる）はチケットの tickets.delete だけ。戻せない消し方（端末の鍵・チケットのつながり）は札なし
    expect(await one("select app.audit_kind('tickets.delete') as v")).toBe("deleted");
    expect(await one("select app.audit_kind('credential.delete') as v")).toBeNull();
    expect(await one("select app.audit_kind('ticket_link.delete') as v")).toBeNull();
    // 書く葉の名前（K-800 の表・K-807・K-838）は権限の札
    for (const a of ["member.role_change", "member.left", "invitation.resend", "layer.update", "workspace.renamed"])
      expect(await one("select app.audit_kind($1) as v", [a]), a).toBe("perm");
  });

  it("K823-API-004 札で絞る：deleted は消した行だけ。運営の札は 0 件・持ち出しの札（書き出しは作らない）は無い札で 422 で、運営の記録（ops_audit_events）は出ない", async () => {
    await ready();
    const del = await ids(await get(admin, "kind=deleted&limit=100&from=" + at(0) + "&to=" + at(200)));
    expect(sortSet(del)).toEqual(sortSet([E["a3"]!, E["a4"]!, E["a8"]!, E["a12"]!]));
    expect((await get(admin, "kind=carry")).status).toBe(422);
    expect(await ids(await get(admin, "kind=ops"))).toEqual([]);
    const all = (await json(await get(admin, "limit=100"))).data!.entries;
    expect(all.some((x) => x.action === "ops.support_opened")).toBe(false);
  });

  it("K823-API-005 形の誤り：知らない札・日時でない from と to は口が 422・E-AUD-001／uuid でない member_id と ticket_id は入口が 422・VALIDATION_ERROR。details は欄ごと", async () => {
    await ready();
    for (const [qs, field, code] of [
      ["kind=bogus", "kind", "E-AUD-001"],
      ["from=昨日", "from", "E-AUD-001"],
      ["to=2026-13-45T00:00:00Z", "to", "E-AUD-001"],
      ["member_id=abc", "member_id", "VALIDATION_ERROR"],
      ["ticket_id=abc", "ticket_id", "VALIDATION_ERROR"],
    ] as const) {
      const r = await get(admin, qs);
      expect(r.status, qs).toBe(422);
      const j = await json(r);
      expect(j["code"], qs).toBe(code);
      expect(
        (j.details as { field: string }[]).map((d) => d.field),
        qs,
      ).toEqual([field]);
    }
  });

  it("K823-API-006 人と チケットで絞る：member_id はその人が起こした行・ticket_id はそのチケットの行", async () => {
    await ready();
    expect(sortSet(await ids(await get(admin, `member_id=${admin.id}&limit=100`)))).toEqual(
      sortSet([E["a1"]!, E["a2"]!, E["a3"]!, E["a7"]!, E["a11"]!, E["a12"]!, E["a13"]!]),
    );
    expect(sortSet(await ids(await get(admin, `ticket_id=${tJD}`)))).toEqual(sortSet([E["a3"]!, E["a4"]!, E["a5"]!]));
  });

  it("K823-API-007 期間：from は含み to は含まない（20 秒から 30 秒の前まで）", async () => {
    await ready();
    expect(await ids(await get(admin, `member_id=${admin.id}&from=${at(20)}&to=${at(30)}`))).toEqual([E["a2"]!]);
    expect(await ids(await get(admin, `member_id=${admin.id}&from=${at(20)}&to=${at(31)}`))).toEqual([
      E["a3"]!,
      E["a2"]!,
    ]);
  });

  it("K823-API-008 from が to より後ろ：契約に書けない形なので 422 にせず 200・0 件（決め）", async () => {
    await ready();
    const r = await get(admin, `from=${at(50)}&to=${at(10)}`);
    expect(r.status).toBe(200);
    expect((await json(r)).data).toEqual({ entries: [], next_cursor: null, scope: "all" });
  });

  it("K823-API-009 件数：既定 50・上限 100。101 は口が 422・E-AUD-001／0 と数でない値は入口が 422・VALIDATION_ERROR（どれも欄 limit）", async () => {
    await ready();
    expect(AUDIT_LIMIT_DEFAULT).toBe(50);
    expect((await ids(await get(admin, `member_id=${burst.id}`))).length).toBe(50);
    expect((await ids(await get(admin, `member_id=${burst.id}&limit=100`))).length).toBe(100);
    for (const [v, code] of [
      ["101", "E-AUD-001"],
      ["0", "VALIDATION_ERROR"],
      ["x", "VALIDATION_ERROR"],
    ] as const) {
      const r = await get(admin, `limit=${v}`);
      expect(r.status, v).toBe(422);
      const j = await json(r);
      expect(j["code"], v).toBe(code);
      expect(
        (j.details as { field: string }[]).map((d) => d.field),
        v,
      ).toEqual(["limit"]);
    }
  });

  it("K823-API-010 続き：50・50・20 と読み進めて重ならず抜けず・最後は next_cursor が null", async () => {
    await ready();
    const want = (
      await f.admin.query<{ id: string }>(
        "select id from audit_events where tenant_id = $1 and actor_member_id = $2 order by occurred_at desc, id desc",
        [T.tenantId, burst.id],
      )
    ).rows.map((x) => x.id);
    const got: string[] = [];
    let cursor: string | null = null;
    const sizes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const j: J = await json(await get(admin, `member_id=${burst.id}&limit=50${cursor ? `&cursor=${cursor}` : ""}`));
      sizes.push(j.data!.entries.length);
      got.push(...j.data!.entries.map((x) => x.id));
      cursor = j.data!.next_cursor;
      if (!cursor) break;
      expect(cursor).toMatch(CURSOR_FORM);
    }
    expect(sizes).toEqual([50, 50, 20]);
    expect(got).toEqual(want);
    // 続きを読む間に新しい行が入っても、読み終えた行は重ならない（keyset）
    await ev({ actor: burst, action: "permission.granted", sec: 5000 });
    const first: J = await json(await get(admin, `member_id=${burst.id}&limit=50`));
    expect(first.data!.entries[0]!.occurred_at).toBe(at(5000));
  });

  it("K823-API-011 続きの印：base64url の形でない印と NUL は入口が 422・VALIDATION_ERROR／形は合うがほどけない・中身が 時刻（マイクロ秒）_uuid でない・実在しない日付は口が 422・E-AUD-002（どれも欄 cursor）", async () => {
    await ready();
    for (const [c, code] of [
      ["2026-11-20T00:00:00.000000Z_" + randomUUID(), "VALIDATION_ERROR"],
      ["a".repeat(201), "VALIDATION_ERROR"],
      ["%00", "VALIDATION_ERROR"],
      ["abc", "E-AUD-002"],
      [b64("2026-11-20T00:00:00.000000Z_nope"), "E-AUD-002"],
      [b64("2026-13-45T00:00:00.000000Z_" + randomUUID()), "E-AUD-002"],
    ] as const) {
      const r = await get(admin, `cursor=${c}`);
      expect(r.status, c).toBe(422);
      const j = await json(r);
      expect(j["code"], c).toBe(code);
      expect(
        (j.details as { field: string }[]).map((d) => d.field),
        c,
      ).toEqual(["cursor"]);
    }
  });

  it("K823-API-012 文は action ごと：消した・役割を変えた・グループを作った・本人確認の取り直しは別の行で（日本語の 1 文）", async () => {
    await ready();
    const by = new Map(
      (await json(await get(admin, "limit=100&from=" + at(0) + "&to=" + at(200)))).data!.entries.map((x) => [x.id, x]),
    );
    expect(by.get(E["a3"]!)!.text).toBe("チケット JD-1 を消した");
    expect(by.get(E["a1"]!)!.text).toBe("鈴木 一郎 の役割を マネージャー から メンバー に変えた");
    expect(by.get(E["a2"]!)!.text).toBe("グループ「受託開発」を作った");
    expect(by.get(E["a13"]!)!.text).toBe("田中 美咲 を一時的に止めた");
  });

  it("K823-API-013 知らない action の文は「<action> を行った」・札なし・対象が無い行は target が null", async () => {
    await ready();
    const e = (await json(await get(admin, `member_id=${admin.id}&limit=100`))).data!.entries.find(
      (x) => x.id === E["a11"],
    )!;
    expect(e).toMatchObject({ kind: null, text: "weird.thing を行った", target: null });
  });

  it("K823-API-014 理由・端末・本人確認：payload の reason・device・step_up をそのまま（無ければ null・false）", async () => {
    await ready();
    const by = new Map(
      (await json(await get(admin, "limit=100&from=" + at(0) + "&to=" + at(200)))).data!.entries.map((x) => [x.id, x]),
    );
    expect(by.get(E["a6"]!)).toMatchObject({ device: "iPhone から", reason: null, step_up: false });
    expect(by.get(E["a1"]!)).toMatchObject({ reason: "兼務が終わったため", step_up: true, device: null });
  });

  it("K823-API-015 マネージャー（受託開発だけ）：自分のグループのチケットの行と、そのグループの人の操作だけ", async () => {
    await ready();
    const r = await get(mgrJD, "limit=100&from=" + at(0) + "&to=" + at(200));
    expect(sortSet(await ids(r))).toEqual(sortSet([E["a3"]!, E["a4"]!, E["a5"]!, E["a8"]!, E["a9"]!]));
    expect((await json(r)).data).toMatchObject({ scope: "groups" });
  });

  it("K823-API-016 マネージャーの範囲外（管理者の権限の行・別のグループの人の行・全体のチケット）は 1 行も出ない", async () => {
    await ready();
    const got = await ids(await get(mgrJD, "limit=100&from=" + at(0) + "&to=" + at(200)));
    for (const k of ["a1", "a2", "a6", "a7", "a10", "a11", "a12", "a13", "o1"]) expect(got, k).not.toContain(E[k]);
  });

  it("K823-API-017 範囲外を絞りで指しても空の 200（在るかを漏らさない）：ticket_id が別グループ・member_id が全体の人", async () => {
    await ready();
    expect(await ids(await get(mgrJD, `ticket_id=${tCS}`))).toEqual([]);
    expect(await ids(await get(mgrJD, `member_id=${boss.id}`))).toEqual([]);
    expect(sortSet(await ids(await get(mgrJD, `member_id=${admin.id}&limit=100`)))).toEqual([E["a3"]!]);
  });

  it("K823-API-018 兼務のマネージャー（受託開発の主＋サポートを兼ねる）：両方の層の分が出る。上のグループのマネージャーは下の全部", async () => {
    await ready();
    const m = await ids(await get(mgr, "limit=100&from=" + at(0) + "&to=" + at(200)));
    expect(sortSet(m)).toEqual(sortSet([E["a3"]!, E["a4"]!, E["a5"]!, E["a6"]!, E["a8"]!, E["a9"]!, E["a12"]!]));
    const b = await ids(await get(boss, "limit=100&from=" + at(0) + "&to=" + at(200)));
    expect(sortSet(b)).toEqual(
      sortSet(
        Object.keys(E)
          .filter((k) => k !== "o1")
          .map((k) => E[k]!),
      ),
    );
  });

  it("K823-API-019 別の部署に作業員として入っている人（田中：全体の主＋サポートを兼ねる）の操作は、サポートのマネージャーには出て、受託開発だけの人には出ない。兼務を外すと出なくなる", async () => {
    await ready();
    expect(await ids(await get(mgr, `member_id=${staff.id}`))).toEqual([E["a6"]!]);
    expect(await ids(await get(mgrJD, `member_id=${staff.id}`))).toEqual([]);
    await f.admin.query("update scope_memberships set deleted_at = now() where member_id = $1 and scope_id = $2", [
      staff.id,
      CS,
    ]);
    try {
      expect(await ids(await get(mgr, `member_id=${staff.id}`))).toEqual([]);
    } finally {
      await f.admin.query("update scope_memberships set deleted_at = null where member_id = $1 and scope_id = $2", [
        staff.id,
        CS,
      ]);
    }
  });

  it("K823-API-020 普通のメンバーは開けない：403・data なし（自分の記録の入口は作らない）", async () => {
    await ready();
    const r = await get(worker);
    expect(r.status).toBe(403);
    expect((await json(r)).data).toBeUndefined();
  });

  it("K823-API-021 閲覧のみ・依頼する側（先方の人）も 403", async () => {
    await ready();
    expect((await get(viewer)).status).toBe(403);
    expect((await get(req0)).status).toBe(403);
  });

  it("K823-API-022 ログインしていない：401", async () => {
    await ready();
    expect((await get(null)).status).toBe(401);
  });

  it("K823-API-023 止めた人・外した人の行も、名前そのままで管理者に出る", async () => {
    await ready();
    const e = (await json(await get(admin, `member_id=${stopped.id}`))).data!.entries[0]!;
    expect(e).toMatchObject({ id: E["a9"], actor: { id: stopped.id, name: "止めた人" } });
    await f.admin.query("update members set deleted_at = now() where id = $1", [burst.id]);
    try {
      const b = (await json(await get(admin, `member_id=${burst.id}&limit=1`))).data!.entries[0]!;
      expect(b.actor).toEqual({ id: burst.id, name: "連投の人" });
    } finally {
      await f.admin.query("update members set deleted_at = null where id = $1", [burst.id]);
    }
  });

  it("K823-API-024 会社の分離：別の会社の行は管理者にも出ない。別の会社の管理者は自分の会社の行だけ", async () => {
    await ready();
    const mine = await ids(await get(admin, "limit=100"));
    expect(mine).not.toContain(E["o1"]);
    expect(await ids(await get(outsider, "limit=100"))).toEqual([E["o1"]!]);
    expect(await ids(await get(admin, `member_id=${outsider.id}`))).toEqual([]);
  });

  it("K823-API-025 追記だけ：UPDATE と DELETE は所有者の接続でも拒まれ、行は変わらない", async () => {
    await ready();
    await expect(f.admin.query("update audit_events set action = 'x' where id = $1", [E["a1"]])).rejects.toThrow(
      /追記専用/,
    );
    await expect(f.admin.query("delete from audit_events where id = $1", [E["a1"]])).rejects.toThrow(/追記専用/);
    expect(await one("select action as v from audit_events where id = $1", [E["a1"]])).toBe("member.role_change");
  });

  it("K823-API-026 画面から記録を書く口は無い：POST・PATCH・DELETE は 404 か 405", async () => {
    await ready();
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const r = await app.request("http://localhost/api/v1/audit_events", {
        method,
        headers: { "content-type": "application/json", "x-forwarded-for": nextIp(), ...auth(admin) },
        body: method === "DELETE" ? undefined : JSON.stringify({ action: "x" }),
      });
      expect([404, 405], method).toContain(r.status);
    }
  });

  it("K823-API-027 読むだけ：何度読んでも同じ答えで、記録の行も数も増えない", async () => {
    await ready();
    const before = await n("select count(*) as v from audit_events where tenant_id = $1", [T.tenantId]);
    const a = await json(await get(admin, `member_id=${admin.id}&limit=100`));
    const b = await json(await get(admin, `member_id=${admin.id}&limit=100`));
    expect(b.data).toEqual(a.data);
    expect(await n("select count(*) as v from audit_events where tenant_id = $1", [T.tenantId])).toBe(before);
  });

  it("K823-API-028 失敗：札を決める関数が落ちたら 503・E-PAGE-003（途中までの答えを返さない）", async () => {
    await ready();
    const def = await one("select pg_get_functiondef('app.audit_kind(text)'::regprocedure) as v");
    await f.admin.query(
      "create or replace function app.audit_kind(a text) returns text language plpgsql immutable as $$ begin raise exception 'K823 試験の失敗'; end $$",
    );
    try {
      const r = await get(admin, `member_id=${admin.id}`);
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
      expect((await json(r)).data).toBeUndefined();
    } finally {
      await f.admin.query(def);
    }
  });

  it("K823-API-029 本人の確かめ：管理者として読む（取り直しは要らない・読むだけの口）。マネージャーの絞りも同じ入口で通る", async () => {
    await ready();
    expect((await get(admin)).status).toBe(200);
    expect((await get(mgrJD)).status).toBe(200);
  });

  it("K823-API-030 口と契約の同じ値：札の 6 つ・上限 100 が 08_api/openapi.yaml の listAuditEvents と 1 字も違わない", async () => {
    const y = readFileSync(join(ROOT, "08_api/openapi.yaml"), "utf8");
    const i = y.indexOf("operationId: listAuditEvents");
    expect(i).toBeGreaterThan(0);
    const block = y.slice(i, i + 4000);
    expect(AUDIT_KINDS).toEqual(["perm", "out", "device", "ai", "deleted", "ops"]);
    for (const k of AUDIT_KINDS) expect(block).toContain(k);
    expect(AUDIT_LIMIT_MAX).toBe(100);
    expect(block).toMatch(/maximum:\s*100/);
  });
});
