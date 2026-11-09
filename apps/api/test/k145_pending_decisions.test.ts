// K-145 のうち、決める人の答え（D-134・2026-11-10・answer=ffef5862874b「推奨どおり」）を待ってから積んだ行（聞くことが残っている間はコミットしない・正本 §1-11）。
//   D-134.1 ファイルを受ける口は送る量 1MB の守りの外（K145-API-011）／D-134.3 一言・問い合わせの答え・指示を切らない（K145-API-015・migration は K-62 の 0092 の次）／
//   D-134.4 形違いの id を黙って捨てる所（say・steer の attachment_ids の要素・quote.message_id、proposals/send の target_scope_id、/agent/artifacts の ?conversation_id）も 422（K145-API-002・003 の続き）
//   土台（組み立て・ready・newJob ほか）は k145_uuid_guard.test.ts と同じ
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { issueToolToken } from "../src/auth/agent-tools.js";
import { keepAuth, verifiedUser } from "./_pending.js";
import { pairForTest } from "./bridge_pair.js";
import { BAD_IDS } from "./k145_uuid_guard.test.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const X = "/api/auth-ext";
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
let appPool: pg.Pool;
type Json = Record<string, unknown> & { code?: string; field?: string; details?: { field: string; message: string }[] };
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const post = (path: string, body: unknown, h: Record<string, string> = {}) => req("POST", path, body, h);
const jsonOf = async (r: Response) =>
  (await r
    .clone()
    .json()
    .catch(() => ({}))) as Json;
const data = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;
const uniq = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const count = async (sql: string, p: unknown[] = []) => Number((await admin.query<{ n: string }>(sql, p)).rows[0]!.n);
async function expectBadId(r: Response, field: string, label: string) {
  const j = await jsonOf(r);
  expect(r.status, `${label}: ${JSON.stringify(j).slice(0, 160)}`).toBe(422);
  expect(j.code, label).toBe("VALIDATION_FAILED");
  expect(j.field, label).toBe(field);
  expect(j.details?.find((d) => d.field === field)?.message, label).toBe("uuid");
}

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 3 });
  appPool = createPool({ databaseUrl: APP_URL, max: 4 });
  const repo = await createRepository(appPool);
  const { auth } = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3001",
      webBaseURL: "http://localhost:3123",
      mailer: async () => undefined,
    }),
  );
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "k145p-obj-"))), {
    signingSecret: "test-files",
    maxBytes: 4 * 1024 * 1024,
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
      secrets,
      objects,
      mailer: async () => undefined,
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
  await appPool?.end();
  await admin?.end();
});

async function ready() {
  const email = `${uniq()}@example.com`;
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K145" });
  const H = { authorization: `Bearer ${ver.token}` };
  const bp = await pairForTest(admin, email);
  const B = { "x-bridge-session": bp.token };
  const row = (await admin.query<{ scope_id: string }>("select scope_id from members where id = $1", [bp.member]))
    .rows[0]!;
  return { H, B, member: bp.member, tenant: bp.tenant, scope: row.scope_id, sid: bp.sid };
}
type Ready = Awaited<ReturnType<typeof ready>>;
async function newJob(r: Ready, state: "queued" | "running" | "asking" = "queued") {
  const s = await data<{ conversation_id: string; job_id: string }>(post("/agent/say", { text: "K-145 の仕事" }, r.H));
  if (state !== "queued") await admin.query("update bridge_jobs set state_id = $2 where id = $1", [s.job_id, state]);
  return s;
}
const newMemory = async (r: Ready) =>
  (
    await admin.query<{ id: string }>(
      "insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body) values ($1, $2, 'preference', $3, 'K-145', '前の本文') returning id",
      [r.tenant, r.scope, r.member],
    )
  ).rows[0]!.id;
const jobsOf = (member: string) => count("select count(*) as n from bridge_jobs where member_id = $1", [member]);

describe("K-145 D-134.4：形違いの id を黙って捨てる所も 422（D-129.42）", () => {
  it("K145-API-002（続き）say・steer の attachment_ids の要素・quote.message_id、proposals/send の target_scope_id が形違いなら 422・その欄。仕事は増えない。null は「無し」で通す", async () => {
    const r = await ready();
    const job = await newJob(r, "running");
    const mem = await newMemory(r);
    const proposal = (
      await admin.query<{ id: string }>(
        "insert into memory_proposals (tenant_id, scope_id, memory_id, target_scope_id, proposer_member_id, state_id) values ($1, $2, $3, $2, $4, 'draft') returning id",
        [r.tenant, r.scope, mem, r.member],
      )
    ).rows[0]!.id;
    const jobs = await jobsOf(r.member);
    const cases: [string, string, string, (bad: string) => unknown][] = [
      ["POST", "/agent/say", "attachment_ids", (bad) => ({ text: "x", attachment_ids: [bad] })],
      ["POST", "/agent/say", "quote.message_id", (bad) => ({ text: "x", quote: { text: "引用", message_id: bad } })],
      [
        "POST",
        "/agent/steer",
        "attachment_ids",
        (bad) => ({ job_id: job.job_id, text: "直して", attachment_ids: [bad] }),
      ],
      ["POST", `/agent/memory/proposals/${proposal}/send`, "target_scope_id", (bad) => ({ target_scope_id: bad })],
    ];
    for (const [method, path, field, body] of cases)
      for (const bad of BAD_IDS)
        await expectBadId(
          await req(method, path, body(bad), r.H),
          field,
          `${method} ${path} ${field}=${JSON.stringify(bad)}`,
        );
    expect(await jobsOf(r.member)).toBe(jobs);
    expect((await post("/agent/say", { text: "x", quote: { text: "引用", message_id: null } }, r.H)).status).toBe(201);
  }, 120_000);

  it("K145-API-003（続き）/agent/artifacts の ?conversation_id が形違いなら 422・field conversation_id。空は指定なし（200・[]）", async () => {
    const r = await ready();
    for (const bad of BAD_IDS.filter((v) => v !== ""))
      await expectBadId(
        await req("GET", `/agent/artifacts?conversation_id=${encodeURIComponent(bad)}`, undefined, r.H),
        "conversation_id",
        `artifacts ${bad}`,
      );
    expect((await req("GET", "/agent/artifacts?conversation_id=", undefined, r.H)).status).toBe(200);
    expect(await data<unknown[]>(req("GET", "/agent/artifacts?conversation_id=", undefined, r.H))).toEqual([]);
  }, 60_000);
});

describe("K-145 D-134.1：ファイルを受ける口は送る量 1MB の守りの外", () => {
  it("K145-API-011 ファイルを受ける口は送る量 1MB の守りの外（D-134.1）：資料（multipart・1.5MB）は 201、成果物（/bridge/artifact・1.5MB の PNG・道具の鍵）も 201。置き場の上限（試験は 4MB）はそのまま", async () => {
    const r = await ready();
    const big = new Uint8Array(1_572_864).fill(0x61);
    const fd = new FormData();
    fd.append("file", new File([big], "大きい資料.txt", { type: "text/plain" }));
    const up = await app.request(`http://localhost${X}/agent/attachments`, { method: "POST", headers: r.H, body: fd });
    expect(
      up.status,
      await up
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    const job = await newJob(r, "running");
    const token = await issueToolToken(appPool, r.sid, job.job_id);
    expect(token).toBeTruthy();
    const png = new Uint8Array(1_572_864);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const art = await app.request(`http://localhost${X}/bridge/artifact`, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(png.byteLength),
        "x-kaname-tool-token": token!,
        "x-artifact-name": encodeURIComponent("大きい図.png"),
      },
      body: png,
    });
    expect(
      art.status,
      await art
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    // 置き場の上限（4MB）を超えるファイルは今までどおり 413（E-LIM-002）
    const huge = new FormData();
    huge.append(
      "file",
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "大きすぎ.bin", { type: "application/octet-stream" }),
    );
    expect(
      (await app.request(`http://localhost${X}/agent/attachments`, { method: "POST", headers: r.H, body: huge }))
        .status,
    ).toBe(413);
  }, 60_000);
});

describe("K-145 D-134.3：一言・問い合わせの答え・指示を切らない（API と DB の関数・D-130.4）", () => {
  it("K145-API-015 許可の答えの一言 5000 字・問い合わせの答えの値 5000 字（/agent/answer2）と、止めずに直す指示 30000 字（/agent/steer）は、出来事（bridge_job_events）に一字も欠けずに残る（D-134.3）", async () => {
    const r = await ready();
    const asking = await newJob(r, "asking");
    const job = (
      await admin.query<{ tenant_id: string; scope_id: string | null; member_id: string }>(
        "select tenant_id, scope_id, member_id from bridge_jobs where id = $1",
        [asking.job_id],
      )
    ).rows[0]!;
    await admin.query(
      "insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, payload) values ($1, $2, $3, $4, 'ask', 'r1', $5::jsonb)",
      [
        job.tenant_id,
        job.scope_id,
        job.member_id,
        asking.job_id,
        JSON.stringify({ tool: "AskUserQuestion", questions: [{ question: "どちら" }], summary: "問い" }),
      ],
    );
    const note = `一言${"え".repeat(4996)}まで`;
    const answer = `答え${"お".repeat(4996)}まで`;
    const a = await post(
      "/agent/answer2",
      { job_id: asking.job_id, request_id: "r1", allow: true, note, answers: { どちら: answer } },
      r.H,
    );
    expect(
      a.status,
      await a
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    const ev = (
      await admin.query<{ payload: { note: string; answers: Record<string, string> } }>(
        "select payload from bridge_job_events where job_id = $1 and kind = 'answer' and request_id = 'r1'",
        [asking.job_id],
      )
    ).rows[0]!;
    expect(ev.payload.note).toBe(note);
    expect(ev.payload.answers["どちら"]).toBe(answer);
    const running = await newJob(r, "running");
    const text = `指示${"か".repeat(29996)}まで`;
    expect([...text].length).toBe(30000);
    const s = await post("/agent/steer", { job_id: running.job_id, text }, r.H);
    expect(
      s.status,
      await s
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    const st = (
      await admin.query<{ payload: { text: string } }>(
        "select payload from bridge_job_events where job_id = $1 and kind = 'steer'",
        [running.job_id],
      )
    ).rows[0]!;
    expect(st.payload.text).toBe(text);
  }, 60_000);
});
