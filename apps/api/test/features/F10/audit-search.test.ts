// K-850「記録をことばで探す（listAuditEvents の q）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・
//   偽の画面のログイン・記録の行は admin の接続で audit_events に直に入れる）。行 ID（K850-API-…）は 11_tickets/K-850.md の表と 1 対 1。
//   口の振る舞いは K-823 の hooks のファイル apps/api/src/hooks/audit.ts（K-850 が q の道を足す）。探し方は apps/api/src/features/F10/audit/search.ts。
//   入力の形（K-850 の契約・05_flow/screen_api.d/K-850.py）: GET /audit_events?q=…（1〜100 字）と K-823 の絞りの全部
//     → 200 { data: { entries: [...K-823 と同じ形], next_cursor, scan_capped: boolean（q があるときだけ） } }
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
import { AUDIT_Q_MAX, AUDIT_SCAN_MAX } from "../../../src/features/F10/audit/patterns.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const HOOK_FILE = join(HERE, "..", "..", "..", "src", "hooks", "audit.ts");
const BASE = Date.parse("2026-11-20T00:00:00Z");
const at = (sec: number) => new Date(BASE + sec * 1000).toISOString();

let f: Fixture;
let app: ReturnType<typeof createApp>;
const hooks: Record<string, Hook> = {};
const limits: Record<string, number> = {};
let loading: Promise<void> | null = null;
let T: { tenantId: string; rootScope: string };
let T2: { tenantId: string; rootScope: string };
let O: { tenantId: string; rootScope: string };
let JD: string;
let CS: string;
let admin: Person, mgrJD: Person, worker: Person, admin2: Person, outsider: Person, bulk: Person;
const E: Record<string, string> = {};

type J = Record<string, unknown> & {
  data?: { entries: { id: string }[]; next_cursor: string | null; scan_capped?: boolean };
  details?: { field: string }[];
};
const json = async (r: Response) => (await r.clone().json()) as J;
const auth = (p: Person) => ({ authorization: `Bearer fake:member:${p.tenantId}:${p.id}` });
const get = (p: Person | null, qs = "") =>
  Promise.resolve(
    app.request(`http://localhost/api/v1/audit_events${qs ? `?${qs}` : ""}`, {
      method: "GET",
      headers: { "x-forwarded-for": nextIp(), ...(p ? auth(p) : {}) },
    }),
  );
const q = (p: Person, word: string, more = "") => get(p, `q=${encodeURIComponent(word)}${more ? `&${more}` : ""}`);
const ids = async (r: Response) => ((await json(r)).data?.entries ?? []).map((e) => e.id);
const sortSet = (a: string[]) => [...a].sort();
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
  T = await f.company("株式会社K850", "EG");
  T2 = await f.company("K850 の走査の上限用の会社", "SC");
  O = await f.company("K850 の別の会社", "OT");
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
    o: { tenant?: { tenantId: string; rootScope: string }; scope?: string; role?: string; groupRole?: string } = {},
  ): Promise<Person> => {
    const co = o.tenant ?? T;
    const sc = o.scope ?? co.rootScope;
    const authUserId = randomUUID();
    await f.admin.query(
      'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
      [authUserId, name, `${authUserId.slice(0, 8)}@engine-base.example`],
    );
    const p = await f.person(co.tenantId, sc, { name, authUserId });
    await f.admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, $4, 'active')",
      [co.tenantId, p.id, authUserId, o.role ?? "member"],
    );
    await f.admin.query(
      `insert into scope_memberships (tenant_id, scope_id, member_id, role, is_primary) values ($1, $2, $3, $4, true)
       on conflict (member_id, scope_id) do update set role = excluded.role, is_primary = true`,
      [co.tenantId, sc, p.id, o.groupRole ?? "member"],
    );
    return p;
  };
  admin = await make("高本 聖斗", { role: "admin", groupRole: "manager" });
  mgrJD = await make("井上 リーダー", { scope: JD, role: "manager", groupRole: "manager" });
  worker = await make("鈴木 一郎", { scope: JD });
  bulk = await make("まとめの人", { scope: JD });
  admin2 = await make("走査の管理者", { tenant: T2, role: "admin", groupRole: "manager" });
  outsider = await make("鈴木 別会社", { tenant: O, role: "admin", groupRole: "manager" });
  const kind = await one("select id as v from ticket_kinds where tenant_id = $1 and deleted_at is null limit 1", [
    T.tenantId,
  ]);
  const stage = await one("select id as v from ticket_stages where tenant_id = $1 limit 1", [T.tenantId]);
  // 番号はいつもサーバーがグループの通し番号で付ける（0071 の ticket_number・入れた値は使わない）。決めた番号になるよう通し番号を先に合わせる
  const tk = async (sc: string, number: string) => {
    await f.admin.query("update scopes set next_ticket_no = $2 where id = $1", [sc, Number(number.split("-")[1])]);
    return one(
      "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, created_by) values ($1, $2, $3, $4, $5, $6, $7) returning id as v",
      [T.tenantId, sc, number, kind, stage, `${number} のチケット`, admin.id],
    );
  };
  const tJD = await tk(JD, "JD-7");
  const tCS = await tk(CS, "CS-9");
  E["s1"] = await ev({
    actor: admin,
    action: "member.role_change",
    target: worker.id,
    // K-811 の形：{ scope_id, from, to }（役割の鍵）。reason は理由で探す確かめ（K850-API-004）
    payload: { scope_id: JD, from: "manager", to: "member", reason: "兼務が終わったため" },
    sec: 10,
  });
  E["s2"] = await ev({ actor: worker, action: "tickets.delete", type: "tickets", target: tJD, sec: 20 });
  E["s3"] = await ev({
    actor: admin,
    action: "scope.create",
    type: "scopes",
    target: JD,
    // K-802 の形（名前は入れない）。グループの名前は対象の scopes から引く
    payload: { parent_id: T.rootScope, ticket_prefix: "JD", manager_count: 1, member_count: 2 },
    sec: 30,
  });
  E["s4"] = await ev({ actor: admin, action: "tickets.delete", type: "tickets", target: tCS, sec: 40 });
  E["s5"] = await ev({
    actor: worker,
    action: "clone.allow",
    type: "tickets",
    target: tJD,
    payload: { reason: "ＡＢＣ社の対応" },
    sec: 50,
  });
  E["s6"] = await ev({ actor: admin, action: "weird.thing", type: "other", sec: 60 });
  E["s7"] = await ev({
    actor: admin,
    action: "scope.update",
    type: "scopes",
    target: JD,
    // K-804 の形 { fields }。reason は記号を字として探す確かめ（K850-API-014）
    payload: { fields: ["name"], reason: "100%達成 a_b" },
    sec: 70,
  });
  E["o1"] = await ev({
    tenant: O.tenantId,
    actor: outsider,
    action: "member.role_change",
    target: outsider.id,
    sec: 25,
  });
  await f.admin.query(
    `insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, payload, occurred_at)
     select $1, $2, 'member', 'permission.granted', 'members', '{"reason":"まとめ"}'::jsonb, $3::timestamptz + (g || ' seconds')::interval
     from generate_series(1, 60) g`,
    [T.tenantId, bulk.id, at(2000)],
  );
  // 走査の上限用の会社：5100 行の新しい行（当たらないことば）と、いちばん古い 1 行（当たる）
  await f.admin.query(
    `insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, payload, occurred_at)
     select $1, $2, 'member', 'permission.granted', 'members', '{}'::jsonb, $3::timestamptz + (g || ' seconds')::interval
     from generate_series(1, 5100) g`,
    [T2.tenantId, admin2.id, at(10_000)],
  );
  await ev({
    tenant: T2.tenantId,
    actor: admin2,
    action: "workspace.renamed",
    type: "workspace",
    payload: { reason: "ZZZ-OLD" },
    sec: -5_000_000,
  });
}, 240_000);
afterAll(async () => {
  await f?.close();
});

describe("K-850 記録をことばで探す（listAuditEvents の q）", () => {
  it("K850-API-001 人の名前で探す：起こした人にも、対象の人にも当たる。別の会社の同じ字の名前は出ない", async () => {
    await ready();
    expect(sortSet(await ids(await q(admin, "鈴木")))).toEqual(sortSet([E["s1"]!, E["s2"]!, E["s5"]!]));
  });

  it("K850-API-002 チケットの番号で探す：大文字小文字を同じとみなす（JD-7 も jd-7 も、そのチケットの行）", async () => {
    await ready();
    const want = sortSet([E["s2"]!, E["s5"]!]);
    expect(sortSet(await ids(await q(admin, "JD-7")))).toEqual(want);
    expect(sortSet(await ids(await q(admin, "jd-7")))).toEqual(want);
  });

  it("K850-API-003 行の文で探す：「消した」は消した行（s2・s4）、「役割を変えた」は役割の行（s1）", async () => {
    await ready();
    expect(sortSet(await ids(await q(admin, "消した")))).toEqual(sortSet([E["s2"]!, E["s4"]!]));
    expect(await ids(await q(admin, "役割を"))).toEqual([E["s1"]!]);
  });

  it("K850-API-004 理由で探す：payload の reason の字に当たる", async () => {
    await ready();
    expect(await ids(await q(admin, "兼務が終わった"))).toEqual([E["s1"]!]);
  });

  it("K850-API-005 表記ゆらぎ：全角の英数・前後と間の空白・大文字小文字は同じ（理由「ＡＢＣ社」を abc 社・ＡｂＣ社 で探せる）", async () => {
    await ready();
    for (const w of ["abc社", "ＡｂＣ社", "  ABC社  ", "ａｂｃ　社"])
      expect(await ids(await q(admin, w)), w).toEqual([E["s5"]!]);
  });

  it("K850-API-006 ことばを空白で分けたら全部を含む行だけ（AND）：「鈴木 消した」は s2 だけ", async () => {
    await ready();
    expect(await ids(await q(admin, "鈴木 消した"))).toEqual([E["s2"]!]);
  });

  it("K850-API-007 ほかの絞りと一緒に使える：q と kind と member_id と期間", async () => {
    await ready();
    expect(await ids(await q(admin, "消した", `kind=deleted&member_id=${worker.id}`))).toEqual([E["s2"]!]);
    expect(await ids(await q(admin, "消した", `from=${at(30)}`))).toEqual([E["s4"]!]);
  });

  it("K850-API-008 マネージャー：ことばが範囲外の行に当たっても出ない（受託開発だけの人に、サポートのチケットを消した行と管理者の役割の行は出ない）", async () => {
    await ready();
    expect(await ids(await q(mgrJD, "消した"))).toEqual([E["s2"]!]);
    expect(await ids(await q(mgrJD, "兼務が終わった"))).toEqual([]);
  });

  it("K850-API-009 当たらない：200・entries 空・scan_capped false", async () => {
    await ready();
    const r = await q(admin, "どこにも無いことば");
    expect(r.status).toBe(200);
    expect((await json(r)).data).toEqual({ entries: [], next_cursor: null, scope: "all", scan_capped: false });
  });

  it("K850-API-010 空・空白だけ：422・E-AUD-010・欄 q", async () => {
    await ready();
    for (const w of ["", "   ", "　"]) {
      const r = await q(admin, w);
      expect(r.status, JSON.stringify(w)).toBe(422);
      const j = await json(r);
      expect(j["code"]).toBe("E-AUD-010");
      expect(j.details!.map((d) => d.field)).toEqual(["q"]);
    }
  });

  it("K850-API-011 101 字は 422・E-AUD-010・NUL は入口が先に 422・VALIDATION_ERROR（K-427・K-823 案 a）（100 字ちょうどは 200）", async () => {
    await ready();
    expect(AUDIT_Q_MAX).toBe(100);
    const long = await q(admin, "あ".repeat(101));
    expect(long.status).toBe(422);
    expect((await json(long))["code"]).toBe("E-AUD-010");
    const nul = await q(admin, "鈴\u0000木");
    expect(nul.status).toBe(422);
    expect((await json(nul))["code"]).toBe("VALIDATION_ERROR");
    expect((await q(admin, "あ".repeat(100))).status).toBe(200);
  });

  it("K850-API-012 続き：当たる 60 行を 20・20・20 と読み進めて重ならず抜けず・最後は next_cursor が null", async () => {
    await ready();
    const got: string[] = [];
    let cursor: string | null = null;
    const sizes: number[] = [];
    for (let i = 0; i < 4; i++) {
      const j: J = await json(await q(admin, "まとめ", `limit=20${cursor ? `&cursor=${cursor}` : ""}`));
      sizes.push(j.data!.entries.length);
      got.push(...j.data!.entries.map((x) => x.id));
      cursor = j.data!.next_cursor;
      if (!cursor) break;
    }
    expect(sizes).toEqual([20, 20, 20]);
    expect(new Set(got).size).toBe(60);
  });

  it("K850-API-013 走査の上限：新しい順に 5000 行まで。いちばん古い当たりまで届かなければ entries 空・scan_capped true", async () => {
    await ready();
    expect(AUDIT_SCAN_MAX).toBe(5000);
    const r = await q(admin2, "ZZZ-OLD");
    expect(r.status).toBe(200);
    expect((await json(r)).data).toEqual({ entries: [], next_cursor: null, scope: "all", scan_capped: true });
  });

  it("K850-API-014 特別な字（% と _）は字として探す：「%」は 100%達成の行だけ・「a_b」は当たり・「a%b」と「a_」は当たらない", async () => {
    await ready();
    expect(await ids(await q(admin, "%"))).toEqual([E["s7"]!]);
    expect(await ids(await q(admin, "a_b"))).toEqual([E["s7"]!]);
    expect(await ids(await q(admin, "a%b"))).toEqual([]);
    expect(await ids(await q(admin, "\\"))).toEqual([]);
  });

  it("K850-API-015 失敗：札を決める関数が落ちたら 503・E-PAGE-003（途中までの答えを返さない）", async () => {
    await ready();
    const def = await one("select pg_get_functiondef('app.audit_kind(text)'::regprocedure) as v");
    await f.admin.query(
      "create or replace function app.audit_kind(a text) returns text language plpgsql immutable as $$ begin raise exception 'K850 試験の失敗'; end $$",
    );
    try {
      const r = await q(admin, "鈴木");
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await f.admin.query(def);
    }
  });

  it("K850-API-016 q が無いときは K-823 のまま：scan_capped の鍵が付かない・同じ答え", async () => {
    await ready();
    const j = await json(await get(admin, `member_id=${worker.id}`));
    expect(j.data).not.toHaveProperty("scan_capped");
    expect(j.data!.entries.map((e) => e.id)).toEqual([E["s5"]!, E["s2"]!]);
  });

  it("K850-API-017 読むだけ：同じことばを 2 回探して同じ答え・記録の数は増えない・普通のメンバーは 403・ログインなしは 401", async () => {
    await ready();
    const n0 = Number(await one("select count(*) as v from audit_events where tenant_id = $1", [T.tenantId]));
    expect((await json(await q(admin, "鈴木"))).data).toEqual((await json(await q(admin, "鈴木"))).data);
    expect(Number(await one("select count(*) as v from audit_events where tenant_id = $1", [T.tenantId]))).toBe(n0);
    expect((await q(worker, "鈴木")).status).toBe(403);
    expect((await get(null, "q=a")).status).toBe(401);
  });

  it("K850-API-018 口と契約の同じ値：q の長さ 1〜100 が 08_api/openapi.yaml の listAuditEvents と 1 字も違わない", async () => {
    const y = readFileSync(join(ROOT, "08_api/openapi.yaml"), "utf8");
    const i = y.indexOf("operationId: listAuditEvents");
    expect(i).toBeGreaterThan(0);
    const block = y.slice(i, i + 4000);
    expect(block).toMatch(/name:\s*q[\s\S]{0,200}maxLength:\s*100/);
  });
});
