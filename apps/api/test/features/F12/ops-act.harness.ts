// 段 13「運営が 1 社に手を出す」口（K-969 openPeek・closePeek／K-970 stopWorkspace・resumeWorkspace／K-1012 止めた会社の入口）の
//   単体の試験の土台（K-969 が持ち込む）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   会社・人・記録の作り方は ops-ws.harness.ts（K-963）をそのまま使い、口の入口だけをこの土台が自分で組む：
//     中を見る・止める・再開は契約の step_up が always なので、本人確認の取り直しの時刻を偽のログインに書けるようにする（billing.harness.ts と同じ形）。
//     偽のログイン：Bearer fake:<role>:<tenant>:<member>:<取り直しからの秒|->（ops-ws.harness.ts の Person の頭に秒を足す）
//   運営が顧客の画面を見るときは x-tenant-id でその会社を指す（middleware/tenant.ts）。葉の hooks のファイルは最初の要求のときに 1 回だけ読む
import { afterAll } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TenantContext } from "@kaname/db/context";
import { createRepository } from "@kaname/db/repository";
import { createDeviceResolver } from "@kaname/auth/resolver";
import { createApp } from "../../../src/app.js";
import { withDevice } from "../../../src/middleware/tenant.js";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { nextIp, type Person } from "../fixture.js";
import { startOpsWs, type OpsWs } from "./ops-ws.harness.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
/** 本人確認を 1 分前に取り直した（15 分の内） */
export const STEP = 60;

export interface CallOpts {
  /** 本人確認の取り直しからの秒。省くと取り直していない */
  stepUpAgoSec?: number;
  /** 運営が顧客の口を呼ぶときに指す会社（x-tenant-id） */
  tenant?: string;
}
export interface OpsAct extends OpsWs {
  /** 口を叩く（step と tenant を付けられる）。ops-ws.harness.ts の call と同じ hooks を使う */
  act: (who: Person | null, method: string, path: string, body?: unknown, o?: CallOpts) => Promise<Response>;
  /** 運営の人の ops_members.id（support_access_grants.ops_member_id に入る値） */
  opsMemberId: (p: Person) => Promise<string>;
  /** 中を見るの許可を DB に直に置く（openPeek を通さない準備）。minutesLeft が負なら期限切れ */
  grant: (
    tenantId: string,
    opener: Person,
    o?: { minutesLeft?: number; closed?: boolean; reason?: string },
  ) => Promise<string>;
  /** アプリの接続から関数を呼べなくし、返す関数で戻す（例 "app.ops_peek_open(uuid, text, integer, uuid)"） */
  breakFn: (signature: string) => Promise<() => Promise<void>>;
}

/** hookFiles：読む hooks のファイル名（拡張子なし。例 "ops-peek"） */
export async function startOpsAct(prefix: string, hookFiles: readonly string[]): Promise<OpsAct> {
  const base = await startOpsWs(prefix, []);
  const tenants: string[] = [];
  const t: OpsWs = {
    ...base,
    ws: async (label, o) => {
      const w = await base.ws(label, o);
      tenants.push(w.tenantId);
      return w;
    },
  };
  // 中を見るの許可・止める印・お知らせの行は ops-ws.harness.ts が消さないので、ここで消す（vitest の afterAll は後に登録した物から流れる）
  afterAll(async () => {
    if (!tenants.length) return;
    await t.f.admin.query("delete from support_access_grants where tenant_id = any($1::uuid[])", [tenants]);
    await t.f.admin.query(
      "update tenants set stopped_at = null, stop_on = null, stop_reason_key = null, stop_noticed_at = null where id = any($1::uuid[])",
      [tenants],
    );
  });
  const repo = await createRepository(t.f.pool);
  const deps = {
    appPool: t.f.pool,
    authPool: t.f.pool,
    repo,
    config: { webBaseUrl: "http://127.0.0.1:3123", baseUrl: "http://api.k969.test" },
  } as unknown as HookDeps;
  let loading: Promise<void> | null = null;
  const load = async (): Promise<void> => {
    for (const file of hookFiles) {
      const m = (await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule };
      Object.assign(t.f.hooks, m.register.make(deps));
    }
  };
  const web = async (h: Headers) => {
    const m = /^Bearer fake:(member|ops|client):([0-9a-f-]{36}):([0-9a-f-]{36}):(-|\d+)$/.exec(
      h.get("authorization") ?? "",
    );
    if (!m) return null;
    const ctx: TenantContext = {
      tenantId: m[2]!,
      userId: m[3]!,
      role: m[1] as TenantContext["role"],
      stepUpAt: m[4] === "-" ? null : new Date(Date.now() - Number(m[4]) * 1000),
    };
    return { ctx, sessionId: "", authUserId: "", termsPending: false };
  };
  const app = createApp({
    version: "test",
    repo,
    resolve: withDevice(web, createDeviceResolver(t.f.pool)) as never,
    contract: { hooks: t.f.hooks, limits: t.f.limits },
  });
  const act: OpsAct["act"] = async (who, method, path, body, o = {}) => {
    await (loading ??= load());
    const step = o.stepUpAgoSec === undefined ? "-" : String(o.stepUpAgoSec);
    const auth = who ? { authorization: `${String(who.auth["authorization"])}:${step}` } : {};
    return Promise.resolve(
      app.request(`http://localhost/api/v1${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": nextIp(),
          ...(o.tenant ? { "x-tenant-id": o.tenant } : {}),
          ...auth,
        },
        ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
      }),
    );
  };
  const opsMemberId: OpsAct["opsMemberId"] = async (p) =>
    (await t.row<{ id: string }>("select id from ops_members where member_id = $1", [p.id]))!.id;
  const grant: OpsAct["grant"] = async (tenantId, opener, o = {}) =>
    (await t.row<{ id: string }>(
      `insert into support_access_grants (tenant_id, scope, ops_member_id, reason, created_at, expires_at, closed_at)
       values ($1, 'read', $2, $3, now() - interval '5 minutes', now() + make_interval(mins => $4), case when $5 then now() end)
       returning id`,
      [tenantId, await opsMemberId(opener), o.reason ?? "問い合わせの調べ", o.minutesLeft ?? 30, o.closed ?? false],
    ))!.id;
  const breakFn: OpsAct["breakFn"] = async (signature) => {
    await t.f.admin.query(`revoke execute on function ${signature} from kaname_app`);
    return async () => {
      await t.f.admin.query(`grant execute on function ${signature} to kaname_app`);
    };
  };
  return { ...t, act, opsMemberId, grant, breakFn };
}
