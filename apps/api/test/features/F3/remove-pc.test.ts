// K-362「PC を外す口（revokeMyDevice）」の単体の試験（口・本物の DB・本物の PC の印の解決）。名前の頭の行 ID（K362-API-…）は 11_tickets/K-362.md の表と 1 対 1。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   画面のログインだけ偽：authorization: Bearer fake[-pending]:<役>:<会社>:<人>[:su=<取り直しの時刻 ms>]。
//   取り直しの時刻を読む入口は、この試験の中で組む（共通の土台 fixture.ts は stepUpAt が空の決め打ちのまま変えない）。
//   PC の印は本物（引き取りで返った印を x-bridge-session に載せる → app.bridge_device_check が引く）。
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { createRepository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { leafHooks } from "./leaf-hooks.js";

const REASON = "PC を外したので止まりました";
const MIN = 60_000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
let f: Fixture;
let app: ReturnType<typeof createApp>;
let ready: () => Promise<void> = async () => {};
let T1: { tenantId: string; rootScope: string };
let T2: { tenantId: string; rootScope: string };

type J = Record<string, unknown> & { data?: Record<string, unknown>; code?: string };
const json = async (r: Response) => (await r.json()) as J;
const req = (method: string, path: string, o: { body?: unknown; headers?: Record<string, string> } = {}) =>
  ready().then(() =>
    app.request(`http://localhost/api/v1${path}`, {
      method,
      headers: { "content-type": "application/json", "x-forwarded-for": nextIp(), ...(o.headers ?? {}) },
      ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
    }),
  );
/** 画面のログイン。ago は取り直しからの時間（ms）。null なら取り直していない */
const as = (p: Person, ago: number | null = MIN, o: { role?: string; pending?: boolean } = {}) => ({
  authorization: `Bearer fake${o.pending ? "-pending" : ""}:${o.role ?? "member"}:${p.tenantId}:${p.id}${
    ago === null ? "" : `:su=${Date.now() - ago}`
  }`,
});
const dev = (token: string) => ({ "x-bridge-session": token });
const del = (id: string, headers: Record<string, string>, body?: unknown) =>
  req("DELETE", `/bridge/devices/${id}`, { headers, ...(body === undefined ? {} : { body }) });

/** アカウント（auth_user_id）を持つ人。同じアカウントで別の会社にも入れられる */
const me = (tenant = T1, name = "高本") =>
  f.person(tenant.tenantId, tenant.rootScope, { name, authUserId: `k362-${randomUUID()}` });
/** 接続コードを出して引き取る（本物の PC の印） */
const connect = async (p: Person, label = "高本の MacBook") => {
  const c = await req("POST", "/bridge/pairing-codes", { body: {}, headers: as(p) });
  expect(c.status, await c.clone().text()).toBe(201);
  const code = ((await json(c)).data as { code: string }).code;
  const r = await req("POST", "/bridge/claim", { body: { code, device_label: label, machine_id: randomUUID() } });
  expect(r.status, await r.clone().text()).toBe(201);
  const d = (await json(r)).data as { device_token: string; device_id: string };
  return { token: d.device_token, id: d.device_id };
};
const beat = (token: string) =>
  req("POST", "/bridge/heartbeat", { body: { health: [], protocol: 5, version: "1.4.0" }, headers: dev(token) });
const sessionRow = async (id: string) =>
  (await f.admin.query<Record<string, unknown>>("select * from sessions where id = $1", [id])).rows[0]!;
const removedEvents = async (deviceId: string) =>
  (
    await f.admin.query<Record<string, unknown>>(
      "select * from security_events where kind_id = 'device_removed' and detail->>'device_id' = $1",
      [deviceId],
    )
  ).rows;
const listIds = async (p: Person) => {
  const r = await req("GET", "/bridge/devices", { headers: as(p) });
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await json(r)).data as unknown as { id: string }[]).map((d) => d.id);
};
const one = async <R extends Record<string, unknown>>(sql: string, p: unknown[]) =>
  (await f.admin.query<R>(sql, p)).rows[0]!;
/** 会話の仕事を 1 つ置く（state と受け取った PC を決めて置く） */
const chatJob = async (p: Person, state: string, taken: string | null) => {
  const conv = await one<{ id: string }>(
    "insert into conversations (tenant_id, scope_id, owner_member_id, title) values ($1, (select scope_id from members where id = $2), $2, 'K362 の会話') returning id",
    [p.tenantId, p.id],
  );
  const job = await one<{ id: string }>(
    `insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, permission_mode, taken_session_id, started_at)
     values ($1, (select scope_id from members where id = $2), $2, $3, $4, '今月の売上は？', 'chat', 'manual', $5,
             case when $4 = 'queued' then null else now() end) returning id`,
    [p.tenantId, p.id, conv.id, state, taken],
  );
  return { job: job.id, conv: conv.id };
};
const job = (id: string) => one<Record<string, unknown>>("select * from bridge_jobs where id = $1", [id]);
const stageId = (key: string) =>
  one<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = $2", [T1.tenantId, key]);
const systemLines = async (ticket: string) =>
  (
    await f.admin.query<{ body: string }>("select body from ticket_messages where ticket_id = $1 and kind = 'system'", [
      ticket,
    ])
  ).rows.map((l) => l.body);
/** チケットの仕事を 1 つ置く（phase make か execute・仕事と実行の記録の状態を同じにする・受け取った PC を決めて置く） */
const ticketRun = async (p: Person, taken: string, phase: "make" | "execute", state: "running" | "asking") => {
  const kind = await one<{ id: string }>(
    "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
    [T1.tenantId],
  );
  const t = await one<{ id: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, delegated_to_clone)
     values ($1, $2, '', $3, $4, '請求書を送る', $5, $5, true) returning id`,
    [T1.tenantId, T1.rootScope, kind.id, (await stageId("doing")).id, p.id],
  );
  const j = await one<{ id: string }>(
    `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, started_at, taken_session_id)
     values ($1, $2, $3, 'ticket', $4, '（K362 のチケットの仕事）', now(), $5) returning id`,
    [T1.tenantId, T1.rootScope, p.id, state, taken],
  );
  const run = await one<{ id: string }>(
    `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, created_by)
     values ($1, $2, $3, $4, $5, $6, now(), $7) returning id`,
    [T1.tenantId, T1.rootScope, t.id, phase, state, j.id, p.id],
  );
  return { ticket: t.id, job: j.id, run: run.id };
};

beforeAll(async () => {
  f = await makeFixture();
  ready = leafHooks(f, ["device-revoke"]); // 葉の hooks のファイル（K-326 の register）を最初の要求で足す
  T1 = await f.company("K362 の会社 1", "RV");
  T2 = await f.company("K362 の会社 2", "RW");
  const web = async (h: Headers) => {
    const m = /^Bearer fake(-pending)?:(member|ops|client):([0-9a-f-]{36}):([0-9a-f-]{36})(?::su=(\d+))?$/.exec(
      h.get("authorization") ?? "",
    );
    if (!m) return null;
    const ctx: TenantContext = {
      tenantId: m[3]!,
      userId: m[4]!,
      role: m[2] as TenantContext["role"],
      stepUpAt: m[5] ? new Date(Number(m[5])) : null,
    };
    return { ctx, sessionId: "", authUserId: "", termsPending: m[1] === "-pending" };
  };
  app = createApp({
    version: "test",
    repo: await createRepository(f.pool),
    resolve: withDevice(web, createDeviceResolver(f.pool)) as never,
    contract: { hooks: f.hooks, limits: f.limits },
  });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-362 PC を外す：状態 × 入口 × 利用者の状態（口・本物の DB）", () => {
  it("K362-API-001 生きている PC を、取り直して 1 分の人が外す：200・4 つの鍵・外した印・出来事 1 つ・一覧から消える。印もハッシュも返さない", async () => {
    const p = await me();
    const pc = await connect(p);
    expect((await beat(pc.token)).status).toBe(201);
    const r = await del(pc.id, as(p));
    expect(r.status, await r.clone().text()).toBe(200);
    const text = await r.clone().text();
    const d = (await json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["device_label", "id", "revoke_reason", "revoked_at"]);
    expect(d["id"]).toBe(pc.id);
    expect(d["device_label"]).toBe("高本の MacBook");
    expect(d["revoke_reason"]).toBe("端末を外した");
    expect(text).not.toContain(pc.token);
    expect(text).not.toContain(sha(pc.token));
    const row = await sessionRow(pc.id);
    expect(row["revoke_reason_id"]).toBe("device_removed");
    expect(new Date(String(d["revoked_at"])).getTime()).toBe((row["revoked_at"] as Date).getTime());
    const ev = await removedEvents(pc.id);
    expect(ev).toHaveLength(1);
    expect(ev[0]!["member_id"]).toBe(row["member_id"]);
    expect(ev[0]!["tenant_id"]).toBe(row["tenant_id"]);
    expect(await listIds(p)).not.toContain(pc.id);
  });

  it("K362-API-002 取り直しが無い：403・STEP_UP_REQUIRED。外れず出来事も無い", async () => {
    const p = await me();
    const pc = await connect(p);
    const r = await del(pc.id, as(p, null));
    expect(r.status).toBe(403);
    expect((await json(r)).code).toBe("STEP_UP_REQUIRED");
    expect((await sessionRow(pc.id))["revoked_at"]).toBeNull();
    expect(await removedEvents(pc.id)).toHaveLength(0);
  });

  it("K362-API-003 取り直しの境：14 分前は 200、16 分前は 403・STEP_UP_REQUIRED で外れない", async () => {
    const p = await me();
    const a = await connect(p, "A");
    const b = await connect(p, "B");
    expect((await del(a.id, as(p, 14 * MIN))).status).toBe(200);
    const late = await del(b.id, as(p, 16 * MIN));
    expect(late.status).toBe(403);
    expect((await json(late)).code).toBe("STEP_UP_REQUIRED");
    expect((await sessionRow(b.id))["revoked_at"]).toBeNull();
  });

  it("K362-API-004 外した直後の Bridge：生きている知らせ・仕事を取りに来る・ログイン情報を取り出す がどれも 401。最後に見えた時刻は進まない", async () => {
    const p = await me();
    const pc = await connect(p);
    expect((await beat(pc.token)).status).toBe(201);
    const before = (await sessionRow(pc.id))["last_seen_at"] as Date;
    expect((await del(pc.id, as(p))).status).toBe(200);
    expect((await beat(pc.token)).status).toBe(401);
    expect((await req("POST", "/bridge/jobs/take", { body: {}, headers: dev(pc.token) })).status).toBe(401);
    const res = await req("POST", "/bridge/credentials/resolve", {
      body: { credential_id: randomUUID(), domain: "example.com" },
      headers: dev(pc.token),
    });
    expect(res.status).toBe(401);
    expect(((await sessionRow(pc.id))["last_seen_at"] as Date).getTime()).toBe(before.getTime());
  });

  it("K362-API-005 もう外した PC をもう一度外す（古い画面）：404・NOT_FOUND。出来事は 1 つのまま", async () => {
    const p = await me();
    const pc = await connect(p);
    expect((await del(pc.id, as(p))).status).toBe(200);
    const again = await del(pc.id, as(p));
    expect(again.status).toBe(404);
    expect((await json(again)).code).toBe("NOT_FOUND");
    expect(await removedEvents(pc.id)).toHaveLength(1);
  });

  it("K362-API-006 眠っている PC（最後の知らせ 10 分前）と、知らせがまだの PC（alive_at が空）：どちらも 200 で外れる", async () => {
    const p = await me();
    const asleep = await connect(p, "眠っている");
    expect((await beat(asleep.token)).status).toBe(201);
    await f.admin.query("update sessions set last_seen_at = now() - interval '10 minutes' where id = $1", [asleep.id]);
    const waiting = await connect(p, "まだ");
    expect((await sessionRow(waiting.id))["alive_at"]).toBeNull();
    for (const pc of [asleep, waiting]) {
      expect((await del(pc.id, as(p))).status).toBe(200);
      expect((await sessionRow(pc.id))["revoked_at"]).not.toBeNull();
    }
  });

  it("K362-API-007 外す PC が受け取った会話の仕事（running・asking）だけ止まり、会話に止まった発言が 1 つ。待ちの仕事・もう 1 台の仕事は変わらない", async () => {
    const p = await me();
    const a = await connect(p, "A");
    const b = await connect(p, "B");
    const run = await chatJob(p, "running", a.id);
    const ask = await chatJob(p, "asking", a.id);
    const wait = await chatJob(p, "queued", null);
    const other = await chatJob(p, "running", b.id);
    expect((await del(a.id, as(p))).status).toBe(200);
    for (const x of [run, ask]) {
      const j = await job(x.job);
      expect(j["state_id"]).toBe("stopped");
      expect(j["stopped_reason"]).toBe(REASON);
      expect(j["finished_at"]).not.toBeNull();
      const msgs = (
        await f.admin.query<{ body: string }>(
          "select body from messages where conversation_id = $1 and kind = 'stopped'",
          [x.conv],
        )
      ).rows;
      expect(msgs.map((m) => m.body)).toEqual([REASON]);
    }
    expect((await job(wait.job))["state_id"]).toBe("queued");
    expect((await job(other.job))["state_id"]).toBe("running");
  });

  it("K362-API-008 外す PC が受け取ったチケットの作る段の仕事：仕事と実行の記録が止まり、段は作業中・旗は下り、やり取りに 1 行", async () => {
    const p = await me();
    const a = await connect(p, "A");
    const kind = await one<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
      [T1.tenantId],
    );
    const stage = (key: string) =>
      one<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = $2", [T1.tenantId, key]);
    const t = await one<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, delegated_to_clone)
       values ($1, $2, '', $3, $4, '請求書を作る', $5, $5, true) returning id`,
      [T1.tenantId, T1.rootScope, kind.id, (await stage("doing")).id, p.id],
    );
    const j = await one<{ id: string }>(
      `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, started_at, taken_session_id)
       values ($1, $2, $3, 'ticket', 'running', '（作る段）', now(), $4) returning id`,
      [T1.tenantId, T1.rootScope, p.id, a.id],
    );
    const run = await one<{ id: string }>(
      `insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, created_by)
       values ($1, $2, $3, 'make', 'running', $4, now(), $5) returning id`,
      [T1.tenantId, T1.rootScope, t.id, j.id, p.id],
    );
    expect((await del(a.id, as(p))).status).toBe(200);
    expect((await job(j.id))["state_id"]).toBe("stopped");
    const r = await one<Record<string, unknown>>("select * from action_runs where id = $1", [run.id]);
    expect(r["status_id"]).toBe("stopped");
    expect(String(r["error_summary"])).toContain(REASON);
    expect(r["finished_at"]).not.toBeNull();
    const tk = await one<Record<string, unknown>>("select * from tickets where id = $1", [t.id]);
    expect(tk["stage_id"]).toBe((await stage("doing")).id);
    expect(tk["delegated_to_clone"]).toBe(false);
    const lines = (
      await f.admin.query<{ body: string }>(
        "select body from ticket_messages where ticket_id = $1 and kind = 'system'",
        [t.id],
      )
    ).rows;
    expect(lines.filter((l) => l.body.includes(REASON))).toHaveLength(1);
  });

  it("K362-API-027 外す PC が受け取った承認の後の実行（phase execute）の仕事：仕事が止まり、実行の記録・段・やり取りの 1 行は引き金（0098）が書く。やり取りの理由の行はちょうど 1 つ（2 重に書かない）", async () => {
    const p = await me();
    const a = await connect(p, "A");
    const t = await ticketRun(p, a.id, "execute", "running");
    expect((await del(a.id, as(p))).status).toBe(200);
    expect((await job(t.job))["state_id"]).toBe("stopped");
    expect((await job(t.job))["stopped_reason"]).toBe(REASON);
    const r = await one<Record<string, unknown>>("select * from action_runs where id = $1", [t.run]);
    expect(r["status_id"]).toBe("stopped");
    expect(String(r["error_summary"])).toContain(REASON);
    expect(r["finished_at"]).not.toBeNull();
    expect(
      (await one<Record<string, unknown>>("select stage_id from tickets where id = $1", [t.ticket]))["stage_id"],
    ).toBe((await stageId("doing")).id);
    expect((await systemLines(t.ticket)).filter((l) => l.includes(REASON))).toHaveLength(1);
  });

  it("K362-API-028 外す PC が受け取ったチケットの作る段の仕事が聞き返し中（asking）：008 と同じく仕事と実行の記録が止まり、段は作業中・旗は下り、やり取りに 1 行", async () => {
    const p = await me();
    const a = await connect(p, "A");
    const t = await ticketRun(p, a.id, "make", "asking");
    expect((await del(a.id, as(p))).status).toBe(200);
    expect((await job(t.job))["state_id"]).toBe("stopped");
    const r = await one<Record<string, unknown>>("select * from action_runs where id = $1", [t.run]);
    expect(r["status_id"]).toBe("stopped");
    expect(String(r["error_summary"])).toContain(REASON);
    const tk = await one<Record<string, unknown>>("select * from tickets where id = $1", [t.ticket]);
    expect(tk["stage_id"]).toBe((await stageId("doing")).id);
    expect(tk["delegated_to_clone"]).toBe(false);
    expect((await systemLines(t.ticket)).filter((l) => l.includes(REASON))).toHaveLength(1);
  });

  it("K362-API-009 外す PC が受け取った仕事の持ち主が、同じアカウントの別のワークスペースのメンバー：その仕事も止まる（受け取った PC で決める）", async () => {
    const p = await me();
    const p2 = await f.alsoIn(p, T2.tenantId, T2.rootScope);
    const a = await connect(p, "A");
    const x = await chatJob(p2, "running", a.id);
    expect((await del(a.id, as(p))).status).toBe(200);
    expect((await job(x.job))["state_id"]).toBe("stopped");
    expect((await job(x.job))["stopped_reason"]).toBe(REASON);
  });

  it("K362-API-010 待ちの仕事があり、もう 1 台 B は眠っている。A を外した後に B が取りに来ると、その仕事が B に渡る", async () => {
    const p = await me();
    const a = await connect(p, "A");
    const b = await connect(p, "B");
    expect((await beat(b.token)).status).toBe(201);
    await f.admin.query("update sessions set last_seen_at = now() - interval '10 minutes' where id = $1", [b.id]);
    const w = await chatJob(p, "queued", null);
    expect((await del(a.id, as(p))).status).toBe(200);
    expect((await job(w.job))["state_id"]).toBe("queued");
    const got = (await f.pool.query<{ job_id: string }>("select * from app.bridge_take_job($1)", [b.id])).rows;
    expect(got.map((g) => g.job_id)).toEqual([w.job]);
    const after = await job(w.job);
    expect(after["state_id"]).toBe("running");
    expect(after["taken_session_id"]).toBe(b.id);
  });

  it("K362-API-011 PC が 2 台で A を外す：A だけ外れ、一覧は B だけ", async () => {
    const p = await me();
    const a = await connect(p, "A");
    const b = await connect(p, "B");
    expect((await del(a.id, as(p))).status).toBe(200);
    expect((await sessionRow(b.id))["revoked_at"]).toBeNull();
    expect(await listIds(p)).toEqual([b.id]);
  });

  it("K362-API-012 別のワークスペースでつないだ自分の PC を、今のワークスペースのログインから外す：200。どちらのワークスペースの一覧にも出ない。出来事は PC の持ち主の行（別のワークスペースのメンバー・その会社）に 1 つ", async () => {
    const p = await me();
    const p2 = await f.alsoIn(p, T2.tenantId, T2.rootScope);
    const pc = await connect(p2, "別の会社でつないだ PC");
    const r = await del(pc.id, as(p));
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await listIds(p)).not.toContain(pc.id);
    expect(await listIds(p2)).not.toContain(pc.id);
    const ev = await removedEvents(pc.id);
    expect(ev).toHaveLength(1);
    expect(ev[0]!["member_id"]).toBe(p2.id);
    expect(ev[0]!["tenant_id"]).toBe(T2.tenantId);
  });

  it("K362-API-013 同じ会社の他の人の PC・別の会社の人の PC を直に：どちらも 404・NOT_FOUND。外れず出来事も無い", async () => {
    const p = await me();
    const q = await me(T1, "同じ会社の人");
    const r = await me(T2, "別の会社の人");
    for (const other of [await connect(q), await connect(r)]) {
      const res = await del(other.id, as(p));
      expect(res.status).toBe(404);
      expect((await json(res)).code).toBe("NOT_FOUND");
      expect((await sessionRow(other.id))["revoked_at"]).toBeNull();
      expect(await removedEvents(other.id)).toHaveLength(0);
    }
  });

  it("K362-API-014 役が合わない：取引先の人のログイン・PC の印（その PC 自身の id）はどちらも 403。外れない", async () => {
    const p = await me();
    const pc = await connect(p);
    expect((await del(pc.id, as(p, MIN, { role: "client" }))).status).toBe(403);
    expect((await del(pc.id, dev(pc.token))).status).toBe(403);
    expect((await sessionRow(pc.id))["revoked_at"]).toBeNull();
  });

  it("K362-API-015 ログインしていない：401。外れない", async () => {
    const p = await me();
    const pc = await connect(p);
    expect((await del(pc.id, {})).status).toBe(401);
    expect((await sessionRow(pc.id))["revoked_at"]).toBeNull();
  });

  it("K362-API-016 :id が uuid でない：取り直し 15 分の内でも無くても 422・欄 id（形の確かめは取り直しより先）", async () => {
    const p = await me();
    for (const h of [as(p), as(p, null)]) {
      const r = await del("not-a-uuid", h);
      expect(r.status).toBe(422);
      const d = ((await json(r))["details"] as { field: string }[] | undefined) ?? [];
      expect(d.map((x) => x.field)).toContain("id");
    }
  });

  it("K362-API-017 画面のログインの行（kind web の sessions）の id：404。その行は外れない", async () => {
    const p = await me();
    const w = await one<{ id: string }>(
      "insert into sessions (tenant_id, member_id, kind_id, device_label) values ($1, $2, 'web', 'Chrome') returning id",
      [p.tenantId, p.id],
    );
    expect((await del(w.id, as(p))).status).toBe(404);
    expect((await sessionRow(w.id))["revoked_at"]).toBeNull();
  });

  it("K362-API-018 体に session_id（別の自分の PC）と reason（logout）を入れて送る：道の PC だけが外れ、理由は device_removed", async () => {
    const p = await me();
    const a = await connect(p, "A");
    const b = await connect(p, "B");
    const r = await del(a.id, as(p), { session_id: b.id, reason: "logout" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await sessionRow(a.id))["revoke_reason_id"]).toBe("device_removed");
    expect((await sessionRow(b.id))["revoked_at"]).toBeNull();
  });

  it("K362-API-019 同じ PC を同時に 2 回外す（2 つのタブ）：200 と 404 が 1 つずつ。出来事はちょうど 1 つ", async () => {
    const p = await me();
    const pc = await connect(p);
    const rs = await Promise.all([del(pc.id, as(p)), del(pc.id, as(p))]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 404]);
    expect(await removedEvents(pc.id)).toHaveLength(1);
  });

  it("K362-API-020 外すのと同時に生きている知らせが届く：外した後の last_seen_at は revoked_at より後でない。その後の知らせは 401", async () => {
    const p = await me();
    const pc = await connect(p);
    expect((await beat(pc.token)).status).toBe(201);
    const [r] = await Promise.all([del(pc.id, as(p)), beat(pc.token)]);
    expect(r.status).toBe(200);
    const row = await sessionRow(pc.id);
    expect((row["last_seen_at"] as Date).getTime()).toBeLessThanOrEqual((row["revoked_at"] as Date).getTime());
    expect((await beat(pc.token)).status).toBe(401);
  });

  it("K362-API-021 1 分の上限を超える（上限を 2 に差し替え）：3 回目は 429・retry_after_sec は 1〜60 の整数", async () => {
    const p = await me();
    f.limits["revokeMyDevice"] = 2;
    try {
      expect((await del(randomUUID(), as(p))).status).toBe(404);
      expect((await del(randomUUID(), as(p))).status).toBe(404);
      const r = await del(randomUUID(), as(p));
      expect(r.status).toBe(429);
      const sec = (await json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec)).toBe(true);
      expect(sec).toBeGreaterThanOrEqual(1);
      expect(sec).toBeLessThanOrEqual(60);
    } finally {
      delete f.limits["revokeMyDevice"];
    }
  });

  it("K362-API-022 同意し直しが要るセッション（取り直しは 15 分の内）：403・E-AUTH-010。外れない", async () => {
    const p = await me();
    const pc = await connect(p);
    const r = await del(pc.id, as(p, MIN, { pending: true }));
    expect(r.status).toBe(403);
    expect((await json(r)).code).toBe("E-AUTH-010");
    expect((await sessionRow(pc.id))["revoked_at"]).toBeNull();
  });

  it("K362-API-023 S1 の失敗：出来事を書く所で DB が断る → 503・E-PAGE-003。外した印も仕事の変更も出来事も残らない（取引ごと戻る）", async () => {
    const p = await me();
    const pc = await connect(p);
    const x = await chatJob(p, "running", pc.id);
    const fn = `k362_fail_${randomUUID().replace(/-/g, "")}`;
    await f.admin.query(
      `create function ${fn}() returns trigger language plpgsql as $$
       begin
         if new.kind_id = 'device_removed' and new.detail->>'device_id' = '${pc.id}' then
           raise exception 'K362 の試験が断った';
         end if;
         return new;
       end $$`,
    );
    await f.admin.query(`create trigger ${fn} before insert on security_events for each row execute function ${fn}()`);
    try {
      const r = await del(pc.id, as(p));
      expect(r.status).toBe(503);
      expect((await json(r)).code).toBe("E-PAGE-003");
    } finally {
      await f.admin.query(`drop trigger if exists ${fn} on security_events`);
      await f.admin.query(`drop function if exists ${fn}()`);
    }
    expect((await sessionRow(pc.id))["revoked_at"]).toBeNull();
    expect((await job(x.job))["state_id"]).toBe("running");
    expect(await removedEvents(pc.id)).toHaveLength(0);
  });

  it("K362-API-024 2 重の守り（D-128.166）：app.device_owned は自分の PC で true・他の人の PC で false。app.device_revoke を他の人の PC で呼ぶと null で外れない", async () => {
    const p = await me();
    const q = await me(T1, "他の人");
    const mine = await connect(p);
    const theirs = await connect(q);
    const owned = async (s: string) =>
      (await f.pool.query<{ ok: boolean }>("select app.device_owned($1, $2) as ok", [p.id, s])).rows[0]!.ok;
    expect(await owned(mine.id)).toBe(true);
    expect(await owned(theirs.id)).toBe(false);
    const r = (await f.pool.query<{ r: unknown }>("select app.device_revoke($1, $2) as r", [p.id, theirs.id])).rows[0]!;
    expect(r.r).toBeNull();
    expect((await sessionRow(theirs.id))["revoked_at"]).toBeNull();
  });

  it("K362-API-025 ログ：外す（200）と失敗（503）の間に出たログに、PC の印もそのハッシュも出ない", async () => {
    const p = await me();
    const ok = await connect(p, "A");
    const bad = await connect(p, "B");
    const lines: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => {
        lines.push(a.map(String).join(" "));
      }),
    );
    const fn = `k362_log_${randomUUID().replace(/-/g, "")}`;
    try {
      expect((await del(ok.id, as(p))).status).toBe(200);
      await f.admin.query(
        `create function ${fn}() returns trigger language plpgsql as $$
         begin
           if new.kind_id = 'device_removed' and new.detail->>'device_id' = '${bad.id}' then raise exception 'K362 の試験が断った'; end if;
           return new;
         end $$`,
      );
      await f.admin.query(
        `create trigger ${fn} before insert on security_events for each row execute function ${fn}()`,
      );
      expect((await del(bad.id, as(p))).status).toBe(503);
    } finally {
      await f.admin.query(`drop trigger if exists ${fn} on security_events`);
      await f.admin.query(`drop function if exists ${fn}()`);
      for (const s of spies) s.mockRestore();
    }
    const all = lines.join("\n");
    for (const t of [ok.token, bad.token]) {
      expect(all).not.toContain(t);
      expect(all).not.toContain(sha(t));
    }
  });
  it("K362-API-026 2 重の守りの片方を壊す（D-128.166）：DB の関数 app.device_revoke を持ち主を確かめない版に一時置き換えても、口の app.device_owned だけで止まる。他の人の PC の id に DELETE すると 404・外れない・出来事 0", async () => {
    const p = await me();
    const q = await me(T1, "他の人");
    const theirs = await connect(q);
    const orig = (
      await f.admin.query<{ def: string }>(
        "select pg_get_functiondef('app.device_revoke(uuid, uuid)'::regprocedure) as def",
      )
    ).rows[0]!.def;
    await f.admin.query(
      `create or replace function app.device_revoke(p_member uuid, p_session uuid) returns jsonb
       language plpgsql security definer set search_path = public, app, pg_temp as $$
       declare s sessions%rowtype;
       begin
         update sessions set revoked_at = clock_timestamp(), revoke_reason_id = 'device_removed'
          where id = p_session and kind_id = 'bridge' and revoked_at is null returning * into s;
         if s.id is null then return null; end if;
         perform app.record_security_event(s.tenant_id, 'device_removed', s.member_id, null, jsonb_build_object('device_id', s.id));
         return jsonb_build_object('id', s.id, 'device_label', s.device_label, 'revoked_at', s.revoked_at, 'revoke_reason', '端末を外した');
       end $$`,
    );
    try {
      const r = await del(theirs.id, as(p));
      expect(r.status).toBe(404);
      expect((await json(r)).code).toBe("NOT_FOUND");
    } finally {
      await f.admin.query(orig);
    }
    expect((await sessionRow(theirs.id))["revoked_at"]).toBeNull();
    expect(await removedEvents(theirs.id)).toHaveLength(0);
  });
});
