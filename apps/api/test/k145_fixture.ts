// K-145 の口の試験（k145_uuid_guard.test.ts・k145_pending_decisions.test.ts）の土台。試験のファイルではない（vitest は *.test.ts だけを集める）。
//   試験のファイルどうしで import すると、読み込まれた側の describe／it がその場で登録されて 2 回流れる（精査 R 回 1 追加-1）ので、
//   共通の値（BAD_IDS ほか）と組み立て・手順はここに置き、両方の試験がここから読む。
//   土台は本物の Postgres（RLS あり）・authExt（前の道すじ）・本物の PC の印（bridge_pair.ts）
import pg from "pg";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect } from "vitest";
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
import { keepAuth, verifiedUser } from "./_pending.js";
import { pairForTest } from "./bridge_pair.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
export const ADMIN = process.env["DATABASE_URL"]!;
export const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
export const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
export const PW = "Str0ng-Passw0rd!";
export const X = "/api/auth-ext";
export const BODY_MAX = 1_048_576;
export let app: ReturnType<typeof createApp>;
export let admin: pg.Pool;
export let appPool: pg.Pool;

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
export const BAD_PATH_IDS = BAD_IDS.filter((v) => v !== "");
// 正式な uuid（入口の形 z.uuid() が通す）：v4・v7・nil・max・大文字
export const GOOD_IDS = [
  "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "0193c5a0-5f3e-7c0a-9d4e-0b1a2c3d4e5f",
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "3FA85F64-5717-4562-B3FC-2C963F66AFA6",
] as const;
export const fullWidth = (s: string) =>
  [...s]
    .map((c) => (c === "-" ? "－" : /[0-9a-f]/.test(c) ? String.fromCharCode(c.charCodeAt(0) + 0xfee0) : c))
    .join("");

export type Json = Record<string, unknown> & {
  code?: string;
  field?: string;
  message?: string;
  details?: { field: string; message: string }[];
  data?: unknown;
};
export const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
export const post = (path: string, body: unknown, h: Record<string, string> = {}) => req("POST", path, body, h);
export const jsonOf = async (r: Response) =>
  (await r
    .clone()
    .json()
    .catch(() => ({}))) as Json;
export const data = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;
export const uniq = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const count = async (sql: string, p: unknown[] = []) =>
  Number((await admin.query<{ n: string }>(sql, p)).rows[0]!.n);

/** 422 の答えが「その欄の形が違う」と言っている（契約の入口と同じ理由 "uuid"・前の道すじの field）。500 ではない */
export async function expectBadId(r: Response, field: string, label: string) {
  const j = await jsonOf(r);
  expect(r.status, `${label}: ${JSON.stringify(j).slice(0, 160)}`).toBe(422);
  expect(j.code, label).toBe("VALIDATION_FAILED");
  expect(j.field, label).toBe(field);
  expect(j.details?.find((d) => d.field === field)?.message, label).toBe("uuid");
}

/** 試験のファイルの beforeAll で呼ぶ（本物の Postgres・authExt・置き場の上限 4MB） */
export async function bootK145(): Promise<void> {
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
}
/** 試験のファイルの afterAll で呼ぶ */
export async function closeK145(): Promise<void> {
  await appPool?.end();
  await admin?.end();
}

/** 登録した人（確認済み）と、その人の本物の PC の印 */
export async function ready() {
  const email = `${uniq()}@example.com`;
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K145" });
  const H = { authorization: `Bearer ${ver.token}` };
  const bp = await pairForTest(admin, email);
  const B = { "x-bridge-session": bp.token };
  const row = (await admin.query<{ scope_id: string }>("select scope_id from members where id = $1", [bp.member]))
    .rows[0]!;
  return { H, B, member: bp.member, tenant: bp.tenant, scope: row.scope_id, sid: bp.sid };
}
export type Ready = Awaited<ReturnType<typeof ready>>;
export const newConversation = async (H: Record<string, string>) =>
  (await data<{ conversation_id: string }>(post("/agent/conversations", {}, H))).conversation_id;
/** 仕事を 1 つ積む（PC はつないである）。状態を置き換えられる */
export async function newJob(r: Ready, state: "queued" | "running" | "asking" = "queued") {
  const s = await data<{ conversation_id: string; job_id: string }>(post("/agent/say", { text: "K-145 の仕事" }, r.H));
  if (state !== "queued") await admin.query("update bridge_jobs set state_id = $2 where id = $1", [s.job_id, state]);
  return s;
}
export const eventsOf = (job: string) => count("select count(*) as n from bridge_job_events where job_id = $1", [job]);
export const jobsOf = (member: string) => count("select count(*) as n from bridge_jobs where member_id = $1", [member]);

/** 流れの体（K144-API-044 と同じ）：読まれた量を数え、cancel を記録する */
export const countingBody = (total: number, chunk = 65_536) => {
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
