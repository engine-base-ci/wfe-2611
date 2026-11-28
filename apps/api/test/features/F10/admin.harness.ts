// 段 11「人とアカウントを管理する」の口の試験の共通の土台（K-800 が切る段で書き、carry で運ぶ。K-802〜K-804・K-807・K-808・K-810〜K-812・K-814 と、
//   書き手 B の葉（K-815〜K-817・記録・設定・自分の設定の口）も使う）。行（it）は葉ごとのファイル（apps/api/test/features/F10/admin-*.test.ts）にある。
//   土台は各ファイルの頭で setupAdmin() を 1 回呼ぶ（ファイルごとに本物の DB を立てる）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては K-419 の試験（invite-create.test.ts）と同じ：本物の Postgres（migration を全部当てる）・本物の口の入口（createApp と契約の op）・
//   本物の口の振る舞い（apps/api/src/hooks/f10-admin.ts の register・K-326）。画面のログインだけは偽（Bearer fake:member:<会社>:<人>[:su=<取り直しの時刻 ms>]）。
//   メールの送出（関門 C6）だけは試験の偽（貯める・failMailTo の宛ては送れなかったことにする）。
//   口の振る舞いの読み込みは、試験の本体（it の中）の h.ready() で 1 回だけする（実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない）。
//
// 試験が前提にする形（11_tickets/K-800.md の「共通の確かめ」「契約」）:
//   口の登録：apps/api/src/hooks/f10-admin.ts の register（13 の口：createScope・updateScope・createLayer・updateLayer・resendInvitation・revokeInvitation・
//     getMember・updateMemberRole・updateMemberGroups・suspendMember・resumeMember・previewMemberRemoval・removeMember）
//   会社と人：各 it で world() が新しい会社を作る。会社のいちばん上のグループ「営業」（番号の頭 EG）・その子「受託開発」（JD）・「経理」（AC）。
//     人は 高本（管理者）・2 人目の管理者・佐藤（営業のマネージャー）・鈴木（営業のメンバー）・山口（受託開発の閲覧のみ）・止めた人・別の会社の人。
//     役割の束の権限は、所属の行・会社の役割の行を入れたときの引き金（0080）が付ける（試験は権限の行を直に足さない）。
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
/** 段 11 の口の hooks のファイル（K-800）。試験の本体で 1 回だけ読む */
const HOOKS_FILE = join(HERE, "..", "..", "..", "src", "hooks", "f10-admin.ts");
/** 口の入口が本人確認の取り直しを「直前 15 分」と見る長さ（D-125.139） */
export const STEP_UP_MS = 15 * 60 * 1000;

const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** errors.json の文（番号が無ければ目立つ字を返す） */
export const msg = (code: unknown): string =>
  ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${String(code)} が無い）`;

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}
export type J = Record<string, unknown> & {
  data?: Record<string, unknown>;
  code?: string;
  field?: string;
  detail?: Record<string, unknown>;
  details?: { field: string; message: string }[];
};
export interface P extends Person {
  name: string;
  email: string;
}
export interface World {
  tenantId: string;
  /** 営業（会社のいちばん上・EG） */
  eg: string;
  /** 受託開発（営業の子・JD） */
  jd: string;
  /** 経理（営業の子・AC） */
  ac: string;
  /** 管理者（会社を作った人・owner の印つき） */
  admin: P;
  /** 2 人目の管理者 */
  admin2: P;
  /** 営業のマネージャー（所属の行の役割 manager） */
  mgr: P;
  /** 営業のメンバー */
  member: P;
  /** 受託開発の閲覧のみ */
  viewer: P;
  /** 止めた人（営業・members.suspended_at と所属の status suspended） */
  stopped: P;
  /** 別の会社とその管理者 */
  other: { tenantId: string; rootScope: string };
  outsider: P;
}
export interface MakeOpts {
  tenant?: string;
  scope?: string;
  /** 会社の役割（tenant_memberships.role）。既定 member */
  role?: "admin" | "manager" | "member" | "viewer" | "requester";
  /** 所属の行の役割（scope_memberships.role）。足すと主の所属の行ができる（is_primary true） */
  groupRole?: "manager" | "member" | "viewer";
  status?: "active" | "suspended" | "invited" | "left";
  /** members.role_id を owner にする（会社を作った人） */
  owner?: boolean;
}
export interface CallOpts {
  body?: unknown;
  /** 本人確認の取り直しの時刻（ms）。無ければ取り直していない。AdminHarness.suNow()・suAgo(分) で作る */
  su?: number;
  key?: string;
  headers?: Record<string, string>;
}

export interface AdminHarness {
  f: Fixture;
  /** 口の振る舞いを読み込む（各 it の頭で呼ぶ。2 回目からは何もしない） */
  ready: () => Promise<void>;
  limits: Record<string, number>;
  mails: SentMail[];
  /** この宛てへのメールは送れなかったことにする */
  failMailTo: Set<string>;
  /** 試験ごとに新しい会社と人を作る（試験どうしで人を使い回さない・順番に頼らない） */
  world: () => Promise<World>;
  /** 会社に人を 1 人足す（認証の利用者・members・tenant_memberships・所属の行を入れる） */
  make: (w: { tenantId: string; eg: string }, key: string, name: string, o?: MakeOpts) => Promise<P>;
  /** 会社にグループを足す（番号の頭は重ならない字を渡す） */
  addScope: (tenantId: string, name: string, prefix: string, parent?: string) => Promise<string>;
  /** 口を叩く（道は /api/v1 から） */
  call: (p: Person, method: string, path: string, o?: CallOpts) => Promise<Response>;
  json: (r: Response) => Promise<J>;
  /** 取り直し：今 */
  suNow: () => number;
  /** 取り直し：n 分前 */
  suAgo: (minutes: number) => number;
  num: (sql: string, p?: unknown[]) => Promise<number>;
  one: <R = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<R>;
  rows: <R = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<R[]>;
  /** その人が担当のチケットを 1 つ置く（種別「タスク」・段 doing）。dueSql は日本時間の暦の日を返す SQL の式（例：`(now() at time zone 'Asia/Tokyo')::date + 3`）・staleDays は最後に触ってからの日数 */
  ticket: (
    w: { tenantId: string; eg: string },
    o: { assignee: Person; scope?: string; dueSql?: string; completed?: boolean; staleDays?: number },
  ) => Promise<string>;
  /** その会社の証跡（audit_events）の数（action で絞る） */
  audits: (tenantId: string, action: string) => Promise<number>;
  /** その人の受け箱の行（event_kind_id で絞る） */
  notes: (memberId: string, kind: string) => Promise<Record<string, unknown>[]>;
  /** その人の会社の文脈（持ち主の接続・行の守りの外）で SQL を流して巻き戻す。kaname_app に渡していない DB の関数を直に試すとき */
  asOwner: <R = Record<string, unknown>>(p: Person, sql: string, params?: unknown[]) => Promise<R[]>;
  /** fn の間だけ、その会社の行を書く所で DB の例外を起こす（その会社の行だけ・ほかの試験に効かせない） */
  breakOn: (
    table: string,
    tenantId: string,
    op: "insert" | "update",
    fn: () => Promise<void>,
    cond?: string,
  ) => Promise<void>;
  /** fn の間だけ、指した口（hooks の鍵）の接続を「落ちる接続」に差し替える（読むだけの口の DB の失敗を、ほかの試験・口に効かせずに起こす） */
  breakPool: (ops: string[], fn: () => Promise<void>) => Promise<void>;
  /** console の出力を貯めて返す（fn の間だけ） */
  captureLogs: (fn: () => Promise<void>) => Promise<string>;
}

export function setupAdmin(): AdminHarness {
  const h = {} as AdminHarness;
  const hooks: Record<string, Hook> = {};
  const limits: Record<string, number> = {};
  const mails: SentMail[] = [];
  const failMailTo = new Set<string>();
  let app: ReturnType<typeof createApp>;
  let loading: Promise<void> | null = null;
  let seq = 0;

  beforeAll(async () => {
    const f = await makeFixture();
    h.f = f;
    await migrateAuth(process.env["DATABASE_URL"]!);
    const web = async (hd: Headers) => {
      const m = /^Bearer fake:(member):([0-9a-f-]{36}):([0-9a-f-]{36})(?::su=(\d+))?$/.exec(
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
      "createScope",
      "updateScope",
      "createLayer",
      "updateLayer",
      "resendInvitation",
      "revokeInvitation",
      "getMember",
      "updateMemberRole",
      "updateMemberGroups",
      "suspendMember",
      "resumeMember",
      "previewMemberRemoval",
      "removeMember",
      "getWorkspaceMembers",
      "listLayers",
      "listScopes",
    ])
      limits[op] = 10_000;
  }, 120_000);

  afterAll(async () => {
    await h.f?.close();
  });

  h.limits = limits;
  h.mails = mails;
  h.failMailTo = failMailTo;
  h.ready = async () => {
    loading ??= (async () => {
      if (!existsSync(HOOKS_FILE)) return;
      const d = {
        appPool: h.f.pool,
        repo: await createRepository(h.f.pool),
        mailer: async (m: SentMail) => {
          if (failMailTo.has(m.to)) throw new Error("送れなかった（試験）");
          mails.push(m);
        },
        config: { env: "test", webBaseUrl: "https://app.kaname.test", opsEmail: "ops@example.com" },
      } as unknown as HookDeps;
      Object.assign(hooks, ((await import(HOOKS_FILE)) as { register: HookModule }).register.make(d));
      // 招く口の並び（K-419）・層の一覧（K-803 の hooks）・グループの一覧 listScopes（K-60 の hooks/tickets.ts）・承認待ちの並び listApprovalQueue（hooks/approve-complete.ts・K848-API-009）も同じ文書で読む（試験が「足した後に別の GET で読み直す」とき）
      for (const name of ["workspace-invitations", "f10-layers", "tickets", "approve-complete"]) {
        const file = join(HERE, "..", "..", "..", "src", "hooks", `${name}.ts`);
        if (existsSync(file)) Object.assign(hooks, ((await import(file)) as { register: HookModule }).register.make(d));
      }
    })();
    await loading;
  };

  h.suNow = () => Date.now();
  h.suAgo = (minutes) => Date.now() - minutes * 60_000;
  h.call = (p, method, path, o = {}) =>
    Promise.resolve(
      app.request(`http://localhost/api/v1${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": nextIp(),
          authorization: `Bearer fake:member:${p.tenantId}:${p.id}${o.su === undefined ? "" : `:su=${o.su}`}`,
          ...(o.key ? { "idempotency-key": o.key } : {}),
          ...(o.headers ?? {}),
        },
        ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
      }),
    );
  h.json = async (r) => (await r.clone().json()) as J;

  const admin = () => h.f.admin;
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

  h.ticket = async (w, o) =>
    (
      await h.one<{ id: string }>(
        `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, due_on, completed_at, completed_by, updated_at)
         values ($1, $2, '', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null),
                 (select id from ticket_stages where tenant_id = $1 and key = 'doing'), '試験のチケット', $3, $3,
                 ${o.dueSql ?? "null"}, case when $4 then now() end, case when $4 then $3::uuid end, now() - make_interval(days => $5))
         returning id`,
        [w.tenantId, o.scope ?? w.eg, o.assignee.id, o.completed ?? false, o.staleDays ?? 0],
      )
    ).id;
  h.addScope = async (tenantId, name, prefix, parent) =>
    (
      await h.one<{ id: string }>(
        "insert into scopes (tenant_id, parent_id, name, ticket_prefix) values ($1, $2, $3, $4) returning id",
        [tenantId, parent ?? null, name, prefix],
      )
    ).id;

  h.make = async (w, key, name, o = {}) => {
    const tenant = o.tenant ?? w.tenantId;
    const authUserId = randomUUID();
    const email = `${key}-${authUserId.slice(0, 8)}@engine-base.example`;
    await admin().query(
      'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
      [authUserId, name, email],
    );
    const scope = o.scope ?? w.eg;
    const p = await h.f.person(tenant, scope, { name, authUserId });
    await admin().query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, $4, $5)",
      [tenant, p.id, authUserId, o.role ?? "member", o.status ?? "active"],
    );
    if (o.owner) await admin().query("update members set role_id = 'owner' where id = $1", [p.id]);
    if (o.groupRole)
      await admin().query(
        "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, true, $4)",
        [tenant, scope, p.id, o.groupRole],
      );
    if (o.status === "suspended")
      // members_suspended_ck（0078）：止めた時刻と止めた人は両方そろえる（止めた人は自分自身で足りる）
      await admin().query("update members set suspended_at = now(), suspended_by = $1 where id = $1", [p.id]);
    return { ...p, name, email };
  };

  h.world = async () => {
    seq += 1;
    const co = await h.f.company(`株式会社K800-${seq}`, "EG");
    const other = await h.f.company(`K800 の別の会社 ${seq}`, "OT");
    await admin().query("update scopes set name = '営業' where id = $1", [co.rootScope]);
    const jd = await h.addScope(co.tenantId, "受託開発", "JD", co.rootScope);
    const ac = await h.addScope(co.tenantId, "経理", "AC", co.rootScope);
    const base = { tenantId: co.tenantId, eg: co.rootScope };
    const adminP = await h.make(base, "takamoto", "高本 聖斗", { role: "admin", owner: true });
    const admin2 = await h.make(base, "admin2", "二人目の管理者", { role: "admin" });
    const mgr = await h.make(base, "sato", "佐藤 花子", { role: "manager", groupRole: "manager" });
    const member = await h.make(base, "suzuki", "鈴木 一郎", { groupRole: "member" });
    const viewer = await h.make(base, "yamaguchi", "山口 健", { scope: jd, role: "viewer", groupRole: "viewer" });
    const stopped = await h.make(base, "stopped", "止めた人", { status: "suspended" });
    const outsider = await h.make({ tenantId: other.tenantId, eg: other.rootScope }, "outsider", "別の会社の管理者", {
      role: "admin",
      owner: true,
    });
    return {
      tenantId: co.tenantId,
      eg: co.rootScope,
      jd,
      ac,
      admin: adminP,
      admin2,
      mgr,
      member,
      viewer,
      stopped,
      other,
      outsider,
    };
  };

  h.asOwner = async <R = Record<string, unknown>>(p: Person, sql: string, params: unknown[] = []) => {
    const cl = await admin().connect();
    try {
      await cl.query("begin");
      await cl.query("select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)", [
        p.tenantId,
        p.id,
      ]);
      return (await cl.query(sql, params)).rows as R[];
    } finally {
      await cl.query("rollback").catch(() => undefined);
      cl.release();
    }
  };
  h.breakOn = async (table, tenantId, op, fn, cond) => {
    const name = `k800_fail_${randomUUID().replaceAll("-", "")}`;
    await admin().query(
      `create function app.${name}() returns trigger language plpgsql as $$ begin if new.tenant_id = '${tenantId}'${cond ? ` and (${cond})` : ""} then raise exception 'K800 試験の失敗'; end if; return new; end $$`,
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
    const d = {
      appPool: dead,
      repo: await createRepository(h.f.pool),
      config: { env: "test", webBaseUrl: "https://app.kaname.test", opsEmail: "ops@example.com" },
    } as unknown as HookDeps;
    const broken = ((await import(HOOKS_FILE)) as { register: HookModule }).register.make(d);
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
