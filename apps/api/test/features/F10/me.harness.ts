// 段 11「自分の設定」の口の試験の共通の土台（K-833 が切る段で書き、carry で運ぶ。K-833〜K-838 の 6 つの葉が使う）。行（it）は葉ごとのファイル
//   （apps/api/test/features/F10/me-*.test.ts）にある。土台は各ファイルの頭で setupMe(<hooks のファイル>) を 1 回呼ぶ（ファイルごとに本物の DB を立てる）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては admin.harness.ts（K-800）と同じ：本物の Postgres（migration を全部当てる）・本物の口の入口（createApp と契約の op）・本物の口の振る舞い
//   （葉ごとの hooks のファイル。K-326 の register）。画面のログインだけは偽（Bearer fake:member:<会社>:<人>[:su=<取り直しの時刻 ms>][:sid=<部品のセッションの id>]）。
//   外へ出す物は試験の偽：メール（関門 C6）は貯める（failMailTo の宛ては送れなかったことにする）・置き場（関門 C4）は本物のローカルの置き場を
//   「置けない・消せない」を 1 回ずつ起こせる形で包む・認証の部品（Better Auth）は getSession と、ほかのセッションの期限を今にする所だけの偽。
// 試験が前提にする形（各葉のチケットの「実施事項」）:
//   口は今のログインの印（部品のセッションの id と利用者の id）を `d.auth.api.getSession({ headers: a.c.req.raw.headers })` で引く（K-312 と同じ）。
//   同じログインの人は、tenant_memberships.auth_user_id が同じ人（D-125.150）。別の会社にも入れるのは f.alsoIn(p, 会社, グループ)。
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { afterAll, beforeAll, vi } from "vitest";
import { migrateAuth } from "@kaname/auth/migrate";
import { createRepository } from "@kaname/db/repository";
import type { TenantContext } from "@kaname/db/context";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { Hook } from "../../../src/contract/deps.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { msg, STEP_UP_MS, type J, type P, type SentMail } from "./admin.harness.js";

export { msg, STEP_UP_MS };
export type { J, P, SentMail };

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = join(HERE, "..", "..", "..", "src", "hooks");

export interface MeWorld {
  tenantId: string;
  /** 営業（会社のいちばん上・EG） */
  eg: string;
  /** 受託開発（営業の子・JD） */
  jd: string;
  /** 管理者（会社を作った人・owner の印つき） */
  admin: P;
  /** 2 人目の管理者 */
  admin2: P;
  /** 営業のメンバー（自分の設定を触る人の見本） */
  member: P;
  /** 止めた人 */
  stopped: P;
  /** 別の会社とその管理者 */
  other: { tenantId: string; eg: string };
  outsider: P;
}
export interface MakeOpts {
  tenant?: string;
  scope?: string;
  role?: "admin" | "manager" | "member" | "viewer" | "requester";
  groupRole?: "manager" | "member" | "viewer";
  status?: "active" | "suspended" | "invited" | "left";
  owner?: boolean;
}
export interface CallOpts {
  body?: unknown;
  /** multipart の体（FormData）。あれば body は使わない */
  form?: FormData;
  su?: number;
  /** 部品のセッションの id（今の端末の印）。無ければ今の端末を持たない */
  sid?: string;
  key?: string;
  headers?: Record<string, string>;
}
export interface SessionOpts {
  kind?: "web" | "bridge" | "api";
  auth?: string;
  label?: string;
  region?: string | null;
  seenMinutesAgo?: number;
  revoked?: boolean;
}

export interface MeHarness {
  f: Fixture;
  /** 口の振る舞いを読み込む（各 it の頭で呼ぶ。2 回目からは何もしない） */
  ready: () => Promise<void>;
  limits: Record<string, number>;
  mails: SentMail[];
  /** この宛てへのメールは送れなかったことにする */
  failMailTo: Set<string>;
  /** 置き場（関門 C4）：true の間は置く・消すを失敗させる */
  driverFail: { put: boolean; del: boolean };
  /** 部品（認証）の側のセッションの期限を今にした印（update の呼び出しの記録）。failAuthCleanup が true の間はその呼び出しが落ちる */
  authExpired: string[];
  authFlags: { failCleanup: boolean };
  /** 置き場の関門（試験が実体の在る・無いを見る） */
  store: () => ObjectStore;
  world: () => Promise<MeWorld>;
  make: (w: { tenantId: string; eg: string }, key: string, name: string, o?: MakeOpts) => Promise<P>;
  call: (p: Person, method: string, path: string, o?: CallOpts) => Promise<Response>;
  json: (r: Response) => Promise<J>;
  suNow: () => number;
  suAgo: (minutes: number) => number;
  num: (sql: string, p?: unknown[]) => Promise<number>;
  one: <R = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<R>;
  rows: <R = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<R[]>;
  audits: (tenantId: string, action: string) => Promise<number>;
  notes: (memberId: string, kind: string) => Promise<Record<string, unknown>[]>;
  /** その人の画面か PC のセッションの行を 1 つ入れる（部品のセッションの id を返す） */
  session: (p: Person, o?: SessionOpts) => Promise<{ id: string; auth: string }>;
  /** fn の間だけ、その会社の行を書く所で DB の例外を起こす（その会社の行だけ・ほかの試験に効かせない） */
  breakOn: (
    table: string,
    tenantId: string,
    op: "insert" | "update",
    fn: () => Promise<void>,
    cond?: string,
  ) => Promise<void>;
  /** fn の間だけ、指した口（hooks の鍵）の接続を「落ちる接続」に差し替える（DB の失敗を、ほかの試験・口に効かせずに起こす） */
  breakPool: (ops: string[], fn: () => Promise<void>) => Promise<void>;
  /** console の出力を貯めて返す（fn の間だけ） */
  captureLogs: (fn: () => Promise<void>) => Promise<string>;
}

/** 試験が置く画像（中身の先頭の印が合う・size バイトちょうど） */
export function image(kind: "png" | "jpeg" | "webp" | "gif", size = 1024): Uint8Array {
  const head: Record<string, number[]> = {
    png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    jpeg: [0xff, 0xd8, 0xff, 0xe0],
    webp: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  };
  const b = new Uint8Array(size);
  b.set(head[kind]!);
  return b;
}

export function setupMe(hooksFile: string, o: { extraHooks?: string[] } = {}): MeHarness {
  const h = {} as MeHarness;
  const file = join(HOOKS_DIR, hooksFile);
  const hooks: Record<string, Hook> = {};
  const limits: Record<string, number> = {};
  const mails: SentMail[] = [];
  const failMailTo = new Set<string>();
  const driverFail = { put: false, del: false };
  const authExpired: string[] = [];
  const authFlags = { failCleanup: false };
  let app: ReturnType<typeof createApp>;
  let loading: Promise<void> | null = null;
  let store: ObjectStore;
  let seq = 0;

  const admin = () => h.f.admin;
  const mkObjects = (repo: Awaited<ReturnType<typeof createRepository>>) => {
    const inner = localDriver(mkdtempSync(join(tmpdir(), "me-obj-")));
    const driver = {
      put: async (...a: Parameters<typeof inner.put>) => {
        if (driverFail.put) throw new Error("置けなかった（試験）");
        return inner.put(...a);
      },
      get: inner.get.bind(inner),
      delete: async (...a: Parameters<typeof inner.delete>) => {
        if (driverFail.del) throw new Error("消せなかった（試験）");
        return inner.delete(...a);
      },
    };
    return new ObjectStore(repo, driver, { signingSecret: "me-files" });
  };
  /** 認証の部品の偽：getSession（Bearer の sid と、人のログインの利用者）と、ほかのセッションの期限を今にする所 */
  const fakeAuth = () => ({
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const m = /^Bearer fake:member:([0-9a-f-]{36}):([0-9a-f-]{36})(?::su=\d+)?(?::sid=([^:]+))?$/.exec(
          headers.get("authorization") ?? "",
        );
        if (!m) return null;
        const au = (
          await admin().query<{ a: string | null }>(
            "select auth_user_id as a from tenant_memberships where tenant_id = $1 and member_id = $2",
            [m[1], m[2]],
          )
        ).rows[0]?.a;
        return { session: { id: m[3] ?? "", token: m[3] ?? "" }, user: { id: au ?? "" } };
      },
    },
    $context: Promise.resolve({
      internalAdapter: {
        // 部品の側のそのログインのセッション（試験では Kaname の sessions の行の部品のセッションの id をそのまま印とする）
        listSessions: async (userId: string) =>
          (
            await admin().query<{ a: string }>(
              `select distinct s.auth_session_id as a from sessions s join tenant_memberships tm on tm.member_id = s.member_id
                where tm.auth_user_id = $1 and s.auth_session_id is not null`,
              [userId],
            )
          ).rows.map((x) => ({ id: x.a, token: x.a })),
        updateSession: async (token: string) => {
          if (authFlags.failCleanup) throw new Error("認証の側の片付けが落ちた（試験）");
          authExpired.push(token);
        },
      },
    }),
  });
  const deps = async (pool: unknown): Promise<HookDeps> =>
    ({
      appPool: pool,
      authPool: admin(),
      repo: await createRepository(h.f.pool),
      auth: fakeAuth(),
      objects: (store ??= mkObjects(await createRepository(h.f.pool))),
      mailer: async (m: SentMail) => {
        if (failMailTo.has(m.to)) throw new Error("送れなかった（試験）");
        mails.push(m);
      },
      config: {
        env: "test",
        baseUrl: "https://api.kaname.test",
        webBaseUrl: "https://app.kaname.test",
        opsEmail: "ops@example.com",
      },
    }) as unknown as HookDeps;

  beforeAll(async () => {
    const f = await makeFixture();
    h.f = f;
    await migrateAuth(process.env["DATABASE_URL"]!);
    const web = async (hd: Headers) => {
      const m = /^Bearer fake:(member):([0-9a-f-]{36}):([0-9a-f-]{36})(?::su=(\d+))?(?::sid=[^:]+)?$/.exec(
        hd.get("authorization") ?? "",
      );
      if (!m) return null;
      const ctx: TenantContext = {
        tenantId: m[2]!,
        userId: m[3]!,
        role: "member",
        stepUpAt: m[4] ? new Date(Number(m[4])) : null,
      };
      return { ctx, termsPending: false, sessionId: "", authUserId: "" };
    };
    Object.assign(hooks, f.hooks);
    app = createApp({
      version: "test",
      repo: await createRepository(f.pool),
      resolve: withDevice(web, createDeviceResolver(f.pool)) as never,
      contract: { hooks, limits },
    });
    // この試験は 1 人で何度も呼ぶ。上限は上限の行だけで確かめ、ほかでは上げておく
    for (const op of [
      "getMe",
      "updateMe",
      "uploadAvatar",
      "requestEmailChange",
      "verifyEmailChange",
      "listMySessions",
      "revokeMySession",
      "revokeOtherSessions",
      "getNotificationSettings",
      "updateNotificationSettings",
      "copyNotificationSettings",
      "leaveWorkspace",
    ])
      limits[op] = 10_000;
  }, 120_000);
  afterAll(async () => {
    await h.f?.close();
  });

  h.limits = limits;
  h.mails = mails;
  h.failMailTo = failMailTo;
  h.driverFail = driverFail;
  h.authExpired = authExpired;
  h.authFlags = authFlags;
  h.store = () => store;
  h.ready = async () => {
    loading ??= (async () => {
      if (!existsSync(file)) return;
      const d = await deps(h.f.pool);
      Object.assign(hooks, ((await import(file)) as { register: HookModule }).register.make(d));
      // 別の葉の口を同じ文書で読む（試験が「足した後に別の口で読み直す」とき）。無い口は読まない
      for (const x of o.extraHooks ?? []) {
        const p = join(HOOKS_DIR, x);
        if (existsSync(p)) Object.assign(hooks, ((await import(p)) as { register: HookModule }).register.make(d));
      }
    })();
    await loading;
  };

  h.suNow = () => Date.now();
  h.suAgo = (minutes) => Date.now() - minutes * 60_000;
  h.call = (p, method, path, c = {}) =>
    Promise.resolve(
      app.request(`http://localhost/api/v1${path}`, {
        method,
        headers: {
          ...(c.form ? {} : { "content-type": "application/json" }),
          "x-forwarded-for": nextIp(),
          authorization: `Bearer fake:member:${p.tenantId}:${p.id}${c.su === undefined ? "" : `:su=${c.su}`}${c.sid ? `:sid=${c.sid}` : ""}`,
          ...(c.key ? { "idempotency-key": c.key } : {}),
          ...(c.headers ?? {}),
        },
        ...(c.form ? { body: c.form } : c.body === undefined ? {} : { body: JSON.stringify(c.body) }),
      }),
    );
  h.json = async (r) => (await r.clone().json()) as J;

  h.rows = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    (await admin().query(sql, p)).rows as R[];
  h.one = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await h.rows<R>(sql, p))[0] as R;
  h.num = async (sql, p = []) => Number((await h.one<{ n: string }>(sql, p)).n);
  h.audits = (tenantId, action) =>
    h.num("select count(*) as n from audit_events where tenant_id = $1 and action = $2", [tenantId, action]);
  h.notes = (memberId, kind) =>
    h.rows("select * from notifications where member_id = $1 and event_kind_id = $2 order by created_at", [
      memberId,
      kind,
    ]);
  h.session = async (p, so = {}) => {
    const auth = so.auth ?? `me-${randomUUID()}`;
    const r = await h.one<{ id: string }>(
      `insert into sessions (tenant_id, member_id, kind_id, auth_session_id, device_label, ip_region, issued_at, last_seen_at, revoked_at, revoke_reason_id)
       values ($1, $2, $3, $4, $5, $6, now() - interval '1 day', now() - make_interval(mins => $7), case when $8 then now() end, case when $8 then 'logout' end)
       returning id`,
      [
        p.tenantId,
        p.id,
        so.kind ?? "web",
        auth,
        so.label ?? "テストの端末",
        so.region === undefined ? "JP" : so.region,
        so.seenMinutesAgo ?? 5,
        so.revoked ?? false,
      ],
    );
    return { id: r.id, auth };
  };

  h.make = async (w, key, name, mo = {}) => {
    const tenant = mo.tenant ?? w.tenantId;
    const authUserId = randomUUID();
    const email = `${key}-${authUserId.slice(0, 8)}@engine-base.example`;
    await admin().query(
      'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
      [authUserId, name, email],
    );
    const scope = mo.scope ?? w.eg;
    const p = await h.f.person(tenant, scope, { name, authUserId });
    await admin().query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, $4, $5)",
      [tenant, p.id, authUserId, mo.role ?? "member", mo.status ?? "active"],
    );
    if (mo.owner) await admin().query("update members set role_id = 'owner' where id = $1", [p.id]);
    if (mo.groupRole)
      await admin().query(
        "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, true, $4)",
        [tenant, scope, p.id, mo.groupRole],
      );
    if (mo.status === "suspended")
      await admin().query("update members set suspended_at = now(), suspended_by = $1 where id = $1", [p.id]);
    return { ...p, name, email };
  };

  h.world = async () => {
    seq += 1;
    const co = await h.f.company(`株式会社ME-${seq}`, "EG");
    const other = await h.f.company(`ME の別の会社 ${seq}`, "OT");
    await admin().query("update scopes set name = '営業' where id = $1", [co.rootScope]);
    const jd = (
      await h.one<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, '受託開発', 'JD') returning id",
        [co.tenantId, co.rootScope],
      )
    ).id;
    const base = { tenantId: co.tenantId, eg: co.rootScope };
    const adminP = await h.make(base, "takamoto", "高本 聖斗", { role: "admin", owner: true });
    const admin2 = await h.make(base, "admin2", "二人目の管理者", { role: "admin" });
    const member = await h.make(base, "suzuki", "鈴木 一郎", { groupRole: "member" });
    const stopped = await h.make(base, "stopped", "止めた人", { status: "suspended" });
    const outsider = await h.make({ tenantId: other.tenantId, eg: other.rootScope }, "outsider", "別の会社の管理者", {
      role: "admin",
      owner: true,
    });
    return {
      tenantId: co.tenantId,
      eg: co.rootScope,
      jd,
      admin: adminP,
      admin2,
      member,
      stopped,
      other: { tenantId: other.tenantId, eg: other.rootScope },
      outsider,
    };
  };

  h.breakOn = async (table, tenantId, op, fn, cond) => {
    const name = `me_fail_${randomUUID().replaceAll("-", "")}`;
    await admin().query(
      `create function app.${name}() returns trigger language plpgsql as $$ begin if new.tenant_id = '${tenantId}'${cond ? ` and (${cond})` : ""} then raise exception 'me 試験の失敗'; end if; return new; end $$`,
    );
    await admin().query(`create trigger ${name} before ${op} on ${table} for each row execute function app.${name}()`);
    try {
      await fn();
    } finally {
      await admin().query(`drop trigger if exists ${name} on ${table}`);
      await admin().query(`drop function if exists app.${name}()`);
    }
  };

  h.breakPool = async (ops, fn) => {
    await h.ready();
    const dead = {
      connect: async () => {
        throw new Error("DB が落ちた（試験）");
      },
      query: async () => {
        throw new Error("DB が落ちた（試験）");
      },
      on: () => undefined,
    };
    const broken = ((await import(file)) as { register: HookModule }).register.make(await deps(dead));
    const saved: Record<string, Hook | undefined> = {};
    for (const op of ops) {
      saved[op] = hooks[op];
      if (broken[op]) hooks[op] = broken[op]!;
    }
    try {
      await fn();
    } finally {
      for (const op of ops) if (saved[op]) hooks[op] = saved[op]!;
    }
  };
  h.captureLogs = async (fn) => {
    const out: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
      out.push(a.map(String).join(" "));
    });
    try {
      await fn();
    } finally {
      spy.mockRestore();
    }
    return out.join("\n");
  };
  return h;
}
