// K-145「前の道すじ（/api/auth-ext）の id の確かめ・送る量の守り・切り捨て」の単体の試験（口・本物の Postgres・RLS あり）。
//   名前の頭の行 ID（K145-API-…）は 11_tickets/K-145.md の表のマスに 1 対 1 で結ぶ。テストはチケットのセッションが書き、実装より先にコミットする（D-128.125・D-132）。
//   決まり：
//     ・D-129.42 入力の id は入口で正式な uuid（契約の入口 op.ts と同じ isUuid＝z.uuid()）として確かめ、違えば 422（欄の名前・理由 "uuid"）。中で 500 になる道を残さない
//     ・D-130.1 送る内容全体 1MB の守り（読みながら数え、超えた時点で 413・「送る内容が大きすぎます」）を前の道すじと node のサーバーにも
//     ・D-130.2 DB の決まりに合わず断るときの文は「入力内容を確認してください」（2 層目・22P02）
//     ・D-130.4 人が自由に書く欄（会話の名前・記憶・一言・指示）を黙って切らない
//   K-62 が消す口（/bridge/take・finish・progress・control・tool）はここでは触らない
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { isUuid } from "@kaname/contracts";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { parseDigest } from "../src/auth/memory.js";
import { keepAuth, verifiedUser } from "./_pending.js";
import { pairForTest } from "./bridge_pair.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const X = "/api/auth-ext";
const BODY_MAX = 1_048_576;
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
let appPool: pg.Pool;

// 正式な uuid でない値（D-129.42・全部の層の試験で同じ並び。K-144 の NOT_UUID に variant・版 9・g を足した）
export const BAD_IDS = [
  "------------------------------------", // ① 36 個のハイフン（前の緩い正規表現が通していた）
  "3fa85f64-5717-0562-b3fc-2c963f66afa6", // ② 版の桁が 0
  "3fa85f64-5717-4562-b3fc-2c963f66afag", // ③ g を含む
  "3fa85f64-5717-4562-c3fc-2c963f66afa6", // ④ variant の桁が c
  "3fa85f64-5717-9562-b3fc-2c963f66afa6", // ⑤ 版の桁が 9
  "", // ⑥ 空
  "not-a-uuid", // ⑦ 形が違う
  "3fa85f64-5717-4562-b3fc-2c963f66afa60", // ⑧ 37 字
] as const;
/** 道の値に置ける形違い（空は道にならない） */
const BAD_PATH_IDS = BAD_IDS.filter((v) => v !== "");
// 正式な uuid（入口の形 z.uuid() が通す）：v4・v7・nil・max・大文字
const GOOD_IDS = [
  "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "0193c5a0-5f3e-7c0a-9d4e-0b1a2c3d4e5f",
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "3FA85F64-5717-4562-B3FC-2C963F66AFA6",
] as const;
const fullWidth = (s: string) =>
  [...s]
    .map((c) => (c === "-" ? "－" : /[0-9a-f]/.test(c) ? String.fromCharCode(c.charCodeAt(0) + 0xfee0) : c))
    .join("");

type Json = Record<string, unknown> & {
  code?: string;
  field?: string;
  message?: string;
  details?: { field: string; message: string }[];
  data?: unknown;
};
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
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

/** 422 の答えが「その欄の形が違う」と言っている（契約の入口と同じ理由 "uuid"・前の道すじの field）。500 ではない */
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
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "k145-obj-"))), {
    signingSecret: "test-files",
    maxBytes: 4 * 1024 * 1024, // 置き場の上限（送る量 1MB の守りの外にあることを見るため、1MB より大きく）
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

/** 登録した人（確認済み）と、その人の本物の PC の印 */
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
const newConversation = async (H: Record<string, string>) =>
  (await data<{ conversation_id: string }>(post("/agent/conversations", {}, H))).conversation_id;
/** 仕事を 1 つ積む（PC はつないである）。状態を置き換えられる */
async function newJob(r: Ready, state: "queued" | "running" | "asking" = "queued") {
  const s = await data<{ conversation_id: string; job_id: string }>(post("/agent/say", { text: "K-145 の仕事" }, r.H));
  if (state !== "queued") await admin.query("update bridge_jobs set state_id = $2 where id = $1", [s.job_id, state]);
  return s;
}
/** 自分の記憶を 1 つ置く */
const newMemory = async (r: Ready) =>
  (
    await admin.query<{ id: string }>(
      "insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body) values ($1, $2, 'preference', $3, 'K-145', '前の本文') returning id",
      [r.tenant, r.scope, r.member],
    )
  ).rows[0]!.id;
/** 自分が確認者の候補（sent）を 1 つ置く */
async function newProposal(r: Ready) {
  const mem = await newMemory(r);
  return (
    await admin.query<{ id: string }>(
      "insert into memory_proposals (tenant_id, scope_id, memory_id, target_scope_id, proposer_member_id, reviewer_member_id, state_id) values ($1, $2, $3, $2, $4, $4, 'sent') returning id",
      [r.tenant, r.scope, mem, r.member],
    )
  ).rows[0]!.id;
}
const eventsOf = (job: string) => count("select count(*) as n from bridge_job_events where job_id = $1", [job]);
const jobsOf = (member: string) => count("select count(*) as n from bridge_jobs where member_id = $1", [member]);

/** 流れの体（K144-API-044 と同じ）：読まれた量を数え、cancel を記録する */
const countingBody = (total: number, chunk = 65_536) => {
  let pulled = 0;
  let cancelled = false;
  const piece = new TextEncoder().encode("a".repeat(chunk));
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        if (pulled >= total) return c.close();
        const n = Math.min(chunk, total - pulled);
        c.enqueue(n === chunk ? piece : piece.slice(0, n));
        pulled += n;
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulled, cancelled: () => cancelled, chunk };
};

describe("K-145 画面の口（ログインの要る前の道すじ）の id は正式な uuid で確かめる（D-129.42）", () => {
  it("K145-API-001 道の値 :id（会話・一言・許可・まとめ・記憶・候補・成果物・資格情報）が正式な uuid でない 7 種は 422・field id・理由 uuid。500 にならず、行は増えない・変わらない", async () => {
    const r = await ready();
    const conv = await newConversation(r.H);
    const before = {
      conv: await count("select count(*) as n from conversations where owner_member_id = $1 and deleted_at is null", [
        r.member,
      ]),
      mem: await count("select count(*) as n from memories where owner_member_id = $1", [r.member]),
      art: await count("select count(*) as n from artifacts where owner_member_id = $1", [r.member]),
    };
    const routes: [string, (id: string) => string, unknown][] = [
      ["PATCH", (id) => `/agent/conversations/${id}`, { title: "x" }],
      ["DELETE", (id) => `/agent/conversations/${id}`, undefined],
      ["POST", (id) => `/agent/conversations/${id}/read`, {}],
      ["DELETE", (id) => `/agent/steer/${id}`, undefined],
      ["DELETE", (id) => `/agent/permission-rules/${id}`, undefined],
      ["POST", (id) => `/agent/memory/digest/${id}/undo`, { memory_id: randomUUID() }],
      ["POST", (id) => `/agent/memory/digest/${id}/pick`, { index: 0 }],
      ["PATCH", (id) => `/agent/memory/${id}`, { body: "覚える" }],
      ["DELETE", (id) => `/agent/memory/${id}`, undefined],
      ["POST", (id) => `/agent/memory/proposals/${id}/send`, {}],
      ["POST", (id) => `/agent/memory/proposals/${id}/decide`, { accept: true }],
      ["GET", (id) => `/agent/artifacts/${id}`, undefined],
      ["PATCH", (id) => `/agent/artifacts/${id}`, { title: "x" }],
      ["POST", (id) => `/agent/artifacts/${id}/versions`, { text: "x" }],
      ["POST", (id) => `/agent/artifacts/${id}/revert`, { version: 1 }],
      ["GET", (id) => `/agent/artifacts/${id}/download`, undefined],
      ["POST", (id) => `/vault/credentials/${id}/login-check`, {}],
      ["POST", (id) => `/vault/credentials/${id}/answer`, { request_id: "r1", code: "123456" }],
    ];
    for (const [method, path, body] of routes)
      for (const bad of BAD_PATH_IDS) {
        const label = `${method} ${path("<id>")} id=${JSON.stringify(bad)}`;
        await expectBadId(await req(method, path(encodeURIComponent(bad)), body, r.H), "id", label);
        // 同じ形違いをもう 1 回・正しい要求の直後も同じ答え（操作の揺れ）
        await expectBadId(await req(method, path(encodeURIComponent(bad)), body, r.H), "id", `${label}（2 回目）`);
      }
    expect((await req("PATCH", `/agent/conversations/${conv}`, { title: "正しい" }, r.H)).status).toBe(200);
    await expectBadId(
      await req("PATCH", `/agent/conversations/${encodeURIComponent(BAD_PATH_IDS[0]!)}`, { title: "x" }, r.H),
      "id",
      "正しい要求の直後",
    );
    expect({
      conv: await count("select count(*) as n from conversations where owner_member_id = $1 and deleted_at is null", [
        r.member,
      ]),
      mem: await count("select count(*) as n from memories where owner_member_id = $1", [r.member]),
      art: await count("select count(*) as n from artifacts where owner_member_id = $1", [r.member]),
    }).toEqual(before);
  }, 120_000);

  it("K145-API-002 体の id の欄（say の conversation_id・branch_from／resume・stop・steer・answer・answer2 の job_id／new の conversation_id／bridge-revoke の session_id／undo の memory_id／send の target_scope_id／artifacts の message_id／testrun/cancel の run_id／golive/pause の employee_id）が形違いなら 422・その欄の名前。仕事・会話・成果物は増えない（黙って捨てる所〔attachment_ids・quote.message_id・target_scope_id〕は Q4 の答え待ち・k145_pending_decisions.test.ts）", async () => {
    const r = await ready();
    const job = await newJob(r, "running");
    const conv = await newConversation(r.H);
    const jobs = await jobsOf(r.member);
    const convs = await count("select count(*) as n from conversations where owner_member_id = $1", [r.member]);
    const events = await eventsOf(job.job_id);
    const cases: [string, string, string, (bad: string) => unknown][] = [
      ["POST", "/agent/say", "conversation_id", (bad) => ({ text: "x", conversation_id: bad })],
      ["POST", "/agent/say", "branch_from", (bad) => ({ text: "x", branch_from: bad })],
      ["POST", "/agent/resume", "job_id", (bad) => ({ job_id: bad, how: "continue" })],
      ["POST", "/agent/new", "conversation_id", (bad) => ({ conversation_id: bad })],
      ["POST", "/agent/answer", "job_id", (bad) => ({ job_id: bad, request_id: "r1", allow: true })],
      ["POST", "/agent/bridge-revoke", "session_id", (bad) => ({ session_id: bad })],
      ["POST", "/agent/stop", "job_id", (bad) => ({ job_id: bad })],
      ["POST", "/agent/steer", "job_id", (bad) => ({ job_id: bad, text: "直して" })],
      ["POST", "/agent/answer2", "job_id", (bad) => ({ job_id: bad, request_id: "r1", allow: true })],
      ["POST", `/agent/memory/digest/${randomUUID()}/undo`, "memory_id", (bad) => ({ memory_id: bad })],
      ["POST", "/agent/artifacts", "message_id", (bad) => ({ message_id: bad, text: "# 表\n中身" })],
      ["POST", "/onboard/testrun/cancel", "run_id", (bad) => ({ run_id: bad })],
      ["POST", "/onboard/golive/pause", "employee_id", (bad) => ({ employee_id: bad, paused: true })],
    ];
    for (const [method, path, field, body] of cases)
      for (const bad of BAD_IDS)
        await expectBadId(
          await req(method, path, body(bad), r.H),
          field,
          `${method} ${path} ${field}=${JSON.stringify(bad)}`,
        );
    // null・送らない は「無し」（conversation_id なら新しい会話）
    expect((await post("/agent/say", { text: "x" }, r.H)).status).toBe(201);
    expect(await jobsOf(r.member)).toBe(jobs + 1);
    expect(await count("select count(*) as n from conversations where owner_member_id = $1", [r.member])).toBe(
      convs + 1,
    );
    expect(await eventsOf(job.job_id)).toBe(events);
    expect((await req("GET", `/agent/conversations`, undefined, r.H)).status).toBe(200);
    void conv;
  }, 120_000);

  it("K145-API-003 問い合わせの id（/agent/state・/agent/messages の ?conversation_id）が形違いなら 422・field conversation_id。空（?conversation_id=）は指定なし（/agent/artifacts の ?conversation_id は黙って無視 → 422 が Q4 の答え待ち）", async () => {
    const r = await ready();
    for (const bad of BAD_IDS.filter((v) => v !== "")) {
      const q = encodeURIComponent(bad);
      await expectBadId(
        await req("GET", `/agent/state?conversation_id=${q}`, undefined, r.H),
        "conversation_id",
        `state ${bad}`,
      );
      await expectBadId(
        await req(
          "GET",
          `/agent/messages?conversation_id=${q}&before=${encodeURIComponent(new Date().toISOString())}`,
          undefined,
          r.H,
        ),
        "conversation_id",
        `messages ${bad}`,
      );
    }
    expect((await req("GET", "/agent/state?conversation_id=", undefined, r.H)).status).toBe(200);
    // /agent/messages は「いつより前か」が要る口。空の会話は 422 の文だけ（500 にしない）
    const m = await req(
      "GET",
      `/agent/messages?conversation_id=&before=${encodeURIComponent(new Date().toISOString())}`,
      undefined,
      r.H,
    );
    expect(m.status).toBe(422);
  }, 60_000);
});

describe("K-145 PC の口（x-bridge-session）の id も同じ部品で確かめる", () => {
  it("K145-API-004 ask・answer・partial・steers・answer2・code・check-result の job_id、entries の conversation_id・job_id、attachment の job_id・attachment_id、credentials/resolve の job_id・credential_id が形違いなら 422・その欄。出来事・証跡は増えない。「生きているか」より前に止まる", async () => {
    const r = await ready();
    const job = await newJob(r, "running");
    const events = await eventsOf(job.job_id);
    const audits = await count("select count(*) as n from audit_events where tenant_id = $1", [r.tenant]);
    const cases: [string, string, (bad: string) => unknown][] = [
      ["/bridge/ask", "job_id", (bad) => ({ job_id: bad, request_id: "r1", tool: "Bash", summary: "ls" })],
      ["/bridge/answer", "job_id", (bad) => ({ job_id: bad, request_id: "r1" })],
      ["/bridge/partial", "job_id", (bad) => ({ job_id: bad, text: "途中" })],
      ["/bridge/steers", "job_id", (bad) => ({ job_id: bad })],
      ["/bridge/answer2", "job_id", (bad) => ({ job_id: bad, request_id: "r1" })],
      ["/bridge/code", "job_id", (bad) => ({ job_id: bad, request_id: "r1" })],
      ["/bridge/credentials/check-result", "job_id", (bad) => ({ job_id: bad, state: "ok" })],
      ["/bridge/entries", "conversation_id", (bad) => ({ conversation_id: bad, entries: [] })],
      ["/bridge/entries", "job_id", (bad) => ({ conversation_id: job.conversation_id, job_id: bad, entries: [] })],
      ["/bridge/attachment", "job_id", (bad) => ({ job_id: bad, attachment_id: randomUUID() })],
      ["/bridge/attachment", "attachment_id", (bad) => ({ job_id: job.job_id, attachment_id: bad })],
      ["/bridge/credentials/resolve", "job_id", (bad) => ({ job_id: bad, credential_id: randomUUID() })],
      ["/bridge/credentials/resolve", "credential_id", (bad) => ({ job_id: job.job_id, credential_id: bad })],
    ];
    for (const [path, field, body] of cases)
      for (const bad of BAD_IDS)
        await expectBadId(await post(path, body(bad), r.B), field, `${path} ${field}=${JSON.stringify(bad)}`);
    expect(await eventsOf(job.job_id)).toBe(events);
    expect(await count("select count(*) as n from audit_events where tenant_id = $1", [r.tenant])).toBe(audits);
    // 正しい形の id は中へ（無い仕事は 404・動いている仕事の partial は 200）
    expect((await post("/bridge/partial", { job_id: randomUUID(), text: "x" }, r.B)).status).toBe(404);
    expect((await post("/bridge/partial", { job_id: job.job_id, text: "途中の文" }, r.B)).status).toBe(200);
  }, 120_000);

  it("K145-API-005 鍵の形：前の形（sessions の id）が uuid でない 36 字 → 401／正式な uuid か kpc_… で解けない → 410／外した直後（0 秒）の鍵 → 410（G-12・G-14）。どれも何も書かない", async () => {
    const r = await ready();
    const events = await count("select count(*) as n from bridge_job_events where tenant_id = $1", [r.tenant]);
    for (const bad of BAD_PATH_IDS) {
      const x = await post("/bridge/mirror-targets", {}, { "x-bridge-session": bad });
      expect(x.status, `鍵=${JSON.stringify(bad)}`).toBe(401);
      expect((await jsonOf(x)).code).toBe("UNAUTHENTICATED");
    }
    for (const key of [randomUUID(), "00000000-0000-4000-8000-000000000000", `kpc_${"a".repeat(43)}`]) {
      const x = await post("/bridge/mirror-targets", {}, { "x-bridge-session": key });
      expect(x.status, `鍵=${key}`).toBe(410);
      expect((await jsonOf(x)).code).toBe("SESSION_GONE");
    }
    // 外した直後（0 秒）
    expect((await post("/bridge/mirror-targets", {}, r.B)).status).toBe(200);
    expect((await post("/agent/bridge-revoke", { session_id: r.sid }, r.H)).status).toBe(200);
    const gone = await post("/bridge/mirror-targets", {}, r.B);
    expect(gone.status).toBe(410);
    expect(await count("select count(*) as n from bridge_job_events where tenant_id = $1", [r.tenant])).toBe(events);
  }, 60_000);
});

describe("K-145 正しい uuid は今までどおり中へ（500 にしない）・表記ゆらぎ・2 層目", () => {
  it("K145-API-006 無い行（v4・v7・nil・max・大文字）は 404。他の人の会話・記憶の id も 404 で中身を返さず、一覧の件数にも混ざらない（TP-PERM-03・04）", async () => {
    const me = await ready();
    const other = await ready();
    const theirs = await newConversation(other.H);
    const theirMem = await newMemory(other);
    for (const id of [...GOOD_IDS, theirs]) {
      const r1 = await req("PATCH", `/agent/conversations/${id}`, { title: "乗っ取り" }, me.H);
      expect(r1.status, id).toBe(404);
      expect((await jsonOf(r1)).code).toBe("CONVERSATION_NOT_FOUND");
      expect((await req("DELETE", `/agent/conversations/${id}`, undefined, me.H)).status, id).toBe(404);
      expect((await req("GET", `/agent/artifacts/${id}`, undefined, me.H)).status, id).toBe(404);
      expect((await post(`/agent/memory/proposals/${id}/send`, {}, me.H)).status, id).toBe(404);
      const m = await req(
        "GET",
        `/agent/messages?conversation_id=${id}&before=${encodeURIComponent(new Date().toISOString())}`,
        undefined,
        me.H,
      );
      expect(m.status, id).toBe(404);
    }
    expect((await req("PATCH", `/agent/memory/${theirMem}`, { body: "書き換え" }, me.H)).status).toBe(404);
    expect((await admin.query("select body from memories where id = $1", [theirMem])).rows[0]!.body).toBe("前の本文");
    expect((await req("PATCH", `/agent/conversations/${theirs}`, { title: "乗っ取り" }, me.H)).status).toBe(404);
    expect(await data<unknown[]>(req("GET", `/agent/artifacts?conversation_id=${theirs}`, undefined, me.H))).toEqual(
      [],
    );
    const list = await data<{ id: string }[]>(req("GET", "/agent/conversations", undefined, me.H));
    expect(list.map((c) => c.id)).not.toContain(theirs);
  }, 60_000);

  it("K145-API-007 表記ゆらぎ：道の値が大文字・前後の空白・全角の自分の会話の id でも、揃えて同じ会話として 200（契約の入口 K144-API-016 と同じ）", async () => {
    const r = await ready();
    const conv = await newConversation(r.H);
    for (const [label, make] of [
      ["大文字", (u: string) => u.toUpperCase()],
      ["前後の空白", (u: string) => `  ${u}  `],
      ["全角", fullWidth],
    ] as const) {
      const x = await req(
        "PATCH",
        `/agent/conversations/${encodeURIComponent(make(conv))}`,
        { title: `名前 ${label}` },
        r.H,
      );
      expect(x.status, label).toBe(200);
      const t = (await admin.query("select title from conversations where id = $1", [conv])).rows[0]!.title as string;
      expect(t, label).toBe(`名前 ${label}`);
    }
  }, 60_000);

  it("K145-API-008 2 層目：入口の確かめを外して形違いの文字が DB の uuid の引数に届いても（22P02）、500 でなく 422・VALIDATION_ERROR・「入力内容を確認してください」。答えに DB の文を出さない（D-130.2）", async () => {
    // 入口の確かめの無い小さな口を /api/auth-ext に付ける（本物の pg・本物の app.ts の onError）
    const leaky = new Hono();
    leaky.get("/k145/cast/:v", async (c) => {
      const r = await appPool.query<{ v: string }>("select $1::uuid as v", [c.req.param("v")]);
      return c.json({ data: r.rows[0]!.v });
    });
    const app2 = createApp({ version: "test", authExt: leaky });
    for (const bad of BAD_PATH_IDS) {
      const x = await app2.request(`http://localhost${X}/k145/cast/${encodeURIComponent(bad)}`);
      const text = await x.clone().text();
      expect(x.status, `${bad}: ${text.slice(0, 120)}`).toBe(422);
      const j = (await x.json()) as Json;
      expect(j.code).toBe("VALIDATION_ERROR");
      expect(j.details?.[0]?.message).toBe("入力内容を確認してください");
      expect(text).not.toMatch(/invalid input syntax|uuid/i);
    }
    const ok = await app2.request(`http://localhost${X}/k145/cast/${GOOD_IDS[0]}`);
    expect(ok.status).toBe(200);
  }, 60_000);
});

describe("K-145 送る量の守り（D-130.1・G-16）を前の道すじと node のサーバーにも", () => {
  it("K145-API-009 /sign-in（ログイン不要）と /agent/say（ログイン要る）に (a) content-length を 100 と偽った 5MB の流れ (b) 頭の無い 5MB の流れ (c) 頭だけ 1,048,577 の小さな体 → どれも 413・PAYLOAD_TOO_LARGE・「送る内容が大きすぎます」。(a)(b) は 1MB と 2 かたまりまでしか読まず、(c) は 1 バイトも読まない。ログインしていなくても 413 が 401 より先。仕事は増えない", async () => {
    const r = await ready();
    const jobs = await jobsOf(r.member);
    const bad: string[] = [];
    const TOTAL = 5 * BODY_MAX;
    for (const [path, headers] of [
      ["/sign-in", {}],
      ["/agent/say", r.H],
    ] as const) {
      for (const [label, length, total, maxRead] of [
        ["(a) content-length を 100 と偽った", "100", TOTAL, "limit"],
        ["(b) content-length の頭が無い", null, TOTAL, "limit"],
        ["(c) content-length の頭だけが 1,048,577", String(BODY_MAX + 1), 2, "none"],
      ] as const) {
        const b = countingBody(total);
        const h: Record<string, string> = { "content-type": "application/json", ...headers };
        if (length !== null) h["content-length"] = length;
        const res = await app.request(
          new Request(`http://localhost${X}${path}`, {
            method: "POST",
            headers: h,
            body: b.stream,
            duplex: "half",
          } as RequestInit),
        );
        const j = await jsonOf(res);
        if (res.status !== 413 || j.code !== "PAYLOAD_TOO_LARGE" || j.message !== "送る内容が大きすぎます")
          bad.push(`${path} ${label}：${res.status} ${JSON.stringify(j).slice(0, 80)}`);
        if (maxRead === "none" && b.pulled() !== 0)
          bad.push(`${path} ${label}：読まずに断るはずが ${b.pulled()} バイト読んだ`);
        if (maxRead === "limit" && b.pulled() > BODY_MAX + 2 * b.chunk)
          bad.push(`${path} ${label}：${b.pulled()} バイト読んだ（上限は ${BODY_MAX + 2 * b.chunk}）`);
      }
    }
    expect(bad).toEqual([]);
    expect(await jobsOf(r.member)).toBe(jobs);
  }, 120_000);

  it("K145-API-010 /agent/say の体がちょうど 1,048,576 バイトは 201（仕事が 1 つ増える）、1,048,577 バイトは 413（増えない）", async () => {
    const r = await ready();
    const bodyOf = (bytes: number) => {
      const wrap = Buffer.byteLength('{"text":""}');
      return `{"text":"${"a".repeat(bytes - wrap)}"}`;
    };
    expect(Buffer.byteLength(bodyOf(BODY_MAX))).toBe(BODY_MAX);
    const jobs = await jobsOf(r.member);
    const ok = await post("/agent/say", bodyOf(BODY_MAX), r.H);
    expect(
      ok.status,
      await ok
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    expect(await jobsOf(r.member)).toBe(jobs + 1);
    const big = await post("/agent/say", bodyOf(BODY_MAX + 1), r.H);
    expect(big.status).toBe(413);
    expect((await jsonOf(big)).code).toBe("PAYLOAD_TOO_LARGE");
    expect(await jobsOf(r.member)).toBe(jobs + 1);
  }, 60_000);

  it("K145-API-012 本番と同じ node のサーバー（@hono/node-server）に、頭の無い 5MB の流れを /api/auth-ext/sign-in へ送ると 413 が返り、接続が閉じる（吊るさない）。サーバーは落ちない（/health が 200）", async () => {
    const server: ServerType = await new Promise((resolve) => {
      const s = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, () => resolve(s));
    });
    try {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      expect(port).toBeGreaterThan(0);
      const result = await new Promise<{ status: number; body: string; sent: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("10 秒たっても答えが来ない（吊るしている）")), 10_000);
        let sent = 0;
        const rq = httpRequest(
          {
            host: "127.0.0.1",
            port,
            method: "POST",
            path: `${X}/sign-in`,
            headers: { "content-type": "application/json", "transfer-encoding": "chunked" },
          },
          (res) => {
            let body = "";
            res.on("data", (c) => (body += c));
            res.on("end", () => {
              clearTimeout(timer);
              resolve({ status: res.statusCode ?? 0, body, sent });
            });
          },
        );
        rq.on("error", (e) => {
          // 413 を返した後にサーバーが切る（EPIPE／ECONNRESET）のは「吊るさない」の形。答えを受け取っていれば上の end が先に解決する
          if (!["EPIPE", "ECONNRESET"].includes((e as NodeJS.ErrnoException).code ?? "")) {
            clearTimeout(timer);
            reject(e);
          }
        });
        const chunk = Buffer.alloc(65_536, 0x61);
        const pump = () => {
          while (sent < 5 * BODY_MAX) {
            sent += chunk.byteLength;
            if (!rq.write(chunk)) return rq.once("drain", pump);
          }
          rq.end();
        };
        pump();
      });
      expect(result.status).toBe(413);
      expect(JSON.parse(result.body)).toMatchObject({ code: "PAYLOAD_TOO_LARGE", message: "送る内容が大きすぎます" });
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      expect(health.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 30_000);
});

describe("K-145 人が書く欄を黙って切らない（D-130.4）", () => {
  it("K145-API-013 会話の名前 300 字（PATCH /agent/conversations/:id）と記憶の題 300 字・本文 5000 字（PATCH /agent/memory/:id）は、一覧と DB から読み戻して一字も欠けない", async () => {
    const r = await ready();
    const conv = await newConversation(r.H);
    const title = `会話の名前${"長".repeat(290)}終`;
    expect((await req("PATCH", `/agent/conversations/${conv}`, { title }, r.H)).status).toBe(200);
    const list = await data<{ id: string; title: string }[]>(req("GET", "/agent/conversations", undefined, r.H));
    expect(list.find((c) => c.id === conv)?.title).toBe(title);
    const mem = await newMemory(r);
    const mTitle = `題${"い".repeat(298)}末`;
    const mBody = `本文${"あ".repeat(4996)}末尾`;
    expect([...mBody].length).toBe(5000);
    expect((await req("PATCH", `/agent/memory/${mem}`, { title: mTitle, body: mBody }, r.H)).status).toBe(200);
    const row = (
      await admin.query<{ title: string; body: string }>("select title, body from memories where id = $1", [mem])
    ).rows[0]!;
    expect(row.title).toBe(mTitle);
    expect(row.body).toBe(mBody);
  }, 60_000);

  it("K145-API-014 候補の確認（POST /agent/memory/proposals/:id/decide）の本文 5000 字は、上の層の記憶に一字も欠けずに入る", async () => {
    const r = await ready();
    const proposal = await newProposal(r);
    const body = `上の層の決まり${"う".repeat(4990)}おわり`;
    const x = await post(`/agent/memory/proposals/${proposal}/decide`, { accept: true, body }, r.H);
    expect(
      x.status,
      await x
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(200);
    const row = (
      await admin.query<{ body: string }>(
        "select body from memories where source_type_id = 'proposal' and source_ref_id = $1",
        [proposal],
      )
    ).rows[0];
    expect(row?.body).toBe(body);
  }, 60_000);
});

describe("K-145 部品の決まり（DB に触らない）", () => {
  it("K145-API-016 まとめの答え（parseDigest）：merged.memory_ids は正式な uuid だけ残す（版の桁 0・36 個のハイフンは捨てる）。propose.target_scope_id は正式な uuid でなければ空（DB に届けない）", () => {
    const good = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const r = parseDigest(
      JSON.stringify({
        remembered: [],
        merged: [{ memory_ids: [...BAD_IDS, good], body: "m" }],
        propose: [...BAD_IDS, good].map((t, i) => ({ body: `p${i}`, target_scope_id: t })),
        discarded: [],
      }),
    );
    expect(r?.merged).toEqual([{ memory_ids: [good], title: "", body: "m", kind: "" }]);
    expect(r?.propose.map((p) => p.target_scope_id)).toEqual([...BAD_IDS.map(() => ""), good]);
  });

  it("K145-API-017 契約の isUuid（z.uuid()）の決まり：違う 8 つは false・正しい 5 つ（v4・v7・nil・max・大文字）は true。前後の空白は false（揃えるのは入口の normalize）", () => {
    expect(BAD_IDS.map((v) => isUuid(v))).toEqual(BAD_IDS.map(() => false));
    expect(GOOD_IDS.map((v) => isUuid(v))).toEqual(GOOD_IDS.map(() => true));
    expect(isUuid(` ${GOOD_IDS[0]} `)).toBe(false);
  });
});
