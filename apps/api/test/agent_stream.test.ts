// 会話が変わったら画面に知らせる（D-113）。知らせの 1 本の接続（packages/db/listen）と /agent/stream を本物の Postgres で通す。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth, type Auth } from "@kaname/auth";
import { createSessionResolver, signOut } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { createMemberHub, type MemberHub } from "@kaname/db/listen";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import net from "node:net";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { agentStreamRoutes } from "../src/auth/agent-stream.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const X = "/api/auth-ext";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
let appPool: pg.Pool;
let auth: Auth;
let hub: MemberHub;
const uniq = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const json = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  ({ auth } = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool,
    secret: "test-secret-0123456789-abcdefghijklmnop",
    baseURL: "http://localhost:3001",
    webBaseURL: "http://localhost:3123",
    mailer: async () => undefined,
  }));
  hub = createMemberHub({ url: APP_URL });
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-obj-"))), {
    signingSecret: "test-files",
    maxBytes: 1024 * 1024,
  });
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth,
      appPool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }),
      repo,
      secrets: new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9)),
      objects,
      hub,
      mailer: async (m) => void sent.push({ to: m.to, url: m.url, kind: m.kind }),
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
      },
    }),
  });
}, 60_000);
afterAll(async () => {
  await hub?.close();
});

/** 登録（確認メールを通す）→ Bridge をつなぐ。画面の鍵と member id を返す */
async function ready() {
  const email = `${uniq()}@example.com`;
  expect((await req("POST", "/sign-up", { email, password: PW, company_name: "K" })).status).toBe(201);
  const mail = sent.filter((m) => m.to === email && m.kind === "verify").at(-1)!;
  const ver = await json<{ token: string }>(
    req("POST", "/verify-signup", { token: new URL(mail.url).searchParams.get("token") }),
  );
  const H = { authorization: `Bearer ${ver.token}` };
  const pair = await json<{ code: string }>(req("POST", "/bridge/pair", {}, H));
  const claim = await json<{ session_id: string }>(
    req("POST", "/bridge/claim", { code: pair.code, device_label: "QA の PC" }),
  );
  const member = (await admin.query("select member_id from sessions where id = $1", [claim.session_id])).rows[0]
    .member_id as string;
  return { H, B: { "x-bridge-session": claim.session_id }, member };
}

/** SSE を読む：届いた event 名を順に貯める。stop で読むのをやめる */
function reader(res: Response) {
  const events: string[] = [];
  const dec = new TextDecoder();
  const r = res.body!.getReader();
  let buf = "";
  let done = false;
  const pump = (async () => {
    for (;;) {
      const x = await r.read().catch(() => ({ done: true, value: undefined }));
      if (x.done) break;
      buf += dec.decode(x.value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev = /^event: ?(.*)$/m.exec(block)?.[1];
        const data = /^data: ?(.*)$/m.exec(block)?.[1] ?? "";
        if (ev) events.push(data ? `${ev}:${data}` : ev);
        else if (block.startsWith(":")) events.push("alive");
      }
    }
    done = true;
  })();
  const until = async (pred: (e: string[]) => boolean, ms = 3000) => {
    const t = Date.now() + ms;
    while (!pred(events) && Date.now() < t && !done) await sleep(20);
    return pred(events);
  };
  return { events, until, stop: async () => void (await r.cancel().catch(() => undefined)), ended: () => done, pump };
}

describe("知らせの接続（packages/db/listen・D-113）", () => {
  it("LSN-001 その人への知らせだけが届く（ほかの人には届かない）", async () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    const got: string[] = [];
    const offA = await hub.subscribe(a, { change: () => got.push("a"), down: () => got.push("a-down") });
    const offB = await hub.subscribe(b, { change: () => got.push("b"), down: () => got.push("b-down") });
    await admin.query("select app.agent_notify_member($1)", [a]);
    for (let i = 0; i < 50 && !got.length; i++) await sleep(20);
    await sleep(80);
    expect(got).toEqual(["a"]);
    offA();
    offB();
  });

  it("LSN-002 受けるのをやめた人には届かない", async () => {
    const a = crypto.randomUUID();
    const got: string[] = [];
    const off = await hub.subscribe(a, { change: () => got.push("a"), down: () => undefined });
    off();
    await admin.query("select app.agent_notify_member($1)", [a]);
    await sleep(200);
    expect(got).toEqual([]);
  });

  it("LSN-003 member id の形でないものは受けない（中身を見ない・形で落とす）", async () => {
    await expect(hub.subscribe("not-a-uuid", { change: () => undefined, down: () => undefined })).rejects.toThrow();
  });

  it("LSN-004 接続が切られたら、受けている全員に「落ちた」と伝え、次に受けるときはつなぎ直す（G-15）", async () => {
    const h = createMemberHub({ url: APP_URL });
    const a = crypto.randomUUID();
    const got: string[] = [];
    await h.subscribe(a, { change: () => got.push("c"), down: () => got.push("down") });
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'kaname-listen' and datname = current_database()",
    );
    for (let i = 0; i < 100 && !got.includes("down"); i++) await sleep(20);
    expect(got).toContain("down");
    expect(h.size()).toBe(0);
    // つなぎ直して、また届く
    const again: string[] = [];
    const off = await h.subscribe(a, { change: () => again.push("c"), down: () => undefined });
    await admin.query("select app.agent_notify_member($1)", [a]);
    for (let i = 0; i < 50 && !again.length; i++) await sleep(20);
    expect(again).toEqual(["c"]);
    off();
    await h.close();
    // hub（共通のもの）も同じ問い合わせで切られているかもしれないので、次の試験のためにつなぎ直せることだけ確かめる
    const probe = crypto.randomUUID();
    const off2 = await hub.subscribe(probe, { change: () => undefined, down: () => undefined });
    off2();
  });

  it("CHT-32-007 LSN-005 確かめの知らせが戻らなければ（通信が詰まった）落ちたことにする（黙って止まらない・G-15）", async () => {
    // 手元に中継を置き、DB から戻る通信だけを止める（接続は切れていないのに知らせが来ない状態）
    const u = new URL(APP_URL);
    let stall = false;
    const proxy = net.createServer((down) => {
      const up = net.connect(Number(u.port || 5432), u.hostname);
      down.on("data", (b) => up.write(b));
      up.on("data", (b) => {
        if (!stall) down.write(b);
      });
      const end = () => {
        down.destroy();
        up.destroy();
      };
      down.on("error", end).on("close", end);
      up.on("error", end).on("close", end);
    });
    await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
    const port = (proxy.address() as net.AddressInfo).port;
    const h = createMemberHub({ url: APP_URL.replace(`:${u.port}/`, `:${port}/`), pingMs: 100, pongMs: 200 });
    const got: string[] = [];
    await h.subscribe(crypto.randomUUID(), { change: () => undefined, down: () => got.push("down") });
    await sleep(250); // 詰まる前は確かめが通る（落ちない）
    expect(got).toEqual([]);
    stall = true;
    for (let i = 0; i < 100 && !got.includes("down"); i++) await sleep(20);
    expect(got).toEqual(["down"]);
    expect(h.size()).toBe(0);
    await h.close();
    await new Promise<void>((r) => proxy.close(() => r()));
  });
});

describe("会話の表に書くと、その人に知らせが出る（0054 の trigger・D-113）", () => {
  it("TRG-001 言ったこと（messages）・仕事（bridge_jobs）・途中経過（bridge_job_events）で知らせが出る", async () => {
    const r = await ready();
    let n = 0;
    const off = await hub.subscribe(r.member, { change: () => void n++, down: () => undefined });
    const a = await json<{ job_id: string; conversation_id: string }>(
      req("POST", "/agent/say", { text: "会社のことを聞いて" }, r.H),
    );
    for (let i = 0; i < 50 && n === 0; i++) await sleep(20);
    expect(n).toBeGreaterThan(0);
    const afterSay = n;
    await req("POST", "/bridge/take", { protocol: 4 }, r.B);
    for (let i = 0; i < 50 && n === afterSay; i++) await sleep(20);
    expect(n).toBeGreaterThan(afterSay);
    const afterTake = n;
    await req("POST", "/bridge/progress", { job_id: a.job_id, seq: 1, kind: "status", text: "調べています" }, r.B);
    for (let i = 0; i < 50 && n === afterTake; i++) await sleep(20);
    expect(n).toBeGreaterThan(afterTake);
    off();
  });
});

describe("/agent/stream（D-113）", () => {
  it("STR-001 ログインしていなければ 401", async () => {
    expect((await req("GET", "/agent/stream")).status).toBe(401);
  });

  it("STR-002 知らせの接続が無い API では 503（画面は見に行く形のまま）", async () => {
    const r = await ready();
    const noHub = agentStreamRoutes({ resolve: createSessionResolver(auth, appPool), hub: null });
    const res = await noHub.request("http://localhost/agent/stream", { headers: r.H });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { code: string }).code).toBe("STREAM_UNAVAILABLE");
  });

  it("STR-003 つながったら ready、会話が変わったら change が 1 秒以内に届く", async () => {
    const r = await ready();
    const res = await req("GET", "/agent/stream", undefined, r.H);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const s = reader(res);
    expect(await s.until((e) => e.includes("ready"))).toBe(true);
    const t0 = Date.now();
    await req("POST", "/agent/say", { text: "今日の予定は？" }, r.H);
    expect(await s.until((e) => e.includes("change"), 1000)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(1000);
    await s.stop();
  });

  it("CHT-32-005 STR-004 ほかの人の会話が変わっても届かない", async () => {
    const me = await ready();
    const other = await ready();
    const s = reader(await req("GET", "/agent/stream", undefined, me.H));
    await s.until((e) => e.includes("ready"));
    await req("POST", "/agent/say", { text: "ほかの人の会話" }, other.H);
    await sleep(400);
    expect(s.events.filter((e) => e === "change")).toEqual([]);
    await s.stop();
  });

  it("STR-005 続けて書いても、同じ瞬間の分は 1 回の change にまとまる", async () => {
    const r = await ready();
    const s = reader(await req("GET", "/agent/stream", undefined, r.H));
    await s.until((e) => e.includes("ready"));
    await admin.query("select app.agent_notify_member($1), pg_sleep(0.005), app.agent_notify_member($1)", [r.member]);
    await admin.query("select app.agent_notify_member($1)", [r.member]);
    await sleep(400);
    expect(s.events.filter((e) => e === "change").length).toBe(1);
    await s.stop();
  });

  it("CHT-32-006 STR-006 ログアウトしたら、次の確かめで流れを閉じる（G-14）", async () => {
    const r = await ready();
    const quick = agentStreamRoutes({ resolve: createSessionResolver(auth, appPool), hub, keepaliveMs: 150 });
    const s = reader(await quick.request("http://localhost/agent/stream", { headers: r.H }));
    expect(await s.until((e) => e.includes("alive"), 2000)).toBe(true);
    await signOut(auth, appPool, new Headers(r.H));
    expect(await s.until((e) => e.includes("end:unauthenticated"), 2000)).toBe(true);
    expect(await s.until(() => s.ended(), 1000)).toBe(true);
  });

  it("STR-007 1 本の長さを過ぎたら end:reconnect で区切る（置き場の関数の上限 60 秒より前に）", async () => {
    const r = await ready();
    const short = agentStreamRoutes({ resolve: createSessionResolver(auth, appPool), hub, lifetimeMs: 300 });
    const s = reader(await short.request("http://localhost/agent/stream", { headers: r.H }));
    expect(await s.until((e) => e.includes("end:reconnect"), 2000)).toBe(true);
    expect(await s.until(() => s.ended(), 1000)).toBe(true);
  });

  it("STR-008 知らせの接続が落ちたら down を送って閉じる（画面は見に行く形に戻る）", async () => {
    const r = await ready();
    const h = createMemberHub({ url: APP_URL });
    const own = agentStreamRoutes({ resolve: createSessionResolver(auth, appPool), hub: h });
    const s = reader(await own.request("http://localhost/agent/stream", { headers: r.H }));
    await s.until((e) => e.includes("ready"));
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'kaname-listen' and datname = current_database()",
    );
    expect(await s.until((e) => e.includes("down"), 3000)).toBe(true);
    expect(await s.until(() => s.ended(), 1000)).toBe(true);
    await h.close();
  });

  it("STR-009 画面が閉じたら、受けるのをやめる（人数が戻る）", async () => {
    const r = await ready();
    const h = createMemberHub({ url: APP_URL });
    const own = agentStreamRoutes({ resolve: createSessionResolver(auth, appPool), hub: h });
    const ac = new AbortController();
    const res = await own.request("http://localhost/agent/stream", { headers: r.H, signal: ac.signal });
    const s = reader(res);
    await s.until((e) => e.includes("ready"));
    expect(h.size()).toBe(1);
    await s.stop();
    ac.abort();
    for (let i = 0; i < 50 && h.size() > 0; i++) await sleep(20);
    expect(h.size()).toBe(0);
    await h.close();
  });
});
