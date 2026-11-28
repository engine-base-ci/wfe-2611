// 段 4「預けたログイン情報の口」（K-351 一覧・K-352 預ける・K-353 上書きと消す）の試験の共通の土台。
//   行（it）は葉ごとのファイル credentials-list.test.ts（K-351）・credentials-create.test.ts（K-352）・credentials-update-delete.test.ts（K-353）にある。
//   土台は各ファイルの頭で setupCredentials() を 1 回呼ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては K-57・K-60 の土台（apps/api/test/features/fixture.ts）と同じ：本物の Postgres（migration を全部当てる）・本物の口の入口（createApp と契約の op）・
//   本物の口の振る舞い（葉ごとの hooks のファイル apps/api/src/hooks/credentials-*.ts の register・K-326）。画面のログインだけは偽（Bearer に会社・人・役・ログインと取り直しの時刻を書く）。
//   秘密の関門（packages/secrets の SecretsGateway・AES-256-GCM・会社ごとの鍵）は本物。保管の実体だけ試験の TestVault（メモリ＋失敗を起こせる）に差し替える。
//
// 口の振る舞いの読み込みは、試験の本体（it の中）の h.ready() で 1 回だけする。実装の前（切る段の smoke）に、
//   まだ無いファイルを土台の頭で読みに行って準備ごと落とさないため（準備の赤と本体の赤を分ける・answer=8f745003d023）。
//
// 試験が決める振る舞いの差し込み口（口の登録は葉ごとの hooks のファイル・K-326）:
//   apps/api/src/hooks/credentials-list.ts（K-351）・credentials-create.ts（K-352）・credentials-edit.ts（K-353）
//     export const register = defineHooks({ name, make: (d: HookDeps) => …, fuzz: "same" })
//   材料 HookDeps の secrets は K-351 が足す。土台は在る credentials-*.ts を全部読み、make に { appPool, repo, secrets, config } を渡す
//   d.config.env と d.secrets.durable は要求ごとに読む（作った時に写さない）。試験が h.deps.env・h.vault.durable を途中で変える
import pg from "pg";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, vi } from "vitest";
import { migrate } from "@kaname/db/migrate";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { MemoryVault, SecretsGateway, type StoredSecret, type Vault } from "@kaname/secrets";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import type { Fixture } from "../fixture.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PKG = join(HERE, "..", "..", "..", "..", "..", "packages", "db");
/** 口の振る舞いの在りか（試験の本体で読む）。葉ごとのファイル credentials-*.ts（まだ入っていない葉の物は無い） */
const HOOKS_DIR = join(HERE, "..", "..", "..", "src", "hooks");
/** 試験の主の鍵（試験だけのもの・32 バイト） */
export const MASTER_KEY = Buffer.alloc(32, 9);

/** 保管の実体（試験用）：メモリに置き、置く・失効させるを試験が失敗させられる。置いた参照と失効させた参照を数える */
export class TestVault implements Vault {
  durable = true;
  failPut: Error | null = null;
  failRevoke: Error | null = null;
  readonly puts: string[] = [];
  readonly revokes: string[] = [];
  private readonly inner = new MemoryVault();
  async put(ref: string, s: StoredSecret): Promise<void> {
    if (this.failPut) throw this.failPut;
    this.puts.push(ref);
    await this.inner.put(ref, s);
  }
  async get(ref: string): Promise<StoredSecret | null> {
    return this.inner.get(ref);
  }
  async revoke(ref: string): Promise<boolean> {
    if (this.failRevoke) throw this.failRevoke;
    this.revokes.push(ref);
    return this.inner.revoke(ref);
  }
  async revokeTenant(tenantId: string): Promise<number> {
    return this.inner.revokeTenant(tenantId);
  }
  /** 失効していない置いた物（会社を問わず）。後片付けの確かめに使う */
  async live(ref: string): Promise<boolean> {
    const s = await this.inner.get(ref);
    return !!s && !s.revokedAt;
  }
}

export interface Person {
  id: string;
  tenantId: string;
  scopeId: string;
}
export interface SessionOpts {
  /** ログインから何秒たったか（null＝ログインの時刻が無い）。既定 60 秒＝ログインから 15 分の内 */
  loginAgoSec?: number | null;
  /** 本人確認を取り直してから何秒たったか（null＝取り直していない）。既定 null */
  stepUpAgoSec?: number | null;
  /** 同意し直しが要るセッション（K-53） */
  termsPending?: boolean;
}
export interface CredHarness {
  admin: pg.Pool;
  pool: pg.Pool;
  repo: Repository;
  vault: TestVault;
  secrets: SecretsGateway;
  /** 口の振る舞いに渡す差し込み口（env を試験が変える） */
  deps: { env: string };
  /** 上限の差し替え（operationId → 1 分あたり） */
  limits: Record<string, number>;
  /** 口の振る舞いを読み込む（各 it の頭で呼ぶ。2 回目からは何もしない） */
  ready: () => Promise<void>;
  /** 契約の口を叩く。path は /api/v1 から */
  req: (
    method: string,
    path: string,
    o?: { body?: unknown; headers?: Record<string, string>; ip?: string },
  ) => Promise<Response>;
  json: (r: Response) => Promise<Record<string, unknown> & { data?: unknown }>;
  company: (name: string) => Promise<{ tenantId: string; rootScope: string }>;
  /** 会社の人を作る。admin なら預けたログイン情報（credentials）のワークスペース全体の edit を付ける（管理者の束と同じ行） */
  person: (tenantId: string, scopeId: string, o?: { name?: string; admin?: boolean }) => Promise<Person>;
  /** 画面のログインの頭（偽のセッション） */
  as: (p: Person, o?: SessionOpts) => Record<string, string>;
  /** その人の PC がつながっている（sessions に bridge の行） */
  bridgeOn: (p: Person) => Promise<void>;
  /** 規約の判定の台帳にサービスを足す（domain・automation_verdict_id） */
  service: (tenantId: string, domain: string, verdict: string) => Promise<string>;
  /** 表の行をそのまま読む（行の守りの外・admin） */
  row: (id: string) => Promise<Record<string, unknown> | undefined>;
  /** 預けた中身を関門の取り出し（実行器として）で読み、JSON にして返す（暗号文が正しく置かれたかの確かめ） */
  plain: (p: Person, ref: string) => Promise<Record<string, unknown> | null>;
  /** console の出力を貯めて返す（fn の間だけ） */
  captureLogs: (fn: () => Promise<void>) => Promise<string>;
}

let ipSeq = 0;
const nextIp = (): string => `203.0.113.${(ipSeq = (ipSeq % 250) + 1)}`;

/** 共有の試験 k144-contract.test.ts の土台（fixture.ts の Fixture）に、葉の hooks のファイル（apps/api/src/hooks/<file>.ts の register・K-326）を足す。
 *  葉ごとのファイル（contract/k144.d/K-353.ts・K-355.ts の setup）が自分のファイルの名前で 1 回ずつ呼ぶ（ほかの葉の行を当てにしない）。
 *  ファイルは最初の要求の前に 1 回だけ読む（準備で読まない：実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。
 *  材料は預けたログイン情報の口が使う欄だけ（秘密の関門は本物の形・保管はメモリ。k144 は値を預けない） */
export function addCredentialLeafHooks(f: Pick<Fixture, "pool" | "hooks" | "req">, file: string): void {
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    const repo = await createRepository(f.pool);
    const d = {
      appPool: f.pool,
      repo,
      secrets: new SecretsGateway(repo, new MemoryVault(), MASTER_KEY),
      config: { env: "test" },
    } as unknown as HookDeps;
    const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
    Object.assign(f.hooks, m.register.make(d));
  };
  const base = f.req;
  f.req = async (method, path, o) => {
    await (loading ??= load());
    return base(method, path, o);
  };
}

/** 各試験のファイルの頭で 1 回呼ぶ。beforeAll で組み立て、afterAll で閉じる */
export function setupCredentials(): CredHarness {
  const vault = new TestVault();
  const limits: Record<string, number> = {};
  const hooks: Record<string, Hook> = {};
  const deps = { env: "test" };
  let admin: pg.Pool;
  let pool: pg.Pool;
  let repo: Repository;
  let secrets: SecretsGateway;
  let app: ReturnType<typeof createApp>;
  let loaded = false;

  beforeAll(async () => {
    await migrate(DB_URL, DB_PKG);
    admin = new pg.Pool({ connectionString: DB_URL, max: 3 });
    pool = createPool({ databaseUrl: APP_URL, max: 6 });
    repo = await createRepository(pool);
    secrets = new SecretsGateway(repo, vault, MASTER_KEY);
    // 偽の画面のログイン：Bearer fake:<role>:<tenant>:<member>:<ログインからの秒|->:<取り直しからの秒|->[:terms]
    const web = async (h: Headers) => {
      const m = /^Bearer fake:(member|ops|client):([0-9a-f-]{36}):([0-9a-f-]{36}):(-|\d+):(-|\d+)(:terms)?$/.exec(
        h.get("authorization") ?? "",
      );
      if (!m) return null;
      const ago = (s: string) => (s === "-" ? null : new Date(Date.now() - Number(s) * 1000));
      const ctx: TenantContext = {
        tenantId: m[2]!,
        userId: m[3]!,
        role: m[1] as TenantContext["role"],
        loginAt: ago(m[4]!),
        stepUpAt: ago(m[5]!),
      };
      return { ctx, sessionId: "", authUserId: "", termsPending: m[6] === ":terms" };
    };
    app = createApp({
      version: "test",
      repo,
      resolve: withDevice(web, createDeviceResolver(pool)) as never,
      contract: { hooks, limits },
    });
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
    await admin?.end();
  });

  const one = async (sql: string, p: unknown[]) => (await admin.query<{ id: string }>(sql, p)).rows[0]!.id;

  const h: CredHarness = {
    get admin() {
      return admin;
    },
    get pool() {
      return pool;
    },
    get repo() {
      return repo;
    },
    get secrets() {
      return secrets;
    },
    vault,
    deps,
    limits,
    ready: async () => {
      if (loaded) return;
      const files = readdirSync(HOOKS_DIR)
        .filter((n) => /^credentials-[a-z-]+\.ts$/.test(n))
        .sort();
      // 設定（config）は deps を写さずそのまま渡す（env を試験が途中で変える）。ほかの欄は預けたログイン情報の口は使わない
      const d = { appPool: pool, repo, secrets, config: deps } as unknown as HookDeps;
      for (const n of files) {
        const m = (await import(join(HOOKS_DIR, n))) as { register: HookModule };
        Object.assign(hooks, m.register.make(d));
      }
      loaded = true;
    },
    req: (method, path, o = {}) =>
      Promise.resolve(
        app.request(`http://localhost/api/v1${path}`, {
          method,
          headers: { "content-type": "application/json", "x-forwarded-for": o.ip ?? nextIp(), ...(o.headers ?? {}) },
          ...(o.body === undefined ? {} : { body: typeof o.body === "string" ? o.body : JSON.stringify(o.body) }),
        }),
      ),
    json: async (r) => (await r.json()) as Record<string, unknown> & { data?: unknown },
    company: async (name) => {
      const tenantId = await one(
        "insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() u returning id",
        [name],
      );
      const rootScope = await one(
        "insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, '') returning id",
        [tenantId, `${name} の全体`],
      );
      return { tenantId, rootScope };
    },
    person: async (tenantId, scopeId, o = {}) => {
      const id = await one(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', $3) returning id",
        [tenantId, scopeId, o.name ?? "人"],
      );
      if (o.admin)
        await admin.query(
          "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'credentials', null, 'edit')",
          [tenantId, id],
        );
      return { id, tenantId, scopeId };
    },
    as: (p, o = {}) => {
      const login = o.loginAgoSec === undefined ? "60" : o.loginAgoSec === null ? "-" : String(o.loginAgoSec);
      const step = o.stepUpAgoSec === undefined || o.stepUpAgoSec === null ? "-" : String(o.stepUpAgoSec);
      return {
        authorization: `Bearer fake:member:${p.tenantId}:${p.id}:${login}:${step}${o.termsPending ? ":terms" : ""}`,
      };
    },
    bridgeOn: async (p) => {
      await admin.query(
        "insert into sessions (tenant_id, member_id, kind_id, device_label, alive_at) values ($1, $2, 'bridge', '試験の PC', now())",
        [p.tenantId, p.id],
      );
    },
    service: async (tenantId, domain, verdict) =>
      one(
        "insert into service_registry (tenant_id, name, domain, automation_verdict_id) values ($1, $2, $3, $4) returning id",
        [tenantId, domain, domain, verdict],
      ),
    row: async (id) => (await admin.query("select * from credentials where id = $1", [id])).rows[0],
    plain: async (p, ref) => {
      const o = await secrets.resolve(ref, { tenantId: p.tenantId, userId: p.id, role: "member", caller: "executor" });
      return o.status === "done" ? (JSON.parse(o.value) as Record<string, unknown>) : null;
    },
    captureLogs: async (fn) => {
      const out: string[] = [];
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
        vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
      );
      try {
        await fn();
      } finally {
        for (const s of spies) s.mockRestore();
      }
      return out.join("\n");
    },
  };
  return h;
}
